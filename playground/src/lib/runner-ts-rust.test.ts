import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { runTsRust } from "./runner-ts-rust";

// Integration test against the real ts-rust build; skipped until `scripts/build-ts-rust.sh wasm` has run.
const wasmPath = join(import.meta.dirname, "../../../out/ts-rust.wasm");

describe.skipIf(!existsSync(wasmPath))("runTsRust", () => {
  let module: WebAssembly.Module;
  beforeAll(async () => {
    module = await WebAssembly.compile(await readFile(wasmPath));
  }, 60_000);

  const tsconfig = JSON.stringify({ compilerOptions: { strict: true, declaration: true, outDir: "dist" } });

  it("reports type errors with project-relative paths", async () => {
    const result = await runTsRust(module, { "tsconfig.json": tsconfig, "main.ts": "const n: number = 'x';\n" }, ["--pretty", "false"]);
    expect(result.stdout).toContain("main.ts(1,7): error TS2322");
    expect(result.exitCode).toBe(2);
  }, 60_000);

  it("returns emitted files and leaves inputs out", async () => {
    const result = await runTsRust(
      module,
      { "tsconfig.json": tsconfig, "util.ts": "export const twice = (n: number) => n * 2;\n" },
      ["--pretty", "false"],
    );
    expect(Object.keys(result.outputs).sort()).toEqual(["dist/util.d.ts", "dist/util.js"]);
    expect(result.outputs["dist/util.d.ts"]).toContain("export declare const twice: (n: number) => number;");
    expect(result.exitCode).toBe(0);
  }, 60_000);
});
