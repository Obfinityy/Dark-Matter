/**
 * mobileRound3Core.js — Infinity AI · Dark-Matter · Wave 51
 * Pure logic (no React, no DOM, no network) backing the Mobile Round 3 suite:
 * idea-bank ideas 52001–52004. Every exported function is pure and deterministic;
 * time is injected via `now` parameters (defaults to Date.now()).
 */

export const WAVE51_MR3_IDEAS = [
  { id: 52001, title: 'Mobile security' },
  { id: 52002, title: 'Mobile update channel' },
  { id: 52003, title: 'Mobile usage analytics' },
  { id: 52004, title: 'Mobile end-of-hunt summary' },
];

// 52001 — Mobile security: evaluate the certificate-pinning policy for a host.
export function evaluatePinningPolicy(config, now = Date.now()) {
  const c = config || {};
  const expected = Array.isArray(c.pins) ? c.pins : [];
  const pinMatch = expected.length > 0 && expected.includes(c.presentedPin);
  const expiresAt = Number(c.certExpiresAt || 0);
  const expiresInDays = expiresAt > 0 ? Math.floor((expiresAt - now) / 86400000) : null;
  const expiresSoon = expiresInDays != null && expiresInDays <= 14;
  const status = !pinMatch ? 'pin-mismatch' : expiresSoon ? 'pin-ok-cert-expiring' : 'secure';
  return {
    host: c.host || null,
    pinned: expected.length > 0,
    pinMatch,
    expiresInDays,
    expiresSoon,
    status,
  };
}

// 52001 — Mobile security: evaluate encrypted local storage configuration.
export function evaluateStorageEncryption(config) {
  const c = config || {};
  const encrypted = c.encrypted === true;
  return {
    encrypted,
    algorithm: encrypted ? String(c.algorithm || 'AES-256-GCM') : null,
    atRest: encrypted,
    keyStore: encrypted ? String(c.keyStore || 'platform-keystore') : null,
    status: encrypted ? 'encrypted' : 'plaintext',
  };
}

// 52002 — Mobile update channel: build the channel list with opt-in state.
const UPDATE_CHANNELS = [
  { id: 'stable', label: 'Stable', description: 'Production releases' },
  { id: 'beta', label: 'Beta', description: 'Early mobile features, opt-in' },
  { id: 'nightly', label: 'Nightly', description: 'Experimental builds, opt-in' },
];
export function buildUpdateChannels(optIns) {
  const opted = Array.isArray(optIns) ? optIns : [];
  return UPDATE_CHANNELS.map(c => ({
    ...c,
    optedIn: c.id === 'stable' ? true : opted.includes(c.id),
    optInRequired: c.id !== 'stable',
  }));
}

// 52002 — Mobile update channel: opt in or out of a beta channel (stable is mandatory).
export function setChannelOptIn(optIns, channelId, optIn) {
  const known = UPDATE_CHANNELS.some(c => c.id === channelId);
  const current = Array.isArray(optIns) ? optIns.slice() : [];
  if (!known || channelId === 'stable') return { optIns: current, applied: false };
  const set = new Set(current);
  if (optIn) set.add(channelId);
  else set.delete(channelId);
  return { optIns: [...set], applied: true };
}

// 52003 — Mobile usage analytics: privacy-safe aggregation (no identifiers retained).
export function aggregateUsageAnalytics(events) {
  const list = (Array.isArray(events) ? events : []).map(e => e || {});
  const sessions = new Set(list.map(e => e.sessionId).filter(Boolean)).size;
  const screenViews = {};
  const featureUses = {};
  let totalDurationMs = 0;
  for (const e of list) {
    if (e.type === 'screen_view' && e.screen)
      screenViews[e.screen] = (screenViews[e.screen] || 0) + 1;
    if (e.type === 'feature_use' && e.feature)
      featureUses[e.feature] = (featureUses[e.feature] || 0) + 1;
    if (e.type === 'session_end' && Number.isFinite(Number(e.durationMs)))
      totalDurationMs += Number(e.durationMs);
  }
  return {
    events: list.length,
    sessions,
    screenViews,
    featureUses,
    avgSessionMinutes: sessions ? Math.round((totalDurationMs / sessions / 60000) * 10) / 10 : 0,
    privacySafe: true,
    identifiersRetained: false,
  };
}

// 52004 — Mobile end-of-hunt summary: a clean wrap-up card when a hunt completes.
const SEV_ORDER = ['critical', 'high', 'medium', 'low', 'info'];
function sevRank(sev) {
  const i = SEV_ORDER.indexOf(String(sev || 'info').toLowerCase());
  return i === -1 ? SEV_ORDER.length : i;
}
export function buildEndOfHuntSummary(hunt, now = Date.now()) {
  const h = hunt || {};
  const findings = Array.isArray(h.findings) ? h.findings : [];
  const bySeverity = findings.reduce((acc, f) => {
    const k = String((f && f.severity) || 'info').toLowerCase();
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  const startedAt = Number(h.startedAt || now);
  const durationMinutes = Math.max(0, Math.round((now - startedAt) / 60000));
  const topFindings = findings
    .filter(f => f)
    .sort((a, b) => sevRank(a.severity) - sevRank(b.severity))
    .slice(0, 3)
    .map(f => ({
      id: f.id || null,
      title: String(f.title || 'Untitled'),
      severity: String(f.severity || 'info'),
    }));
  const reviewed = Number(h.reviewed || 0);
  return {
    huntId: h.huntId || null,
    target: String(h.target || 'unknown target'),
    status: String(h.status || 'completed'),
    durationMinutes,
    totals: { findings: findings.length, bySeverity, targets: Number(h.targets || 0) },
    topFindings,
    reviewed,
    reviewProgress: findings.length ? Math.round((reviewed / findings.length) * 100) : 100,
    wrapUp: true,
  };
}
