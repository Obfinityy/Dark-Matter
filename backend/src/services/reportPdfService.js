/**
 * reportPdfService — render a hunt/assessment report as a styled PDF.
 *
 * Uses pdfkit (pure JS, no native deps). Takes the report object produced by
 * reportService (executiveSummary, scope, findingsSummary, detailedFindings)
 * and streams a professional single-document PDF back to the caller.
 */
import PDFDocument from 'pdfkit';

const COLORS = {
  ink: '#111827',
  muted: '#6b7280',
  accent: '#7c3aed',
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#d97706',
  low: '#16a34a',
  info: '#6b7280',
  rule: '#e5e7eb',
};

function severityColor(sev) {
  return COLORS[String(sev || '').toLowerCase()] || COLORS.info;
}

function header(doc, text, size = 18) {
  doc.fillColor(COLORS.ink).font('Helvetica-Bold').fontSize(size).text(text);
  doc.moveDown(0.4);
}

function paragraph(doc, text, opts = {}) {
  doc.fillColor(opts.color || COLORS.ink).font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(opts.size || 10);
  doc.text(String(text ?? ''), { width: 470, ...opts.textOpts });
  doc.moveDown(opts.gap ?? 0.5);
}

function rule(doc) {
  doc.moveDown(0.4);
  doc.strokeColor(COLORS.rule).lineWidth(1)
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .stroke();
  doc.moveDown(0.6);
}

function checkPage(doc, needed = 120) {
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom) doc.addPage();
}

/**
 * Stream a PDF of the report into a writable stream (e.g. express response).
 * @param {object} report — reportService report object
 * @param {NodeJS.WritableStream} out
 */
export function streamReportPdf(report, out) {
  const doc = new PDFDocument({ margin: 60, size: 'A4', info: { Title: 'Infinity AI — Security Assessment Report' } });
  doc.pipe(out);

  // ── Cover header ──
  doc.fillColor(COLORS.accent).font('Helvetica-Bold').fontSize(11).text('INFINITY AI', { align: 'left' });
  doc.fillColor(COLORS.muted).font('Helvetica').fontSize(9).text('Autonomous Security Assessment', { align: 'left' });
  doc.moveDown(1.2);
  header(doc, 'Security Assessment Report', 24);
  if (report?.target) paragraph(doc, `Target: ${report.target}`, { size: 11, color: COLORS.muted });
  if (report?.createdAt) paragraph(doc, `Generated: ${new Date(report.createdAt).toLocaleString()}`, { size: 9, color: COLORS.muted });
  if (report?.version) paragraph(doc, `Report version: ${report.version}`, { size: 9, color: COLORS.muted });
  rule(doc);

  // ── Executive summary ──
  header(doc, 'Executive Summary', 15);
  paragraph(doc, report?.executiveSummary || 'No summary available.');
  rule(doc);

  // ── Scope ──
  if (report?.scope) {
    header(doc, 'Scope', 15);
    const s = report.scope;
    if (typeof s === 'string') paragraph(doc, s);
    else {
      if (s.targets?.length) paragraph(doc, `Targets: ${s.targets.join(', ')}`);
      if (s.excluded?.length) paragraph(doc, `Out of scope: ${s.excluded.join(', ')}`);
      if (s.timeframe) paragraph(doc, `Timeframe: ${s.timeframe}`);
    }
    rule(doc);
  }

  // ── Findings summary ──
  const summary = report?.findingsSummary || {};
  header(doc, 'Findings Summary', 15);
  const counts = ['critical', 'high', 'medium', 'low', 'informational']
    .map((sev) => `${sev}: ${summary[sev] ?? 0}`)
    .join('   ·   ');
  paragraph(doc, counts, { size: 10, color: COLORS.muted });
  rule(doc);

  // ── Detailed findings ──
  header(doc, 'Detailed Findings', 15);
  const findings = report?.detailedFindings || [];
  if (!findings.length) {
    paragraph(doc, 'No validated findings. The assessment completed without confirming any vulnerability.', { color: COLORS.muted });
  }
  findings.forEach((f, i) => {
    checkPage(doc, 150);
    doc.fillColor(severityColor(f.severity)).font('Helvetica-Bold').fontSize(12)
      .text(`${i + 1}. [${String(f.severity || 'n/a').toUpperCase()}] ${f.title || 'Untitled finding'}`);
    doc.moveDown(0.3);
    if (f.confidence != null) paragraph(doc, `Confidence: ${Math.round(Number(f.confidence) * 100)}%`, { size: 9, color: COLORS.muted, gap: 0.2 });
    if (f.affectedEndpoint) paragraph(doc, `Endpoint: ${f.affectedEndpoint}`, { size: 9, color: COLORS.muted, gap: 0.2 });
    if (f.parameter) paragraph(doc, `Parameter: ${f.parameter}`, { size: 9, color: COLORS.muted, gap: 0.4 });
    if (f.description) paragraph(doc, f.description);
    if (f.impact) paragraph(doc, `Impact: ${f.impact}`);
    if (f.reproductionSteps?.length) {
      paragraph(doc, 'Reproduction:', { bold: true, size: 10, gap: 0.2 });
      f.reproductionSteps.forEach((step, n) => paragraph(doc, `${n + 1}. ${step}`, { size: 9, gap: 0.15 }));
    }
    if (f.remediation) paragraph(doc, `Remediation: ${f.remediation}`);
    if (f.poc && (f.poc.curl || f.poc.python)) {
      paragraph(doc, 'Proof of Concept:', { bold: true, size: 10, gap: 0.2 });
      if (f.poc.curl) {
        doc.fillColor(COLORS.muted).font('Courier').fontSize(8)
          .text(String(f.poc.curl).slice(0, 600), { width: 470 });
        doc.moveDown(0.3);
      }
      if (f.poc.steps?.length) {
        f.poc.steps.slice(0, 4).forEach((step) => paragraph(doc, `${step}`, { size: 8, gap: 0.1 }));
      }
    }
    if (f.evidenceAttached === false) {
      paragraph(doc, 'Note: validated via live probing; raw evidence capture pending.', { size: 8, color: COLORS.muted });
    }
    if (i < findings.length - 1) rule(doc);
  });

  // ── Footer ──
  doc.moveDown(1);
  rule(doc);
  paragraph(doc, 'Generated autonomously by Infinity AI. Findings were validated against the target at assessment time; re-test before acting on them.', { size: 8, color: COLORS.muted });

  doc.end();
  return doc;
}
