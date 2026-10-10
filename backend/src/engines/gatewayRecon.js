/**
 * gatewayRecon.js — API-gateway reconnaissance probe builders and response
 * analyzers for an authorized bug-bounty agent.
 *
 * Idea 01131: Trailing-slash normalization differential — probe redirect vs
 * direct-serve behavior for /path vs /path/ because normalization mismatches
 * between gateway and backend bypass path-based access rules.
 *
 * Idea 01132: API gateway fingerprinting — identify Kong, Apigee, AWS API
 * Gateway, Azure APIM, Tyk, Traefik and Envoy via response headers because
 * the gateway identity reveals known path-normalization quirks to probe.
 *
 * Idea 01133: Kong Admin API exposure check — probe port 8001 and /admin
 * paths because an exposed Kong admin API allows full route reconfiguration.
 *
 * Idea 01134: AWS API Gateway stage enumeration — brute-force stage names
 * (dev, staging, prod, v1, ...) because stages frequently carry different
 * auth settings than production.
 *
 * Idea 01135: Azure APIM developer portal check — fetch the developer portal
 * and its API listings because APIM portals document products, subscriptions
 * and sometimes sample keys.
 *
 * Idea 01136: APIM management API probe — test management.azure.com-style
 * paths because exposed management APIs leak subscription keys.
 *
 * Idea 01137: Tyk gateway discovery — probe Tyk-specific headers and /tyk/
 * paths because Tyk gateways expose key and policy APIs when misconfigured.
 *
 * Idea 01138: Traefik dashboard API check — request /dashboard and
 * /api/rawdata because exposed Traefik dashboards reveal routers, services
 * and middlewares.
 *
 * Idea 01139: Envoy admin interface probe — test /admin-style paths on edge
 * ports because the Envoy admin interface exposes config dumps and stats.
 *
 * Idea 01140: Gateway route-overlap detection — map overlapping route
 * patterns because the winning route may skip the auth the loser enforced.
 *
 * No network calls: every function builds ready-to-send probe descriptors
 * (method + URL + headers + what-response-signal-to-look-for) or analyzes
 * operator-supplied response records (status codes, headers, body text).
 * The agent's network layer performs the actual transport; this module
 * contains only the pure probe-building and classification logic.
 * Defensive surface mapping of the engagement's own authorized target only.
 */

const IDEAS = {
  '01131': 'Trailing-slash normalization differential',
  '01132': 'API gateway fingerprinting',
  '01133': 'Kong Admin API exposure check',
  '01134': 'AWS API Gateway stage enumeration',
  '01135': 'Azure APIM developer portal check',
  '01136': 'APIM management API probe',
  '01137': 'Tyk gateway discovery',
  '01138': 'Traefik dashboard API check',
  '01139': 'Envoy admin interface probe',
  '01140': 'Gateway route-overlap detection',
};

/**
 * Normalize a probe descriptor into a uniform shape so the agent's network
 * layer can serialize it.
 * @param {object} probe
 * @returns {{idea: string, label: string, method: string, url: string, headers: object, detect: string}}
 */
function normalizeProbe(probe = {}) {
  return {
    idea: String(probe.idea || ''),
    label: String(probe.label || ''),
    method: String(probe.method || 'GET').toUpperCase(),
    url: String(probe.url || ''),
    headers: probe.headers && typeof probe.headers === 'object' ? probe.headers : {},
    detect: String(probe.detect || ''),
  };
}

/**
 * Lowercase header keys for case-insensitive lookup; array values are joined.
 * @param {object} headers
 * @returns {object}
 */
function lowerHeaders(headers = {}) {
  const out = {};
  for (const [k, v] of Object.entries(headers || {})) {
    out[String(k).toLowerCase()] = Array.isArray(v) ? v.join('; ') : String(v);
  }
  return out;
}

/**
 * Clean a list of path-ish strings: trim, drop empties, dedupe.
 * @param {string[]} paths
 * @returns {string[]}
 */
function cleanPaths(paths) {
  const seen = new Set();
  const out = [];
  for (const p of Array.isArray(paths) ? paths : []) {
    const s = String(p || '').trim();
    if (s && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

/* ---------------------------------------------------------------------------
 * Idea 01131 — Trailing-slash normalization differential
 * ------------------------------------------------------------------------- */

/**
 * Build GET probe pairs for a path with and without a trailing slash so the
 * operator can compare redirect vs direct-serve behavior.
 * @param {string[]} paths e.g. ['/api/admin', '/api/users']
 * @returns {Array} probe descriptors, two per path (bare + trailing slash)
 */
export function buildTrailingSlashProbePairs(paths = []) {
  const out = [];
  for (const p of cleanPaths(paths)) {
    const bare = p.endsWith('/') && p.length > 1 ? p.slice(0, -1) : p;
    const slashed = `${bare}/`;
    out.push(
      normalizeProbe({
        idea: '01131',
        label: `Trailing-slash pair — bare variant of "${bare}"`,
        method: 'GET',
        url: bare,
        detect:
          'Compare status against the slashed twin: one side 301/302 to the other is a redirect normalization; ' +
          'divergent statuses (e.g. bare 404 while slashed 200, or bare 403 while slashed 200) flag a ' +
          'normalization mismatch that can bypass path-based access rules.',
      }),
      normalizeProbe({
        idea: '01131',
        label: `Trailing-slash pair — trailing-slash variant of "${bare}"`,
        method: 'GET',
        url: slashed,
        detect:
          'Compare status against the bare twin (see above). Note the Location target of any 3xx: ' +
          'a redirect that lands outside the authorized scope is itself a finding.',
      }),
    );
  }
  return out;
}

/**
 * Analyze operator-supplied response records for trailing-slash behavior.
 * Each record: { path, variant: 'bare'|'slashed', status, location?, bodyLength? }.
 * @param {object[]} records
 * @returns {{pairs: object[], mismatches: object[], findings: object[]}}
 */
export function analyzeTrailingSlashDifferential(records = []) {
  const byPath = new Map();
  for (const r of Array.isArray(records) ? records : []) {
    const path = String(r.path || '').trim();
    if (!path) continue;
    if (!byPath.has(path)) byPath.set(path, {});
    const bucket = byPath.get(path);
    if (r.variant === 'slashed') bucket.slashed = r;
    else bucket.bare = r;
  }
  const pairs = [];
  const mismatches = [];
  const findings = [];
  for (const [path, { bare, slashed }] of byPath) {
    const summary = {
      path,
      bareStatus: bare ? bare.status : null,
      slashedStatus: slashed ? slashed.status : null,
      behavior: 'unknown',
    };
    if (!bare || !slashed) {
      summary.behavior = 'incomplete';
      pairs.push(summary);
      continue;
    }
    const bareRedirect = bare.status >= 300 && bare.status < 400;
    const slashedRedirect = slashed.status >= 300 && slashed.status < 400;
    const redirectsToTwin = (rec, twin) =>
      rec.status >= 300 && rec.status < 400 && String(rec.location || '').replace(/\/$/, '') === twin.replace(/\/$/, '');
    if (redirectsToTwin(bare, `${path}/`) || redirectsToTwin(slashed, path)) {
      summary.behavior = 'redirect-normalization';
    } else if (bare.status === slashed.status) {
      summary.behavior = 'direct-serve-both';
    } else if (bareRedirect || slashedRedirect) {
      summary.behavior = 'redirect-elsewhere';
    } else {
      summary.behavior = 'differential';
      const mismatch = {
        path,
        bareStatus: bare.status,
        slashedStatus: slashed.status,
        type:
          (bare.status === 403 || bare.status === 401) && slashed.status === 200
            ? 'auth-bypass-candidate'
            : 'status-differential',
        evidence:
          `"${path}" returned ${bare.status} while "${path}/" returned ${slashed.status} — ` +
          'the gateway/backend disagree on trailing-slash normalization, so path-based rules may apply to only one variant.',
      };
      mismatches.push(mismatch);
      findings.push({
        type: 'trailing-slash-differential',
        severity: mismatch.type === 'auth-bypass-candidate' ? 'High' : 'Medium',
        confidence: 'medium',
        evidence: mismatch.evidence,
        recommendation:
          'Normalize trailing slashes BEFORE access rules on the authorized target (or apply rules to both variants), ' +
          'and confirm the flagged variant enforces the same authentication as its twin.',
      });
    }
    pairs.push(summary);
  }
  return { pairs, mismatches, findings };
}

/* ---------------------------------------------------------------------------
 * Idea 01132 — API gateway fingerprinting
 * ------------------------------------------------------------------------- */

/**
 * Data-driven gateway signature table. Each entry lists header checks that
 * must all match; `weight` ranks confidence when several entries match.
 * Tyk and Traefik do not advertise themselves in default response headers,
 * so their entries are marked `viaProbe` — identity comes from the 01137 /
 * 01138 probe families instead.
 */
export const GATEWAY_SIGNATURES = [
  {
    id: 'kong',
    name: 'Kong',
    weight: 3,
    headers: [
      { name: 'server', match: 'contains', value: 'kong' },
    ],
    alt: [
      { name: 'x-kong-request-id', match: 'present' },
      { name: 'x-kong-upstream-latency', match: 'present' },
      { name: 'via', match: 'contains', value: 'kong' },
    ],
    evidence: 'Kong markers: Server: kong/*, Via: kong/*, X-Kong-Request-Id, X-Kong-Upstream-Latency.',
    quirks: 'Kong route matching is prefix-based with regex support; check trailing-slash normalization and plugin ordering (auth plugin on the wrong route is a classic bypass).',
  },
  {
    id: 'apigee',
    name: 'Apigee',
    weight: 3,
    headers: [
      { name: 'server', match: 'contains', value: 'apigee' },
    ],
    alt: [
      { name: 'via', match: 'contains', value: 'apigee' },
    ],
    evidence: 'Apigee marker: Server: Apigee Router.',
    quirks: 'Apigee proxy paths normalize trailing slashes and collapse duplicate slashes before flow matching; test both variants against each conditional flow.',
  },
  {
    id: 'aws-apigateway',
    name: 'AWS API Gateway',
    weight: 3,
    headers: [
      { name: 'x-amzn-requestid', match: 'present' },
    ],
    alt: [
      { name: 'x-amz-apigw-id', match: 'present' },
      { name: 'x-amzn-remapped-connection', match: 'present' },
      { name: 'x-amzn-trace-id', match: 'present' },
    ],
    evidence: 'AWS API Gateway markers: x-amzn-RequestId, x-amz-apigw-id, x-amzn-Remapped-*, x-amzn-trace-id.',
    quirks: 'API Gateway stages can differ in auth and throttling; enumerate stages (idea 01134) and check greedy path variables ({proxy+}) that absorb auth-gated prefixes.',
  },
  {
    id: 'azure-apim',
    name: 'Azure API Management',
    weight: 3,
    headers: [
      { name: 'ocp-apim-trace-location', match: 'present' },
    ],
    alt: [
      { name: 'ocp-apim-subscription-key', match: 'present' },
      { name: 'request-context', match: 'contains', value: 'appId=' },
    ],
    evidence: 'Azure APIM markers: Ocp-Apim-Trace-Location, Ocp-Apim-Subscription-Key, request-context appId.',
    quirks: 'APIM products/policies are per-API; check the developer portal (01135) and management API (01136) for subscription-key leakage, and test subscription-key vs JWT policy differences per API.',
  },
  {
    id: 'envoy',
    name: 'Envoy',
    weight: 2,
    headers: [
      { name: 'server', match: 'equals', value: 'envoy' },
    ],
    alt: [
      { name: 'x-envoy-upstream-service-time', match: 'present' },
    ],
    evidence: 'Envoy markers: Server: envoy, x-envoy-upstream-service-time.',
    quirks: 'Envoy normalizes paths (merge slashes, strip trailing dot) before route matching; test dot-segment and encoded-slash variants against route tables.',
  },
  {
    id: 'tyk',
    name: 'Tyk',
    weight: 1,
    viaProbe: true,
    headers: [],
    alt: [],
    evidence: 'Tyk does not reliably advertise via response headers; identity is established by the 01137 discovery probes (/tyk/*, /hello returning "Tyk GW").',
    quirks: 'Tyk API definitions carry per-listen-path auth; overlapping listen paths with different auth modes are the prime bypass candidate.',
  },
  {
    id: 'traefik',
    name: 'Traefik',
    weight: 1,
    viaProbe: true,
    headers: [],
    alt: [],
    evidence: 'Traefik does not advertise via default response headers; identity is established by the 01138 dashboard probes (/dashboard, /api/rawdata).',
    quirks: 'Traefik router priority decides the winning route; overlapping Host/Path rules with different middlewares (auth) are the prime bypass candidate.',
  },
];

/**
 * Test one header check against lowercased headers.
 * @param {object} lh lowercased headers
 * @param {{name: string, match: string, value?: string}} check
 * @returns {boolean}
 */
function headerCheckMatches(lh, check) {
  const v = lh[String(check.name).toLowerCase()];
  if (v === undefined) return false;
  if (check.match === 'present') return true;
  const val = String(v).toLowerCase();
  const want = String(check.value || '').toLowerCase();
  if (check.match === 'equals') return val === want;
  if (check.match === 'contains') return val.includes(want);
  if (check.match === 'prefix') return val.startsWith(want);
  return false;
}

/**
 * Fingerprint the API gateway from a single response's headers.
 * @param {object} headers response headers
 * @returns {Array<{id: string, name: string, confidence: string, evidence: string, quirks: string}>}
 */
export function fingerprintGateway(headers = {}) {
  const lh = lowerHeaders(headers);
  const matches = [];
  for (const sig of GATEWAY_SIGNATURES) {
    if (sig.viaProbe) continue;
    const primary = sig.headers.every((c) => headerCheckMatches(lh, c));
    const altHit = sig.alt.some((c) => headerCheckMatches(lh, c));
    if (primary || altHit) {
      matches.push({
        id: sig.id,
        name: sig.name,
        confidence: primary ? 'high' : 'medium',
        evidence: sig.evidence,
        quirks: sig.quirks,
      });
    }
  }
  return matches.sort((a, b) => {
    const rank = { high: 0, medium: 1 };
    return rank[a.confidence] - rank[b.confidence];
  });
}

/**
 * Summarize gateway identity across multiple sampled responses: pick the
 * most-confident, most-frequent match.
 * @param {Array<{headers: object, label?: string}>} samples
 * @returns {{gateway: string|null, confidence: string, evidence: string, quirks: string, samples: number, matches: number}}
 */
export function summarizeGatewayIdentity(samples = []) {
  const votes = new Map();
  let total = 0;
  for (const s of Array.isArray(samples) ? samples : []) {
    const m = fingerprintGateway(s.headers || {});
    total += 1;
    for (const hit of m) {
      if (!votes.has(hit.id)) votes.set(hit.id, { hit, count: 0 });
      votes.get(hit.id).count += 1;
    }
  }
  if (votes.size === 0) {
    return {
      gateway: null,
      confidence: 'none',
      evidence: `No gateway signatures matched across ${total} sampled response(s).`,
      quirks: '',
      samples: total,
      matches: 0,
    };
  }
  const [best] = [...votes.values()].sort((a, b) => b.count - a.count || (a.hit.confidence === 'high' ? -1 : 1));
  return {
    gateway: best.hit.name,
    confidence: best.hit.confidence,
    evidence: `${best.hit.name} matched in ${best.count}/${total} sampled response(s). ${best.hit.evidence}`,
    quirks: best.hit.quirks,
    samples: total,
    matches: best.count,
  };
}

/* ---------------------------------------------------------------------------
 * Idea 01133 — Kong Admin API exposure check
 * ------------------------------------------------------------------------- */

/** Default Kong admin ports: 8001 (Admin API), 8002 (Admin GUI). */
export const KONG_ADMIN_PORTS = [8001, 8002];

/**
 * Build Kong Admin API exposure probes: port probes plus common /admin path
 * variants on the standard HTTPS port.
 * @param {{host: string, ports?: number[]}} target
 * @returns {Array} probe descriptors
 */
export function buildKongAdminProbes(target = {}) {
  const host = String(target.host || '').trim();
  if (!host) return [];
  const ports = Array.isArray(target.ports) && target.ports.length ? target.ports : KONG_ADMIN_PORTS;
  const out = [];
  for (const port of ports) {
    out.push(
      normalizeProbe({
        idea: '01133',
        label: `Kong Admin API root on ${host}:${port}`,
        method: 'GET',
        url: `http://${host}:${port}/`,
        detect:
          '200 with a JSON body containing "version", "tag" or "node_id" signals an exposed Kong Admin API — ' +
          'that interface allows full route/service/plugin reconfiguration. Any 401/403 means it is access-controlled.',
      }),
    );
  }
  const adminPaths = ['/admin/', '/admin', '/kong/admin', '/kong/admin/', '/api/admin'];
  for (const p of adminPaths) {
    out.push(
      normalizeProbe({
        idea: '01133',
        label: `Kong admin path variant "${p}"`,
        method: 'GET',
        url: `https://${host}${p}`,
        detect:
          '200 whose body mentions Kong admin markers ("version", "node_id", "configuration") signals the Admin API ' +
          'mounted behind the gateway itself — 404/301 to login is the safe outcome.',
      }),
    );
  }
  return out;
}

/**
 * Analyze Kong admin probe responses.
 * Records: { label, url, status, body }.
 * @param {object[]} records
 * @returns {{exposed: object[], controlled: object[], closed: object[], findings: object[]}}
 */
export function analyzeKongAdminExposure(records = []) {
  const exposed = [];
  const controlled = [];
  const closed = [];
  const findings = [];
  for (const r of Array.isArray(records) ? records : []) {
    const status = Number(r.status);
    const body = String(r.body || '');
    const looksKong = /"version"|"node_id"|"tag"\s*:\s*"[^"]*"|"configuration"|kong/i.test(body) && status === 200;
    const entry = { url: String(r.url || r.label || ''), status };
    if (looksKong) {
      exposed.push(entry);
      findings.push({
        type: 'kong-admin-exposed',
        severity: 'Critical',
        confidence: 'high',
        evidence: `${entry.url} returned 200 with Kong Admin API markers in the body — the admin interface is reachable without authentication.`,
        recommendation:
          'Bind the Kong Admin API to localhost or an internal network on the authorized target, require authentication, ' +
          'and remove any gateway route that proxies /admin paths to it.',
      });
    } else if (status === 401 || status === 403) {
      controlled.push(entry);
    } else {
      closed.push(entry);
    }
  }
  return { exposed, controlled, closed, findings };
}

/* ---------------------------------------------------------------------------
 * Idea 01134 — AWS API Gateway stage enumeration
 * ------------------------------------------------------------------------- */

/** Common API Gateway stage names worth probing. */
export const AWS_STAGE_WORDLIST = [
  'dev', 'development', 'staging', 'stage', 'test', 'qa', 'uat',
  'prod', 'production', 'live', 'v1', 'v2', 'v3', 'api',
  'beta', 'alpha', 'sandbox', 'demo', 'preview', 'canary',
  'blue', 'green', 'internal', 'private',
];

/**
 * Build stage-enumeration probes: path-style (/{stage}) under a base path
 * and custom-domain-style ({stage}.api host) variants.
 * @param {{baseUrl: string, stages?: string[]}} target
 * @returns {Array} probe descriptors
 */
export function buildApiGatewayStageProbes(target = {}) {
  const baseUrl = String(target.baseUrl || '').replace(/\/$/, '');
  if (!baseUrl) return [];
  const stages = Array.isArray(target.stages) && target.stages.length
    ? [...new Set(target.stages.map((s) => String(s).trim()).filter(Boolean))]
    : AWS_STAGE_WORDLIST;
  const out = [];
  for (const stage of stages) {
    out.push(
      normalizeProbe({
        idea: '01134',
        label: `API Gateway stage path probe "/${stage}"`,
        method: 'GET',
        url: `${baseUrl}/${stage}`,
        detect:
          'A 2xx/3xx where the base path returns 404 indicates an active stage — then compare its auth behavior ' +
          '(401 vs 200, required headers) against production to spot stages with weaker auth.',
      }),
    );
    let host = '';
    try {
      host = new URL(baseUrl).host;
    } catch {
      host = '';
    }
    if (host) {
      out.push(
        normalizeProbe({
          idea: '01134',
          label: `API Gateway stage host probe "${stage}.${host}"`,
          method: 'GET',
          url: baseUrl,
          headers: { Host: `${stage}.${host}` },
          detect:
            'A 2xx/3xx (or a different Server/x-amzn header set) with the stage Host header indicates a stage bound ' +
            'to a custom domain — enumerate its routes and compare auth with production.',
        }),
      );
    }
  }
  return out;
}

/**
 * Analyze stage-enumeration responses.
 * Records: { stage, style: 'path'|'host', status, authRequired: boolean|null }.
 * @param {object[]} records
 * @returns {{active: object[], authDrift: object[], findings: object[]}}
 */
export function analyzeStageEnumeration(records = []) {
  const byStage = new Map();
  for (const r of Array.isArray(records) ? records : []) {
    const stage = String(r.stage || '').trim();
    if (!stage) continue;
    if (!byStage.has(stage)) byStage.set(stage, []);
    byStage.get(stage).push(r);
  }
  const active = [];
  const authDrift = [];
  const findings = [];
  for (const [stage, recs] of byStage) {
    // 401/403 also proves the stage exists: an auth challenge means the
    // gateway routed the request to a real stage instead of 404ing.
    const reachable = recs.some((r) => {
      const s = Number(r.status);
      return (s >= 200 && s < 400) || s === 401 || s === 403;
    });
    if (!reachable) continue;
    const authStates = new Set(recs.map((r) => (r.authRequired === true ? 'required' : r.authRequired === false ? 'none' : 'unknown')));
    const entry = { stage, statuses: recs.map((r) => r.status), auth: [...authStates] };
    active.push(entry);
    if (authStates.has('none')) {
      authDrift.push(entry);
      findings.push({
        type: 'gateway-stage-auth-drift',
        severity: 'High',
        confidence: 'medium',
        evidence: `Stage "${stage}" is reachable and at least one probe showed no auth requirement — non-production stages frequently ship weaker auth.`,
        recommendation:
          'On the authorized target, enforce the same authentication on every stage as on production, ' +
          'or delete/deactivate unused stages.',
      });
    }
  }
  return { active, authDrift, findings };
}

/* ---------------------------------------------------------------------------
 * Idea 01135 — Azure APIM developer portal check
 * ------------------------------------------------------------------------- */

/**
 * Build Azure APIM developer-portal probes: portal root, API/product
 * listings and sign-in pages.
 * @param {{portalUrl: string}} target e.g. { portalUrl: 'https://contoso.developer.azure-api.net' }
 * @returns {Array} probe descriptors
 */
export function buildApimPortalProbes(target = {}) {
  const portalUrl = String(target.portalUrl || '').replace(/\/$/, '');
  if (!portalUrl) return [];
  const paths = [
    { path: '/', label: 'APIM developer portal root', detect: '200 HTML containing portal markers ("Developer portal", "apiManagement", product cards) confirms an APIM developer portal.' },
    { path: '/apis', label: 'APIM portal API listing', detect: '200 with API names/paths documents the public API surface — compare against the in-scope inventory.' },
    { path: '/products', label: 'APIM portal product listing', detect: '200 with product names documents subscription products and their visibility (public vs approval-required).' },
    { path: '/subscriptions', label: 'APIM portal subscriptions page', detect: '200 without login showing subscription keys or keys masked only client-side is a leak — keys must never render for anonymous users.' },
    { path: '/signin', label: 'APIM portal sign-in page', detect: '200 confirms the portal auth entry point — test for verbose auth errors and user enumeration on this page separately.' },
    { path: '/profile', label: 'APIM portal profile page', detect: '200 without login leaking profile/subscription data confirms broken access control on the portal.' },
  ];
  return paths.map((p) =>
    normalizeProbe({
      idea: '01135',
      label: p.label,
      method: 'GET',
      url: `${portalUrl}${p.path}`,
      detect: `${p.detect} 404/redirect-to-login is the safe outcome for gated pages.`,
    }),
  );
}

/**
 * Extract candidate API/product names and subscription-key hints from
 * operator-fetched portal HTML. Pure text analysis — no fetching here.
 * @param {string} html page text fetched by the agent's network layer
 * @returns {{apis: string[], products: string[], keyHints: string[], portalMarkers: boolean}}
 */
export function parseApimPortalListing(html = '') {
  const text = String(html || '');
  const apis = new Set();
  const products = new Set();
  const keyHints = new Set();
  const portalMarkers =
    /developer portal|apiManagement|azure-api\.net|apim-/i.test(text);
  const anchorRe = /<a[^>]*>([^<]{2,120})<\/a>/gi;
  let m;
  while ((m = anchorRe.exec(text)) !== null) {
    const label = m[1].trim();
    if (/^api\b/i.test(label) || /\bapi$/i.test(label) || label.includes('/')) apis.add(label);
    if (/product|subscription|plan/i.test(label)) products.add(label);
  }
  const dataRe = /"(?:displayName|name|title)"\s*:\s*"([^"]{2,120})"/gi;
  while ((m = dataRe.exec(text)) !== null) apis.add(m[1].trim());
  const keyRe = /(Ocp-Apim-Subscription-Key|subscription[_-]?key|primaryKey|secondaryKey)\s*[:=]\s*["']?([A-Za-z0-9+/=._-]{8,})["']?/gi;
  while ((m = keyRe.exec(text)) !== null) {
    if (!/^\*+$/.test(m[2])) keyHints.add(`${m[1]}: ${m[2].slice(0, 12)}…`);
  }
  const maskedRe = /(primaryKey|secondaryKey)["']?\s*:\s*["'](\*+)["']/gi;
  while ((m = maskedRe.exec(text)) !== null) keyHints.add(`${m[1]}: masked`);
  return {
    apis: [...apis].slice(0, 50),
    products: [...products].slice(0, 50),
    keyHints: [...keyHints].slice(0, 20),
    portalMarkers,
  };
}

/* ---------------------------------------------------------------------------
 * Idea 01136 — APIM management API probe
 * ------------------------------------------------------------------------- */

/**
 * Build Azure APIM management-API probes: both the service-direct management
 * endpoint style ({service}.management.azure-api.net) and
 * management.azure.com-style resource paths with placeholders the agent fills
 * from the engagement scope.
 * @param {{serviceName: string, subscriptionId?: string, resourceGroup?: string}} target
 * @returns {Array} probe descriptors
 */
export function buildApimManagementProbes(target = {}) {
  const service = String(target.serviceName || '').trim();
  if (!service) return [];
  const out = [];
  const mgmtHost = `https://${service}.management.azure-api.net`;
  const servicePaths = [
    { path: '/subscriptions?api-version=2021-08-01', label: 'APIM management subscriptions list', detect: '200 JSON with a "value" array of subscriptions signals an exposed management API — subscription keys must not list anonymously.' },
    { path: '/users?api-version=2021-08-01', label: 'APIM management users list', detect: '200 JSON listing users signals exposed user enumeration on the management plane.' },
    { path: '/products?api-version=2021-08-01', label: 'APIM management products list', detect: '200 JSON listing products (with approval/subscription requirements) maps the management-visible product surface.' },
    { path: '/apis?api-version=2021-08-01', label: 'APIM management APIs list', detect: '200 JSON listing APIs documents internal API names and paths not visible on the portal.' },
  ];
  for (const p of servicePaths) {
    out.push(
      normalizeProbe({
        idea: '01136',
        label: p.label,
        method: 'GET',
        url: `${mgmtHost}${p.path}`,
        detect: `${p.detect} 401/403 is the safe outcome.`,
      }),
    );
  }
  const sub = target.subscriptionId ? String(target.subscriptionId) : '{subscriptionId}';
  const rg = target.resourceGroup ? String(target.resourceGroup) : '{resourceGroup}';
  out.push(
    normalizeProbe({
      idea: '01136',
      label: 'APIM ARM management path (management.azure.com style)',
      method: 'GET',
      url: `https://management.azure.com/subscriptions/${sub}/resourceGroups/${rg}/providers/Microsoft.ApiManagement/service/${service}/subscriptions?api-version=2021-08-01`,
      detect:
        '200 JSON here means the ARM management plane answers the probe — on an authorized target this path must require ' +
        'Azure AD authentication; an anonymous 200 is a critical management-plane exposure.',
    }),
  );
  return out;
}

/**
 * Analyze APIM management probe responses.
 * Records: { label, url, status, body }.
 * @param {object[]} records
 * @returns {{exposed: object[], controlled: object[], closed: object[], findings: object[]}}
 */
export function analyzeApimManagementExposure(records = []) {
  const exposed = [];
  const controlled = [];
  const closed = [];
  const findings = [];
  for (const r of Array.isArray(records) ? records : []) {
    const status = Number(r.status);
    const body = String(r.body || '');
    const looksMgmt = status === 200 && /"value"\s*:\s*\[|"id"\s*:\s*"\/subscriptions\//i.test(body);
    const entry = { url: String(r.url || r.label || ''), status };
    if (looksMgmt) {
      exposed.push(entry);
      findings.push({
        type: 'apim-management-exposed',
        severity: 'Critical',
        confidence: 'high',
        evidence: `${entry.url} returned 200 with a management-API-shaped JSON body ("value" array / subscription resource IDs) without authentication.`,
        recommendation:
          'On the authorized target, require Azure AD authentication on the APIM management endpoints, ' +
          'restrict management.azure-api.net to administrators, and rotate any subscription keys that were listable.',
      });
    } else if (status === 401 || status === 403) {
      controlled.push(entry);
    } else {
      closed.push(entry);
    }
  }
  return { exposed, controlled, closed, findings };
}

/* ---------------------------------------------------------------------------
 * Idea 01137 — Tyk gateway discovery
 * ------------------------------------------------------------------------- */

/**
 * Build Tyk gateway discovery probes: the /hello identity endpoint and the
 * /tyk/ admin surface paths.
 * @param {{baseUrl: string}} target
 * @returns {Array} probe descriptors
 */
export function buildTykDiscoveryProbes(target = {}) {
  const baseUrl = String(target.baseUrl || '').replace(/\/$/, '');
  if (!baseUrl) return [];
  const paths = [
    { path: '/hello', label: 'Tyk /hello identity endpoint', detect: '200 JSON {"status":"pass","description":"Tyk GW",...} positively identifies a Tyk gateway and leaks its version.' },
    { path: '/tyk/apis', label: 'Tyk API definitions listing', detect: '200 JSON listing API definitions exposes internal listen paths and auth modes — must require the Tyk admin secret.' },
    { path: '/tyk/reload', label: 'Tyk reload endpoint (GET)', detect: 'Anything other than 403/404 (even a JSON error naming Tyk) confirms the admin surface is reachable; a 200 reload without a secret is critical.' },
    { path: '/tyk/org/keys', label: 'Tyk org keys listing', detect: '200 listing keys/policies exposes credentials — the admin API must be secret-gated.' },
    { path: '/tyk/health', label: 'Tyk health endpoint', detect: '200 confirms the Tyk control surface answers on this port; note the port for the admin-port sweep.' },
  ];
  return paths.map((p) =>
    normalizeProbe({
      idea: '01137',
      label: p.label,
      method: 'GET',
      url: `${baseUrl}${p.path}`,
      headers: { 'x-tyk-authorization': '' },
      detect: `${p.detect} 403/404 is the safe outcome.`,
    }),
  );
}

/**
 * Analyze Tyk discovery responses.
 * Records: { label, url, status, body }.
 * @param {object[]} records
 * @returns {{identified: boolean, version: string|null, exposed: object[], findings: object[]}}
 */
export function analyzeTykDiscovery(records = []) {
  let identified = false;
  let version = null;
  const exposed = [];
  const findings = [];
  for (const r of Array.isArray(records) ? records : []) {
    const status = Number(r.status);
    const body = String(r.body || '');
    const helloMatch = body.match(/"description"\s*:\s*"Tyk GW"|"status"\s*:\s*"pass"/);
    if (helloMatch) {
      identified = true;
      const vMatch = body.match(/"version"\s*:\s*"([^"]+)"/);
      if (vMatch) version = vMatch[1];
    }
    const adminLeak = status === 200 && /tyk|listen_path|api_id|auth/i.test(body) && /\/tyk\//.test(String(r.url || ''));
    if (adminLeak) {
      const entry = { url: String(r.url || r.label || ''), status };
      exposed.push(entry);
      findings.push({
        type: 'tyk-admin-exposed',
        severity: 'Critical',
        confidence: 'high',
        evidence: `${entry.url} returned 200 with Tyk admin/API-definition content — key and policy APIs are reachable without the admin secret.`,
        recommendation:
          'On the authorized target, gate the Tyk admin API behind the admin secret and a private network, ' +
          'and rotate any keys or policies that were retrievable.',
      });
    }
  }
  if (identified && exposed.length === 0) {
    findings.push({
      type: 'tyk-identified',
      severity: 'Info',
      confidence: 'high',
      evidence: `Tyk gateway identified${version ? ` (version ${version})` : ''}; admin surfaces did not answer anonymously on the probed paths.`,
      recommendation:
        'Use the confirmed Tyk identity to prioritize Tyk-specific checks on the authorized target: ' +
        'overlapping listen paths with different auth modes, and the trailing-slash differential (01131).',
    });
  }
  return { identified, version, exposed, findings };
}

/* ---------------------------------------------------------------------------
 * Idea 01138 — Traefik dashboard API check
 * ------------------------------------------------------------------------- */

/**
 * Build Traefik dashboard/API probes.
 * @param {{baseUrl: string}} target
 * @returns {Array} probe descriptors
 */
export function buildTraefikDashboardProbes(target = {}) {
  const baseUrl = String(target.baseUrl || '').replace(/\/$/, '');
  if (!baseUrl) return [];
  const paths = [
    { path: '/dashboard/', label: 'Traefik dashboard UI', detect: '200 HTML with a Traefik title/manifest confirms an exposed dashboard — routers, services and middlewares become visible.' },
    { path: '/api/rawdata', label: 'Traefik /api/rawdata', detect: '200 JSON with "routers" and "services" keys dumps the full dynamic configuration including backends and TLS settings.' },
    { path: '/api/http/routers', label: 'Traefik routers API', detect: '200 JSON listing routers reveals host/path rules and which middlewares (auth) each router applies.' },
    { path: '/api/http/services', label: 'Traefik services API', detect: '200 JSON listing services reveals backend server URLs — internal addresses must not be exposed.' },
    { path: '/api/http/middlewares', label: 'Traefik middlewares API', detect: '200 JSON listing middlewares shows auth/rate-limit wiring per route.' },
    { path: '/api/version', label: 'Traefik version API', detect: '200 JSON with a "Version" field fingerprints the Traefik release for known-issue mapping.' },
  ];
  return paths.map((p) =>
    normalizeProbe({
      idea: '01138',
      label: p.label,
      method: 'GET',
      url: `${baseUrl}${p.path}`,
      detect: `${p.detect} 401/403/404 is the safe outcome.`,
    }),
  );
}

/**
 * Analyze Traefik dashboard probe responses.
 * Records: { label, url, status, body }.
 * @param {object[]} records
 * @returns {{exposed: object[], routers: string[], services: string[], findings: object[]}}
 */
export function analyzeTraefikDashboard(records = []) {
  const exposed = [];
  const routers = new Set();
  const services = new Set();
  const findings = [];
  for (const r of Array.isArray(records) ? records : []) {
    const status = Number(r.status);
    if (status !== 200) continue;
    const body = String(r.body || '');
    const url = String(r.url || r.label || '');
    const isDashboard = /<title>[^<]*traefik/i.test(body) || /__TRAEFIK__/i.test(body);
    const isRaw = /"routers"\s*:\s*\{|"services"\s*:\s*\{/.test(body);
    if (!isDashboard && !isRaw) continue;
    exposed.push({ url, status });
    const routerRe = /"([A-Za-z0-9_.@-]+)"\s*:\s*\{\s*"entryPoints"/g;
    let m;
    while ((m = routerRe.exec(body)) !== null) routers.add(m[1]);
    const svcRe = /"servers"\s*:\s*\[\s*"([^"]+)"/g;
    while ((m = svcRe.exec(body)) !== null) services.add(m[1]);
    findings.push({
      type: 'traefik-dashboard-exposed',
      severity: 'High',
      confidence: 'high',
      evidence: `${url} returned 200 with ${isRaw ? 'Traefik API JSON (routers/services dump)' : 'the Traefik dashboard UI'} — routing configuration is publicly readable.`,
      recommendation:
        'On the authorized target, disable the insecure dashboard/API or protect it with authentication ' +
        'and IP allow-listing; verify no internal backend addresses remain visible.',
    });
  }
  return { exposed, routers: [...routers], services: [...services], findings };
}

/* ---------------------------------------------------------------------------
 * Idea 01139 — Envoy admin interface probe
 * ------------------------------------------------------------------------- */

/** Common Envoy admin ports: 9901 and 15000 are the documented defaults. */
export const ENVOY_ADMIN_PORTS = [9901, 15000, 8001];

/** Envoy admin endpoints that disclose configuration or runtime state. */
export const ENVOY_ADMIN_PATHS = ['/server_info', '/config_dump', '/clusters', '/listeners', '/stats'];

/**
 * Build Envoy admin interface probes: admin endpoints on edge/admin ports
 * plus an /admin path variant on the standard web ports.
 * @param {{host: string, ports?: number[]}} target
 * @returns {Array} probe descriptors
 */
export function buildEnvoyAdminProbes(target = {}) {
  const host = String(target.host || '').trim();
  if (!host) return [];
  const ports = Array.isArray(target.ports) && target.ports.length ? target.ports : ENVOY_ADMIN_PORTS;
  const out = [];
  for (const port of ports) {
    for (const p of ENVOY_ADMIN_PATHS) {
      out.push(
        normalizeProbe({
          idea: '01139',
          label: `Envoy admin "${p}" on ${host}:${port}`,
          method: 'GET',
          url: `http://${host}:${port}${p}`,
          detect:
            '200 JSON with "version_info"/"node" (server_info) or "configs" (config_dump) confirms an exposed Envoy admin ' +
            'interface — config dumps reveal routes, clusters and listeners. Connection refused/403 is the safe outcome.',
        }),
      );
    }
  }
  out.push(
    normalizeProbe({
      idea: '01139',
      label: `Envoy /admin path variant on ${host}`,
      method: 'GET',
      url: `https://${host}/admin`,
      detect:
        '200 with Envoy admin markers ("server_info", "config_dump" links) signals the admin interface mounted ' +
        'behind the edge itself — 404 is the safe outcome.',
    }),
  );
  return out;
}

/**
 * Analyze Envoy admin probe responses.
 * Records: { label, url, status, body }.
 * @param {object[]} records
 * @returns {{exposed: object[], findings: object[]}}
 */
export function analyzeEnvoyAdmin(records = []) {
  const exposed = [];
  const findings = [];
  for (const r of Array.isArray(records) ? records : []) {
    const status = Number(r.status);
    if (status !== 200) continue;
    const body = String(r.body || '');
    const url = String(r.url || r.label || '');
    if (!/"version_info"|"node"\s*:\s*\{|"configs"\s*:\s*\[|envoy/i.test(body)) continue;
    exposed.push({ url, status });
    findings.push({
      type: 'envoy-admin-exposed',
      severity: 'High',
      confidence: 'high',
      evidence: `${url} returned 200 with Envoy admin content — configuration and runtime state are publicly readable.`,
      recommendation:
        'On the authorized target, bind the Envoy admin interface to localhost, remove it from edge listeners, ' +
        'and require authentication for any remaining admin access.',
    });
  }
  return { exposed, findings };
}

/* ---------------------------------------------------------------------------
 * Idea 01140 — Gateway route-overlap detection
 * ------------------------------------------------------------------------- */

/**
 * Convert a gateway route pattern into a RegExp. Supports literal segments,
 * `:param` segments, `{param}` segments, `*` greedy wildcards (one or more
 * characters, any depth — matching gateway prefix-routing semantics) and
 * full `**` wildcards (zero or more characters); anything else is treated
 * literally.
 * @param {string} pattern e.g. '/api/*', '/api/users/:id'
 * @returns {RegExp|null} null when the pattern cannot be compiled
 */
export function routePatternToRegExp(pattern = '') {
  const raw = String(pattern || '').trim();
  if (!raw) return null;
  const segments = raw.split('/').filter((s) => s.length > 0);
  const parts = segments.map((seg) => {
    if (seg === '**') return '.*';
    // A lone '*' is treated as a greedy wildcard (one or more characters,
    // any depth): gateway prefix routing commonly lets '*' absorb nested
    // path segments, so overlap candidates stay broad for the operator to
    // verify against the gateway's actual precedence rules.
    if (seg === '*') return '.+';
    if (/^:.+/.test(seg) || /^\{.+\}$/.test(seg)) return '[^/]+';
    return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  });
  try {
    return new RegExp(`^/${parts.join('/')}/?$`);
  } catch {
    return null;
  }
}

/**
 * Build a small deterministic set of concrete sample paths from a pattern
 * so overlap can be tested without symbolic solving.
 * @param {string} pattern
 * @returns {string[]}
 */
export function samplePathsFromPattern(pattern = '') {
  const raw = String(pattern || '').trim();
  if (!raw) return [];
  const fill = (token, i) => {
    if (token === '**') return `deep/nested/seg${i}`;
    if (token === '*') return `wild${i}`;
    if (/^:.+/.test(token) || /^\{.+\}$/.test(token)) return `p${i}`;
    return token;
  };
  const segments = raw.split('/').filter((s) => s.length > 0);
  const base = `/${segments.map(fill).join('/')}`;
  const samples = [base];
  if (!raw.endsWith('/')) samples.push(`${base}/`);
  return samples;
}

/**
 * Decide whether two route patterns can match the same concrete request path.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function routesOverlap(a = '', b = '') {
  const ra = routePatternToRegExp(a);
  const rb = routePatternToRegExp(b);
  if (!ra || !rb) return false;
  for (const sample of [...samplePathsFromPattern(a), ...samplePathsFromPattern(b)]) {
    if (ra.test(sample) && rb.test(sample)) return true;
  }
  return false;
}

/**
 * Map overlapping route patterns and flag candidate auth gaps: pairs where
 * the two routes overlap but disagree on authentication. The winning route
 * is gateway-dependent (most gateways prefer the longest/most-specific
 * match), so every auth-disagreeing overlap is reported as a candidate.
 *
 * Routes: [{ id, pattern, auth: 'required'|'none'|'unknown', source? }]
 *
 * @param {object[]} routes
 * @returns {{pairs: object[], authGaps: object[], findings: object[]}}
 */
export function mapRouteOverlaps(routes = []) {
  const list = (Array.isArray(routes) ? routes : [])
    .filter((r) => r && String(r.pattern || '').trim())
    .map((r) => ({
      id: String(r.id || r.pattern),
      pattern: String(r.pattern).trim(),
      auth: ['required', 'none'].includes(r.auth) ? r.auth : 'unknown',
      source: String(r.source || ''),
    }));
  const pairs = [];
  const authGaps = [];
  const findings = [];
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const a = list[i];
      const b = list[j];
      if (!routesOverlap(a.pattern, b.pattern)) continue;
      const authDisagree =
        (a.auth === 'required' && b.auth === 'none') || (a.auth === 'none' && b.auth === 'required');
      const pair = {
        routeA: a.id,
        patternA: a.pattern,
        authA: a.auth,
        routeB: b.id,
        patternB: b.pattern,
        authB: b.auth,
        authGapCandidate: authDisagree,
        evidence:
          `"${a.pattern}" (auth: ${a.auth}) and "${b.pattern}" (auth: ${b.auth}) can match the same request path.`,
      };
      pairs.push(pair);
      if (authDisagree) {
        authGaps.push(pair);
        const unauth = a.auth === 'none' ? a : b;
        findings.push({
          type: 'gateway-route-auth-gap',
          severity: 'High',
          confidence: 'medium',
          evidence:
            `${pair.evidence} If the gateway routes the request to "${unauth.pattern}", ` +
            'authentication is skipped even though the overlapping route enforces it.',
          recommendation:
            'On the authorized target, verify which route the gateway actually selects for an overlapping request ' +
            '(most gateways prefer the longest/most-specific match), then align authentication across both routes — ' +
            'deny-by-default is safer than relying on route precedence.',
        });
      }
    }
  }
  return { pairs, authGaps, findings };
}

/* ---------------------------------------------------------------------------
 * Per-idea technique drivers + registries
 * ------------------------------------------------------------------------- */

/**
 * Idea 01131 — trailing-slash normalization differential technique driver.
 * @param {string[]} paths
 * @returns {{idea: string, title: string, probes: Array, analyze: Function}}
 */
export function technique01131TrailingSlash(paths = []) {
  return { idea: '01131', title: IDEAS['01131'], probes: buildTrailingSlashProbePairs(paths), analyze: analyzeTrailingSlashDifferential };
}

/**
 * Idea 01132 — API gateway fingerprinting technique driver.
 * @param {Array<{headers: object, label?: string}>} samples operator-collected response header sets
 * @returns {{idea: string, title: string, summary: object, fingerprintOne: Function}}
 */
export function technique01132GatewayFingerprinting(samples = []) {
  return { idea: '01132', title: IDEAS['01132'], summary: summarizeGatewayIdentity(samples), fingerprintOne: fingerprintGateway };
}

/**
 * Idea 01133 — Kong Admin API exposure check technique driver.
 * @param {{host: string, ports?: number[]}} target
 * @returns {{idea: string, title: string, probes: Array, analyze: Function}}
 */
export function technique01133KongAdmin(target = {}) {
  return { idea: '01133', title: IDEAS['01133'], probes: buildKongAdminProbes(target), analyze: analyzeKongAdminExposure };
}

/**
 * Idea 01134 — AWS API Gateway stage enumeration technique driver.
 * @param {{baseUrl: string, stages?: string[]}} target
 * @returns {{idea: string, title: string, wordlist: string[], probes: Array, analyze: Function}}
 */
export function technique01134ApiGatewayStages(target = {}) {
  return {
    idea: '01134',
    title: IDEAS['01134'],
    wordlist: AWS_STAGE_WORDLIST,
    probes: buildApiGatewayStageProbes(target),
    analyze: analyzeStageEnumeration,
  };
}

/**
 * Idea 01135 — Azure APIM developer portal check technique driver.
 * @param {{portalUrl: string}} target
 * @returns {{idea: string, title: string, probes: Array, analyze: Function, parseListing: Function}}
 */
export function technique01135ApimPortal(target = {}) {
  return {
    idea: '01135',
    title: IDEAS['01135'],
    probes: buildApimPortalProbes(target),
    analyze: parseApimPortalListing,
    parseListing: parseApimPortalListing,
  };
}

/**
 * Idea 01136 — APIM management API probe technique driver.
 * @param {{serviceName: string, subscriptionId?: string, resourceGroup?: string}} target
 * @returns {{idea: string, title: string, probes: Array, analyze: Function}}
 */
export function technique01136ApimManagement(target = {}) {
  return { idea: '01136', title: IDEAS['01136'], probes: buildApimManagementProbes(target), analyze: analyzeApimManagementExposure };
}

/**
 * Idea 01137 — Tyk gateway discovery technique driver.
 * @param {{baseUrl: string}} target
 * @returns {{idea: string, title: string, probes: Array, analyze: Function}}
 */
export function technique01137TykDiscovery(target = {}) {
  return { idea: '01137', title: IDEAS['01137'], probes: buildTykDiscoveryProbes(target), analyze: analyzeTykDiscovery };
}

/**
 * Idea 01138 — Traefik dashboard API check technique driver.
 * @param {{baseUrl: string}} target
 * @returns {{idea: string, title: string, probes: Array, analyze: Function}}
 */
export function technique01138TraefikDashboard(target = {}) {
  return { idea: '01138', title: IDEAS['01138'], probes: buildTraefikDashboardProbes(target), analyze: analyzeTraefikDashboard };
}

/**
 * Idea 01139 — Envoy admin interface probe technique driver.
 * @param {{host: string, ports?: number[]}} target
 * @returns {{idea: string, title: string, probes: Array, analyze: Function}}
 */
export function technique01139EnvoyAdmin(target = {}) {
  return { idea: '01139', title: IDEAS['01139'], probes: buildEnvoyAdminProbes(target), analyze: analyzeEnvoyAdmin };
}

/**
 * Idea 01140 — gateway route-overlap detection technique driver.
 * @param {object[]} routes [{ id, pattern, auth, source? }]
 * @returns {{idea: string, title: string, result: object}}
 */
export function technique01140RouteOverlap(routes = []) {
  return { idea: '01140', title: IDEAS['01140'], result: mapRouteOverlaps(routes) };
}

/**
 * Build a uniform report finding from a gateway-recon result.
 * @param {{title?: string, kind?: string, evidence?: string, targets?: string[], confidence?: string, severity?: string}} result
 * @returns {{title: string, severity: string, confidence: string, kind: string, evidence: string, targets: string[], recommendation: string}}
 */
export function gatewayReconFinding(result = {}) {
  const {
    title = 'Gateway recon finding',
    kind = 'recon',
    evidence = '',
    targets = [],
    confidence = 'medium',
    severity = 'Info',
  } = result;
  return {
    title: `Gateway recon — ${title}`,
    severity,
    confidence,
    kind,
    evidence,
    targets: Array.isArray(targets) ? targets : [],
    recommendation:
      'Review the flagged gateway surface on the authorized target: normalize trailing slashes before access rules, ' +
      'keep admin/dashboard/management interfaces off public networks and behind authentication, align authentication ' +
      'across overlapping routes and every API stage, and never render subscription keys or internal backend addresses ' +
      'to unauthenticated callers.',
  };
}

/**
 * Idea-number → technique-function registry. Ten entries, one per idea
 * 01131–01140, for verifiable coverage.
 */
export const GATEWAY_RECON_IDEAS = {
  '01131': technique01131TrailingSlash,
  '01132': technique01132GatewayFingerprinting,
  '01133': technique01133KongAdmin,
  '01134': technique01134ApiGatewayStages,
  '01135': technique01135ApimPortal,
  '01136': technique01136ApimManagement,
  '01137': technique01137TykDiscovery,
  '01138': technique01138TraefikDashboard,
  '01139': technique01139EnvoyAdmin,
  '01140': technique01140RouteOverlap,
};

/**
 * Named-const registry for deterministic access, mirroring house style.
 */
export const GATEWAY_RECON = {
  buildTrailingSlashProbePairs,
  analyzeTrailingSlashDifferential,
  GATEWAY_SIGNATURES,
  fingerprintGateway,
  summarizeGatewayIdentity,
  KONG_ADMIN_PORTS,
  buildKongAdminProbes,
  analyzeKongAdminExposure,
  AWS_STAGE_WORDLIST,
  buildApiGatewayStageProbes,
  analyzeStageEnumeration,
  buildApimPortalProbes,
  parseApimPortalListing,
  buildApimManagementProbes,
  analyzeApimManagementExposure,
  buildTykDiscoveryProbes,
  analyzeTykDiscovery,
  buildTraefikDashboardProbes,
  analyzeTraefikDashboard,
  ENVOY_ADMIN_PORTS,
  ENVOY_ADMIN_PATHS,
  buildEnvoyAdminProbes,
  analyzeEnvoyAdmin,
  routePatternToRegExp,
  samplePathsFromPattern,
  routesOverlap,
  mapRouteOverlaps,
  technique01131TrailingSlash,
  technique01132GatewayFingerprinting,
  technique01133KongAdmin,
  technique01134ApiGatewayStages,
  technique01135ApimPortal,
  technique01136ApimManagement,
  technique01137TykDiscovery,
  technique01138TraefikDashboard,
  technique01139EnvoyAdmin,
  technique01140RouteOverlap,
  gatewayReconFinding,
  GATEWAY_RECON_IDEAS,
};

export default GATEWAY_RECON;
