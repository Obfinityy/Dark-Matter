// dvwaAuth timeout regression tests (6 Nov 2026).
//
// The suite used to hang forever on AJ-19 (and the dedupSubmit /
// desktopFirst / exhaustedSurface wire-ups): dvwaLogin's fetches had
// no timeout, so one unreachable lab stalled humanIteration on its
// very first turn. These tests prove a dead lab now fails fast.
// Transport is node:http with agent:false (no pooling): the global
// fetch left aborted proxy-CONNECT sockets open forever, so test
// processes never exited even after all tests passed. The fake DVWA
// 302-redirects the login POST like real DVWA, so the redirect
// following in labRequest is covered too.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { dvwaLogin, dvwaSqliDump } from './dvwaAuth.js';

// Fixture hashes, computed rather than typed from memory (a mistyped
// 30-char "md5" once made the dump test fail with insufficient_hashes).
const MD5_PASSWORD = createHash('md5').update('password').digest('hex');
const MD5_ABC123 = createHash('md5').update('abc123').digest('hex');

function listen(server) {
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
}

async function close(server) {
  try { server.closeAllConnections?.(); } catch { /* already closed */ }
  await new Promise((resolve) => server.close(() => resolve()));
}

// A server that accepts the connection and never answers: without a
// fetch timeout, any caller hangs on it forever.
function neverRespondingServer() {
  return http.createServer(() => { /* hold the request open forever */ });
}

// A minimal fake DVWA: login + security=low + sqli dump surfaces.
function fakeDvwaServer() {
  const tokenInput = '<input type="hidden" name="user_token" value="tok123">';
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (req.method === 'GET' && url.pathname === '/login.php') {
      res.setHeader('Set-Cookie', 'PHPSESSID=fake123; path=/');
      res.end(`<html><form>${tokenInput}</form></html>`);
    } else if (req.method === 'POST' && url.pathname === '/login.php') {
      // Real DVWA 302-redirects a successful login to index.php.
      res.writeHead(302, { Location: '/index.php', 'Set-Cookie': 'PHPSESSID=fake123; path=/' });
      res.end();
    } else if (req.method === 'GET' && url.pathname === '/index.php') {
      res.end('<html>Welcome admin</html>');
    } else if (req.method === 'GET' && url.pathname === '/security.php') {
      res.end(`<html><form>${tokenInput}</form></html>`);
    } else if (req.method === 'POST' && url.pathname === '/security.php') {
      res.end('<html>Security level set</html>');
    } else if (req.method === 'GET' && url.pathname === '/vulnerabilities/sqli/') {
      res.end(`<html><form>${tokenInput}</form></html>`);
    } else if (req.method === 'POST' && url.pathname === '/vulnerabilities/sqli/') {
      res.end(`<html>First name: admin<br />Surname: ${MD5_PASSWORD}<br />First name: gordon<br />Surname: ${MD5_ABC123}</html>`);
    } else {
      res.writeHead(404);
      res.end('not found');
    }
  });
}

test('T-1: dvwaLogin against a never-responding lab fails fast (fetch_failed)', async () => {
  const server = neverRespondingServer();
  const port = await listen(server);
  try {
    const start = Date.now();
    const res = await dvwaLogin({ huntId: 'h_test_timeout', target: `http://127.0.0.1:${port}`, timeoutMs: 300 });
    const elapsed = Date.now() - start;
    assert.equal(res.ok, false);
    assert.equal(res.error, 'fetch_failed');
    assert.ok(elapsed < 5000, `should fail fast, took ${elapsed}ms`);
  } finally {
    await close(server);
  }
});

test('T-2: dvwaLogin against a closed port fails fast (fetch_failed)', async () => {
  const start = Date.now();
  const res = await dvwaLogin({ huntId: 'h_test_timeout', target: 'http://127.0.0.1:1', timeoutMs: 5000 });
  assert.equal(res.ok, false);
  assert.equal(res.error, 'fetch_failed');
  assert.ok(Date.now() - start < 5000);
});

test('T-3: dvwaLogin happy path still works against a fake DVWA', async () => {
  const server = fakeDvwaServer();
  const port = await listen(server);
  try {
    const res = await dvwaLogin({ huntId: 'h_test_happy', target: `http://127.0.0.1:${port}` });
    assert.equal(res.ok, true);
  } finally {
    await close(server);
  }
});

test('T-4: dvwaSqliDump against a never-responding lab fails fast (login_failed)', async () => {
  const server = neverRespondingServer();
  const port = await listen(server);
  try {
    const start = Date.now();
    const res = await dvwaSqliDump({ huntId: 'h_test_timeout', target: `http://127.0.0.1:${port}`, timeoutMs: 300 });
    const elapsed = Date.now() - start;
    assert.equal(res.ok, false);
    assert.equal(res.error, 'login_failed');
    assert.ok(elapsed < 5000, `should fail fast, took ${elapsed}ms`);
  } finally {
    await close(server);
  }
});

test('T-5: dvwaSqliDump happy path extracts hashes from a fake DVWA', async () => {
  const server = fakeDvwaServer();
  const port = await listen(server);
  try {
    const res = await dvwaSqliDump({ huntId: 'h_test_happy', target: `http://127.0.0.1:${port}` });
    assert.equal(res.ok, true);
    assert.ok(res.hashes.length >= 2, `expected >=2 hashes, got ${res.hashes.length}`);
    assert.ok(res.hashes.includes(MD5_PASSWORD));
    assert.equal(res.rows[0].user, 'admin');
  } finally {
    await close(server);
  }
});
