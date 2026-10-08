/**
 * faviconImpersonationDetector.js — Lookalike favicon detection for phishing defense.
 *
 * Phishing kits routinely copy a brand's favicon.ico pixel-for-pixel. This module
 * compares favicon fingerprints (hex hash strings collected during reconnaissance,
 * e.g. Shodan-style murmur3 hashes or content hashes) to flag suspicious sites
 * that reuse the target's icon — a strong live-impersonation signal.
 *
 * Defensive framing: all inputs are supplied by the operator from their own
 * authorized scanning data. This module only compares hashes, never fetches.
 */

/**
 * Normalize a favicon hash string for comparison.
 * Accepts plain hex, or signed/unsigned murmur3 decimal strings.
 * @param {string|number} hash
 * @returns {string} lowercase normalized string, '' if invalid
 */
export function normalizeFaviconHash(hash) {
  if (hash === null || hash === undefined) return '';
  let s = String(hash).trim().toLowerCase();
  if (/^-?\d+$/.test(s)) {
    // Signed 32-bit decimal (Shodan murmur3 style) -> unsigned hex
    const n = parseInt(s, 10) >>> 0;
    return n.toString(16).padStart(8, '0');
  }
  if (/^0x[0-9a-f]+$/.test(s)) s = s.slice(2);
  return /^[0-9a-f]+$/.test(s) ? s : '';
}

/**
 * Hamming distance between two equal-length hex strings, measured in bits.
 * @param {string} a
 * @param {string} b
 * @returns {number} bit distance, or Infinity if lengths mismatch
 */
export function hammingDistanceHex(a, b) {
  const x = normalizeFaviconHash(a);
  const y = normalizeFaviconHash(b);
  if (!x || !y || x.length !== y.length) return Infinity;
  let dist = 0;
  for (let i = 0; i < x.length; i++) {
    let v = parseInt(x[i], 16) ^ parseInt(y[i], 16);
    while (v) {
      dist += v & 1;
      v >>>= 1;
    }
  }
  return dist;
}

/**
 * Similarity score in [0, 1] from bit distance.
 */
export function hashSimilarity(a, b) {
  const x = normalizeFaviconHash(a);
  const y = normalizeFaviconHash(b);
  if (!x || !y || x.length !== y.length) return 0;
  const dist = hammingDistanceHex(x, y);
  const total = x.length * 4;
  return 1 - dist / total;
}

/**
 * Compare the target's favicon against a set of candidate favicons.
 *
 * @param {string} targetHash The brand's known-good favicon hash
 * @param {{host: string, faviconHash: string, pageTitle?: string, firstSeen?: string}[]} candidates
 * @param {{similarityThreshold?: number}} options similarity in [0,1]; default 0.85
 * @returns {object[]} findings sorted by similarity desc, with verdicts and evidence
 */
export function compareFavicons(targetHash, candidates = [], options = {}) {
  const target = normalizeFaviconHash(targetHash);
  if (!target) return [];
  const threshold = options.similarityThreshold ?? 0.85;
  const findings = [];

  for (const c of candidates) {
    if (!c || !c.faviconHash) continue;
    const sim = hashSimilarity(target, c.faviconHash);
    if (sim < threshold) continue;
    findings.push({
      type: 'favicon-impersonation',
      host: c.host,
      similarity: Number(sim.toFixed(4)),
      verdict: sim === 1 ? 'exact-match' : sim >= 0.95 ? 'near-identical' : 'strong-resemblance',
      severity: sim === 1 ? 'high' : 'medium',
      evidence: {
        targetHash: target,
        candidateHash: normalizeFaviconHash(c.faviconHash),
        bitDistance: hammingDistanceHex(target, c.faviconHash),
        pageTitle: c.pageTitle || null,
        firstSeen: c.firstSeen || null,
      },
    });
  }
  return findings.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Group candidates by hash to find icon-reuse clusters (one kit, many hosts).
 * @param {{host: string, faviconHash: string}[]} candidates
 */
export function clusterIconReuse(candidates = []) {
  const clusters = new Map();
  for (const c of candidates) {
    const h = normalizeFaviconHash(c?.faviconHash);
    if (!h) continue;
    if (!clusters.has(h)) clusters.set(h, { faviconHash: h, hosts: [], hostCount: 0 });
    const cluster = clusters.get(h);
    if (!cluster.hosts.includes(c.host)) {
      cluster.hosts.push(c.host);
      cluster.hostCount += 1;
    }
  }
  return [...clusters.values()]
    .filter(c => c.hostCount > 1)
    .sort((a, b) => b.hostCount - a.hostCount);
}

export const FAVICON_IMPERSONATION_DETECTOR = {
  normalizeFaviconHash,
  hammingDistanceHex,
  hashSimilarity,
  compareFavicons,
  clusterIconReuse,
};

export default FAVICON_IMPERSONATION_DETECTOR;
