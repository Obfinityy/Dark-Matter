// Dark Matter rule-based scanner — API token authentication probe
// (coverage row #342 [High] API — Broken authentication (token in
// URL / weak tokens), CWE-287 | OWASP API02:2023; phase 103,
// 'api-token-auth').
//
// ORACLE (deterministic, no judge, no LLM, $0): an API token is
// broken authentication in two observable ways, and the probe
// tests each with its own control:
//
//   S1 — TOKEN IN URL: the app's own client code carries the auth
//   token in a URL query string, so the token leaks through server
//   logs, Referer headers, browser history, and shared links. The
//   probe mines API routes whose query string carries a token-like
//   parameter name (token / api_key / access_token / ...) from the
//   discovered routes, then runs a THREE-WAY differential on each
//   candidate route (at most 3):
//     (1) no-token GET — must be refused (401/403/404 or a refusal
//         message). A route that answers 200 anonymously is public,
//         not broken auth, and is skipped, never a finding.
//     (2) header-token GET (control) — the lab session token in
//         the Authorization header must be granted (2xx + a
//         non-empty JSON body with no refusal text). A route the
//         header token cannot reach is not a valid control and is
//         skipped.
//     (3) query-token GET — the SAME lab token as the query
//         parameter, no header. CONFIRM only when granted (2xx +
//         no refusal text + a body of at least 50 bytes and at
//         least half the control body's length — a filtered or
//         empty answer is the server enforcing something, not an
//         acceptance). The first confirmed route ends the probe
//         (max 1 finding).
//   S2 — WEAK TOKEN: the token the server issues is itself
//   guessable. The probe logs in TWICE with the same lab
//   credentials (two independent sessions) and judges the issued
//   tokens — OPAQUE tokens only:
//     - identical across both logins: the token does not rotate —
//       a stolen token stays valid across re-login (Medium);
//     - all digits and at most 8 characters: enumerable by
//       brute force (High);
//     - shorter than 8 characters of any charset: too short to
//       be unguessable (High);
//     - equal to the login username, or a trivial derivation of
//       it (base64 / hex / MD5): predictable from public data
//       (High).
//   JWTs are NOT judged here: jwt.js already owns JWT alg,
//   secret, and expiry attacks (rows #56–#60, #312–#315), so a
//   JWT-shaped token records tokenKind 'jwt' and S2 stays silent
//   on it — no double counting.
//
// NON-OVERLAP (by design): credentialDisclosure.js (#41) owns
// credential VALUES visible in target-emitted URLs (the value
// itself is the finding there); this probe owns the API's
// ACCEPTANCE of a URL-borne token, proven by replay — a route
// can fire both phases for two different defects, which is
// correct, not a duplicate. sessionFixation.js T4b owns reuse
// after LOGOUT; this probe never tests logout. Session
// identifiers (PHPSESSID / JSESSIONID / sid) are NOT token
// parameters here — rows #265/#321 own token-in-URL for sessions.
//
// GATES: labCreds + allowWrite + isLabTargetHost (same lab gate
// as basket-logic / workflow-skip / bfla / coupon-abuse); depth
// 'quick' skips the probe. BOUND: at most 8 POSTs (two logins x
// 4) and at most 9 GETs (3 token routes x 3 legs). Findings are
// class 'api_broken_auth' — the default confirmation protocol
// judges them on signalCorrelated (see differential.js;
// protocolFor routes no family branch for this class).
//
// SAFETY: the lab token value NEVER appears in evidence —
// request lines carry the literal placeholder '<lab session
// token>' and the weak-token evidence describes the property
// (identical / numeric / short / derived), never the value.

import { createHash } from 'node:crypto';
import { isLabTargetHost } from '../../labCreds.js';
import { loginCandidates } from './sessionFixation.js';
import { extractBearerTokenFromJson } from '../labSession.js';
import { decodeJwt } from './jwt.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const TIMEOUT_MS = 15000;
const MAX_TOKEN_ROUTES = 3;
const MAX_LOGIN_CANDIDATES = 3;
const MAX_LOGIN_POSTS = 4;
const MAX_TOTAL_POSTS = 8;
const MIN_TOKEN_BODY_BYTES = 50;
const MIN_TOKEN_LEN = 8;
const MAX_NUMERIC_TOKEN_LEN = 8;

// Query parameter names that carry an API authentication token.
// Session identifiers are deliberately absent — rows #265/#321
// own those — and bare `auth` is absent (too broad: auth=true /
// auth=1 are flags, not tokens).
const TOKEN_PARAM_NAMES = new Set([
  'token',
  'api_key',
  'apikey',
  'apiKey',
  'access_token',
  'accessToken',
  'access_key',
  'auth_token',
  'authToken',
]);

const REFUSAL_TEXT_RE =
  /unauthori[sz]ed|forbidden|access denied|not allowed|insufficient (privilege|permission|rights)|requires? (auth|login|elevated)|token (required|missing|invalid|expired)|invalid (token|api[-_ ]?key|credentials)|authentication (required|failed)/i;

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

function ev(request, response, impact) {
  return { request, response, impact_demo: impact, signalCorrelated: true };
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

function stripQuery(u) {
  try {
    const x = new URL(String(u));
    x.search = '';
    return x.toString();
  } catch {
    return String(u);
  }
}

// ---- route discovery (pure) -------------------------------------------------

/**
 * Mine API routes whose query string carries a token-like
 * parameter name. The parameter NAME is the signal — the mined
 * values are scanner filler, never real tokens — so a route
 * qualifies on the name alone. Returns [{ url, param }] with the
 * query stripped from url (the probe replays the path with the
 * real lab token), deduplicated by path + param, capped at
 * MAX_TOKEN_ROUTES. Pure.
 */
export function findTokenUrlRoutes(routes, origin) {
  const out = [];
  const seen = new Set();
  for (const r of routes || []) {
    let u;
    try {
      u = new URL(String(r));
    } catch {
      continue;
    }
    if (u.origin !== origin) continue;
    for (const name of u.searchParams.keys()) {
      if (!TOKEN_PARAM_NAMES.has(name)) continue;
      const path = stripQuery(u.toString());
      const key = `${path}|${name.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ url: path, param: name });
      if (out.length >= MAX_TOKEN_ROUTES) return out;
    }
  }
  return out;
}

// ---- response judging (pure) ------------------------------------------------

/**
 * Judge one API-route response. Returns { kind, reason } where
 * kind is 'granted' (2xx + a non-empty JSON body with no refusal
 * text), 'refused' (401/403/404, or a refusal message in the
 * body), or 'other' (anything else — 5xx, redirect, empty 2xx,
 * or a non-JSON 2xx such as the SPA HTML shell, which proves
 * nothing about the API route). Pure.
 */
export function assessTokenRouteResponse(status, body) {
  const text = bodyText(body);
  if (typeof status === 'number' && (status === 401 || status === 403 || status === 404)) {
    return { kind: 'refused', reason: `API route answered HTTP ${status}` };
  }
  if (REFUSAL_TEXT_RE.test(text)) {
    return { kind: 'refused', reason: 'API route response carries a refusal message' };
  }
  if (typeof status === 'number' && status >= 200 && status < 300) {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      return { kind: 'other', reason: 'API route answered 2xx with an empty body' };
    }
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      return { kind: 'other', reason: 'API route answered 2xx with a non-JSON body' };
    }
    return { kind: 'granted', reason: `API route answered HTTP ${status} with a JSON body` };
  }
  return { kind: 'other', reason: `API route answered HTTP ${status}` };
}

/**
 * Judge the token-in-URL differential on one route: confirmed
 * only when the header-token control was granted AND the
 * query-token replay was granted with a substantive body (at
 * least 50 bytes — a short generic success body is the server
 * filtering, not an acceptance — and at least half the control
 * body's length). Pure.
 */
export function assessTokenInUrlFlow(controlKind, queryKind, controlLen, queryLen) {
  if (controlKind !== 'granted') {
    return { verdict: 'uncalibrated', reason: 'the header-token control did not grant the route — no valid control' };
  }
  if (queryKind === 'refused') {
    return { verdict: 'rejected', reason: 'the query-token replay was refused — the API does not accept URL-borne tokens on this route' };
  }
  if (queryKind !== 'granted') {
    return { verdict: 'uncalibrated', reason: 'the query-token replay was inconclusive on this route' };
  }
  if (queryLen < MIN_TOKEN_BODY_BYTES) {
    return {
      verdict: 'rejected',
      reason: `query-token body (${queryLen} bytes) is too short to be the protected response — the server filtered it`,
    };
  }
  if (queryLen * 2 < controlLen) {
    return {
      verdict: 'rejected',
      reason: `query-token body (${queryLen} bytes) is much smaller than the header-token control body (${controlLen} bytes) — the server filtered the response`,
    };
  }
  return {
    verdict: 'confirmed',
    reason: `the API returned the protected response (${queryLen} bytes vs header-token control ${controlLen} bytes) with the token in the URL and no Authorization header`,
  };
}

// ---- token judging (pure) ---------------------------------------------------

/**
 * Classify an issued token: 'jwt' when it decodes as a JWT
 * (three base64url parts, JSON header carrying an alg string),
 * 'opaque' otherwise. Pure.
 */
export function classifyToken(token) {
  if (typeof token !== 'string' || !token) return 'opaque';
  try {
    const decoded = decodeJwt(token);
    if (decoded && decoded.header && typeof decoded.header.alg === 'string') return 'jwt';
  } catch {
    // not a JWT — opaque
  }
  return 'opaque';
}

/**
 * Trivial derivations of the login username a predictable token
 * could equal: the username itself, its base64 / base64url /
 * hex forms, and its MD5 hex digest. Pure.
 */
export function predictableDerivations(username) {
  const name = String(username || '');
  if (!name) return [];
  const out = [name];
  try {
    out.push(Buffer.from(name, 'utf8').toString('base64'));
    out.push(Buffer.from(name, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''));
    out.push(Buffer.from(name, 'utf8').toString('hex'));
    out.push(createHash('md5').update(name, 'utf8').digest('hex'));
  } catch {
    // encoding helpers are best-effort — the raw name still stands
  }
  return [...new Set(out)];
}

/**
 * Judge the weak-token leg on two tokens from independent logins
 * with the same credentials. OPAQUE tokens only — a JWT input
 * returns 'not-applicable' (jwt.js owns JWT claim hygiene) and
 * the caller records tokenKind 'jwt' instead. Returns
 * { verdict, kind, reason } where kind is 'static-token' /
 * 'weak-token' / null. Pure.
 */
export function assessWeakToken(tokenA, tokenB, username) {
  if (typeof tokenA !== 'string' || !tokenA || typeof tokenB !== 'string' || !tokenB) {
    return { verdict: 'uncalibrated', kind: null, reason: 'two issued tokens are needed to judge token strength' };
  }
  if (classifyToken(tokenA) === 'jwt' || classifyToken(tokenB) === 'jwt') {
    return { verdict: 'not-applicable', kind: null, reason: 'the issued token is a JWT — JWT claim hygiene is jwt.js territory' };
  }
  if (tokenA === tokenB) {
    return {
      verdict: 'confirmed',
      kind: 'static-token',
      reason: 'two independent logins were issued the identical token — the token does not rotate, so a stolen token stays valid across re-login',
    };
  }
  for (const token of [tokenA, tokenB]) {
    if (/^\d+$/.test(token) && token.length <= MAX_NUMERIC_TOKEN_LEN) {
      return {
        verdict: 'confirmed',
        kind: 'weak-token',
        reason: `the issued token is a ${token.length}-digit number — enumerable by brute force (${token.length} digits, at most 10^${token.length} candidates)`,
      };
    }
    if (token.length < MIN_TOKEN_LEN) {
      return {
        verdict: 'confirmed',
        kind: 'weak-token',
        reason: `the issued token is only ${token.length} characters — too short to be unguessable`,
      };
    }
    if (predictableDerivations(username).includes(token)) {
      return {
        verdict: 'confirmed',
        kind: 'weak-token',
        reason: 'the issued token is the login username or a trivial derivation of it — predictable from public data',
      };
    }
  }
  return { verdict: 'rejected', kind: null, reason: 'the issued tokens differ, are long enough, and are not trivial derivations of the username' };
}

// ---- network (fetchFn seam, defaults to global fetch) -----------------------

async function req(fetchFn, url, { method = 'GET', token = null, timeoutMs = TIMEOUT_MS } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, {
      method,
      signal: ctrl.signal,
      headers: {
        'User-Agent': UA,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const text = await res.text().catch(() => '');
    return { status: res.status, text: text.slice(0, 200000) };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function reqJson(fetchFn, url, { method = 'POST', body = null, timeoutMs = TIMEOUT_MS } = {}) {
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
    return { status: res.status, text: text.slice(0, 200000), json };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// One API login attempt sequence against the login candidates:
// {email, password} first, then {username, password} on 401/400.
// Returns { ok, token, spent } — spent counts the POSTs made.
async function apiLogin(fetchFn, loginUrls, creds, budget) {
  let spent = 0;
  for (const loginUrl of loginUrls) {
    for (const body of [
      { email: creds.username, password: creds.password },
      { username: creds.username, password: creds.password },
    ]) {
      if (spent >= budget) return { ok: false, token: null, spent };
      const r = await reqJson(fetchFn, loginUrl, { method: 'POST', body });
      spent += 1;
      if (!r) return { ok: false, token: null, spent };
      if (r.status === 401 || r.status === 400) continue;
      if (r.status < 200 || r.status >= 300) return { ok: false, token: null, spent };
      const token = r.json ? extractBearerTokenFromJson(r.json) : null;
      if (!token) return { ok: false, token: null, spent };
      return { ok: true, token, spent };
    }
  }
  return { ok: false, token: null, spent };
}

// ---- the probe ---------------------------------------------------------------

export async function probeApiTokenAuth(url, opts = {}) {
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
  const tokenRoutes = findTokenUrlRoutes(routes, origin);
  setDiag('tokenUrlRoutes', tokenRoutes.length);

  // Shared login budget: at most MAX_TOTAL_POSTS POSTs across both
  // logins — a leg that cannot run inside the budget is skipped,
  // never forced.
  let postsLeft = MAX_TOTAL_POSTS;
  const loginUrls = loginCandidates(routes, origin).slice(0, MAX_LOGIN_CANDIDATES);
  if (!loginUrls.length) return findings;
  const loginA = await apiLogin(fetchFn, loginUrls, creds, Math.min(MAX_LOGIN_POSTS, postsLeft));
  postsLeft -= loginA.spent;
  if (!loginA.ok) return findings;
  const tokenA = loginA.token;
  setDiag('tokenKind', classifyToken(tokenA));
  setDiag('tokenLen', tokenA.length);

  // S1 — TOKEN IN URL: the three-way differential on each mined
  // token route. The first confirmed route ends the probe (max 1
  // finding). The token value never appears in evidence — the
  // request line carries the literal placeholder.
  let attempts = 0;
  for (const { url: routeUrl, param } of tokenRoutes) {
    // Leg 1 — no token: a route that answers 200 anonymously is
    // public, not broken auth, and is skipped, never a finding.
    const rNoAuth = await req(fetchFn, routeUrl, { method: 'GET' });
    if (rNoAuth) {
      const judgedNoAuth = assessTokenRouteResponse(rNoAuth.status, rNoAuth.text);
      if (judgedNoAuth.kind === 'granted') continue;
    }
    // Leg 2 — header-token control: must grant, with a non-empty
    // body to compare against.
    const rControl = await req(fetchFn, routeUrl, { method: 'GET', token: tokenA });
    if (!rControl) continue;
    const judgedControl = assessTokenRouteResponse(rControl.status, rControl.text);
    if (judgedControl.kind !== 'granted') continue;
    setDiag('controlOk', true);
    const controlLen = rControl.text.length;
    // Leg 3 — query-token replay: the same token as the query
    // parameter, no Authorization header.
    let queryUrl;
    try {
      const q = new URL(routeUrl);
      q.searchParams.set(param, tokenA);
      queryUrl = q.toString();
    } catch {
      continue;
    }
    const rQuery = await req(fetchFn, queryUrl, { method: 'GET' });
    if (!rQuery) continue;
    attempts += 1;
    setDiag('attempts', attempts);
    const judgedQuery = assessTokenRouteResponse(rQuery.status, rQuery.text);
    const verdict = assessTokenInUrlFlow('granted', judgedQuery.kind, controlLen, rQuery.text.length);
    if (verdict.verdict !== 'confirmed') continue;
    setDiag('bypassKind', 'token-in-url');
    findings.push({
      class: 'api_broken_auth',
      id: `api-token-url-${rand()}`,
      title: 'API accepts authentication token in URL — token exposed in logs and Referer (HIGH)',
      severity: 'high',
      url: routeUrl,
      parameter: param,
      evidence: ev(
        `GET ${routeUrl}?${param}=<lab session token> with no Authorization header (control: same route with the token in the Authorization header returned HTTP 200, no-token returned ${rNoAuth ? rNoAuth.status : 'n/a'})`,
        `The API returned the protected response with the token in the URL — HTTP 200, ${rQuery.text.length} bytes vs header-token control ${controlLen} bytes. ${verdict.reason}.`,
        'A token in a URL leaks through server logs, Referer headers, browser history, and shared links — anyone who obtains it can call the API as the user (CWE-287).',
      ),
    });
    return findings;
  }

  // S2 — WEAK TOKEN: a second independent login, then judge the
  // two issued tokens. JWTs are jwt.js territory — the leg stays
  // silent on them and the diagnostics record the kind.
  if (postsLeft <= 0) return findings;
  const loginB = await apiLogin(fetchFn, loginUrls, creds, Math.min(MAX_LOGIN_POSTS, postsLeft));
  postsLeft -= loginB.spent;
  if (!loginB.ok) return findings;
  setDiag('tokensCompared', 2);
  const weak = assessWeakToken(tokenA, loginB.token, creds.username);
  if (weak.verdict !== 'confirmed') return findings;
  setDiag('bypassKind', weak.kind);
  const isStatic = weak.kind === 'static-token';
  findings.push({
    class: 'api_broken_auth',
    id: `api-token-weak-${rand()}`,
    title: isStatic
      ? 'API token does not rotate — the same token is re-issued on repeat login (MEDIUM)'
      : 'API token is weak — guessable from its form (HIGH)',
    severity: isStatic ? 'medium' : 'high',
    url,
    parameter: 'Authorization',
    evidence: ev(
      'Two independent logins with the same lab credentials (token values withheld — never published)',
      `Both logins were issued tokens; ${weak.reason}.`,
      isStatic
        ? 'A stolen token stays valid across re-login — rotating the token on each login is what invalidates a leaked one.'
        : 'A guessable token lets an attacker mint a valid session without any credential — full authentication bypass (CWE-287).',
    ),
  });
  return findings;
}

export const __apiTokenAuthMeta = { phases: ['api-token-auth'], depth: ['standard', 'deep'] };
