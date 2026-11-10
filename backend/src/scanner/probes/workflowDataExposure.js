// Dark Matter rule-based scanner — workflow data-exposure probe
// (coverage row #375 [Medium] Logic — Excessive data exposure in
// workflows, CWE-200 | OWASP A04:2021; phase 103,
// 'workflow-data-exposure').
//
// ORACLE (deterministic, no judge, no LLM, $0): a workflow step
// returns exactly the data that step needs. A workflow response
// that carries data beyond the step's need is excessive exposure —
// the row's lab note names exactly the observable test: "inspect
// lab workflow responses for extra fields." The probe walks the
// authenticated workflow the scanner already knows (login ->
// basket -> whoami -> address -> checkout, the same surface as
// basket-logic / workflow-skip) with the canary lab session and
// inspects each step's genuine server response. It CONFIRMS only
// on a field that is excessive BY CONSTRUCTION — a field no
// workflow step can legitimately need in its response:
//   (S) secret material — a password / password hash, a secret or
//       API/private key, a TOTP/setup secret, or a full card
//       number / CVV. No step displays these; their presence in
//       a response is exposure, not function.
//   (U) another user's data — an email-typed field in a workflow
//       response that is not the canary's own email (the canary
//       email is read from the login response itself, so the
//       comparison is calibrated, not guessed).
// A response with neither is a proven true negative for that step,
// not a finding. The first confirmed step ends the probe (max 1
// finding).
//
// DELIBERATE EXCLUSIONS (a tight allowlist is what keeps this
// probe from filing noise — the scout's main warning):
// - The session token itself (token / accessToken / jwt): the
//   login step legitimately returns it, so it is never flagged.
// - Ordinary ids (id, userId, basketId, productId, orderId):
//   the workflow needs them to function; flagging them would be
//   noise. An internal id is only excessive when it identifies
//   another user, which tier (U) already covers via email.
// - role / isAdmin flags: an admin flag in a workflow response
//   overlaps BFLA (#340) — not claimed here.
// - Any response outside the five workflow steps: general API
//   exposure is row #5 (standing reject). This probe inspects
//   ONLY workflow-step responses, never arbitrary mined routes.
// - Non-JSON responses (the SPA shell, redirects): a step that
//   answers HTML proves nothing about its API data.
//
// SURFACE: the basket / checkout / address / whoami endpoints the
// jsRoutes miner already recovers — the probe discovers them from
// opts.apiRoutes (scanTargets + jsWriteTargets, wired in by
// runScan exactly like bfla / coupon-abuse) and never invents a
// route. The canary's OWN basket id comes from the login response
// (bid/basketId/...) or, failing that, the whoami user id (Juice
// convention: basket id == user id) — never a mined filler id, so
// no other user's basket is ever touched. The control checkout
// consumes the canary basket by design, exactly as in
// workflow-skip.
//
// GATES: labCreds + allowWrite + isLabTargetHost (same lab gate as
// basket-logic / workflow-skip / bfla); depth 'quick' skips the
// probe. BOUND: at most 4 login POSTs (shared budget), at most 1
// seed POST and 1 checkout POST. Findings are class
// 'business_logic' — the default confirmation protocol judges them
// on signalCorrelated (see differential.js).

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
const MAX_ADDRESS_ROUTES = 2;
const MAX_WORKFLOW_STEPS = 5;
const MAX_FLAT_FIELDS = 500;
const MAX_FLAT_DEPTH = 4;
const WHOAMI_RE = /whoami|\/me$|\/profile$|\/user\/whoami/i;
const ADDRESS_SEGMENT_RE = /^(address(es)?)$/i;
const EMAIL_VALUE_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MASKED_VALUE_RE = /^[*•·xX\-_]+$/;

// Field names that are excessive BY CONSTRUCTION in any workflow
// response. Keys are compared after normalisation (lowercase,
// separators stripped), so passwordHash, password_hash and
// PASSWORD-HASH all match. The session token itself is deliberately
// absent: the login step legitimately returns it.
const PASSWORD_KEYS = new Set([
  'password',
  'passwd',
  'pwd',
  'passwordhash',
  'passhash',
  'credentialhash',
  'userpassword',
]);
const SECRET_KEYS = new Set([
  'secret',
  'clientsecret',
  'appsecret',
  'totpsecret',
  'otpsecret',
  'setuptoken',
  'apikey',
  'privatekey',
  'accesskey',
  'secretkey',
  'clientkey',
  'encryptionkey',
]);
const CARD_KEYS = new Set([
  'cardnumber',
  'creditcard',
  'creditcardnumber',
  'cvv',
  'cvc',
  'cardcvv',
  'pan',
  'cardpan',
]);
// Email-typed fields: only these keys can carry tier (U). A bare
// email string inside display text (a product description, a help
// blurb) is not an identity record and is never flagged.
const EMAIL_KEYS = new Set([
  'email',
  'umail',
  'mail',
  'useremail',
  'contactemail',
  'owneremail',
  'accountemail',
]);

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

/** Normalise a field name for allowlist comparison: lowercase, separators stripped. Pure. */
export function normalizeKey(key) {
  return String(key).toLowerCase().replace(/[_.\- ]+/g, '');
}

// ---- route discovery (pure) -------------------------------------------------

/**
 * Address routes from the mined set: the pathname carries a whole
 * 'address' / 'addresses' segment (GET /api/Address on Juice
 * Shop). Pure.
 */
export function findAddressRoutes(routes, origin) {
  const out = [];
  for (const r of routes || []) {
    if (!sameOrigin(r, origin)) continue;
    const segs = segmentsOf(r);
    if (!segs.some((s) => ADDRESS_SEGMENT_RE.test(s))) continue;
    const s = stripQuery(r);
    if (!out.includes(s)) out.push(s);
  }
  return out.slice(0, MAX_ADDRESS_ROUTES);
}

// ---- response flattening + field classification (pure) -----------------------

/**
 * Flatten a JSON response body into [{ path, key, value }] leaves
 * (scalars only, depth-capped, count-capped). Array entries are
 * addressed as [n]. Pure.
 */
export function flattenFields(body, depth = 0, prefix = '') {
  const out = [];
  const walk = (node, path, d) => {
    if (out.length >= MAX_FLAT_FIELDS) return;
    if (node == null) return;
    if (typeof node === 'object') {
      if (d >= MAX_FLAT_DEPTH) return;
      if (Array.isArray(node)) {
        node.forEach((v, i) => walk(v, `${path}[${i}]`, d + 1));
        return;
      }
      for (const [k, v] of Object.entries(node)) {
        walk(v, path ? `${path}.${k}` : k, d + 1);
      }
      return;
    }
    if (typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') {
      // A bare scalar body has no field name and cannot classify.
      if (!path) return;
      const key = path.split('.').pop().replace(/\[\d+\]$/, '');
      out.push({ path, key, value: node });
    }
  };
  walk(body, prefix, depth);
  return out;
}

function isMaskedOrEmpty(value) {
  if (typeof value !== 'string') return false;
  const t = value.trim();
  if (t.length < 4) return true;
  if (MASKED_VALUE_RE.test(t)) return true;
  const low = t.toLowerCase();
  return low === 'null' || low === 'undefined' || low === 'redacted' || low === 'hidden';
}

/**
 * Judge one flattened field. Returns { kind, reason } when the
 * field is excessive by construction, else null. kind is 'secret'
 * (credential / secret / card material no step needs) or
 * 'other-user' (an email-typed field that is not the canary's own
 * email). ownEmail null disables tier (U) — without a calibrated
 * reference any email could be the canary's own. Pure.
 */
export function classifyExposedField(field, ownEmail) {
  const { key, value } = field;
  const norm = normalizeKey(key);
  if (typeof value === 'string' && isMaskedOrEmpty(value)) return null;
  if (PASSWORD_KEYS.has(norm) || SECRET_KEYS.has(norm)) {
    if (typeof value === 'string' && value.trim().length >= 4) {
      return {
        kind: 'secret',
        reason: `workflow response carries a ${key} field with a non-empty value — credential/secret material no workflow step needs in its response`,
      };
    }
    return null;
  }
  if (CARD_KEYS.has(norm)) {
    const digits = String(value).replace(/[\s-]/g, '');
    if (/^\d{13,19}$/.test(digits)) {
      return {
        kind: 'secret',
        reason: `workflow response carries a ${key} field with a full card number / CVV — payment secret material no workflow step needs in its response`,
      };
    }
    return null;
  }
  if (EMAIL_KEYS.has(norm) && typeof value === 'string' && EMAIL_VALUE_RE.test(value.trim())) {
    if (ownEmail && value.trim().toLowerCase() !== String(ownEmail).trim().toLowerCase()) {
      return {
        kind: 'other-user',
        reason: `workflow response carries an email-typed field (${key}) with an address that is not the canary's own (${value.trim()}) — another user's data in this workflow`,
      };
    }
  }
  return null;
}

/**
 * Judge one workflow-step response. 'confirmed' only when at
 * least one field classifies as excessive; 'rejected' when the
 * response is a genuine 2xx JSON body with no excessive field;
 * 'unconfirmed' when the response is not a usable JSON body.
 * Pure.
 */
export function assessWorkflowExposure(stepName, status, body, ownEmail) {
  if (typeof status !== 'number' || status < 200 || status >= 300) {
    return { verdict: 'unconfirmed', reason: `${stepName} step answered HTTP ${status} — no usable response to inspect` };
  }
  if (!body || typeof body !== 'object') {
    return { verdict: 'unconfirmed', reason: `${stepName} step returned no JSON body to inspect` };
  }
  const exposed = [];
  for (const field of flattenFields(body)) {
    const judged = classifyExposedField(field, ownEmail);
    if (judged) exposed.push({ path: field.path, key: field.key, value: String(field.value), ...judged });
  }
  if (exposed.length) {
    return {
      verdict: 'confirmed',
      exposed,
      reason: `${stepName} step response exposes ${exposed.length} field(s) beyond the step's need: ${exposed.map((e) => `${e.path} (${e.kind})`).join(', ')}`,
    };
  }
  return { verdict: 'rejected', reason: `${stepName} step response carries no field beyond the step's need` };
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
// Returns { ok, res, token, body, spent } — spent counts the POSTs
// made, and res/body carry the login response for inspection.
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

function findOwnEmail(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 3) return null;
  for (const n of ['umail', 'email']) {
    const v = node[n];
    if (typeof v === 'string' && EMAIL_VALUE_RE.test(v.trim())) return v.trim();
  }
  for (const v of Object.values(node)) {
    const f = findOwnEmail(v, depth + 1);
    if (f != null) return f;
  }
  return null;
}

// ---- the probe ---------------------------------------------------------------

export async function probeWorkflowDataExposure(url, opts = {}) {
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
  const addressRoutes = findAddressRoutes(routes, origin);
  const whoamiRoute = routes.find((r) => sameOrigin(r, origin) && WHOAMI_RE.test(pathOf(r)));
  const stepRoutes = [basketRoute, checkoutRoute, whoamiRoute, ...addressRoutes].filter(Boolean);
  setDiag('workflowRoutes', stepRoutes.length);
  if (!stepRoutes.length) return findings;
  const { collection: itemCollection } = basketItemRoutes(routes, origin);

  // THE CONTROL: log in as the canary. Without a session token
  // there is no authenticated workflow to inspect, so the probe
  // returns [] (uncalibrated, not a finding). The login response
  // is itself the first inspected step, and its umail calibrates
  // the canary's own email for tier (U).
  const loginUrls = loginCandidates(routes, origin).slice(0, MAX_LOGIN_CANDIDATES);
  if (!loginUrls.length) return findings;
  let token = null;
  let basketId = null;
  let loginRes = null;
  let loginUrlUsed = null;
  let postsLeft = MAX_LOGIN_POSTS;
  for (const candidate of loginUrls) {
    if (postsLeft <= 0) break;
    const got = await tryApiLogin(fetchFn, candidate, creds, postsLeft);
    postsLeft -= got.spent;
    if (got.ok) {
      token = got.token;
      basketId = extractBasketId(got.body);
      loginRes = got.res;
      loginUrlUsed = candidate;
      break;
    }
  }
  if (!token) return findings;
  setDiag('controlOk', true);
  let ownEmail = loginRes && loginRes.json ? findOwnEmail(loginRes.json) : null;

  // Basket-id fallback: whoami user id (Juice convention — the
  // basket id is the user id). Only the login body or whoami may
  // supply it; a mined filler id is never used.
  if (!basketId && whoamiRoute) {
    const r = await req(fetchFn, stripQuery(whoamiRoute), { token });
    const uid = r && r.json ? findField(r.json, ['id']) : null;
    if (uid) basketId = uid;
    if (!ownEmail && r && r.json) ownEmail = findOwnEmail(r.json);
  }
  if (!basketId) return findings;
  setDiag('basketId', true);

  // Inspect one step response; returns the finding when confirmed.
  // The first confirmed step ends the probe (max 1 finding).
  let stepsInspected = 0;
  const inspect = (stepName, stepUrl, status, body) => {
    stepsInspected += 1;
    setDiag('stepsInspected', stepsInspected);
    const judged = assessWorkflowExposure(stepName, status, body, ownEmail);
    if (judged.verdict !== 'confirmed') return null;
    const first = judged.exposed[0];
    setDiag('exposedKind', first.kind);
    return {
      class: 'business_logic',
      id: `wde-${first.kind}-${rand()}`,
      title: 'Business logic — workflow response exposes data beyond the step\u2019s need (MEDIUM)',
      severity: 'medium',
      url: stepUrl,
      parameter: first.path,
      evidence: ev(
        `Authenticated workflow step '${stepName}' (token auth): GET/POST ${stepUrl} -> HTTP ${status}`,
        `${judged.reason}. The exposed field is ${first.path} (${first.kind}) — a field no step of this workflow needs in its response, so the server returns more data than the step requires.`,
        'An attacker harvesting workflow responses collects credential/secret material or another user\u2019s data without ever touching an admin function.',
      ),
    };
  };

  // Step 1 — the login response itself.
  if (loginRes && loginRes.json) {
    const found = inspect('login', loginUrlUsed || loginUrls[0], loginRes.status, loginRes.json);
    if (found) {
      findings.push(found);
      return findings;
    }
  }

  const basketUrl = basketRoute ? fillBasketId(basketRoute, basketId) : null;
  const checkoutUrl = checkoutRoute ? fillCheckoutBasketId(checkoutRoute, basketId) : null;

  const readBasket = async () => {
    if (!basketUrl) return null;
    const r = await req(fetchFn, basketUrl, { token });
    if (!r || r.status !== 200 || !r.json) return null;
    const parsed = parseBasket(r.json);
    return parsed.ok ? { parsed, json: r.json } : null;
  };

  // Step 2 — the basket response.
  let basket = await readBasket();
  if (basket) {
    const found = inspect('basket', basketUrl, 200, basket.json);
    if (found) {
      findings.push(found);
      return findings;
    }
  }

  // Step 3 — the whoami response (also calibrates the own email
  // when the login body carried none).
  if (whoamiRoute) {
    const r = await req(fetchFn, stripQuery(whoamiRoute), { token });
    if (r && r.json) {
      if (!ownEmail) ownEmail = findOwnEmail(r.json);
      const found = inspect('whoami', stripQuery(whoamiRoute), r.status, r.json);
      if (found) {
        findings.push(found);
        return findings;
      }
    }
  }

  // Step 4 — the address responses (at most MAX_ADDRESS_ROUTES,
  // and the probe inspects at most MAX_WORKFLOW_STEPS steps before
  // the checkout step runs).
  for (const addressRoute of addressRoutes) {
    if (stepsInspected >= MAX_WORKFLOW_STEPS) break;
    const r = await req(fetchFn, stripQuery(addressRoute), { token });
    if (r && r.json) {
      const found = inspect('address', stripQuery(addressRoute), r.status, r.json);
      if (found) {
        findings.push(found);
        return findings;
      }
    }
  }

  // Step 5 — the checkout response. The basket must be non-empty
  // for the checkout step to run; seed the first addable product
  // when it is empty (one POST, exactly as in workflow-skip). The
  // cheapest product is tried first, but it is not always addable
  // (Juice: out of stock) — the seeder walks the price list until
  // one adds (see seedFirstAddableProduct). Without a seedable
  // basket the checkout step is skipped — the earlier steps were
  // still inspected.
  if (checkoutUrl) {
    if (!basket) return findings;
    if (!basket.parsed.items.length) {
      if (!itemCollection) return findings;
      const productUrl = productListRoute(routes, origin);
      if (!productUrl) return findings;
      const pr = await req(fetchFn, stripQuery(productUrl), { token });
      const products = pr && pr.json ? parseProductList(pr.json) : [];
      if (!products.length) return findings;
      const seededRes = await seedFirstAddableProduct(fetchFn, { itemCollection, basketId, products, token });
      if (!seededRes.ok) return findings;
      basket = await readBasket();
      if (!basket || !basket.parsed.items.length) return findings;
    }
    const checkoutRes = await req(fetchFn, checkoutUrl, { method: 'POST', token, body: {} });
    if (checkoutRes && checkoutRes.json) {
      const found = inspect('checkout', checkoutUrl, checkoutRes.status, checkoutRes.json);
      if (found) {
        findings.push(found);
        return findings;
      }
    }
  }

  return findings;
}

export const __wdeMeta = { phases: ['workflow-data-exposure'], depth: ['standard', 'deep'] };
