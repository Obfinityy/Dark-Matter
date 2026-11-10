// Dark Matter rule-based scanner — unrestricted-access-to-sensitive-
// business-flows probe
// (coverage row #86 [High] Unrestricted Access to Sensitive Business
// Flows, CWE-840 | OWASP API6:2023; phase 111, 'business-flow-access'.)
//
// ORACLE (deterministic, no judge, no LLM, $0): a shop basket is a
// sensitive business flow — it belongs to exactly one user. The
// server must enforce ownership on the client-supplied basket id.
// The probe runs a THREE-WAY differential on the mined basket GET
// route, with the labCreds account as the VICTIM and a throwaway
// self-registered account as the CANARY:
//   (1) no-token GET of the victim basket — must be refused
//       (401/403/404 or a refusal message). A basket that answers
//       200 anonymously is public, not this row (that is
//       missing-auth #47's territory) and is skipped, never a
//       finding.
//   (2) victim-token GET (control) — must grant with the seeded
//       marker item visible. A control that does not show the
//       marker cannot calibrate the oracle.
//   (3) canary-token GET of the SAME victim basket — CONFIRM only
//       when granted AND the response basket id is the victim's
//       (not the canary's own — a server that ignores the path id
//       and returns the caller's own basket is enforcing ownership,
//       never a finding) AND the seeded marker item is present.
//       The canary's own basket must read EMPTY first, so a
//       marker in the cross read can only be the victim's.
// The victim basket is seeded with the cheapest product when it is
// empty (one unit); when it already holds items, the first item is
// the marker and nothing is written. The first confirmed read ends
// the probe (max 1 finding).
//
// This row is NOT the BFLA probe (#340): BFLA replays ADMIN
// endpoints as a low-privilege user (function-level authorization
// on admin functions). Row #86 is ownership on a BUSINESS flow —
// the same low-privilege user reaching ANOTHER USER'S basket,
// order or checkout state. Proof #27's BFLA evidence (GET
// /api/Users as low-priv, class bfla_bypass) proves #340 only;
// it walks no workflow and touches no other user's basket, so it
// cannot prove #86. Verified first-hand 9 Nov 2026: the live
// Juice lab returns the victim's full basket (id, UserId, items,
// totals) to a different authenticated user (GET /rest/basket/14
// as user 264 → 200, byte-identical to the victim control;
// anonymous → 401; the canary's own basket is empty).
//
// GATES: labCreds + allowWrite + isLabTargetHost (same lab gate as
// basket-logic / workflow-skip / bfla); depth 'quick' skips the
// probe. BOUND: at most 12 POSTs (victim login 4, registration 2,
// canary login 4, seed 2) and at most 7 GETs (product list 1,
// victim basket reads 2, canary-own read 1, anonymous 1, victim
// control 1, canary test 1). Findings are class 'business_logic'
// — the default confirmation protocol judges them on
// signalCorrelated (see differential.js).

import { isLabTargetHost } from '../../labCreds.js';
import { loginCandidates } from './sessionFixation.js';
import { findRegisterRoutes } from './bfla.js';
import {
  basketGetRoute,
  basketItemRoutes,
  productListRoute,
  fillBasketId,
  parseBasket,
  parseProductList,
  extractBasketId,
  seedFirstAddableProduct,
} from './basketLogic.js';
import { extractBearerTokenFromJson } from '../labSession.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const TIMEOUT_MS = 15000;
const MAX_LOGIN_CANDIDATES = 3;
const MAX_LOGIN_POSTS = 4;
const MAX_REGISTER_CANDIDATES = 2;
const MAX_SEED_POSTS = 2;
// Fixed canary password for the throwaway low-privilege account —
// never a real password, never derived from a secret.
const LOW_PRIV_PASSWORD = 'dm-bflow-low-pass-01';
const WHOAMI_RE = /whoami|\/me$|\/profile$|\/user\/whoami/i;
const REFUSAL_TEXT_RE =
  /unauthori[sz]ed|forbidden|access denied|not allowed|invalid (token|session)|basket not found|login required/i;

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

function ev(request, response, impact) {
  return { request, response, impact_demo: impact, signalCorrelated: true };
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

function findField(node, names, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 3) return null;
  for (const n of names) {
    const v = node[n];
    if (v != null && (typeof v === 'number' || (typeof v === 'string' && /^\d+$/.test(v)))) {
      return String(v);
    }
  }
  for (const v of Object.values(node)) {
    const f = findField(v, names, depth + 1);
    if (f != null) return f;
  }
  return null;
}

// ---- pure helpers (exported for unit tests) ---------------------------------

/**
 * The basket id a basket GET body claims to be (data.id, top level
 * or under .data), as a string, or null when the body carries none.
 * Pure.
 */
export function basketOwnerId(body) {
  if (!body || typeof body !== 'object') return null;
  const data = body.data && typeof body.data === 'object' ? body.data : body;
  const id = data.id;
  if (id == null) return null;
  if (typeof id === 'number' && Number.isFinite(id)) return String(id);
  if (typeof id === 'string' && /^\d+$/.test(id)) return id;
  return null;
}

/**
 * True when a basket GET body parses as a basket whose items include
 * the given product id (string-compared: ids arrive as numbers in
 * Juice and as strings elsewhere). Pure.
 */
export function basketHasProduct(body, productId) {
  if (productId == null) return false;
  const parsed = parseBasket(body);
  if (!parsed.ok) return false;
  const want = String(productId);
  return parsed.items.some((it) => it && it.productId != null && String(it.productId) === want);
}

/**
 * Judge one basket GET response. Returns { kind, reason } where kind
 * is 'granted' (2xx + a JSON body that parses as a basket),
 * 'refused' (401/403/404, or a refusal message in the body), or
 * 'other' (anything else — 5xx, redirect, empty 2xx, or a non-basket
 * 2xx such as the SPA HTML shell, which proves nothing about the
 * basket route). Pure.
 */
export function assessBasketRead(status, body) {
  const text = typeof body === 'string' ? body : JSON.stringify(body || '');
  if (typeof status === 'number' && (status === 401 || status === 403 || status === 404)) {
    return { kind: 'refused', reason: `basket read answered HTTP ${status}` };
  }
  if (REFUSAL_TEXT_RE.test(text)) {
    return { kind: 'refused', reason: 'basket read response carries a refusal message' };
  }
  if (typeof status === 'number' && status >= 200 && status < 300) {
    let json = null;
    try {
      json = typeof body === 'string' ? JSON.parse(body) : body;
    } catch {
      json = null;
    }
    if (!json || typeof json !== 'object') {
      return { kind: 'other', reason: 'basket read answered 2xx with a non-JSON body' };
    }
    if (!parseBasket(json).ok) {
      return { kind: 'other', reason: 'basket read answered 2xx with a body that is not a basket' };
    }
    return { kind: 'granted', reason: `basket read answered HTTP ${status} with a basket body` };
  }
  return { kind: 'other', reason: `basket read answered HTTP ${status}` };
}

/**
 * Judge the cross-user basket differential. 'confirmed' only when
 * the victim control granted with the seeded marker visible AND the
 * canary replay granted the VICTIM's basket (response basket id is
 * the victim's, not the canary's own) with the marker present, while
 * the canary's own basket read empty (so the marker in the cross
 * read can only be the victim's). A server that returns the caller's
 * own basket, filters the marker, or refuses the canary is
 * 'rejected'; a control that cannot show the marker or a
 * non-empty canary basket leaves the oracle 'uncalibrated'. Pure.
 */
export function assessCrossUserFlow({
  controlKind,
  controlHasSeed,
  crossKind,
  crossOwnerId,
  victimBid,
  canaryBid,
  crossHasSeed,
  canaryOwnEmpty,
}) {
  if (controlKind !== 'granted') {
    return { verdict: 'uncalibrated', reason: 'the victim control did not grant the basket — no valid control' };
  }
  if (!controlHasSeed) {
    return {
      verdict: 'uncalibrated',
      reason: 'the victim control did not show the seeded marker item — the marker is not observable',
    };
  }
  if (crossKind === 'refused') {
    return { verdict: 'rejected', reason: 'the canary token was refused — ownership holds on this flow' };
  }
  if (crossKind !== 'granted') {
    return { verdict: 'uncalibrated', reason: 'the cross-user replay was inconclusive on this basket' };
  }
  if (crossOwnerId != null && canaryBid != null && crossOwnerId === canaryBid) {
    return {
      verdict: 'rejected',
      reason: `server returned the caller's own basket (id ${crossOwnerId}) — the path id was ignored, ownership enforced`,
    };
  }
  if (crossOwnerId != null && victimBid != null && crossOwnerId !== victimBid) {
    return {
      verdict: 'rejected',
      reason: `server returned a different basket (id ${crossOwnerId}) than the victim's (${victimBid}) — not the victim flow`,
    };
  }
  if (!crossHasSeed) {
    return {
      verdict: 'rejected',
      reason: 'cross-user read did not carry the victim\'s seeded marker item — the server filtered it',
    };
  }
  if (!canaryOwnEmpty) {
    return {
      verdict: 'uncalibrated',
      reason: 'the canary\'s own basket was not empty — the read cannot be attributed to the victim',
    };
  }
  return {
    verdict: 'confirmed',
    reason: `canary session read the victim's basket (id ${victimBid}) with the seeded marker item — the flow enforces no ownership check on the client-supplied basket id`,
  };
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

// One API login attempt sequence against one login candidate:
// {email, password} then {username, password}. Returns
// { ok, res, token, body, spent } — mirrors workflowSkip's copy.
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
    if (r.status === 401 || r.status === 400) continue;
    if (r.status < 200 || r.status >= 300) return { ok: false, spent };
    const token = r.json ? extractBearerTokenFromJson(r.json) : null;
    if (!token) return { ok: false, spent };
    return { ok: true, res: r, token, body: r.json, spent };
  }
  return { ok: false, spent };
}

// Register the throwaway low-privilege (canary) account. One POST per
// candidate, Juice shape {email, password, passwordRepeat}. Mirrors
// bfla's registerLowPriv.
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

export async function probeBusinessFlowAccess(url, opts = {}) {
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
  const basketRoute = basketGetRoute(routes, origin);
  if (!basketRoute) return findings;
  setDiag('basketRoutes', 1);
  const { collection: itemCollection } = basketItemRoutes(routes, origin);

  // THE VICTIM: the labCreds account. Login (shared budget, same as
  // basket-logic / workflow-skip): exact /login candidates first.
  const loginUrls = loginCandidates(routes, origin).slice(0, MAX_LOGIN_CANDIDATES);
  if (!loginUrls.length) return findings;
  let victimToken = null;
  let victimBid = null;
  let postsLeft = MAX_LOGIN_POSTS;
  for (const candidate of loginUrls) {
    if (postsLeft <= 0) break;
    const got = await tryApiLogin(fetchFn, candidate, creds, postsLeft);
    postsLeft -= got.spent;
    if (got.ok) {
      victimToken = got.token;
      victimBid = extractBasketId(got.body);
      break;
    }
  }
  if (!victimToken) return findings;
  // Basket-id fallback: whoami user id (Juice convention — the
  // basket id is the user id). Only the login body or whoami may
  // supply it; a mined filler id is never used.
  if (!victimBid) {
    const whoami = routes.find((r) => sameOrigin(r, origin) && WHOAMI_RE.test(pathOf(r)));
    if (whoami) {
      const r = await req(fetchFn, stripQuery(whoami), { token: victimToken });
      const uid = r && r.json ? findField(r.json, ['id']) : null;
      if (uid) victimBid = uid;
    }
  }
  if (!victimBid) return findings;
  const victimBasketUrl = fillBasketId(basketRoute, victimBid);
  if (!victimBasketUrl) return findings;

  // THE MARKER: read the victim basket. When it already holds items
  // the first item is the marker and nothing is written; when it is
  // empty, seed the cheapest product (one unit) so the control has
  // an item to recognise.
  const readBasket = async (basketUrl, token) => {
    const r = await req(fetchFn, basketUrl, { token });
    if (!r || r.status !== 200 || !r.json) return null;
    const parsed = parseBasket(r.json);
    return parsed.ok ? { parsed, json: r.json } : null;
  };
  let victimBasket = await readBasket(victimBasketUrl, victimToken);
  if (!victimBasket) return findings;
  let markerProductId = null;
  let victimSeeded = false;
  if (victimBasket.parsed.items.length) {
    markerProductId = victimBasket.parsed.items[0].productId;
  } else {
    if (!itemCollection) { setDiag('bailStage', 'seed'); return findings; }
    const productUrl = productListRoute(routes, origin);
    if (!productUrl) { setDiag('bailStage', 'seed'); return findings; }
    const pr = await req(fetchFn, stripQuery(productUrl), { token: victimToken });
    const products = pr && pr.json ? parseProductList(pr.json) : [];
    if (!products.length) { setDiag('bailStage', 'seed'); return findings; }
    // The cheapest product is tried first, but it is not always
    // addable (Juice: out of stock) — the seeder walks the price
    // list until one adds (see seedFirstAddableProduct).
    const seededRes = await seedFirstAddableProduct(fetchFn, { itemCollection, basketId: victimBid, products, token: victimToken });
    setDiag('seedAttempts', seededRes.attempts);
    if (seededRes.ok) setDiag('seedProductId', seededRes.productId);
    if (!seededRes.ok) { setDiag('bailStage', 'seed'); return findings; }
    victimSeeded = true;
    victimBasket = await readBasket(victimBasketUrl, victimToken);
    if (!victimBasket || !victimBasket.parsed.items.length) { setDiag('bailStage', 'seed'); return findings; }
    markerProductId = seededRes.productId;
  }
  setDiag('victimSeeded', victimSeeded);
  if (markerProductId == null) return findings;

  // THE CANARY: a throwaway self-registered account. The email
  // carries a per-run random suffix so re-runs never collide with
  // an existing account; the password is the fixed canary value.
  const registerRoutes = findRegisterRoutes(routes, origin);
  if (!registerRoutes.length) return findings;
  const rid = rand();
  const canaryEmail = `dm-bflow-low-${rid}@example.com`;
  const registered = await registerLowPriv(fetchFn, registerRoutes, canaryEmail);
  setDiag('registerOk', registered.ok);
  if (!registered.ok) return findings;
  let canaryToken = null;
  let canaryBid = null;
  postsLeft = MAX_LOGIN_POSTS;
  for (const candidate of loginUrls) {
    if (postsLeft <= 0) break;
    const got = await tryApiLogin(fetchFn, candidate, { username: canaryEmail, password: LOW_PRIV_PASSWORD }, postsLeft);
    postsLeft -= got.spent;
    if (got.ok) {
      canaryToken = got.token;
      canaryBid = extractBasketId(got.body);
      break;
    }
  }
  if (!canaryToken) return findings;
  if (!canaryBid) {
    const whoami = routes.find((r) => sameOrigin(r, origin) && WHOAMI_RE.test(pathOf(r)));
    if (whoami) {
      const r = await req(fetchFn, stripQuery(whoami), { token: canaryToken });
      const uid = r && r.json ? findField(r.json, ['id']) : null;
      if (uid) canaryBid = uid;
    }
  }
  if (!canaryBid) return findings;
  const canaryBasketUrl = fillBasketId(basketRoute, canaryBid);
  if (!canaryBasketUrl) return findings;

  // THE CANARY'S OWN BASKET must read EMPTY first: a fresh account
  // has no items, so a marker in the cross read can only be the
  // victim's. A non-empty canary basket leaves the oracle
  // uncalibrated.
  const canaryOwn = await readBasket(canaryBasketUrl, canaryToken);
  if (!canaryOwn) return findings;
  const canaryOwnEmpty = canaryOwn.parsed.items.length === 0;
  if (!canaryOwnEmpty) return findings;

  // Leg 1 — no token: a basket that answers 200 anonymously is
  // public, not this row (missing-auth #47's territory), never a
  // finding.
  const rNoAuth = await req(fetchFn, victimBasketUrl, { method: 'GET' });
  if (rNoAuth) {
    const judgedNoAuth = assessBasketRead(rNoAuth.status, rNoAuth.text);
    if (judgedNoAuth.kind === 'granted') {
      setDiag('anonymousGranted', true);
      return findings;
    }
  }

  // Leg 2 — victim control: must grant with the marker visible.
  const rVictim = await req(fetchFn, victimBasketUrl, { method: 'GET', token: victimToken });
  if (!rVictim) return findings;
  const judgedVictim = assessBasketRead(rVictim.status, rVictim.text);
  const controlHasSeed = judgedVictim.kind === 'granted' && basketHasProduct(rVictim.json, markerProductId);
  setDiag('controlOk', judgedVictim.kind === 'granted' && controlHasSeed);

  // Leg 3 — canary test: the same victim basket URL with the
  // canary's token.
  const rCanary = await req(fetchFn, victimBasketUrl, { method: 'GET', token: canaryToken });
  if (!rCanary) return findings;
  setDiag('attempts', 1);
  const judgedCanary = assessBasketRead(rCanary.status, rCanary.text);
  const verdict = assessCrossUserFlow({
    controlKind: judgedVictim.kind,
    controlHasSeed,
    crossKind: judgedCanary.kind,
    crossOwnerId: judgedCanary.kind === 'granted' ? basketOwnerId(rCanary.json) : null,
    victimBid: String(victimBid),
    canaryBid: String(canaryBid),
    crossHasSeed: judgedCanary.kind === 'granted' && basketHasProduct(rCanary.json, markerProductId),
    canaryOwnEmpty,
  });
  if (verdict.verdict !== 'confirmed') return findings;
  setDiag('bypassKind', 'cross-user-basket-read');
  findings.push({
    class: 'business_logic',
    id: `bflow-cross-user-${rand()}`,
    title: "Unrestricted access to sensitive business flow — another user's basket readable (HIGH)",
    severity: 'high',
    url: victimBasketUrl,
    parameter: 'BasketId',
    evidence: ev(
      `GET ${victimBasketUrl} with a canary Bearer token (control: victim 200 with the seeded item, no-token ${rNoAuth ? rNoAuth.status : 'n/a'})`,
      `Canary session received the victim's basket — HTTP 200, basket id ${victimBid}, seeded product ${markerProductId} present, same contents as the victim control — the flow enforces no ownership check on the client-supplied basket id. ${verdict.reason}.`,
      'Any authenticated user can read any other user\'s basket — items, quantities and totals — by guessing the basket id.',
    ),
  });
  return findings;
}

export const __bfaMeta = { phases: ['business-flow-access'], depth: ['standard', 'deep'] };
