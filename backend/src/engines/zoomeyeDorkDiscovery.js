/**
 * zoomeyeDorkDiscovery.js — ZoomEye dork-driven discovery.
 *
 * Idea 00387: run ZoomEye dorks for the target's tech stack to find unlisted
 * deployments.
 *
 * No network calls and no API keys: the module builds ZoomEye search dorks
 * from a tech-stack fingerprint (products, versions, header markers) plus the
 * engagement scope, and correlates operator-supplied ZoomEye response objects
 * into candidate unlisted deployments ranked by stack-match strength.
 */

function q(token) {
  return String(token).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * @typedef {Object} StackFingerprint
 * @property {string} product - e.g. 'nginx'.
 * @property {string} [version] - e.g. '1.24.0'.
 * @property {string} [titleMarker] - Distinctive <title> substring.
 * @property {string} [headerMarker] - Distinctive Server/X-Powered-By value.
 * @property {string} [bodyMarker] - Distinctive body substring.
 */

/**
 * Build ZoomEye dorks for a tech stack within scope.
 * @param {StackFingerprint[]} stack
 * @param {{cidrs?: string[], org?: string, country?: string, facets?: string[]}} scope
 * @returns {{dorks: {label: string, dork: string}[]}}
 */
export function buildZoomEyeDorks(stack = [], scope = {}) {
  const { cidrs = [], org = '', country = '' } = scope;
  const scopeParts = [
    ...cidrs.map((c) => `cidr:"${q(c)}"`),
    org ? `org:"${q(org)}"` : '',
    country ? `country:"${q(country)}"` : '',
  ].filter(Boolean);
  const scopeSuffix = scopeParts.length ? ` ${scopeParts.join(' ')}` : '';

  const dorks = [];
  for (const fp of stack) {
    if (!fp || !fp.product) continue;
    const bits = [`app:"${q(fp.product)}"`];
    if (fp.version) bits.push(`ver:"${q(fp.version)}"`);
    if (fp.titleMarker) bits.push(`title:"${q(fp.titleMarker)}"`);
    if (fp.headerMarker) bits.push(`headers:"${q(fp.headerMarker)}"`);
    if (fp.bodyMarker) bits.push(`"${q(fp.bodyMarker)}"`);
    dorks.push({
      label: `stack:${fp.product}${fp.version ? '@' + fp.version : ''}`,
      dork: `${bits.join(' ')}${scopeSuffix}`,
    });
  }
  // Deployment-hygiene dorks that catch unlisted/staging instances of the stack.
  const productTerms = stack.map((f) => f.product).filter(Boolean);
  if (productTerms.length) {
    const term = productTerms.map((p) => `"${q(p)}"`).join(' ');
    dorks.push({ label: 'hygiene:default-title', dork: `title:"Welcome" ${term}${scopeSuffix}`.trim() });
    dorks.push({ label: 'hygiene:staging-subdomain', dork: `hostname:"staging" ${term}${scopeSuffix}`.trim() });
  }
  return { dorks };
}

/**
 * Rank one ZoomEye result record against the stack fingerprint.
 * ZoomEye result shape: {ip, port, hostname, app, version, title, headers, ...}.
 * @param {object} record
 * @param {StackFingerprint[]} stack
 * @returns {{score: number, matchedStack: string[], confidence: 'high'|'medium'|'low'}}
 */
export function rankZoomEyeRecord(record = {}, stack = []) {
  let score = 0;
  const matchedStack = [];
  const lc = (v) => String(v || '').toLowerCase();
  for (const fp of stack) {
    if (!fp || !fp.product) continue;
    let part = 0;
    if (lc(record.app).includes(lc(fp.product))) part += 3;
    if (fp.version && lc(record.version).includes(lc(fp.version))) part += 2;
    if (fp.titleMarker && lc(record.title).includes(lc(fp.titleMarker))) part += 2;
    if (fp.headerMarker && lc(record.headers).includes(lc(fp.headerMarker))) part += 2;
    if (fp.bodyMarker && lc(record.body).includes(lc(fp.bodyMarker))) part += 1;
    if (part > 0) {
      score += part;
      matchedStack.push(`${fp.product}${fp.version ? '@' + fp.version : ''}`);
    }
  }
  const confidence = score >= 6 ? 'high' : score >= 3 ? 'medium' : 'low';
  return { score, matchedStack, confidence };
}

/**
 * Correlate ZoomEye results into candidate unlisted deployments.
 * @param {object[]} records - Raw ZoomEye result objects.
 * @param {StackFingerprint[]} stack
 * @param {{minScore?: number, knownIps?: string[]}} [options]
 */
export function discoverZoomEyeHosts(records = [], stack = [], options = {}) {
  const { minScore = 3, knownIps = [] } = options;
  const known = new Set(knownIps.map(String));
  const candidates = [];
  for (const rec of records) {
    if (!rec || !rec.ip) continue;
    const { score, matchedStack, confidence } = rankZoomEyeRecord(rec, stack);
    if (score < minScore) continue;
    candidates.push({
      kind: 'candidate-deployment',
      id: `zoomeye:${rec.ip}:${rec.port || 0}`,
      ip: rec.ip,
      port: rec.port ?? null,
      hostname: rec.hostname || null,
      title: rec.title || null,
      app: rec.app || null,
      version: rec.version || null,
      matchedStack,
      score,
      confidence,
      alreadyKnown: known.has(String(rec.ip)),
      evidence: `ZoomEye record for ${rec.ip} matches stack fingerprint ` +
        `(${matchedStack.join(', ') || 'none'}) with score ${score}.`,
    });
  }
  candidates.sort((a, b) => b.score - a.score);
  return {
    candidates,
    unlisted: candidates.filter((c) => !c.alreadyKnown),
    stats: {
      records: records.length,
      candidates: candidates.length,
      unlisted: candidates.filter((c) => !c.alreadyKnown).length,
      highConfidence: candidates.filter((c) => c.confidence === 'high').length,
    },
  };
}

/**
 * Build a report finding from the discovery result.
 * @param {ReturnType<typeof discoverZoomEyeHosts>} result
 */
export function zoomeyeFinding(result) {
  return {
    title: `ZoomEye dork-driven discovery — ${result.stats.unlisted} unlisted candidate deployment(s)`,
    severity: result.stats.highConfidence ? 'Low' : 'Info',
    confidence: result.stats.candidates >= 2 ? 'high' : 'medium',
    stats: result.stats,
    topCandidates: result.unlisted.slice(0, 15).map((c) => ({
      ip: c.ip, port: c.port, hostname: c.hostname, app: c.app, score: c.score, confidence: c.confidence,
    })),
    evidence: `${result.stats.records} ZoomEye record(s) ranked; ` +
      `${result.stats.unlisted} not present in the operator's known asset list.`,
  };
}

export const ZOOMEYE_DORK_DISCOVERY = { buildZoomEyeDorks, rankZoomEyeRecord, discoverZoomEyeHosts, zoomeyeFinding };
export default ZOOMEYE_DORK_DISCOVERY;
