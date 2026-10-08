/**
 * wave39.test.js — wave 39 (ideas 51521–51560): finding triage collaboration
 * (51521–51540) + finding analytics & governance (51541–51560).
 *
 * Registry completeness (40/40 zero skips), core-logic spot checks,
 * zero-keyframe CSS audit, no-debris audit, and JSX esbuild-parse checks.
 * Deterministic — run with: node --test wave39.test.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WAVE39_TR_IDEAS,
  WAVE39_TR_START,
  WAVE39_TR_END,
  signatureOf,
  findDuplicates,
  mergeDuplicates,
  timelineSlots,
  timelinePosition,
  mapNodes,
  KANBAN_COLUMNS,
  emptyKanban,
  moveToColumn,
  kanbanColumnOf,
  TRIAGE_ACTIONS,
  triageAction,
  assignFinding,
  unassignFinding,
  newCommentThread,
  addComment,
  threadCount,
  watchFinding,
  unwatchFinding,
  watchersFor,
  recordVersion,
  versionHistory,
  diffVersions,
  evidencePreview,
  replayScript,
  replayStep,
  provenanceOf,
  provenanceLine,
  exportFindingMarkdown,
  exportFindingJson,
  shareToken,
  shareLink,
  printViewHtml,
  batchPrintViewHtml,
  notificationChannels,
  shouldNotify,
  notificationFor,
  quietBatch,
  isQuietCandidate,
  digestEmail,
  rssFeed,
  webhookPayload,
  webhookDelivery,
} from './findingTriageCore.js';

import {
  WAVE39_AN_IDEAS,
  WAVE39_AN_START,
  WAVE39_AN_END,
  FINDING_API_ROUTES,
  apiRouteList,
  apiFindingShape,
  WIDGET_KINDS,
  widgetPayload,
  heatmapCells,
  trendSeries,
  compareHunts,
  MILESTONES,
  milestonesReached,
  nextMilestone,
  leaderboard,
  coverageMeter,
  dedupReviewQueue,
  splitGroup,
  resolveReview,
  castVote,
  severityConsensus,
  slaStatus,
  agingAlerts,
  bulkTriage,
  bulkAssign,
  addTag,
  removeTag,
  tagsFor,
  findingsByTag,
  saveView,
  applyView,
  deleteView,
  presentationOrder,
  presentationStep,
  voiceBriefingScript,
  mobileCardPayload,
  offlineSnapshot,
  offlineDiff,
  redactFinding,
  redactionNotice,
} from './findingAnalyticsCore.js';

const F1 = {
  id: 'F-1',
  title: 'SQL injection in login form',
  type: 'sql-injection',
  severity: 'critical',
  confidence: 92,
  asset: '/api/login',
  technique: 'sqli',
  module: 'vulnDetector',
  evidence: ['e1', 'e2'],
  seq: 2,
  detectedAtMs: 1000,
  triageStatus: 'new',
};
const F2 = {
  id: 'F-2',
  title: 'SQL injection at login form',
  type: 'sql-injection',
  severity: 'critical',
  confidence: 88,
  asset: '/api/login',
  technique: 'sqli',
  module: 'vulnDetector',
  evidence: ['e3'],
  seq: 1,
  detectedAtMs: 2000,
  triageStatus: 'new',
};
const F3 = {
  id: 'F-3',
  title: 'Reflected XSS in profile',
  type: 'xss',
  severity: 'high',
  confidence: 70,
  asset: '/profile',
  technique: 'xss',
  module: 'vulnDetector',
  evidence: ['e4'],
  seq: 3,
  detectedAtMs: 3000,
  triageStatus: 'new',
};
const F4 = {
  id: 'F-4',
  title: 'Missing headers',
  type: 'headers',
  severity: 'low',
  confidence: 95,
  asset: '/',
  technique: 'headers',
  module: 'eliteRecon',
  evidence: ['e5'],
  seq: 4,
  detectedAtMs: 4000,
  triageStatus: 'new',
};
const FEED = [F1, F2, F3, F4];

// --- registry completeness ---------------------------------------------------
test('triage registry covers 51521–51540 with zero skips', () => {
  assert.equal(WAVE39_TR_IDEAS.length, 20);
  assert.equal(WAVE39_TR_START, 51521);
  assert.equal(WAVE39_TR_END, 51540);
  WAVE39_TR_IDEAS.forEach(([n, name, desc], i) => {
    assert.equal(n, 51521 + i, `consecutive at index ${i}`);
    assert.ok(name && name.length > 2, `idea ${n} has a name`);
    assert.ok(desc && desc.length > 5, `idea ${n} has a description`);
  });
});

test('analytics registry covers 51541–51560 with zero skips', () => {
  assert.equal(WAVE39_AN_IDEAS.length, 20);
  assert.equal(WAVE39_AN_START, 51541);
  assert.equal(WAVE39_AN_END, 51560);
  WAVE39_AN_IDEAS.forEach(([n, name, desc], i) => {
    assert.equal(n, 51541 + i, `consecutive at index ${i}`);
    assert.ok(name && name.length > 2, `idea ${n} has a name`);
    assert.ok(desc && desc.length > 5, `idea ${n} has a description`);
  });
});

test('wave 39 covers 40/40 ideas across both registries', () => {
  assert.equal(WAVE39_TR_IDEAS.length + WAVE39_AN_IDEAS.length, 40);
  assert.equal(WAVE39_AN_START, WAVE39_TR_END + 1);
});

// --- triage logic spot checks ----------------------------------------------
test('51521 signatureOf + findDuplicates + mergeDuplicates', () => {
  assert.equal(signatureOf(F1), signatureOf(F2));
  assert.notEqual(signatureOf(F1), signatureOf(F3));
  assert.deepEqual(findDuplicates(FEED, F1), ['F-2']);
  const merged = mergeDuplicates(FEED);
  assert.equal(merged.length, 3);
  const survivor = merged.find(f => f.mergeCount > 1);
  assert.ok(survivor);
  assert.equal(survivor.id, 'F-2');
  assert.deepEqual(survivor.mergeIds, ['F-1']);
  assert.equal(survivor.evidence.length, 3);
});

test('51522 timelineSlots + timelinePosition', () => {
  const slots = timelineSlots(FEED, 0, 2000);
  assert.equal(slots.length, 3);
  assert.equal(slots[0].count, 1);
  assert.equal(slots[1].count, 2);
  assert.equal(slots[2].count, 1);
  assert.equal(timelinePosition(500, 0, 1000), 0.5);
  assert.equal(timelinePosition(9999, 0, 1000), 1);
  assert.equal(timelinePosition(-5, 0, 1000), 0);
});

test('51523 mapNodes groups by asset with top severity', () => {
  const nodes = mapNodes(FEED, 4);
  assert.equal(nodes.length, 3);
  const login = nodes.find(n => n.asset === '/api/login');
  assert.equal(login.count, 2);
  assert.equal(login.topSeverity, 'critical');
  assert.ok(login.x >= 0 && login.x <= 4);
});

test('51524 kanban moveToColumn + kanbanColumnOf', () => {
  let b = emptyKanban();
  b = moveToColumn(b, 'F-1', 'triaging');
  assert.equal(kanbanColumnOf(b, 'F-1'), 'triaging');
  b = moveToColumn(b, 'F-1', 'confirmed');
  assert.equal(kanbanColumnOf(b, 'F-1'), 'confirmed');
  assert.equal(b.triaging.length, 0);
  assert.throws(() => moveToColumn(b, 'F-1', 'nope'), /unknown kanban column/);
  assert.deepEqual(KANBAN_COLUMNS, ['new', 'triaging', 'confirmed', 'false-positive']);
});

test('51525 triageAction transitions', () => {
  assert.equal(triageAction(F1, 'confirm').triageStatus, 'confirmed');
  assert.equal(triageAction(F1, 'dismiss').triageStatus, 'dismissed');
  assert.equal(triageAction(F1, 'escalate').triageStatus, 'escalated');
  assert.throws(() => triageAction(F1, 'hug'), /unknown triage action/);
  assert.deepEqual(TRIAGE_ACTIONS, ['confirm', 'dismiss', 'escalate']);
});

test('51526 assignFinding + unassignFinding', () => {
  const a = assignFinding(F1, 'Shubham Agarwal');
  assert.equal(a.assignee, 'Shubham Agarwal');
  assert.ok(!('assignee' in unassignFinding(a)));
  assert.throws(() => assignFinding(F1, ''), /teammate is required/);
});

test('51527 comment thread add + count', () => {
  let t = newCommentThread('F-1');
  assert.equal(threadCount(t), 0);
  t = addComment(t, { author: 'Bhavesh', text: 'looks real', tsMs: 9000 });
  assert.equal(threadCount(t), 1);
  assert.equal(t.comments[0].author, 'Bhavesh');
  assert.throws(
    () => addComment(t, { author: 'x', text: '  ', tsMs: 1 }),
    /comment text is required/
  );
});

test('51528 watchers add/remove idempotent', () => {
  let w = watchFinding([], 'F-1', 'Sukrit Chakravarty');
  w = watchFinding(w, 'F-1', 'Sukrit Chakravarty');
  assert.deepEqual(watchersFor(w, 'F-1'), ['Sukrit Chakravarty']);
  w = unwatchFinding(w, 'F-1', 'Sukrit Chakravarty');
  assert.deepEqual(watchersFor(w, 'F-1'), []);
});

test('51529 version history + diffVersions', () => {
  let h = recordVersion([], F1, 1000);
  const evolved = { ...F1, confidence: 95, triageStatus: 'triaging' };
  h = recordVersion(h, evolved, 2000);
  const versions = versionHistory(h, 'F-1');
  assert.equal(versions.length, 2);
  const diff = diffVersions(versions[0].snapshot, versions[1].snapshot);
  const fields = diff.map(d => d.field);
  assert.ok(fields.includes('confidence') && fields.includes('triageStatus'));
});

test('51530 evidencePreview slices with overflow count', () => {
  const p = evidencePreview(['a', 'b', 'c', 'd'], 2);
  assert.deepEqual(p.preview, ['a', 'b']);
  assert.equal(p.more, 2);
  assert.equal(p.total, 4);
});

test('51531 replayScript + replayStep navigation', () => {
  const f = {
    ...F1,
    steps: [
      { action: 'probe', detail: 'd1' },
      { action: 'confirm', detail: 'd2' },
    ],
  };
  const script = replayScript(f);
  assert.equal(script.length, 2);
  assert.equal(script[0].n, 1);
  const s0 = replayStep(script, 0);
  assert.equal(s0.current.action, 'probe');
  assert.equal(s0.hasNext, true);
  assert.equal(s0.hasPrev, false);
  const s1 = replayStep(script, 9);
  assert.equal(s1.index, 1);
  assert.equal(replayStep([], 0).total, 0);
});

test('51532 provenanceOf + provenanceLine', () => {
  const f = { ...F1, phase: 'exploit', module: 'vulnDetector', steeringDecision: 'depth-first' };
  const p = provenanceOf(f);
  assert.equal(p.module, 'vulnDetector');
  assert.equal(provenanceLine(p), 'exploit · vulnDetector · depth-first');
});

test('51533 exportFindingMarkdown + exportFindingJson', () => {
  const md = exportFindingMarkdown(F1);
  assert.ok(md.includes('# Finding: SQL injection in login form'));
  assert.ok(md.includes('- **Severity:** critical'));
  assert.ok(md.includes('- e1'));
  const j = JSON.parse(exportFindingJson(F1));
  assert.equal(j.id, 'F-1');
});

test('51534 shareToken stable + shareLink read-only', () => {
  assert.equal(shareToken('F-1'), shareToken('F-1'));
  const link = shareLink(F1);
  assert.ok(link.includes('/F-1?t=sh_'));
  assert.ok(link.includes('ro=1'));
});

test('51535 printViewHtml escapes + batch wraps', () => {
  const evil = { ...F1, title: '<b>evil</b>' };
  const html = printViewHtml(evil);
  assert.ok(!html.includes('<b>evil</b>'));
  assert.ok(html.includes('&lt;b&gt;evil&lt;/b&gt;'));
  const batch = batchPrintViewHtml([F1, F2], 'Night');
  assert.ok(batch.includes('Night — findings report'));
  assert.ok(batch.includes('<hr/>'));
});

test('51536 notification channels + shouldNotify + notificationFor', () => {
  assert.deepEqual(notificationChannels('critical'), ['push', 'email', 'slack']);
  assert.deepEqual(notificationChannels('low'), []);
  assert.equal(shouldNotify(F1, { threshold: 'high' }), true);
  assert.equal(shouldNotify(F4, { threshold: 'high' }), false);
  assert.equal(shouldNotify(F1, { threshold: 'low', muted: true }), false);
  const n = notificationFor(F1, { threshold: 'high' });
  assert.equal(n.findingId, 'F-1');
  assert.equal(notificationFor(F4, { threshold: 'high' }), null);
});

test('51537 quietBatch splits low findings into digest', () => {
  const { loud, digest } = quietBatch(FEED);
  assert.deepEqual(loud.map(f => f.id).sort(), ['F-1', 'F-2', 'F-3']);
  assert.deepEqual(
    digest.map(f => f.id),
    ['F-4']
  );
  assert.equal(isQuietCandidate(F4), true);
  assert.equal(isQuietCandidate(F1), false);
});

test('51538 digestEmail subject + body', () => {
  const email = digestEmail([F1, F4], 'Nightly hunt', 'hourly');
  assert.ok(email.subject.includes('2 new findings'));
  assert.ok(email.body.includes('critical: 1'));
  assert.ok(email.body.includes('low: 1'));
  assert.equal(email.count, 2);
});

test('51539 rssFeed valid XML with escaped items', () => {
  const xml = rssFeed([F1], 'Nightly hunt');
  assert.ok(xml.includes('<rss version="2.0">'));
  assert.ok(xml.includes('<title>[critical] SQL injection in login form</title>'));
  assert.ok(xml.includes('<guid>F-1</guid>'));
});

test('51540 webhookPayload + webhookDelivery', () => {
  const p = webhookPayload(F1, 'finding.created', 12000);
  assert.equal(p.event, 'finding.created');
  assert.equal(p.finding.id, 'F-1');
  assert.equal(p.tsMs, 12000);
  const d = webhookDelivery(p, 'https://hooks.example.com/x');
  assert.equal(d.contentType, 'application/json');
  assert.ok(d.idempotencyKey.startsWith('wh_'));
  assert.throws(() => webhookDelivery(p, ''), /webhook endpoint is required/);
});

// --- analytics logic spot checks -------------------------------------------
test('51541 apiRouteList + apiFindingShape whitelist', () => {
  assert.equal(FINDING_API_ROUTES.length, 6);
  assert.equal(apiRouteList()[0].method, 'GET');
  const shape = apiFindingShape({ ...F1, internalNotes: 'secret', triageStatus: 'confirmed' });
  assert.equal(shape.id, 'F-1');
  assert.equal(shape.triageStatus, 'confirmed');
  assert.ok(!('internalNotes' in shape));
});

test('51542 widgetPayload counter/list/severity-mix', () => {
  const c = widgetPayload('counter', FEED);
  assert.equal(c.total, 4);
  assert.equal(c.critical, 2);
  assert.equal(widgetPayload('list', FEED).items.length, 4);
  assert.equal(widgetPayload('severity-mix', FEED).mix.critical, 2);
  assert.throws(() => widgetPayload('pie', FEED), /unknown widget kind/);
  assert.deepEqual(WIDGET_KINDS, ['counter', 'list', 'severity-mix']);
});

test('51543 heatmapCells intensity normalized', () => {
  const cells = heatmapCells(FEED);
  assert.equal(cells[0].asset, '/api/login');
  assert.equal(cells[0].count, 2);
  assert.equal(cells[0].intensity, 1);
  assert.ok(cells[cells.length - 1].intensity < 1);
});

test('51544 trendSeries buckets by severity', () => {
  const s = trendSeries(FEED, 0, 2000, 3);
  assert.equal(s.length, 3);
  assert.equal(s[0].count, 1);
  assert.equal(s[1].count, 2);
  assert.equal(s[2].count, 1);
  assert.equal(s[1].bySeverity.critical, 1);
});

test('51545 compareHunts new/persisting/resolved', () => {
  const c = compareHunts(FEED, [{ id: 'F-1' }, { id: 'F-9' }]);
  assert.equal(c.currentCount, 4);
  assert.equal(c.newCount, 3);
  assert.equal(c.persistingCount, 1);
  assert.equal(c.resolvedCount, 1);
});

test('51546 milestonesReached + nextMilestone', () => {
  const r = milestonesReached(27);
  assert.equal(r[0].reached, true);
  assert.equal(r[1].reached, true);
  assert.equal(r[2].reached, false);
  assert.deepEqual(nextMilestone(27), { n: 50, remaining: 23 });
  assert.equal(nextMilestone(999), null);
  assert.ok(Array.isArray(MILESTONES) && MILESTONES.length > 0);
});

test('51547 leaderboard sorted desc', () => {
  const rows = leaderboard(FEED, 'technique');
  assert.equal(rows[0].key, 'sqli');
  assert.equal(rows[0].count, 2);
  const mods = leaderboard(FEED, 'module');
  assert.equal(mods[0].key, 'vulnDetector');
  assert.equal(mods[0].count, 3);
});

test('51548 coverageMeter pct + uncovered', () => {
  const c = coverageMeter(FEED, ['/api/login', '/profile', '/admin']);
  assert.equal(c.covered, 2);
  assert.equal(c.total, 3);
  assert.equal(c.pct, 67);
  assert.deepEqual(c.uncovered, ['/admin']);
});

test('51549 dedupReviewQueue + splitGroup + resolveReview', () => {
  const merged = { ...F1, mergeCount: 2, mergeIds: ['F-2'], evidence: ['e1', 'e2', 'e3'] };
  const q = dedupReviewQueue([merged, F3]);
  assert.equal(q.length, 1);
  assert.equal(q[0].decision, 'pending');
  const kept = resolveReview(q, 'F-1', 'keep');
  assert.equal(kept[0].decision, 'keep');
  const parts = splitGroup(merged);
  assert.equal(parts.length, 2);
  assert.equal(parts[0].id, 'F-1');
  assert.equal(parts[1].id, 'F-2');
  assert.equal(parts[1].splitFrom, 'F-1');
  assert.throws(() => resolveReview(q, 'F-1', 'merge'), /unknown review decision/);
});

test('51550 castVote idempotent per user + severityConsensus', () => {
  let v = castVote([], 'F-4', 'Shubham Agarwal', 'medium');
  v = castVote(v, 'F-4', 'Bhavesh', 'high');
  v = castVote(v, 'F-4', 'Shubham Agarwal', 'low');
  const c = severityConsensus(v, 'F-4');
  assert.equal(c.total, 2);
  assert.equal(c.tally.low, 1);
  assert.ok(['critical', 'high', 'medium', 'low'].includes(c.consensus));
  assert.throws(() => castVote(v, 'F-4', 'x', 'huge'), /bad severity vote/);
});

test('51551 slaStatus open/triaged/breached', () => {
  const open = slaStatus(F1, 1000 + 1800000, 3600000);
  assert.equal(open.state, 'open');
  assert.equal(open.breached, false);
  const breached = slaStatus(F1, 1000 + 7200000, 3600000);
  assert.equal(breached.state, 'breached');
  assert.equal(breached.breached, true);
  const triaged = slaStatus({ ...F1, triageStatus: 'confirmed' }, 1000 + 7200000, 3600000);
  assert.equal(triaged.state, 'triaged');
});

test('51552 agingAlerts flags stale criticals', () => {
  const stale = agingAlerts(FEED, 1000 + 7200000, 1800000);
  assert.ok(stale.some(f => f.id === 'F-1'));
  assert.ok(!stale.some(f => f.id === 'F-4'));
  const triagedFeed = FEED.map(f => ({ ...f, triageStatus: 'confirmed' }));
  assert.equal(agingAlerts(triagedFeed, 1000 + 7200000, 1800000).length, 0);
});

test('51553 bulkTriage + bulkAssign', () => {
  const r1 = bulkTriage(FEED, ['F-3', 'F-4', 'F-9'], 'confirm');
  assert.equal(r1.updated, 2);
  assert.equal(r1.findings.find(f => f.id === 'F-3').triageStatus, 'confirmed');
  const r2 = bulkAssign(FEED, ['F-3'], 'Arvind');
  assert.equal(r2.findings.find(f => f.id === 'F-3').assignee, 'Arvind');
  assert.throws(() => bulkTriage(FEED, ['F-3'], 'hug'), /unknown bulk action/);
});

test('51554 tag add/remove/filter case-insensitive', () => {
  let t = addTag([], 'F-1', 'Auth');
  t = addTag(t, 'F-1', 'auth');
  assert.deepEqual(tagsFor(t, 'F-1'), ['auth']);
  t = addTag(t, 'F-3', 'auth');
  assert.equal(findingsByTag(t, FEED, 'AUTH').length, 2);
  t = removeTag(t, 'F-1', 'auth');
  assert.deepEqual(tagsFor(t, 'F-1'), []);
  assert.throws(() => addTag(t, 'F-1', '  '), /tag is required/);
});

test('51555 saveView/applyView/deleteView', () => {
  let v = saveView([], 'criticals only', { severities: ['critical'] });
  assert.deepEqual(applyView(v, 'criticals only'), { severities: ['critical'] });
  assert.equal(applyView(v, 'missing'), null);
  v = saveView(v, 'criticals only', { severities: ['high'] });
  assert.equal(v.length, 1);
  v = deleteView(v, 'criticals only');
  assert.equal(v.length, 0);
  assert.throws(() => saveView([], '  ', {}), /view name is required/);
});

test('51556 presentationOrder severity-first + step nav', () => {
  const order = presentationOrder(FEED);
  assert.equal(order[0].severity, 'critical');
  assert.equal(order[order.length - 1].severity, 'low');
  const s = presentationStep(order, 0);
  assert.equal(s.total, 4);
  assert.equal(s.hasNext, true);
  assert.equal(presentationStep([], 0).current, null);
});

test('51557 voiceBriefingScript plain speakable lines', () => {
  const script = voiceBriefingScript(FEED, 2);
  assert.equal(script.length, 3);
  assert.ok(script[0].includes('4 findings'));
  assert.ok(!/[#*`]/.test(script.join(' ')));
});

test('51558 mobileCardPayload condensed one-liner', () => {
  const c = mobileCardPayload(F1);
  assert.equal(c.oneLine, '[critical] SQL injection in login form — /api/login');
  assert.equal(c.triageStatus, 'new');
});

test('51559 offlineSnapshot + offlineDiff', () => {
  const snap = offlineSnapshot(FEED);
  assert.equal(snap.version, 'wf39-1');
  assert.equal(snap.count, 4);
  assert.ok(snap.items.every(f => !('internalNotes' in f)));
  const diff = offlineDiff(snap, [...FEED, { ...F1, id: 'F-9' }]);
  assert.deepEqual(diff.added, ['F-9']);
  assert.deepEqual(diff.removed, []);
});

test('51560 redactFinding hides evidence + notice', () => {
  const r = redactFinding({ ...F1, steps: [{ action: 'probe', detail: 'secret payload' }] });
  assert.ok(r.evidence.every(e => e === '[redacted]'));
  assert.equal(r.steps[0].detail, '[redacted]');
  assert.equal(r.title, F1.title);
  assert.ok(redactionNotice().includes('Redaction mode'));
});

// --- audits: CSS keyframes, debris, JSX parse ---------------------------------
test('Wave39.css carries zero keyframes per the zero-animation order', async () => {
  const { readFile } = await import('node:fs/promises');
  const css = await readFile(new URL('./Wave39.css', import.meta.url), 'utf8');
  assert.ok(!/@keyframes/i.test(css), 'zero keyframes');
});

test('all five wave-39 source files have no TODO/FIXME/debris', async () => {
  const { readFile } = await import('node:fs/promises');
  const files = [
    './findingTriageCore.js',
    './findingAnalyticsCore.js',
    './FindingTriage.jsx',
    './FindingAnalytics.jsx',
    './Wave39.css',
  ];
  for (const f of files) {
    const src = await readFile(new URL(f, import.meta.url), 'utf8');
    assert.ok(!/\bTODO\b|\bFIXME\b/i.test(src), `no TODO/FIXME in ${f}`);
    assert.ok(!/\bmock\b/i.test(src), `no mock debris in ${f}`);
    assert.ok(!/\bdemo\b/i.test(src), `no demo debris in ${f}`);
    assert.ok(!/\bsimulate\b/i.test(src), `no simulate debris in ${f}`);
    assert.ok(!/\bplaceholder\b/i.test(src), `no placeholder debris in ${f}`);
  }
});

test('FindingTriage.jsx parses clean via esbuild', async () => {
  const { execFileSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const jsxPath = fileURLToPath(new URL('./FindingTriage.jsx', import.meta.url));
  const out = execFileSync('npx', ['--no-install', 'esbuild', '--loader:.jsx=jsx', jsxPath], {
    encoding: 'utf8',
    timeout: 30000,
  });
  assert.ok(out.includes('FindingTriageGallery'), 'esbuild parsed the triage gallery export');
});

test('FindingAnalytics.jsx parses clean via esbuild', async () => {
  const { execFileSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const jsxPath = fileURLToPath(new URL('./FindingAnalytics.jsx', import.meta.url));
  const out = execFileSync('npx', ['--no-install', 'esbuild', '--loader:.jsx=jsx', jsxPath], {
    encoding: 'utf8',
    timeout: 30000,
  });
  assert.ok(out.includes('FindingAnalyticsGallery'), 'esbuild parsed the analytics gallery export');
});
