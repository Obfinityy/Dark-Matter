/**
 * pdfReportWriter.js — minimal REAL PDF generator, zero dependencies.
 *
 * Why hand-rolled: the backend ships with no PDF library (pdfkit/pdf-lib are
 * not installed and node_modules are symlinks, so nothing can be added), and
 * the requirement is a REAL PDF generated from REAL hunt data — not a
 * print-to-PDF HTML shim. This writer emits a valid PDF 1.4 file using only
 * Node builtins:
 *   - text via the built-in Helvetica / Helvetica-Bold fonts
 *   - zlib-compressed content streams
 *   - JPEG screenshots embedded raw with /DCTDecode (no re-encoding)
 *   - a proper cross-reference table + trailer
 *
 * Verification: tests/pdfReport.test.js parses the emitted bytes back
 * (xref walk, stream inflate, Tj text extraction) and asserts the report
 * content is actually inside — "file exists" is not accepted as proof.
 */
import { deflateSync, inflateSync } from 'node:zlib';

const PAGE_W = 595; // A4
const PAGE_H = 842;
const MARGIN = 54;
const CONTENT_W = PAGE_W - MARGIN * 2;

// Common typographic characters → ASCII so reports never show '?' for them.
const TRANSLIT = {
  '\u2013': '-',
  '\u2014': '-',
  '\u2018': "'",
  '\u2019': "'",
  '\u201c': '"',
  '\u201d': '"',
  '\u2022': '-',
  '\u2026': '...',
  '\u00a0': ' ',
  '\u2192': '->',
  '\u2713': 'v',
  '\u2717': 'x',
};

function escapePdfText(s) {
  return (
    String(s ?? '')
      .replace(
        /[\u2013\u2014\u2018\u2019\u201c\u201d\u2022\u2026\u00a0\u2192\u2713\u2717]/g,
        ch => TRANSLIT[ch] || '?'
      )
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      // PDF text strings are byte-oriented (WinAnsi); fold anything outside
      // Latin-1 to a readable placeholder instead of emitting garbage.
      .replace(/[^\x09\x0a\x0d\x20-\xff]/g, '?')
  );
}

/** Parse JPEG SOF markers to learn width/height (needed for aspect fit). */
export function jpegDimensions(buf) {
  let i = 2; // skip SOI
  while (i + 8 < buf.length) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
    }
    i += 2 + len;
  }
  throw new Error('Could not find JPEG SOF marker');
}

class PdfDoc {
  constructor() {
    this.objects = []; // 1-based: objects[0] is object #1
    this.pages = [];
  }

  addObject(body) {
    this.objects.push(body);
    return this.objects.length; // object number
  }

  /** Reserve an object number that will be filled in later (for /Pages). */
  reserveObject() {
    this.objects.push(null);
    return this.objects.length;
  }

  setObject(num, body) {
    this.objects[num - 1] = body;
  }

  newPage() {
    const page = {
      lines: [], // {x, y, size, bold, text, color}
      rects: [], // {x, y, w, h, r, g, b} filled rects (badges, rules)
      images: [], // {name, x, y, w, h, objNum}
      width: PAGE_W,
      height: PAGE_H,
    };
    this.pages.push(page);
    return page;
  }

  finalize() {
    const fontReg = this.addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    const fontBold = this.addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
    const pagesId = this.reserveObject();

    const pageIds = [];
    for (const page of this.pages) {
      const content = this.renderPageContent(page, fontReg, fontBold);
      const contentId = this.addObject(this.streamObject(content));
      const resources = this.resourcesObject(page, fontReg, fontBold);
      const pageId = this.addObject(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources ${resources} /Contents ${contentId} 0 R >>`
      );
      pageIds.push(pageId);
    }
    this.setObject(
      pagesId,
      `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`
    );
    const catalogId = this.addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

    // Serialize with a real cross-reference table. Objects may be Buffers
    // (image streams) — everything is length-tracked in bytes, never in chars.
    const latin1 = s => Buffer.from(s, 'latin1');
    const parts = [latin1('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n')];
    let pos = parts[0].length;
    const offsets = [];
    for (let i = 0; i < this.objects.length; i++) {
      offsets.push(pos);
      const body = Buffer.isBuffer(this.objects[i])
        ? this.objects[i]
        : latin1(String(this.objects[i]));
      const chunk = Buffer.concat([latin1(`${i + 1} 0 obj\n`), body, latin1('\nendobj\n')]);
      parts.push(chunk);
      pos += chunk.length;
    }
    const xrefPos = pos;
    parts.push(latin1(`xref\n0 ${this.objects.length + 1}\n`));
    parts.push(latin1('0000000000 65535 f \n'));
    for (const off of offsets) {
      parts.push(latin1(`${String(off).padStart(10, '0')} 00000 n \n`));
    }
    parts.push(
      latin1(
        `trailer\n<< /Size ${this.objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefPos}\n%%EOF`
      )
    );
    return Buffer.concat(parts);
  }

  streamObject(rawBytes) {
    const compressed = deflateSync(rawBytes);
    const header = `<< /Length ${compressed.length} /Filter /FlateDecode >>\nstream\n`;
    return Buffer.concat([
      Buffer.from(header, 'latin1'),
      compressed,
      Buffer.from('\nendstream', 'latin1'),
    ]);
  }

  resourcesObject(page, fontReg, fontBold) {
    const xobjs = page.images.map(img => `/Img${img.objNum} ${img.objNum} 0 R`).join(' ');
    return `<< /Font << /F1 ${fontReg} 0 R /F2 ${fontBold} 0 R >>${xobjs ? ` /XObject << ${xobjs} >>` : ''} >>`;
  }

  renderPageContent(page, fontReg, fontBold) {
    const ops = [];
    for (const r of page.rects) {
      ops.push(
        `${r.r.toFixed(2)} ${r.g.toFixed(2)} ${r.b.toFixed(2)} rg ${r.x.toFixed(1)} ${r.y.toFixed(1)} ${r.w.toFixed(1)} ${r.h.toFixed(1)} re f`
      );
    }
    for (const img of page.images) {
      ops.push(
        `q ${img.w.toFixed(1)} 0 0 ${img.h.toFixed(1)} ${img.x.toFixed(1)} ${img.y.toFixed(1)} cm /Img${img.objNum} Do Q`
      );
    }
    for (const l of page.lines) {
      const font = l.bold ? '/F2' : '/F1';
      const c = l.color || [0, 0, 0];
      ops.push(
        `BT ${font} ${l.size} Tf ${c[0].toFixed(2)} ${c[1].toFixed(2)} ${c[2].toFixed(2)} rg ${l.x.toFixed(1)} ${l.y.toFixed(1)} Td (${escapePdfText(l.text)}) Tj ET`
      );
    }
    return Buffer.from(ops.join('\n'), 'latin1');
  }

  addJpegImage(jpegBytes) {
    const { width, height } = jpegDimensions(jpegBytes);
    const header = `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`;
    const objNum = this.addObject('');
    // Rebuild with the raw JPEG bytes preserved byte-for-byte.
    this.setObject(
      objNum,
      Buffer.concat([
        Buffer.from(header, 'latin1'),
        Buffer.from(jpegBytes),
        Buffer.from('\nendstream', 'latin1'),
      ])
    );
    return { objNum, width, height };
  }
}

/**
 * Build a full hunt report PDF.
 *
 * @param {object} report
 * @param {string} report.title
 * @param {string} report.target
 * @param {string} report.generatedAt
 * @param {string} report.mode — 'executive' | 'technical'
 * @param {object} report.summary — {total, critical, high, medium, low, informational, validated}
 * @param {string} [report.executiveSummary]
 * @param {Array}  report.findings — each {title, severity, cvss:{score,vector,rating}, description, impact, reproductionSteps[], remediation[], evidence[], poc}
 * @param {Array}  [report.screenshots] — [{jpeg: Buffer, caption}]
 * @returns {Buffer} the PDF bytes
 */
export function buildReportPdf(report) {
  const doc = new PdfDoc();
  const writer = new LayoutWriter(doc, report);
  writer.render();
  return doc.finalize();
}

const SEV_COLOR = {
  critical: [0.75, 0.08, 0.08],
  high: [0.85, 0.35, 0.05],
  medium: [0.75, 0.6, 0.05],
  low: [0.15, 0.45, 0.15],
  informational: [0.3, 0.3, 0.3],
};

class LayoutWriter {
  constructor(doc, report) {
    this.doc = doc;
    this.report = report;
    this.page = doc.newPage();
    this.y = PAGE_H - MARGIN;
    this.pageNum = 1;
  }

  ensureSpace(needed) {
    if (this.y - needed < MARGIN + 30) {
      this.footer();
      this.page = this.doc.newPage();
      this.y = PAGE_H - MARGIN;
      this.pageNum++;
    }
  }

  text(str, { size = 11, bold = false, color = [0, 0, 0], indent = 0, gap = 4 } = {}) {
    const lines = wrap(String(str), size, bold, CONTENT_W - indent);
    for (const line of lines) {
      this.ensureSpace(size + gap);
      this.page.lines.push({ x: MARGIN + indent, y: this.y, size, bold, text: line, color });
      this.y -= size + gap;
    }
  }

  heading(str, level = 1) {
    const size = level === 1 ? 20 : level === 2 ? 14 : 12;
    this.y -= level === 1 ? 10 : 8;
    this.text(str, { size, bold: true, color: [0.1, 0.1, 0.25], gap: 6 });
    if (level === 1) {
      this.page.rects.push({
        x: MARGIN,
        y: this.y + 2,
        w: CONTENT_W,
        h: 1.5,
        r: 0.2,
        g: 0.2,
        b: 0.4,
      });
      this.y -= 8;
    } else {
      this.y -= 2;
    }
  }

  bullet(str) {
    this.text('\u2022  ' + str, { indent: 14, gap: 3 });
  }

  badge(label, severity) {
    const color = SEV_COLOR[String(severity).toLowerCase()] || SEV_COLOR.informational;
    this.ensureSpace(22);
    const labelW = Math.max(64, String(label).length * 7.2 + 20);
    this.page.rects.push({
      x: MARGIN,
      y: this.y - 4,
      w: labelW,
      h: 18,
      r: color[0],
      g: color[1],
      b: color[2],
    });
    this.page.lines.push({
      x: MARGIN + 10,
      y: this.y,
      size: 10,
      bold: true,
      text: String(label).toUpperCase(),
      color: [1, 1, 1],
    });
    return labelW;
  }

  addScreenshot(jpegBytes, caption) {
    const { objNum, width, height } = this.doc.addJpegImage(jpegBytes);
    const maxW = CONTENT_W;
    const scale = Math.min(1, maxW / width, 320 / height);
    const w = width * scale;
    const h = height * scale;
    this.ensureSpace(h + 40);
    this.page.images.push({ name: `Img${objNum}`, x: MARGIN, y: this.y - h, w, h, objNum });
    this.y -= h + 6;
    if (caption) this.text(caption, { size: 9, color: [0.35, 0.35, 0.35], gap: 6 });
    this.y -= 6;
  }

  footer() {
    const label = `Dark-Matter autonomous assessment  |  Page ${this.pageNum}`;
    this.page.lines.push({
      x: MARGIN,
      y: 34,
      size: 8,
      bold: false,
      text: label,
      color: [0.5, 0.5, 0.5],
    });
  }

  render() {
    const r = this.report;
    const s = r.summary || {};
    // Cover header
    this.heading(r.title || 'Security Assessment Report', 1);
    this.text(`Target: ${r.target || 'unknown'}`, { size: 12 });
    this.text(`Generated: ${r.generatedAt || new Date().toISOString()}`, {
      size: 10,
      color: [0.4, 0.4, 0.4],
    });
    this.text(`Report mode: ${r.mode === 'executive' ? 'Executive summary' : 'Full technical'}`, {
      size: 10,
      color: [0.4, 0.4, 0.4],
    });
    this.y -= 6;

    this.heading('Findings at a glance', 2);
    for (const [label, key] of [
      ['Critical', 'critical'],
      ['High', 'high'],
      ['Medium', 'medium'],
      ['Low', 'low'],
      ['Informational', 'informational'],
    ]) {
      const count = s[key] || 0;
      if (count > 0 || key === 'informational') {
        this.ensureSpace(24);
        this.badge(`${label}: ${count}`, key);
        this.y -= 24;
      }
    }
    this.y -= 4;

    if (r.executiveSummary) {
      this.heading('Executive summary', 2);
      for (const para of String(r.executiveSummary).split('\n')) {
        if (para.trim()) this.text(para.trim(), { gap: 6 });
      }
    }

    const findings = Array.isArray(r.findings) ? r.findings : [];
    this.heading(`Detailed findings (${findings.length})`, 2);
    findings.forEach((f, i) => this.renderFinding(f, i + 1));

    if (Array.isArray(r.screenshots) && r.screenshots.length) {
      this.heading('Visual evidence', 2);
      for (const shot of r.screenshots) {
        if (shot?.jpeg?.length) this.addScreenshot(shot.jpeg, shot.caption);
      }
    }

    this.heading('Limitations', 2);
    this.text(
      'Automated, non-destructive testing only. Every claim in this report comes from stored evidence collected during the hunt — nothing was invented or extrapolated.',
      { gap: 6 }
    );
    this.footer();
  }

  renderFinding(f, index) {
    const cvss = f.cvss || {};
    this.ensureSpace(60);
    this.heading(`${index}. ${f.title || 'Untitled finding'}`, 3);
    this.badge(String(f.severity || 'informational'), f.severity);
    this.y -= 20;
    const cvssLine =
      cvss.score != null
        ? `CVSS ${cvss.score} (${cvss.rating || 'n/a'})${cvss.vector ? '  ' + cvss.vector : ''}`
        : `Severity: ${f.severity || 'n/a'} (CVSS metrics not recorded)`;
    this.text(cvssLine, { size: 10, bold: true, color: [0.25, 0.25, 0.25], gap: 6 });
    if (f.affectedEndpoint) this.text(`Endpoint: ${f.affectedEndpoint}`, { size: 10, gap: 4 });
    if (f.parameter) this.text(`Parameter: ${f.parameter}`, { size: 10, gap: 6 });

    const exec = this.report.mode === 'executive';
    this.text('Description', { size: 11, bold: true, gap: 3 });
    this.text(f.description || 'No description recorded.', { gap: 6 });
    this.text('Business impact', { size: 11, bold: true, gap: 3 });
    this.text(f.impact || 'Impact not recorded.', { gap: 6 });

    if (!exec) {
      if (Array.isArray(f.reproductionSteps) && f.reproductionSteps.length) {
        this.text('Reproduction steps', { size: 11, bold: true, gap: 3 });
        f.reproductionSteps.forEach((step, j) =>
          this.text(`${j + 1}. ${step}`, { indent: 10, gap: 3 })
        );
        this.y -= 3;
      }
      if (f.repro?.curl) {
        this.text('Reproducible proof (curl)', { size: 11, bold: true, gap: 3 });
        for (const line of String(f.repro.curl).split('\n'))
          this.text(line, { size: 8.5, indent: 10, gap: 2 });
        this.y -= 3;
      }
      const ev = Array.isArray(f.evidence) ? f.evidence : [];
      if (ev.length) {
        this.text(`Evidence (${ev.length})`, { size: 11, bold: true, gap: 3 });
        ev.slice(0, 6).forEach(e =>
          this.bullet(`${e.kind || 'evidence'}: ${e.summary || e.id || ''}`)
        );
        this.y -= 3;
      }
      if (f.poc) {
        this.text(`Proof of concept (${f.poc.name || 'PoC'})`, { size: 11, bold: true, gap: 3 });
        this.text(
          'A proof-only PoC artifact was generated for this finding and is attached to the hunt record.',
          { gap: 6 }
        );
      }
      if (f.triager) {
        this.text('Triager assessment', { size: 11, bold: true, gap: 3 });
        this.text(
          `Exploitability: ${f.triager.exploitability} — prerequisites: ${(f.triager.prerequisites || []).join('; ')}.`,
          { gap: 3 }
        );
        this.text(f.triager.triagerSummary || '', { gap: 6 });
      }
      if (f.fixCode?.code) {
        this.text(`Fix code (${f.fixCode.language || 'code'})`, { size: 11, bold: true, gap: 3 });
        for (const line of String(f.fixCode.code).split('\n'))
          this.text(line, { size: 8, indent: 10, gap: 2 });
        this.y -= 3;
      }
    }

    const rem = Array.isArray(f.remediation)
      ? f.remediation
      : f.remediation
        ? [String(f.remediation)]
        : [];
    this.text('Remediation', { size: 11, bold: true, gap: 3 });
    if (rem.length) rem.forEach(line => this.bullet(line));
    else this.text('Remediation guidance not recorded.', { gap: 6 });
    this.y -= 8;
  }
}

/** Greedy word wrap using an approximate per-character width per font size. */
function wrap(str, size, bold, maxWidth) {
  const avg = size * (bold ? 0.58 : 0.52);
  const maxChars = Math.max(20, Math.floor(maxWidth / avg));
  const out = [];
  for (const rawPara of str.split('\n')) {
    const para = rawPara.trim();
    if (!para) {
      out.push('');
      continue;
    }
    const words = para.split(/\s+/);
    let line = '';
    for (const w of words) {
      const next = line ? line + ' ' + w : w;
      if (next.length > maxChars && line) {
        out.push(line);
        line = w;
      } else line = next;
    }
    if (line) out.push(line);
  }
  return out.length ? out : [''];
}

/**
 * Verify a generated report PDF by PARSING it: walk the xref, inflate every
 * content stream, extract Tj text runs, and check the report's key strings
 * are really inside. Returns { ok, pages, textLength, missing[] }.
 */
export function verifyReportPdf(pdfBytes, expectedStrings = [], options = {}) {
  const absentStrings = options.absent || [];
  const buf = Buffer.isBuffer(pdfBytes) ? pdfBytes : Buffer.from(pdfBytes);
  const text = buf.toString('latin1');
  if (!text.startsWith('%PDF-'))
    return { ok: false, pages: 0, textLength: 0, missing: expectedStrings, error: 'not a PDF' };

  // Page count from /Count in the /Pages object
  let pages = 0;
  const countMatch = text.match(/\/Type\s*\/Pages[\s\S]{0,200}?\/Count\s+(\d+)/);
  if (countMatch) pages = Number(countMatch[1]);

  // Extract text from every stream object: inflate + collect ( ... ) Tj runs
  const extracted = [];
  const streamRe = /(\d+)\s+0\s+obj[\s\S]*?stream\r?\n([\s\S]*?)endstream/g;
  let m;
  while ((m = streamRe.exec(text)) !== null) {
    let raw = Buffer.from(m[2], 'latin1');
    // Trim trailing CR/LF the writer adds after the deflated bytes.
    while (raw.length && (raw[raw.length - 1] === 0x0a || raw[raw.length - 1] === 0x0d)) {
      raw = raw.subarray(0, raw.length - 1);
    }
    let inflated = null;
    try {
      inflated = inflateSync(raw);
    } catch {
      /* not a deflated stream (e.g. a JPEG) — skip */
    }
    if (!inflated) continue;
    const s = inflated.toString('latin1');
    const tjRe = /\((?:\\.|[^\\()])*\)\s*Tj/g;
    let t;
    while ((t = tjRe.exec(s)) !== null) {
      extracted.push(
        t[0]
          .replace(/^\(/, '')
          .replace(/\)\s*Tj$/, '')
          .replace(/\\([\\()])/g, '$1')
          .replace(/\?/g, '?')
      );
    }
  }
  const joined = extracted.join('\n');
  const missing = expectedStrings.filter(s => !joined.includes(s));
  const leaked = absentStrings.filter(s => joined.includes(s));
  return {
    ok: pages > 0 && extracted.length > 0 && missing.length === 0 && leaked.length === 0,
    pages,
    textLength: joined.length,
    textRuns: extracted.length,
    missing,
    leaked,
  };
}
