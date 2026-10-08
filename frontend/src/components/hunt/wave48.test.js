// Infinity AI — Wave 48 tests (ideas 51881–51920): fleet ops + voice control.
// node --test frontend/src/components/hunt/wave48.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  WAVE48_FLEET_IDEAS,
  buildAuditLog,
  auditSummary,
  costRollup,
  etaBoard,
  detectConflicts,
  mergeHunts,
  splitHunt,
  pausePreset,
  resumeOrder,
  resolveFleetShortcut,
  resolveVoiceSwitch,
  mobileCardPayload,
  widgetPayload,
  darkModeParityAudit,
  tourSteps,
  fleetRetrospective,
} from './fleetOpsCore.js';
import {
  WAVE48_VOICE_IDEAS,
  parsePauseResume,
  statusAnswer,
  parseSteering,
  spokenApproval,
  parseTestCommand,
  findingBriefing,
  parseStrategyChange,
  etaAnswer,
  detectLanguage,
  pushToTalkSession,
  wakeWordConfig,
  isWakeWord,
  logVoiceCommand,
  searchCommandHistory,
  confirmationPrompt,
  resolveVoiceShortcut,
  registerVoiceShortcut,
  feedbackTone,
  errorRecovery,
  voiceHelpList,
  parseMultiHuntSwitch,
  parseSnapshotRequest,
  parseExplanationRequest,
  dictateNote,
  voiceChatTurn,
  interruptionSignal,
  duckingPolicy,
  verifyVoiceProfile,
  enrollVoiceProfile,
} from './voiceCore.js';

const dir = path.dirname(fileURLToPath(import.meta.url));

// ---- registry: 40/40, zero skips, no overlaps with other lanes ----
test('wave 48 registries: 15 + 25 ideas, zero skips', () => {
  assert.equal(WAVE48_FLEET_IDEAS.length, 15);
  assert.equal(WAVE48_VOICE_IDEAS.length, 25);
  const all = [...WAVE48_FLEET_IDEAS, ...WAVE48_VOICE_IDEAS];
  assert.equal(new Set(all).size, 40, 'no duplicate ideas');
  for (let i = 0; i < 40; i++) assert.equal(all[i], 51881 + i, 'contiguous 51881-51920');
  for (const id of all) assert.ok(id >= 50001, 'Two lane only');
});

// ---- 51881 audit log ----
test('51881 buildAuditLog filters + newest-first', () => {
  const ev = [
    { ts: 1, actor: 'a', huntId: 'h1', kind: 'start', summary: 's' },
    { ts: 2, actor: 'b', huntId: 'h1', kind: 'steer', summary: 'x' },
    { ts: 3, actor: 'a', huntId: 'h2', kind: 'finding', summary: 'y' },
  ];
  const rows = buildAuditLog(ev, { actor: 'a' });
  assert.equal(rows.length, 2);
  assert.ok(rows[0].ts >= rows[1].ts);
  assert.equal(auditSummary(ev).total, 3);
});

// ---- 51882 cost rollup ----
test('51882 costRollup totals + sorts', () => {
  const r = costRollup([
    { id: 'h1', spend: 5 },
    { id: 'h2', spend: 10 },
  ]);
  assert.equal(r.total, 15);
  assert.equal(r.perHunt[0].huntId, 'h2');
});

// ---- 51883 eta board ----
test('51883 etaBoard sorts by remaining', () => {
  const now = Date.now();
  const b = etaBoard([
    { id: 'a', etaMs: now + 5000 },
    { id: 'b', etaMs: 0 },
  ]);
  assert.equal(b[0].huntId, 'a');
  assert.equal(b[1].remainingMs, null);
});

// ---- 51884 conflicts ----
test('51884 detectConflicts flags overlapping scope', () => {
  const w = detectConflicts([
    { id: 'h1', scope: ['api.x.test'] },
    { id: 'h2', scope: ['API.X.TEST', 'y.test'] },
  ]);
  assert.equal(w.length, 1);
  assert.deepEqual(w[0].overlapping, ['api.x.test']);
});

// ---- 51885 merge ----
test('51885 mergeHunts combines + dedupes', () => {
  const m = mergeHunts(
    { id: 'h1', scope: ['a'], findings: [{ signature: 's1' }, { signature: 's2' }] },
    { id: 'h2', scope: ['b'], findings: [{ signature: 's2' }, { signature: 's3' }] }
  );
  assert.ok(m.ok);
  assert.equal(m.merged.findings.length, 3);
  assert.equal(m.dedupedCount, 1);
});

// ---- 51886 split ----
test('51886 splitHunt routes findings by scope', () => {
  const s = splitHunt(
    { id: 'h1', findings: [{ target: 'api.x.test/a' }, { target: 'auth.x.test/b' }] },
    { scopeA: ['api.x.test'], scopeB: ['auth.x.test'] }
  );
  assert.ok(s.ok);
  assert.equal(s.huntA.findings.length, 1);
  assert.equal(s.huntB.findings.length, 1);
});

// ---- 51887 pause preset ----
test('51887 pausePreset excepts client', () => {
  const p = pausePreset(
    [
      { id: 'h1', client: 'acme' },
      { id: 'h2', client: 'globex' },
    ],
    { exceptClient: 'globex' }
  );
  assert.equal(p.find(x => x.huntId === 'h1').action, 'pause');
  assert.equal(p.find(x => x.huntId === 'h2').action, 'keep-running');
});

// ---- 51888 resume order ----
test('51888 resumeOrder sequences restarts', () => {
  const o = resumeOrder([{ id: 'h1' }, { id: 'h2' }, { id: 'h3' }], ['h3']);
  assert.equal(o[0].huntId, 'h3');
  assert.equal(o[0].resumeSequence, 1);
});

// ---- 51889 shortcuts ----
test('51889 resolveFleetShortcut handles g N', () => {
  assert.equal(resolveFleetShortcut('g 2').index, 2);
  assert.equal(resolveFleetShortcut('p').action, 'pause-current');
  assert.equal(resolveFleetShortcut('zzz').action, 'unknown');
});

// ---- 51890 voice switch ----
test('51890 resolveVoiceSwitch resolves hunt', () => {
  const r = resolveVoiceSwitch('switch to the API hunt', [{ id: 'h1', name: 'API hunt' }]);
  assert.ok(r.ok);
  assert.equal(r.huntId, 'h1');
});

// ---- 51891 mobile cards ----
test('51891 mobileCardPayload counts criticals', () => {
  const c = mobileCardPayload({
    id: 'h1',
    name: 'x',
    findings: [{ severity: 'Critical' }, { severity: 'low' }],
  });
  assert.equal(c.criticalHigh, 1);
  assert.ok(c.swipeActions.includes('pause'));
});

// ---- 51892 widgets ----
test('51892 widgetPayload fleet summary', () => {
  const w = widgetPayload('fleet', { hunts: [{ status: 'running', findings: [1, 2] }] });
  assert.equal(w.running, 1);
  assert.equal(w.findings, 2);
});

// ---- 51893 dark-mode parity ----
test('51893 darkModeParityAudit flags gaps', () => {
  const a = darkModeParityAudit([{ view: 'V', tokens: ['bg-light'] }]);
  assert.equal(a[0].parity, false);
  assert.ok(a[0].issues.some(i => /dark/i.test(i)));
});

// ---- 51894 tour ----
test('51894 tourSteps has 5 steps', () => {
  assert.equal(tourSteps().length, 5);
});

// ---- 51895 retrospective ----
test('51895 fleetRetrospective aggregates', () => {
  const r = fleetRetrospective([
    { id: 'h1', name: 'a', findings: [{ severity: 'High' }] },
    { id: 'h2', name: 'b', findings: [] },
  ]);
  assert.equal(r.hunts, 2);
  assert.equal(r.totalFindings, 1);
  assert.equal(r.bySeverity.high, 1);
});

// ---- 51896 pause/resume ----
test('51896 parsePauseResume', () => {
  assert.equal(parsePauseResume('pause the hunt').action, 'pause');
  assert.equal(parsePauseResume('resume everything').scope, 'all');
  assert.equal(parsePauseResume('hello').action, 'unknown');
});

// ---- 51897 status ----
test('51897 statusAnswer speaks status', () => {
  assert.ok(
    statusAnswer({ name: 'API hunt', status: 'running', findings: [1] }).includes('API hunt')
  );
  assert.ok(statusAnswer(null).includes('No hunt'));
});

// ---- 51898 steering ----
test('51898 parseSteering extracts focus', () => {
  const r = parseSteering('focus on the API now');
  assert.ok(r.ok);
  assert.equal(r.focus, 'the api');
});

// ---- 51899 approvals ----
test('51899 spokenApproval verifies voice', () => {
  const ok = spokenApproval('approve', { enrolled: true, speakerId: 's1', matchedSpeakerId: 's1' });
  assert.equal(ok.decision, 'approve');
  assert.equal(ok.authorized, true);
  const bad = spokenApproval('approve', {
    enrolled: true,
    speakerId: 's1',
    matchedSpeakerId: 's2',
  });
  assert.equal(bad.authorized, false);
});

// ---- 51900 dictated tests ----
test('51900 parseTestCommand maps technique', () => {
  const r = parseTestCommand('try SQLi on the login form');
  assert.ok(r.ok);
  assert.equal(r.techniqueId, 'sqli');
  assert.equal(r.target, 'the login form');
});

// ---- 51901 briefings ----
test('51901 findingBriefing summarizes criticals', () => {
  const t = findingBriefing([{ severity: 'critical', title: 'SQLi' }]);
  assert.ok(t.includes('1 critical finding'));
});

// ---- 51902 strategy ----
test('51902 parseStrategyChange', () => {
  const r = parseStrategyChange('switch to depth mode');
  assert.ok(r.ok);
  assert.equal(r.strategy, 'depth');
  assert.equal(parseStrategyChange('switch to chaos mode').ok, false);
});

// ---- 51903 ETA ----
test('51903 etaAnswer formats remaining', () => {
  assert.ok(etaAnswer({ etaMs: Date.now() + 300000 }).includes('minute'));
  assert.equal(etaAnswer({}).startsWith('No ETA'), true);
});

// ---- 51904 language ----
test('51904 detectLanguage hi/en/hinglish', () => {
  assert.equal(detectLanguage('pause the hunt'), 'en');
  assert.equal(detectLanguage('hunt को रोको'), 'hi');
  assert.equal(detectLanguage('hunt को rok do abhi'), 'hinglish');
});

// ---- 51905/51906 ptt + wake ----
test('51905/51906 pushToTalk + wake word', () => {
  assert.equal(pushToTalkSession({}).key, 'Space');
  const c = wakeWordConfig(['hey infinity']);
  assert.ok(isWakeWord('hey infinity, pause', c));
  assert.ok(!isWakeWord('pause now', c));
});

// ---- 51907 history ----
test('51907 logVoiceCommand + search', () => {
  let h = logVoiceCommand([], { transcript: 'pause the hunt', intent: 'pause', result: 'ok' });
  assert.equal(h.length, 1);
  assert.equal(h[0].language, 'en');
  assert.equal(searchCommandHistory(h, 'pause').length, 1);
});

// ---- 51908 confirmation ----
test('51908 confirmationPrompt only for risky', () => {
  assert.equal(confirmationPrompt('pause all hunts').needsConfirmation, true);
  assert.equal(confirmationPrompt('read me the criticals').needsConfirmation, false);
});

// ---- 51909 shortcuts ----
test('51909 register + resolve voice shortcut', () => {
  const s = registerVoiceShortcut([], 'morning sweep', ['a', 'b']);
  const r = resolveVoiceShortcut('morning sweep', s);
  assert.ok(r.ok);
  assert.deepEqual(r.commands, ['a', 'b']);
});

// ---- 51910 tones ----
test('51910 feedbackTone descriptors', () => {
  assert.equal(feedbackTone('accepted').tone, 'confirm');
  assert.equal(feedbackTone('rejected').tone, 'error');
});

// ---- 51911 recovery ----
test('51911 errorRecovery suggests', () => {
  const r = errorRecovery('paws the hunt', ['pause the hunt', 'resume the hunt']);
  assert.ok(r.suggestions.includes('pause the hunt'));
  assert.ok(r.text.includes("didn't catch"));
});

// ---- 51912 help ----
test('51912 voiceHelpList non-empty', () => {
  assert.ok(voiceHelpList().length >= 5);
});

// ---- 51913 multi-hunt switch ----
test('51913 parseMultiHuntSwitch resolves by client', () => {
  const r = parseMultiHuntSwitch('switch to the client acme hunt', [
    { id: 'h1', client: 'acme', name: 'Web' },
  ]);
  assert.ok(r.ok);
  assert.equal(r.huntId, 'h1');
});

// ---- 51914 snapshot ----
test('51914 parseSnapshotRequest', () => {
  const r = parseSnapshotRequest('take a report snapshot');
  assert.ok(r.ok);
  assert.equal(r.snapshot.kind, 'report');
});

// ---- 51915 explanation ----
test('51915 parseExplanationRequest finds finding', () => {
  const r = parseExplanationRequest('explain that SQLi simply', [
    { id: 'f1', title: 'SQLi in search' },
  ]);
  assert.ok(r.ok);
  assert.equal(r.findingId, 'f1');
  assert.equal(r.level, 'simple');
});

// ---- 51916 notes ----
test('51916 dictateNote attaches', () => {
  const n = dictateNote('check the login form', 'h1');
  assert.ok(n.ok);
  assert.equal(n.note.huntId, 'h1');
  assert.equal(dictateNote('  ', 'h1').ok, false);
});

// ---- 51917 chat mode ----
test('51917 voiceChatTurn greets + ends', () => {
  assert.ok(voiceChatTurn('hello', {}).reply.includes('listening'));
  assert.equal(voiceChatTurn('goodbye', {}).end, true);
});

// ---- 51918 interruption ----
test('51918 interruptionSignal barge-in', () => {
  const r = interruptionSignal({ type: 'barge-in' });
  assert.equal(r.interrupted, true);
  assert.equal(r.action, 'stop-speaking');
});

// ---- 51919 ducking ----
test('51919 duckingPolicy lowers alerts', () => {
  assert.equal(duckingPolicy(true).alertVolume, 0.2);
  assert.equal(duckingPolicy(false).alertVolume, 1.0);
});

// ---- 51920 profiles ----
test('51920 verify + enroll voice profile', () => {
  const p = enrollVoiceProfile([], { speakerId: 's1', name: 'Bhavesh', allowSensitive: true });
  const v = verifyVoiceProfile({ speakerId: 's1' }, p);
  assert.equal(v.recognized, true);
  assert.equal(v.sensitiveCommandsAllowed, true);
  assert.equal(verifyVoiceProfile({ speakerId: 's9' }, p).recognized, false);
});

// ---- audits: zero keyframes, no debris ----
test('wave 48 css: zero keyframes/animations/transitions', () => {
  const css = fs.readFileSync(path.join(dir, 'Wave48.css'), 'utf8');
  assert.ok(!/@keyframes/i.test(css), 'no @keyframes');
  assert.ok(!/animation\s*:/i.test(css), 'no animation property');
  assert.ok(!/transition\s*:/i.test(css), 'no transition property');
});

test('wave 48: no mock/demo/TODO debris in new files', () => {
  for (const f of ['fleetOpsCore.js', 'voiceCore.js', 'FleetOps.jsx', 'VoiceSuite.jsx']) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const bad of ['TODO', 'FIXME', 'MOCK', 'lorem', 'placeholder']) {
      assert.ok(!new RegExp(`\\b${bad}\\b`, 'i').test(src), `${f} contains ${bad}`);
    }
  }
});
