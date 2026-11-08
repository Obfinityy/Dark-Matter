// Dark Matter rule-based scanner — credential stuffing probe
// (coverage row #42 [High] Credential Stuffing, Technique (no single
// CVE) | OWASP A07:2021; phase 92, 'credential-stuffing').
//
// ORACLE (deterministic, no judge, no LLM, $0): a login that never
// throttles wrong passwords lets an attacker replay leaked credential
// pairs at scale. The row's lab note names exactly the observable
// test: "test velocity controls with lab accounts; confirm
// anomaly/lockout responses." With the canary lab session we (1)
// discover a login endpoint from the mined apiRoutes (never invented
// — no login route means an honest []), (2) calibrate the oracle
// with ONE wrong password (the first ordinary invalid-credential
// answer is the control), (3) submit 9 more distinct fixed wrong
// passwords, at most 15 login POSTs in total. CONFIRM only when ALL
// 10 wrong passwords are each answered with an ordinary
// invalid-credential response (401, or a 400/200 carrying an
// invalid-credentials message) and NO throttle signal appears
// anywhere. The FIRST throttle signal (HTTP 429, a lockout /
// too-many-attempts / rate-limit message, a CAPTCHA challenge, or a
// sudden 403 on the login endpoint) stops the probe immediately
// with [] — the control exists, so this is a true negative, not a
// finding. A response that is neither invalid-credentials nor
// throttle (404/422, 5xx, a missing-field answer, a 200 success on
// a wrong password, a "user not found" answer for an unknown
// account) is UNCALIBRATED and also returns [] — a finding without
// a calibrated invalid-credentials signal is a guess.
//
// The finding is about MISSING velocity defense, never about
// guessing the right password: the passwords are a fixed list of
// clearly-fake wrong values ('dm-wrong-pass-01' ...), never the
// canary's real password and never a breached pair, and the probe
// never attempts to discover a valid password. The canary is a
// throwaway lab account; the 15-POST cap plus immediate stop on any
// throttle signal is what keeps it from being locked out — the cap
// is NEVER raised to "prove" anything.
//
// SURFACE: a same-origin login route from loginCandidates
// (sessionFixation.js — exact /login first, then login-like
// fallbacks, max 3 candidates). Two JSON body shapes are tried in
// order — { email, password } then { username, password } — because
// a shop that rejects the first shape with a missing-field answer
// has not shown its velocity control yet; a shop that answers the
// first shape calibrates on it and the second shape is never sent.
// Form-only logins (DVWA login.php, application/x-www-form-urlencoded)
// are an honest no-op by design: this probe speaks JSON login APIs
// only (Juice Shop POST /rest/user/login), the same single-shape
// honesty as twoFaBruteForce's { tmpToken?, totpToken } body.
//
// GATES: labCreds + allowWrite + isLabTargetHost (same lab gate as
// basket-logic / workflow-skip / session-fixation / twofa-bruteforce);
// depth 'quick' skips the probe. BOUND: at most 15 login POSTs
// (at most 3 candidates x 2 shapes to calibrate, then 9 follow-up
// attempts on the calibrated endpoint). Findings are class
// 'auth_bruteforce' — no protocol key matches it, so the default
// confirmation protocol judges it on signalCorrelated (see
// differential.js protocolFor; same fall-through as 'auth_2fa').
//
// NOTE (3 Nov pivot): the pivot note said brute force "needs
// browser/DOM" — the #326 twofa-bruteforce probe already proved the
// deterministic HTTP-level oracle works live for the 2FA field; #42
// is the same shape on the password field.

import { isLabTargetHost } from '../../labCreds.js';
import { loginCandidates } from './sessionFixation.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const TIMEOUT_MS = 15000;
const MAX_LOGIN_CANDIDATES = 3;
const MAX_ATTEMPTS = 10;
const MAX_TOTAL_POSTS = 15;
// Fixed wrong passwords — never a real password, never derived from a secret.
const WRONG_PASSWORDS = [
  'dm-wrong-pass-01',
  'dm-wrong-pass-02',
  'dm-wrong-pass-03',
  'dm-wrong-pass-04',
  'dm-wrong-pass-05',
  'dm-wrong-pass-06',
  'dm-wrong-pass-07',
  'dm-wrong-pass-08',
  'dm-wrong-pass-09',
  'dm-wrong-pass-10',
];
const THROTTLE_TEXT_RE =
  /locked|lockout|too many|rate.?limit|throttl|suspended|blocked|try again later|exceeded|attempts exceeded|captcha/i;
const INVALID_TEXT_RE =
  /invalid|incorrect|wrong|credentials|login failed|authentication failed|unauthori[sz]ed|bad credentials|does not match|not match/i;
const UNCALIBRATED_TEXT_RE =
  /not enabled|missing|is required|required field|unknown|not found|must (enable|setup)|email.*(required|format)|password.*(required|format)|\bvalid email\b|invalid (email|username) format|account.*(disabled|deactivated)|user.*not (found|exist)/i;

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

function bodyText(body) {
  if (!body || typeof body !== 'object') return '';
  try {
    return JSON.stringify(body);
  } catch {
    return '';
  }
}

// ---- pure helpers (exported for unit tests) ---------------------------------

/**
 * Judge one login-endpoint response. Returns { kind, reason } where
 * kind is 'invalid' (an ordinary invalid-credentials answer),
 * 'throttle' (a rate-limit / lockout signal — the control exists),
 * 'uncalibrated' (the oracle cannot judge this endpoint), or
 * 'other' (unexpected — also never a finding). Pure.
 */
export function assessLoginResponse(status, body) {
  const text = bodyText(body);
  if (typeof status === 'number' && status === 429) {
    return { kind: 'throttle', reason: 'login endpoint answered HTTP 429' };
  }
  if (THROTTLE_TEXT_RE.test(text)) {
    return { kind: 'throttle', reason: 'login response carries a throttle/lockout signal' };
  }
  if (typeof status === 'number' && status === 403) {
    return { kind: 'throttle', reason: 'login endpoint answered HTTP 403 (sudden refusal)' };
  }
  if (typeof status === 'number' && status === 401) {
    return { kind: 'invalid', reason: 'login endpoint answered HTTP 401 (invalid credentials)' };
  }
  if (
    (status === 400 || status === 200) &&
    INVALID_TEXT_RE.test(text) &&
    !UNCALIBRATED_TEXT_RE.test(text)
  ) {
    return { kind: 'invalid', reason: 'login response reports invalid credentials' };
  }
  if (typeof status === 'number' && (status === 404 || status === 422)) {
    return { kind: 'uncalibrated', reason: `login endpoint answered HTTP ${status}` };
  }
  if (UNCALIBRATED_TEXT_RE.test(text)) {
    return { kind: 'uncalibrated', reason: 'login response does not describe a credential check' };
  }
  if (typeof status === 'number' && status >= 500) {
    return { kind: 'other', reason: `login endpoint answered HTTP ${status}` };
  }
  return { kind: 'other', reason: 'login response is neither invalid-credentials nor throttle' };
}

/**
 * Judge the stuffing run: confirmed only when every one of the
 * MAX_ATTEMPTS wrong passwords was answered as invalid-credentials
 * with no throttle signal anywhere. Pure.
 */
export function assessStuffing(invalidCount, sawThrottle) {
  if (sawThrottle) {
    return { verdict: 'rejected', reason: 'a throttle/lockout signal appeared — the control exists' };
  }
  if (invalidCount >= MAX_ATTEMPTS) {
    return {
      verdict: 'confirmed',
      reason: `${invalidCount} consecutive wrong passwords accepted with no throttle signal`,
    };
  }
  if (invalidCount === 0) {
    return { verdict: 'uncalibrated', reason: 'no invalid-credentials response observed — oracle uncalibrated' };
  }
  return {
    verdict: 'inconclusive',
    reason: `only ${invalidCount} of ${MAX_ATTEMPTS} wrong passwords observed — threshold not met`,
  };
}

// ---- network (fetchFn seam, defaults to global fetch) -----------------------

async function req(fetchFn, url, { method = 'GET', body = null, timeoutMs = TIMEOUT_MS } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, {
      method,
      signal: ctrl.signal,
      headers: {
        'User-Agent': UA,
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

// ---- the probe ---------------------------------------------------------------

export async function probeCredentialStuffing(url, opts = {}) {
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
  const candidates = loginCandidates(routes, origin).slice(0, MAX_LOGIN_CANDIDATES);
  if (!candidates.length) return findings;
  setDiag('loginRoutes', 1);

  // Two JSON login body shapes, tried in order: a shop that rejects
  // the first shape with a missing-field answer has not shown its
  // velocity control yet; a shop that answers the first shape
  // calibrates on it and the second shape is never sent.
  const SHAPES = [
    (pw) => ({ email: creds.username, password: pw }),
    (pw) => ({ username: creds.username, password: pw }),
  ];
  let spent = 0;
  let loginUrl = null;
  let shapeIdx = -1;
  let invalidCount = 0;

  // THE TEST, part 1 — find a calibrated login endpoint + body shape.
  // The first invalid-credentials answer calibrates the oracle
  // (controlOk); any throttle signal stops the probe with [] (the
  // control exists); any other answer moves to the next shape, then
  // the next candidate.
  outer: for (const candidate of candidates) {
    const candidateUrl = stripQuery(candidate);
    for (let s = 0; s < SHAPES.length; s += 1) {
      if (spent >= MAX_TOTAL_POSTS) return findings;
      const r = await req(fetchFn, candidateUrl, { method: 'POST', body: SHAPES[s](WRONG_PASSWORDS[0]) });
      spent += 1;
      if (!r) return findings;
      const judged = assessLoginResponse(r.status, r.json);
      if (judged.kind === 'throttle') return findings;
      if (judged.kind === 'invalid') {
        loginUrl = candidateUrl;
        shapeIdx = s;
        invalidCount = 1;
        setDiag('controlOk', true);
        setDiag('attempts', 1);
        break outer;
      }
      // 'uncalibrated' / 'other': wrong shape or a decoy route — try
      // the next shape, then the next candidate.
    }
  }
  if (!loginUrl) return findings;

  // Part 2 — the remaining 9 wrong passwords on the calibrated endpoint.
  for (let i = 1; i < MAX_ATTEMPTS; i += 1) {
    if (spent >= MAX_TOTAL_POSTS) return findings;
    const r = await req(fetchFn, loginUrl, { method: 'POST', body: SHAPES[shapeIdx](WRONG_PASSWORDS[i]) });
    spent += 1;
    if (!r) return findings;
    const judged = assessLoginResponse(r.status, r.json);
    if (judged.kind === 'throttle') return findings;
    if (judged.kind !== 'invalid') return findings;
    invalidCount += 1;
    setDiag('attempts', invalidCount);
  }

  const verdict = assessStuffing(invalidCount, false);
  if (verdict.verdict !== 'confirmed') return findings;
  findings.push({
    class: 'auth_bruteforce',
    id: `cs-no-ratelimit-${Math.random().toString(36).slice(2, 10)}`,
    title: 'Login accepts repeated wrong passwords without rate limiting (HIGH)',
    severity: 'high',
    url: loginUrl,
    parameter: 'password',
    evidence: ev(
      `POST ${loginUrl} with ${MAX_ATTEMPTS} distinct wrong passwords for the lab account`,
      `All ${MAX_ATTEMPTS} wrong passwords were answered as ordinary invalid-credential responses with no throttle signal anywhere: no HTTP 429, no lockout message, no CAPTCHA, no sudden 403. ${verdict.reason}.`,
      'An attacker replays leaked username/password pairs at scale — the server never slows, blocks, or locks the account, so a breached credential list can be tried without friction.',
    ),
  });
  return findings;
}

export const __csMeta = { phases: ['credential-stuffing'], depth: ['standard', 'deep'] };
