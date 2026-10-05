/**
 * HuntTimeline.jsx — Forge wave 2, ideas 50060–50080.
 *
 * Live hunt timeline & progress components: phase pipeline, step logs,
 * sparklines, gauges, treemap, radar sweep, and retry/payload indicators.
 * Dark-theme, violet accent.
 */
import React from 'react';
import './HuntTimeline.css';

/** 50061 — Format seconds as "4m 12s" for per-phase elapsed labels. */
export function formatElapsed(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m === 0 ? `${r}s` : `${m}m ${String(r).padStart(2, '0')}`;
}

/** 50061 — Per-phase elapsed label, e.g. "Recon · 4m 12s", updating live. */
export function PerPhaseElapsedLabel({ seconds = 0, className = '' }) {
  return <span className={`ht-elapsed ${className}`}>{formatElapsed(seconds)}</span>;
}

/** 50060 — Horizontal phase pipeline with live checkmarks + pulsing current phase. */
export function HorizontalPhasePipeline({ phases = [], className = '' }) {
  const items = phases.length > 0 ? phases : [
    { name: 'Recon', state: 'done', elapsed: 252 },
    { name: 'Testing', state: 'active', elapsed: 96 },
    { name: 'Chaining', state: 'pending', elapsed: 0 },
    { name: 'Reporting', state: 'pending', elapsed: 0 },
  ];
  return (
    <ol className={`ht-pipeline ${className}`} aria-label="Hunt phases">
      {items.map((p, i) => (
        <li key={p.name} className={`ht-phase ht-${p.state}`} aria-current={p.state === 'active' ? 'step' : undefined}>
          <span className="ht-phase-dot" aria-hidden="true">{p.state === 'done' ? '✓' : i + 1}</span>
          <span className="ht-phase-text">
            <span className="ht-phase-name">{p.name}</span>
            <PerPhaseElapsedLabel seconds={p.elapsed} />
          </span>
          {i < items.length - 1 && <span className="ht-phase-link" aria-hidden="true" />}
        </li>
      ))}
    </ol>
  );
}

/** 50062 — Vertical step log: timestamped, collapsible per phase, auto-scroll pauses on hover. */
export function VerticalStepLog({ steps = [], className = '' }) {
  const [collapsed, setCollapsed] = React.useState({});
  const [hovering, setHovering] = React.useState(false);
  const bodyRef = React.useRef(null);

  const groups = [];
  const seen = {};
  steps.forEach((s) => {
    if (!seen[s.phase]) { seen[s.phase] = []; groups.push(s.phase); }
    seen[s.phase].push(s);
  });

  React.useEffect(() => {
    if (!hovering && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [steps.length, hovering]);

  const items = steps.length > 0 ? groups : ['Recon'];
  return (
    <div className={`ht-steplog ${className}`}>
      <div
        ref={bodyRef}
        className="ht-steplog-body"
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        {items.map((phase) => (
          <div key={phase} className="ht-steplog-phase">
            <button
              type="button"
              className="ht-steplog-head"
              onClick={() => setCollapsed((c) => ({ ...c, [phase]: !c[phase] }))}
              aria-expanded={!collapsed[phase]}
            >
              <span aria-hidden="true">{collapsed[phase] ? '▸' : '▾'}</span> {phase}
            </button>
            {!collapsed[phase] && (
              <ul>
                {(seen[phase] || [{ ts: '12:04:31', text: 'Enumerating subdomains…' }]).map((s, i) => (
                  <li key={i} className="ht-steplog-row">
                    <span className="ht-steplog-ts">{s.ts}</span>
                    <span>{s.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** 50063 — Events-per-minute sparkline under the progress bar. */
export function EventsPerMinuteSparkline({ points = [], width = 220, height = 36, className = '' }) {
  const data = points.length > 1 ? points : [2, 5, 3, 8, 6, 11, 7, 9, 4];
  const max = Math.max(...data, 1);
  const stepX = width / (data.length - 1);
  const line = data.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * stepX).toFixed(1)},${(height - 4 - (v / max) * (height - 8)).toFixed(1)}`).join(' ');
  return (
    <div className={`ht-spark ${className}`} role="img" aria-label={`Activity sparkline, peak ${max} events per minute`}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        <path d={`${line} L${width},${height} L0,${height} Z`} fill="rgba(139,92,246,0.12)" stroke="none" />
        <path d={line} fill="none" stroke="#a78bfa" strokeWidth={2} strokeLinecap="round" />
      </svg>
      <span className="ht-spark-label">events/min</span>
    </div>
  );
}

/** 50064 — Circular progress ring around the agent avatar. */
export function AvatarProgressRing({ percent = 0, initials = 'AI', size = 56, className = '' }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, percent)) / 100;
  return (
    <div className={`ht-avatar-ring ${className}`} role="progressbar" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100} aria-label="Hunt completion">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1c2333" strokeWidth={5} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#a78bfa" strokeWidth={5} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - p)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`} className="ht-ring-fill"
        />
      </svg>
      <span className="ht-avatar-initials">{initials}</span>
    </div>
  );
}

/** 50065 — Phase bars weighted by estimated effort, not raw step counts. */
export function EffortWeightedPhaseBars({ phases = [], className = '' }) {
  const items = phases.length > 0 ? phases : [
    { name: 'Recon', effort: 3, progress: 100 },
    { name: 'Testing', effort: 6, progress: 45 },
    { name: 'Chaining', effort: 2, progress: 0 },
    { name: 'Reporting', effort: 1, progress: 0 },
  ];
  return (
    <div className={`ht-effort ${className}`} role="status" aria-label="Effort-weighted phase progress">
      {items.map((p) => (
        <div key={p.name} className="ht-effort-row">
          <span className="ht-effort-name">{p.name}</span>
          <div className="ht-effort-track" style={{ flexGrow: p.effort }}>
            <div className="ht-effort-fill" style={{ width: `${Math.max(0, Math.min(100, p.progress))}%` }} />
          </div>
          <span className="ht-effort-pct">{Math.round(p.progress)}%</span>
        </div>
      ))}
    </div>
  );
}

/** 50066 — Milestone flags: first finding, first critical, PoC generated. */
export function TimelineMilestoneMarkers({ milestones = [], className = '' }) {
  const items = milestones.length > 0 ? milestones : [
    { type: 'first-finding', label: 'First finding', at: 22 },
    { type: 'first-critical', label: 'First critical', at: 58 },
    { type: 'poc', label: 'PoC generated', at: 81 },
  ];
  return (
    <div className={`ht-milestones ${className}`} aria-label="Timeline milestones">
      <div className="ht-ms-track" aria-hidden="true" />
      {items.map((m, i) => (
        <span key={i} className={`ht-ms-flag ht-ms-${m.type}`} style={{ left: `${m.at}%` }} title={m.label}>
          <i aria-hidden="true">⚑</i>
          <em>{m.label}</em>
        </span>
      ))}
    </div>
  );
}

/** 50067 — Compressed mini-map of the full timeline with a draggable viewport. */
export function TimelineMiniMap({ windowSize = 25, onScrub, className = '' }) {
  const [view, setView] = React.useState(0);
  const move = (v) => {
    const clamped = Math.max(0, Math.min(100 - windowSize, v));
    setView(clamped);
    if (onScrub) onScrub(clamped);
  };
  return (
    <div className={`ht-minimap ${className}`}>
      <div className="ht-minimap-track" aria-hidden="true">
        <div className="ht-minimap-view" style={{ left: `${view}%`, width: `${windowSize}%` }} />
      </div>
      <input
        type="range" min={0} max={100 - windowSize} value={view}
        onChange={(e) => move(Number(e.target.value))}
        aria-label="Timeline viewport" className="ht-minimap-range"
      />
    </div>
  );
}

const STEP_STATUS_CLASS = { success: 'ht-ok', retry: 'ht-retry', failed: 'ht-fail', skipped: 'ht-skip' };

/** 50068 — Color-coded step rows: green success, amber retry, red failed, gray skipped. */
export function ColorCodedStepRows({ steps = [], className = '' }) {
  const items = steps.length > 0 ? steps : [
    { text: 'Subdomain enumeration', status: 'success' },
    { text: 'Port scan', status: 'retry' },
    { text: 'Directory brute force', status: 'failed' },
    { text: 'API fuzzing', status: 'skipped' },
  ];
  return (
    <ul className={`ht-steps ${className}`}>
      {items.map((s, i) => (
        <li key={i} className={`ht-step-row ${STEP_STATUS_CLASS[s.status] || 'ht-skip'}`}>
          <span className="ht-step-dot" aria-hidden="true" />
          <span className="ht-step-text">{s.text}</span>
          <span className="ht-step-status">{s.status}</span>
        </li>
      ))}
    </ul>
  );
}

/** 50069 — Live card: exact URL, payload family and attempt count being tested now. */
export function CurrentlyTestingCard({ url = '', payloadFamily = '', attempt = 0, className = '' }) {
  return (
    <div className={`ht-testing-card ${className}`} role="status" aria-label="Currently testing">
      <span className="ht-live-dot" aria-hidden="true" />
      <div className="ht-testing-body">
        <span className="ht-testing-url">{url || 'https://target.example/login'}</span>
        <span className="ht-testing-meta">{payloadFamily || 'SQLi'} · attempt {attempt || 1}</span>
      </div>
    </div>
  );
}

/** 50070 — Progress segmented by attack surface: mini bars per host/path. */
export function PerHostProgressBars({ hosts = [], className = '' }) {
  const items = hosts.length > 0 ? hosts : [
    { host: 'app.target.example', progress: 82 },
    { host: 'api.target.example', progress: 45 },
    { host: 'static.target.example', progress: 100 },
  ];
  return (
    <div className={`ht-hosts ${className}`} role="status" aria-label="Per-host progress">
      {items.map((h) => (
        <div key={h.host} className="ht-host-row">
          <span className="ht-host-name">{h.host}</span>
          <div className="ht-host-track">
            <div className="ht-host-fill" style={{ width: `${Math.max(0, Math.min(100, h.progress))}%` }} />
          </div>
          <span className="ht-host-pct">{Math.round(h.progress)}%</span>
        </div>
      ))}
    </div>
  );
}

/** 50071 — Velocity-based ETA countdown, e.g. "~12 min remaining". */
export function VelocityBasedEta({ etaText = '', className = '' }) {
  return (
    <span className={`ht-eta ${className}`} role="status">
      <span aria-hidden="true">⏱</span> {etaText || '~12 min remaining'}
    </span>
  );
}

/** 50072 — Live finding-rate ticker beside the progress header. */
export function FindingRateTicker({ text = '', className = '' }) {
  return (
    <span className={`ht-ticker ${className}`} role="status">
      <span className="ht-ticker-dot" aria-hidden="true" />
      {text || '3 findings in last 10 min'}
    </span>
  );
}

/** 50073 — Expandable step rows: click reveals the exact tool command + exit status. */
export function ExpandableStepRows({ steps = [], className = '' }) {
  const [open, setOpen] = React.useState(null);
  const items = steps.length > 0 ? steps : [
    { text: 'Nuclei CVE scan', command: 'nuclei -u https://target.example -t cves/ -severity critical,high', exitStatus: 0 },
    { text: 'FFUF content discovery', command: 'ffuf -u https://target.example/FUZZ -w wordlist.txt -mc 200,301', exitStatus: 2 },
  ];
  return (
    <ul className={`ht-expandable ${className}`}>
      {items.map((s, i) => (
        <li key={i} className="ht-exp-row">
          <button
            type="button" className="ht-exp-head"
            onClick={() => setOpen(open === i ? null : i)}
            aria-expanded={open === i}
          >
            <span>{s.text}</span>
            <span className={`ht-exit ht-exit-${s.exitStatus === 0 ? 'ok' : 'bad'}`}>exit {s.exitStatus}</span>
            <span aria-hidden="true" className="ht-exp-caret">{open === i ? '▾' : '▸'}</span>
          </button>
          {open === i && <code className="ht-exp-cmd">{s.command}</code>}
        </li>
      ))}
    </ul>
  );
}

/** 50074 — Phase-transition banner: toast + timeline announcement. */
export function PhaseTransitionBanner({ message = '', onDismiss, className = '' }) {
  if (!message) return null;
  return (
    <div className={`ht-transition ${className}`} role="status">
      <span className="ht-transition-check" aria-hidden="true">✓</span>
      <span>{message}</span>
      {onDismiss && (
        <button type="button" className="ht-transition-x" onClick={onDismiss} aria-label="Dismiss">✕</button>
      )}
    </div>
  );
}

/** 50075 — Stepped crawl-depth gauge: current vs configured maximum depth. */
export function CrawlDepthGauge({ current = 0, max = 5, className = '' }) {
  return (
    <div className={`ht-depth ${className}`} role="meter" aria-valuenow={current} aria-valuemin={0} aria-valuemax={max} aria-label="Crawl depth">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={`ht-depth-step ${i < current ? 'ht-on' : ''}`} aria-hidden="true" />
      ))}
      <span className="ht-depth-label">depth {current}/{max}</span>
    </div>
  );
}

/** 50076 — Coverage treemap: tested vs untested routes across the target. */
export function CoverageTreemap({ routes = [], className = '' }) {
  const items = routes.length > 0 ? routes : [
    { path: '/login', tested: true }, { path: '/api/users', tested: true },
    { path: '/admin', tested: false }, { path: '/api/orders', tested: true },
    { path: '/upload', tested: false }, { path: '/search', tested: true },
  ];
  const tested = items.filter((r) => r.tested).length;
  return (
    <div className={className} role="img" aria-label={`Route coverage: ${tested} of ${items.length} tested`}>
      <div className="ht-treemap">
        {items.map((r, i) => (
          <span key={i} className={`ht-tree-cell ${r.tested ? 'ht-tested' : 'ht-untested'}`} title={`${r.path} — ${r.tested ? 'tested' : 'untested'}`}>
            {r.path}
          </span>
        ))}
      </div>
    </div>
  );
}

/** 50077 — Animated radar sweep on the target domain card during recon. */
export function RadarSweepAnimation({ domain = '', className = '' }) {
  return (
    <div className={`ht-radar-card ${className}`} role="status" aria-label={`Scanning ${domain || 'target'}`}>
      <span className="ht-radar" aria-hidden="true">
        <i className="ht-sweep" />
        <i className="ht-blip ht-blip-a" />
        <i className="ht-blip ht-blip-b" />
      </span>
      <span className="ht-radar-domain">{domain || 'target.example'}</span>
      <span className="ht-radar-label">recon in progress</span>
    </div>
  );
}

/** 50079 — Granular sub-step counter: "testing 1,240 payloads: 312/1240". */
export function SubStepPayloadCounter({ label = 'testing payloads', done = 0, total = 0, className = '' }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className={`ht-payload-counter ${className}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <span className="ht-payload-text">{label}: {done.toLocaleString()}/{total.toLocaleString()}</span>
      <div className="ht-track"><div className="ht-fill" style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

/** 50080 — Retry indicator: "attempt 2/3" with visible backoff countdown. */
export function RetryAttemptIndicator({ attempt = 1, maxAttempts = 3, backoffSecs = 0, className = '' }) {
  return (
    <span className={`ht-retry-ind ${className}`} role="status" aria-label={`Attempt ${attempt} of ${maxAttempts}`}>
      attempt {attempt}/{maxAttempts}
      {backoffSecs > 0 && <em> · retrying in {backoffSecs}s</em>}
    </span>
  );
}
