// Test for solver #461 — Ollama chat transport (node:http + streaming).
// Run: node backend/scripts/test-llm-stream.mjs
//
// Background: chatWithOllama used fetch with stream:false. Undici's
// default ~300 s inactivity timeout killed every call whose
// prefill+generation ran longer — invisible while messages were sliced
// to 8k chars, fatal once #459 let the full 55k-char planning prompt
// through (~10.8k tokens of prefill at 5-9 tok/s): three consecutive
// 'Model gave no reply' iterations paused the main hunt (12:09:50Z
// 20 Oct 2026). The fix moves the Ollama call to node:http with
// timeout:0 (no inactivity kill) + streaming NDJSON accumulation, bound
// only by the overall OLLAMA_TIMEOUT_MS deadline.
//
// Proves against a fake Ollama server: (1) a >8k-char message reaches
// the server WHOLE (the #459 cap, through the real call path), (2) the
// request streams and the reply is the concatenation of NDJSON chunks
// even with silent gaps between them (prefill simulation), (3) a
// non-5xx HTTP error returns null without the 15 s retry sleep, (4) a
// dead server returns null after the built-in retry.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-llm-stream-'));
process.env.DATA_DIR = tmp;
process.env.AI_HEARTBEAT_PATH = path.join(tmp, 'hb.json');
process.env.LLM_PROVIDER = 'ollama';
process.env.OLLAMA_NUM_CTX = '16384';
process.env.OLLAMA_TIMEOUT_MS = '30000';

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

let mode = 'ok';
let lastBody = null;
const server = http.createServer((req, res) => {
  let buf = '';
  req.on('data', (c) => { buf += c; });
  req.on('end', async () => {
    lastBody = JSON.parse(buf);
    if (mode === 'bad') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'bad request (fake)' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
    res.write(JSON.stringify({ message: { role: 'assistant', content: 'Hello ' }, done: false }) + '\n');
    await new Promise((r) => setTimeout(r, 400)); // silent gap — prefill simulation
    res.write(JSON.stringify({ message: { role: 'assistant', content: 'world' }, done: false }) + '\n');
    await new Promise((r) => setTimeout(r, 400));
    res.end(JSON.stringify({ message: { role: 'assistant', content: '' }, done: true, prompt_eval_count: 123, eval_count: 7 }) + '\n');
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
process.env.OLLAMA_URL = `http://127.0.0.1:${port}`;

const llm = await import('../src/llm.js');

const bigMessage = 'x'.repeat(20000);
const reply = await llm.chatWithAI([{ role: 'user', text: bigMessage }], 'sys', {});
check('streamed reply is the concatenation of chunks', reply === 'Hello world');
check('request asked for streaming', !!lastBody && lastBody.stream === true);
const sent = lastBody && lastBody.messages.find((m) => m.role === 'user');
check('20k-char message reached the server whole (no 8k slice)', !!sent && sent.content.length === 20000);

mode = 'bad';
const t0 = Date.now();
const badReply = await llm.chatWithAI([{ role: 'user', text: 'hi' }], 'sys', {});
check('HTTP 400 returns null', badReply === null);
check('HTTP 400 does not take the 15s 5xx retry path', Date.now() - t0 < 10000);

await new Promise((r) => server.close(r));
const deadReply = await llm.chatWithAI([{ role: 'user', text: 'hi' }], 'sys', {});
check('dead server returns null after retry', deadReply === null);

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
