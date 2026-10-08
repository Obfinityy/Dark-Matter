/**
 * wave32.test.js — wave 32 (ideas 51241–51280): log observability round 3.
 * node:test checks for pure logic in logObservCore.js and registry
 * completeness.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WAVE32_START,
  WAVE32_END,
  WAVE32_IDEAS,
  addBookmark,
  removeBookmark,
  listBookmarks,
  flagAnomalies,
  correlateLines,
  tailFollowState,
  sampleLines,
  sampleLabel,
  toLogCards,
  diffLogSegments,
  toolRuntimeStats,
  commandEcho,
  retentionSlice,
  switchHuntLog,
  restoreScroll,
  addAnnotation,
  quietHoursCollapse,
  checkAlertPatterns,
  screenshotEvents,
  minimapBuckets,
  toCurl,
  applyRedactionPreset,
  thoughtStreamEntry,
  perfOverlay,
  detectStalls,
  shareLink,
  watermark,
  offlineCache,
  summarizeRange,
  diffToolOutputs,
  shortcutMap,
  navigateLog,
  saveView,
  applyView,
  promoteToFinding,
  executionGraph,
  logSentiment,
  replaySandbox,
  fnv1a,
  integrityHash,
  verifyIntegrity,
  mergeStreams,
  densityFilter,
  densityLevels,
  foldRepeats,
  voiceNarration,
  exportSchedule,
  crossHuntCompare,
  answerFromLogs,
} from './logObservCore.js';

const L = (id, extra) => ({
  id,
  ts: 1728220000000,
  level: 'info',
  module: 'recon',
  text: `line ${id}`,
  ...extra,
});

// --- registry completeness -------------------------------------------------

test('registry covers all 40 ideas 51241–51280, zero skips', () => {
  assert.equal(WAVE32_START, 51241);
  assert.equal(WAVE32_END, 51280);
  assert.equal(WAVE32_IDEAS.length, 40);
  const ids = WAVE32_IDEAS.map(([id]) => id).sort((a, b) => a - b);
  for (let i = 0; i < 40; i++) assert.equal(ids[i], 51241 + i, `missing idea ${51241 + i}`);
  for (const [id, name, desc] of WAVE32_IDEAS) {
    assert.ok(name && name.length > 3, `idea ${id} needs a name`);
    assert.ok(desc && desc.length > 10, `idea ${id} needs a description`);
  }
});

// --- 51241 bookmarks ---------------------------------------------------------

test('addBookmark/removeBookmark/listBookmarks round-trip', () => {
  let b = addBookmark({}, 'l1', 'revisit');
  b = addBookmark(b, 'l2', 'important');
  assert.equal(listBookmarks(b).length, 2);
  assert.equal(listBookmarks(b)[0].lineId, 'l1');
  b = removeBookmark(b, 'l1');
  assert.equal(listBookmarks(b).length, 1);
  assert.equal(listBookmarks(b)[0].note, 'important');
});

// --- 51242 anomaly flagging ----------------------------------------------------

test('flagAnomalies detects error bursts and long gaps', () => {
  const lines = [
    L('a', { level: 'error', ts: 1000 }),
    L('b', { level: 'error', ts: 2000 }),
    L('c', { level: 'error', ts: 3000 }),
    L('d', { level: 'info', ts: 200000 }),
  ];
  const flags = flagAnomalies(lines);
  assert.ok(flags.some(f => f.reason.startsWith('error-burst')));
  assert.ok(flags.some(f => f.reason.startsWith('gap')));
});

test('flagAnomalies flags repeated identical failures', () => {
  const lines = [1, 2, 3, 4].map(i => L(`r${i}`, { text: 'same failure', ts: i * 1000 }));
  const flags = flagAnomalies(lines);
  assert.ok(flags.some(f => f.reason.startsWith('repeated')));
});

// --- 51243 correlation -----------------------------------------------------------

test('correlateLines links lines to findings by id', () => {
  const lines = [L('x', { text: 'see F-9 for details' })];
  const out = correlateLines(lines, [{ id: 'F-9', phase: 'detection' }]);
  assert.equal(out[0].findingId, 'F-9');
  assert.equal(out[0].phase, 'detection');
});

// --- 51244 tail-follow --------------------------------------------------------------

test('tailFollowState pauses on hover or scroll-up', () => {
  assert.equal(tailFollowState({ following: true, hovering: true, scrolledUp: false }), 'paused');
  assert.equal(tailFollowState({ following: true, hovering: false, scrolledUp: true }), 'paused');
  assert.equal(
    tailFollowState({ following: true, hovering: false, scrolledUp: false }),
    'following'
  );
  assert.equal(tailFollowState({ following: false, hovering: false, scrolledUp: false }), 'idle');
});

// --- 51245 sampling --------------------------------------------------------------------

test('sampleLines keeps errors and endpoints within budget', () => {
  const lines = Array.from({ length: 20 }, (_, i) =>
    L(`s${i}`, { level: i === 10 ? 'error' : 'info', ts: i * 1000 })
  );
  const { sample, total, sampled } = sampleLines(lines, 6, []);
  assert.equal(total, 20);
  assert.ok(sampled);
  assert.ok(sample.length <= 6);
  assert.ok(
    sample.some(l => l.id === 's10'),
    'error kept'
  );
  assert.ok(
    sample.some(l => l.id === 's0'),
    'first kept'
  );
  assert.ok(
    sample.some(l => l.id === 's19'),
    'last kept'
  );
});

test('sampleLabel formats counts', () => {
  assert.equal(sampleLabel(6, 20), 'showing 6 of 20');
  assert.equal(sampleLabel(20, 20), 'showing all 20');
});

// --- 51246 log cards ----------------------------------------------------------------------

test('toLogCards picks key events only', () => {
  const cards = toLogCards([
    L('a', { level: 'error' }),
    L('b', { level: 'info' }),
    L('c', { findingId: 'F-1' }),
  ]);
  assert.equal(cards.length, 2);
  assert.equal(cards[1].kind, 'finding');
});

// --- 51247 diff ---------------------------------------------------------------------------------

test('diffLogSegments reports added/removed', () => {
  const a = [L('a', { text: 'one' }), L('b', { text: 'two' })];
  const b = [L('c', { text: 'two' }), L('d', { text: 'three' })];
  const d = diffLogSegments(a, b);
  assert.equal(d.addedCount, 1);
  assert.equal(d.removedCount, 1);
});

// --- 51248 tool stats ----------------------------------------------------------------------------

test('toolRuntimeStats aggregates runs and error rates', () => {
  const lines = [
    L('a', { tool: 'nmap', durationMs: 100 }),
    L('b', { tool: 'nmap', durationMs: 200, level: 'error' }),
    L('c', { tool: 'ffuf', durationMs: 50 }),
  ];
  const s = toolRuntimeStats(lines);
  const nmap = s.find(x => x.tool === 'nmap');
  assert.equal(nmap.runs, 2);
  assert.equal(nmap.avgMs, 150);
  assert.equal(nmap.errorRate, 50);
});

// --- 51249 command echo -------------------------------------------------------------------------------

test('commandEcho formats decision + command + why', () => {
  const e = commandEcho({ decision: 'scan', command: 'nmap -sV x', why: 'ports unknown' });
  assert.ok(e.line.includes('nmap -sV x'));
  assert.ok(e.line.includes('ports unknown'));
});

// --- 51250 retention ----------------------------------------------------------------------------------------

test('retentionSlice keeps newest N', () => {
  const lines = [1, 2, 3, 4, 5].map(i => L(`r${i}`));
  assert.deepEqual(
    retentionSlice(lines, 2).map(l => l.id),
    ['r4', 'r5']
  );
  assert.deepEqual(retentionSlice(lines, 0), []);
});

// --- 51251 hunt switcher ---------------------------------------------------------------------------------------

test('switchHuntLog preserves scroll per hunt', () => {
  let s = switchHuntLog(null, 'h1', 0);
  s = switchHuntLog(s, 'h2', 400);
  assert.equal(restoreScroll(s, 'h1'), 400);
  s = switchHuntLog(s, 'h1', 250);
  assert.equal(restoreScroll(s, 'h2'), 250);
});

// --- 51252 annotations ----------------------------------------------------------------------------------------------

test('addAnnotation appends notes per line', () => {
  const a = addAnnotation(addAnnotation({}, 'l1', 'you', 'check this'), 'l1', 'sam', 'looks odd');
  assert.equal(a.l1.length, 2);
  assert.equal(a.l1[1].author, 'sam');
});

// --- 51253 quiet hours ----------------------------------------------------------------------------------------------------

test('quietHoursCollapse folds routine chatter', () => {
  const lines = [
    L('a', { module: 'heartbeat', text: 'ok' }),
    L('b', { module: 'heartbeat', text: 'ok' }),
    L('c', { module: 'scanner', level: 'error', text: 'boom' }),
  ];
  const { lines: kept, summaries, collapsedCount } = quietHoursCollapse(lines);
  assert.equal(kept.length, 1);
  assert.equal(summaries.length, 1);
  assert.equal(collapsedCount, 2);
});

// --- 51254 alerts -----------------------------------------------------------------------------------------------------------------

test('checkAlertPatterns matches case-insensitively', () => {
  const hits = checkAlertPatterns(L('x', { text: 'Connection REFUSED' }), [
    { pattern: 'refused', label: 'net' },
  ]);
  assert.equal(hits.length, 1);
  assert.equal(
    checkAlertPatterns(L('y', { text: 'all good' }), [{ pattern: 'refused' }]).length,
    0
  );
});

// --- 51255 screenshots -------------------------------------------------------------------------------------------------------------------

test('screenshotEvents triggers on findings and errors', () => {
  const ev = screenshotEvents([
    L('a', { level: 'error' }),
    L('b', { level: 'info' }),
    L('c', { findingId: 'F-2' }),
  ]);
  assert.equal(ev.length, 2);
});

// --- 51256 minimap --------------------------------------------------------------------------------------------------------------------------------

test('minimapBuckets normalizes to 0..1', () => {
  const b = minimapBuckets(
    Array.from({ length: 10 }, (_, i) => L(`m${i}`)),
    4
  );
  assert.equal(b.length, 4);
  assert.ok(b.every(v => v >= 0 && v <= 1));
  assert.equal(Math.max(...b), 1);
});

// --- 51257 curl ---------------------------------------------------------------------------------------------------------------------------------------------

test('toCurl builds a quoted curl command', () => {
  const cmd = toCurl({
    method: 'post',
    url: 'https://x.test/api',
    headers: { 'Content-Type': 'application/json' },
    body: { a: 1 },
  });
  assert.ok(cmd.startsWith('curl -X POST'));
  assert.ok(cmd.includes('https://x.test/api'));
  assert.ok(cmd.includes('--data-raw'));
});

// --- 51258 redaction ---------------------------------------------------------------------------------------------------------------------------------------------

test('applyRedactionPreset masks per profile', () => {
  const t = 'password=s3cret token=abc from 10.0.0.5';
  assert.ok(!applyRedactionPreset(t, 'demo').includes('s3cret'));
  assert.ok(applyRedactionPreset(t, 'demo').includes('10.0.0.5'));
  assert.ok(!applyRedactionPreset(t, 'public').includes('10.0.0.5'));
  assert.equal(applyRedactionPreset(t, 'nope'), t);
});

// --- 51259 thought stream ---------------------------------------------------------------------------------------------------------------------------------------------

test('thoughtStreamEntry normalizes a thought', () => {
  const e = thoughtStreamEntry({ id: 't1', text: 'hmm', confidence: 0.5 });
  assert.equal(e.id, 't1');
  assert.equal(e.confidence, 0.5);
});

// --- 51260 perf overlay ---------------------------------------------------------------------------------------------------------------------------------------------------

test('perfOverlay buckets counts and avg latency', () => {
  const lines = [1, 2, 3, 4].map(i => L(`p${i}`, { ts: i * 1000, durationMs: i * 10 }));
  const b = perfOverlay(lines, 2);
  assert.equal(b.length, 2);
  assert.equal(b[0].count + b[1].count, 4);
});

// --- 51261 stalls --------------------------------------------------------------------------------------------------------------------------------------------------------------

test('detectStalls finds long gaps', () => {
  const s = detectStalls([L('a', { ts: 1000 }), L('b', { ts: 200000 })], 60000);
  assert.equal(s.length, 1);
  assert.equal(s[0].gapMs, 199000);
});

// --- 51262/51263 sharing + watermark ------------------------------------------------------------------------------------------------------------------------------------------

test('shareLink is deterministic and read-only', () => {
  const a = shareLink('hunt-1');
  const b = shareLink('hunt-1');
  assert.equal(a.token, b.token);
  assert.ok(a.readOnly);
  assert.notEqual(shareLink('hunt-2').token, a.token);
});

test('watermark embeds viewer identity', () => {
  const w = watermark({ id: 'u1', name: 'Asha' });
  assert.ok(w.watermarkText.includes('Asha'));
  assert.ok(w.watermarkText.includes('u1'));
});

// --- 51264 offline cache ------------------------------------------------------------------------------------------------------------------------------------------------------------

test('offlineCache serializes lines', () => {
  const c = offlineCache([L('a'), L('b')]);
  assert.equal(c.count, 2);
  assert.equal(c.version, 1);
});

// --- 51265 summarizer ---------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('summarizeRange prefers signal lines', () => {
  const lines = [
    L('a', { text: 'heartbeat ok' }),
    L('b', { text: 'error: connection failed', level: 'error' }),
    L('c', { text: 'polling again' }),
  ];
  const s = summarizeRange(lines, 1);
  assert.equal(s[0].id, 'b');
});

// --- 51266 output diff ------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('diffToolOutputs delegates to line diff', () => {
  const d = diffToolOutputs(['a', 'b'], ['b', 'c']);
  assert.equal(d.addedCount, 1);
  assert.equal(d.removedCount, 1);
});

// --- 51267 keyboard nav -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('shortcutMap has expected bindings', () => {
  const m = shortcutMap();
  assert.equal(m.nextError, 'e');
  assert.equal(m.followTail, 't');
});

test('navigateLog jumps to next/prev match', () => {
  const lines = [L('a'), L('b', { level: 'error' }), L('c'), L('d', { level: 'error' })];
  assert.equal(navigateLog(lines, -1, 'error', 1, []), 'b');
  assert.equal(navigateLog(lines, 3, 'error', -1, []), 'b');
  assert.equal(navigateLog(lines, 3, 'error', 1, []), null);
});

// --- 51268 custom views ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('saveView/applyView filter lines', () => {
  const views = saveView({}, 'errs', { level: 'error' });
  const out = applyView([L('a', { level: 'error' }), L('b', { level: 'info' })], views.errs);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 'a');
});

// --- 51269 promotion -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('promoteToFinding creates a draft with evidence', () => {
  const d = promoteToFinding(L('x', { text: 'suspicious redirect', module: 'detector' }));
  assert.ok(d.draft);
  assert.equal(d.evidence[0].lineId, 'x');
  assert.equal(d.source, 'log-promotion');
});

// --- 51270 exec graph -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('executionGraph links consecutive tool runs', () => {
  const g = executionGraph([
    L('a', { tool: 'nmap' }),
    L('b', { text: 'no tool here' }),
    L('c', { tool: 'ffuf' }),
  ]);
  assert.equal(g.nodes.length, 2);
  assert.equal(g.edges.length, 1);
  assert.equal(g.edges[0].from, 'n0');
});

// --- 51271 sentiment -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('logSentiment classifies phases', () => {
  assert.equal(
    logSentiment([L('a', { findingId: 'F-1' }), L('b'), L('c'), L('d'), L('e'), L('f')]),
    'success'
  );
  const errs = Array.from({ length: 4 }, (_, i) => L(`e${i}`, { level: 'error' }));
  assert.equal(logSentiment([...errs, L('x')]), 'struggle');
  assert.equal(logSentiment([L('x', { text: 'ok' })]), 'idle');
  assert.equal(logSentiment([]), 'idle');
});

// --- 51272 replay sandbox -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('replaySandbox marks isolated with curl', () => {
  const r = replaySandbox({ method: 'GET', url: 'https://x.test/' });
  assert.ok(r.isolated);
  assert.ok(r.curl.includes('curl'));
  assert.ok(r.warnings.length > 0);
});

// --- 51273 integrity -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('fnv1a is deterministic hex', () => {
  assert.equal(fnv1a('abc'), fnv1a('abc'));
  assert.match(fnv1a('abc'), /^[0-9a-f]{8}$/);
});

test('integrityHash chains and verifies', () => {
  const lines = [L('a', { ts: 1, text: 'one' }), L('b', { ts: 2, text: 'two' })];
  const { head, chain } = integrityHash(lines);
  assert.equal(chain.length, 2);
  assert.ok(verifyIntegrity(lines, chain));
  assert.ok(
    !verifyIntegrity([L('a', { ts: 1, text: 'tampered' }), L('b', { ts: 2, text: 'two' })], chain)
  );
  assert.equal(head, chain[chain.length - 1].hash);
});

// --- 51274 stream merge -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('mergeStreams merges chronologically with colors', () => {
  const m = mergeStreams([
    { agentId: 'a1', name: 'scout', lines: [L('x', { ts: 2000 })] },
    { agentId: 'a2', name: 'prober', lines: [L('y', { ts: 1000 })] },
  ]);
  assert.equal(m[0].id, 'y');
  assert.equal(m[1].id, 'x');
  assert.ok(m[0].color);
  assert.notEqual(m[0].color, m[1].color);
});

// --- 51275 density -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('densityFilter respects levels', () => {
  const lines = [L('a', { level: 'debug' }), L('b', { level: 'info' }), L('c', { level: 'error' })];
  assert.equal(densityFilter(lines, 'packets').length, 3);
  assert.equal(densityFilter(lines, 'detailed').length, 2);
  assert.equal(densityFilter(lines, 'milestones').length, 1);
  assert.deepEqual(densityLevels(), ['packets', 'detailed', 'standard', 'milestones']);
});

// --- 51276 folding -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('foldRepeats collapses runs of 3+', () => {
  const lines = [
    L('a', { text: 'x' }),
    L('b', { text: 'x' }),
    L('c', { text: 'x' }),
    L('d', { text: 'y' }),
  ];
  const f = foldRepeats(lines);
  assert.equal(f[0].type, 'fold');
  assert.equal(f[0].count, 3);
  assert.equal(f[1].type, 'line');
});

// --- 51277 voice -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('voiceNarration scripts key events only', () => {
  const v = voiceNarration([
    L('a', { level: 'error', text: 'boom' }),
    L('b', { level: 'info', text: 'ok' }),
  ]);
  assert.equal(v.length, 1);
  assert.ok(v[0].startsWith('Error:'));
});

// --- 51278 export schedule -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('exportSchedule plans per phase boundary', () => {
  const p = exportSchedule([{ name: 'recon' }, { name: 'detect', format: 'text' }]);
  assert.equal(p.length, 2);
  assert.equal(p[1].format, 'text');
  assert.equal(p[0].trigger, 'phase-boundary');
});

// --- 51279 cross-hunt -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('crossHuntCompare counts shared and unique', () => {
  const c = crossHuntCompare(
    [L('a', { text: 'one' }), L('b', { text: 'two' })],
    [L('c', { text: 'two' }), L('d', { text: 'three' })]
  );
  assert.equal(c.sharedLines, 1);
  assert.equal(c.onlyInA, 1);
  assert.equal(c.onlyInB, 1);
});

// --- 51280 Q&A -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

test('answerFromLogs grounds answers in matching lines', () => {
  const lines = [
    L('a', { text: 'login test failed: invalid credentials' }),
    L('b', { text: 'heartbeat ok' }),
  ];
  const r = answerFromLogs('why did the login test fail?', lines);
  assert.ok(r.grounded);
  assert.equal(r.evidence[0].lineId, 'a');
  const r2 = answerFromLogs('what is the weather?', lines);
  assert.ok(!r2.grounded);
});

// --- no-debris audit -------------------------------------------------------------------------------------------------------

test('core file has no TODO/FIXME/mock debris', async () => {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('./logObservCore.js', import.meta.url), 'utf8');
  assert.ok(!/\bTODO\b|\bFIXME\b/i.test(src), 'no TODO/FIXME');
  assert.ok(!/simulate/i.test(src), 'no simulate debris');
});
