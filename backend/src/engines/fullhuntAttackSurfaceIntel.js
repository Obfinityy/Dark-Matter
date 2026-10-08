/**
 * fullhuntAttackSurfaceIntel.js — FullHunt attack-surface import engine for autonomous bug bounty.
 *
 * Defensive asset-discovery capability: given a FullHunt attack-surface export
 * (hosts, subdomains, open ports, technologies, CVEs) the caller fetched
 * legally during an authorized engagement, normalize it and build a
 * prioritized seed list for autonomous hunts. Covers idea-bank item 00162:
 *
 *  00162 FullHunt attack-surface import — import FullHunt's pre-mapped attack
 *        surface for the target domain as a seed list.
 *
 * All functions are pure and side-effect free. The caller supplies already-
 * fetched FullHunt response data; the engine never touches the network.
 */

/**
 * Normalize one FullHunt asset row into a canonical host record.
 *
 * @param {object} asset
 * @returns {{host: string|null, ip: string|null, ports: number[], technologies: string[], cves: string[], tags: string[]}}
 */
export function normalizeFullhuntAsset(asset) {
  if (!asset || typeof asset !== 'object')
    return { host: null, ip: null, ports: [], technologies: [], cves: [], tags: [] };
  const host =
    typeof asset.host === 'string'
      ? asset.host.trim().toLowerCase()
      : typeof asset.domain === 'string'
        ? asset.domain.trim().toLowerCase()
        : null;
  const ip = typeof asset.ip === 'string' ? asset.ip : null;
  const ports = (Array.isArray(asset.ports) ? asset.ports : [])
    .map(p => Number(p.port ?? p))
    .filter(p => Number.isFinite(p));
  const technologies = (Array.isArray(asset.technologies) ? asset.technologies : [])
    .map(t => (typeof t === 'string' ? t : t.name))
    .filter(t => typeof t === 'string')
    .map(t => t.trim())
    .filter(Boolean);
  const cves = (Array.isArray(asset.cves) ? asset.cves : [])
    .map(c => (typeof c === 'string' ? c : c.id))
    .filter(c => typeof c === 'string' && /^CVE-\d{4}-\d{4,}$/i.test(c))
    .map(c => c.toUpperCase());
  const tags = (Array.isArray(asset.tags) ? asset.tags : [])
    .filter(t => typeof t === 'string')
    .map(t => t.trim().toLowerCase())
    .filter(Boolean);
  return {
    host,
    ip,
    ports: [...new Set(ports)],
    technologies: [...new Set(technologies)],
    cves: [...new Set(cves)],
    tags: [...new Set(tags)],
  };
}

/**
 * Rank how attack-worthy an asset looks from passive attributes alone.
 * Heuristic: CVE presence > exposed admin/DB ports > rich technology surface.
 *
 * @param {{ports: number[], technologies: string[], cves: string[], tags: string[]}} asset Normalized asset.
 * @returns {number} Priority score, higher = seed it earlier in the hunt.
 */
export function seedPriority(asset) {
  let score = 0;
  score += asset.cves.length * 25;
  const riskyPorts = [22, 23, 3306, 5432, 6379, 27017, 8080, 8443, 9200, 5601, 5985, 5986];
  score += asset.ports.filter(p => riskyPorts.includes(p)).length * 8;
  score += Math.min(asset.technologies.length, 10) * 2;
  if (
    asset.tags.some(
      t =>
        t.includes('staging') || t.includes('dev') || t.includes('test') || t.includes('internal')
    )
  )
    score += 15;
  if (asset.tags.some(t => t.includes('cloud') || t.includes('cdn'))) score += 3;
  return score;
}

/**
 * Import a FullHunt attack-surface dump and build a prioritized seed list
 * (idea 00162).
 *
 * @param {object[]|object} dump FullHunt response: array of assets or {results:[...]}.
 * @param {{targetDomain?: string, limit?: number, minPriority?: number}} [opts]
 * @returns {{seeds: object[], inScope: number, outOfScope: number, total: number}}
 */
export function buildSeedList(dump, opts = {}) {
  const raw = Array.isArray(dump) ? dump : dump && Array.isArray(dump.results) ? dump.results : [];
  const assets = raw.map(normalizeFullhuntAsset).filter(a => a.host);
  const target = (opts.targetDomain || '').trim().toLowerCase().replace(/^\*\./, '');
  let inScope = 0;
  let outOfScope = 0;
  const seeds = [];
  for (const a of assets) {
    const scoped = !target || a.host === target || a.host.endsWith('.' + target);
    if (scoped) {
      inScope++;
      seeds.push(a);
    } else outOfScope++;
  }
  for (const s of seeds) s.priority = seedPriority(s);
  seeds.sort((a, b) => b.priority - a.priority);
  const minPriority = opts.minPriority ?? 0;
  const limited = (opts.limit ? seeds.slice(0, opts.limit) : seeds).filter(
    s => s.priority >= minPriority
  );
  return { seeds: limited, inScope, outOfScope, total: assets.length };
}

/**
 * Summarize a seed list for hunt planning output.
 *
 * @param {object[]} seeds Output of buildSeedList.
 * @returns {{seedCount: number, topHosts: string[], cveCount: number, uniqueTechs: number, summary: string}}
 */
export function seedListReport(seeds = []) {
  const seedCount = seeds.length;
  const topHosts = seeds.slice(0, 10).map(s => s.host);
  const cveCount = new Set(seeds.flatMap(s => s.cves)).size;
  const uniqueTechs = new Set(seeds.flatMap(s => s.technologies)).size;
  const summary =
    seedCount === 0
      ? 'FullHunt attack-surface import produced no in-scope seed hosts.'
      : `FullHunt attack-surface import produced ${seedCount} prioritized seed host(s) (${cveCount} known CVE(s), ${uniqueTechs} distinct technologies detected).`;
  return { seedCount, topHosts, cveCount, uniqueTechs, summary };
}

export default {
  normalizeFullhuntAsset,
  seedPriority,
  buildSeedList,
  seedListReport,
};
