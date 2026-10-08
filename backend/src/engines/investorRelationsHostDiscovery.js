/**
 * investorRelationsHostDiscovery.js — Investor-relations platform host discovery.
 *
 * Public companies host investor relations on specialist SaaS platforms —
 * Q4 Inc (q4inc.com), Notified (notified.com), Q4 Web Systems, and similar.
 * Investor pages link out to those platforms, and the IR platform hosts are
 * part of the target's public infrastructure worth mapping.
 *
 * Passive analysis: parse investor-page HTML/links for IR-platform hosts
 * and map them back to the organisation.
 */

/** Known investor-relations SaaS providers and host signatures. */
const IR_PROVIDERS = [
  { name: 'Q4 Inc', hostMatch: /(^|\.)q4inc\.com$/, pathHint: /investor/i },
  { name: 'Notified', hostMatch: /(^|\.)notified\.com$/, pathHint: /investor/i },
  { name: 'Q4 Web Systems', hostMatch: /(^|\.)q4websystems\.com$/, pathHint: /investor/i },
  { name: 'Nasdaq IR', hostMatch: /(^|\.)nasdaq\.com$/, pathHint: /investor|market-activity/i },
  { name: 'Broadridge', hostMatch: /(^|\.)broadridge\.com$/, pathHint: /investor/i },
  { name: 'Computershare', hostMatch: /(^|\.)computershare\.com$/, pathHint: /investor/i },
  { name: 'AST', hostMatch: /(^|\.)astfinancial\.com$/, pathHint: /investor/i },
  { name: 'S&P Global', hostMatch: /(^|\.)spglobal\.com$/, pathHint: /investor/i },
];

const IR_PAGE_HINTS =
  /(investor-?relations|\/investors?\b|ir\.[a-z0-9.-]+|financial-?results|annual-?report|sec-?filings?|shareholder)/i;
const LINK_ATTRS = /(?:href|src)=["']([^"']+)["']/gi;

/**
 * Identify an IR platform provider from a URL/hostname.
 * @param {string} urlOrHost
 * @returns {{provider: string}|null}
 */
export function identifyIrProvider(urlOrHost) {
  const raw = String(urlOrHost || '');
  let host = raw;
  try {
    host = new URL(raw.startsWith('http') ? raw : `https://${raw}`).hostname.toLowerCase();
  } catch {
    host = raw.toLowerCase();
  }
  for (const p of IR_PROVIDERS) {
    if (p.hostMatch.test(host)) return { provider: p.name, host };
  }
  return null;
}

/**
 * Scan investor-page HTML for outbound links to IR platforms.
 * @param {string} html page HTML
 * @param {string} [pageUrl] page the HTML came from (for evidence)
 * @returns {object[]} {provider, url, host, anchor, evidence}
 */
export function discoverIrHosts(html, pageUrl = '') {
  const body = String(html || '');
  const seen = new Set();
  const findings = [];
  const evidence = pageUrl || '(inline)';

  LINK_ATTRS.lastIndex = 0;
  let m;
  while ((m = LINK_ATTRS.exec(body)) !== null) {
    const link = m[1];
    if (!/^https?:\/\//i.test(link)) continue;
    const ir = identifyIrProvider(link);
    if (!ir) continue;
    const key = `${ir.provider}:${link}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    // Capture anchor text when the link is a full <a> tag.
    const tagStart = body.lastIndexOf('<a', m.index);
    const tagEnd = body.indexOf('</a>', m.index);
    let anchor = '';
    if (tagStart !== -1 && tagEnd !== -1 && tagEnd - tagStart < 600) {
      anchor = body
        .slice(body.indexOf('>', m.index) + 1, tagEnd)
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120);
    }
    findings.push({ provider: ir.provider, url: link, host: ir.host, anchor, evidence });
  }
  return findings;
}

/**
 * Heuristic: does the page look like an investor-relations page?
 * @param {string} url page URL
 * @param {string} [html] optional HTML/title to strengthen the signal
 * @returns {boolean}
 */
export function isInvestorPage(url, html = '') {
  if (IR_PAGE_HINTS.test(String(url || ''))) return true;
  const title = String(html || '').match(/<title[^>]*>([^<]*)<\/title>/i);
  return !!(title && /investor/i.test(title[1]));
}

/**
 * Extract the IR-platform "site slug" from a Q4/Notified-style URL, e.g.
 * https://investors.acme.q4inc.com/overview → "acme".
 * @param {string} url
 * @returns {string|null}
 */
export function extractIrSiteSlug(url) {
  try {
    const u = new URL(String(url));
    const parts = u.hostname.toLowerCase().split('.');
    // investors.<slug>.q4inc.com → slug is between the page label and provider
    const labels = ['investors', 'investor', 'ir'];
    if (parts.length >= 4 && labels.includes(parts[0])) return parts[1];
    return null;
  } catch {
    return null;
  }
}

export const IR_HOST_DISCOVERY = {
  IR_PROVIDERS: IR_PROVIDERS.map(p => p.name),
  identifyIrProvider,
  discoverIrHosts,
  isInvestorPage,
  extractIrSiteSlug,
};

export default IR_HOST_DISCOVERY;
