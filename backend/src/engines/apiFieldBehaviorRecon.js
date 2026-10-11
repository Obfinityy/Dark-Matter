/**
 * apiFieldBehaviorRecon.js — API input-field behavior reconnaissance.
 *
 * Defensive analyzer functions for an authorized bug-bounty agent. Each function
 * inspects OBSERVED behavior (response bodies, status codes, schema docs) of
 * authorized targets and derives a security verdict about the input surface —
 * nullability handling, server defaults, read-only/write-only fields,
 * mass-assignment tolerance, enum strictness, and date/time/locale parsing.
 * They analyze recorded probe outcomes; they never send exploit payloads,
 * never brute-force anything live, and never handle real credentials.
 *
 * Covers idea-bank ideas 1251-1260:
 *  1251 mapNullableVsRequired — flip nullability on fields, map inconsistent null handling
 *  1252 detectDefaultPrivilegeEscalation — omit fields to trigger defaults; flag defaults
 *    that grant broader access than explicit values
 *  1253 testReadOnlyWrite — attempt writes to documented read-only fields; mass-assignment flags
 *  1254 testWriteOnlyRead — try reading password-style write-only fields; serializer leak flags
 *  1255 testExtraFieldAcceptance — inject unknown fields; measure mass-assignment tolerance
 *  1256 fuzzEnumValues — submit undocumented enum members; flag hidden states/roles
 *  1257 testEnumCaseSensitivity — vary enum casing; flag case-insensitive acceptance
 *  1258 mapDateFormatQuirks — try ISO/epoch/locale formats per endpoint; map lenient parsing
 *  1259 testTimezoneDifferentials — submit times in conflicting zones; flag divergent interpretation
 *  1260 mapLocaleBehavior — vary Accept-Language; map locale-dependent validation differences
 */

/** Ideas implemented by this module (auditable coverage). */
export const WAVE1251_COVERAGE = [1251, 1252, 1253, 1254, 1255, 1256, 1257, 1258, 1259, 1260];

/**
 * Map an idea number to the function that implements it.
 * @returns {Record<number, string>} idea number -> exported function name
 */
export function ideaFunctions() {
  return {
    1251: 'mapNullableVsRequired',
    1252: 'detectDefaultPrivilegeEscalation',
    1253: 'testReadOnlyWrite',
    1254: 'testWriteOnlyRead',
    1255: 'testExtraFieldAcceptance',
    1256: 'fuzzEnumValues',
    1257: 'testEnumCaseSensitivity',
    1258: 'mapDateFormatQuirks',
    1259: 'testTimezoneDifferentials',
    1260: 'mapLocaleBehavior',
  };
}

// ---------------------------------------------------------------- 1251 ----

const REQUIRED_VIOLATION_STATUSES = new Set([400, 422]);

/**
 * Map how a field behaves when null is submitted versus when it is omitted
 * or given a value, and compare against the schema's documented nullability.
 *
 * Inconsistent null handling (null accepted on a documented-required field, or
 * null silently downgraded to a default) reveals optional or missing security
 * checks that only run on non-null values.
 *
 * @param {object} obs
 * @param {string} obs.field — field name under test.
 * @param {boolean} obs.documentedRequired — schema marks the field required.
 * @param {boolean} obs.documentedNullable — schema marks the field nullable.
 * @param {number} [obs.nullStatus] — HTTP status observed when submitting explicit null.
 * @param {number} [obs.omittedStatus] — HTTP status observed when omitting the field.
 * @param {number} [obs.valueStatus] — HTTP status observed when submitting a valid value.
 * @param {any} [obs.nullEchoedValue] — value the server stored/echoed back after a null submission.
 * @returns {{ verdict: 'CONSISTENT'|'INCONSISTENT'|'UNKNOWN', inconsistencies: string[], score: number, findings: string[] }}
 *   score 100 = nullability handling matches docs; lower = divergence found.
 */
export function mapNullableVsRequired({
  field = '',
  documentedRequired = false,
  documentedNullable = false,
  nullStatus,
  omittedStatus,
  valueStatus,
  nullEchoedValue,
} = {}) {
  const findings = [];
  const inconsistencies = [];
  const name = String(field || 'field');

  const statuses = [nullStatus, omittedStatus, valueStatus].filter((s) => typeof s === 'number');
  if (statuses.length === 0) {
    findings.push('No probe observations supplied — nullability verdict is unknown.');
    return { verdict: 'UNKNOWN', inconsistencies, score: 0, findings };
  }

  if (documentedRequired && !documentedNullable && typeof nullStatus === 'number') {
    if (nullStatus >= 200 && nullStatus < 300) {
      inconsistencies.push(
        `Explicit null was accepted (HTTP ${nullStatus}) on documented-required, non-nullable field "${name}".`
      );
    } else if (!REQUIRED_VIOLATION_STATUSES.has(nullStatus)) {
      inconsistencies.push(
        `Null on required field "${name}" returned HTTP ${nullStatus} instead of a 400/422 validation error — ` +
        'null handling may bypass validation.'
      );
    } else {
      findings.push(`Null on required field "${name}" was rejected with HTTP ${nullStatus} — validation enforced.`);
    }
  }

  if (documentedRequired && typeof omittedStatus === 'number') {
    if (omittedStatus >= 200 && omittedStatus < 300 && typeof nullStatus === 'number' && nullStatus >= 400) {
      inconsistencies.push(
        `Omitting "${name}" was accepted while explicit null was rejected — null-vs-omitted handling diverges; ` +
        'security checks may only fire on one path.'
      );
    }
  }

  if (typeof nullStatus === 'number' && nullStatus >= 200 && nullStatus < 300 && nullEchoedValue !== undefined) {
    const silentDefault = nullEchoedValue !== null && String(nullEchoedValue) !== '';
    if (silentDefault) {
      inconsistencies.push(
        `Null for "${name}" was silently converted to "${String(nullEchoedValue)}" — null coercion may skip value checks.`
      );
    }
  }

  if (typeof valueStatus === 'number' && valueStatus >= 400 && typeof nullStatus === 'number' && nullStatus < 300) {
    inconsistencies.push(
      `A valid value for "${name}" was rejected (HTTP ${valueStatus}) while null was accepted — ` +
      'inverted validation; check for null-skip logic in authorization code.'
    );
  }

  const score = inconsistencies.length === 0 ? 100 : Math.max(0, 100 - inconsistencies.length * 35);
  const verdict = inconsistencies.length === 0 ? 'CONSISTENT' : 'INCONSISTENT';
  findings.unshift(
    inconsistencies.length === 0
      ? `Nullability behavior for "${name}" matches the documented schema.`
      : `${inconsistencies.length} nullability inconsistency${inconsistencies.length === 1 ? '' : 'ies'} found for "${name}".`
  );

  return { verdict, inconsistencies, score, findings };
}

// ---------------------------------------------------------------- 1252 ----

/**
 * Detect whether omitting a field triggers a server-side default that is MORE
 * privileged than an explicitly supplied value. Observed by comparing the
 * effective result of an explicit submission versus an omission.
 *
 * @param {object} obs
 * @param {string} obs.field — field name under test.
 * @param {any} obs.explicitValue — value submitted explicitly.
 * @param {any} obs.omittedEffectiveValue — effective value the server applied when the field was omitted.
 * @param {Array<[string, string]>} [obs.privilegeOrder] — optional ordered pairs [lower, higher]
 *   expressing a known privilege ladder, e.g. [["viewer","editor"],["editor","admin"]].
 * @returns {{ escalation: boolean, finding: string|null, findings: string[] }}
 */
export function detectDefaultPrivilegeEscalation({
  field = '',
  explicitValue,
  omittedEffectiveValue,
  privilegeOrder = [],
} = {}) {
  const findings = [];
  const name = String(field || 'field');

  if (explicitValue === undefined || omittedEffectiveValue === undefined) {
    findings.push('Explicit/omitted observations missing — default-escalation verdict is unknown.');
    return { escalation: false, finding: null, findings };
  }

  const explicitStr = String(explicitValue);
  const omittedStr = String(omittedEffectiveValue);

  let escalation = false;
  if (explicitStr !== omittedStr) {
    // Check the documented privilege ladder first.
    const ladder = Array.isArray(privilegeOrder) ? privilegeOrder : [];
    const rank = new Map();
    for (const [lower, higher] of ladder) {
      if (!rank.has(String(lower))) rank.set(String(lower), rank.size);
      if (!rank.has(String(higher))) rank.set(String(higher), rank.size);
    }
    const explicitRank = rank.get(explicitStr);
    const omittedRank = rank.get(omittedStr);
    if (explicitRank !== undefined && omittedRank !== undefined) {
      escalation = omittedRank > explicitRank;
    } else {
      // Fallback heuristic: common role/visibility tokens.
      const tokenRank = (t) => {
        const s = String(t).toLowerCase();
        if (/admin|owner|superuser/.test(s)) return 4;
        if (/editor|write|publish|maintainer/.test(s)) return 3;
        if (/member|user|read|viewer/.test(s)) return 2;
        if (/guest|public|none|disabled|false|0/.test(s)) return 1;
        return -1;
      };
      const er = tokenRank(explicitStr);
      const or = tokenRank(omittedStr);
      escalation = er >= 0 && or >= 0 && or > er;
      findings.push(
        'No documented privilege ladder supplied — applied a common role/visibility token heuristic; ' +
        'confirm with the target authorization docs.'
      );
    }
  }

  let finding = null;
  if (escalation) {
    finding =
      `Omitting "${name}" applies default "${omittedStr}", which is MORE privileged than the explicitly ` +
      `submitted "${explicitStr}" — an attacker can gain elevation by simply not sending the field. ` +
      'Recommend explicit allowlist defaults and server-side re-validation of defaults against the caller\'s role.';
  } else {
    findings.push(
      explicitStr === omittedStr
        ? `Omission of "${name}" resolves to the same value ("${omittedStr}") as the explicit submission — no escalation.`
        : `Omission default "${omittedStr}" is not more privileged than explicit "${explicitStr}" — no escalation via omission.`
    );
  }

  return { escalation, finding, findings };
}

// ---------------------------------------------------------------- 1253 ----

/**
 * Analyze attempts to write documented read-only fields.
 *
 * @param {object} obs
 * @param {Array<{ field: string, writeStatus: number, valuePersisted?: boolean }>} [obs.attempts]
 *   — one entry per read-only field write attempt.
 * @returns {{ verdict: 'ENFORCED'|'MASS_ASSIGNMENT'|'UNKNOWN', writableFields: string[], findings: string[] }}
 */
export function testReadOnlyWrite({ attempts = [] } = {}) {
  const findings = [];
  const list = Array.isArray(attempts) ? attempts : [];
  if (list.length === 0) {
    findings.push('No read-only write attempts recorded — verdict is unknown.');
    return { verdict: 'UNKNOWN', writableFields: [], findings };
  }

  const writableFields = list
    .filter((a) => a && (a.valuePersisted === true || (typeof a.writeStatus === 'number' && a.writeStatus >= 200 && a.writeStatus < 300 && a.valuePersisted !== false)))
    .map((a) => String(a.field));

  if (writableFields.length > 0) {
    findings.push(
      `${writableFields.length}/${list.length} documented read-only fields accepted writes and persisted values: ` +
      `${writableFields.join(', ')} — read-only is documentation-only here; mass-assignment protection is missing.`
    );
    return { verdict: 'MASS_ASSIGNMENT', writableFields, findings };
  }

  findings.push(`All ${list.length} read-only fields rejected writes — server-side enforcement appears present.`);
  return { verdict: 'ENFORCED', writableFields: [], findings };
}

// ---------------------------------------------------------------- 1254 ----

/**
 * Analyze whether password-style write-only fields leak back in responses.
 *
 * @param {object} obs
 * @param {Array<{ field: string, submitted: boolean, echoedInResponse?: boolean, echoedHash?: boolean }>} [obs.reads]
 *   — one entry per write-only field read attempt.
 * @returns {{ verdict: 'CLEAN'|'LEAK'|'UNKNOWN', leakedFields: Array<{ field: string, mode: 'plaintext'|'hash' }>, findings: string[] }}
 */
export function testWriteOnlyRead({ reads = [] } = {}) {
  const findings = [];
  const list = Array.isArray(reads) ? reads : [];
  if (list.length === 0) {
    findings.push('No write-only read attempts recorded — verdict is unknown.');
    return { verdict: 'CLEAN', leakedFields: [], findings };
  }

  const leakedFields = [];
  for (const r of list) {
    if (!r || r.submitted !== true) continue;
    if (r.echoedInResponse === true) {
      leakedFields.push({ field: String(r.field), mode: r.echoedHash === true ? 'hash' : 'plaintext' });
    }
  }

  if (leakedFields.length > 0) {
    for (const { field, mode } of leakedFields) {
      findings.push(
        mode === 'plaintext'
          ? `Write-only field "${field}" was returned in a response in PLAINTEXT — serializer leak; this is a credential exposure.`
          : `Write-only field "${field}" was returned as a HASH — hashes of low-entropy secrets are offline-crackable; suppress the field.`
      );
    }
    return { verdict: 'LEAK', leakedFields, findings };
  }

  findings.push(`All ${list.length} submitted write-only fields were absent from responses — serializers suppress them.`);
  return { verdict: 'CLEAN', leakedFields: [], findings };
}

// ---------------------------------------------------------------- 1255 ----

/**
 * Measure mass-assignment tolerance: submit unknown fields and observe whether
 * the server accepts, strips, or rejects them.
 *
 * @param {object} obs
 * @param {Array<{ field: string, status: number, echoed?: boolean, persisted?: boolean }>} [obs.submissions]
 *   — one entry per unknown-field injection.
 * @returns {{ tolerance: 'ACCEPTS'|'STRIPS'|'REJECTS'|'UNKNOWN', acceptedCount: number, rejectedCount: number, findings: string[] }}
 */
export function testExtraFieldAcceptance({ submissions = [] } = {}) {
  const findings = [];
  const list = Array.isArray(submissions) ? submissions : [];
  if (list.length === 0) {
    findings.push('No unknown-field submissions recorded — mass-assignment tolerance is unknown.');
    return { tolerance: 'UNKNOWN', acceptedCount: 0, rejectedCount: 0, findings };
  }

  const accepted = list.filter((s) => s && typeof s.status === 'number' && s.status >= 200 && s.status < 300);
  const rejected = list.filter((s) => s && typeof s.status === 'number' && (s.status === 400 || s.status === 422));
  const echoed = accepted.filter((s) => s.echoed === true || s.persisted === true);

  let tolerance;
  if (echoed.length > 0) {
    tolerance = 'ACCEPTS';
    findings.push(
      `${echoed.length}/${list.length} unknown fields were accepted AND echoed/persisted ` +
      `(${echoed.map((s) => s.field).join(', ')}) — the server binds undeclared fields; mass-assignment surface is confirmed.`
    );
  } else if (accepted.length > 0) {
    tolerance = 'STRIPS';
    findings.push(
      `${accepted.length}/${list.length} unknown fields were accepted but stripped (no echo/persist) — ` +
      'binding is tolerant but the server whitelists on write; still, tolerant parsers deserve a second look.'
    );
  } else if (rejected.length > 0) {
    tolerance = 'REJECTS';
    findings.push(
      `${rejected.length}/${list.length} unknown fields were rejected with 400/422 — strict schema validation is enforced.`
    );
  } else {
    tolerance = 'UNKNOWN';
    findings.push('Submissions were inconclusive (no 2xx and no 400/422 observed).');
  }

  return { tolerance, acceptedCount: accepted.length, rejectedCount: rejected.length, findings };
}

// ---------------------------------------------------------------- 1256 ----

/**
 * Submit undocumented enum members and classify which are accepted.
 *
 * @param {object} obs
 * @param {string} obs.field — enum field under test.
 * @param {string[]} [obs.documentedMembers] — enum members listed in the schema/docs.
 * @param {Array<{ member: string, status: number, effect?: string }>} [obs.submissions]
 *   — one entry per undocumented member tried.
 * @returns {{ verdict: 'STRICT'|'HIDDEN_MEMBERS'|'UNKNOWN', hiddenMembers: Array<{ member: string, effect?: string }>, findings: string[] }}
 */
export function fuzzEnumValues({ field = '', documentedMembers = [], submissions = [] } = {}) {
  const findings = [];
  const name = String(field || 'field');
  const documented = new Set((Array.isArray(documentedMembers) ? documentedMembers : []).map(String));
  const list = Array.isArray(submissions) ? submissions : [];

  if (list.length === 0) {
    findings.push('No undocumented enum submissions recorded — enum strictness is unknown.');
    return { verdict: 'UNKNOWN', hiddenMembers: [], findings };
  }

  const hiddenMembers = list
    .filter((s) => s && !documented.has(String(s.member)) && typeof s.status === 'number' && s.status >= 200 && s.status < 300)
    .map((s) => ({ member: String(s.member), effect: s.effect }));

  if (hiddenMembers.length > 0) {
    findings.push(
      `${hiddenMembers.length}/${list.length} undocumented enum members were accepted for "${name}": ` +
      `${hiddenMembers.map((h) => h.member).join(', ')} — hidden members may unlock unlisted states or roles; ` +
      'cross-reference with authorization checks for each accepted member.'
    );
    return { verdict: 'HIDDEN_MEMBERS', hiddenMembers, findings };
  }

  findings.push(`All ${list.length} undocumented members for "${name}" were rejected — enum is strictly validated.`);
  return { verdict: 'STRICT', hiddenMembers: [], findings };
}

// ---------------------------------------------------------------- 1257 ----

/**
 * Vary enum casing and classify acceptance.
 *
 * @param {object} obs
 * @param {string} obs.field — enum field under test.
 * @param {string} obs.documentedMember — the exact documented casing, e.g. "ADMIN".
 * @param {Array<{ variant: string, status: number, normalizedTo?: string }>} [obs.variants]
 *   — casing variants tried, e.g. "admin", "Admin".
 * @returns {{ caseSensitive: boolean|null, acceptedVariants: Array<{ variant: string, normalizedTo?: string }>, findings: string[] }}
 */
export function testEnumCaseSensitivity({ field = '', documentedMember = '', variants = [] } = {}) {
  const findings = [];
  const name = String(field || 'field');
  const list = Array.isArray(variants) ? variants : [];

  if (list.length === 0) {
    findings.push('No casing variants tried — case-sensitivity verdict is unknown.');
    return { caseSensitive: null, acceptedVariants: [], findings };
  }

  const acceptedVariants = list
    .filter((v) => v && typeof v.status === 'number' && v.status >= 200 && v.status < 300 && String(v.variant) !== String(documentedMember))
    .map((v) => ({ variant: String(v.variant), normalizedTo: v.normalizedTo !== undefined ? String(v.normalizedTo) : undefined }));

  if (acceptedVariants.length > 0) {
    findings.push(
      `Enum "${name}" accepted ${acceptedVariants.length} non-canonical casing variant${acceptedVariants.length === 1 ? '' : 's'} ` +
      `(${acceptedVariants.map((v) => v.variant).join(', ')}) — matching is case-insensitive; ` +
      'verify downstream authorization compares normalized values, since "Admin" !== "ADMIN" in most role checks.'
    );
    return { caseSensitive: false, acceptedVariants, findings };
  }

  findings.push(`Enum "${name}" rejected all non-canonical casings — matching is case-sensitive.`);
  return { caseSensitive: true, acceptedVariants: [], findings };
}

// ---------------------------------------------------------------- 1258 ----

const KNOWN_DATE_FORMATS = [
  { label: 'iso8601', test: (s) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/.test(s) },
  { label: 'iso8601-date', test: (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) },
  { label: 'epoch-seconds', test: (s) => /^-?\d{1,10}$/.test(s) },
  { label: 'epoch-millis', test: (s) => /^-?\d{11,13}$/.test(s) },
  { label: 'us-slash', test: (s) => /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s) },
  { label: 'eu-dot', test: (s) => /^\d{1,2}\.\d{1,2}\.\d{4}$/.test(s) },
  { label: 'natural', test: (s) => /^[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}/.test(s) },
];

/**
 * Map which date formats an endpoint accepts and flag lenient parsing.
 *
 * @param {object} obs
 * @param {string} obs.endpoint — endpoint path under test.
 * @param {Array<{ input: string, status: number, interpretedAs?: string }>} [obs.formats]
 *   — one entry per date-format trial.
 * @returns {{ acceptedFormats: string[], lenient: boolean, ambiguities: Array<{ input: string, interpretedAs?: string }>, findings: string[] }}
 */
export function mapDateFormatQuirks({ endpoint = '', formats = [] } = {}) {
  const findings = [];
  const path = String(endpoint || 'endpoint');
  const list = Array.isArray(formats) ? formats : [];

  if (list.length === 0) {
    findings.push('No date-format trials recorded — parsing posture is unknown.');
    return { acceptedFormats: [], lenient: false, ambiguities: [], findings };
  }

  const classify = (input) => {
    const s = String(input);
    const hit = KNOWN_DATE_FORMATS.find((f) => f.test(s));
    return hit ? hit.label : 'unclassified';
  };

  const accepted = list.filter((f) => f && typeof f.status === 'number' && f.status >= 200 && f.status < 300);
  const acceptedFormats = [...new Set(accepted.map((f) => classify(f.input)))];
  const ambiguities = accepted
    .filter((f) => classify(f.input) !== 'iso8601' && classify(f.input) !== 'iso8601-date')
    .map((f) => ({ input: String(f.input), interpretedAs: f.interpretedAs !== undefined ? String(f.interpretedAs) : undefined }));

  const lenient = ambiguities.length > 0;
  if (lenient) {
    findings.push(
      `${path} accepted ${acceptedFormats.length} date format${acceptedFormats.length === 1 ? '' : 's'} ` +
      `(${acceptedFormats.join(', ')}) — lenient parsing beyond ISO-8601; ` +
      'ambiguous inputs (e.g. 01/02/2026 = Jan 2 vs Feb 1) can cause logic errors in scheduling, expiry, and audit trails.'
    );
  } else if (accepted.length > 0) {
    findings.push(`${path} accepted only strict ISO-8601-style dates — parsing is disciplined.`);
  } else {
    findings.push(`${path} rejected every tried format — check whether the trials used the documented format.`);
  }

  return { acceptedFormats, lenient, ambiguities, findings };
}

// ---------------------------------------------------------------- 1259 ----

/**
 * Submit the same instant expressed in conflicting timezones and flag when the
 * server interprets them differently (expiry shifts, scheduling drift).
 *
 * @param {object} obs
 * @param {string} obs.instantDescription — what instant was intended, e.g. "2026-10-11T06:00:00Z".
 * @param {Array<{ submitted: string, interpretedAs?: string, accepted?: boolean }>} [obs.variants]
 *   — the same instant submitted with different zone suffixes/representations.
 * @returns {{ divergent: boolean, divergences: Array<{ submitted: string, interpretedAs: string }>, findings: string[] }}
 */
export function testTimezoneDifferentials({ instantDescription = '', variants = [] } = {}) {
  const findings = [];
  const list = Array.isArray(variants) ? variants : [];

  if (list.length < 2) {
    findings.push('Fewer than two timezone variants submitted — differential analysis needs at least two representations of the same instant.');
    return { divergent: false, divergences: [], findings };
  }

  const interpreted = list
    .filter((v) => v && v.accepted !== false && v.interpretedAs !== undefined)
    .map((v) => ({ submitted: String(v.submitted), interpretedAs: String(v.interpretedAs) }));

  const distinct = [...new Set(interpreted.map((v) => v.interpretedAs))];
  const divergent = distinct.length > 1;
  const divergences = divergent ? interpreted : [];

  if (divergent) {
    findings.push(
      `The same instant (${String(instantDescription)}) was interpreted ${distinct.length} different ways: ` +
      `${distinct.join(' | ')} — timezone handling shifts effective time; ` +
      'this can move token/session expiry, scheduled jobs, and rate-limit windows.'
    );
  } else if (interpreted.length > 0) {
    findings.push(
      `All ${interpreted.length} timezone representations of the instant resolved to "${distinct[0]}" — timezone handling is consistent.`
    );
  } else {
    findings.push('No interpreted timestamps were recorded — rerun with interpretedAs captured from the response.');
  }

  return { divergent, divergences, findings };
}

// ---------------------------------------------------------------- 1260 ----

const LOCALE_HEADER = 'Accept-Language';

/**
 * Vary Accept-Language and map locale-dependent validation differences.
 *
 * @param {object} obs
 * @param {string} obs.endpoint — endpoint path under test.
 * @param {Array<{ locale: string, status: number, validationErrors?: string[], acceptedFields?: string[] }>} [obs.responses]
 *   — the same request issued under different Accept-Language values.
 * @returns {{ localeDependent: boolean, differences: Array<{ locale: string, detail: string }>, findings: string[] }}
 */
export function mapLocaleBehavior({ endpoint = '', responses = [] } = {}) {
  const findings = [];
  const path = String(endpoint || 'endpoint');
  const list = Array.isArray(responses) ? responses : [];

  if (list.length < 2) {
    findings.push('Fewer than two locale responses recorded — locale-dependence analysis needs at least two Accept-Language variants.');
    return { localeDependent: false, differences: [], findings };
  }

  const signature = (r) => JSON.stringify({
    status: r.status,
    errors: [...(r.validationErrors || [])].sort(),
    fields: [...(r.acceptedFields || [])].sort(),
  });
  const signatures = [...new Set(list.map(signature))];
  const localeDependent = signatures.length > 1;

  const differences = [];
  if (localeDependent) {
    for (const r of list) {
      const errs = (r.validationErrors || []).length;
      const fields = (r.acceptedFields || []).length;
      differences.push({
        locale: String(r.locale),
        detail: `HTTP ${r.status}, ${errs} validation error${errs === 1 ? '' : 's'}, ${fields} accepted field${fields === 1 ? '' : 's'}`,
      });
    }
    findings.push(
      `${path} behaves differently across ${LOCALE_HEADER} values — ` +
      'locale-dependent validation changes field requirements; ' +
      'an attacker can pick the most permissive locale to bypass client-side-equivalent checks.'
    );
  } else {
    findings.push(`${path} responded identically across ${list.length} locale variants — validation is locale-independent.`);
  }

  return { localeDependent, differences, findings };
}
