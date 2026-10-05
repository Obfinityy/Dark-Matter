/**
 * videoManifestHostMiner.js — CDN video-manifest host extraction engine.
 *
 * @idea 00291
 * Covers idea-bank item 00291:
 *  - 00291 CDN video-manifest host extraction — parse HLS/DASH manifests for
 *    segment hosts that reveal media CDN infrastructure.
 *
 * Pure functions only: the caller fetches playlist/manifest bodies (HLS .m3u8,
 * DASH .mpd, Smooth Streaming) and passes the raw text in. No live HTTP here.
 */

const SCHEME_HOST_RE = /(?:https?:\/\/)([^/:?\s#"'<>]+)(?::\d+)?/g;
const URL_ATTR_RE = /(?:URI|uri)\s*=\s*["']([^"']+)["']/g;

const CDN_HINTS = [
  { re: /\.akamaized\.net$/i, vendor: 'akamai', note: 'Akamai HD media delivery' },
  { re: /\.akamaihd\.net$/i, vendor: 'akamai', note: 'legacy Akamai media delivery' },
  { re: /\.edgesuite\.net$/i, vendor: 'akamai', note: 'Akamai edge media property' },
  { re: /cloudfront\.net$/i, vendor: 'aws', note: 'Amazon CloudFront media distribution' },
  { re: /\.r\.cloudfront\.net$/i, vendor: 'aws', note: 'CloudFront live-media distribution' },
  { re: /\.cdn\.azureedge\.net$|\.azureedge\.net$/i, vendor: 'azure', note: 'Azure CDN media endpoint' },
  { re: /\.fastly\.net$/i, vendor: 'fastly', note: 'Fastly media delivery' },
  { re: /\.llnwd\.net$/i, vendor: 'limelight', note: 'Limelight/Edgio media CDN' },
  { re: /\.edgecastcdn\.net$/i, vendor: 'edgecast', note: 'Edgecast media CDN' },
  { re: /\.uplynk\.com$/i, vendor: 'uplynk', note: 'Uplynk video delivery' },
  { re: /\.mux\.com$/i, vendor: 'mux', note: 'Mux video infrastructure' },
  { re: /\.jwpltx\.com$/i, vendor: 'jwplayer', note: 'JW Player video CDN' },
  { re: /\.vimeo\.com$/i, vendor: 'vimeo', note: 'Vimeo media delivery' },
  { re: /\.akamai\.net$/i, vendor: 'akamai', note: 'Akamai media network' },
];

/**
 * Normalize a hostname: lowercase, strip trailing dot and port.
 * @param {string} host
 * @returns {string}
 */
export function normalizeHost(host) {
  return String(host || '')
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '')
    .replace(/\.$/, '');
}

/**
 * Detect the manifest flavour from its body and filename.
 * @param {string} body manifest text
 * @param {string} [url] manifest URL or filename
 * @returns {'hls'|'dash'|'smooth'|'unknown'}
 */
export function detectManifestType(body = '', url = '') {
  const lower = String(body || '').slice(0, 4096);
  const name = String(url || '').toLowerCase();
  if (name.endsWith('.m3u8') || lower.includes('#EXTM3U')) return 'hls';
  if (name.endsWith('.mpd') || /<MPD[\s>]/.test(lower)) return 'dash';
  if (name.endsWith('.ism') || name.includes('manifest') && /SmoothStreamingMedia/.test(lower)) return 'smooth';
  return 'unknown';
}

/**
 * Extract candidate media URLs from an HLS playlist body.
 * Covers EXT-X-STREAM-INF, EXT-X-KEY, EXT-X-MAP and plain segment lines.
 * @param {string} body HLS playlist text
 * @returns {string[]} raw URLs / URI attribute values (deduplicated)
 */
export function extractHlsUris(body = '') {
  const found = new Set();
  const text = String(body || '');
  for (const m of text.matchAll(URL_ATTR_RE)) {
    if (m[1]) found.add(m[1].trim());
  }
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (/^(https?:)?\/\//i.test(trimmed) || /^[A-Za-z0-9_\-]+\.(ts|m4s|aac|mp4|vtt|webvtt|cmfv|cmfa|m4v|m4a)(\?|$)/i.test(trimmed)) {
      found.add(trimmed);
    }
  }
  return [...found];
}

/**
 * Extract candidate media URLs from a DASH MPD document.
 * Reads BaseURL elements plus SegmentList/SegmentTemplate media attributes.
 * @param {string} body MPD XML text
 * @returns {string[]} raw URLs (deduplicated)
 */
export function extractDashUris(body = '') {
  const found = new Set();
  const text = String(body || '');
  for (const m of text.matchAll(/<BaseURL[^>]*>([^<]+)<\/BaseURL>/gi)) {
    if (m[1] && m[1].trim()) found.add(m[1].trim());
  }
  for (const m of text.matchAll(/(?:media|initialization|sourceURL)\s*=\s*["']([^"']+)["']/gi)) {
    if (m[1] && !m[1].includes('$')) found.add(m[1].trim());
  }
  return [...found];
}

/**
 * Extract candidate media URLs from any supported manifest body.
 * @param {string} body manifest text
 * @param {string} [url] manifest URL or filename (flavour hint)
 * @returns {string[]} raw URIs (deduplicated)
 */
export function extractManifestUris(body = '', url = '') {
  const kind = detectManifestType(body, url);
  if (kind === 'hls') return extractHlsUris(body);
  if (kind === 'dash') return extractDashUris(body);
  return [...new Set([...extractHlsUris(body), ...extractDashUris(body)])];
}

/**
 * Classify a host as a known media CDN vendor when recognisable.
 * @param {string} host
 * @returns {{vendor: string, note: string}}
 */
export function classifyMediaCdn(host) {
  const h = normalizeHost(host);
  for (const { re, vendor, note } of CDN_HINTS) {
    if (re.test(h)) return { vendor, note };
  }
  return { vendor: 'unknown', note: 'unrecognised media host — candidate shadow CDN endpoint' };
}

/**
 * Parse a manifest body into segment-host intelligence.
 * Relative segment paths are resolved against the manifest base URL.
 *
 * @param {{body: string, url: string}} manifest
 * @returns {{
 *   type: 'hls'|'dash'|'smooth'|'unknown', manifestHost: string,
 *   segmentHosts: {host: string, vendor: string, note: string, uris: string[], count: number}[]
 * }[]}
 */
export function extractManifestSegmentHosts(manifest) {
  const body = String(manifest?.body || '');
  const url = String(manifest?.url || '');
  const type = detectManifestType(body, url);
  let baseHost = '';
  try {
    if (url && /^[a-z][a-z0-9+.-]*:/i.test(url)) baseHost = normalizeHost(new URL(url).hostname);
  } catch { /* leave blank */ }

  const byHost = new Map();
  for (const uri of extractManifestUris(body, url)) {
    let host = '';
    try {
      const resolved = /^[a-z][a-z0-9+.-]*:/i.test(uri) || uri.startsWith('//')
        ? uri
        : url && /^[a-z][a-z0-9+.-]*:/i.test(url)
          ? new URL(uri, url).href
          : null;
      if (resolved) host = normalizeHost(new URL(resolved.startsWith('//') ? `https:${resolved}` : resolved).hostname);
      else if (baseHost) host = baseHost;
    } catch { /* skip unparsable uri */ }
    if (!host) continue;
    if (!byHost.has(host)) {
      const cls = classifyMediaCdn(host);
      byHost.set(host, { host, vendor: cls.vendor, note: cls.note, uris: [], count: 0 });
    }
    const entry = byHost.get(host);
    if (!entry.uris.includes(uri)) entry.uris.push(uri);
    entry.count += 1;
  }

  return {
    type,
    manifestHost: baseHost,
    segmentHosts: [...byHost.values()].sort((a, b) => b.count - a.count || a.host.localeCompare(b.host)),
  };
}

/**
 * Score manifest-host findings for the caller: known-vendor CDN hosts are
 * confirmed media infrastructure; unknown hosts may be shadow IT endpoints.
 *
 * @param {ReturnType<typeof extractManifestSegmentHosts>} parsed
 * @returns {{host: string, vendor: string, score: number, reason: string}[]}
 */
export function scoreManifestHosts(parsed) {
  const hosts = parsed?.segmentHosts || [];
  return hosts.map((h) => {
    let score = 30;
    let reason = 'unclassified media host — candidate shadow IT video endpoint';
    if (h.vendor !== 'unknown') {
      score = 75;
      reason = `confirmed ${h.vendor} media CDN infrastructure (${h.note})`;
    }
    if (h.uris.length > 3) score += 10;
    return { host: h.host, vendor: h.vendor, score: Math.min(100, score), reason };
  }).sort((a, b) => b.score - a.score);
}
