// oauth-lab serverFetch cap test — a response over FETCH_MAX_BYTES
// (8192) must still settle the fetch instead of hanging the
// registration forever.
//
// Regression test for the proof #41 OAuth re-proof miss (10 Nov
// 2026): serverFetch destroyed the response stream when the body
// exceeded 8192 bytes but had no 'close' handler, so 'end' never
// fired and the promise never settled. handleClientRegister awaited
// it forever, the 201 never came, and nothing was logged — the
// probe's #493 SSRF check (dynamic client registration) failed
// whenever its canary URLs answered with a large body (Juice SPA,
// ~80KB), while small-body URIs registered in 34ms.
//
// Runs the real server as a child process on a scratch port (same
// pattern as labs/llm-lab/server.test.js) plus a local origin
// serving a >8KB body. Run: node --test labs/oauth-lab/server.test.js
'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');

const LAB_PORT = 3697;
const ORIGIN_PORT = 3696;
const LAB_URL = `http://127.0.0.1:${LAB_PORT}`;
const ORIGIN_URL = `http://127.0.0.1:${ORIGIN_PORT}`;

const BIG_BODY = 'x'.repeat(20 * 1024); // 20KB — over the 8192-byte cap
const SMALL_BODY = JSON.stringify({ ok: true, small: 'body' });

let labProc = null;
let origin = null;

async function waitForHealth(url, tries = 50) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

// POST with a short client timeout: on unfixed code the registration
// hangs forever, so the timeout makes the test fail fast instead of
// hanging the suite.
async function postJson(url, body, timeoutMs = 5000) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function fetchLog() {
  const res = await fetch(`${LAB_URL}/api/admin/fetch-log`);
  const json = await res.json();
  return Array.isArray(json.fetches) ? json.fetches : [];
}

before(async () => {
  origin = http.createServer((req, res) => {
    // The lab destroys the stream mid-body once the cap trips; the
    // origin must not crash on the reset socket.
    res.on('error', () => {});
    if (req.url.startsWith('/big')) {
      // Stream the 20KB body in 4KB chunks with gaps: the cap trips
      // on the third chunk (12KB > 8192) while more body is still
      // pending, so the lab's stream is cut mid-body — the live
      // Juice failure mode. A single buffered write would let the
      // whole body arrive first and 'end' would win the settle race.
      res.writeHead(200, { 'Content-Type': 'text/html' });
      const chunk = BIG_BODY.slice(0, 4 * 1024);
      let sent = 0;
      const timer = setInterval(() => {
        if (res.destroyed || sent >= 5) { clearInterval(timer); if (!res.destroyed) res.end(); return; }
        sent += 1;
        res.write(chunk);
      }, 50);
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(SMALL_BODY);
    }
  });
  await new Promise((resolve) => origin.listen(ORIGIN_PORT, '127.0.0.1', resolve));
  labProc = spawn(process.execPath, [path.join(__dirname, 'server.js')], {
    env: { ...process.env, PORT: String(LAB_PORT) },
    stdio: 'ignore',
  });
  const up = await waitForHealth(`${LAB_URL}/health`);
  assert.ok(up, 'oauth-lab must answer /health before tests run');
});

after(async () => {
  if (labProc && !labProc.killed) labProc.kill('SIGTERM');
  if (origin) await new Promise((resolve) => origin.close(resolve));
});

test('dynamic registration settles when canary URIs answer with >8KB bodies', async () => {
  const canary = `dm-big-${Date.now().toString(36)}`;
  const big = (p) => `${ORIGIN_URL}/big/${p}?${canary}`;
  let reg;
  try {
    reg = await postJson(`${LAB_URL}/oauth/register`, {
      client_name: `dm-canary-${canary}`,
      redirect_uris: ['http://localhost/cb'],
      jwks_uri: big('jwks.json'),
      logo_uri: big('logo.png'),
      sector_identifier_uri: big('sector.json'),
    });
  } catch (e) {
    assert.fail(`registration with large-body URIs must answer instead of hanging (got ${e.name})`);
  }
  assert.equal(reg.status, 201, 'registration must return 201');
  assert.ok(Array.isArray(reg.json.fetched), 'registration must report its fetches');
  const fetched = reg.json.fetched.filter((f) => f && typeof f.url === 'string' && f.url.includes(canary));
  assert.equal(fetched.length, 3, 'all three canary fetches must be reported');
  for (const f of fetched) {
    assert.ok(f.bytes > 8192, `capped fetch must record the bytes observed so far (got ${f.bytes})`);
    assert.equal(f.error, 'max-bytes-exceeded', 'capped fetch must record why it stopped early');
    assert.equal(f.status, 200, 'capped fetch must record the status observed');
  }
  const logged = (await fetchLog()).filter((f) => f && typeof f.url === 'string' && f.url.includes(canary));
  assert.equal(logged.length, 3, 'all three canary fetches must be in the fetch log');
});

test('dynamic registration still records small-body fetches normally', async () => {
  const canary = `dm-small-${Date.now().toString(36)}`;
  const small = (p) => `${ORIGIN_URL}/small/${p}?${canary}`;
  const reg = await postJson(`${LAB_URL}/oauth/register`, {
    client_name: `dm-canary-${canary}`,
    redirect_uris: ['http://localhost/cb'],
    jwks_uri: small('jwks.json'),
    logo_uri: small('logo.png'),
    sector_identifier_uri: small('sector.json'),
  });
  assert.equal(reg.status, 201, 'registration must return 201');
  const fetched = (reg.json.fetched || []).filter((f) => f && typeof f.url === 'string' && f.url.includes(canary));
  assert.equal(fetched.length, 3, 'all three canary fetches must be reported');
  for (const f of fetched) {
    assert.equal(f.status, 200, 'small fetch must record its status');
    assert.equal(f.error, null, 'small fetch must carry no error');
    assert.ok(f.bytes > 0 && f.bytes <= 8192, `small fetch must record its bytes (got ${f.bytes})`);
  }
  const logged = (await fetchLog()).filter((f) => f && typeof f.url === 'string' && f.url.includes(canary));
  assert.equal(logged.length, 3, 'all three canary fetches must be in the fetch log');
});
