import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { buildTree, diffFiles, flattenTree, runTsc } from "./runner";

describe("buildTree / flattenTree", () => {
  it("round-trips nested files", () => {
    const files = { "main.ts": "a", "src/util/x.ts": "b", "./src/y.ts": "c" };
    expect(flattenTree(buildTree(files))).toEqual({ "main.ts": "a", "src/util/x.ts": "b", "src/y.ts": "c" });
  });
});

describe("diffFiles", () => {
  it("returns only new or changed files", () => {
    expect(diffFiles({ a: "1", b: "2" }, { a: "1", b: "3", c: "4" })).toEqual({ b: "3", c: "4" });
  });
});

// Integration test against the real TinyGo build; skipped until `scripts/build.sh wasip1` has run.
const wasmPath = join(import.meta.dirname, "../../../out/tsc.wasip1.wasm");

describe.skipIf(!existsSync(wasmPath))("runTsc (TinyGo wasip1 build)", () => {
  let module: WebAssembly.Module;
  beforeAll(async () => {
    module = await WebAssembly.compile(await readFile(wasmPath));
  }, 60_000);

  const tsconfig = JSON.stringify({ compilerOptions: { strict: true, declaration: true, outDir: "dist" } });

  it("reports type errors with project-relative paths", async () => {
    const result = await runTsc(module, { "tsconfig.json": tsconfig, "main.ts": "const n: number = 'x';\n" }, ["--pretty", "false"]);
    expect(result.exitCode).toBe(2);
    expect(result.stdout).toContain("main.ts(1,7): error TS2322");
  }, 60_000);

  it("emits JavaScript and declarations into the in-memory project", async () => {
    const result = await runTsc(
      module,
      { "tsconfig.json": tsconfig, "util.ts": "export const twice = (n: number) => n * 2;\n" },
      ["--pretty", "false"],
    );
    expect(result.exitCode).toBe(0);
    expect(Object.keys(result.outputs).sort()).toEqual(["dist/util.d.ts", "dist/util.js"]);
    expect(result.outputs["dist/util.d.ts"]).toContain("export declare const twice: (n: number) => number;");
  }, 60_000);
});
