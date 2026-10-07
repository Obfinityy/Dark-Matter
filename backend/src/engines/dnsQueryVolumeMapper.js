/**
 * dnsQueryVolumeMapper.js — DNS query-volume anomaly mapping engine.
 *
 * Works on passive DNS / DNS telemetry snapshots for an authorized target
 * domain: maps per-subdomain query volumes, flags statistically anomalous
 * spikes, and prioritizes high-traffic assets for the hunt plan.
 *
 * All analysis is local and passive: it consumes query-count records the
 * platform already collected (e.g. from the organization's own resolver
 * logs or a licensed passive-DNS feed) and never issues DNS traffic itself.
 */

/**
 * Normalize raw query-count records into scored assets.
 * @param {{name: string, count: number}[]} records per-subdomain query counts
 * @returns {{name: string, count: number, logVolume: number, volumeScore: number}[]}
 *   scored assets sorted by count descending (volumeScore is 0-100)
 */
export function scoreVolumes(records = []) {
  const clean = (Array.isArray(records) ? records : [])
    .filter((r) => r && typeof r.name === 'string' && Number.isFinite(r.count) && r.count >= 0);
  if (clean.length === 0) return [];
  const logVolumes = clean.map((r) => Math.log10(r.count + 1));
  const maxLog = Math.max(...logVolumes, 1);
  return clean
    .map((r, i) => ({
      name: r.name,
      count: r.count,
      logVolume: round(logVolumes[i], 4),
      volumeScore: round((logVolumes[i] / maxLog) * 100, 2),
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Flag subdomains whose query volume is statistically anomalous versus the
 * rest of the zone (z-score on log10 counts).
 * @param {{name: string, count: number}[]} records
 * @param {number} [threshold=2.0] z-score threshold for flagging
 * @returns {{name: string, count: number, zScore: number, direction: 'spike'|'lull'}[]}
 */
export function detectVolumeAnomalies(records = [], threshold = 2.0) {
  const clean = (Array.isArray(records) ? records : [])
    .filter((r) => r && typeof r.name === 'string' && Number.isFinite(r.count) && r.count >= 0);
  if (clean.length < 4) return [];
  const logs = clean.map((r) => Math.log10(r.count + 1));
  const mean = logs.reduce((a, b) => a + b, 0) / logs.length;
  const variance = logs.reduce((a, b) => a + (b - mean) ** 2, 0) / logs.length;
  const std = Math.sqrt(variance);
  if (std === 0) return [];
  const out = [];
  clean.forEach((r, i) => {
    const z = (logs[i] - mean) / std;
    if (Math.abs(z) >= threshold) {
      out.push({
        name: r.name,
        count: r.count,
        zScore: round(z, 3),
        direction: z > 0 ? 'spike' : 'lull',
      });
    }
  });
  return out.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
}

/**
 * Bucket assets into traffic tiers for hunt prioritization.
 * @param {{name: string, count: number}[]} records
 * @returns {{critical: string[], high: string[], medium: string[], low: string[], thresholds: object}}
 */
export function prioritizeAssets(records = []) {
  const scored = scoreVolumes(records);
  const tiers = { critical: [], high: [], medium: [], low: [] };
  for (const s of scored) {
    if (s.volumeScore >= 75) tiers.critical.push(s.name);
    else if (s.volumeScore >= 50) tiers.high.push(s.name);
    else if (s.volumeScore >= 25) tiers.medium.push(s.name);
    else tiers.low.push(s.name);
  }
  return {
    ...tiers,
    thresholds: { critical: 75, high: 50, medium: 25 },
    total: scored.length,
  };
}

/**
 * Roll query volumes up to the second-level label (e.g. all *.api.example.com
 * summed under "api") to find busy service families.
 * @param {{name: string, count: number}[]} records
 * @param {string} apexDomain e.g. "example.com"
 * @returns {{label: string, totalQueries: number, subdomains: number}[]} sorted by totalQueries desc
 */
export function rollupByLabel(records = [], apexDomain = '') {
  const apex = String(apexDomain).toLowerCase().replace(/\.$/, '');
  const groups = new Map();
  for (const r of Array.isArray(records) ? records : []) {
    if (!r || typeof r.name !== 'string' || !Number.isFinite(r.count)) continue;
    const name = r.name.toLowerCase().replace(/\.$/, '');
    let label = '(apex/other)';
    if (apex && name !== apex && name.endsWith(`.${apex}`)) {
      const rest = name.slice(0, -(apex.length + 1));
      label = rest.includes('.') ? rest.slice(rest.lastIndexOf('.') + 1) : rest;
    }
    const g = groups.get(label) || { label, totalQueries: 0, subdomains: new Set() };
    g.totalQueries += r.count;
    g.subdomains.add(name);
    groups.set(label, g);
  }
  return [...groups.values()]
    .map((g) => ({ label: g.label, totalQueries: g.totalQueries, subdomains: g.subdomains.size }))
    .sort((a, b) => b.totalQueries - a.totalQueries);
}

/**
 * Diff two volume snapshots to find spiking or fading subdomains.
 * @param {{name: string, count: number}[]} before earlier snapshot
 * @param {{name: string, count: number}[]} after later snapshot
 * @returns {{name: string, before: number, after: number, deltaPct: number|null, trend: 'spike'|'growth'|'fade'|'stable'|'new'|'gone'}[]}
 */
export function mapVolumeChanges(before = [], after = []) {
  const bMap = new Map();
  for (const r of Array.isArray(before) ? before : []) {
    if (r && typeof r.name === 'string' && Number.isFinite(r.count)) bMap.set(r.name, r.count);
  }
  const aMap = new Map();
  for (const r of Array.isArray(after) ? after : []) {
    if (r && typeof r.name === 'string' && Number.isFinite(r.count)) aMap.set(r.name, r.count);
  }
  const names = new Set([...bMap.keys(), ...aMap.keys()]);
  const out = [];
  for (const name of names) {
    const b = bMap.get(name);
    const a = aMap.get(name);
    if (b === undefined) {
      out.push({ name, before: 0, after: a, deltaPct: null, trend: 'new' });
    } else if (a === undefined) {
      out.push({ name, before: b, after: 0, deltaPct: null, trend: 'gone' });
    } else {
      const deltaPct = b === 0 ? (a === 0 ? 0 : Infinity) : round(((a - b) / b) * 100, 2);
      const trend = deltaPct >= 200 ? 'spike' : deltaPct >= 25 ? 'growth' : deltaPct <= -50 ? 'fade' : 'stable';
      out.push({ name, before: b, after: a, deltaPct, trend });
    }
  }
  return out.sort((a, b) => Math.abs(b.deltaPct === Infinity ? 1000 : b.deltaPct || 0) - Math.abs(a.deltaPct === Infinity ? 1000 : a.deltaPct || 0));
}

function round(n, digits) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

export const DNS_QUERY_VOLUME = {
  scoreVolumes,
  detectVolumeAnomalies,
  prioritizeAssets,
  rollupByLabel,
  mapVolumeChanges,
};
