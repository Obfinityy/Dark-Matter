// Tests for row #48 — Missing MFA (diagnostic-only, parked)
// (coverage row #48 [Missing MFA]; the firing oracle does not exist
// — see the header comment in mfaBypass.js and
// docs/scanner/mfa-bypass.md "Row #48". No network, no lab — the
// probe talks to the shop only through the opts.fetchFn seam,
// stubbed here by a small stateful fake Juice Shop: login, 2FA
// status/setup/verify/disable, a protected /api/Users list and a
// password-change route. Behaviour flags flip the fake between a
// Juice-like shop (2FA offered, canary not enrolled), a DVWA-like
// shop (no 2FA surface at all), an enrolled shop, and a shop whose
// status endpoint cannot be read.
//
// What is pinned here:
//   - missingMfaDiagnostic() classifies every surface state as
//     diagnostic-only and NEVER reports a finding (M48-1..M48-6).
//   - At the probe level the Juice-like case — 2FA enrolment
//     present, full-privilege session, no step-up anywhere in the
//     flow — is SILENT (M48-7): that is candidate oracle (a), and
//     it must not fire, because a non-enrolled account doing
//     sensitive actions without a step-up is correct behaviour.
//   - The DVWA-like case — no 2FA surface — is SILENT with zero
//     login POSTs (M48-8): candidate oracle (c) must not fire.
//   - Enrolled / enrolment-unreadable / gate-skip cases report the
//     right diagnostic and no #48 finding (M48-9..M48-15).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { probeMfaBypass, missingMfaDiagnostic, totpCode } from './mfaBypass.js';

const ORIGIN = 'http://lab.local';
const SECRET = 'JBSWY3DPEHPK3PXP'; // base32 of ASCII 'Hello!\xde\xad\xbe\xef'
const ROUTES = [
  'http://lab.local/rest/2fa/verify',
  'http://lab.local/rest/2fa/status',
  'http://lab.local/rest/2fa/setup',
  'http://lab.local/rest/2fa/disable',
  'http://lab.local/rest/user/login',
  'http://lab.local/rest/user/change-password',
  'http://lab.local/rest/user/whoami',
  'http://lab.local/api/Users',
];
const NO_SURFACE_ROUTES = [
  'http://lab.local/rest/user/login',
  'http://lab.local/rest/user/whoami',
  'http://lab.local/api/Users',
];

const BASE_OPTS = {
  labCreds: { username: 'canary@lab.local', password: 'canary-pass' },
  allowWrite: true,
  labTargets: 'lab.local',
  apiRoutes: ROUTES,
};

// ---- small stateful fake Juice ----------------------------------------------
// behaviour flags:
//   pending: login returns a token + tmpToken (2FA enabled on the account)
//   enrolledNotChallenged: status setup:true, login returns a full token
//   discloseSecret: status discloses the TOTP secret + setupToken
//   statusFails: GET /rest/2fa/status answers HTTP 500
//   directAccessVulnerable: /api/Users grants pre-MFA creds (tok-pre / tmp-*)
function makeFakeJuice(behavior = {}) {
  const state = {
    setup: Boolean(behavior.enrolledNotChallenged),
    secret: SECRET,
    setupToken: 'setup-tok-1',
    tmpCounter: 0,
    usedCodes: new Set(),
    calls: [],
    posts: 0,
  };
  const codeValid = (code, nowSec, windowSteps) => {
    for (let d = -windowSteps; d <= windowSteps; d += 1) {
      if (totpCode(state.secret, nowSec + d * 30) === code) return true;
    }
    return false;
  };
  const fetchFn = async (url, init = {}) => {
    const method = String(init.method || 'GET').toUpperCase();
    const u = new URL(String(url));
    let body = null;
    try {
      body = init.body ? JSON.parse(init.body) : null;
    } catch {
      body = null;
    }
    state.calls.push(`${method} ${u.pathname}`);
    if (method === 'POST') state.posts += 1;
    const auth = init.headers && init.headers.Authorization
      ? String(init.headers.Authorization).replace(/^Bearer /, '')
      : null;
    const json = (status, obj) => ({ status, text: async () => JSON.stringify(obj) });
    const nowSec = Math.floor(Date.now() / 1000);
    if (method === 'POST' && u.pathname === '/rest/user/login') {
      if (behavior.enrolledNotChallenged) {
        // Enrolled, yet login issues a full token with no challenge.
        return json(200, { status: 'success', authentication: { token: 'tok-full', umail: 'canary@lab.local' } });
      }
      if (state.setup || behavior.pending) {
        state.tmpCounter += 1;
        return json(200, {
          status: 'totp_token_required',
          data: { tmpToken: `tmp-${state.tmpCounter}` },
          authentication: { token: 'tok-pre', umail: 'canary@lab.local' },
        });
      }
      return json(200, { status: 'success', authentication: { token: 'tok-full', umail: 'canary@lab.local' } });
    }
    if (method === 'GET' && u.pathname === '/rest/2fa/status') {
      if (behavior.statusFails) return json(500, { status: 'error', message: 'boom' });
      return json(200, {
        setup: state.setup,
        ...(behavior.discloseSecret
          ? { secret: state.secret, setupToken: state.setupToken, email: 'canary@lab.local' }
          : {}),
      });
    }
    if (method === 'POST' && u.pathname === '/rest/2fa/setup') {
      if (body && body.setupToken === state.setupToken && codeValid(String(body.initialToken || ''), nowSec, 1)) {
        state.setup = true;
        return json(200, {});
      }
      return json(400, { status: 'error', message: 'Invalid code' });
    }
    if (method === 'POST' && u.pathname === '/rest/2fa/disable') {
      if (body && body.password === 'canary-pass') {
        state.setup = false;
        return json(200, { status: 'success' });
      }
      return json(401, { status: 'error', message: 'Invalid password' });
    }
    if (method === 'POST' && u.pathname === '/rest/2fa/verify') {
      const code = String((body && body.totpToken) || '');
      if (!body || !body.tmpToken || !String(body.tmpToken).startsWith('tmp-')) {
        return json(400, { status: 'error', message: 'tmpToken is invalid' });
      }
      if (!codeValid(code, nowSec, 1)) {
        return json(401, { status: 'error', message: 'Invalid code' });
      }
      if (state.usedCodes.has(code)) {
        return json(400, { status: 'error', message: 'code already used' });
      }
      state.usedCodes.add(code);
      return json(200, { status: 'success', authentication: { token: 'tok-full' } });
    }
    if (method === 'GET' && u.pathname === '/api/Users') {
      if (!auth) return json(401, { status: 'error', message: 'Unauthorized' });
      if (auth === 'tok-full') return json(200, { status: 'success', data: [{ id: 1, email: 'a@b.c', role: 'admin' }] });
      if (behavior.directAccessVulnerable && (auth === 'tok-pre' || String(auth).startsWith('tmp-'))) {
        return json(200, { status: 'success', data: [{ id: 1, email: 'a@b.c', role: 'admin' }] });
      }
      return json(401, { status: 'error', message: 'Unauthorized' });
    }
    if (method === 'GET' && u.pathname === '/rest/user/whoami') {
      return json(200, { user: {} });
    }
    if (method === 'POST' && u.pathname === '/rest/user/change-password') {
      if (auth === 'tok-full') return json(200, { status: 'success', message: 'Password changed' });
      return json(401, { status: 'error', message: 'Unauthorized' });
    }
    return json(404, { status: 'error', message: 'not found' });
  };
  return { state, fetchFn };
}

async function runProbe(behavior = {}, optsOverride = {}) {
  const { state, fetchFn } = makeFakeJuice(behavior);
  const diagnostics = {};
  const findings = await probeMfaBypass(ORIGIN + '/', {
    ...BASE_OPTS,
    ...optsOverride,
    fetchFn,
    diagnostics,
  });
  return { state, diagnostics, findings };
}

// ---- pure classifier ---------------------------------------------------------

describe('missingMfaDiagnostic (row #48, diagnostic-only)', () => {
  it('M48-1: no 2FA surface classifies as none, never a finding', () => {
    const d = missingMfaDiagnostic({ hasSurface: false, enrolled: null });
    assert.equal(d.surface, 'none');
    assert.equal(d.verdict, 'diagnostic-only');
    assert.equal(d.finding, false);
    assert.match(d.reason, /policy/i);
  });

  it('M48-2: surface present, account not enrolled classifies as available-not-enrolled, never a finding', () => {
    const d = missingMfaDiagnostic({ hasSurface: true, enrolled: false });
    assert.equal(d.surface, 'available-not-enrolled');
    assert.equal(d.verdict, 'diagnostic-only');
    assert.equal(d.finding, false);
    assert.match(d.reason, /not enrolled/i);
  });

  it('M48-3: surface present, account enrolled classifies as enrolled, never a finding (L0 owns it)', () => {
    const d = missingMfaDiagnostic({ hasSurface: true, enrolled: true });
    assert.equal(d.surface, 'enrolled');
    assert.equal(d.verdict, 'diagnostic-only');
    assert.equal(d.finding, false);
    assert.match(d.reason, /L0/);
  });

  it('M48-4: surface present, enrolment state null classifies as available-enrolment-unknown, never a finding', () => {
    const d = missingMfaDiagnostic({ hasSurface: true, enrolled: null });
    assert.equal(d.surface, 'available-enrolment-unknown');
    assert.equal(d.verdict, 'diagnostic-only');
    assert.equal(d.finding, false);
  });

  it('M48-5: surface present, enrolment state undefined classifies as available-enrolment-unknown', () => {
    const d = missingMfaDiagnostic({ hasSurface: true, enrolled: undefined });
    assert.equal(d.surface, 'available-enrolment-unknown');
    assert.equal(d.finding, false);
  });

  it('M48-6: no arguments at all defaults to none with a non-empty reason', () => {
    const d = missingMfaDiagnostic();
    assert.equal(d.surface, 'none');
    assert.equal(d.finding, false);
    assert.equal(typeof d.reason, 'string');
    assert.ok(d.reason.length > 40);
    // Every surface state gets its own reason text.
    const reasons = new Set([
      missingMfaDiagnostic({ hasSurface: false }).reason,
      missingMfaDiagnostic({ hasSurface: true, enrolled: false }).reason,
      missingMfaDiagnostic({ hasSurface: true, enrolled: true }).reason,
      missingMfaDiagnostic({ hasSurface: true, enrolled: null }).reason,
    ]);
    assert.equal(reasons.size, 4);
  });
});

// ---- probe-level: the lab controls ------------------------------------------

describe('probeMfaBypass row-#48 diagnostics', () => {
  it('M48-7: Juice-like — 2FA offered, canary NOT enrolled, full-privilege session with no step-up anywhere — is SILENT (candidate oracle (a) rejected)', async () => {
    const { state, diagnostics, findings } = await runProbe();
    assert.equal(findings.length, 0);
    assert.equal(diagnostics.mfa48Surface, 'available-not-enrolled');
    assert.equal(diagnostics.mfaRoutes, 4);
    // The probe really looked: a login POST and a status GET happened,
    // and the login carried no MFA challenge (no tmpToken issued).
    assert.ok(state.calls.includes('POST /rest/user/login'));
    assert.ok(state.calls.includes('GET /rest/2fa/status'));
    assert.ok(!state.calls.some((c) => c.startsWith('POST /rest/2fa/verify')));
  });

  it('M48-8: DVWA-like — no 2FA surface at all — is SILENT with zero login POSTs (candidate oracle (c) rejected)', async () => {
    const { state, fetchFn } = makeFakeJuice();
    const diagnostics = {};
    const findings = await probeMfaBypass(ORIGIN + '/', {
      ...BASE_OPTS,
      apiRoutes: NO_SURFACE_ROUTES,
      fetchFn,
      diagnostics,
    });
    assert.equal(findings.length, 0);
    assert.equal(diagnostics.mfa48Surface, 'none');
    assert.equal(diagnostics.mfaRoutes, undefined);
    assert.equal(state.posts, 0);
    assert.ok(!state.calls.includes('POST /rest/user/login'));
  });

  it('M48-9: enrolled account whose login challenges (pending) and whose shop is otherwise safe — 0 findings, surface enrolled', async () => {
    const { diagnostics, findings } = await runProbe({ pending: true });
    assert.equal(findings.length, 0);
    assert.equal(diagnostics.mfa48Surface, 'enrolled');
  });

  it('M48-10: non-lab host — gate skip, no findings and no #48 diagnostic (probe never ran)', async () => {
    const { diagnostics, findings } = await runProbe(
      {},
      { labTargets: 'other.local' }
    );
    assert.equal(findings.length, 0);
    assert.equal(diagnostics.mfa48Surface, undefined);
  });

  it('M48-11: quick depth — gate skip, no findings and no #48 diagnostic', async () => {
    const { diagnostics, findings } = await runProbe({}, { depth: 'quick' });
    assert.equal(findings.length, 0);
    assert.equal(diagnostics.mfa48Surface, undefined);
  });

  it('M48-12: no lab creds — gate skip, no findings and no #48 diagnostic', async () => {
    const { diagnostics, findings } = await runProbe({}, { labCreds: null });
    assert.equal(findings.length, 0);
    assert.equal(diagnostics.mfa48Surface, undefined);
  });

  it('M48-13: surface present but the status endpoint cannot be read (HTTP 500) — 0 findings, surface available-enrolment-unknown', async () => {
    const { diagnostics, findings } = await runProbe({ statusFails: true });
    assert.equal(findings.length, 0);
    assert.equal(diagnostics.mfa48Surface, 'available-enrolment-unknown');
  });

  it('M48-14: enrolled-but-never-challenged (L0 fires) still reports the #48 surface as enrolled — no double-counting of #48', async () => {
    const { diagnostics, findings } = await runProbe({
      enrolledNotChallenged: true,
      directAccessVulnerable: true,
    });
    assert.equal(findings.length, 1);
    assert.equal(findings[0].class, 'auth_mfa_bypass');
    assert.equal(diagnostics.mfa48Surface, 'enrolled');
    assert.ok(!findings.some((f) => String(f.class).includes('missing')));
  });

  it('M48-15: probe enrolls for real (disclosed secret, correct shop) and restores the lab — 0 findings, surface back to available-not-enrolled, restoreOk true', async () => {
    const { state, diagnostics, findings } = await runProbe({ discloseSecret: true });
    assert.equal(findings.length, 0);
    assert.equal(diagnostics.mfa48Surface, 'available-not-enrolled');
    assert.equal(diagnostics.enrolled, true);
    assert.equal(diagnostics.restoreOk, true);
    assert.equal(state.setup, false);
  });
});
