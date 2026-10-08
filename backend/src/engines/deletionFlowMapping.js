/**
 * deletionFlowMapping.js — Deletion-request flow mapping.
 *
 * Idea 00914: map account-deletion flows to backend endpoints.
 *
 * Defensive engine: maps how a site's account/data deletion flow is wired —
 * which settings pages, form actions, and API endpoints participate — from
 * operator-collected page HTML/JS of an authorized target. Maps the flow only;
 * it never triggers deletion. Pure parsing — no network calls.
 */

const DELETION_PATTERNS = [
  { type: 'delete-account-page', regex: /(delete[-_ ]?(my[-_ ]?)?account|close[-_ ]?(my[-_ ]?)?account|deactivate[-_ ]?account|remove[-_ ]?account)/i, confidence: 'high' },
  { type: 'delete-api', regex: /(api|rest)[^"'\s<>]{0,60}?(account|user|profile)[^"'\s<>]{0,40}?(delete|deactivate|close|erase)/i, confidence: 'high' },
  { type: 'delete-endpoint', regex: /\/(account|user|profile|settings)[^"'\s<>]{0,60}?(delete|deletion|deactivate|close|erase|remove)/i, confidence: 'high' },
  { type: 'delete-data-page', regex: /(delete[-_ ]?(my[-_ ]?)?data|erase[-_ ]?(my[-_ ]?)?data|right[-_ ]?to[-_ ]?be[-_ ]?forgotten|forget[-_ ]?me)/i, confidence: 'medium' },
  { type: 'confirm-step', regex: /(confirm[-_ ]?(account[-_ ]?)?deletion|type[-_ ]?["']?delete["']?|are[-_ ]?you[-_ ]?sure[^"'\s<>]{0,40}?delete)/i, confidence: 'low' },
];

const STAGE_ORDER = ['delete-account-page', 'delete-data-page', 'confirm-step', 'delete-api', 'delete-endpoint'];

/**
 * Extract deletion-flow steps from page text.
 * @param {string} html - Page HTML/JS.
 * @param {string} [baseUrl]
 * @returns {{steps: {stage: string, url: string|null, type: string, confidence: string}[]}}
 */
export function mapDeletionSteps(html = '', baseUrl = '') {
  const text = String(html);
  const steps = [];
  const seen = new Set();
  const urlRegex = /["']((?:https?:)?\/\/[^"'\s<>]+|\/[a-zA-Z0-9_\-./?&=#%:]+)["']/g;
  let m;
  while ((m = urlRegex.exec(text)) !== null) {
    const raw = m[1].replace(/&amp;/g, '&');
    for (const pat of DELETION_PATTERNS) {
      if (pat.regex.test(raw) && !seen.has(raw + pat.type)) {
        seen.add(raw + pat.type);
        let url = raw;
        if (baseUrl && raw.startsWith('/')) {
          try { url = new URL(raw, baseUrl).href; } catch { /* keep raw */ }
        }
        steps.push({ stage: pat.type, url, type: pat.type, confidence: pat.confidence });
      }
    }
  }
  // Page-level (non-URL) deletion affordances, e.g. inline buttons.
  const buttonRegex = /<(button|a)\b[^>]*>([^<]{1,80}?)<\/(button|a)>/gi;
  while ((m = buttonRegex.exec(text)) !== null) {
    const label = m[2].trim();
    if (/(delete|deactivate|close|erase)\s+(my\s+)?(account|data|profile)/i.test(label)) {
      steps.push({ stage: 'confirm-step', url: null, type: 'inline-button', confidence: 'low', label });
    }
  }
  steps.sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage));
  return { steps };
}

/**
 * Reconstruct the ordered deletion flow from page text.
 * @param {string} html
 * @param {string} [baseUrl]
 * @returns {{flow: {order: number, stage: string, url: string|null, confidence: string}[], backendEndpoints: string[], complete: boolean}}
 */
export function mapDeletionFlow(html = '', baseUrl = '') {
  const { steps } = mapDeletionSteps(html, baseUrl);
  const flow = steps.map((s, i) => ({ order: i + 1, stage: s.stage, url: s.url, confidence: s.confidence }));
  const backendEndpoints = steps
    .filter(s => s.type === 'delete-api' || s.type === 'delete-endpoint')
    .map(s => s.url)
    .filter(Boolean);
  const stages = new Set(steps.map(s => s.stage));
  const complete = stages.has('delete-account-page') && backendEndpoints.length > 0;
  return { flow, backendEndpoints, complete };
}
