// Tests for the SMTP injection probe (#43).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { probeSmtpInject } from './smtpInject.js';
import { createSmtpCanaryInbox } from '../smtpCanaryInbox.js';

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
  // host does not. The stub inbox below exercises the check-only
  // fallback path (a minimal hook without waitFor); the real sink
  // (smtpCanaryInbox.js) is exercised end-to-end further down.
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

// T2 end-to-end with the REAL canary inbox (8 Nov 2026, smtp-canary
// lane): a controlled vulnerable fixture — an HTTP contact form whose
// mail stack honours an injected Bcc header and relays the mail to the
// sink. This is the only way T2 can fire: received mail at OUR inbox
// with the Bcc header present.
describe('smtpInject T2 with the real canary inbox', () => {
  // Minimal SMTP client for the fixture's relay (same subset as the
  // sink's own tests: EHLO, MAIL, RCPT, DATA, QUIT).
  function smtpClient(port) {
    const sock = net.connect(port, '127.0.0.1');
    let buf = '';
    const queue = [];
    const pending = [];
    sock.on('data', (c) => {
      buf += c.toString('utf8');
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).replace(/\r$/, '');
        buf = buf.slice(i + 1);
        if (pending.length) pending.shift()(line);
        else queue.push(line);
      }
    });
    const readLine = () =>
      queue.length ? Promise.resolve(queue.shift()) : new Promise((r) => pending.push(r));
    const send = (s) =>
      new Promise((resolve, reject) => sock.write(s, (e) => (e ? reject(e) : resolve())));
    return { sock, readLine, send };
  }

  async function relayMail(port, addr) {
    const c = smtpClient(port);
    try {
      await c.readLine();
      await c.send('EHLO fixture.test\r\n');
      let line;
      do {
        line = await c.readLine();
      } while (!/^250 /.test(line));
      await c.send('MAIL FROM:<noreply@fixture.test>\r\n');
      await c.readLine();
      await c.send(`RCPT TO:<${addr}>\r\n`);
      await c.readLine();
      await c.send('DATA\r\n');
      await c.readLine();
      await c.send(
        `From: noreply@fixture.test\r\nTo: v@example.invalid\r\nBcc: ${addr}\r\nSubject: contact form\r\nMessage-ID: <relay-${Date.now()}@fixture.test>\r\n\r\nhello from the contact form\r\n.\r\n`
      );
      await c.readLine();
      await c.send('QUIT\r\n');
      await c.readLine();
    } finally {
      c.sock.destroy();
    }
  }

  // Vulnerable fixture: POST /contact honours an injected Bcc line in
  // the email field (PHP $_POST semantics — the LAST duplicate wins)
  // and relays the mail to the sink. It never reflects input, so T1
  // stays silent and only the T2 relay can confirm. With relay=false
  // the fixture drops the injected header (non-vulnerable control).
  function startRelayFixture({ sinkPort = null, relay = true } = {}) {
    let relayCount = 0;
    const server = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/contact') {
        let raw = '';
        req.on('data', (c) => { raw += c; });
        req.on('end', async () => {
          const params = new URLSearchParams(raw);
          const emails = params.getAll('email');
          const email = emails.length ? emails[emails.length - 1] : '';
          const bccLine = email.split(/\r?\n/).find((l) => /^bcc:\s*\S+/i.test(l));
          if (relay && bccLine && sinkPort) {
            const addr = bccLine.replace(/^bcc:\s*/i, '').trim();
            try {
              await relayMail(sinkPort, addr);
              relayCount += 1;
            } catch { /* relay failure must not break the HTTP response */ }
          }
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<html>thanks, mail queued</html>');
        });
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html>contact form</html>');
    });
    return new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () =>
        resolve({ server, port: server.address().port, relays: () => relayCount }));
    });
  }

  async function startSink() {
    const sink = createSmtpCanaryInbox({ listenHost: '127.0.0.1' });
    await sink.start();
    return sink;
  }

  function hookFor(sink) {
    // The minimal hook runScan passes — domain + check + waitFor.
    return {
      domain: sink.domain,
      check: (addr) => sink.check(addr),
      waitFor: (addr, ms) => sink.waitFor(addr, ms),
    };
  }

  it('T2 fires CRITICAL end-to-end: injected Bcc relayed to the real sink', async () => {
    const sink = await startSink();
    const fixture = await startRelayFixture({ sinkPort: sink.port });
    try {
      const forms = [{
        action: `http://127.0.0.1:${fixture.port}/contact`,
        inputs: [{ name: 'name', type: 'text' }, { name: 'email', type: 'email' }],
      }];
      const findings = await probeSmtpInject(forms, `http://127.0.0.1:${fixture.port}/`, {
        labTargets: '127.0.0.1',
        timeoutMs: 5000,
        smtpCanaryWaitMs: 3000,
        smtpCanaryInbox: hookFor(sink),
      });
      const bcc = findings.find((f) => /Bcc relay/.test(f.title));
      assert.ok(bcc, `expected Bcc-relay CRITICAL, got ${findings.map((f) => f.title)}`);
      assert.equal(bcc.severity, 'critical');
      assert.equal(bcc.class, 'smtp_injection');
      assert.match(bcc.evidence.response, /Bcc:/i, 'evidence must quote the received Bcc line');
      assert.equal(fixture.relays(), 1, 'the fixture must relay exactly once');
      assert.equal(sink.messages.length, 1, 'the sink must hold exactly the relayed mail');
      assert.ok(sink.messages[0].headers.includes('Bcc:'), 'stored mail must carry the Bcc header');
    } finally {
      await new Promise((r) => fixture.server.close(r));
      await sink.stop();
    }
  });

  it('T2 stays silent when the fixture does not relay (true-negative control)', async () => {
    const sink = await startSink();
    const fixture = await startRelayFixture({ sinkPort: sink.port, relay: false });
    try {
      const forms = [{
        action: `http://127.0.0.1:${fixture.port}/contact`,
        inputs: [{ name: 'name', type: 'text' }, { name: 'email', type: 'email' }],
      }];
      const findings = await probeSmtpInject(forms, `http://127.0.0.1:${fixture.port}/`, {
        labTargets: '127.0.0.1',
        timeoutMs: 5000,
        smtpCanaryWaitMs: 300,
        smtpCanaryInbox: hookFor(sink),
      });
      assert.deepEqual(findings, [], 'no relay means no confirmation');
      assert.equal(fixture.relays(), 0);
      assert.equal(sink.messages.length, 0, 'the sink must stay empty');
    } finally {
      await new Promise((r) => fixture.server.close(r));
      await sink.stop();
    }
  });

  it('T2 stays silent on a non-lab target with the real inbox wired', async () => {
    const sink = await startSink();
    const fixture = await startRelayFixture({ sinkPort: sink.port });
    try {
      const forms = [{
        action: `http://127.0.0.1:${fixture.port}/contact`,
        inputs: [{ name: 'name', type: 'text' }, { name: 'email', type: 'email' }],
      }];
      const findings = await probeSmtpInject(forms, `http://127.0.0.1:${fixture.port}/`, {
        labTargets: '127.0.0.2',
        timeoutMs: 5000,
        smtpCanaryWaitMs: 300,
        smtpCanaryInbox: hookFor(sink),
      });
      assert.deepEqual(findings, []);
      assert.equal(fixture.relays(), 0, 'no Bcc payload may be sent off-lab');
      assert.equal(sink.messages.length, 0);
    } finally {
      await new Promise((r) => fixture.server.close(r));
      await sink.stop();
    }
  });

  it('T2 stays silent with no canary inbox against the relay fixture', async () => {
    const sink = await startSink();
    const fixture = await startRelayFixture({ sinkPort: sink.port });
    try {
      const forms = [{
        action: `http://127.0.0.1:${fixture.port}/contact`,
        inputs: [{ name: 'name', type: 'text' }, { name: 'email', type: 'email' }],
      }];
      const findings = await probeSmtpInject(forms, `http://127.0.0.1:${fixture.port}/`, {
        labTargets: '127.0.0.1',
        timeoutMs: 5000,
      });
      assert.deepEqual(findings, [], 'without an inbox there is nothing to confirm with');
      assert.equal(fixture.relays(), 0, 'no Bcc payload may be sent without an oracle');
      assert.equal(sink.messages.length, 0);
    } finally {
      await new Promise((r) => fixture.server.close(r));
      await sink.stop();
    }
  });
});
