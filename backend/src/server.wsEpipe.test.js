// WebSocket EPIPE guard tests.
//
// 25 Oct 2026, 20:35 IST — the backend died on an unhandled 'error'
// event: "Error: write EPIPE, Emitted 'error' event on Socket
// instance" (server.js:375, the Take Control WS handler), exit 1.
// The handler wrote RFB bytes to the tunnel child's stdin inside
// try/catch, but a child-process stdio Socket fails ASYNCHRONOUSLY:
// `tunnel.stdin` had no 'error' listener, so the EPIPE from the dead
// python forwarder became an unhandled 'error' event and crashed the
// Node process.
//
// The OLD pattern is reproduced in a SUBPROCESS (an unhandled 'error'
// there would crash the test runner itself). The NEW pattern runs
// in-process against the actual shipped helpers in wsGuards.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { WebSocketServer, WebSocket } from 'ws';
import { guardStreamError, safeSend } from './wsGuards.js';

// A child whose stdin read end is GONE while the process stays alive
// — the 25 Oct 2026 crash shape: the forwarder's stdin consumer died
// (its read end closed) while `docker exec` kept the process alive,
// so the backend's next write hit a pipe with no reader.
// fs.closeSync(0) closes the fd SYNCHRONOUSLY (process.stdin.destroy()
// defers the close, so a small write can still land in the pipe buffer
// and never fail — verified empirically). The marker on stdout proves
// the fd is closed before the parent writes.
const DEAD_READER =
  "require('fs').closeSync(0); process.stdout.write('closed\\n'); setTimeout(()=>{},60000);";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('EPIPE-OLD: unguarded write to a dead child stdin crashes the process', async () => {
  // The exact 25 Oct pattern: spawn a child whose stdin read end is
  // gone while the process stays alive, then write to its stdin with
  // no 'error' listener and no callback. The marker on stdout proves
  // the fd is closed before the write, so the write must fail EPIPE.
  const script = [
    "const { spawn } = require('child_process');",
    `const child = spawn(process.execPath, ['-e', ${JSON.stringify(DEAD_READER)}], { stdio: ['pipe', 'pipe', 'ignore'] });`,
    "child.stdout.once('data', () => { child.stdin.write(Buffer.alloc(1024, 65)); });",
    'setTimeout(() => process.exit(0), 800);',
  ].join('\n');
  const proc = spawn(process.execPath, ['-e', script], { stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  proc.stderr.on('data', (d) => { stderr += d; });
  const code = await new Promise((resolve) => proc.once('close', resolve));
  assert.notEqual(code, 0, 'unguarded EPIPE must crash the process (exit != 0)');
  assert.match(stderr, /EPIPE/, 'stderr must show the EPIPE crash');
  assert.match(stderr, /Emitted 'error' event/, 'stderr must show the unhandled error event');
});

test('EPIPE-NEW: guardStreamError swallows the EPIPE and reports it once', async () => {
  const child = spawn(process.execPath, ['-e', DEAD_READER], { stdio: ['pipe', 'pipe', 'ignore'] });
  const seen = [];
  assert.equal(guardStreamError(child.stdin, (err) => seen.push(err)), true);
  // The write below mirrors server.js exactly: try/catch for the
  // synchronous case, a destroyed check, no write callback.
  const writeRfb = (data) => {
    try {
      if (child.stdin && !child.stdin.destroyed) child.stdin.write(data);
    } catch { /* sync guard */ }
  };
  // Wait for the marker: the child's stdin fd is closed by then.
  await new Promise((resolve) => child.stdout.once('data', resolve));
  writeRfb(Buffer.alloc(1024, 65));
  await sleep(300);
  assert.equal(seen.length, 1, 'guard must fire exactly once');
  assert.equal(seen[0] && seen[0].code, 'EPIPE');
  assert.equal(child.stdin.destroyed, true, 'stream is destroyed after the EPIPE');
  // A second write is skipped by the destroyed check — no re-fire.
  writeRfb(Buffer.alloc(1024, 65));
  await sleep(150);
  assert.equal(seen.length, 1, 'guard must not re-fire');
  child.kill('SIGKILL');
});

test('guardStreamError ignores nulls and non-streams', () => {
  assert.equal(guardStreamError(null), false);
  assert.equal(guardStreamError(undefined), false);
  assert.equal(guardStreamError({}), false);
  assert.equal(guardStreamError({ once: 'not-a-function' }), false);
  assert.equal(guardStreamError({ once: () => {} }), true);
});

test('safeSend delivers on a live socket', async (t) => {
  const wss = new WebSocketServer({ port: 0 });
  t.after(() => { try { wss.close(); } catch { /* already closed */ } });
  await new Promise((resolve) => wss.once('listening', resolve));
  const port = wss.address().port;
  const client = new WebSocket(`ws://127.0.0.1:${port}`);
  t.after(() => { try { client.terminate(); } catch { /* already gone */ } });
  const serverWs = await new Promise((resolve) => wss.once('connection', (ws) => resolve(ws)));
  await new Promise((resolve) => client.once('open', resolve));
  const received = new Promise((resolve) => client.once('message', (data) => resolve(data)));
  assert.equal(safeSend(serverWs, 'hello-frame'), true);
  assert.equal(String(await received), 'hello-frame');
});

test('safeSend never throws on a dead socket', async (t) => {
  const wss = new WebSocketServer({ port: 0 });
  t.after(() => { try { wss.close(); } catch { /* already closed */ } });
  await new Promise((resolve) => wss.once('listening', resolve));
  const port = wss.address().port;
  const client = new WebSocket(`ws://127.0.0.1:${port}`);
  const serverWs = await new Promise((resolve) => wss.once('connection', (ws) => resolve(ws)));
  await new Promise((resolve) => client.once('open', resolve));
  client.terminate();
  // Wait until the server side knows the socket is gone (or 2s).
  await new Promise((resolve) => {
    if (serverWs.readyState !== WebSocket.OPEN) return resolve();
    serverWs.once('close', resolve);
    setTimeout(resolve, 2000);
  });
  let cbErr;
  let sent;
  assert.doesNotThrow(() => {
    sent = safeSend(serverWs, 'late-frame', (err) => { cbErr = err; });
  });
  await sleep(200);
  assert.ok(
    sent === false || cbErr instanceof Error,
    'dead socket: either refused outright or reported via callback',
  );
});

test('guardStreamError catches a real socket ECONNRESET', async (t) => {
  // Force an RST: the server never reads, so the client's bytes sit
  // unread in the server socket's receive buffer — destroying it
  // sends RST instead of FIN, and the client's pending read fails
  // ECONNRESET. The write is 1MB on purpose: a small write can be
  // consumed into the server's userspace buffer before destroy, which
  // leaves the kernel buffer empty and yields a clean FIN instead.
  const server = net.createServer((sock) => {
    sock.pause();
    setTimeout(() => sock.destroy(), 100);
  });
  t.after(() => { try { server.close(); } catch { /* already closed */ } });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const client = net.connect(port, '127.0.0.1');
  t.after(() => { try { client.destroy(); } catch { /* already gone */ } });
  await new Promise((resolve) => client.once('connect', resolve));
  const seen = [];
  assert.equal(guardStreamError(client, (err) => seen.push(err)), true);
  client.write(Buffer.alloc(1024 * 1024, 66));
  await new Promise((resolve) => {
    client.once('close', resolve);
    setTimeout(resolve, 2000);
  });
  assert.equal(seen.length, 1, 'guard must catch the ECONNRESET');
  assert.equal(seen[0] && seen[0].code, 'ECONNRESET');
});
