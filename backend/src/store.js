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

// ---- Guarded checkpoint writes --------------------------------------------
// FIX (21 Oct 2026, lane B): the pause checkpoint-race. writeHuntMeta
// REPLACES meta.json wholesale, and the hunt loop's writers used it in two
// racy ways while an iteration was in flight:
//   1. The per-iteration checkpoint re-read the meta but then forced
//      state:'running' over whatever was persisted. An owner's pause
//      (state:'paused' + paused:true, written by the pause route during
//      the in-flight iteration) flipped back to state:'running' at the
//      next iteration boundary — the hunt LOOKED running again, and after
//      any backend restart the boot reconciler treated it as an
//      interrupted 'running' hunt, cleared the pause flags and relaunched
//      the loop. The pause did not hold (observed live on
//      h_bench_d69e5746, 20 Oct 2026 ~19:55Z).
//   2. Mid-iteration writers spread a snapshot read before long awaited
//      LLM/tool work and wrote the whole stale object back, wiping any
//      field set in the meantime.
// writeHuntMetaCheckpoint(huntId, patch) is the loop-side writer. It
// merges `patch` over the meta AS IT EXISTS AT WRITE TIME (never over a
// caller's stale snapshot), and if the persisted meta is in an
// owner-held state (paused/stopped — by state or by flag), the hold
// fields (state, paused, stopped, pausedReason) are preserved from the
// persisted meta no matter what the patch says; progress fields in the
// patch (iteration, checkpointAt, humanLoop totals, ...) are still
// recorded. Lifecycle owners — the pause/resume/stop routes and the
// resume path — keep using plain writeHuntMeta and retain full control:
// a resume clears the hold exactly as before.
const HELD_META_STATES = new Set(['paused', 'stopped']);

/** True when a meta carries an owner-set hold (pause or stop). */
export function isHeldMeta(meta) {
  if (!meta || typeof meta !== 'object') return false;
  return HELD_META_STATES.has(meta.state) || meta.paused === true || meta.stopped === true;
}

export function writeHuntMetaCheckpoint(huntId, patch) {
  const current = readHuntMeta(huntId) || {};
  const next = { ...current, ...(patch || {}), huntId };
  if (isHeldMeta(current)) {
    // The owner-set hold wins over anything the loop wants to persist.
    // Stop is terminal, so it outranks a pause when both are present.
    if (current.stopped === true || current.state === 'stopped') next.state = 'stopped';
    else if (current.paused === true || current.state === 'paused') next.state = 'paused';
    else next.state = current.state;
    if ('paused' in current) next.paused = current.paused;
    if ('stopped' in current) next.stopped = current.stopped;
    if ('pausedReason' in current) next.pausedReason = current.pausedReason;
  }
  // INVARIANT (6 Nov 2026): a paused state always carries paused:true.
  // The circuit-breaker pause in huntAgent.js wrote {state:'paused',
  // pausedReason} without the flag, leaving hunts state=paused but
  // paused!==true (h_6e909d3c1965, h_bench_6eec511f,
  // h_parent_test_20261102). Normalise here so no loop-side writer can
  // repeat that omission — including on a legacy broken meta, where the
  // next checkpoint write repairs the missing flag.
  if (next.state === 'paused' && next.paused !== true) next.paused = true;
  // INVARIANT (6 Nov 2026): a paused state always carries a pausedReason.
  // The owner-pause routes wrote {state:'paused', paused:true} with no
  // reason, leaving h_830317bdc184 paused with pausedReason null
  // (28 Oct 2026: two reason-less paused status events, then a
  // brain_mode_parent pause that also carried no meta reason).
  // Normalise here so no loop-side writer can repeat that omission —
  // including on a legacy reason-less meta, where the next checkpoint
  // write stamps 'unknown' instead of leaving the pause unexplained.
  // Call sites still record the real trigger (user_paused,
  // budget_reached, ai_no_reply, brain_mode_parent); 'unknown' only
  // fires when none was supplied. Deliberately checkpoint-only, NOT in
  // plain writeHuntMeta: the resume path clears pausedReason via
  // writeHuntMeta while state is momentarily still 'paused'
  // (huntAgent.js resumeInterruptedHunt), and stamping 'unknown'
  // there would make isPaused() treat the resumed hunt as paused.
  if (next.state === 'paused' && !next.pausedReason) next.pausedReason = 'unknown';
  writeHuntMeta(huntId, next);
  return next;
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
  // ORIGIN-KEYED (zero-genuine lane): the folder names the target's
  // ORIGIN, not just its host. 172.17.0.1 serves DVWA on :3100 AND
  // Juice Shop on :3000 — keying by host alone merged Juice Shop's
  // /rest/* endpoints into the DVWA hunt's recon, and the brain
  // modelled (and probed) the wrong app. A non-default port joins
  // the folder name; default ports (80/443) keep the old name, so
  // existing plain-host folders are unaffected.
  const hostport = String(target || '')
    .replace(/^https?:\/\//i, '')
    .split('/')[0]
    .toLowerCase();
  const [host, port] = hostport.split(':');
  const portSuffix = port && port !== '80' && port !== '443' ? `-${port}` : '';
  const name = `${host || 'unknown-target'}${portSuffix}`
    .replace(/[^a-z0-9.-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100);
  return name || 'unknown-target';
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
// Up to MAX_CONCURRENT_HUNTS hunts run at once (env, default 3 — see
// huntConcurrencyCap). Additional requests go into a FIFO queue with
// admin-settable priority. When a running hunt finishes/stops and a slot
// is free, the next queued hunt auto-starts.

export const DEFAULT_MAX_CONCURRENT_HUNTS = 3;

/**
 * Concurrency cap for simultaneously running hunts, from the
 * MAX_CONCURRENT_HUNTS env var (parsed fresh on every call, so an ops
 * .env change takes effect on restart). Missing, non-numeric, or
 * non-positive values fall back to the default of 3.
 */
export function huntConcurrencyCap(env = process.env) {
  const n = Number.parseInt(String((env || {}).MAX_CONCURRENT_HUNTS ?? ''), 10);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_MAX_CONCURRENT_HUNTS;
}

/**
 * Count hunts in state 'running'. Paused/stopped/finished hunts NEVER
 * count (20 Oct 2026: a paused hunt is dormant by the owner's explicit
 * order — counting it as active made every new target queue forever
 * behind hunts nobody intended to run). Pass a metas list for a pure
 * count; defaults to the on-disk metas.
 */
export function countRunningHunts(metas = listHuntMetas()) {
  return (metas || []).filter((h) => h && h.state === 'running').length;
}

/**
 * The queue decision, in ONE place for both call sites (POST /hunts and
 * the hunt-end queue drain in huntAgent.js): true when the running-hunt
 * cap is reached and a new hunt must queue instead of starting.
 */
export function huntQueueFull(metas = listHuntMetas(), env = process.env) {
  return countRunningHunts(metas) >= huntConcurrencyCap(env);
}

export function readQueue() {
  return readJson(path.join(dataDir(), 'hunt-queue.json'), []);
}

export function writeQueue(queue) {
  writeJsonAtomic(path.join(dataDir(), 'hunt-queue.json'), queue);
}

/** Add a hunt request to the queue. Returns {position, queueId}.
 *
 * QUEUE LANE (5 Nov 2026, queue-drain fix): the entry now carries the
 * hunt's lane — brainMode ('scanner' | 'ai') and scanDepth ('quick' |
 * 'standard' | 'deep') — so a drained entry restarts in the lane the
 * user asked for. Before this fix enqueueHunt stored only
 * {userId, username, target, scope, mode}, so a drained scanner
 * re-run would have restarted in the wrong lane. Normalization mirrors
 * normalizeHuntCreate in routes/hunts.js ('scanner' stays scanner,
 * anything else is 'ai'; scanDepth quick/deep, else 'standard'). */
export function enqueueHunt({ userId, username, target, scope, mode, brainMode, scanDepth }) {
  const queue = readQueue();
  const queueId = 'q_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const entry = {
    queueId,
    userId,
    username: username || 'unknown',
    target,
    scope: scope || null,
    mode: mode || 'normal',
    brainMode: brainMode === 'scanner' ? 'scanner' : 'ai',
    scanDepth:
      scanDepth === 'quick' || scanDepth === 'deep' ? scanDepth : 'standard',
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

/**
 * Put a dequeued entry back in the queue after its hunt failed to start
 * (5 Nov 2026, queue-drain fix). Without this, dequeueNextHunt's
 * 'started' mark is a one-way door: a creation failure silently loses
 * the request — the user sees "queued #1" and nothing ever starts.
 * Retried at most MAX_QUEUE_ATTEMPTS times; after that the entry is
 * marked 'failed' (with the error) instead of looping forever. Returns
 * the entry's new status ('queued' | 'failed') or false when the entry
 * is gone.
 */
export const MAX_QUEUE_ATTEMPTS = 3;

export function requeueHunt(queueId, error) {
  const queue = readQueue();
  const idx = queue.findIndex((e) => e.queueId === queueId);
  if (idx < 0) return false;
  const entry = queue[idx];
  const attempts = (Number(entry.attempts) || 0) + 1;
  entry.attempts = attempts;
  entry.lastError = (error && error.message) || String(error || 'unknown error');
  if (attempts >= MAX_QUEUE_ATTEMPTS) {
    entry.status = 'failed';
    entry.failedAt = new Date().toISOString();
  } else {
    entry.status = 'queued';
    delete entry.startedAt;
  }
  writeQueue(queue);
  return entry.status;
}

/**
 * Mark a drained entry consumed (6 Nov 2026, queue-hygiene fix).
 *
 * ROOT CAUSE: dequeueNextHunt marks an entry 'started', drainQueue then
 * creates the hunt — but NOTHING ever wrote the huntId back onto the
 * entry or moved it out of 'started'. Every successfully drained entry
 * sat in 'started' forever with no huntId (the 3 stale entries on EC2:
 * q_mw3ipfqa08bfz / q_mw4r2892nu7ia / q_mw4r289fbw1dm, whose hunts all
 * finished). drainQueue calls this right after createHuntFromQueue
 * succeeds, so a consumed entry reaches the terminal 'completed' state
 * with its huntId recorded. Returns false when the entry is gone (user
 * cancelled meanwhile) or is no longer 'started' — never clobbers an
 * entry another path already requeued.
 */
export function completeQueueHunt(queueId, huntId) {
  const queue = readQueue();
  const idx = queue.findIndex((e) => e.queueId === queueId);
  if (idx < 0) return false;
  const entry = queue[idx];
  if (entry.status !== 'started') return false;
  entry.status = 'completed';
  if (huntId) entry.huntId = huntId;
  entry.completedAt = new Date().toISOString();
  writeQueue(queue);
  return true;
}

/**
 * A 'started' entry younger than this is an in-flight drain — the hunt
 * is created moments after dequeueNextHunt marks the entry, so the
 * reconciler must not touch it. Only entries older than the grace are
 * stale enough to resolve.
 */
export const QUEUE_STALE_STARTED_GRACE_MS = 5 * 60 * 1000;

/**
 * A hunt created by a drain is minted within seconds of the entry's
 * startedAt (live evidence: 0.008–0.3s). A hunt created in this window
 * after startedAt, for the same user and target, is the entry's hunt.
 */
export const QUEUE_STARTED_HUNT_MATCH_WINDOW_MS = 120 * 1000;

/** Hunt states that are terminal — the hunt will never run again. */
export const QUEUE_TERMINAL_HUNT_STATES = new Set(['finished', 'stopped', 'failed']);

/**
 * Find the hunt a 'started' queue entry created: same user and target,
 * hunt created in the match window after the entry started. The
 * earliest such hunt wins (two drains of the same target minutes apart
 * cannot collide inside one 120s window per entry). Brain mode must
 * match when both sides carry it; legacy entries without one skip the
 * check. Returns null when nothing matches.
 */
export function findHuntForStartedEntry(entry, metas = listHuntMetas()) {
  const startedAt = Date.parse(entry.startedAt || '') || 0;
  if (!startedAt) return null;
  const target = String(entry.target || '');
  if (!target) return null;
  let best = null;
  let bestCreated = Infinity;
  for (const meta of metas || []) {
    if (!meta) continue;
    if (entry.userId && meta.userId && meta.userId !== entry.userId) continue;
    if (String(meta.target || '') !== target) continue;
    if (entry.brainMode && meta.brainMode && meta.brainMode !== entry.brainMode) continue;
    const created = Date.parse(meta.createdAt || '') || 0;
    if (!created || created < startedAt) continue;
    if (created - startedAt > QUEUE_STARTED_HUNT_MATCH_WINDOW_MS) continue;
    if (created < bestCreated) {
      best = meta;
      bestCreated = created;
    }
  }
  return best;
}

/**
 * Resolve stale 'started' entries in a queue array (pure — no disk I/O,
 * exported for tests). drainQueue and the boot/periodic reconciler call
 * this through reconcileStaleStartedEntries().
 *
 * - Entry's hunt found and terminal → 'completed' with its huntId.
 * - Entry's hunt found and live (running/paused) or in-flight (any
 *   other state — a freshly minted hunt has no state yet) → untouched.
 * - Entry younger than the grace → untouched (in-flight drain).
 * - No hunt found → the backend died between dequeue and creation:
 *   treat it as a failed start with the SAME attempts rule as
 *   requeueHunt (back to 'queued' until MAX_QUEUE_ATTEMPTS, then
 *   'failed'). Never re-runs a hunt whose work already finished.
 * Returns { queue, resolved, changed }.
 */
export function reconcileQueueEntries(queue, metas, nowMs = Date.now()) {
  const resolved = { completed: [], requeued: [], failed: [] };
  let changed = false;
  for (const entry of queue || []) {
    if (!entry || entry.status !== 'started') continue;
    const startedAt = Date.parse(entry.startedAt || '') || 0;
    if (!startedAt || nowMs - startedAt < QUEUE_STALE_STARTED_GRACE_MS) continue;
    const hunt = findHuntForStartedEntry(entry, metas);
    if (hunt) {
      const state = String(hunt.state || '').toLowerCase();
      if (!QUEUE_TERMINAL_HUNT_STATES.has(state)) continue;
      entry.status = 'completed';
      entry.huntId = hunt.huntId || hunt.id;
      entry.completedAt = new Date().toISOString();
      changed = true;
      resolved.completed.push(entry.queueId);
      continue;
    }
    const attempts = (Number(entry.attempts) || 0) + 1;
    entry.attempts = attempts;
    entry.lastError = 'queue entry started but no hunt was created';
    if (attempts >= MAX_QUEUE_ATTEMPTS) {
      entry.status = 'failed';
      entry.failedAt = new Date().toISOString();
      resolved.failed.push(entry.queueId);
    } else {
      entry.status = 'queued';
      delete entry.startedAt;
      resolved.requeued.push(entry.queueId);
    }
    changed = true;
  }
  return { queue, resolved, changed };
}

/** Disk wrapper for reconcileQueueEntries: reads hunt-queue.json, writes it back only when something resolved. */
export function reconcileStaleStartedEntries(metas = listHuntMetas(), nowMs = Date.now()) {
  const queue = readQueue();
  const { resolved, changed } = reconcileQueueEntries(queue, metas, nowMs);
  if (changed) writeQueue(queue);
  return resolved;
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
