/**
 * wave107CCores.js — Idea 54261–54270: per-target risk scoring factors.
 *
 * While backend/src/engines/riskScorer.js scores individual FINDINGS (0–10 CVSS-style),
 * this module scores the TARGET itself: every factor below contributes 0–10 points
 * toward a target's priority score. The Explainer (idea 54270) turns a factors map
 * into a transparent { total, parts } breakdown.
 *
 * All functions are pure, deterministic, plain-object in/out.
 */

export const WAVE107_C_IDEAS = [
  { id: 54261, title: 'Finding history factor' },
  { id: 54262, title: 'Change velocity factor' },
  { id: 54263, title: 'Authentication complexity factor' },
  { id: 54264, title: 'API richness factor' },
  { id: 54265, title: 'Third-party risk factor' },
  { id: 54266, title: 'Certificate hygiene factor' },
  { id: 54267, title: 'Security header factor' },
  { id: 54268, title: 'Subdomain sprawl factor' },
  { id: 54269, title: 'Cloud footprint factor' },
  { id: 54270, title: 'Score breakdown explainer' },
];

const clamp10 = n => Math.max(0, Math.min(10, Math.round(n * 10) / 10));
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

/**
 * 54261 — Finding history factor.
 * Rewards targets with past valid findings as proven productive ground.
 * @param {Object} history { validFindings, totalFindings, pastHunts }
 * @returns {number} 0–10
 */
export function findingHistoryFactor(history = {}) {
  const valid = num(history.validFindings);
  const total = num(history.totalFindings);
  const hunts = num(history.pastHunts);
  if (hunts === 0 && total === 0) return 0;
  const productivity = total > 0 ? valid / total : 0; // 0–1 signal rate
  const volume = Math.min(1, valid / 5); // saturates at 5+ valid findings
  const repeatBonus = hunts > 1 && valid > 0 ? 0.5 : 0;
  return clamp10(10 * (0.55 * productivity + 0.35 * volume + 0.1 * repeatBonus));
}

/**
 * 54262 — Change velocity factor.
 * Scores fast-changing targets higher since churn introduces fresh bugs.
 * @param {Object} velocity { deploysPerWeek, newEndpoints, diffLines }
 * @returns {number} 0–10
 */
export function changeVelocityFactor(velocity = {}) {
  const deploys = Math.min(1, num(velocity.deploysPerWeek) / 10);
  const endpoints = Math.min(1, num(velocity.newEndpoints) / 20);
  const diff = Math.min(1, num(velocity.diffLines) / 5000);
  return clamp10(10 * (0.4 * deploys + 0.35 * endpoints + 0.25 * diff));
}

/**
 * 54263 — Authentication complexity factor.
 * Accounts for multi-role, SSO, and OAuth surfaces that hide logic flaws.
 * @param {Object} auth { roles, ssoProviders, oauthClients, mfaModes }
 * @returns {number} 0–10
 */
export function authComplexityFactor(auth = {}) {
  const roles = Math.min(1, num(auth.roles) / 6);
  const sso = Math.min(1, num(auth.ssoProviders) / 3);
  const oauth = Math.min(1, num(auth.oauthClients) / 5);
  const mfa = Math.min(1, num(auth.mfaModes) / 3);
  return clamp10(10 * (0.3 * roles + 0.3 * sso + 0.25 * oauth + 0.15 * mfa));
}

/**
 * 54264 — API richness factor.
 * Weighs GraphQL, REST breadth, and undocumented endpoints in the score.
 * @param {Object} api { graphqlOps, restEndpoints, undocumentedEndpoints }
 * @returns {number} 0–10
 */
export function apiRichnessFactor(api = {}) {
  const graphql = Math.min(1, num(api.graphqlOps) / 40);
  const rest = Math.min(1, num(api.restEndpoints) / 200);
  // Undocumented endpoints weigh double — they rarely see security review.
  const undoc = Math.min(1, num(api.undocumentedEndpoints) / 50);
  return clamp10(10 * (0.3 * graphql + 0.35 * rest + 0.35 * undoc));
}

/**
 * 54265 — Third-party risk factor.
 * Penalizes heavy third-party script and integration sprawl.
 * @param {Object} tps { scripts, integrations, adTrackers }
 * @returns {number} 0–10
 */
export function thirdPartyRiskFactor(tps = {}) {
  const scripts = Math.min(1, num(tps.scripts) / 30);
  const integrations = Math.min(1, num(tps.integrations) / 15);
  const trackers = Math.min(1, num(tps.adTrackers) / 10);
  return clamp10(10 * (0.45 * scripts + 0.35 * integrations + 0.2 * trackers));
}

/**
 * 54266 — Certificate hygiene factor.
 * Adjusts scores based on chain validity, expiry handling, and issuer reputation.
 * Clean chains contribute 0; problems add points up to 10.
 * @param {Object} cert { chainValid, daysToExpiry, issuerReputation } issuerReputation: 0–1
 * @returns {number} 0–10
 */
export function certificateHygieneFactor(cert = {}) {
  let points = 0;
  if (cert.chainValid === false) points += 5;
  const days = num(cert.daysToExpiry, 365);
  if (days < 0) points += 5; // expired
  else if (days < 7) points += 3; // expiring within a week
  else if (days < 30) points += 1.5; // expiring within a month
  const rep = Number(cert.issuerReputation);
  if (Number.isFinite(rep) && rep < 0.5) points += (0.5 - rep) * 4;
  return clamp10(points);
}

/**
 * 54267 — Security header factor.
 * Adjusts scores based on missing or misconfigured protective headers.
 * @param {Object} headers Map of header name → value (name casing normalized internally)
 * @returns {number} 0–10
 */
export function securityHeaderFactor(headers = {}) {
  const lower = {};
  for (const [k, v] of Object.entries(headers)) lower[String(k).toLowerCase()] = v;
  let points = 0;
  if (!lower['content-security-policy']) points += 2.5;
  if (!lower['strict-transport-security']) points += 2.5;
  if (!lower['x-frame-options'] && !/frame-ancestors/i.test(String(lower['content-security-policy'] || '')))
    points += 1.5;
  if (!lower['x-content-type-options']) points += 1;
  if (!lower['referrer-policy']) points += 0.75;
  if (!lower['permissions-policy']) points += 0.75;
  const hsts = String(lower['strict-transport-security'] || '');
  if (hsts && !/max-age=([5-9]\d{4}|\d{5,})/.test(hsts)) points += 1; // weak max-age
  return clamp10(points);
}

/**
 * 54268 — Subdomain sprawl factor.
 * Weighs unmanaged-looking subdomain counts as increased takeover/exposure risk.
 * @param {Object} sprawl { total, unmanaged, dangling }
 * @returns {number} 0–10
 */
export function subdomainSprawlFactor(sprawl = {}) {
  const total = Math.min(1, num(sprawl.total) / 200);
  const unmanaged = Math.min(1, num(sprawl.unmanaged) / 50);
  // Dangling DNS records weigh double — direct takeover material.
  const dangling = Math.min(1, num(sprawl.dangling) / 10);
  return clamp10(10 * (0.25 * total + 0.35 * unmanaged + 0.4 * dangling));
}

/**
 * 54269 — Cloud footprint factor.
 * Scores targets with broad cloud asset exposure higher for misconfiguration likelihood.
 * @param {Object} cloud { buckets, functions, publicIps, misconfigs }
 * @returns {number} 0–10
 */
export function cloudFootprintFactor(cloud = {}) {
  const buckets = Math.min(1, num(cloud.buckets) / 20);
  const functions = Math.min(1, num(cloud.functions) / 50);
  const ips = Math.min(1, num(cloud.publicIps) / 100);
  const misconfigs = Math.min(1, num(cloud.misconfigs) / 10);
  return clamp10(10 * (0.25 * buckets + 0.2 * functions + 0.2 * ips + 0.35 * misconfigs));
}

const FACTOR_TITLES = {
  findingHistory: 'Finding history factor',
  changeVelocity: 'Change velocity factor',
  authComplexity: 'Authentication complexity factor',
  apiRichness: 'API richness factor',
  thirdPartyRisk: 'Third-party risk factor',
  certificateHygiene: 'Certificate hygiene factor',
  securityHeader: 'Security header factor',
  subdomainSprawl: 'Subdomain sprawl factor',
  cloudFootprint: 'Cloud footprint factor',
};

/**
 * 54270 — Score breakdown explainer.
 * Shows exactly which factors contributed how many points to every score.
 * @param {Object} factors { factorKey: { points, reason } }
 * @returns {{ total: number, parts: Array<{factor, points, reason}> }}
 */
export function explainScoreBreakdown(factors = {}) {
  const parts = [];
  for (const [key, entry] of Object.entries(factors)) {
    const points = clamp10(num(entry && entry.points));
    parts.push({
      factor: FACTOR_TITLES[key] || key,
      points,
      reason: entry && entry.reason ? String(entry.reason) : 'No reason provided.',
    });
  }
  parts.sort((a, b) => b.points - a.points);
  // Total sums all factor contributions (up to 9 x 10) — only floor at 0.
  const total = Math.max(0, Math.round(parts.reduce((sum, p) => sum + p.points, 0) * 10) / 10);
  return { total, parts };
}

/**
 * Convenience: score a whole target profile in one call.
 * @param {Object} profile { history, velocity, auth, api, thirdParty, cert, headers, sprawl, cloud }
 * @returns {{ total: number, parts: Array }}
 */
export function scoreTarget(profile = {}) {
  return explainScoreBreakdown({
    findingHistory: { points: findingHistoryFactor(profile.history), reason: 'Past valid findings on this target.' },
    changeVelocity: { points: changeVelocityFactor(profile.velocity), reason: 'Code/endpoint churn rate.' },
    authComplexity: { points: authComplexityFactor(profile.auth), reason: 'Roles, SSO, and OAuth surface.' },
    apiRichness: { points: apiRichnessFactor(profile.api), reason: 'GraphQL/REST breadth and undocumented endpoints.' },
    thirdPartyRisk: { points: thirdPartyRiskFactor(profile.thirdParty), reason: 'Third-party script and integration sprawl.' },
    certificateHygiene: { points: certificateHygieneFactor(profile.cert), reason: 'Chain validity, expiry, and issuer reputation.' },
    securityHeader: { points: securityHeaderFactor(profile.headers), reason: 'Missing or misconfigured protective headers.' },
    subdomainSprawl: { points: subdomainSprawlFactor(profile.sprawl), reason: 'Unmanaged and dangling subdomains.' },
    cloudFootprint: { points: cloudFootprintFactor(profile.cloud), reason: 'Cloud asset exposure and known misconfigs.' },
  });
}
