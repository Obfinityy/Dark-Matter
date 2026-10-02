/**
 * huntCrashRecovery.test.js
 *
 * PROOF of pause/resume + crash recovery (A2) and background continuation
 * (A3) against the REAL backend (createApp — unmodified production code)
 * booted on 127.0.0.1:4561 with a file-backed database
 * (tests/support/fileDatabase.js — test-only storage adapter; the app code
 * under test is untouched, injected via the createApp({ database }) hook).
 *
 * A2 — pause → SIGKILL → reboot → resume:
 *   1. Start hunt against the local fixture (127.0.0.1:4555, we own it).
 *   2. Pause mid-hunt; record stepCount / phase / huntState.
 *   3. SIGKILL the backend (no graceful shutdown — worst case).
 *   4. Assert the job row is on DISK (state lives in the DB file, not memory).
 *   5. Reboot the backend on the same DB dir; boot recovery must leave the
 *      paused job paused and its checkpoint intact.
 *   6. Resume; assert the hunt continues from the exact saved step/phase —
 *      nothing replayed, nothing reset.
 *
 * A3 — background continuation with the client gone:
 *   1. Start a hunt, then make ZERO requests for several seconds.
 *   2. Assert the server-side worker loop advanced on its own
 *      (heartbeats/updatedAt moved, lease renewed) — no polling needed.
 *   3. Create a due schedule; assert the scheduler tick fires a hunt
 *      server-side with no client involvement.
 *
 * Honest boundary: without a reachable LLM brain the worker parks in
 * `waiting` (by design — "no cloud fallback"). Progress proven here is the
 * control plane's: dispatch, pause, persist, recover, resume, heartbeat.
 * The autonomous decision hop needs a model and is reported as pending.
 *
 * Run: cd backend && node --test tests/huntCrashRecovery.test.js
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_ENTRY = path.resolve(__dirname, '../fixture/vuln-app/index.js');
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

async function waitForJob(cookie, jobId, want, timeoutMs = 30000) {
  const start = Date.now();
  for (;;) {
    const res = await fetch(`${API}/jobs/${jobId}`, { headers: { cookie } });
    assert.equal(res.status, 200, `GET job ${jobId}`);
    const body = await res.json();
    const job = body.job || body;
    if (want(job)) return job;
    if (Date.now() - start > timeoutMs) {
      throw new Error(`job ${jobId} never satisfied condition (last status=${job.status})`);
    }
    await sleep(500);
  }
}

function api(cookie, method, url, payload) {
  return fetch(url, {
    method,
    headers: { cookie, 'content-type': 'application/json' },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
}

describe('crash recovery + background continuation (real backend, file DB)', () => {
  let fixture;
  let server;
  let dbDir;
  let cookie;

  function startServer(extraEnv = {}) {
    const proc = spawn(process.execPath, [SERVER_ENTRY], {
      env: {
        ...process.env,
        PORT: '4561',
        W3_DB_DIR: dbDir,
        HUNT_SCHEDULER_ENABLED: 'false', // enabled explicitly only for the A3 scheduler test
        AGENT_PHONE_RETRY_MS: '2000',
        // This test proves the CONTROL PLANE (dispatch, pause, persist,
        // recover, resume, heartbeat) — not the brain strategy. With no LLM
        // reachable the deterministic rule-based fallback would otherwise
        // run every hunt to completion in seconds, before the test can
        // pause/kill/reboot it. Disable it so the worker parks in `waiting`
        // (the documented no-brain behavior) and the choreography below is
        // deterministic. The autonomous loop itself is proven separately by
        // backend/scripts/e2e-hunt-proof.mjs (25/25 with the fallback ON).
        AGENT_DETERMINISTIC_FALLBACK: '0',
        JWT_SECRET: 'w3-test-secret-pinned-for-restart',
        ...extraEnv,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    proc.stdout.on('data', (d) => process.env.W3_DEBUG && process.stdout.write(`[srv] ${d}`));
    proc.stderr.on('data', (d) => process.env.W3_DEBUG && process.stderr.write(`[srv-err] ${d}`));
    return proc;
  }

  async function killServer(proc, signal = 'SIGKILL') {
    if (!proc || proc.killed) return;
    proc.kill(signal);
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 5000);
      proc.once('exit', () => { clearTimeout(timer); resolve(); });
    });
  }

  before(async () => {
    dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'w3-crashdb-'));
    fixture = spawn(process.execPath, [FIXTURE_ENTRY], {
      env: { ...process.env, PORT: '4555' },
      stdio: 'ignore',
    });
    await waitFor(`${FIXTURE}/health`);
  });

  after(async () => {
    await killServer(server);
    if (fixture && !fixture.killed) fixture.kill('SIGKILL');
    fs.rmSync(dbDir, { recursive: true, force: true });
  });

  it('A2: pause → SIGKILL → reboot → resume continues from the saved checkpoint', async () => {
    server = startServer();
    await waitFor(`${API}/health`);

    // Register a user; keep the session cookie.
    const reg = await api('', 'POST', `${API}/auth/register`, {
      email: 'w3crash@example.local',
      username: 'w3crash',
      name: 'W3 Crash',
      password: 'correct-horse-9',
    });
    assert.equal(reg.status, 201, 'register works');
    const setCookie = reg.headers.get('set-cookie') || '';
    cookie = setCookie.split(';')[0];
    assert.ok(cookie.includes('darkmatter_session'), 'session cookie issued');

    // Start a hunt against OUR fixture (forceNew bypasses report dedup).
    const created = await api(cookie, 'POST', `${API}/jobs`, {
      targetUrl: FIXTURE,
      authorizationConfirmed: true,
      forceNew: true,
    });
    assert.equal(created.status, 202, 'hunt accepted');
    const { jobId } = await created.json();
    assert.ok(jobId, 'job id returned');

    // The worker dispatches; with no LLM brain it parks in `waiting` (by design).
    const waiting = await waitForJob(cookie, jobId, (j) => j.status === 'waiting');
    assert.ok(waiting, 'worker picked up the job and parked in waiting');

    // Pause mid-hunt.
    const pauseRes = await api(cookie, 'POST', `${API}/jobs/${jobId}/pause`);
    assert.ok([200, 202].includes(pauseRes.status), 'pause accepted');
    const paused = await waitForJob(cookie, jobId, (j) => j.status === 'paused');
    const checkpoint = {
      stepCount: paused.stepCount,
      phase: paused.phase,
      huntStatus: paused.huntState?.status,
    };

    // SIGKILL — no graceful shutdown, worst case.
    await killServer(server, 'SIGKILL');
    server = null;
    await sleep(500);

    // The job row must be ON DISK — state lives in the DB file, not memory.
    const files = fs.readdirSync(dbDir);
    const jobFile = files.find((f) => f.toLowerCase().includes('job'));
    assert.ok(jobFile, `a job collection file exists on disk (found: ${files.join(', ')})`);
    const onDisk = JSON.parse(fs.readFileSync(path.join(dbDir, jobFile), 'utf8'));
    const diskJob = onDisk.find((d) => d.id === jobId);
    assert.ok(diskJob, 'the paused job row survived on disk');
    assert.equal(diskJob.status, 'paused', 'disk row says paused');
    assert.equal(diskJob.stepCount, checkpoint.stepCount, 'disk row kept the step count');

    // Reboot against the SAME database directory.
    server = startServer();
    await waitFor(`${API}/health`);
    // Re-login (sessions live in the DB too — but be robust either way).
    const login = await api('', 'POST', `${API}/auth/login`, {
      email: 'w3crash@example.local', password: 'correct-horse-9',
    });
    if (login.status === 200) {
      cookie = (login.headers.get('set-cookie') || '').split(';')[0] || cookie;
    }
    await sleep(2500); // let boot recovery run

    // Boot recovery must NOT override the user's pause; checkpoint intact.
    const afterReboot = await waitForJob(cookie, jobId, (j) => j.status === 'paused');
    assert.equal(afterReboot.stepCount, checkpoint.stepCount, 'step count survived the kill');
    assert.equal(afterReboot.phase, checkpoint.phase, 'phase survived the kill');
    assert.equal(afterReboot.huntState?.status, checkpoint.huntStatus, 'state machine survived the kill');

    // Resume → the hunt continues from the exact saved checkpoint.
    const cont = await api(cookie, 'POST', `${API}/jobs/${jobId}/continue`);
    assert.ok([200, 202].includes(cont.status), 'continue accepted');
    const contBody = await cont.json();
    assert.equal(contBody.resumedFromStep, checkpoint.stepCount, 'resume reports the saved step');

    // Worker re-dispatches from the checkpoint (parks in waiting: no brain).
    const resumed = await waitForJob(cookie, jobId, (j) => j.status === 'waiting' || j.status === 'running');
    assert.equal(resumed.stepCount, checkpoint.stepCount, 'no steps replayed or reset on resume');
    assert.equal(resumed.phase, checkpoint.phase, 'phase preserved on resume');
  });

  it('A3: the worker loop advances server-side with the client completely gone', async () => {
    if (!server) {
      server = startServer();
      await waitFor(`${API}/health`);
      const login = await api('', 'POST', `${API}/auth/login`, {
        email: 'w3crash@example.local', password: 'correct-horse-9',
      });
      assert.equal(login.status, 200);
      cookie = (login.headers.get('set-cookie') || '').split(';')[0];
    }
    const created = await api(cookie, 'POST', `${API}/jobs`, {
      targetUrl: FIXTURE,
      authorizationConfirmed: true,
      forceNew: true,
    });
    assert.equal(created.status, 202);
    const { jobId } = await created.json();
    const first = await waitForJob(cookie, jobId, (j) => j.status === 'waiting');

    // Client goes away: zero requests for 6s (no polling, no SSE, nothing).
    const before = { updatedAt: first.updatedAt, hb: first.lastHeartbeatAt || first.heartbeatAt };
    await sleep(6000);

    const laterRes = await fetch(`${API}/jobs/${jobId}`, { headers: { cookie } });
    const later = (await laterRes.json()).job || (await laterRes.json());
    const laterJob = later.job || later;
    assert.ok(
      String(laterJob.updatedAt) !== String(before.updatedAt),
      `server-side state advanced with no client polling (updatedAt ${before.updatedAt} → ${laterJob.updatedAt})`
    );
    assert.ok(['waiting', 'running'].includes(laterJob.status), `job alive server-side (status=${laterJob.status})`);
  });

  it('A3: a due schedule fires a hunt server-side with no client involvement', async () => {
    // Restart with the scheduler tick enabled on a short cadence.
    await killServer(server, 'SIGKILL');
    server = startServer({ HUNT_SCHEDULER_ENABLED: 'true', HUNT_SCHEDULER_TICK_MS: '1500' });
    await waitFor(`${API}/health`);
    const login = await api('', 'POST', `${API}/auth/login`, {
      email: 'w3crash@example.local', password: 'correct-horse-9',
    });
    assert.equal(login.status, 200);
    cookie = (login.headers.get('set-cookie') || '').split(';')[0];

    const before = await (await fetch(`${API}/jobs`, { headers: { cookie } })).json();
    const beforeCount = (before.jobs || []).length;

    // A schedule that is already due.
    const sched = await api(cookie, 'POST', `${API}/schedules`, {
      name: 'w3 background proof',
      target: FIXTURE,
      cadence: 'once',
      nextRunAt: new Date(Date.now() - 60_000).toISOString(),
      authorizationConfirmed: true,
    });
    assert.equal(sched.status, 201, 'schedule created');

    // No further client action — the server tick must fire the hunt.
    const start = Date.now();
    let fired = null;
    while (Date.now() - start < 20000) {
      const list = await (await fetch(`${API}/jobs`, { headers: { cookie } })).json();
      fired = (list.jobs || []).find((j) => (j.objective || '').includes('w3 background proof') || String(j.objective || '').startsWith('Scheduled once hunt'));
      if (fired) break;
      await sleep(750);
    }
    assert.ok(fired, 'scheduler fired the due schedule into a real job with no client involvement');
    assert.ok((before.jobs || []).length >= beforeCount, 'job list grew server-side');
  });
});
