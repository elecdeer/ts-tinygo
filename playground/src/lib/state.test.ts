import { describe, expect, it } from "vitest";
import { DEFAULT_STATE, decodeBase64Url, deserializeState, encodeBase64Url, serializeState } from "./state";

describe("base64url", () => {
  it("round-trips non-ASCII text without URL-unsafe characters", () => {
    const text = "const 名前 = `🎉`; // ?&=+/";
    const encoded = encodeBase64Url(text);
    expect(encoded).not.toMatch(/[+/=]/);
    expect(decodeBase64Url(encoded)).toBe(text);
  });
});

describe("deserializeState", () => {
  it("restores serialized state", () => {
    const state = { files: { "a.ts": "let a = 1;" }, args: "--noEmit", engine: "go" as const };
    expect(deserializeState(`#${serializeState(state)}`)).toEqual(state);
  });

  it("falls back to defaults for an empty or broken hash", () => {
    expect(deserializeState("")).toBe(DEFAULT_STATE);
    expect(deserializeState("#not-base64!!")).toBe(DEFAULT_STATE);
  });

  it("replaces invalid fields individually", () => {
    const hash = encodeBase64Url(JSON.stringify({ files: { "a.ts": 1 }, args: 2, engine: "rust" }));
    expect(deserializeState(hash)).toEqual(DEFAULT_STATE);
  });

  it("uses default files when none are given", () => {
    const hash = encodeBase64Url(JSON.stringify({ files: {}, args: "-v", engine: "tinygo" }));
    expect(deserializeState(hash)).toEqual({ ...DEFAULT_STATE, args: "-v" });
  });
});
