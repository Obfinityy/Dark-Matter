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

export function DedupBanner({ result, onView, onNewHunt, onDismiss }) {
  const record = result?.huntRecord;
  if (!record) return null;
  const summary = record.summary || {};

  return (
    <div className="dm-dedup-banner" role="status">
      <button className="dm-dedup-close" onClick={onDismiss} aria-label="Dismiss banner" title="Dismiss">
        <X size={16} />
      </button>
      <div className="dm-dedup-icon"><History size={22} /></div>
      <div className="dm-dedup-body">
        <h3>Already hunted — report ready instantly</h3>
        <p>
          <code>{result.target || record.target}</code> was hunted before
          {record.completedAt ? ` on ${new Date(record.completedAt).toLocaleDateString()}` : ''}.
          {' '}Report <strong>v{record.version}</strong>
          {summary.totalFindings != null && (
            <> — {summary.totalFindings} finding{summary.totalFindings === 1 ? '' : 's'}
            {summary.critical > 0 && <span className="dm-sev-chip sev-critical"> {summary.critical} critical</span>}
            </>
          )}.
        </p>
        <p className="dm-dedup-hint">No need to burn another hunt — the cached report is below. Want a fresh look? Start a new hunt.</p>
        <div className="dm-dedup-actions">
          <button className="dm-btn-primary" onClick={onView}>
            <Eye size={14} /> View cached report
          </button>
          <button className="dm-btn-secondary" onClick={onNewHunt}>
            <RefreshCw size={14} /> Start new hunt
          </button>
        </div>
      </div>
    </div>
  );
}
