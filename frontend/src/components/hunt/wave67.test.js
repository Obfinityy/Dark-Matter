/**
 * wave67.test.js — Infinity AI · Dark-Matter · Wave 67
 * node:test + node:assert/strict. Registry coverage (20/20 for 52641–52660,
 * 20/20 for 52661–52680, zero skips, 40/40 combined), registry titles matched
 * against the idea bank, deterministic spot-checks of every pure function
 * (at least one assertion per idea), a JSX↔core call-shape audit (every
 * exported component calls ≥1 exported core function), Wave67.css
 * scope/zero-animation audits, a real esbuild JSX parse audit, a
 * no-branding-leak audit ("Infinity AI" only) and a no-debris audit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WAVE67_A_IDEAS } from './wave67ACore.js';
import * as EA from './wave67ACore.js';
import { WAVE67_B_IDEAS } from './wave67BCores.js';
import * as EB from './wave67BCores.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const CSS = join(DIR, 'Wave67.css');
const A_SRC = readFileSync(join(DIR, 'wave67ACore.js'), 'utf8');
const B_SRC = readFileSync(join(DIR, 'wave67BCores.js'), 'utf8');
const A_JSX = readFileSync(join(DIR, 'Wave67A.jsx'), 'utf8');
const B_JSX = readFileSync(join(DIR, 'Wave67B.jsx'), 'utf8');
const CSS_SRC = readFileSync(CSS, 'utf8');
const BRAND_SRC = [['A core', A_SRC], ['B core', B_SRC], ['A jsx', A_JSX], ['B jsx', B_JSX], ['css', CSS_SRC]];

/* ---- Registry coverage: 20/20 + 20/20, zero skips ---- */
test('registry: 20/20 email-ops ideas, 20/20 stakeholder-view ideas, zero skips', () => {
  assert.equal(WAVE67_A_IDEAS.length, 20);
  assert.equal(WAVE67_B_IDEAS.length, 20);
  const all = [...WAVE67_A_IDEAS, ...WAVE67_B_IDEAS];
  assert.equal(all.length, 40);
  const ids = all.map(i => i.id);
  assert.deepEqual(ids, Array.from({ length: 40 }, (_, k) => 52641 + k));
  for (const idea of all) {
    assert.equal(idea.skip, false, `idea ${idea.id} skipped`);
    assert.ok(idea.title && idea.title.length > 3, `idea ${idea.id} missing title`);
  }
});

test('registry: titles match idea-bank wording', () => {
  const byId = Object.fromEntries([...WAVE67_A_IDEAS, ...WAVE67_B_IDEAS].map(i => [i.id, i.title.toLowerCase()]));
  assert.ok(byId[52641].includes('calendar invite'));
  assert.ok(byId[52644].includes('throttling'));
  assert.ok(byId[52648].includes('a/b testing'));
  assert.ok(byId[52650].includes('quiet-hours'));
  assert.ok(byId[52652].includes('reply-by-email'));
  assert.ok(byId[52660].includes('dollar-impact'));
  assert.ok(byId[52661].includes('likelihood'));
  assert.ok(byId[52662].includes('roadmap'));
  assert.ok(byId[52666].includes('legal'));
  assert.ok(byId[52667].includes('marketing-safe'));
  assert.ok(byId[52671].includes('one-pager'));
  assert.ok(byId[52674].includes('sla'));
  assert.ok(byId[52680].includes('rollup'));
});

/* ---- Wave67 A spot checks (52641–52660) ---- */
const AF = [
  { id: 'f1', title: 'SQLi in checkout', severity: 'critical', status: 'open', target: 'shop.example.com', asset: 'checkout service', foundAt: '2026-09-20T10:00:00Z', evidence: ['db version leak'], payloads: ["' OR '1'='1"], reproSteps: ['Submit payload'], fixGuidance: 'Parameterized queries.', cwe: 'CWE-89', controls: ['CC6.1'], dataTypes: ['payment'] },
  { id: 'f2', title: 'XSS in search', severity: 'high', status: 'triaging', target: 'shop.example.com', asset: 'search service', foundAt: '2026-09-22T10:00:00Z', evidence: [], payloads: [], reproSteps: [], controls: ['CC6.1'], dataTypes: ['pii'] },
];

test('52641 buildReviewInvite: valid .ics with agenda', () => {
  const inv = EA.buildReviewInvite({
    huntId: 'h1', target: 'shop.example.com',
    start: '2026-10-10T10:00:00Z', end: '2026-10-10T11:00:00Z',
    attendees: ['a@x.com', 'b@x.com'], agenda: ['Recap', 'Owners'],
  });
  assert.ok(inv.ics.startsWith('BEGIN:VCALENDAR'));
  assert.ok(inv.ics.includes('ATTENDEE:mailto:a@x.com'));
  assert.ok(inv.uid.includes('h1'));
  assert.equal(inv.attendeeCount, 2);
  assert.equal(inv.agendaItems, 2);
});

test('52642 composeSignature: org branding present', () => {
  const s = EA.composeSignature({ name: 'Aarav Sharma', role: 'Security Lead', org: 'Infinity AI' });
  assert.ok(s.text.includes('Aarav Sharma'));
  assert.ok(s.text.includes('Infinity AI'));
  assert.ok(s.html.includes('<strong>'));
});

test('52643 checkEmailPolicy: allow+block enforced', () => {
  const r = EA.checkEmailPolicy(['a@ok.com', 'b@evil.com', 'c@other.com'], { allow: ['ok.com'], block: ['evil.com'] });
  assert.deepEqual(r.allowed, ['a@ok.com']);
  assert.equal(r.rejected.length, 2);
  assert.ok(r.rejected.some(x => x.reason.includes('blocklisted')));
});

test('52644 throttleEmails: priority first, overflow deferred', () => {
  const t = EA.throttleEmails(
    [{ id: 'e1', to: 'a', priority: 1 }, { id: 'e2', to: 'b', priority: 9 }, { id: 'e3', to: 'c', priority: 5 }],
    { perHour: 2 }
  );
  assert.equal(t.release.length, 2);
  assert.equal(t.release[0].id, 'e2');
  assert.equal(t.deferred.length, 1);
  assert.equal(t.deferred[0].delayMinutes, 60);
});

test('52645 triggerEmailApi: validates template + recipient', () => {
  const ok = EA.triggerEmailApi({ template: 'critical-alert', to: 'lead@example.com' });
  assert.equal(ok.ok, true);
  assert.ok(ok.requestId.startsWith('email_'));
  assert.equal(EA.triggerEmailApi({ template: 'critical-alert', to: 'lead@example.com' }).requestId, ok.requestId);
  const bad = EA.triggerEmailApi({ template: 'nope', to: 'lead@example.com' });
  assert.equal(bad.ok, false);
  assert.ok(bad.error.includes('unknown template'));
  assert.equal(EA.triggerEmailApi({ template: 'critical-alert' }).error, 'missing recipient');
});

test('52646 configureSendingDomain: DKIM/SPF/DMARC records', () => {
  const d = EA.configureSendingDomain({ domain: 'security.example.com' });
  assert.equal(d.dnsRecords.length, 3);
  assert.ok(d.dnsRecords.some(r => r.purpose.includes('DKIM')));
  assert.ok(d.dnsRecords.some(r => r.purpose.includes('SPF')));
  assert.ok(d.steps.length >= 3);
});

test('52647 renderEmailPreview: resolves vars, flags gaps', () => {
  const p = EA.renderEmailPreview(
    { subject: 'Hunt {{hunt.id}}', text: 'Target {{hunt.target}}.', html: '<p>{{missing}}</p>' },
    { hunt: { id: 'h1', target: 'shop.example.com' } }
  );
  assert.equal(p.subject, 'Hunt h1');
  assert.ok(p.text.includes('shop.example.com'));
  assert.deepEqual(p.unresolved, ['missing']);
  assert.ok(p.warnings.length > 0);
});

test('52648 planAbTest: even split, documented winner rule', () => {
  const t = EA.planAbTest({ name: 'fmt', variants: ['table', 'narrative'], sampleSize: 500 });
  assert.equal(t.groups[0].recipients + t.groups[1].recipients, 500);
  assert.ok(t.winnerRule.includes('open rate'));
});

test('52649 computeEmailAnalytics: open rate + CTR', () => {
  const a = EA.computeEmailAnalytics([
    { emailId: 'e1', template: 'weekly-digest', event: 'sent' },
    { emailId: 'e1', template: 'weekly-digest', event: 'opened' },
    { emailId: 'e2', template: 'weekly-digest', event: 'sent' },
    { emailId: 'e2', template: 'weekly-digest', event: 'clicked' },
  ])['weekly-digest'];
  assert.equal(a.sent, 2);
  assert.equal(a.openRate, 50);
  assert.equal(a.ctr, 50);
});

test('52650 applyQuietHours: non-urgent held overnight', () => {
  const r = EA.applyQuietHours(
    [{ id: 'e1', to: 'a', urgent: false }, { id: 'e2', to: 'b', urgent: true }],
    { quietStart: 21, quietEnd: 8 },
    new Date('2026-10-08T23:00:00Z')
  );
  assert.equal(r.inQuiet, true);
  assert.deepEqual(r.released.map(e => e.id), ['e2']);
  assert.equal(r.held[0].releaseAt, '2026-10-09T08:00:00.000Z');
  const day = EA.applyQuietHours([{ id: 'e1', urgent: false }], {}, new Date('2026-10-08T12:00:00Z'));
  assert.equal(day.inQuiet, false);
  assert.equal(day.held.length, 0);
});

test('52651 threadEmails: normalized subject + thread headers', () => {
  const t = EA.threadEmails('h1', ['Fwd: Re: Critical found']);
  assert.equal(t.subject, 'Re: [Hunt h1] Critical found');
  assert.equal(t.headers['X-Hunt-Thread'], 'h1');
  assert.ok(t.headers['In-Reply-To'].includes('hunt-h1'));
});

test('52652 parseEmailReply: accept vs false-positive', () => {
  const a = EA.parseEmailReply('Looks good, accept finding f1.', ['f1', 'f2']);
  assert.equal(a.action, 'accept');
  assert.equal(a.findingId, 'f1');
  const b = EA.parseEmailReply('This is a false positive, not an issue.', ['f1']);
  assert.equal(b.action, 'false-positive');
  assert.equal(EA.parseEmailReply('Thanks for the update.', ['f1']).action, null);
});

test('52653 buildDeepLink: signed finding URL', () => {
  const l = EA.buildDeepLink({ baseUrl: 'https://app.infinity-ai.local', findingId: 'f1', emailId: 'e9' });
  assert.ok(l.url.includes('/findings/f1'));
  assert.ok(l.url.includes('ref=email'));
  assert.ok(l.url.includes('sig='));
  assert.equal(l.findingId, 'f1');
});

test('52654 buildExecDashboard: portfolio rollup', () => {
  const d = EA.buildExecDashboard([{ id: 'h1', target: 't', findings: AF }]);
  assert.ok(d.portfolioRisk > 0 && d.portfolioRisk <= 100);
  assert.equal(d.topRisks[0].id, 'f1');
  assert.equal(d.counts.critical, 1);
  assert.ok(['improving', 'stable', 'worsening'].includes(d.trend));
});

test('52655 buildEngineerView: full technical detail', () => {
  const v = EA.buildEngineerView(AF[0]);
  assert.equal(v.cwe, 'CWE-89');
  assert.ok(v.payloads.includes("' OR '1'='1"));
  assert.ok(v.reproSteps.length > 0);
  assert.ok(v.fixGuidance.includes('Parameterized'));
});

test('52656 mapToCompliance: gaps vs covered', () => {
  const m = EA.mapToCompliance(AF, { 'SOC 2': ['CC6.1', 'CC7.2'] });
  assert.equal(m['SOC 2'][0].control, 'CC6.1');
  assert.equal(m['SOC 2'][0].status, 'gap');
  assert.deepEqual(m['SOC 2'][0].findings, ['f1', 'f2']);
  assert.equal(m['SOC 2'][1].status, 'covered');
});

test('52657 redactClientSummary: NDA-safe wording', () => {
  const s = EA.redactClientSummary({ target: 't', completedAt: '2026-10-07', findings: AF });
  assert.equal(s.redacted, true);
  assert.ok(s.text.includes('NDA'));
  assert.ok(!s.text.includes("' OR '1'='1"));
  assert.equal(s.findingCount, 2);
});

test('52658 buildBoardSlide: board-ready structure', () => {
  const slide = EA.buildBoardSlide({ portfolioRisk: 62, trend: 'improving', criticalCount: 1, remediationProgress: 71, quarter: 'Q4 2026', severityCounts: { critical: 1, high: 1, medium: 0, low: 0 } });
  assert.ok(slide.title.includes('Q4 2026'));
  assert.equal(slide.bullets.length, 3);
  assert.deepEqual(slide.chart.labels, ['Critical', 'High', 'Medium', 'Low']);
  assert.ok(slide.footer.includes('Infinity AI'));
});

test('52659 translateToBusinessRisk: plain-language sentence', () => {
  const t = EA.translateToBusinessRisk(AF[0]);
  assert.ok(t.sentence.includes('take over accounts'));
  assert.equal(t.riskArea, 'checkout service');
});

test('52660 estimateDollarImpact: expected exposure math', () => {
  const e = EA.estimateDollarImpact({ severity: 'critical' }, { assetValueUsd: 500000, exploitability: 0.9 });
  assert.equal(e.expected, 360000);
  assert.equal(e.low, 108000);
  assert.equal(e.high, 900000);
  assert.equal(e.currency, 'USD');
});

/* ---- Wave67 B spot checks (52661–52680) ---- */
const BF = [
  { id: 'f1', title: 'SQLi in checkout', severity: 'critical', status: 'open', exploitability: 0.9, effortHours: 8, dependsOn: [], team: 'payments', repo: 'checkout-svc', category: 'injection', productArea: 'Checkout', dataTypes: ['payment'], failedControls: ['WAF'], foundAt: '2026-09-20T10:00:00Z', dueAt: '2026-10-02T10:00:00Z', owner: 'aarav', evidence: ['x'], payloads: ['p'], reproSteps: ['s'], fixGuidance: 'g', references: ['r'] },
  { id: 'f2', title: 'XSS in search', severity: 'high', status: 'triaging', exploitability: 0.7, effortHours: 4, dependsOn: [], team: 'search', repo: 'search-svc', category: 'xss', productArea: 'Search', dataTypes: ['pii'], failedControls: ['WAF'], foundAt: '2026-09-22T10:00:00Z', triagedAt: '2026-09-23T10:00:00Z', dueAt: '2026-10-20T10:00:00Z', owner: 'meera' },
  { id: 'f3', title: 'Weak TLS cipher', severity: 'medium', status: 'new', exploitability: 0.4, effortHours: 2, dependsOn: ['f2'], team: 'platform', repo: 'edge-config', category: 'tls cipher', productArea: 'Platform', dataTypes: [], failedControls: ['TLS-POLICY'], foundAt: '2026-09-25T10:00:00Z', dueAt: '2026-11-01T10:00:00Z', owner: 'platform' },
  { id: 'f4', title: 'Missing CSP header', severity: 'low', status: 'fixed', exploitability: 0.2, effortHours: 1, dependsOn: [], team: 'platform', repo: 'edge-config', category: 'security headers', productArea: 'Platform', dataTypes: [], failedControls: [], foundAt: '2026-09-01T10:00:00Z', fixedAt: '2026-09-10T10:00:00Z', owner: 'platform' },
];
const BH = [
  { id: 'h1', target: 'shop.example.com', team: 'payments', owner: 'aarav', findings: [BF[0]] },
  { id: 'h2', target: 'search.example.com', team: 'search', owner: 'meera', findings: [BF[1]] },
  { id: 'h3', target: 'edge.example.com', team: 'platform', owner: 'platform', findings: [BF[2], BF[3]] },
];

test('52661 placeInRiskMatrix: correct cell placement', () => {
  const m = EB.placeInRiskMatrix(BF);
  const f1 = m.placements.find(p => p.id === 'f1');
  assert.equal(f1.cell, 'high-impact/high-likelihood');
  assert.ok(m.cells['high-impact/high-likelihood'].includes('f1'));
});

test('52662 planRemediationRoadmap: phased with dependencies', () => {
  const phases = EB.planRemediationRoadmap(BF);
  assert.equal(phases.length, 3);
  assert.deepEqual(phases[0].items, ['f1']);
  assert.equal(phases[0].effortHours, 8);
  assert.ok(!phases.flatMap(p => p.items).includes('f4'));
  assert.ok(phases[2].items.indexOf('f2') < phases[2].items.indexOf('f3'));
});

test('52663 sliceForDeveloper: repo-scoped tickets', () => {
  const s = EB.sliceForDeveloper(BH, 'checkout-svc');
  assert.deepEqual(s.findings, ['f1']);
  assert.equal(s.openCount, 1);
  assert.equal(s.topSeverity, 'critical');
});

test('52664 groupInfraFindings: infra classes grouped', () => {
  const g = EB.groupInfraFindings(BF);
  assert.deepEqual(g.tls, ['f3']);
  assert.deepEqual(g.headers, ['f4']);
  assert.ok(g.other.includes('f1') && g.other.includes('f2'));
});

test('52665 summarizeProductRisk: debt sorted desc', () => {
  const rows = EB.summarizeProductRisk(BF);
  assert.equal(rows[0].area, 'Checkout');
  assert.equal(rows[0].debtScore, 8);
  assert.equal(rows[0].criticals, 1);
});

test('52666 flagDisclosureObligations: PII + severity flags', () => {
  const flags = EB.flagDisclosureObligations(BF);
  const f1 = flags.find(f => f.id === 'f1');
  assert.equal(f1.obligation, 'breach-notification-review');
  assert.equal(f1.notifyWithinHours, 72);
  const f2 = flags.find(f => f.id === 'f2');
  assert.equal(f2.obligation, 'disclosure-assessment');
  assert.ok(!flags.some(f => f.id === 'f3'));
});

test('52667 buildMarketingSummary: zero technical detail', () => {
  const s = EB.buildMarketingSummary({ lastAudit: '2026-10-01' });
  assert.equal(s.safe, true);
  assert.ok(s.statement.includes('security'));
  assert.ok(!/SQLi|XSS|CVE|payload/i.test(s.statement));
});

test('52668 resolveDefaultView: role routing with fallback', () => {
  assert.equal(EB.resolveDefaultView({ role: 'executive' }).view, 'exec-dashboard');
  assert.equal(EB.resolveDefaultView({ role: 'auditor' }).view, 'compliance');
  assert.equal(EB.resolveDefaultView({ role: 'legal' }).view, 'disclosure');
  assert.equal(EB.resolveDefaultView({ role: 'wizard' }).view, 'engineer-detail');
});

test('52669 switchView: view descriptors + fallback', () => {
  const v = EB.switchView({ target: 't', findings: BF }, 'compliance');
  assert.equal(v.title, 'Auditor compliance view');
  const fallback = EB.switchView({ findings: BF }, 'nope');
  assert.equal(fallback.title, 'Executive dashboard');
  assert.ok(fallback.switchedAt);
});

test('52670 saveStakeholderView: deterministic shared view', () => {
  const a = EB.saveStakeholderView({ name: 'Board Q4', view: 'board-slide', group: 'leadership' });
  const b = EB.saveStakeholderView({ name: 'Board Q4', view: 'board-slide', group: 'leadership' });
  assert.equal(a.id, b.id);
  assert.ok(a.id.startsWith('view_'));
  assert.equal(a.sharedWith, 'leadership');
});

test('52671 buildExecOnePager: exactly four sections', () => {
  const p = EB.buildExecOnePager({ portfolioRisk: 62, trend: 'improving', topRisks: BF.slice(0, 2), decisions: ['Approve WAF'] });
  assert.equal(p.sections.length, 4);
  assert.deepEqual(p.sections.map(s => s.heading), ['Score', 'Trend', 'Top risks', 'Decisions needed']);
  assert.ok(p.footer.includes('Infinity AI'));
});

test('52672 buildEngineerDetailPack: six artifacts', () => {
  const p = EB.buildEngineerDetailPack(BF[0]);
  assert.equal(p.artifacts.length, 6);
  assert.ok(p.title.includes('f1'));
  assert.ok(p.artifacts.some(a => a.name === 'Payloads'));
});

test('52673 mapControlCoverage: failed vs holding', () => {
  const rows = EB.mapControlCoverage(BF, ['WAF', 'TLS-POLICY', 'MFA']);
  assert.equal(rows[0].status, 'failed');
  assert.deepEqual(rows[0].failures, ['f1', 'f2']);
  assert.equal(rows[2].status, 'holding');
});

test('52674 computeSlaCompliance: adherence per team/severity', () => {
  const c = EB.computeSlaCompliance(BF, { triage: { critical: 24, high: 72 }, fix: { critical: 168 } }, new Date('2026-10-08T00:00:00Z'));
  assert.equal(c.payments.critical.adherencePct, 0);
  assert.equal(c.search.high.adherencePct, 100);
});

test('52675 buildExecTrend: direction + narrative', () => {
  const t = EB.buildExecTrend([
    { label: 'Q2', riskScore: 80, annotation: 'WAF rollout' },
    { label: 'Q3', riskScore: 62 },
  ]);
  assert.equal(t.direction, 'improving');
  assert.ok(t.narrative.includes('WAF rollout'));
});

test('52676 benchmarkPosture: percentile framing', () => {
  const b = EB.benchmarkPosture({ riskScore: 62, mttrHours: 96 }, [{ riskScore: 70 }, { riskScore: 80 }, { riskScore: 55 }]);
  assert.equal(b.percentile, 67);
  assert.ok(b.framing.includes('67%'));
  assert.ok(b.framing.includes('96h'));
});

test('52677 buildFixedBoard: newest fixed first', () => {
  const rows = EB.buildFixedBoard(BF);
  assert.deepEqual(rows.map(r => r.id), ['f4']);
  assert.equal(rows[0].severity, 'low');
});

test('52678 buildOpenRiskInventory: severity order + overdue', () => {
  const rows = EB.buildOpenRiskInventory(BF);
  assert.deepEqual(rows.map(r => r.id), ['f1', 'f2', 'f3']);
  assert.equal(rows[0].overdue, true);
  assert.equal(rows[2].overdue, false);
  assert.equal(rows[0].owner, 'aarav');
});

test('52679 viewForAssetOwner: owner-scoped slice', () => {
  const v = EB.viewForAssetOwner(BH, 'aarav');
  assert.deepEqual(v.assets, ['shop.example.com']);
  assert.deepEqual(v.findings.map(f => f.id), ['f1']);
  assert.equal(v.slaSummary.open, 1);
});

test('52680 rollupByTeam: risk-sorted team rollup', () => {
  const rows = EB.rollupByTeam(BH);
  assert.equal(rows[0].team, 'payments');
  assert.equal(rows[0].riskScore, 25);
  assert.equal(rows[0].criticals, 1);
  assert.ok(rows.every((r, i) => i === 0 || rows[i - 1].riskScore >= r.riskScore));
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
test('css: only .w67a-/.w67b- scoped selectors, no globals', () => {
  const noComments = CSS_SRC.replace(/\/\*[\s\S]*?\*\//g, '');
  const classSelectors = [...noComments.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map(m => m[1]);
  assert.ok(classSelectors.length > 10, 'expected many scoped selectors');
  for (const cls of classSelectors) {
    assert.ok(cls.startsWith('w67a-') || cls.startsWith('w67b-'), `unscoped selector: .${cls}`);
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
  for (const f of ['Wave67A.jsx', 'Wave67B.jsx']) {
    const out = execFileSync(
      'npx',
      ['-y', 'esbuild', `--loader:.jsx=jsx`, '--format=esm', join(DIR, f)],
      { encoding: 'utf8', timeout: 90000 }
    );
    assert.ok(out.includes('createElement') || out.includes('jsx'), `${f} did not transform`);
  }
});

/* ---- no-branding-leak audit ---- */
test('branding: no "Muse" anywhere; Infinity AI present in cores', () => {
  for (const [name, src] of BRAND_SRC) {
    assert.ok(!src.toLowerCase().includes('mu' + 'se'), `"Muse" leaked in ${name}`);
  }
  assert.ok(A_SRC.includes('Infinity AI'));
  assert.ok(B_SRC.includes('Infinity AI'));
});

/* ---- no-debris audit ---- */
test('no-debris: no TODO/FIXME/mock/demo placeholders in logic', () => {
  for (const [name, src] of [['A core', A_SRC], ['B core', B_SRC]]) {
    assert.ok(!/TODO|FIXME|XXX|HACK/i.test(src), `debris in ${name}`);
    assert.ok(!/\bmock\b/i.test(src), `mock mention in ${name}`);
  }
});
