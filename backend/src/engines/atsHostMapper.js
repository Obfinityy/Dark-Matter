/**
 * atsHostMapper.js — Careers-page ATS host mapping engine.
 *
 * @idea 00293
 * Covers idea-bank item 00293:
 *  - 00293 Careers-page ATS host mapping — map applicant-tracking hosts
 *    (Greenhouse, Lever, Workable) via careers-page CNAMEs.
 *
 * Pure functions only: the caller resolves DNS records and fetches the
 * careers page HTML; both are passed in. No live HTTP or DNS here.
 */

const ATS_FINGERPRINTS = [
  {
    provider: 'greenhouse',
    cnameRe: /(^|\.)boards\.greenhouse\.io$/i,
    hostRe: /(^|\.)boards\.greenhouse\.io$/i,
    note: 'Greenhouse job-board hosting — board token enumerates the org',
  },
  {
    provider: 'lever',
    cnameRe: /(^|\.)lever\.co$/i,
    hostRe: /(^|\.)jobs\.lever\.co$/i,
    note: 'Lever-hosted careers site — postings API exposes org hosts',
  },
  {
    provider: 'workable',
    cnameRe: /(^|\.)workable\.com$/i,
    hostRe: /(^|\.)workable\.com$/i,
    note: 'Workable-hosted careers portal',
  },
  {
    provider: 'ashby',
    cnameRe: /(^|\.)ashbyhq\.com$/i,
    hostRe: /(^|\.)jobs\.ashbyhq\.com$/i,
    note: 'Ashby-hosted careers site',
  },
  {
    provider: 'smartrecruiters',
    cnameRe: /(^|\.)smartrecruiters\.com$/i,
    hostRe: /(^|\.)jobs\.smartrecruiters\.com$/i,
    note: 'SmartRecruiters-hosted careers site',
  },
  {
    provider: 'workday',
    cnameRe: /(^|\.)myworkdayjobs\.com$/i,
    hostRe: /(^|\.)myworkdayjobs\.com$/i,
    note: 'Workday-hosted careers portal',
  },
  {
    provider: 'icims',
    cnameRe: /(^|\.)icims\.com$/i,
    hostRe: /(^|\.)icims\.com$/i,
    note: 'iCIMS talent platform hosting',
  },
  {
    provider: 'taleo',
    cnameRe: /(^|\.)taleo\.net$/i,
    hostRe: /(^|\.)taleo\.net$/i,
    note: 'Oracle Taleo-hosted careers portal',
  },
  {
    provider: 'breezy',
    cnameRe: /(^|\.)breezy\.hr$/i,
    hostRe: /(^|\.)breezy\.hr$/i,
    note: 'Breezy HR-hosted careers site',
  },
  {
    provider: 'jazzhr',
    cnameRe: /(^|\.)applytojob\.com$/i,
    hostRe: /(^|\.)applytojob\.com$/i,
    note: 'JazzHR-hosted application portal',
  },
];

/**
 * Normalize a hostname: lowercase, strip trailing dot, scheme, port.
 * @param {string} host
 * @returns {string}
 */
export function normalizeHost(host) {
  return String(host || '')
    .trim()
    .toLowerCase()
    .replace(/^\w+:\/\//, '')
    .replace(/:\d+$/, '')
    .replace(/\.$/, '');
}

/**
 * Fingerprint an ATS provider from a CNAME target or careers hostname.
 * @param {string} host CNAME value or careers hostname
 * @returns {{provider: string, note: string} | null}
 */
export function fingerprintAtsHost(host) {
  const h = normalizeHost(host);
  if (!h) return null;
  for (const fp of ATS_FINGERPRINTS) {
    if (fp.cnameRe.test(h) || fp.hostRe.test(h)) {
      return { provider: fp.provider, note: fp.note };
    }
  }
  return null;
}

/**
 * Map applicant-tracking hosts from DNS records for careers subdomains.
 * The caller supplies records shaped {query, type, value}.
 *
 * @param {{query: string, type: string, value: string}[]} records DNS records
 * @returns {{
 *   careersHost: string, atsHost: string, provider: string,
 *   note: string, recordType: string
 * }[]}
 */
export function mapAtsHostsFromDns(records = []) {
  const results = [];
  const seen = new Set();

  for (const rec of records || []) {
    if (!/^(cname|a|aaaa)$/i.test(String(rec?.type || ''))) continue;
    const value = normalizeHost(rec?.value || '');
    const fp = fingerprintAtsHost(value);
    if (!fp) continue;
    const careersHost = normalizeHost(rec?.query || '');
    const key = `${careersHost}|${fp.provider}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({
      careersHost,
      atsHost: value,
      provider: fp.provider,
      note: fp.note,
      recordType: String(rec?.type || '').toUpperCase(),
    });
  }

  return results.sort((a, b) => a.provider.localeCompare(b.provider) || a.careersHost.localeCompare(b.careersHost));
}

/**
 * Scan careers-page HTML for embedded ATS links, iframes and apply buttons.
 * @param {string} html careers page HTML
 * @returns {{provider: string, host: string, note: string, context: string}[]}
 */
export function scanCareersPageHtml(html = '') {
  const text = String(html || '');
  const results = [];
  const seen = new Set();

  const attrRe = /(?:href|src|data-[a-z-]*url|action)\s*=\s*["']([^"']+)["']/gi;
  for (const m of text.matchAll(attrRe)) {
    let host = '';
    try {
      const u = new URL(m[1].startsWith('//') ? `https:${m[1]}` : m[1]);
      host = normalizeHost(u.hostname);
    } catch { continue; }
    const fp = fingerprintAtsHost(host);
    if (!fp) continue;
    const key = `${fp.provider}|${host}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({
      provider: fp.provider,
      host,
      note: fp.note,
      context: m[1].slice(0, 160),
    });
  }

  return results.sort((a, b) => a.provider.localeCompare(b.provider) || a.host.localeCompare(b.host));
}

/**
 * Score ATS findings: hosted careers pages inherit the provider's security
 * posture — token/API exposure on those hosts is in-scope third-party risk.
 * @param {{provider: string, careersHost?: string, host?: string}[]} findings
 * @returns {{host: string, provider: string, score: number, reason: string}[]}
 */
export function scoreAtsFindings(findings = []) {
  return (findings || []).map((f) => {
    const host = f.careersHost || f.host || '';
    let score = 50;
    let reason = `${f.provider} ATS host linked to the target's hiring surface — enumerate job-board tokens and API exposure`;
    if (f.provider === 'greenhouse' || f.provider === 'lever') {
      score = 70;
      reason += '; public postings APIs can leak internal team and infra references';
    }
    return { host, provider: f.provider, score, reason };
  }).sort((a, b) => b.score - a.score || a.host.localeCompare(b.host));
}
