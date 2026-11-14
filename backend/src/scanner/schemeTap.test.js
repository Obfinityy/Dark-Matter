// Tests for the scheme tap — the $0 raw-TCP listener that proves a
// server-side fetcher spoke a non-HTTP scheme (gopher/dict/ftp) to an
// internal address (coverage row #310). All servers bind loopback only;
// no external service, no lab needed. Mirrors oobCollaborator.test.js.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { createSchemeTap } from './schemeTap.js';

function loopbackTap() {
  return createSchemeTap({ listenHost: '127.0.0.1', callbackHost: '127.0.0.1' });
}

// Connect, read the greeting, send `send`, close after a beat.
function tcpSend(port, send, waitForGreeting) {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection({ host: '127.0.0.1', port });
    let done = false;
    const finish = (err) => {
      if (done) return;
      done = true;
      try { sock.destroy(); } catch { /* ignore */ }
      if (err) reject(err);
      else resolve();
    };
    const timer = setTimeout(() => finish(), 800);
    sock.on('connect', () => {
      if (!waitForGreeting) {
        if (send) sock.write(send);
        return;
      }
      sock.once('data', () => {
        if (send) sock.write(send);
      });
    });
    sock.on('error', (e) => {
      clearTimeout(timer);
      finish(e);
    });
    sock.on('close', () => {
      clearTimeout(timer);
      finish();
    });
  });
}

describe('schemeTap', () => {
  it('starts on an ephemeral loopback port and reports host:port', async () => {
    const tap = loopbackTap();
    try {
      const base = await tap.start();
      assert.ok(/^http:\/\/127\.0\.0\.1:\d+$/.test(base), `bad baseUrl: ${base}`);
      assert.match(tap.hostPort(), /^127\.0\.0\.1:\d+$/);
      assert.equal(tap.baseUrl(), base);
      // hostPort before start is null.
      const fresh = loopbackTap();
      assert.equal(fresh.hostPort(), null);
      assert.equal(fresh.baseUrl(), null);
    } finally {
      await tap.stop();
    }
  });

  it('sends a greeting on connect (elicits the FTP USER command)', async () => {
    const tap = loopbackTap();
    try {
      const { port } = new URL(await tap.start());
      const greeting = await new Promise((resolve, reject) => {
        const sock = net.createConnection({ host: '127.0.0.1', port: Number(port) });
        sock.once('data', (chunk) => {
          resolve(chunk.toString());
          sock.destroy();
        });
        sock.once('error', reject);
        setTimeout(() => reject(new Error('no greeting within 2s')), 2000);
      });
      assert.match(greeting, /^220 /);
    } finally {
      await tap.stop();
    }
  });

  it('POSITIVE: token bytes resolve waitFor with the hit record', async () => {
    const tap = loopbackTap();
    try {
      const { port } = new URL(await tap.start());
      const waiting = tap.waitFor('tok-gopher', 3000);
      await tcpSend(Number(port), 'tok-gopher\r\n', false);
      const hit = await waiting;
      assert.ok(hit, 'waitFor should resolve a hit');
      assert.equal(hit.token, 'tok-gopher');
      assert.ok(hit.at, 'hit must carry a timestamp');
      assert.equal(tap.hasHit('tok-gopher')?.token, 'tok-gopher');
      assert.equal(tap.hits.length, 1);
    } finally {
      await tap.stop();
    }
  });

  it('waitFor resolves immediately when the token already arrived', async () => {
    const tap = loopbackTap();
    try {
      const { port } = new URL(await tap.start());
      await tcpSend(Number(port), 'tok-early\r\n', false);
      const hit = await tap.waitFor('tok-early', 500);
      assert.ok(hit, 'already-arrived token must resolve at once');
      assert.equal(hit.token, 'tok-early');
    } finally {
      await tap.stop();
    }
  });

  it('NEGATIVE: waitFor resolves null on timeout when the token never arrives', async () => {
    const tap = loopbackTap();
    try {
      await tap.start();
      const hit = await tap.waitFor('tok-never', 300);
      assert.equal(hit, null);
      assert.equal(tap.hasHit('tok-never'), null);
      assert.equal(tap.hits.length, 0);
    } finally {
      await tap.stop();
    }
  });

  it('a bare connection with no token bytes records no token hit', async () => {
    const tap = loopbackTap();
    try {
      const { port } = new URL(await tap.start());
      // Connect and close without sending anything: the tap sees the
      // connection but cannot attribute it to a token.
      await tcpSend(Number(port), null, false);
      assert.equal(await tap.waitFor('tok-absent', 300), null);
      assert.equal(tap.hits.length, 0);
      assert.equal(tap.connections, 1);
    } finally {
      await tap.stop();
    }
  });

  it('stop() resolves pending waiters with null and closes the listener', async () => {
    const tap = loopbackTap();
    const base = await tap.start();
    const waiting = tap.waitFor('tok-pending', 10000);
    await tap.stop();
    assert.equal(await waiting, null);
    const { port } = new URL(base);
    await assert.rejects(
      new Promise((resolve, reject) => {
        const sock = net.createConnection({ host: '127.0.0.1', port: Number(port) });
        sock.once('connect', () => resolve(sock));
        sock.once('error', reject);
      })
    );
    assert.equal(await tap.waitFor('tok-late', 5000), null);
  });
});
