/**
 * jsBundleIntel.js — JavaScript bundle intelligence engine for autonomous bug bounty.
 *
 * Defensive asset-discovery capabilities that parse web artefacts —
 * JavaScript bundles, published source maps and webpack runtime manifests —
 * to discover undocumented hosts and endpoints. Covers idea-bank items
 * 00044–00046:
 *
 *  00044 JS-bundle host string extraction
 *  00045 Source-map URL reconstruction
 *  00046 Webpack chunk manifest harvesting
 *
 * All functions are pure and side-effect free: they parse text or objects the
 * caller obtained legally during an authorized engagement. Fetching bundles
 * or maps from the target is intentionally left to the caller so the engine
 * stays testable and safe to run anywhere. Only host/endpoint discovery is
 * performed — no interaction with the discovered endpoints.
 */

const URL_RE = /\bhttps?:\/\/[^\s"'<>\\\];,)]+/gi;
const HOST_RE = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}\b/gi;
const API_PATH_RE =
  /\B\/(?:api|v\d+(?:\.\d+)?|graphql|rest|internal|admin|auth|oauth|webhook|hooks|debug|health|metrics|actuator|swagger|openapi|docs|console|portal|staging|dev|test)(?:\/[a-z0-9_.~!$&'()*+,;=\-:@%{}[\]]*)*/gi;

/** Hosts that are noise in every JS bundle and must be filtered out. */
const NOISE_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  'w3.org',
  'www.w3.org',
  'schema.org',
  'json-schema.org',
  'ietf.org',
  'apache.org',
  'mozilla.org',
]);

const CHUNK_FILENAME_RE = /([a-z0-9_~.-]+\.chunk\.js|[a-z0-9_~.-]*\.[0-9a-f]{8,32}\.(?:js|css))/gi;
const PUBLIC_PATH_RE = /__webpack_require__\.p\s*=\s*["']([^"']+)["']/;
const JSONP_FN_RE =
  /(?:jsonpScriptSrc|__webpack_require__\.u|chunkId)\s*[=:]\s*function[^{]*\{[^}]{0,400}/gi;

/**
 * Normalize a host candidate.
 * @param {string} host
 * @returns {string|null}
 */
export function normalizeJsHost(host) {
  if (!host) return null;
  const h = host.toLowerCase().replace(/\.$/, '');
  if (NOISE_HOSTS.has(h)) return null;
  if (!/\./.test(h)) return null;
  return h;
}

/**
 * Extract a hostname from a URL-like string.
 * @param {string} url
 * @returns {string|null}
 */
export function hostFromJsUrl(url) {
  if (!url) return null;
  try {
    return normalizeJsHost(new URL(url).hostname);
  } catch {
    return null;
  }
}

/**
 * Parse a JavaScript bundle for URL-like strings, API paths and host
 * constants (idea 00044). Host discovery only.
 *
 * @param {string} bundle Bundle text.
 * @param {{minPathLength?: number}} [opts]
 * @returns {{urls: string[], hosts: string[], apiPaths: string[], hostConstants: {name: string, host: string}[]}}
 */
export function extractBundleHosts(bundle, opts = {}) {
  const out = { urls: [], hosts: [], apiPaths: [], hostConstants: [] };
  if (!bundle || typeof bundle !== 'string') return out;

  const urlSet = new Set();
  for (const m of bundle.matchAll(URL_RE)) {
    const raw = m[0].replace(/[),;.!?]+$/, '');
    const h = hostFromJsUrl(raw);
    if (h) urlSet.add(raw);
  }
  out.urls = [...urlSet].sort();

  const hostSet = new Set();
  for (const u of out.urls) {
    const h = hostFromJsUrl(u);
    if (h) hostSet.add(h);
  }
  for (const m of bundle.matchAll(HOST_RE)) {
    const h = normalizeJsHost(m[0]);
    if (h) hostSet.add(h);
  }
  out.hosts = [...hostSet].sort();

  const pathSet = new Set();
  const minLen = opts.minPathLength || 2;
  for (const m of bundle.matchAll(API_PATH_RE)) {
    const p = m[0];
    if (p.length >= minLen + 1 && !pathSet.has(p)) pathSet.add(p);
  }
  out.apiPaths = [...pathSet].sort();

  const constRe =
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*(?:_URL|_HOST|_ENDPOINT|_API|BASE_URL|API_URL|HOST|ENDPOINT))\s*=\s*["']([^"']+)["']/g;
  for (const m of bundle.matchAll(constRe)) {
    const h =
      hostFromJsUrl(m[2]) ||
      (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(m[2]) ? normalizeJsHost(m[2]) : null);
    if (h) out.hostConstants.push({ name: m[1], host: h });
  }
  return out;
}

/**
 * Parse a source-map (v3) document to rebuild the original file tree and
 * harvest internal hosts referenced in original paths, sources and comments
 * (idea 00045).
 *
 * @param {string|object} map Source-map JSON text or parsed object.
 * @returns {{version: number|null, fileTree: string[], sources: string[], sourceHosts: string[], embeddedUrls: string[], hasSourcesContent: boolean}}
 */
export function parseSourceMap(map) {
  const empty = {
    version: null,
    fileTree: [],
    sources: [],
    sourceHosts: [],
    embeddedUrls: [],
    hasSourcesContent: false,
  };
  let doc = map;
  if (typeof map === 'string') {
    try {
      doc = JSON.parse(map);
    } catch {
      return empty;
    }
  }
  if (!doc || typeof doc !== 'object') return empty;

  const sources = Array.isArray(doc.sources) ? doc.sources.filter(s => typeof s === 'string') : [];
  const tree = new Set();
  const hosts = new Set();
  const urls = new Set();
  const contents = Array.isArray(doc.sourcesContent) ? doc.sourcesContent : [];

  for (const src of sources) {
    tree.add(src);
    for (const m of src.matchAll(URL_RE)) {
      const raw = m[0].replace(/[),;.!?]+$/, '');
      urls.add(raw);
      const h = hostFromJsUrl(raw);
      if (h) hosts.add(h);
    }
    for (const m of src.matchAll(HOST_RE)) {
      const h = normalizeJsHost(m[0]);
      if (h) hosts.add(h);
    }
  }

  let commentHostsFound = 0;
  for (const content of contents) {
    if (typeof content !== 'string') continue;
    for (const m of content.matchAll(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g)) {
      const comment = m[0];
      for (const u of comment.matchAll(URL_RE)) {
        const raw = u[0].replace(/[),;.!?]+$/, '');
        urls.add(raw);
        const h = hostFromJsUrl(raw);
        if (h) {
          hosts.add(h);
          commentHostsFound++;
        }
      }
    }
  }
  void commentHostsFound;

  return {
    version: typeof doc.version === 'number' ? doc.version : null,
    fileTree: [...tree].sort(),
    sources,
    sourceHosts: [...hosts].sort(),
    embeddedUrls: [...urls].sort(),
    hasSourcesContent: contents.some(c => typeof c === 'string' && c.length > 0),
  };
}

/**
 * Parse a webpack runtime manifest (or the webpack bootstrap section of a
 * bundle) to list every lazy-loaded chunk URL (idea 00046).
 *
 * @param {string} text Webpack runtime / manifest text.
 * @param {string} [baseUrl] Optional page origin used to resolve relative public paths.
 * @returns {{publicPath: string|null, chunks: {file: string, url: string|null}[], host: string|null}}
 */
export function harvestWebpackChunks(text, baseUrl) {
  const out = { publicPath: null, chunks: [], host: null };
  if (!text || typeof text !== 'string') return out;

  const pp = text.match(PUBLIC_PATH_RE);
  if (pp) out.publicPath = pp[1];

  const seen = new Set();
  for (const m of text.matchAll(CHUNK_FILENAME_RE)) {
    const file = m[1] || m[0];
    if (seen.has(file)) continue;
    seen.add(file);
    let url = null;
    if (out.publicPath) {
      const ppClean = out.publicPath.replace(/\/+$/, '') + '/';
      if (/^https?:\/\//i.test(ppClean)) url = ppClean + file;
      else if (baseUrl) {
        try {
          url = new URL(ppClean + file, baseUrl).href;
        } catch {
          url = null;
        }
      }
    }
    out.chunks.push({ file, url });
  }
  out.chunks.sort((a, b) => a.file.localeCompare(b.file));

  if (out.publicPath && /^https?:\/\//i.test(out.publicPath)) {
    out.host = hostFromJsUrl(out.publicPath);
  }
  return out;
}

/**
 * Scan webpack JSONP / script-src builder functions for hard-coded CDN or
 * subdomain origins used for chunk loading (idea 00046).
 *
 * @param {string} text Webpack runtime text.
 * @returns {string[]} Discovered chunk origins (hosts).
 */
export function extractChunkOrigins(text) {
  const hosts = new Set();
  if (!text || typeof text !== 'string') return [];
  for (const m of text.matchAll(JSONP_FN_RE)) {
    const body = m[0];
    for (const u of body.matchAll(URL_RE)) {
      const h = hostFromJsUrl(u[0].replace(/[),;.!?]+$/, ''));
      if (h) hosts.add(h);
    }
  }
  const cdnRe = /(?:cdn|static|assets|chunk)[a-z0-9-]*\.[a-z0-9.-]+\.[a-z]{2,}/gi;
  for (const m of text.matchAll(cdnRe)) {
    const h = normalizeJsHost(m[0]);
    if (h) hosts.add(h);
  }
  return [...hosts].sort();
}

/**
 * Combine bundle, source-map and chunk findings into a ranked host list for
 * the hunt pipeline.
 *
 * @param {{urls?: string[], hosts?: string[], apiPaths?: string[]}} bundle
 * @param {{sourceHosts?: string[]}} [sourcemap]
 * @param {{host?: string|null}} [chunks]
 * @returns {{host: string, sources: string[], score: number}[]}
 */
export function consolidateJsFindings(bundle = {}, sourcemap = {}, chunks = {}) {
  const byHost = new Map();
  const add = (host, source, score) => {
    const h = normalizeJsHost(host);
    if (!h) return;
    const cur = byHost.get(h) || { host: h, sources: [], score: 0 };
    if (!cur.sources.includes(source)) cur.sources.push(source);
    cur.score += score;
    byHost.set(h, cur);
  };
  for (const h of bundle.hosts || []) add(h, 'js-bundle', 1);
  for (const u of bundle.urls || []) {
    const h = hostFromJsUrl(u);
    if (h) add(h, 'js-bundle-url', 2);
  }
  for (const h of sourcemap.sourceHosts || []) add(h, 'source-map', 3);
  if (chunks.host) add(chunks.host, 'webpack-chunks', 2);
  for (const h of bundle.hostConstants || []) add(h.host, 'host-constant', 3);

  const interesting = ['api', 'staging', 'stage', 'dev', 'internal', 'admin'];
  for (const entry of byHost.values()) {
    for (const kw of interesting) {
      if (entry.host.includes(kw)) entry.score += 2;
    }
  }
  return [...byHost.values()].sort((a, b) => b.score - a.score || a.host.localeCompare(b.host));
}

export default {
  extractBundleHosts,
  parseSourceMap,
  harvestWebpackChunks,
  extractChunkOrigins,
  consolidateJsFindings,
  normalizeJsHost,
  hostFromJsUrl,
};
