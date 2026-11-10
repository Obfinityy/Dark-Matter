// Dark Matter rule-based scanner — GraphQL persisted queries / APQ abuse probe
// (coverage row #508 [Medium] GraphQL persisted queries / APQ abuse,
// CWE-770/400 | OWASP A04:2021; phase 'graphql-apq').
//
// Automatic Persisted Queries (Apollo APQ) let a client send only the
// sha256 hash of a query in extensions.persistedQuery; the server executes
// the stored operation without ever seeing its text. The hash then behaves
// like a capability: anyone who learns or guesses it can execute the stored
// operation — including a privileged one — with attacker-controlled
// variables, and the operation text never appears in the request.
//
// ORACLE (differential, unknown-hash control first — no single response
// ever confirms):
//   CONTROL — a hash-only replay with a fresh random hash must be
//   rejected (PersistedQueryNotFound or an error, no data). If an unknown
//   hash executes anything, the oracle is broken and the probe stays
//   quiet: such a server cannot distinguish a known hash from an unknown
//   one, so no replay leg could prove anything.
//   DICTIONARY — the sha256 of a small bounded dictionary of canonical
//   query spellings is replayed hash-only (at most 6 hashes). A hit means
//   the stored operation is guessable without any registration step.
//   REGISTER-THEN-REPLAY — the probe registers one benign query
//   (`query DmApqProbe($dm: String) { __typename }`) by sending its full
//   text with its hash, then replays the hash alone with
//   attacker-controlled variables ({ dm: "dm-attacker-value" }). The
//   replay must execute, and must execute again on repeat.
// A finding fires ONLY when the control rejects the unknown hash AND one
// of the two replay legs executes reproducibly.
//
// GATES: none beyond the battery itself. Read-only POSTs against the scan
// targets (the same surface graphql.js uses); the registered query is a
// benign __typename read, no mutation is ever sent. Runs at every depth
// including 'quick'. Findings are class 'graphql_apq_abuse' — the default
// confirmation protocol judges them on evidence.signalCorrelated.
//
// HONEST LIMITS: mock-server verified only. Juice Shop's /graphql is a
// candidate live surface — verify first, do not assume it supports APQ.
// The dictionary is deliberately tiny (6 canonical spellings): a stored
// operation whose text is not in the dictionary is only reachable through
// the register-then-replay leg, which proves the server honours hash-only
// execution but not that a real privileged operation's hash is guessable.
// Variable influence on the stored operation's OUTPUT is not observable on
// a schema-agnostic __typename query — the confirmed signal is hash-only
// execution with attacker-supplied variables accepted, versus unknown-hash
// rejection. No hash-space brute force is attempted: sha256 cannot be
// brute-forced, only dictionary-guessed, and the dictionary stays bounded.

import { createHash, randomBytes } from 'node:crypto';

const UA = 'DarkMatter-Scanner/1.0 (+authorized-scan)';
const TIMEOUT_MS = 15000;
const GRAPHQL_PATHS = ['/graphql', '/api/graphql', '/graphql/console', '/graphiql', '/.well-known/graphql'];
// The query the probe registers: a benign read with one declared variable
// so the replay can carry attacker-controlled variables legitimately.
const REGISTER_QUERY = 'query DmApqProbe($dm: String) { __typename }';
const REGISTER_OPERATION = 'DmApqProbe';
const REGISTER_VARIABLES = { dm: 'dm-attacker-value' };
// Bounded dictionary of canonical query spellings whose hashes are worth
// one hash-only replay each. Deliberately small — see honest limits above.
const HASH_DICTIONARY = [
  '{__typename}',
  'query { __typename }',
  REGISTER_QUERY,
  '{ viewer { id } }',
  'query { me { id } }',
  '{ node(id: "VXNlcjox") { __typename } }',
];

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
    return { ok: true, status: res.status, json, text: text.slice(0, 200000) };
  } catch {
    return { ok: false, status: 0, json: null, text: '' };
  } finally {
    clearTimeout(t);
  }
}

// ---- pure helpers (exported for unit tests) ---------------------------------

/**
 * APQ hash of a query document: lowercase hex sha256 of the exact query
 * string, as Apollo computes it. Pure.
 */
export function persistedHash(query) {
  return createHash('sha256').update(String(query), 'utf8').digest('hex');
}

/** Hash-only replay body for a persisted-query hash. Pure. */
export function replayBody(sha256Hash, operationName, variables = {}) {
  const body = {
    variables,
    extensions: { persistedQuery: { version: 1, sha256Hash } },
  };
  if (operationName) body.operationName = operationName;
  return body;
}

/** Full-query registration body: text plus its APQ hash. Pure. */
export function registerBody(query, operationName, variables = {}) {
  return {
    operationName,
    query,
    variables,
    extensions: { persistedQuery: { version: 1, sha256Hash: persistedHash(query) } },
  };
}

/**
 * Classify one APQ response. `executed` means data came back with no
 * errors; `notFound` means the server explicitly rejected an unknown
 * hash. Anything else is neither. Pure.
 */
export function parseApqResult(json) {
  if (!json || typeof json !== 'object') return { executed: false, notFound: false };
  const errors = Array.isArray(json.errors) ? json.errors : [];
  const notFound = errors.some((e) => /PersistedQueryNotFound/i.test(String((e && e.message) || '')));
  const executed = json.data !== null && json.data !== undefined && errors.length === 0;
  return { executed, notFound };
}

/**
 * Judge the APQ oracle. 'confirmed' only when the unknown-hash control
 * was rejected AND the replay leg executed AND the repeat executed.
 * 'rejected' when the unknown hash executed (oracle broken) or the
 * replay did not execute; 'unconfirmed' on an incomplete matrix. Pure.
 */
export function assessApqOracle({ unknown, replay, replayRepeat }) {
  if (!unknown || !replay || !replayRepeat) {
    return { verdict: 'unconfirmed', reason: 'incomplete witness matrix — a request failed' };
  }
  if (unknown.executed) {
    return { verdict: 'rejected', reason: 'unknown hash executed — the server does not validate persisted-query hashes' };
  }
  if (!replay.executed) {
    return { verdict: 'rejected', reason: 'known hash did not execute — hash-only replay is not honoured' };
  }
  if (!replayRepeat.executed) {
    return { verdict: 'unconfirmed', reason: 'replay leg did not reproduce on repeat' };
  }
  return { verdict: 'confirmed', reason: 'unknown hash rejected, known hash executes reproducibly with attacker-controlled variables' };
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

export async function probeGraphqlApq(url, params, opts = {}) {
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

  // CONTROL FIRST: a fresh random hash must be rejected. If it executes,
  // the server cannot tell known from unknown hashes and no replay leg
  // could prove anything — stop.
  const unknownHash = persistedHash(`dm-apq-unknown-${randomBytes(8).toString('hex')}`);
  count.attempts += 1;
  const unknownRes = await post(fetchFn, endpoint, replayBody(unknownHash, REGISTER_OPERATION, {}), options);
  const unknown = parseApqResult(unknownRes.json);
  setDiag('unknownHashRejected', !unknown.executed);
  if (unknown.executed) {
    setDiag('attempts', count.attempts);
    return findings;
  }

  // LEG 1 — dictionary: one hash-only replay per canonical spelling.
  let variant = null;
  let hitHash = null;
  let hitQuery = null;
  for (const candidate of HASH_DICTIONARY) {
    const hash = persistedHash(candidate);
    count.attempts += 1;
    const r = await post(fetchFn, endpoint, replayBody(hash, undefined, {}), options);
    if (parseApqResult(r.json).executed) {
      variant = 'dictionary';
      hitHash = hash;
      hitQuery = candidate;
      break;
    }
  }
  if (variant === 'dictionary') {
    count.attempts += 1;
    const repeat = await post(fetchFn, endpoint, replayBody(hitHash, undefined, {}), options);
    const judged = assessApqOracle({ unknown, replay: { executed: true }, replayRepeat: parseApqResult(repeat.json) });
    setDiag('variant', variant);
    setDiag('attempts', count.attempts);
    if (judged.verdict === 'confirmed') {
      findings.push({
        class: 'graphql_apq_abuse',
        id: 'graphql-apq-dictionary',
        title: 'GraphQL persisted query executable from a guessed hash — stored operation replays hash-only (MEDIUM)',
        severity: 'medium',
        url: endpoint,
        param: 'extensions.persistedQuery.sha256Hash',
        parameter: 'extensions.persistedQuery.sha256Hash',
        evidence: ev(
          `POST ${endpoint} {"extensions":{"persistedQuery":{"version":1,"sha256Hash":"${hitHash}"}}} (hash-only, no query text; unknown-hash control rejected first)`,
          `Hash-only replay of the sha256 of ${JSON.stringify(hitQuery)} executed (data returned, no errors) on the first attempt and on repeat, while a fresh random hash was rejected with PersistedQueryNotFound. ${judged.reason}.`,
          'The stored operation\u2019s hash is guessable from its canonical text, so anyone holding the hash can execute the stored operation with attacker-controlled variables without ever sending the operation.',
        ),
      });
    }
    return findings;
  }

  // LEG 2 — register-then-replay: register a benign query, then replay
  // its hash alone with attacker-controlled variables.
  count.attempts += 1;
  const reg = await post(fetchFn, endpoint, registerBody(REGISTER_QUERY, REGISTER_OPERATION, { dm: 'dm-register' }), options);
  const registered = parseApqResult(reg.json);
  setDiag('registered', registered.executed);
  if (!registered.executed) {
    setDiag('attempts', count.attempts);
    return findings;
  }
  const hash = persistedHash(REGISTER_QUERY);
  count.attempts += 1;
  const replay = await post(fetchFn, endpoint, replayBody(hash, REGISTER_OPERATION, REGISTER_VARIABLES), options);
  count.attempts += 1;
  const replayRepeat = await post(fetchFn, endpoint, replayBody(hash, REGISTER_OPERATION, REGISTER_VARIABLES), options);
  const judged = assessApqOracle({
    unknown,
    replay: parseApqResult(replay.json),
    replayRepeat: parseApqResult(replayRepeat.json),
  });
  setDiag('variant', 'replay');
  setDiag('oracle', judged.verdict);
  setDiag('attempts', count.attempts);
  if (judged.verdict !== 'confirmed') return findings;

  findings.push({
    class: 'graphql_apq_abuse',
    id: 'graphql-apq-replay',
    title: 'GraphQL persisted query replays from its hash alone — APQ executes a stored operation with attacker-controlled variables (MEDIUM)',
    severity: 'medium',
    url: endpoint,
    param: 'extensions.persistedQuery.sha256Hash',
    parameter: 'extensions.persistedQuery.sha256Hash',
    evidence: ev(
      `POST ${endpoint} {"operationName":"${REGISTER_OPERATION}","variables":${JSON.stringify(REGISTER_VARIABLES)},"extensions":{"persistedQuery":{"version":1,"sha256Hash":"${hash}"}}} (hash-only, no query text; unknown-hash control rejected first, replay repeated)`,
      `Registered query ${JSON.stringify(REGISTER_QUERY)} executed on registration; the hash-only replay with attacker-controlled variables executed (data returned, no errors) on both attempts, while a fresh random hash was rejected. ${judged.reason}.`,
      'Once a persisted query is registered, its hash alone is a capability: anyone holding it can execute the stored operation — including a privileged one — with attacker-controlled variables, and the operation text never appears in the request.',
    ),
  });
  return findings;
}

export const __graphqlApqMeta = { phases: ['graphql-apq'], depth: ['quick', 'standard', 'deep'] };
