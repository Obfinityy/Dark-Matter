// Tests for the padding oracle probe (#53). Bounded: <=8 probes/sink.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import { probePaddingOracle } from './paddingOracle.js';

describe('paddingOracle probe', () => {
  let server;
  let port;
  const base = () => `http://127.0.0.1:${port}`;
  // Fixed key for the stub (test-only).
  const key = crypto.randomBytes(16);
  const iv = crypto.randomBytes(16);

  function enc(plain) {
    const c = crypto.createCipheriv('aes-128-cbc', key, iv);
    return Buffer.concat([c.update(plain), c.final()]).toString('base64');
  }

  before(async () => {
    const validTicket = encodeURIComponent(enc('user=alice;role=user'));
    server = http.createServer((req, res) => {
      const cookie = req.headers.cookie || '';
      const m = cookie.match(/ticket=([^;]+)/);
      const ticketB64 = m ? decodeURIComponent(m[1]) : '';
      let ticket;
      try {
        ticket = Buffer.from(ticketB64, 'base64');
      } catch {
        res.writeHead(400);
        res.end('bad request');
        return;
      }
      // Vulnerable stub: distinct families for padding vs decrypt errors.
      try {
        const d = crypto.createDecipheriv('aes-128-cbc', key, iv);
        const plain = Buffer.concat([d.update(ticket), d.final()]);
        // Check a fake MAC: last byte must be 0x42.
        if (plain[plain.length - 1] !== 0x42) {
          res.writeHead(302, { Location: '/login' });
          res.end('ticket invalid, login again');
          return;
        }
        res.writeHead(200);
        res.end('welcome');
      } catch (e) {
        res.writeHead(500);
        res.end('Invalid padding during decrypt');
      }
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    port = server.address().port;
    // Plant the valid ticket via a priming request is unnecessary; the
    // probe reads Set-Cookie — so set one on the landing page.
    const origHandler = server.listeners('request')[0];
    server.removeAllListeners('request');
    server.on('request', (req, res) => {
      const u = new URL(req.url, base());
      if (u.pathname === '/' && req.method === 'GET' && !req.headers.cookie) {
        res.writeHead(200, {
          'Content-Type': 'text/html',
          'Set-Cookie': `ticket=${validTicket}; Path=/`,
        });
        res.end('<html>home</html>');
        return;
      }
      origHandler(req, res);
    });
  });

  after(() => server.close());

  it('detects padding oracle signal on vulnerable ticket cookie', async () => {
    const findings = await probePaddingOracle(base(), { timeoutMs: 10000 });
    assert.ok(Array.isArray(findings));
    const po = findings.find((f) => f.class === 'paddingOracle');
    assert.ok(po, 'expected padding oracle signal on vulnerable stub');
  }, { timeout: 60000 });

  it('exits clean when no ciphertext-shaped cookies', async () => {
    const findings = await probePaddingOracle('http://127.0.0.1:1/', { timeoutMs: 3000 });
    assert.ok(Array.isArray(findings));
  });
});
