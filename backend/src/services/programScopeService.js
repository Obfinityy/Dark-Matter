/**
 * programScopeService.js — Elite Hunter mission (Oct 2026).
 *
 * Lets the user paste a *bounty program page* link (HackerOne, Bugcrowd,
 * Intigriti, …) as the hunt target. The service detects the program URL,
 * fetches the page, extracts the in-scope assets and the program's rules
 * prose, and returns a resolved scope the rest of the pipeline understands.
 *
 * The resolved scope feeds:
 *  - `normalizeScope()` via `input.scope` (included / excluded hosts)
 *  - `parseScopeRules()` (engines/scopeRuleParser.js) for allow/forbid rules
 *
 * Defensive design: this module only READS public program pages and parses
 * scope. It never crafts payloads or touches targets.
 */

import { parseScopeRules } from '../engines/scopeRuleParser.js';

const FETCH_TIMEOUT_MS = 20000;
const MAX_HTML_BYTES = 2 * 1024 * 1024;

/** Program-page URL patterns we know how to handle. */
const PROGRAM_PATTERNS = [
  {
    platform: 'hackerone',
    // https://hackerone.com/shopify  (also /type/hackerone?program=…)
    test: url => /(^|\.)hackerone\.com$/i.test(url.hostname) && /^\/[a-z0-9][a-z0-9_-]*\/?$/i.test(url.pathname),
    program: url => url.pathname.replace(/^\//, '').replace(/\/$/, ''),
  },
  {
    platform: 'bugcrowd',
    // https://bugcrowd.com/engagements/shopify-xyz
    test: url => /(^|\.)bugcrowd\.com$/i.test(url.hostname) && /^\/engagements\/[^/]+\/?$/i.test(url.pathname),
    program: url => url.pathname.split('/')[2] || '',
  },
  {
    platform: 'intigriti',
    // https://app.intigriti.com/programs/…  or intigriti.com/programs/…
    test: url => /(^|\.)intigriti\.com$/i.test(url.hostname) && /\/programs?\//i.test(url.pathname),
    program: url => url.pathname,
  },
];

/**
 * Detect whether a URL is a bounty-program page.
 * @param {string} rawUrl
 * @returns {{ platform: string, program: string } | null}
 */
export function detectProgramUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  for (const p of PROGRAM_PATTERNS) {
    try {
      if (p.test(url)) return { platform: p.platform, program: p.program(url) };
    } catch {
      /* ignore pattern errors */
    }
  }
  return null;
}

/** Fetch a page as text with a browser-like UA and a hard timeout. */
async function fetchPageText(pageUrl) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(pageUrl, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching program page`);
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_HTML_BYTES) throw new Error('Program page too large');
    return new TextDecoder().decode(buf);
  } finally {
    clearTimeout(timer);
  }
}

/** Very small HTML→text: strip scripts/styles/tags, keep line breaks. */
function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '\n')
    .replace(/<style[\s\S]*?<\/style>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Extract candidate target URLs/domains from a text fragment. */
function extractDomains(text) {
  const found = new Set();
  // Full URLs first.
  const urlRe = /https?:\/\/[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?(\/[^\s"'<>]*)?/gi;
  let m;
  while ((m = urlRe.exec(text)) !== null) {
    try {
      const u = new URL(m[0]);
      if (!/hackerone\.com|bugcrowd\.com|intigriti\.com/i.test(u.hostname)) {
        found.add(u.hostname.toLowerCase().replace(/^www\./, ''));
      }
    } catch {
      /* skip */
    }
    if (found.size > 200) break;
  }
  // Bare domains like "*.example.com" or "app.example.com" (with a dot + TLD).
  const domRe = /(?:^|[\s"'<>(),])(?:\*\.)?([a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+)/gi;
  while ((m = domRe.exec(text)) !== null) {
    const d = m[1].toLowerCase().replace(/^www\./, '');
    if (d.includes('.') && !/hackerone\.com|bugcrowd\.com|intigriti\.com/.test(d)) found.add(d);
    if (found.size > 200) break;
  }
  return [...found];
}

/** Split page text into sections by markdown-ish/HTML headings. */
function splitSections(text) {
  const lines = text.split('\n');
  const sections = [];
  let current = { heading: 'top', body: '' };
  for (const line of lines) {
    const t = line.trim();
    if (t.length > 2 && t.length < 120 && /^[A-Z][^.!?]{2,}$/.test(t) && /scope|target|asset|rule|bounty|reward|eligible|program/i.test(t)) {
      sections.push(current);
      current = { heading: t, body: '' };
    } else {
      current.body += line + '\n';
    }
  }
  sections.push(current);
  return sections;
}

/**
 * Resolve a bounty program page into a hunt scope.
 * @param {string} programUrl
 * @returns {Promise<{ platform, program, primaryTarget, included, excluded, scopeText, rules }>}
 */
export async function resolveProgramScope(programUrl) {
  const detected = detectProgramUrl(programUrl);
  if (!detected) throw new Error('Not a recognized bounty program URL');

  const html = await fetchPageText(programUrl);
  const text = htmlToText(html);
  const sections = splitSections(text);

  const included = new Set();
  const excluded = new Set();
  const rulesChunks = [];

  for (const s of sections) {
    const h = s.heading.toLowerCase();
    const isOut = /out[\s-]?of[\s-]?scope|excluded|not[\s-]?eligible|do not test/i.test(h);
    const isIn = /in[\s-]?scope|scope|target|asset|eligible/i.test(h);
    if (isOut) {
      extractDomains(s.body).forEach(d => excluded.add(d));
      rulesChunks.push(s.heading + '\n' + s.body.slice(0, 2000));
    } else if (isIn) {
      extractDomains(s.body).forEach(d => included.add(d));
      rulesChunks.push(s.heading + '\n' + s.body.slice(0, 2000));
    }
  }

  // Fallback: if no headed sections matched, scan the whole page for domains
  // near scope keywords.
  if (included.size === 0) {
    const idx = text.search(/in[\s-]?scope/i);
    const window = idx >= 0 ? text.slice(idx, idx + 8000) : text.slice(0, 8000);
    extractDomains(window).forEach(d => included.add(d));
  }

  for (const d of excluded) included.delete(d);
  const includedList = [...included];
  const excludedList = [...excluded];

  if (includedList.length === 0) {
    throw new Error(
      'Could not extract any in-scope targets from the program page. ' +
        'Paste a direct target URL instead, or check the program link.'
    );
  }

  const scopeText = rulesChunks.join('\n\n').slice(0, 12000) || text.slice(0, 12000);
  const rules = parseScopeRules(scopeText);

  return {
    platform: detected.platform,
    program: detected.program,
    primaryTarget: `https://${includedList[0]}`,
    included: includedList,
    excluded: excludedList,
    scopeText,
    rules,
    fetchedAt: new Date().toISOString(),
  };
}

export const PROGRAM_SCOPE_SERVICE = {
  detectProgramUrl,
  resolveProgramScope,
};

export default PROGRAM_SCOPE_SERVICE;
