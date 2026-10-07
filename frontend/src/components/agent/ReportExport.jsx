/**
 * ReportExport — one-click report export.
 *
 * Two formats, both submission-quality:
 *   - Markdown: downloads the archived report .md (from /hunt-records/:id/report.md
 *     when the hunt completed, otherwise renders the live vulnerability report).
 *   - PDF: one-click server-rendered PDF (GET /jobs/:id/report.pdf), plus the
 *     legacy print-to-PDF fallback that opens a print-optimized view.
 *
 * Props:
 *   jobId, recordId (hunt record when the hunt completed), target (for filenames)
 */
import React, { useState } from 'react';
import { Download, FileText, Printer, Loader2 } from 'lucide-react';
import { downloadHuntRecordMarkdown, downloadJobReportPdf, getJobVulnerabilityReport } from '../../services/api';
import './ReportExport.polish.css';

function slugify(value) {
  return String(value || 'report').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'report';
}

export function ReportExport({ jobId, recordId = null, target = '' }) {
  const [busy, setBusy] = useState(null);

  const getMarkdown = async () => {
    if (recordId) return downloadHuntRecordMarkdown(recordId);
    const body = await getJobVulnerabilityReport(jobId);
    // The live report object may carry markdown already; otherwise the hunt
    // hasn't completed and there is nothing submission-quality to export.
    if (body?.report?.markdown) return body.report.markdown;
    throw new Error('The final report is generated when the hunt completes.');
  };

  const downloadMd = async () => {
    setBusy('md');
    try {
      const md = await getMarkdown();
      const blob = new Blob([md], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `darkmatter-${slugify(target)}-report.md`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || 'Could not export the report.');
    } finally {
      setBusy(null);
    }
  };

  const downloadPdf = async () => {
    setBusy('pdf-server');
    try {
      const blob = await downloadJobReportPdf(jobId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `infinity-ai-${slugify(target)}-report.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || 'Could not download the PDF report.');
    } finally {
      setBusy(null);
    }
  };

  const printPdf = async () => {
    setBusy('pdf');
    try {
      const md = await getMarkdown();
      // Print-optimized window: clean typography, no app chrome.
      const win = window.open('', '_blank', 'width=900,height=700');
      if (!win) throw new Error('Popup blocked — allow popups to export PDF.');
      win.document.write(`<!DOCTYPE html><html><head><title>Dark Matter Report — ${target}</title>
<style>
body{font-family:Georgia,serif;max-width:760px;margin:40px auto;padding:0 24px;color:#111;line-height:1.6}
h1{border-bottom:2px solid #111;padding-bottom:8px}h2{margin-top:32px;color:#1a1a1a}
code{background:#f4f4f4;padding:2px 5px;border-radius:3px;font-size:.9em}
pre{background:#f4f4f4;padding:12px;border-radius:6px;overflow:auto}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:8px;text-align:left}th{background:#f0f0f0}
@media print{body{margin:0}}
</style></head><body>`);
      // Minimal markdown → HTML (headings, bold, code, tables, lists).
      const html = md
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/^### (.*)$/gm, '<h3>$1</h3>')
        .replace(/^## (.*)$/gm, '<h2>$1</h2>')
        .replace(/^# (.*)$/gm, '<h1>$1</h1>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/^\|(.+)$/gm, (row) => {
          const cells = row.slice(1).split('|').map((c) => c.trim());
          if (/^---/.test(cells[0])) return '';
          return `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`;
        })
        .replace(/\n\n/g, '</p><p>')
        .replace(/^(?!<[h|t|p])/gm, '');
      win.document.write(`<p>${html}</p></body></html>`);
      win.document.close();
      win.focus();
      setTimeout(() => { win.print(); }, 400);
    } catch (err) {
      alert(err.message || 'Could not export the report.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="dm-report-export" role="group" aria-label="Export report">
      <button type="button" className="dm-btn-primary" onClick={downloadMd}
        disabled={Boolean(busy)} aria-busy={busy === 'md'}>
        {busy === 'md' ? <Loader2 size={15} className="dm-spin" aria-hidden="true" /> : <FileText size={15} aria-hidden="true" />}
        Markdown
      </button>
      <button type="button" className="dm-btn-secondary" onClick={downloadPdf}
        disabled={Boolean(busy)} aria-busy={busy === 'pdf-server'}>
        {busy === 'pdf-server' ? <Loader2 size={15} className="dm-spin" aria-hidden="true" /> : <FileText size={15} aria-hidden="true" />}
        PDF
      </button>
      <button type="button" className="dm-btn-secondary" onClick={printPdf}
        disabled={Boolean(busy)} aria-busy={busy === 'pdf'}>
        {busy === 'pdf' ? <Loader2 size={15} className="dm-spin" aria-hidden="true" /> : <Printer size={15} aria-hidden="true" />}
        PDF <span className="dm-btn-hint">(print)</span>
      </button>
      <span className="dm-export-note"><Download size={12} aria-hidden="true" /> HackerOne / Bugcrowd-ready format</span>
    </div>
  );
}
