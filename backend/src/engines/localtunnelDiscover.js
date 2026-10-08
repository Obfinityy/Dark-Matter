/**
 * localtunnelDiscover.js — localtunnel URL discovery.
 *
 * localtunnel exposes a local port through a public URL of the form
 * `https://<subdomain>.loca.lt` (optionally password-protected). Leftover
 * localtunnel URLs in configs, READMEs, tickets, or JS bundles show that a
 * local dev server was exposed to the internet and may still be reachable
 * while the tunnel runs — a hardening finding for authorized review.
 *
 * Pure text analysis: the caller supplies fetched text. This module only
 * DETECTS exposure — it never connects to the tunnels. Defensive use:
 * authorized hardening review on targets the user may test.
 */

/** localtunnel public URL host pattern. */
export const LOCALTUNNEL_HOST_RE = /(^|\.)loca\.lt$/i;

const URL_RE = /https?:\/\/[^\s"'`<>()]+/gi;
/** localtunnel CLI invocations embedded in docs/scripts: `lt --port 3000 --subdomain foo`. */
const LT_CLI_RE = /\blt\b[^\n]*?--port\s+(\d{2,5})/gi;
const LT_SUBDOMAIN_RE = /--subdomain\s+([A-Za-z0-9][A-Za-z0-9-]{1,60})/i;

/**
 * Extract all http(s) URLs from a text blob.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function extractUrls(text) {
  if (typeof text !== 'string') return [];
  URL_RE.lastIndex = 0;
  const out = [];
  let m;
  while ((m = URL_RE.exec(text)) !== null) {
    out.push(m[0].replace(/[.,;!?]+$/, ''));
  }
  return out;
}

/**
 * Check whether a hostname is a localtunnel URL.
 *
 * @param {string} hostname
 * @returns {boolean}
 */
export function isLocaltunnelHost(hostname) {
  return LOCALTUNNEL_HOST_RE.test(String(hostname || '').toLowerCase());
}

/**
 * Extract the requested local port from localtunnel CLI invocations in text.
 *
 * @param {string} text
 * @returns {number[]}
 */
export function extractLtPorts(text) {
  if (typeof text !== 'string') return [];
  const ports = new Set();
  LT_CLI_RE.lastIndex = 0;
  let m;
  while ((m = LT_CLI_RE.exec(text)) !== null) {
    const port = Number(m[1]);
    if (port >= 1 && port <= 65535) ports.add(port);
  }
  return [...ports].sort((a, b) => a - b);
}

/**
 * Extract a pinned `--subdomain` name from localtunnel CLI invocations.
 *
 * @param {string} text
 * @returns {string|null}
 */
export function extractLtSubdomain(text) {
  if (typeof text !== 'string') return null;
  const m = LT_SUBDOMAIN_RE.exec(text);
  return m ? m[1] : null;
}

/**
 * Scan text for localtunnel exposure.
 *
 * @param {{ source?: string, text: string }} input
 * @returns {{ type: string, confidence: string, findings: object[], cliHints: object, evidence: string }}
 */
export function discoverLocaltunnels({ source = 'unknown', text = '' } = {}) {
  const findings = [];
  const seen = new Set();
  for (const url of extractUrls(text)) {
    let hostname;
    try {
      hostname = new URL(url).hostname;
    } catch {
      continue;
    }
    if (!isLocaltunnelHost(hostname) || seen.has(url)) continue;
    seen.add(url);
    findings.push({
      url,
      hostname,
      source,
      severity: 'medium',
      remediation:
        'Remove the localtunnel URL from the shipped artefact and stop the ' +
        'tunnel; local dev servers must not be reachable from the internet.',
    });
  }

  const cliHints = {
    ports: extractLtPorts(text),
    pinnedSubdomain: extractLtSubdomain(text),
  };

  return {
    type: 'localtunnel URL Discovery',
    confidence: findings.length || cliHints.ports.length ? 'high' : 'low',
    findings,
    cliHints,
    evidence:
      (findings.length
        ? `Found ${findings.length} localtunnel URL(s) in ${source}: ${findings.map(f => f.url).join('; ')}. `
        : `No localtunnel URLs found in ${source}. `) +
      (cliHints.ports.length
        ? `localtunnel CLI hints reference local port(s): ${cliHints.ports.join(', ')}` +
          (cliHints.pinnedSubdomain ? ` with pinned subdomain '${cliHints.pinnedSubdomain}'.` : '.')
        : ''),
  };
}

export const LOCALTUNNEL_DISCOVER = {
  LOCALTUNNEL_HOST_RE,
  extractUrls,
  isLocaltunnelHost,
  extractLtPorts,
  extractLtSubdomain,
  discoverLocaltunnels,
};
export default LOCALTUNNEL_DISCOVER;
