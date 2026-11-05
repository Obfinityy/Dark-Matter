// Manual queue drain (5 Nov 2026, drain-dedupe fix).
//
// The queue normally drains itself when a hunt finishes or fails
// (scannerHunt.js / huntAgent.js). This script is the manual escape
// hatch for the orphaned-entry case: an entry that was consumed as
// 'started' by a buggy drain (e.g. q_mw3ipfqa08bfz, which drained onto
// stopped h_071a785a82a4 on 5 Nov 2026 and never started a scan) can be
// moved back to 'queued' and drained by hand, without waiting for
// another hunt to finish.
//
// Usage (on EC2, after deploying the fix and restarting the backend):
//   cd /opt/Dark-Matter/backend
//   setsid nohup node scripts/drain-queue.mjs > /tmp/drain-queue.log 2>&1 < /dev/null &
//   tail -f /tmp/drain-queue.log
//
// The script drains exactly one entry, then WAITS for the started hunt
// to reach a terminal state (finished/failed/stopped, up to 40 min) and
// prints the outcome. The wait is load-bearing, not cosmetic: the scan
// is launched fire-and-forget by createHuntFromQueue, so if this
// process exited right after the drain, the scan would die with it.
//
// Env: run with the same environment as the backend service — in
// particular DATA_DIR when the unit sets it (default is backend/data,
// which resolves correctly when run from /opt/Dark-Matter/backend).
// Only run while no other hunt is running: the drain re-checks the
// concurrency cap first and refuses when the slot is taken.
//
// Exit code: 0 when a hunt finished, or when there was nothing to
// drain (empty queue / cap full); 1 when the hunt failed, stopped, or
// did not finish within the wait budget, or when the drain errored.
import { drainQueue } from '../src/huntCreator.js';
import { readHuntMeta, readHuntEvents } from '../src/store.js';

const POLL_MS = 20_000;
const WAIT_BUDGET_MS = 40 * 60_000;
const TERMINAL = new Set(['finished', 'failed', 'stopped']);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = () => new Date().toISOString();

function summarize(huntId) {
  const meta = readHuntMeta(huntId) || {};
  const events = readHuntEvents(huntId) || [];
  const findings = events.filter(
    (e) => e && e.type === 'finding' && e.verified === true
  );
  const phases = events.filter((e) => e && e.type === 'phase');
  const last = events[events.length - 1] || {};
  return {
    huntId,
    state: meta.state || last.state || 'unknown',
    brainMode: meta.brainMode || null,
    scanDepth: meta.scanDepth || null,
    events: events.length,
    phases: phases.length,
    verifiedFindings: findings.length,
    findingTitles: findings.map((f) => f.title || f.class || 'untitled'),
  };
}

const created = await drainQueue();
if (!created) {
  console.log(`[${stamp()}] [drain-queue] nothing drained (queue empty or cap full)`);
  process.exit(0);
}
console.log(
  `[${stamp()}] [drain-queue] drained -> hunt ${created.huntId} ` +
    `(${created.brainMode}/${created.scanDepth}${created.reused ? ', reused' : ''})`
);

const deadline = Date.now() + WAIT_BUDGET_MS;
for (;;) {
  const summary = summarize(created.huntId);
  console.log(
    `[${stamp()}] [drain-queue] ${summary.huntId}: state=${summary.state} ` +
      `events=${summary.events} phases=${summary.phases} ` +
      `verifiedFindings=${summary.verifiedFindings}`
  );
  if (TERMINAL.has(String(summary.state).toLowerCase())) {
    console.log(`[${stamp()}] [drain-queue] terminal: ${JSON.stringify(summary)}`);
    process.exit(summary.state === 'finished' ? 0 : 1);
  }
  if (Date.now() >= deadline) {
    console.log(
      `[${stamp()}] [drain-queue] timed out after 40m waiting for ${created.huntId} to finish: ${JSON.stringify(summary)}`
    );
    process.exit(1);
  }
  await sleep(POLL_MS);
}
