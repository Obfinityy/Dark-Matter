/**
 * githubPagesCnameIntel.js — GitHub Pages CNAME file mining (idea 00217).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent.
 * Repositories that publish via GitHub Pages with a custom domain carry a
 * top-level `CNAME` file containing exactly one hostname. Collecting those
 * files across an organization's repos maps GitHub Pages sites to custom
 * target subdomains — including stale CNAMEs that point at decommissioned
 * hosts (a classic subdomain-takeover reconnaissance signal).
 *
 * No network calls are made here — the caller supplies CNAME file contents
 * (from `GET /repos/{owner}/{repo}/contents/CNAME` or a repo inventory).
 */

const DNS_LABEL_RE =
  /^(?=.{1,253}$)(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))*$/;

/**
 * Validate that a hostname is syntactically a legal DNS name.
 *
 * Enforces RFC 1035/1123 label rules: labels of 1–63 chars, letters/digits/
 * hyphens, no leading or trailing hyphens, total length ≤ 253.
 *
 * @param {string} host
 * @returns {boolean}
 */
export function isValidDnsHostname(host) {
  return DNS_LABEL_RE.test(
    String(host || '')
      .trim()
      .toLowerCase()
  );
}

/**
 * Parse a single CNAME file's contents into a normalized hostname.
 *
 * A valid CNAME file contains exactly one hostname (trailing whitespace and
 * a single trailing dot are tolerated). Returns null when the content does
 * not look like a CNAME file.
 *
 * @param {string} content - Raw CNAME file text.
 * @returns {{ host: string }|null}
 */
export function parseCnameFile(content) {
  const lines = String(content || '')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);
  if (lines.length !== 1) return null;
  let host = lines[0].replace(/\.$/, '').toLowerCase();
  // Reject URL-shaped or whitespace-containing values — not a bare hostname.
  if (/\s|\//.test(host)) return null;
  if (!isValidDnsHostname(host)) return null;
  return { host };
}

/**
 * Mine CNAME files across many repos into a subdomain map.
 *
 * @param {Array<{ repo: string, path?: string, content: string }>} cnameFiles
 * @param {string} targetDomain - Scope results to this domain, e.g. "example.com".
 * @returns {{
 *   mappings: Array<{ host: string, repo: string, inScope: boolean }>,
 *   inScopeHosts: string[],
 *   outOfScopeHosts: Array<{ host: string, repo: string }>,
 *   invalid: Array<{ repo: string, reason: string }>
 * }}
 */
export function mineCnameFiles(cnameFiles, targetDomain) {
  const scope = String(targetDomain || '')
    .trim()
    .toLowerCase()
    .replace(/^\*\./, '');
  const mappings = [];
  const invalid = [];

  for (const f of cnameFiles || []) {
    const repo = String(f?.repo || 'unknown');
    const parsed = parseCnameFile(f?.content);
    if (!parsed) {
      invalid.push({ repo, reason: 'content is not a single valid hostname' });
      continue;
    }
    const inScope = !!scope && (parsed.host === scope || parsed.host.endsWith(`.${scope}`));
    mappings.push({ host: parsed.host, repo, inScope });
  }

  return {
    mappings,
    inScopeHosts: [...new Set(mappings.filter(x => x.inScope).map(x => x.host))].sort(),
    outOfScopeHosts: mappings.filter(x => !x.inScope).map(x => ({ host: x.host, repo: x.repo })),
    invalid,
  };
}

/**
 * Flag CNAME targets that look stale — apex or deep subdomains that no
 * longer resolve to GitHub Pages infrastructure are takeover candidates.
 * This helper only classifies the hostname shape; DNS resolution is done by
 * the caller and passed in.
 *
 * @param {Array<{ host: string, repo: string }>} mappings - In-scope mappings.
 * @param {Object<string, string[]>} dnsAnswers - host -> array of CNAME/A answers (lowercased).
 * @returns {Array<{ host: string, repo: string, signal: string, detail: string }>}
 */
export function flagStaleCnameTargets(mappings, dnsAnswers = {}) {
  const findings = [];
  for (const { host, repo } of mappings || []) {
    const answers = (dnsAnswers[host] || []).map(a => String(a).toLowerCase());
    const pointsAtPages = answers.some(a => a.endsWith('.github.io') || a.endsWith('.github.io.'));
    if (answers.length === 0) {
      findings.push({
        host,
        repo,
        signal: 'cname-target-nxdomain',
        detail: `CNAME host '${host}' has no DNS answers — a dangling Pages custom domain is a subdomain-takeover candidate. Verify with the asset owner before any further testing.`,
      });
    } else if (!pointsAtPages) {
      findings.push({
        host,
        repo,
        signal: 'cname-not-pointing-at-pages',
        detail: `CNAME host '${host}' no longer resolves to GitHub Pages infrastructure (answers: ${answers.join(', ')}). If the Pages site was removed, the domain may be claimable elsewhere.`,
      });
    }
  }
  return findings;
}
