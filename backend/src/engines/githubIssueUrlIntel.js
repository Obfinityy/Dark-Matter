/**
 * githubIssueUrlIntel.js — GitHub issue-attachment URL mining (idea 00220).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent.
 * Issue and PR comments are full of markdown image/file links:
 * screenshots on `user-images.githubusercontent.com`, uploads on
 * `github.com/user-attachments`, plus external hosts (pastebins, staging
 * URLs, internal dashboards) that reporters paste alongside bug reports.
 * Mining those hostnames surfaces auxiliary infrastructure — staging
 * environments, internal tools, and file hosts tied to the target.
 *
 * No network calls are made here — the caller supplies already-fetched
 * comment text (from the Issues/Timeline APIs).
 */

const GITHUB_ASSET_HOSTS = new Set([
  'user-images.githubusercontent.com',
  'private-user-images.githubusercontent.com',
  'github.com',
  'raw.githubusercontent.com',
  'gist.github.com',
  'avatars.githubusercontent.com',
  'objects.githubusercontent.com',
  'media.githubusercontent.com',
  'camo.githubusercontent.com',
]);

/**
 * Extract all URLs from markdown text.
 *
 * Handles inline links `[text](url)`, reference links `[text][id]` with
 * `[id]: url` definitions, bare autolinks `<https://...>`, and plain
 * bare URLs in prose.
 *
 * @param {string} markdown
 * @returns {Array<{ url: string, kind: 'inline-link'|'image'|'reference'|'autolink'|'bare' }>}
 */
export function extractUrlsFromMarkdown(markdown) {
  const text = String(markdown || '');
  const found = [];
  const seen = new Set();
  const push = (url, kind) => {
    const clean = url.trim().replace(/[.,;)\]}>]+$/, '');
    if (!/^https?:\/\//i.test(clean) || seen.has(clean)) return;
    seen.add(clean);
    found.push({ url: clean, kind });
  };

  // Reference definitions: [id]: https://...
  const refs = new Map();
  const refDefRe = /^\s*\[([^\]]+)\]:\s*(https?:\/\/\S+)/gim;
  let m;
  while ((m = refDefRe.exec(text)) !== null) refs.set(m[1].toLowerCase(), m[2]);

  // Inline links and images: [text](url) / ![alt](url)
  const inlineRe = /(!?)\[[^\]]*\]\((https?:\/\/[^)\s]+)(?:\s+"[^"]*")?\)/g;
  while ((m = inlineRe.exec(text)) !== null) push(m[2], m[1] ? 'image' : 'inline-link');

  // Reference usages: [text][id] and shortcut [id]
  const refUseRe = /\[([^\]]+)\](?:\[([^\]]*)\])?/g;
  while ((m = refUseRe.exec(text)) !== null) {
    const id = (m[2] || m[1]).toLowerCase();
    if (refs.has(id)) push(refs.get(id), 'reference');
  }

  // Autolinks: <https://...>
  const autoRe = /<(https?:\/\/[^>\s]+)>/g;
  while ((m = autoRe.exec(text)) !== null) push(m[1], 'autolink');

  // Bare URLs in prose.
  const bareRe = /(?<![(\["'=])(https?:\/\/[^\s"'<>\])]+)/gi;
  while ((m = bareRe.exec(text)) !== null) push(m[1], 'bare');

  return found;
}

/**
 * Mine hostnames from issue/PR comment markdown.
 *
 * @param {Array<{ id?: string|number, body: string }>|string} comments - Comment
 *   objects (or a single markdown string).
 * @param {Object} [options]
 * @param {boolean} [options.includeGithubAssets=true] - Keep GitHub's own
 *   asset hosts in the output (useful for attachment inventory); set false
 *   to focus on external infrastructure.
 * @returns {{
 *   hosts: Array<{ host: string, count: number, kinds: string[], sampleUrls: string[], isGithubAsset: boolean }>,
 *   totalUrls: number,
 *   totalComments: number
 * }}
 */
export function mineIssueUrls(comments, options = {}) {
  const includeGithubAssets = options.includeGithubAssets !== false;
  const list =
    typeof comments === 'string' ? [{ body: comments }] : Array.isArray(comments) ? comments : [];
  const hostMap = new Map();
  let totalUrls = 0;

  for (const c of list) {
    const urls = extractUrlsFromMarkdown(c?.body);
    totalUrls += urls.length;
    for (const { url, kind } of urls) {
      let host;
      try {
        host = new URL(url).hostname.toLowerCase();
      } catch {
        continue;
      }
      const isGithubAsset = GITHUB_ASSET_HOSTS.has(host);
      if (isGithubAsset && !includeGithubAssets) continue;
      if (!hostMap.has(host)) {
        hostMap.set(host, { host, count: 0, kinds: new Set(), sampleUrls: [], isGithubAsset });
      }
      const entry = hostMap.get(host);
      entry.count += 1;
      entry.kinds.add(kind);
      if (entry.sampleUrls.length < 3) entry.sampleUrls.push(url);
    }
  }

  const hosts = [...hostMap.values()]
    .map(h => ({ ...h, kinds: [...h.kinds] }))
    .sort((a, b) => b.count - a.count || a.host.localeCompare(b.host));

  return { hosts, totalUrls, totalComments: list.length };
}

/**
 * Summarize mined hosts into infrastructure classes for quick triage.
 *
 * @param {Array<{ host: string, count: number, isGithubAsset: boolean }>} hosts
 * @param {string} [targetDomain] - Scope domain to flag in-scope hits.
 * @returns {Array<{ host: string, count: number, classification: string }>}
 */
export function classifyMinedHosts(hosts, targetDomain = '') {
  const scope = String(targetDomain || '')
    .trim()
    .toLowerCase();
  return (hosts || []).map(h => {
    const host = h.host;
    let classification = 'external';
    if (h.isGithubAsset) classification = 'github-asset';
    else if (scope && (host === scope || host.endsWith(`.${scope}`))) classification = 'in-scope';
    else if (/(staging|stage|dev|test|qa|uat|demo|sandbox|internal|corp|intranet)/i.test(host))
      classification = 'staging-like';
    else if (/(pastebin|pastie|gist|transfer\.sh|file\.io|0x0\.st)/i.test(host))
      classification = 'pastebin-filehost';
    else if (/(imgur|cloudinary|s3\.|blob\.core|storage\.googleapis)/i.test(host))
      classification = 'image-cdn';
    return { host, count: h.count, classification };
  });
}
