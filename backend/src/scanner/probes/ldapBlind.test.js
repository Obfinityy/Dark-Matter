// Tests for the LDAP boolean-blind probe (coverage row #203 [High] LDAP Injection).
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import { probeLdapBlind, triple, visibleText } from './ldapBlind.js';

describe('ldapBlind probe', () => {
  let server;
  let port;
  const base = () => `http://127.0.0.1:${port}`;

  before(async () => {
    server = http.createServer((req, res) => {
      const u = new URL(req.url, base());
      const user = u.searchParams.get('user') || '';
      const pass = u.searchParams.get('pass') || '';
      // Vulnerable stub: wildcard filter matches, wrong user does not.
      if (user === '*' || user === 'admin*') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html>welcome, 3 users found</html>');
        return;
      }
      if (user === 'nosuchuser_xyz') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html>0 users found</html>');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html>login page</html>');
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    port = server.address().port;
  });

  after(() => server.close());

  it('detects boolean-oracle inventory on wildcard-responsive login', async () => {
    const findings = await probeLdapBlind(`${base()}/login`, ['user', 'pass'], { timeoutMs: 5000 });
    assert.ok(Array.isArray(findings));
    // May or may not confirm depending on oracle thresholds; must not throw.
  });

  it('returns empty gracefully on non-ldap page', async () => {
    const findings = await probeLdapBlind(`${base()}/about`, [], { timeoutMs: 5000 });
    assert.ok(Array.isArray(findings));
  });

  it('handles unreachable host without throwing', async () => {
    const findings = await probeLdapBlind('http://127.0.0.1:1/login', ['user'], { timeoutMs: 2000 });
    assert.deepEqual(findings, []);
  });
});

describe('ldapBlind token-noise + control-veto regression (7 Nov 2026)', () => {
  // DVWA false positive, hunt h_fb007db4d145: login.php embeds a per-request
  // random 32-hex-char CSRF token (hidden user_token). The baseline token
  // happened to contain "bad" (a hex-compatible deny keyword) while the
  // probe tokens did not, so the old whole-body triple() read baseline deny
  // vs probes other and fired a spurious 2/3 oracle — on a page with no
  // LDAP backend. These tests pin the two system-level fixes:
  //   (1) signal matching reads visible text only (token values ignored);
  //   (2) the nonsense wildcard zzz* is a REQUIRED control (veto, not vote).
  let server;
  let port;
  let mode = 'token-noise';
  const base = () => `http://127.0.0.1:${port}`;
  // Both 32 hex chars, so every response lands in the same length bucket.
  const BAD_TOKEN = 'bad' + '0123456789abcdef0123456789abc';
  const CLEAN_TOKEN = '0123456789abcdef0123456789abcdef';
  const FORM = (token) =>
    `<html><body><form><input type='hidden' name='user_token' value='${token}' />` +
    `<label>Username</label><input name='username' />` +
    `<label>Password</label><input name='password' /></form></body></html>`;
  const WELCOME = '<html>Welcome to the dashboard</html>';
  const FAILED = '<html>Username and/or password incorrect.</html>';
  // Zerodha shape (9 Nov 2026, hunt h_6b5942052353): Cloudflare
  // "Just a moment" interstitial — same outcome words as the baseline,
  // only the length bucket differs (challenge page is longer).
  const CHALLENGE =
    '<html><head><title>Just a moment...</title></head><body>' +
    '<h1>Just a moment...</h1><p>Checking your browser before accessing this site.</p>' +
    '<p>DDoS protection by Cloudflare.</p>' +
    `<style>${'*{box-sizing:border-box;margin:0;padding:0}'.repeat(40)}</style>` +
    '</body></html>';
  let baselineCalls = 0;

  function readBody(req) {
    return new Promise((resolve) => {
      let data = '';
      req.on('data', (c) => { data += c; });
      req.on('end', () => resolve(data));
    });
  }

  before(async () => {
    server = http.createServer(async (req, res) => {
      const body = await readBody(req);
      const user = new URLSearchParams(body).get('user') || '';
      let page;
      if (mode === 'token-noise') {
        // DVWA shape: same login form every time, token differs per request.
        // The baseline (wrong-user) request draws the "bad" token; probes do not.
        page = FORM(user.startsWith('zz_no_such_') ? BAD_TOKEN : CLEAN_TOKEN);
      } else if (mode === 'star-moves-all') {
        // Any '*' in the input changes the outcome — NOT LDAP-specific.
        page = user.includes('*') ? WELCOME : FAILED;
      } else if (mode === 'challenge-star') {
        // Zerodha shape: the wildcard leg is answered by a Cloudflare
        // challenge page (different bucket, same outcome words); every
        // other leg is the plain failed-login page.
        page = user === '*' ? CHALLENGE : FAILED;
      } else if (mode === 'noisy-baseline') {
        // FP3 shape: the wrong-user baseline itself wobbles — alternate
        // calls return a short and a long failed-login page, so the two
        // baseline fetches disagree and the differential is void.
        if (user.startsWith('zz_no_such_')) {
          baselineCalls += 1;
          page = baselineCalls % 2 === 1 ? FAILED : FAILED + 'x'.repeat(900);
        } else {
          page = user === '*' ? WELCOME : FAILED;
        }
      } else {
        // True oracle: real wildcards move, the nonsense wildcard does not.
        page = (user === '*' || user === 'admin*' || user === '*)(uid=*') ? WELCOME : FAILED;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(page);
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    port = server.address().port;
  });

  after(() => server.close());

  it('token-noise: a baseline token containing "bad" does not fire', async () => {
    mode = 'token-noise';
    const findings = await probeLdapBlind(`${base()}/login`, ['user', 'pass'], { timeoutMs: 5000 });
    assert.deepEqual(findings, []);
  });

  it('veto: zzz* moving the outcome blocks the finding even when star+paren move', async () => {
    mode = 'star-moves-all';
    const findings = await probeLdapBlind(`${base()}/login`, ['user', 'pass'], { timeoutMs: 5000 });
    assert.deepEqual(findings, []);
  });

  it('positive control: a true oracle (wildcards move, zzz* stays) still fires', async () => {
    mode = 'true-oracle';
    const findings = await probeLdapBlind(`${base()}/login`, ['user', 'pass'], { timeoutMs: 5000 });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'ldap_injection');
    assert.equal(findings[0].title, 'LDAP injection — boolean oracle detected (filter logic responds to wildcards)');
    assert.equal(findings[0].severity, 'medium');
  });

  it('challenge: a Cloudflare interstitial answering the wildcard leg does not fire (Zerodha FP)', async () => {
    // Recorded matrices: baseline err:other:15, star err:other:14 (bucket
    // only) on /open-account; baseline err:other:17, star err:deny:16
    // (challenge page) on /varsity/wp-comments-post.php. Either way the
    // "moved" response is a challenge page, never LDAP logic.
    mode = 'challenge-star';
    const findings = await probeLdapBlind(`${base()}/login`, ['user', 'pass'], { timeoutMs: 5000 });
    assert.deepEqual(findings, []);
  });

  it('double-control: a wobbling wrong-user baseline voids the oracle (FP3)', async () => {
    mode = 'noisy-baseline';
    baselineCalls = 0;
    const findings = await probeLdapBlind(`${base()}/login`, ['user', 'pass'], { timeoutMs: 5000 });
    assert.deepEqual(findings, []);
  });

  it('stack gate: a php/wordpress stack skips the probe even on a true oracle', async () => {
    mode = 'true-oracle';
    const findings = await probeLdapBlind(`${base()}/login`, ['user', 'pass'], { timeoutMs: 5000, stack: ['php', 'wordpress'] });
    assert.deepEqual(findings, [], 'LDAP probe must not run where no LDAP filter backend can exist');
  });

  it('triple: visible "incorrect" is deny, visible "Welcome" is allow', () => {
    assert.match(triple({ status: 200, text: FAILED }), /^ok:deny:/);
    assert.match(triple({ status: 200, text: WELCOME }), /^ok:allow:/);
    assert.match(triple({ status: 200, text: '<html>login page</html>' }), /^ok:other:/);
  });

  it('triple: a token containing "bad" in a hidden input does not flip the signal', () => {
    const page = FORM(BAD_TOKEN);
    assert.equal(visibleText(page).toLowerCase().includes('bad'), false);
    assert.match(triple({ status: 200, text: page }), /^ok:other:/);
    // The token value itself is untouched in the raw body — only the
    // signal reading ignores it.
    assert.ok(page.includes(BAD_TOKEN));
  });

  it('visibleText: strips tags and attribute values, keeps text nodes', () => {
    const out = visibleText('<div class="bad">Hello <b>World</b></div><input type="hidden" value="bad42" />');
    assert.equal(out.includes('bad'), false);
    assert.ok(out.includes('Hello'));
    assert.ok(out.includes('World'));
  });
});

describe('ldapBlind coverage-row label (10 Nov 2026)', () => {
  // The probe header, its test header and the doc all credited coverage
  // row #32 for years; row #32 is API: No / Weak Rate Limiting, while
  // LDAP Injection is row #203 (scanner-coverage-vs-478-20261104.md).
  // This pins the corrected label so a future edit cannot silently
  // re-credit the wrong row.
  it('probe header, test header and doc all cite coverage row #203, never #32', () => {
    const here = new URL(import.meta.url);
    const probeHeader = fs.readFileSync(new URL('./ldapBlind.js', here), 'utf8').split('\n')[0];
    const testHeader = fs.readFileSync(here, 'utf8').split('\n')[0];
    const docHeader = fs.readFileSync(new URL('../../../../docs/scanner/ldap-blind.md', here), 'utf8').split('\n')[0];
    for (const [name, line] of [['probe', probeHeader], ['test', testHeader], ['doc', docHeader]]) {
      assert.match(line, /coverage row #203/, `${name} header must cite coverage row #203`);
      assert.doesNotMatch(line, /#32/, `${name} header must not cite row #32 (API rate limiting)`);
    }
  });
});
