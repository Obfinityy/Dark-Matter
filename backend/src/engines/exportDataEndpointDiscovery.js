/**
 * exportDataEndpointDiscovery.js — Export-data endpoint discovery.
 *
 * Idea 00915: find data-export endpoints that reveal data stores.
 *
 * Defensive recon engine: discovers data-export affordances (download-my-data,
 * GDPR portability, backup/CSV/PDF export APIs) from operator-collected page
 * HTML/JS of an authorized target, and infers which data stores the exports
 * draw from (profile, orders, messages, activity) by endpoint naming. Pure
 * parsing — no network calls, nothing downloaded.
 */

const EXPORT_PATTERNS = [
  { type: 'export-api', regex: /(api|rest)[^"'\s<>]{0,60}?(export|download)[^"'\s<>]{0,40}?(data|profile|account|history|backup)/i, confidence: 'high' },
  { type: 'export-endpoint', regex: /\/(export|download)(?:[-_ /](?:my[-_ ]?)?(?:data|profile|account|history|backup|archive|gdpr))?/i, confidence: 'high' },
  { type: 'export-page', regex: /(download[-_ ]?(your[-_ ]?|my[-_ ]?)?data|export[-_ ]?(your[-_ ]?|my[-_ ]?)?data|request[-_ ]?(an[-_ ]?)?archive|data[-_ ]?portability)/i, confidence: 'medium' },
  { type: 'export-format', regex: /\.(csv|xlsx?|json|zip|pdf|xml)\b[^"'\s<>]{0,40}?(export|download|backup)/i, confidence: 'low' },
];

const STORE_HINTS = [
  { store: 'profile', regex: /(profile|account|identity|pii)/i },
  { store: 'orders', regex: /(order|purchase|transaction|invoice|billing)/i },
  { store: 'messages', regex: /(message|chat|conversation|inbox|comment)/i },
  { store: 'activity', regex: /(activity|event|audit|log|history|session)/i },
  { store: 'media', regex: /(media|photo|image|video|upload|file)/i },
  { store: 'payments', regex: /(payment|card|wallet|payout|refund)/i },
];

/**
 * Infer which data stores an export endpoint likely touches.
 * @param {string} url
 * @returns {string[]}
 */
export function inferDataStores(url = '') {
  const s = String(url);
  return STORE_HINTS.filter(h => h.regex.test(s)).map(h => h.store);
}

/**
 * Discover data-export endpoints in page text.
 * @param {string} html - Page HTML/JS.
 * @param {string} [baseUrl]
 * @returns {{endpoints: {url: string, type: string, confidence: string, dataStores: string[]}[]}}
 */
export function discoverExportEndpoints(html = '', baseUrl = '') {
  const text = String(html);
  const found = new Map();
  const urlRegex = /["']((?:https?:)?\/\/[^"'\s<>]+|\/[a-zA-Z0-9_\-./?&=#%:]+|\w+\.(?:csv|xlsx?|json|zip|pdf|xml))["']/g;
  let m;
  while ((m = urlRegex.exec(text)) !== null) {
    const raw = m[1].replace(/&amp;/g, '&');
    for (const pat of EXPORT_PATTERNS) {
      if (pat.regex.test(raw) && !found.has(raw)) {
        let url = raw;
        if (baseUrl && raw.startsWith('/')) {
          try { url = new URL(raw, baseUrl).href; } catch { /* keep raw */ }
        }
        found.set(raw, {
          url,
          type: pat.type,
          confidence: pat.confidence,
          dataStores: inferDataStores(raw),
        });
      }
    }
  }
  return { endpoints: [...found.values()] };
}
