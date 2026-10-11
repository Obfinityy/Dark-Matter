/**
 * apiSubdomainChangelogRecon.js — API subdomain, changelog and OpenAPI
 * specification reconnaissance.
 *
 * Covers idea-bank ideas 01281–01290 for an authorized bug-bounty agent.
 * Everything here is passive analysis or safe probe planning: hostname
 * enumeration, changelog/doc text parsing, response-metadata comparison,
 * gateway normalisation scoring and OpenAPI specification mining. Nothing in
 * this module performs exploitation, sends crafted attack traffic, or ships
 * payloads — it produces plans, classifications and structured findings that
 * a licensed hunt engine may act on.
 *
 * Pure functions only: deterministic, no network, no filesystem.
 */

export const WAVE1281_COVERAGE = [1281, 1282, 1283, 1284, 1285, 1286, 1287, 1288, 1289, 1290];

/**
 * Map every covered idea number to the function that implements it.
 * @returns {Record<number, string>}
 */
export function ideaFunctions() {
  return {
    1281: 'subdomainCandidates',
    1282: 'parseChangelogEndpoints',
    1283: 'buildStatusCodeOracle',
    1284: 'assessRapidResetHandling',
    1285: 'scoreSmugglingGuard',
    1286: 'diffOptionsResponses',
    1287: 'extractDocLinks',
    1288: 'harvestOpenApiExamples',
    1289: 'enumerateServerUrls',
    1290: 'discoverCallbacks',
  };
}

/* ==========================================================================
 * Shared helpers
 * ======================================================================= */

/**
 * Redact PII-shaped values in log/display strings. Realistic ID, token and
 * contact formats are replaced with typed placeholders; benign values pass
 * through unchanged. Always use this before logging harvested examples.
 *
 * @param {*} value - Any value to sanitise for logs.
 * @returns {string} Sanitised printable form.
 */
export function redactPii(value) {
  const s = String(value ?? '');
  if (!s) return s;
  return s
    // Email addresses.
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[REDACTED:email]')
    // Bearer / long hex or base64-ish tokens.
    .replace(/(?<![\w-])(?:[A-Za-z0-9_-]{24,}|[A-Fa-f0-9]{16,})(?![\w-])/g, '[REDACTED:token]')
    // Phone numbers.
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[REDACTED:phone]');
}

/**
 * Normalise a base domain: strip scheme, path and port, lowercase.
 * @param {string} domain
 * @returns {string} Clean apex domain or '' when unparseable.
 */
export function normalizeDomain(domain = '') {
  let d = String(domain || '').trim().toLowerCase();
  d = d.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '');
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(d)) return '';
  return d;
}

/* ==========================================================================
 * 01281 — Admin API subdomain discovery
 * ======================================================================= */

/**
 * High-value API subdomain labels, grouped by class. Admin and internal API
 * hosts frequently miss the WAF hardening of the main site, so they are
 * listed first for prioritised probing.
 */
export const API_SUBDOMAIN_PROFILES = [
  { labelClass: 'admin-api', labels: ['admin-api', 'adminapi', 'api-admin', 'management-api', 'console-api', 'dashboard-api'] },
  { labelClass: 'internal-api', labels: ['internal-api', 'internalapi', 'api-internal', 'private-api', 'backend-api', 'core-api'] },
  { labelClass: 'staging-api', labels: ['staging-api', 'stage-api', 'dev-api', 'qa-api', 'uat-api', 'sandbox-api'] },
  { labelClass: 'edge-api', labels: ['api', 'api2', 'api3', 'gateway', 'gw', 'rest', 'svc'] },
];

/**
 * Build candidate hostnames for API subdomain probing on a target domain.
 *
 * @param {string} domain - Apex domain, e.g. "example.com".
 * @returns {{domain: string, candidates: {host: string, labelClass: string}[], note: string}}
 */
export function subdomainCandidates(domain = '') {
  const clean = normalizeDomain(domain);
  const candidates = [];
  if (clean) {
    for (const profile of API_SUBDOMAIN_PROFILES) {
      for (const label of profile.labels) {
        candidates.push({ host: `${label}.${clean}`, labelClass: profile.labelClass });
      }
    }
  }
  return {
    domain: clean,
    candidates,
    note: clean
      ? 'Safe DNS-resolution probe plan. admin-api and internal-api hosts are probed first because they are the most likely to sit outside the main-site WAF perimeter.'
      : 'Invalid domain: no candidates generated.',
  };
}

/* ==========================================================================
 * 01282 — Internal docs in SDK changelogs
 * ======================================================================= */

const CHANGELOG_VERSION_RE = /^#{1,3}\s*v?(\d+\.\d+(?:\.\d+)?)/gm;
const CHANGELOG_PATH_RE = /`?\s*((?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+\/[\/A-Za-z0-9._~!$&'()*+,;=:@%-]*)\s*`?/g;
const CHANGELOG_ENDPOINT_WORD_RE = /\b(?:endpoint|route|path)\s+(?:['"`])([\/][A-Za-z0-9._~\/-]*)(?:['"`])/gi;

/**
 * Extract endpoint mentions from SDK release-notes / changelog text.
 * SDK changelogs frequently name new internal endpoints before the public
 * docs are updated, making them an early-warning source.
 *
 * @param {string} text - Raw changelog markdown or plain text.
 * @returns {{idea: string, versions: {version: string, endpoints: {method: string, path: string, source: string}[]}[]}}
 */
export function parseChangelogEndpoints(text = '') {
  const body = String(text || '');
  const versions = [];
  const blocks = splitChangelogBlocks(body);
  for (const block of blocks) {
    const seen = new Set();
    const endpoints = [];
    for (const m of block.text.matchAll(CHANGELOG_PATH_RE)) {
      const [method, path] = m[1].trim().split(/\s+/, 2);
      const key = `${method} ${path}`;
      if (!seen.has(key) && path) {
        seen.add(key);
        endpoints.push({ method, path, source: 'explicit' });
      }
    }
    for (const m of block.text.matchAll(CHANGELOG_ENDPOINT_WORD_RE)) {
      const key = `? ${m[1]}`;
      if (!seen.has(key)) {
        seen.add(key);
        endpoints.push({ method: 'unknown', path: m[1], source: 'word-mention' });
      }
    }
    if (endpoints.length) versions.push({ version: block.version, endpoints });
  }
  return { idea: '01282', versions };
}

/**
 * Split changelog text into per-version blocks (best effort).
 * @param {string} text
 * @returns {{version: string, text: string}[]}
 */
export function splitChangelogBlocks(text = '') {
  const body = String(text || '');
  const matches = [...body.matchAll(CHANGELOG_VERSION_RE)];
  if (!matches.length) return body.trim() ? [{ version: 'unversioned', text: body }] : [];
  return matches.map((m, i) => ({
    version: m[1],
    text: body.slice(m.index, i + 1 < matches.length ? matches[i + 1].index : body.length),
  }));
}

/* ==========================================================================
 * 01283 — API status-code state oracle
 * ======================================================================= */

/**
 * Build a status-code → resource-state map from observed API samples.
 * Distinct HTTP codes per workflow state (e.g. 200 vs 404 vs 403) leak
 * workflow internals — this map is the read-out of what the server admits.
 *
 * @param {{resource: string, state: string, status: number}[]} samples - Observations.
 * @returns {{idea: string, oracle: Record<string, {code: number, leaksState: boolean}>, leaks: string[]}}
 */
export function buildStatusCodeOracle(samples = []) {
  const oracle = {};
  const leaks = [];
  for (const s of samples) {
    if (!s || typeof s.status !== 'number') continue;
    const resource = String(s.resource || 'unknown');
    const state = String(s.state || 'unknown');
    const prior = oracle[resource];
    oracle[resource] = { code: s.status, state, leaksState: prior ? prior.code !== s.status : false };
    if (prior && prior.code !== s.status && !leaks.includes(resource)) {
      leaks.push(resource);
    }
  }
  return {
    idea: '01283',
    oracle,
    leaks,
    note: `${leaks.length} resource(s) return different status codes per state — each difference is an oracle that reveals the hidden workflow state to an unauthenticated caller.`,
  };
}

/* ==========================================================================
 * 01284 — HTTP/2 rapid-reset handling assessment (detection planning)
 * ======================================================================= */

/**
 * Plan and assess HTTP/2 rapid-reset handling on API frontends.
 * Rapid RST_STREAM bursts can bypass per-request accounting on some
 * implementations; this function only plans safe, rate-bounded diagnostic
 * probes and scores observed outcomes — it never emits attack traffic.
 *
 * @param {{observedStreams?: number, observedResets?: number, accountingHolds?: boolean, frontendServer?: string}} [observations]
 * @returns {{idea: string, probePlan: object[], assessment: string, risk: string}}
 */
export function assessRapidResetHandling(observations = {}) {
  const probePlan = [
    {
      id: 'h2-single-reset',
      name: 'Single stream reset on a safe GET',
      method: 'h2-diagnostic',
      detail: 'Open one stream, cancel it immediately, confirm the connection survives and the counter advances by exactly one.',
      maxStreams: 1,
    },
    {
      id: 'h2-reset-pair',
      name: 'Paired reset accounting check',
      method: 'h2-diagnostic',
      detail: 'Cancel two sequential streams and verify the server-side request counter increments by two (accounting holds).',
      maxStreams: 2,
    },
  ];
  const { observedResets = 0, accountingHolds = true, frontendServer = 'unknown' } = observations;
  let risk = 'unknown';
  let assessment = 'No observations recorded yet — run the diagnostic probe plan first.';
  if (observedResets > 0) {
    risk = accountingHolds ? 'low' : 'high';
    assessment = accountingHolds
      ? `Frontend (${frontendServer}) kept accounting across ${observedResets} resets: each reset incremented the request counter. No bypass indicated.`
      : `Frontend (${frontendServer}) dropped accounting for ${observedResets} resets: request counters did not track cancellations. This pattern indicates rapid-reset cost accounting may be bypassable — escalate to the hunt engine for scoped re-testing.`;
  }
  return { idea: '01284', probePlan, assessment, risk };
}

/* ==========================================================================
 * 01285 — API gateway request-smuggling guard (detection only)
 * ======================================================================= */

/**
 * Score how well an API gateway normalises ambiguous requests.
 * A gateway that passes conflicting framing (e.g. divergent length signals)
 * through to backends creates desync reach across every service — so the
 * guard is scored purely from observed normalisation behaviour.
 *
 * @param {{responses: {requestId: string, normalised?: boolean, backendStatus?: number, headersEcho?: object}[]}} input
 * @returns {{idea: string, verdict: string, score: number, details: string[]}}
 */
export function scoreSmugglingGuard({ responses = [] } = {}) {
  const details = [];
  let normalised = 0;
  let ambiguous = 0;
  for (const r of responses) {
    if (!r) continue;
    ambiguous += 1;
    if (r.normalised) {
      normalised += 1;
      details.push(`${r.requestId || 'req'}: gateway normalised the ambiguous framing (backend ${r.backendStatus ?? 'n/a'}).`);
    } else {
      details.push(`${r.requestId || 'req'}: ambiguous framing reached the backend unnormalised — gateway did not reject or rewrite it.`);
    }
  }
  const score = ambiguous ? Math.round((normalised / ambiguous) * 100) : 0;
  const verdict = ambiguous === 0 ? 'insufficient-data' : score === 100 ? 'guard-holds' : score >= 50 ? 'partial-guard' : 'guard-fails';
  return {
    idea: '01285',
    verdict,
    score,
    details,
    note: 'Detection only: this score summarises gateway normalisation behaviour. No desync exploitation is performed or implied.',
  };
}

/* ==========================================================================
 * 01286 — Content-Length differential on OPTIONS
 * ======================================================================= */

/**
 * Compare OPTIONS response body sizes across routes. A consistent size
 * delta between two routes confirms both routes exist server-side even when
 * the server otherwise returns uniform 200/404 framing.
 *
 * @param {{route: string, status: number, bodyLength: number}[]} responses
 * @returns {{idea: string, pairs: {routeA: string, routeB: string, delta: number, confidence: string}[], note: string}}
 */
export function diffOptionsResponses(responses = []) {
  const rows = (Array.isArray(responses) ? responses : [])
    .filter((r) => r && typeof r.bodyLength === 'number')
    .map((r) => ({ route: String(r.route || '/'), status: Number(r.status ?? 0), bodyLength: r.bodyLength }));
  const pairs = [];
  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      const delta = Math.abs(rows[i].bodyLength - rows[j].bodyLength);
      pairs.push({
        routeA: rows[i].route,
        routeB: rows[j].route,
        delta,
        confidence: delta >= 32 ? 'high' : delta >= 8 ? 'medium' : 'low',
      });
    }
  }
  pairs.sort((a, b) => b.delta - a.delta);
  return {
    idea: '01286',
    pairs,
    note: pairs.length
      ? 'Largest deltas first: a high-confidence pair means the two routes return differently-sized OPTIONS bodies, confirming both routes exist.'
      : 'Need at least two OPTIONS observations to compare.',
  };
}

/* ==========================================================================
 * 01287 — API docs crawler trap
 * ======================================================================= */

const HREF_RE = /<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
const CLASSIFY_PATTERNS = [
  { tag: 'staging', re: /\b(stag(?:ing)?|dev(?:elopment)?|qa|uat|sandbox|test|preview)(?:[./-]|$)/i },
  { tag: 'internal', re: /\b(internal|intranet|corp|private|backoffice|ops)(?:[./-]|$)/i },
  { tag: 'deprecated', re: /\b(deprecated|legacy|v1|retired|sunset)(?:[./-]|$)/i },
];

/**
 * Extract and classify links from published API documentation HTML.
 * Public docs frequently link staging, internal or deprecated endpoints —
 * each class gets its own queue because each needs a different retest lens.
 *
 * @param {string} docsHtml - Raw documentation HTML.
 * @returns {{idea: string, links: {url: string, classes: string[]}[], byClass: Record<string, string[]>}}
 */
export function extractDocLinks(docsHtml = '') {
  const html = String(docsHtml || '');
  const links = [];
  const seen = new Set();
  for (const m of html.matchAll(HREF_RE)) {
    const url = (m[1] ?? m[2] ?? m[3] ?? '').trim();
    if (!url || seen.has(url) || url.startsWith('#') || url.startsWith('mailto:')) continue;
    seen.add(url);
    const classes = CLASSIFY_PATTERNS.filter((p) => p.re.test(url)).map((p) => p.tag);
    if (!classes.includes('public')) classes.push('public');
    links.push({ url, classes });
  }
  const byClass = {};
  for (const link of links) {
    for (const c of link.classes) {
      (byClass[c] = byClass[c] || []).push(link.url);
    }
  }
  return {
    idea: '01287',
    links,
    byClass,
    note: 'staging/internal/deprecated links are the retest queue — docs expose surface the changelog may not mention.',
  };
}

/* ==========================================================================
 * 01288 — OpenAPI example-value harvesting (PII-redacted)
 * ======================================================================= */

const IDISH_KEYS = ['id', 'uuid', 'user_id', 'userid', 'account_id', 'order_id', 'customer_id'];
const TOKENISH_KEYS = ['token', 'access_token', 'api_key', 'apikey', 'secret', 'bearer', 'session'];
const PIIISH_KEYS = ['email', 'phone', 'ssn', 'name', 'address', 'dob', 'birthdate'];

/**
 * Harvest example values from an OpenAPI spec, grouped by sensitivity
 * class. Realistic IDs, tokens and PII formats in examples tell the hunt
 * engine what real payloads look like — values are reported redacted and
 * the raw text must never be logged.
 *
 * @param {object} spec - Parsed OpenAPI document (JSON object).
 * @returns {{idea: string, ids: string[], tokens: string[], piiFormats: string[], counts: object, warning: string}}
 */
export function harvestOpenApiExamples(spec = {}) {
  const ids = new Set();
  const tokens = new Set();
  const piiFormats = new Set();

  function classify(key, value) {
    const k = String(key || '').toLowerCase();
    const redacted = redactPii(value);
    if (TOKENISH_KEYS.some((t) => k.includes(t))) tokens.add(redacted);
    else if (PIIISH_KEYS.some((t) => k.includes(t))) piiFormats.add(redacted);
    else if (IDISH_KEYS.some((t) => k.includes(t))) ids.add(redacted);
  }

  // Context-aware walk: track the property name that owns each example.
  function walk(node, name = '') {
    if (Array.isArray(node)) {
      node.forEach((item) => walk(item, name));
      return;
    }
    if (node && typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) {
        if (key === 'example' && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')) {
          classify(name || key, value);
        } else if (key === 'examples' && value && typeof value === 'object') {
          for (const ex of Object.values(value)) {
            const v = ex && typeof ex === 'object' && 'value' in ex ? ex.value : ex;
            if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') classify(name || key, v);
          }
        } else {
          walk(value, /^[A-Za-z0-9_.-]+$/.test(key) ? key : name);
        }
      }
    }
  }

  if (spec && typeof spec === 'object') walk(spec);

  const counts = { ids: ids.size, tokens: tokens.size, piiFormats: piiFormats.size };
  return {
    idea: '01288',
    ids: [...ids],
    tokens: [...tokens],
    piiFormats: [...piiFormats],
    counts,
    warning: 'Example values are REDACTED in this report. Never log raw harvested values — they may contain realistic tokens or PII formats.',
  };
}

/* ==========================================================================
 * 01289 — OpenAPI server-URL enumeration
 * ======================================================================= */

/**
 * List every servers.* URL in an OpenAPI spec and classify the environment
 * each points at. Specs routinely enumerate prod, staging and dev base
 * URLs that are invisible from the public docs.
 *
 * @param {object} spec - Parsed OpenAPI document (JSON object).
 * @returns {{idea: string, servers: {url: string, environment: string, variables: object}[]}}
 */
export function enumerateServerUrls(spec = {}) {
  const servers = [];
  const seen = new Set();
  function collect(node) {
    if (Array.isArray(node)) {
      node.forEach(collect);
      return;
    }
    if (node && typeof node === 'object') {
      if (Array.isArray(node.servers)) {
        for (const s of node.servers) {
          if (s && typeof s.url === 'string' && !seen.has(s.url)) {
            seen.add(s.url);
            servers.push({
              url: s.url,
              environment: classifyEnvironment(s.url),
              variables: s.variables && typeof s.variables === 'object' ? s.variables : {},
            });
          }
        }
      }
      for (const value of Object.values(node)) collect(value);
    }
  }
  if (spec && typeof spec === 'object') collect(spec);
  return { idea: '01289', servers };
}

/**
 * Classify an environment label from a server URL.
 * @param {string} url
 * @returns {string} one of production/staging/development/internal/testing/unknown
 */
export function classifyEnvironment(url = '') {
  const u = String(url || '').toLowerCase();
  if (/\b(localhost|127\.0\.0\.1|\.local)\b/.test(u)) return 'testing';
  if (/\b(internal|intranet|corp|backoffice)\b/.test(u)) return 'internal';
  if (/\b(stag(?:ing)?|qa|uat|preview)\b/.test(u)) return 'staging';
  if (/\b(dev(?:elopment)?|sandbox|test)\b/.test(u)) return 'development';
  if (/\b(prod(?:uction)?)\b/.test(u) || /\bapi\./.test(u)) return 'production';
  return 'unknown';
}

/* ==========================================================================
 * 01290 — Callback-URL discovery in OpenAPI specs
 * ======================================================================= */

/**
 * Parse OpenAPI `callbacks` sections: they document the target's outbound
 * webhook contracts — which events the target pushes out and to which
 * URL shapes. Knowing the contract lets the hunt engine recognise
 * webhook-receiver surface on its own infrastructure.
 *
 * @param {object} spec - Parsed OpenAPI document (JSON object).
 * @returns {{idea: string, callbacks: {operation: string, expression: string, method: string, path: string}[]}}
 */
export function discoverCallbacks(spec = {}) {
  const callbacks = [];
  if (spec && typeof spec === 'object') {
    const paths = spec.paths && typeof spec.paths === 'object' ? spec.paths : {};
    for (const [path, pathItem] of Object.entries(paths)) {
      if (pathItem && typeof pathItem === 'object') {
        for (const [method, op] of Object.entries(pathItem)) {
          if (op && typeof op === 'object' && op.callbacks) {
            for (const [expression, cbDef] of Object.entries(op.callbacks)) {
              if (cbDef && typeof cbDef === 'object') {
                for (const [cbMethod, cbOp] of Object.entries(cbDef)) {
                  if (cbOp && typeof cbOp === 'object') {
                    callbacks.push({
                      operation: `${method.toUpperCase()} ${path}`,
                      expression,
                      method: cbMethod.toUpperCase(),
                      path: expression,
                    });
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  return { idea: '01290', callbacks };
}

/* ==========================================================================
 * Finding builder
 * ======================================================================= */

/**
 * Wrap any module result in a standard hunt-engine finding envelope.
 * @param {string} idea - Idea number, e.g. "01281".
 * @param {object} result - The function result to wrap.
 * @returns {object}
 */
export function apiSubdomainChangelogReconFinding(idea = '', result = {}) {
  return {
    engine: 'apiSubdomainChangelogRecon',
    idea: String(idea || ''),
    at: new Date().toISOString(),
    result,
  };
}
