/**
 * duplicateHeaderAnalysis.js — duplicate HTTP header handling analysis for autonomous bug bounty.
 *
 * Implements idea-bank item 00415: analyze how a server merges, prioritizes,
 * or rejects duplicate headers to fingerprint the implementation.
 *
 * All functions are pure and side-effect free: they operate on observation
 * records the caller collected with safe duplicate-header probes during an
 * authorized engagement. No network activity happens here.
 */

/**
 * Known duplicate-header strategies.
 * @type {Array<{strategy:string, description:string}>}
 */
export const HEADER_STRATEGIES = [
  { strategy: 'first-wins', description: 'earliest occurrence is authoritative' },
  { strategy: 'last-wins', description: 'latest occurrence is authoritative' },
  { strategy: 'comma-join', description: 'values joined with a comma per RFC 9110' },
  { strategy: 'array', description: 'all values preserved as an array (Node.js style)' },
  { strategy: 'reject-400', description: 'duplicate rejected with 400 Bad Request' },
  { strategy: 'reject-431', description: 'duplicate rejected as oversized headers' },
];

/**
 * Infer the duplicate-header strategy from one observation.
 * @param {object} obs { header:string, sentValues:string[], receivedValue:string|null,
 *   receivedCount:number|null, status:number, rejected:boolean }
 * @returns {{strategy:string, confidence:number, evidence:string}}
 */
export function inferDuplicateStrategy(obs) {
  const o = obs || {};
  if (o.rejected) {
    const s = o.status === 431 ? 'reject-431' : 'reject-400';
    return { strategy: s, confidence: 0.95, evidence: `duplicate ${o.header} rejected with status ${o.status}` };
  }
  const sent = o.sentValues || [];
  const recv = o.receivedValue;
  if (sent.length < 2) {
    return { strategy: 'unknown', confidence: 0, evidence: 'fewer than two values sent — cannot infer strategy' };
  }
  if (o.receivedCount != null && o.receivedCount === sent.length) {
    return { strategy: 'array', confidence: 0.85, evidence: `all ${sent.length} values preserved individually` };
  }
  if (typeof recv === 'string' && recv.includes(',')) {
    return { strategy: 'comma-join', confidence: 0.8, evidence: `values joined as "${recv}"` };
  }
  if (recv === sent[0]) {
    return { strategy: 'first-wins', confidence: 0.85, evidence: `first value "${sent[0]}" authoritative` };
  }
  if (recv === sent[sent.length - 1]) {
    return { strategy: 'last-wins', confidence: 0.85, evidence: `last value "${sent[sent.length - 1]}" authoritative` };
  }
  return { strategy: 'unknown', confidence: 0.3, evidence: `received "${recv}" matches neither first nor last sent value` };
}

/**
 * Framework mapping for inferred strategies.
 * @type {Record<string, string[]>}
 */
export const STRATEGY_FRAMEWORKS = {
  'comma-join': ['Apache httpd', 'nginx (proxy merge)'],
  array: ['Node.js', 'Express'],
  'first-wins': ['HAProxy', 'Varnish'],
  'last-wins': ['IIS', 'Kestrel'],
  'reject-400': ['Envoy', 'ATS (strict mode)'],
  'reject-431': ['Cloudflare edge', 'Akamai edge'],
};

/**
 * Aggregate duplicate-header observations across headers into a stack fingerprint.
 * @param {Array<object>} observations Observation objects as in inferDuplicateStrategy.
 * @returns {{perHeader:Array<{header:string, strategy:string, confidence:number}>, dominantStrategy:string|null, candidates:string[], consistent:boolean}}
 */
export function fingerprintDuplicateHandling(observations) {
  const list = Array.isArray(observations) ? observations : [];
  const perHeader = list.map((o) => {
    const r = inferDuplicateStrategy(o);
    return { header: o.header, strategy: r.strategy, confidence: r.confidence };
  });
  const counts = new Map();
  for (const p of perHeader) {
    if (p.strategy === 'unknown') continue;
    counts.set(p.strategy, (counts.get(p.strategy) || 0) + 1);
  }
  let dominantStrategy = null;
  let best = 0;
  for (const [s, c] of counts) {
    if (c > best) { best = c; dominantStrategy = s; }
  }
  const known = perHeader.filter((p) => p.strategy !== 'unknown').length;
  return {
    perHeader,
    dominantStrategy,
    candidates: dominantStrategy ? (STRATEGY_FRAMEWORKS[dominantStrategy] || []) : [],
    consistent: known > 0 && best === known,
  };
}
