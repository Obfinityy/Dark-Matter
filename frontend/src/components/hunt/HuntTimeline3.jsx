/**
 * HuntTimeline3.jsx — Forge wave 3, ideas 50101–50120.
 *
 * Finding & control extensions: confidence rings, health, breadcrumbs, gauges,
 * previews, checkpoints, trace, replay, PNG export, severity color system.
 * Dark-theme, violet accent.
 */
import React from 'react';
import './HuntTimeline3.css';

/** 50101 — Validation-confidence ring on each finding card. */
export function ValidationConfidenceRing({ confidence = 0, size = 44, className = '' }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, confidence)) / 100;
  return (
    <span className={`ht3-valring ${className}`} role="progressbar" aria-valuenow={Math.round(confidence)} aria-valuemin={0} aria-valuemax={100} aria-label="Validation confidence">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1c2333" strokeWidth={5} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#34d399" strokeWidth={5} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - p)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`} className="ht3-ring-fill"
        />
      </svg>
      <em>{Math.round(confidence)}%</em>
    </span>
  );
}

/** 50102 — Hunt-health indicator: green/amber/red from error rate + stall detection. */
export function HuntHealthIndicator({ errorRate = 0, stalled = false, className = '' }) {
  const level = stalled || errorRate > 0.2 ? 'bad' : errorRate > 0.08 ? 'warn' : 'good';
  const label = level === 'good' ? 'healthy' : level === 'warn' ? 'degraded' : 'needs attention';
  return <span className={`ht3-health ht3-health-${level} ${className}`} role="status">● {label}</span>;
}

/** 50103 — Decision breadcrumb trail explaining agent choices. */
export function DecisionBreadcrumbTrail({ decisions = [], className = '' }) {
  const items = decisions.length > 0 ? decisions : ['chose SQLi next because login form found'];
  return (
    <ol className={`ht3-crumbs ${className}`} aria-label="Agent decisions">
      {items.map((d, i) => <li key={i}>{d}</li>)}
    </ol>
  );
}

/** 50104 — Requests-per-second gauge during active testing. */
export function RequestsPerSecondGauge({ rps = 0, max = 50, className = '' }) {
  const pct = Math.max(0, Math.min(100, (rps / max) * 100));
  return (
    <div className={`ht3-rps ${className}`} role="meter" aria-valuenow={rps} aria-valuemin={0} aria-valuemax={max} aria-label="Requests per second">
      <span className="ht3-rps-value">{rps.toFixed(1)}</span>
      <span className="ht3-rps-unit">req/s</span>
      <div className="ht3-rps-track"><div className="ht3-rps-fill" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

/** 50105 — Phase hover preview: tooltip with purpose + typical duration. */
export function PhaseHoverPreview({ name = 'Recon', purpose = '', typical = '', className = '' }) {
  return (
    <span
      className={`ht3-phase-tip ${className}`} tabIndex={0}
      aria-label={`${name}: ${purpose || 'Maps the attack surface'}. Typical duration: ${typical || '2–5 min'}`}
    >
      {name}
      <span className="ht3-tip" role="tooltip">
        <strong>{name}</strong>
        <span>{purpose || 'Maps the attack surface'}</span>
        <span className="ht3-tip-dur">typical: {typical || '2–5 min'}</span>
      </span>
    </span>
  );
}

/** 50106 — Snapshot checkpoint flags on the timeline. */
export function SnapshotCheckpointFlags({ checkpoints = [], className = '' }) {
  const items = checkpoints.length > 0 ? checkpoints : [
    { at: 30, label: 'Snapshot 1' }, { at: 70, label: 'Snapshot 2' },
  ];
  return (
    <div className={`ht3-snapshots ${className}`} role="img" aria-label="State snapshots">
      <div className="ht3-snap-track" aria-hidden="true" />
      {items.map((s, i) => (
        <span key={i} className="ht3-snap-flag" style={{ left: `${s.at}%` }} title={s.label} aria-label={s.label}>⚑</span>
      ))}
    </div>
  );
}

/** 50107 — Crawler path trace: animated trace of pages as the crawler visits them. */
export function CrawlerPathTrace({ pages = [], className = '' }) {
  const items = pages.length > 0 ? pages : ['/', '/login', '/api', '/docs', '/admin'];
  const visited = Math.min(items.length, 4);
  return (
    <div className={`ht3-crawl-trace ${className}`} role="img" aria-label="Crawler path">
      {items.map((p, i) => (
        <React.Fragment key={i}>
          <span
            className={`ht3-crawl-node ${i < visited ? 'ht3-visited' : i === visited ? 'ht3-current' : ''}`}
            title={p}
          >
            {p}
          </span>
          {i < items.length - 1 && <span className={`ht3-crawl-link ${i < visited ? 'ht3-visited' : ''}`} aria-hidden="true" />}
        </React.Fragment>
      ))}
    </div>
  );
}

/** 50108 — Live time-in-phase counter ticking on each phase label. */
export function LiveTimeInPhaseCounter({ seconds = 0, className = '' }) {
  const [tick, setTick] = React.useState(seconds);
  React.useEffect(() => {
    const t = setInterval(() => setTick((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const m = Math.floor(tick / 60);
  const s = tick % 60;
  return <span className={`ht3-phase-time ${className}`} role="timer">{m}m {String(s).padStart(2, '0')}s in phase</span>;
}

/** 50109 — ETA projection cone: optimistic/pessimistic band on the timeline. */
export function EtaProjectionCone({ optimistic = '', pessimistic = '', className = '' }) {
  return (
    <div className={`ht3-cone ${className}`} role="status" aria-label={`ETA between ${optimistic || '8 min'} and ${pessimistic || '18 min'}`}>
      <div className="ht3-cone-band" aria-hidden="true" />
      <span>ETA {optimistic || '~8 min'} – {pessimistic || '~18 min'}</span>
    </div>
  );
}

/** 50110 — Step-grouping toggle: by phase, by tool, or by target host. */
export function StepGroupingToggle({ mode = 'phase', onChange, className = '' }) {
  const modes = ['phase', 'tool', 'host'];
  return (
    <div className={`ht3-group-toggle ${className}`} role="group" aria-label="Group steps by">
      {modes.map((m) => (
        <button key={m} type="button" className={mode === m ? 'ht3-active' : ''} onClick={() => onChange && onChange(m)} aria-pressed={mode === m}>
          {m}
        </button>
      ))}
    </div>
  );
}

/** 50111 — Last-action ticker in the header, updating live. */
export function LastActionTicker({ agoSecs = 2, action = '', className = '' }) {
  return (
    <span className={`ht3-last-action ${className}`} role="status">
      {agoSecs}s ago: {action || 'tested XSS on /search?q='}
    </span>
  );
}

/** 50112 — Findings-badge progress ring: count inside a filling ring. */
export function FindingsBadgeProgressRing({ count = 0, target = 20, className = '' }) {
  const p = Math.max(0, Math.min(1, target > 0 ? count / target : 0));
  const r = 13;
  const c = 2 * Math.PI * r;
  return (
    <span className={`ht3-badge ${className}`} role="status" aria-label={`${count} findings`}>
      <svg width={34} height={34} viewBox="0 0 34 34" aria-hidden="true">
        <circle cx={17} cy={17} r={r} fill="none" stroke="#1c2333" strokeWidth={4} />
        <circle
          cx={17} cy={17} r={r} fill="none" stroke="#f87171" strokeWidth={4} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - p)}
          transform="rotate(-90 17 17)" className="ht3-ring-fill"
        />
      </svg>
      <em>{count}</em>
    </span>
  );
}

const PHASE_ICONS = { recon: '🔍', testing: '⚗', chaining: '🔗', reporting: '📄' };

/** 50113 — Morphing phase icons: magnifier → flask → link → document. */
export function MorphingPhaseIcons({ phase = 'recon', className = '' }) {
  return (
    <span key={phase} className={`ht3-morph ${className}`} role="img" aria-label={`${phase} phase`}>
      {PHASE_ICONS[phase] || PHASE_ICONS.recon}
    </span>
  );
}

/** 50114 — Deep-dive indicator: 5+ minutes on one endpoint with the reason. */
export function DeepDiveIndicator({ endpoint = '', reason = '', className = '' }) {
  return (
    <span className={`ht3-deepdive ${className}`} role="status">
      <span aria-hidden="true">🎯</span> deep dive: {endpoint || '/api/graphql'} — {reason || 'complex auth flow'}
    </span>
  );
}

/** 50115 — Boring-steps filter: hides routine 200-OK checks from the step log. */
export function BoringStepsFilter({ hide = false, onToggle, className = '' }) {
  return (
    <label className={`ht3-boring ${className}`}>
      <input type="checkbox" checked={hide} onChange={(e) => onToggle && onToggle(e.target.checked)} />
      Hide routine 200-OK checks
    </label>
  );
}

/** 50116 — Actions-per-minute meter, WPM-style. */
export function ActionsPerMinuteMeter({ apm = 0, className = '' }) {
  const bars = 10;
  const lit = Math.min(bars, Math.round(apm / 12));
  return (
    <div className={`ht3-apm ${className}`} role="meter" aria-valuenow={apm} aria-valuemin={0} aria-valuemax={120} aria-label="Actions per minute">
      <span className="ht3-apm-value">{apm} apm</span>
      <span className="ht3-apm-bars" aria-hidden="true">
        {Array.from({ length: bars }).map((_, i) => <i key={i} className={i < lit ? 'ht3-on' : ''} />)}
      </span>
    </div>
  );
}

/** 50117 — Timeline infographic export: renders the hunt as a PNG via canvas. */
export function TimelineInfographicExport({ phases = [], findings = 0, className = '' }) {
  const doExport = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 630;
    const ctx = canvas.getContext('2d');
    const bg = ctx.createLinearGradient(0, 0, 1200, 630);
    bg.addColorStop(0, '#0d1119');
    bg.addColorStop(1, '#141b2d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1200, 630);
    ctx.fillStyle = '#a78bfa';
    ctx.font = '700 20px Inter, sans-serif';
    ctx.fillText('INFINITY AI · HUNT TIMELINE', 60, 70);
    ctx.fillStyle = '#c6cfdf';
    ctx.font = '800 52px Inter, sans-serif';
    ctx.fillText('Hunt complete', 60, 140);
    ctx.fillStyle = '#8b96ad';
    ctx.font = '400 24px Inter, sans-serif';
    ctx.fillText(`${findings} findings reported`, 60, 182);
    const items = phases.length > 0 ? phases : [
      { name: 'Recon', progress: 100 }, { name: 'Testing', progress: 100 },
      { name: 'Chaining', progress: 100 }, { name: 'Reporting', progress: 65 },
    ];
    const bar = (x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); };
    items.forEach((p, i) => {
      const y = 260 + i * 78;
      ctx.fillStyle = '#8b96ad';
      ctx.font = '600 20px Inter, sans-serif';
      ctx.fillText(p.name, 60, y + 6);
      ctx.fillStyle = '#1c2333';
      bar(220, y - 16, 860, 26, 13);
      ctx.fillStyle = '#8b5cf6';
      bar(220, y - 16, Math.max(26, (860 * Math.min(100, p.progress)) / 100), 26, 13);
      ctx.fillStyle = '#c6cfdf';
      ctx.font = '600 18px Inter, sans-serif';
      ctx.fillText(`${Math.round(p.progress)}%`, 1100, y + 6);
    });
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = 'hunt-timeline.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  return (
    <button type="button" className={`ht3-export ${className}`} onClick={doExport}>
      <span aria-hidden="true">🖼</span> Export timeline PNG
    </button>
  );
}

/** 50118 — Pause overlay marker: shows exactly where the hunt froze. */
export function PauseOverlayMarker({ atPercent = 0, className = '' }) {
  return (
    <span
      className={`ht3-pause-marker ${className}`} style={{ left: `${atPercent}%` }}
      role="img" aria-label={`Hunt paused at ${atPercent}%`} title="Paused here"
    >
      <i aria-hidden="true">❚❚</i>
    </span>
  );
}

const REPLAY_PHASES = ['recon', 'testing', 'chaining', 'reporting'];

/** 50119 — Journey-recap replay: replays all phases as a 10-second animation. */
export function JourneyRecapReplay({ className = '' }) {
  const [phase, setPhase] = React.useState(null);
  const [playing, setPlaying] = React.useState(false);
  const rafRef = React.useRef(null);
  const replay = () => {
    if (playing) return;
    setPlaying(true);
    const start = performance.now();
    const tick = (now) => {
      const t = (now - start) / 10000;
      if (t >= 1) { setPhase(REPLAY_PHASES[3]); setPlaying(false); return; }
      setPhase(REPLAY_PHASES[Math.floor(t * 4)]);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };
  React.useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);
  return (
    <div className={`ht3-replay ${className}`}>
      <button type="button" className="ht3-replay-btn" onClick={replay} disabled={playing}>
        {playing ? 'Replaying…' : '▶ Replay journey'}
      </button>
      <div className="ht3-replay-track" aria-hidden="true">
        {REPLAY_PHASES.map((p) => (
          <span key={p} className={`ht3-replay-phase ${phase === p ? 'ht3-now' : ''}`}>{p}</span>
        ))}
      </div>
    </div>
  );
}

/** 50120 — Severity color system: red/orange/amber/blue/gray with left-border accent. */
const SEV_STYLES = {
  critical: { label: 'Critical', color: '#f87171' },
  high: { label: 'High', color: '#fb923c' },
  medium: { label: 'Medium', color: '#facc15' },
  low: { label: 'Low', color: '#60a5fa' },
  info: { label: 'Info', color: '#9ca3af' },
};
export const SEVERITY_STYLES = SEV_STYLES;
export function SeverityColorSystem({ severity = 'medium', children, className = '' }) {
  const s = SEV_STYLES[severity] || SEV_STYLES.medium;
  return (
    <span
      className={`ht3-sev ht3-sev-${severity} ${className}`}
      style={{ '--ht3-sev': s.color }}
      role="status" aria-label={`${s.label} severity`}
    >
      {children || s.label}
    </span>
  );
}
