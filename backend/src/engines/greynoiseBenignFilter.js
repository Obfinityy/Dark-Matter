/**
 * greynoiseBenignFilter.js — GreyNoise benign-IP filtering engine for autonomous bug bounty.
 *
 * Defensive noise-reduction capability: given GreyNoise-style IP
 * classifications the caller fetched legally during an authorized
 * engagement, filter internet-scanner IPs out of asset/hunt logs so real
 * asset traffic stands out. Covers idea-bank item 00164:
 *
 *  00164 GreyNoise benign-IP filtering — use GreyNoise to filter
 *        internet-scanner IPs out of logs so real asset traffic stands out.
 *
 * All functions are pure and side-effect free. The caller supplies
 * already-fetched classification data; the engine never touches the network.
 * It classifies and filters log records — it does not scan or block anything.
 */

/**
 * Normalize one GreyNoise-style IP classification record.
 *
 * @param {object} rec
 * @returns {{ip: string|null, classification: 'benign'|'malicious'|'unknown', noise: boolean, tags: string[], actor: string|null}}
 */
export function normalizeClassification(rec) {
  if (!rec || typeof rec !== 'object') return { ip: null, classification: 'unknown', noise: false, tags: [], actor: null };
  const ip = typeof rec.ip === 'string' ? rec.ip : null;
  const raw = String(rec.classification || rec.category || '').toLowerCase();
  const classification = raw.includes('benign') ? 'benign' : raw.includes('malicious') ? 'malicious' : 'unknown';
  const noise = Boolean(rec.noise ?? rec.riot ?? false);
  const tags = (Array.isArray(rec.tags) ? rec.tags : [])
    .filter((t) => typeof t === 'string')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const actor = typeof rec.actor === 'string' ? rec.actor
    : (typeof rec.metadata === 'object' && rec.metadata && typeof rec.metadata.organization === 'string' ? rec.metadata.organization : null);
  return { ip, classification, noise, tags: [...new Set(tags)], actor };
}

/**
 * Decide whether an IP should be treated as benign internet background noise.
 * Benign scanners (security researchers, internet-wide survey projects) are
 * noise; unknown or malicious IPs are kept for analyst review.
 *
 * @param {{classification: string, noise: boolean, tags: string[]}} rec Normalized record.
 * @returns {boolean}
 */
export function isBenignNoise(rec) {
  if (!rec) return false;
  if (rec.classification === 'benign') return true;
  if (rec.noise) return true;
  const noiseTags = ['scanner', 'crawler', 'research', 'survey', 'shodan', 'censys', 'binaryedge', 'zoomeye', 'fofa', 'netlas', 'greynoise'];
  return rec.tags.some((t) => noiseTags.some((n) => t.includes(n)));
}

/**
 * Filter log/access records, splitting scanner noise from real traffic
 * (idea 00164). `logIps` are plain IP strings or {ip, ...} records;
 * `classifications` is a map ip → GreyNoise-style record.
 *
 * @param {(string|{ip: string})[]} logIps
 * @param {Record<string, object>} classifications
 * @returns {{realTraffic: string[], filteredNoise: {ip: string, classification: string, actor: string|null}[], unclassified: string[]}}
 */
export function filterLogIps(logIps, classifications = {}) {
  const realTraffic = [];
  const filteredNoise = [];
  const unclassified = [];
  for (const raw of logIps || []) {
    const ip = typeof raw === 'string' ? raw : (raw && typeof raw.ip === 'string' ? raw.ip : null);
    if (!ip) continue;
    const rec = normalizeClassification(classifications[ip]);
    if (rec.classification === 'unknown' && !rec.noise && rec.tags.length === 0) {
      unclassified.push(ip);
      continue;
    }
    if (isBenignNoise(rec)) {
      filteredNoise.push({ ip, classification: rec.classification, actor: rec.actor });
    } else {
      realTraffic.push(ip);
    }
  }
  return {
    realTraffic: [...new Set(realTraffic)],
    filteredNoise,
    unclassified: [...new Set(unclassified)],
  };
}

/**
 * Summarize who the filtered scanners were, for hunt reporting.
 *
 * @param {{ip: string, classification: string, actor: string|null}[]} filteredNoise
 * @returns {{scannerCount: number, actors: {actor: string, count: number}[], summary: string}}
 */
export function scannerSummary(filteredNoise = []) {
  const byActor = new Map();
  for (const f of filteredNoise) {
    const actor = f.actor || 'unknown scanner';
    byActor.set(actor, (byActor.get(actor) || 0) + 1);
  }
  const actors = [...byActor.entries()]
    .map(([actor, count]) => ({ actor, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  const scannerCount = filteredNoise.length;
  const summary = scannerCount === 0
    ? 'GreyNoise filtering removed no benign scanner IPs; the log contains only real or unclassified traffic.'
    : `GreyNoise benign-IP filtering removed ${scannerCount} scanner IP(s) from the log${actors.length ? ` (top: ${actors[0].actor} ×${actors[0].count})` : ''}, leaving real asset traffic visible.`;
  return { scannerCount, actors, summary };
}

export default {
  normalizeClassification,
  isBenignNoise,
  filterLogIps,
  scannerSummary,
};
