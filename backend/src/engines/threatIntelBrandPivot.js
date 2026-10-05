/**
 * threatIntelBrandPivot.js — threat-intel brand-mention pivoting engine.
 *
 * Covers idea-bank item 0308:
 *  - 0308 Threat-intel brand-mention pivoting — pivot on threat-intel
 *    reports mentioning the brand to find attacker domains for blocklist
 *    and takedown context.
 *
 * Pure functions only: the engine scans threat-intel report text/objects
 * (supplied by the caller) for brand mentions, extracts attacker
 * indicators-of-compromise near those mentions, and builds a pivot graph
 * for blocklist/takedown triage. No network calls here.
 */

const DOMAIN_RE = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,}|xn--[a-z0-9-]+)\b/gi;
const URL_RE = /\bhttps?:\/\/[^\s"'`<>(){}[\]]+/gi;
const IP_RE = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d{1,2})\.){3}(?:25[0-5]|2[0-4]\d|1?\d{1,2})\b/g;
const SHA_RE = /\b[a-f0-9]{64}\b/gi;
const MD5_RE = /\b[a-f0-9]{32}\b/gi;
const EMAIL_RE = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi;

const ATTACK_KEYWORDS = [
  'phishing', 'malware', 'ransomware', 'trojan', 'botnet', 'c2', 'command and control',
  'exfiltrat', 'credential', 'spoof', 'impersonat', 'squatt', 'typosquatt',
  'takedown', 'blocklist', 'blacklist', 'threat actor', 'campaign', 'kit',
];

/**
 * Normalize report input into a list of {id, title, text} records.
 * @param {(string|{id?: string, title?: string, text?: string, body?: string})[]} reports
 * @returns {{id: string, title: string, text: string}[]}
 */
export function normalizeReports(reports = []) {
  return (reports || []).map((r, i) => {
    if (typeof r === 'string') {
      return { id: `report-${i + 1}`, title: '', text: r };
    }
    return {
      id: String(r?.id || `report-${i + 1}`),
      title: String(r?.title || ''),
      text: String(r?.text ?? r?.body ?? ''),
    };
  });
}

/**
 * Score brand relevance of a report: brand token hits plus proximity to
 * attack keywords (a brand mention inside a phishing write-up scores far
 * higher than a passing marketing mention).
 *
 * @param {string} text Report text
 * @param {string[]} brandTokens
 * @returns {{brandMentions: number, attackKeywordHits: string[], score: number}}
 */
export function scoreReportBrandRelevance(text, brandTokens = []) {
  const lower = String(text || '').toLowerCase();
  const tokens = (brandTokens || []).map((t) => String(t || '').toLowerCase()).filter(Boolean);
  let brandMentions = 0;
  for (const t of tokens) {
    const re = new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    brandMentions += (lower.match(re) || []).length;
  }
  const attackKeywordHits = ATTACK_KEYWORDS.filter((k) => lower.includes(k));
  const score = Math.min(100, brandMentions * 15 + attackKeywordHits.length * 10);
  return { brandMentions, attackKeywordHits, score };
}

/**
 * Extract indicators-of-compromise from a report body.
 *
 * @param {string} text Report text
 * @param {string[]} brandTokens Brand tokens for attacker-domain flagging
 * @returns {{
 *   domains: {value: string, brandLike: boolean}[],
 *   ips: string[], urls: string[], hashes: string[], emails: string[]
 * }}
 */
export function extractReportIocs(text, brandTokens = []) {
  const body = String(text || '');
  const tokens = (brandTokens || []).map((t) => String(t || '').toLowerCase()).filter(Boolean);

  const collect = (re) => {
    const out = new Set();
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(body)) !== null) out.add(m[0].toLowerCase());
    return [...out];
  };

  const domains = collect(DOMAIN_RE)
    .filter((d) => !d.endsWith('.example') && !d.includes('w3.org'))
    .map((value) => ({ value, brandLike: tokens.some((t) => t && value.includes(t)) }))
    .sort((a, b) => Number(b.brandLike) - Number(a.brandLike) || a.value.localeCompare(b.value));

  return {
    domains,
    ips: collect(IP_RE).sort(),
    urls: collect(URL_RE).sort(),
    hashes: [...collect(SHA_RE), ...collect(MD5_RE)].sort(),
    emails: collect(EMAIL_RE).sort(),
  };
}

/**
 * Pivot across threat-intel reports: find brand-relevant reports, pull
 * their IoCs, and link reports that share attacker infrastructure.
 *
 * @param {(string|{id?: string, title?: string, text?: string, body?: string})[]} reports Caller-supplied reports
 * @param {string[]} brandTokens
 * @param {{minScore?: number}} [options]
 * @returns {{
 *   relevantReports: {id: string, title: string, score: number, brandMentions: number, attackKeywords: string[], iocs: ReturnType<typeof extractReportIocs>}[],
 *   pivotEdges: {from: string, to: string, shared: string[]}[],
 *   attackerDomains: {domain: string, reports: string[], brandLike: boolean}[]
 * }}
 */
export function pivotBrandThreatIntel(reports = [], brandTokens = [], options = {}) {
  const minScore = options.minScore ?? 20;
  const normalized = normalizeReports(reports);
  const relevantReports = [];

  for (const r of normalized) {
    const full = `${r.title}\n${r.text}`;
    const { brandMentions, attackKeywordHits, score } = scoreReportBrandRelevance(full, brandTokens);
    if (brandMentions === 0 || score < minScore) continue;
    relevantReports.push({
      id: r.id,
      title: r.title,
      score,
      brandMentions,
      attackKeywords: attackKeywordHits,
      iocs: extractReportIocs(r.text, brandTokens),
    });
  }

  relevantReports.sort((a, b) => b.score - a.score);

  // Pivot edges: reports sharing domains or IPs are probably one campaign.
  const pivotEdges = [];
  for (let i = 0; i < relevantReports.length; i++) {
    for (let j = i + 1; j < relevantReports.length; j++) {
      const a = relevantReports[i];
      const b = relevantReports[j];
      const aSet = new Set([...a.iocs.domains.map((d) => d.value), ...a.iocs.ips]);
      const shared = [...new Set([...b.iocs.domains.map((d) => d.value), ...b.iocs.ips])].filter((v) => aSet.has(v));
      if (shared.length) {
        pivotEdges.push({ from: a.id, to: b.id, shared: shared.sort() });
      }
    }
  }

  // Attacker domains: brand-like domains seen across relevant reports.
  const domainReports = new Map();
  for (const r of relevantReports) {
    for (const d of r.iocs.domains) {
      if (!d.brandLike) continue;
      if (!domainReports.has(d.value)) domainReports.set(d.value, { domain: d.value, reports: new Set(), brandLike: true });
      domainReports.get(d.value).reports.add(r.id);
    }
  }
  const attackerDomains = [...domainReports.values()]
    .map((d) => ({ domain: d.domain, reports: [...d.reports].sort(), brandLike: d.brandLike }))
    .sort((a, b) => b.reports.length - a.reports.length || a.domain.localeCompare(b.domain));

  return { relevantReports, pivotEdges, attackerDomains };
}

/**
 * Build a blocklist/takedown candidate list from pivot results: attacker
 * domains seen in multiple brand-relevant reports rank highest.
 *
 * @param {ReturnType<typeof pivotBrandThreatIntel>} pivot
 * @returns {{domain: string, reportCount: number, priority: 'high'|'medium'|'low', context: string}[]}
 */
export function buildTakedownCandidates(pivot) {
  return (pivot?.attackerDomains || []).map((d) => ({
    domain: d.domain,
    reportCount: d.reports.length,
    priority: d.reports.length >= 3 ? 'high' : d.reports.length === 2 ? 'medium' : 'low',
    context: `mentioned as brand-impersonating infrastructure in ${d.reports.length} threat-intel report(s): ${d.reports.join(', ')}`,
  }));
}
