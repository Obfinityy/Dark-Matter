// Tests for the SMTP injection probe (#43).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { probeSmtpInject } from './smtpInject.js';

describe('smtpInject probe', () => {
  let server;
  let port;
  const base = () => `http://127.0.0.1:${port}`;

  before(async () => {
    server = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url.startsWith('/contact')) {
        let raw = '';
        req.on('data', (c) => { raw += c; });
        req.on('end', () => {
          const params = new URLSearchParams(raw);
          const name = params.get('name') || '';
          // Vulnerable stub: reflects the raw name incl. injected header.
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`<html>thanks ${name}, mail queued</html>`);
        });
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html>contact form</html>');
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    port = server.address().port;
  });

  after(() => server.close());

  it('detects newline passthrough on contact form', async () => {
    const forms = [{
      action: `${base()}/contact`,
      inputs: [{ name: 'name', type: 'text' }, { name: 'email', type: 'email' }],
    }];
    const findings = await probeSmtpInject(forms, base(), { timeoutMs: 8000 });
    assert.ok(Array.isArray(findings));
    const pt = findings.find((f) => f.class === 'smtp_injection');
    assert.ok(pt, 'expected passthrough finding on reflecting stub');
    assert.equal(pt.severity, 'medium');
  });

  // isLab follow-up (8 Nov 2026): T2's lab gate now uses the canonical
  // isLabTargetHost, so port-bearing labTargets open it and a near-miss
  // host does not. The canary inbox is stubbed here — no real mailbox
  // exists yet (the inbox oracle itself is a separate lane).
  const t2Forms = () => [{
    action: 'http://127.0.0.1:9/contact',
    inputs: [{ name: 'name', type: 'text' }, { name: 'email', type: 'email' }],
  }];
  const t2Inbox = {
    domain: 'canary.test',
    check: async (addr) => ({ headers: `Bcc: ${addr}\nMessage-ID: <x@canary.test>` }),
  };
  function stubT2Fetch(posts) {
    const origFetch = global.fetch;
    global.fetch = async (url, init = {}) => {
      if ((init.method || 'GET') === 'POST') posts.push(String(init.body || ''));
      return { ok: true, status: 200, text: async () => '<html>thanks, mail queued</html>' };
    };
    return origFetch;
  }

  it('T2 fires CRITICAL with a wired inbox + PORT-BEARING labTargets', async () => {
    const posts = [];
    const origFetch = stubT2Fetch(posts);
    try {
      const findings = await probeSmtpInject(t2Forms(), 'http://127.0.0.1:9/', {
        labTargets: '127.0.0.1:9',
        timeoutMs: 2000,
        smtpCanaryInbox: t2Inbox,
      });
      const bcc = findings.find((f) => /Bcc relay/.test(f.title));
      assert.ok(bcc, `expected Bcc-relay CRITICAL, got ${findings.map((f) => f.title)}`);
      assert.equal(bcc.severity, 'critical');
      assert.ok(posts.some((b) => b.includes('Bcc')), 'the Bcc payload must actually be sent');
    } finally {
      global.fetch = origFetch;
    }
  });

  it('T2 stays silent on a near-miss host (no Bcc POST)', async () => {
    const posts = [];
    const origFetch = stubT2Fetch(posts);
    try {
      const findings = await probeSmtpInject(t2Forms(), 'http://127.0.0.1:9/', {
        labTargets: '127.0.0.2',
        timeoutMs: 2000,
        smtpCanaryInbox: t2Inbox,
      });
      assert.deepEqual(findings, []);
      assert.ok(!posts.some((b) => b.includes('Bcc')), 'no Bcc payload may be sent off-lab');
    } finally {
      global.fetch = origFetch;
    }
  });

  it('T2 stays silent with no canary inbox wired (graceful skip)', async () => {
    const posts = [];
    const origFetch = stubT2Fetch(posts);
    try {
      const findings = await probeSmtpInject(t2Forms(), 'http://127.0.0.1:9/', {
        labTargets: '127.0.0.1:9',
        timeoutMs: 2000,
      });
      assert.deepEqual(findings, []);
      assert.ok(!posts.some((b) => b.includes('Bcc')), 'without an inbox there is nothing to confirm with');
    } finally {
      global.fetch = origFetch;
    }
  });

  it('stays silent with no email forms', async () => {
    const findings = await probeSmtpInject([], base(), { timeoutMs: 5000 });
    assert.deepEqual(findings, []);
  });
});
