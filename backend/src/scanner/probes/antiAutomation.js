// Dark Matter rule-based scanner — insufficient anti-automation / bot abuse probe
// (coverage row #79 [Medium] Insufficient Anti-Automation / Bot Abuse,
// CWE-799 | OWASP A07:2021; phase 'anti-automation').
//
// ORACLE (deterministic, no judge, no LLM, $0): a login that answers
// machine-speed password attempts with ordinary invalid-credential
// replies and never puts a bot challenge in the way lets an attacker
// script the login form at full speed. The row's lab note names
// exactly the observable test: repeated automated attempts with no
// CAPTCHA / bot challenge and no throttle. With the canary lab
// session we (1) discover a login endpoint from the mined apiRoutes
// (never invented — no login route means an honest []), (2)
// calibrate the oracle with ONE wrong password (the first ordinary
// invalid-credential answer is the control), (3) submit 9 more
// distinct fixed wrong passwords, back-to-back with no delay — the
// attempts themselves are the automation under test. CONFIRM only
// when ALL 10 wrong passwords are each answered with an ordinary
// invalid-credential response (401, or a 400/200 carrying an
// invalid-credentials message) AND no bot challenge appears anywhere
// (no CAPTCHA widget, no challenge page, no JS-challenge marker)
// AND no throttle signal appears anywhere. The FIRST bot challenge
// or throttle signal stops the probe immediately with [] — the
// defense exists, so this is a true negative, not a finding. A
// response that is neither invalid-credentials nor a defense
// (404/422, 5xx, a missing-field answer, a 200 success on a wrong
// password, a "user not found" answer for an unknown account) is
// UNCALIBRATED and also returns [] — a finding without a
// calibrated invalid-credentials signal is a guess.
//
// RELATION TO #42: credential-stuffing confirms the same 10/10
// observable framed as credential replay (leaked pairs). #79
// confirms it framed as missing bot defense, with a BROADER
// challenge detector: #42's throttle text already catches the word
// 'captcha', but #79 additionally catches challenge widgets
// (reCAPTCHA / hCaptcha / Turnstile markers), challenge pages
// ("Just a moment", "checking your browser") and JS-challenge
// markers that never contain the word 'captcha'. The two rows are
// distinct findings (different class, different title) on a shared
// evidence surface — never a duplicate.
//
// The finding is about MISSING bot defense, never about guessing
// the right password: the passwords are a fixed list of
// clearly-fake wrong values ('dm-bot-pass-01' ...), never the
// canary's real password and never a breached pair, and the probe
// never attempts to discover a valid password. The canary is a
// throwaway lab account; the 15-POST cap plus immediate stop on
// any defense signal is what keeps it from being locked out — the
// cap is NEVER raised to "prove" anything.
//
// SURFACE: a same-origin login route from loginCandidates
// (sessionFixation.js — exact /login first, then login-like
// fallbacks, max 3 candidates). Two JSON body shapes are tried in
// order — { email, password } then { username, password } — because
// a shop that rejects the first shape with a missing-field answer
// has not shown its bot defense yet; a shop that answers the first
// shape calibrates on it and the second shape is never sent.
// Form-only logins (DVWA login.php, application/x-www-form-urlencoded)
// are an honest no-op by design: this probe speaks JSON login APIs
// only (Juice Shop POST /rest/user/login), the same single-shape
// honesty as credential-stuffing.
//
// GATES: labCreds + allowWrite + isLabTargetHost (same lab gate as
// credential-stuffing / twofa-bruteforce); depth 'quick' skips the
// probe. BOUND: at most 15 login POSTs (at most 3 candidates x 2
// shapes to calibrate, then 9 follow-up attempts on the calibrated
// endpoint). Findings are class 'anti_automation' — no protocol
// key matches it, so the default confirmation protocol judges it
// on signalCorrelated (see differential.js protocolFor; same
// fall-through as 'auth_bruteforce').
//
// HONEST LIMITS (stated up front, not discovered later):
// - A server-side INVISIBLE bot score (silent risk scoring that
//   never surfaces in a response) is unobservable black-box: the
//   probe judges only observable challenges. A shop with silent
//   scoring and no visible challenge confirms — the evidence says
//   the challenge is absent from every response, not that no
//   scoring exists.
// - The detector is deliberately conservative in the safe
//   direction: any challenge marker anywhere in a response counts
//   as a defense, even a help-text mention. That can only hide a
//   finding (a missed #79), never create one.

import { isLabTargetHost } from '../../labCreds.js';
import { loginCandidates } from './sessionFixation.js';
import { assessLoginResponse } from './credentialStuffing.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const TIMEOUT_MS = 15000;
const MAX_LOGIN_CANDIDATES = 3;
const MAX_ATTEMPTS = 10;
const MAX_TOTAL_POSTS = 15;
// Fixed wrong passwords — never a real password, never derived from
// a secret. A distinct prefix from credential-stuffing's list keeps
// the two probes' traffic distinguishable in lab logs.
const WRONG_PASSWORDS = [
  'dm-bot-pass-01',
  'dm-bot-pass-02',
  'dm-bot-pass-03',
  'dm-bot-pass-04',
  'dm-bot-pass-05',
  'dm-bot-pass-06',
  'dm-bot-pass-07',
  'dm-bot-pass-08',
  'dm-bot-pass-09',
  'dm-bot-pass-10',
];
// Bot-challenge markers in a login response body. Two families:
// (a) challenge widgets — the marker strings a CAPTCHA /
// challenge provider embeds (the response carries the widget even
// when the word 'captcha' never appears); (b) challenge-page text
// — the wording a bot-mitigation interstitial shows ("Just a
// moment", "checking your browser", "verify you are human"). A
// bare 'captcha' anywhere also counts — the same word
// credential-stuffing treats as a throttle signal.
const BOT_CHALLENGE_RES = [
  /g-recaptcha|h-captcha|hcaptcha|cf-turnstile|challenges\.cloudflare\.com|recaptcha\/api|captcha-delivery|_cf_chl_opt|cf-challenge|jschl|captcha/i,
  /just a moment|checking your browser|verify you are human|verify you're human|are you a robot|are you human|please verify|attention required|unusual traffic|automated traffic|bot detection/i,
];

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
 * Judge one login-endpoint response for a bot challenge. Returns
 * { challenged, kind, reason } where kind is 'captcha-widget' (a
 * challenge provider marker), 'challenge-page' (bot-mitigation
 * interstitial wording), or 'none'. A 429 is NOT a bot challenge
 * here — it is a throttle, judged by assessLoginResponse on the
 * throttle path. Pure.
 */
export function detectBotChallenge(status, body) {
  const text = bodyText(body);
  if (BOT_CHALLENGE_RES[0].test(text)) {
    return {
      challenged: true,
      kind: 'captcha-widget',
      reason: 'login response carries a CAPTCHA / challenge-provider marker',
    };
  }
  if (BOT_CHALLENGE_RES[1].test(text)) {
    return {
      challenged: true,
      kind: 'challenge-page',
      reason: 'login response carries bot-mitigation challenge wording',
    };
  }
  return { challenged: false, kind: 'none', reason: 'no bot-challenge marker in the login response' };
}

/**
 * Judge the automation run: confirmed only when every one of the
 * MAX_ATTEMPTS wrong passwords was answered as invalid-credentials
 * with no bot challenge and no throttle signal anywhere. A bot
 * challenge or a throttle vetoes the finding — the defense exists.
 * Pure.
 */
export function assessAutomationRun(invalidCount, sawThrottle, sawBotChallenge) {
  if (sawBotChallenge) {
    return { verdict: 'rejected', reason: 'a bot challenge appeared — the automation defense exists' };
  }
  if (sawThrottle) {
    return { verdict: 'rejected', reason: 'a throttle/lockout signal appeared — the control exists' };
  }
  if (invalidCount >= MAX_ATTEMPTS) {
    return {
      verdict: 'confirmed',
      reason: `${invalidCount} consecutive automated wrong-password attempts answered ordinarily with no bot challenge and no throttle`,
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

export async function probeAntiAutomation(url, opts = {}) {
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
  // bot defense yet; a shop that answers the first shape calibrates
  // on it and the second shape is never sent.
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
  // (controlOk); any bot challenge or throttle signal stops the
  // probe with [] (the defense exists); any other answer moves to
  // the next shape, then the next candidate.
  outer: for (const candidate of candidates) {
    const candidateUrl = stripQuery(candidate);
    for (let s = 0; s < SHAPES.length; s += 1) {
      if (spent >= MAX_TOTAL_POSTS) return findings;
      const r = await req(fetchFn, candidateUrl, { method: 'POST', body: SHAPES[s](WRONG_PASSWORDS[0]) });
      spent += 1;
      if (!r) return findings;
      const challenge = detectBotChallenge(r.status, r.json);
      if (challenge.challenged) {
        setDiag('botChallengeSeen', true);
        setDiag('botChallengeKind', challenge.kind);
        return findings;
      }
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

  // Part 2 — the remaining 9 wrong passwords on the calibrated
  // endpoint, back-to-back: the attempts themselves are the
  // automation under test, so no delay is inserted between them.
  for (let i = 1; i < MAX_ATTEMPTS; i += 1) {
    if (spent >= MAX_TOTAL_POSTS) return findings;
    const r = await req(fetchFn, loginUrl, { method: 'POST', body: SHAPES[shapeIdx](WRONG_PASSWORDS[i]) });
    spent += 1;
    if (!r) return findings;
    const challenge = detectBotChallenge(r.status, r.json);
    if (challenge.challenged) {
      setDiag('botChallengeSeen', true);
      setDiag('botChallengeKind', challenge.kind);
      return findings;
    }
    const judged = assessLoginResponse(r.status, r.json);
    if (judged.kind === 'throttle') return findings;
    if (judged.kind !== 'invalid') return findings;
    invalidCount += 1;
    setDiag('attempts', invalidCount);
  }

  const verdict = assessAutomationRun(invalidCount, false, false);
  if (verdict.verdict !== 'confirmed') return findings;
  findings.push({
    class: 'anti_automation',
    id: `aa-no-bot-check-${Math.random().toString(36).slice(2, 10)}`,
    title: 'Login accepts repeated automated attempts with no bot challenge (MEDIUM)',
    severity: 'medium',
    url: loginUrl,
    parameter: 'password',
    evidence: ev(
      `POST ${loginUrl} with ${MAX_ATTEMPTS} distinct wrong passwords for the lab account, back-to-back with no delay — plain HTTP, no browser, no solved challenge`,
      `All ${MAX_ATTEMPTS} wrong passwords were answered as ordinary invalid-credential responses with no bot challenge anywhere: no CAPTCHA widget, no challenge page, no JS-challenge marker, no HTTP 429, no lockout message, no sudden 403. ${verdict.reason}.`,
      'An attacker scripts the login form at machine speed — credential replay, account enumeration and password spraying run with no friction, because nothing ever asks the caller to prove it is human.',
    ),
  });
  return findings;
}

export const __antiAutomationMeta = { phases: ['anti-automation'], depth: ['standard', 'deep'] };
