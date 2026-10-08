/**
 * dpaUrlHarvester.js — DPA-document URL harvesting.
 *
 * Idea 00908: harvest data-processing agreement (DPA) URLs for legal-host
 * mapping on an authorized target.
 *
 * No network calls: the module scans operator-supplied page text (HTML or
 * markdown) for links whose href or anchor text references a DPA / data
 * processing addendum / GDPR agreement, classifies them, and maps the legal
 * hosts they live on. Defensive surface-mapping of legal disclosure pages.
 */

const DPA_HREF_SIGNALS = [
  /dpa/i, /data[-_]?processing[-_]?agreement/i, /data[-_]?processing[-_]?addendum/i,
  /gdpr[-_]?agreement/i, /gdpr[-_]?addendum/i, /data[-_]?processor[-_]?agreement/i,
  /subprocessor[-_]?list/i, /privacy[-_]?addendum/i,
];

const DPA_ANCHOR_SIGNALS = [
  /data processing agreement/i, /data processing addendum/i, /dpa/i,
  /processor agreement/i, /gdpr agreement/i, /gdpr addendum/i, /privacy addendum/i,
];

/**
 * @typedef {Object} DpaDocument
 * @property {string} url - Harvested document URL.
 * @property {string} host - Host the document lives on.
 * @property {string} anchorText - Link text (empty for bare URLs).
 * @property {string} kind - 'dpa' | 'addendum' | 'subprocessor-list' | 'privacy-addendum'.
 * @property {string} evidence - Source excerpt.
 */

/**
 * Harvest DPA document URLs from page text.
 * @param {string} pageText - Page HTML or markdown.
 * @param {string} [baseUrl] - Page URL used to resolve relative links.
 * @param {{maxDocs?: number}} [options]
 * @returns {{documents: DpaDocument[], legalHosts: string[], stats: object}}
 */
export function harvestDpaUrls(pageText = '', baseUrl = '', options = {}) {
  const { maxDocs = 40 } = options;
  const text = String(pageText);
  const documents = [];
  const seen = new Set();

  const resolve = href => {
    const h = String(href).trim();
    if (!h) return null;
    if (/^https?:\/\//i.test(h)) return h;
    if (/^\/\//.test(h)) return `https:${h}`;
    if (!baseUrl) return h.startsWith('/') ? h : null;
    try {
      return new URL(h, baseUrl).toString();
    } catch {
      return null;
    }
  };

  const hostOf = url => {
    try {
      return new URL(url).hostname;
    } catch {
      return null;
    }
  };

  const classify = (href, anchor) => {
    const blob = `${href} ${anchor}`;
    if (/addendum/i.test(blob)) return 'addendum';
    if (/subprocessor/i.test(blob)) return 'subprocessor-list';
    if (/privacy/i.test(blob)) return 'privacy-addendum';
    return 'dpa';
  };

  const push = (url, anchor, evidence) => {
    if (!url || documents.length >= maxDocs || seen.has(url)) return;
    seen.add(url);
    const host = hostOf(url);
    documents.push({
      url,
      host,
      anchorText: anchor.slice(0, 120),
      kind: classify(url, anchor),
      evidence: evidence.slice(0, 200),
    });
  };

  // 1) HTML anchors: <a href="...">Data Processing Agreement</a>.
  const anchorRe = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([^<]{0,160})<\/a>/gi;
  let m;
  while ((m = anchorRe.exec(text)) !== null) {
    const href = m[1];
    const anchor = m[2].replace(/<[^>]*>/g, '').trim();
    if (DPA_HREF_SIGNALS.some(re => re.test(href)) || DPA_ANCHOR_SIGNALS.some(re => re.test(anchor))) {
      push(resolve(href), anchor, m[0]);
    }
  }

  // 2) Markdown links: [Data Processing Agreement](/legal/dpa.pdf).
  const mdRe = /\[([^\]]{0,160})\]\(([^)\s]+)\)/g;
  while ((m = mdRe.exec(text)) !== null) {
    const anchor = m[1];
    const href = m[2];
    if (DPA_HREF_SIGNALS.some(re => re.test(href)) || DPA_ANCHOR_SIGNALS.some(re => re.test(anchor))) {
      push(resolve(href), anchor, m[0]);
    }
  }

  // 3) Bare DPA-ish URLs in text.
  const bareRe = /https?:\/\/[a-z0-9_.\-:]{3,120}\/[a-z0-9_.\-\/?#=&%:;+]{0,160}/gi;
  while ((m = bareRe.exec(text)) !== null) {
    const url = m[0];
    if (DPA_HREF_SIGNALS.some(re => re.test(url))) push(url, '', url);
  }

  const legalHosts = [...new Set(documents.map(d => d.host).filter(Boolean))];
  const byKind = {};
  for (const d of documents) byKind[d.kind] = (byKind[d.kind] || 0) + 1;

  return {
    documents,
    legalHosts,
    byKind,
    stats: {
      documents: documents.length,
      legalHosts: legalHosts.length,
      kinds: Object.keys(byKind).length,
    },
  };
}

/**
 * Build a report finding from the harvest result.
 * @param {ReturnType<typeof harvestDpaUrls>} result
 */
export function dpaFinding(result) {
  return {
    title: `DPA-document URL harvesting — ${result.stats.documents} document(s) on ${result.stats.legalHosts} legal host(s)`,
    severity: 'Info',
    confidence: result.stats.documents > 0 ? 'high' : 'low',
    byKind: result.byKind,
    legalHosts: result.legalHosts.slice(0, 20),
    documents: result.documents.slice(0, 20).map(d => ({
      url: d.url,
      kind: d.kind,
      anchorText: d.anchorText,
    })),
    evidence:
      `${result.stats.documents} DPA-class document URL(s) harvested across ` +
      `${result.stats.legalHosts} legal host(s).`,
  };
}

export const DPA_URL_HARVESTER = {
  harvestDpaUrls,
  dpaFinding,
};
export default DPA_URL_HARVESTER;
