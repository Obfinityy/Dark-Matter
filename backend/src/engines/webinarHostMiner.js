/**
 * webinarHostMiner.js — Webinar platform host mining engine.
 *
 * Discovers Zoom webinar, GoToWebinar, and Demio hosts linked to an
 * organisation from passive signals:
 *  - Zoom: zoom.us/w/<id>, zoom.us/webinar/register/<id>, us02web.zoom.us links
 *  - GoToWebinar: register.gotowebinar.com, *.gotowebinar.com, attendee links
 *  - Demio: *.demio.com event pages, event.demio.com embeds
 *
 * Pure discovery: parses already-collected pages/DNS data, no live calls.
 */

const WEBINAR_PLATFORMS = [
  { name: 'Zoom', hostRe: /\b([a-z0-9-]+\.zoom\.us|zoom\.us)\b/i },
  {
    name: 'GoToWebinar',
    hostRe: /\b([a-z0-9-]+\.gotowebinar\.com|gotowebinar\.com|register\.gotowebinar\.com)\b/i,
  },
  { name: 'Demio', hostRe: /\b([a-z0-9-]+\.demio\.com|demio\.com|event\.demio\.com)\b/i },
];

/**
 * Classify a webinar host.
 * @param {string} hostname
 * @returns {{platform: string, host: string}|null}
 */
export function classifyWebinarHost(hostname = '') {
  const h = String(hostname).toLowerCase().replace(/\.$/, '');
  for (const p of WEBINAR_PLATFORMS) {
    const m = h.match(p.hostRe);
    if (m) return { platform: p.name, host: (m[1] || m[0]).toLowerCase() };
  }
  return null;
}

/**
 * Extract webinar registration/event URLs from text.
 * @param {string} text page source or notes
 * @returns {{platform: string, url: string, eventId: string|null}[]}
 */
export function extractWebinarLinks(text = '') {
  const t = String(text || '');
  const out = [];
  const seen = new Set();
  const patterns = [
    {
      platform: 'Zoom',
      re: /https?:\/\/(?:[a-z0-9-]+\.)?zoom\.us\/(?:w|webinar|j)\/([a-z0-9_-]+)/gi,
    },
    {
      platform: 'Zoom',
      re: /https?:\/\/(?:[a-z0-9-]+\.)?zoom\.us\/webinar\/register\/([a-z0-9_-]+)/gi,
    },
    {
      platform: 'GoToWebinar',
      re: /https?:\/\/(?:[a-z0-9-]+\.)?gotowebinar\.com\/register\/(\d+)/gi,
    },
    { platform: 'GoToWebinar', re: /https?:\/\/register\.gotowebinar\.com\/rt\/(\d+)/gi },
    { platform: 'Demio', re: /https?:\/\/(?:[a-z0-9-]+\.)?demio\.com\/(?:join\/)?([a-z0-9-]+)/gi },
  ];
  for (const { platform, re } of patterns) {
    let m;
    while ((m = re.exec(t)) !== null) {
      const url = m[0];
      if (seen.has(url)) continue;
      seen.add(url);
      out.push({ platform, url, eventId: m[1] || null });
    }
  }
  return out;
}

/**
 * Extract all webinar-platform hostnames referenced in text.
 * @param {string} text
 * @returns {string[]} unique hostnames
 */
export function extractWebinarHosts(text = '') {
  const hosts = new Set();
  const re = /\b([a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:zoom\.us|gotowebinar\.com|demio\.com))\b/gi;
  let m;
  while ((m = re.exec(String(text))) !== null) hosts.add(m[1].toLowerCase());
  return [...hosts];
}

/**
 * Map CNAME records to webinar platform hosts.
 * @param {{name: string, target: string}[]} cnameRecords
 * @returns {{alias: string, platform: string, host: string}[]}
 */
export function mapWebinarCnames(cnameRecords = []) {
  const out = [];
  for (const rec of cnameRecords || []) {
    if (!rec || !rec.name || !rec.target) continue;
    const target = String(rec.target).toLowerCase().replace(/\.$/, '');
    const cls = classifyWebinarHost(target);
    if (cls) {
      out.push({
        alias: String(rec.name).toLowerCase().replace(/\.$/, ''),
        platform: cls.platform,
        host: target,
      });
    }
  }
  return out;
}

/**
 * Full mining pass.
 * @param {{htmlPages: string[], cnames: {name:string,target:string}[]}} input
 * @returns {{links: object[], hosts: string[], cnameHits: object[]}}
 */
export function mineWebinarFootprint({ htmlPages = [], cnames = [] } = {}) {
  const links = (htmlPages || []).flatMap(extractWebinarLinks);
  const hosts = [...new Set((htmlPages || []).flatMap(extractWebinarHosts))];
  const cnameHits = mapWebinarCnames(cnames);
  return { links, hosts, cnameHits };
}
