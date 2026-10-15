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
SUFFIX=-mem2g TINYGO_FLAGS="-no-debug -target=$PWD/targets/wasip1-mem2g.json" scripts/build.sh wasip1   # 2GB initial memory
SUFFIX=-leaking TINYGO_FLAGS="-no-debug -gc=leaking" scripts/build.sh wasip1   # no garbage collection
```

Run one `scripts/build.sh` at a time: it applies and reverts the patches in the submodule.

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
- **One thread** ([0003](patches/0003-run-single-threaded-on-tinygo.patch)):
  tsc starts a goroutine per file or package, and on TinyGo each one reserves the full fixed-size stack:
  large projects run out of wasm32 memory even with 1MB stacks, and small ones are ~2.7x slower than on one goroutine.
  TinyGo builds always run single-threaded, as `--singleThreaded` does, including the parts that flag does not reach
  (the language server's auto-import registry and project builder).
- **Language server input** ([0004](patches/0004-poll-lsp-stdin-on-tinygo.patch)):
  a blocking `fd_read` on stdin stops every goroutine until the client sends the next message, so background work stalls.
  On TinyGo the server makes stdin non-blocking and polls it. This keeps diagnostics flowing, but completion still never answers (see below).

## Run

```sh
cd examples/basic
node ../../scripts/run-wasi.mjs ../../out/tsc.wasip1.wasm -p .
```

TinyGo builds run single-threaded on their own ([0003](patches/0003-run-single-threaded-on-tinygo.patch)).

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
| **TS6** (JS tsc on Node) | | 9.53 s | 1.0x | 1.70 GB |
| tsc native (parallel) | | 1.20 s | 7.9x | 1.50 GB |
| tsc native `--singleThreaded` | | 2.67 s | 3.6x | 1.05 GB |
| tsc, Go wasip1 | 51.2 MB | 15.3 s | 0.62x | 1.60 GB |
| tsc, TinyGo wasip1 `-opt=z` (default) | 20.9 MB | 21.5 s | 0.44x | 1.93 GB |
| tsc, TinyGo wasip1 `-opt=2` | 28.1 MB | 20.4 s | 0.47x | 2.15 GB |
| tsc, TinyGo wasip1, 2GB initial memory | 20.9 MB | 15.9 s | 0.60x | 2.29 GB |
| tsc, TinyGo wasip1 `-gc=leaking` | 18.4 MB | 9.67 s | 0.99x | 2.73 GB |
| ts-rust native (parallel) | | 0.72 s | 13.2x | 1.05 GB |
| ts-rust native `--singleThreaded` | | 1.85 s | 5.2x | 0.74 GB |
| ts-rust wasm `opt-level=z` | 4.8 MB | 5.33 s | 1.8x | 0.77 GB |
| ts-rust wasm `opt-level=s` | 6.0 MB | 4.71 s | 2.0x | 0.79 GB |

**examples/basic** (2 files; dominated by parsing and binding the bundled `lib.*.d.ts`)

| variant | wall time | speedup vs TS6 | peak RSS |
|---|---:|---:|---:|
| **TS6** (JS tsc on Node) | 397 ms | 1.0x | 0.24 GB |
| tsc native (parallel) | 108 ms | 3.7x | 0.09 GB |
| tsc native `--singleThreaded` | 116 ms | 3.4x | 0.09 GB |
| tsc, Go wasip1 | 923 ms | 0.43x | 0.36 GB |
| tsc, TinyGo wasip1 `-opt=z` (default) | 1,038 ms | 0.38x | 0.42 GB |
| tsc, TinyGo wasip1 `-opt=2` | 1,116 ms | 0.36x | 0.48 GB |
| tsc, TinyGo wasip1, 2GB initial memory | 796 ms | 0.50x | 0.46 GB |
| tsc, TinyGo wasip1 `-gc=leaking` | 609 ms | 0.65x | 0.36 GB |
| ts-rust native (parallel) | 51 ms | 7.8x | 0.07 GB |
| ts-rust native `--singleThreaded` | 59 ms | 6.8x | 0.06 GB |
| ts-rust wasm `opt-level=z` | 320 ms | 1.2x | 0.19 GB |
| ts-rust wasm `opt-level=s` | 289 ms | 1.4x | 0.19 GB |

All wasm runs and the `--singleThreaded` rows use `--singleThreaded`; TS6 has no such option and is single-threaded.

Takeaways:

- The Go port compiled to wasm is slower than TS6 running as JavaScript on the same engine: 0.62x with Go, 0.44x with TinyGo by default.
- ts-rust's wasm build is the fastest wasm build (1.8-2.0x TS6), at under half TS6's memory.
- TinyGo spends over half its time collecting and allocating (see below). A 2GB initial memory brings it level with standard Go; without collection it matches TS6.
- `-opt=2` buys nothing over the default `-opt=z` and makes the module larger.
- Without `--singleThreaded`, TinyGo runs out of memory on social-app (goroutine-per-file × fixed stacks), even with 1MB stacks.
- TS6 and the TS7-based checkers differ in some messages: on `examples/basic`, TS6 reports TS2345 where they report TS2739.
- In the browser playground (Chrome, small sample) a run takes about 0.9-1.0 s with the Go and TinyGo builds and about 0.3 s with ts-rust.

### Why TinyGo is slow

A CPU profile of social-app (`node --cpu-prof`) puts about a third of the time in TinyGo's GC, a fifth in `(runtime.gcBlock).findHead` alone, and 8% in maps; asyncify is 0.2%.
`-gc=leaking` (never free) runs 2.2x faster.

- TinyGo 0.43's block GC marks an object's head on its *last* block, so following a pointer to the start of an object walks the block states to its end: the cost of each pointer grows with the size of what it points to.
  typescript-go allocates nodes and types in arenas, so most pointers point into large chunks.
- The heap grows only when a collection leaves less than a third free, and every collection walks the whole live heap.
  `runtime/debug.SetGCPercent` does nothing in TinyGo.
- Without changing TinyGo, a larger initial memory skips the collections of the early, small heaps (`targets/wasip1-mem2g.json`).
  2GB is the sweet spot: the heap grows by doubling, so 2GB can still grow once to wasm32's 4GB; 3GB cannot and runs slower (17.1 s).
  It costs memory up front, which a browser may refuse.
- `-gc=leaking` only works while everything a run ever allocates fits in 4GB (2.7GB for social-app). A larger project such as VS Code (4.2GB with TS7) runs out.
- Patching TinyGo's runtime (not kept here) gives similar gains: skipping all-tail state bytes 8 at a time in `findHead` cut social-app by 22%, growing at half free instead of a third by 9%, and both together by 27%.

## Language server benchmark

How an editor experiences each implementation: start the server, open a file, then time diagnostics, an edit, completion and hover.
`bench/lsp/run.mjs` is the client; it speaks LSP (pull or push diagnostics) and tsserver's own protocol.

```sh
bench/lsp/all.sh bench/repos/social-app bench/repos/social-app/src/view/com/composer/Composer.tsx 3
node bench/lsp/summarize.mjs bench/results/lsp-social-app.jsonl
```

social-app, opening `src/view/com/composer/Composer.tsx` (2,736 lines, 90 imports). Each edit appends a line that alternates between a type error and valid code;
completion is asked after an appended `[].`. Medians of 3 runs (edits: of all 15).

| server | initialize | first diagnostics | diagnostics after an edit | completion | hover |
|---|---:|---:|---:|---:|---:|
| TS6 (tsserver, `geterr`) | 47 ms | 701 ms | 644 ms | 21 ms | 2 ms |
| TS6 (typescript-language-server) | 74 ms | 3.76 s | 442 ms | 913 ms | 17 ms |
| tsc native | 7 ms | 486 ms | 286 ms | 283 ms | 1 ms |
| ts-rust native | 4 ms | 731 ms | 420 ms | 933 ms | 262 ms |
| tsc, TinyGo wasm | 192 ms | 7.36 s | 2.06 s | no answer | no answer |
| tsc, TinyGo wasm, 2GB initial memory | 81 ms | 4.54 s | 3.73 s | no answer | no answer |
| tsc, Go wasm | 104 ms | no answer | – | – | – |

- The wasm builds run under Node.js WASI (`scripts/run-wasi.mjs`). ts-rust's wasm build has no language server.
- tsc and ts-rust include suggestion diagnostics (16 "deprecated" hints here) in their pull results; tsserver reports those as a separate `suggestionDiag` event, which `geterr` waits for but this count leaves out.
- typescript-language-server pushes diagnostics after its own delay, so its edit times are mostly that delay; the direct tsserver row is TS6's checking time.
- On TinyGo, edits settle at 1.8-2.2 s; in every run the first takes about 4.3 s and one of the next two 8-9 s (the 2nd on the default build, the 3rd with 2GB). The 2GB build's first diagnostics are faster, its median edit is not.
- TinyGo never answers completion: with nothing else to do, the server idles at 0% CPU with the request pending.
  It answered (in 9.7 s, then hover in 12 ms) only when the client sent a notification every 50 ms, so the request waits on work that only advances when a message arrives. The cause is not pinned down.
- Go's wasip1 build answers `initialize` and then hangs; Node.js's WASI does not seem to wake Go's poller for stdin (not verified).

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
