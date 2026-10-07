/**
 * cspReportUriMiner.js — CSP report-uri endpoint mining engine.
 *
 * Extracts report-uri / report-to endpoints from Content-Security-Policy
 * headers. These endpoints reveal the security-monitoring infrastructure an
 * organization uses (Report URI services, SIEM collectors, in-house
 * collectors) — useful context for a bug-bounty hunter scoping the target's
 * detection posture. Extraction only; the engine never sends reports.
 */

/**
 * Parse the report directives out of a Content-Security-Policy header value.
 * @param {string} cspHeader raw CSP header value
 * @returns {Array<{directive: 'report-uri'|'report-to', endpoint: string}>}
 */
export function extractReportEndpoints(cspHeader = '') {
  const out = [];
  const header = String(cspHeader);
  const reportUriRe = /report-uri\s+([^;]+)/gi;
  const reportToRe = /report-to\s+([^;]+)/gi;
  let m;
  while ((m = reportUriRe.exec(header)) !== null) {
    for (const token of m[1].trim().split(/\s+/)) {
      if (token) out.push({ directive: 'report-uri', endpoint: token });
    }
  }
  while ((m = reportToRe.exec(header)) !== null) {
    for (const token of m[1].trim().split(/\s+/)) {
      if (token) out.push({ directive: 'report-to', endpoint: token.replace(/^["']|["']$/g, '') });
    }
  }
  return out;
}

/**
 * Classify a report endpoint by the infrastructure it suggests.
 * @param {string} endpoint report-uri endpoint value
 * @returns {{host: string, infrastructure: string}}
 */
export function classifyReportEndpoint(endpoint = '') {
  let host = '';
  try {
    const u = new URL(endpoint, 'https://placeholder.invalid');
    host = u.hostname.toLowerCase();
  } catch { /* ignore */ }
  let infrastructure = 'in-house-collector';
  if (/report-uri\.com/i.test(host)) infrastructure = 'report-uri-service';
  else if (/sentry\.io|ingest\.sentry/i.test(host)) infrastructure = 'sentry';
  else if (/splunk/i.test(host)) infrastructure = 'splunk-hec';
  else if (/datadog/i.test(host)) infrastructure = 'datadog';
  else if (/newrelic/i.test(host)) infrastructure = 'new-relic';
  else if (/sumologic|sumo/i.test(host)) infrastructure = 'sumo-logic';
  return { host, infrastructure };
}

/**
 * Mine report endpoints from a set of observed response headers.
 * @param {object} headers lower- or mixed-case header map
 * @returns {Array<{directive: string, endpoint: string, host: string, infrastructure: string}>}
 */
export function mineReportUris(headers = {}) {
  const lowered = {};
  for (const [k, v] of Object.entries(headers)) lowered[k.toLowerCase()] = String(v);
  const csp = lowered['content-security-policy'] || lowered['content-security-policy-report-only'] || '';
  return extractReportEndpoints(csp).map((e) => ({
    ...e,
    ...classifyReportEndpoint(e.endpoint),
  }));
}

export const CSP_REPORT_URI_MINER = {
  extractReportEndpoints,
  classifyReportEndpoint,
  mineReportUris,
};

export default CSP_REPORT_URI_MINER;
