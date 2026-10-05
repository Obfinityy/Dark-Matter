/**
 * leverApiMiner.js — Lever postings-API host mining engine.
 *
 * @idea 00295
 * Covers idea-bank item 00295:
 *  - 00295 Lever postings API host mining — query Lever's postings API for
 *    the org to find its careers hosts.
 *
 * Pure functions only: the caller resolves the org's Lever token and fetches
 * postings JSON; both are passed in. No live HTTP here.
 */

const LEVER_HOSTS = [
  { host: 'api.lever.co', purpose: 'public postings API host' },
  { host: 'jobs.lever.co', purpose: 'hosted careers-board host' },
  { host: 'lever.co', purpose: 'Lever corporate host' },
];

const URL_RE = /(?:https?:)?\/\/([^/:\s"'<>()?#]+)(?::\d+)?(?:\/[^\s"'<>()]*)?/gi;

/**
 * Validate a Lever org token (postings API identifier).
 * @param {string} token
 * @returns {boolean}
 */
export function isValidLeverToken(token) {
  return /^[A-Za-z0-9][A-Za-z0-9_\-]{1,63}$/.test(String(token || ''));
}

/**
 * Build the canonical Lever careers hosts for an org token.
 * @param {string} token Lever org token
 * @returns {{token: string, hosts: {host: string, purpose: string}[]}}
 */
export function leverHostsForToken(token) {
  const t = String(token || '').trim();
  if (!isValidLeverToken(t)) return { token: t, hosts: [] };
  return {
    token: t,
    hosts: [
      ...LEVER_HOSTS,
      { host: `${t}.lever.co`, purpose: 'token-scoped board host variant' },
    ],
  };
}

/**
 * Extract candidate Lever org tokens from page source.
 * @param {string} source HTML / JS containing Lever references
 * @returns {{token: string, source: string, context: string}[]}
 */
export function extractLeverTokens(source = '') {
  const text = String(source || '');
  const found = new Map();

  const patterns = [
    { re: /jobs\.lever\.co\/([A-Za-z0-9_\-]+)(?:\/|\?|["'\s<]|$)/gi, kind: 'board-url' },
    { re: /api\.lever\.co\/v\d+\/postings\/([A-Za-z0-9_\-]+)/gi, kind: 'api-url' },
    { re: /lever[_-]?token\s*[:=]\s*["']([A-Za-z0-9_\-]+)["']/gi, kind: 'token-attr' },
  ];

  for (const { re, kind } of patterns) {
    for (const m of text.matchAll(re)) {
      const token = m[1];
      if (!isValidLeverToken(token) || found.has(token)) continue;
      const start = Math.max(0, (m.index ?? 0) - 80);
      found.set(token, {
        token,
        source: kind,
        context: text.slice(start, (m.index ?? 0) + 100).replace(/\s+/g, ' ').trim(),
      });
    }
  }

  return [...found.values()].sort((a, b) => a.token.localeCompare(b.token));
}

/**
 * Mine host references out of a Lever postings API response payload.
 * Job descriptions and hosted URLs frequently leak internal hostnames.
 *
 * @param {object | object[]} postings parsed postings JSON (object or array)
 * @returns {{host: string, contexts: string[]}[]} deduped hosts
 */
export function mineHostsFromPostings(postings) {
  const payload = JSON.stringify(postings || {});
  const byHost = new Map();

  for (const m of payload.matchAll(URL_RE)) {
    const host = m[1].trim().toLowerCase().replace(/\.$/, '');
    if (!host || host === 'lever.co' || host.endsWith('.lever.co')) continue;
    if (/^(localhost|127\.0\.0\.1)$/.test(host)) continue;
    if (!byHost.has(host)) byHost.set(host, { host, contexts: [] });
    const entry = byHost.get(host);
    if (entry.contexts.length < 3 && !entry.contexts.includes(m[0].slice(0, 120))) {
      entry.contexts.push(m[0].slice(0, 120));
    }
  }

  return [...byHost.values()].sort((a, b) => b.contexts.length - a.contexts.length || a.host.localeCompare(b.host));
}

/**
 * Classify mined hosts as likely internal vs external references.
 * @param {{host: string, contexts: string[]}[]} hosts
 * @param {string} brandDomain org's primary domain for comparison
 * @returns {{host: string, kind: string, contexts: string[]}[]}
 */
export function classifyMinedHosts(hosts = [], brandDomain = '') {
  const brand = String(brandDomain || '').trim().toLowerCase();
  return (hosts || []).map((h) => {
    let kind = 'external';
    if (brand && (h.host === brand || h.host.endsWith(`.${brand}`))) kind = 'internal';
    else if (/\.(internal|corp|intranet|local|lan|private)$/i.test(h.host)) kind = 'internal-suspect';
    return { host: h.host, kind, contexts: h.contexts };
  }).sort((a, b) => (a.kind === 'internal-suspect' ? 0 : 1) - (b.kind === 'internal-suspect' ? 0 : 1) || a.host.localeCompare(b.host));
}

/**
 * Score Lever findings: internal host leaks in job descriptions are the
 * highest-value signal for shadow-IT enumeration.
 * @param {{host: string, kind: string}[]} classified
 * @returns {{host: string, score: number, reason: string}[]}
 */
export function scoreLeverFindings(classified = []) {
  return (classified || []).map((c) => {
    let score = 30;
    let reason = 'external host referenced in Lever postings — likely benign vendor/tooling link';
    if (c.kind === 'internal') {
      score = 65;
      reason = 'target-domain host referenced in public job postings — confirms public careers infrastructure';
    }
    if (c.kind === 'internal-suspect') {
      score = 85;
      reason = 'internal-suspect hostname leaked in public Lever postings — investigate for shadow IT';
    }
    return { host: c.host, score, reason };
  }).sort((a, b) => b.score - a.score);
}
