// Dark Matter rule-based scanner — OAuth refresh-token reuse probe
// (coverage row #497 [Medium] OAuth refresh-token reuse / missing
// rotation, CWE-307 | phase 'oauth-refresh-reuse').
//
// A refresh token is a long-lived credential: best practice rotates
// it on every use and revokes the whole family when a used token
// reappears (reuse detection). When the token endpoint never
// rotates and never revokes, a stolen refresh token stays valid
// forever — the attacker and the victim can both keep minting
// access tokens indefinitely, and reuse is invisible.
//
// ORACLE (differential, first use vs second use vs bogus):
//   SETUP — obtain a refresh token through the authorization-code
//   grant (proves the token is live and bound to a real grant).
//   FIRST USE — POST the refresh grant: must succeed and report
//   rotated:false (or return the SAME token — the no-rotation
//   signal).
//   SECOND USE — POST the SAME refresh token again: must succeed
//   with an incrementing refreshReuseCount (proves the token was
//   neither rotated nor revoked on reuse).
//   CONTROL — a bogus refresh token must be rejected (proves the
//   endpoint checks token validity — the 200s are not blanket).
// A finding fires only when both uses succeed with the same token
// AND the bogus token is rejected.
//
// GATES: lab-only. Minting codes and redeeming refresh tokens is
// state-changing, so a non-lab target returns nothing. Depth quick
// is skipped.
//
// HONEST LIMITS: lab-provable only — the probe needs a live
// authorization-code grant to mint a refresh token. It proves the
// missing rotation/revocation on the token endpoint; it does not
// test reuse detection across distributed token stores (a
// single-node lab has one store).

import {
  originOf,
  jsonRequest,
  oauthFinding,
  tokenRef,
  labGated,
  getDiag,
} from './oauthShared.js';

const TIMEOUT_MS = 15000;
const LAB_IDP = 'idp-acme';

// ---- pure helpers (exported for unit tests) ---------------------------------

/**
 * Judge the refresh-reuse matrix. 'confirmed' only when the first
 * refresh use succeeded, the SECOND use of the SAME token also
 * succeeded (same token returned, reuse count advanced), and a
 * bogus token was rejected. Pure.
 */
export function assessRefreshReuse({ first, second, bogus, originalToken }) {
  const ok = (r) => r && r.status === 200 && r.json && r.json.access_token;
  if (!ok(first)) {
    return { verdict: 'unconfirmed', reason: 'first refresh-token use did not return an access token' };
  }
  if (bogus && ok(bogus)) {
    return { verdict: 'unconfirmed', reason: 'bogus refresh token also returned an access token — endpoint cannot be trusted' };
  }
  if (!ok(second)) {
    return { verdict: 'rejected', reason: 'second use of the same refresh token was rejected — token rotated or revoked on use' };
  }
  if (originalToken && second.json.refresh_token && second.json.refresh_token !== originalToken) {
    return { verdict: 'rejected', reason: 'second use returned a different refresh token — rotation is in place' };
  }
  const firstCount = typeof first.json.refreshReuseCount === 'number' ? first.json.refreshReuseCount : null;
  const secondCount = typeof second.json.refreshReuseCount === 'number' ? second.json.refreshReuseCount : null;
  if (firstCount !== null && secondCount !== null && secondCount <= firstCount) {
    return { verdict: 'unconfirmed', reason: 'reuse count did not advance between the two uses' };
  }
  return { verdict: 'confirmed', reason: 'same refresh token redeemed twice, never rotated, never revoked' };
}

// ---- the probe ---------------------------------------------------------------

export async function probeOauthRefreshReuse(url, params, opts = {}) {
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

  // SETUP: authorization-code grant → refresh token.
  const authz = await req(
    `${origin}/oauth/authorize?response_type=code&client_id=lab-client&redirect_uri=${encodeURIComponent(`${origin}/oauth/callback`)}&idp=${LAB_IDP}&email=lab-user%40example.com`
  );
  if (!authz || authz.status !== 200 || !authz.json || !authz.json.code) {
    setDiag('attempts', attempts);
    return findings;
  }
  const tokenResp = await req(`${origin}/oauth/token`, {
    method: 'POST',
    body: { grant_type: 'authorization_code', code: authz.json.code, client_id: 'lab-client' },
  });
  if (!tokenResp || tokenResp.status !== 200 || !tokenResp.json || !tokenResp.json.refresh_token) {
    setDiag('attempts', attempts);
    return findings;
  }
  const refreshToken = tokenResp.json.refresh_token;

  // FIRST and SECOND use of the same refresh token.
  const refreshGrant = (rt) => req(`${origin}/oauth/token`, {
    method: 'POST',
    body: { grant_type: 'refresh_token', refresh_token: rt },
  });
  const first = await refreshGrant(refreshToken);
  const second = await refreshGrant(refreshToken);
  // CONTROL: a bogus refresh token must fail.
  const bogus = await refreshGrant('dm-bogus-refresh-token');
  setDiag('attempts', attempts);

  const verdict = assessRefreshReuse({ first, second, bogus, originalToken: refreshToken });
  setDiag('verdict', verdict.verdict);
  setDiag('refreshReuseCount', second && second.json ? second.json.refreshReuseCount : null);
  if (verdict.verdict !== 'confirmed') return findings;

  findings.push(
    oauthFinding({
      findingClass: 'oauth_refresh_token_reuse',
      id: 'oauth-refresh-reuse',
      title: 'OAuth refresh token never rotates and is never revoked on reuse',
      severity: 'medium',
      url: `${origin}/oauth/token`,
      parameter: 'refresh_token',
      request: `POST /oauth/token grant_type=refresh_token refresh_token=${tokenRef(refreshToken)} — twice, same token`,
      response: `First use → 200, rotated=${first.json.rotated}, refreshReuseCount=${first.json.refreshReuseCount}; second use of the SAME token → 200, rotated=${second.json.rotated}, refreshReuseCount=${second.json.refreshReuseCount}, refresh_token unchanged; bogus token → ${bogus ? bogus.status : 'no response'} (rejected).`,
      impact: 'A stolen refresh token never expires by rotation and reuse is never detected — the attacker keeps minting access tokens indefinitely alongside the victim, with no revocation signal.',
    })
  );
  return findings;
}

export const __oauthRefreshReuseMeta = { phases: ['oauth-refresh-reuse'], depth: ['standard', 'deep'] };
