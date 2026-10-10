/**
 * apiDocSurfaceRecon.js — Alternative API documentation UI surface detection.
 *
 * Covers idea 01201: ReDoc, Scalar and Stoplight Elements documentation UIs
 * are often deployed alongside (or instead of) Swagger UI. Each ships with a
 * "try it now" console that issues live API requests from the visitor's
 * browser, so an exposed doc UI expands the attack surface of the real API.
 *
 * The module builds GET probing plans for the known doc-UI mount paths and
 * classifies HTTP responses as exposed / not-exposed / uncertain using
 * DOM markers, script bundles and HTTP metadata. Detection and
 * surface-mapping only — no credential brute-forcing, no payload delivery.
 */

const IDEA = '01201';

/**
 * Known alternative doc-UI mount points and their fingerprint markers.
 * Each marker list mixes HTML fragments, script-bundle names and vendor
 * strings observed in real ReDoc / Scalar / Stoplight deployments.
 */
const DOC_UI_PROFILES = [
  {
    ui: 'ReDoc',
    paths: ['/redoc', '/redoc/', '/docs/redoc', '/api/redoc'],
    bodyMarkers: [
      /redoc-standalone/i,
      /<redoc\b/i,
      /redoc@\d/i,
      /ReDoc[\s-]*API/i,
    ],
    headerHints: [],
  },
  {
    ui: 'Scalar',
    paths: ['/scalar', '/scalar/', '/reference', '/docs/scalar', '/api/reference'],
    bodyMarkers: [
      /id=["']api-reference["']/i,
      /@scalar\/api-reference/i,
      /Scalar API Reference/i,
      /scalar-app/i,
    ],
    headerHints: [],
  },
  {
    ui: 'Stoplight Elements',
    paths: ['/stoplight', '/stoplight/', '/elements', '/docs/elements'],
    bodyMarkers: [
      /elements-web-components/i,
      /<elements-api\b/i,
      /stoplight\.io/i,
      /Stoplight Elements/i,
    ],
    headerHints: [],
  },
];

/**
 * Build the GET probing plan for alternative doc UIs on a target origin.
 *
 * @param {string} baseUrl - Target origin, e.g. "https://api.example.com".
 * @param {{timeoutMs?: number}} [options]
 * @returns {{idea: string, title: string, baseUrl: string, probes: object[]}}
 */
export function detectRedocScalarUis(baseUrl = '', options = {}) {
  const origin = String(baseUrl || '').replace(/\/+$/, '');
  const probes = [];
  for (const profile of DOC_UI_PROFILES) {
    for (const path of profile.paths) {
      probes.push({
        id: `doc-ui-${profile.ui.toLowerCase().replace(/[^a-z]+/g, '-')}-${path.replace(/[^a-z0-9]+/gi, '-') || 'root'}`,
        name: `Probe ${profile.ui} UI at ${path}`,
        method: 'GET',
        url: `${origin}${path}`,
        path,
        ui: profile.ui,
        timeoutMs: options.timeoutMs ?? 10000,
        expect: 'HTML doc UI page or 404/redirect',
      });
    }
  }
  return { idea: IDEA, title: 'ReDoc and Scalar UI detection', baseUrl: origin, probes };
}

/**
 * Classify one HTTP response against one doc-UI probe.
 *
 * @param {object} probe - One probe from detectRedocScalarUis().
 * @param {{status: number, headers?: object, body?: string}} response
 * @returns {{idea: string, ui: string, path: string, verdict: 'exposed'|'not-exposed'|'uncertain', confidence: number, evidence: string[], note: string}}
 */
export function analyzeDocUiResponse(probe = {}, response = {}) {
  const status = Number(response.status) || 0;
  const headers = {};
  for (const [k, v] of Object.entries(response.headers || {})) {
    headers[k.toLowerCase()] = String(v);
  }
  const body = String(response.body || '');
  const profile = DOC_UI_PROFILES.find((p) => p.ui === probe.ui);
  const evidence = [];

  if (profile) {
    for (const marker of profile.bodyMarkers) {
      const m = body.match(marker);
      if (m) {
        evidence.push(`body marker matched: ${m[0].slice(0, 80)}`);
        break;
      }
    }
  }
  const contentType = headers['content-type'] || '';
  if (/text\/html/i.test(contentType)) evidence.push(`content-type: ${contentType.split(';')[0]}`);

  let verdict = 'uncertain';
  let confidence = 0.4;
  let note = `HTTP ${status}: inconclusive for ${probe.ui || 'doc UI'} at ${probe.path || '?'} — retry or inspect manually.`;

  if (status === 200 && evidence.length > 0 && profile && evidence.some((e) => e.startsWith('body marker'))) {
    verdict = 'exposed';
    confidence = 0.9;
    note = `${probe.ui} documentation UI is publicly reachable at ${probe.path}; its try-it-now console can issue live API requests. Verify scope coverage and whether the UI leaks auth defaults or example credentials.`;
  } else if (status === 401 || status === 403) {
    verdict = 'not-exposed';
    confidence = 0.8;
    note = `${probe.path} requires authentication (HTTP ${status}); ${probe.ui || 'doc UI'} is not publicly readable.`;
  } else if (status === 404) {
    verdict = 'not-exposed';
    confidence = 0.85;
    note = `${probe.ui || 'doc UI'} mount not found at ${probe.path} (HTTP 404).`;
  } else if (status >= 300 && status < 400) {
    evidence.push(`redirect: ${headers.location || '(no location header)'}`);
    note = `${probe.path} redirects (HTTP ${status}); follow manually — auth walls sometimes sit behind the redirect target.`;
  } else if (status === 200 && evidence.length === 0) {
    note = `HTTP 200 at ${probe.path} but no ${probe.ui || 'doc UI'} markers found — likely a different application page.`;
  }

  return {
    idea: IDEA,
    ui: probe.ui || 'unknown',
    path: probe.path || '',
    verdict,
    confidence,
    evidence,
    note,
  };
}

/**
 * Run the full classification for every probe/response pair.
 *
 * @param {Array<{probe: object, response: object}>} pairs
 * @returns {object[]} findings in deterministic probe order
 */
export function classifyDocUiResponses(pairs = []) {
  return pairs.map(({ probe, response }) => analyzeDocUiResponse(probe, response));
}

/**
 * Registry for engine chaining: idea number -> builder + analyzer.
 */
export const API_DOC_SURFACE_RECON = {
  [IDEA]: {
    title: 'ReDoc and Scalar UI detection',
    build: detectRedocScalarUis,
    analyze: analyzeDocUiResponse,
  },
};
