/**
 * apiChangelogTracker.js — API changelog host tracker.
 *
 * Parses fetched API changelog / release-notes pages (Markdown or HTML) for:
 *  - newly announced endpoints (added routes, new HTTP methods)
 *  - hosts/base URLs named in the changelog
 *  - deprecated or removed endpoints worth retesting during a bounty hunt
 *
 * Pure functions: takes fetched page text, returns structured intel.
 */

const VERSION_RE = /(?:^|\s)(?:v|version\s*)?(\d{1,3}\.\d{1,3}(?:\.\d{1,3})?)/gim;
const DATE_RE = /\b(20\d{2}[-/.](?:0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\d|3[01]))\b/g;
const PATH_RE =
  /`?\s*((?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+\/[A-Za-z0-9._~!$&'()*+,;=:@%\/-]*)\s*`?/g;
const HOST_RE = /\bhttps?:\/\/((?:[a-z0-9-]+\.)+[a-z]{2,})(?::\d{1,5})?\b/gi;

/** Split changelog text into per-version blocks (best effort). */
export function splitVersionBlocks(text = '') {
  const blocks = [];
  const matches = [...text.matchAll(VERSION_RE)].map(m => ({ version: m[1], index: m.index }));
  if (!matches.length) return [{ version: 'unversioned', text }];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    blocks.push({ version: matches[i].version, text: text.slice(start, end) });
  }
  return blocks;
}

const ADD_RE = /\b(add(?:ed|ing|s)?|new|introduc(?:ed|ing|es)|launch(?:ed|es)?|release[sd]?)\b/i;
const REMOVE_RE = /\b(remov(?:ed|ing|es)|delet(?:ed|ing|es)|dropped|retire[sd]?|sunset)\b/i;
const DEPRECATE_RE = /\b(deprecat(?:ed|ing|es|ion)|obsolete|eol)\b/i;

/** Classify a changelog line/paragraph as added, removed, deprecated, or other. */
export function classifyChange(segment = '') {
  const s = segment.trim();
  if (!s) return 'other';
  if (DEPRECATE_RE.test(s)) return 'deprecated';
  if (REMOVE_RE.test(s)) return 'removed';
  if (ADD_RE.test(s)) return 'added';
  return 'other';
}

/** Extract `METHOD /path` style endpoint mentions from a text block. */
export function extractEndpoints(blockText = '') {
  const found = [];
  PATH_RE.lastIndex = 0;
  let m;
  while ((m = PATH_RE.exec(blockText))) {
    const endpoint = m[1].replace(/\s+/g, ' ').trim();
    if (endpoint.split(' ')[1].length < 2) continue;
    const lineStart = blockText.lastIndexOf('\n', m.index) + 1;
    const lineEnd = blockText.indexOf('\n', m.index);
    const line = blockText.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
    found.push({ endpoint, change: classifyChange(line) });
  }
  return found;
}

/** Extract host mentions from a text block. */
export function extractHosts(blockText = '') {
  HOST_RE.lastIndex = 0;
  const seen = new Set();
  let m;
  while ((m = HOST_RE.exec(blockText))) seen.add(m[1].toLowerCase());
  return [...seen];
}

/**
 * Track API changelog text for newly announced endpoints and hosts.
 * @param {object} input
 * @param {string} input.url - changelog page URL (provenance)
 * @param {string} input.text - fetched changelog text (Markdown/HTML stripped)
 * @returns per-version findings plus roll-up of new/deprecated endpoints
 */
export function trackChangelog({ url = '', text = '' } = {}) {
  if (typeof text !== 'string') throw new TypeError('text must be a string');
  const blocks = splitVersionBlocks(text);
  const versions = blocks.map(b => {
    const endpoints = extractEndpoints(b.text);
    const dateMatch = b.text.match(DATE_RE);
    return {
      version: b.version,
      date: dateMatch ? dateMatch[0] : null,
      hosts: extractHosts(b.text),
      endpoints,
      added: endpoints.filter(e => e.change === 'added').map(e => e.endpoint),
      removed: endpoints.filter(e => e.change === 'removed').map(e => e.endpoint),
      deprecated: endpoints.filter(e => e.change === 'deprecated').map(e => e.endpoint),
    };
  });

  const allAdded = versions.flatMap(v => v.added.map(e => ({ version: v.version, endpoint: e })));
  const allDeprecated = versions.flatMap(v =>
    v.deprecated.map(e => ({ version: v.version, endpoint: e }))
  );
  const allHosts = [...new Set(versions.flatMap(v => v.hosts))];

  return {
    url,
    type: 'API-Changelog Host Tracking',
    confidence: allAdded.length || allHosts.length ? 'medium' : 'low',
    evidence: `${versions.length} version block(s): ${allAdded.length} newly announced endpoint(s), ${allDeprecated.length} deprecated, hosts mentioned: ${allHosts.length}.`,
    versions,
    newEndpoints: allAdded,
    deprecatedEndpoints: allDeprecated,
    hosts: allHosts,
  };
}

export const API_CHANGELOG_TRACKER = {
  splitVersionBlocks,
  classifyChange,
  extractEndpoints,
  extractHosts,
  trackChangelog,
};
export default API_CHANGELOG_TRACKER;
