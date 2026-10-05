/**
 * greenhouseBoardTokenExtractor.js — Greenhouse board-token host extraction.
 *
 * Greenhouse job boards are addressed as boards.greenhouse.io/<board_token>
 * (or embedded via JS at boards-api.greenhouse.io). The board token is a
 * public identifier that unlocks the org's job-board API surface — the set
 * of hosts and endpoints behind a target's hiring pages.
 *
 * Passive analysis: parse in-scope HTML/JS for board tokens and reconstruct
 * the exact API hosts they unlock. No scraping is performed here — only
 * extraction from already-collected text.
 */

const BOARD_TOKEN_PATTERNS = [
  // boards.greenhouse.io/<token> (board URL)
  { rx: /boards\.greenhouse\.io\/([a-z0-9_-]+)/gi, kind: 'board_url' },
  // boards-api.greenhouse.io/v1/boards/<token>/...
  { rx: /boards-api\.greenhouse\.io\/v\d+\/boards\/([a-z0-9_-]+)/gi, kind: 'api_url' },
  // JS: greenhouseBoardToken = "acme"; board_token: "acme"
  { rx: /(?:greenhouse[_-]?board[_-]?token|board[_-]?token)\s*[:=]\s*["']([a-z0-9_-]+)["']/gi, kind: 'js_config' },
  // Harvest embed: data-board-token="acme"
  { rx: /data-board-token\s*=\s*["']([a-z0-9_-]+)["']/gi, kind: 'embed_attr' },
  // Greenhouse "gh_src" job links: ?gh_src=..., plus /gh/jid query style
  { rx: /greenhouse\.io\/([a-z0-9_-]+)\/jobs/gi, kind: 'job_url' },
];

/** API host unlocked by a board token. */
export const GREENHOUSE_API_HOSTS = [
  'boards-api.greenhouse.io',
  'api.greenhouse.io',
  'boards.greenhouse.io',
];

/**
 * Extract Greenhouse board tokens from HTML/JS text.
 * @param {string} text page source, JS bundle, or config snippet
 * @param {string} [sourceUrl] where the text was collected (for evidence)
 * @returns {object[]} {token, kind, evidence} — deduplicated
 */
export function extractBoardTokens(text, sourceUrl = '') {
  const body = String(text || '');
  const seen = new Set();
  const results = [];
  const evidence = sourceUrl || '(inline)';

  for (const { rx, kind } of BOARD_TOKEN_PATTERNS) {
    rx.lastIndex = 0;
    let m;
    while ((m = rx.exec(body)) !== null) {
      const token = m[1].toLowerCase();
      // Skip obvious false positives (query keys, placeholder words).
      if (/^(jobs|boards|api|embed|v1|careers|openings|search|undefined|null)$/.test(token)) continue;
      const key = `${token}:${kind}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({ token, kind, evidence });
    }
  }
  return results;
}

/**
 * Build the canonical board + API URLs that a token unlocks.
 * @param {string} token board token
 * @returns {{boardUrl: string, apiUrl: string, jobsUrl: string, hosts: string[]}}
 */
export function boardTokenEndpoints(token) {
  const t = encodeURIComponent(String(token || '').toLowerCase());
  return {
    boardUrl: `https://boards.greenhouse.io/${t}`,
    apiUrl: `https://boards-api.greenhouse.io/v1/boards/${t}/jobs`,
    jobsUrl: `https://boards.greenhouse.io/${t}/jobs`,
    hosts: [...GREENHOUSE_API_HOSTS],
  };
}

/**
 * Cross-check: does a token look consistent with the target org name?
 * @param {string} token
 * @param {string} orgName organisation or domain slug, e.g. "acme"
 * @returns {'exact'|'close'|'unrelated'}
 */
export function tokenOrgMatch(token, orgName) {
  const t = String(token || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const o = String(orgName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!t || !o) return 'unrelated';
  if (t === o) return 'exact';
  if (t.includes(o) || o.includes(t)) return 'close';
  return 'unrelated';
}

export const GREENHOUSE_TOKENS = {
  extractBoardTokens,
  boardTokenEndpoints,
  tokenOrgMatch,
  GREENHOUSE_API_HOSTS,
};

export default GREENHOUSE_TOKENS;
