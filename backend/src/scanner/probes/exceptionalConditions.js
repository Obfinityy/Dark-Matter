// Dark Matter rule-based scanner — exceptional-conditions probe
// (coverage row #482 [Medium] Mishandling of Exceptional
// Conditions, CWE-703 / CWE-636 | OWASP A10:2025; phase 103,
// 'exceptional-conditions').
//
// ORACLE (differential, no judge, no LLM, $0): an exceptional
// condition is mishandled when a multi-step workflow does NOT
// fail securely on it. The probe feeds malformed quantities to
// the shop's own basket workflow — the same multi-step surface
// basket-logic and coupon-abuse already calibrate — and judges
// each exceptional value against a well-formed CONTROL on the
// same endpoint:
//   (1) CONTROL: add the cheapest product with quantity 1 —
//       must be 2xx AND move the basket (a new item or a moved
//       total). A control that does not move the basket means the
//       oracle is uncalibrated and the probe returns [].
//   (2) FAIL-OPEN leg: the same add with an exceptional quantity
//       ('abc', 1.5, null, 2^53+1) — CONFIRM only when the server
//       answers 2xx AND the basket state changes (a new item
//       appears or the total moves): the workflow accepted an
//       exceptional value and applied it instead of failing
//       securely (CWE-636). A 2xx that changes nothing is a
//       silent drop, never a finding; a 4xx is validation
//       working; a 5xx is recorded in diagnostics only — a crash
//       response is error-disclosure's territory, never this
//       probe's confirm trigger.
//   (3) INCONSISTENCY leg: only when every variant was rejected
//       on the add endpoint — the same malformed value is sent
//       to the sibling update endpoint (PUT the item's quantity).
//       CONFIRM only when the update accepts it (2xx + the
//       recorded quantity changes) while the add rejected it:
//       the same input class is handled inconsistently across
//       two endpoints of one workflow (CWE-703). Two endpoints
//       rejecting alike is a proven true negative, not a finding.
// The first confirmed leg ends the probe (max 1 finding).
//
// SURFACE: the basket-item routes the jsRoutes miner already
// recovers (POST /api/BasketItems, PUT /api/BasketItems/:id on
// Juice Shop) — the probe discovers them from opts.apiRoutes
// (scanTargets + jsWriteTargets, wired in by runScan exactly
// like bfla / coupon-abuse) and never invents a route. The
// canary's OWN basket id comes from the login response
// (bid/basketId/...) or, failing that, the whoami user id
// (Juice convention: basket id == user id) — never a mined
// filler id, so no other user's basket is ever touched. This
// probe does NOT retest basket-logic's edges (negative / zero /
// huge-integer quantities, empty-basket checkout) — its variants
// are type-confusion values (a non-numeric string, a fraction,
// JSON null, a beyond-safe-integer), a disjoint input class.
//
// GATES: labCreds + allowWrite + isLabTargetHost (same lab gate
// as basket-logic / workflow-skip / bfla / coupon-abuse); depth
// 'quick' skips the probe. BOUND: at most 12 writes total
// (login 4, control add 1, variants 4, sibling update 1,
// restore 2 — legs that cannot run inside the budget are
// skipped, never forced). Items the probe adds are zeroed
// best-effort at the end, as in coupon-abuse. Findings are
// class 'business_logic' — the default confirmation protocol
// judges them on signalCorrelated (see differential.js).

import { isLabTargetHost } from '../../labCreds.js';
import { loginCandidates } from './sessionFixation.js';
import { extractBearerTokenFromJson } from '../labSession.js';
import {
  basketGetRoute,
  basketItemRoutes,
  productListRoute,
  replaceLastSegment,
  fillBasketId,
  parseBasket,
  parseProductList,
  extractBasketId,
  isOutOfStockResponse,
  MAX_SEED_PRODUCTS,
} from './basketLogic.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const TIMEOUT_MS = 15000;
const MAX_LOGIN_CANDIDATES = 3;
const MAX_LOGIN_POSTS = 4;
const MAX_TOTAL_POSTS = 12;
const MAX_VARIANTS = 4;
const MAX_RESTORE_ITEMS = 2;
const EPS = 0.01;
const WHOAMI_RE = /whoami|\/me$|\/profile$|\/user\/whoami/i;

// Exceptional quantities — type-confusion values for a quantity
// field that the API contract defines as a positive integer.
// Each entry carries the JSON value and a human-readable label
// for the evidence string. Pure data, exported for unit tests.
export const EXCEPTIONAL_QUANTITIES = [
  { value: 'abc', label: '"abc" (non-numeric string)' },
  { value: 1.5, label: '1.5 (fractional quantity)' },
  { value: null, label: 'null (JSON null)' },
  { value: 9007199254740993, label: '9007199254740993 (beyond 2^53)' },
];

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

// ---- basket snapshots (pure) -------------------------------------------------

// A minimal basket snapshot for before/after comparison: the item
// count and the total. A variant that adds an item changes the
// count even when its quantity is unparseable (a stored "abc"
// contributes no total), so the count is the reliable signal and
// the total is the corroborating one.
function snapshot(basket) {
  if (!basket) return null;
  return {
    items: basket.items ? basket.items.length : 0,
    total: typeof basket.total === 'number' && Number.isFinite(basket.total) ? basket.total : 0,
  };
}

function stateChanged(before, after) {
  if (!before || !after) return false;
  if (after.items !== before.items) return true;
  return Math.abs(after.total - before.total) > EPS;
}

// ---- the oracles (pure) -----------------------------------------------------

/**
 * Judge the control add: the well-formed add must move the
 * basket (a new item or a moved total). 'confirmed' calibrates
 * the oracle; anything else is uncalibrated, never a finding.
 * Pure.
 */
export function assessExceptionalControl(before, after) {
  if (!before || !after) {
    return { verdict: 'unconfirmed', reason: 'basket unreadable' };
  }
  if (stateChanged(before, after)) {
    return { verdict: 'confirmed', reason: 'the well-formed add moved the basket' };
  }
  return { verdict: 'rejected', reason: 'the well-formed add did not move the basket' };
}

/**
 * Judge one exceptional variant on the add endpoint.
 * 'confirmed' (fail-open) only when the server answered 2xx AND
 * the basket state changed — the workflow applied an exceptional
 * value instead of failing securely. A 2xx that changes nothing
 * is a silent drop; a 4xx is validation working; a 5xx is
 * unconfirmed here (a crash response is error-disclosure's
 * territory, never this probe's confirm trigger). Pure.
 */
export function assessExceptionalVariant(controlVerdict, variantStatus, changed) {
  if (controlVerdict !== 'confirmed') {
    return { verdict: 'unconfirmed', reason: 'no calibrated control — the oracle cannot judge this variant' };
  }
  if (typeof variantStatus === 'number' && variantStatus >= 200 && variantStatus < 300) {
    if (changed) {
      return {
        verdict: 'confirmed',
        reason: 'the server accepted the exceptional quantity and the basket state changed',
      };
    }
    return { verdict: 'rejected', reason: 'the server answered 2xx but the basket did not change — the value was silently dropped' };
  }
  if (typeof variantStatus === 'number' && variantStatus >= 400 && variantStatus < 500) {
    return { verdict: 'rejected', reason: `the server rejected the exceptional quantity with HTTP ${variantStatus}` };
  }
  return { verdict: 'unconfirmed', reason: `the variant answered HTTP ${variantStatus} — a crash response is not this probe's confirm trigger` };
}

/**
 * Judge the sibling-endpoint leg: the same malformed value the
 * add endpoint rejected is sent to the update endpoint.
 * 'confirmed' (inconsistent handling) only when the add rejected
 * it and the update accepted it with a state change. Two
 * endpoints rejecting alike is a true negative. Pure.
 */
export function assessExceptionalInconsistency(addStatus, updateStatus, updateChanged) {
  const addRejected =
    typeof addStatus === 'number' && addStatus >= 400 && addStatus < 500;
  if (!addRejected) {
    return { verdict: 'unconfirmed', reason: 'the add endpoint did not reject the value — there is no inconsistency to judge' };
  }
  if (typeof updateStatus === 'number' && updateStatus >= 200 && updateStatus < 300) {
    if (updateChanged) {
      return {
        verdict: 'confirmed',
        reason: 'the add endpoint rejected the malformed quantity but the update endpoint accepted it and the basket state changed',
      };
    }
    return { verdict: 'rejected', reason: 'the update endpoint answered 2xx but the basket did not change' };
  }
  if (typeof updateStatus === 'number' && updateStatus >= 400 && updateStatus < 500) {
    return { verdict: 'rejected', reason: `both endpoints rejected the malformed quantity (update HTTP ${updateStatus})` };
  }
  return { verdict: 'unconfirmed', reason: `the update leg answered HTTP ${updateStatus} — inconclusive` };
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

// One API login attempt sequence against the login candidates:
// {email, password} first, then {username, password} on 401/400.
// Returns { ok, token, body, spent } — spent counts the POSTs made.
async function apiLogin(fetchFn, loginUrls, creds, budget) {
  let spent = 0;
  for (const loginUrl of loginUrls) {
    for (const body of [
      { email: creds.username, password: creds.password },
      { username: creds.username, password: creds.password },
    ]) {
      if (spent >= budget) return { ok: false, token: null, body: null, spent };
      const r = await req(fetchFn, loginUrl, { method: 'POST', body });
      spent += 1;
      if (!r) return { ok: false, token: null, body: null, spent };
      if (r.status === 401 || r.status === 400) continue;
      if (r.status < 200 || r.status >= 300) return { ok: false, token: null, body: null, spent };
      const token = r.json ? extractBearerTokenFromJson(r.json) : null;
      if (!token) return { ok: false, token: null, body: null, spent };
      return { ok: true, token, body: r.json, spent };
    }
  }
  return { ok: false, token: null, body: null, spent };
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

// ---- the probe ---------------------------------------------------------------

export async function probeExceptionalConditions(url, opts = {}) {
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
  const { collection: itemCollection, itemTemplate } = basketItemRoutes(routes, origin);
  setDiag('basketRoutes', itemCollection ? 1 : 0);
  if (!itemCollection) return findings;
  const basketRoute = basketGetRoute(routes, origin);
  if (!basketRoute) return findings;

  // Shared write budget: at most MAX_TOTAL_POSTS writes in total.
  // Every POST/PUT below goes through spend() — a leg that cannot
  // run inside the budget is skipped, never forced.
  let writesLeft = MAX_TOTAL_POSTS;
  const spend = () => {
    if (writesLeft <= 0) return false;
    writesLeft -= 1;
    return true;
  };

  // Login (shared budget, same as basket-logic / coupon-abuse):
  // exact /login candidates first, decoy routes skipped after one
  // POST each.
  const loginUrls = loginCandidates(routes, origin).slice(0, MAX_LOGIN_CANDIDATES);
  if (!loginUrls.length) return findings;
  const login = await apiLogin(fetchFn, loginUrls, creds, Math.min(MAX_LOGIN_POSTS, writesLeft));
  writesLeft -= login.spent;
  if (!login.ok) return findings;
  const token = login.token;
  let basketId = extractBasketId(login.body);
  // Basket-id fallback: whoami user id (Juice convention — the
  // basket id is the user id). Only the login body or whoami may
  // supply it; a mined filler id is never used.
  if (!basketId) {
    const whoami = routes.find((r) => sameOrigin(r, origin) && WHOAMI_RE.test(pathOf(r)));
    if (whoami) {
      const r = await req(fetchFn, stripQuery(whoami), { token });
      const uid = r && r.json ? findField(r.json, ['id']) : null;
      if (uid) basketId = uid;
    }
  }
  if (!basketId) return findings;
  setDiag('basketId', true);

  const basketUrl = fillBasketId(basketRoute, basketId);
  if (!basketUrl) return findings;
  const readBasket = async () => {
    const r = await req(fetchFn, basketUrl, { token });
    if (!r || r.status !== 200 || !r.json) return null;
    const parsed = parseBasket(r.json);
    return parsed.ok ? parsed : null;
  };
  const beforeControl = await readBasket();
  if (!beforeControl) return findings;

  // The add-item body shape is learned once, on the control: the
  // primary shape first, the alternate shape when the primary is
  // refused. Variants reuse the learned shape, so a variant
  // rejection means the VALUE was rejected, never the shape.
  let bodyShape = null;
  const addItem = async (productId, quantity) => {
    const shapes = bodyShape
      ? [bodyShape]
      : ['primary', 'alternate'];
    for (const shape of shapes) {
      if (!spend()) return null;
      const body =
        shape === 'primary'
          ? { BasketId: basketId, ProductId: productId, quantity }
          : { basketId, productId, quantity };
      const r = await req(fetchFn, itemCollection, { method: 'POST', token, body });
      if (!r) return null;
      if (r.status >= 200 && r.status < 300) {
        bodyShape = shape;
        return r;
      }
      // An out-of-stock 400 is the VALUE (the product), never the
      // shape — no alternate spelling can fix stock, so return at
      // once and let the caller try the next product.
      if (isOutOfStockResponse(r)) return r;
      // A 4xx on the primary shape may be the shape, not the
      // value — try the alternate shape once before concluding.
      if (shape === 'primary' && r.status >= 400 && r.status < 500 && !bodyShape) continue;
      return r;
    }
    return null;
  };

  // THE CONTROL: add the cheapest product with quantity 1. The
  // basket must move — that calibrates the endpoint and the body
  // shape. A control with no state change means the oracle cannot
  // judge the variant legs, so the probe returns [] — a finding
  // without a working control is a guess. The cheapest product is
  // tried first, but it can be out of stock (a refused add moves
  // nothing), so the control walks the price list until one add
  // moves the basket.
  const productUrl = productListRoute(routes, origin);
  if (!productUrl) return findings;
  const pr = await req(fetchFn, stripQuery(productUrl), { token });
  const products = pr && pr.json ? parseProductList(pr.json) : [];
  if (!products.length) return findings;
  const beforeSnapshot = snapshot(beforeControl);
  let controlProductId = null;
  let controlRes = null;
  let afterControl = null;
  for (const candidate of products.slice(0, MAX_SEED_PRODUCTS)) {
    if (candidate == null || candidate.id == null) continue;
    controlRes = await addItem(candidate.id, 1);
    if (!controlRes) return findings;
    afterControl = await readBasket();
    if (!afterControl) return findings;
    const judged = assessExceptionalControl(beforeSnapshot, snapshot(afterControl));
    if (judged.verdict === 'confirmed') {
      controlProductId = candidate.id;
      break;
    }
    // No state change: this product is un-addable here (out of
    // stock or rejected) — the basket is unchanged, so the next
    // cheapest product is tried against the same baseline.
  }
  if (controlProductId == null) return findings;
  setDiag('controlOk', true);
  const controlSnapshot = snapshot(afterControl);
  // The item the control created — the sibling leg updates this
  // item, and the restore zeroes it at the end.
  const controlItem =
    afterControl.items.find((i) => String(i.productId) === String(controlProductId)) || afterControl.items[0] || null;

  // THE FAIL-OPEN LEG: the same add with each exceptional
  // quantity in turn. Confirm on the first variant the server
  // accepts with a state change; a variant that is rejected or
  // silently dropped is recorded and the next variant is tried.
  let attempts = 0;
  let crashResponses = 0;
  let firstRejected = null;
  for (const variant of EXCEPTIONAL_QUANTITIES.slice(0, MAX_VARIANTS)) {
    const before = await readBasket();
    if (!before) break;
    const res = await addItem(controlProductId, variant.value);
    if (!res) break;
    attempts += 1;
    setDiag('attempts', attempts);
    if (res.status >= 500) crashResponses += 1;
    setDiag('crashResponses', crashResponses);
    const after = await readBasket();
    if (!after) break;
    const changed = stateChanged(snapshot(before), snapshot(after));
    const judged = assessExceptionalVariant('confirmed', res.status, changed);
    if (judged.verdict === 'confirmed') {
      const recorded = (after.items.find((i) => String(i.productId) === String(controlProductId)) || {}).quantity;
      setDiag('failOpenKind', 'accepted');
      findings.push({
        class: 'business_logic',
        id: `ec-failopen-${rand()}`,
        title: 'Business logic — malformed quantity accepted into the basket workflow (MEDIUM)',
        severity: 'medium',
        url: basketUrl,
        parameter: 'quantity',
        evidence: ev(
          `Control: add product ${controlProductId} with quantity 1 (token auth) -> HTTP ${controlRes.status}, basket ${controlSnapshot.items} item(s) total ${controlSnapshot.total}; variant: add the same product with quantity ${variant.label} (token auth) -> HTTP ${res.status}, basket ${snapshot(after).items} item(s) total ${snapshot(after).total}`,
          `The server accepted the exceptional quantity and the basket state changed (recorded quantity ${recorded === null || recorded === undefined ? 'unparseable' : recorded}): ${judged.reason}. A quantity outside the positive-integer contract must be rejected, never applied.`,
          'An attacker feeds exceptional quantities into the basket workflow and corrupts basket state — a fractional, null or overflowed quantity the server applies instead of rejecting.',
        ),
      });
      return findings;
    }
    if (judged.verdict === 'rejected' && res.status >= 400 && res.status < 500 && !firstRejected) {
      firstRejected = { variant, status: res.status };
    }
  }
  setDiag('variantsTried', attempts);

  // THE INCONSISTENCY LEG: only when every variant was rejected
  // on the add endpoint — the same malformed value is sent to the
  // sibling update endpoint (PUT the control item's quantity).
  // Confirm only when the update accepts it with a state change
  // while the add rejected it.
  if (firstRejected && itemTemplate && controlItem && controlItem.basketItemId) {
    const setUrl = replaceLastSegment(itemTemplate, controlItem.basketItemId);
    if (setUrl && spend()) {
      const beforeUpdate = await readBasket();
      const r = await req(fetchFn, setUrl, {
        method: 'PUT',
        token,
        body: { quantity: firstRejected.variant.value },
      });
      attempts += 1;
      setDiag('attempts', attempts);
      if (r) {
        if (r.status >= 500) {
          crashResponses += 1;
          setDiag('crashResponses', crashResponses);
        }
        const afterUpdate = await readBasket();
        const updateChanged = afterUpdate ? stateChanged(snapshot(beforeUpdate), snapshot(afterUpdate)) : false;
        const judged = assessExceptionalInconsistency(firstRejected.status, r.status, updateChanged);
        if (judged.verdict === 'confirmed') {
          const recorded = afterUpdate
            ? (afterUpdate.items.find((i) => String(i.basketItemId) === String(controlItem.basketItemId)) || {}).quantity
            : undefined;
          setDiag('failOpenKind', 'inconsistent');
          findings.push({
            class: 'business_logic',
            id: `ec-inconsistent-${rand()}`,
            title: 'Business logic — malformed quantity handled inconsistently across basket endpoints (MEDIUM)',
            severity: 'medium',
            url: basketUrl,
            parameter: 'quantity',
            evidence: ev(
              `Add endpoint: POST ${itemCollection} with quantity ${firstRejected.variant.label} (token auth) -> HTTP ${firstRejected.status} rejected; update endpoint: PUT ${setUrl} with quantity ${firstRejected.variant.label} (token auth) -> HTTP ${r.status}, basket ${snapshot(afterUpdate).items} item(s) total ${snapshot(afterUpdate).total}`,
              `The same malformed quantity is rejected by the add endpoint but accepted by the update endpoint (recorded quantity ${recorded === null || recorded === undefined ? 'unparseable' : recorded}): ${judged.reason}. One workflow must not enforce what its sibling ignores.`,
              'An attacker routes exceptional quantities through the endpoint that fails open and corrupts basket state the add endpoint would have refused.',
            ),
          });
          return findings;
        }
      }
    }
  }

  // Best-effort restore: zero the items the probe added (at most
  // MAX_RESTORE_ITEMS PUTs), so the canary basket is left empty.
  // Never affects findings.
  try {
    const cur = await readBasket();
    if (itemTemplate && cur) {
      for (const item of cur.items.slice(0, MAX_RESTORE_ITEMS)) {
        if (!item.basketItemId || !spend()) break;
        const setUrl = replaceLastSegment(itemTemplate, item.basketItemId);
        if (!setUrl) continue;
        await req(fetchFn, setUrl, { method: 'PUT', token, body: { quantity: 0 } });
      }
    }
  } catch {
    // restore is best-effort
  }

  return findings;
}

export const __exceptionalMeta = { phases: ['exceptional-conditions'], depth: ['standard', 'deep'] };
