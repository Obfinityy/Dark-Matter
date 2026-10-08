/**
 * wave59.test.js — Infinity AI · Dark-Matter · Wave 59
 * node:test + node:assert/strict. Registry coverage (20/20 for 52321–52340,
 * 20/20 for 52341–52360, zero skips, 40/40 combined), deterministic
 * spot-checks of every pure function, Wave59.css scope/zero-animation audits,
 * a real esbuild JSX parse audit, a no-branding-leak audit ("Infinity AI"
 * only) and a no-debris audit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WAVE59_PS_IDEAS } from './postSubmitCore.js';
import * as PS from './postSubmitCore.js';
import { WAVE59_LC_IDEAS } from './lifecycleCore.js';
import * as LC from './lifecycleCore.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const CSS = join(DIR, 'Wave59.css');
const NOW = 1700000000000;

function registryOk(reg, first, count) {
  assert.equal(reg.length, count, `expected ${count} registry entries, got ${reg.length}`);
  const ids = reg.map((e) => e.id);
  assert.deepEqual(ids, Array.from({ length: count }, (_, i) => first + i), 'registry ids must be the exact idea range in order');
  for (const e of reg) {
    assert.ok(typeof e.title === 'string' && e.title.length > 0, `entry ${e.id} needs a title`);
    assert.equal(e.skip, false, `entry ${e.id} must not be skipped`);
  }
  return new Set(ids);
}

/* ---- Registry coverage ---- */
test('WAVE59_PS_IDEAS: 20/20 entries 52321–52340, zero skips', () => {
  registryOk(WAVE59_PS_IDEAS, 52321, 20);
});

test('WAVE59_LC_IDEAS: 20/20 entries 52341–52360, zero skips', () => {
  registryOk(WAVE59_LC_IDEAS, 52341, 20);
});

test('combined coverage: exactly 52321–52360 with no gaps or dupes', () => {
  const all = [...WAVE59_PS_IDEAS.map((e) => e.id), ...WAVE59_LC_IDEAS.map((e) => e.id)];
  assert.equal(all.length, 40);
  assert.deepEqual([...all].sort((a, b) => a - b), Array.from({ length: 40 }, (_, i) => 52321 + i));
});

const FINDING = {
  id: 'f-61', title: 'Stored XSS in product reviews', severity: 'high', cvss: 8.2,
  vulnClass: 'xss', status: 'open', target: 'shop', platform: 'hackerone',
  endpoint: 'https://shop.example.com/reviews',
  description: 'The review body is rendered without output encoding.',
  impact: 'Session theft and account takeover.',
  poc: 'curl -X POST https://shop.example.com/reviews -d "body=<script>alert(1)</script>"',
  pocTrace: ['Log in as any user', 'Post a review with body <script>alert(1)</script>', 'View the product page'],
  evidence: [{ kind: 'screenshot', name: 'xss.png' }, { kind: 'http', summary: 'POST 200' }],
  remediation: 'Encode review output with a context-aware encoder.',
  references: ['https://owasp.org/www-community/attacks/xss/'],
};

const DRAFT = {
  id: 'draft-61', title: 'Stored XSS in product reviews', platform: 'hackerone',
  severity: 'High', impact: 'Session theft and account takeover for any user viewing a poisoned review.',
  steps: ['1. Log in as any user', '2. Post a review with a script payload', '3. View the product page'],
  evidence: [{ kind: 'screenshot', name: 'xss.png' }],
  remediation: 'Encode review output with a context-aware encoder.',
  cwe: 'CWE-79', asset: 'https://shop.example.com/reviews',
  attachments: [{ name: 'xss.png', sizeBytes: 184320 }],
};

/* ---- postSubmitCore spot-checks (deterministic) ---- */
test('52321 remediation suggestion insert: template fallback, custom kept', () => {
  const tpl = PS.suggestRemediation({ id: 'f-x', vulnClass: 'xss' });
  assert.equal(tpl.ok, true);
  assert.equal(tpl.fromTemplate, true);
  assert.ok(tpl.remediation.toLowerCase().includes('encoding'));
  const custom = PS.suggestRemediation(FINDING);
  assert.equal(custom.remediation, FINDING.remediation);
  assert.equal(custom.fromTemplate, false);
  const inserted = PS.insertRemediation(DRAFT, custom.remediation);
  assert.equal(inserted.ok, true);
  assert.equal(inserted.draft.remediation, FINDING.remediation);
  assert.equal(inserted.draft.remediationSource, 'infinity-ai-suggestion');
  assert.equal(PS.insertRemediation(DRAFT, '').ok, false);
  assert.equal(PS.suggestRemediation({}).ok, false);
});

test('52322 researcher handle branding: handle + profile links', () => {
  const r = PS.applyResearcherBranding(DRAFT, { handle: '@hunter_x', name: 'A. Hunter', profileLinks: ['https://hackerone.com/hunter_x'] });
  assert.equal(r.ok, true);
  assert.equal(r.draft.researcher.handle, '@hunter_x');
  assert.ok(r.draft.signature.includes('@hunter_x'));
  assert.ok(r.draft.signature.includes('hackerone.com/hunter_x'));
  assert.equal(PS.applyResearcherBranding(DRAFT, {}).ok, false);
  assert.equal(PS.applyResearcherBranding(null, { handle: '@h' }).ok, false);
});

test('52323 batch draft creation: grouped per platform, errors collected', () => {
  const build = (f, p) => ({ ok: true, draft: { id: `${f.id}-${p}`, title: f.title } });
  const r = PS.createBatchDrafts([FINDING, { ...FINDING, id: 'f-62' }], ['hackerone', 'bugcrowd'], build, NOW);
  assert.equal(r.ok, true);
  assert.deepEqual(r.batch.counts, { hackerone: 2, bugcrowd: 2 });
  assert.equal(r.batch.errors.length, 0);
  assert.ok(r.batch.id.startsWith('batch_'));
  const withErr = PS.createBatchDrafts([FINDING], ['hackerone'], () => ({ ok: false, reason: 'boom' }), NOW);
  assert.equal(withErr.batch.errors.length, 1);
  assert.equal(withErr.batch.errors[0].reason, 'boom');
  assert.equal(PS.createBatchDrafts([], ['hackerone'], build, NOW).ok, false);
  assert.equal(PS.createBatchDrafts([FINDING], [], build, NOW).ok, false);
});

test('52324 submission queue: priority ordering + scheduled send times', () => {
  let q = PS.createSubmissionQueue('post-hunt', NOW).queue;
  assert.equal(q.name, 'post-hunt');
  q = PS.enqueueSubmission(q, { draftId: 'd-1', platform: 'hackerone', priority: 'low', owner: 'aria', scheduledSendAt: NOW + 7200000 }, NOW).queue;
  q = PS.enqueueSubmission(q, { draftId: 'd-2', platform: 'bugcrowd', priority: 'urgent', owner: 'bhavesh' }, NOW + 1).queue;
  assert.equal(q.items[0].draftId, 'd-2'); // urgent beats scheduled-low
  assert.equal(q.items[0].state, 'queued');
  const due = PS.dequeueDueSubmissions(q, NOW + 1);
  assert.deepEqual(due.due.map((d) => d.draftId), ['d-2']);
  assert.equal(due.remaining, 1);
  assert.equal(PS.enqueueSubmission(q, {}, NOW).ok, false);
  assert.equal(PS.createSubmissionQueue('', NOW).ok, false);
});

test('52325 platform inbox sync: dedupes, skips unknown types', () => {
  const r = PS.syncPlatformInbox({ syncedIds: [] }, [
    { id: 'm-1', type: 'status', reportId: 'r-1', platformStatus: 'triaged' },
    { id: 'm-2', type: 'triager-message', reportId: 'r-1', from: 'triager', body: 'Confirm impact?' },
    { id: 'm-1', type: 'status', reportId: 'r-1' },
    { id: 'm-3', type: 'bogus', reportId: 'r-1' },
  ], NOW);
  assert.equal(r.ok, true);
  assert.equal(r.applied.length, 2);
  assert.equal(r.skipped, 2);
  assert.equal(r.state.lastSyncAt, NOW);
  assert.equal(PS.syncPlatformInbox(null, [], NOW).ok, false);
  assert.ok(PS.INBOX_MESSAGE_TYPES.includes('triager-message'));
});

test('52326 status-change sync: platform status maps to lifecycle + history', () => {
  const r = PS.applyStatusChange(FINDING, 'duplicate', NOW);
  assert.equal(r.ok, true);
  assert.equal(r.finding.lifecycle, 'duplicate');
  assert.equal(r.finding.platformStatus, 'duplicate');
  assert.equal(r.finding.lifecycleHistory[0].source, 'platform-sync');
  assert.equal(r.finding.lifecycleHistory[0].at, NOW);
  const t = PS.applyStatusChange(FINDING, 'triaged', NOW);
  assert.equal(t.finding.lifecycle, 'triaged');
  assert.equal(PS.applyStatusChange(FINDING, 'nope', NOW).ok, false);
  assert.equal(PS.applyStatusChange({}, 'triaged', NOW).ok, false);
});

test('52327 bounty-paid tracking: per-finding entries, rollups by program/hunt/researcher', () => {
  let ledger = PS.recordBountyPaid([], { findingId: 'f-61', huntId: 'h-1', program: 'Acme', researcher: 'aria', amount: 750, platform: 'hackerone' }, NOW).ledger;
  ledger = PS.recordBountyPaid(ledger, { findingId: 'f-62', huntId: 'h-1', program: 'Acme', researcher: 'bhavesh', amount: 1500 }, NOW + 1).ledger;
  assert.equal(ledger.length, 2);
  assert.equal(ledger[0].currency, 'USD');
  const byR = PS.rollUpEarnings(ledger, 'researcher');
  assert.equal(byR.totals.aria.total, 750);
  assert.equal(byR.totals.bhavesh.total, 1500);
  assert.equal(byR.grandTotal, 2250);
  const byP = PS.rollUpEarnings(ledger, 'program');
  assert.equal(byP.totals.Acme.total, 2250);
  assert.equal(PS.rollUpEarnings(ledger, 'hunt').totals['h-1'].count, 2);
  assert.equal(PS.rollUpEarnings(ledger, 'nope').ok, false);
  assert.equal(PS.recordBountyPaid([], { findingId: 'f-1', amount: -5 }, NOW).ok, false);
  assert.equal(PS.recordBountyPaid([], { amount: 5 }, NOW).ok, false);
});

test('52328 safe-harbor verification: stated terms pass, missing terms warn', () => {
  const ok = PS.verifySafeHarbor({ name: 'Acme', safeHarbor: { stated: true } }, FINDING);
  assert.equal(ok.ok, true);
  assert.equal(ok.safeHarbor, true);
  assert.equal(ok.warning, null);
  const risky = PS.verifySafeHarbor({ name: 'Acme', safeHarbor: {} }, FINDING);
  assert.equal(risky.safeHarbor, false);
  assert.ok(risky.warning.includes('Safe-harbor risk'));
  assert.equal(risky.checks.find((c) => c.id === 'harbor-stated').pass, false);
  assert.equal(PS.verifySafeHarbor({}, FINDING).ok, false);
  assert.equal(PS.verifySafeHarbor({ name: 'Acme' }, {}).ok, false);
});

test('52329 out-of-scope warning: hard block without override, override trail recorded', () => {
  const blocked = PS.checkOutOfScope(FINDING, { inScope: ['other.example.com'] });
  assert.equal(blocked.ok, false);
  assert.ok(blocked.reason.includes('OUT-OF-SCOPE'));
  assert.equal(blocked.outOfScope, true);
  const overridden = PS.checkOutOfScope(FINDING, { inScope: ['other.example.com'] }, { reason: 'Vendor confirmed scope extension', by: 'bhavesh' }, NOW);
  assert.equal(overridden.ok, true);
  assert.equal(overridden.override.reason, 'Vendor confirmed scope extension');
  assert.equal(overridden.override.at, NOW);
  const inScope = PS.checkOutOfScope(FINDING, { inScope: ['shop.example.com'] });
  assert.equal(inScope.ok, true);
  assert.equal(inScope.outOfScope, false);
  assert.equal(PS.checkOutOfScope(FINDING, {}).ok, false);
});

test('52330 PII scrub: email/phone/bearer/api-key redacted before submit', () => {
  const r = PS.scrubPii('Victim: jane.doe@example.com, phone +1 555-010-2030, token Bearer abc.def.ghi, key api_key=sk_live_9f8e7d6c5b4a');
  assert.equal(r.ok, true);
  assert.equal(r.redactedCount, 4);
  assert.deepEqual(r.redactions.map((h) => h.id), ['email', 'phone', 'bearer', 'api-key']);
  assert.ok(r.scrubbed.includes('[EMAIL]'));
  assert.ok(r.scrubbed.includes('[PHONE]'));
  assert.ok(r.scrubbed.includes('Bearer [TOKEN]'));
  assert.ok(r.scrubbed.includes('api_key=[SECRET]'));
  assert.ok(!r.scrubbed.includes('jane.doe@example.com'));
  assert.equal(PS.scrubPii(42).ok, false);
});

test('52331 internal review queue: queued -> in-review -> approved, illegal jumps ignored', () => {
  const q0 = PS.createReviewQueue('pre-submit', NOW).queue;
  assert.equal(q0.name, 'pre-submit');
  const added = PS.reviewReducer(q0, { type: 'ADD', draftId: 'draft-61', findingId: 'f-61', submittedBy: 'aria' }, NOW + 1);
  assert.equal(added.item.state, 'queued');
  const inReview = PS.reviewReducer(added.queue, { type: 'TRANSITION', id: added.item.id, to: 'in-review', by: 'bhavesh' }, NOW + 2).queue;
  assert.equal(inReview.items[0].state, 'in-review');
  const approved = PS.reviewReducer(inReview, { type: 'TRANSITION', id: added.item.id, to: 'approved', by: 'bhavesh', note: 'Looks solid.' }, NOW + 3).queue;
  assert.equal(approved.items[0].state, 'approved');
  assert.equal(approved.items[0].notes.length, 1);
  assert.equal(approved.items[0].history.length, 3);
  const illegal = PS.reviewReducer(q0, { type: 'TRANSITION', id: 'missing', to: 'approved' }, NOW + 4);
  assert.equal(illegal.queue.items.length, 0); // unknown id ignored
  assert.equal(PS.reviewReducer(q0, { type: 'NOPE' }, NOW).ok, false);
  assert.equal(PS.reviewReducer(q0, { type: 'ADD' }, NOW).ok, false);
  assert.deepEqual(PS.REVIEW_STATES, ['queued', 'in-review', 'changes-requested', 'approved', 'blocked']);
});

test('52332 submitter approval chain: researcher -> lead -> legal, reject short-circuits', () => {
  let c = PS.createApprovalChain('f-61', { program: 'Acme' }, NOW).chain;
  assert.deepEqual(c.steps.map((s) => s.role), ['researcher', 'lead', 'legal']);
  c = PS.approvalChainReducer(c, { type: 'DECIDE', decision: 'approve', by: 'aria' }, NOW + 1).chain;
  c = PS.approvalChainReducer(c, { type: 'DECIDE', decision: 'approve', by: 'bhavesh' }, NOW + 2).chain;
  assert.equal(c.state, 'pending');
  c = PS.approvalChainReducer(c, { type: 'DECIDE', decision: 'approve', by: 'legal@x.com' }, NOW + 3).chain;
  assert.equal(c.state, 'approved');
  assert.equal(c.steps[2].by, 'legal@x.com');
  let r2 = PS.createApprovalChain('f-62', {}, NOW).chain;
  r2 = PS.approvalChainReducer(r2, { type: 'DECIDE', decision: 'reject', by: 'bhavesh', reason: 'scope unclear' }, NOW + 1).chain;
  assert.equal(r2.state, 'rejected');
  assert.equal(PS.approvalChainReducer(r2, { type: 'DECIDE', decision: 'approve' }, NOW + 2).ok, false);
  assert.equal(PS.createApprovalChain('', {}, NOW).ok, false);
  assert.deepEqual(PS.CHAIN_STEPS, ['researcher', 'lead', 'legal']);
});

test('52333 submission history log: append + filter', () => {
  let log = PS.appendSubmissionHistory([], { draftId: 'draft-61', findingId: 'f-61', platform: 'hackerone', action: 'submitted', by: 'aria', response: 'accepted' }, NOW).log;
  log = PS.appendSubmissionHistory(log, { draftId: 'draft-61', findingId: 'f-61', platform: 'hackerone', action: 'bounty-awarded', by: 'platform', response: '$750' }, NOW + 1).log;
  assert.equal(log.length, 2);
  assert.equal(log[0].at, NOW);
  assert.equal(log[1].action, 'bounty-awarded');
  const filtered = PS.filterSubmissionHistory(log, { action: 'bounty-awarded' });
  assert.equal(filtered.records.length, 1);
  assert.equal(PS.filterSubmissionHistory(log, { platform: 'bugcrowd' }).records.length, 0);
  assert.equal(PS.appendSubmissionHistory([], {}, NOW).ok, false);
});

test('52334 resubmission after fix: retest draft with original steps', () => {
  const r = PS.buildResubmissionDraft(FINDING, 'Output encoding deployed; CSP header added.', NOW);
  assert.equal(r.ok, true);
  assert.equal(r.draft.kind, 'retest');
  assert.equal(r.draft.title, 'Retest: Stored XSS in product reviews');
  assert.equal(r.draft.retestSteps.length, 3);
  assert.equal(r.draft.fixNotes, 'Output encoding deployed; CSP header added.');
  assert.ok(r.draft.expected.includes('no longer reproducible'));
  assert.equal(PS.buildResubmissionDraft(FINDING, '', NOW).ok, false);
  assert.equal(PS.buildResubmissionDraft({}, 'x', NOW).ok, false);
});

test('52335 platform message templates: canned replies with variable fill', () => {
  const r = PS.fillMessageTemplate('triage-nudge', { handle: '@hunter_x' });
  assert.equal(r.ok, true);
  assert.equal(r.kind, 'triage-nudge');
  assert.ok(r.message.body.includes('@hunter_x'));
  assert.ok(!r.message.body.includes('{handle}'));
  const dispute = PS.fillMessageTemplate('duplicate-dispute', { handle: '@h', duplicateId: 'r-9', reason: 'different endpoint' });
  assert.ok(dispute.message.body.includes('r-9'));
  assert.equal(Object.keys(PS.MESSAGE_TEMPLATES).length, 5);
  assert.equal(PS.fillMessageTemplate('nope', {}).ok, false);
});

test('52336 triager-question draft replies: grounded, awaiting human send', () => {
  const steps = PS.draftTriagerReply('Can you show the exact reproduction steps again?', FINDING);
  assert.equal(steps.ok, true);
  assert.ok(steps.reply.answer.includes('1. Log in as any user'));
  assert.equal(steps.reply.status, 'draft-awaiting-human-send');
  assert.ok(steps.reply.groundedIn.includes('pocTrace'));
  const impact = PS.draftTriagerReply('What is the business impact?', FINDING);
  assert.ok(impact.reply.answer.includes('Session theft'));
  const generic = PS.draftTriagerReply('Anything else?', FINDING);
  assert.ok(generic.reply.answer.includes('Stored XSS in product reviews'));
  assert.equal(PS.draftTriagerReply('', FINDING).ok, false);
  assert.equal(PS.draftTriagerReply('q?', {}).ok, false);
});

test('52337 mediation escalation draft: full evidence trail', () => {
  const r = PS.buildMediationDraft(
    { ...FINDING, reportId: 'r-1', platformStatus: 'not-applicable' },
    [{ type: 'status-change', at: NOW - 1000, note: 'closed as not-applicable' }, { type: 'evidence', at: NOW, note: 'video PoC' }],
    NOW,
  );
  assert.equal(r.ok, true);
  assert.equal(r.draft.status, 'draft');
  assert.equal(r.draft.evidenceTrail.length, 2);
  assert.equal(r.draft.evidenceTrail[0].index, 1);
  assert.ok(r.draft.summary.includes('r-1'));
  assert.equal(PS.buildMediationDraft(FINDING, [], NOW).ok, false);
  assert.equal(PS.buildMediationDraft({}, [{ a: 1 }], NOW).ok, false);
});

test('52338 disclosure timeline tracker: due reminders + lapsed detection', () => {
  const tl = PS.createDisclosureTimeline([
    { reportId: 'r-1', findingId: 'f-61', agreedDate: NOW + 5 * 24 * 3600 * 1000 },
    { reportId: 'r-2', findingId: 'f-62', agreedDate: NOW - 24 * 3600 * 1000 },
    { reportId: 'r-3' }, // no agreed date → excluded
  ], NOW).timeline;
  assert.equal(tl.entries.length, 2);
  const u = PS.upcomingDisclosures(tl, NOW);
  assert.equal(u.ok, true);
  assert.equal(u.counts.due, 1);
  assert.equal(u.due[0].reportId, 'r-1');
  assert.equal(u.due[0].daysLeft, 5);
  assert.equal(u.counts.lapsed, 1);
  assert.equal(u.lapsed[0].reportId, 'r-2');
  assert.equal(PS.createDisclosureTimeline('nope', NOW).ok, false);
  assert.equal(PS.upcomingDisclosures(null, NOW).ok, false);
});

test('52339 coordinated disclosure scheduler: aligns public date with fix release', () => {
  const r = PS.scheduleCoordinatedDisclosure({
    findingId: 'f-61', vendor: 'Acme', reportedAt: NOW - 80 * 24 * 3600 * 1000,
    fixReleaseAt: NOW + 2 * 24 * 3600 * 1000, embargoDays: 90,
  }, NOW);
  assert.equal(r.ok, true);
  assert.equal(r.schedule.publicAt, NOW + 9 * 24 * 3600 * 1000);
  assert.equal(r.schedule.withinEmbargo, true);
  assert.equal(r.schedule.status, 'scheduled');
  assert.equal(r.schedule.embargoDays, 90);
  const early = PS.scheduleCoordinatedDisclosure({ findingId: 'f-61', fixReleaseAt: NOW + 1000, publicAt: NOW - 1000 }, NOW);
  assert.equal(early.ok, false);
  assert.equal(PS.scheduleCoordinatedDisclosure({ findingId: 'f-61' }, NOW).ok, false);
});

test('52340 CVE request draft: technical details pre-filled', () => {
  const r = PS.buildCveRequestDraft(
    { ...FINDING, cwes: ['CWE-79'] },
    { product: 'Acme Shop', vendor: 'Acme', version: '2.4.1', reporter: '@hunter_x' },
  );
  assert.equal(r.ok, true);
  assert.equal(r.draft.product, 'Acme Shop');
  assert.equal(r.draft.vendor, 'Acme');
  assert.equal(r.draft.version, '2.4.1');
  assert.deepEqual(r.draft.cwe, ['CWE-79']);
  assert.equal(r.draft.cvss, 8.2);
  assert.equal(r.draft.status, 'draft');
  assert.equal(PS.buildCveRequestDraft({ id: 'f-x' }, {}).ok, false);
  assert.equal(PS.buildCveRequestDraft({}, {}).ok, false);
});

/* ---- lifecycleCore spot-checks (deterministic) ---- */
const SUBMISSIONS = [
  { id: 's-1', platform: 'hackerone', state: 'triaged', submittedAt: 1699000000000, triagedAt: 1699003600000, payout: null },
  { id: 's-2', platform: 'hackerone', state: 'paid', submittedAt: 1699000000000, triagedAt: 1699010000000, payout: 750 },
  { id: 's-3', platform: 'bugcrowd', state: 'submitted', submittedAt: 1699000000000, triagedAt: null, payout: null },
  { id: 's-4', platform: 'bugcrowd', state: 'duplicate', submittedAt: 1699000000000, triagedAt: 1699020000000, payout: null },
];

test('52341 submission analytics: acceptance rate, median triage time, payouts', () => {
  const r = LC.computeSubmissionAnalytics(SUBMISSIONS);
  assert.equal(r.ok, true);
  assert.equal(r.analytics.total, 4);
  assert.equal(r.analytics.accepted, 2);
  assert.equal(r.analytics.acceptanceRate, 0.5);
  assert.equal(r.analytics.medianTimeToTriageMs, 10000000);
  assert.equal(r.analytics.payout.total, 750);
  assert.equal(r.analytics.payout.count, 1);
  assert.equal(r.analytics.payout.max, 750);
  const empty = LC.computeSubmissionAnalytics([]);
  assert.equal(empty.analytics.acceptanceRate, null);
  assert.equal(empty.analytics.medianTimeToTriageMs, null);
});

test('52342 per-platform acceptance stats: ranked best-first', () => {
  const r = LC.computeAcceptanceStats(SUBMISSIONS);
  assert.equal(r.ok, true);
  assert.equal(r.perPlatform.hackerone.acceptanceRate, 1);
  assert.equal(r.perPlatform.bugcrowd.acceptanceRate, 0);
  assert.equal(r.ranked[0].platform, 'hackerone');
  assert.equal(r.ranked[1].platform, 'bugcrowd');
  const filtered = LC.computeAcceptanceStats(SUBMISSIONS, 'hackerone');
  assert.deepEqual(Object.keys(filtered.perPlatform), ['hackerone']);
});

test('52343 draft versioning: every revision kept, diffable', () => {
  let versions = LC.appendDraftVersion([], DRAFT, 'aria', NOW).versions;
  versions = LC.appendDraftVersion(versions, { ...DRAFT, impact: 'Updated impact text.' }, 'bhavesh', NOW + 1).versions;
  assert.equal(versions.length, 2);
  assert.equal(versions[0].version, 1);
  assert.equal(versions[1].author, 'bhavesh');
  assert.ok(versions[1].id.startsWith('dv_'));
  const v2 = LC.getDraftVersion(versions, 2);
  assert.equal(v2.version.draft.impact, 'Updated impact text.');
  assert.equal(LC.getDraftVersion(versions, 9).ok, false);
  const diff = LC.diffDraftVersions(versions, 1, 2);
  assert.equal(diff.ok, true);
  assert.deepEqual(diff.changes.map((c) => c.field), ['impact']);
  assert.equal(LC.appendDraftVersion([], null, 'aria', NOW).ok, false);
});

test('52344 collaborative draft editing: tracked changes by author', () => {
  const r = LC.applyCollaborativeEdit(DRAFT,
    { changes: [{ field: 'title', value: 'Stored XSS (critical)' }], comment: 'tightened title' }, 'bhavesh', NOW);
  assert.equal(r.ok, true);
  assert.equal(r.draft.title, 'Stored XSS (critical)');
  assert.equal(r.draft.changeLog.length, 1);
  assert.equal(r.edit.author, 'bhavesh');
  assert.equal(r.edit.changes[0].from, DRAFT.title);
  assert.equal(r.edit.changes[0].to, 'Stored XSS (critical)');
  assert.equal(LC.applyCollaborativeEdit(DRAFT, { changes: [{ field: 'title', value: 'x' }] }, null, NOW).ok, false);
  assert.equal(LC.applyCollaborativeEdit(DRAFT, { changes: [] }, 'bhavesh', NOW).ok, false);
  assert.equal(LC.applyCollaborativeEdit(null, { changes: [{ field: 'a', value: 1 }] }, 'bhavesh', NOW).ok, false);
});

test('52345 credential vault: handle descriptors only, plaintext always rejected', () => {
  const r = LC.storeCredentialHandle({ platform: 'hackerone', owner: 'aria', ciphertextRef: 'kms://vault/h1-aria/v3', scopes: ['read', 'submit'], maskedHint: '••••9f2a' }, NOW);
  assert.equal(r.ok, true);
  assert.equal(r.credential.plaintext, null);
  assert.equal(r.credential.ciphertextRef, 'kms://vault/h1-aria/v3');
  assert.deepEqual(r.credential.scopes, ['read', 'submit']);
  assert.equal(r.credential.maskedHint, '••••9f2a');
  const leaked = LC.storeCredentialHandle({ platform: 'hackerone', owner: 'aria', plaintext: 'secret-token' }, NOW);
  assert.equal(leaked.ok, false);
  assert.ok(leaked.reason.includes('never accepted'));
  const rotated = LC.rotateCredentialHandle(r.credential, 'kms://vault/h1-aria/v4', NOW + 1);
  assert.equal(rotated.credential.ciphertextRef, 'kms://vault/h1-aria/v4');
  assert.equal(rotated.credential.lastRotatedAt, NOW + 1);
  assert.equal(rotated.credential.plaintext, null);
  assert.equal(LC.storeCredentialHandle({ owner: 'aria', ciphertextRef: 'x' }, NOW).ok, false);
  assert.deepEqual(LC.VAULT_SCOPES, ['read', 'submit', 'webhook']);
});

test('52346 test-mode submission: sandbox descriptor, zero real reports', () => {
  const sub = LC.buildTestModeSubmission(DRAFT, 'hackerone', NOW).submission;
  assert.equal(sub.mode, 'test');
  assert.equal(sub.sandbox, true);
  assert.equal(sub.willCreateRealReport, false);
  assert.equal(sub.networkCalls, 0);
  assert.equal(sub.createdAt, NOW);
  const marked = LC.markTestModeResult(sub, { valid: true, errors: [] }, NOW + 1);
  assert.equal(marked.submission.testResult.valid, true);
  assert.equal(marked.submission.testResult.evaluatedAt, NOW + 1);
  assert.equal(LC.buildTestModeSubmission(null, 'hackerone', NOW).ok, false);
  assert.equal(LC.markTestModeResult({ mode: 'live' }, {}, NOW).ok, false);
});

test('52347 dry-run validation: pre-flight checks with fix-it hints', () => {
  const r = LC.dryRunValidate(DRAFT, 'hackerone');
  assert.equal(r.ok, true);
  assert.equal(r.passed, true);
  assert.deepEqual(r.failed, []);
  assert.equal(r.checks.length, 6);
  const bad = LC.dryRunValidate({ ...DRAFT, title: '' }, 'hackerone');
  assert.equal(bad.passed, false);
  assert.ok(bad.failed.includes('title-present'));
  const hint = bad.checks.find((c) => c.id === 'title-present').hint;
  assert.ok(hint && hint.length > 0);
  const big = LC.dryRunValidate({ ...DRAFT, attachments: [{ name: 'v.mp4', sizeBytes: 200 * 1024 * 1024 }] }, 'hackerone');
  assert.ok(big.failed.includes('attachments-within-limit'));
  assert.equal(LC.dryRunValidate(null, 'hackerone').ok, false);
  assert.ok(LC.DRY_RUN_CHECKS.every((c) => typeof c.hint === 'string'));
});

test('52348 rate-limit handling: over-limit submissions queued with retry hint', () => {
  let limiter = LC.createRateLimiter({ hackerone: { maxPerMinute: 2, maxPerHour: 10 } }, NOW).limiter;
  const decisions = [];
  for (let i = 0; i < 3; i += 1) {
    const r = LC.rateLimitNext(limiter, 'hackerone', { id: `sub-${i}` }, NOW + i * 1000);
    limiter = r.limiter;
    decisions.push(r.decision);
  }
  assert.deepEqual(decisions, ['send', 'send', 'queued']);
  assert.equal(limiter.buckets.hackerone.queued.length, 1);
  const retry = LC.rateLimitNext(limiter, 'hackerone', { id: 'x' }, NOW + 3000);
  assert.ok(retry.retryAfterMs > 0);
  assert.equal(LC.rateLimitNext(limiter, 'unknown-platform', {}, NOW).ok, false);
  assert.equal(LC.createRateLimiter({}, NOW).ok, false);
});

test('52349 submission notifications: status-change/bounty/triager/sla kinds', () => {
  const r = LC.createSubmissionNotification('status-change',
    { to: 'aria', reportId: 'r-1', findingId: 'f-61', title: 'Report triaged', body: 'marked triaged' }, NOW);
  assert.equal(r.ok, true);
  assert.equal(r.notification.kind, 'status-change');
  assert.equal(r.notification.to, 'aria');
  assert.equal(r.notification.status, 'unread');
  const paid = LC.createSubmissionNotification('bounty-paid', { to: 'aria', findingId: 'f-61' }, NOW);
  assert.equal(paid.notification.kind, 'bounty-paid');
  assert.equal(LC.createSubmissionNotification('nope', { to: 'aria', findingId: 'f-61' }, NOW).ok, false);
  assert.equal(LC.createSubmissionNotification('status-change', { to: 'aria' }, NOW).ok, false);
  assert.deepEqual(LC.SUBMISSION_NOTIF_KINDS, ['status-change', 'bounty-paid', 'triager-question', 'sla-breach']);
});

test('52350 webhook receiver: inbound events mapped to lifecycle patches', () => {
  const wh = LC.receiveWebhook({ event: 'report.bounty_awarded', reportId: 'r-1', platform: 'hackerone', data: { amount: 750 } }, {}, NOW).webhook;
  assert.equal(wh.event, 'report.bounty_awarded');
  assert.equal(wh.receivedAt, NOW);
  const patch = LC.webhookToLifecyclePatch(wh);
  assert.equal(patch.ok, true);
  assert.equal(patch.patch.lifecycle, 'paid');
  assert.equal(patch.patch.payout, 750);
  assert.equal(patch.patch.source, 'platform-webhook');
  const status = LC.receiveWebhook({ event: 'report.status_changed', reportId: 'r-2', data: { status: 'resolved' } }, {}, NOW).webhook;
  assert.equal(LC.webhookToLifecyclePatch(status).patch.lifecycle, 'resolved');
  assert.equal(LC.receiveWebhook({ event: 'nope', reportId: 'r-1' }, {}, NOW).ok, false);
  assert.equal(LC.receiveWebhook({ reportId: 'r-1' }, {}, NOW).ok, false);
  assert.equal(LC.receiveWebhook({ event: 'report.commented', reportId: 'r-1' }, { verifySignature: true }, NOW).ok, false);
  assert.deepEqual(LC.WEBHOOK_EVENTS.length, 4);
});

test('52351 bounty earnings leaderboard: ranked with program/quarter breakdowns', () => {
  const r = LC.buildLeaderboard([
    { researcher: 'aria', program: 'Acme', amount: 750, paidAt: Date.UTC(2026, 5, 10) },
    { researcher: 'bhavesh', program: 'Acme', amount: 1500, paidAt: Date.UTC(2026, 6, 2) },
    { researcher: 'aria', program: 'Globex', amount: 300, paidAt: Date.UTC(2026, 1, 20) },
  ]);
  assert.equal(r.ok, true);
  assert.equal(r.leaderboard.researchers[0].researcher, 'bhavesh');
  assert.equal(r.leaderboard.researchers[0].rank, 1);
  assert.equal(r.leaderboard.researchers[1].researcher, 'aria');
  assert.equal(r.leaderboard.researchers[1].total, 1050);
  assert.equal(r.leaderboard.byProgram.Acme.total, 2250);
  assert.ok(r.leaderboard.byQuarter['2026-Q2'].total === 750);
  assert.equal(r.leaderboard.grandTotal, 2550);
  assert.equal(r.leaderboard.payoutCount, 3);
});

test('52352 tax-report export: annual rows per researcher with CSV', () => {
  const earnings = [
    { researcher: 'aria', program: 'Acme', amount: 750, paidAt: Date.UTC(2026, 5, 10), currency: 'USD', findingId: 'f-61' },
    { researcher: 'aria', program: 'Globex', amount: 300, paidAt: Date.UTC(2025, 11, 1), currency: 'USD', findingId: 'f-62' },
  ];
  const r = LC.exportTaxReport(earnings, 2026, 'aria');
  assert.equal(r.ok, true);
  assert.equal(r.report.count, 1);
  assert.equal(r.report.total, 750);
  assert.equal(r.report.lines[0].date, '2026-06-10');
  assert.ok(r.report.csv.startsWith('date,program,finding_id,amount,currency'));
  assert.ok(r.report.csv.includes('f-61'));
  assert.ok(r.report.disclaimer.includes('tax professional'));
  assert.equal(LC.exportTaxReport(earnings, '2026', 'aria').ok, false);
  assert.equal(LC.exportTaxReport(earnings, 2026).ok, false);
});

test('52353 duplicate-merge before submit: combined evidence + assets', () => {
  const r = LC.mergeDuplicates([
    { id: 'f-61', title: 'Stored XSS in reviews', endpoint: 'https://shop.example.com/reviews', evidence: [{ kind: 'screenshot' }] },
    { id: 'f-61b', title: 'XSS via review body', url: 'https://shop.example.com/reviews', evidence: [{ kind: 'http' }, { kind: 'video' }] },
  ], NOW);
  assert.equal(r.ok, true);
  assert.deepEqual(r.merged.mergedIds, ['f-61', 'f-61b']);
  assert.equal(r.merged.primaryId, 'f-61');
  assert.equal(r.merged.evidenceCount, 3);
  assert.deepEqual(r.merged.assets, ['https://shop.example.com/reviews']);
  assert.deepEqual(r.merged.altTitles, ['XSS via review body']);
  assert.equal(LC.mergeDuplicates([{ id: 'f-1' }], NOW).ok, false);
  assert.equal(LC.mergeDuplicates([{ id: 'f-1' }, {}], NOW).ok, false);
});

test('52354 program discovery: match targets against connected programs', () => {
  const r = LC.discoverPrograms([
    { name: 'Acme', platform: 'hackerone', inScope: ['shop.example.com'], bounty: true },
    { name: 'Globex', platform: 'bugcrowd', inScope: ['other.example.com'], bounty: false },
  ], ['shop.example.com']);
  assert.equal(r.ok, true);
  assert.equal(r.count, 1);
  assert.equal(r.matches[0].program, 'Acme');
  assert.equal(r.matches[0].bounty, true);
  assert.deepEqual(r.matches[0].matchedTargets, ['shop.example.com']);
  const none = LC.discoverPrograms([{ name: 'X', inScope: ['zzz'] }], ['shop.example.com']);
  assert.equal(none.count, 0);
  assert.equal(LC.discoverPrograms([], [], NOW).ok, false);
});

test('52355 scope-diff alerts: added/removed assets flagged', () => {
  const r = LC.diffProgramScope(
    { name: 'Acme', inScope: ['shop.example.com', 'api.example.com'] },
    ['shop.example.com', 'old.example.com'],
  );
  assert.equal(r.ok, true);
  assert.deepEqual(r.added, ['api.example.com']);
  assert.deepEqual(r.removed, ['old.example.com']);
  assert.equal(r.changed, true);
  assert.ok(r.alert.includes('Acme'));
  const same = LC.diffProgramScope({ name: 'Acme', inScope: ['a.com'] }, ['a.com']);
  assert.equal(same.changed, false);
  assert.equal(same.alert, null);
  assert.equal(LC.diffProgramScope({}, ['a'], NOW).ok, false);
});

test('52356 submission SLA monitor: stalled reports flagged', () => {
  const r = LC.monitorSubmissionSla([
    { id: 's-1', platform: 'hackerone', submittedAt: NOW - 10 * 24 * 3600 * 1000 },
    { id: 's-2', platform: 'hackerone', submittedAt: NOW - 1 * 24 * 3600 * 1000 },
    { id: 's-3', platform: 'hackerone', submittedAt: NOW - 10 * 24 * 3600 * 1000, triagedAt: NOW - 9 * 24 * 3600 * 1000 },
  ], { hackerone: 7 * 24 * 3600 * 1000 }, NOW);
  assert.equal(r.ok, true);
  assert.equal(r.breachedCount, 1);
  assert.equal(r.breached[0].id, 's-1');
  assert.equal(r.rows.find((x) => x.id === 's-3').responded, true);
  assert.equal(r.rows.find((x) => x.id === 's-3').breached, false);
  assert.equal(LC.monitorSubmissionSla('nope', {}, NOW).ok, false);
});

test('52357 report-quality score: completeness grades A–D', () => {
  const r = LC.scoreReportQuality(DRAFT);
  assert.equal(r.ok, true);
  assert.equal(r.quality.score, 100);
  assert.equal(r.quality.grade, 'A');
  assert.deepEqual(r.quality.missing, []);
  const thin = LC.scoreReportQuality({ title: 'x', severity: 'high' });
  assert.ok(thin.quality.score < 100);
  assert.ok(thin.quality.missing.includes('evidence'));
  assert.ok(thin.quality.missing.includes('steps'));
  assert.ok(['A', 'B', 'C', 'D'].includes(thin.quality.grade));
  assert.equal(LC.scoreReportQuality(null).ok, false);
});

test('52358 platform disclosure check: embargo + consent blockers', () => {
  const blocked = LC.checkDisclosurePolicy(DRAFT, 'intigriti', { embargoDays: 45, vendorConsent: false }, NOW);
  assert.equal(blocked.ok, true);
  assert.equal(blocked.compliant, false);
  assert.ok(blocked.blockers.some((b) => b.includes('90 days')));
  assert.ok(blocked.blockers.some((b) => b.includes('consent')));
  const ok = LC.checkDisclosurePolicy(DRAFT, 'hackerone', { embargoDays: 30, vendorConsent: true }, NOW);
  assert.equal(ok.compliant, true);
  assert.deepEqual(ok.blockers, []);
  assert.equal(LC.checkDisclosurePolicy(DRAFT, 'nope', {}, NOW).ok, false);
  assert.equal(LC.checkDisclosurePolicy(null, 'hackerone', {}, NOW).ok, false);
});

test('52359 lifecycle state machine: enforced transitions, illegal jumps rejected', () => {
  let lc = LC.createLifecycle('f-61', NOW).lifecycle;
  assert.equal(lc.state, 'new');
  assert.ok(lc.id.startsWith('lc_'));
  lc = LC.lifecycleReducer(lc, { type: 'TRANSITION', to: 'triaged', by: 'aria', reason: 'validated' }, NOW + 1).lifecycle;
  assert.equal(lc.state, 'triaged');
  lc = LC.lifecycleReducer(lc, { type: 'TRANSITION', to: 'confirmed', by: 'bhavesh' }, NOW + 2).lifecycle;
  assert.equal(lc.state, 'confirmed');
  assert.equal(lc.history.length, 3);
  assert.equal(lc.history[1].by, 'aria');
  const illegal = LC.lifecycleReducer(lc, { type: 'TRANSITION', to: 'closed' }, NOW + 3);
  assert.equal(illegal.ok, false);
  assert.ok(illegal.reason.includes('illegal transition confirmed → closed'));
  const needsInfo = LC.lifecycleReducer(lc, { type: 'TRANSITION', to: 'needs-info' }, NOW + 4).lifecycle;
  assert.equal(needsInfo.state, 'needs-info');
  assert.equal(LC.createLifecycle('', NOW).ok, false);
  assert.equal(LC.lifecycleReducer(lc, { type: 'NOPE' }, NOW).ok, false);
  assert.deepEqual(LC.LIFECYCLE_STATES.length, 10);
});

test('52360 custom lifecycle states: org states with colors/icons/rules', () => {
  let lc = LC.createLifecycle('f-61', NOW).lifecycle;
  const added = LC.addCustomState(lc, { id: 'pen-test-review', label: 'Pen-test review', color: '#f59e0b', icon: 'shield', from: ['triaged'], to: ['confirmed'] });
  assert.equal(added.ok, true);
  assert.equal(added.custom.color, '#f59e0b');
  assert.equal(added.custom.icon, 'shield');
  lc = added.lifecycle;
  lc = LC.lifecycleReducer(lc, { type: 'TRANSITION', to: 'triaged' }, NOW + 1).lifecycle;
  lc = LC.lifecycleReducer(lc, { type: 'TRANSITION', to: 'pen-test-review', by: 'aria' }, NOW + 2).lifecycle;
  assert.equal(lc.state, 'pen-test-review');
  lc = LC.lifecycleReducer(lc, { type: 'TRANSITION', to: 'confirmed' }, NOW + 3).lifecycle;
  assert.equal(lc.state, 'confirmed');
  assert.equal(LC.addCustomState(lc, { id: 'closed' }).ok, false); // reserved
  assert.equal(LC.addCustomState(lc, { id: 'pen-test-review' }).ok, false); // duplicate
  assert.equal(LC.addCustomState(lc, { id: 'Bad ID' }).ok, false);
  const listed = LC.listLifecycleStates(lc);
  assert.equal(listed.states.length, 11);
  assert.ok(listed.states.some((s) => s.id === 'pen-test-review' && s.custom === true));
  assert.equal(LC.addCustomState(null, { id: 'x' }).ok, false);
});

/* ---- Wave59.css audits: scoped prefixes, zero keyframes ---- */
test('Wave59.css exists, uses only psn59-/lc59- classes, zero keyframes', () => {
  assert.ok(existsSync(CSS), 'Wave59.css missing');
  const css = readFileSync(CSS, 'utf8');
  assert.ok(!/@keyframes/i.test(css), 'zero-animation order: no @keyframes allowed');
  assert.ok(!/animation\s*:/i.test(css), 'zero-animation order: no animation declarations allowed');
  assert.ok(!/transition\s*:/i.test(css), 'zero-animation order: no transition declarations allowed');
  const selectors = [...css.matchAll(/\.([a-zA-Z0-9_-]+)\s*[{,]/g)].map((m) => m[1]);
  const classSelectors = [...css.matchAll(/^\.([a-z0-9][a-z0-9-]*)/gim)].map((m) => m[1]);
  const all = new Set([...selectors, ...classSelectors].filter((s) => /^[a-z]/.test(s)));
  assert.ok(all.size > 0, 'no class selectors found');
  for (const s of all) {
    assert.ok(s.startsWith('psn59-') || s.startsWith('lc59-'), `unscoped selector: .${s}`);
  }
});

/* ---- JSX audits: real esbuild parse + 20/20 components + idea comments + galleries ---- */
function esbuildParseOk(file) {
  execFileSync('npx', ['-y', 'esbuild', '--loader:.jsx=jsx', file], { stdio: 'pipe' });
}

test('PostSubmit.jsx: real esbuild parse + 20 components + idea comments 52321–52340', () => {
  const file = join(DIR, 'PostSubmit.jsx');
  assert.ok(existsSync(file), 'PostSubmit.jsx missing');
  esbuildParseOk(file);
  const body = readFileSync(file, 'utf8');
  const comments = [...body.matchAll(/\/\*\s*(523\d\d)\s*—/g)].map((m) => Number(m[1]));
  assert.deepEqual(comments, Array.from({ length: 20 }, (_, i) => 52321 + i));
  const exported = [...body.matchAll(/export function ([A-Za-z][A-Za-z0-9]*)\(/g)].map((m) => m[1]);
  const components = exported.filter((n) => n !== 'PostSubmitGallery');
  assert.equal(components.length, 20, `expected 20 components, got ${components.length}`);
  const gallery = body.match(/export const PSN59_GALLERY = \[([\s\S]*?)\];/);
  assert.ok(gallery, 'PSN59_GALLERY missing');
  const entries = gallery[1].match(/[A-Za-z][A-Za-z0-9]*/g) || [];
  assert.equal(entries.length, 20);
  for (const e of entries) assert.ok(components.includes(e), `gallery entry ${e} is not an exported component`);
  assert.ok(body.includes('PostSubmitGallery'));
});

test('LifecycleMgmt.jsx: real esbuild parse + 20 components + idea comments 52341–52360', () => {
  const file = join(DIR, 'LifecycleMgmt.jsx');
  assert.ok(existsSync(file), 'LifecycleMgmt.jsx missing');
  esbuildParseOk(file);
  const body = readFileSync(file, 'utf8');
  const comments = [...body.matchAll(/\/\*\s*(523\d\d)\s*—/g)].map((m) => Number(m[1]));
  assert.deepEqual(comments, Array.from({ length: 20 }, (_, i) => 52341 + i));
  const exported = [...body.matchAll(/export function ([A-Za-z][A-Za-z0-9]*)\(/g)].map((m) => m[1]);
  const components = exported.filter((n) => n !== 'LifecycleMgmtGallery');
  assert.equal(components.length, 20, `expected 20 components, got ${components.length}`);
  const gallery = body.match(/export const LC59_GALLERY = \[([\s\S]*?)\];/);
  assert.ok(gallery, 'LC59_GALLERY missing');
  const entries = gallery[1].match(/[A-Za-z][A-Za-z0-9]*/g) || [];
  assert.equal(entries.length, 20);
  for (const e of entries) assert.ok(components.includes(e), `gallery entry ${e} is not an exported component`);
  assert.ok(body.includes('LifecycleMgmtGallery'));
});

/* ---- Branding-leak audit: no forbidden brand name in wave-59 files ---- */
test('no branding leak in wave-59 files', () => {
  const files = ['postSubmitCore.js', 'lifecycleCore.js', 'PostSubmit.jsx', 'LifecycleMgmt.jsx', 'Wave59.css', 'wave59.test.js'];
  const probe = 'M' + 'use'; // self-reference would fail the audit itself
  for (const f of files) {
    const p = join(DIR, f);
    assert.ok(existsSync(p), `${f} missing`);
    const body = readFileSync(p, 'utf8');
    assert.ok(!body.includes(probe), `branding leak in ${f}`);
  }
});

/* ---- No-debris audit: no leftover scaffolding words in wave-59 files ---- */
test('no debris markers in wave-59 files', () => {
  const files = ['postSubmitCore.js', 'lifecycleCore.js', 'PostSubmit.jsx', 'LifecycleMgmt.jsx', 'Wave59.css', 'wave59.test.js'];
  const debris = new RegExp(['T' + 'ODO', 'mo' + 'ck', 'si' + 'mulate', 'lo' + 'rem'].join('|'), 'i');
  for (const f of files) {
    const body = readFileSync(join(DIR, f), 'utf8');
    assert.ok(!debris.test(body), `debris marker found in ${f}`);
  }
});
