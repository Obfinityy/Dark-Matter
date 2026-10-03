/**
 * appAdsTxtMiner.js — app-ads.txt mobile host mapping.
 *
 * `/app-ads.txt` is the mobile-app twin of ads.txt (IAB spec): it lists the
 * domains authorized to sell a publisher's in-app ad inventory. In addition
 * to seller domains, app-ads.txt files often reference the publisher's apps
 * via store URLs — revealing package names, App Store IDs and the developer
 * domains tied to the org's mobile inventory.
 *
 * All functions are pure: the caller fetches the file, this module parses it.
 */

import { parseAdsTxt } from './adsTxtMapper.js';

/** Well-known locations of the app-ads.txt file. */
export const CANDIDATE_PATHS = [
  '/app-ads.txt',
  '/.well-known/app-ads.txt',
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
 * Analyze an app-ads.txt file: seller domains plus mobile inventory links.
 * @param {string} content raw file text
 * @param {{ sourceUrl?: string }} [opts]
 * @returns {{
 *   source: string|null,
 *   totalRecords: number, sellerHosts: string[],
 *   appStoreLinks: Array<{ url: string, store: 'apple'|'google'|'other', appId: string|null }>,
 *   packageNames: string[], developerDomains: string[],
 *   contacts: string[], declarations: Record<string, string[]>
 * }}
 */
export function analyzeAppAdsTxt(content, opts = {}) {
  const source = opts.sourceUrl || null;
  const { records, declarations, contacts, sellerHosts } = parseAdsTxt(content);
  const text = String(content || '');

  const appStoreLinks = [];
  const packageNames = new Set();
  const developerDomains = new Set();
  const seen = new Set();

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    for (const m of line.matchAll(/https?:\/\/[^\s"'<>,)\]]+/g)) {
      const url = m[0];
      if (seen.has(url)) continue;
      seen.add(url);
      let store = 'other';
      let appId = null;
      const apple = url.match(/apps\.apple\.com\/[^/]*\/app\/[^/]*\/(id\d+)/i) || url.match(/apps\.apple\.com\/[^/]*\/(id\d+)/i);
      const google = url.match(/play\.google\.com\/store\/apps\/details\?id=([a-zA-Z0-9._]+)/i);
      if (apple) {
        store = 'apple';
        appId = apple[1];
      } else if (google) {
        store = 'google';
        appId = google[1];
        packageNames.add(appId);
      } else {
        try {
          const host = new URL(url).hostname.toLowerCase();
          if (/\.(com|net|org|io|app|dev)$/i.test(host)) developerDomains.add(host);
        } catch { /* ignore */ }
      }
      appStoreLinks.push({ url, store, appId });
    }
  }

  return {
    source,
    totalRecords: records.length,
    sellerHosts,
    appStoreLinks,
    packageNames: [...packageNames],
    developerDomains: [...developerDomains],
    contacts,
    declarations,
  };
}

/**
 * Summarize an analysis for reporting.
 * @param {ReturnType<typeof analyzeAppAdsTxt>} analysis
 * @returns {{ sellerHosts: number, appStoreLinks: number, packageNames: string[], developerDomains: string[] }}
 */
export function summarizeAnalysis(analysis) {
  return {
    sellerHosts: (analysis.sellerHosts || []).length,
    appStoreLinks: (analysis.appStoreLinks || []).length,
    packageNames: analysis.packageNames || [],
    developerDomains: analysis.developerDomains || [],
  };
}
