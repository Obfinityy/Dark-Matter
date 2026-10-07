/**
 * MicroMotion.jsx — Forge wave 15 (ideas 50561–50600).
 *
 * Micro-interaction + motion-design round: 40 real working motion components
 * (CSS-driven via MicroMotion.css) plus the `MicroMotionGallery` reference
 * gallery. Every animation respects prefers-reduced-motion.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  standardCheckmarkProps,
  countUpFrames,
  thinkingDotDelayMs,
  THINKING_DOT_COUNT,
  donutSegments,
  gaugeNeedleDegrees,
  staggerDelayMs,
  shakeKeyframes,
  reasoningHeightStyle,
  shouldReduceMotion,
  SAVE_HOLD_MS,
  SIDEBAR_WIDTH_OPEN_PX,
  SIDEBAR_WIDTH_CLOSED_PX,
} from './motionCore.js';
import './MicroMotion.css';

/* ------------------------------------------------------------------ */
/* 50561 — self-drawing checkmark                                      */
/* ------------------------------------------------------------------ */
export function SelfDrawingCheckmark({ size = 24, auto = true, className = '' }) {
  const segs = standardCheckmarkProps();
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    if (!auto || shouldReduceMotion()) { setDrawn(true); return; }
    const t = requestAnimationFrame(() => requestAnimationFrame(() => setDrawn(true)));
    return () => cancelAnimationFrame(t);
  }, [auto]);
  return (
    <svg className={`mm-checkmark ${drawn ? 'mm-drawn' : ''} ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {segs.map((s, i) => (
        <path key={i} d={s.path} strokeWidth="2.2" strokeLinecap="round"
          strokeDasharray={s.strokeDasharray} strokeDashoffset={s.strokeDashoffset}
          style={{ transitionDelay: `${i * 220}ms`, stroke: 'var(--success)' }} />
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 50562 — pill hover scale                                            */
/* ------------------------------------------------------------------ */
export function HoverPill({ children, tone = '#0ea5e9', className = '' }) {
  return (
    <span className={`mm-pill ${className}`} style={{ background: `${tone}22`, color: tone, border: `1px solid ${tone}55` }}>
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* 50563 — button press feedback                                       */
/* ------------------------------------------------------------------ */
export function PressButton({ children, onClick, className = '', ...rest }) {
  return (
    <button className={`mm-pressable ${className}`} onClick={onClick} {...rest}>{children}</button>
  );
}

/* ------------------------------------------------------------------ */
/* 50564 — sliding tab indicator                                       */
/* ------------------------------------------------------------------ */
export function SlidingTabs({ tabs = [], active = 0, onChange }) {
  const barRef = useRef(null);
  const [glider, setGlider] = useState({ left: 0, width: 0 });
  const update = useCallback(() => {
    const el = barRef.current?.children[active];
    if (el) setGlider({ left: el.offsetLeft, width: el.offsetWidth });
  }, [active]);
  useEffect(() => { update(); window.addEventListener('resize', update); return () => window.removeEventListener('resize', update); }, [update, tabs.length]);
  return (
    <div className="mm-tabs" role="tablist" ref={barRef}>
      {tabs.map((t, i) => (
        <button key={t} role="tab" aria-selected={i === active} className={`mm-tab ${i === active ? 'mm-tab-active' : ''}`} onClick={() => onChange?.(i)}>{t}</button>
      ))}
      <span className="mm-tab-glider" style={{ left: glider.left, width: glider.width }} aria-hidden="true" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50565 — chevron rotation                                            */
/* ------------------------------------------------------------------ */
export function RotatingChevron({ open, size = 16 }) {
  return (
    <svg className={`mm-chevron ${open ? 'mm-open' : ''}`} width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 50566 — stat count-up                                               */
/* ------------------------------------------------------------------ */
export function CountUpStat({ target, label, durationMs }) {
  const [value, setValue] = useState(shouldReduceMotion() ? target : 0);
  useEffect(() => {
    if (shouldReduceMotion()) { setValue(target); return; }
    const { frames, durationMs: dur } = countUpFrames(target, durationMs ? { durationMs } : {});
    let i = 0; const step = Math.max(1, Math.round(dur / frames.length));
    const id = setInterval(() => { i += 1; setValue(frames[Math.min(i, frames.length - 1)]); if (i >= frames.length) clearInterval(id); }, step);
    return () => clearInterval(id);
  }, [target, durationMs]);
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {label && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50567 — progress shimmer sweep (indeterminate → determinate)        */
/* ------------------------------------------------------------------ */
export function ShimmerProgress({ value = null }) {
  const determinate = typeof value === 'number';
  return (
    <div className={`mm-progress ${determinate ? '' : 'mm-progress-indeterminate'}`} role="progressbar"
      aria-valuenow={determinate ? value : undefined} aria-valuemin={0} aria-valuemax={100}>
      {determinate && <div className="mm-progress-fill" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50568 — toast slide-fade                                            */
/* ------------------------------------------------------------------ */
export function SlideFadeToast({ message, tone = '#0ea5e9', leaving = false }) {
  return (
    <div className={`mm-toast ${leaving ? 'mm-leaving' : ''}`}
      style={{ background: 'var(--bg-secondary)', border: `1px solid ${tone}66`, borderLeft: `3px solid ${tone}`,
        borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 13, color: 'var(--text-primary)', marginBottom: 8 }}
      role="status">
      {message}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50569 — diagonal skeleton sweep                                     */
/* ------------------------------------------------------------------ */
export function DiagonalSkeleton({ width = '100%', height = 14 }) {
  return <div className="mm-skeleton" style={{ width, height }} aria-hidden="true" />;
}

/* ------------------------------------------------------------------ */
/* 50570 — terminal line fade                                          */
/* ------------------------------------------------------------------ */
export function TerminalLine({ children }) {
  return <div className="mm-terminal-line" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, color: 'var(--accent-secondary)' }}>{children}</div>;
}

/* ------------------------------------------------------------------ */
/* 50571 — timeline dot pop                                            */
/* ------------------------------------------------------------------ */
export function TimelineDot({ color = 'var(--accent)', size = 10, bounceKey = 0 }) {
  return <span key={bounceKey} className="mm-timeline-dot" style={{ display: 'inline-block', width: size, height: size, borderRadius: '50%', background: color }} aria-hidden="true" />;
}

/* ------------------------------------------------------------------ */
/* 50572 — filter-pill morph                                           */
/* ------------------------------------------------------------------ */
export function MorphPill({ label, onRemove }) {
  const [leaving, setLeaving] = useState(false);
  return (
    <span className={`mm-pill mm-pill-in ${leaving ? 'mm-pill-out' : ''}`}
      style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
      {label}
      <button aria-label={`Remove ${label}`} onClick={() => { setLeaving(true); setTimeout(() => onRemove?.(), 260); }}
        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 2, lineHeight: 1, minWidth: 24, minHeight: 24, borderRadius: 6 }}>×</button>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* 50573 — thinking-dot wave                                           */
/* ------------------------------------------------------------------ */
export function ThinkingDots({ label = 'Agent reasoning' }) {
  return (
    <span className="mm-thinking" role="status" aria-label={label}>
      {Array.from({ length: THINKING_DOT_COUNT }, (_, i) => (
        <span key={i} className="mm-thinking-dot" style={{ animationDelay: `${thinkingDotDelayMs(i)}ms` }} aria-hidden="true" />
      ))}
      <span className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{label}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* 50574 — card hover lift                                             */
/* ------------------------------------------------------------------ */
export function LiftCard({ children, className = '', style }) {
  return <div className={`mm-card ${className}`} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 16, ...style }}>{children}</div>;
}

/* ------------------------------------------------------------------ */
/* 50575 — modal scale-in                                              */
/* ------------------------------------------------------------------ */
export function ScaleModal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="mm-backdrop" onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.7)', display: 'grid', placeItems: 'center', zIndex: 50, padding: 16 }} role="presentation">
      <div className="mm-panel" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 20, maxWidth: 480, width: '100%', boxShadow: 'var(--shadow-md)' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16, color: 'var(--text-primary)' }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50576 — confidence fill ease                                        */
/* ------------------------------------------------------------------ */
export function ConfidenceFill({ value, animate = true }) {
  const [w, setW] = useState(animate && !shouldReduceMotion() ? 0 : value);
  useEffect(() => {
    if (!animate || shouldReduceMotion()) { setW(value); return; }
    const t = requestAnimationFrame(() => requestAnimationFrame(() => setW(value)));
    return () => cancelAnimationFrame(t);
  }, [value, animate]);
  return (
    <div className="mm-confidence-track" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className="mm-confidence-fill" style={{ width: `${w}%`, background: w >= 80 ? 'var(--success)' : w >= 50 ? 'var(--warning)' : 'var(--danger)' }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50577 — donut segment sweep                                         */
/* ------------------------------------------------------------------ */
export function DonutSweep({ counts, size = 140 }) {
  const { segments, circumference } = donutSegments(counts);
  const r = 54, cx = 70, cy = 70;
  const colors = { critical: 'var(--danger)', high: 'var(--warning)', medium: 'var(--warning)', low: 'var(--success)', info: 'var(--info)' };
  return (
    <svg width={size} height={size} viewBox="0 0 140 140" role="img" aria-label={`Severity distribution: ${JSON.stringify(counts)}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth="14" />
      {segments.map((s) => (
        <circle key={s.key} className="mm-donut-seg" cx={cx} cy={cy} r={r} fill="none"
          strokeWidth="14" strokeDasharray={s.strokeDasharray} strokeDashoffset={s.strokeDashoffset}
          strokeLinecap="butt" transform={`rotate(-90 ${cx} ${cy})`} style={{ animationDelay: `${s.sweepDelayMs}ms`, stroke: colors[s.key] }} />
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 50578 — drop-zone pulse                                             */
/* ------------------------------------------------------------------ */
export function PulseDropZone({ children, onFiles }) {
  const [over, setOver] = useState(false);
  return (
    <div className={`mm-dropzone ${over ? 'mm-drag-over' : ''}`}
      style={{ padding: 28, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onFiles?.(Array.from(e.dataTransfer.files)); }}>
      {children || 'Drop evidence files here'}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50579 — spring toggles                                              */
/* ------------------------------------------------------------------ */
export function SpringToggle({ checked, onChange, label }) {
  return (
    <button className={`mm-toggle ${checked ? 'mm-on' : ''}`} role="switch" aria-checked={checked} aria-label={label}
      onClick={() => onChange?.(!checked)}>
      <span className="mm-toggle-knob" />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* 50580 — smooth auto-scroll (respect user scroll-up)                 */
/* ------------------------------------------------------------------ */
export function SmoothScroller({ children, maxHeight = 220, className = '' }) {
  const ref = useRef(null);
  const [userUp, setUserUp] = useState(false);
  const scrollToBottom = useCallback(() => {
    const el = ref.current;
    if (!el || userUp) return;
    el.scrollTo({ top: el.scrollHeight, behavior: shouldReduceMotion() ? 'auto' : 'smooth' });
  }, [userUp]);
  return (
    <div ref={ref} className={`mm-smooth-scroll ${className}`} style={{ maxHeight, overflowY: 'auto' }}
      onScroll={(e) => { const el = e.currentTarget; setUserUp(el.scrollHeight - el.scrollTop - el.clientHeight > 40); }}
      data-scroll-bottom={scrollToBottom}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50581 — completion ring pulse                                       */
/* ------------------------------------------------------------------ */
export function CompletionRing({ children, size = 88 }) {
  return (
    <div className="mm-completion-ring" style={{ width: size, height: size, display: 'grid', placeItems: 'center', background: 'color-mix(in srgb, var(--success) 15%, transparent)', border: '2px solid var(--success)' }}>
      {children || <SelfDrawingCheckmark auto={false} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50582 — gauge needle sweep                                          */
/* ------------------------------------------------------------------ */
export function GaugeNeedle({ score, label = 'Risk' }) {
  const deg = gaugeNeedleDegrees(score);
  return (
    <div style={{ textAlign: 'center' }}>
      <svg width="160" height="92" viewBox="0 0 160 92" role="img" aria-label={`${label} score ${score} of 10`}>
        <path d="M20 84 A60 60 0 0 1 140 84" fill="none" stroke="var(--border)" strokeWidth="12" strokeLinecap="round" />
        <path d="M20 84 A60 60 0 0 1 140 84" fill="none" stroke="var(--warning)" strokeWidth="12" strokeLinecap="round"
          strokeDasharray={`${(score / 10) * 189} 189`} style={{ transition: 'stroke-dasharray 900ms ease-in-out' }} />
        <line className="mm-gauge-needle" x1="80" y1="84" x2="80" y2="34"
          stroke="var(--text-primary)" strokeWidth="3" strokeLinecap="round" style={{ transform: `rotate(${deg}deg)` }} />
        <circle cx="80" cy="84" r="6" fill="var(--text-primary)" />
      </svg>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}: <strong style={{ color: 'var(--text-primary)' }}>{score.toFixed(1)}</strong>/10</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50583 — "NEW" ribbon slide-in                                       */
/* ------------------------------------------------------------------ */
export function NewRibbon({ children, label = 'NEW' }) {
  return (
    <div style={{ position: 'relative' }}>
      <span className="mm-ribbon">{label}</span>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50584 — staggered search results                                    */
/* ------------------------------------------------------------------ */
export function StaggerList({ items = [], renderItem }) {
  return (
    <div>
      {items.map((item, i) => (
        <div key={item.id ?? i} className="mm-stagger" style={{ animationDelay: `${staggerDelayMs(i)}ms` }}>
          {renderItem ? renderItem(item, i) : String(item.title ?? item)}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50585 — theme cross-fade                                            */
/* ------------------------------------------------------------------ */
export function ThemeCrossFader({ dark = true, children }) {
  return (
    <div className="mm-theme-fade"
      style={{ background: dark ? 'var(--bg-primary)' : 'var(--bg-secondary)', color: 'var(--text-primary)', padding: 16, borderRadius: 'var(--radius-md)' }}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50586 — graph node settle                                           */
/* ------------------------------------------------------------------ */
export function SettlingNodes({ nodes = [] }) {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      {nodes.map((n, i) => (
        <span key={n.id ?? i} className="mm-graph-node"
          style={{
            animationDelay: `${i * 70}ms`,
            '--mm-from-x': `${(i % 3) * -14}px`,
            '--mm-from-y': `${(i % 2) * -12}px`,
            background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-secondary)',
            borderRadius: 999, padding: '6px 12px', fontSize: 12,
          }}>
          {n.label ?? n}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50587 — copy-button morph                                           */
/* ------------------------------------------------------------------ */
export function MorphCopyButton({ text, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); } catch { /* clipboard unavailable */ }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1400);
  };
  return (
    <button className={`mm-copy-btn mm-focusable ${copied ? 'mm-copied' : ''}`} onClick={copy}
      aria-label={copied ? 'Copied' : label}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: 'var(--radius-sm)', padding: '6px 12px', cursor: 'pointer', fontSize: 12, minHeight: 44 }}>
      <span className="mm-copy-icon" aria-hidden="true">⧉</span>
      <span className="mm-copy-check" aria-hidden="true">✓</span>
      {copied ? 'Copied' : label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* 50588 — dual-ring spinner                                           */
/* ------------------------------------------------------------------ */
export function DualRingSpinner({ label = 'Loading' }) {
  return <span className="mm-dual-spinner" role="status" aria-label={label} />;
}

/* ------------------------------------------------------------------ */
/* 50589 — floating empty illustration                                 */
/* ------------------------------------------------------------------ */
export function FloatingIllustration({ children }) {
  return <div className="mm-float">{children || <span style={{ fontSize: 40 }} aria-hidden="true">🛰</span>}</div>;
}

/* ------------------------------------------------------------------ */
/* 50590 — focus-ring draw (demo wrapper)                              */
/* ------------------------------------------------------------------ */
export function FocusRingDemo({ children, label }) {
  return <button className="mm-focusable" aria-label={label} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', padding: '8px 14px', fontSize: 13, minHeight: 44 }}>{children}</button>;
}

/* ------------------------------------------------------------------ */
/* 50591 — sticky-bar shadow                                           */
/* ------------------------------------------------------------------ */
export function StickyFilterBar({ children, scrollRef }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const el = scrollRef?.current;
    if (!el) return;
    const onScroll = () => setScrolled(el.scrollTop > 4);
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [scrollRef]);
  return (
    <div className={`mm-sticky-bar ${scrolled ? 'mm-scrolled' : ''}`}
      style={{ position: 'sticky', top: 0, background: 'var(--bg-secondary)', padding: '10px 12px', zIndex: 5, borderRadius: 'var(--radius-sm)' }}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50592 — route fade-rise                                             */
/* ------------------------------------------------------------------ */
export function RouteFadeRise({ children, routeKey }) {
  return <div key={routeKey} className="mm-route">{children}</div>;
}

/* ------------------------------------------------------------------ */
/* 50593 — badge count pop                                             */
/* ------------------------------------------------------------------ */
export function PopBadge({ count }) {
  const [bump, setBump] = useState(0);
  const prev = useRef(count);
  useEffect(() => {
    if (count > prev.current) setBump((b) => b + 1);
    prev.current = count;
  }, [count]);
  return (
    <span key={bump} className={bump > 0 ? 'mm-badge-pop' : ''}
      style={{ background: 'var(--danger)', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '2px 8px', minWidth: 22, textAlign: 'center' }}
      aria-label={`${count} notifications`}>
      {count}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* 50594 — height-animated reasoning section                          */
/* ------------------------------------------------------------------ */
export function AnimatedReasoning({ open, children, title = 'Agent reasoning' }) {
  const contentRef = useRef(null);
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const el = contentRef.current;
    if (el) setHeight(el.scrollHeight);
  }, [children, open]);
  return (
    <div>
      <div className="mm-reasoning" style={reasoningHeightStyle(height, open)} aria-hidden={!open}>
        <div ref={contentRef} style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '8px 0' }} aria-label={title}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50595 — scrubber handle grow                                        */
/* ------------------------------------------------------------------ */
export function GrowingScrubber({ value = 50, onChange }) {
  return (
    <input type="range" min={0} max={100} value={value} onChange={(e) => onChange?.(Number(e.target.value))}
      className="mm-scrubber-handle" aria-label="Timeline scrubber"
      style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer', minHeight: 44 }} />
  );
}

/* ------------------------------------------------------------------ */
/* 50596 — chip fill wipe                                              */
/* ------------------------------------------------------------------ */
export function WipeChip({ label, active, onClick }) {
  return (
    <button className={`mm-wipe-chip ${active ? 'mm-active' : ''}`} onClick={onClick} aria-pressed={active}
      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: 999, padding: '6px 14px', fontSize: 12, cursor: 'pointer', minHeight: 44 }}>
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* 50597 — invalid-input shake                                         */
/* ------------------------------------------------------------------ */
export function ShakeInput({ error, ...props }) {
  const [shakeKey, setShakeKey] = useState(0);
  useEffect(() => { if (error) setShakeKey((k) => k + 1); }, [error]);
  const trigger = () => {
    if (shouldReduceMotion()) return;
    const el = document.getElementById(props.id);
    if (!el) return;
    el.animate(shakeKeyframes(), { duration: 300, easing: 'ease-in-out' });
  };
  useEffect(() => { if (error && shakeKey > 0) trigger(); });
  return (
    <div>
      <input {...props} aria-invalid={!!error} style={{ background: 'var(--bg-secondary)', border: `1px solid ${error ? 'var(--danger)' : 'var(--border)'}`, color: 'var(--text-primary)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: 13, width: '100%', minHeight: 44 }} />
      {error && <div role="alert" style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4 }}>{error}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 50598 — save checkmark draw (hold 1.2s, fade)                       */
/* ------------------------------------------------------------------ */
export function SaveCheckmark({ onSave, label = 'Save' }) {
  const [state, setState] = useState('idle'); // idle | saving | saved
  const save = async () => {
    setState('saving');
    await Promise.resolve(onSave?.());
    setState('saved');
    setTimeout(() => setState('idle'), SAVE_HOLD_MS + 400);
  };
  return (
    <button className="mm-pressable mm-focusable" onClick={save} disabled={state !== 'idle'} aria-live="polite"
      style={{ background: 'var(--info)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '8px 16px', fontSize: 13, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44 }}>
      {state === 'saved'
        ? <span key={state} className="mm-save-check" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><SelfDrawingCheckmark size={16} /> Saved</span>
        : state === 'saving' ? 'Saving…' : label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* 50599 — sidebar width animation                                     */
/* ------------------------------------------------------------------ */
export function AnimatedSidebar({ collapsed, items = [] }) {
  return (
    <nav className={`mm-sidebar ${collapsed ? 'mm-collapsed' : ''}`} aria-label="App navigation"
      style={{ width: collapsed ? SIDEBAR_WIDTH_CLOSED_PX : SIDEBAR_WIDTH_OPEN_PX, background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border)', padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      {items.map((item, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', color: 'var(--text-secondary)', fontSize: 13, borderRadius: 'var(--radius-sm)', minHeight: 44 }}>
          <span aria-hidden="true" style={{ fontSize: 16 }}>{item.icon || '•'}</span>
          <span className="mm-sidebar-label">{item.label}</span>
        </span>
      ))}
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* 50600 — thumbnail zoom hover                                        */
/* ------------------------------------------------------------------ */
export function ZoomThumbnail({ src, alt, width = 160, height = 100 }) {
  return (
    <span className="mm-thumb" style={{ display: 'inline-block', width, height }}>
      <img src={src} alt={alt} loading="lazy" decoding="async" />
      <span className="mm-thumb-overlay">Expand</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Gallery — reference showcase for the micro-motion system            */
/* ------------------------------------------------------------------ */
export function MicroMotionGallery() {
  const [tab, setTab] = useState(0);
  const [toggle, setToggle] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [chipActive, setChipActive] = useState(true);
  const [pills, setPills] = useState(['xss', 'idor']);
  const [modalOpen, setModalOpen] = useState(false);
  const [notifs, setNotifs] = useState(2);
  return (
    <div className="mm-motion" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h2 style={{ color: 'var(--text-primary)', fontSize: 18, margin: 0 }}>Micro-motion system (50561–50600)</h2>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <SelfDrawingCheckmark />
        <HoverPill tone="#34d399">critical ×3</HoverPill>
        <PressButton onClick={() => {}} style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '8px 16px', minHeight: 44 }}>Press me</PressButton>
        <MorphCopyButton text="curl https://example.com" />
        <ThinkingDots />
        <DualRingSpinner />
        <PopBadge count={notifs} />
        <button onClick={() => setNotifs((n) => n + 1)} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '6px 12px', minHeight: 44, cursor: 'pointer' }}>+ notification</button>
      </div>
      <SlidingTabs tabs={['Hunt', 'Findings', 'Reports']} active={tab} onChange={setTab} />
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <LiftCard style={{ width: 200 }}><strong style={{ color: 'var(--text-primary)' }}>Finding #1042</strong><p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Reflected XSS in search param</p><ConfidenceFill value={87} /></LiftCard>
        <NewRibbon><LiftCard style={{ width: 200 }}><strong style={{ color: 'var(--text-primary)' }}>Finding #1043</strong><p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Open redirect on logout</p></LiftCard></NewRibbon>
      </div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <CountUpStat target={128} label="findings" />
        <CountUpStat target={7} label="chains" />
        <GaugeNeedle score={7.4} />
        <DonutSweep counts={{ critical: 2, high: 5, medium: 9, low: 14, info: 3 }} size={120} />
        <CompletionRing />
      </div>
      <div style={{ maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <ShimmerProgress />
        <ShimmerProgress value={62} />
        <DiagonalSkeleton height={16} />
        <TerminalLine>$ nuclei -target https://example.com -severity critical</TerminalLine>
        <SlideFadeToast message="Hunt phase 2 complete — 5 tools ran" />
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {pills.map((p) => <MorphPill key={p} label={p} onRemove={() => setPills((ps) => ps.filter((x) => x !== p))} />)}
        <WipeChip label="untriaged" active={chipActive} onClick={() => setChipActive((a) => !a)} />
        <SpringToggle checked={toggle} onChange={setToggle} label="Auto-scroll" />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer' }}>Expand <RotatingChevron open={toggle} /></span>
      </div>
      <StaggerList items={[{ id: 1, title: 'result — stored XSS' }, { id: 2, title: 'result — SSRF via webhook' }, { id: 3, title: 'result — IDOR on invoices' }]}
        renderItem={(i) => <div style={{ padding: '8px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', marginBottom: 6, color: 'var(--text-secondary)', fontSize: 13 }}>{i.title}</div>} />
      <SettlingNodes nodes={[{ id: 'a', label: 'attacker.com' }, { id: 'b', label: 'api target' }, { id: 'c', label: 'S3 bucket' }]} />
      <div style={{ display: 'flex', gap: 12 }}>
        <PulseDropZone />
        <FloatingIllustration />
      </div>
      <div style={{ maxWidth: 420 }}>
        <ShakeInput id="mm-target" placeholder="https://target.example" error="Enter a valid URL starting with https://" />
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <FocusRingDemo label="Focusable demo">Focus me (Tab)</FocusRingDemo>
        <SaveCheckmark />
        <button onClick={() => setModalOpen(true)} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 16px', minHeight: 44, cursor: 'pointer' }}>Open modal</button>
        <button onClick={() => setSidebarCollapsed((c) => !c)} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 16px', minHeight: 44, cursor: 'pointer' }}>Toggle sidebar</button>
      </div>
      <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', height: 180 }}>
        <AnimatedSidebar collapsed={sidebarCollapsed} items={[{ icon: '⌂', label: 'Home' }, { icon: '◎', label: 'Hunts' }, { icon: '⚑', label: 'Findings' }]} />
        <div style={{ flex: 1, padding: 16, color: 'var(--text-secondary)', fontSize: 13 }}>Content area — the sidebar animates 280↔64px beside it.</div>
      </div>
      <AnimatedReasoning open={toggle} title="Agent reasoning">
        The agent considered 3 tool candidates, picked `nuclei` for template coverage, then validated the reflected XSS with a canary token before reporting.
      </AnimatedReasoning>
      <div style={{ maxWidth: 420 }}>
        <GrowingScrubber />
        <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
          <TimelineDot color="#34d399" />
          <ZoomThumbnail src="https://placehold.co/320x200/0f172a/38bdf8?text=PoC" alt="Proof-of-concept screenshot" />
        </div>
      </div>
      <ScaleModal open={modalOpen} onClose={() => setModalOpen(false)} title="Scale-in modal">
        <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Backdrop fades 150ms; panel scales 0.96 → 1.</p>
      </ScaleModal>
    </div>
  );
}
