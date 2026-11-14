// Dark Matter rule-based scanner — BOLA probe for IDOR via
// nested objects / batch requests
// (coverage row #345 [Medium] API — IDOR via nested objects /
// batch requests, CWE-639 | OWASP API01:2023; rides the 'idor'
// phase).
//
// ORACLE (deterministic, no judge, no LLM, $0): an object
// addressed THROUGH a nested path or a batched ID list is
// readable cross-user when a second, unrelated session receives
// the SAME object. The probe runs a THREE-WAY differential per
// candidate — the same shape as the idorUuid leg (row #339),
// but the sink is different: a nested path or a batch endpoint,
// not a flat object URL.
//   (1) no-token request — must be refused (401/403/404 or a
//       refusal message). A candidate that answers 200
//       anonymously is public, not BOLA (missing-auth #47's
//       territory) and is skipped, never a finding.
//   (2) owner-token request (control, labCreds session) — must
//       be granted (2xx + a non-empty body with no refusal
//       text). A candidate the owner session cannot reach is not
//       a valid control and is skipped.
//   (3) other-user-token request — CONFIRM only when granted
//       with the SAME object coming back (see the per-leg
//       assessors below). The first confirmed candidate per leg
//       ends that leg (max 1 nested finding + 1 batch finding —
//       the two classes are distinct sinks, so same-class dedup
//       still holds).
//
// NESTED LEG: candidates are mined routes whose path carries
// TWO OR MORE id-shaped segments (see classifyIdSegment in
// idor.js), e.g. /api/users/{ownId}/orders/{otherId} or
// /api/accounts/{ownId}/documents/{otherId}. Many servers check
// only the OUTER id (or only the inner one) — the nested path
// is the bypass. When the owner's own id can be learned from a
// self endpoint (/api/users/me, /rest/user/whoami, ...), the
// probe ALSO builds the swapped variant — outer := owner's own
// id, inner := the foreign id from the mined route — and tests
// that first: the other user receiving an object nested under
// the OWNER's own id is the nested-specific proof. When no self
// id is learnable, the mined URL itself is tested (same
// three-way differential, nested path). Confirm rule (shared
// with idorUuid): other-user body >= 50 bytes and >= half the
// owner control body's length AND the inner object id present
// in the body — a long body without the id is a different
// object, not the same one.
//
// BATCH LEG: candidates are mined routes that look like batch
// endpoints — a path segment batch/bulk/multi/fetch-many, or a
// query parameter named ids/id/objectIds/itemIds. The foreign
// object id comes from the mined object ids (any id-shaped
// segment in the route set). The probe POSTs one envelope per
// attempt — {"ids":[id]}, {"id":[id]}, {"items":[id]} — and
// confirms ONLY when the other-user batch response returns the
// foreign object: 2xx + no refusal text + the object id present
// in an OBJECT context ("id":"<id>") or a substantive body (>=
// 50 bytes). A bare echo of the requested ids ({"requested":
// [id]}) never confirms — that is the server parroting the
// request, not returning the object.
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
// GATES: labCreds + allowWrite + isLabTargetHost (same lab gate
// as bfla / idorUuid / basket-logic); depth 'quick' skips the
// probe. BOUND: at most 10 POSTs (owner login 4, registration
// 2, other-user login 4), at most 15 nested GETs (5 nested
// URLs x 3 legs) + 7 self-endpoint GETs + at most 27 batch
// POSTs (3 endpoints x 3 envelopes x 3 legs). Findings are
// class 'idor_nested' / 'idor_batch' — protocolFor routes any
// class containing 'idor' to the idor protocol, judged on
// evidence.crossUserRead (see differential.js).
//
// HONEST LIMITS: the probe can only test nested paths and batch
// endpoints the crawl mined — a lab with no nested object URLs
// or batch endpoints in its crawl yields no surface and an
// honest []. A batch endpoint whose array key is not one of the
// three envelopes is missed (documented next step: mine the
// key from OpenAPI / JS bundles). Row #385 (GraphQL mutation
// BOLA) is a different leg, already closed by PR #518 — this
// file tests REST object access, not GraphQL query shape.

import { isLabTargetHost } from '../../labCreds.js';
import { loginCandidates } from './sessionFixation.js';
import { extractBearerToken, findRegisterRoutes } from './bfla.js';
import { classifyIdSegment } from './idor.js';
import { assessObjectResponse, assessIdorUuidFlow } from './idorUuid.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const TIMEOUT_MS = 15000;
const MAX_NESTED_URLS = 5;
const MAX_BATCH_ENDPOINTS = 3;
const MAX_OBJECT_IDS = 5;
const MAX_LOGIN_POSTS = 4;
const MAX_TOTAL_POSTS = 10;
const MAX_NESTED_GETS = 15;
const MAX_SELF_GETS = 7;
// Fixed canary password for the throwaway other-user account —
// never a real password, never derived from a secret.
const LOW_PRIV_PASSWORD = 'dm-nestedbatch-low-pass-01';
const REFUSAL_TEXT_RE =
  /unauthori[sz]ed|forbidden|access denied|not allowed|admin[ -](required|only)|insufficient (privilege|permission|rights)|requires? (admin|elevated|administrator)|role[ -]?required|must be (an? )?admin/i;

// Path segments that mark a batch endpoint.
const BATCH_SEGMENT_RE = /^(batch|bulk|multi|fetch-many|batch-get|batchGet)$/i;
// Query parameter names that mark a batch endpoint.
const BATCH_PARAM_RE = /^(ids?|objectIds?|itemIds?)$/i;
// Self endpoints that reveal the caller's own id (owner token).
const SELF_PATHS = [
  '/api/users/me',
  '/rest/user/whoami',
  '/api/me',
  '/api/users/self',
  '/api/profile',
  '/api/account',
  '/rest/user/me',
];
const SELF_ID_KEYS = ['id', '_id', 'userId', 'user_id'];

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

// ---- pure helpers (exported for unit tests) ---------------------------------

/**
 * Mine nested-object URLs from the discovered route set:
 * same-origin URLs whose path carries TWO OR MORE id-shaped
 * segments (uuid / predictable-token / numeric — see
 * classifyIdSegment). Pure.
 */
export function findNestedObjectUrls(routes, origin) {
  const out = [];
  for (const r of routes || []) {
    try {
      const u = new URL(String(r));
      if (u.origin !== origin) continue;
      let ids = 0;
      for (const seg of u.pathname.split('/').filter(Boolean)) {
        if (classifyIdSegment(seg)) ids += 1;
      }
      if (ids < 2) continue;
      const s = stripQuery(u.toString());
      if (!out.includes(s)) out.push(s);
    } catch {
      // ignore malformed route entries
    }
  }
  return out.slice(0, MAX_NESTED_URLS);
}

/**
 * The outer and inner object ids of a nested URL: the FIRST and
 * LAST id-shaped path segments. Returns {outer, inner} with ''
 * for a missing side. Pure.
 */
export function nestedIdsFromUrl(url) {
  const ids = [];
  try {
    for (const seg of new URL(String(url)).pathname.split('/').filter(Boolean)) {
      if (classifyIdSegment(seg)) ids.push(seg);
    }
  } catch {
    // ignore malformed URLs
  }
  return { outer: ids[0] || '', inner: ids.length ? ids[ids.length - 1] : '' };
}

/**
 * Build the outer-swapped variant of a nested URL: the outer
 * (first) id segment is replaced with the caller's own id, the
 * inner (foreign) id is kept. Returns the swapped URL string,
 * or '' when the URL has no outer id segment to swap. Pure.
 */
export function swapOuterId(url, ownId) {
  try {
    const u = new URL(String(url));
    const segs = u.pathname.split('/').filter(Boolean);
    let swapped = false;
    for (let i = 0; i < segs.length; i += 1) {
      if (classifyIdSegment(segs[i])) {
        segs[i] = String(ownId);
        swapped = true;
        break;
      }
    }
    if (!swapped) return '';
    u.pathname = `/${segs.join('/')}`;
    return u.toString();
  } catch {
    return '';
  }
}

/**
 * Mine batch endpoints from the discovered route set:
 * same-origin URLs whose path carries a batch/bulk/multi
 * segment, or whose query carries an ids/id/objectIds/itemIds
 * parameter. Pure.
 */
export function findBatchEndpoints(routes, origin) {
  const out = [];
  for (const r of routes || []) {
    try {
      const u = new URL(String(r));
      if (u.origin !== origin) continue;
      const segs = u.pathname.split('/').filter(Boolean);
      const bySegment = segs.some((s) => BATCH_SEGMENT_RE.test(s));
      let byParam = false;
      for (const name of u.searchParams.keys()) {
        if (BATCH_PARAM_RE.test(name)) {
          byParam = true;
          break;
        }
      }
      if (!bySegment && !byParam) continue;
      const s = stripQuery(u.toString());
      if (!out.includes(s)) out.push(s);
    } catch {
      // ignore malformed route entries
    }
  }
  return out.slice(0, MAX_BATCH_ENDPOINTS);
}

/**
 * Mine object ids from the discovered route set: every id-shaped
 * path segment (uuid / predictable-token / numeric) on a
 * same-origin route, deduplicated. The first is the batch leg's
 * foreign id. Pure.
 */
export function findObjectIds(routes, origin) {
  const out = [];
  for (const r of routes || []) {
    try {
      const u = new URL(String(r));
      if (u.origin !== origin) continue;
      for (const seg of u.pathname.split('/').filter(Boolean)) {
        if (!classifyIdSegment(seg)) continue;
        if (!out.includes(seg)) out.push(seg);
        if (out.length >= MAX_OBJECT_IDS) return out;
      }
    } catch {
      // ignore malformed route entries
    }
  }
  return out;
}

/**
 * The batch request envelopes the probe tries, in order. The
 * array key is the only thing that varies — the object id list
 * is always a single foreign id. Pure.
 */
export function batchRequestBodies(objectId) {
  return [{ ids: [objectId] }, { id: [objectId] }, { items: [objectId] }];
}

/**
 * Parse a self-endpoint response body for the caller's own id:
 * a top-level or one-level-deep id/_id/userId/user_id string or
 * number. Returns the id as a string, or '' when none is
 * present. Pure.
 */
export function selfIdFromBody(body) {
  let j = null;
  try {
    j = typeof body === 'string' ? JSON.parse(body) : body;
  } catch {
    return '';
  }
  if (!j || typeof j !== 'object') return '';
  for (const k of SELF_ID_KEYS) {
    const v = j[k];
    if (typeof v === 'string' && v) return v;
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  for (const v of Object.values(j)) {
    if (v && typeof v === 'object') {
      for (const k of SELF_ID_KEYS) {
        const inner = v[k];
        if (typeof inner === 'string' && inner) return inner;
        if (typeof inner === 'number' && Number.isFinite(inner)) return String(inner);
      }
    }
  }
  return '';
}

/**
 * Judge one batch-endpoint response for the requested object.
 * Returns { kind, reason } where kind is 'granted' (2xx + a
 * non-empty body with no refusal text AND the object id present
 * in an OBJECT context — "id":"<id>" — or a substantive body of
 * >= 50 bytes; a bare echo of the requested ids never grants),
 * 'refused' (401/403/404, or a refusal message in the body), or
 * 'other' (anything else). Pure.
 */
export function assessBatchResponse(status, body, objectId) {
  const text = body == null ? '' : typeof body === 'string' ? body : JSON.stringify(body);
  if (typeof status === 'number' && (status === 401 || status === 403 || status === 404)) {
    return { kind: 'refused', reason: `batch endpoint answered HTTP ${status}` };
  }
  if (REFUSAL_TEXT_RE.test(text)) {
    return { kind: 'refused', reason: 'batch response carries a refusal message' };
  }
  if (typeof status === 'number' && status >= 200 && status < 300) {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      return { kind: 'other', reason: 'batch endpoint answered 2xx with an empty body' };
    }
    if (!objectId || !text.includes(String(objectId))) {
      return { kind: 'other', reason: 'batch response does not contain the requested object id' };
    }
    const inObjectContext = new RegExp(`"id"\\s*:\\s*"${String(objectId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`).test(text);
    if (inObjectContext || trimmed.length >= 50) {
      return { kind: 'granted', reason: `batch endpoint answered HTTP ${status} with the object in the body` };
    }
    return {
      kind: 'other',
      reason: 'batch response echoes the requested id without returning the object',
    };
  }
  return { kind: 'other', reason: `batch endpoint answered HTTP ${status}` };
}

/**
 * Judge the batch differential: confirmed only when the owner
 * control was granted AND the other-user batch was granted with
 * the foreign object in the response. An other-user refusal is
 * a proven true negative, not a finding. Pure.
 */
export function assessBatchFlow(controlKind, otherKind) {
  if (controlKind !== 'granted') {
    return { verdict: 'uncalibrated', reason: 'the owner control batch did not return the object — no valid control' };
  }
  if (otherKind === 'refused') {
    return { verdict: 'rejected', reason: 'the other user was refused by the batch endpoint — authorization holds' };
  }
  if (otherKind !== 'granted') {
    return { verdict: 'uncalibrated', reason: 'the other-user batch was inconclusive' };
  }
  return {
    verdict: 'confirmed',
    reason: 'other-user batch response returned the foreign object',
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

// Learn the owner session's own id from the self endpoints, in
// order. Returns the id string, or '' when no self endpoint
// yields one. Read-only GETs, owner token only, capped at
// MAX_SELF_GETS. Never throws.
async function learnOwnId(fetchFn, origin, ownerToken) {
  for (const p of SELF_PATHS.slice(0, MAX_SELF_GETS)) {
    const r = await req(fetchFn, origin + p, {
      method: 'GET',
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    if (!r || r.status < 200 || r.status >= 300) continue;
    const id = selfIdFromBody(r.text);
    if (id) return id;
  }
  return '';
}

// ---- the probe ---------------------------------------------------------------

export async function probeNestedBatchIdor(url, opts = {}) {
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
  const nestedUrls = findNestedObjectUrls(routes, origin);
  const batchEndpoints = findBatchEndpoints(routes, origin);
  const objectIds = findObjectIds(routes, origin);
  setDiag('nestedObjectUrls', nestedUrls.length);
  setDiag('batchEndpoints', batchEndpoints.length);
  if (!nestedUrls.length && !batchEndpoints.length) return findings;
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
  const lowEmail = `dm-nestedbatch-low-${rid}@example.com`;
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

  const ownerHeaders = { Authorization: `Bearer ${ownerLogin.token}` };
  const lowHeaders = { Authorization: `Bearer ${lowLogin.token}` };
  let attempts = 0;

  // Part 3 — the NESTED leg: the three-way differential on each
  // mined nested URL (outer-swapped variant first when the
  // owner's own id was learned). The first confirmed URL ends
  // the leg (max 1 nested finding).
  if (nestedUrls.length) {
    const ownId = await learnOwnId(fetchFn, origin, ownerLogin.token);
    let getsSpent = 0;
    for (const minedUrl of nestedUrls) {
      if (getsSpent >= MAX_NESTED_GETS) break;
      const { outer, inner } = nestedIdsFromUrl(minedUrl);
      let candidateUrl = minedUrl;
      let swapped = false;
      if (ownId && ownId !== outer) {
        const s = swapOuterId(minedUrl, ownId);
        if (s && s !== minedUrl) {
          candidateUrl = s;
          swapped = true;
        }
      }
      setDiag('nestedSwapOk', swapped);
      // Leg 1 — no token: an object that answers 200 anonymously
      // is public, not BOLA (missing-auth #47's territory), never
      // a finding.
      const rNoAuth = await req(fetchFn, candidateUrl, { method: 'GET' });
      getsSpent += 1;
      if (rNoAuth) {
        const judgedNoAuth = assessObjectResponse(rNoAuth.status, rNoAuth.text);
        if (judgedNoAuth.kind === 'granted') continue;
      }
      // Leg 2 — owner control: must grant, with a body to
      // compare against.
      const rOwner = await req(fetchFn, candidateUrl, { method: 'GET', headers: ownerHeaders });
      getsSpent += 1;
      if (!rOwner) continue;
      const judgedOwner = assessObjectResponse(rOwner.status, rOwner.text);
      if (judgedOwner.kind !== 'granted') continue;
      setDiag('controlOk', true);
      const controlLen = rOwner.text.length;
      // Leg 3 — other-user replay.
      const rOther = await req(fetchFn, candidateUrl, { method: 'GET', headers: lowHeaders });
      getsSpent += 1;
      if (!rOther) continue;
      attempts += 1;
      setDiag('attempts', attempts);
      const judgedOther = assessObjectResponse(rOther.status, rOther.text);
      const verdict = assessIdorUuidFlow(
        'granted',
        judgedOther.kind,
        controlLen,
        rOther.text.length,
        inner,
        rOther.text
      );
      if (verdict.verdict !== 'confirmed') continue;
      setDiag('bypassKind', 'cross-user-nested-read');
      findings.push({
        class: 'idor_nested',
        id: `idor-nested-${inner}`,
        title: 'BOLA — nested object readable by another user (Medium)',
        severity: 'medium',
        url: candidateUrl,
        parameter: inner,
        evidence: ev(
          `GET ${candidateUrl} with an other-user Bearer token (control: owner 200, no-token ${rNoAuth ? rNoAuth.status : 'n/a'}${swapped ? `; outer id swapped to the owner's own id ${ownId}` : ''})`,
          `Other-user session received the same nested object — HTTP 200, ${rOther.text.length} bytes vs owner control ${controlLen} bytes, inner object id ${inner} present in the body — the server does not check ownership on this nested object path. ${verdict.reason}.`,
          'One user can read another user\'s object through a nested path (outer id is not enforced, or the inner id is not checked against the outer owner) — cross-account data exposure through an unprotected nested object reference.',
        ),
      });
      break;
    }
  }

  // Part 4 — the BATCH leg: the three-way differential on each
  // mined batch endpoint (one envelope at a time). The first
  // confirmed envelope ends the leg (max 1 batch finding). The
  // foreign object id comes from the mined object ids; without
  // one the leg cannot calibrate and is skipped.
  if (batchEndpoints.length && objectIds.length) {
    const foreignId = objectIds[0];
    for (const endpoint of batchEndpoints) {
      let confirmedHere = false;
      for (const envelope of batchRequestBodies(foreignId)) {
        // Leg 1 — no token: a batch that answers the foreign
        // object anonymously is public, not BOLA.
        const rNoAuth = await req(fetchFn, endpoint, { method: 'POST', body: envelope });
        if (rNoAuth) {
          const judgedNoAuth = assessBatchResponse(rNoAuth.status, rNoAuth.text, foreignId);
          if (judgedNoAuth.kind === 'granted') {
            confirmedHere = false;
            break;
          }
        }
        // Leg 2 — owner control: must return the object. A
        // control failure means this envelope key is wrong —
        // try the next one.
        const rOwner = await req(fetchFn, endpoint, { method: 'POST', body: envelope, headers: ownerHeaders });
        if (!rOwner) continue;
        const judgedOwner = assessBatchResponse(rOwner.status, rOwner.text, foreignId);
        if (judgedOwner.kind !== 'granted') continue;
        setDiag('controlOk', true);
        // The key is proven by the granted control, so this
        // envelope decides the endpoint either way — a
        // non-confirming other-user answer is a verdict on the
        // endpoint, not on the key.
        const rOther = await req(fetchFn, endpoint, { method: 'POST', body: envelope, headers: lowHeaders });
        if (!rOther) break;
        attempts += 1;
        setDiag('attempts', attempts);
        const judgedOther = assessBatchResponse(rOther.status, rOther.text, foreignId);
        const verdict = assessBatchFlow('granted', judgedOther.kind);
        if (verdict.verdict !== 'confirmed') break;
        setDiag('bypassKind', 'cross-user-batch-read');
        findings.push({
          class: 'idor_batch',
          id: `idor-batch-${foreignId}`,
          title: 'BOLA — batch request returns another user\'s object (Medium)',
          severity: 'medium',
          url: endpoint,
          parameter: foreignId,
          evidence: ev(
            `POST ${endpoint} ${JSON.stringify(envelope)} with an other-user Bearer token (control: owner batch returned the object, no-token ${rNoAuth ? rNoAuth.status : 'n/a'})`,
            `Other-user batch response returned the foreign object — HTTP 200 with object id ${foreignId} in the body — the batch endpoint does not check ownership on the requested ids. ${verdict.reason}.`,
            'One user can read another user\'s objects by listing their ids in a single batch request — the batch endpoint skips the per-object authorization the single-object read enforces.',
          ),
        });
        confirmedHere = true;
        break;
      }
      if (confirmedHere) break;
    }
  }
  return findings;
}

export const __nestedBatchIdorMeta = { phases: ['idor'], depth: ['standard', 'deep'] };
