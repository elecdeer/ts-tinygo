import type { EngineId } from "./state";

export interface Engine {
  id: EngineId;
  label: string;
  description: string;
  /** URL of the wasip1 tsc build, relative to the app base. */
  url: string;
}

export const ENGINES: readonly Engine[] = [
  {
    id: "tinygo",
    label: "TinyGo",
    description: "tsc built with TinyGo (wasip1, -opt=z, 16MB goroutine stacks)",
    url: `${import.meta.env.BASE_URL}wasm/tsc-tinygo.wasm`,
  },
  {
    id: "go",
    label: "Go",
    description: "tsc built with the standard Go toolchain (GOOS=wasip1)",
    url: `${import.meta.env.BASE_URL}wasm/tsc-go.wasm`,
  },
];

/**
 * Looks up an engine by id, defaulting to the first one.
 */
export function getEngine(id: EngineId): Engine {
  return ENGINES.find((engine) => engine.id === id) ?? ENGINES[0]!;
}
