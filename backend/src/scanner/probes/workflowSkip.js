// Dark Matter rule-based scanner — workflow / step-skipping probe
// (coverage row #87 [High] Workflow / Step-Skipping Bypass,
// WSTG-BUSL; phase 89, 'workflow-skip').
//
// ORACLE (deterministic, no judge, no LLM, $0): a shop checkout is
// a workflow — items must be in the basket before the checkout step
// runs. With the canary lab session we (1) seed the basket with the
// cheapest product when it is empty, (2) run a CONTROL checkout of
// the non-empty basket — it must return an order artefact (order id
// / order total inside a success response), or the oracle is
// uncalibrated and the probe returns [], (3) re-read the basket —
// it must be EMPTY now (the control checkout consumed it), and
// (4) POST checkout AGAIN on the empty basket. CONFIRM only when
// the second checkout returns an order artefact for a DIFFERENT
// order than the control's: a fresh order created for an empty
// basket means the server accepted the checkout step with its
// prerequisite (items in the basket) unmet. A server that refuses
// the empty checkout is 'rejected'; a server that answers the
// second checkout with the SAME order id is 'replayed' (idempotent
// replay handling, not a new order) and is never a finding.
//
// The test call is both an empty-basket checkout AND a repeat
// checkout, so this oracle covers the step-skip and the
// double-submit halves of the row in one confirmable step.
//
// DROPPED ORACLES (no confirmable signal without guessing):
// - Coupon-before-items: no known-valid coupon code exists to
//   calibrate with, so the probe could not distinguish "coupon
//   step skipped" from "invalid coupon". Not attempted.
// - Unauthenticated checkout: that is missing-auth (#47), not a
//   workflow violation. Not attempted.
//
// SURFACE: the basket endpoints the jsRoutes miner already recovers
// (GET /rest/basket/:id, POST /rest/basket/:id/checkout) — the probe
// discovers them from opts.apiRoutes (scanTargets + jsWriteTargets,
// wired in by runScan exactly like basket-logic) and never invents
// a route. The canary's OWN basket id comes from the login response
// (bid/basketId/...) or, failing that, the whoami user id (Juice
// convention: basket id == user id) — never a mined filler id, so
// no other user's basket is ever touched.
//
// GATES: labCreds + allowWrite + isLabTargetHost (same lab gate as
// basket-logic / session-fixation); depth 'quick' skips the probe.
// BOUND: at most 4 login POSTs (shared budget, same as
// basket-logic), at most 2 checkouts (1 control + 1 test). The
// control checkout consumes the canary basket by design — that is
// what establishes the empty-basket precondition for the test, so
// there is nothing to restore afterwards.
// Findings are class 'business_logic' — the default confirmation
// protocol judges them on signalCorrelated (see differential.js).

import { isLabTargetHost } from '../../labCreds.js';
import { loginCandidates } from './sessionFixation.js';
import { extractBearerTokenFromJson } from '../labSession.js';
import {
  basketGetRoute,
  basketCheckoutRoute,
  basketItemRoutes,
  productListRoute,
  replaceLastSegment,
  fillBasketId,
  fillCheckoutBasketId,
  parseBasket,
  parseProductList,
  extractBasketId,
  findOrderTotal,
} from './basketLogic.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const TIMEOUT_MS = 15000;
const MAX_LOGIN_CANDIDATES = 3;
const MAX_LOGIN_POSTS = 4;
const WHOAMI_RE = /whoami|\/me$|\/profile$|\/user\/whoami/i;
const ORDER_ID_KEY_RE = /^order/i;
const ORDER_ID_EXCLUDE_RE = /total|amount|price|status|date|count|time|at$/i;

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

// ---- order-artefact parsing (pure) ------------------------------------------

/** Shallow-recursive hunt for an order-id-like scalar (orderId / orderNumber / ...). Pure. */
function findOrderId(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 3) return null;
  for (const [k, v] of Object.entries(node)) {
    if (
      ORDER_ID_KEY_RE.test(k) &&
      !ORDER_ID_EXCLUDE_RE.test(k) &&
      (typeof v === 'number' || (typeof v === 'string' && v.length > 0)) &&
      !(typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v))
    ) {
      return String(v);
    }
  }
  for (const v of Object.values(node)) {
    const f = findOrderId(v, depth + 1);
    if (f != null) return f;
  }
  return null;
}

/**
 * Find the order artefact in a checkout response body. Returns
 * { orderId, total, kind } or null. An artefact is an order-id-like
 * field, a success response whose data object carries an id, or a
 * success response carrying an order total — in that strictness
 * order. A bare 2xx with no artefact is NOT an order (the control
 * checkout must produce one, or the oracle is uncalibrated).
 * Pure.
 */
export function findOrderArtefact(body) {
  if (!body || typeof body !== 'object') return null;
  const orderId = findOrderId(body);
  const total = findOrderTotal(body);
  const success = body.status === 'success' || (body.data && body.data.status === 'success');
  const data = body.data && typeof body.data === 'object' ? body.data : null;
  const dataId = data && data.id != null ? String(data.id) : null;
  if (orderId != null) return { orderId, total, kind: 'order-id' };
  if (success && dataId != null) return { orderId: dataId, total, kind: 'order-id' };
  if (success && total != null) return { orderId: null, total, kind: 'order-total' };
  return null;
}

/**
 * Judge a checkout response as an order-creation signal.
 * Returns { found, orderId, total, kind, reason }. Pure.
 */
export function assessCheckoutOrder(status, body) {
  if (typeof status !== 'number' || status < 200 || status >= 300) {
    return { found: false, orderId: null, total: null, kind: null, reason: `checkout answered HTTP ${status}` };
  }
  const artefact = findOrderArtefact(body);
  if (!artefact) {
    return { found: false, orderId: null, total: null, kind: null, reason: 'checkout response carries no order artefact' };
  }
  return {
    found: true,
    orderId: artefact.orderId,
    total: artefact.total,
    kind: artefact.kind,
    reason: `checkout returned an order artefact (${artefact.kind}${artefact.orderId ? `, order ${artefact.orderId}` : ''}${artefact.total != null ? `, total ${artefact.total}` : ''})`,
  };
}

/**
 * Judge the empty-basket (second) checkout against the control
 * checkout's artefact. 'confirmed' only when the server created a
 * DISTINCT order for the empty basket; the same order id is an
 * idempotent replay, never a finding. Pure.
 */
export function assessEmptyCheckout(control, testStatus, testBody) {
  if (typeof testStatus !== 'number' || testStatus < 200 || testStatus >= 300) {
    return { verdict: 'rejected', reason: `server refused the empty-basket checkout (HTTP ${testStatus})` };
  }
  const test = findOrderArtefact(testBody);
  if (!test) {
    return { verdict: 'rejected', reason: 'empty-basket checkout returned no order artefact' };
  }
  if (control && control.orderId && test.orderId && control.orderId === test.orderId) {
    return { verdict: 'replayed', reason: `server returned the same order id ${test.orderId} — idempotent replay, not a new order` };
  }
  return {
    verdict: 'confirmed',
    reason: `server created a distinct order artefact for an empty basket (${test.kind}${test.orderId ? `, order ${test.orderId}` : ''}${test.total != null ? `, total ${test.total}` : ''})`,
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

// One API login attempt: {email,password} then {username,password}.
// Mirrors sessionFixation's tryApiLogin / basketLogic's copy.
// Returns { ok, token, body, spent }.
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

export async function probeWorkflowSkip(url, opts = {}) {
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
  const checkoutRoute = basketCheckoutRoute(routes, origin);
  if (!basketRoute || !checkoutRoute) return findings;
  setDiag('workflowRoutes', 1);
  const { collection: itemCollection } = basketItemRoutes(routes, origin);

  // Login (shared budget, same as basket-logic): exact /login
  // candidates first, decoy routes skipped after one POST each.
  const loginUrls = loginCandidates(routes, origin).slice(0, MAX_LOGIN_CANDIDATES);
  if (!loginUrls.length) return findings;
  let token = null;
  let basketId = null;
  let postsLeft = MAX_LOGIN_POSTS;
  for (const candidate of loginUrls) {
    if (postsLeft <= 0) break;
    const got = await tryApiLogin(fetchFn, candidate, creds, postsLeft);
    postsLeft -= got.spent;
    if (got.ok) {
      token = got.token;
      basketId = extractBasketId(got.body);
      break;
    }
  }
  if (!token) return findings;
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
  const checkoutUrl = fillCheckoutBasketId(checkoutRoute, basketId);
  if (!basketUrl || !checkoutUrl) return findings;
  const readBasket = async () => {
    const r = await req(fetchFn, basketUrl, { token });
    if (!r || r.status !== 200 || !r.json) return null;
    const parsed = parseBasket(r.json);
    return parsed.ok ? parsed : null;
  };
  let basket = await readBasket();
  if (!basket) return findings;

  // Seed an empty basket with the cheapest product (one unit), so
  // the control checkout has an item to check out. Without a
  // collection route there is nothing to seed with — honest [].
  if (!basket.items.length) {
    if (!itemCollection) return findings;
    const productUrl = productListRoute(routes, origin);
    if (!productUrl) return findings;
    const pr = await req(fetchFn, stripQuery(productUrl), { token });
    const products = pr && pr.json ? parseProductList(pr.json) : [];
    if (!products.length) return findings;
    const cheapest = products[0];
    const add = await req(fetchFn, itemCollection, {
      method: 'POST',
      token,
      body: { BasketId: basketId, ProductId: cheapest.id, quantity: 1 },
    });
    if (!add || add.status < 200 || add.status >= 300) {
      // One camelCase retry — field-name spelling varies by shop.
      const add2 = await req(fetchFn, itemCollection, {
        method: 'POST',
        token,
        body: { basketId, productId: cheapest.id, quantity: 1 },
      });
      if (!add2 || add2.status < 200 || add2.status >= 300) return findings;
    }
    basket = await readBasket();
    if (!basket || !basket.items.length) return findings;
  }

  // THE CONTROL: checkout the non-empty basket. It must return an
  // order artefact — that calibrates the oracle (what an order
  // looks like here) and proves the checkout step works at all. A
  // control with no artefact means the oracle cannot judge the
  // test, so the probe returns [] — a finding without a working
  // control is a guess.
  const controlRes = await req(fetchFn, checkoutUrl, { method: 'POST', token, body: {} });
  if (!controlRes) return findings;
  const control = assessCheckoutOrder(controlRes.status, controlRes.json);
  if (!control.found) return findings;
  setDiag('controlOk', true);

  // THE PRECONDITION: the control checkout must have consumed the
  // basket. Re-read it — it must be EMPTY now, or the test cannot
  // run (its whole point is a checkout with the prerequisite unmet).
  const emptied = await readBasket();
  if (!emptied || emptied.items.length !== 0) return findings;

  // THE TEST: checkout the empty basket — the checkout step with
  // its prerequisite step (adding items) skipped. Confirm ONLY on
  // a distinct order artefact for the empty basket.
  const testRes = await req(fetchFn, checkoutUrl, { method: 'POST', token, body: {} });
  if (!testRes) return findings;
  setDiag('mutations', 1);
  const verdict = assessEmptyCheckout(control, testRes.status, testRes.json);
  if (verdict.verdict !== 'confirmed') return findings;
  findings.push({
    class: 'business_logic',
    id: `ws-empty-checkout-${rand()}`,
    title: 'Business logic — checkout accepted for an empty basket (HIGH)',
    severity: 'high',
    url: checkoutUrl,
    parameter: 'checkout',
    evidence: ev(
      `Control checkout of a non-empty basket (token auth) -> ${control.reason}; re-read basket -> 0 items; POST ${checkoutUrl} on the empty basket (token auth)`,
      `Empty-basket checkout returned an order artefact: ${verdict.reason}. The control order and the empty-basket order are distinct — the server accepted the checkout step with its prerequisite (items in the basket) skipped.`,
      'An attacker reaches checkout — and whatever follows it (payment, fulfilment) — without ever adding an item, because the server never validates that the earlier workflow step happened.',
    ),
  });
  return findings;
}

export const __wsMeta = { phases: ['workflow-skip'], depth: ['standard', 'deep'] };
