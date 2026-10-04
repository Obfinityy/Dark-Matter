/**
 * githubEmailPivotIntel.js — GitHub commit-email domain pivoting (idea 00215).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent.
 * Public commit metadata often carries corporate author emails (e.g.
 * `jdoe@subsidiary.example`) that reveal domains beyond the primary brand.
 * This module parses commit author emails from either git patch-format text
 * (`From:` / author lines) or GitHub API commit JSON, extracts the email
 * domains, and scores each domain's confidence as a related corporate asset.
 *
 * No network calls are made here — the caller supplies already-fetched patch
 * text or API JSON. Free-mail providers are filtered out; only candidate
 * organizational domains are scored.
 */

const FREEMAIL = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'ymail.com', 'hotmail.com',
  'outlook.com', 'live.com', 'msn.com', 'aol.com', 'icloud.com', 'me.com',
  'mac.com', 'protonmail.com', 'proton.me', 'pm.me', 'tutanota.com',
  'fastmail.com', 'zoho.com', 'gmx.com', 'gmx.de', 'mail.com', 'yandex.com',
  'yandex.ru', 'qq.com', '163.com', '126.com', 'sina.com', 'naver.com',
  'daum.net', 'rediffmail.com', 'inbox.com', 'hushmail.com', 'mail.ru',
  'users.noreply.github.com',
]);

/**
 * Extract author emails from git patch-format text.
 *
 * Handles `From:`, `Author:`, and mbox-style `>From ` author lines, plus the
 * `author Name <email>` fields embedded in `git log --format=fuller` output.
 *
 * @param {string} patchText - Patch/log text containing author lines.
 * @returns {Array<{ name: string|null, email: string }>}
 */
export function extractEmailsFromPatch(patchText) {
  const authors = [];
  const seen = new Set();
  const lineRe = /^(?:From|Author):\s*"?([^"<\r\n]*)"?\s*<([^<>\s]+)>\s*$/gim;
  const fullerRe = /^author\s+([^<\r\n]*?)\s*<([^<>\s]+)>\s*$/gim;
  const text = String(patchText || '');

  for (const re of [lineRe, fullerRe]) {
    let m;
    while ((m = re.exec(text)) !== null) {
      const email = m[2].trim().toLowerCase();
      const key = email;
      if (!seen.has(key) && email.includes('@')) {
        seen.add(key);
        authors.push({ name: (m[1] || '').trim() || null, email });
      }
    }
  }
  return authors;
}

/**
 * Extract author/committer emails from GitHub API commit JSON.
 *
 * Accepts a single commit object, an array of commits, or the
 * `GET /repos/{owner}/{repo}/commits` list payload.
 *
 * @param {Object|Array} payload - GitHub commit JSON.
 * @returns {Array<{ name: string|null, email: string, login: string|null }>}
 */
export function extractEmailsFromApiCommits(payload) {
  const commits = Array.isArray(payload) ? payload : [payload];
  const authors = [];
  const seen = new Set();
  for (const c of commits) {
    if (!c || typeof c !== 'object') continue;
    const candidates = [
      { src: c.commit?.author, login: c.author?.login ?? null },
      { src: c.commit?.committer, login: c.committer?.login ?? null },
    ];
    for (const { src, login } of candidates) {
      const email = String(src?.email || '').trim().toLowerCase();
      if (!email || !email.includes('@') || seen.has(email)) continue;
      seen.add(email);
      authors.push({ name: src?.name ?? null, email, login });
    }
  }
  return authors;
}

/**
 * Pivot from author emails to candidate corporate domains with confidence.
 *
 * Scoring heuristics (additive, capped at 1.0):
 *  - starts at 0.35 for any organizational (non-freemail) domain;
 *  - +0.25 if the domain is not the primary brand but shares the brand's
 *    registered second-level token (e.g. `acme.dev` vs primary `acme.com`);
 *  - +0.20 per additional distinct author (up to +0.40) — multiple humans
 *    on the same domain is the strongest signal;
 *  - +0.10 if author names look like employees (first+last name pattern).
 *
 * @param {Array<{ name: string|null, email: string }>} authors
 * @param {string} primaryDomain - The known primary brand domain, e.g. "acme.com".
 * @returns {Array<{ domain: string, authors: number, confidence: number, evidence: string[] }>}
 */
export function pivotDomainsFromEmails(authors, primaryDomain) {
  const primary = String(primaryDomain || '').trim().toLowerCase().replace(/^\*\./, '');
  const primaryToken = primary.split('.').slice(0, -1).join('.');
  const byDomain = new Map();

  for (const a of authors || []) {
    const email = String(a?.email || '').toLowerCase().trim();
    const at = email.lastIndexOf('@');
    if (at < 0) continue;
    const domain = email.slice(at + 1);
    if (!domain || domain === primary || FREEMAIL.has(domain)) continue;
    if (!byDomain.has(domain)) byDomain.set(domain, { names: new Set(), evidence: [] });
    const entry = byDomain.get(domain);
    if (a?.name) entry.names.add(a.name);
    entry.evidence.push(email);
  }

  const results = [];
  for (const [domain, entry] of byDomain) {
    let score = 0.35;
    const token = domain.split('.').slice(0, -1).join('.');
    if (primaryToken && token && (token === primaryToken || token.includes(primaryToken) || primaryToken.includes(token))) {
      score += 0.25;
    }
    const extraAuthors = Math.max(0, entry.names.size - 1);
    score += Math.min(0.4, extraAuthors * 0.2);
    const realNameCount = [...entry.names].filter(n => /\w+\s+\w+/.test(n)).length;
    if (realNameCount > 0) score += 0.1;
    results.push({
      domain,
      authors: entry.names.size,
      confidence: Math.min(1, Math.round(score * 100) / 100),
      evidence: [...new Set(entry.evidence)].slice(0, 10),
    });
  }
  return results.sort((a, b) => b.confidence - a.confidence || b.authors - a.authors);
}
