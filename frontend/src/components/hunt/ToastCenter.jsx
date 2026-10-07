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

  const push = useCallback((payload, { category = 'general', rateLimited = true } = {}) => {
    if (rateLimited && !rateLimitOk(lastFired.current, category)) return null;
    lastFired.current[category] = Date.now();
    if (doNotDisturb && payload.severity !== 'critical') return null;
    const toast = { ...payload, id: `toast-${toastSeq++}`, createdAt: Date.now() };
    setQueue((q) => [...q, toast]);
    setHistory((h) => [toast, ...h].slice(0, 100));
    return toast.id;
  }, [doNotDisturb]);

  const dismiss = useCallback((id) => {
    setQueue((q) => q.filter((t) => t.id !== id));
  }, []);

  /** Persistent error toasts (50759) require an explicit acknowledge. */
  const acknowledge = useCallback((id) => {
    setQueue((q) => q.filter((t) => !(t.id === id && t.requiresAck)));
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
    push, dismiss, acknowledge, critical, phase, error, action, grouped,
    queue, history, position: resolvedPosition,
  }), [push, dismiss, acknowledge, critical, phase, error, action, grouped, queue, history, resolvedPosition]);

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

const ACTION_LABELS = { view: 'View', undo: 'Undo', retry: 'Retry', snooze: 'Snooze hunt', dismiss: 'Dismiss', expand: 'Expand' };

export function ToastCard({ toast, onDismiss, onAck }) {
  const color = toastSeverityColor(toast.severity);
  const persistent = !!toast.persistent;
  const [expandedCard, setExpandedCard] = useState(false);

  useEffect(() => {
    if (persistent) return undefined;
    const id = setTimeout(() => onDismiss(toast.id), toast.kind === 'critical-finding' ? 9000 : 5000);
    return () => clearTimeout(id);
  }, [toast, persistent, onDismiss]);

  const handleAction = (action) => {
    if (action === 'dismiss') { onDismiss(toast.id); return; }
    if (action === 'expand') { setExpandedCard((e) => !e); return; }
    if (toast.onAction) toast.onAction(action, toast);
  };

  return (
    <div
      className={`toast-card ${persistent ? 'toast-persistent' : ''} ${toast.requiresAck ? 'toast-requires-ack' : ''}`}
      style={{ borderLeftColor: color }}
      role={persistent ? 'alert' : 'status'}
    >
      <div className="toast-head">
        <i className="toast-dot" style={{ background: color }} aria-hidden="true" />
        <strong className="toast-title">{toast.title}</strong>
        {!persistent && (
          <button className="toast-x" onClick={() => onDismiss(toast.id)} aria-label="Dismiss">✕</button>
        )}
      </div>
      {toast.body && <p className="toast-body">{toast.body}</p>}
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

export { TOAST_POSITIONS, DEFAULT_TOAST_POSITION, MOBILE_TOAST_POSITION };
export default ToastProvider;
