/**
 * AccessibilityRound3.jsx — Forge wave 14, ideas 50521–50560 (accessibility
 * round 3 + entry motion).
 *
 * Real, working components over a11yRound3Core.js: live-region hunt
 * summaries, status/progress announcers, sortable table heads, roving
 * tabindex lists, keyboard sliders, chart descriptions, form error
 * summaries, timeout announcers, readability + dyslexia settings, keyboard
 * drag handles, bulk-result announcers, the accessibility statement,
 * slide-in new-finding cards, avatar caption tracks, acronym expansion,
 * scroll-margin focus wrappers, page landmarks, keyboard date inputs, and
 * an AccessibilitySettingsProvider wiring every preference together.
 */

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  WAVE14_IDEAS,
  huntSummaryText,
  ariaHiddenProps,
  statusAnnouncement,
  makeProgressAnnouncer,
  sortableHeaderProps,
  sortableAnnouncement,
  readMediaPreference,
  REDUCED_TRANSPARENCY_QUERY,
  REDUCED_DATA_QUERY,
  transparencyClass,
  reducedDataClass,
  screenshotAltText,
  avatarCaptionText,
  speakableActionName,
  shouldExitTerminal,
  terminalEscHandler,
  landmarkProps,
  timeoutAnnouncementCopy,
  SESSION_EXTEND_COPY,
  keyboardDateProps,
  parseDateInput,
  READABILITY_DEFAULTS,
  readabilityStyle,
  dyslexiaClass,
  expandAcronyms,
  scrollMarginFor,
  bulkResultAnnouncement,
  sliderStep,
  sliderSpokenValue,
  describeChart,
  formErrorSummary,
  filterAnnouncement,
  disabledButtonProps,
  typingAnnouncementText,
  dragKeyboardEquivalent,
  rovingTabIndexes,
  destructiveConfirmCopy,
  graphToNestedList,
  A11Y_STATEMENT,
  NEW_CARD_SLIDE_SPEC,
  spacing,
} from './a11yRound3Core.js';
import './AccessibilityRound3.css';

export { WAVE14_IDEAS };

/* 50521 — HuntSummaryLiveRegion: SR summary when a hunt loads. ---------------- */

export function HuntSummaryLiveRegion({ hunt = {} }) {
  return (
    <div className="a11y3-sr-only" role="status" aria-live="polite" aria-atomic="true">
      {huntSummaryText(hunt)}
    </div>
  );
}

/* 50523 — StatusAnnouncer: pause / resume / completion in the live region. ---- */

export function StatusAnnouncer({ status }) {
  const [announcement, setAnnouncement] = useState('');
  useEffect(() => {
    if (status) setAnnouncement(statusAnnouncement(status));
  }, [status]);
  return (
    <div className="a11y3-sr-only" role="status" aria-live="polite" aria-atomic="true">
      {announcement}
    </div>
  );
}

/* 50531 — ProgressAnnouncer: throttled 10%-step progress announcements. ------- */

export function ProgressAnnouncer({ percent = 0, label = '', stepPct = 10 }) {
  const announcer = useRef(null);
  const [announcement, setAnnouncement] = useState('');
  if (!announcer.current) announcer.current = makeProgressAnnouncer(stepPct);
  useEffect(() => {
    const msg = announcer.current.update(percent, label);
    if (msg) setAnnouncement(msg);
  }, [percent, label]);
  return (
    <div className="a11y3-sr-only" role="status" aria-live="polite" aria-atomic="true">
      {announcement}
    </div>
  );
}

/* 50548 — TypingAnnouncer: the agent's typing state, announced. --------------- */

export function TypingAnnouncer({ typing = false, agentName = 'Infinity AI' }) {
  return (
    <div className="a11y3-sr-only" role="status" aria-live="polite" aria-atomic="true">
      {typing ? typingAnnouncementText(agentName) : ''}
    </div>
  );
}

/* 50524 — SortableFindingsTableHead: proper th scope + sort semantics. -------- */

export function SortableFindingsTableHead({ columns = [], sort = {}, onSort, onAnnounce }) {
  const handleSort = (col) => {
    if (!col.sortable) return;
    const direction = sort.id === col.id && sort.direction === 'asc' ? 'desc' : 'asc';
    if (onAnnounce) onAnnounce(sortableAnnouncement(col, direction));
    if (onSort) onSort({ id: col.id, direction });
  };
  return (
    <thead>
      <tr>
        {columns.map((col) => {
          const props = sortableHeaderProps(col, sort);
          const sorted = sort.id === col.id;
          return (
            <th key={col.id} scope={props.scope} aria-sort={props['aria-sort'] || undefined}>
              {col.sortable ? (
                <button
                  type="button"
                  className="a11y3-sortbtn"
                  onClick={() => handleSort(col)}
                  aria-label={`${props['aria-label']}${sorted ? `, currently ${sort.direction === 'desc' ? 'descending' : 'ascending'}` : ''}`}
                >
                  {col.label}
                  <span {...ariaHiddenProps(true)} className="a11y3-sortarrow">
                    {sorted ? (sort.direction === 'desc' ? ' ▼' : ' ▲') : ' ↕'}
                  </span>
                </button>
              ) : (
                col.label
              )}
            </th>
          );
        })}
      </tr>
    </thead>
  );
}

/** Full sortable findings table: thead semantics + an external live region. --- */

export function SortableFindingsTable({ columns = [], rows = [], renderRow, caption = 'Findings' }) {
  const [sort, setSort] = useState({});
  const [announcement, setAnnouncement] = useState('');
  return (
    <div className="a11y3-tablewrap" role="region" aria-label={`${caption} table`} tabIndex={0}>
      <table className="a11y3-sorttable">
        <caption className="a11y3-sr-only">{caption}</caption>
        <SortableFindingsTableHead columns={columns} sort={sort} onSort={setSort} onAnnounce={setAnnouncement} />
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id || i}>{renderRow ? renderRow(row, sort) : null}</tr>
          ))}
        </tbody>
      </table>
      <div className="a11y3-sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </div>
  );
}

/* 50540 — RovingTabindexList: focus retained across re-renders. ---------------- */

export function RovingTabindexList({ items = [], renderItem, label = 'Findings' }) {
  const [focused, setFocused] = useState(0);
  const itemRefs = useRef([]);
  const tabIndexes = rovingTabIndexes(items.length, focused);

  useEffect(() => {
    // After a re-render, keep focus on the same logical item.
    const el = itemRefs.current[focused];
    if (el && document.activeElement && itemRefs.current.includes(document.activeElement)) {
      el.focus();
    }
  }, [items, focused]);

  const onKeyDown = (e, index) => {
    let next = null;
    if (e.key === 'ArrowDown') next = Math.min(items.length - 1, index + 1);
    else if (e.key === 'ArrowUp') next = Math.max(0, index - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    if (next !== null) {
      e.preventDefault();
      setFocused(next);
      const el = itemRefs.current[next];
      if (el) el.focus();
    }
  };

  return (
    <ul className="a11y3-roving" role="listbox" aria-label={label}>
      {items.map((item, i) => (
        <li key={item.id || i} role="presentation">
          <div
            ref={(el) => { itemRefs.current[i] = el; }}
            role="option"
            aria-selected={i === focused}
            tabIndex={tabIndexes[i]}
            onKeyDown={(e) => onKeyDown(e, i)}
            onFocus={() => setFocused(i)}
            className="a11y3-roving-item a11y3-focusable"
          >
            {renderItem ? renderItem(item, i) : String(item.title || item.id)}
          </div>
        </li>
      ))}
    </ul>
  );
}

/* 50542 — SeveritySlider: arrow-key stepping + spoken values. ------------------ */

export function SeveritySlider({ value = 50, onChange, label = 'Confidence', min = 0, max = 100, step = 5, id = 'a11y3-severity-slider' }) {
  const [announcement, setAnnouncement] = useState('');
  const handleKeyDown = (e) => {
    let dir = null;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') dir = 'up';
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') dir = 'down';
    if (!dir) return;
    e.preventDefault();
    const next = sliderStep(value, dir, { min, max, step });
    setAnnouncement(sliderSpokenValue(next, label));
    if (onChange) onChange(next);
  };
  return (
    <div className="a11y3-slider">
      <label htmlFor={id} className="a11y3-slider-label">{label}</label>
      <input
        id={id}
        type="range"
        className="a11y3-focusable"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => { if (onChange) onChange(Number(e.target.value)); }}
        onKeyDown={handleKeyDown}
        aria-valuetext={sliderSpokenValue(value, label)}
      />
      <output htmlFor={id} aria-hidden="true">{value}%</output>
      <div className="a11y3-sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </div>
  );
}

/* 50543 — DescribeChartButton: on-demand textual chart summary. ---------------- */

export function DescribeChartButton({ chart = {}, id = 'a11y3-chart-desc' }) {
  const [open, setOpen] = useState(false);
  const description = useMemo(() => describeChart(chart), [chart]);
  return (
    <div className="a11y3-chartdesc">
      <button
        type="button"
        className="a11y3-btn a11y3-focusable"
        aria-expanded={open ? 'true' : 'false'}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        {speakableActionName('describe-chart')}
      </button>
      {open && (
        <div id={id} role="region" aria-label="Chart description" className="a11y3-chartdesc-text">
          {description}
        </div>
      )}
    </div>
  );
}

/* 50551 — FormErrorSummary: all errors at the top, anchored to fields. --------- */

export function FormErrorSummary({ errors = [] }) {
  const summary = formErrorSummary(errors);
  if (summary.count === 0) return null;
  return (
    <div role="alert" aria-labelledby="a11y3-errsum-heading" className="a11y3-errorsummary" tabIndex={-1}>
      <h2 id="a11y3-errsum-heading">{summary.heading}</h2>
      <ul>
        {summary.items.map((item) => (
          <li key={item.fieldId}>
            <a href={item.anchor} className="a11y3-finding-link a11y3-focusable">
              {item.label}: {item.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* 50552 — TimeoutAnnouncer: "session expires in 2 minutes" + extend. ----------- */

export function TimeoutAnnouncer({ minutesLeft = 2, onExtend }) {
  const copy = timeoutAnnouncementCopy(minutesLeft);
  const [extended, setExtended] = useState(false);
  const extend = () => {
    setExtended(true);
    if (onExtend) onExtend();
  };
  return (
    <div role="alert" className="a11y3-timeout">
      <p>{extended ? SESSION_EXTEND_COPY.extended : copy.announcement}</p>
      {!extended && minutesLeft > 0 && (
        <button type="button" className="a11y3-btn a11y3-focusable" onClick={extend}>
          {copy.extendLabel}
        </button>
      )}
    </div>
  );
}

/* 50554 — ReadabilitySettingsPanel: line-height 1.5 + letter spacing. ---------- */

export function ReadabilitySettingsPanel({ settings = {}, onChange }) {
  const s = { ...READABILITY_DEFAULTS, ...settings };
  const set = (patch) => { if (onChange) onChange({ ...s, ...patch }); };
  return (
    <fieldset className="a11y3-readability">
      <legend>Readability settings</legend>
      <label>
        Line height
        <input
          type="range" min="1" max="2" step="0.1" value={s.lineHeight}
          onChange={(e) => set({ lineHeight: Number(e.target.value) })}
          aria-valuetext={`Line height ${s.lineHeight}`}
          className="a11y3-focusable"
        />
        <span>{Number(s.lineHeight).toFixed(1)}</span>
      </label>
      <label>
        Letter spacing
        <input
          type="range" min="0" max="0.12" step="0.01" value={parseFloat(s.letterSpacing)}
          onChange={(e) => set({ letterSpacing: `${Number(e.target.value).toFixed(2)}em` })}
          aria-valuetext={`Letter spacing ${s.letterSpacing}`}
          className="a11y3-focusable"
        />
        <span>{s.letterSpacing}</span>
      </label>
      <label>
        Word spacing
        <input
          type="range" min="0" max="0.3" step="0.02" value={parseFloat(s.wordSpacing)}
          onChange={(e) => set({ wordSpacing: `${Number(e.target.value).toFixed(2)}em` })}
          aria-valuetext={`Word spacing ${s.wordSpacing}`}
          className="a11y3-focusable"
        />
        <span>{s.wordSpacing}</span>
      </label>
      <button type="button" className="a11y3-btn a11y3-focusable" onClick={() => set({ ...READABILITY_DEFAULTS })}>
        Reset to defaults
      </button>
    </fieldset>
  );
}

/* 50555 — DyslexiaToggle: switch to a dyslexia-friendly typeface. -------------- */

export function DyslexiaToggle({ enabled = false, onChange, id = 'a11y3-dyslexia-toggle' }) {
  return (
    <div className="a11y3-dyslexia-toggle">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={enabled ? 'true' : 'false'}
        className="a11y3-switch a11y3-focusable"
        onClick={() => { if (onChange) onChange(!enabled); }}
      >
        <span {...ariaHiddenProps(true)} className="a11y3-switch-knob" />
        <span className="a11y3-switch-label">Dyslexia-friendly font</span>
      </button>
      <p className="a11y3-hint">Switches body text to a weighted typeface designed for readers with dyslexia.</p>
    </div>
  );
}

/* 50550 — KeyboardDragHandle: visible focus + keyboard equivalents. ------------- */

export function KeyboardDragHandle({ dragAction = 'reorder-finding', label = 'Drag handle', onMove, onDrop }) {
  const eq = dragKeyboardEquivalent(dragAction);
  const handleKeyDown = (e) => {
    let dir = null;
    if (e.key === 'ArrowUp' && e.ctrlKey) dir = 'up';
    else if (e.key === 'ArrowDown' && e.ctrlKey) dir = 'down';
    else if (e.key === 'ArrowLeft' && e.ctrlKey) dir = 'left';
    else if (e.key === 'ArrowRight' && e.ctrlKey) dir = 'right';
    if (dir) {
      e.preventDefault();
      if (onMove) onMove(dir);
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (onDrop) onDrop();
    }
  };
  return (
    <button
      type="button"
      className="a11y3-draghandle a11y3-focusable"
      aria-label={`${label}. Keyboard: ${eq ? eq.keys : 'arrow keys'}. ${eq ? eq.description : ''}`}
      onKeyDown={handleKeyDown}
    >
      <span {...ariaHiddenProps(true)}>⠿</span>
      <span className="a11y3-sr-only">{label}</span>
    </button>
  );
}

/* 50558 — BulkActionAnnouncer: "24 findings marked reviewed". ------------------- */

export function BulkActionAnnouncer({ actionLabel = '', count = 0 }) {
  const [announcement, setAnnouncement] = useState('');
  useEffect(() => {
    if (count > 0) setAnnouncement(bulkResultAnnouncement(actionLabel, count));
  }, [actionLabel, count]);
  return (
    <div className="a11y3-sr-only" role="status" aria-live="polite" aria-atomic="true">
      {announcement}
    </div>
  );
}

/* 50559 — AccessibilityStatement: public conformance statement. ----------------- */

export function AccessibilityStatement() {
  const st = A11Y_STATEMENT;
  return (
    <article className="a11y3-statement" aria-labelledby="a11y3-statement-title">
      <h1 id="a11y3-statement-title">{st.title}</h1>
      <p className="a11y3-statement-meta">
        Conformance target: <strong>{st.conformance}</strong> · Last updated {st.updated}
      </p>
      <p>{st.summary}</p>
      <h2>What we commit to</h2>
      <ul>
        {st.commitments.map((c, i) => <li key={i}>{c}</li>)}
      </ul>
      <h2>Known limitations</h2>
      <p>{st.limitations}</p>
      <h2>Feedback</h2>
      <p>
        <a href={st.feedbackChannel.href} className="a11y3-finding-link a11y3-focusable">
          {st.feedbackChannel.label}
        </a>
      </p>
    </article>
  );
}

/* 50560 — NewFindingCard: 300ms ease-out slide-in + severity flash. -------------- */

export function NewFindingCard({ finding = {}, onOpen }) {
  const sev = String(finding.severity || 'info').toLowerCase();
  return (
    <article
      className={`a11y3-newcard a11y3-newcard--${sev}`}
      style={{ '--a11y3-slide-ms': `${NEW_CARD_SLIDE_SPEC.durationMs}ms` }}
      aria-label={`${sev} finding: ${finding.title || 'untitled'}`}
    >
      <h3 className="a11y3-newcard-title">
        <button
          type="button"
          className="a11y3-cardlink a11y3-focusable"
          onClick={() => { if (onOpen) onOpen(finding); }}
        >
          {finding.title || 'Untitled finding'}
        </button>
      </h3>
      <p className="a11y3-newcard-meta">
        {sev} · {finding.target || 'unknown target'}
      </p>
      {finding.screenshot && (
        <img src={finding.screenshot} alt={screenshotAltText(finding)} className="a11y3-newcard-shot" loading="lazy" />
      )}
    </article>
  );
}

/* 50528 — AvatarCaptionTrack: captions for every spoken avatar response. -------- */

export function AvatarCaptionTrack({ text = '', visible = true }) {
  if (!visible) return null;
  return (
    <figure className="a11y3-captions" aria-label="Avatar speech captions">
      <figcaption className="a11y3-sr-only">Spoken by the Infinity AI avatar</figcaption>
      <blockquote aria-live="polite" aria-atomic="true">{avatarCaptionText(text)}</blockquote>
    </figure>
  );
}

/* 50556 — AcronymExpander: first-use expansion for SR pronunciation. ------------ */

export function AcronymExpander({ text = '' }) {
  const { text: expanded } = expandAcronyms(text);
  return <span className="a11y3-acronyms">{expanded}</span>;
}

/* 50557 — FocusScrollMargin: sticky headers never obscure focused elements. ----- */

export function FocusScrollMargin({ children, headerHeightPx = 64, gapPx = 8 }) {
  return (
    <div className="a11y3-scrollmargin" style={{ scrollMarginTop: scrollMarginFor(headerHeightPx, gapPx) }}>
      {children}
    </div>
  );
}

/* 50532 — PageLandmarks: header / nav / main / complementary / contentinfo. ---- */

export function PageLandmarks({ header, nav, main, complementary, footer }) {
  return (
    <>
      <header {...landmarkProps('header')}>{header}</header>
      <nav {...landmarkProps('nav')}>{nav}</nav>
      <main {...landmarkProps('main')}>{main}</main>
      {complementary && <aside {...landmarkProps('complementary')}>{complementary}</aside>}
      <footer {...landmarkProps('contentinfo')}>{footer}</footer>
    </>
  );
}

/* 50547 — ChainGraphNestedList: nested-list fallback for the chain graph. ------ */

function NestedListNodes({ nodes }) {
  if (!nodes || nodes.length === 0) return null;
  return (
    <ul>
      {nodes.map((n) => (
        <li key={n.id}>
          {n.label}
          {n.cyclic && <span className="a11y3-hint"> (cycle — already listed above)</span>}
          <NestedListNodes nodes={n.children} />
        </li>
      ))}
    </ul>
  );
}

export function ChainGraphNestedList({ graph = {}, label = 'Attack chain relationships' }) {
  const tree = useMemo(() => graphToNestedList(graph), [graph]);
  return (
    <nav aria-label={label} className="a11y3-graphlist">
      <NestedListNodes nodes={tree} />
    </nav>
  );
}

/* 50553 — KeyboardDateInput: keyboard-entry fallback for date pickers. --------- */

export function KeyboardDateInput({ value = '', onChange, id = 'a11y3-date-input', label = 'Date' }) {
  const [error, setError] = useState('');
  const handleChange = (e) => {
    const v = e.target.value;
    if (v === '') { setError(''); if (onChange) onChange(''); return; }
    const parsed = parseDateInput(v);
    setError(parsed.ok ? '' : parsed.reason);
    if (parsed.ok && onChange) onChange(parsed.iso);
  };
  return (
    <div className="a11y3-dateinput">
      <label htmlFor={id}>{label} <span className="a11y3-hint">(keyboard entry)</span></label>
      <input
        id={id}
        defaultValue={value}
        onChange={handleChange}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${id}-error date-format-hint` : 'date-format-hint'}
        className="a11y3-focusable"
        {...keyboardDateProps()}
      />
      <span id="date-format-hint" className="a11y3-hint">Format: YYYY-MM-DD</span>
      {error && <span id={`${id}-error`} role="alert" className="a11y3-fielderror">{error}</span>}
    </div>
  );
}

/* 50530 — TerminalPanel: Esc always exits terminal focus. ----------------------- */

export function TerminalPanel({ children, onExit, label = 'Terminal output' }) {
  const panelRef = useRef(null);
  const openerRef = useRef(null);
  useEffect(() => {
    openerRef.current = document.activeElement;
    if (panelRef.current) panelRef.current.focus();
  }, []);
  const onKeyDown = (e) => {
    if (!shouldExitTerminal(e.key)) return;
    e.stopPropagation();
    if (onExit) onExit();
    else if (openerRef.current && openerRef.current.focus) openerRef.current.focus();
  };
  return (
    <section
      ref={panelRef}
      tabIndex={0}
      role="region"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="a11y3-terminal a11y3-focusable"
    >
      {children}
      <p className="a11y3-hint">Press Esc to leave the terminal.</p>
    </section>
  );
}

/* 50546 — DestructiveConfirm: visual + text confirmation, no haptics. ---------- */

export function DestructiveConfirm({ actionLabel = 'Delete', onConfirm, onCancel }) {
  const copy = destructiveConfirmCopy(actionLabel);
  return (
    <div role="alertdialog" aria-labelledby="a11y3-destruct-title" aria-describedby="a11y3-destruct-body" className="a11y3-destruct">
      <h2 id="a11y3-destruct-title">{copy.title}</h2>
      <p id="a11y3-destruct-body">{copy.body}</p>
      <div className="a11y3-destruct-actions">
        <button type="button" className="a11y3-btn a11y3-btn-danger a11y3-focusable" onClick={onConfirm}>
          {copy.confirmLabel}
        </button>
        <button type="button" className="a11y3-btn a11y3-focusable" onClick={onCancel}>
          {copy.cancelLabel}
        </button>
      </div>
      <div className="a11y3-sr-only" role="status" aria-live="assertive" aria-atomic="true">
        {copy.announced}
      </div>
    </div>
  );
}

/* 50538 — ExplainedDisabledButton: aria-disabled + reason tooltip. ------------- */

export function ExplainedDisabledButton({ reason, children, ...rest }) {
  return (
    <button type="button" className="a11y3-btn a11y3-focusable" {...disabledButtonProps(reason)} {...rest}>
      {children}
    </button>
  );
}

/* 50541 — FilterStatus: "Showing 7 of 42 findings" live region. ---------------- */

export function FilterStatus({ shown = 0, total = 0 }) {
  return (
    <div className="a11y3-sr-only" role="status" aria-live="polite" aria-atomic="true">
      {filterAnnouncement(shown, total)}
    </div>
  );
}

/* Settings provider: readability / dyslexia / reduced-motion / ----------------- */
/* reduced-transparency / reduced-data wired together (50525/50549/50554/50555). - */

const A11ySettingsContext = createContext(null);

export function useA11ySettings() {
  const ctx = useContext(A11ySettingsContext);
  if (!ctx) throw new Error('useA11ySettings must be used inside AccessibilitySettingsProvider');
  return ctx;
}

const SETTINGS_KEY = 'a11y3-settings';

function loadStoredSettings() {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function AccessibilitySettingsProvider({ children }) {
  const [readability, setReadability] = useState(() => ({ ...READABILITY_DEFAULTS, ...loadStoredSettings().readability }));
  const [dyslexia, setDyslexia] = useState(() => !!loadStoredSettings().dyslexia);
  const [reducedMotion] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? readMediaPreference('(prefers-reduced-motion: reduce)', window.matchMedia.bind(window))
      : false);
  const [reducedTransparency] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? readMediaPreference(REDUCED_TRANSPARENCY_QUERY, window.matchMedia.bind(window))
      : false);
  const [reducedData] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? readMediaPreference(REDUCED_DATA_QUERY, window.matchMedia.bind(window))
      : false);

  useEffect(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify({ readability, dyslexia }));
      }
    } catch { /* storage unavailable — settings stay in memory */ }
  }, [readability, dyslexia]);

  const value = useMemo(() => ({
    readability, setReadability,
    dyslexia, setDyslexia,
    reducedMotion, reducedTransparency, reducedData,
  }), [readability, dyslexia, reducedMotion, reducedTransparency, reducedData]);

  const classNames = [
    'a11y3-settings-scope',
    transparencyClass(reducedTransparency),
    reducedDataClass(reducedData),
    dyslexiaClass(dyslexia),
    reducedMotion ? 'a11y3-reduced-motion' : '',
  ].filter(Boolean).join(' ');

  return (
    <A11ySettingsContext.Provider value={value}>
      <div className={classNames} style={readabilityStyle(readability)}>
        {children}
      </div>
    </A11ySettingsContext.Provider>
  );
}

/* Low-vision spacing demo (50544): the 8px rhythm as a real layout helper. ----- */

export function SpacingRhythm({ units = 2, children, className = '' }) {
  return (
    <div className={`a11y3-rhythm ${className}`} style={{ padding: spacing(units), gap: spacing(1) }}>
      {children}
    </div>
  );
}

/* Decorative wrapper (50522): aria-hidden for decorative animation. ------------ */

export function DecorativeMotion({ children, className = '' }) {
  return (
    <div className={`a11y3-decorative ${className}`} {...ariaHiddenProps(true)}>
      {children}
    </div>
  );
}

/* Keep the terminal Esc helper import used (50530 helper re-export). ----------- */
export { terminalEscHandler };
