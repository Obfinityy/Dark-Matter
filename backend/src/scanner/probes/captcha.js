// Dark Matter rule-based scanner — CAPTCHA bypass probe
// (coverage row #40 [Medium] CAPTCHA Bypass / Missing CAPTCHA,
// Technique (no single CVE) | OWASP A07:2021; phase 95, 'captcha').
//
// ORACLE (deterministic, no judge, no LLM, $0): a CAPTCHA that the
// server never validates is client-side decoration — an attacker
// submits the gated action without solving anything. The row's lab
// note names the test: "test login/session flows with lab accounts;
// confirm the bypass." The probe tests it in two tiers:
//
//   TIER 1 — STATIC MINE (cheap, rigorous for the negative case):
//   the page's own first-party bundles + inline <script> blocks are
//   scanned for CAPTCHA service markers (a math-captcha endpoint
//   such as /rest/captcha, an image-captcha endpoint such as
//   /rest/image-captcha, or a third-party widget such as
//   g-recaptcha / hCaptcha / Turnstile). ZERO markers means no code
//   can present a CAPTCHA at all — a proven true negative for
//   bypass (nothing to bypass), no drive. An image CAPTCHA is
//   noted in diagnostics but NEVER driven: solving one needs OCR,
//   which a predefined oracle cannot do honestly.
//
//   TIER 2 — BYPASS DRIVE (only when tier 1 finds a MATH captcha
//   and a feedback POST route exists in the mined apiRoutes): with
//   the canary lab session the probe (1) logs in (shared 4-POST
//   budget, same tryApiLogin as basket-logic), (2) fetches a fresh
//   math CAPTCHA and SOLVES it by computing the expression exactly
//   like a user — it never reads the `answer` field the server
//   leaks in the GET response — (3) submits the feedback with the
//   correct solution as the CONTROL (a 2xx carrying a created
//   feedback id calibrates the oracle; anything else is
//   uncalibrated and returns []), then (4) submits the same
//   feedback with NO captcha fields, and (5) with a WRONG answer
//   against a fresh captchaId. CONFIRM only when the control was
//   accepted AND a bypass submission was accepted with the same
//   success signal (2xx + created feedback id). A captcha error on
//   the bypass attempt is a true negative (the control exists), not
//   a finding.
//
// "Missing CAPTCHA on login" is NEVER a finding here: the login
// flow carries no CAPTCHA on either lab, and firing on its absence
// would double-count row #42 (credential stuffing — login accepts
// repeated wrong passwords without rate limiting, already LIVE).
// The finding is about a CAPTCHA that EXISTS and is not enforced.
//
// GATES: labCreds + allowWrite + isLabTargetHost (same lab gate as
// basket-logic / workflow-skip / session-fixation / twofa /
// credential-stuffing / dom-postmessage / csti); depth 'quick'
// skips the probe. BOUND: at most 4 login POSTs + 3 feedback
// POSTs (control + 2 bypass attempts) = 7 POSTs per scan, hard
// cap 10. Findings are class 'captcha_bypass' — protocolFor routes
// any class containing 'bypass' to the auth_bypass protocol, whose
// judge requires evidence.bypassWorks === true, which the probe
// sets only on an observed bypass. Severity follows the row
// (Medium) ONLY on an observed bypass; a true negative fires
// nothing.
//
// HONEST LIMITS (stated up front, not discovered later):
// - Image CAPTCHAs are never driven (OCR needed); an image-only
//   target reports the surface in diagnostics and returns [].
// - Only the feedback math-CAPTCHA flow is driven. A CAPTCHA on
//   any other flow (registration, checkout, data export) is noted
//   as a surface but not exercised — such a CAPTCHA is a true
//   negative BY THIS ORACLE, not proof of safety.
// - The probe solves the math CAPTCHA by computing the expression
//   (small ints, + - * /). An expression it cannot parse leaves
//   the oracle uncalibrated — never a finding, never a true
//   negative claim.
// - A page with no script targets skips the phase at the index.js
//   level ('no script targets'), like csti / dom-postmessage.

import { randomBytes } from 'node:crypto';
import { isLabTargetHost } from '../../labCreds.js';
import { fetchPage } from '../fingerprint.js';
import { JS_ROUTES_MAX_BUNDLES } from '../jsRoutes.js';
import { loginCandidates } from './sessionFixation.js';
import { extractBearerTokenFromJson } from '../labSession.js';
import { isVendorBundle, isFrameworkBundle } from './domXssSinks.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const TIMEOUT_MS = 15000;
const MAX_BUNDLES = JS_ROUTES_MAX_BUNDLES; // 5, same cap as jsRoutes / domXssSinks / csti
const MAX_INLINE = 10;
const MAX_FINDINGS = 1;
const MAX_LOGIN_CANDIDATES = 3;
const MAX_LOGIN_POSTS = 4;
const MAX_TOTAL_POSTS = 10;
const SNIPPET_RADIUS = 80;

// ---- tier-1: CAPTCHA surfaces (pure) ---------------------------------------

// CAPTCHA service markers in first-party code. The math endpoint is
// the only drivable kind: an image CAPTCHA needs OCR and a generic
// third-party widget needs a browser solve, so both are noted and
// never driven. The math regex cannot match the image path (the
// image path has '/image-' between '/rest/' and 'captcha').
const CAPTCHA_MARKERS = [
  { kind: 'image', re: /\/rest\/image-captcha\/?/g, endpoint: '/rest/image-captcha/' },
  { kind: 'math', re: /\/rest\/captcha\/?/g, endpoint: '/rest/captcha/' },
  { kind: 'generic', re: /g-recaptcha|hcaptcha|cf-turnstile|recaptcha\.net|hcaptcha\.com/g, endpoint: null },
];

function lineOf(body, offset) {
  let n = 1;
  for (let i = 0; i < offset && i < body.length; i += 1) {
    if (body[i] === '\n') n += 1;
  }
  return n;
}

function snippetAround(body, matchIndex, matchLength) {
  const start = Math.max(0, matchIndex - SNIPPET_RADIUS);
  const end = Math.min(body.length, matchIndex + matchLength + SNIPPET_RADIUS);
  let snip = body.slice(start, end).replace(/\s+/g, ' ').trim();
  if (start > 0) snip = `…${snip}`;
  if (end < body.length) snip = `${snip}…`;
  return snip.slice(0, 400);
}

// All CAPTCHA service markers in one source body. Pure — exported for
// unit tests.
export function findCaptchaSurfaces(body) {
  const text = typeof body === 'string' ? body : '';
  if (!text) return [];
  const out = [];
  for (const { kind, re, endpoint } of CAPTCHA_MARKERS) {
    const rx = new RegExp(re.source, re.flags);
    let m;
    while ((m = rx.exec(text)) !== null) {
      out.push({
        index: m.index,
        kind,
        endpoint,
        line: lineOf(text, m.index),
        snippet: snippetAround(text, m.index, m[0].length),
      });
    }
  }
  out.sort((a, b) => a.index - b.index);
  return out;
}

// Tier-1 verdict from a surface list: distinct surfaces by
// (kind, endpoint), and whether the tier-2 drive can run (a math
// surface exists). Pure — exported for unit tests.
export function assessCaptchaSurfaces(surfaces) {
  const list = Array.isArray(surfaces) ? surfaces : [];
  const seen = new Set();
  let math = 0;
  let image = 0;
  let generic = 0;
  let mathEndpoint = null;
  for (const s of list) {
    if (!s || typeof s.kind !== 'string') continue;
    const key = `${s.kind}:${s.endpoint || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (s.kind === 'math') {
      math += 1;
      if (!mathEndpoint && s.endpoint) mathEndpoint = s.endpoint;
    } else if (s.kind === 'image') {
      image += 1;
    } else {
      generic += 1;
    }
  }
  return { surfaces: seen.size, math, image, generic, mathEndpoint, drivable: math > 0 };
}

// ---- math CAPTCHA solver (pure) --------------------------------------------

// Solve a small-integer arithmetic CAPTCHA expression such as
// "2+3-9" exactly like a user would: tokenize, evaluate * and /
// first, then + and -. No eval, no Function constructor. Returns the
// integer answer, or null when the expression is not a plain
// integer arithmetic form (unknown shape, division that does not
// divide evenly, division by zero). Pure — exported for unit tests.
export function solveMathCaptcha(expr) {
  const text = String(expr || '').trim();
  if (!text) return null;
  const head = text.match(/^(-?\d+)((?:\s*[+\-*/]\s*\d+)+)$/);
  if (!head) return null;
  const values = [Number(head[1])];
  const ops = [];
  const rest = head[2];
  const pairs = rest.matchAll(/([+\-*/])\s*(\d+)/g);
  for (const p of pairs) {
    ops.push(p[1]);
    values.push(Number(p[2]));
  }
  if (ops.length + 1 !== values.length) return null;
  // * and / first (left to right).
  const vals2 = [values[0]];
  const ops2 = [];
  for (let i = 0; i < ops.length; i += 1) {
    const op = ops[i];
    const v = values[i + 1];
    if (op === '*' || op === '/') {
      const left = vals2[vals2.length - 1];
      if (op === '/' && (v === 0 || left % v !== 0)) return null;
      vals2[vals2.length - 1] = op === '*' ? left * v : left / v;
    } else {
      ops2.push(op);
      vals2.push(v);
    }
  }
  let acc = vals2[0];
  for (let i = 0; i < ops2.length; i += 1) {
    acc = ops2[i] === '+' ? acc + vals2[i + 1] : acc - vals2[i + 1];
  }
  return Number.isInteger(acc) ? acc : null;
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

/**
 * First same-origin feedback POST route, or null. The miner hands the
 * probe write targets with a template filler (e.g.
 * /api/Feedbacks/dmprobe4_2e69, from FeedbackService.find doing a GET
 * on host + '/' + id), so a route whose pathname contains a `feedbacks`
 * segment matches and the COLLECTION base URL is returned — origin +
 * path up to and including the `feedbacks` segment — never the
 * templated item URL. An exact /api/Feedbacks route returns the same
 * collection URL (any query string is dropped: the POST target is the
 * collection). Pure.
 */
export function feedbackRoute(routes, origin) {
  for (const r of routes || []) {
    if (!sameOrigin(r, origin)) continue;
    let u;
    try {
      u = new URL(String(r));
    } catch {
      continue;
    }
    const segments = u.pathname.split('/').filter(Boolean);
    const idx = segments.findIndex((s) => s.toLowerCase() === 'feedbacks');
    if (idx === -1) continue;
    return `${u.origin}/${segments.slice(0, idx + 1).join('/')}`;
  }
  return null;
}

/** First same-origin whoami route (/rest/user/whoami), or null. Pure. */
export function whoamiRoute(routes, origin) {
  for (const r of routes || []) {
    if (!sameOrigin(r, origin)) continue;
    if (pathOf(r).toLowerCase() === '/rest/user/whoami') return String(r);
  }
  return null;
}

// ---- response judges (pure) -------------------------------------------------

function bodyText(body) {
  if (!body || typeof body !== 'object') return '';
  try {
    return JSON.stringify(body);
  } catch {
    return '';
  }
}

/**
 * Judge one feedback POST response. 'accepted' is a 2xx carrying a
 * created feedback id (the row exists); 'captcha-error' is a
 * response that refuses on the CAPTCHA; anything else is 'other'
 * (uncalibrated — the oracle cannot judge this endpoint). Pure.
 */
export function assessFeedbackResponse(status, body) {
  const text = bodyText(body);
  const json = body && typeof body === 'object' ? body : null;
  if (
    typeof status === 'number' &&
    status >= 200 &&
    status < 300 &&
    json &&
    json.data &&
    typeof json.data === 'object' &&
    json.data.id != null
  ) {
    return { kind: 'accepted', reason: 'feedback created (2xx with a feedback id)' };
  }
  if (
    /captcha/i.test(text) &&
    (status >= 400 || /invalid|required|incorrect|failed|missing|wrong|must/i.test(text))
  ) {
    return { kind: 'captcha-error', reason: 'server refused the submission on the CAPTCHA' };
  }
  return { kind: 'other', reason: `feedback endpoint answered HTTP ${status}` };
}

/**
 * Judge the bypass run: confirmed only when the control was
 * accepted AND a bypass submission was accepted with the same
 * success signal. Pure.
 */
export function assessCaptchaBypass({ controlOk, bypassAccepted, bypassKind }) {
  if (!controlOk) {
    return { verdict: 'uncalibrated', reason: 'control submission was not accepted — oracle uncalibrated' };
  }
  if (bypassAccepted) {
    return { verdict: 'confirmed', reason: `feedback accepted with a ${bypassKind} CAPTCHA` };
  }
  return { verdict: 'rejected', reason: 'server enforced the CAPTCHA on the bypass attempt — the control exists' };
}

function ev(request, response, impact) {
  return { request, response, impact_demo: impact, signalCorrelated: true, bypassWorks: true };
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
// Mirrors basketLogic.tryApiLogin (same shared-budget contract).
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

// ---- the probe ---------------------------------------------------------------

export async function probeCaptcha(url, targets, opts = {}) {
  const findings = [];
  const diag = opts && typeof opts.diagnostics === 'object' && opts.diagnostics ? opts.diagnostics : null;
  const setDiag = (k, v) => {
    if (diag) diag[k] = v;
  };
  const fetchPageFn = typeof opts.fetchPage === 'function' ? opts.fetchPage : fetchPage;
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
  const bundles = Array.isArray(targets && targets.bundles)
    ? targets.bundles.slice(0, MAX_BUNDLES)
    : [];
  const inline = Array.isArray(targets && targets.inline)
    ? targets.inline.slice(0, MAX_INLINE)
    : [];

  // TIER 1 — mine first-party code for CAPTCHA services. Vendor /
  // framework bundles are excluded by the same gates as csti /
  // domXssSinks (framework code mentioning a CAPTCHA is not the
  // app's vulnerability).
  const surfaces = [];
  for (const bundleUrl of bundles) {
    if (isVendorBundle(bundleUrl)) continue;
    let res;
    try {
      res = await fetchPageFn(bundleUrl, opts);
    } catch {
      continue;
    }
    if (!res || res.status !== 200 || !res.body) continue;
    if (isFrameworkBundle(res.body)) continue;
    for (const s of findCaptchaSurfaces(res.body)) {
      surfaces.push({ ...s, source: bundleUrl });
    }
  }
  inline.forEach((body, i) => {
    for (const s of findCaptchaSurfaces(body)) {
      surfaces.push({ ...s, source: `inline <script> block #${i + 1}` });
    }
  });
  const flow = assessCaptchaSurfaces(surfaces);
  setDiag('captchaSurfaces', flow.surfaces);
  setDiag('mathSurfaces', flow.math);
  setDiag('imageSurfaces', flow.image);
  setDiag('genericSurfaces', flow.generic);
  if (!flow.drivable) return findings; // proven true negative: no math CAPTCHA to bypass

  const routes = (opts.apiRoutes || []).map(String);
  const feedbackUrl = feedbackRoute(routes, origin);
  if (!feedbackUrl) return findings;
  setDiag('feedbackRoutes', 1);

  // Login (shared budget, same as basket-logic / session-fixation T4b).
  const loginUrls = loginCandidates(routes, origin).slice(0, MAX_LOGIN_CANDIDATES);
  if (!loginUrls.length) return findings;
  let token = null;
  let postsLeft = MAX_LOGIN_POSTS;
  for (const candidate of loginUrls) {
    if (postsLeft <= 0) break;
    const got = await tryApiLogin(fetchFn, candidate, creds, postsLeft);
    postsLeft -= got.spent;
    if (got.ok) {
      token = got.token;
      break;
    }
  }
  if (!token) return findings;

  // The feedback form carries the logged-in user's id: read it from
  // whoami when the route was mined. Missing whoami is not fatal —
  // the UserId field is simply omitted and the control POST judges
  // calibration.
  let userId = null;
  const whoamiUrl = whoamiRoute(routes, origin);
  if (whoamiUrl) {
    const r = await req(fetchFn, stripQuery(whoamiUrl), { token });
    const u = r && r.json && r.json.user && typeof r.json.user === 'object' ? r.json.user : null;
    if (u && u.id != null) userId = u.id;
  }

  // A fresh math CAPTCHA, solved by computing the expression — never
  // by reading the `answer` field the server leaks in the response.
  const captchaUrl = origin + (flow.mathEndpoint || '/rest/captcha/');
  const capRes = await req(fetchFn, captchaUrl, { token });
  if (!capRes || capRes.status !== 200 || !capRes.json) return findings;
  const captchaId = capRes.json.captchaId;
  const solved = solveMathCaptcha(capRes.json.captcha);
  if (captchaId == null || solved == null) return findings;

  const rid = randomBytes(4).toString('hex');
  let spent = MAX_LOGIN_POSTS - postsLeft;
  let posts = 0;
  const postFeedback = async (captchaFields, tag) => {
    if (spent >= MAX_TOTAL_POSTS) return { kind: 'other', reason: 'POST budget exhausted', id: null };
    const body = {
      comment: `dm-captcha-probe-${rid}-${tag}`,
      rating: 5,
      ...(userId != null ? { UserId: userId } : {}),
      ...captchaFields,
    };
    const r = await req(fetchFn, stripQuery(feedbackUrl), { method: 'POST', token, body });
    spent += 1;
    posts += 1;
    setDiag('attempts', posts);
    if (!r) return { kind: 'other', reason: 'no response', id: null };
    const judged = assessFeedbackResponse(r.status, r.json);
    return { ...judged, id: judged.kind === 'accepted' && r.json && r.json.data ? r.json.data.id : null };
  };

  const confirmBypass = (bypassKind, controlId, bypassId) => {
    const verdict = assessCaptchaBypass({ controlOk: true, bypassAccepted: true, bypassKind });
    if (verdict.verdict !== 'confirmed') return;
    findings.push({
      class: 'captcha_bypass',
      id: `cap-bypass-${randomBytes(4).toString('hex')}`,
      title: 'CAPTCHA bypass — feedback accepted without a valid CAPTCHA solution (MEDIUM)',
      severity: 'medium',
      url: stripQuery(feedbackUrl),
      parameter: 'captcha',
      evidence: ev(
        `POST ${stripQuery(feedbackUrl)} with a solved math CAPTCHA (control, feedback id ${controlId}) -> POST the same feedback with ${bypassKind === 'missing' ? 'no captchaId/captcha fields' : 'a wrong captcha answer'} (feedback id ${bypassId})`,
        `Control accepted: the solved CAPTCHA created feedback ${controlId}. The ${bypassKind} submission was ALSO accepted and created feedback ${bypassId} — the server never validated the CAPTCHA solution. ${verdict.reason}.`,
        'An attacker submits feedback (and any other action on this CAPTCHA-gated flow) without solving the CAPTCHA — the bot friction is client-side only, so spam and automated abuse run unopposed. Validate the CAPTCHA server-side on every submission and reject missing or wrong solutions.',
      ),
    });
  };

  // THE CONTROL: the solved CAPTCHA must create the feedback, or
  // the oracle is uncalibrated and the probe returns [] — a finding
  // without a working control is a guess.
  const control = await postFeedback({ captchaId, captcha: String(solved) }, 'control');
  if (control.kind !== 'accepted') return findings;
  setDiag('controlOk', true);

  // BYPASS 1 — MISSING: no captchaId, no captcha field at all.
  const missing = await postFeedback({}, 'missing');
  if (missing.kind === 'accepted') {
    setDiag('bypassKind', 'missing');
    confirmBypass('missing', control.id, missing.id);
    return findings;
  }
  if (missing.kind !== 'captcha-error') return findings; // 'other' — uncalibrated

  // BYPASS 2 — WRONG ANSWER: a fresh captchaId, solved value + 1.
  const capRes2 = await req(fetchFn, captchaUrl, { token });
  if (!capRes2 || capRes2.status !== 200 || !capRes2.json) return findings;
  const captchaId2 = capRes2.json.captchaId;
  const solved2 = solveMathCaptcha(capRes2.json.captcha);
  if (captchaId2 == null || solved2 == null) return findings;
  const wrong = await postFeedback({ captchaId: captchaId2, captcha: String(solved2 + 1) }, 'wrong');
  if (wrong.kind === 'accepted') {
    setDiag('bypassKind', 'wrong-answer');
    confirmBypass('wrong-answer', control.id, wrong.id);
    return findings;
  }
  // captcha-error on both bypass attempts: the control exists, a
  // true negative. 'other' is uncalibrated. Either way, [].
  return findings;
}

export const __capMeta = { phases: ['captcha'], depth: ['standard', 'deep'] };
