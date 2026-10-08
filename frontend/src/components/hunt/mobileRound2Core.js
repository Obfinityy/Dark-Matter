/**
 * mobileRound2Core.js — Infinity AI · Dark-Matter · Wave 50
 * Pure logic (no React, no DOM, no network) backing the Mobile Round 2 suite:
 * idea-bank ideas 51961–51980. Every exported function is pure and deterministic.
 */

export const WAVE50_MR2_IDEAS = [
  { id: 51961, title: 'Snapshot viewer payload' },
  { id: 51962, title: 'Swipe-triage reducer' },
  { id: 51963, title: 'Offline snapshot cache' },
  { id: 51964, title: 'Biometric lock gate' },
  { id: 51965, title: 'Quick-action shortcuts' },
  { id: 51966, title: 'Dark-mode theme tokens' },
  { id: 51967, title: 'Data-saver mode' },
  { id: 51968, title: 'Battery-saver polling schedule' },
  { id: 51969, title: 'Widget-stack builder' },
  { id: 51970, title: 'Apple Watch alert payload' },
  { id: 51971, title: 'Wear OS alert payload' },
  { id: 51972, title: 'Tablet two-pane layout spec' },
  { id: 51973, title: 'Landscape layout spec' },
  { id: 51974, title: 'Share-sheet payload builder' },
  { id: 51975, title: 'Screenshot markup spec' },
  { id: 51976, title: 'Comment-thread builder' },
  { id: 51977, title: 'Mobile steering command builder' },
  { id: 51978, title: 'Strategy picker options' },
  { id: 51979, title: 'Mobile test-request payload' },
  { id: 51980, title: 'Confidence view payload' },
];

// 51961 — Snapshot viewer: normalize a hunt snapshot into a compact mobile render spec.
export function normalizeSnapshot(snapshot) {
  const s = snapshot || {};
  const findings = Array.isArray(s.findings) ? s.findings : [];
  const sevCount = findings.reduce((acc, f) => {
    const k = String(f && f.severity || 'info').toLowerCase();
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  return {
    huntId: s.huntId || null,
    takenAt: s.takenAt || null,
    status: s.status || 'unknown',
    summary: {
      targets: Number(s.targets || 0),
      findings: findings.length,
      severity: sevCount,
    },
    topFindings: findings.slice(0, 5).map((f) => ({
      id: f && f.id || null,
      title: String(f && f.title || 'Untitled finding'),
      severity: String(f && f.severity || 'info'),
    })),
    compact: true,
  };
}

// 51962 — Swipe-triage reducer: confirm / dismiss / escalate findings via swipe actions.
const TRIAGE_ACTIONS = { 'swipe-right': 'confirm', 'swipe-left': 'dismiss', 'swipe-up': 'escalate' };
export function reduceSwipeTriage(state, action) {
  const current = Array.isArray(state) ? state : [];
  const a = action || {};
  const resolved = TRIAGE_ACTIONS[a.swipe] || null;
  if (!resolved || a.findingId == null) {
    return { state: current, applied: false, decision: null };
  }
  return {
    state: current.map((f) =>
      f && f.id === a.findingId ? { ...f, triage: resolved } : f
    ),
    applied: true,
    decision: { findingId: a.findingId, swipe: a.swipe, decision: resolved },
  };
}

// 51963 — Offline snapshot cache: store/retrieve with staleness flag.
export function storeSnapshotCache(cache, snapshot, maxAgeMinutes = 30, now = Date.now()) {
  const c = Array.isArray(cache) ? cache.slice() : [];
  const entry = { snapshot, storedAt: now, maxAgeMs: Number(maxAgeMinutes) * 60000 };
  c.push(entry);
  return c;
}
export function retrieveSnapshotCache(cache, now = Date.now()) {
  const c = Array.isArray(cache) ? cache : [];
  if (c.length === 0) return { hit: false, snapshot: null, stale: false, ageMinutes: null };
  const latest = c[c.length - 1];
  const ageMs = now - latest.storedAt;
  const stale = ageMs > latest.maxAgeMs;
  return { hit: true, snapshot: latest.snapshot, stale, ageMinutes: Math.floor(ageMs / 60000) };
}

// 51964 — Biometric lock gate: evaluate the unlock policy for the mobile app.
export function evaluateBiometricGate(policy) {
  const p = policy || {};
  const required = p.requireBiometric === true;
  const enrolled = p.biometricEnrolled === true;
  const fallbackPin = p.allowPinFallback === true;
  const unlocked = required ? enrolled && (p.biometricUnlock === true || (fallbackPin && p.pinUnlock === true)) : true;
  return {
    locked: required && !unlocked,
    method: !required ? 'none' : enrolled && p.biometricUnlock ? 'biometric' : fallbackPin && p.pinUnlock ? 'pin' : 'locked',
    reason: !required ? 'biometric not required' : !enrolled ? 'no biometric enrolled' : unlocked ? 'unlocked' : 'unlock failed',
  };
}

// 51965 — Quick-action shortcuts: 3D-touch / long-press action list for pause, status, snapshot.
export function buildQuickActions(context) {
  const ctx = context || {};
  const actions = [
    { id: 'pause', label: ctx.status === 'paused' ? 'Resume hunt' : 'Pause hunt', icon: 'pause' },
    { id: 'status', label: 'Hunt status', icon: 'gauge' },
    { id: 'snapshot', label: 'Take snapshot', icon: 'camera' },
  ];
  if (ctx.canEscalate) actions.push({ id: 'escalate', label: 'Escalate last finding', icon: 'alert' });
  return { actions, count: actions.length };
}

// 51966 — Dark-mode theme tokens for night monitoring.
export function buildNightThemeTokens(overrides) {
  const base = {
    background: '#0b0e17',
    surface: '#141826',
    border: '#2a3048',
    text: '#e8eaf2',
    muted: '#9aa3bd',
    accent: '#7fd0ff',
    severity: { critical: '#ff6b7a', high: '#ffa94d', medium: '#ffd43b', low: '#69db7c', info: '#74c0fc' },
    minContrastRatio: 4.5,
  };
  return { ...base, ...(overrides || {}), severity: { ...base.severity, ...((overrides || {}).severity || {}) } };
}

// 51967 — Data-saver mode: filter/redact payloads for low bandwidth.
const REDACT_KEYS = ['token', 'secret', 'password', 'apikey', 'api_key', 'authorization', 'cookie'];
export function applyDataSaver(payload, options) {
  const p = payload || {};
  const opts = options || {};
  const redactSecrets = opts.redactSecrets !== false;
  const stripEvidence = opts.stripEvidence === true;
  const maxFields = Number(opts.maxFields || 12);
  const out = {};
  let kept = 0;
  for (const [key, value] of Object.entries(p)) {
    if (kept >= maxFields) break;
    const k = String(key).toLowerCase();
    if (redactSecrets && REDACT_KEYS.some((r) => k.includes(r))) {
      out[key] = '[redacted]';
      kept += 1;
      continue;
    }
    if (stripEvidence && k.includes('evidence')) continue;
    out[key] = value;
    kept += 1;
  }
  return { payload: out, fieldCount: kept, dataSaver: true };
}

// 51968 — Battery-saver polling schedule: slower intervals as battery drops.
export function scheduleBatterySaver(batteryPercent, isCharging = false) {
  const pct = Number(batteryPercent);
  if (isCharging || pct >= 50) return { intervalSeconds: 15, mode: 'normal' };
  if (pct >= 25) return { intervalSeconds: 60, mode: 'balanced' };
  return { intervalSeconds: 300, mode: 'battery-saver' };
}

// 51969 — Widget-stack builder: configure multiple hunt widgets for the home screen.
const WIDGET_TYPES = ['status', 'findings', 'eta', 'alerts'];
export function buildWidgetStack(widgets) {
  const list = (Array.isArray(widgets) ? widgets : [])
    .filter((w) => w && WIDGET_TYPES.includes(w.type))
    .map((w, i) => ({ id: w.id || `widget-${i + 1}`, type: w.type, huntId: w.huntId || null, size: w.size || 'medium' }));
  return { widgets: list, count: list.length, validTypes: WIDGET_TYPES };
}

// 51970 — Apple Watch alert payload: glanceable watch alert.
export function buildAppleWatchAlert(finding) {
  const f = finding || {};
  return {
    platform: 'watchos',
    title: String(f.title || 'New finding'),
    severity: String(f.severity || 'info'),
    shortText: `${String(f.severity || 'info').toUpperCase()}: ${String(f.title || 'New finding')}`,
    actions: [{ id: 'view', label: 'View' }, { id: 'triage', label: 'Triage' }],
    glanceable: true,
  };
}

// 51971 — Wear OS alert payload: glanceable Wear OS alert.
export function buildWearOsAlert(finding) {
  const f = finding || {};
  return {
    platform: 'wearos',
    title: String(f.title || 'New finding'),
    severity: String(f.severity || 'info'),
    shortText: `${String(f.severity || 'info').toUpperCase()} · ${String(f.title || 'New finding')}`,
    actions: [{ id: 'view', label: 'View' }, { id: 'dismiss', label: 'Dismiss' }],
    glanceable: true,
  };
}

// 51972 — Tablet two-pane layout spec: master list + detail pane.
export function buildTabletLayout(state) {
  const s = state || {};
  const width = Number(s.width || 0);
  const twoPane = width >= 1024;
  return {
    twoPane,
    breakpoint: twoPane ? 'tablet-landscape' : 'phone',
    master: { pane: 'list', widthRatio: twoPane ? 0.38 : 1 },
    detail: { pane: 'detail', widthRatio: twoPane ? 0.62 : 0, visible: twoPane || Boolean(s.detailOpen) },
    selectedId: s.selectedId || null,
  };
}

// 51973 — Landscape layout spec: rotated phone/tablet layout.
export function buildLandscapeLayout(viewport) {
  const v = viewport || {};
  const landscape = Number(v.width || 0) > Number(v.height || 0);
  return {
    orientation: landscape ? 'landscape' : 'portrait',
    columns: landscape ? 2 : 1,
    showSidebar: landscape,
    chartHeight: landscape ? 160 : 260,
  };
}

// 51974 — Share-sheet payload builder: share findings/hunts to other apps.
export function buildSharePayload(item, target) {
  const it = item || {};
  const text = `${String(it.title || 'Hunt update')} — ${String(it.summary || '')}`.trim();
  return {
    text,
    url: it.url || null,
    title: String(it.title || 'Dark-Matter'),
    target: target || 'system-sheet',
    exportedAt: new Date().toISOString(),
  };
}

// 51975 — Screenshot markup spec: annotate ops on captured screenshots.
const MARKUP_TOOLS = ['arrow', 'box', 'blur', 'text'];
export function buildMarkupSpec(annotations) {
  const list = (Array.isArray(annotations) ? annotations : [])
    .filter((a) => a && MARKUP_TOOLS.includes(a.tool))
    .map((a, i) => ({ id: a.id || `mark-${i + 1}`, tool: a.tool, x: Number(a.x || 0), y: Number(a.y || 0), label: String(a.label || '') }));
  return { annotations: list, count: list.length, tools: MARKUP_TOOLS };
}

// 51976 — Comment-thread builder: team comments on a finding from mobile.
export function buildCommentThread(findingId, comments) {
  const list = (Array.isArray(comments) ? comments : []).map((c, i) => ({
    id: c && c.id || `c-${i + 1}`,
    author: String(c && c.author || 'Infinity AI'),
    body: String(c && c.body || ''),
    ts: (c && c.ts) || new Date().toISOString(),
  }));
  return { findingId: findingId || null, comments: list, count: list.length };
}
export function appendComment(thread, comment) {
  const t = thread || { findingId: null, comments: [] };
  const next = { ...t, comments: [...t.comments, comment] };
  return buildCommentThread(t.findingId, next.comments);
}

// 51977 — Mobile steering command builder: safe steering commands from the phone.
const STEERING_COMMANDS = ['pause', 'resume', 'escalate-scope', 'deescalate', 'snapshot', 'request-approval'];
export function buildSteeringCommand(command, huntId, note) {
  const valid = STEERING_COMMANDS.includes(command);
  return {
    valid,
    command: valid ? command : null,
    huntId: huntId || null,
    note: String(note || ''),
    risk: command === 'escalate-scope' ? 'high' : 'low',
    requiresApproval: command === 'escalate-scope',
  };
}

// 51978 — Strategy picker options: pick a hunt strategy from mobile.
const STRATEGIES = [
  { id: 'recon-first', label: 'Recon first', description: 'Enumerate before probing' },
  { id: 'balanced', label: 'Balanced', description: 'Steady coverage and probing' },
  { id: 'aggressive', label: 'Aggressive', description: 'Deep probing, higher load' },
  { id: 'stealth', label: 'Stealth', description: 'Low-noise, slow checks' },
];
export function listStrategyOptions(currentId) {
  return STRATEGIES.map((s) => ({ ...s, selected: s.id === currentId }));
}
export function selectStrategy(currentId, strategyId) {
  const valid = STRATEGIES.some((s) => s.id === strategyId);
  return { selected: valid ? strategyId : currentId, changed: valid && strategyId !== currentId };
}

// 51979 — Mobile test-request payload: ask the backend to run an extra test from the phone.
export function buildTestRequest(huntId, check, target) {
  return {
    huntId: huntId || null,
    check: String(check || ''),
    target: String(target || ''),
    valid: Boolean(huntId && check && target),
    requestedAt: new Date().toISOString(),
  };
}

// 51980 — Confidence view payload: per-finding confidence for mobile review.
export function buildConfidenceView(findings) {
  const list = (Array.isArray(findings) ? findings : []).map((f) => {
    const conf = Number((f && f.confidence) ?? 0);
    return {
      id: f && f.id || null,
      title: String(f && f.title || 'Untitled finding'),
      confidence: Math.min(100, Math.max(0, conf)),
      band: conf >= 80 ? 'high' : conf >= 50 ? 'medium' : 'low',
    };
  });
  const avg = list.length ? list.reduce((n, f) => n + f.confidence, 0) / list.length : 0;
  return { findings: list, average: Math.round(avg * 10) / 10, count: list.length };
}
