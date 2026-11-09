// Dark Matter rule-based scanner — insecure provisioning / role
// definition probe
// (coverage rows #171 [Medium] Insecure Account Provisioning /
// Deprovisioning and #172 [Medium] Role Definition Flaws,
// WSTG-IDNT; phase 111, 'provisioning'.)
//
// ORACLE (deterministic, no judge, no LLM, $0): a freshly
// self-registered account must land in an unprivileged role. The
// rows' lab note names exactly the observable test: "register and
// check the default role is not privileged". The probe runs THREE
// legs against the same throwaway account, and confirms on the
// FIRST leg that proves privilege — max 1 finding:
//   (A) registration response — the created-user object the server
//       returns must not carry a privileged role marker (role:
//       'admin', isAdmin: true, ...). Juice returns role:
//       'customer' here; anything privileged confirms.
//   (B) issued token — the fresh login's JWT payload (base64url,
//       no key needed) must not carry a privileged role claim.
//       An opaque token skips this leg, it never confirms on its
//       own.
//   (C) admin-route replay — the fresh token must not be granted
//       an admin-only function. Same three-way differential as
//       bfla (#340): no-token GET must refuse (a 200 there is
//       public, not provisioning), admin-token GET is the control
//       (must grant with a substantive body), fresh-token GET
//       confirms only when granted with a body at least half the
//       control body's length (bfla's assessBflaFlow).
// If every leg shows an unprivileged role, that is a proven true
// negative, not a finding. No registration surface at all (DVWA
// has none — no self-registration form or API) is an honest []
// with registerRoutes 0 in diagnostics.
//
// The throwaway account is a per-run random email so re-runs never
// collide with an existing account; the password is a fixed
// clearly-fake canary value, never a real password.
//
// GATES: labCreds + allowWrite + isLabTargetHost (same lab gate as
// bfla / basket-logic / workflow-skip); depth 'quick' skips the
// probe. BOUND: at most 10 POSTs (registration 2, fresh login 4,
// admin login 4) and at most 9 GETs (3 admin routes x 3 legs).
// Findings are class 'insecure_provisioning' — the DEFAULT
// protocol judges signalCorrelated (see differential.js; same
// pattern as document-domain's sop_domain_relaxation).

import { isLabTargetHost } from '../../labCreds.js';
import { loginCandidates } from './sessionFixation.js';
import {
  findRegisterRoutes,
  findAdminRoutes,
  assessAdminResponse,
  assessBflaFlow,
  extractBearerToken,
} from './bfla.js';
import { decodeJwtPayload } from './jwtClaims.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const TIMEOUT_MS = 15000;
const MAX_ADMIN_ROUTES = 3;
const MAX_LOGIN_POSTS = 4;
const MAX_TOTAL_POSTS = 10;
// Fixed canary password for the throwaway account — never a real
// password, never derived from a secret.
const PROV_PASSWORD = 'dm-prov-low-pass-01';
// Role-ish keys, normalised (lowercased, non-alphanumerics
// stripped) before matching: 'userRole', 'user_role' and
// 'user-role' all normalise to 'userrole'.
const ROLE_KEY_SET = new Set([
  'role',
  'userrole',
  'isadmin',
  'admin',
  'privilege',
  'privileges',
  'usertype',
  'accounttype',
]);
// String role values that are privileged by definition. Matching
// is whole-value, case-insensitive: 'admin2' or 'administrator2'
// are not privileged, 'Admin' is.
const PRIVILEGED_ROLE_RE = /^(admin|administrator|root|superuser|superadmin|super-admin|owner|system)$/i;

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

function ev(request, response, impact) {
  return { request, response, impact_demo: impact, signalCorrelated: true };
}

function normKey(key) {
  return String(key || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

// ---- pure helpers (exported for unit tests) ---------------------------------

/**
 * Recursively walk a parsed JSON value (depth ≤ 3) and collect
 * role-ish markers: { key, value } for every key that normalises
 * to a role key. A marker is privileged when its value is a
 * privileged role string, when an isAdmin/admin key is boolean
 * true, or when a privilege(s) array holds a privileged string.
 * Returns { markers, privileged, role } where role is the first
 * string role value seen (e.g. 'customer') or null. Pure.
 */
export function findRoleMarkers(node, depth = 0, out = null) {
  const acc = out || { markers: [], privileged: false, role: null };
  if (!node || typeof node !== 'object' || depth > 3) return acc;
  for (const [key, value] of Object.entries(node)) {
    const nk = normKey(key);
    if (ROLE_KEY_SET.has(nk)) {
      acc.markers.push({ key, value });
      if (typeof value === 'string') {
        if (acc.role === null) acc.role = value;
        if (PRIVILEGED_ROLE_RE.test(value.trim())) acc.privileged = true;
      } else if (value === true && (nk === 'isadmin' || nk === 'admin')) {
        acc.privileged = true;
      } else if (Array.isArray(value)) {
        for (const v of value) {
          if (typeof v === 'string' && PRIVILEGED_ROLE_RE.test(v.trim())) acc.privileged = true;
        }
      }
    }
    if (value && typeof value === 'object') findRoleMarkers(value, depth + 1, acc);
  }
  return acc;
}

/**
 * Judge a registration response. Returns { kind, role, reason }
 * where kind is 'privileged' (the created-user object carries a
 * privileged role marker), 'ok' (2xx, no privileged marker — role
 * is the observed role string or null), or 'other' (non-2xx, or
 * an unparseable body — the registration did not produce a usable
 * account record). Pure.
 */
export function assessRegistrationResponse(status, body) {
  if (typeof status !== 'number' || status < 200 || status >= 300) {
    return { kind: 'other', role: null, reason: `registration answered HTTP ${status}` };
  }
  let parsed = null;
  try {
    parsed = typeof body === 'string' ? JSON.parse(body) : body;
  } catch {
    return { kind: 'other', role: null, reason: 'registration answered 2xx with an unparseable body' };
  }
  if (!parsed || typeof parsed !== 'object') {
    return { kind: 'other', role: null, reason: 'registration answered 2xx with a non-object body' };
  }
  const found = findRoleMarkers(parsed);
  if (found.privileged) {
    const hit = found.markers.find(
      (m) =>
        (typeof m.value === 'string' && PRIVILEGED_ROLE_RE.test(m.value.trim())) ||
        m.value === true ||
        (Array.isArray(m.value) && m.value.some((v) => typeof v === 'string' && PRIVILEGED_ROLE_RE.test(v.trim())))
    );
    return {
      kind: 'privileged',
      role: found.role,
      reason: `registration response carries a privileged role marker (${hit ? hit.key : 'role'}: ${JSON.stringify(hit ? hit.value : null)})`,
    };
  }
  return {
    kind: 'ok',
    role: found.role,
    reason:
      found.role === null
        ? 'registration response carries no role marker — no privilege observable'
        : `registration response shows an unprivileged role (${found.role})`,
  };
}

/**
 * Judge the token issued to the fresh account. A decodable JWT
 * whose payload carries a privileged role claim confirms; an
 * opaque token (or a JWT with an unprivileged role) is 'ok' with
 * the observed role; an undecodable token is 'other'. Pure.
 */
export function assessProvisionedToken(token) {
  const payload = decodeJwtPayload(token);
  if (!payload) {
    return { kind: 'other', role: null, reason: 'issued token is not a decodable JWT — no role claim observable' };
  }
  const found = findRoleMarkers(payload);
  if (found.privileged) {
    return {
      kind: 'privileged',
      role: found.role,
      reason: `issued JWT payload carries a privileged role claim (role: ${JSON.stringify(found.role)})`,
    };
  }
  return {
    kind: 'ok',
    role: found.role,
    reason:
      found.role === null
        ? 'issued JWT payload carries no role claim — no privilege observable'
        : `issued JWT payload shows an unprivileged role (${found.role})`,
  };
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
// caller shares one budget across both logins (fresh + admin).
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

// ---- the probe ---------------------------------------------------------------

export async function probeProvisioning(url, opts = {}) {
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
  const registerRoutes = findRegisterRoutes(routes, origin);
  setDiag('registerRoutes', registerRoutes.length);
  if (!registerRoutes.length) return findings;
  const adminRoutes = findAdminRoutes(routes, origin).slice(0, MAX_ADMIN_ROUTES);
  setDiag('adminRoutes', adminRoutes.length);

  let postsSpent = 0;
  // THE TEST, leg A — register the throwaway account and read the
  // role the server assigns it. One POST per candidate, Juice
  // shape {email, password, passwordRepeat}.
  const rid = rand();
  const freshEmail = `dm-prov-low-${rid}@example.com`;
  let registered = null;
  let registerUrl = null;
  for (const candidate of registerRoutes) {
    if (postsSpent >= 2) break;
    const r = await req(fetchFn, candidate, {
      method: 'POST',
      body: { email: freshEmail, password: PROV_PASSWORD, passwordRepeat: PROV_PASSWORD },
    });
    postsSpent += 1;
    if (!r) break;
    if (r.status >= 200 && r.status < 300) {
      registered = r;
      registerUrl = candidate;
      break;
    }
  }
  setDiag('registerOk', Boolean(registered));
  if (!registered) return findings;
  const judgedReg = assessRegistrationResponse(registered.status, registered.text);
  if (judgedReg.role !== null) setDiag('roleClaim', judgedReg.role);
  if (judgedReg.kind === 'privileged') {
    setDiag('bypassKind', 'privileged-role');
    findings.push({
      class: 'insecure_provisioning',
      id: `provisioning-privileged-role-${rand()}`,
      title: 'Insecure provisioning — freshly registered account created with a privileged role (MEDIUM)',
      severity: 'medium',
      url: registerUrl,
      parameter: 'role',
      evidence: ev(
        `POST ${registerUrl} with a fresh self-registration (email dm-prov-low-…@example.com, no role requested)`,
        `The server created the account with a privileged role — ${judgedReg.reason}. A self-registered account must land in an unprivileged role; a privileged default means anyone who signs up is an admin.`,
        'Anyone who self-registers gets a privileged role — full admin access without any approval step, so the application is admin-compromised from its public signup form.',
      ),
    });
    return findings;
  }

  // Leg B — log in as the fresh account and read the role claim
  // the server issues in its token. A privileged claim confirms
  // even when the registration response hid the role.
  const loginUrls = loginCandidates(routes, origin);
  if (!loginUrls.length) return findings;
  const freshLogin = await apiLogin(
    fetchFn,
    loginUrls,
    { username: freshEmail, password: PROV_PASSWORD },
    Math.min(MAX_LOGIN_POSTS, MAX_TOTAL_POSTS - postsSpent)
  );
  postsSpent += freshLogin.spent;
  if (!freshLogin.ok) return findings;
  const judgedToken = assessProvisionedToken(freshLogin.token);
  if (judgedToken.role !== null) setDiag('roleClaim', judgedToken.role);
  if (judgedToken.kind === 'privileged') {
    setDiag('bypassKind', 'privileged-token-claim');
    findings.push({
      class: 'insecure_provisioning',
      id: `provisioning-privileged-token-${rand()}`,
      title: 'Insecure provisioning — freshly registered account issued a token carrying a privileged role (MEDIUM)',
      severity: 'medium',
      url: loginUrls[0],
      parameter: 'role',
      evidence: ev(
        `POST ${loginUrls[0]} as the freshly registered account, then decoded the issued JWT payload (base64url, no key needed)`,
        `The issued token carries a privileged role — ${judgedToken.reason}. The registration response showed an unprivileged role (${judgedReg.role === null ? 'none' : judgedReg.role}), so the privilege lives in the token the server issues, not in the stored record.`,
        'The fresh account’s session token claims a privileged role — every request it makes is authorised as an admin, so the application is admin-compromised from its public signup form.',
      ),
    });
    return findings;
  }

  // Leg C — admin-route replay with the fresh token. Same
  // three-way differential as bfla: no-token GET must refuse, the
  // admin-token GET is the control, and the fresh-token GET
  // confirms only when granted with a substantive body. Needs an
  // admin session (lab creds) for the control and at least one
  // mined admin route; without either, legs A + B already proved
  // the true negative.
  if (!adminRoutes.length) return findings;
  if (postsSpent >= MAX_TOTAL_POSTS) return findings;
  const adminLogin = await apiLogin(
    fetchFn,
    loginUrls,
    creds,
    Math.min(MAX_LOGIN_POSTS, MAX_TOTAL_POSTS - postsSpent)
  );
  postsSpent += adminLogin.spent;
  if (!adminLogin.ok) return findings;

  let attempts = 0;
  for (const route of adminRoutes) {
    // Leg 1 — no token: a route that answers 200 anonymously is
    // public, not provisioning (missing-auth #47's territory),
    // never a finding.
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
    // Leg 3 — fresh-token replay.
    const rLow = await req(fetchFn, route, {
      method: 'GET',
      headers: { Authorization: `Bearer ${freshLogin.token}` },
    });
    if (!rLow) continue;
    attempts += 1;
    setDiag('attempts', attempts);
    const judgedLow = assessAdminResponse(rLow.status, rLow.text);
    const verdict = assessBflaFlow('granted', judgedLow.kind, controlLen, rLow.text.length);
    if (verdict.verdict !== 'confirmed') continue;
    setDiag('bypassKind', 'fresh-token-admin-route');
    findings.push({
      class: 'insecure_provisioning',
      id: `provisioning-fresh-admin-route-${rand()}`,
      title: 'Insecure provisioning — freshly registered account can call an admin-only function (MEDIUM)',
      severity: 'medium',
      url: route,
      parameter: 'Authorization',
      evidence: ev(
        `GET ${route} with the freshly registered account's Bearer token (control: admin 200, no-token ${rNoAuth ? rNoAuth.status : 'n/a'})`,
        `The fresh account received the admin-only response — HTTP 200, ${rLow.text.length} bytes vs admin control ${controlLen} bytes, same admin data. ${verdict.reason}. The registration response and the issued token both showed an unprivileged role, so the privilege is in the role definition itself: the fresh account's role is granted admin functions.`,
        'A self-registered account can invoke admin functions — enumerate all users / read admin-only data without ever being granted the admin role, so the role definition is broken at provisioning time.',
      ),
    });
    return findings;
  }
  return findings;
}

export const __provisioningMeta = { phases: ['provisioning'], depth: ['standard', 'deep'] };
