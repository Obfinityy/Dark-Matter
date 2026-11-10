// Dark Matter rule-based scanner — magic-link token flaws probe
// (coverage row #487 [High] Magic-link token flaws, CWE-307 / CWE-798 |
// phase 'oauth-magic-link').
//
// A magic link is a bearer credential delivered out of band: it must
// expire quickly and work exactly once. This probe tests the two
// failure modes the lab plants:
//   (a) REPLAY: the same token redeems twice, each time minting a
//       fresh session, and the issue response reports no expiry
//       (expiresIn: null) and singleUse: false.
//   (b) TOKEN-KIND CONFUSION: an OAuth `state` value issued by
//       /oauth/authorize redeems at /api/auth/magic-link/redeem — the
//       redeem endpoint looks the token up in a unified store shared
//       with OAuth states (CVE-2026-114607 shape), so a leaked state
//       becomes a login token.
//
// ORACLE (differential, each leg reproduced where it matters):
//   Replay — the FIRST redeem must succeed (proves the token is a
//   live magic link), the SECOND redeem of the same token must also
//   succeed with redeemedCount 2 (a correct implementation rejects
//   it), and a NONSENSE token must be rejected (proves the endpoint
//   distinguishes valid from invalid — the negative control).
//   State-as-magic-link — redeeming the OAuth state must succeed
//   with tokenKind "oauth-state", while the same nonsense token is
//   rejected.
// A finding fires only when the full matrix holds; a single 200 is
// never a verdict.
//
// GATES: lab-only. Every call here is state-changing (issues and
// redeems tokens, creates accounts), so a non-lab target returns
// nothing. Depth quick is skipped — flows, not a read-only check.
//
// HONEST LIMITS: the probe can only prove the flaw where the target
// returns issued magic links in-band (the lab convention — real
// deployments email them, so this row is lab-provable only). It does
// not test link delivery (email/SMS) or token entropy.

import {
  LAB_SEED_EMAIL,
  LAB_CLIENT_ID,
  uniqueEmail,
  originOf,
  jsonRequest,
  oauthFinding,
  tokenRef,
  labGated,
  getDiag,
} from './oauthShared.js';

const TIMEOUT_MS = 15000;

// ---- pure helpers (exported for unit tests) ---------------------------------

/**
 * Judge the replay matrix. 'confirmed' only when the first redeem
 * succeeded (live token), the second redeem of the SAME token also
 * succeeded with a higher redeemed count (replay), and the nonsense
 * control was rejected (the endpoint is not a blanket 200). Pure.
 */
export function assessMagicLinkReplay({ first, second, bogus }) {
  if (!first || first.status !== 200 || !first.json || !first.json.sessionToken) {
    return { verdict: 'unconfirmed', reason: 'first redeem did not return a session — token was not live' };
  }
  if (!second || second.status !== 200 || !second.json || !second.json.sessionToken) {
    return { verdict: 'rejected', reason: 'second redeem rejected — token is single-use as expected' };
  }
  if (bogus && bogus.status === 200 && bogus.json && bogus.json.sessionToken) {
    return { verdict: 'unconfirmed', reason: 'nonsense token also redeemed — endpoint cannot be trusted' };
  }
  const count = typeof second.json.redeemedCount === 'number' ? second.json.redeemedCount : null;
  if (count !== null && count < 2) {
    return { verdict: 'unconfirmed', reason: 'second redeem succeeded but redeemedCount did not advance' };
  }
  return { verdict: 'confirmed', reason: 'same magic-link token redeemed twice, each minting a session' };
}

/**
 * Judge the state-as-magic-link leg. 'confirmed' only when the
 * OAuth state redeemed as a magic link (tokenKind "oauth-state")
 * and the nonsense control was rejected. Pure.
 */
export function assessStateAsMagicLink({ stateRedeem, bogus }) {
  if (!stateRedeem || stateRedeem.status !== 200 || !stateRedeem.json || !stateRedeem.json.sessionToken) {
    return { verdict: 'rejected', reason: 'OAuth state did not redeem as a magic link' };
  }
  if (bogus && bogus.status === 200 && bogus.json && bogus.json.sessionToken) {
    return { verdict: 'unconfirmed', reason: 'nonsense token also redeemed — endpoint cannot be trusted' };
  }
  if (stateRedeem.json.tokenKind !== 'oauth-state') {
    return { verdict: 'unconfirmed', reason: 'state redeemed but tokenKind is not "oauth-state"' };
  }
  return { verdict: 'confirmed', reason: 'OAuth state value redeemed as a magic link (tokenKind oauth-state)' };
}

// ---- the probe ---------------------------------------------------------------

export async function probeOauthMagicLink(url, params, opts = {}) {
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
  const email = uniqueEmail('magic');

  // (a) Replay: issue a magic link, redeem it twice.
  const issued = await req(`${origin}/api/auth/magic-link`, { method: 'POST', body: { email } });
  if (!issued || issued.status !== 200 || !issued.json || !issued.json.token) {
    setDiag('attempts', attempts);
    return findings;
  }
  const token = issued.json.token;
  const first = await req(`${origin}/api/auth/magic-link/redeem?token=${encodeURIComponent(token)}`);
  const second = await req(`${origin}/api/auth/magic-link/redeem?token=${encodeURIComponent(token)}`);
  const bogus = await req(`${origin}/api/auth/magic-link/redeem?token=dm-bogus-${Date.now().toString(36)}`);
  setDiag('attempts', attempts);

  const replay = assessMagicLinkReplay({ first, second, bogus });
  setDiag('replayVerdict', replay.verdict);
  if (replay.verdict === 'confirmed') {
    const noExpiry = issued.json.expiresIn === null || issued.json.expiresIn === undefined;
    const notSingleUse = issued.json.singleUse === false;
    findings.push(
      oauthFinding({
        findingClass: 'oauth_magic_link_replay',
        id: `oauth-magic-replay-${email}`,
        title: 'Magic-link token is replayable and never expires — same token redeems twice',
        severity: 'high',
        url: `${origin}/api/auth/magic-link/redeem`,
        parameter: 'token',
        request: `POST /api/auth/magic-link {email} → token ${tokenRef(token)}; GET /api/auth/magic-link/redeem?token=… twice`,
        response: `First redeem → 200 session ${tokenRef(first.json.sessionToken)} (redeemedCount ${first.json.redeemedCount}); second redeem of the SAME token → 200 session ${tokenRef(second.json.sessionToken)} (redeemedCount ${second.json.redeemedCount}); nonsense token → ${bogus ? bogus.status : 'no response'}. Issue response: expiresIn=${issued.json.expiresIn ?? 'absent'}${noExpiry ? ' (no expiry)' : ''}, singleUse=${issued.json.singleUse}${notSingleUse ? ' (not single-use)' : ''}.`,
        impact: 'A leaked or intercepted magic link stays valid indefinitely and can be reused after the victim has already signed in — full account takeover with no expiry window.',
      })
    );
  }

  // (b) Token-kind confusion: an OAuth state redeems as a magic link.
  const authz = await req(
    `${origin}/oauth/authorize?response_type=code&client_id=${LAB_CLIENT_ID}&redirect_uri=${encodeURIComponent(`${origin}/oauth/callback`)}&idp=idp-acme&email=${encodeURIComponent(LAB_SEED_EMAIL)}`
  );
  setDiag('attempts', attempts);
  if (authz && authz.status === 200 && authz.json && authz.json.state) {
    const stateRedeem = await req(
      `${origin}/api/auth/magic-link/redeem?token=${encodeURIComponent(authz.json.state)}`
    );
    setDiag('attempts', attempts);
    const stateVerdict = assessStateAsMagicLink({ stateRedeem, bogus });
    setDiag('stateVerdict', stateVerdict.verdict);
    if (stateVerdict.verdict === 'confirmed') {
      findings.push(
        oauthFinding({
          findingClass: 'oauth_magic_link_state_confusion',
          id: `oauth-magic-state-${email}`,
          title: 'OAuth state value is redeemable as a magic link — token-kind confusion',
          severity: 'high',
          url: `${origin}/api/auth/magic-link/redeem`,
          parameter: 'token',
          request: `GET /oauth/authorize (idp-acme, ${LAB_SEED_EMAIL}) → state ${tokenRef(authz.json.state)}; GET /api/auth/magic-link/redeem?token=<that state>`,
          response: `State redeemed → 200 session ${tokenRef(stateRedeem.json.sessionToken)} for ${stateRedeem.json.email}, tokenKind="${stateRedeem.json.tokenKind}"; nonsense token → ${bogus ? bogus.status : 'no response'}. The redeem endpoint draws from a unified token store shared with OAuth states.`,
          impact: 'Any leaked OAuth state (Referer header, logs, browser history) becomes a login token for the victim account — the anti-CSRF value doubles as a bearer credential.',
        })
      );
    }
  }
  setDiag('attempts', attempts);
  return findings;
}

export const __oauthMagicLinkMeta = { phases: ['oauth-magic-link'], depth: ['standard', 'deep'] };
