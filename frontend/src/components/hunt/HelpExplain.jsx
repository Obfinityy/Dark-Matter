/**
 * HelpExplain.jsx — Forge wave 10, ideas 50395–50400.
 *
 * Explainability UX: hover tooltips and popovers that teach the UI as it is
 * used. Six named components, each with real interactive behavior —
 * keyboard-focusable triggers, dismissible popovers, persisted preferences.
 *
 * Idea map: 50395 severity pill tooltips · 50396 confidence-score popover ·
 * 50397 target-input format help · 50398 phase tooltips ·
 * 50399 risk-score breakdown popover · 50400 first-hover coach marks.
 */

import { useState, useEffect, useRef } from 'react';
import './ResilienceStates.css';
import './HelpExplain.css';

const SEVERITY_INFO = {
  critical: {
    label: 'Critical',
    color: '#f87171',
    blurb: 'Exploitable now with serious impact — treat as a drop-everything fix.',
    example: 'Example: unauthenticated remote code execution on the login endpoint.',
  },
  high: {
    label: 'High',
    color: '#fb923c',
    blurb: 'Likely exploitable with meaningful impact — fix this sprint.',
    example: 'Example: stored XSS in the comment field that runs for every visitor.',
  },
  medium: {
    label: 'Medium',
    color: '#fbbf24',
    blurb: 'Real weakness, but needs conditions or gives limited impact.',
    example: 'Example: reflected XSS that requires the victim to click a crafted link.',
  },
  low: {
    label: 'Low',
    color: '#34d399',
    blurb: 'Minor issue or hardening gap — fix when convenient.',
    example: 'Example: missing security headers on a static asset route.',
  },
  info: {
    label: 'Info',
    color: '#60a5fa',
    blurb: 'Observation, not a vulnerability — useful context for the report.',
    example: 'Example: server software version disclosed in a response header.',
  },
};

/* 50395 — severity pill tooltips -------------------------------------------- */

export function SeverityPillTooltip({ severity = 'info', count }) {
  const key = String(severity).toLowerCase();
  const info = SEVERITY_INFO[key] || SEVERITY_INFO.info;
  const [open, setOpen] = useState(false);
  return (
    <span
      className="hpx-pill-wrap"
      tabIndex={0}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      aria-describedby={`hpx-sev-${key}`}
    >
      <span className="hpx-pill" style={{ borderColor: info.color, color: info.color }}>
        {info.label}{typeof count === 'number' ? ` · ${count}` : ''}
      </span>
      {open && (
        <span className="hpx-tooltip" role="tooltip" id={`hpx-sev-${key}`}>
          <strong style={{ color: info.color }}>{info.label} severity</strong>
          <span>{info.blurb}</span>
          <span className="hpx-tooltip-example">{info.example}</span>
        </span>
      )}
    </span>
  );
}

/* 50396 — confidence-score popover -------------------------------------------- */

const CONFIDENCE_FACTORS = [
  { label: 'Signal strength', desc: 'How clearly the response matched the vulnerability pattern.' },
  { label: 'Repeatability', desc: 'Whether the PoC replayed the same result more than once.' },
  { label: 'Context checks', desc: 'False-positive filters that already ran and passed.' },
];

export function ConfidenceScorePopover({ score }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open ]);
  return (
    <span className="hpx-pop-wrap" ref={ref}>
      <span className="hpx-score">{typeof score === 'number' ? `${Math.round(score)}%` : '—'}</span>
      <button
        type="button"
        className="hpx-info-btn"
        aria-label="How is the confidence score computed?"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        ⓘ
      </button>
      {open && (
        <span className="hpx-popover" role="dialog" aria-label="Confidence score explained">
          <strong>How confidence is computed</strong>
          <span>The 0–100% score blends three signals:</span>
          <ul>
            {CONFIDENCE_FACTORS.map((f) => (
              <li key={f.label}><strong>{f.label}:</strong> {f.desc}</li>
            ))}
          </ul>
          <span className="hpx-pop-note">Above 80% is usually report-ready; below 50% deserves a manual look.</span>
        </span>
      )}
    </span>
  );
}

/* 50397 — target-input format help ----------------------------------------------- */

const TARGET_FORMATS = [
  { format: 'https://example.com', desc: 'Full website URL — most common.' },
  { format: 'https://example.com/api', desc: 'API base path — hunts endpoints under it.' },
  { format: 'https://app.example.com:8443', desc: 'Custom port is fine — include it.' },
  { format: 'http://192.168.1.10', desc: 'IP targets work too (HTTPS preferred).' },
];

export function TargetInputFormatHelp() {
  const [open, setOpen] = useState(false);
  return (
    <div className="hpx-format-help">
      <button
        type="button"
        className="hpx-format-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? '▾ Hide accepted formats' : '▸ What can I hunt?'}
      </button>
      {open && (
        <ul className="hpx-format-list">
          {TARGET_FORMATS.map((f) => (
            <li key={f.format}>
              <code className="hpx-code">{f.format}</code>
              <span className="hpx-format-desc">{f.desc}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* 50398 — phase tooltips ------------------------------------------------------------ */

const PHASE_INFO = {
  recon: { name: 'Recon', duration: '~2–5 min', desc: 'Maps subdomains, tech stack, and attack surface.' },
  scan: { name: 'Scan', duration: '~5–20 min', desc: 'Probes endpoints for SQLi, XSS, SSRF, IDOR and more.' },
  verify: { name: 'Verify', duration: '~3–10 min', desc: 'Replays findings to weed out false positives.' },
  exploit: { name: 'Exploit', duration: '~5–15 min', desc: 'Builds minimal proof-of-concept requests.' },
  report: { name: 'Report', duration: '~1–3 min', desc: 'Writes the professional bounty report.' },
};

export function PhaseTooltips({ phases = Object.keys(PHASE_INFO), activePhase }) {
  const [openKey, setOpenKey] = useState(null);
  return (
    <div className="hpx-phases" role="list" aria-label="Hunt pipeline phases">
      {phases.map((key) => {
        const info = PHASE_INFO[key] || { name: key, duration: '—', desc: 'Pipeline phase.' };
        const open = openKey === key;
        return (
          <span
            key={key}
            role="listitem"
            className={`hpx-phase ${activePhase === key ? 'hpx-phase-active' : ''}`}
            tabIndex={0}
            onMouseEnter={() => setOpenKey(key)}
            onMouseLeave={() => setOpenKey(null)}
            onFocus={() => setOpenKey(key)}
            onBlur={() => setOpenKey(null)}
            aria-describedby={`hpx-phase-${key}`}
          >
            {info.name}
            {open && (
              <span className="hpx-tooltip" role="tooltip" id={`hpx-phase-${key}`}>
                <strong>{info.name} phase</strong>
                <span>{info.desc}</span>
                <span className="hpx-tooltip-example">Typical duration: {info.duration}</span>
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

/* 50399 — risk-score breakdown popover ------------------------------------------------------- */

export function RiskScoreBreakdownPopover({ score, factors = [] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);
  const max = Math.max(1, ...factors.map((f) => f.points));
  return (
    <span className="hpx-pop-wrap" ref={ref}>
      <button
        type="button"
        className="hpx-whats-this"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Risk {typeof score === 'number' ? score.toFixed(1) : '—'} · what&rsquo;s this?
      </button>
      {open && (
        <span className="hpx-popover hpx-popover-wide" role="dialog" aria-label="Risk score breakdown">
          <strong>What makes up this risk score</strong>
          {factors.length === 0 && <span>No factor data for this finding yet.</span>}
          <ul className="hpx-factor-list">
            {factors.map((f) => (
              <li key={f.label}>
                <span className="hpx-factor-label">{f.label}</span>
                <span className="hpx-factor-track">
                  <span className="hpx-factor-fill" style={{ width: `${Math.round((f.points / max) * 100)}%` }} />
                </span>
                <span className="hpx-factor-points">+{f.points}</span>
              </li>
            ))}
          </ul>
          <span className="hpx-pop-note">Factors add up to the 0–10 score; severity bands follow CVSS-style cutoffs.</span>
        </span>
      )}
    </span>
  );
}

/* 50400 — first-hover coach marks ------------------------------------------------------------------ */

const COACH_KEY = 'infinity-ai-coach-marks-seen';

export function readCoachSeen() {
  try {
    return window.localStorage.getItem(COACH_KEY) === '1';
  } catch {
    return false;
  }
}

export function FirstHoverCoachMarks({ marks = [], onDismissAll }) {
  const [seen, setSeen] = useState(() => readCoachSeen());
  const [index, setIndex] = useState(0);
  if (seen || marks.length === 0) return null;
  const mark = marks[Math.min(index, marks.length - 1)];
  const dismiss = (persist) => {
    if (persist) {
      try { window.localStorage.setItem(COACH_KEY, '1'); } catch { /* storage unavailable */ }
    }
    setSeen(true);
    if (onDismissAll) onDismissAll(persist);
  };
  return (
    <div className="hpx-coach" role="dialog" aria-label="Quick tour tip">
      <span className="hpx-coach-step">{Math.min(index + 1, marks.length)} of {marks.length}</span>
      <strong className="hpx-coach-title">{mark.title}</strong>
      <p className="hpx-coach-body">{mark.body}</p>
      <div className="rsz-actions hpx-coach-actions">
        {index < marks.length - 1 ? (
          <button type="button" className="rsz-btn rsz-primary" onClick={() => setIndex((i) => i + 1)}>Next</button>
        ) : (
          <button type="button" className="rsz-btn rsz-primary" onClick={() => dismiss(false)}>Got it</button>
        )}
        <button type="button" className="rsz-btn rsz-secondary" onClick={() => dismiss(true)}>
          Don&rsquo;t show again
        </button>
      </div>
    </div>
  );
}

export const HELP_EXPLAIN_IDEAS = [
  { idea: 50395, name: 'SeverityPillTooltip' },
  { idea: 50396, name: 'ConfidenceScorePopover' },
  { idea: 50397, name: 'TargetInputFormatHelp' },
  { idea: 50398, name: 'PhaseTooltips' },
  { idea: 50399, name: 'RiskScoreBreakdownPopover' },
  { idea: 50400, name: 'FirstHoverCoachMarks' },
];

export default function HelpExplainIdeas() { return null; }
