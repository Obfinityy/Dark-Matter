/**
 * DedupBanner — "you already hunted this target" UX.
 *
 * When POST /jobs returns { deduped: true, huntRecord }, this banner shows
 * the cached report instead of re-running the agent: target, version,
 * severity summary, completed date — with actions to view/download the
 * existing report or explicitly start a fresh hunt (forceNew: true).
 *
 * Props:
 *   result   — the deduped response { target, huntRecord, message }
 *   onView   — () => void  (open the cached report)
 *   onNewHunt — () => void (start a fresh hunt of the same target)
 *   onDismiss — () => void
 */
import React from 'react';
import { History, RefreshCw, Eye, X } from 'lucide-react';
import './DedupBanner.css';

export function DedupBanner({ result, onView, onNewHunt, onDismiss }) {
  const record = result?.huntRecord;
  if (!record) return null;
  const summary = record.summary || {};

  const target = result.target || record.target;

  // Guard the date: a missing or unparseable timestamp renders nothing,
  // never the literal text "Invalid Date".
  const completedAt = record.completedAt ? new Date(record.completedAt) : null;
  const completedLabel =
    completedAt && !Number.isNaN(completedAt.getTime())
      ? ` on ${completedAt.toLocaleDateString()}`
      : '';

  const totalFindings = summary.totalFindings;
  const criticalCount = summary.critical;

  return (
    <div className="dm-dedup-banner" role="status">
      <button
        type="button"
        className="dm-dedup-close"
        onClick={onDismiss}
        aria-label="Dismiss banner"
      >
        <X size={16} aria-hidden="true" />
      </button>
      <div className="dm-dedup-icon" aria-hidden="true">
        <History size={22} />
      </div>
      <div className="dm-dedup-body">
        <h3>Already hunted — report ready instantly</h3>
        <p>
          <code>{target}</code> was hunted before{completedLabel}.
          {record.version != null && (
            <>
              {' '}
              Report <strong>v{record.version}</strong>
            </>
          )}
          {totalFindings != null && (
            <>
              {' '}
              — {totalFindings} finding{totalFindings === 1 ? '' : 's'}
              {criticalCount > 0 && (
                <span className="dm-sev-chip sev-critical"> {criticalCount} critical</span>
              )}
            </>
          )}
          .
        </p>
        <p className="dm-dedup-hint">
          No need to burn another hunt — the cached report is below. Want a fresh look? Start a new
          hunt.
        </p>
        <div className="dm-dedup-actions">
          <button type="button" className="dm-btn-primary" onClick={onView}>
            <Eye size={14} aria-hidden="true" /> View cached report
          </button>
          <button type="button" className="dm-btn-secondary" onClick={onNewHunt}>
            <RefreshCw size={14} aria-hidden="true" /> Start new hunt
          </button>
        </div>
      </div>
    </div>
  );
}
