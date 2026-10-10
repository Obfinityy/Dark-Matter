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
import {
  ArrowLeft,
  Loader2,
  FileWarning,
  ShieldAlert,
  Download,
  ShieldCheck,
  FlaskConical,
} from 'lucide-react';
import { getHuntRecord, downloadHuntRecordMarkdown, downloadFindingPoc } from '../../services/api';
import { ReportExport } from '../../components/agent/ReportExport';
import { CoverageMeter } from '../../components/agent/CoverageMeter';
import { CvssBadge } from '../../components/agent/CvssBadge';
import { owaspCoverage } from '../../utils/owaspCoverage';
import '../../styles/kinetic-data.css';
import './ReportReader.css';

const SEV_BADGE = {
  critical: 'dm-badge dm-badge-red',
  high: 'dm-badge dm-badge-gold',
  medium: 'dm-badge',
  low: 'dm-badge',
  informational: 'dm-badge',
};

function slugify(value) {
  return (
    String(value || 'finding')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'finding'
  );
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
      while (i < lines.length && !lines[i].startsWith('```')) {
        buf.push(lines[i]);
        i++;
      }
      i++; // consume the closing fence (or EOF)
      blocks.push(
        <pre key={key++}>
          <code>{buf.join('\n')}</code>
        </pre>
      );
      continue;
    }

    // ATX headings.
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      const Tag = `h${level}`;
      blocks.push(
        <Tag key={key++}>
          <Inline text={heading[2]} />
        </Tag>
      );
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
        if (!m || /^\d/.test(m[1]) !== ordered) break;
        items.push(m[2]);
        i++;
      }
      const ListTag = ordered ? 'ol' : 'ul';
      blocks.push(
        <ListTag key={key++}>
          {items.map((item, j) => (
            <li key={j}>
              <Inline text={item} />
            </li>
          ))}
        </ListTag>
      );
      continue;
    }

    // Blockquote.
    if (line.startsWith('> ')) {
      blocks.push(
        <blockquote key={key++}>
          <Inline text={line.slice(2)} />
        </blockquote>
      );
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
    if (line.trim() === '') {
      i++;
      continue;
    }

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
    blocks.push(
      <p key={key++}>
        <Inline text={para.join(' ')} />
      </p>
    );
  }

  return <article className="dm-markdown-body kda-prose">{blocks}</article>;
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
    <div className="dm-card dm-finding-card kda-card">
      <div className="dm-finding-head">
        <strong className="dm-finding-title kda-card-title">{finding.title || 'Untitled finding'}</strong>
        <CvssBadge finding={finding} />
      </div>
      {finding.cvss?.vector && <code className="dm-finding-vector">{finding.cvss.vector}</code>}
      {finding.description && <p className="dm-card-sub dm-finding-desc">{finding.description}</p>}
      <div className="dm-finding-actions">
        <button
          className="dm-btn dm-btn-ghost dm-btn-sm"
          disabled={busy}
          onClick={() => grab('poc', 'curl', 'poc')}
        >
          {busy === 'poc' ? (
            <Loader2 size={13} className="sg-spin" aria-hidden="true" />
          ) : (
            <FlaskConical size={13} aria-hidden="true" />
          )}{' '}
          PoC
        </button>
        <button
          className="dm-btn dm-btn-ghost dm-btn-sm"
          disabled={busy}
          onClick={() => grab('repro', 'curl', 'curl')}
        >
          {busy === 'curl' ? (
            <Loader2 size={13} className="sg-spin" aria-hidden="true" />
          ) : (
            <Download size={13} aria-hidden="true" />
          )}{' '}
          repro.sh
        </button>
        <button
          className="dm-btn dm-btn-ghost dm-btn-sm"
          disabled={busy}
          onClick={() => grab('repro', 'python', 'py')}
        >
          {busy === 'py' ? (
            <Loader2 size={13} className="sg-spin" aria-hidden="true" />
          ) : (
            <Download size={13} aria-hidden="true" />
          )}{' '}
          repro.py
        </button>
      </div>
      {error && (
        <p className="dm-finding-error" role="alert">
          {error}
        </p>
      )}
      <p className="dm-hint dm-finding-note">
        Proof-only artifacts — they demonstrate the flaw without exfiltration or state changes.
      </p>
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
          downloadHuntRecordMarkdown(id).catch(() => null),
        ]);
        if (cancelled) return;
        // The backend wraps the record as { huntRecord }; tolerate either shape.
        setRecord(rec?.huntRecord || rec?.record || rec);
        setMarkdown(typeof md === 'string' ? md : md?.markdown || '');
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load the report.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="dm-container kda-page">
        <div className="dm-reader-loading" role="status" aria-live="polite">
          <Loader2 size={18} aria-hidden="true" className="sg-spin" /> Loading report…
        </div>
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="dm-container dm-reader kda-page">
        <Link to="/agent/reports" className="dm-btn dm-btn-ghost dm-btn-sm dm-reader-back">
          <ArrowLeft size={14} aria-hidden="true" /> Past reports
        </Link>
        <div className="dm-empty dm-reader-error" role="alert">
          <div className="dm-empty-icon-lucide">
            <ShieldAlert size={24} aria-hidden="true" />
          </div>
          <h2 className="dm-empty-title">Couldn't load this report</h2>
          <p className="dm-empty-sub">{error || 'Report not found.'}</p>
          <Link to="/agent/reports" className="dm-btn dm-btn-secondary">
            Back to past reports
          </Link>
        </div>
      </div>
    );
  }

  const findings = Array.isArray(record.findings) ? record.findings : [];
  const coverage = owaspCoverage(findings);
  const titleWords = String(record.target || 'Report').split(' ');

  return (
    <div className="dm-container dm-reader kda-page">
      <Link to="/agent/reports" className="dm-btn dm-btn-ghost dm-btn-sm dm-reader-back">
        <ArrowLeft size={14} aria-hidden="true" /> Past reports
      </Link>

      <div className="dm-notice dm-notice-gold dm-reader-notice">
        <ShieldCheck size={16} className="dm-notice-icon" aria-hidden="true" />
        <span>
          <strong style={{ color: 'var(--dm-text)' }}>
            Report already exists for this target — showing the saved report
          </strong>{' '}
          (v{record.version || 1}). Pasting this target again returns this same report instantly.
          Start a new hunt from the Hunt AI page for a fresh run.
        </span>
      </div>

      <div className="dm-reader-top">
        <ReportExport
          jobId={record.jobId || record.id}
          recordId={record.id}
          target={record.target || ''}
        />
      </div>

      <header className="dm-page-head dm-reader-head kda-head">
        <h1 className="dm-reader-title kda-title">
          {titleWords.map((w, i) => (
            <React.Fragment key={i}>
              {i > 0 && ' '}
              <span className="kda-w" style={{ '--kda-d': `${i * 90}ms` }}>
                {w}
              </span>
            </React.Fragment>
          ))}
        </h1>
        <div className="dm-reader-meta">
          <span className="dm-badge">v{record.version || 1}</span>
          {record.completedAt && (
            <time dateTime={record.completedAt} className="dm-muted">
              Hunted {new Date(record.completedAt).toLocaleString()}
            </time>
          )}
          {record.severitySummary && (
            <span className="dm-reader-sevs">
              {Object.entries(record.severitySummary).map(
                ([sev, count]) =>
                  count > 0 && (
                    <span key={sev} className={SEV_BADGE[String(sev).toLowerCase()] || 'dm-badge'}>
                      {sev} {count}
                    </span>
                  )
              )}
            </span>
          )}
        </div>
      </header>

      {findings.length > 0 && (
        <section className="dm-section dm-reader-section" aria-labelledby="dm-findings-heading">
          <div className="dm-section-head">
            <h2 className="dm-section-title kda-sec-title" id="dm-findings-heading">
              Findings ({findings.length})
            </h2>
          </div>
          <CoverageMeter coverage={coverage} />
          <div className="dm-reader-findings">
            {findings.map(f => (
              <FindingCard key={f.id || f.title} recordId={record.id} finding={f} />
            ))}
          </div>
        </section>
      )}

      {markdown ? (
        <MarkdownBody markdown={markdown} />
      ) : (
        <div className="dm-empty dm-reader-no-markdown" role="status">
          <div className="dm-empty-icon-lucide">
            <FileWarning size={24} aria-hidden="true" />
          </div>
          <p className="dm-empty-sub">
            No Markdown report was archived for this hunt — its findings summary above is the
            record.
          </p>
        </div>
      )}
    </div>
  );
}
