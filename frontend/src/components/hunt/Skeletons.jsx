/**
 * Skeletons.jsx — Forge wave 1, ideas 50005–50040 (hunt-UX skeleton set).
 *
 * Placeholder components that mirror real hunt-UI proportions so layouts never
 * jump when data arrives. Dark-theme, single violet accent, shimmer disabled
 * under prefers-reduced-motion (idea 50013).
 */
import React from 'react';
import './Skeletons.css';

/** Base shimmer block. */
export function Skeleton({ width = '100%', height = 12, radius = 8, circle = false, className = '', style = {}, static_ = false }) {
  return (
    <div
      aria-hidden="true"
      className={`hsk ${circle ? 'hsk-circle' : ''} ${static_ ? 'hsk-static' : ''} ${className}`}
      style={{ width, height, borderRadius: circle ? '50%' : radius, ...style }}
    />
  );
}

/** Stack of text lines with a shorter last line. */
export function SkeletonText({ lines = 3, gap = 8, lastWidth = '55%', className = '' }) {
  return (
    <div className={`hsk-stack ${className}`} style={{ gap }} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height={11} width={i === lines - 1 ? lastWidth : '100%'} radius={6} />
      ))}
    </div>
  );
}

/** 50015 — Staggered fade-in wrapper: children fade in with slight delays. */
export function StaggeredFadeIn({ children, baseDelay = 0, step = 90, className = '' }) {
  return (
    <div className={`hsk-stagger ${className}`}>
      {React.Children.map(children, (child, i) => (
        <div className="hsk-fade-item" style={{ '--hsk-delay': `${baseDelay + i * step}ms` }}>
          {child}
        </div>
      ))}
    </div>
  );
}

/** 50005 — Findings-list skeleton rows mirroring real card heights. */
export function FindingsListSkeleton({ rows = 4, className = '' }) {
  return (
    <StaggeredFadeIn className={`hsk-stack ${className}`} role="status" aria-label="Loading findings">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="hsk-card">
          <div className="hsk-row-flex">
            <Skeleton width={64} height={22} radius={999} />
            <Skeleton height={14} width="42%" radius={6} />
          </div>
          <SkeletonText lines={2} />
          <div className="hsk-row-flex">
            <Skeleton width={90} height={11} radius={6} />
            <Skeleton width={70} height={11} radius={6} />
          </div>
        </div>
      ))}
    </StaggeredFadeIn>
  );
}

/** 50006 — Phase-stepper skeleton (Recon / Testing / Chaining / Reporting). */
export function PhaseStepperSkeleton({ phases = ['Recon', 'Testing', 'Chaining', 'Reporting'], className = '' }) {
  return (
    <div className={`hsk-stepper ${className}`} role="status" aria-label="Loading phases">
      {phases.map((p, i) => (
        <React.Fragment key={p}>
          <div className="hsk-step">
            <Skeleton width={30} height={30} circle />
            <span className="hsk-step-label">{p}</span>
          </div>
          {i < phases.length - 1 && <div className="hsk-step-link" />}
        </React.Fragment>
      ))}
    </div>
  );
}

/** 50007 — Chat bubble placeholders for the mid-hunt chat panel. */
export function ChatBubbleSkeleton({ align = 'left', className = '' }) {
  return (
    <div className={`hsk-chat-row ${align === 'right' ? 'hsk-chat-right' : ''} ${className}`} aria-hidden="true">
      {align === 'left' && <Skeleton width={32} height={32} circle />}
      <div className={`hsk-chat-bubble ${align}`}>
        <SkeletonText lines={2} lastWidth="40%" />
      </div>
    </div>
  );
}

/** 50008 — Report preview: title bar, TOC, then sections fading in. */
export function ReportPreviewSkeleton({ className = '' }) {
  return (
    <div className={`hsk-stack ${className}`} role="status" aria-label="Loading report preview">
      <Skeleton height={26} width="60%" radius={8} />
      <div className="hsk-toc">
        <Skeleton height={11} width="30%" radius={6} />
        <Skeleton height={11} width="42%" radius={6} />
        <Skeleton height={11} width="25%" radius={6} />
      </div>
      <StaggeredFadeIn baseDelay={150} step={140}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="hsk-section">
            <Skeleton height={15} width="35%" radius={6} />
            <SkeletonText lines={3} />
          </div>
        ))}
      </StaggeredFadeIn>
    </div>
  );
}

/** 50011 — Pulsing waveform placeholder for the live terminal. */
export function TerminalWaveformSkeleton({ bars = 48, className = '' }) {
  return (
    <div className={`hsk-waveform ${className}`} role="status" aria-label="Loading terminal output" aria-hidden="true">
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className="hsk-wave-bar"
          style={{ '--hsk-bh': `${18 + 62 * Math.abs(Math.sin(i * 0.55))}%`, '--hsk-bd': `${(i % 12) * 90}ms` }}
        />
      ))}
    </div>
  );
}

/** 50014 — Content-aware finding card: badge + title + two meta lines. */
export function ContentAwareFindingCardSkeleton({ className = '' }) {
  return (
    <div className={`hsk-card ${className}`} aria-hidden="true">
      <div className="hsk-row-flex">
        <Skeleton width={70} height={22} radius={999} />
        <Skeleton height={15} width="48%" radius={6} />
      </div>
      <div className="hsk-row-flex">
        <Skeleton width={110} height={11} radius={6} />
        <Skeleton width={80} height={11} radius={6} />
      </div>
    </div>
  );
}

/** 50019 — Gray ring placeholder for the severity donut chart. */
export function SeverityDonutSkeleton({ size = 120, thickness = 16, className = '' }) {
  const r = (size - thickness) / 2;
  return (
    <div className={`hsk-donut-wrap ${className}`} role="status" aria-label="Loading severity chart">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1c2333" strokeWidth={thickness} />
        <circle cx={size / 2} cy={size / 2} r={r * 0.45} fill="#1c2333" className="hsk-donut-pulse" />
      </svg>
    </div>
  );
}

/** 50021 — Placeholder ticks for the hunt timeline scrubber. */
export function TimelineScrubberSkeleton({ ticks = 24, className = '' }) {
  return (
    <div className={`hsk-scrubber ${className}`} role="status" aria-label="Loading timeline" aria-hidden="true">
      <div className="hsk-scrub-track" />
      <div className="hsk-scrub-ticks">
        {Array.from({ length: ticks }).map((_, i) => (
          <span key={i} className={`hsk-tick ${i % 6 === 0 ? 'hsk-tick-major' : ''}`} />
        ))}
      </div>
    </div>
  );
}

/** 50024 — Finding detail drawer: title, severity pill, evidence code block. */
export function FindingDrawerSkeleton({ className = '' }) {
  return (
    <div className={`hsk-stack ${className}`} role="status" aria-label="Loading finding details">
      <div className="hsk-row-flex">
        <Skeleton height={18} width="55%" radius={8} />
        <Skeleton width={70} height={22} radius={999} />
      </div>
      <SkeletonText lines={2} />
      <div className="hsk-codeblock">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} height={11} width={`${88 - i * 9}%`} radius={5} />
        ))}
      </div>
    </div>
  );
}

/** 50027 — Placeholder row for mid-hunt chat suggestion chips. */
export function SuggestionChipSkeleton({ chips = 3, className = '' }) {
  return (
    <div className={`hsk-chip-row ${className}`} aria-hidden="true">
      {Array.from({ length: chips }).map((_, i) => (
        <Skeleton key={i} width={110 + (i % 3) * 24} height={30} radius={999} />
      ))}
    </div>
  );
}

/** 50030 — Dashboard stat cards: placeholders, counts animate up when data arrives. */
export function DashboardStatCardSkeleton({ cards = 4, className = '' }) {
  return (
    <div className={`hsk-stat-grid ${className}`} role="status" aria-label="Loading statistics">
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="hsk-stat-card">
          <Skeleton width={70} height={11} radius={6} />
          <Skeleton width={52} height={26} radius={8} />
          <Skeleton width={90} height={10} radius={5} />
        </div>
      ))}
    </div>
  );
}

/** 50032 — PoC replay: request and response placeholder blocks. */
export function PocReplaySkeleton({ className = '' }) {
  return (
    <div className={`hsk-stack ${className}`} role="status" aria-label="Loading PoC replay">
      {['Request', 'Response'].map((label) => (
        <div key={label} className="hsk-pane">
          <Skeleton width={84} height={12} radius={6} />
          <div className="hsk-codeblock">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height={11} width={`${92 - i * 11}%`} radius={5} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** 50034 — Chain graph: gray circle nodes, dashed edges, before the real graph loads. */
export function ChainGraphSkeleton({ className = '' }) {
  const nodes = [
    { x: 60, y: 70 }, { x: 170, y: 40 }, { x: 170, y: 110 }, { x: 280, y: 75 },
  ];
  const edges = [[0, 1], [0, 2], [1, 3], [2, 3]];
  return (
    <div className={`hsk-graph ${className}`} role="status" aria-label="Loading attack chain graph">
      <svg viewBox="0 0 340 150" width="100%" aria-hidden="true">
        {edges.map(([a, b], i) => (
          <line key={i} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y}
            stroke="#2a3448" strokeWidth={2} strokeDasharray="6 5" className="hsk-edge" />
        ))}
        {nodes.map((n, i) => (
          <circle key={i} cx={n.x} cy={n.y} r={20} fill="#1c2333" className="hsk-node" style={{ animationDelay: `${i * 160}ms` }} />
        ))}
      </svg>
    </div>
  );
}

/** 50036 — Notification center list placeholders. */
export function NotificationListSkeleton({ rows = 5, className = '' }) {
  return (
    <StaggeredFadeIn className={`hsk-stack ${className}`} step={70} role="status" aria-label="Loading notifications">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="hsk-row-flex">
          <Skeleton width={36} height={36} circle />
          <div style={{ flex: 1 }}>
            <SkeletonText lines={2} lastWidth="45%" />
          </div>
          <Skeleton width={52} height={10} radius={5} />
        </div>
      ))}
    </StaggeredFadeIn>
  );
}

/** 50038 — Labeled placeholders for each settings section while loading. */
export function SettingsSectionSkeleton({ sections = ['Profile', 'Hunt defaults', 'Notifications'], className = '' }) {
  return (
    <div className={`hsk-stack ${className}`} role="status" aria-label="Loading settings">
      {sections.map((s) => (
        <div key={s} className="hsk-section">
          <span className="hsk-section-label">{s}</span>
          <div className="hsk-row-flex">
            <Skeleton height={13} width="40%" radius={6} />
            <Skeleton width={120} height={34} radius={8} />
          </div>
          <SkeletonText lines={2} lastWidth="60%" />
        </div>
      ))}
    </div>
  );
}

/** 50040 — Placeholder cards for model entries on the Models page. */
export function ModelLibraryCardSkeleton({ count = 6, className = '' }) {
  return (
    <div className={`hsk-model-grid ${className}`} role="status" aria-label="Loading models">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="hsk-model-card">
          <div className="hsk-row-flex">
            <Skeleton width={40} height={40} radius={10} />
            <div style={{ flex: 1 }}>
              <Skeleton height={14} width="60%" radius={6} />
              <div style={{ height: 6 }} />
              <Skeleton height={10} width="40%" radius={5} />
            </div>
          </div>
          <Skeleton height={34} radius={8} />
        </div>
      ))}
    </div>
  );
}
