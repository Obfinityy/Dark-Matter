/**
 * ukWebArchiveIntel.js — UK Web Archive domain search (idea 00207).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent.
 * Builds query URL patterns for the UK Web Archive (JISC UKWA) and parses
 * its result format into host lists — useful extra archive coverage for
 * UK-targeted scopes where ukwa.org.uk holds unique captures.
 */

const UKWA_SEARCH_BASE = 'https://www.webarchive.org.uk/wayback/archive';
const UKWA_API_BASE = 'https://www.webarchive.org.uk/wayback/en/archive/timemap/link';

/**
 * Build a UK Web Archive timemap (Memento) URL for an archived URL.
 * @param {string} url - Target URL.
 * @returns {string} Timemap URL returning capture metadata.
 */
export function buildUkwaTimemapUrl(url) {
  return `${UKWA_API_BASE}/${encodeURIComponent(String(url || '').trim())}`;
}

/**
 * Build a UK Web Archive calendar URL for a domain.
 * @param {string} domain - Target domain, e.g. "example.com".
 * @returns {string} Calendar browse URL.
 */
export function buildUkwaCalendarUrl(domain) {
  const clean = String(domain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return `${UKWA_SEARCH_BASE}/http://${clean}*/`;
}

/**
 * Build paged domain-search URL patterns for the UKWA solr search UI.
 * @param {string} domain - Target domain.
 * @param {Object} [opts] - Optional: { pages=3, pageSize=50 }.
 * @returns {string[]} Search URLs, one per page.
 */
export function buildUkwaSearchUrls(domain, opts = {}) {
  const clean = String(domain || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const urls = [];
  const pages = opts.pages ?? 3;
  const pageSize = opts.pageSize ?? 50;
  for (let p = 0; p < pages; p++) {
    const params = new URLSearchParams({
      q: `domain:${clean}`,
      start: String(p * pageSize),
      rows: String(pageSize),
      wt: 'json',
    });
    urls.push(`https://www.webarchive.org.uk/wayback/en/archive/solr/search?${params.toString()}`);
  }
  return urls;
}

/**
 * Parse a UKWA solr-style JSON response into document records.
 * @param {string|Object} raw - Raw JSON text or parsed object.
 * @returns {Array<{ url, title, crawlDate, host }}}
 */
export function parseUkwaSolrResponse(raw) {
  let obj;
  try {
    obj = typeof raw === 'string' ? JSON.parse(String(raw).trim()) : raw;
  } catch { return []; }
  const docs = (obj && obj.response && obj.response.docs) || [];
  return docs
    .map(d => {
      const url = d.url || (d.id || '').split('/').slice(-1)[0] || '';
      let host = '';
      try { host = new URL(String(url).startsWith('http') ? url : `http://${url}`).hostname.toLowerCase(); } catch { /* skip */ }
      return { url: String(url), title: d.title || '', crawlDate: d.crawl_date || d.tstamp || '', host };
    })
    .filter(r => r.url);
}

/**
 * Parse a Memento timemap (link format) text into captures.
 * @param {string} raw - Timemap link-format text.
 * @returns {Array<{ uri, datetime, relation }>}
 */
export function parseUkwaTimemap(raw) {
  const captures = [];
  for (const line of String(raw || '').split('\n')) {
    const m = line.match(/<([^>]+)>\s*;\s*rel="([^"]+)"(?:[^;]*;\s*datetime="([^"]+)")?/);
    if (m && /memento/i.test(m[2])) {
      captures.push({ uri: m[1], relation: m[2], datetime: m[3] || '' });
    }
  }
  return captures;
}

/**
 * Idea 00207 — full extraction: solr docs + timemap captures → host list.
 * @param {string|Object} solrRaw - Raw solr JSON.
 * @param {string} timemapRaw - Raw timemap link-format text.
 * @param {string} domain - Target domain for provenance.
 * @returns {{ domain, hosts, documents, captures, provenance }}
 */
export function mineUkwaHosts(solrRaw, timemapRaw, domain) {
  const documents = parseUkwaSolrResponse(solrRaw);
  const captures = parseUkwaTimemap(timemapRaw);
  const hostSet = new Set();
  for (const d of documents) if (d.host) hostSet.add(d.host);
  for (const c of captures) {
    try { hostSet.add(new URL(c.uri).hostname.toLowerCase()); } catch { /* skip */ }
  }
  return {
    domain: String(domain).trim().toLowerCase(),
    hosts: [...hostSet].sort(),
    documents,
    captures,
    provenance: 'uk-web-archive',
  };
}
