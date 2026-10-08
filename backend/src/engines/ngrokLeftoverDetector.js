/**
 * ngrokLeftoverDetector.js — ngrok tunnel leftover detector.
 *
 * ngrok exposes local dev servers via public URLs like
 * `https://abcd-12-34-56-78.ngrok-free.app`. When such URLs are hardcoded in
 * configs, JS bundles, or documentation, they point at a developer's machine —
 * which is usually offline, but while the tunnel is up the URL exposes a dev
 * server to the internet. A stale ngrok URL in shipped code is a hardening
 * finding: it leaks internal routing and invites tunnel takeovers.
 *
 * Pure text analysis: the caller supplies fetched text. This module only
 * DETECTS exposure — it never connects to the tunnels. Defensive use:
 * authorized hardening review on targets the user may test.
 */

/** ngrok public URL host patterns. */
export const NGROK_HOST_RES = [
  /(^|\.)ngrok\.io$/i,
  /(^|\.)ngrok-free\.app$/i,
  /(^|\.)ngrok-free\.dev$/i,
  /(^|\.)ngrok\.dev$/i,
];

const URL_RE = /https?:\/\/[^\s"'`<>()]+/gi;
/** ngrok authtoken values are redacted, never reported in full. */
const AUTHTOKEN_RE = /["']?authtoken["']?\s*[:=]\s*["']?([A-Za-z0-9_]{20,})["']?/gi;

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
 * Check whether a hostname is an ngrok tunnel URL.
 *
 * @param {string} hostname
 * @returns {boolean}
 */
export function isNgrokHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  return NGROK_HOST_RES.some(re => re.test(host));
}

/**
 * Detect ngrok agent config artefacts (authtoken presence is flagged, value redacted).
 *
 * @param {string} text
 * @returns {{ hasAuthtoken: boolean, redacted: boolean }}
 */
export function detectAgentConfig(text) {
  if (typeof text !== 'string') return { hasAuthtoken: false, redacted: false };
  AUTHTOKEN_RE.lastIndex = 0;
  const hasAuthtoken = AUTHTOKEN_RE.test(text);
  return { hasAuthtoken, redacted: hasAuthtoken };
}

/**
 * Scan text for hardcoded ngrok tunnel URLs.
 *
 * @param {{ source?: string, text: string }} input
 * @returns {{ type: string, confidence: string, findings: object[], agentConfigLeak: boolean, evidence: string }}
 */
export function detectNgrokLeftovers({ source = 'unknown', text = '' } = {}) {
  const findings = [];
  const seen = new Set();
  for (const url of extractUrls(text)) {
    let hostname;
    try {
      hostname = new URL(url).hostname;
    } catch {
      continue;
    }
    if (!isNgrokHost(hostname) || seen.has(url)) continue;
    seen.add(url);
    findings.push({
      url,
      hostname,
      source,
      severity: /config|env|secret/.test(String(source).toLowerCase()) ? 'high' : 'medium',
      remediation:
        'Replace the ngrok URL with the real production endpoint; verify the ' +
        'tunnel is stopped so the subdomain cannot be re-registered by someone else.',
    });
  }

  const agentConfig = detectAgentConfig(text);

  return {
    type: 'ngrok Tunnel Leftover Detection',
    confidence: findings.length ? 'high' : 'low',
    findings,
    agentConfigLeak: agentConfig.hasAuthtoken,
    evidence:
      (findings.length
        ? `Found ${findings.length} hardcoded ngrok tunnel URL(s) in ${source}: ${findings.map(f => f.url).join('; ')}. `
        : `No ngrok tunnel URLs found in ${source}. `) +
      (agentConfig.hasAuthtoken
        ? 'An ngrok agent authtoken appears to be present in the text (value redacted) — rotate it immediately.'
        : ''),
  };
}

export const NGROK_LEFTOVER_DETECTOR = {
  NGROK_HOST_RES,
  extractUrls,
  isNgrokHost,
  detectAgentConfig,
  detectNgrokLeftovers,
};
export default NGROK_LEFTOVER_DETECTOR;
