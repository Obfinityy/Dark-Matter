/**
 * fofaAssetExpander.js — Fofa rule-based asset expansion.
 *
 * Idea 00386: expand assets using Fofa's fingerprint rules matched against
 * target netblocks.
 *
 * No network calls and no API keys: the module builds Fofa query strings
 * from fingerprint rules (title / header / body / cert / icon-hash style
 * matchers) combined with target netblocks, and correlates operator-supplied
 * Fofa response objects into expanded asset records scored by rule matches.
 */

/** Escape a Fofa query token so quotes and backslashes cannot break syntax. */
function esc(token) {
  return String(token).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * @typedef {Object} FingerprintRule
 * @property {string} name - Rule name, e.g. 'vendor-panel'.
 * @property {'title'|'header'|'body'|'cert'|'icon'|'server'|'app'} field - Fofa field to match.
 * @property {string} value - Match value (substring match).
 * @property {number} [weight] - Scoring weight (default 1).
 */

/**
 * Build Fofa queries for each rule × netblock combination.
 * @param {FingerprintRule[]} rules
 * @param {{cidrs?: string[], ips?: string[], org?: string}} scope
 * @returns {{queries: {label: string, query: string}[]}}
 */
export function buildFofaQueries(rules = [], scope = {}) {
  const { cidrs = [], ips = [], org = '' } = scope;
  const scopeClauses = [...cidrs.map(c => `ip="${esc(c)}"`), ...ips.map(i => `ip="${esc(i)}"`)];
  if (org) scopeClauses.push(`org="${esc(org)}"`);
  const scopePart = scopeClauses.length ? ` && (${scopeClauses.join(' || ')})` : '';

  const queries = [];
  for (const rule of rules) {
    if (!rule || !rule.field || !rule.value) continue;
    queries.push({
      label: rule.name || `${rule.field}-match`,
      query: `${rule.field}="${esc(rule.value)}"${scopePart}`,
    });
  }
  if (!queries.length && scopePart) {
    queries.push({ label: 'scope-only', query: scopePart.replace(/^ && /, '') });
  }
  return { queries };
}

/**
 * Score one Fofa result record against the fingerprint rules.
 * Fofa result shape: {ip, port, host, title, header, cert, server, ...}.
 * @param {object} record
 * @param {FingerprintRule[]} rules
 * @returns {{score: number, matchedRules: string[], confidence: 'high'|'medium'|'low'}}
 */
export function scoreFofaRecord(record = {}, rules = []) {
  let score = 0;
  const matchedRules = [];
  const haystack = {
    title: record.title || '',
    header: record.header || '',
    body: record.body || '',
    cert: record.cert || '',
    icon: String(record.icon_hash ?? record.icon ?? ''),
    server: record.server || '',
    app: record.app || '',
  };
  for (const rule of rules) {
    if (!rule || !rule.field) continue;
    const hay = (haystack[rule.field] || '').toLowerCase();
    const needle = String(rule.value || '').toLowerCase();
    if (needle && hay.includes(needle)) {
      score += rule.weight ?? 1;
      matchedRules.push(rule.name || `${rule.field}:${rule.value}`);
    }
  }
  const confidence = score >= 4 ? 'high' : score >= 2 ? 'medium' : 'low';
  return { score, matchedRules, confidence };
}

/**
 * Correlate a batch of Fofa results into expanded assets.
 * @param {object[]} records - Raw Fofa result objects.
 * @param {FingerprintRule[]} rules
 * @param {{minScore?: number}} [options]
 */
export function expandFofaAssets(records = [], rules = [], options = {}) {
  const { minScore = 1 } = options;
  const assets = [];
  for (const rec of records) {
    if (!rec || !rec.ip) continue;
    const { score, matchedRules, confidence } = scoreFofaRecord(rec, rules);
    if (score < minScore) continue;
    assets.push({
      kind: 'asset',
      id: `fofa:${rec.ip}:${rec.port || 0}`,
      ip: rec.ip,
      port: rec.port ?? null,
      host: rec.host || null,
      title: rec.title || null,
      server: rec.server || null,
      matchedRules,
      score,
      confidence,
      evidence: `Fofa record matched ${matchedRules.length} fingerprint rule(s): ${matchedRules.join(', ')}.`,
    });
  }
  assets.sort((a, b) => b.score - a.score);
  const byIp = new Map();
  for (const a of assets) {
    if (!byIp.has(a.ip)) byIp.set(a.ip, []);
    byIp.get(a.ip).push(a);
  }
  return {
    assets,
    byIp: [...byIp.entries()].map(([ip, items]) => ({
      ip,
      count: items.length,
      bestScore: items[0].score,
    })),
    stats: {
      records: records.length,
      expanded: assets.length,
      highConfidence: assets.filter(a => a.confidence === 'high').length,
      distinctIps: byIp.size,
    },
  };
}

/**
 * Build a report finding from the expansion result.
 * @param {ReturnType<typeof expandFofaAssets>} result
 */
export function fofaFinding(result) {
  return {
    title: `Fofa asset expansion — ${result.stats.expanded} asset(s) across ${result.stats.distinctIps} IP(s)`,
    severity: result.stats.highConfidence ? 'Low' : 'Info',
    confidence: result.stats.expanded >= 3 ? 'high' : 'medium',
    stats: result.stats,
    topAssets: result.assets.slice(0, 15).map(a => ({
      ip: a.ip,
      port: a.port,
      title: a.title,
      score: a.score,
      confidence: a.confidence,
    })),
    evidence:
      `${result.stats.records} Fofa record(s) evaluated; ` +
      `${result.stats.expanded} passed the rule threshold; ` +
      `${result.stats.highConfidence} high-confidence match(es).`,
  };
}

export const FOFA_ASSET_EXPANDER = {
  buildFofaQueries,
  scoreFofaRecord,
  expandFofaAssets,
  fofaFinding,
};
export default FOFA_ASSET_EXPANDER;
