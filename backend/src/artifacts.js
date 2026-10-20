// Dark Matter — FILE-BACKED ARTIFACTS (solver #459, owner order 20 Oct 2026:
// "total permanent memory + unlimited think/do").
//
// The 8B brain's context window is small, but its WORKSPACE is not. Long
// scripts, payloads, notes and tool outputs live as FILES in the hunt's
// own folder on the backend (data/hunts/<huntId>/artifacts/) — permanent,
// append-only in spirit, never truncated at write time. The prompt only
// ever carries a handle (name + size + short summary); the agent reads
// back any slice on demand via READ_ARTIFACT, exactly like a human
// opening a file they wrote earlier.
//
// Grammar (intercepted in huntAgent.executeWithEvasion beside SEARCH: /
// RECALL: / PROPOSE_PLAYBOOK:):
//   WRITE_ARTIFACT: <name>\n<content>    — create/replace an artifact
//   APPEND_ARTIFACT: <name>\n<content>   — append a chunk (long artifacts
//                                          are emitted over several calls,
//                                          each within the model's output
//                                          budget, then assembled on disk)
//   READ_ARTIFACT: <name> [start:end]    — read a char slice (default head)
//   RUN_ARTIFACT: <name>                 — copy into the hunt container and
//                                          execute by path; full output is
//                                          spilled to <name>.out and the
//                                          caller gets head/tail + handle
//
// Safety: names are basenames from a strict charset (no traversal, no
// separators); a generous per-file ceiling (16 MB) guards the disk — it
// is a storage guard, not a context cap. Nothing here touches any
// validator: artifact runs are ordinary container executions and their
// output flows through the same assessment path as any other command.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { huntDir } from './store.js';
import { summarizeToolOutput } from './toolOutput.js';

export const ARTIFACT_MAX_BYTES = 16 * 1024 * 1024;
const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/;

export function artifactsDir(huntId) {
  const dir = path.join(huntDir(huntId), 'artifacts');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Strict basename check — returns the name or null. */
export function safeArtifactName(name) {
  const n = String(name || '').trim();
  if (!NAME_RE.test(n) || n.includes('..')) return null;
  return n;
}

function artifactPath(huntId, name) {
  return path.join(artifactsDir(huntId), name);
}

export function artifactInfo(huntId, name) {
  const n = safeArtifactName(name);
  if (!n) return null;
  try {
    const st = fs.statSync(artifactPath(huntId, n));
    if (!st.isFile()) return null;
    return { name: n, bytes: st.size, path: artifactPath(huntId, n) };
  } catch {
    return null;
  }
}

export function listArtifacts(huntId) {
  try {
    return fs
      .readdirSync(artifactsDir(huntId))
      .map((name) => artifactInfo(huntId, name))
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

/** Write (replace) an artifact with the FULL content — never truncated. */
export function writeArtifact(huntId, name, content) {
  const n = safeArtifactName(name);
  if (!n) throw new Error(`unsafe artifact name: ${name}`);
  const text = String(content ?? '');
  if (Buffer.byteLength(text) > ARTIFACT_MAX_BYTES) {
    throw new Error(`artifact ${n} exceeds the ${ARTIFACT_MAX_BYTES}-byte storage ceiling`);
  }
  fs.writeFileSync(artifactPath(huntId, n), text);
  return { name: n, chars: text.length, sha256: crypto.createHash('sha256').update(text).digest('hex') };
}

/** Append a chunk to an artifact (created if absent). Returns new totals. */
export function appendArtifact(huntId, name, chunk) {
  const n = safeArtifactName(name);
  if (!n) throw new Error(`unsafe artifact name: ${name}`);
  const p = artifactPath(huntId, n);
  const existing = (() => {
    try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
  })();
  const text = existing + String(chunk ?? '');
  if (Buffer.byteLength(text) > ARTIFACT_MAX_BYTES) {
    throw new Error(`artifact ${n} exceeds the ${ARTIFACT_MAX_BYTES}-byte storage ceiling`);
  }
  fs.writeFileSync(p, text);
  return { name: n, chars: text.length, sha256: crypto.createHash('sha256').update(text).digest('hex') };
}

/** Read a char slice [start, end) of an artifact (defaults: head 4000). */
export function readArtifact(huntId, name, start = 0, end = null) {
  const n = safeArtifactName(name);
  if (!n) throw new Error(`unsafe artifact name: ${name}`);
  const text = fs.readFileSync(artifactPath(huntId, n), 'utf8');
  const s = Math.max(0, Math.min(Number(start) || 0, text.length));
  const e = end == null ? Math.min(text.length, s + 4000) : Math.max(s, Math.min(Number(end) || 0, text.length));
  return { name: n, totalChars: text.length, start: s, end: e, text: text.slice(s, e) };
}

/** Spill a large tool output to the artifact store; returns its handle. */
export function spillOutput(huntId, text) {
  const stamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const name = `output-${stamp}-${crypto.randomBytes(2).toString('hex')}.log`;
  writeArtifact(huntId, name, String(text ?? ''));
  return name;
}

const WRITE_RE = /^\s*(WRITE_ARTIFACT|APPEND_ARTIFACT):\s*(\S+)\s*\n?([\s\S]*)$/i;
const READ_RE = /^\s*READ_ARTIFACT:\s*(\S+)(?:\s+(\d+):(\d+))?\s*$/i;
const RUN_RE = /^\s*RUN_ARTIFACT:\s*(\S+)\s*$/i;

/** True when the command is an artifact pseudo-command. */
export function isArtifactCommand(command) {
  const c = String(command || '');
  return WRITE_RE.test(c) || READ_RE.test(c) || RUN_RE.test(c);
}

/**
 * Default RUN path: sync the artifact into the hunt container and execute
 * it by path there. Dynamic import keeps this module loadable in tests
 * (and on hosts) without the container layer.
 */
async function defaultRunInContainer(huntId, name) {
  const { execInHuntContainer, copyFileToHuntContainer } = await import('./huntRunner.js');
  const info = artifactInfo(huntId, name);
  if (!info) return { stdout: '', stderr: `artifact ${name} not found`, code: 1 };
  const destDir = '/tmp/dm-artifacts';
  const dest = `${destDir}/${name}`;
  const copied = await copyFileToHuntContainer(huntId, info.path, dest);
  if (!copied.ok) return { stdout: '', stderr: copied.error || 'copy into container failed', code: 1 };
  const runner = name.endsWith('.py') ? 'python3' : name.endsWith('.js') ? 'node' : 'sh';
  return execInHuntContainer(huntId, `${runner} ${dest}`, 180000, { bypassTmux: true });
}

/**
 * Handle an artifact pseudo-command. Returns null when the command is not
 * an artifact command (caller proceeds with normal execution); otherwise a
 * result shaped like the other pseudo-command results
 * ({ stdout, stderr, exitCode }). deps.run overrides the container runner
 * (tests inject a local executor).
 */
export async function handleArtifactCommand(huntId, command, deps = {}) {
  const c = String(command || '');

  const wm = WRITE_RE.exec(c);
  if (wm) {
    const [, verb, rawName, content] = wm;
    const name = safeArtifactName(rawName);
    if (!name) return { stdout: `Artifact name "${rawName}" is not allowed (letters, digits, dot, dash, underscore; no paths).`, stderr: '', exitCode: 1 };
    try {
      const r = verb.toUpperCase() === 'WRITE_ARTIFACT'
        ? writeArtifact(huntId, name, content)
        : appendArtifact(huntId, name, content);
      return {
        stdout: `Artifact ${r.name} saved in full: ${r.chars} chars (sha256 ${r.sha256.slice(0, 12)}). It is stored permanently in your hunt workspace. RUN_ARTIFACT: ${r.name} executes it; READ_ARTIFACT: ${r.name} reads it back.`,
        stderr: '',
        exitCode: 0,
      };
    } catch (err) {
      return { stdout: `Artifact write failed: ${err.message}`, stderr: '', exitCode: 1 };
    }
  }

  const rm = READ_RE.exec(c);
  if (rm) {
    const [, rawName, s, e] = rm;
    const name = safeArtifactName(rawName);
    if (!name) return { stdout: `Artifact name "${rawName}" is not allowed.`, stderr: '', exitCode: 1 };
    try {
      const r = readArtifact(huntId, name, s ? Number(s) : 0, e ? Number(e) : null);
      const more = r.end < r.totalChars ? ` More remains — READ_ARTIFACT: ${r.name} ${r.end}:${r.end + 4000} continues.` : '';
      return {
        stdout: `[artifact ${r.name} — chars ${r.start}:${r.end} of ${r.totalChars}]${more}\n${r.text}`,
        stderr: '',
        exitCode: 0,
      };
    } catch (err) {
      return { stdout: `Artifact read failed: ${err.message}`, stderr: '', exitCode: 1 };
    }
  }

  const run = RUN_RE.exec(c);
  if (run) {
    const name = safeArtifactName(run[1]);
    if (!name) return { stdout: `Artifact name "${run[1]}" is not allowed.`, stderr: '', exitCode: 1 };
    if (!artifactInfo(huntId, name)) {
      return { stdout: `Artifact ${name} does not exist. WRITE_ARTIFACT it first (APPEND_ARTIFACT adds chunks).`, stderr: '', exitCode: 1 };
    }
    const exec = deps.run || defaultRunInContainer;
    const res = await exec(huntId, name);
    const full = `${res.stdout || ''}${res.stderr ? `\n[stderr]\n${res.stderr}` : ''}`;
    let outName = null;
    try { outName = spillOutput(huntId, full); } catch { /* spill is best-effort */ }
    const env = summarizeToolOutput(full);
    return {
      stdout: `${env.text}\n[exit code ${res.code ?? 0}${outName ? `; full output (${full.length} chars) saved as artifact ${outName} — READ_ARTIFACT: ${outName} reads any slice` : ''}]`,
      stderr: '',
      exitCode: res.code ?? 0,
    };
  }

  return null;
}
