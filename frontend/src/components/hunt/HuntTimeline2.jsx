/**
 * HuntTimeline2.jsx — Forge wave 3, ideas 50081–50100.
 *
 * Hunt monitoring extensions: worker swimlanes, funnel, gates, scrubber,
 * heatmap, nested progress, Gantt, context meter, severity chart, rewind.
 * Dark-theme, violet accent.
 */
import React from 'react';
import './HuntTimeline2.css';
import { formatElapsed } from './HuntTimeline';

/** 50081 — Parallel worker swimlanes: each isolated worker + its current step. */
export function ParallelWorkerSwimlanes({ workers = [], className = '' }) {
  const items = workers.length > 0 ? workers : [
    { id: 'worker-1', name: 'Crawler', currentStep: 'GET /api/docs', status: 'active' },
    { id: 'worker-2', name: 'Fuzzer A', currentStep: 'XSS payloads on /search', status: 'active' },
    { id: 'worker-3', name: 'Fuzzer B', currentStep: 'SQLi probes on /login', status: 'idle' },
  ];
  return (
    <div className={`ht2-lanes ${className}`} role="status" aria-label="Worker swimlanes">
      {items.map((w) => (
        <div key={w.id} className={`ht2-lane ht2-lane-${w.status}`}>
          <span className="ht2-lane-name">{w.name}</span>
          <div className="ht2-lane-track">
            <span className="ht2-lane-step">{w.currentStep}</span>
            {w.status === 'active' && <span className="ht2-lane-dot" aria-hidden="true" />}
          </div>
        </div>
      ))}
    </div>
  );
}

/** 50082 — Quiet-period banner: reassures the agent is still working after 2 min idle. */
export function QuietPeriodBanner({ idleSeconds = 0, className = '' }) {
  return (
    <div className={`ht2-quiet ${className}`} role="status">
      <span className="ht2-quiet-dot" aria-hidden="true" />
      Agent still working — quiet for {formatElapsed(idleSeconds)}
    </div>
  );
}

/** 50083 — Findings funnel: candidates → validated → deduplicated → reported. */
export function FindingsFunnelChart({ counts = {}, className = '' }) {
  const stages = [
    { key: 'candidates', label: 'Candidates', value: counts.candidates ?? 142 },
    { key: 'validated', label: 'Validated', value: counts.validated ?? 38 },
    { key: 'deduplicated', label: 'Deduplicated', value: counts.deduplicated ?? 21 },
    { key: 'reported', label: 'Reported', value: counts.reported ?? 12 },
  ];
  const max = Math.max(...stages.map((s) => s.value), 1);
  return (
    <div className={`ht2-funnel ${className}`} role="img" aria-label={`Findings funnel: ${stages.map((s) => `${s.value} ${s.label.toLowerCase()}`).join(', ')}`}>
      {stages.map((s) => (
        <div key={s.key} className="ht2-funnel-row">
          <span className="ht2-funnel-label">{s.label}</span>
          <div className="ht2-funnel-track">
            <div className="ht2-funnel-bar" style={{ width: `${(s.value / max) * 100}%` }}>
              <span className="ht2-funnel-count">{s.value}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** 50084 — Phase-gate checklist: completion criteria with live tick marks. */
export function PhaseGateChecklist({ criteria = [], phase = 'Recon', className = '' }) {
  const items = criteria.length > 0 ? criteria : [
    { label: 'Scope confirmed', met: true },
    { label: 'Robots + sitemap fetched', met: true },
    { label: 'JS bundles parsed', met: false },
  ];
  const done = items.filter((c) => c.met).length;
  return (
    <div className={`ht2-gate ${className}`} role="status" aria-label={`${phase} gate checklist: ${done} of ${items.length} met`}>
      <span className="ht2-gate-title">{phase} gate — {done}/{items.length}</span>
      <ul>
        {items.map((c, i) => (
          <li key={i} className={c.met ? 'ht2-gate-met' : ''}>
            <span className="ht2-gate-tick" aria-hidden="true">{c.met ? '✓' : '○'}</span> {c.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 50085 — Scope-growth chip: announces new URLs discovered by the crawler. */
export function ScopeGrowthChip({ addedUrls = 0, className = '' }) {
  if (addedUrls <= 0) return null;
  return (
    <span className={`ht2-scope-chip ${className}`} role="status">
      <span aria-hidden="true">＋</span> scope grew +{addedUrls} URLs
    </span>
  );
}

/** 50086 — Timeline scrubber: drag to jump the log view to any timestamp. */
export function TimelineScrubber({ durationSecs = 3600, onScrub, className = '' }) {
  const [pos, setPos] = React.useState(0);
  const move = (v) => { setPos(v); if (onScrub) onScrub(v); };
  return (
    <div className={`ht2-scrubber ${className}`}>
      <input
        type="range" min={0} max={durationSecs} value={pos}
        onChange={(e) => move(Number(e.target.value))}
        aria-label="Scrub hunt timeline"
      />
      <span className="ht2-scrubber-time">{formatElapsed(pos)} / {formatElapsed(durationSecs)}</span>
    </div>
  );
}

/** 50087 — Activity heat calendar: heatmap across the hunt's full duration. */
export function ActivityHeatCalendar({ buckets = [], className = '' }) {
  const data = buckets.length > 0 ? buckets : Array.from({ length: 48 }, (_, i) => (i * 37) % 10);
  const max = Math.max(...data, 1);
  return (
    <div className={`ht2-heat ${className}`} role="img" aria-label="Activity heatmap across hunt duration">
      {data.map((v, i) => (
        <span key={i} className="ht2-heat-cell" style={{ opacity: 0.15 + 0.85 * (v / max) }} title={`bucket ${i}: ${v} events`} />
      ))}
    </div>
  );
}

/** 50088 — Agent-focus spotlight: one plain-language line on current work. */
export function AgentFocusSpotlight({ text = '', className = '' }) {
  return (
    <div className={`ht2-spotlight ${className}`} role="status">
      <span className="ht2-spotlight-kicker">Agent is now</span>
      <span className="ht2-spotlight-text">{text || 'testing SQL injection payloads on the login form'}</span>
    </div>
  );
}

/** 50089 — Hunt-speed comparison against the user's average. */
export function HuntSpeedComparison({ percentFaster = 0, className = '' }) {
  if (!percentFaster) return null;
  const faster = percentFaster > 0;
  return (
    <span className={`ht2-speed ${faster ? 'ht2-faster' : 'ht2-slower'} ${className}`} role="status">
      <span aria-hidden="true">{faster ? '▲' : '▼'}</span> {Math.abs(percentFaster)}% {faster ? 'faster' : 'slower'} than your usual
    </span>
  );
}

/** 50090 — Stalled-phase warning when a phase exceeds 2× its historical median. */
export function StalledPhaseWarning({ phase = '', overrun = 0, className = '' }) {
  return (
    <div className={`ht2-stalled ${className}`} role="alert">
      <span aria-hidden="true">⚠</span> {phase || 'Testing'} is taking {overrun || '2.3×'} its usual time — still working, no action needed
    </div>
  );
}

/** 50091 — Nested progress levels: phase bar → step bar → payload bar. */
export function NestedProgressLevels({ phase = {}, step = {}, payload = {}, className = '' }) {
  const rows = [
    { label: phase.label || 'Phase: Testing', pct: phase.pct ?? 45 },
    { label: step.label || 'Step: XSS fuzz', pct: step.pct ?? 70 },
    { label: payload.label || 'Payloads', pct: payload.pct ?? 30 },
  ];
  return (
    <div className={`ht2-nested ${className}`} role="status" aria-label="Nested progress">
      {rows.map((r, i) => (
        <div key={i} className={`ht2-nested-row ht2-nested-${i}`}>
          <span className="ht2-nested-label">{r.label}</span>
          <div className="ht2-nested-track"><div className="ht2-nested-fill" style={{ width: `${Math.max(0, Math.min(100, r.pct))}%` }} /></div>
          <span className="ht2-nested-pct">{Math.round(r.pct)}%</span>
        </div>
      ))}
    </div>
  );
}

/** 50092 — Queue-depth readout: tests waiting behind the current step. */
export function QueueDepthReadout({ queued = 0, className = '' }) {
  return <span className={`ht2-queue ${className}`} role="status">{queued} tests queued behind current step</span>;
}

/** 50093 — Phase-complete check burst: checkmark with a scale pulse. */
export function PhaseCompleteCheckBurst({ show = false, className = '' }) {
  if (!show) return null;
  return (
    <span className={`ht2-checkburst ${className}`} role="status" aria-label="Phase complete">
      <i aria-hidden="true">✓</i>
    </span>
  );
}

/** 50094 — Report-export overlay: "compiling N findings…" with progress. */
export function ReportExportOverlay({ findings = 0, progress = 0, className = '' }) {
  const pct = Math.max(0, Math.min(100, progress));
  return (
    <div className={`ht2-export-overlay ${className}`} role="dialog" aria-label="Generating report">
      <div className="ht2-export-box">
        <span className="ht2-export-title">Compiling {findings} findings…</span>
        <div className="ht2-export-track"><div className="ht2-export-fill" style={{ width: `${pct}%` }} /></div>
        <span className="ht2-export-pct">{Math.round(pct)}%</span>
      </div>
    </div>
  );
}

const SEV_COLORS = { critical: '#f87171', high: '#fb923c', medium: '#facc15', low: '#60a5fa' };

/** 50095 — Per-severity discovery chart: stacked area of findings over time. */
export function PerSeverityDiscoveryChart({ series = [], width = 320, height = 120, className = '' }) {
  const sev = ['critical', 'high', 'medium', 'low'];
  const data = series.length > 0 ? series : Array.from({ length: 24 }, (_, i) => ({
    critical: Math.max(0, Math.round(Math.sin(i / 3) * 2 + 2)),
    high: Math.max(0, Math.round(Math.cos(i / 4) * 3 + 4)),
    medium: Math.max(0, Math.round(Math.sin(i / 5 + 1) * 4 + 6)),
    low: Math.max(0, Math.round(Math.cos(i / 6 + 2) * 5 + 8)),
  }));
  const n = data.length;
  const totals = data.map((d) => sev.reduce((s, k) => s + d[k], 0));
  const max = Math.max(...totals, 1);
  const stepX = width / (n - 1);
  const y = (v) => height - 6 - (v / max) * (height - 12);
  let acc = data.map(() => 0);
  const layers = sev.map((k) => {
    const tops = data.map((d, i) => acc[i] + d[k]);
    const bottom = acc.map((v, i) => `L${(i * stepX).toFixed(1)},${y(v).toFixed(1)}`).reverse().join(' ');
    const path = `${tops.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * stepX).toFixed(1)},${y(v).toFixed(1)}`).join(' ')} ${bottom} Z`;
    acc = tops;
    return { k, path };
  });
  return (
    <div className={`ht2-sevchart ${className}`} role="img" aria-label="Findings discovered over time by severity">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        {layers.map((l) => <path key={l.k} d={l.path} fill={SEV_COLORS[l.k]} fillOpacity={0.55} />)}
      </svg>
      <div className="ht2-sevchart-legend">
        {sev.map((k) => <span key={k}><i style={{ background: SEV_COLORS[k] }} aria-hidden="true" />{k}</span>)}
      </div>
    </div>
  );
}

/** 50096 — Resume catch-up summary for returning users. */
export function ResumeCatchUpSummary({ newSteps = 0, newFindings = 0, className = '' }) {
  if (newSteps === 0 && newFindings === 0) return null;
  return (
    <div className={`ht2-resume ${className}`} role="status">
      Welcome back — {newSteps} new steps, {newFindings} new findings since you left
    </div>
  );
}

/** 50097 — Gantt-style per-step duration bars per phase (post-hunt review). */
export function GanttStyleStepBars({ phases = [], className = '' }) {
  const items = phases.length > 0 ? phases : [
    { phase: 'Recon', steps: [{ label: 'DNS enum', start: 0, dur: 8 }, { label: 'Crawl', start: 8, dur: 20 }] },
    { phase: 'Testing', steps: [{ label: 'XSS fuzz', start: 28, dur: 15 }, { label: 'SQLi', start: 43, dur: 12 }] },
  ];
  const total = Math.max(1, ...items.flatMap((p) => p.steps.map((s) => s.start + s.dur)));
  return (
    <div className={`ht2-gantt ${className}`} role="img" aria-label="Step durations per phase">
      {items.map((p) => (
        <div key={p.phase} className="ht2-gantt-row">
          <span className="ht2-gantt-phase">{p.phase}</span>
          <div className="ht2-gantt-track">
            {p.steps.map((s, i) => (
              <span
                key={i} className="ht2-gantt-bar"
                style={{ left: `${(s.start / total) * 100}%`, width: `${(s.dur / total) * 100}%` }}
                title={`${s.label}: ${s.dur} min`}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** 50098 — Context-usage meter: token/context-window pressure during long hunts. */
export function ContextUsageMeter({ used = 0, total = 128000, className = '' }) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const hot = pct >= 85;
  return (
    <div className={`ht2-ctx ${className}`} role="meter" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Context usage">
      <span className="ht2-ctx-label">context</span>
      <div className="ht2-ctx-track"><div className={`ht2-ctx-fill ${hot ? 'ht2-ctx-hot' : ''}`} style={{ width: `${pct}%` }} /></div>
      <span className="ht2-ctx-pct">{(used / 1000).toFixed(0)}k / {(total / 1000).toFixed(0)}k</span>
    </div>
  );
}

/** 50099 — Phase-rewind button: visually restarts a phase from its checkpoint. */
export function PhaseRewindButton({ phase = '', onRewind, className = '' }) {
  return (
    <button type="button" className={`ht2-rewind ${className}`} onClick={onRewind} aria-label={`Restart ${phase || 'phase'} from checkpoint`}>
      <span aria-hidden="true">↺</span> Rewind{phase ? ` ${phase}` : ''}
    </button>
  );
}

/** 50100 — Critical-finding pulse: subtle, never confetti. */
export function CriticalFindingPulse({ active = false, className = '' }) {
  if (!active) return null;
  return (
    <span className={`ht2-crit-pulse ${className}`} role="status" aria-label="New critical finding">
      <i aria-hidden="true" /> critical finding
    </span>
  );
}
