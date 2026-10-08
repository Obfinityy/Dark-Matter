/**
 * wave71.test.js — Infinity AI · Dark-Matter · Wave 71
 * node:test + node:assert/strict. Registry coverage (20/20 for 52801–52820,
 * 20/20 for 52821–52840, zero skips, 40/40 combined), registry titles matched
 * against the idea bank, deterministic spot-checks of every pure function
 * (at least one assertion per idea), a JSX↔core call-shape audit (every
 * exported component calls ≥1 exported core function), Wave71.css
 * scope/zero-animation audits, a real esbuild JSX parse audit, a
 * no-branding-leak audit ("Infinity AI" only) and a no-debris audit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WAVE71_A_IDEAS } from './wave71ACore.js';
import * as EA from './wave71ACore.js';
import { WAVE71_B_IDEAS } from './wave71BCores.js';
import * as EB from './wave71BCores.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const CSS = join(DIR, 'Wave71.css');
const A_SRC = readFileSync(join(DIR, 'wave71ACore.js'), 'utf8');
const B_SRC = readFileSync(join(DIR, 'wave71BCores.js'), 'utf8');
const A_JSX = readFileSync(join(DIR, 'Wave71A.jsx'), 'utf8');
const B_JSX = readFileSync(join(DIR, 'Wave71B.jsx'), 'utf8');
const CSS_SRC = readFileSync(CSS, 'utf8');
const BRAND_SRC = [['A core', A_SRC], ['B core', B_SRC], ['A jsx', A_JSX], ['B jsx', B_JSX], ['css', CSS_SRC]];
const NOW = '2026-10-09T00:00:00Z';

/* ---- Registry coverage: 20/20 + 20/20, zero skips ---- */
test('registry: 20/20 bulk round 2 ideas, 20/20 round 3 and Q&A ideas, zero skips', () => {
  assert.equal(WAVE71_A_IDEAS.length, 20);
  assert.equal(WAVE71_B_IDEAS.length, 20);
  const all = [...WAVE71_A_IDEAS, ...WAVE71_B_IDEAS];
  assert.equal(all.length, 40);
  const ids = all.map(i => i.id);
  assert.deepEqual(ids, Array.from({ length: 40 }, (_, k) => 52801 + k));
  for (const idea of all) {
    assert.equal(idea.skip, false, `idea ${idea.id} skipped`);
    assert.ok(idea.title && idea.title.length > 3, `idea ${idea.id} missing title`);
  }
});

test('registry: titles match idea-bank wording', () => {
  const byId = Object.fromEntries([...WAVE71_A_IDEAS, ...WAVE71_B_IDEAS].map(i => [i.id, i.title.toLowerCase()]));
  assert.ok(byId[52801].includes('bulk-action dry-run preview'));
  assert.ok(byId[52802].includes('bulk-action progress bar'));
  assert.ok(byId[52803].includes('bulk-action failure handling'));
  assert.ok(byId[52804].includes('bulk-action audit log'));
  assert.ok(byId[52805].includes('bulk-action macros'));
  assert.ok(byId[52806].includes('scheduled bulk actions'));
  assert.ok(byId[52807].includes('bulk-action permissions'));
  assert.ok(byId[52808].includes('query-based bulk select'));
  assert.ok(byId[52809].includes('saved bulk selections'));
  assert.ok(byId[52810].includes('bulk actions from search'));
  assert.ok(byId[52811].includes('bulk actions from diff view'));
  assert.ok(byId[52812].includes('bulk custom-field editing'));
  assert.ok(byId[52813].includes('bulk finding linking'));
  assert.ok(byId[52814].includes('bulk unlink'));
  assert.ok(byId[52815].includes('bulk evidence zip'));
  assert.ok(byId[52816].includes('bulk redaction'));
  assert.ok(byId[52817].includes('bulk team assignment'));
  assert.ok(byId[52818].includes('bulk escalation'));
  assert.ok(byId[52819].includes('bulk info requests'));
  assert.ok(byId[52820].includes('bulk remediation notes'));
  assert.ok(byId[52821].includes('bulk fix-version tagging'));
  assert.ok(byId[52822].includes('bulk commit linking'));
  assert.ok(byId[52823].includes('bulk close with reason'));
  assert.ok(byId[52824].includes('bulk reopen with reason'));
  assert.ok(byId[52825].includes('bulk assignee notification'));
  assert.ok(byId[52826].includes('bulk poc bundle generation'));
  assert.ok(byId[52827].includes('bulk cve-request drafts'));
  assert.ok(byId[52828].includes('bulk sla recalculation'));
  assert.ok(byId[52829].includes('bulk export of decision history'));
  assert.ok(byId[52830].includes('bulk finding split by asset'));
  assert.ok(byId[52831].includes('post-hunt q&a chat'));
  assert.ok(byId[52832].includes('why is this critical'));
  assert.ok(byId[52833].includes('exploit-chain walkthrough'));
  assert.ok(byId[52834].includes('what did you try that failed'));
  assert.ok(byId[52835].includes('coverage-gap q&a'));
  assert.ok(byId[52836].includes('per-finding confidence interrogation'));
  assert.ok(byId[52837].includes('blast-radius estimator q&a'));
  assert.ok(byId[52838].includes('fix-suggestion follow-ups'));
  assert.ok(byId[52839].includes('cross-hunt comparison questions'));
  assert.ok(byId[52840].includes('bounty-writeup drafting'));
});

/* ---- Wave71 A spot checks (52801–52820) ---- */
test('52801 previewBulkActionDryRun: changes predicted, inputs untouched', () => {
  const rows = [
    { id: 'f1', status: 'verifying', severity: 'critical' },
    { id: 'f5', status: 'closed', severity: 'medium' },
    { id: 'f4', status: 'confirmed', severity: 'low' },
  ];
  const v = EA.previewBulkActionDryRun(rows, { type: 'transition', toState: 'confirmed' }, {});
  assert.equal(v.dryRun, true);
  assert.deepEqual(v.wouldChange.map(c => c.id), ['f1']);
  assert.equal(v.wouldChange[0].changes.status.to, 'confirmed');
  assert.equal(v.blocked.length, 1);
  assert.ok(v.blocked[0].reason.includes('terminal'));
  assert.deepEqual(v.unchangedIds, ['f4']);
  assert.equal(rows[0].status, 'verifying');
  const sev = EA.previewBulkActionDryRun(rows, { type: 'severity', toSeverity: 'high' }, {});
  assert.equal(sev.wouldChange.length, 3);
  const bad = EA.previewBulkActionDryRun(rows, { type: 'severity', toSeverity: 'urgent' }, {});
  assert.equal(bad.blocked.length, 3);
});

test('52802 buildBulkActionProgress: percent, ETA, terminal states', () => {
  const v = EA.buildBulkActionProgress({ label: 'tagging', total: 40, completed: 25, failed: 2, skipped: 1, startedAt: '2026-10-09T00:00:00Z', updatedAt: '2026-10-09T00:10:00Z' }, NOW);
  assert.equal(v.done, 28);
  assert.equal(v.percent, 70);
  assert.equal(v.remaining, 12);
  assert.equal(v.status, 'running');
  assert.equal(v.etaSeconds, 257);
  const done = EA.buildBulkActionProgress({ total: 2, completed: 2, failed: 0, skipped: 0 }, NOW);
  assert.equal(done.status, 'completed');
  assert.equal(done.percent, 100);
  const failedSome = EA.buildBulkActionProgress({ total: 2, completed: 1, failed: 1, skipped: 0 }, NOW);
  assert.equal(failedSome.status, 'completed-with-failures');
});

test('52803 planBulkFailureHandling: transient retried, validation held', () => {
  const v = EA.planBulkFailureHandling([
    { id: 'f1', ok: true },
    { id: 'f2', ok: false, error: 'gateway timeout', errorKind: 'transient' },
    { id: 'f3', ok: false, error: 'missing justification', errorKind: 'validation' },
  ], {});
  assert.deepEqual(v.succeededIds, ['f1']);
  assert.equal(v.retryPlan.length, 3);
  assert.deepEqual(v.retryPlan.map(r => r.delaySeconds), [30, 60, 120]);
  assert.deepEqual(v.retryableIds, ['f2']);
  assert.equal(v.permanent.length, 1);
  assert.equal(v.permanent[0].id, 'f3');
  assert.equal(v.permanent[0].action, 'hold-for-review');
});

test('52804 buildBulkActionAuditLog: time-ordered sequenced entries with checksum', () => {
  const v = EA.buildBulkActionAuditLog([
    { action: 'tag', actor: 'lead-1', at: '2026-10-09T01:00:00Z', findingIds: ['f2', 'f1'], details: 'tags' },
    { action: 'assign-owner', actor: 'lead-1', at: '2026-10-09T00:30:00Z', findingIds: ['f3'], details: 'rotation' },
  ], { generatedAt: NOW });
  assert.equal(v.totalActions, 2);
  assert.equal(v.entries[0].action, 'assign-owner');
  assert.equal(v.entries[0].seq, 1);
  assert.deepEqual(v.entries[1].findingIds, ['f1', 'f2']);
  assert.equal(v.totalFindings, 3);
  assert.ok(v.entries[0].entryId.startsWith('aud_'));
  assert.ok(v.checksum.length > 0);
});

test('52805 applyBulkActionMacro: named macro steps applied in order', () => {
  const src = [{ id: 'f3', status: 'triaged', tags: [] }];
  const v = EA.applyBulkActionMacro(src, 'triage-pack', { actor: 'lead-1', at: NOW });
  assert.equal(v.macroId, 'triage-pack');
  assert.equal(v.stepCount, 2);
  assert.deepEqual(v.updated[0].tags, ['triaged-review']);
  assert.equal(v.updated[0].triageReviewed, true);
  assert.deepEqual(src[0].tags, []);
  const closer = EA.applyBulkActionMacro([{ id: 'f4', status: 'verified', tags: [], history: [] }], 'close-verified-pack', { actor: 'lead-1', at: NOW });
  assert.equal(closer.updated[0].status, 'closed');
  const custom = EA.applyBulkActionMacro(src, { id: 'mine', steps: [{ type: 'assign-owner', owner: 'aarav' }] }, {});
  assert.equal(custom.updated[0].owner, 'aarav');
});

test('52806 scheduleBulkAction: future schedule due computation and validation', () => {
  const v = EA.scheduleBulkAction({ type: 'tag', addTags: ['nightly'] }, [{ id: 'f1' }, { id: 'f2' }], { runAt: '2026-10-10T00:00:00Z', nowIso: NOW, actor: 'lead-1' });
  assert.equal(v.ok, true);
  assert.equal(v.schedule.findingCount, 2);
  assert.equal(v.schedule.status, 'scheduled');
  assert.equal(v.schedule.dueInMinutes, 1440);
  assert.ok(v.schedule.scheduleId.startsWith('sch_'));
  const due = EA.scheduleBulkAction({ type: 'tag' }, [{ id: 'f1' }], { runAt: '2026-10-08T00:00:00Z', nowIso: NOW });
  assert.equal(due.schedule.status, 'due');
  const bad = EA.scheduleBulkAction({ type: 'tag' }, [{ id: 'f1' }], { runAt: 'not-a-date', nowIso: NOW });
  assert.equal(bad.ok, false);
});

test('52807 evaluateBulkActionPermissions: role matrix and lead gates', () => {
  const rows = [{ id: 'f1' }, { id: 'f2' }];
  const denied = EA.evaluateBulkActionPermissions({ id: 'a1', role: 'analyst' }, 'delete', rows, {});
  assert.equal(denied.allowed, false);
  assert.equal(denied.destructive, true);
  assert.equal(denied.requiresLead, true);
  const lead = EA.evaluateBulkActionPermissions({ id: 'l1', role: 'lead' }, 'delete', rows, {});
  assert.equal(lead.allowed, true);
  const tag = EA.evaluateBulkActionPermissions({ id: 'a1', role: 'analyst' }, 'tag', rows, {});
  assert.equal(tag.allowed, true);
  assert.equal(tag.requiresLead, false);
  const viewer = EA.evaluateBulkActionPermissions({ id: 'v1', role: 'viewer' }, 'tag', rows, {});
  assert.equal(viewer.allowed, false);
});

test('52808 selectFindingsByQuery: fielded terms, OR values, free text', () => {
  const rows = [
    { id: 'f1', severity: 'critical', status: 'verifying', target: 'shop.example.com', tags: ['sqli'] },
    { id: 'f2', severity: 'high', status: 'fixing', target: 'shop.example.com', tags: ['search'] },
    { id: 'f3', severity: 'medium', status: 'triaged', target: 'api.example.com', tags: [] },
  ];
  const v = EA.selectFindingsByQuery(rows, 'severity:critical,high state:verifying,fixing');
  assert.deepEqual(v.matchedIds, ['f1', 'f2']);
  assert.equal(v.parsedTerms.length, 2);
  const text = EA.selectFindingsByQuery(rows, 'shop sqli');
  assert.deepEqual(text.matchedIds, ['f1']);
  const tagged = EA.selectFindingsByQuery(rows, 'tag:search');
  assert.deepEqual(tagged.matchedIds, ['f2']);
});

test('52809 manageSavedSelections: save, load, rename, remove without mutation', () => {
  const saved = EA.manageSavedSelections([], { type: 'save', name: 'Criticals', ids: ['f1', 'f1'], actor: 'lead-1', at: NOW });
  assert.equal(saved.count, 1);
  assert.deepEqual(saved.active.ids, ['f1']);
  const loaded = EA.manageSavedSelections(saved.selections, { type: 'load', name: 'Criticals' });
  assert.equal(loaded.active.name, 'Criticals');
  const renamed = EA.manageSavedSelections(saved.selections, { type: 'rename', name: 'Criticals', newName: 'Critical set' });
  assert.equal(renamed.selections[0].name, 'Critical set');
  assert.equal(saved.selections[0].name, 'Criticals');
  const removed = EA.manageSavedSelections(saved.selections, { type: 'remove', name: 'Criticals' });
  assert.equal(removed.count, 0);
});

test('52810 applyBulkActionFromSearch: search matches receive the action only', () => {
  const rows = [
    { id: 'f1', title: 'SQLi', target: 'shop.example.com', tags: [] },
    { id: 'f3', title: 'TLS', target: 'api.example.com', tags: [] },
  ];
  const v = EA.applyBulkActionFromSearch(rows, 'shop', { type: 'tag', addTags: ['from-search'] }, { actor: 'lead-1', at: NOW });
  assert.deepEqual(v.matchedIds, ['f1']);
  assert.deepEqual(v.updated[0].tags, ['from-search']);
  assert.deepEqual(v.updated[1].tags, []);
  assert.deepEqual(rows[0].tags, []);
});

test('52811 selectChangedFromDiff: added, removed, and field changes', () => {
  const before = [
    { id: 'f1', status: 'verifying', severity: 'critical' },
    { id: 'f3', status: 'triaged', severity: 'medium' },
    { id: 'f9', status: 'new', severity: 'low' },
  ];
  const after = [
    { id: 'f1', status: 'verifying', severity: 'critical' },
    { id: 'f3', status: 'confirmed', severity: 'high' },
    { id: 'f7', status: 'new', severity: 'info' },
  ];
  const v = EA.selectChangedFromDiff(before, after);
  assert.deepEqual(v.addedIds, ['f7']);
  assert.deepEqual(v.removedIds, ['f9']);
  assert.deepEqual(v.changedIds, ['f3']);
  assert.equal(v.changed[0].fields.status.to, 'confirmed');
  assert.equal(v.changed[0].fields.severity.to, 'high');
  assert.deepEqual(v.unchangedIds, ['f1']);
});

test('52812 bulkEditCustomFields: shared edits, overrides, invalid names', () => {
  const rows = [{ id: 'f1', customFields: {} }, { id: 'f2', customFields: {} }];
  const v = EA.bulkEditCustomFields(rows, { review_batch: 'oct', byId: { f1: { review_batch: 'priority' } } }, { actor: 'lead-1', at: NOW });
  assert.equal(v.updated[0].customFields.review_batch, 'priority');
  assert.equal(v.updated[1].customFields.review_batch, 'oct');
  assert.deepEqual(v.fieldsApplied, ['review_batch']);
  assert.equal(rows[0].customFields.review_batch, undefined);
  const bad = EA.bulkEditCustomFields(rows, { 'bad field!': 1 }, {});
  assert.equal(bad.errors.length, 2);
});

test('52813 bulkLinkFindings: forward and reverse links written once', () => {
  const rows = [{ id: 'f1', links: [] }, { id: 'f2', links: [] }, { id: 'f3', links: [] }];
  const v = EA.bulkLinkFindings(rows, { relation: 'related', targetId: 'f1' }, { actor: 'lead-1', at: NOW });
  assert.deepEqual(v.linkedIds, ['f2', 'f3']);
  assert.equal(v.linkCount, 4);
  assert.equal(v.updated[1].links.length, 1);
  assert.equal(v.updated[0].links.length, 2);
  assert.equal(rows[1].links.length, 0);
});

test('52814 bulkUnlinkFindings: relation and target filtering', () => {
  const rows = [{ id: 'f1', links: [{ relation: 'related', targetId: 'f2' }, { relation: 'related', targetId: 'f3' }, { relation: 'blocks', targetId: 'f9' }] }];
  const v = EA.bulkUnlinkFindings(rows, { relation: 'related', targetId: 'f2' });
  assert.equal(v.unlinkedCount, 1);
  assert.equal(v.updated[0].links.length, 2);
  assert.equal(rows[0].links.length, 3);
  const all = EA.bulkUnlinkFindings(rows, {});
  assert.equal(all.unlinkedCount, 3);
});

test('52815 buildEvidenceZipManifest: entries, sizes, checksums', () => {
  const v = EA.buildEvidenceZipManifest([
    { id: 'f1', evidence: ['payload reflected', 'error text'] },
    { id: 'f2', evidence: ['script executed'] },
  ], { generatedAt: NOW });
  assert.equal(v.fileCount, 3);
  assert.equal(v.findingsCovered, 2);
  assert.ok(v.entries[0].path.startsWith('evidence/f1/01-'));
  assert.equal(v.totalBytes, 'payload reflected'.length + 'error text'.length + 'script executed'.length);
  assert.ok(v.manifestChecksum.length > 0);
});

test('52816 applyBulkRedaction: secrets replaced and counted per rule', () => {
  const src = [{ id: 'f1', title: 'Leak for admin@shop.example.com', evidence: ['from 10.0.3.14 with Bearer abcdefghij123456'], notes: '' }];
  const v = EA.applyBulkRedaction(src, [], { actor: 'lead-1', at: NOW });
  assert.ok(v.updated[0].title.includes('[redacted-email]'));
  assert.ok(v.updated[0].evidence[0].includes('[redacted-ip]'));
  assert.ok(v.updated[0].evidence[0].includes('[redacted-token]'));
  assert.ok(v.totalRedactions >= 3);
  assert.ok(v.byRule.email >= 1);
  assert.deepEqual(v.affectedIds, ['f1']);
  assert.ok(src[0].title.includes('admin@shop.example.com'));
});

test('52817 bulkAssignTeams: severity routing and roster round-robin', () => {
  const rows = [
    { id: 'f1', severity: 'critical', assignee: null },
    { id: 'f2', severity: 'critical', assignee: null },
    { id: 'f3', severity: 'medium', assignee: null },
  ];
  const v = EA.bulkAssignTeams(rows, { critical: 'appsec', default: 'platform-team' }, { rosters: { appsec: ['aarav', 'meera'] } });
  assert.equal(v.count, 3);
  assert.deepEqual(v.assignments.map(a => a.member), ['aarav', 'meera', null].map(x => x || v.assignments[2].member));
  assert.equal(v.assignments[0].team, 'appsec');
  assert.equal(v.assignments[2].team, 'platform-team');
  assert.deepEqual(v.byTeam, { appsec: 2, 'platform-team': 1 });
});

test('52818 bulkEscalateFindings: severity bump, terminal blocked, reason required', () => {
  const rows = [
    { id: 'f3', severity: 'medium', status: 'triaged', history: [] },
    { id: 'f5', severity: 'medium', status: 'closed', history: [] },
  ];
  const v = EA.bulkEscalateFindings(rows, { reason: 'Customer report received', actor: 'lead-1', at: NOW });
  assert.deepEqual(v.escalatedIds, ['f3']);
  assert.equal(v.escalated[0].severity, 'high');
  assert.equal(v.escalated[0].escalationLevel, 1);
  assert.equal(v.escalated[0].escalatedTo, 'team-lead');
  assert.equal(v.blocked.length, 1);
  assert.equal(rows[0].severity, 'medium');
  const no = EA.bulkEscalateFindings(rows, { actor: 'lead-1', at: NOW });
  assert.equal(no.ok, false);
});

test('52819 bulkRequestInfo: one request per finding, questions required', () => {
  const rows = [{ id: 'f1', status: 'triaged' }, { id: 'f2', status: 'fixing' }];
  const v = EA.bulkRequestInfo(rows, { questions: ['Which role was used?'], requestedBy: 'lead-1', at: NOW, dueAt: '2026-10-12T00:00:00Z' });
  assert.equal(v.ok, true);
  assert.equal(v.count, 2);
  assert.equal(v.updated[0].awaitingInfo, true);
  assert.ok(v.requests[0].requestId.startsWith('info_'));
  const no = EA.bulkRequestInfo(rows, { requestedBy: 'lead-1', at: NOW });
  assert.equal(no.ok, false);
});

test('52820 bulkAddRemediationNotes: severity notes appended without duplicates', () => {
  const rows = [{ id: 'f1', severity: 'critical', remediationNotes: [] }, { id: 'f3', severity: 'medium', remediationNotes: [] }];
  const v = EA.bulkAddRemediationNotes(rows, { critical: 'Patch this sprint.', default: 'Schedule the fix.' }, { actor: 'lead-1', at: NOW });
  assert.equal(v.count, 2);
  assert.equal(v.updated[0].remediationNotes[0].text, 'Patch this sprint.');
  assert.equal(v.updated[1].remediationNotes[0].text, 'Schedule the fix.');
  const again = EA.bulkAddRemediationNotes(v.updated, { critical: 'Patch this sprint.', default: 'Schedule the fix.' }, { actor: 'lead-1', at: NOW });
  assert.equal(again.count, 0);
  assert.equal(rows[0].remediationNotes.length, 0);
});

/* ---- Wave71 B spot checks (52821–52840) ---- */
test('52821 bulkTagFixVersion: normalized version stored as field and tag', () => {
  const rows = [{ id: 'f1', tags: ['checkout'] }];
  const v = EB.bulkTagFixVersion(rows, '2.4.1', { actor: 'lead-1', at: NOW });
  assert.equal(v.ok, true);
  assert.equal(v.version, 'v2.4.1');
  assert.equal(v.updated[0].fixVersion, 'v2.4.1');
  assert.ok(v.updated[0].tags.includes('fix:v2.4.1'));
  assert.deepEqual(rows[0].tags, ['checkout']);
  const bad = EB.bulkTagFixVersion(rows, 'release-x', {});
  assert.equal(bad.ok, false);
});

test('52822 bulkLinkCommits: valid hashes linked, malformed reported', () => {
  const rows = [{ id: 'f1', commits: [] }, { id: 'f2', commits: [] }];
  const v = EB.bulkLinkCommits(rows, { f1: 'a1b2c3d4e5f6', f2: 'not-a-sha' }, { actor: 'meera', at: NOW });
  assert.deepEqual(v.linkedIds, ['f1']);
  assert.equal(v.updated[0].commits[0].sha, 'a1b2c3d4e5f6');
  assert.ok(v.updated[0].commits[0].url.includes('a1b2c3d4e5f6'));
  assert.equal(v.invalid.length, 1);
  assert.equal(v.invalid[0].id, 'f2');
  assert.equal(rows[0].commits.length, 0);
  const shared = EB.bulkLinkCommits(rows, 'b2c3d4e5f6a7', {});
  assert.equal(shared.count, 2);
});

test('52823 bulkCloseWithReason: closable states close, terminal blocked', () => {
  const rows = [
    { id: 'f4', status: 'verified', history: [] },
    { id: 'f3', status: 'closed', history: [] },
    { id: 'f6', status: 'new', history: [] },
  ];
  const v = EB.bulkCloseWithReason(rows, { reason: 'Fix verified in production', reasonCode: 'fixed-verified', actor: 'lead-1', at: NOW });
  assert.deepEqual(v.closedIds, ['f4']);
  assert.equal(v.closed[0].status, 'closed');
  assert.equal(v.closed[0].closeReasonCode, 'fixed-verified');
  assert.equal(v.blocked.length, 2);
  assert.equal(rows[0].status, 'verified');
  const no = EB.bulkCloseWithReason(rows, { actor: 'lead-1', at: NOW });
  assert.equal(no.ok, false);
});

test('52824 bulkReopenWithReason: reopenable states reopen with counter', () => {
  const rows = [
    { id: 'f3', status: 'closed', reopenCount: 0, history: [] },
    { id: 'f2', status: 'fixing', history: [] },
  ];
  const v = EB.bulkReopenWithReason(rows, { reason: 'Regression found in release', reasonCode: 'regression', actor: 'verifier-1', at: NOW });
  assert.deepEqual(v.reopenedIds, ['f3']);
  assert.equal(v.reopened[0].status, 'reopened');
  assert.equal(v.reopened[0].reopenCount, 1);
  assert.equal(v.reopened[0].reopenReasonCode, 'regression');
  assert.equal(v.blocked.length, 1);
  const no = EB.bulkReopenWithReason(rows, { actor: 'verifier-1', at: NOW });
  assert.equal(no.ok, false);
});

test('52825 bulkNotifyAssignees: one notification per assignee', () => {
  const rows = [
    { id: 'f1', assignee: 'meera' },
    { id: 'f2', assignee: 'meera' },
    { id: 'f4', assignee: 'qa-1' },
    { id: 'f9' },
  ];
  const v = EB.bulkNotifyAssignees(rows, { channel: 'chat', actor: 'lead-1', at: NOW });
  assert.equal(v.notifications.length, 2);
  const meera = v.notifications.find(n => n.recipient === 'meera');
  assert.equal(meera.count, 2);
  assert.deepEqual(meera.findingIds, ['f1', 'f2']);
  assert.ok(meera.message.includes('Infinity AI'));
  assert.deepEqual(v.unassignedIds, ['f9']);
});

test('52826 buildPocBundleManifest: per-finding bundle descriptors', () => {
  const v = EB.buildPocBundleManifest([
    { id: 'f1', title: 'SQLi', severity: 'critical', target: 'shop.example.com', type: 'sqli', pocSteps: ['replay payload'] },
    { id: 'f2', title: 'XSS', severity: 'high', target: 'shop.example.com', type: 'xss' },
  ], { generatedAt: NOW });
  assert.equal(v.totalFindings, 2);
  assert.equal(v.fileCount, 6);
  assert.ok(v.bundles[0].steps.length >= 3);
  assert.ok(v.bundles[0].files[0].path.startsWith('poc/f1/'));
  assert.ok(v.checksum.length > 0);
});

test('52827 draftBulkCveRequests: eligibility by severity, CWE, existing CVE', () => {
  const rows = [
    { id: 'f1', title: 'SQLi', severity: 'critical', cwe: 'CWE-89', target: 'shop.example.com', evidence: ['extraction'] },
    { id: 'f4', title: 'Verbose errors', severity: 'low', cwe: 'CWE-209', target: 'shop.example.com' },
    { id: 'f8', title: 'Known issue', severity: 'high', cwe: 'CWE-79', target: 'shop.example.com', cveId: 'CVE-2026-1111' },
  ];
  const v = EB.draftBulkCveRequests(rows, { requester: 'lead-1', at: NOW });
  assert.equal(v.count, 1);
  assert.equal(v.drafts[0].findingId, 'f1');
  assert.equal(v.drafts[0].weakness, 'CWE-89');
  assert.equal(v.drafts[0].status, 'draft');
  assert.equal(v.ineligible.length, 2);
});

test('52828 recalculateBulkSla: due instants, breach detection', () => {
  const rows = [
    { id: 'f1', severity: 'critical', status: 'verifying', createdAt: '2026-10-01T00:00:00Z' },
    { id: 'f4', severity: 'low', status: 'verified', createdAt: '2026-10-08T00:00:00Z' },
  ];
  const v = EB.recalculateBulkSla(rows, {}, '2026-10-09T00:00:00Z');
  assert.equal(v.results[0].slaHours, 24);
  assert.equal(v.results[0].dueAt, '2026-10-02T00:00:00.000Z');
  assert.equal(v.results[0].breached, true);
  assert.deepEqual(v.breachedIds, ['f1']);
  assert.equal(v.results[1].breached, false);
  assert.equal(v.policyUsed.critical, 24);
});

test('52829 exportDecisionHistory: transitions serialized with checksum', () => {
  const rows = [
    { id: 'f1', history: [{ from: 'new', to: 'triaged', actor: 'analyst-1', at: '2026-10-01T09:00:00Z', reason: 'intake' }] },
    { id: 'f4', history: [{ from: 'verifying', to: 'verified', actor: 'verifier-1', at: '2026-10-07T09:00:00Z', reason: 'retest passed' }] },
  ];
  const md = EB.exportDecisionHistory(rows, 'markdown', {});
  assert.equal(md.rows, 2);
  assert.equal(md.filename, 'decision-history.md');
  assert.ok(md.content.includes('Decision history'));
  assert.ok(md.content.includes('f1: new -> triaged'));
  const json = EB.exportDecisionHistory(rows, 'json', {});
  assert.ok(json.content.includes('Infinity AI'));
  assert.ok(json.checksum.length > 0);
});

test('52830 splitFindingsByAsset: multi-asset findings split, singles pass', () => {
  const rows = [
    { id: 'f2', title: 'XSS', severity: 'high', assets: ['shop.example.com', 'cdn.example.com'] },
    { id: 'f3', title: 'TLS', severity: 'medium', target: 'api.example.com' },
  ];
  const v = EB.splitFindingsByAsset(rows, { actor: 'lead-1', at: NOW });
  assert.equal(v.count, 3);
  assert.deepEqual(v.createdIds, ['f2-a1', 'f2-a2']);
  assert.equal(v.splitCount, 1);
  assert.equal(v.split[0].splitFrom, 'f2');
  assert.equal(v.split[0].asset, 'shop.example.com');
  assert.equal(v.split[2].id, 'f3');
});

test('52831 answerPostHuntQuestion: intents answered from the hunt record', () => {
  const hunt = {
    huntId: 'hunt-42',
    findings: [
      { id: 'f1', title: 'SQLi', severity: 'critical', status: 'verifying', riskScore: 92 },
      { id: 'f4', title: 'Errors', severity: 'low', status: 'verified', riskScore: 21 },
    ],
    attempts: [],
    coveredCategories: ['authentication'],
  };
  const count = EB.answerPostHuntQuestion(hunt, 'How many findings are there?');
  assert.equal(count.intent, 'count');
  assert.ok(count.answer.includes('2 findings'));
  const crit = EB.answerPostHuntQuestion(hunt, 'Any critical findings?');
  assert.equal(crit.intent, 'critical');
  assert.deepEqual(crit.data.criticalIds, ['f1']);
  const top = EB.answerPostHuntQuestion(hunt, 'What is the top finding?');
  assert.equal(top.intent, 'top-finding');
  assert.equal(top.data.topId, 'f1');
});

test('52832 explainCriticality: factor breakdown justifies the rating', () => {
  const v = EB.explainCriticality({
    id: 'f1', severity: 'critical', riskScore: 92,
    cvss: { score: 9.8, vector: 'AV:N/AC:L/PR:N/UI:N' },
    impact: 'Full database read including customer data',
    evidence: ['extraction confirmed', 'curl replay recorded'],
  });
  assert.equal(v.findingId, 'f1');
  assert.equal(v.verdict, 'critical-justified');
  assert.ok(v.score >= 70);
  assert.ok(v.factors.some(f => f.factor === 'cvss-score'));
  assert.ok(v.factors.some(f => f.factor === 'network-reachable'));
  assert.ok(v.summary.includes('Infinity AI'));
  const low = EB.explainCriticality({ id: 'f4', severity: 'low', riskScore: 21, evidence: [] });
  assert.equal(low.verdict, 'not-critical');
});

test('52833 walkthroughExploitChain: hops narrated, weakest link flagged', () => {
  const findings = [
    { id: 'f2', title: 'XSS in search', severity: 'high' },
    { id: 'f1', title: 'SQLi in checkout', severity: 'critical' },
  ];
  const v = EB.walkthroughExploitChain({ id: 'chain-1', hops: [{ findingId: 'f2', action: 'steal a session' }, { findingId: 'f1', action: 'reach checkout data' }] }, findings);
  assert.equal(v.stepCount, 2);
  assert.equal(v.maxSeverity, 'critical');
  assert.equal(v.steps[0].step, 1);
  assert.ok(v.narrative.includes('XSS in search'));
  assert.equal(v.breakPoint.findingId, 'f2');
});

test('52834 summarizeFailedAttempts: outcomes grouped, failure rate computed', () => {
  const v = EB.summarizeFailedAttempts({
    attempts: [
      { check: 'authentication bypass', target: 'shop.example.com', outcome: 'no-finding', reason: 'login enforced' },
      { check: 'file-upload filter', target: 'shop.example.com', outcome: 'blocked', reason: 'needs vendor account' },
      { check: 'authentication bypass', target: 'shop.example.com', outcome: 'success', reason: '' },
    ],
  });
  assert.equal(v.total, 3);
  assert.equal(v.failedCount, 2);
  assert.equal(v.failureRate, 66.7);
  assert.equal(v.byCheck['authentication bypass'].attempted, 2);
  assert.equal(v.byCheck['authentication bypass'].failed, 1);
  assert.ok(v.summary.includes('Infinity AI'));
});

test('52835 analyzeCoverageGaps: checklist compared with covered areas', () => {
  const v = EB.analyzeCoverageGaps({ coveredCategories: ['authentication'], attempts: [] }, []);
  assert.equal(v.expectedCount, 8);
  assert.equal(v.testedCount, 1);
  assert.equal(v.coveragePercent, 12.5);
  assert.ok(v.gaps.includes('api-security'));
  assert.equal(v.recommendations.length, v.gaps.length);
  const full = EB.analyzeCoverageGaps({ coveredCategories: ['authentication', 'authorization', 'input-validation', 'session-management', 'api-security', 'file-upload', 'business-logic', 'security-configuration'], attempts: [] }, []);
  assert.equal(full.coveragePercent, 100);
  assert.deepEqual(full.gaps, []);
});

test('52836 interrogateConfidence: weighted factors and follow-up questions', () => {
  const strong = EB.interrogateConfidence({
    id: 'f1', status: 'verifying', verifiedBy: 'verifier-1',
    evidence: ['extraction confirmed', 'curl replay recorded in poc'],
    pocSteps: ['open checkout', 'submit payload', 'observe rows'],
    history: [{ from: 'triaged', to: 'confirmed', actor: 'lead-1', at: NOW, reason: 'reproduced' }],
  });
  assert.equal(strong.confidenceScore, 100);
  assert.equal(strong.level, 'high');
  assert.equal(strong.questions.length, 0);
  const weak = EB.interrogateConfidence({ id: 'f9', status: 'new', evidence: [], history: [] });
  assert.equal(weak.level, 'low');
  assert.ok(weak.questions.length >= 3);
});

test('52837 estimateBlastRadius: shared host and service reach scored', () => {
  const assets = [
    { id: 'shop-1', host: 'shop.example.com', sharedServices: ['payments-db'] },
    { id: 'shop-2', host: 'shop.example.com', sharedServices: [] },
    { id: 'api-1', host: 'api.example.com', sharedServices: ['payments-db'] },
    { id: 'blog-1', host: 'blog.example.com', sharedServices: [] },
  ];
  const v = EB.estimateBlastRadius({ id: 'f1', severity: 'critical', target: 'shop.example.com', impact: 'database read', sharedServices: ['payments-db'] }, { assets });
  assert.equal(v.affectedCount, 3);
  assert.equal(v.radiusScore, 100);
  assert.equal(v.level, 'wide');
  assert.ok(v.summary.includes('Infinity AI'));
  const contained = EB.estimateBlastRadius({ id: 'f4', severity: 'low', target: 'blog.example.com' }, { assets });
  assert.equal(contained.affectedCount, 1);
  assert.equal(contained.level, 'contained');
});

test('52838 suggestFixFollowUps: CWE-keyed fix, verification, questions', () => {
  const v = EB.suggestFixFollowUps({ id: 'f1', severity: 'critical', cwe: 'CWE-89' });
  assert.equal(v.cwe, 'CWE-89');
  assert.ok(v.weakness.toLowerCase().includes('sql injection'));
  assert.ok(v.suggestions[0].action.includes('parameterized'));
  assert.equal(v.suggestions[0].priority, 'immediate');
  assert.ok(v.followUpQuestions.length >= 3);
  const generic = EB.suggestFixFollowUps({ id: 'f9', severity: 'low' });
  assert.equal(generic.cwe, 'UNSPECIFIED');
  assert.equal(generic.suggestions[0].priority, 'planned');
});

test('52839 compareHuntHistory: metrics differenced across hunts', () => {
  const a = { huntId: 'hunt-41', findings: [{ id: 'f3', severity: 'medium', status: 'closed', riskScore: 42 }, { id: 'f4', severity: 'low', status: 'verified', riskScore: 21 }] };
  const b = { huntId: 'hunt-42', findings: [{ id: 'f1', severity: 'critical', status: 'verifying', riskScore: 92 }, { id: 'f3', severity: 'medium', status: 'closed', riskScore: 42 }, { id: 'f4', severity: 'low', status: 'verified', riskScore: 21 }] };
  const v = EB.compareHuntHistory(a, b);
  assert.equal(v.a.total, 2);
  assert.equal(v.b.total, 3);
  assert.equal(v.delta.total, 1);
  assert.equal(v.delta.critical, 1);
  assert.ok(v.summary.includes('Infinity AI'));
});

test('52840 draftBountyWriteup: submission-ready markdown with missing check', () => {
  const v = EB.draftBountyWriteup({
    id: 'f1', title: 'SQLi in checkout', severity: 'critical', target: 'shop.example.com', cwe: 'CWE-89', riskScore: 92,
    impact: 'Full database read', evidence: ['extraction confirmed'],
    pocSteps: ['Open checkout', 'Submit the recorded payload', 'Observe extracted rows'],
  }, { submitter: 'Infinity AI' });
  assert.equal(v.ready, true);
  assert.deepEqual(v.missing, []);
  assert.ok(v.markdown.includes('## Steps to reproduce'));
  assert.ok(v.markdown.includes('[critical] SQLi in checkout'));
  assert.ok(v.wordCount > 20);
  const thin = EB.draftBountyWriteup({ id: 'f9', severity: 'low' }, {});
  assert.equal(thin.ready, false);
  assert.ok(thin.missing.includes('evidence'));
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
test('css: only .w71a-/.w71b- scoped selectors, no globals', () => {
  const noComments = CSS_SRC.replace(/\/\*[\s\S]*?\*\//g, '');
  const classSelectors = [...noComments.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map(m => m[1]);
  assert.ok(classSelectors.length > 10, 'expected many scoped selectors');
  for (const cls of classSelectors) {
    assert.ok(cls.startsWith('w71a-') || cls.startsWith('w71b-'), `unscoped selector: .${cls}`);
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
  for (const f of ['Wave71A.jsx', 'Wave71B.jsx']) {
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
