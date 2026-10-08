/**
 * changePasswordDiscovery.js — .well-known/change-password discovery (idea 00112).
 *
 * Probing /.well-known/change-password reveals where password-change flows
 * redirect, which maps the identity-provider (IdP) hosts an organization uses
 * (Okta, Auth0, Entra, self-hosted IAM...). The redirect chain and final host
 * are the product; this module interprets recorded probe responses.
 */

/**
 * Extract the host of the identity provider from a recorded redirect chain.
 * @param {object} probe — { url, status, redirects: [{status, location}...], finalUrl }
 * @returns {{ found: boolean, idpHost: string|null, idpVendor: string, chain: string[], notes: string[] }}
 */
export function interpretChangePasswordProbe(probe = {}) {
  const notes = [];
  const redirects = Array.isArray(probe.redirects) ? probe.redirects : [];
  const chain = [probe.url, ...redirects.map(r => r.location), probe.finalUrl].filter(Boolean);

  if (!chain.length) {
    return {
      found: false,
      idpHost: null,
      idpVendor: 'unknown',
      chain: [],
      notes: ['Empty probe result'],
    };
  }

  const finalUrl = probe.finalUrl || probe.url || '';
  let idpHost = null;
  try {
    idpHost = new URL(finalUrl).hostname;
  } catch {
    notes.push('Final URL is not parseable — host unknown');
  }

  const startHost = (() => {
    try {
      return new URL(probe.url).hostname;
    } catch {
      return null;
    }
  })();

  let idpVendor = 'unknown';
  if (idpHost) {
    const h = idpHost.toLowerCase();
    if (h.includes('okta')) idpVendor = 'Okta';
    else if (h.includes('auth0')) idpVendor = 'Auth0';
    else if (h.includes('microsoftonline') || h.includes('login.microsoft'))
      idpVendor = 'Microsoft Entra ID';
    else if (h.includes('accounts.google')) idpVendor = 'Google Workspace';
    else if (h.includes('keycloak') || h.includes('sso') || h.includes('iam') || h.includes('idp'))
      idpVendor = 'Self-hosted IAM (heuristic)';
    else if (startHost && h !== startHost) idpVendor = 'Third-party IdP (unrecognized vendor)';
    else idpVendor = 'Same-host password flow';
  }

  if (redirects.length === 0 && probe.status === 200) {
    notes.push('No redirect — password change served on the target host itself');
  } else if (idpHost && startHost && idpHost !== startHost) {
    notes.push(`Password flow leaves the target domain → identity provider host: ${idpHost}`);
  }

  return {
    found: true,
    idpHost,
    idpVendor,
    chain,
    notes,
  };
}

/**
 * Canonical probe URL for a target.
 * @param {string} base — e.g. "https://example.com"
 * @returns {string}
 */
export function changePasswordUrl(base) {
  const u = new URL(String(base));
  return `${u.origin}/.well-known/change-password`;
}

export const CHANGE_PASSWORD_DISCOVERY = { interpretChangePasswordProbe, changePasswordUrl };
export default CHANGE_PASSWORD_DISCOVERY;
