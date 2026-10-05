/**
 * timingServiceInferencer.js — Timing-based service inference for autonomous bug bounty.
 *
 * Implements idea-bank item 00409: analyze response-time distributions to
 * infer backend languages, caching behavior, and database round-trips.
 *
 * During an authorized engagement the caller measures response times for
 * benign requests (varying payload sizes and query complexity) and records
 * the samples. This module is pure statistical analysis of those recorded
 * samples: it computes distribution statistics, detects bimodal
 * cache-vs-origin behavior, and tests whether latency grows with payload
 * size (a sign of serialization work or database round-trips). No requests
 * are sent by this module.
 */

/**
 * Compute descriptive statistics for a sample of timings in milliseconds.
 * @param {Array<number>} samples Response times in ms.
 * @returns {{count:number, mean:number, median:number, p95:number, min:number, max:number, stddev:number, iqr:number}|null}
 */
export function timingStats(samples) {
  const values = (Array.isArray(samples) ? samples : []).filter((v) => typeof v === 'number' && v >= 0);
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  const median = n % 2 === 1 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  const p95 = sorted[Math.min(n - 1, Math.floor(n * 0.95))];
  const variance = sorted.reduce((s, v) => s + (v - mean) * (v - mean), 0) / n;
  const q1 = sorted[Math.floor(n * 0.25)];
  const q3 = sorted[Math.floor(n * 0.75)];
  const round = (v) => Math.round(v * 100) / 100;
  return {
    count: n, mean: round(mean), median: round(median), p95: round(p95),
    min: round(sorted[0]), max: round(sorted[n - 1]),
    stddev: round(Math.sqrt(variance)), iqr: round(q3 - q1),
  };
}

/**
 * Detect bimodal latency (fast cached responses vs slow origin responses)
 * using a simple two-cluster split around the median.
 * @param {Array<number>} samples Response times in ms.
 * @returns {{bimodal:boolean, fastCluster:{count:number, mean:number}|null, slowCluster:{count:number, mean:number}|null, separationMs:number}}
 */
export function detectBimodalLatency(samples) {
  const stats = timingStats(samples);
  if (!stats || stats.count < 8) return { bimodal: false, fastCluster: null, slowCluster: null, separationMs: 0 };
  const values = samples.filter((v) => typeof v === 'number' && v >= 0).sort((a, b) => a - b);
  // Split at the largest gap between consecutive sorted samples: a true
  // cache-vs-origin split shows a clear empty band between the two modes.
  let splitAt = -1;
  let largestGap = 0;
  for (let i = 1; i < values.length; i++) {
    const gap = values[i] - values[i - 1];
    if (gap > largestGap) {
      largestGap = gap;
      splitAt = i;
    }
  }
  const fast = values.slice(0, splitAt);
  const slow = values.slice(splitAt);
  if (splitAt < 0 || fast.length < 3 || slow.length < 3) {
    return { bimodal: false, fastCluster: null, slowCluster: null, separationMs: 0 };
  }
  const fastMean = fast.reduce((s, v) => s + v, 0) / fast.length;
  const slowMean = slow.reduce((s, v) => s + v, 0) / slow.length;
  const separation = slowMean - fastMean;
  const bimodal = separation > Math.max(50, stats.stddev * 2);
  const round = (v) => Math.round(v * 100) / 100;
  return {
    bimodal,
    fastCluster: { count: fast.length, mean: round(fastMean) },
    slowCluster: { count: slow.length, mean: round(slowMean) },
    separationMs: round(separation),
  };
}

/**
 * Test whether response time grows with payload/request size, which suggests
 * serialization cost or database round-trips proportional to the input.
 * @param {Array<{size:number, timeMs:number}>} observations Paired size/time samples.
 * @returns {{correlated:boolean, pearsonR:number, slopeMsPerKb:number, interpretation:string}}
 */
export function detectSizeCorrelation(observations) {
  const pairs = (Array.isArray(observations) ? observations : [])
    .filter((o) => o && typeof o.size === 'number' && typeof o.timeMs === 'number');
  if (pairs.length < 5) {
    return { correlated: false, pearsonR: 0, slopeMsPerKb: 0, interpretation: 'insufficient samples for correlation analysis' };
  }
  const n = pairs.length;
  const meanX = pairs.reduce((s, p) => s + p.size, 0) / n;
  const meanY = pairs.reduce((s, p) => s + p.timeMs, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (const p of pairs) {
    num += (p.size - meanX) * (p.timeMs - meanY);
    denX += (p.size - meanX) * (p.size - meanX);
    denY += (p.timeMs - meanY) * (p.timeMs - meanY);
  }
  const r = denX > 0 && denY > 0 ? num / Math.sqrt(denX * denY) : 0;
  const slope = denX > 0 ? (num / denX) * 1024 : 0;
  const correlated = r >= 0.7;
  return {
    correlated,
    pearsonR: Math.round(r * 1000) / 1000,
    slopeMsPerKb: Math.round(slope * 100) / 100,
    interpretation: correlated
      ? 'latency grows with request size — likely serialization or per-row database work'
      : 'no strong size/latency correlation — latency dominated by fixed costs',
  };
}

/**
 * Infer the backend profile from timing statistics of one endpoint.
 * @param {{count:number, mean:number, median:number, p95:number, stddev:number}} stats Output of timingStats.
 * @returns {{profile:string, backendHint:string, notes:string[]}}
 */
export function inferBackendProfile(stats) {
  const notes = [];
  if (!stats) return { profile: 'unknown', backendHint: 'unknown', notes: ['no timing samples available'] };
  let profile;
  let backendHint;
  if (stats.median < 8 && stats.p95 < 25) {
    profile = 'static-or-cached';
    backendHint = 'static file, CDN edge, or in-memory cache';
  } else if (stats.median < 60 && stats.stddev < stats.median * 0.5) {
    profile = 'fast-dynamic';
    backendHint = 'compiled backend or warm cache (e.g. Go, Rust, tuned JVM)';
  } else if (stats.median < 250) {
    profile = 'typical-dynamic';
    backendHint = 'interpreted backend (e.g. Python, Ruby, Node.js, PHP)';
  } else {
    profile = 'slow-dynamic';
    backendHint = 'heavy per-request work — possible database round-trips or cold starts';
  }
  notes.push(`median ${stats.median}ms, p95 ${stats.p95}ms over ${stats.count} samples`);
  if (stats.stddev > stats.median) notes.push('high variance relative to median — inconsistent backend work per request');
  return { profile, backendHint, notes };
}

/**
 * Run the full timing inference pipeline for a set of endpoints.
 * @param {Array<{endpoint:string, samples:Array<number>, sizeObservations?:Array<{size:number,timeMs:number}>}>} endpoints Timed endpoints.
 * @returns {Array<{endpoint:string, stats:object|null, bimodal:object, sizeCorrelation:object|null, profile:object}>}
 */
export function inferServiceProfile(endpoints) {
  const list = Array.isArray(endpoints) ? endpoints : [];
  return list.map((ep) => {
    const rec = ep && typeof ep === 'object' ? ep : {};
    const stats = timingStats(rec.samples);
    return {
      endpoint: typeof rec.endpoint === 'string' ? rec.endpoint : '/',
      stats,
      bimodal: detectBimodalLatency(rec.samples),
      sizeCorrelation: Array.isArray(rec.sizeObservations) ? detectSizeCorrelation(rec.sizeObservations) : null,
      profile: inferBackendProfile(stats),
    };
  });
}
