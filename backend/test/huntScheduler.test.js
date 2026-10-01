/**
 * Hunt scheduler tests.
 *
 * Scheduled hunts fire on cadence. The tick is crash-safe by design:
 * each schedule is ADVANCED (nextRunAt moved forward, 'once' disabled)
 * BEFORE its job is created, so a crash between fire and update can never
 * double-fire the same run.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryDatabase } from '../src/models/database.js';
import { HuntScheduleModel } from '../src/models/huntScheduleModel.js';
import { HuntScheduler } from '../src/services/huntScheduler.js';

function makeScheduler() {
  const database = new MemoryDatabase();
  const scheduleModel = new HuntScheduleModel(database);
  const createdJobs = [];
  let seq = 0;
  const scheduler = new HuntScheduler({
    scheduleModel,
    createJob: async ({ userId, target, scope, objective, origin }) => {
      const job = { id: `sched_job_${++seq}`, userId, target, scope, objective, origin };
      createdJobs.push(job);
      return job;
    },
    alertService: null,
    logger: { warn() {}, log() {}, error() {} }
  });
  return { scheduler, scheduleModel, createdJobs };
}

const PAST = new Date(Date.now() - 60_000).toISOString();

test('tick: fires due schedules and advances them', async () => {
  const { scheduler, scheduleModel, createdJobs } = makeScheduler();
  const s = await scheduler.schedule({
    userId: 'u1', name: 'weekly scan', target: 'https://example.com',
    scope: { domains: ['example.com'] }, cadence: 'weekly', nextRunAt: PAST
  });

  const fired = await scheduler.tick(new Date());
  assert.equal(fired.length, 1);
  assert.equal(createdJobs.length, 1);
  assert.equal(createdJobs[0].target, 'https://example.com');
  assert.deepEqual(createdJobs[0].origin, { kind: 'schedule', scheduleId: s.id });

  const updated = await scheduleModel.get('u1', s.id);
  assert.ok(new Date(updated.nextRunAt).getTime() > Date.now(), 'nextRunAt advanced a full week');
  assert.equal(updated.lastJobId, createdJobs[0].id);
  assert.ok(updated.lastRunAt);

  // A second tick must NOT re-fire (advance-first idempotency).
  const fired2 = await scheduler.tick(new Date());
  assert.equal(fired2.length, 0);
  assert.equal(createdJobs.length, 1);
});

test('tick: a "once" schedule fires exactly once then disables itself', async () => {
  const { scheduler, scheduleModel, createdJobs } = makeScheduler();
  const s = await scheduler.schedule({
    userId: 'u1', name: 'one-off', target: 'https://once.example',
    cadence: 'once', nextRunAt: PAST
  });

  assert.equal((await scheduler.tick(new Date())).length, 1);
  const updated = await scheduleModel.get('u1', s.id);
  assert.equal(updated.enabled, false, 'once-schedules disable after firing');
  assert.equal((await scheduler.tick(new Date())).length, 0);
  assert.equal(createdJobs.length, 1);
});

test('tick: future schedules and disabled schedules do not fire', async () => {
  const { scheduler, scheduleModel, createdJobs } = makeScheduler();
  const future = await scheduler.schedule({
    userId: 'u1', target: 'https://future.example',
    cadence: 'daily', nextRunAt: new Date(Date.now() + 3_600_000).toISOString()
  });
  await scheduleModel.update('u1', future.id, { enabled: false });

  assert.equal((await scheduler.tick(new Date())).length, 0);
  assert.equal(createdJobs.length, 0);
});

test('tick: a failing createJob does not break other schedules', async () => {
  const database = new MemoryDatabase();
  const scheduleModel = new HuntScheduleModel(database);
  const createdJobs = [];
  const scheduler = new HuntScheduler({
    scheduleModel,
    createJob: async ({ target }) => {
      if (target.includes('boom')) throw new Error('createJob exploded');
      const job = { id: `j_${createdJobs.length}`, target };
      createdJobs.push(job);
      return job;
    },
    alertService: null,
    logger: { warn() {}, log() {}, error() {} }
  });

  await scheduler.schedule({ userId: 'u1', target: 'https://boom.example', cadence: 'daily', nextRunAt: PAST });
  await scheduler.schedule({ userId: 'u1', target: 'https://fine.example', cadence: 'daily', nextRunAt: PAST });

  const fired = await scheduler.tick(new Date());
  assert.equal(createdJobs.length, 1, 'the good schedule still fired');
  assert.equal(createdJobs[0].target, 'https://fine.example');
  assert.equal(fired.length, 1);
});
