/**
 * ReportReader — read a past hunt report, or download it.
 *
 * Renders the archived Markdown report (or a graceful "no report yet" state)
 * and offers the same one-click Markdown/PDF export as a live hunt.
 */
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, FileWarning, ShieldAlert } from 'lucide-react';
import { getHuntRecord, downloadHuntRecordMarkdown } from '../../services/api';
import { ReportExport } from '../../components/agent/ReportExport';

export function ReportReader() {
  const { id } = useParams();
  const [record, setRecord] = useState(null);
  const [markdown, setMarkdown] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [rec, md] = await Promise.all([
          getHuntRecord(id),
          downloadHuntRecordMarkdown(id).catch(() => null)
        ]);
        if (cancelled) return;
        setRecord(rec?.record || rec);
        setMarkdown(typeof md === 'string' ? md : (md?.markdown || ''));
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load the report.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <div className="dm-page-loading"><Loader2 size={18} className="dm-spin" /> Loading report…</div>;

  if (error || !record) {
    return (
      <div className="dm-report-reader">
        <Link to="/agent/reports" className="dm-back"><ArrowLeft size={14} /> Past reports</Link>
        <div className="dm-page-error"><ShieldAlert size={18} /> {error || 'Report not found.'}</div>
      </div>
    );
  }

  return (
    <div className="dm-report-reader">
      <Link to="/agent/reports" className="dm-back"><ArrowLeft size={14} /> Past reports</Link>

      <div className="dm-reader-top">
        <ReportExport huntId={record.jobId || record.id} recordId={record.id} markdown={markdown} />
      </div>

      <header className="dm-reader-head">
        <code>{record.target}</code>
        <div className="dm-reader-meta">
          <span className="dm-record-version">v{record.version || 1}</span>
          {record.completedAt && <span>Hunted {new Date(record.completedAt).toLocaleString()}</span>}
          {record.severitySummary && (
            <span className="dm-sev-chips">
              {Object.entries(record.severitySummary).map(([sev, count]) => (
                count > 0 && <span key={sev} className={`dm-sev-chip sev-${sev}`}>{sev} {count}</span>
              ))}
            </span>
          )}
        </div>
      </header>

      {markdown ? (
        <article className="dm-markdown-body">
          {markdown.split('\n').map((line, i) => (
            <React.Fragment key={i}>
              {line.startsWith('# ') ? <h1>{line.slice(2)}</h1>
              : line.startsWith('## ') ? <h2>{line.slice(3)}</h2>
              : line.startsWith('### ') ? <h3>{line.slice(4)}</h3>
              : line.startsWith('- ') ? <li>{line.slice(2)}</li>
              : line.startsWith('> ') ? <blockquote>{line.slice(2)}</blockquote>
              : line.trim() === '' ? <br />
              : <p>{line}</p>}
            </React.Fragment>
          ))}
        </article>
      ) : (
        <div className="dm-empty-state">
          <FileWarning size={28} />
          <p>No Markdown report was archived for this hunt — its findings summary above is the record.</p>
        </div>
      )}
    </div>
  );
}
