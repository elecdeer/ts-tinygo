# ts-tinygo

Experiments with building the Go port of the TypeScript compiler (`tsc`, TypeScript 7) to WebAssembly with [TinyGo](https://tinygo.org/).

The compiler source is [microsoft/TypeScript](https://github.com/microsoft/TypeScript) (`tsc/`), pinned as the `TypeScript` submodule.
`microsoft/typescript-go` was archived after the port was merged upstream.

## Status

| Target | Build | Runs |
|---|---|---|
| TinyGo `wasip1` | ✅ | ✅ type-checks and emits (Node.js WASI, browser via [browser_wasi_shim](https://github.com/bjorn3/browser_wasi_shim)) |
| TinyGo `wasm` (js) | ✅ | ❌ no filesystem in TinyGo's js target (`os.Getwd` is empty → `path must be absolute`) |

## Setup

Tools are pinned in `mise.toml` (Go, TinyGo, binaryen for `wasm-opt`, hyperfine).

```sh
git submodule update --init --depth 1
mise install
```

## Build

```sh
scripts/build.sh            # TinyGo: out/tsc.wasip1.wasm, out/tsc.wasm.wasm
scripts/build.sh wasip1     # one target only
scripts/build-go.sh         # standard Go baseline: out/tsc-go.wasip1.wasm, out/tsc-native
SUFFIX=-o2 TINYGO_FLAGS="-no-debug -opt=2" scripts/build.sh wasip1   # speed-optimized variant
```

`scripts/build.sh` applies `patches/*.patch` to the submodule for the duration of the build and reverts them afterwards.
The link/optimize phase of TinyGo is single-threaded, so targets are built in parallel.

### Workarounds

- **TinyGo compiler panic `unknown type: T`** ([0001](patches/0001-avoid-generic-method-tinygo-panic.patch)):
  TinyGo 0.43 crashes on Go 1.27 generic methods whose type parameter only appears in the body and flows into an interface.
  `packagejson`'s `unmarshalJSONValueFrom` is rewritten as a generic function. Minimal repro:

  ```go
  type V struct{ v any }

  func (v *V) Set[T any](n int) { v.v = make([]T, n) } // panics; the same as a generic func compiles

  func main() { var v V; v.Set[string](2) }
  ```

- **Working directory** ([0002](patches/0002-sync-cwd-with-pwd-on-tinygo-wasip1.patch)):
  wasi-libc emulates the cwd starting at `/` while standard Go's wasip1 port reads `$PWD`, so the TinyGo build `chdir`s to `$PWD` on startup.
- **Stack size**: TinyGo goroutine stacks are fixed (64KB by default on wasm); the checker overflows them and corrupts the heap
  (it shows up as a nil-pointer panic in `core.LinkStore.Get`). The build uses `-stack-size=16MB`.

## Run

```sh
cd examples/basic
node ../../scripts/run-wasi.mjs ../../out/tsc.wasip1.wasm -p .
```

Use `--singleThreaded` with TinyGo builds. tsc otherwise starts a goroutine per file, and each one reserves the full fixed-size stack:
large projects run out of wasm32 memory even with 1MB stacks, and small ones are ~2.7x slower than single-threaded.

## Playground

A browser playground (Vite + React + Monaco) runs the wasip1 builds in a worker on an in-memory filesystem and can switch between the TinyGo and standard Go builds.

```sh
scripts/build.sh wasip1 && scripts/build-go.sh wasip1
cd playground
pnpm install
pnpm run dev
```

## Benchmark

```sh
bench/run.sh examples/basic tsconfig.json 10
bench/run.sh bench/repos/social-app tsconfig.check.web.json 3
```

Results on an Apple Silicon Mac (14 cores, 48GB), Node.js 26 WASI, TinyGo 0.43, Go 1.27.2.
Wall time includes Node.js startup and V8 compiling the wasm module. Raw data is in `bench/results/`.

**[bluesky-social/social-app](https://github.com/bluesky-social/social-app)** (`tsconfig.check.web.json`: 4,989 files, 565k lines, no errors; the "bluesky" row of the TS 7.0 announcement benchmark)

| variant | wall time | vs native | peak RSS |
|---|---:|---:|---:|
| native (parallel) | 1.32 s | 1.0x | 1.51 GB |
| native `--singleThreaded` | 2.78 s | 2.1x | 1.02 GB |
| Go wasip1 `--singleThreaded` | 14.7 s | 11.1x | 1.60 GB |
| TinyGo `-opt=z` `--singleThreaded` | 20.8 s | 15.8x | 1.93 GB |
| TinyGo `-opt=2` `--singleThreaded` | 20.7 s | 15.7x | 2.14 GB |

**examples/basic** (2 files; dominated by parsing and binding the bundled `lib.*.d.ts`)

| variant | wall time | vs native | peak RSS |
|---|---:|---:|---:|
| native (parallel) | 110 ms | 1.0x | 0.09 GB |
| native `--singleThreaded` | 116 ms | 1.1x | 0.09 GB |
| Go wasip1 `--singleThreaded` | 912 ms | 8.3x | 0.36 GB |
| TinyGo `-opt=z` `--singleThreaded` | 1,053 ms | 9.6x | 0.42 GB |
| TinyGo `-opt=2` `--singleThreaded` | 1,147 ms | 10.5x | 0.47 GB |

Takeaways:

- TinyGo is about 1.4x slower than standard Go on wasm and uses ~20% more memory, but the module is 2.5x smaller (20.9 MB vs 51.2 MB).
- `-opt=2` buys nothing over the default `-opt=z` and makes the module larger (28.1 MB).
- Without `--singleThreaded`, TinyGo runs out of memory on social-app (goroutine-per-file × fixed stacks), even with 1MB stacks.
- In the browser playground (Chrome, small sample) both builds take about 0.9-1.0 s per run.
