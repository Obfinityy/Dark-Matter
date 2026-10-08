/**
 * dsarEndpointDiscovery.js — Data-subject-request endpoint discovery.
 *
 * Idea 00913: find DSAR (data subject access request) submission endpoints.
 *
 * Defensive recon engine: from operator-collected page HTML/JS of an authorized
 * target, discovers where the site accepts privacy-rights requests (GDPR/CCPA
 * access, rectification, portability, "your privacy rights" forms and APIs).
 * Pure parsing — no network calls, no submissions performed.
 */

const DSAR_PATTERNS = [
  { type: 'dsar-form', regex: /(dsar|data[-_ ]?subject[-_ ]?(access[-_ ]?)?request|subject[-_ ]?access[-_ ]?request|sar[-_ ]?form)/i, confidence: 'high' },
  { type: 'privacy-rights-page', regex: /(your[-_ ]?privacy[-_ ]?rights|privacy[-_ ]?rights|exercise[-_ ]?your[-_ ]?rights|rights[-_ ]?request)/i, confidence: 'high' },
  { type: 'api-endpoint', regex: /(api|rest|graphql)[^"'\s<>]{0,80}?(dsar|privacy[-_ ]?request|data[-_ ]?request|subject[-_ ]?request)/i, confidence: 'high' },
  { type: 'request-form', regex: /(request[-_ ]?(my[-_ ]?)?data|access[-_ ]?my[-_ ]?data|download[-_ ]?my[-_ ]?data|view[-_ ]?my[-_ ]?data)/i, confidence: 'medium' },
  { type: 'verification-step', regex: /(identity[-_ ]?verification|verify[-_ ]?(your[-_ ]?)?identity)[^"'\s<>]{0,60}?(dsar|privacy|request)/i, confidence: 'low' },
];

const FORM_ACTION_REGEX = /<form\b[^>]*\baction=["']([^"']+)["'][^>]*>([\s\S]{0,4000}?)(?:<\/form>|$)/gi;

/**
 * Find form actions whose surrounding form text matches DSAR patterns.
 * @param {string} html
 * @returns {{action: string, type: string, confidence: string, snippet: string}[]}
 */
export function findDsarForms(html = '') {
  const text = String(html);
  const forms = [];
  let m;
  FORM_ACTION_REGEX.lastIndex = 0;
  while ((m = FORM_ACTION_REGEX.exec(text)) !== null) {
    const action = m[1];
    const body = `${m[0].slice(0, 1500)}`;
    for (const pat of DSAR_PATTERNS) {
      if (pat.regex.test(action) || pat.regex.test(body)) {
        forms.push({
          action,
          type: pat.type === 'api-endpoint' ? 'dsar-form' : pat.type,
          confidence: pat.confidence,
          snippet: body.replace(/\s+/g, ' ').slice(0, 220),
        });
        break;
      }
    }
  }
  return forms;
}

/**
 * Find DSAR-related API/link endpoints in page text.
 * @param {string} html
 * @param {string} [baseUrl]
 * @returns {{url: string, type: string, confidence: string}[]}
 */
export function findDsarEndpoints(html = '', baseUrl = '') {
  const text = String(html);
  const found = new Map();
  const urlRegex = /["']((?:https?:)?\/\/[^"'\s<>]+|\/[a-zA-Z0-9_\-./?&=#%:]+)["']/g;
  let m;
  while ((m = urlRegex.exec(text)) !== null) {
    const raw = m[1].replace(/&amp;/g, '&');
    for (const pat of DSAR_PATTERNS) {
      if (pat.regex.test(raw) && !found.has(raw)) {
        let url = raw;
        if (baseUrl && raw.startsWith('/')) {
          try { url = new URL(raw, baseUrl).href; } catch { /* keep raw */ }
        }
        found.set(raw, { url, type: pat.type, confidence: pat.confidence });
      }
    }
  }
  return [...found.values()];
}

/**
 * Discover DSAR submission surface for a page.
 * @param {string} html - Page HTML/JS collected by the operator.
 * @param {string} [baseUrl]
 * @returns {{forms: object[], endpoints: object[], summary: {forms: number, endpoints: number}}}
 */
export function discoverDsarEndpoints(html = '', baseUrl = '') {
  const forms = findDsarForms(html);
  const endpoints = findDsarEndpoints(html, baseUrl);
  return { forms, endpoints, summary: { forms: forms.length, endpoints: endpoints.length } };
}
