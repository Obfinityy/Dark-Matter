/**
 * PrintRound4.jsx — wave 24 (ideas 50921–50929): print round 4 components.
 *
 * Pure logic lives in printRound4Core.js. Each component below maps to one
 * idea and is usable in the real print pipeline (print stylesheet classes in
 * PrintRound4.css). The gallery at the bottom is a component showcase.
 */
import { useState } from 'react';
import './PrintRound4.css';
import {
  preparedByLine,
  duplexMarginCss,
  duplexPadPages,
  scopeAppendixData,
  scopeAppendixTitle,
  fullListPrint,
  cheatSheetPrintout,
  PRINT_CSS_TARGETS,
  printCssSupportNote,
  complianceHistoryRows,
  printerButtonProps,
  printFallbackNote,
  PR4_PREPARED_BY_CLASS,
  PR4_SCOPE_APPENDIX_CLASS,
  PR4_CHEAT_SHEET_CLASS,
  PR4_COMPLIANCE_CLASS,
  PR4_FULL_LIST_CLASS,
} from './printRound4Core.js';

/* 50921 — Prepared-by line ------------------------------------------------ */

export function PreparedByLine({ reviewer, role, date }) {
  return <p className={PR4_PREPARED_BY_CLASS}>{preparedByLine({ reviewer, role, date })}</p>;
}

/* 50922 — Duplex-friendly layout ------------------------------------------ */

export function DuplexLayoutNote({ pageCount = 0, marginKey = 'normal' }) {
  const padded = duplexPadPages(pageCount);
  return (
    <div className="pr4-duplex">
      <p>
        Duplex run: {pageCount} pages → {padded} printed pages
        {padded !== pageCount ? ' (blank padded for even binding)' : ''}.
      </p>
      <pre className="pr4-code">{duplexMarginCss(marginKey)}</pre>
    </div>
  );
}

/* 50923 — Scope appendix --------------------------------------------------- */

export function ScopeAppendix({ huntName, inScope = [], outOfScope = [], exclusions = [] }) {
  const rows = scopeAppendixData({ inScope, outOfScope, exclusions });
  return (
    <section className={PR4_SCOPE_APPENDIX_CLASS}>
      <h3>{scopeAppendixTitle(huntName)}</h3>
      <table>
        <thead>
          <tr>
            <th>Kind</th>
            <th>Target / rule</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.kind}</td>
              <td>{r.target}</td>
              <td>{r.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/* 50924 — Full-list print rendering ---------------------------------------- */

export function FullListPrint({ items = [], rowsPerPage = 40, renderRow }) {
  const { total, rows, estimatedPages } = fullListPrint(items, { rowsPerPage });
  return (
    <div className={PR4_FULL_LIST_CLASS}>
      <p className="pr4-meta">
        {total} rows · fully rendered for print · ≈{estimatedPages} pages
      </p>
      <div>
        {rows.map((row, i) => (
          <div key={i} className="pr4-full-row">
            {renderRow ? renderRow(row, i) : String(row.title || row.id || i)}
          </div>
        ))}
      </div>
    </div>
  );
}

/* 50925 — Shortcut cheat-sheet printout ------------------------------------ */

export function CheatSheetPrintout({ shortcuts = [] }) {
  const card = cheatSheetPrintout(shortcuts);
  return (
    <section className={PR4_CHEAT_SHEET_CLASS}>
      <h3>{card.title}</h3>
      <div className="pr4-cheat-cols">
        {card.columns.map((col, c) => (
          <ul key={c}>
            {col.map((s, i) => (
              <li key={i}>
                <kbd>{s.keys}</kbd> {s.label}
              </li>
            ))}
          </ul>
        ))}
      </div>
    </section>
  );
}

/* 50926 — Cross-browser print CSS ------------------------------------------ */

export function CrossBrowserPrintNote() {
  const [engine, setEngine] = useState('Blink');
  return (
    <div className="pr4-xbrowser">
      <p>Print stylesheet validated against:</p>
      <ul>
        {PRINT_CSS_TARGETS.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <label>
        Engine gap note:{' '}
        <select value={engine} onChange={(e) => setEngine(e.target.value)}>
          {['Blink', 'Gecko', 'WebKit'].map((e) => (
            <option key={e}>{e}</option>
          ))}
        </select>
      </label>
      <p className="pr4-note">{printCssSupportNote(engine)}</p>
    </div>
  );
}

/* 50927 — Compliance-history print ----------------------------------------- */

export function ComplianceHistoryPrint({ events = [] }) {
  const rows = complianceHistoryRows(events);
  return (
    <section className={PR4_COMPLIANCE_CLASS}>
      <h3>Compliance evidence — notification &amp; audit history</h3>
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Actor</th>
            <th>Action</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.time}</td>
              <td>{r.actor}</td>
              <td>{r.action}</td>
              <td>{r.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/* 50928 — Printer-icon print buttons ---------------------------------------- */

export function PrinterIconButton({ label, onPrint }) {
  const props = printerButtonProps(label);
  const handle = () => {
    if (onPrint) onPrint();
    else if (typeof window !== 'undefined' && window.print) window.print();
  };
  return (
    <button type="button" className={props.cssClass} onClick={handle} aria-label={props.label}>
      <span className="pr4-printer-icon" aria-hidden="true">
        🖨
      </span>
      {props.label}
    </button>
  );
}

/* 50929 — Print-stylesheet fallback note ------------------------------------ */

export function PrintFallbackNote({ browser, failed }) {
  const note = printFallbackNote({ browser, failed });
  if (!note) return null;
  return <p className="pr4-fallback">{note}</p>;
}

/* Gallery ------------------------------------------------------------------ */

const DEMO_SHORTCUTS = [
  { keys: 'Ctrl+K', label: 'Command palette' },
  { keys: 'Ctrl+/', label: 'Toggle filters' },
  { keys: 'j / k', label: 'Next / previous finding' },
  { keys: 'x', label: 'Expand finding' },
  { keys: 'm', label: 'Mark reviewed' },
  { keys: 'p', label: 'Print report' },
];

const DEMO_SCOPE = {
  huntName: 'acme-corp',
  inScope: ['*.acme.com'],
  outOfScope: [{ target: 'blog.acme.com', note: 'third-party host' }],
  exclusions: [{ rule: 'No DoS testing', reason: 'availability' }],
};

const DEMO_EVENTS = [
  { time: '07 Oct 2026 18:00', actor: 'a.sharma', action: 'hunt.started', detail: 'target acme.com' },
  { time: '07 Oct 2026 18:20', actor: 'system', action: 'finding.created', detail: 'XSS on /search' },
];

export function PrintRound4Gallery() {
  return (
    <div className="pr4-gallery">
      <h2>Print round 4 — 50921–50929</h2>
      <h3>50921 · Prepared-by line</h3>
      <PreparedByLine reviewer="A. Sharma" role="Lead reviewer" date={new Date('2026-10-07')} />
      <h3>50922 · Duplex-friendly layout</h3>
      <DuplexLayoutNote pageCount={7} />
      <h3>50923 · Scope appendix</h3>
      <ScopeAppendix {...DEMO_SCOPE} />
      <h3>50924 · Full-list print rendering</h3>
      <FullListPrint
        items={[{ title: 'XSS on /search' }, { title: 'IDOR on /api/user' }]}
        renderRow={(r) => r.title}
      />
      <h3>50925 · Shortcut cheat-sheet printout</h3>
      <CheatSheetPrintout shortcuts={DEMO_SHORTCUTS} />
      <h3>50926 · Cross-browser print CSS</h3>
      <CrossBrowserPrintNote />
      <h3>50927 · Compliance-history print</h3>
      <ComplianceHistoryPrint events={DEMO_EVENTS} />
      <h3>50928 · Printer-icon print buttons</h3>
      <PrinterIconButton label="Print report" />
      <h3>50929 · Print-stylesheet fallback note</h3>
      <PrintFallbackNote browser="Firefox" failed />
    </div>
  );
}
