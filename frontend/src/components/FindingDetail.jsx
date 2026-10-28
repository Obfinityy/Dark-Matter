// FindingDetail — the detail view for one finding (28 Oct 2026,
// finding-detail lane).
//
// The "Confirmed vulnerabilities" / leads list in HuntCard used to be
// display-only rows: severity, title, badge, detail — no way to see
// the evidence, the reproduction or when it was recorded. This modal
// fetches the full record itself via getFindingDetail(huntId, title)
// (GET /api/v1/hunts/:id/findings/:title) and renders exactly what
// the backend recorded. Missing fields render as "not available" —
// nothing is invented here.
//
// Props: {huntId, title, onClose}. Closing changes NO hunt state:
// it only unmounts this modal and returns to the list.
import { useEffect, useState } from 'react';
import { getFindingDetail } from '../lib/api';
import {
  EVIDENCE_MISSING,
  REPRO_MISSING,
  evidenceText,
  findingRecordedAt,
  findingStatus,
  formatRecordedAt,
  reproductionCommand,
} from '../lib/findingDetail';

const SEVERITY_CLASS = {
  critical: 'sev-critical',
  high: 'sev-high',
  medium: 'sev-medium',
  low: 'sev-low',
};

export default function FindingDetail({ huntId, title, onClose }) {
  const [finding, setFinding] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setFinding(null);
    getFindingDetail(huntId, title).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.ok && res.data && res.data.finding) {
        setFinding(res.data.finding);
      } else if (res.status === 404) {
        // The backend does not know this title (retracted, or the
        // list row predates the record) — say so, never fake a detail.
        setError('Finding not found');
      } else {
        setError(res.error || 'Could not load this finding.');
      }
    }).catch(() => {
      if (!cancelled) {
        setLoading(false);
        setError('Could not load this finding.');
      }
    });
    return () => { cancelled = true; };
  }, [huntId, title]);

  // Close on Escape; backdrop click closes too (the panel itself
  // stops propagation so clicks inside it do not close it).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose && onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const status = finding ? findingStatus(finding) : null;
  const evidence = finding ? evidenceText(finding.evidence) : '';
  const repro = finding ? reproductionCommand(finding) : '';
  const recorded = finding ? findingRecordedAt(finding) : '';

  return (
    <div
      className="finding-detail-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Finding detail — ${title}`}
      onClick={() => onClose && onClose()}
    >
      <div className="finding-detail-panel" onClick={(e) => e.stopPropagation()}>
        <div className="finding-detail-header">
          <div className="finding-detail-title-row">
            <span className={`finding-detail-sev ${finding ? SEVERITY_CLASS[finding.severity] || 'sev-low' : 'sev-low'}`}>
              {finding ? finding.severity : ''}
            </span>
            <h3 className="finding-detail-title">{title}</h3>
          </div>
          <button
            type="button"
            className="finding-detail-close"
            onClick={() => onClose && onClose()}
            aria-label="Close finding detail"
            title="Close"
          >
            ✕
          </button>
        </div>

        {loading && <div className="finding-detail-empty">Loading finding detail…</div>}

        {error && !loading && (
          <div className="finding-detail-error" role="alert">
            {error === 'Finding not found'
              ? 'Finding not found — the backend has no record for this title. It may have been retracted, or the list row is stale.'
              : error}
          </div>
        )}

        {finding && !loading && (
          <>
            <div className="finding-detail-status">
              <span className={`finding-badge ${finding.verified ? 'finding-verified' : 'finding-unverified'}`}>
                {status.label}
              </span>
              <span className="finding-detail-verification" title={status.note}>{status.note}</span>
            </div>

            {finding.detail && (
              <div className="finding-detail-section">
                <div className="finding-detail-section-title">What was found</div>
                <p className="finding-detail-text">{finding.detail}</p>
              </div>
            )}

            <div className="finding-detail-section">
              <div className="finding-detail-section-title">Evidence</div>
              {evidence ? (
                // Safe text in a <pre>: React escapes it by default,
                // so a reflected payload (<script>alert(1)</script>)
                // renders as text and never executes.
                <pre className="finding-detail-evidence">{evidence}</pre>
              ) : (
                <div className="finding-detail-empty">{EVIDENCE_MISSING}</div>
              )}
            </div>

            <div className="finding-detail-section">
              <div className="finding-detail-section-title">Reproduce</div>
              {repro ? (
                <pre className="finding-detail-evidence finding-detail-repro">{repro}</pre>
              ) : (
                <div className="finding-detail-empty">{REPRO_MISSING}</div>
              )}
            </div>

            <div className="finding-detail-section">
              <div className="finding-detail-section-title">Recorded</div>
              <div className="finding-detail-recorded">{formatRecordedAt(recorded)}</div>
            </div>
          </>
        )}

        <div className="finding-detail-footer">
          <button type="button" className="btn" onClick={() => onClose && onClose()}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
