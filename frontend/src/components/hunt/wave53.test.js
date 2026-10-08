/**
 * wave53.test.js — Infinity AI · Dark-Matter · Wave 53
 * Run: node --test frontend/src/components/hunt/wave53.test.js
 * Tests the two pure core modules only (no JSX imported here).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

import * as LC from './fpLifecycleCore.js';
import * as GV from './fpGovernCore.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const NEW_FILES = [
  'fpLifecycleCore.js',
  'fpGovernCore.js',
  'FPLifecycle.jsx',
  'FPGovernance.jsx',
  'Wave53.css',
  'wave53.test.js',
];
const NOW = 1700000000000; // fixed reference time for deterministic tests

describe('fpLifecycleCore registry', () => {
  test('lists all 20 lifecycle ideas 52081–52100, zero skips', () => {
    assert.equal(LC.WAVE53_FP_LIFECYCLE_IDEAS.length, 20);
    const ids = LC.WAVE53_FP_LIFECYCLE_IDEAS.map(i => i.id);
    for (let id = 52081; id <= 52100; id++) assert.ok(ids.includes(id), `missing idea ${id}`);
    assert.equal(new Set(ids).size, 20, 'no duplicate ids');
    assert.ok(
      LC.WAVE53_FP_LIFECYCLE_IDEAS.every(i => i.title && i.title.length > 0),
      'every idea has a title'
    );
  });
});

describe('fpGovernCore registry', () => {
  test('lists all 20 governance ideas 52101–52120, zero skips', () => {
    assert.equal(GV.WAVE53_FP_GOVERN_IDEAS.length, 20);
    const ids = GV.WAVE53_FP_GOVERN_IDEAS.map(i => i.id);
    for (let id = 52101; id <= 52120; id++) assert.ok(ids.includes(id), `missing idea ${id}`);
    assert.equal(new Set(ids).size, 20, 'no duplicate ids');
    assert.ok(
      GV.WAVE53_FP_GOVERN_IDEAS.every(i => i.title && i.title.length > 0),
      'every idea has a title'
    );
  });
});

describe('fpLifecycleCore logic', () => {
  test('52081 buildFpAppendix numbers footnotes and keeps reasons', () => {
    const a = LC.buildFpAppendix([
      {
        findingId: 'f1',
        title: 'XSS',
        reasonId: 'nr',
        reasonLabel: 'Not reproducible',
        markedBy: 'ria',
        markedAt: NOW,
      },
    ]);
    assert.equal(a.count, 1);
    assert.equal(a.rows[0].footnote, 1);
    assert.ok(a.rows[0].text.includes('Not reproducible'));
  });

  test('52082 dispute open/resolve round-trip', () => {
    const opened = LC.openDispute(
      { findingId: 'f1', status: 'false-positive' },
      'sam',
      'retest shows issue',
      NOW
    );
    assert.equal(opened.status, 'disputed');
    assert.ok(opened.ok);
    const double = LC.openDispute(opened, 'x', 'y', NOW);
    assert.equal(double.ok, false);
    const upheld = LC.resolveDispute(opened, 'upheld', 'ria', NOW + 1);
    assert.equal(upheld.status, 'false-positive');
    const over = LC.resolveDispute(opened, 'overturned', 'ria', NOW + 1);
    assert.equal(over.status, 'open');
    assert.equal(LC.resolveDispute(opened, 'maybe', 'ria').ok, false);
  });

  test('52083 SLA math with per-severity targets', () => {
    const ok = LC.fpSlaElapsed(NOW - 3600e3, NOW, 'medium');
    assert.equal(ok.met, true);
    const bad = LC.fpSlaElapsed(NOW - 100 * 3600e3, NOW, 'medium');
    assert.equal(bad.met, false);
    assert.ok(bad.overrunMs > 0);
    const s = LC.fpSlaSummary([
      { foundAt: NOW - 3600e3, decidedAt: NOW, severity: 'medium' },
      { foundAt: NOW - 100 * 3600e3, decidedAt: NOW, severity: 'medium' },
    ]);
    assert.equal(s.total, 2);
    assert.equal(s.met, 1);
    assert.equal(s.violated, 1);
    assert.equal(s.metRate, 0.5);
  });

  test('52084 trend series + improving/worsening direction', () => {
    const series = LC.fpTrendOverHunts([
      { huntId: 'h1', totalFindings: 40, falsePositives: 20 },
      { huntId: 'h2', totalFindings: 40, falsePositives: 4 },
    ]);
    assert.equal(series[0].fpRate, 0.5);
    assert.equal(series[1].fpRate, 0.1);
    assert.equal(
      LC.fpTrendDirection([
        { huntId: 'h1', totalFindings: 40, falsePositives: 20 },
        { huntId: 'h2', totalFindings: 40, falsePositives: 4 },
      ]).direction,
      'improving'
    );
    assert.equal(
      LC.fpTrendDirection([
        { huntId: 'h1', totalFindings: 40, falsePositives: 4 },
        { huntId: 'h2', totalFindings: 40, falsePositives: 20 },
      ]).direction,
      'worsening'
    );
    assert.equal(
      LC.fpTrendDirection([{ huntId: 'h1', totalFindings: 40, falsePositives: 10 }]).direction,
      'flat'
    );
  });

  test('52085 probability badge from dismissal history', () => {
    const b = LC.fpProbabilityForSignature('sig-x', [
      { signature: 'sig-x', isFalsePositive: true },
      { signature: 'sig-x', isFalsePositive: true },
      { signature: 'sig-x', isFalsePositive: false },
    ]);
    assert.equal(b.probability, 0.67);
    assert.equal(b.label, '67% likely FP');
    assert.equal(b.sample, 3);
    const fresh = LC.fpProbabilityForSignature('sig-new', []);
    assert.equal(fresh.probability, 0.5);
  });

  test('52086 reason search ranks by token overlap', () => {
    const res = LC.searchFpReasons(
      [
        { findingId: 'f1', justification: 'waf blocked reflected xss payload', reasonId: 'nr' },
        { findingId: 'f2', justification: 'sql error is expected for admins', reasonId: 'eb' },
      ],
      'xss waf'
    );
    assert.equal(res.length, 1);
    assert.equal(res[0].findingId, 'f1');
    assert.equal(LC.searchFpReasons([], 'xss').length, 0);
  });

  test('52087 cross-hunt pattern detection proposes standing rules', () => {
    const recs = [
      { signature: 'xss-reflected', huntId: 'h1', reasonId: 'nr' },
      { signature: 'xss-reflected', huntId: 'h2', reasonId: 'nr' },
      { signature: 'xss-reflected', huntId: 'h3', reasonId: 'eb' },
      { signature: 'sqli', huntId: 'h1', reasonId: 'nr' },
    ];
    const p = LC.detectCrossHuntFpPatterns(recs, 3);
    assert.equal(p.length, 1);
    assert.equal(p[0].signature, 'xss-reflected');
    assert.equal(p[0].huntCount, 3);
    assert.equal(p[0].topReasonId, 'nr');
    assert.equal(p[0].proposesStandingRule, true);
  });

  test('52088 auto-FP rule DSL match semantics', () => {
    const rule = LC.makeAutoFpRule('r1', 'json error xss', [
      { field: 'endpoint', op: 'contains', value: '/error' },
      { field: 'title', op: 'matches', value: '^xss' },
    ]);
    assert.equal(rule.version, 1);
    const m = LC.matchAutoFpRule(rule, { endpoint: '/api/error', title: 'XSS in error field' });
    assert.equal(m.matched, true);
    const miss = LC.matchAutoFpRule(rule, { endpoint: '/login', title: 'XSS in error field' });
    assert.equal(miss.matched, false);
    assert.equal(
      LC.makeAutoFpRule('r2', 'eq', [{ field: 'severity', op: 'equals', value: 'low' }])
        .conditions[0].op,
      'equals'
    );
  });

  test('52089 per-target allowlist add/check with dedup', () => {
    const { allowlist, added } = LC.addTargetAllowlistEntry(
      [],
      'shop',
      'xss-reflected',
      'benign',
      'ria',
      NOW
    );
    assert.equal(added, true);
    assert.equal(LC.checkTargetAllowlist(allowlist, 'shop', 'xss-reflected'), true);
    assert.equal(LC.checkTargetAllowlist(allowlist, 'blog', 'xss-reflected'), false);
    const dup = LC.addTargetAllowlistEntry(
      allowlist,
      'shop',
      'xss-reflected',
      'benign',
      'ria',
      NOW
    );
    assert.equal(dup.added, false);
  });

  test('52090 rule versioning with diffs and rollback', () => {
    const r1 = LC.makeAutoFpRule('r1', 'rule', [{ field: 'title', op: 'contains', value: 'xss' }]);
    const r2 = LC.versionAutoFpRule(
      r1,
      { conditions: [{ field: 'title', op: 'contains', value: 'sqli' }] },
      'ria',
      NOW
    );
    assert.equal(r2.version, 2);
    assert.equal(r2.history.length, 1);
    assert.equal(r2.history[0].diff.length, 1);
    const back = LC.rollbackAutoFpRule(r2, 2);
    assert.equal(back.ok, true);
    assert.equal(back.conditions[0].value, 'xss');
    assert.equal(LC.rollbackAutoFpRule(r2, 99).ok, false);
  });

  test('52091 sandbox previews dismiss/keep counts', () => {
    const rule = LC.makeAutoFpRule('r1', 'sandbox', [
      { field: 'endpoint', op: 'contains', value: '/search' },
    ]);
    const res = LC.sandboxTestRule(rule, [
      { findingId: 'f1', endpoint: '/search', title: 'XSS', severity: 'medium' },
      { findingId: 'f2', endpoint: '/login', title: 'CSRF', severity: 'high' },
    ]);
    assert.equal(res.scanned, 2);
    assert.equal(res.wouldDismiss, 1);
    assert.equal(res.wouldKeep, 1);
    assert.deepEqual(res.bySeverity, { medium: 1 });
  });

  test('52092 team rule publishing + review status', () => {
    const pub = LC.publishTeamRule(
      LC.makeAutoFpRule('r1', 'shared', [{ field: 'title', op: 'contains', value: 'x' }]),
      'ria',
      'team-a',
      NOW
    );
    assert.equal(pub.ok, true);
    assert.equal(pub.libraryEntry.reviewDueAt, NOW + 90 * 86400e3);
    const overdue = LC.teamRuleReviewStatus(pub.libraryEntry, NOW + 100 * 86400e3);
    assert.equal(overdue.overdue, true);
    assert.equal(LC.publishTeamRule({}, 'ria').ok, false);
  });

  test('52093 guard samples deterministically and bounded by rate', () => {
    const dismissed = Array.from({ length: 100 }, (_, i) => ({ findingId: `a${i}` }));
    const s1 = LC.guardSampleDismissals(dismissed, 5);
    const s2 = LC.guardSampleDismissals(dismissed, 5);
    assert.deepEqual(
      s1.map(d => d.findingId),
      s2.map(d => d.findingId)
    );
    const none = LC.guardSampleDismissals(dismissed, 0);
    assert.equal(none.length, 0);
    const all = LC.guardSampleDismissals(dismissed, 100);
    assert.equal(all.length, 100);
    const sum = LC.guardSampleSummary(dismissed, 5);
    assert.equal(sum.total, 100);
  });

  test('52094 thresholds block criticals and enforce per-severity gates', () => {
    const c = LC.canAutoDismiss('critical', 0.99);
    assert.equal(c.allowed, false);
    const h = LC.canAutoDismiss('high', 0.95);
    assert.equal(h.allowed, true);
    const l = LC.canAutoDismiss('low', 0.5);
    assert.equal(l.allowed, false);
  });

  test('52095 auto-expiry resurface after window', () => {
    const m = LC.scheduleFpExpiry({ findingId: 'f1' }, 90, NOW);
    assert.equal(m.ok, true);
    assert.equal(m.expiresAt, NOW + 90 * 86400e3);
    assert.equal(LC.fpExpiryStatus(m, NOW + 80 * 86400e3).expired, false);
    assert.equal(LC.fpExpiryStatus(m, NOW + 91 * 86400e3).expired, true);
    assert.equal(LC.fpExpiryStatus({}).hasExpiry, false);
  });

  test('52096 tags accept taxonomy, reject unknown', () => {
    const m = LC.tagFpDismissal({ findingId: 'f1' }, ['waf-blocked', 'bogus']);
    assert.deepEqual(m.tags, ['waf-blocked']);
    assert.deepEqual(m.rejected, ['bogus']);
  });

  test('52097 digest payload aggregates by week/reason/marker', () => {
    const d = LC.buildFpDigestPayload(
      [
        { findingId: 'f1', title: 'XSS', reasonId: 'nr', markedBy: 'ria', markedAt: NOW - 86400e3 },
        {
          findingId: 'f2',
          title: 'SQLi',
          reasonId: 'nr',
          markedBy: 'sam',
          markedAt: NOW - 30 * 86400e3,
        },
      ],
      NOW - 7 * 86400e3,
      NOW
    );
    assert.equal(d.total, 1);
    assert.deepEqual(d.byReason, { nr: 1 });
    assert.deepEqual(d.byMarker, { ria: 1 });
    assert.ok(d.subject.includes('1 dismissals'));
  });

  test('52098 target change flags expired/related dismissals', () => {
    const flags = LC.flagFpForRevalidation(
      [
        {
          findingId: 'f1',
          signature: 's',
          target: 'shop',
          reasonId: 'expected-behavior',
          expiresAt: NOW - 1,
        },
      ],
      { target: 'shop', scope: 'config', at: NOW }
    );
    assert.equal(flags.length, 1);
    assert.equal(flags[0].flagged, true);
    const other = LC.flagFpForRevalidation([{ findingId: 'f2', target: 'blog' }], {
      target: 'shop',
      at: NOW,
    });
    assert.equal(other.length, 0);
  });

  test('52099 inheritance carries confirmed patterns to next hunt', () => {
    const inh = LC.inheritFpPatterns(
      [
        {
          signature: 'sig-a',
          target: 'shop',
          reasonId: 'nr',
          reasonLabel: 'NR',
          huntId: 'h1',
          status: 'false-positive',
        },
        { signature: 'sig-b', target: 'shop', reasonId: 'nr', huntId: 'h1', status: 'overturned' },
      ],
      { huntId: 'h2', target: 'shop' }
    );
    assert.equal(inh.inheritedCount, 1);
    assert.equal(inh.inherited[0].signature, 'sig-a');
    assert.equal(inh.inherited[0].inheritedFrom, 'h1');
  });

  test('52100 heatmap aggregates and buckets intensity', () => {
    const heat = LC.fpHeatmapByEndpoint([
      { endpoint: '/search' },
      { endpoint: '/search' },
      { endpoint: '/search' },
      { endpoint: '/search' },
      { endpoint: '/login' },
      { endpoint: '/login' },
      { endpoint: '/health' },
    ]);
    assert.equal(heat[0].endpoint, '/search');
    assert.equal(heat[0].count, 4);
    assert.equal(heat[0].intensity, 1);
    assert.equal(heat[0].bucket, 'hot');
    assert.equal(heat[2].bucket, 'cool');
  });
});

describe('fpGovernCore logic', () => {
  test('52101 same-as-previous copies reason in one click', () => {
    const prev = {
      findingId: 'old',
      signature: 'sig-x',
      reasonId: 'nr',
      reasonLabel: 'NR',
      justification: 'waf',
      markedBy: 'ria',
    };
    const r = GV.sameAsPreviousFp({ findingId: 'new', signature: 'sig-x' }, prev, 'sam', NOW);
    assert.equal(r.ok, true);
    assert.equal(r.reasonId, 'nr');
    assert.equal(r.signatureMatch, true);
    assert.equal(r.copiedFrom, 'old');
    assert.equal(GV.sameAsPreviousFp({ findingId: 'n' }, {}, 'sam').ok, false);
  });

  test('52102 review queue orders disputed > second-review > likely-fp', () => {
    const q = GV.buildFpReviewQueue([
      { findingId: 'a', status: 'likely-fp', severity: 'low', markedAt: NOW },
      { findingId: 'b', status: 'disputed', severity: 'low', markedAt: NOW },
      { findingId: 'c', status: 'pending-second-review', severity: 'high', markedAt: NOW },
      { findingId: 'd', status: 'false-positive', markedAt: NOW },
    ]);
    assert.deepEqual(
      q.map(x => x.findingId),
      ['b', 'c', 'a']
    );
  });

  test('52103 bulk import maps reasons, rejects unknown', () => {
    const r = GV.importFpDecisions(
      [
        { findingId: 'e1', externalReason: 'auditor-ok', markedBy: 'aud' },
        { externalReason: 'auditor-ok' },
        { findingId: 'e3', externalReason: 'mystery' },
      ],
      { 'auditor-ok': 'expected-behavior' }
    );
    assert.equal(r.importedCount, 1);
    assert.equal(r.imported[0].reasonId, 'expected-behavior');
    assert.equal(r.rejectedCount, 2);
  });

  test('52104 taxonomy extension dedups and validates', () => {
    const t = GV.extendReasonTaxonomy(
      [{ id: 'nr', label: 'NR' }],
      [
        { id: 'Pentest Window', label: 'Pentest window artifact' },
        { id: 'nr', label: 'dup' },
        { id: '', label: '' },
      ]
    );
    assert.equal(t.taxonomy.length, 2);
    assert.equal(t.added[0].id, 'pentest-window');
    assert.equal(t.rejected.length, 2);
  });

  test('52105 owner notification payload flags urgent highs', () => {
    const n = GV.notifyHuntOwnerPayload(
      { findingId: 'f1', markedBy: 'ria', reasonId: 'nr', reasonLabel: 'NR', severity: 'critical' },
      { userId: 'owner1' }
    );
    assert.equal(n.to, 'owner1');
    assert.equal(n.urgent, true);
    assert.equal(n.cta, 'review-dismissal');
  });

  test('52106 changelog logs known events, rejects unknown', () => {
    const r1 = GV.logFpChange([], 'marked-fp', 'ria', { reasonId: 'nr' }, NOW);
    assert.equal(r1.ok, true);
    const r2 = GV.logFpChange(r1.history, 'bogus', 'x', {}, NOW);
    assert.equal(r2.ok, false);
    assert.equal(r2.history.length, 1);
    const s = GV.fpChangelogSummary(r1.history);
    assert.equal(s.total, 1);
    assert.deepEqual(s.counts, { 'marked-fp': 1 });
  });

  test('52107 screenshot attach validates mime and size', () => {
    const ok = GV.attachScreenshot(
      { findingId: 'f1' },
      { name: 'r.png', mimeType: 'image/png', sizeBytes: 1000 }
    );
    assert.equal(ok.ok, true);
    assert.equal(ok.screenshots.length, 1);
    assert.equal(GV.attachScreenshot({}, { mimeType: 'application/pdf' }).ok, false);
    assert.equal(
      GV.attachScreenshot({}, { mimeType: 'image/png', sizeBytes: 6 * 1024 * 1024 }).ok,
      false
    );
  });

  test('52108 likely-fp state machine confirms or clears', () => {
    const m = GV.markLikelyFp({ findingId: 'f1' }, 0.82, NOW);
    assert.equal(m.status, 'likely-fp');
    const c = GV.confirmLikelyFp(m, 'ria', true, 'benign', NOW + 1);
    assert.equal(c.status, 'false-positive');
    const clear = GV.confirmLikelyFp(m, 'ria', false, 'real', NOW + 1);
    assert.equal(clear.status, 'open');
    assert.equal(GV.confirmLikelyFp({ status: 'open' }, 'ria', true, 'x').ok, false);
  });

  test('52109 training export labels FP/TP, skips unlabeled', () => {
    const ex = GV.exportTrainingData([
      { findingId: 'f1', signature: 's', isFalsePositive: true, reasonId: 'nr' },
      { findingId: 'f2', signature: 's2', isFalsePositive: false },
      { findingId: 'f3' },
    ]);
    assert.equal(ex.format, 'jsonl');
    assert.equal(ex.fpCount, 1);
    assert.equal(ex.tpCount, 1);
    assert.equal(ex.skipped.length, 1);
    assert.equal(ex.rows[0].label, 'FP');
    assert.equal(ex.rows[0].has_evidence, false);
  });

  test('52110 dashboard stats window and top reasons', () => {
    const s = GV.dashboardFpStats(
      [
        { findingId: 'f1', reasonId: 'nr', markedAt: NOW - 86400e3, status: 'false-positive' },
        {
          findingId: 'f2',
          reasonId: 'eb',
          markedAt: NOW - 86400e3,
          status: 'pending-second-review',
        },
        { findingId: 'f3', reasonId: 'nr', markedAt: NOW - 30 * 86400e3, status: 'false-positive' },
      ],
      NOW
    );
    assert.equal(s.weekCount, 2);
    assert.equal(s.pendingSecondReview, 1);
    assert.equal(s.topReasons[0].reasonId, 'nr');
  });

  test('52111 reviewer analytics compute overturn rates', () => {
    const rows = GV.reviewerFpAnalytics([
      { markedBy: 'ria', dispute: { resolution: 'overturned' } },
      { markedBy: 'ria', dispute: { resolution: 'upheld' } },
      { markedBy: 'sam' },
    ]);
    const ria = rows.find(r => r.reviewer === 'ria');
    assert.equal(ria.dismissals, 2);
    assert.equal(ria.overturnRate, 0.5);
    assert.equal(ria.upheldRate, 0.5);
  });

  test('52112 calibration session votes and agreement rate', () => {
    const s = GV.planCalibrationSession(
      [
        { findingId: 'f1', isFalsePositive: true, reasonId: 'nr', markedBy: 'ria' },
        { findingId: 'f2', isFalsePositive: true, reasonId: 'eb', markedBy: 'sam' },
      ],
      2,
      NOW
    );
    assert.equal(s.sampleSize, 2);
    assert.equal(s.status, 'planned');
    const v = GV.recordCalibrationVerdict(s, 'f1', 'lead', true, 'ok');
    assert.equal(v.status, 'in-progress');
    const v2 = GV.recordCalibrationVerdict(v, 'f2', 'lead', false, 'nope');
    assert.equal(v2.status, 'complete');
    assert.equal(GV.calibrationAgreement(v2).agreementRate, 0.5);
  });

  test('52113 agent scorecard ranks by quality', () => {
    const rows = GV.agentFpScorecard(
      [
        { engine: 'a', isFalsePositive: true },
        { engine: 'a', isFalsePositive: false },
        { engine: 'b', isFalsePositive: false },
      ],
      { a: { model: 'q', version: 'v1' }, b: { model: 'q', version: 'v1' } }
    );
    assert.equal(rows[0].engineId, 'b');
    assert.equal(rows[0].qualityScore, 1);
    assert.equal(rows[1].fpRate, 0.5);
  });

  test('52114 clustering groups similar signatures (real Jaccard)', () => {
    assert.equal(GV.jaccardSimilarity(new Set(['a', 'b']), new Set(['a', 'b'])), 1);
    assert.equal(GV.jaccardSimilarity(new Set(['a']), new Set(['b'])), 0);
    assert.equal(GV.jaccardSimilarity(new Set(), new Set()), 1);
    const c = GV.clusterFpPatterns(
      [
        { findingId: 'f1', signature: 'xss-reflected', endpoint: '/search', reasonId: 'nr' },
        { findingId: 'f2', signature: 'xss-reflected', endpoint: '/search', reasonId: 'nr' },
        { findingId: 'f3', signature: 'sqli-union', endpoint: '/login', reasonId: 'test-data' },
      ],
      0.4
    );
    assert.ok(c.length >= 2);
    const big = c.find(x => x.representativeSignature === 'xss-reflected');
    assert.ok(big && big.size === 2);
  });

  test('52115 audit export rows carry who/when/why', () => {
    const ex = GV.buildFpAuditExport(
      [
        {
          findingId: 'f1',
          reasonId: 'nr',
          justification: 'waf',
          markedBy: 'ria',
          markedAt: NOW,
          screenshots: [{}, {}],
        },
      ],
      'lead',
      NOW
    );
    assert.equal(ex.rowCount, 1);
    assert.equal(ex.rows[0].marked_by, 'ria');
    assert.equal(ex.rows[0].screenshots, 2);
    assert.equal(ex.generatedBy, 'lead');
  });

  test('52116 engine filter and per-engine FP rates', () => {
    const dec = [
      { engine: 'a', isFalsePositive: true },
      { engine: 'a', isFalsePositive: false },
      { engine: 'b', isFalsePositive: false },
    ];
    assert.equal(GV.filterFpByEngine(dec, 'a').length, 2);
    const rates = GV.fpRatesByEngine(dec);
    assert.equal(rates[0].engine, 'a');
    assert.equal(rates[0].fpRate, 0.5);
  });

  test('52117 comment thread add/close with validation', () => {
    const t = GV.newFpThread('f1', 'sam', NOW);
    const withComment = GV.addFpComment(t, 'ria', 'looks benign', NOW + 1);
    assert.equal(withComment.ok, true);
    assert.equal(withComment.comments.length, 1);
    assert.equal(GV.addFpComment(t, 'ria', '   ').ok, false);
    const closed = GV.closeFpThread(withComment, 'ria', NOW + 2);
    assert.equal(closed.status, 'closed');
    assert.equal(GV.addFpComment(closed, 'ria', 'late', NOW + 3).ok, false);
  });

  test('52118 hardening-note middle state requires a note', () => {
    const m = GV.dismissWithHardeningNote(
      { findingId: 'f1' },
      'expected-behavior',
      'add rate limits',
      'ria',
      NOW
    );
    assert.equal(m.ok, true);
    assert.equal(m.status, 'fp-hardening-note');
    assert.equal(m.isFalsePositive, true);
    assert.equal(GV.dismissWithHardeningNote({ findingId: 'f1' }, 'eb', '   ', 'ria').ok, false);
  });

  test('52119 severity downgrade enforces lower target + reason', () => {
    const d = GV.downgradeSeverity(
      { findingId: 'f1', severity: 'high' },
      'low',
      'needs admin',
      'ria',
      NOW
    );
    assert.equal(d.ok, true);
    assert.equal(d.severity, 'low');
    assert.equal(d.downgrade.from, 'high');
    assert.equal(
      GV.downgradeSeverity({ findingId: 'f1', severity: 'high' }, 'critical', 'x', 'ria').ok,
      false
    );
    assert.equal(
      GV.downgradeSeverity({ findingId: 'f1', severity: 'high' }, 'low', '', 'ria').ok,
      false
    );
  });

  test('52120 digest controls default disputed+weekly on, others off', () => {
    const rows = GV.fpDigestControls(GV.FP_NOTIFY_EVENTS, { 'fp-marked': true });
    const disputed = rows.find(r => r.event === 'fp-disputed');
    assert.equal(disputed.enabled, true);
    const owner = rows.find(r => r.event === 'owner-alert');
    assert.equal(owner.enabled, false);
    assert.equal(GV.shouldNotifyFpEvent('fp-disputed', {}), true);
    assert.equal(GV.shouldNotifyFpEvent('owner-alert', {}), false);
    assert.equal(GV.shouldNotifyFpEvent('mystery', {}), false);
  });
});

describe('JSX parse check', () => {
  test('FPLifecycle.jsx and FPGovernance.jsx parse as valid JSX via esbuild', () => {
    const require = createRequire(import.meta.url);
    let esbuild = null;
    try {
      esbuild = require('esbuild');
    } catch {
      esbuild = null;
    }
    if (!esbuild) {
      const npxPath = join(HERE, '..', '..', '..', 'node_modules', '.bin', 'esbuild');
      if (!existsSync(npxPath)) {
        console.log('esbuild not available — JSX parse check skipped gracefully');
        return;
      }
      throw new Error('esbuild binary present but require failed');
    }
    for (const f of ['FPLifecycle.jsx', 'FPGovernance.jsx']) {
      const code = readFileSync(join(HERE, f), 'utf8');
      esbuild.transformSync(code, { loader: 'jsx' });
    }
  });
});

describe('self audits', () => {
  test('all 6 new wave-53 files exist', () => {
    for (const f of NEW_FILES) {
      assert.ok(existsSync(join(HERE, f)), `${f} is missing`);
    }
  });
  test('none of the 5 product files contain TODO/FIXME/XXX/mock/simulate/lorem/demo placeholder text', () => {
    const pattern = /\b(todo|fixme|xxx|hack|mock|simulate|lorem|demo)\b/i;
    for (const f of NEW_FILES.filter(x => x !== 'wave53.test.js')) {
      const content = readFileSync(join(HERE, f), 'utf8');
      const hit = content.match(pattern);
      assert.ok(!hit, `${f} contains debris marker: "${hit && hit[0]}"`);
    }
  });
  test('Wave53.css has zero @keyframes, transitions, and animations', () => {
    const css = readFileSync(join(HERE, 'Wave53.css'), 'utf8');
    assert.ok(!css.includes('@keyframes'), 'no @keyframes allowed');
    assert.ok(!/transition\s*:/i.test(css), 'no transitions allowed');
    assert.ok(!/animation\s*:/i.test(css), 'no animations allowed');
  });
  test('Wave53.css uses only scoped prefixes .fpl53-* and .fpg53-*', () => {
    const css = readFileSync(join(HERE, 'Wave53.css'), 'utf8');
    const classSelectors = css.match(/^\.[a-zA-Z][a-zA-Z0-9_-]*/gm) || [];
    const rogue = classSelectors.filter(c => !c.startsWith('.fpl53-') && !c.startsWith('.fpg53-'));
    assert.deepEqual(rogue, [], `unscoped selectors: ${rogue.join(', ')}`);
  });
  test('Infinity AI branding only — no other worker name in product files', () => {
    const productFiles = NEW_FILES.filter(f => f !== 'wave53.test.js');
    for (const f of productFiles) {
      const content = readFileSync(join(HERE, f), 'utf8');
      assert.ok(!/\b[mM]use\b/.test(content), `${f} mentions the forbidden worker name`);
    }
  });
});
