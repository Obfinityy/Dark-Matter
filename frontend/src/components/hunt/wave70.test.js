/**
 * wave70.test.js — Infinity AI · Dark-Matter · Wave 70
 * node:test + node:assert/strict. Registry coverage (20/20 for 52761–52780,
 * 20/20 for 52781–52800, zero skips, 40/40 combined), registry titles matched
 * against the idea bank, deterministic spot-checks of every pure function
 * (at least one assertion per idea), a JSX↔core call-shape audit (every
 * exported component calls ≥1 exported core function), Wave70.css
 * scope/zero-animation audits, a real esbuild JSX parse audit, a
 * no-branding-leak audit ("Infinity AI" only) and a no-debris audit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WAVE70_A_IDEAS } from './wave70ACore.js';
import * as EA from './wave70ACore.js';
import { WAVE70_B_IDEAS } from './wave70BCores.js';
import * as EB from './wave70BCores.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const CSS = join(DIR, 'Wave70.css');
const A_SRC = readFileSync(join(DIR, 'wave70ACore.js'), 'utf8');
const B_SRC = readFileSync(join(DIR, 'wave70BCores.js'), 'utf8');
const A_JSX = readFileSync(join(DIR, 'Wave70A.jsx'), 'utf8');
const B_JSX = readFileSync(join(DIR, 'Wave70B.jsx'), 'utf8');
const CSS_SRC = readFileSync(CSS, 'utf8');
const BRAND_SRC = [['A core', A_SRC], ['B core', B_SRC], ['A jsx', A_JSX], ['B jsx', B_JSX], ['css', CSS_SRC]];
const NOW = '2026-10-09T00:00:00Z';

/* ---- Registry coverage: 20/20 + 20/20, zero skips ---- */
test('registry: 20/20 round-6 and bulk part 1 ideas, 20/20 bulk part 2 ideas, zero skips', () => {
  assert.equal(WAVE70_A_IDEAS.length, 20);
  assert.equal(WAVE70_B_IDEAS.length, 20);
  const all = [...WAVE70_A_IDEAS, ...WAVE70_B_IDEAS];
  assert.equal(all.length, 40);
  const ids = all.map(i => i.id);
  assert.deepEqual(ids, Array.from({ length: 40 }, (_, k) => 52761 + k));
  for (const idea of all) {
    assert.equal(idea.skip, false, `idea ${idea.id} skipped`);
    assert.ok(idea.title && idea.title.length > 3, `idea ${idea.id} missing title`);
  }
});

test('registry: titles match idea-bank wording', () => {
  const byId = Object.fromEntries([...WAVE70_A_IDEAS, ...WAVE70_B_IDEAS].map(i => [i.id, i.title.toLowerCase()]));
  assert.ok(byId[52761].includes('historical state search'));
  assert.ok(byId[52762].includes('auto-assign on state entry'));
  assert.ok(byId[52763].includes('throughput leaderboard'));
  assert.ok(byId[52764].includes('transition comment threads'));
  assert.ok(byId[52765].includes('recurring state-review meetings'));
  assert.ok(byId[52766].includes('embeddable state widgets'));
  assert.ok(byId[52767].includes('transition reason templates'));
  assert.ok(byId[52768].includes('state-based assignment rotation'));
  assert.ok(byId[52769].includes('cross-hunt state rollups'));
  assert.ok(byId[52770].includes('state-change digest'));
  assert.ok(byId[52771].includes('lifecycle compliance mapping'));
  assert.ok(byId[52772].includes('inbox multi-select checkboxes'));
  assert.ok(byId[52773].includes('filter-then-select-all'));
  assert.ok(byId[52774].includes('bulk severity reassignment'));
  assert.ok(byId[52775].includes('bulk owner assignment'));
  assert.ok(byId[52776].includes('bulk tagging'));
  assert.ok(byId[52777].includes('batch lifecycle transitions'));
  assert.ok(byId[52778].includes('bulk fp dismissal'));
  assert.ok(byId[52779].includes('selection-wide retest queueing'));
  assert.ok(byId[52780].includes('bulk export'));
  assert.ok(byId[52781].includes('bulk share-link creation'));
  assert.ok(byId[52782].includes('bulk delete with safeguards'));
  assert.ok(byId[52783].includes('bulk finding archival'));
  assert.ok(byId[52784].includes('bulk commenting'));
  assert.ok(byId[52785].includes('bulk bounty-draft creation'));
  assert.ok(byId[52786].includes('bulk ticket linking'));
  assert.ok(byId[52787].includes('bulk due-date setting'));
  assert.ok(byId[52788].includes('bulk priority override'));
  assert.ok(byId[52789].includes('bulk watcher subscription'));
  assert.ok(byId[52790].includes('bulk notification mute'));
  assert.ok(byId[52791].includes('bulk move between hunts'));
  assert.ok(byId[52792].includes('bulk duplicate merging'));
  assert.ok(byId[52793].includes('bulk unmerge'));
  assert.ok(byId[52794].includes('bulk verify-fixed'));
  assert.ok(byId[52795].includes('mass finding reopen'));
  assert.ok(byId[52796].includes('bulk print'));
  assert.ok(byId[52797].includes('bulk id copy'));
  assert.ok(byId[52798].includes('bulk actions api'));
  assert.ok(byId[52799].includes('bulk-action undo'));
  assert.ok(byId[52800].includes('bulk-action approval gate'));
});

/* ---- Wave70 A spot checks (52761–52780) ---- */
test('52761 searchHistoricalStates: previously-held states and reopened counts', () => {
  const rows = [
    { id: 'r1', status: 'closed', history: [{ from: 'verified', to: 'reopened' }, { from: 'verified', to: 'reopened' }, { from: 'verified', to: 'closed' }] },
    { id: 'r2', status: 'closed', history: [{ from: 'verified', to: 'closed' }] },
  ];
  const v = EA.searchHistoricalStates(rows, { states: ['reopened'], minVisits: 2 });
  assert.equal(v.count, 1);
  assert.equal(v.matches[0].id, 'r1');
  assert.equal(v.matches[0].reopenedCount, 2);
  assert.deepEqual(v.queryStates, ['reopened']);
  const all = EA.searchHistoricalStates(rows, {});
  assert.equal(all.count, 2);
});

test('52762 autoAssignOnStateEntry: target mapping, default, unmapped state', () => {
  const src = { id: 'f2', status: 'triaged', target: 'shop.example.com', history: [] };
  const v = EA.autoAssignOnStateEntry(src, { fixing: { 'shop.example.com': 'aarav', default: 'platform' } }, { enteredState: 'fixing', at: NOW });
  assert.equal(v.assigned, true);
  assert.equal(v.assignee, 'aarav');
  assert.equal(v.rule, 'fixing-by-target');
  assert.equal(v.finding.status, 'fixing');
  assert.equal(v.finding.owner, 'aarav');
  assert.equal(src.status, 'triaged');
  const fallback = EA.autoAssignOnStateEntry({ id: 'f9', status: 'triaged', target: 'other.example.com', history: [] }, { fixing: { default: 'platform' } }, { enteredState: 'fixing', at: NOW });
  assert.equal(fallback.assignee, 'platform');
  assert.equal(fallback.rule, 'fixing-default');
  const none = EA.autoAssignOnStateEntry(src, { fixing: { default: 'platform' } }, { enteredState: 'triaged', at: NOW });
  assert.equal(none.assigned, false);
});

test('52763 buildThroughputLeaderboard: opt-in actors ranked by terminal advances', () => {
  const rows = [
    { id: 'f1', history: [{ actor: 'lead-1', to: 'closed', at: '2026-10-07T09:00:00Z' }] },
    { id: 'f2', history: [{ actor: 'lead-1', to: 'dismissed', at: '2026-10-08T09:00:00Z' }, { actor: 'analyst-9', to: 'closed', at: '2026-10-08T10:00:00Z' }] },
    { id: 'f3', history: [{ actor: 'lead-1', to: 'verified', at: '2026-10-08T11:00:00Z' }] },
  ];
  const v = EA.buildThroughputLeaderboard(rows, { participants: ['lead-1'] });
  assert.equal(v.optedIn, true);
  assert.equal(v.count, 1);
  assert.equal(v.leaderboard[0].actor, 'lead-1');
  assert.equal(v.leaderboard[0].advanced, 2);
  const open = EA.buildThroughputLeaderboard(rows, {});
  assert.equal(open.count, 2);
  assert.equal(open.leaderboard[0].advanced, 2);
});

test('52764 buildTransitionThreads: transition threads kept apart from general comments', () => {
  const v = EA.buildTransitionThreads({
    id: 'f1',
    comments: [{ author: 'lead-1', text: 'general note', at: NOW }],
    history: [{ from: 'closed', to: 'reopened', comments: [{ author: 'verifier-1', text: 'still broken', at: NOW }] }],
    transitionComments: [{ from: 'closed', to: 'reopened', author: 'qa-1', text: 'confirmed regression', at: NOW }],
  });
  assert.equal(v.findingId, 'f1');
  assert.equal(v.threadCount, 1);
  assert.equal(v.threads[0].key, 'closed->reopened');
  assert.equal(v.threads[0].commentCount, 2);
  assert.equal(v.transitionCommentCount, 2);
  assert.equal(v.generalComments.length, 1);
  assert.equal(v.generalComments[0].text, 'general note');
});

test('52765 buildReviewMeetingAgenda: non-terminal only, severity then age', () => {
  const v = EA.buildReviewMeetingAgenda([
    { id: 'f3', title: 'C', severity: 'medium', status: 'new', stateEnteredAt: '2026-10-08T00:00:00Z' },
    { id: 'f1', title: 'A', severity: 'critical', status: 'verifying', stateEnteredAt: '2026-10-07T00:00:00Z' },
    { id: 'f5', title: 'E', severity: 'high', status: 'closed', stateEnteredAt: '2026-10-01T00:00:00Z' },
  ], { nowIso: NOW, title: 'Weekly state review' });
  assert.equal(v.count, 2);
  assert.equal(v.items[0].id, 'f1');
  assert.equal(v.items[0].ageHours, 48);
  assert.equal(v.byState.verifying, 1);
  assert.equal(v.generatedAt, NOW);
});

test('52766 buildStateWidgetPayload: counts, average age, embed snippet', () => {
  const v = EA.buildStateWidgetPayload([
    { id: 'f1', status: 'fixing', stateEnteredAt: '2026-10-08T00:00:00Z' },
    { id: 'f2', status: 'fixing', stateEnteredAt: '2026-10-09T00:00:00Z' },
  ], NOW, { huntId: 'hunt-42' });
  assert.equal(v.huntId, 'hunt-42');
  assert.equal(v.total, 2);
  assert.equal(v.countsByState.fixing, 2);
  assert.equal(v.avgAgeHours, 12);
  assert.ok(v.widgetId.startsWith('wdg_'));
  assert.ok(v.embedSnippet.includes(v.widgetId));
});

test('52767 getTransitionReasonTemplates: per-state one-click templates', () => {
  const v = EA.getTransitionReasonTemplates('dismissed', { findingId: 'f9' });
  assert.equal(v.toState, 'dismissed');
  assert.equal(v.count, 2);
  assert.ok(v.templates.every(t => t.state === 'dismissed'));
  assert.ok(v.templates[0].text.length > 10);
  const all = EA.getTransitionReasonTemplates('', {});
  assert.ok(all.count >= 8);
  assert.equal(all.toState, 'all');
});

test('52768 rotateTriagedAssignments: round-robin over the rotation state', () => {
  const rows = [
    { id: 'f3', status: 'triaged' },
    { id: 'f6', status: 'triaged' },
    { id: 'f2', status: 'fixing', assignee: 'meera' },
  ];
  const v = EA.rotateTriagedAssignments(rows, ['aarav', 'meera'], {});
  assert.equal(v.count, 2);
  assert.deepEqual(v.assignments, [{ id: 'f3', assignee: 'aarav', state: 'triaged' }, { id: 'f6', assignee: 'meera', state: 'triaged' }]);
  assert.equal(v.updated[2].assignee, 'meera');
  assert.equal(rows[0].assignee, undefined);
  const empty = EA.rotateTriagedAssignments(rows, [], {});
  assert.equal(empty.count, 0);
});

test('52769 buildCrossHuntRollups: per-state totals across hunts', () => {
  const v = EA.buildCrossHuntRollups([
    { huntId: 'hunt-42', findings: [{ id: 'f1', status: 'fixing' }, { id: 'f5', status: 'closed' }] },
    { huntId: 'hunt-43', findings: [{ id: 'f9', status: 'fixing' }] },
  ]);
  assert.equal(v.huntCount, 2);
  assert.equal(v.totalFindings, 3);
  assert.equal(v.byState.fixing, 2);
  assert.equal(v.byState.closed, 1);
  assert.equal(v.byHunt[0].total, 2);
  assert.equal(v.byHunt[1].countsByState.fixing, 1);
});

test('52770 buildStateChangeDigest: date and watched-hunt filtering', () => {
  const v = EA.buildStateChangeDigest([
    { findingId: 'f1', huntId: 'hunt-42', from: 'verifying', to: 'verified', actor: 'verifier-1', at: NOW },
    { findingId: 'f2', huntId: 'hunt-42', from: 'triaged', to: 'confirmed', actor: 'lead-1', at: NOW },
    { findingId: 'f3', huntId: 'hunt-99', from: 'new', to: 'triaged', actor: 'analyst-1', at: NOW },
    { findingId: 'f4', huntId: 'hunt-42', from: 'new', to: 'triaged', actor: 'analyst-1', at: '2026-10-08T00:00:00Z' },
  ], { date: '2026-10-09', watchedHunts: ['hunt-42'] });
  assert.equal(v.count, 2);
  assert.equal(v.byState.verified, 1);
  assert.equal(v.byHunt['hunt-42'], 2);
  assert.ok(v.summary.includes('Infinity AI'));
});

test('52771 mapLifecycleToCompliance: states mapped to framework controls', () => {
  const v = EA.mapLifecycleToCompliance(['closed', 'verified', 'bogus-state'], { framework: 'soc2' });
  assert.equal(v.framework, 'soc2');
  assert.deepEqual(v.coveredStates, ['closed', 'verified']);
  assert.deepEqual(v.unmappedStates, ['bogus-state']);
  assert.equal(v.mappings[0].control, 'CC7.4');
  assert.ok(v.mappings[0].requirement.includes('evidence'));
  const fromFindings = EA.mapLifecycleToCompliance([{ id: 'f2', status: 'fixing' }], { framework: 'soc2' });
  assert.deepEqual(fromFindings.coveredStates, ['fixing']);
  assert.equal(fromFindings.mappings[0].control, 'CC8.1');
});

test('52772 updateInboxSelection: cross-page toggle and select-page', () => {
  const page = [{ id: 'f1' }, { id: 'f2' }, { id: 'f3' }];
  const toggled = EA.updateInboxSelection(['f1'], page, { type: 'toggle', id: 'f2' });
  assert.deepEqual(toggled.selectedIds, ['f1', 'f2']);
  const pageAll = EA.updateInboxSelection(['f1'], page, { type: 'select-page' });
  assert.deepEqual(pageAll.selectedIds, ['f1', 'f2', 'f3']);
  assert.equal(pageAll.allPageSelected, true);
  assert.equal(pageAll.pageSelectedCount, 3);
  const removed = EA.updateInboxSelection(['f1', 'f2', 'f9'], page, { type: 'deselect-page' });
  assert.deepEqual(removed.selectedIds, ['f9']);
  const cleared = EA.updateInboxSelection(['f1'], page, { type: 'clear' });
  assert.deepEqual(cleared.selectedIds, []);
});

test('52773 selectAllMatchingFilter: whole matching set selected', () => {
  const rows = [
    { id: 'f4', title: 'A', severity: 'low', status: 'verified', target: 'shop.example.com' },
    { id: 'f1', title: 'B', severity: 'critical', status: 'verifying', target: 'shop.example.com' },
    { id: 'f7', title: 'C', severity: 'low', status: 'verified', target: 'api.example.com' },
  ];
  const v = EA.selectAllMatchingFilter(rows, { state: 'verified' }, ['f1']);
  assert.deepEqual(v.selectedIds, ['f4', 'f7']);
  assert.equal(v.count, 2);
  assert.equal(v.mergedCount, 3);
  const searched = EA.selectAllMatchingFilter(rows, { search: 'api.example' }, []);
  assert.deepEqual(searched.selectedIds, ['f7']);
});

test('52774 bulkChangeSeverity: shared justification required and recorded', () => {
  const src = [{ id: 'f3', severity: 'medium', status: 'new' }];
  const v = EA.bulkChangeSeverity(src, 'high', { justification: 'Exploit path confirmed', actor: 'lead-1', at: NOW });
  assert.equal(v.ok, true);
  assert.deepEqual(v.changedIds, ['f3']);
  assert.equal(v.fromSeverities.f3, 'medium');
  assert.equal(v.updated[0].severity, 'high');
  assert.equal(v.updated[0].severityJustification, 'Exploit path confirmed');
  assert.equal(src[0].severity, 'medium');
  const no = EA.bulkChangeSeverity(src, 'high', { actor: 'lead-1', at: NOW });
  assert.equal(no.ok, false);
  const bad = EA.bulkChangeSeverity(src, 'urgent', { justification: 'reason given', actor: 'lead-1', at: NOW });
  assert.equal(bad.ok, false);
});

test('52775 bulkAssignOwners: single owner and round-robin list', () => {
  const rows = [{ id: 'f1' }, { id: 'f2' }, { id: 'f3' }];
  const single = EA.bulkAssignOwners(rows, 'aarav', { actor: 'lead-1', at: NOW });
  assert.equal(single.count, 3);
  assert.ok(single.updated.every(f => f.owner === 'aarav'));
  const rotated = EA.bulkAssignOwners(rows, ['aarav', 'meera'], { actor: 'lead-1', at: NOW });
  assert.deepEqual(rotated.assignments.map(a => a.owner), ['aarav', 'meera', 'aarav']);
  assert.equal(rows[0].owner, undefined);
});

test('52776 bulkUpdateTags: add and remove normalized across selection', () => {
  const src = [{ id: 'f1', tags: ['Search', 'old'] }, { id: 'f2', tags: ['search'] }];
  const v = EA.bulkUpdateTags(src, { add: ['Post-Hunt'], remove: ['old'], actor: 'lead-1', at: NOW });
  assert.deepEqual(v.updated[0].tags, ['search', 'post-hunt']);
  assert.deepEqual(v.updated[1].tags, ['search', 'post-hunt']);
  assert.deepEqual(v.changedIds, ['f1', 'f2']);
  assert.deepEqual(src[0].tags, ['Search', 'old']);
});

test('52777 batchTransitionFindings: one confirmation plus guardrails', () => {
  const held = EA.batchTransitionFindings([{ id: 'f3', status: 'triaged' }], 'confirmed', { actor: 'lead-1', at: NOW, reason: 'review complete' });
  assert.equal(held.ok, false);
  assert.equal(held.okCount, 0);
  const v = EA.batchTransitionFindings([
    { id: 'f3', status: 'triaged', history: [] },
    { id: 'f5', status: 'closed', history: [] },
  ], 'confirmed', { actor: 'lead-1', at: NOW, reason: 'review complete', confirmed: true });
  assert.equal(v.okCount, 1);
  assert.equal(v.blockedCount, 1);
  assert.equal(v.updated[0].status, 'confirmed');
  assert.ok(v.blocked[0].reason.includes('terminal'));
  assert.ok(v.summary.includes('Infinity AI'));
  const needsReason = EA.batchTransitionFindings([{ id: 'f3', status: 'triaged', history: [] }], 'dismissed', { actor: 'lead-1', at: NOW, confirmed: true });
  assert.equal(needsReason.okCount, 0);
});

test('52778 bulkDismissAsFalsePositive: one documented reason for all', () => {
  const src = [{ id: 'f3', status: 'new', history: [] }, { id: 'f8', status: 'dismissed', history: [] }];
  const v = EA.bulkDismissAsFalsePositive(src, { reason: 'Scanner artefact confirmed', actor: 'lead-1', at: NOW });
  assert.equal(v.ok, false);
  assert.deepEqual(v.dismissedIds, ['f3']);
  assert.equal(v.dismissed[0].status, 'dismissed');
  assert.equal(v.dismissed[0].dismissalKind, 'false-positive');
  assert.equal(v.dismissed[0].fpReason, 'Scanner artefact confirmed');
  assert.equal(v.blocked.length, 1);
  assert.equal(src[0].status, 'new');
  const no = EA.bulkDismissAsFalsePositive(src, { actor: 'lead-1', at: NOW });
  assert.equal(no.ok, false);
  assert.ok(no.error.includes('documented reason'));
});

test('52779 queueSelectionRetests: eligible states queued by severity', () => {
  const v = EA.queueSelectionRetests([
    { id: 'f2', status: 'fixing', severity: 'high' },
    { id: 'f1', status: 'verifying', severity: 'critical' },
    { id: 'f3', status: 'new', severity: 'medium' },
  ], { requestedBy: 'verifier-1', at: NOW });
  assert.equal(v.count, 2);
  assert.deepEqual(v.queuedIds, ['f1', 'f2']);
  assert.equal(v.skipped.length, 1);
  assert.equal(v.queue[0].status, 'queued');
  assert.ok(v.queue[0].queueId.startsWith('rt_'));
});

test('52780 exportSelectionBulk: serialized selection with checksum', () => {
  const rows = [
    { id: 'f4', title: 'Verbose errors', severity: 'low', status: 'verified', target: 'shop.example.com' },
    { id: 'f1', title: 'SQLi', severity: 'critical', status: 'verifying', target: 'shop.example.com' },
  ];
  const csv = EA.exportSelectionBulk(rows, 'csv', {});
  assert.equal(csv.rows, 2);
  assert.equal(csv.filename, 'selection-export.csv');
  assert.ok(csv.content.includes('f4'));
  assert.ok(csv.checksum.length > 0);
  const json = EA.exportSelectionBulk(rows, 'json', {});
  assert.ok(json.content.includes('Infinity AI'));
  assert.equal(json.format, 'json');
});

/* ---- Wave70 B spot checks (52781–52800) ---- */
test('52781 createBulkShareLink: one deterministic link for the selection', () => {
  const rows = [{ id: 'f2' }, { id: 'f1' }];
  const v = EB.createBulkShareLink(rows, { createdBy: 'lead-1', expiresAt: '2026-10-16T00:00:00Z' });
  assert.equal(v.count, 2);
  assert.deepEqual(v.findingIds, ['f2', 'f1']);
  assert.ok(v.url.includes(v.token));
  assert.equal(v.expiresAt, '2026-10-16T00:00:00Z');
  const again = EB.createBulkShareLink([{ id: 'f1' }, { id: 'f2' }], { createdBy: 'lead-1' });
  assert.equal(again.token, v.token);
});

test('52782 bulkDeleteWithSafeguards: typed confirmation gates deletion with audit', () => {
  const rows = [{ id: 'f1', title: 'A' }, { id: 'f2', title: 'B' }];
  const refused = EB.bulkDeleteWithSafeguards(rows, { confirmation: 'DELETE', actor: 'lead-1', at: NOW });
  assert.equal(refused.ok, false);
  assert.equal(refused.requiredConfirmation, 'DELETE 2');
  assert.deepEqual(refused.deletedIds, []);
  const v = EB.bulkDeleteWithSafeguards(rows, { confirmation: 'DELETE 2', actor: 'lead-1', at: NOW });
  assert.equal(v.ok, true);
  assert.deepEqual(v.deletedIds, ['f1', 'f2']);
  assert.equal(v.auditEntries.length, 2);
  assert.equal(v.auditEntries[0].actor, 'lead-1');
  assert.equal(v.auditEntries[0].source, 'Infinity AI');
});

test('52783 bulkArchiveSelection: shared settings and preserved states', () => {
  const src = [{ id: 'f2', status: 'fixing' }, { id: 'f5', status: 'closed' }];
  const v = EB.bulkArchiveSelection(src, { archivedBy: 'lead-1', at: NOW, settings: { reason: 'Hunt closed', retentionDays: 180 } });
  assert.equal(v.count, 2);
  assert.equal(v.archived[0].preservedState, 'fixing');
  assert.equal(v.archived[0].archived, true);
  assert.equal(v.settings.retentionDays, 180);
  assert.deepEqual(v.byState, { fixing: 1, closed: 1 });
  assert.equal(src[0].archived, undefined);
});

test('52784 bulkPostComment: same comment, separate per-finding records', () => {
  const src = [{ id: 'f1', comments: [] }, { id: 'f2', comments: [{ author: 'a', text: 'earlier', at: NOW }] }];
  const v = EB.bulkPostComment(src, 'Retest window opens Monday', { author: 'lead-1', at: NOW });
  assert.equal(v.ok, true);
  assert.equal(v.count, 2);
  assert.equal(v.updated[0].comments.length, 1);
  assert.equal(v.updated[1].comments.length, 2);
  assert.notEqual(v.updated[0].comments[0].id, v.updated[1].comments[0].id);
  assert.equal(src[0].comments.length, 0);
  const empty = EB.bulkPostComment(src, '', { author: 'lead-1', at: NOW });
  assert.equal(empty.ok, false);
});

test('52785 createBountyDrafts: one platform draft per finding', () => {
  const v = EB.createBountyDrafts([{ id: 'f1', title: 'SQLi in checkout', severity: 'critical', target: 'shop.example.com', evidence: ['payload reflects'] }], { platform: 'bug-platform', submitter: 'lead-1' });
  assert.equal(v.count, 1);
  assert.equal(v.platform, 'bug-platform');
  assert.equal(v.drafts[0].status, 'draft');
  assert.equal(v.drafts[0].title, '[critical] SQLi in checkout');
  assert.ok(v.drafts[0].body.includes('shop.example.com'));
  assert.ok(v.drafts[0].draftId.startsWith('dr_'));
});

test('52786 linkFindingsToTickets: per-finding mapping and shared ticket', () => {
  const rows = [{ id: 'f1' }, { id: 'f2' }, { id: 'f3' }];
  const v = EB.linkFindingsToTickets(rows, { f1: 'SEC-101', f2: 'SEC-102' }, { provider: 'jira' });
  assert.equal(v.count, 2);
  assert.deepEqual(v.skippedIds, ['f3']);
  assert.equal(v.updated[0].ticketUrl, 'https://tracker.example.com/browse/SEC-101');
  assert.equal(rows[0].ticketId, undefined);
  const shared = EB.linkFindingsToTickets(rows, 'SEC-100', { provider: 'jira' });
  assert.equal(shared.count, 3);
});

test('52787 bulkSetDueDates: explicit date and severity defaults', () => {
  const explicit = EB.bulkSetDueDates([{ id: 'f1', severity: 'critical' }], { dueAt: '2026-11-01T00:00:00Z', actor: 'lead-1' });
  assert.equal(explicit.updated[0].dueAt, '2026-11-01T00:00:00Z');
  assert.equal(explicit.count, 1);
  const defaults = EB.bulkSetDueDates([{ id: 'f1', severity: 'critical' }, { id: 'f3', severity: 'medium' }], { nowIso: NOW, actor: 'lead-1' });
  assert.equal(defaults.updated[0].dueAt, '2026-10-12T00:00:00.000Z');
  assert.equal(defaults.updated[1].dueAt, '2026-10-23T00:00:00.000Z');
  const shifted = EB.bulkSetDueDates([{ id: 'f2', severity: 'high', dueAt: '2026-10-15T00:00:00Z' }], { shiftDays: 2, nowIso: NOW, actor: 'lead-1' });
  assert.equal(shifted.updated[0].dueAt, '2026-10-17T00:00:00.000Z');
});

test('52788 bulkSetPriorityOverride: sprint flag stored apart from severity', () => {
  const src = [{ id: 'f1', severity: 'low' }];
  const v = EB.bulkSetPriorityOverride(src, { priority: 'sprint-now', reason: 'Sprint planning', actor: 'lead-1', at: NOW });
  assert.equal(v.count, 1);
  assert.deepEqual(v.flaggedIds, ['f1']);
  assert.equal(v.updated[0].priorityOverride, 'sprint-now');
  assert.equal(v.updated[0].priorityFlag, true);
  assert.equal(v.updated[0].severity, 'low');
  assert.equal(src[0].priorityOverride, undefined);
});

test('52789 bulkAddWatchers: watchers unioned without duplicates', () => {
  const src = [{ id: 'f1', watchers: ['aarav'] }, { id: 'f2', watchers: [] }];
  const v = EB.bulkAddWatchers(src, ['aarav', 'qa-1'], {});
  assert.deepEqual(v.updated[0].watchers, ['aarav', 'qa-1']);
  assert.deepEqual(v.updated[1].watchers, ['aarav', 'qa-1']);
  assert.deepEqual(v.watchersAdded, ['aarav', 'qa-1']);
  assert.deepEqual(src[0].watchers, ['aarav']);
});

test('52790 bulkMuteNotifications: mute window recorded per finding', () => {
  const v = EB.bulkMuteNotifications([{ id: 'f1' }], { mutedBy: 'lead-1', at: NOW, muteUntil: '2026-10-12T00:00:00Z', reason: 'Fix in progress' });
  assert.equal(v.count, 1);
  assert.deepEqual(v.mutedIds, ['f1']);
  assert.equal(v.updated[0].notificationsMuted, true);
  assert.equal(v.updated[0].muteUntil, '2026-10-12T00:00:00Z');
  assert.equal(v.muteUntil, '2026-10-12T00:00:00Z');
});

test('52791 bulkMoveToHunt: origin recorded, target required', () => {
  const src = [{ id: 'f1', huntId: 'hunt-42', history: [] }];
  const v = EB.bulkMoveToHunt(src, 'hunt-43', { actor: 'lead-1', at: NOW });
  assert.equal(v.ok, true);
  assert.equal(v.updated[0].huntId, 'hunt-43');
  assert.equal(v.updated[0].movedFromHunt, 'hunt-42');
  assert.equal(v.updated[0].history.length, 1);
  assert.equal(src[0].huntId, 'hunt-42');
  const no = EB.bulkMoveToHunt(src, '', { actor: 'lead-1', at: NOW });
  assert.equal(no.ok, false);
});

test('52792 mergeIntoCanonical: evidence unioned, duplicates point at canonical', () => {
  const rows = [
    { id: 'f1', status: 'verifying', evidence: ['a', 'b'], tags: ['checkout'], history: [] },
    { id: 'f2', status: 'fixing', evidence: ['b', 'c'], tags: ['variant'], history: [] },
  ];
  const v = EB.mergeIntoCanonical(rows, 'f1', { actor: 'lead-1', at: NOW });
  assert.equal(v.ok, true);
  assert.deepEqual(v.mergedIds, ['f2']);
  assert.deepEqual(v.evidence, ['a', 'b', 'c']);
  assert.deepEqual(v.canonical.tags, ['checkout', 'variant']);
  assert.equal(v.duplicates[0].status, 'duplicate');
  assert.equal(v.duplicates[0].canonicalId, 'f1');
  assert.equal(rows[1].status, 'fixing');
  const missing = EB.mergeIntoCanonical(rows, 'nope', { actor: 'lead-1', at: NOW });
  assert.equal(missing.ok, false);
});

test('52793 unmergeMergedFinding: originals restored with history preserved', () => {
  const merged = {
    id: 'f1',
    mergedFrom: [
      { id: 'f1b', status: 'duplicate', history: [{ from: 'new', to: 'duplicate', actor: 'lead-1', at: NOW, reason: 'merged' }] },
      { id: 'f1c', status: 'duplicate', history: [] },
    ],
  };
  const v = EB.unmergeMergedFinding(merged, { actor: 'lead-1', at: NOW });
  assert.equal(v.ok, true);
  assert.equal(v.count, 2);
  assert.equal(v.canonicalId, 'f1');
  assert.deepEqual(v.restored.map(f => f.id), ['f1b', 'f1c']);
  assert.equal(v.restored[0].history.length, 2);
  const empty = EB.unmergeMergedFinding({ id: 'f9' }, { actor: 'lead-1', at: NOW });
  assert.equal(empty.ok, false);
});

test('52794 bulkVerifyFixed: fix states verified, others blocked', () => {
  const v = EB.bulkVerifyFixed([
    { id: 'f1', status: 'verifying', history: [] },
    { id: 'f2', status: 'fixing', history: [] },
    { id: 'f3', status: 'new', history: [] },
  ], { verifiedBy: 'verifier-1', at: NOW, evidence: 'retest passed' });
  assert.deepEqual(v.verifiedIds, ['f1', 'f2']);
  assert.equal(v.blocked.length, 1);
  assert.equal(v.verified[0].status, 'verified');
  assert.equal(v.verified[0].verifiedBy, 'verifier-1');
});

test('52795 bulkReopenFindings: shared reason, reopenable states only', () => {
  const src = [
    { id: 'f5', status: 'closed', history: [] },
    { id: 'f4', status: 'verified', history: [] },
    { id: 'f2', status: 'fixing', history: [] },
  ];
  const v = EB.bulkReopenFindings(src, { reason: 'Regression sweep', actor: 'verifier-1', at: NOW });
  assert.deepEqual(v.reopenedIds, ['f5', 'f4']);
  assert.equal(v.blocked.length, 1);
  assert.equal(v.reopened[0].status, 'reopened');
  assert.equal(v.reopened[0].history[0].reason, 'Regression sweep');
  assert.equal(src[0].status, 'closed');
  const no = EB.bulkReopenFindings(src, { actor: 'verifier-1', at: NOW });
  assert.equal(no.ok, false);
});

test('52796 buildBulkPrintPayload: severity-ordered print sections', () => {
  const v = EB.buildBulkPrintPayload([
    { id: 'f3', title: 'C', severity: 'medium', status: 'new', target: 'api.example.com', evidence: [] },
    { id: 'f1', title: 'A', severity: 'critical', status: 'verifying', target: 'shop.example.com', evidence: ['e1'] },
  ], { title: 'Sprint review pack', generatedAt: NOW });
  assert.equal(v.count, 2);
  assert.equal(v.sections[0].findingId, 'f1');
  assert.ok(v.text.includes('Infinity AI'));
  assert.ok(v.text.includes('Sprint review pack'));
  assert.ok(v.checksum.length > 0);
});

test('52797 buildIdCopyPayload: ids, urls, and pairs text blocks', () => {
  const rows = [{ id: 'f1' }, { id: 'f2' }];
  const pairs = EB.buildIdCopyPayload(rows, { format: 'pairs' });
  assert.equal(pairs.count, 2);
  assert.equal(pairs.format, 'pairs');
  assert.ok(pairs.text.includes('f1 https://dark-matter.example.com/findings/f1'));
  assert.deepEqual(pairs.ids, ['f1', 'f2']);
  const idsOnly = EB.buildIdCopyPayload(rows, { format: 'ids' });
  assert.equal(idsOnly.text, 'f1\nf2');
  const urls = EB.buildIdCopyPayload(rows, { format: 'urls' });
  assert.ok(urls.text.startsWith('https://'));
});

test('52798 describeBulkActionsApi: endpoints and job tracking model', () => {
  const v = EB.describeBulkActionsApi({});
  assert.equal(v.apiVersion, 'v1');
  assert.equal(v.basePath, '/api/v1/bulk-actions');
  assert.equal(v.count, 20);
  assert.equal(v.endpoints.length, 20);
  assert.ok(v.jobStatuses.includes('queued'));
  assert.ok(v.jobStatuses.includes('completed'));
  assert.equal(v.endpoints[0].method, 'POST');
  assert.ok(v.endpoints[0].jobPath.includes('/jobs/'));
});

test('52799 undoBulkOperation: prior values restored inside grace window', () => {
  const op = { action: 'severity', performedAt: '2026-10-09T00:00:00Z', changes: [{ findingId: 'f3', field: 'severity', before: 'medium', after: 'high' }] };
  const v = EB.undoBulkOperation(op, { nowIso: '2026-10-09T00:30:00Z', graceMinutes: 60 });
  assert.equal(v.undoable, true);
  assert.equal(v.elapsedMinutes, 30);
  assert.deepEqual(v.restored, [{ findingId: 'f3', field: 'severity', restoredValue: 'medium' }]);
  assert.equal(v.expiresAt, '2026-10-09T01:00:00.000Z');
  const late = EB.undoBulkOperation(op, { nowIso: '2026-10-09T02:00:00Z', graceMinutes: 60 });
  assert.equal(late.undoable, false);
  assert.deepEqual(late.restored, []);
});

test('52800 evaluateBulkApprovalGate: destructive and large batches gated', () => {
  const gated = EB.evaluateBulkApprovalGate('delete', { actorRole: 'analyst', count: 3, maxSeverity: 'high' });
  assert.equal(gated.destructive, true);
  assert.equal(gated.requiresApproval, true);
  assert.equal(gated.allowed, false);
  assert.ok(gated.reason.includes('approval required'));
  const approved = EB.evaluateBulkApprovalGate('delete', { actorRole: 'analyst', count: 3, maxSeverity: 'high', approvedBy: 'lead-1', approverRole: 'lead' });
  assert.equal(approved.allowed, true);
  const free = EB.evaluateBulkApprovalGate('assign-owner', { actorRole: 'analyst', count: 5, maxSeverity: 'low' });
  assert.equal(free.requiresApproval, false);
  assert.equal(free.allowed, true);
  const large = EB.evaluateBulkApprovalGate('tag', { actorRole: 'analyst', count: 30, maxSeverity: 'low' });
  assert.equal(large.requiresApproval, true);
  assert.equal(large.allowed, false);
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
test('css: only .w70a-/.w70b- scoped selectors, no globals', () => {
  const noComments = CSS_SRC.replace(/\/\*[\s\S]*?\*\//g, '');
  const classSelectors = [...noComments.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map(m => m[1]);
  assert.ok(classSelectors.length > 10, 'expected many scoped selectors');
  for (const cls of classSelectors) {
    assert.ok(cls.startsWith('w70a-') || cls.startsWith('w70b-'), `unscoped selector: .${cls}`);
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
  for (const f of ['Wave70A.jsx', 'Wave70B.jsx']) {
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
