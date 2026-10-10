/**
 * wave1121-k1.test.js — node:test coverage for the pathConfusionRecon
 * engine (ideas 01121–01130). All tests are offline: fixtures are
 * operator-supplied strings/objects fed into pure builder and analysis
 * functions; no network calls are made.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  IDEA_NUMBERS,
  TECHNIQUE_REGISTRY,
  registryCoverageGaps,
  normalizeProbe,
  splitPath,
  joinPath,
  CHARSET_VARIANTS,
  buildCharsetProbes,
  analyzeCharsetDifferential,
  buildRouteConflictProbes,
  analyzeRouteConflict,
  buildTypeConfusionProbes,
  analyzeTypeConfusion,
  buildMatrixParamProbes,
  analyzeMatrixParamDifferential,
  buildEncodedSlashProbes,
  analyzeEncodedSlashDifferential,
  buildDoubleEncodingProbes,
  analyzeDoubleEncodingDifferential,
  buildEncodedDotProbes,
  analyzeEncodedDotDifferential,
  buildSemicolonParamProbes,
  analyzeSemicolonDifferential,
  buildBasePathConfusionProbes,
  analyzeBasePathDifferential,
  buildCaseVariantProbes,
  analyzeCaseDifferential,
  compareAuthPosture,
  analyzeRoutingShift,
  buildAllPathConfusionProbes,
  analyzeAllDifferentials,
  summarizeFindings,
  renderReconReport,
} from '../src/engines/pathConfusionRecon.js';

const rec = (variantOf, path, status, extra = {}) => ({ variantOf, path, status, ...extra });

test('registry covers all 10 ideas with build + analyze functions', () => {
  assert.deepEqual([...IDEA_NUMBERS].sort(), [
    '01121', '01122', '01123', '01124', '01125',
    '01126', '01127', '01128', '01129', '01130',
  ]);
  assert.deepEqual(registryCoverageGaps(), []);
  for (const idea of IDEA_NUMBERS) {
    const entry = TECHNIQUE_REGISTRY[idea];
    assert.ok(entry.title && typeof entry.title === 'string', `${idea} title`);
    assert.equal(typeof entry.build, 'function', `${idea} build`);
    assert.equal(typeof entry.analyze, 'function', `${idea} analyze`);
  }
});

test('normalizeProbe + splitPath/joinPath round-trip', () => {
  const p = normalizeProbe({ label: 'x', path: '/a/b', idea: '01121', variantOf: '/a' });
  assert.equal(p.method, 'GET');
  assert.equal(p.idea, '01121');
  const parts = splitPath('/api/users/');
  assert.deepEqual(parts.segments, ['api', 'users']);
  assert.equal(parts.trailing, true);
  assert.equal(joinPath(parts.segments, { trailing: parts.trailing }), '/api/users/');
});

test('01121 charset negotiation: builds charset probes and detects reflection shift', () => {
  const probes = buildCharsetProbes(['/api/users']);
  assert.equal(probes.length, CHARSET_VARIANTS.length);
  assert.ok(probes.every((pr) => pr.idea === '01121' && pr.variantOf === '/api/users'));
  assert.ok(probes.some((pr) => pr.path === '/api/users;charset=UTF-8'));
  const records = [
    rec('/api/users', '/api/users', 403, { bodyLength: 120, reflected: false }),
    rec('/api/users', '/api/users;charset=UTF-16', 200, { bodyLength: 980, reflected: true, charset: 'UTF-16' }),
    rec('/api/users', '/api/users;charset=UTF-8', 403, { bodyLength: 120, reflected: false }),
  ];
  const { differentials, findings } = analyzeCharsetDifferential(records);
  assert.equal(differentials.length, 1);
  assert.equal(differentials[0].reflectionShift, true);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].idea, '01121');
});

test('01122 route conflict: builds spellings and flags trailing-slash auth gap', () => {
  const probes = buildRouteConflictProbes(['/admin']);
  const paths = probes.map((p) => p.path);
  assert.ok(paths.includes('/admin/'));
  assert.ok(paths.includes('/ADMIN'));
  assert.ok(paths.some((p) => p.includes('/./admin') || p.includes('/.')));
  const records = [
    rec('/admin', '/admin', 403),
    rec('/admin', '/admin/', 200),
    rec('/admin', '/ADMIN', 404),
  ];
  const { conflicts, findings } = analyzeRouteConflict(records);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].authGap, true);
  assert.equal(findings[0].severity, 'high');
});

test('01123 type confusion: swaps numeric ids and flags server error + auth break', () => {
  const probes = buildTypeConfusionProbes(['/users/123']);
  assert.ok(probes.length >= 10);
  assert.ok(probes.some((p) => p.path === '/users/abc'));
  assert.ok(probes.some((p) => p.path === '/users/{"id":1}'));
  assert.ok(probes.every((p) => p.idea === '01123'));
  assert.deepEqual(buildTypeConfusionProbes(['/users/abc']), []); // no numeric segment
  const records = [
    rec('/users/123', '/users/123', 403),
    rec('/users/123', '/users/abc', 200, { bodyLength: 540 }),
    rec('/users/123', '/users/true', 500, { bodySnippet: 'TypeError: cast to ObjectId failed' }),
  ];
  const { anomalies, findings } = analyzeTypeConfusion(records);
  assert.equal(anomalies.length, 2);
  const authBreak = anomalies.find((a) => a.authBreak);
  assert.ok(authBreak && authBreak.path === '/users/abc');
  assert.equal(findings.find((f) => f.title.includes('authorization breakage')).severity, 'high');
});

test('01124 matrix params: inserts at segment boundaries and flags filter escape', () => {
  const probes = buildMatrixParamProbes(['/a/b'], { params: ['x=1'] });
  assert.equal(probes.length, 2);
  assert.ok(probes.some((p) => p.path === '/a;x=1/b'));
  assert.ok(probes.some((p) => p.path === '/a/b;x=1'));
  const records = [
    rec('/a/b', '/a/b', 401),
    rec('/a/b', '/a;x=1/b', 401),
    rec('/a/b', '/a/b;x=1', 200),
  ];
  const { differentials, findings } = analyzeMatrixParamDifferential(records);
  assert.equal(differentials.length, 1);
  assert.equal(differentials[0].escaped, true);
  assert.equal(differentials[0].idea, '01124');
  assert.equal(findings[0].severity, 'high');
});

test('01125 encoded slash: merges segments with %2F and detects routing shift', () => {
  const probes = buildEncodedSlashProbes(['/files/report']);
  assert.ok(probes.length >= 2);
  assert.ok(probes.some((p) => p.path === '/files%2Freport'));
  assert.equal(probes[0].idea, '01125');
  const records = [
    rec('/files/report', '/files/report', 200, { bodyLength: 4000 }),
    rec('/files/report', '/files%2Freport', 404, { bodyLength: 150 }),
  ];
  const { differentials, findings } = analyzeEncodedSlashDifferential(records);
  assert.equal(differentials.length, 1);
  assert.equal(differentials[0].statusClassShift, true);
  assert.equal(findings[0].title, 'Encoded-slash routing shift');
});

test('01126 double encoding: emits %252F probes and detects layer confusion', () => {
  const probes = buildDoubleEncodingProbes(['/api/users'], { sequences: ['%252F'] });
  assert.equal(probes.length, 1);
  assert.ok(probes[0].path.includes('%252F'));
  const records = [
    rec('/api/users', '/api/users', 200, { bodyLength: 800 }),
    rec('/api/users', '/api/users%252Fx', 200, { bodyLength: 42 }),
  ];
  const { differentials } = analyzeDoubleEncodingDifferential(records);
  assert.equal(differentials.length, 1);
  assert.equal(differentials[0].lengthShift, true);
});

test('01127 encoded dots: builds traversal probes and flags gateway bypass', () => {
  const probes = buildEncodedDotProbes(['/api/users'], { variants: ['%2e'] });
  assert.ok(probes.some((p) => p.path === '/static/%2e%2e/admin'));
  assert.ok(probes.some((p) => p.path === '/api/users%2ejson'));
  const records = [
    rec('/api/users', '/api/users', 404),
    rec('/api/users', '/static/%2e%2e/admin', 200, { bodyLength: 900 }),
    rec('/api/users', '/api/users%2ejson', 200, { bodyLength: 810, contentType: 'application/json' }),
  ];
  const { differentials, findings } = analyzeEncodedDotDifferential(records);
  assert.ok(differentials.length >= 1);
  const bypass = differentials.find((d) => d.path === '/static/%2e%2e/admin');
  assert.ok(bypass && bypass.traversalBypass);
  assert.ok(findings.every((f) => f.severity === 'high'));
});

test('01128 semicolon params: appends and flags strip-before-auth bypass', () => {
  const probes = buildSemicolonParamProbes(['/admin'], { params: ['x=1', ''] });
  assert.ok(probes.some((p) => p.path === '/admin;x=1'));
  assert.ok(probes.some((p) => p.path === '/admin;'));
  const records = [
    rec('/admin', '/admin', 403),
    rec('/admin', '/admin;x=1', 200, { bodyLength: 1200 }),
    rec('/admin', '/admin;', 403),
  ];
  const { differentials, findings } = analyzeSemicolonDifferential(records);
  assert.equal(differentials.length, 1);
  assert.equal(differentials[0].escaped, true);
  assert.equal(findings[0].idea, '01128');
});

test('01129 base-path confusion: compares /api spellings and flags duplicate', () => {
  const probes = buildBasePathConfusionProbes(['/api'], { suffixes: ['users'] });
  const paths = probes.map((p) => p.path);
  assert.ok(paths.includes('/api/users'));
  assert.ok(paths.includes('/api//users'));
  assert.ok(paths.includes('/api/./users'));
  const records = [
    rec('/api/users', '/api/users', 401),
    rec('/api/users', '/api//users', 200),
  ];
  const { differentials, findings } = analyzeBasePathDifferential(records);
  assert.equal(differentials.length, 1);
  assert.equal(differentials[0].escaped, true);
  assert.equal(findings[0].idea, '01129');
});

test('01130 case variants: folds case and flags gateway/backend disagreement', () => {
  const probes = buildCaseVariantProbes(['/api/users']);
  const paths = probes.map((p) => p.path);
  assert.ok(paths.includes('/API/USERS'));
  assert.ok(paths.includes('/Api/Users'));
  assert.ok(probes.every((p) => p.idea === '01130' && p.variantOf === '/api/users'));
  const records = [
    rec('/api/users', '/api/users', 401),
    rec('/api/users', '/API/USERS', 200),
    rec('/api/users', '/Api/Users', 401),
  ];
  const { differentials, findings } = analyzeCaseDifferential(records);
  assert.equal(differentials.length, 1);
  assert.equal(differentials[0].escaped, true);
  assert.equal(findings[0].severity, 'high');
});

test('shared comparators handle empty and benign input without findings', () => {
  assert.deepEqual(compareAuthPosture([], '01124', 'Matrix-parameter').findings, []);
  assert.deepEqual(analyzeRoutingShift([], '01125', 'Encoded-slash').differentials, []);
  const benign = [
    rec('/a', '/a', 401),
    rec('/a', '/a;x=1', 401),
    rec('/a', '/a/', 401),
  ];
  assert.deepEqual(compareAuthPosture(benign, '01124', 'Matrix-parameter').differentials, []);
});

test('buildAllPathConfusionProbes aggregates 10/10 ideas', () => {
  const { byIdea, all, total } = buildAllPathConfusionProbes(['/api/users/123', '/admin']);
  assert.equal(Object.keys(byIdea).length, 10);
  assert.equal(total, all.length);
  assert.ok(total > 100, `expected a healthy probe set, got ${total}`);
  for (const idea of IDEA_NUMBERS) {
    assert.ok(byIdea[idea].length > 0, `${idea} produced probes`);
    assert.ok(byIdea[idea].every((p) => p.idea === idea), `${idea} probes tagged`);
  }
});

test('analyzeAllDifferentials merges findings from all analyzers', () => {
  const records = [
    rec('/admin', '/admin', 403),
    rec('/admin', '/admin;x=1', 200),          // 01128
    rec('/admin', '/ADMIN', 200),              // 01122 / 01130
    rec('/admin', '/admin/', 403),
    rec('/admin', '/static/%2e%2e/admin', 200), // 01127 traversal bypass
    rec('/api/users', '/api/users', 403),
    rec('/api/users', '/api/users;charset=UTF-16', 200, { bodyLength: 900, reflected: true }), // 01121
    rec('/api/users', '/api/users%2ejson', 200, { bodyLength: 810, contentType: 'application/json' }),
  ];
  const { differentials, findings, byIdea } = analyzeAllDifferentials(records);
  assert.ok(findings.length >= 4, `expected several findings, got ${findings.length}`);
  assert.ok(byIdea['01128'].findings.length >= 1);
  const ideas = new Set(findings.map((f) => f.idea));
  assert.ok(ideas.size >= 3);
  assert.ok(differentials.length >= findings.length - 2);
});

test('summarizeFindings ranks severities and picks the top signal', () => {
  const findings = [
    { idea: '01125', severity: 'info', title: 'routing shift', detail: 'd1' },
    { idea: '01128', severity: 'high', title: 'auth bypass', detail: 'd2' },
    { idea: '01122', severity: 'medium', title: 'asymmetry', detail: 'd3' },
  ];
  const s = summarizeFindings(findings);
  assert.equal(s.total, 3);
  assert.equal(s.bySeverity.high, 1);
  assert.equal(s.byIdea['01128'], 1);
  assert.equal(s.top.title, 'auth bypass');
  assert.ok(s.lines.length >= 4);
  const empty = summarizeFindings([]);
  assert.equal(empty.total, 0);
  assert.equal(empty.top, null);
});

test('renderReconReport produces a readable markdown report', () => {
  const report = renderReconReport({
    target: 'https://example.com',
    probeTotal: 250,
    findings: [{ idea: '01128', severity: 'high', title: 'Semicolon auth bypass', detail: 'x' }],
  });
  assert.ok(report.includes('https://example.com'));
  assert.ok(report.includes('Probes generated: 250'));
  assert.ok(report.includes('## Actionable signals'));
  assert.ok(report.includes('01128'));
});
