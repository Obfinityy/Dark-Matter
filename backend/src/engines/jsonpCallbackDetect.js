/**
 * jsonpCallbackDetect.js — legacy JSONP endpoint detection by callback-parameter reflection.
 *
 * Implements idea-bank item 00434: detect legacy JSONP endpoints by
 * observing whether a callback query parameter is reflected as a
 * JavaScript function wrapper around the response body.
 *
 * All functions are pure and side-effect free: they operate on response
 * observations supplied by the caller (gathered during an authorized
 * engagement). No network requests are performed here.
 */

/** Common JSONP callback parameter names, ordered by prevalence. */
export const CALLBACK_PARAM_NAMES = [
  'callback', 'cb', 'jsonp', 'jsoncallback', '_callback', '_jsonp',
  'jscallback', 'function', 'fn', 'handler',
];

/**
 * Extract candidate callback parameter names/values from a query string or params object.
 * @param {string|object} query Query string ("a=1&callback=foo") or params object.
 * @returns {Array<{name:string, value:string}>}
 */
export function extractCallbackParams(query) {
  const out = [];
  if (!query) return out;
  const pairs = typeof query === 'string'
    ? query.replace(/^[?#]/, '').split('&').map((p) => {
        const i = p.indexOf('=');
        return i === -1 ? [p, ''] : [p.slice(0, i), p.slice(i + 1)];
      })
    : Object.entries(query);
  for (const [rawName, rawValue] of pairs) {
    let name;
    let value;
    try {
      name = decodeURIComponent(String(rawName)).toLowerCase();
      value = decodeURIComponent(String(rawValue));
    } catch {
      name = String(rawName).toLowerCase();
      value = String(rawValue);
    }
    if (CALLBACK_PARAM_NAMES.includes(name)) out.push({ name, value });
  }
  return out;
}

/**
 * Check whether a response body is wrapped in the given callback name,
 * i.e. looks like `callback({...});`.
 * @param {string} body Response body text.
 * @param {string} callbackName Callback identifier to look for.
 * @returns {{wrapped:boolean, prefix:string|null, suffix:string|null}}
 */
export function isWrappedInCallback(body, callbackName) {
  if (!body || !callbackName || typeof body !== 'string') return { wrapped: false, prefix: null, suffix: null };
  const trimmed = body.trim();
  const escaped = callbackName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = trimmed.match(new RegExp(`^${escaped}\\s*\\(`));
  if (!m) return { wrapped: false, prefix: null, suffix: null };
  const suffixOk = /\)\s*;?\s*$/.test(trimmed);
  return { wrapped: suffixOk, prefix: m[0], suffix: suffixOk ? trimmed.slice(trimmed.lastIndexOf(')')) : null };
}

/**
 * Validate that a callback value is a plausible JS identifier (defensive
 * check — reflected non-identifier values indicate a different bug class).
 * @param {string} value Callback parameter value.
 * @returns {boolean}
 */
export function isPlausibleCallbackIdentifier(value) {
  return typeof value === 'string' && /^[A-Za-z_$][A-Za-z0-9_$.]*$/.test(value) && value.length <= 128;
}

/**
 * Detect a JSONP endpoint from one observed response.
 * @param {object} obs { url?: string, query?: string|object, body?: string, contentType?: string }
 * @returns {{isJsonp:boolean, confidence:string, callback:{name:string, value:string}|null, contentType:string|null, notes:string[]}}
 */
export function detectJsonp(obs) {
  const o = obs || {};
  const params = extractCallbackParams(o.query || '');
  const contentType = o.contentType || null;
  const notes = [];
  if (params.length === 0) {
    return { isJsonp: false, confidence: 'none', callback: null, contentType, notes: ['no recognized callback parameter present'] };
  }
  const body = typeof o.body === 'string' ? o.body : '';
  let best = null;
  for (const p of params) {
    if (!p.value) continue;
    const wrap = isWrappedInCallback(body, p.value);
    if (wrap.wrapped) {
      best = { param: p, wrap };
      break;
    }
  }
  if (!best) {
    if (/javascript/i.test(contentType || '')) notes.push('callback parameter present with a JavaScript content type but no wrapping detected');
    return { isJsonp: false, confidence: 'low', callback: params[0], contentType, notes };
  }
  if (/json/i.test(contentType || '')) notes.push('JSONP wrapper served with a JSON content type');
  if (!isPlausibleCallbackIdentifier(best.param.value)) {
    notes.push('callback value is not a valid JS identifier — reflection here indicates a separate injection concern');
  }
  const confidence = /javascript/i.test(contentType || '') ? 'high' : 'medium';
  notes.unshift(`callback parameter "${best.param.name}" reflected as function wrapper`);
  return { isJsonp: true, confidence, callback: best.param, contentType, notes };
}

/**
 * Scan many observed responses and return the JSONP-like ones.
 * @param {Array<object>} observations Response observation objects (same shape as detectJsonp input).
 * @returns {Array<{url:string|null, callback:object|null, confidence:string, notes:string[]}>}
 */
export function findJsonpEndpoints(observations) {
  const list = Array.isArray(observations) ? observations : [];
  const hits = [];
  for (const o of list) {
    const r = detectJsonp(o);
    if (r.isJsonp) {
      hits.push({ url: o.url || null, callback: r.callback, confidence: r.confidence, notes: r.notes });
    }
  }
  return hits.sort((a, b) => (b.confidence === 'high') - (a.confidence === 'high'));
}
