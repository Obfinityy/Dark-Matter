/**
 * takeoverChecker.js — Subdomain takeover detector.
 *
 * Checks if a subdomain points to a third-party service that has been
 * deprovisioned (GitHub Pages, Heroku, AWS S3, etc.) — classic takeover.
 */

const TAKEOVER_SIGNATURES = [
  {
    service: 'GitHub Pages',
    cname: /github\.io$/i,
    fingerprint: /There isn't a GitHub Pages site here/i,
  },
  {
    service: 'Heroku',
    cname: /herokudns\.com$/i,
    fingerprint: /No such app/i,
  },
  {
    service: 'AWS S3',
    cname: /s3\.amazonaws\.com$/i,
    fingerprint: /NoSuchBucket/i,
  },
  {
    service: 'Shopify',
    cname: /myshopify\.com$/i,
    fingerprint: /Sorry, this shop is currently unavailable/i,
  },
  {
    service: 'Tumblr',
    cname: /domains\.tumblr\.com$/i,
    fingerprint: /Whatever you were looking for doesn't currently exist/i,
  },
  {
    service: 'WordPress',
    cname: /wordpress\.com$/i,
    fingerprint: /Do you want to register/i,
  },
];

/**
 * Check a subdomain for takeover. Needs CNAME + HTTP body.
 * @param {{subdomain, cname, httpBody, httpStatus}} input
 */
export function checkTakeover({ subdomain, cname = '', httpBody = '', httpStatus = 0 }) {
  for (const sig of TAKEOVER_SIGNATURES) {
    if (sig.cname.test(cname)) {
      if (sig.fingerprint.test(httpBody)) {
        return {
          vulnerable: true,
          type: 'Subdomain Takeover',
          severity: 'High',
          confidence: 'high',
          cwe: 'CWE-350',
          evidence: `${subdomain} CNAME → ${sig.service}, but service returns deprovisioned fingerprint.`,
          service: sig.service,
        };
      }
      return {
        vulnerable: false,
        reason: `${sig.service} CNAME but no takeover fingerprint — likely still claimed.`,
        service: sig.service,
      };
    }
  }
  return { vulnerable: false, reason: 'No known takeover signature matched' };
}

export const TAKEOVER_CHECKER = { checkTakeover, TAKEOVER_SIGNATURES };
export default TAKEOVER_CHECKER;
