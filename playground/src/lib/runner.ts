import {
  ConsoleStdout,
  Directory,
  File,
  type Inode,
  OpenFile,
  PreopenDirectory,
  WASI,
} from "@bjorn3/browser_wasi_shim";

/** Directory that the guest sees as its working directory. */
export const PROJECT_DIR = "/app";

export type SourceFiles = Record<string, string>;

export interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  /** Files that were created or changed by the run, keyed by project-relative path. */
  outputs: SourceFiles;
  /** Time spent inside `_start`, in milliseconds. */
  elapsedMs: number;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Builds an in-memory directory tree from project-relative paths such as `src/a.ts`.
 */
export function buildTree(files: SourceFiles): Directory {
  const root = new Directory(new Map());
  for (const [path, content] of Object.entries(files)) {
    const segments = path.split("/").filter((s) => s !== "" && s !== ".");
    const name = segments.pop();
    if (name === undefined) continue;
    let dir = root;
    for (const segment of segments) {
      const child = dir.contents.get(segment);
      if (child instanceof Directory) {
        dir = child;
      } else {
        const created = new Directory(new Map());
        dir.contents.set(segment, created);
        dir = created;
      }
    }
    dir.contents.set(name, new File(encoder.encode(content)));
  }
  return root;
}

/**
 * Flattens a directory tree back into project-relative paths.
 */
export function flattenTree(dir: Directory, prefix = ""): SourceFiles {
  const result: SourceFiles = {};
  for (const [name, inode] of dir.contents) {
    const path = prefix === "" ? name : `${prefix}/${name}`;
    if (inode instanceof Directory) {
      Object.assign(result, flattenTree(inode, path));
    } else if (inode instanceof File) {
      result[path] = decoder.decode(inode.data);
    }
  }
  return result;
}

/**
 * Returns the entries of `after` that are new or differ from `before`.
 */
export function diffFiles(before: SourceFiles, after: SourceFiles): SourceFiles {
  const changed: SourceFiles = {};
  for (const [path, content] of Object.entries(after)) {
    if (before[path] !== content) changed[path] = content;
  }
  return changed;
}

/**
 * Runs a wasip1 build of tsc against an in-memory project.
 * A fresh instance is created per run because Go programs cannot be restarted after exit.
 */
export async function runTsc(
  module: WebAssembly.Module,
  files: SourceFiles,
  args: string[],
): Promise<RunResult> {
  const project = buildTree(files);
  // Mount the project under "/" rather than preopening it directly, so lookups
  // of ancestor directories (node_modules, package.json) resolve to ENOENT
  // instead of escaping the only preopen.
  const root = new Map<string, Inode>([[PROJECT_DIR.slice(1), project]]);

  const stdout: string[] = [];
  const stderr: string[] = [];
  const wasi = new WASI(
    ["tsc", ...args],
    [`PWD=${PROJECT_DIR}`],
    [
      new OpenFile(new File([])),
      ConsoleStdout.lineBuffered((line) => stdout.push(line)),
      ConsoleStdout.lineBuffered((line) => stderr.push(line)),
      new PreopenDirectory("/", root),
    ],
    { debug: false },
  );

  const instance = await WebAssembly.instantiate(module, {
    wasi_snapshot_preview1: wasi.wasiImport,
  });
  const start = performance.now();
  // The shim only reads `memory` and `_start`, which every wasip1 command module exports.
  const exitCode = wasi.start(instance as Parameters<WASI["start"]>[0]);
  const elapsedMs = performance.now() - start;

  return {
    exitCode,
    stdout: stdout.join("\n"),
    stderr: stderr.join("\n"),
    outputs: diffFiles(files, flattenTree(project)),
    elapsedMs,
  };
}
