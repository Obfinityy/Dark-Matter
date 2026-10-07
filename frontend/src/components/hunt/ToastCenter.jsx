/**
 * ToastCenter.jsx — wave 19 (ideas 50755–50760): the notification/toast
 * system. Severity-colored toasts with real inline actions, max-3 stacking
 * with a "+N more" overflow chip, persistent error toasts that require
 * acknowledgement, and a configurable anchor position.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  stackToasts, rateLimitOk, groupFindingsToast, criticalToast, phaseToast,
  errorToast, actionToast, toastSeverityColor, resolveToastPosition,
  TOAST_POSITIONS, DEFAULT_TOAST_POSITION, MOBILE_TOAST_POSITION,
} from './dashboardRound2Core.js';
import { toastAutoDismissMs, playToastTone, resolveToastSeverityColor, currentThemeId } from './toastRound3Core.js';
import './ToastCenter.css';

const ToastCtx = createContext(null);
let toastSeq = 1;

export function ToastProvider({
  children,
  position = null,        // setting override; null = responsive default
  sounds = false,         // distinct tones per severity when enabled (placeholder)
  doNotDisturb = false,   // silence non-critical toasts (50765-adjacent, off by default)
}) {
  const [queue, setQueue] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [history, setHistory] = useState([]);
  const lastFired = useRef({});
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia ? window.matchMedia('(max-width: 640px)') : null;
    const update = () => setIsMobile(mq ? mq.matches : window.innerWidth <= 640);
    update();
    if (mq && mq.addEventListener) { mq.addEventListener('change', update); return () => mq.removeEventListener('change', update); }
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const resolvedPosition = resolveToastPosition(position, isMobile);
  const triggerRef = useRef(null); // 50771 — element that had focus when a toast arrived

  const push = useCallback((payload, { category = 'general', rateLimited = true } = {}) => {
    if (rateLimited && !rateLimitOk(lastFired.current, category)) return null;
    lastFired.current[category] = Date.now();
    if (doNotDisturb && payload.severity !== 'critical') return null;
    const active = document.activeElement;
    if (active && active !== document.body) triggerRef.current = active; // 50771
    const toast = { ...payload, id: `toast-${toastSeq++}`, createdAt: Date.now() };
    setQueue((q) => [...q, toast]);
    setHistory((h) => [toast, ...h].slice(0, 100));
    if (sounds) playToastTone(toast.severity); // 50764 — distinct tone per severity
    return toast.id;
  }, [doNotDisturb, sounds]);

  const dismiss = useCallback((id) => {
    setQueue((q) => q.filter((t) => t.id !== id));
  }, []);

  /** Update a queued toast in place (50761 — live progress bars). */
  const updateToast = useCallback((id, patch) => {
    setQueue((q) => q.map((t) => (t.id === id ? { ...t, ...(typeof patch === 'function' ? patch(t) : patch) } : t)));
  }, []);

  /** Persistent error toasts (50759) require an explicit acknowledge. */
  const acknowledge = useCallback((id) => {
    setQueue((q) => q.filter((t) => !(t.id === id && t.requiresAck)));
  }, []);

  /** Mark every history entry read (50783) — drives the notification badge. */
  const markHistoryRead = useCallback(() => {
    const now = Date.now();
    setHistory((h) => h.map((t) => ({ ...t, readAt: t.readAt || now })));
  }, []);

  /* 50771 — Esc dismisses the newest toast and returns focus to its trigger. */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      let newest = null;
      setQueue((q) => {
        if (q.length === 0) return q;
        newest = q[q.length - 1];
        return q.slice(0, -1);
      });
      if (newest && newest.requiresAck !== true) {
        const trigger = triggerRef.current;
        if (trigger && document.contains(trigger) && typeof trigger.focus === 'function') {
          setTimeout(() => trigger.focus({ preventScroll: true }), 0);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* Convenience emitters */
  const critical = useCallback((finding, huntName, opts) => push(criticalToast(finding, huntName), { category: 'critical', rateLimited: false, ...opts }), [push]);
  const phase = useCallback((phaseName, label, value, opts) => push(phaseToast(phaseName, label, value), { category: 'phase', ...opts }), [push]);
  const error = useCallback((message, opts) => push(errorToast(message), { category: 'error', rateLimited: false, ...opts }), [push]);
  const action = useCallback((title, body, actions, opts) => push(actionToast(title, body, actions), { category: 'action', ...opts }), [push]);
  const grouped = useCallback((findings, opts) => {
    const payload = groupFindingsToast(findings);
    return payload ? push(payload, { category: 'findings', ...opts }) : null;
  }, [push]);

  const ctx = useMemo(() => ({
    push, dismiss, acknowledge, markHistoryRead, updateToast, critical, phase, error, action, grouped,
    queue, history, position: resolvedPosition,
  }), [push, dismiss, acknowledge, markHistoryRead, updateToast, critical, phase, error, action, grouped, queue, history, resolvedPosition]);

  const { visible, collapsedCount, collapsed } = stackToasts(queue);
  const shown = expanded ? [...visible, ...collapsed] : visible;

  return (
    <ToastCtx.Provider value={ctx}>
      {children}
      <div
        className={`toast-center toast-${resolvedPosition}`}
        role="region"
        aria-label="Notifications"
        aria-live="polite"
      >
        {shown.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={dismiss} onAck={acknowledge} />
        ))}
        {!expanded && collapsedCount > 0 && (
          <button className="toast-more" onClick={() => setExpanded(true)}>
            +{collapsedCount} more
          </button>
        )}
        {expanded && collapsedCount > 0 && (
          <button className="toast-more" onClick={() => setExpanded(false)}>Collapse</button>
        )}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

const ACTION_LABELS = {
  view: 'View', undo: 'Undo', retry: 'Retry', snooze: 'Snooze hunt', dismiss: 'Dismiss', expand: 'Expand',
  // wave 20 additions
  upgrade: 'Upgrade', 'view-report': 'View report', 'start-next': 'Start next hunt',
  reload: 'Reload', jump: 'Jump to comment', download: 'Download', extend: 'Extend session',
  'keep-running': 'Keep running', 'snooze-1h': 'Snooze 1h',
};

export function ToastCard({ toast, onDismiss, onAck }) {
  // 50795 — theme-aware severity colors (reads ThemeProvider's data-theme; safe fallback).
  const color = resolveToastSeverityColor(toast.severity, currentThemeId()) || toastSeverityColor(toast.severity);
  const persistent = !!toast.persistent;
  // 50798 — auto-expanded criticals open with finding title + affected host.
  const [expandedCard, setExpandedCard] = useState(!!toast.autoExpand);
  // 50786 — capped width: long bodies clamp with an expander.
  const [bodyExpanded, setBodyExpanded] = useState(false);
  const LONG_BODY = 140;
  const bodyClamped = toast.body && toast.body.length > LONG_BODY && !bodyExpanded;
  // 50776 — hover pauses the auto-dismiss timer; 50777 — swipe-to-dismiss.
  const [hovered, setHovered] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const timerRef = useRef(null);
  const deadlineRef = useRef(0);
  const swipeRef = useRef(null);

  const armTimer = useCallback((delayMs) => {
    clearTimeout(timerRef.current);
    if (!Number.isFinite(delayMs)) return; // 50781 — critical/error never auto-dismiss
    deadlineRef.current = Date.now() + delayMs;
    timerRef.current = setTimeout(() => onDismiss(toast.id), delayMs);
  }, [toast.id, onDismiss]);

  useEffect(() => {
    if (persistent) return undefined;
    armTimer(toastAutoDismissMs(toast)); // 50781 — priority-based auto-dismiss
    return () => clearTimeout(timerRef.current);
  }, [toast, persistent, armTimer]);

  const handleMouseEnter = () => {
    setHovered(true);
    if (!persistent && timerRef.current) { // 50776 — pause on hover
      clearTimeout(timerRef.current);
      timerRef.current = null;
      deadlineRef.current = Math.max(0, deadlineRef.current - Date.now());
    }
  };
  const handleMouseLeave = () => {
    setHovered(false);
    if (!persistent && timerRef.current === null && deadlineRef.current > 0) {
      armTimer(deadlineRef.current); // resume with the remaining time
    }
  };

  /* 50777 — swipe-to-dismiss on touch/pointer devices */
  const handlePointerDown = (e) => {
    if (e.pointerType === 'mouse') return;
    swipeRef.current = { startX: e.clientX, id: e.pointerId };
  };
  const handlePointerMove = (e) => {
    if (!swipeRef.current || e.pointerId !== swipeRef.current.id) return;
    setSwipeX(e.clientX - swipeRef.current.startX);
  };
  const handlePointerUp = (e) => {
    if (!swipeRef.current || e.pointerId !== swipeRef.current.id) return;
    const dx = e.clientX - swipeRef.current.startX;
    swipeRef.current = null;
    if (Math.abs(dx) > 80) onDismiss(toast.id); // 50777
    else setSwipeX(0);
  };

  const handleAction = (action) => {
    if (action === 'dismiss') { onDismiss(toast.id); return; }
    if (action === 'expand') { setExpandedCard((e) => !e); return; }
    if (toast.onAction) toast.onAction(action, toast);
  };

  const handleBodyClick = () => {
    if (toast.onBodyClick) toast.onBodyClick(toast); // 50782 — body opens the finding/hunt
  };

  const pct = toast.kind === 'progress' ? Math.round((toast.progress || 0) * 100) : 0;

  return (
    <div
      className={`toast-card ${persistent ? 'toast-persistent' : ''} ${toast.requiresAck ? 'toast-requires-ack' : ''} ${toast.severity === 'critical' ? 'toast-critical' : ''} ${hovered ? 'toast-hovered' : ''}`}
      style={{ borderLeftColor: color, transform: swipeX ? `translateX(${swipeX}px)` : undefined, opacity: swipeX ? Math.max(0.25, 1 - Math.abs(swipeX) / 320) : undefined }}
      role={persistent ? 'alert' : 'status'}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div className="toast-head">
        <i className="toast-dot" style={{ background: color }} aria-hidden="true" />
        {/* 50792 — labeled toast icons: severity always paired with a text label */}
        <span className="toast-sev-label" style={{ color }}>{(toast.severity || 'info').toUpperCase()}</span>
        {/* 50780 — toast thumbnails: severity icon or finding screenshot */}
        {toast.thumbnail && (
          toast.thumbnail.type === 'image'
            ? <img className="toast-thumb" src={toast.thumbnail.src} alt="" aria-hidden="true" />
            : <span className="toast-thumb-icon" aria-hidden="true">{toast.thumbnail.char || '●'}</span>
        )}
        <strong className="toast-title">{toast.title}</strong>
        {/* 50785 — duplicate-suppression counter badge */}
        {toast.dupCount > 1 && <span className="toast-dup" title="Merged duplicates">×{toast.dupCount}</span>}
        {!persistent && (
          <button className="toast-x" onClick={() => onDismiss(toast.id)} aria-label="Dismiss">✕</button>
        )}
      </div>
      {/* 50798 — auto-expanded criticals show finding title + affected host */}
      {(expandedCard || toast.autoExpand) && toast.findingTitle && (
        <div className="toast-finding-detail">
          <span className="toast-finding-title">{toast.findingTitle}</span>
          {toast.affectedHost && <span className="toast-finding-host">{toast.affectedHost}</span>}
        </div>
      )}
      {toast.body && (
        toast.onBodyClick ? (
          <button
            className={`toast-body toast-body-clickable ${bodyClamped ? 'toast-body-clamped' : ''}`}
            onClick={handleBodyClick}
            title="Open"
          >
            {bodyClamped ? `${toast.body.slice(0, LONG_BODY)}…` : toast.body}
          </button>
        ) : (
          <p className={`toast-body ${bodyClamped ? 'toast-body-clamped' : ''}`}>{bodyClamped ? `${toast.body.slice(0, LONG_BODY)}…` : toast.body}</p>
        )
      )}
      {/* 50786 — expander for long messages */}
      {toast.body && toast.body.length > LONG_BODY && (
        <button className="toast-expand" onClick={() => setBodyExpanded((e) => !e)}>
          {bodyExpanded ? 'Show less' : 'Show more'}
        </button>
      )}
      {/* 50761 — live progress bar on progress toasts */}
      {toast.kind === 'progress' && (
        <div className="toast-progress" role="progressbar" aria-valuenow={pct} aria-valuemin="0" aria-valuemax="100" aria-label={toast.title}>
          <div className="toast-progress-fill" style={{ width: `${pct}%`, background: color }} />
          <span className="toast-progress-label">{pct}%{toast.status === 'complete' ? ' — done' : ''}{toast.status === 'failed' ? ' — failed' : ''}</span>
        </div>
      )}
      {/* 50763 — undo window countdown */}
      {toast.kind === 'undo' && (
        <UndoCountdown deadline={toast.undoDeadline} onExpired={() => onDismiss(toast.id)} />
      )}
      {expandedCard && toast.findingIds && (
        <ul className="toast-expand-list">
          {toast.findingIds.map((fid) => <li key={fid}>{fid}</li>)}
        </ul>
      )}
      <div className="toast-actions">
        {(toast.actions || []).map((a) => (
          <button key={a} className="toast-action" onClick={() => handleAction(a)}>
            {ACTION_LABELS[a] || a}
          </button>
        ))}
        {toast.requiresAck && (
          <button className="toast-action toast-ack" onClick={() => onAck(toast.id)}>
            Acknowledge
          </button>
        )}
      </div>
    </div>
  );
}

/** 50763 — live countdown inside the undo toast's 5-second restore window. */
function UndoCountdown({ deadline, onExpired }) {
  const [left, setLeft] = useState(Math.max(0, Math.ceil(((deadline || 0) - Date.now()) / 1000)));
  useEffect(() => {
    const id = setInterval(() => {
      const s = Math.max(0, Math.ceil(((deadline || 0) - Date.now()) / 1000));
      setLeft(s);
      if (s <= 0) { clearInterval(id); onExpired(); }
    }, 250);
    return () => clearInterval(id);
  }, [deadline, onExpired]);
  return <div className="toast-undo-count">Undo available for {left}s</div>;
}

export { TOAST_POSITIONS, DEFAULT_TOAST_POSITION, MOBILE_TOAST_POSITION };
export default ToastProvider;
