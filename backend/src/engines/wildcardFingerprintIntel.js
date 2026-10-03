/**
 * wildcardFingerprintIntel.js — DNS wildcard behaviour fingerprinting and
 * wildcard-exclusion wordlist filtering.
 *
 * Implements idea-bank items 00064–00065:
 *  - 00064: probe random non-existent labels under a zone to characterise
 *    wildcard synthesis (NXDOMAIN vs synthesized answers), producing a
 *    measurable wildcard signature instead of a boolean guess.
 *  - 00065: filter brute-force enumeration results through the measured
 *    signature so wildcard-synthesised answers are eliminated as false
 *    positives at scale, while genuinely distinct real hosts are kept.
 *
 * All functions are pure: DNS probing stays with the caller, which passes
 * {label, status, answers:[{type, value}]} probe/result objects in.
 */

/**
 * @typedef {{label: string, status: 'NOERROR'|'NXDOMAIN'|'SERVFAIL'|'TIMEOUT', answers: {type: string, value: string}[]}} DnsProbe
 */

/**
 * Characterise wildcard behaviour of a zone from random-label probes.
 * A zone is a wildcard when a large majority of random labels return the
 * same answer set instead of NXDOMAIN.
 *
 * @param {DnsProbe[]} probes random-label probes (labels must NOT exist)
 * @returns {{
 *   isWildcard: boolean,
 *   wildcardType: 'none'|'A'|'AAAA'|'CNAME'|'MIXED',
 *   synthesisRate: number,
 *   signature: {type: string, value: string}[],
 *   confidence: number,
 *   samples: number
 * }}
 */
export function characteriseWildcard(probes) {
  const usable = probes.filter((p) => p.status === 'NOERROR' || p.status === 'NXDOMAIN');
  const result = {
    isWildcard: false,
    wildcardType: 'none',
    synthesisRate: 0,
    signature: [],
    confidence: 0,
    samples: usable.length,
  };
  if (usable.length === 0) return result;

  const synthesized = usable.filter(
    (p) => p.status === 'NOERROR' && p.answers && p.answers.length > 0,
  );
  result.synthesisRate = Math.round((synthesized.length / usable.length) * 1000) / 1000;
  if (result.synthesisRate < 0.8) return result;

  // The signature is the most common answer set among synthesized responses.
  const keyCounts = new Map();
  const keyToAnswers = new Map();
  for (const p of synthesized) {
    const key = p.answers
      .map((a) => `${String(a.type).toUpperCase()}:${String(a.value).trim().toLowerCase().replace(/\.+$/, '')}`)
      .sort()
      .join('|');
    keyCounts.set(key, (keyCounts.get(key) || 0) + 1);
    if (!keyToAnswers.has(key)) keyToAnswers.set(key, p.answers);
  }
  const top = [...keyCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!top) return result;
  const [sigKey, sigCount] = top;
  const consistency = sigCount / synthesized.length;

  result.isWildcard = consistency >= 0.8;
  result.signature = (keyToAnswers.get(sigKey) || []).map((a) => ({
    type: String(a.type).toUpperCase(),
    value: String(a.value).trim().toLowerCase().replace(/\.+$/, ''),
  }));
  const types = new Set(result.signature.map((a) => a.type));
  result.wildcardType = types.size === 0 ? 'none' : types.size > 1 ? 'MIXED' : [...types][0];
  result.confidence = Math.round(result.synthesisRate * consistency * 1000) / 1000;
  return result;
}

/**
 * Test whether an enumeration result matches a measured wildcard signature.
 * A result is wildcard-synthetic when its answer set is identical to the
 * signature; real hosts differ (extra records, different IPs, CNAME chains).
 *
 * @param {{answers: {type: string, value: string}[]}} result
 * @param {{type: string, value: string}[]} signature
 * @returns {boolean}
 */
export function matchesWildcardSignature(result, signature) {
  if (!signature || signature.length === 0) return false;
  const answers = (result.answers || []).map((a) => ({
    type: String(a.type).toUpperCase(),
    value: String(a.value).trim().toLowerCase().replace(/\.+$/, ''),
  }));
  if (answers.length === 0) return false;
  const norm = (list) => list.map((a) => `${a.type}:${a.value}`).sort().join('|');
  const sigNorm = norm(signature.map((a) => ({
    type: String(a.type).toUpperCase(),
    value: String(a.value).trim().toLowerCase().replace(/\.+$/, ''),
  })));
  // Wildcard-synthesized A/AAAA answers may rotate through a small IP pool:
  // accept single-type IP-only answers whose values are all in the signature pool.
  const sigByType = new Map();
  for (const a of signature) {
    const t = String(a.type).toUpperCase();
    if (!sigByType.has(t)) sigByType.set(t, new Set());
    sigByType.get(t).add(String(a.value).trim().toLowerCase().replace(/\.+$/, ''));
  }
  const answerTypes = new Set(answers.map((a) => a.type));
  if (answerTypes.size === 1) {
    const t = [...answerTypes][0];
    if ((t === 'A' || t === 'AAAA') && sigByType.has(t)) {
      return answers.every((a) => sigByType.get(t).has(a.value));
    }
  }
  return norm(answers) === sigNorm;
}

/**
 * Filter brute-force enumeration results through the measured wildcard
 * signature: drop synthetic matches, keep NXDOMAIN negatives and real hosts.
 *
 * @param {{host: string, status: string, answers?: {type: string, value: string}[]}[]} bruteResults
 * @param {ReturnType<typeof characteriseWildcard>} wildcard characterisation from random probes
 * @returns {{real: typeof bruteResults, filtered: {host: string, reason: string}[], wildcardDetected: boolean}}
 */
export function filterWildcardFalsePositives(bruteResults, wildcard) {
  const filtered = [];
  const real = [];
  if (!wildcard || !wildcard.isWildcard) {
    return {
      real: bruteResults.filter((r) => r.status === 'NOERROR'),
      filtered: bruteResults
        .filter((r) => r.status !== 'NOERROR')
        .map((r) => ({ host: r.host, reason: `non-answer status ${r.status}` })),
      wildcardDetected: false,
    };
  }
  for (const r of bruteResults) {
    if (r.status !== 'NOERROR' || !r.answers || r.answers.length === 0) {
      filtered.push({ host: r.host, reason: `no usable answer (${r.status})` });
      continue;
    }
    if (matchesWildcardSignature(r, wildcard.signature)) {
      filtered.push({ host: r.host, reason: 'matches measured wildcard signature' });
      continue;
    }
    real.push(r);
  }
  return { real, filtered, wildcardDetected: true };
}

/**
 * Estimate how many random probes are needed to characterise a zone at a
 * given confidence: more synthesis-rate variance needs more probes.
 * @param {number} targetConfidence 0..1
 * @returns {number} recommended probe count
 */
export function recommendedProbeCount(targetConfidence = 0.95) {
  if (targetConfidence <= 0 || targetConfidence >= 1) return 10;
  const z = targetConfidence >= 0.99 ? 2.576 : targetConfidence >= 0.95 ? 1.96 : 1.645;
  // Worst-case variance (p = 0.5), ±10% margin.
  return Math.max(5, Math.ceil((z * z * 0.25) / 0.01));
}

export const WILDCARD_FINGERPRINT_INTEL = {
  characteriseWildcard,
  matchesWildcardSignature,
  filterWildcardFalsePositives,
  recommendedProbeCount,
};
export default WILDCARD_FINGERPRINT_INTEL;
