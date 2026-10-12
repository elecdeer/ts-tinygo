import { useCallback, useEffect, useRef, useState } from "react";
import type { RunResult, SourceFiles } from "./lib/runner";
import type { RunRequest, WorkerResponse } from "./worker/protocol";
import TscWorker from "./worker/tsc.worker?worker";

export type RunnerStatus = "idle" | "loading" | "running" | "done" | "error";

export interface WasmInfo {
  bytes: number;
  loadMs: number;
}

export interface TscRunner {
  status: RunnerStatus;
  result: RunResult | undefined;
  error: string | undefined;
  wasm: WasmInfo | undefined;
  run: (wasmUrl: string, files: SourceFiles, args: string[]) => void;
}

type PendingRun = Omit<RunRequest, "type" | "id">;

/**
 * Runs tsc in a dedicated worker. While a run is in flight, only the latest
 * request is kept and started afterwards, so the compiled module cache survives.
 */
export function useTscRunner(): TscRunner {
  const workerRef = useRef<Worker | undefined>(undefined);
  const busyRef = useRef(false);
  const queuedRef = useRef<PendingRun | undefined>(undefined);
  const nextIdRef = useRef(0);

  const [status, setStatus] = useState<RunnerStatus>("idle");
  const [result, setResult] = useState<RunResult | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [wasm, setWasm] = useState<WasmInfo | undefined>(undefined);

  const start = useCallback((request: PendingRun) => {
    const worker = workerRef.current;
    if (worker === undefined) return;
    busyRef.current = true;
    setStatus("loading");
    const message: RunRequest = { type: "run", id: nextIdRef.current++, ...request };
    worker.postMessage(message);
  }, []);

  useEffect(() => {
    const worker = new TscWorker();
    workerRef.current = worker;

    const finish = () => {
      busyRef.current = false;
      const queued = queuedRef.current;
      if (queued !== undefined) {
        queuedRef.current = undefined;
        start(queued);
      }
    };

    worker.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      switch (response.type) {
        case "loaded":
          setWasm({ bytes: response.wasmBytes, loadMs: response.loadMs });
          setStatus("running");
          break;
        case "result":
          setResult(response.result);
          setError(undefined);
          setStatus("done");
          finish();
          break;
        case "error":
          setError(response.message);
          setStatus("error");
          finish();
          break;
      }
    });
    worker.addEventListener("error", (event) => {
      setError(event.message || "Worker crashed");
      setStatus("error");
      busyRef.current = false;
    });

    return () => {
      worker.terminate();
      workerRef.current = undefined;
      busyRef.current = false;
    };
  }, [start]);

  const run = useCallback(
    (wasmUrl: string, files: SourceFiles, args: string[]) => {
      const request: PendingRun = { wasmUrl, files, args };
      if (busyRef.current) {
        queuedRef.current = request;
      } else {
        start(request);
      }
    },
    [start],
  );

  return { status, result, error, wasm, run };
}
