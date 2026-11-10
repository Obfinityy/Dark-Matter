// Dark Matter rule-based scanner — OAuth authorization-code injection
// probe (coverage row #491 [High] OAuth authorization-code injection,
// CWE-352 | phase 'oauth-code-injection').
//
// The authorization-code callback must bind the code to the state
// the RP issued for THIS browser session. When the callback never
// validates state, an attacker-obtained code (for the attacker's
// identity) can be injected into the victim's callback: the victim's
// session is overwritten to the attacker's identity, so the victim
// then acts — and is billed, logged and trusted — as the attacker
// (login CSRF in its strongest form: full session takeover by
// identity swap).
//
// ORACLE (differential, injected code vs own code):
//   PROBE — the victim's live session V is handed to
//   /oauth/callback with an ATTACKER-obtained code and a BOGUS
//   state; afterwards GET /api/auth/me with V must resolve to the
//   ATTACKER (the session was overwritten to the code owner's
//   identity).
//   CONTROL — a second victim session V2 goes through the same
//   callback with the VICTIM's own code and the VALID state the
//   authorize step returned; afterwards /api/auth/me with V2 must
//   still resolve to the VICTIM (a correct flow does not change
//   identity when the code belongs to the caller).
// A finding fires only when the injected code swaps the identity
// AND the control flow leaves it unchanged. A single callback 200
// is never a verdict — the session resolution is the proof.
//
// GATES: lab-only. Registration, authorization codes and the
// callback are all state-changing, so a non-lab target returns
// nothing. Depth quick is skipped.
//
// HONEST LIMITS: lab-provable only — injecting a code requires an
// attacker-obtained code for a known identity, which only the lab
// IdP can mint on demand. The probe proves the missing state check
// at the callback; delivering the injected link to a real victim
// browser (the phishing/CSRF step) is out of scope.

import {
  uniqueEmail,
  originOf,
  jsonRequest,
  oauthFinding,
  labGated,
  getDiag,
} from './oauthShared.js';

const TIMEOUT_MS = 15000;
const ATTACK_IDP = 'idp-quick';
const VICTIM_PASSWORD = 'dm-victim-pass-7f3a';
const ATTACKER_PASSWORD = 'dm-attacker-pass-7f3a';

// ---- pure helpers (exported for unit tests) ---------------------------------

/**
 * Judge the code-injection matrix. 'confirmed' only when the
 * injected attacker code swapped the victim session to the
 * attacker identity AND the control flow (victim's own code, valid
 * state) left the second victim session on the victim identity.
 * Pure.
 */
export function assessCodeInjection({ attackMeEmail, controlMeEmail, victimEmail, attackerEmail }) {
  if (!controlMeEmail) {
    return { verdict: 'unconfirmed', reason: 'control flow did not resolve a session — cannot compare' };
  }
  if (controlMeEmail !== victimEmail) {
    return { verdict: 'unconfirmed', reason: 'control flow also changed identity — callback is not comparable' };
  }
  if (!attackMeEmail) {
    return { verdict: 'rejected', reason: 'injected code did not resolve the victim session to any identity' };
  }
  if (attackMeEmail === victimEmail) {
    return { verdict: 'rejected', reason: 'victim session still resolves to the victim after the injected code — no swap' };
  }
  if (attackMeEmail !== attackerEmail) {
    return { verdict: 'unconfirmed', reason: 'victim session resolved to an unexpected identity — not the code owner' };
  }
  return { verdict: 'confirmed', reason: 'attacker code with bogus state overwrote the victim session to the attacker identity' };
}

// ---- the probe ---------------------------------------------------------------

export async function probeOauthCodeInjection(url, params, opts = {}) {
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
  const victimEmail = uniqueEmail('inject-victim');
  const attackerEmail = uniqueEmail('inject-attacker');

  // Victim account + two live sessions (one per leg).
  const reg = await req(`${origin}/api/auth/register`, {
    method: 'POST',
    body: { email: victimEmail, password: VICTIM_PASSWORD },
  });
  if (!reg || reg.status !== 201) {
    setDiag('attempts', attempts);
    return findings;
  }
  const loginSession = async () => {
    const r = await req(`${origin}/api/auth/login`, {
      method: 'POST',
      body: { email: victimEmail, password: VICTIM_PASSWORD },
    });
    return r && r.status === 200 && r.json && r.json.sessionToken ? r.json.sessionToken : null;
  };
  const victimSession = await loginSession();
  const controlSession = await loginSession();
  if (!victimSession || !controlSession) {
    setDiag('attempts', attempts);
    return findings;
  }

  // Identities at the IdP for both legs.
  const attReg = await req(`${origin}/idp/${ATTACK_IDP}/register`, {
    method: 'POST',
    body: { email: attackerEmail, password: ATTACKER_PASSWORD },
  });
  const vicIdpReg = await req(`${origin}/idp/${ATTACK_IDP}/register`, {
    method: 'POST',
    body: { email: victimEmail, password: VICTIM_PASSWORD },
  });
  if (!attReg || attReg.status !== 201 || !vicIdpReg || vicIdpReg.status !== 201) {
    setDiag('attempts', attempts);
    return findings;
  }
  const authorize = async (email) => {
    const r = await req(
      `${origin}/oauth/authorize?response_type=code&client_id=lab-client&redirect_uri=${encodeURIComponent(`${origin}/oauth/callback`)}&idp=${ATTACK_IDP}&email=${encodeURIComponent(email)}`
    );
    return r && r.status === 200 && r.json && r.json.code ? r.json : null;
  };

  // PROBE: attacker code + bogus state into the victim session.
  const attackAuthz = await authorize(attackerEmail);
  let attackMeEmail = null;
  if (attackAuthz) {
    const cb = await req(
      `${origin}/oauth/callback?code=${encodeURIComponent(attackAuthz.code)}&state=bogus-state&session=${encodeURIComponent(victimSession)}`
    );
    if (cb && cb.status === 200) {
      const me = await req(`${origin}/api/auth/me?session=${encodeURIComponent(victimSession)}`);
      if (me && me.status === 200 && me.json) attackMeEmail = me.json.email;
    }
  }

  // CONTROL: victim's own code + the VALID state into a second victim session.
  const controlAuthz = await authorize(victimEmail);
  let controlMeEmail = null;
  if (controlAuthz) {
    const cb = await req(
      `${origin}/oauth/callback?code=${encodeURIComponent(controlAuthz.code)}&state=${encodeURIComponent(controlAuthz.state)}&session=${encodeURIComponent(controlSession)}`
    );
    if (cb && cb.status === 200) {
      const me = await req(`${origin}/api/auth/me?session=${encodeURIComponent(controlSession)}`);
      if (me && me.status === 200 && me.json) controlMeEmail = me.json.email;
    }
  }
  setDiag('attempts', attempts);

  const verdict = assessCodeInjection({ attackMeEmail, controlMeEmail, victimEmail, attackerEmail });
  setDiag('verdict', verdict.verdict);
  setDiag('attackMeEmail', attackMeEmail);
  setDiag('controlMeEmail', controlMeEmail);
  if (verdict.verdict !== 'confirmed') return findings;

  findings.push(
    oauthFinding({
      findingClass: 'oauth_code_injection',
      id: `oauth-code-injection-${victimEmail}`,
      title: 'OAuth authorization-code injection — attacker code with bogus state overwrites the victim session',
      severity: 'high',
      url: `${origin}/oauth/callback`,
      parameter: 'code',
      request: `GET /oauth/callback?code=<attacker code for ${attackerEmail}>&state=bogus-state&session=<victim session>; control: GET /oauth/callback?code=<victim own code>&state=<valid state>&session=<second victim session>`,
      response: `Injected leg: victim session now resolves via /api/auth/me to ${attackMeEmail} (was ${victimEmail}); control leg: second victim session still resolves to ${controlMeEmail}. State was never validated — a bogus value is accepted and the session is overwritten to the code owner.`,
      impact: 'An attacker who obtains any authorization code can force a victim browser into the attacker account (login CSRF with full identity swap) — the victim then acts, pays and is audited as the attacker.',
    })
  );
  return findings;
}

export const __oauthCodeInjectionMeta = { phases: ['oauth-code-injection'], depth: ['standard', 'deep'] };
