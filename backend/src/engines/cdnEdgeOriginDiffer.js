/**
 * cdnEdgeOriginDiffer.js — CDN edge-vs-origin differentiation.
 *
 * Idea 00390: differentiate CDN edge from origin by header, timing, and
 * cache-behavior tests.
 *
 * Takes captured HTTP response metadata (from the operator's own test runs:
 * headers, timing, cache headers, and cache-busting probes) and scores each
 * observation for "edge" vs "origin" traits. Pure and offline — no requests
 * are made here.
 */

/**
 * @typedef {Object} HttpObservation
 * @property {string} label - e.g. 'baseline', 'cache-busted', 'range-request'.
 * @property {number} status
 * @property {Record<string,string|string[]>} headers
 * @property {number} [rttMs]
 * @property {string} [bodyHash] - Hash of the response body for comparison.
 * @property {number} [contentLength]
 */

function getHeader(headers = {}, name) {
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lower) return [].concat(v).join(', ');
  }
  return '';
}

const EDGE_HEADER_RES = [
  [/^cf-cache-status$/i, 'Cloudflare cache status'],
  [/^x-cache$/i, 'X-Cache cache status'],
  [/^x-cache-hits$/i, 'cache hit counter'],
  [/^x-served-by$/i, 'serving POP/node id'],
  [/^x-amz-cf-pop$/i, 'CloudFront edge POP'],
  [/^x-akamai-.*$/i, 'Akamai edge marker'],
  [/^age$/i, 'Age (time in cache)'],
  [/^via$/i, 'Via proxy chain'],
  [/^x-fastly-request-id$/i, 'Fastly edge request id'],
  [/^x-sucuri-cache$/i, 'Sucuri cache status'],
  [/^cf-ray$/i, 'Cloudflare edge ray id'],
];

const ORIGIN_HEADER_RES = [
  [/^x-powered-by$/i, 'application framework header'],
  [/^x-aspnet-version$/i, 'ASP.NET version leak'],
  [/^x-generator$/i, 'CMS generator header'],
  [/^set-cookie$/i, 'dynamic session cookie'],
];

/**
 * Score one observation for edge vs origin traits.
 * @param {HttpObservation} obs
 * @returns {{edgeScore: number, originScore: number, signals: {edge: string[], origin: string[]}}}
 */
export function scoreObservation(obs = {}) {
  const headers = obs.headers || {};
  const signals = { edge: [], origin: [] };
  let edgeScore = 0;
  let originScore = 0;

  for (const [re, why] of EDGE_HEADER_RES) {
    const name = Object.keys(headers).find((n) => re.test(n));
    if (name) {
      const val = getHeader(headers, name);
      edgeScore += 2;
      signals.edge.push(`${name}: ${String(val).slice(0, 60)} (${why})`);
      if (/^x-cache$/i.test(name) && /hit/i.test(val)) {
        edgeScore += 2;
        signals.edge.push('explicit cache HIT — served from edge cache');
      }
      if (/^age$/i.test(name) && parseInt(val, 10) > 0) {
        edgeScore += 1;
        signals.edge.push(`Age ${val}s — object resident in cache`);
      }
    }
  }
  for (const [re, why] of ORIGIN_HEADER_RES) {
    const name = Object.keys(headers).find((n) => re.test(n));
    if (name && name.toLowerCase() !== 'set-cookie') {
      originScore += 1;
      signals.origin.push(`${name} (${why})`);
    }
  }
  // Dynamic Set-Cookie on a cacheable GET leans origin.
  if (getHeader(headers, 'set-cookie') && (obs.status === 200)) {
    originScore += 1;
    signals.origin.push('Set-Cookie on 200 response — dynamic origin behavior');
  }
  // Cache-Control: no-store / private leans origin; s-maxage leans edge config.
  const cc = getHeader(headers, 'cache-control').toLowerCase();
  if (/no-store|private/.test(cc)) {
    originScore += 1;
    signals.origin.push(`Cache-Control: ${cc.slice(0, 60)} (not edge-cacheable)`);
  }
  if (/s-maxage|max-age=\d+/.test(cc) && /s-maxage/.test(cc)) {
    edgeScore += 1;
    signals.edge.push(`Cache-Control s-maxage present — edge caching configured`);
  }
  return { edgeScore, originScore, signals };
}

/**
 * Differentiate edge from origin across a captured probe set.
 * Expects at least a 'baseline' and a 'cache-busted' observation; the
 * classifier compares body hashes and timings between them.
 * @param {HttpObservation[]} observations
 */
export function differentiateEdgeOrigin(observations = []) {
  const scored = observations.map((obs) => ({ label: obs.label, ...scoreObservation(obs), obs }));
  const baseline = scored.find((s) => s.label === 'baseline');
  const busted = scored.find((s) => s.label === 'cache-busted');

  let cacheBehavior = 'unknown';
  const behaviorSignals = [];
  if (baseline && busted) {
    const sameBody = baseline.obs.bodyHash && baseline.obs.bodyHash === busted.obs.bodyHash;
    const bustedSlower = (busted.obs.rttMs ?? 0) > (baseline.obs.rttMs ?? 0) * 1.5;
    const ageReset = parseInt(getHeader(busted.obs.headers, 'age') || '0', 10) <
      parseInt(getHeader(baseline.obs.headers, 'age') || '0', 10);
    if (sameBody && (bustedSlower || ageReset)) {
      cacheBehavior = 'edge-cache-confirmed';
      behaviorSignals.push('cache-busted request returned same body but slower / with reset Age — edge cache in front');
    } else if (!sameBody) {
      cacheBehavior = 'dynamic-or-uncached';
      behaviorSignals.push('cache-busted request returned a different body — dynamic origin or no edge caching');
    } else {
      cacheBehavior = 'no-cache-delta';
      behaviorSignals.push('no measurable cache delta between baseline and cache-busted request');
    }
  }

  const totalEdge = scored.reduce((n, s) => n + s.edgeScore, 0);
  const totalOrigin = scored.reduce((n, s) => n + s.originScore, 0);
  const verdict = totalEdge - totalOrigin >= 4 ? 'edge-in-front'
    : totalOrigin - totalEdge >= 3 ? 'likely-direct-origin'
    : 'inconclusive';
  const confidence = verdict === 'inconclusive' ? 'low'
    : cacheBehavior !== 'unknown' ? 'high' : 'medium';

  return {
    verdict,
    confidence,
    cacheBehavior,
    behaviorSignals,
    totalEdgeScore: totalEdge,
    totalOriginScore: totalOrigin,
    observations: scored.map((s) => ({
      label: s.label,
      edgeScore: s.edgeScore,
      originScore: s.originScore,
      signals: s.signals,
    })),
  };
}

/**
 * Build a report finding.
 * @param {ReturnType<typeof differentiateEdgeOrigin>} result
 * @param {string} targetLabel
 */
export function edgeOriginFinding(result, targetLabel = 'target') {
  const titles = {
    'edge-in-front': `CDN edge confirmed in front of ${targetLabel}`,
    'likely-direct-origin': `${targetLabel} appears to be served directly from origin`,
    'inconclusive': `Edge-vs-origin differentiation inconclusive for ${targetLabel}`,
  };
  return {
    title: titles[result.verdict],
    severity: result.verdict === 'edge-in-front' ? 'Info' : 'Low',
    confidence: result.confidence,
    verdict: result.verdict,
    cacheBehavior: result.cacheBehavior,
    behaviorSignals: result.behaviorSignals,
    evidence: `Edge score ${result.totalEdgeScore} vs origin score ${result.totalOriginScore} ` +
      `across ${result.observations.length} observation(s); cache behavior: ${result.cacheBehavior}.`,
  };
}

export const CDN_EDGE_ORIGIN_DIFFER = { scoreObservation, differentiateEdgeOrigin, edgeOriginFinding };
export default CDN_EDGE_ORIGIN_DIFFER;
