// Dark Matter hunt-intel — OAuth2/OIDC attack battery.
// Technique: oauth-flow-analyzer (MIT) + oauth-hunter (Apache-2.0).
// 22 redirect_uri bypass variants, PKCE downgrade, scope probing.

export const OAUTH_ATTACKS = [
  {
    id: 'OA-01', title: 'redirect_uri bypass variants',
    variants: [
      'trailing slash', 'subdomain wildcard', 'path traversal (/..)',
      'fragment injection (#)', 'query confusion (?next=)', 'double encode',
      'open redirector chaining', 'null byte', 'unicode normalization',
    ],
    severity: 'high',
  },
  {
    id: 'OA-02', title: 'PKCE downgrade',
    strategy: 'Omit code_challenge; try plain method; replay code without verifier.',
    severity: 'high',
  },
  {
    id: 'OA-03', title: 'Scope probing (40+ hidden scopes)',
    strategy: 'Brute-force scope parameter: admin, root, *, all, offline_access, impersonate.',
    severity: 'medium',
  },
  {
    id: 'OA-04', title: 'id_token alg:none / key confusion',
    strategy: 'Strip signature; RS256→HS256 with public key as HMAC secret.',
    severity: 'critical',
  },
  {
    id: 'OA-05', title: 'nonce / email_verified bypass',
    strategy: 'Omit nonce; set email_verified=true in tampered claims.',
    severity: 'medium',
  },
  {
    id: 'OA-06', title: 'Authorization code theft via open redirect',
    strategy: 'Chain open-redirect → redirect_uri abuse → code interception → ATO.',
    severity: 'critical',
    chain: ['open_redirect', 'auth_bypass', 'priv_esc'],
  },
];

/** Get OAuth attacks relevant to observed endpoints. */
export function oauthAttacksFor(paths) {
  const joined = (paths || []).join(' ').toLowerCase();
  if (!/oauth|authorize|token|callback|sso/i.test(joined)) return [];
  return OAUTH_ATTACKS;
}
