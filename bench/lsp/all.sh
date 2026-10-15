#!/usr/bin/env bash
# Runs bench/lsp/run.mjs against every language server, one at a time.
# usage: bench/lsp/all.sh <project-dir> <file> [runs]
# Prerequisites: the builds in README.md, pnpm --dir bench/ts6 install
set -uo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
project="$1"
file="$2"
runs="${3:-3}"
out="$root/out"
results="$root/bench/results/lsp-$(basename "$project").jsonl"
wasi="node --no-warnings $root/scripts/run-wasi.mjs"
: > "$results"

# name | run.mjs options | server command
servers=(
  "TS6 (tsserver)|--protocol=tsserver|node $root/bench/ts6/node_modules/typescript/lib/tsserver.js --disableAutomaticTypingAcquisition"
  "TS6 (typescript-language-server)||$root/bench/ts6/node_modules/.bin/typescript-language-server --stdio"
  "tsc native||$out/tsc-native --lsp --stdio"
  "ts-rust native||$out/ts-rust-native --lsp --stdio"
  # Completion never answers on TinyGo (see README), so do not wait the default 3 minutes for it.
  "tsc TinyGo wasm|--timeout=60000|$wasi $out/tsc.wasip1.wasm --lsp --stdio"
  "tsc TinyGo wasm, 2GB initial memory|--timeout=60000|$wasi $out/tsc-mem2g.wasip1.wasm --lsp --stdio"
  # Hangs after initialize; one run shows it.
  "tsc Go wasm|--timeout=30000 --runs=1|$wasi $out/tsc-go.wasip1.wasm --lsp --stdio"
)

for entry in "${servers[@]}"; do
  IFS='|' read -r name opts cmd <<< "$entry"
  n="$runs"
  [[ "$opts" == *--runs=1* ]] && n=1
  opts="${opts//--runs=1/}"
  for ((i = 1; i <= n; i++)); do
    # shellcheck disable=SC2086 # opts and cmd are word lists
    line=$(node "$root/bench/lsp/run.mjs" $opts "$project" "$file" -- $cmd)
    node -e 'const [n, i, l] = process.argv.slice(1); console.log(JSON.stringify({ name: n, run: Number(i), ...JSON.parse(l) }))' \
      "$name" "$i" "$line" >> "$results"
    echo "$name #$i done"
  done
done
