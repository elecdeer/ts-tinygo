#!/usr/bin/env bash
# Compare tsc type-check time across native Go, standard Go wasip1 and TinyGo wasip1.
# usage: bench/run.sh <project-dir> <tsconfig> [runs]
# SKIP_TIMING=1 only measures peak memory.
# Prerequisites: scripts/build-go.sh, scripts/build.sh wasip1
#   (optional) SUFFIX=-o2 TINYGO_FLAGS="-no-debug -opt=2" scripts/build.sh wasip1
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
add "native (parallel)" "$out/tsc-native $args"
add "native --singleThreaded" "$out/tsc-native $args --singleThreaded"
add "Go wasip1 --singleThreaded" "$wasi $out/tsc-go.wasip1.wasm $args --singleThreaded"
add "TinyGo -opt=z --singleThreaded" "$wasi $out/tsc.wasip1.wasm $args --singleThreaded"
[ -f "$out/tsc-o2.wasip1.wasm" ] && add "TinyGo -opt=2 --singleThreaded" "$wasi $out/tsc-o2.wasip1.wasm $args --singleThreaded"

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
