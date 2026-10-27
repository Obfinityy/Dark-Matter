// Lab for the BUDGET CAP lane (27 Oct 2026, owner order).
//
// Boots the REAL backend (child process, tmp DATA_DIR, admin user
// from env bootstrap) and proves, end to end with MOCKED Meta spend
// only — no live api.meta.ai call, no credit burn:
//
//   1. Meta spend recorded via recordCost prices into getHuntCost.
//   2. POST /:id/budget sets / validates / clears the budget.
//   3. checkBudget (real store) pauses at the budget with a
//      checkpoint + a budget_reached event; raising the budget
//      lifts the hold; the check passes again.
//   4. POST /hunts {fresh:true} creates a brand-new hunt for the
//      same target — new huntId, fresh memory, old hunt untouched.
//
// Run: node backend/scripts/lab-budget-cap.mjs
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-budget-cap-'));
process.env.DATA_DIR = tmp;
const PORT = 4623;
const HUNT = 'h_budget_lab';
const TARGET = 'https://example.com';

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

const { recordCost, getHuntCost } = await import('../src/costTracker.js');
const { checkBudget } = await import('../src/budgetCap.js');
const { writeHuntMeta, readHuntMeta, readHuntEvents } = await import('../src/store.js');

// ---- boot the real backend (child) with an admin user ---------------------
const salt = crypto.randomBytes(16);
const hash = crypto.scryptSync('lab-admin-pass-123', salt, 64).toString('hex');
const child = spawn(process.execPath, [path.join(here, '..', 'src', 'server.js')], {
  env: {
    ...process.env,
    PORT: String(PORT),
    DATA_DIR: tmp,
    LAB_TARGETS: 'example.com',
    ADMIN_USERNAME: 'labadmin',
    ADMIN_PASSWORD_SALT: salt.toString('hex'),
    ADMIN_PASSWORD_HASH: hash,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let childLog = '';
child.stdout.on('data', (d) => { childLog += d; });
child.stderr.on('data', (d) => { childLog += d; });

const base = `http://127.0.0.1:${PORT}`;
async function waitHealthy() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${base}/api/v1/health`);
      if (r.ok) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}
async function api(method, p, token, body) {
  const r = await fetch(`${base}${p}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try {
    data = await r.json();
  } catch { /* non-JSON */ }
  return { status: r.status, data };
}

let token = null;
let adminId = null;
try {
  check('backend boots + health OK', await waitHealthy());
  const login = await api('POST', '/api/v1/auth/login', null, { username: 'labadmin', password: 'lab-admin-pass-123' });
  check('admin login works', login.status === 200 && !!login.data.token);
  token = login.data.token;
  adminId = login.data.user && login.data.user.id;

  // ---- the lab hunt: paused at iteration 42, owned by the admin ---------
  writeHuntMeta(HUNT, {
    huntId: HUNT, target: TARGET, userId: adminId,
    state: 'paused', iteration: 42, mode: 'human', humanMode: true,
  });

  // ---- 1. mocked Meta spend prices into the hunt's cost ------------------
  recordCost({ userId: adminId, huntId: HUNT, kind: 'meta', model: 'muse-spark-1.3', inputTokens: 2000, outputTokens: 1000, note: 'meta-model-api' });
  recordCost({ userId: adminId, huntId: HUNT, kind: 'meta', model: 'muse-spark-1.3', inputTokens: 2000, outputTokens: 1000, note: 'meta-model-api' });
  check('mocked Meta spend totals $0.0135', getHuntCost(HUNT).totalUsd === 0.0135);
  const cost0 = await api('GET', `/api/v1/hunts/${HUNT}/cost`, token);
  check('GET cost returns the Meta spend', cost0.status === 200 && cost0.data.totalUsd === 0.0135 && cost0.data.metaUsd === 0.0135);
  check('GET cost shows no budget yet', cost0.data.budgetUsd === null);

  // ---- 2. budget route: set / validate / clear ---------------------------
  const bad1 = await api('POST', `/api/v1/hunts/${HUNT}/budget`, token, { budgetUsd: -5 });
  check('negative budget rejected (400)', bad1.status === 400 && bad1.data.error === 'invalid_budget');
  const bad2 = await api('POST', `/api/v1/hunts/${HUNT}/budget`, token, { budgetUsd: 'abc' });
  check('junk budget rejected (400)', bad2.status === 400 && bad2.data.error === 'invalid_budget');
  const noAuth = await api('POST', `/api/v1/hunts/${HUNT}/budget`, null, { budgetUsd: 10 });
  check('budget route needs auth (401)', noAuth.status === 401);
  const noHunt = await api('POST', '/api/v1/hunts/h_nope/budget', token, { budgetUsd: 10 });
  check('budget route 404s on an unknown hunt', noHunt.status === 404);

  const set = await api('POST', `/api/v1/hunts/${HUNT}/budget`, token, { budgetUsd: 0.01 });
  check('budget $0.01 sets (200)', set.status === 200 && set.data.budgetUsd === 0.01 && set.data.spentUsd === 0.0135);
  const cost1 = await api('GET', `/api/v1/hunts/${HUNT}/cost`, token);
  check('GET cost now shows the budget', cost1.data.budgetUsd === 0.01);

  // ---- 3. the check pauses at the budget with checkpoint + event --------
  check('checkBudget trips at $0.0135 spent of a $0.01 budget', checkBudget(HUNT) === false);
  const pausedMeta = readHuntMeta(HUNT);
  check('paused meta: state paused + reason budget_reached', pausedMeta.state === 'paused' && pausedMeta.paused === true && pausedMeta.pausedReason === 'budget_reached');
  check('checkpoint kept the iteration (42, not 1)', pausedMeta.iteration === 42);
  const evts = readHuntEvents(HUNT);
  check('budget_reached status event recorded', evts.some((e) => e.type === 'status' && e.reason === 'budget_reached' && e.budgetUsd === 0.01 && e.spentUsd === 0.0135));

  // ---- raise the budget: hold lifts, the check passes again --------------
  const raise = await api('POST', `/api/v1/hunts/${HUNT}/budget`, token, { budgetUsd: 10 });
  check('budget raised to $10 (200)', raise.status === 200 && raise.data.budgetUsd === 10);
  check('checkBudget passes under the raised budget', checkBudget(HUNT) === true);
  check('stale budget_reached reason cleared', (readHuntMeta(HUNT).pausedReason || null) === null);
  const clear = await api('POST', `/api/v1/hunts/${HUNT}/budget`, token, { budgetUsd: null });
  check('budget clears with null', clear.status === 200 && clear.data.budgetUsd === null);

  // ---- 4. fresh start: new hunt, fresh memory, old hunt untouched -------
  const oldMetaBefore = JSON.stringify(readHuntMeta(HUNT));
  const oldEventsBefore = readHuntEvents(HUNT).length;
  const fresh = await api('POST', '/api/v1/hunts', token, {
    target: TARGET, scope: '', confirmedAuthorized: true, mode: 'normal', fresh: true,
  });
  check('fresh create returns 201 with a NEW huntId', fresh.status === 201 && typeof fresh.data.huntId === 'string' && fresh.data.huntId !== HUNT);
  check('fresh create reports fresh:true, not reused', fresh.data.fresh === true && !fresh.data.reused);
  const newId = fresh.data.huntId;
  // Let the new hunt's degraded loop settle (no docker in the lab).
  await new Promise((r) => setTimeout(r, 1500));
  check('old hunt meta untouched by the fresh create', JSON.stringify(readHuntMeta(HUNT)) === oldMetaBefore);
  check('old hunt events untouched by the fresh create', readHuntEvents(HUNT).length === oldEventsBefore);
  const newMeta = readHuntMeta(newId);
  check('new hunt has its own meta, no budget carried over', !!newMeta && newMeta.target === TARGET && (newMeta.budgetUsd === undefined || newMeta.budgetUsd === null));
  check('new hunt memory is fresh (no budget_reached marker)', !readHuntEvents(newId).some((e) => e.reason === 'budget_reached'));
} catch (err) {
  console.log('FAIL  lab threw:', err && err.message);
  console.log(String((err && err.stack) || '').split('\n').slice(0, 5).join('\n'));
  failures++;
} finally {
  try {
    child.kill('SIGTERM');
  } catch { /* already gone */ }
}

if (!child.killed) {
  // Give the child a moment to die, then force it — the lab must exit.
  await new Promise((r) => setTimeout(r, 500));
  try {
    child.kill('SIGKILL');
  } catch { /* already gone */ }
}
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`);
if (failures !== 0) console.log('--- backend log (tail) ---\n' + childLog.slice(-2000));
process.exit(failures === 0 ? 0 : 1);
