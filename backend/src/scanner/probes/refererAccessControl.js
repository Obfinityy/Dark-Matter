// Dark Matter rule-based scanner — Referer-based access control probe
// (coverage row #496 [High] Access control — Referer-based access
// control, CWE-862 | OWASP API05:2023; phase 'referer-access-control').
//
// Some applications "protect" a privileged function by checking the
// Referer header instead of the session: a request whose Referer
// points at the admin area is treated as if it came from the admin
// UI. The header is fully attacker-controlled, so a low-privilege
// user can forge it and invoke the privileged function.
//
// ORACLE (five-leg differential on each mined admin route, all
// legs required):
//   (1) ADMIN CONTROL — the same state-changing request with the
//       admin session must succeed. A route the admin token cannot
//       invoke is not a valid control and is skipped.
//   (2) BENIGN REFERER — the same request as the low-privilege
//       user with a benign Referer (the site home) must be DENIED.
//       A route that grants it anyway is public or role-checked
//       some other way, not Referer-gated.
//   (3) FORGED REFERER — the same request as the low-privilege
//       user with Referer forged to the admin path must SUCCEED.
//   (4) REPEAT — the forged-Referer success must reproduce on a
//       second identical request. One success is jitter, not a
//       finding.
//   (5) NONSENSE CONTROL — the same request as the low-privilege
//       user with a Referer to a random non-admin path must be
//       DENIED. If any Referer grants it, the check is not
//       Referer-path based and the verdict is rejected.
// The first confirmed route ends the probe (max 1 finding).
//
// The low-privilege session is a throwaway self-registered lab
// account (the same pattern as bfla.js): POST the mined
// registration route, then log in. The registration email carries
// a per-run random suffix so re-runs never collide; the password
// is a fixed clearly-fake canary value, never a real password.
// The privileged request is a POST with a canary JSON body —
// replaying a write as low-privilege creates lab state, so the
// probe is LAB-GATED (see below) and the body carries only a
// marker field, never a destructive action.
//
// GATES: labCreds + allowWrite + isLabTargetHost (same lab gate as
// bfla / credential-stuffing); depth 'quick' skips the probe.
// Findings are class 'referer_access_control' — the default
// confirmation protocol, judged on evidence.signalCorrelated (see
// differential.js). The route mining (findAdminRoutes,
// findRegisterRoutes), the response judge (assessAdminResponse)
// and the token extraction are shared with bfla.js, not
// duplicated here.
//
// HONEST LIMITS: the probe only tests POST replays against mined
// admin routes; a Referer-gated GET, or a privileged function on
// a route the miner does not recognise as admin, is not covered.
// The forged Referer is always the admin path of the same origin
// (`<origin>/admin`); a gate that trusts a different admin path
// shows no differential. No dedicated Referer-access-control lab
// exists today, so live proof needs a fixture that gates on
// Referer first — the unit tests prove the oracle against a local
// mock server instead.
//
// UNDICI CAVEAT: Referer is a forbidden header name in the Fetch
// spec, so a browser fetch (and some fetch runtimes) silently
// drops a caller-set Referer. Node's undici DOES transmit it —
// verified against a local listener on Node v24.22.1 — but the
// probe does not depend on that: every request (logins,
// registration, and the five differential legs) goes through
// rawHeaderFetch (node:http.request, shared with ssrfRouting.js),
// which transmits the header verbatim on every runtime, and the
// fetchFn seam stays for tests and injected transports.

import { isLabTargetHost } from '../../labCreds.js';
import { rawHeaderFetch } from './ssrfRouting.js';
import { loginCandidates } from './sessionFixation.js';
import {
  findAdminRoutes,
  findRegisterRoutes,
  assessAdminResponse,
  extractBearerToken,
} from './bfla.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const TIMEOUT_MS = 15000;
const MAX_ADMIN_ROUTES = 5;
const MAX_REGISTER_CANDIDATES = 2;
const MAX_LOGIN_POSTS = 4;
const MAX_TOTAL_POSTS = 10;
// Fixed canary password for the throwaway low-privilege account —
// never a real password, never derived from a secret.
const LOW_PRIV_PASSWORD = 'dm-referer-low-pass-01';
const ADMIN_PATH = '/admin';

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

function ev(request, response, impact) {
  return { request, response, impact_demo: impact, signalCorrelated: true, bypassWorks: true };
}

// ---- pure helpers (exported for unit tests) ---------------------------------

/**
 * The forged Referer for an origin: the admin path of the same
 * origin — the value a request "from the admin UI" would carry.
 * Pure.
 */
export function forgedAdminReferer(origin) {
  return `${String(origin).replace(/\/+$/, '')}${ADMIN_PATH}`;
}

/**
 * A benign Referer: the site home — a request from anywhere but
 * the admin area. Pure.
 */
export function benignReferer(origin) {
  return `${String(origin).replace(/\/+$/, '')}/`;
}

/**
 * A nonsense Referer: a random non-admin path no gate could trust.
 * Pure.
 */
export function nonsenseReferer(origin) {
  return `${String(origin).replace(/\/+$/, '')}/dm-nonsense-${rand()}`;
}

/**
 * Judge the five-leg Referer differential on one route. 'confirmed'
 * only when the admin control grants, the benign Referer is denied,
 * the forged Referer grants twice, and the nonsense Referer is
 * denied. Pure.
 */
export function assessRefererAccess({ adminKind, benignKind, forgedKind, forgedRepeatKind, nonsenseKind }) {
  if (adminKind !== 'granted') {
    return { verdict: 'uncalibrated', reason: 'the admin control did not grant the request — no valid control' };
  }
  if (benignKind === 'granted') {
    return { verdict: 'rejected', reason: 'the low-privilege request was granted with a benign Referer — the route is not Referer-gated' };
  }
  if (benignKind !== 'refused') {
    return { verdict: 'uncalibrated', reason: 'the benign-Referer leg was inconclusive on this route' };
  }
  if (forgedKind !== 'granted') {
    return { verdict: 'rejected', reason: 'the forged-Referer replay was refused — the Referer is not trusted' };
  }
  if (forgedRepeatKind !== 'granted') {
    return { verdict: 'unconfirmed', reason: 'the forged-Referer success did not reproduce on repeat' };
  }
  if (nonsenseKind === 'granted') {
    return { verdict: 'rejected', reason: 'a nonsense Referer was also granted — the check is not Referer-path based' };
  }
  if (nonsenseKind !== 'refused') {
    return { verdict: 'uncalibrated', reason: 'the nonsense-Referer leg was inconclusive on this route' };
  }
  return {
    verdict: 'confirmed',
    reason: 'low-privilege request granted only with the Referer forged to the admin path, reproducibly',
  };
}

// ---- network (fetchFn seam, defaults to rawHeaderFetch) ---------------------

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
async function apiLogin(fetchFn, loginUrls, creds, budget) {
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
async function registerLowPriv(fetchFn, registerUrls, email) {
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

export async function probeRefererAccessControl(url, opts = {}) {
  const findings = [];
  const diag = opts && typeof opts.diagnostics === 'object' && opts.diagnostics ? opts.diagnostics : null;
  const setDiag = (k, v) => {
    if (diag) diag[k] = v;
  };
  const fetchFn = typeof opts.fetchFn === 'function' ? opts.fetchFn : rawHeaderFetch;
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
  // Part 1 — the admin control session. Without an admin token
  // there is no control to compare against, so the probe returns
  // [] (uncalibrated, not a finding).
  const loginUrls = loginCandidates(routes, origin);
  if (!loginUrls.length) return findings;
  const adminLogin = await apiLogin(fetchFn, loginUrls, creds, MAX_LOGIN_POSTS);
  postsSpent += adminLogin.spent;
  if (!adminLogin.ok) return findings;

  // Part 2 — the throwaway low-privilege account. The email carries
  // a per-run random suffix so re-runs never collide with an
  // existing account; the password is the fixed canary value.
  const rid = rand();
  const lowEmail = `dm-referer-low-${rid}@example.com`;
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

  // Part 3 — the five-leg differential, one route at a time. The
  // first confirmed route ends the probe (max 1 finding). The
  // privileged request is a POST carrying only a marker field —
  // no destructive action.
  const markerBody = { dmProbe: `dm-referer-${rid}` };
  let attempts = 0;
  for (const route of adminRoutes) {
    // Leg 1 — admin control: must grant, with a body to compare
    // against.
    const rAdmin = await req(fetchFn, route, {
      method: 'POST',
      body: markerBody,
      headers: { Authorization: `Bearer ${adminLogin.token}`, Referer: forgedAdminReferer(origin) },
    });
    if (!rAdmin) continue;
    const judgedAdmin = assessAdminResponse(rAdmin.status, rAdmin.text);
    if (judgedAdmin.kind !== 'granted') continue;
    setDiag('controlOk', true);
    // Leg 2 — low-privilege + benign Referer: must be denied.
    const rBenign = await req(fetchFn, route, {
      method: 'POST',
      body: markerBody,
      headers: { Authorization: `Bearer ${lowLogin.token}`, Referer: benignReferer(origin) },
    });
    // Leg 3 — low-privilege + forged Referer: must succeed.
    const rForged = await req(fetchFn, route, {
      method: 'POST',
      body: markerBody,
      headers: { Authorization: `Bearer ${lowLogin.token}`, Referer: forgedAdminReferer(origin) },
    });
    // Leg 4 — repeat of the forged request.
    const rForgedRepeat = await req(fetchFn, route, {
      method: 'POST',
      body: markerBody,
      headers: { Authorization: `Bearer ${lowLogin.token}`, Referer: forgedAdminReferer(origin) },
    });
    // Leg 5 — nonsense control: a random non-admin Referer must
    // be denied.
    const rNonsense = await req(fetchFn, route, {
      method: 'POST',
      body: markerBody,
      headers: { Authorization: `Bearer ${lowLogin.token}`, Referer: nonsenseReferer(origin) },
    });
    attempts += 1;
    setDiag('attempts', attempts);
    const verdict = assessRefererAccess({
      adminKind: judgedAdmin.kind,
      benignKind: rBenign ? assessAdminResponse(rBenign.status, rBenign.text).kind : 'other',
      forgedKind: rForged ? assessAdminResponse(rForged.status, rForged.text).kind : 'other',
      forgedRepeatKind: rForgedRepeat ? assessAdminResponse(rForgedRepeat.status, rForgedRepeat.text).kind : 'other',
      nonsenseKind: rNonsense ? assessAdminResponse(rNonsense.status, rNonsense.text).kind : 'other',
    });
    if (verdict.verdict !== 'confirmed') continue;
    setDiag('bypassKind', 'forged-referer-admin-path');
    findings.push({
      class: 'referer_access_control',
      id: `referer-access-control-${rand()}`,
      title: 'Access control bypass via forged Referer header (admin path)',
      severity: 'high',
      url: route,
      param: 'Referer',
      parameter: 'Referer',
      evidence: ev(
        `POST ${route} as low-privilege user with Referer: ${forgedAdminReferer(origin)} (control: admin 200, benign Referer ${rBenign ? rBenign.status : 'n/a'}, nonsense Referer ${rNonsense ? rNonsense.status : 'n/a'})`,
        `The privileged function executed for a low-privilege session whose Referer was forged to the admin path — HTTP ${rForged.status} with the admin response, reproduced on repeat — while the same request with a benign or nonsense Referer was denied. ${verdict.reason}.`,
        'A low-privilege user can invoke privileged admin functions by forging one header — the Referer check replaces real authorization.',
      ),
    });
    return findings;
  }
  return findings;
}

export const __refererAccessControlMeta = { phases: ['referer-access-control'], depth: ['standard', 'deep'] };
