import type { SourceFiles } from "./runner";

export type EngineId = "tinygo" | "go" | "ts-rust";

export const ENGINE_IDS: readonly EngineId[] = ["tinygo", "go", "ts-rust"];

export interface PlaygroundState {
  files: SourceFiles;
  args: string;
  engine: EngineId;
}

export const DEFAULT_STATE: PlaygroundState = {
  files: {
    "main.ts": `interface User {
  id: number;
  name: string;
  email?: string;
}

export function greet(user: User): string {
  return \`Hello, \${user.name}\`;
}

greet({ id: "1", name: "Alice" });
`,
    "tsconfig.json": `${JSON.stringify(
      {
        compilerOptions: {
          target: "esnext",
          module: "esnext",
          strict: true,
          declaration: true,
          outDir: "dist",
        },
      },
      undefined,
      2,
    )}\n`,
  },
  args: "",
  engine: "tinygo",
};

/**
 * Encodes UTF-8 text as URL-safe base64.
 */
export function encodeBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Decodes URL-safe base64 back to UTF-8 text.
 */
export function decodeBase64Url(encoded: string): string {
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Serializes playground state for the URL hash.
 */
export function serializeState(state: PlaygroundState): string {
  return encodeBase64Url(JSON.stringify(state));
}

/**
 * Restores playground state from a URL hash, falling back to defaults for anything invalid.
 */
export function deserializeState(hash: string): PlaygroundState {
  const encoded = hash.replace(/^#/, "");
  if (encoded === "") return DEFAULT_STATE;
  try {
    const parsed: unknown = JSON.parse(decodeBase64Url(encoded));
    if (typeof parsed !== "object" || parsed === null) return DEFAULT_STATE;
    // Every field is still `unknown` and validated below; this only allows property access.
    const candidate = parsed as Partial<Record<keyof PlaygroundState, unknown>>;
    const files = isSourceFiles(candidate.files) ? candidate.files : DEFAULT_STATE.files;
    return {
      files: Object.keys(files).length > 0 ? files : DEFAULT_STATE.files,
      args: typeof candidate.args === "string" ? candidate.args : DEFAULT_STATE.args,
      engine: ENGINE_IDS.find((id) => id === candidate.engine) ?? DEFAULT_STATE.engine,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

/**
 * Checks that a value is a map of file paths to string contents.
 */
function isSourceFiles(value: unknown): value is SourceFiles {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.values(value).every((content) => typeof content === "string")
  );
}
