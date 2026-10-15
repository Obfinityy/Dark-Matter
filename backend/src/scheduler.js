// Dark Matter — Smart task scheduler for hunts.
//
// Human hunters don't wait idle. If a tool takes 1 hour, they:
// 1. Start the tool
// 2. Set a timer
// 3. Do other work (manual testing, code review, etc.)
// 4. Come back when the timer fires
//
// This module implements that: schedule a task with an estimated duration,
// the agent works on other things, and gets notified when time's up.

const timers = new Map(); // huntId -> [{id, label, fireAt, callback}]

/**
 * Schedule a task to complete after `minutes`.
 * The agent can do other work; when the timer fires, `onFire` is called.
 *
 * @param {string} huntId
 * @param {string} label - e.g. "nuclei scan", "subdomain enum"
 * @param {number} minutes - estimated duration
 * @param {Function} onFire - callback when timer fires
 * @returns {string} timer ID
 */
export function scheduleTask(huntId, label, minutes, onFire) {
  const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const fireAt = Date.now() + minutes * 60 * 1000;

  const timer = setTimeout(async () => {
    removeTimer(huntId, id);
    try {
      await onFire();
    } catch (err) {
      console.error(`[scheduler] Timer ${id} (${label}) callback failed:`, err.message);
    }
  }, minutes * 60 * 1000);

  // Don't keep the process alive just for this timer
  if (timer.unref) timer.unref();

  if (!timers.has(huntId)) timers.set(huntId, []);
  timers.get(huntId).push({ id, label, fireAt, timer });

  console.log(`[scheduler] Hunt ${huntId}: scheduled "${label}" for ${minutes}min (fires ${new Date(fireAt).toISOString()})`);
  return id;
}

/**
 * Cancel a scheduled task.
 */
export function cancelTask(huntId, timerId) {
  return removeTimer(huntId, timerId);
}

function removeTimer(huntId, timerId) {
  const list = timers.get(huntId);
  if (!list) return false;
  const idx = list.findIndex((t) => t.id === timerId);
  if (idx === -1) return false;
  clearTimeout(list[idx].timer);
  list.splice(idx, 1);
  if (list.length === 0) timers.delete(huntId);
  return true;
}

/**
 * Get all pending timers for a hunt.
 */
export function getPendingTasks(huntId) {
  const list = timers.get(huntId) || [];
  return list.map((t) => ({
    id: t.id,
    label: t.label,
    fireAt: new Date(t.fireAt).toISOString(),
    minutesLeft: Math.max(0, Math.round((t.fireAt - Date.now()) / 60000)),
  }));
}

/**
 * Cancel all timers for a hunt (on stop).
 */
export function clearHuntTimers(huntId) {
  const list = timers.get(huntId) || [];
  for (const t of list) clearTimeout(t.timer);
  timers.delete(huntId);
  console.log(`[scheduler] Hunt ${huntId}: cleared ${list.length} timers`);
}
