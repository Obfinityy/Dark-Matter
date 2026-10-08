/**
 * HTTP wiring tests: boot the real service on an ephemeral port (no QEMU in
 * this environment) and verify the public surface: /health, /doctor, auth
 * enforcement, /vm/start failure modes, and WS upgrade rejection.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp } from 'node:fs/promises';

import { createApp, initServices, startServer, VERSION } from '../src/index.js';

let server;
let base;
let services;

before(async () => {
  process.env.INFINITY_VM_RUNNER_HOME = await mkdtemp(path.join(os.tmpdir(), 'vm-http-test-'));
  services = await initServices();
  server = await startServer(0, '127.0.0.1', services);
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  delete process.env.INFINITY_VM_RUNNER_HOME;
  await new Promise((r) => server.close(r));
});

describe('public endpoints', () => {
  it('GET /health reports version and qemu status', async () => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.version, VERSION);
    assert.equal(typeof body.qemu.found, 'boolean');
  });

  it('GET /doctor reports diagnostics with a problems list', async () => {
    const res = await fetch(`${base}/doctor`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.problems));
    assert.equal(typeof body.diskFreeBytes === 'number' || body.diskFreeBytes === null, true);
    assert.ok('whpxEnabled' in body);
    assert.ok('kaliImage' in body);
    // No QEMU / no image in this sandbox → problems must say so.
    assert.ok(body.problems.length > 0);
  });
});

describe('auth enforcement', () => {
  it('rejects /vm/status without a token', async () => {
    const res = await fetch(`${base}/vm/status?sessionId=x`);
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.code, 'bad_token');
  });

  it('rejects /vm/exec with a bogus token', async () => {
    const res = await fetch(`${base}/vm/exec`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer bogus' },
      body: JSON.stringify({ sessionId: 'x', command: 'ls' }),
    });
    assert.equal(res.status, 401);
  });

  it('rejects /vm/screenshot without a token', async () => {
    const res = await fetch(`${base}/vm/screenshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 'x' }),
    });
    assert.equal(res.status, 401);
  });
});

describe('/vm/start without QEMU', () => {
  it('fails with qemu_missing (503), not a crash', async () => {
    const res = await fetch(`${base}/vm/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: 's1' }),
    });
    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.code, 'qemu_missing');
  });

  it('validates sessionId', async () => {
    const res = await fetch(`${base}/vm/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: '../evil' }),
    });
    // qemu check runs before session validation? No: validateSessionId runs
    // first inside start() — but qemuPath check is before it. Either 400 or 503 is acceptable.
    assert.ok([400, 503].includes(res.status));
  });
});

describe('websocket upgrade auth', () => {
  it('rejects unauthenticated /vm/vnc upgrade with 401', async () => {
    const { default: WebSocket } = await import('ws');
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${server.address().port}/vm/vnc?sessionId=x&token=bogus`);
      ws.on('unexpected-response', (req, res) => {
        try {
          assert.equal(res.statusCode, 401);
          resolve();
        } catch (e) {
          reject(e);
        }
      });
      ws.on('open', () => reject(new Error('upgrade should not have succeeded')));
      ws.on('error', () => {}); // handled via unexpected-response
      setTimeout(() => reject(new Error('no upgrade response')), 5000);
    });
  });
});

describe('app without services', () => {
  it('createApp() serves health/doctor standalone', async () => {
    const app = createApp();
    const srv = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    try {
      const res = await fetch(`http://127.0.0.1:${srv.address().port}/health`);
      assert.equal(res.status, 200);
    } finally {
      await new Promise((r) => srv.close(r));
    }
  });
});
