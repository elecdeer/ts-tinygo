import { describe, expect, it } from "vitest";
import { languageForPath } from "./language";

describe("languageForPath", () => {
  it.each([
    ["main.ts", "typescript"],
    ["types.d.ts", "typescript"],
    ["app.tsx", "typescript"],
    ["mod.mts", "typescript"],
    ["dist/main.js", "javascript"],
    ["dist/main.js.map", "json"],
    ["tsconfig.json", "json"],
    ["README", "plaintext"],
  ])("%s -> %s", (path, language) => {
    expect(languageForPath(path)).toBe(language);
  });
});
