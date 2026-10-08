/**
 * dnsViewIntel.js — Multi-resolver DNS view differential analysis for
 * autonomous bug bounty.
 *
 * Defensive asset-discovery for an authorized bug-bounty agent. Covers
 * idea-bank items 00051–00060:
 *
 *  00056 DoH resolver differential probing — query multiple DNS-over-HTTPS
 *            resolvers for the same names and diff answers to spot
 *            split-horizon DNS hiding internal hosts.
 *  00057 DoT vs Do53 answer comparison — compare DNS-over-TLS answers with
 *            classic port-53 answers to detect views that conceal
 *            infrastructure.
 *  00058 Public-resolver wildcard fingerprinting — send random-label
 *            queries through many public resolvers to map which
 *            resolvers/zones synthesize wildcard answers.
 *
 * All functions are pure: they take resolver answer sets as plain objects
 * ({ resolverName: { hostname: [answers...] } }) and return diffs, flags,
 * and fingerprints. Actual DoH/DoT/port-53 querying is left to the caller.
 */

/**
 * Normalize an answer list: coerce to strings, trim, sort, dedupe.
 *
 * @param {any} answers raw answer list
 * @returns {string[]} canonical sorted unique answers.
 */
export function normalizeAnswerSet(answers) {
  const list = Array.isArray(answers) ? answers : [];
  const norm = list
    .filter(a => a !== null && a !== undefined)
    .map(a => String(a).trim().toLowerCase())
    .filter(a => a.length > 0);
  return [...new Set(norm)].sort();
}

/**
 * Build the canonical view for one resolver across all queried names.
 *
 * @param {object} answerMap { hostname: answers[] }
 * @returns {object} { hostname: string[] }
 */
export function canonicalizeView(answerMap) {
  const view = {};
  for (const [name, answers] of Object.entries(answerMap || {})) {
    view[String(name).toLowerCase()] = normalizeAnswerSet(answers);
  }
  return view;
}

/**
 * Diff the answers for a single hostname across resolvers.
 *
 * @param {string} hostname
 * @param {object} views { resolverName: { hostname: string[] } } (canonicalized)
 * @returns {{ hostname: string, agreement: boolean, perResolver: object, onlyIn: object, missingFrom: object }}
 */
export function diffHostnameAcrossResolvers(hostname, views) {
  const key = String(hostname).toLowerCase();
  const perResolver = {};
  const signatureCount = new Map();
  for (const [resolver, view] of Object.entries(views || {})) {
    const answers = Array.isArray(view?.[key]) ? view[key] : [];
    perResolver[resolver] = answers;
    const sig = JSON.stringify(answers);
    signatureCount.set(sig, (signatureCount.get(sig) || 0) + 1);
  }
  const agreement = signatureCount.size <= 1;
  // Majority signature (the "common view").
  let majoritySig = null;
  let majorityVotes = 0;
  for (const [sig, votes] of signatureCount) {
    if (votes > majorityVotes) {
      majorityVotes = votes;
      majoritySig = sig;
    }
  }
  const majorityAnswers = majoritySig ? JSON.parse(majoritySig) : [];
  const onlyIn = {};
  const missingFrom = {};
  for (const [resolver, answers] of Object.entries(perResolver)) {
    if (JSON.stringify(answers) !== majoritySig) {
      const extra = answers.filter(a => !majorityAnswers.includes(a));
      const missing = majorityAnswers.filter(a => !answers.includes(a));
      if (extra.length > 0) onlyIn[resolver] = extra;
      if (missing.length > 0) missingFrom[resolver] = missing;
    }
  }
  return { hostname: key, agreement, perResolver, onlyIn, missingFrom };
}

/**
 * Run the differential probe across a whole batch of hostnames: diff every
 * name across every resolver view (idea 00056/00057).
 *
 * @param {object} viewsByResolver { resolverName: { hostname: answers[] } } (raw)
 * @returns {{ divergent: object[], unanimous: string[], resolverCoverage: object }}
 */
export function diffViewsAcrossResolvers(viewsByResolver) {
  const views = {};
  for (const [resolver, view] of Object.entries(viewsByResolver || {})) {
    views[resolver] = canonicalizeView(view);
  }
  const names = new Set();
  for (const view of Object.values(views)) {
    for (const n of Object.keys(view)) names.add(n);
  }
  const divergent = [];
  const unanimous = [];
  for (const name of [...names].sort()) {
    const diff = diffHostnameAcrossResolvers(name, views);
    if (diff.agreement) unanimous.push(name);
    else divergent.push(diff);
  }
  const resolverCoverage = {};
  for (const [resolver, view] of Object.entries(views)) {
    resolverCoverage[resolver] = Object.keys(view).length;
  }
  return { divergent, unanimous, resolverCoverage };
}

/**
 * Detect split-horizon DNS: names where one resolver (or transport) returns
 * private/internal answers while others return nothing or public answers
 * (idea 00056/00057).
 *
 * @param {object} diffResult output of diffViewsAcrossResolvers()
 * @returns {object[]} split-horizon findings { hostname, hiddenAnswers, hiddenIn, visibleIn }.
 */
export function detectSplitHorizon(diffResult) {
  const findings = [];
  const isPrivate = a => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|fd[0-9a-f]{2}:)/i.test(a);
  for (const diff of diffResult?.divergent || []) {
    const hiddenIn = [];
    const visibleIn = [];
    for (const [resolver, answers] of Object.entries(diff.perResolver)) {
      if (answers.length > 0 && answers.some(isPrivate)) hiddenIn.push(resolver);
      else if (answers.length > 0) visibleIn.push(resolver);
    }
    if (hiddenIn.length > 0 && (visibleIn.length > 0 || Object.keys(diff.missingFrom).length > 0)) {
      const hiddenAnswers = [
        ...new Set(hiddenIn.flatMap(r => diff.perResolver[r].filter(isPrivate))),
      ].sort();
      findings.push({ hostname: diff.hostname, hiddenAnswers, hiddenIn, visibleIn });
    }
  }
  return findings;
}

/**
 * Score how much a resolver's view deviates from the majority view — a
 * high deviation on internal-looking answers suggests a view engineered to
 * conceal infrastructure (idea 00057).
 *
 * @param {object} diffResult output of diffViewsAcrossResolvers()
 * @returns {object[]} per-resolver { resolver, divergentNames, concealmentScore } sorted desc.
 */
export function scoreViewConcealment(diffResult) {
  const stats = {};
  for (const diff of diffResult?.divergent || []) {
    for (const resolver of Object.keys(diff.onlyIn)) {
      stats[resolver] = stats[resolver] || { resolver, divergentNames: 0, names: [] };
      stats[resolver].divergentNames += 1;
      stats[resolver].names.push(diff.hostname);
    }
    for (const resolver of Object.keys(diff.missingFrom)) {
      stats[resolver] = stats[resolver] || { resolver, divergentNames: 0, names: [] };
      stats[resolver].divergentNames += 1;
      if (!stats[resolver].names.includes(diff.hostname)) stats[resolver].names.push(diff.hostname);
    }
  }
  const totalNames = (diffResult?.divergent?.length || 0) + (diffResult?.unanimous?.length || 0);
  const out = Object.values(stats).map(s => ({
    ...s,
    concealmentScore: totalNames > 0 ? Math.round((s.divergentNames / totalNames) * 100) : 0,
  }));
  out.sort((a, b) => b.concealmentScore - a.concealmentScore);
  return out;
}

/**
 * Fingerprint wildcard-synthesizing resolvers/zones from random-label
 * probe results: when every random label under a zone resolves to the same
 * answer set, the zone synthesizes wildcards (idea 00058).
 *
 * @param {object} probeResults { resolverName: { zone: { randomLabel: answers[] } } }
 * @returns {object[]} fingerprints { resolver, zone, isWildcard, sampleSize, synthesizedAnswers }.
 */
export function fingerprintWildcardZones(probeResults) {
  const out = [];
  for (const [resolver, zones] of Object.entries(probeResults || {})) {
    for (const [zone, labels] of Object.entries(zones || {})) {
      const entries = Object.entries(labels || {});
      const sampleSize = entries.length;
      let isWildcard = false;
      let synthesizedAnswers = [];
      if (sampleSize >= 3) {
        const sigs = entries.map(([, answers]) => JSON.stringify(normalizeAnswerSet(answers)));
        const uniqueSigs = new Set(sigs);
        if (uniqueSigs.size === 1 && sigs[0] !== '[]') {
          isWildcard = true;
          synthesizedAnswers = JSON.parse(sigs[0]);
        }
      }
      out.push({
        resolver,
        zone: String(zone).toLowerCase(),
        isWildcard,
        sampleSize,
        synthesizedAnswers,
      });
    }
  }
  out.sort((a, b) => Number(b.isWildcard) - Number(a.isWildcard) || b.sampleSize - a.sampleSize);
  return out;
}
