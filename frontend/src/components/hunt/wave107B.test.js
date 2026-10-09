// Wave 107B tests — change feed + risk scoring foundation (ideas 54251-54260).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  WAVE107_B_IDEAS,
  CHANGE_TYPES,
  filterChangesByType,
  correlateCrossTarget,
  linkFindingsToChange,
  batchQuietHours,
  computeCompositeScore,
  surfaceSizeFactor,
  technologyRiskFactor,
  exposureFactor,
  dataSensitivityFactor,
  bountyValueFactor,
} from './wave107BCores.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const HOUR = 60 * 60 * 1000;
const T0 = Date.UTC(2026, 9, 10, 2, 30, 0);

const CHANGES = [
  { id: 'c1', target: 'api.obfinity.example', type: 'dns', at: T0, summary: 'New A record' },
  { id: 'c2', target: 'api.obfinity.example', type: 'cert', at: T0 + 5 * 60 * 1000, summary: 'Cert renewed' },
  { id: 'c3', target: 'shop.obfinity.example', type: 'cert', at: T0 + 6 * 60 * 1000, summary: 'Cert renewed' },
  { id: 'c4', target: 'cdn.obfinity.example', type: 'cert', at: T0 + 8 * 60 * 1000, summary: 'Cert renewed' },
  { id: 'c5', target: 'shop.obfinity.example', type: 'content', at: T0 + 3 * HOUR, summary: 'Copy changed' },
];

// --- Idea registry -----------------------------------------------------------

test('WAVE107_B_IDEAS has exactly 10 entries, ids 54251-54260, exact bank titles', () => {
  const expected = [
    [54251, 'Change filters by type'],
    [54252, 'Cross-target change correlation'],
    [54253, 'Change-to-finding linkage'],
    [54254, 'Quiet-hours change batching'],
    [54255, 'Composite risk score 0–100'],
    [54256, 'Attack surface size factor'],
    [54257, 'Technology risk factor'],
    [54258, 'Exposure factor'],
    [54259, 'Data sensitivity factor'],
    [54260, 'Bounty value factor'],
  ];
  assert.equal(WAVE107_B_IDEAS.length, 10);
  assert.deepEqual(
    WAVE107_B_IDEAS.map((e) => [e.id, e.title]),
    expected,
  );
  assert.deepEqual(WAVE107_B_IDEAS.map((e) => e.id), [...Array(10)].map((_, i) => 54251 + i));
});

// --- 54251: change filters by type -------------------------------------------

test('54251 filterChangesByType narrows the feed by category', () => {
  assert.deepEqual(filterChangesByType(CHANGES, 'cert').map((c) => c.id), ['c2', 'c3', 'c4']);
  assert.deepEqual(filterChangesByType(CHANGES, ['dns', 'content']).map((c) => c.id), ['c1', 'c5']);
  assert.deepEqual(filterChangesByType(CHANGES, 'bogus'), []);
  assert.deepEqual(filterChangesByType(null, 'dns'), []);
  assert.deepEqual(CHANGE_TYPES, ['dns', 'cert', 'content', 'tech', 'network']);
});

// --- 54252: cross-target change correlation ----------------------------------

test('54252 correlateCrossTarget groups simultaneous same-type changes across targets', () => {
  const groups = correlateCrossTarget(CHANGES, 15 * 60 * 1000);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].type, 'cert');
  assert.deepEqual(groups[0].targets, ['api.obfinity.example', 'cdn.obfinity.example', 'shop.obfinity.example']);
});

test('54252 changes far apart in time do not correlate', () => {
  const far = [
    { id: 'a', target: 't1', type: 'cert', at: T0 },
    { id: 'b', target: 't2', type: 'cert', at: T0 + 2 * HOUR },
  ];
  assert.deepEqual(correlateCrossTarget(far, 15 * 60 * 1000), []);
});

// --- 54253: change-to-finding linkage ----------------------------------------

test('54253 linkFindingsToChange links findings to recent same-target changes', () => {
  const findings = [
    { id: 'f1', target: 'shop.obfinity.example', foundAt: T0 + 4 * HOUR, title: 'XSS' },
    { id: 'f2', target: 'api.obfinity.example', foundAt: T0 - HOUR, title: 'Too early' },
  ];
  const linked = linkFindingsToChange(findings, CHANGES);
  assert.deepEqual(linked[0].linkedChangeIds, ['c5', 'c3']); // newest first, within 24h window
  assert.deepEqual(linked[1].linkedChangeIds, []); // found before any change
});

// --- 54254: quiet-hours change batching ---------------------------------------

test('54254 batchQuietHours holds low-severity alerts overnight, passes high through', () => {
  const alerts = [
    { id: 'a1', severity: 'low', at: T0, type: 'cert', summary: 'cert renewed' }, // 02:30 UTC
    { id: 'a2', severity: 'high', at: T0, type: 'network', summary: 'port opened' }, // 02:30 UTC
    { id: 'a3', severity: 'low', at: Date.UTC(2026, 9, 10, 12, 0, 0), type: 'content', summary: 'copy' },
  ];
  const { immediate, held, morningSummary } = batchQuietHours(alerts, {
    quietStartHour: 22,
    quietEndHour: 7,
    now: T0 + 6 * HOUR,
  });
  assert.deepEqual(immediate.map((a) => a.id), ['a2', 'a3']);
  assert.deepEqual(held.map((a) => a.id), ['a1']);
  assert.equal(morningSummary.count, 1);
  assert.deepEqual(morningSummary.byType, { cert: 1 });
  assert.deepEqual(morningSummary.heldIds, ['a1']);
});

test('54254 empty held set yields no morning summary', () => {
  const { morningSummary } = batchQuietHours(
    [{ id: 'x', severity: 'high', at: T0, summary: 's' }],
    { now: T0 },
  );
  assert.equal(morningSummary, null);
});

// --- 54255: composite risk score ----------------------------------------------

test('54255 computeCompositeScore returns 0-100 with band and factor breakdown', () => {
  const r = computeCompositeScore({
    factors: { surface: 50, technology: 40, exposure: 60, sensitivity: 80, bounty: 20 },
  });
  assert.equal(r.score, 52); // 12.5 + 8 + 12 + 16 + 3 = 51.5 -> 52
  assert.equal(r.band, 'medium');
  assert.deepEqual(r.factors, { surface: 50, technology: 40, exposure: 60, sensitivity: 80, bounty: 20 });
});

test('54255 bounds: empty target scores 0, worst-case scores 100', () => {
  const empty = computeCompositeScore({});
  assert.equal(empty.score, 0);
  assert.equal(empty.band, 'low');
  const worst = computeCompositeScore({
    factors: { surface: 100, technology: 100, exposure: 100, sensitivity: 100, bounty: 100 },
  });
  assert.equal(worst.score, 100);
  assert.equal(worst.band, 'critical');
  const clamped = computeCompositeScore({ factors: { surface: 999, technology: -5 } });
  assert.ok(clamped.score >= 0 && clamped.score <= 100);
});

test('54255 computes factors from raw target data and stays in 0-100', () => {
  const r = computeCompositeScore({
    surfaceSize: { subdomains: 200, endpoints: 1500, ports: 12 },
    technologyStack: [{ name: 'WordPress', version: '4.9', eol: true }],
    exposure: { environment: 'production', internetFacing: true },
    dataSensitivity: { dataTypes: ['payments'] },
    bountyValue: { rewardMax: 20000 },
  });
  assert.ok(Number.isInteger(r.score) && r.score >= 0 && r.score <= 100);
  assert.ok(['critical', 'high'].includes(r.band));
  for (const v of Object.values(r.factors)) assert.ok(v >= 0 && v <= 100);
});

// --- 54256: attack surface size factor -----------------------------------------

test('54256 surfaceSizeFactor rewards sprawl, zero surface scores 0', () => {
  assert.equal(surfaceSizeFactor({ subdomains: 0, endpoints: 0, ports: 0 }), 0);
  const small = surfaceSizeFactor({ subdomains: 10, endpoints: 10, ports: 10 });
  const big = surfaceSizeFactor({ subdomains: 500, endpoints: 5000, ports: 30 });
  assert.ok(big > small, `big (${big}) should exceed small (${small})`);
  assert.equal(surfaceSizeFactor({ subdomains: 1e6, endpoints: 1e6, ports: 1e6 }), 100);
  assert.ok(small >= 0 && small <= 100);
});

// --- 54257: technology risk factor ----------------------------------------------

test('54257 technologyRiskFactor raises scores for EOL frameworks', () => {
  assert.equal(technologyRiskFactor([]), 0);
  assert.equal(technologyRiskFactor([{ name: 'WordPress', version: '4.9', eol: true }]), 90);
  assert.equal(technologyRiskFactor([{ name: 'Node', version: '20.11.0' }]), 10);
  const php = technologyRiskFactor([{ name: 'PHP', version: '7.2', eol: '2020-11-30' }], Date.UTC(2026, 0, 1));
  assert.equal(php, 90);
  const risky = technologyRiskFactor([{ name: 'AdminPanel', version: '1.0', riskyDefault: true }]);
  assert.ok(risky >= 60);
});

// --- 54258: exposure factor ------------------------------------------------------

test('54258 exposureFactor scores internet-facing production highest', () => {
  assert.equal(exposureFactor({ environment: 'production', internetFacing: true }), 100);
  const internal = exposureFactor({ environment: 'internal', internetFacing: true });
  const prodFacing = exposureFactor({ environment: 'production', internetFacing: true });
  assert.ok(internal < prodFacing);
  const stagingHidden = exposureFactor({ environment: 'staging', internetFacing: false });
  assert.ok(stagingHidden < exposureFactor({ environment: 'staging', internetFacing: true }));
});

// --- 54259: data sensitivity factor ------------------------------------------------

test('54259 dataSensitivityFactor boosts payments/health/identity/financial data', () => {
  assert.equal(dataSensitivityFactor({ dataTypes: [] }), 0);
  assert.equal(dataSensitivityFactor({ dataTypes: ['payments'] }), 100);
  assert.equal(dataSensitivityFactor({ dataTypes: ['health'] }), 100);
  assert.equal(dataSensitivityFactor({ dataTypes: ['identity'] }), 85);
  assert.equal(dataSensitivityFactor({ dataTypes: ['payments', 'analytics'] }), 100); // max wins
  assert.ok(dataSensitivityFactor({ dataTypes: ['analytics'] }) < dataSensitivityFactor({ dataTypes: ['pii'] }));
});

// --- 54260: bounty value factor ------------------------------------------------------

test('54260 bountyValueFactor ranks high-payout targets higher', () => {
  assert.equal(bountyValueFactor({ rewardMin: 0, rewardMax: 0 }), 0);
  assert.equal(bountyValueFactor({}), 0);
  const low = bountyValueFactor({ rewardMax: 500 });
  const high = bountyValueFactor({ rewardMax: 50000 });
  assert.ok(high > low, `high (${high}) should exceed low (${low})`);
  assert.equal(bountyValueFactor({ rewardMax: 100000 }), 100);
  assert.ok(low >= 0 && low <= 100);
});

// --- Branding -----------------------------------------------------------------------

test('no branding leak: none of the wave files mention the forbidden name', () => {
  const forbidden = 'Mu' + 'se'; // constructed so the test itself stays clean
  for (const f of ['wave107BCores.js', 'Wave107B.jsx', 'wave107B.test.js']) {
    const content = readFileSync(join(HERE, f), 'utf8');
    assert.ok(!content.includes(forbidden), `${f} leaks forbidden branding`);
  }
});
