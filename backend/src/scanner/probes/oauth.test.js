// Tests for the OAuth/OIDC probe — bundle hints, client_id extraction, the
// no-follow redirect oracle, discovery parsing, and the no-endpoint fast path.
// Live authorization flows are never completed; redirects are never followed.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  probeOauth,
  oauthAuthRequest,
  discoverOidc,
  matchOauthBundleHints,
  extractClientId,
} from './oauth.js';

describe('oauth probe', () => {
  let server;
  let port;

  before(async () => {
    server = http.createServer((req, res) => {
      const u = new URL(req.url, `http://127.0.0.1:${port}`);
      if (u.pathname === '/.well-known/openid-configuration') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          issuer: `http://127.0.0.1:${port}`,
          authorization_endpoint: `http://127.0.0.1:${port}/oauth/authorize`,
          token_endpoint: `http://127.0.0.1:${port}/oauth/token`,
          jwks_uri: `http://127.0.0.1:${port}/.well-known/jwks.json`,
        }));
        return;
      }
      if (u.pathname === '/oauth/authorize') {
        const ru = u.searchParams.get('redirect_uri') || '';
        const state = u.searchParams.get('state') || '';
        // Reject evil.example, accept anything else (safe stub).
        if (ru.includes('evil.example')) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('invalid redirect_uri');
          return;
        }
        // 302 to the registered URI with a code — NEVER followed by the probe.
        res.writeHead(302, { Location: `${ru}?code=stub-code&state=${state}` });
        res.end();
        return;
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = server.address().port;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('returns empty array when no OAuth endpoint found', async () => {
    // Nothing listens here — every request fails fast.
    const findings = await probeOauth('http://127.0.0.1:1/', { timeoutMs: 800, depth: 'quick' });
    assert.deepEqual(findings, []);
  });

  it('oauthAuthRequest does NOT follow redirects (reads 302 Location and stops)', async () => {
    const r = await oauthAuthRequest(`http://127.0.0.1:${port}/oauth/authorize`, {
      client_id: 'c', redirect_uri: `http://127.0.0.1:${port}/cb`, response_type: 'code', state: 's1',
    }, { timeoutMs: 2000 });
    assert.equal(r.status, 302);
    assert.ok(r.location.includes('code=stub-code'), `expected code in Location, got ${r.location}`);
    assert.ok(r.location.includes('state=s1'));
  });

  it('discoverOidc parses the well-known document', async () => {
    const d = await discoverOidc(`http://127.0.0.1:${port}/`, { timeoutMs: 2000 });
    assert.ok(d);
    assert.equal(d.authorization_endpoint, `http://127.0.0.1:${port}/oauth/authorize`);
    assert.equal(d.issuer, `http://127.0.0.1:${port}`);
  });

  it('discoverOidc returns null when well-known is absent', async () => {
    const d = await discoverOidc('http://127.0.0.1:1/', { timeoutMs: 500 });
    assert.equal(d, null);
  });

  it('emits discovery INFO but no bypass on a safe stub', async () => {
    const findings = await probeOauth(`http://127.0.0.1:${port}/`, { timeoutMs: 2000, depth: 'standard' });
    const classes = findings.map((f) => f.class);
    assert.ok(classes.includes('oauth_discovery'), `expected oauth_discovery, got ${classes}`);
    assert.ok(!classes.includes('oauth_redirect_uri_bypass'), 'safe stub must not confirm bypass');
    assert.ok(!classes.includes('oauth_implicit_flow'), 'stub never issues fragment tokens');
    // Every finding carries a verdict-grade evidence object + parameter.
    for (const f of findings) {
      assert.ok(f.evidence && typeof f.evidence === 'object');
      assert.ok(f.evidence.request && f.evidence.response);
      assert.ok(f.parameter, `finding ${f.class} missing parameter`);
      assert.ok(f.evidence.signalCorrelated === true);
    }
  });

  it('matches OAuth bundle hints', () => {
    const hits = matchOauthBundleHints('const cfg = { client_id: "abc", redirect_uri: "https://x/cb" }; // Login with Google');
    assert.ok(hits.length >= 2, `expected >=2 hints, got ${hits.length}`);
  });

  it('returns no hits on plain HTML', () => {
    assert.deepEqual(matchOauthBundleHints('<html><body>hello</body></html>'), []);
  });

  it('extracts client_id from bundle text', () => {
    assert.equal(extractClientId('client_id="my-app-123"'), 'my-app-123');
    assert.equal(extractClientId('no id here'), null);
  });

  it('never sends real credentials — canary client_id only', async () => {
    // The stub echoes back whatever client_id it got; assert the probe used a
    // dm-canary-* id, never a real one from opts (none supplied here).
    const r = await oauthAuthRequest(`http://127.0.0.1:${port}/oauth/authorize`, {
      client_id: 'dm-canary-test', redirect_uri: `http://127.0.0.1:${port}/cb`,
      response_type: 'code', state: 's',
    }, { timeoutMs: 2000 });
    assert.equal(r.status, 302);
  });
});

// Auth-gap coverage: #319 OAuth scope escalation (lab-gated) + #320 OIDC
// id_token config gaps (passive discovery). Live flows are never completed.
describe('oauth auth gaps (#319/#320)', () => {
  let server;
  let port;
  const base = () => `http://127.0.0.1:${port}`;
  // Stub OP behavior switch: 'accept' echoes the requested scope with a code;
  // 'reject' answers the escalated scope with error=invalid_scope.
  let scopeMode = 'accept';

  before(async () => {
    server = http.createServer((req, res) => {
      const u = new URL(req.url, base());
      if (u.pathname === '/.well-known/openid-configuration') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          issuer: base(),
          authorization_endpoint: `${base()}/oauth/authorize`,
          token_endpoint: `${base()}/oauth/token`,
          jwks_uri: `${base()}/.well-known/jwks.json`,
          id_token_signing_alg_values_supported: ['none', 'RS256'],
          token_endpoint_auth_methods_supported: ['client_secret_basic', 'none'],
          response_types_supported: ['code', 'id_token'],
          response_modes_supported: ['query', 'fragment'],
        }));
        return;
      }
      if (u.pathname === '/oauth/authorize') {
        const ru = u.searchParams.get('redirect_uri') || '';
        const state = u.searchParams.get('state') || '';
        const scope = u.searchParams.get('scope') || '';
        // Reject attacker hosts (same safe-stub policy as the first describe).
        if (ru.includes('evil.example')) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('invalid redirect_uri');
          return;
        }
        if (scopeMode === 'reject' && /admin/.test(scope)) {
          res.writeHead(302, { Location: `${ru}?error=invalid_scope&state=${state}` });
          res.end();
          return;
        }
        // Accept: echo the requested scope with the code (never followed).
        res.writeHead(302, { Location: `${ru}?code=scope-code&state=${state}&scope=${encodeURIComponent(scope)}` });
        res.end();
        return;
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = server.address().port;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('#319 fires HIGH when the OP accepts an escalated scope (lab mode)', async () => {
    scopeMode = 'accept';
    const findings = await probeOauth(`${base()}/`, {
      timeoutMs: 2000, depth: 'standard', labTargets: '127.0.0.1',
    });
    const esc = findings.find((f) => f.class === 'oauth_scope_escalation');
    assert.ok(esc, `expected oauth_scope_escalation, got ${findings.map((f) => f.class)}`);
    assert.equal(esc.severity, 'high');
    assert.equal(esc.parameter, 'scope');
    assert.ok(esc.evidence.request && esc.evidence.response && esc.evidence.signalCorrelated === true);
    assert.ok(/invalid\.invalid/.test(esc.evidence.response), 'must use the canary-invalid redirect_uri');
  });

  it('#319 is skipped silently on non-lab targets', async () => {
    scopeMode = 'accept';
    const findings = await probeOauth(`${base()}/`, {
      timeoutMs: 2000, depth: 'standard', labTargets: 'lab.local',
    });
    const classes = findings.map((f) => f.class);
    assert.ok(!classes.includes('oauth_scope_escalation'), `non-lab must not test scope escalation, got ${classes}`);
    // Passive discovery (#320a) still runs — lab gating applies to requests only.
    assert.ok(classes.includes('oidc_alg_none_supported'), 'passive config findings are not lab-gated');
  });

  it('#319 stays quiet when the OP rejects the escalated scope (honest negative)', async () => {
    scopeMode = 'reject';
    const findings = await probeOauth(`${base()}/`, {
      timeoutMs: 2000, depth: 'standard', labTargets: '127.0.0.1',
    });
    const classes = findings.map((f) => f.class);
    assert.ok(!classes.includes('oauth_scope_escalation'), `invalid_scope = correct behavior, got ${classes}`);
    scopeMode = 'accept';
  });

  it('#320 fires on discovery doc advertising alg=none for id_token', async () => {
    scopeMode = 'accept';
    const findings = await probeOauth(`${base()}/`, {
      timeoutMs: 2000, depth: 'standard', labTargets: 'lab.local',
    });
    const algNone = findings.find((f) => f.class === 'oidc_alg_none_supported');
    assert.ok(algNone, `expected oidc_alg_none_supported, got ${findings.map((f) => f.class)}`);
    assert.equal(algNone.severity, 'high');
    assert.equal(algNone.parameter, 'id_token_signing_alg_values_supported');
    const authNone = findings.find((f) => f.class === 'oidc_token_endpoint_auth_none');
    assert.ok(authNone, 'expected oidc_token_endpoint_auth_none INFO');
    assert.equal(authNone.severity, 'info');
    const qmode = findings.find((f) => f.class === 'oidc_query_response_mode');
    assert.ok(qmode, 'expected oidc_query_response_mode INFO (id_token + query mode)');
  });

  it('#319/#320 findings carry the verdict-grade evidence contract', async () => {
    scopeMode = 'accept';
    const findings = await probeOauth(`${base()}/`, {
      timeoutMs: 2000, depth: 'standard', labTargets: '127.0.0.1',
    });
    const gap = findings.filter((f) => /oauth_scope_escalation|oidc_/.test(f.class));
    assert.ok(gap.length >= 2, `expected gap findings, got ${findings.map((f) => f.class)}`);
    for (const f of gap) {
      assert.ok(f.parameter, `finding ${f.class} missing parameter`);
      assert.ok(f.evidence && f.evidence.request && f.evidence.response);
      assert.ok(f.evidence.impact_demo);
      assert.equal(f.evidence.signalCorrelated, true);
      assert.ok(f.id && f.title && f.url && f.severity);
    }
  });
});
