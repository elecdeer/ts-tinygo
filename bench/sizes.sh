#!/usr/bin/env bash
# Measure what each variant in bench/run.sh ships: raw and gzip -9 size.
# usage: bench/sizes.sh  (writes bench/results/sizes.md)
# The wasm modules embed the lib.*.d.ts files, so TS6 counts tsc.js, _tsc.js and its lib.*.d.ts.
# The Rust ports' JS glue (a few KB) is left out.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
out="$root/out"
ts6="$root/bench/ts6/node_modules/typescript/lib"
md="$root/bench/results/sizes.md"

# Prints "<raw bytes> <gzip -9 bytes>" for the concatenation of the given files.
measure() { printf '%s %s\n' "$(cat "$@" | wc -c)" "$(cat "$@" | gzip -9 | wc -c)"; }
mb() { awk -v b="$1" 'BEGIN { printf "%.1f MB", b / 1e6 }'; }

row() {
  local name="$1"; shift
  read -r raw gz < <(measure "$@")
  echo "| $name | $(mb "$raw") | $(mb "$gz") |" | tee -a "$md"
}

echo "| variant | size | gzip -9 |" | tee "$md"
echo "|---|---:|---:|" | tee -a "$md"
row "TS6.0" "$ts6/tsc.js" "$ts6/_tsc.js" "$ts6"/lib.*.d.ts
row "TS7.0 (Go)" "$out/tsc-go-7.0.wasip1.wasm"
row "TS7.0 (TinyGo)" "$out/tsc-7.0.wasip1.wasm"
row "TS7.1 (Go)" "$out/tsc-go.wasip1.wasm"
row "TS7.1 (TinyGo)" "$out/tsc.wasip1.wasm"
row "tsrs" "$out/tsrs.wasm"
row "ts-rust" "$out/ts-rust.wasm"
