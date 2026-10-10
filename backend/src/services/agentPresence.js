/**
 * agentPresence.js — lightweight agent-machine presence registry.
 *
 * The headless agent poller (user's own machine / Oracle VM) POSTs a
 * heartbeat every poll tick. GET /api/v1/agent/status reads this registry so
 * the UI can show whether the user's agent machine is connected and offer
 * the one-click start action when it is not.
 *
 * In-memory and per-user: a restart clears presence, which is the honest
 * answer (no heartbeat has been seen since boot). The backend NEVER pushes
 * commands — presence is read-only signal for the UI.
 */

/** A heartbeat older than this means "not connected" (poll interval is ~30s). */
export const HEARTBEAT_TTL_MS = 120_000;

/** userId -> { pollerId, runner, lastHeartbeatAt } */
const HEARTBEATS = new Map();

function normalizeRunner(runner) {
  if (runner === 'oracle') return 'oracle';
  if (runner === 'local') return 'local';
  return null;
}

/**
 * Record a heartbeat from a user's agent poller.
 * @returns the stored presence record.
 */
export function recordHeartbeat(userId, { pollerId = null, runner = null } = {}) {
  if (!userId) throw new Error('recordHeartbeat requires a userId');
  const record = {
    pollerId: pollerId ? String(pollerId).slice(0, 64) : null,
    runner: normalizeRunner(runner),
    lastHeartbeatAt: new Date().toISOString(),
  };
  HEARTBEATS.set(String(userId), record);
  return { ...record };
}

/**
 * Presence for a user: { connected, lastHeartbeatAt, runner }.
 * `connected` is false when no heartbeat was ever seen or the last one is
 * older than HEARTBEAT_TTL_MS. `nowMs` is a test seam for the clock. Never
 * throws.
 */
export function getAgentPresence(userId, nowMs = Date.now()) {
  const record = userId ? HEARTBEATS.get(String(userId)) : null;
  if (!record) return { connected: false, lastHeartbeatAt: null, runner: null };
  const ageMs = nowMs - new Date(record.lastHeartbeatAt).getTime();
  if (!Number.isFinite(ageMs) || ageMs > HEARTBEAT_TTL_MS) {
    return { connected: false, lastHeartbeatAt: record.lastHeartbeatAt, runner: null };
  }
  return {
    connected: true,
    lastHeartbeatAt: record.lastHeartbeatAt,
    runner: record.runner,
  };
}

/** Drop a user's presence record (tests / explicit disconnect). */
export function clearAgentPresence(userId) {
  if (userId) HEARTBEATS.delete(String(userId));
}
