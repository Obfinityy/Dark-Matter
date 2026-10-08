/**
 * wave51.test.js — Infinity AI · Dark-Matter · Wave 51
 * Run: node --test frontend/src/components/hunt/wave51.test.js
 * Tests the two pure core modules only (no JSX imported here).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

import * as R3 from './mobileRound3Core.js';
import * as TR from './triageCore.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const NEW_FILES = [
  'mobileRound3Core.js',
  'triageCore.js',
  'MobileRound3.jsx',
  'TriageSuite.jsx',
  'Wave51.css',
  'wave51.test.js',
];
const NOW = 1700000000000; // fixed reference time for deterministic tests

describe('mobileRound3Core registry', () => {
  test('lists all 4 mobile round-3 ideas 52001–52004, zero skips', () => {
    assert.equal(R3.WAVE51_MR3_IDEAS.length, 4);
    const ids = R3.WAVE51_MR3_IDEAS.map(i => i.id);
    for (let id = 52001; id <= 52004; id++) assert.ok(ids.includes(id), `missing idea ${id}`);
    assert.equal(new Set(ids).size, 4, 'no duplicate ids');
    assert.ok(
      R3.WAVE51_MR3_IDEAS.every(i => i.title && i.title.length > 0),
      'every idea has a title'
    );
  });
});

describe('triageCore registry', () => {
  test('lists all 36 triage ideas 52005–52040, zero skips', () => {
    assert.equal(TR.WAVE51_TRIAGE_IDEAS.length, 36);
    const ids = TR.WAVE51_TRIAGE_IDEAS.map(i => i.id);
    for (let id = 52005; id <= 52040; id++) assert.ok(ids.includes(id), `missing idea ${id}`);
    assert.equal(new Set(ids).size, 36, 'no duplicate ids');
    assert.ok(
      TR.WAVE51_TRIAGE_IDEAS.every(i => i.title && i.title.length > 0),
      'every idea has a title'
    );
  });
});

describe('mobileRound3Core spot checks', () => {
  test('52001 pinning policy: match = secure, mismatch flagged, expiring cert warned', () => {
    const ok = R3.evaluatePinningPolicy(
      {
        host: 'api.example.com',
        pins: ['sha256/AAA'],
        presentedPin: 'sha256/AAA',
        certExpiresAt: NOW + 60 * 86400000,
      },
      NOW
    );
    assert.equal(ok.status, 'secure');
    assert.equal(ok.pinMatch, true);
    assert.equal(ok.expiresInDays, 60);
    assert.equal(ok.expiresSoon, false);
    const bad = R3.evaluatePinningPolicy(
      { host: 'api.example.com', pins: ['sha256/AAA'], presentedPin: 'sha256/ZZZ' },
      NOW
    );
    assert.equal(bad.status, 'pin-mismatch');
    const soon = R3.evaluatePinningPolicy(
      {
        host: 'api.example.com',
        pins: ['sha256/AAA'],
        presentedPin: 'sha256/AAA',
        certExpiresAt: NOW + 10 * 86400000,
      },
      NOW
    );
    assert.equal(soon.expiresSoon, true);
    assert.equal(soon.status, 'pin-ok-cert-expiring');
  });
  test('52001 storage encryption reports algorithm and plaintext fallback', () => {
    const enc = R3.evaluateStorageEncryption({ encrypted: true });
    assert.equal(enc.status, 'encrypted');
    assert.equal(enc.algorithm, 'AES-256-GCM');
    assert.equal(enc.atRest, true);
    const plain = R3.evaluateStorageEncryption({});
    assert.equal(plain.status, 'plaintext');
    assert.equal(plain.algorithm, null);
  });
  test('52002 update channels: stable always enrolled, beta opt-in', () => {
    const chans = R3.buildUpdateChannels();
    const stable = chans.find(c => c.id === 'stable');
    const beta = chans.find(c => c.id === 'beta');
    assert.equal(stable.optedIn, true);
    assert.equal(beta.optedIn, false);
    assert.equal(beta.optInRequired, true);
    const withBeta = R3.buildUpdateChannels(['beta']);
    assert.equal(withBeta.find(c => c.id === 'beta').optedIn, true);
  });
  test('52002 setChannelOptIn toggles beta, rejects stable', () => {
    const on = R3.setChannelOptIn([], 'beta', true);
    assert.equal(on.applied, true);
    assert.ok(on.optIns.includes('beta'));
    const off = R3.setChannelOptIn(['beta'], 'beta', false);
    assert.ok(!off.optIns.includes('beta'));
    const stable = R3.setChannelOptIn([], 'stable', true);
    assert.equal(stable.applied, false);
  });
  test('52003 usage analytics aggregates with zero identifiers retained', () => {
    const agg = R3.aggregateUsageAnalytics([
      { type: 'screen_view', screen: 'hunts', sessionId: 's1' },
      { type: 'screen_view', screen: 'findings', sessionId: 's1' },
      { type: 'feature_use', feature: 'swipe-triage', sessionId: 's1' },
      { type: 'session_end', sessionId: 's1', durationMs: 12 * 60000 },
      { type: 'screen_view', screen: 'hunts', sessionId: 's2' },
      { type: 'session_end', sessionId: 's2', durationMs: 6 * 60000 },
    ]);
    assert.equal(agg.events, 6);
    assert.equal(agg.sessions, 2);
    assert.equal(agg.screenViews.hunts, 2);
    assert.equal(agg.featureUses['swipe-triage'], 1);
    assert.equal(agg.avgSessionMinutes, 9);
    assert.equal(agg.privacySafe, true);
    assert.equal(agg.identifiersRetained, false);
  });
  test('52004 end-of-hunt summary counts severity and ranks top findings', () => {
    const s = R3.buildEndOfHuntSummary(
      {
        huntId: 'h-1',
        target: 'shop.example.com',
        status: 'completed',
        targets: 2,
        startedAt: NOW - 95 * 60000,
        reviewed: 5,
        findings: [
          { id: 'f1', title: 'SQLi', severity: 'critical' },
          { id: 'f2', title: 'XSS', severity: 'high' },
          { id: 'f3', title: 'Headers', severity: 'low' },
          { id: 'f4', title: 'Errors', severity: 'info' },
          { id: 'f5', title: 'CSRF', severity: 'medium' },
        ],
      },
      NOW
    );
    assert.equal(s.totals.findings, 5);
    assert.equal(s.totals.bySeverity.critical, 1);
    assert.equal(s.topFindings[0].severity, 'critical');
    assert.equal(s.durationMinutes, 95);
    assert.equal(s.reviewProgress, 100);
    assert.equal(s.wrapUp, true);
  });
});

describe('triageCore spot checks', () => {
  const SAMPLE = [
    {
      id: 'f1',
      title: 'Stored XSS in comment field',
      severity: 'high',
      vulnClass: 'xss',
      asset: 'web-app',
      exploitability: 0.8,
      confidence: 92,
      authRequired: false,
    },
    {
      id: 'f2',
      title: 'IDOR on /api/orders/{id}',
      severity: 'critical',
      vulnClass: 'idor',
      asset: 'api',
      exploitability: 0.9,
      confidence: 85,
      authRequired: true,
    },
    {
      id: 'f3',
      title: 'Open redirect on /login',
      severity: 'medium',
      vulnClass: 'open-redirect',
      asset: 'web-app',
      exploitability: 0.4,
      confidence: 70,
      authRequired: false,
    },
    {
      id: 'f4',
      title: 'Verbose error disclosure',
      severity: 'low',
      vulnClass: 'info-disclosure',
      asset: 'api',
      exploitability: 0.2,
      confidence: 60,
      authRequired: false,
    },
  ];

  test('52005 keyboard queue: j/k navigate, a/d/e decide, unknown key ignored', () => {
    const st = { items: SAMPLE.slice(0, 3), index: 0 };
    const moved = TR.applyKeyAction(st, 'j');
    assert.equal(moved.index, 1);
    const accepted = TR.applyKeyAction(moved, 'a');
    assert.equal(accepted.items[1].triage, 'accepted');
    const dismissed = TR.applyKeyAction(st, 'd');
    assert.equal(dismissed.items[0].triage, 'dismissed');
    const read = TR.applyKeyAction(st, 'r');
    assert.equal(read.items[0].read, true);
    const bad = TR.applyKeyAction(st, 'z');
    assert.equal(bad.applied, false);
    const top = TR.applyKeyAction({ items: SAMPLE.slice(0, 1), index: 0 }, 'k');
    assert.equal(top.index, 0);
  });
  test('52006 blended score ranks critical first', () => {
    assert.equal(
      TR.blendedTriageScore({ severity: 'critical', exploitability: 1, confidence: 100 }),
      1
    );
    const ranked = TR.rankInbox(SAMPLE);
    assert.equal(ranked[0].id, 'f2');
    assert.ok(ranked[0].triageScore >= ranked[3].triageScore);
  });
  test('52007 reading card expands through stages, rejects bad stage', () => {
    const card = TR.buildReadingCard({ id: 'f1', title: 'XSS' });
    assert.equal(card.stage, 'collapsed');
    assert.equal(card.stages.length, 5);
    assert.equal(TR.expandCard(card, 'evidence').stage, 'evidence');
    assert.equal(TR.expandCard(card, 'bogus').stage, 'collapsed');
  });
  test('52008 vuln-class groups collapse instances, biggest first', () => {
    const groups = TR.groupByVulnClass([
      ...SAMPLE,
      { id: 'f5', title: 'Reflected XSS', vulnClass: 'xss' },
    ]);
    assert.equal(groups[0].vulnClass, 'xss');
    assert.equal(groups[0].count, 2);
  });
  test('52009 asset groups pivot the inbox by asset', () => {
    const groups = TR.groupByAsset(SAMPLE);
    assert.equal(groups[0].asset, 'web-app');
    assert.equal(groups[0].count, 2);
    assert.equal(groups[1].asset, 'api');
  });
  test('52010 evidence preview inlines and caps HTTP pairs at 3', () => {
    const p = TR.buildEvidencePreview({
      id: 'f1',
      httpExchanges: [1, 2, 3, 4].map(n => ({ request: `REQ ${n}`, response: `RES ${n}` })),
      screenshots: ['a.png'],
    });
    assert.equal(p.inline, true);
    assert.equal(p.http.length, 3);
    assert.equal(p.counts.http, 4);
  });
  test('52011 extractive TL;DR picks two sentences, handles empty text', () => {
    const t = TR.buildExtractiveTldr({
      id: 'f2',
      description:
        'The /api/orders/{id} endpoint returns order records for any authenticated user. It does not verify that the order belongs to the requesting user. An attacker can enumerate order IDs and read other customers\u2019 orders. Fix by adding an ownership check before returning the record.',
    });
    assert.equal(t.findingId, 'f2');
    assert.equal(t.sentences, 2);
    assert.ok(t.tldr.includes('order records'));
    const empty = TR.buildExtractiveTldr({ id: 'f9' });
    assert.equal(empty.sentences, 0);
  });
  test('52012 markRead tracks progress with a persistent label', () => {
    const st = TR.markRead([], 'f1', 4);
    assert.equal(st.readCount, 1);
    assert.equal(st.label, '1 of 4 reviewed');
    assert.equal(st.reviewed, 25);
    const again = TR.markRead(st.read, 'f1', 4);
    assert.equal(again.readCount, 1, 're-reading does not double count');
  });
  test('52013 saved filters persist and filter by criteria', () => {
    const filters = TR.saveFilter([], 'criticals', { severity: 'critical' });
    assert.equal(filters.length, 1);
    assert.equal(filters[0].name, 'criticals');
    const matched = TR.applySavedFilter(SAMPLE, filters[0]);
    assert.equal(matched.length, 1);
    assert.equal(matched[0].id, 'f2');
    const none = TR.applySavedFilter(SAMPLE, {
      criteria: { severity: 'critical', authRequired: false },
    });
    assert.equal(none.length, 0);
  });
  test('52014 checklist blocks review until every item is ticked', () => {
    let cl = TR.buildChecklist();
    assert.equal(cl.length, 4);
    assert.equal(TR.canMarkReviewed(cl), false);
    for (const it of cl) cl = TR.toggleChecklistItem(cl, it.label);
    assert.equal(TR.canMarkReviewed(cl), true);
  });
  test('52015 confidence badge bands with top-two reasons', () => {
    const hi = TR.confidenceBadge({ confidence: 92, confidenceReasons: ['a', 'b', 'c'] });
    assert.equal(hi.band, 'High');
    assert.equal(hi.reasons.length, 2);
    assert.equal(TR.confidenceBadge({ confidence: 31 }).band, 'Low');
    assert.equal(TR.confidenceBadge({ confidence: 64 }).band, 'Medium');
  });
  test('52016 evidence flag round-trips: flag then resolve', () => {
    const flagged = TR.flagForEvidence({ id: 'f4' }, 'thin evidence', NOW);
    assert.equal(flagged.evidenceStatus, 'needs-evidence');
    assert.equal(flagged.evidenceFlag.resolved, false);
    assert.ok(typeof flagged.evidenceFlag.flaggedAt === 'string');
    const resolved = TR.resolveEvidenceFlag(flagged, NOW);
    assert.equal(resolved.evidenceStatus, 'gathered');
    assert.equal(resolved.evidenceFlag.resolved, true);
  });
  test('52017 similar findings rank same-class first', () => {
    const r = TR.findSimilar(
      {
        id: 'f1',
        title: 'Stored XSS in comment field',
        vulnClass: 'xss',
        asset: 'web-app',
        severity: 'high',
      },
      [
        {
          id: 'p1',
          title: 'XSS in search box',
          vulnClass: 'xss',
          asset: 'web-app',
          severity: 'high',
        },
        {
          id: 'p2',
          title: 'SQLi in login',
          vulnClass: 'sqli',
          asset: 'web-app',
          severity: 'critical',
        },
        {
          id: 'p3',
          title: 'XSS in profile bio',
          vulnClass: 'xss',
          asset: 'api',
          severity: 'medium',
        },
      ]
    );
    assert.equal(r.similar[0].finding.id, 'p1');
    assert.equal(r.similar[0].score, 6);
    assert.equal(r.count, 3);
  });
  test('52018 dwell timer averages per finding and per reviewer', () => {
    let sessions = [];
    sessions = TR.recordDwell(sessions, 'f1', 100, 'aria');
    sessions = TR.recordDwell(sessions, 'f1', 200, 'aria');
    sessions = TR.recordDwell(sessions, 'f2', 300, 'kai');
    const agg = TR.teamAverages(sessions);
    assert.equal(agg.overallAvgSeconds, 200);
    assert.equal(agg.perReviewer.aria, 150);
    assert.equal(agg.perReviewer.kai, 300);
    assert.equal(agg.perFinding.f1, 150);
    assert.equal(agg.samples, 3);
  });
  test('52019 hover bar exposes four one-click actions', () => {
    const actions = TR.hoverActions({ id: 'f2' });
    assert.equal(actions.length, 4);
    assert.deepEqual(
      actions.map(a => a.id),
      ['accept', 'false-positive', 'escalate', 'assign']
    );
    assert.ok(actions.every(a => a.findingId === 'f2' && a.enabled));
  });
  test('52020 delegation reassigns with an audit trail', () => {
    const d = TR.delegateFindings([{ id: 'f3' }, { id: 'f4' }], 'aria', 'check f3', NOW);
    assert.equal(d.assignee, 'aria');
    assert.deepEqual(d.findingIds, ['f3', 'f4']);
    assert.equal(d.audit.length, 2);
    assert.equal(d.audit[0].to, 'aria');
    assert.ok(typeof d.delegatedAt === 'string');
  });
  test('52021 exploitability sort puts most exploitable first', () => {
    const sorted = TR.sortByExploitability(SAMPLE);
    assert.equal(sorted[0].id, 'f2');
    assert.equal(sorted[3].id, 'f4');
  });
  test('52022 EPSS badges band the percentile', () => {
    assert.equal(TR.epssBadge(95).band, 'top-10%');
    assert.equal(TR.epssBadge(95).label, 'EPSS p95 · top-10%');
    assert.equal(TR.epssBadge(60).band, 'medium');
    assert.equal(TR.epssBadge(20).band, 'low');
  });
  test('52023 sensitivity badges flag payment data as high', () => {
    const pay = TR.sensitivityBadge({
      title: 'IDOR exposes order records with card numbers',
      description: 'Order API leaks card data',
    });
    assert.ok(pay.badges.includes('Payment data'));
    assert.equal(pay.level, 'high');
    const clean = TR.sensitivityBadge({
      title: 'Verbose error disclosure',
      description: 'Stack traces only',
    });
    assert.equal(clean.level, 'none');
    assert.equal(clean.badges.length, 0);
  });
  test('52024 regulatory tags map card data to PCI DSS, health to HIPAA', () => {
    const pci = TR.regulatoryTags({ title: 'Card numbers exposed', description: 'payment data' });
    assert.ok(pci.tags.includes('PCI DSS'));
    const hipaa = TR.regulatoryTags({
      title: 'Patient portal records',
      description: 'health data exposed',
    });
    assert.ok(hipaa.tags.includes('HIPAA'));
    assert.equal(TR.regulatoryTags({ title: 'Banner leak' }).count, 0);
  });
  test('52025 reading-time label is human-friendly', () => {
    const rt = TR.estimateReadingTime({ title: 'x', description: 'one two three' });
    assert.equal(rt.words, 4);
    assert.equal(rt.minutes, 1);
    assert.match(rt.label, /^≈\d+ min review$/);
  });
  test('52026 focus spec hides chrome, keeps evidence', () => {
    const spec = TR.buildFocusSpec({ id: 'f2' });
    assert.equal(spec.chrome, 'minimal');
    assert.ok(spec.hidden.includes('sidebar'));
    assert.ok(spec.visible.includes('evidence'));
  });
  test('52027 swipe reducer accepts/dismisses/escalates, rejects bad gesture', () => {
    const ok = TR.reduceSwipe([{ id: 'f1' }], { findingId: 'f1', swipe: 'swipe-right' });
    assert.equal(ok.applied, true);
    assert.equal(ok.queue[0].triage, 'accepted');
    assert.equal(ok.decision.decision, 'accepted');
    assert.equal(ok.remaining, 0);
    const up = TR.reduceSwipe([{ id: 'f1' }], { findingId: 'f1', swipe: 'swipe-up' });
    assert.equal(up.queue[0].triage, 'escalated');
    const bad = TR.reduceSwipe([{ id: 'f1' }], { findingId: 'f1', swipe: 'swipe-down' });
    assert.equal(bad.applied, false);
  });
  test('52028 voice note attaches with transcript and duration', () => {
    const f = TR.attachVoiceNote({}, 'recheck the sink', 14, NOW);
    assert.equal(f.voiceNoteCount, 1);
    assert.equal(f.voiceNotes[0].transcript, 'recheck the sink');
    assert.equal(f.voiceNotes[0].durationSeconds, 14);
    assert.ok(typeof f.voiceNotes[0].recordedAt === 'string');
  });
  test('52029 comments thread with line anchor and mentions', () => {
    const f = TR.addComment(
      {},
      { author: 'aria', body: 'confirm sink', lineRef: 'response:14', mentions: ['kai'] },
      NOW
    );
    assert.equal(f.commentCount, 1);
    assert.deepEqual(f.comments[0].mentions, ['kai']);
    assert.equal(f.comments[0].lineRef, 'response:14');
  });
  test('52030 SLA countdown shows remaining time and breach', () => {
    const ok = TR.slaCountdown(
      { id: 'f2', severity: 'critical', openedAt: NOW - 3600000 },
      null,
      NOW
    );
    assert.equal(ok.breached, false);
    assert.equal(ok.display, '3h 0m left');
    assert.equal(ok.slaHours, 4);
    const breached = TR.slaCountdown(
      { id: 'f4', severity: 'low', openedAt: NOW - 200 * 3600000 },
      null,
      NOW
    );
    assert.equal(breached.breached, true);
    assert.match(breached.display, /^breached by /);
  });
  test('52031 priority rules auto-tag matching findings', () => {
    const rules = [
      { id: 'rule-auth-bypass', priority: 'P0', when: { vulnClass: 'idor', authRequired: true } },
      { id: 'rule-xss', priority: 'P2', when: { vulnClass: 'xss' } },
    ];
    const routed = TR.applyPriorityRules(SAMPLE, rules);
    const f2 = routed.find(f => f.id === 'f2');
    assert.equal(f2.autoPriority, 'P0');
    assert.ok(f2.matchedRules.includes('rule-auth-bypass'));
    assert.equal(routed.find(f => f.id === 'f1').autoPriority, 'P2');
    assert.equal(routed.find(f => f.id === 'f4').autoPriority, null);
  });
  test('52032 column spec builds and reorders columns', () => {
    const spec = TR.buildColumnSpec([
      { id: 'owner', label: 'Owner', width: 120 },
      { id: 'sla', label: 'SLA' },
      { id: 'asset', label: 'Asset', width: 500 },
    ]);
    assert.equal(spec.count, 3);
    assert.equal(spec.columns[1].width, 140);
    const moved = TR.reorderColumns(spec, 0, 2);
    assert.equal(moved.columns[0].id, 'sla');
    assert.equal(moved.columns[2].id, 'owner');
    assert.equal(moved.columns[2].order, 2);
  });
  test('52033 pinned findings sort first and unpin cleanly', () => {
    const pinned = TR.pinFinding([], 'f3');
    assert.deepEqual(pinned, ['f3']);
    const ordered = TR.pinnedFirst(SAMPLE, pinned);
    assert.equal(ordered[0].id, 'f3');
    assert.deepEqual(TR.unpinFinding(['f3', 'f1'], 'f3'), ['f1']);
  });
  test('52034 starring toggles without touching triage state', () => {
    const on = TR.starFinding([], 'f1');
    assert.equal(on.starredNow, true);
    assert.deepEqual(on.starred, ['f1']);
    const off = TR.starFinding(on.starred, 'f1');
    assert.equal(off.starredNow, false);
    assert.deepEqual(off.starred, []);
  });
  test('52035 handoff note captures progress and open questions', () => {
    const h = TR.buildHandoff(
      {
        from: 'aria',
        to: 'kai',
        findings: [
          { id: 'f1', triage: 'accepted' },
          { id: 'f2' },
          { id: 'f3', triage: 'dismissed' },
        ],
        summary: 'f2 still needs a verdict.',
        openQuestions: ['Is /api/orders/{id} rate-limited?'],
      },
      NOW
    );
    assert.deepEqual(h.progress, { total: 3, triaged: 2, remaining: 1 });
    assert.deepEqual(h.findingIds, ['f1', 'f2', 'f3']);
    assert.equal(h.openQuestions.length, 1);
  });
  test('52036 severity override requires a reason and keeps an audit log', () => {
    const ok = TR.overrideSeverity(
      { id: 'f3', severity: 'medium' },
      'high',
      'confirmed chain',
      'aria',
      NOW
    );
    assert.equal(ok.overrideApplied, true);
    assert.equal(ok.severity, 'high');
    assert.equal(ok.severityAudit.length, 1);
    assert.equal(ok.severityAudit[0].from, 'medium');
    assert.equal(ok.severityAudit[0].to, 'high');
    const denied = TR.overrideSeverity({ severity: 'medium' }, 'high', '   ', 'aria', NOW);
    assert.equal(denied.overrideApplied, false);
    assert.ok(denied.overrideError.length > 0);
  });
  test('52037 CVSS 3.1 calculator matches official reference scores', () => {
    const rce = TR.cvss31Score({
      av: 'N',
      ac: 'L',
      pr: 'N',
      ui: 'N',
      scope: 'U',
      c: 'H',
      i: 'H',
      a: 'H',
    });
    assert.equal(rce.score, 9.8);
    assert.equal(rce.severity, 'critical');
    assert.equal(rce.vector, 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H');
    const xss = TR.cvss31Score({
      av: 'N',
      ac: 'L',
      pr: 'N',
      ui: 'R',
      scope: 'C',
      c: 'L',
      i: 'L',
      a: 'N',
    });
    assert.equal(xss.score, 6.1);
    assert.equal(xss.severity, 'medium');
    const none = TR.cvss31Score({
      av: 'L',
      ac: 'H',
      pr: 'N',
      ui: 'R',
      scope: 'U',
      c: 'N',
      i: 'N',
      a: 'N',
    });
    assert.equal(none.score, 0);
    assert.equal(none.severity, 'none');
  });
  test('52038 impact estimator answers three questions plainly', () => {
    const crit = TR.estimateImpact({
      dataExposed: true,
      authRequired: false,
      userInteraction: false,
    });
    assert.equal(crit.level, 'critical');
    assert.match(crit.statement, /Critical impact/);
    const low = TR.estimateImpact({
      dataExposed: false,
      authRequired: true,
      userInteraction: false,
    });
    assert.equal(low.level, 'low');
    const unauth = TR.estimateImpact({
      dataExposed: false,
      authRequired: false,
      userInteraction: false,
    });
    assert.equal(unauth.level, 'medium', 'unauthenticated reachability is medium, not low');
    assert.deepEqual(crit.answers, {
      dataExposed: true,
      authRequired: false,
      userInteraction: false,
    });
  });
  test('52039 affected-user estimate derives exposure from traffic hints', () => {
    const r = TR.estimateAffectedUsers({
      id: 'f2',
      authRequired: true,
      traffic: { dailyUsers: 20000, exposedRatio: 0.5 },
    });
    assert.equal(r.estimatedUsers, 10000);
    assert.equal(r.band, 'large');
    assert.equal(r.label, '≈10,000 users exposed');
    const unknown = TR.estimateAffectedUsers({});
    assert.equal(unknown.estimatedUsers, 0);
    assert.equal(unknown.band, 'unknown');
    assert.equal(unknown.label, 'exposure unknown');
  });
  test('52040 session autosave round-trips filters, scroll, and cards', () => {
    const session = {
      filters: { severity: 'high' },
      scrollPosition: 420,
      openCards: ['f1'],
      readIds: ['f4'],
      queueIndex: 2,
    };
    const saved = TR.autosaveSession(session, NOW);
    assert.equal(saved.version, 1);
    assert.ok(typeof saved.savedAt === 'string');
    const restored = TR.restoreSession(saved);
    assert.equal(restored.restored, true);
    assert.equal(restored.scrollPosition, 420);
    assert.equal(restored.queueIndex, 2);
    assert.deepEqual(restored.readIds, ['f4']);
    assert.equal(TR.restoreSession({}).restored, false);
  });
});

describe('JSX parse check', () => {
  test('MobileRound3.jsx and TriageSuite.jsx parse as valid JSX via esbuild', () => {
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
    for (const f of ['MobileRound3.jsx', 'TriageSuite.jsx']) {
      const code = readFileSync(join(HERE, f), 'utf8');
      esbuild.transformSync(code, { loader: 'jsx' });
    }
  });
});

describe('self audits', () => {
  test('all 6 new wave-51 files exist', () => {
    for (const f of NEW_FILES) {
      assert.ok(existsSync(join(HERE, f)), `${f} is missing`);
    }
  });
  test('none of the 5 product files contain TODO/FIXME/XXX/mock/simulate/lorem/demo placeholder text', () => {
    const pattern = /\b(todo|fixme|xxx|hack|mock|simulate|lorem|demo)\b/i;
    for (const f of NEW_FILES.filter(x => x !== 'wave51.test.js')) {
      const content = readFileSync(join(HERE, f), 'utf8');
      const hit = content.match(pattern);
      assert.ok(!hit, `${f} contains debris marker: "${hit && hit[0]}"`);
    }
  });
  test('Wave51.css has zero @keyframes, transitions, and animations', () => {
    const css = readFileSync(join(HERE, 'Wave51.css'), 'utf8');
    assert.ok(!css.includes('@keyframes'), 'no @keyframes allowed');
    assert.ok(!/transition\s*:/i.test(css), 'no transitions allowed');
    assert.ok(!/animation\s*:/i.test(css), 'no animations allowed');
  });
  test('Wave51.css uses only scoped prefixes .mr3-* and .tr51-*', () => {
    const css = readFileSync(join(HERE, 'Wave51.css'), 'utf8');
    const classSelectors = css.match(/^\.[a-zA-Z][a-zA-Z0-9_-]*/gm) || [];
    const rogue = classSelectors.filter(c => !c.startsWith('.mr3-') && !c.startsWith('.tr51-'));
    assert.deepEqual(rogue, [], `unscoped selectors: ${rogue.join(', ')}`);
  });
  test('Infinity AI branding only — no other worker name in product files', () => {
    const productFiles = NEW_FILES.filter(f => f !== 'wave51.test.js');
    for (const f of productFiles) {
      const content = readFileSync(join(HERE, f), 'utf8');
      assert.ok(!/\b[mM]use\b/.test(content), `${f} mentions the forbidden worker name`);
    }
  });
});
