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
