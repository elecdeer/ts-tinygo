#!/usr/bin/env bash
# Build TypeScript's Go port (tsc) to wasm with TinyGo.
# usage: scripts/build.sh [wasip1|wasm ...] (default: wasip1 wasm)
# Extra tinygo flags can be passed via TINYGO_FLAGS (default: -no-debug).
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
ts="$root/TypeScript"
out="$root/out"
targets=("$@")
[ ${#targets[@]} -eq 0 ] && targets=(wasip1 wasm)

# The checker recurses deeply and TinyGo goroutine stacks are fixed-size
# (64KB by default), so a small stack silently corrupts the heap.
# 64MB per goroutine exhausts wasm32 memory, 16MB works.
stack_size="${STACK_SIZE:-16MB}"

mkdir -p "$out"

# Apply local patches for the duration of the build only.
patches=("$root"/patches/*.patch)
git -C "$ts" apply "${patches[@]}"
trap 'git -C "$ts" apply -R "${patches[@]}"' EXIT

# The repo root has a go.work; build tsc as a standalone module.
export GOWORK=off

# Link/optimize phases are single-threaded, so build targets in parallel.
pids=()
for t in "${targets[@]}"; do
  # shellcheck disable=SC2086
  (cd "$ts/tsc" && tinygo build -target="$t" -stack-size="$stack_size" ${TINYGO_FLAGS:--no-debug} -o "$out/tsc.$t.wasm" ./cmd/tsc) &
  pids+=($!)
done
for pid in "${pids[@]}"; do wait "$pid"; done

ls -la "$out"/tsc.*.wasm
