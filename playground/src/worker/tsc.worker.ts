/// <reference lib="webworker" />
import { runTsc } from "../lib/runner";
import { runTsRust } from "../lib/runner-ts-rust";
import type { RunRequest, WorkerResponse } from "./protocol";

declare const self: DedicatedWorkerGlobalScope;

interface LoadedModule {
  module: WebAssembly.Module;
  bytes: number;
}

// Compiling a ~20-50MB module takes seconds, so keep it for the worker's lifetime.
const modules = new Map<string, Promise<LoadedModule>>();

/**
 * Fetches and compiles a wasm module once per URL.
 */
function loadModule(url: string): Promise<LoadedModule> {
  let loading = modules.get(url);
  if (loading === undefined) {
    loading = (async () => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
      }
      const buffer = await response.arrayBuffer();
      return { module: await WebAssembly.compile(buffer), bytes: buffer.byteLength };
    })();
    loading.catch(() => modules.delete(url));
    modules.set(url, loading);
  }
  return loading;
}

/**
 * Posts a typed response to the main thread.
 */
function reply(response: WorkerResponse): void {
  self.postMessage(response);
}

self.addEventListener("message", async (event: MessageEvent<RunRequest>) => {
  const { id, kind, wasmUrl, files, args } = event.data;
  try {
    const loadStart = performance.now();
    const { module, bytes } = await loadModule(wasmUrl);
    reply({ type: "loaded", id, wasmBytes: bytes, loadMs: performance.now() - loadStart });
    const result = kind === "ts-rust" ? await runTsRust(module, files, args) : await runTsc(module, files, args);
    reply({ type: "result", id, result });
  } catch (error) {
    reply({ type: "error", id, message: error instanceof Error ? `${error.name}: ${error.message}` : String(error) });
  }
});
