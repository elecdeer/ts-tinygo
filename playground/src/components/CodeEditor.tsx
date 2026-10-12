import { useEffect, useRef } from "react";
import type { Diagnostic } from "../lib/diagnostics";
import { languageForPath } from "../lib/language";
import { PROJECT_DIR } from "../lib/runner";
import { monaco } from "../monaco";

export interface CodeEditorProps {
  /** Path of the model to show; models are kept per path so undo history survives tab switches. */
  path: string;
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  /** Diagnostics for this file, shown as editor markers. */
  diagnostics?: readonly Diagnostic[];
  /** Separates model namespaces so read-only outputs never collide with sources. */
  scope: string;
}

/**
 * Returns the model URI for a file in a given scope.
 */
function modelUri(scope: string, path: string): monaco.Uri {
  const base = scope === "source" ? PROJECT_DIR : `/${scope}`;
  return monaco.Uri.file(`${base}/${path}`);
}

/**
 * Converts tsc diagnostics into Monaco markers.
 */
function toMarkers(diagnostics: readonly Diagnostic[]): monaco.editor.IMarkerData[] {
  return diagnostics.map((d) => ({
    severity:
      d.category === "error"
        ? monaco.MarkerSeverity.Error
        : d.category === "warning"
          ? monaco.MarkerSeverity.Warning
          : monaco.MarkerSeverity.Info,
    message: d.message,
    code: `TS${d.code}`,
    startLineNumber: d.line,
    startColumn: d.column,
    endLineNumber: d.line,
    // tsc's plain output has no span length, so highlight up to the end of the word.
    endColumn: d.column + 1,
  }));
}

/**
 * A Monaco editor bound to a path-addressed model.
 */
export function CodeEditor({ path, value, onChange, readOnly = false, diagnostics = [], scope }: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | undefined>(undefined);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;
    const dark = window.matchMedia("(prefers-color-scheme: dark)");
    const editor = monaco.editor.create(container, {
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 13,
      scrollBeyondLastLine: false,
      readOnly,
      theme: dark.matches ? "vs-dark" : "vs",
      tabSize: 2,
    });
    const onScheme = (e: MediaQueryListEvent) => monaco.editor.setTheme(e.matches ? "vs-dark" : "vs");
    dark.addEventListener("change", onScheme);
    const subscription = editor.onDidChangeModelContent(() => {
      const model = editor.getModel();
      if (model !== null) onChangeRef.current?.(model.getValue());
    });
    editorRef.current = editor;
    return () => {
      dark.removeEventListener("change", onScheme);
      subscription.dispose();
      editor.dispose();
      editorRef.current = undefined;
    };
  }, [readOnly]);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor === undefined) return;
    const uri = modelUri(scope, path);
    let model = monaco.editor.getModel(uri);
    if (model === null) {
      model = monaco.editor.createModel(value, languageForPath(path), uri);
    } else if (model.getValue() !== value) {
      // Only external updates land here; typing already keeps the model in sync.
      model.setValue(value);
    }
    if (editor.getModel() !== model) editor.setModel(model);
  }, [scope, path, value, readOnly]);

  useEffect(() => {
    const model = monaco.editor.getModel(modelUri(scope, path));
    if (model === null) return;
    monaco.editor.setModelMarkers(model, "tsc", toMarkers(diagnostics));
  }, [scope, path, diagnostics]);

  return <div ref={containerRef} className="editor" />;
}

/**
 * Disposes source models whose files no longer exist.
 */
export function disposeStaleModels(scope: string, livePaths: readonly string[]): void {
  const live = new Set(livePaths.map((p) => modelUri(scope, p).toString()));
  const prefix = modelUri(scope, "").toString();
  for (const model of monaco.editor.getModels()) {
    const uri = model.uri.toString();
    if (uri.startsWith(prefix) && !live.has(uri)) model.dispose();
  }
}
