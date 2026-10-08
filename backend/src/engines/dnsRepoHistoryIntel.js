/**
 * dnsRepoHistoryIntel.js — Historical DNS record mining for deleted-subdomain discovery.
 *
 * Implements idea-bank item 00181 (DNSRepo history mining): analyze historical
 * DNS record snapshots to find subdomains that existed in the past but have
 * since disappeared. Deleted records frequently leave behind dangling DNS
 * (e.g. a CNAME still pointing at a decommissioned cloud resource), which is
 * a classic subdomain-takeover vector worth re-checking.
 *
 * All functions are pure: they operate on plain record arrays the caller has
 * already fetched (from DNSRepo or any other historical DNS source).
 */

/**
 * Canonical historical DNS record shape.
 * @typedef {object} HistoricalDnsRecord
 * @property {string} hostname
 * @property {string} type        DNS record type (A, CNAME, TXT, ...)
 * @property {string} value       record value
 * @property {number} firstSeen   epoch ms when the record first appeared
 * @property {number} lastSeen    epoch ms when the record was last observed
 */

/** Record types whose dangling values are takeover-relevant. */
export const DANGLE_SENSITIVE_TYPES = new Set(['CNAME', 'NS']);

/** Cloud targets whose disappearance usually means the resource may be reclaimable. */
const CLOUD_TARGET_HINTS = [
  'cloudfront.net',
  'amazonaws.com',
  'azurewebsites.net',
  'azureedge.net',
  'herokuapp.com',
  'github.io',
  'netlify.app',
  'vercel.app',
  's3-website',
  'blob.core.windows.net',
  'appspot.com',
  'fastly.net',
  'pantheonsite.io',
  'wpengine.com',
  'squarespace.com',
  'shopify.com',
];

/**
 * Normalize a raw record row (tolerant of mixed-source shapes).
 * @param {object} raw
 * @returns {HistoricalDnsRecord|null}
 */
export function normalizeRepoRecord(raw) {
  if (!raw || typeof raw.hostname !== 'string' || !raw.hostname.trim()) return null;
  const firstSeen = Number(raw.firstSeen ?? raw.first_seen ?? 0);
  const lastSeen = Number(raw.lastSeen ?? raw.last_seen ?? 0);
  return {
    hostname: raw.hostname.trim().toLowerCase(),
    type: String(raw.type ?? raw.recordType ?? 'A').toUpperCase(),
    value: String(raw.value ?? raw.target ?? ''),
    firstSeen: Number.isFinite(firstSeen) ? firstSeen : 0,
    lastSeen: Number.isFinite(lastSeen) ? lastSeen : 0,
  };
}

/**
 * Build a per-hostname timeline from historical records.
 * @param {HistoricalDnsRecord[]} records
 * @returns {Map<string, {hostname, firstSeen, lastSeen, records: HistoricalDnsRecord[], types: string[]}>}
 */
export function buildHostnameTimeline(records) {
  const byHost = new Map();
  for (const raw of records) {
    const rec = raw.hostname ? raw : normalizeRepoRecord(raw);
    if (!rec) continue;
    let entry = byHost.get(rec.hostname);
    if (!entry) {
      entry = {
        hostname: rec.hostname,
        firstSeen: rec.firstSeen,
        lastSeen: rec.lastSeen,
        records: [],
        types: new Set(),
      };
      byHost.set(rec.hostname, entry);
    }
    entry.firstSeen = Math.min(entry.firstSeen, rec.firstSeen);
    entry.lastSeen = Math.max(entry.lastSeen, rec.lastSeen);
    entry.records.push(rec);
    entry.types.add(rec.type);
  }
  for (const entry of byHost.values()) entry.types = [...entry.types].sort();
  return byHost;
}

/**
 * Find deleted subdomains: hostnames absent from current records whose last
 * observation is older than the quiet threshold, ranked by takeover potential.
 * @param {HistoricalDnsRecord[]} historical   all historical records
 * @param {Set<string>|string[]} [current]    hostnames known to still resolve today
 * @param {object} [opts]
 * @param {number} [opts.quietDays=90]        days of silence before considered deleted
 * @param {number} [opts.now=Date.now()]
 * @returns {Array<{hostname, lastSeen, daysQuiet, dangleSignals: string[], cloudHint: boolean, score: number}>}
 */
export function findDeletedSubdomains(historical, current = new Set(), opts = {}) {
  const currentSet = current instanceof Set ? current : new Set(current);
  const now = opts.now ?? Date.now();
  const quietDays = opts.quietDays ?? 90;
  const timeline = buildHostnameTimeline(historical);
  const out = [];

  for (const [hostname, entry] of timeline) {
    if (currentSet.has(hostname)) continue;
    const daysQuiet = (now - entry.lastSeen) / 86400000;
    if (daysQuiet < quietDays) continue;

    const dangleSignals = [];
    let cloudHint = false;
    for (const rec of entry.records) {
      if (DANGLE_SENSITIVE_TYPES.has(rec.type) && rec.value) {
        dangleSignals.push(`${rec.type} -> ${rec.value}`);
        const lv = rec.value.toLowerCase();
        if (CLOUD_TARGET_HINTS.some(h => lv.includes(h))) cloudHint = true;
      }
    }

    // Score: cloud hint doubles value; more quiet time slightly raises it.
    const score = Math.min(
      100,
      (cloudHint ? 60 : 25) + dangleSignals.length * 8 + Math.min(20, daysQuiet / 30)
    );
    out.push({
      hostname,
      lastSeen: entry.lastSeen,
      daysQuiet: Math.round(daysQuiet),
      dangleSignals,
      cloudHint,
      score: Math.round(score),
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

/**
 * Flag CNAME targets of deleted hosts that point at third-party cloud
 * services — the classic dangling-DNS takeover fingerprint.
 * @param {HistoricalDnsRecord[]} historical
 * @param {Set<string>|string[]} [current]
 * @param {object} [opts]
 * @returns {Array<{hostname, target, score}>}
 */
export function flagDanglingTakeoverSignals(historical, current = new Set(), opts = {}) {
  return findDeletedSubdomains(historical, current, opts)
    .filter(d => d.cloudHint && d.dangleSignals.length > 0)
    .map(d => ({
      hostname: d.hostname,
      target: d.dangleSignals[0].split(' -> ')[1] ?? '',
      score: d.score,
    }));
}
