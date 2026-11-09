// Dark Matter rule-based scanner — autocomplete on sensitive fields probe
// (coverage row #483 [Low] Autocomplete enabled on sensitive fields,
// CWE-200 / CWE-525 | OWASP WSTG v4.2; phase 103, 'autocomplete').
//
// ORACLE (pure static HTML, no drive, no network beyond the page body
// the scan already fetched, no LLM, $0): a browser stores what a user
// types into an autocompleted field in its form-history store and
// re-offers it on later visits — on a shared machine, or to anyone who
// can read the profile, the value leaks. A field is a finding ONLY when
// ALL THREE hold:
//   1. It is SENSITIVE — type="password", or a text-like input whose
//      name/id (or autocomplete token) names a password, a payment
//      card, a secret/token/key, an SSN, a PIN, or a card expiry.
//      A plain username / email / search / comment field is NEVER
//      sensitive, whatever its autocomplete value is — the probe
//      flags genuinely sensitive fields only, not every input.
//   2. It is UNPROTECTED — its autocomplete attribute is absent, or
//      explicitly "on", or any token other than the protected ones
//      below. The enclosing <form>'s autocomplete="off" protects an
//      input that carries no autocomplete attribute of its own (the
//      input's own attribute wins when present, per the HTML spec).
//   3. It can take input — type="hidden" (never autofilled), submit /
//      button / checkbox / radio / file / image / reset and other
//      non-text controls never fire, and a disabled input never
//      fires (it cannot receive a value at all).
//
// PROTECTED VALUES (the narrow carve-out, decided on standards
// grounds before any proof run): autocomplete="off" protects any
// sensitive field. On a PASSWORD field only, the password-manager
// tokens "current-password" and "new-password" also protect — they
// are the spec-blessed credential values, routing the value to the
// browser's credential manager instead of plain form history, so
// flagging a correctly-built login form would be a false positive.
// Payment tokens (cc-number, cc-exp, cc-csc, ...) do NOT protect:
// they still let the browser store card data, and the scout names
// payment forms explicitly as in scope — only "off" disables that
// storage (WSTG: sensitive fields such as credit-card numbers should
// carry autocomplete="off").
//
// GATE DECISION (9 Nov 2026, chosen on OWASP/ASVS grounds BEFORE any
// proof run — recorded here and in the lane report): static served-HTML
// check only. No lab gate, no allowWrite gate, all depths (quick /
// standard / deep) — the check is read-only on a body the scan
// already holds, exactly like browser-storage. Consequence, stated up
// front: DVWA's server-rendered login form carries a password input
// with no autocomplete attribute, so the DVWA proof leg is expected
// to be 1 real [Low] finding; Juice Shop is an Angular SPA whose
// served shell carries no inputs at all, so its leg is expected to
// be a true negative (no surface in the served HTML). The gate is not
// tuned to force either outcome.
//
// KNOWN LIMIT (v1): only the SERVED page HTML is mined (plus, in
// site mode, every discovered page's HTML, merged by runScan). Forms
// rendered client-side by JavaScript are invisible to this check —
// the dom-render analysis merges DOM inputs into pageAnalysis, but
// those records carry no autocomplete attribute, so a v2 would need
// the renderer to keep it. The probe never guesses: no sensitive
// input in the served HTML means an honest [] with diagnostics
// (sensitiveInputs 0), never a finding.
//
// VERIFICATION: the input tag IS the evidence (field name, type,
// autocomplete value, redacted snippet — a value="..." attribute is
// never copied into evidence, it is replaced by a redaction marker),
// so the differential verifier judges this on the default protocol
// (signalCorrelated). The class name 'autocomplete' is routed by
// protocolFor to the default protocol: it matches no family branch
// (no 'sqli'/'xss'/'idor'/'ssrf'/'bypass' substring, no 'oob'
// suffix, and none of the protocol keys) — verified by a unit test
// that calls assessConfirmation on a probe finding and expects
// 'confirmed'.
//
// SAFETY: no network at all — the probe parses a string. At most 5
// findings per scan, one per field (dedup on type + name + id).

import { extractAttributes } from '../pageAnalyze.js';

const MAX_FINDINGS = 5;

// Text-like input types the browser autocompletes from form history.
// type="password" is always sensitive; the rest are sensitive only
// when their name/id (or autocomplete token) names sensitive data.
const ELIGIBLE_TYPES = new Set(['password', 'text', 'search', 'tel', 'email', 'number']);

// Sensitive-name patterns (name + id, case-insensitive). Deliberately
// narrow: a plain username / email / search field never matches.
// 'pin' is token-matched, not substring-matched — 'shipping' must
// never fire (see hasPinToken).
const PASSWORD_NAME_RE = /(passw|passwd|pwd)/i;
const SECRET_NAME_RE = /(secret|token|api[-_]?key|auth[-_]?key|private[-_]?key|access[-_]?key)/i;
const CARD_NAME_RE = /(credit[-_]?card|card[-_]?num|cc[-_]?num|cardnumber|card[-_]?no)/i;
const CARD_SECURITY_RE = /(cvv|cvc|cvv2|card[-_]?security|security[-_]?code)/i;
const EXPIRY_RE = /(expir|cc[-_]?exp)/i;
const SSN_RE = /(ssn|social[-_]?security)/i;

// Autocomplete tokens that mark the field itself as sensitive — the
// author already told the browser what the field carries. The two
// password-manager tokens also PROTECT a password field (see the
// header); the card tokens do not.
const SENSITIVE_AUTOCOMPLETE_TOKENS = new Set([
  'cc-number',
  'cc-exp',
  'cc-exp-month',
  'cc-exp-year',
  'cc-csc',
  'cc-name',
  'cc-type',
  'current-password',
  'new-password',
]);

function ev(request, response, impact) {
  return { request, response, impact_demo: impact, signalCorrelated: true };
}

// Lowercase whitespace-split tokens of an autocomplete attribute
// value ('' when absent). The spec allows a section token first
// ("section-foo cc-number"), so callers match on inclusion, never
// on the first token alone.
function autocompleteTokens(value) {
  if (typeof value !== 'string' || !value.trim()) return [];
  return value.toLowerCase().split(/\s+/).filter(Boolean);
}

// Token match on a name/id: split on separators and compare whole
// tokens, so 'shipping' never matches 'pin' but 'card-pin' does.
function hasPinToken(value) {
  return String(value || '')
    .toLowerCase()
    .split(/[-_.\s]+/)
    .includes('pin');
}

// The <form>…</form> spans of a page body, in document order, each
// with its opening tag's autocomplete value (null when the form
// carries none). An unclosed <form> runs to the end of the body.
function formSpans(html) {
  const text = typeof html === 'string' ? html : '';
  const spans = [];
  const tagRe = /<(\/?)form\b[^>]*>/gi;
  let m;
  let open = null;
  while ((m = tagRe.exec(text)) !== null) {
    if (m[1] !== '/') {
      if (open) spans.push(open);
      open = { start: m.index, end: text.length, autocomplete: extractAttributes(m[0]).autocomplete || null };
    } else if (open) {
      open.end = m.index + m[0].length;
      spans.push(open);
      open = null;
    }
  }
  if (open) spans.push(open);
  return spans;
}

/**
 * Parse every <input> in a page body into field records:
 * { type, name, id, autocomplete, formAutocomplete, disabled, raw }.
 * formAutocomplete is the enclosing <form>'s autocomplete value (null
 * when the input sits outside any form or the form carries none).
 * Pure.
 */
export function extractInputFields(html) {
  const text = typeof html === 'string' ? html : '';
  const forms = formSpans(text);
  const out = [];
  const re = /<input\b[^>]*>/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const attrs = extractAttributes(m[0]);
    const form = forms.filter((f) => m.index >= f.start && m.index < f.end).pop() || null;
    out.push({
      type: String(attrs.type || 'text').toLowerCase(),
      name: attrs.name || null,
      id: attrs.id || null,
      autocomplete: attrs.autocomplete || null,
      formAutocomplete: form ? form.autocomplete : null,
      disabled: Object.hasOwn(attrs, 'disabled'),
      raw: m[0],
    });
  }
  return out;
}

/**
 * The sensitive kind of a field, or null when it is not sensitive:
 * 'password' | 'card' | 'secret' | 'ssn' | 'pin' | 'expiry'. A field
 * whose type cannot take autocompleted text (hidden, submit, file,
 * checkbox, ...) or that is disabled is never sensitive. Pure.
 */
export function sensitiveKind(field) {
  if (!field || typeof field !== 'object') return null;
  if (field.disabled) return null;
  const type = String(field.type || 'text').toLowerCase();
  if (!ELIGIBLE_TYPES.has(type)) return null;
  if (type === 'password') return 'password';
  const haystack = `${field.name || ''} ${field.id || ''}`;
  if (PASSWORD_NAME_RE.test(haystack)) return 'password';
  if (CARD_NAME_RE.test(haystack) || CARD_SECURITY_RE.test(haystack)) return 'card';
  if (SECRET_NAME_RE.test(haystack)) return 'secret';
  if (SSN_RE.test(haystack)) return 'ssn';
  if (hasPinToken(field.name) || hasPinToken(field.id)) return 'pin';
  if (EXPIRY_RE.test(haystack)) return 'expiry';
  const tokens = autocompleteTokens(field.autocomplete);
  if (tokens.some((t) => SENSITIVE_AUTOCOMPLETE_TOKENS.has(t))) {
    if (tokens.includes('current-password') || tokens.includes('new-password')) return 'password';
    return 'card';
  }
  return null;
}

/**
 * Whether a sensitive field is protected from browser storage:
 * autocomplete="off" on the input itself, or on the enclosing form
 * when the input carries no autocomplete attribute of its own (the
 * input's own attribute wins per the HTML spec), or — on a password
 * field only — the password-manager tokens "current-password" /
 * "new-password". Pure.
 */
export function isAutocompleteProtected(field) {
  if (!field || typeof field !== 'object') return { protected: false, reason: 'no field' };
  const own = autocompleteTokens(field.autocomplete);
  if (own.includes('off')) return { protected: true, reason: 'autocomplete="off" on the input' };
  if (
    String(field.type || '').toLowerCase() === 'password' &&
    (own.includes('current-password') || own.includes('new-password'))
  ) {
    return { protected: true, reason: 'autocomplete carries a password-manager token (current-password / new-password)' };
  }
  if (own.length === 0 && autocompleteTokens(field.formAutocomplete).includes('off')) {
    return { protected: true, reason: 'autocomplete="off" on the enclosing form' };
  }
  return { protected: false, reason: 'no autocomplete="off" on the input or its form' };
}

/**
 * Judge one field: 'confirmed' only for a sensitive, unprotected
 * field; 'rejected' otherwise, with the reason either way. Pure.
 */
export function assessAutocomplete(field) {
  const kind = sensitiveKind(field);
  if (!kind) return { verdict: 'rejected', kind: null, reason: 'not a sensitive field' };
  const prot = isAutocompleteProtected(field);
  if (prot.protected) return { verdict: 'rejected', kind, reason: prot.reason };
  const ac = field.autocomplete ? `autocomplete="${field.autocomplete}"` : 'no autocomplete attribute';
  return {
    verdict: 'confirmed',
    kind,
    reason: `sensitive ${kind} field with ${ac} — the browser stores the entered value in form history`,
  };
}

const KIND_TITLES = {
  password: 'Autocomplete enabled on a sensitive password field (LOW)',
  card: 'Autocomplete enabled on a sensitive payment-card field (LOW)',
  secret: 'Autocomplete enabled on a sensitive secret field (LOW)',
  ssn: 'Autocomplete enabled on a sensitive identification field (LOW)',
  pin: 'Autocomplete enabled on a sensitive PIN field (LOW)',
  expiry: 'Autocomplete enabled on a sensitive card-expiry field (LOW)',
};

// A redacted tag snippet: a value="..." attribute is never copied
// into evidence — it is replaced by a redaction marker, because a
// prefilled value could itself be sensitive.
function redactedSnippet(raw) {
  const redacted = String(raw || '').replace(
    /value\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi,
    'value="…(redacted)"'
  );
  return redacted.length > 400 ? `${redacted.slice(0, 400)}…` : redacted;
}

/**
 * Probe autocomplete on sensitive fields (#483).
 * @param {string} pageUrl — the pasted page URL (findings are filed
 *   under it).
 * @param {string} html — the page HTML (served body, or the merged
 *   site-mode body runScan builds from every discovered page).
 * @param {object} opts — { diagnostics } (optional; receives
 *   inputsScanned / sensitiveInputs / unprotectedInputs).
 * @returns {object[]} findings (class 'autocomplete', low) — at most
 *   1 per field, max 5 per scan.
 */
export async function probeAutocomplete(pageUrl, html, opts = {}) {
  const findings = [];
  const diag = opts && typeof opts.diagnostics === 'object' && opts.diagnostics ? opts.diagnostics : null;
  const setDiag = (k, v) => {
    if (diag) diag[k] = v;
  };
  const fields = extractInputFields(html);
  setDiag('inputsScanned', fields.length);
  let sensitive = 0;
  let unprotected = 0;
  const seen = new Set();
  for (const field of fields) {
    const judged = assessAutocomplete(field);
    if (judged.kind) sensitive += 1;
    if (judged.verdict !== 'confirmed') continue;
    unprotected += 1;
    // Cap findings at MAX_FINDINGS, but keep counting the rest so
    // the diagnostics stay honest about the whole page.
    if (findings.length >= MAX_FINDINGS) continue;
    const key = `${field.type}|${field.name || ''}|${field.id || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const label = field.name || field.id || field.type;
    findings.push({
      class: 'autocomplete',
      id: `autocomplete-${judged.kind}-${label}`,
      title: KIND_TITLES[judged.kind],
      severity: 'low',
      url: pageUrl,
      parameter: label,
      evidence: ev(
        `GET ${pageUrl} (page HTML already fetched — static check, no extra request)`,
        `Sensitive ${judged.kind} field '${label}' (<input type="${field.type}">) on ${pageUrl} has ${field.autocomplete ? `autocomplete="${field.autocomplete}"` : 'no autocomplete attribute'} and no autocomplete="off" on its form. ${judged.reason}. The browser stores the entered value in form history and re-offers it on later visits — on a shared machine the value is readable by the next user. Snippet: ${redactedSnippet(field.raw)}`,
        'A shared-machine / shoulder-surfing read of the browser form-history store — the entered password, card number or secret is re-offered to anyone using the same browser profile. Set autocomplete="off" on the field (or its form); for a login password field, autocomplete="current-password" / "new-password" is the standards-blessed value instead (CWE-200 / CWE-525, OWASP WSTG v4.2).'
      ),
    });
  }
  setDiag('sensitiveInputs', sensitive);
  setDiag('unprotectedInputs', unprotected);
  return findings;
}

export const __autocompleteMeta = { phases: ['autocomplete'], depth: ['quick', 'standard', 'deep'] };
