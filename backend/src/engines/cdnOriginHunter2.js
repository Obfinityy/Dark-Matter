/**
 * cdnOriginHunter2.js — CDN origin discovery via certificate, favicon, error-page and DNS signals.
 *
 * Companion to the first-generation CDN origin hunters (ideas 578–580: MX, SPF,
 * historical DNS). This module implements ideas 581–584:
 *
 *   581 — CDN true-IP via certificate SANs: find origin hostnames in the
 *           certificate's Subject Alternative Names that bypass the CDN.
 *   582 — CDN true-IP via favicon hash: match favicon hashes seen on non-CDN
 *           IPs to find origins serving an identical application.
 *   583 — CDN true-IP via error pages: classify error responses that leak
 *           origin IPs or internal hostnames.
 *   584 — CDN true-IP via SSHFP: parse SSHFP records that sometimes point at
 *           origin hosts.
 *
 * Defensive framing: all analysis runs on data the authorized hunt has already
 * collected (certificates, page bodies, DNS records). Nothing here probes or
 * attacks anything; it is pure heuristic classification feeding the asset
 * inventory and the analyst-facing report.
 */

const KNOWN_CDN_HOSTS = [
  /cloudflare\.com$/i,
  /cloudfront\.net$/i,
  /akamaiedge\.net$/i,
  /akamaihd\.net$/i,
  /fastly\.net$/i,
  /fastlylb\.net$/i,
  /azureedge\.net$/i,
  /googleusercontent\.com$/i,
  /gcdn\.co$/i,
  /cdn77\.net$/i,
  /stackpathdns\.com$/i,
  /incapsula\.com$/i,
  /impervadns\.com$/i,
  /edgecdn\.ru$/i,
  /cdnetworks\.com$/i,
  /sucuri\.net$/i,
];

const ORIGIN_HINT_NAMES = [
  'origin',
  'direct',
  'backend',
  'internal',
  'private',
  'real',
  'bypass',
  'app-origin',
  'web-origin',
  'api-origin',
  'origin-',
  'true-',
  'uncdn',
  'node',
  'server',
  'webserver',
  'ingress',
  'proxy-origin',
  'edge-bypass',
];

const ORIGIN_IP_PATTERN =
  /\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b/;
const INTERNAL_HOSTNAME_PATTERN =
  /\b(?:internal|intranet|corp|lan|private|staging|dev|prod|backend|origin|db|db-[\w.-]+|srv[\w.-]*|host[\w.-]*|ip-[\w.-]+|ec2-[\w.-]+)\.[\w.-]+\b/i;

const ERROR_PAGE_LEAK_SIGNATURES = [
  {
    name: 'origin-ip-leak',
    description: 'Error page discloses a bare origin IPv4 address.',
    match: body => (ORIGIN_IP_PATTERN.test(body) ? [ORIGIN_IP_PATTERN.exec(body)[0]] : []),
    severity: 'High',
  },
  {
    name: 'internal-hostname-leak',
    description: 'Error page discloses an internal-looking hostname.',
    match: body => {
      const m = body.match(INTERNAL_HOSTNAME_PATTERN);
      return m ? [m[0]] : [];
    },
    severity: 'Medium',
  },
  {
    name: 'nginx-version-leak',
    description: 'Error page reveals nginx version/build on origin.',
    match: body => (/nginx\/[\d.]+/i.test(body) ? ['nginx-version'] : []),
    severity: 'Low',
  },
  {
    name: 'apache-version-leak',
    description: 'Error page reveals Apache version/build on origin.',
    match: body => (/Apache\/[\d.]+/i.test(body) ? ['apache-version'] : []),
    severity: 'Low',
  },
  {
    name: 'cloud-provider-error-leak',
    description: 'Error page matches a cloud-provider origin stack fingerprint.',
    match: body =>
      /(AWS ELB|Amazon Route 53|Google Cloud Load Balancer|Azure Front Door|OCI Load Balancer)/i.test(
        body
      )
        ? ['provider-error-fingerprint']
        : [],
    severity: 'Medium',
  },
];

/**
 * Check whether a hostname is served by a known CDN edge network.
 * @param {string} hostname
 * @returns {boolean}
 */
export function isKnownCdnHost(hostname = '') {
  return KNOWN_CDN_HOSTS.some(re => re.test(hostname.trim()));
}

/**
 * Score a SAN hostname for how strongly it hints at being an origin host
 * that bypasses the CDN.
 * @param {string} hostname
 * @returns {number} 0–100
 */
function scoreOriginHint(hostname = '') {
  const lower = hostname.toLowerCase();
  if (isKnownCdnHost(hostname)) return 0;
  let score = 20;
  for (const hint of ORIGIN_HINT_NAMES) {
    if (lower.includes(hint)) {
      score += 30;
      break;
    }
  }
  if (/^(www\.|cdn\.|static\.)/i.test(lower)) score -= 10;
  return Math.max(0, Math.min(100, score));
}

/**
 * Discover origin hostnames from a certificate's SAN list (idea 581).
 * SANs sometimes name the origin (origin.example.com) even when the public
 * site sits behind a CDN.
 * @param {{ sanList: string[], cdnHostnames?: string[] }} input
 * @returns {{ candidates: Array<{hostname, score, reason}>, total }}
 */
export function discoverOriginViaCertSans({ sanList = [], cdnHostnames = [] } = {}) {
  const cdnSet = new Set(cdnHostnames.map(h => String(h).toLowerCase()));
  const candidates = [];
  for (const san of sanList) {
    const hostname = String(san).trim().toLowerCase().replace(/^\*\./, '');
    if (!hostname || hostname.includes('*')) continue;
    if (cdnSet.has(hostname) || isKnownCdnHost(hostname)) continue;
    const score = scoreOriginHint(hostname);
    if (score >= 20) {
      candidates.push({
        hostname,
        score,
        reason:
          score >= 50
            ? 'SAN hostname carries origin naming hints and is not on a CDN edge.'
            : 'SAN hostname is a non-CDN, non-public-looking name — possible origin.',
      });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return { candidates, total: candidates.length };
}

/**
 * Match favicon hashes on candidate (non-CDN) IPs against the target's
 * favicon hash (idea 582). Identical hashes mean identical apps — a strong
 * origin signal.
 * @param {{ targetHash: string, candidates?: Array<{ip, faviconHash, httpStatus}> }} input
 * @returns {{ matches: Array<{ip, confidence}>, total }}
 */
export function discoverOriginViaFaviconHash({ targetHash = '', candidates = [] } = {}) {
  const normalized = String(targetHash).trim().toLowerCase();
  const matches = [];
  if (normalized) {
    for (const cand of candidates) {
      if (
        String(cand.faviconHash || '')
          .trim()
          .toLowerCase() === normalized
      ) {
        matches.push({
          ip: String(cand.ip),
          confidence:
            Number(cand.httpStatus) >= 200 && Number(cand.httpStatus) < 300 ? 'high' : 'medium',
        });
      }
    }
  }
  return { matches, total: matches.length };
}

/**
 * Classify error responses for origin/IP leaks (idea 583).
 * @param {{ statusCode?: number, body?: string, headers?: Record<string,string> }} input
 * @returns {{ leaked: boolean, findings: Array<{signature, severity, evidence}>, classification }}
 */
export function discoverOriginViaErrorPages({ statusCode = 0, body = '', headers = {} } = {}) {
  const findings = [];
  const text = String(body);
  for (const sig of ERROR_PAGE_LEAK_SIGNATURES) {
    const evidence = sig.match(text);
    if (evidence.length > 0) {
      findings.push({
        signature: sig.name,
        severity: sig.severity,
        description: sig.description,
        evidence: evidence.slice(0, 3).map(redactEvidence),
      });
    }
  }
  const viaHeader = String(headers['x-origin-ip'] || headers['x-backend-server'] || '');
  if (viaHeader) {
    findings.push({
      signature: 'origin-header-leak',
      severity: 'High',
      description: 'Response header directly names the origin/backend host.',
      evidence: [redactEvidence(viaHeader)],
    });
  }
  return {
    leaked: findings.length > 0,
    findings,
    classification: findings.length > 0 ? 'error-page-origin-leak' : 'no-leak',
    statusCode,
  };
}

/**
 * Parse SSHFP records for origin host candidates (idea 584).
 * SSHFP records occasionally exist on origin hosts while the CDN-served name
 * has none — the presence delta is itself a signal.
 * @param {{ sshfpRecords?: Array<{hostname, algorithm, type, fingerprint}>, targetHostname?: string }} input
 * @returns {{ candidates: Array<{hostname, algorithms: number[]}>, insight }}
 */
export function discoverOriginViaSshfp({ sshfpRecords = [], targetHostname = '' } = {}) {
  const byHost = new Map();
  for (const rec of sshfpRecords) {
    const host = String(rec.hostname || '')
      .trim()
      .toLowerCase();
    if (!host) continue;
    if (!byHost.has(host)) byHost.set(host, new Set());
    byHost.get(host).add(Number(rec.algorithm) || 0);
  }
  const candidates = [...byHost.entries()]
    .filter(([host]) => host !== String(targetHostname).toLowerCase())
    .map(([hostname, algos]) => ({
      hostname,
      algorithms: [...algos].filter(Boolean),
    }));
  const targetHasSshfp = byHost.has(String(targetHostname).toLowerCase());
  return {
    candidates,
    insight: targetHasSshfp
      ? 'Target publishes SSHFP itself; SSHFP records add no new signal.'
      : 'Target publishes no SSHFP records; any SSHFP-bearing host is a lead worth checking against known assets.',
  };
}

/**
 * Redact anything credential-looking before it enters a finding.
 * @param {string} value
 * @returns {string}
 */
function redactEvidence(value = '') {
  return String(value)
    .replace(/(api[_-]?key|secret|token|password|passwd|pwd)[=:\s]+[\w.-]+/gi, '$1=[REDACTED]')
    .slice(0, 200);
}

export const CDN_ORIGIN_HUNTER_2 = {
  KNOWN_CDN_HOSTS,
  ERROR_PAGE_LEAK_SIGNATURES,
  isKnownCdnHost,
  discoverOriginViaCertSans,
  discoverOriginViaFaviconHash,
  discoverOriginViaErrorPages,
  discoverOriginViaSshfp,
};

export default CDN_ORIGIN_HUNTER_2;
