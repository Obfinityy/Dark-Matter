/**
 * wave68.test.js — Infinity AI · Dark-Matter · Wave 68
 * node:test + node:assert/strict. Registry coverage (20/20 for 52681–52700,
 * 20/20 for 52701–52720, zero skips, 40/40 combined), registry titles matched
 * against the idea bank, deterministic spot-checks of every pure function
 * (at least one assertion per idea), a JSX↔core call-shape audit (every
 * exported component calls ≥1 exported core function), Wave68.css
 * scope/zero-animation audits, a real esbuild JSX parse audit, a
 * no-branding-leak audit ("Infinity AI" only) and a no-debris audit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WAVE68_A_IDEAS } from './wave68ACore.js';
import * as EA from './wave68ACore.js';
import { WAVE68_B_IDEAS } from './wave68BCores.js';
import * as EB from './wave68BCores.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const CSS = join(DIR, 'Wave68.css');
const A_SRC = readFileSync(join(DIR, 'wave68ACore.js'), 'utf8');
const B_SRC = readFileSync(join(DIR, 'wave68BCores.js'), 'utf8');
const A_JSX = readFileSync(join(DIR, 'Wave68A.jsx'), 'utf8');
const B_JSX = readFileSync(join(DIR, 'Wave68B.jsx'), 'utf8');
const CSS_SRC = readFileSync(CSS, 'utf8');
const BRAND_SRC = [['A core', A_SRC], ['B core', B_SRC], ['A jsx', A_JSX], ['B jsx', B_JSX], ['css', CSS_SRC]];

/* ---- Registry coverage: 20/20 + 20/20, zero skips ---- */
test('registry: 20/20 stakeholder-view ideas, 20/20 lifecycle ideas, zero skips', () => {
  assert.equal(WAVE68_A_IDEAS.length, 20);
  assert.equal(WAVE68_B_IDEAS.length, 20);
  const all = [...WAVE68_A_IDEAS, ...WAVE68_B_IDEAS];
  assert.equal(all.length, 40);
  const ids = all.map(i => i.id);
  assert.deepEqual(ids, Array.from({ length: 40 }, (_, k) => 52681 + k));
  for (const idea of all) {
    assert.equal(idea.skip, false, `idea ${idea.id} skipped`);
    assert.ok(idea.title && idea.title.length > 3, `idea ${idea.id} missing title`);
  }
});

test('registry: titles match idea-bank wording', () => {
  const byId = Object.fromEntries([...WAVE68_A_IDEAS, ...WAVE68_B_IDEAS].map(i => [i.id, i.title.toLowerCase()]));
  assert.ok(byId[52681].includes('vendor-risk'));
  assert.ok(byId[52682].includes('m&a'));
  assert.ok(byId[52682].includes('diligence'));
  assert.ok(byId[52683].includes('cyber-insurance'));
  assert.ok(byId[52687].includes('soc triage'));
  assert.ok(byId[52694].includes('privacy'));
  assert.ok(byId[52694].includes('dpo'));
  assert.ok(byId[52699].includes('permissions'));
  assert.ok(byId[52700].includes('audit log'));
  assert.ok(byId[52701].includes('custom stakeholder roles'));
  assert.ok(byId[52706].includes('presentation'));
  assert.ok(byId[52713].includes('state machine'));
  assert.ok(byId[52714].includes('triaged'));
  assert.ok(byId[52717].includes('guardrails'));
  assert.ok(byId[52719].includes('immutable'));
  assert.ok(byId[52720].includes('alerts'));
});

/* ---- Wave68 A spot checks (52681–52700) ---- */
const AF = [
  { id: 'f1', title: 'SQLi in checkout', severity: 'critical', status: 'open', target: 'shop.example.com', vendor: 'PaymentsCo', asset: 'checkout service', component: 'checkout-api', endpoint: '/api/checkout', platform: 'web', category: 'injection', dataTypes: ['payment'], classification: 'regulated', detected: true, riskScore: 9.1, exploitability: 0.9, owner: 'aarav', evidence: ['db version leak'], cwe: 'CWE-89', failedControls: ['WAF', 'MFA'] },
  { id: 'f2', title: 'XSS in search', severity: 'high', status: 'triaging', target: 'shop.example.com', vendor: 'Internal', asset: 'search service', component: 'search-api', endpoint: '/api/search', platform: 'web', category: 'xss', dataTypes: ['pii'], classification: 'regulated', detected: false, riskScore: 7.4, exploitability: 0.7, owner: 'meera', evidence: [], cwe: 'CWE-79', failedControls: ['WAF'] },
  { id: 'f3', title: 'Weak TLS on mobile API', severity: 'medium', status: 'new', target: 'api.example.com', asset: 'mobile backend', component: 'mobile-api', endpoint: '/api/mobile/login', platform: 'android', category: 'crypto tls', dataTypes: [], classification: 'internal', detected: false, riskScore: 4.2, exploitability: 0.4, owner: 'platform', evidence: ['legacy cipher'] },
  { id: 'f4', title: 'Verbose errors in iOS client', severity: 'low', status: 'fixed', target: 'ios.example.com', asset: 'iOS app', component: 'ios-client', endpoint: '/api/profile', platform: 'ios', category: 'mobile storage', dataTypes: ['pii'], classification: 'regulated', detected: true, riskScore: 2.1, exploitability: 0.2, owner: 'mobile-team', evidence: ['stack trace'] },
  { id: 'f5', title: 'Info disclosure on login', severity: 'medium', status: 'open', target: 'shop.example.com', asset: 'auth service', component: 'auth-api', category: 'disclosure', dataTypes: [], classification: 'internal', detected: false, riskScore: 3.5, exploitability: 0.5, owner: 'meera', evidence: ['version banner'] },
  { id: 'f6', title: 'Weak password policy', severity: 'medium', status: 'open', target: 'shop.example.com', asset: 'auth service', component: 'auth-api', category: 'auth', dataTypes: ['credential'], classification: 'regulated', detected: false, riskScore: 4.0, exploitability: 0.6, owner: 'meera', evidence: [] },
];

test('52681 buildVendorRiskView: vendor rollup sorted by risk', () => {
  const v = EA.buildVendorRiskView(AF.slice(0, 3), [{ name: 'PaymentsCo', criticality: 'high' }]);
  assert.equal(v.totalVendors, 2);
  assert.equal(v.highestRiskVendor, 'PaymentsCo');
  assert.equal(v.vendors[0].criticals, 1);
  assert.equal(v.openTotal, 3);
});

test('52682 buildMaDiligenceView: assets + conditional recommendation', () => {
  const v = EA.buildMaDiligenceView([
    { id: 'h1', target: 'a.example.com', findings: [AF[0]] },
    { id: 'h2', target: 'b.example.com', findings: [AF[1]] },
  ]);
  assert.equal(v.assetCount, 2);
  assert.deepEqual(v.openCriticals, ['f1']);
  assert.equal(v.recommendation, 'proceed-with-conditions');
  assert.ok(v.dataRoomItems.length >= 3);
});

test('52683 buildCyberInsuranceView: score, tier, gaps, exclusions', () => {
  const v = EA.buildCyberInsuranceView([AF[0], AF[1]], { requestedLimitUsd: 1000000 });
  assert.equal(v.insurabilityScore, 74);
  assert.equal(v.tier, 'standard');
  assert.ok(v.controlGaps.includes('MFA'));
  assert.ok(v.exclusions.some(e => e.includes('critical')));
});

test('52684 buildPentestEquivalenceView: coverage + verdict', () => {
  const v = EA.buildPentestEquivalenceView([AF[0], AF[1]], { categories: ['injection', 'xss', 'crypto', 'api'] });
  assert.equal(v.coveragePct, 50);
  assert.equal(v.verdict, 'insufficient-coverage');
  assert.ok(v.gaps.includes('crypto'));
  const full = EA.buildPentestEquivalenceView([AF[0]], { categories: ['injection'] });
  assert.equal(full.coveragePct, 100);
  assert.equal(full.verdict, 'equivalent');
});

test('52685 buildRedTeamNarrative: phased chained steps', () => {
  const v = EA.buildRedTeamNarrative([AF[0], AF[4]]);
  assert.equal(v.steps.length, 2);
  assert.equal(v.steps[0].phase, 'access');
  assert.ok(v.killChainCoverage.includes('access'));
  assert.ok(v.summary.includes('Infinity AI'));
});

test('52686 buildBlueTeamDetectionView: coverage + gaps', () => {
  const v = EA.buildBlueTeamDetectionView([AF[0], AF[1]]);
  assert.equal(v.coveragePct, 50);
  assert.deepEqual(v.gaps, ['f2']);
  assert.ok(v.detections[0].expectedSignal.length > 5);
});

test('52687 buildSocTriageView: P1 first, fixed excluded', () => {
  const v = EA.buildSocTriageView(AF);
  assert.equal(v.queue[0].id, 'f1');
  assert.equal(v.queue[0].priority, 'P1');
  assert.equal(v.queue[0].slaMinutes, 15);
  assert.ok(!v.queue.some(q => q.id === 'f4'));
});

test('52688 buildIrHandoffView: assets, containment, evidence', () => {
  const v = EA.buildIrHandoffView(AF, { id: 'INC-7', title: 'Checkout incident' });
  assert.equal(v.incidentId, 'INC-7');
  assert.ok(v.affectedAssets.includes('shop.example.com'));
  assert.ok(v.containment.length > 0);
  assert.ok(v.evidence.length >= 2);
  assert.ok(v.handoffNote.includes('Infinity AI'));
});

test('52689 linkThreatModel: asset linkage + coverage', () => {
  const plain = AF.slice(0, 2).map(f => ({ ...f }));
  delete plain[0].threatId;
  delete plain[1].threatId;
  const v = EA.linkThreatModel(plain, [
    { id: 'T1', threat: 'Injection', assets: ['checkout service'] },
    { id: 'T2', threat: 'Scripting', assets: ['search service'] },
    { id: 'T9', threat: 'Unmodeled', assets: ['archive'] },
  ]);
  assert.equal(v.coveragePct, 67);
  assert.deepEqual(v.unlinkedFindings, []);
  assert.equal(v.linked[0].findingIds[0], 'f1');
});

test('52690 buildArchitectureReviewView: per-component risk', () => {
  const v = EA.buildArchitectureReviewView(AF.slice(0, 2), [{ name: 'checkout-api', boundary: 'public-edge' }]);
  assert.equal(v.components[0].name, 'checkout-api');
  assert.equal(v.components[0].boundary, 'public-edge');
  assert.equal(v.components[0].criticals, 1);
});

test('52691 buildApiOwnerView: API findings only', () => {
  const v = EA.buildApiOwnerView(AF);
  assert.ok(!v.findings.includes('f6'));
  assert.ok(v.findings.includes('f1'));
  assert.ok(v.endpoints.some(e => e.endpoint === '/api/checkout'));
  const owned = EA.buildApiOwnerView(AF, 'aarav');
  assert.deepEqual(owned.findings, ['f1']);
});

test('52692 buildMobileTeamView: platform split', () => {
  const v = EA.buildMobileTeamView(AF);
  assert.equal(v.platforms.android.open, 1);
  assert.equal(v.platforms.ios.open, 0);
  assert.ok(v.storeRisks.includes('f4'));
  assert.equal(v.mobileTotal, 2);
});

test('52693 buildDataTeamView: classification + type rollup', () => {
  const v = EA.buildDataTeamView(AF);
  const payment = v.byDataType.find(d => d.dataType === 'payment');
  assert.equal(payment.open, 1);
  assert.ok(v.exposure.includes('payment') || v.exposure.includes('pii'));
  assert.ok(v.byClassification.some(c => c.classification === 'regulated'));
});

test('52694 buildPrivacyView: regulation mapping, redacted', () => {
  const v = EA.buildPrivacyView(AF);
  assert.equal(v.redacted, true);
  assert.equal(v.piiExposure, 4);
  assert.ok(v.regulations.find(r => r.name === 'PCI DSS').findings.includes('f1'));
  assert.ok(v.dpoTasks.some(t => t.findingId === 'f1'));
});

test('52695 addStakeholderAnnotation: append without mutation', () => {
  const before = [];
  const r = EA.addStakeholderAnnotation(before, { viewId: 'vendor-risk', findingId: 'f1', author: 'lead', text: 'Escalate.' });
  assert.equal(before.length, 0);
  assert.equal(r.total, 1);
  assert.ok(r.annotation.id.startsWith('ann_'));
  assert.equal(r.annotation.text, 'Escalate.');
});

test('52696 addStakeholderComment: threaded append', () => {
  const a = EA.addStakeholderComment([], { viewId: 'soc-triage', findingId: 'f1', author: 'analyst', text: 'Taking this.' });
  const b = EA.addStakeholderComment(a.comments, { viewId: 'soc-triage', findingId: 'f1', author: 'lead', text: 'Bridge open.', parentId: a.comment.id });
  assert.equal(b.comments.length, 2);
  assert.equal(b.comments[1].parentId, a.comment.id);
  assert.equal(a.comments.length, 1);
});

test('52697 buildStakeholderExport: redaction + serialization', () => {
  const csv = EA.buildStakeholderExport({ id: 'client-summary', name: 'Client summary', redacted: true }, [AF[0]], 'csv');
  assert.equal(csv.format, 'csv');
  assert.equal(csv.rows, 1);
  assert.equal(csv.redacted, true);
  assert.ok(csv.filename.endsWith('.csv'));
  assert.ok(csv.content.includes('f1'));
  assert.ok(!csv.content.includes('CWE-89'));
  const json = EA.buildStakeholderExport({ id: 'eng', name: 'Engineer' }, [AF[0]], 'json');
  assert.ok(json.content.includes('CWE-89'));
  assert.ok(json.checksum.length > 0);
});

test('52698 buildStakeholderEmail: counts, no payloads', () => {
  const r = EA.buildStakeholderEmail({ id: 'vendor-risk', name: 'Vendor risk' }, [AF[0], AF[1]], 'vendor@example.com');
  assert.equal(r.to, 'vendor@example.com');
  assert.ok(r.subject.includes('Infinity AI'));
  assert.ok(r.subject.includes('2 open'));
  assert.ok(r.body.includes('payloads by design'));
  assert.deepEqual(r.findingIds, ['f1', 'f2']);
});

test('52699 checkViewPermission: owner, admin, allow list, denial', () => {
  const view = { id: 'compliance', owner: 'u9', allowedRoles: ['auditor'] };
  assert.equal(EA.checkViewPermission({ id: 'u9', role: 'viewer' }, view, 'admin').allowed, true);
  assert.equal(EA.checkViewPermission({ id: 'u1', role: 'auditor' }, view, 'view').allowed, true);
  assert.equal(EA.checkViewPermission({ id: 'u1', role: 'auditor' }, view, 'admin').allowed, false);
  const denied = EA.checkViewPermission({ id: 'u2', role: 'marketing' }, view, 'export');
  assert.equal(denied.allowed, false);
  assert.ok(denied.reason.includes('marketing'));
  assert.equal(EA.checkViewPermission({ id: 'u3', role: 'admin' }, view, 'export').allowed, true);
});

test('52700 buildViewAuditLog: sorted rollup + denials', () => {
  const r = EA.buildViewAuditLog([
    { user: 'b@x.com', viewId: 'vendor-risk', action: 'export', at: '2026-10-08T09:05:00Z', allowed: false },
    { user: 'a@x.com', viewId: 'vendor-risk', action: 'view', at: '2026-10-08T09:00:00Z', allowed: true },
  ]);
  assert.equal(r.total, 2);
  assert.equal(r.deniedCount, 1);
  assert.equal(r.entries[0].user, 'a@x.com');
  assert.equal(r.byView['vendor-risk'], 2);
});

/* ---- Wave68 B spot checks (52701–52720) ---- */
test('52701 createCustomRole: known permissions only', () => {
  const r = EB.createCustomRole({ name: 'Vendor reviewer', permissions: ['view', 'export', 'fly'], defaultView: 'vendor-risk' });
  assert.deepEqual(r.permissions, ['view', 'export']);
  assert.deepEqual(r.rejected, ['fly']);
  assert.equal(r.valid, false);
  const ok = EB.createCustomRole({ name: 'Reviewer', permissions: ['view'] });
  assert.equal(ok.valid, true);
  assert.ok(ok.id.startsWith('role_'));
});

test('52702 buildOnboardingTour: role-adapted steps', () => {
  const t = EB.buildOnboardingTour('executive', 'exec-dashboard');
  assert.equal(t.role, 'executive');
  assert.ok(t.stepCount >= 3);
  assert.ok(t.steps.some(s => s.title.includes('Risk')));
  const eng = EB.buildOnboardingTour('engineer', 'engineer-detail');
  assert.ok(eng.steps.some(s => s.title.includes('Reproduce')));
});

test('52703 buildViewFaq: per-view answers with live counts', () => {
  const f = EB.buildViewFaq('compliance', AF);
  assert.equal(f.view, 'compliance');
  assert.equal(f.count, 2);
  const exec = EB.buildViewFaq('exec-dashboard', [AF[0]]);
  assert.ok(exec.faqs[1].a.includes('1 finding'));
});

test('52704 computeViewAnalytics: per-view + per-user rollup', () => {
  const a = EB.computeViewAnalytics([
    { view: 'vendor-risk', user: 'lead', action: 'view' },
    { view: 'vendor-risk', user: 'auditor', action: 'export' },
    { view: 'soc-triage', user: 'lead', action: 'view' },
  ]);
  assert.equal(a.totalViews, 2);
  assert.equal(a.topView, 'vendor-risk');
  assert.equal(a.byView['vendor-risk'].uniqueUsers, 2);
  assert.equal(a.byView['vendor-risk'].exports, 1);
  assert.equal(a.byUser.lead, 2);
});

test('52705 buildMeetingMode: shared agenda + duration', () => {
  const m = EB.buildMeetingMode(
    [{ name: 'Lead', view: 'exec-dashboard' }, { name: 'Engineer', view: 'engineer-detail' }],
    ['exec-dashboard', 'engineer-detail']
  );
  assert.equal(m.participantCount, 2);
  assert.equal(m.durationMinutes, 20);
  assert.equal(m.agenda[0].owners[0], 'Lead');
});

test('52706 buildPresentationDeck: opener + closing slides', () => {
  const d = EB.buildPresentationDeck(['exec-dashboard'], [AF[0], AF[3]]);
  assert.equal(d.slideCount, 3);
  assert.equal(d.slides[0].title, 'Security posture');
  assert.ok(d.slides[0].bullets[0].includes('1 open'));
  assert.equal(d.slides[d.slides.length - 1].view, 'closing');
});

test('52707 buildSpeakerNotes: script + time estimate', () => {
  const n = EB.buildSpeakerNotes('exec-dashboard', [AF[0], AF[1]]);
  assert.equal(n.notes.length, 3);
  assert.ok(n.notes[0].includes('2 open'));
  assert.ok(n.durationEstimateMinutes >= 2);
});

test('52708 buildPrintView: paginated print sections', () => {
  const p = EB.buildPrintView({ id: 'exec', name: 'Executive dashboard' }, [AF[0], AF[1]]);
  assert.equal(p.findingCount, 2);
  assert.equal(p.pageEstimate, 1);
  assert.ok(p.sections[1].body.includes('Infinity AI'));
  assert.equal(p.printClass, 'print-view');
});

test('52709 buildViewApiResponse: filter, sort, paginate', () => {
  const r = EB.buildViewApiResponse({ id: 'soc-triage' }, AF, { severity: 'critical', page: 1, pageSize: 10 });
  assert.equal(r.total, 1);
  assert.equal(r.items[0].id, 'f1');
  const page2 = EB.buildViewApiResponse({ id: 'v' }, AF, { page: 2, pageSize: 2 });
  assert.equal(page2.items.length, 2);
  assert.equal(page2.page, 2);
  const sorted = EB.buildViewApiResponse({ id: 'v' }, [AF[1], AF[0]], { sort: 'severity' });
  assert.equal(sorted.items[0].id, 'f1');
});

test('52710 applyViewWatermark: attributed traceable stamp', () => {
  const w = EB.applyViewWatermark({ title: 'Vendor risk', content: 'rows' }, { id: 'u1', name: 'Lead Reviewer' }, { id: 'vendor-risk', name: 'Vendor risk' });
  assert.ok(w.watermark.includes('Lead Reviewer'));
  assert.ok(w.watermark.includes('Infinity AI'));
  assert.ok(w.traceId.startsWith('wm_'));
  assert.equal(w.content, 'rows');
});

test('52711 scheduleViewDelivery: next run + validation', () => {
  const s = EB.scheduleViewDelivery({ id: 'vendor-risk' }, { frequency: 'weekly', recipients: ['lead@example.com'], at: '2026-10-08T00:00:00Z' });
  assert.equal(s.valid, true);
  assert.equal(s.nextRun, '2026-10-15T00:00:00.000Z');
  const bad = EB.scheduleViewDelivery({ id: 'v' }, { frequency: 'hourly', recipients: [] });
  assert.equal(bad.valid, false);
  assert.equal(bad.nextRun, null);
  assert.ok(bad.errors.length >= 2);
});

test('52712 summarizeViewFeedback: averages + low-rated flags', () => {
  const f = EB.summarizeViewFeedback([
    { view: 'vendor-risk', rating: 5, user: 'lead', comment: 'Clear.' },
    { view: 'vendor-risk', rating: 4, user: 'auditor' },
    { view: 'soc-triage', rating: 2, user: 'analyst', comment: 'Dense.' },
  ]);
  assert.equal(f.byView['vendor-risk'].avg, 4.5);
  assert.equal(f.overallAvg, 3.7);
  assert.equal(f.total, 3);
  assert.deepEqual(f.lowRated, ['soc-triage']);
});

test('52713 createLifecycleMachine: defaults + custom validation', () => {
  const m = EB.createLifecycleMachine();
  assert.equal(m.valid, true);
  assert.deepEqual(m.terminalStates, ['closed', 'dismissed']);
  assert.ok(m.states.includes('verifying'));
  assert.deepEqual(m.transitions.new, ['triaged', 'dismissed']);
  const bad = EB.createLifecycleMachine({ states: ['open'], transitions: { open: ['gone'] } });
  assert.equal(bad.valid, false);
  assert.ok(bad.errors.some(e => e.includes('gone')));
});

test('52714 transitionIntake: sequential flow, skips blocked', () => {
  const start = { id: 'f1', status: 'new' };
  const ok = EB.transitionIntake(start, 'triaged', { id: 'a1', role: 'analyst' });
  assert.equal(ok.ok, true);
  assert.equal(ok.finding.status, 'triaged');
  assert.equal(ok.finding.history.length, 1);
  assert.equal(start.status, 'new');
  const confirmed = EB.transitionIntake(ok.finding, 'confirmed', { id: 'l1', role: 'lead' });
  assert.equal(confirmed.ok, true);
  assert.equal(confirmed.finding.status, 'confirmed');
  const blocked = EB.transitionIntake({ id: 'f1', status: 'new' }, 'confirmed', { id: 'a1', role: 'analyst' });
  assert.equal(blocked.ok, false);
  assert.ok(blocked.error.includes('not allowed'));
  assert.equal(blocked.finding.status, 'new');
});

test('52715 transitionRemediation: assignment gate enforced', () => {
  const noAssignee = EB.transitionRemediation({ id: 'f2', status: 'confirmed' }, 'assigned', { id: 'l1', role: 'lead' });
  assert.equal(noAssignee.ok, false);
  assert.ok(noAssignee.error.includes('assignee'));
  const assigned = EB.transitionRemediation({ id: 'f2', status: 'confirmed', nextAssignee: 'meera' }, 'assigned', { id: 'l1', role: 'lead' });
  assert.equal(assigned.ok, true);
  assert.equal(assigned.finding.status, 'assigned');
  const fixing = EB.transitionRemediation({ id: 'f2', status: 'assigned', assignee: 'meera' }, 'fixing', { id: 'meera', role: 'engineer' });
  assert.equal(fixing.ok, true);
  const skip = EB.transitionRemediation({ id: 'f2', status: 'confirmed', nextAssignee: 'meera' }, 'fixing', { id: 'l1', role: 'lead' });
  assert.equal(skip.ok, false);
});

test('52716 transitionClosure: verify gate + bounce-back', () => {
  const noFix = EB.transitionClosure({ id: 'f3', status: 'fixing' }, 'verifying', { id: 'e1', role: 'engineer' });
  assert.equal(noFix.ok, false);
  assert.ok(noFix.error.includes('fix'));
  const verifying = EB.transitionClosure({ id: 'f3', status: 'fixing', fixNote: 'PR #42' }, 'verifying', { id: 'e1', role: 'engineer' });
  assert.equal(verifying.ok, true);
  const bounce = EB.transitionClosure({ id: 'f3', status: 'verifying', fixNote: 'PR #42' }, 'fixing', { id: 'v1', role: 'verifier' });
  assert.equal(bounce.ok, true);
  assert.equal(bounce.finding.status, 'fixing');
  const closed = EB.transitionClosure({ id: 'f3', status: 'verifying', verificationEvidence: 'retest passed', verifiedBy: 'v1', severity: 'medium' }, 'closed', { id: 'v1', role: 'verifier' });
  assert.equal(closed.ok, true);
  const selfClose = EB.transitionClosure({ id: 'f1', status: 'verifying', severity: 'critical', verificationEvidence: 'retest', verifiedBy: 'v1', fixer: 'user-1' }, 'closed', { id: 'user-1', role: 'verifier' });
  assert.equal(selfClose.ok, false);
  assert.ok(selfClose.error.includes('separate verifier'));
});

test('52717 validateTransition: guardrails explain blocks', () => {
  const m = EB.createLifecycleMachine();
  const blocked = EB.validateTransition(m, 'new', 'closed', {});
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.reasons[0].includes('not allowed'));
  assert.deepEqual(blocked.allowedNext, ['triaged', 'dismissed']);
  const terminal = EB.validateTransition(m, 'closed', 'triaged', {});
  assert.equal(terminal.allowed, false);
  assert.ok(terminal.reasons[0].includes('terminal'));
  assert.equal(EB.validateTransition(m, 'new', 'triaged', {}).allowed, true);
  assert.equal(EB.validateTransition(m, 'confirmed', 'assigned', {}).allowed, false);
  assert.equal(EB.validateTransition(m, 'confirmed', 'assigned', { assignee: 'meera' }).allowed, true);
  assert.equal(EB.validateTransition(m, 'paused', 'triaged', {}).allowed, false);
});

test('52718 canRoleTransition: per-role matrix', () => {
  assert.equal(EB.canRoleTransition('analyst', 'new', 'triaged').allowed, true);
  assert.equal(EB.canRoleTransition('engineer', 'fixing', 'verifying').allowed, true);
  const denied = EB.canRoleTransition('engineer', 'verifying', 'closed');
  assert.equal(denied.allowed, false);
  assert.ok(denied.reason.includes('may not'));
  assert.equal(EB.canRoleTransition('verifier', 'verifying', 'closed').allowed, true);
  assert.equal(EB.canRoleTransition('admin', 'assigned', 'fixing').allowed, true);
});

test('52719 appendStateLog: hash chain, append-only', () => {
  const empty = [];
  const one = EB.appendStateLog(empty, { findingId: 'f1', from: 'new', to: 'triaged', actor: 'a1', at: '2026-10-08T10:00:00Z' });
  assert.equal(empty.length, 0);
  assert.equal(one.length, 1);
  assert.equal(one[0].seq, 1);
  assert.equal(one[0].prevHash, 'genesis');
  const two = EB.appendStateLog(one, { findingId: 'f1', from: 'triaged', to: 'confirmed', actor: 'l1', at: '2026-10-08T11:00:00Z' });
  assert.equal(two.length, 2);
  assert.equal(one.length, 1);
  assert.equal(two[1].prevHash, two[0].hash);
  assert.notEqual(two[0].hash, two[1].hash);
  assert.equal(two[1].seq, 2);
});

test('52720 buildTransitionAlerts: critical, blocked, routine', () => {
  const crit = EB.buildTransitionAlerts({ findingId: 'f1', from: 'verifying', to: 'closed', actor: 'v1', severity: 'critical', ok: true }, { channels: ['in-app', 'email'], notifyRoles: ['lead'] });
  assert.equal(crit.shouldAlert, true);
  assert.equal(crit.alerts.length, 2);
  const blocked = EB.buildTransitionAlerts({ findingId: 'f1', from: 'new', to: 'closed', actor: 'a1', ok: false }, {});
  assert.equal(blocked.shouldAlert, true);
  assert.ok(blocked.alerts[0].message.includes('Blocked'));
  const routine = EB.buildTransitionAlerts({ findingId: 'f1', from: 'new', to: 'triaged', actor: 'a1', ok: true }, {});
  assert.equal(routine.shouldAlert, false);
  assert.equal(routine.alerts.length, 0);
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
test('css: only .w68a-/.w68b- scoped selectors, no globals', () => {
  const noComments = CSS_SRC.replace(/\/\*[\s\S]*?\*\//g, '');
  const classSelectors = [...noComments.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map(m => m[1]);
  assert.ok(classSelectors.length > 10, 'expected many scoped selectors');
  for (const cls of classSelectors) {
    assert.ok(cls.startsWith('w68a-') || cls.startsWith('w68b-'), `unscoped selector: .${cls}`);
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
  for (const f of ['Wave68A.jsx', 'Wave68B.jsx']) {
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
