// Hunt-import regression — 118th deploy broke ALL hunt creation (10 Nov 2026).
//
// The P3 professionalisation split moved the hunt routes from
// backend/src/routes/hunts.js to backend/src/routes/hunts/*.js — one
// directory deeper — but left the DYNAMIC imports at the old `../` depth
// (static imports were fixed). The backend still booted (health ok) and
// the full suite stayed green because no test created a hunt end-to-end
// with real module resolution, so the breakage only surfaced live:
// POST /api/v1/hunts -> 500 validation_error ("Target validation failed"),
// journal: Cannot find module '.../src/routes/scopeParser.js'.
//
// Fixed by moving the 15 dynamic imports in routes/hunts/{create,control,
// list,report}.js from `../` to `../../` (`../scanner/` -> `../../scanner/`).
// These tests pin the fix two ways:
//   (a) HTTP: creating a hunt for a lab target returns 201 (was 500), and
//       a non-lab private target returns 403 ssrf_blocked (was 500) —
//       both prove the scopeParser import resolves AND is callable.
//   (b) Resolution: every one of the 15 fixed specifiers resolves from
//       the routes/hunts/ directory with the expected export, and the
//       old `../` specifiers do NOT resolve.
//
// No Meta calls, $0 spend. DATA_DIR points at a temp dir; the live hunt
// and the EC2 backend are untouched. The scanner hunt created in (a)
// runs host-side in the background against a tiny in-test stub server
// (127.0.0.1, ephemeral port) that answers every request instantly —
// the scan then finishes in seconds instead of burning the full probe
// timeouts against an unreachable address. Its findings are irrelevant
// to the assertions here; the stub is closed right after the 201, and
// the background scan fails its remaining probes fast on the refused
// connection.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

// DATA_DIR / JWT_SECRET / ENGINE_URL / LAB_TARGETS must be set BEFORE
// store/config/auth load.
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hunt-imports-'));
process.env.DATA_DIR = tmpRoot;
process.env.JWT_SECRET = 'hunt-imports-test-secret-1234';
process.env.ENGINE_URL = 'http://127.0.0.1:9'; // nothing listens: engine unreachable, fast fail
process.env.LAB_TARGETS = 'http://172.17.0.1:3000,http://172.17.0.1:3100';

const express = (await import('express')).default;
const huntsRouter = (await import('../hunts.js')).default;
const { issueToken } = await import('../auth.js');
const { writeUsers, readHuntMeta, writeHuntMeta } = await import('../../store.js');

const OWNER = { id: 'owner-1', username: 'owner', role: 'admin' };
writeUsers({
  owner: { id: OWNER.id, username: OWNER.username, role: OWNER.role, approved: true },
});

const LAB_TARGET_2 = 'http://172.17.0.1:3100';
const PRIVATE_TARGET = 'http://10.0.0.5/';

function mount() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/hunts', huntsRouter);
  return app;
}

async function listen(app) {
  return new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
}

const adminHeaders = {
  Authorization: `Bearer ${issueToken({ id: OWNER.id, username: OWNER.username, role: OWNER.role })}`,
  'Content-Type': 'application/json',
};

async function call(base, method, url, body) {
  const res = await fetch(`${base}${url}`, {
    method,
    headers: adminHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON body */ }
  return { status: res.status, json, text };
}

// (b) Resolution: all 15 fixed dynamic-import specifiers resolve ---------
// from the routes/hunts/ directory, with the expected export present.
// The old `../` depth must NOT resolve — that is the exact regression.

const EXPECTED_EXPORTS = [
  ['../../scopeParser.js', 'validateTargetAsync'],
  ['../../scopeParser.js', 'parseScope'],
  ['../../huntAgent.js', 'resumeInterruptedHunt'],
  ['../../huntAgent.js', 'runAutonomousHunt'],
  ['../../store.js', 'listHuntMetas'],
  ['../../store.js', 'enqueueHunt'],
  ['../../store.js', 'huntQueueFull'],
  ['../../store.js', 'appendHuntEvent'],
  ['../../store.js', 'readHuntMeta'],
  ['../../store.js', 'writeHuntMeta'],
  ['../../store.js', 'readQueue'],
  ['../../store.js', 'getQueuePosition'],
  ['../../store.js', 'removeFromQueue'],
  ['../../scopeGuard.js', 'buildScope'],
  ['../../humanLoopDriver.js', 'startHumanLoop'],
  ['../../scannerHunt.js', 'runScannerHunt'],
  ['../../scanner/agentReport.js', 'generateAgentReport'],
  ['../../scanner/agentChat.js', 'agentChatReply'],
  ['../../scanner/aiAnalysis.js', 'runAiAnalysis'],
];

test('(b) all fixed dynamic-import specifiers resolve from routes/hunts/ with the expected export', async () => {
  for (const [spec, exportName] of EXPECTED_EXPORTS) {
    const mod = await import(spec);
    assert.equal(
      typeof mod[exportName],
      'function',
      `${spec} must export function ${exportName}`,
    );
  }
});

test('(b) the old ../ depth does NOT resolve from routes/hunts/ (the 118th-deploy regression)', async () => {
  for (const spec of ['../scopeParser.js', '../store.js', '../huntAgent.js', '../scanner/agentReport.js']) {
    await assert.rejects(import(spec), /Cannot find module/, `${spec} must not resolve`);
  }
});

// (a) HTTP: hunt creation end-to-end ---------------------------------------

test('(a) POST /api/v1/hunts for a lab scanner target returns 201, not 500 validation_error', async () => {
  // Stub target: answers every request instantly so the background
  // scanner run finishes in seconds. The stub origin is added to
  // LAB_TARGETS (read fresh per request) so the SSRF lab exception
  // applies exactly as it does for the real Juice/DVWA labs.
  const stub = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(
      '<html><body><h1>stub lab</h1>' +
      '<a href="/page">page</a>' +
      '<form action="/search" method="get"><input name="q"></form>' +
      '</body></html>',
    );
  });
  await new Promise((resolve) => stub.listen(0, '127.0.0.1', resolve));
  const stubPort = stub.address().port;
  const stubTarget = `http://127.0.0.1:${stubPort}`;
  const prevLabTargets = process.env.LAB_TARGETS;
  process.env.LAB_TARGETS = `${prevLabTargets},${stubTarget}`;
  const server = await listen(mount());
  try {
    const base = `http://127.0.0.1:${server.address().port}/api/v1/hunts`;
    const r = await call(base, 'POST', '/', {
      target: stubTarget,
      confirmedAuthorized: true,
      brainMode: 'scanner',
      scanDepth: 'quick',
      forceNew: true,
    });
    assert.notEqual(r.status, 500, `must not be the 500 validation_error: ${r.text}`);
    assert.notEqual(r.json && r.json.error, 'validation_error', 'SSRF check must not fail on the import');
    assert.equal(r.status, 201, `expected 201, got ${r.status}: ${r.text}`);
    assert.equal(r.json.ok, true);
    assert.equal(typeof r.json.huntId, 'string');
    assert.match(r.json.huntId, /^h_/);
    assert.equal(r.json.brainMode, 'scanner');
    const meta = readHuntMeta(r.json.huntId);
    assert.ok(meta, 'hunt meta must be written');
    assert.equal(meta.target, stubTarget);
    assert.equal(meta.brainMode, 'scanner');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await new Promise((resolve) => stub.close(resolve));
    process.env.LAB_TARGETS = prevLabTargets;
  }
});

test('(a) POST /api/v1/hunts for a non-lab private target returns 403 ssrf_blocked, not 500', async () => {
  const server = await listen(mount());
  try {
    const base = `http://127.0.0.1:${server.address().port}/api/v1/hunts`;
    const r = await call(base, 'POST', '/', {
      target: PRIVATE_TARGET,
      confirmedAuthorized: true,
      brainMode: 'scanner',
      forceNew: true,
    });
    // 403 here proves validateTargetAsync was imported AND invoked: on the
    // broken tree the same request died at the import with 500.
    assert.equal(r.status, 403, `expected 403, got ${r.status}: ${r.text}`);
    assert.equal(r.json.error, 'ssrf_blocked');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('(a) GET /api/v1/hunts list works (list.js dynamic store import)', async () => {
  const server = await listen(mount());
  try {
    const base = `http://127.0.0.1:${server.address().port}/api/v1/hunts`;
    const r = await call(base, 'GET', '/');
    assert.equal(r.status, 200, `expected 200, got ${r.status}: ${r.text}`);
    assert.equal(r.json.ok, true);
    assert.ok(Array.isArray(r.json.hunts), 'hunts must be an array');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('(a) dedupe-resume branch works for a paused scanner hunt (create.js huntAgent import)', async () => {
  const pausedId = 'h_paused_imports_test';
  writeHuntMeta(pausedId, {
    huntId: pausedId,
    target: LAB_TARGET_2,
    userId: OWNER.id,
    state: 'paused',
    paused: true,
    brainMode: 'scanner',
    scanDepth: 'quick',
    createdAt: new Date().toISOString(),
  });
  const server = await listen(mount());
  try {
    const base = `http://127.0.0.1:${server.address().port}/api/v1/hunts`;
    const r = await call(base, 'POST', '/', {
      target: LAB_TARGET_2,
      confirmedAuthorized: true,
      brainMode: 'scanner',
      scanDepth: 'quick',
    });
    assert.equal(r.status, 200, `expected 200 reuse, got ${r.status}: ${r.text}`);
    assert.equal(r.json.reused, true);
    assert.equal(r.json.huntId, pausedId);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
