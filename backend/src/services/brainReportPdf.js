/**
 * brainReportPdf.js — professional PDF renderer for brain-written reports.
 *
 * The hacking brain writes the report section-by-section as semantic HTML
 * fragments (h2/h3/p/ul/ol/table/...). This renderer converts those fragments
 * into a submission-quality PDF via pdfkit: cover page, color-coded severity
 * badges, tables, code blocks, page numbers, and a clean professional layout
 * the owner can submit to a company directly.
 *
 * Why pdfkit (not puppeteer): zero browser download (~170MB saved), works
 * on the user's machine and small cloud instances alike, and we control the
 * HTML vocabulary so fidelity is exact.
 */

import PDFDocument from 'pdfkit';

// ── layout ───────────────────────────────────────────────────────────────
const PAGE_W = 595; // A4
const PAGE_H = 842;
const MARGIN = 56;
const CONTENT_W = PAGE_W - MARGIN * 2;

const COLORS = {
  bg: '#ffffff',
  ink: '#1a1d29',
  muted: '#5b6478',
  line: '#dfe3ee',
  accent: '#2f3bff',
  critical: '#d92638',
  high: '#e8762d',
  medium: '#c9a227',
  low: '#2e9e5b',
  informational: '#4a7ddb',
  codeBg: '#f2f4f9',
};

const FONTS = {
  regular: 'Helvetica',
  bold: 'Helvetica-Bold',
  italic: 'Helvetica-Oblique',
  boldItalic: 'Helvetica-BoldOblique',
  mono: 'Courier',
  monoBold: 'Courier-Bold',
};

// ── tiny HTML tokenizer (handles the semantic subset the brain emits) ────
const TAG_RE = /<\/?([a-z][a-z0-9]*)\b[^>]*>|([^<]+)/gi;

function decodeEntities(s) {
  return String(s)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/** Parse fragment HTML into a flat token stream: {type:'open'|'close'|'text', tag?, text?} */
export function tokenizeHtml(html) {
  const tokens = [];
  let m;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(String(html || ''))) !== null) {
    if (m[2] !== undefined) {
      const text = decodeEntities(m[2]).replace(/\s+/g, ' ');
      if (text.trim()) tokens.push({ type: 'text', text });
    } else {
      const full = m[0];
      const tag = m[1].toLowerCase();
      tokens.push({ type: full.startsWith('</') ? 'close' : 'open', tag });
    }
  }
  return tokens;
}

// ── renderer ─────────────────────────────────────────────────────────────
class ReportRenderer {
  constructor(doc) {
    this.doc = doc;
    this.y = MARGIN;
    this.listDepth = 0;
    this.inTable = null; // { rows: [ [cells] ], currentRow, currentCell }
    this.styleStack = []; // 'bold' | 'italic' | 'mono'
    this.pageNum = 1;
  }

  get font() {
    const s = new Set(this.styleStack);
    if (s.has('mono')) return s.has('bold') ? FONTS.monoBold : FONTS.mono;
    if (s.has('bold') && s.has('italic')) return FONTS.boldItalic;
    if (s.has('bold')) return FONTS.bold;
    if (s.has('italic')) return FONTS.italic;
    return FONTS.regular;
  }

  ensureSpace(needed) {
    if (this.y + needed > PAGE_H - MARGIN) this.newPage();
  }

  newPage() {
    this.doc.addPage();
    this.pageNum += 1;
    this.y = MARGIN;
    this.drawFooter();
  }

  drawFooter() {
    const d = this.doc;
    d.save();
    d.font(FONTS.regular).fontSize(8).fillColor(COLORS.muted);
    d.text(`Infinity AI — Security Assessment Report`, MARGIN, PAGE_H - 36, {
      width: CONTENT_W,
      align: 'left',
    });
    d.text(`Page ${this.pageNum}`, MARGIN, PAGE_H - 36, { width: CONTENT_W, align: 'right' });
    d.restore();
  }

  gap(px) {
    this.y += px;
    this.ensureSpace(20);
  }

  heading(text, level) {
    const size = level === 2 ? 17 : 14;
    this.ensureSpace(size + 26);
    this.gap(level === 2 ? 14 : 10);
    const d = this.doc;
    d.save();
    d.font(FONTS.bold).fontSize(size).fillColor(COLORS.ink);
    this.y = d.text(text.trim(), MARGIN, this.y, { width: CONTENT_W }).y;
    this.gap(4);
    if (level === 2) {
      d.strokeColor(COLORS.accent).lineWidth(2)
        .moveTo(MARGIN, this.y).lineTo(MARGIN + 44, this.y).stroke();
      this.gap(8);
    } else {
      this.gap(4);
    }
    d.restore();
  }

  paragraph(tokens) {
    // tokens: array of {text} / {style push/pop} already flattened — here we
    // receive a pre-built array of runs: [{text, font}]
    const d = this.doc;
    this.ensureSpace(30);
    const indent = this.listDepth > 0 ? this.listDepth * 14 : 0;
    d.save();
    let x = MARGIN + indent;
    const maxW = CONTENT_W - indent;
    let lineRuns = [];
    let lineW = 0;
    const flush = () => {
      if (!lineRuns.length) return;
      this.ensureSpace(16);
      let cx = x;
      for (const run of lineRuns) {
        d.font(run.font).fontSize(10.5).fillColor(COLORS.ink);
        d.text(run.text, cx, this.y, { continued: true });
        cx += d.widthOfString(run.text);
      }
      d.text('', x, this.y); // end continued chain
      this.y += 15;
      lineRuns = [];
      lineW = 0;
    };
    for (const run of tokens) {
      const words = run.text.split(/(\s+)/);
      for (const w of words) {
        if (!w) continue;
        d.font(run.font).fontSize(10.5);
        const ww = d.widthOfString(w);
        if (lineW + ww > maxW && lineRuns.length) flush();
        lineRuns.push({ text: w, font: run.font });
        lineW += ww;
      }
    }
    flush();
    this.gap(6);
    d.restore();
  }

  bulletItem(runs) {
    const d = this.doc;
    this.ensureSpace(24);
    const indent = this.listDepth * 14;
    d.save();
    d.font(FONTS.regular).fontSize(11).fillColor(COLORS.accent);
    d.text('•', MARGIN + indent, this.y);
    d.restore();
    // render runs as a paragraph offset to the right
    const savedDepth = this.listDepth;
    this.listDepth = 0;
    const savedY = this.y;
    // temporarily shift: render paragraph then restore y if it didn't advance enough
    this.paragraphShifted(runs, MARGIN + indent + 14, CONTENT_W - indent - 14);
    this.listDepth = savedDepth;
    void savedY;
  }

  paragraphShifted(runs, x, width) {
    const d = this.doc;
    this.ensureSpace(24);
    d.save();
    let lineRuns = [];
    let lineW = 0;
    const flush = () => {
      if (!lineRuns.length) return;
      this.ensureSpace(16);
      let cx = x;
      for (const run of lineRuns) {
        d.font(run.font).fontSize(10.5).fillColor(COLORS.ink);
        d.text(run.text, cx, this.y, { continued: true });
        cx += d.widthOfString(run.text);
      }
      d.text('', x, this.y);
      this.y += 15;
      lineRuns = [];
      lineW = 0;
    };
    for (const run of runs) {
      for (const w of run.text.split(/(\s+)/)) {
        if (!w) continue;
        d.font(run.font).fontSize(10.5);
        const ww = d.widthOfString(w);
        if (lineW + ww > width && lineRuns.length) flush();
        lineRuns.push({ text: w, font: run.font });
        lineW += ww;
      }
    }
    flush();
    this.gap(5);
    d.restore();
  }

  codeBlock(text) {
    const d = this.doc;
    const lines = String(text).split('\n');
    const lineH = 13;
    const boxH = lines.length * lineH + 14;
    this.ensureSpace(Math.min(boxH, 200));
    d.save();
    let yy = this.y;
    const drawBox = h => {
      d.rect(MARGIN, yy, CONTENT_W, h).fill(COLORS.codeBg);
      d.font(FONTS.mono).fontSize(9).fillColor(COLORS.ink);
    };
    if (yy + boxH > PAGE_H - MARGIN) {
      // split across pages: draw what fits
      const fits = Math.floor((PAGE_H - MARGIN - yy - 14) / lineH);
      drawBox(fits * lineH + 14);
      lines.slice(0, fits).forEach((ln, i) => d.text(ln, MARGIN + 8, yy + 7 + i * lineH));
      this.newPage();
      yy = this.y;
      const rest = lines.slice(fits);
      drawBox(rest.length * lineH + 14);
      rest.forEach((ln, i) => d.text(ln, MARGIN + 8, yy + 7 + i * lineH));
      this.y = yy + rest.length * lineH + 14;
    } else {
      drawBox(boxH);
      lines.forEach((ln, i) => d.text(ln.slice(0, 120), MARGIN + 8, yy + 7 + i * lineH));
      this.y = yy + boxH;
    }
    this.gap(8);
    d.restore();
  }

  // table handling: collect then render
  tableStart() {
    this.inTable = { rows: [], row: null, cellRuns: [] };
  }
  tableRowStart() {
    if (this.inTable) this.inTable.row = [];
  }
  tableCellStart() {
    if (this.inTable) this.inTable.cellRuns = [];
  }
  tableCellEnd() {
    if (this.inTable && this.inTable.row) {
      const text = this.inTable.cellRuns.map(r => r.text).join('').trim();
      this.inTable.row.push(text);
      this.inTable.cellRuns = [];
    }
  }
  tableRowEnd() {
    if (this.inTable && this.inTable.row) {
      this.inTable.rows.push(this.inTable.row);
      this.inTable.row = null;
    }
  }
  tableEnd(isHeader) {
    void isHeader;
    const t = this.inTable;
    this.inTable = null;
    if (!t || !t.rows.length) return;
    const d = this.doc;
    const cols = Math.max(...t.rows.map(r => r.length));
    const colW = CONTENT_W / cols;
    const headerRow = t.rows[0];
    const bodyRows = t.rows.slice(1);
    const renderRow = (cells, header) => {
      const cellH = 20;
      this.ensureSpace(cellH + 4);
      d.save();
      if (header) {
        d.rect(MARGIN, this.y, CONTENT_W, cellH).fill('#eef1f8');
      }
      cells.forEach((c, i) => {
        const sev = String(c).toLowerCase();
        const sevColor = COLORS[sev];
        d.font(header ? FONTS.bold : FONTS.regular).fontSize(9.5);
        if (!header && sevColor && i === 0) {
          // severity badge in first column
          const label = c.toUpperCase();
          const tw = d.widthOfString(label) + 12;
          d.rect(MARGIN + i * colW + 4, this.y + 4, tw, 12).fill(sevColor);
          d.fillColor('#ffffff').text(label, MARGIN + i * colW + 10, this.y + 5.5);
          d.fillColor(COLORS.ink);
        } else {
          d.fillColor(header ? COLORS.ink : COLORS.muted === undefined ? COLORS.ink : COLORS.ink);
          d.text(String(c).slice(0, 80), MARGIN + i * colW + 4, this.y + 5, {
            width: colW - 8,
          });
        }
      });
      d.strokeColor(COLORS.line).lineWidth(0.5)
        .moveTo(MARGIN, this.y + cellH).lineTo(MARGIN + CONTENT_W, this.y + cellH).stroke();
      this.y += cellH;
      d.restore();
    };
    this.gap(4);
    renderRow(headerRow, true);
    for (const r of bodyRows) renderRow(r, false);
    this.gap(8);
  }

  renderFragment(html) {
    const tokens = tokenizeHtml(html);
    let paraRuns = null; // accumulating runs for current <p>
    let headingBuf = null;
    let headingLevel = 0;
    let codeBuf = null;
    let inCodeBlock = false;
    let inLi = false;
    let liRuns = [];
    let tableHeaderDepth = 0;

    const pushRun = (text, arr) => {
      arr.push({ text, font: this.font });
    };

    for (const tok of tokens) {
      if (tok.type === 'text') {
        if (inCodeBlock) { codeBuf += tok.text + '\n'; continue; }
        if (headingBuf !== null) { headingBuf += tok.text; continue; }
        if (this.inTable) { pushRun(tok.text, this.inTable.cellRuns); continue; }
        if (inLi) { pushRun(tok.text, liRuns); continue; }
        if (!paraRuns) paraRuns = [];
        pushRun(tok.text, paraRuns);
        continue;
      }
      const { tag } = tok;
      const closing = tok.type === 'close';
      if (!closing) {
        switch (tag) {
          case 'h2': headingBuf = ''; headingLevel = 2; break;
          case 'h3': headingBuf = ''; headingLevel = 3; break;
          case 'p': if (!paraRuns) paraRuns = []; break;
          case 'strong': case 'b': this.styleStack.push('bold'); break;
          case 'em': case 'i': this.styleStack.push('italic'); break;
          case 'code':
            // inline code vs block: <pre> sets inCodeBlock
            if (!inCodeBlock) this.styleStack.push('mono');
            break;
          case 'pre': inCodeBlock = true; codeBuf = ''; break;
          case 'ul': case 'ol': this.listDepth += 1; break;
          case 'li': inLi = true; liRuns = []; break;
          case 'table': this.tableStart(); break;
          case 'thead': tableHeaderDepth += 1; break;
          case 'tr': this.tableRowStart(); break;
          case 'th': case 'td': this.tableCellStart(); break;
          case 'br': if (paraRuns) pushRun(' ', paraRuns); break;
          default: break;
        }
      } else {
        switch (tag) {
          case 'h2': case 'h3':
            if (headingBuf !== null) { this.heading(headingBuf, headingLevel); headingBuf = null; }
            break;
          case 'p':
            if (paraRuns && paraRuns.length) { this.paragraph(paraRuns); paraRuns = null; }
            break;
          case 'strong': case 'b': case 'em': case 'i': case 'code':
            this.styleStack.pop();
            break;
          case 'pre':
            inCodeBlock = false;
            if (codeBuf && codeBuf.trim()) this.codeBlock(codeBuf.trim());
            codeBuf = null;
            break;
          case 'ul': case 'ol': this.listDepth = Math.max(0, this.listDepth - 1); break;
          case 'li':
            inLi = false;
            if (liRuns.length) this.bulletItem(liRuns);
            liRuns = [];
            break;
          case 'table': this.tableEnd(tableHeaderDepth > 0); tableHeaderDepth = 0; break;
          case 'thead': tableHeaderDepth = Math.max(0, tableHeaderDepth - 1); break;
          case 'tr': this.tableRowEnd(); break;
          case 'th': case 'td': this.tableCellEnd(); break;
          default: break;
        }
      }
    }
    // flush leftovers
    if (paraRuns && paraRuns.length) this.paragraph(paraRuns);
    if (headingBuf !== null) this.heading(headingBuf, headingLevel);
    if (inCodeBlock && codeBuf && codeBuf.trim()) this.codeBlock(codeBuf.trim());
  }

  coverPage({ target, findings, generatedAt }) {
    const d = this.doc;
    this.y = 200;
    d.save();
    d.font(FONTS.bold).fontSize(30).fillColor(COLORS.ink);
    this.y = d.text('Security Assessment', MARGIN, this.y, { width: CONTENT_W }).y + 4;
    this.y = d.text('Report', MARGIN, this.y, { width: CONTENT_W }).y;
    d.strokeColor(COLORS.accent).lineWidth(3)
      .moveTo(MARGIN, this.y + 10).lineTo(MARGIN + 72, this.y + 10).stroke();
    this.y += 34;
    d.font(FONTS.regular).fontSize(13).fillColor(COLORS.muted);
    this.y = d.text(`Target: ${target || '—'}`, MARGIN, this.y, { width: CONTENT_W }).y + 6;
    this.y = d.text(`Findings: ${findings.length}`, MARGIN, this.y, { width: CONTENT_W }).y + 6;
    this.y = d.text(`Generated: ${generatedAt}`, MARGIN, this.y, { width: CONTENT_W }).y + 6;
    this.y = d.text('Prepared by Infinity AI — authorized testing only', MARGIN, this.y, {
      width: CONTENT_W,
    }).y;
    d.restore();
    this.newPage();
  }
}

/**
 * Render a brain-written report to PDF.
 * @param {object} args — { target, findings, fragments: [{title, html}], generatedAt }
 * @returns {Promise<Buffer>} PDF bytes.
 */
export async function renderBrainReportPdf({ target, findings = [], fragments = [], generatedAt = null }) {
  const doc = new PDFDocument({ size: 'A4', margin: 0, info: {
    Title: `Security Assessment Report — ${target || 'Target'}`,
    Author: 'Infinity AI',
  }});
  const chunks = [];
  doc.on('data', c => chunks.push(c));
  const done = new Promise((resolve, reject) => {
    doc.on('end', resolve);
    doc.on('error', reject);
  });

  const r = new ReportRenderer(doc);
  r.drawFooter();
  r.coverPage({ target, findings, generatedAt: generatedAt || new Date().toLocaleString() });

  // severity summary badges as a small table
  const counts = {};
  for (const f of findings) {
    const s = String(f.severity || 'informational').toLowerCase();
    counts[s] = (counts[s] || 0) + 1;
  }
  const order = ['critical', 'high', 'medium', 'low', 'informational'];
  r.heading('Summary', 2);
  r.renderFragment(
    `<table><tr><th>Severity</th><th>Count</th></tr>${order.map(s => `<tr><td>${s}</td><td>${counts[s] || 0}</td></tr>`).join('')}</table>`
  );

  for (const frag of fragments) {
    r.renderFragment(frag.html);
  }

  doc.end();
  await done;
  return Buffer.concat(chunks);
}
