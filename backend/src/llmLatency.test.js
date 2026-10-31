/**
 * llmLatency.test.js — R-12 regression: the chatWithOllama wrapper must
 * log one latency line per call (hunt, advisory/main, outcome,
 * duration_ms) without changing the call's result.
 *
 * Uses a stub HTTP server as OLLAMA_URL (set before import), a tmp
 * heartbeat path, and captures console.error. No network, no model.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-lat-'));
process.env.LLM_PROVIDER = 'ollama';
process.env.AI_HEARTBEAT_PATH = path.join(tmpRoot, 'hb.json');
// Keep every bound tiny so failure paths settle fast.
process.env.OLLAMA_READY_WAIT_MS = '120';
process.env.OLLAMA_READY_POLL_MS = '15';
process.env.OLLAMA_TIMEOUT_MS = '2000';
process.env.OLLAMA_ADVISORY_TIMEOUT_MS = '1000';

let chatStatus = 200;
let chatBody = null; // null => default NDJSON stream
const server = http.createServer((req, res) => {
  if (req.url === '/api/chat' && req.method === 'POST') {
    req.resume();
    req.on('end', () => {
      if (chatStatus !== 200) {
        res.writeHead(chatStatus, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'boom' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
      const body = chatBody || '{"message":{"content":"hello"},"done":false}\n{"done":true,"prompt_eval_count":10,"eval_count":5}\n';
      res.end(body);
    });
    return;
  }
  res.writeHead(404);
  res.end('{}');
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
process.env.OLLAMA_URL = `http://127.0.0.1:${server.address().port}`;

const { chatWithAI } = await import('./llm.js');

async function captureStderr(fn) {
  const lines = [];
  const orig = console.error;
  console.error = (...a) => { lines.push(a.join(' ')); };
  try {
    const ret = await fn();
    return { ret, lines };
  } finally {
    console.error = orig;
  }
}

function latencyLine(lines) {
  return lines.find((l) => l.includes('[llm] ollama call'));
}

test('ok call: text returned unchanged + latency line logged', async () => {
  chatStatus = 200; chatBody = null;
  const { ret, lines } = await captureStderr(() =>
    chatWithAI([{ role: 'user', text: 'hi' }], '', { huntId: 'h_test' }));
  assert.equal(ret, 'hello', 'wrapper must not alter the reply text');
  const line = latencyLine(lines);
  assert.ok(line, 'expected an [llm] ollama call latency line');
  assert.match(line, /hunt=h_test/);
  assert.match(line, /advisory=false/);
  assert.match(line, /outcome=ok/);
  assert.match(line, /duration_ms=\d+/);
});

test('null_reply call: 500 -> readiness wait -> null, outcome logged', async () => {
  chatStatus = 500;
  const { ret, lines } = await captureStderr(() =>
    chatWithAI([{ role: 'user', text: 'hi' }], '', { huntId: 'h_test2' }));
  assert.equal(ret, null);
  const line = latencyLine(lines);
  assert.ok(line, 'expected a latency line even on failure');
  assert.match(line, /hunt=h_test2/);
  assert.match(line, /outcome=null_reply/);
  assert.match(line, /duration_ms=\d+/);
  chatStatus = 200;
});

test('advisory flag is reflected in the latency line', async () => {
  const { lines } = await captureStderr(() =>
    chatWithAI([{ role: 'user', text: 'hi' }], '', { huntId: 'h_test3' }, { advisory: true }));
  const line = latencyLine(lines);
  assert.ok(line);
  assert.match(line, /advisory=true/);
  assert.match(line, /outcome=ok/);
});

test('teardown', async () => {
  await new Promise((r) => server.close(r));
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  assert.ok(true);
});
