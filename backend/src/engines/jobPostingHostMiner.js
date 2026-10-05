/**
 * jobPostingHostMiner.js — job-posting tech-stack host mining engine.
 *
 * @idea 0318 — Job-posting tech-stack host mining: extract hostnames and
 *   internal tool names from job descriptions to predict infrastructure.
 *
 * Pure functions: callers fetch job descriptions themselves (respecting
 * provider rate limits and terms of service) and pass the raw text in.
 * No live HTTP here.
 *
 * Defensive framing: job postings are public documents; mining them for
 * hostnames and tool names informs authorized recon the same way a human
 * hunter reads a careers page before a test.
 */

const HOSTNAME_RE = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b/gi;
const IPV4_RE = /\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b/g;
const URL_RE = /https?:\/\/[^\s"'<>)]+/gi;
const TOOL_MENTION_RE = /\b(?:experience with|hands-on|administer(?:ing)?|maintain(?:ing)?|manag(?:e|ing)|work(?:ing)? with|knowledge of|proficient in|familiar with|expertise in|responsible for)\s+([A-Z][A-Za-z0-9+.#]*(?:\s+[A-Z][A-Za-z0-9+.#]*){0,3})/g;

const TECH_KEYWORDS = [
  'kubernetes', 'docker', 'terraform', 'ansible', 'jenkins', 'gitlab', 'github',
  'aws', 'azure', 'gcp', 'okta', 'splunk', 'datadog', 'grafana', 'prometheus',
  'elasticsearch', 'kafka', 'redis', 'postgres', 'mysql', 'mongodb', 'vault',
  'consul', 'puppet', 'chef', 'circleci', 'travis', 'sonarqube', 'nexus',
  'artifactory', 'pagerduty', 'opsgenie', 'cloudflare', 'fastly', 'akamai',
];

/**
 * Extract fully-qualified hostnames from job-description text.
 * @param {string} text raw job description
 * @returns {string[]} unique lowercased hostnames
 */
export function extractHostnames(text) {
  const found = new Set();
  for (const m of String(text || '').matchAll(HOSTNAME_RE)) {
    const host = m[0].toLowerCase();
    if (host.split('.').length >= 2 && !host.endsWith('.png') && !host.endsWith('.jpg')) {
      found.add(host);
    }
  }
  return [...found].sort();
}

/**
 * Extract IPv4 addresses mentioned in the text.
 * @param {string} text
 * @returns {string[]}
 */
export function extractIpAddresses(text) {
  const found = new Set();
  for (const m of String(text || '').matchAll(IPV4_RE)) found.add(m[0]);
  return [...found].sort();
}

/**
 * Extract URLs mentioned in the text.
 * @param {string} text
 * @returns {string[]}
 */
export function extractUrls(text) {
  const found = new Set();
  for (const m of String(text || '').matchAll(URL_RE)) {
    found.add(m[0].replace(/[.,;:!?]+$/, ''));
  }
  return [...found].sort();
}

/**
 * Extract named internal tools / platforms from requirement phrasing.
 * @param {string} text
 * @returns {string[]} candidate tool names
 */
export function extractInternalTools(text) {
  const found = new Set();
  for (const m of String(text || '').matchAll(TOOL_MENTION_RE)) {
    const name = m[1].trim().replace(/[.,;:]+$/, '');
    if (name.length >= 2 && name.length <= 60) found.add(name);
  }
  return [...found].sort();
}

/**
 * Detect named technology keywords (stack fingerprint).
 * @param {string} text
 * @returns {string[]}
 */
export function extractTechStack(text) {
  const lower = String(text || '').toLowerCase();
  return TECH_KEYWORDS.filter((kw) => lower.includes(kw)).sort();
}

/**
 * Full mining pass over one job description.
 * @param {{id?: string, title?: string, text: string}} posting
 * @returns {{id: string, title: string, hostnames: string[], ips: string[], urls: string[], tools: string[], techStack: string[]}}
 */
export function mineJobPosting(posting = {}) {
  const text = String(posting?.text || '');
  return {
    id: String(posting?.id || ''),
    title: String(posting?.title || ''),
    hostnames: extractHostnames(text),
    ips: extractIpAddresses(text),
    urls: extractUrls(text),
    tools: extractInternalTools(text),
    techStack: extractTechStack(text),
  };
}

/**
 * Aggregate mined postings: dedupe hostnames/tools across a batch and rank
 * by frequency (a hostname named in 5 postings is a stronger lead).
 * @param {ReturnType<typeof mineJobPosting>[]} mined
 * @returns {{hostnames: {value: string, postings: number}[], tools: {value: string, postings: number}[], techStack: string[]}}
 */
export function aggregatePostings(mined = []) {
  const countMap = (getter) => {
    const counts = new Map();
    for (const m of mined || []) {
      for (const v of new Set(getter(m) || [])) {
        counts.set(v, (counts.get(v) || 0) + 1);
      }
    }
    return [...counts.entries()]
      .map(([value, postings]) => ({ value, postings }))
      .sort((a, b) => b.postings - a.postings || a.value.localeCompare(b.value));
  };
  const tech = new Set();
  for (const m of mined || []) for (const t of m?.techStack || []) tech.add(t);
  return {
    hostnames: countMap((m) => m?.hostnames),
    tools: countMap((m) => m?.tools),
    techStack: [...tech].sort(),
  };
}
