// Run a ts-rust wasm build (any path) on the real file system, like ts-rust's `tsc-wasm`.
// usage: node scripts/run-ts-rust.mjs <ts_rust.wasm> [tsc args...]
// ts-rust's node.js entry always loads the ts_rust.wasm next to it, so this picks the module
// and reuses its worker, which runs with the large stack that the checker needs.
import { readFile } from "node:fs/promises";
import process from "node:process";
import { Worker } from "node:worker_threads";

const [wasmPath, ...args] = process.argv.slice(2);
if (!wasmPath) {
  console.error("usage: node scripts/run-ts-rust.mjs <ts_rust.wasm> [tsc args...]");
  process.exit(2);
}

const module = await WebAssembly.compile(await readFile(wasmPath));
const worker = new Worker(new URL("../ts-rust/npm/wasm/node-worker.js", import.meta.url), {
  workerData: {
    module,
    args,
    cwd: process.env.PWD ?? process.cwd(),
    env: process.env,
    diagnosticsJson: false,
    tty: false,
    stream: true,
  },
  // Same as ts-rust's node.js.
  resourceLimits: { stackSizeMb: 256 },
});

worker.on("message", (result) => {
  if (result.error) {
    process.stderr.write(`ts-rust: ${result.error}\n${result.stderr ?? ""}`);
    process.exitCode = 70;
  } else {
    process.exitCode = result.exitCode;
  }
});
worker.on("error", (error) => {
  process.stderr.write(`ts-rust: ${error.message}\n`);
  process.exitCode = 70;
});
