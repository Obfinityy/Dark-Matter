/**
 * oauthDiscoveryMining.js — OAuth discovery-document mining for autonomous bug bounty.
 *
 * Implements idea-bank item 00425: mine OAuth 2.0 / OpenID Connect
 * discovery (metadata) documents to map a target's authentication
 * infrastructure.
 *
 * A discovery document (RFC 8414 / OpenID Provider Metadata) is a public
 * inventory of the auth system: authorization, token, userinfo, JWKS,
 * registration, revocation, and introspection endpoints; supported flows,
 * scopes, claims, and PKCE methods. Mining it maps endpoint hosts (which
 * often differ from the app host), names the provider, and surfaces
 * enabled legacy flows for an authorized engagement to review.
 *
 * All functions are pure and side-effect free: they parse discovery JSON
 * the caller fetched through legitimate means during an authorized
 * engagement. No discovery fetching is performed here.
 */

/**
 * Endpoint fields mined from a discovery document.
 * @type {string[]}
 */
const ENDPOINT_FIELDS = [
  'authorization_endpoint',
  'token_endpoint',
  'userinfo_endpoint',
  'jwks_uri',
  'registration_endpoint',
  'revocation_endpoint',
  'introspection_endpoint',
  'pushed_authorization_request_endpoint',
  'device_authorization_endpoint',
  'end_session_endpoint',
];

/**
 * Extract the registrable host from a URL string.
 * @param {string} url
 * @returns {string|null}
 */
export function hostOf(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Parse an OAuth/OIDC discovery document into a structured inventory.
 * @param {object} doc Parsed discovery JSON object.
 * @returns {{
 *   issuer: string|null, endpoints: Record<string, string|null>, endpointCount: number,
 *   responseTypes: string[], responseModes: string[], grantTypes: string[],
 *   scopes: string[], claims: string[], pkceMethods: string[],
 *   extraFields: string[]
 * }}
 */
export function parseDiscoveryDocument(doc) {
  const empty = {
    issuer: null, endpoints: {}, endpointCount: 0,
    responseTypes: [], responseModes: [], grantTypes: [],
    scopes: [], claims: [], pkceMethods: [], extraFields: [],
  };
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return empty;

  const endpoints = {};
  for (const field of ENDPOINT_FIELDS) {
    endpoints[field] = typeof doc[field] === 'string' ? doc[field] : null;
  }
  const str = (v) => (typeof v === 'string' ? v : null);
  const strList = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);

  return {
    issuer: str(doc.issuer),
    endpoints,
    endpointCount: Object.values(endpoints).filter(Boolean).length,
    responseTypes: strList(doc.response_types_supported),
    responseModes: strList(doc.response_modes_supported),
    grantTypes: strList(doc.grant_types_supported),
    scopes: strList(doc.scopes_supported),
    claims: strList(doc.claims_supported),
    pkceMethods: strList(doc.code_challenge_methods_supported),
    extraFields: Object.keys(doc).filter(
      (k) => !ENDPOINT_FIELDS.includes(k) && ![
        'issuer', 'response_types_supported', 'response_modes_supported',
        'grant_types_supported', 'scopes_supported', 'claims_supported',
        'code_challenge_methods_supported',
      ].includes(k),
    ),
  };
}

/**
 * Map every endpoint to its host and flag cross-host endpoints (endpoints
 * living on a different host than the issuer — common in federated setups).
 * @param {{issuer: string|null, endpoints: Record<string, string|null>}} parsed Output of parseDiscoveryDocument.
 * @returns {{issuerHost: string|null, hosts: Record<string, string|null>, crossHostEndpoints: Array<{endpoint: string, host: string}>, uniqueHosts: string[]}}
 */
export function mapOAuthHosts(parsed) {
  const endpoints = (parsed && parsed.endpoints) || {};
  const issuerHost = hostOf(parsed ? parsed.issuer : null);
  const hosts = {};
  const crossHostEndpoints = [];
  const unique = new Set();
  for (const [field, url] of Object.entries(endpoints)) {
    const host = hostOf(url);
    hosts[field] = host;
    if (host) {
      unique.add(host);
      if (issuerHost && host !== issuerHost) crossHostEndpoints.push({ endpoint: field, host });
    }
  }
  return { issuerHost, hosts, crossHostEndpoints, uniqueHosts: [...unique].sort() };
}

/**
 * Identify the auth provider from issuer and endpoint URL patterns.
 * @param {{issuer: string|null, endpoints: Record<string, string|null>}} parsed
 * @returns {{provider: string, confidence: string, evidence: string}|null}
 */
export function fingerprintOAuthProvider(parsed) {
  const haystack = [
    parsed ? parsed.issuer : null,
    ...Object.values((parsed && parsed.endpoints) || {}),
  ].filter(Boolean).join(' ').toLowerCase();
  if (!haystack) return null;
  const table = [
    [/auth0\.com/, 'Auth0'],
    [/accounts\.google\.com/, 'Google Identity'],
    [/login\.microsoftonline\.com/, 'Microsoft Entra ID'],
    [/cognito-idp\./, 'AWS Cognito'],
    [/okta\.com|oktapreview\.com/, 'Okta'],
    [/\/realms\//, 'Keycloak'],
    [/\.supabase\.co\/auth/, 'Supabase Auth'],
    [/clerk\./, 'Clerk'],
    [/login\.salesforce\.com/, 'Salesforce'],
    [/appleid\.apple\.com/, 'Apple Sign In'],
  ];
  for (const [re, provider] of table) {
    if (re.test(haystack)) return { provider, confidence: 'high', evidence: `discovery URLs match ${provider} patterns` };
  }
  return { provider: 'unknown/custom IdP', confidence: 'low', evidence: 'no known provider URL pattern matched' };
}

/**
 * Extract review-worthy observations from a parsed discovery document.
 * Flags legacy/risky enabled flows and host sprawl — hardening signals
 * for an authorized engagement, not exploitation guidance.
 * @param {{responseTypes: string[], grantTypes: string[], pkceMethods: string[], endpoints: object}} parsed
 * @returns {string[]}
 */
export function extractOAuthObservations(parsed) {
  const notes = [];
  const p = parsed || {};
  const responseTypes = p.responseTypes || [];
  const grantTypes = p.grantTypes || [];
  const pkce = p.pkceMethods || [];
  if (responseTypes.some((t) => /(^|\s)token(\s|$)/.test(t) || t === 'id_token')) {
    notes.push('implicit flow response types advertised — legacy flow with tokens in the URL fragment');
  }
  if (grantTypes.includes('password') || grantTypes.includes('urn:ietf:params:oauth:grant-type:jwt-bearer')) {
    notes.push('resource-owner password or JWT-bearer grants advertised — review credential handling');
  }
  if (responseTypes.includes('code') && pkce.length === 0) {
    notes.push('authorization-code flow without advertised PKCE methods — verify PKCE enforcement for public clients');
  }
  const hosts = mapOAuthHosts(p);
  if (hosts.crossHostEndpoints.length > 0) {
    notes.push(`endpoints span ${hosts.uniqueHosts.length} hosts: ${hosts.uniqueHosts.join(', ')}`);
  }
  if ((p.endpoints || {}).registration_endpoint) {
    notes.push('dynamic client registration endpoint advertised — review registration controls');
  }
  return notes;
}
