/**
 * wave65.test.js — Infinity AI · Dark-Matter · Wave 65
 * node:test + node:assert/strict. Registry coverage (20/20 for 52561–52580,
 * 20/20 for 52581–52600, zero skips, 40/40 combined), registry titles matched
 * against the idea bank, deterministic spot-checks of every pure function
 * (at least one assertion per idea), Wave65.css scope/zero-animation audits,
 * a real esbuild JSX parse audit, a no-branding-leak audit ("Infinity AI"
 * only) and a no-debris audit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WAVE65_AN_IDEAS } from './archiveNotifyCore.js';
import * as AN from './archiveNotifyCore.js';
import { WAVE65_AO_IDEAS } from './archiveOpsCore.js';
import * as AO from './archiveOpsCore.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const CSS = join(DIR, 'Wave65.css');
const AN_SRC = readFileSync(join(DIR, 'archiveNotifyCore.js'), 'utf8');
const AO_SRC = readFileSync(join(DIR, 'archiveOpsCore.js'), 'utf8');
const AN_JSX = readFileSync(join(DIR, 'ArchiveNotify.jsx'), 'utf8');
const AO_JSX = readFileSync(join(DIR, 'ArchiveOps.jsx'), 'utf8');
const CSS_SRC = readFileSync(CSS, 'utf8');
const TEST_SRC = readFileSync(join(DIR, 'wave65.test.js'), 'utf8');
const ALL_SRC = [AN_SRC, AO_SRC, AN_JSX, AO_JSX, CSS_SRC, TEST_SRC];

/* ---- Registry coverage: 20/20 + 20/20, zero skips ---- */
test('registry: 20/20 archive-notify ideas, 20/20 archive-ops ideas, zero skips', () => {
  assert.equal(WAVE65_AN_IDEAS.length, 20);
  assert.equal(WAVE65_AO_IDEAS.length, 20);
  const all = [...WAVE65_AN_IDEAS, ...WAVE65_AO_IDEAS];
  assert.equal(all.length, 40);
  const ids = all.map(i => i.id);
  assert.deepEqual(ids, Array.from({ length: 40 }, (_, k) => 52561 + k));
  for (const idea of all) {
    assert.equal(idea.skip, false, `idea ${idea.id} skipped`);
    assert.ok(idea.title && idea.title.length > 0, `idea ${idea.id} missing title`);
  }
});

/* ---- Registry titles matched against the idea bank ---- */
test('registry titles match ideas/batch6/part-03-posthunt.md', () => {
  const bank = readFileSync(join(DIR, '..', '..', '..', '..', 'ideas', 'batch6', 'part-03-posthunt.md'), 'utf8');
  for (const idea of [...WAVE65_AN_IDEAS, ...WAVE65_AO_IDEAS]) {
    const line = bank.split('\n').find(l => l.startsWith(`${idea.id}.`));
    assert.ok(line, `idea ${idea.id} not found in idea bank`);
    assert.ok(line.includes(idea.title), `idea ${idea.id} title mismatch: ${idea.title}`);
  }
});

/* ---- Spot-checks: archiveNotifyCore (52561–52580) ---- */
test('52561 planArchiveNotifications builds recipient plan', () => {
  const p = AN.planArchiveNotifications({ id: 'a1', target: 't.com', ownerEmail: 'o@x.com' }, 'pre-archive');
  assert.deepEqual(p.recipients, ['o@x.com']);
  assert.ok(p.message.includes('t.com'));
});

test('52562 checkArchiveApproval requires lead sign-off on open criticals', () => {
  const r = AN.checkArchiveApproval({ findings: [{ severity: 'critical', status: 'open' }] });
  assert.equal(r.needsApproval, true);
  const ok = AN.checkArchiveApproval({ findings: [{ severity: 'critical', status: 'fixed' }] });
  assert.equal(ok.needsApproval, false);
});

test('52563 listArchiveFiles bundles PoCs, exports, attachments', () => {
  const files = AN.listArchiveFiles({ pocBundles: ['p.zip'], exports: ['r.pdf'], attachments: [] });
  assert.ok(files.includes('p.zip') && files.includes('r.pdf') && files.includes('findings.json'));
});

test('52564 tierEvidenceBlobs splits hot vs cold', () => {
  const now = new Date().toISOString();
  const old = new Date(Date.now() - 60 * 86400000).toISOString();
  const t = AN.tierEvidenceBlobs(
    [{ id: 'h', lastAccessedAt: now }, { id: 'c', lastAccessedAt: old }],
    30
  );
  assert.deepEqual(t.hot, ['h']);
  assert.deepEqual(t.cold, ['c']);
});

test('52565 buildPartialArchiveManifest drops traffic logs', () => {
  const m = AN.buildPartialArchiveManifest({ id: 'h1' }, { dropTrafficLogs: true });
  assert.ok(m.included.includes('findings.json'));
  assert.ok(m.excluded.includes('traffic-logs/'));
});

test('52566 applyArchiveTemplate resolves one-click config', () => {
  const c = AN.applyArchiveTemplate({ name: 'Q', retentionDays: 90, tier: 'cold' }, { id: 'h1' });
  assert.equal(c.templateName, 'Q');
  assert.equal(c.retentionDays, 90);
});

test('52567 planArchiveSweep picks stale hunts', () => {
  const old = { id: 'old', lastActivityAt: new Date(Date.now() - 120 * 86400000).toISOString(), findings: [] };
  const fresh = { id: 'new', lastActivityAt: new Date().toISOString(), findings: [] };
  const s = AN.planArchiveSweep([old, fresh], { inactiveDays: 90, maxOpenFindings: 0 });
  assert.deepEqual(s.toArchive, ['old']);
});

test('52568 searchAcrossArchives finds matching findings', () => {
  const r = AN.searchAcrossArchives(
    [{ id: 'a1', target: 't', findings: [{ title: 'XSS here', description: '' }] }],
    'xss'
  );
  assert.equal(r.length, 1);
  assert.equal(r[0].finding.title, 'XSS here');
});

test('52569 computeArchiveAnalytics counts restores', () => {
  const s = AN.computeArchiveAnalytics([
    { createdAt: '2026-01-01', restoredAt: '2026-02-01' },
    { createdAt: '2026-01-15' },
  ]);
  assert.equal(s.totalArchives, 2);
  assert.equal(s.restoreRate, 0.5);
});

test('52570 complianceRetention maps PCI-DSS to 365 days', () => {
  const r = AN.complianceRetention('PCI-DSS');
  assert.equal(r.retentionDays, 365);
});

test('52571 redactForArchive masks keys and emails', () => {
  const { redacted, redactionCount } = AN.redactForArchive('key sk-abcdef1234567890 mail a@b.com');
  assert.equal(redactionCount, 2);
  assert.ok(!redacted.includes('sk-abcdef'));
});

test('52572 buildLimitedArchiveShare omits full data', () => {
  const s = AN.buildLimitedArchiveShare({ id: 'a1', target: 't', summary: 's', archivedAt: 'x' });
  assert.equal(s.archiveId, 'a1');
  assert.ok(s.note.includes('Summary only'));
});

test('52573 detectDuplicateArchive warns on hash match', () => {
  const w = AN.detectDuplicateArchive(
    { target: 't', findingHash: 'h' },
    [{ id: 'old', target: 't', findingHash: 'h' }]
  );
  assert.ok(w && w.duplicateOf === 'old');
  assert.equal(AN.detectDuplicateArchive({ target: 't', findingHash: 'z' }, []), null);
});

test('52574 autoNameArchive follows pattern', () => {
  const n = AN.autoNameArchive({ target: 'Acme.com', id: 'hunt-12345678' });
  assert.ok(n.startsWith('acme-com-'));
  assert.ok(n.endsWith('hunt-123'));
});

test('52575 archiveFolderPath builds client/year path', () => {
  assert.equal(AN.archiveFolderPath({ client: 'acme', createdAt: '2026-03-01' }), 'acme/2026');
});

test('52576 validateArchiveApiRequest rejects bad input', () => {
  assert.equal(AN.validateArchiveApiRequest({ action: 'bogus', apiKey: 'k' }).valid, false);
  assert.equal(AN.validateArchiveApiRequest({ action: 'restore', apiKey: 'k' }).valid, false);
  assert.equal(AN.validateArchiveApiRequest({ action: 'restore', archiveId: 'a', apiKey: 'k' }).valid, true);
});

test('52577 buildArchiveWebhook namespaced event', () => {
  const h = AN.buildArchiveWebhook('restored', { id: 'a1', target: 't' });
  assert.equal(h.event, 'archive.restored');
});

test('52578 preArchiveReviewReminder counts open findings', () => {
  const r = AN.preArchiveReviewReminder({ id: 'h1', findings: [{ status: 'open' }, { status: 'fixed' }] }, 'soon');
  assert.equal(r.openFindings, 1);
});

test('52579 requestArchiveRestore creates pending ticket', () => {
  const t = AN.requestArchiveRestore({ archiveId: 'a1', requester: 'd@x.com' });
  assert.equal(t.status, 'pending-owner-approval');
  assert.ok(t.ticketId.startsWith('restore-'));
});

test('52580 transferArchiveOwnership records handoff', () => {
  const t = AN.transferArchiveOwnership({ id: 'a1', ownerEmail: 'old@x.com' }, 'new@x.com', 'left');
  assert.equal(t.previousOwner, 'old@x.com');
  assert.equal(t.newOwner, 'new@x.com');
});

/* ---- Spot-checks: archiveOpsCore (52581–52600) ---- */
test('52581 planArchiveMigration lists verify steps', () => {
  const p = AO.planArchiveMigration({ id: 'a1' }, 's3', 'glacier');
  assert.ok(p.steps.includes('verify-checksums'));
  assert.equal(p.to, 'glacier');
});

test('52582 perTeamArchiveStats aggregates bytes', () => {
  const s = AO.perTeamArchiveStats([
    { team: 'red', sizeBytes: 100 },
    { team: 'red', sizeBytes: 200 },
  ]);
  assert.equal(s.red.count, 2);
  assert.equal(s.red.bytes, 300);
});

test('52583 checkArchiveQuota warns at 80 percent', () => {
  assert.equal(AO.checkArchiveQuota({ usedBytes: 50, quotaBytes: 100, workspace: 'w' }).status, 'ok');
  assert.equal(AO.checkArchiveQuota({ usedBytes: 85, quotaBytes: 100, workspace: 'w' }).status, 'warning');
  assert.equal(AO.checkArchiveQuota({ usedBytes: 99, quotaBytes: 100, workspace: 'w' }).status, 'critical');
});

test('52584 suggestArchiveCleanup flags old and duplicate', () => {
  const s = AO.suggestArchiveCleanup([
    { id: 'a1', ageDays: 400 },
    { id: 'a2', ageDays: 10 },
    { id: 'a3', ageDays: 10, isDuplicate: true },
  ]);
  assert.equal(s.length, 2);
});

test('52585 writeTimeCapsuleSummary narrates the hunt', () => {
  const t = AO.writeTimeCapsuleSummary({
    target: 't.com',
    startedAt: 's',
    finishedAt: 'e',
    findings: [{ severity: 'critical' }],
    headline: 'big one',
  });
  assert.ok(t.includes('t.com') && t.includes('big one'));
});

test('52586 preserveLinkedHunts keeps regression links', () => {
  const a = AO.preserveLinkedHunts({ id: 'a1' }, [{ type: 'regression', id: 'r1' }]);
  assert.deepEqual(a.linkedHunts, [{ type: 'regression', id: 'r1' }]);
});

test('52587 archiveChatTranscripts bundles messages', () => {
  const b = AO.archiveChatTranscripts([{ role: 'user', text: 'hi', at: 't' }]);
  assert.equal(b.count, 1);
});

test('52588 archiveReasoningTraces bundles traces', () => {
  const b = AO.archiveReasoningTraces([{ step: 1, decision: 'd', rationale: 'r', at: 't' }]);
  assert.equal(b.count, 1);
});

test('52589 snapshotReport marks immutable', () => {
  const s = AO.snapshotReport({ pdfUrl: 'u', generatedAt: 'g', hash: 'h' });
  assert.equal(s.immutable, true);
  assert.equal(s.hash, 'h');
});

test('52590 scheduleRestoreTest plans sandbox restore', () => {
  const t = AO.scheduleRestoreTest({ id: 'a1' });
  assert.ok(t.steps.includes('restore-to-sandbox'));
});

test('52591 buildExportManifest sums bytes', () => {
  const m = AO.buildExportManifest([
    { path: 'a', hash: 'h1', bytes: 10 },
    { path: 'b', hash: 'h2', bytes: 20 },
  ]);
  assert.equal(m.totalBytes, 30);
  assert.equal(m.fileCount, 2);
});

test('52592 archiveExpiryWarnings fires at thresholds', () => {
  const soon = { retentionExpiresAt: new Date(Date.now() + 5 * 86400000).toISOString() };
  const w = AO.archiveExpiryWarnings(soon);
  assert.ok(w.length >= 1);
  const far = { retentionExpiresAt: new Date(Date.now() + 400 * 86400000).toISOString() };
  assert.equal(AO.archiveExpiryWarnings(far).length, 0);
});

test('52593 filterArchives filters by target and severity', () => {
  const a = [
    { target: 'acme.com', topSeverity: 'critical', createdAt: '2026-01-01' },
    { target: 'other.com', topSeverity: 'low', createdAt: '2026-01-01' },
  ];
  assert.equal(AO.filterArchives(a, { target: 'acme', severity: 'critical' }).length, 1);
});

test('52594 planRestoreReindex covers search diff analytics', () => {
  const p = AO.planRestoreReindex({ id: 'a1' });
  assert.deepEqual(p.indexes, ['search', 'diff', 'analytics']);
});

test('52595 buildHuntCompletionEmail addresses stakeholders', () => {
  const e = AO.buildHuntCompletionEmail({ id: 'h1', target: 't.com', findings: [{}, {}] }, ['s@x.com']);
  assert.deepEqual(e.to, ['s@x.com']);
  assert.ok(e.subject.includes('2 findings'));
});

test('52596 renderEmailTemplate substitutes variables', () => {
  assert.equal(AO.renderEmailTemplate('Hi {{name}}!', { name: 'Sam' }), 'Hi Sam!');
  assert.equal(AO.renderEmailTemplate('Hi {{missing}}!', {}), 'Hi {{missing}}!');
});

test('52597 buildExecSummaryEmail is jargon-free', () => {
  const e = AO.buildExecSummaryEmail({ target: 't', riskScore: 9, findings: [{ severity: 'critical' }] });
  assert.ok(e.body.includes('Decision needed'));
});

test('52598 buildEngineerDetailEmail lists top findings', () => {
  const e = AO.buildEngineerDetailEmail({
    target: 't',
    findings: [{ title: 'XSS', severity: 'high', evidenceUrl: '/e' }],
  });
  assert.ok(e.body.includes('XSS'));
});

test('52599 attachPdfToEmail picks exec pdf', () => {
  const e = AO.attachPdfToEmail({ subject: 's', body: 'b' }, 'exec', { exec: '/e.pdf', technical: '/t.pdf' });
  assert.equal(e.attachments[0].url, '/e.pdf');
});

test('52600 buildLinkOnlyEmail contains no details', () => {
  const e = AO.buildLinkOnlyEmail({ target: 't' }, 'https://s/x');
  assert.equal(e.containsDetails, false);
  assert.ok(e.body.includes('https://s/x'));
});

/* ---- Real esbuild JSX parse audit ---- */
test('real esbuild parse of both JSX files', () => {
  for (const f of ['ArchiveNotify.jsx', 'ArchiveOps.jsx']) {
    execFileSync(
      'npx',
      ['esbuild', `--loader:.jsx=jsx`, '--format=esm', `--outfile=/dev/null`, join(DIR, f)],
      { stdio: 'pipe' }
    );
  }
});

/* ---- CSS audit: scoped prefixes only, zero keyframes, no global rules ---- */
test('Wave65.css: only .an65-/.ao65- selectors, zero @keyframes, no global rules', () => {
  const classSelectors = [...CSS_SRC.matchAll(/^\s*\.([a-zA-Z0-9_-]+)\s*[{,]/gm)].map(m => m[1]);
  assert.ok(classSelectors.length > 0, 'expected class selectors');
  for (const sel of classSelectors) {
    assert.ok(sel.startsWith('an65-') || sel.startsWith('ao65-'), `unscoped selector .${sel}`);
  }
  assert.ok(!/@keyframes/i.test(CSS_SRC), 'zero-animation order: no @keyframes');
  assert.ok(!/transition\s*:/i.test(CSS_SRC), 'zero-animation order: no transitions');
  assert.ok(!/animation\s*:/i.test(CSS_SRC), 'zero-animation order: no animations');
  assert.ok(!/^\s*(html|body|\*)\s*[{,]/m.test(CSS_SRC), 'no global element selectors');
  assert.ok(/!important/.test(CSS_SRC) === false, 'no !important');
});

test('Wave65.css: both prefixes have the shared layout primitives', () => {
  for (const prefix of ['an65', 'ao65']) {
    for (const cls of ['gallery', 'card', 'title', 'note', 'small', 'mono', 'badge']) {
      assert.ok(new RegExp(`\\.${prefix}-${cls}\\b`).test(CSS_SRC), `missing .${prefix}-${cls}`);
    }
  }
});

/* ---- Branding audit: Infinity AI only, never Muse ---- */
test('branding: no "Muse" anywhere; "Infinity AI" present where branded', () => {
  for (const [name, src] of [
    ['anCore', AN_SRC],
    ['aoCore', AO_SRC],
    ['anJsx', AN_JSX],
    ['aoJsx', AO_JSX],
    ['css', CSS_SRC],
  ]) {
    assert.ok(!/Muse/i.test(src), `${name} leaks "Muse" branding`);
  }
  for (const [name, src] of [
    ['anCore', AN_SRC],
    ['aoCore', AO_SRC],
    ['anJsx', AN_JSX],
    ['aoJsx', AO_JSX],
    ['css', CSS_SRC],
  ]) {
    assert.ok(/Infinity AI/.test(src), `${name} missing "Infinity AI" branding`);
  }
});

/* ---- Debris audit: no TODO/FIXME/mock/demo/debris ---- */
test('no TODO/FIXME/mock/demo/debris in any wave-65 file', () => {
  const bad = /\b(TODO|FIXME|XXX|HACK|lorem ipsum|not implemented)\b/i;
  for (const [name, src] of [
    ['anCore', AN_SRC],
    ['aoCore', AO_SRC],
    ['anJsx', AN_JSX],
    ['aoJsx', AO_JSX],
    ['css', CSS_SRC],
  ]) {
    assert.ok(!bad.test(src), `${name} contains debris marker`);
    assert.ok(!/\bmock\b/i.test(src) || /no mock/i.test(src), `${name} mentions mock`);
  }
});
