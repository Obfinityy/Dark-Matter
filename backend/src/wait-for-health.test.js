// Lane deploy-workflow (6 Nov 2026) — the SKIP/post-restart health check
// was a single curl: any downtime (manual restart in flight, transient
// first-start failure) failed the whole run. The fix retries with a
// bounded budget (wait-for-health.mjs). These tests spawn the script
// against stub HTTP servers: healthy at once, dead, coming up mid-wait
// (the restart-in-flight repro), always-500, and invalid args.

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const backendDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const script = path.join(backendDir, 'scripts', 'wait-for-health.mjs');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function freePort() {
  return new Promise((resolve) => {
    const s = http.createServer();
    s.listen(0, '127.0.0.1', () => {
      const port = s.address().port;
      s.close(() => resolve(port));
    });
  });
}

function serveOn(port, statusFn) {
  const server = http.createServer((req, res) => {
    const status = statusFn();
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: status === 200 }));
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

async function runWait(url, attempts, delayMs) {
  try {
    const { stdout } = await execFileAsync(process.execPath,
      [script, url, '--attempts', String(attempts), '--delay-ms', String(delayMs)],
      { cwd: backendDir, timeout: 20000 });
    return { code: 0, stdout, stderr: '' };
  } catch (err) {
    return { code: err.code, stdout: err.stdout || '', stderr: err.stderr || '' };
  }
}

test('healthy server exits 0 on the first attempt', async () => {
  const port = await freePort();
  const server = await serveOn(port, () => 200);
  try {
    const r = await runWait(`http://127.0.0.1:${port}/api/v1/health`, 3, 50);
    assert.equal(r.code, 0);
    assert.match(r.stdout, /healthy after 1 attempt/);
  } finally {
    server.close();
  }
});

test('dead port exits 1 after the attempt budget', async () => {
  const port = await freePort();
  const r = await runWait(`http://127.0.0.1:${port}/api/v1/health`, 3, 50);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /never became healthy after 3 attempt/);
});

test('server that comes up mid-wait exits 0 (restart-in-flight repro)', async () => {
  const port = await freePort();
  const run = runWait(`http://127.0.0.1:${port}/api/v1/health`, 20, 100);
  await sleep(350);
  const server = await serveOn(port, () => 200);
  try {
    const r = await run;
    assert.equal(r.code, 0);
    assert.match(r.stdout, /healthy after \d+ attempt/);
  } finally {
    server.close();
  }
});

test('server returning 500 exits 1 (non-2xx is not healthy)', async () => {
  const port = await freePort();
  const server = await serveOn(port, () => 500);
  try {
    const r = await runWait(`http://127.0.0.1:${port}/api/v1/health`, 3, 50);
    assert.equal(r.code, 1);
  } finally {
    server.close();
  }
});

test('invalid args exit 2 with usage', async () => {
  try {
    await execFileAsync(process.execPath,
      [script, 'http://127.0.0.1:1/', '--attempts', '0', '--delay-ms', '50'],
      { cwd: backendDir, timeout: 10000 });
    assert.fail('expected exit 2');
  } catch (err) {
    assert.equal(err.code, 2);
    assert.match(err.stderr, /--attempts must be >= 1/);
  }
});
