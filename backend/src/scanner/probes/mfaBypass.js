// Dark Matter rule-based scanner — MFA-bypass probe
// (coverage rows #46 [Critical] MFA Bypass and #327 [Critical] Auth
// — 2FA bypass via direct endpoint access, OWASP A07:2021; AUTH-08
// MFA Bypass Scenarios; also BIZ-12 OTP Reuse. Phase 149,
// 'mfa-bypass'.)
//
// ORACLE (deterministic, no judge, no LLM, $0): multi-factor auth
// is bypassable when the second-factor step can be skipped, replayed,
// or completed with a wrong code — each leg below is a bounded
// differential with a no-token control, never a guess:
//
//   L0  MFA enrolled but login never challenges: the 2FA status
//       endpoint says setup:true, yet the canary login returns a
//       full Bearer token with no tmpToken and no totp challenge.
//       Confirm by replaying a mined protected route with that
//       token while the same route refuses an anonymous request
//       (no-token control) — the token alone opens the account, so
//       MFA is decorative at login. Class auth_mfa_bypass.
//   L1  MFA step skippable via direct endpoint access (#327): the
//       login returns an MFA-pending signal (a tmpToken, or a
//       totp_token_required status). Replay a mined protected route
//       with (a) any Bearer token issued alongside the pending
//       signal and (b) the tmpToken itself as the Bearer token.
//       The no-token control must refuse the route (401/403, a
//       refusal message, or an empty anonymous body); confirm only
//       when a pre-MFA credential is granted a substantive,
//       authenticated body. Class auth_mfa_bypass.
//   L2  MFA not enforced on sensitive actions: with the same
//       pre-MFA session, replay a mined password/email-change
//       mutation using the canary's own credentials (new value ==
//       current value, so nothing really changes). Confirm only on
//       a 2xx success marker. Class auth_mfa_bypass.
//   L3  OTP reuse (BIZ-12): when the 2FA status endpoint discloses
//       the account's TOTP secret — as Juice Shop's does — compute
//       the current RFC 6238 code, verify it once (first use), then
//       immediately replay the SAME code with the SAME tmpToken.
//       Confirm only when the replay also succeeds: the server
//       never marks a consumed code used. Class auth_otp_reuse.
//   L5  Recovery/backup-code verify without rate limiting: the
//       2FA wrong-code oracle (reused from twoFaBruteForce.js) run
//       against a mined recovery-code route, at most 10 wrong codes,
//       stopping on the first throttle signal. Class
//       auth_mfa_bypass.
//   L6  MFA enrollment bypass: complete enrollment with a wrong
//       code (POST the setup endpoint with initialToken '000000').
//       Confirm only on a 2xx enrollment success. Class
//       auth_mfa_bypass.
//   L7  Overly broad TOTP validity window: verify with a code from
//       two steps out (T-2, then T+2) using a fresh login tmpToken
//       each time. Adjacent steps (T±1) are normal clock-skew
//       tolerance and are never a finding; only T±2 acceptance
//       confirms. Class auth_mfa_window.
//
// ENROLLMENT-MEDIATED LEGS (L3/L7, and the L1/L2 rerun after
// enrollment): when the account has 2FA switched OFF but the status
// endpoint discloses the secret, the probe enrolls the canary
// itself — POST setup with the password + a computed valid code —
// re-logs in (now MFA-pending), runs L1/L2/L3/L7, and then DISABLES
// 2FA again (POST disable with the password) in a finally block, so
// the shared lab canary is left exactly as it was found. The
// enrollment is the app's own flow with the app's own disclosed
// secret; the probe never invents a code. Diagnostics carry
// enrolled + restoreOk so a live proof can tell whether the lab was
// left clean. If the disable restore fails, restoreOk is false and
// the finding evidence says so — the operator re-disables by hand
// (POST /rest/2fa/disable with the canary password).
//
// WHAT THIS PROBE DOES NOT DO: it never guesses a valid code
// (codes are computed only from a secret the server itself
// disclosed, or are the fixed wrong values '000000'/'111111'...);
// it never tests predictable-OTP (#368) — a delivered code is not
// observable from the API, and that leg belongs to the crypto
// token-supply lane (PR #520); it never tests OTP brute-force
// (#326) — that leg already lives in twoFaBruteForce.js and is
// LIVE; it never invents routes (no mined 2FA route means an
// honest [] — DVWA has no 2FA surface at all and returns [] before
// any login POST).
//
// GATES: labCreds + allowWrite + isLabTargetHost (same lab gate as
// basket-logic / workflow-skip / session-fixation /
// twofa-bruteforce / credential-stuffing); depth 'quick' skips the
// probe. BOUND: at most MAX_POSTS write attempts in total (logins,
// setup, verify, sensitive, disable) and at most MAX_CANDIDATES
// protected routes x 2 GETs. Findings are class 'auth_mfa_bypass'
// (protocolFor routes any class containing 'bypass' to the
// auth_bypass protocol, judged on evidence.bypassWorks), class
// 'auth_otp_reuse' and class 'auth_mfa_window' (default protocol,
// judged on evidence.signalCorrelated).

import { createHmac } from 'node:crypto';
import { isLabTargetHost } from '../../labCreds.js';
import { loginCandidates } from './sessionFixation.js';
import { extractBearerTokenFromJson } from '../labSession.js';
import { assessVerifyResponse, findTmpToken } from './twoFaBruteForce.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const TIMEOUT_MS = 15000;
const MAX_LOGIN_CANDIDATES = 3;
const MAX_LOGIN_POSTS = 4;
const MAX_POSTS = 24;
const MAX_PROTECTED_ROUTES = 5;
const MAX_SENSITIVE_ROUTES = 2;
const MAX_RECOVERY_ATTEMPTS = 10;
const WRONG_CODE = '000000';
const RECOVERY_WRONG_CODES = [
  '000000',
  '111111',
  '222222',
  '333333',
  '444444',
  '555555',
  '666666',
  '777777',
  '888888',
  '999999',
];
const VERIFY_PATH_RE = /2fa/i;
const VERIFY_VERB_RE = /verif|valid|confirm|check/i;
const VERIFY_EXCLUDE_RE = /status|setup|resend|disable/i;
const STATUS_RE = /2fa/i;
const STATUS_VERB_RE = /status/i;
const SETUP_VERB_RE = /setup/i;
const DISABLE_VERB_RE = /disable/i;
const RECOVERY_RE = /(recovery|backup)[-_/]?(code|token|key)/i;
const SENSITIVE_RE = /(change[-_]?password|update[-_]?email|change[-_]?email|reset[-_]?password)/i;
const PROTECTED_HINT_RE = /(user|account|profile|\bme\b|admin|basket|order|address|payment|wallet)/i;
const PUBLIC_SKIP_RE = /(products|product|search|public|static|assets|images|challenge|feedback|contact|about|legal|privacy)/i;
const REFUSAL_TEXT_RE =
  /unauthori[sz]ed|forbidden|access denied|not allowed|not logged in|please log ?in|token (missing|invalid|expired|required)|authentication (required|failed)|session expired|must be logged in/i;
const SUCCESS_TEXT_RE = /success|updated|changed|saved|completed|enabled|disabled|ok\b/i;
const IDENTITY_RE = /"(id|email|username|userId|role)"\s*:\s*("[^"]+"|\d+)/i;

function ev(request, response, impact, bypass = false) {
  return {
    request,
    response,
    impact_demo: impact,
    signalCorrelated: true,
    ...(bypass ? { bypassWorks: true } : {}),
  };
}

function sameOrigin(u, origin) {
  try {
    return new URL(String(u)).origin === origin;
  } catch {
    return false;
  }
}

function pathOf(u) {
  try {
    return new URL(String(u)).pathname;
  } catch {
    return '';
  }
}

function stripQuery(u) {
  try {
    const x = new URL(String(u));
    x.search = '';
    return x.toString();
  } catch {
    return String(u);
  }
}

function bodyText(body) {
  if (body == null) return '';
  if (typeof body === 'string') return body;
  try {
    return JSON.stringify(body);
  } catch {
    return '';
  }
}

// ---- pure helpers (exported for unit tests) ---------------------------------

/** RFC 4648 base32 decode (no padding required). Pure. */
export function base32Decode(input) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = String(input || '').replace(/[^A-Z2-7]/gi, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of clean) {
    value = (value << 5) | alphabet.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/**
 * RFC 6238 TOTP: 6-digit code for a base32 secret at a Unix time.
 * Pure — the RFC 6238 test vector (secret ASCII '12345678901234567890',
 * T=59) yields '287082'. Exported so tests pin it exactly.
 */
export function totpCode(secret, unixSeconds, digits = 6, step = 30) {
  const counter = Math.floor(Number(unixSeconds || 0) / step);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', base32Decode(secret)).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 10 ** digits).padStart(digits, '0');
}

/**
 * Detect an MFA-pending login: a tmpToken anywhere in the body, or a
 * totp_token_required status. Pure.
 */
export function findMfaPending(body) {
  if (!body || typeof body !== 'object') return { pending: false, tmpToken: null };
  const tmpToken = findTmpToken(body);
  let statusPending = false;
  const walk = (node, depth = 0) => {
    if (!node || typeof node !== 'object' || depth > 3 || statusPending) return;
    if (typeof node.status === 'string' && /totp[_-]?token[_-]?required|2fa[_-]?required|mfa[_-]?required/i.test(node.status)) {
      statusPending = true;
      return;
    }
    for (const v of Object.values(node)) walk(v, depth + 1);
  };
  walk(body);
  return { pending: Boolean(tmpToken) || statusPending, tmpToken };
}

/**
 * Pull the TOTP enrollment facts out of a 2FA status response:
 * { setup, secret, setupToken } — any of them may be absent. Pure.
 */
export function findSetupSecret(body) {
  if (!body || typeof body !== 'object') return { setup: null, secret: null, setupToken: null };
  const out = { setup: null, secret: null, setupToken: null };
  if (typeof body.setup === 'boolean') out.setup = body.setup;
  if (typeof body.secret === 'string' && body.secret) out.secret = body.secret;
  if (typeof body.setupToken === 'string' && body.setupToken) out.setupToken = body.setupToken;
  // Some shops nest the status payload one level deep.
  for (const v of Object.values(body)) {
    if (v && typeof v === 'object') {
      const inner = findSetupSecret(v);
      if (out.setup === null && inner.setup !== null) out.setup = inner.setup;
      if (!out.secret && inner.secret) out.secret = inner.secret;
      if (!out.setupToken && inner.setupToken) out.setupToken = inner.setupToken;
    }
  }
  return out;
}

/**
 * Mine the MFA surface from apiRoutes: verify/status/setup/disable
 * 2FA routes, recovery-code routes, protected-route candidates
 * (auth-gated data routes, public list/static routes skipped) and
 * sensitive-mutation candidates. Pure.
 */
export function mfaRouteSet(routes, origin) {
  const out = {
    verify: null,
    status: null,
    setup: null,
    disable: null,
    recovery: null,
    protected: [],
    sensitive: [],
  };
  for (const r of routes || []) {
    try {
      const u = new URL(String(r));
      if (u.origin !== origin) continue;
      const p = u.pathname;
      const clean = stripQuery(u.toString());
      if (VERIFY_PATH_RE.test(p) && VERIFY_VERB_RE.test(p) && !VERIFY_EXCLUDE_RE.test(p)) {
        if (!out.verify) out.verify = clean;
        continue;
      }
      if (STATUS_RE.test(p) && STATUS_VERB_RE.test(p)) {
        if (!out.status) out.status = clean;
        continue;
      }
      if (VERIFY_PATH_RE.test(p) && SETUP_VERB_RE.test(p)) {
        if (!out.setup) out.setup = clean;
        continue;
      }
      if (VERIFY_PATH_RE.test(p) && DISABLE_VERB_RE.test(p)) {
        if (!out.disable) out.disable = clean;
        continue;
      }
      if (RECOVERY_RE.test(p)) {
        if (!out.recovery) out.recovery = clean;
        continue;
      }
      if (SENSITIVE_RE.test(p)) {
        if (out.sensitive.length < MAX_SENSITIVE_ROUTES) out.sensitive.push(clean);
        continue;
      }
      if (PROTECTED_HINT_RE.test(p) && !PUBLIC_SKIP_RE.test(p) && !/\/2fa\//i.test(p)) {
        if (out.protected.length < MAX_PROTECTED_ROUTES) out.protected.push(clean);
      }
    } catch {
      // ignore malformed route entries
    }
  }
  return out;
}

/**
 * Judge a protected-route replay. 'granted' only when the response
 * is a 2xx with no refusal text, a substantive or identity-bearing
 * body, and a body that differs from the anonymous control body —
 * the same endpoint answering the same empty body to a logged-out
 * caller (Juice /rest/user/whoami answers 200 {"user":{}}) proves
 * nothing. Pure.
 */
export function assessProtectedResponse(status, body, anonText) {
  const text = bodyText(body);
  if (typeof status === 'number' && (status === 401 || status === 403)) {
    return { kind: 'refused', reason: `protected route answered HTTP ${status}` };
  }
  if (REFUSAL_TEXT_RE.test(text)) {
    return { kind: 'refused', reason: 'protected response carries a refusal signal' };
  }
  if (typeof status === 'number' && status >= 200 && status < 300) {
    if (anonText != null && text === anonText) {
      return { kind: 'same-as-anonymous', reason: 'pre-MFA answer is byte-identical to the anonymous answer' };
    }
    if (text.length >= 50 || IDENTITY_RE.test(text)) {
      return { kind: 'granted', reason: 'protected route answered with a substantive authenticated body' };
    }
    return { kind: 'same-as-anonymous', reason: 'protected response is too small to prove an authenticated read' };
  }
  return { kind: 'other', reason: `protected route answered HTTP ${status}` };
}

/**
 * Judge one 2FA verify-endpoint response. Extends the twoFa
 * wrong-code oracle with the outcomes this probe needs: 'success'
 * (a full session token was issued), 'tmp-token-invalid' (the
 * pending token itself was consumed/expired — not a code failure),
 * plus the twoFa kinds. Pure.
 */
export function assessVerifyOutcome(status, body) {
  const text = bodyText(body);
  if (typeof status === 'number' && status === 429) {
    return { kind: 'throttle', reason: 'verify endpoint answered HTTP 429' };
  }
  if (/tmp.?token.*(invalid|expired|unknown|not found)|invalid.*tmp.?token/i.test(text)) {
    return { kind: 'tmp-token-invalid', reason: 'the pending tmpToken was rejected as invalid/expired' };
  }
  if (typeof status === 'number' && status >= 200 && status < 300) {
    const token =
      body && typeof body === 'object' ? extractBearerTokenFromJson(body) : null;
    const successShape =
      token != null || (body && typeof body === 'object' && body.status === 'success');
    if (successShape) return { kind: 'success', reason: 'verify endpoint issued a session token' };
    if (/invalid|incorrect|wrong|mismatch|does not match/i.test(text)) {
      return { kind: 'wrong-code', reason: 'verify response reports an invalid code' };
    }
    return { kind: 'other', reason: 'verify 2xx carries neither a token nor a code verdict' };
  }
  // Non-2xx: reuse the twoFa oracle (wrong-code / throttle /
  // uncalibrated / other) so the two legs never disagree.
  return assessVerifyResponse(status, body);
}

/**
 * Judge a sensitive-action (password/email change) response:
 * 'success' only on a 2xx carrying a success marker and no refusal
 * or validation-error text. Pure.
 */
export function assessSensitiveResponse(status, body) {
  const text = bodyText(body);
  if (REFUSAL_TEXT_RE.test(text)) {
    return { kind: 'refused', reason: 'sensitive action carries a refusal/auth signal' };
  }
  if (/invalid|incorrect|wrong|mismatch|does not match|required|must match|validation/i.test(text)) {
    return { kind: 'rejected', reason: 'sensitive action was rejected on its inputs' };
  }
  if (typeof status === 'number' && status >= 200 && status < 300 && SUCCESS_TEXT_RE.test(text)) {
    return { kind: 'success', reason: 'sensitive action answered with a success marker' };
  }
  if (typeof status === 'number' && status >= 200 && status < 300) {
    return { kind: 'other', reason: 'sensitive action 2xx carries no success marker' };
  }
  return { kind: 'other', reason: `sensitive action answered HTTP ${status}` };
}

/**
 * Judge a 2FA setup (enrollment) response: 'success' only on a 2xx
 * (Juice answers 200 with an empty body on success); 4xx is a
 * rejected enrollment, 404/422/5xx uncalibrated. Pure.
 */
export function assessSetupResponse(status) {
  if (typeof status === 'number' && status >= 200 && status < 300) {
    return { kind: 'success', reason: 'setup endpoint answered 2xx' };
  }
  if (typeof status === 'number' && (status === 404 || status === 422)) {
    return { kind: 'uncalibrated', reason: `setup endpoint answered HTTP ${status}` };
  }
  if (typeof status === 'number' && status >= 500) {
    return { kind: 'other', reason: `setup endpoint answered HTTP ${status}` };
  }
  return { kind: 'rejected', reason: `setup endpoint refused with HTTP ${status}` };
}

// ---- network (fetchFn seam, defaults to global fetch) -----------------------

async function req(fetchFn, url, { method = 'GET', token = null, body = null, timeoutMs = TIMEOUT_MS } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, {
      method,
      signal: ctrl.signal,
      headers: {
        'User-Agent': UA,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body != null ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body != null ? JSON.stringify(body) : undefined,
    });
    const text = await res.text().catch(() => '');
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      // not JSON — json stays null
    }
    return { status: res.status, text: text.slice(0, 200000), json };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// One API login attempt: {email,password} then {username,password}.
// Returns { ok, token, tmpToken, mfaPending, body, spent } — ok is
// true only when a Bearer token was found; tmpToken/mfaPending are
// reported even when ok is false, because a pending-MFA login may
// carry no full token at all (Juice's totp_token_required shape).
async function tryApiLogin(fetchFn, loginUrl, creds, budget) {
  let spent = 0;
  for (const body of [
    { email: creds.username, password: creds.password },
    { username: creds.username, password: creds.password },
  ]) {
    if (spent >= budget) return { ok: false, spent };
    const r = await req(fetchFn, loginUrl, { method: 'POST', body });
    spent += 1;
    if (!r) return { ok: false, spent };
    const token = r.json ? extractBearerTokenFromJson(r.json) : null;
    const { pending, tmpToken } = findMfaPending(r.json);
    // MFA-pending logins answer HTTP 401 (Juice: status
    // 'totp_token_required' + tmpToken, no Bearer token) — the
    // pending signal must be read BEFORE the 401/400 "wrong
    // credentials" skip, or no pending session is ever obtained
    // and every pending-session leg (L1/L2/L3/L7) is unreachable
    // on such a shop (14 Nov 2026 live-trace fix).
    if (pending) return { ok: Boolean(token), token, tmpToken, pending: true, body: r.json, spent };
    if (r.status === 401 || r.status === 400) continue;
    if (r.status < 200 || r.status >= 300) return { ok: false, spent };
    if (!token) return { ok: false, spent };
    return { ok: true, token, tmpToken, pending, body: r.json, spent };
  }
  return { ok: false, spent };
}

// ---- the probe ---------------------------------------------------------------

export async function probeMfaBypass(url, opts = {}) {
  const findings = [];
  const diag = opts && typeof opts.diagnostics === 'object' && opts.diagnostics ? opts.diagnostics : null;
  const setDiag = (k, v) => {
    if (diag) diag[k] = v;
  };
  const fetchFn = typeof opts.fetchFn === 'function' ? opts.fetchFn : globalThis.fetch;
  const creds = opts.labCreds;
  if (!creds || !creds.username || !creds.password) return findings;
  if (opts.allowWrite !== true) return findings;
  if (!isLabTargetHost(url, opts.labTargets)) return findings;
  if ((opts.depth || 'standard') === 'quick') return findings;
  let origin;
  try {
    origin = new URL(url).origin;
  } catch {
    return findings;
  }
  const routes = (opts.apiRoutes || []).map(String);
  const rs = mfaRouteSet(routes, origin);
  // No 2FA surface at all (DVWA): an honest [] before any login POST.
  if (!rs.verify && !rs.status && !rs.setup) return findings;
  setDiag(
    'mfaRoutes',
    [rs.verify, rs.status, rs.setup, rs.disable, rs.recovery].filter(Boolean).length
  );

  let posts = 0;
  const postOk = () => posts < MAX_POSTS;
  const notePost = (n = 1) => {
    posts += n;
    setDiag('attempts', posts);
  };
  let enrolled = false; // this probe enrolled 2FA on the canary
  let restoreOk = false;
  let latestToken = null; // freshest Bearer token seen, for the restore

  // Login (shared budget, same as basket-logic / workflow-skip /
  // twofa-bruteforce): exact /login candidates first.
  const loginUrls = loginCandidates(routes, origin).slice(0, MAX_LOGIN_CANDIDATES);
  if (!loginUrls.length) return findings;
  const doLogin = async () => {
    let token = null;
    let tmpToken = null;
    let mfaPending = false;
    let body = null;
    let postsLeft = Math.min(MAX_LOGIN_POSTS, MAX_POSTS - posts);
    for (const candidate of loginUrls) {
      if (postsLeft <= 0) break;
      const got = await tryApiLogin(fetchFn, candidate, creds, postsLeft);
      postsLeft -= got.spent;
      notePost(got.spent);
      if (got.token || got.pending) {
        token = got.token || null;
        if (token) latestToken = token;
        tmpToken = got.tmpToken || null;
        mfaPending = Boolean(got.pending) || Boolean(got.tmpToken);
        body = got.body || null;
        break;
      }
    }
    return { token, tmpToken, mfaPending, body };
  };

  const session = await doLogin();
  if (!session.token && !session.tmpToken && !session.mfaPending) return findings;

  // L1 — direct endpoint access with a pre-MFA credential. Control:
  // the same route with no token must refuse (or answer the same
  // empty body). Tries each pre-MFA credential in turn; the first
  // granted route confirms and ends the leg (max 1 finding).
  const runDirectAccess = async (credsToTry, legTag) => {
    for (const route of rs.protected) {
      const anon = await req(fetchFn, route, { method: 'GET' });
      if (!anon) continue;
      const anonJudged = assessProtectedResponse(anon.status, anon.json, null);
      const anonText = bodyText(anon.json);
      // A route that answers 200 anonymously with a substantive
      // body is public, not bypassable — skip it, never a finding.
      if (anonJudged.kind === 'granted') continue;
      for (const cred of credsToTry) {
        if (!cred) continue;
        const r = await req(fetchFn, route, { method: 'GET', token: cred });
        if (!r) continue;
        const judged = assessProtectedResponse(r.status, r.json, anonText);
        if (judged.kind === 'granted') {
          setDiag('controlOk', true);
          findings.push({
            class: 'auth_mfa_bypass',
            id: `mfa-direct-access-${Math.random().toString(36).slice(2, 10)}`,
            title: 'MFA step skippable: protected endpoint grants a pre-MFA session (CRITICAL)',
            severity: 'critical',
            url: route,
            evidence: ev(
              `GET ${route} with no token → refused (${anon.status}); the same route with a pre-MFA credential → granted (${r.status})`,
              `Anonymous request: ${anonText.slice(0, 300)}. Pre-MFA request: ${bodyText(r.json).slice(0, 300)}. ${judged.reason}. ${legTag}`,
              'The second factor is not a gate: an attacker who steals or guesses the first factor reaches authenticated data without ever completing MFA.',
              true
            ),
          });
          return true;
        }
      }
    }
    return false;
  };

  // L2 — sensitive action without MFA. The mutation replays the
  // canary's own credentials with new value == current value, so a
  // success proves the action is accepted pre-MFA without changing
  // anything. Max 1 finding.
  const runSensitiveAction = async (cred) => {
    if (!cred) return false;
    for (const route of rs.sensitive) {
      if (!postOk()) return false;
      const isPassword = /password/i.test(route);
      const body = isPassword
        ? { password: creds.password, newPassword: creds.password }
        : { email: creds.username, password: creds.password };
      const r = await req(fetchFn, route, { method: 'POST', token: cred, body });
      notePost();
      if (!r) continue;
      const judged = assessSensitiveResponse(r.status, r.json);
      if (judged.kind === 'success') {
        findings.push({
          class: 'auth_mfa_bypass',
          id: `mfa-sensitive-action-${Math.random().toString(36).slice(2, 10)}`,
          title: 'MFA not enforced on a sensitive action: password/email change accepted pre-MFA (CRITICAL)',
          severity: 'critical',
          url: route,
          evidence: ev(
            `POST ${route} with a pre-MFA credential (new value == current value) → ${r.status} success`,
            `${bodyText(r.json).slice(0, 300)}. ${judged.reason}.`,
            'A stolen first factor alone changes the account password or email — the second factor never gets a say on the actions that matter most.',
            true
          ),
        });
        return true;
      }
    }
    return false;
  };

  // L5 — recovery-code verify without rate limiting (the twoFa
  // wrong-code oracle on a mined recovery route). Max 1 finding.
  const runRecoveryOracle = async () => {
    if (!rs.recovery) return false;
    let wrongCodeCount = 0;
    for (let i = 0; i < MAX_RECOVERY_ATTEMPTS; i += 1) {
      if (!postOk()) return false;
      const body = { code: RECOVERY_WRONG_CODES[i], recoveryCode: RECOVERY_WRONG_CODES[i] };
      const r = await req(fetchFn, rs.recovery, {
        method: 'POST',
        token: session.token || session.tmpToken,
        body,
      });
      notePost();
      if (!r) return false;
      const judged = assessVerifyResponse(r.status, r.json);
      if (judged.kind === 'throttle') return false;
      if (judged.kind !== 'wrong-code') return false;
      wrongCodeCount += 1;
      if (wrongCodeCount === 1) setDiag('controlOk', true);
    }
    if (wrongCodeCount < MAX_RECOVERY_ATTEMPTS) return false;
    findings.push({
      class: 'auth_mfa_bypass',
      id: `mfa-recovery-noratelimit-${Math.random().toString(36).slice(2, 10)}`,
      title: 'Recovery-code verification accepts repeated wrong codes without rate limiting (HIGH)',
      severity: 'high',
      url: rs.recovery,
      parameter: 'recoveryCode',
      evidence: ev(
        `POST ${rs.recovery} with ${MAX_RECOVERY_ATTEMPTS} distinct wrong recovery codes`,
        `All ${MAX_RECOVERY_ATTEMPTS} wrong codes were answered as ordinary invalid-code responses with no throttle signal anywhere: no HTTP 429, no lockout message, no CAPTCHA, no sudden 403.`,
        'Recovery codes bypass the second factor by design — with no rate limit the small code space is enumerable, so MFA falls to unguided guessing.',
        true
      ),
    });
    return true;
  };

  // L3/L7 — enrolled-session legs. Needs: verify route, a fresh
  // login tmpToken, and the account TOTP secret (disclosed by the
  // status endpoint). Re-logs in for a fresh tmpToken per code so a
  // consumed token can never masquerade as a code failure.
  const runEnrolledSession = async (secret) => {
    if (!rs.verify || !secret) return;
    const nowSec = () => Math.floor(Date.now() / 1000);
    // First use: the current code must verify (calibration).
    const first = await doLogin();
    if (!first.tmpToken) return;
    if (!postOk()) return;
    const codeNow = totpCode(secret, nowSec());
    const v1 = await req(fetchFn, rs.verify, {
      method: 'POST',
      token: first.token,
      body: { tmpToken: first.tmpToken, totpToken: codeNow },
    });
    notePost();
    if (!v1) return;
    const j1 = assessVerifyOutcome(v1.status, v1.json);
    // The code that actually verified — the replay must replay THIS
    // code, not codeNow: after a clock-skew retry the verified code
    // is codePrev, and replaying the never-verified codeNow would
    // prove nothing (14 Nov 2026 fix).
    let verifiedCode = codeNow;
    if (j1.kind !== 'success') {
      // Clock skew: retry once with the previous window's code.
      if (j1.kind === 'wrong-code' && postOk()) {
        const codePrev = totpCode(secret, nowSec() - 30);
        const retry = await req(fetchFn, rs.verify, {
          method: 'POST',
          token: first.token,
          body: { tmpToken: first.tmpToken, totpToken: codePrev },
        });
        notePost();
        if (!retry || assessVerifyOutcome(retry.status, retry.json).kind !== 'success') return;
        verifiedCode = codePrev;
      } else {
        return;
      }
    }
    setDiag('controlOk', true);
    // L3 — replay the SAME code with the SAME tmpToken.
    if (postOk()) {
      const replay = await req(fetchFn, rs.verify, {
        method: 'POST',
        token: first.token,
        body: { tmpToken: first.tmpToken, totpToken: verifiedCode },
      });
      notePost();
      if (replay) {
        const jr = assessVerifyOutcome(replay.status, replay.json);
        if (jr.kind === 'success') {
          findings.push({
            class: 'auth_otp_reuse',
            id: `mfa-otp-reuse-${Math.random().toString(36).slice(2, 10)}`,
            title: 'OTP reuse: a consumed 2FA code verifies a second time (HIGH)',
            severity: 'high',
            url: rs.verify,
            parameter: 'totpToken',
            evidence: ev(
              `POST ${rs.verify} {tmpToken, totpToken:${verifiedCode}} → success (first use), then the SAME code + SAME tmpToken → success again`,
              `First use issued a session token; the immediate replay of the identical code also issued a session token. ${jr.reason}.`,
              'A one-time password that works twice is not one-time: an intercepted or shoulder-surfed code stays valid for a second login.'
            ),
          });
          return;
        }
      }
    }
    // L7 — codes two steps out. T±1 is normal clock-skew tolerance
    // and is never a finding; only T±2 acceptance confirms.
    for (const delta of [-60, 60]) {
      if (!postOk()) return;
      const fresh = await doLogin();
      if (!fresh.tmpToken) return;
      const codeFar = totpCode(secret, nowSec() + delta);
      const r = await req(fetchFn, rs.verify, {
        method: 'POST',
        token: fresh.token,
        body: { tmpToken: fresh.tmpToken, totpToken: codeFar },
      });
      notePost();
      if (!r) continue;
      const jr = assessVerifyOutcome(r.status, r.json);
      if (jr.kind === 'success') {
        findings.push({
          class: 'auth_mfa_window',
          id: `mfa-wide-window-${Math.random().toString(36).slice(2, 10)}`,
          title: 'Overly broad TOTP validity window: a code from two steps away verifies (MEDIUM)',
          severity: 'medium',
          url: rs.verify,
          parameter: 'totpToken',
          evidence: ev(
            `POST ${rs.verify} {tmpToken, totpToken:${codeFar}} (code for ${delta < 0 ? 'two steps ago' : 'two steps ahead'}) → success`,
            `The server accepted a code outside the normal ±1-step clock-skew tolerance. ${jr.reason}.`,
            'Each accepted code stays valid for minutes instead of seconds — a captured code has a far longer replay window than the 30-second design.'
          ),
        });
        return;
      }
    }
  };

  const getStatus = async (token) => {
    if (!rs.status || !token) return null;
    const r = await req(fetchFn, rs.status, { method: 'GET', token });
    if (!r) return null;
    return findSetupSecret(r.json);
  };

  try {
    const preMfaCreds = [session.token, session.tmpToken].filter(Boolean);
    if (session.mfaPending) {
      // Pending session straight from login: L1, L2, L5, then the
      // enrolled-session legs if the status endpoint discloses a
      // secret for this account.
      await runDirectAccess(preMfaCreds, 'login returned an MFA-pending signal (tmpToken / totp_token_required).');
      await runSensitiveAction(session.token || session.tmpToken);
      await runRecoveryOracle();
      const st = await getStatus(session.token || session.tmpToken);
      if (st && st.secret) await runEnrolledSession(st.secret);
      return findings;
    }

    // Not pending: is MFA enrolled but never challenged at login?
    const st = await getStatus(session.token);
    if (st && st.setup === true) {
      // L0 — enrolled, yet the login issued a full token with no
      // challenge. The direct-access replay is the confirmation:
      // the token alone opens a protected route.
      const fired = await runDirectAccess([session.token], '2FA is enrolled (status setup:true) yet login issued a full token with no MFA challenge.');
      if (!fired) {
        // The token did not open a protected route — no bypass to
        // report, but record the enrolled state for the proof.
        setDiag('mfaEnrolledNotChallenged', true);
      }
      await runRecoveryOracle();
      return findings;
    }

    // Not enrolled, secret disclosed: L6 (wrong-code enrollment),
    // then enroll for real, re-login, and run the pending-session
    // legs — with restore in the finally below.
    if (st && st.secret && st.setupToken && rs.setup && postOk()) {
      setDiag('mfaSecretDisclosed', true);
      const wrong = await req(fetchFn, rs.setup, {
        method: 'POST',
        token: session.token,
        body: { password: creds.password, setupToken: st.setupToken, initialToken: WRONG_CODE },
      });
      notePost();
      if (wrong) {
        const judged = assessSetupResponse(wrong.status);
        if (judged.kind === 'success') {
          enrolled = true;
          setDiag('enrolled', true);
          findings.push({
            class: 'auth_mfa_bypass',
            id: `mfa-enroll-wrong-code-${Math.random().toString(36).slice(2, 10)}`,
            title: 'MFA enrollment bypass: setup completes with a wrong code (CRITICAL)',
            severity: 'critical',
            url: rs.setup,
            evidence: ev(
              `POST ${rs.setup} {password, setupToken, initialToken:${WRONG_CODE}} → ${wrong.status}`,
              `Enrollment completed with a code that was never issued to the account. ${judged.reason}.`,
              'The enrollment check is decorative: an attacker enrolls MFA on their own terms — or, worse, the setup step never proves possession of the second factor at all.',
              true
            ),
          });
        } else if (judged.kind === 'rejected') {
          // Wrong code correctly refused: enroll for real with a
          // code computed from the disclosed secret.
          const codeNow = totpCode(st.secret, Math.floor(Date.now() / 1000));
          if (postOk()) {
            const enroll = await req(fetchFn, rs.setup, {
              method: 'POST',
              token: session.token,
              body: { password: creds.password, setupToken: st.setupToken, initialToken: codeNow },
            });
            notePost();
            if (enroll && assessSetupResponse(enroll.status).kind === 'success') {
              enrolled = true;
              setDiag('enrolled', true);
              const again = await doLogin();
              if (again.tmpToken || again.mfaPending) {
                const credsToTry = [again.token, again.tmpToken].filter(Boolean);
                await runDirectAccess(credsToTry, 'enrolled by this probe, then re-logged in (MFA-pending).');
                await runSensitiveAction(again.token || again.tmpToken);
                await runEnrolledSession(st.secret);
              }
            }
          }
        }
      }
      await runRecoveryOracle();
      return findings;
    }

    // 2FA surface exists but nothing above engaged (no pending
    // signal, no status facts, no disclosed secret): the recovery
    // oracle is the only leg left.
    await runRecoveryOracle();
    return findings;
  } finally {
    if (enrolled && rs.disable) {
      // Restore: disable 2FA again with the canary password, then
      // confirm the status endpoint reports setup:false.
      if (postOk()) {
        const off = await req(fetchFn, rs.disable, {
          method: 'POST',
          token: latestToken || session.token,
          body: { password: creds.password },
        });
        notePost();
        if (off) {
          const st2 = await getStatus(latestToken || session.token);
          restoreOk = Boolean(st2 && st2.setup === false);
        }
      }
      setDiag('restoreOk', restoreOk);
    }
  }
}

export const __mfaMeta = { phases: ['mfa-bypass'], depth: ['standard', 'deep'] };
