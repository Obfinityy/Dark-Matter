// Local persistence layer — file-based, no database required.
// Layout under config.dataDir:
//   plugin-keys.json        { providerId: { encrypted: {...}, meta: {...}, updatedAt } }
//   model-downloads.json    { jobId: { modelId, status, ... } }
//   hunts/<huntId>/events.jsonl   cached hunt events (powers WS seeding + reports)
//   hunts/<huntId>/meta.json       basic hunt metadata cache

import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function dataDir() {
  return ensureDir(config.dataDir);
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(file, obj) {
  ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, file);
}

// ---- Plugin keys ---------------------------------------------------------

export function readPluginKeys() {
  return readJson(path.join(dataDir(), 'plugin-keys.json'), {});
}

export function writePluginKeys(obj) {
  writeJsonAtomic(path.join(dataDir(), 'plugin-keys.json'), obj);
}

// ---- Model download jobs --------------------------------------------------

export function readModelJobs() {
  return readJson(path.join(dataDir(), 'model-downloads.json'), {});
}

export function writeModelJobs(obj) {
  writeJsonAtomic(path.join(dataDir(), 'model-downloads.json'), obj);
}

// ---- Hunt event cache ------------------------------------------------------

export function huntDir(huntId) {
  return ensureDir(path.join(dataDir(), 'hunts', String(huntId)));
}

export function appendHuntEvent(huntId, event) {
  try {
    fs.appendFileSync(
      path.join(huntDir(huntId), 'events.jsonl'),
      JSON.stringify({ ...event, cachedAt: new Date().toISOString() }) + '\n'
    );
  } catch {
    // cache is best-effort; never break the request path
  }
}

export function readHuntEvents(huntId) {
  const file = path.join(config.dataDir, 'hunts', String(huntId), 'events.jsonl');
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const out = [];
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try {
        out.push(JSON.parse(line));
      } catch {
        // skip corrupt line
      }
    }
    return out;
  } catch {
    return [];
  }
}

export function writeHuntMeta(huntId, meta) {
  writeJsonAtomic(path.join(huntDir(huntId), 'meta.json'), meta);
}

export function readHuntMeta(huntId) {
  return readJson(path.join(config.dataDir, 'hunts', String(huntId), 'meta.json'), null);
}
