/**
 * Worker pool + fair queue tests (multi-tenancy).
 *
 * The JobManager admits hunts into a bounded worker pool:
 *   - HUNT_MAX_CONCURRENT caps simultaneous hunts process-wide.
 *   - HUNT_MAX_PER_USER caps simultaneous hunts per user.
 *   - Overflow waits in a FIFO queue served ROUND-ROBIN across users, so one
 *     user's 50-target queue can never starve another user's single hunt.
 *
 * The fake worker below runs a job until the test releases it, so admission
 * decisions are fully deterministic. NOTE: dispatch() of a hunt that STARTS
 * returns a promise that only settles when the hunt finishes — tests never
 * await those; they await only the admission of QUEUED hunts ({status:'queued'}).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JobManager } from '../src/jobs/jobManager.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function makeHarness({ maxConcurrent = 2, maxPerUser = 1 } = {}) {
  const jobs = new Map();
  let seq = 0;
  const jobModel = {
    async get(jobId) { return jobs.get(jobId) || null; },
    __add(userId) {
      const job = { id: `job_${++seq}`, userId, target: 'example.com', status: 'created' };
      jobs.set(job.id, job);
      return job;
    }
  };

  const running = new Map(); // jobId -> userId
  const resolvers = new Map(); // jobId -> release()
  const started = []; // jobIds in start order
  const worker = {
    isRunning: (jobId) => running.has(jobId),
    get runningCount() { return running.size; },
    runningCountForUser: (userId) => [...running.values()].filter((u) => u === userId).length,
    wake() {},
    async run(jobId) {
      const job = jobs.get(jobId);
      if (!job) return { status: 'not_found' };
      running.set(jobId, job.userId);
      started.push(jobId);
      await new Promise((resolve) => resolvers.set(jobId, resolve));
      running.delete(jobId);
      return { status: 'finished' };
    }
  };

  const manager = new JobManager({
    jobModel,
    assessmentModel: {},
    worker,
    eventService: null,
    logger: { error() {}, log() {}, warn() {} },
    config: { maxConcurrent, maxPerUser, recoverOnBoot: false }
  });

  return {
    manager, worker, jobModel, started,
    release(jobId) { resolvers.get(jobId)?.(); resolvers.delete(jobId); },
  };
}

test('pool: jobs beyond HUNT_MAX_CONCURRENT wait in the queue', async () => {
  const h = makeHarness({ maxConcurrent: 1, maxPerUser: 2 });
  const a = h.jobModel.__add('u1');
  const b = h.jobModel.__add('u2');

  h.manager.dispatch(a.id); // starts (promise settles only when released — not awaited)
  await sleep(10);
  const rb = await h.manager.dispatch(b.id); // queued → admission settles
  assert.equal(rb.status, 'queued');
  assert.equal(h.manager.queueDepth, 1);
  assert.deepEqual(h.started, [a.id], 'only the first hunt runs');

  h.release(a.id);
  await sleep(50); // finally → setImmediate(pumpQueue) chain
  assert.deepEqual(h.started, [a.id, b.id], 'queued hunt starts when a slot frees');
  assert.equal(h.manager.queueDepth, 0);
  h.release(b.id);
  await sleep(10);
});

test('pool: HUNT_MAX_PER_USER stops one user hogging every slot', async () => {
  const h = makeHarness({ maxConcurrent: 4, maxPerUser: 1 });
  const a1 = h.jobModel.__add('u1');
  const a2 = h.jobModel.__add('u1');
  const b1 = h.jobModel.__add('u2');

  h.manager.dispatch(a1.id);
  await sleep(10);
  const r2 = await h.manager.dispatch(a2.id);
  assert.equal(r2.status, 'queued', 'second hunt of u1 waits (per-user cap)');
  h.manager.dispatch(b1.id);
  await sleep(10);
  assert.deepEqual([...h.started].sort(), [a1.id, b1.id].sort(), 'u2 is unaffected by u1’s cap');

  h.release(a1.id);
  await sleep(50);
  assert.ok(h.started.includes(a2.id), 'u1’s queued hunt starts after their slot frees');
  h.release(b1.id);
  h.release(a2.id);
  await sleep(10);
});

test('pool: the queue is served round-robin across users (fairness)', async () => {
  const h = makeHarness({ maxConcurrent: 1, maxPerUser: 2 });
  const a1 = h.jobModel.__add('u1');
  const a2 = h.jobModel.__add('u1');
  const b1 = h.jobModel.__add('u2');

  h.manager.dispatch(a1.id); // runs immediately (u1)
  await sleep(10);
  await h.manager.dispatch(a2.id); // queued (pool full)
  await h.manager.dispatch(b1.id); // queued (pool full)
  assert.equal(h.manager.queueDepth, 2);

  h.release(a1.id);
  await sleep(50);
  // u1 just ran → round-robin serves u2 next, even though u1 queued first.
  assert.deepEqual(h.started, [a1.id, b1.id], 'fair rotation: u2 served after u1');

  h.release(b1.id);
  await sleep(50);
  assert.deepEqual(h.started, [a1.id, b1.id, a2.id], 'then back to u1');
  h.release(a2.id);
  await sleep(10);
});

test('pool: cancelling a queued job dequeues it without running', async () => {
  const h = makeHarness({ maxConcurrent: 1, maxPerUser: 2 });
  const a = h.jobModel.__add('u1');
  const b = h.jobModel.__add('u2');
  h.manager.dispatch(a.id);
  await sleep(10);
  await h.manager.dispatch(b.id);
  assert.equal(h.manager.queueDepth, 1);

  // Cancel bookkeeping (mirrors JobManager.cancel): dequeue + drop tracking.
  h.manager.waitQueue = h.manager.waitQueue.filter((entry) => entry.jobId !== b.id);
  h.manager.dispatches.delete(b.id);
  assert.equal(h.manager.queueDepth, 0);

  h.release(a.id);
  await sleep(50);
  assert.deepEqual(h.started, [a.id], 'cancelled job never ran');
});
