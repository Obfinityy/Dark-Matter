// Dark Matter rule-based scanner — BOLA probe for sequential /
// numeric object IDs
// (coverage rows #10/#338 [IDOR / BOLA — numeric IDs, CWE-639 |
// OWASP API01:2023; rides the 'idor' phase alongside idorUuid.js,
// which owns the UUID / predictable-token half, row #339).
//
// ORACLE (deterministic, no judge, no LLM, $0): an object
// addressed by a sequential numeric id is readable cross-user
// when a second, unrelated session receives the SAME object. The
// probe runs a THREE-WAY differential on each mined object URL,
// exactly the idorUuid oracle shape:
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
//       requested object id present in the body AS A STRUCTURED
//       ID FIELD — `"id":123`, `"id":"123"`, `data-id="123"`,
//       `/123/` in a same-origin link, or `id=123`. A plain
//       substring match is NOT enough for numeric ids: a bare
//       "123" appears in prices, dates, counts and years all over
//       any page, so a short number without an id field proves
//       nothing. A long body without the id field is a different
//       object (a list page, a generic success stub), not the same
//       object, and a short or filtered answer is the server
//       enforcing something, not a bypass. The first confirmed URL
//       ends the probe (max 1 finding).
// If every URL refuses the other user, that is a proven true
// negative, not a finding.
//
// SEQUENTIAL-NEIGHBOUR LEG: numeric ids are guessable by design,
// so after the mined URLs all refuse, the probe also tries the
// immediate neighbours (id-1, id+1) of the first two mined object
// URLs under the SAME three-way differential — the neighbour is
// confirmed only when the owner control grants it too (the object
// exists and is readable by an authenticated user) AND the
// other-user body carries the neighbour id as a structured id
// field. A neighbour that answers 200 anonymously is public and
// is skipped, exactly as in the mined leg.
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
// CANDIDATES: mined object URLs whose path carries a numeric
// segment (see isNumericObjectIdSegment — a digit run of 1-10
// digits; real lab object ids are often 1-2 digits). Two shapes
// are EXCLUDED from mining, because they are
// not object ids even though they look numeric:
//   - year-like segments (1900-2100): archive / date paths such
//     as /archive/2026 — the "same object" check would be
//     meaningless against a year.
//   - timestamp-like segments (>10 digits): epoch-millis values
//     such as /events/1763088000000.
// The surface half (flagging the shapes as an INFO review
// surface) already lives in probeIdorSurface.
//
// GATES: labCreds + allowWrite + isLabTargetHost (same lab gate
// as bfla / idorUuid); depth 'quick' skips the probe. BOUND: at
// most 10 POSTs (owner login 4, registration 2, other-user
// login 4) and at most 27 GETs (5 mined object URLs x 3 legs,
// plus 2 neighbours x 2 base URLs x 3 legs). Findings are class
// 'idor_numeric' — protocolFor routes any class containing
// 'idor' to the idor protocol, judged on evidence.crossUserRead
// (see differential.js).
//
// HONEST LIMITS: the probe can only test object URLs the crawl
// mined — a lab with no numeric-addressed objects in its crawl
// yields no surface and an honest []. The neighbour leg only
// reaches id±1 of mined objects; it does not enumerate a range.

import { isLabTargetHost } from '../../labCreds.js';
import { loginCandidates } from './sessionFixation.js';
import { extractBearerToken, findRegisterRoutes } from './bfla.js';
import { assessObjectResponse } from './idorUuid.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const TIMEOUT_MS = 15000;
const MAX_OBJECT_URLS = 5;
// Neighbour leg: only the first N mined URLs get id±1 probes.
const MAX_NEIGHBOUR_BASE_URLS = 2;
const MAX_LOGIN_POSTS = 4;
const MAX_TOTAL_POSTS = 10;
// Fixed canary password for the throwaway other-user account —
// never a real password, never derived from a secret.
const LOW_PRIV_PASSWORD = 'dm-idornum-low-pass-01';
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
 * True when a path segment is a numeric object-id shape: a digit
 * run of 1-10 digits that is NOT year-like (1900-2100 — archive
 * / date paths) and NOT timestamp-like (>10 digits — epoch-millis
 * values). Deliberately NOT classifyIdSegment's 3+ digit bar:
 * real lab object ids are often 1-2 digits (Juice basket 1,
 * user 1), and the false-confirm risk of short ids is carried
 * by the structured-id-field check (see numericIdInBody) and
 * the three-way differential, not by the digit length. Pure.
 */
export function isNumericObjectIdSegment(segment) {
  const s = String(segment || '');
  if (!/^\d+$/.test(s)) return false;
  if (s.length > 10) return false;
  const n = Number(s);
  if (n >= 1900 && n <= 2100) return false;
  return true;
}

/**
 * Mine object URLs from the discovered route set: same-origin
 * URLs whose path carries a numeric object-id segment (see
 * isNumericObjectIdSegment). UUID / predictable-token segments
 * are NOT candidates here — idorUuid.js owns that surface. Pure.
 */
export function findNumericObjectUrls(routes, origin) {
  const out = [];
  for (const r of routes || []) {
    try {
      const u = new URL(String(r));
      if (u.origin !== origin) continue;
      let hit = false;
      for (const seg of u.pathname.split('/').filter(Boolean)) {
        if (isNumericObjectIdSegment(seg)) {
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
 * The mined numeric object id of an object URL: the first path
 * segment that is a numeric object-id segment. Returns '' when
 * the URL carries no such segment. Pure.
 */
export function numericIdFromUrl(url) {
  try {
    for (const seg of new URL(String(url)).pathname.split('/').filter(Boolean)) {
      if (isNumericObjectIdSegment(seg)) return seg;
    }
  } catch {
    // ignore malformed URLs
  }
  return '';
}

/**
 * The sequential-neighbour URLs of a mined numeric object URL:
 * the same URL with its numeric id replaced by id-1 (only when
 * id > 1) and id+1. Returns [] when the URL carries no numeric
 * object id. Pure.
 */
export function neighbourUrls(url, objectId) {
  const id = String(objectId || '');
  if (!/^\d+$/.test(id)) return [];
  const n = Number(id);
  const out = [];
  const replaceId = (next) => {
    try {
      const u = new URL(String(url));
      const segs = u.pathname.split('/');
      for (let i = 0; i < segs.length; i += 1) {
        if (segs[i] === id) {
          segs[i] = String(next);
          break;
        }
      }
      u.pathname = segs.join('/');
      return u.toString();
    } catch {
      return null;
    }
  };
  if (n > 1) {
    const prev = replaceId(n - 1);
    if (prev) out.push(prev);
  }
  const next = replaceId(n + 1);
  if (next) out.push(next);
  return out;
}

const ID_FIELD_PATTERNS = (id) => [
  // JSON / form field: "id":123, "id":"123", 'id':123, id=123,
  // "userId":123, "basketId":"123" — any *id field name.
  new RegExp(`["']\\w*[Ii]d["']\\s*[:=]\\s*["']?0*${id}\\b`),
  // Attribute: data-id="123", id="123".
  new RegExp(`(?:data-)?id\\s*=\\s*["']0*${id}\\b`),
  // Same-origin link back to the object: /api/Users/123, /123/
  // followed by a non-digit (so /1234/ never matches id 123).
  new RegExp(`/${id}(?![0-9])`),
];

/**
 * True when the body carries the requested numeric object id as
 * a STRUCTURED id field — a JSON/form field, an id attribute, or
 * a same-origin link to the object. A bare "123" in prose (a
 * price, a count, a date) does NOT count: short numbers collide
 * with everything, so only an id-shaped occurrence is the same
 * object. Pure.
 */
export function numericIdInBody(body, objectId) {
  const id = String(objectId || '');
  const text = bodyText(body);
  if (!/^\d+$/.test(id) || !text) return false;
  return ID_FIELD_PATTERNS(id).some((re) => re.test(text));
}

/**
 * Judge the BOLA differential on one numeric object URL:
 * confirmed only when the owner control was granted AND the
 * other-user replay was granted with a substantive body (at
 * least 50 bytes — a short generic success/empty JSON body is
 * the server filtering, not a bypass, and it must not confirm
 * against a small control body) at least half the control
 * body's length AND the requested object id present in the
 * other-user body as a structured id field (see
 * numericIdInBody — a long body without the id field is a
 * different object, not the same one). Pure.
 */
export function assessIdorNumericFlow(controlKind, otherKind, controlLen, otherLen, objectId, otherBody) {
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
  if (!numericIdInBody(otherBody, objectId)) {
    return {
      verdict: 'rejected',
      reason: 'other-user body does not carry the requested object id as a structured id field — not the same object',
    };
  }
  return {
    verdict: 'confirmed',
    reason: `other user received the same object (${otherLen} bytes vs owner control ${controlLen} bytes, object id ${objectId} present as an id field)`,
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
// Same session model as idorUuid.js / bfla.js.
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

export async function probeIdorNumeric(url, opts = {}) {
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
  const objectUrls = findNumericObjectUrls(routes, origin);
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
  const lowEmail = `dm-idornum-low-${rid}@example.com`;
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

  // One three-way differential on a single object URL. Returns a
  // finding when confirmed, null otherwise. `kind` labels the leg
  // ('mined' or 'sequential-neighbour') for the finding text.
  const differential = async (objectUrl, objectId, kind) => {
    // Leg 1 — no token: an object that answers 200 anonymously is
    // public, not BOLA (missing-auth #47's territory), never a
    // finding.
    const rNoAuth = await req(fetchFn, objectUrl, { method: 'GET' });
    if (rNoAuth) {
      const judgedNoAuth = assessObjectResponse(rNoAuth.status, rNoAuth.text);
      if (judgedNoAuth.kind === 'granted') return null;
    }
    // Leg 2 — owner control: must grant, with a body to compare
    // against.
    const rOwner = await req(fetchFn, objectUrl, {
      method: 'GET',
      headers: { Authorization: `Bearer ${ownerLogin.token}` },
    });
    if (!rOwner) return null;
    const judgedOwner = assessObjectResponse(rOwner.status, rOwner.text);
    if (judgedOwner.kind !== 'granted') return null;
    setDiag('controlOk', true);
    const controlLen = rOwner.text.length;
    // Leg 3 — other-user replay.
    const rOther = await req(fetchFn, objectUrl, {
      method: 'GET',
      headers: { Authorization: `Bearer ${lowLogin.token}` },
    });
    if (!rOther) return null;
    setDiag('attempts', (diag && typeof diag.attempts === 'number' ? diag.attempts : 0) + 1);
    const judgedOther = assessObjectResponse(rOther.status, rOther.text);
    const verdict = assessIdorNumericFlow(
      'granted',
      judgedOther.kind,
      controlLen,
      rOther.text.length,
      objectId,
      rOther.text
    );
    if (verdict.verdict !== 'confirmed') return null;
    setDiag('bypassKind', kind === 'sequential-neighbour' ? 'cross-user-numeric-sequential-read' : 'cross-user-numeric-read');
    const neighbourNote =
      kind === 'sequential-neighbour'
        ? ' — guessed by stepping the sequential id by one, so any user can enumerate other users\' objects'
        : '';
    return {
      class: 'idor_numeric',
      id: `idor-numeric-${kind === 'sequential-neighbour' ? 'seq-' : ''}${objectId}`,
      title: 'BOLA — numeric-ID object readable by another user (Medium)',
      severity: 'medium',
      url: objectUrl,
      parameter: objectId,
      evidence: ev(
        `GET ${objectUrl} with an other-user Bearer token (control: owner 200, no-token ${rNoAuth ? rNoAuth.status : 'n/a'})`,
        `Other-user session received the same object — HTTP 200, ${rOther.text.length} bytes vs owner control ${controlLen} bytes, object id ${objectId} present in the body as a structured id field — the server does not check ownership on this numeric-id object. ${verdict.reason}.${neighbourNote}`,
        'One user can read another user\'s object by guessing its sequential numeric id — cross-account data exposure through an unprotected object reference.',
      ),
    };
  };

  // Part 3 — the three-way differential on each mined object URL.
  // The first confirmed URL ends the probe (max 1 finding).
  for (const objectUrl of objectUrls) {
    const objectId = numericIdFromUrl(objectUrl);
    const found = await differential(objectUrl, objectId, 'mined');
    if (found) {
      findings.push(found);
      return findings;
    }
  }

  // Part 4 — the sequential-neighbour leg: id±1 of the first two
  // mined URLs, same differential. Only reached when no mined URL
  // confirmed.
  let neighbourAttempts = 0;
  for (const objectUrl of objectUrls.slice(0, MAX_NEIGHBOUR_BASE_URLS)) {
    const baseId = numericIdFromUrl(objectUrl);
    for (const nextUrl of neighbourUrls(objectUrl, baseId)) {
      const nextId = numericIdFromUrl(nextUrl);
      neighbourAttempts += 1;
      setDiag('neighbourAttempts', neighbourAttempts);
      const found = await differential(nextUrl, nextId, 'sequential-neighbour');
      if (found) {
        findings.push(found);
        return findings;
      }
    }
  }
  return findings;
}

export const __idorNumericMeta = { phases: ['idor'], depth: ['standard', 'deep'] };
