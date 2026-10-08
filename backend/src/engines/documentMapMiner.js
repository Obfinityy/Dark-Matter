/**
 * documentMapMiner.js — Document-map crawl mining (ideas 00731–00740).
 *
 * Defensive discovery utilities for an authorized bug-bounty agent. Every
 * function below analyzes content handed to it — HTML strings, robots.txt
 * text, sitemap XML, well-known plain-text files, or URL corpora — and never
 * performs network I/O itself. The caller fetches the documents; this module
 * turns them into prioritized crawl plans, metadata inventories and seed
 * expansions.
 *
 * Covered ideas:
 *   00731 planIframeCrawl           — nested same-origin iframe crawl planning
 *   00732 extractCrossOriginIframeMeta — cross-origin iframe inventory for
 *                                       third-party integration mapping
 *   00733 parseSitemap / expandSitemapIndex — recursive sitemap-index mining
 *   00734 harvestRobotsDisallows    — priority-ranked Disallow harvesting
 *   00735 followRobotsSitemaps      — Sitemap: directive following
 *   00736 parseLlmsTxt              — llms.txt route/API documentation mining
 *   00737 discoverHumansTxtLinks     — humans.txt team/tool host discovery
 *   00738 parseSecurityTxt          — canonical contact endpoint confirmation
 *   00739 expandAdsTxtDomains       — ads.txt seller-domain seed expansion
 *   00740 buildWaybackSeedUrls / normalizeCorpusUrls — Wayback corpus seeding
 */

import { parseAdsTxt } from './adsTxtMapper.js';

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

/**
 * Resolve a possibly-relative reference against a base URL.
 * @param {string} ref
 * @param {string} [base]
 * @returns {string|null} absolute URL or null when unresolvable
 */
function resolveUrl(ref, base = '') {
  const raw = String(ref || '').trim();
  if (!raw || raw.startsWith('javascript:') || raw.startsWith('data:')) return null;
  try {
    return new URL(raw, base || 'https://placeholder.invalid').href;
  } catch {
    return null;
  }
}

/**
 * Extract the origin (scheme + host + port) of a URL.
 * @param {string} url
 * @returns {string|null}
 */
function originOf(url) {
  try {
    return new URL(String(url)).origin;
  } catch {
    return null;
  }
}

/**
 * Extract the hostname of a URL.
 * @param {string} url
 * @returns {string|null}
 */
function hostnameOf(url) {
  try {
    return new URL(String(url)).hostname || null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Idea 00731 — Iframe nested crawling                                 */
/* ------------------------------------------------------------------ */

/**
 * Plan a nested iframe crawl from a pre-collected frame tree.
 *
 * The tree is collected by the caller (browser automation, DOM snapshot,
 * HAR) as `{ src, sameOrigin?, children[] }`; this planner walks it and
 * marks which frames are safe to crawl recursively (same origin, within
 * depth budget) versus which must be treated as opaque third-party
 * embeds. No fetching happens here.
 *
 * @param {Object} iframeTree root frame node:
 *   `{ url, origin, children: [{ src, sameOrigin?, children[] }] }`
 * @param {Object} [opts] `{ maxDepth = 3, includeOpaque = false }`
 * @returns {{
 *   frames: Array<{ src, origin, depth, path, sameOrigin, crawlable, reason }>,
 *   sameOriginCount: number, crossOriginCount: number,
 *   unresolvableCount: number, maxDepthSeen: number, crawlableCount: number
 * }}
 */
export function planIframeCrawl(iframeTree, opts = {}) {
  const maxDepth = Number.isFinite(opts.maxDepth) ? opts.maxDepth : 3;
  const rootOrigin =
    iframeTree && iframeTree.origin
      ? String(iframeTree.origin)
      : originOf(iframeTree && iframeTree.url);

  const frames = [];
  let maxDepthSeen = 0;

  const walk = (node, depth, path) => {
    if (!node) return;
    maxDepthSeen = Math.max(maxDepthSeen, depth);
    const children = Array.isArray(node.children) ? node.children : [];
    children.forEach((child, idx) => {
      const src = resolveUrl(child.src, iframeTree && iframeTree.url);
      const childPath = `${path}/iframe[${idx}]`;
      const childOrigin = src ? originOf(src) : null;
      const sameOrigin =
        typeof child.sameOrigin === 'boolean'
          ? child.sameOrigin
          : Boolean(rootOrigin && childOrigin && rootOrigin === childOrigin);
      const childDepth = depth + 1;
      let crawlable = false;
      let reason = '';
      if (!src) {
        reason = 'unresolvable src — skipped';
      } else if (!sameOrigin) {
        reason = 'cross-origin — treated as opaque embed (metadata only)';
      } else if (childDepth > maxDepth) {
        reason = `depth ${childDepth} exceeds maxDepth ${maxDepth} — deferred`;
      } else {
        crawlable = true;
        reason = 'same-origin within depth budget — crawl recursively';
      }
      frames.push({
        src,
        origin: childOrigin,
        depth: childDepth,
        path: childPath,
        sameOrigin,
        crawlable,
        reason,
      });
      if (crawlable || opts.includeOpaque) walk(child, childDepth, childPath);
      else if (sameOrigin) walk(child, childDepth, childPath); // still enumerate deeper frames
    });
  };

  walk(iframeTree, 0, 'root');
  return {
    frames,
    sameOriginCount: frames.filter(f => f.sameOrigin).length,
    crossOriginCount: frames.filter(f => f.src && !f.sameOrigin).length,
    unresolvableCount: frames.filter(f => !f.src).length,
    maxDepthSeen,
    crawlableCount: frames.filter(f => f.crawlable).length,
  };
}

/* ------------------------------------------------------------------ */
/* Idea 00732 — Cross-origin iframe metadata                           */
/* ------------------------------------------------------------------ */

const IFRAME_TAG_RE = /<iframe\b[^>]*>/gi;
const ATTR_RE = /([\w-:]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

/**
 * Parse the attributes of a single HTML tag string.
 * @param {string} tag
 * @returns {Record<string, string|true>}
 */
function parseTagAttrs(tag) {
  const attrs = {};
  const inner = String(tag)
    .replace(/^<\w+\s*/, '')
    .replace(/\/?>$/, '');
  let m;
  ATTR_RE.lastIndex = 0;
  while ((m = ATTR_RE.exec(inner)) !== null) {
    const name = m[1].toLowerCase();
    attrs[name] =
      m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : true;
  }
  return attrs;
}

/**
 * Inventory every iframe in a page's HTML, separating same-origin frames
 * from cross-origin embeds. Cross-origin entries carry the metadata that
 * maps third-party integrations: host, sandbox policy, allow list, name and
 * title. Intended for third-party integration mapping on authorized targets.
 *
 * @param {string} html page HTML
 * @param {string} pageUrl URL of the page the HTML came from (origin basis)
 * @returns {{
 *   pageOrigin: string|null,
 *   total: number,
 *   sameOrigin: Array<{ src: string, name: string|null }>,
 *   crossOrigin: Array<{ src: string, host: string|null, sandbox: string|null,
 *     allow: string|null, name: string|null, title: string|null,
 *     loading: string|null, referrerpolicy: string|null }>,
 *   thirdPartyHosts: Array<{ host: string, frames: number, srcs: string[] }>
 * }}
 */
export function extractCrossOriginIframeMeta(html, pageUrl = '') {
  const pageOrigin = originOf(pageUrl);
  const tags = String(html || '').match(IFRAME_TAG_RE) || [];
  const sameOrigin = [];
  const crossOrigin = [];

  for (const tag of tags) {
    const attrs = parseTagAttrs(tag);
    const rawSrc = typeof attrs.src === 'string' ? attrs.src : '';
    const src = resolveUrl(rawSrc, pageUrl);
    if (!src) continue;
    const frameOrigin = originOf(src);
    const isSameOrigin = Boolean(pageOrigin && frameOrigin && pageOrigin === frameOrigin);
    const entry = {
      src,
      host: hostnameOf(src),
      sandbox:
        typeof attrs.sandbox === 'string' ? attrs.sandbox : attrs.sandbox === true ? '' : null,
      allow: typeof attrs.allow === 'string' ? attrs.allow : null,
      name: typeof attrs.name === 'string' ? attrs.name : null,
      title: typeof attrs.title === 'string' ? attrs.title : null,
      loading: typeof attrs.loading === 'string' ? attrs.loading : null,
      referrerpolicy: typeof attrs.referrerpolicy === 'string' ? attrs.referrerpolicy : null,
    };
    if (isSameOrigin) sameOrigin.push({ src, name: entry.name });
    else crossOrigin.push(entry);
  }

  const hostMap = new Map();
  for (const f of crossOrigin) {
    const host = f.host || '(unresolvable)';
    if (!hostMap.has(host)) hostMap.set(host, { host, frames: 0, srcs: [] });
    const e = hostMap.get(host);
    e.frames += 1;
    if (!e.srcs.includes(f.src)) e.srcs.push(f.src);
  }

  return {
    pageOrigin,
    total: sameOrigin.length + crossOrigin.length,
    sameOrigin,
    crossOrigin,
    thirdPartyHosts: [...hostMap.values()].sort((a, b) => b.frames - a.frames),
  };
}

/* ------------------------------------------------------------------ */
/* Idea 00733 — Sitemap.xml deep mining                                */
/* ------------------------------------------------------------------ */

/**
 * Parse sitemap XML (urlset or sitemapindex) with a dependency-free scanner.
 * Handles nested/paginated sitemap indexes by reporting child sitemap URLs;
 * use {@link expandSitemapIndex} to follow them recursively.
 *
 * @param {string} sitemapXml raw sitemap XML text
 * @param {string} [baseUrl] base used to resolve relative <loc> values
 * @returns {{
 *   kind: 'index'|'urlset'|'unknown',
 *   sitemaps: Array<{ loc: string, lastmod: string|null }>,
 *   urls: Array<{ loc: string, lastmod: string|null, changefreq: string|null, priority: string|null }>,
 *   errors: string[]
 * }}
 */
export function parseSitemap(sitemapXml, baseUrl = '') {
  const xml = String(sitemapXml || '');
  const errors = [];
  const sitemaps = [];
  const urls = [];

  const grab = (block, tag) => {
    const m = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
    return m ? m[1].trim() : null;
  };

  if (/<sitemapindex[\s>]/i.test(xml)) {
    const blocks = xml.match(/<sitemap\b[\s\S]*?<\/sitemap>/gi) || [];
    for (const block of blocks) {
      const loc = resolveUrl(grab(block, 'loc'), baseUrl);
      if (!loc) {
        errors.push('sitemap entry without resolvable <loc>');
        continue;
      }
      sitemaps.push({ loc, lastmod: grab(block, 'lastmod') });
    }
    return { kind: 'index', sitemaps, urls, errors };
  }

  if (/<urlset[\s>]/i.test(xml)) {
    const blocks = xml.match(/<url\b[\s\S]*?<\/url>/gi) || [];
    for (const block of blocks) {
      const loc = resolveUrl(grab(block, 'loc'), baseUrl);
      if (!loc) {
        errors.push('url entry without resolvable <loc>');
        continue;
      }
      urls.push({
        loc,
        lastmod: grab(block, 'lastmod'),
        changefreq: grab(block, 'changefreq'),
        priority: grab(block, 'priority'),
      });
    }
    return { kind: 'urlset', sitemaps, urls, errors };
  }

  errors.push('document is neither <sitemapindex> nor <urlset>');
  return { kind: 'unknown', sitemaps, urls, errors };
}

/**
 * Recursively expand a sitemap index given a map of already-fetched
 * sitemap documents. Pure: no fetching; the caller supplies
 * `{ [sitemapUrl]: xml }` and this walks nested/paginated indexes with
 * cycle protection.
 *
 * @param {Record<string, string>} sitemapDocs map of sitemap URL -> XML text
 * @param {string} startUrl index URL to start from
 * @param {Object} [opts] `{ maxDepth = 4, maxSitemaps = 500 }`
 * @returns {{
 *   startUrl: string,
 *   kind: string,
 *   visited: string[],
 *   sitemaps: Array<{ loc: string, lastmod: string|null, depth: number }>,
 *   urls: Array<{ loc: string, lastmod: string|null, changefreq: string|null,
 *     priority: string|null, via: string }>,
 *   truncated: boolean,
 *   missing: string[]
 * }}
 */
export function expandSitemapIndex(sitemapDocs, startUrl, opts = {}) {
  const maxDepth = Number.isFinite(opts.maxDepth) ? opts.maxDepth : 4;
  const maxSitemaps = Number.isFinite(opts.maxSitemaps) ? opts.maxSitemaps : 500;
  const docs = sitemapDocs || {};
  const visited = new Set();
  const sitemaps = [];
  const urls = [];
  const missing = [];
  let truncated = false;
  let kind = 'unknown';

  const queue = [{ url: startUrl, depth: 0 }];
  while (queue.length > 0) {
    if (visited.size >= maxSitemaps) {
      truncated = true;
      break;
    }
    const { url, depth } = queue.shift();
    if (visited.has(url) || depth > maxDepth) continue;
    visited.add(url);
    const xml = docs[url];
    if (xml === undefined) {
      missing.push(url);
      continue;
    }
    const parsed = parseSitemap(xml, url);
    if (visited.size === 1) kind = parsed.kind;
    for (const sm of parsed.sitemaps) {
      sitemaps.push({ ...sm, depth: depth + 1 });
      queue.push({ url: sm.loc, depth: depth + 1 });
    }
    for (const u of parsed.urls) urls.push({ ...u, via: url });
  }

  return {
    startUrl,
    kind,
    visited: [...visited],
    sitemaps,
    urls,
    truncated,
    missing,
  };
}

/* ------------------------------------------------------------------ */
/* Idea 00734 — Robots.txt disallow harvesting                         */
/* ------------------------------------------------------------------ */

/** Path patterns ranked by how often they guard sensitive functionality. */
const DISALLOW_RANKINGS = [
  {
    level: 'critical',
    score: 100,
    patterns: [
      /\.(git|svn|hg)\b/i,
      /\.env(\.|$)/i,
      /\bbackup\b/i,
      /\bbak\b/i,
      /\.sql(\.|$)/i,
      /\.bak(\.|$)/i,
    ],
  },
  {
    level: 'critical',
    score: 95,
    patterns: [
      /\bwp-admin\b/i,
      /\bphpmyadmin\b/i,
      /\badminer\b/i,
      /\bmanager\/html\b/i,
      /\bjmx-console\b/i,
    ],
  },
  {
    level: 'critical',
    score: 90,
    patterns: [
      /\badmin\b/i,
      /\bactuator\b/i,
      /\bconsole\b/i,
      /\bdebug\b/i,
      /\binternal\b/i,
      /\bprivate\b/i,
      /\bconfig\b/i,
      /\bsetup\b/i,
    ],
  },
  {
    level: 'high',
    score: 75,
    patterns: [
      /\bapi\b.*\b(v1|internal|private|admin)\b/i,
      /\bstaging\b/i,
      /\bdev(elopment)?\b/i,
      /\btest(ing)?\b/i,
      /\bswagger\b/i,
      /\bgraphql\b/i,
      /\bserver-status\b/i,
      /\bserver-info\b/i,
    ],
  },
  {
    level: 'high',
    score: 70,
    patterns: [
      /\btmp\b/i,
      /\btemp\b/i,
      /\blogs?\b/i,
      /\bcgi-bin\b/i,
      /\binclude\b/i,
      /\buploads?\b/i,
      /\bold\b/i,
      /\bnew\b/i,
    ],
  },
  {
    level: 'medium',
    score: 50,
    patterns: [
      /\bsearch\b/i,
      /\bcart\b/i,
      /\bcheckout\b/i,
      /\baccount\b/i,
      /\buser\b/i,
      /\blogin\b/i,
      /\bsignin\b/i,
      /\bregister\b/i,
    ],
  },
];

/**
 * Rank a single Disallow path against the sensitivity patterns.
 * @param {string} path
 * @returns {{ level: string, score: number, reasons: string[] }}
 */
function rankDisallowPath(path) {
  const reasons = [];
  let level = 'low';
  let score = 10;
  for (const rank of DISALLOW_RANKINGS) {
    for (const re of rank.patterns) {
      if (re.test(path)) {
        reasons.push(`matches ${re.source}`);
        if (rank.score > score) {
          score = rank.score;
          level = rank.level;
        }
      }
    }
  }
  if (/[*$]$/.test(path)) {
    reasons.push('wildcard/anchor pattern — may hide parameterized paths');
    score = Math.min(100, score + 5);
  }
  return { level, score, reasons };
}

/**
 * Harvest Disallow entries from robots.txt as a priority-ranked list of
 * sensitive paths. Groups entries by User-agent block and ranks each path
 * by how likely it guards sensitive functionality, so an authorized hunt
 * reviews the most interesting paths first.
 *
 * @param {string} robotsTxt raw robots.txt text
 * @returns {{
 *   groups: Array<{ agents: string[], disallows: string[], allows: string[] }>,
 *   ranked: Array<{ path: string, agents: string[], level: string, score: number, reasons: string[] }>
 * }}
 */
export function harvestRobotsDisallows(robotsTxt) {
  const groups = [];
  let current = null;

  for (const rawLine of String(robotsTxt || '').split(/\r?\n/)) {
    const line = rawLine.split('#')[0].trim();
    if (!line) continue;
    const m = line.match(/^([\w-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const field = m[1].toLowerCase();
    const value = m[2].trim();
    if (field === 'user-agent') {
      if (!current || current.sawRule) {
        current = { agents: [], disallows: [], allows: [], sawRule: false };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if (field === 'disallow') {
      if (!current) {
        current = { agents: ['*'], disallows: [], allows: [], sawRule: false };
        groups.push(current);
      }
      current.sawRule = true;
      if (value) current.disallows.push(value);
    } else if (field === 'allow') {
      if (!current) {
        current = { agents: ['*'], disallows: [], allows: [], sawRule: false };
        groups.push(current);
      }
      current.sawRule = true;
      if (value) current.allows.push(value);
    }
  }

  const byPath = new Map();
  for (const g of groups) {
    for (const path of g.disallows) {
      if (!byPath.has(path)) byPath.set(path, new Set());
      for (const a of g.agents) byPath.get(path).add(a);
    }
  }

  const ranked = [...byPath.entries()]
    .map(([path, agents]) => {
      const { level, score, reasons } = rankDisallowPath(path);
      return { path, agents: [...agents], level, score, reasons };
    })
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));

  return {
    groups: groups.map(g => ({ agents: g.agents, disallows: g.disallows, allows: g.allows })),
    ranked,
  };
}

/* ------------------------------------------------------------------ */
/* Idea 00735 — Robots.txt sitemap directive following                 */
/* ------------------------------------------------------------------ */

/**
 * Extract every `Sitemap:` directive from robots.txt. Sites often declare
 * alternate or paginated sitemaps here that are not linked from
 * `/sitemap.xml`, making this the entry point for sitemap deep mining.
 *
 * @param {string} robotsTxt raw robots.txt text
 * @returns {Array<{ url: string, agents: string[] }>} directives in file order
 */
export function followRobotsSitemaps(robotsTxt) {
  const directives = [];
  let agents = [];
  for (const rawLine of String(robotsTxt || '').split(/\r?\n/)) {
    const line = rawLine.split('#')[0].trim();
    if (!line) continue;
    const m = line.match(/^([\w-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const field = m[1].toLowerCase();
    const value = m[2].trim();
    if (field === 'user-agent') agents = [value.toLowerCase()];
    else if (field === 'sitemap' && value) {
      const url = resolveUrl(value);
      if (url) directives.push({ url, agents: [...agents] });
    }
  }
  return directives;
}

/* ------------------------------------------------------------------ */
/* Idea 00736 — Llms.txt documentation mining                          */
/* ------------------------------------------------------------------ */

const MD_LINK_RE = /\[([^\]]{0,200})\]\(([^)\s]{1,500})\)/g;
const BARE_URL_RE = /(?<![("'=])https?:\/\/[^\s<>"')\]]+/g;
const ROUTE_RE = /(^|[\s"'`(\[])([/][A-Za-z0-9._~!$&'()*+,;=:@%/-]{1,160})/g;

/**
 * Mine an llms.txt file (markdown documentation aimed at language models)
 * for documented routes, API descriptions and outbound links. These files
 * frequently enumerate endpoints, parameters and integration docs that are
 * not linked from the public site navigation.
 *
 * @param {string} text raw llms.txt markdown
 * @param {string} [baseUrl] base used to resolve relative links
 * @returns {{
 *   title: string|null,
 *   sections: Array<{ level: number, title: string, line: number }>,
 *   links: Array<{ text: string|null, url: string, line: number }>,
 *   routes: Array<{ path: string, line: number }>,
 *   apiMentions: Array<{ line: number, text: string }>
 * }}
 */
export function parseLlmsTxt(text, baseUrl = '') {
  const lines = String(text || '').split(/\r?\n/);
  const sections = [];
  const links = [];
  const routes = [];
  const apiMentions = [];
  let title = null;

  lines.forEach((rawLine, idx) => {
    const lineNo = idx + 1;
    const line = rawLine.trim();

    const h = line.match(/^(#{1,6})\s+(.+)$/);
    if (h) {
      const level = h[1].length;
      const heading = h[2].trim();
      sections.push({ level, title: heading, line: lineNo });
      if (level === 1 && !title) title = heading;
    }

    let m;
    MD_LINK_RE.lastIndex = 0;
    while ((m = MD_LINK_RE.exec(rawLine)) !== null) {
      const url = resolveUrl(m[2], baseUrl);
      if (url) links.push({ text: m[1].trim() || null, url, line: lineNo });
    }
    BARE_URL_RE.lastIndex = 0;
    while ((m = BARE_URL_RE.exec(rawLine)) !== null) {
      const url = m[0].replace(/[.,;:!?]+$/, '');
      if (!links.some(l => l.url === url && l.line === lineNo)) {
        links.push({ text: null, url, line: lineNo });
      }
    }

    ROUTE_RE.lastIndex = 0;
    while ((m = ROUTE_RE.exec(rawLine)) !== null) {
      const path = m[2];
      if (path.length > 1 && !path.startsWith('//') && !routes.some(r => r.path === path)) {
        routes.push({ path, line: lineNo });
      }
    }

    if (
      /\bapi\b/i.test(line) &&
      /\b(endpoint|route|parameter|authentication|token|key|request|response)\b/i.test(line)
    ) {
      apiMentions.push({ line: lineNo, text: line.slice(0, 220) });
    }
  });

  return { title, sections, links, routes, apiMentions };
}

/* ------------------------------------------------------------------ */
/* Idea 00737 — Humans.txt-linked asset discovery                      */
/* ------------------------------------------------------------------ */

/**
 * Discover hosts linked from humans.txt and classify them against the
 * hunt's known seed hosts. humans.txt credits people and tooling; the URLs
 * inside regularly reveal team sites, internal tools and staff-linked
 * domains that widen an authorized target's footprint.
 *
 * @param {string} text raw humans.txt text
 * @param {string[]} [seedHosts] already-known hosts (lowercased comparison)
 * @returns {{
 *   hosts: Array<{ host: string, urls: string[], contexts: string[] }>,
 *   newHosts: Array<{ host: string, urls: string[], contexts: string[] }>,
 *   emails: Array<{ email: string, domain: string|null }>,
 *   sections: string[]
 * }}
 */
export function discoverHumansTxtLinks(text, seedHosts = []) {
  const seeds = new Set((seedHosts || []).map(h => String(h).toLowerCase()));
  const lines = String(text || '').split(/\r?\n/);
  const hostMap = new Map();
  const emails = [];
  const sections = [];
  let context = null;

  const note = (host, url) => {
    if (!host) return;
    const key = host.toLowerCase();
    if (!hostMap.has(key)) hostMap.set(key, { host: key, urls: [], contexts: [] });
    const e = hostMap.get(key);
    if (url && !e.urls.includes(url)) e.urls.push(url);
    if (context && !e.contexts.includes(context)) e.contexts.push(context);
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const section = line.match(/^\/\*\s*([A-Z][A-Z /&'-]*)\s*\*?\/?$/);
    if (section) {
      context = section[1].trim().toLowerCase().replace(/\s+/g, ' ');
      if (!sections.includes(context)) sections.push(context);
      continue;
    }

    for (const m of line.matchAll(/https?:\/\/[^\s<>"')\]]+/g)) {
      const url = m[0].replace(/[.,;:!?]+$/, '');
      note(hostnameOf(url), url);
    }
    const www = line.match(/(?<![\w@:/.])(www\.[A-Za-z0-9.-]+\.[a-z]{2,})/i);
    if (www) note(www[1].toLowerCase(), `https://${www[1].toLowerCase()}`);

    for (const m of line.matchAll(/[\w.+-]+@[\w-]+\.[\w.-]+/g)) {
      const email = m[0].toLowerCase();
      if (!emails.some(e => e.email === email)) {
        emails.push({ email, domain: email.split('@')[1] || null });
      }
    }
  }

  const hosts = [...hostMap.values()].sort((a, b) => b.urls.length - a.urls.length);
  return {
    hosts,
    newHosts: hosts.filter(h => !seeds.has(h.host)),
    emails,
    sections,
  };
}

/* ------------------------------------------------------------------ */
/* Idea 00738 — Security.txt path enumeration                          */
/* ------------------------------------------------------------------ */

/**
 * Parse a security.txt file (RFC 9116) and confirm the canonical contact
 * endpoints it declares. The Contact and Canonical fields identify the
 * official reporting channels and the file's authoritative location —
 * both are stable, documented endpoints an authorized hunt can rely on
 * instead of guessing contact forms.
 *
 * @param {string} text raw security.txt text
 * @param {string} [baseUrl] target base used to resolve relative references
 * @returns {{
 *   contacts: Array<{ value: string, kind: 'email'|'url'|'phone'|'other', host: string|null }>,
 *   canonical: string[],
 *   expires: string|null,
 *   policy: string[], hiring: string[], acknowledgments: string[],
 *   preferredLanguages: string[],
 *   endpoints: Array<{ type: string, value: string, host: string|null, https: boolean }>,
 *   fields: Record<string, string[]>
 * }}
 */
export function parseSecurityTxt(text, baseUrl = '') {
  const fields = {};
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([\w-]+)\s*:\s*(.+)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    if (!fields[key]) fields[key] = [];
    fields[key].push(m[2].trim());
  }

  const classify = value => {
    if (/^mailto:/i.test(value)) return 'email';
    if (/^https?:\/\//i.test(value)) return 'url';
    if (/^tel:/i.test(value)) return 'phone';
    return 'other';
  };

  const contacts = (fields.contact || []).map(value => {
    const kind = classify(value);
    const host =
      kind === 'email'
        ? value.replace(/^mailto:/i, '').split('@')[1] || null
        : kind === 'url'
          ? hostnameOf(value)
          : null;
    return { value, kind, host };
  });

  const canonical = (fields.canonical || []).map(v => resolveUrl(v, baseUrl)).filter(Boolean);

  const urlList = key => (fields[key] || []).map(v => resolveUrl(v, baseUrl)).filter(Boolean);

  const endpoints = [];
  for (const c of contacts) {
    endpoints.push({
      type: 'contact',
      value: c.value,
      host: c.host,
      https: /^https:/i.test(c.value),
    });
  }
  for (const u of canonical) {
    endpoints.push({ type: 'canonical', value: u, host: hostnameOf(u), https: /^https:/i.test(u) });
  }

  return {
    contacts,
    canonical,
    expires: (fields.expires || [])[0] || null,
    policy: urlList('policy'),
    hiring: urlList('hiring'),
    acknowledgments: urlList('acknowledgments'),
    preferredLanguages: (fields['preferred-languages'] || []).flatMap(v =>
      v
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
    ),
    endpoints,
    fields,
  };
}

/* ------------------------------------------------------------------ */
/* Idea 00739 — Ads.txt-linked domain expansion                        */
/* ------------------------------------------------------------------ */

/**
 * Expand a hunt's seed domain set with the relationships declared in
 * ads.txt (IAB Authorized Digital Sellers). Seller domains, SUBDOMAIN /
 * OWNERDOMAIN / MANAGERDOMAIN declarations and CONTACT hosts regularly
 * surface ad-tech partner subdomains and sibling inventory domains that
 * belong to the authorized target's footprint.
 *
 * Grammar parsing is delegated to adsTxtMapper's `parseAdsTxt`; this
 * function focuses on seed-set expansion.
 *
 * @param {string} adsTxt raw ads.txt text
 * @param {string[]} [seedDomains] existing seed domains
 * @returns {{
 *   seeds: string[],
 *   added: Array<{ domain: string, via: string }>,
 *   sellerDomains: string[],
 *   declarationDomains: string[]
 * }}
 */
export function expandAdsTxtDomains(adsTxt, seedDomains = []) {
  const seeds = new Set(
    (seedDomains || []).map(d => String(d).toLowerCase().trim()).filter(Boolean)
  );
  const added = [];
  const add = (domain, via) => {
    const d = String(domain || '')
      .toLowerCase()
      .trim()
      .replace(/^www\./, '');
    if (!d || seeds.has(d) || added.some(a => a.domain === d)) return;
    seeds.add(d);
    added.push({ domain: d, via });
  };

  const parsed = parseAdsTxt(adsTxt);
  for (const r of parsed.records || []) {
    if (r.domain)
      add(r.domain, `ads.txt seller record (relationship=${r.relationship || 'unknown'})`);
  }
  for (const key of ['SUBDOMAIN', 'OWNERDOMAIN', 'MANAGERDOMAIN']) {
    for (const value of (parsed.declarations || {})[key] || []) {
      const host = hostnameOf(/^https?:\/\//i.test(value) ? value : `https://${value}`);
      if (host) add(host, `ads.txt ${key} declaration`);
    }
  }
  for (const contact of parsed.contacts || []) {
    const host = hostnameOf(/^https?:\/\//i.test(contact) ? contact : `https://${contact}`);
    if (host) add(host, 'ads.txt contact');
  }

  const sellerDomains = [
    ...new Set(
      (parsed.records || []).map(r => String(r.domain || '').toLowerCase()).filter(Boolean)
    ),
  ];
  const declarationDomains = added.filter(a => /declaration/.test(a.via)).map(a => a.domain);

  return { seeds: [...seeds].sort(), added, sellerDomains, declarationDomains };
}

/* ------------------------------------------------------------------ */
/* Idea 00740 — Wayback URL corpus seeding                             */
/* ------------------------------------------------------------------ */

const CDX_BASE = 'https://web.archive.org/cdx/search/cdx';

/**
 * Build Wayback CDX query URLs that seed a crawl frontier with the
 * archive's URL corpus for a target domain. Returns a ready-to-execute
 * query plan: the caller runs the URLs and feeds the responses into
 * {@link normalizeCorpusUrls}. No network I/O here.
 *
 * @param {string} domain target domain, e.g. "example.com"
 * @param {Object} [opts]
 *   `{ collapse='urlkey', from, to, limit=20000, includeWww=true,
 *      statusFilter='statuscode:200', mimeFilter='mimetype:text/html' }`
 * @returns {{
 *   domain: string,
 *   queries: Array<{ label: string, scope: string, url: string }>,
 *   plan: { collapse: string, limit: number, filters: string[], note: string }
 * }}
 */
export function buildWaybackSeedUrls(domain, opts = {}) {
  const clean = String(domain || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '');
  if (!clean)
    return {
      domain: '',
      queries: [],
      plan: { collapse: '', limit: 0, filters: [], note: 'empty domain' },
    };

  const collapse = opts.collapse || 'urlkey';
  const limit = Number.isFinite(opts.limit) ? opts.limit : 20000;
  const filters = [
    opts.statusFilter || 'statuscode:200',
    opts.mimeFilter || 'mimetype:text/html',
  ].filter(Boolean);

  const build = (urlPattern, matchType) => {
    const params = new URLSearchParams({
      url: urlPattern,
      output: 'json',
      matchType,
      collapse,
      limit: String(limit),
      fl: 'timestamp,original,statuscode,mimetype,digest',
    });
    for (const f of filters) params.append('filter', f);
    if (opts.from) params.set('from', String(opts.from));
    if (opts.to) params.set('to', String(opts.to));
    return `${CDX_BASE}?${params.toString()}`;
  };

  const queries = [
    { label: 'subdomain wildcard corpus', scope: `*.${clean}`, url: build(`*.${clean}`, 'domain') },
    { label: 'apex host corpus', scope: clean, url: build(`${clean}/*`, 'prefix') },
  ];
  if (opts.includeWww !== false && !clean.startsWith('www.')) {
    queries.push({
      label: 'www host corpus',
      scope: `www.${clean}`,
      url: build(`www.${clean}/*`, 'prefix'),
    });
  }

  return {
    domain: clean,
    queries,
    plan: {
      collapse,
      limit,
      filters,
      note: 'Run each query, parse the JSON array response, then pass rows through normalizeCorpusUrls to mint frontier seeds.',
    },
  };
}

/**
 * Normalize raw Wayback CDX rows into deduplicated crawl-frontier seed
 * URLs. Keeps successful HTML captures by default, drops error/redirect
 * captures and non-page assets, and can strip query strings so one
 * canonical seed represents a whole parameter family.
 *
 * @param {Array<Object>} records CDX rows as `{ timestamp, original,
 *   statuscode, mimetype }` (see waybackCdxIntel.parseWaybackCdx)
 * @param {Object} [opts]
 *   `{ domain, onlyOk=true, onlyHtml=true, stripQuery=false, max=5000 }`
 * @returns {{
 *   seeds: string[],
 *   stats: { total: number, kept: number, dropped: Record<string, number> }
 * }}
 */
export function normalizeCorpusUrls(records, opts = {}) {
  const onlyOk = opts.onlyOk !== false;
  const onlyHtml = opts.onlyHtml !== false;
  const stripQuery = opts.stripQuery === true;
  const max = Number.isFinite(opts.max) ? opts.max : 5000;
  const domain = opts.domain ? String(opts.domain).toLowerCase() : null;

  const dropped = {};
  const drop = reason => {
    dropped[reason] = (dropped[reason] || 0) + 1;
  };
  const seen = new Set();
  const seeds = [];

  for (const r of records || []) {
    const raw = String((r && r.original) || '').trim();
    if (!raw) {
      drop('empty original');
      continue;
    }
    let url;
    try {
      url = new URL(raw);
    } catch {
      drop('unparseable url');
      continue;
    }
    if (!/^https?:$/.test(url.protocol)) {
      drop('non-http scheme');
      continue;
    }
    if (
      domain &&
      url.hostname.toLowerCase() !== domain &&
      !url.hostname.toLowerCase().endsWith(`.${domain}`)
    ) {
      drop('out-of-scope host');
      continue;
    }
    if (onlyOk && r.statuscode && !String(r.statuscode).startsWith('2')) {
      drop(`status ${r.statuscode}`);
      continue;
    }
    if (onlyHtml && r.mimetype && !/^text\/html/i.test(String(r.mimetype))) {
      drop(`mimetype ${r.mimetype}`);
      continue;
    }
    if (stripQuery) {
      url.search = '';
      url.hash = '';
    } else url.hash = '';
    const key = url.href;
    if (seen.has(key)) {
      drop('duplicate');
      continue;
    }
    seen.add(key);
    seeds.push(key);
    if (seeds.length >= max) {
      drop('over max');
      break;
    }
  }

  return {
    seeds,
    stats: { total: (records || []).length, kept: seeds.length, dropped },
  };
}

/* ------------------------------------------------------------------ */
/* Combined summary                                                    */
/* ------------------------------------------------------------------ */

/**
 * Combine the outputs of this module's miners into one compact,
 * report-ready summary for a target.
 *
 * @param {Object} parts `{ iframePlan, iframeMeta, sitemap, robots, llms,
 *   humans, security, ads, wayback }` — any subset of miner outputs
 * @returns {{ targets: number, notes: string[] }}
 */
export function summarizeDocumentMap(parts = {}) {
  const notes = [];
  let targets = 0;

  if (parts.iframePlan) {
    targets += parts.iframePlan.crawlableCount || 0;
    notes.push(
      `iframe crawl plan: ${parts.iframePlan.crawlableCount || 0} same-origin frames crawlable, ${parts.iframePlan.crossOriginCount || 0} cross-origin embeds inventoried`
    );
  }
  if (parts.iframeMeta) {
    targets += (parts.iframeMeta.thirdPartyHosts || []).length;
    notes.push(
      `third-party integrations: ${(parts.iframeMeta.thirdPartyHosts || []).length} distinct hosts across ${parts.iframeMeta.total || 0} iframes`
    );
  }
  if (parts.sitemap) {
    const n = (parts.sitemap.urls || []).length;
    targets += n;
    notes.push(
      `sitemap mining: ${n} URLs from ${parts.sitemap.visited ? parts.sitemap.visited.length : 1} sitemap document(s)`
    );
  }
  if (parts.robots) {
    const ranked = parts.robots.ranked || [];
    const hot = ranked.filter(r => r.level === 'critical' || r.level === 'high').length;
    targets += hot;
    notes.push(
      `robots.txt: ${ranked.length} disallows harvested, ${hot} ranked critical/high priority`
    );
    if (parts.robots.sitemaps)
      notes.push(`robots.txt declares ${parts.robots.sitemaps.length} sitemap directive(s)`);
  }
  if (parts.llms) {
    const n = (parts.llms.routes || []).length + (parts.llms.links || []).length;
    targets += n;
    notes.push(
      `llms.txt: ${(parts.llms.routes || []).length} routes and ${(parts.llms.links || []).length} links documented`
    );
  }
  if (parts.humans) {
    targets += (parts.humans.newHosts || []).length;
    notes.push(
      `humans.txt: ${(parts.humans.newHosts || []).length} new hosts discovered beyond seed set`
    );
  }
  if (parts.security) {
    targets += (parts.security.endpoints || []).length;
    notes.push(
      `security.txt: ${(parts.security.endpoints || []).length} canonical contact endpoints confirmed`
    );
  }
  if (parts.ads) {
    targets += (parts.ads.added || []).length;
    notes.push(
      `ads.txt: ${(parts.ads.added || []).length} new seed domains from seller relationships`
    );
  }
  if (parts.wayback) {
    targets += (parts.wayback.seeds || []).length;
    notes.push(`wayback corpus: ${(parts.wayback.seeds || []).length} frontier seeds normalized`);
  }

  return { targets, notes };
}
