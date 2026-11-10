// Dark Matter rule-based scanner — basket-logic probe
// (coverage rows #82 [High] Negative Quantity / Amount Abuse,
// #370 [High] Logic — Price / quantity manipulation, variants
// #374 [Medium] Negative / zero quantity abuse, #80 [High]
// Integer Overflow in Calculations, #83 [High] Price / Payment
// Tampering; phase 88, 'basket-logic').
//
// ORACLE (pure arithmetic, no judge, no LLM, $0): a shop basket is
// a ledger — the total is a deterministic function of the items.
// With the canary lab session we (1) read the baseline total,
// (2) run a +1 CONTROL (quantity +1 must raise the total by exactly
// one unit price — if it does not, the oracle is uncalibrated and
// the probe returns []), (3) replay EDGE quantities (-1, 0,
// 2^53-1) and re-read the total. CONFIRM only when the total moves
// the way a vulnerable shop moves it: a negative quantity is
// accepted and the total drops (or goes negative), a huge quantity
// wraps the total down, a tampered checkout price is honoured.
// A same-value replay (set -1 twice) must leave the total
// unchanged, or the observation is drift, not a finding.
//
// SURFACE: the basket endpoints the jsRoutes miner already recovers
// (GET /rest/basket/:id, POST/PUT /api/BasketItems, POST
// /rest/basket/:id/checkout) — the probe discovers them from
// opts.apiRoutes (scanTargets + jsWriteTargets, wired in by runScan
// exactly like session-fixation's T4b) and never invents a route.
// The canary's OWN basket id comes from the login response
// (bid/basketId/...) or, failing that, the whoami user id (Juice
// convention: basket id == user id) — never a mined filler id, so
// no other user's basket is ever touched.
//
// GATES: labCreds + allowWrite + isLabTargetHost (same lab gate as
// session-fixation / file-upload); depth 'quick' skips the probe.
// BOUND: at most 3 edge mutations, at most 4 login POSTs (shared
// budget, same as session-fixation's T4b), one checkout attempt.
// The canary basket is restored best-effort (original quantity, or
// quantity 0 when the probe seeded the item) before checkout.
// SEED (10 Nov 2026, proof #40): the seed walks the price list
// until a product adds (see seedFirstAddableProduct) instead of
// trusting the cheapest product — Juice refuses an out-of-stock
// product with 400, and the cheapest product is the first to drain
// (its stock falls by one per checkout). A control that fails on a
// leftover out-of-stock item resets the canary (clear, re-seed,
// retry once) before bailing. Every early bail records bailStage
// in diagnostics, so the phase record names the stage that failed.
// Findings are class 'business_logic' — the default confirmation
// protocol judges them on signalCorrelated (see differential.js).

import { isLabTargetHost } from '../../labCreds.js';
import { loginCandidates } from './sessionFixation.js';
import { extractBearerTokenFromJson } from '../labSession.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const TIMEOUT_MS = 15000;
const MAX_LOGIN_CANDIDATES = 3;
const MAX_LOGIN_POSTS = 4;
const MAX_EDGE_MUTATIONS = 3;
const HUGE_QTY = 9007199254740991; // 2^53 - 1
const EPS = 0.01;
const TAMPERED_TOTAL = 0.01;
const BASKET_ID_FIELDS = ['bid', 'basketId', 'basket_id', 'cartId', 'cart_id'];
const ORDER_TOTAL_FIELDS = ['totalPrice', 'total', 'orderTotal', 'amount', 'charged', 'grandTotal'];

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

function ev(request, response, impact) {
  return { request, response, impact_demo: impact, signalCorrelated: true };
}

// ---- route discovery (pure) -------------------------------------------------

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

const BASKET_GET_RE = /\/basket\/[^/?#]+$/i;
const ITEM_RESOURCE_RE = /^(basketitems?|cartitems?|basket-items?|cart-items?)$/i;
const CHECKOUT_RE = /\/basket\/[^/?#]+\/checkout$/i;
const PRODUCT_LIST_RE = /\/(api\/products|rest\/products)(\/search)?$/i;
const WHOAMI_RE = /whoami|\/me$|\/profile$|\/user\/whoami/i;

/** First same-origin basket GET route (/rest/basket/:id), or null. Pure. */
export function basketGetRoute(routes, origin) {
  for (const r of routes || []) {
    if (!sameOrigin(r, origin)) continue;
    // A checkout URL ends in /basket/<id>/checkout — it is not a
    // basket read, and GETting it as one would 404 the oracle.
    if (CHECKOUT_RE.test(pathOf(r))) continue;
    if (BASKET_GET_RE.test(pathOf(r))) return String(r);
  }
  return null;
}

/**
 * Basket-item mutation routes from the mined set. Returns
 * { collection, itemTemplate }: the collection URL (POST add) has
 * the resource name as its LAST segment; the item template
 * (PUT set) carries one more segment (a filler id the caller
 * replaces with the real BasketItem id). Pure.
 */
export function basketItemRoutes(routes, origin) {
  let collection = null;
  let itemTemplate = null;
  for (const r of routes || []) {
    if (!sameOrigin(r, origin)) continue;
    const segs = pathOf(r).split('/').filter(Boolean);
    const idx = segs.findIndex((s) => ITEM_RESOURCE_RE.test(s));
    if (idx < 0) continue;
    if (idx === segs.length - 1) {
      if (!collection) collection = String(r);
    } else if (!itemTemplate) {
      itemTemplate = String(r);
    }
  }
  return { collection, itemTemplate };
}

/** First same-origin basket checkout route, or null. Pure. */
export function basketCheckoutRoute(routes, origin) {
  for (const r of routes || []) {
    if (!sameOrigin(r, origin)) continue;
    if (CHECKOUT_RE.test(pathOf(r))) return String(r);
  }
  return null;
}

/** First same-origin product-list route, or null. Pure. */
export function productListRoute(routes, origin) {
  for (const r of routes || []) {
    if (!sameOrigin(r, origin)) continue;
    if (PRODUCT_LIST_RE.test(pathOf(r))) return String(r);
  }
  return null;
}

/** Replace the LAST path segment of a URL (basket id / item id). Pure. */
export function replaceLastSegment(routeUrl, value) {
  try {
    const u = new URL(String(routeUrl));
    const parts = u.pathname.split('/').filter(Boolean);
    if (!parts.length) return null;
    parts[parts.length - 1] = encodeURIComponent(String(value));
    u.pathname = `/${parts.join('/')}`;
    u.search = '';
    return u.toString();
  } catch {
    return null;
  }
}

/** Fill the canary basket id into a basket GET route. Pure. */
export function fillBasketId(routeUrl, basketId) {
  return replaceLastSegment(routeUrl, basketId);
}

/** Fill the canary basket id into a checkout route (segment before 'checkout'). Pure. */
export function fillCheckoutBasketId(routeUrl, basketId) {
  try {
    const u = new URL(String(routeUrl));
    const parts = u.pathname.split('/').filter(Boolean);
    const ci = parts.findIndex((s) => s.toLowerCase() === 'checkout');
    if (ci <= 0) return null;
    // /rest/basket/checkout carries no id segment at all — the
    // segment before 'checkout' is the resource name itself.
    if (parts[ci - 1].toLowerCase() === 'basket') return null;
    parts[ci - 1] = encodeURIComponent(String(basketId));
    u.pathname = `/${parts.join('/')}`;
    u.search = '';
    return u.toString();
  } catch {
    return null;
  }
}

// ---- basket / product parsing (pure) ----------------------------------------

/**
 * Parse a basket GET body into { ok, total, items }. Juice shape:
 * { data: { totalPrice, Products: [{ id, price, totalPrice,
 * BasketItem: { id, quantity } }] } } — tolerated variants: a bare
 * body (no .data), products/items keys, quantity/price at top level.
 * Returns { ok:false } when the body is not a basket at all.
 */
export function parseBasket(body) {
  const data =
    body && typeof body === 'object'
      ? body.data && typeof body.data === 'object'
        ? body.data
        : body
      : null;
  if (!data) return { ok: false };
  const rawItems = data.Products || data.products || data.items || data.Items || null;
  if (!Array.isArray(rawItems)) return { ok: false };
  const items = [];
  for (const it of rawItems) {
    if (!it || typeof it !== 'object') continue;
    const join = it.BasketItem || it.basketItem || null;
    const basketItemId =
      join && join.id != null ? join.id : it.basketItemId != null ? it.basketItemId : it.id;
    const quantity =
      join && join.quantity != null ? Number(join.quantity) : Number(it.quantity);
    const unitPrice =
      it.price != null ? Number(it.price) : it.unitPrice != null ? Number(it.unitPrice) : null;
    let totalPrice = it.totalPrice != null ? Number(it.totalPrice) : null;
    if ((totalPrice == null || !Number.isFinite(totalPrice)) && unitPrice != null && Number.isFinite(unitPrice) && Number.isFinite(quantity)) {
      totalPrice = unitPrice * quantity;
    }
    items.push({
      basketItemId: basketItemId != null ? String(basketItemId) : null,
      productId: it.ProductId != null ? it.ProductId : it.productId != null ? it.productId : it.id,
      quantity: Number.isFinite(quantity) ? quantity : null,
      unitPrice: unitPrice != null && Number.isFinite(unitPrice) ? unitPrice : null,
      totalPrice: totalPrice != null && Number.isFinite(totalPrice) ? totalPrice : null,
    });
  }
  let total = data.totalPrice != null ? Number(data.totalPrice) : data.total != null ? Number(data.total) : null;
  if (total == null || !Number.isFinite(total)) {
    total = items.reduce((a, i) => a + (i.totalPrice || 0), 0);
  }
  return { ok: true, total, items };
}

/** Parse a product-list body into [{ id, price }] cheapest first. Pure. */
export function parseProductList(body) {
  const data =
    body && typeof body === 'object'
      ? Array.isArray(body.data)
        ? body.data
        : Array.isArray(body)
          ? body
          : []
      : [];
  const out = [];
  for (const p of data) {
    if (!p || typeof p !== 'object' || p.id == null) continue;
    const price = p.price != null ? Number(p.price) : null;
    if (price == null || !Number.isFinite(price) || price < 0) continue;
    out.push({ id: p.id, price });
  }
  return out.sort((a, b) => a.price - b.price);
}

// ---- id / total extraction (pure) -------------------------------------------

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

/** The canary's OWN basket id from a login response body (bid / basketId / ...). Pure. */
export function extractBasketId(body) {
  return findField(body, BASKET_ID_FIELDS);
}

/** Shallow-recursive order-total hunt (totalPrice / total / ...). Pure. */
export function findOrderTotal(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 3) return null;
  for (const k of ORDER_TOTAL_FIELDS) {
    const v = node[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  for (const v of Object.values(node)) {
    const f = findOrderTotal(v, depth + 1);
    if (f != null) return f;
  }
  return null;
}

// ---- the oracle (pure) ------------------------------------------------------

/**
 * Judge one edge mutation against the before/after basket reads.
 * mutation: { kind: 'set'|'add', quantity, unitPrice, itemId }.
 * 'confirmed' only when the total moves the way a vulnerable shop
 * moves it; a server that rejects, clamps or removes the edge
 * quantity is 'rejected', never a finding.
 */
export function assessBasketManipulation(baseline, after, mutation) {
  if (!baseline || !after || !Number.isFinite(after.total) || !Number.isFinite(baseline.total)) {
    return { verdict: 'unconfirmed', reason: 'basket total unreadable' };
  }
  const q = mutation.quantity;
  if (q < 0) {
    if (after.total < 0) return { verdict: 'confirmed', reason: 'basket total went negative' };
    if (mutation.kind === 'set') {
      const item = (after.items || []).find((i) => String(i.basketItemId) === String(mutation.itemId));
      if (!item) return { verdict: 'rejected', reason: 'server removed the item instead of applying the negative quantity' };
      if (item.quantity != null && item.quantity < 0 && after.total < baseline.total) {
        return { verdict: 'confirmed', reason: 'item persists with negative quantity and the total dropped' };
      }
      return { verdict: 'rejected', reason: 'server clamped the negative quantity (item now quantity ' + String(item.quantity) + ')' };
    }
    if (after.total < baseline.total) {
      return { verdict: 'confirmed', reason: 'adding a negative quantity reduced the total' };
    }
    return { verdict: 'rejected', reason: 'negative-quantity add did not reduce the total' };
  }
  if (q === 0) {
    if (after.total < 0) return { verdict: 'confirmed', reason: 'basket total went negative after a zero quantity' };
    return { verdict: 'rejected', reason: 'zero quantity behaved like a removal / no-op' };
  }
  if (q >= HUGE_QTY) {
    if (after.total < 0) return { verdict: 'confirmed', reason: 'basket total went negative after a huge quantity' };
    if (after.total < baseline.total) {
      return { verdict: 'confirmed', reason: 'basket total wrapped down after a huge positive quantity' };
    }
    return { verdict: 'rejected', reason: 'huge quantity totalled as expected' };
  }
  return { verdict: 'unconfirmed', reason: 'not an edge quantity' };
}

/** Judge a tampered checkout: the order total must BE the tampered amount. Pure. */
export function assessCheckoutTamper(responseBody, tamperedTotal) {
  const orderTotal = findOrderTotal(responseBody);
  if (orderTotal == null) return { verdict: 'unconfirmed', reason: 'checkout response carries no order total' };
  if (Math.abs(orderTotal - tamperedTotal) <= 0.005) {
    return { verdict: 'confirmed', reason: `order total is the tampered ${tamperedTotal}` };
  }
  return { verdict: 'rejected', reason: `order total is ${orderTotal}, not the tampered ${tamperedTotal}` };
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
// Mirrors sessionFixation's tryApiLogin. Returns { ok, token, body, spent }.
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

// ---- shared canary seeding --------------------------------------------------

const OUT_OF_STOCK_RE = /out of stock/i;

/**
 * True when a basket-item add/update answer is the shop refusing
 * for stock reasons (Juice: HTTP 400 "We are out of stock!"). Pure.
 */
export function isOutOfStockResponse(res) {
  if (!res || res.status !== 400) return false;
  const text = typeof res.text === 'string' ? res.text : res.json ? JSON.stringify(res.json) : '';
  return OUT_OF_STOCK_RE.test(text);
}

/** How many cheapest products the seeder tries before giving up. */
export const MAX_SEED_PRODUCTS = 5;

/**
 * Add one unit of the first addable product (price order) to the
 * canary basket. A shop can refuse a product outright — Juice
 * answers 400 "out of stock" once the product's stock is exhausted
 * (its Quantity row drains by one per checkout, and the cheapest
 * product is the one every probe seeds, so it is the first to hit
 * zero — live 10 Nov 2026: product 9 at quantity -1) — so the
 * cheapest product is not always addable, and a seed that tries
 * only it bails on a healthy shop. Tries each product in order (at
 * most maxProducts); a 400 that names out-of-stock moves straight
 * to the next product (field spelling cannot change stock), any
 * other failure gets one camelCase retry for the same product
 * first. `canSpend`, when given, gates every POST (a probe that
 * runs out of write budget stops seeding instead of forcing it).
 * Returns { ok:true, productId, attempts } or
 * { ok:false, reason, attempts }.
 */
export async function seedFirstAddableProduct(fetchFn, { itemCollection, basketId, products, token, maxProducts = MAX_SEED_PRODUCTS, canSpend = null } = {}) {
  let attempts = 0;
  for (const product of (products || []).slice(0, maxProducts)) {
    if (product == null || product.id == null) continue;
    if (canSpend && !canSpend()) return { ok: false, reason: 'write-budget-exhausted', attempts };
    attempts += 1;
    const add = await req(fetchFn, itemCollection, {
      method: 'POST',
      token,
      body: { BasketId: basketId, ProductId: product.id, quantity: 1 },
    });
    if (add && add.status >= 200 && add.status < 300) {
      return { ok: true, productId: product.id, attempts };
    }
    if (add && isOutOfStockResponse(add)) continue;
    if (canSpend && !canSpend()) return { ok: false, reason: 'write-budget-exhausted', attempts };
    // One camelCase retry — field-name spelling varies by shop.
    const add2 = await req(fetchFn, itemCollection, {
      method: 'POST',
      token,
      body: { basketId, productId: product.id, quantity: 1 },
    });
    if (add2 && add2.status >= 200 && add2.status < 300) {
      return { ok: true, productId: product.id, attempts };
    }
  }
  return { ok: false, reason: 'no addable product', attempts };
}

// ---- the probe ---------------------------------------------------------------

export async function probeBasketLogic(url, opts = {}) {
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
  const { collection: itemCollection, itemTemplate } = basketItemRoutes(routes, origin);
  if (!itemCollection && !itemTemplate) return findings;

  // Login (shared budget, same as session-fixation T4b): exact /login
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
  if (!token) { setDiag('bailStage', 'login'); return findings; }
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
  if (!basketId) { setDiag('bailStage', 'login'); return findings; }
  setDiag('basketId', true);

  const basketUrl = fillBasketId(basketRoute, basketId);
  if (!basketUrl) return findings;
  const readBasket = async () => {
    const r = await req(fetchFn, basketUrl, { token });
    if (!r || r.status !== 200 || !r.json) return null;
    const parsed = parseBasket(r.json);
    return parsed.ok ? parsed : null;
  };
  let basket = await readBasket();
  if (!basket) { setDiag('bailStage', 'basket-read'); return findings; }

  // Seed an empty basket with the first addable product (one unit),
  // so the control and the edges have an item to mutate. The
  // cheapest product is tried first, but it is not always addable —
  // a shop can refuse it outright (Juice: out of stock), so the
  // seeder walks the price list until one adds (see
  // seedFirstAddableProduct). Without a collection route there is
  // nothing to seed with — honest [].
  let seeded = false;
  if (!basket.items.length) {
    if (!itemCollection) { setDiag('bailStage', 'seed'); return findings; }
    const productUrl = productListRoute(routes, origin);
    if (!productUrl) { setDiag('bailStage', 'seed'); return findings; }
    const pr = await req(fetchFn, stripQuery(productUrl), { token });
    const products = pr && pr.json ? parseProductList(pr.json) : [];
    if (!products.length) { setDiag('bailStage', 'seed'); return findings; }
    const seededRes = await seedFirstAddableProduct(fetchFn, { itemCollection, basketId, products, token });
    setDiag('seedAttempts', seededRes.attempts);
    if (seededRes.ok) setDiag('seedProductId', seededRes.productId);
    if (!seededRes.ok) { setDiag('bailStage', 'seed'); return findings; }
    basket = await readBasket();
    if (!basket || !basket.items.length) { setDiag('bailStage', 'seed'); return findings; }
    seeded = true;
  }

  // THE CONTROL: +1 on the first item must raise the total by
  // exactly one unit price. If it does not, the oracle is
  // uncalibrated (totals do not track quantity here) and the probe
  // returns [] — a finding without a working control is a guess.
  // One retry after a reset: the basket may hold a leftover item
  // the shop refuses to grow (an out-of-stock product left by an
  // earlier phase — its stock drained after it was added), so a
  // failed control clears the canary to a known state, re-seeds
  // the first addable product, and runs the control once more. A
  // control that fails twice is an honest bail, never a guess.
  const runControl = async (base) => {
    const item = base.items[0];
    if (!item || item.unitPrice == null || item.quantity == null || !item.basketItemId) {
      return { ok: false, baseline: base };
    }
    const price = item.unitPrice;
    const qty = item.quantity;
    if (itemTemplate) {
      const setUrl = replaceLastSegment(itemTemplate, item.basketItemId);
      if (setUrl) {
        const r = await req(fetchFn, setUrl, { method: 'PUT', token, body: { quantity: qty + 1 } });
        if (r && r.status >= 200 && r.status < 300) {
          const after = await readBasket();
          if (after && Math.abs(after.total - base.total - price) <= EPS) {
            return { ok: true, baseline: after, unitPrice: price, originalQty: qty };
          }
        }
      }
    }
    if (itemCollection) {
      // Add-semantics control: one more unit of the same product.
      const add = await req(fetchFn, itemCollection, {
        method: 'POST',
        token,
        body: { BasketId: basketId, ProductId: item.productId, quantity: 1 },
      });
      if (add && add.status >= 200 && add.status < 300) {
        const after = await readBasket();
        if (after && Math.abs(after.total - base.total - price) <= EPS) {
          return { ok: true, baseline: after, unitPrice: price, originalQty: qty };
        }
      }
    }
    return { ok: false, baseline: base };
  };
  // Remove every item from the canary basket (quantity 0). Juice
  // skips its stock check for a zero quantity, so this also clears
  // items of products that are out of stock now.
  const clearBasket = async () => {
    if (!itemTemplate) return false;
    const cur = await readBasket();
    if (!cur) return false;
    for (const item of cur.items) {
      if (!item.basketItemId) continue;
      const setUrl = replaceLastSegment(itemTemplate, item.basketItemId);
      if (setUrl) await req(fetchFn, setUrl, { method: 'PUT', token, body: { quantity: 0 } });
    }
    const after = await readBasket();
    return !!after && after.items.length === 0;
  };

  let baseline = basket;
  let unitPrice = null;
  let originalQty = null;
  let control = await runControl(baseline);
  if (!control.ok) {
    setDiag('controlReset', true);
    const cleared = await clearBasket();
    if (cleared && itemCollection) {
      const productUrl = productListRoute(routes, origin);
      const pr = productUrl ? await req(fetchFn, stripQuery(productUrl), { token }) : null;
      const products = pr && pr.json ? parseProductList(pr.json) : [];
      const reseeded = products.length
        ? await seedFirstAddableProduct(fetchFn, { itemCollection, basketId, products, token })
        : { ok: false };
      if (reseeded.ok) {
        setDiag('seedAttempts', reseeded.attempts);
        setDiag('seedProductId', reseeded.productId);
        const fresh = await readBasket();
        if (fresh && fresh.items.length) {
          baseline = fresh;
          seeded = true;
          control = await runControl(baseline);
        }
      }
    }
  }
  if (!control.ok) { setDiag('bailStage', 'control'); return findings; }
  baseline = control.baseline;
  unitPrice = control.unitPrice;
  originalQty = control.originalQty;
  setDiag('controlOk', true);

  // Edge mutations (at most MAX_EDGE_MUTATIONS). Each is judged by
  // the pure assessor; a confirmed 'set' edge must ALSO survive a
  // same-value replay (re-set the same quantity — the total must
  // not move, or the observation is drift).
  let mutations = 0;
  const mutateSet = async (qty, count) => {
    if (!itemTemplate) return null;
    const cur = baseline.items[0];
    if (!cur || !cur.basketItemId) return null;
    const setUrl = replaceLastSegment(itemTemplate, cur.basketItemId);
    if (!setUrl) return null;
    const r = await req(fetchFn, setUrl, { method: 'PUT', token, body: { quantity: qty } });
    if (!r || r.status < 200 || r.status >= 300) return null;
    if (count) mutations += 1;
    return readBasket();
  };
  const mutateAdd = async (qty, count) => {
    if (!itemCollection) return null;
    const cur = baseline.items[0];
    if (!cur || cur.productId == null) return null;
    const r = await req(fetchFn, itemCollection, {
      method: 'POST',
      token,
      body: { BasketId: basketId, ProductId: cur.productId, quantity: qty },
    });
    if (!r || r.status < 200 || r.status >= 300) return null;
    if (count) mutations += 1;
    return readBasket();
  };

  const runEdge = async (qty, title, severity, impact) => {
    if (mutations >= MAX_EDGE_MUTATIONS) return;
    const pre = baseline;
    const preItem = pre.items[0];
    if (!preItem) return;
    let after = null;
    let kind = null;
    if (itemTemplate) {
      after = await mutateSet(qty, true);
      kind = 'set';
    }
    if (!after && itemCollection) {
      after = await mutateAdd(qty, true);
      kind = 'add';
    }
    if (!after) return;
    const verdict = assessBasketManipulation(pre, after, {
      kind,
      quantity: qty,
      unitPrice,
      itemId: preItem.basketItemId,
    });
    if (verdict.verdict !== 'confirmed') {
      baseline = after;
      return;
    }
    let replayNote = 'no replay control applies to add semantics';
    if (kind === 'set') {
      const replay = await mutateSet(qty, false);
      if (!replay || Math.abs(replay.total - after.total) > EPS) {
        baseline = replay || after;
        return;
      }
      baseline = replay;
      replayNote = 'same-value replay left the total unchanged';
    } else {
      baseline = after;
    }
    findings.push({
      class: 'business_logic',
      id: `bl-edge-${rand()}`,
      title,
      severity,
      url: basketUrl,
      parameter: `basket-item-${preItem.basketItemId}`,
      evidence: ev(
        `Baseline total ${pre.total} -> ${kind === 'set' ? `PUT quantity ${qty}` : `POST add quantity ${qty}`} on basket item ${preItem.basketItemId} (token auth) -> GET basket`,
        `Total ${pre.total} -> ${after.total}; ${verdict.reason}. +1 control raised the total by exactly the unit price ${unitPrice}; ${replayNote}.`,
        impact,
      ),
    });
  };

  await runEdge(
    -1,
    'Business logic — negative quantity reduces the basket total (HIGH)',
    'high',
    'An attacker pays less than the item price — or drives the total negative and gets paid — by setting a negative quantity.'
  );
  await runEdge(
    0,
    'Business logic — zero-quantity item corrupts the basket total (MEDIUM)',
    'medium',
    'A zero-quantity item corrupts the basket ledger — the total no longer reflects what is in the basket.'
  );
  await runEdge(
    HUGE_QTY,
    'Business logic — oversized quantity wraps the basket total (HIGH)',
    'high',
    'An oversized quantity wraps the basket total down — the shop charges far less than the items are worth.'
  );

  // Best-effort restore: leave the canary basket as found (original
  // quantity, or quantity 0 when the probe seeded the item, which
  // removes it). Never affects findings.
  try {
    const cur = baseline.items[0];
    if (itemTemplate && cur && cur.basketItemId && cur.quantity !== (seeded ? 0 : originalQty)) {
      const setUrl = replaceLastSegment(itemTemplate, cur.basketItemId);
      if (setUrl) {
        await req(fetchFn, setUrl, { method: 'PUT', token, body: { quantity: seeded ? 0 : originalQty } });
      }
    }
  } catch {
    // restore is best-effort
  }

  // #83 — PRICE TAMPER AT CHECKOUT: one POST with a tampered total.
  // Fires ONLY when the response shows an order total equal to the
  // tampered amount. A server that ignores the body and charges the
  // real total is 'rejected', never a finding.
  const checkoutRoute = basketCheckoutRoute(routes, origin);
  if (checkoutRoute) {
    const checkoutUrl = fillCheckoutBasketId(checkoutRoute, basketId);
    if (checkoutUrl) {
      const r = await req(fetchFn, checkoutUrl, {
        method: 'POST',
        token,
        body: { totalPrice: TAMPERED_TOTAL, total: TAMPERED_TOTAL },
      });
      if (r && r.status >= 200 && r.status < 300 && r.json) {
        const v = assessCheckoutTamper(r.json, TAMPERED_TOTAL);
        if (v.verdict === 'confirmed') {
          findings.push({
            class: 'business_logic',
            id: `bl-checkout-${rand()}`,
            title: 'Business logic — tampered price accepted at checkout (HIGH)',
            severity: 'high',
            url: checkoutUrl,
            parameter: 'checkout',
            evidence: ev(
              `POST ${checkoutUrl} with a tampered totalPrice of ${TAMPERED_TOTAL} (token auth)`,
              `Checkout response shows an order total of ${TAMPERED_TOTAL}: ${v.reason}. The basket total before checkout was ${baseline.total}.`,
              'An attacker checks out for pennies by tampering the price the checkout charges.',
            ),
          });
        }
      }
    }
  }

  setDiag('mutations', mutations);
  return findings;
}

export const __blMeta = { phases: ['basket-logic'], depth: ['standard', 'deep'] };
