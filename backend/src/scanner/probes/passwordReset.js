// Dark Matter rule-based scanner — password-reset token disclosure /
// predictability probe (#324).
//
// Owns ONLY the token surface of password-reset forms (the valid/invalid
// account ORACLE lives in userEnum.js #45 — non-overlap).
//
//   T1. Token in HTTP response — CRITICAL: the reset POST response body/JSON
//       discloses the reset token or a reset link (token=..., /reset?token=).
//       The token is handed to whoever submitted the request — no mailbox
//       needed: account takeover by response alone.
//   T2. Token predictability/entropy — CRITICAL: if a token is issued, a
//       SECOND reset is requested with a DIFFERENT canary email. Identical
//       tokens across accounts ⇒ predictable. Otherwise the token shape is
//       checked: <16 chars, purely numeric <10 digits, or guessable prefixes
//       (123/abc/test/qwerty/…) ⇒ weak.
//
// Hard safety (probe-side): SUBMISSIONS are LAB-GATED — the POST only fires
// when the target host is listed in opts.labTargets (fail-closed, same model
// as race.js / fileUpload.js). The email used is a per-run canary at
// @example.invalid — no real mailbox, no real account touched. Max 2
// submissions per form. Non-lab targets get a PASSIVE check only: GET the
// reset page and flag a token/link embedded in HTML/JS without any request.
// Defensively framed: we decode our own canary responses; we never claim to
// intercept anyone's mailbox (documented limit in docs/scanner/password-reset.md).

import { isLabTargetHost } from '../../labCreds.js';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';

// JSON-style token disclosure: a reset-related key carrying a token-ish value.
// Minimum 6 chars (short tokens are the weak ones we want to catch); common
// status words are excluded to avoid flagging {"reset_status":"sent"}.
const TOKEN_IN_JSON_RE = /"((?:[^"]*(?:reset|forgot|recover|password_reset|reset_password)[^"]*))"\s*:\s*"([^"\s]{6,256})"/gi;
const NON_TOKEN_VALUES = /^(ok|sent|error|invalid|none|null|true|false|failed|success|pending)$/i;
// URL-style token disclosure tied to a reset-ish path: /reset...?token=...
const TOKEN_IN_URL_RE = /reset[^"'\s>]*[?&](?:token|code)=([A-Za-z0-9\-_~.]{8,256})/i;

function rand() {
  return Math.random().toString(36).slice(2, 10);
}

function ev(request, response, impact) {
  return { request, response, impact_demo: impact, signalCorrelated: true };
}

// Extract a disclosed reset token from a response body, or null.
export function extractResetToken(text) {
  if (!text) return null;
  const m = text.match(TOKEN_IN_URL_RE);
  if (m) return m[1];
  TOKEN_IN_JSON_RE.lastIndex = 0;
  let mm;
  while ((mm = TOKEN_IN_JSON_RE.exec(text)) !== null) {
    // The key must carry reset semantics (regex already enforces this), and
    // the value must not be a placeholder/example string or a status word.
    if (!/example|your-|sample|placeholder/i.test(mm[2]) && !NON_TOKEN_VALUES.test(mm[2])) return mm[2];
  }
  return null;
}

// Entropy bar for reset tokens. Returns a human reason string, or null if the
// token looks strong. Exported for unit tests.
export function weakTokenReason(t) {
  if (!t) return null;
  if (t.length < 16) return `only ${t.length} characters (minimum 16)`;
  if (/^\d+$/.test(t) && t.length < 10) return `purely numeric, ${t.length} digits (< 10)`;
  if (/^(.)\1+$/.test(t)) return 'single repeated character';
  if (/^(123|abc|test|qwerty|password|reset|000)/i.test(t)) return 'matches a guessable-prefix pattern (123/abc/test/…)';
  return null;
}

// Password-reset forms: reset/forgot/recover in the action, and NO password
// input (a form with a password field is a login/change form, not a request).
export function resetTokenForms(forms) {
  return (forms || []).filter((f) => /reset|forgot|recover|password/i.test(String(f.action || ''))
    && !(f.inputs || []).some((i) => String(i.type || '').toLowerCase() === 'password'));
}

// Name of the identifier input (email/username), for the `parameter` field.
function identifierName(form) {
  const inp = (form.inputs || []).find((i) => i.name && /email|user|login|account/i.test(String(i.name)));
  return inp ? inp.name : ((form.inputs || []).find((i) => i.name) || {}).name || 'identifier';
}

function fillReset(form, email) {
  const fields = {};
  for (const inp of form.inputs || []) {
    if (!inp.name) continue;
    const n = inp.name.toLowerCase();
    if (/email|user|login|account/.test(n)) fields[inp.name] = email;
    else fields[inp.name] = inp.value || '';
  }
  return fields;
}

async function submitReset(action, fields, opts) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs || 10000);
  try {
    const res = await fetch(action, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(fields).toString(),
      redirect: 'manual', // never follow — read the response where it lands
    });
    const text = await res.text().catch(() => '');
    return { status: res.status, text: text.slice(0, 200000) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function getPage(pageUrl, opts) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs || 10000);
  try {
    const res = await fetch(pageUrl, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/json' },
      redirect: 'manual',
      signal: ctrl.signal,
    });
    const text = await res.text().catch(() => '');
    return { status: res.status, text: text.slice(0, 200000) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function probePasswordReset(forms, url, opts = {}) {
  const findings = [];
  const rid = rand();
  const rfs = resetTokenForms(forms);
  if (!rfs.length) return findings; // no password-reset surface
  let action;
  try {
    action = new URL(rfs[0].action || '', url).toString();
  } catch {
    return findings;
  }
  const form = rfs[0];
  const param = identifierName(form);

  // ---- Non-lab: passive check only — never submit the form. ----
  if (!isLabTargetHost(action, opts.labTargets)) {
    const page = await getPage(action, opts);
    const tok = page ? extractResetToken(page.text) : null;
    if (tok) {
      findings.push({
        class: 'pwdreset_token_in_response',
        id: `pwdreset-disclose-${rid}`,
        title: 'Password reset page embeds a reset token in HTML/JS without any request — token disclosure',
        severity: 'critical',
        url: action,
        parameter: param,
        evidence: ev(
          `GET ${action} (passive — no form submitted, no request made)`,
          `reset token pre-issued in page source: "${tok.slice(0, 10)}…" (truncated)`,
          'A reset token visible in page source can be harvested by any visitor — mailbox bypass, account takeover'
        ),
      });
    }
    return findings;
  }

  // ---- Lab mode: up to 2 submissions with distinct canary emails. ----
  const email1 = `dmprobe+${rid}a@example.invalid`;
  const email2 = `dmprobe+${rid}b@example.invalid`;
  const r1 = await submitReset(action, fillReset(form, email1), opts);
  const t1 = r1 ? extractResetToken(r1.text) : null;
  if (!t1) return findings; // no token disclosed — nothing to claim

  // T1: token disclosed in the HTTP response.
  findings.push({
    class: 'pwdreset_token_in_response',
    id: `pwdreset-disclose-${rid}`,
    title: 'Password reset token disclosed in HTTP response — no mailbox needed',
    severity: 'critical',
    url: action,
    parameter: param,
    evidence: ev(
      `POST ${action} (reset request, canary email ${email1}) — redirect:manual`,
      `response body carries the reset token: "${t1.slice(0, 10)}…" (truncated; ${r1.status})`,
      'Whoever triggers the reset receives the token directly — the email hop is bypassable: account takeover'
    ),
  });

  // T2: predictability / entropy — second token for a DIFFERENT email.
  const r2 = await submitReset(action, fillReset(form, email2), opts);
  const t2 = r2 ? extractResetToken(r2.text) : null;
  if (t2 && t1 === t2) {
    findings.push({
      class: 'pwdreset_token_predictable',
      id: `pwdreset-predict-${rid}`,
      title: 'Password reset token predictable — identical token issued for different accounts',
      severity: 'critical',
      url: action,
      parameter: param,
      evidence: ev(
        `POST ${action} ×2 with different canary emails (${email1} vs ${email2})`,
        `BOTH responses carried the SAME token "${t1.slice(0, 10)}…" (truncated)`,
        'Tokens are not per-account random — an attacker requests a token for their own account and replays it for the victim'
      ),
    });
    return findings;
  }
  const weakOn = t2 ? (weakTokenReason(t2) || weakTokenReason(t1)) : weakTokenReason(t1);
  if (weakOn) {
    findings.push({
      class: 'pwdreset_token_predictable',
      id: `pwdreset-weak-${rid}`,
      title: 'Password reset token weak entropy — guessable token format',
      severity: 'critical',
      url: action,
      parameter: param,
      evidence: ev(
        `POST ${action} with canary email(s); issued token inspected (our own canary response only)`,
        `issued token "${t1.slice(0, 10)}…" (truncated) fails the entropy bar: ${weakOn}`,
        'Weak token formats can be brute-forced offline — mailbox never needed'
      ),
    });
  }
  return findings;
}

export const __prMeta = { phases: ['password-reset'], depth: ['quick', 'standard', 'deep'] };
