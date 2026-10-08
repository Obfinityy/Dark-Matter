/**
 * devPortalMiner.js — Developer-portal sitemap miner.
 *
 * Parses fetched developer-portal sitemap XML (sitemap.xml / sitemap index)
 * and filters docs pages likely to document API hosts:
 *  - scores each URL by doc-section keywords (api, reference, endpoint, auth, sdk)
 *  - extracts declared base hosts from the sitemap URL set itself
 *  - prioritizes recently modified pages via <lastmod>
 *
 * Pure functions: takes fetched sitemap XML text, returns structured intel.
 */

const URL_BLOCK_RE = /<url>([\s\S]*?)<\/url>/gi;
const LOC_RE = /<loc>\s*([^<\s]+)\s*<\/loc>/i;
const LASTMOD_RE = /<lastmod>\s*([^<\s]+)\s*<\/lastmod>/i;
const SITEMAP_LOC_RE = /<sitemap>([\s\S]*?)<\/sitemap>/gi;
const HOST_RE = /^https?:\/\/([^/:]+)/i;

const SECTION_SCORES = [
  [/\/api[\/-]|api-reference|api-docs/i, 3, 'api-section'],
  [/endpoint|rest|graphql|webhook|websocket/i, 2, 'endpoint-docs'],
  [/authentication|auth|oauth|token|key/i, 2, 'auth-docs'],
  [/sdk|client|libraries?|quickstart|getting-started/i, 2, 'sdk-docs'],
  [/changelog|release-notes|migration|deprecat/i, 2, 'changelog'],
  [/tutorial|guide|how-to|example/i, 1, 'guide'],
];

/** Parse a single <url> block into { loc, lastmod }. */
export function parseUrlBlock(block) {
  const loc = (block.match(LOC_RE) || [])[1] || '';
  const lastmod = (block.match(LASTMOD_RE) || [])[1] || null;
  return { loc, lastmod };
}

/** Parse sitemap XML text into page entries. */
export function parseSitemap(xml = '') {
  if (typeof xml !== 'string') throw new TypeError('xml must be a string');
  const pages = [];
  URL_BLOCK_RE.lastIndex = 0;
  let m;
  while ((m = URL_BLOCK_RE.exec(xml))) {
    const p = parseUrlBlock(m[1]);
    if (p.loc) pages.push(p);
  }
  return pages;
}

/** Extract nested sitemap URLs from a sitemap index document. */
export function parseSitemapIndex(xml = '') {
  if (typeof xml !== 'string') throw new TypeError('xml must be a string');
  const out = [];
  SITEMAP_LOC_RE.lastIndex = 0;
  let m;
  while ((m = SITEMAP_LOC_RE.exec(xml))) {
    const p = parseUrlBlock(m[1]);
    if (p.loc) out.push(p);
  }
  return out;
}

/** Score how likely a docs URL is to document API hosts. */
export function scoreDocsUrl(loc = '') {
  let score = 0;
  const reasons = [];
  for (const [re, pts, label] of SECTION_SCORES) {
    if (re.test(loc)) {
      score += pts;
      reasons.push(label);
    }
  }
  if (/\/blog\/|\/news\/|\/careers\/|\/press\//i.test(loc)) score -= 2;
  return { score, reasons };
}

/**
 * Mine a developer-portal sitemap for API-host-documenting pages.
 * @param {object} input
 * @param {string} input.url - sitemap URL (provenance)
 * @param {string} input.xml - fetched sitemap XML text
 * @param {number} [input.minScore=2] - minimum relevance score to surface
 * @returns prioritized docs pages plus declared hosts
 */
export function mineDevPortalSitemap({ url = '', xml = '', minScore = 2 } = {}) {
  const pages = parseSitemap(xml);
  const scored = pages
    .map(p => ({ ...p, ...scoreDocsUrl(p.loc) }))
    .filter(p => p.score >= minScore)
    .sort((a, b) => b.score - a.score || String(b.lastmod).localeCompare(String(a.lastmod)));

  const hosts = new Set();
  for (const p of pages) {
    const hm = p.loc.match(HOST_RE);
    if (hm) hosts.add(hm[1].toLowerCase());
  }

  return {
    url,
    type: 'Developer-Portal Sitemap Mining',
    confidence: scored.length ? 'medium' : 'low',
    evidence: `${pages.length} sitemap page(s) parsed, ${scored.length} match API-documentation sections (score >= ${minScore}).`,
    totalPages: pages.length,
    hosts: [...hosts],
    priorityPages: scored.slice(0, 200),
    sitemapIndexChildren: [], // filled by caller when handling index docs
  };
}

export const DEV_PORTAL_MINER = {
  parseSitemap,
  parseSitemapIndex,
  parseUrlBlock,
  scoreDocsUrl,
  mineDevPortalSitemap,
};
export default DEV_PORTAL_MINER;
