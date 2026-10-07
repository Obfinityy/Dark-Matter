/**
 * toastRound3Core.js — wave 20 (ideas 50761–50800): toast round 3 pure logic.
 *
 * Pure, framework-free logic for the extended toast system: progress toasts,
 * undo windows, severity tones, overnight DND, per-hunt quiet mode, idle
 * timeout countdowns, duplicate suppression, toast priority policy,
 * notification-center badge sync, session-expiry state, offline action queue,
 * quota warnings, first-run checklist state machine, and a WCAG contrast
 * audit of toast colors across all four Infinity themes (50795).
 *
 * Honest SKIPs (already live in wave 19, never re-implemented):
 *   50762 toast grouping, 50767 10s/category rate limiting, 50772 polite
 *   screen-reader live region.
 */

import { THEMES } from './themeCore.js';
import { TOAST_SEVERITY_COLORS } from './dashboardRound2Core.js';

export const WAVE20_IDEAS = [
  [50761, 'Progress toasts', 'new'],
  [50762, 'Toast grouping', 'skip', 'live in wave 19: groupFindingsToast + expandable summary'],
  [50763, 'Undo toast', 'new'],
  [50764, 'Toast sounds', 'new'],
  [50765, 'Do-not-disturb schedule', 'new'],
  [50766, 'Toast history', 'new'],
  [50767, 'Toast rate limiting', 'skip', 'live in wave 19: rateLimitOk (10s per category)'],
  [50768, 'Hunt-complete toast', 'new'],
  [50769, 'Connection-lost toast', 'new'],
  [50770, 'Reduced-motion toasts', 'new'],
  [50771, 'Keyboard-dismissable toasts', 'new'],
  [50772, 'Toast screen-reader announcements', 'skip', 'live in wave 19: polite aria-live region'],
  [50773, 'Per-hunt quiet mode', 'new'],
  [50774, 'Idle-timeout countdown toast', 'new'],
  [50775, 'Copy micro-toast', 'new'],
  [50776, 'Hover-paused toasts', 'new'],
  [50777, 'Swipe-to-dismiss', 'new'],
  [50778, 'Mention toast', 'new'],
  [50779, 'Update-available toast', 'new'],
  [50780, 'Toast thumbnails', 'new'],
  [50781, 'Toast priority levels', 'new'],
  [50782, 'Clickable toast body', 'new'],
  [50783, 'Mark-all-read', 'new'],
  [50784, 'Scheduled-hunt toast', 'new'],
  [50785, 'Duplicate suppression (hunt-ux)', 'new'],
  [50786, 'Capped toast width', 'new'],
  [50787, 'Offline-action toasts', 'new'],
  [50788, 'Learning-event toast', 'new'],
  [50789, 'Export-ready toast', 'new'],
  [50790, 'Above-modal z-index', 'new'],
  [50791, 'Snooze-1h action', 'new'],
  [50792, 'Labeled toast icons', 'new'],
  [50793, 'Permission-change toast', 'new'],
  [50794, 'Session-expiry toast', 'new'],
  [50795, 'Theme-tested toasts', 'new'],
  [50796, 'Test-notification button', 'new'],
  [50797, 'Quota-warning toasts', 'new'],
  [50798, 'Auto-expanded criticals', 'new'],
  [50799, 'Synced badge counts', 'new'],
  [50800, 'First-run checklist', 'new'],
].map(([id, title, status, skipReason]) => ({ id, title, status, skipReason: skipReason || null }));

/* ------------------------------------------------------------------ */
/* 50761 — Progress toasts                                             */
/* ------------------------------------------------------------------ */

/** Create a progress toast payload. `total` is the expected step count. */
export function createProgressToast(title, total, opts = {}) {
  return {
    kind: 'progress',
    severity: opts.severity || 'info',
    title,
    total: Math.max(1, total | 0),
    done: 0,
    progress: 0,            // 0..1
    status: 'running',      // running | complete | failed
    body: opts.body || '',
    persistent: true,       // never auto-dismiss while running
    dismissOnComplete: opts.dismissOnComplete !== false,
    completeDelayMs: opts.completeDelayMs ?? 2500,
  };
}

/** Advance a progress toast. Returns a new toast object. */
export function advanceProgressToast(toast, done, total = toast.total) {
  const nextTotal = Math.max(1, total);
  const nextDone = Math.min(Math.max(0, done), nextTotal);
  const progress = nextDone / nextTotal;
  const status = progress >= 1 ? 'complete' : toast.status === 'failed' ? 'failed' : 'running';
  return { ...toast, total: nextTotal, done: nextDone, progress, status };
}

export function failProgressToast(toast, error) {
  return { ...toast, status: 'failed', body: error || toast.body, persistent: true };
}

/* ------------------------------------------------------------------ */
/* 50763 — Undo toast (5-second restore window)                         */
/* ------------------------------------------------------------------ */

export const UNDO_WINDOW_MS = 5000;

/** Milliseconds left in the undo window; 0 once expired. */
export function undoRemainingMs(createdAt, windowMs = UNDO_WINDOW_MS, now = Date.now()) {
  return Math.max(0, windowMs - (now - createdAt));
}

export function undoExpired(createdAt, windowMs = UNDO_WINDOW_MS, now = Date.now()) {
  return now - createdAt >= windowMs;
}

/** Undo-toast payload; `onUndo` fires when the user confirms the restore. */
export function undoToastPayload(title, body, onUndo) {
  return {
    kind: 'undo',
    severity: 'info',
    title,
    body,
    actions: ['undo', 'dismiss'],
    onAction: (action) => { if (action === 'undo' && typeof onUndo === 'function') onUndo(); },
    undoDeadline: Date.now() + UNDO_WINDOW_MS,
  };
}

/* ------------------------------------------------------------------ */
/* 50764 — Toast sounds (distinct tone per severity)                    */
/* ------------------------------------------------------------------ */

/** WebAudio tone spec per severity. Real audio, gated behind a setting. */
export function toneSpecForSeverity(severity) {
  switch (severity) {
    case 'critical': return { freq: 880, duration: 0.35, type: 'sawtooth', gain: 0.12 };
    case 'high':     return { freq: 660, duration: 0.25, type: 'square',   gain: 0.08 };
    case 'medium':   return { freq: 520, duration: 0.20, type: 'sine',     gain: 0.10 };
    case 'low':      return { freq: 440, duration: 0.15, type: 'sine',     gain: 0.08 };
    default:         return { freq: 500, duration: 0.15, type: 'sine',     gain: 0.07 };
  }
}

/**
 * Play the severity tone. `ctxFactory` defaults to a fresh AudioContext;
 * pass a fake in tests. Returns false when audio is unavailable.
 */
export function playToastTone(severity, ctxFactory) {
  const make = ctxFactory || (() => {
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    return AC ? new AC() : null;
  });
  const ctx = make();
  if (!ctx || !ctx.createOscillator) return false;
  const spec = toneSpecForSeverity(severity);
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = spec.type;
    osc.frequency.value = spec.freq;
    gain.gain.setValueAtTime(spec.gain, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + spec.duration);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + spec.duration);
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* 50765 — Do-not-disturb schedule for toasts                           */
/* ------------------------------------------------------------------ */

/** Parse "HH:MM" into minutes since midnight; NaN-safe. */
export function hhmmToMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
  if (!m) return null;
  const h = +m[1]; const min = +m[2];
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Is DND active right now? Handles overnight wrap (e.g. 22:00–07:00).
 * `schedule`: { enabled, start: 'HH:MM', end: 'HH:MM' }. `now` injectable.
 */
export function dndActive(schedule, now = new Date()) {
  if (!schedule || !schedule.enabled) return false;
  const start = hhmmToMinutes(schedule.start);
  const end = hhmmToMinutes(schedule.end);
  if (start === null || end === null) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  if (start === end) return false;
  if (start < end) return cur >= start && cur < end;
  return cur >= start || cur < end; // wraps midnight
}

export const DEFAULT_DND_SCHEDULE = { enabled: false, start: '22:00', end: '07:00' };

/* ------------------------------------------------------------------ */
/* 50773 — Per-hunt quiet mode                                          */
/* ------------------------------------------------------------------ */

/** quietMap: { [huntId]: expiresAtMs | true }. `true` = muted indefinitely. */
export function isHuntQuiet(quietMap, huntId, now = Date.now()) {
  if (!quietMap || huntId == null) return false;
  const v = quietMap[huntId];
  if (v === true) return true;
  if (typeof v === 'number') return v > now;
  return false;
}

export function toggleHuntQuiet(quietMap, huntId) {
  const next = { ...(quietMap || {}) };
  if (isHuntQuiet(next, huntId)) delete next[huntId];
  else next[huntId] = true;
  return next;
}

/* ------------------------------------------------------------------ */
/* 50774 — Idle-timeout countdown toast                                 */
/* ------------------------------------------------------------------ */

/** State for the "Hunt pauses in Ns (idle timeout)" toast. */
export function idleToastState(elapsedMs, timeoutMs, now = Date.now()) {
  const left = Math.max(0, timeoutMs - elapsedMs);
  return {
    secondsLeft: Math.ceil(left / 1000),
    shouldPause: left <= 0,
    showCountdown: left <= 60000 && left > 0,
  };
}

/* ------------------------------------------------------------------ */
/* 50781 — Toast priority levels                                        */
/* ------------------------------------------------------------------ */

/**
 * Priority policy: critical persists until dismissed; errors persist until
 * acknowledged; warnings auto-dismiss after 8s; info after 5s; micro after 1.5s.
 * Returns auto-dismiss delay in ms, or Infinity for "never auto-dismiss".
 */
export function toastAutoDismissMs(toast) {
  if (toast.persistent || toast.requiresAck) return Infinity;
  switch (toast.priority || toast.severity) {
    case 'critical': return Infinity;
    case 'error':    return Infinity;   // ack-required per wave 19's errorToast
    case 'warning':  return 8000;
    case 'micro':    return 1500;        // 50775 copy micro-toast
    default:         return 5000;
  }
}

/* ------------------------------------------------------------------ */
/* 50785 — Duplicate suppression (60s window, counter badge)            */
/* ------------------------------------------------------------------ */

export const DUP_WINDOW_MS = 60000;

/**
 * If an identical toast (same title+body+severity) fired within the window,
 * suppress the new one and bump the existing one's dupCount instead.
 * Returns { suppress: boolean, mergeInto: id|null }.
 */
export function shouldSuppressToast(newToast, recent, windowMs = DUP_WINDOW_MS, now = Date.now()) {
  const key = (t) => `${t.severity || 'info'}|${t.title || ''}|${t.body || ''}`;
  const want = key(newToast);
  for (const t of recent || []) {
    if (key(t) === want && (now - (t.createdAt || 0)) < windowMs) {
      return { suppress: true, mergeInto: t.id || null };
    }
  }
  return { suppress: false, mergeInto: null };
}

/* ------------------------------------------------------------------ */
/* 50766 / 50783 / 50799 — notification-center history + badges         */
/* ------------------------------------------------------------------ */

/** Unread badge count = history entries not yet marked read. */
export function unreadBadgeCount(history) {
  return (history || []).filter((t) => !t.readAt).length;
}

/** Mark every history entry read. Returns a new array. */
export function markAllRead(history, now = Date.now()) {
  return (history || []).map((t) => ({ ...t, readAt: t.readAt || now }));
}

/* ------------------------------------------------------------------ */
/* 50794 — Session-expiry toast                                         */
/* ------------------------------------------------------------------ */

/** Warn state for an expiring session; `warnBeforeMs` triggers the toast. */
export function sessionExpiryState(expiresAt, warnBeforeMs = 5 * 60 * 1000, now = Date.now()) {
  const left = expiresAt - now;
  return {
    expired: left <= 0,
    warn: left > 0 && left <= warnBeforeMs,
    secondsLeft: Math.max(0, Math.ceil(left / 1000)),
  };
}

/* ------------------------------------------------------------------ */
/* 50787 — Offline-action toasts ("will sync when back online")         */
/* ------------------------------------------------------------------ */

export function enqueueOfflineAction(queue, action) {
  const base = queue || [];
  const entry = { ...action, queuedAt: Date.now(), id: `qa-${Date.now()}-${base.length}` };
  const next = [...base, entry];
  return { queue: next, queuedCount: next.length };
}

export function drainOfflineQueue(queue) {
  return { drained: [...(queue || [])], queue: [] };
}

/* ------------------------------------------------------------------ */
/* 50797 — Quota warnings (80% / 100%)                                  */
/* ------------------------------------------------------------------ */

/** Returns 'warn80' | 'warn100' | null given usage fraction 0..1. */
export function quotaLevel(usedFraction) {
  if (usedFraction >= 1) return 'warn100';
  if (usedFraction >= 0.8) return 'warn80';
  return null;
}

export function quotaToastPayload(level, planLabel = 'your plan') {
  if (level === 'warn100') {
    return {
      kind: 'quota', severity: 'critical', priority: 'critical',
      title: 'Quota exhausted',
      body: `You've used 100% of ${planLabel}. Hunts will pause until you upgrade or the quota resets.`,
      actions: ['upgrade', 'dismiss'],
    };
  }
  return {
    kind: 'quota', severity: 'warning', priority: 'warning',
    title: '80% of quota used',
    body: `You've used 80% of ${planLabel}. Consider upgrading for uninterrupted hunting.`,
    actions: ['upgrade', 'dismiss'],
  };
}

/* ------------------------------------------------------------------ */
/* 50768 / 50778 / 50779 / 50784 / 50788 / 50789 / 50793 — emitters     */
/* ------------------------------------------------------------------ */

export function huntCompleteToast(huntName, findingCount) {
  return {
    kind: 'hunt-complete', severity: 'info',
    title: `Hunt complete: ${huntName}`,
    body: findingCount === 0
      ? 'No confirmed findings this run.'
      : `${findingCount} confirmed finding${findingCount === 1 ? '' : 's'}.`,
    actions: ['view-report', 'start-next', 'dismiss'],
  };
}

export function mentionToast(author, commentPreview, commentId) {
  return {
    kind: 'mention', severity: 'info',
    title: `${author} mentioned you`,
    body: commentPreview,
    commentId,
    actions: ['jump', 'dismiss'],
  };
}

export function updateAvailableToast(version, reload) {
  return {
    kind: 'update', severity: 'info',
    title: `Update available (${version})`,
    body: 'A new frontend version is ready. Reload to apply it.',
    actions: ['reload', 'dismiss'],
    onAction: (a) => { if (a === 'reload' && typeof reload === 'function') reload(); },
  };
}

export function scheduledHuntToast(huntName, target) {
  return {
    kind: 'scheduled', severity: 'info',
    title: `Scheduled run started: ${huntName}`,
    body: `Scanning ${target}.`,
    actions: ['view', 'dismiss'],
  };
}

export function permissionChangeToast(huntName, newRole) {
  return {
    kind: 'permission', severity: 'info',
    title: 'Access updated',
    body: `You now have ${newRole} access to ${huntName}.`,
    actions: ['view', 'dismiss'],
  };
}

export function learningEventToast(ruleSummary) {
  return {
    kind: 'learning', severity: 'info',
    title: 'Agent learned something',
    body: ruleSummary,
    actions: ['view', 'dismiss'],
  };
}

export function exportReadyToast(exportName, download) {
  return {
    kind: 'export-ready', severity: 'info',
    title: 'Export ready',
    body: exportName,
    actions: ['download', 'dismiss'],
    onAction: (a) => { if (a === 'download' && typeof download === 'function') download(); },
  };
}

/* ------------------------------------------------------------------ */
/* 50800 — First-run checklist                                          */
/* ------------------------------------------------------------------ */

export const FIRST_RUN_STEPS = [
  { id: 'paste-target', label: 'Paste a target URL', hint: 'Drop any website into the hunt input.' },
  { id: 'run-hunt', label: 'Run your first hunt', hint: 'Start the autonomous agent on that target.' },
  { id: 'review-finding', label: 'Review a finding', hint: 'Open any finding card and read the evidence.' },
  { id: 'export-report', label: 'Export the report', hint: 'Download the PDF or Markdown bounty report.' },
];

/** Checklist state from a completed-step id set. */
export function checklistState(completedIds) {
  const done = FIRST_RUN_STEPS.filter((s) => (completedIds || []).includes(s.id));
  return {
    done: done.length,
    total: FIRST_RUN_STEPS.length,
    allDone: done.length === FIRST_RUN_STEPS.length,
    nextStep: FIRST_RUN_STEPS.find((s) => !(completedIds || []).includes(s.id)) || null,
    celebrate: done.length === FIRST_RUN_STEPS.length,
  };
}

export function completeChecklistStep(completedIds, stepId) {
  const next = new Set(completedIds || []);
  next.add(stepId);
  return [...next];
}

/* ------------------------------------------------------------------ */
/* 50795 — Theme-tested toasts: theme-aware colors + WCAG audit          */
/* ------------------------------------------------------------------ */

/**
 * Read the active Infinity theme id from the document root (set by
 * ThemeProvider). Never throws — returns null when unavailable.
 */
export function currentThemeId() {
  try {
    if (typeof document === 'undefined') return null;
    return document.documentElement.getAttribute('data-theme') || null;
  } catch {
    return null;
  }
}

/**
 * Severity colors for a theme: each Infinity theme ships its own
 * contrast-tuned severity palette (wave 17); info maps to the theme accent.
 * Falls back to the base toast palette when no theme is active.
 */
export function toastColorsForTheme(themeId) {
  const t = themeId && THEMES[themeId];
  if (!t) return { ...TOAST_SEVERITY_COLORS };
  return {
    critical: t.severity.critical,
    high: t.severity.high,
    medium: t.severity.medium,
    low: t.severity.low,
    info: t.accent,
  };
}

/** Theme-aware severity color; drop-in for toastSeverityColor. */
export function resolveToastSeverityColor(severity, themeId) {
  const colors = toastColorsForTheme(themeId);
  return colors[severity] || colors.info;
}

/**
 * Audit every severity color + toast text against a theme's surfaces.
 * Returns [{ themeId, severity, fg, bg, ratio, pass }].
 * dots: 3:1 non-text minimum; primary text: 4.5:1.
 * `contrast` is injected (a11yCore.contrastRatio) so this stays pure.
 */
export function auditToastContrast(themeId, contrast) {
  const theme = THEMES[themeId];
  if (!theme) return [];
  const toastColors = toastColorsForTheme(themeId);
  const results = [];
  const text = theme.text.primary;
  const bg = theme.surface.raised;
  const sevs = Object.keys(toastColors);
  for (const sev of sevs) {
    const fg = toastColors[sev];
    // Severity dot/swatch on the toast surface…
    results.push({ themeId, severity: sev, role: 'dot', fg, bg, ratio: contrast(fg, bg), pass: contrast(fg, bg) >= 3 });
    // …and primary text on the toast surface (must read at 4.5:1).
    if (sev === sevs[0]) {
      results.push({ themeId, severity: 'text', role: 'text', fg: text, bg, ratio: contrast(text, bg), pass: contrast(text, bg) >= 4.5 });
    }
  }
  return results;
}

/* ------------------------------------------------------------------ */
/* 50775 — Copy micro-toast helper                                      */
/* ------------------------------------------------------------------ */

export function copyMicroToastPayload(label = 'Copied') {
  return {
    kind: 'micro', severity: 'info', priority: 'micro',
    title: label,
    body: '',
    actions: [],
  };
}
