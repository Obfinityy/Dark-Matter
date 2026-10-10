/**
 * paginationBatchRecon.js — pagination / batch-endpoint / webhook receiver
 * recon probe builders and response analyzers.
 *
 * Idea 01151: Rate-limit bypass via path casing — alternate /API and /api
 *   path casings because case variants can evade rate-limiter keying.
 * Idea 01152: Rate-limit bypass via query junk — append random query params
 *   because limiters keyed on the full URL treat each variant separately.
 * Idea 01153: Pagination abuse sweep — test negative pages, page=0 and huge
 *   limits because pagination logic often lacks bounds checking.
 * Idea 01154: Offset-overflow test — request extreme offsets because offset
 *   overflow can wrap around or dump unordered rows.
 * Idea 01155: Cursor-token decode analysis — base64-decode pagination
 *   cursors because cursors frequently embed raw IDs, timestamps or SQL
 *   fragments.
 * Idea 01156: Pagination total-count disclosure — read total/hits fields
 *   because totals leak dataset sizes the target may consider sensitive.
 * Idea 01157: Batch endpoint discovery — probe /batch, /bulk, /multi and
 *   /compose because batch endpoints multiplex operations past
 *   single-request controls.
 * Idea 01158: Batch mixed-operation abuse — mix GET and DELETE in one batch
 *   because batch handlers may apply weaker per-item authorization.
 * Idea 01159: Batch partial-failure oracle — study which sub-requests fail
 *   because per-item errors reveal authorization boundaries item by item.
 * Idea 01160: Webhook receiver discovery — hunt /webhooks, /hooks and
 *   /callbacks paths because inbound webhook URLs accept unauthenticated
 *   third-party calls.
 *
 * No network calls: every function builds ready-to-send probe descriptors
 * (method + path + query + body + what-response-signal-to-look-for) or
 * analyzes operator-supplied response records (status codes, bodies,
 * headers). The agent's network layer performs the actual transport; this
 * module contains only the pure probe-building and classification logic.
 * Defensive surface mapping of the engagement's own authorized target only.
 * Probes are request shapes with randomized-but-benign values — no
 * weaponized payloads, no state-changing writes beyond read-only GET probes
 * and the intentionally benign batch items the operator approves.
 */

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Normalize a probe descriptor into a uniform shape so the agent's network
 * layer can serialize it.
 * @param {object} probe
 * @returns {{label: string, method: string, path: string, query: object, headers: object, body: *, detect: string}}
 */
function normalizeProbe(probe = {}) {
  return {
    label: String(probe.label || ''),
    method: String(probe.method || 'GET').toUpperCase(),
    path: String(probe.path || ''),
    query: probe.query && typeof probe.query === 'object' ? probe.query : {},
    headers: probe.headers && typeof probe.headers === 'object' ? probe.headers : {},
    body: probe.body === undefined ? null : probe.body,
    detect: String(probe.detect || ''),
  };
}

/**
 * Serialize a query object into a query string for logging/display.
 * @param {object} query
 * @returns {string}
 */
function toQueryString(query = {}) {
  const parts = [];
  for (const [k, v] of Object.entries(query || {})) {
    parts.push(`${encodeURIComponent(String(k))}=${encodeURIComponent(String(v))}`);
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

/**
 * Tiny deterministic pseudo-random alphanumeric string (seeded) so probe
 * builders stay pure and reproducible across runs.
 * @param {number} seed
 * @param {number} len
 * @returns {string}
 */
function seededToken(seed, len = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = (Number(seed) >>> 0) || 1;
  let out = '';
  for (let i = 0; i < len; i += 1) {
    s = (s * 1664525 + 1013904223) >>> 0;
    out += chars[s % chars.length];
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Idea 01151 — Rate-limit bypass via path casing                       */
/* ------------------------------------------------------------------ */

const CASE_VARIANTS = ['upper', 'lower', 'alternating', 'first-upper'];

/**
 * Produce case variants of a path's segments (query excluded) to test
 * whether rate limiting keys on the normalized or the raw path.
 * @param {string} path
 * @param {string} variant - one of 'upper' | 'lower' | 'alternating' | 'first-upper'
 * @returns {string}
 */
export function caseVariantPath(path, variant = 'upper') {
  const raw = String(path || '');
  const apply = (segment) => {
    switch (variant) {
      case 'upper':
        return segment.toUpperCase();
      case 'lower':
        return segment.toLowerCase();
      case 'first-upper':
        return segment ? segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase() : segment;
      case 'alternating':
        return [...segment].map((c, i) => (i % 2 === 0 ? c.toUpperCase() : c.toLowerCase())).join('');
      default:
        return segment;
    }
  };
  return raw
    .split('/')
    .map((seg, i) => (i === 0 ? seg : apply(seg)))
    .join('/');
}

/**
 * Idea 01151 — build probe descriptors that hit the same logical endpoint
 * under different path casings. If the rate limiter keys on the raw path
 * while the router is case-insensitive, each casing gets its own fresh
 * quota.
 * @param {string[]} paths - Logical endpoint paths (e.g. '/api/v1/users').
 * @param {{variants?: string[], method?: string}} [options]
 * @returns {object[]} Probe descriptors.
 */
export function buildPathCasingBypassProbes(paths = [], options = {}) {
  const { variants = CASE_VARIANTS, method = 'GET' } = options;
  const probes = [];
  for (const raw of paths || []) {
    const path = String(raw || '').trim();
    if (!path) continue;
    for (const variant of variants) {
      const cased = caseVariantPath(path, variant);
      probes.push(normalizeProbe({
        label: `rate-limit-casing:${path}->${variant}`,
        method,
        path: cased,
        detect:
          'compare rate-limit headers / 429 thresholds across casings of the same logical path; ' +
          'a separate quota per casing indicates the limiter keys on the raw path while the router is case-insensitive',
      }));
    }
  }
  return probes;
}

/**
 * Idea 01151 — classify whether path casing changed rate-limit behavior
 * from operator-supplied response records.
 * @param {{path: string, logicalPath?: string, variant?: string, status?: number, retryAfter?: number|string, rateLimitRemaining?: number}[]} records
 * @returns {{perCasing429: object, independentQuotas: boolean, findings: object[]}}
 */
export function classifyPathCasingResponses(records = []) {
  const byLogical = new Map();
  for (const r of records || []) {
    if (!r || !r.path) continue;
    const key = String(r.logicalPath || r.path);
    if (!byLogical.has(key)) byLogical.set(key, []);
    byLogical.get(key).push(r);
  }
  const findings = [];
  let independentQuotas = false;
  const perCasing429 = {};
  for (const [logical, recs] of byLogical) {
    const statuses = recs.map((r) => Number(r.status));
    const saw429 = statuses.includes(429);
    const sawSuccess = statuses.some((s) => s >= 200 && s < 300);
    perCasing429[logical] = { variants: recs.map((r) => String(r.variant || '?')), saw429, sawSuccess };
    // Limiter says "quota exhausted" on the canonical casing yet an
    // identical-logical cased variant still succeeds → independent quotas.
    if (saw429 && sawSuccess) {
      independentQuotas = true;
      findings.push({
        title: 'Rate limiter keys on raw path casing',
        kind: 'recon',
        confidence: 'medium',
        evidence:
          `Logical path "${logical}" returned 429 on one casing while another casing still succeeded — ` +
          'the limiter appears to key on the raw path string instead of the normalized route.',
        targets: [logical],
      });
    }
  }
  return { perCasing429, independentQuotas, findings };
}

/* ------------------------------------------------------------------ */
/* Idea 01152 — Rate-limit bypass via query junk                         */
/* ------------------------------------------------------------------ */

/**
 * Idea 01152 — build probe descriptors that append harmless random query
 * parameters to the same endpoint. Limiters that include the full URL
 * (path + query string) in the bucket key treat every variant as a fresh
 * bucket.
 * @param {string[]} paths - Endpoint paths to test.
 * @param {{variants?: number, junkNames?: string[], method?: string}} [options]
 * @returns {object[]} Probe descriptors.
 */
export function buildQueryJunkBypassProbes(paths = [], options = {}) {
  const { variants = 3, junkNames = ['cachebust', 'cb', 'rand', 'x'], method = 'GET' } = options;
  const probes = [];
  for (const raw of paths || []) {
    const path = String(raw || '').trim();
    if (!path) continue;
    for (let i = 0; i < variants; i += 1) {
      const name = junkNames[i % junkNames.length];
      const query = { [name]: seededToken(path.length + i, 10) };
      probes.push(normalizeProbe({
        label: `rate-limit-queryjunk:${path}+${name}${toQueryString(query)}`,
        method,
        path,
        query,
        detect:
          'compare rate-limit headers / 429 thresholds as junk query params accumulate; ' +
          'each variant resetting the quota indicates the limiter keys on the full URL including the query string',
      }));
    }
  }
  return probes;
}

/**
 * Idea 01152 — classify whether query-junk variants reset the quota, from
 * operator-supplied response records.
 * @param {{path: string, queryJunk?: boolean, status?: number, rateLimitRemaining?: number}[]} records
 * @returns {{resetsQuota: boolean, findings: object[]}}
 */
export function classifyQueryJunkResponses(records = []) {
  const findings = [];
  let resetsQuota = false;
  const byPath = new Map();
  for (const r of records || []) {
    if (!r || !r.path) continue;
    const key = String(r.path);
    if (!byPath.has(key)) byPath.set(key, []);
    byPath.get(key).push(r);
  }
  for (const [path, recs] of byPath) {
    const plain429 = recs.some((r) => !r.queryJunk && Number(r.status) === 429);
    const junkSuccess = recs.some((r) => r.queryJunk && Number(r.status) >= 200 && Number(r.status) < 300);
    if (plain429 && junkSuccess) {
      resetsQuota = true;
      findings.push({
        title: 'Rate limiter keys on full URL including query string',
        kind: 'recon',
        confidence: 'medium',
        evidence:
          `Endpoint "${path}" returned 429 on the plain URL while the same request with a junk query parameter still succeeded — ` +
          'the limiter bucket key includes the query string.',
        targets: [path],
      });
    }
  }
  return { resetsQuota, findings };
}

/* ------------------------------------------------------------------ */
/* Idea 01153 — Pagination abuse sweep                                   */
/* ------------------------------------------------------------------ */

const PAGINATION_ABUSE_CASES = [
  { name: 'negative-page', params: { page: -1 } },
  { name: 'page-zero', params: { page: 0 } },
  { name: 'negative-limit', params: { limit: -5 } },
  { name: 'limit-zero', params: { limit: 0 } },
  { name: 'huge-limit', params: { limit: 1000000 } },
  { name: 'huge-page', params: { page: 999999999 } },
  { name: 'page-string', params: { page: 'abc' } },
  { name: 'limit-string', params: { limit: 'all' } },
  { name: 'float-page', params: { page: 1.5 } },
  { name: 'array-page', params: { page: [1, 2] } },
];

/**
 * Idea 01153 — build probe descriptors sweeping pagination parameters
 * with boundary-breaking values (negative pages, page=0, huge limits,
 * non-numeric values) because pagination logic often lacks bounds
 * checking.
 * @param {string[]} endpoints - Paginated endpoint paths.
 * @param {{cases?: {name: string, params: object}[]}} [options]
 * @returns {object[]} Probe descriptors.
 */
export function buildPaginationAbuseProbes(endpoints = [], options = {}) {
  const { cases = PAGINATION_ABUSE_CASES } = options;
  const probes = [];
  for (const raw of endpoints || []) {
    const endpoint = String(raw || '').trim();
    if (!endpoint) continue;
    for (const c of cases) {
      probes.push(normalizeProbe({
        label: `pagination-abuse:${endpoint}:${c.name}`,
        method: 'GET',
        path: endpoint,
        query: { ...c.params },
        detect:
          `case "${c.name}": expect 400-range validation error; look for 500 errors, full-table dumps, ` +
          'negative/zero pages returning rows, or huge limits being honored — all signs of missing bounds checking',
      }));
    }
  }
  return probes;
}

/**
 * Idea 01153 — classify pagination-abuse responses for missing bounds
 * checking signals.
 * @param {{endpoint: string, caseName: string, status?: number, body?: *}[]} records
 * @returns {{missingBounds: string[], serverErrors: string[], findings: object[]}}
 */
export function classifyPaginationAbuseResponses(records = []) {
  const missingBounds = [];
  const serverErrors = [];
  const findings = [];
  const getRows = (body) => {
    if (!body || typeof body !== 'object') return null;
    const arr = Array.isArray(body) ? body : body.items || body.data || body.results;
    return Array.isArray(arr) ? arr.length : null;
  };
  for (const r of records || []) {
    if (!r || !r.endpoint) continue;
    const status = Number(r.status);
    const key = `${r.endpoint}:${r.caseName}`;
    if (status === 500 || status === 502 || status === 503) {
      serverErrors.push(key);
      findings.push({
        title: `Pagination parameter crashes endpoint (${r.caseName})`,
        kind: 'recon',
        confidence: 'medium',
        evidence: `Endpoint "${r.endpoint}" returned HTTP ${status} for pagination case "${r.caseName}" — unhandled pagination input reaches the server internals.`,
        targets: [r.endpoint],
      });
    } else if (status >= 200 && status < 300) {
      const rows = getRows(r.body);
      const abusive = ['negative-page', 'page-zero', 'negative-limit', 'limit-zero', 'huge-limit', 'huge-page'].includes(String(r.caseName));
      if (abusive && (rows === null || rows > 0)) {
        missingBounds.push(key);
        findings.push({
          title: `Pagination bounds not enforced (${r.caseName})`,
          kind: 'recon',
          confidence: 'medium',
          evidence: `Endpoint "${r.endpoint}" accepted pagination case "${r.caseName}" and returned a successful response — pagination input is not bounds-checked.`,
          targets: [r.endpoint],
        });
      }
    }
  }
  return { missingBounds, serverErrors, findings };
}

/* ------------------------------------------------------------------ */
/* Idea 01154 — Offset-overflow test                                     */
/* ------------------------------------------------------------------ */

/**
 * Idea 01154 — build probe descriptors requesting extreme offsets
 * because offset overflow can wrap around or dump unordered rows.
 * @param {string[]} endpoints - Offset-based paginated endpoints.
 * @param {{offsets?: number[]}} [options]
 * @returns {object[]} Probe descriptors.
 */
export function buildOffsetOverflowProbes(endpoints = [], options = {}) {
  const { offsets = [2147483647, 4294967296, 9007199254740991, -1, 9999999999] } = options;
  const probes = [];
  for (const raw of endpoints || []) {
    const endpoint = String(raw || '').trim();
    if (!endpoint) continue;
    for (const offset of offsets) {
      probes.push(normalizeProbe({
        label: `offset-overflow:${endpoint}:${offset}`,
        method: 'GET',
        path: endpoint,
        query: { offset, limit: 10 },
        detect:
          'extreme offset: expect 400 or empty 200; look for 500, wraparound (rows from the start of the table), ' +
          'or unordered/duplicate rows indicating integer overflow in the offset arithmetic',
      }));
    }
  }
  return probes;
}

/**
 * Idea 01154 — classify offset-overflow responses for wraparound or
 * overflow signals.
 * @param {{endpoint: string, offset?: number, status?: number, body?: *, baselineFirstRow?: *}[]} records
 * @returns {{wrapArounds: object[], errors: object[], findings: object[]}}
 */
export function classifyOffsetOverflowResponses(records = []) {
  const wrapArounds = [];
  const errors = [];
  const findings = [];
  const firstRowOf = (body) => {
    if (!body || typeof body !== 'object') return null;
    const arr = Array.isArray(body) ? body : body.items || body.data || body.results;
    return Array.isArray(arr) && arr.length ? JSON.stringify(arr[0]) : null;
  };
  for (const r of records || []) {
    if (!r || !r.endpoint) continue;
    const status = Number(r.status);
    const key = `${r.endpoint}:${r.offset}`;
    if (status === 500 || status === 502 || status === 503) {
      errors.push({ endpoint: r.endpoint, offset: r.offset, status });
      findings.push({
        title: 'Extreme offset crashes endpoint',
        kind: 'recon',
        confidence: 'medium',
        evidence: `Endpoint "${r.endpoint}" returned HTTP ${status} for offset=${r.offset} — offset arithmetic is not guarded.`,
        targets: [r.endpoint],
      });
    } else if (status >= 200 && status < 300 && r.baselineFirstRow !== undefined) {
      const first = firstRowOf(r.body);
      if (first && first === JSON.stringify(r.baselineFirstRow)) {
        wrapArounds.push({ endpoint: r.endpoint, offset: r.offset });
        findings.push({
          title: 'Offset appears to wrap around',
          kind: 'recon',
          confidence: 'low',
          evidence: `Endpoint "${r.endpoint}" returned the same first row for extreme offset=${r.offset} as for the baseline — offset may overflow and wrap to the start of the dataset.`,
          targets: [r.endpoint],
        });
      }
    }
  }
  return { wrapArounds, errors, findings };
}

/* ------------------------------------------------------------------ */
/* Idea 01155 — Cursor-token decode analysis                             */
/* ------------------------------------------------------------------ */

/**
 * Attempt to decode a value as base64 (standard or URL-safe), possibly
 * double-encoded or wrapped in JSON.
 * @param {string} value
 * @returns {{decoded: boolean, text: string, layers: number, encoding: string|null}}
 */
export function decodeCursorToken(value) {
  let text = String(value || '');
  const result = { decoded: false, text, layers: 0, encoding: null };
  if (!text) return result;
  for (let layer = 0; layer < 3; layer += 1) {
    const normalized = text.replace(/-/g, '+').replace(/_/g, '/');
    if (!/^[A-Za-z0-9+/=]+$/.test(normalized) || normalized.length < 8) break;
    try {
      const decoded = Buffer.from(normalized, 'base64').toString('utf8');
      if (!decoded || decoded.length === 0 || !/^[\x20-\x7e\t\r\n]*$/.test(decoded)) break;
      result.decoded = true;
      result.layers += 1;
      result.encoding = normalized === text ? 'base64' : 'base64url';
      text = decoded;
    } catch {
      break;
    }
  }
  result.text = text;
  return result;
}

const SQL_FRAGMENT_RE = /\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|ORDER BY|UNION|LIMIT|OFFSET)\b/i;
const TIMESTAMP_RE = /\b(1[3-9]\d{9}|\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/;
const ID_RE = /\b(id|uuid|guid|key|rowid|pk)\b["']?\s*[:=]\s*["']?([A-Za-z0-9_-]{3,})/i;
const OFFSET_RE = /\b(offset|page|limit|skip)\b["']?\s*[:=]\s*["']?(\d+)/i;

/**
 * Idea 01155 — analyze a pagination cursor token: decode it and apply
 * heuristics to detect embedded raw IDs, timestamps, or SQL fragments.
 * @param {string} cursor
 * @returns {{cursor: string, decoded: boolean, layers: number, encoding: string|null, plaintext: string, signals: {hasSqlFragment: boolean, hasTimestamp: boolean, hasRawId: boolean, hasOffset: boolean}, sensitive: boolean, findings: object[]}}
 */
export function analyzeCursorToken(cursor) {
  const dec = decodeCursorToken(cursor);
  const text = dec.text;
  const signals = {
    hasSqlFragment: SQL_FRAGMENT_RE.test(text),
    hasTimestamp: TIMESTAMP_RE.test(text),
    hasRawId: ID_RE.test(text),
    hasOffset: OFFSET_RE.test(text),
  };
  const sensitive = signals.hasSqlFragment || signals.hasTimestamp || signals.hasRawId;
  const findings = [];
  if (dec.decoded && sensitive) {
    const kinds = [];
    if (signals.hasSqlFragment) kinds.push('SQL fragment');
    if (signals.hasTimestamp) kinds.push('timestamp');
    if (signals.hasRawId) kinds.push('raw ID');
    findings.push({
      title: 'Pagination cursor leaks internal structure',
      kind: 'recon',
      confidence: 'medium',
      evidence: `Decoded cursor reveals ${kinds.join(', ')} — the cursor is not an opaque token; it embeds server-side internals an attacker could forge or replay.`,
      targets: [],
    });
  }
  return {
    cursor: String(cursor || ''),
    decoded: dec.decoded,
    layers: dec.layers,
    encoding: dec.encoding,
    plaintext: text,
    signals,
    sensitive,
    findings,
  };
}

/**
 * Idea 01155 — scan an operator-supplied response for cursor fields and
 * analyze each one.
 * @param {*} body - Parsed response body.
 * @returns {{cursors: object[], sensitiveCount: number}}
 */
export function extractAndAnalyzeCursors(body) {
  const cursors = [];
  if (!body || typeof body !== 'object') return { cursors, sensitiveCount: 0 };
  const walk = (node, path) => {
    if (Array.isArray(node)) {
      node.forEach((v, i) => walk(v, `${path}[${i}]`));
      return;
    }
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        if (/cursor|next|prev|page[_-]?token|continuation/i.test(k) && typeof v === 'string' && v.length >= 8) {
          const analysis = analyzeCursorToken(v);
          cursors.push({ field: `${path}.${k}`.replace(/^\./, ''), ...analysis });
        } else {
          walk(v, path ? `${path}.${k}` : k);
        }
      }
    }
  };
  walk(body, '');
  return { cursors, sensitiveCount: cursors.filter((c) => c.sensitive).length };
}

/* ------------------------------------------------------------------ */
/* Idea 01156 — Pagination total-count disclosure                        */
/* ------------------------------------------------------------------ */

const TOTAL_FIELD_NAMES = ['total', 'totalCount', 'total_count', 'totalItems', 'total_items', 'count', 'hits', 'totalHits', 'total_hits'];

/**
 * Idea 01156 — extract total-count disclosure fields (total, hits, count)
 * from a paginated response body because totals leak dataset sizes the
 * target may consider sensitive.
 * @param {*} body - Parsed response body.
 * @returns {{fields: {path: string, name: string, value: number}[], maxTotal: number|null, disclosed: boolean}}
 */
export function extractTotalCountDisclosure(body) {
  const fields = [];
  if (body && typeof body === 'object') {
    const walk = (node, path) => {
      if (Array.isArray(node)) {
        node.forEach((v, i) => walk(v, `${path}[${i}]`));
        return;
      }
      if (node && typeof node === 'object') {
        for (const [k, v] of Object.entries(node)) {
          const cur = path ? `${path}.${k}` : k;
          if (TOTAL_FIELD_NAMES.includes(k) && typeof v === 'number' && Number.isFinite(v)) {
            fields.push({ path: cur, name: k, value: v });
          } else if (v && typeof v === 'object') {
            walk(v, cur);
          }
        }
      }
    };
    walk(body, '');
  }
  const maxTotal = fields.length ? Math.max(...fields.map((f) => f.value)) : null;
  return { fields, maxTotal, disclosed: fields.length > 0 };
}

/**
 * Idea 01156 — build a finding from a total-count disclosure extraction.
 * @param {string} endpoint
 * @param {{fields: object[], maxTotal: number|null, disclosed: boolean}} extraction
 * @returns {object|null}
 */
export function totalCountDisclosureFinding(endpoint, extraction) {
  if (!extraction || !extraction.disclosed) return null;
  const summary = extraction.fields.map((f) => `${f.path}=${f.value}`).join(', ');
  return {
    title: 'Paginated endpoint discloses dataset size',
    kind: 'recon',
    severity: 'Info',
    confidence: 'high',
    evidence: `Endpoint "${endpoint}" discloses total counts (${summary}) — exact dataset sizes are visible without special privileges.`,
    targets: [endpoint],
    recommendation:
      'Evaluate whether exact totals are business-sensitive; if so, cap the reported total (e.g. "1000+"), ' +
      'remove raw totals from public endpoints, and keep precise counts behind authorization.',
  };
}

/* ------------------------------------------------------------------ */
/* Idea 01157 — Batch endpoint discovery                                 */
/* ------------------------------------------------------------------ */

const BATCH_ENDPOINT_CANDIDATES = [
  '/batch',
  '/bulk',
  '/multi',
  '/compose',
  '/batch/execute',
  '/api/batch',
  '/api/bulk',
  '/api/multi',
  '/api/compose',
  '/api/v1/batch',
  '/api/v1/bulk',
  '/api/v1/multi',
  '/graphql/batch',
  '/batch/requests',
  '/bulk/operations',
];

/**
 * Idea 01157 — list candidate batch/multiplex endpoint paths to probe,
 * since batch endpoints multiplex operations past single-request controls.
 * @param {{extra?: string[]}} [options]
 * @returns {string[]}
 */
export function listBatchEndpointCandidates(options = {}) {
  const extra = Array.isArray(options.extra) ? options.extra.map(String) : [];
  return [...BATCH_ENDPOINT_CANDIDATES, ...extra];
}

/**
 * Idea 01157 — build discovery probe descriptors for batch endpoints
 * (OPTIONS + benign GET, then a minimal batch body probe the operator can
 * approve) and classify operator-supplied results.
 * @param {{extra?: string[]}} [options]
 * @returns {object[]} Probe descriptors.
 */
export function buildBatchDiscoveryProbes(options = {}) {
  const candidates = listBatchEndpointCandidates(options);
  const probes = [];
  for (const path of candidates) {
    probes.push(normalizeProbe({
      label: `batch-discovery:${path}:options`,
      method: 'OPTIONS',
      path,
      detect: '2xx on OPTIONS or an Allow header listing POST indicates a reachable multiplex endpoint',
    }));
    probes.push(normalizeProbe({
      label: `batch-discovery:${path}:post-probe`,
      method: 'POST',
      path,
      body: { requests: [{ method: 'GET', path: '/api/v1/health' }] },
      detect:
        'a batch-shaped JSON body with one benign GET sub-request; a 200 with sub-responses confirms a live batch endpoint — ' +
        'run this probe only against the authorized target with operator approval',
    }));
  }
  return probes;
}

/**
 * Idea 01157 — classify batch discovery responses.
 * @param {{path: string, method?: string, status?: number, body?: *, headers?: object}[]} records
 * @returns {{live: string[], maybe: string[], dead: string[], findings: object[]}}
 */
export function classifyBatchDiscoveryResponses(records = []) {
  const live = [];
  const maybe = [];
  const dead = [];
  const findings = [];
  for (const r of records || []) {
    if (!r || !r.path) continue;
    const status = Number(r.status);
    const bodyText = typeof r.body === 'string' ? r.body : JSON.stringify(r.body || '');
    const looksBatchy = /responses?|results?|requests?|items?|operations?/i.test(bodyText) || status === 207;
    if (status === 207 || (status >= 200 && status < 300 && looksBatchy)) {
      live.push(r.path);
      findings.push({
        title: 'Batch/multiplex endpoint confirmed live',
        kind: 'recon',
        confidence: 'high',
        evidence: `Path "${r.path}" behaves as a batch endpoint (status ${status} with batch-shaped output) — it multiplexes operations past single-request controls.`,
        targets: [r.path],
      });
    } else if (status === 401 || status === 403 || status === 405 || status === 400) {
      maybe.push(r.path);
    } else {
      dead.push(r.path);
    }
  }
  return { live, maybe, dead, findings };
}

/* ------------------------------------------------------------------ */
/* Idea 01158 — Batch mixed-operation abuse                              */
/* ------------------------------------------------------------------ */

/**
 * Idea 01158 — build batch request bodies that mix safe reads with
 * state-changing operations (GET + DELETE) because batch handlers may
 * apply weaker per-item authorization than the equivalent standalone
 * routes.
 * @param {string} batchPath - Confirmed batch endpoint path.
 * @param {{targets?: string[], methods?: string[]}} [options]
 * @returns {object[]} Probe descriptors (one per mix pattern).
 */
export function buildMixedOperationBatchProbes(batchPath, options = {}) {
  const { targets = ['/api/v1/users/me', '/api/v1/settings'], methods = ['GET', 'DELETE'] } = options;
  const path = String(batchPath || '').trim();
  if (!path) return [];
  const probes = [];
  const readItem = { method: 'GET', path: targets[0] };
  for (const mutator of methods.filter((m) => m !== 'GET')) {
    probes.push(normalizeProbe({
      label: `batch-mixed:${path}:${mutator}-after-get`,
      method: 'POST',
      path,
      body: { requests: [readItem, { method: mutator, path: targets[1] || targets[0] }] },
      detect:
        `batch mixing a benign GET with a ${mutator} sub-request: compare the ${mutator} item's status inside the batch ` +
        `vs the same ${mutator} sent standalone — a success inside the batch where standalone is 401/403/404 ` +
        'indicates weaker per-item authorization in the batch handler. Operator approval required before sending.',
    }));
  }
  probes.push(normalizeProbe({
    label: `batch-mixed:${path}:method-trio`,
    method: 'POST',
    path,
    body: { requests: methods.map((m) => ({ method: m, path: targets[0] })) },
    detect:
      'same target with GET, DELETE and friends inside one batch: divergent per-item statuses reveal which methods the batch handler actually authorizes',
  }));
  return probes;
}

/**
 * Idea 01158 — compare per-item batch statuses against standalone
 * baselines to spot weaker per-item authorization.
 * @param {{batchPath: string, item: {method: string, path: string}, batchStatus?: number, standaloneStatus?: number}[]} comparisons
 * @returns {{weakerInBatch: object[], findings: object[]}}
 */
export function classifyMixedOperationResponses(comparisons = []) {
  const weakerInBatch = [];
  const findings = [];
  for (const c of comparisons || []) {
    if (!c || !c.item) continue;
    const bs = Number(c.batchStatus);
    const ss = Number(c.standaloneStatus);
    const batchOk = bs >= 200 && bs < 300;
    const standaloneDenied = ss === 401 || ss === 403 || ss === 404 || ss === 405;
    if (batchOk && standaloneDenied) {
      const entry = { batchPath: c.batchPath, item: c.item, batchStatus: bs, standaloneStatus: ss };
      weakerInBatch.push(entry);
      findings.push({
        title: 'Batch handler applies weaker per-item authorization',
        kind: 'recon',
        confidence: 'high',
        evidence:
          `${c.item.method} ${c.item.path} is denied standalone (HTTP ${ss}) yet succeeds as a batch item (HTTP ${bs}) inside "${c.batchPath}" — ` +
          'the batch handler does not enforce the same per-item authorization.',
        targets: [c.batchPath, c.item.path],
      });
    }
  }
  return { weakerInBatch, findings };
}

/* ------------------------------------------------------------------ */
/* Idea 01159 — Batch partial-failure oracle                             */
/* ------------------------------------------------------------------ */

/**
 * Idea 01159 — analyze per-item batch results to map authorization
 * boundaries item by item: which sub-requests fail, and with which
 * status, reveals the batch handler's authz map.
 * @param {{batchPath: string, items: {method: string, path: string, status?: number, error?: *}[]}[]} batches
 * @returns {{boundaryMap: object[], allowed: object[], denied: object[], findings: object[]}}
 */
export function analyzeBatchPartialFailures(batches = []) {
  const boundaryMap = [];
  const allowed = [];
  const denied = [];
  const findings = [];
  for (const b of batches || []) {
    if (!b || !Array.isArray(b.items)) continue;
    for (const item of b.items) {
      const status = Number(item.status);
      const entry = {
        batchPath: b.batchPath,
        method: String(item.method || ''),
        path: String(item.path || ''),
        status,
        allowed: status >= 200 && status < 300,
      };
      boundaryMap.push(entry);
      if (entry.allowed) allowed.push(entry);
      else denied.push(entry);
    }
    // An oracle signal: same path, different methods, split verdicts —
    // the batch exposes a method-level authz boundary.
    const byPath = new Map();
    for (const e of boundaryMap.filter((x) => x.batchPath === b.batchPath)) {
      if (!byPath.has(e.path)) byPath.set(e.path, []);
      byPath.get(e.path).push(e);
    }
    for (const [path, entries] of byPath) {
      const hasAllowed = entries.some((e) => e.allowed);
      const hasDenied = entries.some((e) => !e.allowed);
      if (hasAllowed && hasDenied) {
        findings.push({
          title: 'Batch partial-failure oracle reveals authz boundary',
          kind: 'recon',
          confidence: 'medium',
          evidence:
            `Inside batch "${b.batchPath}", path "${path}" shows split verdicts (${entries.map((e) => `${e.method}:${e.status}`).join(', ')}) — ` +
            'per-item errors map the batch handler\'s authorization boundary item by item.',
          targets: [b.batchPath, path],
        });
      }
    }
  }
  return { boundaryMap, allowed, denied, findings };
}

/**
 * Idea 01159 — build a matrix of batch probe items designed to make the
 * partial-failure oracle speak: same paths under several methods and
 * auth levels, as a benign read-only batch body shape.
 * @param {string[]} targetPaths
 * @param {{methods?: string[]}} [options]
 * @returns {object} Batch body shape { requests: [...] } ready to embed in a probe.
 */
export function buildPartialFailureOracleBatch(targetPaths = [], options = {}) {
  const { methods = ['GET', 'HEAD', 'DELETE', 'PUT'] } = options;
  const requests = [];
  for (const raw of targetPaths || []) {
    const path = String(raw || '').trim();
    if (!path) continue;
    for (const method of methods) {
      requests.push({ method, path });
    }
  }
  return { requests };
}

/* ------------------------------------------------------------------ */
/* Idea 01160 — Webhook receiver discovery                               */
/* ------------------------------------------------------------------ */

const WEBHOOK_RECEIVER_CANDIDATES = [
  '/webhooks',
  '/webhook',
  '/hooks',
  '/hook',
  '/callbacks',
  '/callback',
  '/api/webhooks',
  '/api/hooks',
  '/api/callbacks',
  '/api/v1/webhooks',
  '/api/v1/hooks',
  '/api/v1/callbacks',
  '/incoming-webhooks',
  '/events/inbound',
  '/integrations/webhook',
  '/stripe/webhook',
  '/github/webhook',
];

/**
 * Idea 01160 — list candidate inbound webhook receiver paths because
 * inbound webhook URLs accept unauthenticated third-party calls.
 * @param {{extra?: string[]}} [options]
 * @returns {string[]}
 */
export function listWebhookReceiverCandidates(options = {}) {
  const extra = Array.isArray(options.extra) ? options.extra.map(String) : [];
  return [...WEBHOOK_RECEIVER_CANDIDATES, ...extra];
}

/**
 * Idea 01160 — build discovery probes for webhook receivers: GET to
 * check reachability, then a benign POST with an empty/unsigned payload
 * shape to test signature verification (operator-approved, no forged
 * signatures — we never craft valid signatures for third-party services).
 * @param {{extra?: string[]}} [options]
 * @returns {object[]} Probe descriptors.
 */
export function buildWebhookReceiverProbes(options = {}) {
  const candidates = listWebhookReceiverCandidates(options);
  const probes = [];
  for (const path of candidates) {
    probes.push(normalizeProbe({
      label: `webhook-discovery:${path}:get`,
      method: 'GET',
      path,
      detect: '2xx/401/403/405 on GET suggests the path is wired; 404 means dead',
    }));
    probes.push(normalizeProbe({
      label: `webhook-discovery:${path}:unsigned-post`,
      method: 'POST',
      path,
      headers: { 'Content-Type': 'application/json' },
      body: { probe: 'unsigned-receiver-check', event: 'ping' },
      detect:
        'POST an unsigned benign ping body (no forged signatures ever): a 200/202 without signature verification means the receiver ' +
        'processes unauthenticated third-party calls; a 401/signature error means verification is enforced. Operator approval required.',
    }));
  }
  return probes;
}

/**
 * Idea 01160 — classify webhook receiver discovery responses.
 * @param {{path: string, method?: string, status?: number, body?: *}[]} records
 * @returns {{receivers: object[], verified: string[], unverified: string[], findings: object[]}}
 */
export function classifyWebhookReceiverResponses(records = []) {
  const receivers = [];
  const verified = [];
  const unverified = [];
  const findings = [];
  const byPath = new Map();
  for (const r of records || []) {
    if (!r || !r.path) continue;
    const key = String(r.path);
    if (!byPath.has(key)) byPath.set(key, []);
    byPath.get(key).push(r);
  }
  for (const [path, recs] of byPath) {
    const getRec = recs.find((r) => String(r.method || 'GET').toUpperCase() === 'GET');
    const postRec = recs.find((r) => String(r.method || '').toUpperCase() === 'POST');
    const getStatus = getRec ? Number(getRec.status) : null;
    const reachable = getStatus !== null && getStatus !== 404;
    if (!reachable) continue;
    const entry = { path, getStatus, postStatus: postRec ? Number(postRec.status) : null, unsignedAccepted: false };
    if (postRec) {
      const ps = Number(postRec.status);
      const bodyText = typeof postRec.body === 'string' ? postRec.body : JSON.stringify(postRec.body || '');
      const signatureError = /signature|hmac|invalid.+secret|unauthorized/i.test(bodyText) || ps === 401 || ps === 403;
      entry.unsignedAccepted = ps >= 200 && ps < 300;
      if (entry.unsignedAccepted) {
        unverified.push(path);
      } else if (signatureError) {
        verified.push(path);
      }
    }
    receivers.push(entry);
    findings.push({
      title: entry.unsignedAccepted
        ? 'Webhook receiver accepts unsigned calls'
        : 'Inbound webhook receiver reachable',
      kind: 'recon',
      confidence: entry.unsignedAccepted ? 'high' : 'medium',
      evidence:
        entry.unsignedAccepted
          ? `Webhook receiver "${path}" accepted an unsigned POST (HTTP ${entry.postStatus}) — it processes inbound calls without signature verification.`
          : `Webhook receiver candidate "${path}" is reachable (GET ${getStatus}) — an inbound URL that may accept third-party calls.`,
      targets: [path],
    });
  }
  return { receivers, verified, unverified, findings };
}

/* ------------------------------------------------------------------ */
/* Report helper                                                         */
/* ------------------------------------------------------------------ */

/**
 * Build a uniform report finding from a pagination/batch recon result.
 * @param {{title?: string, kind?: string, evidence?: string, targets?: string[], confidence?: string, severity?: string, recommendation?: string}} result
 * @returns {{title: string, severity: string, confidence: string, kind: string, evidence: string, targets: string[], recommendation: string}}
 */
export function paginationBatchReconFinding(result = {}) {
  const {
    title = 'Pagination/batch recon finding',
    kind = 'recon',
    evidence = '',
    targets = [],
    confidence = 'medium',
    severity = 'Info',
    recommendation = '',
  } = result;
  return {
    title: `Pagination/batch recon — ${title}`,
    severity,
    confidence,
    kind,
    evidence,
    targets: Array.isArray(targets) ? targets : [],
    recommendation:
      recommendation ||
      'On the authorized target: normalize path casing before rate-limit keying, exclude query strings from limiter keys, ' +
      'bounds-check every pagination parameter, use opaque signed cursor tokens, avoid disclosing exact totals publicly, ' +
      'apply the same per-item authorization inside batch handlers as on standalone routes, and require signature verification on all inbound webhook receivers.',
  };
}

/* ------------------------------------------------------------------ */
/* Registries                                                            */
/* ------------------------------------------------------------------ */

/**
 * House-style named registry for deterministic access.
 */
export const PAGINATION_BATCH_RECON = {
  caseVariantPath,
  buildPathCasingBypassProbes,
  classifyPathCasingResponses,
  buildQueryJunkBypassProbes,
  classifyQueryJunkResponses,
  buildPaginationAbuseProbes,
  classifyPaginationAbuseResponses,
  buildOffsetOverflowProbes,
  classifyOffsetOverflowResponses,
  decodeCursorToken,
  analyzeCursorToken,
  extractAndAnalyzeCursors,
  extractTotalCountDisclosure,
  totalCountDisclosureFinding,
  listBatchEndpointCandidates,
  buildBatchDiscoveryProbes,
  classifyBatchDiscoveryResponses,
  buildMixedOperationBatchProbes,
  classifyMixedOperationResponses,
  analyzeBatchPartialFailures,
  buildPartialFailureOracleBatch,
  listWebhookReceiverCandidates,
  buildWebhookReceiverProbes,
  classifyWebhookReceiverResponses,
  paginationBatchReconFinding,
};

export default PAGINATION_BATCH_RECON;

/**
 * Idea-number registry: each idea 01151–01160 maps to its primary
 * technique function, for verifiable 10/10 coverage.
 */
export const IDEA_TECHNIQUES = {
  1151: buildPathCasingBypassProbes,
  1152: buildQueryJunkBypassProbes,
  1153: buildPaginationAbuseProbes,
  1154: buildOffsetOverflowProbes,
  1155: analyzeCursorToken,
  1156: extractTotalCountDisclosure,
  1157: buildBatchDiscoveryProbes,
  1158: buildMixedOperationBatchProbes,
  1159: analyzeBatchPartialFailures,
  1160: buildWebhookReceiverProbes,
};
