/**
 * researchFallback.js — technique-gap research for the continuous hunt loop
 * (issue #298).
 *
 * A human elite hunter, stuck on an unfamiliar technique, Googles it: they
 * read how a vulnerability CLASS works, then apply the concept to the target
 * with their own testing. This module does the same:
 *
 *   - triggered when the planner returns an unknown technique or a tool's
 *     output is insufficient to continue the current angle
 *   - queries the existing no-key web search infra (tools/builtin/webSearch.js:
 *     DuckDuckGo HTML + NVD for CVE queries) — no new API keys
 *   - logs { question, sources, whatWasLearned, howApplied } into the
 *     think-aloud trace
 *
 * Defensive framing only: we learn how a vulnerability CLASS works for
 * authorized testing. NO exploit payloads are fetched, stored, or logged.
 *
 * GitHub code search hook point: GitHub's code search API needs auth, which
 * this loop never carries. Pass `githubSearch: async (query) => [...]` to
 * plug it in later; until then it is simply skipped and noted.
 */

import { webSearch, webFetch } from '../tools/builtin/webSearch.js';

/** Queries that would be out of defensive scope — never issued. */
const OFFLIMITS = /(exploit-db payload|weaponiz|rce payload|shellcode|0day sale|buy exploit)/i;

/** Strip anything that looks like a payload from text we keep. */
export function scrubDefensive(text) {
  return String(text || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '[removed]')
    .replace(/\bunion\s+select\b/gi, '[removed]')
    .replace(/\bsleep\s*\(\s*\d+\s*\)/gi, '[removed]')
    .replace(/\bdrop\s+table\b/gi, '[removed]')
    .slice(0, 3000);
}

/** Frame the question defensively, the way a security analyst would ask it. */
export function defensiveQuery(question) {
  const q = String(question || '').trim().slice(0, 200);
  if (OFFLIMITS.test(q)) throw new Error('researchFallback: question outside defensive scope');
  // Ask about the vulnerability CLASS and testing methodology, never for payloads.
  return `${q} vulnerability class explained security testing methodology`;
}

/**
 * Research a technique gap.
 *
 * @param {object} opts
 * @param {string} opts.question — what the hunter doesn't know yet
 * @param {object} [opts.search] — DI: { webSearch, webFetch } (defaults to the real no-key impl)
 * @param {function|null} [opts.githubSearch] — hook point: async (query) => [{ title, url, snippet }]
 * @param {number} [opts.maxResults]
 * @param {function|null} [opts.trace] — (entry) => void, think-aloud sink
 * @param {object} [opts.logger]
 * @returns {Promise<{ question, sources, whatWasLearned, howApplied, githubNote }>}
 */
export async function researchTechnique({
  question,
  search = null,
  githubSearch = null,
  maxResults = 6,
  trace = null,
  logger = console,
} = {}) {
  if (!question || !String(question).trim()) throw new Error('researchTechnique requires a question');
  const q = String(question).trim().slice(0, 200);
  const ws = search?.webSearch || webSearch;
  const wf = search?.webFetch || webFetch;

  const query = defensiveQuery(q);
  trace?.({ kind: 'research', text: `I hit a technique gap: "${q}". A human hunter would research how this vulnerability class works — looking it up now.` });

  const sources = [];
  try {
    const hits = await ws(query, maxResults);
    for (const h of (hits || []).slice(0, maxResults)) {
      sources.push({ title: h.title || '', url: h.url || '', snippet: scrubDefensive(h.snippet || '') });
    }
  } catch (error) {
    logger.warn?.(`[researchFallback] web search failed: ${error.message}`);
  }

  // Optional GitHub code search (needs auth — skipped unless a hook is provided).
  let githubNote = 'GitHub code search skipped (no authenticated hook configured).';
  if (typeof githubSearch === 'function') {
    try {
      const gh = await githubSearch(`${q} vulnerability detection`);
      for (const h of (gh || []).slice(0, 3)) {
        sources.push({ title: h.title || '', url: h.url || '', snippet: scrubDefensive(h.snippet || '') });
      }
      githubNote = `GitHub code search consulted (${(gh || []).length} result(s)).`;
    } catch (error) {
      githubNote = `GitHub code search hook failed: ${error.message}`;
    }
  }

  // Read one top source in depth (bounded, read-only).
  let deepRead = '';
  for (const s of sources.slice(0, 2)) {
    if (!s.url || !/^https?:\/\//i.test(s.url)) continue;
    try {
      const page = await wf(s.url);
      deepRead = scrubDefensive(page?.text || '').slice(0, 1500);
      if (deepRead) break;
    } catch {
      /* best effort */
    }
  }

  const whatWasLearned = [
    `Researched "${q}" as a vulnerability class for authorized testing.`,
    sources.length
      ? `Top sources: ${sources.slice(0, 3).map(s => s.title || s.url).join(' | ').slice(0, 300)}`
      : 'No web results returned; proceeding from built-in knowledge.',
    deepRead ? `In-depth read: ${deepRead.slice(0, 400)}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const howApplied = [
    `Applying the ${q} concept to the current hunt angle with the loop's safe, non-destructive test methods.`,
    'Focus: detect and evidence the weakness class on the authorized target only; report findings + remediation.',
  ].join(' ');

  const entry = { question: q, sources, whatWasLearned, howApplied, githubNote };
  trace?.({
    kind: 'research',
    text: `Research done on "${q}": consulted ${sources.length} source(s). ${githubNote} Learning applied to the current angle as detection concepts only — no payloads kept.`,
  });
  return entry;
}

export default { researchTechnique, defensiveQuery, scrubDefensive };
