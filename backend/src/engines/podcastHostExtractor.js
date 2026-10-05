/**
 * podcastHostExtractor.js — Podcast hosting host extraction engine.
 *
 * @idea 00289 — Podcast hosting host extraction — extract media host URLs
 *   from the org's podcast RSS feeds.
 *
 * Podcast RSS feeds (RSS 2.0 with iTunes/Atom extensions) list every
 * episode's enclosure URL plus feed-level link, image, and generator
 * metadata. The enclosure hosts reveal the media CDN/hosting provider
 * (Buzzsprout, Libsyn, Transistor, Podbean, Simplecast, Anchor/Spotify,
 * Megaphone…). This engine parses RSS XML with regex heuristics — no XML
 * parser dependency, no network calls — and maps episodes to their media
 * hosts and inferred hosting providers.
 *
 * Pure functions only: callers fetch the RSS XML themselves.
 */

const PODCAST_HOSTING_PATTERNS = [
  { provider: 'Buzzsprout', re: /\.buzzsprout\.com$/i, note: 'Buzzsprout media host' },
  { provider: 'Libsyn', re: /\.libsyn\.com$/i, note: 'Libsyn media host' },
  { provider: 'Transistor', re: /\.transistor\.fm$/i, note: 'Transistor.fm media host' },
  { provider: 'Podbean', re: /\.podbean\.com$/i, note: 'Podbean media host' },
  { provider: 'Simplecast', re: /\.simplecast\.com$/i, note: 'Simplecast media host' },
  { provider: 'Anchor/Spotify', re: /\.anchor\.fm$/i, note: 'Anchor (Spotify) media host' },
  { provider: 'Spotify', re: /anchor|podcasters\.spotify/i, note: 'Spotify for Podcasters' },
  { provider: 'Megaphone', re: /\.megaphone\.fm$/i, note: 'Megaphone media host' },
  { provider: 'Captivate', re: /\.captivate\.fm$/i, note: 'Captivate media host' },
  { provider: 'Acast', re: /\.acast\.com$/i, note: 'Acast media host' },
  { provider: 'OmnyStudio', re: /\.omny\.fm$/i, note: 'OmnyStudio media host' },
  { provider: 'SoundCloud', re: /\.soundcloud\.com$/i, note: 'SoundCloud media host' },
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
 * Extract the hostname from a URL string.
 * @param {string} url
 * @returns {string}
 */
export function hostnameFromUrl(url) {
  const m = String(url || '').match(/^https?:\/\/([^/\s"'<>]+)/i);
  return m ? normalizeHostname(m[1]) : '';
}

/**
 * Classify a media hostname as a known podcast hosting provider.
 * @param {string} host
 * @returns {{provider: string, note: string, host: string}|null}
 */
export function classifyPodcastMediaHost(host) {
  const h = normalizeHostname(host);
  for (const { provider, re, note } of PODCAST_HOSTING_PATTERNS) {
    if (re.test(h)) return { provider, note, host: h };
  }
  return null;
}

/**
 * Parse a podcast RSS feed's channel-level metadata (title, link, image,
 * generator, managing editor).
 * @param {string} xml RSS XML text
 * @returns {{title: string, link: string, linkHost: string, imageUrl: string, imageHost: string, generator: string, language: string}}
 */
export function parsePodcastChannelMeta(xml) {
  const text = String(xml || '');
  const channelMatch = text.match(/<channel>([\s\S]*?)<\/channel>/i);
  const channel = channelMatch ? channelMatch[1] : text;
  const tag = (name) => {
    const m = channel.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'));
    return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim() : '';
  };
  const itunesImage = channel.match(/<itunes:image[^>]+href=["']([^"']+)/i);
  const link = tag('link');
  const imageUrl = itunesImage ? itunesImage[1] : '';
  return {
    title: tag('title'),
    link,
    linkHost: hostnameFromUrl(link),
    imageUrl,
    imageHost: hostnameFromUrl(imageUrl),
    generator: tag('generator'),
    language: tag('language'),
  };
}

/**
 * Parse episode items from a podcast RSS feed, extracting enclosure media
 * URLs and mapping them to hosts and inferred providers.
 * @param {string} xml RSS XML text
 * @returns {{title: string, pubDate: string, mediaUrl: string, mediaHost: string, mediaType: string, provider: string, providerNote: string}[]}
 */
export function parsePodcastEpisodes(xml) {
  const text = String(xml || '');
  const items = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRe.exec(text)) !== null) {
    const item = m[1];
    const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/i);
    const dateMatch = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
    const enclosureMatch = item.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]*>/i);
    const title = titleMatch
      ? titleMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim()
      : '';
    const mediaUrl = enclosureMatch ? enclosureMatch[1] : '';
    const mediaTypeMatch = enclosureMatch
      ? enclosureMatch[0].match(/type=["']([^"']+)/i)
      : null;
    const mediaHost = hostnameFromUrl(mediaUrl);
    const providerInfo = mediaHost ? classifyPodcastMediaHost(mediaHost) : null;
    items.push({
      title,
      pubDate: dateMatch ? dateMatch[1].trim() : '',
      mediaUrl,
      mediaHost,
      mediaType: mediaTypeMatch ? mediaTypeMatch[1] : '',
      provider: providerInfo ? providerInfo.provider : '',
      providerNote: providerInfo ? providerInfo.note : '',
    });
  }
  return items;
}

/**
 * Full extraction: channel metadata + per-episode media hosts +
 * provider rollup for the org's podcast footprint.
 * @param {string} xml RSS XML text
 * @returns {{channel: object, episodeCount: number, mediaHosts: {host: string, episodes: number, provider: string}[], providers: string[]}}
 */
export function extractPodcastHosts(xml) {
  const channel = parsePodcastChannelMeta(xml);
  const episodes = parsePodcastEpisodes(xml);
  const byHost = new Map();
  for (const ep of episodes) {
    if (!ep.mediaHost) continue;
    const entry = byHost.get(ep.mediaHost) || {
      host: ep.mediaHost,
      episodes: 0,
      provider: ep.provider || '',
    };
    entry.episodes += 1;
    if (!entry.provider && ep.provider) entry.provider = ep.provider;
    byHost.set(ep.mediaHost, entry);
  }
  const mediaHosts = [...byHost.values()].sort((a, b) => b.episodes - a.episodes);
  const providers = [...new Set(mediaHosts.map((h) => h.provider).filter(Boolean))];
  return {
    channel,
    episodeCount: episodes.length,
    mediaHosts,
    providers,
  };
}
