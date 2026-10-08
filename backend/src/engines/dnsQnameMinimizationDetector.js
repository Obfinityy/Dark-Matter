/**
 * dnsQnameMinimizationDetector.js — DNS QNAME-minimization support detector (idea 00521).
 *
 * Defensive fingerprinting for an authorized bug-bounty agent. QNAME
 * minimization (RFC 9156) changes how a recursive resolver walks the DNS
 * tree: instead of sending the full queried name to every authoritative
 * server, it only reveals the minimal label set needed at each delegation
 * point (TLD to root hints, one label at a time down the chain). Observing
 * which QNAME a resolver actually sends to each authority level therefore
 * reveals whether it minimizes — and the exact minimization behavior (strict,
 * relaxed, off) plus the relaxation edge cases identify resolver software
 * families (BIND, Unbound, PowerDNS Recursor, Knot Resolver each behave
 * slightly differently).
 *
 * Pure analyzer: the caller supplies observed query-name records captured
 * during controlled recursion (e.g. from a locally-hosted delegation test
 * zone, resolver debug logs, or dnscap/pcap field summaries). This module
 * never sends DNS queries itself.
 */

/** Resolver software families keyed by QNAME-minimization behavior profile. */
export const QMIN_BEHAVIOR_PROFILES = {
  'bind-strict': {
    software: 'BIND 9 (qname-minimization: strict)',
    quirks: [
      'sends single-label names below delegation',
      'never relaxes on NXDOMAIN unless configured',
    ],
  },
  'bind-relaxed': {
    software: 'BIND 9 (qname-minimization: relaxed)',
    quirks: [
      'minimizes but falls back to full QNAME after error responses',
      'relaxes below delegation on repeated failure',
    ],
  },
  unbound: {
    software: 'Unbound (qname-minimization: yes)',
    quirks: ['iterative single-label queries', 'relaxes to full name on empty non-terminals'],
  },
  powerdns: {
    software: 'PowerDNS Recursor (qname-minimization: on)',
    quirks: ['uses 10-iteration cap per label', 'relaxes on servfail'],
  },
  knot: {
    software: 'Knot Resolver (qname-minimization: on)',
    quirks: ['single-label queries', 'DNSSEC-driven relaxation edge cases'],
  },
  none: {
    software: 'Unknown / minimization disabled',
    quirks: ['full QNAME sent to every authority'],
  },
};

/**
 * Score one observed delegation exchange.
 *
 * Per RFC 9156 a minimizing resolver reveals one more label at each
 * delegation depth: to the root it sends just the TLD, to the TLD server
 * the next label down, and so on until the full name at the leaf authority.
 * @param {{authorityLevel: 'root'|'tld'|'second-level'|'third-level'|'fourth-level'|'leaf', fullName: string, observedQname: string}} exchange
 * @returns {{minimized: boolean, expected: string, signal: string}}
 */
export function scoreQminExchange(exchange = {}) {
  const { authorityLevel = '', fullName = '', observedQname = '' } = exchange;
  const labels = fullName.toLowerCase().replace(/\.$/, '').split('.').filter(Boolean);
  const observed = observedQname.toLowerCase().replace(/\.$/, '');
  const fullNameNorm = labels.join('.');
  const DEPTH_ORDER = ['root', 'tld', 'second-level', 'third-level', 'fourth-level'];
  let expected;
  const depthIdx = DEPTH_ORDER.indexOf(authorityLevel);
  if (authorityLevel === 'leaf' || depthIdx === -1) {
    expected = fullNameNorm; // leaf authority always gets the full name
  } else {
    // Rightmost (depthIdx + 1) labels; clamps to the full name for short names.
    expected = labels.slice(-(depthIdx + 1)).join('.');
  }
  const minimized = observed === expected && observed !== fullNameNorm;
  const fullLeak = observed === fullNameNorm && authorityLevel !== 'leaf';
  const signal = minimized
    ? `minimized: sent "${observed}" (expected "${expected}") at ${authorityLevel}`
    : fullLeak
      ? `NOT minimized: full QNAME "${observed}" leaked to ${authorityLevel} authority`
      : `ambiguous: sent "${observed}" vs expected "${expected}" at ${authorityLevel}`;
  return { minimized, expected, signal };
}

/**
 * Detect QNAME minimization support from a full observed recursion trace.
 * @param {{exchanges: Array<{authorityLevel: 'root'|'tld'|'second-level'|'third-level'|'fourth-level'|'leaf', fullName: string, observedQname: string}>}} trace
 * @returns {{type: string, qminSupported: boolean, confidence: 'high'|'medium'|'low', profile: string|null, softwareGuess: string|null, evidence: string, minimizedLevels: string[], leakedLevels: string[]}}
 */
export function detectQnameMinimization(trace = {}) {
  const exchanges = Array.isArray(trace.exchanges) ? trace.exchanges : [];
  const scores = exchanges.map(scoreQminExchange);
  const paired = scores.map((score, i) => ({ score, exchange: exchanges[i] }));
  const minimizedLevels = paired.filter(p => p.score.minimized).map(p => p.exchange.authorityLevel);
  const leakedLevels = paired
    .filter(p => p.exchange.authorityLevel !== 'leaf' && !p.score.minimized)
    .map(p => p.exchange.authorityLevel);
  const fullLeaks = scores.filter(
    (s, i) =>
      s.observedQname &&
      exchanges[i].authorityLevel !== 'leaf' &&
      s.signal.startsWith('NOT minimized')
  ).length;
  const minimizationSteps = scores.filter(s => s.minimized).length;
  const totalAuthoritySteps = exchanges.filter(e => e.authorityLevel !== 'leaf').length;

  let qminSupported = false;
  let confidence = 'low';
  if (totalAuthoritySteps > 0 && minimizationSteps === totalAuthoritySteps) {
    qminSupported = true;
    confidence = 'high';
  } else if (minimizationSteps > 0 && fullLeaks > 0) {
    qminSupported = true;
    confidence = 'medium'; // relaxed mode: minimizes then falls back
  }

  // Relaxed vs strict: any mid-chain fallback to full QNAME indicates relaxed mode.
  const profile = !qminSupported ? null : fullLeaks > 0 ? 'relaxed' : 'strict';

  // Map the strict/relaxed profile to the most plausible resolver family note.
  const softwareGuess = qminSupported
    ? profile === 'strict'
      ? 'Unbound / Knot / strict-mode resolver (BIND 9 strict, Unbound, Knot Resolver)'
      : 'BIND 9 relaxed-mode or PowerDNS Recursor (relax-on-error behavior)'
    : 'Resolver does not minimize QNAME (full names leaked upstream — consider qmin disabled or older software)';

  const evidence =
    scores.length === 0
      ? 'No delegation exchanges observed — nothing to score.'
      : scores.map(s => s.signal).join('; ');

  return {
    type: 'DNS QNAME-Minimization Detection',
    qminSupported,
    confidence,
    profile,
    softwareGuess,
    evidence,
    minimizedLevels,
    leakedLevels,
  };
}
