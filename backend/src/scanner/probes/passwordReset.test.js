// Tests for the password-reset token probe (#324): token disclosure in the
// HTTP response (critical), identical-token predictability (critical), weak
// entropy (critical), high-entropy unique tokens (no predictability finding),
// lab gating (no submissions on non-lab targets), and the passive
// token-in-page check. Local stubs only, canary emails only.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import {
  probePasswordReset,
  extractResetToken,
  extractPoisonedResetLink,
  weakTokenReason,
  resetTokenForms,
} from './passwordReset.js';

describe('passwordReset probe (#324)', () => {
  let server;
  let port;
  const base = () => `http://127.0.0.1:${port}`;
  // Stub modes: 'disclose' (short token in JSON), 'same' (identical token for
  // any email), 'strong' (unique 64-hex tokens), 'passive' (token embedded in
  // the GET page HTML), 'clean' (no token anywhere), 'poison' (reset link
  // built from the received Host header — T3 positive), 'ignore-host'
  // (reset link always built from a fixed configured host — T3 negative),
  // 'reflect' (canary Host echoed as bare text, no reset link — T3 guard),
  // 'redirect' (canary-Host request gets a 302 whose Location carries the
  // poisoned reset link — T3 via Location header).
  let mode = 'disclose';
  let postCount = 0;
  let hostsSeen = [];
  const fixedToken = 'fixed-token-abc123-fixed-token-abc123-x';
  const strongTok = () => crypto.randomBytes(32).toString('hex');

  before(async () => {
    server = http.createServer((req, res) => {
      const u = new URL(req.url, base());
      if (u.pathname === '/reset' && req.method === 'POST') {
        postCount++;
        hostsSeen.push(req.headers.host || '');
        let raw = '';
        req.on('data', (c) => { raw += c; });
        req.on('end', () => {
          const params = new URLSearchParams(raw);
          const email = params.get('email') || 'anon';
          const host = req.headers.host || '';
          // The probe POSTs to 127.0.0.1:<port>, so a normal Host is
          // '127.0.0.1:<port>'; anything else is the T3 canary Host.
          const isCanary = !host.startsWith('127.0.0.1');
          if (mode === 'disclose') {
            // Short (weak) but per-email-unique: exercises the entropy branch,
            // not the identical-token branch.
            const h = crypto.createHash('sha256').update(email).digest('hex').slice(0, 6);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ reset_token: `tok-${h}`, status: 'ok' }));
          }
          else if (mode === 'same') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ reset_token: fixedToken, status: 'ok' }));
          }
          else if (mode === 'strong') {
            const tok = crypto.randomBytes(32).toString('hex') + Buffer.from(email).toString('hex').slice(0, 8);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ reset_token: tok, status: 'ok' }));
          }
          else if (mode === 'poison') {
            // Reset link built from the received Host header — a poisoned
            // Host lands in the link. Strong unique token per email, so
            // only T1 (disclosure) + T3 (poisoning) fire, not T2.
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ reset_link: `https://${host}/reset/confirm?token=${strongTok()}`, status: 'ok' }));
          }
          else if (mode === 'ignore-host') {
            // Reset link always built from the configured base URL,
            // whatever Host arrives — the poisoning oracle must stay silent.
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ reset_link: `https://app.example.com/reset/confirm?token=${strongTok()}`, status: 'ok' }));
          }
          else if (mode === 'reflect') {
            // Canary Host echoed as bare text, no reset link anywhere —
            // the T3 guard (reset-link context only) must stay silent.
            // Normal-Host request discloses a strong token so T1 fires
            // and the T3 submission actually runs.
            res.writeHead(200, { 'Content-Type': 'application/json' });
            if (isCanary) res.end(JSON.stringify({ status: 'ok', echo_host: host }));
            else res.end(JSON.stringify({ reset_token: strongTok(), status: 'ok' }));
          }
          else if (mode === 'redirect') {
            // Canary-Host request gets a 302 whose Location carries the
            // poisoned reset link; normal-Host request discloses a token
            // (T1) so the T3 submission runs.
            if (isCanary) {
              res.writeHead(302, { Location: `https://${host}/reset/confirm?token=${strongTok()}` });
              res.end();
            } else {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ reset_token: strongTok(), status: 'ok' }));
            }
          }
          else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', message: 'if the account exists, a mail was sent' }));
          }
        });
        return;
      }
      if (u.pathname === '/reset' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        if (mode === 'passive') {
          res.end('<html><a href="/reset/confirm?token=pagetoken-embed-1234567890abcdef">reset</a></html>');
        } else {
          res.end('<html><form action="/reset"><input name="email"></form></html>');
        }
        return;
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    port = server.address().port;
  });

  after(() => server.close());

  const forms = () => [{ action: `${base()}/reset`, inputs: [{ name: 'email' }, { name: 'submit', value: 'Reset' }] }];
  const labOpts = { labTargets: '127.0.0.1', timeoutMs: 2000 };

  it('T1: fires CRITICAL when the reset token is disclosed in the JSON response', async () => {
    mode = 'disclose';
    postCount = 0;
    const findings = await probePasswordReset(forms(), base(), labOpts);
    const d = findings.find((f) => f.class === 'pwdreset_token_in_response');
    assert.ok(d, `expected pwdreset_token_in_response, got ${findings.map((f) => f.class)}`);
    assert.equal(d.severity, 'critical');
    assert.equal(d.parameter, 'email');
    assert.equal(postCount, 2, 'lab mode may submit at most twice (entropy re-check)');
    assert.ok(d.evidence.signalCorrelated === true);
  });

  it('T2: fires CRITICAL predictability when the same token is issued for two emails', async () => {
    mode = 'same';
    const findings = await probePasswordReset(forms(), base(), labOpts);
    const p = findings.find((f) => f.class === 'pwdreset_token_predictable');
    assert.ok(p, `expected pwdreset_token_predictable, got ${findings.map((f) => f.class)}`);
    assert.equal(p.severity, 'critical');
    assert.ok(/SAME token/i.test(p.evidence.response), `expected identical-token evidence, got ${p.evidence.response}`);
  });

  it('T2: fires on weak entropy (short per-email token)', async () => {
    mode = 'disclose'; // 'tok-<6hex>' = 10 chars < 16, unique per email
    const findings = await probePasswordReset(forms(), base(), labOpts);
    const p = findings.find((f) => f.class === 'pwdreset_token_predictable');
    assert.ok(p, 'short token must trip the entropy bar');
    assert.ok(/16/.test(p.evidence.response), `expected length reason, got ${p.evidence.response}`);
  });

  it('no predictability finding for unique high-entropy tokens', async () => {
    mode = 'strong';
    const findings = await probePasswordReset(forms(), base(), labOpts);
    const classes = findings.map((f) => f.class);
    assert.ok(!classes.includes('pwdreset_token_predictable'), `strong tokens must not trip entropy, got ${classes}`);
    // T1 still fires — the stub discloses the token in the response by design.
    assert.ok(classes.includes('pwdreset_token_in_response'), 'disclosure still applies');
  });

  it('non-lab targets: no submission, passive page-token still flagged', async () => {
    mode = 'passive';
    postCount = 0;
    const findings = await probePasswordReset(forms(), base(), { labTargets: 'lab.local', timeoutMs: 2000 });
    const d = findings.find((f) => f.class === 'pwdreset_token_in_response');
    assert.ok(d, 'passive embedded token must fire');
    assert.ok(/passive/i.test(d.evidence.request), `expected passive evidence, got ${d.evidence.request}`);
    assert.equal(postCount, 0, 'non-lab mode must never POST');
  });

  it('non-lab targets with a clean page: no findings, no submission', async () => {
    mode = 'clean';
    postCount = 0;
    const findings = await probePasswordReset(forms(), base(), { labTargets: 'lab.local', timeoutMs: 2000 });
    assert.deepEqual(findings, []);
    assert.equal(postCount, 0);
  });

  it('lab mode with a clean endpoint: no findings', async () => {
    mode = 'clean';
    const findings = await probePasswordReset(forms(), base(), labOpts);
    assert.deepEqual(findings, [], 'no token disclosed => nothing to claim');
  });

  it('returns [] when no reset form exists', async () => {
    const findings = await probePasswordReset(
      [{ action: `${base()}/login`, inputs: [{ name: 'user' }, { name: 'password', type: 'password' }] }],
      base(), labOpts
    );
    assert.deepEqual(findings, []);
  });

  it('extractResetToken parses JSON keys, URL tokens, and ignores placeholders', () => {
    assert.equal(extractResetToken('{"reset_token":"tok-abcdef123456"}'), 'tok-abcdef123456');
    assert.equal(
      extractResetToken('<a href="/account/reset?token=linktok-9876543210">x</a>'),
      'linktok-9876543210'
    );
    assert.equal(extractResetToken('{"reset_token":"example-token-here"}'), null);
    assert.equal(extractResetToken('{"status":"ok"}'), null);
  });

  it('weakTokenReason: bar checks', () => {
    assert.ok(weakTokenReason('short').includes('16'), 'short token');
    assert.ok(weakTokenReason('123456789'), 'numeric 9-digit');
    assert.equal(weakTokenReason('a1b2c3d4e5f60718'), null, '16 mixed chars pass');
    assert.ok(weakTokenReason('test-token-xyz-99'), 'test prefix');
    assert.ok(weakTokenReason('a'.repeat(20)), 'repeated char');
    assert.equal(weakTokenReason(crypto.randomBytes(32).toString('hex')), null, '64 hex passes');
  });

  it('resetTokenForms: reset action without password input only', () => {
    const rs = resetTokenForms([
      { action: '/forgot-password', inputs: [{ name: 'email' }] },
      { action: '/login', inputs: [{ name: 'user' }, { name: 'pass', type: 'password' }] },
      { action: '/reset', inputs: [{ name: 'newpass', type: 'password' }] },
    ]);
    assert.equal(rs.length, 1);
    assert.equal(rs[0].action, '/forgot-password');
  });
  // isLab follow-up (8 Nov 2026): the old local isLab compared the bare
  // hostname against port-bearing labTargets entries, so the lab branch
  // never ran even when runScan passed labTargets. The canonical helper
  // strips ports on both sides.
  it('lab branch runs with PORT-BEARING labTargets (the production shape)', async () => {
    mode = 'disclose';
    postCount = 0;
    const findings = await probePasswordReset(forms(), base(), {
      labTargets: `127.0.0.1:${port}`,
      timeoutMs: 2000,
    });
    const d = findings.find((f) => f.class === 'pwdreset_token_in_response');
    assert.ok(d, `port-bearing labTargets must open the lab branch, got ${findings.map((f) => f.class)}`);
    assert.equal(postCount, 2, 'lab mode submits twice (disclosure + entropy re-check)');
  });

  it('near-miss host stays passive: no submission', async () => {
    mode = 'disclose';
    postCount = 0;
    const findings = await probePasswordReset(forms(), base(), {
      labTargets: '127.0.0.2',
      timeoutMs: 2000,
    });
    assert.deepEqual(findings, []);
    assert.equal(postCount, 0, 'a near-miss labTargets entry must not open the lab branch');
  });

  // ---- T3: Host-header poisoning (coverage row #50 fix) --------------------
  // T3 rides the T2 submission slot (2-submission cap): the second POST
  // carries the canary Host header via rawHeaderFetch (fetch drops Host),
  // and its response serves both the T2 comparison and the T3 oracle.

  it('T3: fires HIGH when the reset link in the poisoned-Host response carries the canary host', async () => {
    mode = 'poison';
    postCount = 0;
    hostsSeen = [];
    const findings = await probePasswordReset(forms(), base(), labOpts);
    const p = findings.find((f) => f.class === 'pwdreset_host_poisoning');
    assert.ok(p, `expected pwdreset_host_poisoning, got ${findings.map((f) => f.class)}`);
    assert.equal(p.severity, 'high');
    assert.equal(p.parameter, 'email');
    // Transport proof: the stub actually received a canary Host header.
    assert.ok(
      hostsSeen.some((h) => /^dmprobe-[a-z0-9]+\.example\.invalid$/.test(h)),
      `expected a dmprobe canary Host header, saw ${JSON.stringify(hostsSeen)}`
    );
    assert.ok(/Host: dmprobe-/.test(p.evidence.request), `expected canary Host in evidence, got ${p.evidence.request}`);
    assert.ok(/example\.invalid/.test(p.evidence.response), `expected canary host in evidence, got ${p.evidence.response}`);
    assert.equal(postCount, 2, 'lab mode still submits at most twice (T3 rides the T2 slot)');
  });

  it('T3: no finding when the reset link ignores the Host header (configured base URL)', async () => {
    mode = 'ignore-host';
    const findings = await probePasswordReset(forms(), base(), labOpts);
    const classes = findings.map((f) => f.class);
    assert.ok(!classes.includes('pwdreset_host_poisoning'), `configured base URL must not trip T3, got ${classes}`);
    // T1 still fires — the link (with a token) is disclosed in the response.
    assert.ok(classes.includes('pwdreset_token_in_response'), 'disclosure still applies');
  });

  it('T3: bare Host reflection without a reset link does NOT confirm', async () => {
    mode = 'reflect';
    const findings = await probePasswordReset(forms(), base(), labOpts);
    const classes = findings.map((f) => f.class);
    assert.ok(!classes.includes('pwdreset_host_poisoning'), `bare reflection is hostHeader.js territory, got ${classes}`);
    assert.ok(classes.includes('pwdreset_token_in_response'), 'T1 must still fire from the first response');
  });

  it('T3: fires when the poisoned reset link arrives via a 302 Location header', async () => {
    mode = 'redirect';
    const findings = await probePasswordReset(forms(), base(), labOpts);
    const p = findings.find((f) => f.class === 'pwdreset_host_poisoning');
    assert.ok(p, `expected pwdreset_host_poisoning via Location, got ${findings.map((f) => f.class)}`);
    assert.equal(p.severity, 'high');
  });

  it('T3: non-lab targets never submit, no T3 finding', async () => {
    mode = 'poison';
    postCount = 0;
    hostsSeen = [];
    const findings = await probePasswordReset(forms(), base(), { labTargets: 'lab.local', timeoutMs: 2000 });
    assert.deepEqual(findings, []);
    assert.equal(postCount, 0, 'non-lab mode must never POST — no canary Host ever leaves the scanner');
    assert.deepEqual(hostsSeen, []);
  });

  it('extractPoisonedResetLink: oracle unit checks', () => {
    const canary = 'dmprobe-abc12345.example.invalid';
    assert.equal(
      extractPoisonedResetLink(`{"reset_link":"https://${canary}/reset/confirm?token=tok-abcdef123456"}`, canary),
      `https://${canary}/reset/confirm?token=tok-abcdef123456`
    );
    // Protocol-relative link counts too.
    assert.equal(
      extractPoisonedResetLink(`<a href="//${canary}/forgot?token=tok-abcdef123456">x</a>`, canary),
      `//${canary}/forgot?token=tok-abcdef123456`
    );
    // Token param alone is a reset-link context even on a non-reset path.
    assert.equal(
      extractPoisonedResetLink(`see https://${canary}/verify?token=tok-abcdef123456 for details`, canary),
      `https://${canary}/verify?token=tok-abcdef123456`
    );
    // Bare reflection — no URL — must NOT confirm.
    assert.equal(extractPoisonedResetLink(`<p>Request host: ${canary}</p>`, canary), null);
    // Canary host in a non-reset URL with no token param must NOT confirm.
    assert.equal(extractPoisonedResetLink(`<a href="https://${canary}/about">x</a>`, canary), null);
    // Same reset link, different host must NOT confirm.
    assert.equal(
      extractPoisonedResetLink('<a href="https://app.example.com/reset/confirm?token=tok-abcdef123456">x</a>', canary),
      null
    );
    // Host comparison is case-insensitive; a trailing port is tolerated.
    assert.equal(
      extractPoisonedResetLink('https://DMPROBE-ABC12345.EXAMPLE.INVALID/reset?token=tok-abcdef123456', canary),
      'https://DMPROBE-ABC12345.EXAMPLE.INVALID/reset?token=tok-abcdef123456'
    );
    assert.equal(
      extractPoisonedResetLink(`https://${canary}:8443/reset?token=tok-abcdef123456`, canary),
      `https://${canary}:8443/reset?token=tok-abcdef123456`
    );
    assert.equal(extractPoisonedResetLink('', canary), null);
    assert.equal(extractPoisonedResetLink('nothing here', canary), null);
  });

});
