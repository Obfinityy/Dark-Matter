/**
 * jsUrlMiner.js — URL mining from event handlers and callback parameters.
 *
 * Interactive pages wire URLs into event handlers and integration callbacks;
 * those strings reveal navigation targets and third-party integration
 * endpoints without any interaction with the endpoints themselves.
 *
 * Ideas covered:
 *  00687 Event-handler URL mining — extract URLs from onclick and
 *          addEventListener handlers across the DOM and bundles.
 *  00688 Callback-URL parameter mining — find callback and redirect URL
 *          parameters in JS that reveal integration endpoints.
 */

import { extractEndpointsFromText } from './bundleEndpointMiner.js';

/** Inline HTML event attributes: onclick="...", onsubmit='...'. */
const INLINE_HANDLER_RE = /\son([a-z]+)\s*=\s*(["'])([\s\S]{0,2000}?)\2/gi;

/** JS addEventListener('click', handler) registrations. */
const ADD_LISTENER_RE = /(?:\b\w[\w$.]*\.)?addEventListener\s*\(\s*(['"])([a-z]+)\1\s*,/g;

/** JS direct handler assignment: el.onclick = "..." or = function... */
const ASSIGN_HANDLER_RE = /\.\s*on([a-z]+)\s*=\s*(['"`])([\s\S]{0,1200}?)\2/g;

/**
 * Extract the parenthesized argument list starting at the '(' index,
 * respecting strings, template literals and nesting.
 *
 * @param {string} text
 * @param {number} parenIdx Index of '('.
 * @returns {string|null} The full (...) span or null.
 */
function balancedParens(text, parenIdx) {
  let depth = 0;
  let inStr = null;
  let escaped = false;
  for (let i = parenIdx; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') inStr = ch;
    else if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) return text.slice(parenIdx, i + 1);
    }
  }
  return null;
}

/**
 * Mine URLs out of inline and scripted event handlers (idea 00687).
 *
 * @param {string} text HTML page text and/or bundle text.
 * @returns {Array<{event: string, source: 'inline-attr'|'addEventListener'|'on-assign', urls: string[]}>}
 */
export function mineEventHandlerUrls(text) {
  const src = String(text || '');
  const out = [];
  let m;

  INLINE_HANDLER_RE.lastIndex = 0;
  while ((m = INLINE_HANDLER_RE.exec(src)) !== null) {
    const urls = extractEndpointsFromText(m[3]);
    if (urls.length > 0) out.push({ event: m[1].toLowerCase(), source: 'inline-attr', urls });
  }

  ADD_LISTENER_RE.lastIndex = 0;
  while ((m = ADD_LISTENER_RE.exec(src)) !== null) {
    const parenIdx = src.indexOf('(', m.index);
    const call = parenIdx >= 0 ? balancedParens(src, parenIdx) : null;
    if (!call) continue;
    const urls = extractEndpointsFromText(call);
    if (urls.length > 0) out.push({ event: m[2].toLowerCase(), source: 'addEventListener', urls });
  }

  ASSIGN_HANDLER_RE.lastIndex = 0;
  while ((m = ASSIGN_HANDLER_RE.exec(src)) !== null) {
    const urls = extractEndpointsFromText(m[3]);
    if (urls.length > 0) out.push({ event: m[1].toLowerCase(), source: 'on-assign', urls });
  }

  return out;
}

/** Parameter names that carry callback / redirect URLs in integrations. */
const CALLBACK_PARAM_NAMES = [
  'callback',
  'callback_url',
  'callbackurl',
  'redirect',
  'redirect_url',
  'redirecturl',
  'redirect_uri',
  'return_url',
  'returnurl',
  'return_to',
  'returnto',
  'next',
  'continue',
  'target',
  'dest',
  'destination',
  'success_url',
  'successurl',
  'cancel_url',
  'cancelurl',
  'post_login_redirect',
  'auth_callback',
  'oauth_callback',
];

const QUERY_PARAM_RE = new RegExp(
  '[?&](' + CALLBACK_PARAM_NAMES.join('|') + ')=([^&#"\'`\\s\\]]{1,400})',
  'gi'
);
const JS_KV_RE = new RegExp(
  '["\']?(' + CALLBACK_PARAM_NAMES.join('|') + ')["\']?\\s*[:=]\\s*["\']([^"\']{1,400})["\']',
  'gi'
);

/**
 * Find callback and redirect URL parameters (idea 00688) — both in URL
 * query strings embedded in JS/HTML and in JS key/value assignments.
 *
 * @param {string} text Bundle or page text.
 * @returns {Array<{param: string, value: string, context: 'query-string'|'js-assignment', host: string|null}>}
 */
export function mineCallbackParams(text) {
  const src = String(text || '');
  const out = [];
  const seen = new Set();
  let m;

  const add = (param, value, context) => {
    const key = param + '|' + value;
    if (seen.has(key)) return;
    seen.add(key);
    let host = null;
    try {
      const v = decodeURIComponent(value);
      host = new URL(v.startsWith('//') ? 'https:' + v : v).hostname;
    } catch {
      host = null;
    }
    out.push({ param: param.toLowerCase(), value, context, host });
  };

  QUERY_PARAM_RE.lastIndex = 0;
  while ((m = QUERY_PARAM_RE.exec(src)) !== null) add(m[1], m[2], 'query-string');

  JS_KV_RE.lastIndex = 0;
  while ((m = JS_KV_RE.exec(src)) !== null) {
    // Only keep values that look like URLs or absolute/relative paths.
    if (/^(?:https?:|\/\/|\/)/i.test(m[2])) add(m[1], m[2], 'js-assignment');
  }

  return out;
}

export const JS_URL_MINER = {
  ideas: ['00687', '00688'],
  description: 'URL mining from event handlers and callback/redirect parameters.',
};

export default JS_URL_MINER;
