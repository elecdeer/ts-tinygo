#!/usr/bin/env bash
# Build oxc-project/tsrs (a Rust port of the TypeScript 7 compiler and language server) for comparison.
# usage: scripts/build-tsrs.sh [wasm|wasm-z|native ...] (default: all)
#   wasm    out/tsrs.wasm        upstream default: opt-level s, lower inline limit (what @tsrs/wasm ships)
#   wasm-z  out/tsrs-z.wasm      opt-level z, the smallest module
#   native  out/tsrs-native      the `tsrs` binary (compiler and `--lsp --stdio`) with the release profile
# tsrs pins its own Rust version in rust-toolchain.toml; rustup installs it on first use.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
src="$root/tsrs"
out="$root/out"
targets=("$@")
[ ${#targets[@]} -eq 0 ] && targets=(wasm wasm-z native)

mkdir -p "$out"

# Fat LTO links on one thread, so targets build in parallel, each with its own target dir
# (a shared one would serialize them on cargo's lock).
pids=()
for t in "${targets[@]}"; do
  case "$t" in
    wasm)
      (cd "$src" && CARGO_TARGET_DIR="$src/target/wasm-s" OPT=s OUT="$out/tsrs.wasm" tools/wasm/build.sh) & ;;
    wasm-z)
      (cd "$src" && CARGO_TARGET_DIR="$src/target/wasm-z" OPT=z OUT="$out/tsrs-z.wasm" tools/wasm/build.sh) & ;;
    native)
      (cd "$src" && CARGO_TARGET_DIR="$src/target/native" cargo build --release --locked -p tsrs_cli --bin tsrs &&
        cp "$src/target/native/release/tsrs" "$out/tsrs-native") & ;;
    *) echo "unknown target: $t" >&2; exit 2 ;;
  esac
  pids+=($!)
done
for pid in "${pids[@]}"; do wait "$pid"; done

ls -la "$out"/tsrs*
