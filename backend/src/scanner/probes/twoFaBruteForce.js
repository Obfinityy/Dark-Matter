// Dark Matter rule-based scanner — 2FA code brute-force probe
// (coverage row #326 [High] Auth — 2FA code brute-force (no rate
// limit), CWE-307 | OWASP A07:2021; phase 90, 'twofa-bruteforce').
//
// ORACLE (deterministic, no judge, no LLM, $0): short 2FA codes are
// enumerable when the server never throttles verification attempts.
// With the canary lab session we (1) discover a 2FA verification
// endpoint from the mined apiRoutes (never invented — no verify route
// means an honest []), (2) log in as the canary (shared 4-POST budget,
// same as basket-logic / workflow-skip) and keep any tmpToken the login
// returns (Juice returns one when 2FA is enabled on the account),
// (3) submit wrong codes to the verify endpoint, at most 10 POSTs.
// CONFIRM only when ALL 10 wrong codes are each answered with an
// ordinary wrong-code response (401, or a 400/200 carrying an
// invalid-code message) and NO throttle signal appears anywhere.
// The FIRST throttle signal (HTTP 429, a lockout / too-many-attempts /
// rate-limit message, a CAPTCHA challenge, or a sudden 403 on the
// verify endpoint) stops the probe immediately with [] — the control
// exists, so this is a true negative, not a finding. A response that
// is neither wrong-code nor throttle (2FA not enabled, malformed
// field shape, 404/422, 5xx, or a 200 success on a wrong code) is
// UNCALIBRATED and also returns [] — a finding without a calibrated
// wrong-code signal is a guess.
//
// The finding is about MISSING rate limiting, never about guessing
// the right code: the codes are a fixed list of wrong values
// ('000000', '111111', ...), never derived from any secret, and the
// probe never attempts to discover a valid code. The canary is a
// throwaway lab account; the 10-POST cap plus immediate stop on any
// throttle signal is what keeps it from being locked out — the cap
// is NEVER raised to "prove" anything.
//
// SURFACE: a same-origin route whose path carries '2fa' and a
// verify-family segment (verify / validate / confirm / check),
// excluding status/setup/resend paths. Juice Shop's is
// POST /rest/2fa/verify with body { tmpToken?, totpToken } — that
// is the one body shape this probe speaks; a shop using another
// field name yields an honest no-op (uncalibrated), documented here
// rather than guessed at with extra POSTs.
//
// GATES: labCreds + allowWrite + isLabTargetHost (same lab gate as
// basket-logic / workflow-skip / session-fixation); depth 'quick'
// skips the probe. BOUND: at most 4 login POSTs (shared budget),
// at most 10 verify POSTs. Findings are class 'auth_2fa' — the
// default confirmation protocol judges them on signalCorrelated
// (see differential.js protocolFor: 'auth2fa' hits no family branch
// and falls through to default).

import { isLabTargetHost } from '../../labCreds.js';
import { loginCandidates } from './sessionFixation.js';
import { extractBearerTokenFromJson } from '../labSession.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const TIMEOUT_MS = 15000;
const MAX_LOGIN_CANDIDATES = 3;
const MAX_LOGIN_POSTS = 4;
const MAX_ATTEMPTS = 10;
// Fixed wrong codes — never a real code, never derived from a secret.
const WRONG_CODES = [
  '000000',
  '111111',
  '222222',
  '333333',
  '444444',
  '555555',
  '666666',
  '777777',
  '888888',
  '999999',
];
const VERIFY_PATH_RE = /2fa/i;
const VERIFY_VERB_RE = /verif|valid|confirm|check/i;
const VERIFY_EXCLUDE_RE = /status|setup|resend/i;
const THROTTLE_TEXT_RE =
  /locked|lockout|too many|rate.?limit|throttl|suspended|blocked|try again later|exceeded|attempts exceeded|captcha/i;
const WRONG_CODE_TEXT_RE =
  /invalid|incorrect|wrong|mismatch|failed|does not match|not match|code.*(invalid|incorrect|wrong)|invalid.*code/i;
const UNCALIBRATED_TEXT_RE =
  /not enabled|not set ?up|setup required|no 2fa|2fa.*not|missing|required field|is required|tmp.?token|unknown|not found|must (enable|setup|set up)/i;

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
 * Find a 2FA verification endpoint among mined apiRoutes. Same-origin
 * only; the path must carry '2fa' and a verify-family segment, and
 * must not be a status/setup/resend path. Pure.
 */
export function twoFaVerifyRoute(routes, origin) {
  for (const r of routes || []) {
    try {
      const u = new URL(String(r));
      if (u.origin !== origin) continue;
      const p = u.pathname;
      if (!VERIFY_PATH_RE.test(p)) continue;
      if (!VERIFY_VERB_RE.test(p)) continue;
      if (VERIFY_EXCLUDE_RE.test(p)) continue;
      return stripQuery(u.toString());
    } catch {
      // ignore malformed route entries
    }
  }
  return null;
}

/**
 * Judge one verify-endpoint response. Returns { kind, reason } where
 * kind is 'wrong-code' (an ordinary invalid-code answer), 'throttle'
 * (a rate-limit / lockout signal — the control exists), 'uncalibrated'
 * (the oracle cannot judge this endpoint), or 'other' (unexpected —
 * also never a finding). Pure.
 */
export function assessVerifyResponse(status, body) {
  const text = bodyText(body);
  if (typeof status === 'number' && status === 429) {
    return { kind: 'throttle', reason: 'verify endpoint answered HTTP 429' };
  }
  if (THROTTLE_TEXT_RE.test(text)) {
    return { kind: 'throttle', reason: 'verify response carries a throttle/lockout signal' };
  }
  if (typeof status === 'number' && status === 403) {
    return { kind: 'throttle', reason: 'verify endpoint answered HTTP 403 (sudden refusal)' };
  }
  if (typeof status === 'number' && status === 401) {
    return { kind: 'wrong-code', reason: 'verify endpoint answered HTTP 401 (invalid code)' };
  }
  if (
    (status === 400 || status === 200) &&
    WRONG_CODE_TEXT_RE.test(text) &&
    !UNCALIBRATED_TEXT_RE.test(text)
  ) {
    return { kind: 'wrong-code', reason: 'verify response reports an invalid code' };
  }
  if (typeof status === 'number' && (status === 404 || status === 422)) {
    return { kind: 'uncalibrated', reason: `verify endpoint answered HTTP ${status}` };
  }
  if (UNCALIBRATED_TEXT_RE.test(text)) {
    return { kind: 'uncalibrated', reason: 'verify response does not describe a code check' };
  }
  if (typeof status === 'number' && status >= 500) {
    return { kind: 'other', reason: `verify endpoint answered HTTP ${status}` };
  }
  return { kind: 'other', reason: 'verify response is neither wrong-code nor throttle' };
}

/**
 * Judge the brute-force run: confirmed only when every one of the
 * MAX_ATTEMPTS wrong codes was answered as wrong-code with no
 * throttle signal anywhere. Pure.
 */
export function assessBruteForce(wrongCodeCount, sawThrottle) {
  if (sawThrottle) {
    return { verdict: 'rejected', reason: 'a throttle/lockout signal appeared — the control exists' };
  }
  if (wrongCodeCount >= MAX_ATTEMPTS) {
    return {
      verdict: 'confirmed',
      reason: `${wrongCodeCount} consecutive wrong codes accepted with no throttle signal`,
    };
  }
  if (wrongCodeCount === 0) {
    return { verdict: 'uncalibrated', reason: 'no wrong-code response observed — oracle uncalibrated' };
  }
  return {
    verdict: 'inconclusive',
    reason: `only ${wrongCodeCount} of ${MAX_ATTEMPTS} wrong codes observed — threshold not met`,
  };
}

/** Recursive hunt for a tmpToken string in a login body (Juice login-with-2FA). Pure. */
export function findTmpToken(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 3) return null;
  if (typeof node.tmpToken === 'string' && node.tmpToken) return node.tmpToken;
  for (const v of Object.values(node)) {
    const f = findTmpToken(v, depth + 1);
    if (f != null) return f;
  }
  return null;
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
// Mirrors workflowSkip's tryApiLogin. Returns { ok, token, body, spent }.
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

export async function probeTwoFaBruteForce(url, opts = {}) {
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
  const verifyUrl = twoFaVerifyRoute(routes, origin);
  if (!verifyUrl) return findings;
  setDiag('twoFaRoutes', 1);

  // Login (shared budget, same as basket-logic / workflow-skip): exact
  // /login candidates first, decoy routes skipped after one POST each.
  const loginUrls = loginCandidates(routes, origin).slice(0, MAX_LOGIN_CANDIDATES);
  if (!loginUrls.length) return findings;
  let token = null;
  let tmpToken = null;
  let postsLeft = MAX_LOGIN_POSTS;
  for (const candidate of loginUrls) {
    if (postsLeft <= 0) break;
    const got = await tryApiLogin(fetchFn, candidate, creds, postsLeft);
    postsLeft -= got.spent;
    if (got.ok) {
      token = got.token;
      tmpToken = got.body ? findTmpToken(got.body) : null;
      break;
    }
  }
  if (!token) return findings;

  // THE TEST: at most MAX_ATTEMPTS wrong codes. The first wrong-code
  // response calibrates the oracle (controlOk); any throttle signal,
  // uncalibrated answer, or unexpected answer stops the probe with [].
  let wrongCodeCount = 0;
  for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
    const body = tmpToken
      ? { tmpToken, totpToken: WRONG_CODES[i] }
      : { totpToken: WRONG_CODES[i] };
    const r = await req(fetchFn, verifyUrl, { method: 'POST', token, body });
    if (!r) return findings;
    const judged = assessVerifyResponse(r.status, r.json);
    if (judged.kind === 'throttle') return findings;
    if (judged.kind !== 'wrong-code') return findings;
    wrongCodeCount += 1;
    if (wrongCodeCount === 1) setDiag('controlOk', true);
    setDiag('attempts', wrongCodeCount);
  }

  const verdict = assessBruteForce(wrongCodeCount, false);
  if (verdict.verdict !== 'confirmed') return findings;
  findings.push({
    class: 'auth_2fa',
    id: `tfb-no-ratelimit-${Math.random().toString(36).slice(2, 10)}`,
    title: '2FA verification accepts repeated wrong codes without rate limiting (HIGH)',
    severity: 'high',
    url: verifyUrl,
    parameter: 'totpToken',
    evidence: ev(
      `POST ${verifyUrl} (token auth) with ${MAX_ATTEMPTS} distinct wrong 2FA codes (totpToken)${tmpToken ? ' + the login tmpToken' : ''}`,
      `All ${MAX_ATTEMPTS} wrong codes were answered as ordinary invalid-code responses with no throttle signal anywhere: no HTTP 429, no lockout message, no CAPTCHA, no sudden 403. ${verdict.reason}.`,
      'An attacker enumerates the small 2FA code space at will — a 6-digit code falls to unguided guessing because the server never slows, blocks, or locks the account.',
    ),
  });
  return findings;
}

export const __tfbMeta = { phases: ['twofa-bruteforce'], depth: ['standard', 'deep'] };
