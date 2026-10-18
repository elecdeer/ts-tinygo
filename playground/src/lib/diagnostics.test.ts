import { describe, expect, it } from "vitest";
import { parseDiagnostics } from "./diagnostics";

describe("parseDiagnostics", () => {
  it("parses --pretty false diagnostics", () => {
    const output = [
      "main.ts(7,21): error TS2322: Type 'string' is not assignable to type 'number'.",
      "src/a.ts(1,1): warning TS6133: 'x' is declared but its value is never read.",
    ].join("\n");

    expect(parseDiagnostics(output)).toEqual([
      { file: "main.ts", line: 7, column: 21, category: "error", code: 2322, message: "Type 'string' is not assignable to type 'number'." },
      { file: "src/a.ts", line: 1, column: 1, category: "warning", code: 6133, message: "'x' is declared but its value is never read." },
    ]);
  });

  it("appends indented continuation lines to the previous message", () => {
    const output = [
      "main.ts(3,7): error TS2322: Type '{ a: string; }' is not assignable to type 'T'.",
      "  Types of property 'a' are incompatible.",
      "    Type 'string' is not assignable to type 'number'.",
    ].join("\n");

    expect(parseDiagnostics(output)[0]?.message).toBe(
      "Type '{ a: string; }' is not assignable to type 'T'.\nTypes of property 'a' are incompatible.\nType 'string' is not assignable to type 'number'.",
    );
  });

  it("ignores global diagnostics and summary lines", () => {
    const output = "error TS5083: Cannot read file '/app/tsconfig.json'.\n\nFound 1 error.";
    expect(parseDiagnostics(output)).toEqual([]);
  });

  it("supports file names containing parentheses", () => {
    expect(parseDiagnostics("a(1).ts(2,3): error TS1005: ';' expected.")[0]).toMatchObject({ file: "a(1).ts", line: 2, column: 3 });
  });
});
