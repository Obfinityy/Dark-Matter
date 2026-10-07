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

import { useState, useEffect } from 'react';
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
  return (
    <section
      className={`ers ${compact ? 'ers-compact' : ''} ers-tone-${tone}`}
      role="alert"
      aria-label={title}
    >
      {illustration && (
        <div className="ers-illustration" aria-hidden="true">{illustration}</div>
      )}
      <h3 className="ers-title">{title}</h3>
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
          {showDetails && <pre className="ers-details">{details}</pre>}
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
