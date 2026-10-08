/**
 * Reports — the past-reports browser.
 *
 * Every completed hunt archives its final report in the database
 * (hybrid storage). This page lists them newest-first; each record opens a
 * reader with the full Markdown report, severity summary, and one-click
 * Markdown/PDF export. Re-download any past report at any time.
 *
 * Dedup: pasting a target that was already hunted returns the saved report
 * instantly — the notice below says so, and each card shows its OWASP
 * coverage meter and CVSS-scored severity pills.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { History, Loader2, FileText, CalendarDays, ShieldCheck } from 'lucide-react';
import { listHuntRecords } from '../../services/api';
import { owaspCoverage } from '../../utils/owaspCoverage';
import { CoverageMeter } from '../../components/agent/CoverageMeter';
import { CvssBadge } from '../../components/agent/CvssBadge';
import './Reports.css';

export function Reports() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listHuntRecords()
      // The backend wraps the list as { huntRecords }; tolerate either shape.
      .then(body => setRecords(body?.records || body?.huntRecords || []))
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="dm-container">
        <div className="dm-reports-loading" role="status" aria-live="polite">
          <Loader2 size={18} aria-hidden="true" className="sg-spin" />
          <p className="dm-muted">Loading past reports…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dm-container">
      <header className="dm-reports-head">
        <div className="dm-page-head">
          <h1 className="dm-page-title">
            <span className="dm-reports-title">
              <History size={26} aria-hidden="true" /> Past reports
            </span>
          </h1>
          <p className="dm-page-sub">
            Every completed hunt, archived. Re-open or re-download any report — pasting the same
            target later returns these instantly.
          </p>
        </div>
        <Link to="/agent" className="dm-btn dm-btn-primary">
          New hunt
        </Link>
      </header>

      <div className="dm-notice dm-reports-notice">
        <ShieldCheck size={16} className="dm-notice-icon" aria-hidden="true" />
        <span>
          <strong style={{ color: 'var(--dm-text)' }}>Report already exists for a target?</strong>{' '}
          Pasting the same target again shows the saved report instantly — no re-hunt, no duplicate
          work. Use “Start new hunt” on the Hunt AI page only when you want a fresh run.
        </span>
      </div>

      {records.length === 0 ? (
        <div className="dm-empty">
          <div className="dm-empty-icon-lucide">
            <FileText size={24} aria-hidden="true" />
          </div>
          <h2 className="dm-empty-title">No completed hunts yet</h2>
          <p className="dm-empty-sub">Your reports will live here.</p>
          <Link to="/agent" className="dm-btn dm-btn-primary">
            Start your first hunt
          </Link>
        </div>
      ) : (
        <ul className="dm-reports-list" aria-label="Past hunt reports">
          {records.map(record => {
            const summary = record.summary || {};
            const findings = Array.isArray(record.findings) ? record.findings : [];
            const coverage = owaspCoverage(findings);
            const top = [...findings]
              .sort((a, b) => sevRank(b.severity) - sevRank(a.severity))
              .slice(0, 3);
            return (
              <li key={record.id}>
                <Link
                  to={`/agent/reports/${record.id}`}
                  className="dm-row dm-reports-row"
                  aria-label={`Report for ${record.target}${summary.totalFindings != null ? `, ${summary.totalFindings} findings` : ''}`}
                >
                  <div className="dm-row-main">
                    <div className="dm-reports-row-top">
                      <code className="dm-row-title">{record.target}</code>
                      <span className="dm-badge">v{record.version || 1}</span>
                    </div>
                    <p className="dm-row-sub">
                      {record.completedAt && (
                        <time dateTime={record.completedAt} className="dm-reports-time">
                          <CalendarDays size={12} aria-hidden="true" />
                          {new Date(record.completedAt).toLocaleDateString()}
                        </time>
                      )}
                      {record.completedAt && summary.totalFindings != null && ' · '}
                      {summary.totalFindings != null && `${summary.totalFindings} findings`}
                    </p>
                    {top.length > 0 && (
                      <div className="dm-reports-badges">
                        {top.map(f => (
                          <CvssBadge key={f.id || f.title} finding={f} />
                        ))}
                      </div>
                    )}
                    {findings.length > 0 && (
                      <div className="dm-reports-coverage">
                        <CoverageMeter coverage={coverage} />
                      </div>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function sevRank(sev) {
  return (
    { critical: 4, high: 3, medium: 2, low: 1, informational: 0 }[
      String(sev || '').toLowerCase()
    ] ?? 0
  );
}
