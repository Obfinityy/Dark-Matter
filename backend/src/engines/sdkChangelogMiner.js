/**
 * sdkChangelogMiner.js — SDK release-notes endpoint tracker.
 *
 * Parses fetched SDK changelogs / release notes (Markdown/HTML) for:
 *  - new endpoint URLs introduced per SDK version
 *  - deprecated hosts / endpoints being retired
 *  - version + date structure so hunts can prioritize the newest surface
 *
 * Pure functions: takes fetched changelog text, returns structured intel.
 */

const VERSION_RE = /(?:^|\s)(?:v|version\s*)?(\d{1,3}\.\d{1,3}(?:\.\d{1,3})?)/gim;
const DATE_RE = /\b(20\d{2}[-/.](?:0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\d|3[01]))\b/;
const URL_RE = /https?:\/\/[^\s"'`<>()\]]+/gi;
const PATH_RE = /`?\s*((?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+\/[A-Za-z0-9._~!$&'()*+,;=:@%\/-]*)\s*`?/g;
const HOST_RE = /^https?:\/\/([^/:?#]+)/i;

const NEW_RE = /\b(add(?:ed|ing|s)?|new|introduc(?:ed|ing|es)|support(?:s|ed)?|launch(?:ed|es)?|now supports?)\b/i;
const DEPRECATE_RE = /\b(deprecat(?:ed|ing|es|ion)|obsolete|retire[sd]?|remov(?:ed|ing|es)|drop(?:ped|ping|s)?|sunset|eol|discontinu)/i;

/** Classify a changelog line as announcing something new, retiring, or neutral. */
export function classifyLine(line = '') {
  const s = line.trim();
  if (!s) return 'neutral';
  if (DEPRECATE_RE.test(s)) return 'retiring';
  if (NEW_RE.test(s)) return 'new';
  return 'neutral';
}

/** Split changelog into per-version blocks. */
export function splitVersionBlocks(text = '') {
  if (typeof text !== 'string') throw new TypeError('text must be a string');
  const matches = [...text.matchAll(VERSION_RE)].map(m => ({ version: m[1], index: m.index }));
  if (!matches.length) return [{ version: 'unversioned', text }];
  return matches.map((m, i) => ({
    version: m.version,
    text: text.slice(m.index, i + 1 < matches.length ? matches[i + 1].index : text.length),
  }));
}

/** Extract full endpoint URLs and METHOD /path mentions from a block. */
export function extractEndpointMentions(blockText = '') {
  const urls = new Set();
  URL_RE.lastIndex = 0;
  let m;
  while ((m = URL_RE.exec(blockText))) {
    const clean = m[0].replace(/[.,;:!?]+$/, '');
    if (HOST_RE.test(clean)) urls.add(clean);
  }
  const routes = [];
  PATH_RE.lastIndex = 0;
  while ((m = PATH_RE.exec(blockText))) {
    const route = m[1].replace(/\s+/g, ' ').trim();
    if (route.split(' ')[1].length >= 2) routes.push(route);
  }
  return { urls: [...urls], routes: [...new Set(routes)] };
}

/** Pull the host from a URL string. */
export function hostOf(url) {
  const m = String(url).match(HOST_RE);
  return m ? m[1].toLowerCase() : '';
}

/**
 * Parse an SDK changelog for new endpoint URLs and deprecated hosts.
 * @param {object} input
 * @param {string} input.url - changelog URL (provenance)
 * @param {string} input.text - fetched changelog text
 * @param {string} [input.sdk] - SDK name (e.g. "acme-js")
 * @returns per-version intel plus roll-ups
 */
export function mineSdkChangelog({ url = '', text = '', sdk = '' } = {}) {
  const blocks = splitVersionBlocks(text);
  const versions = blocks.map(b => {
    const { urls, routes } = extractEndpointMentions(b.text);
    const date = (b.text.match(DATE_RE) || [])[0] || null;
    const lines = b.text.split('\n').map(l => l.trim()).filter(Boolean);
    const newLines = lines.filter(l => classifyLine(l) === 'new');
    const retiringLines = lines.filter(l => classifyLine(l) === 'retiring');
    return {
      version: b.version,
      date,
      hosts: [...new Set(urls.map(hostOf).filter(Boolean))],
      newEndpointUrls: urls,
      newRoutes: routes,
      retiringMentions: retiringLines.slice(0, 50),
      noteCount: newLines.length + retiringLines.length,
    };
  });

  const allHosts = [...new Set(versions.flatMap(v => v.hosts))];
  const newEndpoints = versions.flatMap(v => v.newEndpointUrls.map(u => ({ version: v.version, url: u })));
  const retiring = versions.flatMap(v => v.retiringMentions.map(t => ({ version: v.version, text: t })));

  return {
    url,
    sdk,
    type: 'SDK Release-Notes Endpoint Tracking',
    confidence: newEndpoints.length || allHosts.length ? 'medium' : 'low',
    evidence: `${versions.length} version block(s) in ${sdk || 'SDK'} changelog: ${newEndpoints.length} new endpoint URL(s), ${retiring.length} retiring mention(s), ${allHosts.length} host(s).`,
    versions,
    newEndpoints,
    retiringMentions: retiring,
    hosts: allHosts,
  };
}

export const SDK_CHANGELOG_MINER = {
  splitVersionBlocks, classifyLine, extractEndpointMentions, hostOf, mineSdkChangelog,
};
export default SDK_CHANGELOG_MINER;
