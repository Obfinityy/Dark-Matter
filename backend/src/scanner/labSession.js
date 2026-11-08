// Dark Matter rule-based scanner — lab session acquisition for the
// authenticated DOM render (CDP authenticated-DOM-render lane, 8 Nov 2026).
//
// PROBLEM: the dom-render phase renders the pasted page anonymously,
// so DOM probes never see post-login state on a lab SPA (Juice Shop:
// the account/basket views and their named inputs only exist after
// login). The scanner already holds lab canary credentials
// (opts.labCreds, gated by isLabTargetHost) — this module turns
// them into a session the CDP renderer can carry: a bearer token
// (Juice Shop's JWT, read from localStorage on boot) and/or cookies
// (DVWA-style PHPSESSID).
//
// HOW IT FINDS THE LOGIN (same proven paths as sessionFixation):
// - loginCandidates() over the routes known at dom-render time
//   (crawled links + rendered SPA routes + form actions) — the
//   exact-first / substring-fallback ranking that fixed the
//   /rest/saveLoginIp decoy in re-proof #2.
// - Form login: a password form's action, POSTed urlencoded with
//   its hidden inputs carried (the DVWA CSRF token rides along).
// - Bundle mining: the login API path of an SPA lives in its JS
//   bundles, not its links — /rest/user/login is in Juice's main.js
//   but in no href. Bundles already fetched for the page are
//   scanned for quoted login-ish paths (same cap as jsRoutes: 5).
//   This is a login-endpoint miner only — it never runs probes.
//
// SAFETY: lab-gated (creds + isLabTargetHost, else a silent
// {ok:false}); ≤5 login POSTs total per scan (the same bound as
// sessionFixation's T4b); canary credentials only, never the
// owner's; no login attempt is ever made against a non-lab host.
// Never throws — every failure is {ok:false, reason}.

import { isLabTargetHost } from '../labCreds.js';
import { loginCandidates } from './probes/sessionFixation.js';
import { extractScriptSrcs } from './jsRoutes.js';
import { fetchPage } from './fingerprint.js';

export const LAB_SESSION_TIMEOUT_MS = 15000;
export const LAB_SESSION_MAX_LOGINS = 5;
export const LAB_SESSION_MAX_CANDIDATES = 3;
export const LAB_SESSION_MAX_BUNDLES = 5;
export const LAB_SESSION_MAX_REDIRECTS = 3;

const TOKEN_FIELDS = ['token', 'accessToken', 'access_token', 'jwt'];
// Mirrors sessionFixation's LOGIN_PATH_RE: a login-ish path segment.
const LOGIN_PATH_RE = /login|signin|authenticate|auth\/token/i;
const SESSION_COOKIE_RE = /phpsessid|jsessionid|sessionid|connect\.sid|_session|session_|sessid|auth.?token/i;
const AUTH_MARKER_RE = /logout|dashboard|welcome|profile/i;
const PASSWORD_INPUT_RE = /pass/i;
const USERNAME_INPUT_RE = /user|email|login/i;

// Quoted login-ish paths in JS bundle text: "/rest/user/login",
// '/api/auth/login', "https://host/auth/token". The leading slash
// is required — a bare word "login" is not a path.
const BUNDLE_LOGIN_PATH_RE = /["']([^"']*(?:\/login|\/signin|\/authenticate|\/auth\/token)[^"']*)["']/gi;

/**
 * Parse one Set-Cookie header value into {name, value, domain,
 * path, secure, httpOnly}. Returns null for a malformed header.
 * Pure — exported for unit tests.
 */
export function parseSetCookie(header) {
  if (!header || typeof header !== 'string') return null;
  const parts = header.split(';').map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return null;
  const eq = parts[0].indexOf('=');
  if (eq <= 0) return null;
  const out = {
    name: parts[0].slice(0, eq).trim(),
    value: parts[0].slice(eq + 1).trim(),
    domain: null,
    path: null,
    secure: false,
    httpOnly: false,
  };
  if (!out.name) return null;
  for (const attr of parts.slice(1)) {
    const [k, ...v] = attr.split('=');
    const key = String(k || '').trim().toLowerCase();
    const val = v.join('=').trim();
    if (key === 'domain' && val) out.domain = val.replace(/^\./, '');
    else if (key === 'path' && val) out.path = val;
    else if (key === 'secure') out.secure = true;
    else if (key === 'httponly') out.httpOnly = true;
  }
  return out;
}

/**
 * Shallow-recursive token hunt (depth ≤ 3): Juice nests the token
 * under {authentication: {token}}. Mirrors sessionFixation's
 * findTokenField. Pure — exported for unit tests.
 */
export function extractBearerTokenFromJson(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 3) return null;
  for (const key of TOKEN_FIELDS) {
    const v = node[key];
    if (typeof v === 'string' && v) return v;
  }
  for (const v of Object.values(node)) {
    const found = extractBearerTokenFromJson(v, depth + 1);
    if (found) return found;
  }
  return null;
}

/**
 * Mine login-endpoint paths from JS bundle text. Returns same-origin
 * absolute URLs, deduplicated, capped at LAB_SESSION_MAX_CANDIDATES.
 * Pure — exported for unit tests.
 */
export function mineLoginPaths(bundleText, origin) {
  const found = [];
  const seen = new Set();
  let base = null;
  try {
    base = new URL(origin);
  } catch {
    return found;
  }
  const text = String(bundleText || '');
  for (const m of text.matchAll(BUNDLE_LOGIN_PATH_RE)) {
    if (found.length >= LAB_SESSION_MAX_CANDIDATES) break;
    const raw = (m[1] || '').trim();
    if (!raw || !LOGIN_PATH_RE.test(raw)) continue;
    // A bare path fragment with no leading slash and no scheme is
    // not a URL — skip it rather than guessing an origin-relative
    // path that never existed.
    if (!raw.startsWith('/') && !/^https?:\/\//i.test(raw)) continue;
    let u = null;
    try {
      u = new URL(raw, origin);
    } catch {
      continue;
    }
    if (u.protocol !== base.protocol || u.host !== base.host) continue;
    const key = u.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    found.push(key);
  }
  return found;
}

function jarCookies(jar) {
  return [...jar.values()].map((c) => `${c.name}=${c.value}`).join('; ');
}

function ingestSetCookies(jar, headers) {
  const list = Array.isArray(headers) ? headers : headers ? [headers] : [];
  for (const h of list) {
    const c = parseSetCookie(String(h));
    if (c && c.name) jar.set(c.name, c);
  }
}

/**
 * One HTTP request for the login flow. Global fetch with an abort
 * timeout, redirect:'manual' (the caller follows hops so cookies
 * are ingested per hop, like sessionFixation's req). Returns
 * {status, text, setCookies, location} or null on network failure.
 * Never throws.
 */
async function labReq(url, { method = 'GET', body = null, headers = {}, fetchFn, timeoutMs = LAB_SESSION_TIMEOUT_MS } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, {
      method,
      signal: ctrl.signal,
      headers: { 'User-Agent': 'DarkMatter-Scanner/1.0 (+authorized-scan)', ...headers },
      body,
      redirect: 'manual',
    });
    const text = await res.text().catch(() => '');
    const setCookies = res.headers && typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : [];
    return {
      status: res.status,
      text: String(text || '').slice(0, 200000),
      setCookies,
      location: res.headers ? res.headers.get('location') : null,
      authorization: res.headers ? res.headers.get('authorization') : null,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function tryApiLogin(loginUrl, creds, budget, fetchFn) {
  let spent = 0;
  const jar = new Map();
  for (const body of [
    { email: creds.username, password: creds.password },
    { username: creds.username, password: creds.password },
  ]) {
    if (spent >= budget.remaining) return { ok: false, spent };
    const r = await labReq(loginUrl, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
      fetchFn,
    });
    spent += 1;
    if (!r) return { ok: false, spent };
    if (r.setCookies && r.setCookies.length) ingestSetCookies(jar, r.setCookies);
    if (r.status === 401 || r.status === 400) continue;
    if (r.status < 200 || r.status >= 300) return { ok: false, spent };
    let token = null;
    try {
      token = extractBearerTokenFromJson(JSON.parse(r.text));
    } catch {
      token = null;
    }
    if (!token && r.authorization) {
      const tok = String(r.authorization).replace(/^Bearer\s+/i, '').trim();
      if (tok) token = tok;
    }
    if (!token && jar.size === 0) return { ok: false, spent };
    return { ok: true, spent, token, cookies: [...jar.values()] };
  }
  return { ok: false, spent };
}

function passwordForms(forms) {
  const out = [];
  for (const f of forms || []) {
    const inputs = Array.isArray(f.inputs) ? f.inputs : [];
    if (!inputs.some((i) => i && String(i.type || '').toLowerCase() === 'password')) continue;
    if (!f.action) continue;
    out.push(f);
  }
  return out;
}

async function tryFormLogin(form, origin, creds, budget, fetchFn) {
  let spent = 0;
  const jar = new Map();
  const action = String(form.action);
  // GET the form page first: carries the CSRF token + session cookie.
  const page = await labReq(action, { fetchFn });
  if (page && page.setCookies) ingestSetCookies(jar, page.setCookies);
  let hidden = {};
  if (page) {
    for (const m of page.text.matchAll(/<input[^>]*type=["']?hidden["']?[^>]*>/gi)) {
      const tag = m[0];
      const name = (/name=["']([^"']+)["']/i.exec(tag) || [])[1];
      const value = (/value=["']([^"']*)["']/i.exec(tag) || [])[1];
      if (name) hidden[name] = value || '';
    }
  }
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(hidden)) params.set(k, v);
  let userSet = false;
  for (const inp of form.inputs || []) {
    if (!inp || !inp.name) continue;
    const type = String(inp.type || '').toLowerCase();
    if (type === 'password') params.set(inp.name, creds.password);
    else if (type === 'hidden') {
      if (!params.has(inp.name)) params.set(inp.name, inp.value || '');
    } else if (!userSet && (USERNAME_INPUT_RE.test(inp.name) || type === 'email' || type === 'text')) {
      params.set(inp.name, creds.username);
      userSet = true;
    }
  }
  if (!userSet) {
    // No text-ish field to carry the username — a form login cannot
    // be expressed; do not spend a POST on a malformed guess.
    return { ok: false, spent };
  }
  if (spent >= budget.remaining) return { ok: false, spent };
  let currentUrl = action;
  let currentBody = params.toString();
  let currentMethod = 'POST';
  for (let hop = 0; hop <= LAB_SESSION_MAX_REDIRECTS; hop++) {
    const r = await labReq(currentUrl, {
      method: currentMethod,
      body: currentBody,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(jar.size ? { Cookie: jarCookies(jar) } : {}),
      },
      fetchFn,
    });
    spent += 1;
    if (!r) return { ok: false, spent };
    if (r.setCookies) ingestSetCookies(jar, r.setCookies);
    if (r.status >= 300 && r.status < 400 && r.location && hop < LAB_SESSION_MAX_REDIRECTS) {
      currentUrl = new URL(r.location, currentUrl).toString();
      currentMethod = 'GET';
      currentBody = null;
      continue;
    }
    const hasSessionCookie = [...jar.values()].some((c) => SESSION_COOKIE_RE.test(c.name));
    const authed = AUTH_MARKER_RE.test(r.text);
    if (r.status >= 200 && r.status < 300 && (authed || hasSessionCookie)) {
      return { ok: true, spent, token: null, cookies: [...jar.values()] };
    }
    return { ok: false, spent };
  }
  return { ok: false, spent };
}

/**
 * Acquire an authenticated session for a lab target from canary
 * credentials. opts: {url, routes, forms, pageBody, creds,
 * labTargets, fetchPage, fetchFn, maxLogins}. fetchPage is the
 * bundle fetcher (defaults to fingerprint.fetchPage); fetchFn is
 * the login request function (defaults to global fetch). Returns
 * {ok:true, session:{token, cookies}} or {ok:false, reason}.
 * Reasons: no-lab-creds | not-a-lab-target | no-login-candidate |
 * login-failed. Never throws.
 */
export async function acquireLabSession(opts = {}) {
  const url = String(opts.url || '');
  const creds = opts.creds || null;
  const labTargets = opts.labTargets || '';
  const fetchFn = typeof opts.fetchFn === 'function' ? opts.fetchFn : globalThis.fetch;
  const bundleFetcher = typeof opts.fetchPage === 'function' ? opts.fetchPage : fetchPage;
  if (!creds || !creds.username || !creds.password) return { ok: false, reason: 'no-lab-creds' };
  if (!url || !isLabTargetHost(url, labTargets)) return { ok: false, reason: 'not-a-lab-target' };
  if (typeof fetchFn !== 'function') return { ok: false, reason: 'login-failed' };

  let origin = null;
  try {
    origin = new URL(url).origin;
  } catch {
    return { ok: false, reason: 'login-failed' };
  }

  const budget = { remaining: Number.isInteger(opts.maxLogins) && opts.maxLogins > 0 ? opts.maxLogins : LAB_SESSION_MAX_LOGINS };
  const forms = Array.isArray(opts.forms) ? opts.forms : [];
  const routes = Array.isArray(opts.routes) ? opts.routes : [];

  // Candidate login URLs, in order: password-form actions first
  // (they are the page's own login), then loginCandidates() over
  // every known route, then bundle-mined API paths.
  const candidates = [];
  const seen = new Set();
  const pushCandidate = (u) => {
    try {
      const s = new URL(String(u), origin).toString();
      if (!seen.has(s)) {
        seen.add(s);
        candidates.push(s);
      }
    } catch {
      // ignore malformed candidates
    }
  };
  const pwForms = passwordForms(forms);
  for (const f of pwForms) pushCandidate(f.action);
  for (const c of loginCandidates([...routes, ...pwForms.map((f) => f.action)], origin)) pushCandidate(c);

  // Bundle mining (only when the page body is available): the SPA's
  // login API path lives in its JS, not its links. Best-effort —
  // a fetch failure here must not break the login attempts below.
  const mined = await mineBundleLoginPaths(opts.pageBody, origin, bundleFetcher);
  for (const c of mined) pushCandidate(c);

  if (!candidates.length && !pwForms.length) return { ok: false, reason: 'no-login-candidate' };

  // API login first: it yields the bearer token SPAs need.
  for (const cand of candidates) {
    if (budget.remaining <= 0) break;
    const attempt = await tryApiLogin(cand, creds, budget, fetchFn);
    budget.remaining -= attempt.spent;
    if (attempt.ok) {
      return { ok: true, session: normaliseSession(attempt, origin) };
    }
  }

  // Form login: cookie sessions for server-rendered labs.
  for (const form of pwForms) {
    if (budget.remaining <= 0) break;
    const attempt = await tryFormLogin(form, origin, creds, budget, fetchFn);
    budget.remaining -= attempt.spent;
    if (attempt.ok) {
      return { ok: true, session: normaliseSession(attempt, origin) };
    }
  }

  return { ok: false, reason: 'login-failed' };
}

function normaliseSession(attempt, origin) {
  let host = '';
  try {
    host = new URL(origin).hostname;
  } catch {
    host = '';
  }
  const cookies = (attempt.cookies || []).map((c) => ({
    name: c.name,
    value: c.value,
    domain: c.domain || host,
    path: c.path || '/',
    secure: Boolean(c.secure),
    httpOnly: Boolean(c.httpOnly),
  }));
  return { token: attempt.token || null, cookies };
}

/**
 * Fetch the page's JS bundles (cap 5, same as jsRoutes) and mine
 * login-endpoint paths from their text. Best-effort: any fetch
 * failure yields [] — the caller still tries its other candidates.
 */
async function mineBundleLoginPaths(pageBody, origin, bundleFetcher) {
  if (!pageBody) return [];
  let srcs = [];
  try {
    srcs = extractScriptSrcs(String(pageBody), origin).slice(0, LAB_SESSION_MAX_BUNDLES);
  } catch {
    return [];
  }
  const found = [];
  const seen = new Set();
  for (const src of srcs) {
    try {
      const page = await bundleFetcher(src, { timeoutMs: LAB_SESSION_TIMEOUT_MS });
      const body = page && typeof page.body === 'string' ? page.body : '';
      for (const p of mineLoginPaths(body, origin)) {
        if (!seen.has(p)) {
          seen.add(p);
          found.push(p);
        }
      }
      if (found.length >= LAB_SESSION_MAX_CANDIDATES) break;
    } catch {
      // one dead bundle must not break the others
    }
  }
  return found.slice(0, LAB_SESSION_MAX_CANDIDATES);
}
