// Dark Matter rule-based scanner — SSO takeover via unverified email
// at the IdP probe (coverage row #489 [High] SSO takeover via
// unverified email at IdP, CWE-287 | phase 'oauth-sso-unverified').
//
// An identity provider that never verifies email lets anyone
// register any address as an OAuth identity. If the relying party
// then trusts the IdP's email claim without checking
// email_verified, an attacker who registers the victim's address at
// that IdP logs in as the victim through SSO — no password, no
// verification, no victim involvement.
//
// ORACLE (differential, attack IdP vs control IdP):
//   ATTACK — register the victim email at idp-quick (never
//   verifies), run the authorization-code flow, and log in via the
//   callback; the issued id_token must carry email_verified: false
//   (decoded read-only, never verified) while the RP still mints a
//   session for the victim address.
//   CONTROL — the same flow at idp-acme (the verifying IdP) must
//   REFUSE an unverified identity at /oauth/authorize (403 email
//   not verified). If the control IdP also lets an unverified
//   identity through, the oracle cannot distinguish a planted flaw
//   from a lab that verifies nobody — no finding.
// A finding fires only when the attack succeeds AND the control
// refuses.
//
// GATES: lab-only. Registration at both IdPs and the full OAuth
// flow are state-changing, so a non-lab target returns nothing.
// Depth quick is skipped.
//
// HONEST LIMITS: lab-provable only — the probe needs an IdP that
// never verifies email, which only the lab provides (idp-quick).
// Against an arbitrary target it can only observe the RP's
// behaviour, not mint an unverified IdP identity.

import {
  uniqueEmail,
  originOf,
  jsonRequest,
  decodeJwtPayload,
  oauthFinding,
  tokenRef,
  labGated,
  getDiag,
} from './oauthShared.js';

const TIMEOUT_MS = 15000;
const ATTACK_IDP = 'idp-quick';
const CONTROL_IDP = 'idp-acme';

// ---- pure helpers (exported for unit tests) ---------------------------------

/**
 * Judge the unverified-IdP matrix. 'confirmed' only when the attack
 * flow logged in as the victim through the never-verifying IdP
 * while the id_token itself reports email_verified: false, AND the
 * control IdP refused the same unverified flow. Pure.
 */
export function assessSsoUnverified({ attackLogin, emailVerified, controlRefused }) {
  if (!attackLogin || attackLogin.status !== 200 || !attackLogin.json || !attackLogin.json.sessionToken) {
    return { verdict: 'rejected', reason: 'unverified-IdP flow did not log in — RP did not trust the claim' };
  }
  if (emailVerified !== false) {
    return { verdict: 'unconfirmed', reason: 'id_token did not report email_verified:false — claim cannot be judged' };
  }
  if (!controlRefused) {
    return { verdict: 'unconfirmed', reason: 'control IdP also allowed an unverified identity — oracle cannot distinguish' };
  }
  return { verdict: 'confirmed', reason: 'RP logged in as the victim on an email_verified:false claim from a never-verifying IdP' };
}

// ---- the probe ---------------------------------------------------------------

export async function probeOauthSsoUnverified(url, params, opts = {}) {
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
  const victimEmail = uniqueEmail('sso');

  // ATTACK: register the victim email at the never-verifying IdP.
  const idpReg = await req(`${origin}/idp/${ATTACK_IDP}/register`, {
    method: 'POST',
    body: { email: victimEmail, password: 'dm-attacker-pass-7f3a' },
  });
  if (!idpReg || idpReg.status !== 201) {
    setDiag('attempts', attempts);
    return findings;
  }

  // Two codes: one completes the login via the callback, the second
  // is redeemed at the token endpoint so the id_token claim can be
  // read (codes are single-use).
  const authzLogin = await req(
    `${origin}/oauth/authorize?response_type=code&client_id=lab-client&redirect_uri=${encodeURIComponent(`${origin}/oauth/callback`)}&idp=${ATTACK_IDP}&email=${encodeURIComponent(victimEmail)}`
  );
  if (!authzLogin || authzLogin.status !== 200 || !authzLogin.json || !authzLogin.json.code) {
    setDiag('attempts', attempts);
    return findings;
  }
  const attackLogin = await req(
    `${origin}/oauth/callback?code=${encodeURIComponent(authzLogin.json.code)}`
  );

  let emailVerified = null;
  let tokenIss = null;
  const authzToken = await req(
    `${origin}/oauth/authorize?response_type=code&client_id=lab-client&redirect_uri=${encodeURIComponent(`${origin}/oauth/callback`)}&idp=${ATTACK_IDP}&email=${encodeURIComponent(victimEmail)}`
  );
  if (authzToken && authzToken.status === 200 && authzToken.json && authzToken.json.code) {
    const tokenResp = await req(`${origin}/oauth/token`, {
      method: 'POST',
      body: { grant_type: 'authorization_code', code: authzToken.json.code, client_id: 'lab-client' },
    });
    if (tokenResp && tokenResp.status === 200 && tokenResp.json && tokenResp.json.id_token) {
      const payload = decodeJwtPayload(tokenResp.json.id_token);
      if (payload) {
        emailVerified = payload.email_verified;
        tokenIss = payload.iss;
      }
    }
  }
  setDiag('attempts', attempts);

  // CONTROL: the verifying IdP must refuse the same unverified flow.
  const controlEmail = uniqueEmail('sso-ctrl');
  let controlRefused = false;
  const ctrlReg = await req(`${origin}/idp/${CONTROL_IDP}/register`, {
    method: 'POST',
    body: { email: controlEmail, password: 'dm-attacker-pass-7f3a' },
  });
  if (ctrlReg && ctrlReg.status === 201) {
    const ctrlAuthz = await req(
      `${origin}/oauth/authorize?response_type=code&client_id=lab-client&redirect_uri=${encodeURIComponent(`${origin}/oauth/callback`)}&idp=${CONTROL_IDP}&email=${encodeURIComponent(controlEmail)}`
    );
    // The control refuses either at authorize (403 not verified) or
    // by never issuing a code.
    controlRefused = Boolean(ctrlAuthz && ctrlAuthz.status === 403) ||
      Boolean(ctrlAuthz && ctrlAuthz.status === 200 && !ctrlAuthz.json?.code);
  }
  setDiag('attempts', attempts);

  const verdict = assessSsoUnverified({ attackLogin, emailVerified, controlRefused });
  setDiag('verdict', verdict.verdict);
  setDiag('emailVerified', emailVerified);
  if (verdict.verdict !== 'confirmed') return findings;

  findings.push(
    oauthFinding({
      findingClass: 'oauth_sso_unverified_email',
      id: `oauth-sso-unverified-${victimEmail}`,
      title: 'SSO takeover via unverified email at the IdP — RP trusts an email_verified:false claim',
      severity: 'high',
      url: `${origin}/oauth/callback`,
      parameter: 'email',
      request: `POST /idp/${ATTACK_IDP}/register {email:${victimEmail}} → 201 (no verification step); GET /oauth/authorize?idp=${ATTACK_IDP}&email=${victimEmail} → code; GET /oauth/callback?code=… → session`,
      response: `Callback logged in as ${attackLogin.json.email} (200, session ${tokenRef(attackLogin.json.sessionToken)}) although the id_token for the same identity reports email_verified:false (iss ${tokenIss || 'n/a'}). Control: ${CONTROL_IDP} refused the identical unverified flow (403 email not verified) — the RP, not the IdP, is the gap.`,
      impact: 'Anyone can register any victim email at the never-verifying IdP and SSO straight into the victim account — no password, no verification, no victim action.',
    })
  );
  return findings;
}

export const __oauthSsoUnverifiedMeta = { phases: ['oauth-sso-unverified'], depth: ['standard', 'deep'] };
