/**
 * videoManifestHostExtractor.js — CDN video-manifest host extraction.
 *
 * Streaming video on a target is often served by media CDNs that do not
 * appear anywhere else in the web footprint. HLS (.m3u8) playlists and
 * DASH (.mpd) manifests frequently embed absolute segment URIs that
 * reveal those CDN hostnames.
 *
 * Passive analysis: this module only parses manifest text already in
 * scope (fetched playlist/MPD documents). It never crafts requests by
 * itself — the caller supplies the text.
 */

/** Host extraction patterns for HLS playlists (m3u8). */
const HLS_PATTERNS = {
  // Absolute URI= values, e.g. #EXT-X-MAP:URI="https://cdn-x.example.net/seg/init.mp4"
  quotedUri: /URI\s*=\s*"([^"]+)"/gi,
  // #EXT-X-STREAM-INF playlist URIs that sit on the next line
  streamInf: /^#EXT-X-STREAM-INF[^\n]*\n(?!\s*#)(\S+)\s*$/gim,
  // Absolute segment file lines ending in .ts/.m4s/.mp4/.aac/.webm
  segmentLine: /^(https?:\/\/[^\s"']+\.(?:ts|m4s|m4a|mp4|aac|webm|cmf[av]|mpd))$/gim,
  // KEY URIs (AES-128 key servers are often dedicated hosts)
  keyUri: /#EXT-X-KEY[^:]*:[^\n]*URI\s*=\s*"([^"]+)"/gi,
};

/** DASH MPD patterns: BaseURL elements and Location values. */
const DASH_PATTERNS = {
  baseUrl: /<BaseURL[^>]*>\s*([^<\s]+)\s*<\/BaseURL>/gi,
  location: /<Location[^>]*>\s*([^<\s]+)\s*<\/Location>/gi,
  mpdRoot: /<MPD\b[^>]*>/i,
};

/**
 * Extract hostnames from a list of URI strings.
 * @param {string[]} uris
 * @returns {string[]} unique sorted hostnames
 */
function hostsFromUris(uris) {
  const hosts = new Set();
  for (const raw of uris) {
    if (!raw || typeof raw !== 'string') continue;
    const u = raw.trim();
    if (!/^https?:\/\//i.test(u)) continue;
    try {
      const host = new URL(u).hostname.toLowerCase();
      if (host) hosts.add(host);
    } catch {
      /* ignore malformed URLs */
    }
  }
  return [...hosts].sort();
}

/**
 * Detect manifest flavour from raw text.
 * @param {string} text manifest body
 * @returns {'hls'|'dash'|'unknown'}
 */
export function detectManifestType(text) {
  const t = String(text || '');
  if (/#EXTM3U/i.test(t)) return 'hls';
  if (DASH_PATTERNS.mpdRoot.test(t)) return 'dash';
  return 'unknown';
}

/**
 * Parse an HLS (.m3u8) playlist and return every media/host finding.
 * @param {string} playlist raw playlist text
 * @param {string} [sourceUrl] URL the playlist was fetched from (for evidence)
 * @returns {object[]} findings: {type, value, evidence}
 */
export function parseHlsManifest(playlist, sourceUrl = '') {
  const text = String(playlist || '');
  const findings = [];

  const record = (type, value) => {
    if (value) findings.push({ type, value, evidence: sourceUrl || '(inline)' });
  };

  for (const rx of [HLS_PATTERNS.quotedUri, HLS_PATTERNS.streamInf, HLS_PATTERNS.segmentLine, HLS_PATTERNS.keyUri]) {
    rx.lastIndex = 0;
    let m;
    while ((m = rx.exec(text)) !== null) record('uri', m[1] || m[0]);
  }

  const uris = findings.map((f) => f.value);
  const hosts = hostsFromUris(uris);
  return [
    ...findings,
    ...hosts.map((h) => ({ type: 'segment_host', value: h, evidence: 'absolute URI in HLS manifest' })),
  ];
}

/**
 * Parse a DASH (.mpd) manifest and return every media/host finding.
 * @param {string} manifest raw MPD XML text
 * @param {string} [sourceUrl] URL the manifest was fetched from (for evidence)
 * @returns {object[]} findings: {type, value, evidence}
 */
export function parseDashManifest(manifest, sourceUrl = '') {
  const text = String(manifest || '');
  const findings = [];
  const uris = [];

  for (const key of ['baseUrl', 'location']) {
    const rx = DASH_PATTERNS[key];
    rx.lastIndex = 0;
    let m;
    while ((m = rx.exec(text)) !== null) {
      uris.push(m[1]);
      findings.push({ type: key === 'baseUrl' ? 'base_url' : 'location', value: m[1], evidence: sourceUrl || '(inline)' });
    }
  }

  const hosts = hostsFromUris(uris);
  return [
    ...findings,
    ...hosts.map((h) => ({ type: 'segment_host', value: h, evidence: 'BaseURL/Location in DASH manifest' })),
  ];
}

/**
 * Auto-detect and parse either manifest flavour.
 * @param {string} text raw manifest body
 * @param {string} [sourceUrl]
 * @returns {{flavour: string, findings: object[], segmentHosts: string[]}}
 */
export function parseManifest(text, sourceUrl = '') {
  const flavour = detectManifestType(text);
  let findings = [];
  if (flavour === 'hls') findings = parseHlsManifest(text, sourceUrl);
  else if (flavour === 'dash') findings = parseDashManifest(text, sourceUrl);
  const segmentHosts = [...new Set(findings.filter((f) => f.type === 'segment_host').map((f) => f.value))];
  return { flavour, findings, segmentHosts };
}

/**
 * Flag hosts that look like dedicated media/CDN infrastructure rather than
 * the target's own web origin — the interesting ones for further recon.
 * @param {string[]} hosts
 * @param {string} targetDomain the organisation's own domain (de-prioritised)
 * @returns {{host: string, cdnLike: boolean}[]}
 */
export function flagCdnLikeHosts(hosts, targetDomain = '') {
  const CDN_HINTS = /(cdn|media|video|stream|vod|hls|dash|edge|akamai|cloudfront|fastly|llnwd|cdnetworks|edgecast|jwpltx|mux|cloudinary|vimeocdn|wistia|brightcove|kaltura|jwplatform|dailymotion)/i;
  const own = targetDomain.toLowerCase();
  return (hosts || []).map((host) => ({
    host,
    cdnLike: CDN_HINTS.test(host) || (own && !host.endsWith(own)),
  }));
}

export const VIDEO_MANIFEST = {
  detectManifestType,
  parseHlsManifest,
  parseDashManifest,
  parseManifest,
  flagCdnLikeHosts,
};

export default VIDEO_MANIFEST;
