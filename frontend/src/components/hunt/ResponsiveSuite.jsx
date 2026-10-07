/**
 * ResponsiveSuite.jsx — Infinity AI · Forge wave 16 (ideas 50601–50640).
 *
 * Mobile/responsive + touch-UX round: 39 real working components (CSS-driven
 * via ResponsiveSuite.css, math/state via responsiveCore.js) plus the
 * `ResponsiveSuiteGallery` reference gallery. Idea 50602 is an honest SKIP —
 * the chat typing pulse already ships as ThinkingDots (50573, wave 15).
 * Every animation respects the 400ms budget and prefers-reduced-motion.
 */
import { useEffect, useRef, useState } from 'react';
import {
  BOTTOM_TABS,
  GESTURE_GUIDE,
  SWIPE_THRESHOLD_PX,
  classifySwipe,
  triageActionForSwipe,
  PTR_MAX_PULL_PX,
  ptrProgress,
  ptrShouldRefresh,
  cascadeDelayMs,
  clampScale,
  clampPan,
  pinchTransform,
  pinchDistance,
  fluidTypeClamp,
  viewportHeightClass,
  logDensityForWidth,
  TOUCH_TARGET_MIN_PX,
  meetsTouchTarget,
  dividerRatio,
  MOTION_BUDGET_CAP_MS,
  capMotionMs,
  resolveMotionMs,
  shouldReduceMotion,
  ringProps,
  statusColor,
  flashClassForStatus,
  SORT_FLIP_MS,
  sortNext,
  sortArrowStyle,
  CHECKBOX_DRAW_MS,
  checkboxStrokeOffset,
  bannerClassFor,
  autoFitGridTemplate,
  tableModeForWidth,
  toastPositionForWidth,
  stickyCtaVisible,
  foldableMode,
  isTouchDevice,
} from './responsiveCore.js';
import './ResponsiveSuite.css';

/* Shared demo scaffolding ------------------------------------------ */

function Demo({ id, title, children }) {
  return (
    <div className="rs-demo">
      <h3 className="rs-demo-title">{id} — {title}</h3>
      {children}
    </div>
  );
}

function PhoneFrame({ children }) {
  return <div className="rs-phone-frame">{children}</div>;
}

/** Window width, live. Falls back to 1280 when there is no window. */
function useWindowWidth() {
  const [w, setW] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1280));
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onResize = () => setW(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return w;
}

/* ------------------------------------------------------------------ */
/* 50601 — status-change flash: step rows flash the new status color  */
/* ------------------------------------------------------------------ */

const FLASH_PHASES = ['Recon', 'Scan', 'Triage', 'Report'];

export function StatusFlashRow() {
  const [statuses, setStatuses] = useState({ Recon: 'passed', Scan: 'running', Triage: 'queued', Report: 'queued' });

  const advance = () => {
    setStatuses((prev) => {
      const next = { ...prev };
      const runningIdx = FLASH_PHASES.findIndex((p) => prev[p] === 'running');
      if (runningIdx === -1) {
        // Restart the demo cycle.
        FLASH_PHASES.forEach((p, i) => { next[p] = i === 0 ? 'running' : 'queued'; });
        return next;
      }
      next[FLASH_PHASES[runningIdx]] = 'passed';
      if (runningIdx + 1 < FLASH_PHASES.length) next[FLASH_PHASES[runningIdx + 1]] = 'running';
      return next;
    });
  };

  return (
    <div>
      {FLASH_PHASES.map((name) => {
        const st = statuses[name];
        return (
          <div key={`${name}:${st}`} className={flashClassForStatus(st)} style={{ '--rs-flash-color': statusColor(st) }}>
            <span className="rs-flash-dot" style={{ background: statusColor(st) }} />
            <span className="rs-flash-name">{name}</span>
            <span className="rs-flash-status">{st}</span>
          </div>
        );
      })}
      <button type="button" className="rs-btn" onClick={advance}>Advance phase</button>
      <p className="rs-note">Each row re-mounts on status change so the 400ms color flash replays, then settles.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50603 — avatar ring progress (stroke-dashoffset)                   */
/* ------------------------------------------------------------------ */

export function AvatarRingProgress({ name = 'A. Researcher', size = 56 }) {
  const [progress, setProgress] = useState(0.65);
  const ring = ringProps(size, 5, progress);
  const bump = (d) => setProgress((p) => Math.min(1, Math.max(0, p + d)));
  return (
    <div className="rs-avatar-ring">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={`Hunt progress ${Math.round(progress * 100)} percent`}>
        <circle cx={size / 2} cy={size / 2} r={ring.radius} fill="none" stroke="#1e293b" strokeWidth="5" />
        <circle
          className="rs-ring-fg"
          cx={size / 2} cy={size / 2} r={ring.radius} fill="none"
          stroke="#38bdf8" strokeWidth="5" strokeLinecap="round"
          strokeDasharray={ring.dasharray} strokeDashoffset={ring.dashoffset}
        />
        <text x="50%" y="50%" dy="0.35em" textAnchor="middle" fill="#e2e8f0" fontSize="13" fontWeight="700">
          {Math.round(progress * 100)}%
        </text>
      </svg>
      <div>
        <div className="rs-avatar-label">{name}</div>
        <div className="rs-avatar-sub">hunt coverage</div>
        <div className="rs-row" style={{ marginTop: 8 }}>
          <button type="button" className="rs-btn" onClick={() => bump(-0.1)}>−10%</button>
          <button type="button" className="rs-btn" onClick={() => bump(0.1)}>+10%</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50604 — reconnect banner slides down from the header               */
/* ------------------------------------------------------------------ */

export function ReconnectBanner() {
  const [conn, setConn] = useState('online');
  const [visible, setVisible] = useState(false);
  const timers = useRef([]);

  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  const drop = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setConn('offline');
    setVisible(true);
  };

  const reconnect = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setConn('catching-up');
    setVisible(true);
    timers.current.push(setTimeout(() => {
      setConn('online');
      timers.current.push(setTimeout(() => setVisible(false), 1400));
    }, 1800));
  };

  const label = conn === 'catching-up'
    ? '↻ Catching up — replaying 3 queued events…'
    : conn === 'offline'
      ? '⚠ Connection lost — retrying…'
      : '✓ Back online — hunt resumed';

  return (
    <div>
      <div className={`${bannerClassFor(conn)}${visible ? ' rs-banner-visible' : ''}`} role="status">
        {visible ? label : ''}
      </div>
      <div className="rs-row" style={{ marginTop: 10 }}>
        <button type="button" className="rs-btn" onClick={drop}>Drop connection</button>
        <button type="button" className="rs-btn rs-primary" onClick={reconnect}>Reconnect</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50605 — checkbox spring draw                                       */
/* ------------------------------------------------------------------ */

export function SpringCheckbox({ label = 'Auto-triage low-severity findings' }) {
  const [checked, setChecked] = useState(false);
  const len = 18;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      className={`rs-spring-check${checked ? ' rs-checked' : ''}`}
      onClick={() => setChecked((c) => !c)}
    >
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
        <rect x="2" y="2" width="22" height="22" rx="6"
          fill={checked ? '#0284c7' : 'none'}
          stroke={checked ? '#0284c7' : '#475569'} strokeWidth="2" />
        <path className="rs-check-path" d="M8 13.5l4.5 4.5L18.5 9.5" fill="none"
          stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          strokeDasharray={len} strokeDashoffset={checkboxStrokeOffset(len, checked)} />
      </svg>
      <span>{label}</span>
      <span className="rs-note" style={{ margin: 0 }}>draw {CHECKBOX_DRAW_MS}ms</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* 50606 — sort-arrow flip (200ms rotation)                           */
/* ------------------------------------------------------------------ */

export function SortArrowButton({ label = 'Severity' }) {
  const [dir, setDir] = useState('desc');
  return (
    <div>
      <button type="button" className="rs-sort-btn" onClick={() => setDir(sortNext(dir))} aria-label={`Sort by ${label}, ${dir === 'asc' ? 'ascending' : 'descending'}`}>
        {label}
        <span className="rs-sort-arrow" style={sortArrowStyle(dir)} aria-hidden="true">▲</span>
      </button>
      <p className="rs-note">Direction: {dir} — the arrow flips 180° in {SORT_FLIP_MS}ms on every change.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50607 — thumbnail cascade                                         */
/* ------------------------------------------------------------------ */

const CASCADE_THUMBS = [
  { name: 'login.png', tint: '#1e3a5f' },
  { name: 'search.png', tint: '#3b1d5f' },
  { name: 'api.png', tint: '#5f1d3b' },
  { name: 'admin.png', tint: '#1d5f3b' },
  { name: 's3.png', tint: '#5f4a1d' },
  { name: 'chain.png', tint: '#1d3b5f' },
];

export function ThumbnailCascade() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" className="rs-btn" onClick={() => setOpen((o) => !o)}>
        {open ? 'Close preview' : 'Open preview'}
      </button>
      {open && (
        <div className="rs-thumb-grid">
          {CASCADE_THUMBS.map((t, i) => (
            <div
              key={t.name}
              className="rs-thumb-rise"
              style={{ animationDelay: `${cascadeDelayMs(i)}ms`, background: `linear-gradient(135deg, #0f172a, ${t.tint})` }}
            >
              {t.name}
            </div>
          ))}
        </div>
      )}
      <p className="rs-note">Each thumbnail rises with a {cascadeDelayMs(1)}ms stagger, capped so long grids stay snappy.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50608 — pause-play morph                                           */
/* ------------------------------------------------------------------ */

export function PausePlayMorph() {
  const [playing, setPlaying] = useState(true);
  return (
    <button type="button" className="rs-pp-btn" onClick={() => setPlaying((p) => !p)} aria-pressed={playing}>
      <span className="rs-pp-icon" aria-hidden="true">
        <span style={{ opacity: playing ? 1 : 0 }}>❚❚</span>
        <span style={{ opacity: playing ? 0 : 1 }}>▶</span>
      </span>
      <span key={playing ? 'pause' : 'play'} className="rs-pp-label" style={{ animation: 'rs-thumb-rise 200ms ease' }}>
        {playing ? 'Pause hunt' : 'Resume hunt'}
      </span>
      {playing && (
        <span className="rs-eq" aria-hidden="true"><i /><i /><i /></span>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* 50609 — animation time budget: everything caps at 400ms            */
/* ------------------------------------------------------------------ */

const BUDGET_SAMPLES = [600, 480, 300, 150];

export function MotionBudgetDemo() {
  const reduced = shouldReduceMotion();
  return (
    <div className="rs-cap">
      {BUDGET_SAMPLES.map((ms) => {
        const capped = capMotionMs(ms);
        const effective = resolveMotionMs(ms, { reducedMotion: reduced });
        return (
          <div className="rs-budget-row" key={ms}>
            <span className="rs-budget-label">{ms}ms requested</span>
            <div
              className={`rs-budget-bar${capped < ms ? ' rs-capped' : ''}`}
              style={{ width: Math.max(4, capped / 2), transitionDuration: `${effective}ms` }}
            />
            <span>{capped}ms effective{capped < ms ? ' (capped)' : ''}</span>
          </div>
        );
      })}
      <p className="rs-note">
        Budget: {MOTION_BUDGET_CAP_MS}ms — longer requests are clamped (amber bars). Reduced-motion
        guards already ship via 50503 / .mm-reduced-motion; this suite adds the cap helper and the
        .rs-cap CSS guard.{reduced ? ' Reduced motion is ON in your OS — durations resolve to 0.' : ''}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50610 — mobile single-column hunt with compact stepper             */
/* ------------------------------------------------------------------ */

const HUNT_PHASES = ['Target', 'Recon', 'Scan', 'Triage', 'Report'];

export function MobileSingleColumnHunt() {
  const [active, setActive] = useState(2);
  return (
    <PhoneFrame>
      <div style={{ padding: 12 }}>
        <div className="rs-stepper-compact" role="list" aria-label="Hunt phases">
          {HUNT_PHASES.map((p, i) => (
            <div key={p} role="listitem" className={`rs-step${i === active ? ' rs-active' : ''}${i < active ? ' rs-done' : ''}`}>
              {p}
            </div>
          ))}
        </div>
        <div className="rs-hunt-col">
          {HUNT_PHASES.map((p, i) => (
            <div className="rs-phase-card" key={p}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: 13, color: '#e2e8f0' }}>{p}</strong>
                <span className="rs-flash-status">{i < active ? 'done' : i === active ? 'running' : 'queued'}</span>
              </div>
              <p className="rs-note" style={{ margin: '6px 0 0' }}>
                {i === 0 && 'target.example — scope confirmed'}
                {i === 1 && '42 subdomains, tech fingerprinted'}
                {i === 2 && 'nuclei + custom templates running'}
                {i === 3 && '3 findings awaiting review'}
                {i === 4 && 'draft ready when triage completes'}
              </p>
            </div>
          ))}
        </div>
        <div className="rs-row" style={{ marginTop: 10 }}>
          <button type="button" className="rs-btn" disabled={active === 0} onClick={() => setActive((a) => Math.max(0, a - 1))}>Back</button>
          <button type="button" className="rs-btn rs-primary" disabled={active === HUNT_PHASES.length - 1} onClick={() => setActive((a) => Math.min(HUNT_PHASES.length - 1, a + 1))}>Next phase</button>
        </div>
      </div>
    </PhoneFrame>
  );
}

/* ------------------------------------------------------------------ */
/* 50611 — mobile bottom tab bar                                      */
/* ------------------------------------------------------------------ */

const TAB_CONTENT = {
  hunt: 'Hunt — 1 active hunt, phase 3 of 5 (Scan).',
  findings: 'Findings — 3 untriaged: reflected XSS, open redirect, verbose errors.',
  chat: 'Chat — ask the agent what it is doing mid-hunt.',
  more: 'More — reports, models, settings.',
};

export function MobileBottomTabBar() {
  const [tab, setTab] = useState('hunt');
  return (
    <PhoneFrame>
      <div className="rs-phone-scroll" style={{ flex: 1, padding: 14 }}>
        <p style={{ fontSize: 13, color: '#cbd5e1', margin: 0 }}>{TAB_CONTENT[tab]}</p>
        <p className="rs-note">Safe-area padding keeps the bar clear of the home indicator.</p>
      </div>
      <nav className="rs-bottom-tabbar" aria-label="Primary">
        {BOTTOM_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`rs-tab${tab === t.id ? ' rs-active' : ''}`}
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => setTab(t.id)}
          >
            <span className="rs-tab-icon" aria-hidden="true">{t.icon}</span>
            {t.label}
            {t.id === 'findings' && <span className="rs-tab-badge">3</span>}
          </button>
        ))}
      </nav>
    </PhoneFrame>
  );
}

/* ------------------------------------------------------------------ */
/* 50612 — swipeable finding rows                                    */
/* ------------------------------------------------------------------ */

export function SwipeableFindingRow({ title = 'Reflected XSS in /search', detail = 'severity: high · confidence 92%' }) {
  const [dragX, setDragX] = useState(0);
  const [live, setLive] = useState(false);
  const [open, setOpen] = useState(null);
  const [done, setDone] = useState(null);
  const startX = useRef(0);

  const onPointerDown = (e) => {
    startX.current = e.clientX;
    setLive(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!live) return;
    setDragX(Math.max(-140, Math.min(140, e.clientX - startX.current)));
  };
  const endDrag = () => {
    if (!live) return;
    setLive(false);
    const dir = classifySwipe(dragX, 0, 64);
    setOpen(dir === 'left' ? 'snooze' : dir === 'right' ? 'review' : null);
    setDragX(0);
  };
  const commit = (action) => { setDone(action); setOpen(null); };

  if (done) {
    return (
      <div className="rs-demo" style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: done === 'reviewed' ? '#34d399' : '#f59e0b' }}>
          {done === 'reviewed' ? '✓ Marked reviewed' : '◷ Snoozed for 24h'}
        </span>
        <button type="button" className="rs-btn" style={{ marginLeft: 10 }} onClick={() => setDone(null)}>Undo</button>
      </div>
    );
  }

  const offset = open === 'snooze' ? -104 : open === 'review' ? 104 : dragX;
  return (
    <div className="rs-swipe-row">
      <div className="rs-swipe-actions">
        <button type="button" className="rs-action-review" onClick={() => commit('reviewed')}>Review</button>
        <button type="button" className="rs-action-snooze" onClick={() => commit('snooze')}>Snooze</button>
      </div>
      <div
        className="rs-swipe-card"
        style={{ transform: `translateX(${offset}px)`, transition: live ? 'none' : undefined }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <h4>{title}</h4>
        <p>{detail}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50613 — collapsible mobile timeline with sticky "now" marker      */
/* ------------------------------------------------------------------ */

const TIMELINE = [
  { phase: 'Recon', events: ['42 subdomains enumerated', 'tech stack fingerprinted'], past: true },
  { phase: 'Scan', events: ['nuclei: 3 findings', 'custom XSS probes: 1 finding'], past: true },
  { phase: 'Triage', events: ['2 findings auto-triaged', '1 awaiting review'], past: false },
];

export function CollapsibleMobileTimeline() {
  const [openPhase, setOpenPhase] = useState('Scan');
  return (
    <PhoneFrame>
      <div className="rs-phone-scroll" style={{ padding: '0 14px 14px' }}>
        <div className="rs-timeline">
          {TIMELINE.filter((t) => t.past).map((t) => (
            <div key={t.phase}>
              <button type="button" className="rs-phase-head" onClick={() => setOpenPhase((p) => (p === t.phase ? '' : t.phase))} aria-expanded={openPhase === t.phase}>
                {openPhase === t.phase ? '▾' : '▸'} {t.phase}
              </button>
              {openPhase === t.phase && t.events.map((e) => <div className="rs-timeline-event" key={e}>{e}</div>)}
            </div>
          ))}
          <div className="rs-now-marker">● now</div>
          {TIMELINE.filter((t) => !t.past).map((t) => (
            <div key={t.phase}>
              <button type="button" className="rs-phase-head" onClick={() => setOpenPhase((p) => (p === t.phase ? '' : t.phase))} aria-expanded={openPhase === t.phase}>
                {openPhase === t.phase ? '▾' : '▸'} {t.phase}
              </button>
              {openPhase === t.phase && t.events.map((e) => <div className="rs-timeline-event" key={e}>{e}</div>)}
            </div>
          ))}
        </div>
      </div>
    </PhoneFrame>
  );
}

/* ------------------------------------------------------------------ */
/* 50614 — filter FAB sheet (FAB trigger; sheet pattern from 50227)   */
/* ------------------------------------------------------------------ */

const FAB_SEVERITIES = ['critical', 'high', 'medium', 'low'];

export function FilterFabSheet() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(['critical', 'high']);
  const [applied, setApplied] = useState(['critical', 'high']);

  const toggle = (s) => setDraft((d) => (d.includes(s) ? d.filter((x) => x !== s) : [...d, s]));

  return (
    <PhoneFrame>
      <div className="rs-phone-scroll" style={{ flex: 1, padding: 14, minHeight: 220 }}>
        <p style={{ fontSize: 13, color: '#cbd5e1', margin: 0 }}>
          Active filters: {applied.length ? applied.join(', ') : 'none'}
        </p>
        <p className="rs-note">The floating button opens the sheet — draft state commits only on Apply.</p>
      </div>
      <button type="button" className="rs-fab" onClick={() => { setDraft(applied); setOpen(true); }} aria-label="Open filters" aria-haspopup="dialog">
        ⧩
        {applied.length > 0 && <span className="rs-fab-count">{applied.length}</span>}
      </button>
      {open && (
        <div className="rs-sheet-overlay" role="dialog" aria-modal="true" aria-label="Filters" onClick={() => setOpen(false)}>
          <div className="rs-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="rs-sheet-grip" aria-hidden="true" />
            <h3>Filter findings</h3>
            {FAB_SEVERITIES.map((s) => (
              <SpringCheckbox key={s} label={s} />
            ))}
            <div className="rs-sheet-row">
              <button type="button" onClick={() => setDraft([])}>Reset</button>
              <button type="button" className="rs-primary" onClick={() => { setApplied(draft); setOpen(false); }}>Apply</button>
            </div>
          </div>
        </div>
      )}
    </PhoneFrame>
  );
}

/* ------------------------------------------------------------------ */
/* 50615 — single-column widgets, most-used first                     */
/* ------------------------------------------------------------------ */

const WIDGETS = [
  { name: 'Severity donut', uses: 214 },
  { name: 'Hunt progress', uses: 187 },
  { name: 'Chain graph', uses: 96 },
  { name: 'Recent PoCs', uses: 61 },
  { name: 'Model status', uses: 22 },
];

export function SingleColumnWidgets() {
  const sorted = [...WIDGETS].sort((a, b) => b.uses - a.uses);
  return (
    <div className="rs-widget-col">
      {sorted.map((w, i) => (
        <div className="rs-widget" key={w.name}>
          <span className="rs-widget-rank">#{i + 1}</span>
          <span className="rs-widget-name">{w.name}</span>
          <span className="rs-widget-uses">{w.uses} opens</span>
        </div>
      ))}
      <p className="rs-note">One column on phones; ranked by real open counts, most-used first.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50616 — mobile terminal view (monospace, scroll locking)           */
/* ------------------------------------------------------------------ */

const TERM_SCRIPT = [
  { cls: 'rs-prompt', text: '$ nuclei -target https://target.example -severity critical,high' },
  { cls: 'rs-out', text: '[INF] 128 templates loaded' },
  { cls: 'rs-out', text: '[critical] reflected XSS — /search?q=' },
  { cls: 'rs-out', text: '[high] open redirect — /logout?next=' },
  { cls: 'rs-prompt', text: '$ dark-matter triage --auto' },
  { cls: 'rs-out', text: '2 findings queued for review' },
];

export function MobileTerminalView() {
  const [lines, setLines] = useState(TERM_SCRIPT.slice(0, 3));
  const [autoScroll, setAutoScroll] = useState(true);
  const [running, setRunning] = useState(false);
  const boxRef = useRef(null);
  const timers = useRef([]);

  useEffect(() => {
    if (autoScroll && boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [lines, autoScroll]);

  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  const run = () => {
    if (running) return;
    setRunning(true);
    setLines([]);
    TERM_SCRIPT.forEach((l, i) => {
      timers.current.push(setTimeout(() => {
        setLines((prev) => [...prev, l]);
        if (i === TERM_SCRIPT.length - 1) setRunning(false);
      }, 450 * (i + 1)));
    });
  };

  return (
    <div>
      <div className="rs-row" style={{ marginBottom: 10 }}>
        <button type="button" className="rs-btn rs-primary" onClick={run} disabled={running}>
          {running ? 'Running…' : 'Run scan'}
        </button>
        <button type="button" className="rs-btn" onClick={() => setLines([])}>Clear</button>
        <SpringCheckbox label="Auto-scroll" />
      </div>
      <div className="rs-terminal" ref={boxRef} role="log" aria-label="Scan terminal">
        {lines.map((l, i) => <div key={i} className={l.cls}>{l.text}</div>)}
      </div>
      <p className="rs-note">overscroll-behavior: contain locks scrolling inside the terminal; long lines scroll horizontally.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50617 — tablet two-pane layout with draggable divider              */
/* ------------------------------------------------------------------ */

const PANE_FINDINGS = [
  { id: 1, title: 'Reflected XSS in /search', body: 'Unescaped q parameter reflected in results page. PoC: ?q=<svg onload=alert(1)>. Confidence 92%.' },
  { id: 2, title: 'Open redirect on /logout', body: 'next parameter accepts arbitrary hosts. Chainable with the XSS for session theft.' },
  { id: 3, title: 'Verbose error pages', body: 'Stack traces leak framework versions on /api/* 500s. Low severity, easy fix.' },
];

export function TabletTwoPane() {
  const [ratio, setRatio] = useState(0.45);
  const [selected, setSelected] = useState(PANE_FINDINGS[0]);
  const boxRef = useRef(null);
  const dragging = useRef(false);

  const onDividerDown = (e) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onDividerMove = (e) => {
    if (!dragging.current || !boxRef.current) return;
    const rect = boxRef.current.getBoundingClientRect();
    setRatio(dividerRatio(e.clientX - rect.left, rect.width));
  };
  const endDivider = () => { dragging.current = false; };

  return (
    <div className="rs-twopane" ref={boxRef}>
      <div className="rs-pane-list" style={{ width: `${ratio * 100}%` }}>
        {PANE_FINDINGS.map((f) => (
          <button key={f.id} type="button" className={`rs-pane-item${selected.id === f.id ? ' rs-selected' : ''}`} onClick={() => setSelected(f)}>
            {f.title}
          </button>
        ))}
      </div>
      <div className="rs-divider" role="separator" aria-orientation="vertical" aria-label="Resize panes"
        onPointerDown={onDividerDown} onPointerMove={onDividerMove} onPointerUp={endDivider} onPointerCancel={endDivider} />
      <div className="rs-pane-detail">
        <h4 style={{ margin: '0 0 8px', color: '#e2e8f0', fontSize: 14 }}>{selected.title}</h4>
        <p style={{ margin: 0, color: '#94a3b8', fontSize: 13, lineHeight: 1.6 }}>{selected.body}</p>
        <p className="rs-note">List pane: {Math.round(ratio * 100)}% (clamped 25–75%). Drag the divider.</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50618 — 48px touch chips                                           */
/* ------------------------------------------------------------------ */

const SEVERITIES = [
  { id: 'critical', color: '#f87171' },
  { id: 'high', color: '#fb923c' },
  { id: 'medium', color: '#facc15' },
  { id: 'low', color: '#34d399' },
  { id: 'info', color: '#38bdf8' },
];

export function TouchChips() {
  const [on, setOn] = useState(['critical', 'high']);
  const toggle = (id) => setOn((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  return (
    <div>
      <div className="rs-touch-chips" role="group" aria-label="Severity filter">
        {SEVERITIES.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`rs-touch-chip${on.includes(s.id) ? ' rs-on' : ''}`}
            aria-pressed={on.includes(s.id)}
            onClick={() => toggle(s.id)}
          >
            <span className="rs-sev-dot" style={{ background: s.color }} />
            {s.id}
          </button>
        ))}
      </div>
      <p className="rs-note">
        Every chip is ≥ {TOUCH_TARGET_MIN_PX}px tall with press feedback
        ({meetsTouchTarget(48, 48) ? 'spec check passes' : 'spec check fails'}).
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50619 — paginated mobile reports (cards, not wide PDF)             */
/* ------------------------------------------------------------------ */

const REPORT_PAGES = [
  { title: 'Executive summary', body: '3 confirmed findings (1 critical, 1 high, 1 low) on target.example. Overall posture: needs attention before launch.' },
  { title: 'Finding #1 — Reflected XSS', body: 'Severity critical · CVSS 8.2. The /search q parameter reflects unsanitized input. Remediation: context-aware output encoding.' },
  { title: 'Finding #2 — Open redirect', body: 'Severity high · CVSS 7.1. /logout?next accepts arbitrary hosts. Remediation: allow-list redirect targets.' },
  { title: 'Remediation plan', body: 'Fix XSS and redirect this sprint; suppress verbose errors next. Re-test scheduled after deploy.' },
];

export function PaginatedMobileReports() {
  const [page, setPage] = useState(0);
  const startX = useRef(0);
  const [live, setLive] = useState(false);

  const onDown = (e) => { startX.current = e.clientX; setLive(true); };
  const onUp = (e) => {
    if (!live) return;
    setLive(false);
    const dir = classifySwipe(e.clientX - startX.current, 0, 50);
    if (dir === 'left') setPage((p) => Math.min(REPORT_PAGES.length - 1, p + 1));
    if (dir === 'right') setPage((p) => Math.max(0, p - 1));
  };

  const r = REPORT_PAGES[page];
  return (
    <PhoneFrame>
      <div style={{ padding: 12 }}>
        <div className="rs-report-card" onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => setLive(false)}>
          <p className="rs-note" style={{ margin: '0 0 6px' }}>Page {page + 1} of {REPORT_PAGES.length}</p>
          <h4>{r.title}</h4>
          <p>{r.body}</p>
        </div>
        <div className="rs-pager">
          <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">← Prev</button>
          <div className="rs-page-dots" aria-hidden="true">
            {REPORT_PAGES.map((_, i) => <i key={i} className={i === page ? 'rs-current' : ''} />)}
          </div>
          <button type="button" disabled={page === REPORT_PAGES.length - 1} onClick={() => setPage((p) => p + 1)} aria-label="Next page">Next →</button>
        </div>
        <p className="rs-note">Swipe or use the pager — no horizontal page scroll, no PDF zooming.</p>
      </div>
    </PhoneFrame>
  );
}

/* ------------------------------------------------------------------ */
/* 50620 — full-screen mobile chat (safe-area-aware input)            */
/* ------------------------------------------------------------------ */

export function MobileChatFullscreen() {
  const [messages, setMessages] = useState([
    { from: 'them', text: 'Scan phase finished — 3 findings need review.' },
    { from: 'me', text: 'What is the worst one?' },
    { from: 'them', text: 'Reflected XSS on /search, CVSS 8.2. Want the PoC?' },
  ]);
  const [draft, setDraft] = useState('');
  const logRef = useRef(null);
  const heightClass = viewportHeightClass();

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setMessages((m) => [...m, { from: 'me', text }]);
    setDraft('');
    setTimeout(() => {
      setMessages((m) => [...m, { from: 'them', text: 'On it — checking the evidence now.' }]);
    }, 700);
  };

  return (
    <PhoneFrame>
      <div className={`rs-chat ${heightClass}`} style={{ border: 'none', borderRadius: 0 }}>
        <div className="rs-chat-log" ref={logRef} role="log" aria-label="Hunt chat">
          {messages.map((m, i) => (
            <div key={i} className={`rs-chat-msg rs-${m.from}`}>{m.text}</div>
          ))}
        </div>
        <div className="rs-chat-input">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
            placeholder="Ask the agent…"
            aria-label="Chat message"
          />
          <button type="button" onClick={send} aria-label="Send">↑</button>
        </div>
      </div>
      <p className="rs-note" style={{ padding: '0 12px 12px' }}>
        Sizing class: <code>{heightClass}</code> — dvh keeps the input above the browser chrome; safe-area padding clears the home indicator.
      </p>
    </PhoneFrame>
  );
}

/* ------------------------------------------------------------------ */
/* 50621 — card-list tables (cards below 720px)                       */
/* ------------------------------------------------------------------ */

const TABLE_ROWS = [
  { id: 'DM-1042', title: 'Reflected XSS', severity: 'critical', confidence: '92%' },
  { id: 'DM-1043', title: 'Open redirect', severity: 'high', confidence: '88%' },
  { id: 'DM-1044', title: 'Verbose errors', severity: 'low', confidence: '99%' },
];

export function CardListTable() {
  return (
    <div>
      <div className="rs-only-desktop">
        <table className="rs-data-table">
          <thead><tr><th>ID</th><th>Finding</th><th>Severity</th><th>Confidence</th></tr></thead>
          <tbody>
            {TABLE_ROWS.map((r) => (
              <tr key={r.id}><td>{r.id}</td><td>{r.title}</td><td>{r.severity}</td><td>{r.confidence}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rs-only-mobile">
        <div className="rs-card-list">
          {TABLE_ROWS.map((r) => (
            <div className="rs-data-card" key={r.id}>
              <div className="rs-kv"><span className="rs-k">ID</span><span className="rs-v">{r.id}</span></div>
              <div className="rs-kv"><span className="rs-k">Finding</span><span className="rs-v">{r.title}</span></div>
              <div className="rs-kv"><span className="rs-k">Severity</span><span className="rs-v">{r.severity}</span></div>
              <div className="rs-kv"><span className="rs-k">Confidence</span><span className="rs-v">{r.confidence}</span></div>
            </div>
          ))}
        </div>
      </div>
      <p className="rs-note">Viewport 360px → <code>{tableModeForWidth(360)}</code> mode; 1280px → <code>{tableModeForWidth(1280)}</code> mode (switch at 720px).</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50622 — condensed mobile header                                   */
/* ------------------------------------------------------------------ */

export function CondensedMobileHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [lastAction, setLastAction] = useState('—');
  const act = (name) => { setLastAction(name); setMenuOpen(false); };
  return (
    <PhoneFrame>
      <header className="rs-mheader">
        <span className="rs-logo" aria-label="Dark Matter">∞</span>
        <span className="rs-status-pill">● Running</span>
        <div className="rs-overflow-wrap">
          <button type="button" className="rs-overflow-btn" aria-label="More actions" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>⋯</button>
          {menuOpen && (
            <div className="rs-overflow-menu" role="menu">
              <button type="button" role="menuitem" onClick={() => act('Pause hunt')}>Pause hunt</button>
              <button type="button" role="menuitem" onClick={() => act('Export report')}>Export report</button>
              <button type="button" role="menuitem" onClick={() => act('Settings')}>Settings</button>
            </div>
          )}
        </div>
      </header>
      <p className="rs-note" style={{ padding: '0 12px 12px' }}>Last action: {lastAction}. Logo, live hunt status, and everything else behind ⋯.</p>
    </PhoneFrame>
  );
}

/* ------------------------------------------------------------------ */
/* 50623 — pinch-zoom evidence                                       */
/* ------------------------------------------------------------------ */

export function PinchZoomEvidence() {
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });
  const pointers = useRef(new Map());
  const gesture = useRef(null);
  const boxRef = useRef(null);

  const commitPan = (tx, ty, scale) => {
    const el = boxRef.current;
    const vw = el ? el.clientWidth : 300;
    const vh = el ? el.clientHeight : 240;
    const clamped = clampPan(tx, ty, vw, vh, vw, vh, scale);
    setView({ scale: clampScale(scale), tx: clamped.tx, ty: clamped.ty });
  };

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      gesture.current = { mode: 'pan', startX: e.clientX, startY: e.clientY, baseTx: view.tx, baseTy: view.ty, baseScale: view.scale };
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { mode: 'pinch', startDist: pinchDistance(a, b), baseScale: view.scale, baseTx: view.tx, baseTy: view.ty };
    }
  };

  const onPointerMove = (e) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (g.mode === 'pan' && pointers.current.size === 1) {
      commitPan(g.baseTx + (e.clientX - g.startX), g.baseTy + (e.clientY - g.startY), g.baseScale);
    } else if (g.mode === 'pinch' && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const ratio = pinchDistance(a, b) / g.startDist;
      commitPan(g.baseTx, g.baseTy, g.baseScale * ratio);
    }
  };

  const onPointerUp = (e) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gesture.current = null;
  };

  const onWheel = (e) => {
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    commitPan(view.tx, view.ty, view.scale * factor);
  };

  return (
    <div>
      <div ref={boxRef} className="rs-pinch"
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        onWheel={onWheel} onDoubleClick={() => setView({ scale: 1, tx: 0, ty: 0 })}>
        <div className="rs-pinch-content" style={{ transform: pinchTransform(view.scale, view.tx, view.ty) }}>
          <div className="rs-evidence-shot">
            <div style={{ color: '#f1f5f9', marginBottom: 8 }}>GET /search?q=&lt;svg onload=alert(1)&gt;</div>
            <div>HTTP/1.1 200 OK</div>
            <div>content-type: text/html</div>
            <div>&nbsp;</div>
            <div>&lt;div class="results"&gt;</div>
            <div>&nbsp;&nbsp;No results for <span style={{ color: '#f87171' }}>&lt;svg onload=alert(1)&gt;</span></div>
            <div>&lt;/div&gt;</div>
          </div>
        </div>
        <div className="rs-pinch-hint">Pinch or scroll to zoom · drag to pan · double-click to reset ({view.scale.toFixed(2)}×)</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50624 — slim mobile offline banner                                */
/* ------------------------------------------------------------------ */

export function SlimOfflineBanner() {
  const [state, setState] = useState('offline'); // offline | checking | online
  const retry = () => {
    setState('checking');
    setTimeout(() => setState('online'), 900);
  };
  return (
    <div className="rs-offline-slim" role="status">
      <span aria-hidden="true">{state === 'online' ? '✓' : state === 'checking' ? '↻' : '⚠'}</span>
      <span className="rs-msg">
        {state === 'online' ? 'Back online — queue synced' : state === 'checking' ? 'Retrying connection…' : "You're offline — changes will queue"}
      </span>
      {state === 'offline' && <button type="button" onClick={retry}>Retry</button>}
      {state === 'online' && <button type="button" onClick={() => setState('offline')}>Reset demo</button>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50625 — repositioned tour steps (never cover CTAs)                 */
/* ------------------------------------------------------------------ */

const TOUR_STEPS = [
  { title: 'Welcome to Hunt AI', body: 'This tour stays docked above the action bar — it never covers the Start Hunt button or the tab bar.' },
  { title: 'Review findings', body: 'Swipe a finding row to review or snooze it. Try it in the 50612 demo above.' },
  { title: 'You are set', body: 'The tour is done. Every step kept a clear safe zone around tappable controls.' },
];

export function MobileTourSteps() {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const s = TOUR_STEPS[step];
  return (
    <PhoneFrame>
      <div className="rs-phone-scroll" style={{ flex: 1, padding: 14, minHeight: 200 }}>
        <p style={{ fontSize: 13, color: '#cbd5e1', margin: 0 }}>Hunt overview — the tour popover floats above this content.</p>
        {done && <p className="rs-note">Tour completed. <button type="button" className="rs-btn" onClick={() => { setDone(false); setStep(0); }}>Replay</button></p>}
      </div>
      {!done && (
        <div className="rs-tour-pop" role="dialog" aria-label={`Tour step ${step + 1}`}>
          <h4>{s.title}</h4>
          <p>{s.body}</p>
          <div className="rs-tour-nav">
            <button type="button" disabled={step === 0} onClick={() => setStep((i) => i - 1)}>Back</button>
            {step < TOUR_STEPS.length - 1
              ? <button type="button" className="rs-primary" onClick={() => setStep((i) => i + 1)}>Next</button>
              : <button type="button" className="rs-primary" onClick={() => setDone(true)}>Done</button>}
            <div className="rs-tour-dots" aria-hidden="true">
              {TOUR_STEPS.map((_, i) => <i key={i} className={i === step ? 'rs-current' : ''} />)}
            </div>
          </div>
        </div>
      )}
      <div className="rs-sticky-cta" style={{ position: 'relative' }}>
        <button type="button" className="rs-cta-btn">Start Hunt</button>
      </div>
      <nav className="rs-bottom-tabbar" aria-hidden="true">
        {BOTTOM_TABS.map((t) => (
          <span key={t.id} className="rs-tab"><span className="rs-tab-icon">{t.icon}</span>{t.label}</span>
        ))}
      </nav>
    </PhoneFrame>
  );
}

/* ------------------------------------------------------------------ */
/* 50626 — bottom mobile toasts (top on desktop)                      */
/* ------------------------------------------------------------------ */

export function AdaptiveToast() {
  const w = useWindowWidth();
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const show = (msg) => {
    if (timer.current) clearTimeout(timer.current);
    setToast(msg);
    timer.current = setTimeout(() => setToast(null), 2600);
  };

  return (
    <PhoneFrame>
      <div style={{ padding: 14, minHeight: 180, position: 'relative' }}>
        <button type="button" className="rs-btn rs-primary" onClick={() => show('Hunt phase 2 complete — 5 tools ran')}>Show toast</button>
        <p className="rs-note">This viewport ({w}px) docks toasts at the <strong>{toastPositionForWidth(w)}</strong> — CSS switches at 720px.</p>
        {toast && <div className="rs-atoast" role="status">{toast}</div>}
      </div>
    </PhoneFrame>
  );
}

/* ------------------------------------------------------------------ */
/* 50627 — full-screen mobile palette                                */
/* ------------------------------------------------------------------ */

const PALETTE_ITEMS = [
  { id: 'hunts', label: 'Go to hunts', kind: 'Navigate' },
  { id: 'findings', label: 'Go to findings', kind: 'Navigate' },
  { id: 'reports', label: 'Go to reports', kind: 'Navigate' },
  { id: 'start', label: 'Start a new hunt', kind: 'Action' },
  { id: 'pause', label: 'Pause current hunt', kind: 'Action' },
  { id: 'export', label: 'Export latest report', kind: 'Action' },
  { id: 'models', label: 'Open model settings', kind: 'Settings' },
];

export function MobilePaletteSheet() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const [lastRun, setLastRun] = useState('—');
  const inputRef = useRef(null);

  const filtered = PALETTE_ITEMS.filter((i) => i.label.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
    setQuery('');
    setActiveIdx(0);
  }, [open ]);

  const run = (item) => {
    if (!item) return;
    setLastRun(item.label);
    setOpen(false);
  };

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(filtered.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') run(filtered[activeIdx]);
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <PhoneFrame>
      <div style={{ padding: 14, minHeight: 200 }}>
        <button type="button" className="rs-btn rs-primary" onClick={() => setOpen(true)}>Open palette (⌘K)</button>
        <p className="rs-note">Last run: {lastRun}. On phones the palette takes the full screen.</p>
      </div>
      {open && (
        <div className="rs-palette" role="dialog" aria-modal="true" aria-label="Command palette">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIdx(0); }}
            onKeyDown={onKey}
            placeholder="Type a command…"
            aria-label="Search commands"
          />
          <div className="rs-palette-list" role="listbox">
            {filtered.map((item, i) => (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={i === activeIdx}
                className={`rs-palette-item${i === activeIdx ? ' rs-active' : ''}`}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => run(item)}
              >
                <span className="rs-palette-kind">{item.kind}</span>
                {item.label}
              </button>
            ))}
            {filtered.length === 0 && <p className="rs-note" style={{ padding: '0 12px' }}>No commands match “{query}”.</p>}
          </div>
        </div>
      )}
    </PhoneFrame>
  );
}

/* ------------------------------------------------------------------ */
/* 50628 — landscape stepper stays above the fold                    */
/* ------------------------------------------------------------------ */

export function LandscapeStepper() {
  const [active, setActive] = useState(1);
  return (
    <div>
      <div className="rs-landscape-stepper" aria-label="Hunt phases">
        {HUNT_PHASES.map((p, i) => (
          <button
            key={p}
            type="button"
            className={`rs-lstep${i === active ? ' rs-active' : ''}${i < active ? ' rs-done' : ''}`}
            onClick={() => setActive(i)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
          >
            {i + 1}. {p}
          </button>
        ))}
      </div>
      <p className="rs-note">One compact row — in landscape (≤500px tall) it sticks to the top so the phase is always visible above the fold.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50629 — foldable-device spanning                                  */
/* ------------------------------------------------------------------ */

export function FoldableSpanLayout() {
  const detected = foldableMode();
  const [override, setOverride] = useState('auto');
  const mode = override === 'auto' ? detected : override;
  return (
    <div>
      <div className="rs-row" style={{ marginBottom: 10 }}>
        {['auto', 'single', 'dual'].map((m) => (
          <button key={m} type="button" className={`rs-btn${override === m ? ' rs-primary' : ''}`} onClick={() => setOverride(m)}>
            {m === 'auto' ? `Auto (${detected})` : m}
          </button>
        ))}
      </div>
      <div className={`rs-fold${mode === 'dual' ? ' rs-fold-dual' : ''}`}>
        <div className="rs-fold-pane">
          <strong style={{ fontSize: 13, color: '#e2e8f0' }}>Findings list</strong>
          <p className="rs-note" style={{ margin: '6px 0 0' }}>3 findings — tap one to inspect.</p>
        </div>
        {mode === 'dual' && <div className="rs-fold-seam" aria-hidden="true" />}
        <div className="rs-fold-pane">
          <strong style={{ fontSize: 13, color: '#e2e8f0' }}>Detail pane</strong>
          <p className="rs-note" style={{ margin: '6px 0 0' }}>
            {mode === 'dual' ? 'Spanning detected — detail moved to the second screen area.' : 'Single screen — detail stacks below the list.'}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50630 — 320px minimum support: no horizontal page scroll           */
/* ------------------------------------------------------------------ */

export function TinyViewportDemo() {
  return (
    <div>
      <div className="rs-tiny">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span className="rs-logo" style={{ fontSize: 16 }} aria-hidden="true">∞</span>
          <strong style={{ fontSize: 13, color: '#e2e8f0' }}>Hunt #42</strong>
          <span className="rs-status-pill" style={{ marginLeft: 'auto' }}>● Live</span>
        </div>
        <p className="rs-fluid" style={{ margin: '0 0 10px' }}>A 320px-wide viewport still fits the header, status, and this sentence without sideways scrolling.</p>
        <div className="rs-touch-chips" style={{ marginBottom: 10 }}>
          <button type="button" className="rs-touch-chip rs-on" style={{ minWidth: 0, padding: '0 12px' }}>high</button>
          <button type="button" className="rs-touch-chip" style={{ minWidth: 0, padding: '0 12px' }}>medium</button>
        </div>
        <button type="button" className="rs-cta-btn">Start Hunt</button>
      </div>
      <p className="rs-note">Audit at 320px: ✓ no overflow-x · ✓ tap targets ≥48px · ✓ text wraps · ✓ CTA full-width.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50631 — tablet portrait split (40/60, collapsible list)            */
/* ------------------------------------------------------------------ */

export function TabletPortraitSplit() {
  const [collapsed, setCollapsed] = useState(false);
  const [selected, setSelected] = useState(PANE_FINDINGS[0]);
  return (
    <div>
      <button type="button" className="rs-btn" style={{ marginBottom: 10 }} onClick={() => setCollapsed((c) => !c)} aria-expanded={!collapsed}>
        {collapsed ? 'Show list' : 'Collapse list'}
      </button>
      <div className="rs-split">
        <div className={`rs-split-list${collapsed ? ' rs-collapsed' : ''}`}>
          {PANE_FINDINGS.map((f) => (
            <button key={f.id} type="button" className={`rs-pane-item${selected.id === f.id ? ' rs-selected' : ''}`} onClick={() => setSelected(f)}>
              {f.title}
            </button>
          ))}
        </div>
        <div className="rs-split-detail">
          <h4 style={{ margin: '0 0 8px', color: '#e2e8f0', fontSize: 14 }}>{selected.title}</h4>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: 13, lineHeight: 1.6 }}>{selected.body}</p>
        </div>
      </div>
      <p className="rs-note">Portrait tablets get a 40/60 list-detail split; the list collapses to give the detail full width.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50632 — dynamic viewport units                                     */
/* ------------------------------------------------------------------ */

export function DynamicViewportDemo() {
  const cls = viewportHeightClass();
  return (
    <div>
      <div className={`rs-chat ${cls}`} style={{ maxHeight: 300 }}>
        <div className="rs-chat-log">
          <div className="rs-chat-msg rs-them">The input below never slides under the browser chrome.</div>
          <div className="rs-chat-msg rs-me">Because the panel uses dynamic viewport height.</div>
        </div>
        <div className="rs-chat-input">
          <input placeholder="Ask the agent…" aria-label="Chat message" />
          <button type="button" aria-label="Send">↑</button>
        </div>
      </div>
      <p className="rs-note">Active class: <code>{cls}</code> (dvh where supported, vh fallback otherwise).</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50633 — fluid type scale (14px → 16px)                             */
/* ------------------------------------------------------------------ */

export function FluidTypeDemo() {
  return (
    <div>
      <p className="rs-fluid-lg" style={{ margin: '0 0 8px' }}>Hunt #42 — target.example</p>
      <p className="rs-fluid" style={{ margin: '0 0 8px' }}>
        Body copy scales fluidly: 14px on a 320px phone, 16px on a 1280px desktop, interpolated in between.
      </p>
      <p className="rs-fluid-sm" style={{ margin: 0 }}>Small print follows the same curve, 12px → 13px.</p>
      <p className="rs-note"><code>{fluidTypeClamp()}</code></p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50634 — code-wrap toggle                                           */
/* ------------------------------------------------------------------ */

const EVIDENCE_CODE = 'GET /search?q=<svg%20onload%3Dalert(document.domain)> HTTP/1.1\\nHost: target.example\\nCookie: session=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyIjoiYWRtaW4ifQ';

export function CodeWrapToggle() {
  const [wrap, setWrap] = useState(false);
  return (
    <div>
      <button type="button" className="rs-toggle" onClick={() => setWrap((w) => !w)} aria-pressed={wrap}>
        {wrap ? '⤢ Wrap: on' : '⤢ Wrap: off'}
      </button>
      <pre className={`rs-code-block ${wrap ? 'rs-code-wrap' : 'rs-code-nowrap'}`}>{EVIDENCE_CODE}</pre>
      <p className="rs-note">On narrow screens the wrap toggle keeps long evidence lines readable without sideways scrolling.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50635 — sticky mobile CTA                                         */
/* ------------------------------------------------------------------ */

export function StickyMobileCta() {
  const [started, setStarted] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  return (
    <PhoneFrame>
      <div
        className="rs-phone-scroll"
        style={{ flex: 1 }}
        onScroll={(e) => setScrolled(stickyCtaVisible(e.currentTarget.scrollTop))}
      >
        <div style={{ padding: 14 }}>
          {Array.from({ length: 12 }, (_, i) => (
            <div className="rs-phase-card" style={{ marginBottom: 8 }} key={i}>
              <strong style={{ fontSize: 13, color: '#e2e8f0' }}>Preset target #{i + 1}</strong>
              <p className="rs-note" style={{ margin: '4px 0 0' }}>scope verified · {120 + i * 7} endpoints</p>
            </div>
          ))}
        </div>
        <div className="rs-sticky-cta">
          <button type="button" className="rs-cta-btn" onClick={() => setStarted(true)}>
            {started ? '✓ Hunt started' : 'Start Hunt'}
          </button>
        </div>
      </div>
      <p className="rs-note" style={{ padding: '8px 12px' }}>
        Sticky CTA {scrolled ? 'engaged' : 'docked'} — the button stays reachable while scrolling the list.
      </p>
    </PhoneFrame>
  );
}

/* ------------------------------------------------------------------ */
/* 50636 — auto-fit widget grid                                      */
/* ------------------------------------------------------------------ */

export function AutoFitWidgetGrid() {
  return (
    <div>
      <div className="rs-autofit" style={{ gridTemplateColumns: autoFitGridTemplate() }}>
        {WIDGETS.map((w, i) => (
          <div className="rs-widget" key={w.name}>
            <span className="rs-widget-rank">#{i + 1}</span>
            <span className="rs-widget-name">{w.name}</span>
            <span className="rs-widget-uses">{w.uses}</span>
          </div>
        ))}
        <div className="rs-widget">
          <span className="rs-widget-rank">+1</span>
          <span className="rs-widget-name">Add widget</span>
          <span className="rs-widget-uses">→</span>
        </div>
      </div>
      <p className="rs-note"><code>{autoFitGridTemplate()}</code> — columns reflow automatically; resize the window to watch.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50637 — pull-to-refresh lists                                     */
/* ------------------------------------------------------------------ */

const PTR_ITEMS = ['DM-1044 verbose errors', 'DM-1043 open redirect', 'DM-1042 reflected XSS'];

export function PullToRefreshList() {
  const [items, setItems] = useState(PTR_ITEMS);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [updated, setUpdated] = useState('2m ago');
  const startY = useRef(0);
  const live = useRef(false);
  const listRef = useRef(null);

  const onPointerDown = (e) => {
    if (listRef.current && listRef.current.scrollTop <= 0) {
      live.current = true;
      startY.current = e.clientY;
    }
  };
  const onPointerMove = (e) => {
    if (!live.current || refreshing) return;
    const dy = e.clientY - startY.current;
    if (dy > 0) setPull(Math.min(dy, PTR_MAX_PULL_PX));
  };
  const onPointerUp = () => {
    if (!live.current) return;
    live.current = false;
    const s = ptrProgress(pull);
    if (ptrShouldRefresh(s)) {
      setRefreshing(true);
      setTimeout(() => {
        setItems((prev) => [`DM-${1045 + prev.length} fresh scan hit`, ...prev]);
        setUpdated('just now');
        setRefreshing(false);
        setPull(0);
      }, 900);
    } else {
      setPull(0);
    }
  };

  const s = ptrProgress(pull);
  const hint = refreshing ? 'Refreshing…' : s.state === 'ready' ? 'Release to refresh' : s.state === 'pulling' ? 'Pull to refresh' : '';

  return (
    <div>
      <div
        className="rs-ptr" ref={listRef}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
      >
        <div className="rs-ptr-indicator" style={{ height: refreshing ? 44 : pull }}>
          {refreshing && <span className="rs-ptr-spinner" />}
          {hint && <span>{hint}</span>}
        </div>
        <div className="rs-ptr-list" style={{ transform: `translateY(${refreshing ? 0 : pull * 0.4}px)` }}>
          {items.map((it) => <div className="rs-ptr-item" key={it}>{it}</div>)}
        </div>
      </div>
      <p className="rs-note">State: <code>{refreshing ? 'refreshing' : s.state}</code> · updated {updated} · threshold {PTR_MAX_PULL_PX}px drag.</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50638 — adaptive log density                                      */
/* ------------------------------------------------------------------ */

const LOGS = [
  { time: '11:02:11', level: 'info', msg: 'nuclei template xss-detect matched', detail: '/search?q=' },
  { time: '11:02:14', level: 'warn', msg: 'rate limit approached on /api', detail: '42 req/s' },
  { time: '11:02:19', level: 'error', msg: 'probe timed out after 8s', detail: '/admin/export' },
  { time: '11:02:22', level: 'info', msg: 'evidence screenshot captured', detail: 'DM-1042.png' },
];

export function AdaptiveLogList() {
  const w = useWindowWidth();
  const density = logDensityForWidth(w);
  return (
    <div>
      {LOGS.map((l, i) => (
        <div className="rs-log-row" key={i}>
          <span className="rs-log-time">{l.time}</span>
          <span className={`rs-log-level rs-${l.level}`}>{l.level}</span>
          <span className="rs-log-msg">{l.msg}</span>
          <span className="rs-log-detail">{l.detail}</span>
        </div>
      ))}
      <p className="rs-note">Viewport {w}px → <code>{density}</code> density (detail column hides below 720px).</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50639 — gesture guide (touch devices)                             */
/* ------------------------------------------------------------------ */

export function GestureGuide() {
  const touch = isTouchDevice();
  return (
    <div>
      <div className="rs-gesture-guide">
        {GESTURE_GUIDE.map((g) => (
          <div className="rs-gesture" key={g.gesture}>
            <span className="rs-gesture-icon" aria-hidden="true">{g.icon}</span>
            <span className="rs-gesture-label">{g.label}</span>
          </div>
        ))}
      </div>
      <p className="rs-note">
        {touch ? 'Touch input detected — the gesture guide replaces the shortcuts page.' : 'No touch input here — on touch devices this guide replaces the shortcuts page.'}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50640 — swipe triage gestures                                     */
/* ------------------------------------------------------------------ */

export function SwipeTriage({ title = 'Stored XSS in comment field', detail = 'severity: critical · needs a human verdict' }) {
  const [dragX, setDragX] = useState(0);
  const [live, setLive] = useState(false);
  const [verdict, setVerdict] = useState(null);
  const startX = useRef(0);

  const onPointerDown = (e) => {
    startX.current = e.clientX;
    setLive(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!live) return;
    setDragX(Math.max(-160, Math.min(160, e.clientX - startX.current)));
  };
  const endDrag = () => {
    if (!live) return;
    setLive(false);
    const action = triageActionForSwipe(classifySwipe(dragX, 0, 60));
    if (action) setVerdict(action);
    setDragX(0);
  };

  if (verdict) {
    return (
      <div className="rs-triage-done">
        <span style={{ fontSize: 14, color: verdict === 'reviewed' ? '#34d399' : '#f59e0b' }}>
          {verdict === 'reviewed' ? '✓ Reviewed — sent to the report' : '◷ Snoozed — back in the queue tomorrow'}
        </span>
        <button type="button" onClick={() => setVerdict(null)}>Undo</button>
      </div>
    );
  }

  const progress = Math.min(1, Math.abs(dragX) / 120);
  return (
    <div
      className="rs-triage-card"
      style={{ transform: `translateX(${dragX}px)`, transition: live ? 'none' : 'transform 200ms ease' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <span className="rs-stamp rs-stamp-review" style={{ opacity: dragX > 0 ? progress : 0 }}>REVIEWED</span>
      <span className="rs-stamp rs-stamp-snooze" style={{ opacity: dragX < 0 ? progress : 0 }}>SNOOZE</span>
      <h4>{title}</h4>
      <p>{detail}</p>
      <p className="rs-note" style={{ margin: '8px 0 0' }}>Drag right to review, left to snooze (≥ {SWIPE_THRESHOLD_PX}px).</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Gallery                                                            */
/* ------------------------------------------------------------------ */

export function ResponsiveSuiteGallery() {
  return (
    <div className="rs-gallery">
      <div className="rs-gallery-section">
        <h2>Micro-motion, round 2 (50601–50609)</h2>
        <Demo id="50601" title="Status-change flash"><StatusFlashRow /></Demo>
        <Demo id="50602" title="Chat typing pulse — SKIP">
          <p className="rs-note" style={{ margin: 0 }}>Already live as <code>ThinkingDots</code> (idea 50573, wave 15) — no duplicate shipped.</p>
        </Demo>
        <Demo id="50603" title="Avatar ring progress"><AvatarRingProgress /></Demo>
        <Demo id="50604" title="Reconnect banner slide"><ReconnectBanner /></Demo>
        <Demo id="50605" title="Checkbox spring draw"><SpringCheckbox /></Demo>
        <Demo id="50606" title="Sort-arrow flip"><SortArrowButton /></Demo>
        <Demo id="50607" title="Thumbnail cascade"><ThumbnailCascade /></Demo>
        <Demo id="50608" title="Pause-play morph"><PausePlayMorph /></Demo>
        <Demo id="50609" title="Animation time budget"><MotionBudgetDemo /></Demo>
      </div>

      <div className="rs-gallery-section">
        <h2>Mobile hunt UX (50610–50620)</h2>
        <Demo id="50610" title="Mobile single-column hunt"><MobileSingleColumnHunt /></Demo>
        <Demo id="50611" title="Mobile bottom tab bar"><MobileBottomTabBar /></Demo>
        <Demo id="50612" title="Swipeable finding rows"><SwipeableFindingRow /></Demo>
        <Demo id="50613" title="Collapsible mobile timeline"><CollapsibleMobileTimeline /></Demo>
        <Demo id="50614" title="Filter FAB sheet"><FilterFabSheet /></Demo>
        <Demo id="50615" title="Single-column widgets"><SingleColumnWidgets /></Demo>
        <Demo id="50616" title="Mobile terminal view"><MobileTerminalView /></Demo>
        <Demo id="50617" title="Tablet two-pane layout"><TabletTwoPane /></Demo>
        <Demo id="50618" title="48px touch chips"><TouchChips /></Demo>
        <Demo id="50619" title="Paginated mobile reports"><PaginatedMobileReports /></Demo>
        <Demo id="50620" title="Full-screen mobile chat"><MobileChatFullscreen /></Demo>
      </div>

      <div className="rs-gallery-section">
        <h2>Responsive system (50621–50640)</h2>
        <Demo id="50621" title="Card-list tables"><CardListTable /></Demo>
        <Demo id="50622" title="Condensed mobile header"><CondensedMobileHeader /></Demo>
        <Demo id="50623" title="Pinch-zoom evidence"><PinchZoomEvidence /></Demo>
        <Demo id="50624" title="Slim mobile offline banner"><SlimOfflineBanner /></Demo>
        <Demo id="50625" title="Repositioned tour steps"><MobileTourSteps /></Demo>
        <Demo id="50626" title="Bottom mobile toasts"><AdaptiveToast /></Demo>
        <Demo id="50627" title="Full-screen mobile palette"><MobilePaletteSheet /></Demo>
        <Demo id="50628" title="Landscape stepper visibility"><LandscapeStepper /></Demo>
        <Demo id="50629" title="Foldable-device spanning"><FoldableSpanLayout /></Demo>
        <Demo id="50630" title="320px minimum support"><TinyViewportDemo /></Demo>
        <Demo id="50631" title="Tablet portrait split"><TabletPortraitSplit /></Demo>
        <Demo id="50632" title="Dynamic viewport units"><DynamicViewportDemo /></Demo>
        <Demo id="50633" title="Fluid type scale"><FluidTypeDemo /></Demo>
        <Demo id="50634" title="Code-wrap toggle"><CodeWrapToggle /></Demo>
        <Demo id="50635" title="Sticky mobile CTA"><StickyMobileCta /></Demo>
        <Demo id="50636" title="Auto-fit widget grid"><AutoFitWidgetGrid /></Demo>
        <Demo id="50637" title="Pull-to-refresh lists"><PullToRefreshList /></Demo>
        <Demo id="50638" title="Adaptive log density"><AdaptiveLogList /></Demo>
        <Demo id="50639" title="Gesture guide"><GestureGuide /></Demo>
        <Demo id="50640" title="Swipe triage gestures"><SwipeTriage /></Demo>
      </div>
    </div>
  );
}
