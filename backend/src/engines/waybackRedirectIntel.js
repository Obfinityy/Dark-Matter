/**
 * waybackRedirectIntel.js — Wayback redirect-chain host extraction (idea 00205).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent.
 * From archived redirect chains (e.g. Wayback `urlkey` chains, WARC revisit
 * records, or CDX redirect responses) extract every distinct host pointing at
 * old infrastructure — legacy redirects often leak forgotten domains,
 * staging hosts, and pre-migration IPs.
 */

/**
 * Build the host of a URL, lowercased.
 * @param {string} url
 * @returns {string} Hostname or ''.
 */
function hostOf(url) {
  try { return new URL(String(url)).hostname.toLowerCase(); } catch { return ''; }
}

/**
 * Parse a redirect-chain description into hops.
 * Accepts an array of URL strings (hop order) or an array of
 * { from, to, status } hop objects.
 * @param {Array<string|Object>} chain
 * @returns {Array<{ from: string, to: string, status: string }>}
 */
export function parseRedirectChain(chain) {
  const hops = [];
  const items = Array.isArray(chain) ? chain : [];
  if (items.length && typeof items[0] === 'string') {
    for (let i = 0; i < items.length - 1; i++) {
      hops.push({ from: items[i], to: items[i + 1], status: '3xx' });
    }
  } else {
    for (const h of items) {
      if (h && (h.from || h.to)) {
        hops.push({ from: String(h.from || ''), to: String(h.to || ''), status: String(h.status || '3xx') });
      }
    }
  }
  return hops;
}

/**
 * Extract every distinct host touched by redirect chains, classified by role.
 * @param {Array<Array<string|Object>>} chains - List of redirect chains.
 * @returns {{ hosts: string[], hostRoles: Array<{ host, firstSeenAt: 'origin'|'intermediate'|'terminal', hopCount: number, terminalUrls: string[] }> }}
 */
export function extractChainHosts(chains) {
  const roles = new Map();
  for (const chain of chains || []) {
    const hops = parseRedirectChain(chain);
    if (!hops.length) continue;
    const urlsInChain = [];
    for (const h of hops) { urlsInChain.push(h.from, h.to); }
    const terminalHost = hostOf(hops[hops.length - 1].to);
    for (const u of urlsInChain) {
      const host = hostOf(u);
      if (!host) continue;
      if (!roles.has(host)) roles.set(host, { firstSeenAt: 'intermediate', hopCount: 0, terminalUrls: new Set() });
      const r = roles.get(host);
      r.hopCount += 1;
      if (u === hops[0].from && r.firstSeenAt === 'intermediate') r.firstSeenAt = 'origin';
      if (host === terminalHost) {
        r.firstSeenAt = 'terminal';
        r.terminalUrls.add(hops[hops.length - 1].to);
      }
    }
  }
  const hostRoles = [...roles.entries()].map(([host, r]) => ({
    host,
    firstSeenAt: r.firstSeenAt,
    hopCount: r.hopCount,
    terminalUrls: [...r.terminalUrls],
  }));
  return { hosts: hostRoles.map(x => x.host).sort(), hostRoles };
}

/**
 * Find chains that terminate on hosts outside the target's own domain —
 * those "old infrastructure" sinks are the interesting review candidates.
 * @param {Array<Array<string|Object>>} chains - Redirect chains.
 * @param {string} domain - Target apex domain.
 * @returns {Array<{ chain: Array<{from,to,status}>, externalTerminal: string }>}
 */
export function findExternalTerminals(chains, domain) {
  const apex = String(domain || '').trim().toLowerCase();
  const hits = [];
  for (const chain of chains || []) {
    const hops = parseRedirectChain(chain);
    if (!hops.length) continue;
    const terminal = hostOf(hops[hops.length - 1].to);
    if (terminal && terminal !== apex && !terminal.endsWith(`.${apex}`)) {
      hits.push({ chain: hops, externalTerminal: terminal });
    }
  }
  return hits;
}

/**
 * Idea 00205 — full extraction from archived redirect chains.
 * @param {Array<Array<string|Object>>} chains - Redirect chains (hop arrays).
 * @param {string} domain - Target apex domain.
 * @returns {{ hosts, hostRoles, externalTerminals, chainCount, provenance }}
 */
export function mineRedirectChains(chains, domain) {
  const { hosts, hostRoles } = extractChainHosts(chains);
  return {
    hosts,
    hostRoles,
    externalTerminals: findExternalTerminals(chains, domain),
    chainCount: (chains || []).length,
    provenance: 'wayback-machine redirect chains',
  };
}
