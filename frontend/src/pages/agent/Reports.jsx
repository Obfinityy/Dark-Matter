/**
 * Reports — the past-reports browser.
 *
 * Every completed hunt archives its final report in the database
 * (hybrid storage). This page lists them newest-first; each record opens a
 * reader with the full Markdown report, severity summary, and one-click
 * Markdown/PDF export. Re-download any past report at any time.
 */
import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { History, ChevronLeft, Loader2, FileText, CalendarDays } from 'lucide-react';
import { listHuntRecords, getHuntRecord, downloadHuntRecordMarkdown } from '../../services/api';
import { ReportExport } from '../../components/agent/ReportExport';
import ReactMarkdown from 'react-markdown';

export function Reports() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listHuntRecords()
      .then((body) => setRecords(body?.records || []))
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="dm-page-loading"><Loader2 size={18} className="dm-spin" /> Loading past reports…</div>;

  return (
    <div className="dm-reports">
      <header className="dm-page-head">
        <div>
          <h1><History size={22} /> Past reports</h1>
          <p>Every completed hunt, archived. Re-open or re-download any report — pasting the same target later returns these instantly.</p>
        </div>
        <Link to="/agent" className="dm-btn-secondary">New hunt</Link>
      </header>

      {records.length === 0 ? (
        <div className="dm-empty-state">
          <FileText size={28} />
          <p>No completed hunts yet. Your reports will live here.</p>
        </div>
      ) : (
        <ul className="dm-record-list">
          {records.map((record) => {
            const summary = record.summary || {};
            return (
              <li key={record.id}>
                <Link to={`/agent/reports/${record.id}`} className="dm-record-card">
                  <div className="dm-record-main">
                    <code className="dm-record-target">{record.target}</code>
                    <span className="dm-record-version">v{record.version}</span>
                  </div>
                  <div className="dm-record-meta">
                    {record.completedAt && (
                      <span><CalendarDays size={12} /> {new Date(record.completedAt).toLocaleDateString()}</span>
                    )}
                    {summary.totalFindings != null && <span>{summary.totalFindings} findings</span>}
                    {summary.critical > 0 && <span className="dm-sev-chip sev-critical">{summary.critical} critical</span>}
                    {summary.high > 0 && <span className="dm-sev-chip sev-high">{summary.high} high</span>}
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

export function ReportReader() {
  const { recordId } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getHuntRecord(recordId)
      .then((body) => setRecord(body?.huntRecord || body?.record || null))
      .catch(() => setRecord(null))
      .finally(() => setLoading(false));
  }, [recordId]);

  if (loading) return <div className="dm-page-loading"><Loader2 size={18} className="dm-spin" /> Opening report…</div>;
  if (!record) return <div className="dm-page-error">Report not found.</div>;

  const summary = record.summary || {};

  return (
    <div className="dm-report-reader">
      <div className="dm-reader-top">
        <button className="dm-back" onClick={() => navigate('/agent/reports')}>
          <ChevronLeft size={14} /> Past reports
        </button>
        <ReportExport recordId={record.id} target={record.target} />
      </div>

      <header className="dm-reader-head">
        <code>{record.target}</code>
        <div className="dm-reader-meta">
          <span className="dm-record-version">v{record.version}</span>
          {record.completedAt && <span>{new Date(record.completedAt).toLocaleString()}</span>}
          {summary.totalFindings != null && <span>{summary.totalFindings} findings</span>}
          {summary.critical > 0 && <span className="dm-sev-chip sev-critical">{summary.critical} critical</span>}
        </div>
      </header>

      <article className="dm-markdown-body">
        <ReactMarkdown>{record.reportMarkdown || '*Report body unavailable.*'}</ReactMarkdown>
      </article>
    </div>
  );
}
