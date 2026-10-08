/**
 * wave23.test.js — wave 23 (ideas 50881–50920): copy round 3 + print suite.
 *
 * node:test checks for copyRound3Core + printCore pure logic, registry
 * completeness, the real QR encoder, and a print-stylesheet audit.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  versionInfoString,
  parseVersionInfo,
  filtersToApiQuery,
  apiQueryToFilters,
  canCopyImageBytes,
  validateImageCopyBlob,
  imageCopyPayload,
  isSecretField,
  secretCopyGate,
  SECRET_REVEAL_WINDOW_MS,
} from './copyRound3Core.js';
import {
  WAVE23_IDEAS,
  wave23RegistryComplete,
  PRINT_BODY_PT,
  PR_NO_PRINT_CLASS,
  PR_UNBROKEN_CLASS,
  INK_SAVER_CLASS,
  GRAYSCALE_CLASS,
  DRAFT_CLASS,
  printHeaderData,
  pageFooterText,
  severityPrintLabel,
  PRINT_HIDDEN_SELECTORS,
  isHiddenInPrint,
  expandAwarePrint,
  createPrintScope,
  setPrintScope,
  wrapCodeLines,
  screenshotFigure,
  buildPrintToc,
  linkPrintText,
  chartPrintLabels,
  printModeClasses,
  timelinePrintList,
  sectionPrintTargets,
  PRINTABLE_SECTIONS,
  PRINT_MARGINS,
  marginFor,
  DRAFT_WATERMARK_TEXT,
  filterAwareHeader,
  CLASSIFICATIONS,
  classificationLabel,
  QR_MAX_BYTES,
  qrEncodeUrl,
  qrToSvg,
  splitSummaryColumns,
  chainGraphToList,
  auditTrailAppendix,
  pdfGuidance,
  sectionPageBreakPlan,
  remediationChecklistRows,
  stackedDiff,
  dashboardOnePager,
  formatPrintTimestamp,
  buildGlossary,
} from './printCore.js';

describe('wave 23 registry', () => {
  it('covers all 40 ideas 50881–50920, 2 honest skips', () => {
    assert.equal(WAVE23_IDEAS.length, 40);
    for (let i = 0; i < 40; i++) assert.equal(WAVE23_IDEAS[i][0], 50881 + i);
    assert.ok(wave23RegistryComplete());
    const skips = WAVE23_IDEAS.filter(r => r[2] === 'skip').map(r => r[0]);
    assert.deepEqual(skips, [50898, 50914]);
    const news = WAVE23_IDEAS.filter(r => r[2] === 'new');
    assert.equal(news.length, 38);
  });
});

describe('50881 version info', () => {
  it('builds the bug-report string', () => {
    assert.equal(
      versionInfoString({ version: '2.4.1', build: '8812' }),
      'Dark-Matter v2.4.1 (build 8812)'
    );
    assert.equal(versionInfoString({ version: '1.0.0' }), 'Dark-Matter v1.0.0');
  });
  it('rejects bad input', () => {
    assert.equal(versionInfoString({ version: 'x' }), null);
    assert.equal(versionInfoString(null), null);
    assert.deepEqual(parseVersionInfo({ version: '2.4', build: 'abc' }), null);
  });
});

describe('50882 api query', () => {
  it('round-trips filters through query params', () => {
    const filters = {
      severity: ['high', 'critical'],
      status: 'open',
      q: 'xss <test>',
      sort: 'severity',
    };
    const q = filtersToApiQuery(filters);
    assert.ok(q.includes('severity=high'));
    assert.ok(q.includes('q=xss+%3Ctest%3E') || q.includes('q=xss%20%3Ctest%3E'));
    const back = apiQueryToFilters(q);
    assert.deepEqual(back.severity, ['high', 'critical']);
    assert.equal(back.status, 'open');
    assert.equal(back.q, 'xss <test>');
  });
  it('ignores empty values and unknown keys', () => {
    const q = filtersToApiQuery({ severity: '', bogus: 'x', order: 'desc' });
    assert.ok(!q.includes('bogus'));
    assert.ok(q.includes('order=desc'));
  });
});

describe('50883 image bytes', () => {
  it('feature-detects the environment', () => {
    const full = { navigator: { clipboard: { write: () => {} } }, ClipboardItem: function () {} };
    assert.equal(canCopyImageBytes(full), true);
    assert.equal(canCopyImageBytes({ navigator: {} }), false);
    assert.equal(canCopyImageBytes({}), false);
  });
  it('validates blobs', () => {
    assert.deepEqual(validateImageCopyBlob({ type: 'image/png', size: 120 }).ok, true);
    assert.equal(
      validateImageCopyBlob({ type: 'text/plain', size: 10 }).reason,
      'unsupported-mime'
    );
    assert.equal(validateImageCopyBlob({ type: 'image/png', size: 0 }).reason, 'empty');
    const blob = { type: 'image/png', size: 5 };
    const p = imageCopyPayload(blob);
    assert.equal(p.ok, true);
    assert.equal(p.payload['image/png'], blob);
  });
});

describe('50884 secret gate', () => {
  it('detects secret-looking fields', () => {
    assert.equal(isSecretField('api_key'), true);
    assert.equal(isSecretField('clientSecret'), true);
    assert.equal(isSecretField('username'), false);
    assert.equal(isSecretField(''), false);
  });
  it('gates copy behind an explicit reveal', () => {
    assert.deepEqual(secretCopyGate({ fieldName: 'title' }), {
      allowed: true,
      reason: 'not-secret',
    });
    assert.deepEqual(secretCopyGate({ fieldName: 'api_key' }), {
      allowed: false,
      reason: 'reveal-required',
    });
    const now = Date.now();
    assert.deepEqual(
      secretCopyGate({ fieldName: 'api_key', revealedAt: now - 1000, now }).reason,
      'revealed'
    );
    assert.deepEqual(
      secretCopyGate({ fieldName: 'api_key', revealedAt: now - SECRET_REVEAL_WINDOW_MS - 1, now })
        .reason,
      'reveal-expired'
    );
  });
});

describe('print core basics', () => {
  it('page footer text validates', () => {
    assert.equal(pageFooterText(2, 5), 'Page 2 of 5');
    assert.equal(pageFooterText(0, 5), null);
    assert.equal(pageFooterText(6, 5), null);
  });
  it('severity prints as text labels', () => {
    assert.equal(severityPrintLabel('critical'), 'CRITICAL');
    assert.equal(severityPrintLabel('HIGH'), 'HIGH');
    assert.equal(severityPrintLabel('weird'), 'WEIRD');
    assert.equal(severityPrintLabel(null), 'UNKNOWN');
  });
  it('print mode classes compose', () => {
    assert.deepEqual(printModeClasses({ inkSaver: true, grayscale: true, draft: false }), [
      INK_SAVER_CLASS,
      GRAYSCALE_CLASS,
    ]);
    assert.deepEqual(printModeClasses({}), []);
  });
  it('hidden selectors registry', () => {
    assert.ok(PRINT_HIDDEN_SELECTORS.includes(`.${PR_NO_PRINT_CLASS}`));
    assert.ok(isHiddenInPrint('.pr-tooltip'));
    assert.ok(!isHiddenInPrint('.pr-header'));
  });
  it('print header data', () => {
    const h = printHeaderData({ target: 't.test', dateRange: 'd', printedAt: 123 });
    assert.equal(h.target, 't.test');
    assert.equal(h.printedAt, 123);
    assert.ok(h.brand.includes('Dark-Matter'));
  });
  it('body type is 12pt', () => {
    assert.equal(PRINT_BODY_PT, 12);
  });
});

describe('50890 expand-aware printing', () => {
  it('expanded cards print full evidence, collapsed print summaries', () => {
    const cards = [{ id: 'a', title: 'A', summary: 'sum', evidence: 'ev' }];
    const rows = expandAwarePrint(cards, ['a']);
    assert.equal(rows[0].mode, 'full');
    assert.equal(rows[0].body, 'ev');
    const rows2 = expandAwarePrint(cards, []);
    assert.equal(rows2[0].mode, 'summary');
    assert.equal(rows2[0].body, 'sum');
  });
});

describe('50891 print scope state', () => {
  it('defaults and guards invalid values', () => {
    const s = createPrintScope();
    assert.equal(s.scope, 'view');
    assert.equal(s.margins, 'normal');
    const bad = setPrintScope(s, { scope: 'bogus', margins: 'huge' });
    assert.equal(bad.scope, 'view');
    assert.equal(bad.margins, 'normal');
    assert.equal(setPrintScope(s, { scope: 'all', grayscale: true }).scope, 'all');
  });
});

describe('50892 code wrapping', () => {
  it('wraps long lines and numbers them', () => {
    const lines = wrapCodeLines('short\n' + 'x'.repeat(200), 90);
    assert.equal(lines[0].wrapped, false);
    assert.equal(lines[0].no, 1);
    const wrapped = lines.filter(l => l.no === 2);
    assert.ok(wrapped.length >= 3);
    assert.ok(wrapped.some(l => l.continuation));
    assert.ok(wrapped.every(l => l.text.length <= 90));
  });
});

describe('50893 screenshots', () => {
  it('builds figures and clamps width', () => {
    assert.equal(screenshotFigure({}), null);
    const f = screenshotFigure({ src: 's.png', maxWidthPx: 5000 });
    assert.equal(f.maxWidthPx, 1200);
    assert.equal(f.caption, 'Screenshot');
  });
});

describe('50894 TOC', () => {
  it('assigns page numbers from line counts', () => {
    const toc = buildPrintToc([
      { id: 'a', title: 'A', lines: 30 },
      { id: 'b', title: 'B', lines: 120 },
      { id: 'c', title: 'C', lines: 10 },
    ]);
    assert.deepEqual(
      toc.map(t => t.page),
      [1, 2, 5]
    );
  });
});

describe('50896/50897 links and charts', () => {
  it('link text shows href', () => {
    assert.equal(linkPrintText('live hunt', 'https://x.test/h'), 'live hunt (https://x.test/h)');
    assert.equal(linkPrintText('t', null), 't');
  });
  it('chart labels carry values and pct, sorted', () => {
    const rows = chartPrintLabels([
      { label: 'Low', value: 1 },
      { label: 'High', value: 3 },
    ]);
    assert.equal(rows[0].label, 'High');
    assert.equal(rows[0].pct, 75);
    assert.equal(rows[1].pct, 25);
  });
});

describe('50901 condensed timeline', () => {
  it('sorts chronologically', () => {
    const rows = timelinePrintList([
      { ts: 20, label: 'b' },
      { ts: 10, label: 'a' },
    ]);
    assert.deepEqual(
      rows.map(r => r.label),
      ['a', 'b']
    );
  });
});

describe('50903/50904 sections and margins', () => {
  it('filters printable sections', () => {
    const t = sectionPrintTargets({
      sections: [
        { id: 'findings', title: 'F' },
        { id: 'nope', title: 'N' },
      ],
    });
    assert.deepEqual(t, [{ id: 'findings', title: 'F' }]);
    assert.ok(PRINTABLE_SECTIONS.includes('glossary'));
  });
  it('margin presets', () => {
    assert.equal(marginFor('narrow'), '12mm');
    assert.equal(marginFor('normal'), PRINT_MARGINS.normal);
    assert.equal(marginFor('bogus'), '18mm');
  });
});

describe('50906/50907 headers and classification', () => {
  it('filter-aware header', () => {
    assert.equal(
      filterAwareHeader({ total: 42, shown: 7 }),
      'printing 7 of 42 findings (filtered)'
    );
    assert.equal(filterAwareHeader({ total: 42, shown: 42 }), 'printing 42 findings');
    assert.equal(filterAwareHeader({ total: 1, shown: 1 }), 'printing 1 finding');
  });
  it('classification labels', () => {
    assert.equal(classificationLabel('confidential'), 'CONFIDENTIAL');
    assert.equal(classificationLabel('bogus'), 'UNCLASSIFIED');
    assert.deepEqual(CLASSIFICATIONS.length, 4);
  });
  it('draft watermark text', () => {
    assert.ok(DRAFT_WATERMARK_TEXT.includes('DRAFT'));
  });
});

describe('50908 QR encoder', () => {
  it('encodes short text at version 1 (21x21)', () => {
    const qr = qrEncodeUrl('hi');
    assert.equal(qr.ok, true);
    assert.equal(qr.version, 1);
    assert.equal(qr.size, 21);
    assert.equal(qr.modules.length, 21);
  });
  it('has correct finder patterns', () => {
    const { modules } = qrEncodeUrl('https://app.test/hunts/4821');
    assert.equal(modules[0][0], 1);
    assert.equal(modules[0][6], 1);
    assert.equal(modules[6][6], 1);
    assert.equal(modules[1][1], 0);
    assert.equal(modules[2][2], 1);
    assert.equal(modules[0][7], 0); // separator
    assert.equal(modules[7][0], 0);
  });
  it('has timing patterns and dark module', () => {
    const { modules, size } = qrEncodeUrl('test');
    assert.equal(modules[6][8], 1);
    assert.equal(modules[6][9], 0);
    assert.equal(modules[8][6], 1);
    assert.equal(modules[9][6], 0);
    assert.equal(modules[size - 8][8], 1);
  });
  it('is deterministic and picks versions by length', () => {
    const a = qrEncodeUrl('https://app.test/hunts/4821');
    const b = qrEncodeUrl('https://app.test/hunts/4821');
    assert.deepEqual(a.modules, b.modules);
    assert.ok(qrEncodeUrl('x'.repeat(100)).version >= 5);
    assert.ok(qrEncodeUrl('x'.repeat(30)).size > 21);
  });
  it('format info decodes to EC level L and the chosen mask', () => {
    const qr = qrEncodeUrl('format-check');
    const bits = [
      [8, 0],
      [8, 1],
      [8, 2],
      [8, 3],
      [8, 4],
      [8, 5],
      [8, 7],
      [8, 8],
      [7, 8],
      [5, 8],
      [4, 8],
      [3, 8],
      [2, 8],
      [1, 8],
      [0, 8],
    ].map(([r, c]) => qr.modules[r][c]);
    let raw = 0;
    for (const bit of bits) raw = (raw << 1) | bit;
    const data = raw ^ 0b101010000010010;
    assert.equal((data >> 13) & 0b11, 0b01); // EC level L
    assert.equal((data >> 10) & 0b111, qr.mask);
  });
  it('rejects empty and overlong payloads', () => {
    assert.equal(qrEncodeUrl('').ok, false);
    const tooLong = qrEncodeUrl('x'.repeat(QR_MAX_BYTES + 1));
    assert.equal(tooLong.ok, false);
    assert.equal(tooLong.reason, 'too-long');
    assert.equal(qrEncodeUrl('x'.repeat(QR_MAX_BYTES)).ok, true);
  });
  it('renders SVG', () => {
    const qr = qrEncodeUrl('svg-test');
    const svg = qrToSvg(qr.modules);
    assert.ok(svg.startsWith('<svg'));
    assert.ok(svg.includes('<rect'));
  });
});

describe('50909/50910 summaries and graph lists', () => {
  it('splits summaries into two balanced columns', () => {
    const paras = ['a'.repeat(100), 'b'.repeat(100), 'c'.repeat(100)];
    const { left, right } = splitSummaryColumns(paras);
    assert.ok(left.length >= 1 && right.length >= 1);
    assert.equal(left.length + right.length, 3);
  });
  it('flattens chain graphs to node lists', () => {
    const rows = chainGraphToList(
      [
        { id: 'a', label: 'XSS', kind: 'vuln' },
        { id: 'b', label: 'ATO', kind: 'impact' },
      ],
      [{ from: 'a', to: 'b', label: 'enables' }]
    );
    assert.equal(rows[0].outgoing[0].to, 'b');
    assert.equal(rows[1].incoming[0].from, 'a');
  });
});

describe('50912/50913 appendix and pdf guidance', () => {
  it('audit trail sorts by time', () => {
    const rows = auditTrailAppendix([
      { ts: 5, actor: 'x', action: 'b' },
      { ts: 1, actor: 'y', action: 'a' },
    ]);
    assert.equal(rows[0].action, 'a');
  });
  it('pdf guidance detects browsers', () => {
    const g = pdfGuidance('Mozilla/5.0 Chrome/120.0');
    assert.equal(g.browser, 'Google Chrome');
    assert.equal(g.steps.length, 5);
    assert.ok(g.settings.backgrounds.includes('ON'));
    assert.equal(pdfGuidance('Firefox/120').browser, 'Mozilla Firefox');
  });
});

describe('50915/50916/50917 sections, checklists, diffs', () => {
  it('page break plan', () => {
    const plan = sectionPageBreakPlan(
      [
        { severity: 'critical', count: 1 },
        { severity: 'high', count: 2 },
      ],
      true
    );
    assert.equal(plan[0].breakBefore, false);
    assert.equal(plan[1].breakBefore, true);
    assert.equal(sectionPageBreakPlan([{ severity: 'x' }], false)[0].breakBefore, false);
  });
  it('checklist rows print empty boxes', () => {
    const rows = remediationChecklistRows([{ id: '1', text: 'fix it' }]);
    assert.equal(rows[0].box, '☐');
  });
  it('stacked diff finds changed middles', () => {
    const d = stackedDiff('a\nb\nc', 'a\nB\nc');
    assert.equal(d.changed, true);
    assert.deepEqual(d.before, ['b']);
    assert.deepEqual(d.after, ['B']);
    assert.equal(stackedDiff('same', 'same').changed, false);
  });
});

describe('50918 one-page dashboard', () => {
  it('keeps top-priority widgets, max 8', () => {
    const widgets = Array.from({ length: 10 }, (_, i) => ({
      id: `w${i}`,
      title: `W${i}`,
      priority: 10 - i,
    }));
    const rows = dashboardOnePager(widgets);
    assert.equal(rows.length, 8);
    assert.equal(rows[0].id, 'w9');
  });
});

describe('50919 timezone-labeled timestamps', () => {
  it('names the timezone explicitly', () => {
    const s = formatPrintTimestamp(Date.UTC(2026, 9, 7, 13, 15), 'Asia/Kolkata');
    assert.ok(s.includes('(Asia/Kolkata)'));
    assert.ok(s.includes('5:30')); // UTC+5:30 offset rendered explicitly
    assert.ok(s.includes('7 Oct 2026'));
  });
  it('falls back on bad input', () => {
    assert.equal(formatPrintTimestamp('bogus', 'Asia/Kolkata'), null);
    const s = formatPrintTimestamp(Date.UTC(2026, 9, 7), 'Mars/Olympus');
    assert.ok(s.includes('UTC'));
  });
});

describe('50920 glossary', () => {
  it('extracts known terms from findings', () => {
    const g = buildGlossary([
      { title: 'Reflected XSS in /search', type: 'XSS', tags: ['SQLI', 'NOPE'] },
    ]);
    const terms = g.map(t => t.term);
    assert.ok(terms.includes('XSS'));
    assert.ok(terms.includes('SQLI'));
    assert.ok(!terms.includes('NOPE'));
    assert.ok(g.find(t => t.term === 'XSS').definition.length > 10);
    assert.deepEqual(terms, [...terms].sort());
  });
});

describe('50885 print stylesheet audit', () => {
  it('PrintSuite.css carries the required print rules', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const css = readFileSync(join(here, 'PrintSuite.css'), 'utf8');
    assert.ok(css.includes('@media print'), 'has print media block');
    assert.ok(css.includes('counter(page)'), 'page counters');
    assert.ok(css.includes('.pr-no-print'), 'hide class');
    assert.ok(css.includes('break-inside: avoid'), 'unbroken cards');
    assert.ok(css.includes('12pt'), '12pt body type');
    assert.ok(css.includes('columns: 2'), 'two-column summaries');
    assert.ok(
      css.includes("content: ' (' attr(href) ')'") || css.includes('attr(href)'),
      'visible link URLs'
    );
    assert.ok(css.includes('.pr-watermark'), 'draft watermark');
    assert.ok(css.includes('grayscale(1)'), 'grayscale toggle');
  });
});
