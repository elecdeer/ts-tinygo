#!/usr/bin/env bash
# Build tsc with the standard Go toolchain as a baseline for TinyGo.
# usage: scripts/build-go.sh [wasip1|native ...] (default: wasip1 native)
# TS_VERSION picks the compiler source (default: 7.1); 7.0 builds go to out/tsc-go-7.0.wasip1.wasm etc.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
out="$root/out"
targets=("$@")
[ ${#targets[@]} -eq 0 ] && targets=(wasip1 native)
# shellcheck source=scripts/ts-version.sh
source "$root/scripts/ts-version.sh"

mkdir -p "$out"
export GOWORK=off

pids=()
for t in "${targets[@]}"; do
  case "$t" in
    wasip1) (cd "$ts_module" && GOOS=wasip1 GOARCH=wasm go build -o "$out/tsc-go${ts_suffix}.wasip1.wasm" "$ts_cmd") & ;;
    native) (cd "$ts_module" && go build -o "$out/tsc-native${ts_suffix}" "$ts_cmd") & ;;
    *) echo "unknown target: $t" >&2; exit 2 ;;
  esac
  pids+=($!)
done
for pid in "${pids[@]}"; do wait "$pid"; done

ls -la "$out"/tsc-go${ts_suffix}.* "$out"/tsc-native${ts_suffix} 2>/dev/null || true
