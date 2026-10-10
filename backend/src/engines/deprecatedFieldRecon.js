/**
 * deprecatedFieldRecon.js — deprecated-field recon for authorized bug-bounty hunts.
 *
 * Deprecation is documentation, not enforcement: deprecated members often keep
 * resolving and sometimes return less-redacted data than their replacements.
 *
 *  - Idea 1215 — deprecated-field resolvability test (deprecated fields often
 *    remain resolvable and still carry sensitive data)
 *  - Idea 1216 — deprecated-field data exposure (compare deprecated vs
 *    replacement field output; deprecated fields may return unredacted values)
 *  - Idea 1217 — field-deprecation still-live sweep (enumerate every deprecated
 *    schema member — deprecation is not removal)
 *
 * Pure functions: takes operator-supplied schemas and sampled values, returns
 * structured findings. Defensive/product framing only — detection and mapping
 * logic for authorized targets. No payloads, no weaponized code.
 */

const DEPRECATION_MARKERS = ['deprecated', 'obsolete', 'sunset', 'legacy', 'eol'];

/**
 * Return true when a text label signals deprecation.
 * @param {string} text
 * @returns {boolean}
 */
export function looksDeprecated(text = '') {
  const s = String(text).toLowerCase();
  return DEPRECATION_MARKERS.some(m => s.includes(m));
}

/**
 * Idea 1217 — sweep a schema for every deprecated member (types, fields,
 * arguments, enum values) that is still present and therefore still live.
 *
 * Schema shape: { types: { TypeName: { kind: 'OBJECT', deprecated: false,
 *   fields: { fieldName: { type, deprecated: bool, deprecationReason,
 *   args: { argName: { type, deprecated, deprecationReason } },
 *   enumValues: [ { name, deprecated, deprecationReason } ] } } } } }.
 *
 * @param {object} input
 * @param {object} input.schema - introspected schema snapshot
 * @returns enumerated deprecated members with location, kind, and reason
 */
export function sweepDeprecatedSchemaMembers({ schema = {} } = {}) {
  const types = (schema && schema.types) || {};
  const members = [];

  const record = (location, kind, name, reason) =>
    members.push({
      location,
      kind,
      name,
      reason: reason || null,
      stillLive: true,
      evidence: `${kind} "${location}" is marked deprecated but remains in the live schema — deprecation is documentation, not enforcement.`,
    });

  for (const [typeName, typeDef = {}] of Object.entries(types)) {
    if (typeDef.deprecated || looksDeprecated(typeDef.deprecationReason)) {
      record(typeName, 'type', typeName, typeDef.deprecationReason);
    }
    const fields = typeDef.fields || {};
    for (const [fieldName, fieldDef = {}] of Object.entries(fields)) {
      const where = `${typeName}.${fieldName}`;
      if (fieldDef.deprecated || looksDeprecated(fieldDef.deprecationReason)) {
        record(where, 'field', fieldName, fieldDef.deprecationReason);
      }
      const args = fieldDef.args || {};
      for (const [argName, argDef = {}] of Object.entries(args)) {
        if ((argDef && (argDef.deprecated || looksDeprecated(argDef.deprecationReason)))) {
          record(`${where}(${argName})`, 'argument', argName, argDef.deprecationReason);
        }
      }
      const enumValues = Array.isArray(fieldDef.enumValues) ? fieldDef.enumValues : [];
      for (const ev of enumValues) {
        if (ev && (ev.deprecated || looksDeprecated(ev.deprecationReason))) {
          record(`${typeName}.${ev.name}`, 'enum value', ev.name, ev.deprecationReason);
        }
      }
    }
    const typeEnumValues = Array.isArray(typeDef.enumValues) ? typeDef.enumValues : [];
    for (const ev of typeEnumValues) {
      if (ev && (ev.deprecated || looksDeprecated(ev.deprecationReason))) {
        record(`${typeName}.${ev.name}`, 'enum value', ev.name, ev.deprecationReason);
      }
    }
  }

  return {
    type: 'Field-Deprecation Still-Live Sweep',
    confidence: members.length > 0 ? 'high' : 'low',
    evidence: `${members.length} deprecated schema member(s) still present in the live schema.`,
    members,
  };
}

/**
 * Idea 1215 — test whether deprecated members still resolve.
 *
 * `deprecated` lists member paths from the sweep; `resolved` lists the member
 * paths that returned data during operator-conducted probe queries, with a
 * redacted evidence sample. Only members present in BOTH lists are
 * confirmed still-resolving.
 *
 * @param {object} input
 * @param {Array<string>} input.deprecated - deprecated member paths
 * @param {Array<object>} input.resolved - [{ path, returnedData: bool, sample? }]
 * @returns per-member resolvability findings
 */
export function testDeprecatedFieldResolvability({ deprecated = [], resolved = [] } = {}) {
  const resolvedByPath = new Map(resolved.map(r => [String(r.path), r]));
  const findings = deprecated.map(path => {
    const probe = resolvedByPath.get(String(path));
    const stillResolves = Boolean(probe && probe.returnedData);
    return {
      path,
      stillResolves,
      sample: probe && probe.sample !== undefined ? probe.sample : null,
      confidence: stillResolves ? 'high' : 'medium',
      evidence: stillResolves
        ? `Deprecated member "${path}" still resolves and returned data — deprecation did not disable it.`
        : `Deprecated member "${path}" returned no data in the sampled probe (may still resolve under other inputs).`,
    };
  });

  const stillLive = findings.filter(f => f.stillResolves);
  return {
    type: 'Deprecated-Field Resolvability Test',
    confidence: stillLive.length > 0 ? 'high' : 'medium',
    evidence: `${stillLive.length}/${findings.length} deprecated member(s) confirmed still resolving.`,
    findings,
  };
}

const REDACTION_TOKENS = ['***', 'xxx', 'redacted', '[hidden]', '[masked]', '••••', '****'];

/**
 * Heuristic: does a value look deliberately redacted/masked?
 * @param {*} value
 * @returns {boolean}
 */
export function looksRedacted(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') {
    const s = value.trim().toLowerCase();
    return s === '' || REDACTION_TOKENS.some(t => s.includes(t));
  }
  return false;
}

/**
 * Idea 1216 — compare deprecated vs replacement field output for exposure gaps.
 *
 * Each pair: { deprecated: { field, value }, replacement: { field, value } }.
 * Flags the case where the deprecated path returns real data while the
 * replacement is redacted/empty, or where the deprecated output carries keys
 * the replacement no longer exposes.
 *
 * @param {object} input
 * @param {Array<object>} input.pairs - deprecated/replacement output pairs
 * @returns per-pair exposure verdicts
 */
export function compareDeprecatedFieldExposure({ pairs = [] } = {}) {
  const findings = pairs.map(pair => {
    const d = pair.deprecated || {};
    const r = pair.replacement || {};
    const dRedacted = looksRedacted(d.value);
    const rRedacted = looksRedacted(r.value);

    const dKeys =
      d.value && typeof d.value === 'object' && !Array.isArray(d.value) ? Object.keys(d.value) : null;
    const rKeys =
      r.value && typeof r.value === 'object' && !Array.isArray(r.value) ? Object.keys(r.value) : null;
    const extraKeys =
      dKeys && rKeys ? dKeys.filter(k => !rKeys.includes(k)) : [];

    let verdict = 'equivalent';
    let confidence = 'low';
    let detail = 'Deprecated and replacement outputs match.';
    if (!dRedacted && rRedacted) {
      verdict = 'exposes-unredacted';
      confidence = 'high';
      detail = `Deprecated "${d.field}" returns data while replacement "${r.field}" is redacted.`;
    } else if (extraKeys.length > 0) {
      verdict = 'exposes-extra-keys';
      confidence = 'medium';
      detail = `Deprecated "${d.field}" exposes keys the replacement drops: ${extraKeys.join(', ')}.`;
    } else if (
      typeof d.value === 'string' && typeof r.value === 'string' &&
      d.value.length > r.value.length * 2 && !rRedacted
    ) {
      verdict = 'exposes-more-detail';
      confidence = 'medium';
      detail = `Deprecated "${d.field}" returns a notably longer value than its replacement.`;
    }

    return {
      deprecatedField: d.field || null,
      replacementField: r.field || null,
      verdict,
      confidence,
      evidence: detail,
      deprecatedRedacted: dRedacted,
      replacementRedacted: rRedacted,
      extraKeys,
    };
  });

  const exposing = findings.filter(f => f.verdict !== 'equivalent');
  return {
    type: 'Deprecated-Field Data Exposure',
    confidence: exposing.some(f => f.confidence === 'high') ? 'high' : exposing.length > 0 ? 'medium' : 'low',
    evidence: `${exposing.length}/${findings.length} pair(s) show the deprecated field exposing more than its replacement.`,
    findings,
  };
}

export const DEPRECATED_FIELD_RECON = {
  looksDeprecated,
  sweepDeprecatedSchemaMembers,
  testDeprecatedFieldResolvability,
  looksRedacted,
  compareDeprecatedFieldExposure,
};
export default DEPRECATED_FIELD_RECON;
