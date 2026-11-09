// Dark Matter rule-based scanner — session-timeout + remember-me token probe
// (coverage rows #259 [Medium] No Session Timeout / No Logout
// Invalidation, CWE-613, and #475 [High] Session — Remember-me token
// flaws (predictable / never expires), CWE-384 / OWASP A07:2021;
// phase 111, 'session-timeout'.)
//
// ORACLE (deterministic, no judge, no LLM, $0): the probe logs in with
// the lab credentials and takes the token the server itself issues,
// then judges the token's lifetime OFFLINE from its own claims:
//   #259 — CONFIRM only when the issued JWT carries NO exp claim (the
//   token never expires) or its lifetime (exp - iat, else exp - now)
//   exceeds 7 days — far beyond any defensible session timeout. A
//   token with a sane finite lifetime is a proven true negative.
//   #475 — the same login transaction is inspected for a remember-me
//   token: a JSON field whose key matches /remember/i with a string
//   value, or a Set-Cookie whose name matches /remember/i. CONFIRM
//   only when that token is PREDICTABLE (numeric-only, shorter than
//   8 chars, equal to / containing the login username, or a
//   base64url encoding of it) or PERMANENT (a JWT with no exp
//   claim). A remember-me token that is an opaque long value, or a
//   JWT with a finite expiry, is a proven true negative for this
//   row — finite expiry is the CORRECT behaviour for a remember-me
//   token, and server-side expiry of an opaque token is not
//   observable black-box, so it is never confirmed on a guess.
//
// SCOPE (deliberate): the "no logout invalidation" half of row #259
// is ALREADY LIVE via #474 (session-fixation T4b: the bearer token
// remains valid after logout — a Juice baseline title). This probe
// NEVER tests post-logout reuse; it judges the timeout half only.
// Likewise the probe never flags the Juice "remember me" CHECKBOX
// itself: first-hand (9 Nov 2026, live bundle read) it is purely
// client-side — checked, it stores the user's EMAIL in localStorage
// so the form pre-fills next visit; it sends no flag to the server
// and creates no server-side token. A client-side email prefill is
// not a remember-me TOKEN and is not a #475 finding.
//
// LIVE FACTS (verified first-hand 9 Nov 2026, two live Juice logins
// via EC2): the issued Juice JWT payload carries keys
// [data, iat, status] — NO exp claim at all — so #259 WILL FIRE on
// Juice (the session token never expires). The login response is
// {authentication: {bid, token, umail}} with NO Set-Cookie header
// and no remember-me field, so #475 is a true negative on Juice by
// actively-mined absence. DVWA's login page carries no remember-me
// field (live grep) and DVWA issues no JWT, so #475 is a true
// negative there too and #259 is uncalibrated on DVWA (no token to
// judge — the probe returns [] for that half, recorded as
// tokenFound false in the phase extras).
//
// GATES: labCreds + allowWrite + isLabTargetHost (same lab gate as
// jwt-claims / bfla / coupon-abuse); depth 'quick' skips the probe.
// BOUND: at most 4 POSTs (one login sequence) and zero further
// requests — the decode and the judgements are fully offline. Max 2
// findings (one per row). Findings are classes 'session_no_timeout'
// and 'remember_me_token' — the default confirmation protocol
// judges them on signalCorrelated (see differential.js; same
// pattern as business_logic / jwt_sensitive_claims).

import { isLabTargetHost } from '../../labCreds.js';
import { loginCandidates } from './sessionFixation.js';
import { decodeJwtPayload } from './jwtClaims.js';
import { extractBearerTokenFromJson } from '../labSession.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const TIMEOUT_MS = 15000;
const MAX_LOGIN_CANDIDATES = 3;
const MAX_LOGIN_POSTS = 4;
// A session token valid longer than this has effectively no
// timeout: OWASP idle timeouts run minutes-to-hours and absolute
// timeouts are measured in hours, not weeks. 7 days is deliberately
// generous — only a token that outlives any defensible session
// confirms.
const MAX_SESSION_LIFETIME_SECS = 7 * 24 * 3600;
// Below this length a token cannot be unguessable in any alphabet
// (and a numeric-only token is guessable at any length — see
// assessRememberMeToken). 8 is deliberately conservative: a
// 15-char random token is NOT flagged, because black-box the probe
// cannot tell random from sequential — only the clearly-weak
// shapes confirm.
const MIN_REMEMBER_TOKEN_LEN = 8;

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

function ev(request, response, impact) {
  return { request, response, impact_demo: impact, signalCorrelated: true };
}

// ---- pure helpers (exported for unit tests) ---------------------------------

/**
 * Judge the issued token's expiry. 'confirmed' only when the token
 * carries no exp claim (never expires) or its lifetime exceeds
 * MAX_SESSION_LIFETIME_SECS; 'rejected' when the lifetime is sane
 * (or the token is already expired at issuance — a dead token is
 * not a no-timeout flaw); 'unconfirmed' when there is no decodable
 * token or exp is present but not a numeric timestamp. Pure.
 */
export function assessTokenExpiry(decoded, nowSecs) {
  if (!decoded || typeof decoded !== 'object') {
    return {
      verdict: 'unconfirmed',
      kind: null,
      lifetimeSecs: null,
      reason: 'no decodable JWT payload — no token to inspect',
    };
  }
  const exp = decoded.exp;
  if (exp === undefined || exp === null) {
    return {
      verdict: 'confirmed',
      kind: 'no-expiry',
      lifetimeSecs: null,
      reason: 'the issued JWT carries no exp claim — the token never expires',
    };
  }
  if (typeof exp !== 'number' || !Number.isFinite(exp)) {
    return {
      verdict: 'unconfirmed',
      kind: null,
      lifetimeSecs: null,
      reason: 'the exp claim is present but not a numeric timestamp — lifetime cannot be judged',
    };
  }
  const iat =
    typeof decoded.iat === 'number' && Number.isFinite(decoded.iat) ? decoded.iat : nowSecs;
  const lifetimeSecs = exp - iat;
  if (lifetimeSecs <= 0) {
    return {
      verdict: 'rejected',
      kind: null,
      lifetimeSecs,
      reason: `the issued token is already expired at issuance (lifetime ${lifetimeSecs}s) — a dead token is not a no-timeout flaw`,
    };
  }
  if (lifetimeSecs > MAX_SESSION_LIFETIME_SECS) {
    return {
      verdict: 'confirmed',
      kind: 'absurd-lifetime',
      lifetimeSecs,
      reason: `the issued JWT lives ${lifetimeSecs}s (${(lifetimeSecs / 3600).toFixed(1)}h) — far beyond any defensible session timeout`,
    };
  }
  return {
    verdict: 'rejected',
    kind: null,
    lifetimeSecs,
    reason: `the issued JWT expires after ${lifetimeSecs}s (${(lifetimeSecs / 3600).toFixed(1)}h) — a finite, defensible session lifetime`,
  };
}

const REMEMBER_KEY_RE = /remember/i;
// A string value under a remember-me key that is only a flag word
// ('true', 'yes', '1', ...) is the checkbox state echoed back,
// not a token — never treat it as one.
const FLAG_WORDS = new Set(['true', 'false', 'yes', 'no', 'on', 'off', '1', '0']);
const TOKEN_FIELD_KEYS = new Set(['token', 'accesstoken', 'access_token', 'jwt', 'value']);

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function isTokenString(value) {
  return typeof value === 'string' && value.length > 0 && !FLAG_WORDS.has(value.toLowerCase());
}

/**
 * Find a remember-me token in a login transaction: a JSON field
 * whose key matches /remember/i with a non-empty STRING value (a
 * boolean `rememberMe: true` flag is not a token), a remember-keyed
 * object holding a token-ish inner field, or a Set-Cookie whose
 * name matches /remember/i with a non-empty value. Returns
 * { source: 'json' | 'cookie', field, value } or null. The session
 * token itself never matches: its field is 'token' / 'accessToken'
 * / 'jwt', none of which contains 'remember'. Pure.
 */
export function findRememberMeToken(loginJson, setCookieHeaders) {
  const walk = (node, depth) => {
    if (!isPlainObject(node) || depth > 3) return null;
    for (const [key, value] of Object.entries(node)) {
      if (REMEMBER_KEY_RE.test(key)) {
        if (isTokenString(value)) return { source: 'json', field: key, value };
        if (isPlainObject(value)) {
          for (const [innerKey, innerValue] of Object.entries(value)) {
            if (
              TOKEN_FIELD_KEYS.has(innerKey.toLowerCase()) &&
              isTokenString(innerValue)
            ) {
              return { source: 'json', field: `${key}.${innerKey}`, value: innerValue };
            }
          }
        }
      }
      if (isPlainObject(value)) {
        const found = walk(value, depth + 1);
        if (found) return found;
      }
    }
    return null;
  };
  const fromJson = walk(loginJson, 0);
  if (fromJson) return fromJson;
  for (const raw of setCookieHeaders || []) {
    const line = String(raw || '');
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const name = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).split(';')[0].trim();
    if (REMEMBER_KEY_RE.test(name) && isTokenString(value)) {
      return { source: 'cookie', field: name, value };
    }
  }
  return null;
}

// Base64url-decode to printable ASCII, or null when the value is
// not base64-shaped / not printable. Pure.
function tryB64Decode(value) {
  try {
    const s = String(value).replace(/-/g, '+').replace(/_/g, '/');
    const padded = s + '='.repeat((4 - (s.length % 4)) % 4);
    const out = Buffer.from(padded, 'base64').toString('utf8');
    if (!/^[\x20-\x7e]+$/.test(out)) return null;
    return out;
  } catch {
    return null;
  }
}

/**
 * Judge a found remember-me token. 'confirmed' only when the token
 * is PREDICTABLE (numeric-only, shorter than 8 chars, equal to /
 * containing the login username, or a base64url encoding of it) or
 * PERMANENT (a JWT with no exp claim); 'rejected' when it is the
 * session token itself (its expiry is judged under the
 * session-timeout row, never twice), a JWT with a finite expiry
 * (correct behaviour for a remember-me token), or an opaque value
 * with no observable flaw; 'unconfirmed' when there is no token to
 * judge. Pure.
 */
export function assessRememberMeToken(value, { sessionToken = null, username = '' } = {}) {
  if (typeof value !== 'string' || value.length === 0) {
    return { verdict: 'unconfirmed', kind: null, reason: 'no remember-me token to inspect' };
  }
  if (sessionToken && value === sessionToken) {
    return {
      verdict: 'rejected',
      kind: 'same-as-session',
      reason: 'the remember-me value is the session token itself — its expiry is judged under the session-timeout row, not here',
    };
  }
  if (/^\d+$/.test(value)) {
    return {
      verdict: 'confirmed',
      kind: 'predictable',
      reason: 'the remember-me token is numeric-only — sequential / guessable by construction',
    };
  }
  if (value.length < MIN_REMEMBER_TOKEN_LEN) {
    return {
      verdict: 'confirmed',
      kind: 'predictable',
      reason: `the remember-me token is ${value.length} characters — too short to be unguessable in any alphabet`,
    };
  }
  const user = String(username || '');
  if (user.length >= 3 && value.toLowerCase().includes(user.toLowerCase())) {
    return {
      verdict: 'confirmed',
      kind: 'predictable',
      reason: 'the remember-me token contains the login username — derivable from a known identifier',
    };
  }
  const decodedB64 = tryB64Decode(value);
  if (decodedB64 && user.length >= 3 && decodedB64.toLowerCase().includes(user.toLowerCase())) {
    return {
      verdict: 'confirmed',
      kind: 'predictable',
      reason: 'the remember-me token base64-decodes to a value containing the login username',
    };
  }
  const payload = decodeJwtPayload(value);
  if (payload) {
    if (payload.exp === undefined || payload.exp === null) {
      return {
        verdict: 'confirmed',
        kind: 'permanent',
        reason: 'the remember-me token is a JWT with no exp claim — it never expires',
      };
    }
    return {
      verdict: 'rejected',
      kind: null,
      reason: 'the remember-me token is a JWT with a finite expiry — it does expire',
    };
  }
  return {
    verdict: 'rejected',
    kind: null,
    reason: 'opaque remember-me token of adequate length with no predictable pattern; server-side expiry is not observable black-box',
  };
}

// ---- network (fetchFn seam, defaults to global fetch) -----------------------

async function req(fetchFn, url, { method = 'GET', body = null, timeoutMs = TIMEOUT_MS } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, {
      method,
      signal: ctrl.signal,
      headers: {
        'User-Agent': UA,
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
    return { status: res.status, text: text.slice(0, 200000), json, headers: res.headers || null };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// Node's fetch: getSetCookie() if available, else split the raw header
// (same shape as cookies.js parseSetCookies).
function readSetCookies(headers) {
  if (!headers) return [];
  try {
    if (typeof headers.getSetCookie === 'function') return headers.getSetCookie() || [];
    if (typeof headers.get === 'function') {
      const raw = headers.get('set-cookie') || '';
      return raw ? raw.split(/,(?=[^;]+=)/) : [];
    }
  } catch {
    return [];
  }
  return [];
}

// One API login attempt sequence against the login candidates:
// {email, password} first, then {username, password} on 401/400.
// Returns { ok, token, url, spent, json, setCookies } — spent counts
// the POSTs made. Unlike jwtClaims' apiLogin, the login RESPONSE is
// returned even when no session token is found: a remember-me token
// can be issued without a bearer token in the same body, and the
// #475 half must still be judged. A 401/400 is not a login at all
// (no token is issued on a failed login), so those responses carry
// no json/setCookies.
async function apiLogin(fetchFn, loginUrls, creds, budget) {
  let spent = 0;
  for (const loginUrl of loginUrls) {
    for (const body of [
      { email: creds.username, password: creds.password },
      { username: creds.username, password: creds.password },
    ]) {
      if (spent >= budget) {
        return { ok: false, token: null, url: null, spent, json: null, setCookies: [] };
      }
      const r = await req(fetchFn, loginUrl, { method: 'POST', body });
      spent += 1;
      if (!r) return { ok: false, token: null, url: null, spent, json: null, setCookies: [] };
      if (r.status === 401 || r.status === 400) continue;
      if (r.status < 200 || r.status >= 300) {
        return { ok: false, token: null, url: null, spent, json: null, setCookies: [] };
      }
      const setCookies = readSetCookies(r.headers);
      const token = r.json ? extractBearerTokenFromJson(r.json) : null;
      return { ok: Boolean(token), token, url: loginUrl, spent, json: r.json, setCookies };
    }
  }
  return { ok: false, token: null, url: null, spent, json: null, setCookies: [] };
}

// ---- the probe ---------------------------------------------------------------

export async function probeSessionTimeout(url, opts = {}) {
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
  const loginUrls = loginCandidates(routes, origin).slice(0, MAX_LOGIN_CANDIDATES);
  setDiag('loginRoutes', loginUrls.length);
  if (!loginUrls.length) return findings;

  // THE TEST — log in and take the token the server itself issues.
  const login = await apiLogin(fetchFn, loginUrls, creds, MAX_LOGIN_POSTS);
  setDiag('tokenFound', Boolean(login.token));

  // #475 half — judged on the login transaction itself (response
  // JSON + Set-Cookie), even when no session token came back: a
  // remember-me token can be issued without a bearer token in the
  // same body. When the transaction carries no remember-me token at
  // all, the surface is absent (rememberMeSurface false) — an
  // actively-mined true negative, not a skip.
  const rm =
    login.json || login.setCookies.length ? findRememberMeToken(login.json, login.setCookies) : null;
  setDiag('rememberMeSurface', Boolean(rm));
  if (rm) {
    const rmVerdict = assessRememberMeToken(rm.value, {
      sessionToken: login.token,
      username: creds.username,
    });
    setDiag('rememberMeKind', rmVerdict.kind);
    if (rmVerdict.verdict === 'confirmed') {
      const title =
        rmVerdict.kind === 'permanent'
          ? 'Remember-me token never expires (HIGH)'
          : 'Remember-me token is predictable (HIGH)';
      findings.push({
        class: 'remember_me_token',
        id: `remember-me-${rand()}`,
        title,
        severity: 'high',
        url: login.url,
        parameter: rm.field,
        evidence: ev(
          `POST ${login.url} with lab credentials -> inspect the login response for a remember-me token (JSON field / Set-Cookie)`,
          `The login transaction issues a remember-me token (${rm.source}: ${rm.field}) that ${rmVerdict.reason} (token value redacted).`,
          'Issue remember-me tokens as long opaque random values (128+ bits) with a server-side expiry, and rotate them on use.',
        ),
      });
    }
  }

  // #259 half — needs the issued token itself. Without one there is
  // nothing to decode, so the probe returns whatever the #475 half
  // found (uncalibrated for the timeout half, not a finding).
  if (!login.ok || !login.token) return findings;
  const decoded = decodeJwtPayload(login.token);
  setDiag('tokenJwt', Boolean(decoded));
  if (!decoded) return findings;
  const nowSecs = Math.floor(Date.now() / 1000);
  const expiry = assessTokenExpiry(decoded, nowSecs);
  setDiag('expPresent', decoded.exp !== undefined && decoded.exp !== null);
  setDiag('tokenLifetimeSecs', expiry.lifetimeSecs);
  if (expiry.verdict !== 'confirmed') return findings;
  const title =
    expiry.kind === 'no-expiry'
      ? 'Session token carries no expiry — it never times out (MEDIUM)'
      : 'Session token lifetime is absurdly long — effectively no timeout (MEDIUM)';
  findings.push({
    class: 'session_no_timeout',
    id: `session-timeout-${rand()}`,
    title,
    severity: 'medium',
    url: login.url,
    parameter: 'exp',
    evidence: ev(
      `POST ${login.url} with lab credentials -> decode the issued JWT (base64url, no key needed) and read its exp claim`,
      `The issued JWT ${expiry.reason} (token value redacted).`,
      'Give session tokens a short absolute expiry (hours, not days) plus an idle timeout, and invalidate them server-side on logout.',
    ),
  });
  return findings;
}

export const __sessionTimeoutMeta = { phases: ['session-timeout'], depth: ['standard', 'deep'] };
