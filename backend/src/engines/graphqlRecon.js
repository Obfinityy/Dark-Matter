/**
 * graphqlRecon.js — GraphQL API-surface recon probe builder and response analyzer.
 *
 * Idea 01011: GraphQL field-suggestion bypass — generate misspelled-field
 * probes that trigger didYouMean suggestions, and parse the suggestion text
 * to harvest the real field names a server reveals when introspection is off.
 *
 * Idea 01012: GraphQL error-based schema inference — parse validation error
 * text for leaked type/field/argument names and merge them into a partial
 * schema hypothesis (defensive field-list mapping of the authorized target).
 *
 * Idea 01013: GraphQL __typename mapping sweep — build __typename probes
 * across known or guessed union/interface member types so the operator can
 * enumerate concrete types without full introspection.
 *
 * Idea 01014: GraphQL GET-method variant test — convert a POST GraphQL
 * request descriptor into its equivalent GET form (?query= + variables +
 * extensions) so the operator can check whether the endpoint accepts it
 * (CSRF / proxy-logging surface).
 *
 * Idea 01015: GraphQL playground exposure scan — canonical probe paths for
 * in-browser GraphQL IDEs (GraphiQL, Playground, Voyager) that often ship
 * with introspection and query history enabled.
 *
 * Idea 01016: GraphQL persisted-query hash guessing — compute sha256 of
 * common query strings and build Automatic Persisted Query (APQ) payloads
 * with the correct extensions.persistedQuery shape for operator replay.
 *
 * Idea 01017: GraphQL persisted-query version abuse — flip the `version`
 * field in extensions.persistedQuery to candidate values so the operator
 * can check whether version confusion downgrades hash verification.
 *
 * Idea 01018: GraphQL query batching probe — build batched-array request
 * descriptors (array of operation bodies) so the operator can detect
 * whether the endpoint executes multiple queries in one request.
 *
 * Idea 01019: GraphQL alias overloading test — build a single operation
 * that stacks many aliased copies of one field so the operator can measure
 * alias amplification in one round-trip.
 *
 * Idea 01020: GraphQL directive fuzzing — generate @include/@skip variants
 * with non-boolean directive arguments so the operator can detect field
 * gating mishandling (e.g. truthy coercion, type errors that still execute).
 *
 * No network calls: every function operates on operator-supplied strings
 * (query text, response bodies, header snapshots). The agent's network layer
 * performs the actual transport; this module constructs probe descriptors
 * for the operator to send and analyzes the returned text for schema leaks.
 * Defensive surface mapping of the engagement's own authorized target only.
 */

import { createHash } from 'node:crypto';

/**
 * Normalize a raw GraphQL error body: unescape JSON-escaped quotes/newlines
 * so phrase parsers work on both raw and JSON-serialized text.
 * @param {string} text
 * @returns {string}
 */
function normalizeErrorText(text) {
  return String(text || '')
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\\\/g, '\\');
}

/**
 * Deterministically misspell a GraphQL field name using a set of small
 * mutations (transposition, deletion, substitution, duplication).
 * @param {string} field - Real field name guessed by the operator.
 * @param {{maxVariants?: number}} [options]
 * @returns {string[]} Misspelled variants of the field name.
 */
export function misspellField(field, options = {}) {
  const { maxVariants = 8 } = options;
  const name = String(field || '').trim();
  const variants = new Set();
  if (name.length < 2) return [];
  // Transpose adjacent chars.
  for (let i = 0; i < name.length - 1 && variants.size < maxVariants; i += 1) {
    variants.add(name.slice(0, i) + name[i + 1] + name[i] + name.slice(i + 2));
  }
  // Delete one char.
  for (let i = 0; i < name.length && variants.size < maxVariants; i += 1) {
    variants.add(name.slice(0, i) + name.slice(i + 1));
  }
  // Substitute with a neighbor key-ish char.
  const subs = ['a', 'e', 'i', 'o', 'u', 's', 'x', 'z'];
  for (let i = 0; i < name.length && variants.size < maxVariants; i += 1) {
    for (const c of subs) {
      if (variants.size >= maxVariants) break;
      if (c !== name[i]) variants.add(name.slice(0, i) + c + name.slice(i + 1));
    }
  }
  return [...variants].filter(v => v && v !== name).slice(0, maxVariants);
}

/**
 * Idea 01011 — build suggestion-bypass probe queries for guessed fields.
 * Each returned object is a ready-to-send GraphQL operation descriptor.
 * @param {string[]} guessedFields - Operator-guessed field names.
 * @param {{typeName?: string, variantsPerField?: number}} [options]
 * @returns {{label: string, query: string, field: string, misspelling: string}[]}
 */
export function suggestionBypassQueries(guessedFields = [], options = {}) {
  const { typeName = 'Query', variantsPerField = 4 } = options;
  const probes = [];
  for (const field of guessedFields || []) {
    for (const bad of misspellField(field, { maxVariants: variantsPerField })) {
      probes.push({
        label: `suggestion-bypass:${field}`,
        query: `query { ${bad} }`,
        field: String(field),
        misspelling: bad,
        targetType: typeName,
      });
    }
  }
  return probes;
}

/**
 * Idea 01011 — extract real field names from a GraphQL error response that
 * contains didYouMean / "Did you mean" suggestion text.
 * @param {string} responseText - Raw GraphQL response body.
 * @returns {{suggestedFields: string[], rawPhrases: string[], errorPresent: boolean}}
 */
export function parseSuggestionResponse(responseText = '') {
  const text = normalizeErrorText(responseText);
  const suggestedFields = new Set();
  const rawPhrases = new Set();
  if (!text) return { suggestedFields: [], rawPhrases: [], errorPresent: false };

  const patterns = [
    /Did you mean\s+["']([^"']+)["']/gi, // Did you mean "user"
    /didYouMean\s*:\s*\[([^\]]*)\]/gi, // didYouMean: ["a", "b"]
    /Did you mean\s+([^\n?]{1,300})/gi, // whole clause: "name" or "email"
    /Suggestion[s]?:\s*([^\n]{1,200})/gi,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(text)) !== null) {
      const phrase = m[0].trim().slice(0, 200);
      rawPhrases.add(phrase);
      const inner = m[1] || '';
      // Extract quoted identifiers from the suggestion clause.
      let q;
      const qre = /["'`]?([A-Za-z_][A-Za-z0-9_]*)["'`]?/g;
      while ((q = qre.exec(inner)) !== null) {
        if (!/^(did|you|mean|one|of|or|and|suggestions?)$/i.test(q[1])) suggestedFields.add(q[1]);
      }
    }
  }
  return {
    suggestedFields: [...suggestedFields],
    rawPhrases: [...rawPhrases],
    errorPresent: /errors?/i.test(text),
  };
}

/**
 * Idea 01012 — merge validation error texts into a partial schema hypothesis.
 * Scans for "Cannot query field X on type Y", unknown-argument hints, and
 * enum/coercion errors to harvest type/field/argument candidates.
 * @param {string[]} errorTexts - Raw error response bodies from the operator.
 * @returns {{types: Object<string, {fields: string[], kind: string|null}>, arguments: Object<string, string[]>, enums: string[], coverage: number}}
 */
export function inferSchemaFromErrors(errorTexts = []) {
  const types = new Map();
  const argumentsByField = new Map();
  const enums = new Set();

  const ensureType = (name) => {
    if (!types.has(name)) types.set(name, { fields: new Set(), kind: null });
    return types.get(name);
  };

  for (const raw of errorTexts || []) {
    const text = normalizeErrorText(raw);
    let m;
    // Cannot query field "name" on type "User".
    const fieldRe = /Cannot query field\s+["']([A-Za-z_][A-Za-z0-9_]*)["']\s+on type\s+["']([A-Za-z_][A-Za-z0-9_]*)["']/gi;
    while ((m = fieldRe.exec(text)) !== null) {
      ensureType(m[2]).fields.add(m[1]);
    }
    // Unknown argument "limit" on field "Query.users".
    const argRe = /Unknown argument\s+["']([A-Za-z_][A-Za-z0-9_]*)["']\s+on field\s+["']([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)["']/gi;
    while ((m = argRe.exec(text)) !== null) {
      ensureType(m[2]).fields.add(m[3]);
      if (!argumentsByField.has(m[3])) argumentsByField.set(m[3], new Set());
      argumentsByField.get(m[3]).add(m[1]);
    }
    // Did you mean suggests fields on a type.
    const sug = parseSuggestionResponse(text);
    if (sug.errorPresent) {
      const typeRe = /on type\s+["']([A-Za-z_][A-Za-z0-9_]*)["']/gi;
      const seenTypes = new Set();
      while ((m = typeRe.exec(text)) !== null) seenTypes.add(m[1]);
      for (const t of seenTypes) {
        for (const f of sug.suggestedFields) ensureType(t).fields.add(f);
      }
    }
    // Enum coercion errors: "Expected type Role, found X. Did you mean one of ADMIN, USER?"
    const enumRe = /Expected type\s+["']([A-Za-z_][A-Za-z0-9_]*)["']/gi;
    while ((m = enumRe.exec(text)) !== null) {
      enums.add(m[1]);
      ensureType(m[1]).kind = 'enum';
    }
    // Abstract type resolution hints: "Abstract type Node must resolve to an Object type at runtime"
    const abstractRe = /Abstract type\s+["']([A-Za-z_][A-Za-z0-9_]*)["']/gi;
    while ((m = abstractRe.exec(text)) !== null) {
      ensureType(m[1]).kind = 'abstract';
    }
  }

  const outTypes = {};
  for (const [name, t] of types) {
    outTypes[name] = { fields: [...t.fields].sort(), kind: t.kind };
  }
  const outArgs = {};
  for (const [field, args] of argumentsByField) outArgs[field] = [...args].sort();
  const typeCount = Object.keys(outTypes).length;
  const fieldCount = Object.values(outTypes).reduce((n, t) => n + t.fields.length, 0);
  return {
    types: outTypes,
    arguments: outArgs,
    enums: [...enums].sort(),
    coverage: typeCount + fieldCount,
  };
}

/**
 * Idea 01013 — build a __typename mapping sweep over unions/interfaces.
 * For each abstract type, produces an inline-fragment query plus a bare
 * __typename probe so the operator can enumerate concrete runtime types.
 * @param {string[]} abstractTypes - Union/interface names to sweep.
 * @param {{probeField?: string}} [options]
 * @returns {{label: string, query: string, abstractType: string}[]}
 */
export function typenameSweepQuery(abstractTypes = [], options = {}) {
  const { probeField = 'node' } = options;
  const probes = [];
  for (const typeName of abstractTypes || []) {
    const t = String(typeName).trim();
    if (!t) continue;
    probes.push({
      label: `typename-sweep:${t}`,
      abstractType: t,
      query: `query { ${probeField} { __typename ... on ${t} { __typename } } }`,
    });
  }
  return probes;
}

/**
 * Idea 01014 — convert a POST GraphQL request descriptor into its GET
 * variant so the operator can test whether the endpoint accepts
 * ?query= style requests (CSRF / proxy-logging surface).
 * @param {{query: string, operationName?: string|null, variables?: object|null, extensions?: object|null}} post
 * @returns {{method: string, queryString: string, params: Object<string,string>, cacheable: boolean}}
 */
export function getMethodProbeQuery(post = {}) {
  const { query = '', operationName = null, variables = null, extensions = null } = post;
  const params = { query: String(query) };
  if (operationName) params.operationName = operationName;
  if (variables && Object.keys(variables).length) params.variables = JSON.stringify(variables);
  if (extensions && Object.keys(extensions).length) params.extensions = JSON.stringify(extensions);
  const queryString = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return {
    method: 'GET',
    queryString,
    params,
    cacheable: true, // GET GraphQL responses are cacheable by intermediaries
  };
}

/**
 * Idea 01015 — canonical probe paths for in-browser GraphQL IDEs.
 * @returns {string[]} Relative paths to probe on the target host.
 */
export function playgroundCandidatePaths() {
  return [
    '/graphql',
    '/graphiql',
    '/playground',
    '/voyager',
    '/api/graphql',
    '/v1/graphql',
    '/console',
    '/graph',
    '/query',
    '/explorer',
  ];
}

/**
 * Idea 01016 — compute the sha256 hash for an Automatic Persisted Query
 * (APQ) payload per the persisted-query protocol.
 * @param {string} query - Full GraphQL operation text.
 * @returns {string} Lowercase hex sha256 digest.
 */
export function sha256QueryHash(query) {
  return createHash('sha256').update(String(query), 'utf8').digest('hex');
}

/**
 * Idea 01016 — build APQ payload descriptors for common query strings:
 * a hash-only probe (no query text) plus the full register payload.
 * @param {string[]} commonQueries - Candidate operation texts.
 * @param {{version?: number}} [options]
 * @returns {{label: string, sha256Hash: string, hashOnlyPayload: object, registerPayload: object}[]}
 */
export function apqHashGuessQueries(commonQueries = [], options = {}) {
  const { version = 1 } = options;
  return (commonQueries || [])
    .filter(q => typeof q === 'string' && q.trim())
    .map(query => {
      const sha256Hash = sha256QueryHash(query);
      const extensions = { persistedQuery: { version, sha256Hash } };
      return {
        label: `apq-guess:${sha256Hash.slice(0, 12)}`,
        sha256Hash,
        hashOnlyPayload: { extensions },
        registerPayload: { query, extensions },
      };
    });
}

/**
 * Idea 01017 — flip the `version` field in extensions.persistedQuery to
 * candidate values so the operator can test version-confusion behavior.
 * @param {object} basePayload - A valid APQ payload descriptor.
 * @param {number[]} [candidateVersions] - Version values to try.
 * @returns {{label: string, version: number, payload: object}[]}
 */
export function versionAbuseVariants(basePayload = {}, candidateVersions = [0, 1, 2, -1, '1', 999]) {
  const base = basePayload && typeof basePayload === 'object' ? basePayload : {};
  return candidateVersions.map(version => {
    const extensions = {
      ...(base.extensions || {}),
      persistedQuery: {
        ...((base.extensions && base.extensions.persistedQuery) || {}),
        version,
      },
    };
    return {
      label: `apq-version-abuse:${JSON.stringify(version)}`,
      version,
      payload: { ...base, extensions },
    };
  });
}

/**
 * Idea 01018 — build a query-batching probe descriptor: an array of
 * operation bodies in one request, plus a detection rule the operator can
 * apply to the response.
 * @param {string[]} queries - Operation texts to batch.
 * @returns {{requestBody: object[], operationCount: number, detect: string, expectedArrayResponse: boolean}}
 */
export function batchingProbeDescriptor(queries = []) {
  const ops = (queries || []).filter(q => typeof q === 'string' && q.trim());
  return {
    requestBody: ops.map(query => ({ query })),
    operationCount: ops.length,
    detect: 'endpoint supports batching when the response is a JSON array with one result object per batched operation, in order',
    expectedArrayResponse: true,
  };
}

/**
 * Idea 01019 — build a single operation stacking N aliased copies of one
 * field so the operator can measure alias amplification per round-trip.
 * @param {string} field - Field to alias-stack (may include sub-selection).
 * @param {number} n - Number of aliased copies.
 * @returns {{label: string, query: string, aliasCount: number, field: string}}
 */
export function aliasOverloadQuery(field, n = 25) {
  const f = String(field || 'id').trim();
  const count = Math.max(1, Math.min(200, Number.isFinite(Number(n)) ? Math.floor(Number(n)) : 25));
  const selection = Array.from({ length: count }, (_, i) => `a${i}: ${f}`).join(' ');
  return {
    label: `alias-overload:${f}x${count}`,
    query: `query { ${selection} }`,
    aliasCount: count,
    field: f,
  };
}

/**
 * Idea 01020 — generate @include/@skip fuzz variants with non-boolean
 * directive arguments so the operator can detect field-gating mishandling
 * (truthy coercion, silent acceptance, or type errors that still execute).
 * @param {string} [baseField] - Field to attach the directives to.
 * @returns {{label: string, query: string, directive: string, argument: string}[]}
 */
export function directiveFuzzQueries(baseField = 'id') {
  const f = String(baseField || 'id').trim();
  const fuzzValues = [
    { arg: 'if: "true"', note: 'string-true' },
    { arg: 'if: "false"', note: 'string-false' },
    { arg: 'if: 1', note: 'int-1' },
    { arg: 'if: 0', note: 'int-0' },
    { arg: 'if: null', note: 'null' },
    { arg: 'if: []', note: 'empty-list' },
    { arg: 'if: {}', note: 'empty-object' },
    { arg: 'if: "yes"', note: 'truthy-string' },
    { arg: 'if: 1.5', note: 'float' },
  ];
  const variants = [];
  for (const directive of ['include', 'skip']) {
    for (const { arg, note } of fuzzValues) {
      variants.push({
        label: `directive-fuzz:@${directive}:${note}`,
        query: `query { ${f} @${directive}(${arg}) }`,
        directive,
        argument: arg,
      });
    }
  }
  return variants;
}

/**
 * Build a uniform report finding from a recon result.
 * @param {{title?: string, kind?: string, evidence?: string, targets?: string[], confidence?: string}} result
 * @returns {{title: string, severity: string, confidence: string, kind: string, evidence: string, targets: string[], recommendation: string}}
 */
export function graphqlReconFinding(result = {}) {
  const { title = 'GraphQL recon finding', kind = 'recon', evidence = '', targets = [], confidence = 'medium' } = result;
  return {
    title: `GraphQL recon — ${title}`,
    severity: 'Info',
    confidence,
    kind,
    evidence,
    targets: Array.isArray(targets) ? targets : [],
    recommendation:
      'Review the flagged GraphQL surface on the authorized target: disable verbose validation errors and ' +
      'field suggestions in production, keep introspection/IDE endpoints off public builds, require POST for ' +
      'mutations, enforce per-request cost and depth limits, and validate persisted-query version and hash handling.',
  };
}

/**
 * Named-const registry for deterministic access, mirroring house style.
 */
export const GRAPHQL_RECON = {
  misspellField,
  suggestionBypassQueries,
  parseSuggestionResponse,
  inferSchemaFromErrors,
  typenameSweepQuery,
  getMethodProbeQuery,
  playgroundCandidatePaths,
  sha256QueryHash,
  apqHashGuessQueries,
  versionAbuseVariants,
  batchingProbeDescriptor,
  aliasOverloadQuery,
  directiveFuzzQueries,
  graphqlReconFinding,
};

export default GRAPHQL_RECON;
