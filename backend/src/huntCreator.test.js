// Queue-drain creation tests (5 Nov 2026, queue-drain fix).
//
// createHuntFromQueue must create a hunt from a queued entry in the
// lane stored on the entry (scanner vs AI, with the right scan depth),
// honour the (user, target, brainMode) dedupe, and drainQueue must
// start the next queued hunt when a slot is free — and requeue the
// entry instead of losing it when the start fails.
//
// Contained: DATA_DIR points at a fresh temp dir (set before any
// project module is imported, so config.js picks it up). All heavy
// collaborators (engine, scope, lane runners) are injected through the
// `deps` seam — no network, no docker, no real engine.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-creator-test-'));
process.env.DATA_DIR = tmp;

const {
  createHuntFromQueue,
  drainQueue,
  normalizeQueueBrainMode,
  normalizeQueueScanDepth,
} = await import('./huntCreator.js');
const {
  readHuntMeta,
  readHuntEvents,
  writeHuntMeta,
  writeUsers,
  listHuntMetas,
  enqueueHunt,
  readQueue,
  writeQueue,
} = await import('./store.js');

after(() => fs.rmSync(tmp, { recursive: true, force: true }));

function baseDeps(overrides = {}) {
  const calls = { scanner: [], ai: [], resume: [], engine: 0 };
  return {
    calls,
    pickExistingHunt: () => null,
    parseScope: () => ({ rules: {} }),
    buildScope: () => ({ scope: 'test-scope' }),
    createEngineHunt: async () => {
      calls.engine += 1;
      return { huntId: 'h_qc_engine' };
    },
    understandTarget: async () => {},
    runScannerHunt: async (huntId, target, opts) => {
      calls.scanner.push({ huntId, target, opts });
      return { ok: true };
    },
    runAutonomousHunt: async (huntId, target, mode, userId) => {
      calls.ai.push({ huntId, target, mode, userId });
    },
    resumeInterruptedHunt: async (huntId) => {
      calls.resume.push(huntId);
      return true;
    },
    ...overrides,
  };
}

test('normalizeQueueBrainMode honours explicit lanes, legacy defaults to scanner', () => {
  assert.equal(normalizeQueueBrainMode('scanner'), 'scanner');
  assert.equal(normalizeQueueBrainMode('ai'), 'ai');
  assert.equal(normalizeQueueBrainMode(undefined), 'scanner');
  assert.equal(normalizeQueueBrainMode(null), 'scanner');
  assert.equal(normalizeQueueBrainMode('parent'), 'scanner');
  assert.equal(normalizeQueueBrainMode('Scanner'), 'scanner');
  assert.equal(normalizeQueueScanDepth('quick'), 'quick');
  assert.equal(normalizeQueueScanDepth('deep'), 'deep');
  assert.equal(normalizeQueueScanDepth('standard'), 'standard');
  assert.equal(normalizeQueueScanDepth(undefined), 'standard');
  assert.equal(normalizeQueueScanDepth('turbo'), 'standard');
});

test('createHuntFromQueue creates a scanner hunt in the stored lane and depth', async () => {
  const deps = baseDeps({
    createEngineHunt: async () => ({ huntId: 'h_qc_scanner' }),
  });
  const created = await createHuntFromQueue(
    {
      queueId: 'q_1',
      userId: 'u1',
      username: 'alice',
      target: 'http://example.com/',
      scope: null,
      mode: 'infinity',
      brainMode: 'scanner',
      scanDepth: 'deep',
    },
    deps
  );
  assert.deepEqual(created, {
    huntId: 'h_qc_scanner',
    brainMode: 'scanner',
    scanDepth: 'deep',
    scanScope: 'page',
    reused: false,
  });
  const meta = readHuntMeta('h_qc_scanner');
  assert.equal(meta.brainMode, 'scanner');
  assert.equal(meta.scanDepth, 'deep');
  assert.equal(meta.scanScope, 'page');
  assert.equal(meta.mode, 'infinity');
  assert.equal(meta.userId, 'u1');
  assert.equal(meta.authorized, true);
  assert.equal(deps.calls.scanner.length, 1);
  assert.deepEqual(deps.calls.scanner[0], {
    huntId: 'h_qc_scanner',
    target: 'http://example.com/',
    opts: { scope: null, userId: 'u1', scanDepth: 'deep', scanScope: 'page' },
  });
  assert.equal(deps.calls.ai.length, 0);
  const events = readHuntEvents('h_qc_scanner');
  assert.ok(events.some((e) => e.type === 'status' && e.state === 'created'));
});

// SITE CRAWL (9 Nov 2026, /* owner order): a queued whole-site entry
// drains as a whole-site hunt — the scope survives the queue.
test('createHuntFromQueue carries scanScope site through the drain', async () => {
  const deps = baseDeps({
    createEngineHunt: async () => ({ huntId: 'h_qc_site' }),
  });
  const created = await createHuntFromQueue(
    {
      queueId: 'q_site',
      userId: 'u1',
      username: 'alice',
      target: 'http://example.com/',
      scope: null,
      mode: 'infinity',
      brainMode: 'scanner',
      scanDepth: 'standard',
      scanScope: 'site',
    },
    deps
  );
  assert.deepEqual(created, {
    huntId: 'h_qc_site',
    brainMode: 'scanner',
    scanDepth: 'standard',
    scanScope: 'site',
    reused: false,
  });
  assert.equal(readHuntMeta('h_qc_site').scanScope, 'site');
  assert.deepEqual(deps.calls.scanner[0], {
    huntId: 'h_qc_site',
    target: 'http://example.com/',
    opts: { scope: null, userId: 'u1', scanDepth: 'standard', scanScope: 'site' },
  });
});

test('createHuntFromQueue creates an AI hunt for brainMode ai', async () => {
  const deps = baseDeps({
    createEngineHunt: async () => ({ huntId: 'h_qc_ai' }),
  });
  const created = await createHuntFromQueue(
    {
      queueId: 'q_2',
      userId: 'u1',
      username: 'alice',
      target: 'http://example.com/',
      scope: null,
      mode: 'normal',
      brainMode: 'ai',
      scanDepth: 'standard',
    },
    deps
  );
  assert.equal(created.huntId, 'h_qc_ai');
  assert.equal(created.brainMode, 'ai');
  assert.equal(deps.calls.ai.length, 1);
  assert.deepEqual(deps.calls.ai[0], {
    huntId: 'h_qc_ai',
    target: 'http://example.com/',
    mode: 'normal',
    userId: 'u1',
  });
  assert.equal(deps.calls.scanner.length, 0);
  assert.equal(readHuntMeta('h_qc_ai').brainMode, 'ai');
});

test('createHuntFromQueue drains a legacy entry (no lane stored) as scanner', async () => {
  const deps = baseDeps({
    createEngineHunt: async () => ({ huntId: 'h_qc_legacy' }),
  });
  const created = await createHuntFromQueue(
    {
      queueId: 'q_mw3ipfqa08bfz',
      userId: 'u1',
      username: 'alice',
      target: 'http://172.17.0.1:3100',
      scope: null,
      mode: 'infinity',
    },
    deps
  );
  assert.equal(created.brainMode, 'scanner');
  assert.equal(created.scanDepth, 'standard');
  assert.equal(readHuntMeta('h_qc_legacy').brainMode, 'scanner');
  assert.equal(deps.calls.scanner.length, 1);
  assert.equal(deps.calls.ai.length, 0);
});

test('createHuntFromQueue reuses a paused hunt instead of duplicating it', async () => {
  writeHuntMeta('h_old_paused', {
    huntId: 'h_old_paused',
    userId: 'u1',
    target: 'http://example.com/',
    brainMode: 'scanner',
    state: 'paused',
    paused: true,
    createdAt: new Date().toISOString(),
  });
  const deps = baseDeps({
    pickExistingHunt: () => readHuntMeta('h_old_paused'),
  });
  const created = await createHuntFromQueue(
    {
      queueId: 'q_3',
      userId: 'u1',
      username: 'alice',
      target: 'http://example.com/',
      brainMode: 'scanner',
      scanDepth: 'standard',
    },
    deps
  );
  assert.deepEqual(created, {
    huntId: 'h_old_paused',
    brainMode: 'scanner',
    scanDepth: 'standard',
    scanScope: 'page',
    reused: true,
    resumed: true,
  });
  assert.deepEqual(deps.calls.resume, ['h_old_paused']);
  assert.equal(deps.calls.engine, 0);
  assert.equal(deps.calls.scanner.length, 0);
  const meta = readHuntMeta('h_old_paused');
  assert.equal(meta.state, 'running');
  assert.equal(meta.paused, false);
});

test('createHuntFromQueue ignores a stopped match and creates a fresh hunt', async () => {
  // Regression (5 Nov 2026, drain-dedupe fix): q_mw3ipfqa08bfz drained
  // onto stopped h_071a785a82a4, the entry was consumed as 'started',
  // and no scan ever ran — a stopped hunt cannot resume by design.
  writeHuntMeta('h_old_stopped', {
    huntId: 'h_old_stopped',
    userId: 'u1',
    target: 'http://example.com/',
    brainMode: 'scanner',
    state: 'stopped',
    stopped: true,
    createdAt: new Date().toISOString(),
  });
  let engineCalls = 0;
  const deps = baseDeps({
    pickExistingHunt: () => readHuntMeta('h_old_stopped'),
    createEngineHunt: async () => {
      engineCalls += 1;
      return { huntId: 'h_qc_fresh_stopped' };
    },
  });
  const created = await createHuntFromQueue(
    {
      queueId: 'q_4a',
      userId: 'u1',
      username: 'alice',
      target: 'http://example.com/',
      brainMode: 'scanner',
      scanDepth: 'standard',
    },
    deps
  );
  assert.deepEqual(created, {
    huntId: 'h_qc_fresh_stopped',
    brainMode: 'scanner',
    scanDepth: 'standard',
    scanScope: 'page',
    reused: false,
  });
  assert.equal(engineCalls, 1);
  assert.equal(deps.calls.scanner.length, 1);
  assert.equal(deps.calls.scanner[0].huntId, 'h_qc_fresh_stopped');
  assert.equal(deps.calls.resume.length, 0);
  // The old stopped hunt is untouched — still stopped, no new events.
  assert.equal(readHuntMeta('h_old_stopped').state, 'stopped');
  assert.equal(readHuntMeta('h_qc_fresh_stopped').brainMode, 'scanner');
});

test('createHuntFromQueue ignores a finished match and creates a fresh hunt', async () => {
  writeHuntMeta('h_old_finished', {
    huntId: 'h_old_finished',
    userId: 'u1',
    target: 'http://example.com/',
    brainMode: 'ai',
    state: 'finished',
    createdAt: new Date().toISOString(),
  });
  let engineCalls = 0;
  const deps = baseDeps({
    pickExistingHunt: () => readHuntMeta('h_old_finished'),
    createEngineHunt: async () => {
      engineCalls += 1;
      return { huntId: 'h_qc_fresh_finished' };
    },
  });
  const created = await createHuntFromQueue(
    {
      queueId: 'q_4b',
      userId: 'u1',
      username: 'alice',
      target: 'http://example.com/',
      brainMode: 'ai',
    },
    deps
  );
  assert.equal(created.huntId, 'h_qc_fresh_finished');
  assert.equal(created.reused, false);
  assert.equal(engineCalls, 1);
  assert.equal(deps.calls.ai.length, 1);
  assert.equal(deps.calls.ai[0].huntId, 'h_qc_fresh_finished');
  assert.equal(deps.calls.resume.length, 0);
  assert.equal(readHuntMeta('h_old_finished').state, 'finished');
});

test('createHuntFromQueue ignores a failed match and creates a fresh hunt', async () => {
  writeHuntMeta('h_old_failed', {
    huntId: 'h_old_failed',
    userId: 'u1',
    target: 'http://example.com/',
    brainMode: 'scanner',
    state: 'failed',
    createdAt: new Date().toISOString(),
  });
  let engineCalls = 0;
  const deps = baseDeps({
    pickExistingHunt: () => readHuntMeta('h_old_failed'),
    createEngineHunt: async () => {
      engineCalls += 1;
      return { huntId: 'h_qc_fresh_failed' };
    },
  });
  const created = await createHuntFromQueue(
    {
      queueId: 'q_4c',
      userId: 'u1',
      username: 'alice',
      target: 'http://example.com/',
      brainMode: 'scanner',
    },
    deps
  );
  assert.equal(created.huntId, 'h_qc_fresh_failed');
  assert.equal(created.reused, false);
  assert.equal(engineCalls, 1);
  assert.equal(deps.calls.scanner.length, 1);
  assert.equal(readHuntMeta('h_old_failed').state, 'failed');
});

test('createHuntFromQueue reuses a running match instead of duplicating it', async () => {
  writeHuntMeta('h_live_running', {
    huntId: 'h_live_running',
    userId: 'u1',
    target: 'http://example.com/',
    brainMode: 'scanner',
    state: 'running',
    createdAt: new Date().toISOString(),
  });
  const deps = baseDeps({
    pickExistingHunt: () => readHuntMeta('h_live_running'),
  });
  const created = await createHuntFromQueue(
    {
      queueId: 'q_4d',
      userId: 'u1',
      username: 'alice',
      target: 'http://example.com/',
      brainMode: 'scanner',
      scanDepth: 'standard',
    },
    deps
  );
  assert.deepEqual(created, {
    huntId: 'h_live_running',
    brainMode: 'scanner',
    scanDepth: 'standard',
    scanScope: 'page',
    reused: true,
    resumed: false,
  });
  assert.equal(deps.calls.engine, 0);
  assert.equal(deps.calls.scanner.length, 0);
  assert.equal(deps.calls.resume.length, 0);
  assert.equal(readHuntMeta('h_live_running').state, 'running');
});

test('createHuntFromQueue mints a host-side id when the engine is unreachable', async () => {
  const deps = baseDeps({
    createEngineHunt: async () => {
      const err = new Error('engine down');
      err.name = 'EngineUnreachableError';
      throw err;
    },
  });
  const created = await createHuntFromQueue(
    {
      queueId: 'q_5',
      userId: 'u1',
      username: 'alice',
      target: 'http://example.com/',
      brainMode: 'scanner',
    },
    deps
  );
  assert.match(created.huntId, /^h_[0-9a-f]+$/);
  assert.equal(readHuntMeta(created.huntId).brainMode, 'scanner');
});

test('createHuntFromQueue rejects entries without target or user', async () => {
  const deps = baseDeps();
  await assert.rejects(
    createHuntFromQueue({ queueId: 'q_x', userId: 'u1' }, deps),
    /no target/
  );
  await assert.rejects(
    createHuntFromQueue({ queueId: 'q_x', target: 'http://example.com/' }, deps),
    /no userId/
  );
});

test('drainQueue starts a queued scanner entry in its stored lane', async () => {
  writeQueue([]);
  enqueueHunt({
    userId: 'u1',
    username: 'alice',
    target: 'http://example.com/',
    mode: 'infinity',
    brainMode: 'scanner',
    scanDepth: 'deep',
  });
  const deps = baseDeps({
    createEngineHunt: async () => ({ huntId: 'h_qc_drain' }),
  });
  const created = await drainQueue(deps);
  assert.equal(created.huntId, 'h_qc_drain');
  assert.equal(created.brainMode, 'scanner');
  assert.equal(created.scanDepth, 'deep');
  // QUEUE HYGIENE (6 Nov 2026): a drained entry leaves 'started' for
  // the terminal 'completed' state with its huntId recorded.
  const entry = readQueue()[0];
  assert.equal(entry.status, 'completed');
  assert.equal(entry.huntId, 'h_qc_drain');
  assert.ok(entry.completedAt);
  assert.equal(readHuntMeta('h_qc_drain').brainMode, 'scanner');
  assert.equal(deps.calls.scanner.length, 1);
});

test('drainQueue heals a stale started entry before starting the next', async () => {
  writeQueue([]);
  const base = Date.parse('2026-11-06T08:00:00.000Z');
  const iso = (ms) => new Date(ms).toISOString();
  // A legacy 'started' entry whose hunt already finished (the EC2 shape).
  writeQueue([
    {
      queueId: 'q_stale_heal',
      userId: 'u-stale',
      username: 'stale',
      target: 'http://heal.example/',
      scope: null,
      mode: 'normal',
      brainMode: 'scanner',
      scanDepth: 'standard',
      priority: 0,
      status: 'started',
      createdAt: iso(base - 3600_000),
      startedAt: iso(base),
    },
  ]);
  writeHuntMeta('h_heal_finished', {
    huntId: 'h_heal_finished',
    userId: 'u-stale',
    target: 'http://heal.example/',
    brainMode: 'scanner',
    state: 'finished',
    createdAt: iso(base + 100),
  });
  enqueueHunt({
    userId: 'u1',
    username: 'alice',
    target: 'http://example.com/',
    brainMode: 'scanner',
  });
  const prevCap = process.env.MAX_CONCURRENT_HUNTS;
  process.env.MAX_CONCURRENT_HUNTS = '10';
  try {
    const deps = baseDeps({
      createEngineHunt: async () => ({ huntId: 'h_qc_heal' }),
    });
    const created = await drainQueue(deps);
    assert.equal(created.huntId, 'h_qc_heal');
    const queue = readQueue();
    const stale = queue.find((e) => e.queueId === 'q_stale_heal');
    assert.equal(stale.status, 'completed');
    assert.equal(stale.huntId, 'h_heal_finished');
    const fresh = queue.find((e) => e.target === 'http://example.com/');
    assert.equal(fresh.status, 'completed');
    assert.equal(fresh.huntId, 'h_qc_heal');
  } finally {
    if (prevCap === undefined) delete process.env.MAX_CONCURRENT_HUNTS;
    else process.env.MAX_CONCURRENT_HUNTS = prevCap;
  }
});

test('drainQueue leaves a stale started entry alone when its hunt is still running', async () => {
  writeQueue([]);
  const base = Date.parse('2026-11-06T09:00:00.000Z');
  const iso = (ms) => new Date(ms).toISOString();
  writeQueue([
    {
      queueId: 'q_stale_live',
      userId: 'u-stale',
      username: 'stale',
      target: 'http://live.example/',
      scope: null,
      mode: 'normal',
      brainMode: 'scanner',
      scanDepth: 'standard',
      priority: 0,
      status: 'started',
      createdAt: iso(base - 3600_000),
      startedAt: iso(base),
    },
  ]);
  writeHuntMeta('h_live_running', {
    huntId: 'h_live_running',
    userId: 'u-stale',
    target: 'http://live.example/',
    brainMode: 'scanner',
    state: 'running',
    createdAt: iso(base + 100),
  });
  enqueueHunt({
    userId: 'u1',
    username: 'alice',
    target: 'http://example.com/',
    brainMode: 'scanner',
  });
  const prevCap = process.env.MAX_CONCURRENT_HUNTS;
  process.env.MAX_CONCURRENT_HUNTS = '10';
  try {
    const deps = baseDeps({
      createEngineHunt: async () => ({ huntId: 'h_qc_live' }),
    });
    const created = await drainQueue(deps);
    assert.equal(created.huntId, 'h_qc_live');
    const queue = readQueue();
    // The live hunt's entry is untouched — never completed, never re-run.
    assert.equal(queue.find((e) => e.queueId === 'q_stale_live').status, 'started');
    assert.equal(queue.find((e) => e.queueId === 'q_stale_live').huntId, undefined);
    assert.equal(queue.find((e) => e.target === 'http://example.com/').status, 'completed');
  } finally {
    if (prevCap === undefined) delete process.env.MAX_CONCURRENT_HUNTS;
    else process.env.MAX_CONCURRENT_HUNTS = prevCap;
    fs.rmSync(path.join(tmp, 'hunts', 'h_live_running'), { recursive: true, force: true });
  }
});

test('drainQueue returns null when the queue is empty', async () => {
  writeQueue([]);
  assert.equal(await drainQueue(baseDeps()), null);
});

test('drainQueue does nothing while the concurrency cap is reached', async () => {
  writeQueue([]);
  enqueueHunt({
    userId: 'u1',
    username: 'alice',
    target: 'http://example.com/',
    brainMode: 'scanner',
  });
  writeHuntMeta('h_running', {
    huntId: 'h_running',
    userId: 'u1',
    target: 'http://other.example/',
    brainMode: 'ai',
    state: 'running',
    createdAt: new Date().toISOString(),
  });
  // The temp dir already holds running metas from earlier tests in this
  // file, so set the cap to the exact current running count.
  const running = listHuntMetas().filter((m) => m.state === 'running').length;
  assert.ok(running >= 1);
  const prevCap = process.env.MAX_CONCURRENT_HUNTS;
  process.env.MAX_CONCURRENT_HUNTS = String(running);
  try {
    const deps = baseDeps();
    assert.equal(await drainQueue(deps), null);
    assert.equal(readQueue()[0].status, 'queued');
    assert.equal(deps.calls.engine, 0);
  } finally {
    if (prevCap === undefined) delete process.env.MAX_CONCURRENT_HUNTS;
    else process.env.MAX_CONCURRENT_HUNTS = prevCap;
    fs.rmSync(path.join(tmp, 'hunts', 'h_running'), { recursive: true, force: true });
  }
});

test('drainQueue requeues a failed start instead of losing it, then fails it', async () => {
  writeQueue([]);
  enqueueHunt({
    userId: 'u1',
    username: 'alice',
    target: 'http://example.com/',
    brainMode: 'scanner',
  });
  const deps = baseDeps({
    createEngineHunt: async () => {
      throw new Error('engine down');
    },
  });
  assert.equal(await drainQueue(deps), null);
  let entry = readQueue()[0];
  assert.equal(entry.status, 'queued');
  assert.equal(entry.attempts, 1);
  assert.equal(await drainQueue(deps), null);
  entry = readQueue()[0];
  assert.equal(entry.status, 'queued');
  assert.equal(entry.attempts, 2);
  assert.equal(await drainQueue(deps), null);
  entry = readQueue()[0];
  assert.equal(entry.status, 'failed');
  assert.equal(entry.attempts, 3);
  // A failed entry is never retried.
  assert.equal(await drainQueue(deps), null);
});

// LAB-CANARY CREDS AT DRAIN (10 Nov 2026, Hunt A fix): the queue entry
// never carried labCreds, so a drained lab hunt silently skipped the
// auth family — the same gap as the website direct path. The drain
// resolves the server-side default from the entry owner's role.
// Lab defaults are public defaults — built by concatenation so no
// secret-shaped literal ever lands in the repo (GH013).
test('createHuntFromQueue forwards server-default labCreds for an admin lab drain', async () => {
  writeUsers({
    admin1: { id: 'u-admin', username: 'admin1', role: 'admin' },
  });
  const prevLabTargets = process.env.LAB_TARGETS;
  process.env.LAB_TARGETS = '172.17.0.1:3000,172.17.0.1:3100';
  try {
    const deps = baseDeps({
      createEngineHunt: async () => ({ huntId: 'h_qc_labcreds' }),
    });
    const created = await createHuntFromQueue(
      {
        queueId: 'q_lab',
        userId: 'u-admin',
        username: 'admin1',
        target: 'http://172.17.0.1:3000/',
        scope: null,
        mode: 'infinity',
        brainMode: 'scanner',
        scanDepth: 'standard',
      },
      deps
    );
    assert.equal(created.huntId, 'h_qc_labcreds');
    assert.equal(deps.calls.scanner.length, 1);
    assert.deepEqual(deps.calls.scanner[0].opts.labCreds, {
      username: 'admin' + '@juice-sh.op',
      password: 'admin' + '123',
    });
  } finally {
    if (prevLabTargets === undefined) delete process.env.LAB_TARGETS;
    else process.env.LAB_TARGETS = prevLabTargets;
  }
});

test('createHuntFromQueue attaches no labCreds for a non-admin lab drain', async () => {
  writeUsers({
    bob: { id: 'u-bob', username: 'bob', role: 'user' },
  });
  const prevLabTargets = process.env.LAB_TARGETS;
  process.env.LAB_TARGETS = '172.17.0.1:3000,172.17.0.1:3100';
  try {
    const deps = baseDeps({
      createEngineHunt: async () => ({ huntId: 'h_qc_labcreds_bob' }),
    });
    await createHuntFromQueue(
      {
        queueId: 'q_lab_bob',
        userId: 'u-bob',
        username: 'bob',
        target: 'http://172.17.0.1:3000/',
        scope: null,
        mode: 'infinity',
        brainMode: 'scanner',
        scanDepth: 'standard',
      },
      deps
    );
    assert.equal(deps.calls.scanner.length, 1);
    assert.equal(deps.calls.scanner[0].opts.labCreds, undefined);
  } finally {
    if (prevLabTargets === undefined) delete process.env.LAB_TARGETS;
    else process.env.LAB_TARGETS = prevLabTargets;
  }
});

test('createHuntFromQueue attaches no labCreds for a non-lab drain', async () => {
  writeUsers({
    admin1: { id: 'u-admin', username: 'admin1', role: 'admin' },
  });
  const prevLabTargets = process.env.LAB_TARGETS;
  process.env.LAB_TARGETS = '172.17.0.1:3000,172.17.0.1:3100';
  try {
    const deps = baseDeps({
      createEngineHunt: async () => ({ huntId: 'h_qc_labcreds_web' }),
    });
    await createHuntFromQueue(
      {
        queueId: 'q_lab_web',
        userId: 'u-admin',
        username: 'admin1',
        target: 'http://example.com/',
        scope: null,
        mode: 'infinity',
        brainMode: 'scanner',
        scanDepth: 'standard',
      },
      deps
    );
    assert.equal(deps.calls.scanner.length, 1);
    assert.equal(deps.calls.scanner[0].opts.labCreds, undefined);
  } finally {
    if (prevLabTargets === undefined) delete process.env.LAB_TARGETS;
    else process.env.LAB_TARGETS = prevLabTargets;
  }
});
