// Dark Matter rule-based scanner — Weak Password Policy probe
// (coverage row #55 [Medium] Weak Password Policy, CWE-521 | ASVS
// V6; phase 111, 'weak-password-policy'.)
//
// ORACLE (deterministic, no judge, no LLM, $0): a password policy
// is weak when the server ACCEPTS a trivial password at
// registration. The probe calibrates with a CONTROL first — a fresh
// account with a strong 16-character password must register (2xx +
// JSON, no refusal text). If the control fails, registration does
// not work in this shape and the probe returns [] (uncalibrated,
// not a finding). Then it tries three trivial passwords in order —
// 'a' (1 character), '123456' (top common password), 'password'
// (top common password) — each on a fresh random email, stopping
// at the first acceptance. CONFIRM only when a trivial password is
// accepted on the same route the control succeeded on. If every
// trivial password is refused (400/409/422 or a password-policy
// refusal message) that is a proven true negative, not a finding.
//
// No mined registration route means an honest [] — the probe never
// invents a route. DVWA has no self-registration surface, so the
// probe is a true negative there by construction; Juice Shop's
// POST /api/Users is mined from the same apiRoutes feed bfla uses
// (see bfla.js findRegisterRoutes).
//
// GATES: labCreds + allowWrite + isLabTargetHost (same lab gate as
// bfla / credential-stuffing / twofa-bruteforce); depth 'quick'
// skips the probe. BOUND: at most 5 POSTs (2 control attempts
// across at most 2 register routes, 3 trivial attempts). Findings
// are class 'weak_password_policy' — the DEFAULT confirmation
// protocol, judged on evidence.signalCorrelated (see
// differential.js; same pattern as autocomplete).

import { isLabTargetHost } from '../../labCreds.js';
import { findRegisterRoutes } from './bfla.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const TIMEOUT_MS = 15000;
const MAX_CONTROL_ROUTES = 2;
// Fixed canary strong password for the control registration —
// never a real password, never derived from a secret. 16
// characters, mixed case + digits + symbol: any policy worth the
// name accepts it, so a control failure means registration itself
// does not work in this shape, not that the policy is strict.
const STRONG_PASSWORD = 'Dm-Strong-9xQw!z7';
// Trivial passwords, weakest first: a 1-character password is the
// strongest possible evidence of a missing policy, then the two
// most common passwords in every leaked-password list. These are
// public test values, never real credentials.
const TRIVIAL_PASSWORDS = [
  { password: 'a', kind: 'single-char' },
  { password: '123456', kind: 'common-numeric' },
  { password: 'password', kind: 'common-word' },
];
const REFUSAL_TEXT_RE =
  /password.*(too (short|weak)|must be|at least|minimum|invalid|not (strong|complex) enough)|weak password|too short|already (exists|registered|in use)|email.*(taken|exists|already)/i;

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

function ev(request, response, impact) {
  return { request, response, impact_demo: impact, signalCorrelated: true };
}

function bodyText(body) {
  if (body == null) return '';
  if (typeof body === 'string') return body;
  try {
    return JSON.stringify(body);
  } catch {
    return '';
  }
}

// ---- pure helpers (exported for unit tests) ---------------------------------

/**
 * Judge one registration response. Returns { kind, reason } where
 * kind is 'accepted' (2xx + a JSON body with no refusal text and
 * no error payload), 'rejected' (400/409/422, a refusal message in
 * the body, or a 2xx error payload — the server refused the
 * password), or 'other' (anything else — 5xx, redirect, empty 2xx,
 * or a non-JSON 2xx such as the SPA HTML shell, which proves
 * nothing about the registration endpoint). Pure.
 */
export function assessRegisterResponse(status, body) {
  const text = bodyText(body);
  if (typeof status === 'number' && (status === 400 || status === 409 || status === 422)) {
    return { kind: 'rejected', reason: `registration refused with HTTP ${status}` };
  }
  if (REFUSAL_TEXT_RE.test(text)) {
    return { kind: 'rejected', reason: 'registration response carries a refusal message' };
  }
  if (typeof status === 'number' && status >= 200 && status < 300) {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      return { kind: 'other', reason: 'registration answered 2xx with an empty body' };
    }
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      return { kind: 'other', reason: 'registration answered 2xx with a non-JSON body' };
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && (parsed.status === 'error' || parsed.success === false)) {
        return { kind: 'rejected', reason: 'registration answered 2xx with an error payload' };
      }
    } catch {
      return { kind: 'other', reason: 'registration answered 2xx with unparseable JSON' };
    }
    return { kind: 'accepted', reason: `registration answered HTTP ${status} with a JSON body` };
  }
  return { kind: 'other', reason: `registration answered HTTP ${status}` };
}

/**
 * Judge the weak-password flow: confirmed only when the strong
 * control registered AND a trivial password registered on the same
 * route; rejected when the control registered but every trivial
 * password was refused (the policy holds — a proven true negative);
 * uncalibrated when the control never registered (registration
 * itself does not work in this shape) or the trivial attempts were
 * inconclusive. Pure.
 */
export function assessWeakPasswordFlow(controlKind, trivialKind) {
  if (controlKind !== 'accepted') {
    return {
      verdict: 'uncalibrated',
      reason: 'the strong-password control did not register — no valid control',
    };
  }
  if (trivialKind === 'accepted') {
    return {
      verdict: 'confirmed',
      reason:
        'the server accepted a trivial password on the same route the strong-password control registered on',
    };
  }
  if (trivialKind === 'rejected') {
    return {
      verdict: 'rejected',
      reason: 'the server refused every trivial password — the password policy holds',
    };
  }
  return {
    verdict: 'uncalibrated',
    reason: 'the trivial-password attempts were inconclusive',
  };
}

// ---- network (fetchFn seam, defaults to global fetch) -----------------------

async function req(fetchFn, url, { method = 'POST', body = null, timeoutMs = TIMEOUT_MS } = {}) {
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
    return { status: res.status, text: text.slice(0, 200000) };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// One registration attempt: POST {email, password, passwordRepeat}
// (the Juice shape bfla proved live). Returns the judged kind
// ('accepted' | 'rejected' | 'other') plus the raw answer for
// evidence. A null answer (network error / timeout) is 'other'.
async function tryRegister(fetchFn, route, email, password) {
  const r = await req(fetchFn, route, {
    method: 'POST',
    body: { email, password, passwordRepeat: password },
  });
  if (!r) return { kind: 'other', status: null, text: '' };
  const judged = assessRegisterResponse(r.status, r.text);
  return { kind: judged.kind, status: r.status, text: r.text };
}

// ---- the probe ---------------------------------------------------------------

export async function probeWeakPasswordPolicy(url, opts = {}) {
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
  const registerRoutes = findRegisterRoutes(routes, origin);
  setDiag('registerRoutes', registerRoutes.length);
  if (!registerRoutes.length) return findings;

  // THE TEST, part 1 — the strong-password control. Without a
  // control registration there is no baseline to compare against,
  // so the probe returns [] (uncalibrated, not a finding). Each
  // attempt uses a fresh random email so re-runs never collide
  // with an existing account.
  let controlRoute = null;
  for (const route of registerRoutes.slice(0, MAX_CONTROL_ROUTES)) {
    const controlEmail = `dm-wpp-control-${rand()}@example.com`;
    const control = await tryRegister(fetchFn, route, controlEmail, STRONG_PASSWORD);
    if (control.kind === 'accepted') {
      controlRoute = route;
      setDiag('controlOk', true);
      break;
    }
    // 'rejected' means this route needs different fields; 'other'
    // means it is broken — either way, try the next route.
  }
  if (!controlRoute) return findings;

  // Part 2 — the trivial passwords, weakest first, on the route
  // the control succeeded on. The first acceptance confirms
  // (max 1 finding); every refusal is the policy working.
  let attempts = 0;
  for (const { password, kind } of TRIVIAL_PASSWORDS) {
    const trivialEmail = `dm-wpp-${rand()}@example.com`;
    const attempt = await tryRegister(fetchFn, controlRoute, trivialEmail, password);
    attempts += 1;
    setDiag('attempts', attempts);
    const verdict = assessWeakPasswordFlow('accepted', attempt.kind);
    if (verdict.verdict === 'confirmed') {
      setDiag('acceptedKind', kind);
      setDiag('bypassKind', 'trivial-password-accepted');
      findings.push({
        class: 'weak_password_policy',
        id: `wpp-trivial-${rand()}`,
        title: 'Weak password policy — trivial password accepted at registration (MEDIUM)',
        severity: 'medium',
        url: controlRoute,
        parameter: 'password',
        evidence: ev(
          `POST ${controlRoute} {email: '${trivialEmail}', password: '${password}', passwordRepeat: '${password}'}`,
          `Server accepted the trivial password — HTTP ${attempt.status}, ${attempt.text.slice(0, 200)} — on the same route where the strong-password control (16 characters, mixed case + digits + symbol) also registered. ${verdict.reason}.`,
          `Anyone can create an account with a guessable password (${kind === 'single-char' ? 'a 1-character password' : `the common password '${password}'`}) — the account is then fully usable for login, so weak credentials are an attacker-controlled entry point, not a cosmetic policy gap.`,
        ),
      });
      return findings;
    }
    // 'rejected' is the policy working — keep trying the next
    // trivial password; 'other' is inconclusive for this password
    // — keep trying too, and let the final verdict fall through.
  }
  return findings;
}

export const __weakPasswordPolicyMeta = { phases: ['weak-password-policy'], depth: ['standard', 'deep'] };
