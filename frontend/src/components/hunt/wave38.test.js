/**
 * wave38.test.js — wave 38 (ideas 51481–51520): test-request lifecycle round 2
 * (51481–51508) + live findings feed round 1 (51509–51520).
 *
 * Registry completeness (40/40 zero skips), core-logic spot checks,
 * zero-keyframe CSS audit, no-debris audit, and JSX esbuild-parse checks.
 * Deterministic — run with: node --test wave38.test.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WAVE38_TL_IDEAS, WAVE38_TL_START, WAVE38_TL_END,
  WAVE38_IDEAS,
  streamEvent, stepRendererState,
  killSwitchRequest, applyKill,
  followUpRequest,
  promoteTestToFinding,
  labelTest,
  newCommentThread, addComment, resolveComment,
  requestApiPayload, validateApiPayload,
  quotaStatus,
  TECHNIQUE_INFO, techniqueInfo,
  riskBadge,
  rollbackPlan,
  exportTestEvidence,
  replayTest,
  diffTestResults,
  newChatThread, addChatMessage,
  autoDocEntries,
  recordTestOutcome, successMetrics,
  addIdea, claimIdea,
  queueReorder,
  ENVIRONMENTS, environmentDescriptor,
  credentialDescriptor,
  recordSession,
  shareTestLink,
  recordFeedback, feedbackSummary,
  TEMPLATE_GALLERY, installTemplate,
  dependencyGraph,
  predictOutcome,
  archiveTest, restoreTest,
} from './testLifecycleCore.js';

import {
  WAVE38_LF_IDEAS, WAVE38_LF_START, WAVE38_LF_END,
  SEVERITY_COLORS, SEVERITIES,
  SOUND_CUES,
  insertFinding,
  pushToast, dismissToast,
  soundCueFor,
  tickerSlice,
  liveCardPayload,
  openDrawer, closeDrawer,
  mergeSeverity,
  sparklinePoints,
  acknowledgeSpotlight, isSpotlit,
  matchFilters,
  searchFeed,
  groupFindings,
} from './liveFindingsCore.js';

const T = { id: 'tq-7', technique: 'sqli', target: '/api/login', status: 'done' };

// --- registry completeness ---------------------------------------------------
test('lifecycle registry covers 51481–51508 with zero skips', () => {
  assert.equal(WAVE38_TL_IDEAS.length, 28);
  assert.equal(WAVE38_TL_START, 51481);
  assert.equal(WAVE38_TL_END, 51508);
  const ids = WAVE38_TL_IDEAS.map(([n]) => n);
  ids.forEach((n, i) => assert.equal(n, 51481 + i, `consecutive at index ${i}`));
  WAVE38_TL_IDEAS.forEach(([n, name, desc]) => {
    assert.ok(name && name.length > 2, `idea ${n} has a name`);
    assert.ok(desc && desc.length > 5, `idea ${n} has a description`);
  });
});

test('live-feed registry covers 51509–51520 with zero skips', () => {
  assert.equal(WAVE38_LF_IDEAS.length, 12);
  assert.equal(WAVE38_LF_START, 51509);
  assert.equal(WAVE38_LF_END, 51520);
  const ids = WAVE38_LF_IDEAS.map(([n]) => n);
  ids.forEach((n, i) => assert.equal(n, 51509 + i, `consecutive at index ${i}`));
  WAVE38_LF_IDEAS.forEach(([n, name, desc]) => {
    assert.ok(name && name.length > 2, `idea ${n} has a name`);
    assert.ok(desc && desc.length > 5, `idea ${n} has a description`);
  });
});

test('combined wave-38 registry is exactly 40/40 ideas, 51481–51520', () => {
  assert.equal(WAVE38_IDEAS.length, 40);
  assert.deepEqual(
    WAVE38_IDEAS.map(([n]) => n),
    Array.from({ length: 40 }, (_, i) => 51481 + i),
  );
});

// --- lifecycle round 2 logic ---------------------------------------------------
test('51481 streamEvent + stepRendererState track live execution steps', () => {
  const e = streamEvent(1, 4, 'Send payloads', 'active');
  assert.equal(e.progress, 0.5);
  assert.equal(e.done, false);
  const st = stepRendererState(['a', 'b', 'c'], 1);
  assert.deepEqual(st.map((s) => s.state), ['done', 'active', 'pending']);
});

test('51482 kill switch requests and applies a kill', () => {
  const req = killSwitchRequest('tq-7', 'too noisy');
  assert.equal(req.action, 'kill');
  assert.equal(req.status, 'kill-requested');
  const done = applyKill([T], 'tq-7', 'too noisy');
  assert.equal(done[0].status, 'killed');
  assert.equal(done[0].killReason, 'too noisy');
});

test('51483 followUpRequest queues a deeper dig on the same target', () => {
  const f = followUpRequest(T, 'try time-based payloads');
  assert.equal(f.parentId, 'tq-7');
  assert.equal(f.technique, 'sqli');
  assert.equal(f.focus, 'try time-based payloads');
  assert.equal(f.status, 'queued');
});

test('51484 promoteTestToFinding converts a successful test into a draft', () => {
  const d = promoteTestToFinding(T, { vulnerable: true, severity: 'high', evidence: ['row leak'] });
  assert.equal(d.status, 'draft');
  assert.equal(d.sourceTestId, 'tq-7');
  assert.equal(d.severity, 'high');
  assert.ok(d.title.includes('/api/login'));
});

test('51485 labelTest dedupes labels', () => {
  const l = labelTest(T, ['auth', 'auth', 'regression']);
  assert.deepEqual(l.labels, ['auth', 'regression']);
});

test('51486 comment threads add + resolve', () => {
  let th = newCommentThread('tq-7');
  th = addComment(th, 'aria', 'try the register form too');
  assert.equal(th.comments[0].id, 'c-1');
  assert.equal(th.comments[0].resolved, false);
  th = resolveComment(th, 'c-1');
  assert.equal(th.comments[0].resolved, true);
});

test('51487 requestApiPayload builds + validates a programmatic payload', () => {
  const p = requestApiPayload({ technique: 'xss', target: '/profile' });
  assert.equal(p.api, 'infinity/v1');
  assert.equal(p.environment, 'staging');
  assert.equal(validateApiPayload(p).ok, true);
  assert.deepEqual(validateApiPayload({}).missing, ['technique', 'target']);
});

test('51488 quotaStatus reports remaining + exhaustion', () => {
  const q = quotaStatus(8, 10);
  assert.equal(q.remaining, 2);
  assert.equal(q.percentUsed, 80);
  assert.equal(q.exhausted, false);
  assert.equal(quotaStatus(10, 10).exhausted, true);
});

test('51489 techniqueInfo returns plain-language cards', () => {
  assert.ok(TECHNIQUE_INFO.length >= 8);
  const info = techniqueInfo('ssrf');
  assert.ok(info.plain.length > 5);
  assert.ok(info.whatItDoes.length > 10);
  assert.equal(techniqueInfo('bogus'), null);
});

test('51490 riskBadge classifies safe/cautious/destructive', () => {
  assert.equal(riskBadge('headers').level, 'safe');
  assert.equal(riskBadge('ssrf').level, 'cautious');
  assert.equal(riskBadge('headers').className, 'tl38-risk-safe');
});

test('51491 rollbackPlan restores state-changing tests', () => {
  const r = rollbackPlan(T);
  assert.equal(r.restorable, true);
  assert.ok(r.steps.length >= 3);
  assert.ok(r.steps[0].toLowerCase().includes('snapshot'));
});

test('51492 exportTestEvidence builds JSON and Markdown standalone files', () => {
  const j = exportTestEvidence(T, { vulnerable: true }, 'json');
  assert.ok(j.filename.endsWith('.json'));
  assert.ok(j.content.includes('tq-7'));
  const m = exportTestEvidence(T, { vulnerable: false }, 'markdown');
  assert.ok(m.filename.endsWith('.md'));
  assert.ok(m.content.startsWith('#'));
});

test('51493 replayTest re-queues an identical test for regression', () => {
  const r = replayTest(T);
  assert.equal(r.id, 'tq-7-replay');
  assert.equal(r.replayOf, 'tq-7');
  assert.equal(r.status, 'queued');
});

test('51494 diffTestResults splits added/removed/unchanged evidence', () => {
  const d = diffTestResults(['a', 'b'], ['a', 'c']);
  assert.deepEqual(d.added, ['c']);
  assert.deepEqual(d.removed, ['b']);
  assert.deepEqual(d.unchanged, ['a']);
  assert.equal(d.changed, true);
});

test('51495 request chat threads hunter/agent messages', () => {
  let th = newChatThread('tq-7');
  th = addChatMessage(th, 'hunter', 'is this safe on prod?');
  th = addChatMessage(th, 'agent', 'use the mirror instead');
  assert.equal(th.messages[1].role, 'agent');
  assert.equal(th.messages[1].id, 'm-2');
});

test('51496 autoDocEntries document completed tests for the report', () => {
  const docs = autoDocEntries([{ ...T, result: { vulnerable: true } }]);
  assert.equal(docs.length, 1);
  assert.ok(docs[0].heading.includes('tq-7'));
  assert.ok(docs[0].body.length > 10);
});

test('51497 success metrics track which tests found issues', () => {
  let s = {};
  s = recordTestOutcome(s, 'tq-1', true);
  s = recordTestOutcome(s, 'tq-2', false);
  const m = successMetrics(s);
  assert.equal(m.total, 2);
  assert.equal(m.found, 1);
  assert.equal(m.rate, 50);
});

test('51498 idea inbox adds + claims ideas', () => {
  let inbox = addIdea([], 'try IDOR on /api/orders');
  assert.equal(inbox[0].status, 'open');
  inbox = claimIdea(inbox, inbox[0].id);
  assert.equal(inbox[0].status, 'claimed');
});

test('51499 queueReorder moves items without mutating', () => {
  const q = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const r = queueReorder(q, 0, 2);
  assert.deepEqual(r.map((t) => t.id), ['b', 'c', 'a']);
  assert.deepEqual(q.map((t) => t.id), ['a', 'b', 'c']);
});

test('51500 environment selector describes prod/staging/mirror', () => {
  assert.deepEqual(ENVIRONMENTS.map((e) => e.id), ['production', 'staging', 'mirror']);
  const prod = environmentDescriptor('production');
  assert.ok(prod.warning.toLowerCase().includes('live'));
  assert.equal(environmentDescriptor('bogus'), null);
});

test('51501 credentialDescriptor redacts secrets — descriptors only', () => {
  const c = credentialDescriptor({ username: 'tester', vaultRef: 'vault://t1', scope: '/api' });
  assert.equal(c.secret, '[redacted]');
  assert.equal(c.stored, false);
  assert.equal(c.username, 'tester');
  assert.ok(!('password' in c));
});

test('51502 recordSession captures replayable session steps', () => {
  const s = recordSession('tq-7', ['resolve', 'send', 'analyze']);
  assert.equal(s.sessionId, 'sess-tq-7');
  assert.equal(s.steps[1].n, 2);
  assert.equal(s.recorded, true);
});

test('51503 shareTestLink builds a deterministic share path', () => {
  const l = shareTestLink('tq-7');
  assert.equal(l.path, '/tests/share/tq-7');
  assert.ok(l.token.length > 0);
});

test('51504 feedback loop rates usefulness with weighting', () => {
  let s = {};
  s = recordFeedback(s, 'tq-1', 5);
  s = recordFeedback(s, 'tq-2', 99);
  const sum = feedbackSummary(s);
  assert.equal(sum.count, 2);
  assert.ok(sum.average > 0);
  assert.equal(sum.distribution[5], 2);
});

test('51505 templates gallery installs recipes with one click', () => {
  assert.ok(TEMPLATE_GALLERY.length >= 5);
  const inst = installTemplate(TEMPLATE_GALLERY[0].id);
  assert.equal(inst.ok, true);
  assert.equal(inst.test.status, 'queued');
  assert.equal(installTemplate('nope').ok, false);
});

test('51506 dependencyGraph maps test dependencies', () => {
  const g = dependencyGraph([
    { id: 'tq-1', technique: 'sqli', target: '/a' },
    { id: 'tq-2', technique: 'idor', target: '/b', dependsOn: ['tq-1'] },
  ]);
  assert.equal(g.nodes.length, 2);
  assert.deepEqual(g.edges, [{ from: 'tq-1', to: 'tq-2' }]);
});

test('51507 predictOutcome estimates success from history', () => {
  const p = predictOutcome({ technique: 'sqli' }, [
    { technique: 'sqli', foundIssue: true },
    { technique: 'sqli', foundIssue: false },
  ]);
  assert.equal(p.score, 50);
  assert.equal(p.likelihood, 'medium');
  assert.ok(p.reasons.length >= 1);
});

test('51508 archiveTest / restoreTest move requests between lists', () => {
  const archived = archiveTest([], [T], 'tq-7');
  assert.equal(archived.ok, true);
  assert.equal(archived.archive.length, 1);
  assert.equal(archived.active.length, 0);
  const restored = restoreTest(archived.archive, archived.active, 'tq-7');
  assert.equal(restored.active.length, 1);
  assert.equal(archiveTest([], [T], 'missing').ok, false);
});

// --- live findings feed logic --------------------------------------------------
const FINDINGS = [
  { id: 'F-1', title: 'SQL injection in login', type: 'sql-injection', severity: 'critical', confidence: 87, asset: '/api/login', technique: 'sqli', evidence: ['row leak', 'error text'], seq: 3 },
  { id: 'F-2', title: 'Reflected XSS in profile', type: 'xss', severity: 'high', confidence: 72, asset: '/profile', technique: 'xss', evidence: ['script bounce'], seq: 2 },
  { id: 'F-3', title: 'Missing security headers', type: 'headers', severity: 'low', confidence: 91, asset: '/', technique: 'headers', evidence: [], seq: 1 },
];

test('51509 insertFinding orders newest-first and dedupes by id', () => {
  let feed = [];
  feed = insertFinding(feed, FINDINGS[2]);
  feed = insertFinding(feed, FINDINGS[0]);
  assert.deepEqual(feed.map((f) => f.id), ['F-1', 'F-3']);
  feed = insertFinding(feed, { ...FINDINGS[0], confidence: 95 });
  assert.equal(feed.length, 2);
  assert.equal(feed[0].confidence, 95);
});

test('51510 toast alerts carry severity color-coding + dismiss', () => {
  assert.deepEqual(SEVERITIES, ['critical', 'high', 'medium', 'low']);
  let q = pushToast([], FINDINGS[0]);
  assert.equal(q[0].color, SEVERITY_COLORS.critical);
  assert.equal(q[0].dismissed, false);
  q = dismissToast(q, q[0].id);
  assert.equal(q.length, 0);
});

test('51511 sound cues map severity to tone descriptors', () => {
  assert.equal(soundCueFor('critical').tone, SOUND_CUES.critical.tone);
  assert.equal(soundCueFor('bogus').tone, SOUND_CUES.low.tone);
});

test('51512 tickerSlice takes the latest findings as ticker text', () => {
  const tick = tickerSlice(FINDINGS, 2);
  assert.equal(tick.length, 2);
  assert.ok(tick[0].text.includes('critical'));
  assert.ok(tick[0].text.includes('SQL injection'));
});

test('51513 liveCardPayload previews evidence inline', () => {
  const c = liveCardPayload(FINDINGS[0]);
  assert.equal(c.evidenceCount, 2);
  assert.deepEqual(c.evidencePreview, ['row leak', 'error text']);
  assert.equal(c.severity, 'critical');
});

test('51514 finding detail drawer opens + closes', () => {
  assert.deepEqual(openDrawer('F-1'), { open: true, findingId: 'F-1' });
  assert.deepEqual(closeDrawer(), { open: false, findingId: null });
});

test('51515 mergeSeverity updates severity with history', () => {
  const m = mergeSeverity(FINDINGS[1], 'critical');
  assert.equal(m.severity, 'critical');
  assert.deepEqual(m.severityHistory, ['high', 'critical']);
});

test('51516 sparklinePoints maps confidence history to polyline points', () => {
  const sp = sparklinePoints([10, 50, 100], 100, 40);
  assert.equal(sp.width, 100);
  assert.equal(sp.height, 40);
  assert.ok(sp.points.includes('100,0'));
  const single = sparklinePoints([50], 100, 40);
  assert.ok(single.points.startsWith('50,'));
});

test('51517 spotlight highlights until acknowledged', () => {
  assert.equal(isSpotlit([], 'F-1'), true);
  const ack = acknowledgeSpotlight([], 'F-1');
  assert.equal(isSpotlit(ack, 'F-1'), false);
  assert.deepEqual(acknowledgeSpotlight(ack, 'F-1'), ['F-1']);
});

test('51518 matchFilters matches severity/confidence/asset/technique', () => {
  const f = { severities: ['critical'], minConfidence: 80, asset: '', technique: '' };
  assert.equal(matchFilters(FINDINGS[0], f), true);
  assert.equal(matchFilters(FINDINGS[1], f), false);
  assert.equal(matchFilters(FINDINGS[0], { severities: [], minConfidence: 95, asset: '', technique: '' }), false);
  assert.equal(matchFilters(FINDINGS[0], { severities: [], minConfidence: 0, asset: '/api/login', technique: 'sqli' }), true);
});

test('51519 searchFeed full-text searches across fields', () => {
  assert.equal(searchFeed(FINDINGS, '').length, 3);
  assert.equal(searchFeed(FINDINGS, 'xss').length, 1);
  assert.equal(searchFeed(FINDINGS, 'LOGIN').length, 1);
  assert.equal(searchFeed(FINDINGS, 'bounce').length, 1);
});

test('51520 groupFindings clusters by asset + type', () => {
  const groups = groupFindings([...FINDINGS, { ...FINDINGS[0], id: 'F-4', seq: 4 }]);
  const login = groups.find((g) => g.key === '/api/login::sql-injection');
  assert.equal(login.count, 2);
  assert.equal(login.collapsed, false);
  assert.ok(groups[0].count >= groups[groups.length - 1].count);
});

// --- audits: CSS keyframes, debris, JSX parse ---------------------------------
test('Wave38.css carries zero keyframes per the zero-animation order', async () => {
  const { readFile } = await import('node:fs/promises');
  const css = await readFile(new URL('./Wave38.css', import.meta.url), 'utf8');
  assert.ok(!/@keyframes/i.test(css), 'zero keyframes');
});

test('all five wave-38 source files have no TODO/FIXME/mock/demo/simulate/placeholder debris', async () => {
  const { readFile } = await import('node:fs/promises');
  const files = ['./testLifecycleCore.js', './liveFindingsCore.js', './TestLifecycleRound2.jsx', './LiveFindingsFeed.jsx', './Wave38.css'];
  for (const f of files) {
    const src = await readFile(new URL(f, import.meta.url), 'utf8');
    assert.ok(!/\bTODO\b|\bFIXME\b/i.test(src), `no TODO/FIXME in ${f}`);
    assert.ok(!/\bmock\b/i.test(src), `no mock debris in ${f}`);
    assert.ok(!/\bdemo\b/i.test(src), `no demo debris in ${f}`);
    assert.ok(!/\bsimulate\b/i.test(src), `no simulate debris in ${f}`);
    assert.ok(!/\bplaceholder\b/i.test(src), `no placeholder debris in ${f}`);
  }
});

test('TestLifecycleRound2.jsx parses clean via esbuild', async () => {
  const { execFileSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const jsxPath = fileURLToPath(new URL('./TestLifecycleRound2.jsx', import.meta.url));
  const out = execFileSync('npx', ['--no-install', 'esbuild', '--loader:.jsx=jsx', jsxPath], { encoding: 'utf8', timeout: 30000 });
  assert.ok(out.includes('TestLifecycleRound2Gallery'), 'esbuild parsed the lifecycle gallery export');
});

test('LiveFindingsFeed.jsx parses clean via esbuild', async () => {
  const { execFileSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const jsxPath = fileURLToPath(new URL('./LiveFindingsFeed.jsx', import.meta.url));
  const out = execFileSync('npx', ['--no-install', 'esbuild', '--loader:.jsx=jsx', jsxPath], { encoding: 'utf8', timeout: 30000 });
  assert.ok(out.includes('LiveFindingsFeedGallery'), 'esbuild parsed the feed gallery export');
});
