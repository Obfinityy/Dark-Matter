/**
 * FindingCards.jsx — Forge wave 4, ideas 50121–50140.
 *
 * Finding card components: header, chevron, confidence meter, ribbons,
 * fan-out stacking, quick actions, severity editor, evidence thumbnails,
 * risk dial, status chips, asset line, density toggle, chain glyph,
 * triage ribbon, comments, impact line, exploitability, bulk select.
 * Dark-theme, severity color system shared across the suite.
 */
import React from 'react';
import './FindingCards.css';

/** Shared severity color system (matches HuntTimeline3 SeverityColorSystem). */
export const FC_SEVERITY = {
  critical: { label: 'Critical', color: '#f87171' },
  high: { label: 'High', color: '#fb923c' },
  medium: { label: 'Medium', color: '#facc15' },
  low: { label: 'Low', color: '#60a5fa' },
  info: { label: 'Info', color: '#9ca3af' },
};
export const FC_SEVERITY_KEYS = Object.keys(FC_SEVERITY);

/** 50132 — Density context: comfortable/compact list density. */
const DensityContext = React.createContext('comfortable');
export function useDensity() {
  return React.useContext(DensityContext);
}
export function CardDensityToggle({ density = 'comfortable', onChange, className = '' }) {
  return (
    <div className={`fc-density ${className}`} role="group" aria-label="Card density">
      {['comfortable', 'compact'].map(d => (
        <button
          key={d}
          type="button"
          className={density === d ? 'fc-active' : ''}
          onClick={() => onChange && onChange(d)}
          aria-pressed={density === d}
        >
          {d}
        </button>
      ))}
    </div>
  );
}
export function DensityProvider({ density = 'comfortable', children }) {
  return <DensityContext.Provider value={density}>{children}</DensityContext.Provider>;
}

/** 50127 — Inline severity editor: click the pill, re-grade in place. */
export function InlineSeverityEditor({ severity = 'medium', onChange, className = '' }) {
  const [open, setOpen] = React.useState(false);
  const s = FC_SEVERITY[severity] || FC_SEVERITY.medium;
  return (
    <span className={`fc-sev-editor ${className}`}>
      <button
        type="button"
        className={`fc-sev-pill fc-sev-${severity}`}
        style={{ '--fc-sev': s.color }}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Severity: ${s.label}. Change severity`}
        title="Click to re-grade"
      >
        {s.label}
      </button>
      {open && (
        <span className="fc-sev-menu" role="listbox" aria-label="Choose severity">
          {FC_SEVERITY_KEYS.map(k => (
            <button
              key={k}
              type="button"
              role="option"
              aria-selected={k === severity}
              className={`fc-sev-opt fc-sev-${k}`}
              style={{ '--fc-sev': FC_SEVERITY[k].color }}
              onClick={() => {
                if (onChange) onChange(k);
                setOpen(false);
              }}
            >
              {FC_SEVERITY[k].label}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

/** 50121 — Card header: severity pill + finding title + CVE-style ID chip in one row. */
export function CardHeaderLayout({
  severity = 'medium',
  title = '',
  cveId = '',
  onSeverityChange,
  className = '',
}) {
  return (
    <div className={`fc-header ${className}`}>
      <InlineSeverityEditor severity={severity} onChange={onSeverityChange} />
      <span className="fc-title">{title || 'Untitled finding'}</span>
      {cveId && (
        <span className="fc-cve-chip" title="Finding ID">
          {cveId}
        </span>
      )}
    </div>
  );
}

/** 50122 — Expand/collapse chevron revealing evidence, PoC steps, remediation. */
export function ExpandCollapseChevron({
  expanded = false,
  onToggle,
  label = 'details',
  className = '',
}) {
  return (
    <button
      type="button"
      className={`fc-chevron ${expanded ? 'fc-open' : ''} ${className}`}
      onClick={onToggle}
      aria-expanded={expanded}
      aria-label={`${expanded ? 'Collapse' : 'Expand'} ${label}`}
    >
      <span aria-hidden="true">▾</span>
    </button>
  );
}

/** 50123 — Confidence meter: agent's 0–100% certainty as a slim bar. */
export function ConfidenceMeterBar({ confidence = 0, className = '' }) {
  const pct = Math.max(0, Math.min(100, confidence));
  return (
    <div
      className={`fc-confidence ${className}`}
      role="meter"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Agent confidence"
    >
      <div className="fc-confidence-track">
        <div className="fc-confidence-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="fc-confidence-label">{Math.round(pct)}% confident</span>
    </div>
  );
}

/** 50124 — NEW ribbon for findings discovered in the last 10 minutes. */
export function NewFindingRibbon({ discoveredAt = 0, className = '' }) {
  const isNew = discoveredAt > 0 && Date.now() - discoveredAt < 10 * 60 * 1000;
  if (!isNew) return null;
  return (
    <span className={`fc-new-ribbon ${className}`} aria-label="New finding">
      NEW
    </span>
  );
}

/** 50139 — Exploitability badge: "exploitable in N steps" vs "theoretical". */
export function ExploitabilityBadge({ steps = null, className = '' }) {
  const exploitable = typeof steps === 'number' && steps > 0;
  return (
    <span
      className={`fc-exploit ${exploitable ? 'fc-exploit-yes' : 'fc-exploit-no'} ${className}`}
      role="status"
    >
      {exploitable ? `⚡ exploitable in ${steps} step${steps === 1 ? '' : 's'}` : '○ theoretical'}
    </span>
  );
}

/** 50138 — Plain-language impact line under the title. */
export function PlainLanguageImpactLine({ text = '', className = '' }) {
  if (!text) return null;
  return <p className={`fc-impact ${className}`}>{text}</p>;
}

/** 50131 — Affected asset: host + path truncated, full value on hover. */
export function AffectedAssetLine({ host = '', path = '', className = '' }) {
  const full = `${host}${path}`;
  if (!full) return null;
  return (
    <span className={`fc-asset ${className}`} title={full} aria-label={`Affected asset: ${full}`}>
      <span className="fc-asset-host">{host}</span>
      <span className="fc-asset-path">{path}</span>
    </span>
  );
}

/** 50130 — Status tag chips: authenticated, chained, needs-review… */
export function StatusTagChips({ tags = [], className = '' }) {
  if (!tags.length) return null;
  return (
    <span className={`fc-tags ${className}`} aria-label={`Tags: ${tags.join(', ')}`}>
      {tags.map(t => (
        <span key={t} className="fc-tag">
          {t}
        </span>
      ))}
    </span>
  );
}

/** 50133 — Chain-link glyph with clickable parent reference. */
export function ChainLinkGlyph({ parentId = '', onOpenParent, className = '' }) {
  if (!parentId) return null;
  return (
    <button
      type="button"
      className={`fc-chain ${className}`}
      onClick={() => onOpenParent && onOpenParent(parentId)}
      title={`Chained from ${parentId}`}
      aria-label={`Chained from ${parentId}`}
    >
      <span aria-hidden="true">⛓</span> {parentId}
    </button>
  );
}

/** 50129 — Risk-score dial: mini 0–10 gauge in the card corner. */
export function RiskScoreDial({ score = 0, size = 52, className = '' }) {
  const s = Math.max(0, Math.min(10, score));
  const r = (size - 10) / 2;
  const c = Math.PI * r;
  const frac = s / 10;
  const col = s >= 9 ? '#f87171' : s >= 7 ? '#fb923c' : s >= 4 ? '#facc15' : '#60a5fa';
  return (
    <span
      className={`fc-dial ${className}`}
      role="meter"
      aria-valuenow={s}
      aria-valuemin={0}
      aria-valuemax={10}
      aria-label={`Risk score ${s} of 10`}
    >
      <svg
        width={size}
        height={size * 0.62}
        viewBox={`0 0 ${size} ${size * 0.62}`}
        aria-hidden="true"
      >
        <path
          d={`M 5 ${size * 0.55} A ${r} ${r} 0 0 1 ${size - 5} ${size * 0.55}`}
          fill="none"
          stroke="#1c2333"
          strokeWidth={6}
          strokeLinecap="round"
        />
        <path
          d={`M 5 ${size * 0.55} A ${r} ${r} 0 0 1 ${size - 5} ${size * 0.55}`}
          fill="none"
          stroke={col}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          className="fc-dial-fill"
        />
      </svg>
      <em>{s.toFixed(1)}</em>
    </span>
  );
}

/** 50128 — Evidence thumbnails in collapsed cards. */
export function EvidenceThumbnailsInCards({ evidence = [], className = '' }) {
  if (!evidence.length) return null;
  return (
    <span className={`fc-ev-thumbs ${className}`} aria-label={`${evidence.length} evidence items`}>
      {evidence.slice(0, 3).map((e, i) => (
        <span key={i} className="fc-ev-thumb" title={e.label || 'evidence'}>
          {e.type === 'image' ? (
            <span className="fc-ev-img" aria-hidden="true">
              🖼
            </span>
          ) : (
            <code>{(e.code || '').slice(0, 42)}…</code>
          )}
        </span>
      ))}
      {evidence.length > 3 && <span className="fc-ev-more">+{evidence.length - 3}</span>}
    </span>
  );
}

/** 50136 — Triage status ribbon: New → Triaged → Confirmed → Fixed → Verified. */
const TRIAGE_STAGES = ['new', 'triaged', 'confirmed', 'fixed', 'verified'];
export function TriageStatusRibbon({ status = 'new', onChange, className = '' }) {
  const idx = Math.max(0, TRIAGE_STAGES.indexOf(status));
  return (
    <span className={`fc-triage ${className}`} role="status" aria-label={`Triage: ${status}`}>
      {TRIAGE_STAGES.map((st, i) => (
        <button
          key={st}
          type="button"
          className={`fc-triage-step ${i < idx ? 'fc-done' : ''} ${i === idx ? 'fc-current' : ''}`}
          onClick={() => onChange && onChange(st)}
          aria-current={i === idx ? 'step' : undefined}
          title={st}
        >
          <i aria-hidden="true">{i < idx ? '✓' : i + 1}</i>
          <em>{st}</em>
        </button>
      ))}
    </span>
  );
}

/** 50137 — Comment count affordance opening the card's thread. */
export function CommentCountAffordance({ count = 0, onOpen, className = '' }) {
  return (
    <button
      type="button"
      className={`fc-comments ${className}`}
      onClick={onOpen}
      aria-label={`${count} comments. Open thread`}
    >
      <span aria-hidden="true">💬</span> {count}
    </button>
  );
}

/** 50126 — Card footer quick actions: copy-PoC, mark-reviewed, export-single. */
export function CardFooterQuickActions({
  onCopyPoc,
  onMarkReviewed,
  onExport,
  reviewed = false,
  className = '',
}) {
  return (
    <span className={`fc-quick-actions ${className}`}>
      <button type="button" onClick={onCopyPoc} title="Copy PoC markdown">
        ⧉ Copy PoC
      </button>
      <button
        type="button"
        onClick={onMarkReviewed}
        aria-pressed={reviewed}
        title="Mark as reviewed"
      >
        {reviewed ? '✓ Reviewed' : 'Mark reviewed'}
      </button>
      <button type="button" onClick={onExport} title="Export single finding">
        ⤓ Export
      </button>
    </span>
  );
}

/** 50140 — Floating bulk-action bar summoned by card checkboxes. */
export function BulkSelectBar({
  selected = [],
  onClear,
  onMarkReviewed,
  onExport,
  onDismiss,
  className = '',
}) {
  if (!selected.length) return null;
  return (
    <div
      className={`fc-bulkbar ${className}`}
      role="toolbar"
      aria-label={`${selected.length} findings selected`}
    >
      <span className="fc-bulkbar-count">{selected.length} selected</span>
      <button type="button" onClick={onMarkReviewed}>
        Mark reviewed
      </button>
      <button type="button" onClick={onExport}>
        Export
      </button>
      <button type="button" onClick={onDismiss}>
        Dismiss
      </button>
      <button type="button" className="fc-bulkbar-x" onClick={onClear} aria-label="Clear selection">
        ✕
      </button>
    </div>
  );
}

/** 50125 — Duplicate fan-out stacking: "N similar" fans out into cards on click. */
export function DuplicateFanOutStacking({ groups = [], renderCard, className = '' }) {
  const [open, setOpen] = React.useState({});
  const items = groups;
  if (!items.length) return null;
  return (
    <div className={`fc-fanout ${className}`}>
      {items.map((g, gi) => (
        <div key={gi} className="fc-fanout-group">
          <button
            type="button"
            className="fc-fanout-head"
            onClick={() => setOpen(o => ({ ...o, [gi]: !o[gi] }))}
            aria-expanded={!!open[gi]}
          >
            <span className="fc-fanout-stack" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            {g.findings.length} similar — {g.label || 'duplicates'}
            <span aria-hidden="true" className="fc-fanout-caret">
              {open[gi] ? '▾' : '▸'}
            </span>
          </button>
          {open[gi] && (
            <div className="fc-fanout-cards">
              {g.findings.map((f, fi) => (
                <div key={fi} className="fc-fanout-card">
                  {renderCard ? renderCard(f) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const DEFAULT_FINDING = {
  id: 'DM-2026-0001',
  title: 'SQL injection in login form',
  severity: 'high',
  confidence: 87,
  riskScore: 8.4,
  discoveredAt: Date.now() - 3 * 60 * 1000,
  tags: ['authenticated'],
  asset: { host: 'app.target.example', path: '/login' },
  impact: 'Attackers could read or modify data they should not access.',
  exploitSteps: 3,
  status: 'new',
  comments: 0,
  evidence: [],
};

/**
 * Composite finding card. Behaviors baked in:
 * 50134 — keyboard focus ring visually distinct from hover (see .fc-card:focus-visible)
 * 50135 — actions hover-reveal with focus-visible fallback (see .fc-card .fc-hover-actions)
 * 50146 — 4% severity background tint (see .fc-card.fc-sev-*)
 * 50155 — new-card entrance animation (see .fc-new-card)
 */
export function FindingCard({
  finding = {},
  expandedExtra = null,
  selectable = false,
  selected = false,
  onSelect,
  onSeverityChange,
  onCopyPoc,
  onMarkReviewed,
  onExport,
  onOpenParent,
  density: densityProp,
  className = '',
}) {
  const f = { ...DEFAULT_FINDING, ...finding };
  const [expanded, setExpanded] = React.useState(false);
  const [sev, setSev] = React.useState(f.severity);
  const [reviewed, setReviewed] = React.useState(false);
  const density = densityProp || useDensity();
  const isNew = f.discoveredAt > 0 && Date.now() - f.discoveredAt < 10 * 60 * 1000;
  const sevMeta = FC_SEVERITY[sev] || FC_SEVERITY.medium;

  const changeSev = s => {
    setSev(s);
    if (onSeverityChange) onSeverityChange(f.id, s);
  };
  const markReviewed = () => {
    setReviewed(r => !r);
    if (onMarkReviewed) onMarkReviewed(f.id, !reviewed);
  };

  return (
    <article
      className={`fc-card fc-sev-${sev} fc-density-${density} ${isNew ? 'fc-new-card' : ''} ${selected ? 'fc-selected' : ''} ${className}`}
      tabIndex={0}
      aria-label={`${f.title}, ${sevMeta.label} severity`}
    >
      <NewFindingRibbon discoveredAt={f.discoveredAt} />
      {selectable && (
        <input
          type="checkbox"
          className="fc-select"
          checked={selected}
          onChange={e => onSelect && onSelect(f.id, e.target.checked)}
          aria-label={`Select ${f.title}`}
        />
      )}
      <div className="fc-card-top">
        <CardHeaderLayout
          severity={sev}
          title={f.title}
          cveId={f.id}
          onSeverityChange={changeSev}
        />
        <RiskScoreDial score={f.riskScore} />
      </div>
      <ConfidenceMeterBar confidence={f.confidence} />
      <PlainLanguageImpactLine text={f.impact} />
      <div className="fc-card-meta">
        <AffectedAssetLine host={f.asset.host} path={f.asset.path} />
        <StatusTagChips tags={f.tags} />
        <ChainLinkGlyph parentId={f.parentId} onOpenParent={onOpenParent} />
      </div>
      <EvidenceThumbnailsInCards evidence={f.evidence} />
      <div className="fc-card-actions">
        <ExploitabilityBadge steps={f.exploitSteps} />
        <TriageStatusRibbon status={f.status} />
        <CommentCountAffordance count={f.comments} />
        <span className="fc-hover-actions">
          <ExpandCollapseChevron
            expanded={expanded}
            onToggle={() => setExpanded(e => !e)}
            label={f.title}
          />
        </span>
      </div>
      {expanded && <div className="fc-expanded">{expandedExtra}</div>}
      <div className="fc-card-footer">
        <CardFooterQuickActions
          onCopyPoc={() => onCopyPoc && onCopyPoc(f.id)}
          onMarkReviewed={markReviewed}
          onExport={() => onExport && onExport(f.id)}
          reviewed={reviewed}
        />
      </div>
    </article>
  );
}
