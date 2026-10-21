#!/usr/bin/env bash
# Compare type-check time of the wasm builds of TypeScript 7.0/7.1 (standard Go and TinyGo),
# tsrs and ts-rust against TypeScript 6 (the JavaScript tsc on Node).
# usage: bench/run.sh <project-dir> <tsconfig> [runs]
# SKIP_TIMING=1 only measures peak memory.
# VARIANTS=1 adds the other builds from README.md (TinyGo -opt=2, initial memory 2GB, -gc=leaking;
#   tsrs opt-level=z, ts-rust opt-level=s) when they are built.
# Prerequisites: pnpm --dir bench/ts6 install, scripts/build-go.sh wasip1, scripts/build.sh wasip1
#   (and the same with TS_VERSION=7.0), scripts/build-tsrs.sh wasm, scripts/build-ts-rust.sh wasm
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
project="$(cd "$1" && pwd)"
tsconfig="$2"
runs="${3:-3}"
out="$root/out"
results="$root/bench/results"
name="$(basename "$project")"
mkdir -p "$results"

wasi="node --no-warnings $root/scripts/run-wasi.mjs"
args="-p $tsconfig --noEmit"

cmds=()
names=()
add() { names+=("$1"); cmds+=("$2"); }
# TypeScript 6, the JavaScript tsc. It has no --singleThreaded; it is single-threaded.
add "TS6.0" "node $root/bench/ts6/node_modules/typescript/bin/tsc $args"
add "TS7.0 (Go)" "$wasi $out/tsc-go-7.0.wasip1.wasm $args --singleThreaded"
add "TS7.0 (TinyGo)" "$wasi $out/tsc-7.0.wasip1.wasm $args --singleThreaded"
add "TS7.1 (Go)" "$wasi $out/tsc-go.wasip1.wasm $args --singleThreaded"
add "TS7.1 (TinyGo)" "$wasi $out/tsc.wasip1.wasm $args --singleThreaded"
# The Rust ports' wasm builds are driven by their own JS glue, not WASI's _start.
tsrs="node --no-warnings $root/scripts/run-tsrs.mjs"
tsrust="node --no-warnings $root/scripts/run-ts-rust.mjs"
add "tsrs" "$tsrs $out/tsrs.wasm $args --singleThreaded"
add "ts-rust" "$tsrust $out/ts-rust.wasm $args --singleThreaded"
if [ -n "${VARIANTS:-}" ]; then
  [ -f "$out/tsc-o2.wasip1.wasm" ] && add "TS7.1 (TinyGo -opt=2)" "$wasi $out/tsc-o2.wasip1.wasm $args --singleThreaded"
  [ -f "$out/tsc-mem2g.wasip1.wasm" ] && add "TS7.1 (TinyGo, initial memory 2GB)" "$wasi $out/tsc-mem2g.wasip1.wasm $args --singleThreaded"
  [ -f "$out/tsc-leaking.wasip1.wasm" ] && add "TS7.1 (TinyGo -gc=leaking)" "$wasi $out/tsc-leaking.wasip1.wasm $args --singleThreaded"
  [ -f "$out/tsrs-z.wasm" ] && add "tsrs opt-level=z" "$tsrs $out/tsrs-z.wasm $args --singleThreaded"
  [ -f "$out/ts-rust-s.wasm" ] && add "ts-rust opt-level=s" "$tsrust $out/ts-rust-s.wasm $args --singleThreaded"
fi

hf=()
for i in "${!cmds[@]}"; do hf+=(-n "${names[$i]}" "${cmds[$i]}"); done

cd "$project"
if [ -z "${SKIP_TIMING:-}" ]; then
  # tsc exits 1/2 when it finds errors; timing is still meaningful.
  hyperfine --warmup 1 --runs "$runs" -i \
    --export-markdown "$results/$name.md" --export-json "$results/$name.json" \
    "${hf[@]}"
fi

echo
echo "| variant | max RSS |" | tee "$results/$name.rss.md"
echo "|---|---|" | tee -a "$results/$name.rss.md"
for i in "${!cmds[@]}"; do
  # Only time(1)'s report reaches the pipe; the command's own output is discarded inside sh.
  rss=$(/usr/bin/time -l sh -c "${cmds[$i]} >/dev/null 2>&1" 2>&1 | awk '/maximum resident set size/ {printf "%.2f GB", $1/1024/1024/1024}' || true)
  echo "| ${names[$i]} | $rss |" | tee -a "$results/$name.rss.md"
done
