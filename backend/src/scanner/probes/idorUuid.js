// Dark Matter rule-based scanner — BOLA probe for UUID /
// predictable-token object IDs
// (coverage row #339 [Medium] BOLA — UUID / predictable token
// IDs, CWE-639 | OWASP API01:2023; rides the 'idor' phase).
//
// ORACLE (deterministic, no judge, no LLM, $0): an object
// addressed by a UUID or predictable token is readable
// cross-user when a second, unrelated session receives the SAME
// object. The probe runs a THREE-WAY differential on each mined
// object URL:
//   (1) no-token GET — must be refused (401/403/404 or a refusal
//       message). An object that answers 200 anonymously is
//       public, not BOLA (that is missing-auth #47's territory)
//       and is skipped, never a finding.
//   (2) owner-token GET (control, labCreds session) — must be
//       granted (2xx + a non-empty body with no refusal text). An
//       object the owner session cannot reach is not a valid
//       control and is skipped.
//   (3) other-user-token GET — CONFIRM only when granted (2xx +
//       no refusal text) with a body of at least 50 bytes and at
//       least half the owner control body's length AND the
//       requested object id present in the body — a long body
//       without the id is a different object (a list page, a
//       generic success stub), not the same object, and a short
//       or filtered answer is the server enforcing something, not
//       a bypass. The first confirmed URL ends the probe (max 1
//       finding).
// If every URL refuses the other user, that is a proven true
// negative, not a finding.
//
// The other-user session is a throwaway self-registered lab
// account: POST the mined registration route, then log in with
// the same login candidates as the owner control (the BFLA
// session model, see bfla.js). The registration email carries a
// per-run random suffix so re-runs never collide with an
// existing account; the password is a fixed clearly-fake canary
// value, never a real password. No mined registration route
// means an honest [] — the probe never invents a route.
//
// CANDIDATES: mined object URLs whose path carries a UUID-shaped
// or predictable-token segment (see classifyIdSegment in
// idor.js). Pure numeric ids are NOT candidates here — the
// numeric cross-user differential is rows #10/#338, a follow-up,
// not this lane. The surface half (flagging the shapes as an
// INFO review surface) lives in probeIdorSurface.
//
// GATES: labCreds + allowWrite + isLabTargetHost (same lab gate
// as bfla / basket-logic / workflow-skip); depth 'quick' skips
// the probe. BOUND: at most 10 POSTs (owner login 4,
// registration 2, other-user login 4) and at most 15 GETs
// (5 object URLs x 3 legs). Findings are class 'idor_uuid' —
// protocolFor routes any class containing 'idor' to the idor
// protocol, judged on evidence.crossUserRead (see
// differential.js).
//
// HONEST LIMITS: the probe can only test object URLs the crawl
// mined — a lab with no UUID-addressed objects in its crawl
// yields no surface and an honest []. Pure-predictability
// analysis (sample N ids from the target, test for sequential
// or structured values vs random — entropy sampling) is a
// documented next step, not this lane: this leg proves the
// cross-user ACCESS flaw on UUID/predictable-token objects,
// which is the BOLA half of row #339.

import { isLabTargetHost } from '../../labCreds.js';
import { loginCandidates } from './sessionFixation.js';
import { extractBearerToken, findRegisterRoutes } from './bfla.js';
import { classifyIdSegment } from './idor.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const TIMEOUT_MS = 15000;
const MAX_OBJECT_URLS = 5;
const MAX_LOGIN_POSTS = 4;
const MAX_TOTAL_POSTS = 10;
// Fixed canary password for the throwaway other-user account —
// never a real password, never derived from a secret.
const LOW_PRIV_PASSWORD = 'dm-idoruuid-low-pass-01';
const REFUSAL_TEXT_RE =
  /unauthori[sz]ed|forbidden|access denied|not allowed|admin[ -](required|only)|insufficient (privilege|permission|rights)|requires? (admin|elevated|administrator)|role[ -]?required|must be (an? )?admin/i;

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

function ev(request, response, impact) {
  return { request, response, impact_demo: impact, signalCorrelated: true, crossUserRead: true };
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
 * Mine object URLs from the discovered route set: same-origin
 * URLs whose path carries a UUID-shaped or predictable-token
 * segment (see classifyIdSegment). Pure numeric ids are NOT
 * candidates — rows #10/#338 own that surface. Pure.
 */
export function findObjectUrls(routes, origin) {
  const out = [];
  for (const r of routes || []) {
    try {
      const u = new URL(String(r));
      if (u.origin !== origin) continue;
      let hit = false;
      for (const seg of u.pathname.split('/').filter(Boolean)) {
        const kind = classifyIdSegment(seg);
        if (kind === 'uuid' || kind === 'predictable-token') {
          hit = true;
          break;
        }
      }
      if (!hit) continue;
      const s = stripQuery(u.toString());
      if (!out.includes(s)) out.push(s);
    } catch {
      // ignore malformed route entries
    }
  }
  return out.slice(0, MAX_OBJECT_URLS);
}

/**
 * The mined object id of an object URL: the first path segment
 * whose shape is UUID or predictable-token (the whole segment —
 * for "ord-9f2k7xq4" the segment itself is the id). Returns ''
 * when the URL carries no such segment. Pure.
 */
export function objectIdFromUrl(url) {
  try {
    for (const seg of new URL(String(url)).pathname.split('/').filter(Boolean)) {
      const kind = classifyIdSegment(seg);
      if (kind === 'uuid' || kind === 'predictable-token') return seg;
    }
  } catch {
    // ignore malformed URLs
  }
  return '';
}

/**
 * Judge one object-URL response. Returns { kind, reason } where
 * kind is 'granted' (2xx + a non-empty body with no refusal
 * text — object reads need not be JSON, so an HTML profile page
 * counts), 'refused' (401/403/404, or a refusal message in the
 * body), or 'other' (anything else — 5xx, redirect, empty 2xx).
 * Pure.
 */
export function assessObjectResponse(status, body) {
  const text = bodyText(body);
  if (typeof status === 'number' && (status === 401 || status === 403 || status === 404)) {
    return { kind: 'refused', reason: `object URL answered HTTP ${status}` };
  }
  if (REFUSAL_TEXT_RE.test(text)) {
    return { kind: 'refused', reason: 'object URL response carries a refusal message' };
  }
  if (typeof status === 'number' && status >= 200 && status < 300) {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      return { kind: 'other', reason: 'object URL answered 2xx with an empty body' };
    }
    return { kind: 'granted', reason: `object URL answered HTTP ${status} with a body` };
  }
  return { kind: 'other', reason: `object URL answered HTTP ${status}` };
}

/**
 * Judge the BOLA differential on one object URL: confirmed only
 * when the owner control was granted AND the other-user replay
 * was granted with a substantive body (at least 50 bytes — a
 * short generic success/empty JSON body is the server
 * filtering, not a bypass, and it must not confirm against a
 * small control body) at least half the control body's length
 * AND the requested object id present in the other-user body
 * (a long body without the id is a different object, not the
 * same one). Pure.
 */
export function assessIdorUuidFlow(controlKind, otherKind, controlLen, otherLen, objectId, otherBody) {
  if (controlKind !== 'granted') {
    return { verdict: 'uncalibrated', reason: 'the owner control did not grant the URL — no valid control' };
  }
  if (otherKind === 'refused') {
    return { verdict: 'rejected', reason: 'the other user was refused — authorization holds on this object' };
  }
  if (otherKind !== 'granted') {
    return { verdict: 'uncalibrated', reason: 'the other-user replay was inconclusive on this object' };
  }
  if (otherLen < 50) {
    return {
      verdict: 'rejected',
      reason: `other-user body (${otherLen} bytes) is too short to be the object — the server filtered it`,
    };
  }
  if (otherLen * 2 < controlLen) {
    return {
      verdict: 'rejected',
      reason: `other-user body (${otherLen} bytes) is much smaller than the owner control body (${controlLen} bytes) — the server filtered the response`,
    };
  }
  if (!String(otherBody || '').includes(String(objectId || '')) || !objectId) {
    return {
      verdict: 'rejected',
      reason: 'other-user body does not contain the requested object id — not the same object',
    };
  }
  return {
    verdict: 'confirmed',
    reason: `other user received the same object (${otherLen} bytes vs owner control ${controlLen} bytes, object id present)`,
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
// caller shares one budget across both logins (owner + other user).
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

// Register the throwaway other-user account. One POST per
// candidate, Juice shape {email, password, passwordRepeat}. A
// non-2xx answer means this candidate is not a registration
// endpoint (or the account already exists) — the caller moves on.
async function registerLowPriv(fetchFn, registerUrls, email) {
  let spent = 0;
  for (const registerUrl of registerUrls) {
    if (spent >= 2) return { ok: false, spent };
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

export async function probeIdorUuid(url, opts = {}) {
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
  const routes = (opts.routes || []).map(String);
  const objectUrls = findObjectUrls(routes, origin);
  setDiag('objectUrls', objectUrls.length);
  if (!objectUrls.length) return findings;
  const registerRoutes = findRegisterRoutes(routes, origin);
  if (!registerRoutes.length) return findings;

  let postsSpent = 0;
  // THE TEST, part 1 — the owner control session. Without an owner
  // token there is no control to compare against, so the probe
  // returns [] (uncalibrated, not a finding).
  const loginUrls = loginCandidates(routes, origin);
  if (!loginUrls.length) return findings;
  const ownerLogin = await apiLogin(fetchFn, loginUrls, creds, MAX_LOGIN_POSTS);
  postsSpent += ownerLogin.spent;
  if (!ownerLogin.ok) return findings;

  // Part 2 — the throwaway other-user account. The email carries
  // a per-run random suffix so re-runs never collide with an
  // existing account; the password is the fixed canary value.
  const rid = rand();
  const lowEmail = `dm-idoruuid-low-${rid}@example.com`;
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

  // Part 3 — the three-way differential, one object URL at a time.
  // The first confirmed URL ends the probe (max 1 finding).
  let attempts = 0;
  for (const objectUrl of objectUrls) {
    const objectId = objectIdFromUrl(objectUrl);
    // Leg 1 — no token: an object that answers 200 anonymously is
    // public, not BOLA (missing-auth #47's territory), never a
    // finding.
    const rNoAuth = await req(fetchFn, objectUrl, { method: 'GET' });
    if (rNoAuth) {
      const judgedNoAuth = assessObjectResponse(rNoAuth.status, rNoAuth.text);
      if (judgedNoAuth.kind === 'granted') continue;
    }
    // Leg 2 — owner control: must grant, with a body to compare
    // against.
    const rOwner = await req(fetchFn, objectUrl, {
      method: 'GET',
      headers: { Authorization: `Bearer ${ownerLogin.token}` },
    });
    if (!rOwner) continue;
    const judgedOwner = assessObjectResponse(rOwner.status, rOwner.text);
    if (judgedOwner.kind !== 'granted') continue;
    setDiag('controlOk', true);
    const controlLen = rOwner.text.length;
    // Leg 3 — other-user replay.
    const rOther = await req(fetchFn, objectUrl, {
      method: 'GET',
      headers: { Authorization: `Bearer ${lowLogin.token}` },
    });
    if (!rOther) continue;
    attempts += 1;
    setDiag('attempts', attempts);
    const judgedOther = assessObjectResponse(rOther.status, rOther.text);
    const verdict = assessIdorUuidFlow('granted', judgedOther.kind, controlLen, rOther.text.length, objectId, rOther.text);
    if (verdict.verdict !== 'confirmed') continue;
    setDiag('bypassKind', 'cross-user-uuid-read');
    findings.push({
      class: 'idor_uuid',
      id: `idor-uuid-${objectId}`,
      title: 'BOLA — UUID-addressed object readable by another user (Medium)',
      severity: 'medium',
      url: objectUrl,
      parameter: objectId,
      evidence: ev(
        `GET ${objectUrl} with an other-user Bearer token (control: owner 200, no-token ${rNoAuth ? rNoAuth.status : 'n/a'})`,
        `Other-user session received the same object — HTTP 200, ${rOther.text.length} bytes vs owner control ${controlLen} bytes, object id ${objectId} present in the body — the server does not check ownership on this UUID-addressed object. ${verdict.reason}.`,
        'One user can read another user\'s object by guessing its UUID / predictable token id — cross-account data exposure through an unprotected object reference.',
      ),
    });
    return findings;
  }
  return findings;
}

export const __idorUuidMeta = { phases: ['idor'], depth: ['standard', 'deep'] };
