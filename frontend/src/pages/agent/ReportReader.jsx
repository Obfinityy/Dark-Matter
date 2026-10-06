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

/**
 * Inline markdown formatting — **bold** and `code` only, rendered as
 * React text nodes so report content can never inject HTML.
 */
function Inline({ text }) {
  const parts = String(text).split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        if (part.length > 2 && part.startsWith('`') && part.endsWith('`')) {
          return <code key={i}>{part.slice(1, -1)}</code>;
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}

/**
 * Block-level Markdown rendering for archived reports: headings, ordered
 * and unordered lists, blockquotes, horizontal rules, fenced code blocks,
 * and paragraphs. No raw HTML is ever interpreted.
 */
function MarkdownBody({ markdown }) {
  const blocks = [];
  const lines = String(markdown).split('\n');
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block.
    if (line.startsWith('```')) {
      const buf = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) { buf.push(lines[i]); i++; }
      i++; // consume the closing fence (or EOF)
      blocks.push(<pre key={key++}><code>{buf.join('\n')}</code></pre>);
      continue;
    }

    // ATX headings.
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const Tag = `h${level}`;
      blocks.push(<Tag key={key++}><Inline text={heading[2]} /></Tag>);
      i++;
      continue;
    }

    // List groups — consecutive items share one <ul> or <ol>.
    const firstItem = line.match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
    if (firstItem) {
      const ordered = /^\d/.test(firstItem[1]);
      const items = [];
      while (i < lines.length) {
        const m = lines[i].match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
        if (!m || (/^\d/.test(m[1]) !== ordered)) break;
        items.push(m[2]);
        i++;
      }
      const ListTag = ordered ? 'ol' : 'ul';
      blocks.push(
        <ListTag key={key++}>
          {items.map((item, j) => <li key={j}><Inline text={item} /></li>)}
        </ListTag>
      );
      continue;
    }

    // Blockquote.
    if (line.startsWith('> ')) {
      blocks.push(<blockquote key={key++}><Inline text={line.slice(2)} /></blockquote>);
      i++;
      continue;
    }

    // Horizontal rule.
    if (/^---+$/.test(line.trim())) {
      blocks.push(<hr key={key++} />);
      i++;
      continue;
    }

    // Blank line — skip (paragraph spacing comes from CSS).
    if (line.trim() === '') { i++; continue; }

    // Paragraph — gather until a blank line or another block starts.
    const para = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].startsWith('```') &&
      !/^(#{1,3})\s+/.test(lines[i]) &&
      !/^\s*([-*+]|\d+[.)])\s+/.test(lines[i]) &&
      !lines[i].startsWith('> ') &&
      !/^---+$/.test(lines[i].trim())
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(<p key={key++}><Inline text={para.join(' ')} /></p>);
  }

  return <article className="sg-markdown-body">{blocks}</article>;
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
          {busy === 'poc' ? <Loader2 size={13} className="sg-spin" aria-hidden="true" /> : <FlaskConical size={13} aria-hidden="true" />} PoC
        </button>
        <button className="sg-btn sg-btn-ghost sg-btn-sm" disabled={busy} onClick={() => grab('repro', 'curl', 'curl')}>
          {busy === 'curl' ? <Loader2 size={13} className="sg-spin" aria-hidden="true" /> : <Download size={13} aria-hidden="true" />} repro.sh
        </button>
        <button className="sg-btn sg-btn-ghost sg-btn-sm" disabled={busy} onClick={() => grab('repro', 'python', 'py')}>
          {busy === 'py' ? <Loader2 size={13} className="sg-spin" aria-hidden="true" /> : <Download size={13} aria-hidden="true" />} repro.py
        </button>
      </div>
      {error && <p className="sg-finding-error" role="alert">{error}</p>}
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

  if (loading) return <div className="sg-loading-box" role="status"><Loader2 size={18} className="sg-spin" aria-hidden="true" /> Loading report…</div>;

  if (error || !record) {
    return (
      <div className="sg-report-reader">
        <Link to="/agent/reports" className="sg-btn sg-btn-ghost sg-btn-sm"><ArrowLeft size={14} aria-hidden="true" /> Past reports</Link>
        <div className="sg-page-error" role="alert">
          <ShieldAlert size={18} aria-hidden="true" />
          <h2>Couldn't load this report</h2>
          <p>{error || 'Report not found.'}</p>
        </div>
      </div>
    );
  }

  const findings = Array.isArray(record.findings) ? record.findings : [];
  const coverage = owaspCoverage(findings);

  return (
    <div className="sg-report-reader">
      <Link to="/agent/reports" className="sg-btn sg-btn-ghost sg-btn-sm"><ArrowLeft size={14} aria-hidden="true" /> Past reports</Link>

      <div className="sg-notice">
        <ShieldCheck size={16} aria-hidden="true" />
        <span><strong>Report already exists for this target — showing the saved report</strong> (v{record.version || 1}). Pasting this target again returns this same report instantly. Start a new hunt from the Hunt page for a fresh run.</span>
      </div>

      <div className="sg-reader-top">
        <ReportExport huntId={record.jobId || record.id} recordId={record.id} markdown={markdown} />
      </div>

      <header className="sg-reader-head">
        <h1>{record.target}</h1>
        <div className="sg-reader-meta">
          <span className="sg-pill">v{record.version || 1}</span>
          {record.completedAt && <span>Hunted {new Date(record.completedAt).toLocaleString()}</span>}
          {record.severitySummary && (
            <span className="sg-reader-sevs">
              {Object.entries(record.severitySummary).map(([sev, count]) => (
                count > 0 && <span key={sev} className={`sg-pill ${sev === 'critical' ? 'sg-pill-danger' : sev === 'high' ? 'sg-pill-warn' : ''}`}>{sev} {count}</span>
              ))}
            </span>
          )}
        </div>
      </header>

      {findings.length > 0 && (
        <section className="sg-reader-section" aria-labelledby="sg-findings-heading">
          <h2 className="sg-h2" id="sg-findings-heading">Findings ({findings.length})</h2>
          <CoverageMeter coverage={coverage} />
          <div className="sg-finding-list">
            {findings.map((f) => (
              <FindingCard key={f.id || f.title} recordId={record.id} finding={f} />
            ))}
          </div>
        </section>
      )}

      {markdown ? (
        <MarkdownBody markdown={markdown} />
      ) : (
        <div className="sg-empty-state" role="status">
          <FileWarning size={28} aria-hidden="true" />
          <p>No Markdown report was archived for this hunt — its findings summary above is the record.</p>
        </div>
      )}
    </div>
  );
}
