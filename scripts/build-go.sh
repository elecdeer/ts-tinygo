#!/usr/bin/env bash
# Build tsc with the standard Go toolchain as a baseline for TinyGo.
# usage: scripts/build-go.sh [wasip1|native ...] (default: wasip1 native)
# TS_VERSION picks the compiler source (default: 7.1); 7.0 builds go to out/tsc-go-7.0.wasip1.wasm etc.
# WASM_OPT_FLAGS runs wasm-opt on the wasip1 build, which the Go toolchain never does, and SUFFIX
# names its output, e.g. SUFFIX=-oz WASM_OPT_FLAGS=-Oz -> out/tsc-go-oz.wasip1.wasm
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
    wasip1) (
      wasm="$out/tsc-go${ts_suffix}${SUFFIX:-}.wasip1.wasm"
      cd "$ts_module" && GOOS=wasip1 GOARCH=wasm go build -o "$wasm" "$ts_cmd"
      if [ -n "${WASM_OPT_FLAGS:-}" ]; then
        # Go's modules have no target_features section, so enable the features Go emits.
        # shellcheck disable=SC2086
        wasm-opt $WASM_OPT_FLAGS --enable-bulk-memory --enable-sign-ext --enable-nontrapping-float-to-int "$wasm" -o "$wasm"
      fi
    ) & ;;
    native) (cd "$ts_module" && go build -o "$out/tsc-native${ts_suffix}" "$ts_cmd") & ;;
    *) echo "unknown target: $t" >&2; exit 2 ;;
  esac
  pids+=($!)
done
for pid in "${pids[@]}"; do wait "$pid"; done

ls -la "$out"/tsc-go${ts_suffix}${SUFFIX:-}.* "$out"/tsc-native${ts_suffix} 2>/dev/null || true
