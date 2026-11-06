// Hunt creation from a queued entry (5 Nov 2026, queue-drain fix).
//
// POST /api/v1/hunts queues a request when the concurrency cap is
// reached — but until this module existed, NOTHING could start it:
// huntAgent.js dynamically imported './huntCreator.js' with a catch
// fallback ("huntCreator not yet implemented") and only logged the
// entry for a manual start, and the scanner lane never drained the
// queue at all. Queued re-runs sat in hunt-queue.json forever.
//
// createHuntFromQueue mirrors the POST /hunts creation path (same meta
// shape, same lane launch) minus the HTTP-only gates — authorization,
// SSRF validation and the credits check already ran at enqueue time,
// before the request was queued. Scope is built BEFORE the engine hunt
// is minted (unlike POST /hunts, which mints first and cleans up on
// scope failure) so a scope failure here can never leak an engine-side
// hunt.
//
// DEDUPE DIFFERS from POST /hunts on purpose (5 Nov 2026, drain-dedupe
// fix): POST returns ANY matching hunt to the New Hunt dialog, which
// offers "Open existing" vs "Start new hunt anyway". The queue has no
// dialog — a queued re-run must actually RUN. So the drain reuses a
// match only when it is paused (resume from checkpoint) or running
// (already live). A stopped/finished/failed match is ignored and a
// fresh hunt is created: reusing it would consume the queue entry
// without ever starting a scan — exactly what happened to
// q_mw3ipfqa08bfz, which drained onto stopped h_071a785a82a4 (a stopped
// hunt cannot resume by design) and nothing ran.
//
// drainQueue is the shared drain both lanes call when a hunt reaches a
// terminal state: scannerHunt.js on finish/failure, huntAgent.js on
// finish/failure. One call starts at most one hunt (each finish frees
// exactly one slot), and the MAX_CONCURRENT_HUNTS cap is re-checked
// first, so the cap can never be overshot by a drain.
//
// `deps` is a test seam only (same pattern as runScan's
// opts.nucleiRunner): production callers never pass it. Every heavy
// dependency is dynamically imported, so importing this module never
// pulls the HTTP/engine/AI stacks into the hunt loops.
import { randomBytes } from 'node:crypto';
import {
  writeHuntMeta,
  appendHuntEvent,
  readHuntMeta,
  listHuntMetas,
} from './store.js';

/**
 * Lane of a queued entry. Explicit 'scanner' / 'ai' are honoured.
 * Entries enqueued before 5 Nov 2026 carry NO brainMode (it was not
 * persisted) — there is nothing to honour, so they drain as 'scanner',
 * not 'ai': auto-starting an AI hunt could burn Meta API spend under
 * the owner's zero-dollar order (3 Nov 2026), while the scanner lane
 * is $0 by design. The only legacy entry in existence
 * (q_mw3ipfqa08bfz) IS a scanner re-run, so this default is also
 * correct for it. New entries always carry brainMode (the POST handler
 * passes it to enqueueHunt), so this branch only ever fires for legacy
 * entries.
 */
export function normalizeQueueBrainMode(value) {
  if (value === 'scanner') return 'scanner';
  if (value === 'ai') return 'ai';
  return 'scanner';
}

/** Scan depth of a queued entry: quick/deep, anything else 'standard'. */
export function normalizeQueueScanDepth(value) {
  return value === 'quick' || value === 'deep' ? value : 'standard';
}

/**
 * Create a hunt from a queue entry, the way POST /hunts would have.
 * Returns { huntId, brainMode, scanDepth, reused } — reused only when
 * the (user, target, brainMode) dedupe matched a paused hunt (resumed
 * from its checkpoint) or a running one (already live). A
 * stopped/finished/failed match is ignored and a fresh hunt is created
 * instead — reusing it would burn the queue entry without starting a
 * scan. Throws when the hunt cannot be created (the caller —
 * drainQueue — requeues the entry so the request is not lost).
 */
export async function createHuntFromQueue(entry, deps = {}) {
  const target = String((entry && entry.target) || '').trim();
  if (!target) throw new Error('queue entry has no target');
  const userId = entry && entry.userId;
  if (!userId) throw new Error('queue entry has no userId');
  const brainMode = normalizeQueueBrainMode(entry.brainMode);
  const scanDepth = normalizeQueueScanDepth(entry.scanDepth);
  const mode = String(entry.mode || 'normal');
  const scope = entry.scope ?? null;

  // DEDUPE: only a paused or running match is reusable. A paused match
  // is resumed from its checkpoint; a running match is already live, so
  // starting a duplicate would waste the slot. Any other state
  // (stopped/finished/failed/...) is terminal — it cannot resume, so
  // the match is ignored and a fresh hunt is created below.
  const pickExistingHunt =
    deps.pickExistingHunt ||
    (await import('./routes/hunts.js')).pickExistingHunt;
  const existing = pickExistingHunt(listHuntMetas(), userId, target, brainMode);
  if (existing) {
    const existingId = existing.huntId || existing.id;
    const state = String(existing.state || existing.status || 'unknown').toLowerCase();
    if (state === 'paused' || state === 'running') {
      let resumed = false;
      if (state === 'paused') {
        // Mirror POST /hunts dedupe-resume: flip the meta flags, then
        // continue the loop from its checkpoint.
        try {
          const m0 = readHuntMeta(existingId) || existing;
          writeHuntMeta(existingId, {
            ...m0,
            huntId: existingId,
            paused: false,
            stopped: false,
            state: 'running',
          });
          appendHuntEvent(existingId, {
            type: 'status',
            state: 'resumed',
            reason: 'queue_drain_dedup',
            at: new Date().toISOString(),
          });
          const resumeInterruptedHunt =
            deps.resumeInterruptedHunt ||
            (await import('./huntAgent.js')).resumeInterruptedHunt;
          resumeInterruptedHunt(existingId).catch((err) => {
            appendHuntEvent(existingId, {
              type: 'status',
              state: 'failed',
              error: err.message || String(err),
            });
          });
          resumed = true;
        } catch (err) {
          console.warn(`[queue] dedupe resume failed for ${existingId}: ${err.message}`);
        }
      }
      return { huntId: existingId, brainMode, scanDepth, reused: true, resumed };
    }
    console.log(
      `[queue] dedupe match ${existingId} is ${state}; creating a fresh hunt instead`
    );
  }

  // Scope first (fail-closed, before any engine hunt is minted).
  const parseScope =
    deps.parseScope || (await import('./scopeParser.js')).parseScope;
  const parsedScope = parseScope(target, scope);
  const buildScope =
    deps.buildScope || (await import('./scopeGuard.js')).buildScope;
  const scopeGuard = buildScope({
    target,
    scope,
    labTargets: process.env.LAB_TARGETS || '',
  });

  // Mint the hunt id (engine first, host-side fallback — same as POST).
  const engine = deps.engine || (await import('./engine.js'));
  const createEngineHuntFn = deps.createEngineHunt || engine.createEngineHunt;
  const EngineUnreachableErrorCls =
    deps.EngineUnreachableError || engine.EngineUnreachableError;
  let huntId;
  try {
    ({ huntId } = await createEngineHuntFn(target, scope));
  } catch (err) {
    if (
      !(err instanceof EngineUnreachableErrorCls) &&
      err?.name !== 'EngineUnreachableError'
    ) {
      throw err;
    }
    huntId = 'h_' + randomBytes(6).toString('hex');
  }

  const isHumanMode = mode === 'human';
  writeHuntMeta(huntId, {
    huntId,
    target,
    scope: scope || null,
    parsedScope,
    scopeGuard,
    mode,
    // Brain mode + scan depth: same fields POST /hunts writes, so the
    // frontend, the admin portal and the resume paths all see this
    // hunt exactly as if it had been created directly.
    brainMode,
    scanDepth,
    ...(isHumanMode ? { humanMode: true } : {}),
    userId,
    createdAt: new Date().toISOString(),
    authorized: true,
  });
  appendHuntEvent(huntId, { type: 'status', state: 'created', target, mode });

  if (isHumanMode) {
    try {
      const startHumanLoop =
        deps.startHumanLoop || (await import('./humanLoopDriver.js')).startHumanLoop;
      startHumanLoop(huntId);
    } catch (err) {
      console.warn(`[queue] could not enable human loop for ${huntId}: ${err.message}`);
    }
  }

  // Target intel + lane launch: async, non-blocking, same as POST.
  const understandTarget =
    deps.understandTarget || (await import('./targetIntel.js')).understandTarget;
  understandTarget(huntId, target).catch(() => {});
  if (brainMode === 'scanner') {
    const runScannerHunt =
      deps.runScannerHunt || (await import('./scannerHunt.js')).runScannerHunt;
    runScannerHunt(huntId, target, { scope, userId, scanDepth }).catch((err) => {
      appendHuntEvent(huntId, {
        type: 'status',
        state: 'failed',
        error: err.message || String(err),
      });
    });
  } else {
    const runAutonomousHunt =
      deps.runAutonomousHunt || (await import('./huntAgent.js')).runAutonomousHunt;
    runAutonomousHunt(huntId, target, mode, userId).catch((err) => {
      appendHuntEvent(huntId, {
        type: 'status',
        state: 'failed',
        error: err.message || String(err),
      });
    });
  }
  return { huntId, brainMode, scanDepth, reused: false };
}

/**
 * Start the next queued hunt if a concurrency slot is free. Returns the
 * created hunt ({ huntId, brainMode, scanDepth, reused }) or null when
 * there is nothing to start (empty queue, cap reached) or the start
 * failed — a failed start requeues the entry (up to MAX_QUEUE_ATTEMPTS)
 * so the request is never silently lost.
 */
export async function drainQueue(deps = {}) {
  try {
    const store = deps.store || (await import('./store.js'));
    // QUEUE HYGIENE (6 Nov 2026): resolve stale 'started' entries left
    // by drains that predate the huntId/completed bookkeeping — before
    // starting the next hunt, so a legacy entry is healed instead of
    // sitting in 'started' forever. Best-effort: a queue failure must
    // never break the drain itself.
    try {
      store.reconcileStaleStartedEntries();
    } catch {
      // Ignore — the drain below still runs.
    }
    if (store.huntQueueFull()) return null;
    const next = store.dequeueNextHunt();
    if (!next) return null;
    try {
      const created = await createHuntFromQueue(next, deps);
      console.log(
        `[queue] drained ${next.queueId} -> hunt ${created.huntId} (${created.brainMode}/${created.scanDepth}${created.reused ? ', reused' : ''})`
      );
      // Record the consumption (6 Nov 2026, queue-hygiene fix): the
      // entry leaves 'started' for the terminal 'completed' state with
      // its huntId. Without this, every drained entry sat in 'started'
      // forever with no huntId. Best-effort — never break the drain
      // over a queue write.
      try {
        store.completeQueueHunt(next.queueId, created.huntId);
      } catch {
        // Ignore — the hunt itself already started.
      }
      return created;
    } catch (err) {
      console.error(`[queue] auto-start failed for ${next.queueId}:`, err.message);
      try {
        store.requeueHunt(next.queueId, err);
      } catch {
        // Never break the finishing hunt's record over a queue write.
      }
      return null;
    }
  } catch (err) {
    console.error('[queue] drain check failed:', err.message);
    return null;
  }
}

export default createHuntFromQueue;
