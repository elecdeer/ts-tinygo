import type { EngineId } from "./state";

/** `wasi`: a wasip1 command run through the WASI shim. `ts-rust`: driven by ts-rust's own glue. */
export type EngineKind = "wasi" | "ts-rust";

export interface Engine {
  id: EngineId;
  kind: EngineKind;
  label: string;
  description: string;
  /** URL of the wasm module, relative to the app base. */
  url: string;
}

export const ENGINES: readonly Engine[] = [
  {
    id: "tinygo",
    kind: "wasi",
    label: "TinyGo",
    description: "tsc built with TinyGo (wasip1, -opt=z, 16MB goroutine stacks)",
    url: `${import.meta.env.BASE_URL}wasm/tsc-tinygo.wasm`,
  },
  {
    id: "go",
    kind: "wasi",
    label: "Go",
    description: "tsc built with the standard Go toolchain (GOOS=wasip1)",
    url: `${import.meta.env.BASE_URL}wasm/tsc-go.wasm`,
  },
  {
    id: "ts-rust",
    kind: "ts-rust",
    label: "ts-rust",
    description: "pingdotgg/ts-rust, a Rust port of typescript-go (wasm32-wasip1, opt-level z)",
    url: `${import.meta.env.BASE_URL}wasm/ts-rust.wasm`,
  },
];

/**
 * Looks up an engine by id, defaulting to the first one.
 */
export function getEngine(id: EngineId): Engine {
  return ENGINES.find((engine) => engine.id === id) ?? ENGINES[0]!;
}
