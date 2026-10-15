// Turns the JSON lines of bench/lsp/all.sh into a Markdown table: the median over runs per server.
// usage: node bench/lsp/summarize.mjs bench/results/lsp-<project>.jsonl
import { readFileSync } from "node:fs";

const rows = readFileSync(process.argv[2], "utf8").trim().split("\n").map((l) => JSON.parse(l));
const servers = [...new Set(rows.map((r) => r.name))];

/** Median of the values that are present; null when a step never answered. */
const median = (xs) => {
  const s = xs.filter((x) => x != null).sort((a, b) => a - b);
  return s.length === 0 ? null : s[Math.floor(s.length / 2)];
};
const fmt = (ms) => (ms == null ? "no answer" : ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`);

console.log("| server | runs | initialize | first diagnostics | diagnostics after an edit | completion | hover |");
console.log("|---|---:|---:|---:|---:|---:|---:|");
for (const name of servers) {
  const rs = rows.filter((r) => r.name === name);
  const cell = (key) => fmt(median(rs.map((r) => r[key])));
  // Every edit of every run, so one slow edit does not hide behind a per-run median.
  const edits = fmt(median(rs.flatMap((r) => r.edit ?? [])));
  console.log(`| ${name} | ${rs.length} | ${cell("initialize")} | ${cell("firstDiagnostics")} | ${edits} | ${cell("completion")} | ${cell("hover")} |`);
}
