/**
 * conferenceTalkIntel.js — conference-talk infrastructure disclosure engine.
 *
 * @idea 0320 — Conference-talk infrastructure disclosure: extract architecture
 *   diagrams and hostnames from the org's conference talks and slides.
 *
 * Pure functions: callers obtain talk transcripts / slide text themselves
 * (public recordings, conference proceedings — respecting terms of service)
 * and pass the text in. No live HTTP here.
 *
 * Defensive framing: conference talks are public by design; extracting the
 * infrastructure details an org already disclosed helps an authorized hunter
 * aim recon the same way a human would after watching the talks.
 */

const HOSTNAME_RE = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b/gi;
const URL_RE = /https?:\/\/[^\s"'<>)]+/gi;

const CLOUD_PROVIDERS = [
  { name: 'aws', re: /\baws\b|amazon web services|ec2\b|s3\b|eks\b|lambda\b|cloudfront|route\s*53/i },
  { name: 'azure', re: /\bazure\b|microsoft azure|aks\b/i },
  { name: 'gcp', re: /\bgcp\b|google cloud|gke\b|bigquery/i },
  { name: 'cloudflare', re: /cloudflare/i },
  { name: 'akamai', re: /akamai/i },
  { name: 'fastly', re: /fastly/i },
  { name: 'digitalocean', re: /digital\s*ocean/i },
];

const ARCH_PATTERNS = [
  { kind: 'deployment', re: /\bdeployed?\s+(?:to|on|in|onto)\s+([A-Z][A-Za-z0-9+.#]*(?:\s+[A-Z][A-Za-z0-9+.#]*){0,2})/g },
  { kind: 'runs-on', re: /\bruns?\s+on\s+([A-Z][A-Za-z0-9+.#]*(?:\s+[A-Z][A-Za-z0-9+.#]*){0,2})/g },
  { kind: 'data-flow', re: /\b([A-Z][A-Za-z0-9+.#]*)\s+(?:sends?|pushes?|publishes?|streams?|writes?)\s+(?:to|into)\s+([A-Z][A-Za-z0-9+.#]*(?:\s+[A-Z][A-Za-z0-9+.#]*){0,2})/g },
  { kind: 'backed-by', re: /\bbacked\s+by\s+([A-Z][A-Za-z0-9+.#]*(?:\s+[A-Z][A-Za-z0-9+.#]*){0,2})/g },
  { kind: 'component', re: /\bour\s+([A-Z][A-Za-z0-9+.#-]*(?:\s+[A-Z][A-Za-z0-9+.#-]*){0,2})\s+(?:service|cluster|platform|pipeline|gateway|mesh)/g },
];

/**
 * Extract hostnames mentioned in a talk transcript / slide text.
 * @param {string} text
 * @returns {string[]}
 */
export function extractTalkHostnames(text) {
  const found = new Set();
  for (const m of String(text || '').matchAll(HOSTNAME_RE)) {
    const host = m[0].toLowerCase();
    if (host.split('.').length >= 2 && !/\.(png|jpe?g|gif|svg|mp4|pdf)$/.test(host)) {
      found.add(host);
    }
  }
  return [...found].sort();
}

/**
 * Extract URLs mentioned in the text.
 * @param {string} text
 * @returns {string[]}
 */
export function extractTalkUrls(text) {
  const found = new Set();
  for (const m of String(text || '').matchAll(URL_RE)) {
    found.add(m[0].replace(/[.,;:!?]+$/, ''));
  }
  return [...found].sort();
}

/**
 * Detect named cloud providers / CDN vendors in the text.
 * @param {string} text
 * @returns {string[]}
 */
export function extractCloudProviders(text) {
  const t = String(text || '');
  return CLOUD_PROVIDERS.filter((p) => p.re.test(t)).map((p) => p.name);
}

/**
 * Extract architecture statements: deployments, data flows, components.
 * @param {string} text
 * @returns {{kind: string, detail: string}[]}
 */
export function extractArchitectureStatements(text) {
  const found = [];
  const seen = new Set();
  const t = String(text || '');
  for (const { kind, re } of ARCH_PATTERNS) {
    re.lastIndex = 0;
    for (const m of t.matchAll(re)) {
      const detail = (m[2] ? `${m[1]} -> ${m[2]}` : m[1]).trim().replace(/[.,;:]+$/, '');
      const key = `${kind}|${detail}`;
      if (detail.length >= 2 && detail.length <= 80 && !seen.has(key)) {
        seen.add(key);
        found.push({ kind, detail });
      }
    }
  }
  return found;
}

/**
 * Assess how much infrastructure detail a talk discloses (for prioritising
 * which talks an authorized hunter should review first).
 * @param {{hostnames: string[], urls: string[], providers: string[], statements: {kind: string}[]}} intel
 * @returns {{score: number, level: 'high'|'medium'|'low', breakdown: Record<string, number>}}
 */
export function scoreDisclosureDepth(intel = {}) {
  const breakdown = {
    hostnames: (intel?.hostnames || []).length,
    urls: (intel?.urls || []).length,
    providers: (intel?.providers || []).length,
    statements: (intel?.statements || []).length,
  };
  const score = Math.min(
    100,
    breakdown.hostnames * 12 + breakdown.urls * 4 + breakdown.providers * 6 + breakdown.statements * 3
  );
  const level = score >= 60 ? 'high' : score >= 25 ? 'medium' : 'low';
  return { score, level, breakdown };
}

/**
 * Full extraction pass over one talk transcript / slide deck text.
 * @param {{id?: string, title?: string, event?: string, text: string}} talk
 * @returns {{id: string, title: string, event: string, hostnames: string[], urls: string[], providers: string[], statements: {kind: string, detail: string}[], disclosure: ReturnType<typeof scoreDisclosureDepth>}}
 */
export function mineConferenceTalk(talk = {}) {
  const text = String(talk?.text || '');
  const intel = {
    id: String(talk?.id || ''),
    title: String(talk?.title || ''),
    event: String(talk?.event || ''),
    hostnames: extractTalkHostnames(text),
    urls: extractTalkUrls(text),
    providers: extractCloudProviders(text),
    statements: extractArchitectureStatements(text),
  };
  return { ...intel, disclosure: scoreDisclosureDepth(intel) };
}

/**
 * Aggregate intel across many talks, ranking hostnames by how many talks
 * disclosed them.
 * @param {ReturnType<typeof mineConferenceTalk>[]} mined
 * @returns {{hostnames: {value: string, talks: number}[], providers: string[], topStatements: {kind: string, detail: string}[]}}
 */
export function aggregateTalkIntel(mined = []) {
  const counts = new Map();
  const providers = new Set();
  const statements = [];
  for (const m of mined || []) {
    for (const h of new Set(m?.hostnames || [])) counts.set(h, (counts.get(h) || 0) + 1);
    for (const p of m?.providers || []) providers.add(p);
    for (const s of m?.statements || []) statements.push(s);
  }
  return {
    hostnames: [...counts.entries()]
      .map(([value, talks]) => ({ value, talks }))
      .sort((a, b) => b.talks - a.talks || a.value.localeCompare(b.value)),
    providers: [...providers].sort(),
    topStatements: statements.slice(0, 100),
  };
}
