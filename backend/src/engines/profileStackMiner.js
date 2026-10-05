/**
 * profileStackMiner.js — Public-profile stack-disclosure mining.
 *
 * Engineers describe their work on public professional profiles: the internal
 * systems they maintain, the platforms they migrated to, the dashboards they
 * built. This module scans profile text supplied by the operator for named
 * internal systems and stack disclosures that hint at hostnames — a standard
 * OSINT step in authorized engagements.
 *
 * Defensive framing: only analyzes text the operator provides. Findings are
 * candidate names for further authorized verification, never conclusions.
 */

const STACK_KEYWORDS = [
  'kubernetes', 'docker', 'terraform', 'ansible', 'jenkins', 'gitlab', 'github',
  'aws', 'azure', 'gcp', 'kafka', 'redis', 'postgres', 'mysql', 'mongodb',
  'elasticsearch', 'snowflake', 'datadog', 'splunk', 'grafana', 'prometheus',
  'vault', 'okta', 'auth0', 'cloudflare', 'akamai', 'salesforce', 'servicenow',
  'workday', 'tableau', 'looker', 'airflow', 'spark', 'flink', 's3', 'ec2',
  'lambda', 'eks', 'gke', 'istio', 'pagerduty', 'jira', 'confluence',
];

const DISCLOSURE_PATTERNS = [
  { name: 'maintains-system', re: /\b(?:maintain(?:s|ed|ing)?|own(?:s|ed|ing)?|built|develop(?:s|ed|ing)?)\s+(?:our\s+|the\s+)?internal\s+([A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+){0,2})/gi },
  { name: 'migrated-to', re: /\bmigrat(?:ed|ing|ion)\s+(?:from\s+\S+\s+)?to\s+([A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+){0,1})/gi },
  { name: 'named-platform', re: /\bplatform\s+(?:called\s+|named\s+)?([A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+){0,1})/gi },
  { name: 'named-service', re: /\bservice\s+(?:called\s+|named\s+)?([A-Z][A-Za-z0-9]{3,})/gi },
  { name: 'quoted-system', re: /[`"']([A-Z][A-Za-z0-9]{3,}(?:\s+[A-Z][A-Za-z0-9]+){0,2})[`"']/g },
  { name: 'team-owns', re: /\bteam\s+(?:owns|maintains)\s+([A-Z][A-Za-z0-9]+(?:\s+[A-Z][A-Za-z0-9]+){0,1})/gi },
];

const HOSTLIKE_RE = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:internal|corp|local|lan|intranet|private)\b/gi;

function snippet(text, index, radius = 70) {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

/**
 * Extract stack keywords mentioned in profile text.
 */
export function extractStackKeywords(text) {
  const t = String(text || '');
  const low = t.toLowerCase();
  const found = [];
  for (const kw of STACK_KEYWORDS) {
    const idx = low.indexOf(kw);
    if (idx !== -1) found.push({ keyword: kw, evidence: snippet(t, idx) });
  }
  return found;
}

/**
 * Extract named internal systems via disclosure patterns.
 */
export function extractNamedSystems(text) {
  const t = String(text || '');
  const found = new Map();
  for (const { name, re } of DISCLOSURE_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(t)) !== null) {
      // Keep only capitalized words: the /i flag is for the lead-in verbs,
      // but captured system names must genuinely be proper nouns.
      const system = m[1].split(/\s+/).filter((w) => /^[A-Z]/.test(w)).join(' ').trim();
      if (system.length < 3) continue;
      const key = `${name}:${system.toLowerCase()}`;
      if (!found.has(key)) {
        found.set(key, { pattern: name, system, evidence: snippet(t, m.index) });
      }
    }
  }
  return [...found.values()];
}

/**
 * Extract host-like internal names (e.g. metrics.internal, vpn.corp).
 */
export function extractHostlikeNames(text) {
  const t = String(text || '');
  const found = new Map();
  HOSTLIKE_RE.lastIndex = 0;
  let m;
  while ((m = HOSTLIKE_RE.exec(t)) !== null) {
    const host = m[0].toLowerCase();
    if (!found.has(host)) found.set(host, snippet(t, m.index));
  }
  return [...found.entries()].map(([host, evidence]) => ({ host, evidence }));
}

/**
 * Mine one public profile text for stack disclosures.
 * @param {{name?: string, headline?: string, text: string}} profile
 */
export function mineProfile(profile = {}) {
  const text = String(profile.text || '');
  return {
    name: profile.name || null,
    headline: profile.headline || null,
    stackKeywords: extractStackKeywords(text),
    namedSystems: extractNamedSystems(text),
    hostlikeNames: extractHostlikeNames(text),
  };
}

/**
 * Convert mined named systems into hostname guesses for a target domain.
 * @param {{namedSystems: {system: string}[], hostlikeNames: {host: string}[]}} mined
 * @param {string} domain
 */
export function systemsToHostGuesses(mined, domain = '') {
  const base = String(domain || '').toLowerCase().replace(/\.$/, '');
  const guesses = new Set();
  for (const s of mined?.namedSystems || []) {
    const slug = String(s.system || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (slug.length >= 3) {
      guesses.add(slug);
      guesses.add(`${slug}-internal`);
    }
  }
  for (const h of mined?.hostlikeNames || []) {
    guesses.add(h.host);
  }
  const list = [...guesses];
  if (!base) return list;
  return list.map((g) => (g.includes('.') ? g : `${g}.${base}`));
}

export const PROFILE_STACK_MINER = {
  extractStackKeywords,
  extractNamedSystems,
  extractHostlikeNames,
  mineProfile,
  systemsToHostGuesses,
};

export default PROFILE_STACK_MINER;
