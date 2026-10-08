/**
 * dnsPropagationDiffIntel.js — Propagation-checker differential analysis engine.
 *
 * Implements idea-bank item 00186 (DNSChecker propagation-differential
 * mining): compare DNS answers from many global resolvers and flag
 * inconsistencies. When resolvers disagree — different A records, missing
 * answers, stale TTLs — the disagreement itself is intelligence: it can
 * reveal hidden hosts visible only from certain regions, split-horizon DNS,
 * or ongoing DNS changes (takeover windows, migrations, misconfigurations).
 *
 * Pure functions: the caller supplies per-resolver answer sets; no network.
 */

/**
 * @typedef {object} ResolverAnswer
 * @property {string} resolver     resolver label, e.g. 'us-east', 'eu-west'
 * @property {string} hostname
 * @property {string[]} answers    raw answer strings (A records, CNAME target, ...)
 */

/**
 * Index answers per hostname across resolvers.
 * @param {ResolverAnswer[]} answers
 * @returns {Map<string, Map<string, Set<string>>>> hostname → resolver → answer set
 */
export function indexByHostname(answers) {
  const idx = new Map();
  for (const ans of answers ?? []) {
    if (!ans?.hostname) continue;
    const host = String(ans.hostname).trim().toLowerCase();
    let hostEntry = idx.get(host);
    if (!hostEntry) {
      hostEntry = new Map();
      idx.set(host, hostEntry);
    }
    hostEntry.set(
      String(ans.resolver ?? 'unknown'),
      new Set((ans.answers ?? []).map(a => String(a).trim()))
    );
  }
  return idx;
}

/**
 * Find hostnames where resolvers disagree about the answer set.
 * @param {ResolverAnswer[]} answers
 * @param {object} [opts]
 * @param {number} [opts.minDisagreement=1]  minimum number of distinct answer sets to flag
 * @returns {Array<{hostname: string, answerSets: Array<{fingerprint: string, resolvers: string[], answers: string[]}>, disagreement: number}>}
 */
export function findResolverDisagreements(answers, opts = {}) {
  const idx = indexByHostname(answers);
  const out = [];

  for (const [host, resolverMap] of idx) {
    const fingerprints = new Map();
    for (const [resolver, set] of resolverMap) {
      const fingerprint = [...set].sort().join('|');
      let group = fingerprints.get(fingerprint);
      if (!group) {
        group = { fingerprint, resolvers: [], answers: [...set].sort() };
        fingerprints.set(fingerprint, group);
      }
      group.resolvers.push(resolver);
    }
    if (fingerprints.size > (opts.minDisagreement ?? 1)) {
      out.push({
        hostname: host,
        answerSets: [...fingerprints.values()],
        disagreement: fingerprints.size,
      });
    }
  }
  return out.sort(
    (a, b) => b.disagreement - a.disagreement || a.hostname.localeCompare(b.hostname)
  );
}

/**
 * Spot hidden hosts: hostnames that resolve in SOME regions but NXDOMAIN /
 * empty elsewhere — potentially geo-gated infrastructure or staged records
 * leaking from an internal view.
 * @param {ResolverAnswer[]} answers
 * @returns {Array<{hostname: string, visibleIn: string[], hiddenIn: string[], visibilityRatio: number}>}
 */
export function spotHiddenHosts(answers) {
  const idx = indexByHostname(answers);
  const out = [];
  for (const [host, resolverMap] of idx) {
    const visibleIn = [];
    const hiddenIn = [];
    for (const [resolver, set] of resolverMap) {
      (set.size ? visibleIn : hiddenIn).push(resolver);
    }
    if (visibleIn.length && hiddenIn.length) {
      out.push({
        hostname: host,
        visibleIn: visibleIn.sort(),
        hiddenIn: hiddenIn.sort(),
        visibilityRatio: Math.round((visibleIn.length / resolverMap.size) * 100) / 100,
      });
    }
  }
  return out.sort((a, b) => a.visibilityRatio - b.visibilityRatio);
}

/**
 * Score how divergent the whole propagation picture is (0-100): high
 * divergence during a hunt means DNS is in flux — findings tied to hostnames
 * should be re-verified before reporting.
 * @param {ResolverAnswer[]} answers
 * @returns {number}
 */
export function propagationDivergenceScore(answers) {
  const idx = indexByHostname(answers);
  if (!idx.size) return 0;
  let divergent = 0;
  for (const resolverMap of idx.values()) {
    const fps = new Set([...resolverMap.values()].map(s => [...s].sort().join('|')));
    if (fps.size > 1) divergent += 1;
  }
  return Math.round((divergent / idx.size) * 100);
}
