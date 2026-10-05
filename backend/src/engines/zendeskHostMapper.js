/**
 * zendeskHostMapper.js — Zendesk help-center host mapping engine.
 *
 * @idea 00282 — Zendesk help-center host mapping — map zendesk.com
 *   help-center subdomains to the org via CNAME and branding.
 *
 * Orgs host branded support portals on Zendesk via a CNAME from a subdomain
 * (e.g. support.example.com) to *.zendesk.com, often with a matching theme
 * that carries the org's brand name. This engine correlates DNS CNAME
 * evidence with page-branding evidence to map those portals back to the org.
 *
 * Pure functions only: callers fetch DNS records and page HTML themselves.
 * No live network calls here.
 */

const ZENDESK_BRANDING_HINTS = [
  /<meta[^>]+name=["']og:site_name["'][^>]+content=["']([^"']+)/i,
  /<title>([^<]*?(?:support|help\s*center|help\s*desk)[^<]*)<\/title>/i,
  /ZENDESK_HELP_CENTER|hc\.api|Zendesk-Embedded/i,
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
 * Decide whether a hostname belongs to Zendesk hosting.
 * @param {string} host
 * @returns {{isZendesk: boolean, host: string, account: string}}
 */
export function isZendeskHost(host) {
  const h = normalizeHostname(host);
  const m = h.match(/^([a-z0-9][a-z0-9-]*)\.zendesk\.com$/i);
  if (m) return { isZendesk: true, host: h, account: m[1] };
  return { isZendesk: false, host: h, account: '' };
}

/**
 * Extract branding signals from a help-center page's HTML: the
 * og:site_name, Zendesk-specific asset markers, and title.
 * @param {string} html page HTML
 * @returns {{siteName: string, hasZendeskMarkers: boolean, title: string, brandPhrases: string[]}}
 */
export function extractHelpCenterBranding(html) {
  const text = String(html || '');
  const out = { siteName: '', hasZendeskMarkers: false, title: '', brandPhrases: [] };
  const siteNameRe = /<meta[^>]+(?:name|property)=["'](?:og:site_name|site_name)["'][^>]*content=["']([^"']+)/i;
  const revRe = /<meta[^>]+content=["']([^"']+)["'][^>]*?(?:name|property)=["'](?:og:site_name|site_name)["']/i;
  const siteMatch = text.match(siteNameRe) || text.match(revRe);
  if (siteMatch) out.siteName = siteMatch[1].trim();
  const titleMatch = text.match(/<title>([^<]{1,160})<\/title>/i);
  if (titleMatch) out.title = titleMatch[1].replace(/\s+/g, ' ').trim();
  out.hasZendeskMarkers = /(?:assets|static)\.zendesk\.com|z3n\.help|help-center|guide-2|garden-style|ZendeskAPI/i.test(text);
  const phrases = new Set();
  for (const p of [out.siteName, out.title]) {
    if (p) phrases.add(p);
  }
  const logoAlt = text.match(/<img[^>]+alt=["']([^"']{2,80})["'][^>]*>/gi) || [];
  for (const tag of logoAlt.slice(0, 5)) {
    const m = tag.match(/alt=["']([^"']{2,80})["']/i);
    if (m) phrases.add(m[1].trim());
  }
  out.brandPhrases = [...phrases];
  return out;
}

/**
 * Map DNS records to Zendesk help-center hosts: subdomains CNAME'd to
 * *.zendesk.com, with the Zendesk account slug extracted.
 * @param {{query: string, type: string, value: string}[]} records DNS records
 *   already fetched by the caller (CNAME)
 * @returns {{query: string, zendeskAccount: string, target: string, recordType: string}[]}
 */
export function mapZendeskHostsFromDns(records) {
  const findings = [];
  const seen = new Set();
  for (const r of records || []) {
    if (!r || !r.value) continue;
    if (String(r.type || '').toUpperCase() !== 'CNAME') continue;
    const verdict = isZendeskHost(r.value);
    if (!verdict.isZendesk) continue;
    const query = normalizeHostname(r.query);
    if (seen.has(query)) continue;
    seen.add(query);
    findings.push({
      query,
      zendeskAccount: verdict.account,
      target: verdict.host,
      recordType: 'CNAME',
    });
  }
  return findings;
}

/**
 * Correlate DNS mappings with branding scraped from the portal pages to
 * attribute each Zendesk help center to the organization.
 * @param {{query: string, zendeskAccount: string, target: string, recordType: string}[]} dnsFindings
 * @param {{query: string, html: string}[]} pages page HTML keyed by the queried hostname
 * @returns {{query: string, zendeskAccount: string, target: string, brand: string, brandConfidence: string, evidence: string[]}[]}
 */
export function attributeZendeskPortals(dnsFindings, pages) {
  const htmlByQuery = new Map((pages || []).map((p) => [normalizeHostname(p.query), p.html]));
  return (dnsFindings || []).map((f) => {
    const branding = extractHelpCenterBranding(htmlByQuery.get(f.query) || '');
    const evidence = [`CNAME ${f.query} -> ${f.target}`, `Zendesk account slug '${f.zendeskAccount}'`];
    let brand = f.zendeskAccount;
    let brandConfidence = 'low';
    if (branding.siteName) {
      brand = branding.siteName;
      brandConfidence = 'high';
      evidence.push(`og:site_name '${branding.siteName}'`);
    } else if (branding.title) {
      brand = branding.title;
      brandConfidence = 'medium';
      evidence.push(`page title '${branding.title}'`);
    }
    if (branding.hasZendeskMarkers) {
      evidence.push('Zendesk asset/marker fingerprints in page HTML');
      if (brandConfidence === 'low') brandConfidence = 'medium';
    }
    return {
      query: f.query,
      zendeskAccount: f.zendeskAccount,
      target: f.target,
      brand,
      brandConfidence,
      evidence,
    };
  });
}
