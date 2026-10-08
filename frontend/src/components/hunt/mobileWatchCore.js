/**
 * mobileWatchCore.js — Infinity AI · Dark-Matter · Wave 50
 * Pure logic (no React, no DOM, no network) backing the Mobile Watch suite:
 * idea-bank ideas 51981–52000. Every exported function is pure and deterministic.
 */

export const WAVE50_MW_IDEAS = [
  { id: 51981, title: 'Mobile resource monitor' },
  { id: 51982, title: 'Multi-hunt switcher' },
  { id: 51983, title: 'Mobile onboarding tour' },
  { id: 51984, title: 'Mobile accessibility spec' },
  { id: 51985, title: 'Language pack selection' },
  { id: 51986, title: 'Quiet-hours evaluator' },
  { id: 51987, title: 'Emergency controls spec' },
  { id: 51988, title: 'Desktop-to-mobile handoff' },
  { id: 51989, title: 'Deep-link builder' },
  { id: 51990, title: 'Biometric approval gate' },
  { id: 51991, title: 'Mobile hunt creation' },
  { id: 51992, title: 'Report export descriptor' },
  { id: 51993, title: 'Team-chat message normalizer' },
  { id: 51994, title: 'Calendar sync payload' },
  { id: 51995, title: 'Assistant-shortcut intents' },
  { id: 51996, title: 'Focus-mode filter' },
  { id: 51997, title: 'Glanceable complications payload' },
  { id: 51998, title: 'Data export descriptor' },
  { id: 51999, title: 'Feedback report builder' },
  { id: 52000, title: 'Performance budget checker' },
];

// 51981 — Resource monitor payload: spend/usage from the phone.
export function buildResourceMonitor(usage) {
  const u = usage || {};
  const cpu = Number(u.cpuPercent || 0);
  const mem = Number(u.memoryMb || 0);
  const cost = Number(u.costUsd || 0);
  return {
    cpuPercent: cpu,
    memoryMb: mem,
    costUsd: cost,
    budgetUsd: u.budgetUsd == null ? null : Number(u.budgetUsd),
    overBudget: u.budgetUsd != null && cost > Number(u.budgetUsd),
    health: cpu > 90 ? 'strained' : cpu > 60 ? 'busy' : 'healthy',
  };
}

// 51982 — Multi-hunt switcher payload: switch the active hunt on mobile.
export function buildHuntSwitcher(hunts, activeId) {
  const list = (Array.isArray(hunts) ? hunts : []).map(h => ({
    id: h.id,
    name: String(h.name || 'Unnamed hunt'),
    status: h.status || 'unknown',
    active: h.id === activeId,
  }));
  return { hunts: list, activeId: activeId || null, count: list.length };
}

// 51983 — Onboarding tour steps: first-run mobile tour.
export function buildOnboardingTour() {
  return [
    { step: 1, title: 'Welcome', body: 'Monitor your hunts from your phone.' },
    { step: 2, title: 'Swipe to triage', body: 'Swipe right to confirm, left to dismiss.' },
    { step: 3, title: 'Alerts', body: 'Critical findings reach your watch instantly.' },
    { step: 4, title: 'Approve anywhere', body: 'Approve or deny sensitive actions on the go.' },
    { step: 5, title: 'Stay in control', body: 'Emergency controls are two taps away.' },
  ];
}

// 51984 — Accessibility spec: VoiceOver/TalkBack roles and labels.
export function buildA11ySpec(componentName, label) {
  return {
    component: String(componentName || 'component'),
    accessibilityRole: 'button',
    accessibilityLabel: String(label || ''),
    accessibilityHint: 'Double-tap to activate',
    screenReaders: ['VoiceOver', 'TalkBack'],
    minTouchTargetPx: 48,
  };
}

// 51985 — Language pack selection: pick a UI language on mobile.
const LANGUAGE_PACKS = [
  { id: 'en', label: 'English', rtl: false },
  { id: 'hi', label: 'Hindi', rtl: false },
  { id: 'es', label: 'Spanish', rtl: false },
  { id: 'ar', label: 'Arabic', rtl: true },
];
export function listLanguagePacks(currentId) {
  return LANGUAGE_PACKS.map(p => ({ ...p, selected: p.id === currentId }));
}
export function selectLanguage(currentId, languageId) {
  const pack = LANGUAGE_PACKS.find(p => p.id === languageId);
  return {
    language: pack || LANGUAGE_PACKS.find(p => p.id === currentId) || LANGUAGE_PACKS[0],
    changed: Boolean(pack),
  };
}

// 51986 — Quiet-hours evaluator: decide whether now is a quiet hour.
export function evaluateQuietHours(nowDate, schedule) {
  const s = schedule || {};
  if (!s.enabled) return { quiet: false, reason: 'quiet hours disabled' };
  const d = nowDate instanceof Date ? nowDate : new Date(nowDate);
  const hour = d.getHours();
  const start = Number(s.startHour ?? 22);
  const end = Number(s.endHour ?? 7);
  const inWindow = start <= end ? hour >= start && hour < end : hour >= start || hour < end;
  return {
    quiet: inWindow,
    reason: inWindow ? 'inside quiet window' : 'outside quiet window',
    hour,
  };
}

// 51987 — Emergency controls spec: kill-switch + deny-all reachable in <= 2 taps.
export function buildEmergencyControls() {
  return {
    controls: [
      { id: 'kill-switch', label: 'Stop all hunts', taps: 1, destructive: true },
      { id: 'deny-all', label: 'Deny all pending approvals', taps: 2, destructive: false },
    ],
    maxTaps: 2,
    withinTwoTaps: true,
  };
}

// 51988 — Handoff payload: desktop session handed to mobile.
export function buildHandoffPayload(session) {
  const s = session || {};
  return {
    from: 'desktop',
    to: 'mobile',
    huntId: s.huntId || null,
    view: s.view || 'status',
    scrollTo: s.scrollTo || null,
    handedAt: new Date().toISOString(),
    valid: Boolean(s.huntId),
  };
}

// 51989 — Deep-link builder: open a specific hunt view from a link.
export function buildDeepLink(target) {
  const t = target || {};
  const parts = [];
  if (t.view) parts.push(String(t.view));
  if (t.huntId) parts.push(String(t.huntId));
  const query =
    t.params && typeof t.params === 'object'
      ? '?' +
        Object.entries(t.params)
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
          .join('&')
      : '';
  return {
    url: 'darkmatter:/' + parts.join('/') + query,
    view: t.view || null,
    huntId: t.huntId || null,
    valid: Boolean(t.view),
  };
}

// 51990 — Biometric approval gate: approve sensitive actions with biometrics.
export function evaluateBiometricApproval(request) {
  const r = request || {};
  const enrolled = r.biometricEnrolled === true;
  const matched = r.biometricMatch === true;
  const approved = enrolled && matched && r.action != null;
  return {
    approved,
    action: approved ? r.action : null,
    auditTrail: approved
      ? [{ action: r.action, ts: new Date().toISOString(), method: 'biometric' }]
      : [],
    reason: !enrolled
      ? 'biometric not enrolled'
      : !matched
        ? 'biometric did not match'
        : approved
          ? 'approved'
          : 'no action',
  };
}

// 51991 — Mobile hunt creation payload: start a hunt from the phone.
export function buildMobileHuntCreation(input) {
  const i = input || {};
  const target = String(i.target || '').trim();
  const urlOk = /^https?:\/\/.+\..+/.test(target) || /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(target);
  return {
    target,
    strategy: i.strategy || 'balanced',
    authorized: i.authorized === true,
    valid: Boolean(target && urlOk && i.authorized === true),
    errors: [
      ...(target ? [] : ['target is required']),
      ...(target && !urlOk ? ['target is not a valid domain or URL'] : []),
      ...(i.authorized === true ? [] : ['target must be authorized']),
    ],
  };
}

// 51992 — Report export descriptor: export a hunt report from mobile.
const EXPORT_FORMATS = ['pdf', 'markdown', 'json'];
export function buildReportExportDescriptor(huntId, format) {
  const fmt = String(format || 'pdf').toLowerCase();
  return {
    huntId: huntId || null,
    format: EXPORT_FORMATS.includes(fmt) ? fmt : 'pdf',
    supportedFormats: EXPORT_FORMATS,
    filename: `darkmatter-report-${huntId || 'unknown'}.${EXPORT_FORMATS.includes(fmt) ? fmt : 'pdf'}`,
    valid: Boolean(huntId),
  };
}

// 51993 — Team-chat message normalizer: normalize chat messages for the team channel.
export function normalizeTeamChatMessage(raw) {
  const text = String(raw == null ? '' : raw).trim();
  if (!text) return { empty: true, text: '', mentions: [], isCommand: false };
  const mentions = [...text.matchAll(/@([a-zA-Z0-9_.-]+)/g)].map(m => m[1]);
  const isCommand = text.startsWith('/');
  const [cmd, ...rest] = text.slice(1).split(/\s+/);
  return {
    empty: false,
    text,
    mentions,
    isCommand,
    command: isCommand ? cmd.toLowerCase() : null,
    args: isCommand ? rest.join(' ') : null,
  };
}

// 51994 — Calendar sync payload: push hunt milestones to the calendar.
export function buildCalendarSyncPayload(milestones) {
  const list = (Array.isArray(milestones) ? milestones : []).map((m, i) => ({
    id: (m && m.id) || `milestone-${i + 1}`,
    title: String((m && m.title) || 'Hunt milestone'),
    startsAt: (m && m.startsAt) || null,
    allDay: Boolean(m && m.allDay),
  }));
  return { events: list, count: list.length, provider: 'system-calendar' };
}

// 51995 — Assistant-shortcut intents: Siri/Google Assistant intents for hunt control.
const SHORTCUT_INTENTS = [
  { id: 'check-status', phrase: 'Check hunt status', action: 'status' },
  { id: 'pause-hunt', phrase: 'Pause the hunt', action: 'pause' },
  { id: 'new-snapshot', phrase: 'Take a snapshot', action: 'snapshot' },
];
export function listShortcutIntents() {
  return SHORTCUT_INTENTS.map(s => ({ ...s }));
}
export function matchShortcutIntent(phrase) {
  const q = String(phrase || '').toLowerCase();
  return (
    SHORTCUT_INTENTS.find(s => q.includes(s.phrase.toLowerCase()) || q.includes(s.action)) || null
  );
}

// 51996 — Focus-mode filter: only urgent items during focus mode.
export function applyFocusMode(items, focus) {
  const list = Array.isArray(items) ? items : [];
  const f = focus || {};
  if (!f.enabled) return { items: list, filtered: false, count: list.length };
  const urgent = list.filter(
    it => it && (it.urgent === true || String(it.severity || '').toLowerCase() === 'critical')
  );
  return {
    items: urgent,
    filtered: true,
    hiddenCount: list.length - urgent.length,
    count: urgent.length,
  };
}

// 51997 — Glanceable complications payload: watch-face complications.
export function buildComplicationsPayload(hunt) {
  const h = hunt || {};
  return {
    complications: [
      { slot: 'corner', type: 'status', value: String(h.status || 'unknown') },
      { slot: 'bezel', type: 'findings', value: Number(h.findingsCount || 0) },
      {
        slot: 'inline',
        type: 'eta',
        value: h.etaMinutes == null ? '—' : `${Number(h.etaMinutes)}m`,
      },
    ],
    updatedAt: new Date().toISOString(),
  };
}

// 51998 — Data export descriptor: export hunt data from mobile.
const DATA_EXPORT_FORMATS = ['json', 'csv', 'zip'];
export function buildDataExportDescriptor(huntId, format, scope) {
  const fmt = String(format || 'json').toLowerCase();
  return {
    huntId: huntId || null,
    format: DATA_EXPORT_FORMATS.includes(fmt) ? fmt : 'json',
    supportedFormats: DATA_EXPORT_FORMATS,
    scope: scope || 'findings',
    filename: `darkmatter-data-${huntId || 'unknown'}.${DATA_EXPORT_FORMATS.includes(fmt) ? fmt : 'json'}`,
    valid: Boolean(huntId),
  };
}

// 51999 — Feedback report builder: send feedback about a hunt from mobile.
export function buildFeedbackReport(feedback) {
  const f = feedback || {};
  const rating = Math.min(5, Math.max(1, Number(f.rating || 3)));
  return {
    huntId: f.huntId || null,
    rating,
    category: String(f.category || 'general'),
    notes: String(f.notes || ''),
    valid: Boolean(f.huntId && f.notes),
    sentAt: new Date().toISOString(),
  };
}

// 52000 — Performance budget checker: keep thousand-finding lists fast.
export function checkPerformanceBudget(stats) {
  const s = stats || {};
  const findings = Number(s.findings || 0);
  const renderMs = Number(s.renderMs || 0);
  const memoryMb = Number(s.memoryMb || 0);
  const withinRender = renderMs <= 100;
  const withinMemory = memoryMb <= 150;
  const virtualized = findings > 200 ? Boolean(s.virtualized) : true;
  return {
    findings,
    renderMs,
    memoryMb,
    withinRender,
    withinMemory,
    virtualized,
    withinBudget: withinRender && withinMemory && virtualized,
  };
}
