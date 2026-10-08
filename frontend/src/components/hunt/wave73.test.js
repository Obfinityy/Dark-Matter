/**
 * wave73.test.js — Infinity AI · Dark-Matter · Wave 73
 * node:test + node:assert/strict. Registry coverage (20/20 for 52881–52900,
 * 20/20 for 52901–52920, zero skips, 40/40 combined), registry titles matched
 * against the idea bank, deterministic spot-checks of every pure function
 * (at least one assertion per idea), a JSX↔core call-shape audit (every
 * exported component calls ≥1 exported core function), Wave73.css
 * scope/zero-animation audits, a real esbuild JSX parse audit, a
 * no-branding-leak audit ("Infinity AI" only) and a no-debris audit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WAVE73_A_IDEAS } from './wave73ACore.js';
import * as XA from './wave73ACore.js';
import { WAVE73_B_IDEAS } from './wave73BCores.js';
import * as XB from './wave73BCores.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const A_SRC = readFileSync(join(DIR, 'wave73ACore.js'), 'utf8');
const B_SRC = readFileSync(join(DIR, 'wave73BCores.js'), 'utf8');
const A_JSX = readFileSync(join(DIR, 'Wave73A.jsx'), 'utf8');
const B_JSX = readFileSync(join(DIR, 'Wave73B.jsx'), 'utf8');
const CSS_SRC = readFileSync(join(DIR, 'Wave73.css'), 'utf8');
const BRAND_SRC = [['A core', A_SRC], ['B core', B_SRC], ['A jsx', A_JSX], ['B jsx', B_JSX], ['css', CSS_SRC]];

const QA = [
  { id: 'qa-1', question: 'Which checkout finding is critical?', answer: 'The checkout SQL issue is critical and touches payments.', findingId: 'f1', askedBy: 'lead-1', at: '2026-10-08T09:00:00Z' },
  { id: 'qa-2', question: 'Is the invoice issue in a chain?', answer: 'Not yet recorded in a chain.', findingId: 'f3', askedBy: 'analyst-1', at: '2026-10-08T10:00:00Z' },
];
const FINDINGS = [
  { id: 'f1', title: 'SQLi in checkout', severity: 'critical', status: 'confirmed', target: 'shop.example.com/checkout', cwe: 'CWE-89', engine: 'vuln-scan', evidence: ['Unauthenticated checkout query returned every order id'] },
  { id: 'f3', title: 'IDOR in invoices', severity: 'high', status: 'triaged', target: 'api.example.com/invoices/1001', cwe: 'CWE-862', engine: 'vuln-scan', evidence: ['Invoice of another customer opened by changing the id'] },
];
const HUNT = {
  huntId: 'hunt-42', target: 'shop.example.com', status: 'closed',
  closedAt: '2026-09-20T09:00:00Z', createdAt: '2026-09-01T09:00:00Z',
  owner: 'lead-1', watchers: ['lead-1', 'analyst-1'], assignees: ['meera'],
  findings: FINDINGS, qaHistory: QA,
  snapshot: { huntId: 'hunt-42', closedAt: '2026-09-20T09:00:00Z', findings: FINDINGS, decisions: [{ findingId: 'f1', decision: 'confirmed' }], comments: [{ id: 'c1', text: 'Verified with the team' }], findingCount: 2 },
  scope: { include: ['shop.example.com', 'api.example.com'], exclude: ['admin.example.com'] },
  stats: { requests: 1240, durationMinutes: 95, engines: ['recon', 'vuln-scan'] },
  techStack: ['node', 'postgres'],
  reopenCount: 1, lastReopenedAt: '2026-10-01T09:00:00Z',
  reopenHistory: [{ at: '2026-10-01T09:00:00Z', reason: 'Regression detected in checkout.', category: 'regression' }],
  chapters: [{ number: 1, kind: 'original', openedAt: '2026-09-01T09:00:00Z', closedAt: '2026-09-20T09:00:00Z', findingCount: 2 }],
};
const HUNTS = [
  HUNT,
  { huntId: 'hunt-43', target: 'api.example.com', status: 'closed', closedAt: '2026-08-15T09:00:00Z', reopenCount: 2, reopenHistory: [{ at: '2026-09-01T09:00:00Z', reason: 'New threat intel matches this stack.', category: 'new-intel' }], findings: [] },
  { huntId: 'hunt-44', target: 'blog.example.com', status: 'open', closedAt: null, reopenCount: 0, reopenHistory: [], findings: [] },
];

/* ---- Registry coverage: 20/20 + 20/20, zero skips ---- */
test('registry: 20/20 wave 73A ideas, 20/20 wave 73B ideas, zero skips', () => {
  assert.equal(WAVE73_A_IDEAS.length, 20);
  assert.equal(WAVE73_B_IDEAS.length, 20);
  const all = [...WAVE73_A_IDEAS, ...WAVE73_B_IDEAS];
  assert.equal(all.length, 40);
  const ids = all.map(i => i.id);
  assert.deepEqual(ids, Array.from({ length: 40 }, (_, k) => 52881 + k));
  for (const idea of all) {
    assert.equal(idea.skip, false, `idea ${idea.id} skipped`);
    assert.ok(idea.title && idea.title.length > 3, `idea ${idea.id} missing title`);
  }
});

test('registry: titles match idea-bank wording', () => {
  const byId = Object.fromEntries([...WAVE73_A_IDEAS, ...WAVE73_B_IDEAS].map(i => [i.id, i.title.toLowerCase()]));
  assert.ok(byId[52881].includes('q&a export'));
  assert.ok(byId[52882].includes('q&a sharing'));
  assert.ok(byId[52883].includes('suggested follow-up chips'));
  assert.ok(byId[52884].includes('multi-turn context retention'));
  assert.ok(byId[52885].includes('multilingual q&a'));
  assert.ok(byId[52886].includes('answer feedback buttons'));
  assert.ok(byId[52887].includes('q&a over archived hunts'));
  assert.ok(byId[52888].includes('code-context q&a'));
  assert.ok(byId[52889].includes('hunt-statistics q&a'));
  assert.ok(byId[52890].includes('one-click hunt reopen'));
  assert.ok(byId[52891].includes('reopen reason requirement'));
  assert.ok(byId[52892].includes('state-snapshot restore on reopen'));
  assert.ok(byId[52893].includes('reopen from archive'));
  assert.ok(byId[52894].includes('reopen notifications'));
  assert.ok(byId[52895].includes('reopen audit log'));
  assert.ok(byId[52896].includes('reopen permission control'));
  assert.ok(byId[52897].includes('reopen-vs-new guidance'));
  assert.ok(byId[52898].includes('re-index on reopen'));
  assert.ok(byId[52899].includes('extended-scope reopen'));
  assert.ok(byId[52900].includes('append-new-findings on reopen'));
  assert.ok(byId[52901].includes('history-preserving reopen'));
  assert.ok(byId[52902].includes('reopen reason templates'));
  assert.ok(byId[52903].includes('reopen approval workflow'));
  assert.ok(byId[52904].includes('bulk reopen (post-hunt)'));
  assert.ok(byId[52905].includes('reopen api'));
  assert.ok(byId[52906].includes('reopen from email link'));
  assert.ok(byId[52907].includes('reopen from comparison view'));
  assert.ok(byId[52908].includes('threat-intel-triggered reopen'));
  assert.ok(byId[52909].includes('code-change-triggered reopen'));
  assert.ok(byId[52910].includes('acquisition-triggered reopen'));
  assert.ok(byId[52911].includes('incident-triggered reopen'));
  assert.ok(byId[52912].includes('reopen expiry policy'));
  assert.ok(byId[52913].includes('fresh-engine reopen'));
  assert.ok(byId[52914].includes('reopen cost estimate'));
  assert.ok(byId[52915].includes('scheduled reopen'));
  assert.ok(byId[52916].includes('reopen discussion thread'));
  assert.ok(byId[52917].includes('reopened-hunt badge'));
  assert.ok(byId[52918].includes('reopen search filter'));
  assert.ok(byId[52919].includes('reopen analytics'));
  assert.ok(byId[52920].includes('reopen-vs-regression explainer'));
});

/* ---- Wave73 A spot checks (52881–52900) ---- */
test('52881 exportQaTranscript: markdown file with every exchange', () => {
  const v = XA.exportQaTranscript(QA, 'markdown', { huntLabel: 'Hunt 42' });
  assert.equal(v.filename, 'hunt-42-qa.md');
  assert.equal(v.entryCount, 2);
  assert.ok(v.content.includes('Which checkout finding is critical?'));
  assert.ok(v.wordCount > 10);
});

test('52882 shareQaThread: expiring view link for the thread', () => {
  const v = XA.shareQaThread({ id: 'thread-1', huntId: 'hunt-42', title: 'Checkout Q&A', entries: QA }, { permission: 'view' });
  assert.equal(v.permission, 'view');
  assert.equal(v.expiresAt.slice(0, 10), '2026-10-16');
  assert.ok(v.url.includes('/share/qa/'));
  assert.equal(v.entryCount, 2);
});

test('52883 suggestFollowUpChips: class-specific chips ranked', () => {
  const v = XA.suggestFollowUpChips({ answer: QA[0].answer, finding: FINDINGS[0] }, {});
  assert.equal(v.count, 4);
  assert.equal(v.chips[0].label, 'Show fix steps');
  assert.equal(v.chips[0].rank, 1);
  assert.ok(v.chips.some(c => c.label === 'Who should fix it?'));
});

test('52884 trackConversationContext: turns, findings, topics retained', () => {
  const turns = [
    { question: 'Which finding is critical?', answer: 'The checkout issue.', findingId: 'f1' },
    { question: 'Does it touch payments?', answer: 'Yes, checkout payments.', findingId: 'f1' },
  ];
  const v = XA.trackConversationContext(turns, {});
  assert.equal(v.turnsRetained, 2);
  assert.deepEqual(v.findingIds, ['f1']);
  assert.equal(v.lastQuestion, 'Does it touch payments?');
});

test('52885 translateQaAnswer: Hinglish pack and unsupported handling', () => {
  const v = XA.translateQaAnswer({ text: QA[0].answer, finding: FINDINGS[0] }, 'hinglish', {});
  assert.equal(v.supported, true);
  assert.equal(v.languageName, 'Hinglish');
  assert.equal(v.severityWord, 'bahut serious');
  const xx = XA.translateQaAnswer({ text: 'hello' }, 'xx', {});
  assert.equal(xx.supported, false);
});

test('52886 recordAnswerFeedback: totals and quality score update', () => {
  const v = XA.recordAnswerFeedback({ answerId: 'qa-1', helpful: true }, { helpfulCount: 4, notHelpfulCount: 1 }, {});
  assert.equal(v.helpfulCount, 5);
  assert.equal(v.total, 6);
  assert.equal(v.qualityScore, 83);
  assert.equal(v.needsReview, false);
});

test('52887 queryArchivedHunt: archive sources cited for the question', () => {
  const v = XA.queryArchivedHunt(HUNT, 'checkout critical', {});
  assert.equal(v.archived, true);
  assert.ok(v.sourceCount >= 1);
  assert.ok(v.answer.includes('Infinity AI'));
  const none = XA.queryArchivedHunt(HUNT, 'quantum banana pancake', {});
  assert.equal(none.sourceCount, 0);
});

test('52888 showCodeContext: vulnerable line matched with pattern', () => {
  const codebase = { files: [{ path: 'src/checkout/search.js', lines: ['const q = req.query.q;', "db.query('SELECT * FROM orders WHERE name = ' + q);"] }] };
  const v = XA.showCodeContext(FINDINGS[0], codebase, {});
  assert.equal(v.snippetCount, 1);
  assert.equal(v.snippets[0].file, 'src/checkout/search.js');
  assert.equal(v.snippets[0].line, 2);
});

test('52889 answerHuntStatistics: request question answered from stats', () => {
  const v = XA.answerHuntStatistics(HUNT, 'How many requests did you send?', {});
  assert.equal(v.focus, 'requests');
  assert.equal(v.values.requests, 1240);
  assert.equal(v.values.durationMinutes, 95);
  assert.ok(v.answer.includes('1240'));
});

test('52890 reopenHuntOneClick: closed hunt reopens, open hunt refused', () => {
  const v = XA.reopenHuntOneClick(HUNT, { reason: 'New threat intel matches this stack.' });
  assert.equal(v.eligible, true);
  assert.equal(v.newState, 'open');
  assert.equal(v.previousState, 'closed');
  const open = XA.reopenHuntOneClick({ huntId: 'h1', status: 'open' }, {});
  assert.equal(open.eligible, false);
});

test('52891 validateReopenReason: real reason passes, blank fails', () => {
  const ok = XA.validateReopenReason('Regression detected in checkout after the last deploy.', {});
  assert.equal(ok.valid, true);
  assert.equal(ok.category, 'regression');
  const blank = XA.validateReopenReason('', {});
  assert.equal(blank.valid, false);
  assert.ok(blank.missing.length >= 1);
});

test('52892 restoreStateSnapshot: findings, decisions, comments restored', () => {
  const v = XA.restoreStateSnapshot(HUNT.snapshot, {});
  assert.equal(v.restoredFindings, 2);
  assert.equal(v.restoredDecisions, 1);
  assert.equal(v.restoredComments, 1);
  assert.equal(v.intact, true);
  assert.equal(HUNT.snapshot.findings.length, 2);
});

test('52893 reopenFromArchive: restore-plus-reopen in four steps', () => {
  const v = XA.reopenFromArchive({ ...HUNT, status: 'archived', archivedAt: HUNT.closedAt }, {});
  assert.equal(v.success, true);
  assert.equal(v.steps.length, 4);
  assert.equal(v.restored.restoredFindings, 2);
});

test('52894 buildReopenNotifications: watchers deduplicated', () => {
  const v = XA.buildReopenNotifications(HUNT, { requestedBy: 'lead-1', reason: 'New intel received.' }, {});
  assert.equal(v.recipientCount, 3);
  assert.ok(v.notifications.some(n => n.recipient === 'meera'));
  assert.ok(v.notifications[0].message.includes('Infinity AI'));
});

test('52895 recordReopenAuditLog: immutable sequenced entry appended', () => {
  const prior = [{ seq: 1, huntId: 'hunt-40', actor: 'lead-1', action: 'reopen' }];
  const v = XA.recordReopenAuditLog({ huntId: 'hunt-42', actor: 'lead-1', reason: 'New intel received.', previousState: 'closed' }, prior, {});
  assert.equal(v.entry.seq, 2);
  assert.equal(v.totalEntries, 2);
  assert.equal(v.complianceReady, true);
  assert.equal(prior.length, 1);
});

test('52896 checkReopenPermission: lead allowed, viewer denied', () => {
  const lead = XA.checkReopenPermission({ id: 'lead-1', role: 'lead' }, HUNT, {});
  assert.equal(lead.allowed, true);
  const viewer = XA.checkReopenPermission({ id: 'guest-1', role: 'viewer' }, HUNT, {});
  assert.equal(viewer.allowed, false);
});

test('52897 guideReopenVsNew: fresh intel favours reopen', () => {
  const v = XA.guideReopenVsNew(HUNT, { newIntel: true, scopeDriftPercent: 10 }, { now: '2026-10-09T00:00:00Z' });
  assert.equal(v.recommendation, 'reopen');
  assert.equal(v.ageDays, 19);
  assert.ok(v.reopenScore >= 50);
});

test('52898 reindexReopenedHunt: hunt, finding, Q&A documents rebuilt', () => {
  const v = XA.reindexReopenedHunt(HUNT, {}, {});
  assert.equal(v.documentsIndexed, 5);
  assert.equal(v.byKind.finding, 2);
  assert.equal(v.byKind.qa, 2);
  assert.equal(v.searchable, true);
});

test('52899 planExtendedScopeReopen: additions merged, exclusions held', () => {
  const v = XA.planExtendedScopeReopen(HUNT, { include: ['blog.example.com', 'admin.example.com'], exclude: [] }, {});
  assert.equal(v.addedCount, 1);
  assert.equal(v.mergedScope.length, 3);
  assert.equal(v.skipped.length, 1);
  assert.equal(v.skipped[0].why, 'excluded');
});

test('52900 appendNewFindings: new findings merged, history intact', () => {
  const fresh = [{ id: 'f7', title: 'New header leak', severity: 'medium', target: 'shop.example.com' }];
  const v = XA.appendNewFindings(HUNT, fresh, {});
  assert.equal(v.appendedCount, 1);
  assert.equal(v.totalCount, 3);
  assert.equal(v.originalCount, 2);
  assert.equal(HUNT.findings.length, 2);
});

/* ---- Wave73 B spot checks (52901–52920) ---- */
test('52901 reopenPreservingHistory: new chapter, old chapter kept', () => {
  const v = XB.reopenPreservingHistory(HUNT, { actor: 'lead-1', reason: 'Regression detected in checkout.' }, { now: '2026-10-09T00:00:00Z' });
  assert.equal(v.chapterCount, 2);
  assert.equal(v.currentChapter, 2);
  assert.equal(v.historyPreserved, true);
  assert.equal(v.chapters[0].kind, 'original');
});

test('52902 listReopenReasonTemplates: six templates, one applied', () => {
  const v = XB.listReopenReasonTemplates({ templateId: 'regression', context: { huntId: 'hunt-42', target: 'shop.example.com' } });
  assert.equal(v.count, 6);
  assert.equal(v.applied.label, 'Regression detected');
  assert.ok(v.applied.reason.includes('shop.example.com'));
  const all = XB.listReopenReasonTemplates({});
  assert.equal(all.applied, null);
});

test('52903 planReopenApprovalWorkflow: standard and sensitive paths', () => {
  const v = XB.planReopenApprovalWorkflow(HUNT, { id: 'analyst-1', reason: 'Regression detected in checkout.' }, {});
  assert.equal(v.requiresApproval, false);
  assert.equal(v.stepCount, 3);
  const sensitive = XB.planReopenApprovalWorkflow({ ...HUNT, sensitive: true }, { id: 'analyst-1', reason: 'Regression detected in checkout.' }, {});
  assert.equal(sensitive.requiresApproval, true);
  assert.equal(sensitive.stepCount, 4);
});

test('52904 bulkReopenHunts: closed hunts reopen, open hunt skipped', () => {
  const v = XB.bulkReopenHunts(HUNTS, { reason: 'Org-wide infra change needs rechecks.' });
  assert.equal(v.total, 3);
  assert.equal(v.succeeded, 2);
  assert.equal(v.failed, 1);
});

test('52905 buildReopenApiRequest: valid POST descriptor, errors listed', () => {
  const v = XB.buildReopenApiRequest('hunt-42', { reason: 'Regression detected in checkout.', requestedBy: 'lead-1' }, {});
  assert.equal(v.valid, true);
  assert.equal(v.method, 'POST');
  assert.ok(v.url.endsWith('/hunts/hunt-42/reopen'));
  const bad = XB.buildReopenApiRequest('', { reason: 'short' }, {});
  assert.equal(bad.valid, false);
  assert.equal(bad.errors.length, 2);
});

test('52906 parseEmailReopenLink: signed unexpired link passes', () => {
  const link = 'https://app.infinity-ai.example/hunts/hunt-42/reopen?token=abcdef123456&exp=9999999999';
  const v = XB.parseEmailReopenLink(link, { id: 'lead-1', role: 'lead' }, { now: '2026-10-09T00:00:00Z' });
  assert.equal(v.valid, true);
  assert.equal(v.huntId, 'hunt-42');
  assert.equal(v.expired, false);
  const anon = XB.parseEmailReopenLink(link, {}, { now: '2026-10-09T00:00:00Z' });
  assert.equal(anon.valid, false);
});

test('52907 reopenFromComparison: regression points at the baseline', () => {
  const v = XB.reopenFromComparison({ baseline: { huntId: 'hunt-42' }, candidate: { huntId: 'hunt-50' }, regressions: [{ id: 'f9', title: 'Checkout regression', severity: 'high' }] }, {});
  assert.equal(v.recommended, true);
  assert.equal(v.regressionCount, 1);
  assert.equal(v.baselineHuntId, 'hunt-42');
  const clean = XB.reopenFromComparison({ baseline: { huntId: 'hunt-42' }, regressions: [] }, {});
  assert.equal(clean.recommended, false);
});

test('52908 suggestThreatIntelReopen: matching closed hunt suggested', () => {
  const v = XB.suggestThreatIntelReopen({ id: 'intel-1', title: 'Checkout library advisory', tags: ['checkout'], affectedProducts: ['postgres'] }, HUNTS, {});
  assert.equal(v.count, 1);
  assert.equal(v.suggestions[0].huntId, 'hunt-42');
});

test('52909 suggestCodeChangeReopen: security deploy suggests reopens', () => {
  const v = XB.suggestCodeChangeReopen({ id: 'deploy-7', changedPaths: ['src/auth/session.js', 'src/checkout/pay.js'] }, HUNTS, {});
  assert.equal(v.securityRelevant, true);
  assert.equal(v.count, 2);
  assert.equal(v.changedCount, 2);
});

test('52910 suggestAcquisitionReopen: acquired host matches a hunt', () => {
  const v = XB.suggestAcquisitionReopen({ id: 'acq-1', assets: [{ host: 'shop.example.com' }] }, HUNTS, {});
  assert.equal(v.newAssetCount, 1);
  assert.equal(v.count, 1);
  assert.equal(v.suggestions[0].huntId, 'hunt-42');
});

test('52911 suggestIncidentReopen: most recent hunt on the asset', () => {
  const v = XB.suggestIncidentReopen({ id: 'inc-3', asset: 'https://shop.example.com', severity: 'high' }, HUNTS, {});
  assert.equal(v.candidates.length, 1);
  assert.equal(v.recommendedHuntId, 'hunt-42');
  assert.ok(v.summary.includes('Infinity AI'));
});

test('52912 checkReopenExpiry: young hunt allowed, old hunt expired', () => {
  const v = XB.checkReopenExpiry(HUNT, { maxReopenMonths: 6 }, { now: '2026-10-09T00:00:00Z' });
  assert.equal(v.expired, false);
  assert.equal(v.allowed, true);
  assert.equal(v.ageMonths, 0);
  const old = XB.checkReopenExpiry({ huntId: 'h-old', closedAt: '2025-01-01T09:00:00Z' }, { maxReopenMonths: 6 }, { now: '2026-10-09T00:00:00Z' });
  assert.equal(old.expired, true);
  assert.equal(old.action, 'new-hunt-required');
});

test('52913 planFreshEngineReopen: fresh runs against preserved baseline', () => {
  const v = XB.planFreshEngineReopen(HUNT, ['recon', 'vuln-scan'], {});
  assert.equal(v.engineCount, 2);
  assert.equal(v.preservedFindings, 2);
  assert.equal(v.runs[1].engine, 'vuln-scan');
  assert.equal(v.runs[1].baselineFindings, 2);
});

test('52914 estimateReopenCost: scope, findings, scan drive the estimate', () => {
  const v = XB.estimateReopenCost(HUNT, { freshScan: true });
  assert.equal(v.estimatedMinutes, 57);
  assert.equal(v.computeUnits, 86);
  assert.equal(v.breakdown.length, 4);
  const noScan = XB.estimateReopenCost(HUNT, { freshScan: false });
  assert.equal(noScan.estimatedMinutes, 27);
});

test('52915 scheduleReopen: future date booked, past date rejected', () => {
  const v = XB.scheduleReopen(HUNT, { at: '2026-11-01T09:00:00Z', reason: 'Recheck after the planned migration.', requestedBy: 'lead-1' }, { now: '2026-10-09T00:00:00Z' });
  assert.equal(v.scheduled, true);
  assert.equal(v.entry.scheduledAt.slice(0, 10), '2026-11-01');
  const past = XB.scheduleReopen(HUNT, { at: '2026-01-01T09:00:00Z', reason: 'Recheck after the planned migration.' }, { now: '2026-10-09T00:00:00Z' });
  assert.equal(past.scheduled, false);
});

test('52916 buildReopenDiscussionThread: positions tallied into a lean', () => {
  const comments = [
    { id: 'c1', text: 'Should we reopen after the deploy?', position: 'for' },
    { id: 'c2', text: 'Yes, the checkout changed a lot.', position: 'for' },
  ];
  const v = XB.buildReopenDiscussionThread(HUNT, comments, {});
  assert.equal(v.commentCount, 2);
  assert.equal(v.supporting, 2);
  assert.equal(v.decision, 'leaning-reopen');
  assert.equal(v.openQuestions.length, 1);
});

test('52917 getReopenedHuntBadge: reopened label with count', () => {
  const v = XB.getReopenedHuntBadge(HUNT, {});
  assert.equal(v.show, true);
  assert.equal(v.label, 'Reopened');
  assert.equal(v.reopenCount, 1);
  const fresh = XB.getReopenedHuntBadge({ huntId: 'h-new', reopenCount: 0 }, {});
  assert.equal(fresh.show, false);
  assert.equal(fresh.label, 'Original');
});

test('52918 filterHuntsByReopen: minimum reopen count applied', () => {
  const v = XB.filterHuntsByReopen(HUNTS, { minReopens: 1 }, {});
  assert.equal(v.count, 2);
  assert.equal(v.hunts[0].huntId, 'hunt-43');
  assert.equal(v.hunts[0].reopenCount, 2);
});

test('52919 analyzeReopenAnalytics: rate, reasons, premature closures', () => {
  const v = XB.analyzeReopenAnalytics(HUNTS, {});
  assert.equal(v.totalHunts, 3);
  assert.equal(v.reopenedHunts, 2);
  assert.equal(v.reopenRatePercent, 67);
  assert.ok(v.topReason !== null);
  assert.equal(v.totalReopens, 3);
});

test('52920 explainReopenVsRegression: regression picks focused hunt', () => {
  const v = XB.explainReopenVsRegression({ regressionSuspected: true, scopeDriftPercent: 5, ageMonths: 1 }, {});
  assert.equal(v.recommended, 'regression-hunt');
  assert.equal(v.options.length, 3);
  const stale = XB.explainReopenVsRegression({ regressionSuspected: false, scopeDriftPercent: 80, ageMonths: 12 }, {});
  assert.equal(stale.recommended, 'new-hunt');
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
  for (const [label, src, core] of [['A', A_JSX, XA], ['B', B_JSX, XB]]) {
    const names = componentNames(src);
    assert.equal(names.length, 20, `${label}: expected 20 components, got ${names.length}`);
    const fns = Object.keys(core).filter(k => !k.endsWith('_IDEAS'));
    assert.equal(fns.length, 20, `${label}: expected 20 core functions, got ${fns.length}`);
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
test('css: only .w73a-/.w73b- scoped selectors, no globals', () => {
  const noComments = CSS_SRC.replace(/\/\*[\s\S]*?\*\//g, '');
  const classSelectors = [...noComments.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map(m => m[1]);
  assert.ok(classSelectors.length > 10, 'expected many scoped selectors');
  for (const cls of classSelectors) {
    assert.ok(cls.startsWith('w73a-') || cls.startsWith('w73b-'), `unscoped selector: .${cls}`);
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
  for (const f of ['Wave73A.jsx', 'Wave73B.jsx']) {
    const out = execFileSync(
      'npx',
      ['-y', 'esbuild', '--loader:.jsx=jsx', '--format=esm', join(DIR, f)],
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
