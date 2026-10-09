/**
 * graphFederationGrpcRecon.js — GraphQL federation + gRPC discovery recon engine.
 *
 * Idea 01021: build self-referencing / mutually-recursive fragment probes to test
 *   whether an authorized target rejects cyclic fragments (expensive resolver loops).
 * Idea 01022: build an incrementally-nested selection ladder and interpret the
 *   responses to measure the server's depth limit (missing limits enable deeply
 *   nested resource exhaustion).
 * Idea 01023: craft high-multiplier nested list queries and infer from response
 *   metadata whether the server computes query cost before execution.
 * Idea 01024: return the canonical federation `_service { sdl }` probe query that
 *   reveals the composed supergraph schema on federated gateways.
 * Idea 01025: build `_entities` representation payload descriptors from a type
 *   name and its key fields to map entity-resolution reach into subgraphs.
 * Idea 01026: extract subgraph URLs from supergraph SDL text (subgraphs often
 *   skip gateway-level authorization when hit directly).
 * Idea 01027: parse `@key` directives from SDL — key fields are the exact
 *   identifiers needed for cross-subgraph object references.
 * Idea 01028: compare `_service` probe vs baseline responses and header behavior
 *   to fingerprint schema-stitching vs Apollo federation gateways.
 * Idea 01029: describe the `grpc.reflection.v1alpha.ServerReflection` call and
 *   its probe request messages (reflection returns every service, method and
 *   proto descriptor).
 * Idea 01030: enumerate candidate web-root paths for `.proto` files and binary
 *   descriptor sets (teams disable reflection but leave protos downloadable).
 *
 * Defensive surface-mapping of the engagement's own target. This module performs
 * NO network calls: it builds probe query descriptors, parses operator-supplied
 * SDL / response text, and assembles report findings. The agent's network layer
 * owns transport; every query here is executed only against authorized targets.
 */

/**
 * Keep a GraphQL identifier safe: letters, digits, underscore; must not start
 * with a digit; fall back to a sane default.
 * @param {string} raw
 * @param {string} fallback
 * @returns {string}
 */
function safeIdentifier(raw, fallback) {
  let name = String(raw || '').replace(/[^A-Za-z0-9_]/g, '');
  if (/^[0-9]/.test(name)) name = `_${name}`;
  if (!name || /^__/.test(name)) return fallback;
  return name;
}

// ---------------------------------------------------------------------------
// Idea 01021 — GraphQL fragment cycle test
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} FragmentProbe
 * @property {string} label - Probe variant ('self-spread' | 'mutual-recursion' | 'deep-cycle').
 * @property {string} query - GraphQL query text embedding the cyclic fragment(s).
 * @property {string} intent - What a rejection / acceptance tells the operator.
 */

/**
 * Build self-referencing fragment probes. A server that accepts any of these
 * risks expensive cyclic resolver loops; a correct server rejects the query at
 * validation time with a fragment-cycle error.
 * @param {string} [fragmentName='CycleProbe'] - Base name for generated fragments.
 * @returns {FragmentProbe[]}
 */
export function cyclicFragmentQueries(fragmentName = 'CycleProbe') {
  const base = safeIdentifier(fragmentName, 'CycleProbe');
  const fragA = `${base}A`;
  const fragB = `${base}B`;
  return [
    {
      label: 'self-spread',
      query:
        `query FragmentCycleSelf { node { ...${base} } }\n` +
        `fragment ${base} on Node {\n` +
        `  id\n` +
        `  child { ...${base} }\n` +
        `}`,
      intent:
        'Direct cycle: the fragment spreads itself through a sub-selection. ' +
        'Acceptance means the server does not validate fragment cycles.',
    },
    {
      label: 'mutual-recursion',
      query:
        `query FragmentCycleMutual { node { ...${fragA} } }\n` +
        `fragment ${fragA} on Node {\n` +
        `  id\n` +
        `  child { ...${fragB} }\n` +
        `}\n` +
        `fragment ${fragB} on Node {\n` +
        `  id\n` +
        `  child { ...${fragA} }\n` +
        `}`,
      intent:
        'Mutual recursion: two fragments reference each other. Catches ' +
        'validators that only detect direct self-spreads.',
    },
    {
      label: 'deep-cycle',
      query:
        `query FragmentCycleDeep { node { ...${base} } }\n` +
        `fragment ${base} on Node {\n` +
        `  id\n` +
        `  child {\n` +
        `    id\n` +
        `    grandchild { ...${base} }\n` +
        `  }\n` +
        `}`,
      intent:
        'Cycle buried two selections deep. Catches validators that only scan ' +
        'one level of fragment spreads.',
    },
  ];
}

// ---------------------------------------------------------------------------
// Idea 01022 — GraphQL depth-limit measurement
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} DepthLadderQuery
 * @property {number} depth - Nesting depth of this query.
 * @property {string} query - GraphQL query text nested to `depth`.
 * @property {number} selectionCount - Number of field selections in the query.
 */

/**
 * Build an incrementally-nested selection ladder. Send the queries in order;
 * the first depth the server rejects marks its depth cutoff. Field names are
 * cycled so a two-field repeatable path (e.g. user -> friends -> user) can be
 * walked to arbitrary depth.
 * @param {string[]} fieldPath - Repeatable field path, e.g. ['user', 'friends'].
 * @param {number} [maxDepth=10] - Deepest ladder rung (capped at 50).
 * @returns {DepthLadderQuery[]}
 */
export function depthLadderQueries(fieldPath, maxDepth = 10) {
  const fields = (Array.isArray(fieldPath) ? fieldPath : [])
    .map(f => safeIdentifier(f, ''))
    .filter(Boolean);
  if (fields.length === 0) {
    throw new Error('depthLadderQueries: fieldPath must contain at least one valid field name');
  }
  const cap = Math.max(1, Math.min(50, Math.floor(Number(maxDepth) || 10)));
  const ladder = [];
  for (let depth = 1; depth <= cap; depth += 1) {
    let inner = 'id';
    for (let d = depth; d >= 1; d -= 1) {
      const field = fields[(d - 1) % fields.length];
      inner = `${field} {\n${indent(inner)}\n}`;
    }
    ladder.push({
      depth,
      query: `query DepthLadder_${depth} {\n${indent(inner)}\n}`,
      selectionCount: depth,
    });
  }
  return ladder;
}

/**
 * Indent a block by two spaces.
 * @param {string} block
 * @returns {string}
 */
function indent(block) {
  return String(block)
    .split('\n')
    .map(line => `  ${line}`)
    .join('\n');
}

/**
 * @typedef {Object} DepthLimitResult
 * @property {number|null} depthLimit - Deepest accepted depth, or null if no limit observed.
 * @property {number|null} rejectedAt - First rejected depth, or null.
 * @property {string} method - How the limit was derived.
 * @property {string[]} notes - Caveats (non-monotonic responses etc.).
 */

/**
 * Interpret ladder responses to find the server's depth cutoff.
 * @param {{depth: number, ok: boolean, errors?: any[]}[]} results - One entry per ladder rung.
 * @returns {DepthLimitResult}
 */
export function inferDepthLimit(results = []) {
  const rows = [...results].sort((a, b) => a.depth - b.depth);
  const notes = [];
  let rejectedAt = null;
  let maxAccepted = null;
  for (const row of rows) {
    if (row.ok) {
      if (rejectedAt !== null) {
        notes.push(`Non-monotonic response: depth ${row.depth} accepted after a rejection at ${rejectedAt}.`);
      }
      maxAccepted = maxAccepted === null ? row.depth : Math.max(maxAccepted, row.depth);
    } else if (rejectedAt === null) {
      rejectedAt = row.depth;
    }
  }
  if (rejectedAt === null) {
    return {
      depthLimit: null,
      rejectedAt: null,
      method: 'no-rejection',
      notes: [
        `No depth limit observed up to depth ${maxAccepted === null ? 0 : maxAccepted}.`,
        ...notes,
      ],
    };
  }
  return {
    depthLimit: rejectedAt - 1,
    rejectedAt,
    method: 'first-rejection',
    notes: [
      `Server accepted depth ${rejectedAt - 1} and rejected depth ${rejectedAt}.`,
      ...notes,
    ],
  };
}

// ---------------------------------------------------------------------------
// Idea 01023 — GraphQL cost-analysis probing
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} CostProbeQuery
 * @property {string} kind - 'nested-fanout' | 'wide-siblings'.
 * @property {string} query - GraphQL query text.
 * @property {number} estimatedMultiplier - Estimated worst-case node fan-out (product of page sizes).
 */

/**
 * Craft high-multiplier list queries. Each query multiplies page sizes down a
 * nesting chain so the operator can see whether the server computes query cost
 * (rejects / reports cost) before executing the fan-out.
 * @param {{name: string, first?: number, select?: string[]}[]} listFields - Nested list spec, outermost first.
 * @param {{siblingCount?: number}} [options]
 * @returns {{queries: CostProbeQuery[], maxMultiplier: number}}
 */
export function costProbeQueries(listFields, options = {}) {
  const specs = (Array.isArray(listFields) ? listFields : [])
    .map(s => ({
      name: safeIdentifier(s && s.name, ''),
      first: Math.max(1, Math.min(1000, Math.floor((s && s.first) || 50))),
      select: Array.isArray(s && s.select) && s.select.length ? s.select : ['id'],
    }))
    .filter(s => s.name);
  if (specs.length === 0) {
    throw new Error('costProbeQueries: at least one valid list field is required');
  }
  const { siblingCount = 3 } = options;

  // Nested fan-out: users(first:100) { posts(first:50) { comments(first:50) { id } } }
  let nested = specs[specs.length - 1].select.join('\n');
  let multiplier = 1;
  for (let i = specs.length - 1; i >= 0; i -= 1) {
    const spec = specs[i];
    multiplier *= spec.first;
    nested = `${spec.name}(first: ${spec.first}) {\n${indent(nested)}\n}`;
  }
  const queries = [
    {
      kind: 'nested-fanout',
      query: `query CostProbeNested {\n${indent(nested)}\n}`,
      estimatedMultiplier: multiplier,
    },
  ];

  // Wide siblings: the same list repeated side-by-side to raise additive cost.
  const head = specs[0];
  const siblings = Array.from(
    { length: Math.max(2, Math.min(10, siblingCount)) },
    (_, i) => `alias${i}: ${head.name}(first: ${head.first}) {\n${indent(head.select.join('\n'))}\n}`,
  ).join('\n');
  queries.push({
    kind: 'wide-siblings',
    query: `query CostProbeWide {\n${indent(siblings)}\n}`,
    estimatedMultiplier: head.first * siblings.split('\n').filter(l => l.startsWith('alias')).length,
  });

  return {
    queries,
    maxMultiplier: Math.max(...queries.map(q => q.estimatedMultiplier)),
  };
}

/**
 * @typedef {Object} CostAnalysis
 * @property {boolean} costComputed - Whether the server appears to compute query cost.
 * @property {string[]} signals - Evidence found in the responses.
 * @property {string} summary - Human-readable verdict.
 */

/**
 * Infer from before/after responses whether the server computes query cost.
 * `before` is a cheap baseline query response, `after` is the cost-probe response.
 * @param {{body?: any, headers?: object, durationMs?: number, status?: number}} [before]
 * @param {{body?: any, headers?: object, durationMs?: number, status?: number}} [after]
 * @returns {CostAnalysis}
 */
export function inferCostAnalysis(before = {}, after = {}) {
  const signals = [];
  const afterText = JSON.stringify(after.body || '');
  const afterHeaders = JSON.stringify(after.headers || {});

  if (/(queryCost|query_cost|"cost"|"complexity"|complexityScore|maxCost)/i.test(afterText)) {
    signals.push('cost-extension-present: response carries cost/complexity metadata');
  }
  const errorTexts = [];
  try {
    const errors = (after.body && after.body.errors) || [];
    for (const e of errors) errorTexts.push(String((e && e.message) || ''));
  } catch (_) {
    // body is not a GraphQL envelope; ignore
  }
  if (errorTexts.some(m => /cost|complex|too expensive|exceeds|budget|limit/i.test(m))) {
    signals.push('cost-rejection: server error message references cost/complexity limits');
  }
  if (/(x-query-cost|x-complexity|cost-remaining)/i.test(afterHeaders)) {
    signals.push('cost-header-present: response headers expose cost accounting');
  }
  if (
    typeof before.durationMs === 'number' &&
    typeof after.durationMs === 'number' &&
    before.durationMs > 0 &&
    after.durationMs > before.durationMs * 20 &&
    after.status !== 200
  ) {
    signals.push('timing-anomaly: probe rejected far slower than baseline, suggesting pre-execution analysis');
  }

  const costComputed = signals.length > 0;
  return {
    costComputed,
    signals,
    summary: costComputed
      ? `Server appears to compute query cost (${signals.length} signal${signals.length === 1 ? '' : 's'}).`
      : 'No cost-computation signals observed; the server may execute expensive queries blindly.',
  };
}

// ---------------------------------------------------------------------------
// Idea 01024 — GraphQL federation _service probe
// ---------------------------------------------------------------------------

/**
 * The canonical Apollo federation service probe. On a federated gateway it
 * returns the full composed supergraph SDL; on schema-stitching gateways it
 * typically errors, which is itself a fingerprint signal (see fingerprintGateway).
 * @returns {string} GraphQL query text.
 */
export function federationServiceQuery() {
  return 'query FederationServiceProbe {\n  _service {\n    sdl\n  }\n}';
}

// ---------------------------------------------------------------------------
// Idea 01025 — GraphQL federation _entities abuse descriptors
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} EntitiesDescriptor
 * @property {object} representation - The `_entities` representation object.
 * @property {string} query - GraphQL query text calling `_entities` with it.
 * @property {string} intent - What the descriptor maps.
 */

/**
 * Build `_entities` representation descriptors from a type name and its key
 * fields. Entity resolution can reach subgraph objects directly, so mapping
 * which representations a gateway accepts charts the federation attack surface
 * on an authorized target. Key values are inert placeholders — the operator
 * supplies real identifiers.
 * @param {string} typename - Federated entity type, e.g. 'Product'.
 * @param {string[]} keyFields - Key field names from `@key`, e.g. ['upc'].
 * @param {{batch?: boolean}} [options] - Also emit a multi-representation batch variant.
 * @returns {EntitiesDescriptor[]}
 */
export function entitiesAbuseDescriptors(typename, keyFields = [], options = {}) {
  const type = safeIdentifier(typename, 'Entity');
  const keys = (Array.isArray(keyFields) ? keyFields : [])
    .map(k => safeIdentifier(k, ''))
    .filter(Boolean);
  if (keys.length === 0) {
    throw new Error('entitiesAbuseDescriptors: at least one key field is required');
  }
  const placeholderFor = key => {
    if (/^id$/i.test(key)) return '"<ID>"';
    if (/upc/i.test(key)) return '"<UPC>"';
    if (/sku/i.test(key)) return '"<SKU>"';
    if (/email/i.test(key)) return '"<EMAIL>"';
    if (/key$/i.test(key)) return '"<KEY>"';
    return '"<VALUE>"';
  };
  const representation = { __typename: type };
  for (const key of keys) representation[key] = placeholderFor(key);

  const reprLiteral = `{ __typename: "${type}"${keys.map(k => `, ${k}: ${placeholderFor(k)}`).join('')} }`;
  const descriptors = [
    {
      representation,
      query:
        `query EntitiesProbe {\n` +
        `  _entities(representations: [${reprLiteral}]) {\n` +
        `    __typename\n` +
        `    ... on ${type} {\n` +
        keys.map(k => `      ${k}`).join('\n') +
        `\n    }\n` +
        `  }\n` +
        `}`,
      intent:
        `Single-representation _entities call for ${type} keyed by ${keys.join(', ')}. ` +
        'Success maps entity resolution into the owning subgraph.',
    },
  ];

  if (options.batch) {
    const batchLiteral = `[${reprLiteral}, ${reprLiteral}]`;
    descriptors.push({
      representation: [representation, { ...representation }],
      query:
        `query EntitiesBatchProbe {\n` +
        `  _entities(representations: ${batchLiteral}) {\n` +
        `    __typename\n` +
        `  }\n` +
        `}`,
      intent:
        'Multi-representation batch. Measures whether the gateway fans out ' +
        'entity resolution across subgraphs in one request.',
    });
  }
  return descriptors;
}

// ---------------------------------------------------------------------------
// Idea 01026 — Subgraph direct-access discovery
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} SubgraphEndpoint
 * @property {string|null} subgraph - Subgraph name (null if unnamed).
 * @property {string} url - Subgraph endpoint URL.
 * @property {string} source - Where in the SDL the URL was found.
 */

/**
 * Extract subgraph endpoint URLs from supergraph SDL text. Handles Apollo
 * federation `@join__graph(name:, url:)` directives and falls back to any URL
 * on a line that mentions a subgraph.
 * @param {string} sdlText - Supergraph SDL (e.g. from `_service { sdl }`).
 * @returns {SubgraphEndpoint[]}
 */
export function extractSubgraphUrls(sdlText = '') {
  const text = String(sdlText);
  const found = [];
  const seen = new Set();

  const push = (subgraph, url, source) => {
    const key = `${subgraph || ''}|${url}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push({ subgraph: subgraph || null, url, source });
  };

  // Primary: @join__graph(name: "products", url: "https://...")
  const joinGraph = /@join__graph\s*\(\s*name\s*:\s*"([^"]+)"\s*,\s*url\s*:\s*"([^"]+)"/g;
  let m;
  while ((m = joinGraph.exec(text)) !== null) {
    push(m[1], m[2], 'join__graph directive');
  }
  // url-first ordering variant.
  const joinGraphAlt = /@join__graph\s*\([^)]*url\s*:\s*"([^"]+)"[^)]*name\s*:\s*"([^"]+)"/g;
  while ((m = joinGraphAlt.exec(text)) !== null) {
    push(m[2], m[1], 'join__graph directive');
  }

  // Fallback: any URL on a line mentioning subgraph/service endpoint.
  const urlPattern = /https?:\/\/[^\s"'<>]+/g;
  for (const line of text.split(/\r?\n/)) {
    if (!/subgraph|endpoint|serviceUrl|service_url|gateway/i.test(line)) continue;
    let um;
    while ((um = urlPattern.exec(line)) !== null) {
      const nameMatch = /subgraph[:\s]+["']?([A-Za-z0-9_-]+)/i.exec(line);
      push(nameMatch ? nameMatch[1] : null, um[0].replace(/[),;]+$/, ''), 'subgraph-annotated line');
    }
  }
  return found;
}

// ---------------------------------------------------------------------------
// Idea 01027 — Federation key-field extraction
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} KeyDirective
 * @property {string} type - Object type carrying the @key.
 * @property {string} raw - Raw `fields:` argument value.
 * @property {string[]} fields - Flattened key field paths (dot-joined for nested).
 */

/**
 * Parse `@key` directives from SDL text. Key fields are the exact identifiers
 * needed to reference an entity across subgraphs, so this maps the federation
 * join surface precisely.
 * @param {string} sdlText - Schema SDL text.
 * @returns {KeyDirective[]}
 */
export function extractKeyFields(sdlText = '') {
  const text = String(sdlText);
  const typeDecl = /(?:extend\s+)?type\s+([A-Za-z_][A-Za-z0-9_]*)/g;
  const keyDecl = /@key\s*\(\s*fields\s*:\s*"([^"]+)"\s*\)/g;

  const types = [];
  let tm;
  while ((tm = typeDecl.exec(text)) !== null) types.push({ name: tm[1], index: tm.index });
  const keys = [];
  let km;
  while ((km = keyDecl.exec(text)) !== null) keys.push({ raw: km[1], index: km.index });

  const results = [];
  for (const key of keys) {
    let owner = null;
    for (const t of types) {
      if (t.index < key.index) owner = t.name;
      else break;
    }
    results.push({ type: owner, raw: key.raw, fields: flattenFieldSet(key.raw) });
  }
  return results;
}

/**
 * Flatten a federation `fields:` selection set into dot-joined leaf paths.
 * e.g. '{ customer { id } orderNumber }' -> ['customer.id', 'orderNumber'].
 * @param {string} fieldSet
 * @returns {string[]}
 */
function flattenFieldSet(fieldSet) {
  const tokens = String(fieldSet).match(/[A-Za-z_][A-Za-z0-9_]*|[{}]/g) || [];
  return flattenFieldSetProper(tokens);
}

/**
 * Correct two-pass flatten: a field followed by '{' is a parent, otherwise a leaf.
 * @param {string[]} tokens
 * @returns {string[]}
 */
function flattenFieldSetProper(tokens) {
  const leaves = [];
  const stack = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token === '{' || token === '}') {
      if (token === '}') stack.pop();
      continue;
    }
    const next = tokens[i + 1];
    if (next === '{') {
      stack.push(token);
      i += 1; // consume the '{'
    } else {
      leaves.push([...stack, token].join('.'));
    }
  }
  return leaves;
}

// ---------------------------------------------------------------------------
// Idea 01028 — Schema-stitching vs federation fingerprint
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} GatewayFingerprint
 * @property {'federation'|'stitching'|'inconclusive'} verdict
 * @property {'high'|'medium'|'low'} confidence
 * @property {number} federationScore
 * @property {number} stitchingScore
 * @property {string[]} indicators - Evidence strings.
 */

/**
 * Normalize a response body that may be a string or an already-parsed object.
 * @param {any} body
 * @returns {object}
 */
function asJson(body) {
  if (body && typeof body === 'object') return body;
  try {
    return JSON.parse(String(body || ''));
  } catch (_) {
    return { _raw: String(body || '') };
  }
}

/**
 * Compare a `_service { sdl }` probe response against a baseline query response
 * (plus both header sets) to fingerprint the gateway: Apollo federation vs
 * schema-stitching (graphql-tools style).
 * @param {any} serviceProbeBody - Body of the `_service { sdl }` probe response.
 * @param {object} [serviceProbeHeaders={}]
 * @param {any} baselineBody - Body of a normal baseline query response.
 * @param {object} [baselineHeaders={}]
 * @returns {GatewayFingerprint}
 */
export function fingerprintGateway(serviceProbeBody, serviceProbeHeaders = {}, baselineBody = null, baselineHeaders = {}) {
  const probe = asJson(serviceProbeBody);
  const probeHeaders = JSON.stringify(serviceProbeHeaders || {});
  const allHeaders = `${probeHeaders} ${JSON.stringify(baselineHeaders || {})}`;
  let federationScore = 0;
  let stitchingScore = 0;
  const indicators = [];

  const probeText = JSON.stringify(probe);
  const sdl = probe && probe.data && probe.data._service && probe.data._service.sdl;
  if (typeof sdl === 'string' && sdl.length > 0) {
    federationScore += 3;
    indicators.push('_service { sdl } returned SDL text — federation service surface present');
    if (/join__|link__|\bjoin__Graph\b/.test(sdl)) {
      federationScore += 2;
      indicators.push('SDL contains federation join/link directives — Apollo supergraph');
    }
  }
  const probeErrors = (probe.errors || []).map(e => String((e && e.message) || ''));
  if (probeErrors.some(msg => /cannot query field "_service"|Unknown field|_service/i.test(msg))) {
    stitchingScore += 2;
    indicators.push('_service probe rejected: gateway does not expose the federation service field');
  }
  if (/apollo/i.test(allHeaders)) {
    federationScore += 1;
    indicators.push("Response headers reference 'apollo'");
  }
  if (/graphql-tools|stitch/i.test(allHeaders)) {
    stitchingScore += 2;
    indicators.push('Response headers reference stitching tooling');
  }
  const baseline = baselineBody === null || baselineBody === undefined ? null : asJson(baselineBody);
  if (baseline && baseline.data && !(probe && probe.data && probe.data._service)) {
    stitchingScore += 1;
    indicators.push('Baseline queries succeed while _service is absent — stitching-style gateway behavior');
  }

  let verdict = 'inconclusive';
  if (federationScore > stitchingScore && federationScore >= 3) verdict = 'federation';
  else if (stitchingScore > federationScore && stitchingScore >= 2) verdict = 'stitching';

  const spread = Math.abs(federationScore - stitchingScore);
  const confidence = verdict === 'inconclusive' ? 'low' : spread >= 3 ? 'high' : 'medium';

  return {
    verdict,
    confidence,
    federationScore,
    stitchingScore,
    indicators,
  };
}

// ---------------------------------------------------------------------------
// Idea 01029 — gRPC server reflection probing
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} GrpcReflectionDescriptor
 * @property {string} service - Reflection service name.
 * @property {string} fullMethod - Fully-qualified method path.
 * @property {string} streamType - gRPC streaming mode.
 * @property {{label: string, message: object, expect: string}[]} probeRequests - Request message descriptors.
 * @property {string[]} disabledSignals - Response hints that reflection is disabled.
 */

/**
 * Describe the `grpc.reflection.v1alpha.ServerReflection` call. Reflection
 * returns every service, method and proto descriptor on the server; this
 * descriptor tells the agent's transport exactly which request messages to
 * stream and what to expect back. No network is performed here.
 * @returns {GrpcReflectionDescriptor}
 */
export function grpcReflectionDescriptor() {
  return {
    service: 'grpc.reflection.v1alpha.ServerReflection',
    fullMethod: '/grpc.reflection.v1alpha.ServerReflection/ServerReflectionInfo',
    streamType: 'bidirectional-streaming',
    probeRequests: [
      {
        label: 'list-services',
        message: { list_services: '' },
        expect: 'ListServiceResponse with one FileDescriptorResponse per registered service',
      },
      {
        label: 'file-by-filename',
        message: { file_by_filename: '<service>.proto' },
        expect: 'FileDescriptorResponse carrying the FileDescriptorProto for that file',
      },
      {
        label: 'file-containing-symbol',
        message: { file_containing_symbol: '<package>.<Service>' },
        expect: 'FileDescriptorResponse for the file defining the symbol',
      },
      {
        label: 'all-extension-numbers',
        message: { all_extension_numbers_of_type: '<package>.<Message>' },
        expect: 'ExtensionNumberResponse listing extension field numbers',
      },
    ],
    disabledSignals: [
      'UNIMPLEMENTED status on ServerReflectionInfo',
      'Empty service list with other gRPC methods responding normally',
      'HTTP 404/415 on the reflection path via gRPC-Web fallback',
    ],
  };
}

// ---------------------------------------------------------------------------
// Idea 01030 — gRPC reflection-disabled proto hunt
// ---------------------------------------------------------------------------

/**
 * Enumerate candidate web-root paths for `.proto` source files and binary
 * descriptor sets. Teams often disable reflection yet leave protos publicly
 * downloadable; the agent's fetcher tries these paths on the authorized target.
 * @param {string} baseUrl - Target origin, e.g. 'https://api.example.com'.
 * @returns {string[]} Absolute candidate URLs.
 */
export function protoHuntPaths(baseUrl = '') {
  const base = String(baseUrl || '').replace(/\/+$/, '');
  if (!base) throw new Error('protoHuntPaths: baseUrl is required');
  const stems = ['service', 'api', 'schema', 'definitions', 'main', 'gateway'];
  const paths = [];
  for (const stem of stems) {
    paths.push(`/protos/${stem}.proto`, `/proto/${stem}.proto`, `/${stem}.proto`);
  }
  paths.push(
    '/api/protos/service.proto',
    '/schema/api.proto',
    '/grpc/service.proto',
    '/static/service.proto',
    '/.well-known/service.proto',
    '/protos/descriptor.pb',
    '/proto/descriptor.pb',
    '/descriptor.pb',
    '/descriptor_set.pb',
    '/protos/descriptor_set.pb',
    '/api/descriptor_set.pb',
    '/service.protoset',
    '/api.protoset',
    '/protos/api.protoset',
  );
  return [...new Set(paths)].map(p => `${base}${p}`);
}

// ---------------------------------------------------------------------------
// Consolidated finding builder
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} FederationGrpcScan
 * @property {{verdict: string, confidence: string}} [gateway]
 * @property {import('./graphFederationGrpcRecon.js').SubgraphEndpoint[] | {subgraph: string|null, url: string}[]} [subgraphs]
 * @property {import('./graphFederationGrpcRecon.js').KeyDirective[] | {type: string, fields: string[]}[]} [keyFields]
 * @property {{reflectionEnabled: boolean|null, servicesFound?: number}} [grpc]
 * @property {number} [protoCandidates]
 */

/**
 * Build a report finding from a consolidated federation/gRPC recon scan.
 * @param {FederationGrpcScan} [scan={}]
 * @returns {{title: string, severity: string, confidence: string, details: object, evidence: string, recommendations: string[]}}
 */
export function federationGrpcFinding(scan = {}) {
  const subgraphs = Array.isArray(scan.subgraphs) ? scan.subgraphs : [];
  const keyFields = Array.isArray(scan.keyFields) ? scan.keyFields : [];
  const grpc = scan.grpc || {};
  const gateway = scan.gateway || {};

  const bits = [];
  if (gateway.verdict && gateway.verdict !== 'inconclusive') bits.push(`gateway: ${gateway.verdict}`);
  if (subgraphs.length) bits.push(`${subgraphs.length} subgraph endpoint(s)`);
  if (keyFields.length) bits.push(`${keyFields.length} @key directive(s)`);
  if (grpc.reflectionEnabled === true) bits.push('gRPC reflection enabled');
  if (grpc.reflectionEnabled === false && scan.protoCandidates) {
    bits.push(`${scan.protoCandidates} proto/descriptor candidate path(s)`);
  }

  const severity =
    grpc.reflectionEnabled === true || subgraphs.length > 0 ? 'Medium' : 'Info';
  return {
    title: `GraphQL federation / gRPC surface — ${bits.length ? bits.join(', ') : 'no federation or gRPC surface mapped'}`,
    severity,
    confidence: gateway.confidence || (bits.length ? 'medium' : 'low'),
    details: {
      gateway: gateway.verdict || 'unknown',
      subgraphs: subgraphs.slice(0, 25),
      keyFields: keyFields.slice(0, 25),
      grpcReflectionEnabled: grpc.reflectionEnabled ?? null,
      grpcServicesFound: grpc.servicesFound ?? null,
      protoCandidates: scan.protoCandidates ?? null,
    },
    evidence:
      `${subgraphs.length} subgraph URL(s) extracted; ` +
      `${keyFields.length} @key directive(s) parsed; ` +
      `gRPC reflection ${grpc.reflectionEnabled === true ? 'ENABLED' : grpc.reflectionEnabled === false ? 'disabled' : 'not probed'}.`,
    recommendations: [
      'Verify each subgraph URL only against the authorized scope before direct access.',
      'Use extracted @key fields to map cross-subgraph entity reach, not to bypass authorization.',
      'If reflection is disabled, fetch enumerated .proto paths only on authorized hosts.',
    ],
  };
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const GRAPH_FEDERATION_GRPC_RECON = {
  cyclicFragmentQueries,
  depthLadderQueries,
  inferDepthLimit,
  costProbeQueries,
  inferCostAnalysis,
  federationServiceQuery,
  entitiesAbuseDescriptors,
  extractSubgraphUrls,
  extractKeyFields,
  fingerprintGateway,
  grpcReflectionDescriptor,
  protoHuntPaths,
  federationGrpcFinding,
};

export default GRAPH_FEDERATION_GRPC_RECON;
