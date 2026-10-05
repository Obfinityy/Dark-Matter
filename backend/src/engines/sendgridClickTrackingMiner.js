/**
 * sendgridClickTrackingMiner.js — SendGrid click-tracking host discovery engine.
 *
 * @idea 00281 — SendGrid click-tracking host discovery — identify SendGrid
 *   click-tracking subdomains from email headers and DNS.
 *
 * Orgs often CNAME a branded subdomain (e.g. click.example.com) to SendGrid
 * for click/open tracking. Finding those CNAMEs maps branded sending
 * infrastructure back to the provider, which is useful in authorized
 * infrastructure reviews.
 *
 * Pure functions only: callers fetch DNS records and email headers
 * themselves and pass the raw values in. No live network calls here.
 */

const SENDGRID_HOST_PATTERNS = [
  /\.sendgrid\.net$/i,
  /^sendgrid/i,
  /sg-?tracking/i,
];

const CLICK_TRACKING_HEADER_HINTS = [
  'x-sg-eid', // SendGrid event ID
  'x-sg-id',
];

/**
 * Normalize a hostname: lowercase, strip scheme, port, trailing dot.
 * @param {string} host
 * @returns {string}
 */
export function normalizeHostname(host) {
  if (!host) return '';
  return String(host)
    .trim()
    .toLowerCase()
    .replace(/^\w+:\/\//, '')
    .replace(/^[^@\s]+@/, '')
    .replace(/:\d+$/, '')
    .replace(/\.$/, '');
}

/**
 * Decide whether a DNS target hostname looks like SendGrid infrastructure.
 * @param {string} target
 * @returns {{isSendgrid: boolean, host: string, reason: string}}
 */
export function isSendgridHost(target) {
  const host = normalizeHostname(target);
  for (const re of SENDGRID_HOST_PATTERNS) {
    if (re.test(host)) {
      return { isSendgrid: true, host, reason: `target matches SendGrid pattern ${re}` };
    }
  }
  return { isSendgrid: false, host, reason: '' };
}

/**
 * Extract candidate click-tracking URLs from an email body (HTML or text).
 * Looks for rewritten links whose host differs from the visible anchor —
 * a hallmark of link-tracking rewrites.
 * @param {string} body raw email body (HTML or plain text)
 * @returns {string[]} unique hostnames found inside href attributes and bare URLs
 */
export function extractLinkHostsFromEmailBody(body) {
  if (!body) return [];
  const text = String(body);
  const hosts = new Set();
  const hrefRe = /href\s*=\s*["']https?:\/\/([^"'\s/>]+)/gi;
  const bareRe = /https?:\/\/([a-z0-9][a-z0-9.-]*[a-z0-9])/gi;
  let m;
  while ((m = hrefRe.exec(text)) !== null) hosts.add(normalizeHostname(m[1]));
  while ((m = bareRe.exec(text)) !== null) hosts.add(normalizeHostname(m[1]));
  return [...hosts].filter(Boolean);
}

/**
 * Scan email headers for SendGrid fingerprints.
 * @param {{name: string, value: string}[]} headers parsed email headers
 * @returns {{sendgridDetected: boolean, signals: string[]}}
 */
export function detectSendgridFromHeaders(headers) {
  const signals = [];
  for (const h of headers || []) {
    const name = String(h.name || '').toLowerCase();
    const value = String(h.value || '');
    if (CLICK_TRACKING_HEADER_HINTS.includes(name)) {
      signals.push(`header ${name} present`);
    }
    if (name === 'received' && /sendgrid\.net/i.test(value)) {
      signals.push('Received chain mentions sendgrid.net');
    }
    if (name === 'dkim-signature' && /d=sendgrid\.net|s=\w*sendgrid/i.test(value)) {
      signals.push('DKIM signature references sendgrid.net');
    }
    if (name === 'x-feedback-id' && /sendgrid/i.test(value)) {
      signals.push('x-feedback-id references SendGrid');
    }
  }
  return { sendgridDetected: signals.length > 0, signals };
}

/**
 * Mine DNS records for branded subdomains CNAME'd to SendGrid infrastructure.
 * @param {{query: string, type: string, value: string}[]} records DNS records
 *   already fetched by the caller (CNAME and TXT)
 * @returns {{query: string, target: string, recordType: string, confidence: string}[]}
 *   candidate click-tracking hosts
 */
export function mineSendgridClickTrackingHosts(records) {
  const findings = [];
  for (const r of records || []) {
    if (!r || !r.value) continue;
    const type = String(r.type || '').toUpperCase();
    if (type !== 'CNAME') continue;
    const verdict = isSendgridHost(r.value);
    if (verdict.isSendgrid) {
      findings.push({
        query: normalizeHostname(r.query),
        target: verdict.host,
        recordType: type,
        confidence: 'high',
      });
    }
  }
  return findings;
}

/**
 * Correlate email-derived link hosts with DNS findings: any host appearing
 * in a SendGrid-flavoured email that CNAMEs to SendGrid infrastructure is a
 * confirmed click-tracking host.
 * @param {string} emailBody raw email body
 * @param {{name: string, value: string}[]} emailHeaders parsed email headers
 * @param {{query: string, type: string, value: string}[]} dnsRecords DNS records
 * @returns {{
 *   sendgridConfirmed: boolean,
 *   clickTrackingHosts: {host: string, via: string, evidence: string}[],
 *   headerSignals: string[]
 * }}
 */
export function correlateClickTrackingHosts(emailBody, emailHeaders, dnsRecords) {
  const { sendgridDetected, signals } = detectSendgridFromHeaders(emailHeaders);
  const bodyHosts = extractLinkHostsFromEmailBody(emailBody);
  const dnsFindings = mineSendgridClickTrackingHosts(dnsRecords);
  const dnsByQuery = new Map(dnsFindings.map((f) => [f.query, f]));
  const clickTrackingHosts = [];

  for (const host of bodyHosts) {
    const dnsHit = dnsByQuery.get(host);
    if (dnsHit) {
      clickTrackingHosts.push({
        host,
        via: 'dns',
        evidence: `CNAME ${host} -> ${dnsHit.target}`,
      });
    }
  }
  for (const f of dnsFindings) {
    if (!clickTrackingHosts.some((c) => c.host === f.query)) {
      clickTrackingHosts.push({
        host: f.query,
        via: 'dns',
        evidence: `CNAME ${f.query} -> ${f.target} (not seen in email body)`,
      });
    }
  }
  if (sendgridDetected) {
    for (const host of bodyHosts) {
      if (!clickTrackingHosts.some((c) => c.host === host)) {
        clickTrackingHosts.push({
          host,
          via: 'headers',
          evidence: 'appears in SendGrid-flavoured email; DNS evidence missing',
        });
      }
    }
  }
  return {
    sendgridConfirmed: sendgridDetected || dnsFindings.length > 0,
    clickTrackingHosts,
    headerSignals: signals,
  };
}
