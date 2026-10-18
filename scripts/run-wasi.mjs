// Run a WASI (wasip1) build of tsc on Node.js.
// usage: node scripts/run-wasi.mjs <tsc.wasm> [tsc args...]
// The current working directory is exposed to the guest as-is via a "/" preopen.
import { readFile } from "node:fs/promises";
import process from "node:process";
import { WASI } from "node:wasi";

const [wasmPath, ...args] = process.argv.slice(2);
if (!wasmPath) {
  console.error("usage: node scripts/run-wasi.mjs <tsc.wasm> [tsc args...]");
  process.exit(2);
}

const wasi = new WASI({
  version: "preview1",
  args: ["tsc", ...args],
  env: { PWD: process.cwd() },
  // Absolute host paths map 1:1 into the guest so tsc can resolve PWD-relative paths.
  preopens: { "/": "/" },
  returnOnExit: true,
});

const module = await WebAssembly.compile(await readFile(wasmPath));
const instance = await WebAssembly.instantiate(module, wasi.getImportObject());
process.exitCode = wasi.start(instance);
