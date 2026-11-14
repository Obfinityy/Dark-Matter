// Self (Hunter Self) mode — run persistence.
//
// One directory per run under <dataDir>/self-runs/<runId>/run.json,
// mirroring the hunts store pattern (backend/data/hunts/<id>/meta.json).
// Checklist state must survive backend restarts, so every mutation
// writes through here atomically (tmp file + rename) before the route
// replies. No AI/brain state is stored here — only the run, its
// per-check results, and the AI-consent flag.

import fs from 'node:fs';
import path from 'node:path';
import { dataDir } from '../store.js';

let selfRunsDirOverride = null;

// Tests point persistence at a temp dir without touching live data.
export function setSelfRunsDir(dir) {
  selfRunsDirOverride = dir || null;
}

export function selfRunsDir() {
  const dir = selfRunsDirOverride || path.join(dataDir(), 'self-runs');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function selfRunDir(runId) {
  return path.join(selfRunsDir(), String(runId));
}

export function selfRunPath(runId) {
  return path.join(selfRunDir(runId), 'run.json');
}

export function readSelfRun(runId) {
  try {
    return JSON.parse(fs.readFileSync(selfRunPath(runId), 'utf8'));
  } catch {
    return null;
  }
}

export function writeSelfRun(run) {
  const file = selfRunPath(run.id);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(run, null, 2));
  fs.renameSync(tmp, file);
  return run;
}

export function listSelfRuns() {
  try {
    return fs.readdirSync(selfRunsDir())
      .filter((name) => fs.existsSync(path.join(selfRunsDir(), name, 'run.json')))
      .map((name) => readSelfRun(name))
      .filter(Boolean)
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  } catch {
    return [];
  }
}
