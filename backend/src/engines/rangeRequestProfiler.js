/**
 * rangeRequestProfiler.js — HTTP byte-range request behavior profiling for autonomous bug bounty.
 *
 * Implements idea-bank item 00419: profile byte-range request handling
 * (single range, suffix range, multipart ranges, unsatisfiable ranges)
 * to identify servers and caching layers.
 *
 * All functions are pure and side-effect free: they classify range
 * response observations the caller recorded with safe probes during an
 * authorized engagement. No network activity happens here.
 */

/**
 * Server range-handling signatures.
 * @type {Array<{server:string, singleRange:number, multipart:string, unsatisfiable:number, suffix:boolean, confidence:number}>}
 */
export const RANGE_SIGNATURES = [
  { server: 'nginx', singleRange: 206, multipart: 'byteranges', unsatisfiable: 416, suffix: true, confidence: 0.8 },
  { server: 'Apache httpd', singleRange: 206, multipart: 'byteranges', unsatisfiable: 416, suffix: true, confidence: 0.75 },
  { server: 'IIS', singleRange: 206, multipart: 'byteranges', unsatisfiable: 416, suffix: true, confidence: 0.7 },
  { server: 'Cloudflare cache', singleRange: 206, multipart: 'ignored-single', unsatisfiable: 200, suffix: true, confidence: 0.75 },
  { server: 'Varnish', singleRange: 206, multipart: 'byteranges', unsatisfiable: 416, suffix: false, confidence: 0.7 },
  { server: 'S3-compatible origin', singleRange: 206, multipart: 'ignored-single', unsatisfiable: 416, suffix: true, confidence: 0.7 },
];

/**
 * Normalize one range-probe observation.
 * @param {object} obs { rangeHeader:string, status:number|null, contentRange:string|null,
 *   contentType:string|null, acceptRanges:string|null, contentLength:number|null }
 * @returns {{kind:string, status:number|null, satisfiable:boolean, multipart:boolean, cacheHint:string|null, notes:string[]}}
 */
export function normalizeRangeObservation(obs) {
  const o = obs || {};
  const header = String(o.rangeHeader || '');
  const notes = [];
  let kind = 'single';
  if (header.includes(',')) kind = 'multipart';
  else if (/^bytes=-\d+/.test(header.trim())) kind = 'suffix';
  else if (/=\d+-$/.test(header.trim())) kind = 'open-ended';
  const satisfiable = o.status === 206;
  const multipart = typeof o.contentType === 'string' && o.contentType.includes('multipart/byteranges');
  let cacheHint = null;
  if (o.status === 200 && kind !== 'single') cacheHint = 'cache-served-full';
  if (o.status === 200 && (kind === 'single' || kind === 'open-ended')) cacheHint = 'range-ignored';
  if (o.acceptRanges && !/bytes/i.test(o.acceptRanges)) notes.push(`Accept-Ranges advertises non-bytes unit: ${o.acceptRanges}`);
  if (o.status === 416 && o.contentRange && o.contentRange.startsWith('bytes */')) {
    notes.push(`unsatisfiable range answered with complete length hint: ${o.contentRange}`);
  }
  return { kind, status: o.status, satisfiable, multipart, cacheHint, notes };
}

/**
 * Profile the range-handling stack across observations.
 * @param {Array<object>} observations Range observations as in normalizeRangeObservation.
 * @returns {{normalized:Array, behavior:{singleRange:number|null, multipart:string, unsatisfiable:number|null, suffix:boolean}, candidates:Array<{server:string, confidence:number, reason:string}>, cacheLayer:boolean}}
 */
export function profileRangeStack(observations) {
  const list = Array.isArray(observations) ? observations : [];
  const normalized = list.map(normalizeRangeObservation);
  const byKind = (k) => normalized.filter((n) => n.kind === k);
  const firstStatus = (arr) => (arr.length > 0 ? arr[0].status : null);
  const behavior = {
    singleRange: firstStatus(byKind('single')),
    multipart: byKind('multipart').some((n) => n.multipart) ? 'byteranges' : (byKind('multipart').length > 0 ? 'ignored-single' : 'untested'),
    unsatisfiable: null,
    suffix: byKind('suffix').some((n) => n.satisfiable),
  };
  // Simpler unsatisfiable detection: any 416 observed
  if (behavior.unsatisfiable == null && normalized.some((n) => n.status === 416)) behavior.unsatisfiable = 416;
  const cacheLayer = normalized.some((n) => n.cacheHint === 'cache-served-full' || n.cacheHint === 'range-ignored');
  const candidates = [];
  for (const sig of RANGE_SIGNATURES) {
    let score = 0;
    let total = 0;
    if (behavior.singleRange != null) { total += 1; if (sig.singleRange === behavior.singleRange) score += 1; }
    if (behavior.multipart !== 'untested') { total += 1; if (sig.multipart === behavior.multipart) score += 1; }
    if (behavior.unsatisfiable != null) { total += 1; if (sig.unsatisfiable === behavior.unsatisfiable) score += 1; }
    total += 1; if (sig.suffix === behavior.suffix) score += 1;
    if (total === 0) continue;
    candidates.push({
      server: sig.server,
      confidence: sig.confidence * (score / total),
      reason: `range behavior match ${score}/${total}`,
    });
  }
  return { normalized, behavior, candidates: candidates.sort((a, b) => b.confidence - a.confidence), cacheLayer };
}
