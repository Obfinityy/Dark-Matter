/**
 * dashboardRound2Core.js — wave 19 (ideas 50721–50760): pure logic for the
 * dashboard round-2 widget suite and the toast notification system.
 *
 * 13 new dashboard widgets (50721–50729, 50747–50750), 21 dashboard
 * infrastructure behaviors (50730–50746, 50751–50754) and 6 toast behaviors
 * (50755–50760). Everything is pure functions so it can be unit-tested with
 * node --test. No DOM, no network, no React.
 */

'use strict';

/* WAVE19_IDEAS registry — idea → implementation mapping ------------------- */

export const WAVE19_IDEAS = {
  50721: {
    title: 'Recent-reports widget',
    status: 'new',
    module: 'DashboardWidgets2:RecentReportsWidget',
  },
  50722: { title: 'Watchlist widget', status: 'new', module: 'DashboardWidgets2:WatchlistWidget' },
  50723: {
    title: 'Model-status widget',
    status: 'new',
    module: 'DashboardWidgets2:ModelStatusWidget',
  },
  50724: {
    title: 'Hunt-calendar widget',
    status: 'new',
    module: 'DashboardWidgets2:HuntCalendarWidget',
  },
  50725: { title: 'Cost-usage widget', status: 'new', module: 'DashboardWidgets2:CostUsageWidget' },
  50726: {
    title: 'Webhook-delivery widget',
    status: 'new',
    module: 'DashboardWidgets2:WebhookDeliveryWidget',
  },
  50727: {
    title: 'Payload-family widget',
    status: 'new',
    module: 'DashboardWidgets2:PayloadFamilyWidget',
  },
  50728: {
    title: 'Retest-queue widget',
    status: 'new',
    module: 'DashboardWidgets2:RetestQueueWidget',
  },
  50729: { title: 'Mentions widget', status: 'new', module: 'DashboardWidgets2:MentionsWidget' },
  50730: {
    title: 'Drag-drop widget layout',
    status: 'new',
    module: 'DashboardShell:grid + dragDropLayout',
  },
  50731: { title: 'Resizable widgets', status: 'new', module: 'DashboardShell:resizeItem' },
  50732: { title: 'Widget gallery', status: 'new', module: 'DashboardShell:WidgetGallery' },
  50733: {
    title: 'Per-widget time range',
    status: 'new',
    module: 'DashboardShell:TimeRangePicker',
  },
  50734: { title: 'Widget maximize', status: 'new', module: 'DashboardShell:WidgetMaximizer' },
  50735: {
    title: 'Widget refresh control',
    status: 'new',
    module: 'DashboardShell:RefreshControl',
  },
  50736: { title: 'Widget empty state', status: 'new', module: 'DashboardShell:WidgetEmptyState' },
  50737: { title: 'Widget error state', status: 'new', module: 'DashboardShell:WidgetErrorState' },
  50738: { title: 'Dashboard presets', status: 'new', module: 'DashboardShell:DASHBOARD_PRESETS' },
  50739: { title: 'Duplicate dashboard', status: 'new', module: 'duplicateDashboard' },
  50740: { title: 'Widget deep links', status: 'new', module: 'widgetDeepLink' },
  50741: { title: 'Auto-refresh toggle', status: 'new', module: 'DashboardShell:useAutoRefresh' },
  50742: { title: 'Kiosk mode', status: 'new', module: 'DashboardShell:KioskMode' },
  50743: {
    title: 'Widget threshold alerts',
    status: 'new',
    module: 'checkThreshold + ThresholdAlert',
  },
  50744: {
    title: 'Comparative mini cards',
    status: 'new',
    module: 'DashboardWidgets2:ComparativeCard',
  },
  50745: { title: 'Dashboard snapshot export', status: 'new', module: 'snapshotExport' },
  50746: { title: 'Widget access control', status: 'new', module: 'canSeeWidget' },
  50747: {
    title: 'Findings ticker widget',
    status: 'new',
    module: 'DashboardWidgets2:FindingsTickerWidget',
  },
  50748: { title: 'Uptime widget', status: 'new', module: 'DashboardWidgets2:UptimeWidget' },
  50749: { title: 'Chains widget', status: 'new', module: 'DashboardWidgets2:ChainsWidget' },
  50750: { title: 'Coverage widget', status: 'new', module: 'DashboardWidgets2:CoverageWidget' },
  50751: {
    title: 'Keyboard widget navigation',
    status: 'new',
    module: 'DashboardShell:WidgetGrid keyboard nav',
  },
  50752: {
    title: 'Widget gallery search',
    status: 'new',
    module: 'DashboardShell:filterGalleryWidgets',
  },
  50753: { title: 'Sticky widget', status: 'new', module: 'DashboardShell:StickyWidget' },
  50754: { title: 'Quiet-hours dashboards', status: 'new', module: 'isQuietNow + QuietHours' },
  50755: { title: 'Critical-finding toast', status: 'new', module: 'ToastCenter:criticalToast' },
  50756: { title: 'Phase-complete toast', status: 'new', module: 'ToastCenter:phaseToast' },
  50757: { title: 'Toast stacking', status: 'new', module: 'stackToasts' },
  50758: { title: 'Inline toast actions', status: 'new', module: 'ToastCenter:ToastActions' },
  50759: { title: 'Persistent error toasts', status: 'new', module: 'ToastCenter:errorToast' },
  50760: {
    title: 'Configurable toast position',
    status: 'new',
    module: 'ToastCenter:TOAST_POSITIONS',
  },
};

export function wave19IdeasComplete() {
  const ids = Object.keys(WAVE19_IDEAS).map(Number);
  if (ids.length !== 40) return false;
  for (let i = 50721; i <= 50760; i++) if (!WAVE19_IDEAS[i]) return false;
  return true;
}

/* Dashboard grid: 12-column layout math ---------------------------------- */

export const GRID_COLS = 12;
export const MIN_W = 1;
export const MIN_H = 1;
export const MAX_W = 12;
export const MAX_H = 4;

/** @returns true when two grid items overlap */
export function collides(a, b) {
  if (a.id === b.id) return false;
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}

/** Clamp an item into the grid bounds; rows may grow unbounded. */
export function normalizeItem(item) {
  const w = Math.max(MIN_W, Math.min(MAX_W, Math.round(item.w || 3)));
  const h = Math.max(MIN_H, Math.min(MAX_H, Math.round(item.h || 2)));
  const x = Math.max(0, Math.min(GRID_COLS - w, Math.round(item.x || 0)));
  const y = Math.max(0, Math.round(item.y || 0));
  return { ...item, x, y, w, h };
}

/** Move an item to a new cell; returns a NEW layout array. */
export function moveItem(layout, id, x, y) {
  return layout.map(it => (it.id === id ? normalizeItem({ ...it, x, y }) : it));
}

/** Resize an item (clamped to grid); returns a NEW layout array. */
export function resizeItem(layout, id, w, h) {
  return layout.map(it => (it.id === id ? normalizeItem({ ...it, w, h }) : it));
}

/** Compact: push every item up into free space above it (stable order). */
export function compactLayout(layout) {
  const sorted = layout.map(normalizeItem).sort((a, b) => a.y - b.y || a.x - b.x);
  const placed = [];
  for (const item of sorted) {
    let candidate = { ...item, y: 0 };
    while (candidate.y < item.y && placed.some(p => collides(candidate, p))) {
      candidate.y += 1;
    }
    while (placed.some(p => collides(candidate, p))) {
      candidate.y += 1;
    }
    placed.push(candidate);
  }
  return placed;
}

/** Convert a layout item to a CSS grid-area string (1-based). */
export function gridArea(item) {
  return `${item.y + 1} / ${item.x + 1} / span ${item.h} / span ${item.w}`;
}

export function serializeLayout(layout) {
  return JSON.stringify(layout.map(({ id, x, y, w, h }) => ({ id, x, y, w, h })));
}

export function deserializeLayout(json) {
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  return compactLayout(parsed.filter(it => typeof it.id === 'string').map(normalizeItem));
}

/* Dashboard presets ------------------------------------------------------- */

export const DASHBOARD_PRESETS = {
  executive: {
    label: 'Executive',
    description: 'Findings trend, coverage, SLA risk and cost at a glance.',
    widgets: ['severityDonut', 'coverage', 'costUsage', 'recentReports', 'findingsTicker'],
  },
  researcher: {
    label: 'Researcher',
    description: 'Chains, payload families, heatmaps and watchlist depth.',
    widgets: ['chains', 'payloadFamily', 'watchlist', 'retestQueue', 'agentHeatmap'],
  },
  triage: {
    label: 'Triage',
    description: 'Needs-review, criticals, mentions and SLA risk first.',
    widgets: ['needsReview', 'criticalToastFeed', 'mentions', 'slaRisk', 'webhookDeliveries'],
  },
};

export function presetLayout(presetName, widgetIds) {
  const preset = DASHBOARD_PRESETS[presetName];
  if (!preset) return null;
  const ids = widgetIds.filter(id => preset.widgets.includes(id));
  const layout = [];
  let cursor = 0;
  for (const id of ids) {
    const w = id === 'findingsTicker' ? 12 : id === 'payloadFamily' || id === 'chains' ? 6 : 4;
    const h = w === 12 ? 1 : 2;
    layout.push({ id, x: cursor % GRID_COLS, y: Math.floor(cursor / GRID_COLS) * 2, w, h });
    cursor += w;
  }
  return compactLayout(layout);
}

/** Duplicate a dashboard: new ids, same geometry, new name. */
export function duplicateDashboard(dashboard, suffix = ' (copy)') {
  const layout = deserializeLayout(serializeLayout(dashboard.layout));
  const renamed = layout.map(it => ({ ...it, id: `${it.id}-copy-${Date.now() % 100000}` }));
  return { ...dashboard, name: dashboard.name + suffix, layout: renamed };
}

/* Time ranges -------------------------------------------------------------- */

export const TIME_RANGES = ['24h', '7d', '30d', 'all'];
export const TIME_RANGE_LABELS = {
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  all: 'All time',
};

export function rangeMs(range) {
  switch (range) {
    case '24h':
      return 24 * 3600 * 1000;
    case '7d':
      return 7 * 24 * 3600 * 1000;
    case '30d':
      return 30 * 24 * 3600 * 1000;
    default:
      return Infinity;
  }
}

export function inRange(timestamp, range, now = Date.now()) {
  if (range === 'all') return true;
  return now - timestamp <= rangeMs(range);
}

/* Widgets: model layer ----------------------------------------------------- */

export function recentReportsModel(reports, limit = 5) {
  return [...(reports || [])]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit)
    .map(r => ({
      id: r.id,
      title: r.title || 'Untitled report',
      target: r.target || '',
      createdAt: r.createdAt,
      dateLabel: new Date(r.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      findingsCount: r.findingsCount || 0,
      downloadUrl: r.downloadUrl || null,
    }));
}

export function watchlistModel(targets) {
  return (targets || []).map(t => ({
    id: t.id,
    host: t.host,
    newFindings: Math.max(0, t.newFindings || 0),
    lastHuntAt: t.lastHuntAt || null,
    severityMax: t.severityMax || 'none',
  }));
}

export function modelStatusModel(slots) {
  const list = (slots || []).map(s => ({
    slot: s.slot,
    name: s.name || 'Unassigned',
    version: s.version || '—',
    location: s.location === 'kaggle' ? 'Kaggle' : s.location === 'local' ? 'Local' : 'Unset',
    health: s.health || 'unknown', // healthy | degraded | down | unknown
  }));
  const down = list.filter(s => s.health === 'down').length;
  const degraded = list.filter(s => s.health === 'degraded').length;
  return {
    slots: list,
    summary: down > 0 ? 'down' : degraded > 0 ? 'degraded' : list.length ? 'healthy' : 'unknown',
  };
}

/** Build a 6x7 (or 5x7) calendar grid of weeks → day cells. */
export function calendarMonth(year, month /* 0-based */) {
  const first = new Date(year, month, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks = [];
  let day = 1 - startDay;
  while (day <= daysInMonth) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push(
        day >= 1 && day <= daysInMonth
          ? { date: day, inMonth: true }
          : { date: null, inMonth: false }
      );
      day += 1;
    }
    weeks.push(week);
  }
  return weeks;
}

export function huntsByDay(hunts, year, month) {
  const map = {};
  for (const h of hunts || []) {
    const d = new Date(h.startedAt);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const key = d.getDate();
      (map[key] = map[key] || []).push(h);
    }
  }
  return map;
}

export function costUsageModel(spent, tier, dayOfMonth, daysInMonth) {
  const projected = projectMonthEnd(spent, dayOfMonth, daysInMonth);
  return {
    spent,
    tier,
    projected,
    label: `$${spent.toFixed(2)} of $${tier.limit.toFixed(2)}`,
    pct: tier.limit > 0 ? Math.min(100, (spent / tier.limit) * 100) : 0,
    projectedLabel: `$${projected.toFixed(2)} projected`,
    overProjection: projected > tier.limit,
  };
}

/** Linear month-end projection from today's spend. */
export function projectMonthEnd(spent, dayOfMonth, daysInMonth) {
  if (dayOfMonth <= 0 || daysInMonth <= 0) return spent;
  return (spent / dayOfMonth) * daysInMonth;
}

export function webhookDeliveryModel(deliveries, limit = 10) {
  return [...(deliveries || [])]
    .sort((a, b) => b.attemptedAt - a.attemptedAt)
    .slice(0, limit)
    .map(d => ({
      id: d.id,
      event: d.event,
      target: d.target || '',
      status: d.status, // delivered | failed | retrying
      dot: d.status === 'delivered' ? 'green' : d.status === 'retrying' ? 'amber' : 'red',
      attemptedAt: d.attemptedAt,
      retryable: d.status !== 'delivered',
    }));
}

export function rankPayloadFamilies(runs) {
  const byFamily = {};
  for (const r of runs || []) {
    const fam = r.family || 'unknown';
    byFamily[fam] = byFamily[fam] || { family: fam, hits: 0, confirmed: 0 };
    byFamily[fam].hits += 1;
    if (r.confirmed) byFamily[fam].confirmed += 1;
  }
  return Object.values(byFamily)
    .sort((a, b) => b.confirmed - a.confirmed || b.hits - a.hits)
    .map(f => ({ ...f, rate: f.hits ? f.confirmed / f.hits : 0 }));
}

export function retestQueueModel(findings) {
  const queue = (findings || []).filter(f => f.needsRetest && !f.retestedAt);
  return {
    items: queue.map(f => ({ id: f.id, title: f.title, severity: f.severity, fixedAt: f.fixedAt })),
    count: queue.length,
    runAllEnabled: queue.length > 0,
  };
}

export function unreadMentionsModel(mentions) {
  const unread = (mentions || []).filter(m => !m.read);
  return { items: unread, count: unread.length };
}

export function findingsTickerModel(findings, limit = 20) {
  return [...(findings || [])]
    .sort((a, b) => b.foundAt - a.foundAt)
    .slice(0, limit)
    .map(f => ({ id: f.id, title: f.title, severity: f.severity, hunt: f.huntName || '' }));
}

/** Uptime % from up/down event log over a window. */
export function uptimeModel(events, windowMs, now = Date.now()) {
  const inWin = (events || []).filter(e => now - e.at <= windowMs).sort((a, b) => a.at - b.at);
  if (!inWin.length) return { pct: 100, downtimeMs: 0 };
  let downMs = 0;
  let downStart = null;
  for (const e of inWin) {
    if (e.type === 'down' && downStart == null) downStart = e.at;
    if (e.type === 'up' && downStart != null) {
      downMs += e.at - downStart;
      downStart = null;
    }
  }
  if (downStart != null) downMs += now - downStart;
  const pct = Math.max(0, Math.min(100, ((windowMs - downMs) / windowMs) * 100));
  return { pct, downtimeMs: downMs };
}

export function chainsModel(chains, limit = 3) {
  const sorted = [...(chains || [])].sort(
    (a, b) => (b.severityScore || 0) - (a.severityScore || 0)
  );
  return {
    count: (chains || []).length,
    top: sorted.slice(0, limit).map(c => ({
      id: c.id,
      hops: c.findings ? c.findings.length : 0,
      severityScore: c.severityScore || 0,
      title: c.title || 'Untitled chain',
    })),
  };
}

export function coverageModel(tested, total) {
  const pct = total > 0 ? Math.min(100, (tested / total) * 100) : 0;
  return { tested, total, pct };
}

/** "This hunt vs average" comparative mini card. */
export function comparativeCard(current, average, higherIsBetter = true) {
  const delta = current - average;
  const pct = average !== 0 ? (delta / Math.abs(average)) * 100 : 0;
  const good = higherIsBetter ? delta >= 0 : delta <= 0;
  return { current, average, delta, pct, good };
}

/** Widget deep link: every widget title links to its full page. */
export function widgetDeepLink(widgetId, basePath = '/agent') {
  const map = {
    severityDonut: '/findings',
    recentReports: '/reports',
    watchlist: '/targets',
    modelStatus: '/models',
    huntCalendar: '/hunts',
    costUsage: '/billing',
    webhookDeliveries: '/integrations',
    payloadFamily: '/payloads',
    retestQueue: '/retest',
    mentions: '/notifications',
    chains: '/chains',
    coverage: '/coverage',
    needsReview: '/review',
    findingsTicker: '/findings',
    uptime: '/status',
  };
  return `${basePath}${map[widgetId] || ''}`;
}

/* Dashboard threshold alerts, access control, quiet hours, kiosk, export --- */

export const THRESHOLD_LEVELS = ['ok', 'warn', 'crit'];

/**
 * Evaluate a metric against warn/crit thresholds.
 * @returns {'ok'|'warn'|'crit'}
 */
export function checkThreshold(value, thresholds) {
  if (!thresholds) return 'ok';
  const { warn = Infinity, crit = Infinity } = thresholds;
  if (value >= crit) return 'crit';
  if (value >= warn) return 'warn';
  return 'ok';
}

export function thresholdLabel(level) {
  return level === 'crit' ? 'Critical' : level === 'warn' ? 'Warning' : 'Normal';
}

/** Role-based widget visibility (50746). Empty roles array = everyone. */
export function canSeeWidget(widgetId, userRoles = [], widgetRoles = {}) {
  const allowed = widgetRoles[widgetId];
  if (!allowed || allowed.length === 0) return true;
  return userRoles.some(r => allowed.includes(r));
}

/** Filter a layout to widgets visible to the current user. */
export function visibleLayout(layout, userRoles = [], widgetRoles = {}) {
  return compactLayout(layout.filter(it => canSeeWidget(it.id, userRoles, widgetRoles)));
}

/**
 * Quiet hours: are live updates paused right now? (50754)
 * @param {{start:'22:00', end:'07:00'}} window — overnight windows wrap midnight.
 */
export function isQuietNow(now = new Date(), window = { start: '22:00', end: '07:00' }) {
  const toMin = s => {
    const [h, m] = s.split(':').map(Number);
    return h * 60 + m;
  };
  const cur = now.getHours() * 60 + now.getMinutes();
  const s = toMin(window.start);
  const e = toMin(window.end);
  if (s === e) return false;
  return s < e ? cur >= s && cur < e : cur >= s || cur < e;
}

export function quietHoursSummary(skippedCount, window) {
  return (
    `Paused ${skippedCount} live update${skippedCount === 1 ? '' : 's'} overnight ` +
    `(${window.start}–${window.end}). Dashboard caught up on resume.`
  );
}

/** Kiosk rotation (50742): pick the next dashboard index. */
export function kioskNext(dashboards, currentIdx, intervalSec = 20) {
  if (!dashboards || dashboards.length === 0) return { idx: 0, intervalSec };
  return { idx: (currentIdx + 1) % dashboards.length, intervalSec };
}

/** Snapshot export descriptor (50745) — the actual PNG/PDF rendering happens in the shell via canvas. */
export function snapshotExport(dashboardName, format = 'png') {
  const fmt = format === 'pdf' ? 'pdf' : 'png';
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return {
    filename: `${dashboardName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${stamp}.${fmt}`,
    format: fmt,
  };
}

/* Toast system logic (50755–50760) ---------------------------------------- */

export const TOAST_POSITIONS = ['bottom-right', 'bottom-center', 'top-right'];
export const DEFAULT_TOAST_POSITION = 'bottom-right';
export const MOBILE_TOAST_POSITION = 'bottom-center';

export const TOAST_SEVERITY_COLORS = {
  critical: '#ff4d5e',
  high: '#ff8a3d',
  medium: '#ffc53d',
  low: '#3ddc84',
  info: '#4da3ff',
};

export function toastSeverityColor(severity) {
  return TOAST_SEVERITY_COLORS[severity] || TOAST_SEVERITY_COLORS.info;
}

/** Build a critical-finding toast payload (50755). */
export function criticalToast(finding, huntName = '') {
  return {
    kind: 'critical-finding',
    severity: 'critical',
    title: `Critical finding: ${finding.title}`,
    body: huntName ? `in hunt "${huntName}"` : '',
    findingId: finding.id,
    actions: ['view', 'snooze'],
    persistent: false,
    createdAt: Date.now(),
    // wave 20 (50798) — critical toasts auto-expand with finding title + host.
    autoExpand: true,
    findingTitle: finding.title,
    affectedHost: finding.host || finding.url || '',
  };
}

/** Build a phase-complete toast payload (50756). */
export function phaseToast(phase, statLabel, statValue) {
  return {
    kind: 'phase-complete',
    severity: 'info',
    title: `${phase} complete`,
    body: `${statLabel}: ${statValue}`,
    actions: ['view'],
    persistent: false,
    createdAt: Date.now(),
  };
}

/** Build a persistent error toast (50759) — requires explicit acknowledge. */
export function errorToast(message, retryLabel = 'Retry') {
  return {
    kind: 'error',
    severity: 'high',
    title: 'Something failed',
    body: message,
    actions: [retryLabel, 'dismiss'],
    persistent: true, // stays until explicitly acknowledged
    requiresAck: true,
    createdAt: Date.now(),
  };
}

/** Build an inline-action toast (50758). */
export function actionToast(title, body, actions = ['view', 'undo', 'retry']) {
  return {
    kind: 'action',
    severity: 'info',
    title,
    body,
    actions,
    persistent: false,
    createdAt: Date.now(),
  };
}

/**
 * Stacking (50757): at most 3 visible; older collapse into a "+N more" chip.
 * Persistent error toasts are never collapsed.
 */
export const TOAST_STACK_LIMIT = 3;

export function stackToasts(queue) {
  const persistent = queue.filter(t => t.persistent);
  const normal = queue.filter(t => !t.persistent);
  const visible = [
    ...persistent,
    ...normal.slice(-(TOAST_STACK_LIMIT - Math.min(persistent.length, TOAST_STACK_LIMIT))),
  ];
  const shown = new Set(visible.map(t => t.id));
  const collapsed = queue.filter(t => !shown.has(t.id));
  return { visible, collapsedCount: collapsed.length, collapsed };
}

/** Rate limiting (toast storms): at most one toast per 10s per category. */
export const TOAST_RATE_WINDOW_MS = 10_000;

export function rateLimitOk(
  lastFiredByCategory,
  category,
  now = Date.now(),
  windowMs = TOAST_RATE_WINDOW_MS
) {
  const last = lastFiredByCategory[category] || 0;
  return now - last >= windowMs;
}

/**
 * Group N new findings into one expandable summary toast (shared helper).
 * Returns null when grouping is not needed (fewer than 2).
 */
export function groupFindingsToast(findings) {
  if (!findings || findings.length < 2) return null;
  const crits = findings.filter(f => f.severity === 'critical').length;
  return {
    kind: 'grouped-findings',
    severity: crits > 0 ? 'critical' : 'info',
    title: `${findings.length} new findings`,
    body: crits > 0 ? `including ${crits} critical` : 'expand for details',
    findingIds: findings.map(f => f.id),
    actions: ['expand', 'view'],
    expandable: true,
    persistent: false,
    createdAt: Date.now(),
  };
}

/** Resolve the toast position: setting wins, else responsive default. */
export function resolveToastPosition(setting = null, isMobile = false) {
  if (setting && TOAST_POSITIONS.includes(setting)) return setting;
  return isMobile ? MOBILE_TOAST_POSITION : DEFAULT_TOAST_POSITION;
}

/** Filter widget gallery entries by a search string (50752). */
export function filterGalleryWidgets(entries, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return entries;
  return entries.filter(
    e =>
      e.title.toLowerCase().includes(q) ||
      (e.category || '').toLowerCase().includes(q) ||
      (e.description || '').toLowerCase().includes(q)
  );
}

/** Human "updated X ago" label for the per-widget refresh control (50735). */
export function updatedAgo(updatedAt, now = Date.now()) {
  const s = Math.max(0, Math.floor((now - updatedAt) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}
