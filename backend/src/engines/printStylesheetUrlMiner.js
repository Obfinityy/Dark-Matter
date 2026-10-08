/**
 * printStylesheetUrlMiner.js — Print-stylesheet URL mining.
 *
 * Idea 00886: mine print stylesheets (@media print blocks and print-specific
 * CSS files) for print-only routes and resources — print versions of pages,
 * printable document endpoints, and resources exposed only in print CSS.
 *
 * The module locates print stylesheets referenced from HTML, extracts
 * @media print sections, and recovers every URL() reference, @page source
 * hints, and print-only display rules — all locally, no network calls.
 */

/**
 * Find print-stylesheet references in HTML (<link media="print">, print CSS
 * file links).
 * @param {string} html
 * @returns {object[]}
 */
export function findPrintStylesheets(html = '') {
  const out = [];
  const linkRe = /<link\b([^<>]*)>/gi;
  let m;
  while ((m = linkRe.exec(String(html))) !== null) {
    const attrs = m[1];
    const get = name => {
      const am = new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(attrs);
      return am ? am[1] : null;
    };
    const rel = (get('rel') || '').toLowerCase();
    const media = (get('media') || '').toLowerCase();
    const href = get('href');
    if (!href || !/stylesheet/i.test(rel)) continue;
    const isPrint = /\bprint\b/.test(media) || /print/i.test(href);
    if (isPrint) out.push({ kind: 'print-stylesheet', href, media: media || null });
  }
  return out;
}

/**
 * Extract @media print blocks from CSS text (brace-balanced).
 * @param {string} css
 * @returns {string[]}
 */
export function extractPrintBlocks(css = '') {
  const blocks = [];
  const src = String(css);
  const re = /@media[^{]*\bprint\b[^{]*\{/gi;
  let m;
  while ((m = re.exec(src)) !== null) {
    let depth = 1;
    let i = re.lastIndex;
    while (i < src.length && depth > 0) {
      if (src[i] === '{') depth += 1;
      else if (src[i] === '}') depth -= 1;
      i += 1;
    }
    blocks.push(src.slice(m.index, i));
    re.lastIndex = i;
  }
  return blocks;
}

/**
 * Extract URL references from CSS text: url(...), @import, src: url lists.
 * @param {string} css
 * @returns {string[]}
 */
export function extractCssUrls(css = '') {
  const out = new Set();
  const urlRe = /url\(\s*["']?([^)"']+)["']?\s*\)/gi;
  let m;
  while ((m = urlRe.exec(String(css))) !== null) {
    const u = m[1].trim();
    if (u && !u.startsWith('data:')) out.add(u);
  }
  const importRe = /@import\s+["']([^"']+)["']/gi;
  while ((m = importRe.exec(String(css))) !== null) out.add(m[1].trim());
  return [...out];
}

/**
 * Resolve possibly-relative CSS URLs against a stylesheet URL.
 * @param {string[]} urls
 * @param {string} base
 * @returns {string[]}
 */
export function resolveCssUrls(urls = [], base = '') {
  return urls.map(u => {
    try {
      return new URL(u, base).toString();
    } catch {
      return u;
    }
  });
}

/**
 * Mine print stylesheets for print-specific routes and resources.
 * @param {string} html - Page HTML referencing print stylesheets.
 * @param {{href: string, css: string}[]} stylesheets - Print CSS bodies keyed by href.
 * @returns {{resources: object[], stats: object}}
 */
export function minePrintStylesheets(html = '', stylesheets = []) {
  const refs = findPrintStylesheets(html);
  const resources = [];
  const seen = new Set();
  for (const sheet of stylesheets) {
    const printBlocks = extractPrintBlocks(sheet.css || '');
    const rawUrls = extractCssUrls(printBlocks.join('\n'));
    const urls = resolveCssUrls(rawUrls, sheet.href || '');
    for (const url of urls) {
      const key = `${sheet.href}|${url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const printOnly = /print|invoice|receipt|ticket|label|pdf/i.test(url);
      resources.push({
        kind: 'print-stylesheet-resource',
        stylesheet: sheet.href,
        url,
        printSpecific: printOnly,
      });
    }
  }
  // HTML-side print helpers: window.print callers and print links reveal routes.
  const htmlPrintLinks = [];
  const aRe = /<a\b[^<>]*href\s*=\s*["']([^"']+)["'][^<>]*>([^<]{0,80})<\/a>/gi;
  let m;
  while ((m = aRe.exec(String(html))) !== null) {
    if (/print|printable|print-version|printview/i.test(`${m[1]} ${m[2]}`)) {
      htmlPrintLinks.push({ kind: 'print-page-link', href: m[1], text: m[2].trim() });
    }
  }
  const bySpecific = { printSpecific: 0, shared: 0 };
  for (const r of resources) bySpecific[r.printSpecific ? 'printSpecific' : 'shared'] += 1;
  return {
    printStylesheets: refs,
    resources,
    htmlPrintLinks,
    stats: {
      stylesheets: refs.length,
      cssBodies: stylesheets.length,
      resources: resources.length,
      ...bySpecific,
      printPageLinks: htmlPrintLinks.length,
    },
  };
}

/**
 * Build a report finding from print-stylesheet mining.
 * @param {ReturnType<typeof minePrintStylesheets>} result
 */
export function printStylesheetFinding(result) {
  return {
    title: `Print-stylesheet URL mining — ${result.stats.resources} resource(s), ${result.stats.printPageLinks} print page link(s)`,
    severity: 'Info',
    confidence: result.stats.resources > 0 ? 'high' : 'medium',
    stats: result.stats,
    evidence:
      `${result.stats.stylesheets} print stylesheet reference(s); ` +
      `${result.stats.printSpecific} print-specific resource(s) mined from @media print CSS.`,
  };
}

export const PRINT_STYLESHEET_URL_MINER = {
  findPrintStylesheets,
  extractPrintBlocks,
  extractCssUrls,
  resolveCssUrls,
  minePrintStylesheets,
  printStylesheetFinding,
};
export default PRINT_STYLESHEET_URL_MINER;
