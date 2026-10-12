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

Tools are pinned in `mise.toml` (Go, TinyGo, binaryen for `wasm-opt`, hyperfine, Rust for ts-rust).

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

A browser playground (Vite + React + Monaco) runs the builds in a worker on an in-memory file system and can switch between TinyGo, standard Go and ts-rust.

```sh
scripts/build.sh wasip1 && scripts/build-go.sh wasip1 && scripts/build-ts-rust.sh wasm
cd playground
pnpm install
pnpm run dev
```

## Benchmark

```sh
pnpm --dir bench/ts6 install                    # TypeScript 6 baseline
bench/run.sh examples/basic tsconfig.json 10   # needs the builds above (ts-rust optional)
bench/run.sh bench/repos/social-app tsconfig.check.web.json 3
```

Results on an Apple Silicon Mac (14 cores, 48GB), Node.js 26, TypeScript 6.0.3, TinyGo 0.43, Go 1.27.2, Rust 1.99.
Wall time includes Node.js startup and, for wasm, V8 compiling the module. Speedup is relative to TypeScript 6 (the JavaScript tsc).
Raw data is in `bench/results/`.

**[bluesky-social/social-app](https://github.com/bluesky-social/social-app)** (`tsconfig.check.web.json`: 4,989 files, 565k lines, no errors; the "bluesky" row of the TS 7.0 announcement benchmark)

| variant | module | wall time | speedup vs TS6 | peak RSS |
|---|---:|---:|---:|---:|
| **TS6** (JS tsc on Node) | | 9.25 s | 1.0x | 1.70 GB |
| tsc native (parallel) | | 1.26 s | 7.3x | 1.51 GB |
| tsc native `--singleThreaded` | | 2.63 s | 3.5x | 1.09 GB |
| tsc, Go wasip1 | 51.2 MB | 14.2 s | 0.65x | 1.60 GB |
| tsc, TinyGo wasip1 `-opt=z` | 20.9 MB | 20.7 s | 0.45x | 1.94 GB |
| tsc, TinyGo wasip1 `-opt=2` | 28.1 MB | 20.4 s | 0.45x | 2.15 GB |
| ts-rust native (parallel) | | 0.74 s | 12.5x | 1.06 GB |
| ts-rust native `--singleThreaded` | | 1.97 s | 4.7x | 0.74 GB |
| ts-rust wasm `opt-level=z` | 4.8 MB | 5.68 s | 1.6x | 0.77 GB |
| ts-rust wasm `opt-level=s` | 6.0 MB | 5.08 s | 1.8x | 0.79 GB |

**examples/basic** (2 files; dominated by parsing and binding the bundled `lib.*.d.ts`)

| variant | wall time | speedup vs TS6 | peak RSS |
|---|---:|---:|---:|
| **TS6** (JS tsc on Node) | 384 ms | 1.0x | 0.24 GB |
| tsc native (parallel) | 106 ms | 3.6x | 0.09 GB |
| tsc native `--singleThreaded` | 115 ms | 3.3x | 0.09 GB |
| tsc, Go wasip1 | 919 ms | 0.42x | 0.36 GB |
| tsc, TinyGo wasip1 `-opt=z` | 1,031 ms | 0.37x | 0.40 GB |
| tsc, TinyGo wasip1 `-opt=2` | 1,119 ms | 0.34x | 0.47 GB |
| ts-rust native (parallel) | 51 ms | 7.5x | 0.07 GB |
| ts-rust native `--singleThreaded` | 58 ms | 6.6x | 0.06 GB |
| ts-rust wasm `opt-level=z` | 321 ms | 1.2x | 0.19 GB |
| ts-rust wasm `opt-level=s` | 293 ms | 1.3x | 0.19 GB |

All wasm runs and the `--singleThreaded` rows use `--singleThreaded`; TS6 has no such option and is single-threaded.

Takeaways:

- The Go port compiled to wasm is slower than TS6 running as JavaScript on the same engine: 0.65x with Go, 0.45x with TinyGo.
- ts-rust's wasm build is the only wasm build faster than TS6 (1.6-1.8x), at under half its memory.
- TinyGo is about 1.4x slower than standard Go on wasm and uses ~20% more memory, but the module is 2.5x smaller. `-opt=2` buys nothing over the default `-opt=z`.
- Without `--singleThreaded`, TinyGo runs out of memory on social-app (goroutine-per-file × fixed stacks), even with 1MB stacks.
- TS6 and the TS7-based checkers differ in some messages: on `examples/basic`, TS6 reports TS2345 where they report TS2739.
- In the browser playground (Chrome, small sample) a run takes about 0.9-1.0 s with the Go and TinyGo builds and about 0.3 s with ts-rust.

## Other implementations

### ts-rust

[pingdotgg/ts-rust](https://github.com/pingdotgg/ts-rust) (submodule `ts-rust`) is a Rust port of typescript-go with a supported `wasm32-wasip1` build.
Its module is not a WASI command: its JS glue (`npm/wasm/core.js`) drives it through `ts_input`/`ts_run`/`ts_output` exports and a `ts_host` file system import.

```sh
rustup target add wasm32-wasip1
scripts/build-ts-rust.sh            # out/ts-rust.wasm, out/ts-rust-s.wasm, out/ts-rust-native
node scripts/run-ts-rust.mjs out/ts-rust.wasm -p examples/basic
```

### bun check (not built)

`bun check`'s checker is `src/sema` in [oven-sh/bun](https://github.com/oven-sh/bun) (Rust), with a standalone `bun-sema` binary that replaces Bun's C/C++ side with Rust stand-ins.
It builds natively (after `bun scripts/build.ts --profile=debug --mode=codegen`, `BUN_CODEGEN_DIR`, stub `vendor/` crates, and one missing `mi_heap_visit_blocks` stand-in) and matches tsc on `examples/basic`.
`wasm32-wasip1` was not pursued: `bun_core`'s strings tag pointers in bits 61-63, `bun_sys` has ~290 Unix/Windows-only `cfg`s with no WASI branch, and the checker expects a thread pool.
