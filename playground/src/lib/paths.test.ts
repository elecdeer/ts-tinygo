import { describe, expect, it } from "vitest";
import { toProjectPath, validateFileName } from "./paths";

describe("toProjectPath", () => {
  it("strips the project directory and leading ./", () => {
    expect(toProjectPath("/app/src/a.ts")).toBe("src/a.ts");
    expect(toProjectPath("./main.ts")).toBe("main.ts");
    expect(toProjectPath("src\\b.ts")).toBe("src/b.ts");
  });

  it("leaves paths outside the project untouched", () => {
    expect(toProjectPath("/other/a.ts")).toBe("/other/a.ts");
  });
});

describe("validateFileName", () => {
  it("accepts nested relative paths", () => {
    expect(validateFileName(" src/util.ts ", ["main.ts"])).toBeUndefined();
  });

  it.each(["", "  ", "/abs.ts", "../up.ts", "a//b.ts", "a/"])("rejects %j", (name) => {
    expect(validateFileName(name, [])).toBeTypeOf("string");
  });

  it("rejects duplicates", () => {
    expect(validateFileName("main.ts", ["main.ts"])).toMatch(/already exists/);
  });
});
