import { useEffect, useMemo, useState } from "react";
import { CodeEditor, disposeStaleModels } from "./components/CodeEditor";
import { tokenizeArgs } from "./lib/args";
import { parseDiagnostics } from "./lib/diagnostics";
import { ENGINES, getEngine } from "./lib/engines";
import { toProjectPath, validateFileName } from "./lib/paths";
import { type EngineId, type PlaygroundState, deserializeState, serializeState } from "./lib/state";
import { useTscRunner } from "./useTscRunner";

const OUTPUT_TAB = "<output>";
const RUN_DEBOUNCE_MS = 300;

// User args come later and win.
// `--pretty false` keeps the output parseable for editor markers.
// `--singleThreaded`: wasm runs on one thread anyway, and on TinyGo the goroutine
// fan-out costs ~2.7x (fixed-size stacks + asyncify switching) for no parallelism.
const DEFAULT_ARGS = ["--pretty", "false", "--singleThreaded"];

/**
 * Formats a byte count as megabytes.
 */
function formatMB(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Formats a duration in milliseconds.
 */
function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`;
}

/**
 * The playground: project files on the left, tsc output on the right.
 */
export function App() {
  const [state, setState] = useState<PlaygroundState>(() => deserializeState(location.hash));
  const fileNames = useMemo(() => Object.keys(state.files), [state.files]);
  const [activeFile, setActiveFile] = useState<string>(() => fileNames[0] ?? "main.ts");
  const [activeOutput, setActiveOutput] = useState<string>(OUTPUT_TAB);
  const runner = useTscRunner();
  const engine = getEngine(state.engine);

  // Persist state in the URL so a link reproduces the playground.
  useEffect(() => {
    const hash = `#${serializeState(state)}`;
    if (location.hash !== hash) history.replaceState(null, "", hash);
  }, [state]);

  const { run } = runner;
  useEffect(() => {
    const timer = setTimeout(() => {
      run(engine, state.files, [...DEFAULT_ARGS, ...tokenizeArgs(state.args)]);
    }, RUN_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [run, engine, state.files, state.args]);

  useEffect(() => disposeStaleModels("source", fileNames), [fileNames]);

  const result = runner.result;
  const consoleText = useMemo(() => {
    if (result === undefined) return "";
    return [result.stdout, result.stderr].filter((s) => s !== "").join("\n");
  }, [result]);
  const diagnostics = useMemo(() => parseDiagnostics(consoleText), [consoleText]);
  const activeDiagnostics = useMemo(
    () => diagnostics.filter((d) => toProjectPath(d.file) === activeFile),
    [diagnostics, activeFile],
  );
  const outputNames = useMemo(
    () => Object.keys(result?.outputs ?? {}).sort((a, b) => a.localeCompare(b)),
    [result],
  );
  const shownOutput = outputNames.includes(activeOutput) ? activeOutput : OUTPUT_TAB;

  const updateFile = (name: string, content: string) =>
    setState((s) => ({ ...s, files: { ...s.files, [name]: content } }));

  const addFile = () => {
    const name = prompt("New file name", "util.ts");
    if (name === null) return;
    const problem = validateFileName(name, fileNames);
    if (problem !== undefined) {
      alert(problem);
      return;
    }
    updateFile(name.trim(), "");
    setActiveFile(name.trim());
  };

  const renameFile = (from: string) => {
    const name = prompt("Rename file", from);
    if (name === null || name.trim() === from) return;
    const problem = validateFileName(name, fileNames);
    if (problem !== undefined) {
      alert(problem);
      return;
    }
    const to = name.trim();
    setState((s) => ({
      ...s,
      files: Object.fromEntries(Object.entries(s.files).map(([k, v]) => [k === from ? to : k, v])),
    }));
    setActiveFile(to);
  };

  const removeFile = (name: string) => {
    if (fileNames.length <= 1 || !confirm(`Delete ${name}?`)) return;
    setState((s) => ({
      ...s,
      files: Object.fromEntries(Object.entries(s.files).filter(([k]) => k !== name)),
    }));
    if (activeFile === name) setActiveFile(fileNames.find((n) => n !== name) ?? "");
  };

  const busy = runner.status === "loading" || runner.status === "running";

  return (
    <div className="app">
      <header className="toolbar">
        <h1>
          tsc <span className="muted">on</span> TinyGo
        </h1>
        <label className="field">
          <span>Engine</span>
          <select
            value={state.engine}
            onChange={(e) => {
              const id = ENGINES.find((x) => x.id === e.target.value)?.id;
              if (id !== undefined) setState((s) => ({ ...s, engine: id satisfies EngineId }));
            }}
            title={engine.description}
          >
            {ENGINES.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field grow">
          <span>tsc</span>
          <input
            value={state.args}
            onChange={(e) => setState((s) => ({ ...s, args: e.target.value }))}
            placeholder={`extra arguments (defaults: ${DEFAULT_ARGS.join(" ")})`}
            spellCheck={false}
          />
        </label>
        <div className="status" aria-live="polite">
          {busy && <span className="spinner" aria-hidden />}
          {runner.status === "loading" && "Loading wasm…"}
          {runner.status === "running" && "Running…"}
          {runner.status === "error" && <span className="error-text">Failed</span>}
          {result !== undefined && !busy && (
            <span title="Time spent inside _start (tsc main)">{formatMs(result.elapsedMs)}</span>
          )}
          {runner.wasm !== undefined && <span className="muted">{formatMB(runner.wasm.bytes)}</span>}
        </div>
      </header>

      <main className="panes">
        <section className="pane">
          <nav className="tabs">
            {fileNames.map((name) => (
              <div key={name} className={`tab ${name === activeFile ? "active" : ""}`}>
                <button type="button" onClick={() => setActiveFile(name)} onDoubleClick={() => renameFile(name)} title="Double-click to rename">
                  {name}
                  {diagnostics.some((d) => toProjectPath(d.file) === name && d.category === "error") && (
                    <span className="dot" aria-label="has errors" />
                  )}
                </button>
                {fileNames.length > 1 && (
                  <button type="button" className="close" onClick={() => removeFile(name)} aria-label={`Delete ${name}`}>
                    ×
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="tab add" onClick={addFile} aria-label="Add file">
              +
            </button>
          </nav>
          {state.files[activeFile] !== undefined && (
            <CodeEditor
              scope="source"
              path={activeFile}
              value={state.files[activeFile]}
              onChange={(value) => updateFile(activeFile, value)}
              diagnostics={activeDiagnostics}
            />
          )}
        </section>

        <section className="pane">
          <nav className="tabs">
            <div className={`tab ${shownOutput === OUTPUT_TAB ? "active" : ""}`}>
              <button type="button" onClick={() => setActiveOutput(OUTPUT_TAB)}>
                Console
                {result !== undefined && (
                  <span className={`badge ${result.exitCode === 0 ? "ok" : "ng"}`}>exit {result.exitCode}</span>
                )}
              </button>
            </div>
            {outputNames.map((name) => (
              <div key={name} className={`tab ${name === shownOutput ? "active" : ""}`}>
                <button type="button" onClick={() => setActiveOutput(name)}>
                  {name}
                </button>
              </div>
            ))}
          </nav>
          {shownOutput === OUTPUT_TAB ? (
            <pre className="console">
              {runner.error !== undefined ? (
                <span className="error-text">{runner.error}</span>
              ) : result === undefined ? (
                <span className="muted">Waiting for the first run…</span>
              ) : consoleText === "" ? (
                <span className="muted">No diagnostics.</span>
              ) : (
                consoleText
              )}
            </pre>
          ) : (
            <CodeEditor scope="output" path={shownOutput} value={result?.outputs[shownOutput] ?? ""} readOnly />
          )}
        </section>
      </main>

      <footer className="footer muted">
        {engine.description}
        {runner.wasm !== undefined && ` · fetch + compile ${formatMs(runner.wasm.loadMs)}`}
        {" · "}
        <a href="https://github.com/microsoft/TypeScript" target="_blank" rel="noreferrer">
          microsoft/TypeScript
        </a>
      </footer>
    </div>
  );
}
