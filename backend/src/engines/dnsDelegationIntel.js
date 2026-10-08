/**
 * dnsDelegationIntel.js — DNS delegation & namespace-structure analyzers
 * (ideas 00091, 00092, 00093).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent. Walks the
 * DNS delegation structure of a target domain to surface hidden zone cuts
 * and namespace shapes that passive scans miss: unsigned intermediate
 * delegations, empty non-terminals, and deeply nested internal names.
 *
 * All functions are pure: they analyze observed DNS data supplied by the
 * caller and never perform network lookups themselves.
 */

/**
 * Idea 00091 — DNSSEC DS-chain parent probing.
 *
 * Walks the DS records seen at each parent zone along a delegation path
 * (leaf zone toward the root) and flags intermediate zone cuts where the
 * delegation is UNSIGNED (no DS record at the parent). An unsigned
 * intermediate cut cannot cryptographically prove its child namespace, so
 * delegated subdomains beneath it are invisible to DNSSEC validators and
 * easy for an organization to lose track of — exactly where forgotten
 * infrastructure hides.
 *
 * @param {Array<{ zone: string, dsAtParent?: Array<{keyTag?: number, algorithm?: number, digestType?: number, digest?: string}>, nsAtParent?: string[] }>} delegationPath
 *   Delegation hops ordered from the leaf zone outward toward the root.
 *   `zone` is the child zone name, `dsAtParent` the DS set published by the
 *   parent for that child (empty/missing = unsigned delegation).
 * @returns {{
 *   cuts: Array<{ zone: string, signed: boolean, dsCount: number, keyTags: number[] }>,
 *   unsignedCuts: Array<{ zone: string, nameservers: string[], risk: string, recommendation: string }>,
 *   chainComplete: boolean
 * }}
 */
export function walkDsChain(delegationPath) {
  const cuts = [];
  const unsignedCuts = [];

  for (const hop of delegationPath || []) {
    const zone = String(hop?.zone || '')
      .toLowerCase()
      .replace(/\.$/, '');
    if (!zone) continue;
    const ds = Array.isArray(hop.dsAtParent) ? hop.dsAtParent : [];
    const keyTags = ds.map(d => Number(d?.keyTag)).filter(n => Number.isFinite(n));
    const signed = ds.length > 0;
    cuts.push({ zone, signed, dsCount: ds.length, keyTags });

    if (!signed) {
      const ns = (Array.isArray(hop.nsAtParent) ? hop.nsAtParent : []).map(String);
      unsignedCuts.push({
        zone,
        nameservers: ns,
        risk:
          `Delegation of '${zone}' is unsigned: the parent publishes no DS record, ` +
          'so the child namespace has no DNSSEC proof of existence. Delegated subdomains ' +
          'beneath this cut are invisible to validators and commonly drift out of asset inventories.',
        recommendation:
          `Enumerate '${zone}' directly (zone transfer attempts, NS-record ` +
          'walking, certificate-transparency logs) — unsigned intermediate cuts are the ' +
          'most likely place to find forgotten delegated subdomains.',
      });
    }
  }

  return {
    cuts,
    unsignedCuts,
    chainComplete: cuts.length > 0 && cuts.every(c => c.signed),
  };
}

/**
 * Idea 00092 — Empty-non-terminal label enumeration.
 *
 * An empty non-terminal (ENT) is a DNS name that owns no records itself
 * but must exist because names below it do (RFC 4592). A NOERROR response
 * with an empty answer section for a non-apex name is the classic ENT
 * signature: it proves deeper labels exist beneath it, even when the
 * authoritative server refuses to list them.
 *
 * @param {Array<{ name: string, rcode?: string|number, answerCount?: number, isApex?: boolean }>} probes
 *   Results of direct queries for candidate labels. `rcode` may be the
 *   string ('NOERROR'/'NXDOMAIN') or the numeric code (0/3).
 * @param {string[]} [knownNames] - Other names already observed in the zone,
 *   used to attach known children to each detected ENT.
 * @returns {Array<{ name: string, children: string[], confidence: 'high'|'medium', detail: string }>}
 *   Detected empty non-terminals with the deeper labels they imply.
 */
export function detectEmptyNonTerminals(probes, knownNames = []) {
  const normalized = (probes || []).map(p => ({
    name: String(p?.name || '')
      .toLowerCase()
      .replace(/\.$/, ''),
    rcode: String(p?.rcode ?? '').toUpperCase(),
    answerCount: Number(p?.answerCount ?? 0),
    isApex: Boolean(p?.isApex),
  }));

  const known = (knownNames || []).map(n => String(n).toLowerCase().replace(/\.$/, ''));
  const results = [];

  for (const p of normalized) {
    if (!p.name || p.isApex) continue;
    const noError = p.rcode === 'NOERROR' || p.rcode === '0';
    if (!noError || p.answerCount > 0) continue;

    const children = known.filter(n => n !== p.name && n.endsWith(`.${p.name}`));
    results.push({
      name: p.name,
      children,
      confidence: children.length > 0 ? 'high' : 'medium',
      detail:
        children.length > 0
          ? `Empty non-terminal: '${p.name}' holds no records itself but ${children.length} ` +
            `observed name(s) exist beneath it (${children.slice(0, 5).join(', ')}` +
            `${children.length > 5 ? ', …' : ''}). Deeper labels are guaranteed to exist — keep drilling.`
          : `Empty non-terminal candidate: '${p.name}' returned NOERROR with an empty answer ` +
            'section and is not the zone apex. The server acknowledges the name but owns no ' +
            'records at it, which strongly implies labels exist below it.',
    });
  }

  return results;
}

const DEFAULT_DEPTH_WORDLIST = [
  'internal',
  'corp',
  'intranet',
  'private',
  'ops',
  'infra',
  'mgmt',
  'admin',
  'dev',
  'staging',
  'test',
  'prod',
  'legacy',
  'dmz',
  'vpn',
  'core',
  'edge',
  'east',
  'west',
  'eu',
  'us',
  'asia',
  'dc1',
  'dc2',
  'az1',
];

/**
 * Idea 00093 — DNS label-count depth probing.
 *
 * Organizes probed labels into a namespace depth tree (e.g.
 * `a.b.c.internal.example.com` = depth 6) and suggests the next round of
 * probes: it extends the deepest *confirmed* internal branches with a
 * curated wordlist instead of blindly brute-forcing the whole zone.
 *
 * @param {Array<{ name: string, exists: boolean }>} probes - Probed fully-qualified names.
 * @param {string} zone - The zone apex (e.g. 'example.com').
 * @param {string[]} [wordlist] - Labels to try beneath the deepest confirmed branches.
 * @returns {{
 *   maxDepth: number,
 *   deepestExisting: string[],
 *   depthHistogram: Record<number, number>,
 *   suggestions: Array<{ name: string, parent: string, depth: number, reason: string }>
 * }}
 */
export function analyzeLabelDepth(probes, zone, wordlist = DEFAULT_DEPTH_WORDLIST) {
  const apex = String(zone || '')
    .toLowerCase()
    .replace(/\.$/, '');
  const existing = (probes || [])
    .filter(p => p?.exists && p?.name)
    .map(p => String(p.name).toLowerCase().replace(/\.$/, ''))
    .filter(n => n === apex || n.endsWith(`.${apex}`));

  const depthOf = n => (n === apex ? 1 : n.slice(0, -(apex.length + 1)).split('.').length + 1);
  const depthHistogram = {};
  let maxDepth = 1;
  for (const n of existing) {
    const d = depthOf(n);
    depthHistogram[d] = (depthHistogram[d] || 0) + 1;
    if (d > maxDepth) maxDepth = d;
  }

  const deepestExisting = existing.filter(n => depthOf(n) === maxDepth);
  const seen = new Set(existing);
  const suggestions = [];

  for (const parent of deepestExisting) {
    for (const word of wordlist) {
      const candidate = `${word}.${parent}`;
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      suggestions.push({
        name: candidate,
        parent,
        depth: maxDepth + 1,
        reason:
          `Extends the deepest confirmed branch '${parent}' (depth ${maxDepth}) ` +
          `with internal-namespace label '${word}'. Deep nesting like ` +
          'a.b.c.internal.example.com typically marks non-public infrastructure.',
      });
    }
  }

  return { maxDepth, deepestExisting, depthHistogram, suggestions };
}
