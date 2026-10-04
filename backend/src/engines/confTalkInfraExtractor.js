/**
 * confTalkInfraExtractor.js — Conference-talk and slide infrastructure-disclosure extractor.
 *
 * Security and platform engineers present architecture at conferences: slide
 * decks name regions, clusters, internal services, and sometimes literal
 * hostnames or dashboard URLs. This module extracts infrastructure disclosures
 * from talk transcripts and slide text supplied by the operator — hostnames,
 * URLs, infra terms, and architecture-mention sentences with evidence.
 *
 * Defensive framing: analyzes operator-provided text only; findings are
 * leads for authorized verification, never conclusions.
 */

const HOSTNAME_RE = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b/gi;
const URL_RE = /https?:\/\/([a-z0-9.-]+)(?::\d+)?(?:\/[^\s"'<>]*)?/gi;
const IP_RE = /\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b/g;

const INFRA_TERMS = [
  'kubernetes', 'k8s', 'docker', 'terraform', 'ansible', 'jenkins', 'argocd',
  'kafka', 'rabbitmq', 'redis', 'postgres', 'mysql', 'mongodb', 'cassandra',
  'elasticsearch', 'snowflake', 'bigquery', 'redshift', 'datadog', 'splunk',
  'grafana', 'prometheus', 'vault', 'consul', 'istio', 'envoy', 'nginx',
  'haproxy', 'aws', 'azure', 'gcp', 'cloudfront', 'route53', 'vpc', 'eks',
  'ecs', 'fargate', 'lambda', 'sqs', 'sns', 'dynamodb', 'rds', 'aurora',
  'active directory', 'ldap', 'siem', 'soar', 'waf', 'cdn', 'service mesh',
];

const ARCHITECTURE_CUES = [
  /\barchitectures?\b/i,
  /\bdiagram\b/i,
  /\bdata\s+flow\b/i,
  /\bdeployment\b/i,
  /\btopolog\w*\b/i,
  /\bcluster\b/i,
  /\bmulti-?region\b/i,
  /\bdisaster\s+recovery\b/i,
  /\bhigh\s+availability\b/i,
];

function snippet(text, index, radius = 80) {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

/**
 * Extract hostnames from talk/slide text (deduped, with evidence).
 */
export function extractTalkHostnames(text) {
  const t = String(text || '');
  const found = new Map();
  HOSTNAME_RE.lastIndex = 0;
  let m;
  while ((m = HOSTNAME_RE.exec(t)) !== null) {
    const host = m[0].toLowerCase();
    if (host.includes('@') || /^\d/.test(host.split('.').pop())) continue;
    if (!found.has(host)) found.set(host, snippet(t, m.index));
  }
  return [...found.entries()].map(([host, evidence]) => ({ host, evidence }));
}

/**
 * Extract URLs and their host parts.
 */
export function extractTalkUrls(text) {
  const t = String(text || '');
  const found = new Map();
  URL_RE.lastIndex = 0;
  let m;
  while ((m = URL_RE.exec(t)) !== null) {
    const host = m[1].toLowerCase();
    if (!found.has(m[0])) found.set(m[0], { host, evidence: snippet(t, m.index) });
  }
  return [...found.entries()].map(([url, v]) => ({ url, host: v.host, evidence: v.evidence }));
}

/**
 * Extract literal IP addresses (internal ranges are especially interesting).
 */
export function extractTalkIps(text) {
  const t = String(text || '');
  const found = new Map();
  IP_RE.lastIndex = 0;
  let m;
  while ((m = IP_RE.exec(t)) !== null) {
    if (!found.has(m[0])) {
      const internal = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(m[0]);
      found.set(m[0], { internal, evidence: snippet(t, m.index) });
    }
  }
  return [...found.entries()].map(([ip, v]) => ({ ip, internal: v.internal, evidence: v.evidence }));
}

/**
 * Extract infrastructure terms mentioned in the talk.
 */
export function extractTalkInfraTerms(text) {
  const t = String(text || '');
  const low = t.toLowerCase();
  const found = [];
  for (const term of INFRA_TERMS) {
    const idx = low.indexOf(term);
    if (idx !== -1) found.push({ term, evidence: snippet(t, idx) });
  }
  return found;
}

/**
 * Pull sentences that describe architecture — the highest-signal context.
 */
export function extractArchitectureMentions(text) {
  const t = String(text || '');
  const sentences = t.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length > 20);
  const mentions = [];
  for (const s of sentences) {
    const cue = ARCHITECTURE_CUES.find((re) => re.test(s));
    if (cue) {
      const terms = INFRA_TERMS.filter((term) => s.toLowerCase().includes(term));
      mentions.push({ sentence: s.slice(0, 300), matchedCue: String(cue), infraTerms: terms });
    }
  }
  return mentions.slice(0, 25);
}

/**
 * Full extraction pipeline for one talk transcript / slide dump.
 * @param {{title?: string, speaker?: string, event?: string, text: string}} talk
 */
export function mineTalk(talk = {}) {
  const text = String(talk.text || '');
  return {
    title: talk.title || null,
    speaker: talk.speaker || null,
    event: talk.event || null,
    hostnames: extractTalkHostnames(text),
    urls: extractTalkUrls(text),
    ips: extractTalkIps(text),
    infraTerms: extractTalkInfraTerms(text),
    architectureMentions: extractArchitectureMentions(text),
  };
}

export const CONF_TALK_INFRA_EXTRACTOR = {
  extractTalkHostnames,
  extractTalkUrls,
  extractTalkIps,
  extractTalkInfraTerms,
  extractArchitectureMentions,
  mineTalk,
};

export default CONF_TALK_INFRA_EXTRACTOR;
