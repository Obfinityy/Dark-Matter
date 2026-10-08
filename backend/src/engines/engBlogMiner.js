/**
 * engBlogMiner.js — Engineering-blog endpoint disclosure miner.
 *
 * Parses engineering blog posts (HTML/Markdown) for infrastructure intel that
 * teams accidentally disclose in write-ups:
 *  - API endpoints and full URLs mentioned in prose or code blocks
 *  - Hostnames / internal service names from architecture descriptions
 *  - Technology and architecture signals (load balancers, queues, datastores)
 *
 * Pure functions: takes fetched page text, returns structured intel.
 * Passive recon only — it parses text the organization published itself.
 */

const HOST_RE = /\b(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,})(?::\d{1,5})?\b/gi;
const API_PATH_RE =
  /(?:^|[\s"'`(\[])(https?:\/\/[^\s"'`)\]]+)?(\/[A-Za-z0-9][A-Za-z0-9._~!$&'()*+,;=:@%/+-]*(?:\/[A-Za-z0-9._~!$&'()*+,;=:@%/+-]*)+)/g;
const CODE_FENCE_RE = /```(?:\w+)?\n([\s\S]*?)```/g;
const INLINE_CODE_RE = /`([^`]{3,200})`/g;
const TECH_SIGNALS = [
  { name: 'Kubernetes', re: /\bk8s\b|kubernetes|kubectl/i },
  { name: 'AWS', re: /\baws\b|amazon web services|ec2\b|s3\b|lambda|cloudfront|elb|alb\b/i },
  { name: 'GCP', re: /\bgcp\b|google cloud|gke\b|bigquery|cloud run/i },
  { name: 'Azure', re: /\bazure\b|aks\b|cosmos/i },
  { name: 'Kafka', re: /\bkafka\b/i },
  { name: 'Redis', re: /\bredis\b/i },
  { name: 'PostgreSQL', re: /\bpostgres\b/i },
  { name: 'MongoDB', re: /\bmongo(db)?\b/i },
  { name: 'Elasticsearch', re: /\belasticsearch\b/i },
  { name: 'GraphQL', re: /\bgraphql\b/i },
  { name: 'gRPC', re: /\bgrpc\b/i },
  { name: 'Envoy', re: /\benvoy\b/i },
  { name: 'Istio', re: /\bistio\b/i },
  { name: 'Terraform', re: /\bterraform\b/i },
  { name: 'Docker', re: /\bdocker\b/i },
  { name: 'Nginx', re: /\bnginx\b/i },
];

const GENERIC_HOSTS = new Set([
  'github.com',
  'www.github.com',
  'gist.github.com',
  'raw.githubusercontent.com',
  'medium.com',
  'towardsdatascience.com',
  'blog.google',
  'engineering.fb.com',
  'netflixtechblog.com',
  'stackoverflow.com',
  'youtube.com',
  'www.youtube.com',
  'twitter.com',
  'x.com',
  'linkedin.com',
  'www.linkedin.com',
  'w3.org',
  'developer.mozilla.org',
  'docs.google.com',
  'slideshare.net',
]);

/** Collect code-ish regions (fences + inline code) which are highest value. */
export function extractCodeRegions(text = '') {
  const regions = [];
  let m;
  CODE_FENCE_RE.lastIndex = 0;
  while ((m = CODE_FENCE_RE.exec(text))) regions.push({ kind: 'fence', text: m[1] });
  INLINE_CODE_RE.lastIndex = 0;
  while ((m = INLINE_CODE_RE.exec(text))) regions.push({ kind: 'inline', text: m[1] });
  return regions;
}

/** Extract candidate hostnames from text, filtering obvious non-targets. */
export function extractHosts(text = '') {
  HOST_RE.lastIndex = 0;
  const seen = new Map();
  let m;
  while ((m = HOST_RE.exec(text))) {
    const host = m[1].toLowerCase();
    if (GENERIC_HOSTS.has(host)) continue;
    if (host === 'example.com' || host.endsWith('.example.com')) continue;
    if (host === 'localhost' || host.endsWith('.local')) continue;
    if (!seen.has(host)) seen.set(host, { host, hits: 0 });
    seen.get(host).hits += 1;
  }
  return [...seen.values()];
}

/** Extract API path-like strings, keeping only ones that look like real routes. */
export function extractApiPaths(text = '') {
  API_PATH_RE.lastIndex = 0;
  const seen = new Map();
  let m;
  while ((m = API_PATH_RE.exec(text))) {
    const full = (m[1] || '') + m[2];
    const path = m[2];
    // Require at least one segment that looks like a resource word, skip bare file names
    if (!/[a-z]{3,}/i.test(path)) continue;
    if (/\.(png|jpg|jpeg|gif|svg|css|ico)$/i.test(path)) continue;
    const key = full.toLowerCase();
    if (!seen.has(key)) seen.set(key, { path: full, resource: m[2], hits: 0 });
    seen.get(key).hits += 1;
  }
  return [...seen.values()];
}

/** Detect infrastructure/technology signals disclosed in the post. */
export function detectArchitectureSignals(text = '') {
  const found = [];
  for (const t of TECH_SIGNALS) {
    if (t.re.test(text)) found.push(t.name);
  }
  return found;
}

/**
 * Mine one engineering blog post for endpoint disclosure intel.
 * @param {object} input
 * @param {string} input.url - post URL (for provenance)
 * @param {string} input.text - full fetched post text (HTML or Markdown)
 * @param {string} [input.org] - organization name (used to flag internal-looking hosts)
 * @returns structured findings with hosts, apiPaths, codeRegions, signals
 */
export function mineBlogPost({ url = '', text = '', org = '' } = {}) {
  if (typeof text !== 'string') throw new TypeError('text must be a string');
  const codeRegions = extractCodeRegions(text);
  const hosts = extractHosts(text);
  const apiPaths = extractApiPaths(text);
  const signals = detectArchitectureSignals(text);

  const orgLower = org.toLowerCase();
  const flaggedHosts = hosts
    .filter(
      h =>
        h.host.includes('internal') ||
        h.host.includes('corp') ||
        h.host.includes('prod') ||
        h.host.includes('staging') ||
        h.host.includes('dev-') ||
        h.host.includes('.svc') ||
        (orgLower && h.host.includes(orgLower))
    )
    .map(h => ({
      ...h,
      confidence: 'high',
      note: 'Looks like internal/org infrastructure disclosed in a public post',
    }));

  return {
    url,
    type: 'Engineering-Blog Endpoint Disclosure',
    confidence: hosts.length || apiPaths.length ? 'medium' : 'low',
    evidence: `${hosts.length} candidate hosts, ${apiPaths.length} API paths, ${codeRegions.length} code regions parsed from post.`,
    hosts: hosts.map(h => h.host),
    flaggedHosts,
    apiPaths: apiPaths.map(p => p.path),
    architectureSignals: signals,
    codeRegionCount: codeRegions.length,
  };
}

export const ENG_BLOG_MINER = {
  extractHosts,
  extractApiPaths,
  extractCodeRegions,
  detectArchitectureSignals,
  mineBlogPost,
};
export default ENG_BLOG_MINER;
