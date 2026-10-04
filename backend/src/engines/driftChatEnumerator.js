/**
 * driftChatEnumerator.js — Drift chat host enumeration engine.
 *
 * Discovers Drift chat endpoints from passive signals:
 *  - Page snippets: js.driftt.com/include script tags, drift.load() calls,
 *    window.driftt / window.drift namespace usage, Drift snippet IDs.
 *  - DNS CNAMEs to Drift custom-domain targets.
 *  - Drift API/conversation hosts referenced in JS bundles.
 *
 * Helps an authorized hunter enumerate the target's Drift deployment
 * (snippet IDs, custom chat domains) without touching Drift's servers.
 */

const DRIFT_ENDPOINTS = [
  'js.driftt.com',
  'driftt.com',
  'drift.com',
  'api.drift.com',
  'event.api.drift.com',
  'conversations.drift.com',
  'chat.drift.com',
];

const DRIFT_CNAME_RE = /(^|\.)(driftt\.com|drift\.com)$/i;

/**
 * Detect Drift chat integration in page HTML/JS.
 * @param {string} html page source
 * @returns {{detected: boolean, snippetIds: string[], endpoints: string[], hasDriftLoad: boolean}}
 */
export function detectDriftSnippet(html = '') {
  const text = String(html || '');
  const lower = text.toLowerCase();
  const snippetIds = new Set();
  const endpoints = new Set();

  for (const ep of DRIFT_ENDPOINTS) {
    if (lower.includes(ep)) endpoints.add(ep);
  }
  // js.driftt.com/include/<timestamp>/<snippetId>.js
  const includeRe = /js\.driftt\.com\/include\/[a-z0-9]+\/([a-z0-9]+)\.js/gi;
  let m;
  while ((m = includeRe.exec(text)) !== null) snippetIds.add(m[1]);
  // drift.load('snippetId') / driftt.load('snippetId')
  const loadRe = /drift[t]?\s*\.\s*load\s*\(\s*["']([a-z0-9]{6,})["']/gi;
  while ((m = loadRe.exec(text)) !== null) snippetIds.add(m[1]);

  const hasDriftLoad = /drift[t]?\s*\.\s*load\s*\(/i.test(text) ||
    /window\.(drift|driftt)\b/i.test(text);

  return {
    detected: endpoints.size > 0 || hasDriftLoad || snippetIds.size > 0,
    snippetIds: [...snippetIds],
    endpoints: [...endpoints],
    hasDriftLoad,
  };
}

/**
 * Find CNAME records delegated to Drift infrastructure.
 * @param {{name: string, target: string}[]} cnameRecords
 * @returns {{alias: string, target: string}[]}
 */
export function findDriftCnames(cnameRecords = []) {
  const out = [];
  for (const rec of cnameRecords || []) {
    if (!rec || !rec.name || !rec.target) continue;
    const target = String(rec.target).toLowerCase().replace(/\.$/, '');
    if (DRIFT_CNAME_RE.test(target)) {
      out.push({ alias: String(rec.name).toLowerCase().replace(/\.$/, ''), target });
    }
  }
  return out;
}

/**
 * Extract Drift-related hostnames from arbitrary text.
 * @param {string} text
 * @returns {string[]} unique hostnames
 */
export function extractDriftHosts(text = '') {
  const hosts = new Set();
  const re = /\b([a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:driftt\.com|drift\.com))\b/gi;
  let m;
  while ((m = re.exec(String(text))) !== null) hosts.add(m[1].toLowerCase());
  return [...hosts];
}

/**
 * Full enumeration pass.
 * @param {{htmlPages: string[], cnames: {name:string,target:string}[]}} input
 * @returns {{pages: object[], cnameHits: object[], snippetIds: string[]}}
 */
export function enumerateDriftFootprint({ htmlPages = [], cnames = [] } = {}) {
  const pages = (htmlPages || []).map(detectDriftSnippet);
  const cnameHits = findDriftCnames(cnames);
  const snippetIds = [...new Set(pages.flatMap((p) => p.snippetIds))];
  return { pages, cnameHits, snippetIds };
}
