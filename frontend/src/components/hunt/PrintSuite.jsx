/**
 * PrintSuite.jsx — wave 23 (ideas 50885–50920): print / export components.
 *
 * Pure logic lives in printCore.js. Presentation classes live in PrintSuite.css
 * (the dedicated @media print stylesheet, 50885).
 */
import { useMemo, useState } from 'react';
import {
  printHeaderData,
  pageFooterText,
  severityPrintLabel,
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
  marginFor,
  DRAFT_WATERMARK_TEXT,
  filterAwareHeader,
  classificationLabel,
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
  PR_NO_PRINT_CLASS,
  PR_UNBROKEN_CLASS,
} from './printCore.js';

/* 50886 + 50906 — print page header -------------------------------------- */

export function PrintHeader({ target, dateRange, brand, total, shown }) {
  const h = printHeaderData({ target, dateRange, brand });
  return (
    <header className="pr-header" data-idea="50886">
      <div className="pr-header-brand">{h.brand}</div>
      <div className="pr-header-meta">
        <span>Target: {h.target}</span>
        <span>{h.dateRange}</span>
        <span data-idea="50906">{filterAwareHeader({ total, shown })}</span>
      </div>
    </header>
  );
}

/* 50887 — page-number footer ---------------------------------------------- */

export function PrintFooter({ page, total, classification = 'INTERNAL' }) {
  const text = pageFooterText(page, total);
  return (
    <footer className="pr-footer" data-idea="50887">
      <span>{text}</span>
      <span className="pr-classification" data-idea="50907">{classificationLabel(classification)}</span>
    </footer>
  );
}

/* 50888 — text-labeled severity ------------------------------------------- */

export function SeverityPillPrint({ severity }) {
  return (
    <span className={`pr-sev pr-sev-${String(severity || 'info').toLowerCase()}`} data-idea="50888">
      {severityPrintLabel(severity)}
    </span>
  );
}

/* 50889 — hidden interactive chrome demo ---------------------------------- */

export function PrintChromeDemo() {
  return (
    <div className="pr-demo" data-idea="50889">
      <p>This paragraph prints. The button and tooltip beside it do not:</p>
      <button type="button" className="pr-no-print">I hide in print</button>
      <span className="pr-tooltip" role="tooltip">hover-only tip (hidden in print)</span>
    </div>
  );
}

/* 50890 — expand-aware printing -------------------------------------------- */

export function ExpandAwarePrintView({ cards = [], expandedIds = [] }) {
  const rows = expandAwarePrint(cards, expandedIds);
  return (
    <div data-idea="50890">
      {rows.map((r) => (
        <article key={r.id} className={`pr-card ${PR_UNBROKEN_CLASS}`}>
          <h4>{r.title} <span className="pr-mode-tag">[{r.mode}]</span></h4>
          <p>{r.body}</p>
        </article>
      ))}
    </div>
  );
}

/* 50891/50904/50900/50899/50905/50915 — print dialog ------------------------ */

export function PrintDialog({ onClose } = {}) {
  const [scope, setScope] = useState(createPrintScope());
  const previewClasses = useMemo(() => printModeClasses(scope).join(' '), [scope]);

  const doPrint = () => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.classList.remove('pr-ink-saver', 'pr-grayscale', 'pr-draft');
    for (const c of printModeClasses(scope)) root.classList.add(c);
    root.dataset.prMargins = scope.margins;
    window.print();
    if (typeof onClose === 'function') onClose();
  };

  return (
    <div className="pr-dialog" role="dialog" aria-label="Print options" data-idea="50891">
      <h3>Print report</h3>
      <fieldset>
        <legend>Scope</legend>
        <label>
          <input type="radio" name="pr-scope" checked={scope.scope === 'view'}
            onChange={() => setScope((s) => setPrintScope(s, { scope: 'view' }))} />
          Print current view
        </label>
        <label>
          <input type="radio" name="pr-scope" checked={scope.scope === 'all'}
            onChange={() => setScope((s) => setPrintScope(s, { scope: 'all' }))} />
          Expand all & print everything
        </label>
      </fieldset>
      <fieldset>
        <legend>Margins</legend>
        {['narrow', 'normal', 'wide'].map((m) => (
          <label key={m}>
            <input type="radio" name="pr-margins" checked={scope.margins === m}
              onChange={() => setScope((s) => setPrintScope(s, { margins: m }))} />
            {m} ({marginFor(m)})
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>Output</legend>
        <label><input type="checkbox" checked={scope.grayscale}
          onChange={(e) => setScope((s) => setPrintScope(s, { grayscale: e.target.checked }))} />
          Grayscale / ink-saver (50900)</label>
        <label><input type="checkbox" checked={scope.inkSaver}
          onChange={(e) => setScope((s) => setPrintScope(s, { inkSaver: e.target.checked }))} />
          Strip shadows & tints (50899)</label>
        <label><input type="checkbox" checked={scope.sectionBreaks}
          onChange={(e) => setScope((s) => setPrintScope(s, { sectionBreaks: e.target.checked }))} />
          New page per severity section (50915)</label>
        <label><input type="checkbox" checked={scope.draft}
          onChange={(e) => setScope((s) => setPrintScope(s, { draft: e.target.checked }))} />
          Draft watermark (50905)</label>
      </fieldset>
      <div className={`pr-dialog-preview ${previewClasses}`}>
        <p className="pr-preview-label">Live preview of output modes</p>
        <p>Severity <SeverityPillPrint severity="critical" /> prints as text, never color-only.</p>
      </div>
      <div className="pr-dialog-actions">
        <button type="button" onClick={doPrint}>Print</button>
        {onClose ? <button type="button" onClick={onClose}>Cancel</button> : null}
      </div>
    </div>
  );
}

/* 50892 — wrapped code printing -------------------------------------------- */

export function CodePrintBlock({ code = '', maxLen = 90 }) {
  const lines = wrapCodeLines(code, maxLen);
  return (
    <pre className="pr-code" data-idea="50892" aria-label="Code evidence">
      {lines.map((l, i) => (
        <div key={i} className={`pr-code-line${l.continuation ? ' pr-continued' : ''}`}>
          {!l.continuation ? <span className="pr-code-no">{l.no}</span> : <span className="pr-code-no" aria-hidden="true" />}
          <code>{l.text}</code>
        </div>
      ))}
    </pre>
  );
}

/* 50893 — captioned screenshots --------------------------------------------- */

export function ScreenshotFigure({ src, caption, sourceUrl, maxWidthPx }) {
  const fig = screenshotFigure({ src, caption, sourceUrl, maxWidthPx });
  if (!fig) return null;
  return (
    <figure className="pr-figure" data-idea="50893" style={{ maxWidth: fig.maxWidthPx }}>
      <img src={fig.src} alt={fig.caption} />
      <figcaption>
        {fig.caption}
        {fig.sourceUrl ? <span className="pr-src"> · Source: {fig.sourceUrl}</span> : null}
      </figcaption>
    </figure>
  );
}

/* 50894 — printed table of contents ------------------------------------------ */

export function PrintToc({ sections = [] }) {
  const toc = buildPrintToc(sections);
  if (toc.length < 1) return null;
  return (
    <nav className="pr-toc" data-idea="50894" aria-label="Table of contents">
      <h3>Contents</h3>
      <ol>
        {toc.map((t) => (
          <li key={t.id}>
            <span className="pr-toc-title">{t.title}</span>
            <span className="pr-toc-dots" aria-hidden="true" />
            <span className="pr-toc-page">{t.page}</span>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/* 50896 — visible link URLs ---------------------------------------------------- */

export function LinkPrint({ text, href }) {
  return <span className="pr-link" data-idea="50896">{linkPrintText(text, href)}</span>;
}

/* 50897 — labeled chart values --------------------------------------------------- */

export function ChartPrintLabels({ segments = [] }) {
  const rows = chartPrintLabels(segments);
  return (
    <table className="pr-chart-table" data-idea="50897">
      <caption>Chart values (printed with labels)</caption>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label}>
            <th scope="row">{r.label}</th>
            <td>{r.value}</td>
            <td>{r.pct}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* 50901 — condensed timeline print ------------------------------------------------- */

export function CondensedTimelinePrint({ events = [] }) {
  const rows = timelinePrintList(events);
  return (
    <ol className="pr-timeline" data-idea="50901">
      {rows.map((e, i) => (
        <li key={i}>
          <time>{formatPrintTimestamp(e.ts, 'UTC')}</time>
          <strong>{e.label}</strong>
          {e.detail ? <span> — {e.detail}</span> : null}
        </li>
      ))}
    </ol>
  );
}

/* 50902 — WYSIWYG print preview ------------------------------------------------------- */

export function PrintPreview({ children, className = '' }) {
  return (
    <div className={`pr-wysiwyg ${className}`} data-idea="50902" aria-label="Print preview">
      <div className="pr-wysiwyg-page">{children}</div>
      <p className="pr-note pr-no-print">Preview renders with the real print stylesheet — what you see is what prints.</p>
    </div>
  );
}

/* 50903 — per-section printing ---------------------------------------------------------- */

export function SectionPrintButtons({ report = {} }) {
  const targets = sectionPrintTargets(report);
  const printSection = (id) => {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.prSection = id;
    window.print();
    delete document.documentElement.dataset.prSection;
  };
  return (
    <div className="pr-sections pr-no-print" data-idea="50903">
      {targets.map((t) => (
        <button key={t.id} type="button" className="pr-btn" onClick={() => printSection(t.id)}>
          Print: {t.title}
        </button>
      ))}
    </div>
  );
}

/* 50905 — draft watermark ------------------------------------------------------------------ */

export function DraftWatermark({ active = true }) {
  if (!active) return null;
  return (
    <div className="pr-watermark" data-idea="50905" aria-hidden="true">
      {DRAFT_WATERMARK_TEXT}
    </div>
  );
}

/* 50908 — print QR code ----------------------------------------------------------------------- */

export function QrCodePrint({ url, label = 'Open live hunt' }) {
  const qr = useMemo(() => qrEncodeUrl(url), [url]);
  if (!qr.ok) {
    return (
      <p className="pr-note" data-idea="50908">
        QR unavailable ({qr.reason}). Live link: <LinkPrint text={label} href={url} />
      </p>
    );
  }
  const svg = qrToSvg(qr.modules, { cell: 3, margin: 2 });
  return (
    <figure className="pr-qr" data-idea="50908">
      <div dangerouslySetInnerHTML={{ __html: svg }} />
      <figcaption>{label} — scan to open the live hunt</figcaption>
    </figure>
  );
}

/* 50909 — two-column summaries -------------------------------------------------------------------- */

export function SummaryTwoColumn({ paragraphs = [] }) {
  const { left, right } = splitSummaryColumns(paragraphs);
  return (
    <div className="pr-two-col" data-idea="50909">
      <div>{left.map((p, i) => <p key={i}>{p}</p>)}</div>
      <div>{right.map((p, i) => <p key={i}>{p}</p>)}</div>
    </div>
  );
}

/* 50910 — graph-as-list print ------------------------------------------------------------------------- */

export function ChainGraphListPrint({ nodes = [], edges = [] }) {
  const rows = chainGraphToList(nodes, edges);
  return (
    <ol className="pr-graph-list" data-idea="50910" aria-label="Vulnerability chain (list fallback)">
      {rows.map((n) => (
        <li key={n.id} className={PR_UNBROKEN_CLASS}>
          <strong>{n.label}</strong> <span className="pr-kind">[{n.kind}]</span>
          {n.outgoing.length > 0 ? (
            <ul>
              {n.outgoing.map((e, i) => (
                <li key={i}>→ {e.to}{e.label ? ` (${e.label})` : ''}</li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/* 50912 — audit-trail appendix --------------------------------------------------------------------------- */

export function AuditTrailAppendix({ events = [] }) {
  const rows = auditTrailAppendix(events);
  return (
    <section className="pr-appendix" data-idea="50912" aria-label="Audit trail">
      <h3>Appendix A — Audit trail</h3>
      <table className="pr-table">
        <thead><tr><th>Time</th><th>Actor</th><th>Action</th></tr></thead>
        <tbody>
          {rows.map((e, i) => (
            <tr key={i}>
              <td>{formatPrintTimestamp(e.ts, 'UTC')}</td>
              <td>{e.actor}</td>
              <td>{e.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/* 50920 — glossary appendix --------------------------------------------------------------------------------- */

export function GlossaryAppendix({ findings = [] }) {
  const terms = buildGlossary(findings);
  if (terms.length === 0) return null;
  return (
    <section className="pr-appendix" data-idea="50920" aria-label="Glossary">
      <h3>Appendix B — Glossary</h3>
      <dl className="pr-glossary">
        {terms.map((t) => (
          <div key={t.term}>
            <dt>{t.term}</dt>
            <dd>{t.definition}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/* 50913 — save-as-PDF guidance ----------------------------------------------------------------------------------- */

export function PdfGuidancePanel() {
  const [guide] = useState(() =>
    typeof navigator !== 'undefined' ? pdfGuidance(navigator.userAgent) : pdfGuidance(''),
  );
  return (
    <div className="pr-guidance pr-no-print" data-idea="50913">
      <h4>Save as PDF — {guide.browser}</h4>
      <ol>{guide.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
      <p className="pr-note">Paper {guide.settings.paperSize} · margins {guide.settings.margins} · backgrounds {guide.settings.backgrounds}.</p>
    </div>
  );
}

/* 50915 — section page breaks demo ------------------------------------------------------------------------------------- */

export function SectionBreaksDemo({ groups = [] }) {
  const plan = sectionPageBreakPlan(groups, true);
  return (
    <div data-idea="50915">
      {plan.map((g) => (
        <section key={g.severity} className={g.breakBefore ? 'pr-break-before' : ''}>
          <h4><SeverityPillPrint severity={g.severity} /> ({g.count})</h4>
        </section>
      ))}
    </div>
  );
}

/* 50916 — printable checklists ------------------------------------------------------------------------------------------------ */

export function RemediationChecklistPrint({ items = [] }) {
  const rows = remediationChecklistRows(items);
  return (
    <ul className="pr-checklist" data-idea="50916" aria-label="Remediation checklist">
      {rows.map((r) => (
        <li key={r.id}><span className="pr-box" aria-hidden="true">{r.box}</span>{r.text}</li>
      ))}
    </ul>
  );
}

/* 50917 — stacked diff print ------------------------------------------------------------------------------------------------------ */

export function DiffPrintView({ before = '', after = '' }) {
  const d = stackedDiff(before, after);
  return (
    <div className="pr-diff" data-idea="50917">
      {!d.changed ? <p className="pr-note">No changes between versions.</p> : (
        <>
          <h4>Before</h4>
          <CodePrintBlock code={d.before.join('\n')} />
          <h4>After</h4>
          <CodePrintBlock code={d.after.join('\n')} />
        </>
      )}
    </div>
  );
}

/* 50918 — one-page dashboard print ------------------------------------------------------------------------------------------------------ */

export function DashboardOnePagerView({ widgets = [] }) {
  const rows = dashboardOnePager(widgets);
  return (
    <section className="pr-onepager" data-idea="50918" aria-label="Dashboard snapshot">
      <h3>Executive snapshot</h3>
      <div className="pr-onepager-grid">
        {rows.map((w) => (
          <article key={w.id} className={PR_UNBROKEN_CLASS}>
            <h4>{w.title}</h4>
            <p>{w.summary}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

/* 50919 — timezone-labeled timestamp ------------------------------------------------------------------------------------------------------ */

export function PrintTimestamp({ ts, timeZone }) {
  return <time className="pr-ts" data-idea="50919">{formatPrintTimestamp(ts, timeZone)}</time>;
}

/* Gallery ----------------------------------------------------------------------------------------------------------------------------------- */

const DEMO_CARDS = [
  { id: 'f1', title: 'DM-4821 — Reflected XSS', summary: 'Unescaped reflection of q in /search.', evidence: 'GET /search?q=<script>alert(1)</script> → 200, body reflects raw. Fix: context-aware output encoding.' },
  { id: 'f2', title: 'DM-4819 — Open redirect', summary: 'next param accepts arbitrary hosts.', evidence: 'GET /login?next=https://evil.test → 302 Location: https://evil.test. Fix: allow-list redirect targets.' },
];

export function PrintSuiteGallery() {
  const [dialogOpen, setDialogOpen] = useState(false);
  return (
    <section className="pr-gallery" aria-label="Print suite demos">
      <h3>Print suite (50885–50920)</h3>
      <PrintHeader target="target.test" dateRange="1–7 Oct 2026" total={42} shown={7} />
      <PrintToc sections={[
        { id: 's1', title: 'Executive summary', lines: 30 },
        { id: 's2', title: 'Findings', lines: 120 },
        { id: 's3', title: 'Timeline', lines: 20 },
      ]} />
      <div className="pr-demo-row">
        <SeverityPillPrint severity="critical" />
        <SeverityPillPrint severity="high" />
        <SeverityPillPrint severity="medium" />
        <SeverityPillPrint severity="low" />
      </div>
      <PrintChromeDemo />
      <ExpandAwarePrintView cards={DEMO_CARDS} expandedIds={['f1']} />
      <div className="pr-no-print" style={{ margin: '12px 0' }}>
        <button type="button" className="pr-btn" onClick={() => setDialogOpen(true)}>Open print dialog</button>
      </div>
      {dialogOpen ? <PrintDialog onClose={() => setDialogOpen(false)} /> : null}
      <CodePrintBlock code={'const q = req.query.q;\nres.send(`<div>Results for ${q}</div>`); // very long line that will wrap when printed so nothing is ever clipped off the page edge'} />
      <ScreenshotFigure src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" caption="Evidence screenshot" sourceUrl="https://target.test/search?q=x" />
      <p>Report link: <LinkPrint text="live hunt" href="https://app.test/hunts/4821" /></p>
      <ChartPrintLabels segments={[{ label: 'Critical', value: 3 }, { label: 'High', value: 7 }, { label: 'Medium', value: 12 }]} />
      <CondensedTimelinePrint events={[
        { ts: Date.UTC(2026, 9, 7, 10, 0), label: 'Hunt started', detail: 'target.test' },
        { ts: Date.UTC(2026, 9, 7, 10, 42), label: 'First finding', detail: 'DM-4821 XSS' },
      ]} />
      <PrintPreview>
        <p><strong>WYSIWYG preview</strong> — this box renders with print styles.</p>
      </PrintPreview>
      <SectionPrintButtons report={{ sections: PRINTABLE_SECTIONS.map((id) => ({ id, title: id })) }} />
      <DraftWatermark active={false} />
      <QrCodePrint url="https://app.test/hunts/4821" />
      <SummaryTwoColumn paragraphs={[
        'Executive summary paragraph one: the hunt covered target.test across 42 findings.',
        'Paragraph two: three critical issues need immediate remediation.',
        'Paragraph three: the remaining items are scheduled for the next sprint.',
        'Paragraph four: retest recommended after fixes land.',
      ]} />
      <ChainGraphListPrint
        nodes={[{ id: 'xss', label: 'Reflected XSS', kind: 'vuln' }, { id: 'sess', label: 'Session token in URL', kind: 'weakness' }, { id: 'ato', label: 'Account takeover', kind: 'impact' }]}
        edges={[{ from: 'xss', to: 'sess', label: 'steals' }, { from: 'sess', to: 'ato', label: 'enables' }]}
      />
      <SectionBreaksDemo groups={[{ severity: 'critical', count: 3 }, { severity: 'high', count: 7 }]} />
      <RemediationChecklistPrint items={[{ id: 'r1', text: 'Encode output in /search' }, { id: 'r2', text: 'Allow-list login redirects' }]} />
      <DiffPrintView before={'status: open\nseverity: high'} after={'status: fixed\nseverity: high'} />
      <DashboardOnePagerView widgets={[
        { id: 'w1', title: 'Active hunts', priority: 1, summary: '3 running' },
        { id: 'w2', title: 'Critical findings', priority: 2, summary: '3 open' },
      ]} />
      <AuditTrailAppendix events={[{ ts: Date.UTC(2026, 9, 7, 10, 0), actor: 'hunt-agent', action: 'hunt started' }]} />
      <GlossaryAppendix findings={[{ title: 'Reflected XSS in /search', type: 'XSS', tags: ['SQLI'] }]} />
      <PdfGuidancePanel />
      <p>Printed <PrintTimestamp ts={Date.UTC(2026, 9, 7, 13, 15)} timeZone="Asia/Kolkata" /></p>
      <PrintFooter page={1} total={4} classification="INTERNAL" />
    </section>
  );
}

export { PR_NO_PRINT_CLASS, PR_UNBROKEN_CLASS, PRINTABLE_SECTIONS };
