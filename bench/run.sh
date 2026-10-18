#!/usr/bin/env bash
# Compare tsc type-check time across native Go, standard Go wasip1 and TinyGo wasip1.
# usage: bench/run.sh <project-dir> <tsconfig> [runs]
# SKIP_TIMING=1 only measures peak memory.
# Prerequisites: scripts/build-go.sh, scripts/build.sh wasip1,
#   (optional) scripts/build-ts-rust.sh, scripts/build-tsrs.sh, pnpm --dir bench/ts6 install
#   (optional) the TinyGo variants in README.md (-opt=2, initial memory 2GB, -gc=leaking)
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
# TypeScript 6, the JavaScript tsc (bench/ts6: pnpm install). It has no --singleThreaded; it is single-threaded.
ts6="$root/bench/ts6/node_modules/typescript/bin/tsc"
[ -f "$ts6" ] && add "TS6 (JS tsc on Node)" "node $ts6 $args"
add "native (parallel)" "$out/tsc-native $args"
add "native --singleThreaded" "$out/tsc-native $args --singleThreaded"
add "Go wasip1 --singleThreaded" "$wasi $out/tsc-go.wasip1.wasm $args --singleThreaded"
add "TinyGo -opt=z --singleThreaded" "$wasi $out/tsc.wasip1.wasm $args --singleThreaded"
[ -f "$out/tsc-o2.wasip1.wasm" ] && add "TinyGo -opt=2 --singleThreaded" "$wasi $out/tsc-o2.wasip1.wasm $args --singleThreaded"
[ -f "$out/tsc-mem2g.wasip1.wasm" ] && add "TinyGo initial memory 2GB --singleThreaded" "$wasi $out/tsc-mem2g.wasip1.wasm $args --singleThreaded"
[ -f "$out/tsc-leaking.wasip1.wasm" ] && add "TinyGo -gc=leaking --singleThreaded" "$wasi $out/tsc-leaking.wasip1.wasm $args --singleThreaded"
# pingdotgg/ts-rust (scripts/build-ts-rust.sh). Its wasm build is driven by its own JS glue, not WASI's _start.
tsrust="node --no-warnings $root/scripts/run-ts-rust.mjs"
[ -f "$out/ts-rust-native" ] && add "ts-rust native (parallel)" "$out/ts-rust-native $args"
[ -f "$out/ts-rust-native" ] && add "ts-rust native --singleThreaded" "$out/ts-rust-native $args --singleThreaded"
[ -f "$out/ts-rust.wasm" ] && add "ts-rust wasm opt-level=z" "$tsrust $out/ts-rust.wasm $args --singleThreaded"
[ -f "$out/ts-rust-s.wasm" ] && add "ts-rust wasm opt-level=s" "$tsrust $out/ts-rust-s.wasm $args --singleThreaded"
# oxc-project/tsrs (scripts/build-tsrs.sh). Its wasm build is driven by its own JS glue too.
tsrs="node --no-warnings $root/scripts/run-tsrs.mjs"
[ -f "$out/tsrs-native" ] && add "tsrs native (parallel)" "$out/tsrs-native $args"
[ -f "$out/tsrs-native" ] && add "tsrs native --singleThreaded" "$out/tsrs-native $args --singleThreaded"
[ -f "$out/tsrs-z.wasm" ] && add "tsrs wasm opt-level=z" "$tsrs $out/tsrs-z.wasm $args --singleThreaded"
[ -f "$out/tsrs.wasm" ] && add "tsrs wasm opt-level=s" "$tsrs $out/tsrs.wasm $args --singleThreaded"

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
