/**
 * apiFieldBehaviorRecon.test.js — real assertions for ideas 1251-1260.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WAVE1251_COVERAGE,
  ideaFunctions,
  mapNullableVsRequired,
  detectDefaultPrivilegeEscalation,
  testReadOnlyWrite,
  testWriteOnlyRead,
  testExtraFieldAcceptance,
  fuzzEnumValues,
  testEnumCaseSensitivity,
  mapDateFormatQuirks,
  testTimezoneDifferentials,
  mapLocaleBehavior,
} from './apiFieldBehaviorRecon.js';

// ------------------------------------------------------------ registry ----

test('registry covers ideas 1251-1260', () => {
  assert.deepEqual(WAVE1251_COVERAGE, [1251, 1252, 1253, 1254, 1255, 1256, 1257, 1258, 1259, 1260]);
  const map = ideaFunctions();
  assert.equal(Object.keys(map).length, 10);
  assert.equal(map[1251], 'mapNullableVsRequired');
  assert.equal(map[1260], 'mapLocaleBehavior');
});

// ---------------------------------------------------------------- 1251 ----

test('1251: null accepted on required non-nullable field is INCONSISTENT', () => {
  const r = mapNullableVsRequired({
    field: 'role',
    documentedRequired: true,
    documentedNullable: false,
    nullStatus: 200,
    omittedStatus: 400,
    valueStatus: 200,
  });
  assert.equal(r.verdict, 'INCONSISTENT');
  assert.ok(r.inconsistencies.some((i) => i.includes('role')));
  assert.ok(r.score < 100);
});

test('1251: enforced nullability is CONSISTENT with score 100', () => {
  const r = mapNullableVsRequired({
    field: 'email',
    documentedRequired: true,
    documentedNullable: false,
    nullStatus: 422,
    omittedStatus: 422,
    valueStatus: 200,
  });
  assert.equal(r.verdict, 'CONSISTENT');
  assert.equal(r.inconsistencies.length, 0);
  assert.equal(r.score, 100);
});

test('1251: no observations returns UNKNOWN', () => {
  const r = mapNullableVsRequired({ field: 'x' });
  assert.equal(r.verdict, 'UNKNOWN');
  assert.equal(r.score, 0);
});

// ---------------------------------------------------------------- 1252 ----

test('1252: omitted field defaulting to admin is an escalation', () => {
  const r = detectDefaultPrivilegeEscalation({
    field: 'role',
    explicitValue: 'viewer',
    omittedEffectiveValue: 'admin',
    privilegeOrder: [['viewer', 'editor'], ['editor', 'admin']],
  });
  assert.equal(r.escalation, true);
  assert.ok(r.finding && r.finding.includes('admin'));
});

test('1252: omission resolving to the same value is not an escalation', () => {
  const r = detectDefaultPrivilegeEscalation({
    field: 'timezone',
    explicitValue: 'UTC',
    omittedEffectiveValue: 'UTC',
  });
  assert.equal(r.escalation, false);
  assert.equal(r.finding, null);
});

test('1252: missing observations are reported, not escalated', () => {
  const r = detectDefaultPrivilegeEscalation({ field: 'role' });
  assert.equal(r.escalation, false);
  assert.ok(r.findings.some((f) => f.includes('unknown')));
});

// ---------------------------------------------------------------- 1253 ----

test('1253: persisted write to a read-only field is MASS_ASSIGNMENT', () => {
  const r = testReadOnlyWrite({
    attempts: [
      { field: 'isAdmin', writeStatus: 200, valuePersisted: true },
      { field: 'createdAt', writeStatus: 400 },
    ],
  });
  assert.equal(r.verdict, 'MASS_ASSIGNMENT');
  assert.deepEqual(r.writableFields, ['isAdmin']);
  assert.ok(r.findings.some((f) => f.includes('isAdmin')));
});

test('1253: rejected writes are ENFORCED', () => {
  const r = testReadOnlyWrite({
    attempts: [{ field: 'id', writeStatus: 400 }],
  });
  assert.equal(r.verdict, 'ENFORCED');
  assert.equal(r.writableFields.length, 0);
});

test('1253: no attempts returns UNKNOWN', () => {
  assert.equal(testReadOnlyWrite({}).verdict, 'UNKNOWN');
});

// ---------------------------------------------------------------- 1254 ----

test('1254: plaintext echo of a write-only field is a LEAK', () => {
  const r = testWriteOnlyRead({
    reads: [{ field: 'password', submitted: true, echoedInResponse: true }],
  });
  assert.equal(r.verdict, 'LEAK');
  assert.deepEqual(r.leakedFields, [{ field: 'password', mode: 'plaintext' }]);
  assert.ok(r.findings.some((f) => f.includes('PLAINTEXT')));
});

test('1254: hashed echo is a LEAK with hash mode', () => {
  const r = testWriteOnlyRead({
    reads: [{ field: 'password', submitted: true, echoedInResponse: true, echoedHash: true }],
  });
  assert.equal(r.verdict, 'LEAK');
  assert.equal(r.leakedFields[0].mode, 'hash');
});

test('1254: suppressed fields are CLEAN', () => {
  const r = testWriteOnlyRead({
    reads: [{ field: 'password', submitted: true, echoedInResponse: false }],
  });
  assert.equal(r.verdict, 'CLEAN');
  assert.equal(r.leakedFields.length, 0);
});

// ---------------------------------------------------------------- 1255 ----

test('1255: echoed unknown fields confirm ACCEPTS tolerance', () => {
  const r = testExtraFieldAcceptance({
    submissions: [
      { field: 'isAdmin', status: 200, echoed: true, persisted: true },
      { field: 'zzz', status: 200 },
    ],
  });
  assert.equal(r.tolerance, 'ACCEPTS');
  assert.equal(r.acceptedCount, 2);
});

test('1255: 400/422 on unknown fields is REJECTS', () => {
  const r = testExtraFieldAcceptance({
    submissions: [{ field: 'isAdmin', status: 422 }],
  });
  assert.equal(r.tolerance, 'REJECTS');
  assert.equal(r.rejectedCount, 1);
});

test('1255: accepted-but-stripped is STRIPS', () => {
  const r = testExtraFieldAcceptance({
    submissions: [{ field: 'zzz', status: 200, echoed: false, persisted: false }],
  });
  assert.equal(r.tolerance, 'STRIPS');
});

// ---------------------------------------------------------------- 1256 ----

test('1256: accepted undocumented member flags HIDDEN_MEMBERS', () => {
  const r = fuzzEnumValues({
    field: 'role',
    documentedMembers: ['viewer', 'editor'],
    submissions: [
      { member: 'admin', status: 200, effect: 'role set to admin' },
      { member: 'superuser', status: 400 },
    ],
  });
  assert.equal(r.verdict, 'HIDDEN_MEMBERS');
  assert.equal(r.hiddenMembers.length, 1);
  assert.equal(r.hiddenMembers[0].member, 'admin');
});

test('1256: all undocumented members rejected is STRICT', () => {
  const r = fuzzEnumValues({
    field: 'plan',
    documentedMembers: ['free', 'pro'],
    submissions: [{ member: 'enterprise', status: 400 }],
  });
  assert.equal(r.verdict, 'STRICT');
  assert.equal(r.hiddenMembers.length, 0);
});

test('1256: no submissions returns UNKNOWN', () => {
  assert.equal(fuzzEnumValues({ field: 'role' }).verdict, 'UNKNOWN');
});

// ---------------------------------------------------------------- 1257 ----

test('1257: accepted lowercase variant means case-insensitive', () => {
  const r = testEnumCaseSensitivity({
    field: 'role',
    documentedMember: 'ADMIN',
    variants: [{ variant: 'admin', status: 200, normalizedTo: 'ADMIN' }, { variant: 'AdMiN', status: 400 }],
  });
  assert.equal(r.caseSensitive, false);
  assert.equal(r.acceptedVariants.length, 1);
  assert.equal(r.acceptedVariants[0].variant, 'admin');
});

test('1257: rejected variants mean case-sensitive', () => {
  const r = testEnumCaseSensitivity({
    field: 'role',
    documentedMember: 'ADMIN',
    variants: [{ variant: 'admin', status: 422 }],
  });
  assert.equal(r.caseSensitive, true);
  assert.equal(r.acceptedVariants.length, 0);
});

test('1257: no variants returns null caseSensitive', () => {
  assert.equal(testEnumCaseSensitivity({ field: 'role' }).caseSensitive, null);
});

// ---------------------------------------------------------------- 1258 ----

test('1258: accepting US-slash dates is lenient', () => {
  const r = mapDateFormatQuirks({
    endpoint: '/api/v1/schedule',
    formats: [
      { input: '2026-10-11T06:00:00Z', status: 200 },
      { input: '10/11/2026', status: 200, interpretedAs: '2026-10-11' },
    ],
  });
  assert.equal(r.lenient, true);
  assert.ok(r.acceptedFormats.includes('us-slash'));
  assert.equal(r.ambiguities.length, 1);
});

test('1258: ISO-only acceptance is not lenient', () => {
  const r = mapDateFormatQuirks({
    endpoint: '/api/v1/schedule',
    formats: [
      { input: '2026-10-11T06:00:00Z', status: 200 },
      { input: '10/11/2026', status: 400 },
    ],
  });
  assert.equal(r.lenient, false);
  assert.ok(r.acceptedFormats.includes('iso8601'));
});

test('1258: no trials reports unknown posture', () => {
  const r = mapDateFormatQuirks({ endpoint: '/x' });
  assert.equal(r.acceptedFormats.length, 0);
  assert.ok(r.findings.some((f) => f.includes('unknown')));
});

// ---------------------------------------------------------------- 1259 ----

test('1259: differing interpretations of the same instant are divergent', () => {
  const r = testTimezoneDifferentials({
    instantDescription: '2026-10-11T06:00:00Z',
    variants: [
      { submitted: '2026-10-11T06:00:00Z', interpretedAs: '2026-10-11T06:00:00Z', accepted: true },
      { submitted: '2026-10-11T11:30:00+05:30', interpretedAs: '2026-10-11T11:30:00Z', accepted: true },
    ],
  });
  assert.equal(r.divergent, true);
  assert.equal(r.divergences.length, 2);
  assert.ok(r.findings.some((f) => f.includes('2 different ways')));
});

test('1259: identical resolution is not divergent', () => {
  const r = testTimezoneDifferentials({
    instantDescription: '2026-10-11T06:00:00Z',
    variants: [
      { submitted: '2026-10-11T06:00:00Z', interpretedAs: '2026-10-11T06:00:00Z', accepted: true },
      { submitted: '2026-10-11T11:30:00+05:30', interpretedAs: '2026-10-11T06:00:00Z', accepted: true },
    ],
  });
  assert.equal(r.divergent, false);
});

test('1259: single variant is reported as insufficient', () => {
  const r = testTimezoneDifferentials({ variants: [{ submitted: 'x', interpretedAs: 'y' }] });
  assert.equal(r.divergent, false);
  assert.ok(r.findings.some((f) => f.includes('at least two')));
});

// ---------------------------------------------------------------- 1260 ----

test('1260: differing validation per locale is locale-dependent', () => {
  const r = mapLocaleBehavior({
    endpoint: '/api/v1/register',
    responses: [
      { locale: 'en-US', status: 200, validationErrors: [], acceptedFields: ['name', 'phone'] },
      { locale: 'de-DE', status: 422, validationErrors: ['phone format invalid'], acceptedFields: ['name'] },
    ],
  });
  assert.equal(r.localeDependent, true);
  assert.equal(r.differences.length, 2);
  assert.ok(r.findings.some((f) => f.includes('Accept-Language')));
});

test('1260: identical responses are locale-independent', () => {
  const r = mapLocaleBehavior({
    endpoint: '/api/v1/register',
    responses: [
      { locale: 'en-US', status: 200, validationErrors: [] },
      { locale: 'fr-FR', status: 200, validationErrors: [] },
    ],
  });
  assert.equal(r.localeDependent, false);
});

test('1260: single locale response is reported as insufficient', () => {
  const r = mapLocaleBehavior({ responses: [{ locale: 'en-US', status: 200 }] });
  assert.equal(r.localeDependent, false);
  assert.ok(r.findings.some((f) => f.includes('at least two')));
});
