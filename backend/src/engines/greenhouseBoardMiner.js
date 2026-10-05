/**
 * greenhouseBoardMiner.js — Greenhouse board-token host extraction engine.
 *
 * @idea 00294
 * Covers idea-bank item 00294:
 *  - 00294 Greenhouse board-token host extraction — extract Greenhouse board
 *    tokens to enumerate job-board API hosts.
 *
 * Pure functions only: the caller fetches careers-page HTML / JS configs and
 * passes the raw text in. No live HTTP here.
 */

const BOARD_TOKEN_RE = /boards\.greenhouse\.io\/embed\/job_board\/?\?for=([A-Za-z0-9_\-]+)/gi;
const BOARD_URL_RE = /(?:https?:)?\/\/(?:boards\.greenhouse\.io)([^\s"'<>()]*)/gi;
const TOKEN_ATTR_RE = /(?:for|token|board[_-]?token)\s*[:=]\s*["']([A-Za-z0-9_\-]{3,64})["']/gi;

// Path segments that are Greenhouse URL keywords, never board tokens.
const BOARD_PATH_STOPWORDS = new Set(['embed', 'job_board', 'jobboard', 'jobs', 'js', 'api', 'v1', 'departments', 'offices']);

/**
 * Validate a candidate Greenhouse board token (org slug).
 * Greenhouse tokens are lowercase alphanumeric slugs with dashes/underscores.
 * @param {string} token
 * @returns {boolean}
 */
export function isValidBoardToken(token) {
  return /^[A-Za-z0-9][A-Za-z0-9_\-]{2,63}$/.test(String(token || ''));
}

/**
 * Build the canonical Greenhouse board hosts for a board token.
 * @param {string} token board token (org slug)
 * @returns {{token: string, hosts: {host: string, purpose: string}[]}}
 */
export function greenhouseHostsForToken(token) {
  const t = String(token || '').trim();
  if (!isValidBoardToken(t)) return { token: t, hosts: [] };
  return {
    token: t,
    hosts: [
      { host: 'boards.greenhouse.io', purpose: 'public job-board API host' },
      { host: `${t}.boards.greenhouse.io`, purpose: 'token-scoped board host variant' },
      { host: 'api.greenhouse.io', purpose: 'Harvest API host (auth required; check exposure)' },
      { host: 'app.greenhouse.io', purpose: 'Greenhouse app host' },
    ],
  };
}

/**
 * Extract Greenhouse board tokens from page source and map them to
 * job-board API hosts.
 *
 * @param {string} source HTML, JS config, or embed snippet
 * @returns {{
 *   token: string, source: string, hosts: {host: string, purpose: string}[],
 *   context: string
 * }[]}
 */
export function extractGreenhouseBoardTokens(source = '') {
  const text = String(source || '');
  const byToken = new Map();

  const add = (token, kind, index) => {
    if (!isValidBoardToken(token)) return;
    if (BOARD_PATH_STOPWORDS.has(String(token).toLowerCase())) return;
    if (byToken.has(token)) return;
    const start = Math.max(0, index - 100);
    const context = text.slice(start, index + 120).replace(/\s+/g, ' ').trim();
    byToken.set(token, {
      token,
      source: kind,
      hosts: greenhouseHostsForToken(token).hosts,
      context,
    });
  };

  for (const m of text.matchAll(BOARD_TOKEN_RE)) add(m[1], 'embed-url', m.index ?? 0);

  for (const m of text.matchAll(BOARD_URL_RE)) {
    const path = m[1] || '';
    const forParam = path.match(/[?&]for=([A-Za-z0-9_\-]+)/);
    if (forParam) add(forParam[1], 'board-url', m.index ?? 0);
    const slug = path.match(/^\/([A-Za-z0-9_\-]+)(?:\/|$)/);
    if (slug) add(slug[1], 'board-path', m.index ?? 0);
  }

  // Bare token attributes only make sense next to a greenhouse reference.
  if (/greenhouse/i.test(text)) {
    for (const m of text.matchAll(TOKEN_ATTR_RE)) add(m[1], 'token-attr', m.index ?? 0);
  }

  return [...byToken.values()].sort((a, b) => a.token.localeCompare(b.token));
}

/**
 * Score extracted board tokens: each valid token enumerates a public
 * job-board surface worth API-exposure review.
 * @param {ReturnType<typeof extractGreenhouseBoardTokens>} tokens
 * @returns {{token: string, score: number, reason: string}[]}
 */
export function scoreBoardTokens(tokens = []) {
  return (tokens || []).map((t) => ({
    token: t.token,
    score: 60,
    reason: `Greenhouse board token exposes a public job-board API surface (${t.hosts.length} hosts) — review for internal references and API auth gaps`,
  })).sort((a, b) => a.token.localeCompare(b.token));
}
