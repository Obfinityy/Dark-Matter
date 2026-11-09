// Dark Matter rule-based scanner — limit / quota bypass probe
// (coverage row #81 [Medium] Limit / Quota Bypass, Business Logic,
// Web / APIs, WSTG-BUSL; phase 103, 'quota-bypass').
//
// ORACLE (deterministic, no judge, no LLM, $0): an API that lacks
// rate limiting or resource controls answers volume with success.
// The row's lab note names exactly the observable test: "measure
// limits with lab traffic; confirm throttling/blocks." The probe
// runs a CONTROL-FIRST burst on each mined data-API route:
//   (1) CONTROL: one unauthenticated GET — it must be granted
//       (2xx + a JSON body). A route that needs auth, 404s, or
//       answers non-JSON is not a usable candidate and is skipped,
//       never a finding.
//   (2) BURST: the same GET 15 times in rapid succession, no
//       delay — volume in a short window is the measurement the
//       row asks for.
//   (3) CONFIRM only when every burst answer is granted (2xx +
//       JSON) with no throttle signal anywhere: no HTTP 429, no
//       Retry-After header, no rate-limit refusal text in any
//       body. A single throttle signal proves the limit EXISTS —
//       that route is a proven true negative and the probe moves
//       to the next candidate. A burst that degrades into 5xx or
//       non-JSON answers is uncalibrated (inconclusive), never a
//       finding. The first confirmed route ends the probe (max 1
//       finding).
// The burst is unauthenticated GETs only: no login, no writes, no
// state is created or mutated — the traffic is the same class the
// scanner already makes on every run (fingerprinting, discovery,
// nuclei). An authenticated per-account quota test is a follow-up,
// not this lane. Latency-based throttling (progressive slowdown
// with 2xx answers) is NOT judged — status codes and throttle
// signals only; a server that slows but never refuses is reported
// as unthrottled at this volume, honestly, with the measured count
// in the evidence.
//
// CANDIDATES: mined apiRoutes whose pathname carries a whole
// 'api' or 'rest' segment (data APIs). Auth routes (login /
// register), state-adjacent routes (basket / cart / checkout /
// coupon) and admin routes are excluded — login volume is
// credential-stuffing #42's territory, basket/coupon volume is
// basket-logic #82 / coupon-abuse #78's, and admin endpoints are
// BFLA #340's. A candidate that 404s or needs auth fails the
// control and is skipped, so a templated mined route can never
// confirm — which is why findApiRoutes derives the parent
// COLLECTION of a templated write target first (whole-segment
// match, the 1418d921 feedback-route pattern): the JS miner
// hands the probe write targets with a filler id
// (/api/Feedbacks/dmprobe4_2e69), and only the collection
// (/api/Feedbacks) can grant a control GET. Derivation alone
// was NOT enough (proof #34): the live Juice feed derives NINE
// collections and /api/Feedbacks is 8th, while the old cap of 2
// tried only /api/Users + /api/BasketItems (both 401) — so the
// probe now runs a CONTROL PASS over every candidate (one cheap
// control GET each, derived collections first) and bursts only
// the first granting candidate. The granting route is found
// wherever it sits in the list, never cut by the cap.
//
// GATES: labCreds + allowWrite + isLabTargetHost (same lab gate
// as basket-logic / workflow-skip / bfla / coupon-abuse — volume
// traffic runs only against authorized lab targets); depth
// 'quick' skips the probe. BOUND: at most 32 GETs total
// (REQUEST_BUDGET) — 1 control GET per candidate tried plus
// 15-burst GETs on granting candidates only; a burst starts only
// when 15 GETs remain in the budget. All read-only.
// Findings are class 'business_logic' — the default confirmation
// protocol judges them on signalCorrelated (see differential.js).

import { isLabTargetHost } from '../../labCreds.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const TIMEOUT_MS = 15000;
const BURST_COUNT = 15;
// Control-pass list cap (9 Nov 2026 follow-up, proof #34): the live
// Juice feed derives NINE collections and /api/Feedbacks is 8th, so
// a cap of 2 tried only /api/Users + /api/BasketItems (both 401) and
// the probe never calibrated. The control pass below walks every
// candidate with ONE cheap control GET each, so the cap is generous
// — the hard bound is REQUEST_BUDGET, not the list length.
const MAX_CANDIDATES = 12;
// Total GET budget for the whole probe: 1 control GET per candidate
// tried plus 15-burst GETs on granting candidates only. A burst
// starts only when 15 GETs remain in the budget, so the probe can
// never exceed 32 requests however long the candidate list is.
const REQUEST_BUDGET = 32;
const API_SEGMENT_RE = /(?:^|\/)(api|rest)(?:\/|$)/i;
const EXCLUDED_SEGMENT_RE =
  /(?:^|\/)(login|logon|signin|sign-in|register|signup|sign-up|basket|baskets|cart|carts|checkout|coupon|coupons|discount|discounts|voucher|vouchers|admin|administrator)(?:\/|$)/i;
const THROTTLE_TEXT_RE =
  /rate[ -]?limit|too many requests|slow down|quota exceeded|request limit|try again later|throttl|exceeded.*(limit|quota)/i;
// A mined route's last segment looks like a generated filler id when
// it matches one of these: the JS miner's own filler marker
// (dmprobe<n>_<hex>, e.g. dmprobe4_2e69), a numeric id, a UUID, a
// long hex token, or a long mixed letter+digit token. A plain word
// (letters only, e.g. 'search', 'apple-juice') is a real resource
// name, never a filler.
const FILLER_SEGMENT_RES = [
  /^dmprobe/i,
  /^\d+$/,
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  /^[0-9a-f]{8,}$/i,
  /^(?=.*[a-z])(?=.*\d)[a-z0-9]{8,}$/i,
];

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

function ev(request, response, impact) {
  return { request, response, impact_demo: impact, signalCorrelated: true };
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
 * Derive the parent collection URL of a templated write target:
 * when a route's last path segment is a generated filler id (the
 * JS miner fills template path params with dmprobe<n>_<hex>, e.g.
 * /api/Feedbacks/dmprobe4_2e69), the item URL can never grant a
 * control GET — the filler id does not exist — so the collection
 * (the path up to the last segment) is the usable candidate. This
 * is the whole-segment-match pattern from the CAPTCHA feedback
 * fix (1418d921): never the templated item URL, always the
 * collection base. Returns the collection URL, or null when the
 * last segment is not a filler id, or when the parent is not a
 * real collection (fewer than 2 segments, no api/rest segment,
 * or an excluded segment such as basket/admin). Pure.
 */
export function deriveCollectionUrl(route) {
  let u;
  try {
    u = new URL(String(route));
  } catch {
    return null;
  }
  const segments = u.pathname.split('/').filter(Boolean);
  if (segments.length < 2) return null;
  const last = segments[segments.length - 1];
  if (!FILLER_SEGMENT_RES.some((re) => re.test(last))) return null;
  const parent = `/${segments.slice(0, -1).join('/')}`;
  if (segments.length - 1 < 2) return null;
  if (!API_SEGMENT_RE.test(parent)) return null;
  if (EXCLUDED_SEGMENT_RE.test(parent)) return null;
  return `${u.origin}${parent}`;
}

/**
 * Mine data-API candidate routes from the discovered route set: a
 * route qualifies when its pathname carries a whole 'api' or
 * 'rest' segment and no excluded segment (auth, basket/cart/
 * checkout/coupon, admin). Same-origin only, deduped, query
 * stripped. Derived collections come FIRST, in a separate pass
 * (see deriveCollectionUrl): the item URL itself can never grant
 * a control, so every templated route yields its cap slot to its
 * collection before any item URL is kept — with two templated
 * mined routes the cap holds both collections, never one
 * collection plus one dead item URL. Pure.
 */
export function findApiRoutes(routes, origin) {
  const out = [];
  const push = (s) => {
    if (!out.includes(s)) out.push(s);
  };
  const valid = [];
  for (const r of routes || []) {
    try {
      const u = new URL(String(r));
      if (u.origin !== origin) continue;
      const p = u.pathname;
      if (!API_SEGMENT_RE.test(p)) continue;
      if (EXCLUDED_SEGMENT_RE.test(p)) continue;
      valid.push(stripQuery(u.toString()));
    } catch {
      // ignore malformed route entries
    }
  }
  for (const s of valid) {
    const collection = deriveCollectionUrl(s);
    if (collection) push(collection);
  }
  for (const s of valid) push(s);
  return out.slice(0, MAX_CANDIDATES);
}

/**
 * Does a response carry a Retry-After header? Accepts a
 * Headers-like object (.get), a plain object of header names, or
 * null. Pure.
 */
export function hasRetryAfter(headers) {
  if (!headers) return false;
  try {
    if (typeof headers.get === 'function') {
      return headers.get('retry-after') != null || headers.get('Retry-After') != null;
    }
    if (typeof headers === 'object') {
      return Object.keys(headers).some((k) => String(k).toLowerCase() === 'retry-after');
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Judge one API-route response. Returns { kind, reason } where
 * kind is 'granted' (2xx + a JSON body, no throttle signal),
 * 'throttled' (HTTP 429, a Retry-After header, or rate-limit
 * refusal text in the body — on any status, since a 200 carrying
 * "too many requests" is still a throttle), or 'other' (anything
 * else — auth required, 404, 5xx, redirect, empty 2xx, or a
 * non-JSON 2xx such as the SPA HTML shell, which proves nothing
 * about the API route). Pure.
 */
export function assessApiResponse(status, body, headers) {
  const text = typeof body === 'string' ? body : '';
  if (hasRetryAfter(headers)) {
    return { kind: 'throttled', reason: 'response carries a Retry-After header' };
  }
  if (THROTTLE_TEXT_RE.test(text)) {
    return { kind: 'throttled', reason: 'response body carries a rate-limit refusal message' };
  }
  if (typeof status === 'number' && status === 429) {
    return { kind: 'throttled', reason: 'route answered HTTP 429' };
  }
  if (typeof status === 'number' && status >= 200 && status < 300) {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      return { kind: 'other', reason: 'route answered 2xx with an empty body' };
    }
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      return { kind: 'other', reason: 'route answered 2xx with a non-JSON body' };
    }
    return { kind: 'granted', reason: `route answered HTTP ${status} with a JSON body` };
  }
  return { kind: 'other', reason: `route answered HTTP ${status}` };
}

/**
 * Judge the quota burst on one route: confirmed only when the
 * control was granted AND every burst answer was granted. A
 * single throttled burst answer proves the limit exists
 * (rejected — a proven true negative). A burst that degrades
 * into non-granted, non-throttled answers is uncalibrated
 * (inconclusive), never a finding. Pure.
 */
export function assessQuotaBurst(controlKind, burstKinds) {
  if (controlKind !== 'granted') {
    return { verdict: 'uncalibrated', reason: 'the control GET did not grant the route — no valid control' };
  }
  if (!Array.isArray(burstKinds) || burstKinds.length === 0) {
    return { verdict: 'uncalibrated', reason: 'the burst ran no requests' };
  }
  if (burstKinds.some((k) => k === 'throttled')) {
    return {
      verdict: 'rejected',
      reason: 'the server throttled the burst (HTTP 429 / Retry-After / refusal text) — a rate limit exists on this route',
    };
  }
  if (burstKinds.some((k) => k !== 'granted')) {
    return {
      verdict: 'uncalibrated',
      reason: 'burst answers were inconclusive (non-2xx / non-JSON) — neither a limit nor its absence is proven',
    };
  }
  return {
    verdict: 'confirmed',
    reason: `all ${burstKinds.length} burst requests answered 2xx with no throttle signal — the API accepted the full burst without throttling`,
  };
}

// ---- network (fetchFn seam, defaults to global fetch) -----------------------

async function req(fetchFn, url, { timeoutMs = TIMEOUT_MS } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, {
      method: 'GET',
      signal: ctrl.signal,
      headers: { 'User-Agent': UA },
    });
    const text = await res.text().catch(() => '');
    return {
      status: res.status,
      text: text.slice(0, 200000),
      headers: res.headers || null,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// ---- the probe ---------------------------------------------------------------

export async function probeQuotaBypass(url, opts = {}) {
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
  const candidates = findApiRoutes(routes, origin);
  setDiag('apiRoutes', candidates.length);
  // How many candidates are collections derived from templated
  // write targets (never mined directly) — the live-proof signal
  // that the derivation ran (proof #33: apiRoutes 2, controlOk
  // false, because only templated targets were mined).
  const inputStripped = new Set(routes.map((r) => stripQuery(r)));
  setDiag(
    'derivedCollections',
    candidates.filter((c) => !inputStripped.has(c) && routes.some((r) => deriveCollectionUrl(r) === c)).length
  );
  // The candidate list itself, so the next re-proof shows exactly
  // which routes were tried and in which order (proof #34: the
  // live record carried no route list, so the cap-2 cut was
  // invisible until the feed was reproduced by hand).
  setDiag('candidates', candidates);
  if (!candidates.length) return findings;

  // CONTROL PASS (9 Nov 2026 follow-up, proof #34): one cheap
  // control GET per candidate, derived collections first — the
  // first granting candidate gets the burst. `spent` counts every
  // GET against REQUEST_BUDGET (32): a burst starts only when 15
  // GETs remain, and control-probing stops when a control + a full
  // burst no longer fit, so the probe can never exceed the budget
  // however long the candidate list is.
  let spent = 0;
  for (const route of candidates) {
    // THE CONTROL: one GET must grant the route with a JSON body.
    // Without a working control the burst cannot be judged, so
    // this candidate is skipped — a finding without a working
    // control is a guess.
    if (spent + 1 + BURST_COUNT > REQUEST_BUDGET) break;
    const rControl = await req(fetchFn, route);
    spent += 1;
    if (!rControl) continue;
    const control = assessApiResponse(rControl.status, rControl.text, rControl.headers);
    if (control.kind !== 'granted') continue;
    setDiag('controlOk', true);
    if (spent + BURST_COUNT > REQUEST_BUDGET) break;

    // THE BURST: the same GET BURST_COUNT times in rapid
    // succession, no delay. A throttle signal stops the burst
    // early — the limit is proven and this route is a true
    // negative; the probe moves to the next candidate.
    const kinds = [];
    let attempts = 0;
    for (let i = 0; i < BURST_COUNT; i += 1) {
      const r = await req(fetchFn, route);
      attempts += 1;
      spent += 1;
      setDiag('attempts', attempts);
      if (!r) {
        kinds.push('other');
        continue;
      }
      const judged = assessApiResponse(r.status, r.text, r.headers);
      kinds.push(judged.kind);
      if (judged.kind === 'throttled') {
        setDiag('throttled', true);
        break;
      }
    }
    const verdict = assessQuotaBurst(control.kind, kinds);
    if (verdict.verdict !== 'confirmed') continue;
    setDiag('bypassKind', 'no-rate-limit');
    findings.push({
      class: 'business_logic',
      id: `qb-nolimit-${rand()}`,
      title: 'API endpoint accepts repeated requests without rate limiting (MEDIUM)',
      severity: 'medium',
      url: route,
      parameter: 'rate-limit',
      evidence: ev(
        `GET ${route} once (control, HTTP 200) -> ${BURST_COUNT} identical GETs in rapid succession (unauthenticated) -> all ${BURST_COUNT} answered HTTP 200`,
        `No throttle signal in the whole burst: no HTTP 429, no Retry-After header, no rate-limit refusal text. ${verdict.reason}. The API applies no rate limiting or quota to this endpoint.`,
        'An attacker replays the endpoint at volume to scrape data, brute-force identifiers, or exhaust server resources.',
      ),
    });
    return findings;
  }
  return findings;
}

export const __quotaBypassMeta = { phases: ['quota-bypass'], depth: ['standard', 'deep'] };
