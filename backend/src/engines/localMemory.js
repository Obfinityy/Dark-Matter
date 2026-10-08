/**
 * localMemory.js — Infinite local file-based memory.
 *
 * Why local, not MongoDB:
 *  - MongoDB Atlas free tier is limited (512MB). Hunts generate GBs.
 *  - User's desktop has infinite (disk) storage.
 *  - Works offline. No network dependency.
 *  - User OWNS their data — it's on their machine.
 *
 * Layout:
 *   <dataDir>/memory/
 *     hunts/<huntId>/hunt.json       — hunt metadata
 *     hunts/<huntId>/findings.json   — findings
 *     hunts/<huntId>/activity.jsonl  — activity log
 *     learnings.json                 — learning engine store
 *     fps.json                       — false-positive patterns
 *     preferences.json               — user preferences
 *
 * Export: ZIP the entire memory/ dir → user downloads it.
 * Import: Upload ZIP → extract → memory restored on new device.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function dataDir() {
  return process.env.DM_DATA_DIR || path.join(os.homedir(), '.darkmatter');
}

function memoryDir() {
  return path.join(dataDir(), 'memory');
}

export { memoryDir };

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Write JSON atomically (write tmp + rename). */
function writeJson(file, data) {
  ensureDir(path.dirname(file));
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

/** Save a hunt's full state locally. */
export function saveHunt(huntId, data = {}) {
  const dir = ensureDir(path.join(memoryDir(), 'hunts', huntId));
  writeJson(path.join(dir, 'hunt.json'), {
    ...data,
    savedAt: new Date().toISOString(),
  });
  return dir;
}

/** Load a hunt's state. Returns null if not found. */
export function loadHunt(huntId) {
  const file = path.join(memoryDir(), 'hunts', huntId, 'hunt.json');
  return readJson(file, null);
}

/** List all local hunts (newest first). */
export function listHunts() {
  const dir = path.join(memoryDir(), 'hunts');
  try {
    return fs
      .readdirSync(dir)
      .map(id => ({ id, ...readJson(path.join(dir, id, 'hunt.json'), {}) }))
      .sort((a, b) => String(b.savedAt || '').localeCompare(String(a.savedAt || '')));
  } catch {
    return [];
  }
}

/** Append to a hunt's activity log (JSONL). */
export function appendActivity(huntId, entry = {}) {
  const dir = ensureDir(path.join(memoryDir(), 'hunts', huntId));
  const file = path.join(dir, 'activity.jsonl');
  fs.appendFileSync(
    file,
    JSON.stringify({ ...entry, at: new Date().toISOString() }) + '\n',
    'utf8'
  );
}

/** Learning store (persistent across hunts). */
export function loadLearnings() {
  return readJson(path.join(memoryDir(), 'learnings.json'), []);
}
export function saveLearnings(store = []) {
  writeJson(path.join(memoryDir(), 'learnings.json'), store);
}

/** False-positive patterns. */
export function loadFPs() {
  return readJson(path.join(memoryDir(), 'fps.json'), []);
}
export function saveFPs(store = []) {
  writeJson(path.join(memoryDir(), 'fps.json'), store);
}

/** User preferences. */
export function loadPreferences() {
  return readJson(path.join(memoryDir(), 'preferences.json'), {});
}
export function savePreferences(prefs = {}) {
  writeJson(path.join(memoryDir(), 'preferences.json'), prefs);
}

/** Get memory stats for the UI. */
export function memoryStats() {
  const dir = memoryDir();
  let totalBytes = 0;
  let fileCount = 0;
  const walk = d => {
    try {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else {
          try {
            totalBytes += fs.statSync(p).size;
            fileCount++;
          } catch {
            /* ignore */
          }
        }
      }
    } catch {
      /* dir doesn't exist */
    }
  };
  walk(dir);
  return {
    dir,
    hunts: listHunts().length,
    fileCount,
    totalMB: Math.round((totalBytes / 1024 / 1024) * 100) / 100,
  };
}

export const LOCAL_MEMORY = {
  dataDir,
  memoryDir,
  saveHunt,
  loadHunt,
  listHunts,
  appendActivity,
  loadLearnings,
  saveLearnings,
  loadFPs,
  saveFPs,
  loadPreferences,
  savePreferences,
  memoryStats,
};

export default LOCAL_MEMORY;
