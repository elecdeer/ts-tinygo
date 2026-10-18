export type DiagnosticCategory = "error" | "warning" | "message" | "suggestion";

export interface Diagnostic {
  file: string;
  line: number;
  column: number;
  category: DiagnosticCategory;
  code: number;
  message: string;
}

// Matches tsc's `--pretty false` format: `file(line,col): error TS1234: message`.
const DIAGNOSTIC_LINE =
  /^(.+?)\((\d+),(\d+)\): (error|warning|message|suggestion) TS(\d+): (.*)$/;

/**
 * Parses diagnostics from tsc output printed with `--pretty false`.
 * Indented lines following a diagnostic are treated as its message chain.
 */
export function parseDiagnostics(output: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const line of output.split(/\r?\n/)) {
    const match = DIAGNOSTIC_LINE.exec(line);
    if (match !== null) {
      const [, file, lineNo, column, category, code, message] = match;
      diagnostics.push({
        file: file!,
        line: Number(lineNo),
        column: Number(column),
        // The regex alternation only admits DiagnosticCategory values.
        category: category as DiagnosticCategory,
        code: Number(code),
        message: message!,
      });
      continue;
    }
    const last = diagnostics.at(-1);
    if (last !== undefined && /^\s+\S/.test(line)) {
      last.message += `\n${line.trim()}`;
    }
  }
  return diagnostics;
}
