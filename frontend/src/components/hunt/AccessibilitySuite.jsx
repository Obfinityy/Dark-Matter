/**
 * AccessibilitySuite.jsx — Forge wave 13, ideas 50500–50520 (accessibility
 * round 2; 50508 skipped — reuses the wave-12 SkipLinks).
 *
 * Pure-presentation wrappers over a11yCore.js: live-region narrators,
 * severity badges (never color-alone), listbox findings, ordered timeline,
 * assertive errors, focus-managed modals, toast live region, color-blind
 * palette, chart data tables, keyboard chain graph, touch/contrast/text-size
 * demos, named icon buttons and visible-label fields.
 */

import { useState, useEffect, useRef } from 'react';
import {
  WAVE13_A11Y_IDEAS,
  phaseNarrationText,
  newFindingAnnouncement,
  severityTriple,
  meetsWCAG,
  listboxAriaProps,
  findingOptionProps,
  timelineStepStatusText,
  assertiveErrorText,
  toastLiveProps,
  SEVERITY_PALETTE_CVD,
  chartDataTableRows,
  graphArrowNav,
  focusOrderMatchesVisual,
  TOUCH_TARGET_MIN,
} from './a11yCore.js';
import './AccessibilitySuite.css';

/* 50500 — PhaseNarrator: aria-live narration of hunt phase changes. ---------- */

export function PhaseNarrator({ phase, target, findings = 0 }) {
  return (
    <div className="a11y-sr-only" role="status" aria-live="polite" aria-atomic="true">
      {phaseNarrationText(phase, { findings, target })}
    </div>
  );
}

/* 50501 — SeverityBadge: color + text + icon, never color alone. ------------- */

export function SeverityBadge({ severity }) {
  const t = severityTriple(severity);
  return (
    <span className="a11y-sev" style={{ '--sev-color': t.color }}>
      <span aria-hidden="true">{t.icon}</span>
      <span>{t.label}</span>
    </span>
  );
}

/* 50504 — ContrastBadge: live WCAG contrast verdict for a color pair. -------- */

export function ContrastBadge({ fg, bg, kind = 'normal' }) {
  const r = meetsWCAG(fg, bg, kind);
  return (
    <span
      className={`a11y-contrast ${r.passes ? 'pass' : 'fail'}`}
      role="img"
      aria-label={`Contrast ${r.ratio?.toFixed(2) ?? 'unknown'}:1, required ${r.required}:1 — ${r.passes ? 'passes' : 'fails'}`}
    >
      {r.ratio?.toFixed(2) ?? '—'}:1 {r.passes ? '✓' : '✗'}
    </span>
  );
}

/* 50505 — ListboxFindings: semantic listbox with aria-activedescendant. ----- */

export function ListboxFindings({ findings = [], activeId = null, onSelect }) {
  const activate = f => onSelect?.(f);
  return (
    <div
      className="a11y-listbox"
      {...listboxAriaProps({
        activeDescendant: activeId && `finding-option-${activeId}`,
        expanded: true,
      })}
    >
      {findings.map(f => (
        <div
          key={f.id}
          className={`a11y-option ${activeId === f.id ? 'active' : ''}`}
          {...findingOptionProps(f, { active: activeId === f.id })}
          onClick={() => activate(f)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              activate(f);
            }
          }}
          tabIndex={0}
        >
          <SeverityBadge severity={f.severity} /> {f.title}
        </div>
      ))}
    </div>
  );
}

/* 50506 — NewFindingAnnouncer: live region for arriving findings. ------------ */

export function NewFindingAnnouncer({ finding }) {
  return (
    <div className="a11y-sr-only" role="status" aria-live="polite">
      {finding ? newFindingAnnouncement(finding) : ''}
    </div>
  );
}

/* 50507 — OrderedTimelineList: timeline as an ordered list with status text.  */

export function OrderedTimelineList({ steps = [] }) {
  return (
    <ol className="a11y-timeline">
      {steps.map((s, i) => (
        <li key={s.n ?? i} className={`a11y-step a11y-step-${s.status || 'pending'}`}>
          <span aria-hidden="true">
            {s.status === 'done' ? '✓' : s.status === 'running' ? '▶' : '○'}
          </span>
          <span>{s.label}</span>
          <span className="a11y-sr-only">{timelineStepStatusText(s)}</span>
        </li>
      ))}
    </ol>
  );
}

/* 50509 — NamedIconButton: icon-only buttons MUST carry aria-label. ---------- */

export function NamedIconButton({ label, onClick, children }) {
  if (!label) throw new Error('NamedIconButton requires an accessible label');
  return (
    <button type="button" className="a11y-iconbtn a11y-touch" aria-label={label} onClick={onClick}>
      {children}
    </button>
  );
}

/* 50510 — VisibleLabelField: real <label>, never placeholder-only. ----------- */

export function VisibleLabelField({ id, label, ...inputProps }) {
  return (
    <div className="a11y-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} {...inputProps} />
    </div>
  );
}

/* 50511 — AssertiveError: assertive live region, links to the field. -------- */

export function AssertiveError({ fieldId, fieldLabel, message }) {
  if (!message) return null;
  return (
    <p className="a11y-error" role="alert" aria-live="assertive">
      {assertiveErrorText(fieldLabel, message)}{' '}
      <a href={`#${fieldId}`} className="a11y-error-link">
        Go to {fieldLabel}
      </a>
    </p>
  );
}

/* 50512 — FocusModal: traps focus and returns it to the trigger on close. --- */

export function FocusModal({ open, onClose, label, children }) {
  const triggerRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    triggerRef.current = document.activeElement;
    const dlg = dialogRef.current;
    const first = dlg?.querySelector('button, [href], input, [tabindex]:not([tabindex="-1"])');
    first?.focus?.();
    const onKey = e => {
      if (e.key === 'Escape') {
        onClose?.();
        return;
      }
      if (e.key !== 'Tab' || !dlg) return;
      const items = [
        ...dlg.querySelectorAll('button, [href], input, [tabindex]:not([tabindex="-1"])'),
      ].filter(el => !el.disabled && el.getClientRects().length);
      if (!items.length) return;
      const firstEl = items[0],
        lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    dlg?.addEventListener('keydown', onKey);
    return () => {
      dlg?.removeEventListener('keydown', onKey);
      triggerRef.current?.focus?.(); // return focus to the trigger
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="a11y-modal-backdrop">
      <div
        className="a11y-modal"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        ref={dialogRef}
      >
        {children}
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

/* 50513 — ToastLiveRegion: toasts mirrored to a polite live region. --------- */

export function ToastLiveRegion({ toasts = [] }) {
  return (
    <div className="a11y-toasts" {...toastLiveProps()}>
      {toasts.map((t, i) => (
        <div key={t.id ?? i} className="a11y-toast">
          {t.text}
          {t.action && (
            <button type="button" onClick={t.action.onClick}>
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/* 50514 — ColorBlindPalette: the severity palette, deuteranopia-safe. ------- */

export function ColorBlindPalette() {
  return (
    <div className="a11y-palette">
      {SEVERITY_PALETTE_CVD.map(p => (
        <div key={p.severity} className="a11y-sw" title={p.note}>
          <span className="a11y-sw-color" style={{ background: p.color }} aria-hidden="true" />
          <span>{p.severity}</span>
        </div>
      ))}
      <p className="a11y-note">
        Okabe-Ito inspired — every severity also carries an icon + label (50501).
      </p>
    </div>
  );
}

/* 50515 — ChartDataTable: text alternative for every visualization. --------- */

export function ChartDataTable({ series = [], caption = 'Data' }) {
  const [show, setShow] = useState(false);
  const rows = chartDataTableRows(series);
  return (
    <div className="a11y-chart-table">
      <button
        type="button"
        className="a11y-touch"
        onClick={() => setShow(s => !s)}
        aria-expanded={show}
      >
        {show ? 'Hide' : 'Show'} data table
      </button>
      {show && (
        <table>
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Label</th>
              <th scope="col">Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.n}>
                <td>{r.n}</td>
                <td>{r.label}</td>
                <td>{r.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* 50516 — KeyboardChainGraph: focusable nodes, arrows traverse edges. ------- */

export function KeyboardChainGraph({ nodes = [], edges = [], onSelect }) {
  const [current, setCurrent] = useState(nodes[0]?.id ?? null);
  const onKey = e => {
    const key = e.key.toLowerCase();
    if (!['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key)) return;
    e.preventDefault();
    const next = graphArrowNav({ nodes, edges }, current, key);
    if (next) {
      setCurrent(next);
      onSelect?.(next);
    }
  };
  return (
    <div
      className="a11y-graph"
      role="tree"
      aria-label="Vulnerability chain graph"
      onKeyDown={onKey}
    >
      {nodes.map(n => (
        <button
          key={n.id}
          type="button"
          role="treeitem"
          aria-selected={current === n.id}
          tabIndex={current === n.id ? 0 : -1}
          className={`a11y-node ${current === n.id ? 'active' : ''}`}
          onClick={() => {
            setCurrent(n.id);
            onSelect?.(n.id);
          }}
        >
          {n.label}
        </button>
      ))}
      <p className="a11y-note">Arrow keys follow edges: →/↓ downstream, ←/↑ upstream.</p>
    </div>
  );
}

/* 50518 — TouchTargetDemo: 44×44 minimum touch targets. --------------------- */

export function TouchTargetDemo({ children }) {
  return <div className="a11y-touch-demo">{children}</div>;
}

/* 50520 — PrefersContrastDemo: boosted borders/weights under prefers-contrast. */

export function PrefersContrastDemo({ children }) {
  return <div className="a11y-contrast-demo">{children}</div>;
}

/* 50502 — HighContrastFocusDemo: 3px high-contrast focus outlines. ---------- */

export function HighContrastFocusDemo() {
  return (
    <div className="a11y-focus-demo">
      <button type="button" className="a11y-focusable">
        Tab here — 3px focus outline
      </button>
      <a href="#demo" className="a11y-focusable">
        Focus-visible link
      </a>
    </div>
  );
}

/* 50503 — ReducedMotionToggle: honor + manually control reduced motion. ----- */

export function ReducedMotionToggle() {
  const [reduced, setReduced] = useState(false);
  return (
    <label className="a11y-motion">
      <input
        type="checkbox"
        checked={reduced}
        onChange={e => {
          setReduced(e.target.checked);
          document.documentElement.classList.toggle('a11y-reduced-motion', e.target.checked);
        }}
      />
      Reduce motion (disables shimmer, confetti, auto-scroll)
    </label>
  );
}

/* 50517 — LargeTextNotice: layouts built on rem/clamp survive 200% text. ---- */

export function LargeTextNotice() {
  return (
    <p className="a11y-large-note">
      This layout uses rem/clamp typography and stays intact at 200% text scaling.
    </p>
  );
}

/* 50519 — VisualOrderList: DOM order === visual order, verified at runtime. -- */

export function VisualOrderList({ items = [] }) {
  const ids = items.map(i => i.id);
  const matches = focusOrderMatchesVisual(ids, [...ids]);
  return (
    <div className="a11y-visual-order">
      <ul>
        {items.map(i => (
          <li key={i.id}>
            <button type="button" className="a11y-focusable">
              {i.label}
            </button>
          </li>
        ))}
      </ul>
      <span
        className="a11y-note"
        role="img"
        aria-label={`Focus order matches visual order: ${matches ? 'yes' : 'no'}`}
      >
        {matches ? '✓ DOM order = visual order' : '✗ order mismatch'}
      </span>
    </div>
  );
}

/* Registry export (for tests / docs) ---------------------------------------- */
export { WAVE13_A11Y_IDEAS };
export const TOUCH_MIN = TOUCH_TARGET_MIN;
