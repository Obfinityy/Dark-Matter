/**
 * Per-session local memory for the Infinity AI VM Runner.
 *
 * Every hunt/control session gets an isolated directory on the USER's device
 * only — never the cloud:
 *   <vmHome>/sessions/<sessionId>/memory/
 *     notes/*.md          — agent working notes (newest N injected into prompts)
 *     findings.json       — structured findings so far
 *     transcript.jsonl    — append-only action/observation log
 *
 * Screenshots are request attachments: they are never written here.
 */
import { mkdir, readdir, readFile, writeFile, appendFile, stat } from 'node:fs/promises';
import path from 'node:path';

export function memoryDir(vmHome, sessionId) {
  return path.join(vmHome, 'sessions', sessionId, 'memory');
}

export function notesDir(vmHome, sessionId) {
  return path.join(memoryDir(vmHome, sessionId), 'notes');
}

function sanitizeName(name) {
  if (typeof name !== 'string' || name.length === 0 || name.length > 128) {
    throw new Error('note name must be a non-empty string up to 128 chars');
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) {
    throw new Error(`unsafe note name: ${name}`);
  }
  return name;
}

export async function writeNote(vmHome, sessionId, name, content) {
  const safe = sanitizeName(name);
  const dir = notesDir(vmHome, sessionId);
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, safe.endsWith('.md') ? safe : `${safe}.md`);
  await writeFile(file, String(content ?? ''), 'utf8');
  return file;
}

export async function readNote(vmHome, sessionId, name) {
  const safe = sanitizeName(name);
  const dir = notesDir(vmHome, sessionId);
  const file = path.join(dir, safe.endsWith('.md') ? safe : `${safe}.md`);
  return readFile(file, 'utf8');
}

/** Notes sorted newest-first (by mtime), for prompt injection. */
export async function listNotes(vmHome, sessionId, limit = 20) {
  const dir = notesDir(vmHome, sessionId);
  let entries;
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }
  const withTime = [];
  for (const name of entries) {
    if (!name.endsWith('.md')) continue;
    try {
      const st = await stat(path.join(dir, name));
      withTime.push({ name, mtimeMs: st.mtimeMs });
    } catch {
      // skip unreadable entries
    }
  }
  withTime.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const out = [];
  for (const { name } of withTime.slice(0, limit)) {
    out.push({ name, content: await readFile(path.join(dir, name), 'utf8') });
  }
  return out;
}

export async function appendTranscript(vmHome, sessionId, entry) {
  const dir = memoryDir(vmHome, sessionId);
  await mkdir(dir, { recursive: true });
  const record = { ts: new Date().toISOString(), ...entry };
  await appendFile(path.join(dir, 'transcript.jsonl'), JSON.stringify(record) + '\n', 'utf8');
  return record;
}

export async function readTranscript(vmHome, sessionId, limit = 500) {
  const file = path.join(memoryDir(vmHome, sessionId), 'transcript.jsonl');
  let raw;
  try {
    raw = await readFile(file, 'utf8');
  } catch {
    return [];
  }
  const lines = raw.split('\n').filter((l) => l.trim().length > 0);
  const out = [];
  for (const line of lines.slice(-limit)) {
    try {
      out.push(JSON.parse(line));
    } catch {
      // skip corrupt lines
    }
  }
  return out;
}

export async function writeFindings(vmHome, sessionId, findings) {
  const dir = memoryDir(vmHome, sessionId);
  await mkdir(dir, { recursive: true });
  const payload = { updatedAt: new Date().toISOString(), findings };
  await writeFile(path.join(dir, 'findings.json'), JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

export async function readFindings(vmHome, sessionId) {
  const file = path.join(memoryDir(vmHome, sessionId), 'findings.json');
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return { updatedAt: null, findings: [] };
  }
}
