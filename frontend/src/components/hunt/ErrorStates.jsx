/**
 * ErrorStates.jsx — Forge wave 9, ideas 50341–50360.
 *
 * Every failure surface gets a purposeful error state instead of a dead
 * screen: a shared <ErrorState> shell plus 20 named states, one per idea.
 * Each state carries real CTAs that wire into the parent via callbacks —
 * retry, resume, reconnect, cleanup — no dead buttons.
 *
 * Pure presentation sits in this file; testable logic lives in errorCore.js.
 * Import from errorCore.js for helpers (formatBytes, formatCountdown, …).
 *
 * Idea map: 50341 hunt-failed banner · 50342 partial-failure notice ·
 * 50343 rate-limit countdown · 50344 WAF-blocked badge · 50345 model
 * download failure · 50346 invalid Kaggle link · 50347 session-expired
 * overlay · 50348 socket-disconnect banner · 50349 quota-exceeded ·
 * 50350 inline URL validation · 50351 scope-violation block ·
 * 50352 report-generation failure · 50353 ZIP-export failure ·
 * 50354 permission-denied sharing · 50355 upload-too-large ·
 * 50356 unsupported-target notice · 50357 agent-stall error ·
 * 50358 payment-failed · 50359 SSO error mapping · 50360 storage-full.
 */

import { useState, useEffect, useId } from 'react';
import {
  buildHuntFailureBanner,
  partialFailureMessage,
  formatBytes,
  formatCountdown,
  validateTargetUrl,
  scopeViolationMessage,
  agentStallState,
  quotaExceededMessage,
  mapSsoError,
  uploadTooLargeMessage,
  storageFullWarning,
} from './errorCore.js';
import './ErrorStates.css';

/* Shared shell --------------------------------------------------------- */

/* Maps each legacy illustration emoji to a professional stroke icon so
 * every error state renders a tone-tinted glyph instead of an emoji.
 * Unknown strings still render as-is (backwards compatible). */
const ERS_GLYPH = {
  '⚠️': 'alert', '🟡': 'notice', '⏳': 'clock', '🛡️': 'shield', '🧠': 'download',
  '🔗': 'link', '🔒': 'lock', '📡': 'signal', '📊': 'chart', '🚫': 'ban',
  '📄': 'file', '🗜️': 'archive', '🙈': 'eyeoff', '📦': 'package', '🧭': 'compass',
  '🛑': 'stop', '💳': 'card', '🔑': 'key', '💾': 'database',
};

const ERS_ICON_PATHS = {
  alert: (<><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>),
  notice: (<><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>),
  clock: (<><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>),
  shield: (<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" /></>),
  download: (<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>),
  link: (<><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>),
  lock: (<><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>),
  signal: (<><line x1="1" y1="1" x2="23" y2="23" /><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" /><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" /><path d="M10.71 5.05A16 16 0 0 1 22.58 9" /><path d="M1.42 9a15.91 15.91 0 0 1 5-2.91" /><path d="M8.53 16.11a6 6 0 0 1 6.95 0" /><line x1="12" y1="20" x2="12.01" y2="20" /></>),
  chart: (<><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>),
  ban: (<><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></>),
  file: (<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></>),
  archive: (<><rect x="2" y="3" width="20" height="5" rx="1" /><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" /><path d="M10 12h4" /></>),
  eyeoff: (<><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" /></>),
  package: (<><path d="M16.5 9.4 7.55 4.24" /><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></>),
  compass: (<><circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" /></>),
  stop: (<><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>),
  card: (<><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></>),
  key: (<><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></>),
  database: (<><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></>),
};

function ErsIcon({ name }) {
  return (
    <svg
      width="24" height="24" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true" focusable="false"
    >
      {ERS_ICON_PATHS[name]}
    </svg>
  );
}

export function ErrorState({
  illustration,
  title,
  description,
  details,
  primary,
  secondary,
  tone = 'error',
  compact = false,
  children,
}) {
  const [showDetails, setShowDetails] = useState(false);
  const titleId = useId();
  const glyph = typeof illustration === 'string' ? ERS_GLYPH[illustration.trim()] : null;
  return (
    <section
      className={`ers ${compact ? 'ers-compact' : ''} ers-tone-${tone}`}
      role="alert"
      aria-labelledby={titleId}
    >
      {illustration && (
        <div className="ers-illustration" aria-hidden="true">
          {glyph ? <ErsIcon name={glyph} /> : illustration}
        </div>
      )}
      <h3 className="ers-title" id={titleId}>{title}</h3>
      {description && <p className="ers-desc">{description}</p>}
      {details && (
        <div className="ers-details-wrap">
          <button
            type="button"
            className="ers-details-toggle"
            aria-expanded={showDetails}
            onClick={() => setShowDetails((v) => !v)}
          >
            {showDetails ? 'Hide details' : 'Show details'}
          </button>
          {showDetails && (
            <pre className="ers-details" tabIndex={0} aria-label="Error details">{details}</pre>
          )}
        </div>
      )}
      {(primary || secondary) && (
        <div className="ers-actions">
          {primary && (
            <button type="button" className="ers-btn ers-primary" onClick={primary.onClick}>
              {primary.label}
            </button>
          )}
          {secondary && (
            <button type="button" className="ers-btn ers-secondary" onClick={secondary.onClick}>
              {secondary.label}
            </button>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

/* 50341 — hunt-failed banner --------------------------------------------- */

export function HuntFailedBanner({ stepName, errorExcerpt, huntId, onResume, onDismiss }) {
  const b = buildHuntFailureBanner({ stepName, errorExcerpt, huntId });
  return (
    <ErrorState
      compact
      illustration="⚠️"
      title={b.title}
      description="The hunt stopped unexpectedly. Findings collected so far are safe."
      details={b.excerpt}
      primary={onResume && { label: 'Resume from checkpoint', onClick: onResume }}
      secondary={onDismiss && { label: 'Dismiss', onClick: onDismiss }}
    >
      <p className="ers-hint">{b.checkpointHint}</p>
    </ErrorState>
  );
}

/* 50342 — partial-failure notice ------------------------------------------ */

export function PartialFailureNotice({ failed, total, failedChecks = [], onViewDetails }) {
  return (
    <ErrorState
      compact
      tone="warning"
      illustration="🟡"
      title={partialFailureMessage({ failed, total })}
      description="The hunt completed. Checks that failed are excluded from the findings — what passed is unaffected."
      details={failedChecks.length ? failedChecks.map((c) => `• ${c}`).join('\n') : undefined}
      secondary={onViewDetails && { label: 'Review failed checks', onClick: onViewDetails }}
    />
  );
}

/* 50343 — rate-limit backoff countdown ------------------------------------ */

export function RateLimitCountdown({ msRemaining, onCancel, liveMs = 60000 }) {
  const [remaining, setRemaining] = useState(msRemaining ?? liveMs);
  const done = remaining <= 0;
  useEffect(() => {
    if (remaining <= 0) return undefined;
    const t = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [remaining > 0]);
  return (
    <ErrorState
      compact
      tone="warning"
      illustration="⏳"
      title="Target is throttling us"
      description={
        done
          ? 'Backoff finished — resuming the hunt.'
          : `Backing off to stay under the target's rate limit. Resuming in ${formatCountdown(remaining)}.`
      }
      secondary={onCancel && !done && { label: 'Cancel hunt', onClick: onCancel }}
    >
      {!done && (
        <div
          className="ers-countdown"
          role="timer"
          aria-label={`${formatCountdown(remaining)} remaining`}
        >
          {formatCountdown(remaining)}
        </div>
      )}
    </ErrorState>
  );
}

/* 50344 — WAF-blocked badge ----------------------------------------------- */

export function WafBlockedBadge({ stepName, onEnableStealth, onSkip }) {
  return (
    <ErrorState
      compact
      illustration="🛡️"
      title="Blocked by the target's WAF"
      description={stepName
        ? `Step "${stepName}" was blocked by a web application firewall. Switch to stealth mode and retry it.`
        : 'A web application firewall blocked this step. Switch to stealth mode and retry it.'}
      primary={onEnableStealth && { label: 'Enable stealth and retry', onClick: onEnableStealth }}
      secondary={onSkip && { label: 'Skip this step', onClick: onSkip }}
    />
  );
}

/* 50345 — model-download failure ------------------------------------------ */

export function ModelDownloadFailure({ slot, bytesReceived, bytesTotal, onResume, onRetry }) {
  const pct = bytesTotal > 0 ? Math.round((bytesReceived / bytesTotal) * 100) : 0;
  return (
    <ErrorState
      compact
      illustration="🧠"
      title="Model download failed"
      description={`${slot || 'Brain slot'} download stopped at ${formatBytes(bytesReceived)}${bytesTotal ? ` of ${formatBytes(bytesTotal)}` : ''} (${pct}%). The partial file is kept — resume picks up where it left off.`}
      primary={onResume && { label: 'Resume download', onClick: onResume }}
      secondary={onRetry && { label: 'Restart from scratch', onClick: onRetry }}
    />
  );
}

/* 50346 — invalid Kaggle link --------------------------------------------- */

export function InvalidKaggleLinkError({ link, onTestConnection, onFix }) {
  return (
    <ErrorState
      compact
      illustration="🔗"
      title="That Kaggle link doesn't connect"
      description="The link you pasted didn't respond as a valid Gradio endpoint. It must be the public /gradio/live URL from your Kaggle notebook — not the notebook page itself."
      details={link}
      primary={onFix && { label: 'Fix the link', onClick: onFix }}
      secondary={onTestConnection && { label: 'Test connection', onClick: onTestConnection }}
    />
  );
}

/* 50347 — session-expired overlay ----------------------------------------- */

export function SessionExpiredOverlay({ huntRunning, onRelogin, onDismiss }) {
  return (
    <div className="ers-overlay" role="dialog" aria-modal="true" aria-label="Session expired">
      <ErrorState
        compact
        illustration="🔒"
        title="Session expired"
        description={huntRunning
          ? 'Your session timed out, but the hunt keeps running. Sign in again here — you won’t lose your place.'
          : 'Your session timed out. Sign in again to continue.'}
        primary={onRelogin && { label: 'Sign in again', onClick: onRelogin }}
        secondary={onDismiss && { label: 'Later', onClick: onDismiss }}
      />
    </div>
  );
}

/* 50348 — socket-disconnect banner ---------------------------------------- */

export function SocketDisconnectBanner({ onRetry, attempts = 0 }) {
  return (
    <ErrorState
      compact
      tone="warning"
      illustration="📡"
      title="Live updates paused — reconnecting…"
      description={`The real-time connection dropped.${attempts > 0 ? ` Retry attempt ${attempts}.` : ''} The hunt continues on the server; you'll see the latest state on reconnect.`}
      secondary={onRetry && { label: 'Retry now', onClick: onRetry }}
    />
  );
}

/* 50349 — quota-exceeded -------------------------------------------------- */

export function QuotaExceededState({ quotaName, resetsAt, onUpgrade, onViewUsage }) {
  const m = quotaExceededMessage({ quotaName, resetsAt });
  return (
    <ErrorState
      compact
      illustration="📊"
      title={m.title}
      description={m.detail}
      primary={onUpgrade && { label: 'Upgrade for more', onClick: onUpgrade }}
      secondary={onViewUsage && { label: 'View usage', onClick: onViewUsage }}
    />
  );
}

/* 50350 — inline URL validation ------------------------------------------- */

export function InlineUrlValidation({ value }) {
  const v = validateTargetUrl(value);
  if (!value) return null;
  if (v.ok) {
    return v.warning ? <p className="ers-inline ers-inline-warning" role="status">{v.warning}</p> : null;
  }
  return (
    <p className="ers-inline ers-inline-error" role="alert">
      {v.message}{' '}
      {v.example && (
        <span className="ers-inline-example">Example: <code>{v.example}</code></span>
      )}
    </p>
  );
}

/* 50351 — scope-violation block ------------------------------------------- */

export function ScopeViolationBlock({ target, matchedRule, onEditScope, onContactAdmin }) {
  const m = scopeViolationMessage({ target, matchedRule });
  return (
    <ErrorState
      compact
      illustration="🚫"
      title={m.title}
      description={m.detail}
      primary={onEditScope && { label: 'Edit scope', onClick: onEditScope }}
      secondary={onContactAdmin && { label: 'Ask an admin', onClick: onContactAdmin }}
    />
  );
}

/* 50352 — report-generation failure --------------------------------------- */

export function ReportGenerationFailure({ failedPage, markdownReady, onRetry, onDownloadMarkdown }) {
  return (
    <ErrorState
      compact
      illustration="📄"
      title={failedPage ? `PDF failed at page ${failedPage}` : 'PDF report failed'}
      description="The report content is safe. Retry the PDF render, or take the Markdown version right now."
      primary={markdownReady && onDownloadMarkdown && { label: 'Download Markdown instead', onClick: onDownloadMarkdown }}
      secondary={onRetry && { label: 'Retry PDF', onClick: onRetry }}
    />
  );
}

/* 50353 — ZIP-export failure ---------------------------------------------- */

export function ZipExportFailure({ failedFiles = [], onRetryFailed, onDownloadIndividual }) {
  return (
    <ErrorState
      compact
      illustration="🗜️"
      title={`Export failed for ${failedFiles.length} file${failedFiles.length === 1 ? '' : 's'}`}
      description="The rest of the archive exported fine. Retry just the failed files, or download them individually."
      details={failedFiles.length ? failedFiles.map((f) => `• ${f.name}: ${f.error || 'unknown error'}`).join('\n') : undefined}
      primary={onRetryFailed && failedFiles.length > 0 && { label: 'Retry failed files', onClick: onRetryFailed }}
      secondary={onDownloadIndividual && { label: 'Download files individually', onClick: onDownloadIndividual }}
    />
  );
}

/* 50354 — permission-denied sharing --------------------------------------- */

export function PermissionDeniedSharing({ huntTitle, ownerName, onRequestAccess, onGoHome }) {
  return (
    <ErrorState
      compact
      illustration="🙈"
      title="You don't have access to this hunt"
      description={ownerName
        ? `"${huntTitle || 'This hunt'}" is private to ${ownerName}. Request access and they'll be notified.`
        : 'This hunt is private. Request access and the owner will be notified.'}
      primary={onRequestAccess && { label: 'Request access', onClick: onRequestAccess }}
      secondary={onGoHome && { label: 'Back to hunts', onClick: onGoHome }}
    />
  );
}

/* 50355 — upload-too-large ------------------------------------------------- */

export function UploadTooLargeError({ sizeBytes, limitBytes, onCompress, onPickAnother }) {
  const m = uploadTooLargeMessage({ sizeBytes, limitBytes });
  return (
    <ErrorState
      compact
      illustration="📦"
      title={m.title}
      description={m.detail}
      primary={onPickAnother && { label: 'Choose a smaller file', onClick: onPickAnother }}
      secondary={onCompress && { label: 'How to compress', onClick: onCompress }}
    />
  );
}

/* 50356 — unsupported-target notice ---------------------------------------- */

export function UnsupportedTargetNotice({ targetType, alternatives = [], onPickAlternative }) {
  return (
    <ErrorState
      compact
      illustration="🧭"
      title={`${targetType || 'This target type'} isn't supported yet`}
      description="Dark-Matter hunts web applications, APIs, and cloud surfaces. Some target types (thick clients, binaries) need a different approach."
      primary={onPickAlternative && alternatives.length > 0 && { label: `Try: ${alternatives[0]}`, onClick: () => onPickAlternative(alternatives[0]) }}
      secondary={alternatives.length > 1 && onPickAlternative && { label: 'See alternatives', onClick: () => onPickAlternative(alternatives[1]) }}
    />
  );
}

/* 50357 — agent-stall error ------------------------------------------------- */

export function AgentStallError({ lastProgressAt, now, phaseName, onRestartPhase, onDownloadDiagnostics }) {
  const s = agentStallState({ lastProgressAt, now });
  if (!s.stalled) return null;
  return (
    <ErrorState
      compact
      illustration="🛑"
      title={`Agent stalled${phaseName ? ` in ${phaseName}` : ''}`}
      description={s.message}
      primary={onRestartPhase && { label: 'Restart this phase', onClick: onRestartPhase }}
      secondary={onDownloadDiagnostics && { label: 'Download diagnostics', onClick: onDownloadDiagnostics }}
    />
  );
}

/* 50358 — payment-failed ----------------------------------------------------- */

export function PaymentFailedState({ planName, invoiceUrl, onRetry, onUpdateCard }) {
  return (
    <ErrorState
      compact
      illustration="💳"
      title="Payment failed"
      description={`Your ${planName || 'plan'} upgrade couldn't be charged. No changes were made to your account — retry or update your card.`}
      primary={onRetry && { label: 'Retry payment', onClick: onRetry }}
      secondary={onUpdateCard ? { label: 'Update card', onClick: onUpdateCard } : (invoiceUrl ? { label: 'View invoice', onClick: () => window.open(invoiceUrl, '_blank', 'noopener') } : null)}
    />
  );
}

/* 50359 — SSO error mapping --------------------------------------------------- */

export function SsoErrorMapping({ providerCode, providerName, onRetry, onUseEmail }) {
  const m = mapSsoError(providerCode, providerName);
  return (
    <ErrorState
      compact
      illustration="🔑"
      title={m.title}
      description={m.detail}
      primary={onRetry && { label: 'Try again', onClick: onRetry }}
      secondary={onUseEmail && { label: 'Use email sign-in', onClick: onUseEmail }}
    />
  );
}

/* 50360 — storage-full warning ------------------------------------------------- */

export function StorageFullWarning({ usedBytes, quotaBytes, onCleanup, onViewSnapshots }) {
  const m = storageFullWarning({ usedBytes, quotaBytes });
  return (
    <ErrorState
      compact
      tone="warning"
      illustration="💾"
      title={m.title}
      description={m.detail}
      primary={onCleanup && { label: 'Clean up snapshots', onClick: onCleanup }}
      secondary={onViewSnapshots && { label: 'View snapshots', onClick: onViewSnapshots }}
    />
  );
}

/* Registry for honesty checks ----------------------------------------- */

export const ERROR_STATE_IDEAS = [
  { idea: 50341, name: 'HuntFailedBanner' },
  { idea: 50342, name: 'PartialFailureNotice' },
  { idea: 50343, name: 'RateLimitCountdown' },
  { idea: 50344, name: 'WafBlockedBadge' },
  { idea: 50345, name: 'ModelDownloadFailure' },
  { idea: 50346, name: 'InvalidKaggleLinkError' },
  { idea: 50347, name: 'SessionExpiredOverlay' },
  { idea: 50348, name: 'SocketDisconnectBanner' },
  { idea: 50349, name: 'QuotaExceededState' },
  { idea: 50350, name: 'InlineUrlValidation' },
  { idea: 50351, name: 'ScopeViolationBlock' },
  { idea: 50352, name: 'ReportGenerationFailure' },
  { idea: 50353, name: 'ZipExportFailure' },
  { idea: 50354, name: 'PermissionDeniedSharing' },
  { idea: 50355, name: 'UploadTooLargeError' },
  { idea: 50356, name: 'UnsupportedTargetNotice' },
  { idea: 50357, name: 'AgentStallError' },
  { idea: 50358, name: 'PaymentFailedState' },
  { idea: 50359, name: 'SsoErrorMapping' },
  { idea: 50360, name: 'StorageFullWarning' },
];

export default ErrorState;
