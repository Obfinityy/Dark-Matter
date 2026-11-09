// Dark Matter rule-based scanner — same-origin crawler.
// Extracts links + forms + parameters from the target page for probing.
//
// SITE CRAWL (9 Nov 2026, owner order): the /* Whole-site scope
// follows same-origin links RECURSIVELY from the pasted page (BFS),
// so the battery tries every discovered route, not just the landing
// page. Caps per scan depth bound the walk so a large site cannot run
// forever (pasted page = depth 0). 'page' scope keeps the original
// one-page-deep behaviour exactly.
import { fetchPage } from './fingerprint.js';
import { extractAttributes } from './pageAnalyze.js';

// Scan scope: 'page' (default — one page deep, today's behaviour) or
// 'site' (/* — recursive same-origin crawl). Anything else is 'page'.
export function normalizeScanScope(value) {
  return value === 'site' ? 'site' : 'page';
}

// SITE CRAWL CAPS (9 Nov 2026): max link depth + max pages visited,
// by scan depth. Quick stays shallow and small; Deep walks furthest.
// The pasted page itself is depth 0 and always counts as 1 page.
export const SITE_CRAWL_CAPS = {
  quick: { maxDepth: 1, maxPages: 5 },
  standard: { maxDepth: 2, maxPages: 10 },
  deep: { maxDepth: 3, maxPages: 20 },
};

export function siteCrawlCaps(scanDepth) {
  const d = scanDepth === 'quick' || scanDepth === 'deep' ? scanDepth : 'standard';
  return SITE_CRAWL_CAPS[d];
}

// In site mode the scan-target list must hold every discovered page,
// so the maxUrls cap rises above the page cap: pages + 20 link slack
// (form-derived targets keep their separate +20 allowance in
// index.js). Page mode keeps the caller's maxUrls untouched.
export const SITE_MAX_URLS = { quick: 25, standard: 30, deep: 40 };

export function siteMaxUrls(scanDepth) {
  const d = scanDepth === 'quick' || scanDepth === 'deep' ? scanDepth : 'standard';
  return SITE_MAX_URLS[d];
}

function sameOrigin(base, href) {
  try {
    const b = new URL(base);
    const u = new URL(href, base);
    return u.protocol === b.protocol && u.host === b.host;
  } catch {
    return false;
  }
}

export function extractLinks(body, base) {
  const urls = new Set();
  const re = /<a[^>]+href=["']([^"'#]+)["']/gi;
  let m;
  while ((m = re.exec(String(body || '')))) {
    const href = m[1].trim();
    if (!href || href.startsWith('javascript:') || href.startsWith('mailto:')) continue;
    if (sameOrigin(base, href)) {
      try {
        urls.add(new URL(href, base).toString().split('#')[0]);
      } catch {
        // ignore
      }
    }
  }
  return [...urls].slice(0, 200);
}

export function extractForms(body, base) {
  const forms = [];
  const re = /<form[^>]*>([\s\S]*?)<\/form>/gi;
  let m;
  while ((m = re.exec(String(body || '')))) {
    const tag = m[0].slice(0, 400);
    const inner = m[1];
    const action = (/action=["']([^"']*)["']/i.exec(tag) || [])[1] || base;
    const method = ((/method=["']([^"']*)["']/i.exec(tag) || [])[1] || 'get').toLowerCase();
    // Inputs are { name, type, value } objects — the ONE shape every
    // consumer expects (D1, #474 repair, 8 Nov 2026). The old code
    // pushed bare name strings, so every consumer testing i.type ===
    // 'password' (sessionFixation, timingSideChannel, userEnum) never
    // matched a login form in production. Attributes parse
    // quote-agnostically (extractAttributes, shared with pageAnalyze):
    // DVWA's hidden token uses single quotes, unquoted attrs work too.
    // Inputs without a name are skipped — they cannot be submitted by
    // name. type defaults to 'text', value to '' (same defaults as
    // pageAnalyze.parseInputs).
    const inputs = [];
    const ire = /<input\b[^>]*>/gi;
    let im;
    while ((im = ire.exec(inner))) {
      const attrs = extractAttributes(im[0]);
      if (!attrs.name) continue;
      inputs.push({
        name: attrs.name,
        type: String(attrs.type || 'text').toLowerCase(),
        value: attrs.value ?? '',
      });
    }
    try {
      forms.push({ action: new URL(action, base).toString(), method, inputs });
    } catch {
      // ignore
    }
  }
  return forms.slice(0, 50);
}

export function extractParams(url) {
  try {
    const u = new URL(url);
    return [...u.searchParams.keys()];
  } catch {
    return [];
  }
}

export async function crawl(url, opts = {}) {
  // SITE CRAWL (9 Nov 2026): opts.scanScope === 'site' walks the
  // whole site recursively; anything else is the original one-page
  // crawl, byte-identical. opts.crawlFetcher is the test seam
  // (url, opts) => { url, body, headers }; production callers never
  // pass it, so the production path still calls fetchPage directly.
  if (normalizeScanScope(opts.scanScope) === 'site') return crawlSite(url, opts);
  const fetcher = typeof opts.crawlFetcher === 'function' ? opts.crawlFetcher : fetchPage;
  const page = await fetcher(url, opts);
  return {
    url: page.url,
    links: extractLinks(page.body, page.url),
    forms: extractForms(page.body, page.url),
    params: extractParams(page.url),
    headers: page.headers,
    body: page.body,
    scanScope: 'page',
    pagesScanned: 1,
    pages: [
      {
        url: page.url,
        body: page.body,
        links: extractLinks(page.body, page.url),
        forms: extractForms(page.body, page.url),
        params: extractParams(page.url),
      },
    ],
  };
}

// Recursive same-origin crawl (BFS from the pasted URL). Same-origin
// only; fragments stripped; javascript:/mailto: never followed;
// every visited URL fetched at most once. Returns the pasted page's
// fields at the top level (same shape as crawl(), so existing
// consumers keep working) plus `pages` — one entry per visited page
// with its own body/links/forms/params — and `pagesScanned`.
//
// KNOWN LIMIT (9 Nov 2026): the crawl fetches raw HTML only. Pages
// whose links appear solely after client-side rendering (SPA shells)
// contribute no links here — the DOM-render discovery in index.js
// still covers the pasted page's rendered routes, and tier-2 CDP
// drives stay on the pasted page.
export async function crawlSite(url, opts = {}) {
  const fetcher = typeof opts.crawlFetcher === 'function' ? opts.crawlFetcher : fetchPage;
  const { maxDepth, maxPages } = siteCrawlCaps(opts.scanDepth);
  const seen = new Set();
  const pages = [];
  const queue = [{ url, depth: 0 }];
  let root = null;
  while (queue.length && pages.length < maxPages) {
    const { url: current, depth } = queue.shift();
    let norm;
    try {
      norm = new URL(current).toString().split('#')[0];
    } catch {
      continue;
    }
    if (seen.has(norm)) continue;
    seen.add(norm);
    let page;
    try {
      page = await fetcher(norm, opts);
    } catch {
      continue;
    }
    const pageUrl = page.url || norm;
    const links = extractLinks(page.body, pageUrl);
    const forms = extractForms(page.body, pageUrl);
    const entry = {
      url: pageUrl,
      body: page.body,
      links,
      forms,
      params: extractParams(pageUrl),
    };
    pages.push(entry);
    if (!root) root = { ...entry, headers: page.headers };
    if (depth < maxDepth) {
      for (const l of links) {
        try {
          const ln = new URL(l).toString().split('#')[0];
          if (!seen.has(ln)) queue.push({ url: ln, depth: depth + 1 });
        } catch {
          // ignore malformed links
        }
      }
    }
  }
  if (!root) {
    throw new Error('site crawl: could not fetch the pasted page');
  }
  const allLinks = [...new Set(pages.flatMap((p) => p.links))].slice(0, 200);
  const allForms = pages.flatMap((p) => p.forms).slice(0, 200);
  return {
    url: root.url,
    links: allLinks,
    forms: allForms,
    params: extractParams(root.url),
    headers: root.headers,
    body: root.body,
    scanScope: 'site',
    pagesScanned: pages.length,
    maxDepth,
    maxPages,
    pages,
  };
}
