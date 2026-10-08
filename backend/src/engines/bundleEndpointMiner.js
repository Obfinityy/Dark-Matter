/**
 * bundleEndpointMiner.js — Endpoint extraction from dead code and comments.
 *
 * Shipped bundles often keep secrets the bundler failed to remove:
 * unreachable branches that tree-shaking missed, and code that was
 * "removed" by commenting it out. For an authorized hunt these are
 * legitimate leads to undocumented API surface.
 *
 * Ideas covered:
 *  00685 Dead-code endpoint extraction — extract API endpoints from
 *          unreachable code branches that bundlers failed to tree-shake.
 *  00686 Commented-out endpoint harvesting — harvest endpoints left in
 *          code comments of shipped bundles.
 */

/** Quoted string literal that looks like a path or URL. */
const PATH_LITERAL_RE =
  /(['"`])((?:https?:\/\/[^\s'"`\\]+|\/[a-zA-Z0-9_\-\/.{}:@?&=+%~!$'()*,;[\]]+))\1/g;

/** Bare path tokens without quotes (common inside comments). */
const BARE_PATH_RE =
  /(?:^|[\s(,;=:>"']|\()((?:https?:\/\/[^\s"'<>]+|\/(?:[a-zA-Z0-9_\-\/.{}@?&=+%~]+)))/g;

/**
 * Extract unquoted path tokens from comment text, where endpoints are
 * often written without string delimiters.
 *
 * @param {string} text
 * @returns {string[]} Deduped endpoints.
 */
export function extractBarePaths(text) {
  const out = new Set();
  const src = String(text || '');
  let m;
  BARE_PATH_RE.lastIndex = 0;
  while ((m = BARE_PATH_RE.exec(src)) !== null) {
    const ep = normalizeEndpoint(m[1].replace(/[.,;:!?]+$/, ''));
    if (ep && !/\.(js|css|png|jpg|jpeg|svg|ico|woff2?|ttf)$/i.test(ep)) out.add(ep);
  }
  return [...out].sort();
}

/** Noise paths that appear in every bundle and reveal nothing. */
const NOISE_PATHS = new Set([
  '/',
  '/favicon.ico',
  '/robots.txt',
  '/manifest.json',
  '/__webpack_hmr',
  '/sockjs-node',
  '/browser-sync',
  '/_next/static',
]);

/**
 * Normalize an endpoint candidate; returns null for noise.
 *
 * @param {string} ep
 * @returns {string|null}
 */
export function normalizeEndpoint(ep) {
  if (!ep) return null;
  const e = ep.trim();
  if (e.length < 2 || NOISE_PATHS.has(e)) return null;
  if (!e.startsWith('/') && !/^https?:\/\//i.test(e)) return null;
  if (/^https?:\/\/[^/]+\/?$/i.test(e)) return null; // bare origin
  return e;
}

/**
 * Extract path/URL literals from arbitrary text.
 *
 * @param {string} text
 * @returns {string[]} Deduped endpoints.
 */
export function extractEndpointsFromText(text) {
  const out = new Set();
  const src = String(text || '');
  let m;
  PATH_LITERAL_RE.lastIndex = 0;
  while ((m = PATH_LITERAL_RE.exec(src)) !== null) {
    const ep = normalizeEndpoint(m[2]);
    if (ep) out.add(ep);
  }
  return [...out].sort();
}

/** Matches line comments, block comments and HTML comments. */
const COMMENT_RE = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->)/g;

/**
 * Harvest endpoints left inside comments of a shipped bundle (idea 00686).
 *
 * @param {string} bundle Bundle text (or HTML page text).
 * @returns {Array<{endpoint: string, commentKind: 'line'|'block'|'html', context: string}>}
 */
export function harvestCommentedEndpoints(bundle) {
  const text = String(bundle || '');
  const out = [];
  const seen = new Set();
  let m;
  COMMENT_RE.lastIndex = 0;
  while ((m = COMMENT_RE.exec(text)) !== null) {
    const comment = m[1];
    const kind = comment.startsWith('//') ? 'line' : comment.startsWith('<!--') ? 'html' : 'block';
    const endpoints = [...extractEndpointsFromText(comment), ...extractBarePaths(comment)];
    for (const endpoint of endpoints) {
      if (seen.has(endpoint)) continue;
      seen.add(endpoint);
      out.push({
        endpoint,
        commentKind: kind,
        context: comment.trim().slice(0, 120),
      });
    }
  }
  return out;
}

/** Conditions that are statically false — the body never executes. */
const DEAD_CONDITION_RE =
  /\b(?:if|while)\s*\(\s*(?:false|!1|!0\s*===\s*1|0|void\s+0|undefined)\s*\)/g;

/**
 * Extract the brace-balanced block starting at the given opening brace.
 *
 * @param {string} text
 * @param {number} openIdx Index of the '{'.
 * @returns {string|null}
 */
function balancedBlock(text, openIdx) {
  let depth = 0;
  let inStr = null;
  let escaped = false;
  for (let i = openIdx; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') inStr = ch;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(openIdx, i + 1);
    }
  }
  return null;
}

/**
 * Extract API endpoints from unreachable code branches (idea 00685).
 * Handles statically-false conditions (if(false), while(false), ...) and
 * the dead consequent of `false ? a : b` ternaries.
 *
 * @param {string} bundle Bundle text.
 * @returns {Array<{endpoint: string, reason: 'dead-branch'|'dead-ternary', condition: string}>}
 */
export function extractDeadCodeEndpoints(bundle) {
  const text = String(bundle || '');
  const out = [];
  const seen = new Set();
  const add = (endpoint, reason, condition) => {
    if (!seen.has(endpoint)) {
      seen.add(endpoint);
      out.push({ endpoint, reason, condition });
    }
  };

  // Dead branches: if(false){...}, while(false){...}
  let m;
  DEAD_CONDITION_RE.lastIndex = 0;
  while ((m = DEAD_CONDITION_RE.exec(text)) !== null) {
    const openIdx = text.indexOf('{', m.index + m[0].length);
    if (openIdx < 0) continue;
    const block = balancedBlock(text, openIdx);
    if (!block) continue;
    for (const endpoint of extractEndpointsFromText(block)) {
      add(endpoint, 'dead-branch', m[0].trim());
    }
  }

  // Dead ternary consequent: false ? deadValue : liveValue
  const ternaryRe = /\bfalse\s*\?\s*([^:;]{1,400}?)\s*:/g;
  while ((m = ternaryRe.exec(text)) !== null) {
    for (const endpoint of extractEndpointsFromText(m[1])) {
      add(endpoint, 'dead-ternary', 'false ? ...');
    }
  }

  return out;
}

export const BUNDLE_ENDPOINT_MINER = {
  ideas: ['00685', '00686'],
  description: 'Endpoint extraction from dead code branches and code comments.',
};

export default BUNDLE_ENDPOINT_MINER;
