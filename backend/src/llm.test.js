// isInferenceActive — the brain-busy signal (CHAT-ANSWERS, 26 Oct 2026).
//
// chatWithOllama writes a heartbeat file carrying a deadline while a
// generation runs and deletes it when done. A fresh heartbeat means
// the one shared 8B is occupied — a chat question sent now would
// queue behind the running hunt turn and die at the deadline.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { isInferenceActive, isOllamaConnectionError, waitForOllamaReady, writeInferenceHeartbeat } from './llm.js';

function withHeartbeatFile(contents, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-hb-'));
  const file = path.join(dir, 'hb.json');
  if (contents !== null) fs.writeFileSync(file, contents);
  const prev = process.env.AI_HEARTBEAT_PATH;
  process.env.AI_HEARTBEAT_PATH = file;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.AI_HEARTBEAT_PATH;
    else process.env.AI_HEARTBEAT_PATH = prev;
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('fresh heartbeat means busy', () => {
  const fresh = withHeartbeatFile(
    JSON.stringify({ startedAt: new Date().toISOString(), deadline: Date.now() + 600000, huntId: 'h_x' }),
    () => isInferenceActive()
  );
  assert.equal(fresh, true);
});

test('stale heartbeat means not busy', () => {
  const stale = withHeartbeatFile(
    JSON.stringify({ startedAt: new Date().toISOString(), deadline: Date.now() - 1000, huntId: 'h_x' }),
    () => isInferenceActive()
  );
  assert.equal(stale, false);
});

test('missing, unreadable or malformed heartbeat means not busy', () => {
  assert.equal(withHeartbeatFile(null, () => isInferenceActive()), false);
  assert.equal(withHeartbeatFile('not json{', () => isInferenceActive()), false);
  assert.equal(withHeartbeatFile(JSON.stringify({ startedAt: 'x' }), () => isInferenceActive()), false);
});

// READINESS-AWARE RETRY (Infinity level, 26 Oct 2026) — the no-reply
// root cause: the kernel OOM-kills llama-server and the model reload
// takes ~176s, so an immediate retry hits ECONNREFUSED and the turn
// dies. A connection failure now waits for GET /api/tags to answer
// again before the single retry.

test('isOllamaConnectionError: connection failures yes, slow-model deadlines no', () => {
  const refused = new Error('connect ECONNREFUSED 127.0.0.1:11434');
  refused.code = 'ECONNREFUSED';
  assert.equal(isOllamaConnectionError(refused), true);
  const hangup = new Error('socket hang up');
  hangup.code = 'ECONNRESET';
  assert.equal(isOllamaConnectionError(hangup), true);
  assert.equal(isOllamaConnectionError(new Error('socket hang up')), true, 'message alone classifies');
  assert.equal(isOllamaConnectionError(new Error('ollama chat deadline 300000ms exceeded')), false, 'a deadline means the server was alive but slow');
  assert.equal(isOllamaConnectionError(new Error('unexpected token')), false);
  assert.equal(isOllamaConnectionError(null), false);
  assert.equal(isOllamaConnectionError(undefined), false);
});

async function withTagsServer(handler, fn) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  try {
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('waitForOllamaReady returns true when /api/tags answers', async () => {
  const ok = await withTagsServer((req, res) => {
    if (req.url === '/api/tags') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"models":[]}'); return; }
    res.writeHead(404); res.end();
  }, (baseUrl) => waitForOllamaReady({ baseUrl, waitMs: 1000, pollMs: 10 }));
  assert.equal(ok, true);
});

test('waitForOllamaReady returns false when nothing listens — bounded, not forever', async () => {
  const server = http.createServer(() => {});
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const deadPort = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  const started = Date.now();
  const ok = await waitForOllamaReady({ baseUrl: `http://127.0.0.1:${deadPort}`, waitMs: 120, pollMs: 10 });
  const elapsed = Date.now() - started;
  assert.equal(ok, false);
  assert.ok(elapsed < 5000, `the wait must be bounded (took ${elapsed}ms)`);
});

test('waitForOllamaReady waits out a server that comes up late', async () => {
  const ok = await withTagsServer((req, res) => {
    if (req.url === '/api/tags') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"models":[]}'); return; }
    res.writeHead(404); res.end();
  }, async (baseUrl) => {
    // The server above is already up; simulate lateness by polling a
    // dead port first, then the live one — the second call must be true.
    const dead = await waitForOllamaReady({ baseUrl: 'http://127.0.0.1:1', waitMs: 30, pollMs: 10 });
    assert.equal(dead, false);
    return waitForOllamaReady({ baseUrl, waitMs: 1000, pollMs: 10 });
  });
  assert.equal(ok, true);
});

// PHASE 9 (31 Oct 2026): heartbeat never-shorten regression tests.
// An advisory (short) call must never overwrite a main turn's (long)
// deadline — the 20:15 IST 31 Oct 2026 watchdog kill root cause.

test('writeInferenceHeartbeat: advisory short deadline does NOT overwrite main-turn long deadline', () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'hb-')), 'hb.json');
  const longDeadline = Date.now() + 3600000; // main turn: 1h
  const shortDeadline = Date.now() + 60000;  // advisory: 1min
  assert.equal(writeInferenceHeartbeat(f, longDeadline, 'h1'), true);
  assert.equal(writeInferenceHeartbeat(f, shortDeadline, 'h1'), false);
  const hb = JSON.parse(fs.readFileSync(f, 'utf8'));
  assert.equal(hb.deadline, longDeadline);
  fs.rmSync(path.dirname(f), { recursive: true });
});

test('writeInferenceHeartbeat: longer deadline DOES overwrite shorter one', () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'hb-')), 'hb.json');
  const shortDeadline = Date.now() + 60000;
  const longDeadline = Date.now() + 3600000;
  assert.equal(writeInferenceHeartbeat(f, shortDeadline, 'h1'), true);
  assert.equal(writeInferenceHeartbeat(f, longDeadline, 'h1'), true);
  const hb = JSON.parse(fs.readFileSync(f, 'utf8'));
  assert.equal(hb.deadline, longDeadline);
  fs.rmSync(path.dirname(f), { recursive: true });
});

test('writeInferenceHeartbeat: writes fresh when no existing file', () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'hb-')), 'hb.json');
  const d = Date.now() + 120000;
  assert.equal(writeInferenceHeartbeat(f, d, 'h2'), true);
  const hb = JSON.parse(fs.readFileSync(f, 'utf8'));
  assert.equal(hb.deadline, d);
  assert.equal(hb.huntId, 'h2');
  fs.rmSync(path.dirname(f), { recursive: true });
});

test('writeInferenceHeartbeat: corrupt existing file is overwritten', () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'hb-')), 'hb.json');
  fs.writeFileSync(f, 'not json{');
  const d = Date.now() + 120000;
  assert.equal(writeInferenceHeartbeat(f, d, 'h3'), true);
  const hb = JSON.parse(fs.readFileSync(f, 'utf8'));
  assert.equal(hb.deadline, d);
  fs.rmSync(path.dirname(f), { recursive: true });
});
