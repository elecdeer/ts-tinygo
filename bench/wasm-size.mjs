// Break a tsc wasm build's size down by section, by package (code) and by kind of data.
// usage: node bench/wasm-size.mjs <module.wasm> [--embed <file> ...]
// --embed names files that the build embeds (lib.*.d.ts, the localized messages); each one found
// verbatim in the data is counted under "embedded files".
// Function names come from the name section; the Go toolchain writes "/" in them as "_".
// For the standard Go toolchain, the data is split into regions by its runtime.moduledata.
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { gzipSync } from "node:zlib";
import process from "node:process";

const sectionNames = [
  "custom", "type", "import", "function", "table", "memory", "global",
  "export", "start", "element", "code", "data", "datacount",
];

/**
 * A cursor over a wasm module's bytes that decodes LEB128 integers.
 */
class Reader {
  /** @param {Uint8Array} bytes */
  constructor(bytes, pos = 0) {
    this.bytes = bytes;
    this.pos = pos;
  }

  /** Reads an unsigned LEB128 integer. Numbers beyond 2^53 are not expected in a module. */
  u32() {
    let result = 0;
    let shift = 0;
    let byte;
    do {
      byte = this.bytes[this.pos++];
      result += (byte & 0x7f) * 2 ** shift;
      shift += 7;
    } while (byte & 0x80);
    return result;
  }

  /** Reads a signed LEB128 integer of at most 32 bits. */
  s32() {
    let result = 0;
    let shift = 0;
    let byte;
    do {
      byte = this.bytes[this.pos++];
      result |= (byte & 0x7f) << shift;
      shift += 7;
    } while (byte & 0x80);
    if (shift < 32 && byte & 0x40) result |= -1 << shift;
    return result;
  }

  /** Reads a length-prefixed UTF-8 name. */
  name() {
    const len = this.u32();
    const s = new TextDecoder().decode(this.bytes.subarray(this.pos, this.pos + len));
    this.pos += len;
    return s;
  }
}

/**
 * Parses what the size breakdown needs from a wasm module: each section's size and contents, the
 * size of each defined function's body with its name, and the data segments.
 * @param {Uint8Array} bytes
 */
export function parseWasm(bytes) {
  const r = new Reader(bytes, 8);
  const sections = [];
  const bodySizes = [];
  const segments = [];
  const names = new Map();
  let importedFuncs = 0;
  while (r.pos < bytes.length) {
    const id = bytes[r.pos++];
    const size = r.u32();
    const end = r.pos + size;
    let name = sectionNames[id] ?? `unknown(${id})`;
    if (id === 0) name = `custom "${new Reader(bytes, r.pos).name()}"`;
    sections.push({ name, size, bytes: bytes.subarray(r.pos, end) });
    if (id === 2) {
      for (let i = 0, n = r.u32(); i < n; i++) {
        r.name();
        r.name();
        const kind = bytes[r.pos++];
        if (kind === 0) {
          importedFuncs++;
          r.u32();
        } else if (kind === 1) {
          r.pos++;
          skipLimits(r);
        } else if (kind === 2) {
          skipLimits(r);
        } else {
          r.pos += 2;
        }
      }
    } else if (id === 10) {
      for (let i = 0, n = r.u32(); i < n; i++) {
        const len = r.u32();
        bodySizes.push(len);
        r.pos += len;
      }
    } else if (id === 11) {
      for (let i = 0, n = r.u32(); i < n; i++) {
        const flags = r.u32();
        if (flags === 1) {
          // Passive segments are copied at run time; they still count as data.
          const len = r.u32();
          segments.push({ offset: -1, bytes: bytes.subarray(r.pos, r.pos + len) });
          r.pos += len;
          continue;
        }
        if (flags === 2) r.u32();
        if (bytes[r.pos++] !== 0x41) throw new Error("data segment offset is not an i32.const");
        const offset = r.s32();
        if (bytes[r.pos++] !== 0x0b) throw new Error("data segment offset is not a constant");
        const len = r.u32();
        segments.push({ offset, bytes: bytes.subarray(r.pos, r.pos + len) });
        r.pos += len;
      }
    } else if (id === 0 && name === 'custom "name"') {
      r.name();
      while (r.pos < end) {
        const sub = bytes[r.pos++];
        const subEnd = r.u32() + r.pos;
        if (sub === 1) {
          for (let i = 0, n = r.u32(); i < n; i++) {
            const index = r.u32();
            names.set(index, r.name());
          }
        }
        r.pos = subEnd;
      }
    }
    r.pos = end;
  }
  const functions = bodySizes.map((size, i) => ({
    name: names.get(importedFuncs + i) ?? `(func ${importedFuncs + i})`,
    size,
  }));
  return { sections, functions, segments };
}

/** Skips a table or memory's limits. */
function skipLimits(r) {
  const flags = r.u32();
  r.u32();
  if (flags & 1) r.u32();
}

/**
 * Returns the import path of the package a function belongs to, or a parenthesized label for
 * code that belongs to none (C, generated helpers).
 * @param {string} name a function name from the name section
 * @param {"go" | "tinygo"} toolchain the standard Go toolchain writes "/" as "_" in names
 */
export function packageOf(name, toolchain) {
  if (toolchain === "go") {
    // e.g. github.com_microsoft_TypeScript_tsc_internal_checker.__Checker_.checkSourceFile
    if (name.startsWith("type_.")) return "(type equality and hash functions)";
    if (name.startsWith("go_")) return "(go: generated)";
    const domain = /^[a-z0-9-]+\.[a-z0-9.-]+_/.exec(name);
    const start = domain ? domain[0].length : 0;
    const dot = name.indexOf(".", start);
    if (dot === -1) return "(other)";
    return name.slice(0, dot).replaceAll("_", "/");
  }
  // e.g. (*github.com/microsoft/TypeScript/tsc/internal/checker.LiteralType).String
  if (name.startsWith("interface:")) return "(interface method calls)";
  const s = name.replace(/^\(\*?/, "");
  const cut = s.search(/[[({$]/);
  const head = cut === -1 ? s : s.slice(0, cut);
  const dot = head.indexOf(".", head.lastIndexOf("/") + 1);
  if (dot === -1) return "(C, wasi-libc and linker stubs)";
  return head.slice(0, dot);
}

/**
 * Groups packages for the summary: the compiler's own packages by their path inside the module,
 * everything else as is.
 * @param {string} pkg
 */
export function displayPackage(pkg) {
  const m = /^github\.com\/microsoft\/(?:TypeScript\/tsc|typescript-go)\/(.+)$/.exec(pkg);
  return m ? m[1] : pkg;
}

/**
 * Lays the active data segments out in linear memory, zero-filling the gaps between them.
 * @param {{offset: number, bytes: Uint8Array}[]} segments
 */
export function linearMemory(segments) {
  const active = segments.filter((s) => s.offset >= 0);
  const top = Math.max(0, ...active.map((s) => s.offset + s.bytes.length));
  const mem = Buffer.alloc(top);
  for (const s of active) mem.set(s.bytes, s.offset);
  return mem;
}

/**
 * Finds the standard Go toolchain's runtime.moduledata in linear memory and returns the address
 * ranges of the read-only data, the pclntab and its parts, the type descriptors and the data.
 * Returns undefined if the module was not built by the standard Go toolchain.
 * @param {Buffer} mem
 */
export function goRegions(mem) {
  // pcHeader: Go 1.20+ magic, two zero pads, minLC 1 and ptrSize 8 on wasm.
  const header = mem.indexOf(Buffer.from([0xf1, 0xff, 0xff, 0xff, 0, 0, 1, 8]));
  if (header === -1) return undefined;
  const ptr = Buffer.alloc(8);
  ptr.writeBigUInt64LE(BigInt(header));
  let md = mem.indexOf(ptr);
  while (md !== -1 && md % 8 !== 0) md = mem.indexOf(ptr, md + 1);
  if (md === -1) return undefined;
  // Word offsets in runtime.moduledata (src/runtime/symtab.go, Go 1.27).
  const w = (i) => Number(mem.readBigUInt64LE(md + i * 8));
  const slice = (i) => [w(i), w(i) + w(i + 1)];
  return {
    rodata: [w(42), header],
    pclntab: [header, w(44)],
    funcnametab: slice(1),
    cutab: [w(4), w(4) + w(5) * 4],
    filetab: slice(7),
    pctab: slice(10),
    pclntable: slice(13),
    gofunc: [w(43), w(44)],
    types: [w(37), w(39)],
    noptrdata: [w(24), w(25)],
    data: [w(26), w(27)],
  };
}

/**
 * Counts how many bytes of linear memory in [start, end) are stored in the module: the linker
 * leaves runs of zeros out of the data segments.
 * @param {{offset: number, bytes: Uint8Array}[]} segments
 * @param {[number, number]} range
 */
export function storedBytes(segments, [start, end]) {
  let total = 0;
  for (const s of segments) {
    if (s.offset < 0) continue;
    const lo = Math.max(start, s.offset);
    const hi = Math.min(end, s.offset + s.bytes.length);
    if (hi > lo) total += hi - lo;
  }
  return total;
}

/**
 * Finds the given files verbatim in linear memory and returns their total size, where they are
 * and the names of those not found.
 * @param {Buffer} mem
 * @param {{name: string, bytes: Buffer}[]} files
 */
export function embeddedBytes(mem, files) {
  let found = 0;
  const ranges = [];
  const missing = [];
  for (const f of files) {
    const at = mem.indexOf(f.bytes);
    if (at === -1) {
      missing.push(f.name);
      continue;
    }
    found += f.bytes.length;
    ranges.push([at, at + f.bytes.length]);
  }
  return { found, ranges, missing };
}

/**
 * Counts the bytes of [start, end) that fall in any of the given ranges, which must not overlap.
 * @param {[number, number][]} ranges
 * @param {[number, number]} range
 */
export function overlap(ranges, [start, end]) {
  return ranges.reduce((a, [lo, hi]) => a + Math.max(0, Math.min(end, hi) - Math.max(start, lo)), 0);
}

/** Formats a byte count in MB (10^6 bytes), like bench/sizes.sh. */
function mb(bytes) {
  return `${(bytes / 1e6).toFixed(2)} MB`;
}

/** Prints the breakdown of one module as Markdown. */
function main(argv) {
  const [file, ...rest] = argv;
  if (!file) {
    console.error("usage: node bench/wasm-size.mjs <module.wasm> [--embed <file> ...]");
    process.exit(2);
  }
  const embedFiles = [];
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--embed") continue;
    embedFiles.push({ name: basename(rest[i]), bytes: readFileSync(rest[i]) });
  }
  const bytes = readFileSync(file);
  const { sections, functions, segments } = parseWasm(bytes);
  const mem = linearMemory(segments);
  const regions = goRegions(mem);
  const toolchain = regions ? "go" : "tinygo";

  console.log(`## ${basename(file)} (${mb(bytes.length)}, ${toolchain})\n`);
  // Each section compressed on its own: a rough guide, since gzip of the whole module shares
  // its window across section boundaries.
  const gz = (b) => gzipSync(b, { level: 9 }).length;
  console.log("| section | size | gzip -9 |\n|---|---:|---:|");
  for (const s of [...sections].sort((a, b) => b.size - a.size)) {
    if (s.size >= 1e4) console.log(`| ${s.name} | ${mb(s.size)} | ${mb(gz(s.bytes))} |`);
  }
  const small = sections.filter((s) => s.size < 1e4);
  const smallSize = small.reduce((a, s) => a + s.size, 0);
  console.log(`| (others) | ${mb(smallSize)} | ${mb(gz(Buffer.concat(small.map((s) => s.bytes))))} |\n`);

  const byPkg = new Map();
  for (const f of functions) {
    const pkg = displayPackage(packageOf(f.name, toolchain));
    byPkg.set(pkg, (byPkg.get(pkg) ?? 0) + f.size);
  }
  const code = functions.reduce((a, f) => a + f.size, 0);
  console.log(`| package (code, ${functions.length} functions) | size | share |\n|---|---:|---:|`);
  const sorted = [...byPkg].sort((a, b) => b[1] - a[1]);
  for (const [pkg, size] of sorted.slice(0, 25)) {
    console.log(`| ${pkg} | ${mb(size)} | ${((size / code) * 100).toFixed(1)}% |`);
  }
  const otherCode = sorted.slice(25).reduce((a, [, s]) => a + s, 0);
  console.log(`| (${sorted.length - 25} others) | ${mb(otherCode)} | ${((otherCode / code) * 100).toFixed(1)}% |\n`);

  const stored = segments.reduce((a, s) => a + s.bytes.length, 0);
  console.log(`| data (${segments.length} segments) | size |\n|---|---:|`);
  console.log(`| bytes in segments | ${mb(stored)} |`);
  const embedded = embeddedBytes(mem, embedFiles);
  if (embedFiles.length) {
    const n = embedFiles.length - embedded.missing.length;
    console.log(`| embedded files (${n}/${embedFiles.length} found) | ${mb(embedded.found)} |`);
  }
  if (regions) {
    for (const [name, range] of Object.entries(regions)) {
      console.log(`| ${name} | ${mb(storedBytes(segments, range))} |`);
    }
    console.log(`| rodata: embedded files | ${mb(overlap(embedded.ranges, regions.rodata))} |`);
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main(process.argv.slice(2));
}
