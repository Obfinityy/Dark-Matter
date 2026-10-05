/**
 * freshdeskPortalMapper.js — Freshdesk portal host mapping engine.
 *
 * @idea 00285 — Freshdesk portal host mapping — map freshdesk.com portals
 *   to the org via CNAME records.
 *
 * Freshdesk support portals live on *.freshdesk.com (or on a custom domain
 * CNAME'd to it). This engine maps branded subdomains to their Freshdesk
 * account slug from DNS CNAME evidence and extracts portal branding from
 * page HTML to attribute the portal to the org.
 *
 * Pure functions only: callers fetch DNS records and page HTML themselves.
 * No live network calls here.
 */

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
 * Decide whether a hostname is a Freshdesk-hosted portal and extract the
 * account slug.
 * @param {string} host
 * @returns {{isFreshdesk: boolean, host: string, account: string}}
 */
export function isFreshdeskHost(host) {
  const h = normalizeHostname(host);
  const m = h.match(/^([a-z0-9][a-z0-9-]*)\.freshdesk\.com$/i);
  if (m) return { isFreshdesk: true, host: h, account: m[1] };
  return { isFreshdesk: false, host: h, account: '' };
}

/**
 * Extract branding signals from a Freshdesk portal page's HTML: the portal
 * name, Freshdesk asset fingerprints, and contact/support metadata.
 * @param {string} html page HTML
 * @returns {{portalName: string, hasFreshdeskMarkers: boolean, title: string, contactEmails: string[]}}
 */
export function extractFreshdeskBranding(html) {
  const text = String(html || '');
  const out = { portalName: '', hasFreshdeskMarkers: false, title: '', contactEmails: [] };

  const portalPatterns = [
    /<meta[^>]+property=["']og:site_name["'][^>]*content=["']([^"']+)/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:site_name["']/i,
    /portal\.name\s*=\s*["']([^"']+)/i,
    /Freshdesk\s*[—–-]\s*([^<]{2,80})/i,
  ];
  for (const re of portalPatterns) {
    const m = text.match(re);
    if (m) {
      out.portalName = m[1].trim();
      break;
    }
  }

  const titleMatch = text.match(/<title>([^<]{1,160})<\/title>/i);
  if (titleMatch) out.title = titleMatch[1].replace(/\s+/g, ' ').trim();

  out.hasFreshdeskMarkers = /(?:cdn|assets)\.freshdesk\.com|freshdesk|fwf-widget|helpdesk-ticket/i.test(text);

  const emailRe = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
  const emails = new Set();
  let m;
  while ((m = emailRe.exec(text)) !== null) {
    if (!/example\.(com|org)|noreply|no-reply/.test(m[0])) emails.add(m[0].toLowerCase());
    if (emails.size >= 10) break;
  }
  out.contactEmails = [...emails];
  return out;
}

/**
 * Map DNS records to Freshdesk portals: subdomains CNAME'd to
 * *.freshdesk.com, with the account slug extracted.
 * @param {{query: string, type: string, value: string}[]} records DNS records
 *   already fetched by the caller (CNAME)
 * @returns {{query: string, freshdeskAccount: string, target: string, recordType: string}[]}
 */
export function mapFreshdeskPortalsFromDns(records) {
  const findings = [];
  const seen = new Set();
  for (const r of records || []) {
    if (!r || !r.value) continue;
    if (String(r.type || '').toUpperCase() !== 'CNAME') continue;
    const verdict = isFreshdeskHost(r.value);
    if (!verdict.isFreshdesk) continue;
    const query = normalizeHostname(r.query);
    if (seen.has(query)) continue;
    seen.add(query);
    findings.push({
      query,
      freshdeskAccount: verdict.account,
      target: verdict.host,
      recordType: 'CNAME',
    });
  }
  return findings;
}

/**
 * Attribute each mapped Freshdesk portal to the organization using page
 * branding evidence.
 * @param {{query: string, freshdeskAccount: string, target: string, recordType: string}[]} dnsFindings
 * @param {{query: string, html: string}[]} pages page HTML keyed by the queried hostname
 * @returns {{query: string, freshdeskAccount: string, target: string, brand: string, brandConfidence: string, contactEmails: string[], evidence: string[]}[]}
 */
export function attributeFreshdeskPortals(dnsFindings, pages) {
  const htmlByQuery = new Map((pages || []).map((p) => [normalizeHostname(p.query), p.html]));
  return (dnsFindings || []).map((f) => {
    const branding = extractFreshdeskBranding(htmlByQuery.get(f.query) || '');
    const evidence = [`CNAME ${f.query} -> ${f.target}`, `Freshdesk account slug '${f.freshdeskAccount}'`];
    let brand = f.freshdeskAccount;
    let brandConfidence = 'low';
    if (branding.portalName) {
      brand = branding.portalName;
      brandConfidence = 'high';
      evidence.push(`portal name '${branding.portalName}'`);
    } else if (branding.title) {
      brand = branding.title;
      brandConfidence = 'medium';
      evidence.push(`page title '${branding.title}'`);
    }
    if (branding.hasFreshdeskMarkers) {
      evidence.push('Freshdesk asset/marker fingerprints in page HTML');
      if (brandConfidence === 'low') brandConfidence = 'medium';
    }
    return {
      query: f.query,
      freshdeskAccount: f.freshdeskAccount,
      target: f.target,
      brand,
      brandConfidence,
      contactEmails: branding.contactEmails,
      evidence,
    };
  });
}
