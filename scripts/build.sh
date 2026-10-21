#!/usr/bin/env bash
# Build TypeScript's Go port (tsc) to wasm with TinyGo.
# usage: scripts/build.sh [wasip1|wasm ...] (default: wasip1 wasm)
# Extra tinygo flags can be passed via TINYGO_FLAGS (default: -no-debug).
# SUFFIX names variant outputs, e.g. SUFFIX=-o2 TINYGO_FLAGS="-no-debug -opt=2" -> out/tsc-o2.wasip1.wasm
# TS_VERSION picks the compiler source (default: 7.1); 7.0 builds go to out/tsc-7.0*.wasm.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
out="$root/out"
targets=("$@")
[ ${#targets[@]} -eq 0 ] && targets=(wasip1 wasm)
# shellcheck source=scripts/ts-version.sh
source "$root/scripts/ts-version.sh"

# The checker recurses deeply and TinyGo goroutine stacks are fixed-size
# (64KB by default), so a small stack silently corrupts the heap.
# 64MB per goroutine exhausts wasm32 memory, 16MB works.
stack_size="${STACK_SIZE:-16MB}"

mkdir -p "$out"

# Apply local patches for the duration of the build only.
git -C "$ts_repo" apply "${ts_patches[@]}"
trap 'git -C "$ts_repo" apply -R "${ts_patches[@]}"' EXIT

# The repo root has a go.work; build tsc as a standalone module.
export GOWORK=off

# Link/optimize phases are single-threaded, so build targets in parallel.
pids=()
for t in "${targets[@]}"; do
  # shellcheck disable=SC2086
  (cd "$ts_module" && tinygo build -target="$t" -stack-size="$stack_size" ${TINYGO_FLAGS:--no-debug} -o "$out/tsc${ts_suffix}${SUFFIX:-}.$t.wasm" "$ts_cmd") &
  pids+=($!)
done
for pid in "${pids[@]}"; do wait "$pid"; done

ls -la "$out"/tsc${ts_suffix}${SUFFIX:-}.*.wasm
