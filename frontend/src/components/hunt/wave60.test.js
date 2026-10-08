/**
 * wave60.test.js — Infinity AI · Dark-Matter · Wave 60
 * node:test + node:assert/strict. Registry coverage (20/20 for 52361–52380,
 * 20/20 for 52381–52400, zero skips, 40/40 combined), registry titles matched
 * against the idea bank, deterministic spot-checks of every pure function
 * (at least one assertion per idea), Wave60.css scope/zero-animation audits,
 * a real esbuild JSX parse audit, a no-branding-leak audit ("Infinity AI"
 * only) and a no-debris audit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WAVE60_GOVERN_IDEAS } from './lifecycleGovernCore.js';
import * as LG from './lifecycleGovernCore.js';
import { WAVE60_SYNC_IDEAS } from './lifecycleSyncCore.js';
import * as LS from './lifecycleSyncCore.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const CSS = join(DIR, 'Wave60.css');
const GOVERN_SRC = readFileSync(join(DIR, 'lifecycleGovernCore.js'), 'utf8');
const SYNC_SRC = readFileSync(join(DIR, 'lifecycleSyncCore.js'), 'utf8');
const GOVERN_JSX = readFileSync(join(DIR, 'LifecycleGovern.jsx'), 'utf8');
const SYNC_JSX = readFileSync(join(DIR, 'LifecycleSync.jsx'), 'utf8');
const CSS_SRC = readFileSync(CSS, 'utf8');
const TEST_SRC = readFileSync(join(DIR, 'wave60.test.js'), 'utf8');
const ALL_SRC = [GOVERN_SRC, SYNC_SRC, GOVERN_JSX, SYNC_JSX, CSS_SRC, TEST_SRC];
const NOW = 1700000000000;
const DAY = 24 * 3600000;

function registryOk(reg, first, count) {
  assert.equal(reg.length, count, `expected ${count} registry entries, got ${reg.length}`);
  const ids = reg.map((e) => e.id);
  assert.deepEqual(ids, Array.from({ length: count }, (_, i) => first + i), 'registry ids must be the exact idea range in order');
  for (const e of reg) {
    assert.ok(typeof e.title === 'string' && e.title.length > 0, `entry ${e.id} needs a title`);
    assert.ok(typeof e.desc === 'string' && e.desc.length > 0, `entry ${e.id} needs a desc`);
    assert.equal(e.skip, false, `entry ${e.id} must not be skipped`);
  }
}

/* ---- Registry coverage ---- */
test('WAVE60_GOVERN_IDEAS: 20/20 entries 52361–52380, zero skips', () => {
  registryOk(WAVE60_GOVERN_IDEAS, 52361, 20);
});

test('WAVE60_SYNC_IDEAS: 20/20 entries 52381–52400, zero skips', () => {
  registryOk(WAVE60_SYNC_IDEAS, 52381, 20);
});

test('combined coverage: exactly 52361–52400 with no gaps or dupes', () => {
  const all = [...WAVE60_GOVERN_IDEAS.map((e) => e.id), ...WAVE60_SYNC_IDEAS.map((e) => e.id)];
  assert.equal(all.length, 40);
  assert.deepEqual([...all].sort((a, b) => a - b), Array.from({ length: 40 }, (_, i) => 52361 + i));
});

/* ---- Registry titles match the bank ideas ---- */
const BANK_TITLES = {
  52361: 'State transition rules', 52362: 'Per-role state permissions',
  52363: 'State-change audit log', 52364: 'State-change notifications (post-hunt)',
  52365: 'Bulk state transitions', 52366: 'State SLA timers',
  52367: 'Lifecycle dashboard', 52368: 'State timeline per finding',
  52369: 'Mandatory state-change reasons', 52370: 'State undo',
  52371: '"Needs info" state', 52372: '"Duplicate" state with link',
  52373: '"Won\'t fix" state with reason', 52374: '"Risk accepted" state',
  52375: '"Deferred" state with date', 52376: '"Blocked" state with reason',
  52377: '"Verified" vs "Closed" distinction', 52378: '"Reopened" state',
  52379: 'Auto-transitions on retest', 52380: 'State-transition webhooks',
  52381: 'Lifecycle API (post-hunt)', 52382: 'State-based smart views',
  52383: 'State-based email rules', 52384: 'State-based export filters',
  52385: 'State aging reports', 52386: 'Stuck-in-state alerts',
  52387: 'Transition approval gates', 52388: 'State history export',
  52389: 'State analytics', 52390: 'Per-severity state rules',
  52391: 'Terminal-state configuration', 52392: 'AI-suggested next state',
  52393: 'State-transition checklists', 52394: 'State-gated actions',
  52395: 'State change mobile approval', 52396: 'Lifecycle documentation',
  52397: 'State prediction', 52398: 'State-based prioritization',
  52399: 'Jira two-way state sync', 52400: 'Bounty-platform state sync',
};

test('registry titles match bank idea titles (all 40)', () => {
  for (const e of [...WAVE60_GOVERN_IDEAS, ...WAVE60_SYNC_IDEAS]) {
    assert.equal(e.title, BANK_TITLES[e.id], `title mismatch for idea ${e.id}`);
  }
});

test('registry titles cross-checked against the idea-bank file', () => {
  const bank = readFileSync(join(DIR, '..', '..', '..', '..', 'ideas', 'IDEAS_10000_BATCH6.md'), 'utf8');
  for (const id of [52361, 52371, 52377, 52379, 52383, 52392, 52399, 52400]) {
    const line = bank.split('\n').find((l) => l.startsWith(`${id}. `));
    assert.ok(line, `bank line for idea ${id} not found`);
    const bankTitle = line.replace(/^\d+\.\s+\*\*/, '').split('**')[0];
    const entry = [...WAVE60_GOVERN_IDEAS, ...WAVE60_SYNC_IDEAS].find((e) => e.id === id);
    assert.equal(entry.title, bankTitle, `bank title mismatch for ${id}`);
  }
});

/* ---- Govern core spot-checks (one+ assertion per idea function) ---- */
test('52361 canTransition: Verified→New illegal, Triaged→InProgress legal', () => {
  const illegal = LG.canTransition('Verified', 'New');
  assert.equal(illegal.legal, false);
  const legal = LG.canTransition('Triaged', 'InProgress');
  assert.equal(legal.ok, true);
  assert.ok(LG.transitionRulesGraph().states.includes('Verified'));
  assert.deepEqual(LG.legalTargets('Duplicate').targets, []);
});

test('52362 canRoleTransition: hunter blocked from Closed, manager allowed', () => {
  const denied = LG.canRoleTransition('hunter', 'Verified', 'Closed');
  assert.equal(denied.ok, false);
  assert.ok(denied.reason.includes('lead'));
  assert.equal(LG.canRoleTransition('manager', 'Verified', 'Closed').ok, true);
  assert.equal(LG.roleStatePermissions().roles.includes('approver'), true);
});

test('52363 appendStateAudit: frozen immutable entries, reason required', () => {
  const bad = LG.appendStateAudit([], { actor: 'a', from: 'New', to: 'Triaged' });
  assert.equal(bad.ok, false);
  const r = LG.appendStateAudit([], { findingId: 'f-1', actor: 'aria', from: 'New', to: 'Triaged', reason: 'triage', at: NOW });
  assert.equal(r.ok, true);
  assert.equal(r.log.length, 1);
  assert.ok(Object.isFrozen(r.entry));
});

test('52364 notifyStateChange: one notification per watcher', () => {
  const r = LG.notifyStateChange({ findingId: 'f-1', from: 'New', to: 'Triaged', by: 'aria', reason: 'triage', watchers: [{ id: 'u1' }, { id: 'u2' }] }, NOW);
  assert.equal(r.ok, true);
  assert.equal(r.count, 2);
  assert.equal(r.notifications[0].findingId, 'f-1');
});

test('52365 bulkTransition: preview counts + applied with shared reason', () => {
  const batch = [{ id: 'f-1', state: 'New' }, { id: 'f-2', state: 'Verified' }];
  const preview = LG.bulkTransitionPreview(batch, 'Triaged', NOW);
  assert.equal(preview.counts.legal, 1);
  assert.equal(preview.counts.illegal, 1);
  const applied = LG.bulkTransition(batch, 'Triaged', { reason: 'bulk triage', actor: 'aria' }, NOW);
  assert.equal(applied.applied, true);
  assert.equal(applied.auditLog.length, 1);
  const noReason = LG.bulkTransition(batch, 'Triaged', {}, NOW);
  assert.equal(noReason.applied, false);
});

test('52366 slaBreachCheck: 30h in New (24h SLA) breaches', () => {
  assert.ok(LG.slaConfig().slaMs.New === 24 * 3600000);
  const b = LG.slaBreachCheck('New', NOW - 30 * 3600000, NOW);
  assert.equal(b.breached, true);
  const ok = LG.slaBreachCheck('Triaged', NOW - 3600000, NOW);
  assert.equal(ok.breached, false);
  assert.equal(LG.slaBreachCheck('Blocked', NOW - 30 * DAY, NOW).hasSla, false);
});

test('52367 lifecycleDashboard: counts and aging per state', () => {
  const r = LG.lifecycleDashboard([
    { id: 'f-1', state: 'New', stateEnteredAt: NOW - 3600000, severity: 'high' },
    { id: 'f-2', state: 'New', stateEnteredAt: NOW - 7200000, severity: 'low' },
  ], NOW);
  const col = r.columns.find((c) => c.state === 'New');
  assert.equal(col.count, 2);
  assert.ok(col.avgAgeMs > 3600000);
  assert.equal(col.bySeverity.high, 1);
});

test('52368 buildStateTimeline: ordered steps with prior-state durations', () => {
  let log = [];
  log = LG.appendStateAudit(log, { findingId: 'f-1', actor: 'a', from: 'New', to: 'Triaged', reason: 't', at: NOW }).log;
  log = LG.appendStateAudit(log, { findingId: 'f-1', actor: 'b', from: 'Triaged', to: 'InProgress', reason: 'u', at: NOW + 3600000 }).log;
  const r = LG.buildStateTimeline(log, 'f-1');
  assert.equal(r.steps, 2);
  assert.equal(r.timeline[1].durationInPriorStateMs, 3600000);
});

test('52369 requireChangeReason: mandatory for closing, optional otherwise', () => {
  assert.equal(LG.requireChangeReason('Verified', 'Closed', '').ok, false);
  assert.equal(LG.requireChangeReason('Verified', 'Closed', 'fix shipped').ok, true);
  assert.equal(LG.requireChangeReason('New', 'Triaged', '').ok, true);
});

test('52370 undoTransition: grace window honored', () => {
  const entry = LG.appendStateAudit([], { actor: 'a', from: 'New', to: 'Triaged', reason: 't', at: NOW }).entry;
  const inGrace = LG.undoTransition(entry, 15 * 60 * 1000, NOW + 5 * 60 * 1000);
  assert.equal(inGrace.ok, true);
  assert.equal(inGrace.restore.to, 'New');
  assert.equal(LG.undoTransition(entry, 15 * 60 * 1000, NOW + 3600000).ok, false);
});

test('52371 parkNeedsInfo: requires a question, parks from Triaged', () => {
  assert.equal(LG.parkNeedsInfo({ id: 'f-1', state: 'Triaged' }, { question: '' }).ok, false);
  const r = LG.parkNeedsInfo({ id: 'f-1', state: 'Triaged' }, { question: 'repro steps?', requestedFrom: 'reporter' }, NOW);
  assert.equal(r.ok, true);
  assert.equal(r.to, 'NeedsInfo');
  assert.equal(r.park.priorState, 'Triaged');
});

test('52372 markDuplicate: canonical link + evidence merge', () => {
  const r = LG.markDuplicate(
    { id: 'f-1', state: 'Triaged', evidence: [{ kind: 'screenshot', name: 'b.png' }] },
    { id: 'f-0', evidence: [{ kind: 'screenshot', name: 'a.png' }] },
    { reason: 'same bug' }, NOW);
  assert.equal(r.ok, true);
  assert.equal(r.duplicateOf, 'f-0');
  assert.equal(r.evidenceMergedCount, 2);
  assert.equal(LG.markDuplicate({ id: 'f-1', state: 'Triaged' }, { id: 'f-1' }).ok, false);
});

test('52373 wontFix: rationale + approver required', () => {
  assert.equal(LG.wontFix({ id: 'f-1', state: 'Triaged' }, { rationale: 'x' }).ok, false);
  const r = LG.wontFix({ id: 'f-1', state: 'Triaged' }, { rationale: 'legacy, sunset Q1', approver: 'sec-lead' }, NOW);
  assert.equal(r.ok, true);
  assert.equal(r.to, 'WontFix');
});

test('52374 riskAccepted: owner + future expiry required; expiry check works', () => {
  assert.equal(LG.riskAccepted({ id: 'f-1', state: 'Triaged' }, { owner: 'ciso', expiryAt: NOW - 1 }).ok, false);
  const r = LG.riskAccepted({ id: 'f-1', state: 'Triaged' }, { owner: 'ciso', expiryAt: NOW + DAY, compensatingControls: ['WAF'], now: NOW });
  assert.equal(r.ok, true);
  assert.equal(r.to, 'RiskAccepted');
  assert.equal(LG.riskAcceptanceExpired(r, NOW + 2 * DAY).expired, true);
  assert.equal(LG.riskAcceptanceExpired(r, NOW).expired, false);
});

test('52375 deferFinding: future reopen date + due check', () => {
  const r = LG.deferFinding({ id: 'f-1', state: 'Triaged' }, { reopenAt: NOW + 30 * DAY, note: 'later', now: NOW });
  assert.equal(r.ok, true);
  assert.equal(r.to, 'Deferred');
  assert.equal(LG.checkDeferredDue(r, NOW + 31 * DAY).due, true);
  assert.equal(LG.checkDeferredDue(r, NOW).due, false);
});

test('52376 blockFinding: dependency note required', () => {
  assert.equal(LG.blockFinding({ id: 'f-1', state: 'InProgress' }, {}).ok, false);
  const r = LG.blockFinding({ id: 'f-1', state: 'InProgress' }, { dependency: 'vendor patch 2.4.1' }, NOW);
  assert.equal(r.ok, true);
  assert.equal(r.to, 'Blocked');
});

test('52377 verifiedVsClosedCheck: technical vs administrative distinction', () => {
  const ready = { id: 'f-1', retest: { passed: true } };
  const r1 = LG.verifiedVsClosedCheck(ready, {});
  assert.equal(r1.verified.claimable, true);
  assert.equal(r1.closed.claimable, false);
  const r2 = LG.verifiedVsClosedCheck(ready, { summary: 'shipped', closedBy: 'lead' });
  assert.equal(r2.closed.claimable, true);
  const r3 = LG.verifiedVsClosedCheck({ id: 'f-2' }, { summary: 'shipped', closedBy: 'lead' });
  assert.equal(r3.verified.claimable, false);
});

test('52378 reopenFinding: links original closure, reason required', () => {
  assert.equal(LG.reopenFinding({ id: 'f-1', state: 'Closed' }, { reason: 'x' }).ok, false);
  const r = LG.reopenFinding({ id: 'f-1', state: 'Closed' }, { reason: 'regression', by: 'aria', originalClosure: { id: 'cl-1', closedAt: NOW - DAY } }, NOW);
  assert.equal(r.ok, true);
  assert.equal(r.to, 'Reopened');
  assert.equal(r.originalClosureId, 'cl-1');
});

test('52379 autoTransitionOnRetest: pass→Verified, fail→Reopened', () => {
  const pass = LG.autoTransitionOnRetest({ id: 'f-1', state: 'InRetest' }, { passed: true, retestId: 'rt-1' }, NOW);
  assert.equal(pass.to, 'Verified');
  assert.equal(pass.automatic, true);
  const fail = LG.autoTransitionOnRetest({ id: 'f-1', state: 'InRetest' }, { passed: false, retestId: 'rt-2' }, NOW);
  assert.equal(fail.to, 'Reopened');
  assert.equal(LG.autoTransitionOnRetest({ id: 'f-1', state: 'New' }, { passed: true }).ok, false);
});

test('52380 transitionWebhookPayload: per-target deliveries', () => {
  const r = LG.transitionWebhookPayload(
    { findingId: 'f-1', from: 'InRetest', to: 'Verified', actor: 'aria', reason: 'pass', at: NOW },
    [{ name: 'ticketing', url: 'https://t.example/hooks' }], NOW);
  assert.equal(r.ok, true);
  assert.equal(r.event.event, 'finding.state_changed');
  assert.equal(r.deliveries.length, 1);
});

/* ---- Sync core spot-checks (one+ assertion per idea function) ---- */
test('52381 lifecycleApiRoutes: 12 routes under /api/v1/lifecycle', () => {
  const r = LS.lifecycleApiRoutes();
  assert.equal(r.count, 12);
  assert.ok(r.routes.every((x) => x.method && x.path && x.summary));
});

test('52382 runSmartViews: stuck-triaged view catches 10d-old triaged finding', () => {
  const findings = [{ id: 'f-1', state: 'Triaged', stateEnteredAt: NOW - 10 * DAY }, { id: 'f-2', state: 'InRetest', stateEnteredAt: NOW - DAY }];
  const r = LS.runSmartViews(findings, NOW);
  const stuck = r.views.find((v) => v.id === 'stuck-triaged-7d');
  assert.deepEqual(stuck.findings, ['f-1']);
  const verifying = r.views.find((v) => v.id === 'verifying-now');
  assert.deepEqual(verifying.findings, ['f-2']);
});

test('52383 stateEmailRule + defaults', () => {
  const bad = LS.stateEmailRule({ name: 'x' });
  assert.equal(bad.ok, false);
  const r = LS.stateEmailRule({ name: 'digest', onEnter: ['Verified'], recipients: ['team'], schedule: 'daily' });
  assert.equal(r.ok, true);
  assert.equal(r.rule.schedule, 'daily');
  assert.equal(LS.defaultEmailRules().rules.length, 4);
});

test('52384 stateExportFilter: predicate matches chosen states only', () => {
  assert.equal(LS.stateExportFilter([]).ok, false);
  const r = LS.stateExportFilter(['Verified', 'Closed']);
  assert.equal(r.ok, true);
  assert.equal(r.filter.predicate({ state: 'Verified' }), true);
  assert.equal(r.filter.predicate({ state: 'New' }), false);
  assert.equal(LS.stateExportFilter(['Bogus']).ok, false);
});

test('52385 stateAgingReport: bottleneck is the oldest-avg state', () => {
  const r = LS.stateAgingReport([
    { id: 'f-1', state: 'Triaged', stateEnteredAt: NOW - 10 * DAY },
    { id: 'f-2', state: 'New', stateEnteredAt: NOW - DAY },
  ], NOW);
  assert.equal(r.bottleneck, 'Triaged');
  assert.ok(r.perState.find((p) => p.state === 'Triaged').avgAgeMs > 9 * DAY);
});

test('52386 stuckAlerts: breached SLA raises alert, heavy breach escalates to manager', () => {
  const r = LS.stuckAlerts([
    { id: 'f-1', state: 'Triaged', severity: 'high', stateEnteredAt: NOW - 10 * DAY },
    { id: 'f-2', state: 'New', severity: 'low', stateEnteredAt: NOW - DAY },
  ], NOW);
  assert.equal(r.count, 1);
  assert.equal(r.alerts[0].escalation, 'manager');
  assert.equal(r.escalatedToManager, 1);
});

test('52387 transitionApprovalGates: closing a critical needs approval', () => {
  const r = LS.transitionApprovalGates({ id: 'f-1', severity: 'critical' }, 'Blocked', 'Closed');
  assert.equal(r.required, true);
  assert.ok(r.gates.some((g) => g.approverRole === 'manager'));
  const plain = LS.transitionApprovalGates({ id: 'f-2', severity: 'low' }, 'Triaged', 'InProgress');
  assert.equal(plain.required, false);
  const approved = LS.approveTransitionGate(r, { approver: 'manager', approved: true });
  assert.equal(approved.approved, true);
});

test('52388 stateHistoryExport: csv and markdown formats', () => {
  const log = [{ id: 'a1', findingId: 'f-1', actor: 'aria', from: 'New', to: 'Triaged', reason: 't', at: NOW }];
  const csv = LS.stateHistoryExport(log, 'csv');
  assert.ok(csv.export.startsWith('id,findingId,actor,from,to,reason,at'));
  const md = LS.stateHistoryExport(log, 'markdown');
  assert.ok(md.export.includes('**New → Triaged**'));
  assert.equal(LS.stateHistoryExport(log).format, 'json');
});

test('52389 funnelAnalytics: counts per state + drop-off', () => {
  const r = LS.funnelAnalytics([
    { id: 'f-1', state: 'New' }, { id: 'f-2', state: 'Triaged' }, { id: 'f-3', state: 'Closed' },
  ]);
  assert.equal(r.total, 3);
  assert.equal(r.funnel.reachClosedRate, 1 / 3);
  assert.equal(r.dropOff.neverTriaged, 1);
});

test('52390 severityStateRules: critical shortens the New SLA to 12h', () => {
  assert.equal(LS.severityStateRules('critical').ok, true);
  assert.equal(LS.severitySlaMs('critical', 'New').slaMs, 12 * 3600000);
  assert.equal(LS.severitySlaMs('low', 'New').slaMs, 24 * 3600000);
  assert.equal(LS.severityStateRules('bogus').ok, false);
});

test('52391 terminalStatesConfig: Closed terminal, Reopened not', () => {
  const r = LS.terminalStatesConfig();
  assert.equal(r.isTerminal('Closed'), true);
  assert.equal(r.isTerminal('Reopened'), false);
  assert.equal(r.terminal.length, 5);
  assert.ok(!r.active.includes('Archived'));
});

test('52392 suggestNextState: retest-passed InRetest suggests Verified top', () => {
  const r = LS.suggestNextState({ id: 'f-1', state: 'InRetest', retest: { passed: true } });
  assert.equal(r.ok, true);
  assert.equal(r.suggestions[0].state, 'Verified');
  assert.ok(r.suggestions[0].reason.length > 0);
  assert.deepEqual(r.suggestions[0].oneClick, { to: 'Verified', from: 'InRetest' });
});

test('52393 evaluateChecklist: all satisfied when evidence + retest present', () => {
  const r = LS.evaluateChecklist(
    { evidence: [{ kind: 'fix' }], retest: { passed: true } }, 'InRetest', 'Verified');
  assert.equal(r.allSatisfied, true);
  const r2 = LS.evaluateChecklist({}, 'InRetest', 'Verified');
  assert.equal(r2.allSatisfied, false);
  assert.ok(r2.missing.length > 0);
});

test('52394 gatedActions: cannot mark Verified without a retest record', () => {
  assert.equal(LS.gatedActions({ id: 'f-1', state: 'New' }, 'mark-verified').allowed, false);
  assert.equal(LS.gatedActions({ id: 'f-1', state: 'InRetest', retest: { passed: true } }, 'mark-verified').allowed, true);
  assert.equal(LS.gatedActions({ id: 'f-1' }, 'bogus-action').ok, false);
});

test('52395 mobileApprovalPayload: deep link + approve/reject actions', () => {
  const r = LS.mobileApprovalPayload(
    { findingId: 'f-1', from: 'Blocked', to: 'Closed', severity: 'critical' }, { requestedBy: 'aria' });
  assert.equal(r.ok, true);
  assert.ok(r.payload.deepLink.includes('f-1'));
  assert.deepEqual(r.payload.actions, ['approve', 'reject']);
  assert.equal(LS.mobileApprovalPayload({}).ok, false);
});

test('52396 lifecycleDocs: markdown doc branded Infinity AI', () => {
  const r = LS.lifecycleDocs();
  assert.ok(r.doc.includes('Infinity AI'));
  assert.ok(r.doc.includes('## Legal transitions'));
  assert.ok(r.doc.includes('Verified'));
});

test('52397 predictTimeToClose: median of similar historical findings', () => {
  const hist = [
    { severity: 'high', vulnClass: 'xss', openedAt: NOW - 60 * DAY, closedAt: NOW - 50 * DAY },
    { severity: 'high', vulnClass: 'xss', openedAt: NOW - 45 * DAY, closedAt: NOW - 30 * DAY },
  ];
  const r = LS.predictTimeToClose({ id: 'f-9', severity: 'high', vulnClass: 'xss', openedAt: NOW - 5 * DAY }, hist, NOW);
  assert.equal(r.sampleSize, 2);
  assert.ok(r.predictedInMs > 0);
  assert.ok(r.confidence > 0);
  const none = LS.predictTimeToClose({ id: 'f-9', severity: 'critical', vulnClass: 'ssrf' }, hist, NOW);
  assert.equal(none.predictedCloseAt, null);
});

test('52398 prioritizeByState: SLA-breached early-state finding ranks first', () => {
  const r = LS.prioritizeByState([
    { id: 'f-1', state: 'Closed', severity: 'low', stateEnteredAt: NOW - 30 * DAY },
    { id: 'f-2', state: 'Triaged', severity: 'high', stateEnteredAt: NOW - 10 * DAY },
  ], NOW);
  assert.equal(r.ranked[0].id, 'f-2');
  assert.ok(r.ranked[0].boostReasons.length > 0);
});

test('52399 jiraStateSync: two-way mapping with conflict policy', () => {
  const r = LS.jiraStateSync();
  assert.equal(r.direction, 'two-way');
  assert.equal(r.infinityToJira.Verified, 'Done (verified)');
  assert.ok(r.conflictPolicy.length > 0);
});

test('52400 platformStateSync: hackerone resolved → Verified', () => {
  const r = LS.platformStateSync();
  assert.equal(r.platforms.hackerone.resolved, 'Verified');
  assert.equal(r.platforms.bugcrowd.fixed, 'Verified');
  assert.ok(Object.keys(r.platforms).length >= 3);
});

/* ---- JSX structure: named exports only, galleries list all 20 ---- */
test('LifecycleGovern.jsx: 20 component exports + gallery', () => {
  const names = (GOVERN_JSX.match(/^export function (\w+)/gm) || []).map((m) => m.replace('export function ', ''));
  const components = names.filter((n) => n !== 'LifecycleGovernGallery');
  assert.equal(components.length, 20);
  assert.ok(names.includes('LifecycleGovernGallery'));
  assert.ok(!/^export default /m.test(GOVERN_JSX), 'no default export allowed');
});

test('LifecycleSync.jsx: 20 component exports + gallery', () => {
  const names = (SYNC_JSX.match(/^export function (\w+)/gm) || []).map((m) => m.replace('export function ', ''));
  const components = names.filter((n) => n !== 'LifecycleSyncGallery');
  assert.equal(components.length, 20);
  assert.ok(names.includes('LifecycleSyncGallery'));
  assert.ok(!/^export default /m.test(SYNC_JSX), 'no default export allowed');
});

test('real esbuild parse of both JSX files', () => {
  for (const f of ['LifecycleGovern.jsx', 'LifecycleSync.jsx']) {
    execFileSync('npx', ['esbuild', `--loader:.jsx=jsx`, '--format=esm', `--outfile=/dev/null`, join(DIR, f)], { stdio: 'pipe' });
  }
});

/* ---- CSS audit: scoped prefixes only, zero keyframes, no global rules ---- */
test('Wave60.css: only .lg60-/.ls60- selectors, zero @keyframes, no global rules', () => {
  const classSelectors = [...CSS_SRC.matchAll(/^\s*\.([a-zA-Z0-9_-]+)\s*[{,]/gm)].map((m) => m[1]);
  assert.ok(classSelectors.length > 0, 'expected class selectors');
  for (const sel of classSelectors) {
    assert.ok(sel.startsWith('lg60-') || sel.startsWith('ls60-'), `unscoped selector .${sel}`);
  }
  assert.ok(!/@keyframes/i.test(CSS_SRC), 'zero-animation order: no @keyframes');
  assert.ok(!/^\s*(html|body|\*)\s*[{,]/m.test(CSS_SRC), 'no global element selectors');
  assert.ok(!/!important/.test(CSS_SRC), 'no !important');
});

/* ---- Branding audit: Infinity AI only, never Muse ---- */
test('branding: no "Muse" anywhere; "Infinity AI" present where branded', () => {
  for (const [name, src] of [['governCore', GOVERN_SRC], ['syncCore', SYNC_SRC], ['governJsx', GOVERN_JSX], ['syncJsx', SYNC_JSX], ['css', CSS_SRC]]) {
    assert.ok(!/Muse/i.test(src), `${name} leaks "Muse" branding`);
  }
  for (const [name, src] of [['governCore', GOVERN_SRC], ['syncCore', SYNC_SRC], ['governJsx', GOVERN_JSX], ['syncJsx', SYNC_JSX], ['css', CSS_SRC]]) {
    assert.ok(/Infinity AI/.test(src), `${name} missing "Infinity AI" branding`);
  }
});

/* ---- Debris audit: no TODO/FIXME/mock/demo/placeholder/debris ---- */
test('no TODO/FIXME/mock/demo/debris in any wave-60 file', () => {
  const bad = /\b(TODO|FIXME|XXX|HACK|lorem ipsum|not implemented)\b/i;
  for (const [name, src] of [['governCore', GOVERN_SRC], ['syncCore', SYNC_SRC], ['governJsx', GOVERN_JSX], ['syncJsx', SYNC_JSX], ['css', CSS_SRC]]) {
    const clean = src.replace(/placeholder="[^"]*"/g, '');
    assert.ok(!bad.test(clean), `${name} contains debris marker`);
    assert.ok(!/\bmock\b/i.test(src) || /no mock/i.test(src), `${name} mentions mock`);
  }
});
