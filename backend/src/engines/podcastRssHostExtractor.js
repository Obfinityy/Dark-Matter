/**
 * podcastRssHostExtractor.js — Podcast hosting host extraction engine.
 *
 * Extracts media host URLs from an organisation's podcast RSS feeds:
 *  - <enclosure url="..."> media file hosts (CDN, hosting platform)
 *  - <itunes:image>, <image><url>, channel <link>
 *  - Common podcast hosts: megaphone.fm, libsyn.com, buzzsprout.com,
 *    transistor.fm, anchor.fm / podbean.com / spreaker.com / omny.fm ...
 *
 * All parsing is local XML/string parsing — the caller supplies already
 * fetched feed text. Helps map the org's audio-media footprint.
 */

const PODCAST_HOST_PATTERNS = [
  'megaphone.fm', 'libsyn.com', 'buzzsprout.com', 'transistor.fm',
  'anchor.fm', 'podbean.com', 'spreaker.com', 'omny.fm', 'art19.com',
  'simplecast.com', 'captivate.fm', 'redcircle.com', 'rss.com',
  'podtrac.com', 'blubrry.com', 'pinecast.com', 'fireside.fm',
  'whooshkaa.com', 'acast.com', 'audioboom.com', 'soundcloud.com',
];

/**
 * Extract all enclosure media URLs from RSS XML.
 * @param {string} rssXml feed XML text
 * @returns {{url: string, type: string|null, length: string|null}[]}
 */
export function extractEnclosures(rssXml = '') {
  const t = String(rssXml || '');
  const out = [];
  const re = /<enclosure\b[^>]*\burl="([^"]+)"[^>]*>/gi;
  let m;
  while ((m = re.exec(t)) !== null) {
    const tag = m[0];
    const typeM = tag.match(/\btype="([^"]+)"/i);
    const lenM = tag.match(/\blength="([^"]+)"/i);
    out.push({ url: m[1], type: typeM ? typeM[1] : null, length: lenM ? lenM[1] : null });
  }
  return out;
}

/**
 * Extract channel-level media/image hosts from RSS XML.
 * @param {string} rssXml feed XML text
 * @returns {{link: string|null, images: string[], feedHosts: string[]}}
 */
export function extractChannelMedia(rssXml = '') {
  const t = String(rssXml || '');
  const linkM = t.match(/<channel>[\s\S]*?<link>([^<]+)<\/link>/i);
  const images = new Set();
  for (const tag of ['itunes:image', 'image']) {
    const re = new RegExp(`<${tag}[^>]*(?:href|url)="([^"]+)"[^>]*>|<${tag}>\\s*<url>([^<]+)<\\/url>`, 'gi');
    let m;
    while ((m = re.exec(t)) !== null) images.add((m[1] || m[2] || '').trim());
  }
  return {
    link: linkM ? linkM[1].trim() : null,
    images: [...images].filter(Boolean),
    feedHosts: extractHostsFromUrls(t),
  };
}

/**
 * Pull hostnames out of any URLs found in text.
 * @param {string} text
 * @returns {string[]} unique hostnames
 */
export function extractHostsFromUrls(text = '') {
  const hosts = new Set();
  const re = /https?:\/\/([a-z0-9-]+(?:\.[a-z0-9-]+)+)(?::\d+)?(?:\/|$|[?"' <])/gi;
  let m;
  while ((m = re.exec(String(text))) !== null) hosts.add(m[1].toLowerCase());
  return [...hosts];
}

/**
 * Identify known podcast hosting platforms among a host list.
 * @param {string[]} hosts hostnames
 * @returns {{host: string, platform: string}[]} matched hosts
 */
export function identifyPodcastPlatforms(hosts = []) {
  const out = [];
  for (const h of hosts || []) {
    const host = String(h).toLowerCase();
    const hit = PODCAST_HOST_PATTERNS.find((p) => host === p || host.endsWith(`.${p}`));
    if (hit) out.push({ host, platform: hit });
  }
  return out;
}

/**
 * Full extraction pass over one or more feeds.
 * @param {string[]} feeds array of RSS XML strings
 * @returns {{enclosures: object[], mediaHosts: string[], platforms: object[], channelInfo: object[]}}
 */
export function extractPodcastFootprint(feeds = []) {
  const enclosures = (feeds || []).flatMap(extractEnclosures);
  const channelInfo = (feeds || []).map(extractChannelMedia);
  const mediaHosts = [...new Set([
    ...enclosures.flatMap((e) => extractHostsFromUrls(e.url)),
    ...channelInfo.flatMap((c) => c.images.flatMap(extractHostsFromUrls)),
  ])];
  const platforms = identifyPodcastPlatforms(mediaHosts);
  return { enclosures, mediaHosts, platforms, channelInfo };
}
