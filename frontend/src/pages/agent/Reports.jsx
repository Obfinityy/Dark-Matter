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
      .then((body) => setRecords(body?.records || body?.huntRecords || []))
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="sg-reports">
        <div className="sg-reports-loading" role="status" aria-live="polite">
          <Loader2 size={18} className="sg-spin" /> Loading past reports…
        </div>
      </div>
    );
  }

  return (
    <div className="sg-reports">
      <header className="sg-reports-head">
        <div>
          <h1 className="sg-h1 sg-reports-title"><History size={24} aria-hidden="true" /> Past reports</h1>
          <p className="sg-body">Every completed hunt, archived. Re-open or re-download any report — pasting the same target later returns these instantly.</p>
        </div>
        <Link to="/agent" className="sg-btn sg-btn-primary">New hunt</Link>
      </header>

      <div className="sg-notice">
        <ShieldCheck size={16} />
        <span><strong>Report already exists for a target?</strong> Pasting the same target again shows the saved report instantly — no re-hunt, no duplicate work. Use “Start new hunt” on the Hunt page only when you want a fresh run.</span>
      </div>

      {records.length === 0 ? (
        <div className="sg-empty-state">
          <FileText size={28} aria-hidden="true" />
          <p>No completed hunts yet. Your reports will live here.</p>
          <Link to="/agent" className="sg-btn sg-btn-primary">Start your first hunt</Link>
        </div>
      ) : (
        <ul className="sg-record-list" aria-label="Past hunt reports">
          {records.map((record) => {
            const summary = record.summary || {};
            const findings = Array.isArray(record.findings) ? record.findings : [];
            const coverage = owaspCoverage(findings);
            const top = [...findings]
              .sort((a, b) => sevRank(b.severity) - sevRank(a.severity))
              .slice(0, 3);
            return (
              <li key={record.id}>
                <Link to={`/agent/reports/${record.id}`} className="sg-card sg-card-pad sg-record-card">
                  <div className="sg-record-main">
                    <code className="sg-record-target">{record.target}</code>
                    <span className="sg-pill">v{record.version}</span>
                  </div>
                  <div className="sg-record-meta">
                    {record.completedAt && (
                      <span><CalendarDays size={12} /> {new Date(record.completedAt).toLocaleDateString()}</span>
                    )}
                    {summary.totalFindings != null && <span>{summary.totalFindings} findings</span>}
                    {top.map((f) => (
                      <CvssBadge key={f.id || f.title} finding={f} />
                    ))}
                  </div>
                  {findings.length > 0 && <CoverageMeter coverage={coverage} />}
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
