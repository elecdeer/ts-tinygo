#!/usr/bin/env bash
# Build TypeScript's Go port (tsc) to wasm with TinyGo.
# usage: scripts/build.sh [wasip1|wasm ...] (default: wasip1 wasm)
# Extra tinygo flags can be passed via TINYGO_FLAGS (e.g. TINYGO_FLAGS="-no-debug").
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
src="$root/TypeScript/tsc"
out="$root/out"
targets=("${@:-wasip1 wasm}")
# shellcheck disable=SC2206
targets=(${targets[*]})

mkdir -p "$out"

# Apply local patches (idempotent: skip ones already applied).
for p in "$root"/patches/*.patch; do
  if git -C "$root/TypeScript" apply --check "$p" 2>/dev/null; then
    git -C "$root/TypeScript" apply "$p"
  fi
done

# The repo root has a go.work; build tsc as a standalone module.
export GOWORK=off

# Link/optimize phases are single-threaded, so build targets in parallel.
pids=()
for t in "${targets[@]}"; do
  (cd "$src" && tinygo build -target="$t" ${TINYGO_FLAGS:-} -o "$out/tsc.$t.wasm" ./cmd/tsc) &
  pids+=($!)
done
for pid in "${pids[@]}"; do wait "$pid"; done

ls -la "$out"/tsc.*.wasm
