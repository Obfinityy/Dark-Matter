/**
 * waybackTimemapIntel.js — Wayback timemap diff analysis (idea 00204).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent.
 * Diffs two CDX capture sets (same domain, different timestamps) to list
 * subdomains that appeared vs vanished — vanished hosts are flagged for
 * dangling-DNS review (their DNS records may still point at reclaimed
 * infrastructure).
 */

/**
 * Normalise a host list from raw capture URLs or bare hosts.
 * @param {string[]} items - URLs or hostnames.
 * @returns {Set<string>} Lowercased hostnames.
 */
export function normaliseHosts(items) {
  const hosts = new Set();
  for (const item of items || []) {
    const s = String(item || '').trim().toLowerCase();
    if (!s) continue;
    let host = s;
    try { host = new URL(s.includes('://') ? s : `http://${s}`).hostname; } catch { /* keep */ }
    host = host.replace(/:\d+$/, '').replace(/\/.*$/, '');
    if (host) hosts.add(host);
  }
  return hosts;
}

/**
 * Diff two host sets: appeared in new, vanished from new, stable in both.
 * @param {Set<string>|string[]} oldHosts - Hosts from the older capture set.
 * @param {Set<string>|string[]} newHosts - Hosts from the newer capture set.
 * @returns {{ appeared: string[], vanished: string[], stable: string[] }}
 */
export function diffHostSets(oldHosts, newHosts) {
  const oldSet = oldHosts instanceof Set ? oldHosts : new Set(oldHosts);
  const newSet = newHosts instanceof Set ? newHosts : new Set(newHosts);
  const appeared = [...newSet].filter(h => !oldSet.has(h)).sort();
  const vanished = [...oldSet].filter(h => !newSet.has(h)).sort();
  const stable = [...newSet].filter(h => oldSet.has(h)).sort();
  return { appeared, vanished, stable };
}

/**
 * Flag vanished hosts for dangling-DNS review.
 * Prioritises: cnames/hosts with numeric suffixes or legacy prefixes
 * (common in reclaimed PaaS infrastructure).
 * @param {string[]} vanished - Hosts that disappeared between snapshots.
 * @returns {Array<{ host, review: string, priority: 'high'|'medium'|'low' }>}
 */
export function flagDanglingReview(vanished) {
  return (vanished || []).map(host => {
    const h = String(host).toLowerCase();
    const paasHint = /(heroku|azurewebsites|cloudfront|s3|bucket|github|netlify|vercel|fastly|appspot|cloudapp)/.test(h);
    const legacyHint = /^(old|legacy|dev|test|staging|beta|v1|v2|archive|backup|migration)/.test(h);
    return {
      host,
      review: 'Host vanished from archive; check whether its DNS still resolves to third-party/reclaimed infrastructure.',
      priority: paasHint ? 'high' : legacyHint ? 'medium' : 'low',
    };
  });
}

/**
 * Idea 00204 — full timemap diff: compare two capture host lists.
 * @param {string[]} oldItems - URLs/hosts from the older capture set.
 * @param {string[]} newItems - URLs/hosts from the newer capture set.
 * @param {Object} [meta] - Optional: { oldLabel, newLabel } timestamp labels.
 * @returns {{ appeared, vanished, stable, danglingReview, oldCount, newCount, provenance }}
 */
export function diffTimemaps(oldItems, newItems, meta = {}) {
  const oldHosts = normaliseHosts(oldItems);
  const newHosts = normaliseHosts(newItems);
  const { appeared, vanished, stable } = diffHostSets(oldHosts, newHosts);
  return {
    appeared,
    vanished,
    stable,
    danglingReview: flagDanglingReview(vanished),
    oldCount: oldHosts.size,
    newCount: newHosts.size,
    oldLabel: meta.oldLabel || 'older-capture',
    newLabel: meta.newLabel || 'newer-capture',
    provenance: 'wayback-machine timemap diff',
  };
}
