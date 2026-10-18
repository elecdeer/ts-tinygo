#!/usr/bin/env bash
# Build pingdotgg/ts-rust (a Rust port of typescript-go) for comparison.
# usage: scripts/build-ts-rust.sh [wasm|wasm-s|native ...] (default: all)
#   wasm    out/ts-rust.wasm     upstream default: opt-level z, the smallest module
#   wasm-s  out/ts-rust-s.wasm   upstream's faster variant: opt-level s, lower inline limit
#   native  out/ts-rust-native   the `tsgo` binary with the goport profile
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
src="$root/ts-rust"
out="$root/out"
targets=("$@")
[ ${#targets[@]} -eq 0 ] && targets=(wasm wasm-s native)

mkdir -p "$out"

# Fat LTO links on one thread, so targets build in parallel, each with its own target dir
# (a shared one would serialize them on cargo's lock).
pids=()
for t in "${targets[@]}"; do
  case "$t" in
    wasm)
      (cd "$src" && CARGO_TARGET_DIR="$src/target/wasm-z" scripts/wasm/build.sh "$out/ts-rust.wasm") & ;;
    wasm-s)
      (cd "$src" && CARGO_TARGET_DIR="$src/target/wasm-s" CARGO_PROFILE_WASM_OPT_LEVEL=s \
        WASM_RUSTFLAGS="-C llvm-args=-inlinehint-threshold=150" scripts/wasm/build.sh "$out/ts-rust-s.wasm") & ;;
    native)
      (cd "$src" && CARGO_TARGET_DIR="$src/target/native" cargo build --profile goport --bin tsgo &&
        cp "$src/target/native/goport/tsgo" "$out/ts-rust-native") & ;;
    *) echo "unknown target: $t" >&2; exit 2 ;;
  esac
  pids+=($!)
done
for pid in "${pids[@]}"; do wait "$pid"; done

ls -la "$out"/ts-rust*
