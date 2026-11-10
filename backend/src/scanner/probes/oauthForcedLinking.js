// Dark Matter rule-based scanner — OAuth forced profile linking probe
// (coverage row #490 [High] OAuth forced profile linking, CWE-352 |
// phase 'oauth-forced-linking').
//
// Account linking binds an OAuth identity to the signed-in account.
// When the link endpoint takes any valid authorization code with no
// CSRF token and no state check, an attacker can force their own
// social identity onto the victim's account: the attacker obtains a
// code for their own identity, then gets the victim's browser (or a
// stolen session) to call /oauth/link with it. The victim account
// then carries the attacker's identity — a foothold for takeover
// the moment the RP lets a linked identity sign in.
//
// ORACLE (differential, own identity vs foreign identity):
//   CONTROL — linking a code for the VICTIM's OWN identity succeeds
//   (proves the endpoint works and the code is valid; this is the
//   legitimate use).
//   PROBE — linking a code for the ATTACKER's identity into the
//   SAME victim session also succeeds, and GET /api/users then shows
//   the attacker's identity in the victim's linkedIdentities.
//   NONSENSE CONTROL — linking a bogus code fails (proves the
//   endpoint checks code validity — the 200s are not blanket).
// A finding fires only when the foreign link succeeds while the
// bogus code is rejected. The response itself reports
// csrfChecked:false / stateChecked:false, quoted as corroboration,
// never as the sole proof.
//
// GATES: lab-only. Registration, authorization codes and linking are
// all state-changing, so a non-lab target returns nothing. Depth
// quick is skipped.
//
// HONEST LIMITS: lab-provable only — the probe needs a live session
// for the victim and an attacker identity at the same IdP. It proves
// the missing CSRF/state check on the link endpoint; whether a
// linked foreign identity alone yields full takeover depends on the
// RP's login-via-linked-identity behaviour, which this probe does
// not exercise.

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
 * Judge the forced-linking matrix. 'confirmed' only when the
 * victim's own identity links (control: endpoint works), the
 * attacker's foreign identity ALSO links into the victim session,
 * the users list shows that foreign identity on the victim account,
 * and a bogus code is rejected. Pure.
 */
export function assessForcedLinking({ ownLink, attackLink, bogusLink, victimLinked, attackerEmail }) {
  const ok = (r) => r && r.status === 200 && r.json;
  if (!ok(ownLink)) {
    return { verdict: 'unconfirmed', reason: 'linking the victim own identity failed — endpoint not proven live' };
  }
  if (bogusLink && ok(bogusLink)) {
    return { verdict: 'unconfirmed', reason: 'bogus code also linked — endpoint cannot be trusted' };
  }
  if (!ok(attackLink)) {
    return { verdict: 'rejected', reason: 'foreign identity did not link — linking is guarded' };
  }
  const linked = Array.isArray(victimLinked) &&
    victimLinked.some((li) => li && li.email === attackerEmail);
  if (!linked) {
    return { verdict: 'unconfirmed', reason: 'link call succeeded but the users list shows no foreign identity on the victim' };
  }
  return { verdict: 'confirmed', reason: 'attacker identity linked into the victim session and visible on the victim account' };
}

// ---- the probe ---------------------------------------------------------------

export async function probeOauthForcedLinking(url, params, opts = {}) {
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
  const victimEmail = uniqueEmail('link-victim');
  const attackerEmail = uniqueEmail('link-attacker');

  // Victim account + session.
  const reg = await req(`${origin}/api/auth/register`, {
    method: 'POST',
    body: { email: victimEmail, password: VICTIM_PASSWORD },
  });
  if (!reg || reg.status !== 201) {
    setDiag('attempts', attempts);
    return findings;
  }
  const login = await req(`${origin}/api/auth/login`, {
    method: 'POST',
    body: { email: victimEmail, password: VICTIM_PASSWORD },
  });
  if (!login || login.status !== 200 || !login.json || !login.json.sessionToken) {
    setDiag('attempts', attempts);
    return findings;
  }
  const victimSession = login.json.sessionToken;
  const authz = (h) => ({ Authorization: `Bearer ${h}` });

  // Attacker identity at the IdP, and the victim's own IdP identity.
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
  const codeFor = async (email) => {
    const r = await req(
      `${origin}/oauth/authorize?response_type=code&client_id=lab-client&redirect_uri=${encodeURIComponent(`${origin}/oauth/callback`)}&idp=${ATTACK_IDP}&email=${encodeURIComponent(email)}`
    );
    return r && r.status === 200 && r.json && r.json.code ? r.json.code : null;
  };

  // CONTROL: link the victim's OWN identity — the legitimate use.
  const ownCode = await codeFor(victimEmail);
  let ownLink = null;
  if (ownCode) {
    ownLink = await req(`${origin}/oauth/link`, {
      method: 'POST',
      headers: authz(victimSession),
      body: { code: ownCode },
    });
  }
  // NONSENSE CONTROL: a bogus code must fail.
  const bogusLink = await req(`${origin}/oauth/link`, {
    method: 'POST',
    headers: authz(victimSession),
    body: { code: 'dm-bogus-code' },
  });
  // PROBE: link the ATTACKER's identity into the victim session.
  const attackCode = await codeFor(attackerEmail);
  let attackLink = null;
  if (attackCode) {
    attackLink = await req(`${origin}/oauth/link`, {
      method: 'POST',
      headers: authz(victimSession),
      body: { code: attackCode },
    });
  }
  setDiag('attempts', attempts);

  // Verify the link landed on the victim account.
  let victimLinked = null;
  const users = await req(`${origin}/api/users`);
  if (users && users.status === 200 && users.json && Array.isArray(users.json.users)) {
    const victim = users.json.users.find((u) => u.email === victimEmail);
    victimLinked = victim ? victim.linkedIdentities : null;
  }
  setDiag('attempts', attempts);

  const verdict = assessForcedLinking({ ownLink, attackLink, bogusLink, victimLinked, attackerEmail });
  setDiag('verdict', verdict.verdict);
  if (verdict.verdict !== 'confirmed') return findings;

  findings.push(
    oauthFinding({
      findingClass: 'oauth_forced_profile_linking',
      id: `oauth-forced-link-${victimEmail}`,
      title: 'OAuth forced profile linking — attacker identity linked into the victim account with no CSRF/state check',
      severity: 'high',
      url: `${origin}/oauth/link`,
      parameter: 'code',
      request: `POST /oauth/link {code:<attacker code for ${attackerEmail}>} with the victim session (Bearer) — no CSRF token, no state parameter`,
      response: `Own-identity link (control) → ${ownLink.status}; bogus code → ${bogusLink ? bogusLink.status : 'no response'} (rejected); attacker-identity link → ${attackLink.status} with csrfChecked:${attackLink.json.csrfChecked} stateChecked:${attackLink.json.stateChecked}; GET /api/users shows ${attackerEmail} in the victim ${victimEmail} linkedIdentities.`,
      impact: 'An attacker who can get a victim session to call the link endpoint (CSRF, or any session reuse) permanently attaches their own identity to the victim account — a standing foothold for takeover.',
    })
  );
  return findings;
}

export const __oauthForcedLinkingMeta = { phases: ['oauth-forced-linking'], depth: ['standard', 'deep'] };
