// Dark Matter rule-based scanner — BFLA probe
// (coverage row #340 [High] BFLA — Admin endpoints callable by
// low-privilege users, CWE-862 | OWASP API05:2023; phase 97, 'bfla'.)
//
// ORACLE (deterministic, no judge, no LLM, $0): function-level
// authorization is missing when a low-privilege session can invoke
// an admin-only API function. The row's lab note names exactly the
// observable test: "replay admin endpoints with a low-privilege lab
// token; confirm execution." The probe runs a THREE-WAY
// differential on each mined admin route:
//   (1) no-token GET — must be refused (401/403 or a refusal
//       message). A route that answers 200 anonymously is public,
//       not BFLA (that is missing-auth #47's territory) and is
//       skipped, never a finding.
//   (2) admin-token GET (control) — must be granted (2xx + a
//       non-empty JSON body with no refusal text). A route the admin
//       token cannot reach is not a valid control and is skipped.
//   (3) low-privilege-token GET — CONFIRM only when granted (2xx
//       + no refusal text + a body of at least 50 bytes and at
//       least half the admin control body's length — a filtered or
//       empty answer is the server enforcing something, not a
//       bypass, and a short generic success body must not confirm
//       against a small control body). The first confirmed
//       route ends the probe (max 1 finding).
// If every route refuses the low-privilege token, that is a proven
// true negative, not a finding.
//
// The low-privilege session is a throwaway self-registered lab
// account: POST the mined registration route, then log in with the
// same login candidates as the admin control. The registration
// email carries a per-run random suffix so re-runs never collide
// with an existing account; the password is a fixed clearly-fake
// canary value, never a real password. No mined registration route
// means an honest [] — the probe never invents a route.
//
// CANDIDATES: mined apiRoutes whose pathname carries a whole
// 'admin' (administrator / manage / management / setup / console)
// segment, plus the Juice admin user list GET /api/Users (the
// user-list endpoint requires the admin role on Juice Shop; the
// probe verifies that with the admin control first, and the
// no-token leg catches any route that is public-by-design). GET
// replays only: write-route BFLA (POST/PUT/DELETE admin
// functions) is a follow-up, not this lane — replaying a write as
// low-privilege would create lab state per route and needs a
// per-route canary body.
//
// GATES: labCreds + allowWrite + isLabTargetHost (same lab gate as
// basket-logic / workflow-skip / session-fixation / twofa-bruteforce
// / credential-stuffing); depth 'quick' skips the probe. BOUND:
// at most 10 POSTs (admin login 4, registration 2, low-privilege
// login 4) and at most 15 GETs (5 admin routes x 3 legs). Findings
// are class 'bfla_bypass' — protocolFor routes any class
// containing 'bypass' to the auth_bypass protocol, judged on
// evidence.bypassWorks (see differential.js; same pattern as
// captcha_bypass).
//
// NOTE on #86: row #86 ('Unrestricted Access to Sensitive Business
// Flows') does NOT ride this lane — its spreadsheet row is a
// business-logic workflow-abuse row (price / quantity / steps),
// not an admin-endpoint replay; verified first-hand 9 Nov 2026.

import { isLabTargetHost } from '../../labCreds.js';
import { loginCandidates } from './sessionFixation.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const TIMEOUT_MS = 15000;
const MAX_ADMIN_ROUTES = 5;
const MAX_REGISTER_CANDIDATES = 2;
const MAX_LOGIN_POSTS = 4;
const MAX_TOTAL_POSTS = 10;
// Fixed canary password for the throwaway low-privilege account —
// never a real password, never derived from a secret.
export const LOW_PRIV_PASSWORD = 'dm-bfla-low-pass-01';
const TOKEN_FIELDS = ['token', 'accessToken', 'access_token', 'jwt'];
const REFUSAL_TEXT_RE =
  /unauthori[sz]ed|forbidden|access denied|not allowed|admin[ -](required|only)|insufficient (privilege|permission|rights)|requires? (admin|elevated|administrator)|role[ -]?required|must be (an? )?admin/i;
// Whole path segments that mark an admin-only function. The
// segment must be whole: '/admin-panel' and '/api/user-management'
// are NOT admin endpoints (a UI page and a compound name), while
// '/admin/users', '/rest/admin/application-version' and a trailing
// '/admin' are.
const ADMIN_SEGMENT_RE = /(?:^|\/)(admin|administrator|manage|management|setup|console)(?:\/|$)/i;
const REGISTER_SEGMENT_RE = /(?:^|\/)(register|signup|sign-up)(?:\/|$)/i;

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

function ev(request, response, impact) {
  return { request, response, impact_demo: impact, signalCorrelated: true, bypassWorks: true };
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

/**
 * Mine admin-function routes from the discovered route set. A route
 * qualifies when its pathname carries a whole admin segment, or
 * when it is exactly the Juice admin user list (GET /api/Users —
 * the list endpoint requires the admin role; the probe verifies
 * that with the admin control first). Public list endpoints such
 * as /api/Products are deliberately NOT candidates: a 200 there
 * proves nothing about authorization. Pure.
 */
export function findAdminRoutes(routes, origin) {
  const out = [];
  for (const r of routes || []) {
    try {
      const u = new URL(String(r));
      if (u.origin !== origin) continue;
      const p = u.pathname;
      const isAdmin = ADMIN_SEGMENT_RE.test(p) || /^\/api\/Users\/?$/i.test(p);
      if (!isAdmin) continue;
      const s = stripQuery(u.toString());
      if (!out.includes(s)) out.push(s);
    } catch {
      // ignore malformed route entries
    }
  }
  return out.slice(0, MAX_ADMIN_ROUTES);
}

/**
 * Mine registration routes from the discovered route set: the Juice
 * registration endpoint (POST /api/Users) first, then generic
 * register / signup paths. Pure.
 */
export function findRegisterRoutes(routes, origin) {
  const exact = [];
  const fallback = [];
  for (const r of routes || []) {
    try {
      const u = new URL(String(r));
      if (u.origin !== origin) continue;
      const p = u.pathname;
      if (/^\/api\/Users\/?$/i.test(p)) {
        const s = stripQuery(u.toString());
        if (!exact.includes(s)) exact.push(s);
        continue;
      }
      if (!REGISTER_SEGMENT_RE.test(p)) continue;
      const s = stripQuery(u.toString());
      if (!exact.includes(s) && !fallback.includes(s)) fallback.push(s);
    } catch {
      // ignore malformed route entries
    }
  }
  return [...exact, ...fallback].slice(0, MAX_REGISTER_CANDIDATES);
}

/**
 * Judge one admin-route response. Returns { kind, reason } where
 * kind is 'granted' (2xx + a non-empty JSON body with no refusal
 * text), 'refused' (401/403/404, or a refusal message in the
 * body), or 'other' (anything else — 5xx, redirect, empty 2xx,
 * or a non-JSON 2xx such as the SPA HTML shell, which proves
 * nothing about the API route). Pure.
 */
export function assessAdminResponse(status, body) {
  const text = bodyText(body);
  if (typeof status === 'number' && (status === 401 || status === 403 || status === 404)) {
    return { kind: 'refused', reason: `admin route answered HTTP ${status}` };
  }
  if (REFUSAL_TEXT_RE.test(text)) {
    return { kind: 'refused', reason: 'admin route response carries a refusal message' };
  }
  if (typeof status === 'number' && status >= 200 && status < 300) {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      return { kind: 'other', reason: 'admin route answered 2xx with an empty body' };
    }
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      return { kind: 'other', reason: 'admin route answered 2xx with a non-JSON body' };
    }
    return { kind: 'granted', reason: `admin route answered HTTP ${status} with a JSON body` };
  }
  return { kind: 'other', reason: `admin route answered HTTP ${status}` };
}

/**
 * Judge the BFLA differential on one route: confirmed only when the
 * admin control was granted AND the low-privilege replay was
 * granted with a substantive body (at least 50 bytes — a short
 * generic success/empty JSON body is the server filtering, not a
 * bypass, and it must not confirm against a small control body)
 * at least half the control body's length (a filtered or empty
 * answer is the server enforcing something, not a bypass). Pure.
 */
export function assessBflaFlow(controlKind, lowKind, controlLen, lowLen) {
  if (controlKind !== 'granted') {
    return { verdict: 'uncalibrated', reason: 'the admin control did not grant the route — no valid control' };
  }
  if (lowKind === 'refused') {
    return { verdict: 'rejected', reason: 'the low-privilege token was refused — authorization holds on this route' };
  }
  if (lowKind !== 'granted') {
    return { verdict: 'uncalibrated', reason: 'the low-privilege replay was inconclusive on this route' };
  }
  if (lowLen < 50) {
    return {
      verdict: 'rejected',
      reason: `low-privilege body (${lowLen} bytes) is too short to be an admin response — the server filtered it`,
    };
  }
  if (lowLen * 2 < controlLen) {
    return {
      verdict: 'rejected',
      reason: `low-privilege body (${lowLen} bytes) is much smaller than the admin control body (${controlLen} bytes) — the server filtered the response`,
    };
  }
  return {
    verdict: 'confirmed',
    reason: `low-privilege session received the admin-only response (${lowLen} bytes vs admin control ${controlLen} bytes)`,
  };
}

// Shallow-recursive token hunt (depth ≤ 3): Juice nests the token
// under {authentication: {token}} — a top-level-only read would
// miss it. Pure.
function findTokenField(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 3) return null;
  for (const key of TOKEN_FIELDS) {
    const v = node[key];
    if (typeof v === 'string' && v) return v;
  }
  for (const v of Object.values(node)) {
    const found = findTokenField(v, depth + 1);
    if (found) return found;
  }
  return null;
}

export function extractBearerToken(res) {
  if (!res) return null;
  try {
    const body = JSON.parse(res.text);
    const fromBody = findTokenField(body);
    if (fromBody) return fromBody;
  } catch {
    // not JSON — fall through to the Authorization header
  }
  try {
    const auth = res.headers && typeof res.headers.get === 'function' ? res.headers.get('authorization') : null;
    if (auth) {
      const tok = String(auth).replace(/^Bearer\s+/i, '').trim();
      if (tok) return tok;
    }
  } catch {
    // header read failed — no token
  }
  return null;
}

// ---- network (fetchFn seam, defaults to global fetch) -----------------------

async function req(fetchFn, url, { method = 'GET', body = null, headers = {}, timeoutMs = TIMEOUT_MS } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, {
      method,
      signal: ctrl.signal,
      headers: {
        'User-Agent': UA,
        ...(body != null ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body != null ? JSON.stringify(body) : undefined,
    });
    const text = await res.text().catch(() => '');
    return {
      status: res.status,
      text: text.slice(0, 200000),
      headers: res.headers || null,
      authorization:
        res.headers && typeof res.headers.get === 'function' ? res.headers.get('authorization') : null,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// One API login attempt sequence against the login candidates:
// {email, password} first, then {username, password} on 401/400,
// across candidates until one returns a token. Returns
// { ok, token, spent } — spent counts the POSTs made, so the
// caller shares one budget across both logins (admin + low-priv).
export async function apiLogin(fetchFn, loginUrls, creds, budget) {
  let spent = 0;
  for (const loginUrl of loginUrls) {
    for (const body of [
      { email: creds.username, password: creds.password },
      { username: creds.username, password: creds.password },
    ]) {
      if (spent >= budget) return { ok: false, token: null, spent };
      const r = await req(fetchFn, loginUrl, { method: 'POST', body });
      spent += 1;
      if (!r) return { ok: false, token: null, spent };
      if (r.status === 401 || r.status === 400) continue;
      if (r.status < 200 || r.status >= 300) return { ok: false, token: null, spent };
      const token = extractBearerToken(r);
      if (!token) return { ok: false, token: null, spent };
      return { ok: true, token, spent };
    }
  }
  return { ok: false, token: null, spent };
}

// Register the throwaway low-privilege account. One POST per
// candidate, Juice shape {email, password, passwordRepeat}. A
// non-2xx answer means this candidate is not a registration
// endpoint (or the account already exists) — the caller moves on.
export async function registerLowPriv(fetchFn, registerUrls, email) {
  let spent = 0;
  for (const registerUrl of registerUrls) {
    if (spent >= MAX_REGISTER_CANDIDATES) return { ok: false, spent };
    const r = await req(fetchFn, registerUrl, {
      method: 'POST',
      body: { email, password: LOW_PRIV_PASSWORD, passwordRepeat: LOW_PRIV_PASSWORD },
    });
    spent += 1;
    if (!r) return { ok: false, spent };
    if (r.status >= 200 && r.status < 300) return { ok: true, spent };
  }
  return { ok: false, spent };
}

// ---- the probe ---------------------------------------------------------------

export async function probeBfla(url, opts = {}) {
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
  const adminRoutes = findAdminRoutes(routes, origin);
  setDiag('adminRoutes', adminRoutes.length);
  if (!adminRoutes.length) return findings;
  const registerRoutes = findRegisterRoutes(routes, origin);
  if (!registerRoutes.length) return findings;

  let postsSpent = 0;
  // THE TEST, part 1 — the admin control session. Without an admin
  // token there is no control to compare against, so the probe
  // returns [] (uncalibrated, not a finding).
  const loginUrls = loginCandidates(routes, origin);
  if (!loginUrls.length) return findings;
  const adminLogin = await apiLogin(fetchFn, loginUrls, creds, MAX_LOGIN_POSTS);
  postsSpent += adminLogin.spent;
  if (!adminLogin.ok) return findings;

  // Part 2 — the throwaway low-privilege account. The email carries
  // a per-run random suffix so re-runs never collide with an
  // existing account; the password is the fixed canary value.
  const rid = rand();
  const lowEmail = `dm-bfla-low-${rid}@example.com`;
  const registered = await registerLowPriv(fetchFn, registerRoutes, lowEmail);
  postsSpent += registered.spent;
  setDiag('registerOk', registered.ok);
  if (!registered.ok) return findings;
  if (postsSpent >= MAX_TOTAL_POSTS) return findings;
  const lowLogin = await apiLogin(
    fetchFn,
    loginUrls,
    { username: lowEmail, password: LOW_PRIV_PASSWORD },
    Math.min(MAX_LOGIN_POSTS, MAX_TOTAL_POSTS - postsSpent)
  );
  postsSpent += lowLogin.spent;
  if (!lowLogin.ok) return findings;

  // Part 3 — the three-way differential, one route at a time. The
  // first confirmed route ends the probe (max 1 finding).
  let attempts = 0;
  for (const route of adminRoutes) {
    // Leg 1 — no token: a route that answers 200 anonymously is
    // public, not BFLA (missing-auth #47's territory), never a
    // finding.
    const rNoAuth = await req(fetchFn, route, { method: 'GET' });
    if (rNoAuth) {
      const judgedNoAuth = assessAdminResponse(rNoAuth.status, rNoAuth.text);
      if (judgedNoAuth.kind === 'granted') continue;
    }
    // Leg 2 — admin control: must grant, with a non-empty body to
    // compare against.
    const rAdmin = await req(fetchFn, route, {
      method: 'GET',
      headers: { Authorization: `Bearer ${adminLogin.token}` },
    });
    if (!rAdmin) continue;
    const judgedAdmin = assessAdminResponse(rAdmin.status, rAdmin.text);
    if (judgedAdmin.kind !== 'granted') continue;
    setDiag('controlOk', true);
    const controlLen = rAdmin.text.length;
    // Leg 3 — low-privilege replay.
    const rLow = await req(fetchFn, route, {
      method: 'GET',
      headers: { Authorization: `Bearer ${lowLogin.token}` },
    });
    if (!rLow) continue;
    attempts += 1;
    setDiag('attempts', attempts);
    const judgedLow = assessAdminResponse(rLow.status, rLow.text);
    const verdict = assessBflaFlow('granted', judgedLow.kind, controlLen, rLow.text.length);
    if (verdict.verdict !== 'confirmed') continue;
    setDiag('bypassKind', 'low-priv-admin-route');
    findings.push({
      class: 'bfla_bypass',
      id: `bfla-admin-route-${rand()}`,
      title: 'BFLA — admin endpoint callable by low-privilege user (HIGH)',
      severity: 'high',
      url: route,
      parameter: 'Authorization',
      evidence: ev(
        `GET ${route} with a low-privilege Bearer token (control: admin 200, no-token ${rNoAuth ? rNoAuth.status : 'n/a'})`,
        `Low-privilege session received the admin-only response — HTTP 200, ${rLow.text.length} bytes vs admin control ${controlLen} bytes, same admin data — the function-level authorization check is missing on this route. ${verdict.reason}.`,
        'A low-privilege customer can invoke admin functions — enumerate all users / read admin-only data without the admin role.',
      ),
    });
    return findings;
  }
  return findings;
}

export const __bflaMeta = { phases: ['bfla'], depth: ['standard', 'deep'] };
