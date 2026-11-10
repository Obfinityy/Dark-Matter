// llm-lab malformed-URL test — a bad request-target must get a 400 and
// must never kill the lab.
//
// Regression test for the proof #37 incident (10 Nov 2026): the lab crashed
// twice (exit 1, ERR_INVALID_URL at server.js:296) on a scanner probe
// carrying an ANSI OSC-8 hyperlink to interact.sh. The request-target held
// literal backslash-u text (e.g. "\u001B" as six ASCII characters, not a
// control byte); for http(s) URLs a backslash reads as a path separator, so
// the target parsed as an authority whose host holds an unmatched ']' and
// the WHATWG parser threw — outside the handler's try/catch, killing the
// whole process. The fix answers such targets with 400 instead.
//
// Runs the real server as a child process on a scratch port (no Docker).
// Run: node --test labs/llm-lab/server.test.js
'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const http = require('node:http');
const path = require('node:path');

const PORT = 3699;
const HOST = '127.0.0.1';

// Exact request-target that crashed the lab twice on 10 Nov 2026. The
// "\\u001B" / "\\u0007" sequences are literal backslash-u text as sent by
// the scanner, not control bytes — that is what makes the parser throw.
const CRASH_TARGET = '/\\u001B]8;;https://interact.sh"/onmouseover="alert(1)\\u0007example\\u001B]8;;\\u0007';
// Absolute-form target with an unclosed IPv6 literal — also unparseable.
const BAD_IPV6_TARGET = 'http://[::1';

let server = null;

function get(pathname) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: HOST, port: PORT, path: pathname }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
  });
}

// Send a request line byte-for-byte (the http client would normalise or
// reject some of these targets, so a raw socket is the faithful channel).
function rawRequest(target) {
  return new Promise((resolve, reject) => {
    const sock = net.connect(PORT, HOST);
    let buf = Buffer.alloc(0);
    sock.on('connect', () => {
      sock.write(`GET ${target} HTTP/1.1\r\nHost: ${HOST}\r\nConnection: close\r\n\r\n`);
    });
    sock.on('data', (chunk) => { buf = Buffer.concat([buf, chunk]); });
    sock.on('end', () => resolve(buf.toString('utf8')));
    sock.on('error', reject);
  });
}

function statusOf(rawResponse) {
  const match = /^HTTP\/1\.1 (\d{3})/.exec(rawResponse);
  return match ? Number(match[1]) : null;
}

async function waitForHealth(timeoutMs = 10000) {
  const started = Date.now();
  for (;;) {
    try {
      const res = await get('/health');
      if (res.status === 200) return;
    } catch {
      // Server not up yet.
    }
    if (Date.now() - started > timeoutMs) throw new Error('llm-lab did not become ready');
    await new Promise((r) => setTimeout(r, 100));
  }
}

before(async () => {
  server = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname),
    env: { ...process.env, PORT: String(PORT), HOST },
    stdio: 'ignore',
  });
  await waitForHealth();
});

after(async () => {
  if (server && server.exitCode === null) {
    server.kill('SIGTERM');
    await new Promise((resolve) => server.once('exit', resolve));
  }
});

test('proof #37 crash target returns 400, not a crash', async () => {
  const raw = await rawRequest(CRASH_TARGET);
  assert.equal(statusOf(raw), 400);
  assert.match(raw, /invalid request URL/);
});

test('absolute-form target with invalid IPv6 returns 400', async () => {
  const raw = await rawRequest(BAD_IPV6_TARGET);
  assert.equal(statusOf(raw), 400);
  assert.match(raw, /invalid request URL/);
});

test('server stays alive and serves valid requests after malformed targets', async () => {
  assert.equal(server.exitCode, null, 'server process must still be running');
  const health = await get('/health');
  assert.equal(health.status, 200);
  assert.equal(JSON.parse(health.body).ok, true);
  const index = await get('/');
  assert.equal(index.status, 200);
  assert.match(index.body, /ShopAssist/);
  const model = await get('/api/model');
  assert.equal(model.status, 200);
  assert.equal(JSON.parse(model.body).model, 'shopassist-stub-1.0');
});
