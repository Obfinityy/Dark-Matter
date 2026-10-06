/**
 * dnsAggressiveNsecDetector.js — DNS aggressive-NSEC caching detector (idea 00522).
 *
 * Defensive fingerprinting for an authorized bug-bounty agent. Aggressive
 * use of DNSSEC NSEC/NSEC3 records (RFC 8198) lets a validating resolver
 * synthesize negative answers for names that fall inside a cached denial
 * span, without querying the authority again. A resolver with aggressive
 * NSEC caching enabled answers NXDOMAIN for a second, never-seen name
 * covered by the same NSEC range with a cache-hit signature (near-zero
 * round-trip time, no upstream query observed, AD bit set, SOA-less
 * synthesis). Probing the two-name sequence — first query returns a real
 * NSEC denial, second query for a different name inside the same denial
 * span — fingerprints validating resolvers and distinguishes BIND 9,
 * Unbound, Knot Resolver, and PowerDNS Recursor behavior.
 *
 * Pure analyzer: the caller supplies observed probe pairs from a
 * controlled test (packet timestamps, upstream query presence, response
 * provenance). This module never sends DNS queries itself.
 */

/** Known aggressive-NSEC implementations and their observable quirks. */
export const AGGRESSIVE_NSEC_IMPLEMENTATIONS = {
  'bind': {
    software: 'BIND 9 (aggressive negative caching)',
    quirks: ['synthesizes from cached NSEC', 'rtt of synthesized answer ~0ms', 'AD flag preserved'],
  },
  'unbound': {
    software: 'Unbound (aggressive-nsec: yes)',
    quirks: ['synthesizes NXDOMAIN and NODATA', 'second query shows cache hit with 0 upstream queries'],
  },
  'knot': {
    software: 'Knot Resolver',
    quirks: ['aggressive caching on by default', 'synthesized answers carry original TTL of NSEC'],
  },
  'powerdns': {
    software: 'PowerDNS Recursor',
    quirks: ['aggressive NSEC via nsec3 cache', 'synthesis visible in cache dump'],
  },
};

/**
 * Check whether a name falls inside an NSEC denial span.
 * @param {{owner: string, next: string, name: string}} span
 * @returns {boolean}
 */
export function nameInsideNsecSpan(span = {}) {
  const norm = (s) => String(s || '').toLowerCase().replace(/\.$/, '');
  const owner = norm(span.owner);
  const next = norm(span.next);
  const name = norm(span.name);
  if (!owner || !next || !name) return false;
  // Canonical DNS name ordering approximation via localeCompare.
  return name.localeCompare(owner) > 0 && name.localeCompare(next) < 0;
}

/**
 * Evaluate one two-query aggressive-NSEC probe.
 * @param {{first: {name: string, rcode: string, hasNsec: boolean, upstreamQueries: number, rttMs: number}, second: {name: string, rcode: string, hasNsec: boolean, upstreamQueries: number, rttMs: number}, nsecSpan: {owner: string, next: string}}} probe
 * @returns {{supportsAggressiveNsec: boolean|null, confidence: 'high'|'medium'|'low', evidence: string, signals: string[]}}
 */
export function evaluateAggressiveNsecProbe(probe = {}) {
  const first = probe.first || {};
  const second = probe.second || {};
  const span = probe.nsecSpan || {};
  const signals = [];

  const secondCovered = nameInsideNsecSpan({ ...span, name: second.name });
  signals.push(secondCovered
    ? `second name "${second.name}" lies inside the NSEC span returned for the first query`
    : `second name "${second.name}" is NOT covered by the first query's NSEC span — probe inconclusive for this span`);

  if (!first.hasNsec) {
    return {
      supportsAggressiveNsec: null,
      confidence: 'low',
      evidence: `First query for "${first.name}" returned no NSEC denial record — negative caching has nothing to be aggressive about.`,
      signals,
    };
  }

  // The tell: second query answered with zero upstream traffic and ~0 rtt
  // despite never being queried before → synthesized from cached NSEC.
  const synthesized = secondCovered
    && Number(second.upstreamQueries) === 0
    && Number(second.rttMs) < 5
    && /NXDOMAIN/i.test(String(second.rcode || ''));
  const refetched = Number(second.upstreamQueries) > 0;
  const cachedDenial = Number(second.upstreamQueries) === 0 && Number(second.rttMs) >= 5;

  if (synthesized) {
    signals.push(`second query answered with 0 upstream queries in ${second.rttMs}ms — synthesized negative answer from cached NSEC`);
  } else if (refetched) {
    signals.push(`second query triggered ${second.upstreamQueries} upstream quer(ies) — resolver did NOT synthesize from cached NSEC`);
  } else if (cachedDenial) {
    signals.push(`second query served from cache but with non-trivial rtt (${second.rttMs}ms) — ordinary negative caching, not aggressive synthesis`);
  }

  const supportsAggressiveNsec = secondCovered ? synthesized : null;
  const confidence = supportsAggressiveNsec === null ? 'low' : synthesized ? 'high' : refetched ? 'medium' : 'medium';

  return {
    type: 'DNS Aggressive-NSEC Detection',
    supportsAggressiveNsec,
    confidence,
    evidence: signals.join('. '),
    signals,
  };
}

/**
 * Aggregate multiple probes into a resolver fingerprint verdict.
 * @param {{probes: Array, resolverHint?: string}} input
 * @returns {{type: string, aggressiveNsec: boolean|null, confidence: 'high'|'medium'|'low', evidence: string, likelySoftware: string|null}}
 */
export function fingerprintAggressiveNsec(input = {}) {
  const probes = Array.isArray(input.probes) ? input.probes : [];
  const results = probes.map(evaluateAggressiveNsecProbe);
  const positive = results.filter((r) => r.supportsAggressiveNsec === true).length;
  const negative = results.filter((r) => r.supportsAggressiveNsec === false).length;

  let aggressiveNsec = null;
  let confidence = 'low';
  if (positive > 0 && negative === 0) { aggressiveNsec = true; confidence = 'high'; }
  else if (negative > 0 && positive === 0) { aggressiveNsec = false; confidence = 'high'; }
  else if (positive > 0 || negative > 0) { aggressiveNsec = positive >= negative; confidence = 'medium'; }

  let likelySoftware = null;
  if (aggressiveNsec === true) {
    likelySoftware = 'Validating resolver with aggressive NSEC (RFC 8198) enabled — BIND 9, Unbound (aggressive-nsec: yes), Knot Resolver, or PowerDNS Recursor';
  } else if (aggressiveNsec === false) {
    likelySoftware = 'Validating resolver without aggressive NSEC, or a non-validating forwarder';
  }

  return {
    type: 'DNS Aggressive-NSEC Detection',
    aggressiveNsec,
    confidence,
    likelySoftware,
    evidence: results.length === 0
      ? 'No probes supplied.'
      : `${positive}/${results.length} probes synthesized negative answers from cached NSEC; ${negative}/${results.length} re-queried upstream. ` + results.map((r) => r.evidence).join(' | '),
  };
}
