/**
 * dnameIntel.js — DNAME redirection chain following (idea 00090).
 *
 * Defensive aliased-subtree discovery for an authorized bug-bounty agent.
 * DNAME records (RFC 6672) redirect an entire DNS subtree: every name
 * under the owner is transparently aliased under the target. Following
 * DNAME redirections reveals the aliased subtrees the target uses for
 * migrations and renames — subtrees that frequently keep legacy services
 * live under old names, expanding the effective attack surface.
 *
 * Passive DNS lookups only. Use against operator-authorized targets only.
 */

import dns from 'node:dns';

const resolver = new dns.promises.Resolver();

/** Maximum DNAME hops followed before flagging a suspicious chain. */
export const MAX_DNAME_HOPS = 8;

/**
 * Normalize a DNS owner/target name for chain comparison.
 *
 * @param {string} name
 * @returns {string}
 */
export function normalizeDnsName(name) {
  return String(name || '').trim().toLowerCase().replace(/\.$/, '');
}

/**
 * Follow one DNAME step: rewrite a query name under a DNAME owner/target pair
 * per RFC 6672 §3.1 (synthesis of the CNAME).
 *
 * @param {string} queryName the name being resolved
 * @param {string} dnameOwner owner of the DNAME record
 * @param {string} dnameTarget target of the DNAME record
 * @returns {string|null} the synthesized name, or null if queryName is not under the owner
 */
export function applyDname(queryName, dnameOwner, dnameTarget) {
  const q = normalizeDnsName(queryName);
  const owner = normalizeDnsName(dnameOwner);
  const target = normalizeDnsName(dnameTarget);
  if (q === owner) return target;
  if (q.endsWith(`.${owner}`)) {
    return `${q.slice(0, -(owner.length))}${target}`;
  }
  return null;
}

/**
 * Idea 00090 — follow a DNAME redirection chain given the known DNAME
 * records of a zone (owner → target map), starting from a seed name.
 *
 * Detects loops, overly long chains and cross-domain redirections —
 * each a signal of migration debt or delegation oddities worth reviewing.
 *
 * @param {string} seedName starting name, e.g. "old-app.example.com"
 * @param {Record<string,string>} dnameMap owner → target DNAME records (names may have trailing dots)
 * @returns {{seed:string, hops:Array<{owner:string,target:string,synthesized:string}>, finalName:string, loop:boolean, crossDomain:boolean, findings:Array<{severity:string,type:string,detail:string}>}}
 */
export function followDnameChain(seedName, dnameMap) {
  const findings = [];
  const hops = [];
  const map = {};
  for (const [owner, target] of Object.entries(dnameMap || {})) {
    map[normalizeDnsName(owner)] = normalizeDnsName(target);
  }
  const seed = normalizeDnsName(seedName);
  const seedZone = seed.split('.').slice(-2).join('.');
  let current = seed;
  let loop = false;
  const visited = new Set([current]);
  while (hops.length < MAX_DNAME_HOPS) {
    let stepped = false;
    for (const [owner, target] of Object.entries(map)) {
      const synthesized = applyDname(current, owner, target);
      if (synthesized) {
        hops.push({ owner, target, synthesized });
        current = synthesized;
        stepped = true;
        break;
      }
    }
    if (!stepped) break;
    if (visited.has(current)) { loop = true; break; }
    visited.add(current);
  }
  const finalZone = current.split('.').slice(-2).join('.');
  const crossDomain = hops.length > 0 && finalZone !== seedZone;
  if (hops.length === 0) {
    return { seed, hops, finalName: current, loop: false, crossDomain: false, findings };
  }
  findings.push({
    severity: 'info',
    type: 'dname-redirection-chain',
    detail: `DNAME chain from ${seed}: ${hops.map(h => `${h.owner} → ${h.target}`).join(' → ')} — final name ${current}. The aliased subtree is part of the target's live surface; enumerate services under both the old and new names.`,
  });
  if (crossDomain) {
    findings.push({
      severity: 'medium',
      type: 'dname-cross-domain-redirect',
      detail: `DNAME chain leaves the seed's domain (${seedZone} → ${finalZone}) — cross-domain subtree aliasing hands resolution control to another zone's operators; verify the delegation is intentional and monitored.`,
    });
  }
  if (loop) {
    findings.push({
      severity: 'medium',
      type: 'dname-redirection-loop',
      detail: `DNAME chain from ${seed} loops back to an already-visited name — a misconfiguration that breaks resolution for the whole aliased subtree (denial of service for those names).`,
    });
  }
  if (hops.length >= MAX_DNAME_HOPS) {
    findings.push({
      severity: 'low',
      type: 'dname-chain-too-long',
      detail: `DNAME chain from ${seed} reached ${MAX_DNAME_HOPS} hops without terminating — deep chains indicate unresolved migration debt; each intermediate subtree may host forgotten services.`,
    });
  }
  return { seed, hops, finalName: current, loop, crossDomain, findings };
}

/**
 * Discover DNAME records at candidate owner names of a domain and follow
 * each chain found.
 *
 * @param {string} domain
 * @param {string[]} [owners] owner names (relative labels) to probe for DNAME
 * @returns {Promise<{domain:string, chains:Array, summary:string[]}>}
 */
export async function discoverDnameChains(domain, owners = ['legacy', 'old', 'archive', 'migration', 'v1', 'beta']) {
  const d = normalizeDnsName(domain);
  const summary = [];
  const chains = [];
  const found = {};
  await Promise.all(owners.map(async (label) => {
    const owner = `${label}.${d}`;
    try {
      const raw = await resolver.resolve(owner, 'DNAME');
      const target = normalizeDnsName(String(raw));
      found[owner] = target;
    } catch { /* no DNAME — not a finding */ }
  }));
  for (const owner of Object.keys(found).sort()) {
    const chain = followDnameChain(owner, found);
    if (chain.hops.length > 0) chains.push(chain);
  }
  if (chains.length === 0) {
    summary.push('No DNAME records found on probed owner names — no aliased migration subtrees in DNS (or they live under unpublished names).');
  } else {
    summary.push(`${chains.length} DNAME redirection chain(s) discovered — each aliased subtree is legacy-service hunting ground under both old and new names.`);
  }
  return { domain: d, chains, summary };
}
