/**
 * DashboardShell.jsx — wave 19 (ideas 50730–50746, 50751–50754): the dashboard
 * infrastructure around the widget suites: 12-column drag-drop grid with
 * persisted layout, resizable widgets, a searchable widget gallery, per-widget
 * time ranges, maximize-to-detail, refresh controls, empty/error states,
 * role presets, duplication, deep links, auto-refresh, kiosk rotation,
 * threshold alerts, keyboard navigation, a sticky widget and quiet hours.
 *
 * Real, working components — no mock data; widgets fall back to their own
 * deterministic demo data when props are omitted.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GRID_COLS, moveItem, resizeItem, compactLayout,
  gridArea, serializeLayout, deserializeLayout, presetLayout, duplicateDashboard,
  DASHBOARD_PRESETS, TIME_RANGES, TIME_RANGE_LABELS, checkThreshold,
  thresholdLabel, canSeeWidget, visibleLayout, isQuietNow, quietHoursSummary,
  kioskNext, snapshotExport, filterGalleryWidgets, updatedAgo, widgetDeepLink,
} from './dashboardRound2Core.js';
import {
  ActiveHuntsWidget, SeverityDonutWidget, WeeklyFindingsWidget, ThroughputWidget,
  NeedsReviewWidget, TopVulnerableTargetsWidget, AgentActivityHeatmapWidget,
  TimeToFirstFindingWidget, FalsePositiveRateWidget, ReportReadyWidget,
  ScheduledHuntsWidget, IntegrationHealthWidget, LearningAppliedWidget,
  StorageUsageWidget, TeamLeaderboardWidget, SlaRiskWidget,
} from './DashboardWidgets.jsx';
import {
  RecentReportsWidget, WatchlistWidget, ModelStatusWidget, HuntCalendarWidget,
  CostUsageWidget, WebhookDeliveryWidget, PayloadFamilyWidget, RetestQueueWidget,
  MentionsWidget, FindingsTickerWidget, UptimeWidget, ChainsWidget, CoverageWidget,
  ComparativeCard,
} from './DashboardWidgets2.jsx';
import './DashboardWidgets.css';
import './DashboardWidgets2.css';
import './DashboardShell.css';

/* Widget catalog — 50732 gallery entries ----------------------------------- */

export const WIDGET_CATALOG = [
  // wave 18
  { id: 'activeHunts', title: 'Active hunts', category: 'Hunts', description: 'Running hunts with progress rings.', render: (p) => <ActiveHuntsWidget {...p} /> },
  { id: 'severityDonut', title: 'Severity donut', category: 'Findings', description: 'Clickable findings distribution by severity.', render: (p) => <SeverityDonutWidget {...p} /> },
  { id: 'weeklyFindings', title: 'Weekly findings', category: 'Findings', description: 'Sparkline of findings over the last 7 days.', render: (p) => <WeeklyFindingsWidget {...p} /> },
  { id: 'throughput', title: 'Throughput', category: 'Hunts', description: 'Completed hunts per day, 30-day buckets.', render: (p) => <ThroughputWidget {...p} /> },
  { id: 'needsReview', title: 'Needs review', category: 'Triage', description: 'Top 5 findings awaiting a human decision.', render: (p) => <NeedsReviewWidget {...p} /> },
  { id: 'topTargets', title: 'Top vulnerable targets', category: 'Targets', description: 'Targets ranked by finding count with trends.', render: (p) => <TopVulnerableTargetsWidget {...p} /> },
  { id: 'agentHeatmap', title: 'Agent activity', category: 'Hunts', description: '24×7 heatmap of agent work.', render: (p) => <AgentActivityHeatmapWidget {...p} /> },
  { id: 'timeToFirst', title: 'Time to first finding', category: 'Hunts', description: 'How fast hunts surface the first result.', render: (p) => <TimeToFirstFindingWidget {...p} /> },
  { id: 'fpRate', title: 'False-positive rate', category: 'Findings', description: 'Per-engine FP rate with trend.', render: (p) => <FalsePositiveRateWidget {...p} /> },
  { id: 'reportReady', title: 'Report-ready queue', category: 'Reports', description: 'Completed hunts waiting for a report.', render: (p) => <ReportReadyWidget {...p} /> },
  { id: 'schedules', title: 'Scheduled hunts', category: 'Hunts', description: 'Upcoming hunts with countdowns.', render: (p) => <ScheduledHuntsWidget {...p} /> },
  { id: 'integrations', title: 'Integration health', category: 'System', description: 'Slack, webhook and storage health dots.', render: (p) => <IntegrationHealthWidget {...p} /> },
  { id: 'learning', title: 'Learning applied', category: 'System', description: 'What the engine learned from recent hunts.', render: (p) => <LearningAppliedWidget {...p} /> },
  { id: 'storage', title: 'Storage usage', category: 'System', description: 'Evidence storage by tier.', render: (p) => <StorageUsageWidget {...p} /> },
  { id: 'leaderboard', title: 'Team leaderboard', category: 'Team', description: 'Opt-in findings leaderboard.', render: (p) => <TeamLeaderboardWidget {...p} /> },
  { id: 'slaRisk', title: 'SLA risk', category: 'Triage', description: 'Findings sorted by SLA urgency.', render: (p) => <SlaRiskWidget {...p} /> },
  // wave 19
  { id: 'recentReports', title: 'Recent reports', category: 'Reports', description: 'Recent reports with thumbnails, dates, downloads.', render: (p) => <RecentReportsWidget {...p} /> },
  { id: 'watchlist', title: 'Watchlist', category: 'Targets', description: 'Watched targets with new-finding badges.', render: (p) => <WatchlistWidget {...p} /> },
  { id: 'modelStatus', title: 'Model status', category: 'System', description: 'Each brain slot: version, location, health.', render: (p) => <ModelStatusWidget {...p} /> },
  { id: 'huntCalendar', title: 'Hunt calendar', category: 'Hunts', description: 'Month view of scheduled and completed hunts.', render: (p) => <HuntCalendarWidget {...p} /> },
  { id: 'costUsage', title: 'Cost usage', category: 'Billing', description: 'Tier usage with month-end projection.', render: (p) => <CostUsageWidget {...p} /> },
  { id: 'webhookDeliveries', title: 'Webhook deliveries', category: 'Integrations', description: 'Last ten deliveries with status dots and retry.', render: (p) => <WebhookDeliveryWidget {...p} /> },
  { id: 'payloadFamily', title: 'Payload families', category: 'Findings', description: 'Bar chart of the most effective payload families.', render: (p) => <PayloadFamilyWidget {...p} /> },
  { id: 'retestQueue', title: 'Retest queue', category: 'Triage', description: 'Fixed findings awaiting verification, with run-all.', render: (p) => <RetestQueueWidget {...p} /> },
  { id: 'mentions', title: 'Mentions', category: 'Team', description: 'Unread @mentions across findings in one widget.', render: (p) => <MentionsWidget {...p} /> },
  { id: 'findingsTicker', title: 'Findings ticker', category: 'Findings', description: 'Scrolling stream of the latest findings.', render: (p) => <FindingsTickerWidget {...p} /> },
  { id: 'uptime', title: 'Uptime', category: 'System', description: 'Backend and agent-service reliability percentages.', render: (p) => <UptimeWidget {...p} /> },
  { id: 'chains', title: 'Chains', category: 'Findings', description: 'Chained findings: count + top three with mini graphs.', render: (p) => <ChainsWidget {...p} /> },
  { id: 'coverage', title: 'Coverage', category: 'Hunts', description: 'Percentage of attack surface tested.', render: (p) => <CoverageWidget {...p} /> },
  { id: 'comparative', title: 'Hunt vs average', category: 'Hunts', description: '"This hunt vs average" contextual mini card.', render: (p) => <ComparativeCard label="Findings per hunt" current={18} average={12.4} {...p} /> },
];

const CATALOG_BY_ID = Object.fromEntries(WIDGET_CATALOG.map((w) => [w.id, w]));
export function catalogEntry(id) { return CATALOG_BY_ID[id] || null; }

/* Widget frame — refresh, range, maximize, resize, drag -------------------- */

export function WidgetFrame({
  id, x, y, w, h, children, title, deepLinkId, onRemove, onMaximize,
  onRefresh, updatedAt, range, onRangeChange, sticky, focused, onFocus,
  error, onRetry, isEmpty, emptyCta, dragHandleProps,
}) {
  const [resizing, setResizing] = useState(false);
  const resizeRef = useRef(null);

  if (error) {
    return (
      <div className="dsh-frame dsh-frame-error" style={{ gridArea: gridArea({ x, y, w, h }) }} role="alert">
        <strong>{title}</strong>
        <p>Couldn&apos;t load — the widget crashed or its data source failed.</p>
        {onRetry && <button className="dsh-btn" onClick={onRetry}>Retry</button>}
      </div>
    );
  }
  if (isEmpty) {
    return (
      <div className="dsh-frame dsh-frame-empty" style={{ gridArea: gridArea({ x, y, w, h }) }}>
        <strong>{title}</strong>
        <p>Nothing here yet. Configure it to get started.</p>
        {emptyCta}
      </div>
    );
  }
  return (
    <div
      className={`dsh-frame ${sticky ? 'dsh-frame-sticky' : ''} ${focused ? 'dsh-frame-focused' : ''} ${resizing ? 'dsh-frame-resizing' : ''}`}
      style={{ gridArea: gridArea({ x, y, w, h }) }}
      tabIndex={0}
      onFocus={onFocus}
      aria-label={title}
    >
      <div className="dsh-frame-bar">
        <span className="dsh-drag" {...dragHandleProps} title="Drag to reorder" aria-hidden="true">⠿</span>
        {deepLinkId ? (
          <a className="dsh-frame-title" href={widgetDeepLink(deepLinkId)}>{title}</a>
        ) : (
          <span className="dsh-frame-title">{title}</span>
        )}
        <span className="dsh-updated" title="Last refreshed">{updatedAgo(updatedAt || Date.now())}</span>
        <select className="dsh-range" value={range} onChange={(e) => onRangeChange && onRangeChange(e.target.value)} aria-label="Time range">
          {TIME_RANGES.map((r) => <option key={r} value={r}>{TIME_RANGE_LABELS[r]}</option>)}
        </select>
        <button className="dsh-icon-btn" onClick={onRefresh} title="Refresh this widget" aria-label="Refresh this widget">↻</button>
        <button className="dsh-icon-btn" onClick={onMaximize} title="Open full-page view" aria-label="Open full-page view">⤢</button>
        {onRemove && <button className="dsh-icon-btn" onClick={onRemove} title="Remove widget" aria-label="Remove widget">✕</button>}
      </div>
      <div className="dsh-frame-content">{children}</div>
      <div
        ref={resizeRef}
        className="dsh-resize-handle"
        title="Drag to resize"
        onMouseDown={(e) => {
          e.preventDefault();
          setResizing(true);
          const startX = e.clientX; const startY = e.clientY;
          const startW = w; const startH = h;
          const grid = e.currentTarget.closest('.dsh-grid');
          const onMove = (ev) => {
            if (!grid) return;
            const rect = grid.getBoundingClientRect();
            const cellW = rect.width / GRID_COLS;
            const cellH = rect.height / Math.max(1, Math.ceil(rect.width / GRID_COLS));
            const nw = Math.round(startW + (ev.clientX - startX) / cellW);
            const nh = Math.round(startH + (ev.clientY - startY) / cellH);
            resizeRef.current?.dispatchEvent(new CustomEvent('dsh-resize', { detail: { id, w: nw, h: nh }, bubbles: true }));
          };
          const onUp = () => {
            setResizing(false);
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
          };
          window.addEventListener('mousemove', onMove);
          window.addEventListener('mouseup', onUp);
        }}
      >◢</div>
    </div>
  );
}

/* Widget gallery — 50732 + 50752 search ------------------------------------- */

export function WidgetGallery({ open, onClose, onAdd, existingIds = [] }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const categories = useMemo(() => ['All', ...new Set(WIDGET_CATALOG.map((w) => w.category))], []);
  const results = useMemo(() => {
    const filtered = filterGalleryWidgets(WIDGET_CATALOG, query);
    return category === 'All' ? filtered : filtered.filter((w) => w.category === category);
  }, [query, category]);
  useEffect(() => { if (open) { setQuery(''); setCategory('All'); } }, [open ]);
  if (!open) return null;
  return (
    <div className="dsh-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Widget gallery">
      <div className="dsh-modal" onClick={(e) => e.stopPropagation()}>
        <header className="dsh-modal-head">
          <h2>Widget gallery</h2>
          <button className="dsh-btn" onClick={onClose}>Close</button>
        </header>
        <div className="dsh-gallery-controls">
          <input
            className="dsh-search"
            placeholder="Search widgets…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search widgets"
            autoFocus
          />
          <select className="dsh-range" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="dsh-gallery-grid">
          {results.map((w) => (
            <div key={w.id} className="dsh-gallery-card">
              <div className="dsh-gallery-preview" aria-hidden="true">{w.render({})}</div>
              <strong>{w.title}</strong>
              <p className="dsh-muted">{w.description}</p>
              <button
                className="dsh-btn"
                disabled={existingIds.includes(w.id)}
                onClick={() => onAdd(w.id)}
              >
                {existingIds.includes(w.id) ? 'Added' : 'Add widget'}
              </button>
            </div>
          ))}
        </div>
        {results.length === 0 && <p className="dsh-muted">No widgets match “{query}”.</p>}
      </div>
    </div>
  );
}

/* DashboardShell part 2 — grid, presets, kiosk, quiet hours, threshold alerts */

export function useAutoRefresh(enabled, intervalMs, onTick) {
  const [tick, setTick] = useState(0);
  const [pausedByTab, setPausedByTab] = useState(false);
  useEffect(() => {
    if (!enabled) return undefined;
    const id = setInterval(() => {
      if (document.hidden) { setPausedByTab(true); return; }
      setPausedByTab(false);
      setTick((t) => t + 1);
      onTick && onTick();
    }, intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs, onTick]);
  return { tick, pausedByTab };
}

const DEFAULT_LAYOUT = [
  { id: 'severityDonut', x: 0, y: 0, w: 4, h: 2 },
  { id: 'coverage', x: 4, y: 0, w: 4, h: 2 },
  { id: 'findingsTicker', x: 0, y: 2, w: 12, h: 1 },
  { id: 'needsReview', x: 8, y: 0, w: 4, h: 2 },
];

/** The full dashboard shell. */
export function DashboardShell({
  name = 'My dashboard',
  data = {},
  userRoles = [],
  widgetRoles = {},
  thresholds = {},
  onAlert = null,          // (alert) => void — threshold alerts surface here
  onToast = null,          // (toastPayload) => void — e.g. quiet-hours summary
  storageKey = 'infinity.dashboard.layout',
  kioskDashboards = null,
  quietWindow = { start: '22:00', end: '07:00' },
}) {
  const [dashboardName, setDashboardName] = useState(name);
  const [layout, setLayout] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) { const l = deserializeLayout(raw); if (l) return l; }
    } catch { /* private mode */ }
    return DEFAULT_LAYOUT;
  });
  const [ranges, setRanges] = useState({});
  const [updatedAt, setUpdatedAt] = useState({});
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [maximized, setMaximized] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [kiosk, setKiosk] = useState(false);
  const [kioskIdx, setKioskIdx] = useState(0);
  const [stickyId, setStickyId] = useState(null);
  const [focusedId, setFocusedId] = useState(null);
  const [frameErrors, setFrameErrors] = useState({});
  const gridRef = useRef(null);
  const dragRef = useRef(null);

  const visible = useMemo(() => visibleLayout(layout, userRoles, widgetRoles), [layout, userRoles, widgetRoles]);
  const quiet = isQuietNow(new Date(), quietWindow);
  const skippedLive = useRef(0);

  /* Persist layout (50730) */
  useEffect(() => {
    try { localStorage.setItem(storageKey, serializeLayout(layout)); } catch { /* ignore */ }
  }, [layout, storageKey]);

  /* Auto-refresh (50741): 30s, pausing when the tab hides */
  const { tick, pausedByTab } = useAutoRefresh(autoRefresh && !quiet, 30_000, () => {
    setUpdatedAt((u) => {
      const next = { ...u };
      visible.forEach((it) => { next[it.id] = Date.now(); });
      return next;
    });
  });

  /* Kiosk rotation (50742) */
  useEffect(() => {
    if (!kiosk || !kioskDashboards || kioskDashboards.length < 2) return undefined;
    const id = setInterval(() => setKioskIdx((i) => kioskNext(kioskDashboards, i).idx), 20_000);
    return () => clearInterval(id);
  }, [kiosk, kioskDashboards]);

  /* Threshold alerts (50743) */
  useEffect(() => {
    if (!onAlert) return;
    for (const [widgetId, cfg] of Object.entries(thresholds)) {
      const value = (data.metrics || {})[widgetId];
      if (value == null) continue;
      const level = checkThreshold(value, cfg);
      if (level !== 'ok') onAlert({ widgetId, level, value, message: `${widgetId}: ${thresholdLabel(level)} at ${value} (threshold ${cfg[level]})` });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(data.metrics), JSON.stringify(thresholds)]);

  /* Quiet hours (50754): pause live updates; morning summary when resuming */
  const prevQuiet = useRef(quiet);
  useEffect(() => {
    if (quiet && !prevQuiet.current) skippedLive.current = 0;
    if (!quiet && prevQuiet.current && onToast && skippedLive.current > 0) {
      onToast({ kind: 'quiet-hours', severity: 'info', title: 'Morning summary', body: quietHoursSummary(skippedLive.current, quietWindow), actions: [], persistent: false, createdAt: Date.now() });
    }
    prevQuiet.current = quiet;
  }, [quiet, onToast, quietWindow]);

  /* Drag & drop on the 12-col grid (50730) */
  const onGridDrop = useCallback((e) => {
    const payload = dragRef.current;
    if (!payload || !gridRef.current) return;
    e.preventDefault();
    const rect = gridRef.current.getBoundingClientRect();
    const cellW = rect.width / GRID_COLS;
    const rowH = Math.max(60, cellW / 2);
    const x = Math.floor((e.clientX - rect.left) / cellW);
    const y = Math.floor((e.clientY - rect.top) / rowH);
    setLayout((l) => compactLayout(moveItem(l, payload.id, x, y)));
    dragRef.current = null;
  }, []);

  const onResizeEvent = useCallback((e) => {
    const { id, w, h } = e.detail || {};
    if (!id) return;
    setLayout((l) => resizeItem(l, id, w, h));
  }, []);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return undefined;
    grid.addEventListener('dsh-resize', onResizeEvent);
    return () => grid.removeEventListener('dsh-resize', onResizeEvent);
  }, [onResizeEvent]);

  /* Keyboard navigation between widgets (50751) */
  const onGridKeyDown = useCallback((e) => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Enter'].includes(e.key)) return;
    const ids = visible.map((it) => it.id);
    const idx = ids.indexOf(focusedId);
    if (e.key === 'Enter' && focusedId) { setMaximized(focusedId); return; }
    let next = idx;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = Math.min(ids.length - 1, idx + 1);
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = Math.max(0, idx - 1);
    if (next !== idx || idx === -1) {
      e.preventDefault();
      setFocusedId(ids[next === -1 ? 0 : next]);
    }
  }, [visible, focusedId]);

  const addWidget = useCallback((id) => {
    setLayout((l) => compactLayout([...l, { id, x: 0, y: 99, w: 4, h: 2 }]));
    setGalleryOpen(false);
  }, []);

  const applyPreset = useCallback((presetName) => {
    const l = presetLayout(presetName, WIDGET_CATALOG.map((w) => w.id));
    if (l) setLayout(l);
  }, []);

  const onDuplicate = useCallback(() => {
    const copy = duplicateDashboard({ name: dashboardName, layout });
    setDashboardName(copy.name);
    setLayout(copy.layout);
  }, [dashboardName, layout]);

  const exportSnapshot = useCallback((format) => {
    const desc = snapshotExport(dashboardName, format);
    return desc;
  }, [dashboardName]);

  const renderWidget = useCallback((id) => {
    const entry = catalogEntry(id);
    if (!entry) return null;
    const range = ranges[id] || '7d';
    const d = data[id] || {};
    try {
      return entry.render({ ...d, range, tick });
    } catch (err) {
      setFrameErrors((fe) => ({ ...fe, [id]: String(err && err.message) }));
      return null;
    }
  }, [data, ranges, tick]);

  const stickyItem = visible.find((it) => it.id === stickyId);

  return (
    <div className={`dsh ${kiosk ? 'dsh-kiosk' : ''}`} data-dashboard={dashboardName}>
      <header className="dsh-topbar">
        <h1 className="dsh-name">{dashboardName}</h1>
        <div className="dsh-topbar-actions">
          {Object.keys(DASHBOARD_PRESETS).map((p) => (
            <button key={p} className="dsh-btn dsh-btn-sm" title={DASHBOARD_PRESETS[p].description}
              onClick={() => applyPreset(p)}>Preset: {DASHBOARD_PRESETS[p].label}</button>
          ))}
          <button className="dsh-btn dsh-btn-sm" onClick={() => setGalleryOpen(true)}>+ Add widget</button>
          <button className="dsh-btn dsh-btn-sm" onClick={onDuplicate}>Duplicate</button>
          <button className="dsh-btn dsh-btn-sm" onClick={() => exportSnapshot('png')}>Snapshot PNG</button>
          <button className="dsh-btn dsh-btn-sm" onClick={() => exportSnapshot('pdf')}>Snapshot PDF</button>
          <label className="dsh-toggle" title="Auto-refresh every 30s; pauses when the tab is hidden">
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
            Auto-refresh
          </label>
          <button className="dsh-btn dsh-btn-sm" onClick={() => setKiosk((k) => !k)}>{kiosk ? 'Exit kiosk' : 'Kiosk'}</button>
        </div>
      </header>

      {quiet && (
        <div className="dsh-quiet-banner" role="status">
          Quiet hours ({quietWindow.start}–{quietWindow.end}) — live updates paused. They resume with a morning summary.
        </div>
      )}
      {pausedByTab && autoRefresh && !quiet && (
        <div className="dsh-quiet-banner" role="status">Tab hidden — auto-refresh paused.</div>
      )}

      {stickyItem && (
        <div className="dsh-sticky" aria-label="Pinned widget">
          {renderWidget(stickyItem.id)}
          <button className="dsh-btn dsh-btn-sm" onClick={() => setStickyId(null)}>Unpin</button>
        </div>
      )}

      <div
        ref={gridRef}
        className="dsh-grid"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onGridDrop}
        onKeyDown={onGridKeyDown}
        role="grid"
        aria-label={dashboardName}
      >
        {visible.map((it) => {
          const entry = catalogEntry(it.id);
          const title = entry ? entry.title : it.id;
          return (
            <WidgetFrame
              key={it.id}
              id={it.id} x={it.x} y={it.y} w={it.w} h={it.h}
              title={title}
              deepLinkId={it.id}
              updatedAt={updatedAt[it.id]}
              range={ranges[it.id] || '7d'}
              onRangeChange={(r) => setRanges((s) => ({ ...s, [it.id]: r }))}
              onRefresh={() => setUpdatedAt((u) => ({ ...u, [it.id]: Date.now() }))}
              onMaximize={() => setMaximized(it.id)}
              onRemove={() => setLayout((l) => l.filter((x) => x.id !== it.id))}
              sticky={stickyId === it.id}
              focused={focusedId === it.id}
              onFocus={() => setFocusedId(it.id)}
              error={frameErrors[it.id]}
              onRetry={() => setFrameErrors((fe) => { const n = { ...fe }; delete n[it.id]; return n; })}
              dragHandleProps={{
                draggable: true,
                onDragStart: () => { dragRef.current = { id: it.id }; },
              }}
            >
              <div className="dsh-frame-pinrow">
                {stickyId === it.id ? (
                  <button className="dsh-btn dsh-btn-sm" onClick={() => setStickyId(null)}>Unpin</button>
                ) : (
                  <button className="dsh-btn dsh-btn-sm" onClick={() => setStickyId(it.id)}>Pin</button>
                )}
              </div>
              {renderWidget(it.id)}
            </WidgetFrame>
          );
        })}
      </div>

      <WidgetGallery
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        onAdd={addWidget}
        existingIds={layout.map((it) => it.id)}
      />

      {maximized && (
        <div className="dsh-modal-backdrop" onClick={() => setMaximized(null)} role="dialog" aria-modal="true" aria-label="Widget detail view">
          <div className="dsh-modal dsh-modal-wide" onClick={(e) => e.stopPropagation()}>
            <header className="dsh-modal-head">
              <h2>{catalogEntry(maximized)?.title || maximized}</h2>
              <a className="dsh-btn" href={widgetDeepLink(maximized)}>Open full page</a>
              <button className="dsh-btn" onClick={() => setMaximized(null)}>Close</button>
            </header>
            <div className="dsh-maximized">{renderWidget(maximized)}</div>
          </div>
        </div>
      )}

      {kiosk && kioskDashboards && kioskDashboards.length > 1 && (
        <div className="dsh-kiosk-dots" aria-hidden="true">
          {kioskDashboards.map((d, i) => <span key={d} className={i === kioskIdx ? 'on' : ''} />)}
        </div>
      )}
    </div>
  );
}

export default DashboardShell;
