/**
 * jobPostingHostMiner.js — Job-posting tech-stack and host mining.
 *
 * Job descriptions routinely name the exact infrastructure engineers will
 * touch: internal tool hostnames, SaaS platforms, CI/CD systems, cloud
 * accounts, and on-call tooling. This module extracts hostnames, named tools,
 * and infrastructure hints from job-posting text supplied by the operator,
 * turning hiring pages into an authorized reconnaissance source.
 *
 * Defensive framing: analyzes text the operator provides (their own target's
 * public postings). No scraping is performed by this module.
 */

const HOSTNAME_RE = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|net|org|io|dev|cloud|internal|corp|local|ai|co|app|tech|systems|infra)\b/gi;

const KNOWN_TOOLS = [
  'jenkins', 'circleci', 'travis', 'github actions', 'gitlab ci', 'teamcity', 'bamboo',
  'kubernetes', 'k8s', 'docker', 'terraform', 'ansible', 'puppet', 'chef', 'pulumi',
  'jira', 'confluence', 'notion', 'slack', 'pagerduty', 'opsgenie', 'datadog',
  'new relic', 'splunk', 'elk', 'grafana', 'prometheus', 'sentry', 'snowflake',
  'redshift', 'bigquery', 'kafka', 'rabbitmq', 'redis', 'postgres', 'postgresql',
  'mysql', 'mongodb', 'elasticsearch', 'cassandra', 'dynamodb', 'vault',
  'okta', 'auth0', 'keycloak', 'aws', 'gcp', 'azure', 'cloudflare', 'akamai',
  'fastly', 'vercel', 'netlify', 'heroku', 'digitalocean', 'argocd', 'flux',
  'istio', 'linkerd', 'consul', 'nomad', 'airflow', 'dbt', 'looker', 'tableau',
];

const INFRA_PHRASES = [
  /microservices?\s+architectures?/i,
  /ci\s*\/\s*cd/i,
  /infrastructure\s+as\s+code/i,
  /multi-?region/i,
  /on-?prem/i,
  /hybrid\s+cloud/i,
  /zero\s+trust/i,
  /service\s+mesh/i,
  /gitops/i,
];

function snippet(text, index, radius = 60) {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

/**
 * Extract fully-qualified hostnames from free text.
 * @param {string} text
 */
export function extractHostnames(text) {
  const t = String(text || '');
  const found = new Map();
  let m;
  HOSTNAME_RE.lastIndex = 0;
  while ((m = HOSTNAME_RE.exec(t)) !== null) {
    const host = m[0].toLowerCase();
    if (!found.has(host)) found.set(host, snippet(t, m.index));
  }
  return [...found.entries()].map(([host, evidence]) => ({ host, evidence }));
}

/**
 * Extract named tools/platforms from a known-tool dictionary.
 * @param {string} text
 */
export function extractToolNames(text) {
  const t = String(text || '');
  const low = t.toLowerCase();
  const found = [];
  for (const tool of KNOWN_TOOLS) {
    const idx = low.indexOf(tool);
    if (idx !== -1) {
      found.push({ tool, evidence: snippet(t, idx) });
    }
  }
  return found;
}

/**
 * Extract internal-style tool names: quoted names, backticked names, and
 * CamelCase internal identifiers ("our internal deploy system, Forge").
 * @param {string} text
 */
export function extractInternalToolNames(text) {
  const t = String(text || '');
  const found = new Map();
  const quotedRe = /[`"']([A-Z][A-Za-z0-9]{2,}(?:\s+[A-Z][A-Za-z0-9]+){0,2})[`"']/g;
  let m;
  while ((m = quotedRe.exec(t)) !== null) {
    const name = m[1].trim();
    if (!found.has(name)) found.set(name, snippet(t, m.index));
  }
  const internalRe = /\binternal\s+(?:tool|system|platform|service|dashboard|portal)[,\s]+(?:called\s+|named\s+)?([A-Z][A-Za-z0-9]+)/gi;
  while ((m = internalRe.exec(t)) !== null) {
    const name = m[1].trim();
    if (!/^[A-Z]/.test(name)) continue; // must be a proper noun, not a stray lowercase word
    if (!found.has(name)) found.set(name, snippet(t, m.index));
  }
  return [...found.entries()].map(([name, evidence]) => ({ name, evidence }));
}

/**
 * Extract infrastructure-concept hints (architecture styles, practices).
 * @param {string} text
 */
export function extractInfraHints(text) {
  const t = String(text || '');
  const found = [];
  for (const re of INFRA_PHRASES) {
    const m = t.match(re);
    if (m && m.index !== undefined) {
      found.push({ hint: m[0], evidence: snippet(t, m.index) });
    }
  }
  return found;
}

/**
 * Full mining pipeline for one job posting.
 * @param {{title?: string, company?: string, text: string}} posting
 */
export function mineJobPosting(posting = {}) {
  const text = String(posting.text || '');
  return {
    title: posting.title || null,
    company: posting.company || null,
    hostnames: extractHostnames(text),
    tools: extractToolNames(text),
    internalTools: extractInternalToolNames(text),
    infraHints: extractInfraHints(text),
  };
}

/**
 * Suggest hostname guesses derived from mined internal tool names.
 * e.g. internal tool "Forge" -> forge, forge-internal, internal-forge + domain.
 * @param {{internalTools: {name: string}[]}} mined
 * @param {string} domain
 */
export function toolNamesToHostGuesses(mined, domain = '') {
  const base = String(domain || '').toLowerCase().replace(/\.$/, '');
  const guesses = new Set();
  for (const t of mined?.internalTools || []) {
    const slug = String(t.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (!slug) continue;
    guesses.add(slug);
    guesses.add(`${slug}-internal`);
    guesses.add(`internal-${slug}`);
    guesses.add(`${slug}-tool`);
  }
  const list = [...guesses];
  return base ? list.map((g) => `${g}.${base}`) : list;
}

export const JOB_POSTING_HOST_MINER = {
  extractHostnames,
  extractToolNames,
  extractInternalToolNames,
  extractInfraHints,
  mineJobPosting,
  toolNamesToHostGuesses,
};

export default JOB_POSTING_HOST_MINER;
