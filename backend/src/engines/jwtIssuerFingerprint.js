/**
 * jwtIssuerFingerprint.js — JWT issuer fingerprinting for autonomous bug bounty.
 *
 * Implements idea-bank item 00424: fingerprint authentication providers by
 * analyzing JWT header claims and issuer URLs — structure only.
 *
 * A JWT's header and claims name its issuer without any cracking: the iss
 * claim carries the provider's URL, aud/azp name the client, alg names the
 * signing family (RS256/ES256 for enterprise IdPs, HS256 for custom
 * services), and kid formats are provider-idiomatic. This module decodes
 * and classifies that metadata. It performs NO signature verification
 * bypasses, NO key recovery, and NO brute-force of any kind — strictly
 * defensive structural analysis for authorized engagements.
 *
 * All functions are pure and side-effect free: they decode JWT strings the
 * caller observed during an authorized engagement.
 */

/**
 * Known issuer-URL -> provider mappings (substring match, case-insensitive).
 * @type {Array<{match: string, provider: string, confidence: string}>}
 */
const ISSUER_PROVIDERS = [
  { match: 'auth0.com', provider: 'Auth0', confidence: 'high' },
  { match: 'accounts.google.com', provider: 'Google Identity', confidence: 'high' },
  { match: 'login.microsoftonline.com', provider: 'Microsoft Entra ID', confidence: 'high' },
  { match: 'b2clogin.com', provider: 'Azure AD B2C', confidence: 'high' },
  { match: 'cognito-idp.', provider: 'AWS Cognito', confidence: 'high' },
  { match: 'okta.com', provider: 'Okta', confidence: 'high' },
  { match: 'oktapreview.com', provider: 'Okta (preview)', confidence: 'high' },
  { match: '/realms/', provider: 'Keycloak', confidence: 'high' },
  { match: 'securetoken.google.com', provider: 'Firebase Authentication', confidence: 'high' },
  { match: 'clerk.', provider: 'Clerk', confidence: 'medium' },
  { match: '.supabase.co/auth', provider: 'Supabase Auth', confidence: 'high' },
  { match: 'login.salesforce.com', provider: 'Salesforce', confidence: 'high' },
  { match: '.auth0.', provider: 'Auth0', confidence: 'medium' },
  { match: 'identitytoolkit.googleapis.com', provider: 'Google Identity Toolkit', confidence: 'medium' },
  { match: 'login.yahoo.com', provider: 'Yahoo', confidence: 'medium' },
  { match: 'appleid.apple.com', provider: 'Apple Sign In', confidence: 'high' },
];

/**
 * Decode a base64url segment into an object (JSON) or string.
 * @param {string} segment
 * @returns {*|null}
 */
export function decodeBase64UrlSegment(segment) {
  if (!segment || typeof segment !== 'string') return null;
  try {
    let b64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4 !== 0) b64 += '=';
    const json = Buffer.from(b64, 'base64').toString('utf8');
    try {
      return JSON.parse(json);
    } catch {
      return json;
    }
  } catch {
    return null;
  }
}

/**
 * Split a JWT/JWS into header, payload, and signature presence — decoding
 * only, never verification or key material handling.
 * @param {string} token Compact JWT string.
 * @returns {{parts: number, wellFormed: boolean, header: object|null, payload: object|null, signaturePresent: boolean, error: string|null}}
 */
export function decodeJwtStructure(token) {
  const bad = { parts: 0, wellFormed: false, header: null, payload: null, signaturePresent: false, error: 'not a string' };
  if (!token || typeof token !== 'string') return bad;
  const parts = token.split('.');
  if (parts.length < 2 || parts.length > 3) {
    return { ...bad, parts: parts.length, error: `expected 2-3 dot-separated segments, got ${parts.length}` };
  }
  const header = decodeBase64UrlSegment(parts[0]);
  const payload = decodeBase64UrlSegment(parts[1]);
  if (!header || typeof header !== 'object' || !payload || typeof payload !== 'object') {
    return { ...bad, parts: parts.length, error: 'header or payload is not valid base64url JSON' };
  }
  return {
    parts: parts.length,
    wellFormed: true,
    header,
    payload,
    signaturePresent: parts.length === 3 && parts[2].length > 0,
    error: null,
  };
}

/**
 * Extract issuer-relevant claims from a decoded payload.
 * @param {object} payload Decoded JWT payload.
 * @returns {{iss: string|null, aud: *, azp: string|null, sub: string|null, iat: number|null, exp: number|null}}
 */
export function extractJwtIssuerClaims(payload) {
  const p = payload && typeof payload === 'object' ? payload : {};
  return {
    iss: typeof p.iss === 'string' ? p.iss : null,
    aud: p.aud !== undefined ? p.aud : null,
    azp: typeof p.azp === 'string' ? p.azp : null,
    sub: typeof p.sub === 'string' ? p.sub : null,
    iat: typeof p.iat === 'number' ? p.iat : null,
    exp: typeof p.exp === 'number' ? p.exp : null,
  };
}

/**
 * Map an issuer URL to a known authentication provider.
 * @param {string|null} iss Issuer claim value.
 * @returns {{provider: string, confidence: string}|null}
 */
export function matchIssuerProvider(iss) {
  if (!iss || typeof iss !== 'string') return null;
  const lower = iss.toLowerCase();
  for (const entry of ISSUER_PROVIDERS) {
    if (lower.includes(entry.match)) return { provider: entry.provider, confidence: entry.confidence };
  }
  return null;
}

/**
 * Analyze the JWT header's algorithm and key-id conventions.
 * @param {object} header Decoded JWT header.
 * @returns {{alg: string|null, algFamily: string|null, kidPresent: boolean, kidShape: string|null, typ: string|null, notes: string[]}}
 */
export function analyzeJwtHeader(header) {
  const h = header && typeof header === 'object' ? header : {};
  const alg = typeof h.alg === 'string' ? h.alg : null;
  const kid = typeof h.kid === 'string' ? h.kid : null;
  const notes = [];
  let algFamily = null;
  if (alg) {
    if (/^RS|^PS/.test(alg)) algFamily = 'RSA (asymmetric — typical of enterprise IdPs)';
    else if (/^ES/.test(alg)) algFamily = 'ECDSA (asymmetric)';
    else if (/^Ed/.test(alg)) algFamily = 'EdDSA (asymmetric)';
    else if (/^HS/.test(alg)) algFamily = 'HMAC (symmetric — typical of custom services)';
    else if (alg.toLowerCase() === 'none') algFamily = 'none';
    if (alg.toLowerCase() === 'none') notes.push('alg=none: unsigned token accepted — critical hardening finding in an authorized test');
  }
  let kidShape = null;
  if (kid) {
    if (/^[0-9a-f-]{36}$/i.test(kid)) kidShape = 'uuid';
    else if (/^[A-Za-z0-9_-]{20,}$/.test(kid)) kidShape = 'opaque-id';
    else kidShape = 'other';
  }
  return { alg, algFamily, kidPresent: kid !== null, kidShape, typ: typeof h.typ === 'string' ? h.typ : null, notes };
}

/**
 * Full fingerprint: decode the token, identify the provider from issuer
 * claims, and characterize the header conventions.
 * @param {string} token Compact JWT string observed during an authorized engagement.
 * @returns {{
 *   wellFormed: boolean, error: string|null, provider: {provider: string, confidence: string}|null,
 *   claims: object, headerAnalysis: object, lifetimeSeconds: number|null, observations: string[]
 * }}
 */
export function fingerprintJwtProvider(token) {
  const decoded = decodeJwtStructure(token);
  if (!decoded.wellFormed) {
    return {
      wellFormed: false, error: decoded.error, provider: null,
      claims: {}, headerAnalysis: {}, lifetimeSeconds: null,
      observations: ['token is not a well-formed JWT'],
    };
  }
  const claims = extractJwtIssuerClaims(decoded.payload);
  const provider = matchIssuerProvider(claims.iss);
  const headerAnalysis = analyzeJwtHeader(decoded.header);
  const observations = [...headerAnalysis.notes];
  if (provider) observations.push(`issuer matches known provider: ${provider.provider}`);
  else if (claims.iss) observations.push('issuer URL does not match a known provider — likely a custom IdP');
  else observations.push('no iss claim — token carries no issuer identity');
  if (!decoded.signaturePresent) observations.push('no signature segment present');
  let lifetimeSeconds = null;
  if (claims.iat != null && claims.exp != null && claims.exp > claims.iat) {
    lifetimeSeconds = claims.exp - claims.iat;
    if (lifetimeSeconds > 86400) observations.push(`long token lifetime (${Math.round(lifetimeSeconds / 3600)}h) — extended replay window`);
  }
  return {
    wellFormed: true, error: null, provider, claims,
    headerAnalysis, lifetimeSeconds, observations,
  };
}
