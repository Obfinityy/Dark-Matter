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
  weakTokenReason,
  resetTokenForms,
} from './passwordReset.js';

describe('passwordReset probe (#324)', () => {
  let server;
  let port;
  const base = () => `http://127.0.0.1:${port}`;
  // Stub modes: 'disclose' (short token in JSON), 'same' (identical token for
  // any email), 'strong' (unique 64-hex tokens), 'passive' (token embedded in
  // the GET page HTML), 'clean' (no token anywhere).
  let mode = 'disclose';
  let postCount = 0;
  const fixedToken = 'fixed-token-abc123-fixed-token-abc123-x';

  before(async () => {
    server = http.createServer((req, res) => {
      const u = new URL(req.url, base());
      if (u.pathname === '/reset' && req.method === 'POST') {
        postCount++;
        let raw = '';
        req.on('data', (c) => { raw += c; });
        req.on('end', () => {
          const params = new URLSearchParams(raw);
          const email = params.get('email') || 'anon';
          res.writeHead(200, { 'Content-Type': 'application/json' });
          if (mode === 'disclose') {
            // Short (weak) but per-email-unique: exercises the entropy branch,
            // not the identical-token branch.
            const h = crypto.createHash('sha256').update(email).digest('hex').slice(0, 6);
            res.end(JSON.stringify({ reset_token: `tok-${h}`, status: 'ok' }));
          }
          else if (mode === 'same') res.end(JSON.stringify({ reset_token: fixedToken, status: 'ok' }));
          else if (mode === 'strong') {
            const tok = crypto.randomBytes(32).toString('hex') + Buffer.from(email).toString('hex').slice(0, 8);
            res.end(JSON.stringify({ reset_token: tok, status: 'ok' }));
          } else res.end(JSON.stringify({ status: 'ok', message: 'if the account exists, a mail was sent' }));
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
});
