/**
 * textProxyDetector.js — Text-only proxy mirror detection.
 *
 * Idea 00889: detect text-only proxy mirrors of a target site (Textise-style
 * text renderers, text-extraction proxies) that republish the site's content
 * through a third-party host — a surface the operator should know about.
 *
 * The module inspects a fetched page's URL, headers, and body for proxy
 * markers (known text-proxy hosts, "text-only version" chrome, proxy
 * attribution banners) and scores the mirror likelihood. All local analysis;
 * no network calls inside the module.
 */

/** Known text-proxy / text-mirror service host patterns. */
export const TEXT_PROXY_HOSTS = [
  { host: /(?:^|\.)textise\.net$/i, name: 'Textise', type: 'text-only-proxy' },
  { host: /(?:^|\.)r\.jina\.ai$/i, name: 'Jina Reader', type: 'text-extraction-proxy' },
  { host: /(?:^|\.)textance\./i, name: 'Textance', type: 'text-api-proxy' },
  { host: /textproxy/i, name: 'TextProxy (generic)', type: 'text-only-proxy' },
  { host: /txtify/i, name: 'Txtify (generic)', type: 'text-only-proxy' },
];

/** Body markers suggesting a text-only proxy rendering. */
export const PROXY_BODY_MARKERS = [
  { re: /text-?only version/i, label: 'text-only-banner', weight: 3 },
  { re: /rendered by|powered by[^<]{0,60}text/i, label: 'proxy-attribution', weight: 2 },
  { re: /viewing a (?:simplified|text)[^<]{0,40}version/i, label: 'simplified-version-note', weight: 3 },
  { re: /<style[^>]*>[^<]{0,200}?text-?only/i, label: 'text-only-css', weight: 1 },
];

/** Response-header markers used by text proxies. */
export const PROXY_HEADER_MARKERS = [
  { name: 'x-text-proxy', label: 'text-proxy-header', weight: 3 },
  { name: 'x-reader-mode', label: 'reader-mode-header', weight: 2 },
  { name: 'x-jina-reader', label: 'jina-reader-header', weight: 3 },
];

/**
 * Check whether a URL belongs to a known text-proxy host.
 * @param {string} url
 * @returns {{name: string, type: string}|null}
 */
export function matchTextProxyHost(url = '') {
  let hostname = '';
  try {
    hostname = new URL(String(url)).hostname.toLowerCase();
  } catch {
    return null;
  }
  for (const entry of TEXT_PROXY_HOSTS) {
    if (entry.host.test(hostname)) return { name: entry.name, type: entry.type };
  }
  return null;
}

/**
 * Score response headers for proxy markers.
 * @param {object} headers - Lower-cased header map is fine; keys are normalized.
 * @returns {{score: number, markers: string[]}}
 */
export function scoreProxyHeaders(headers = {}) {
  const lower = {};
  for (const [k, v] of Object.entries(headers || {})) lower[String(k).toLowerCase()] = v;
  let score = 0;
  const markers = [];
  for (const marker of PROXY_HEADER_MARKERS) {
    if (lower[marker.name] !== undefined) {
      score += marker.weight;
      markers.push(marker.label);
    }
  }
  const server = String(lower.server || '').toLowerCase();
  if (/textise|jina|text-?proxy/.test(server)) {
    score += 2;
    markers.push('proxy-server-banner');
  }
  return { score, markers };
}

/**
 * Score a response body for text-proxy markers.
 * @param {string} body
 * @returns {{score: number, markers: string[]}}
 */
export function scoreProxyBody(body = '') {
  const src = String(body);
  let score = 0;
  const markers = [];
  for (const marker of PROXY_BODY_MARKERS) {
    if (marker.re.test(src)) {
      score += marker.weight;
      markers.push(marker.label);
    }
  }
  // A genuine text-proxy render strips almost all scripts and images.
  const scripts = (src.match(/<script\b/gi) || []).length;
  const images = (src.match(/<img\b/gi) || []).length;
  const links = (src.match(/<a\b[^>]*href/gi) || []).length;
  if (src.length > 5000 && scripts === 0 && images === 0 && links > 3) {
    score += 2;
    markers.push('script-image-stripped');
  }
  return { score, markers };
}

/**
 * Detect whether a fetched page is a text-only proxy mirror.
 * @param {{url: string, headers?: object, body?: string, targetHost?: string}} page
 * @returns {{isProxy: boolean, confidence: 'high'|'medium'|'low', score: number, markers: string[], service: object|null}}
 */
export function detectTextProxy(page = {}) {
  const { url = '', headers = {}, body = '', targetHost = '' } = page;
  const service = matchTextProxyHost(url);
  const headerScore = scoreProxyHeaders(headers);
  const bodyScore = scoreProxyBody(body);
  let score = headerScore.score + bodyScore.score;
  if (service) score += 4;
  const markers = [...headerScore.markers, ...bodyScore.markers];
  if (service) markers.unshift(`known-service:${service.name}`);
  // Same-host pages that merely offer a "text version" link are not proxies.
  let sameHost = false;
  try {
    sameHost =
      targetHost !== '' &&
      new URL(url).hostname.toLowerCase() === String(targetHost).toLowerCase();
  } catch {
    sameHost = false;
  }
  if (sameHost && !service) score = Math.min(score, 2);
  const isProxy = score >= 5;
  const confidence = score >= 8 ? 'high' : score >= 5 ? 'medium' : 'low';
  return { isProxy, confidence, score, markers, service };
}

/**
 * Scan a batch of fetched pages for text-proxy mirrors.
 * @param {Array<{url: string, headers?: object, body?: string}>} pages
 * @param {string} [targetHost]
 * @returns {{mirrors: object[], stats: object}}
 */
export function scanForTextProxies(pages = [], targetHost = '') {
  const mirrors = [];
  for (const page of pages) {
    const verdict = detectTextProxy({ ...page, targetHost });
    if (verdict.isProxy) {
      mirrors.push({
        kind: 'text-proxy-mirror',
        url: page.url,
        ...verdict,
      });
    }
  }
  return {
    mirrors,
    stats: {
      scanned: pages.length,
      mirrors: mirrors.length,
      highConfidence: mirrors.filter(m => m.confidence === 'high').length,
      services: [...new Set(mirrors.map(m => (m.service ? m.service.name : 'unknown')))],
    },
  };
}

/**
 * Build a report finding from a text-proxy scan.
 * @param {ReturnType<typeof scanForTextProxies>} result
 */
export function textProxyFinding(result) {
  return {
    title: `Text-proxy mirror detection — ${result.stats.mirrors} mirror(s) in ${result.stats.scanned} page(s)`,
    severity: result.stats.mirrors > 0 ? 'Low' : 'Info',
    confidence: result.stats.highConfidence > 0 ? 'high' : 'medium',
    stats: result.stats,
    evidence:
      `${result.stats.scanned} page(s) scanned; ` +
      `${result.stats.mirrors} text-only proxy mirror(s) detected ` +
      `(${result.stats.services.join(', ') || 'none'}).`,
  };
}

export const TEXT_PROXY_DETECTOR = {
  matchTextProxyHost,
  scoreProxyHeaders,
  scoreProxyBody,
  detectTextProxy,
  scanForTextProxies,
  textProxyFinding,
};
export default TEXT_PROXY_DETECTOR;
