/**
 * gpcSignalMapping.js — Global Privacy Control signal mapping.
 *
 * Idea 00912: map GPC signal handling endpoints.
 *
 * Defensive endpoint mapping: given operator-collected response headers and
 * page HTML/JS from an authorized engagement, identifies Global Privacy
 * Control (GPC) handling — the Sec-GPC request signal, the `.well-known/gpc.json`
 * discovery file, and page-side opt-out / privacy-choice endpoints that react
 * to GPC. Pure parsing — no network calls.
 */

const GPC_ENDPOINT_PATTERNS = [
  { type: 'gpc-wellknown', regex: /\.well-known\/gpc\.json/i, confidence: 'high' },
  { type: 'gpc-handler', regex: /gpc[-_ ]?(signal|status|handler|opt[-_ ]?out|callback)/i, confidence: 'high' },
  { type: 'universal-opt-out', regex: /(universal[-_ ]?opt[-_ ]?out|global[-_ ]?privacy[-_ ]?(control|choice)|uoom)/i, confidence: 'medium' },
  { type: 'sale-opt-out', regex: /(do[-_ ]?not[-_ ]?sell|dnsmpi|sale[-_ ]?of[-_ ]?(my[-_ ]?)?(personal[-_ ]?)?(info|data))/i, confidence: 'medium' },
];

/**
 * @typedef {Object} GpcSignals
 * @property {boolean} gpcWellKnownReferenced - .well-known/gpc.json referenced on the page.
 * @property {boolean} secGpcHeaderObserved - Response indicated it saw Sec-GPC (custom header check).
 * @property {boolean} jsGpcCheck - Page JS reads navigator.globalPrivacyControl.
 * @property {boolean} usPrivacyString - USPAPI / __uspapi or us_privacy cookie referenced.
 */

/**
 * Extract GPC-related signals from headers and page text.
 * @param {Record<string,string>} headers - Response headers.
 * @param {string} html - Page HTML/JS text.
 * @returns {GpcSignals}
 */
export function extractGpcSignals(headers = {}, html = '') {
  const text = String(html);
  const hdrKeys = Object.keys(headers).map(k => k.toLowerCase());
  const hasHeader = (name) => hdrKeys.includes(name.toLowerCase());
  return {
    gpcWellKnownReferenced: /\.well-known\/gpc\.json/i.test(text),
    secGpcHeaderObserved: hasHeader('sec-gpc') || hasHeader('x-gpc'),
    jsGpcCheck: /navigator\.globalPrivacyControl|globalPrivacyControl/i.test(text),
    usPrivacyString: /__uspapi|us_privacy|USPString/i.test(text),
  };
}

/**
 * Map candidate GPC/privacy-choice endpoints in page text.
 * @param {string} html - Page HTML/JS text.
 * @param {string} [baseUrl]
 * @returns {{endpoints: {url: string, type: string, confidence: string}[]}}
 */
export function mapGpcEndpoints(html = '', baseUrl = '') {
  const text = String(html);
  const found = new Map();
  const urlRegex = /["']((?:https?:)?\/\/[^"'\s<>]+|\/[a-zA-Z0-9_\-./?&=#%:]+)["']/g;
  let m;
  while ((m = urlRegex.exec(text)) !== null) {
    const raw = m[1].replace(/&amp;/g, '&');
    for (const pat of GPC_ENDPOINT_PATTERNS) {
      if (pat.regex.test(raw) && !found.has(raw)) {
        let url = raw;
        if (baseUrl && raw.startsWith('/')) {
          try { url = new URL(raw, baseUrl).href; } catch { /* keep raw */ }
        }
        found.set(raw, { url, type: pat.type, confidence: pat.confidence });
      }
    }
  }
  return { endpoints: [...found.values()] };
}

/**
 * Build a complete GPC signal-handling map for a page.
 * @param {Record<string,string>} headers
 * @param {string} html
 * @param {string} [baseUrl]
 * @returns {{signals: GpcSignals, endpoints: {url:string,type:string,confidence:string}[], gpcAware: boolean}}
 */
export function mapGpcSignalHandling(headers = {}, html = '', baseUrl = '') {
  const signals = extractGpcSignals(headers, html);
  const { endpoints } = mapGpcEndpoints(html, baseUrl);
  const gpcAware = signals.jsGpcCheck || signals.secGpcHeaderObserved ||
    signals.gpcWellKnownReferenced || endpoints.some(e => e.type === 'gpc-handler');
  return { signals, endpoints, gpcAware };
}
