/**
 * webinarPlatformHostMiner.js — Webinar platform host mining engine.
 *
 * @idea 00288 — Webinar platform host mining — discover Zoom webinar,
 *   GoToWebinar, and Demio hosts linked to the org.
 *
 * Orgs run webinars on Zoom (zoom.us webinar links), GoToWebinar
 * (gotowebinar.com / attendee.gotowebinar.com) and Demio (my.demio.com).
 * Registration pages and calendar invites leak stable webinar hostnames and
 * join URLs. This engine extracts webinar host references from page HTML
 * and text, classifies them by platform, and pulls out join-link details.
 *
 * Pure functions only: callers fetch page HTML and invite text themselves.
 * No live network calls here.
 */

const WEBINAR_PLATFORM_PATTERNS = [
  { platform: 'Zoom', re: /(?:^|\.)zoom\.us$/i, joinRe: /zoom\.us\/[jw]\/(\d{9,11})/i, note: 'Zoom webinar/meeting host' },
  { platform: 'Zoom', re: /(?:^|\.)zoomgov\.com$/i, joinRe: /zoomgov\.com\/[jw]\/(\d{9,11})/i, note: 'Zoom for Government host' },
  { platform: 'GoToWebinar', re: /(?:^|\.)gotowebinar\.com$/i, joinRe: /gotowebinar\.com\/(?:register|rt)\/(\d{6,})/i, note: 'GoToWebinar host' },
  { platform: 'GoToWebinar', re: /(?:^|\.)attendee\.gotowebinar\.com$/i, joinRe: /attendee\.gotowebinar\.com\/register\/(\d{6,})/i, note: 'GoToWebinar attendee host' },
  { platform: 'Demio', re: /(?:^|\.)demio\.com$/i, joinRe: /my\.demio\.com\/[a-z]\/([a-z0-9-]{4,})/i, note: 'Demio host' },
  { platform: 'WebinarJam', re: /(?:^|\.)webinarjam\.com$/i, joinRe: /webinarjam\.com\/(?:register|go)\/(\d+)/i, note: 'WebinarJam host' },
  { platform: 'Livestorm', re: /(?:^|\.)livestorm\.co$/i, joinRe: /livestorm\.co\/[a-z0-9-]+\/([a-f0-9-]{8,})/i, note: 'Livestorm event host' },
  { platform: 'BigMarker', re: /(?:^|\.)bigmarker\.com$/i, joinRe: /bigmarker\.com\/([a-z0-9_-]{6,})/i, note: 'BigMarker host' },
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
 * Classify a hostname as a webinar-platform host.
 * @param {string} host
 * @returns {{isWebinarPlatform: boolean, platform: string, note: string, host: string}}
 */
export function classifyWebinarHost(host) {
  const h = normalizeHostname(host);
  for (const { platform, re, note } of WEBINAR_PLATFORM_PATTERNS) {
    if (re.test(h)) return { isWebinarPlatform: true, platform, note, host: h };
  }
  return { isWebinarPlatform: false, platform: '', note: '', host: h };
}

/**
 * Extract webinar platform references from arbitrary text (page HTML,
 * calendar invite bodies, email text): platform hosts, join URLs and
 * registration IDs.
 * @param {string} text page HTML or invite text
 * @returns {{platforms: {platform: string, note: string}[], joinLinks: {url: string, platform: string, refId: string}[], hosts: string[]}}
 */
export function extractWebinarSignals(text) {
  const raw = String(text || '');
  const hosts = new Set();
  const platforms = new Map();
  const joinLinks = [];
  const seenLinks = new Set();

  const urlRe = /https?:\/\/([a-z0-9][a-z0-9.-]*[a-z0-9])(\/[^\s"'<>]*)?/gi;
  let m;
  while ((m = urlRe.exec(raw)) !== null) {
    const host = normalizeHostname(m[1]);
    const verdict = classifyWebinarHost(host);
    if (!verdict.isWebinarPlatform) continue;
    hosts.add(host);
    if (!platforms.has(verdict.platform)) {
      platforms.set(verdict.platform, { platform: verdict.platform, note: verdict.note });
    }
    const fullUrl = m[0];
    if (seenLinks.has(fullUrl)) continue;
    seenLinks.add(fullUrl);
    let refId = '';
    for (const p of WEBINAR_PLATFORM_PATTERNS) {
      if (p.platform !== verdict.platform || !p.joinRe) continue;
      const idMatch = fullUrl.match(p.joinRe);
      if (idMatch) {
        refId = idMatch[1];
        break;
      }
    }
    joinLinks.push({ url: fullUrl, platform: verdict.platform, refId });
  }

  return {
    platforms: [...platforms.values()],
    joinLinks,
    hosts: [...hosts],
  };
}

/**
 * Mine webinar host evidence for an organization from a set of sources
 * (event pages, invite texts, newsletter bodies).
 * @param {{source: string, text: string}[]} sources labelled text sources
 * @returns {{source: string, webinarDetected: boolean, platforms: string[], hosts: string[], joinLinks: {url: string, platform: string, refId: string}[]}[]}
 */
export function mineWebinarPlatformHosts(sources) {
  return (sources || []).map((s) => {
    const signals = extractWebinarSignals(s.text);
    return {
      source: s.source,
      webinarDetected: signals.hosts.length > 0,
      platforms: signals.platforms.map((p) => p.platform),
      hosts: signals.hosts,
      joinLinks: signals.joinLinks,
    };
  });
}
