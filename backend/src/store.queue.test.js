// Queue persistence tests (5 Nov 2026, queue-drain fix).
//
// enqueueHunt must persist the hunt's lane (brainMode + scanDepth) so a
// drained entry restarts in the lane the user asked for; dequeueNextHunt
// must mark the entry started; requeueHunt must put a failed start back
// in the queue (bounded retries) instead of silently losing the request.
//
// Contained: DATA_DIR points at a fresh temp dir (set before store.js is
// imported, so config.js picks it up). No network, no docker.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-queue-test-'));
process.env.DATA_DIR = tmp;

const {
  enqueueHunt,
  dequeueNextHunt,
  requeueHunt,
  readQueue,
  writeQueue,
  completeQueueHunt,
  reconcileStaleStartedEntries,
  MAX_QUEUE_ATTEMPTS,
  writeHuntMeta,
} = await import('./store.js');

after(() => fs.rmSync(tmp, { recursive: true, force: true }));

test('enqueueHunt stores brainMode and scanDepth on the entry', () => {
  writeQueue([]);
  const { queueId, position } = enqueueHunt({
    userId: 'u1',
    username: 'alice',
    target: 'http://example.com/',
    scope: null,
    mode: 'infinity',
    brainMode: 'scanner',
    scanDepth: 'deep',
  });
  assert.equal(position, 1);
  const [entry] = readQueue();
  assert.equal(entry.queueId, queueId);
  assert.equal(entry.brainMode, 'scanner');
  assert.equal(entry.scanDepth, 'deep');
  assert.equal(entry.mode, 'infinity');
  assert.equal(entry.status, 'queued');
});

test('enqueueHunt normalizes omitted/garbage lane values', () => {
  writeQueue([]);
  enqueueHunt({ userId: 'u1', username: 'alice', target: 'http://example.com/' });
  assert.equal(readQueue()[0].brainMode, 'ai');
  assert.equal(readQueue()[0].scanDepth, 'standard');
  assert.equal(readQueue()[0].mode, 'normal');
  writeQueue([]);
  enqueueHunt({
    userId: 'u1',
    username: 'alice',
    target: 'http://example.com/',
    brainMode: 'Scanner',
    scanDepth: 'turbo',
  });
  assert.equal(readQueue()[0].brainMode, 'ai');
  assert.equal(readQueue()[0].scanDepth, 'standard');
});

test('dequeueNextHunt marks the entry started and returns FIFO order', () => {
  writeQueue([]);
  const a = enqueueHunt({
    userId: 'u1',
    username: 'a',
    target: 'http://a.example/',
    brainMode: 'ai',
  });
  const b = enqueueHunt({
    userId: 'u1',
    username: 'a',
    target: 'http://b.example/',
    brainMode: 'scanner',
    scanDepth: 'quick',
  });
  const next = dequeueNextHunt();
  assert.equal(next.queueId, a.queueId);
  assert.equal(next.brainMode, 'ai');
  const queue = readQueue();
  assert.equal(queue.find((e) => e.queueId === a.queueId).status, 'started');
  assert.equal(queue.find((e) => e.queueId === b.queueId).status, 'queued');
  assert.equal(dequeueNextHunt().queueId, b.queueId);
  assert.equal(dequeueNextHunt(), null);
});

test('requeueHunt restores a failed start, then fails it after max attempts', () => {
  writeQueue([]);
  const { queueId } = enqueueHunt({
    userId: 'u1',
    username: 'a',
    target: 'http://a.example/',
  });
  dequeueNextHunt();
  assert.equal(readQueue()[0].status, 'started');
  assert.equal(requeueHunt(queueId, new Error('boom')), 'queued');
  let entry = readQueue()[0];
  assert.equal(entry.status, 'queued');
  assert.equal(entry.attempts, 1);
  assert.equal(entry.lastError, 'boom');
  // Two more failed starts exhaust the retries.
  dequeueNextHunt();
  assert.equal(requeueHunt(queueId, new Error('boom')), 'queued');
  dequeueNextHunt();
  assert.equal(requeueHunt(queueId, new Error('boom')), 'failed');
  entry = readQueue()[0];
  assert.equal(entry.status, 'failed');
  assert.equal(entry.attempts, 3);
  assert.equal(MAX_QUEUE_ATTEMPTS, 3);
});

test('requeueHunt returns false for an unknown entry', () => {
  writeQueue([]);
  assert.equal(requeueHunt('q_nope', new Error('x')), false);
});

// ---- Queue hygiene (6 Nov 2026) -----------------------------------------
// A drained entry must leave 'started' for the terminal 'completed'
// state with its huntId, and stale 'started' entries whose hunts
// already finished must be resolved instead of sitting forever.

const T0 = Date.parse('2026-11-06T08:00:00.000Z');
const iso = (ms) => new Date(ms).toISOString();

// Each reconcile test uses its own base time (2h apart) so hunt metas
// seeded by one test can never match another test's entry — the
// matcher keys on user + target + createdAt window.
function seedStartedEntry(base, overrides = {}) {
  const entry = {
    queueId: overrides.queueId || 'q_stale',
    userId: 'u-stale',
    username: 'stale',
    target: 'http://stale.example/',
    scope: null,
    mode: 'normal',
    brainMode: 'scanner',
    scanDepth: 'standard',
    priority: 0,
    status: 'started',
    createdAt: iso(base - 3600_000),
    startedAt: iso(base),
    ...overrides,
  };
  writeQueue([entry]);
  return entry;
}

function seedHunt(huntId, base, overrides = {}) {
  writeHuntMeta(huntId, {
    huntId,
    userId: 'u-stale',
    target: 'http://stale.example/',
    brainMode: 'scanner',
    state: 'finished',
    createdAt: iso(base + 100),
    ...overrides,
  });
}

function ageStartedEntry(queueId, msAgo) {
  const queue = readQueue();
  const entry = queue.find((e) => e.queueId === queueId);
  entry.startedAt = iso(Date.now() - msAgo);
  writeQueue(queue);
}

test('completeQueueHunt marks a started entry completed with its huntId', () => {
  writeQueue([]);
  const { queueId } = enqueueHunt({
    userId: 'u1',
    username: 'a',
    target: 'http://a.example/',
  });
  dequeueNextHunt();
  assert.equal(completeQueueHunt(queueId, 'h_done'), true);
  const entry = readQueue()[0];
  assert.equal(entry.status, 'completed');
  assert.equal(entry.huntId, 'h_done');
  assert.ok(entry.completedAt);
});

test('completeQueueHunt returns false for unknown or non-started entries', () => {
  writeQueue([]);
  assert.equal(completeQueueHunt('q_nope', 'h_x'), false);
  const { queueId } = enqueueHunt({
    userId: 'u1',
    username: 'a',
    target: 'http://a.example/',
  });
  // Still 'queued' — never started, so nothing to complete.
  assert.equal(completeQueueHunt(queueId, 'h_x'), false);
  assert.equal(readQueue()[0].status, 'queued');
  assert.equal(readQueue()[0].huntId, undefined);
});

test('reconcileStaleStartedEntries completes an entry whose hunt already finished', () => {
  writeQueue([]);
  seedStartedEntry(T0);
  seedHunt('h_stale_finished', T0);
  const resolved = reconcileStaleStartedEntries(undefined, T0 + 3600_000);
  assert.deepEqual(resolved, { completed: ['q_stale'], requeued: [], failed: [] });
  const entry = readQueue()[0];
  assert.equal(entry.status, 'completed');
  assert.equal(entry.huntId, 'h_stale_finished');
  assert.ok(entry.completedAt);
});

test('reconcile leaves a started entry alone when its hunt is still running', () => {
  writeQueue([]);
  const base = T0 + 3 * 3600_000;
  seedStartedEntry(base, { queueId: 'q_stale_run', target: 'http://stale-run.example/' });
  seedHunt('h_stale_running', base, {
    target: 'http://stale-run.example/',
    state: 'running',
  });
  const resolved = reconcileStaleStartedEntries(undefined, base + 3600_000);
  assert.deepEqual(resolved, { completed: [], requeued: [], failed: [] });
  assert.equal(readQueue()[0].status, 'started');
  assert.equal(readQueue()[0].huntId, undefined);
});

test('reconcile leaves a fresh started entry alone (in-flight drain grace)', () => {
  writeQueue([]);
  seedStartedEntry(Date.now(), { queueId: 'q_fresh' });
  const resolved = reconcileStaleStartedEntries(undefined, Date.now());
  assert.deepEqual(resolved, { completed: [], requeued: [], failed: [] });
  assert.equal(readQueue()[0].status, 'started');
});

test('reconcile requeues a stale started entry with no hunt, then fails it after max attempts', () => {
  writeQueue([]);
  const { queueId } = enqueueHunt({
    userId: 'u1',
    username: 'a',
    target: 'http://a.example/',
  });
  dequeueNextHunt();
  ageStartedEntry(queueId, 3600_000);
  assert.deepEqual(reconcileStaleStartedEntries(undefined, Date.now()), {
    completed: [],
    requeued: [queueId],
    failed: [],
  });
  let entry = readQueue()[0];
  assert.equal(entry.status, 'queued');
  assert.equal(entry.attempts, 1);
  assert.equal(entry.startedAt, undefined);
  dequeueNextHunt();
  ageStartedEntry(queueId, 3600_000);
  assert.deepEqual(reconcileStaleStartedEntries(undefined, Date.now()), {
    completed: [],
    requeued: [queueId],
    failed: [],
  });
  entry = readQueue()[0];
  assert.equal(entry.status, 'queued');
  assert.equal(entry.attempts, 2);
  dequeueNextHunt();
  ageStartedEntry(queueId, 3600_000);
  assert.deepEqual(reconcileStaleStartedEntries(undefined, Date.now()), {
    completed: [],
    requeued: [],
    failed: [queueId],
  });
  entry = readQueue()[0];
  assert.equal(entry.status, 'failed');
  assert.equal(entry.attempts, 3);
  assert.ok(entry.failedAt);
  assert.equal(entry.lastError, 'queue entry started but no hunt was created');
});

test('reconcile matches the earliest hunt created after startedAt', () => {
  writeQueue([]);
  const base = T0 + 6 * 3600_000;
  seedStartedEntry(base, { queueId: 'q_two' });
  seedHunt('h_stale_late', base, { createdAt: iso(base + 5000) });
  seedHunt('h_stale_early', base, { createdAt: iso(base + 100) });
  reconcileStaleStartedEntries(undefined, base + 3600_000);
  const entry = readQueue()[0];
  assert.equal(entry.status, 'completed');
  assert.equal(entry.huntId, 'h_stale_early');
});

test('reconcile completes a legacy entry without brainMode', () => {
  writeQueue([]);
  const base = T0 + 9 * 3600_000;
  seedStartedEntry(base, { queueId: 'q_legacy' });
  const queue = readQueue();
  delete queue[0].brainMode;
  writeQueue(queue);
  seedHunt('h_stale_legacy', base);
  reconcileStaleStartedEntries(undefined, base + 3600_000);
  const entry = readQueue()[0];
  assert.equal(entry.status, 'completed');
  assert.equal(entry.huntId, 'h_stale_legacy');
});

test('reconcile ignores a hunt created before the entry started', () => {
  writeQueue([]);
  const base = T0 + 12 * 3600_000;
  seedStartedEntry(base, { queueId: 'q_before' });
  // Hunt predates the entry — it cannot be the entry's hunt.
  seedHunt('h_stale_before', base, { createdAt: iso(base - 1000) });
  const resolved = reconcileStaleStartedEntries(undefined, base + 3600_000);
  assert.deepEqual(resolved, { completed: [], requeued: ['q_before'], failed: [] });
  assert.equal(readQueue()[0].status, 'queued');
});
