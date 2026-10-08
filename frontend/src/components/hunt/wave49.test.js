/**
 * wave49.test.js — Infinity AI · Dark-Matter · Wave 49
 * Run: node --test frontend/src/components/hunt/wave49.test.js
 * Tests the two pure core modules only (no JSX imported here).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import * as V from './voiceRound2Core.js';
import * as M from './mobileCore.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const NEW_FILES = [
  'voiceRound2Core.js', 'mobileCore.js',
  'VoiceRound2.jsx', 'MobileSuite.jsx',
  'Wave49.css', 'wave49.test.js',
];

describe('voiceRound2Core registry', () => {
  test('lists all 30 voice ideas 51921–51950, zero skips', () => {
    assert.equal(V.WAVE49_VOICE2_IDEAS.length, 30);
    const ids = V.WAVE49_VOICE2_IDEAS.map((i) => i.id);
    for (let id = 51921; id <= 51950; id++) assert.ok(ids.includes(id), `missing idea ${id}`);
    assert.equal(new Set(ids).size, 30, 'no duplicate ids');
    assert.ok(V.WAVE49_VOICE2_IDEAS.every((i) => i.title && i.title.length > 0), 'every idea has a title');
  });
});

describe('mobileCore registry', () => {
  test('lists all 10 mobile ideas 51951–51960, zero skips', () => {
    assert.equal(M.WAVE49_MOBILE_IDEAS.length, 10);
    const ids = M.WAVE49_MOBILE_IDEAS.map((i) => i.id);
    for (let id = 51951; id <= 51960; id++) assert.ok(ids.includes(id), `missing idea ${id}`);
    assert.equal(new Set(ids).size, 10, 'no duplicate ids');
  });
});

describe('voiceRound2Core spot checks', () => {
  test('51921 permissions: destructive command blocked without enrolled voice', () => {
    const blocked = V.checkVoicePermission('stop hunt', { enrolled: false });
    assert.equal(blocked.allowed, false);
    const ok = V.checkVoicePermission('stop hunt', { enrolled: true });
    assert.equal(ok.allowed, true);
    const benign = V.checkVoicePermission('hunt status', { enrolled: false });
    assert.equal(benign.allowed, true);
  });
  test('51922 audit trail appends an entry and grows the log', () => {
    const { entry, log } = V.appendVoiceAuditEntry([], 'pause hunt', { name: 'owner', enrolled: true }, 'paused');
    assert.equal(log.length, 1);
    assert.equal(entry.type, 'voice-command');
    assert.ok(entry.ts);
  });
  test('51923 noise profile selects commute profile for 70dB', () => {
    assert.equal(V.selectNoiseProfile(70).profile, 'commute');
    assert.equal(V.selectNoiseProfile(30).profile, 'quiet-room');
  });
  test('51924 offline mode recognizes core commands only', () => {
    assert.equal(V.offlineRecognize('pause hunt').recognized, true);
    assert.equal(V.offlineRecognize('write me a report').recognized, false);
  });
  test('51925 chaining splits into ordered steps', () => {
    const steps = V.parseChainedCommand('pause the hunt and take a snapshot');
    assert.equal(steps.length, 2);
    assert.equal(steps[0].order, 1);
  });
  test('51926 timer parses ten minutes with resume action', () => {
    const t = V.parseVoiceTimer('pause for ten minutes, then resume');
    assert.equal(t.minutes, 10);
    assert.equal(t.action, 'pause-then-resume');
  });
  test('51930 feedback tally computes accuracy', () => {
    const r = V.recordVoiceFeedback([], 'pause hunt', true);
    assert.equal(r.accuracy, 1);
    const r2 = V.recordVoiceFeedback(r.log, 'pause hunt', false);
    assert.equal(r2.accuracy, 0.5);
  });
  test('51931 emergency stop triggers on kill phrase', () => {
    assert.equal(V.matchEmergencyStop('stop everything now').triggered, true);
    assert.equal(V.matchEmergencyStop('what is the status').triggered, false);
  });
  test('51938 latency sums recognition + execution', () => {
    const l = V.computeVoiceLatency(1000, 1600, 2200);
    assert.equal(l.recognitionMs, 600);
    assert.equal(l.executionMs, 600);
    assert.equal(l.totalMs, 1200);
  });
  test('51940 bilingual normalization maps Hindi words', () => {
    const n = V.normalizeBilingualCommand('hunt roko aur status batao');
    assert.ok(n.normalized.includes('pause'), `got: ${n.normalized}`);
  });
  test('51942 delegation parses a delegate name', () => {
    const d = V.parseDelegationCommand('let Priya approve the next request');
    assert.equal(d.delegate, 'Priya');
    assert.equal(d.valid, true);
  });
  test('51943 hunt creation extracts a target domain', () => {
    const h = V.parseHuntCreationCommand('start a hunt on example.com');
    assert.equal(h.target, 'example.com');
    assert.equal(h.valid, true);
  });
  test('51945 log Q&A answers a failure question from logs', () => {
    const a = V.answerLogQuestion([{ message: 'Error: probe 7 timed out' }], 'why did that test fail?');
    assert.ok(a.answer.includes('probe 7'), `got: ${a.answer}`);
  });
  test('51949 sandbox never touches the real hunt', () => {
    const s = V.sandboxCommand('stop hunt');
    assert.equal(s.realHuntTouched, false);
  });
  test('51950 privacy mode reroutes sensitive readouts to text', () => {
    assert.equal(V.routePrivacyOutput('the api key is abc123').channel, 'text');
    assert.equal(V.routePrivacyOutput('hunt is running fine').channel, 'speaker');
  });
});

describe('mobileCore spot checks', () => {
  test('51951 dashboard payload aggregates hunts', () => {
    const p = M.buildDashboardPayload([
      { id: 'h1', name: 'a', status: 'running', findingsCount: 2 },
      { id: 'h2', name: 'b', status: 'done', findingsCount: 1 },
    ]);
    assert.equal(p.activeCount, 1);
    assert.equal(p.totalFindings, 3);
  });
  test('51952 findings stream batches correctly', () => {
    const s = M.batchFindingsStream(['a', 'b', 'c'], 2);
    assert.equal(s.batches.length, 2);
    assert.equal(s.total, 3);
  });
  test('51953 push alert respects severity threshold and quiet hours', () => {
    const send = M.evaluatePushAlert({ severity: 'critical', title: 'X' }, { minSeverity: 'medium' });
    assert.equal(send.send, true);
    const quiet = M.evaluatePushAlert({ severity: 'critical', title: 'X' }, { minSeverity: 'medium', quietHours: true });
    assert.equal(quiet.send, false);
    const low = M.evaluatePushAlert({ severity: 'low', title: 'X' }, { minSeverity: 'high' });
    assert.equal(low.send, false);
  });
  test('51954 approval card has approve/deny/defer actions', () => {
    const card = M.buildApprovalCard({ id: 'r1', title: 'T' });
    assert.equal(card.actions.length, 3);
    assert.deepEqual(card.actions.map((a) => a.value), ['approve', 'deny', 'defer']);
  });
  test('51955 pause button is thumb-friendly and toggles', () => {
    const b = M.describePauseButton('running');
    assert.equal(b.label, 'Pause');
    assert.ok(b.minTouchPx >= 48);
  });
  test('51957 ETA widget countdown text', () => {
    const now = Date.now();
    const w = M.computeEtaCountdown(now + 42 * 60000 + 30000, now);
    assert.ok(w.text.includes('42m'), `got: ${w.text}`);
    assert.equal(w.overdue, false);
  });
  test('51958 chat message normalization detects commands', () => {
    const c = M.normalizeChatMessage('/pause now');
    assert.equal(c.isCommand, true);
    assert.equal(c.command, 'pause');
    assert.equal(M.normalizeChatMessage('   ').empty, true);
  });
  test('51959 mobile voice command mapping', () => {
    assert.equal(M.mapMobileVoiceCommand('please pause the hunt').action, 'pause-hunt');
    assert.equal(M.mapMobileVoiceCommand('play music').recognized, false);
  });
  test('51960 condensed logs truncate to the tail', () => {
    const logs = Array.from({ length: 30 }, (_, i) => ({ message: `line ${i}` }));
    const v = M.condenseLogs(logs, 10);
    assert.equal(v.shown, 10);
    assert.equal(v.truncated, true);
    assert.ok(v.lines[0].includes('line 20'));
  });
});

describe('no-debris audit', () => {
  test('none of the 5 product files contain TODO/FIXME/mock/demo placeholder text', () => {
    const pattern = /\b(todo|fixme|xxx|hack|mock|lorem|demo)\b/i;
    for (const f of NEW_FILES.filter((x) => x !== 'wave49.test.js')) {
      const content = readFileSync(join(HERE, f), 'utf8');
      const hit = content.match(pattern);
      assert.ok(!hit, `${f} contains debris marker: "${hit && hit[0]}"`);
    }
  });
  test('Wave49.css has zero @keyframes and zero transitions', () => {
    const css = readFileSync(join(HERE, 'Wave49.css'), 'utf8');
    assert.ok(!css.includes('@keyframes'), 'no @keyframes allowed');
    assert.ok(!/transition\s*:/i.test(css), 'no transitions allowed');
    assert.ok(!/animation\s*:/i.test(css), 'no animations allowed');
  });
  test('Wave49.css uses only scoped prefixes .vr2-* and .ms49-*', () => {
    const css = readFileSync(join(HERE, 'Wave49.css'), 'utf8');
    const classSelectors = css.match(/^\.[a-zA-Z][a-zA-Z0-9_-]*/gm) || [];
    const rogue = classSelectors.filter((c) => !c.startsWith('.vr2-') && !c.startsWith('.ms49-'));
    assert.deepEqual(rogue, [], `unscoped selectors: ${rogue.join(', ')}`);
  });
  test('Infinity AI branding only — no other worker name in product files', () => {
    const productFiles = NEW_FILES.filter((f) => f !== 'wave49.test.js');
    for (const f of productFiles) {
      const content = readFileSync(join(HERE, f), 'utf8');
      assert.ok(!/\b[mM]use\b/.test(content), `${f} mentions the forbidden worker name`);
    }
  });
});
