// Dark Matter rule-based scanner — GraphQL Relay Node interface IDOR probe
// (coverage row #507 [High] GraphQL Relay Node interface IDOR, CWE-639 |
// OWASP A01:2021; phase 'graphql-relay').
//
// Relay-style schemas expose a global `node(id:)` field that resolves any
// object from an opaque base64 `Type:ID` pair. When the resolver does not
// check ownership, an attacker who knows (or guesses) another user's raw id
// can read that user's object by encoding `User:<other-id>` — the global id
// is the only gate, and it is trivially forgeable.
//
// ORACLE (differential, three legs — no single response ever confirms):
//   OWN — the probe first learns its own identity from a self field
//   (`viewer` or `me`, whichever returns an `id`), encodes `Type:<own-id>`
//   and requires `node(id:)` to resolve it. If no self field yields an id
//   the probe stays quiet: without a known-own object it cannot tell a
//   legitimately public object from a foreign private one, and guessing
//   low ids would false-positive on public data.
//   OTHER — the same type with a neighbouring raw id (numeric own id + 1)
//   must resolve to a DIFFERENT object (different global id). The leg is
//   repeated and must reproduce exactly.
//   NONSENSE — `Type:999999999` must resolve to null (or an error). A
//   server that echoes the caller's own object for any id, or that
//   returns an object for the nonsense id, fails the oracle.
// A finding fires ONLY when own resolves AND other resolves to a different
// object AND the repeat agrees AND nonsense resolves to nothing.
//
// GATES: none beyond the battery itself. Read-only POSTs against the scan
// targets (the same surface graphql.js uses), no mutation is ever sent,
// runs at every depth including 'quick'. Findings are class
// 'graphql_relay_idor' — the differential.js idor protocol judges them on
// evidence.crossUserRead, exactly like the REST IDOR probe.
//
// HONEST LIMITS: mock-server verified only. Juice Shop's /graphql is a
// candidate live surface — verify first, do not assume it implements the
// Relay Node interface or exposes viewer/me. A schema with no `node` field,
// no self field, or a `node` field that returns objects without `id` stays
// quiet by design. The "other" id is a neighbouring-id heuristic: it proves
// the resolver returns foreign objects, not that every id is enumerable.

import { randomBytes } from 'node:crypto';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const TIMEOUT_MS = 15000;
const GRAPHQL_PATHS = ['/graphql', '/api/graphql', '/graphql/console', '/graphiql', '/.well-known/graphql'];
const NONSENSE_RAW_ID = '999999999';

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

function ev(request, response, impact, extra = {}) {
  return { request, response, impact_demo: impact, signalCorrelated: true, ...extra };
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
    return { ok: true, status: res.status, json, text: text.slice(0, 200000), ms: Date.now() - started };
  } catch {
    return { ok: false, status: 0, json: null, text: '', ms: Date.now() - started };
  } finally {
    clearTimeout(t);
  }
}

// ---- pure helpers (exported for unit tests) ---------------------------------

/**
 * Encode a Relay global id: base64("<Type>:<rawId>"). Pure.
 */
export function encodeNodeId(type, rawId) {
  return Buffer.from(`${type}:${rawId}`, 'utf8').toString('base64');
}

/**
 * Decode a Relay global id into { type, rawId }, or null when the value
 * is not a base64 "<Type>:<rawId>" pair. Pure.
 */
export function decodeNodeId(globalId) {
  if (typeof globalId !== 'string' || !globalId) return null;
  let decoded;
  try {
    decoded = Buffer.from(globalId, 'base64').toString('utf8');
  } catch {
    return null;
  }
  const idx = decoded.indexOf(':');
  if (idx <= 0 || idx === decoded.length - 1) return null;
  return { type: decoded.slice(0, idx), rawId: decoded.slice(idx + 1) };
}

/**
 * Neighbouring raw id for the OTHER leg: numeric ids step by one; opaque
 * ids take a distinct suffix so the pair can never be the same object.
 * Pure.
 */
export function otherRawId(ownRawId) {
  const raw = String(ownRawId);
  if (/^\d+$/.test(raw)) return String(Number(raw) + 1);
  return `${raw}-other`;
}

/** GraphQL document resolving one global id through node(id:). Pure. */
export function nodeQuery(globalId) {
  return `query { node(id: "${globalId}") { __typename id } }`;
}

/** GraphQL document reading the caller's own identity. Pure. */
export function selfQuery(field) {
  return `query { ${field} { __typename id } }`;
}

/**
 * Parse a node(id:) response into { resolved, globalId, typename }.
 * Resolved requires a non-null node carrying its own id — a bare
 * __typename without an id cannot prove a cross-user read. Pure.
 */
export function parseNodeResult(json) {
  const node = json && typeof json === 'object' ? json.data && json.data.node : null;
  if (!node || typeof node !== 'object' || typeof node.id !== 'string' || !node.id) {
    return { resolved: false, globalId: null, typename: null };
  }
  return { resolved: true, globalId: node.id, typename: node.__typename || null };
}

/**
 * Judge the three-leg Relay oracle. 'confirmed' only when the own id
 * resolves, the other id resolves to a DIFFERENT object, the other leg
 * reproduces, and the nonsense id resolves to nothing. Pure.
 */
export function assessRelayOracle({ own, other, otherRepeat, nonsense }) {
  if (!own || !other || !otherRepeat || !nonsense) {
    return { verdict: 'unconfirmed', reason: 'incomplete witness matrix — a request failed' };
  }
  if (!own.resolved) {
    return { verdict: 'rejected', reason: 'own id does not resolve through node(id:) — no baseline object' };
  }
  if (!other.resolved) {
    return { verdict: 'rejected', reason: 'other id does not resolve — the resolver enforces ownership' };
  }
  if (other.globalId === own.globalId) {
    return { verdict: 'rejected', reason: 'other id resolves to the caller\u2019s own object — echo, not a foreign read' };
  }
  if (!otherRepeat.resolved || otherRepeat.globalId !== other.globalId) {
    return { verdict: 'unconfirmed', reason: 'other-id leg did not reproduce on repeat' };
  }
  if (nonsense.resolved) {
    return { verdict: 'rejected', reason: 'nonsense id resolves to an object — the resolver does not validate ids' };
  }
  return { verdict: 'confirmed', reason: 'own id resolves, a neighbouring id resolves to a different object (reproduced), nonsense id resolves to nothing' };
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

export async function probeGraphqlRelay(url, params, opts = {}) {
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

  // Does the schema expose node(id:)? When introspection lists fields
  // without `node`, stop — the interface is absent. When introspection
  // itself is disabled, keep going: a disabled __schema says nothing
  // about whether node(id:) exists, and the direct legs decide.
  count.attempts += 1;
  const intro = await post(fetchFn, endpoint, { query: '{__schema{queryType{fields{name}}}}' }, options);
  let nodeField = null;
  if (intro.ok && intro.json && intro.json.data && intro.json.data.__schema) {
    const fields = intro.json.data.__schema.queryType?.fields || [];
    nodeField = fields.some((f) => f.name === 'node');
    setDiag('nodeField', nodeField);
    if (!nodeField) {
      setDiag('attempts', count.attempts);
      return findings;
    }
  } else {
    setDiag('nodeField', null);
  }

  // Learn the caller's own identity: viewer first, then me.
  let ownRawId = null;
  let ownType = null;
  for (const field of ['viewer', 'me']) {
    count.attempts += 1;
    const r = await post(fetchFn, endpoint, { query: selfQuery(field) }, options);
    const self = r.ok && r.json && r.json.data ? r.json.data[field] : null;
    if (self && typeof self.id === 'string' && self.id) {
      ownRawId = self.id;
      ownType = typeof self.__typename === 'string' && self.__typename ? self.__typename : 'User';
      setDiag('selfField', field);
      break;
    }
  }
  if (!ownRawId) {
    setDiag('noOwnIdentity', true);
    setDiag('attempts', count.attempts);
    return findings;
  }

  const ownGlobalId = encodeNodeId(ownType, ownRawId);
  const otherGlobalId = encodeNodeId(ownType, otherRawId(ownRawId));
  const nonsenseRaw = ownRawId === NONSENSE_RAW_ID ? '999999998' : NONSENSE_RAW_ID;
  const nonsenseGlobalId = encodeNodeId(ownType, nonsenseRaw);

  count.attempts += 1;
  const ownRes = await post(fetchFn, endpoint, { query: nodeQuery(ownGlobalId) }, options);
  const own = parseNodeResult(ownRes.json);
  count.attempts += 1;
  const otherRes = await post(fetchFn, endpoint, { query: nodeQuery(otherGlobalId) }, options);
  const other = parseNodeResult(otherRes.json);
  count.attempts += 1;
  const otherRepeatRes = await post(fetchFn, endpoint, { query: nodeQuery(otherGlobalId) }, options);
  const otherRepeat = parseNodeResult(otherRepeatRes.json);
  count.attempts += 1;
  const nonsenseRes = await post(fetchFn, endpoint, { query: nodeQuery(nonsenseGlobalId) }, options);
  const nonsense = parseNodeResult(nonsenseRes.json);
  setDiag('attempts', count.attempts);
  setDiag('ownResolved', own.resolved);
  setDiag('otherResolved', other.resolved);
  setDiag('nonsenseResolved', nonsense.resolved);

  const judged = assessRelayOracle({ own, other, otherRepeat, nonsense });
  setDiag('oracle', judged.verdict);
  if (judged.verdict !== 'confirmed') return findings;

  findings.push({
    class: 'graphql_relay_idor',
    id: `graphql-relay-idor-${ownType.toLowerCase()}`,
    title: `GraphQL Relay node(id:) IDOR — another user's ${ownType} object resolves via a forged global ID (HIGH)`,
    severity: 'high',
    url: endpoint,
    param: 'node(id:)',
    parameter: 'node(id:)',
    evidence: ev(
      `POST ${endpoint} {"query":"${nodeQuery(otherGlobalId)}"} (own id ${ownGlobalId} and nonsense id ${nonsenseGlobalId} probed the same way, other leg repeated)`,
      `Own id resolves to ${own.globalId} (${own.typename}); neighbouring id resolves to a DIFFERENT object ${other.globalId} (${other.typename}) on both attempts; nonsense id resolves to null. ${judged.reason}.`,
      'Anyone who knows or guesses another user\u2019s raw id can read that user\u2019s object through node(id:) with no ownership check — the base64 global id is the only gate and it is trivially forgeable.',
      { crossUserRead: true },
    ),
  });
  return findings;
}

export const __graphqlRelayMeta = { phases: ['graphql-relay'], depth: ['quick', 'standard', 'deep'] };
