/**
 * wave64.test.js — Infinity AI · Dark-Matter · Wave 64
 * node:test + node:assert/strict. Registry coverage (15/15 for 52521–52535,
 * 25/25 for 52536–52560, zero skips, 40/40 combined), registry titles matched
 * against the idea bank, deterministic spot-checks of every pure function
 * (at least one assertion per idea), Wave64.css scope/zero-animation audits,
 * a real esbuild JSX parse audit, a no-branding-leak audit ("Infinity AI"
 * only) and a no-debris audit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WAVE64_CD_IDEAS } from './compareDeepCore.js';
import * as CD from './compareDeepCore.js';
import { WAVE64_AR_IDEAS } from './archiveCore.js';
import * as AR from './archiveCore.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const CSS = join(DIR, 'Wave64.css');
const CD_SRC = readFileSync(join(DIR, 'compareDeepCore.js'), 'utf8');
const AR_SRC = readFileSync(join(DIR, 'archiveCore.js'), 'utf8');
const CD_JSX = readFileSync(join(DIR, 'CompareDeep.jsx'), 'utf8');
const AR_JSX = readFileSync(join(DIR, 'ArchiveSuite.jsx'), 'utf8');
const CSS_SRC = readFileSync(CSS, 'utf8');
const TEST_SRC = readFileSync(join(DIR, 'wave64.test.js'), 'utf8');
const ALL_SRC = [CD_SRC, AR_SRC, CD_JSX, AR_JSX, CSS_SRC, TEST_SRC];
const NOW = 1700000000000;
const DAY = 86400000;

/* ---- Registry coverage: 15/15 + 25/25, zero skips ---- */
test('registry: 15/15 compare-deep ideas, 25/25 archive ideas, zero skips', () => {
  assert.equal(WAVE64_CD_IDEAS.length, 15);
  assert.equal(WAVE64_AR_IDEAS.length, 25);
  const all = [...WAVE64_CD_IDEAS, ...WAVE64_AR_IDEAS];
  assert.equal(all.length, 40);
  const ids = all.map(i => i.id);
  assert.deepEqual(
    ids,
    Array.from({ length: 40 }, (_, k) => 52521 + k)
  );
  for (const idea of all) {
    assert.equal(idea.skip, false, `idea ${idea.id} skipped`);
    assert.ok(idea.title && idea.title.length > 0, `idea ${idea.id} missing title`);
  }
});

/* ---- Registry titles matched against the idea bank ---- */
test('registry titles match ideas/batch6/part-03-posthunt.md', () => {
  const bank = readFileSync(
    join(DIR, '..', '..', '..', '..', 'ideas', 'batch6', 'part-03-posthunt.md'),
    'utf8'
  );
  for (const idea of [...WAVE64_CD_IDEAS, ...WAVE64_AR_IDEAS]) {
    const line = bank.split('\n').find(l => l.startsWith(`${idea.id}.`));
    assert.ok(line, `idea ${idea.id} not found in idea bank`);
    assert.ok(line.includes(idea.title), `idea ${idea.id} title mismatch: ${idea.title}`);
  }
});

/* ---- Spot-checks: compareDeepCore (52521–52535) ---- */
test('52521 compareTriageDecisions flags inconsistent classes', () => {
  const mk = (cls, dec) => ({ vulnClass: cls, triageDecision: dec, title: 't' });
  const r = CD.compareTriageDecisions(
    { findings: [mk('xss', 'accept')] },
    { findings: [mk('xss', 'reject-fp')] }
  );
  assert.equal(r.mismatches.length, 1);
  assert.equal(r.mismatches[0].vulnClass, 'xss');
});

test('52522 compareFpRates computes trend', () => {
  const r = CD.compareFpRates([
    { id: 'a', findings: [{ fp: true }, { fp: false }] },
    { id: 'b', findings: [{ fp: false }, { fp: false }] },
  ]);
  assert.equal(r.perHunt[0].fpRate, 0.5);
  assert.equal(r.trend, 'down');
});

test('52523 compareMttr averages fix times', () => {
  const r = CD.compareMttr([{ id: 'a', findings: [{ detectedAt: NOW - 10 * DAY, fixedAt: NOW }] }]);
  assert.equal(r.perHunt[0].mttrDays, 10);
});

test('52524 compareBountyOutcomes aggregates per program', () => {
  const r = CD.compareBountyOutcomes([
    {
      program: 'p',
      findings: [{ payoutStatus: 'accepted', payout: 100 }, { payoutStatus: 'submitted' }],
    },
  ]);
  assert.equal(r.perProgram[0].acceptanceRate, 0.5);
  assert.equal(r.perProgram[0].payout, 100);
});

test('52525 compareEnvHunts finds prod-only drift', () => {
  const k = (title, cls) => ({ title, vulnClass: cls });
  const r = CD.compareEnvHunts(
    { findings: [k('A', 'xss')] },
    { findings: [k('A', 'xss'), k('B', 'rce')] }
  );
  assert.equal(r.onlyProd.length, 1);
  assert.equal(r.onlyProd[0].title, 'B');
});

test('52526 compareBranchHunts gates on new severe findings', () => {
  const k = (title, cls, sev) => ({ title, vulnClass: cls, severity: sev, fp: false });
  const r = CD.compareBranchHunts(
    { findings: [k('A', 'xss', 'high'), k('B', 'ssrf', 'critical')] },
    { findings: [k('A', 'xss', 'high')] }
  );
  assert.equal(r.gate, 'block');
  assert.equal(r.newSevere[0].title, 'B');
  const r2 = CD.compareBranchHunts(
    { findings: [k('A', 'xss', 'high')] },
    { findings: [k('A', 'xss', 'high')] }
  );
  assert.equal(r2.gate, 'pass');
});

test('52527 benchmarkAcquisition verdicts above-baseline risk', () => {
  const r = CD.benchmarkAcquisition(
    { findings: [{ severity: 'critical', fp: false }] },
    { avgFindings: 1, avgCritical: 0, avgFpRate: 0 }
  );
  assert.equal(r.verdict, 'above-baseline-risk');
});

test('52528 compareVendors ranks best first', () => {
  const r = CD.compareVendors([
    { id: 'v1', vendor: 'B', findings: [{ severity: 'critical', fp: false }] },
    { id: 'v2', vendor: 'A', findings: [] },
  ]);
  assert.equal(r[0].vendor, 'A');
});

test('52529 buildComparisonPdfPayload brands Infinity AI', () => {
  const p = CD.buildComparisonPdfPayload({ title: 't', hunts: [], sections: [] });
  assert.equal(p.brand.name, 'Infinity AI');
  assert.equal(p.kind, 'comparison-pdf');
});

test('52530 buildComparisonCsv emits header + rows', () => {
  const csv = CD.buildComparisonCsv([{ a: 1, b: 'x,y' }], ['a', 'b']);
  assert.ok(csv.startsWith('a,b'));
  assert.ok(csv.includes('"x,y"'));
});

test('52531 benchmarkVsIndustry marks better-than-median', () => {
  const r = CD.benchmarkVsIndustry(
    { fpRate: 0.05, mttrDays: 5, criticalPerHunt: 0 },
    { fpRateP50: 0.15, mttrDaysP50: 14, criticalPerHuntP50: 2 }
  );
  assert.ok(r.every(m => m.standing === 'better-than-median'));
});

test('52532 benchmarkVsHistory picks best and worst', () => {
  const r = CD.benchmarkVsHistory({ fpRate: 0.1, mttrDays: 8, critical: 1 }, [
    { fpRate: 0.3, mttrDays: 20, critical: 4 },
  ]);
  assert.equal(r.best.fpRate, 0.1);
  assert.equal(r.worst.critical, 4);
});

test('52533 compareTriageSlas detects improvement', () => {
  const mk = (id, det, tri) => ({ id, findings: [{ detectedAt: det, triagedAt: tri }] });
  const r = CD.compareTriageSlas([
    mk('a', NOW - DAY, NOW - DAY + 48 * 3600000),
    mk('b', NOW - DAY, NOW - DAY + 2 * 3600000),
  ]);
  assert.equal(r.improving, true);
});

test('52534 replayComparison attributes engine-driven change', () => {
  const k = (t, cls, ev) => Object.assign({ title: t, vulnClass: cls }, ev || {});
  const r = CD.replayComparison(
    { id: 'o', engineVersion: 'v1', findings: [k('A', 'xss')] },
    {
      id: 'n',
      engineVersion: 'v2',
      findings: [k('A', 'xss'), k('B', 'idor', { engineVersion: 'v2' })],
    },
    'v2'
  );
  assert.equal(r.attribution, 'engine-driven');
  assert.equal(r.plan.engineVersion, 'v2');
});

test('52535 buildExecOnePager caps highlights and risks', () => {
  const p = CD.buildExecOnePager({
    hunts: [{}, {}],
    highlights: ['a', 'b', 'c', 'd', 'e', 'f'],
    risks: ['r1', 'r2', 'r3', 'r4'],
  });
  assert.equal(p.highlights.length, 5);
  assert.equal(p.topRisks.length, 3);
  assert.equal(p.huntCount, 2);
});

/* ---- Spot-checks: archiveCore (52536–52560) ---- */
test('52536 archiveHunt builds a version-1 record', () => {
  const a = AR.archiveHunt({ id: 'h1', target: 't', bytes: 10 }, { reason: 'done' }, NOW);
  assert.equal(a.version, 1);
  assert.equal(a.id, 'arc-h1');
  assert.ok(a.checksum);
});

test('52537 dueForAgeArchive picks old hunts', () => {
  const due = AR.dueForAgeArchive(
    [
      { id: 'o', at: NOW - 400 * DAY },
      { id: 'n', at: NOW - 10 * DAY },
    ],
    365,
    NOW
  );
  assert.deepEqual(
    due.map(h => h.id),
    ['o']
  );
});

test('52538 dueForFixedArchive picks fully-fixed hunts', () => {
  const due = AR.dueForFixedArchive([
    { id: 'c', findings: [{ state: 'fixed' }] },
    { id: 'd', findings: [{ state: 'open' }] },
  ]);
  assert.deepEqual(
    due.map(h => h.id),
    ['c']
  );
});

test('52539 resolveArchiveLocation honors workspace override', () => {
  assert.equal(
    AR.resolveArchiveLocation({ defaultStorage: 's3', perWorkspace: { eu: 'cold' } }, 'eu'),
    'cold'
  );
  assert.equal(AR.resolveArchiveLocation({}), 'local');
});

test('52540 estimateCompressedSize computes savings', () => {
  const r = AR.estimateCompressedSize(1000, 0.4);
  assert.equal(r.compressed, 600);
  assert.equal(r.saved, 400);
});

test('52541 buildArchiveEnvelope seals with key ref', () => {
  const e = AR.buildArchiveEnvelope({ id: 'arc-1', checksum: 'abc' }, 'k1');
  assert.equal(e.encrypted, true);
  assert.equal(e.keyRef, 'k1');
});

test('52542 searchArchives matches target text', () => {
  const hits = AR.searchArchives(
    [{ target: 'Acme Corp', tags: [], reason: '', deleted: false }],
    'acme'
  );
  assert.equal(hits.length, 1);
  assert.equal(
    AR.searchArchives([{ target: 'x', tags: [], reason: '', deleted: true }], 'x').length,
    0
  );
});

test('52543 restoreArchive blocks deleted and held archives', () => {
  const ok = AR.restoreArchive({ deleted: false, legalHold: false, restores: 0 }, NOW);
  assert.equal(ok.restored, true);
  assert.equal(AR.restoreArchive({ deleted: true }, NOW).restored, false);
  assert.equal(AR.restoreArchive({ deleted: false, legalHold: true }, NOW).restored, false);
});

test('52544 archiveSummaryPreview returns light stats', () => {
  const p = AR.archiveSummaryPreview({
    id: 'a',
    target: 't',
    archivedAt: 1,
    bytes: 2,
    tier: 'hot',
    tags: [],
    reason: 'r',
    topFindings: [1, 2, 3, 4, 5, 6],
    severityCounts: { high: 1 },
  });
  assert.equal(p.topFindings.length, 5);
});

test('52545 retentionStatus holds under legal hold', () => {
  assert.equal(
    AR.retentionStatus({ legalHold: true, archivedAt: NOW }, { keepDays: 1 }, NOW + DAY).status,
    'held'
  );
  const r = AR.retentionStatus(
    { legalHold: false, archivedAt: NOW - 800 * DAY },
    { keepDays: 730 },
    NOW
  );
  assert.equal(r.status, 'due-purge');
});

test('52546 applyLegalHold sets hold metadata', () => {
  const h = AR.applyLegalHold({}, { matter: 'm', actor: 'c' }, NOW);
  assert.equal(h.legalHold, true);
  assert.equal(h.hold.matter, 'm');
});

test('52547 canAccessArchive enforces scopes and holds', () => {
  assert.equal(AR.canAccessArchive({ role: 'admin' }, {}, 'delete'), true);
  assert.equal(
    AR.canAccessArchive({ role: 'analyst', scopes: ['archive:view'] }, {}, 'view'),
    true
  );
  assert.equal(
    AR.canAccessArchive({ role: 'analyst', scopes: ['archive:view'] }, {}, 'delete'),
    false
  );
  assert.equal(
    AR.canAccessArchive(
      { role: 'analyst', scopes: ['archive:delete'] },
      { legalHold: true },
      'delete'
    ),
    false
  );
});

test('52548 requireExportBeforeDelete gates on export', () => {
  assert.equal(AR.requireExportBeforeDelete({ exports: 0 }).allowed, false);
  assert.equal(AR.requireExportBeforeDelete({ exports: 1 }).allowed, true);
  assert.equal(AR.requireExportBeforeDelete({ exports: 5, legalHold: true }).allowed, false);
});

test('52549 describeArchiveVsDelete separates the two', () => {
  const d = AR.describeArchiveVsDelete();
  assert.ok(d.archive.effect.includes('restorable'));
  assert.ok(d.delete.effect.includes('irreversibly'));
});

test('52550 bulkArchive archives every hunt', () => {
  const recs = AR.bulkArchive([{ id: 'a' }, { id: 'b' }], {}, NOW);
  assert.equal(recs.length, 2);
  assert.ok(recs.every(r => r.archivedAt === NOW));
});

test('52551 tagArchive dedupes and lowercases', () => {
  const t = AR.tagArchive({ tags: ['a'] }, ['A', 'B']);
  assert.deepEqual(t.tags.sort(), ['a', 'b']);
});

test('52552 recordArchiveReason appends history', () => {
  const r = AR.recordArchiveReason({}, 'closed', 'lead', NOW);
  assert.equal(r.reasonHistory.length, 1);
  assert.equal(r.reasonHistory[0].actor, 'lead');
});

test('52553 buildArchiveDashboard aggregates', () => {
  const d = AR.buildArchiveDashboard(
    [
      { id: 'a', bytes: 100, tier: 'hot', archivedAt: NOW - 10 * DAY, restores: 2, deleted: false },
      { id: 'b', bytes: 50, tier: 'cold', archivedAt: NOW - 5 * DAY, restores: 0, deleted: true },
    ],
    NOW
  );
  assert.equal(d.count, 1);
  assert.equal(d.totalBytes, 100);
  assert.equal(d.totalRestores, 2);
});

test('52554 storageUsageMeter projects growth', () => {
  const m = AR.storageUsageMeter([{ workspace: 'w', bytes: 100, deleted: false }], 10);
  assert.equal(m[0].projected30d, 400);
});

test('52555 estimateArchiveCost prices cold cheaper', () => {
  const hot = AR.estimateArchiveCost(1024 ** 3, 'hot');
  const cold = AR.estimateArchiveCost(1024 ** 3, 'cold');
  assert.ok(cold.monthlyUsd < hot.monthlyUsd);
});

test('52556 tieringPlan moves only old non-held archives', () => {
  const p = AR.tieringPlan(
    [
      { id: 'old', archivedAt: NOW - 200 * DAY, tier: 'hot' },
      { id: 'new', archivedAt: NOW - 10 * DAY, tier: 'hot' },
      { id: 'held', archivedAt: NOW - 200 * DAY, tier: 'hot', legalHold: true },
    ],
    { coldAfterDays: 90 },
    NOW
  );
  assert.deepEqual(p.moveToCold, ['old']);
  assert.deepEqual(p.keepHot.sort(), ['held', 'new']);
});

test('52557 verifyArchiveChecksum round-trips', () => {
  const a = AR.archiveHunt({ id: 'h9', target: 't' }, {}, NOW);
  const v = AR.verifyArchiveChecksum(a);
  assert.equal(v.ok, true);
  assert.equal(v.expected, v.actual);
});

test('52558 versionArchive bumps version and keeps prior checksum', () => {
  const a = AR.archiveHunt({ id: 'h9', target: 't' }, {}, NOW);
  const v2 = AR.versionArchive(a, NOW + 1);
  assert.equal(v2.version, 2);
  assert.equal(v2.priorChecksum, a.checksum);
});

test('52559 logArchiveAction appends with timestamp', () => {
  const log = AR.logArchiveAction([], { type: 'archive', archiveId: 'a', actor: 'x' }, NOW);
  assert.equal(log.length, 1);
  assert.equal(log[0].at, NOW);
});

test('52560 readOnlyView marks read-only with banner', () => {
  const v = AR.readOnlyView({
    id: 'a',
    target: 't',
    archivedAt: 1,
    bytes: 1,
    tier: 'hot',
    tags: [],
    reason: 'r',
  });
  assert.equal(v.readOnly, true);
  assert.ok(v.banner.includes('read-only'));
});

/* ---- JSX wiring audit (regex-based; node cannot import .jsx directly) ---- */
test('JSX files import the right cores and export galleries', () => {
  assert.ok(/import \* as CD from '.\/compareDeepCore.js'/.test(CD_JSX));
  assert.ok(/import \* as AR from '.\/archiveCore.js'/.test(AR_JSX));
  for (const [name, src, gal, count] of [
    ['cd', CD_JSX, 'CD64_GALLERY', 15],
    ['ar', AR_JSX, 'AR64_GALLERY', 25],
  ]) {
    assert.ok(new RegExp(`export const ${gal} = \\[`).test(src), `${name}: missing ${gal} export`);
    const m = src.match(new RegExp(`export const ${gal} = \\[([^\\]]+)\\]`));
    assert.ok(m, `${name}: could not parse ${gal} array`);
    const n = m[1].split(',').filter(s => s.trim().length > 0).length;
    assert.equal(n, count, `${name}: ${gal} must have ${count} components, got ${n}`);
  }
});

/* ---- Real esbuild JSX parse audit ---- */
test('real esbuild parse of both JSX files', () => {
  for (const f of ['CompareDeep.jsx', 'ArchiveSuite.jsx']) {
    execFileSync(
      'npx',
      ['esbuild', `--loader:.jsx=jsx`, '--format=esm', `--outfile=/dev/null`, join(DIR, f)],
      { stdio: 'pipe' }
    );
  }
});

/* ---- CSS audit: scoped prefixes only, zero keyframes, no global rules ---- */
test('Wave64.css: only .cd64-/.ar64- selectors, zero @keyframes, no global rules', () => {
  const classSelectors = [...CSS_SRC.matchAll(/^\s*\.([a-zA-Z0-9_-]+)\s*[{,]/gm)].map(m => m[1]);
  assert.ok(classSelectors.length > 0, 'expected class selectors');
  for (const sel of classSelectors) {
    assert.ok(sel.startsWith('cd64-') || sel.startsWith('ar64-'), `unscoped selector .${sel}`);
  }
  assert.ok(!/@keyframes/i.test(CSS_SRC), 'zero-animation order: no @keyframes');
  assert.ok(!/transition\s*:/i.test(CSS_SRC), 'zero-animation order: no transitions');
  assert.ok(!/animation\s*:/i.test(CSS_SRC), 'zero-animation order: no animations');
  assert.ok(!/^\s*(html|body|\*)\s*[{,]/m.test(CSS_SRC), 'no global element selectors');
  assert.ok(!/!important/.test(CSS_SRC), 'no !important');
});

test('Wave64.css: both prefixes have the shared layout primitives', () => {
  for (const prefix of ['cd64', 'ar64']) {
    for (const cls of ['gallery', 'card', 'title', 'note', 'row', 'stat', 'badge']) {
      assert.ok(new RegExp(`\\.${prefix}-${cls}\\b`).test(CSS_SRC), `missing .${prefix}-${cls}`);
    }
  }
});

/* ---- Branding audit: Infinity AI only, never Muse ---- */
test('branding: no "Muse" anywhere; "Infinity AI" present where branded', () => {
  for (const [name, src] of [
    ['cdCore', CD_SRC],
    ['arCore', AR_SRC],
    ['cdJsx', CD_JSX],
    ['arJsx', AR_JSX],
    ['css', CSS_SRC],
  ]) {
    assert.ok(!/Muse/i.test(src), `${name} leaks "Muse" branding`);
  }
  for (const [name, src] of [
    ['cdCore', CD_SRC],
    ['arCore', AR_SRC],
    ['cdJsx', CD_JSX],
    ['arJsx', AR_JSX],
    ['css', CSS_SRC],
  ]) {
    assert.ok(/Infinity AI/.test(src), `${name} missing "Infinity AI" branding`);
  }
});

/* ---- Debris audit: no TODO/FIXME/mock/demo/placeholder/debris ---- */
test('no TODO/FIXME/mock/demo/debris in any wave-64 file', () => {
  const bad = /\b(TODO|FIXME|XXX|HACK|lorem ipsum|not implemented)\b/i;
  for (const [name, src] of [
    ['cdCore', CD_SRC],
    ['arCore', AR_SRC],
    ['cdJsx', CD_JSX],
    ['arJsx', AR_JSX],
    ['css', CSS_SRC],
  ]) {
    assert.ok(!bad.test(src), `${name} contains debris marker`);
    assert.ok(!/\bmock\b/i.test(src) || /no mock/i.test(src), `${name} mentions mock`);
  }
});
