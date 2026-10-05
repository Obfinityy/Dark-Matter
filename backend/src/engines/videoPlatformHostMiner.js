/**
 * videoPlatformHostMiner.js — Video platform channel host mining engine.
 *
 * Maps Wistia / Vidyard / Vimeo hosts used for an organisation's embedded
 * videos from passive page/DNS data:
 *  - Wistia: fast.wistia.com/embed/medias/<id>, wistia.com embeds,
 *    <hashed>.wistia.com delivery hosts
 *  - Vidyard: play.vidyard.com, *.vidyard.com hubs, share URLs
 *  - Vimeo: player.vimeo.com/video/<id>, vimeo.com/<id>,
 *    *.vimeo-cdn / vod-progressive delivery hosts
 *
 * Pure discovery for an authorized hunter mapping video-channel exposure.
 */

const VIDEO_PLATFORMS = [
  {
    name: 'Wistia',
    hostRe: /\b([a-z0-9-]+\.wistia\.com|fast\.wistia\.com|wistia\.com|embedwistia\.akamaihd\.net)\b/i,
    mediaIdRe: /wistia\.com\/(?:embed\/)?medias?\/([a-z0-9]+)/gi,
    asyncEmbedRe: /["']?videoFoam["']?\s*:\s*["']?true["']?|Wistia\.embed\(\s*["']([a-z0-9]+)["']/gi,
  },
  {
    name: 'Vidyard',
    hostRe: /\b([a-z0-9-]+\.vidyard\.com|play\.vidyard\.com|vidyard\.com|share\.vidyard\.com)\b/i,
    mediaIdRe: /vidyard\.com\/watch\/([a-zA-Z0-9_-]+)/gi,
  },
  {
    name: 'Vimeo',
    hostRe: /\b([a-z0-9-]+\.vimeo\.com|player\.vimeo\.com|vimeo\.com|vimeocdn\.com|[a-z0-9-]+\.vimeo-cdn\.[a-z]+\.net)\b/i,
    mediaIdRe: /(?:player\.)?vimeo\.com\/(?:video\/)?(\d{6,})/gi,
  },
];

/**
 * Classify a video-platform hostname.
 * @param {string} hostname
 * @returns {{platform: string, host: string}|null}
 */
export function classifyVideoHost(hostname = '') {
  const h = String(hostname).toLowerCase().replace(/\.$/, '');
  for (const p of VIDEO_PLATFORMS) {
    const m = h.match(p.hostRe);
    if (m) return { platform: p.name, host: (m[1] || m[0]).toLowerCase() };
  }
  return null;
}

/**
 * Extract embedded video references (platform + media id) from page HTML.
 * @param {string} html page source
 * @returns {{platform: string, mediaId: string|null, raw: string}[]}
 */
export function extractEmbeddedVideos(html = '') {
  const t = String(html || '');
  const out = [];
  const seen = new Set();
  for (const p of VIDEO_PLATFORMS) {
    for (const re of [p.mediaIdRe]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(t)) !== null) {
        const key = `${p.name}:${m[1]}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ platform: p.name, mediaId: m[1], raw: m[0] });
      }
    }
  }
  // iframe embeds: <iframe src="https://fast.wistia.com/embed/iframe/abc123">
  const iframeRe = /<iframe[^>]+src="([^"]+)"/gi;
  let im;
  while ((im = iframeRe.exec(t)) !== null) {
    const cls = classifyVideoHost(im[1].split('/')[2] || '');
    if (cls) {
      const key = `${cls.platform}:iframe:${im[1]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ platform: cls.platform, mediaId: null, raw: im[1] });
    }
  }
  return out;
}

/**
 * Extract all video-platform hostnames referenced in text.
 * @param {string} text
 * @returns {string[]} unique hostnames
 */
export function extractVideoHosts(text = '') {
  const hosts = new Set();
  const re = /\b([a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:wistia\.com|vidyard\.com|vimeo\.com|vimeocdn\.com|vimeo-cdn\.[a-z]+\.net))\b/gi;
  let m;
  while ((m = re.exec(String(text))) !== null) hosts.add(m[1].toLowerCase());
  return [...hosts];
}

/**
 * Map CNAME records to video platform channel hosts.
 * @param {{name: string, target: string}[]} cnameRecords
 * @returns {{alias: string, platform: string, host: string}[]}
 */
export function mapVideoCnames(cnameRecords = []) {
  const out = [];
  for (const rec of cnameRecords || []) {
    if (!rec || !rec.name || !rec.target) continue;
    const target = String(rec.target).toLowerCase().replace(/\.$/, '');
    const cls = classifyVideoHost(target);
    if (cls) {
      out.push({ alias: String(rec.name).toLowerCase().replace(/\.$/, ''), platform: cls.platform, host: target });
    }
  }
  return out;
}

/**
 * Full mining pass.
 * @param {{htmlPages: string[], cnames: {name:string,target:string}[]}} input
 * @returns {{videos: object[], hosts: object[], cnameHits: object[]}}
 */
export function mineVideoFootprint({ htmlPages = [], cnames = [] } = {}) {
  const videos = (htmlPages || []).flatMap(extractEmbeddedVideos);
  const hostNames = [...new Set((htmlPages || []).flatMap(extractVideoHosts))];
  const hosts = hostNames.map((h) => ({ host: h, ...classifyVideoHost(h) }));
  const cnameHits = mapVideoCnames(cnames);
  return { videos, hosts, cnameHits };
}
