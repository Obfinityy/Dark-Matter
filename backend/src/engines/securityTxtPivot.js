/**
 * securityTxtPivot.js — security.txt contact-host pivoting (RFC 9116).
 *
 * `/.well-known/security.txt` lists how to report vulnerabilities to a target:
 * Contact, Policy, Hiring, Encryption and Canonical fields frequently point at
 * security-team subdomains, ticketing portals and policy pages — hosts that
 * widen the authorized attack surface. This module parses the file into
 * structured fields and extracts every host for pivoting.
 *
 * All functions are pure: the caller fetches the file, this module parses it.
 */

/** Well-known locations of the security.txt file. */
export const CANDIDATE_PATHS = [
  '/.well-known/security.txt',
  '/security.txt',
];

/**
 * Build candidate file URLs for a target.
 * @param {string} baseUrl target origin, e.g. "https://example.com"
 * @returns {string[]} candidate file URLs
 */
export function candidateUrls(baseUrl = '') {
  const origin = String(baseUrl).replace(/\/+$/, '');
  if (!origin) return [];
  return CANDIDATE_PATHS.map((p) => `${origin}${p}`);
}

/**
 * Extract the hostname from a URL string.
 * @param {string} raw
 * @returns {string|null}
 */
function hostnameOf(raw) {
  try {
    return new URL(String(raw)).hostname || null;
  } catch {
    return null;
  }
}

/**
 * Parse a security.txt file into RFC 9116 fields.
 * @param {string} content raw file text
 * @param {{ sourceUrl?: string }} [opts]
 * @returns {{
 *   source: string|null,
 *   fields: Record<string, string[]>,
 *   contacts: Array<{ value: string, kind: 'email'|'url'|'phone'|'other', host: string|null }>,
 *   policyUrls: string[], encryptionUrls: string[], hiringUrls: string[],
 *   canonical: string[], hosts: string[], expired: boolean|null, parseErrors: string[]
 * }}
 */
export function analyzeSecurityTxt(content, opts = {}) {
  const source = opts.sourceUrl || null;
  const fields = {};
  const text = String(content || '');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf(':');
    if (idx < 1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (!value) continue;
    if (!fields[key]) fields[key] = [];
    fields[key].push(value);
  }

  const hosts = new Set();
  const track = (url) => {
    const host = hostnameOf(url);
    if (host) hosts.add(host.toLowerCase());
  };

  const classifyContact = (value) => {
    if (/^mailto:/i.test(value)) return { kind: 'email', host: value.replace(/^mailto:/i, '').split('@')[1]?.toLowerCase() || null };
    if (/^https?:\/\//i.test(value)) return { kind: 'url', host: hostnameOf(value)?.toLowerCase() || null };
    if (/^tel:/i.test(value)) return { kind: 'phone', host: null };
    return { kind: 'other', host: null };
  };

  const contacts = (fields.contact || []).map((value) => {
    const { kind, host } = classifyContact(value);
    if (host) hosts.add(host);
    return { value, kind, host };
  });

  const policyUrls = fields.policy || [];
  const encryptionUrls = fields.encryption || [];
  const hiringUrls = fields.hiring || [];
  const canonical = fields.canonical || [];
  for (const u of [...policyUrls, ...encryptionUrls, ...hiringUrls, ...canonical]) track(u);
  for (const u of fields['acknowledgments'] || []) track(u);

  let expired = null;
  if (fields.expires && fields.expires[0]) {
    const exp = Date.parse(fields.expires[0]);
    expired = Number.isNaN(exp) ? null : exp < Date.now();
  }

  const parseErrors = [];
  if (!(fields.contact || []).length) parseErrors.push('Missing required Contact field');
  if (!(fields.expires || []).length) parseErrors.push('Missing Expires field');

  return {
    source, fields, contacts, policyUrls, encryptionUrls, hiringUrls, canonical,
    hosts: [...hosts], expired, parseErrors,
  };
}

/**
 * Rank pivoted hosts by likely value for a hunt.
 * Security-team subdomains and portals rank highest.
 * @param {ReturnType<typeof analyzeSecurityTxt>} analysis
 * @returns {Array<{ host: string, score: number, reason: string }>}
 */
export function rankPivotHosts(analysis) {
  return (analysis.hosts || []).map((host) => {
    let score = 30;
    let reason = 'referenced by security.txt';
    if (/security|vuln|psirt|bugcrowd|hackerone|synack|yeswehack/i.test(host)) {
      score = 90;
      reason = 'security-team or bug-bounty platform host';
    } else if (/jira|zendesk|servicenow|freshdesk|support|ticket/i.test(host)) {
      score = 70;
      reason = 'support/ticketing host';
    } else if (/policy|legal|trust/i.test(host)) {
      score = 50;
      reason = 'policy/trust host';
    }
    return { host, score, reason };
  }).sort((a, b) => b.score - a.score);
}
