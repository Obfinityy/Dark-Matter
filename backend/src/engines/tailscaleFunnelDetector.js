/**
 * tailscaleFunnelDetector.js — Tailscale Funnel endpoint detector.
 *
 * Tailscale Funnel publishes a node on a tailnet to the public internet via
 * `https://<machine>.<tailnet>.ts.net`. Finding such endpoints (or `tailscale
 * funnel` / `tailscale serve` config mentions) in shipped artefacts shows an
 * internal service deliberately or accidentally exposed to the world — a
 * hardening finding worth verifying.
 *
 * Pure text analysis: the caller supplies fetched text. This module only
 * DETECTS exposure — it never probes the endpoints. Defensive use: authorized
 * hardening review on targets the user may test.
 */

/** Tailscale public endpoint host pattern. */
export const TAILSCALE_TS_NET_RE = /(^|\.)ts\.net$/i;

const URL_RE = /https?:\/\/[^\s"'`<>()]+/gi;
const FUNNEL_CLI_RE = /\btailscale\s+(funnel|serve)\b[^\n]*/gi;

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
 * Check whether a hostname is a Tailscale Funnel endpoint.
 *
 * @param {string} hostname
 * @returns {boolean}
 */
export function isTailscaleFunnelHost(hostname) {
  return TAILSCALE_TS_NET_RE.test(String(hostname || '').toLowerCase());
}

/**
 * Split a ts.net hostname into machine and tailnet parts.
 *
 * @param {string} hostname
 * @returns {{ machine: string|null, tailnet: string|null }}
 */
export function parseTsNetHostname(hostname) {
  const host = String(hostname || '').toLowerCase();
  if (!isTailscaleFunnelHost(host)) return { machine: null, tailnet: null };
  const labels = host.split('.');
  // <machine>.<tailnet>.ts.net  (tailnet itself may be multi-label, e.g. name.ts.net)
  const machine = labels.length > 3 ? labels[0] : null;
  const tailnet = labels.slice(machine ? 1 : 0, -2).join('.') || null;
  return { machine, tailnet };
}

/**
 * Find `tailscale funnel` / `tailscale serve` CLI mentions in text.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function extractFunnelCliMentions(text) {
  if (typeof text !== 'string') return [];
  FUNNEL_CLI_RE.lastIndex = 0;
  const out = [];
  let m;
  while ((m = FUNNEL_CLI_RE.exec(text)) !== null) out.push(m[0].trim().slice(0, 160));
  return out;
}

/**
 * Scan text for Tailscale Funnel exposure.
 *
 * @param {{ source?: string, text: string }} input
 * @returns {{ type: string, confidence: string, findings: object[], cliMentions: string[], evidence: string }}
 */
export function detectTailscaleFunnels({ source = 'unknown', text = '' } = {}) {
  const findings = [];
  const seen = new Set();
  for (const url of extractUrls(text)) {
    let hostname;
    try {
      hostname = new URL(url).hostname;
    } catch {
      continue;
    }
    if (!isTailscaleFunnelHost(hostname) || seen.has(url)) continue;
    seen.add(url);
    const { machine, tailnet } = parseTsNetHostname(hostname);
    findings.push({
      url,
      hostname,
      machine,
      tailnet,
      source,
      severity: 'medium',
      remediation:
        'Confirm the Funnel endpoint is intentional; restrict with Tailscale ' +
        'ACLs/HTTPS policies and remove it from shipped artefacts if it is not.',
    });
  }

  const cliMentions = extractFunnelCliMentions(text);

  return {
    type: 'Tailscale Funnel Detection',
    confidence: findings.length || cliMentions.length ? 'high' : 'low',
    findings,
    cliMentions,
    evidence:
      (findings.length
        ? `Found ${findings.length} Tailscale Funnel endpoint(s) in ${source}: ${findings.map(f => `${f.url}${f.machine ? ` (machine '${f.machine}')` : ''}`).join('; ')}. `
        : `No Tailscale Funnel endpoints found in ${source}. `) +
      (cliMentions.length ? `Funnel/serve CLI mentions: ${cliMentions.length} found.` : ''),
  };
}

export const TAILSCALE_FUNNEL_DETECTOR = {
  TAILSCALE_TS_NET_RE,
  extractUrls,
  isTailscaleFunnelHost,
  parseTsNetHostname,
  extractFunnelCliMentions,
  detectTailscaleFunnels,
};
export default TAILSCALE_FUNNEL_DETECTOR;
