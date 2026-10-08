/**
 * wave20.test.js — wave 20 (ideas 50761–50800): toast round 3 tests.
 * Pure-logic tests (toastRound3Core.js) + real-contrast audit across all
 * four Infinity themes + source-file presence audits for the new components.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

import {
  WAVE20_IDEAS,
  createProgressToast,
  advanceProgressToast,
  failProgressToast,
  UNDO_WINDOW_MS,
  undoRemainingMs,
  undoExpired,
  undoToastPayload,
  toneSpecForSeverity,
  hhmmToMinutes,
  dndActive,
  DEFAULT_DND_SCHEDULE,
  isHuntQuiet,
  toggleHuntQuiet,
  idleToastState,
  toastAutoDismissMs,
  shouldSuppressToast,
  DUP_WINDOW_MS,
  unreadBadgeCount,
  markAllRead,
  sessionExpiryState,
  enqueueOfflineAction,
  drainOfflineQueue,
  quotaLevel,
  quotaToastPayload,
  huntCompleteToast,
  mentionToast,
  updateAvailableToast,
  scheduledHuntToast,
  permissionChangeToast,
  learningEventToast,
  exportReadyToast,
  FIRST_RUN_STEPS,
  checklistState,
  completeChecklistStep,
  auditToastContrast,
  copyMicroToastPayload,
  toastColorsForTheme,
  resolveToastSeverityColor,
  currentThemeId,
} from './toastRound3Core.js';
import { THEMES } from './themeCore.js';
import { contrastRatio } from './a11yCore.js';
import { TOAST_SEVERITY_COLORS } from './dashboardRound2Core.js';

const src = f => readFileSync(path.join(here, f), 'utf8');

/* ---------- registry ---------- */

test('WAVE20_IDEAS covers 50761–50800, all 40, with honest skips marked', () => {
  assert.equal(WAVE20_IDEAS.length, 40);
  const ids = WAVE20_IDEAS.map(i => i.id);
  for (let id = 50761; id <= 50800; id++) assert.ok(ids.includes(id), `missing ${id}`);
  const skips = WAVE20_IDEAS.filter(i => i.status === 'skip');
  assert.deepEqual(
    skips.map(s => s.id),
    [50762, 50767, 50772]
  );
  for (const s of skips)
    assert.ok(s.skipReason && s.skipReason.length > 5, `skip ${s.id} needs a reason`);
  assert.equal(WAVE20_IDEAS.filter(i => i.status === 'new').length, 37);
});

/* ---------- 50761 progress toasts ---------- */

test('progress toasts create, advance, clamp, complete and fail', () => {
  const t = createProgressToast('Exporting PDF', 10);
  assert.equal(t.progress, 0);
  assert.equal(t.status, 'running');
  assert.ok(t.persistent);
  const half = advanceProgressToast(t, 5);
  assert.equal(half.progress, 0.5);
  assert.equal(half.status, 'running');
  const over = advanceProgressToast(t, 999);
  assert.equal(over.progress, 1);
  assert.equal(over.status, 'complete');
  assert.equal(over.done, 10);
  const neg = advanceProgressToast(t, -3);
  assert.equal(neg.done, 0);
  const failed = failProgressToast(t, 'disk full');
  assert.equal(failed.status, 'failed');
  assert.ok(failed.body.includes('disk full'));
});

/* ---------- 50763 undo window ---------- */

test('undo window: remaining ms and expiry', () => {
  const now = 1_000_000;
  assert.equal(undoRemainingMs(now - 2000, UNDO_WINDOW_MS, now), 3000);
  assert.equal(undoRemainingMs(now - 9000, UNDO_WINDOW_MS, now), 0);
  assert.ok(!undoExpired(now - 4999, UNDO_WINDOW_MS, now));
  assert.ok(undoExpired(now - 5000, UNDO_WINDOW_MS, now));
  let undone = false;
  const p = undoToastPayload('Bulk dismissed', 'restore window', () => {
    undone = true;
  });
  assert.deepEqual(p.actions, ['undo', 'dismiss']);
  p.onAction('undo');
  assert.ok(undone);
});

/* ---------- 50764 severity tones ---------- */

test('tone spec is distinct per severity', () => {
  const freqs = new Set(
    ['critical', 'high', 'medium', 'low', 'info'].map(s => toneSpecForSeverity(s).freq)
  );
  assert.equal(freqs.size, 5);
  const c = toneSpecForSeverity('critical');
  assert.ok(c.duration >= 0.3 && c.gain > 0);
});

/* ---------- 50765 DND schedule ---------- */

test('hhmmToMinutes parses and rejects bad input', () => {
  assert.equal(hhmmToMinutes('22:00'), 1320);
  assert.equal(hhmmToMinutes('07:00'), 420);
  assert.equal(hhmmToMinutes('7:00'), 420);
  assert.equal(hhmmToMinutes('99:99'), null);
  assert.equal(hhmmToMinutes('nope'), null);
});

test('dndActive handles overnight wrap', () => {
  const sched = { enabled: true, start: '22:00', end: '07:00' };
  const at = (h, m) => ({ getHours: () => h, getMinutes: () => m });
  assert.ok(dndActive(sched, at(23, 30)));
  assert.ok(dndActive(sched, at(2, 0)));
  assert.ok(!dndActive(sched, at(12, 0)));
  assert.ok(!dndActive(sched, at(7, 0))); // end boundary is exclusive
  assert.ok(!dndActive({ ...sched, enabled: false }, at(23, 0)));
  const day = { enabled: true, start: '09:00', end: '17:00' };
  assert.ok(dndActive(day, at(12, 0)));
  assert.ok(!dndActive(day, at(20, 0)));
  assert.deepEqual(DEFAULT_DND_SCHEDULE, { enabled: false, start: '22:00', end: '07:00' });
});

/* ---------- 50773 per-hunt quiet ---------- */

test('per-hunt quiet toggles and respects 1h expiry', () => {
  const now = 2_000_000;
  let m = {};
  m = toggleHuntQuiet(m, 'h1');
  assert.ok(isHuntQuiet(m, 'h1', now));
  assert.ok(!isHuntQuiet(m, 'h2', now));
  m = toggleHuntQuiet(m, 'h1');
  assert.ok(!isHuntQuiet(m, 'h1', now));
  m = { h1: now - 1000 }; // expired snooze
  assert.ok(!isHuntQuiet(m, 'h1', now));
});

/* ---------- 50774 idle timeout ---------- */

test('idleToastState countdown, show and pause thresholds', () => {
  const five = idleToastState(14 * 60 * 1000, 15 * 60 * 1000);
  assert.ok(five.showCountdown && !five.shouldPause);
  assert.equal(five.secondsLeft, 60);
  const over = idleToastState(16 * 60 * 1000, 15 * 60 * 1000);
  assert.ok(over.shouldPause);
  const early = idleToastState(60 * 1000, 15 * 60 * 1000);
  assert.ok(!early.showCountdown && !early.shouldPause);
});

/* ---------- 50781 priority policy ---------- */

test('toastAutoDismissMs: critical/error never auto-dismiss', () => {
  assert.equal(toastAutoDismissMs({ severity: 'critical' }), Infinity);
  assert.equal(toastAutoDismissMs({ priority: 'critical' }), Infinity);
  assert.equal(toastAutoDismissMs({ severity: 'error' }), Infinity);
  assert.equal(toastAutoDismissMs({ requiresAck: true }), Infinity);
  assert.equal(toastAutoDismissMs({ persistent: true }), Infinity);
  assert.equal(toastAutoDismissMs({ severity: 'warning', priority: 'warning' }), 8000);
  assert.equal(toastAutoDismissMs({ priority: 'micro' }), 1500);
  assert.equal(toastAutoDismissMs({ severity: 'info' }), 5000);
});

/* ---------- 50785 duplicate suppression ---------- */

test('identical toasts within 60s suppress with a merge target', () => {
  const now = 3_000_000;
  const a = {
    id: 't1',
    title: 'Retest queued',
    body: 'f-1',
    severity: 'info',
    createdAt: now - 10_000,
  };
  const r = shouldSuppressToast(
    { title: 'Retest queued', body: 'f-1', severity: 'info' },
    [a],
    DUP_WINDOW_MS,
    now
  );
  assert.ok(r.suppress && r.mergeInto === 't1');
  const old = { ...a, createdAt: now - 120_000 };
  const r2 = shouldSuppressToast(
    { title: 'Retest queued', body: 'f-1', severity: 'info' },
    [old],
    DUP_WINDOW_MS,
    now
  );
  assert.ok(!r2.suppress);
  const r3 = shouldSuppressToast(
    { title: 'Other', body: 'f-1', severity: 'info' },
    [a],
    DUP_WINDOW_MS,
    now
  );
  assert.ok(!r3.suppress);
});

/* ---------- 50766/50783/50799 badges + history ---------- */

test('unread badges sync with history; mark-all-read clears them', () => {
  const h = [{ id: 'a' }, { id: 'b', readAt: 5 }, { id: 'c' }];
  assert.equal(unreadBadgeCount(h), 2);
  const marked = markAllRead(h, 9);
  assert.equal(unreadBadgeCount(marked), 0);
  assert.ok(marked.every(t => t.readAt));
});

/* ---------- 50794 session expiry ---------- */

test('sessionExpiryState warn/expire thresholds', () => {
  const now = 4_000_000;
  const soon = sessionExpiryState(now + 120_000, 5 * 60_000, now);
  assert.ok(soon.warn && !soon.expired && soon.secondsLeft === 120);
  const later = sessionExpiryState(now + 30 * 60_000, 5 * 60_000, now);
  assert.ok(!later.warn && !later.expired);
  const gone = sessionExpiryState(now - 1_000, 5 * 60_000, now);
  assert.ok(gone.expired && !gone.warn);
});

/* ---------- 50787 offline queue ---------- */

test('offline actions queue and drain in order', () => {
  const order = [];
  let s = enqueueOfflineAction([], { label: 'a', run: () => order.push('a') });
  s = enqueueOfflineAction(s.queue, { label: 'b', run: () => order.push('b') });
  assert.equal(s.queuedCount, 2);
  const { drained, queue } = drainOfflineQueue(s.queue);
  assert.equal(drained.length, 2);
  assert.equal(queue.length, 0);
  drained.forEach(a => a.run());
  assert.deepEqual(order, ['a', 'b']);
});

/* ---------- 50797 quota ---------- */

test('quotaLevel thresholds and payload severity', () => {
  assert.equal(quotaLevel(0.5), null);
  assert.equal(quotaLevel(0.8), 'warn80');
  assert.equal(quotaLevel(0.99), 'warn80');
  assert.equal(quotaLevel(1), 'warn100');
  assert.equal(quotaToastPayload('warn80').severity, 'warning');
  const w100 = quotaToastPayload('warn100');
  assert.equal(w100.severity, 'critical');
  assert.ok(w100.actions.includes('upgrade'));
});

/* ---------- emitters ---------- */

test('toast emitters carry the right actions', () => {
  const hc = huntCompleteToast('Nightly scan', 7);
  assert.deepEqual(hc.actions, ['view-report', 'start-next', 'dismiss']);
  assert.ok(hc.body.includes('7'));
  const hc0 = huntCompleteToast('Nightly scan', 0);
  assert.ok(hc0.body.includes('No confirmed'));
  const men = mentionToast('Shubham', 're-check?', 'c-42');
  assert.deepEqual(men.actions, ['jump', 'dismiss']);
  assert.ok(men.title.includes('Shubham'));
  let reloaded = false;
  const up = updateAvailableToast('2.4.1', () => {
    reloaded = true;
  });
  up.onAction('reload');
  assert.ok(reloaded);
  let downloaded = false;
  const ex = exportReadyToast('report.pdf', () => {
    downloaded = true;
  });
  assert.deepEqual(ex.actions, ['download', 'dismiss']);
  ex.onAction('download');
  assert.ok(downloaded);
  const pc = permissionChangeToast('Hunt #42', 'editor');
  assert.ok(pc.body.includes('editor'));
  const le = learningEventToast('new dedup rule');
  assert.ok(le.body.includes('dedup'));
  const sh = scheduledHuntToast('Nightly', 'example.com');
  assert.ok(sh.title.includes('Nightly'));
});

/* ---------- 50800 first-run checklist ---------- */

test('first-run checklist state machine and celebration', () => {
  assert.equal(FIRST_RUN_STEPS.length, 4);
  assert.deepEqual(
    FIRST_RUN_STEPS.map(s => s.id),
    ['paste-target', 'run-hunt', 'review-finding', 'export-report']
  );
  let st = checklistState([]);
  assert.equal(st.done, 0);
  assert.equal(st.nextStep.id, 'paste-target');
  assert.ok(!st.allDone && !st.celebrate);
  let done = completeChecklistStep([], 'paste-target');
  done = completeChecklistStep(done, 'run-hunt');
  done = completeChecklistStep(done, 'review-finding');
  st = checklistState(done);
  assert.equal(st.done, 3);
  assert.equal(st.nextStep.id, 'export-report');
  done = completeChecklistStep(done, 'export-report');
  st = checklistState(done);
  assert.ok(st.allDone && st.celebrate && st.nextStep === null);
  const dup = completeChecklistStep(done, 'export-report');
  assert.equal(dup.length, 4); // idempotent
});

/* ---------- 50795 theme-tested toasts ---------- */

test('toast colors pass WCAG audit on all four themes', () => {
  const failures = [];
  for (const themeId of Object.keys(THEMES)) {
    const rows = auditToastContrast(themeId, contrastRatio);
    assert.ok(rows.length > 0);
    for (const r of rows) {
      assert.ok(r.ratio > 1 && r.ratio <= 21, `ratio ${r.ratio} sane for ${themeId}/${r.severity}`);
      if (!r.pass) failures.push(`${themeId}/${r.severity}/${r.role} ratio=${r.ratio.toFixed(2)}`);
    }
  }
  assert.deepEqual(failures, [], 'all toast colors must meet contrast minimums');
});

test('toast colors resolve per theme and fall back without one', () => {
  const dark = toastColorsForTheme('dark');
  assert.equal(dark.critical, THEMES.dark.severity.critical);
  assert.equal(dark.info, THEMES.dark.accent);
  const light = toastColorsForTheme('light');
  assert.equal(light.critical, THEMES.light.severity.critical);
  const fallback = toastColorsForTheme(null);
  assert.deepEqual(fallback, TOAST_SEVERITY_COLORS);
  assert.equal(resolveToastSeverityColor('high', 'dim'), THEMES.dim.severity.high);
  assert.equal(resolveToastSeverityColor('nonsense', 'dark'), THEMES.dark.accent);
  assert.equal(currentThemeId(), null); // no document in node
});

/* ---------- 50775 micro toast ---------- */

test('copy micro-toast payload auto-dismisses in 1.5s', () => {
  const m = copyMicroToastPayload('PoC copied');
  assert.equal(m.priority, 'micro');
  assert.equal(toastAutoDismissMs(m), 1500);
});

/* ---------- source audits ---------- */

test('ToastRound3.jsx exports every wave-20 component/hook', () => {
  const jsx = src('ToastRound3.jsx');
  for (const name of [
    'ToastProvider',
    'useToast',
    'ToastCard', // integration surface (imported from ToastCenter)
    'useProgressToast',
    'useDedupedToast',
    'useUndoToast',
    'useCopyToast',
    'useConnectionToast',
    'useOfflineQueue',
    'useToastSoundsSetting',
    'useDndSchedule',
    'usePerHuntQuiet',
    'IdleTimeoutWatcher',
    'SessionExpiryWatcher',
    'QuotaWatcher',
    'UpdateChecker',
    'NotificationCenter',
    'DndScheduleSettings',
    'ToastSoundsSetting',
    'PerHuntQuietToggle',
    'TestNotificationButton',
    'FirstRunChecklist',
    'ToastLab',
    'ToastRound3Gallery',
    'WAVE20_IDEAS',
  ])
    assert.ok(jsx.includes(name), `missing export ${name}`);
});

test('ToastCenter.jsx carries wave-20 provider behaviors', () => {
  const c = src('ToastCenter.jsx');
  for (const needle of [
    'updateToast',
    'markHistoryRead',
    'UndoCountdown',
    'toastAutoDismissMs',
    'playToastTone',
    'triggerRef',
    'Escape',
    'toast-critical',
    'toast-dup',
    'toast-progress',
    'toast-sev-label',
    'toast-thumb',
    'onBodyClick',
    'autoExpand',
  ])
    assert.ok(c.includes(needle), `ToastCenter.jsx missing ${needle}`);
});

test('ToastRound3.css has fade-only reduced motion, above-modal z-index, and new styles', () => {
  const css = src('ToastRound3.css');
  assert.ok(css.includes('@keyframes toast-fade'));
  assert.ok(css.includes('prefers-reduced-motion'));
  assert.ok(css.includes('z-index: 20000'));
  for (const cls of [
    '.toast-progress',
    '.toast-undo-count',
    '.notif-drawer',
    '.first-run',
    '.toast-lab',
    '.toast-finding-detail',
  ]) {
    assert.ok(css.includes(cls), `css missing ${cls}`);
  }
});

test('no mock/demo/placeholder debris in wave-20 files', () => {
  const todoTag = 'TO' + 'DO:'; // constructed so this file doesn't match itself
  const fixTag = 'FI' + 'XME';
  const files = ['toastRound3Core.js', 'ToastRound3.jsx', 'ToastRound3.css', 'wave20.test.js'];
  for (const f of files) {
    const t = src(f);
    assert.ok(!t.includes(todoTag), `${f}: leftover marker found`);
    assert.ok(!t.toLowerCase().includes(fixTag.toLowerCase()), `${f}: leftover marker found`);
    assert.ok(!t.toLowerCase().includes('lorem' + ' ipsum'), `${f}: placeholder text found`);
  }
});
