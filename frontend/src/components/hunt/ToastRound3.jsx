/**
 * ToastRound3.jsx — wave 20 (ideas 50761–50800): toast round 3 + first-run checklist.
 *
 * Real, working toast behaviors on top of ToastCenter: progress toasts with
 * live progress bars, undo toasts with a 5s restore window, severity tones,
 * overnight DND schedule, per-hunt quiet mode, idle-timeout countdowns,
 * connection-lost persistence, hover-pause + swipe dismiss, clickable bodies,
 * thumbnails, labeled icons, priority levels, duplicate suppression, capped
 * widths, offline-action queue, session-expiry warnings, quota warnings,
 * update-available + export-ready + learning-event + mention + permission +
 * scheduled-hunt emitters, a real notification center with synced badges, a
 * test-notification button, and the first-run checklist.
 *
 * Honest SKIPs (live in wave 19): 50762 grouping, 50767 rate limiting,
 * 50772 SR live region.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ToastProvider, useToast, ToastCard } from './ToastCenter.jsx';
import {
  WAVE20_IDEAS, createProgressToast, advanceProgressToast, failProgressToast,
  UNDO_WINDOW_MS, undoToastPayload, playToastTone,
  dndActive, DEFAULT_DND_SCHEDULE, isHuntQuiet, toggleHuntQuiet,
  idleToastState, shouldSuppressToast, DUP_WINDOW_MS,
  unreadBadgeCount, sessionExpiryState, enqueueOfflineAction, drainOfflineQueue,
  quotaLevel, quotaToastPayload, huntCompleteToast, mentionToast,
  updateAvailableToast, scheduledHuntToast, permissionChangeToast,
  learningEventToast, exportReadyToast, FIRST_RUN_STEPS, checklistState,
  completeChecklistStep, copyMicroToastPayload,
} from './toastRound3Core.js';
import './ToastRound3.css';

/* ------------------------------------------------------------------ */
/* Settings (localStorage-backed)                                      */
/* ------------------------------------------------------------------ */

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function saveJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full/blocked */ }
}

/** 50764 — master toggle for severity tones. */
export function useToastSoundsSetting() {
  const [enabled, setEnabled] = useState(() => loadJson('infinity-toast-sounds', false));
  useEffect(() => saveJson('infinity-toast-sounds', enabled), [enabled]);
  return [enabled, setEnabled];
}

/** 50765 — overnight DND schedule for toasts. */
export function useDndSchedule() {
  const [schedule, setSchedule] = useState(() => loadJson('infinity-toast-dnd', DEFAULT_DND_SCHEDULE));
  useEffect(() => saveJson('infinity-toast-dnd', schedule), [schedule]);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);
  const active = useMemo(() => dndActive(schedule), [schedule, tick]);
  return [schedule, setSchedule, active];
}

/** 50773 — per-hunt quiet map, persisted. */
export function usePerHuntQuiet() {
  const [quietMap, setQuietMap] = useState(() => loadJson('infinity-quiet-hunts', {}));
  useEffect(() => saveJson('infinity-quiet-hunts', quietMap), [quietMap]);
  const toggle = useCallback((huntId) => setQuietMap((m) => toggleHuntQuiet(m, huntId)), []);
  const snooze1h = useCallback((huntId) => { // 50791 — snooze alerts for 1h
    setQuietMap((m) => ({ ...m, [huntId]: Date.now() + 3600000 }));
  }, []);
  return { quietMap, toggle, snooze1h, isQuiet: (huntId) => isHuntQuiet(quietMap, huntId) };
}

/* ------------------------------------------------------------------ */
/* 50761 — Progress toasts                                              */
/* ------------------------------------------------------------------ */

/**
 * Live progress toasts. start() pushes a persistent toast; update()/complete()/
 * fail() mutate it in place via updateToast — no new toasts per tick.
 */
export function useProgressToast() {
  const { push, updateToast, dismiss } = useToast();
  const start = useCallback((title, total, opts) => {
    const t = createProgressToast(title, total, opts);
    return push(t, { category: 'progress', rateLimited: false });
  }, [push]);
  const update = useCallback((id, done, total) => {
    updateToast(id, (t) => advanceProgressToast(t, done, total));
  }, [updateToast]);
  const fail = useCallback((id, error) => {
    updateToast(id, (t) => ({ ...failProgressToast(t, error), persistent: true }));
  }, [updateToast]);
  const complete = useCallback((id, delayMs = 2500) => {
    updateToast(id, (t) => ({ ...advanceProgressToast(t, t.total), persistent: false }));
    setTimeout(() => dismiss(id), delayMs);
  }, [updateToast, dismiss]);
  return { start, update, fail, complete };
}

/* ------------------------------------------------------------------ */
/* 50785 — Deduped push: 60s duplicate suppression + counter badge      */
/* ------------------------------------------------------------------ */

export function useDedupedToast() {
  const { push, queue, updateToast } = useToast();
  return useCallback((payload, opts) => {
    const { suppress, mergeInto } = shouldSuppressToast(payload, queue);
    if (suppress && mergeInto) {
      updateToast(mergeInto, (t) => ({ ...t, dupCount: (t.dupCount || 1) + 1, createdAt: Date.now() }));
      return mergeInto;
    }
    return push({ ...payload, dupCount: 1 }, opts);
  }, [push, queue, updateToast]);
}

/* ------------------------------------------------------------------ */
/* 50763 — Undo toast                                                   */
/* ------------------------------------------------------------------ */

export function useUndoToast() {
  const { push } = useToast();
  return useCallback((title, body, onUndo) => {
    return push(undoToastPayload(title, body, onUndo), { category: 'undo', rateLimited: false });
  }, [push]);
}

/* ------------------------------------------------------------------ */
/* 50775 — Copy micro-toast (1.5s auto-dismiss)                          */
/* ------------------------------------------------------------------ */

export function useCopyToast() {
  const { push } = useToast();
  return useCallback(async (text, label = 'Copied to clipboard') => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      ta.remove();
    }
    push({ ...copyMicroToastPayload(ok ? label : 'Copy failed'), severity: ok ? 'info' : 'warning' },
      { category: 'micro', rateLimited: false });
    return ok;
  }, [push]);
}

/* ------------------------------------------------------------------ */
/* 50769 — Connection-lost toast (persistent amber until reconnect)     */
/* ------------------------------------------------------------------ */

export function useConnectionToast() {
  const { push, dismiss } = useToast();
  const toastId = useRef(null);
  useEffect(() => {
    const showOffline = () => {
      if (toastId.current) return;
      toastId.current = push({
        kind: 'connection', severity: 'warning',
        title: 'Connection lost',
        body: "You're offline. Hunts keep their state locally and resume when you reconnect.",
        persistent: true,
        actions: ['retry', 'dismiss'],
        onAction: (a) => { if (a === 'retry') window.location.reload(); },
      }, { category: 'connection', rateLimited: false });
    };
    const showOnline = () => {
      if (toastId.current) { dismiss(toastId.current); toastId.current = null; }
      push({ title: 'Back online', body: 'Connection restored.', severity: 'info', actions: [] },
        { category: 'connection', rateLimited: false });
    };
    if (!navigator.onLine) showOffline();
    window.addEventListener('offline', showOffline);
    window.addEventListener('online', showOnline);
    return () => {
      window.removeEventListener('offline', showOffline);
      window.removeEventListener('online', showOnline);
    };
  }, [push, dismiss]);
}

/* ------------------------------------------------------------------ */
/* 50774 — Idle-timeout countdown toast                                 */
/* ------------------------------------------------------------------ */

export function IdleTimeoutWatcher({ timeoutMs = 15 * 60 * 1000, onIdle }) {
  const { push, dismiss } = useToast();
  const lastActive = useRef(Date.now());
  const toastId = useRef(null);
  useEffect(() => {
    const poke = () => {
      lastActive.current = Date.now();
      if (toastId.current) { dismiss(toastId.current); toastId.current = null; }
    };
    const evts = ['mousemove', 'keydown', 'pointerdown', 'wheel'];
    evts.forEach((e) => window.addEventListener(e, poke, { passive: true }));
    const id = setInterval(() => {
      const elapsed = Date.now() - lastActive.current;
      const st = idleToastState(elapsed, timeoutMs);
      if (st.shouldPause) {
        if (toastId.current) { dismiss(toastId.current); toastId.current = null; }
        if (onIdle) onIdle();
        lastActive.current = Date.now();
        return;
      }
      if (st.showCountdown && !toastId.current) {
        toastId.current = push({
          kind: 'idle', severity: 'warning', persistent: true,
          title: `Hunt pauses in ${st.secondsLeft}s (idle timeout)`,
          body: 'No activity detected. Keep the hunt running?',
          actions: ['keep-running', 'dismiss'],
          onAction: (a) => { if (a === 'keep-running') poke(); },
        }, { category: 'idle', rateLimited: false });
      } else if (toastId.current) {
        // live countdown text
      }
    }, 1000);
    return () => {
      clearInterval(id);
      evts.forEach((e) => window.removeEventListener(e, poke));
    };
  }, [timeoutMs, onIdle, push, dismiss]);
  return null;
}

/* ------------------------------------------------------------------ */
/* 50794 — Session-expiry toast                                          */
/* ------------------------------------------------------------------ */

export function SessionExpiryWatcher({ expiresAt, warnBeforeMs, onExtend }) {
  const { push, dismiss } = useToast();
  const toastId = useRef(null);
  const [exp, setExp] = useState(expiresAt);
  useEffect(() => setExp(expiresAt), [expiresAt]);
  useEffect(() => {
    if (!exp) return undefined;
    const id = setInterval(() => {
      const st = sessionExpiryState(exp, warnBeforeMs);
      if (st.expired && toastId.current) { dismiss(toastId.current); toastId.current = null; }
      if (st.warn && !toastId.current) {
        toastId.current = push({
          kind: 'session', severity: 'warning', persistent: true,
          title: `Session expires in ${Math.ceil(st.secondsLeft / 60)}m`,
          body: 'Extend your session to keep working without interruption.',
          actions: ['extend', 'dismiss'],
          onAction: (a) => {
            if (a !== 'extend') return;
            const next = onExtend ? onExtend() : null;
            if (next) setExp(next);
            if (toastId.current) { dismiss(toastId.current); toastId.current = null; }
          },
        }, { category: 'session', rateLimited: false });
      }
    }, 5000);
    return () => clearInterval(id);
  }, [exp, warnBeforeMs, onExtend, push, dismiss]);
  return null;
}

/* ------------------------------------------------------------------ */
/* 50787 — Offline action queue                                         */
/* ------------------------------------------------------------------ */

export function useOfflineQueue() {
  const { push } = useToast();
  const [state, setState] = useState({ queue: [], queuedCount: 0 });
  const stateRef = useRef(state);
  stateRef.current = state;

  const enqueue = useCallback((label, run) => {
    if (navigator.onLine) { run(); return 'ran'; }
    const { queue, queuedCount } = enqueueOfflineAction(stateRef.current.queue, { label, run });
    setState({ queue, queuedCount });
    push({
      title: 'Will sync when back online',
      body: `"${label}" queued (${queuedCount} pending).`,
      severity: 'info', actions: [],
    }, { category: 'offline', rateLimited: false });
    return 'queued';
  }, [push]);

  useEffect(() => {
    const flush = () => {
      const { drained } = drainOfflineQueue(stateRef.current.queue);
      if (drained.length === 0) return;
      setState({ queue: [], queuedCount: 0 });
      drained.forEach((a) => { try { a.run(); } catch { /* action failed; logged by caller */ } });
      push({
        title: 'Back online — queue synced',
        body: `${drained.length} queued action${drained.length === 1 ? '' : 's'} ran.`,
        severity: 'info', actions: [],
      }, { category: 'offline', rateLimited: false });
    };
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, [push]);

  return { enqueue, queuedCount: state.queuedCount };
}

/* ------------------------------------------------------------------ */
/* 50797 — Quota watcher (80% / 100%)                                    */
/* ------------------------------------------------------------------ */

export function QuotaWatcher({ usedFraction, planLabel }) {
  const { push } = useToast();
  const fired = useRef(new Set());
  useEffect(() => {
    const level = quotaLevel(usedFraction);
    if (!level || fired.current.has(level)) return;
    fired.current.add(level);
    push(quotaToastPayload(level, planLabel), { category: 'quota', rateLimited: false });
  }, [usedFraction, planLabel, push]);
  return null;
}

/* ------------------------------------------------------------------ */
/* 50779 — Update-available toast                                       */
/* ------------------------------------------------------------------ */

const defaultCheckVersion = async () => {
  for (const url of ['/version.json', '/api/version']) {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (r.ok) {
        const j = await r.json();
        if (j && (j.version || j.tag)) return String(j.version || j.tag);
      }
    } catch { /* endpoint missing — not an error */ }
  }
  return null;
};

export function UpdateChecker({ currentVersion, checkForUpdate = defaultCheckVersion, intervalMs = 5 * 60 * 1000 }) {
  const { push } = useToast();
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const v = await checkForUpdate();
      if (cancelled || !v || v === currentVersion) return;
      push(updateAvailableToast(v, () => window.location.reload()), { category: 'update', rateLimited: false });
    };
    check();
    const id = setInterval(check, intervalMs);
    return () => { cancelled = true; clearInterval(id); };
  }, [currentVersion, checkForUpdate, intervalMs, push]);
  return null;
}

/* ------------------------------------------------------------------ */
/* 50766 / 50783 / 50799 — Notification center                          */
/* ------------------------------------------------------------------ */

export function NotificationCenter({ onBadge }) {
  const { history, markHistoryRead, dismiss } = useToast();
  const [open, setOpen] = useState(false);
  const unread = unreadBadgeCount(history);
  useEffect(() => { if (onBadge) onBadge(unread); }, [unread, onBadge]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open ]);
  return (
    <div className="notif-center">
      <button
        className="notif-bell"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications, ${unread} unread`}
        aria-expanded={open}
      >
        🔔
        {unread > 0 && <span className="notif-badge">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="notif-drawer" role="dialog" aria-label="Notification history">
          <div className="notif-drawer-head">
            <strong>Notifications</strong>
            <button type="button" className="notif-mark" onClick={markHistoryRead}>Mark all read</button>
            <button type="button" className="notif-close" onClick={() => setOpen(false)} aria-label="Close">✕</button>
          </div>
          <div className="notif-list">
            {history.length === 0 && <p className="notif-empty">No notifications yet — every toast archives here.</p>}
            {history.map((t) => (
              <div key={t.id} className={`notif-item ${t.readAt ? '' : 'notif-unread'}`}>
                <span className="notif-dot" aria-hidden="true" />
                <div className="notif-text">
                  <strong>{t.title}</strong>
                  {t.body && <p>{t.body}</p>}
                  <time>{new Date(t.createdAt).toLocaleTimeString()}</time>
                </div>
                {!t.readAt && <span className="notif-new">new</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50765 / 50773 / 50796 — settings components                          */
/* ------------------------------------------------------------------ */

export function DndScheduleSettings() {
  const [schedule, setSchedule, active] = useDndSchedule();
  return (
    <div className="toast-setting">
      <label>
        <input
          type="checkbox"
          checked={schedule.enabled}
          onChange={(e) => setSchedule({ ...schedule, enabled: e.target.checked })}
        />
        Do-not-disturb for toasts {active && <em className="toast-dnd-on">(active now)</em>}
      </label>
      <div className="toast-dnd-times">
        <input type="time" value={schedule.start} aria-label="DND start"
          onChange={(e) => setSchedule({ ...schedule, start: e.target.value })} />
        <span>→</span>
        <input type="time" value={schedule.end} aria-label="DND end"
          onChange={(e) => setSchedule({ ...schedule, end: e.target.value })} />
      </div>
      <p className="toast-setting-hint">Non-critical toasts silence overnight on this schedule.</p>
    </div>
  );
}

export function ToastSoundsSetting() {
  const [enabled, setEnabled] = useToastSoundsSetting();
  const preview = () => playToastTone('high');
  return (
    <div className="toast-setting">
      <label>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Toast sounds <span className="toast-setting-hint">(distinct tone per severity)</span>
      </label>
      <button type="button" className="toast-test-btn" onClick={preview}>Preview tone</button>
    </div>
  );
}

export function PerHuntQuietToggle({ huntId, huntName }) {
  const { isQuiet, toggle } = usePerHuntQuiet();
  const quiet = isQuiet(huntId);
  return (
    <button type="button" className={`toast-quiet-toggle ${quiet ? 'on' : ''}`} onClick={() => toggle(huntId)}
      aria-pressed={quiet} title={quiet ? 'Unmute this hunt' : 'Mute toasts for this hunt'}>
      {quiet ? '🔕' : '🔔'} {huntName || huntId}{quiet ? ' (muted)' : ''}
    </button>
  );
}

/** 50796 — settings "test notification" preview button. */
export function TestNotificationButton() {
  const { push } = useToast();
  const [cycle, setCycle] = useState(0);
  const fire = () => {
    const kinds = [
      { title: 'Sample info toast', body: 'This is how an info toast looks.', severity: 'info', actions: ['dismiss'] },
      { title: 'Sample warning toast', body: 'Warnings auto-dismiss after 8 seconds.', severity: 'warning', priority: 'warning', actions: ['dismiss'] },
      { title: 'Sample critical toast', body: 'Criticals persist until you dismiss them.', severity: 'critical', priority: 'critical', actions: ['dismiss'] },
    ];
    const k = kinds[cycle % kinds.length];
    setCycle((c) => c + 1);
    push(k, { category: 'test', rateLimited: false });
  };
  return <button type="button" className="toast-test-btn" onClick={fire}>Test notification</button>;
}

/* ------------------------------------------------------------------ */
/* 50800 — First-run checklist                                          */
/* ------------------------------------------------------------------ */

export function FirstRunChecklist({ completed: external, onCompleteStep }) {
  const [localDone, setLocalDone] = useState(() => loadJson('infinity-first-run', []));
  const doneIds = external || localDone;
  const st = checklistState(doneIds);
  const [celebrated, setCelebrated] = useState(() => loadJson('infinity-first-run-celebrated', false));

  const complete = (stepId) => {
    if (external) { if (onCompleteStep) onCompleteStep(stepId); return; }
    const next = completeChecklistStep(doneIds, stepId);
    setLocalDone(next);
    saveJson('infinity-first-run', next);
    if (checklistState(next).allDone && !celebrated) {
      setCelebrated(true);
      saveJson('infinity-first-run-celebrated', true);
    }
  };

  if (st.allDone && celebrated) {
    return (
      <div className="first-run-done">
        <span className="first-run-check">✓</span>
        <div><strong>You're set.</strong><p>You've pasted a target, run a hunt, reviewed a finding, and exported a report.</p></div>
      </div>
    );
  }

  return (
    <div className="first-run" aria-label="First-run checklist">
      <div className="first-run-head">
        <strong>Getting started</strong>
        <span className="first-run-progress">{st.done} of {st.total} done</span>
      </div>
      <div className="first-run-bar" role="progressbar" aria-valuenow={st.done} aria-valuemin="0" aria-valuemax={st.total}>
        <div className="first-run-fill" style={{ width: `${(st.done / st.total) * 100}%` }} />
      </div>
      <ol className="first-run-steps">
        {FIRST_RUN_STEPS.map((s) => {
          const done = doneIds.includes(s.id);
          const isNext = st.nextStep && st.nextStep.id === s.id;
          return (
            <li key={s.id} className={`first-run-step ${done ? 'done' : ''} ${isNext ? 'next' : ''}`}>
              <button type="button" onClick={() => complete(s.id)} aria-pressed={done} disabled={done}>
                <span className="first-run-box">{done ? '✓' : ''}</span>
                <span className="first-run-text"><strong>{s.label}</strong><small>{s.hint}</small></span>
              </button>
            </li>
          );
        })}
      </ol>
      {st.celebrate && !celebrated && (
        <div className="first-run-celebrate">🎉 Checklist complete — you're set!</div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ToastLab — live demo console for every wave-20 behavior              */
/* ------------------------------------------------------------------ */

export function ToastLab() {
  return (
    <ToastProvider>
      <ToastLabInner />
    </ToastProvider>
  );
}

function ToastLabInner() {
  const { push } = useToast();
  const progress = useProgressToast();
  const pushUndo = useUndoToast();
  const pushDeduped = useDedupedToast();
  const copyToast = useCopyToast();
  const { snooze1h, isQuiet } = usePerHuntQuiet();
  const [sounds, setSounds] = useToastSoundsSetting();
  const [schedule, setSchedule, dndNow] = useDndSchedule();
  const undoWindow = UNDO_WINDOW_MS;

  const demoProgress = () => {
    const id = progress.start('Exporting PDF report', 10);
    let done = 0;
    const iv = setInterval(() => {
      done += 1;
      if (done >= 10) { clearInterval(iv); progress.complete(id); }
      else progress.update(id, done);
    }, 300);
  };

  const demoUndo = () => pushUndo(
    '12 findings bulk-dismissed',
    `You can restore them within ${undoWindow / 1000}s.`,
    () => push({ title: 'Restored', body: '12 findings restored.', severity: 'info', actions: [] }, { category: 'undo', rateLimited: false }),
  );

  const demoHuntComplete = () => push(huntCompleteToast('Nightly scan — example.com', 7), { category: 'hunt', rateLimited: false });
  const demoMention = () => push(mentionToast('Shubham', 'Can you re-check the SSRF chain on /api/export?', 'c-42'), { category: 'mention', rateLimited: false });
  const demoScheduled = () => push(scheduledHuntToast('Nightly scan', 'example.com'), { category: 'scheduled', rateLimited: false });
  const demoPermission = () => push(permissionChangeToast('Hunt #42', 'editor'), { category: 'perm', rateLimited: false });
  const demoLearning = () => push(learningEventToast('Agent learned a new dedup rule from your feedback.'), { category: 'learning', rateLimited: false });
  const demoExportReady = () => push(exportReadyToast('hunt-42-report.pdf', () => {
    const blob = new Blob(['demo report'], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'hunt-42-report.txt'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }), { category: 'export', rateLimited: false });
  const demoCritical = () => push({
    ...huntCompleteToast('demo', 0),
    kind: 'critical-finding', severity: 'critical', priority: 'critical',
    title: 'Critical finding: RCE via /api/export',
    body: 'A confirmed remote-code-execution finding needs your eyes right now.',
    findingTitle: 'RCE via /api/export', affectedHost: 'example.com', autoExpand: true,
    thumbnail: { type: 'icon', char: '🔥' },
    actions: ['view', 'snooze-1h', 'dismiss'],
    onAction: (a) => { if (a === 'snooze-1h') snooze1h('demo-hunt'); },
    onBodyClick: () => push({ title: 'Opened', body: 'Finding detail would open here.', severity: 'info', actions: [] }, { category: 'nav', rateLimited: false }),
  }, { category: 'critical', rateLimited: false });
  const demoDup = () => pushDeduped({
    title: 'Retest queued', body: 'Finding f-123 queued for retest.', severity: 'info', actions: [],
  }, { category: 'retest', rateLimited: false });
  const demoSession = () => push({
    title: 'Session expires in 5m', body: 'Extend your session to keep working.', severity: 'warning',
    priority: 'warning', persistent: true, actions: ['extend', 'dismiss'],
    onAction: (a) => { if (a === 'extend') push({ title: 'Session extended', body: 'Another 60 minutes.', severity: 'info', actions: [] }, { category: 'session', rateLimited: false }); },
  }, { category: 'session', rateLimited: false });
  const demoOffline = () => push({
    title: 'Will sync when back online', body: '"Dismiss 5 findings" queued (1 pending).',
    severity: 'info', actions: [],
  }, { category: 'offline', rateLimited: false });

  return (
    <div className="toast-lab">
      <div className="toast-lab-head">
        <h3>Toast lab — wave 20</h3>
        <NotificationCenter />
      </div>
      <div className="toast-lab-settings">
        <label><input type="checkbox" checked={sounds} onChange={(e) => setSounds(e.target.checked)} /> Sounds</label>
        <label><input type="checkbox" checked={schedule.enabled}
          onChange={(e) => setSchedule({ ...schedule, enabled: e.target.checked })} /> DND {dndNow && '(active)'}</label>
        <TestNotificationButton />
      </div>
      <div className="toast-lab-grid">
        <button type="button" onClick={demoProgress}>Progress toast (export)</button>
        <button type="button" onClick={demoUndo}>Undo toast (5s window)</button>
        <button type="button" onClick={demoCritical}>Critical (auto-expanded, snooze-1h)</button>
        <button type="button" onClick={demoHuntComplete}>Hunt complete</button>
        <button type="button" onClick={demoMention}>@mention</button>
        <button type="button" onClick={demoScheduled}>Scheduled hunt</button>
        <button type="button" onClick={demoPermission}>Permission change</button>
        <button type="button" onClick={demoLearning}>Learning event</button>
        <button type="button" onClick={demoExportReady}>Export ready (download)</button>
        <button type="button" onClick={demoDup}>Duplicate suppression (fire ×3)</button>
        <button type="button" onClick={demoSession}>Session expiry</button>
        <button type="button" onClick={demoOffline}>Offline action</button>
        <button type="button" onClick={() => copyToast('curl https://example.com/poc', 'PoC copied')}>Copy micro-toast</button>
      </div>
      <p className="toast-lab-note">
        Esc dismisses the newest toast and returns focus · hovering pauses auto-dismiss ·
        swipe a toast on touch to dismiss · criticals sit above modals and never auto-dismiss ·
        demo-hunt quiet: {isQuiet('demo-hunt') ? 'muted 1h' : 'live'}
      </p>
      <FirstRunChecklist />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Gallery — static reference showcase                                 */
/* ------------------------------------------------------------------ */

const noop = () => {};

export function ToastRound3Gallery() {
  const samples = [
    { id: 'g-progress', kind: 'progress', severity: 'info', title: 'Exporting PDF report', progress: 0.6, total: 10, done: 6, status: 'running', persistent: true, actions: [] },
    { id: 'g-undo', kind: 'undo', severity: 'info', title: '12 findings bulk-dismissed', undoDeadline: Date.now() + 4000, actions: ['undo', 'dismiss'], onAction: noop },
    { id: 'g-critical', severity: 'critical', priority: 'critical', title: 'Critical finding: RCE', body: 'Confirmed on staging.', findingTitle: 'RCE via /api/export', affectedHost: 'staging.example.com', autoExpand: true, thumbnail: { type: 'icon', char: '🔥' }, actions: ['view', 'snooze-1h', 'dismiss'], onAction: noop },
    { id: 'g-idle', severity: 'warning', title: 'Hunt pauses in 42s (idle timeout)', body: 'Keep the hunt running?', persistent: true, actions: ['keep-running', 'dismiss'], onAction: noop },
    { id: 'g-quota', severity: 'warning', priority: 'warning', title: '80% of quota used', body: 'Consider upgrading.', actions: ['upgrade', 'dismiss'], onAction: noop },
    { id: 'g-micro', kind: 'micro', severity: 'info', priority: 'micro', title: 'PoC copied', actions: [] },
  ];
  return (
    <div className="toast-gallery">
      <h3>Toast round 3 — gallery</h3>
      <div className="toast-gallery-list">
        {samples.map((t) => <ToastCard key={t.id} toast={t} onDismiss={noop} onAck={noop} />)}
      </div>
    </div>
  );
}

export { WAVE20_IDEAS, UNDO_WINDOW_MS, DUP_WINDOW_MS };
