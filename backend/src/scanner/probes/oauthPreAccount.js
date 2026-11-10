// Dark Matter rule-based scanner — pre-account hijacking probe
// (coverage row #488 [High] Pre-account hijacking, CWE-287 |
// phase 'oauth-pre-account').
//
// When registration is open and no email verification exists, an
// attacker can register the victim's email first with an attacker
// password. The account is live immediately; when the victim later
// signs in through a passwordless flow (magic link), the account is
// merely completed — and the attacker's password keeps working, so
// the attacker retains full access to the victim's account.
//
// ORACLE (differential, before vs after):
//   BASELINE — the attacker password logs in right after the
//   attacker registers the victim email (proves the pre-registered
//   account is live with that password).
//   PROBE — after the victim "signs in" via magic link, the SAME
//   attacker password logs in again (a correct implementation
//   invalidates the unverified password, or forces a reset, when
//   the real owner claims the account).
//   CONTROL — a wrong password is rejected both times (proves the
//   login endpoint actually checks passwords — the 200s are not a
//   blanket accept).
// A finding fires only when all three legs hold: password works
// before AND after, wrong password fails.
//
// GATES: lab-only. Registration, magic-link issue/redeem and logins
// are all state-changing, so a non-lab target returns nothing.
// Depth quick is skipped.
//
// HONEST LIMITS: lab-provable only — the probe creates accounts on
// the target, which is legitimate only against a lab host. It does
// not test whether a real deployment emails a verification link on
// registration (the lab has no email step at all by design).

import {
  uniqueEmail,
  originOf,
  jsonRequest,
  oauthFinding,
  labGated,
  getDiag,
} from './oauthShared.js';

const TIMEOUT_MS = 15000;
const ATTACKER_PASSWORD = 'dm-attacker-pass-7f3a';

// ---- pure helpers (exported for unit tests) ---------------------------------

/**
 * Judge the pre-account matrix. 'confirmed' only when the attacker
 * password logs in BEFORE the victim's magic-link sign-in AND still
 * logs in AFTER it, while a wrong password is rejected (the login
 * endpoint is not a blanket accept). Pure.
 */
export function assessPreAccountHijack({ loginBefore, loginAfter, wrongLogin }) {
  const ok = (r) => r && r.status === 200 && r.json && r.json.sessionToken;
  if (!ok(loginBefore)) {
    return { verdict: 'unconfirmed', reason: 'attacker password did not log in right after registration' };
  }
  if (wrongLogin && ok(wrongLogin)) {
    return { verdict: 'unconfirmed', reason: 'wrong password also logged in — login endpoint cannot be trusted' };
  }
  if (!ok(loginAfter)) {
    return { verdict: 'rejected', reason: 'attacker password stopped working after the victim signed in — account was claimed correctly' };
  }
  return { verdict: 'confirmed', reason: 'attacker password works before and after the victim magic-link sign-in' };
}

// ---- the probe ---------------------------------------------------------------

export async function probeOauthPreAccount(url, params, opts = {}) {
  const findings = [];
  const diag = getDiag(opts);
  const setDiag = (k, v) => {
    if (diag) diag[k] = v;
  };
  const fetchFn = typeof opts.fetchFn === 'function' ? opts.fetchFn : globalThis.fetch;
  const timeoutMs = opts.timeoutMs || TIMEOUT_MS;
  let attempts = 0;
  const req = async (u, init) => {
    attempts += 1;
    return jsonRequest(fetchFn, u, { ...init, timeoutMs });
  };

  setDiag('gated', labGated(url, opts));
  if (!labGated(url, opts)) {
    setDiag('attempts', 0);
    return findings;
  }
  if (opts.depth === 'quick') {
    setDiag('skippedQuick', true);
    setDiag('attempts', 0);
    return findings;
  }
  const origin = originOf(url);
  if (!origin) return findings;
  const victimEmail = uniqueEmail('preacct');

  // Attacker pre-registers the victim's email with an attacker password.
  const registered = await req(`${origin}/api/auth/register`, {
    method: 'POST',
    body: { email: victimEmail, password: ATTACKER_PASSWORD },
  });
  if (!registered || registered.status !== 201) {
    setDiag('attempts', attempts);
    return findings;
  }

  // BASELINE: attacker password logs in immediately.
  const loginBefore = await req(`${origin}/api/auth/login`, {
    method: 'POST',
    body: { email: victimEmail, password: ATTACKER_PASSWORD },
  });
  // CONTROL: a wrong password must fail.
  const wrongLogin = await req(`${origin}/api/auth/login`, {
    method: 'POST',
    body: { email: victimEmail, password: 'dm-definitely-wrong-pass' },
  });

  // Victim signs in via magic link (the account is "completed").
  const issued = await req(`${origin}/api/auth/magic-link`, { method: 'POST', body: { email: victimEmail } });
  let victimSignedIn = false;
  if (issued && issued.status === 200 && issued.json && issued.json.token) {
    const redeemed = await req(
      `${origin}/api/auth/magic-link/redeem?token=${encodeURIComponent(issued.json.token)}`
    );
    victimSignedIn = Boolean(redeemed && redeemed.status === 200 && redeemed.json && redeemed.json.sessionToken);
  }
  setDiag('attempts', attempts);
  if (!victimSignedIn) return findings;

  // PROBE: does the attacker password STILL work?
  const loginAfter = await req(`${origin}/api/auth/login`, {
    method: 'POST',
    body: { email: victimEmail, password: ATTACKER_PASSWORD },
  });
  setDiag('attempts', attempts);

  const verdict = assessPreAccountHijack({ loginBefore, loginAfter, wrongLogin });
  setDiag('verdict', verdict.verdict);
  if (verdict.verdict !== 'confirmed') return findings;

  findings.push(
    oauthFinding({
      findingClass: 'oauth_pre_account_hijacking',
      id: `oauth-pre-account-${victimEmail}`,
      title: 'Pre-account hijacking — attacker password survives the victim claiming the account',
      severity: 'high',
      url: `${origin}/api/auth/register`,
      parameter: 'email',
      request: `POST /api/auth/register {email:${victimEmail}, password:<attacker>} → 201; POST /api/auth/login (attacker password) before and after the victim signs in via magic link`,
      response: `Attacker password logged in BEFORE the victim magic-link sign-in (200, session issued) and STILL logs in AFTER it (200, session issued); wrong password rejected (${wrongLogin ? wrongLogin.status : 'no response'}). Registration required no email verification (verified: false).`,
      impact: 'An attacker who pre-registers a victim email keeps permanent password access to the victim account even after the victim starts using it — silent, persistent account takeover.',
    })
  );
  return findings;
}

export const __oauthPreAccountMeta = { phases: ['oauth-pre-account'], depth: ['standard', 'deep'] };
