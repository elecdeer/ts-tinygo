#!/usr/bin/env bash
# Build tsc with the standard Go toolchain as a baseline for TinyGo.
# usage: scripts/build-go.sh [wasip1|native ...] (default: wasip1 native)
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
out="$root/out"
targets=("$@")
[ ${#targets[@]} -eq 0 ] && targets=(wasip1 native)

mkdir -p "$out"
export GOWORK=off

pids=()
for t in "${targets[@]}"; do
  case "$t" in
    wasip1) (cd "$root/TypeScript/tsc" && GOOS=wasip1 GOARCH=wasm go build -o "$out/tsc-go.wasip1.wasm" ./cmd/tsc) & ;;
    native) (cd "$root/TypeScript/tsc" && go build -o "$out/tsc-native" ./cmd/tsc) & ;;
    *) echo "unknown target: $t" >&2; exit 2 ;;
  esac
  pids+=($!)
done
for pid in "${pids[@]}"; do wait "$pid"; done

ls -la "$out"/tsc-go.* "$out"/tsc-native 2>/dev/null || true
