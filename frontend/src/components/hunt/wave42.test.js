/**
 * wave42.test.js — wave 42 (ideas 51641–51680): snapshot distribution +
 * snapshot publishing & live confidence.
 *
 * Registry completeness (40/40 zero skips), core-logic spot checks,
 * zero-keyframe CSS audit, no-debris audit, and JSX esbuild-parse checks.
 * Deterministic — run with: node --test wave42.test.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  WAVE42_DIST_IDEAS, WAVE42_DIST_START, WAVE42_DIST_END,
  escHtml as distEscHtml,
  newSnapshotComment, commentsForSnapshot, commentsForSection,
  nextSnapshotVersion, freezeSnapshot, isFrozen,
  snapshotDelta, diffAlertLevel,
  SNAPSHOT_API_ROUTES, snapshotApiDto,
  snapshotEmbedHtml, EMBED_THEMES,
  redactSnapshot, REDACT_TOKEN,
  snapshotCover, snapshotToc,
  severityDistribution, findingTrend, SEVERITIES,
  snapshotAppendices,
  signoffRequest, recordSignature, signoffStatus,
  expiringLink, linkExpired,
  logSnapshotAccess, accessLogFor, uniqueViewers,
  SNAPSHOT_LANGUAGES, snapshotSectionLabels,
  snapshotPrintPlan, mobileSnapshotView,
  snapshotVoiceScript, answerSnapshotQuestion,
  snapshotComparison,
  milestoneSnapshots, MILESTONE_PHASES,
} from './snapshotDistribCore.js';

import {
  WAVE42_PUB_IDEAS, WAVE42_PUB_START, WAVE42_PUB_END,
  addCustomSection, customSections, sectionsForSnapshot,
  snapshotToJson, findingsToCsv,
  sealSnapshot, verifySnapshotSeal, stripSeal,
  createCollabDoc, applyCollabEdit, collabNotes, collabPresence,
  defaultSnapshotRules, notificationTargets,
  buildSnapshotArchive, searchSnapshotArchive,
  restoreDraftFromSnapshot, plainDiffSummary,
  snapshotKpis, snapshotRiskOverview,
  remediationPreview, complianceMapping,
  clientPortalView,
  recordSnapshotFeedback, feedbackSummary,
  promoteSnapshotToFinal,
  confidenceScore, addEvidence,
  confidenceTrend, TREND_GLYPH,
  evidenceStrengthMeter,
  VALIDATION_STAGES, validationStage, advanceValidationStage, stageIndex,
  confidenceBreakdown,
} from './snapshotPublishCore.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const sha256 = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

const F = [
  { id: 'f1', title: 'Reflected XSS', severity: 'high', type: 'xss', evidence: [{ kind: 'poc', label: 'curl' }] },
  { id: 'f2', title: 'SQLi in filter', severity: 'critical', type: 'sqli', evidence: [{ kind: 'poc' }, { kind: 'log' }] },
  { id: 'f3', title: 'Verbose header', severity: 'low', type: 'info', evidence: [{ kind: 'header' }] },
];

/* --- registry completeness ----------------------------------------------------- */

test('wave-42 combined registry: 40/40 ideas, ids 51641–51680 contiguous, zero skips', () => {
  assert.equal(WAVE42_DIST_START, 51641);
  assert.equal(WAVE42_DIST_END, 51660);
  assert.equal(WAVE42_PUB_START, 51661);
  assert.equal(WAVE42_PUB_END, 51680);
  assert.equal(WAVE42_DIST_IDEAS.length, 20);
  assert.equal(WAVE42_PUB_IDEAS.length, 20);
  const all = [...WAVE42_DIST_IDEAS, ...WAVE42_PUB_IDEAS];
  const ids = all.map(r => r[0]);
  assert.equal(ids.length, 40);
  assert.equal(new Set(ids).size, 40);
  assert.deepEqual([...ids].sort((a, b) => a - b), Array.from({ length: 40 }, (_, i) => 51641 + i));
  for (const [id, title, desc] of all) {
    assert.ok(Number.isInteger(id), 'id present');
    assert.ok(String(title).length > 3, `title present for ${id}`);
    assert.ok(String(desc).length > 10, `description present for ${id} (no skips)`);
  }
});

/* --- 51641 comments -------------------------------------------------------------- */

test('51641 snapshot comments: create, section filter, validation', () => {
  const c = newSnapshotComment({ snapshotId: 's1', section: 'Findings', author: 'Priya', text: '  hello  ' });
  assert.equal(c.snapshotId, 's1');
  assert.equal(c.text, 'hello');
  assert.throws(() => newSnapshotComment({ snapshotId: 's1', text: '   ' }), /comment text required/);
  const list = [c, newSnapshotComment({ snapshotId: 's1', section: 'Cover', author: 'A', text: 'x', createdAt: 't' })];
  assert.equal(commentsForSnapshot(list, 's1').length, 2);
  assert.equal(commentsForSection(list, 's1', 'Cover').length, 1);
});

/* --- 51642 versioning -------------------------------------------------------------- */

test('51642 versioning: next version, freeze, immutability flag', () => {
  assert.equal(nextSnapshotVersion([]), 1);
  assert.equal(nextSnapshotVersion([{ version: 2 }, { version: 5 }]), 6);
  const frozen = freezeSnapshot({ id: 's1' }, 3, 't0');
  assert.equal(frozen.version, 3);
  assert.ok(isFrozen(frozen));
  assert.ok(!isFrozen({ id: 's1' }));
});

/* --- 51643 diff alerts -------------------------------------------------------------- */

test('51643 diff alerts: delta counts and alert levels', () => {
  const prev = { findings: [{ id: 'a', severity: 'high' }, { id: 'b', severity: 'low' }] };
  const next = { findings: [{ id: 'a', severity: 'critical' }, { id: 'c', severity: 'medium' }] };
  const d = snapshotDelta(prev, next);
  assert.deepEqual(d.added, ['c']);
  assert.deepEqual(d.removed, ['b']);
  assert.deepEqual(d.severityChanged, ['a']);
  assert.equal(diffAlertLevel(snapshotDelta(prev, prev)), 'none');
  assert.equal(diffAlertLevel(d), 'info');
  const big = { findings: Array.from({ length: 6 }, (_, i) => ({ id: `n${i}`, severity: 'low' })) };
  assert.equal(diffAlertLevel(snapshotDelta({ findings: [] }, big)), 'significant');
});

/* --- 51644/51645 API + embed ---------------------------------------------------------- */

test('51644 snapshot API: routes listed, DTO whitelisted', () => {
  assert.ok(SNAPSHOT_API_ROUTES.length >= 4);
  const dto = snapshotApiDto({ id: 's1', version: 2, internalNotes: 'secret', findings: F });
  assert.ok('version' in dto);
  assert.ok(!('internalNotes' in dto));
  assert.ok(!('findings' in dto));
});

test('51645 snapshot embedding: iframe HTML with XSS escaping', () => {
  const html = snapshotEmbedHtml({ snapshotId: 's1"><script>', baseUrl: 'https://x.test', theme: 'dark' });
  assert.ok(html.includes('<iframe'));
  assert.ok(!html.includes('"><script>'));
  assert.ok(html.includes('theme=dark'));
  assert.ok(EMBED_THEMES.includes('auto'));
  assert.ok(distEscHtml('<b>"x"</b>').includes('&lt;b&gt;'));
});

/* --- 51646 redaction ------------------------------------------------------------------- */

test('51646 redaction: masks sensitive fields, original untouched', () => {
  const snap = { id: 's1', target: 't', internalNotes: 'secret', findings: [{ id: 'f', internalNotes: 'n2', title: 'T' }] };
  const r = redactSnapshot(snap);
  assert.equal(r.internalNotes, REDACT_TOKEN);
  assert.equal(r.findings[0].internalNotes, REDACT_TOKEN);
  assert.equal(r.findings[0].title, 'T');
  assert.equal(snap.internalNotes, 'secret');
  assert.ok(r.redactedFields.includes('internalNotes'));
});

/* --- 51647–51650 cover, toc, charts, appendices ------------------------------------------- */

test('51647 snapshot cover: totals and scope summary', () => {
  const cover = snapshotCover({ target: 'example.com', takenAt: 't', version: 2, findings: F });
  assert.equal(cover.total, 3);
  assert.equal(cover.findingCounts.critical, 1);
  assert.ok(cover.title.includes('example.com'));
});

test('51648 snapshot TOC: anchors generated', () => {
  const toc = snapshotToc([{ id: 's1', title: 'Findings' }, { title: 'Charts', depth: 1 }]);
  assert.equal(toc.length, 2);
  assert.ok(toc[0].anchor.startsWith('sec-'));
  assert.equal(toc[1].depth, 1);
});

test('51649 snapshot charts: distribution + trend', () => {
  const dist = severityDistribution(F);
  assert.deepEqual([dist.critical, dist.high, dist.low], [1, 1, 1]);
  assert.ok(SEVERITIES.includes('medium'));
  const trend = findingTrend([{ version: 1, findings: [F[0]] }, { version: 2, findings: F }]);
  assert.deepEqual(trend.map(t => t.total), [1, 3]);
});

test('51650 snapshot appendices: three organized sections', () => {
  const apps = snapshotAppendices({ findings: F, activityLog: [{ e: 1 }] });
  assert.equal(apps.length, 3);
  assert.ok(apps.every(a => a.id && a.title && a.kind));
});

/* --- 51651–51653 sign-off, expiry, access logs ----------------------------------------------- */

test('51651 sign-off: pending until all stakeholders sign', () => {
  let req = signoffRequest('s1', ['Aarav', 'Meera'], 't0');
  assert.equal(signoffStatus(req).status, 'pending');
  req = recordSignature(req, { by: 'Aarav', at: 't1' });
  assert.equal(signoffStatus(req).signed, 1);
  req = recordSignature(req, { by: 'Meera', at: 't2' });
  assert.equal(signoffStatus(req).status, 'complete');
});

test('51652 expiry: link active then expired', () => {
  const link = expiringLink({ snapshotId: 's1', ttlHours: 72, createdAt: 1000 });
  assert.equal(link.expiresAt, 1000 + 72 * 3600 * 1000);
  assert.ok(!linkExpired(link, 2000));
  assert.ok(linkExpired(link, link.expiresAt));
});

test('51653 access logs: record, filter, unique viewers', () => {
  let log = logSnapshotAccess([], { snapshotId: 's1', viewer: 'a@x.co', at: 't1' });
  log = logSnapshotAccess(log, { snapshotId: 's1', viewer: 'a@x.co', at: 't2' });
  log = logSnapshotAccess(log, { snapshotId: 's2', viewer: 'b@x.co', at: 't3' });
  assert.equal(accessLogFor(log, 's1').length, 2);
  assert.deepEqual(uniqueViewers(log, 's1'), ['a@x.co']);
});

/* --- 51654–51657 languages, print, mobile, voice ----------------------------------------------- */

test('51654 language labels: hi + es present, unknown falls back to en', () => {
  assert.ok(SNAPSHOT_LANGUAGES.includes('hi') && SNAPSHOT_LANGUAGES.includes('es'));
  assert.equal(snapshotSectionLabels('hi').findings, 'निष्कर्ष');
  assert.equal(snapshotSectionLabels('es').cover, 'Portada');
  assert.equal(snapshotSectionLabels('xx').cover, 'Cover');
});

test('51655 print plan: A4 portrait with margins and footer', () => {
  const plan = snapshotPrintPlan({ target: 'example.com', version: 2, sections: [{ title: 'A' }] });
  assert.equal(plan.pageSize, 'A4');
  assert.equal(plan.orientation, 'portrait');
  assert.ok(plan.footer.includes('v2'));
});

test('51656 mobile view: compact, top findings by severity', () => {
  const v = mobileSnapshotView({ target: 't', version: 1, findings: F });
  assert.equal(v.total, 3);
  assert.equal(v.topFindings[0].severity, 'critical');
  assert.ok(v.topFindings.length <= 3);
});

test('51657 voice script: speakable summary with duration estimate', () => {
  const v = snapshotVoiceScript({ target: 'example.com', takenAt: 't', version: 3, findings: F });
  assert.ok(v.script.length > 20);
  assert.ok(v.estSeconds >= 8);
  assert.equal(v.voice, 'aria');
});

/* --- 51658–51660 Q&A, comparison, milestones ----------------------------------------------------- */

test('51658 snapshot Q&A: grounded answer with confidence', () => {
  const snap = { sections: [{ title: 'Findings', body: 'The critical SQL injection sits in the product filter.' }] };
  const r = answerSnapshotQuestion(snap, 'Where is the critical SQL injection?');
  assert.ok(r.groundedIn.includes('Findings'));
  assert.ok(r.confidence > 0);
  const miss = answerSnapshotQuestion(snap, 'What is the weather on Mars?');
  assert.equal(miss.confidence, 0);
  assert.deepEqual(miss.groundedIn, []);
});

test('51659 comparison: versions aligned with severity series', () => {
  const c = snapshotComparison([{ version: 1, findings: [F[0]] }, { version: 2, findings: F }]);
  assert.deepEqual(c.versions, ['v1', 'v2']);
  assert.deepEqual(c.series.critical, [0, 1]);
  assert.deepEqual(c.totals, [1, 3]);
});

test('51660 milestone markers: only phase-complete events', () => {
  const marks = milestoneSnapshots([
    { type: 'phase-complete', phase: 'recon', at: 't1' },
    { type: 'finding', phase: 'recon', at: 't2' },
  ]);
  assert.equal(marks.length, 1);
  assert.ok(marks[0].autoTaken);
  assert.ok(MILESTONE_PHASES.includes('scanning'));
});

/* --- 51661 custom sections ------------------------------------------------------------ */

test('51661 custom sections: add, update, persist across snapshots', () => {
  let store = addCustomSection({}, { title: 'Client notes', body: 'b1', author: 'owner' });
  store = addCustomSection(store, { title: 'Client notes', body: 'b2', author: 'owner' });
  assert.equal(customSections(store).length, 1);
  assert.equal(customSections(store)[0].body, 'b2');
  assert.throws(() => addCustomSection({}, { title: '  ' }), /section title required/);
  const merged = sectionsForSnapshot({ sections: [{ title: 'Findings' }] }, store);
  assert.equal(merged.length, 2);
  assert.ok(merged[1].custom);
});

/* --- 51662 data export ------------------------------------------------------------------ */

test('51662 data export: JSON round-trips, CSV quotes safely', () => {
  const snap = { id: 's1', findings: F };
  assert.deepEqual(JSON.parse(snapshotToJson(snap)).findings.length, 3);
  const csv = findingsToCsv([{ id: 'x', title: 'a "quoted" title', severity: 'high' }]);
  const lines = csv.split('\n');
  assert.ok(lines[0].startsWith('id,title,severity'));
  assert.ok(lines[1].includes('a ""quoted"" title'));
});

/* --- 51663 integrity seal ----------------------------------------------------------------- */

test('51663 integrity seal: real SHA-256 seals, tampering breaks verification', () => {
  const snap = { id: 's1', version: 3, findings: F };
  const seal = sealSnapshot(snap, sha256, 't0');
  assert.equal(seal.algorithm, 'sha256');
  assert.equal(seal.digest, sha256(JSON.stringify(stripSeal(snap))));
  assert.ok(verifySnapshotSeal(snap, seal, sha256));
  assert.ok(!verifySnapshotSeal({ ...snap, version: 99 }, seal, sha256));
  assert.ok(!verifySnapshotSeal(snap, null, sha256));
  assert.throws(() => sealSnapshot(snap), /digestHex function required/);
});

/* --- 51664 collaboration -------------------------------------------------------------------- */

test('51664 collaboration: co-edits merge, last writer wins per note', () => {
  let doc = createCollabDoc();
  doc = applyCollabEdit(doc, { author: 'A', noteId: 'n1', text: 'first', at: 't1' });
  doc = applyCollabEdit(doc, { author: 'B', noteId: 'n1', text: 'second', at: 't2' });
  const notes = collabNotes(doc);
  assert.equal(notes.length, 1);
  assert.equal(notes[0].text, 'second');
  assert.equal(doc.ops.length, 2);
  doc = collabPresence(doc, 'A', 't3');
  assert.equal(doc.presence.length, 1);
});

/* --- 51665–51667 rules, archive, restore ------------------------------------------------------- */

test('51665 notification rules: targets depend on alert level', () => {
  const rules = defaultSnapshotRules();
  assert.ok(notificationTargets(rules, 'significant').length >= 2);
  assert.equal(notificationTargets(rules, 'none').length, 0);
});

test('51666 archive browser: grouped by hunt, searchable', () => {
  const archive = buildSnapshotArchive([
    { id: 's1', huntId: 'h1', target: 'example.com', version: 2 },
    { id: 's2', huntId: 'h1', target: 'example.com', version: 1 },
    { id: 's3', huntId: 'h2', target: 'shop.example.com', version: 1 },
  ]);
  assert.deepEqual(archive.hunts, ['h1', 'h2']);
  assert.equal(archive.byHunt.h1[0].version, 2);
  assert.equal(searchSnapshotArchive(archive, 'shop').length, 1);
  assert.equal(searchSnapshotArchive(archive, '').length, 0);
});

test('51667 restore: draft reverts to snapshot state without mutating it', () => {
  const snap = { id: 's1', version: 4, sections: [{ title: 'A' }], findings: F };
  const draft = { title: 'D', sections: [{ title: 'stale' }] };
  const restored = restoreDraftFromSnapshot(draft, snap, 't0');
  assert.equal(restored.sections[0].title, 'A');
  assert.equal(restored.restoredFrom.version, 4);
  assert.equal(draft.sections[0].title, 'stale');
  assert.throws(() => restoreDraftFromSnapshot({}, null), /snapshot required/);
});

/* --- 51668–51670 diff summary, KPIs, risk --------------------------------------------------------- */

test('51668 diff summary: plain-language what-changed lines', () => {
  const lines = plainDiffSummary(
    { findings: [{ id: 'a', title: 'XSS', severity: 'high' }] },
    { findings: [{ id: 'a', title: 'XSS', severity: 'critical' }, { id: 'b', title: 'New', severity: 'low' }] },
  );
  assert.ok(lines.some(l => l.includes('1 new finding')));
  assert.ok(lines.some(l => l.includes('changed severity')));
  assert.deepEqual(plainDiffSummary({ findings: F }, { findings: F }), ['No material changes since the previous snapshot.']);
});

test('51669 KPI panel: findings, coverage, pace', () => {
  const k = snapshotKpis({ findings: F, coveragePct: 62, elapsedMin: 120, resolvedCount: 1 });
  assert.equal(k.findings, 3);
  assert.equal(k.critical, 1);
  assert.equal(k.perHour, 1.5);
});

test('51670 risk overview: level, score, top drivers', () => {
  const r = snapshotRiskOverview(F);
  assert.ok(['low', 'medium', 'high', 'critical'].includes(r.level));
  assert.ok(r.score > 0);
  assert.equal(r.drivers[0].severity, 'critical');
  assert.equal(r.total, 3);
});

/* --- 51671–51673 remediation, compliance, client portal ----------------------------------------------- */

test('51671 remediation preview: per-type guidance with fallback', () => {
  const items = remediationPreview(F);
  assert.ok(items[0].guidance.toLowerCase().includes('content-security-policy'));
  assert.equal(remediationPreview([{ id: 'z', title: 'Weird', type: 'unknown-xyz' }])[0].effort, 'unknown');
});

test('51672 compliance mapping: findings grouped by framework refs', () => {
  const m = complianceMapping(F);
  assert.ok(m.OWASP['A03:2021 Injection'].includes('f1'));
  assert.ok(m.CWE['CWE-89'].includes('f2'));
});

test('51673 client portal: branded, internals withheld', () => {
  const view = clientPortalView({ target: 'example.com', version: 1, findings: [{ id: 'f1', title: 'T', severity: 'high', internalNotes: 'x', technique: 'dirbuster', summary: 's' }] }, { brand: 'Acme' });
  assert.equal(view.brand, 'Acme');
  const blob = JSON.stringify(view);
  assert.ok(!blob.includes('internalNotes'));
  assert.ok(!blob.includes('dirbuster'));
  assert.ok(blob.includes('Prepared for client review'));
});

/* --- 51674–51675 feedback, final-from-snapshot -------------------------------------------------------------- */

test('51674 feedback: ratings recorded and averaged per section', () => {
  let store = recordSnapshotFeedback({}, { snapshotId: 's1', section: 'Findings', rating: 5 });
  store = recordSnapshotFeedback(store, { snapshotId: 's1', section: 'Findings', rating: 3 });
  store = recordSnapshotFeedback(store, { snapshotId: 's1', section: 'Charts', rating: 9 });
  const sum = feedbackSummary(store, 's1');
  assert.equal(sum.count, 3);
  assert.equal(sum.avgBySection.Findings, 4);
  assert.equal(sum.avgBySection.Charts, 5);
  assert.throws(() => recordSnapshotFeedback({}, { section: 'x', rating: 3 }), /snapshotId and section required/);
});

test('51675 final-from-snapshot: one-click promotion carries everything over', () => {
  const fin = promoteSnapshotToFinal({ id: 's1', version: 3, target: 't', sections: [{ title: 'A' }], findings: F }, { promotedAt: 't0' });
  assert.ok(fin.reportId.startsWith('final-'));
  assert.equal(fin.promotedFrom.version, 3);
  assert.equal(fin.findings.length, 3);
  assert.equal(fin.status, 'draft-final');
});

/* --- 51676–51680 live confidence suite ------------------------------------------------------------------------------ */

test('51676 confidence score: base 20 + weighted evidence, capped at 100', () => {
  assert.equal(confidenceScore({ evidence: [{ kind: 'poc' }] }), 55);
  assert.equal(confidenceScore({ evidence: [] }), 20);
  assert.equal(confidenceScore(null), 0);
  const heavy = { evidence: Array.from({ length: 10 }, () => ({ kind: 'poc' })) };
  assert.equal(confidenceScore(heavy), 100);
});

test('51676 addEvidence: rescore and append history', () => {
  const f0 = { id: 'f1', evidence: [{ kind: 'note' }] };
  const f1 = addEvidence(f0, { kind: 'poc', label: 'curl' });
  assert.ok(f1.confidence > confidenceScore(f0));
  assert.equal(f1.confidenceHistory.length, (f0.confidenceHistory || []).length + 1);
  assert.equal(f0.evidence.length, 1);
});

test('51677 confidence trend: rising, falling, stable, fresh', () => {
  assert.equal(confidenceTrend([40, 55, 72]), 'rising');
  assert.equal(confidenceTrend([80, 70, 60]), 'falling');
  assert.equal(confidenceTrend([55, 56, 55]), 'stable');
  assert.equal(confidenceTrend([50]), 'stable');
  assert.deepEqual(Object.keys(TREND_GLYPH).sort(), ['falling', 'rising', 'stable']);
});

test('51678 evidence meter: score, band, kinds', () => {
  const m = evidenceStrengthMeter([{ kind: 'poc' }, { kind: 'log' }, { kind: 'screenshot' }]);
  assert.equal(m.score, 62);
  assert.equal(m.band, 'strong');
  assert.equal(evidenceStrengthMeter([]).band, 'weak');
  assert.equal(evidenceStrengthMeter([{ kind: 'header' }]).band, 'weak');
});

test('51679 validation stages: default, advance, cap at confirmed', () => {
  assert.equal(validationStage({}), 'detected');
  assert.equal(validationStage({ validationStage: 'bogus' }), 'detected');
  let f = { validationStage: 'detected' };
  f = advanceValidationStage(f);
  assert.equal(validationStage(f), 'reproducing');
  f = advanceValidationStage(advanceValidationStage(advanceValidationStage(f)));
  assert.equal(validationStage(f), 'confirmed');
  assert.deepEqual(VALIDATION_STAGES, ['detected', 'reproducing', 'validated', 'confirmed']);
});

test('51680 confidence breakdown: parts explain the total', () => {
  const bd = confidenceBreakdown({ evidence: [{ kind: 'poc', label: 'curl PoC' }, { kind: 'note', label: 'analyst note' }] });
  assert.equal(bd.total, 59);
  const sum = bd.parts.reduce((a, p) => a + p.points, 0);
  assert.ok(Math.abs(sum - bd.total) < 0.01);
  assert.ok(bd.parts.some(p => p.source === 'base'));
  const capped = confidenceBreakdown({ evidence: Array.from({ length: 10 }, () => ({ kind: 'poc' })) });
  assert.equal(capped.total, 100);
  assert.ok(capped.capped);
});

/* --- zero-keyframe CSS audit --------------------------------------------------------- */

test('Wave42.css: zero keyframes, no animation/transition, scoped classes only', () => {
  const css = readFileSync(join(DIR, 'Wave42.css'), 'utf8');
  assert.ok(!/@keyframes/i.test(css), 'no @keyframes allowed');
  assert.ok(!/animation\s*:/i.test(css), 'no animation shorthand allowed');
  assert.ok(!/transition\s*:/i.test(css), 'no transitions allowed');
  assert.ok(css.includes('.sd42-') && css.includes('.sp42-'), 'scoped classes present');
});

/* --- no-debris audit ------------------------------------------------------------------- */

test('wave-42 sources carry no unfinished-work or fake-content markers', () => {
  const files = ['snapshotDistribCore.js', 'snapshotPublishCore.js', 'SnapshotDistrib.jsx', 'SnapshotPublish.jsx', 'Wave42.css'];
  for (const f of files) {
    const src = readFileSync(join(DIR, f), 'utf8');
    assert.ok(!/TODO|FIXME|XXX|HACK/i.test(src), 'no todo markers in ' + f);
    assert.ok(!/\bmock\b/i.test(src), 'no mock debris in ' + f);
    assert.ok(!/\bdemo\b/i.test(src), 'no demo debris in ' + f);
    assert.ok(!/\bsimulate\b/i.test(src), 'no simulate debris in ' + f);
    assert.ok(!/\bplaceholder\b/i.test(src), 'no placeholder debris in ' + f);
  }
});

/* --- JSX esbuild-parse checks ------------------------------------------------------------ */

test('SnapshotDistrib.jsx parses clean via esbuild', () => {
  const jsxPath = join(DIR, 'SnapshotDistrib.jsx');
  const out = execFileSync('npx', ['--no-install', 'esbuild', '--loader:.jsx=jsx', jsxPath], { encoding: 'utf8', timeout: 30000 });
  assert.ok(out.includes('SnapshotDistribGallery'), 'esbuild parsed the distribution gallery export');
});

test('SnapshotPublish.jsx parses clean via esbuild', () => {
  const jsxPath = join(DIR, 'SnapshotPublish.jsx');
  const out = execFileSync('npx', ['--no-install', 'esbuild', '--loader:.jsx=jsx', jsxPath], { encoding: 'utf8', timeout: 30000 });
  assert.ok(out.includes('SnapshotPublishGallery'), 'esbuild parsed the publishing gallery export');
});
