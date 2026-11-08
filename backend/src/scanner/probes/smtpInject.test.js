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

  // T3 From-spoof + T4 MIME separator (8 Nov 2026, smtp-t3-t4 lane):
  // same stub-inbox pattern as T2. The stub inbox echoes the injected
  // header back for the canary address it is asked about — it derives
  // the per-run rid from the canary address (__dm_smtp_<rid>@...),
  // exactly like T2's stub echoes the queried address into its Bcc
  // line. The real sink is exercised end-to-end further down.
  const t3Forms = () => [{
    action: 'http://127.0.0.1:9/contact',
    inputs: [{ name: 'name', type: 'text' }, { name: 'email', type: 'email' }],
  }];
  const t3Inbox = {
    domain: 'canary.test',
    check: async (addr) => {
      const m = String(addr).match(/__dm_smtp_([a-z0-9]+)@/);
      const rid = m ? m[1] : 'none';
      return { headers: `From: spoofed-${rid}@example.invalid\nMessage-ID: <x@canary.test>` };
    },
  };
  const t4Forms = () => [{
    action: 'http://127.0.0.1:9/contact',
    inputs: [{ name: 'name', type: 'text' }, { name: 'email', type: 'email' }, { name: 'message', type: 'text' }],
  }];
  const t4Inbox = {
    domain: 'canary.test',
    check: async (addr) => {
      const m = String(addr).match(/__dm_smtp_([a-z0-9]+)@/);
      const rid = m ? m[1] : 'none';
      return {
        headers: `Content-Type: multipart/mixed; boundary="dm-${rid}"\nMessage-ID: <x@canary.test>`,
        body: `<p>dm-t4-${rid} injected part</p>`,
      };
    },
  };

  it('T3 fires HIGH with a wired inbox + PORT-BEARING labTargets', async () => {
    const posts = [];
    const origFetch = stubT2Fetch(posts);
    try {
      const findings = await probeSmtpInject(t3Forms(), 'http://127.0.0.1:9/', {
        labTargets: '127.0.0.1:9',
        timeoutMs: 2000,
        smtpCanaryInbox: t3Inbox,
      });
      const spoof = findings.find((f) => /From spoof/.test(f.title));
      assert.ok(spoof, `expected From-spoof HIGH, got ${findings.map((f) => f.title)}`);
      assert.equal(spoof.severity, 'high');
      assert.ok(posts.some((b) => b.includes('From:')), 'the From payload must actually be sent');
    } finally {
      global.fetch = origFetch;
    }
  });

  it('T3 stays silent on a near-miss host (no From POST)', async () => {
    const posts = [];
    const origFetch = stubT2Fetch(posts);
    try {
      const findings = await probeSmtpInject(t3Forms(), 'http://127.0.0.1:9/', {
        labTargets: '127.0.0.2',
        timeoutMs: 2000,
        smtpCanaryInbox: t3Inbox,
      });
      assert.deepEqual(findings, []);
      assert.ok(!posts.some((b) => b.includes('From:')), 'no From payload may be sent off-lab');
    } finally {
      global.fetch = origFetch;
    }
  });

  it('T3 stays silent with no canary inbox wired (graceful skip)', async () => {
    const posts = [];
    const origFetch = stubT2Fetch(posts);
    try {
      const findings = await probeSmtpInject(t3Forms(), 'http://127.0.0.1:9/', {
        labTargets: '127.0.0.1:9',
        timeoutMs: 2000,
      });
      assert.deepEqual(findings, []);
      assert.ok(!posts.some((b) => b.includes('From:')), 'without an inbox there is nothing to confirm with');
    } finally {
      global.fetch = origFetch;
    }
  });

  it('T4 fires MEDIUM with a wired inbox + PORT-BEARING labTargets', async () => {
    const posts = [];
    const origFetch = stubT2Fetch(posts);
    try {
      const findings = await probeSmtpInject(t4Forms(), 'http://127.0.0.1:9/', {
        labTargets: '127.0.0.1:9',
        timeoutMs: 2000,
        smtpCanaryInbox: t4Inbox,
      });
      const mime = findings.find((f) => /MIME separator/.test(f.title));
      assert.ok(mime, `expected MIME-separator MEDIUM, got ${findings.map((f) => f.title)}`);
      assert.equal(mime.severity, 'medium');
      assert.ok(posts.some((b) => b.includes('Content-Type')), 'the Content-Type payload must actually be sent');
      assert.ok(posts.some((b) => b.includes('dm-t4-')), 'the injected part must actually be sent');
    } finally {
      global.fetch = origFetch;
    }
  });

  it('T4 stays silent on a near-miss host (no MIME POST)', async () => {
    const posts = [];
    const origFetch = stubT2Fetch(posts);
    try {
      const findings = await probeSmtpInject(t4Forms(), 'http://127.0.0.1:9/', {
        labTargets: '127.0.0.2',
        timeoutMs: 2000,
        smtpCanaryInbox: t4Inbox,
      });
      assert.deepEqual(findings, []);
      assert.ok(!posts.some((b) => b.includes('Content-Type')), 'no MIME payload may be sent off-lab');
    } finally {
      global.fetch = origFetch;
    }
  });

  it('T4 stays silent with no canary inbox wired (graceful skip)', async () => {
    const posts = [];
    const origFetch = stubT2Fetch(posts);
    try {
      const findings = await probeSmtpInject(t4Forms(), 'http://127.0.0.1:9/', {
        labTargets: '127.0.0.1:9',
        timeoutMs: 2000,
      });
      assert.deepEqual(findings, []);
      assert.ok(!posts.some((b) => b.includes('Content-Type')), 'without an inbox there is nothing to confirm with');
    } finally {
      global.fetch = origFetch;
    }
  });

  it('T4 stays silent when the form has no message field', async () => {
    const posts = [];
    const origFetch = stubT2Fetch(posts);
    try {
      const findings = await probeSmtpInject(t3Forms(), 'http://127.0.0.1:9/', {
        labTargets: '127.0.0.1:9',
        timeoutMs: 2000,
        smtpCanaryInbox: t4Inbox,
      });
      assert.deepEqual(findings, []);
      assert.ok(!posts.some((b) => b.includes('Content-Type')), 'no MIME payload may be sent without a message field');
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

  // Relay one mail to the sink. mail = {from, to, headers[], body} —
  // the fixture's vulnerable mail stack honours the injected header
  // lines the probe smuggled in (Bcc for T2, From for T3,
  // Content-Type for T4) and the message field as the body when a
  // Content-Type override is present.
  async function relayMail(port, mail) {
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
      await c.send(`RCPT TO:<${mail.to}>\r\n`);
      await c.readLine();
      await c.send('DATA\r\n');
      await c.readLine();
      const headerLines = [
        `From: ${mail.from}`,
        `To: ${mail.to}`,
        ...(mail.headers || []),
        'Subject: contact form',
        `Message-ID: <relay-${Date.now()}@fixture.test>`,
      ];
      await c.send(`${headerLines.join('\r\n')}\r\n\r\n${mail.body || 'hello from the contact form'}\r\n.\r\n`);
      await c.readLine();
      await c.send('QUIT\r\n');
      await c.readLine();
    } finally {
      c.sock.destroy();
    }
  }

  // Vulnerable fixture: POST /contact honours injected header lines in
  // the email field (PHP $_POST semantics — the LAST duplicate wins)
  // and relays the mail to the sink: Bcc (T2), From (T3),
  // Content-Type (T4, with the message field as the body). It never
  // reflects input, so T1 stays silent and only a relay can confirm.
  // With relay=false the fixture drops the injected headers
  // (non-vulnerable control).
  function startRelayFixture({ sinkPort = null, relay = true } = {}) {
    let relayCount = 0;
    const server = http.createServer((req, res) => {
      if (req.method === 'POST' && req.url === '/contact') {
        let raw = '';
        req.on('data', (c) => { raw += c; });
        req.on('end', async () => {
          const params = new URLSearchParams(raw);
          const lastParam = (name) => {
            const all = params.getAll(name);
            return all.length ? all[all.length - 1] : '';
          };
          const email = lastParam('email');
          const lines = email.split(/\r?\n/);
          const bccLine = lines.find((l) => /^bcc:\s*\S+/i.test(l));
          const fromLine = lines.find((l) => /^from:\s*\S+/i.test(l));
          const ctLine = lines.find((l) => /^content-type:\s*\S+/i.test(l));
          // Recipient: the Bcc line (T2) wins; otherwise the first line
          // of the email value — the per-run canary address (T3/T4).
          // Only when an injected header line is present: a plain
          // address in the first line (T1's control/payload posts) must
          // never relay on its own.
          let recipient = null;
          if (bccLine) recipient = bccLine.replace(/^bcc:\s*/i, '').trim();
          else if ((fromLine || ctLine) && lines[0] && /@/.test(lines[0])) recipient = lines[0].trim();
          if (relay && recipient && sinkPort) {
            const mail = {
              from: fromLine ? fromLine.replace(/^from:\s*/i, '').trim() : 'noreply@fixture.test',
              to: recipient,
              headers: [bccLine, ctLine].filter(Boolean),
              body: ctLine ? (lastParam('message') || 'hello from the contact form') : 'hello from the contact form',
            };
            try {
              await relayMail(sinkPort, mail);
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
      // Two relays, not one: the same vulnerable fixture also honours
      // the T3 From-spoof payload the probe sends to this form (its
      // recipient is the same per-form canary address), so the probe
      // confirms T3 as well. T4 skips — this form has no message field.
      const spoof = findings.find((f) => /From spoof/.test(f.title));
      assert.ok(spoof, 'the same fixture must also confirm T3 From-spoof');
      assert.equal(fixture.relays(), 2, 'one relay per confirmed variant (T2 + T3)');
      assert.equal(sink.messages.length, 2, 'the sink must hold both relayed mails');
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

  // T3 From-spoof end-to-end (8 Nov 2026, smtp-t3-t4 lane). The form
  // has no message field, so T4 skips; the fixture confirms T2 as
  // well (its Bcc payload relays on the same form), hence 2 relays.
  it('T3 fires HIGH end-to-end: injected From relayed to the real sink', async () => {
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
      const spoof = findings.find((f) => /From spoof/.test(f.title));
      assert.ok(spoof, `expected From-spoof HIGH, got ${findings.map((f) => f.title)}`);
      assert.equal(spoof.severity, 'high');
      assert.equal(spoof.class, 'smtp_injection');
      assert.match(spoof.evidence.response, /From: spoofed-/i, 'evidence must quote the received spoofed From line');
      assert.equal(fixture.relays(), 2, 'one relay per confirmed variant (T2 + T3)');
      assert.equal(sink.messages.length, 2, 'the sink must hold both relayed mails');
      assert.ok(sink.messages.some((m) => /^From: spoofed-/im.test(m.headers)), 'a stored mail must carry the spoofed From');
    } finally {
      await new Promise((r) => fixture.server.close(r));
      await sink.stop();
    }
  });

  it('T3 stays silent when the fixture does not relay (true-negative control)', async () => {
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

  it('T3 stays silent on a non-lab target with the real inbox wired', async () => {
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
      assert.equal(fixture.relays(), 0, 'no From payload may be sent off-lab');
      assert.equal(sink.messages.length, 0);
    } finally {
      await new Promise((r) => fixture.server.close(r));
      await sink.stop();
    }
  });

  it('T3 stays silent with no canary inbox against the relay fixture', async () => {
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
      assert.equal(fixture.relays(), 0, 'no From payload may be sent without an oracle');
      assert.equal(sink.messages.length, 0);
    } finally {
      await new Promise((r) => fixture.server.close(r));
      await sink.stop();
    }
  });

  // T4 MIME separator end-to-end (8 Nov 2026, smtp-t3-t4 lane). The
  // form carries a message field, so all three lab variants confirm
  // on this fixture (T2 Bcc + T3 From + T4 MIME), hence 3 relays.
  const t4E2eForms = (port) => [{
    action: `http://127.0.0.1:${port}/contact`,
    inputs: [{ name: 'name', type: 'text' }, { name: 'email', type: 'email' }, { name: 'message', type: 'text' }],
  }];

  it('T4 fires MEDIUM end-to-end: injected MIME separator relayed to the real sink', async () => {
    const sink = await startSink();
    const fixture = await startRelayFixture({ sinkPort: sink.port });
    try {
      const findings = await probeSmtpInject(t4E2eForms(fixture.port), `http://127.0.0.1:${fixture.port}/`, {
        labTargets: '127.0.0.1',
        timeoutMs: 5000,
        smtpCanaryWaitMs: 3000,
        smtpCanaryInbox: hookFor(sink),
      });
      const mime = findings.find((f) => /MIME separator/.test(f.title));
      assert.ok(mime, `expected MIME-separator MEDIUM, got ${findings.map((f) => f.title)}`);
      assert.equal(mime.severity, 'medium');
      assert.equal(mime.class, 'smtp_injection');
      assert.match(mime.evidence.response, /dm-t4-/i, 'evidence must quote the injected part marker');
      assert.equal(fixture.relays(), 3, 'one relay per confirmed variant (T2 + T3 + T4)');
      assert.equal(sink.messages.length, 3, 'the sink must hold all three relayed mails');
      assert.ok(sink.messages.some((m) => /boundary="dm-/i.test(m.headers)), 'a stored mail must carry the injected boundary');
      assert.ok(sink.messages.some((m) => /dm-t4-/i.test(m.body)), 'a stored mail must carry the injected part');
    } finally {
      await new Promise((r) => fixture.server.close(r));
      await sink.stop();
    }
  });

  it('T4 stays silent when the fixture does not relay (true-negative control)', async () => {
    const sink = await startSink();
    const fixture = await startRelayFixture({ sinkPort: sink.port, relay: false });
    try {
      const findings = await probeSmtpInject(t4E2eForms(fixture.port), `http://127.0.0.1:${fixture.port}/`, {
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

  it('T4 stays silent on a non-lab target with the real inbox wired', async () => {
    const sink = await startSink();
    const fixture = await startRelayFixture({ sinkPort: sink.port });
    try {
      const findings = await probeSmtpInject(t4E2eForms(fixture.port), `http://127.0.0.1:${fixture.port}/`, {
        labTargets: '127.0.0.2',
        timeoutMs: 5000,
        smtpCanaryWaitMs: 300,
        smtpCanaryInbox: hookFor(sink),
      });
      assert.deepEqual(findings, []);
      assert.equal(fixture.relays(), 0, 'no MIME payload may be sent off-lab');
      assert.equal(sink.messages.length, 0);
    } finally {
      await new Promise((r) => fixture.server.close(r));
      await sink.stop();
    }
  });

  it('T4 stays silent with no canary inbox against the relay fixture', async () => {
    const sink = await startSink();
    const fixture = await startRelayFixture({ sinkPort: sink.port });
    try {
      const findings = await probeSmtpInject(t4E2eForms(fixture.port), `http://127.0.0.1:${fixture.port}/`, {
        labTargets: '127.0.0.1',
        timeoutMs: 5000,
      });
      assert.deepEqual(findings, [], 'without an inbox there is nothing to confirm with');
      assert.equal(fixture.relays(), 0, 'no MIME payload may be sent without an oracle');
      assert.equal(sink.messages.length, 0);
    } finally {
      await new Promise((r) => fixture.server.close(r));
      await sink.stop();
    }
  });
});
