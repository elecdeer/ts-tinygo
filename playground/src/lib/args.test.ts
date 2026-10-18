import { describe, expect, it } from "vitest";
import { tokenizeArgs } from "./args";

describe("tokenizeArgs", () => {
  it("splits on whitespace", () => {
    expect(tokenizeArgs("  --noEmit   --target es2017 ")).toEqual(["--noEmit", "--target", "es2017"]);
  });

  it("returns no arguments for blank input", () => {
    expect(tokenizeArgs("   ")).toEqual([]);
  });

  it("keeps quoted spaces and empty quoted arguments", () => {
    expect(tokenizeArgs(`--outDir "out dir" --x '' 'a b'`)).toEqual(["--outDir", "out dir", "--x", "", "a b"]);
  });

  it("handles escapes outside quotes and inside double quotes", () => {
    expect(tokenizeArgs(String.raw`a\ b "c\"d" 'e\f'`)).toEqual(["a b", 'c"d', String.raw`e\f`]);
  });
});
