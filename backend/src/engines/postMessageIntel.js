/**
 * postMessageIntel.js — Cross-window messaging surface mapping.
 *
 * postMessage bridges are a real cross-origin integration surface: who may
 * send, who may receive, and what message shapes are expected. This engine
 * catalogs target origins in postMessage calls and maps message-event
 * listeners, purely by parsing bundle/page text from the authorized target.
 *
 * Ideas covered:
 *  00689 PostMessage target-origin cataloging — catalog postMessage target
 *          origins to map cross-window integrations.
 *  00690 Message-event listener mapping — map message event listeners to
 *          find expected origins and data shapes.
 */

/** postMessage(message, targetOrigin) call sites. */
const POST_MESSAGE_RE = /\.postMessage\s*\(/g;

/** addEventListener('message', handler) / onmessage = handler registrations. */
const MESSAGE_LISTENER_RE = /(?:\b\w[\w$.]*\.)?addEventListener\s*\(\s*(['"])message\1\s*,/g;
const ONMESSAGE_ASSIGN_RE = /\.\s*onmessage\s*=/g;

/** Origin checks inside a handler: event.origin === 'https://...'. */
const ORIGIN_CHECK_RE =
  /\b(?:event|e|evt|msg)\.origin\s*(===|!==|==|!=|includes|startsWith|endsWith|match)\s*\(?\s*(['"`])([^'"`]*)\2/g;

/** event.data.foo / e.data.bar field accesses. */
const DATA_FIELD_RE =
  /\b(?:event|e|evt|msg)\.data(?:\.([a-zA-Z0-9_]+)|\[['"]([a-zA-Z0-9_]+)['"]\])/g;

/** switch on a data discriminator: switch(event.data.type). */
const DATA_SWITCH_RE = /switch\s*\(\s*(?:event|e|evt|msg)\.data(?:\.([a-zA-Z0-9_]+))?\s*\)/g;

/** case labels under a data switch: case 'login': */
const CASE_RE = /\bcase\s*(['"`])([^'"`]{1,80})\1\s*:/g;

/** Quoted https origins (allow-lists) inside handler context. */
const ORIGIN_LITERAL_RE = /(['"`])(https?:\/\/[a-zA-Z0-9.-]+(?::\d+)?)\1/g;

/**
 * Extract the parenthesized argument span starting at the '(' index,
 * respecting strings and nesting.
 *
 * @param {string} text
 * @param {number} parenIdx Index of '('.
 * @returns {string|null}
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
 * Split top-level comma-separated arguments of a call span "(a, b)".
 *
 * @param {string} callSpan The full "(...)" span.
 * @returns {string[]} Argument strings.
 */
function splitArgs(callSpan) {
  const inner = callSpan.slice(1, -1);
  const args = [];
  let depth = 0;
  let inStr = null;
  let escaped = false;
  let current = '';
  for (const ch of inner) {
    if (inStr) {
      current += ch;
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inStr = ch;
      current += ch;
    } else if (ch === '(' || ch === '[' || ch === '{') {
      depth++;
      current += ch;
    } else if (ch === ')' || ch === ']' || ch === '}') {
      depth--;
      current += ch;
    } else if (ch === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

/**
 * Unquote a JS string literal.
 *
 * @param {string} expr
 * @returns {string|null} Inner value, or null when not a literal.
 */
function unquote(expr) {
  const m = /^(['"`])([\s\S]*)\1$/.exec(expr.trim());
  return m ? m[2] : null;
}

/**
 * Catalog postMessage target origins (idea 00689). The wildcard '*' is
 * flagged explicitly since it means any origin may receive the message.
 *
 * @param {string} text Bundle or page text.
 * @returns {Array<{origin: string, kind: 'literal'|'wildcard'|'dynamic', count: number}>}
 */
export function catalogPostMessageOrigins(text) {
  const src = String(text || '');
  const counts = new Map();
  let m;
  POST_MESSAGE_RE.lastIndex = 0;
  while ((m = POST_MESSAGE_RE.exec(src)) !== null) {
    const parenIdx = src.indexOf('(', m.index);
    const call = parenIdx >= 0 ? balancedParens(src, parenIdx) : null;
    if (!call) continue;
    const args = splitArgs(call);
    if (args.length < 2) continue; // postMessage(msg) defaults to same-origin
    const lit = unquote(args[1]);
    let origin;
    let kind;
    if (lit === null) {
      origin = args[1].slice(0, 80);
      kind = 'dynamic';
    } else if (lit === '*') {
      origin = '*';
      kind = 'wildcard';
    } else {
      origin = lit;
      kind = 'literal';
    }
    const key = kind + '|' + origin;
    counts.set(key, { origin, kind, count: (counts.get(key)?.count || 0) + 1 });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count);
}

/**
 * Map message-event listeners (idea 00690): where they are registered, which
 * origins they expect, and which message data shapes they consume.
 *
 * @param {string} text Bundle or page text.
 * @returns {Array<{registration: string, originChecks: string[], expectedOrigins: string[], dataFields: string[], messageKinds: string[]}>}
 */
export function mapMessageListeners(text) {
  const src = String(text || '');
  const out = [];
  const registrations = [];

  let m;
  MESSAGE_LISTENER_RE.lastIndex = 0;
  while ((m = MESSAGE_LISTENER_RE.exec(src)) !== null) {
    registrations.push({ index: m.index, registration: "addEventListener('message')" });
  }
  ONMESSAGE_ASSIGN_RE.lastIndex = 0;
  while ((m = ONMESSAGE_ASSIGN_RE.exec(src)) !== null) {
    registrations.push({ index: m.index, registration: 'onmessage =' });
  }
  registrations.sort((a, b) => a.index - b.index);

  for (const { index, registration } of registrations) {
    // Inspect the handler context: a few hundred chars cover most listeners
    // without parsing full function bodies.
    const window_ = src.slice(index, index + 1500);
    const originChecks = [
      ...new Set([...window_.matchAll(ORIGIN_CHECK_RE)].map(x => `origin ${x[1]} ${x[3]}`)),
    ].slice(0, 10);
    const expectedOrigins = [
      ...new Set([...window_.matchAll(ORIGIN_LITERAL_RE)].map(x => x[2])),
    ].slice(0, 10);
    const dataFields = [
      ...new Set([...window_.matchAll(DATA_FIELD_RE)].map(x => x[1] || x[2])),
    ].slice(0, 20);
    const kinds = new Set();
    for (const sm of window_.matchAll(DATA_SWITCH_RE)) {
      const seg = window_.slice(sm.index, sm.index + 800);
      for (const cm of seg.matchAll(CASE_RE)) {
        kinds.add(cm[2]);
        if (kinds.size >= 20) break;
      }
    }
    out.push({
      registration,
      originChecks,
      expectedOrigins,
      dataFields,
      messageKinds: [...kinds],
    });
  }
  return out;
}

export const POST_MESSAGE_INTEL = {
  ideas: ['00689', '00690'],
  description: 'postMessage target-origin cataloging and message-listener mapping.',
};

export default POST_MESSAGE_INTEL;
