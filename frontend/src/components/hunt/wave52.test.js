/**
 * wave52.test.js — Infinity AI · Dark-Matter · Wave 52
 * Run: node --test frontend/src/components/hunt/wave52.test.js
 * Tests the two pure core modules only (no JSX imported here).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

import * as TR2 from './triageRound2Core.js';
import * as FP from './fpCore.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const NEW_FILES = [
  'triageRound2Core.js',
  'fpCore.js',
  'TriageRound2.jsx',
  'FPManagement.jsx',
  'Wave52.css',
  'wave52.test.js',
];
const NOW = 1700000000000; // fixed reference time for deterministic tests

describe('triageRound2Core registry', () => {
  test('lists all 23 triage round-2 ideas 52041–52063, zero skips', () => {
    assert.equal(TR2.WAVE52_TRIAGE2_IDEAS.length, 23);
    const ids = TR2.WAVE52_TRIAGE2_IDEAS.map(i => i.id);
    for (let id = 52041; id <= 52063; id++) assert.ok(ids.includes(id), `missing idea ${id}`);
    assert.equal(new Set(ids).size, 23, 'no duplicate ids');
    assert.ok(
      TR2.WAVE52_TRIAGE2_IDEAS.every(i => i.title && i.title.length > 0),
      'every idea has a title'
    );
  });
});

describe('fpCore registry', () => {
  test('lists all 17 FP ideas 52064–52080, zero skips', () => {
    assert.equal(FP.WAVE52_FP_IDEAS.length, 17);
    const ids = FP.WAVE52_FP_IDEAS.map(i => i.id);
    for (let id = 52064; id <= 52080; id++) assert.ok(ids.includes(id), `missing idea ${id}`);
    assert.equal(new Set(ids).size, 17, 'no duplicate ids');
    assert.ok(
      FP.WAVE52_FP_IDEAS.every(i => i.title && i.title.length > 0),
      'every idea has a title'
    );
  });
});

describe('triageRound2Core spot checks', () => {
  test('buildReviewTimeline sorts chronologically and drops bad kinds', () => {
    const tl = TR2.buildReviewTimeline([
      { kind: 'comment', at: 200, actor: 'b' },
      { kind: 'nonsense', at: 100, actor: 'x' },
      { kind: 'view', at: 50, actor: 'a' },
    ]);
    assert.equal(tl.length, 2);
    assert.equal(tl[0].kind, 'view');
    assert.equal(tl[1].actor, 'b');
  });

  test('buildComparisonTable needs 2–3 findings and flags differing fields', () => {
    assert.equal(TR2.buildComparisonTable([]).ok, false);
    const ok = TR2.buildComparisonTable([
      {
        id: 'a',
        severity: 'high',
        vulnClass: 'xss',
        endpoint: '/x',
        confidence: 90,
        status: 'open',
        evidence: [1],
      },
      {
        id: 'b',
        severity: 'high',
        vulnClass: 'sqli',
        endpoint: '/x',
        confidence: 40,
        status: 'open',
        evidence: [],
      },
    ]);
    assert.equal(ok.ok, true);
    assert.ok(ok.differs.includes('vulnClass'));
    assert.ok(!ok.differs.includes('severity'));
  });

  test('buildWidgetCounts counts criticals, unreviewed, sla breaches', () => {
    const findings = [
      { severity: 'critical', status: 'open', reviewed: true, slaDueAt: NOW + 1000 },
      { severity: 'high', status: 'open', reviewed: false, slaDueAt: NOW - 1000 },
      { severity: 'low', status: 'closed', reviewed: true },
    ];
    const c = TR2.buildWidgetCounts(findings, NOW);
    assert.equal(c.openCriticals, 1);
    assert.equal(c.unreviewed, 1);
    assert.equal(c.slaBreaches, 1);
    assert.equal(c.totalOpen, 2);
  });

  test('computeReminders fires after interval and escalates criticals', () => {
    const r = TR2.computeReminders(
      [{ status: 'open', severity: 'critical' }],
      { intervalHours: 1, lastSentAt: 0, criticalEscalate: true },
      NOW
    );
    assert.ok(r.some(x => x.message.includes('1 findings pending triage')));
    assert.ok(r.some(x => x.escalated === true));
    const none = TR2.computeReminders(
      [{ status: 'open' }],
      { intervalHours: 24, lastSentAt: NOW },
      NOW
    );
    assert.equal(none.length, 0);
  });

  test('offline queue pack/decide/merge with conflict resolution', () => {
    const pack = TR2.packOfflineQueue([{ id: 'a', updatedAt: NOW - 10 }], 3, NOW);
    assert.equal(pack.rev, 3);
    const decided = TR2.applyOfflineDecision(pack, 'a', 'accepted', NOW);
    assert.equal(decided.findings[0].decision, 'accepted');
    const merged = TR2.mergeOfflineDecisions(decided, [
      { id: 'a', decision: 'dismissed', updatedAt: NOW - 100 },
    ]);
    assert.equal(merged.merged[0].source, 'offline-newer');
    assert.equal(merged.conflicts.length, 1);
    assert.equal(merged.conflicts[0].resolution, 'offline-newer-kept');
  });

  test('suggestDuplicates groups by signature and mergeFindings unions evidence', () => {
    const fs = [
      { id: 'a', vulnClass: 'xss', endpoint: '/s', parameter: 'q', evidence: [{ x: 1 }] },
      { id: 'b', vulnClass: 'xss', endpoint: '/s', parameter: 'q', evidence: [{ x: 1 }, { y: 2 }] },
      { id: 'c', vulnClass: 'sqli', endpoint: '/p', parameter: 'id', evidence: [] },
    ];
    const sug = TR2.suggestDuplicates(fs);
    assert.equal(sug.length, 1);
    assert.deepEqual(sug[0].findingIds.sort(), ['a', 'b']);
    const m = TR2.mergeFindings(fs[0], fs[1]);
    assert.equal(m.evidence.length, 2);
    assert.deepEqual(m.mergedFrom, ['b']);
  });

  test('searchAllHunts finds findings across hunts', () => {
    const r = TR2.searchAllHunts(
      [{ id: 'h1', name: 'Shop', findings: [{ id: 'f1', title: 'XSS here', vulnClass: 'xss' }] }],
      'xss'
    );
    assert.equal(r.length, 1);
    assert.equal(r[0].huntId, 'h1');
    assert.equal(TR2.searchAllHunts([], 'xss').length, 0);
    assert.equal(TR2.searchAllHunts([{ findings: [] }], '  ').length, 0);
  });

  test('routeToTeams routes by asset ownership, unassigned fallback', () => {
    const q = TR2.routeToTeams(
      [
        { asset: 'a1', id: 'f1' },
        { asset: 'a9', id: 'f2' },
      ],
      { a1: 'team-x' }
    );
    assert.equal(q['team-x'].length, 1);
    assert.equal(q['unassigned'].length, 1);
  });

  test('describeForScreenReader produces a complete spoken summary', () => {
    const d = TR2.describeForScreenReader({
      id: 'f9',
      severity: 'high',
      status: 'open',
      title: 'SQLi',
      vulnClass: 'sqli',
      endpoint: '/p',
    });
    assert.ok(d.includes('f9') && d.includes('high') && d.includes('/p'));
    assert.ok(TR2.TRIAGE_KEYBOARD_HINTS.length >= 4);
  });

  test('addAnnotation validates box and removeAnnotation removes', () => {
    const r1 = TR2.addAnnotation([], { x: 1 });
    assert.equal(r1.ok, false);
    const r2 = TR2.addAnnotation([], { x: 10, y: 20, w: 30, h: 40, label: 'payload' });
    assert.equal(r2.ok, true);
    assert.equal(r2.annotations[0].label, 'payload');
    assert.equal(TR2.removeAnnotation(r2.annotations, r2.annotations[0].id).length, 0);
  });

  test('buildEvidenceChain numbers steps', () => {
    const c = TR2.buildEvidenceChain([
      { method: 'POST', url: '/a', request: 'r', response: '200' },
    ]);
    assert.equal(c.totalSteps, 1);
    assert.equal(c.steps[0].step, 1);
    assert.equal(TR2.buildEvidenceChain([]).valid, false);
  });

  test('simplifyFinding glosses jargon', () => {
    const s = TR2.simplifyFinding('Reflected XSS via query parameter', {
      XSS: 'attacker code in a page',
      parameter: 'value in the address',
    });
    assert.ok(s.includes('attacker code in a page'));
  });

  test('buildLeaderboard ranks opt-in reviewers only', () => {
    const b = TR2.buildLeaderboard([
      { name: 'a', reviewed: 5, accuracy: 0.9, optIn: true },
      { name: 'b', reviewed: 50, accuracy: 0.8, optIn: false },
      { name: 'c', reviewed: 9, accuracy: 0.95, optIn: true },
    ]);
    assert.equal(b.length, 2);
    assert.equal(b[0].name, 'c');
    assert.equal(b[0].rank, 1);
  });

  test('getReviewTemplate returns class template or default', () => {
    assert.ok(TR2.getReviewTemplate('xss').length >= 3);
    assert.deepEqual(TR2.getReviewTemplate('mystery-class'), TR2.getReviewTemplate('default'));
  });

  test('toggleSelect and selectAll', () => {
    assert.deepEqual(TR2.toggleSelect([], 'a'), ['a']);
    assert.deepEqual(TR2.toggleSelect(['a'], 'a'), []);
    assert.deepEqual(TR2.selectAll([{ id: 'a' }, { id: 'b' }]), ['a', 'b']);
  });

  test('buildHeatmap aggregates asset x vuln class', () => {
    const cells = TR2.buildHeatmap([
      { asset: 'shop', vulnClass: 'xss' },
      { asset: 'shop', vulnClass: 'xss' },
      { asset: 'blog', vulnClass: 'sqli' },
    ]);
    assert.equal(cells[0].count, 2);
    assert.deepEqual(cells[0].filter, { asset: 'shop', vulnClass: 'xss' });
  });

  test('buildRelationshipGraph links shared endpoints', () => {
    const g = TR2.buildRelationshipGraph([
      { id: 'a', endpoint: '/x', parameter: 'q' },
      { id: 'b', endpoint: '/x', parameter: 'z' },
      { id: 'c', endpoint: '/y', parameter: 'q' },
    ]);
    assert.equal(g.nodes.length, 3);
    assert.ok(g.edges.some(e => e.via === 'shared-endpoint'));
    assert.ok(g.edges.some(e => e.via === 'shared-parameter'));
  });

  test('buildFirstLookTour takes top 5 by severity', () => {
    const t = TR2.buildFirstLookTour([
      { id: 'a', severity: 'low' },
      { id: 'b', severity: 'critical' },
      { id: 'c', severity: 'high' },
    ]);
    assert.equal(t.steps[0].findingId, 'b');
    assert.equal(t.totalSteps, 3);
  });

  test('balanceWorkload distributes to least-loaded reviewer', () => {
    const r = TR2.balanceWorkload(
      [
        { id: 'a', status: 'open' },
        { id: 'b', status: 'open' },
        { id: 'c', status: 'closed' },
      ],
      [
        { name: 'ria', load: 10 },
        { name: 'sam', load: 1 },
      ]
    );
    assert.equal(r.assignments.length, 2);
    assert.ok(r.assignments.some(a => a.reviewer === 'sam'));
    assert.equal(r.unassigned.length, 0);
    const empty = TR2.balanceWorkload([{ id: 'a', status: 'open' }], []);
    assert.equal(empty.unassigned.length, 1);
  });

  test('exportDecisions produces quoted CSV', () => {
    const csv = TR2.exportDecisions([
      { findingId: 'f1', decidedBy: 'ria', decision: 'accepted', decidedAt: 123 },
    ]);
    const lines = csv.split('\n');
    assert.equal(lines.length, 2);
    assert.ok(lines[0].includes('finding_id,decided_by'));
    assert.ok(lines[1].includes('"f1","ria","accepted","123"'));
  });

  test('toggleReaction adds and removes reactions', () => {
    const c1 = TR2.toggleReaction({}, '👍', 'ria');
    assert.deepEqual(c1.reactions['👍'], ['ria']);
    const c2 = TR2.toggleReaction(c1, '👍', 'ria');
    assert.equal(c2.reactions['👍'], undefined);
    assert.ok(TR2.reactionOptions().includes('👍'));
  });

  test('watch/unwatch finding', () => {
    const w = TR2.watchFinding({ id: 'f1' }, 'ria');
    assert.deepEqual(TR2.notifiableWatchers(w), ['ria']);
    const u = TR2.unwatchFinding(w, 'ria');
    assert.deepEqual(TR2.notifiableWatchers(u), []);
    assert.deepEqual(TR2.notifiableWatchers({}), []);
  });

  test('describeTriageApi lists REST endpoints', () => {
    const api = TR2.describeTriageApi();
    assert.ok(api.length >= 7);
    assert.ok(api.every(e => e.method && e.path && e.summary));
    assert.ok(api.some(e => e.path.includes('openapi')));
  });
});

describe('fpCore spot checks', () => {
  test('pickFpReason accepts taxonomy ids only', () => {
    assert.equal(FP.FP_REASONS.length, 5);
    const ok = FP.pickFpReason('not-reproducible', 'notes');
    assert.equal(ok.ok, true);
    assert.equal(ok.label, 'Not reproducible');
    assert.equal(FP.pickFpReason('bogus').ok, false);
  });

  test('validateJustification enforces minimum words', () => {
    const short = FP.validateJustification('too short', 8);
    assert.equal(short.ok, false);
    assert.equal(short.words, 2);
    const long = FP.validateJustification(
      'this payload is blocked by the WAF before reaching the application',
      8
    );
    assert.equal(long.ok, true);
  });

  test('linkEvidence attaches proving snippet', () => {
    const m = FP.linkEvidence(
      { findingId: 'f1' },
      { label: 'WAF page', content: 'blocked', capturedAt: NOW }
    );
    assert.equal(m.ok, true);
    assert.equal(m.evidenceLink.label, 'WAF page');
    assert.equal(FP.linkEvidence({}, {}).ok, false);
  });

  test('fpConfidenceScore rises with WAF block + no evidence', () => {
    const high = FP.fpConfidenceScore({
      evidence: [],
      responseBody: '403 WAF blocked',
      severity: 'low',
    });
    const low = FP.fpConfidenceScore({
      evidence: [{ x: 1 }],
      responseBody: '200',
      severity: 'critical',
      asset: 'prod',
    });
    assert.ok(high > low);
    assert.ok(high <= 0.99);
  });

  test('attributeFpMarking requires reviewer', () => {
    const a = FP.attributeFpMarking({ by: 'ria', at: NOW });
    assert.equal(a.ok, true);
    assert.equal(a.markedBy, 'ria');
    assert.equal(a.markedAt, NOW);
    assert.equal(FP.attributeFpMarking({}).ok, false);
  });

  test('buildTrainingSample needs a reason', () => {
    const s = FP.buildTrainingSample({
      findingId: 'f1',
      reasonId: 'test-artifact',
      vulnClass: 'xss',
      engine: 'e1',
    });
    assert.equal(s.ok, true);
    assert.equal(s.label, 'false-positive');
    assert.equal(FP.buildTrainingSample({}).ok, false);
  });

  test('suggestFpReason picks the most common past reason', () => {
    const s = FP.suggestFpReason({ vulnClass: 'xss' }, [
      { vulnClass: 'xss', reasonId: 'not-reproducible' },
      { vulnClass: 'xss', reasonId: 'not-reproducible' },
      { vulnClass: 'xss', reasonId: 'expected-behavior' },
    ]);
    assert.equal(s.suggestion, 'not-reproducible');
    assert.equal(s.votes, 2);
    assert.equal(FP.suggestFpReason({ vulnClass: 'ssrf' }, []).suggestion, null);
  });

  test('fpRateByClass ranks noisiest class first', () => {
    const rows = FP.fpRateByClass([
      { vulnClass: 'xss', isFalsePositive: true },
      { vulnClass: 'xss', isFalsePositive: true },
      { vulnClass: 'sqli', isFalsePositive: true },
      { vulnClass: 'sqli', isFalsePositive: false },
    ]);
    assert.equal(rows[0].vulnClass, 'xss');
    assert.equal(rows[0].rate, 1);
    assert.equal(rows[1].rate, 0.5);
  });

  test('fpRateByTarget groups by asset', () => {
    const rows = FP.fpRateByTarget([
      { target: 'shop', isFalsePositive: true },
      { target: 'blog', isFalsePositive: false },
    ]);
    assert.equal(rows[0].target, 'shop');
    assert.equal(rows[0].rate, 1);
  });

  test('engineFpLeaderboard sorts cleanest engine first', () => {
    const rows = FP.engineFpLeaderboard([
      { engine: 'noisy', isFalsePositive: true },
      { engine: 'noisy', isFalsePositive: true },
      { engine: 'clean', isFalsePositive: false },
      { engine: 'clean', isFalsePositive: false },
    ]);
    assert.equal(rows[0].engine, 'clean');
    assert.equal(rows[1].fpRate, 1);
  });

  test('unmarkFp restores prior state and logs reversal', () => {
    const r = FP.unmarkFp(
      { id: 'f1', fpMarked: true, status: 'dismissed-fp', priorStatus: 'open' },
      NOW
    );
    assert.equal(r.ok, true);
    assert.equal(r.finding.status, 'open');
    assert.equal(r.finding.fpMarked, false);
    assert.equal(r.reversalLog.action, 'fp-unmark');
    assert.equal(FP.unmarkFp({ id: 'f2' }).ok, false);
  });

  test('two-reviewer approval blocks self-approval for critical', () => {
    const p = FP.requestFpApproval({ id: 'f1', severity: 'critical' }, 'ria', NOW);
    assert.equal(p.status, 'awaiting-second-reviewer');
    const self = FP.approveFpApproval(p, 'ria', true, NOW);
    assert.equal(self.ok, false);
    const other = FP.approveFpApproval(p, 'sam', true, NOW);
    assert.equal(other.ok, true);
    assert.equal(other.final, 'applied');
    const auto = FP.requestFpApproval({ id: 'f2', severity: 'low' }, 'ria', NOW);
    assert.equal(auto.status, 'auto-approved');
  });

  test('bulkMarkFp marks many under a shared reason', () => {
    const r = FP.bulkMarkFp(
      [
        { id: 'a', status: 'open' },
        { id: 'b', status: 'open' },
      ],
      'test-artifact',
      'ria',
      NOW
    );
    assert.equal(r.ok, true);
    assert.equal(r.count, 2);
    assert.ok(
      r.findings.every(f => f.fpMarked && f.status === 'dismissed-fp' && f.markedAt === NOW)
    );
    assert.equal(FP.bulkMarkFp([{ id: 'a' }], 'bogus', 'ria').ok, false);
  });

  test('FP templates save and fetch', () => {
    const saved = FP.saveFpTemplate([], 'WAF verified', 'sam');
    assert.ok(saved.id);
    const got = FP.getFpTemplate(saved.id, saved.templates);
    assert.equal(got.ok, true);
    assert.equal(FP.getFpTemplate('nope', saved.templates).ok, false);
    assert.equal(FP.FP_TEMPLATE_SAMPLES.length, 3);
  });

  test('recordTeachingNote caps at 30 seconds', () => {
    const ok = FP.recordTeachingNote(
      { findingId: 'f1', reasonId: 'not-reproducible' },
      'The WAF strips payloads.',
      24
    );
    assert.equal(ok.ok, true);
    assert.equal(ok.teachingNote.durationSeconds, 24);
    assert.equal(FP.recordTeachingNote({}, 'text', 45).ok, false);
    assert.equal(FP.recordTeachingNote({}, '   ', 10).ok, false);
  });

  test('fpAnalytics aggregates dashboard metrics', () => {
    const a = FP.fpAnalytics(
      [
        {
          isFalsePositive: true,
          reasonId: 'not-reproducible',
          markedBy: 'ria',
          markedAt: NOW,
          foundAt: NOW - 60000,
        },
        {
          isFalsePositive: true,
          reasonId: 'not-reproducible',
          markedBy: 'sam',
          markedAt: NOW,
          foundAt: NOW - 120000,
        },
        { isFalsePositive: false },
      ],
      NOW
    );
    assert.equal(a.totalMarked, 2);
    assert.equal(a.fpRateOverall, 0.667);
    assert.equal(a.topReasons[0].key, 'not-reproducible');
    assert.equal(a.avgTimeToDismissMs, 90000);
  });

  test('quarantine then restore keeps finding recoverable', () => {
    const q = FP.quarantineFp({ id: 'f1', fpMarked: true }, NOW);
    assert.equal(q.ok, true);
    assert.equal(q.quarantined.excludedFromReports, true);
    const r = FP.restoreFromQuarantine(q.quarantined, NOW);
    assert.equal(r.ok, true);
    assert.equal(r.finding.status, 'open');
    assert.equal(FP.restoreFromQuarantine({ id: 'x' }).ok, false);
  });
});

describe('JSX parse check', () => {
  test('TriageRound2.jsx and FPManagement.jsx parse as valid JSX via esbuild', () => {
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
    for (const f of ['TriageRound2.jsx', 'FPManagement.jsx']) {
      const code = readFileSync(join(HERE, f), 'utf8');
      esbuild.transformSync(code, { loader: 'jsx' });
    }
  });
});

describe('self audits', () => {
  test('all 6 new wave-52 files exist', () => {
    for (const f of NEW_FILES) {
      assert.ok(existsSync(join(HERE, f)), `${f} is missing`);
    }
  });
  test('none of the 5 product files contain TODO/FIXME/XXX/mock/simulate/lorem/demo placeholder text', () => {
    const pattern = /\b(todo|fixme|xxx|hack|mock|simulate|lorem|demo)\b/i;
    for (const f of NEW_FILES.filter(x => x !== 'wave52.test.js')) {
      const content = readFileSync(join(HERE, f), 'utf8');
      const hit = content.match(pattern);
      assert.ok(!hit, `${f} contains debris marker: "${hit && hit[0]}"`);
    }
  });
  test('Wave52.css has zero @keyframes, transitions, and animations', () => {
    const css = readFileSync(join(HERE, 'Wave52.css'), 'utf8');
    assert.ok(!css.includes('@keyframes'), 'no @keyframes allowed');
    assert.ok(!/transition\s*:/i.test(css), 'no transitions allowed');
    assert.ok(!/animation\s*:/i.test(css), 'no animations allowed');
  });
  test('Wave52.css uses only scoped prefixes .tr2-* and .fp52-*', () => {
    const css = readFileSync(join(HERE, 'Wave52.css'), 'utf8');
    const classSelectors = css.match(/^\.[a-zA-Z][a-zA-Z0-9_-]*/gm) || [];
    const rogue = classSelectors.filter(c => !c.startsWith('.tr2-') && !c.startsWith('.fp52-'));
    assert.deepEqual(rogue, [], `unscoped selectors: ${rogue.join(', ')}`);
  });
  test('Infinity AI branding only — no other worker name in product files', () => {
    const productFiles = NEW_FILES.filter(f => f !== 'wave52.test.js');
    for (const f of productFiles) {
      const content = readFileSync(join(HERE, f), 'utf8');
      assert.ok(!/\b[mM]use\b/.test(content), `${f} mentions the forbidden worker name`);
    }
  });
});
