import { memoryFileSystem, runTscAsync } from "../../../ts-rust/npm/wasm/core.js";
import { PROJECT_DIR, type RunResult, type SourceFiles, diffFiles } from "./runner";

/**
 * Runs ts-rust's wasm build against an in-memory project.
 * Unlike the wasip1 tsc builds it is not a WASI command: ts-rust's own glue drives it
 * and supplies the file system, so this only maps the project in and out of that.
 */
export async function runTsRust(
  module: WebAssembly.Module,
  files: SourceFiles,
  args: string[],
): Promise<RunResult> {
  const prefix = `${PROJECT_DIR}/`;
  const fs = memoryFileSystem(Object.fromEntries(Object.entries(files).map(([path, content]) => [prefix + path, content])));

  const decoder = new TextDecoder();
  let stdout = "";
  let stderr = "";
  const start = performance.now();
  const { exitCode } = await runTscAsync(module, {
    args,
    cwd: PROJECT_DIR,
    fs,
    stdout: (chunk) => {
      stdout += decoder.decode(chunk, { stream: true });
    },
    stderr: (chunk) => {
      stderr += decoder.decode(chunk, { stream: true });
    },
  });
  const elapsedMs = performance.now() - start;

  const after: SourceFiles = {};
  for (const [path, content] of fs.files) {
    if (path.startsWith(prefix)) after[path.slice(prefix.length)] = content;
  }

  return {
    exitCode,
    stdout: stdout.trimEnd(),
    stderr: stderr.trimEnd(),
    outputs: diffFiles(files, after),
    elapsedMs,
  };
}
