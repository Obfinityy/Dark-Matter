/**
 * MicrocopyTooltips.jsx — Forge wave 11, ideas 50401–50440 (tooltips half).
 *
 * 38 tooltip / hint / help-affordance components. Each maps to one idea
 * number (see header comments). Shared SmartTooltip base: hover + keyboard
 * focus triggers, Esc dismisses, aria-describedby for screen readers.
 * Words come from microcopyCore.js; this file is presentation only.
 *
 * Note: 50405 (per-page help panel) and 50437 (helpful-vote thumbs) live in
 * HelpPanel.jsx. Together the two files cover all 40 ideas.
 */

import { useState, useRef, useEffect } from 'react';
import {
  PAUSE_TOOLTIP,
  EMPTY_POC_HINT,
  shortcutTooltip,
  CHAIN_ICON_TOOLTIP,
  etaBasisText,
  fpTagExplainer,
  cvss31Score,
  cvss31Vector,
  parseCvss31Vector,
  CVSS31_METRICS,
  TIER_BADGE_TOOLTIP,
  SCOPE_GUIDANCE,
  WORKER_LANE_TOOLTIP,
  triggerRuleText,
  snapshotLabel,
  cronToEnglish,
  dedupText,
  SCRUBBER_HELP,
  MODEL_SLOT_TOOLTIPS,
  trackingParamHint,
  ASK_AGENT_EXAMPLES,
  validateTargetInput,
  EXPORT_FORMATS,
  COMPLIANCE_REQUIREMENTS,
  collaboratorLine,
  confidenceSliderHelp,
  findingsBadgeText,
  REGENERATE_HINT,
  ARCHIVED_HUNT_TOOLTIP,
  HUNT_PHASE_PREVIEWS,
  terminalCopyText,
  glossary,
  THEME_PREVIEWS,
  bulkHint,
  slaPolicyText,
  WIDGET_HELP,
  huntabilityScore,
  bellTooltip,
  DIFF_LEGEND,
  dropZoneHint,
  avatarMoodText,
} from './microcopyCore.js';
import './TooltipHelp.css';

/* Shared tooltip ------------------------------------------------------------ */

export function SmartTooltip({ text, children, position = 'top', className = '' }) {
  const [open, setOpen] = useState(false);
  const idRef = useRef(`mc-tip-${Math.random().toString(36).slice(2, 9)}`);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open ]);
  return (
    <span
      className={`mc-tip-wrap ${className}`}
      tabIndex={0}
      aria-describedby={idRef.current}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span id={idRef.current} role="tooltip" className={`mc-tip mc-tip-${position}`}>
          {text}
        </span>
      )}
    </span>
  );
}

export function HelpPopover({ title, trigger, children }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open ]);
  return (
    <span className="mc-pop-wrap" ref={boxRef}>
      <button
        type="button"
        className="mc-pop-trigger"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {trigger}
      </button>
      {open && (
        <span className="mc-pop" role="dialog" aria-label={title}>
          <span className="mc-pop-head">
            <strong>{title}</strong>
            <button type="button" className="mc-pop-x" onClick={() => setOpen(false)} aria-label="Close">
              ×
            </button>
          </span>
          <span className="mc-pop-body">{children}</span>
        </span>
      )}
    </span>
  );
}

/* 50401 — pause-button tooltip ------------------------------------------------ */

export function PauseButtonTooltip({ onPause, paused }) {
  return (
    <SmartTooltip text={PAUSE_TOOLTIP}>
      <button type="button" className="mc-btn" onClick={onPause} aria-label={paused ? 'Resume hunt' : 'Pause hunt'}>
        {paused ? '▶' : '⏸'}
      </button>
    </SmartTooltip>
  );
}

/* 50402 — empty-PoC hint ------------------------------------------------------- */

export function EmptyPocHint() {
  return <p className="mc-hint">{EMPTY_POC_HINT}</p>;
}

/* 50403 — shortcut hints in tooltips ------------------------------------------- */

export function ShortcutTooltip({ label, shortcut, children }) {
  return <SmartTooltip text={shortcutTooltip(label, shortcut)}>{children}</SmartTooltip>;
}

/* 50404 — chain-icon tooltip ---------------------------------------------------- */

export function ChainIconTooltip() {
  return (
    <SmartTooltip text={CHAIN_ICON_TOOLTIP}>
      <span className="mc-icon" aria-label="Finding relationships">🔗</span>
    </SmartTooltip>
  );
}

/* 50406 — ETA tooltip ----------------------------------------------------------- */

export function EtaTooltip({ eta, huntsUsed }) {
  return (
    <SmartTooltip text={etaBasisText(huntsUsed)}>
      <span className="mc-eta">ETA {eta || '—'}</span>
    </SmartTooltip>
  );
}

/* 50407 — false-positive tag explainer ------------------------------------------ */

export function FalsePositiveTagExplainer({ signals = [] }) {
  const info = fpTagExplainer(signals);
  return (
    <HelpPopover title={info.title} trigger={<span className="mc-fp-tag">false-positive suspect ⓘ</span>}>
      <ul className="mc-list">
        {info.signals.map((s, i) => (
          <li key={i}>
            <code>{s.signal}</code> — {s.text}
          </li>
        ))}
      </ul>
      <p className="mc-hint">{info.footer}</p>
    </HelpPopover>
  );
}

/* 50408 — interactive CVSS breakdown -------------------------------------------- */

export function CvssBreakdown({ initialVector = 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H' }) {
  const [metrics, setMetrics] = useState(() => parseCvss31Vector(initialVector));
  const result = cvss31Score(metrics);
  const set = (k, v) => setMetrics((m) => ({ ...m, [k]: v }));
  return (
    <div className="mc-cvss">
      <div className="mc-cvss-score">
        <span className="mc-cvss-num">{result.score.toFixed(1)}</span>
        <span className={`mc-sev mc-sev-${result.severity.toLowerCase()}`}>{result.severity}</span>
      </div>
      <div className="mc-cvss-grid">
        {Object.entries(CVSS31_METRICS).map(([k, meta]) => (
          <label key={k} className="mc-cvss-row">
            <span title={meta.label}>{k}</span>
            <select value={metrics[k]} onChange={(e) => set(k, e.target.value)} aria-label={meta.label}>
              {meta.options.map((o) => (
                <option key={o} value={o}>
                  {o} — {meta.help[o]}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <code className="mc-vector">{cvss31Vector(metrics)}</code>
    </div>
  );
}

/* 50409 — tier-badge tooltip ----------------------------------------------------- */

export function TierBadgeTooltip({ tier = 'Infinity' }) {
  return (
    <SmartTooltip text={TIER_BADGE_TOOLTIP}>
      <span className="mc-tier">{tier}</span>
    </SmartTooltip>
  );
}

/* 50410 — scope-input guidance ---------------------------------------------------- */

export function ScopeInputGuidance() {
  return (
    <ul className="mc-scope-guide">
      {SCOPE_GUIDANCE.map((g) => (
        <li key={g.format}>
          <strong>{g.format}:</strong> <code>{g.example}</code> — {g.note}
        </li>
      ))}
    </ul>
  );
}

/* 50411 — worker-lane tooltip ------------------------------------------------------- */

export function WorkerLaneTooltip({ lane = 'worker-1', children }) {
  return (
    <SmartTooltip text={WORKER_LANE_TOOLTIP}>
      <span className="mc-lane">{children || lane}</span>
    </SmartTooltip>
  );
}

/* 50412 — notification why-link ------------------------------------------------------ */

export function WhyLink({ ruleId }) {
  return (
    <HelpPopover title="Why am I seeing this?" trigger={<button type="button" className="mc-why">why?</button>}>
      <p>{triggerRuleText(ruleId)}</p>
    </HelpPopover>
  );
}

/* 50413 — snapshot tooltip ------------------------------------------------------------- */

export function SnapshotTooltip({ savedAt }) {
  const [label, setLabel] = useState(() => snapshotLabel(savedAt));
  useEffect(() => {
    const t = setInterval(() => setLabel(snapshotLabel(savedAt)), 30000);
    return () => clearInterval(t);
  }, [savedAt]);
  return (
    <SmartTooltip text={label}>
      <span className="mc-icon" aria-label="Snapshot">📸</span>
    </SmartTooltip>
  );
}

/* 50414 — cron-expression helper ---------------------------------------------------------- */

export function CronHelper({ value, onChange }) {
  const [expr, setExpr] = useState(value || '0 9 * * 1');
  const shown = value !== undefined ? value : expr;
  const update = (v) => {
    if (onChange) onChange(v);
    else setExpr(v);
  };
  return (
    <div className="mc-cron">
      <input
        className="mc-input"
        value={shown}
        onChange={(e) => update(e.target.value)}
        placeholder="0 9 * * 1"
        aria-label="Cron schedule"
        spellCheck={false}
      />
      <p className="mc-cron-plain">🕒 {cronToEnglish(shown)}</p>
    </div>
  );
}

/* 50415 — dedup tooltip ---------------------------------------------------------------------- */

export function DedupTooltip({ mergedCount, ruleName }) {
  return (
    <SmartTooltip text={dedupText(mergedCount, ruleName)}>
      <span className="mc-dedup">merged ×{Number(mergedCount) || 0}</span>
    </SmartTooltip>
  );
}

/* 50416 — scrubber help popover ------------------------------------------------------------------ */

export function ScrubberHelpPopover() {
  return (
    <HelpPopover title="Timeline scrubber" trigger={<button type="button" className="mc-btn">?</button>}>
      <ul className="mc-list">
        {SCRUBBER_HELP.map((h, i) => (
          <li key={i}>
            <kbd>{h.keys}</kbd> — {h.text}
          </li>
        ))}
      </ul>
    </HelpPopover>
  );
}

/* 50417 — model-slot tooltips ----------------------------------------------------------------------- */

export function ModelSlotTooltips() {
  return (
    <div className="mc-slots">
      {Object.entries(MODEL_SLOT_TOOLTIPS).map(([slot, tip]) => (
        <SmartTooltip key={slot} text={tip}>
          <span className="mc-slot">{slot}</span>
        </SmartTooltip>
      ))}
    </div>
  );
}

/* 50418 — tracking-param hint ---------------------------------------------------------------------------- */

export function TrackingParamHint({ url }) {
  const hint = trackingParamHint(url);
  if (!hint) return null;
  return <p className="mc-hint">🔗 {hint}</p>;
}

/* 50419 — ask-agent examples ---------------------------------------------------------------------------------- */

export function AskAgentExamples({ onPick }) {
  return (
    <div className="mc-examples">
      <span className="mc-examples-label">Try:</span>
      {ASK_AGENT_EXAMPLES.map((q) => (
        <button key={q} type="button" className="mc-chip" onClick={() => onPick && onPick(q)}>
          {q}
        </button>
      ))}
    </div>
  );
}

/* 50420 — fix-oriented validation ------------------------------------------------------------------------------- */

export function TargetInputWithHelp({ value, onChange, onSubmit }) {
  const [val, setVal] = useState(value || '');
  const [touched, setTouched] = useState(false);
  const shown = value !== undefined ? value : val;
  const check = validateTargetInput(shown);
  const showError = touched && !check.ok;
  const update = (v) => {
    if (onChange) onChange(v);
    else setVal(v);
  };
  return (
    <div className="mc-target">
      <input
        className={`mc-input ${showError ? 'mc-input-error' : ''}`}
        value={shown}
        onChange={(e) => update(e.target.value)}
        onBlur={() => setTouched(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onSubmit) onSubmit(shown);
        }}
        placeholder="https://example.com"
        aria-label="Hunt target URL"
        aria-invalid={showError}
        spellCheck={false}
      />
      {showError && (
        <p className="mc-field-error" role="alert">
          {check.error} <strong>Fix:</strong> {check.fix}
        </p>
      )}
    </div>
  );
}

/* 50421 — export-format tooltip -------------------------------------------------------------------------------------- */

export function ExportFormatTooltip() {
  return (
    <HelpPopover title="Which format?" trigger={<button type="button" className="mc-btn">Export ▾</button>}>
      <ul className="mc-list">
        {EXPORT_FORMATS.map((f) => (
          <li key={f.format}>
            <strong>{f.format}:</strong> {f.tradeoff}
          </li>
        ))}
      </ul>
    </HelpPopover>
  );
}

/* 50422 — compliance-badge links -------------------------------------------------------------------------------------------- */

export function ComplianceBadge({ badge }) {
  const req = COMPLIANCE_REQUIREMENTS[badge];
  if (!req) return <span className="mc-badge">{badge}</span>;
  return (
    <SmartTooltip text={req}>
      <a className="mc-badge mc-badge-link" href={`/docs/compliance#${badge.toLowerCase()}`}>
        {badge}
      </a>
    </SmartTooltip>
  );
}

/* 50423 — collaborator tooltips -------------------------------------------------------------------------------------------------- */

export function CollaboratorAvatar({ user }) {
  const initial = (user?.name || '?').charAt(0).toUpperCase();
  return (
    <SmartTooltip text={collaboratorLine(user)}>
      <span className="mc-avatar" aria-label={user?.name || 'Collaborator'}>
        {initial}
      </span>
    </SmartTooltip>
  );
}

/* 50424 — confidence-slider help ------------------------------------------------------------------------------------------------------- */

export function ConfidenceSlider({ value = 70, onChange }) {
  const [v, setV] = useState(value);
  const shown = onChange ? value : v;
  const update = (n) => {
    if (onChange) onChange(n);
    else setV(n);
  };
  return (
    <div className="mc-conf">
      <label>
        Min confidence: <strong>{shown}%</strong>
        <input
          type="range"
          min={0}
          max={100}
          value={shown}
          onChange={(e) => update(Number(e.target.value))}
          aria-label="Minimum confidence"
        />
      </label>
      <p className="mc-hint">{confidenceSliderHelp(shown)}</p>
    </div>
  );
}

/* 50425 — findings-badge tooltip ------------------------------------------------------------------------------------------------------------ */

export function FindingsBadgeTooltip({ newCount }) {
  return (
    <SmartTooltip text={findingsBadgeText(newCount)}>
      <span className="mc-badge">{Number(newCount) || 0} new</span>
    </SmartTooltip>
  );
}

/* 50426 — regenerate-button hint ------------------------------------------------------------------------------------------------------------------ */

export function RegenerateHint({ onRegenerate }) {
  return (
    <SmartTooltip text={REGENERATE_HINT}>
      <button type="button" className="mc-btn" onClick={onRegenerate}>
        ↻ Regenerate
      </button>
    </SmartTooltip>
  );
}

/* 50427 — archived-hunt tooltip ------------------------------------------------------------------------------------------------------------------------ */

export function ArchivedHuntTooltip({ children }) {
  return (
    <SmartTooltip text={ARCHIVED_HUNT_TOOLTIP}>
      <span className="mc-archived">{children || 'Archived'}</span>
    </SmartTooltip>
  );
}

/* 50428 — what-happens-next stepper ----------------------------------------------------------------------------------------------------------------------- */

export function WhatHappensNext({ current = 0 }) {
  const [active, setActive] = useState(current);
  return (
    <div className="mc-stepper">
      <p className="mc-stepper-title">What happens next</p>
      <ol className="mc-steps">
        {HUNT_PHASE_PREVIEWS.map((p, i) => (
          <li key={p.phase} className={i === active ? 'mc-step-active' : i < active ? 'mc-step-done' : ''}>
            <button type="button" className="mc-step-btn" onClick={() => setActive(i)} aria-current={i === active}>
              <span className="mc-step-n">{i + 1}</span> {p.phase}
            </button>
          </li>
        ))}
      </ol>
      <p className="mc-hint">{HUNT_PHASE_PREVIEWS[active]?.preview}</p>
    </div>
  );
}

/* 50429 — terminal-copy tooltip -------------------------------------------------------------------------------------------------------------------------------- */

export function TerminalCopyButton({ text, withTimestamps = true, onToggle }) {
  const [ts, setTs] = useState(withTimestamps);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };
  return (
    <span className="mc-termcopy">
      <SmartTooltip text={terminalCopyText(ts)}>
        <button type="button" className="mc-btn" onClick={copy}>
          {copied ? '✓ Copied' : '⧉ Copy'}
        </button>
      </SmartTooltip>
      <label className="mc-ts-toggle">
        <input
          type="checkbox"
          checked={ts}
          onChange={(e) => {
            setTs(e.target.checked);
            if (onToggle) onToggle(e.target.checked);
          }}
        />{' '}
        timestamps
      </label>
    </span>
  );
}

/* 50430 — jargon glossary ------------------------------------------------------------------------------------------------------------------------------------------- */

export function GlossaryTerm({ term, children }) {
  const def = glossary(term);
  if (!def) return <span>{children || term}</span>;
  return (
    <SmartTooltip text={def}>
      <span className="mc-glossary">{children || term}</span>
    </SmartTooltip>
  );
}

/* 50431 — theme hover previews ----------------------------------------------------------------------------------------------------------------------------------------- */

export function ThemeHoverPreviews({ themes = THEME_PREVIEWS, onSelect }) {
  const [preview, setPreview] = useState(null);
  return (
    <div className="mc-themes">
      {themes.map((t) => (
        <span
          key={t.name}
          className="mc-theme-swatch"
          tabIndex={0}
          onMouseEnter={() => setPreview(t)}
          onMouseLeave={() => setPreview(null)}
          onFocus={() => setPreview(t)}
          onBlur={() => setPreview(null)}
          onClick={() => onSelect && onSelect(t)}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && onSelect) { e.preventDefault(); onSelect(t); }
          }}
          role="button"
          aria-label={`Preview ${t.name} theme`}
        >
          <span className="mc-theme-dot" style={{ background: t.accent }} />
          {t.name}
          {preview?.name === t.name && (
            <span
              className="mc-theme-preview"
              style={{ background: t.bg, color: t.fg, borderColor: t.accent }}
            >
              <span style={{ color: t.accent }}>Aa</span> {t.name} — live preview
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

/* 50432 — bulk-action hint --------------------------------------------------------------------------------------------------------------------------------------------------- */

export function BulkActionHint({ selectedCount, children }) {
  return (
    <div className="mc-bulk">
      {children}
      <p className="mc-hint">{bulkHint(selectedCount)}</p>
    </div>
  );
}

/* 50433 — SLA-badge tooltip --------------------------------------------------------------------------------------------------------------------------------------------------------- */

export function SlaBadgeTooltip({ sla, remaining }) {
  return (
    <SmartTooltip text={slaPolicyText(sla)}>
      <span className="mc-badge mc-sla">SLA {remaining || '—'}</span>
    </SmartTooltip>
  );
}

/* 50434 — widget help affordance --------------------------------------------------------------------------------------------------------------------------------------------------------------- */

export function WidgetHelpAffordance() {
  return (
    <div className="mc-widget-help">
      <strong>What is a widget?</strong>
      <p>{WIDGET_HELP}</p>
    </div>
  );
}

/* 50435 — huntability meter --------------------------------------------------------------------------------------------------------------------------------------------------------------------- */

export function HuntabilityMeter({ value, onChange }) {
  const [target, setTarget] = useState(value || '');
  const shown = value !== undefined ? value : target;
  const update = (v) => {
    if (onChange) onChange(v);
    else setTarget(v);
  };
  const result = huntabilityScore(shown);
  return (
    <div className="mc-huntability">
      <input
        className="mc-input"
        value={shown}
        onChange={(e) => update(e.target.value)}
        placeholder="https://example.com"
        aria-label="Target URL huntability check"
        spellCheck={false}
      />
      {shown.trim() && (
        <>
          <div
            className="mc-meter"
            role="meter"
            aria-valuenow={result.score}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Huntability: ${result.label}`}
          >
            <span className="mc-meter-fill" style={{ width: `${result.score}%` }} />
          </div>
          <p className="mc-meter-label">
            <strong>{result.score}/100</strong> — {result.label}
          </p>
          <ul className="mc-list">
            {result.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/* 50436 — bell tooltip ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */

export function BellTooltip({ notifications = [] }) {
  return (
    <SmartTooltip text={bellTooltip(notifications)} position="bottom">
      <button type="button" className="mc-btn" aria-label="Notifications">
        🔔{notifications.length > 0 && <span className="mc-bell-n">{notifications.length}</span>}
      </button>
    </SmartTooltip>
  );
}

/* 50438 — diff-legend tooltip --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */

export function DiffLegendTooltip() {
  return (
    <span className="mc-diff-legend">
      {DIFF_LEGEND.map((d) => (
        <SmartTooltip key={d.kind} text={d.text}>
          <span className="mc-diff-chip">
            <span className="mc-diff-swatch" style={{ background: d.color }} />
            {d.kind}
          </span>
        </SmartTooltip>
      ))}
    </span>
  );
}

/* 50439 — drop-zone hints ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */

export function DropZoneHints({ accept, maxBytes, onFiles }) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef(null);
  const handleFiles = (files) => {
    if (onFiles) onFiles([...files]);
  };
  return (
    <div
      className={`mc-dropzone ${drag ? 'mc-dropzone-drag' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        handleFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); }
      }}
      aria-label="File drop zone"
    >
      <p>Drop files here or click to browse</p>
      <p className="mc-hint">{dropZoneHint(accept, maxBytes)}</p>
      <input
        ref={inputRef}
        type="file"
        hidden
        multiple
        accept={Array.isArray(accept) ? accept.join(',') : undefined}
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}

/* 50440 — avatar mood tooltip ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- */

export function AvatarMoodTooltip({ mood = 'waiting' }) {
  const colors = { focused: '#34d399', waiting: '#fbbf24', stuck: '#f87171' };
  return (
    <SmartTooltip text={avatarMoodText(mood)}>
      <span className="mc-mood" aria-label={`Avatar mood: ${mood}`}>
        <span className="mc-mood-dot" style={{ background: colors[mood] || colors.waiting }} />
      </span>
    </SmartTooltip>
  );
}
