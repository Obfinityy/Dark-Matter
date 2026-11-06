// Fuzzy label matching for OCR-mangled screen text (27 Oct 2026).
//
// LIVE FAILURE (22:50:01 IST 27 Oct 2026, DVWA hunt h_830317bdc184):
// the deterministic login-first fired and FAILED with reason
// 'fill-failed' — the OCR screen map reads the DVWA login labels
// as "u ername" and "pa word" (the 's' dropped / split by OCR),
// so the exact-label click for "Username" found no match, and the
// whole login died on one OCR misread.
//
// The fix is layered:
//   (a) NORMALISED matching — strip spaces/punctuation, compare
//       case-insensitively: "user name" matches "Username".
//   (b) FUZZY matching — a small edit distance on the normalised
//       forms: "u ername" (flat "uername") is distance 1 from
//       "username"; "pa word" (flat "paword") is distance 2 from
//       "password". A close match is never a reason to fail.
//   (c) COORDINATES fallback — when even the fuzzy match misses,
//       the login falls back to the screen map: the closest map
//       line's (x, y) is clicked directly (labLogin.js).
//
// This module is the CANONICAL implementation, used by labLogin's
// map fallback. The CDP click resolver (resolveClickTarget in
// guiTools.js) carries an INLINE copy of the same logic, because
// its source is stringified into the CDP driver script and run in
// the page — it cannot import. The two MUST stay in sync; the
// sync test in guiTools.click.test.js asserts they agree on a
// fixed case table. Pure; no network, no Meta.

/** Lowercase + strip everything but letters and digits. "u ername" -> "uername". */
export function flatLabel(s) {
  return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Levenshtein distance on the FLAT forms (so "u ername" and
 * "Username" compare as "uername" vs "username" — distance 1).
 * Two-row DP, ES2019-safe. Pure.
 */
export function labelEditDistance(a, b) {
  const x = flatLabel(a);
  const y = flatLabel(b);
  if (x === y) return 0;
  if (!x.length) return y.length;
  if (!y.length) return x.length;
  let prev = new Array(y.length + 1);
  let cur = new Array(y.length + 1);
  for (let j = 0; j <= y.length; j++) prev[j] = j;
  for (let i = 1; i <= x.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= y.length; j++) {
      const cost = x[i - 1] === y[j - 1] ? 0 : 1;
      const del = prev[j] + 1;
      const ins = cur[j - 1] + 1;
      const sub = prev[j - 1] + cost;
      cur[j] = del < ins ? (del < sub ? del : sub) : (ins < sub ? ins : sub);
    }
    const tmp = prev;
    prev = cur;
    cur = tmp;
  }
  return prev[y.length];
}

/** The fuzzy threshold: at most a quarter of the wanted label's length, at least 1. */
export function fuzzyThreshold(len) {
  return Math.max(1, Math.floor(Number(len || 0) / 4));
}

/**
 * The best label for `wanted` among `labels`, by flat edit
 * distance. Options: maxDistance (reject when the best is
 * farther — Infinity takes the closest whatever it is) and
 * requireUnique (reject when two labels tie for best — never
 * guess between equals). Returns { index, label, distance } or
 * null. Pure.
 */
export function bestLabelMatch(wanted, labels, { maxDistance = Infinity, requireUnique = false } = {}) {
  const want = flatLabel(wanted);
  if (!want) return null;
  const list = Array.isArray(labels) ? labels : [];
  let best = null;
  let bestDist = Infinity;
  let bestCount = 0;
  for (let i = 0; i < list.length; i++) {
    const lab = String(list[i] == null ? '' : list[i]);
    const flatLab = flatLabel(lab);
    if (!flatLab) continue;
    // NO-WIDENING (7 Nov 2026, script-harness lane): a candidate
    // that is the wanted label plus an extra leading/trailing run
    // is a DIFFERENT item, not an OCR misread of the wanted one —
    // 'acquisitions.md.bak' is not 'acquisitions.md' (a file
    // extension), and 'xftp/acquisitions.md' is not
    // 'ftp/acquisitions.md' (a different directory). Both sit
    // within edit distance of the wanted label, so distance alone
    // cannot tell them apart from a misread. A shorter candidate
    // (a dropped letter, the OCR case) is unaffected: only the
    // strictly-longer, prefix/suffix-containing form is skipped.
    if (flatLab.length > want.length && (flatLab.startsWith(want) || flatLab.endsWith(want))) continue;
    const d = labelEditDistance(want, lab);
    if (d < bestDist) {
      bestDist = d;
      best = { index: i, label: lab, distance: d };
      bestCount = 1;
    } else if (d === bestDist) {
      bestCount++;
    }
  }
  if (!best) return null;
  if (bestDist > maxDistance) return null;
  if (requireUnique && bestCount > 1) return null;
  return best;
}
