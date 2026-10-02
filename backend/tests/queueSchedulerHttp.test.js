/**
 * queueSchedulerHttp.test.js
 *
 * API-level proof that the queue / schedule / posture surfaces are wired
 * end-to-end (G36, G37, G38): the REAL backend on 127.0.0.1:4561 with a
 * file-backed DB (tests/support/fileDatabase.js).
 *
 *  - POST /api/v1/queues → TargetQueueService fires the first hunt, queue
 *    advances; pause/resume round-trip; enriched list fields present.
 *  - POST /api/v1/schedules → HuntScheduler persists; PATCH enable/disable
 *    round-trips; DELETE removes.
 *  - GET /api/v1/jobs/:id/posture → real posture shape from live findings
 *    (plus pure-function unit checks of computePostureScore).
 *
 * Run: cd backend && node --test tests/queueSchedulerHttp.test.js
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { computePostureScore } from '../src/services/assessmentService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ENTRY = path.resolve(__dirname, 'support/bootTestServer.js');
const API = 'http://127.0.0.1:4561/api/v1';
const FIXTURE = 'http://127.0.0.1:4555';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitFor(url, timeoutMs = 20000) {
  const start = Date.now();
  for (;;) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch { /* not up yet */ }
    if (Date.now() - start > timeoutMs) throw new Error(`not ready: ${url}`);
    await sleep(250);
  }
}

describe('queues + schedules + posture over HTTP (real backend)', () => {
  let server;
  let dbDir;
  let authHeader;

  function startServer(extraEnv = {}) {
    return spawn(process.execPath, [SERVER_ENTRY], {
      env: {
        ...process.env,
        PORT: '4561',
        W3_DB_DIR: dbDir,
        HUNT_SCHEDULER_ENABLED: 'false',
        AGENT_PHONE_RETRY_MS: '2000',
        JWT_SECRET: 'w3-test-secret-qs',
        ...extraEnv,
      },
      stdio: 'ignore',
    });
  }

  const api = (method, url, payload) => fetch(url, {
    method,
    headers: { authorization: authHeader, 'content-type': 'application/json' },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });

  before(async () => {
    dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'w3-qdb-'));
    server = startServer();
    await waitFor(`${API}/health`);
    const reg = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'w3qs@example.local', username: 'w3qs', name: 'W3 QS', password: 'correct-horse-9',
      }),
    });
    assert.equal(reg.status, 201);
    const body = await reg.json();
    authHeader = `Bearer ${body.jwt}`;
    assert.ok(body.jwt, 'JWT issued');
  });

  after(async () => {
    if (server && !server.killed) server.kill('SIGKILL');
    fs.rmSync(dbDir, { recursive: true, force: true });
  });

  it('G36: queue create fires the first hunt; pause/resume round-trip', async () => {
    const created = await api('POST', `${API}/queues`, {
      name: 'w3 campaign',
      targets: [`${FIXTURE}/camp-a`, `${FIXTURE}/camp-b`],
      authorizationConfirmed: true,
    });
    assert.equal(created.status, 201, 'queue created');
    const { queue } = await created.json();
    assert.ok(queue.id, 'queue id returned');
    assert.equal(queue.targets.length, 2);
    // The first target's hunt started immediately (real TargetQueueService).
    assert.equal(queue.targets[0].status, 'active', 'first target hunting');
    assert.ok(queue.targets[0].jobId, 'first target has a job id');
    assert.equal(queue.targets[1].status, 'queued', 'second target waits its turn');

    // Enriched list fields the UI renders.
    const list = await (await api('GET', `${API}/queues`)).json();
    const listed = list.queues.find((q) => q.id === queue.id);
    assert.ok(listed, 'queue listed');
    assert.equal(listed.completedCount, 0);
    assert.equal(listed.currentTarget, `${FIXTURE}/camp-a`);
    assert.equal(listed.currentJobId, queue.targets[0].jobId);

    const paused = await api('POST', `${API}/queues/${queue.id}/pause`);
    assert.equal(paused.status, 200);
    assert.equal((await paused.json()).queue.status, 'paused');

    const resumed = await api('POST', `${API}/queues/${queue.id}/resume`);
    assert.equal(resumed.status, 200);
    assert.equal((await resumed.json()).queue.status, 'active');

    const removed = await api('DELETE', `${API}/queues/${queue.id}`);
    assert.ok([200, 204].includes(removed.status), 'queue deleted');
  });

  it('G37: schedule create / disable / enable / delete round-trip', async () => {
    const created = await api('POST', `${API}/schedules`, {
      name: 'w3 weekly',
      target: `${FIXTURE}/sched`,
      cadence: 'weekly',
      authorizationConfirmed: true,
    });
    assert.equal(created.status, 201, 'schedule created');
    const { schedule } = await created.json();
    assert.ok(schedule.id);
    assert.equal(schedule.enabled, true);
    assert.ok(schedule.nextRunAt, 'next run computed');

    const listed = await (await api('GET', `${API}/schedules`)).json();
    assert.ok(listed.schedules.some((s) => s.id === schedule.id), 'schedule listed');

    const disabled = await api('PATCH', `${API}/schedules/${schedule.id}`, { enabled: false });
    assert.equal(disabled.status, 200);
    assert.equal((await disabled.json()).schedule.enabled, false, 'schedule disabled');

    const enabled = await api('PATCH', `${API}/schedules/${schedule.id}`, { enabled: true });
    assert.equal(enabled.status, 200);
    assert.equal((await enabled.json()).schedule.enabled, true, 'schedule re-enabled');

    const removed = await api('DELETE', `${API}/schedules/${schedule.id}`);
    assert.ok([200, 204].includes(removed.status), 'schedule deleted');
    const relisted = await (await api('GET', `${API}/schedules`)).json();
    assert.ok(!relisted.schedules.some((s) => s.id === schedule.id), 'schedule gone');
  });

  it('G38: posture endpoint returns the real computed shape', async () => {
    const created = await api('POST', `${API}/jobs`, {
      targetUrl: `${FIXTURE}/posture-probe`,
      authorizationConfirmed: true,
      forceNew: true,
    });
    assert.equal(created.status, 202);
    const { jobId } = await created.json();

    const res = await api('GET', `${API}/jobs/${jobId}/posture`);
    assert.equal(res.status, 200);
    const { posture } = await res.json();
    assert.equal(posture.jobId, jobId);
    assert.equal(posture.target, `${FIXTURE}/posture-probe`);
    assert.equal(posture.score, 100, 'no findings → perfect posture');
    assert.equal(posture.grade, 'A');
    assert.deepEqual(posture.counts, { critical: 0, high: 0, medium: 0, low: 0, informational: 0 });
    assert.equal(posture.total, 0);
    assert.ok(Array.isArray(posture.topRisks));
  });

  it('G38: computePostureScore grades real finding mixes deterministically', () => {
    const clean = computePostureScore([]);
    assert.deepEqual([clean.score, clean.grade], [100, 'A']);

    const bad = computePostureScore([
      { id: 'a', title: 'SQLi', severity: 'critical' },
      { id: 'b', title: 'XSS', severity: 'high' },
      { id: 'c', title: 'IDOR', severity: 'high' },
    ]);
    assert.equal(bad.score, 100 - 25 - 10 - 10, 'severity-weighted deduction');
    assert.equal(bad.grade, 'D', '55 lands in the D band (<60)');
    assert.deepEqual(bad.counts, { critical: 1, high: 2, medium: 0, low: 0, informational: 0 });
    assert.equal(bad.topRisks[0].id, 'a', 'most severe first');
    assert.equal(bad.total, 3);

    const wrecked = computePostureScore(
      Array.from({ length: 10 }, (_, i) => ({ id: `x${i}`, title: `c${i}`, severity: 'critical' }))
    );
    assert.equal(wrecked.score, 0, 'floored at zero');
    assert.equal(wrecked.grade, 'F');
  });

  it('jobs history lists past hunts with {id,target,status,createdAt,findingsCount}', async () => {
    const list = await (await api('GET', `${API}/jobs`)).json();
    assert.ok(Array.isArray(list.jobs) && list.jobs.length >= 2, 'history has hunts');
    for (const job of list.jobs) {
      assert.ok(job.id, 'id present');
      assert.ok(job.target, 'target present');
      assert.ok(job.status, 'status present');
      assert.ok(job.createdAt, 'createdAt present');
      assert.ok('findingsCount' in job, 'findingsCount present');
    }
  });
});
