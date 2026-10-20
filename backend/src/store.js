// Local persistence layer — file-based, no database required.
// Layout under config.dataDir:
//   plugin-keys.json        { providerId: { encrypted: {...}, meta: {...}, updatedAt } }
//   model-downloads.json    { jobId: { modelId, status, ... } }
//   hunts/<huntId>/events.jsonl   cached hunt events (powers WS seeding + reports)
//   hunts/<huntId>/meta.json       basic hunt metadata cache

import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { scheduleEpisodeFlush } from './episodeStore.js';

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

// ---- Users (auth) ------------------------------------------------------------

export function readUsers() {
  return readJson(path.join(dataDir(), 'users.json'), {});
}

export function writeUsers(obj) {
  writeJsonAtomic(path.join(dataDir(), 'users.json'), obj);
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
  // Job 6 stage 1: mirror the event into the SQLite episode ledger.
  // Coalesced + deferred + fully isolated — can never break the write path.
  try {
    scheduleEpisodeFlush(huntId);
  } catch {
    // ledger is best-effort; events.jsonl remains the source of truth
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

/** List all hunt metadata (for per-user filtering by the caller). */
export function listHuntMetas() {
  const out = [];
  try {
    const dir = path.join(dataDir(), 'hunts');
    for (const name of fs.readdirSync(dir)) {
      const meta = readJson(path.join(dir, name, 'meta.json'), null);
      if (meta) out.push(meta);
    }
  } catch {
    // no hunts yet
  }
  out.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  return out;
}

// ---- Per-target shared intelligence ----------------------------------------
// Each target (e.g. "example.com") gets a unique folder under data/targets/.
// Shared intel (endpoints, technologies, findings) accumulates here across
// all hunts and all users. Private hunt data (events, user chats) stays in
// data/hunts/<hunt-id>/ — only sanitized, identity-free intel is shared.

/** Normalize a target URL/host to a safe folder name. */
export function targetFolderName(target) {
  const host = String(target || '')
    .replace(/^https?:\/\//i, '')
    .split('/')[0]
    .split(':')[0]
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100);
  return host || 'unknown-target';
}

export function targetDir(target) {
  return ensureDir(path.join(dataDir(), 'targets', targetFolderName(target)));
}

/** Read shared intel for a target (endpoints, tech stack, findings summary). */
export function readTargetIntel(target) {
  const file = path.join(targetDir(target), 'intel.json');
  return readJson(file, {
    target: targetFolderName(target),
    endpoints: [],
    technologies: [],
    findings: [],
    huntCount: 0,
    lastHuntAt: null,
    createdAt: new Date().toISOString(),
  });
}

/** Merge new intel into the shared target folder. */
export function writeTargetIntel(target, intel) {
  const dir = targetDir(target);
  const existing = readTargetIntel(target);
  const merged = {
    ...existing,
    ...intel,
    target: targetFolderName(target),
    // Append-only for arrays (dedupe by JSON)
    endpoints: [...new Set([...(existing.endpoints || []), ...((intel && intel.endpoints) || [])].map(JSON.stringify))].map(JSON.parse),
    technologies: [...new Set([...(existing.technologies || []), ...((intel && intel.technologies) || [])])],
    findings: [...(existing.findings || []), ...((intel && intel.findings) || [])],
    huntCount: (existing.huntCount || 0) + 1,
    lastHuntAt: new Date().toISOString(),
  };
  writeJsonAtomic(path.join(dir, 'intel.json'), merged);
  return merged;
}

/** Record that a hunt targeted this target (for "already processing" detection). */
export function recordTargetHunt(target, huntId, userId) {
  try {
    const file = path.join(targetDir(target), 'hunts.jsonl');
    fs.appendFileSync(file, JSON.stringify({
      huntId, userId, startedAt: new Date().toISOString(),
    }) + '\n');
  } catch { /* best-effort */ }
}

/** Check if a target is currently being hunted (for shared frontend). */
export function isTargetBeingHunted(target) {
  const activeHunts = listHuntMetas().filter((h) =>
    ['running', 'paused'].includes(h.state) &&
    targetFolderName(h.target) === targetFolderName(target)
  );
  return activeHunts.length > 0 ? activeHunts[0] : null;
}

// ---- Hunt queue ------------------------------------------------------------
// One hunt runs at a time. Additional requests go into a FIFO queue with
// admin-settable priority. When the active hunt finishes/stops, the next
// queued hunt auto-starts.

export function readQueue() {
  return readJson(path.join(dataDir(), 'hunt-queue.json'), []);
}

export function writeQueue(queue) {
  writeJsonAtomic(path.join(dataDir(), 'hunt-queue.json'), queue);
}

/** Add a hunt request to the queue. Returns {position, queueId}. */
export function enqueueHunt({ userId, username, target, scope, mode }) {
  const queue = readQueue();
  const queueId = 'q_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const entry = {
    queueId,
    userId,
    username: username || 'unknown',
    target,
    scope: scope || null,
    mode: mode || 'normal',
    priority: 0, // admin can raise (higher = sooner)
    status: 'queued',
    createdAt: new Date().toISOString(),
  };
  queue.push(entry);
  writeQueue(queue);
  // Position among queued (not started) entries, sorted by priority then FIFO
  const sorted = [...queue]
    .filter((e) => e.status === 'queued')
    .sort((a, b) => (b.priority - a.priority) || (a.createdAt < b.createdAt ? -1 : 1));
  const position = sorted.findIndex((e) => e.queueId === queueId) + 1;
  return { queueId, position, total: sorted.length };
}

/** Get next hunt from queue (highest priority, then oldest). */
export function dequeueNextHunt() {
  const queue = readQueue();
  const queued = queue
    .filter((e) => e.status === 'queued')
    .sort((a, b) => (b.priority - a.priority) || (a.createdAt < b.createdAt ? -1 : 1));
  if (!queued.length) return null;
  const next = queued[0];
  // Mark as started (caller will create the actual hunt)
  const idx = queue.findIndex((e) => e.queueId === next.queueId);
  if (idx >= 0) {
    queue[idx].status = 'started';
    queue[idx].startedAt = new Date().toISOString();
    writeQueue(queue);
  }
  return next;
}

/** Remove a queue entry (user cancelled or admin removed). */
export function removeFromQueue(queueId, userId, isAdmin) {
  const queue = readQueue();
  const idx = queue.findIndex((e) => e.queueId === queueId);
  if (idx < 0) return false;
  // Users can only remove their own; admin can remove any
  if (!isAdmin && queue[idx].userId !== userId) return false;
  queue.splice(idx, 1);
  writeQueue(queue);
  return true;
}

/** Admin: set priority for a queue entry. */
export function setQueuePriority(queueId, priority) {
  const queue = readQueue();
  const idx = queue.findIndex((e) => e.queueId === queueId);
  if (idx < 0) return false;
  queue[idx].priority = Math.max(0, Math.min(100, parseInt(priority, 10) || 0));
  writeQueue(queue);
  return true;
}

/** Get user's position in queue. */
export function getQueuePosition(userId) {
  const queue = readQueue();
  const sorted = queue
    .filter((e) => e.status === 'queued')
    .sort((a, b) => (b.priority - a.priority) || (a.createdAt < b.createdAt ? -1 : 1));
  const idx = sorted.findIndex((e) => e.userId === userId);
  return idx >= 0 ? { position: idx + 1, total: sorted.length, entry: sorted[idx] } : null;
}
