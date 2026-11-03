// Dark Matter rule-based scanner — subprocess runner + JSONL parsing.
// Used to drive pre-built tools (nuclei, sqlmap, dalfox) deterministically.
import { execFile } from 'node:child_process';

export function runCmd(file, args, { timeoutMs = 120000, cwd = undefined } = {}) {
  return new Promise((resolve) => {
    execFile(
      file,
      args,
      { timeout: timeoutMs, cwd, maxBuffer: 64 * 1024 * 1024 },
      (err, stdout, stderr) => {
        resolve({
          ok: !err,
          code: err && typeof err.code === 'number' ? err.code : 0,
          stdout: String(stdout || ''),
          stderr: String(stderr || '').slice(0, 4000),
          timedOut: Boolean(err && err.killed),
        });
      }
    );
  });
}

export function parseJsonl(text) {
  const out = [];
  for (const line of String(text || '').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try {
      out.push(JSON.parse(t));
    } catch {
      // skip malformed lines — a tool's stderr can leak into stdout
    }
  }
  return out;
}
