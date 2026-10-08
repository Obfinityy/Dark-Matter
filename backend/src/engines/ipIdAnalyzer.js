/**
 * ipIdAnalyzer.js — IP ID sequence analysis.
 *
 * Classifies the IP identification field generation pattern from captured
 * packets (sequential global counter, per-flow sequential, zero, or random)
 * and, for interleaved global counters, estimates how many hosts sit
 * behind the observed NAT / load balancer using GCD analysis of the ID gaps.
 *
 * This module is a pure offline analyzer: it consumes captured IP ID
 * sequences and returns a structured verdict. It performs no network I/O.
 */

const MIN_IDS = 4;

/** Greatest common divisor of two integers. */
function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
}

/**
 * Analyze an IP ID sequence from captured packets.
 * @param {{host?: string, ipIds: number[], df?: boolean}} input
 */
export function analyzeIpIdSequence({ host = null, ipIds = [], df = null } = {}) {
  if (!Array.isArray(ipIds) || ipIds.length < MIN_IDS) {
    return {
      host,
      error: `Need at least ${MIN_IDS} IP IDs; got ${ipIds.length}.`,
      confidence: 'none',
    };
  }
  const ids = ipIds.map(x => Number(x)).filter(Number.isFinite);
  if (ids.length < MIN_IDS) {
    return { host, error: 'Too few numeric IP IDs after filtering.', confidence: 'none' };
  }

  // Unwrap 16-bit rollover for delta computation.
  const deltas = [];
  for (let i = 1; i < ids.length; i++) {
    let d = ids[i] - ids[i - 1];
    if (d < -32768) d += 65536;
    if (d > 32768) d -= 65536;
    deltas.push(d);
  }

  const allZero = ids.every(x => x === 0);
  const uniqueDeltas = new Set(deltas.map(d => Math.abs(d)));
  const allOnes = uniqueDeltas.size === 1 && uniqueDeltas.has(1);
  const smallDeltas = deltas.every(d => d >= 1 && d <= 64);

  // Randomness check: chi of deltas vs uniform — use spread instead.
  const meanD = deltas.reduce((a, b) => a + Math.abs(b), 0) / deltas.length;
  const spread = Math.max(...deltas.map(Math.abs)) - Math.min(...deltas.map(Math.abs));
  const looksRandom = !allZero && !allOnes && spread > meanD * 3;

  let pattern;
  let estimatedHostCount = 1;
  const evidence = [];

  if (allZero) {
    pattern = 'zero';
    evidence.push(
      'Every IP ID is 0 — the stack sets ID=0 when DF is set (Windows) or uses a per-socket random/zero scheme (modern Linux). Host counting is not possible.'
    );
  } else if (allOnes) {
    pattern = 'sequential-single';
    evidence.push(
      'IP IDs increment by exactly 1 per packet — a single global counter, i.e. one host (or several sharing one counter, e.g. Windows).'
    );
  } else if (looksRandom) {
    pattern = 'random';
    evidence.push(
      `Deltas vary widely (mean |Δ|=${meanD.toFixed(1)}, spread=${spread}) — per-socket randomized IDs (Linux ≥ 4.x); host counting is not possible.`
    );
  } else if (smallDeltas) {
    // Classic interleaved-counter analysis: each host increments the shared
    // counter by its own packet count; the GCD of the gaps estimates hosts.
    const g = deltas.map(Math.abs).reduce((a, b) => gcd(a, b));
    if (g > 1) {
      pattern = 'interleaved';
      estimatedHostCount = g;
      evidence.push(
        `Deltas share GCD=${g} — ~${g} hosts interleave packets through one global counter (NAT / load balancer / cluster).`
      );
    } else {
      pattern = 'sequential-single';
      evidence.push(
        'Deltas are small and sequential with GCD=1 — one host with a busy global counter.'
      );
    }
  } else {
    pattern = 'mixed';
    evidence.push(
      'Deltas do not fit sequential, zero, or random cleanly — mixed traffic or multiple stacks behind the address.'
    );
  }

  const confidence =
    pattern === 'zero' || pattern === 'random'
      ? 'high'
      : pattern === 'sequential-single'
        ? 'high'
        : pattern === 'interleaved' && ids.length >= 10
          ? 'medium'
          : 'low';

  return {
    host,
    pattern,
    estimatedHostCount,
    confidence,
    sampleCount: ids.length,
    deltas: deltas.slice(0, 20),
    dfFlag: df,
    evidence,
    recommendation:
      pattern === 'interleaved'
        ? `Treat the address as ${estimatedHostCount}+ hosts: fingerprint each backend separately; results from one sample may not apply to all.`
        : pattern === 'random' || pattern === 'zero'
          ? 'No host-count signal available — rely on other fingerprinting (TCP stack, clock skew, banners).'
          : 'Single-host counter observed — findings can be attributed to one machine.',
  };
}

export const IP_ID_ANALYZER = { analyzeIpIdSequence, MIN_IDS };
export default IP_ID_ANALYZER;
