// Dark Matter rule-based scanner — shared oracle guards for evaluation
// detectors (SSTI / EL / eval).
//
// Background (proof #18, 8 Nov 2026): DVWA login.php returns a fresh
// 32-hex user_token on every GET. One payload response's token happened
// to contain the oracle digits 9352 (from {{1336*7}}); the control's
// token did not — and ssti.js fired a CRITICAL false positive on a page
// that never evaluates templates. The old header claim that "a 4-digit
// product cannot coincide with a random token substring" is DISPROVEN:
// any fixed 4-digit string occurs inside a fresh 32-hex token often
// enough to fire across a hunt's thousands of requests — and it did.
//
// Two guards, applied TOGETHER — either alone is insufficient:
//   (a) stripVolatileValues: remove per-request random values (hidden
//       input values, long hex/token-looking attribute values) from BOTH
//       the payload body and the control before the differential.
//       Stripping alone misses random values outside attributes.
//   (b) sameReflectionPoint: the evaluated value must appear in TWO
//       separate payload responses with an identical context window — a
//       genuine evaluation renders into the same static template slot
//       every time, while a random-token coincidence lands elsewhere
//       and changes on every request. A repeat alone can still coincide
//       twice, so the strip guard stays in place as well.

// Matches a whole <input ... type="hidden" ...> tag, whatever the
// attribute order or quoting (type may be unquoted).
const HIDDEN_INPUT_RE = /<input\b[^>]*\btype\s*=\s*(["']?)hidden\1[^>]*>/gi;

// Matches a quoted attribute value that looks like a random token: a
// long hex run (>= 16 chars) or a long base64url-ish run (>= 16 chars).
// Applied to EVERY attribute (value=, content=, data-*, ...) — CSRF
// tokens live in hidden inputs AND in <meta name="csrf-token"
// content="...">. The closing-quote anchor forces the whole value to be
// token-shaped; a partial run never matches.
const TOKEN_ATTR_VALUE_RE =
  /(\s[a-zA-Z][a-zA-Z0-9_-]*\s*=\s*(["']))(?:[0-9a-f]{16,}|[A-Za-z0-9_\-+/=]{16,})\2/g;

// Remove per-request random values from a response body before any
// oracle differential. Pure and never throws.
export function stripVolatileValues(body) {
  if (!body) return '';
  return body.replace(HIDDEN_INPUT_RE, '').replace(TOKEN_ATTR_VALUE_RE, '$1$2');
}

// Context window (chars on each side of the match) that must be identical
// in both payload responses for the match to count as the same
// reflection point.
const CONTEXT = 40;

// True iff `expect` occurs in both stripped bodies at the same
// reflection point: an identical context window around the match. A
// genuine evaluation renders into the same static template slot on every
// request; a random-token coincidence lands at a different offset with a
// different surrounding window.
export function sameReflectionPoint(a, b, expect) {
  const i = a.indexOf(expect);
  const j = b.indexOf(expect);
  if (i < 0 || j < 0) return false;
  const ctx = (body, idx) =>
    body.slice(Math.max(0, idx - CONTEXT), idx + expect.length + CONTEXT);
  return ctx(a, i) === ctx(b, j);
}
// --- Zerodha false-positive guards (9 Nov 2026, hunt h_6b5942052353) ---
// A deep scan of zerodha.com (WordPress + Cloudflare) confirmed 37
// findings that were all false positives from their own evidence: the EL
// "evaluation" was the probe's own URL-encoded payload reflected in a
// link, and the LDAP "oracle" was a Cloudflare "Just a moment" challenge
// page whose length bucket wobbled. The guards below make those shapes
// unconfirmable anywhere, not just on that target.

// Bot-challenge / interstitial pages. A differential whose either side
// is one of these is VOID — the page is not the application answering,
// it is the edge challenging the client. Kept tight on purpose: a page
// that merely CONTAINS a captcha widget (a normal login form) is not
// an interstitial, and a bare "just a moment" without a Cloudflare
// marker is prose, not a challenge page.
const BOT_CHALLENGE_RES = [
  /just a moment/i, // Cloudflare interstitial title — only with a
  /checking your browser/i, // Cloudflare pre-access check
  /cf-challenge/i,
  /challenges\.cloudflare\.com/i,
  /cf-turnstile/i,
  /verify you are human/i, // Cloudflare Turnstile title
  /please verify you are a human/i,
  /ddos protection by cloudflare/i,
];

export function isBotChallengePage(text) {
  const t = String(text || '');
  if (!t) return false;
  if (/just a moment/i.test(t) && /cloudflare/i.test(t)) return true;
  if (/attention required/i.test(t) && /cloudflare/i.test(t)) return true;
  return BOT_CHALLENGE_RES.slice(1).some((re) => re.test(t));
}

// Encoded forms of a payload, for reflection checks. mutateUrl encodes
// query values with URLSearchParams (form-encoding: ' -> %27, ( -> %28),
// so a reflected payload usually appears percent-encoded, never literal.
function payloadForms(payload) {
  const p = String(payload || '');
  const forms = [p, encodeURIComponent(p)];
  try {
    forms.push(new URLSearchParams({ x: p }).toString().slice(2));
  } catch {
    // ignore — the raw and percent-encoded forms still apply
  }
  forms.push(
    p
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;'),
  );
  return forms;
}

// True iff the response body contains the payload in ANY encoding
// (raw, percent-encoded, form-encoded, HTML-escaped). A reflected
// payload is never evaluation — the Zerodha EL false positive was
// exactly this: the URL-encoded payload inside a link.
export function isPayloadReflected(body, payload) {
  const b = String(body || '');
  if (!b || !payload) return false;
  return payloadForms(payload).some((f) => f && b.includes(f));
}

// SELF-REFERENTIAL MARKER BAN: a confirmation marker must never be a
// substring of the sent payload, in any encoding. If the only evidence
// is the marker appearing inside a reflection of the payload, it proves
// nothing — the marker travelled with the payload. The classic shape is
// ${'dmElTest'.toString()} with expect 'dmElTest': the "oracle" is
// literally inside the payload. Such a payload can never confirm.
export function isSelfReferentialMarker(payload, expect) {
  const e = String(expect || '');
  if (!e || !payload) return true;
  return payloadForms(payload).some((f) => f.includes(e));
}

// FP3 — double-control stability. Fetch the benign control twice; the
// two observations must agree beyond trivial per-request rotation.
// Observations are { status, text } with text already stripped of
// volatile values. Disagreement on status class, challenge-ness, or
// length bucket means the page is noisy and the differential is
// inconclusive — never confirmed.
export function controlObservationsStable(a, b) {
  if (!a || !b) return false;
  const cls = (s) => (Number(s) < 400 ? 'ok' : 'err');
  if (cls(a.status) !== cls(b.status)) return false;
  if (isBotChallengePage(a.text) !== isBotChallengePage(b.text)) return false;
  const bucket = (t) => Math.floor(String(t || '').length / 400);
  if (bucket(a.text) !== bucket(b.text)) return false;
  return true;
}

// STACK GATE: EL/LDAP probes only run where the fingerprinted stack can
// plausibly host the evaluator/directory. PHP/WordPress has no EL
// evaluator and no LDAP filter backend; running the probes there only
// manufactures Cloudflare-noise findings. Unknown stack (null) runs:
// the gate only fires on a positive identification.
export function isPhpWordpressStack(stack) {
  if (!stack) return false;
  const list = Array.isArray(stack) ? stack : [stack];
  return list.some((s) => {
    const v = String(s || '').toLowerCase();
    return v.includes('php') || v.includes('wordpress');
  });
}
