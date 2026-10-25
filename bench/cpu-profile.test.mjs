// usage: node --test bench/cpu-profile.test.mjs
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { byCategory, categoryOf, frameName, selfTimes } from "./cpu-profile.mjs";

describe("categoryOf", () => {
  it("sorts the standard Go runtime's functions", () => {
    assert.equal(categoryOf("runtime.tryDeferToSpanScan"), "GC (marking, sweeping, write barriers)");
    assert.equal(categoryOf("runtime.wbBufFlush1"), "GC (marking, sweeping, write barriers)");
    assert.equal(categoryOf("gcWriteBarrier"), "GC (marking, sweeping, write barriers)");
    assert.equal(categoryOf("runtime.mallocgcSmallScanSlowPath"), "allocation");
    assert.equal(categoryOf("runtime.growMemory"), "allocation");
    assert.equal(categoryOf("runtime.mapaccess2_fast64"), "maps and hashing");
    assert.equal(categoryOf("internal_runtime_maps.__Map_.getWithoutKeySmallFastStr"), "maps and hashing");
  });

  it("sorts TinyGo's runtime functions", () => {
    assert.equal(categoryOf("(runtime.gcBlock).findHead"), "GC (marking, sweeping, write barriers)");
    assert.equal(categoryOf("runtime.insertFreeRange"), "GC (marking, sweeping, write barriers)");
    assert.equal(categoryOf("runtime.alloc"), "allocation");
    assert.equal(categoryOf("runtime.hashmapGet"), "maps and hashing");
  });

  it("sorts the compiler's functions in either toolchain's naming", () => {
    assert.equal(
      categoryOf("github.com_microsoft_typescript_go_internal_checker.__Checker_.getApparentType"),
      "the compiler (TypeScript's packages)",
    );
    assert.equal(
      categoryOf("(*github.com/microsoft/TypeScript/tsc/internal/checker.Checker).getApparentType"),
      "the compiler (TypeScript's packages)",
    );
  });

  it("counts JavaScript frames as calls into JavaScript, except V8's own pseudo frames", () => {
    assert.equal(categoryOf("[js] wasm-to-js"), "calls into JavaScript (WASI)");
    assert.equal(categoryOf("[js] (idle)"), "other");
    assert.equal(categoryOf("strings.Count"), "other");
  });
});

describe("frameName", () => {
  it("prefixes JavaScript functions, keeping wasm functions' names", () => {
    assert.equal(frameName({ functionName: "runtime.alloc", url: "wasm://wasm/0abc" }), "runtime.alloc");
    assert.equal(frameName({ functionName: "wasm-to-js", url: "" }), "[js] wasm-to-js");
  });
});

describe("selfTimes and byCategory", () => {
  it("sums each sample's time delta for the function it hit", () => {
    const wasm = (id, functionName) => ({ id, callFrame: { functionName, url: "wasm://wasm/0abc" } });
    const profile = {
      nodes: [wasm(1, "runtime.alloc"), wasm(2, "runtime.hashmapGet"), wasm(3, "runtime.alloc")],
      samples: [1, 2, 3, 2],
      timeDeltas: [10, 20, 30, 40],
    };
    const { total, functions } = selfTimes(profile);
    assert.equal(total, 100);
    assert.deepEqual([...functions], [["runtime.alloc", 40], ["runtime.hashmapGet", 60]]);
    const sums = byCategory(functions);
    assert.equal(sums.get("allocation"), 40);
    assert.equal(sums.get("maps and hashing"), 60);
    assert.equal(sums.get("other"), 0);
  });
});
