/**
 * wave74.test.js — Infinity AI · Dark-Matter · Wave 74
 * node:test + node:assert/strict. Registry coverage (20/20 for 52921–52940,
 * 20/20 for 52941–52960, zero skips, 40/40 combined), registry titles matched
 * against the idea bank, deterministic spot-checks of every pure function
 * (at least one assertion per idea), a JSX↔core call-shape audit (every
 * exported component calls ≥1 exported core function), Wave74.css
 * scope/zero-animation audits, a real esbuild JSX parse audit, a
 * no-branding-leak audit ("Infinity AI" only) and a no-debris audit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WAVE74_A_IDEAS } from './wave74ACore.js';
import * as XA from './wave74ACore.js';
import { WAVE74_B_IDEAS } from './wave74BCores.js';
import * as XB from './wave74BCores.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const A_SRC = readFileSync(join(DIR, 'wave74ACore.js'), 'utf8');
const B_SRC = readFileSync(join(DIR, 'wave74BCores.js'), 'utf8');
const A_JSX = readFileSync(join(DIR, 'Wave74A.jsx'), 'utf8');
const B_JSX = readFileSync(join(DIR, 'Wave74B.jsx'), 'utf8');
const CSS_SRC = readFileSync(join(DIR, 'Wave74.css'), 'utf8');
const BRAND_SRC = [['A core', A_SRC], ['B core', B_SRC], ['A jsx', A_JSX], ['B jsx', B_JSX], ['css', CSS_SRC]];

const FINDINGS = [
  { id: 'f1', title: 'SQLi in checkout', severity: 'critical', status: 'confirmed', target: 'shop.example.com/checkout', cwe: 'CWE-89', engine: 'vuln-scan' },
  { id: 'f3', title: 'IDOR in invoices', severity: 'high', status: 'triaged', target: 'api.example.com/invoices/1001', cwe: 'CWE-862', engine: 'vuln-scan' },
];
const HUNT = {
  huntId: 'hunt-42', target: 'shop.example.com', status: 'open',
  closedAt: '2026-09-20T09:00:00Z', createdAt: '2026-09-01T09:00:00Z',
  owner: 'lead-1', watchers: ['lead-1', 'analyst-1'], assignees: ['meera'],
  reopenedAt: '2026-10-05T09:00:00Z', lastReopenedAt: '2026-10-05T09:00:00Z',
  reopenCount: 1,
  reopenHistory: [
    { at: '2026-10-05T09:00:00Z', reason: 'Regression detected in checkout after the deploy.', category: 'regression' },
    { at: '2026-09-28T09:00:00Z', reason: 'New threat intel matches this stack.', category: 'new-intel' },
  ],
  findings: FINDINGS,
  decisions: [{ findingId: 'f1', decision: 'confirmed', by: 'lead-1' }, { findingId: 'f3', decision: 'triaged', by: 'analyst-1' }],
  qaHistory: [{ id: 'qa-1', question: 'Which checkout finding is critical?', answer: 'The checkout SQL issue is critical.', findingId: 'f1' }],
  ticketLinks: [{ id: 'PROJ-101', system: 'jira', url: 'https://tracker.example.com/browse/PROJ-101' }],
  shareLinks: [{ id: 'share-1', url: 'https://app.infinity-ai.example/share/qa/hunt-42', permission: 'view', expiresAt: '2026-11-01T00:00:00Z' }],
  schedules: [{ id: 'sched-1', huntId: 'hunt-42', status: 'paused', cadence: 'weekly' }],
  scope: { include: ['shop.example.com', 'api.example.com'], exclude: ['admin.example.com'] },
  techStack: ['node', 'postgres'],
  chapters: [
    { number: 1, kind: 'original', openedAt: '2026-09-01T09:00:00Z', closedAt: '2026-09-20T09:00:00Z', findingCount: 2 },
    { number: 2, kind: 'reopen', openedAt: '2026-10-05T09:00:00Z', closedAt: null, findingCount: 0 },
  ],
  snapshot: { huntId: 'hunt-42', closedAt: '2026-09-20T09:00:00Z', findings: FINDINGS, decisions: [{ findingId: 'f1', decision: 'confirmed' }], findingCount: 2 },
  stats: { requests: 1240, durationMinutes: 95, engines: ['recon', 'vuln-scan'] },
  engines: ['recon', 'vuln-scan'],
};
const TEMPLATE = {
  id: 'tpl-shop-baseline', templateId: 'tpl-shop-baseline', name: 'Shop baseline',
  scope: { include: ['shop.example.com', 'api.example.com'], exclude: ['admin.example.com'] },
  engines: [{ id: 'recon', version: '2.1' }, { id: 'vuln-scan', version: '4.0' }],
  payloadProfile: { aggressiveness: 'balanced', payloadSets: ['standard'], stealth: false, rateLimitPerMinute: 60 },
  schedule: { cadence: 'weekly', window: 'business-hours', timezone: 'UTC' },
  triageRules: [{ id: 'r1', when: 'severity is critical', assign: 'lead-1' }],
  versions: [{ version: 1, at: '2026-09-01T09:00:00Z', by: 'lead-1', note: 'Initial template.' }],
  ratingCount: 4, ratingAvg: 4.5, uses: 7,
};
const TEMPLATES = [
  TEMPLATE,
  { id: 'tpl-api-sweep', name: 'API sweep', scope: { include: ['api.example.com'], exclude: [] }, engines: [{ id: 'vuln-scan', version: '4.0' }], uses: 3, rating: 4.2, tags: ['api'] },
];
const STAT_HUNTS = [
  { huntId: 'hunt-50', templateId: 'tpl-shop-baseline', findings: [{ id: 'f1' }, { id: 'f2' }] },
  { huntId: 'hunt-51', templateId: 'tpl-shop-baseline', findings: [{ id: 'f3' }] },
  { huntId: 'hunt-52', templateId: 'tpl-api-sweep', findings: [{ id: 'f4' }, { id: 'f5' }, { id: 'f6' }] },
];

/* ---- Registry coverage: 20/20 + 20/20, zero skips ---- */
test('registry: 20/20 wave 74A ideas, 20/20 wave 74B ideas, zero skips', () => {
  assert.equal(WAVE74_A_IDEAS.length, 20);
  assert.equal(WAVE74_B_IDEAS.length, 20);
  const all = [...WAVE74_A_IDEAS, ...WAVE74_B_IDEAS];
  assert.equal(all.length, 40);
  const ids = all.map(i => i.id);
  assert.deepEqual(ids, Array.from({ length: 40 }, (_, k) => 52921 + k));
  for (const idea of all) {
    assert.equal(idea.skip, false, `idea ${idea.id} skipped`);
    assert.ok(idea.title && idea.title.length > 3, `idea ${idea.id} missing title`);
  }
});

test('registry: titles match idea-bank wording', () => {
  const byId = Object.fromEntries([...WAVE74_A_IDEAS, ...WAVE74_B_IDEAS].map(i => [i.id, i.title.toLowerCase()]));
  assert.ok(byId[52921].includes('share-restoration on reopen'));
  assert.ok(byId[52922].includes('schedule-restoration on reopen'));
  assert.ok(byId[52923].includes('ticket-link preservation'));
  assert.ok(byId[52924].includes('stakeholder-view refresh'));
  assert.ok(byId[52925].includes('q&a context restoration'));
  assert.ok(byId[52926].includes('agent briefing on reopen'));
  assert.ok(byId[52927].includes('auto-suggest reopen on asset change'));
  assert.ok(byId[52928].includes('reopen reminders'));
  assert.ok(byId[52929].includes('reopen digest'));
  assert.ok(byId[52930].includes('mobile reopen'));
  assert.ok(byId[52931].includes('triage-decision preservation'));
  assert.ok(byId[52932].includes('sla reset option on reopen'));
  assert.ok(byId[52933].includes('close-reopen history export'));
  assert.ok(byId[52934].includes('compliance note on reopen'));
  assert.ok(byId[52935].includes('duplicate-reopen guard'));
  assert.ok(byId[52936].includes('reopen conflict resolution'));
  assert.ok(byId[52937].includes('platform-status reopen'));
  assert.ok(byId[52938].includes('fp-dispute reopen'));
  assert.ok(byId[52939].includes('researcher-appeal reopen'));
  assert.ok(byId[52940].includes('reopen templates'));
  assert.ok(byId[52941].includes('reopen webhooks'));
  assert.ok(byId[52942].includes('reopen keyboard shortcut'));
  assert.ok(byId[52943].includes('reopen confirmation details'));
  assert.ok(byId[52944].includes('team note on reopen'));
  assert.ok(byId[52945].includes('activity-feed reopen entry'));
  assert.ok(byId[52946].includes('reopen reason analytics'));
  assert.ok(byId[52947].includes('post-reopen health check'));
  assert.ok(byId[52948].includes('save hunt as template'));
  assert.ok(byId[52949].includes('template captures scope'));
  assert.ok(byId[52950].includes('template captures engine selection'));
  assert.ok(byId[52951].includes('template captures payload profile'));
  assert.ok(byId[52952].includes('template captures schedule'));
  assert.ok(byId[52953].includes('template captures triage rules'));
  assert.ok(byId[52954].includes('template library browser'));
  assert.ok(byId[52955].includes('team template sharing (post-hunt)'));
  assert.ok(byId[52956].includes('template versioning (post-hunt)'));
  assert.ok(byId[52957].includes('template forking (post-hunt)'));
  assert.ok(byId[52958].includes('template ratings (post-hunt)'));
  assert.ok(byId[52959].includes('template usage statistics (post-hunt)'));
  assert.ok(byId[52960].includes('template preview (post-hunt)'));
});

/* ---- Wave74 A spot checks (52921–52940) ---- */
test('52921 restoreShareLinksOnReopen: live links restored, revoked blocked', () => {
  const v = XA.restoreShareLinksOnReopen(HUNT, HUNT.shareLinks, { now: '2026-10-09T00:00:00Z' });
  assert.equal(v.restoredCount, 1);
  assert.equal(v.blockedCount, 0);
  const blocked = XA.restoreShareLinksOnReopen(HUNT, [{ id: 's9', url: 'https://app.infinity-ai.example/share/x', revoked: true }], { now: '2026-10-09T00:00:00Z' });
  assert.equal(blocked.blockedCount, 1);
  assert.equal(blocked.blocked[0].why, 'revoked');
});

test('52922 restoreSchedulesOnReopen: paused hunt schedules resume', () => {
  const v = XA.restoreSchedulesOnReopen(HUNT, HUNT.schedules, { now: '2026-10-09T00:00:00Z' });
  assert.equal(v.resumedCount, 1);
  assert.equal(v.resumed[0].status, 'active');
  assert.equal(v.resumed[0].cadence, 'weekly');
});

test('52923 preserveTicketLinks: tracker links intact with reopen note', () => {
  const v = XA.preserveTicketLinks(HUNT, HUNT.ticketLinks, { reason: 'Regression detected in checkout.' });
  assert.equal(v.preservedCount, 1);
  assert.equal(v.intact, true);
  assert.equal(v.links[0].system, 'jira');
  assert.ok(v.links[0].note.includes('Infinity AI'));
});

test('52924 refreshStakeholderViews: views recomputed for reopened hunt', () => {
  const v = XA.refreshStakeholderViews(HUNT, [{ id: 'exec', audience: 'leadership' }, { id: 'eng', audience: 'engineering' }], { now: '2026-10-09T00:00:00Z' });
  assert.equal(v.viewCount, 2);
  assert.equal(v.views[0].findingCount, 2);
  assert.equal(v.views[0].huntState, 'open');
});

test('52925 restoreQaContext: prior threads reload with finding links', () => {
  const v = XA.restoreQaContext(HUNT, HUNT.qaHistory, {});
  assert.equal(v.entryCount, 1);
  assert.deepEqual(v.findingIds, ['f1']);
  assert.equal(v.restored, true);
});

test('52926 briefOnReopen: change summary with away time', () => {
  const changed = { ...HUNT, findings: [...FINDINGS, { id: 'f9', title: 'New header issue', severity: 'low' }] };
  const v = XA.briefOnReopen(changed, HUNT.snapshot, { now: '2026-10-09T00:00:00Z' });
  assert.equal(v.addedCount, 1);
  assert.equal(v.removedCount, 0);
  assert.equal(v.awayDays, 19);
  assert.ok(v.bullets[0].includes('1 finding'));
});

test('52927 suggestReopenOnAssetChange: stack growth suggests reopen', () => {
  const v = XA.suggestReopenOnAssetChange({ beforeStack: ['node', 'postgres'], afterStack: ['node', 'postgres', 'stripe'] }, { ...HUNT, status: 'closed' }, {});
  assert.equal(v.suggest, true);
  assert.equal(v.score, 5);
  assert.deepEqual(v.addedStack, ['stripe']);
});

test('52928 buildReopenReminders: due deferred reopens remind owners', () => {
  const v = XA.buildReopenReminders([{ huntId: 'hunt-42', owner: 'lead-1', target: 'shop.example.com', reopenAfter: '2026-10-01T09:00:00Z' }], { now: '2026-10-09T00:00:00Z' });
  assert.equal(v.count, 1);
  assert.equal(v.reminders[0].owner, 'lead-1');
  const future = XA.buildReopenReminders([{ huntId: 'hunt-42', owner: 'lead-1', reopenAfter: '2027-01-01T09:00:00Z' }], { now: '2026-10-09T00:00:00Z' });
  assert.equal(future.count, 0);
});

test('52929 buildReopenDigest: recent reopens listed for leadership', () => {
  const v = XA.buildReopenDigest([HUNT], { now: '2026-10-09T00:00:00Z' });
  assert.equal(v.count, 1);
  assert.equal(v.entries[0].huntId, 'hunt-42');
  assert.equal(v.entries[0].ageDays, 3);
});

test('52930 planMobileReopen: small-screen flow steps computed', () => {
  const v = XA.planMobileReopen(HUNT, { reason: 'Regression detected in checkout after the deploy.', role: 'analyst' }, { now: '2026-10-09T00:00:00Z' });
  assert.equal(v.channel, 'mobile');
  assert.equal(v.ready, true);
  assert.equal(v.steps.length, 3);
  assert.equal(v.needsApproval, false);
});

test('52931 preserveTriageDecisions: prior decisions survive untouched', () => {
  const v = XA.preserveTriageDecisions(HUNT, HUNT.decisions, {});
  assert.equal(v.decisionCount, 2);
  assert.equal(v.untouched, true);
  assert.equal(HUNT.decisions.length, 2);
});

test('52932 planSlaOnReopen: reset restarts clocks, continue keeps them', () => {
  const reset = XA.planSlaOnReopen(HUNT, { mode: 'reset', triageHours: 24, fixHours: 120 }, { now: '2026-10-09T00:00:00Z' });
  assert.equal(reset.mode, 'reset');
  assert.equal(reset.triageDue.slice(0, 10), '2026-10-10');
  const keep = XA.planSlaOnReopen(HUNT, { mode: 'continue' }, { now: '2026-10-09T00:00:00Z' });
  assert.equal(keep.mode, 'continue');
});

test('52933 exportCloseReopenHistory: ordered audit timeline exported', () => {
  const v = XA.exportCloseReopenHistory(HUNT, { format: 'markdown' });
  assert.equal(v.eventCount, 5);
  assert.equal(v.filename, 'hunt-42-history.md');
  assert.ok(v.content.includes('Infinity AI'));
});

test('52934 buildComplianceNoteOnReopen: due-diligence record written', () => {
  const v = XA.buildComplianceNoteOnReopen(HUNT, { actor: 'lead-1', reason: 'Continued due diligence after new intel.', at: '2026-10-09T00:00:00Z' }, { now: '2026-10-09T00:00:00Z' });
  assert.equal(v.complianceReady, true);
  assert.equal(v.reopenedBy, 'lead-1');
  assert.equal(v.controls.length, 3);
});

test('52935 checkDuplicateReopen: open hunt with pending request blocked', () => {
  const v = XA.checkDuplicateReopen({ ...HUNT, status: 'open' }, [{ huntId: 'hunt-42', requestedBy: 'analyst-1' }], {});
  assert.equal(v.duplicate, true);
  assert.equal(v.pendingCount, 1);
  const clear = XA.checkDuplicateReopen({ ...HUNT, status: 'closed' }, [], {});
  assert.equal(clear.duplicate, false);
});

test('52936 resolveReopenConflicts: simultaneous requests merged', () => {
  const v = XA.resolveReopenConflicts([
    { huntId: 'hunt-42', requestedBy: 'lead-1', reason: 'Regression detected in checkout.', at: '2026-10-08T09:00:00Z' },
    { huntId: 'hunt-42', requestedBy: 'analyst-1', reason: 'New intel matches this stack and needs review.', at: '2026-10-08T09:05:00Z' },
  ], {});
  assert.equal(v.merged.length, 1);
  assert.equal(v.conflictCount, 1);
  assert.equal(v.merged[0].requesters.length, 2);
  assert.equal(v.totalRequests, 2);
});

test('52937 handlePlatformStatusReopen: platform reopen triggers flow', () => {
  const v = XA.handlePlatformStatusReopen({ platform: 'bounty-platform', reportId: 'rep-9', status: 'reopened' }, HUNT, {});
  assert.equal(v.triggersReopen, true);
  assert.equal(v.action, 'start-reopen-flow');
  const idle = XA.handlePlatformStatusReopen({ platform: 'bounty-platform', reportId: 'rep-9', status: 'accepted' }, HUNT, {});
  assert.equal(idle.triggersReopen, false);
});

test('52938 reopenFindingOnFpDispute: won dispute reopens the finding', () => {
  const v = XA.reopenFindingOnFpDispute({ findingId: 'f3', outcome: 'upheld', evidence: 'Live request replay confirmed the issue.' }, HUNT, {});
  assert.equal(v.successful, true);
  assert.equal(v.findingStatus, 'reopened');
  const lost = XA.reopenFindingOnFpDispute({ findingId: 'f3', outcome: 'rejected' }, HUNT, {});
  assert.equal(lost.action, 'keep-decision');
});

test('52939 routeResearcherAppeal: complete appeal reaches review', () => {
  const v = XA.routeResearcherAppeal({ id: 'appeal-1', researcher: 'external-researcher', grounds: 'Finding is exploitable with a chained request.', evidence: 'video proof attached' }, HUNT, {});
  assert.equal(v.complete, true);
  assert.equal(v.queue, 'reopen-review');
  const weak = XA.routeResearcherAppeal({ id: 'appeal-2', researcher: 'external-researcher', grounds: 'please' }, HUNT, {});
  assert.equal(weak.queue, 'needs-more-info');
});

test('52940 listReopenTemplates: catalog listed and one applied', () => {
  const v = XA.listReopenTemplates({ templateId: 'regression-quick', context: { baseScope: ['shop.example.com'] } });
  assert.equal(v.count, 3);
  assert.equal(v.applied.label, 'Regression quick reopen');
  assert.deepEqual(v.applied.scope, ['shop.example.com']);
});

/* ---- Wave74 B spot checks (52941–52960) ---- */
test('52941 buildReopenWebhookPayload: signed-shape event envelope', () => {
  const v = XB.buildReopenWebhookPayload(HUNT, { actor: 'lead-1', reason: 'Regression detected in checkout.' }, { now: '2026-10-09T00:00:00Z', endpoints: ['https://hooks.example.com/hunts'] });
  assert.equal(v.payload.event, 'hunt.reopened');
  assert.equal(v.deliveryCount, 1);
  assert.equal(v.valid, true);
});

test('52942 describeReopenShortcut: chord opens dialog only when closed', () => {
  const v = XB.describeReopenShortcut({ keys: 'ctrl+shift+r', huntState: 'closed', inInput: false }, {});
  assert.equal(v.triggers, true);
  assert.equal(v.action, 'open-reason-dialog');
  const open = XB.describeReopenShortcut({ keys: 'ctrl+shift+r', huntState: 'open', inInput: false }, {});
  assert.equal(open.triggers, false);
});

test('52943 buildReopenConfirmation: restore counts shown before commit', () => {
  const v = XB.buildReopenConfirmation(HUNT, {});
  assert.equal(v.willRestore[0].count, 2);
  assert.equal(v.willRestore[1].count, 1);
  assert.equal(v.totalItems, 5);
  assert.equal(v.requiresReason, true);
});

test('52944 buildTeamNoteOnReopen: note broadcast to deduplicated team', () => {
  const v = XB.buildTeamNoteOnReopen(HUNT, { author: 'lead-1', text: 'Reopening to verify the checkout fix with fresh proof.' }, {});
  assert.equal(v.valid, true);
  assert.equal(v.recipientCount, 3);
  assert.equal(v.author, 'lead-1');
});

test('52945 buildActivityFeedReopenEntry: prominent feed event built', () => {
  const v = XB.buildActivityFeedReopenEntry(HUNT, { actor: 'lead-1', reason: 'Regression detected in checkout.' }, { now: '2026-10-09T00:00:00Z' });
  assert.equal(v.entry.kind, 'hunt-reopened');
  assert.equal(v.entry.prominence, 'high');
  assert.equal(v.entry.link, '/hunts/hunt-42');
});

test('52946 analyzeReopenReasons: recurring reasons ranked', () => {
  const v = XB.analyzeReopenReasons([HUNT], {});
  assert.equal(v.totalReopens, 2);
  assert.equal(v.ranked.length, 2);
  assert.equal(v.topReason.category, 'new-intel');
});

test('52947 runPostReopenHealthCheck: integrity verified after reopen', () => {
  const openHunt = { ...HUNT, status: 'open', findings: HUNT.snapshot.findings, decisions: HUNT.snapshot.decisions };
  const v = XB.runPostReopenHealthCheck(openHunt, HUNT.snapshot, {});
  assert.equal(v.healthy, true);
  assert.equal(v.issueCount, 0);
  assert.equal(v.checks.length, 4);
});

test('52948 saveHuntAsTemplate: hunt configuration captured in one click', () => {
  const v = XB.saveHuntAsTemplate(HUNT, { name: 'Shop baseline', createdBy: 'lead-1' });
  assert.equal(v.templateId, 'tpl-hunt-42');
  assert.equal(v.template.sourceHuntId, 'hunt-42');
  assert.equal(v.template.scope.include.length, 2);
});

test('52949 captureTemplateScope: scope patterns stored for the template', () => {
  const v = XB.captureTemplateScope(TEMPLATE, {});
  assert.equal(v.includeCount, 2);
  assert.equal(v.excludeCount, 1);
  assert.deepEqual(v.include, ['shop.example.com', 'api.example.com']);
});

test('52950 captureTemplateEngines: engine ids and versions frozen', () => {
  const v = XB.captureTemplateEngines(TEMPLATE, {});
  assert.equal(v.engineCount, 2);
  assert.equal(v.engines[0].id, 'recon');
  assert.equal(v.engines[0].version, '2.1');
});

test('52951 captureTemplatePayloadProfile: tuned profile inherited', () => {
  const v = XB.captureTemplatePayloadProfile(TEMPLATE, {});
  assert.equal(v.profile.aggressiveness, 'balanced');
  assert.deepEqual(v.profile.payloadSets, ['standard']);
  assert.equal(v.profile.rateLimitPerMinute, 60);
});

test('52952 captureTemplateSchedule: cadence and window stored', () => {
  const v = XB.captureTemplateSchedule(TEMPLATE, {});
  assert.equal(v.schedule.cadence, 'weekly');
  assert.equal(v.schedule.window, 'business-hours');
});

test('52953 captureTemplateTriageRules: routing rules bundled', () => {
  const v = XB.captureTemplateTriageRules(TEMPLATE, {});
  assert.equal(v.ruleCount, 1);
  assert.equal(v.rules[0].id, 'r1');
});

test('52954 browseTemplateLibrary: searchable gallery with stats', () => {
  const v = XB.browseTemplateLibrary(TEMPLATES, 'shop', {});
  assert.equal(v.count, 1);
  assert.equal(v.templates[0].id, 'tpl-shop-baseline');
  const all = XB.browseTemplateLibrary(TEMPLATES, '', {});
  assert.equal(all.count, 2);
});

test('52955 shareTemplateWithTeam: template published to the workspace', () => {
  const v = XB.shareTemplateWithTeam(TEMPLATE, { description: 'Proven checkout baseline for the shop target.', owner: 'lead-1', visibility: 'workspace' }, { now: '2026-10-09T00:00:00Z' });
  assert.equal(v.shared, true);
  assert.equal(v.owner, 'lead-1');
  assert.equal(v.templateId, 'tpl-shop-baseline');
});

test('52956 versionTemplate: every edit creates an immutable version', () => {
  const v = XB.versionTemplate(TEMPLATE, { by: 'lead-1', note: 'Tightened payload rate after review.' }, { now: '2026-10-09T00:00:00Z' });
  assert.equal(v.currentVersion, 2);
  assert.equal(v.versionCount, 2);
  assert.equal(TEMPLATE.versions.length, 1);
});

test('52957 forkTemplate: clone customized, original untouched', () => {
  const v = XB.forkTemplate(TEMPLATE, { name: 'Shop baseline EU', owner: 'analyst-1' }, {});
  assert.equal(v.forkId, 'tpl-shop-baseline-fork');
  assert.equal(v.originalId, 'tpl-shop-baseline');
  assert.equal(v.template.name, 'Shop baseline EU');
});

test('52958 rateTemplate: stars roll into a sampled average', () => {
  const v = XB.rateTemplate(TEMPLATE, { stars: 5 }, {});
  assert.equal(v.recorded, true);
  assert.equal(v.ratingCount, 5);
  assert.equal(v.average, 4.6);
});

test('52959 computeTemplateUsageStats: yield computed per template', () => {
  const v = XB.computeTemplateUsageStats(TEMPLATES, STAT_HUNTS, {});
  assert.equal(v.templateCount, 2);
  assert.equal(v.topTemplate.templateId, 'tpl-shop-baseline');
  assert.equal(v.topTemplate.uses, 2);
  assert.equal(v.topTemplate.averageYield, 1.5);
});

test('52960 previewTemplate: full configuration inspected before launch', () => {
  const v = XB.previewTemplate(TEMPLATE, {});
  assert.equal(v.scopeInclude.length, 2);
  assert.equal(v.engines.length, 2);
  assert.equal(v.triageRuleCount, 1);
  assert.equal(v.complete, true);
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
test('css: only .w74a-/.w74b- scoped selectors, no globals', () => {
  const noComments = CSS_SRC.replace(/\/\*[\s\S]*?\*\//g, '');
  const classSelectors = [...noComments.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map(m => m[1]);
  assert.ok(classSelectors.length > 10, 'expected many scoped selectors');
  for (const cls of classSelectors) {
    assert.ok(cls.startsWith('w74a-') || cls.startsWith('w74b-'), `unscoped selector: .${cls}`);
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
  for (const f of ['Wave74A.jsx', 'Wave74B.jsx']) {
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
    assert.ok(!src.includes('Dark' + 'Matter'), `forbidden brand leaked in ${name}`);
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
