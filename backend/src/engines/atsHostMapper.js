/**
 * atsHostMapper.js — Careers-page ATS host mapping.
 *
 * Applicant-tracking systems (Greenhouse, Lever, Workable, Ashby,
 * SmartRecruiters) run on vendor infrastructure under the target's brand.
 * Careers pages usually link or CNAME to them, e.g.
 * jobs.acme.com → boards.greenhouse.io/acme.
 *
 * Passive analysis: parse careers-page HTML for links/iframes/embeds that
 * point at known ATS providers and map them to the target's own hosts.
 * Vendor security posture is out of scope here; this is host discovery.
 */

/** Known ATS providers and how to recognise them in URLs. */
const ATS_PROVIDERS = [
  {
    name: 'Greenhouse',
    hostMatch: /(^|\.)boards\.greenhouse\.io$/,
    idFrom: /boards\.greenhouse\.io\/([a-z0-9_-]+)/i,
  },
  { name: 'Lever', hostMatch: /(^|\.)lever\.co$/, idFrom: /([a-z0-9_-]+)\.lever\.co/i },
  { name: 'Workable', hostMatch: /(^|\.)workable\.com$/, idFrom: /([a-z0-9_-]+)\.workable\.com/i },
  { name: 'Ashby', hostMatch: /(^|\.)ashbyhq\.com$/, idFrom: /jobs\.ashbyhq\.com\/([a-z0-9_-]+)/i },
  {
    name: 'SmartRecruiters',
    hostMatch: /(^|\.)smartrecruiters\.com$/,
    idFrom: /careers\.smartrecruiters\.com\/([a-z0-9_-]+)/i,
  },
  { name: 'Breezy', hostMatch: /(^|\.)breezy\.hr$/, idFrom: /([a-z0-9_-]+)\.breezy\.hr/i },
  {
    name: 'Recruitee',
    hostMatch: /(^|\.)recruitee\.com$/,
    idFrom: /([a-z0-9_-]+)\.recruitee\.com/i,
  },
  { name: 'JazzHR', hostMatch: /(^|\.)jazzhr\.com$/, idFrom: /([a-z0-9_-]+)\.jazzhr\.com/i },
  { name: 'Taleo', hostMatch: /(^|\.)taleo\.net$/, idFrom: /([a-z0-9_-]+)\.taleo\.net/i },
  { name: 'iCIMS', hostMatch: /(^|\.)icims\.com$/, idFrom: /([a-z0-9_-]+)\.icims\.com/i },
];

const LINK_ATTRS = /(?:href|src|data-src|data-url|action)=["']([^"']+)["']/gi;
const CAREERS_PATH_HINTS = /(career|job|hiring|talent|recruit|join-?us|work-?with-?us|openings)/i;

/**
 * Identify which ATS provider (if any) serves a given URL/hostname.
 * @param {string} urlOrHost URL or hostname
 * @returns {{provider: string, orgId: string|null}|null}
 */
export function identifyAtsProvider(urlOrHost) {
  const raw = String(urlOrHost || '').trim();
  if (!raw) return null;
  let host = raw;
  try {
    host = new URL(raw.startsWith('http') ? raw : `https://${raw}`).hostname.toLowerCase();
  } catch {
    host = raw.toLowerCase();
  }
  for (const p of ATS_PROVIDERS) {
    if (p.hostMatch.test(host)) {
      const m = raw.match(p.idFrom);
      return { provider: p.name, orgId: m ? m[1] : null };
    }
  }
  return null;
}

/**
 * Scan careers-page HTML for ATS links, iframes and embeds.
 * @param {string} html careers-page HTML
 * @param {string} [pageUrl] page the HTML came from (for evidence)
 * @returns {object[]} findings: {provider, url, host, orgId, context, evidence}
 */
export function mapAtsHosts(html, pageUrl = '') {
  const body = String(html || '');
  const seen = new Set();
  const findings = [];
  const evidence = pageUrl || '(inline)';

  LINK_ATTRS.lastIndex = 0;
  let m;
  while ((m = LINK_ATTRS.exec(body)) !== null) {
    const link = m[1];
    if (!/^https?:\/\//i.test(link)) continue;
    let host;
    try {
      host = new URL(link).hostname.toLowerCase();
    } catch {
      continue;
    }
    const ats = identifyAtsProvider(link);
    if (!ats) continue;
    const key = `${ats.provider}:${host}:${link}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    // Grab a small surrounding snippet as evidence context.
    const idx = Math.max(0, m.index - 120);
    const context = body
      .slice(idx, m.index + m[0].length + 40)
      .replace(/\s+/g, ' ')
      .trim();
    findings.push({
      provider: ats.provider,
      url: link,
      host,
      orgId: ats.orgId,
      context,
      evidence,
    });
  }
  return findings;
}

/**
 * Heuristic: does the page look like a careers page at all?
 * @param {string} url page URL
 * @param {string} [html] optional page HTML/title to strengthen the signal
 * @returns {boolean}
 */
export function isCareersPage(url, html = '') {
  if (CAREERS_PATH_HINTS.test(String(url || ''))) return true;
  const title = String(html || '').match(/<title[^>]*>([^<]*)<\/title>/i);
  return !!(title && CAREERS_PATH_HINTS.test(title[1]));
}

export const ATS_HOST_MAPPER = {
  ATS_PROVIDERS: ATS_PROVIDERS.map(p => p.name),
  identifyAtsProvider,
  mapAtsHosts,
  isCareersPage,
};

export default ATS_HOST_MAPPER;
