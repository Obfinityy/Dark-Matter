/**
 * videoPlatformHostMiner.js — Video platform channel host mining engine.
 *
 * @idea 00290 — Video platform channel host mining — map Wistia/Vidyard/
 *   Vimeo hosts used for the org's embedded videos.
 *
 * Orgs embed marketing/product videos from Wistia (fast.wistia.net /
 * *.wistia.com), Vidyard (*.vidyard.com / play.vidyard.com) and Vimeo
 * (player.vimeo.com / *.vimeo.com). Embed iframes and player scripts leak
 * the media IDs and account/project hashes. This engine extracts embedded
 * video references from page HTML, classifies them by platform, and groups
 * them per org page.
 *
 * Pure functions only: callers fetch page HTML themselves. No live network
 * calls here.
 */

const VIDEO_PLATFORM_PATTERNS = [
  { platform: 'Wistia', re: /(?:^|\.)wistia\.com$/i, note: 'Wistia video platform' },
  { platform: 'Wistia', re: /^fast\.wistia\.net$/i, note: 'Wistia fast embed host' },
  { platform: 'Wistia', re: /^embed\.wistia\.com$/i, note: 'Wistia embed host' },
  { platform: 'Vidyard', re: /(?:^|\.)vidyard\.com$/i, note: 'Vidyard video platform' },
  { platform: 'Vidyard', re: /^play\.vidyard\.com$/i, note: 'Vidyard player host' },
  { platform: 'Vimeo', re: /(?:^|\.)vimeo\.com$/i, note: 'Vimeo video platform' },
  { platform: 'Vimeo', re: /^player\.vimeo\.com$/i, note: 'Vimeo embed player' },
  { platform: 'Vimeo', re: /^f\.vimeocdn\.com$/i, note: 'Vimeo CDN assets' },
  { platform: 'YouTube', re: /(?:^|\.)youtube\.com$/i, note: 'YouTube embed' },
  { platform: 'YouTube', re: /^youtu\.be$/i, note: 'YouTube short link host' },
  { platform: 'Loom', re: /(?:^|\.)loom\.com$/i, note: 'Loom video host' },
];

const MEDIA_ID_PATTERNS = [
  { platform: 'Wistia', re: /wistia\.(?:com|net)\/(?:embed\/medias|medias)\/([a-z0-9]{10})/i, idKind: 'media-hash' },
  { platform: 'Wistia', re: /["']?wistiaAsyncEmbed["']?\s*[:=]\s*["']([a-z0-9]{10})["']/i, idKind: 'async-embed-hash' },
  { platform: 'Vidyard', re: /play\.vidyard\.com\/([a-zA-Z0-9]{8,})(?:\.html)?/i, idKind: 'player-uuid' },
  { platform: 'Vidyard', re: /vidyard\.com\/watch\/([a-zA-Z0-9_-]{8,})/i, idKind: 'watch-id' },
  { platform: 'Vimeo', re: /player\.vimeo\.com\/video\/(\d{6,})/i, idKind: 'video-id' },
  { platform: 'Vimeo', re: /vimeo\.com\/(\d{6,})/i, idKind: 'video-id' },
  { platform: 'YouTube', re: /(?:youtube\.com\/(?:embed|watch\?v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i, idKind: 'video-id' },
  { platform: 'Loom', re: /loom\.com\/(?:share|embed)\/([a-f0-9]{32})/i, idKind: 'share-id' },
];

/**
 * Normalize a hostname: lowercase, strip scheme, port, trailing dot.
 * @param {string} host
 * @returns {string}
 */
export function normalizeHostname(host) {
  if (!host) return '';
  return String(host)
    .trim()
    .toLowerCase()
    .replace(/^\w+:\/\//, '')
    .replace(/:\d+$/, '')
    .replace(/\.$/, '');
}

/**
 * Classify a hostname as a hosted-video platform host.
 * @param {string} host
 * @returns {{isVideoPlatform: boolean, platform: string, note: string, host: string}}
 */
export function classifyVideoHost(host) {
  const h = normalizeHostname(host);
  for (const { platform, re, note } of VIDEO_PLATFORM_PATTERNS) {
    if (re.test(h)) return { isVideoPlatform: true, platform, note, host: h };
  }
  return { isVideoPlatform: false, platform: '', note: '', host: h };
}

/**
 * Extract embedded video references from page HTML: iframe/player hosts,
 * script tags, and platform media IDs.
 * @param {string} html page HTML
 * @returns {{embeds: {url: string, host: string, platform: string, mediaId: string, idKind: string}[], platforms: string[], hosts: string[]}}
 */
export function extractEmbeddedVideos(html) {
  const text = String(html || '');
  const embeds = [];
  const seen = new Set();
  const hostSet = new Set();
  const platformSet = new Set();

  const tagRe = /<(?:iframe|script|video|source)[^>]+(?:src|data-src|href)=["']([^"']+)["'][^>]*>/gi;
  let m;
  const candidates = [];
  while ((m = tagRe.exec(text)) !== null) candidates.push(m[1]);

  const bareUrlRe = /https?:\/\/[a-z0-9][a-z0-9.-]*(?:wistia|vidyard|vimeo|youtu\.?be|loom)[a-z0-9.-]*\/[^\s"'<>]*/gi;
  while ((m = bareUrlRe.exec(text)) !== null) candidates.push(m[0]);

  for (const url of candidates) {
    if (seen.has(url)) continue;
    const hostMatch = url.match(/^https?:\/\/([^/\s"'<>]+)/i);
    const host = hostMatch ? normalizeHostname(hostMatch[1]) : '';
    const verdict = host ? classifyVideoHost(host) : { isVideoPlatform: false, platform: '' };
    if (!verdict.isVideoPlatform) continue;
    seen.add(url);
    hostSet.add(host);
    platformSet.add(verdict.platform);
    let mediaId = '';
    let idKind = '';
    for (const p of MEDIA_ID_PATTERNS) {
      if (p.platform !== verdict.platform) continue;
      const idMatch = url.match(p.re);
      if (idMatch) {
        mediaId = idMatch[1];
        idKind = p.idKind;
        break;
      }
    }
    embeds.push({ url, host, platform: verdict.platform, mediaId, idKind });
  }

  return {
    embeds,
    platforms: [...platformSet],
    hosts: [...hostSet],
  };
}

/**
 * Mine video platform usage across a set of org pages: per-page embeds
 * plus an org-wide rollup of platforms, hosts and media inventory.
 * @param {{page: string, html: string}[]} pages labelled page HTML
 * @returns {{pages: {page: string, videoDetected: boolean, platforms: string[], hosts: string[], embedCount: number}[], rollup: {platforms: string[], hosts: string[], totalEmbeds: number, mediaIds: {platform: string, mediaId: string, idKind: string}[]}}}
 */
export function mineVideoPlatformHosts(pages) {
  const pageResults = [];
  const rollupHosts = new Set();
  const rollupPlatforms = new Set();
  const rollupMediaIds = [];
  let totalEmbeds = 0;

  for (const p of pages || []) {
    const signals = extractEmbeddedVideos(p.html);
    totalEmbeds += signals.embeds.length;
    for (const h of signals.hosts) rollupHosts.add(h);
    for (const pl of signals.platforms) rollupPlatforms.add(pl);
    for (const e of signals.embeds) {
      if (e.mediaId) rollupMediaIds.push({ platform: e.platform, mediaId: e.mediaId, idKind: e.idKind });
    }
    pageResults.push({
      page: p.page,
      videoDetected: signals.embeds.length > 0,
      platforms: signals.platforms,
      hosts: signals.hosts,
      embedCount: signals.embeds.length,
    });
  }

  return {
    pages: pageResults,
    rollup: {
      platforms: [...rollupPlatforms],
      hosts: [...rollupHosts],
      totalEmbeds,
      mediaIds: rollupMediaIds,
    },
  };
}
