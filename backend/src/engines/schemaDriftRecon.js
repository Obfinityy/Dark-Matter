/**
 * schemaDriftRecon.js — response-schema drift recon for authorized bug-bounty hunts.
 *
 * Re-diffs API response schemas between snapshots so silent field additions,
 * removed fields, and method-set changes surface new or fragile attack surface:
 *
 *  - Idea 1211 — response-schema drift detection (snapshot schemas, re-diff over time)
 *  - Idea 1212 — GraphQL schema drift tracking (re-run introspection, diff types/fields/args)
 *  - Idea 1213 — REST schema drift via OPTIONS (re-poll Allow headers, diff method sets)
 *  - Idea 1214 — breaking-change detection (diff removals against client usage,
 *    flag renames and pushes toward legacy endpoints)
 *
 * Pure functions: takes operator-supplied snapshots, returns structured findings.
 * Defensive/product framing only — detection and mapping logic for authorized
 * targets. No payloads, no weaponized code.
 */

/**
 * Compute the Levenshtein edit distance between two strings (rename detection).
 * @param {string} a
 * @param {string} b
 * @returns {number} edit distance
 */
export function levenshteinDistance(a = '', b = '') {
  const s1 = String(a);
  const s2 = String(b);
  if (s1 === s2) return 0;
  if (!s1.length) return s2.length;
  if (!s2.length) return s1.length;
  let prev = Array.from({ length: s2.length + 1 }, (_, i) => i);
  for (let i = 1; i <= s1.length; i++) {
    const curr = [i];
    for (let j = 1; j <= s2.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (s1[i - 1] === s2[j - 1] ? 0 : 1)
      );
    }
    prev = curr;
  }
  return prev[s2.length];
}

/**
 * Normalized similarity 0..1 derived from Levenshtein distance.
 * @param {string} a
 * @param {string} b
 * @returns {number} similarity
 */
export function nameSimilarity(a = '', b = '') {
  const s1 = String(a).toLowerCase();
  const s2 = String(b).toLowerCase();
  const longest = Math.max(s1.length, s2.length);
  if (!longest) return 1;
  return 1 - levenshteinDistance(s1, s2) / longest;
}

/**
 * Normalize a field map into { name: 'type' }. Accepts an object of
 * name->type, or an array of names or { name, type } entries.
 * @param {object|Array} fields
 * @returns {object} normalized { name: type }
 */
export function normalizeFieldMap(fields) {
  if (Array.isArray(fields)) {
    return Object.fromEntries(
      fields.map(f => (typeof f === 'string' ? [f, 'unknown'] : [String(f.name), String(f.type || 'unknown')]))
    );
  }
  if (fields && typeof fields === 'object') {
    return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, String(v)]));
  }
  return {};
}

/**
 * Diff two normalized field maps.
 * @param {object} before - { name: type }
 * @param {object} after - { name: type }
 * @returns {{added: Array, removed: Array, changed: Array, total: number}}
 */
export function diffFieldMaps(before = {}, after = {}) {
  const b = normalizeFieldMap(before);
  const a = normalizeFieldMap(after);
  const bKeys = new Set(Object.keys(b));
  const aKeys = new Set(Object.keys(a));
  const added = [...aKeys].filter(k => !bKeys.has(k)).map(name => ({ name, type: a[name] }));
  const removed = [...bKeys].filter(k => !aKeys.has(k)).map(name => ({ name, type: b[name] }));
  const changed = [...bKeys]
    .filter(k => aKeys.has(k) && a[k] !== b[k])
    .map(name => ({ name, from: b[name], to: a[name] }));
  return { added, removed, changed, total: added.length + removed.length + changed.length };
}

/**
 * Idea 1211 — detect response-schema drift between two snapshots.
 *
 * Snapshots: { "<endpoint>": { name: "type", ... } } — e.g. fields observed in
 * response bodies. Reports new endpoints (new surface), removed endpoints,
 * and per-endpoint added/removed/changed fields.
 *
 * @param {object} input
 * @param {object} input.before - baseline snapshot
 * @param {object} input.after - current snapshot
 * @param {string} [input.beforeLabel] - snapshot label
 * @param {string} [input.afterLabel] - snapshot label
 * @returns drift report with per-endpoint and roll-up findings
 */
export function detectResponseSchemaDrift({ before = {}, after = {}, beforeLabel = 'baseline', afterLabel = 'current' } = {}) {
  if (before === null || after === null) throw new TypeError('snapshots must be objects');
  const beforePaths = new Set(Object.keys(before));
  const afterPaths = new Set(Object.keys(after));
  const addedEndpoints = [...afterPaths].filter(p => !beforePaths.has(p));
  const removedEndpoints = [...beforePaths].filter(p => !afterPaths.has(p));

  const endpointDrift = [...beforePaths]
    .filter(p => afterPaths.has(p))
    .map(path => ({ path, ...diffFieldMaps(before[path], after[path]) }))
    .filter(d => d.total > 0);

  const addedFieldCount = endpointDrift.reduce((n, d) => n + d.added.length, 0);
  const removedFieldCount = endpointDrift.reduce((n, d) => n + d.removed.length, 0);
  const changedFieldCount = endpointDrift.reduce((n, d) => n + d.changed.length, 0);

  const total =
    addedEndpoints.length + removedEndpoints.length + addedFieldCount + removedFieldCount + changedFieldCount;
  const confidence = addedFieldCount > 0 || addedEndpoints.length > 0 ? 'high' : total > 0 ? 'medium' : 'low';

  return {
    type: 'Response-Schema Drift Detection',
    confidence,
    evidence:
      `${beforeLabel} -> ${afterLabel}: ${addedEndpoints.length} new endpoint(s), ` +
      `${removedEndpoints.length} removed endpoint(s), ${addedFieldCount} added field(s), ` +
      `${removedFieldCount} removed field(s), ${changedFieldCount} type-changed field(s).`,
    beforeLabel,
    afterLabel,
    addedEndpoints,
    removedEndpoints,
    endpointDrift,
    summary: {
      addedFields: addedFieldCount,
      removedFields: removedFieldCount,
      changedFields: changedFieldCount,
    },
  };
}

/**
 * Idea 1212 — track GraphQL schema drift between two introspection snapshots.
 *
 * Schema shape: { types: { TypeName: { kind: 'OBJECT', fields: {
 *   fieldName: { type: 'String', args: { arg: 'ID' }, deprecated: false,
 *     deprecationReason: null } } } } }.
 *
 * @param {object} input
 * @param {object} input.before - baseline introspection schema
 * @param {object} input.after - current introspection schema
 * @returns drift report covering types, fields, args, and deprecation markers
 */
export function trackGraphqlSchemaDrift({ before = {}, after = {} } = {}) {
  const bTypes = (before && before.types) || {};
  const aTypes = (after && after.types) || {};
  const bNames = new Set(Object.keys(bTypes));
  const aNames = new Set(Object.keys(aTypes));

  const addedTypes = [...aNames].filter(t => !bNames.has(t));
  const removedTypes = [...bNames].filter(t => !aNames.has(t));

  const typeDrift = [...bNames]
    .filter(t => aNames.has(t))
    .map(typeName => {
      const bf = (bTypes[typeName] && bTypes[typeName].fields) || {};
      const af = (aTypes[typeName] && aTypes[typeName].fields) || {};
      const bFields = new Set(Object.keys(bf));
      const aFields = new Set(Object.keys(af));
      const addedFields = [...aFields].filter(f => !bFields.has(f)).map(f => ({ type: typeName, field: f, detail: af[f] }));
      const removedFields = [...bFields].filter(f => !aFields.has(f)).map(f => ({ type: typeName, field: f, detail: bf[f] }));
      const argChanges = [];
      const newlyDeprecated = [];
      for (const f of [...bFields].filter(f2 => aFields.has(f2))) {
        const bd = bf[f] || {};
        const ad = af[f] || {};
        const bArgs = bd.args || {};
        const aArgs = ad.args || {};
        const argDiff = diffFieldMaps(bArgs, aArgs);
        if (argDiff.total > 0) argChanges.push({ type: typeName, field: f, ...argDiff });
        if (!bd.deprecated && ad.deprecated) {
          newlyDeprecated.push({ type: typeName, field: f, reason: ad.deprecationReason || null });
        }
      }
      const total = addedFields.length + removedFields.length + argChanges.length + newlyDeprecated.length;
      return { type: typeName, addedFields, removedFields, argChanges, newlyDeprecated, total };
    })
    .filter(t => t.total > 0);

  const newSurface =
    addedTypes.length +
    typeDrift.reduce((n, t) => n + t.addedFields.length, 0);
  const total =
    newSurface + removedTypes.length +
    typeDrift.reduce((n, t) => n + t.removedFields.length + t.argChanges.length + t.newlyDeprecated.length, 0);
  const confidence = newSurface > 0 ? 'high' : total > 0 ? 'medium' : 'low';

  return {
    type: 'GraphQL Schema Drift Tracking',
    confidence,
    evidence:
      `Introspection diff: ${addedTypes.length} new type(s), ${removedTypes.length} removed type(s), ` +
      `${typeDrift.reduce((n, t) => n + t.addedFields.length, 0)} new field(s), ` +
      `${typeDrift.reduce((n, t) => n + t.removedFields.length, 0)} removed field(s), ` +
      `${typeDrift.reduce((n, t) => n + t.argChanges.length, 0)} arg change(s), ` +
      `${typeDrift.reduce((n, t) => n + t.newlyDeprecated.length, 0)} newly deprecated field(s).`,
    addedTypes,
    removedTypes,
    typeDrift,
  };
}

/**
 * Idea 1213 — detect REST schema drift via OPTIONS Allow headers.
 *
 * Snapshots: { "<path>": ["GET", "HEAD", ...] } — the Allow header methods
 * observed per path. New methods between deploys signal new functionality.
 *
 * @param {object} input
 * @param {object} input.before - baseline path->methods map
 * @param {object} input.after - current path->methods map
 * @returns drift report with per-path method additions/removals
 */
export function detectRestSchemaDrift({ before = {}, after = {} } = {}) {
  const norm = map =>
    Object.fromEntries(
      Object.entries(map || {}).map(([p, methods]) => [
        p,
        [...new Set((Array.isArray(methods) ? methods : []).map(m => String(m).toUpperCase()))].sort(),
      ])
    );
  const b = norm(before);
  const a = norm(after);
  const bPaths = new Set(Object.keys(b));
  const aPaths = new Set(Object.keys(a));
  const addedPaths = [...aPaths].filter(p => !bPaths.has(p)).map(p => ({ path: p, methods: a[p] }));
  const removedPaths = [...bPaths].filter(p => !aPaths.has(p)).map(p => ({ path: p, methods: b[p] }));

  const methodDrift = [...bPaths]
    .filter(p => aPaths.has(p))
    .map(path => {
      const addedMethods = a[path].filter(m => !b[path].includes(m));
      const removedMethods = b[path].filter(m => !a[path].includes(m));
      return { path, addedMethods, removedMethods };
    })
    .filter(d => d.addedMethods.length || d.removedMethods.length);

  const addedMethodCount = methodDrift.reduce((n, d) => n + d.addedMethods.length, 0);
  const total = addedPaths.length + removedPaths.length + addedMethodCount +
    methodDrift.reduce((n, d) => n + d.removedMethods.length, 0);
  const confidence = addedMethodCount > 0 || addedPaths.length > 0 ? 'high' : total > 0 ? 'medium' : 'low';

  return {
    type: 'REST Schema Drift via OPTIONS',
    confidence,
    evidence:
      `OPTIONS Allow diff: ${addedPaths.length} new path(s), ${removedPaths.length} removed path(s), ` +
      `${addedMethodCount} added method(s), ` +
      `${methodDrift.reduce((n, d) => n + d.removedMethods.length, 0)} removed method(s).`,
    addedPaths,
    removedPaths,
    methodDrift,
  };
}

const VERSION_PATH_RE = /\/(v\d+|beta|v\d+\.\d+)(?=\/|$)/i;

/**
 * Idea 1214 — detect breaking changes by diffing removals against client usage.
 *
 * Removals are only "breaking" if real clients still consume them; breaking
 * changes push clients toward legacy endpoints, so removed endpoints that
 * duplicate surviving versioned routes are flagged as legacy-push risks.
 *
 * @param {object} input
 * @param {object} input.before - baseline { endpoint: fieldMap }
 * @param {object} input.after - current { endpoint: fieldMap }
 * @param {object} [input.clientUsage] - { endpoint: [fields clients actually consume] }
 * @returns breaking-change findings with renames and legacy-push hints
 */
export function detectBreakingChanges({ before = {}, after = {}, clientUsage = {} } = {}) {
  const drift = detectResponseSchemaDrift({ before, after, beforeLabel: 'baseline', afterLabel: 'current' });

  const removedFieldFindings = [];
  for (const d of drift.endpointDrift) {
    const used = new Set(clientUsage[d.path] || []);
    for (const r of d.removed) {
      removedFieldFindings.push({
        endpoint: d.path,
        field: r.name,
        type: r.type,
        breaking: used.has(r.name),
        evidence: used.has(r.name)
          ? `Removed field "${r.name}" is in observed client usage — breaking.`
          : `Removed field "${r.name}" is not in observed client usage.`,
      });
    }
  }

  // Rename guesses: removed field names very similar to added field names.
  const possibleRenames = [];
  for (const d of drift.endpointDrift) {
    for (const r of d.removed) {
      let best = null;
      for (const added of d.added) {
        const sim = nameSimilarity(r.name, added.name);
        if (sim >= 0.6 && (!best || sim > best.similarity)) {
          best = { endpoint: d.path, from: r.name, to: added.name, similarity: Number(sim.toFixed(3)) };
        }
      }
      if (best) possibleRenames.push(best);
    }
  }

  // Legacy-push hints: removed versioned paths whose sibling version still lives.
  const legacyPushHints = drift.removedEndpoints
    .filter(p => VERSION_PATH_RE.test(p))
    .map(p => {
      const unversioned = p.replace(VERSION_PATH_RE, '/');
      const sibling = drift.endpointDrift.find(d => d.path === unversioned || d.path === p.replace(VERSION_PATH_RE, match => (match.toLowerCase() === '/v1' ? '/v2' : '/v1')));
      return {
        removedEndpoint: p,
        legacySiblingLive: Boolean(sibling || Object.keys(after).some(q => q === unversioned)),
        evidence: `Versioned endpoint removed; clients may fall back to a legacy route.`,
      };
    });

  const breakingCount = removedFieldFindings.filter(f => f.breaking).length;
  const confidence =
    breakingCount > 0 || legacyPushHints.length > 0 ? 'high' : possibleRenames.length > 0 ? 'medium' : 'low';

  return {
    type: 'Breaking-Change Detection',
    confidence,
    evidence:
      `${breakingCount} breaking field removal(s) against observed client usage, ` +
      `${possibleRenames.length} possible rename(s), ${legacyPushHints.length} legacy-push hint(s).`,
    breakingRemovals: removedFieldFindings.filter(f => f.breaking),
    nonBreakingRemovals: removedFieldFindings.filter(f => !f.breaking),
    possibleRenames,
    legacyPushHints,
  };
}

export const SCHEMA_DRIFT_RECON = {
  levenshteinDistance,
  nameSimilarity,
  normalizeFieldMap,
  diffFieldMaps,
  detectResponseSchemaDrift,
  trackGraphqlSchemaDrift,
  detectRestSchemaDrift,
  detectBreakingChanges,
};
export default SCHEMA_DRIFT_RECON;
