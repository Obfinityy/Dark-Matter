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
  MAX_QUEUE_ATTEMPTS,
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
