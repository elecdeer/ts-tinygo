// Copies wasm builds from ../out into public/wasm so Vite can serve them.
import { copyFile, mkdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "..", "out");
const destDir = join(root, "public", "wasm");

const builds = [
  { from: "tsc.wasip1.wasm", to: "tsc-tinygo.wasm", hint: "scripts/build.sh wasip1" },
  { from: "tsc-go.wasip1.wasm", to: "tsc-go.wasm", hint: "scripts/build-go.sh wasip1" },
];

await mkdir(destDir, { recursive: true });
for (const { from, to, hint } of builds) {
  const src = join(outDir, from);
  try {
    await stat(src);
  } catch {
    console.warn(`[copy-wasm] ${from} not found; run \`${hint}\` at the repo root.`);
    continue;
  }
  await copyFile(src, join(destDir, to));
  console.log(`[copy-wasm] ${from} -> public/wasm/${to}`);
}
