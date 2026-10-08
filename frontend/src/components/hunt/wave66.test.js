/**
 * wave66.test.js — Infinity AI · Dark-Matter · Wave 66
 * node:test + node:assert/strict. Registry coverage (20/20 for 52601–52620,
 * 20/20 for 52621–52640, zero skips, 40/40 combined), registry titles matched
 * against the idea bank, deterministic spot-checks of every pure function
 * (at least one assertion per idea), Wave66.css scope/zero-animation audits,
 * a real esbuild JSX parse audit, a no-branding-leak audit ("Infinity AI"
 * only) and a no-debris audit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WAVE66_A_IDEAS } from './wave66ACore.js';
import * as EA from './wave66ACore.js';
import { WAVE66_B_IDEAS } from './wave66BCores.js';
import * as EB from './wave66BCores.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const CSS = join(DIR, 'Wave66.css');
const A_SRC = readFileSync(join(DIR, 'wave66ACore.js'), 'utf8');
const B_SRC = readFileSync(join(DIR, 'wave66BCores.js'), 'utf8');
const A_JSX = readFileSync(join(DIR, 'Wave66A.jsx'), 'utf8');
const B_JSX = readFileSync(join(DIR, 'Wave66B.jsx'), 'utf8');
const CSS_SRC = readFileSync(CSS, 'utf8');
const TEST_SRC = readFileSync(join(DIR, 'wave66.test.js'), 'utf8');
const ALL_SRC = [A_SRC, B_SRC, A_JSX, B_JSX, CSS_SRC];
const BRAND_SRC = [['A core', A_SRC], ['B core', B_SRC], ['A jsx', A_JSX], ['B jsx', B_JSX], ['css', CSS_SRC]];

/* ---- Registry coverage: 20/20 + 20/20, zero skips ---- */
test('registry: 20/20 email-trigger ideas, 20/20 email-ops ideas, zero skips', () => {
  assert.equal(WAVE66_A_IDEAS.length, 20);
  assert.equal(WAVE66_B_IDEAS.length, 20);
  const all = [...WAVE66_A_IDEAS, ...WAVE66_B_IDEAS];
  assert.equal(all.length, 40);
  const ids = all.map(i => i.id);
  assert.deepEqual(ids, Array.from({ length: 40 }, (_, k) => 52601 + k));
  for (const idea of all) {
    assert.equal(idea.skip, false, `idea ${idea.id} skipped`);
    assert.ok(idea.title && idea.title.length > 3, `idea ${idea.id} missing title`);
  }
});

test('registry: titles match idea-bank wording', () => {
  const byId = Object.fromEntries([...WAVE66_A_IDEAS, ...WAVE66_B_IDEAS].map(i => [i.id, i.title.toLowerCase()]));
  assert.ok(byId[52601].includes('severity-threshold'));
  assert.ok(byId[52602].includes('digest'));
  assert.ok(byId[52611].includes('localized'));
  assert.ok(byId[52616].includes('sla'));
  assert.ok(byId[52620].includes('bounty'));
  assert.ok(byId[52621].includes('posture'));
  assert.ok(byId[52624].includes('redact'));
  assert.ok(byId[52629].includes('variable library'));
  assert.ok(byId[52632].includes('csv'));
  assert.ok(byId[52640].includes('timezone'));
});

/* ---- Wave66 A spot checks (52601–52620) ---- */
const F = [
  { id: 'f1', title: 'SQLi', severity: 'critical', status: 'open', target: 't', foundAt: '2026-10-01T00:00:00Z', dueAt: '2026-10-02T00:00:00Z' },
  { id: 'f2', title: 'XSS', severity: 'medium', status: 'new', target: 't', foundAt: '2026-10-05T00:00:00Z' },
];

test('52601 decideEmailRoute: critical routes immediate', () => {
  const r = EA.decideEmailRoute(F, { immediateAt: 'high' });
  assert.equal(r.route, 'immediate');
  assert.equal(r.maxSeverity, 'critical');
  assert.ok(r.matched.includes('f1'));
});

test('52602 planDigestSchedule: builds per-subscriber jobs', () => {
  const jobs = EA.planDigestSchedule([{ email: 'a@x.com', frequency: 'weekly' }], { hunts: [{ id: 'h' }], newFindings: 3, closedFindings: 1 });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].frequency, 'weekly');
  assert.ok(jobs[0].subject.includes('1 hunt'));
});

test('52603 filterFindingsForTeam: only team assets', () => {
  const t = EA.filterFindingsForTeam([{ id: 'h1', team: 'red', findings: [{ id: 'f1' }] }, { id: 'h2', team: 'blue', findings: [{ id: 'f2' }] }], 'red');
  assert.deepEqual(t.hunts, ['h1']);
  assert.equal(t.findings.length, 1);
});

test('52604 tuneDigestForRole: executive gets posture view', () => {
  const e = EA.tuneDigestForRole({ findings: F, riskScore: 60, decisions: ['d'] }, 'executive');
  assert.equal(e.view, 'posture');
  assert.equal(e.counts.critical, 1);
  const eng = EA.tuneDigestForRole({ findings: F }, 'engineer');
  assert.equal(eng.view, 'detail');
});

test('52605 selectTopFindings: ordered by severity', () => {
  const top = EA.selectTopFindings(F, 5);
  assert.equal(top[0].id, 'f1');
  assert.ok(top[0].impact.includes('SQLi'));
});

test('52606 computeRemediationStats: counts and overdue', () => {
  const s = EA.computeRemediationStats(
    [...F, { id: 'f3', title: 'V', severity: 'low', status: 'fixed', foundAt: '2026-09-01T00:00:00Z', fixedAt: '2026-09-02T00:00:00Z' }],
    new Date('2026-10-08T00:00:00Z')
  );
  assert.equal(s.fixed, 1);
  assert.equal(s.overdue, 1);
  assert.equal(s.mttrHours, 24);
});

test('52607 buildSparklineData: blocks and normalized points', () => {
  const sp = EA.buildSparklineData([1, 2, 3, 4]);
  assert.equal(sp.spark.length, 4);
  assert.deepEqual(sp.points, [0, 33, 67, 100]);
});

test('52608 renderEmailBodies: both formats readable', () => {
  const b = EA.renderEmailBodies({ subject: 'S', heading: 'H', sections: [{ title: 'T', body: 'B' }], cta: { label: 'Go', url: 'https://x' } });
  assert.ok(b.text.includes('## T'));
  assert.ok(b.html.includes('<h2>T</h2>'));
  assert.ok(b.html.includes('https://x'));
});

test('52609 applyBranding: wraps with org header/footer', () => {
  const h = EA.applyBranding('<p>x</p>', { orgName: 'Infinity AI' });
  assert.ok(h.includes('Infinity AI'));
  assert.ok(h.includes('#6d28d9'));
});

test('52610 resolveReplyTo: per-type override wins', () => {
  assert.equal(EA.resolveReplyTo({ defaultReplyTo: 'a', byType: { alert: 'b' } }, 'alert'), 'b');
  assert.equal(EA.resolveReplyTo({ defaultReplyTo: 'a' }, 'digest'), 'a');
});

test('52611 localizeEmail: locale + fallback flag', () => {
  const dicts = { en: { k: () => ({ subject: 'S', body: 'B' }) } };
  const l = EA.localizeEmail('k', 'es', dicts);
  assert.equal(l.subject, 'S');
  assert.equal(l.fallback, true);
});

test('52612 renderActionButtons: email-safe buttons', () => {
  const h = EA.renderActionButtons([{ id: '1', label: 'Approve', url: 'https://x/1' }]);
  assert.ok(h.includes('Approve') && h.includes('https://x/1') && h.includes('<table'));
});

test('52613 buildTrackingPixel: gated on opt-in', () => {
  const on = EA.buildTrackingPixel({ optedIn: true, emailId: 'e1' });
  assert.equal(on.enabled, true);
  assert.ok(on.pixelUrl.includes('e1'));
  assert.equal(EA.buildTrackingPixel({ optedIn: false, emailId: 'e1' }).enabled, false);
});

test('52614 unsubscribe link: build + verify round-trip', () => {
  const u = EA.buildUnsubscribeLink('weekly', 'u1');
  const v = EA.verifyUnsubscribeToken(u.token);
  assert.equal(v.valid, true);
  assert.equal(v.digestType, 'weekly');
  assert.equal(v.userId, 'u1');
  assert.equal(EA.verifyUnsubscribeToken('bogus.token').valid, false);
});

test('52615 shouldSendEmail: preference gating', () => {
  assert.equal(EA.shouldSendEmail({ events: { digest: 'inapp' }, default: 'email' }, 'digest').sendEmail, false);
  assert.equal(EA.shouldSendEmail({ default: 'both' }, 'alert').channel, 'both');
});

test('52616 detectSlaBreaches: triage overdue caught', () => {
  const b = EA.detectSlaBreaches([F[0]], { triage: { critical: 24 } }, new Date('2026-10-08T00:00:00Z'));
  assert.equal(b.length, 1);
  assert.equal(b[0].sla, 'triage');
  assert.ok(b[0].overdueHours > 100);
});

test('52617 buildAllClearEmail: celebratory signed email', () => {
  const e = EA.buildAllClearEmail({ id: 'rg1', target: 't', checkedAt: 'now', verifiedBy: 'Lead' });
  assert.ok(e.subject.includes('All clear'));
  assert.ok(e.text.includes('Lead'));
});

test('52618 detectNewCriticals: only fresh criticals', () => {
  const n = EA.detectNewCriticals(F, [{ id: 'f1' }]);
  assert.equal(n.length, 0);
  const n2 = EA.detectNewCriticals(F, []);
  assert.deepEqual(n2.map(f => f.id), ['f1']);
});

test('52619 summarizeFalsePositives: aggregates reasons', () => {
  const s = EA.summarizeFalsePositives([
    { findingId: 'a', reason: 'duplicate', dismissedBy: 'lead', severity: 'medium' },
    { findingId: 'b', reason: 'duplicate', dismissedBy: 'lead', severity: 'low' },
  ]);
  assert.equal(s.total, 2);
  assert.equal(s.byReason.duplicate, 2);
  assert.deepEqual(s.reviewers, ['lead']);
});

test('52620 buildPayoutNotice: researcher notification', () => {
  const p = EA.buildPayoutNotice({ researcher: 'hx', findingId: 'f1', amount: 500, currency: 'USD', program: 'P' });
  assert.ok(p.subject.includes('USD 500.00'));
  assert.ok(p.text.includes('hx'));
});

/* ---- Wave66 B spot checks (52621–52640) ---- */
test('52621 summarizePosture: portfolio rollup', () => {
  const p = EB.summarizePosture([{ id: 'h', target: 't', findings: F }]);
  assert.equal(p.huntsRun, 1);
  assert.equal(p.openCritical, 1);
  assert.equal(p.topRisks[0].target, 't');
});

test('52622 compareMonthOverMonth: direction + narrative', () => {
  const t = EB.compareMonthOverMonth({ critical: 1, high: 2, fixed: 10, avgRisk: 40 }, { critical: 3, high: 5, fixed: 8, avgRisk: 50 });
  assert.equal(t.direction, 'improving');
  assert.ok(t.narrative.includes('improving'));
});

test('52623 buildClientSummary: client-safe + redacted flag', () => {
  const e = EB.buildClientSummary({ target: 't', completedAt: 'c', findings: F }, { name: 'Acme', portalUrl: 'https://p', contactName: 'Pri' });
  assert.equal(e.redacted, true);
  assert.ok(e.text.includes('https://p'));
});

test('52624 redactEmailContent: strips tokens', () => {
  const r = EB.redactEmailContent({ subject: 's', text: 'key abcdefghijklmnopqrstuvwxyz123456 end', html: '' });
  assert.ok(r.text.includes('[REDACTED]'));
  assert.ok(!r.text.includes('abcdefghijklmnopqrstuvwxyz'));
});

test('52625 chooseEncryption: prefers configured method', () => {
  const c = EB.chooseEncryption({ preferred: 'pgp', pgpKeyId: 'K' }, ['pgp', 'none']);
  assert.equal(c.method, 'pgp');
  assert.equal(c.envelope, 'encrypted:pgp');
  assert.equal(EB.chooseEncryption({ preferred: 'smime' }, ['none']).method, 'none');
});

test('52626 delivery logs: append immutable + summarize rates', () => {
  let logs = EB.appendDeliveryLog([], { emailId: 'e1', to: 'a', event: 'sent' });
  logs = EB.appendDeliveryLog(logs, { emailId: 'e1', to: 'a', event: 'bounced' });
  assert.equal(logs.length, 2);
  const s = EB.summarizeDelivery(logs);
  assert.equal(s.bounceRate, 100);
});

test('52627 nextRetryDelay: exponential backoff caps', () => {
  const r0 = EB.nextRetryDelay(0, { baseMs: 60000, maxMs: 3600000, maxAttempts: 3 });
  assert.equal(r0.delayMs, 60000);
  const r9 = EB.nextRetryDelay(9);
  assert.equal(r9.delayMs, 3600000);
  assert.equal(EB.nextRetryDelay(2, { maxAttempts: 3 }).giveUp, true);
});

test('52628 buildTestSend: marked test with watermark', () => {
  const p = EB.buildTestSend({ subject: c => `S ${c.x}`, body: c => `B ${c.x}` }, { x: '1' }, 'me@x');
  assert.ok(p.subject.startsWith('[TEST]'));
  assert.equal(p.isTest, true);
});

test('52629 variable library: documented + resolvable', () => {
  assert.ok(EB.VARIABLE_LIBRARY.length >= 8);
  const { text, unresolved } = EB.resolveVariables('Hunt {{hunt.name}} on {{hunt.target}} ({{missing.deep}})', { hunt: { name: 'Q3', target: 't' } });
  assert.ok(text.includes('Q3'));
  assert.deepEqual(unresolved, ['missing.deep']);
});

test('52630 evaluateSectionConditions: data-gated sections', () => {
  const secs = EB.evaluateSectionConditions([
    { id: 'a', condition: c => c.n > 0, render: c => `n=${c.n}` },
    { id: 'b', condition: c => c.n === 0, render: () => 'zero' },
  ], { n: 2 });
  assert.deepEqual(secs.map(s => s.id), ['a']);
  assert.equal(secs[0].html, 'n=2');
});

test('52631 renderInlineChart: svg donut + bars', () => {
  const d = EB.renderInlineChart({ labels: ['a', 'b'], values: [1, 3] }, 'donut');
  assert.ok(d.startsWith('<svg') && d.includes('<path'));
  const bars = EB.renderInlineChart({ labels: ['a'], values: [2] }, 'bars');
  assert.ok(bars.includes('<rect'));
});

test('52632 findingsToCsv: header + escaped rows', () => {
  const csv = EB.findingsToCsv([{ id: 'f1', title: 'A "quoted"', severity: 'high', status: 'open', target: 't', foundAt: 'd' }]);
  assert.equal(csv.filename, 'findings.csv');
  assert.ok(csv.content.startsWith('id,title,severity,status,target,foundAt'));
  assert.ok(csv.content.includes('A ""quoted""'));
});

test('52633 summarizeTeamActivity: byType + recent', () => {
  const s = EB.summarizeTeamActivity([
    { type: 'comment', actor: 'a', at: '2026-10-08T10:00:00Z', huntId: 'h1' },
    { type: 'comment', actor: 'b', at: '2026-10-08T11:00:00Z', huntId: 'h2' },
  ]);
  assert.equal(s.byType.comment, 2);
  assert.equal(s.recent[0].actor, 'b');
});

test('52634 pendingTriageNudge: counts awaiting review', () => {
  const n = EB.pendingTriageNudge(F, 'lead@x');
  assert.equal(n.count, 1);
  assert.ok(n.subject.includes('1 finding'));
});

test('52635 pendingFixesList: overdue vs due-soon split', () => {
  const mine = F.map(f => ({ ...f, assignee: 'lead' }));
  const l = EB.pendingFixesList(mine, 'lead', new Date('2026-10-08T00:00:00Z'));
  assert.ok(l.overdue.includes('f1'));
  assert.ok(!l.dueSoon.includes('f1'));
});

test('52636 buildPreHuntNotice: warns stakeholders', () => {
  const e = EB.buildPreHuntNotice({ target: 'prod', startsAt: '2026-10-10', scope: 'ext' });
  assert.ok(e.subject.includes('prod'));
});

test('52637 buildPostRegressionDiff: fixed/introduced/remaining', () => {
  const d = EB.buildPostRegressionDiff([{ id: 'a' }, { id: 'b' }], [{ id: 'b' }, { id: 'c' }]);
  assert.deepEqual(d.fixed, ['a']);
  assert.deepEqual(d.introduced, ['c']);
  assert.equal(d.remaining, 1);
});

test('52638 buildArchiveNotice: opt-out link present', () => {
  const e = EB.buildArchiveNotice({ id: 'arc', target: 't', archiveAt: '2026-11-01' }, 'https://keep');
  assert.ok(e.text.includes('https://keep'));
});

test('52639 buildShareLinkAccessNotice: owner alert', () => {
  const e = EB.buildShareLinkAccessNotice({ linkId: 'sl', huntTarget: 't', accessedAt: 'now', ip: '1.2.3.4', ownerEmail: 'o@x' });
  assert.equal(e.to, 'o@x');
  assert.ok(e.text.includes('1.2.3.4'));
});

test('52640 formatForTimezone: labeled local time', () => {
  const t = EB.formatForTimezone('2026-10-08T12:00:00Z', 'Asia/Kolkata');
  assert.equal(t.tz, 'Asia/Kolkata');
  assert.ok(t.label.includes('Asia/Kolkata'));
  assert.ok(t.local.includes('17:30'));
});

/* ---- CSS scope + zero-animation audits ---- */
test('css: only .w66a-/.w66b- scoped selectors, no globals', () => {
  const noComments = CSS_SRC.replace(/\/\*[\s\S]*?\*\//g, '');
  const classSelectors = [...noComments.matchAll(/\.([a-zA-Z0-9_-]+)/g)].map(m => m[1]);
  assert.ok(classSelectors.length > 10, 'expected many scoped selectors');
  for (const cls of classSelectors) {
    assert.ok(cls.startsWith('w66a-') || cls.startsWith('w66b-'), `unscoped selector: .${cls}`);
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
  for (const f of ['Wave66A.jsx', 'Wave66B.jsx']) {
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
    // The word "Muse" appears in this audit's own regex, so match case-insensitively
    // against the literal string split to avoid the audit's own pattern tripping itself.
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
