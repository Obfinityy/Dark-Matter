/**
 * intercomHostFinder.js — Intercom messenger host discovery engine.
 *
 * Finds Intercom-backed chat hosts from passive signals:
 *  - Widget snippets: widget.intercom.io script tags, window.intercomSettings
 *    with app_id, api-iam.intercom.io / nexus-websocket-a.intercom.io endpoints.
 *  - DNS CNAMEs pointing at Intercom custom-domain infrastructure.
 *
 * Lets an authorized hunter enumerate every Intercom touchpoint of the
 * target organisation from collected pages and DNS data.
 */

const INTERCOM_ENDPOINTS = [
  'widget.intercom.io',
  'api-iam.intercom.io',
  'nexus-websocket-a.intercom.io',
  'nexus-websocket-b.intercom.io',
  'js.intercomcdn.com',
  'intercomcdn.com',
  'intercom.io',
  'custom.intercom.help',
  'intercom.help',
];

const INTERCOM_CNAME_RE = /(^|\.)(intercom\.io|intercom\.help|custom\.intercom\.help|intercomcdn\.com)$/i;

/**
 * Detect Intercom widget usage in page HTML/JS.
 * @param {string} html page source
 * @returns {{detected: boolean, appIds: string[], endpoints: string[], snippetType: string|null}}
 */
export function detectIntercomSnippet(html = '') {
  const text = String(html || '');
  const appIds = new Set();
  const endpoints = new Set();

  for (const ep of INTERCOM_ENDPOINTS) {
    if (text.toLowerCase().includes(ep)) endpoints.add(ep);
  }
  // window.intercomSettings = { app_id: "abc123" } and Intercom('boot', {app_id: ...})
  const re = /app_id["']?\s*[:=]\s*["']([a-z0-9]+)["']/gi;
  let m;
  while ((m = re.exec(text)) !== null) appIds.add(m[1]);
  // script tag variant: https://widget.intercom.io/widget/<app_id>
  const widgetRe = /widget\.intercom\.io\/widget\/([a-z0-9]+)/gi;
  while ((m = widgetRe.exec(text)) !== null) appIds.add(m[1]);

  let snippetType = null;
  if (/widget\.intercom\.io/i.test(text)) snippetType = 'widget-script';
  else if (/intercomSettings/i.test(text)) snippetType = 'settings-object';
  else if (endpoints.size) snippetType = 'endpoint-reference';

  return { detected: Boolean(snippetType), appIds: [...appIds], endpoints: [...endpoints], snippetType };
}

/**
 * Find CNAME records delegated to Intercom infrastructure.
 * @param {{name: string, target: string}[]} cnameRecords
 * @returns {{alias: string, target: string}[]}
 */
export function findIntercomCnames(cnameRecords = []) {
  const out = [];
  for (const rec of cnameRecords || []) {
    if (!rec || !rec.name || !rec.target) continue;
    const target = String(rec.target).toLowerCase().replace(/\.$/, '');
    if (INTERCOM_CNAME_RE.test(target)) {
      out.push({ alias: String(rec.name).toLowerCase().replace(/\.$/, ''), target });
    }
  }
  return out;
}

/**
 * Extract all Intercom-related hostnames referenced in text.
 * @param {string} text
 * @returns {string[]} unique hostnames
 */
export function extractIntercomHosts(text = '') {
  const hosts = new Set();
  const re = /\b([a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:intercom\.io|intercom\.help|intercomcdn\.com))\b/gi;
  let m;
  while ((m = re.exec(String(text))) !== null) hosts.add(m[1].toLowerCase());
  return [...hosts];
}

/**
 * Full discovery pass across pages and DNS data.
 * @param {{htmlPages: string[], cnames: {name:string,target:string}[]}} input
 * @returns {{pages: object[], cnameHits: object[], appIds: string[]}}
 */
export function discoverIntercomFootprint({ htmlPages = [], cnames = [] } = {}) {
  const pages = (htmlPages || []).map(detectIntercomSnippet);
  const cnameHits = findIntercomCnames(cnames);
  const appIds = [...new Set(pages.flatMap((p) => p.appIds))];
  return { pages, cnameHits, appIds };
}
