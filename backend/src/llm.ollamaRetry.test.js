// Ollama readiness-aware retry (Infinity level, 26 Oct 2026) —
// end-to-end through chatWithAI against a local fake Ollama.
//
// The no-reply root cause: the kernel OOM-kills llama-server, the
// model reload takes ~176s, and the old code retried IMMEDIATELY,
// hit ECONNREFUSED, and returned null ("Brain gave no reply").
// These tests prove the fix: a server that comes back late is
// waited for and the retry then succeeds; a server that never
// comes back still fails cleanly and bounded; a 5xx (the same
// reload wearing an HTTP status) is waited out the same way.
//
// Env is set BEFORE importing llm.js (OLLAMA_URL is read at
// module-eval time), and DATA_DIR points at a temp dir so cost
// tracking never touches the real data. Each test uses its OWN
// port (no cross-test coupling), and the fake server answers with
// `Connection: close` + closeAllConnections() so no keep-alive
// socket can hold a test open after the server stops.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-retry-'));
process.env.DATA_DIR = tmpRoot;
process.env.AI_HEARTBEAT_PATH = path.join(tmpRoot, 'hb.json');
process.env.LLM_PROVIDER = 'ollama';
process.env.OLLAMA_MODEL = 'dm-hunter';
process.env.OLLAMA_TIMEOUT_MS = '10000';
process.env.OLLAMA_READY_WAIT_MS = '3000';
process.env.OLLAMA_READY_POLL_MS = '10';

async function freePort() {
  const s = http.createServer(() => {});
  await new Promise((resolve) => s.listen(0, '127.0.0.1', resolve));
  const port = s.address().port;
  await new Promise((resolve) => s.close(resolve));
  return port;
}

// The port is allocated and OLLAMA_URL set BEFORE importing llm.js
// (OLLAMA_URL is read at module-eval time). All three tests share
// this one port; each fully closes its server before the next starts.
const PORT = await freePort();
process.env.OLLAMA_URL = `http://127.0.0.1:${PORT}`;

const { chatWithAI } = await import('./llm.js');

function streamReply(res, text) {
  res.writeHead(200, { 'Content-Type': 'application/x-ndjson', Connection: 'close' });
  res.end(
    `${JSON.stringify({ message: { content: text }, done: false })}\n` +
    `${JSON.stringify({ done: true, prompt_eval_count: 5, eval_count: 5 })}\n`,
  );
}

function fakeOllama(port, { chatBehavior }) {
  let chatCalls = 0;
  const server = http.createServer((req, res) => {
    if (req.url === '/api/tags') {
      res.writeHead(200, { 'Content-Type': 'application/json', Connection: 'close' });
      res.end('{"models":[{"name":"dm-hunter:latest"}]}');
      return;
    }
    if (req.url === '/api/chat') {
      chatCalls++;
      chatBehavior(req, res, chatCalls);
      return;
    }
    res.writeHead(404, { Connection: 'close' });
    res.end();
  });
  return {
    server,
    chatCalls: () => chatCalls,
    listen: () => new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', resolve);
    }),
    close: () => new Promise((resolve) => {
      try { server.closeAllConnections(); } catch { /* older node */ }
      server.close(resolve);
    }),
  };
}

test('retry-1: a server that comes back late is waited for — the retry succeeds', async () => {
  const fake = fakeOllama(PORT, {
    chatBehavior: (req, res) => {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => streamReply(res, '{"action":"shell","command":"echo hi"}'));
    },
  });
  // The server starts AFTER the first chat attempt fails: the
  // first attempt must hit ECONNREFUSED (nothing listening), the
  // readiness poll must wait, and the retry must then succeed.
  const started = Date.now();
  const chatP = chatWithAI([{ role: 'user', text: 'hello' }], 'you are a hunter', { huntId: 'h_retry' });
  await new Promise((r) => setTimeout(r, 80));
  await fake.listen();
  let text;
  try {
    text = await chatP;
  } finally {
    await fake.close();
  }
  const elapsed = Date.now() - started;
  assert.ok(text && text.includes('shell'), `expected the retried reply, got: ${text}`);
  // Only the RETRY arrives at the server (1 chat call): the refused
  // first attempt never reaches it — ECONNREFUSED happens at connect.
  assert.equal(fake.chatCalls(), 1, 'only the retry reaches the server; the refused attempt dies at connect');
  assert.ok(elapsed >= 50, 'the readiness wait must actually happen before the retry');
});

test('retry-2: a server that never comes back fails cleanly and bounded', async () => {
  const started = Date.now();
  const text = await chatWithAI([{ role: 'user', text: 'hello' }], 'you are a hunter', { huntId: 'h_retry' });
  const elapsed = Date.now() - started;
  assert.equal(text, null);
  assert.ok(elapsed < 15000, `the dead-server call must be bounded (took ${elapsed}ms)`);
  assert.ok(elapsed >= 2000, `the readiness wait must be used (took only ${elapsed}ms)`);
});

test('retry-3: a 5xx is waited out the same way — the retry succeeds', async () => {
  const fake = fakeOllama(PORT, {
    chatBehavior: (req, res, n) => {
      if (n === 1) {
        res.writeHead(500, { 'Content-Type': 'application/json', Connection: 'close' });
        res.end('{"error":"unexpected EOF"}');
        return;
      }
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => streamReply(res, 'second attempt works'));
    },
  });
  await fake.listen();
  let text;
  try {
    text = await chatWithAI([{ role: 'user', text: 'hello' }], 'you are a hunter', { huntId: 'h_retry' });
  } finally {
    await fake.close();
  }
  assert.equal(text, 'second attempt works');
  assert.equal(fake.chatCalls(), 2);
});
