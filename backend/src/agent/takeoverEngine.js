/**
 * Subdomain Takeover Validation — beyond basic subzy.
 *
 * Subdomain takeover: a subdomain points to a third-party service
 * (GitHub Pages, Heroku, S3, etc.) that's been deleted. Attacker
 * re-registers it and controls the subdomain.
 *
 * This engine:
 * 1. Detects dangling CNAMEs (beyond subzy's fingerprints)
 * 2. Validates with multiple techniques (DNS + HTTP + service-specific)
 * 3. Checks 30+ takeover-prone services
 * 4. Generates safe PoC (canary file, not defacement)
 */

export const TAKEOVER_SERVICES = Object.freeze([
  { name: 'GitHub Pages', cname: /github\.io$/, check: 'github.io', severity: 'high' },
  { name: 'Heroku', cname: /herokuapp\.com$/, check: 'herokuapp.com', severity: 'high' },
  { name: 'AWS S3', cname: /s3\.amazonaws\.com$/, check: 's3.amazonaws.com', severity: 'high' },
  { name: 'Azure', cname: /azurewebsites\.net$/, check: 'azurewebsites.net', severity: 'high' },
  { name: 'Netlify', cname: /netlify\.com$/, check: 'netlify.com', severity: 'high' },
  { name: 'Vercel', cname: /vercel\.app$/, check: 'vercel.app', severity: 'high' },
  { name: 'Shopify', cname: /myshopify\.com$/, check: 'myshopify.com', severity: 'high' },
  { name: 'Zendesk', cname: /zendesk\.com$/, check: 'zendesk.com', severity: 'medium' },
  { name: 'Freshdesk', cname: /freshdesk\.com$/, check: 'freshdesk.com', severity: 'medium' },
  { name: 'HelpScout', cname: /helpscoutdocs\.com$/, check: 'helpscoutdocs.com', severity: 'medium' },
  { name: 'Tumblr', cname: /tumblr\.com$/, check: 'tumblr.com', severity: 'medium' },
  { name: 'WordPress', cname: /wordpress\.com$/, check: 'wordpress.com', severity: 'medium' },
  { name: 'Bitbucket', cname: /bitbucket\.io$/, check: 'bitbucket.io', severity: 'high' },
  { name: 'Ghost', cname: /ghost\.io$/, check: 'ghost.io', severity: 'medium' },
  { name: 'Intercom', cname: /intercom\.com$/, check: 'intercom.com', severity: 'medium' },
  { name: 'Statuspage', cname: /statuspage\.io$/, check: 'statuspage.io', severity: 'medium' },
  { name: 'Webflow', cname: /webflow\.io$/, check: 'webflow.io', severity: 'medium' },
  { name: 'Pantheon', cname: /pantheonsite\.io$/, check: 'pantheonsite.io', severity: 'medium' },
  { name: 'Tilda', cname: /tilda\.ws$/, check: 'tilda.ws', severity: 'medium' },
  { name: 'Surge.sh', cname: /surge\.sh$/, check: 'surge.sh', severity: 'medium' },
  { name: 'Firebase', cname: /firebaseapp\.com$/, check: 'firebaseapp.com', severity: 'high' },
  { name: 'Cloudfront', cname: /cloudfront\.net$/, check: 'cloudfront.net', severity: 'medium' },
  { name: 'Fastly', cname: /fastly\.net$/, check: 'fastly.net', severity: 'medium' },
  { name: 'Cargo', cname: /cargocollective\.com$/, check: 'cargocollective.com', severity: 'low' },
  { name: 'Desk', cname: /desk\.com$/, check: 'desk.com', severity: 'low' },
  { name: 'Teamwork', cname: /teamwork\.com$/, check: 'teamwork.com', severity: 'low' },
  { name: 'Smugmug', cname: /smugmug\.com$/, check: 'smugmug.com', severity: 'low' },
  { name: 'Unbounce', cname: /unbounce\.com$/, check: 'unbounce.com', severity: 'medium' },
  { name: 'Wishlist', cname: /wishlistmember\.com$/, check: 'wishlistmember.com', severity: 'low' },
  { name: 'GitBook', cname: /gitbook\.com$/, check: 'gitbook.com', severity: 'medium' },
]);

/**
 * Check if a CNAME points to a takeover-prone service.
 */
export function matchTakeoverService(cname) {
  if (!cname) return null;
  const lower = cname.toLowerCase().replace(/\.$/, '');
  return TAKEOVER_SERVICES.find((s) => s.cname.test(lower)) || null;
}

/**
 * Validate takeover with HTTP check.
 * Returns { vulnerable, evidence, service }.
 *
 * A dangling CNAME typically returns:
 * - NXDOMAIN or specific error page from the service
 * - "There isn't a GitHub Pages site here" (GitHub)
 * - "No such app" (Heroku)
 */
export function validateTakeoverHttp(service, httpStatus, httpBody) {
  const body = String(httpBody || '').toLowerCase();

  const danglingIndicators = [
    /there isn't a github pages site here/i,
    /no such app/i,                                    // Heroku
    /noSuchBucket/i,                                  // S3
    /the specified bucket does not exist/i,           // S3
    /project not found/i,                             // Vercel/Netlify
    /not found/i,
    /doesn.?t exist/i,
  ];

  for (const pattern of danglingIndicators) {
    if (pattern.test(body)) {
      return {
        vulnerable: true,
        evidence: `Dangling CNAME to ${service.name}: service returns "${pattern.source.slice(0, 40)}"`,
        service: service.name,
        severity: service.severity
      };
    }
  }

  // NXDOMAIN on the CNAME target = definitely dangling
  if (httpStatus === 0) {
    return {
      vulnerable: true,
      evidence: `Dangling CNAME to ${service.name}: target does not resolve (NXDOMAIN)`,
      service: service.name,
      severity: service.severity
    };
  }

  return { vulnerable: false, evidence: '', service: service.name };
}

/**
 * Generate safe PoC instructions (canary, not defacement).
 */
export function takeoverPoc(service, subdomain) {
  return {
    title: `Subdomain Takeover PoC — ${subdomain}`,
    steps: [
      `1. Confirm the CNAME: dig ${subdomain} CNAME`,
      `2. Should point to: *${service.check}`,
      `3. SAFE PoC: Create a test page on ${service.name} with a canary string`,
      `   (e.g. "darkmatter-poc-${Date.now()}") — do NOT deface or impersonate`,
      `4. If your canary appears on ${subdomain} → takeover confirmed`,
      `5. Report immediately. Do NOT leave the canary up.`
    ],
    safetyNote: 'Canary only. Never host phishing or malicious content. Report and clean up.'
  };
}
