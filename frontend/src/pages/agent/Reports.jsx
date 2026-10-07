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

export function Reports() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listHuntRecords()
      // The backend wraps the list as { huntRecords }; tolerate either shape.
      .then((body) => setRecords(body?.records || body?.huntRecords || []))
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="dm-container">
        <div className="dm-center dm-mt-8" role="status" aria-live="polite">
          <Loader2 size={18} aria-hidden="true" />
          <p className="dm-muted">Loading past reports…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dm-container">
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: 24,
        }}
      >
        <div className="dm-page-head" style={{ marginBottom: 0 }}>
          <h1 className="dm-page-title">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <History size={26} aria-hidden="true" /> Past reports
            </span>
          </h1>
          <p className="dm-page-sub">
            Every completed hunt, archived. Re-open or re-download any report — pasting the
            same target later returns these instantly.
          </p>
        </div>
        <Link to="/agent" className="dm-btn dm-btn-primary" style={{ flexShrink: 0 }}>New hunt</Link>
      </header>

      <div className="dm-notice" style={{ marginBottom: 24 }}>
        <ShieldCheck size={16} className="dm-notice-icon" aria-hidden="true" />
        <span>
          <strong style={{ color: 'var(--dm-text)' }}>Report already exists for a target?</strong>{' '}
          Pasting the same target again shows the saved report instantly — no re-hunt, no
          duplicate work. Use “Start new hunt” on the Hunt AI page only when you want a fresh run.
        </span>
      </div>

      {records.length === 0 ? (
        <div className="dm-empty">
          <div className="dm-empty-icon">
            <FileText size={28} aria-hidden="true" />
          </div>
          <h2 className="dm-empty-title">No completed hunts yet</h2>
          <p className="dm-empty-sub">Your reports will live here.</p>
          <Link to="/agent" className="dm-btn dm-btn-primary">Start your first hunt</Link>
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} aria-label="Past hunt reports">
          {records.map((record) => {
            const summary = record.summary || {};
            const findings = Array.isArray(record.findings) ? record.findings : [];
            const coverage = owaspCoverage(findings);
            const top = [...findings]
              .sort((a, b) => sevRank(b.severity) - sevRank(a.severity))
              .slice(0, 3);
            return (
              <li key={record.id} style={{ marginBottom: 8 }}>
                <Link
                  to={`/agent/reports/${record.id}`}
                  className="dm-row"
                  style={{ textDecoration: 'none', color: 'inherit', display: 'flex' }}
                  aria-label={`Report for ${record.target}${summary.totalFindings != null ? `, ${summary.totalFindings} findings` : ''}`}
                >
                  <div className="dm-row-main">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, minWidth: 0 }}>
                      <code className="dm-row-title" style={{ fontFamily: 'ui-monospace, monospace' }}>
                        {record.target}
                      </code>
                      <span className="dm-badge">v{record.version || 1}</span>
                    </div>
                    <p className="dm-row-sub">
                      {record.completedAt && (
                        <time dateTime={record.completedAt} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <CalendarDays size={12} aria-hidden="true" />
                          {new Date(record.completedAt).toLocaleDateString()}
                        </time>
                      )}
                      {record.completedAt && summary.totalFindings != null && ' · '}
                      {summary.totalFindings != null && `${summary.totalFindings} findings`}
                    </p>
                    {top.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                        {top.map((f) => (
                          <CvssBadge key={f.id || f.title} finding={f} />
                        ))}
                      </div>
                    )}
                    {findings.length > 0 && (
                      <div style={{ marginTop: 8 }}>
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
  return { critical: 4, high: 3, medium: 2, low: 1, informational: 0 }[String(sev || '').toLowerCase()] ?? 0;
}
