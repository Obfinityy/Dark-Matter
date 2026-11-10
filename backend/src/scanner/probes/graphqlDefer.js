// Dark Matter rule-based scanner — GraphQL @defer / @stream incremental
// delivery abuse probe (coverage row #509 [Medium] GraphQL @defer / @stream
// incremental-delivery abuse, CWE-400 | OWASP A04:2021;
// phase 'graphql-defer').
//
// @defer (and @stream) split one query into an initial payload plus
// incremental payloads delivered over a held connection. Two abuses follow
// from that split, and @include/@skip directive handling folds into the
// same row:
//   (a) GATED-DATA LEAK — a deferred resolver runs under a different auth
//       context from the initial query, so a deferred chunk carries data
//       the plain (non-deferred) query withholds.
//   (b) UNBOUNDED FAN-OUT — the server executes every deferred subtree a
//       client asks for, with no cap: one small request fans out into many
//       executed subtrees, holds the connection open, and amplifies cost.
//   (c) DIRECTIVE FLOODING — @include/@skip branches are evaluated even
//       when the directive excludes them, so skipped work still runs (and
//       skipped data still ships).
//
// ORACLES (differential, each leg repeated — no single response confirms):
//   LEAK — the key set of the deferred response (initial + incremental
//   chunks) is compared with the key set of the identical query without
//   @defer. Extra keys in the deferred chunks, reproduced on repeat, are
//   the leak. Identical key sets stay quiet.
//   AMPLIFICATION, chunk-count — the number of data-bearing incremental
//   chunks for 1 deferred subtree vs 8 deferred subtrees. Confirmed only
//   when the 8-subtree response carries at least 4 data chunks and at
//   least 4x the 1-subtree count, so a server that coalesces or caps
//   deferred work stays quiet. A timing witness is judged independently:
//   baselines of the plain query must be stable and the 8-subtree median
//   must be at least 3x the baseline median and at least 50 ms above it.
//   DIRECTIVE — the same aliased fields are requested with and without
//   @skip(if: true) / @include(if: false). The control (no directives)
//   must return them; the directive leg must NOT. Fields present under
//   the directives, reproduced on repeat, prove the branches ran anyway.
//
// GATES: none beyond the battery itself. Read-only POSTs against the scan
// targets (the same surface graphql.js uses); the largest document carries
// 8 deferred subtrees and no volumetric flooding — small, bounded payloads
// only, no DoS-class behaviour. Runs at every depth including 'quick'.
// Findings are class 'graphql_defer_abuse' — the default confirmation
// protocol judges them on evidence.signalCorrelated.
//
// HONEST LIMITS: mock-server verified only. Juice Shop's /graphql is a
// candidate live surface — verify first, do not assume it supports @defer,
// @stream, or multipart incremental delivery. A server that ignores @defer
// silently (single-payload answer) or rejects it with a validation error
// stays quiet on the defer legs; the directive leg still runs because
// @include/@skip are core spec. The leak leg can only see keys the probe
// asks for — a gated field outside the probe's selections is invisible to
// it. Timing is a secondary witness only; the chunk-count leg is the
// deterministic one.

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const TIMEOUT_MS = 15000;
const GRAPHQL_PATHS = ['/graphql', '/api/graphql', '/graphql/console', '/graphiql', '/.well-known/graphql'];
const MAX_DEFERRED = 8;
const MIN_CHUNKS_MANY = 4;
const CHUNK_RATIO = 4;
const TIME_RATIO = 3;
const TIME_FLOOR_MS = 50;

// The probe accepts (url, opts) like probeGraphql and (url, params, opts)
// like the param-battery probes; the second argument is normalised below.
// The endpoint probe ignores per-param points — it works on the endpoint.
function normalizeOpts(params, opts) {
  // Note: the probe signature defaults opts to {}, so a two-argument call
  // (url, opts) arrives with an empty opts object — treat that as absent
  // and take the options from the second argument instead.
  const optsEmpty = !opts || (typeof opts === 'object' && Object.keys(opts).length === 0);
  if (params && typeof params === 'object' && !Array.isArray(params) && optsEmpty) {
    return params;
  }
  return opts && typeof opts === 'object' ? opts : {};
}

function ev(request, response, impact) {
  return { request, response, impact_demo: impact, signalCorrelated: true };
}

async function post(fetchFn, url, body, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || TIMEOUT_MS);
  const started = Date.now();
  try {
    const res = await fetchFn(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, 'Content-Type': 'application/json', ...(opts.headers || {}) },
      body: JSON.stringify(body),
    });
    const text = await res.text().catch(() => '');
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    let contentType = '';
    try {
      contentType = typeof res.headers?.get === 'function' ? res.headers.get('content-type') || '' : '';
    } catch {
      contentType = '';
    }
    return { ok: true, status: res.status, json, text: text.slice(0, 200000), contentType, ms: Date.now() - started };
  } catch {
    return { ok: false, status: 0, json: null, text: '', contentType: '', ms: Date.now() - started };
  } finally {
    clearTimeout(t);
  }
}

// ---- pure helpers (exported for unit tests) ---------------------------------

/** Median of a numeric array (0 for an empty array). Pure. */
export function median(values) {
  const sorted = [...(values || [])].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Query with `count` deferred subtrees, each aliased so its chunk is
 * identifiable. Bounded: callers never pass more than MAX_DEFERRED. Pure.
 */
export function buildDeferQuery(count) {
  const n = Math.max(1, Math.min(MAX_DEFERRED, count));
  const parts = [];
  for (let i = 0; i < n; i += 1) parts.push(`... @defer { a${i}: __typename }`);
  return `query DmDeferProbe { __typename ${parts.join(' ')} }`;
}

/** The same selections as buildDeferQuery, without @defer. Pure. */
export function buildPlainQuery(count) {
  const n = Math.max(1, Math.min(MAX_DEFERRED, count));
  const parts = [];
  for (let i = 0; i < n; i += 1) parts.push(`a${i}: __typename`);
  return `query DmDeferProbe { __typename ${parts.join(' ')} }`;
}

/**
 * Query whose aliased fields sit under @skip(if: true) and
 * @include(if: false) — both branches must be excluded. Pure.
 */
export function buildIncludeSkipQuery() {
  return 'query DmDirectiveProbe { __typename ... @skip(if: true) { skipped: __typename } ... @include(if: false) { excluded: __typename } }';
}

/** The same aliased fields with no directives (control). Pure. */
export function buildDirectiveControlQuery() {
  return 'query DmDirectiveProbe { __typename skipped: __typename excluded: __typename }';
}

/**
 * Parse a multipart/mixed incremental body into its JSON parts. Returns
 * [] when the text is not multipart with the given boundary. Pure.
 */
export function parseMultipart(text, contentType) {
  const m = /boundary="?([^";\s]+)"?/i.exec(String(contentType || ''));
  if (!m || typeof text !== 'string') return [];
  const delimiter = `--${m[1]}`;
  const parts = [];
  for (const raw of text.split(delimiter)) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === '--') continue;
    const splitAt = trimmed.search(/\r?\n\r?\n/);
    const body = splitAt >= 0 ? trimmed.slice(splitAt).replace(/^\r?\n\r?\n/, '') : trimmed;
    try {
      parts.push(JSON.parse(body));
    } catch {
      // A non-JSON part carries no GraphQL payload; skip it.
    }
  }
  return parts;
}

/**
 * Normalise one @defer response into { chunks, format }: multipart parts,
 * a single JSON body's `incremental` array, or a single payload. Pure.
 */
export function parseDeferResponse({ text, contentType, json }) {
  if (typeof contentType === 'string' && /multipart/i.test(contentType)) {
    return { chunks: parseMultipart(text, contentType), format: 'multipart' };
  }
  if (json && typeof json === 'object' && Array.isArray(json.incremental)) {
    const chunks = [];
    if (json.data !== undefined) chunks.push({ data: json.data });
    for (const inc of json.incremental) chunks.push({ data: inc && inc.data !== undefined ? inc.data : inc });
    return { chunks, format: 'incremental' };
  }
  if (json && typeof json === 'object') return { chunks: [json], format: 'single' };
  return { chunks: [], format: 'unknown' };
}

/** Data-bearing chunks only — error payloads are not executed work. Pure. */
export function countDataChunks(chunks) {
  return (chunks || []).filter((c) => c && typeof c === 'object' && c.data !== null && c.data !== undefined && !c.errors).length;
}

/** All dotted key paths under `data` in a chunk list (recursion, capped). Pure. */
export function collectDataKeys(chunks) {
  const keys = new Set();
  const walk = (value, prefix, depth) => {
    if (depth > 4 || value === null || typeof value !== 'object') return;
    for (const [k, v] of Object.entries(value)) {
      const path = prefix ? `${prefix}.${k}` : k;
      keys.add(path);
      if (v !== null && typeof v === 'object') walk(v, path, depth + 1);
    }
  };
  for (const c of chunks || []) {
    if (c && typeof c === 'object' && c.data && typeof c.data === 'object') walk(c.data, '', 0);
  }
  return keys;
}

/**
 * Leak oracle: keys present in the deferred chunks but absent from the
 * plain response. 'confirmed' only when at least one extra key exists.
 * Pure.
 */
export function assessDeferLeak({ plainKeys, deferredKeys }) {
  const plain = plainKeys instanceof Set ? plainKeys : new Set(plainKeys || []);
  const extra = [...(deferredKeys instanceof Set ? deferredKeys : new Set(deferredKeys || []))].filter((k) => !plain.has(k));
  if (!extra.length) return { verdict: 'rejected', extra, reason: 'deferred chunks carry no keys beyond the plain response' };
  return { verdict: 'confirmed', extra, reason: `deferred chunks carry extra keys the plain query withholds: ${extra.join(', ')}` };
}

/**
 * Chunk-amplification oracle: the many-subtree response must carry at
 * least MIN_CHUNKS_MANY data chunks and at least CHUNK_RATIO times the
 * one-subtree count — a server that coalesces or caps stays quiet. Pure.
 */
export function assessChunkAmplification({ one, many }) {
  if (typeof one !== 'number' || typeof many !== 'number') {
    return { verdict: 'unconfirmed', reason: 'incomplete witness matrix — a request failed' };
  }
  if (many < MIN_CHUNKS_MANY || many < CHUNK_RATIO * Math.max(1, one)) {
    return { verdict: 'rejected', reason: `${many} data chunks for ${MAX_DEFERRED} deferred subtrees vs ${one} for 1 — no unbounded fan-out` };
  }
  return { verdict: 'confirmed', reason: `${many} data chunks for ${MAX_DEFERRED} deferred subtrees vs ${one} for 1 — one request fans out into many executed subtrees` };
}

/**
 * Timing oracle: baselines must be stable (spread within half the
 * median, or within TIME_FLOOR_MS absolute — small medians on a loaded
 * box wobble by tens of milliseconds of pure noise) and the deferred
 * median must be at least TIME_RATIO times the baseline median and
 * TIME_FLOOR_MS above it. Pure.
 */
export function assessTimingAmplification({ baselines, deferred }) {
  const base = median(baselines);
  const def = median(deferred);
  if (!baselines?.length || !deferred?.length || base <= 0) {
    return { verdict: 'unconfirmed', reason: 'incomplete witness matrix — a request failed' };
  }
  const spread = Math.max(...baselines) - Math.min(...baselines);
  if (spread > Math.max(base * 0.5, TIME_FLOOR_MS)) {
    return { verdict: 'unconfirmed', reason: 'plain-query baselines are unstable — timing is not measurable here' };
  }
  if (def < TIME_RATIO * base || def - base < TIME_FLOOR_MS) {
    return { verdict: 'rejected', reason: `deferred median ${def.toFixed(0)} ms vs baseline ${base.toFixed(0)} ms — no timing amplification` };
  }
  return { verdict: 'confirmed', reason: `deferred median ${def.toFixed(0)} ms vs baseline median ${base.toFixed(0)} ms — connection hold grows with deferred-subtree count` };
}

/**
 * Directive oracle: the control must return the aliased fields (proving
 * they exist) and the directive leg must return them too, on both
 * attempts — the excluded branches ran anyway. Pure.
 */
export function assessDirectiveOracle({ controlKeys, legKeys, legRepeatKeys }) {
  const wanted = ['skipped', 'excluded'];
  const controlHas = wanted.every((k) => controlKeys && controlKeys.has(k));
  if (!controlHas) {
    return { verdict: 'unconfirmed', reason: 'control query did not return the aliased fields — the sink is absent' };
  }
  const leaked = wanted.filter((k) => legKeys && legKeys.has(k));
  if (!leaked.length) {
    return { verdict: 'rejected', reason: '@skip/@include branches are honoured — excluded fields stay out of the response' };
  }
  const repeatLeaked = wanted.filter((k) => legRepeatKeys && legRepeatKeys.has(k));
  if (leaked.some((k) => !repeatLeaked.includes(k))) {
    return { verdict: 'unconfirmed', reason: 'directive leg did not reproduce on repeat' };
  }
  return { verdict: 'confirmed', extra: leaked, reason: `excluded fields returned despite the directives: ${leaked.join(', ')}` };
}

// ---- the probe ---------------------------------------------------------------

async function findGraphQLEndpoint(fetchFn, baseUrl, opts, count) {
  const base = String(baseUrl).replace(/\/$/, '');
  for (const p of GRAPHQL_PATHS) {
    const url = base + p;
    count.attempts += 1;
    const r = await post(fetchFn, url, { query: '{__typename}' }, opts);
    if (r.ok && r.json && (r.json.data || r.json.errors)) return url;
  }
  return null;
}

function keysOfResponse(res) {
  if (!res.ok) return new Set();
  const parsed = parseDeferResponse(res);
  return collectDataKeys(parsed.chunks);
}

function deferSupported(res) {
  if (!res.ok) return false;
  // A multipart incremental body has no top-level JSON (res.json is
  // null) — that is the supported case, not a failure. Only a JSON
  // error body rejecting the directive counts as unsupported.
  const errors = res.json && Array.isArray(res.json.errors) ? res.json.errors : [];
  if (errors.some((e) => /@defer|@stream|unknown directive/i.test(String((e && e.message) || '')))) return false;
  const parsed = parseDeferResponse(res);
  return parsed.format !== 'single';
}

export async function probeGraphqlDefer(url, params, opts = {}) {
  const options = normalizeOpts(params, opts);
  const findings = [];
  const diag = options && typeof options.diagnostics === 'object' && options.diagnostics ? options.diagnostics : null;
  const setDiag = (k, v) => {
    if (diag) diag[k] = v;
  };
  const fetchFn = typeof options.fetchFn === 'function' ? options.fetchFn : globalThis.fetch;
  const count = { attempts: 0 };
  setDiag('endpoint', null);

  const endpoint = await findGraphQLEndpoint(fetchFn, url, options, count);
  if (!endpoint) {
    setDiag('attempts', count.attempts);
    return findings;
  }
  setDiag('endpoint', endpoint);

  // Support probe: one deferred subtree. A validation error or a
  // single-payload answer means @defer is not honoured — the defer legs
  // are skipped, but the @include/@skip leg still runs (core spec).
  count.attempts += 1;
  const support = await post(fetchFn, endpoint, { query: buildDeferQuery(1) }, options);
  const supported = deferSupported(support);
  setDiag('deferSupported', supported);

  if (supported) {
    // LEG A — gated-data leak: deferred (n=2) vs plain (n=2) key sets.
    count.attempts += 1;
    const plain = await post(fetchFn, endpoint, { query: buildPlainQuery(2) }, options);
    const plainKeys = keysOfResponse(plain);
    count.attempts += 1;
    const deferred = await post(fetchFn, endpoint, { query: buildDeferQuery(2) }, options);
    const deferredKeys = keysOfResponse(deferred);
    const leak = assessDeferLeak({ plainKeys, deferredKeys });
    setDiag('leakExtra', leak.extra || []);
    if (leak.verdict === 'confirmed') {
      count.attempts += 1;
      const deferredRepeat = await post(fetchFn, endpoint, { query: buildDeferQuery(2) }, options);
      const repeatLeak = assessDeferLeak({ plainKeys, deferredKeys: keysOfResponse(deferredRepeat) });
      if (repeatLeak.verdict === 'confirmed') {
        findings.push({
          class: 'graphql_defer_abuse',
          id: 'graphql-defer-leak',
          title: 'GraphQL @defer incremental payload leaks data the plain query withholds (MEDIUM)',
          severity: 'medium',
          url: endpoint,
          param: '@defer',
          parameter: '@defer',
          evidence: ev(
            `POST ${endpoint} {"query":"${buildDeferQuery(2)}"} vs the identical query without @defer (deferred leg repeated)`,
            `Plain response keys: ${[...plainKeys].join(', ') || '(none)'}; deferred chunks add: ${leak.extra.join(', ')} on both attempts. ${leak.reason}.`,
            'A deferred resolver runs under a different auth context from the initial query — gated data ships in an incremental payload a client can request with a single @defer.',
          ),
        });
      }
    }

    // LEG B — amplification: chunk counts (1 vs 8 subtrees), then timing.
    count.attempts += 1;
    const one = await post(fetchFn, endpoint, { query: buildDeferQuery(1) }, options);
    const oneChunks = countDataChunks(parseDeferResponse(one).chunks);
    count.attempts += 1;
    const many = await post(fetchFn, endpoint, { query: buildDeferQuery(MAX_DEFERRED) }, options);
    const manyChunks = countDataChunks(parseDeferResponse(many).chunks);
    const chunk = assessChunkAmplification({ one: oneChunks, many: manyChunks });
    setDiag('chunksOne', oneChunks);
    setDiag('chunksMany', manyChunks);
    setDiag('chunkAmplified', chunk.verdict === 'confirmed');

    let timing = { verdict: 'rejected', reason: 'timing witness not run — chunk leg decided the finding' };
    if (chunk.verdict !== 'confirmed') {
      // One warm-up plain request first: the first request on a fresh
      // connection routinely measures tens of milliseconds slow, which
      // would poison the baseline median and the stability gate.
      count.attempts += 1;
      await post(fetchFn, endpoint, { query: buildPlainQuery(1) }, options);
      const baselines = [];
      for (let i = 0; i < 3; i += 1) {
        count.attempts += 1;
        baselines.push((await post(fetchFn, endpoint, { query: buildPlainQuery(1) }, options)).ms);
      }
      const deferredTimes = [];
      for (let i = 0; i < 2; i += 1) {
        count.attempts += 1;
        deferredTimes.push((await post(fetchFn, endpoint, { query: buildDeferQuery(MAX_DEFERRED) }, options)).ms);
      }
      timing = assessTimingAmplification({ baselines, deferred: deferredTimes });
      setDiag('baselineMedianMs', median(baselines));
      setDiag('deferredMedianMs', median(deferredTimes));
    }
    setDiag('timingAmplified', timing.verdict === 'confirmed');

    if (chunk.verdict === 'confirmed' || timing.verdict === 'confirmed') {
      const via = chunk.verdict === 'confirmed' ? 'chunk count' : 'timing';
      findings.push({
        class: 'graphql_defer_abuse',
        id: 'graphql-defer-amplification',
        title: 'GraphQL @defer fan-out without limits — one request executes many deferred subtrees (MEDIUM)',
        severity: 'medium',
        url: endpoint,
        param: '@defer',
        parameter: '@defer',
        evidence: ev(
          `POST ${endpoint} {"query":"${buildDeferQuery(MAX_DEFERRED)}"} (8 deferred subtrees) vs {"query":"${buildDeferQuery(1)}"} (1 subtree) and the plain baseline`,
          `Chunk witness (${via}): ${chunk.reason}. Timing witness: ${timing.reason}.`,
          'The server executes every deferred subtree with no cap, so one small request fans out into many executed subtrees and holds the connection open — cost amplification an attacker can repeat at will.',
        ),
      });
    }
  }

  // LEG C — @include/@skip flooding: excluded branches must stay out.
  count.attempts += 1;
  const control = await post(fetchFn, endpoint, { query: buildDirectiveControlQuery() }, options);
  const controlKeys = keysOfResponse(control);
  count.attempts += 1;
  const leg = await post(fetchFn, endpoint, { query: buildIncludeSkipQuery() }, options);
  const legKeys = keysOfResponse(leg);
  // Preliminary check only: control must return the aliased fields and
  // the directive leg must return them too. The repeat below decides.
  const controlHas = ['skipped', 'excluded'].every((k) => controlKeys.has(k));
  const leaked = ['skipped', 'excluded'].filter((k) => legKeys.has(k));
  if (controlHas && leaked.length) {
    // Repeat before confirming — the oracle helper needs the repeat keys.
    count.attempts += 1;
    const legRepeat = await post(fetchFn, endpoint, { query: buildIncludeSkipQuery() }, options);
    const confirmed = assessDirectiveOracle({ controlKeys, legKeys, legRepeatKeys: keysOfResponse(legRepeat) });
    setDiag('directiveLeaked', confirmed.extra || []);
    if (confirmed.verdict === 'confirmed') {
      findings.push({
        class: 'graphql_defer_abuse',
        id: 'graphql-directive-flood',
        title: 'GraphQL @skip/@include branches execute despite exclusion — skipped data still ships (MEDIUM)',
        severity: 'medium',
        url: endpoint,
        param: '@skip/@include',
        parameter: '@skip/@include',
        evidence: ev(
          `POST ${endpoint} {"query":"${buildIncludeSkipQuery()}"} vs the control without directives (directive leg repeated)`,
          `Control returns skipped/excluded fields; the @skip(if: true) / @include(if: false) response still returns: ${confirmed.extra.join(', ')} on both attempts. ${confirmed.reason}.`,
          'Excluded branches are evaluated anyway, so flooding a query with @include/@skip directives still executes the skipped work and ships the skipped data.',
        ),
      });
    }
  } else {
    setDiag('directiveLeaked', []);
  }
  setDiag('attempts', count.attempts);
  return findings;
}

export const __graphqlDeferMeta = { phases: ['graphql-defer'], depth: ['quick', 'standard', 'deep'] };
