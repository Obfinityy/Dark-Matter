/**
 * adsTxtMapper.js — ads.txt seller-domain mapping.
 *
 * `/ads.txt` (IAB Authorized Digital Sellers) lists every domain allowed to
 * sell the publisher's ad inventory as `domain, publisher_id, relationship,
 * cert_authority_id`. Seller entries, SUBDOMAIN/OWNERDOMAIN/MANAGERDOMAIN
 * declarations and CONTACT fields expose ad-tech partner subdomains and
 * sibling inventory domains for an authorized target.
 *
 * All functions are pure: the caller fetches the file, this module parses it.
 */

/** Well-known locations of the ads.txt file. */
export const CANDIDATE_PATHS = [
  '/ads.txt',
  '/.well-known/ads.txt',
];

/**
 * Build candidate file URLs for a target.
 * @param {string} baseUrl target origin, e.g. "https://example.com"
 * @returns {string[]} candidate file URLs
 */
export function candidateUrls(baseUrl = '') {
  const origin = String(baseUrl).replace(/\/+$/, '');
  if (!origin) return [];
  return CANDIDATE_PATHS.map((p) => `${origin}${p}`);
}

/**
 * Parse ads.txt (or app-ads.txt) into records and declarations.
 * Exported so sibling miners (app-ads.txt) can reuse the grammar.
 * @param {string} content raw file text
 * @returns {{
 *   records: Array<{ domain: string, publisherId: string, relationship: string, certAuthorityId: string|null, line: number }>,
 *   declarations: Record<string, string[]>,
 *   contacts: string[],
 *   sellerHosts: string[]
 * }}
 */
export function parseAdsTxt(content) {
  const records = [];
  const declarations = {};
  const contacts = [];
  const sellerHosts = new Set();
  const lines = String(content || '').split(/\r?\n/);

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) return;
    if (line.startsWith('#')) {
      const contact = line.match(/^#\s*contact\s*[:=]\s*(.+)$/i);
      if (contact) contacts.push(contact[1].trim());
      const decl = line.match(/^#\s*([A-Z][A-Z0-9_-]*)\s*[:=]\s*(.+)$/);
      if (decl) {
        const key = decl[1].toUpperCase();
        if (!declarations[key]) declarations[key] = [];
        declarations[key].push(decl[2].trim());
      }
      return;
    }
    const parts = line.split(',').map((p) => p.trim());
    if (parts.length < 3) return;
    const [domain, publisherId, relationship, certAuthorityId] = parts;
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) return;
    records.push({ domain: domain.toLowerCase(), publisherId, relationship: relationship.toUpperCase(), certAuthorityId: certAuthorityId || null, line: idx + 1 });
    sellerHosts.add(domain.toLowerCase());
  });

  for (const key of ['SUBDOMAIN', 'SUBDOMAINS', 'OWNERDOMAIN', 'MANAGERDOMAIN']) {
    for (const v of declarations[key] || []) {
      const d = v.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
      d.forEach((h) => sellerHosts.add(h));
    }
  }

  return { records, declarations, contacts, sellerHosts: [...sellerHosts] };
}

/**
 * Analyze an ads.txt file and map its seller/partner domains.
 * @param {string} content raw file text
 * @param {{ sourceUrl?: string }} [opts]
 * @returns {{
 *   source: string|null,
 *   totalRecords: number, directSellers: number, resellers: number,
 *   bothRelations: number, sellerHosts: string[],
 *   topSellers: Array<{ domain: string, records: number }>,
 *   contacts: string[], declarations: Record<string, string[]>
 * }}
 */
export function analyzeAdsTxt(content, opts = {}) {
  const source = opts.sourceUrl || null;
  const { records, declarations, contacts, sellerHosts } = parseAdsTxt(content);
  const byDomain = new Map();
  let direct = 0;
  let reseller = 0;
  let both = 0;
  for (const r of records) {
    if (r.relationship === 'DIRECT') direct++;
    else if (r.relationship === 'RESELLER') reseller++;
    else if (r.relationship === 'BOTH') both++;
    byDomain.set(r.domain, (byDomain.get(r.domain) || 0) + 1);
  }
  const topSellers = [...byDomain.entries()]
    .map(([domain, count]) => ({ domain, records: count }))
    .sort((a, b) => b.records - a.records)
    .slice(0, 20);
  return {
    source,
    totalRecords: records.length,
    directSellers: direct,
    resellers: reseller,
    bothRelations: both,
    sellerHosts,
    topSellers,
    contacts,
    declarations,
  };
}
