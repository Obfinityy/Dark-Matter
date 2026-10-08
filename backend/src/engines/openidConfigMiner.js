/**
 * openidConfigMiner.js — OpenID configuration host extraction (idea 00113).
 *
 * Fetching /.well-known/openid-configuration exposes the identity provider's
 * issuer, jwks_uri, authorization/token/userinfo/revocation endpoints — each a
 * host worth mapping. This module parses the discovery document into hosts.
 */

/** URL fields commonly present in an OIDC discovery document. */
const OIDC_URL_FIELDS = [
  'issuer',
  'authorization_endpoint',
  'token_endpoint',
  'userinfo_endpoint',
  'jwks_uri',
  'registration_endpoint',
  'revocation_endpoint',
  'introspection_endpoint',
  'end_session_endpoint',
  'device_authorization_endpoint',
];

function hostOf(value) {
  try {
    return new URL(String(value)).hostname;
  } catch {
    return null;
  }
}

/**
 * Parse an OpenID Connect discovery document into enumerated hosts.
 * @param {object|string} doc — parsed JSON or raw JSON text
 * @returns {{ valid: boolean, issuer: string|null, hosts: { field, host, url }[], uniqueHosts: string[], notes: string[] }}
 */
export function parseOpenIdConfiguration(doc) {
  const notes = [];
  let obj = doc;
  if (typeof doc === 'string') {
    try {
      obj = JSON.parse(doc);
    } catch {
      return { valid: false, issuer: null, hosts: [], uniqueHosts: [], notes: ['Not valid JSON'] };
    }
  }
  if (!obj || typeof obj !== 'object') {
    return { valid: false, issuer: null, hosts: [], uniqueHosts: [], notes: ['Empty document'] };
  }

  const hosts = [];
  const unique = new Set();
  for (const field of OIDC_URL_FIELDS) {
    const url = obj[field];
    if (!url) continue;
    const host = hostOf(url);
    if (host) {
      hosts.push({ field, host, url: String(url) });
      unique.add(host);
    }
  }

  const issuer = obj.issuer || null;
  if (!issuer) notes.push('No issuer field — document may not be a real OIDC discovery doc');
  if (unique.size > 1) {
    notes.push(`IdP spans ${unique.size} distinct hosts — each is a separate trust boundary`);
  }
  if (hosts.some(h => !h.url.startsWith('https://'))) {
    notes.push('Non-HTTPS endpoint present — downgrade/SSRF-adjacent surface worth verifying');
  }

  return { valid: true, issuer, hosts, uniqueHosts: [...unique], notes };
}

/**
 * Canonical discovery URL for a base.
 * @param {string} base — e.g. "https://login.example.com"
 * @returns {string}
 */
export function openIdConfigurationUrl(base) {
  const u = new URL(String(base));
  return `${u.origin}/.well-known/openid-configuration`;
}

export const OPENID_CONFIG_MINER = { parseOpenIdConfiguration, openIdConfigurationUrl };
export default OPENID_CONFIG_MINER;
