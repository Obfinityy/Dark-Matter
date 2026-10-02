/**
 * ReportReader — read a past hunt report, or download it.
 *
 * Renders the archived Markdown report (or a graceful "no report yet" state)
 * and offers the same one-click Markdown/PDF export as a live hunt.
 *
 * Per-finding extras: CVSS badges, proof-only PoC downloads, reproducible
 * curl/python repro downloads, and the hunt's OWASP Top-10 coverage meter.
 * The dedup notice explains why this saved report is being shown instead of
 * a fresh hunt.
 */
import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, FileWarning, ShieldAlert, Download, ShieldCheck, FlaskConical } from 'lucide-react';
import { getHuntRecord, downloadHuntRecordMarkdown, downloadFindingPoc } from '../../services/api';
import { ReportExport } from '../../components/agent/ReportExport';
import { CoverageMeter } from '../../components/agent/CoverageMeter';
import { CvssBadge } from '../../components/agent/CvssBadge';
import { owaspCoverage } from '../../utils/owaspCoverage';
import './ReportReader.css';

function slugify(value) {
  return String(value || 'finding').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'finding';
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function FindingCard({ recordId, finding }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  const grab = async (kind, format, label) => {
    setBusy(label);
    setError('');
    try {
      const text = await downloadFindingPoc(recordId, finding.id, { kind, format });
      const ext = kind === 'repro' ? (format === 'python' ? 'py' : 'sh') : 'txt';
      downloadText(`poc-${slugify(finding.title || finding.id)}-${label}.${ext}`, text);
    } catch (err) {
      setError(err.message || 'Could not download the artifact.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="sg-finding-card">
      <div className="sg-finding-head">
        <strong>{finding.title || 'Untitled finding'}</strong>
        <CvssBadge finding={finding} />
      </div>
      {finding.cvss?.vector && <code className="sg-cvss-vector">{finding.cvss.vector}</code>}
      {finding.description && <p className="sg-body">{finding.description}</p>}
      <div className="sg-finding-actions">
        <button className="sg-btn sg-btn-ghost sg-btn-sm" disabled={busy} onClick={() => grab('poc', 'curl', 'poc')}>
          {busy === 'poc' ? <Loader2 size={13} className="sg-spin" /> : <FlaskConical size={13} />} PoC
        </button>
        <button className="sg-btn sg-btn-ghost sg-btn-sm" disabled={busy} onClick={() => grab('repro', 'curl', 'curl')}>
          {busy === 'curl' ? <Loader2 size={13} className="sg-spin" /> : <Download size={13} />} repro.sh
        </button>
        <button className="sg-btn sg-btn-ghost sg-btn-sm" disabled={busy} onClick={() => grab('repro', 'python', 'py')}>
          {busy === 'py' ? <Loader2 size={13} className="sg-spin" /> : <Download size={13} />} repro.py
        </button>
      </div>
      {error && <p className="sg-finding-error">{error}</p>}
      <p className="sg-poc-note">Proof-only artifacts — they demonstrate the flaw without exfiltration or state changes.</p>
    </div>
  );
}

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
        // The backend wraps the record as { huntRecord }; tolerate either shape.
        setRecord(rec?.huntRecord || rec?.record || rec);
        setMarkdown(typeof md === 'string' ? md : (md?.markdown || ''));
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load the report.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <div className="sg-loading-box"><Loader2 size={18} className="sg-spin" /> Loading report…</div>;

  if (error || !record) {
    return (
      <div className="sg-report-reader">
        <Link to="/agent/reports" className="sg-btn sg-btn-ghost sg-btn-sm"><ArrowLeft size={14} /> Past reports</Link>
        <div className="sg-page-error"><ShieldAlert size={18} /> {error || 'Report not found.'}</div>
      </div>
    );
  }

  const findings = Array.isArray(record.findings) ? record.findings : [];
  const coverage = owaspCoverage(findings);

  return (
    <div className="sg-report-reader">
      <Link to="/agent/reports" className="sg-btn sg-btn-ghost sg-btn-sm"><ArrowLeft size={14} /> Past reports</Link>

      <div className="sg-notice">
        <ShieldCheck size={16} />
        <span><strong>Report already exists for this target — showing the saved report</strong> (v{record.version || 1}). Pasting this target again returns this same report instantly. Start a new hunt from the Hunt page for a fresh run.</span>
      </div>

      <div className="sg-reader-top">
        <ReportExport huntId={record.jobId || record.id} recordId={record.id} markdown={markdown} />
      </div>

      <header className="sg-reader-head">
        <code>{record.target}</code>
        <div className="sg-reader-meta">
          <span className="sg-pill">v{record.version || 1}</span>
          {record.completedAt && <span>Hunted {new Date(record.completedAt).toLocaleString()}</span>}
          {record.severitySummary && (
            <span className="sg-row" style={{ gap: 8 }}>
              {Object.entries(record.severitySummary).map(([sev, count]) => (
                count > 0 && <span key={sev} className={`sg-pill ${sev === 'critical' ? 'sg-pill-danger' : sev === 'high' ? 'sg-pill-warn' : ''}`}>{sev} {count}</span>
              ))}
            </span>
          )}
        </div>
      </header>

      {findings.length > 0 && (
        <section className="sg-reader-section">
          <h2 className="sg-h2">Findings ({findings.length})</h2>
          <CoverageMeter coverage={coverage} />
          <div className="sg-finding-list">
            {findings.map((f) => (
              <FindingCard key={f.id || f.title} recordId={record.id} finding={f} />
            ))}
          </div>
        </section>
      )}

      {markdown ? (
        <article className="sg-markdown-body">
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
        <div className="sg-empty-state">
          <FileWarning size={28} />
          <p>No Markdown report was archived for this hunt — its findings summary above is the record.</p>
        </div>
      )}
    </div>
  );
}
