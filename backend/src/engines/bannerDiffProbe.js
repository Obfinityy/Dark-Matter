/**
 * bannerDiffProbe.js — banner-ordering differential probe analyzer.
 *
 * Two services can report identical Server banners while being different
 * software underneath. This module analyzes *differential* responses to
 * identical probes whose only difference is option/header ordering:
 *  - the order of TLS cipher suites, ALPN protocols, or HTTP/2 settings
 *  - the order of request headers
 *  - the order of query parameters or form fields
 *
 * Implementations leak their identity in how the *response* ordering
 * changes: some servers echo client order, some sort canonically, some
 * reorder by internal priority. Pure analysis — the caller supplies the
 * recorded probe/response pairs. No network activity.
 *
 * Defensive use: authorized fingerprinting during bug-bounty recon to
 * distinguish the real stack behind a masked banner.
 */

/**
 * Normalize a header map to lowercase keys.
 *
 * @param {object} headers
 * @returns {object}
 */
function normHeaders(headers) {
  const h = {};
  for (const [k, v] of Object.entries(headers || {})) h[k.toLowerCase()] = String(v);
  return h;
}

/**
 * Compare two ordered lists and describe how they differ.
 *
 * @param {string[]} a - Order sent in the probe.
 * @param {string[]} b - Order observed in the response.
 * @returns {{ mode: 'echo'|'sorted'|'priority'|'scrambled'|'identical', score: number, detail: string }}
 */
export function classifyOrdering(a, b) {
  const A = (a || []).map(String);
  const B = (b || []).map(String);
  if (A.length === 0 || B.length === 0) {
    return { mode: 'identical', score: 0, detail: 'empty order list' };
  }
  const sameSet = A.length === B.length && A.every(x => B.includes(x));
  if (A.join('|') === B.join('|')) {
    return { mode: 'echo', score: 1, detail: 'response order mirrors probe order' };
  }
  if (sameSet) {
    const sorted = [...A].sort();
    if (sorted.join('|') === B.join('|')) {
      return { mode: 'sorted', score: 1, detail: 'response order is canonically sorted' };
    }
    // Kendall-tau-ish: count how many pairs kept probe order
    let concordant = 0;
    let total = 0;
    for (let i = 0; i < A.length; i++) {
      for (let j = i + 1; j < A.length; j++) {
        const ai = B.indexOf(A[i]);
        const aj = B.indexOf(A[j]);
        if (ai === -1 || aj === -1) continue;
        total++;
        if (ai < aj) concordant++;
      }
    }
    const tau = total ? concordant / total : 0;
    if (tau > 0.85) {
      return { mode: 'echo', score: tau, detail: 'response mostly preserves probe order' };
    }
    if (tau < 0.15) {
      return {
        mode: 'priority',
        score: 1 - tau,
        detail: 'response follows internal priority order, not probe order',
      };
    }
    return {
      mode: 'scrambled',
      score: 1 - Math.abs(tau - 0.5) * 2,
      detail: 'response order is neither echo, sorted, nor priority',
    };
  }
  return { mode: 'scrambled', score: 0.5, detail: 'response set differs from probe set' };
}

/**
 * Analyze a set of differential probes for one target.
 *
 * @param {{ probes: { label: string, sentOrder: string[], observedOrder: string[], dimension: string }[], banner?: string }} input
 *   dimension: e.g. 'tls-ciphers', 'alpn', 'http2-settings', 'request-headers', 'query-params'.
 * @returns {{ type: string, banner: string, differentials: object[], fingerprint: string, confidence: string, evidence: string }}
 */
export function analyzeDifferentialProbes({ probes = [], banner = '' } = {}) {
  const differentials = probes.map(p => ({
    label: p.label,
    dimension: p.dimension,
    ...classifyOrdering(p.sentOrder, p.observedOrder),
  }));

  // A stack whose responses never echo probe order has a strong internal
  // implementation fingerprint; one that always echoes is weak/distinguishable too.
  const modes = differentials.map(d => d.mode);
  const uniqueModes = [...new Set(modes)];
  let fingerprint = 'indeterminate';
  let confidence = 'low';
  if (differentials.length > 0) {
    if (uniqueModes.length === 1 && uniqueModes[0] === 'priority') {
      fingerprint = 'strong-internal-priority';
      confidence = 'high';
    } else if (uniqueModes.length === 1 && uniqueModes[0] === 'echo') {
      fingerprint = 'order-echoing';
      confidence = 'medium';
    } else if (uniqueModes.includes('sorted') && uniqueModes.length === 1) {
      fingerprint = 'canonical-sorting';
      confidence = 'high';
    } else {
      fingerprint = 'mixed-ordering';
      confidence = 'medium';
    }
  }

  const sig = differentials.map(d => `${d.dimension}:${d.mode}`).join('; ');
  return {
    type: 'Banner-Ordering Differential Probing',
    banner: String(banner || ''),
    differentials,
    fingerprint,
    confidence,
    evidence:
      differentials.length > 0
        ? `Ran ${differentials.length} ordering-differential probe(s); response-ordering signature '${sig}' yields implementation fingerprint '${fingerprint}'.`
        : 'No probes supplied.',
  };
}

export const BANNER_DIFF_PROBE = { classifyOrdering, analyzeDifferentialProbes };
export default BANNER_DIFF_PROBE;
