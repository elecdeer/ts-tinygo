// Editor-like latency benchmark: start a language server, open a file, then
// measure diagnostics, edits, completion and hover the way an editor asks for them.
//
// usage: node bench/lsp/run.mjs [--protocol=lsp|tsserver] [--edits=N] [--timeout=ms] [--settle=ms]
//          <project-dir> <file> -- <server command...>
// Prints one JSON line with the timings in milliseconds (null when a step timed out).
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const sep = process.argv.indexOf("--");
const opts = Object.fromEntries(
  process.argv.slice(2, sep).filter((a) => a.startsWith("--")).map((a) => a.slice(2).split("=")),
);
const [projectDir, file] = process.argv.slice(2, sep).filter((a) => !a.startsWith("--")).map((p) => resolve(p));
const [cmd, ...args] = process.argv.slice(sep + 1);
const protocol = opts.protocol ?? "lsp";
const edits = Number(opts.edits ?? 5);
const stepTimeout = Number(opts.timeout ?? 180000);
// Idle time before completion and hover, for servers that keep working in the background after a check.
const settle = Number(opts.settle ?? 0);

const original = readFileSync(file, "utf8");
/** The file after edit `k`: alternates the appended line between a type error and valid code. */
const edited = (k) => `${original}\nconst __edit${k % 2}: number = ${k % 2 ? "'x'" : "1"};\n;[].`;
/** Where completion and hover are asked: after the appended `[].`, and on `__edit`. */
const lines = (text) => text.split("\n");
const lastLine = (text) => lines(text).length - 1;

const server = spawn(cmd, args, { cwd: projectDir, stdio: ["pipe", "pipe", "pipe"] });
let exited = false;
/** Settles when the server process ends, so a step does not wait out its timeout for a dead server. */
const serverExit = new Promise((res) => server.on("exit", () => res((exited = true))));
// The tail of the server's stderr, reported when it dies.
let stderrTail = "";
server.stderr.on("data", (c) => (stderrTail = (stderrTail + c).slice(-2000)));
// Writing to a server that died raises EPIPE; `serverExit` already reports that.
server.stdin.on("error", () => {});
// Never leave a busy server behind: it would skew the next measurement.
process.on("exit", () => server.kill("SIGKILL"));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => process.exit(130));

// Both protocols frame server-to-client messages with Content-Length headers.
let buf = Buffer.alloc(0);
const listeners = new Set();
server.stdout.on("data", (chunk) => {
  buf = Buffer.concat([buf, chunk]);
  for (;;) {
    const headerEnd = buf.indexOf("\r\n\r\n");
    if (headerEnd < 0) return;
    const m = /Content-Length: (\d+)/i.exec(buf.subarray(0, headerEnd).toString());
    if (m === null) {
      buf = buf.subarray(headerEnd + 4);
      continue;
    }
    const len = Number(m[1]);
    if (buf.length < headerEnd + 4 + len) return;
    const msg = JSON.parse(buf.subarray(headerEnd + 4, headerEnd + 4 + len).toString());
    buf = buf.subarray(headerEnd + 4 + len);
    for (const l of [...listeners]) l(msg);
  }
});
/** Resolves with the first message that `match` accepts. */
const waitFor = (match) =>
  new Promise((res) => {
    const l = (msg) => {
      if (match(msg)) {
        listeners.delete(l);
        res(msg);
      }
    };
    listeners.add(l);
  });

let seq = 1;
const lsp = {
  send(msg) {
    const body = Buffer.from(JSON.stringify({ jsonrpc: "2.0", ...msg }));
    server.stdin.write(Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`), body]));
  },
  request(method, params) {
    const id = seq++;
    const reply = waitFor((m) => m.id === id && m.method === undefined);
    this.send({ id, method, params });
    return reply;
  },
  notify(method, params) {
    this.send({ method, params });
  },
};
// Answer the server's own requests (registerCapability, workspace/configuration, ...).
listeners.add((m) => {
  if (protocol === "lsp" && m.id !== undefined && m.method !== undefined) {
    lsp.send({ id: m.id, result: m.method === "workspace/configuration" ? (m.params?.items ?? []).map(() => null) : null });
  }
});

const tss = {
  request(command, args) {
    const s = seq++;
    const reply = waitFor((m) => m.type === "response" && m.request_seq === s);
    server.stdin.write(`${JSON.stringify({ seq: s, type: "request", command, arguments: args })}\n`);
    return reply;
  },
  /** `geterr` reports through events and ends with `requestCompleted`. */
  async geterr() {
    const s = seq++;
    const done = waitFor((m) => m.type === "event" && m.event === "requestCompleted" && m.body?.request_seq === s);
    let count = 0;
    const l = (m) => {
      if (m.type === "event" && (m.event === "semanticDiag" || m.event === "syntaxDiag") && m.body?.file === file) {
        count += m.body.diagnostics.length;
      }
    };
    listeners.add(l);
    server.stdin.write(`${JSON.stringify({ seq: s, type: "request", command: "geterr", arguments: { files: [file], delay: 0 } })}\n`);
    await done;
    listeners.delete(l);
    return count;
  },
};

const withTimeout = (p) =>
  Promise.race([
    p,
    new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), stepTimeout)),
    serverExit.then(() => Promise.reject(new Error("server exited"))),
  ]);
/** Times one step; returns [ms, value] or [null, undefined] on timeout. */
async function step(fn) {
  const t = performance.now();
  try {
    const v = await withTimeout(fn());
    return [performance.now() - t, v];
  } catch {
    return [null, undefined];
  }
}
const median = (xs) => {
  const s = xs.filter((x) => x !== null).sort((a, b) => a - b);
  return s.length === 0 ? null : s[Math.floor(s.length / 2)];
};

const uri = pathToFileURL(file).href;
const result = { protocol, diagnostics: protocol === "tsserver" ? "geterr" : undefined, initialize: null, firstDiagnostics: null, firstCount: null, edit: [], editCounts: [], completion: null, completionItems: null, hover: null };

if (protocol === "lsp") {
  let init;
  [result.initialize, init] = await step(() =>
    lsp.request("initialize", {
      processId: process.pid,
      rootUri: pathToFileURL(projectDir).href,
      workspaceFolders: [{ uri: pathToFileURL(projectDir).href, name: "project" }],
      // typescript-language-server pushes diagnostics only to clients that declare publishDiagnostics.
      capabilities: { textDocument: { diagnostic: { dynamicRegistration: false }, publishDiagnostics: {}, completion: {}, hover: {} } },
    }),
  );
  lsp.notify("initialized", {});
  // Pull diagnostics when the server offers them, else wait for the next push after a change.
  result.diagnostics = init?.result?.capabilities?.diagnosticProvider ? "pull" : "push";
  const pushed = () =>
    waitFor((m) => m.method === "textDocument/publishDiagnostics" && m.params?.uri === uri).then((m) => m.params.diagnostics.length);
  const diagnose = (change) => {
    if (result.diagnostics === "push") {
      const next = pushed();
      change();
      return next;
    }
    change();
    return lsp.request("textDocument/diagnostic", { textDocument: { uri } }).then((r) => r.result?.items?.length);
  };
  [result.firstDiagnostics, result.firstCount] = await step(() =>
    diagnose(() => lsp.notify("textDocument/didOpen", { textDocument: { uri, languageId: "typescriptreact", version: 1, text: original } })),
  );
  for (let k = 1; k <= edits && result.firstDiagnostics !== null; k++) {
    const [ms, count] = await step(() =>
      diagnose(() => lsp.notify("textDocument/didChange", { textDocument: { uri, version: k + 1 }, contentChanges: [{ text: edited(k) }] })),
    );
    result.edit.push(ms);
    result.editCounts.push(count);
  }
  const text = edited(edits);
  await new Promise((res) => setTimeout(res, settle));
  [result.completion, result.completionItems] = await step(async () => {
    const r = await lsp.request("textDocument/completion", { textDocument: { uri }, position: { line: lastLine(text), character: 3 } });
    return (Array.isArray(r.result) ? r.result : r.result?.items)?.length;
  });
  [result.hover] = await step(() =>
    lsp.request("textDocument/hover", { textDocument: { uri }, position: { line: lastLine(text) - 1, character: 8 } }),
  );
  await step(() => lsp.request("shutdown", null));
  lsp.notify("exit", null);
} else {
  [result.initialize] = await step(() => tss.request("configure", { preferences: {} }));
  await tss.request("updateOpen", { openFiles: [{ file, fileContent: original, projectRootPath: projectDir, scriptKindName: "TSX" }] });
  [result.firstDiagnostics, result.firstCount] = await step(() => tss.geterr());
  for (let k = 1; k <= edits && result.firstDiagnostics !== null; k++) {
    const prev = k === 1 ? original : edited(k - 1);
    const end = lines(prev);
    await tss.request("updateOpen", {
      changedFiles: [{ fileName: file, textChanges: [{ start: { line: 1, offset: 1 }, end: { line: end.length, offset: end.at(-1).length + 1 }, newText: edited(k) }] }],
    });
    const [ms, count] = await step(() => tss.geterr());
    result.edit.push(ms);
    result.editCounts.push(count);
  }
  const text = edited(edits);
  [result.completion, result.completionItems] = await step(async () => {
    const r = await tss.request("completionInfo", { file, line: lastLine(text) + 1, offset: 4 });
    return r.body?.entries?.length;
  });
  [result.hover] = await step(() => tss.request("quickinfo", { file, line: lastLine(text), offset: 9 }));
}

result.editMedian = median(result.edit);
result.serverExited = exited;
if (exited) result.serverStderr = stderrTail.trim().split("\n").slice(-6).join("\n");
console.log(JSON.stringify(result));
server.kill("SIGKILL");
process.exit(0);
