// Run a tsrs wasm build (any path) on the real file system, like tsrs's `tsrs-wasm` command.
// usage: node scripts/run-tsrs.mjs <tsrs.wasm> [tsc args...]
// tsrs's node.js loads the module named by TSRS_WASM and runs it in a worker with the large stack
// that the checker needs, so this only picks the module.
import process from "node:process";
import tty from "node:tty";

const [wasmPath, ...args] = process.argv.slice(2);
if (!wasmPath) {
  console.error("usage: node scripts/run-tsrs.mjs <tsrs.wasm> [tsc args...]");
  process.exit(2);
}

process.env.TSRS_WASM = wasmPath;
const { tsc } = await import("../tsrs/npm/tsrs-wasm/node.js");
// Same as tsrs's bin/tsrs-wasm.js: tty.isatty(1), since touching process.stdout on a pipe makes it non-blocking.
const result = await tsc(args, {
  env: process.env,
  tty: tty.isatty(1),
  stdout: "inherit",
  stderr: "inherit",
});
process.exitCode = result.exitCode;
