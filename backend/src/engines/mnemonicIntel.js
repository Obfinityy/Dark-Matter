/**
 * mnemonicIntel.js — Mnemonic passive-DNS wildcard search (idea 00179).
 *
 * Defensive asset-discovery analyzers for an authorized bug-bounty agent.
 * Consumes aggregated Mnemonic-style passive-DNS records and runs wildcard
 * searches for deep label patterns (e.g. "*.internal.example.com") to map
 * naming conventions and surface hosts buried deep in the label hierarchy.
 *
 * Record shape:
 *   { name, firstSeen, lastSeen, queryCount, rrtype, source }
 * firstSeen/lastSeen are ISO-8601 (or epoch ms).
 * All functions are pure and synchronous.
 */

/**
 * Convert a wildcard pattern ("*.internal.example.com", "api-?.example.com")
 * to a case-insensitive RegExp.
 * @param {string} pattern
 * @returns {RegExp}
 */
export function wildcardToRegExp(pattern) {
  const escaped = String(pattern)
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`, 'i');
}

/**
 * Idea 00179 — Wildcard search over passive-DNS names.
 *
 * @param {Array<Object>} records - passive-DNS records.
 * @param {string} pattern - wildcard pattern.
 * @returns {Array<Object>} matching records sorted by name.
 */
export function wildcardMatch(records, pattern) {
  const re = wildcardToRegExp(pattern);
  return (records || [])
    .filter((r) => r && r.name && re.test(String(r.name).replace(/\.$/, '')))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

/**
 * Idea 00179 — Deep label-pattern discovery.
 *
 * Returns names under `domain` with at least minDepth labels, grouped by
 * their "pattern signature" (labels with digits replaced by '#'), which
 * reveals auto-generated naming conventions (e.g. "host-#.dc-#.example.com").
 *
 * @param {Array<Object>} records
 * @param {string} domain
 * @param {{ minDepth?: number }} [opts]
 * @returns {Array<{ pattern: string, depth: number, names: Array<string>, count: number }>}
 */
export function deepLabelPatterns(records, domain, opts = {}) {
  const minDepth = opts.minDepth ?? 4;
  const apex = String(domain).toLowerCase().replace(/\.$/, '');
  const groups = new Map();
  for (const r of records || []) {
    if (!r || !r.name) continue;
    const name = String(r.name).toLowerCase().replace(/\.$/, '');
    if (name !== apex && !name.endsWith(`.${apex}`)) continue;
    const labels = name.split('.');
    if (labels.length < minDepth) continue;
    const signature = labels.map((l) => l.replace(/\d+/g, '#')).join('.');
    if (!groups.has(signature)) groups.set(signature, new Set());
    groups.get(signature).add(name);
  }
  return [...groups.entries()]
    .map(([pattern, names]) => ({
      pattern,
      depth: pattern.split('.').length,
      names: [...names].sort(),
      count: names.size,
    }))
    .sort((a, b) => b.count - a.count || b.depth - a.depth);
}

/**
 * Idea 00179 — First-seen burst analysis.
 *
 * Flags days on which an unusual number of new names appeared under the
 * domain — bursts often mark infrastructure rollouts worth investigating.
 *
 * @param {Array<Object>} records
 * @param {string} domain
 * @param {{ stddevFactor?: number }} [opts]
 * @returns {Array<{ day: string, newNames: number, names: Array<string> }>}
 */
export function burstAnalysis(records, domain, opts = {}) {
  const factor = opts.stddevFactor ?? 2;
  const apex = String(domain).toLowerCase().replace(/\.$/, '');
  const byDay = new Map();
  for (const r of records || []) {
    if (!r || !r.name || !r.firstSeen) continue;
    const name = String(r.name).toLowerCase().replace(/\.$/, '');
    if (name !== apex && !name.endsWith(`.${apex}`)) continue;
    const ms = Date.parse(r.firstSeen);
    if (Number.isNaN(ms)) continue;
    const day = new Date(ms).toISOString().slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, new Set());
    byDay.get(day).add(name);
  }
  const days = [...byDay.entries()].map(([day, names]) => ({ day, names: [...names].sort() }));
  if (days.length < 2) return [];
  const counts = days.map((d) => d.names.length);
  const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
  const variance = counts.reduce((a, b) => a + (b - mean) ** 2, 0) / counts.length;
  const threshold = mean + factor * Math.sqrt(variance);
  return days
    .filter((d) => d.names.length > threshold)
    .map((d) => ({ day: d.day, newNames: d.names.length, names: d.names }))
    .sort((a, b) => b.newNames - a.newNames);
}
