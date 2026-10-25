// Summarize a CPU profile of a wasm build (node --cpu-prof) by kind of work and by function.
// usage: node bench/cpu-profile.mjs <file.cpuprofile> [--top <n>]
// Times are self times: a function's samples count for it, not for its callers.
// Function names are the wasm name section's, as V8 reports them; the standard Go toolchain
// writes "/" and "-" in them as "_".
import { readFileSync } from "node:fs";
import process from "node:process";

/**
 * Kinds of work, tried in order; the first whose pattern matches a function's name wins.
 * The patterns cover the standard Go runtime (Go 1.27) and TinyGo 0.43's.
 */
export const categories = [
  {
    name: "GC (marking, sweeping, write barriers)",
    pattern: new RegExp(
      [
        // Standard Go
        String.raw`^runtime\.(tryDeferToSpanScan|wbBuf|findObject|typePointers|bulkBarrier|gcmarknewobject|scanObject|scanobject|scanblock|greyobject|gcDrain|markroot|markBits|sweep|bgsweep|gcAssist|deductAssistCredit|shade|scanstack|scanframe|gcStart|gcMark|gcBgMarkWorker|gcFlush|spanOf)`,
        String.raw`^runtime\.__(sweepLocked|gcWork|markBits|gcBits|gcControllerState)_`,
        String.raw`^runtime\.__mspan_\.(typePointersOfType|sweep)`,
        String.raw`^(runtime\.)?gcWriteBarrier`,
        // TinyGo
        String.raw`^\(runtime\.gcBlock\)\.`,
        String.raw`^runtime\.(markRoot|markRoots|markStack|markGlobals|scanWithMask|scanConservative|runGC|startMark|finishMark|insertFreeRange|buildFreeRanges)`,
      ].join("|"),
    ),
  },
  {
    name: "allocation",
    pattern: new RegExp(
      [
        String.raw`^runtime\.(malloc|growMemory|sysAlloc|sysMap|nextFree|newobject|newarray|makeslice|growslice|makemap|heapSetType|rawstring|rawbyteslice)`,
        String.raw`^runtime\.__(mcache|mcentral|mheap)_`,
        String.raw`^runtime\.__mspan_\.(initHeapBits|writeHeapBits|refillAllocCache|nextFreeIndex)`,
        String.raw`^runtime\.(alloc|growHeap|sliceAppend|sliceGrow)$`,
      ].join("|"),
    ),
  },
  {
    name: "maps and hashing",
    pattern: new RegExp(
      [
        String.raw`^runtime\.(map|memhash|strhash|aeshash|nilinterhash|interhash|f32hash|f64hash|c64hash|c128hash)`,
        String.raw`^internal_runtime_maps\.`,
        String.raw`^runtime\.(hashmap|hash32|hash64)`,
      ].join("|"),
    ),
  },
  { name: "the compiler (TypeScript's packages)", pattern: /microsoft/ },
  { name: "calls into JavaScript (WASI)", pattern: /^\[js\] (?!\((program|idle|garbage collector)\))/ },
];

/**
 * Returns the name used to classify a profile node: the wasm function's name, or the
 * JavaScript function's name prefixed with "[js] ".
 * @param {{functionName: string, url: string}} callFrame
 */
export function frameName({ functionName, url }) {
  return url.startsWith("wasm://") ? functionName : `[js] ${functionName}`;
}

/**
 * Returns the name of the category a function belongs to, or "other".
 * @param {string} name
 */
export function categoryOf(name) {
  return categories.find((c) => c.pattern.test(name))?.name ?? "other";
}

/**
 * Sums the self time of every sample by function name.
 * @param {{nodes: {id: number, callFrame: {functionName: string, url: string}}[], samples: number[], timeDeltas: number[]}} profile
 * @returns {{total: number, functions: Map<string, number>}} times in microseconds
 */
export function selfTimes(profile) {
  const names = new Map(profile.nodes.map((n) => [n.id, frameName(n.callFrame)]));
  const functions = new Map();
  let total = 0;
  profile.samples.forEach((id, i) => {
    const t = profile.timeDeltas[i] ?? 0;
    const name = names.get(id);
    functions.set(name, (functions.get(name) ?? 0) + t);
    total += t;
  });
  return { total, functions };
}

/**
 * Sums self times by category, in the order of `categories`, with "other" last.
 * @param {Map<string, number>} functions
 */
export function byCategory(functions) {
  const sums = new Map([...categories.map((c) => [c.name, 0]), ["other", 0]]);
  for (const [name, t] of functions) {
    const c = categoryOf(name);
    sums.set(c, sums.get(c) + t);
  }
  return sums;
}

/** Prints the summary of one profile as Markdown. */
function main(argv) {
  const file = argv[0];
  if (!file) {
    console.error("usage: node bench/cpu-profile.mjs <file.cpuprofile> [--top <n>]");
    process.exit(2);
  }
  const top = argv[1] === "--top" ? Number(argv[2]) : 15;
  const { total, functions } = selfTimes(JSON.parse(readFileSync(file, "utf8")));
  const pct = (t) => `${((t / total) * 100).toFixed(1)}%`;

  console.log(`total ${(total / 1e6).toFixed(1)} s\n`);
  console.log("| kind of work | self time |\n|---|---:|");
  for (const [name, t] of byCategory(functions)) console.log(`| ${name} | ${pct(t)} |`);
  console.log(`\n| function | kind | self time |\n|---|---|---:|`);
  for (const [name, t] of [...functions].sort((a, b) => b[1] - a[1]).slice(0, top)) {
    console.log(`| \`${name}\` | ${categoryOf(name)} | ${pct(t)} |`);
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main(process.argv.slice(2));
}
