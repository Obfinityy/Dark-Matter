// Dark Matter rule-based scanner — OAuth authorization-server mix-up
// probe (coverage row #492 [High] OAuth authorization-server mix-up
// / IdP confusion, CWE-346 | phase 'oauth-mixup').
//
// In a multi-IdP deployment the RP must bind each flow to the IdP
// it started with and validate the id_token `iss` against that IdP.
// When it does neither, a code minted at a rogue or compromised IdP
// redeems cleanly at the token endpoint: the RP treats an identity
// from the wrong issuer as a valid login for the flow it started
// elsewhere.
//
// ORACLE (differential, expected issuer vs actual issuer):
//   SETUP — start a flow against idp-acme (the trusted IdP) and
//   read its expected issuer from OIDC discovery.
//   PROBE — redeem a code minted at idp-quick (a DIFFERENT IdP)
//   at /oauth/token. The endpoint must accept it AND report
//   issuer_validated:false, with the id_token `iss` naming
//   idp-quick — not the IdP the flow started with.
//   CONTROL — a bogus code must be rejected at the token endpoint
//   (proves the endpoint checks code validity — the 200 is not a
//   blanket accept).
// A finding fires only when the cross-IdP code redeems, the issuer
// differs from the expected one, validation is reported absent,
// and the bogus code is rejected.
//
// GATES: lab-only. Minting codes at two IdPs and redeeming them is
// state-changing, so a non-lab target returns nothing. Depth quick
// is skipped.
//
// HONEST LIMITS: lab-provable only — the probe needs two IdPs it can
// mint codes at, which only the lab provides. It proves the missing
// issuer check at the token endpoint; the callback leg of the same
// confusion is covered by the code-injection probe (#491).

import {
  uniqueEmail,
  originOf,
  jsonRequest,
  decodeJwtPayload,
  oauthFinding,
  labGated,
  getDiag,
} from './oauthShared.js';

const TIMEOUT_MS = 15000;
const START_IDP = 'idp-acme';
const OTHER_IDP = 'idp-quick';

// ---- pure helpers (exported for unit tests) ---------------------------------

/**
 * Judge the mix-up matrix. 'confirmed' only when the token
 * endpoint redeemed a code from a DIFFERENT IdP than the flow
 * started with, the id_token issuer names that other IdP (not the
 * expected one), issuer validation is reported absent, and a bogus
 * code is rejected. Pure.
 */
export function assessMixup({ tokenResp, expectedIssuer, bogus }) {
  if (!tokenResp || tokenResp.status !== 200 || !tokenResp.json || !tokenResp.json.access_token) {
    return { verdict: 'rejected', reason: 'cross-IdP code was not redeemed — token endpoint refused it' };
  }
  if (bogus && bogus.status === 200 && bogus.json && bogus.json.access_token) {
    return { verdict: 'unconfirmed', reason: 'bogus code also redeemed — token endpoint cannot be trusted' };
  }
  const issuedBy = tokenResp.json.issued_by_idp || null;
  const validated = tokenResp.json.issuer_validated;
  if (validated !== false) {
    return { verdict: 'unconfirmed', reason: 'issuer validation is not reported absent — cannot prove the check is missing' };
  }
  const payload = tokenResp.json.id_token ? decodeJwtPayload(tokenResp.json.id_token) : null;
  const iss = payload ? payload.iss : null;
  if (expectedIssuer && iss === expectedIssuer) {
    return { verdict: 'rejected', reason: 'id_token issuer matches the expected IdP — no confusion' };
  }
  if (!iss || !issuedBy) {
    return { verdict: 'unconfirmed', reason: 'redeemed token carries no usable issuer evidence' };
  }
  return { verdict: 'confirmed', reason: `code from ${issuedBy} redeemed in a flow started at the expected issuer ${expectedIssuer || 'n/a'}; id_token iss=${iss}, issuer_validated=false` };
}

// ---- the probe ---------------------------------------------------------------

export async function probeOauthMixup(url, params, opts = {}) {
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

  // SETUP: start a flow against the trusted IdP and read its issuer.
  const discovery = await req(`${origin}/.well-known/openid-configuration?idp=${START_IDP}`);
  const expectedIssuer = discovery && discovery.status === 200 && discovery.json
    ? discovery.json.issuer || null
    : null;
  const startAuthz = await req(
    `${origin}/oauth/authorize?response_type=code&client_id=lab-client&redirect_uri=${encodeURIComponent(`${origin}/oauth/callback`)}&idp=${START_IDP}&email=lab-user%40example.com`
  );
  if (!startAuthz || startAuthz.status !== 200 || !startAuthz.json || !startAuthz.json.code) {
    setDiag('attempts', attempts);
    return findings;
  }
  setDiag('expectedIssuer', expectedIssuer);

  // PROBE: mint a code at the OTHER IdP and redeem it.
  const attackerEmail = uniqueEmail('mixup');
  const otherReg = await req(`${origin}/idp/${OTHER_IDP}/register`, {
    method: 'POST',
    body: { email: attackerEmail, password: 'dm-attacker-pass-7f3a' },
  });
  if (!otherReg || otherReg.status !== 201) {
    setDiag('attempts', attempts);
    return findings;
  }
  const otherAuthz = await req(
    `${origin}/oauth/authorize?response_type=code&client_id=lab-client&redirect_uri=${encodeURIComponent(`${origin}/oauth/callback`)}&idp=${OTHER_IDP}&email=${encodeURIComponent(attackerEmail)}`
  );
  if (!otherAuthz || otherAuthz.status !== 200 || !otherAuthz.json || !otherAuthz.json.code) {
    setDiag('attempts', attempts);
    return findings;
  }
  const tokenResp = await req(`${origin}/oauth/token`, {
    method: 'POST',
    body: { grant_type: 'authorization_code', code: otherAuthz.json.code, client_id: 'lab-client' },
  });
  // CONTROL: a bogus code must be rejected.
  const bogus = await req(`${origin}/oauth/token`, {
    method: 'POST',
    body: { grant_type: 'authorization_code', code: 'dm-bogus-code', client_id: 'lab-client' },
  });
  setDiag('attempts', attempts);

  const verdict = assessMixup({ tokenResp, expectedIssuer, bogus });
  setDiag('verdict', verdict.verdict);
  if (verdict.verdict !== 'confirmed') return findings;

  const payload = tokenResp.json.id_token ? decodeJwtPayload(tokenResp.json.id_token) : null;
  findings.push(
    oauthFinding({
      findingClass: 'oauth_idp_mixup',
      id: `oauth-mixup-${attackerEmail}`,
      title: 'OAuth authorization-server mix-up — code from a different IdP redeems with no issuer validation',
      severity: 'high',
      url: `${origin}/oauth/token`,
      parameter: 'code',
      request: `Flow started against ${START_IDP} (expected issuer ${expectedIssuer || 'n/a'}); redeemed a code minted at ${OTHER_IDP} for ${attackerEmail} via POST /oauth/token grant_type=authorization_code`,
      response: `Token endpoint → 200: issued_by_idp=${tokenResp.json.issued_by_idp}, issuer_validated=${tokenResp.json.issuer_validated}, id_token iss=${payload ? payload.iss : 'n/a'}; bogus code → ${bogus ? bogus.status : 'no response'} (rejected). The RP never checked the issuer against the IdP the flow started with.`,
      impact: 'A code from a rogue or compromised IdP is accepted as a login for a flow started at the trusted IdP — an attacker IdP becomes a full login oracle for the RP.',
    })
  );
  return findings;
}

export const __oauthMixupMeta = { phases: ['oauth-mixup'], depth: ['standard', 'deep'] };
