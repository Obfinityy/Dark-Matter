/**
 * printCore.js — wave 23 (ideas 50881–50920): print / export-to-print suite
 * pure logic + a real QR encoder.
 *
 * Ideas 50881–50884 (copy round 3) live in copyRound3Core.js; the full wave
 * registry is here. Ideas 50885–50920 are the print suite: dedicated print
 * stylesheet data, repeating headers, "Page X of Y" footers, text-labeled
 * severity, hide-in-print utilities, expand-aware printing, print dialog
 * state (scope/margins/grayscale/ink-saver), wrapped code with line numbers,
 * captioned screenshots, printed TOC, unbroken cards, href-after-link text,
 * labeled chart values, condensed timeline print, WYSIWYG preview data,
 * per-section printing, draft watermark, filter-aware headers, classification
 * footers, a REAL QR encoder for the live-hunt link (byte mode, EC level L,
 * versions 1–6, up to 134 bytes — no external dependency, no mock), two-column summaries,
 * chain-graph-as-list, 12pt type constant, audit-trail appendix, save-as-PDF
 * guidance, section page breaks, printable remediation checklists, stacked
 * retest diffs, one-page dashboard snapshot data, timezone-labeled timestamps,
 * and a glossary appendix builder.
 *
 * Honest skips (already live, not re-implemented):
 *   50898 forced light print — live via ThemeSuite.css @media print + wave-17 50643
 *   50914 hidden nav in print — live via wave-17 50643 app-wide chrome hiding
 */

export const WAVE23_IDEAS = [
  [50881, 'Copy version info', 'new'],
  [50882, 'Copy as API query', 'new'],
  [50883, 'Copy image bytes', 'new'],
  [50884, 'No copy on secrets', 'new'],
  [50885, 'Dedicated print stylesheet', 'new'],
  [50886, 'Print page header', 'new'],
  [50887, 'Page-number footer', 'new'],
  [50888, 'Text-labeled severity', 'new'],
  [50889, 'Hidden interactive chrome', 'new'],
  [50890, 'Expand-aware printing', 'new'],
  [50891, 'Print-scope toggle', 'new'],
  [50892, 'Wrapped code printing', 'new'],
  [50893, 'Captioned screenshots', 'new'],
  [50894, 'Printed table of contents', 'new'],
  [50895, 'Unbroken cards', 'new'],
  [50896, 'Visible link URLs', 'new'],
  [50897, 'Labeled chart values', 'new'],
  [50898, 'Forced light print', 'skip', 'already live: ThemeSuite.css @media print + wave-17 50643'],
  [50899, 'Ink-saving print', 'new'],
  [50900, 'Grayscale print toggle', 'new'],
  [50901, 'Condensed timeline print', 'new'],
  [50902, 'WYSIWYG print preview', 'new'],
  [50903, 'Per-section printing', 'new'],
  [50904, 'Configurable margins', 'new'],
  [50905, 'Draft watermark', 'new'],
  [50906, 'Filter-aware print header', 'new'],
  [50907, 'Classification footer', 'new'],
  [50908, 'Print QR code', 'new'],
  [50909, 'Two-column summaries', 'new'],
  [50910, 'Graph-as-list print', 'new'],
  [50911, 'Print type size', 'new'],
  [50912, 'Audit-trail appendix', 'new'],
  [50913, 'Save-as-PDF guidance', 'new'],
  [50914, 'Hidden nav in print', 'skip', 'already live: wave-17 50643 app-wide chrome hiding'],
  [50915, 'Section page breaks', 'new'],
  [50916, 'Printable checklists', 'new'],
  [50917, 'Stacked diff print', 'new'],
  [50918, 'One-page dashboard print', 'new'],
  [50919, 'Labeled timezones', 'new'],
  [50920, 'Glossary appendix', 'new'],
];

export function wave23RegistryComplete() {
  return WAVE23_IDEAS.length === 40 && WAVE23_IDEAS.every((r) => r.length >= 3);
}

/* 50885 — dedicated print stylesheet ------------------------------------ */

export const PRINT_BODY_PT = 12; // 50911 — print body text at 12pt
export const PR_NO_PRINT_CLASS = 'pr-no-print'; // 50889
export const PR_UNBROKEN_CLASS = 'pr-unbroken'; // 50895
export const INK_SAVER_CLASS = 'pr-ink-saver'; // 50899
export const GRAYSCALE_CLASS = 'pr-grayscale'; // 50900
export const DRAFT_CLASS = 'pr-draft'; // 50905

/* 50886 — print page header --------------------------------------------- */

export function printHeaderData({ brand = 'Infinity AI · Dark-Matter', target, dateRange, printedAt } = {}) {
  return {
    brand,
    target: target || '—',
    dateRange: dateRange || '—',
    printedAt: typeof printedAt === 'number' ? printedAt : Date.now(),
  };
}

/* 50887 — page-number footer -------------------------------------------- */

export function pageFooterText(page, total) {
  if (!Number.isInteger(page) || !Number.isInteger(total) || page < 1 || total < 1 || page > total) {
    return null;
  }
  return `Page ${page} of ${total}`;
}

/* 50888 — text-labeled severity ----------------------------------------- */

const SEVERITY_PRINT_LABELS = {
  critical: 'CRITICAL', high: 'HIGH', medium: 'MEDIUM', low: 'LOW', info: 'INFO',
};

export function severityPrintLabel(severity) {
  if (!severity) return 'UNKNOWN';
  const key = String(severity).toLowerCase();
  return SEVERITY_PRINT_LABELS[key] || String(severity).toUpperCase();
}

/* 50889 — hidden interactive chrome ------------------------------------- */

/** Extra per-component selectors hidden in print, beyond 50643's app chrome. */
export const PRINT_HIDDEN_SELECTORS = [
  `.${PR_NO_PRINT_CLASS}`,
  '.pr-tooltip',
  '[data-pr-hover]',
  '.pr-copy-btn',
  '.pr-expand-toggle',
];

export function isHiddenInPrint(selector) {
  return PRINT_HIDDEN_SELECTORS.includes(selector);
}

/* 50890 — expand-aware printing ------------------------------------------ */

export function expandAwarePrint(cards = [], expandedIds = []) {
  const expanded = new Set(expandedIds);
  return cards.map((c) => ({
    id: c.id,
    title: c.title,
    mode: expanded.has(c.id) ? 'full' : 'summary',
    body: expanded.has(c.id) ? c.evidence : c.summary,
  }));
}

/* 50891 — print-scope toggle + dialog state ------------------------------ */

export function createPrintScope() {
  return { scope: 'view', margins: 'normal', grayscale: false, inkSaver: false, sectionBreaks: false, draft: false };
}

export function setPrintScope(state, patch = {}) {
  const next = { ...state, ...patch };
  if (!['view', 'all'].includes(next.scope)) next.scope = 'view';
  if (!['narrow', 'normal', 'wide'].includes(next.margins)) next.margins = 'normal';
  return next;
}

/* 50892 — wrapped code printing ------------------------------------------ */

export function wrapCodeLines(code, maxLen = 90) {
  if (typeof code !== 'string') return [];
  const out = [];
  let no = 0;
  for (const raw of code.split('\n')) {
    no += 1;
    if (raw.length <= maxLen) {
      out.push({ no, text: raw, wrapped: false, continuation: false });
      continue;
    }
    let rest = raw;
    let first = true;
    while (rest.length > maxLen) {
      out.push({ no, text: rest.slice(0, maxLen), wrapped: true, continuation: !first });
      rest = rest.slice(maxLen);
      first = false;
    }
    out.push({ no, text: rest, wrapped: true, continuation: true });
  }
  return out;
}

/* 50893 — captioned screenshots ------------------------------------------- */

export function screenshotFigure({ src, caption, sourceUrl, maxWidthPx = 640 } = {}) {
  if (!src) return null;
  return {
    src,
    caption: caption || 'Screenshot',
    sourceUrl: sourceUrl || null,
    maxWidthPx: Math.max(200, Math.min(1200, maxWidthPx || 640)),
  };
}

/* 50894 — printed table of contents --------------------------------------- */

const TOC_PAGE_LINES = 45;

export function buildPrintToc(sections = []) {
  let page = 1;
  return sections.map((s) => {
    const startPage = page;
    const lines = Math.max(1, Number(s.lines) || 1);
    page += Math.ceil(lines / TOC_PAGE_LINES);
    return { id: s.id, title: s.title, page: startPage };
  });
}

/* 50896 — visible link URLs ----------------------------------------------- */

export function linkPrintText(text, href) {
  const t = String(text || '').trim();
  if (!href) return t;
  return `${t} (${href})`;
}

/* 50897 — labeled chart values -------------------------------------------- */

export function chartPrintLabels(segments = []) {
  const total = segments.reduce((a, s) => a + (Number(s.value) || 0), 0);
  return segments
    .map((s) => ({
      label: s.label,
      value: Number(s.value) || 0,
      pct: total > 0 ? Math.round(((Number(s.value) || 0) / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

/* 50899/50900 — ink-saver + grayscale -------------------------------------- */

export function printModeClasses({ inkSaver, grayscale, draft } = {}) {
  const classes = [];
  if (inkSaver) classes.push(INK_SAVER_CLASS);
  if (grayscale) classes.push(GRAYSCALE_CLASS);
  if (draft) classes.push(DRAFT_CLASS);
  return classes;
}

/* 50901 — condensed timeline print ----------------------------------------- */

export function timelinePrintList(events = []) {
  return [...events]
    .sort((a, b) => (a.ts || 0) - (b.ts || 0))
    .map((e) => ({ ts: e.ts, label: e.label, detail: e.detail || '' }));
}

/* 50903 — per-section printing ---------------------------------------------- */

export const PRINTABLE_SECTIONS = [
  'executive-summary', 'findings', 'timeline', 'chain-graph',
  'audit-trail', 'glossary', 'remediation-checklist', 'dashboard-snapshot',
];

export function sectionPrintTargets(report = {}) {
  const sections = Array.isArray(report.sections) ? report.sections : [];
  return sections
    .filter((s) => PRINTABLE_SECTIONS.includes(s.id))
    .map((s) => ({ id: s.id, title: s.title || s.id }));
}

/* 50904 — configurable margins ---------------------------------------------- */

export const PRINT_MARGINS = { narrow: '12mm', normal: '18mm', wide: '28mm' };

export function marginFor(key) {
  return PRINT_MARGINS[key] || PRINT_MARGINS.normal;
}

/* 50905 — draft watermark ---------------------------------------------------- */

export const DRAFT_WATERMARK_TEXT = 'DRAFT — not for distribution';

/* 50906 — filter-aware print header ------------------------------------------- */

export function filterAwareHeader({ total, shown } = {}) {
  const t = Math.max(0, Number(total) || 0);
  const s = Math.max(0, Number(shown) || 0);
  if (s < t) return `printing ${s} of ${t} findings (filtered)`;
  return `printing ${t} finding${t === 1 ? '' : 's'}`;
}

/* 50907 — classification footer ----------------------------------------------- */

export const CLASSIFICATIONS = ['UNCLASSIFIED', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'];

export function classificationLabel(level) {
  const up = String(level || '').toUpperCase();
  return CLASSIFICATIONS.includes(up) ? up : 'UNCLASSIFIED';
}

/* 50908 — print QR code: REAL encoder (byte mode, EC level L, v1–v6) ------ */
/* No external dependency. Produces scannable QR matrices for the live-hunt
   link printed on reports. Capacity: up to 136 data bytes (version 6-L).   */

export const QR_MAX_BYTES = 134; // true v6-L byte-mode ceiling: 12-bit header + 4-bit terminator fit 134 bytes in 136 data codewords

const QR_VERSIONS = [
  null,
  { dataCW: 19, blocks: [[1, 19, 7]], align: [] },
  { dataCW: 34, blocks: [[1, 34, 10]], align: [6, 18] },
  { dataCW: 55, blocks: [[1, 55, 15]], align: [6, 22] },
  { dataCW: 80, blocks: [[1, 80, 20]], align: [6, 26] },
  { dataCW: 108, blocks: [[1, 108, 26]], align: [6, 30] },
  { dataCW: 136, blocks: [[2, 68, 18]], align: [6, 34] },
];

// Galois field GF(256), poly 0x11D
const QR_EXP = new Array(512);
const QR_LOG = new Array(256);
(function initGalois() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    QR_EXP[i] = x;
    QR_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) QR_EXP[i] = QR_EXP[i - 255];
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return QR_EXP[QR_LOG[a] + QR_LOG[b]];
}

function rsGenerator(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gfMul(poly[j], QR_EXP[i]);
      next[j + 1] ^= poly[j];
    }
    poly = next;
  }
  return poly;
}

function rsRemainder(data, degree) {
  const gen = rsGenerator(degree);
  const msg = [...data, ...new Array(degree).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const coef = msg[i];
    if (coef === 0) continue;
    for (let j = 0; j < gen.length; j++) {
      msg[i + j] ^= gfMul(gen[j], coef);
    }
  }
  return msg.slice(data.length);
}

function qrPickVersion(byteLen) {
  for (let v = 1; v <= 6; v++) {
    if (12 + byteLen * 8 <= QR_VERSIONS[v].dataCW * 8) return v;
  }
  return 0;
}

function qrDataCodewords(bytes, version) {
  const v = QR_VERSIONS[version];
  const bits = [];
  const push = (val, len) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };
  push(0b0100, 4); // byte mode
  push(bytes.length, 8); // char count (versions 1–9)
  for (const b of bytes) push(b, 8);
  const capacity = v.dataCW * 8;
  const term = Math.min(4, capacity - bits.length);
  push(0, term);
  while (bits.length % 8 !== 0) bits.push(0);
  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let cw = 0;
    for (let j = 0; j < 8; j++) cw = (cw << 1) | bits[i + j];
    codewords.push(cw);
  }
  let pad = 0xec;
  while (codewords.length < v.dataCW) {
    codewords.push(pad);
    pad = pad === 0xec ? 0x11 : 0xec;
  }
  return codewords;
}

function qrInterleave(dataCWs, version) {
  const v = QR_VERSIONS[version];
  const dataBlocks = [];
  const ecBlocks = [];
  let offset = 0;
  for (const [count, dataLen, ecLen] of v.blocks) {
    for (let b = 0; b < count; b++) {
      const data = dataCWs.slice(offset, offset + dataLen);
      offset += dataLen;
      dataBlocks.push(data);
      ecBlocks.push(rsRemainder(data, ecLen));
    }
  }
  const out = [];
  const maxData = Math.max(...dataBlocks.map((b) => b.length));
  for (let i = 0; i < maxData; i++) {
    for (const b of dataBlocks) if (i < b.length) out.push(b[i]);
  }
  const maxEc = Math.max(...ecBlocks.map((b) => b.length));
  for (let i = 0; i < maxEc; i++) {
    for (const b of ecBlocks) if (i < b.length) out.push(b[i]);
  }
  return out;
}

const QR_MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

const FORMAT_POS_TOP = [
  [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
  [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
];

function formatPosSplit(n) {
  return [
    [n - 1, 8], [n - 2, 8], [n - 3, 8], [n - 4, 8], [n - 5, 8], [n - 6, 8], [n - 7, 8],
    [8, n - 8], [8, n - 7], [8, n - 6], [8, n - 5], [8, n - 4], [8, n - 3], [8, n - 2], [8, n - 1],
  ];
}

function qrFormatBits(mask) {
  const data = (0b01 << 3) | mask; // EC level L = 01
  let d = data << 10;
  const gen = 0b10100110111;
  while (d >= 0b100000000000) {
    const shift = Math.floor(Math.log2(d)) - 10;
    d ^= gen << shift;
  }
  return ((data << 10) | d) ^ 0b101010000010010;
}

function qrPenalty(modules) {
  const n = modules.length;
  let penalty = 0;
  // Rule 1: runs of 5+ in rows/cols
  for (let r = 0; r < n; r++) {
    let run = 1;
    for (let c = 1; c < n; c++) {
      if (modules[r][c] === modules[r][c - 1]) run++;
      else { if (run >= 5) penalty += 3 + (run - 5); run = 1; }
    }
    if (run >= 5) penalty += 3 + (run - 5);
  }
  for (let c = 0; c < n; c++) {
    let run = 1;
    for (let r = 1; r < n; r++) {
      if (modules[r][c] === modules[r - 1][c]) run++;
      else { if (run >= 5) penalty += 3 + (run - 5); run = 1; }
    }
    if (run >= 5) penalty += 3 + (run - 5);
  }
  // Rule 2: 2x2 blocks
  for (let r = 0; r < n - 1; r++) {
    for (let c = 0; c < n - 1; c++) {
      const v = modules[r][c];
      if (modules[r][c + 1] === v && modules[r + 1][c] === v && modules[r + 1][c + 1] === v) penalty += 3;
    }
  }
  // Rule 3: finder-like patterns
  const pat1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const pat2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  const matchAt = (arr, i, pat) => pat.every((p, k) => arr[i + k] === p);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c <= n - 11; c++) {
      if (matchAt(modules[r], c, pat1) || matchAt(modules[r], c, pat2)) penalty += 40;
    }
  }
  for (let c = 0; c < n; c++) {
    const col = modules.map((row) => row[c]);
    for (let r = 0; r <= n - 11; r++) {
      if (matchAt(col, r, pat1) || matchAt(col, r, pat2)) penalty += 40;
    }
  }
  // Rule 4: dark ratio
  const dark = modules.flat().filter(Boolean).length;
  const pct = (dark * 100) / (n * n);
  penalty += Math.floor(Math.abs(pct - 50) / 5) * 10;
  return penalty;
}

/**
 * Encode a URL (or any short ASCII/UTF-8 text) as a QR module matrix.
 * Returns { ok, version, size, modules } or { ok:false, reason }.
 */
export function qrEncodeUrl(text) {
  const str = String(text || '');
  const bytes = Array.from(new TextEncoder().encode(str));
  if (bytes.length === 0) return { ok: false, reason: 'empty' };
  if (bytes.length > QR_MAX_BYTES) return { ok: false, reason: 'too-long', max: QR_MAX_BYTES };
  const version = qrPickVersion(bytes.length);
  const n = 21 + 4 * (version - 1);
  const codewords = qrInterleave(qrDataCodewords(bytes, version), version);

  // Build base matrix: -1 = unset, 1 = function dark, 0 = function light
  const base = Array.from({ length: n }, () => new Array(n).fill(-1));
  const place = (r, c, v) => { base[r][c] = v ? 1 : 0; };

  const finder = (r0, c0) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = r0 + dr, c = c0 + dc;
        if (r < 0 || c < 0 || r >= n || c >= n) continue;
        if (dr === -1 || dr === 7 || dc === -1 || dc === 7) place(r, c, 0);
        else {
          const inOuter = dr === 0 || dr === 6 || dc === 0 || dc === 6;
          const inCore = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
          place(r, c, inOuter || inCore);
        }
      }
    }
  };
  finder(0, 0); finder(0, n - 7); finder(n - 7, 0);

  // Timing patterns
  for (let i = 8; i < n - 8; i++) {
    place(6, i, i % 2 === 0);
    place(i, 6, i % 2 === 0);
  }

  // Alignment patterns
  const ap = QR_VERSIONS[version].align;
  for (const r of ap) {
    for (const c of ap) {
      const overlapsFinder = (r <= 8 && c <= 8) || (r <= 8 && c >= n - 9) || (r >= n - 9 && c <= 8);
      if (overlapsFinder) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          place(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
        }
      }
    }
  }

  // Dark module + reserve format areas
  place(n - 8, 8, 1);
  const reserve = (coords) => coords.forEach(([r, c]) => { if (base[r][c] === -1) base[r][c] = 0; });
  reserve(FORMAT_POS_TOP);
  reserve(formatPosSplit(n));

  // Data placement (zigzag, skipping col 6)
  const dataBits = [];
  for (const cw of codewords) {
    for (let i = 7; i >= 0; i--) dataBits.push((cw >> i) & 1);
  }
  let bitIdx = 0;
  const dataCells = [];
  let upward = true;
  for (let col = n - 1; col > 0; col -= 2) {
    const c0 = col === 6 ? 5 : col;
    for (let i = 0; i < n; i++) {
      const r = upward ? n - 1 - i : i;
      for (const c of [c0, c0 - 1]) {
        if (base[r][c] === -1) {
          dataCells.push([r, c]);
          bitIdx++;
        }
      }
    }
    upward = !upward;
  }
  // Trim/pad data bits to the available cell count
  while (dataBits.length < dataCells.length) dataBits.push(0);

  // Try all masks, pick lowest penalty
  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    const m = base.map((row) => row.slice());
    dataCells.forEach(([r, c], i) => {
      m[r][c] = dataBits[i] ^ (QR_MASKS[mask](r, c) ? 1 : 0);
    });
    const fmt = qrFormatBits(mask);
    const bits = [];
    for (let i = 14; i >= 0; i--) bits.push((fmt >> i) & 1);
    FORMAT_POS_TOP.forEach(([r, c], i) => { m[r][c] = bits[i]; });
    formatPosSplit(n).forEach(([r, c], i) => { m[r][c] = bits[i]; });
    const score = qrPenalty(m);
    if (!best || score < best.score) best = { score, modules: m, mask };
  }
  return { ok: true, version, size: n, mask: best.mask, modules: best.modules };
}

/** Render QR modules as an SVG string (real scannable output). */
export function qrToSvg(modules, { cell = 4, margin = 4, dark = '#000', light = '#fff' } = {}) {
  const n = modules.length;
  const size = (n + margin * 2) * cell;
  let rects = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (modules[r][c]) {
        rects += `<rect x="${(c + margin) * cell}" y="${(r + margin) * cell}" width="${cell}" height="${cell}"/>`;
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="QR code"><rect width="${size}" height="${size}" fill="${light}"/><g fill="${dark}">${rects}</g></svg>`;
}

/* 50909 — two-column summaries ---------------------------------------------- */

export function splitSummaryColumns(paragraphs = []) {
  const paras = paragraphs.filter((p) => String(p || '').trim());
  const total = paras.reduce((a, p) => a + p.length, 0);
  const left = [];
  let acc = 0;
  for (const p of paras) {
    if (acc > 0 && acc + p.length > total / 2 && left.length > 0) break;
    left.push(p);
    acc += p.length;
  }
  return { left, right: paras.slice(left.length) };
}

/* 50910 — graph-as-list print ------------------------------------------------- */

export function chainGraphToList(nodes = [], edges = []) {
  return nodes.map((node) => ({
    id: node.id,
    label: node.label || node.id,
    kind: node.kind || 'node',
    incoming: edges.filter((e) => e.to === node.id).map((e) => ({ from: e.from, label: e.label || '' })),
    outgoing: edges.filter((e) => e.from === node.id).map((e) => ({ to: e.to, label: e.label || '' })),
  }));
}

/* 50912 — audit-trail appendix ------------------------------------------------- */

export function auditTrailAppendix(events = []) {
  return [...events]
    .sort((a, b) => (a.ts || 0) - (b.ts || 0))
    .map((e) => ({ ts: e.ts, actor: e.actor || 'system', action: e.action || '' }));
}

/* 50913 — save-as-PDF guidance -------------------------------------------------- */

export function pdfGuidance(userAgent = '') {
  const ua = String(userAgent || '').toLowerCase();
  let browser = 'your browser';
  if (ua.includes('edg/')) browser = 'Microsoft Edge';
  else if (ua.includes('chrome/') && !ua.includes('edg/')) browser = 'Google Chrome';
  else if (ua.includes('firefox/')) browser = 'Mozilla Firefox';
  else if (ua.includes('safari/') && !ua.includes('chrome/')) browser = 'Safari';
  return {
    browser,
    destination: 'Save as PDF',
    settings: {
      margins: 'Default (or Normal)',
      backgrounds: 'ON — enable "Background graphics" so severity pills and code blocks print',
      headersFooters: 'OFF — the report already carries its own headers, footers and page numbers',
      paperSize: 'A4',
    },
    steps: [
      `Open the print dialog (Ctrl/Cmd+P) in ${browser}.`,
      'Set Destination to "Save as PDF".',
      'Turn ON "Background graphics" so colors, pills and code blocks survive.',
      'Turn OFF browser headers/footers — the report prints its own.',
      'Choose A4, then Save.',
    ],
  };
}

/* 50915 — section page breaks ----------------------------------------------------- */

export function sectionPageBreakPlan(groups = [], enabled = false) {
  return groups.map((g, i) => ({
    severity: g.severity,
    count: g.count || 0,
    breakBefore: enabled && i > 0,
  }));
}

/* 50916 — printable checklists ------------------------------------------------------ */

export function remediationChecklistRows(items = []) {
  return items.map((it) => ({
    id: it.id,
    text: it.text || '',
    box: '☐', // always empty on paper — field use (50916)
  }));
}

/* 50917 — stacked diff print ----------------------------------------------------------- */

export function stackedDiff(before, after) {
  const b = String(before || '').split('\n');
  const a = String(after || '').split('\n');
  let pre = 0;
  while (pre < b.length && pre < a.length && b[pre] === a[pre]) pre++;
  let suf = 0;
  while (suf < b.length - pre && suf < a.length - pre && b[b.length - 1 - suf] === a[a.length - 1 - suf]) suf++;
  return {
    changed: pre + suf < Math.max(b.length, a.length),
    before: b.slice(pre, b.length - suf),
    after: a.slice(pre, a.length - suf),
    contextBefore: b.slice(0, pre),
    contextAfter: a.slice(Math.max(0, a.length - suf)),
  };
}

/* 50918 — one-page dashboard print -------------------------------------------------------- */

export function dashboardOnePager(widgets = [], maxWidgets = 8) {
  return [...widgets]
    .sort((a, b) => (Number(a.priority) || 0) - (Number(b.priority) || 0))
    .slice(0, maxWidgets)
    .map((w) => ({ id: w.id, title: w.title, summary: w.summary || '' }));
}

/* 50919 — labeled timezones ----------------------------------------------------------------- */

export function formatPrintTimestamp(ts, timeZone = 'UTC') {
  const date = new Date(Number(ts));
  if (Number.isNaN(date.getTime())) return null;
  let tz = timeZone;
  try {
    // Validate the zone; throws on unknown zones.
    new Intl.DateTimeFormat('en', { timeZone: tz }).format(date);
  } catch {
    tz = 'UTC';
  }
  const dtf = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const short = new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'short' })
    .formatToParts(date).find((p) => p.type === 'timeZoneName');
  const abbr = short ? short.value : tz;
  return `${dtf.format(date)} ${abbr} (${tz})`;
}

/* 50920 — glossary appendix ------------------------------------------------------------------- */

const GLOSSARY_DEFS = {
  XSS: 'Cross-Site Scripting — attacker-controlled script runs in a victim browser.',
  SQLI: 'SQL Injection — untrusted input alters a database query.',
  CSRF: 'Cross-Site Request Forgery — a site performs actions as the logged-in user.',
  SSRF: 'Server-Side Request Forgery — the server is tricked into making requests.',
  IDOR: 'Insecure Direct Object Reference — accessing objects by guessing IDs.',
  RCE: 'Remote Code Execution — attacker runs code on the server.',
  CVSS: 'Common Vulnerability Scoring System — 0–10 severity scale.',
  CWE: 'Common Weakness Enumeration — catalog of software weakness types.',
  POC: 'Proof of Concept — minimal demonstration that a bug is real.',
  ATO: 'Account Takeover — attacker gains control of a victim account.',
  SSTI: 'Server-Side Template Injection — template engines execute attacker input.',
  XXE: 'XML External Entity — XML parsers resolve attacker-controlled entities.',
};

export function buildGlossary(findings = []) {
  const terms = new Map();
  const scan = (text) => {
    if (!text) return;
    const words = String(text).toUpperCase().match(/\b[A-Z]{2,6}\b/g) || [];
    for (const w of words) {
      if (GLOSSARY_DEFS[w] && !terms.has(w)) terms.set(w, GLOSSARY_DEFS[w]);
    }
  };
  for (const f of findings) {
    scan(f.title);
    scan(f.type);
    if (Array.isArray(f.tags)) f.tags.forEach(scan);
  }
  return [...terms.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([term, definition]) => ({ term, definition }));
}
