// Dark Matter rule-based scanner — OAuth lab flows probe.
// (coverage rows #487-#493, #497, #502 [High/Medium] — the beyond-478
// scout's OAuth/OIDC/SSO classes, planted in labs/oauth-lab, phase 130,
// 'oauth-lab'.)
//
// The base OAuth probe (probes/oauth.js) tests authorization REQUESTS
// only — it never completes a flow, never exchanges a code, never
// redeems a token. These 9 rows are the opposite: each one is a
// completed-flow flaw (a magic link redeemed twice, a refresh token
// reused, a callback that overwrites the caller's session), so they
// need a probe that drives the lab's flows end to end with canary
// accounts it registers itself. LAB-GATED (isLabTargetHost) and
// FINGERPRINT-GATED (GET /health must answer service=oauth-lab):
// on any other target the probe returns [] after at most one
// request. Depth 'quick' skips the probe entirely.
//
// ORACLE (differential / state-change, no bare claims): every
// CONFIRMED verdict pairs a control against the flaw —
//  #487 replay: redeem #1 (control, token valid) vs redeem #2
//    (same token issues a second fresh session, redeemedCount 2);
//  #487 state: an OAuth `state` minted by /oauth/authorize redeems
//    at the magic-link endpoint with tokenKind "oauth-state";
//  #488: attacker password logs in AFTER the victim's magic-link
//    sign-in completed the account;
//  #489: idp-acme refuses an unverified identity (control, 403)
//    while idp-quick issues a code for one, and the issued id_token
//    itself carries email_verified:false;
//  #490: the victim's linked-identities list is empty before the
//    link call and holds the attacker's identity after it;
//  #491: /api/auth/me resolves the victim session to the victim
//    before the callback and to the attacker after it;
//  #492: codes from BOTH IdPs redeem, both responses admit
//    issuer_validated:false, the id_token iss is the quick IdP;
//  #493: the fetch-log holds no canary URL before registration
//    and holds the server's GET of our canary jwks_uri/logo_uri
//    after it (the registration response's fetched[] agrees);
//  #497: refresh #1 (control, token live) vs refresh #2 with the
//    SAME token (rotated:false, refreshReuseCount 2);
//  #502: a never-issued challenge and an evil origin are accepted
//    and return a session (all four *Checked flags false).
// All accounts, passwords and tokens are canary fixtures created by
// this probe (dmprobe-<rand>@example.com); no seeded account is
// used, no real credential exists, and token values are redacted
// in evidence. $0 AI, seconds-scale on the lab.

import { isLabTargetHost } from '../../labCreds.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

// Dynamic registration answers only after the lab's three sequential
// server-side fetches settle (jwks_uri, logo_uri,
// sector_identifier_uri), each capped at the lab's FETCH_TIMEOUT_MS
// (2s): worst case 3 x 2s = 6s plus round-trip overhead. The 5s
// default would abort the register call first, so #493 gets a 10s
// budget — ~4s of margin over the lab's worst case.
const REGISTER_TIMEOUT_MS = 10000;

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

// Lab tokens are counter-derived fake fixtures, but evidence never
// carries a full token — first 8 chars + marker, same convention
// as the base oauth probe's code redaction.
function redactToken(t) {
  const s = String(t || '');
  if (!s) return '<none>';
  return `${s.slice(0, 8)}…<redacted>`;
}

// JSON request helper. Returns { status, json } — status 0 and json
// null on network/timeout failure, so callers degrade to "no
// finding" instead of throwing the whole phase.
async function reqJson(method, url, body, { timeoutMs = 5000, headers = {} } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers: { 'User-Agent': UA, Accept: 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
      signal: ctrl.signal,
    });
    const text = await res.text().catch(() => '');
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = null; }
    return { status: res.status, json };
  } catch {
    return { status: 0, json: null };
  } finally {
    clearTimeout(timer);
  }
}

// Decode a JWT payload WITHOUT verifying (defensive read of our own
// canary token response — the lab mints alg=none fake JWTs).
export function decodeJwtPayload(jwt) {
  try {
    const parts = String(jwt || '').split('.');
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

function evidenceBase(request, response, impact) {
  return { request, response, impact_demo: impact, signalCorrelated: true };
}

export async function probeOauthLab(url, opts = {}) {
  const findings = [];
  const timeoutMs = opts.timeoutMs || 5000;
  const depth = opts.depth || 'standard';
  const canary = `dm${rand()}`;
  const clientId = 'lab-client';

  // GATE 1 — lab host only. Non-lab targets: zero requests.
  if (!isLabTargetHost(url, opts.labTargets)) return findings;
  // GATE 2 — quick depth skips the multi-write flow battery.
  if (depth === 'quick') return findings;

  let baseU;
  try { baseU = new URL(url); } catch { return findings; }
  const origin = `${baseU.protocol}//${baseU.host}`;
  const jget = (path, headers) => reqJson('GET', origin + path, undefined, { timeoutMs, headers });
  const jpost = (path, body, { headers, timeoutMs: callTimeoutMs } = {}) => reqJson('POST', origin + path, body, {
    timeoutMs: callTimeoutMs || timeoutMs,
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
  });
  const email = (tag) => `dmprobe-${tag}-${canary}@example.com`;
  const pass = (tag) => `dm-probe-pass-${tag}-${canary}`;

  // GATE 3 — fingerprint: the target must BE the OAuth lab
  // (GET /health answers service=oauth-lab). Any other lab host
  // (Juice, DVWA, coupon, LLM) returns [] after this one GET.
  const health = await jget('/health');
  if (health.status !== 200 || !health.json || health.json.service !== 'oauth-lab') return findings;

  const push = (finding) => findings.push(finding);

  // ---- #487 (a): magic-link replay — the same token issues a
  // fresh session on every redeem (never expires, not single-use).
  // Control: redeem #1 must succeed (proves the token is live);
  // the flaw is redeem #2 succeeding with redeemedCount 2.
  {
    const E = email('ml');
    const issued = await jpost('/api/auth/magic-link', { email: E });
    const token = issued.json && typeof issued.json.token === 'string' ? issued.json.token : null;
    if (issued.status === 200 && token) {
      const r1 = await jget(`/api/auth/magic-link/redeem?token=${encodeURIComponent(token)}`);
      const r2 = await jget(`/api/auth/magic-link/redeem?token=${encodeURIComponent(token)}`);
      const s1 = r1.json && typeof r1.json.sessionToken === 'string' ? r1.json.sessionToken : '';
      const s2 = r2.json && typeof r2.json.sessionToken === 'string' ? r2.json.sessionToken : '';
      if (r1.status === 200 && r2.status === 200 && r1.json.redeemedCount === 1
        && r2.json.redeemedCount === 2 && s1 && s2 && s1 !== s2) {
        push({
          class: 'oauth_magic_link_replay',
          id: `oauth-lab-magic-replay-${canary}`,
          title: 'Magic-link token is replayable — the same token issues a fresh session on every redeem',
          severity: 'high',
          url: `${origin}/api/auth/magic-link/redeem`,
          parameter: 'token',
          evidence: evidenceBase(
            `POST /api/auth/magic-link {email: ${E}} → 200 token=${redactToken(token)} (expiresIn: null, singleUse: false)`,
            `redeem #1 → 200 session=${redactToken(s1)} redeemedCount=1; redeem #2 (same token) → 200 session=${redactToken(s2)} redeemedCount=2 — a second fresh session for one token`,
            'A leaked or intercepted magic link never dies — anyone holding it can sign in as the victim at any time, repeatedly'
          ),
        });
      }
    }
  }

  // ---- #487 (b): OAuth state redeemable as a magic link — the
  // authorize endpoint stores `state` in the SAME unified token
  // store as magic links (CVE-2026-114607 shape). A state value
  // minted for a verified Acme identity redeems at the magic-link
  // endpoint with tokenKind "oauth-state".
  {
    const E = email('st');
    const reg = await jpost('/idp/idp-acme/register', { email: E, password: pass('st') });
    const vc = reg.json && typeof reg.json.verificationCode === 'string' ? reg.json.verificationCode : null;
    if (reg.status === 201 && vc) {
      const ver = await jpost('/idp/idp-acme/verify', { email: E, code: vc });
      if (ver.status === 200 && ver.json && ver.json.verified === true) {
        const auth = await jget(`/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(`${origin}/oauth/callback`)}&idp=idp-acme&email=${encodeURIComponent(E)}&state=st-${canary}`);
        const state = auth.json && typeof auth.json.state === 'string' ? auth.json.state : null;
        if (auth.status === 200 && state) {
          const red = await jget(`/api/auth/magic-link/redeem?token=${encodeURIComponent(state)}`);
          if (red.status === 200 && red.json && red.json.tokenKind === 'oauth-state'
            && typeof red.json.sessionToken === 'string' && red.json.sessionToken) {
            push({
              class: 'oauth_state_as_magic_link',
              id: `oauth-lab-state-magic-${canary}`,
              title: 'OAuth state value is redeemable as a magic link — unified token store (state-as-magic-link)',
              severity: 'high',
              url: `${origin}/api/auth/magic-link/redeem`,
              parameter: 'token',
              evidence: evidenceBase(
                `GET /oauth/authorize (idp-acme, verified ${E}) → 200 state=${redactToken(state)}`,
                `GET /api/auth/magic-link/redeem?token=<that state> → 200 session=${redactToken(red.json.sessionToken)} tokenKind="oauth-state" redeemedCount=${red.json.redeemedCount}`,
                'An OAuth state value — meant to be a CSRF token for one login — is itself a bearer credential: anyone who sees it in a URL or log can sign in as the user'
              ),
            });
          }
        }
      }
    }
  }

  // ---- #488: pre-account hijacking — open registration with no
  // verification, and the attacker's password survives the victim's
  // later magic-link sign-in (the account is "completed", never
  // re-secured).
  {
    const V = email('pre');
    const P = pass('pre');
    const reg = await jpost('/api/auth/register', { email: V, password: P });
    if (reg.status === 201) {
      const issued = await jpost('/api/auth/magic-link', { email: V });
      const token = issued.json && typeof issued.json.token === 'string' ? issued.json.token : null;
      if (issued.status === 200 && token) {
        const red = await jget(`/api/auth/magic-link/redeem?token=${encodeURIComponent(token)}`);
        if (red.status === 200 && typeof red.json.sessionToken === 'string') {
          const login = await jpost('/api/auth/login', { email: V, password: P });
          if (login.status === 200 && typeof login.json.sessionToken === 'string' && login.json.sessionToken) {
            push({
              class: 'oauth_preaccount_hijack',
              id: `oauth-lab-preaccount-${canary}`,
              title: 'Pre-account hijacking — attacker password survives the victim magic-link sign-in',
              severity: 'high',
              url: `${origin}/api/auth/register`,
              parameter: 'password',
              evidence: evidenceBase(
                `POST /api/auth/register {email: ${V}} → 201 verified=false (no verification step); magic-link redeem → 200 (victim signs in, account completed)`,
                `POST /api/auth/login {email: ${V}, password: <attacker password>} → 200 session=${redactToken(login.json.sessionToken)} — the attacker's credential still authenticates after the victim claimed the account`,
                'An attacker who registers the victim email first keeps access forever — the victim signing in does not invalidate the attacker password'
              ),
            });
          }
        }
      }
    }
  }

  // ---- #489: SSO account takeover via unverified email at the
  // IdP — idp-quick never verifies email, yet the RP accepts its
  // identities and the issued id_token itself carries
  // email_verified:false. Control: idp-acme refuses an unverified
  // identity (403) for the same flow.
  {
    const C1 = email('ctl'); // control identity at the verifying IdP
    const C2 = email('qck'); // test identity at the non-verifying IdP
    const rc1 = await jpost('/idp/idp-acme/register', { email: C1, password: pass('ctl') });
    const rc2 = await jpost('/idp/idp-quick/register', { email: C2, password: pass('qck') });
    const acmeCode = rc1.json && typeof rc1.json.verificationCode === 'string' ? rc1.json.verificationCode : null;
    if (rc1.status === 201 && acmeCode && rc2.status === 201
      && (rc2.json.verificationCode === null || rc2.json.verificationCode === undefined)) {
      // Control: unverified at acme must be refused.
      const ctl = await jget(`/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(`${origin}/oauth/callback`)}&idp=idp-acme&email=${encodeURIComponent(C1)}&state=ctl-${canary}`);
      // Test: unverified at quick must NOT be refused.
      const tst = await jget(`/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(`${origin}/oauth/callback`)}&idp=idp-quick&email=${encodeURIComponent(C2)}&state=qck-${canary}`);
      const code = tst.json && typeof tst.json.code === 'string' ? tst.json.code : null;
      if (ctl.status === 403 && tst.status === 200 && code) {
        const tok = await jpost('/oauth/token', { grant_type: 'authorization_code', code, client_id: clientId });
        const payload = tok.json && typeof tok.json.id_token === 'string'
          ? decodeJwtPayload(tok.json.id_token) : null;
        // A fresh code is needed for the callback leg (codes are
        // single-use): mint a second one for the same identity.
        const tst2 = await jget(`/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(`${origin}/oauth/callback`)}&idp=idp-quick&email=${encodeURIComponent(C2)}&state=qck2-${canary}`);
        const code2 = tst2.json && typeof tst2.json.code === 'string' ? tst2.json.code : null;
        const cb = code2
          ? await jget(`/oauth/callback?code=${encodeURIComponent(code2)}&state=qck2-${canary}`)
          : { status: 0, json: null };
        const sessionOk = cb.status === 200 && typeof cb.json.sessionToken === 'string'
          && cb.json.sessionToken && cb.json.email === C2;
        if (tok.status === 200 && payload && payload.email_verified === false && sessionOk) {
          push({
            class: 'oauth_unverified_email_idp',
            id: `oauth-lab-unverified-email-${canary}`,
            title: 'SSO account takeover via unverified email at the identity provider — id_token email_verified:false accepted',
            severity: 'high',
            url: `${origin}/oauth/authorize`,
            parameter: 'idp',
            evidence: evidenceBase(
              `control: idp-acme authorize (unverified ${C1}) → 403 "email not verified at this IdP"; test: idp-quick authorize (unverified ${C2}) → 200 code issued`,
              `POST /oauth/token → 200 id_token payload email_verified:false iss=${payload.iss || '<none>'}; GET /oauth/callback (code #2) → 200 session=${redactToken(cb.json.sessionToken)} email=${C2}`,
              'An attacker who creates an account at the non-verifying IdP with the victim email gets a full session as the victim — the RP never checks email_verified'
            ),
          });
        }
      }
    }
  }

  // ---- #490: forced profile linking — an attacker OAuth identity
  // is linked into a VICTIM session with no CSRF and no state
  // check, and the victim's linked-identities list proves the
  // state change (empty before, attacker identity after).
  {
    const V = email('vic');
    const A = email('atk');
    const regV = await jpost('/api/auth/register', { email: V, password: pass('vic') });
    const regA = await jpost('/idp/idp-quick/register', { email: A, password: pass('atk') });
    if (regV.status === 201 && regA.status === 201) {
      const login = await jpost('/api/auth/login', { email: V, password: pass('vic') });
      const sv = login.json && typeof login.json.sessionToken === 'string' ? login.json.sessionToken : null;
      const authA = await jget(`/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(`${origin}/oauth/callback`)}&idp=idp-quick&email=${encodeURIComponent(A)}&state=atk-${canary}`);
      const codeA = authA.json && typeof authA.json.code === 'string' ? authA.json.code : null;
      if (sv && authA.status === 200 && codeA) {
        const before = await jget('/api/users');
        const recBefore = before.json && Array.isArray(before.json.users)
          ? before.json.users.find((u) => u && u.email === V) : null;
        const linkedBefore = recBefore && Array.isArray(recBefore.linkedIdentities)
          ? recBefore.linkedIdentities.length : null;
        const link = await jpost('/oauth/link', { code: codeA }, { headers: { Authorization: `Bearer ${sv}` } });
        const after = await jget('/api/users');
        const recAfter = after.json && Array.isArray(after.json.users)
          ? after.json.users.find((u) => u && u.email === V) : null;
        const linkedAfter = recAfter && Array.isArray(recAfter.linkedIdentities)
          ? recAfter.linkedIdentities : [];
        const attackerLinked = linkedAfter.some(
          (l) => l && l.idp === 'idp-quick' && l.email === A
        );
        if (link.status === 200 && link.json && link.json.csrfChecked === false
          && link.json.stateChecked === false && linkedBefore === 0 && attackerLinked) {
          push({
            class: 'oauth_forced_linking',
            id: `oauth-lab-forced-link-${canary}`,
            title: 'Forced profile linking — attacker OAuth identity linked into a victim session without CSRF or state check',
            severity: 'high',
            url: `${origin}/oauth/link`,
            parameter: 'code',
            evidence: evidenceBase(
              `victim session ${redactToken(sv)} for ${V}; attacker code for ${A} (idp-quick) linked with no state parameter at all`,
              `POST /oauth/link → 200 csrfChecked:false stateChecked:false; GET /api/users: victim linkedIdentities ${linkedBefore} → ${JSON.stringify(linkedAfter)}`,
              'The attacker identity is now bound to the victim account — the attacker can sign in as the victim through that identity'
            ),
          });
        }
      }
    }
  }

  // ---- #491: authorization-code injection — the callback accepts
  // an attacker's code with a bogus state and OVERWRITES the
  // caller's session with the attacker's identity. Differential:
  // /api/auth/me resolves the victim session to the victim BEFORE
  // the callback and to the attacker AFTER it.
  {
    const V = email('v491');
    const A = email('a491');
    const regV = await jpost('/api/auth/register', { email: V, password: pass('v491') });
    const regA = await jpost('/idp/idp-quick/register', { email: A, password: pass('a491') });
    if (regV.status === 201 && regA.status === 201) {
      const login = await jpost('/api/auth/login', { email: V, password: pass('v491') });
      const sv = login.json && typeof login.json.sessionToken === 'string' ? login.json.sessionToken : null;
      const authA = await jget(`/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(`${origin}/oauth/callback`)}&idp=idp-quick&email=${encodeURIComponent(A)}&state=a491-${canary}`);
      const codeA = authA.json && typeof authA.json.code === 'string' ? authA.json.code : null;
      if (sv && authA.status === 200 && codeA) {
        const meBefore = await jget(`/api/auth/me?session=${encodeURIComponent(sv)}`);
        const cb = await jget(`/oauth/callback?code=${encodeURIComponent(codeA)}&state=bogus-state-${canary}&session=${encodeURIComponent(sv)}`);
        const meAfter = await jget(`/api/auth/me?session=${encodeURIComponent(sv)}`);
        if (meBefore.status === 200 && meBefore.json && meBefore.json.email === V
          && cb.status === 200 && cb.json && cb.json.stateValidated === false
          && cb.json.email === A
          && meAfter.status === 200 && meAfter.json && meAfter.json.email === A) {
          push({
            class: 'oauth_code_injection',
            id: `oauth-lab-code-injection-${canary}`,
            title: 'Authorization-code injection — callback accepts a bogus state and overwrites the caller session',
            severity: 'high',
            url: `${origin}/oauth/callback`,
            parameter: 'state',
            evidence: evidenceBase(
              `GET /api/auth/me?session=<victim session> → ${V} (before); GET /oauth/callback?code=<attacker code>&state=bogus-state-${canary}&session=<victim session>`,
              `callback → 200 stateValidated:false email=${A}; GET /api/auth/me?session=<same victim session> → ${A} (after) — the victim session now resolves to the attacker`,
              'A victim who can be tricked into following a crafted callback link hands their session to the attacker identity'
            ),
          });
        }
      }
    }
  }

  // ---- #492: IdP mix-up — the token endpoint redeems codes from
  // ANY IdP and never validates the issuer. Control: an idp-acme
  // code (verified identity) redeems too, so the endpoint cannot
  // tell the IdPs apart; the quick code's id_token iss is the
  // quick IdP and both responses admit issuer_validated:false.
  {
    const Q = email('mixq');
    const M = email('mixm');
    const regQ = await jpost('/idp/idp-quick/register', { email: Q, password: pass('mixq') });
    const regM = await jpost('/idp/idp-acme/register', { email: M, password: pass('mixm') });
    const vcM = regM.json && typeof regM.json.verificationCode === 'string' ? regM.json.verificationCode : null;
    if (regQ.status === 201 && regM.status === 201 && vcM) {
      const verM = await jpost('/idp/idp-acme/verify', { email: M, code: vcM });
      if (verM.status === 200 && verM.json && verM.json.verified === true) {
        const authQ = await jget(`/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(`${origin}/oauth/callback`)}&idp=idp-quick&email=${encodeURIComponent(Q)}&state=mixq-${canary}`);
        const authM = await jget(`/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(`${origin}/oauth/callback`)}&idp=idp-acme&email=${encodeURIComponent(M)}&state=mixm-${canary}`);
        const codeQ = authQ.json && typeof authQ.json.code === 'string' ? authQ.json.code : null;
        const codeM = authM.json && typeof authM.json.code === 'string' ? authM.json.code : null;
        if (authQ.status === 200 && codeQ && authM.status === 200 && codeM) {
          const tokQ = await jpost('/oauth/token', { grant_type: 'authorization_code', code: codeQ, client_id: clientId });
          const tokM = await jpost('/oauth/token', { grant_type: 'authorization_code', code: codeM, client_id: clientId });
          const payQ = tokQ.json && typeof tokQ.json.id_token === 'string'
            ? decodeJwtPayload(tokQ.json.id_token) : null;
          if (tokQ.status === 200 && tokM.status === 200
            && tokQ.json && tokQ.json.issuer_validated === false
            && tokM.json && tokM.json.issuer_validated === false
            && tokQ.json.issued_by_idp === 'idp-quick'
            && tokM.json.issued_by_idp === 'idp-acme'
            && payQ && typeof payQ.iss === 'string' && payQ.iss.includes('/idp/idp-quick')) {
            push({
              class: 'oauth_idp_mixup',
              id: `oauth-lab-idp-mixup-${canary}`,
              title: 'Authorization-server mix-up — token endpoint redeems any IdP code without issuer validation',
              severity: 'high',
              url: `${origin}/oauth/token`,
              parameter: 'code',
              evidence: evidenceBase(
                `POST /oauth/token {grant_type: authorization_code, code: <idp-quick code>} → 200 issued_by_idp=idp-quick issuer_validated:false id_token iss=${payQ.iss}`,
                `control: same call with an idp-acme code → 200 issued_by_idp=idp-acme issuer_validated:false — the endpoint redeems both IdPs interchangeably and validates neither issuer`,
                'A code minted by a rogue or attacker-controlled IdP is accepted as if it came from the trusted IdP — the RP cannot tell who issued the identity'
              ),
            });
          }
        }
      }
    }
  }

  // ---- #493: SSRF via dynamic client registration — the server
  // fetches attacker-supplied jwks_uri / logo_uri at registration
  // time. Differential: the fetch-log holds no canary URL before
  // registration and holds the server's GET of our canary URLs
  // after it. The SSRF target is another lab host on the same
  // bridge (the target host, port 3000 — the Juice lab on EC2) so
  // the attempt is observable in the lab's own fetch log; the
  // cloud metadata address 169.254.169.254 is NEVER used.
  {
    const ssrfHost = baseU.hostname;
    const jwksUrl = `http://${ssrfHost}:3000/.well-known/jwks.json?dm-ssrf-${canary}`;
    const logoUrl = `http://${ssrfHost}:3000/logo.png?dm-ssrf-${canary}`;
    const logBefore = await jget('/api/admin/fetch-log');
    const beforeCount = logBefore.json && Array.isArray(logBefore.json.fetches)
      ? logBefore.json.fetches.filter((f) => f && typeof f.url === 'string' && f.url.includes(canary)).length : null;
    const reg = await jpost('/oauth/register', {
      client_name: `dm-canary-${canary}`,
      redirect_uris: ['http://localhost/cb'],
      jwks_uri: jwksUrl,
      logo_uri: logoUrl,
      sector_identifier_uri: `http://${ssrfHost}:3000/sector.json?dm-ssrf-${canary}`,
    }, { timeoutMs: REGISTER_TIMEOUT_MS });
    const logAfter = await jget('/api/admin/fetch-log');
    const afterEntries = logAfter.json && Array.isArray(logAfter.json.fetches)
      ? logAfter.json.fetches.filter((f) => f && typeof f.url === 'string' && f.url.includes(canary)) : [];
    const fetched = reg.json && Array.isArray(reg.json.fetched) ? reg.json.fetched : [];
    const inResponse = fetched.filter((f) => f && typeof f.url === 'string' && f.url.includes(canary));
    const inLog = afterEntries.length;
    if (reg.status === 201 && beforeCount === 0 && inResponse.length > 0 && inLog > 0) {
      const describe = (f) => `${f.source || 'fetch'} GET ${f.url} → ${f.status === null || f.status === undefined ? 'error' : f.status}${f.error ? ` (${f.error})` : ''}`;
      push({
        class: 'oauth_ssrf_dynamic_registration',
        id: `oauth-lab-ssrf-reg-${canary}`,
        title: 'Server-side request forgery via OIDC dynamic client registration — server fetches attacker-supplied jwks_uri/logo_uri',
        severity: 'high',
        url: `${origin}/oauth/register`,
        parameter: 'jwks_uri',
        evidence: {
          ...evidenceBase(
            `POST /oauth/register {jwks_uri: ${jwksUrl}, logo_uri: ${logoUrl}} (fetch-log held 0 canary URLs before)`,
            `registration → 201 fetched=[${inResponse.map(describe).join('; ')}]; GET /api/admin/fetch-log after → ${inLog} canary entries (${afterEntries.map((f) => describe(f)).join('; ')})`,
            'The authorization server issues server-side GETs to URLs the registering client supplies — a registration is a free SSRF primitive into the internal network'
          ),
          // The fetch-log differential (0 canary URLs before, N after)
          // IS the out-of-band hit the SSRF confirmation protocol
          // judges on: the server's own GET of our canary URLs was
          // observed directly, so the probe asserts it in the field
          // the judge reads (evidence.oobHit).
          oobHit: true,
        },
      });
    }
  }

  // ---- #497: refresh-token reuse — the token endpoint re-issues
  // the SAME refresh token (rotated:false) and never revokes it:
  // refresh #1 (control) then refresh #2 with the same token both
  // succeed, refreshReuseCount stepping 1 → 2.
  {
    const E = email('rfr');
    const reg = await jpost('/idp/idp-quick/register', { email: E, password: pass('rfr') });
    if (reg.status === 201) {
      const auth = await jget(`/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(`${origin}/oauth/callback`)}&idp=idp-quick&email=${encodeURIComponent(E)}&state=rfr-${canary}`);
      const code = auth.json && typeof auth.json.code === 'string' ? auth.json.code : null;
      if (auth.status === 200 && code) {
        const tok = await jpost('/oauth/token', { grant_type: 'authorization_code', code, client_id: clientId });
        const R = tok.json && typeof tok.json.refresh_token === 'string' ? tok.json.refresh_token : null;
        if (tok.status === 200 && R) {
          const rf1 = await jpost('/oauth/token', { grant_type: 'refresh_token', refresh_token: R, client_id: clientId });
          const rf2 = await jpost('/oauth/token', { grant_type: 'refresh_token', refresh_token: R, client_id: clientId });
          if (rf1.status === 200 && rf2.status === 200
            && rf1.json && rf1.json.rotated === false && rf1.json.refreshReuseCount === 1
            && rf2.json && rf2.json.rotated === false && rf2.json.refreshReuseCount === 2
            && rf1.json.refresh_token === R && rf2.json.refresh_token === R) {
            push({
              class: 'oauth_refresh_token_reuse',
              id: `oauth-lab-refresh-reuse-${canary}`,
              title: 'Refresh token never rotates and is never revoked on reuse',
              severity: 'medium',
              url: `${origin}/oauth/token`,
              parameter: 'refresh_token',
              evidence: evidenceBase(
                `POST /oauth/token {grant_type: refresh_token, refresh_token: ${redactToken(R)}} → 200 (refresh #1)`,
                `refresh #1 → 200 rotated:false refreshReuseCount=1 refresh_token=<same>; refresh #2 (same token) → 200 rotated:false refreshReuseCount=2 refresh_token=<same>`,
                'A stolen refresh token stays valid forever — no rotation on use, no revocation on reuse, so the attacker and the victim both keep minting access tokens'
              ),
            });
          }
        }
      }
    }
  }

  // ---- #502: WebAuthn without validation — register/finish and
  // authenticate/finish accept a never-issued challenge, an evil
  // origin, and a fake signature, and still return a session.
  // The flaw is the acceptance itself: all four *Checked flags
  // false on a 200 that mints a session token.
  {
    const E = email('wbn');
    const credId = `cred-${canary}`;
    const begin = await jpost('/webauthn/register/begin', { email: E });
    if (begin.status === 200 && typeof begin.json.challenge === 'string' && begin.json.challenge) {
      const finish = await jpost('/webauthn/register/finish', {
        email: E,
        credentialId: credId,
        publicKey: 'lab-fake-key',
        challenge: `never-issued-challenge-${canary}`,
      });
      if (finish.status === 200 && finish.json && finish.json.ok === true
        && finish.json.challengeChecked === false) {
        const authBegin = await jpost('/webauthn/authenticate/begin', { email: E });
        if (authBegin.status === 200 && typeof authBegin.json.challenge === 'string') {
          const authFinish = await jpost('/webauthn/authenticate/finish', {
            email: E,
            credentialId: credId,
            challenge: `stale-challenge-${canary}`,
            origin: 'https://evil.example',
            signature: 'lab-fake-sig',
          });
          if (authFinish.status === 200 && authFinish.json
            && typeof authFinish.json.sessionToken === 'string' && authFinish.json.sessionToken
            && authFinish.json.originAccepted === 'https://evil.example'
            && authFinish.json.originChecked === false
            && authFinish.json.challengeChecked === false
            && authFinish.json.signatureChecked === false
            && authFinish.json.signCountChecked === false) {
            push({
              class: 'oauth_webauthn_no_validation',
              id: `oauth-lab-webauthn-${canary}`,
              title: 'WebAuthn finish accepts any challenge and any origin — no challenge, origin, signature or counter validation',
              severity: 'high',
              url: `${origin}/webauthn/authenticate/finish`,
              parameter: 'challenge',
              evidence: evidenceBase(
                `register/begin → real challenge issued; register/finish with challenge="never-issued-challenge-${canary}" → 200 ok=true challengeChecked:false; authenticate/finish with challenge="stale-challenge-${canary}" origin="https://evil.example" signature="lab-fake-sig"`,
                `authenticate/finish → 200 session=${redactToken(authFinish.json.sessionToken)} originAccepted="https://evil.example" originChecked:false challengeChecked:false signatureChecked:false signCountChecked:false`,
                'WebAuthn becomes passwordless theatre — anyone can register a fake credential with a made-up challenge and sign in from any origin'
              ),
            });
          }
        }
      }
    }
  }

  return findings;
}
