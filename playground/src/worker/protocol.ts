import type { RunResult, SourceFiles } from "../lib/runner";

export interface RunRequest {
  type: "run";
  id: number;
  wasmUrl: string;
  files: SourceFiles;
  args: string[];
}

export type WorkerResponse =
  | { type: "loaded"; id: number; wasmBytes: number; loadMs: number }
  | { type: "result"; id: number; result: RunResult }
  | { type: "error"; id: number; message: string };
