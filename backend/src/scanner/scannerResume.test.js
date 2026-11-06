// Scanner resume-across-restarts tests (6 Nov 2026, bWAPP orphan
// h_f8d776f72365).
//
// REGRESSION: a scanner hunt killed mid-flight (backend restart between
// runScan finishing and the finalize block) stayed state:'running'
// forever — the boot/periodic reconciler's resumeInterruptedHunt returns
// false for scanner hunts by design — and the `running` meta held the
// MAX_CONCURRENT_HUNTS slot so drainQueue could never start the next
// queued hunt. Worse, the findings were lost: phase events carry ONLY
// findingsCount, so no finding objects survive on disk to finalize
// from. The fix: resumeInterruptedScannerHunt re-runs the full battery
// (deterministic, $0) when it finds a `running` scanner meta with no
// live run in this process.
//
// Contained: DATA_DIR points at a fresh temp dir (set before any project
// module is imported, so config.js picks it up). No network, no docker,
// no real nuclei — global fetch is stubbed.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-scanresume-test-'));
process.env.DATA_DIR = tmp;

const { runScannerHunt, resumeInterruptedScannerHunt, isScannerRunActive } =
  await import('../scannerHunt.js');
const { readHuntMeta, readHuntEvents, writeHuntMeta, appendHuntEvent } =
  await import('../store.js');
const { DEFAULT_PHASES } = await import('../scanner/index.js');

after(() => fs.rmSync(tmp, { recursive: true, force: true }));

// A 200 HTML response with no links, forms or parameters — every phase
// that needs a target input is skipped, the rest run and pass.
globalThis.fetch = async () => ({
  ok: true,
  status: 200,
  headers: new Map([['content-type', 'text/html']]),
  text: async () => '<html><body>hello</body></html>',
});

function findingEvents(huntId) {
  return readHuntEvents(huntId).filter((e) => e && e.type === 'finding');
}

function resumedEvents(huntId) {
  return readHuntEvents(huntId).filter(
    (e) => e && e.type === 'status' && e.state === 'resumed_from_restart'
  );
}

async function waitFor(fn, timeoutMs = 15000, label = 'condition') {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (fn()) return;
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

// Seed a hunt shaped exactly like the bWAPP orphan: state 'running',
// scanner lane, 62 phase events whose findingsCounts sum to 8
// (headers 5, files 1, request-smuggling 1, tls 1), zero finding events.
// The counted phases are named explicitly instead of relying on a
// positional slice: a new phase joining DEFAULT_PHASES shifts the
// slice window, and the tls count fell out of slice(0, 62) when
// 'openapi-targets' joined the list (6 Nov 2026) — the seed read 7,
// not 8. 58 uncounted phases + the 4 counted ones = 62 events.
function seedOrphan(huntId) {
  writeHuntMeta(huntId, {
    huntId,
    target: 'http://example.com/',
    brainMode: 'scanner',
    scanDepth: 'quick',
    scope: null,
    userId: 'u1',
    state: 'running',
    scannerStartedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    authorized: true,
  });
  appendHuntEvent(huntId, { type: 'status', state: 'scanner_started' });
  const counts = { headers: 5, files: 1, 'request-smuggling': 1, tls: 1 };
  const names = [
    ...DEFAULT_PHASES.filter((n) => !Object.hasOwn(counts, n)).slice(0, 58),
    ...Object.keys(counts),
  ];
  for (const name of names) {
    appendHuntEvent(huntId, {
      type: 'phase',
      name,
      ok: true,
      findingsCount: counts[name] || 0,
    });
  }
}

test('orphan scanner hunt resumes with a full re-run and finalizes', async () => {
  // Control: a fresh run against the same stub finds F findings. The
  // orphan's re-run must recover exactly the same set — a re-run that
  // finalized with 0 findings (or a partial set) would prove the resume
  // loses findings instead of recovering them.
  const controlTeardown = [];
  await runScannerHunt('h_resume_control', 'http://example.com/', {
    scanDepth: 'quick',
    drainQueue: async () => {},
    teardownContainer: async (id) => {
      controlTeardown.push(id);
      return true;
    },
  });
  assert.equal(readHuntMeta('h_resume_control').state, 'finished');
  const controlFindings = findingEvents('h_resume_control').length;
  assert.ok(controlFindings > 0, 'control run must find something or the equivalence is vacuous');

  seedOrphan('h_resume_orphan');
  assert.equal(findingEvents('h_resume_orphan').length, 0);

  const teardownCalls = [];
  let drainCalls = 0;
  const ok = await resumeInterruptedScannerHunt('h_resume_orphan', {
    drainQueue: async () => {
      drainCalls += 1;
    },
    teardownContainer: async (id) => {
      teardownCalls.push(id);
      return true;
    },
  });
  assert.equal(ok, true);

  // The resume is fire-and-forget (the reconciler must never block on a
  // minutes-long scan) — poll for the re-run's finalize.
  await waitFor(
    () => readHuntMeta('h_resume_orphan').state === 'finished',
    15000,
    'orphan re-run to finish'
  );
  const meta = readHuntMeta('h_resume_orphan');
  assert.equal(meta.state, 'finished');
  assert.ok(meta.scannerSummary, 're-run writes scannerSummary');
  assert.equal(meta.scannerSummary.confirmed, controlFindings);

  const resumed = resumedEvents('h_resume_orphan');
  assert.equal(resumed.length, 1);
  assert.equal(resumed[0].priorPhases, 62);
  assert.equal(resumed[0].priorFindingsCount, 8);
  assert.equal(resumed[0].priorFindingEvents, 0);

  // The re-run recovers the full finding set — nothing lost, nothing
  // invented relative to a fresh scan of the same target.
  assert.equal(findingEvents('h_resume_orphan').length, controlFindings);
  assert.deepEqual(teardownCalls, ['h_resume_orphan']);
  assert.equal(drainCalls, 1);
});

test('a live scanner run is never double-started by the reconciler', async () => {
  let drainCalls = 0;
  const seams = {
    drainQueue: async () => {
      drainCalls += 1;
    },
    teardownContainer: async () => true,
  };
  // Fire-and-forget: the run registers in the active set synchronously,
  // before its first await, so the guard below is deterministic.
  const live = runScannerHunt('h_resume_live', 'http://example.com/', {
    scanDepth: 'quick',
    ...seams,
  });
  assert.equal(isScannerRunActive('h_resume_live'), true);
  const resumed = await resumeInterruptedScannerHunt('h_resume_live', seams);
  assert.equal(resumed, false);
  assert.equal(resumedEvents('h_resume_live').length, 0);
  await live;
  assert.equal(readHuntMeta('h_resume_live').state, 'finished');
  // Only the original run drained — the resume never launched a second.
  assert.equal(drainCalls, 1);
});

test('non-scanner running hunts are left to the AI reconciler', async () => {
  writeHuntMeta('h_resume_ai', {
    huntId: 'h_resume_ai',
    target: 'http://example.com/',
    brainMode: 'ai',
    state: 'running',
    createdAt: new Date().toISOString(),
  });
  const ok = await resumeInterruptedScannerHunt('h_resume_ai', {});
  assert.equal(ok, false);
  assert.equal(resumedEvents('h_resume_ai').length, 0);
  assert.equal(readHuntMeta('h_resume_ai').state, 'running');
});

test('finished, stopped and paused scanner hunts are never resumed', async () => {
  writeHuntMeta('h_resume_finished', {
    huntId: 'h_resume_finished',
    target: 'http://example.com/',
    brainMode: 'scanner',
    scanDepth: 'quick',
    state: 'finished',
    scannerFinishedAt: new Date().toISOString(),
    scannerSummary: { confirmed: 1, unconfirmed: 0, scanDepth: 'quick' },
  });
  // Stopped is an owner-held terminal state: auto-resuming it would undo
  // an explicit stop. Recovery for a stopped hunt is a fresh re-run hunt.
  writeHuntMeta('h_resume_stopped', {
    huntId: 'h_resume_stopped',
    target: 'http://example.com/',
    brainMode: 'scanner',
    scanDepth: 'quick',
    state: 'stopped',
    stopped: true,
  });
  writeHuntMeta('h_resume_paused', {
    huntId: 'h_resume_paused',
    target: 'http://example.com/',
    brainMode: 'scanner',
    scanDepth: 'quick',
    state: 'paused',
    paused: true,
  });
  for (const id of ['h_resume_finished', 'h_resume_stopped', 'h_resume_paused']) {
    const ok = await resumeInterruptedScannerHunt(id, {});
    assert.equal(ok, false, `${id} must not resume`);
    assert.equal(resumedEvents(id).length, 0, `${id} must not record a resume`);
  }
  assert.equal(readHuntMeta('h_resume_finished').state, 'finished');
  assert.equal(readHuntMeta('h_resume_stopped').state, 'stopped');
  assert.equal(readHuntMeta('h_resume_paused').state, 'paused');
});

test('a running scanner hunt with no target is failed out so the queue drains', async () => {
  writeHuntMeta('h_resume_notarget', {
    huntId: 'h_resume_notarget',
    target: '',
    brainMode: 'scanner',
    scanDepth: 'quick',
    state: 'running',
    createdAt: new Date().toISOString(),
  });
  const teardownCalls = [];
  let drainCalls = 0;
  const ok = await resumeInterruptedScannerHunt('h_resume_notarget', {
    drainQueue: async () => {
      drainCalls += 1;
    },
    teardownContainer: async (id) => {
      teardownCalls.push(id);
      return true;
    },
  });
  assert.equal(ok, false);
  assert.equal(readHuntMeta('h_resume_notarget').state, 'failed');
  assert.deepEqual(teardownCalls, ['h_resume_notarget']);
  assert.equal(drainCalls, 1);
  assert.ok(
    readHuntEvents('h_resume_notarget').some(
      (e) => e && e.type === 'status' && e.state === 'scanner_failed'
    )
  );
});
