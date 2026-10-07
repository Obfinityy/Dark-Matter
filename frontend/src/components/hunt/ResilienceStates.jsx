/**
 * ResilienceStates.jsx — Forge wave 10, ideas 50361–50394.
 *
 * Graceful-degradation and failure-recovery UX: every way the product can
 * partially fail gets a purposeful recovery state instead of a dead screen.
 * A shared <ResilienceState> shell plus 34 named states, one per idea.
 * Each state carries real, working CTAs wired to parent callbacks —
 * retries, countdowns, dismissals, diffs, exports — no dead buttons.
 *
 * Pure presentation sits here; testable logic lives in resilienceCore.js.
 *
 * Idea map: 50361 version-mismatch banner · 50362 maintenance page ·
 * 50363 friendly 500 fallback · 50364 offline queue banner ·
 * 50365 card error boundary · 50366 timeline-gap marker ·
 * 50367 PoC-replay failure diff · 50368 screenshot placeholder ·
 * 50369 mic-blocked error · 50370 avatar fallback · 50371 stale index ·
 * 50372 impossible filter combo · 50373 scheduled-hunt failure ·
 * 50374 webhook failure log · 50375 bulk-action partial failure ·
 * 50376 comment draft preservation · 50377 theme-asset fallback ·
 * 50378 print fallback · 50379 clipboard-denied fallback ·
 * 50380 shortcut-conflict warning · 50381 CSV-import errors ·
 * 50382 timezone warning · 50383 aria-label dev overlay ·
 * 50384 deleted-finding deep link · 50385 concurrent-edit merge UI ·
 * 50386 snapshot-restore failure · 50387 desktop-bridge disconnect ·
 * 50388 inference-timeout option · 50389 disk-quota warning ·
 * 50390 CORS-blocked preview · 50391 expired share link ·
 * 50392 duplicate-hunt detection · 50393 invalid-regex notice ·
 * 50394 WebGL-degraded banner.
 */

import { useState, useEffect, useMemo, Component } from 'react';
import {
  compareVersions,
  makeErrorId,
  buildDiagnosticsText,
  offlineQueueLabel,
  timelineGapLabel,
  diffLinesToView,
  diffSummary,
  staleIndexMessage,
  buildFilterConflictMessage,
  summarizeBulkResult,
  aggregateCsvErrors,
  detectTimezoneMismatch,
  reconnectDelayMs,
  diskQuotaAdvice,
  shareLinkStatus,
  duplicateHuntMessage,
  parseRegexError,
  formatBytes,
  formatRetryCountdown,
} from './resilienceCore.js';
import './ResilienceStates.css';

/* Shared shell --------------------------------------------------------- */

export function ResilienceState({
  illustration,
  title,
  description,
  details,
  primary,
  secondary,
  tone = 'warning',
  compact = false,
  children,
}) {
  const [showDetails, setShowDetails] = useState(false);
  return (
    <section
      className={`rsz ${compact ? 'rsz-compact' : ''} rsz-tone-${tone}`}
      role="status"
      aria-label={title}
    >
      {illustration && (
        <div className="rsz-illustration" aria-hidden="true">{illustration}</div>
      )}
      <h3 className="rsz-title">{title}</h3>
      {description && <p className="rsz-desc">{description}</p>}
      {details && (
        <div className="rsz-details-wrap">
          <button
            type="button"
            className="rsz-details-toggle"
            aria-expanded={showDetails}
            onClick={() => setShowDetails((v) => !v)}
          >
            {showDetails ? 'Hide details' : 'Show details'}
          </button>
          {showDetails && <pre className="rsz-details">{details}</pre>}
        </div>
      )}
      {(primary || secondary) && (
        <div className="rsz-actions">
          {primary && (
            <button type="button" className="rsz-btn rsz-primary" onClick={primary.onClick} disabled={primary.disabled}>
              {primary.label}
            </button>
          )}
          {secondary && (
            <button type="button" className="rsz-btn rsz-secondary" onClick={secondary.onClick} disabled={secondary.disabled}>
              {secondary.label}
            </button>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

/* 50361 — version-mismatch banner ---------------------------------------- */

export function VersionMismatchBanner({ frontendVersion, backendVersion, onCheckAgain, onDismiss }) {
  const v = compareVersions(frontendVersion, backendVersion);
  if (!v.drift) return null;
  return (
    <ResilienceState
      compact
      illustration="🧩"
      title="Versions are out of sync"
      description={v.message}
      primary={onCheckAgain && { label: 'Check again', onClick: onCheckAgain }}
      secondary={onDismiss && { label: 'Dismiss', onClick: onDismiss }}
    />
  );
}

/* 50362 — maintenance-mode page ------------------------------------------ */

export function MaintenanceModePage({ estimatedReturnAt, statusUrl, onNotifyMe }) {
  const [now, setNow] = useState(Date.now());
  const [notified, setNotified] = useState(false);
  const target = new Date(estimatedReturnAt).getTime();
  const valid = Number.isFinite(target);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const remaining = valid ? Math.max(0, target - now) : 0;
  return (
    <ResilienceState
      illustration="🛠️"
      title="Infinity AI is in maintenance"
      description="We're upgrading the hunt infrastructure. Your hunts, findings, and settings are safe — nothing is being deleted."
    >
      {valid && (
        <div className="rsz-countdown" role="timer" aria-label="Estimated time remaining">
          {remaining > 0 ? `Back in about ${formatRetryCountdown(remaining)}` : 'Should be back any moment…'}
        </div>
      )}
      {statusUrl && (
        <a className="rsz-link" href={statusUrl} target="_blank" rel="noopener noreferrer">
          Check live status →
        </a>
      )}
      <div className="rsz-actions">
        <button
          type="button"
          className="rsz-btn rsz-primary"
          disabled={notified}
          onClick={() => { setNotified(true); if (onNotifyMe) onNotifyMe(); }}
        >
          {notified ? '✓ We’ll notify you' : 'Notify me when we’re back'}
        </button>
      </div>
    </ResilienceState>
  );
}

/* 50363 — friendly 500 fallback ------------------------------------------- */

export function Friendly500Fallback({ route, statusCode, onRetry, onGoHome }) {
  const errorId = useMemo(() => makeErrorId(), []);
  const [copied, setCopied] = useState(false);
  const diagnostics = buildDiagnosticsText({ errorId, route, statusCode });
  const copyDiagnostics = async () => {
    try {
      await navigator.clipboard.writeText(diagnostics);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = diagnostics;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <ResilienceState
      illustration="😅"
      title="Something broke on our side"
      description="The server hit an error. We've attached an error ID automatically — paste it if you contact support."
      details={diagnostics}
      primary={onRetry && { label: 'Try again', onClick: onRetry }}
      secondary={onGoHome && { label: 'Back to hunts', onClick: onGoHome }}
    >
      <button type="button" className="rsz-btn rsz-secondary" onClick={copyDiagnostics}>
        {copied ? '✓ Diagnostics copied' : 'Copy diagnostics'}
      </button>
    </ResilienceState>
  );
}

/* 50364 — offline queue banner -------------------------------------------- */

export function OfflineQueueBanner({ queuedCount, queuedActions = [], onSyncNow, onDismiss }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <ResilienceState
      compact
      tone="info"
      illustration="📥"
      title="You're offline"
      description={offlineQueueLabel(queuedCount)}
      primary={onSyncNow && queuedCount > 0 && { label: 'Try syncing now', onClick: onSyncNow }}
      secondary={onDismiss && { label: 'Dismiss', onClick: onDismiss }}
    >
      {queuedActions.length > 0 && (
        <>
          <button
            type="button"
            className="rsz-details-toggle"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? 'Hide queued actions' : `Show ${queuedActions.length} queued action${queuedActions.length === 1 ? '' : 's'}`}
          </button>
          {expanded && (
            <ul className="rsz-list">
              {queuedActions.map((a, i) => (
                <li key={a.id || i}>{a.label || a.type || `Action ${i + 1}`}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </ResilienceState>
  );
}

/* 50365 — card error boundary --------------------------------------------- */

export class CardErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { failed: true, error };
  }

  reset = () => this.setState({ failed: false, error: null });

  render() {
    const { failed, error } = this.state;
    const { children, cardTitle, onRemove } = this.props;
    if (!failed) return children;
    return (
      <div className="rsz rsz-compact rsz-tone-error rsz-card-error" role="alert">
        <div className="rsz-illustration" aria-hidden="true">🧱</div>
        <h3 className="rsz-title">{cardTitle ? `“${cardTitle}” couldn't render` : 'This card couldn’t render'}</h3>
        <p className="rsz-desc">
          One bad card won't take down the list. The rest of your findings are untouched.
        </p>
        {error && <pre className="rsz-details">{String(error.message || error)}</pre>}
        <div className="rsz-actions">
          <button type="button" className="rsz-btn rsz-primary" onClick={this.reset}>Retry this card</button>
          {onRemove && (
            <button type="button" className="rsz-btn rsz-secondary" onClick={onRemove}>Remove card</button>
          )}
        </div>
      </div>
    );
  }
}

/* 50366 — timeline-gap marker --------------------------------------------- */

export function TimelineGapMarker({ gapStart, gapEnd, onBackfill, onDismiss }) {
  return (
    <div className="rsz-gap" role="note">
      <span className="rsz-gap-dot" aria-hidden="true">⋯</span>
      <span>{timelineGapLabel({ gapStart, gapEnd })}</span>
      <span className="rsz-gap-sub">Connection dropped — these events never arrived.</span>
      <span className="rsz-gap-actions">
        {onBackfill && (
          <button type="button" className="rsz-mini-btn" onClick={onBackfill}>Backfill</button>
        )}
        {onDismiss && (
          <button type="button" className="rsz-mini-btn rsz-mini-quiet" onClick={onDismiss}>Dismiss</button>
        )}
      </span>
    </div>
  );
}

/* 50367 — PoC-replay failure diff ------------------------------------------ */

export function PocReplayFailureDiff({ expectedOutput, actualOutput, onReportFlaky, onRetryReplay }) {
  const [expanded, setExpanded] = useState(false);
  const [reported, setReported] = useState(false);
  const rows = useMemo(() => diffLinesToView(expectedOutput, actualOutput), [expectedOutput, actualOutput]);
  return (
    <ResilienceState
      compact
      illustration="🔬"
      title="PoC replay didn't reproduce"
      description={`The proof-of-concept behaved differently on replay. ${diffSummary(rows)}. This usually means the target state changed — or the check is flaky.`}
      primary={onRetryReplay && { label: 'Replay again', onClick: onRetryReplay }}
      secondary={onReportFlaky && { label: reported ? '✓ Reported as flaky' : 'Report as flaky', onClick: () => { setReported(true); onReportFlaky(); }, disabled: reported }}
    >
      <button
        type="button"
        className="rsz-details-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? 'Hide expected-vs-actual diff' : 'Show expected-vs-actual diff'}
      </button>
      {expanded && (
        <div className="rsz-diff" role="table" aria-label="Expected versus actual output">
          {rows.map((r) => (
            <div key={r.line} className={`rsz-diff-row ${r.same ? '' : 'rsz-diff-changed'}`}>
              <span className="rsz-diff-line">{r.line}</span>
              <span className="rsz-diff-expected">{r.expected || '∅'}</span>
              <span className="rsz-diff-actual">{r.actual || '∅'}</span>
            </div>
          ))}
        </div>
      )}
    </ResilienceState>
  );
}

/* 50368 — screenshot-capture placeholder ----------------------------------- */

export function ScreenshotCapturePlaceholder({ targetUrl, attempts = 0, onRetryCapture, onSkip }) {
  return (
    <ResilienceState
      compact
      tone="info"
      illustration="🖼️"
      title="Screenshot capture failed"
      description={`We couldn't capture ${targetUrl || 'the target page'}.${attempts > 0 ? ` ${attempts} attempt${attempts === 1 ? '' : 's'} so far.` : ''} Findings and text evidence are unaffected.`}
      primary={onRetryCapture && { label: 'Retry capture', onClick: onRetryCapture }}
      secondary={onSkip && { label: 'Continue without it', onClick: onSkip }}
    />
  );
}

/* 50369 — mic-blocked error ------------------------------------------------- */

export function MicBlockedError({ onRequestMic, onUseText }) {
  return (
    <ResilienceState
      compact
      illustration="🎙️"
      title="Microphone is blocked"
      description="Voice input needs microphone permission. Click the lock icon in your browser's address bar → Site settings → Microphone → Allow, then try again."
      primary={onRequestMic && { label: 'Ask for mic access', onClick: onRequestMic }}
      secondary={onUseText && { label: 'Type instead', onClick: onUseText }}
    />
  );
}

/* 50370 — avatar fallback portrait ------------------------------------------ */

export function AvatarFallbackPortrait({ displayName, onRetry }) {
  const initials = String(displayName || '?')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="rsz-avatar-fallback" role="img" aria-label={`${displayName || 'User'} avatar unavailable`}>
      <span className="rsz-avatar-initials" aria-hidden="true">{initials}</span>
      {onRetry && (
        <button type="button" className="rsz-mini-btn" onClick={onRetry} title="Retry avatar load">
          ↻
        </button>
      )}
    </div>
  );
}

/* 50371 — stale-index notice ------------------------------------------------ */

export function StaleIndexNotice({ indexedAt, onReindex, onDismiss }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  const minutesOld = Math.max(0, Math.round((now - new Date(indexedAt).getTime()) / 60000));
  if (minutesOld < 1) return null;
  return (
    <ResilienceState
      compact
      tone="info"
      illustration="🕰️"
      title="Index may be stale"
      description={staleIndexMessage(minutesOld)}
      primary={onReindex && { label: 'Reindex now', onClick: onReindex }}
      secondary={onDismiss && { label: 'Dismiss', onClick: onDismiss }}
    />
  );
}

/* 50372 — impossible filter combination -------------------------------------- */

export function ImpossibleFilterCombination({ filters = [], conflictingPair, suggestion, onApplySuggestion, onClearFilters }) {
  const m = buildFilterConflictMessage({ filters, conflictingPair, suggestion });
  return (
    <ResilienceState
      compact
      tone="info"
      illustration="🧮"
      title={m.title}
      description={m.detail}
      primary={onApplySuggestion && { label: 'Apply fix', onClick: onApplySuggestion }}
      secondary={onClearFilters && { label: 'Clear all filters', onClick: onClearFilters }}
    >
      <p className="rsz-hint">Suggestion: {m.suggestion}</p>
    </ResilienceState>
  );
}

/* 50373 — scheduled-hunt failure --------------------------------------------- */

export function ScheduledHuntFailure({ scheduleName, failedAt, reason, onRunNow, onViewLogs }) {
  return (
    <ResilienceState
      compact
      illustration="⏰"
      title={`Scheduled hunt failed: ${scheduleName || 'Unnamed schedule'}`}
      description={reason || 'The scheduled run errored out before completing.'}
      details={failedAt ? `Failed at: ${new Date(failedAt).toLocaleString()}` : undefined}
      primary={onRunNow && { label: 'Run now', onClick: onRunNow }}
      secondary={onViewLogs && { label: 'View logs', onClick: onViewLogs }}
    />
  );
}

/* 50374 — webhook failure log -------------------------------------------------- */

export function WebhookFailureLog({ deliveries = [], onRedeliver }) {
  const [pendingId, setPendingId] = useState(null);
  const failures = deliveries.filter((d) => d.status === 'failed');
  const handleRedeliver = (id) => {
    setPendingId(id);
    Promise.resolve(onRedeliver(id)).finally(() => setPendingId(null));
  };
  return (
    <div className="rsz rsz-compact" role="region" aria-label="Webhook delivery log">
      <h3 className="rsz-title">Webhook deliveries</h3>
      <p className="rsz-desc">
        {failures.length === 0
          ? 'All recent deliveries succeeded.'
          : `${failures.length} deliver${failures.length === 1 ? 'y' : 'ies'} failed — redeliver them below.`}
      </p>
      <ul className="rsz-webhook-list">
        {deliveries.map((d) => (
          <li key={d.id} className={`rsz-webhook-row rsz-webhook-${d.status}`}>
            <span className="rsz-webhook-status" aria-hidden="true">
              {d.status === 'failed' ? '🔴' : d.status === 'pending' ? '🟡' : '🟢'}
            </span>
            <span className="rsz-webhook-event">{d.event || d.id}</span>
            <span className="rsz-webhook-time">{d.attemptedAt ? new Date(d.attemptedAt).toLocaleTimeString() : ''}</span>
            {d.status === 'failed' && onRedeliver && (
              <button
                type="button"
                className="rsz-mini-btn"
                disabled={pendingId === d.id}
                onClick={() => handleRedeliver(d.id)}
              >
                {pendingId === d.id ? 'Sending…' : 'Redeliver'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* 50375 — bulk-action partial failure ------------------------------------------- */

export function BulkActionPartialFailure({ results = [], actionVerb, onRetryFailed, onDismiss }) {
  const [expanded, setExpanded] = useState(false);
  const s = useMemo(() => summarizeBulkResult(results, actionVerb), [results, actionVerb]);
  if (s.failed === 0) return null;
  return (
    <ResilienceState
      compact
      illustration="🧺"
      title="Some items didn't go through"
      description={s.headline}
      primary={onRetryFailed && { label: `Retry ${s.failed} failed`, onClick: () => onRetryFailed(s.failures) }}
      secondary={onDismiss && { label: 'Dismiss', onClick: onDismiss }}
    >
      <button
        type="button"
        className="rsz-details-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? 'Hide per-item reasons' : `Show ${s.failed} reason${s.failed === 1 ? '' : 's'}`}
      </button>
      {expanded && (
        <ul className="rsz-list rsz-list-left">
          {s.failures.map((f) => (
            <li key={f.id}><strong>{f.label}:</strong> {f.reason}</li>
          ))}
        </ul>
      )}
    </ResilienceState>
  );
}

/* 50376 — comment draft preservation -------------------------------------------- */

export function CommentDraftPreservation({ draft, onRetryPost, onDiscard }) {
  const [text, setText] = useState(draft || '');
  const [posting, setPosting] = useState(false);
  const handleRetry = () => {
    setPosting(true);
    Promise.resolve(onRetryPost(text)).finally(() => setPosting(false));
  };
  return (
    <ResilienceState
      compact
      tone="info"
      illustration="💬"
      title="Your comment wasn't lost"
      description="Posting failed, but your draft is preserved below exactly as you wrote it. Edit it or retry."
      primary={onRetryPost && { label: posting ? 'Posting…' : 'Retry post', onClick: handleRetry, disabled: posting || !text.trim() }}
      secondary={onDiscard && { label: 'Discard draft', onClick: onDiscard }}
    >
      <textarea
        className="rsz-textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        aria-label="Preserved comment draft"
      />
      <p className="rsz-hint">{text.length} characters preserved</p>
    </ResilienceState>
  );
}

/* 50377 — theme-asset fallback ----------------------------------------------------- */

export function ThemeAssetFallback({ themeName, failedAssets = [], onReloadTheme, onDismiss }) {
  return (
    <ResilienceState
      compact
      tone="info"
      illustration="🎨"
      title="Theme assets fell back to default"
      description={`Some assets for the "${themeName || 'custom'}" theme failed to load, so the default theme is active. Your layout and data are unaffected.`}
      details={failedAssets.length ? failedAssets.map((a) => `• ${a}`).join('\n') : undefined}
      primary={onReloadTheme && { label: 'Reload theme', onClick: onReloadTheme }}
      secondary={onDismiss && { label: 'Keep default theme', onClick: onDismiss }}
    />
  );
}

/* 50378 — print fallback ---------------------------------------------------------------- */

export function PrintFallback({ onDownloadPdf }) {
  const tryPrintAnyway = () => window.print();
  return (
    <ResilienceState
      compact
      tone="info"
      illustration="🖨️"
      title="Print preview isn't available"
      description="The browser couldn't render a print preview for this report. Download the PDF instead — it has identical content."
      primary={onDownloadPdf && { label: 'Download PDF instead', onClick: onDownloadPdf }}
      secondary={{ label: 'Try printing anyway', onClick: tryPrintAnyway }}
    />
  );
}

/* 50379 — clipboard-denied fallback -------------------------------------------------------- */

export function ClipboardDeniedFallback({ text, onClose }) {
  const selectAll = (e) => {
    e.target.select();
  };
  return (
    <div className="rsz-modal-backdrop" role="dialog" aria-modal="true" aria-label="Copy text manually">
      <div className="rsz-modal">
        <h3 className="rsz-title">Clipboard access was blocked</h3>
        <p className="rsz-desc">
          Your browser denied clipboard access. Select the text below and copy it manually (Ctrl/Cmd+C).
        </p>
        <textarea
          className="rsz-textarea rsz-textarea-readonly"
          readOnly
          value={text || ''}
          rows={6}
          onFocus={selectAll}
          onClick={selectAll}
          aria-label="Text to copy manually"
        />
        <div className="rsz-actions">
          {onClose && <button type="button" className="rsz-btn rsz-primary" onClick={onClose}>Done</button>}
        </div>
      </div>
    </div>
  );
}

/* 50380 — shortcut-conflict warning ----------------------------------------------------------- */

export function ShortcutConflictWarning({ newBinding, existingAction, onOverwrite, onKeepExisting }) {
  return (
    <ResilienceState
      compact
      illustration="⌨️"
      title="Shortcut already in use"
      description={`"${newBinding}" is already assigned to "${existingAction || 'another action'}". Overwriting will unbind it from there.`}
      primary={onOverwrite && { label: 'Overwrite binding', onClick: onOverwrite }}
      secondary={onKeepExisting && { label: 'Keep existing', onClick: onKeepExisting }}
    />
  );
}

/* 50381 — CSV-import errors ---------------------------------------------------------------------- */

export function CsvImportErrors({ rows = [], fileName, onFixAndReimport }) {
  const a = useMemo(() => aggregateCsvErrors(rows, fileName), [rows, fileName]);
  const downloadReport = () => {
    const blob = new Blob([a.reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(fileName || 'import').replace(/\.[^.]+$/, '')}-errors.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };
  if (a.count === 0) return null;
  return (
    <ResilienceState
      compact
      illustration="📑"
      title={`${a.count} row${a.count === 1 ? '' : 's'} failed validation`}
      description="Fix the rows below and reimport — valid rows were already imported and are safe."
      primary={onFixAndReimport && { label: 'Fix and reimport', onClick: onFixAndReimport }}
    >
      <button type="button" className="rsz-btn rsz-secondary" onClick={downloadReport}>
        Download error report
      </button>
      <ul className="rsz-list rsz-list-left rsz-csv-errors">
        {a.errors.slice(0, 20).map((e, i) => (
          <li key={i}>
            <strong>Row {e.row}</strong> · {e.column}: {e.message}
            {e.value !== '' && <code className="rsz-code"> {String(e.value)}</code>}
          </li>
        ))}
      </ul>
      {a.errors.length > 20 && (
        <p className="rsz-hint">…and {a.errors.length - 20} more — see the downloaded report.</p>
      )}
    </ResilienceState>
  );
}

/* 50382 — timezone warning ---------------------------------------------------------------------------- */

export function TimezoneWarning({ userTimezone, detectedTimezone, onSwitchTimezone, onDismiss }) {
  const m = detectTimezoneMismatch({ userTimezone, detectedTimezone });
  const [switched, setSwitched] = useState(false);
  if (!m.mismatched || switched) return null;
  return (
    <ResilienceState
      compact
      tone="info"
      illustration="🌍"
      title="Timezone looks off"
      description={m.message}
      primary={onSwitchTimezone && {
        label: `Switch to ${detectedTimezone}`,
        onClick: () => { setSwitched(true); onSwitchTimezone(detectedTimezone); },
      }}
      secondary={onDismiss && { label: `Keep ${userTimezone}`, onClick: onDismiss }}
    />
  );
}

/* 50383 — aria-label dev overlay --------------------------------------------------------------------------- */

export function AriaLabelDevOverlay({ issues = [], onLocate }) {
  const isDev = typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production';
  if (!isDev || issues.length === 0) return null;
  return (
    <div className="rsz-dev-overlay" role="complementary" aria-label="Accessibility dev overlay">
      <h4 className="rsz-dev-title">⚠️ {issues.length} element{issues.length === 1 ? '' : 's'} missing accessible names (dev only)</h4>
      <ul className="rsz-dev-list">
        {issues.map((issue, i) => (
          <li key={i}>
            <code className="rsz-code">{issue.selector || issue.tag || `element ${i + 1}`}</code>
            <span className="rsz-dev-hint">{issue.hint || 'Add an aria-label or visible text.'}</span>
            {onLocate && (
              <button type="button" className="rsz-mini-btn" onClick={() => onLocate(issue)}>Locate</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* 50384 — deleted-finding deep link ------------------------------------------------------------------------------ */

export function DeletedFindingDeepLink({ findingTitle, huntTitle, removedReason, onBackToHunt, onBrowseFindings }) {
  return (
    <ResilienceState
      illustration="🗑️"
      title="This finding was removed"
      description={removedReason
        ? `“${findingTitle || 'This finding'}” was removed: ${removedReason}. The link you followed no longer points anywhere.`
        : `“${findingTitle || 'This finding'}” was removed, so this link no longer points anywhere.`}
      primary={onBackToHunt && { label: huntTitle ? `Back to “${huntTitle}”` : 'Back to the hunt', onClick: onBackToHunt }}
      secondary={onBrowseFindings && { label: 'Browse all findings', onClick: onBrowseFindings }}
    />
  );
}

/* 50385 — concurrent-edit merge UI ---------------------------------------------------------------------------------- */

export function ConcurrentEditMergeUI({ fieldName, mine, theirs, authorName, onResolve, onCancel }) {
  const [choice, setChoice] = useState('mine');
  const [edited, setEdited] = useState(null);
  const resolved = edited !== null ? edited : choice === 'mine' ? mine : theirs;
  return (
    <div className="rsz rsz-merge" role="dialog" aria-label="Resolve conflicting edits">
      <h3 className="rsz-title">Conflicting edits{fieldName ? ` in “${fieldName}”` : ''}</h3>
      <p className="rsz-desc">
        {authorName ? `${authorName} saved changes` : 'Someone saved changes'} while you were editing.
        Pick a side, or edit the merged result directly.
      </p>
      <div className="rsz-merge-cols">
        <div className="rsz-merge-col">
          <label className="rsz-merge-label">
            <input type="radio" name="rsz-merge-choice" checked={choice === 'mine'} onChange={() => { setChoice('mine'); setEdited(null); }} />
            Your version
          </label>
          <pre className="rsz-merge-text">{mine}</pre>
        </div>
        <div className="rsz-merge-col">
          <label className="rsz-merge-label">
            <input type="radio" name="rsz-merge-choice" checked={choice === 'theirs'} onChange={() => { setChoice('theirs'); setEdited(null); }} />
            Their version
          </label>
          <pre className="rsz-merge-text">{theirs}</pre>
        </div>
      </div>
      <label className="rsz-merge-label" htmlFor="rsz-merge-final">Merged result</label>
      <textarea
        id="rsz-merge-final"
        className="rsz-textarea"
        rows={5}
        value={resolved}
        onChange={(e) => setEdited(e.target.value)}
      />
      <div className="rsz-actions">
        {onResolve && <button type="button" className="rsz-btn rsz-primary" onClick={() => onResolve(resolved)}>Save merged version</button>}
        {onCancel && <button type="button" className="rsz-btn rsz-secondary" onClick={onCancel}>Cancel</button>}
      </div>
    </div>
  );
}

/* 50386 — snapshot-restore failure ----------------------------------------------------------------------------------------- */

export function SnapshotRestoreFailure({ snapshotName, corruptReason, salvageable = {}, onStartFresh, onExportSalvage }) {
  const salvageKeys = Object.keys(salvageable);
  const exportSalvage = () => {
    const blob = new Blob([JSON.stringify({ snapshot: snapshotName, exportedAt: new Date().toISOString(), data: salvageable }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${snapshotName || 'snapshot'}-salvage.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    if (onExportSalvage) onExportSalvage(salvageable);
  };
  return (
    <ResilienceState
      illustration="💥"
      title={`Snapshot “${snapshotName || 'backup'}” is corrupted`}
      description={corruptReason || 'The snapshot failed integrity checks and cannot be restored as-is.'}
      primary={onStartFresh && { label: 'Start fresh', onClick: onStartFresh }}
    >
      {salvageKeys.length > 0 && (
        <>
          <p className="rsz-desc">Salvageable data found: {salvageKeys.join(', ')}.</p>
          <button type="button" className="rsz-btn rsz-secondary" onClick={exportSalvage}>
            Export salvageable data
          </button>
        </>
      )}
    </ResilienceState>
  );
}

/* 50387 — desktop-bridge disconnect ----------------------------------------------------------------------------------------------- */

export function DesktopBridgeDisconnect({ attempts = 0, lastError, onRetryNow, onGiveUp }) {
  const [attempt, setAttempt] = useState(attempts);
  const [remaining, setRemaining] = useState(() => reconnectDelayMs(attempts));
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!auto) return undefined;
    if (remaining <= 0) {
      setAttempt((a) => a + 1);
      setRemaining(reconnectDelayMs(attempt + 1));
      if (onRetryNow) onRetryNow(attempt + 1);
      return undefined;
    }
    const t = setInterval(() => setRemaining((r) => Math.max(0, r - 1000)), 1000);
    return () => clearInterval(t);
  }, [remaining, auto, attempt, onRetryNow]);
  const steps = ['Detect bridge', 'Restart local service', 'Re-pair session'];
  const activeStep = Math.min(attempt, steps.length - 1);
  return (
    <ResilienceState
      illustration="🔌"
      title="Desktop bridge disconnected"
      description={lastError || 'The desktop runtime stopped responding. The reconnect wizard will walk through recovery.'}
    >
      <ol className="rsz-steps">
        {steps.map((s, i) => (
          <li key={s} className={i < activeStep ? 'rsz-step-done' : i === activeStep ? 'rsz-step-active' : ''}>
            {i < activeStep ? '✓ ' : ''}{s}
          </li>
        ))}
      </ol>
      <p className="rsz-hint" role="timer">
        {auto ? `Retrying in ${formatRetryCountdown(remaining)} (attempt ${attempt + 1})…` : 'Auto-retry paused.'}
      </p>
      <div className="rsz-actions">
        {onRetryNow && (
          <button type="button" className="rsz-btn rsz-primary" onClick={() => { setAuto(false); onRetryNow(attempt + 1); }}>
            Retry now
          </button>
        )}
        <button type="button" className="rsz-btn rsz-secondary" onClick={() => setAuto((v) => !v)}>
          {auto ? 'Pause auto-retry' : 'Resume auto-retry'}
        </button>
        {onGiveUp && (
          <button type="button" className="rsz-btn rsz-secondary" onClick={onGiveUp}>Stop trying</button>
        )}
      </div>
    </ResilienceState>
  );
}

/* 50388 — inference-timeout option ----------------------------------------------------------------------------------------------------- */

export function InferenceTimeoutOption({ waitedSeconds = 0, modelName, onSimplifiedRetry, onWaitLonger, onCancel }) {
  const [waiting, setWaiting] = useState(false);
  return (
    <ResilienceState
      compact
      illustration="🧠"
      title="The brain is taking too long"
      description={`${modelName || 'The model'} hasn't answered after ${waitedSeconds}s. Retry with a simplified prompt (faster, slightly less thorough), or keep waiting.`}
      primary={onSimplifiedRetry && { label: 'Retry simplified', onClick: onSimplifiedRetry }}
      secondary={onWaitLonger && {
        label: waiting ? 'Waiting…' : 'Wait 60s more',
        disabled: waiting,
        onClick: () => { setWaiting(true); onWaitLonger(); setTimeout(() => setWaiting(false), 60000); },
      }}
    >
      {onCancel && (
        <button type="button" className="rsz-details-toggle" onClick={onCancel}>Cancel this inference</button>
      )}
    </ResilienceState>
  );
}

/* 50389 — disk-quota warning ---------------------------------------------------------------------------------------------------------------- */

export function DiskQuotaWarning({ usedBytes, quotaBytes, breakdown = [], onOpenCleanup, onDismiss }) {
  const a = diskQuotaAdvice({ usedBytes, quotaBytes, breakdown });
  const sorted = [...breakdown].sort((x, y) => y.bytes - x.bytes);
  return (
    <ResilienceState
      compact
      illustration="💽"
      title="Evidence storage is almost full"
      description={a.message}
      primary={onOpenCleanup && { label: 'Open cleanup', onClick: onOpenCleanup }}
      secondary={onDismiss && { label: 'Dismiss', onClick: onDismiss }}
    >
      {sorted.length > 0 && (
        <div className="rsz-quota-bars" role="img" aria-label={`Storage ${a.pct}% full`}>
          {sorted.map((b) => {
            const pct = quotaBytes > 0 ? Math.max(2, Math.round((b.bytes / quotaBytes) * 100)) : 0;
            return (
              <div key={b.label} className="rsz-quota-row">
                <span className="rsz-quota-label">{b.label}</span>
                <span className="rsz-quota-track"><span className="rsz-quota-fill" style={{ width: `${pct}%` }} /></span>
                <span className="rsz-quota-size">{formatBytes(b.bytes)}</span>
              </div>
            );
          })}
        </div>
      )}
    </ResilienceState>
  );
}

/* 50390 — CORS-blocked preview --------------------------------------------------------------------------------------------------------------------- */

export function CorsBlockedPreview({ targetUrl, onOpenInNewTab, onUseTextMode }) {
  const openTab = () => {
    if (targetUrl) window.open(targetUrl, '_blank', 'noopener,noreferrer');
    if (onOpenInNewTab) onOpenInNewTab(targetUrl);
  };
  return (
    <ResilienceState
      compact
      tone="info"
      illustration="🪟"
      title="Live preview is blocked by the target"
      description="The target's CORS policy blocks embedding it in an iframe. Open it in a new tab, or continue in text mode."
      details={targetUrl}
      primary={{ label: 'Open in new tab', onClick: openTab }}
      secondary={onUseTextMode && { label: 'Use text mode', onClick: onUseTextMode }}
    />
  );
}

/* 50391 — expired share link ---------------------------------------------------------------------------------------------------------------------------- */

export function ExpiredShareLink({ expiresAt, sharedTitle, onRequestNewLink, onGoHome }) {
  const s = shareLinkStatus({ expiresAt });
  const [requested, setRequested] = useState(false);
  return (
    <ResilienceState
      illustration="🔗"
      title="This share link has expired"
      description={`${s.message}${sharedTitle ? ` It pointed to “${sharedTitle}”.` : ''} Links expire for security — request a fresh one below.`}
      primary={onRequestNewLink && {
        label: requested ? '✓ Request sent' : 'Request a new link',
        disabled: requested,
        onClick: () => { setRequested(true); onRequestNewLink(); },
      }}
      secondary={onGoHome && { label: 'Back to hunts', onClick: onGoHome }}
    />
  );
}

/* 50392 — duplicate-hunt detection ---------------------------------------------------------------------------------------------------------------------------------- */

export function DuplicateHuntDetection({ existingHunt, onViewExisting, onStartFresh }) {
  const m = duplicateHuntMessage({ existingHunt });
  return (
    <ResilienceState
      compact
      tone="info"
      illustration="🔁"
      title={m.title}
      description={m.detail}
      primary={onViewExisting && { label: 'View existing hunt', onClick: onViewExisting }}
      secondary={onStartFresh && { label: 'Start fresh anyway', onClick: onStartFresh }}
    />
  );
}

/* 50393 — invalid-regex notice --------------------------------------------------------------------------------------------------------------------------------------------- */

export function InvalidRegexNotice({ pattern, error }) {
  const p = parseRegexError(error);
  if (!error) return null;
  return (
    <p className="rsz-inline rsz-inline-error" role="alert">
      <strong>Invalid regular expression{p.position !== null ? ` (near character ${p.position})` : ''}:</strong>{' '}
      {p.reason}
      {pattern && (
        <span className="rsz-inline-example"> Pattern: <code>{pattern}</code></span>
      )}
      {p.position !== null && pattern && (
        <span className="rsz-regex-caret" aria-hidden="true">
          {' '.repeat(Math.min(p.position, 60))}↑
        </span>
      )}
    </p>
  );
}

/* 50394 — WebGL-degraded banner --------------------------------------------------------------------------------------------------------------------------------------------------- */

export function WebglDegradedBanner({ onLearnMore, onDismiss }) {
  return (
    <ResilienceState
      compact
      tone="info"
      illustration="🧊"
      title="3D chain view isn't available"
      description="Your browser or GPU doesn't support WebGL, so the vulnerability chain view fell back to 2D. All chains, nodes, and links are still fully explorable."
      primary={onLearnMore && { label: 'Why 2D?', onClick: onLearnMore }}
      secondary={onDismiss && { label: 'Dismiss', onClick: onDismiss }}
    />
  );
}

/* Registry for honesty checks ----------------------------------------- */

export const RESILIENCE_STATE_IDEAS = [
  { idea: 50361, name: 'VersionMismatchBanner' },
  { idea: 50362, name: 'MaintenanceModePage' },
  { idea: 50363, name: 'Friendly500Fallback' },
  { idea: 50364, name: 'OfflineQueueBanner' },
  { idea: 50365, name: 'CardErrorBoundary' },
  { idea: 50366, name: 'TimelineGapMarker' },
  { idea: 50367, name: 'PocReplayFailureDiff' },
  { idea: 50368, name: 'ScreenshotCapturePlaceholder' },
  { idea: 50369, name: 'MicBlockedError' },
  { idea: 50370, name: 'AvatarFallbackPortrait' },
  { idea: 50371, name: 'StaleIndexNotice' },
  { idea: 50372, name: 'ImpossibleFilterCombination' },
  { idea: 50373, name: 'ScheduledHuntFailure' },
  { idea: 50374, name: 'WebhookFailureLog' },
  { idea: 50375, name: 'BulkActionPartialFailure' },
  { idea: 50376, name: 'CommentDraftPreservation' },
  { idea: 50377, name: 'ThemeAssetFallback' },
  { idea: 50378, name: 'PrintFallback' },
  { idea: 50379, name: 'ClipboardDeniedFallback' },
  { idea: 50380, name: 'ShortcutConflictWarning' },
  { idea: 50381, name: 'CsvImportErrors' },
  { idea: 50382, name: 'TimezoneWarning' },
  { idea: 50383, name: 'AriaLabelDevOverlay' },
  { idea: 50384, name: 'DeletedFindingDeepLink' },
  { idea: 50385, name: 'ConcurrentEditMergeUI' },
  { idea: 50386, name: 'SnapshotRestoreFailure' },
  { idea: 50387, name: 'DesktopBridgeDisconnect' },
  { idea: 50388, name: 'InferenceTimeoutOption' },
  { idea: 50389, name: 'DiskQuotaWarning' },
  { idea: 50390, name: 'CorsBlockedPreview' },
  { idea: 50391, name: 'ExpiredShareLink' },
  { idea: 50392, name: 'DuplicateHuntDetection' },
  { idea: 50393, name: 'InvalidRegexNotice' },
  { idea: 50394, name: 'WebglDegradedBanner' },
];

export default ResilienceState;
