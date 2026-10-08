/**
 * wave69.test.js — Infinity AI · Dark-Matter · Wave 69
 * node:test + node:assert/strict. Registry coverage (20/20 for 52721–52740,
 * 20/20 for 52741–52760, zero skips, 40/40 combined), registry titles matched
 * against the idea bank, deterministic spot-checks of every pure function
 * (at least one assertion per idea), a JSX↔core call-shape audit (every
 * exported component calls ≥1 exported core function), Wave69.css
 * scope/zero-animation audits, a real esbuild JSX parse audit, a
 * no-branding-leak audit ("Infinity AI" only) and a no-debris audit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WAVE69_A_IDEAS } from './wave69ACore.js';
import * as EA from './wave69ACore.js';
import { WAVE69_B_IDEAS } from './wave69BCores.js';
import * as EB from './wave69BCores.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const CSS = join(DIR, 'Wave69.css');
const A_SRC = readFileSync(join(DIR, 'wave69ACore.js'), 'utf8');
const B_SRC = readFileSync(join(DIR, 'wave69BCores.js'), 'utf8');
const A_JSX = readFileSync(join(DIR, 'Wave69A.jsx'), 'utf8');
const B_JSX = readFileSync(join(DIR, 'Wave69B.jsx'), 'utf8');
const CSS_SRC = readFileSync(CSS, 'utf8');
const BRAND_SRC = [['A core', A_SRC], ['B core', B_SRC], ['A jsx', A_JSX], ['B jsx', B_JSX], ['css', CSS_SRC]];
const NOW = '2026-10-09T00:00:00Z';

/* ---- Registry coverage: 20/20 + 20/20, zero skips ---- */
test('registry: 20/20 lifecycle part 1 ideas, 20/20 part 2 ideas, zero skips', () => {
  assert.equal(WAVE69_A_IDEAS.length, 20);
  assert.equal(WAVE69_B_IDEAS.length, 20);
  const all = [...WAVE69_A_IDEAS, ...WAVE69_B_IDEAS];
  assert.equal(all.length, 40);
  const ids = all.map(i => i.id);
  assert.deepEqual(ids, Array.from({ length: 40 }, (_, k) => 52721 + k));
  for (const idea of all) {
    assert.equal(idea.skip, false, `idea ${idea.id} skipped`);
    assert.ok(idea.title && idea.title.length > 3, `idea ${idea.id} missing title`);
  }
});

test('registry: titles match idea-bank wording', () => {
  const byId = Object.fromEntries([...WAVE69_A_IDEAS, ...WAVE69_B_IDEAS].map(i => [i.id, i.title.toLowerCase()]));
  assert.ok(byId[52721].includes('bulk transitions'));
  assert.ok(byId[52722].includes('sla'));
  assert.ok(byId[52723].includes('kanban'));
  assert.ok(byId[52724].includes('timeline'));
  assert.ok(byId[52725].includes('required transition reasons'));
  assert.ok(byId[52726].includes('undo window'));
  assert.ok(byId[52727].includes('"awaiting info"'));
  assert.ok(byId[52727].includes('parking state'));
  assert.ok(byId[52728].includes('duplicate-linking'));
  assert.ok(byId[52729].includes('risk-acceptance'));
  assert.ok(byId[52730].includes('deferred-to-date'));
  assert.ok(byId[52731].includes('blocked-on-vendor'));
  assert.ok(byId[52732].includes('verified vs closed'));
  assert.ok(byId[52733].includes('reopened-with-context'));
  assert.ok(byId[52734].includes('retest-driven'));
  assert.ok(byId[52735].includes('webhooks'));
  assert.ok(byId[52736].includes('rest api'));
  assert.ok(byId[52737].includes('smart state views'));
  assert.ok(byId[52738].includes('state-triggered emails'));
  assert.ok(byId[52740].includes('aging analytics'));
  assert.ok(byId[52741].includes('escalation chains'));
  assert.ok(byId[52742].includes('approval queues'));
  assert.ok(byId[52744].includes('funnel analytics'));
  assert.ok(byId[52745].includes('severity-aware'));
  assert.ok(byId[52746].includes('terminal-state'));
  assert.ok(byId[52747].includes('next-state suggestions'));
  assert.ok(byId[52748].includes('checklists'));
  assert.ok(byId[52749].includes('action gating'));
  assert.ok(byId[52750].includes('mobile transition approvals'));
  assert.ok(byId[52751].includes('documentation generator'));
  assert.ok(byId[52752].includes('time-to-close'));
  assert.ok(byId[52753].includes('priority boost'));
  assert.ok(byId[52754].includes('two-way sync'));
  assert.ok(byId[52757].includes('diagram renderer'));
  assert.ok(byId[52758].includes('csv state import'));
  assert.ok(byId[52759].includes('state-remap'));
  assert.ok(byId[52760].includes('preserved states on archive'));
});

/* ---- Wave69 A spot checks (52721–52740) ---- */
test('52721 previewBulkTransition: ready, terminal, already-in-state', () => {
  const v = EA.previewBulkTransition([
    { id: 'f1', status: 'new' },
    { id: 'f2', status: 'closed' },
    { id: 'f3', status: 'triaged' },
  ], 'triaged', { id: 'lead-1', role: 'lead' });
  assert.equal(v.total, 3);
  assert.equal(v.okCount, 1);
  assert.equal(v.blockedCount, 2);
  assert.equal(v.preview[0].ok, true);
  assert.ok(v.preview[1].reason.includes('terminal'));
  assert.ok(v.summary.includes('Infinity AI'));
  const bad = EA.previewBulkTransition([{ id: 'f1', status: 'new' }], 'bogus-state');
  assert.equal(bad.okCount, 0);
});

test('52722 evaluateStateSla: age, breach, remaining', () => {
  const v = EA.evaluateStateSla([
    { id: 'f9', status: 'fixing', severity: 'high', stateEnteredAt: '2026-10-08T00:00:00Z', slaHours: 12 },
  ], NOW);
  assert.equal(v.total, 1);
  assert.equal(v.items[0].ageHours, 24);
  assert.equal(v.items[0].remainingHours, -12);
  assert.equal(v.items[0].breached, true);
  assert.deepEqual(v.breachedIds, ['f9']);
  assert.equal(v.breachedCount, 1);
});

test('52723 buildLifecycleBoard: columns grouped and severity ordered', () => {
  const v = EA.buildLifecycleBoard([
    { id: 'f1', status: 'new', severity: 'low', riskScore: 10 },
    { id: 'f2', status: 'new', severity: 'critical', riskScore: 90 },
    { id: 'f3', status: 'closed', severity: 'medium', riskScore: 30 },
  ]);
  assert.equal(v.columnCount, 15);
  assert.equal(v.total, 3);
  assert.equal(v.countsByState.new, 2);
  assert.equal(v.countsByState.closed, 1);
  const fresh = v.columns.find(c => c.state === 'new');
  assert.deepEqual(fresh.findings, ['f2', 'f1']);
  assert.equal(fresh.criticals, 1);
});

test('52724 buildStateTimeline: sorted events with dwell', () => {
  const v = EA.buildStateTimeline({
    id: 'f5', status: 'closed',
    history: [
      { from: 'triaged', to: 'confirmed', actor: 'lead-1', at: '2026-10-01T06:00:00Z', reason: 'reproduced' },
      { from: 'new', to: 'triaged', actor: 'analyst-1', at: '2026-10-01T00:00:00Z', reason: 'intake' },
    ],
  });
  assert.equal(v.findingId, 'f5');
  assert.equal(v.eventCount, 2);
  assert.equal(v.events[0].to, 'triaged');
  assert.equal(v.events[0].durationHours, 6);
  assert.equal(v.events[1].durationHours, null);
  assert.deepEqual(v.statesVisited, ['triaged', 'confirmed']);
  assert.equal(v.currentState, 'closed');
});

test('52725 validateTransitionReason: required targets gated', () => {
  const no = EA.validateTransitionReason('confirmed', 'dismissed', '');
  assert.equal(no.allowed, false);
  assert.equal(no.required, true);
  assert.ok(no.message.includes('requires a reason'));
  const yes = EA.validateTransitionReason('confirmed', 'dismissed', 'Duplicate coverage exists');
  assert.equal(yes.allowed, true);
  const free = EA.validateTransitionReason('new', 'triaged', '');
  assert.equal(free.allowed, true);
  assert.equal(free.required, false);
});

test('52726 evaluateUndoWindow: inside and outside window', () => {
  const v = EA.evaluateUndoWindow({ at: '2026-10-09T00:00:00Z' }, '2026-10-09T00:10:00Z', 30);
  assert.equal(v.undoable, true);
  assert.equal(v.elapsedMinutes, 10);
  assert.equal(v.remainingMinutes, 20);
  assert.equal(v.expiresAt, '2026-10-09T00:30:00.000Z');
  const late = EA.evaluateUndoWindow({ at: '2026-10-09T00:00:00Z' }, '2026-10-09T01:00:00Z', 30);
  assert.equal(late.undoable, false);
  assert.equal(late.remainingMinutes, 0);
});

test('52727 parkFindingForInfo: parks without mutating, terminal refused', () => {
  const src = { id: 'f2', status: 'fixing', history: [] };
  const v = EA.parkFindingForInfo(src, { actor: 'lead-1', at: NOW, infoRequested: 'Need staging credentials' });
  assert.equal(v.ok, true);
  assert.equal(v.finding.status, 'awaiting-info');
  assert.equal(v.previousState, 'fixing');
  assert.equal(src.status, 'fixing');
  assert.equal(v.finding.history.length, 1);
  const term = EA.parkFindingForInfo({ id: 'f5', status: 'closed', history: [] }, { actor: 'lead-1', at: NOW });
  assert.equal(term.ok, false);
});

test('52728 linkDuplicateFinding: links canonical, self refused', () => {
  const src = { id: 'f3', status: 'new', history: [] };
  const v = EA.linkDuplicateFinding(src, { id: 'f1' }, { actor: 'lead-1', at: NOW });
  assert.equal(v.ok, true);
  assert.equal(v.finding.status, 'duplicate');
  assert.equal(v.canonicalId, 'f1');
  assert.equal(v.finding.canonicalId, 'f1');
  assert.equal(src.status, 'new');
  const self = EA.linkDuplicateFinding({ id: 'f1', status: 'new' }, { id: 'f1' });
  assert.equal(self.ok, false);
});

test('52729 acceptRiskWithExpiry: future accepted, past refused', () => {
  const src = { id: 'f2', status: 'confirmed', history: [] };
  const v = EA.acceptRiskWithExpiry(src, { acceptedBy: 'director', expiresAt: '2026-11-01T00:00:00Z', nowIso: NOW, actor: 'director', at: NOW });
  assert.equal(v.ok, true);
  assert.equal(v.expired, false);
  assert.equal(v.finding.status, 'risk-accepted');
  assert.equal(v.finding.riskExpiresAt, '2026-11-01T00:00:00Z');
  const past = EA.acceptRiskWithExpiry(src, { acceptedBy: 'director', expiresAt: '2026-10-01T00:00:00Z', nowIso: NOW });
  assert.equal(past.ok, false);
  assert.equal(past.expired, true);
  const missing = EA.acceptRiskWithExpiry(src, { acceptedBy: 'director', nowIso: NOW });
  assert.equal(missing.ok, false);
});

test('52730 deferFindingToDate: future deferred, past due', () => {
  const src = { id: 'f3', status: 'new', history: [] };
  const v = EA.deferFindingToDate(src, { deferredUntil: '2026-10-20T00:00:00Z', nowIso: NOW, actor: 'lead-1', at: NOW });
  assert.equal(v.ok, true);
  assert.equal(v.finding.status, 'deferred');
  assert.equal(v.dueForReview, false);
  const due = EA.deferFindingToDate(src, { deferredUntil: '2026-10-01T00:00:00Z', nowIso: NOW, actor: 'lead-1', at: NOW });
  assert.equal(due.dueForReview, true);
  const bad = EA.deferFindingToDate(src, { nowIso: NOW });
  assert.equal(bad.ok, false);
});

test('52731 blockFindingOnVendor: ticket required', () => {
  const src = { id: 'f2', status: 'fixing', history: [] };
  const v = EA.blockFindingOnVendor(src, { vendorTicket: 'VND-441', vendor: 'PaymentsCo', actor: 'lead-1', at: NOW });
  assert.equal(v.ok, true);
  assert.equal(v.finding.status, 'blocked-vendor');
  assert.equal(v.finding.vendorTicket, 'VND-441');
  const no = EA.blockFindingOnVendor(src, { actor: 'lead-1', at: NOW });
  assert.equal(no.ok, false);
  assert.ok(no.error.includes('vendor ticket'));
});

test('52732 evaluateVerifiedVsClosed: separation and unverified closures', () => {
  const v = EA.evaluateVerifiedVsClosed([
    { id: 'f4', status: 'verified', verifiedBy: 'verifier-1', history: [] },
    { id: 'f5', status: 'closed', verifiedBy: 'verifier-1', history: [] },
    { id: 'f6', status: 'closed', history: [] },
  ]);
  assert.deepEqual(v.verifiedNotClosed, ['f4']);
  assert.deepEqual(v.closedWithoutVerification, ['f6']);
  assert.equal(v.verifiedCount, 1);
  assert.equal(v.closedCount, 2);
  assert.equal(v.needsClosureCount, 1);
});

test('52733 reopenFindingWithContext: context preserved, wrong state refused', () => {
  const src = { id: 'f5', status: 'closed', fixNote: 'PR #60', verificationEvidence: 'retest passed', verifiedBy: 'verifier-1', closedBy: 'lead-1', history: [{ from: 'verified', to: 'closed', actor: 'lead-1', at: '2026-10-06T09:00:00Z', reason: 'done' }] };
  const v = EA.reopenFindingWithContext(src, { actor: 'verifier-1', at: NOW, reason: 'Regression found' });
  assert.equal(v.ok, true);
  assert.equal(v.finding.status, 'reopened');
  assert.equal(v.previousState, 'closed');
  assert.equal(v.preservedContext.fixNote, 'PR #60');
  assert.equal(v.preservedContext.historyLength, 1);
  assert.equal(src.status, 'closed');
  const no = EA.reopenFindingWithContext({ id: 'f3', status: 'new', history: [] }, { actor: 'a', at: NOW });
  assert.equal(no.ok, false);
});

test('52734 applyRetestResult: pass verifies, fail reopens', () => {
  const src = { id: 'f1', status: 'verifying', evidence: ['initial'], history: [] };
  const pass = EA.applyRetestResult(src, { outcome: 'passed', at: NOW, actor: 'verifier-1', evidence: 'retest passed' });
  assert.equal(pass.ok, true);
  assert.equal(pass.changed, true);
  assert.equal(pass.to, 'verified');
  assert.equal(pass.finding.verifiedBy, 'verifier-1');
  assert.equal(pass.finding.evidence.length, 2);
  assert.equal(src.status, 'verifying');
  const fail = EA.applyRetestResult(src, { outcome: 'failed', at: NOW, actor: 'verifier-1', evidence: 'still exploitable' });
  assert.equal(fail.to, 'reopened');
  const idle = EA.applyRetestResult({ id: 'f3', status: 'new', history: [] }, { outcome: 'passed', at: NOW, actor: 'v' });
  assert.equal(idle.ok, false);
  assert.equal(idle.changed, false);
});

test('52735 buildTransitionWebhooks: filtered signed-reference payloads', () => {
  const v = EA.buildTransitionWebhooks([
    { findingId: 'f1', from: 'verifying', to: 'verified', actor: 'verifier-1', at: NOW },
    { findingId: 'f2', from: 'new', to: 'triaged', actor: 'analyst-1', at: NOW },
  ], { url: 'https://hooks.example.com/lifecycle', states: ['verified'] });
  assert.equal(v.count, 1);
  assert.equal(v.endpoint, 'https://hooks.example.com/lifecycle');
  assert.equal(v.webhooks[0].event, 'finding.verified');
  assert.equal(v.webhooks[0].source, 'Infinity AI');
  assert.ok(v.webhooks[0].id.startsWith('wh_'));
});

test('52736 buildLifecycleApiResponse: filter, sort, paginate', () => {
  const rows = [
    { id: 'f1', title: 'A', severity: 'critical', status: 'new' },
    { id: 'f2', title: 'B', severity: 'high', status: 'fixing' },
    { id: 'f3', title: 'C', severity: 'medium', status: 'fixing' },
  ];
  const crit = EA.buildLifecycleApiResponse(rows, { severity: 'critical', page: 1, pageSize: 10 });
  assert.equal(crit.total, 1);
  assert.equal(crit.items[0].id, 'f1');
  const page2 = EA.buildLifecycleApiResponse(rows, { page: 2, pageSize: 2, sort: 'severity' });
  assert.equal(page2.page, 2);
  assert.equal(page2.items.length, 1);
  assert.equal(page2.items[0].id, 'f3');
  const byState = EA.buildLifecycleApiResponse(rows, { state: 'fixing' });
  assert.equal(byState.total, 2);
});

test('52737 buildSmartStateView: named views select right findings', () => {
  const rows = [
    { id: 'f1', status: 'verifying', severity: 'critical', riskScore: 90, stateEnteredAt: '2026-10-08T00:00:00Z', slaHours: 72 },
    { id: 'f4', status: 'verified', severity: 'low', riskScore: 20, stateEnteredAt: '2026-10-08T00:00:00Z', slaHours: 72 },
    { id: 'f3', status: 'new', severity: 'medium', riskScore: 40, stateEnteredAt: '2026-10-08T00:00:00Z', slaHours: 72 },
  ];
  const verify = EA.buildSmartStateView(rows, 'awaiting-verification', NOW);
  assert.deepEqual(verify.findingIds, ['f1']);
  const ready = EA.buildSmartStateView(rows, 'ready-to-close', NOW);
  assert.deepEqual(ready.findingIds, ['f4']);
  const attention = EA.buildSmartStateView(rows, 'needs-attention', NOW);
  assert.deepEqual(attention.findingIds, ['f1']);
});

test('52738 buildStateTriggeredEmail: transition named, Infinity AI subject', () => {
  const v = EA.buildStateTriggeredEmail({ findingId: 'f1', title: 'SQLi in checkout', from: 'verifying', to: 'verified', actor: 'verifier-1', severity: 'critical', owner: 'aarav@example.com' }, 'aarav@example.com');
  assert.equal(v.to, 'aarav@example.com');
  assert.ok(v.subject.includes('Infinity AI'));
  assert.ok(v.subject.includes('verified'));
  assert.equal(v.triggerState, 'verified');
  assert.equal(v.findingId, 'f1');
});

test('52739 exportFindingsByState: filtered serialized export', () => {
  const rows = [
    { id: 'f4', title: 'Verbose errors', severity: 'low', status: 'verified', target: 'shop.example.com' },
    { id: 'f1', title: 'SQLi', severity: 'critical', status: 'verifying', target: 'shop.example.com' },
  ];
  const csv = EA.exportFindingsByState(rows, 'verified', 'csv');
  assert.equal(csv.rows, 1);
  assert.equal(csv.filename, 'lifecycle-verified-export.csv');
  assert.ok(csv.content.includes('f4'));
  assert.ok(!csv.content.includes('f1'));
  assert.ok(csv.checksum.length > 0);
  const json = EA.exportFindingsByState(rows, 'all', 'json');
  assert.ok(json.content.includes('Infinity AI'));
  assert.equal(json.rows, 2);
});

test('52740 computeStateAging: per-state averages and oldest', () => {
  const v = EA.computeStateAging([
    { id: 'f1', status: 'fixing', stateEnteredAt: '2026-10-07T00:00:00Z' },
    { id: 'f2', status: 'fixing', stateEnteredAt: '2026-10-08T00:00:00Z' },
  ], NOW);
  assert.equal(v.total, 2);
  assert.equal(v.byState.fixing.count, 2);
  assert.equal(v.byState.fixing.avgAgeHours, 36);
  assert.equal(v.byState.fixing.maxAgeHours, 48);
  assert.equal(v.byState.fixing.oldestId, 'f1');
  assert.equal(v.oldestFindingId, 'f1');
});

/* ---- Wave69 B spot checks (52741–52760) ---- */
test('52741 buildEscalationChain: severity thresholds drive level', () => {
  const v = EB.buildEscalationChain({ findingId: 'f1', severity: 'critical', breachedHours: 10, owner: 'aarav' });
  assert.equal(v.findingId, 'f1');
  assert.equal(v.chain.length, 4);
  assert.equal(v.chain[0].role, 'owner');
  assert.equal(v.chain[0].afterHours, 0);
  assert.equal(v.currentLevel, 3);
  assert.equal(v.shouldEscalate, true);
  const calm = EB.buildEscalationChain({ findingId: 'f3', severity: 'low', breachedHours: 1 });
  assert.equal(calm.currentLevel, 1);
  assert.equal(calm.shouldEscalate, false);
});

test('52742 buildApprovalQueue: severity order and approver rights', () => {
  const v = EB.buildApprovalQueue([
    { id: 'a2', findingId: 'f2', from: 'confirmed', to: 'dismissed', requestedBy: 'lead-1', severity: 'high', requestedAt: '2026-10-08T08:00:00Z', requiredRole: 'admin', status: 'pending' },
    { id: 'a1', findingId: 'f1', from: 'verifying', to: 'closed', requestedBy: 'verifier-1', severity: 'critical', requestedAt: '2026-10-08T09:00:00Z', requiredRole: 'lead', status: 'pending' },
    { id: 'a3', findingId: 'f3', from: 'new', to: 'triaged', requestedBy: 'analyst-1', severity: 'low', requestedAt: '2026-10-08T07:00:00Z', requiredRole: 'lead', status: 'decided' },
  ], 'lead');
  assert.equal(v.count, 2);
  assert.equal(v.queue[0].id, 'a1');
  assert.deepEqual(v.approvableIds, ['a1']);
  assert.equal(v.queue[1].canApprove, false);
});

test('52743 exportHistoricalStates: ordered serialized history', () => {
  const csv = EB.exportHistoricalStates([
    { seq: 2, findingId: 'f1', from: 'triaged', to: 'confirmed', actor: 'lead-1', at: '2026-10-02T09:00:00Z' },
    { seq: 1, findingId: 'f1', from: 'new', to: 'triaged', actor: 'analyst-1', at: '2026-10-01T09:00:00Z' },
  ], 'csv');
  assert.equal(csv.rows, 2);
  assert.equal(csv.filename, 'historical-states-export.csv');
  assert.ok(csv.content.includes('seq,findingId'));
  assert.ok(csv.checksum.length > 0);
  const json = EB.exportHistoricalStates([{ seq: 1, findingId: 'f1', from: 'new', to: 'triaged', actor: 'a', at: '2026-10-01T09:00:00Z' }], 'json');
  assert.ok(json.content.includes('Infinity AI'));
});

test('52744 computeLifecycleFunnel: reach and conversion', () => {
  const v = EB.computeLifecycleFunnel([
    { id: 'f1', status: 'closed', history: [] },
    { id: 'f2', status: 'new', history: [] },
  ]);
  assert.equal(v.total, 2);
  assert.equal(v.closedCount, 1);
  assert.equal(v.stages[0].stage, 'new');
  assert.equal(v.stages[0].reached, 2);
  assert.equal(v.stages[1].reached, 1);
  assert.equal(v.stages[1].conversionPct, 50);
  assert.equal(v.biggestDropStage, 'triaged');
});

test('52745 evaluateSeverityStateRules: approval and separate verifier', () => {
  const blocked = EB.evaluateSeverityStateRules({ id: 'f1', severity: 'critical', status: 'confirmed' }, 'dismissed', {});
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.reasons[0].includes('approval'));
  const approved = EB.evaluateSeverityStateRules({ id: 'f1', severity: 'critical', status: 'confirmed' }, 'dismissed', { approvedBy: 'director' });
  assert.equal(approved.allowed, true);
  const selfClose = EB.evaluateSeverityStateRules({ id: 'f1', severity: 'critical', status: 'verifying', fixer: 'meera', verifiedBy: 'verifier-1' }, 'closed', { actor: 'meera', verifiedBy: 'verifier-1' });
  assert.equal(selfClose.allowed, false);
  assert.ok(selfClose.reasons.some(r => r.includes('cannot be closed by the person')));
});

test('52746 getTerminalStateDefinitions: terminal set and counts', () => {
  const v = EB.getTerminalStateDefinitions();
  assert.deepEqual(v.terminalStates, ['closed', 'dismissed', 'duplicate']);
  assert.equal(v.totalStates, 15);
  assert.equal(v.activeStates.length, 12);
  assert.equal(v.definitions.length, 15);
  assert.equal(v.definitions.find(d => d.state === 'closed').terminal, true);
  assert.equal(v.definitions.find(d => d.state === 'fixing').terminal, false);
});

test('52747 suggestNextStates: fix signal promotes verifying', () => {
  const v = EB.suggestNextStates({ id: 'f2', status: 'fixing', severity: 'high', fixNote: 'PR #62 encodes output' });
  assert.equal(v.currentState, 'fixing');
  assert.equal(v.recommended, 'verifying');
  assert.equal(v.suggestions[0].state, 'verifying');
  assert.equal(v.suggestions[0].score, 80);
  assert.equal(v.suggestions[0].source, 'Infinity AI');
  const done = EB.suggestNextStates({ id: 'f5', status: 'closed', severity: 'low' });
  assert.equal(done.recommended, 'reopened');
});

test('52748 buildTransitionChecklist: gates counted per target', () => {
  const ready = EB.buildTransitionChecklist({ id: 'f1', title: 'SQLi', severity: 'critical', fixNote: 'PR #61' }, 'verifying');
  assert.equal(ready.ready, true);
  assert.equal(ready.completed, 3);
  assert.equal(ready.total, 3);
  assert.equal(ready.completionPct, 100);
  const notReady = EB.buildTransitionChecklist({ id: 'f1', title: 'SQLi', severity: 'high' }, 'closed');
  assert.equal(notReady.ready, false);
  assert.equal(notReady.completed, 2);
  assert.equal(notReady.total, 4);
  assert.equal(notReady.completionPct, 50);
});

test('52749 gateActionByState: state decides allowed actions', () => {
  assert.equal(EB.gateActionByState('verifying', 'verify').allowed, true);
  assert.equal(EB.gateActionByState('closed', 'start-fix').allowed, false);
  assert.equal(EB.gateActionByState('closed', 'reopen').allowed, true);
  assert.equal(EB.gateActionByState('fixing', 'submit-verify').allowed, true);
  const unknown = EB.gateActionByState('bogus-state', 'comment');
  assert.equal(unknown.allowed, true);
  assert.deepEqual(unknown.allowedActions, ['comment']);
});

test('52750 buildMobileApprovalPayload: priority, deep link, sendable', () => {
  const v = EB.buildMobileApprovalPayload({ id: 'a1', findingId: 'f1', from: 'verifying', to: 'closed', severity: 'critical', requestedBy: 'verifier-1' }, { platform: 'ios' });
  assert.equal(v.priority, 'high');
  assert.equal(v.sendable, true);
  assert.equal(v.deepLink, 'infinityai://approvals/a1');
  assert.deepEqual(v.actions, ['approve', 'reject']);
  assert.ok(v.body.includes('Infinity AI'));
  const web = EB.buildMobileApprovalPayload({ id: 'a1', findingId: 'f1', from: 'new', to: 'triaged', severity: 'low', requestedBy: 'a' }, { platform: 'web' });
  assert.equal(web.sendable, false);
  assert.equal(web.priority, 'normal');
});

test('52751 generateLifecycleDocumentation: handbook markdown', () => {
  const v = EB.generateLifecycleDocumentation({ states: ['new', 'triaged', 'closed'], transitions: { new: ['triaged'], triaged: ['closed'], closed: [] } });
  assert.equal(v.stateCount, 3);
  assert.equal(v.transitionCount, 2);
  assert.ok(v.markdown.includes('Infinity AI'));
  assert.ok(v.markdown.includes('## new'));
  assert.ok(v.markdown.includes('Terminal state'));
  const full = EB.generateLifecycleDocumentation();
  assert.equal(full.stateCount, 15);
});

test('52752 predictTimeToClose: age subtracted from severity average', () => {
  const v = EB.predictTimeToClose({ id: 'f3', severity: 'medium', status: 'new', createdAt: '2026-10-08T00:00:00Z' }, {}, NOW);
  assert.equal(v.avgHours, 48);
  assert.equal(v.ageHours, 24);
  assert.equal(v.remainingHours, 24);
  assert.equal(v.predictedCloseAt, '2026-10-10T00:00:00.000Z');
  const closed = EB.predictTimeToClose({ id: 'f5', severity: 'medium', status: 'closed', createdAt: '2026-10-01T00:00:00Z' }, {}, NOW);
  assert.equal(closed.remainingHours, 0);
});

test('52753 boostStalledPriorities: only idle active findings boosted', () => {
  const rows = [
    { id: 'f-old', status: 'fixing', severity: 'high', riskScore: 40, stateEnteredAt: '2026-09-01T00:00:00Z' },
    { id: 'f-new', status: 'new', severity: 'low', riskScore: 10, stateEnteredAt: '2026-10-08T00:00:00Z' },
    { id: 'f-closed', status: 'closed', severity: 'high', riskScore: 50, stateEnteredAt: '2026-09-01T00:00:00Z' },
  ];
  const v = EB.boostStalledPriorities(rows, NOW, { thresholdHours: 72 });
  assert.deepEqual(v.boostedIds, ['f-old']);
  assert.equal(v.boostedCount, 1);
  const old = v.items.find(i => i.id === 'f-old');
  assert.equal(old.boostedRiskScore, 55);
  assert.equal(old.originalRiskScore, 40);
  assert.equal(rows[0].riskScore, 40);
});

test('52754 syncTicketState: newest side wins a conflict', () => {
  const conflict = EB.syncTicketState(
    { id: 'f2', status: 'fixing', stateEnteredAt: '2026-10-05T00:00:00Z' },
    { externalId: 'JIRA-9', status: 'resolved', updatedAt: NOW }
  );
  assert.equal(conflict.conflict, true);
  assert.equal(conflict.direction, 'ticket-wins');
  assert.equal(conflict.syncedState, 'verifying');
  assert.equal(conflict.externalId, 'JIRA-9');
  const synced = EB.syncTicketState(
    { id: 'f2', status: 'fixing', stateEnteredAt: '2026-10-05T00:00:00Z' },
    { externalId: 'JIRA-9', status: 'in-progress', updatedAt: NOW }
  );
  assert.equal(synced.conflict, false);
  assert.equal(synced.direction, 'in-sync');
});

test('52755 syncPlatformStatus: outage blocks, recovery resumes', () => {
  const outage = EB.syncPlatformStatus({ id: 'f2', status: 'fixing' }, { status: 'outage', component: 'shop.example.com' });
  assert.equal(outage.suggestedState, 'blocked-vendor');
  assert.equal(outage.action, 'block-on-vendor');
  assert.equal(outage.inSync, false);
  const recovered = EB.syncPlatformStatus({ id: 'f2', status: 'blocked-vendor' }, { status: 'operational', component: 'shop.example.com' });
  assert.equal(recovered.suggestedState, 'fixing');
  assert.equal(recovered.action, 'resume-fix');
  const steady = EB.syncPlatformStatus({ id: 'f2', status: 'fixing' }, { status: 'operational', component: 'shop.example.com' });
  assert.equal(steady.inSync, true);
  assert.equal(steady.action, 'none');
});

test('52756 proposeAgentTransitions: signal-driven proposals', () => {
  const v = EB.proposeAgentTransitions([
    { id: 'f2', status: 'fixing', fixNote: 'PR #62' },
    { id: 'f1', status: 'verifying', verificationEvidence: 'retest passed' },
    { id: 'f3', status: 'new' },
    { id: 'f5', status: 'closed' },
  ]);
  assert.equal(v.count, 3);
  assert.equal(v.proposals[0].to, 'verifying');
  assert.equal(v.proposals[0].confidence, 90);
  assert.equal(v.proposals[1].to, 'verified');
  assert.equal(v.proposals[2].to, 'triaged');
  assert.ok(v.proposals.every(p => p.source === 'Infinity AI'));
});

test('52757 renderLifecycleDiagram: mermaid flowchart text', () => {
  const v = EB.renderLifecycleDiagram(['new', 'triaged', 'closed'], { new: ['triaged'], triaged: ['closed'], closed: [] });
  assert.equal(v.format, 'mermaid');
  assert.equal(v.stateCount, 3);
  assert.equal(v.transitionCount, 2);
  assert.ok(v.diagram.startsWith('flowchart LR'));
  assert.ok(v.diagram.includes('new --> triaged'));
  assert.ok(v.diagram.includes('triaged --> closed'));
});

test('52758 importStatesFromCsv: valid rows kept, bad rows reported', () => {
  const v = EB.importStatesFromCsv('id,state\nf1,triaged\nf2,bogus-state\nf3,closed');
  assert.equal(v.total, 3);
  assert.equal(v.validCount, 2);
  assert.equal(v.errors.length, 1);
  assert.equal(v.errors[0].line, 3);
  assert.deepEqual(v.imported.map(r => r.id), ['f1', 'f3']);
  const empty = EB.importStatesFromCsv('');
  assert.equal(empty.validCount, 0);
  assert.equal(empty.errors.length, 1);
});

test('52759 remapFindingStates: mapped moved, inputs untouched', () => {
  const rows = [
    { id: 'f3', status: 'new' },
    { id: 'f2', status: 'fixing' },
    { id: 'f5', status: 'closed' },
  ];
  const v = EB.remapFindingStates(rows, { new: 'triaged', fixing: 'verifying' });
  assert.equal(v.remappedCount, 2);
  assert.deepEqual(v.remappedIds, ['f3', 'f2']);
  assert.equal(v.unchangedCount, 1);
  assert.equal(v.findings[0].status, 'triaged');
  assert.equal(rows[0].status, 'new');
  const bad = EB.remapFindingStates(rows, { new: 'bogus-state' });
  assert.equal(bad.errors.length, 1);
  assert.equal(bad.remappedCount, 0);
});

test('52760 archiveWithPreservedStates: states preserved on copies', () => {
  const rows = [
    { id: 'f2', status: 'fixing' },
    { id: 'f5', status: 'closed' },
  ];
  const v = EB.archiveWithPreservedStates(rows, NOW);
  assert.equal(v.count, 2);
  assert.equal(v.archived[0].preservedState, 'fixing');
  assert.equal(v.archived[0].archived, true);
  assert.equal(v.archivedAt, NOW);
  assert.deepEqual(v.byState, { fixing: 1, closed: 1 });
  assert.equal(rows[0].archived, undefined);
});

/* ---- JSX↔core call-shape audit ---- */
function componentNames(jsxSrc) {
  return [...jsxSrc.matchAll(/export function (\w+)/g)].map(m => m[1]).filter(n => !/Gallery$/.test(n));
}
function componentBody(jsxSrc, name) {
  const idx = jsxSrc.indexOf(`export function ${name}`);
  const next = jsxSrc.indexOf('export function', idx + 1);
  return jsxSrc.slice(idx, next === -1 ? undefined : next);
}

test('jsx: 20 components per file, each calls ≥1 core function', () => {
  for (const [label, src, core] of [['A', A_JSX, EA], ['B', B_JSX, EB]]) {
    const names = componentNames(src);
    assert.equal(names.length, 20, `${label}: expected 20 components, got ${names.length}`);
    const fns = Object.keys(core).filter(k => !k.endsWith('_IDEAS'));
    assert.equal(fns.length, 20, `${label}: expected 20 core functions`);
    for (const name of names) {
      const body = componentBody(src, name);
      const called = fns.filter(fn => new RegExp(`\\b${fn}\\b`).test(body));
      assert.ok(called.length >= 1, `${label} component ${name} calls no core function`);
    }
    for (const fn of fns) {
      assert.ok(new RegExp(`\\b${fn}\\b`).test(src), `${label} core function ${fn} never referenced in JSX`);
    }
  }
});

/* ---- CSS scope + zero-animation audits ---- */
test('css: only .w69a-/.w69b- scoped selectors, no globals', () => {
  const noComments = CSS_SRC.replace(/\/\*[\s\S]*?\*\//g, '');
  const classSelectors = [...noComments.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map(m => m[1]);
  assert.ok(classSelectors.length > 10, 'expected many scoped selectors');
  for (const cls of classSelectors) {
    assert.ok(cls.startsWith('w69a-') || cls.startsWith('w69b-'), `unscoped selector: .${cls}`);
  }
  assert.ok(!/(^|\n)\s*(body|html|\*|:root)\s*\{/.test(noComments), 'global rule found');
});

test('css: zero keyframes, zero animation properties', () => {
  assert.ok(!/@keyframes/i.test(CSS_SRC), 'found @keyframes');
  assert.ok(!/(^|[;{\s])animation(-name|-duration|-timing-function|-delay|-iteration-count|-direction|-fill-mode|-play-state)?\s*:/i.test(CSS_SRC), 'found animation property');
  assert.ok(!/transition\s*:/i.test(CSS_SRC), 'found transition property');
});

/* ---- esbuild real JSX parse audit ---- */
test('esbuild: both JSX files parse/transform cleanly', () => {
  for (const f of ['Wave69A.jsx', 'Wave69B.jsx']) {
    const out = execFileSync(
      'npx',
      ['-y', 'esbuild', `--loader:.jsx=jsx`, '--format=esm', join(DIR, f)],
      { encoding: 'utf8', timeout: 90000 }
    );
    assert.ok(out.includes('createElement') || out.includes('jsx'), `${f} did not transform`);
  }
});

/* ---- no-branding-leak audit ---- */
test('branding: no forbidden brand anywhere; Infinity AI present in cores', () => {
  for (const [name, src] of BRAND_SRC) {
    assert.ok(!src.toLowerCase().includes('mu' + 'se'), `forbidden brand leaked in ${name}`);
  }
  assert.ok(A_SRC.includes('Infinity AI'));
  assert.ok(B_SRC.includes('Infinity AI'));
});

/* ---- no-debris audit ---- */
test('no-debris: no TODO/FIXME/mock placeholders in logic', () => {
  for (const [name, src] of [['A core', A_SRC], ['B core', B_SRC]]) {
    assert.ok(!/TODO|FIXME|XXX|HACK/i.test(src), `debris in ${name}`);
    assert.ok(!/\bmock\b/i.test(src), `mock mention in ${name}`);
  }
});
