/**
 * Reports — the past-reports browser.
 *
 * Every completed hunt archives its final report in the database
 * (hybrid storage). This page lists them newest-first; each record opens a
 * reader with the full Markdown report, severity summary, and one-click
 * Markdown/PDF export. Re-download any past report at any time.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { History, Loader2, FileText, CalendarDays } from 'lucide-react';
import { listHuntRecords } from '../../services/api';
import './Reports.css';

export function Reports() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listHuntRecords()
      .then((body) => setRecords(body?.records || []))
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="sg-loading-box"><Loader2 size={18} className="sg-spin" /> Loading past reports…</div>;

  return (
    <div className="sg-reports">
      <header className="sg-page-head">
        <div>
          <h1 className="sg-h1" style={{ display: "flex", alignItems: "center", gap: 12, margin: "0 0 8px" }}><History size={24} /> Past reports</h1>
          <p className="sg-body">Every completed hunt, archived. Re-open or re-download any report — pasting the same target later returns these instantly.</p>
        </div>
        <Link to="/agent" className="sg-btn sg-btn-primary">New hunt</Link>
      </header>

      {records.length === 0 ? (
        <div className="sg-empty-state">
          <FileText size={28} />
          <p>No completed hunts yet. Your reports will live here.</p>
        </div>
      ) : (
        <ul className="sg-record-list">
          {records.map((record) => {
            const summary = record.summary || {};
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
                    {summary.critical > 0 && <span className="sg-pill sg-pill-danger">{summary.critical} critical</span>}
                    {summary.high > 0 && <span className="sg-pill sg-pill-warn">{summary.high} high</span>}
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

