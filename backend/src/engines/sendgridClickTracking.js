/**
 * sendgridClickTracking.js — SendGrid click-tracking host discovery engine.
 *
 * Identifies SendGrid click-tracking subdomains (e.g. url1234.acme.com CNAME
 * sendgrid.net) from:
 *  - Raw email headers: Return-Path bounce hosts, DKIM d=/s= selectors,
 *    Received hops, X-SMTPAPI leftovers, tracking pixel / link hosts.
 *  - DNS CNAME records pointing at SendGrid's click-tracking infrastructure.
 *
 * All parsing is passive: inputs are already-collected headers and DNS
 * records. Findings help an authorized hunter map the org's email
 * infrastructure and confirm branding consistency for phishing-risk reviews.
 */

const SENDGRID_TRACKING_CNAME_TARGETS = [
  /(^|\.)sendgrid\.net$/i,
  /(^|\.)sendgridv3\.com$/i,
  /(^|\.)ct\.sendgrid\.com$/i,
  /(^|\.)em[0-9]+\.[a-z0-9-]+\.com$/i, // emXXXX.sendgrid style bounce pools
];

const SENDGRID_LINK_HOST_HINTS = [
  /\burl\d{1,6}\.[a-z0-9.-]+\.[a-z]{2,}\b/gi, // url1234.domain.tld click hosts
];

const HEADER_FIELDS = [
  'return-path',
  'received',
  'dkim-signature',
  'list-unsubscribe',
  'x-smtpapi',
  'message-id',
  'from',
  'reply-to',
];

/**
 * Extract every hostname from a block of raw email headers.
 * @param {string} rawHeaders full raw header block
 * @returns {string[]} unique lower-cased hostnames found
 */
export function extractHeaderHostnames(rawHeaders = '') {
  const text = String(rawHeaders || '');
  const hosts = new Set();
  const re = /\b([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+)\b/gi;
  let m;
  while ((m = re.exec(text)) !== null) hosts.add(m[1].toLowerCase());
  return [...hosts];
}

/**
 * Keep only hostnames that look like SendGrid click-tracking hosts.
 * @param {string[]} hostnames candidate hostnames
 * @param {string} [orgDomain] org domain to prefer branded hosts under
 * @returns {{host: string, branded: boolean}[]}
 */
export function filterSendgridTrackingHosts(hostnames = [], orgDomain = '') {
  const branded = orgDomain ? String(orgDomain).toLowerCase().replace(/^\./, '') : '';
  const out = [];
  for (const h of hostnames || []) {
    const host = String(h).toLowerCase();
    const isBranded = Boolean(branded) && (host === branded || host.endsWith(`.${branded}`));
    const looksSendgrid = /^(url|click|track|trk|email|mail|bounce|em)\d*/i.test(host) ||
      /(sendgrid)/i.test(host);
    if (looksSendgrid || isBranded) out.push({ host, branded: isBranded });
  }
  return out;
}

/**
 * Inspect DNS CNAME records for click-tracking delegations to SendGrid.
 * @param {{name: string, target: string}[]} cnameRecords list of {name, target}
 * @returns {{subdomain: string, target: string, provider: string}[]} matches
 */
export function findSendgridCnames(cnameRecords = []) {
  const findings = [];
  for (const rec of cnameRecords || []) {
    if (!rec || !rec.name || !rec.target) continue;
    const target = String(rec.target).toLowerCase().replace(/\.$/, '');
    if (SENDGRID_TRACKING_CNAME_TARGETS.some((re) => re.test(target))) {
      findings.push({
        subdomain: String(rec.name).toLowerCase().replace(/\.$/, ''),
        target,
        provider: 'SendGrid',
      });
    }
  }
  return findings;
}

/**
 * Parse raw email headers for DKIM selector/domain pairs tied to SendGrid.
 * @param {string} rawHeaders raw header block
 * @returns {{selector: string, domain: string}[]} dkim identities
 */
export function extractDkimIdentities(rawHeaders = '') {
  const text = String(rawHeaders || '');
  const out = [];
  // Match each DKIM-Signature header as one logical line (may be folded across lines).
  const lineRe = /^DKIM-Signature:([^\n]*(?:\n[ \t][^\n]*)*)/gim;
  let lm;
  while ((lm = lineRe.exec(text)) !== null) {
    const folded = lm[1].replace(/\r?\n[ \t]+/g, ' ');
    const s = folded.match(/\bs=([a-z0-9_.-]+)/i);
    const d = folded.match(/\bd=([a-z0-9.-]+\.[a-z]{2,})/i);
    if (s && d) out.push({ selector: s[1].toLowerCase(), domain: d[1].toLowerCase() });
  }
  return out;
}

/**
 * Full analysis: headers + CNAME records -> click-tracking host findings.
 * @param {{headers: string, cnames: {name:string,target:string}[], orgDomain?: string}} input
 * @returns {{trackingHosts: object[], dkim: object[], evidence: string[]}}
 */
export function analyzeSendgridFootprint({ headers = '', cnames = [], orgDomain = '' } = {}) {
  const allHosts = extractHeaderHostnames(headers);
  const trackingHosts = filterSendgridTrackingHosts(allHosts, orgDomain);
  const cnameHits = findSendgridCnames(cnames);
  const dkim = extractDkimIdentities(headers);
  const evidence = [];
  if (trackingHosts.length) evidence.push(`Found ${trackingHosts.length} tracking-like host(s) in email headers.`);
  if (cnameHits.length) evidence.push(`Found ${cnameHits.length} CNAME(s) delegated to SendGrid.`);
  if (dkim.length) evidence.push(`Found ${dkim.length} DKIM signing identit(ies).`);
  return { trackingHosts, dkim, evidence, cnameHits };
}
