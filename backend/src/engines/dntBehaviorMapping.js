/**
 * dntBehaviorMapping.js — Do-Not-Track behavior mapping.
 *
 * Idea 00911: map DNT handling to privacy endpoints.
 *
 * A defensive endpoint-mapping engine: given a target site's observed HTTP
 * response headers and page HTML/JS (collected by the operator from their own
 * engagement), it correlates Do-Not-Track signals (request header `DNT: 1`,
 * `navigator.doNotTrack`, and the Tk/`Tk-Response`/`Policy` response contract)
 * with privacy-relevant endpoints (consent APIs, opt-out pages, ad/analytics
 * beacons, tracking pixels). Pure parsing — no network calls.
 */

const DNT_ENDPOINT_PATTERNS = [
  { type: 'opt-out', regex: /(opt[-_]?out|do[-_]?not[-_]?track|dnt[-_]?choice|privacy[-_]?choice)/i, confidence: 'high' },
  { type: 'consent-api', regex: /(consent|gdpr|ccpa|privacy)[-_ ]?(api|endpoint|status|preference|manager)/i, confidence: 'high' },
  { type: 'preference-center', regex: /(privacy[-_ ]?center|preference[-_ ]?center|cookie[-_ ]?(preference|setting))/i, confidence: 'medium' },
  { type: 'tracker-beacon', regex: /(analytics|pixel|beacon|track(er|ing)?|collect|impression|event)[-_ ]?(gif|png|api|endpoint|url)?/i, confidence: 'low' },
];

/**
 * @typedef {Object} DntPolicySignal
 * @property {boolean} tkHeader - Tk response header present (1/2/3/N/C).
 * @property {string|null} tkValue - Raw Tk value.
 * @property {boolean} policyLink - W3C Policy link (RFC 2299 style) present.
 * @property {string|null} policyUrl - Policy link URL if found.
 * @property {boolean} dntJsCheck - Page JS reads navigator.doNotTrack / window.doNotTrack.
 */

/**
 * Extract DNT-related signals from response headers.
 * @param {Record<string,string>} headers - Lower/upper-cased response headers.
 * @returns {DntPolicySignal}
 */
export function extractDntSignals(headers = {}) {
  const get = (name) => {
    const key = Object.keys(headers).find(k => k.toLowerCase() === name.toLowerCase());
    return key ? headers[key] : null;
  };
  const tk = get('tk');
  const linkHeader = get('link') || '';
  const policyMatch = linkHeader.match(/<([^>]+)>\s*;\s*rel="?policy"?/i);
  const html = get('x-dnt-html') || ''; // optional injected page context
  const jsCheck = /navigator\.doNotTrack|window\.doNotTrack|\.msDoNotTrack/i.test(String(html));
  return {
    tkHeader: tk !== null,
    tkValue: tk,
    policyLink: !!policyMatch,
    policyUrl: policyMatch ? policyMatch[1] : null,
    dntJsCheck: jsCheck,
  };
}

/**
 * Map candidate privacy endpoints found in page HTML/JS to DNT-relevant classes.
 * @param {string} html - Page HTML or bundled JS text.
 * @param {string} [baseUrl] - Origin used to resolve relative URLs.
 * @returns {{endpoints: {url: string, type: string, confidence: string}[]}}
 */
export function mapDntPrivacyEndpoints(html = '', baseUrl = '') {
  const text = String(html);
  const found = new Map();
  const urlRegex = /["']((?:https?:)?\/\/[^"'\s<>]+|\/[a-zA-Z0-9_\-./?&=#%:]+)["']/g;
  let m;
  while ((m = urlRegex.exec(text)) !== null) {
    const raw = m[1].replace(/&amp;/g, '&');
    for (const pat of DNT_ENDPOINT_PATTERNS) {
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
 * Correlate DNT signals with discovered privacy endpoints into one map.
 * @param {Record<string,string>} headers - Response headers.
 * @param {string} html - Page HTML/JS.
 * @param {string} [baseUrl]
 * @returns {{signals: DntPolicySignal, endpoints: {url:string,type:string,confidence:string}[], honored: 'unknown'|'yes'|'no'}}
 */
export function mapDntBehavior(headers = {}, html = '', baseUrl = '') {
  const signals = extractDntSignals(headers);
  const { endpoints } = mapDntPrivacyEndpoints(html, baseUrl);
  let honored = 'unknown';
  if (signals.tkValue) {
    honored = signals.tkValue.trim() === '1' ? 'yes' : signals.tkValue.trim() === 'N' ? 'no' : 'unknown';
  }
  return { signals, endpoints, honored };
}
