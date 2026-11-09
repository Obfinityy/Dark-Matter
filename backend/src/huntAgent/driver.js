// Split out of huntAgent.js by the P3 professionalization lane (split-only, no behaviour change).
// Moved verbatim; huntAgent.js re-exports the public names so callers are unchanged.

import fs from 'node:fs';
import path from 'node:path';
import { appendHuntEvent, writeHuntMeta, writeHuntMetaCheckpoint, readHuntMeta, readHuntEvents, readUsers, readTargetIntel, writeTargetIntel, huntDir, ensureHuntDir } from '../store.js';

// Active orchestrators by huntId — so assessResult can report verified
// findings to the head even though it doesn't receive it as a parameter.
export const orchestrators = new Map();

// FIX (19 Oct 2026, solver #6): Loop-driver mutex. Prevents duplicate
// runAutonomousHunt loops for the same hunt (e.g., backend auto-resume +
// watchdog resume script both firing). Duplicate drivers clobber each other's
// meta writes — this caused the pause-clobbering bug where state=paused was
// overwritten with state=running+pausedReason.
export const activeLoops = new Set();

// FIX (19 Oct 2026, elite-gap): CROSS-PROCESS driver lock. activeLoops is a
// per-process Set, but the benchmark-watchdog spawns bench_resume.mjs as a
// SEPARATE node process that imports this module fresh — its own empty
// activeLoops lets it start a second driver for the same hunt. Two drivers
// then interleave: one's injected plans (e.g. chain-pursuit tests unshifted to
// the front) get stranded while the other executes its own stale plans.
// Observed live on h_bench_d69e5746: "Chain pursuit tests injected" fired,
// but the execution phase ran [SQLi, NoSQLi, price-medium] with zero
// chain-test execution events — impossible in a single driver invocation
// (unshift puts chain tests at plans[0..1], slice(0,3) must include them),
// and events.jsonl appends are synchronous so the order is trustworthy.
// The lock file <huntDir>/driver.lock { pid, startedAt, heartbeatAt } is the
// cross-process mutex every spawner goes through (backend reconciler,
// watchdog scripts, routes all funnel into runAutonomousHunt).
const DRIVER_LOCK_STALE_MS = 90 * 60 * 1000; // steal only if heartbeat older

export const DRIVER_LOCK_BEAT_MS = 5 * 60 * 1000; // heartbeat tick while driving

function driverLockPath(huntId) {
  return path.join(huntDir(huntId), 'driver.lock');
}

function lockPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// Returns { ok:true } when we hold the lock, { ok:false, reason } otherwise.
// Exported for the driver-lock tests (huntAgent.driverLock.test.js) —
// production callers go through runAutonomousHunt.
export function tryAcquireDriverLock(huntId) {
  ensureHuntDir(huntId);
  const lp = driverLockPath(huntId);
  const now = Date.now();
  const claim = { pid: process.pid, startedAt: new Date(now).toISOString(), heartbeatAt: now };
  const writeExclusive = () => {
    try {
      fs.writeFileSync(lp, JSON.stringify(claim), { flag: 'wx' });
      return true;
    } catch {
      return false; // someone else won the race
    }
  };
  let existing = null;
  try {
    existing = JSON.parse(fs.readFileSync(lp, 'utf8'));
  } catch {
    /* no lock file or corrupt — treat as free */
  }
  if (!existing || typeof existing !== 'object') {
    // FIX (25 Oct 2026 — Infomaniak hunt stalled ~2h at iter 74): a
    // 0-byte / corrupt driver.lock is a PERMANENT poison pill without
    // this unlink. The comment above says "treat as free", but
    // writeExclusive() uses flag 'wx', which FAILS with EEXIST when the
    // file already exists — even an empty one. So the acquire always
    // lost with 'lost race for fresh lock' (125 refusals live, through
    // every backend restart) while no driver was actually running.
    // Unlink first, exactly like the steal path below; if a rival
    // wins the create race in between, 'wx' still refuses honestly.
    try {
      fs.unlinkSync(lp);
    } catch {
      /* already gone */
    }
    return writeExclusive() ? { ok: true } : { ok: false, reason: 'lost race for fresh lock' };
  }
  const alive = Number.isInteger(existing.pid) && lockPidAlive(existing.pid);
  const fresh = Number.isFinite(existing.heartbeatAt) && now - existing.heartbeatAt < DRIVER_LOCK_STALE_MS;
  if (alive && fresh) {
    return { ok: false, reason: `driver pid ${existing.pid} alive, heartbeat fresh` };
  }
  // Dead pid (crashed backend) or ancient heartbeat (wedged driver) — steal
  // it. Unlink + exclusive create closes the steal race: only one contender's
  // 'wx' write succeeds.
  try {
    fs.unlinkSync(lp);
  } catch {
    /* already gone */
  }
  return writeExclusive() ? { ok: true, stole: true } : { ok: false, reason: 'lost race stealing stale lock' };
}

export function releaseDriverLock(huntId) {
  const lp = driverLockPath(huntId);
  try {
    const existing = JSON.parse(fs.readFileSync(lp, 'utf8'));
    if (existing && existing.pid === process.pid) fs.unlinkSync(lp);
  } catch {
    /* best-effort */
  }
}

export function touchDriverLock(huntId) {
  const lp = driverLockPath(huntId);
  try {
    const existing = JSON.parse(fs.readFileSync(lp, 'utf8'));
    if (existing && existing.pid === process.pid) {
      fs.writeFileSync(lp, JSON.stringify({ ...existing, heartbeatAt: Date.now() }));
    }
  } catch {
    /* best-effort */
  }
}

// Read-only driver-activity probe (solver #458): true when a loop driver is
// genuinely driving this hunt — in THIS process (activeLoops) or in another
// process holding a driver.lock whose pid is alive AND whose heartbeat is
// fresh (same liveness rule tryAcquireDriverLock uses to refuse a steal).
// Never acquires, steals, or mutates anything.
export function isDriverActive(huntId) {
  if (activeLoops.has(huntId)) return true;
  try {
    const existing = JSON.parse(fs.readFileSync(driverLockPath(huntId), 'utf8'));
    if (!existing || typeof existing !== 'object') return false;
    const alive = Number.isInteger(existing.pid) && lockPidAlive(existing.pid);
    const fresh =
      Number.isFinite(existing.heartbeatAt) && Date.now() - existing.heartbeatAt < DRIVER_LOCK_STALE_MS;
    return alive && fresh;
  } catch {
    return false;
  }
}

export function getOrchestrator(huntId) {
  return orchestrators.get(huntId) || null;
}
