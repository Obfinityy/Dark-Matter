/**
 * oauthMetadataMiner.js — OAuth authorization-server metadata mining (idea 00114).
 *
 * RFC 8414 metadata at /.well-known/oauth-authorization-server lists token,
 * revocation, introspection and registration endpoints. Parsing it maps the
 * authorization server's infrastructure footprint.
 */

const OAUTH_URL_FIELDS = [
  'issuer',
  'authorization_endpoint',
  'token_endpoint',
  'jwks_uri',
  'registration_endpoint',
  'revocation_endpoint',
  'introspection_endpoint',
  'pushed_authorization_request_endpoint',
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
 * Parse an OAuth authorization-server metadata document.
 * @param {object|string} doc — parsed JSON or raw JSON text
 * @returns {{ valid: boolean, issuer: string|null, hosts: { field, host, url }[], uniqueHosts: string[], capabilities: string[], notes: string[] }}
 */
export function parseOAuthServerMetadata(doc) {
  const notes = [];
  let obj = doc;
  if (typeof doc === 'string') {
    try {
      obj = JSON.parse(doc);
    } catch {
      return { valid: false, issuer: null, hosts: [], uniqueHosts: [], capabilities: [], notes: ['Not valid JSON'] };
    }
  }
  if (!obj || typeof obj !== 'object') {
    return { valid: false, issuer: null, hosts: [], uniqueHosts: [], capabilities: [], notes: ['Empty document'] };
  }

  const hosts = [];
  const unique = new Set();
  for (const field of OAUTH_URL_FIELDS) {
    const url = obj[field];
    if (!url) continue;
    const host = hostOf(url);
    if (host) {
      hosts.push({ field, host, url: String(url) });
      unique.add(host);
    }
  }

  // Security-relevant capabilities advertised by the metadata.
  const capabilities = [];
  if (obj.revocation_endpoint) capabilities.push('token-revocation');
  if (obj.introspection_endpoint) capabilities.push('token-introspection');
  if (obj.pushed_authorization_request_endpoint) capabilities.push('PAR');
  if (obj.device_authorization_endpoint) capabilities.push('device-flow');
  if (obj.registration_endpoint) capabilities.push('dynamic-client-registration');
  if (Array.isArray(obj.response_modes_supported) && obj.response_modes_supported.includes('query')) {
    capabilities.push('query-response-mode');
  }

  const issuer = obj.issuer || null;
  if (unique.size > 1) notes.push(`Authorization server spans ${unique.size} distinct hosts`);
  if (!obj.revocation_endpoint) notes.push('No revocation endpoint advertised — check how token invalidation is handled');
  if (obj.registration_endpoint) notes.push('Dynamic client registration enabled — potential unauthorized client surface');

  return { valid: true, issuer, hosts, uniqueHosts: [...unique], capabilities, notes };
}

/**
 * Canonical metadata URL candidates (RFC 8414 allows path-inserted and well-known variants).
 * @param {string} issuer — e.g. "https://auth.example.com"
 * @returns {string[]}
 */
export function oauthMetadataUrls(issuer) {
  const u = new URL(String(issuer));
  const path = u.pathname.replace(/\/$/, '');
  return [
    `${u.origin}/.well-known/oauth-authorization-server${path || ''}`,
    `${u.origin}${path}/.well-known/oauth-authorization-server`,
  ].filter((v, i, a) => a.indexOf(v) === i);
}

export const OAUTH_METADATA_MINER = { parseOAuthServerMetadata, oauthMetadataUrls };
export default OAUTH_METADATA_MINER;
