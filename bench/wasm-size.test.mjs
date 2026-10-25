// usage: node --test bench/wasm-size.test.mjs
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  displayPackage,
  embeddedBytes,
  goRegions,
  linearMemory,
  overlap,
  packageOf,
  parseWasm,
  programBytes,
  storedBytes,
} from "./wasm-size.mjs";

/** Encodes an unsigned LEB128 integer. */
function uleb(n) {
  const out = [];
  do {
    let b = n & 0x7f;
    n >>>= 7;
    if (n) b |= 0x80;
    out.push(b);
  } while (n);
  return out;
}

/** Encodes a length-prefixed name. */
function name(s) {
  const b = [...Buffer.from(s)];
  return [...uleb(b.length), ...b];
}

/** Encodes a section with its id and contents. */
function section(id, contents) {
  return [id, ...uleb(contents.length), ...contents];
}

/**
 * A module with one imported function, two defined functions (bodies of 2 and 4 bytes),
 * a name section naming all three and two active data segments.
 */
function sampleModule() {
  const header = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];
  const type = section(1, [1, 0x60, 0, 0]);
  const imports = section(2, [1, ...name("env"), ...name("f"), 0x00, 0]);
  const funcs = section(3, [2, 0, 0]);
  const memory = section(5, [1, 0, 1]);
  const code = section(10, [2, 2, 0, 0x0b, 4, 0, 0x01, 0x01, 0x0b]);
  const data = section(11, [
    2,
    0, 0x41, ...uleb(16), 0x0b, 3, 1, 2, 3,
    0, 0x41, ...uleb(32), 0x0b, 2, 4, 5,
  ]);
  const nameMap = [3, 0, ...name("imported"), 1, ...name("pkg.a"), 2, ...name("pkg.b")];
  const names = section(0, [...name("name"), 1, ...uleb(nameMap.length), ...nameMap]);
  return Uint8Array.from([...header, ...type, ...imports, ...funcs, ...memory, ...code, ...data, ...names]);
}

describe("parseWasm", () => {
  it("names defined functions past the imported ones and keeps their body sizes", () => {
    const { functions } = parseWasm(sampleModule());
    assert.deepEqual(functions, [
      { name: "pkg.a", size: 2 },
      { name: "pkg.b", size: 4 },
    ]);
  });

  it("lists every section with its size", () => {
    const { sections } = parseWasm(sampleModule());
    assert.deepEqual(
      sections.map((s) => [s.name, s.size]),
      [["type", 4], ["import", 9], ["function", 3], ["memory", 3], ["code", 9], ["data", 16], ['custom "name"', 32]],
    );
  });

  it("returns active data segments with their memory offsets", () => {
    const { segments } = parseWasm(sampleModule());
    assert.deepEqual(
      segments.map((s) => [s.offset, [...s.bytes]]),
      [[16, [1, 2, 3]], [32, [4, 5]]],
    );
  });
});

describe("packageOf", () => {
  it("reads the package of the standard Go toolchain's names, which write / as _", () => {
    assert.equal(
      packageOf("github.com_microsoft_TypeScript_tsc_internal_checker.__Checker_.checkSourceFile", "go"),
      "github.com/microsoft/TypeScript/tsc/internal/checker",
    );
    assert.equal(packageOf("encoding_json_v2.Marshal", "go"), "encoding/json/v2");
    assert.equal(packageOf("runtime.gcenable", "go"), "runtime");
    assert.equal(packageOf("type_.eq.SM10", "go"), "(type equality and hash functions)");
  });

  it("reads the package of TinyGo's names, including methods, closures and generics", () => {
    assert.equal(
      packageOf("(*github.com/microsoft/TypeScript/tsc/internal/checker.LiteralType).String", "tinygo"),
      "github.com/microsoft/TypeScript/tsc/internal/checker",
    );
    assert.equal(packageOf("internal/reflectlite.Swapper$1", "tinygo"), "internal/reflectlite");
    assert.equal(packageOf("slices.Sort[github.com/a/b.T]", "tinygo"), "slices");
    assert.equal(packageOf("interface:{Error:func:{}{basic:string}}.Error$invoke", "tinygo"), "(interface method calls)");
    assert.equal(packageOf("malloc", "tinygo"), "(C, wasi-libc and linker stubs)");
  });
});

describe("displayPackage", () => {
  it("shortens the compiler's packages in both 7.0's and 7.1's module", () => {
    assert.equal(displayPackage("github.com/microsoft/TypeScript/tsc/internal/checker"), "internal/checker");
    assert.equal(displayPackage("github.com/microsoft/typescript-go/internal/ls"), "internal/ls");
    assert.equal(displayPackage("encoding/json/v2"), "encoding/json/v2");
  });
});

describe("linearMemory and storedBytes", () => {
  it("lays segments out at their offsets and counts only the bytes stored in them", () => {
    const segments = [
      { offset: 2, bytes: Uint8Array.from([1, 2]) },
      { offset: 6, bytes: Uint8Array.from([3]) },
    ];
    assert.deepEqual([...linearMemory(segments)], [0, 0, 1, 2, 0, 0, 3]);
    assert.equal(storedBytes(segments, [0, 7]), 3);
    assert.equal(storedBytes(segments, [3, 6]), 1);
  });
});

describe("goRegions", () => {
  it("reads the region bounds from the moduledata that points at the pcHeader", () => {
    const mem = Buffer.alloc(1024);
    const header = 64;
    mem.set([0xf1, 0xff, 0xff, 0xff, 0, 0, 1, 8], header);
    const md = 512;
    const words = new Map([
      [0, header],
      [1, 72], [2, 10], // funcnametab
      [4, 82], [5, 2], // cutab, as []uint32
      [7, 90], [8, 5], // filetab
      [10, 95], [11, 5], // pctab
      [13, 100], [14, 20], // pclntable
      [24, 300], [25, 310], // noptrdata
      [26, 320], [27, 330], // data
      [37, 200], [39, 260], // types
      [42, 16], [43, 120], [44, 150], // rodata, gofunc, epclntab
    ]);
    for (const [i, v] of words) mem.writeBigUInt64LE(BigInt(v), md + i * 8);
    assert.deepEqual(goRegions(mem), {
      rodata: [16, 64],
      pclntab: [64, 150],
      funcnametab: [72, 82],
      cutab: [82, 90],
      filetab: [90, 95],
      pctab: [95, 100],
      pclntable: [100, 120],
      gofunc: [120, 150],
      types: [200, 260],
      noptrdata: [300, 310],
      data: [320, 330],
    });
  });

  it("returns undefined without a pcHeader", () => {
    assert.equal(goRegions(Buffer.alloc(64)), undefined);
  });
});

describe("embeddedBytes and overlap", () => {
  it("finds embedded files and reports the missing ones", () => {
    const mem = Buffer.from("xxhelloxxworldxx");
    const result = embeddedBytes(mem, [
      { name: "a", bytes: Buffer.from("hello") },
      { name: "b", bytes: Buffer.from("world") },
      { name: "c", bytes: Buffer.from("absent") },
    ]);
    assert.deepEqual(result, { found: 10, ranges: [[2, 7], [9, 14]], missing: ["c"] });
    assert.equal(overlap(result.ranges, [0, 10]), 6);
  });
});

describe("programBytes", () => {
  it("drops custom sections and zeroes the given memory ranges in the data segments", () => {
    const module = sampleModule();
    const parsed = parseWasm(module);
    const program = programBytes(module, parsed, [[17, 18], [33, 40]]);
    const reparsed = parseWasm(program);
    assert.deepEqual(reparsed.sections.map((s) => s.name), ["type", "import", "function", "memory", "code", "data"]);
    assert.deepEqual(
      reparsed.segments.map((s) => [s.offset, [...s.bytes]]),
      [[16, [1, 0, 3]], [32, [4, 0]]],
    );
  });

  it("leaves the module it was given unchanged", () => {
    const module = sampleModule();
    const before = [...module];
    programBytes(module, parseWasm(module), [[16, 40]]);
    assert.deepEqual([...module], before);
  });
});
