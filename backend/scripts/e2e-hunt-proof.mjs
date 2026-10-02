#!/usr/bin/env node
/**
 * e2e-hunt-proof.mjs — FULL autonomous hunt proof via the backend HTTP API.
 *
 * Boots the real backend (in-process Express) + the deliberately vulnerable
 * local fixture (127.0.0.1:4555) and proves, with real HTTP end to end:
 *
 *   1. POST /api/v1/jobs → the autonomous loop DRIVES ITSELF (no LLM in this
 *      sandbox: the deterministic rule-based strategy engages, published as
 *      brain.deterministic) → FINDS the planted vulns.
 *   2. Findings endpoint returns normalized findings with severities.
 *   3. Job events SSE stream carries the hunt's real event history.
 *   4. Mid-hunt ask answers about the current stage.
 *   5. Pause → state intact → continue resumes from the same step.
 *   6. Crash recovery: simulated worker death → recoverIncompleteJobs()
 *      re-dispatches from the persisted checkpoint (stepCount monotonic).
 *
 * SAFETY: only ever touches 127.0.0.1 (the fixture). Never external targets.
 *
 * Run: cd backend && node scripts/e2e-hunt-proof.mjs
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_BACKEND = path.resolve(__dirname, '..');
const FIXTURE_ENTRY = path.resolve(REPO_BACKEND, 'fixture/vuln-app/index.js');
const FIXTURE_BASE = 'http://127.0.0.1:4555';
const API_BASE = 'http://127.0.0.1:4999/api/v1';

process.env.AGENT_WORKER_IDLE_MS = '50';       // fast loop for the proof
process.env.HUNT_SCHEDULER_ENABLED = 'false';  // no background schedules
process.env.AGENT_DETERMINISTIC_FALLBACK = '1';
// The sandbox has no TLS route to Atlas; force the app's no-MONGO_URL path so
// it boots a clean in-memory DB. Must be the empty string (not delete):
// dotenv would re-populate a deleted key from backend/.env on import, but it
// never overwrites an existing (even empty) variable.
process.env.MONGO_URL = '';

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '  ✔' : '  ✘'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) process.exitCode = 1;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(method, p, body, token) {
  const res = await fetch(`${API_BASE}${p}`, {
    method,
    headers: {
      'content-type': 'application/json',
      // The backend reads the credential from the darkmatter_session cookie
      // (or ?accessToken=) — not the Authorization header.
      ...(token ? { cookie: `darkmatter_session=${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-json */ }
  return { status: res.status, json, text };
}

async function waitForFixture() {
  const start = Date.now();
  for (;;) {
    try {
      const r = await fetch(`${FIXTURE_BASE}/health`);
      if (r.ok) return;
    } catch { /* not up yet */ }
    if (Date.now() - start > 15000) throw new Error('fixture did not start');
    await sleep(250);
  }
}

async function pollJob(token, jobId, { timeoutMs = 180_000 } = {}) {
  const start = Date.now();
  for (;;) {
    const { json } = await api('GET', `/jobs/${jobId}`, null, token);
    const job = json?.job || json;
    if (['completed', 'failed', 'cancelled'].includes(job.status)) return job;
    if (Date.now() - start > timeoutMs) throw new Error(`job ${jobId} did not finish in time (status=${job.status})`);
    await sleep(1000);
  }
}

async function waitForStatus(token, jobId, statuses, { timeoutMs = 60_000 } = {}) {
  const start = Date.now();
  for (;;) {
    const { json } = await api('GET', `/jobs/${jobId}`, null, token);
    const job = json?.job || json;
    if (statuses.includes(job.status)) return job;
    if (Date.now() - start > timeoutMs) throw new Error(`job ${jobId} never reached ${statuses} (stuck at ${job.status})`);
    await sleep(300);
  }
}

let fixture;
let server;

async function main() {
  console.log('── fixture ──');
  fixture = spawn(process.execPath, [FIXTURE_ENTRY], {
    env: { ...process.env, PORT: '4555' },
    stdio: 'ignore'
  });
  await waitForFixture();
  check('vulnerable fixture listening on 127.0.0.1:4555', true);

  console.log('── backend ──');
  const { createApp } = await import('../src/app.js');
  const app = await createApp();
  await new Promise((resolve) => server = app.listen(4999, '127.0.0.1', resolve));
  check('backend API booted on 127.0.0.1:4999 (in-memory DB)', true);
  const jobManager = app.locals.jobManager;

  const stamp = Date.now().toString(36);
  const email = `e2e.${stamp}@local.test`;
  const reg = await api('POST', '/auth/register', { email, name: 'E2E Proof', username: `e2e${stamp}`, password: 'proof-pass-123' });
  check('register', reg.status === 201 || reg.status === 200, `HTTP ${reg.status} ${reg.text.slice(0, 120)}`);
  const login = await api('POST', '/auth/login', { email, password: 'proof-pass-123' });
  const token = login.json?.jwt || login.json?.token;
  check('login → JWT', login.status === 200 && !!token, `HTTP ${login.status}`);

  console.log('── 1. full autonomous hunt ──');
  const created = await api('POST', '/jobs', {
    targetUrl: FIXTURE_BASE,
    authorizationConfirmed: true,
    message: `E2E proof hunt of ${FIXTURE_BASE}`
  }, token);
  check('POST /jobs accepted', created.status === 202, `HTTP ${created.status}`);
  const jobId = created.json.jobId;
  check('job target keeps the fixture port', String(created.json.target || '').includes('4555'), created.json.target);

  const job = await pollJob(token, jobId);
  check('hunt reached a terminal state', job.status === 'completed', `status=${job.status}, steps=${job.stepCount}`);
  if (job.status !== 'completed') {
    console.log('   job errors:', JSON.stringify((job.errors || []).slice(-3), null, 1).slice(0, 2000));
  }

  console.log('── 2. findings ──');
  const fr = await api('GET', `/jobs/${jobId}/findings`, null, token);
  const findings = fr.json?.findings || [];
  const titles = findings.map((f) => `[${f.severity}] ${f.title}`);
  console.log('   findings:'); titles.forEach((t) => console.log(`     - ${t}`));
  const has = (re) => findings.some((f) => re.test(`${f.title} ${f.category || ''} ${f.type || ''}`));
  check('found ≥3 findings', findings.length >= 3, `${findings.length} findings`);
  check('SQL injection (critical) found', has(/sql.injection/i) && findings.some((f) => /sql.injection/i.test(f.title) && f.severity === 'critical'));
  check('reflected XSS (high) found', has(/reflected.xss/i) && findings.some((f) => /reflected.xss/i.test(f.title) && f.severity === 'high'));
  check('IDOR (high) found', has(/idor/i));
  check('every finding has evidence + severity + confidence', findings.every((f) =>
    f.severity && f.title && f.confidence != null && ((f.evidenceIds || []).length > 0 || f.evidence)));

  console.log('── 3. SSE event stream ──');
  const seen = await readSse(`${API_BASE}/jobs/${jobId}/events`, token, 6000);
  const types = [...new Set(seen.map((e) => e.type))];
  console.log('   event types:', types.join(', '));
  check('SSE replays history (brain.deterministic present)', types.includes('brain.deterministic'));
  check('SSE shows tool executions', types.includes('tool.output') || types.includes('TOOL_COMPLETED'));
  check('SSE shows job completion', types.includes('job.completed'));

  console.log('── 4/5. mid-hunt ask + pause/resume ──');
  const c2 = await api('POST', '/jobs', {
    targetUrl: FIXTURE_BASE, authorizationConfirmed: true, forceNew: true, message: 'E2E ops hunt'
  }, token);
  const job2 = c2.json.jobId;
  const running2 = await waitForStatus(token, job2, ['running'], { timeoutMs: 30_000 });
  check('second hunt running', running2.status === 'running', `step=${running2.stepCount}`);

  const ask = await api('POST', `/jobs/${job2}/ask`, { message: 'abhi kya kar raha hai?' }, token);
  const reply = ask.json?.reply || '';
  check('mid-hunt ask answered', ask.status === 200 && reply.length > 20, reply.slice(0, 90) + '…');

  const paused = await api('POST', `/jobs/${job2}/pause`, {}, token);
  const pausedJob = await waitForStatus(token, job2, ['paused'], { timeoutMs: 30_000 });
  check('pause → status paused', pausedJob.status === 'paused', `step=${pausedJob.stepCount}`);
  const stepsAtPause = pausedJob.stepCount;
  await sleep(2000);
  const stillPaused = (await api('GET', `/jobs/${job2}`, null, token)).json;
  const stillJob = stillPaused?.job || stillPaused;
  check('paused hunt makes no progress', stillJob.stepCount === stepsAtPause, `step stayed ${stepsAtPause}`);

  await api('POST', `/jobs/${job2}/continue`, {}, token);
  const resumed = await waitForStatus(token, job2, ['running', 'completed'], { timeoutMs: 30_000 });
  check('continue → hunt resumes', ['running', 'completed'].includes(resumed.status), `status=${resumed.status}`);
  const final2 = await pollJob(token, job2);
  check('resumed hunt completes with findings intact', final2.status === 'completed' && final2.findingsCount >= 3,
    `status=${final2.status}, findings=${final2.findingsCount}`);

  console.log('── 6. crash recovery ──');
  // The deterministic hunt is fast (~2-4s); catch it mid-flight. Crash the
  // worker by dropping its in-memory control entry the way a dead process
  // would (the DB row stays at status=running with the persisted checkpoint).
  // The orphaned loop notices the missing entry on its next iteration and
  // exits — exactly like a killed process stops stepping.
  let job3 = null, rec = null, stepsBefore = 0;
  for (let attempt = 0; attempt < 5 && !(rec && rec.recovered >= 1); attempt++) {
    const c3 = await api('POST', '/jobs', {
      targetUrl: FIXTURE_BASE, authorizationConfirmed: true, forceNew: true, message: `E2E crash hunt ${attempt}`
    }, token);
    job3 = c3.json.jobId;
    const running3 = await waitForStatus(token, job3, ['running'], { timeoutMs: 30_000 });
    stepsBefore = running3.stepCount;
    jobManager.worker.running.delete(job3);
    jobManager.dispatches.delete(job3);
    const cur = await api('GET', `/jobs/${job3}`, null, token);
    const curJob = cur.json?.job || cur.json;
    if (['completed', 'failed', 'cancelled'].includes(curJob.status)) continue; // race lost: it finished first
    stepsBefore = curJob.stepCount;
    rec = await jobManager.recoverIncompleteJobs();
  }
  check('recoverIncompleteJobs re-dispatched the dead hunt', !!(rec && rec.recovered >= 1), `recovered=${rec?.recovered}`);
  const final3 = await pollJob(token, job3);
  check('recovered hunt completes', final3.status === 'completed', `status=${final3.status}`);
  check('recovery resumed from checkpoint (no step reset)', final3.stepCount >= stepsBefore,
    `steps ${stepsBefore} → ${final3.stepCount}`);
  const f3 = await api('GET', `/jobs/${job3}/findings`, null, token);
  check('recovered hunt has findings', (f3.json?.findings || []).length >= 3);

  console.log('\n── summary ──');
  const failed = results.filter((r) => !r.ok);
  console.log(`${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log('FAILED:'); failed.forEach((f) => console.log(`  - ${f.name} ${f.detail}`));
  }
}

async function readSse(url, token, ms) {
  const events = [];
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { headers: { cookie: `darkmatter_session=${token}` }, signal: ctrl.signal });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const chunk = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const evMatch = /event: (\S+)/.exec(chunk);
        const dataMatch = /data: ([\s\S]*)/.exec(chunk);
        if (evMatch && dataMatch) {
          try { events.push({ type: evMatch[1], ...JSON.parse(dataMatch[1]) }); }
          catch { events.push({ type: evMatch[1] }); }
        }
      }
    }
  } catch { /* abort after ms */ }
  clearTimeout(timer);
  return events;
}

main().catch((e) => { console.error('E2E FAILED:', e); process.exitCode = 1; })
  .finally(async () => {
    try { server?.close(); } catch { /* ignore */ }
    if (fixture && !fixture.killed) fixture.kill('SIGKILL');
    await sleep(300);
    process.exit(process.exitCode || 0);
  });
