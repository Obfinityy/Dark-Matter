// Lab for the MODE FIX lane (27 Oct 2026).
//
// Boots the REAL backend (child process, tmp DATA_DIR, admin user
// from env bootstrap) and proves, end to end — no live api.meta.ai
// call, no credit burn, no docker (the created hunts degrade
// gracefully without a container, exactly as in the lab for the
// budget cap):
//
//   1. GET /api/v1/hunts returns `mode` for every hunt — the real
//      stored mode for human/normal hunts, 'normal' for a legacy
//      hunt whose meta predates mode.
//   2. POST /api/v1/hunts {mode:'human'} creates a human-mode hunt:
//      meta.mode 'human', meta.humanMode true, meta.loop enabled —
//      so the continuous human loop starts without a manual resume.
//   3. POST with 'infinity' keeps 'infinity' (no human flag, no
//      loop record); POST with a bogus mode or no mode falls back
//      to 'normal' (getMode behaviour, unchanged).
//   4. A fresh human-mode create leaves the source hunt untouched.
//
// Run: node backend/scripts/lab-mode-fix.mjs
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-mode-fix-'));
process.env.DATA_DIR = tmp;
const PORT = 4624;
const HUMAN_SEED = 'h_mode_lab_human';
const NORMAL_SEED = 'h_mode_lab_normal';
const LEGACY_SEED = 'h_mode_lab_legacy';

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

const { writeHuntMeta, readHuntMeta } = await import('../src/store.js');

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

  // ---- seed hunts: human, normal, and a legacy hunt with no mode --------
  writeHuntMeta(HUMAN_SEED, {
    huntId: HUMAN_SEED, target: 'https://human-seed.example.com', userId: adminId,
    state: 'paused', iteration: 42, mode: 'human', humanMode: true,
    loop: { enabled: true, cycles: 7, lastCycleAt: '2026-10-27T00:00:00.000Z' },
  });
  writeHuntMeta(NORMAL_SEED, {
    huntId: NORMAL_SEED, target: 'https://normal-seed.example.com', userId: adminId,
    state: 'paused', iteration: 3, mode: 'normal',
  });
  writeHuntMeta(LEGACY_SEED, {
    huntId: LEGACY_SEED, target: 'https://legacy-seed.example.com', userId: adminId,
    state: 'paused', iteration: 1,
  });

  // ---- 1. the list carries mode -------------------------------------------
  const list = await api('GET', '/api/v1/hunts', token);
  check('GET /hunts succeeds', list.status === 200 && Array.isArray(list.data.hunts));
  const byId = new Map((list.data.hunts || []).map((h) => [h.huntId, h]));
  check('list returns mode human for the human hunt', byId.get(HUMAN_SEED)?.mode === 'human');
  check('list returns mode normal for the normal hunt', byId.get(NORMAL_SEED)?.mode === 'normal');
  check('list falls back to normal for the legacy hunt (no mode stored)', byId.get(LEGACY_SEED)?.mode === 'normal');
  check('every listed hunt carries a mode string', (list.data.hunts || []).every((h) => typeof h.mode === 'string' && h.mode));

  // ---- 2. creating with mode human stays human, loop enabled --------------
  const humanSeedBefore = JSON.stringify(readHuntMeta(HUMAN_SEED));
  const created = await api('POST', '/api/v1/hunts', token, {
    target: 'https://fresh-human.example.com', scope: '', confirmedAuthorized: true, mode: 'human', fresh: true,
  });
  check('POST human create returns 201 with a NEW huntId', created.status === 201 && typeof created.data.huntId === 'string' && created.data.huntId !== HUMAN_SEED);
  const newId = created.data.huntId;
  const newMeta = readHuntMeta(newId);
  check("fresh human hunt meta.mode is 'human'", newMeta && newMeta.mode === 'human');
  check('fresh human hunt meta.humanMode is true', newMeta && newMeta.humanMode === true);
  check('fresh human hunt meta.loop is enabled at creation', !!(newMeta && newMeta.loop && newMeta.loop.enabled === true));
  const list2 = await api('GET', '/api/v1/hunts', token);
  const freshListed = (list2.data.hunts || []).find((h) => h.huntId === newId);
  check('list shows the fresh hunt as human', freshListed && freshListed.mode === 'human');
  check('source human hunt untouched by the fresh create', JSON.stringify(readHuntMeta(HUMAN_SEED)) === humanSeedBefore);

  // ---- 3. other modes resolve exactly as before ---------------------------
  const inf = await api('POST', '/api/v1/hunts', token, {
    target: 'https://fresh-inf.example.com', scope: '', confirmedAuthorized: true, mode: 'infinity', fresh: true,
  });
  check("POST infinity stays 'infinity'", inf.status === 201 && readHuntMeta(inf.data.huntId).mode === 'infinity');
  check('infinity hunt gets no human flag and no loop record', (() => {
    const m = readHuntMeta(inf.data.huntId);
    return m && m.humanMode === undefined && m.loop === undefined;
  })());
  const bogus = await api('POST', '/api/v1/hunts', token, {
    target: 'https://fresh-bogus.example.com', scope: '', confirmedAuthorized: true, mode: 'bogus', fresh: true,
  });
  check("POST bogus mode falls back to 'normal'", bogus.status === 201 && readHuntMeta(bogus.data.huntId).mode === 'normal');
  const nomode = await api('POST', '/api/v1/hunts', token, {
    target: 'https://fresh-nomode.example.com', scope: '', confirmedAuthorized: true, fresh: true,
  });
  check("POST with no mode falls back to 'normal'", nomode.status === 201 && readHuntMeta(nomode.data.huntId).mode === 'normal');
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
  await new Promise((r) => setTimeout(r, 500));
  try {
    child.kill('SIGKILL');
  } catch { /* already gone */ }
}
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`);
if (failures !== 0) console.log('--- backend log (tail) ---\n' + childLog.slice(-2000));
process.exit(failures === 0 ? 0 : 1);
