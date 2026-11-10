// Dark Matter rule-based scanner — coupon-abuse probe
// (coverage rows #78 [Medium] Coupon / Discount / Referral Abuse
// and #371 [Medium] Logic — Coupon / voucher reuse abuse,
// CWE-840 | OWASP A04:2021; phase 98, 'coupon-abuse').
//
// ORACLE (pure arithmetic, no judge, no LLM, $0): a coupon is a
// discount the server applies to a basket total. With the canary
// lab session we (1) mine a coupon-apply route and a coupon-list
// route from the discovered routes, (2) read the valid coupon
// codes the shop itself lists (a code the shop publishes is the
// only calibratable code — an invented code cannot distinguish
// "invalid coupon" from "reuse rejected", so without a listed
// code the probe returns []), (3) run a CONTROL: apply the first
// listed code once and re-read the total — the total must drop
// by more than EPS, or the oracle is uncalibrated and the probe
// returns [], (4) test REUSE (#371): empty the basket, re-seed
// the cheapest product (a fresh basket), apply the SAME code
// again — CONFIRM only when the same code discounts the fresh
// basket again by at least half the control drop, and (5) test
// STACKING (#78): apply a SECOND listed code on top of the first
// — CONFIRM only when the total falls below the single-coupon
// floor (the undiscounted total minus the better of the two
// known discounts). A server that refuses the second apply, or
// replaces the first coupon with the second (the total lands on
// the better single coupon's price), is 'rejected', never a
// finding. The stacking leg runs only when both codes carry a
// discount percentage the control drop calibrates (the control
// drop must match the first code's percentage within 25%) —
// otherwise the second code's discount is unknown and
// replacement cannot be told apart from stacking.
//
// SURFACE: the coupon endpoints the jsRoutes miner already
// recovers (PUT /rest/basket/:id/coupon/:code on Juice Shop,
// plus a coupon-list route such as GET /api/Coupons) — the probe
// discovers them from opts.apiRoutes (scanTargets +
// jsWriteTargets, wired in by runScan exactly like bfla) and
// never invents a route. The canary's OWN basket id comes from
// the login response (bid/basketId/...) or, failing that, the
// whoami user id (Juice convention: basket id == user id) —
// never a mined filler id, so no other user's basket is ever
// touched.
//
// GATES: labCreds + allowWrite + isLabTargetHost (same lab gate
// as basket-logic / workflow-skip / bfla); depth 'quick' skips
// the probe. BOUND: at most 10 writes total (login 4, seed 2,
// applies 3, emptying 3, restore 1 — legs that cannot run inside
// the budget are skipped, never forced). The coupon stays applied
// to the canary basket (no remove-coupon endpoint is mined) —
// the item quantities are restored best-effort, as in
// basket-logic. Findings are class 'business_logic' — the
// default confirmation protocol judges them on signalCorrelated
// (see differential.js).

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
  seedFirstAddableProduct,
} from './basketLogic.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const TIMEOUT_MS = 15000;
const MAX_LOGIN_CANDIDATES = 3;
const MAX_LOGIN_POSTS = 4;
const MAX_TOTAL_POSTS = 10;
const MAX_COUPON_ROUTES = 3;
const MAX_LIST_ROUTES = 2;
const MAX_CODES = 5;
const MAX_EMPTY_ITEMS = 3;
const EPS = 0.01;
const WHOAMI_RE = /whoami|\/me$|\/profile$|\/user\/whoami/i;
const MARKER_SEGMENT_RE = /^(coupons?|discounts?|vouchers?|promos?)$/i;
const VERB_SEGMENT_RE = /^(apply|redeem|use|validate|check)$/i;
const RESOURCE_SEGMENT_RE =
  /^(basket|baskets|cart|carts|coupons?|discounts?|vouchers?|promos?|api|rest|v\d+|apply|redeem|use)$/i;
const BASKET_SEGMENT_RE = /^(basket|baskets|cart|carts)$/i;
const CODE_FIELDS = ['code', 'coupon', 'couponCode', 'discountCode', 'voucherCode', 'promoCode'];
const DISCOUNT_FIELDS = ['discount', 'percentage', 'percent', 'discountPercent', 'discountPercentage'];

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

function segmentsOf(routeUrl) {
  return pathOf(routeUrl)
    .split('/')
    .filter(Boolean);
}

// ---- route discovery (pure) -------------------------------------------------

/**
 * Coupon-apply routes from the mined set: the pathname carries a
 * whole coupon/discount/voucher/promo segment that is NOT the last
 * segment (PUT /rest/basket/:id/coupon/:code), or the marker IS the
 * last segment but a basket/cart segment precedes it (the code then
 * travels in the request body). A bare list route
 * (/api/Coupons) is NOT an apply route. Pure.
 */
export function findCouponApplyRoutes(routes, origin) {
  const out = [];
  for (const r of routes || []) {
    if (!sameOrigin(r, origin)) continue;
    const segs = segmentsOf(r);
    const idx = segs.findIndex((s) => MARKER_SEGMENT_RE.test(s));
    if (idx < 0) continue;
    const isLast = idx === segs.length - 1;
    if (isLast && !segs.some((s) => BASKET_SEGMENT_RE.test(s))) continue;
    const s = stripQuery(r);
    if (!out.includes(s)) out.push(s);
  }
  return out.slice(0, MAX_COUPON_ROUTES);
}

/**
 * Coupon-list routes from the mined set: the pathname's LAST
 * segment is a whole coupon/discount/voucher/promo word and no
 * basket/cart segment precedes it (GET /api/Coupons). Pure.
 */
export function findCouponListRoutes(routes, origin) {
  const out = [];
  for (const r of routes || []) {
    if (!sameOrigin(r, origin)) continue;
    const segs = segmentsOf(r);
    if (!segs.length) continue;
    if (!MARKER_SEGMENT_RE.test(segs[segs.length - 1])) continue;
    if (segs.some((s) => BASKET_SEGMENT_RE.test(s))) continue;
    const s = stripQuery(r);
    if (!out.includes(s)) out.push(s);
  }
  return out.slice(0, MAX_LIST_ROUTES);
}

/**
 * Fill a mined coupon-apply template with the canary's basket id
 * and a coupon code. The segment before the marker is the basket
 * id (replaced unless it is a resource word); the segment after
 * the marker is the code (replaced unless it is a verb such as
 * 'apply' — then the code travels in the JSON body). Returns
 * { url, codeInBody } or null when no marker segment exists.
 * Pure.
 */
export function fillCouponRoute(routeUrl, basketId, code) {
  const segs = segmentsOf(routeUrl);
  const idx = segs.findIndex((s) => MARKER_SEGMENT_RE.test(s));
  if (idx < 0) return null;
  if (idx > 0 && !RESOURCE_SEGMENT_RE.test(segs[idx - 1])) {
    segs[idx - 1] = encodeURIComponent(String(basketId));
  }
  let codeInBody = true;
  if (idx + 1 < segs.length && !VERB_SEGMENT_RE.test(segs[idx + 1])) {
    segs[idx + 1] = encodeURIComponent(String(code));
    codeInBody = false;
  }
  let u;
  try {
    u = new URL(String(routeUrl));
  } catch {
    return null;
  }
  u.pathname = `/${segs.join('/')}`;
  u.search = '';
  return { url: u.toString(), codeInBody };
}

// ---- coupon-list parsing (pure) ---------------------------------------------

/**
 * Parse a coupon-list body into [{ code, discount }]. Accepts a
 * top-level array, or an array under .data / .coupons /
 * .data.coupons. discount is the first numeric discount-like
 * field (null when the record carries none). Pure.
 */
export function parseCouponList(body) {
  const arrays = [];
  if (Array.isArray(body)) arrays.push(body);
  if (body && typeof body === 'object') {
    if (Array.isArray(body.data)) arrays.push(body.data);
    if (Array.isArray(body.coupons)) arrays.push(body.coupons);
    if (body.data && typeof body.data === 'object' && Array.isArray(body.data.coupons)) {
      arrays.push(body.data.coupons);
    }
  }
  const out = [];
  const seen = new Set();
  for (const arr of arrays) {
    for (const entry of arr) {
      if (!entry || typeof entry !== 'object') continue;
      let code = null;
      for (const f of CODE_FIELDS) {
        const v = entry[f];
        if (typeof v === 'string' && v.trim().length > 0 && v.trim().length <= 64) {
          code = v.trim();
          break;
        }
      }
      if (!code || seen.has(code)) continue;
      let discount = null;
      for (const f of DISCOUNT_FIELDS) {
        const v = entry[f];
        if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
          discount = v;
          break;
        }
      }
      seen.add(code);
      out.push({ code, discount });
      if (out.length >= MAX_CODES) return out;
    }
  }
  return out;
}

// ---- the oracles (pure) -----------------------------------------------------

/**
 * Judge the control apply: the total must drop by more than EPS.
 * 'confirmed' calibrates the oracle (a valid code + a discount
 * that moves the total); anything else is uncalibrated/rejected,
 * never a finding. Pure.
 */
export function assessCouponControl(beforeTotal, afterTotal) {
  if (!Number.isFinite(beforeTotal) || !Number.isFinite(afterTotal)) {
    return { verdict: 'unconfirmed', reason: 'basket total unreadable' };
  }
  const drop = beforeTotal - afterTotal;
  if (drop > EPS) {
    return { verdict: 'confirmed', reason: `coupon dropped the total by ${drop.toFixed(2)}`, drop };
  }
  return { verdict: 'rejected', reason: 'applying the coupon did not move the total' };
}

/**
 * Judge the reuse leg: the SAME code on a fresh basket must
 * discount it again by at least half the control drop, scaled to
 * the fresh basket's size (the fresh basket may hold a different
 * total than the control basket). Pure.
 */
export function assessCouponReuse(controlDrop, controlTotal, freshBefore, freshAfter) {
  if (!Number.isFinite(freshBefore) || !Number.isFinite(freshAfter) || !Number.isFinite(controlDrop)) {
    return { verdict: 'unconfirmed', reason: 'basket total unreadable' };
  }
  const drop = freshBefore - freshAfter;
  if (drop <= EPS) {
    return { verdict: 'rejected', reason: 're-applying the coupon did not move the fresh basket total' };
  }
  const expected = controlDrop * (controlTotal > 0 ? freshBefore / controlTotal : 1);
  if (drop < 0.5 * expected) {
    return {
      verdict: 'rejected',
      reason: `fresh-basket drop ${drop.toFixed(2)} is far smaller than the control drop ${controlDrop.toFixed(2)} — not the same discount again`,
    };
  }
  return {
    verdict: 'confirmed',
    reason: `the same coupon discounted the fresh basket again by ${drop.toFixed(2)} (control drop ${controlDrop.toFixed(2)})`,
    drop,
  };
}

/**
 * Judge the stacking leg: the total must fall BELOW the
 * single-coupon floor (undiscounted total minus the better of the
 * two known discounts). A server that merely replaces the first
 * coupon with the second lands exactly on the floor — never a
 * finding. Pure.
 */
export function assessCouponStacked(baselineTotal, singleFloor, afterTotal) {
  if (!Number.isFinite(baselineTotal) || !Number.isFinite(singleFloor) || !Number.isFinite(afterTotal)) {
    return { verdict: 'unconfirmed', reason: 'basket total unreadable' };
  }
  if (afterTotal < singleFloor - EPS) {
    return {
      verdict: 'confirmed',
      reason: `total ${afterTotal.toFixed(2)} is below the single-coupon floor ${singleFloor.toFixed(2)} — both discounts applied`,
    };
  }
  return { verdict: 'rejected', reason: `total ${afterTotal.toFixed(2)} did not fall below the single-coupon floor ${singleFloor.toFixed(2)}` };
}

/**
 * Turn a mined discount number into an expected currency drop on a
 * given total. A value in (0, 100] is read as a percentage; a
 * larger value is read as a fixed amount. Returns null when the
 * record carries no discount. Pure.
 */
export function expectedDrop(discount, total) {
  if (typeof discount !== 'number' || !Number.isFinite(discount) || discount <= 0) return null;
  if (!Number.isFinite(total) || total <= 0) return null;
  if (discount <= 100) return (total * discount) / 100;
  return Math.min(discount, total);
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

export async function probeCouponAbuse(url, opts = {}) {
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
  const applyRoutes = findCouponApplyRoutes(routes, origin);
  setDiag('couponRoutes', applyRoutes.length);
  if (!applyRoutes.length) return findings;
  const basketRoute = basketGetRoute(routes, origin);
  if (!basketRoute) return findings;
  const { collection: itemCollection, itemTemplate } = basketItemRoutes(routes, origin);
  const checkoutRoute = basketCheckoutRoute(routes, origin);
  if (!itemCollection && !itemTemplate && !checkoutRoute) return findings;

  // Shared write budget: at most MAX_TOTAL_POSTS writes in total.
  // Every POST/PUT below goes through spend() — a leg that cannot
  // run inside the budget is skipped, never forced.
  let writesLeft = MAX_TOTAL_POSTS;
  const spend = () => {
    if (writesLeft <= 0) return false;
    writesLeft -= 1;
    return true;
  };

  // Login (shared budget, same as basket-logic): exact /login
  // candidates first, decoy routes skipped after one POST each.
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
  let lastBasketJson = null;
  const readBasket = async () => {
    const r = await req(fetchFn, basketUrl, { token });
    if (!r || r.status !== 200 || !r.json) return null;
    lastBasketJson = r.json;
    const parsed = parseBasket(r.json);
    return parsed.ok ? parsed : null;
  };
  let basket = await readBasket();
  if (!basket) return findings;

  // Seed an empty basket with the first addable product (one
  // unit), so the control apply has a total to discount. The
  // cheapest product is tried first, but it is not always addable
  // (Juice: out of stock) — the seeder walks the price list until
  // one adds (see seedFirstAddableProduct). Without a collection
  // route there is nothing to seed with — honest [].
  let seeded = false;
  if (!basket.items.length) {
    if (!itemCollection) return findings;
    const productUrl = productListRoute(routes, origin);
    if (!productUrl) return findings;
    const pr = await req(fetchFn, stripQuery(productUrl), { token });
    const products = pr && pr.json ? parseProductList(pr.json) : [];
    if (!products.length) return findings;
    const seededRes = await seedFirstAddableProduct(fetchFn, { itemCollection, basketId, products, token, canSpend: spend });
    if (!seededRes.ok) return findings;
    basket = await readBasket();
    if (!basket || !basket.items.length) return findings;
    seeded = true;
  }
  const originalQty = basket.items[0] ? basket.items[0].quantity : null;
  let basketEmptied = false;

  // Coupon codes: the shop's own coupon list first, then the
  // basket body itself. Without a listed code the probe cannot
  // calibrate — an invented code cannot distinguish "invalid
  // coupon" from "reuse rejected" — so it returns [].
  let codes = [];
  const listRoutes = findCouponListRoutes(routes, origin);
  for (const listRoute of listRoutes) {
    const r = await req(fetchFn, stripQuery(listRoute), { token });
    if (r && r.status === 200 && r.json) {
      codes = parseCouponList(r.json);
      if (codes.length) break;
    }
  }
  if (!codes.length && lastBasketJson) {
    codes = parseCouponList(lastBasketJson);
  }
  setDiag('couponCodes', codes.length);
  if (!codes.length) return findings;

  // Apply one coupon: PUT the mined template (code in the path,
  // Juice shape) or PUT with a JSON body when the route ends at
  // the marker. The apply method is PUT — the miner records the
  // route from a .put() call in first-party code.
  const applyCoupon = async (code) => {
    const filled = fillCouponRoute(applyRoutes[0], basketId, code);
    if (!filled) return null;
    if (!spend()) return null;
    const r = await req(fetchFn, filled.url, {
      method: 'PUT',
      token,
      body: filled.codeInBody ? { coupon: code } : null,
    });
    if (!r || r.status < 200 || r.status >= 300) return null;
    return readBasket();
  };

  // THE CONTROL: apply the first listed code once. The total must
  // drop — that calibrates the code and the discount mechanics.
  // A control with no drop means the oracle cannot judge the
  // reuse/stacking legs, so the probe returns [] — a finding
  // without a working control is a guess.
  const controlTotal = basket.total;
  let attempts = 0;
  const afterControl = await applyCoupon(codes[0].code);
  attempts += 1;
  setDiag('attempts', attempts);
  if (!afterControl) return findings;
  const control = assessCouponControl(controlTotal, afterControl.total);
  if (control.verdict !== 'confirmed') return findings;
  setDiag('controlOk', true);
  const controlDrop = control.drop;
  // Current basket state after the control: the stacking leg runs
  // on this basket next (it still carries the first coupon).
  const base = controlTotal;
  const d1 = controlDrop;
  const current = afterControl;

  // Empty the basket: set each item quantity to 0 (at most
  // MAX_EMPTY_ITEMS PUTs), or consume it with one checkout when
  // no item route exists. Returns true only when the basket reads
  // empty afterwards.
  const emptyBasket = async () => {
    const cur = await readBasket();
    if (!cur) return false;
    if (!cur.items.length) return true;
    if (itemTemplate) {
      let emptied = 0;
      for (const item of cur.items.slice(0, MAX_EMPTY_ITEMS)) {
        if (!item.basketItemId || !spend()) return false;
        const setUrl = replaceLastSegment(itemTemplate, item.basketItemId);
        if (!setUrl) return false;
        const r = await req(fetchFn, setUrl, { method: 'PUT', token, body: { quantity: 0 } });
        if (!r || r.status < 200 || r.status >= 300) return false;
        emptied += 1;
      }
      const after = await readBasket();
      return Boolean(after && after.items.length === 0);
    }
    if (checkoutRoute) {
      const checkoutUrl = fillCheckoutBasketId(checkoutRoute, basketId);
      if (!checkoutUrl || !spend()) return false;
      const r = await req(fetchFn, checkoutUrl, { method: 'POST', token, body: {} });
      if (!r || r.status < 200 || r.status >= 300) return false;
      const after = await readBasket();
      return Boolean(after && after.items.length === 0);
    }
    return false;
  };

  // Re-seed one first-addable product and return the fresh basket,
  // or null when seeding is impossible.
  const reseed = async () => {
    if (!itemCollection) return null;
    const productUrl = productListRoute(routes, origin);
    if (!productUrl) return null;
    const pr = await req(fetchFn, stripQuery(productUrl), { token });
    const products = pr && pr.json ? parseProductList(pr.json) : [];
    if (!products.length) return null;
    const seededRes = await seedFirstAddableProduct(fetchFn, { itemCollection, basketId, products, token, canSpend: spend });
    if (!seededRes.ok) return null;
    return readBasket();
  };

  // THE STACKING LEG (#78): a SECOND listed code on top of the
  // first. Runs only when both codes carry a discount the control
  // drop calibrates — otherwise replacement cannot be told apart
  // from stacking. Confirm only when the total falls below the
  // single-coupon floor (the better single discount alone).
  let stackedTested = false;
  if (codes.length >= 2 && codes[0].discount != null && codes[1].discount != null) {
    // Calibration is judged on the CONTROL basket (the basket the
    // control drop was measured on), not on the current basket.
    const expected1 = expectedDrop(codes[0].discount, controlTotal);
    const calibrated =
      expected1 != null && Math.abs(controlDrop - expected1) <= Math.max(0.05, 0.25 * controlDrop);
    if (calibrated) {
      const expected2 = expectedDrop(codes[1].discount, base);
      if (expected2 != null) {
        stackedTested = true;
        const singleFloor = base - Math.max(d1, expected2);
        const afterStack = await applyCoupon(codes[1].code);
        attempts += 1;
        setDiag('attempts', attempts);
        if (afterStack) {
          const stacked = assessCouponStacked(base, singleFloor, afterStack.total);
          if (stacked.verdict === 'confirmed') {
            setDiag('bypassKind', 'stacked');
            findings.push({
              class: 'business_logic',
              id: `cp-stacked-${rand()}`,
              title: 'Business logic — two coupons stacked for a double discount (MEDIUM)',
              severity: 'medium',
              url: basketUrl,
              parameter: 'coupon',
              evidence: ev(
                `Basket total ${base} with coupon '${codes[0].code}' applied (total ${current.total}) -> apply a second coupon '${codes[1].code}' (token auth) -> ${afterStack.total}`,
                `The total fell below the single-coupon floor ${singleFloor.toFixed(2)}: ${stacked.reason}. A second coupon must replace the first, never add to it.`,
                'An attacker stacks coupons and discounts an order by more than any single coupon allows.',
              ),
            });
            return findings;
          }
        }
      }
    }
  }
  setDiag('stackedTested', stackedTested);

  // THE REUSE LEG (#371): the SAME code on a FRESH basket.
  // Empty + re-seed, then apply the same code again. Confirm
  // only when the fresh basket is discounted again by at least
  // half the control drop (scaled to the fresh basket's size).
  let reuseTested = false;
  if (await emptyBasket()) {
    basketEmptied = true;
    const fresh = await reseed();
    if (fresh && fresh.items.length && fresh.total > EPS) {
      reuseTested = true;
      const freshTotal = fresh.total;
      const afterReuse = await applyCoupon(codes[0].code);
      attempts += 1;
      setDiag('attempts', attempts);
      if (afterReuse) {
        const reuse = assessCouponReuse(controlDrop, controlTotal, freshTotal, afterReuse.total);
        if (reuse.verdict === 'confirmed') {
          setDiag('bypassKind', 'reuse');
          findings.push({
            class: 'business_logic',
            id: `cp-reuse-${rand()}`,
            title: 'Business logic — coupon code accepted again on a fresh basket (MEDIUM)',
            severity: 'medium',
            url: basketUrl,
            parameter: 'coupon',
            evidence: ev(
              `Control: basket total ${controlTotal} -> apply coupon '${codes[0].code}' once (token auth) -> ${afterControl.total}; emptied the basket, re-seeded one item (fresh total ${freshTotal}) -> apply the SAME coupon '${codes[0].code}' again (token auth) -> ${afterReuse.total}`,
              `The same coupon discounted the fresh basket again: ${reuse.reason}. A single-use coupon must be rejected on its second use.`,
              'An attacker replays a single-use coupon on every fresh basket and discounts every order.',
            ),
          });
          return findings;
        }
      }
    }
  }
  setDiag('reuseTested', reuseTested);

  // Best-effort restore: leave the canary basket as found (original
  // quantity, or quantity 0 when the probe seeded the item or
  // emptied the basket for the reuse leg). The coupon itself stays
  // applied — no remove-coupon endpoint is mined. Never affects
  // findings.
  try {
    const cur = await readBasket();
    if (itemTemplate && cur && cur.items[0] && cur.items[0].basketItemId && spend()) {
      const setUrl = replaceLastSegment(itemTemplate, cur.items[0].basketItemId);
      if (setUrl) {
        await req(fetchFn, setUrl, {
          method: 'PUT',
          token,
          body: { quantity: basketEmptied || seeded ? 0 : originalQty },
        });
      }
    }
  } catch {
    // restore is best-effort
  }

  return findings;
}

export const __couponMeta = { phases: ['coupon-abuse'], depth: ['standard', 'deep'] };
