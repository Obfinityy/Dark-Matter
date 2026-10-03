/**
 * takeoverPrescreenIntel.js — Takeover-candidate CNAME pre-screening and
 * dangling-SaaS CNAME catalog.
 *
 * Implements idea-bank items 00062–00063 as a complement (not a duplicate) of
 * takeoverChecker.js: that module verifies a single subdomain from CNAME +
 * HTTP evidence; this module maintains the SaaS CNAME fingerprint catalog and
 * scores whole batches of discovered subdomains so that ONLY high-confidence
 * candidates are queued for the (slower, noisier) takeover verification.
 *
 * All functions are pure: DNS resolution and HTTP fetching stay with the
 * caller, which passes {subdomain, cname} records and optional availability
 * signals into these functions.
 */

/**
 * Maintained catalog of SaaS CNAME-target patterns that are historically
 * associated with dangling (deprovisioned) records. Each entry carries the
 * target pattern, the service name, and a prior base-likelihood weight.
 */
export const SAAS_CNAME_CATALOG = [
  { pattern: /\.github\.io$/i, service: 'GitHub Pages', weight: 0.85 },
  { pattern: /\.herokudns\.com$/i, service: 'Heroku', weight: 0.8 },
  { pattern: /\.herokuapp\.com$/i, service: 'Heroku (legacy)', weight: 0.7 },
  { pattern: /\.s3\.amazonaws\.com$/i, service: 'AWS S3 website', weight: 0.9 },
  { pattern: /\.cloudfront\.net$/i, service: 'AWS CloudFront', weight: 0.5 },
  { pattern: /\.azurewebsites\.net$/i, service: 'Azure Web Apps', weight: 0.8 },
  { pattern: /\.myshopify\.com$/i, service: 'Shopify', weight: 0.8 },
  { pattern: /\.wordpress\.com$/i, service: 'WordPress.com', weight: 0.75 },
  { pattern: /\.domains\.tumblr\.com$/i, service: 'Tumblr', weight: 0.85 },
  { pattern: /\.surge\.sh$/i, service: 'Surge.sh', weight: 0.9 },
  { pattern: /\.bitbucket\.io$/i, service: 'Bitbucket Pages', weight: 0.7 },
  { pattern: /\.gitlab\.io$/i, service: 'GitLab Pages', weight: 0.6 },
  { pattern: /\.netlify\.app$/i, service: 'Netlify', weight: 0.55 },
  { pattern: /\.vercel\.app$/i, service: 'Vercel', weight: 0.45 },
  { pattern: /\.fastly\.net$/i, service: 'Fastly', weight: 0.4 },
  { pattern: /\.pantheonsite\.io$/i, service: 'Pantheon', weight: 0.7 },
  { pattern: /\.ghost\.io$/i, service: 'Ghost(Pro)', weight: 0.65 },
  { pattern: /\.zendesk\.com$/i, service: 'Zendesk', weight: 0.6 },
  { pattern: /\.freshdesk\.com$/i, service: 'Freshdesk', weight: 0.6 },
  { pattern: /\.intercom\.dns$/i, service: 'Intercom', weight: 0.6 },
  { pattern: /\.statuspage\.io$/i, service: 'Atlassian Statuspage', weight: 0.55 },
  { pattern: /\.help\.scout\.com$/i, service: 'Help Scout', weight: 0.6 },
  { pattern: /\.cargocollective\.com$/i, service: 'Cargo', weight: 0.85 },
  { pattern: /\.squarespace\.com$/i, service: 'Squarespace', weight: 0.5 },
  { pattern: /\.webflow\.io$/i, service: 'Webflow', weight: 0.5 },
  { pattern: /\.wixdns\.net$/i, service: 'Wix', weight: 0.5 },
  { pattern: /\.uservoice\.com$/i, service: 'UserVoice', weight: 0.75 },
  { pattern: /\.campaign\.monitor$/i, service: 'Campaign Monitor', weight: 0.6 },
  { pattern: /\.mailchimp\.com$/i, service: 'Mailchimp', weight: 0.55 },
  { pattern: /\.hubspotpagebuilder\.com$/i, service: 'HubSpot', weight: 0.5 },
];

/** Queue only candidates at or above this confidence. */
export const PRESREEN_QUEUE_THRESHOLD = 0.6;

/**
 * Match a CNAME target against the catalog.
 * @param {string} cname
 * @returns {{service: string, weight: number}[]}
 */
export function matchCatalog(cname) {
  const target = String(cname || '').replace(/\.+$/, '');
  return SAAS_CNAME_CATALOG
    .filter((entry) => entry.pattern.test(target))
    .map(({ service, weight }) => ({ service, weight }));
}

/**
 * Pre-screen a single {subdomain, cname} record.
 *
 * Confidence starts from the catalog weight and is adjusted with cheap,
 * non-intrusive availability signals the caller may supply:
 *  - cnameNxdomain: the CNAME target itself fails to resolve (strong signal)
 *  - aRecordExists: the subdomain still resolves to an A record (weakens it)
 *  - wildcardParent: the parent zone synthesizes wildcards (weakens it)
 *
 * @param {{subdomain: string, cname?: string, cnameNxdomain?: boolean, aRecordExists?: boolean, wildcardParent?: boolean}} record
 * @returns {{subdomain: string, cname: string, confidence: number, matches: {service: string, weight: number}[], queue: boolean, reasons: string[]}}
 */
export function prescreenCandidate(record) {
  const subdomain = String(record.subdomain || '').replace(/\.+$/, '');
  const cname = String(record.cname || '').replace(/\.+$/, '');
  const matches = matchCatalog(cname);
  const reasons = [];
  let confidence = matches.length ? Math.max(...matches.map((m) => m.weight)) : 0;
  if (matches.length) reasons.push(`CNAME matches ${matches.map((m) => m.service).join(', ')}`);
  if (record.cnameNxdomain && matches.length) {
    confidence = Math.min(0.99, confidence + 0.15);
    reasons.push('CNAME target does not resolve (NXDOMAIN)');
  }
  if (record.aRecordExists) {
    confidence *= 0.5;
    reasons.push('subdomain still resolves to an A record — likely alive');
  }
  if (record.wildcardParent) {
    confidence *= 0.6;
    reasons.push('parent zone synthesizes wildcards — record may be synthetic');
  }
  confidence = Math.round(confidence * 100) / 100;
  return {
    subdomain,
    cname,
    confidence,
    matches,
    queue: confidence >= PRESREEN_QUEUE_THRESHOLD,
    reasons,
  };
}

/**
 * Scan a batch of discovered {subdomain, cname} records, returning only the
 * high-confidence candidates in queue priority order. This is the batch
 * filter an enumeration pipeline calls before spending budget on full
 * takeover verification (idea 00062).
 * @param {{subdomain: string, cname?: string, cnameNxdomain?: boolean, aRecordExists?: boolean, wildcardParent?: boolean}[]} records
 * @returns {{queued: ReturnType<typeof prescreenCandidate>[], skipped: number}}
 */
export function queueTakeoverCandidates(records) {
  const screened = records.map(prescreenCandidate);
  const queued = screened
    .filter((s) => s.queue)
    .sort((a, b) => b.confidence - a.confidence);
  return { queued, skipped: screened.length - queued.length };
}

/**
 * Scan CNAME records against the catalog and report coverage: which SaaS
 * targets appear, how often, and which catalog services never matched
 * (useful to spot newly dangling services missing from the catalog — idea 00063).
 * @param {string[]} cnames
 * @returns {{hits: {service: string, count: number, examples: string[]}[], unmatched: string[], catalogCoverage: number}}
 */
export function catalogCoverage(cnames) {
  const hits = new Map();
  const unmatched = [];
  for (const raw of cnames) {
    const target = String(raw || '').replace(/\.+$/, '');
    if (!target) continue;
    const matches = matchCatalog(target);
    if (!matches.length) {
      if (!unmatched.includes(target)) unmatched.push(target);
      continue;
    }
    for (const m of matches) {
      if (!hits.has(m.service)) hits.set(m.service, { service: m.service, count: 0, examples: [] });
      const entry = hits.get(m.service);
      entry.count += 1;
      if (entry.examples.length < 3 && !entry.examples.includes(target)) entry.examples.push(target);
    }
  }
  const hitList = [...hits.values()].sort((a, b) => b.count - a.count);
  return {
    hits: hitList,
    unmatched,
    catalogCoverage: cnames.length ? Math.round((cnames.length - unmatched.length) / cnames.length * 1000) / 1000 : 0,
  };
}

export const TAKEOVER_PRESCREEN_INTEL = {
  SAAS_CNAME_CATALOG,
  matchCatalog,
  prescreenCandidate,
  queueTakeoverCandidates,
  catalogCoverage,
};
export default TAKEOVER_PRESCREEN_INTEL;
