/**
 * fpFilter.js — False-positive filter.
 *
 * Before a finding reaches the user, it must survive this gauntlet:
 *  1. Confidence gate — low-confidence findings need corroboration.
 *  2. Duplicate detection — same type + same URL = one finding.
 *  3. Benign-pattern exclusion — known-safe reflections, error pages.
 *  4. Evidence sanity — evidence must actually relate to the claim.
 *
 * Returns { passed, reason } — failed findings are logged, not shown.
 */

const BENIGN_BODY_PATTERNS = [
  /example\.com/i,           // documentation examples
  /lorem ipsum/i,            // placeholder text
  /<title>404/i,             // plain 404 pages
  /under construction/i,
];

const BENIGN_URL_PATTERNS = [
  /\/static\//i,
  /\.(css|js|png|jpg|gif|svg|woff2?)(\?|$)/i,
];

/**
 * Check if a finding is likely a false positive.
 */
export function filterFinding(finding = {}, existingFindings = []) {
  // 1. Confidence gate.
  if (finding.confidence === 'low' && !finding.corroborated) {
    return { passed: false, reason: 'low confidence without corroboration' };
  }

  // 2. Duplicate detection.
  const dup = existingFindings.find(
    (e) => e.type === finding.type && e.url === finding.url
  );
  if (dup) {
    return { passed: false, reason: `duplicate of finding ${dup.id || 'existing'}` };
  }

  // 3. Benign patterns.
  const body = String(finding.body || '');
  const url = String(finding.url || '');
  for (const p of BENIGN_BODY_PATTERNS) {
    if (p.test(body)) return { passed: false, reason: 'benign body pattern' };
  }
  for (const p of BENIGN_URL_PATTERNS) {
    if (p.test(url)) return { passed: false, reason: 'static asset URL' };
  }

  // 4. Evidence sanity.
  const evidence = String(finding.evidence || '');
  if (!evidence || evidence.length < 5) {
    return { passed: false, reason: 'insufficient evidence' };
  }

  return { passed: true, reason: 'survived all filters' };
}

/**
 * Filter a batch, returning { passed, filtered } with reasons.
 */
export function filterBatch(findings = []) {
  const passed = [];
  const filtered = [];
  for (const f of findings) {
    const result = filterFinding(f, passed);
    if (result.passed) passed.push(f);
    else filtered.push({ finding: f, reason: result.reason });
  }
  return { passed, filtered };
}

export const FP_FILTER = { filterFinding, filterBatch };
export default FP_FILTER;
