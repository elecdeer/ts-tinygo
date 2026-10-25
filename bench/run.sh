#!/usr/bin/env bash
# Compare type-check time of the wasm builds of TypeScript 7.0/7.1 (standard Go and TinyGo),
# tsrs and ts-rust against TypeScript 6 (the JavaScript tsc on Node).
# usage: bench/run.sh <project-dir> <tsconfig> [runs]
# SKIP_TIMING=1 only measures peak memory.
# VARIANTS=1 adds the Rust ports' other optimization levels (tsrs opt-level=z, ts-rust opt-level=s)
#   and the standard Go builds run through wasm-opt -Oz, when they are built.
# ONLY=<regex> keeps the variants whose names match; their results go to bench/results/<project>-<OUT>.*
#   when OUT is set, e.g. ONLY='^TS6|Go' OUT=go-wasm-opt VARIANTS=1
# Prerequisites: pnpm --dir bench/ts6 install, scripts/build-go.sh wasip1, scripts/build.sh wasip1
#   and the TinyGo variants in README.md (-opt=2, initial memory 2GB, -gc=leaking), each also with
#   TS_VERSION=7.0, scripts/build-tsrs.sh wasm, scripts/build-ts-rust.sh wasm
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
project="$(cd "$1" && pwd)"
tsconfig="$2"
runs="${3:-3}"
out="$root/out"
results="$root/bench/results"
name="$(basename "$project")${OUT:+-$OUT}"
mkdir -p "$results"

wasi="node --no-warnings $root/scripts/run-wasi.mjs"
args="-p $tsconfig --noEmit"

cmds=()
names=()
add() { names+=("$1"); cmds+=("$2"); }
# TypeScript 6, the JavaScript tsc. It has no --singleThreaded; it is single-threaded.
add "TS6.0" "node $root/bench/ts6/node_modules/typescript/bin/tsc $args"
for v in 7.0 7.1; do
  s=""
  [ "$v" = 7.0 ] && s="-7.0"
  add "TS$v (Go)" "$wasi $out/tsc-go$s.wasip1.wasm $args --singleThreaded"
  add "TS$v (TinyGo)" "$wasi $out/tsc$s.wasip1.wasm $args --singleThreaded"
  add "TS$v (TinyGo -opt=2)" "$wasi $out/tsc$s-o2.wasip1.wasm $args --singleThreaded"
  add "TS$v (TinyGo, initial memory 2GB)" "$wasi $out/tsc$s-mem2g.wasip1.wasm $args --singleThreaded"
  add "TS$v (TinyGo -gc=leaking)" "$wasi $out/tsc$s-leaking.wasip1.wasm $args --singleThreaded"
done
# The Rust ports' wasm builds are driven by their own JS glue, not WASI's _start.
tsrs="node --no-warnings $root/scripts/run-tsrs.mjs"
tsrust="node --no-warnings $root/scripts/run-ts-rust.mjs"
add "tsrs" "$tsrs $out/tsrs.wasm $args --singleThreaded"
add "ts-rust" "$tsrust $out/ts-rust.wasm $args --singleThreaded"
if [ -n "${VARIANTS:-}" ]; then
  [ -f "$out/tsrs-z.wasm" ] && add "tsrs opt-level=z" "$tsrs $out/tsrs-z.wasm $args --singleThreaded"
  [ -f "$out/ts-rust-s.wasm" ] && add "ts-rust opt-level=s" "$tsrust $out/ts-rust-s.wasm $args --singleThreaded"
  [ -f "$out/tsc-go-7.0-oz.wasip1.wasm" ] && add "TS7.0 (Go, wasm-opt -Oz)" "$wasi $out/tsc-go-7.0-oz.wasip1.wasm $args --singleThreaded"
  [ -f "$out/tsc-go-oz.wasip1.wasm" ] && add "TS7.1 (Go, wasm-opt -Oz)" "$wasi $out/tsc-go-oz.wasip1.wasm $args --singleThreaded"
fi

if [ -n "${ONLY:-}" ]; then
  kept_names=()
  kept_cmds=()
  for i in "${!cmds[@]}"; do
    if [[ "${names[$i]}" =~ $ONLY ]]; then
      kept_names+=("${names[$i]}")
      kept_cmds+=("${cmds[$i]}")
    fi
  done
  names=("${kept_names[@]}")
  cmds=("${kept_cmds[@]}")
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
