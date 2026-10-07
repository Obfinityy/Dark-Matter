/**
 * cloudflareTunnelLeakDetector.js — cloudflared tunnel config leak detector.
 *
 * Cloudflare Tunnel (cloudflared) exposes internal services through outbound
 * tunnels: public hostnames like `*.cfargotunnel.com` and ingress rules that
 * map hostnames to internal services (e.g. `service: http://localhost:8080`).
 * Leaked tunnel configs or credentials files reveal internal hostnames, the
 * services behind them, and tunnel UUIDs — a strong hardening finding.
 *
 * Pure text analysis: the caller supplies fetched text (config.yml, JSON
 * credentials, docs). This module only DETECTS exposure — it never connects
 * to tunnels. Defensive use: authorized hardening review on targets the
 * user may test.
 */

/** Public hostnames served by Cloudflare Tunnel quick-tunnel / named tunnels. */
export const CF_TUNNEL_HOST_RE = /(^|\.)cfargotunnel\.com$/i;
/** Cloudflare tunnel IDs are UUIDs. */
const TUNNEL_UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const URL_RE = /https?:\/\/[^\s"'`<>()]+/gi;
const CREDENTIALS_FILE_RE = /credentials-file\s*:\s*([^\s"'`]+)/i;
const INGRESS_HOSTNAME_RE = /-\s*hostname\s*:\s*([^\s"'`]+)/gi;
const INGRESS_SERVICE_RE = /service\s*:\s*([^\s"'`]+)/gi;

/**
 * Extract tunnel UUIDs from text.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function extractTunnelIds(text) {
  if (typeof text !== 'string') return [];
  TUNNEL_UUID_RE.lastIndex = 0;
  const ids = new Set();
  let m;
  while ((m = TUNNEL_UUID_RE.exec(text)) !== null) ids.add(m[0].toLowerCase());
  return [...ids].sort();
}

/**
 * Extract cfargotunnel.com hostnames from URLs in text.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function extractTunnelHostnames(text) {
  if (typeof text !== 'string') return [];
  URL_RE.lastIndex = 0;
  const hosts = new Set();
  let m;
  while ((m = URL_RE.exec(text)) !== null) {
    try {
      const hostname = new URL(m[0]).hostname;
      if (CF_TUNNEL_HOST_RE.test(hostname)) hosts.add(hostname.toLowerCase());
    } catch {
      /* ignore */
    }
  }
  return [...hosts].sort();
}

/**
 * Parse cloudflared config.yml ingress rules (hostname → internal service).
 *
 * @param {string} text
 * @returns {Array<{ hostname: string|null, service: string|null }>}
 */
export function parseIngressRules(text) {
  if (typeof text !== 'string') return [];
  const hostnames = [];
  const services = [];
  INGRESS_HOSTNAME_RE.lastIndex = 0;
  INGRESS_SERVICE_RE.lastIndex = 0;
  let m;
  while ((m = INGRESS_HOSTNAME_RE.exec(text)) !== null) hostnames.push(m[1]);
  while ((m = INGRESS_SERVICE_RE.exec(text)) !== null) services.push(m[1]);
  const rules = [];
  const count = Math.max(hostnames.length, services.length);
  for (let i = 0; i < count; i++) {
    rules.push({
      hostname: hostnames[i] ?? null,
      service: services[i] ?? null,
      exposesInternal: services[i] ? /localhost|127\.0\.0\.1|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\./i.test(services[i]) : false,
    });
  }
  return rules;
}

/**
 * Detect a credentials-file path reference (credentials JSON holds tunnel secrets — flag, don't read).
 *
 * @param {string} text
 * @returns {string|null}
 */
export function extractCredentialsFile(text) {
  if (typeof text !== 'string') return null;
  const m = CREDENTIALS_FILE_RE.exec(text);
  return m ? m[1] : null;
}

/**
 * Scan text for Cloudflare Tunnel config leaks.
 *
 * @param {{ source?: string, text: string }} input
 * @returns {{ type: string, confidence: string, tunnelIds: string[], tunnelHostnames: string[], ingress: object[], credentialsFile: string|null, severity: string, evidence: string }}
 */
export function detectCloudflareTunnelLeaks({ source = 'unknown', text = '' } = {}) {
  const tunnelIds = extractTunnelIds(text);
  const tunnelHostnames = extractTunnelHostnames(text);
  const ingress = parseIngressRules(text);
  const credentialsFile = extractCredentialsFile(text);
  const found = tunnelIds.length || tunnelHostnames.length || ingress.length || credentialsFile;

  const severity = credentialsFile || ingress.some((r) => r.exposesInternal) ? 'high' : found ? 'medium' : 'low';

  return {
    type: 'Cloudflare Tunnel Config Leak Detection',
    confidence: found ? 'high' : 'low',
    tunnelIds,
    tunnelHostnames,
    ingress,
    credentialsFile,
    severity,
    evidence: found
      ? `Cloudflare Tunnel artefacts in ${source}: ${tunnelIds.length} tunnel ID(s), ` +
        `${tunnelHostnames.length} cfargotunnel.com hostname(s)` +
        (tunnelHostnames.length ? ` (${tunnelHostnames.join(', ')})` : '') +
        `, ${ingress.length} ingress rule(s)` +
        (ingress.some((r) => r.exposesInternal) ? ' mapping to INTERNAL services' : '') +
        (credentialsFile ? `, credentials-file reference '${credentialsFile}' (rotate the tunnel secret)`.slice(0, 120) : '') +
        '. Verify every exposed hostname is intentional.'
      : `No Cloudflare Tunnel artefacts found in ${source}.`,
  };
}

export const CLOUDFLARE_TUNNEL_LEAK_DETECTOR = {
  CF_TUNNEL_HOST_RE,
  extractTunnelIds,
  extractTunnelHostnames,
  parseIngressRules,
  extractCredentialsFile,
  detectCloudflareTunnelLeaks,
};
export default CLOUDFLARE_TUNNEL_LEAK_DETECTOR;
