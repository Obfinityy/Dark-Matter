/**
 * mobileCore.js — Infinity AI · Dark-Matter · Wave 49
 * Pure logic (no React, no DOM, no network) backing the Mobile Suite:
 * idea-bank ideas 51951–51960. Every exported function is pure and deterministic.
 */

export const WAVE49_MOBILE_IDEAS = [
  { id: 51951, title: 'Mobile hunt dashboard' },
  { id: 51952, title: 'Mobile live findings' },
  { id: 51953, title: 'Mobile push alerts' },
  { id: 51954, title: 'Mobile approval cards' },
  { id: 51955, title: 'Mobile pause button' },
  { id: 51956, title: 'Mobile status view' },
  { id: 51957, title: 'Mobile ETA widget' },
  { id: 51958, title: 'Mobile chat' },
  { id: 51959, title: 'Mobile voice control' },
  { id: 51960, title: 'Mobile log viewer' },
];

// 51951 — Mobile hunt dashboard: all running hunts glanceable from the phone.
export function buildDashboardPayload(hunts) {
  const list = (Array.isArray(hunts) ? hunts : []).map(h => ({
    id: h.id,
    name: String(h.name || 'Unnamed hunt'),
    status: h.status || 'unknown',
    findings: Number(h.findingsCount || 0),
    severityMax: h.severityMax || 'none',
    etaMinutes: h.etaMinutes == null ? null : Number(h.etaMinutes),
  }));
  const active = list.filter(h => h.status === 'running' || h.status === 'paused');
  return {
    hunts: list,
    activeCount: active.length,
    totalFindings: list.reduce((n, h) => n + h.findings, 0),
  };
}

// 51952 — Mobile live findings: findings stream batched for small screens.
export function batchFindingsStream(findings, batchSize = 5) {
  const list = Array.isArray(findings) ? findings : [];
  const batches = [];
  for (let i = 0; i < list.length; i += batchSize) {
    batches.push({ batch: Math.floor(i / batchSize) + 1, items: list.slice(i, i + batchSize) });
  }
  return { batches, total: list.length, batchSize };
}

// 51953 — Mobile push alerts: severity-tuned push notification rules.
const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
export function evaluatePushAlert(finding, prefs) {
  const p = prefs || {};
  const threshold = SEVERITY_RANK[String(p.minSeverity || 'medium').toLowerCase()] ?? 2;
  const rank = SEVERITY_RANK[String((finding && finding.severity) || 'info').toLowerCase()] ?? 0;
  const send = rank >= threshold && !p.quietHours;
  return {
    send,
    title: send ? `Dark-Matter: ${(finding.severity || 'info').toUpperCase()} finding` : null,
    body: send ? String(finding.title || 'New finding') : null,
    reason: p.quietHours
      ? 'quiet hours'
      : rank < threshold
        ? 'below severity threshold'
        : 'alert sent',
  };
}

// 51954 — Mobile approval cards: approve/deny sensitive actions from the phone.
export function buildApprovalCard(request) {
  const r = request || {};
  return {
    id: r.id || null,
    title: String(r.title || 'Approval request'),
    detail: String(r.detail || ''),
    risk: r.risk || 'unknown',
    requestedBy: r.requestedBy || 'Infinity AI',
    actions: [
      { label: 'Approve', value: 'approve' },
      { label: 'Deny', value: 'deny' },
      { label: 'Decide later', value: 'defer' },
    ],
  };
}

// 51955 — Mobile pause button: big thumb-friendly pause/resume descriptor.
export function describePauseButton(huntStatus) {
  const paused = huntStatus === 'paused';
  return {
    label: paused ? 'Resume' : 'Pause',
    target: paused ? 'running' : 'paused',
    minTouchPx: 64,
    confirm: false,
  };
}

// 51956 — Mobile status view: "what's it doing now?" in one sentence.
export function summarizeMobileStatus(hunt) {
  const h = hunt || {};
  const phase = h.phase || h.status || 'idle';
  return `${h.name || 'Hunt'} is ${phase}${h.currentTask ? ` — currently ${h.currentTask}` : ''}${h.findingsCount ? `, ${h.findingsCount} findings so far` : ''}.`;
}

// 51957 — Mobile ETA widget: home-screen countdown calculation.
export function computeEtaCountdown(etaTimestampMs, nowMs) {
  const now = Number(nowMs);
  const eta = Number(etaTimestampMs);
  if (!Number.isFinite(eta) || !Number.isFinite(now))
    return { text: 'ETA —', overdue: false, msLeft: null };
  const left = eta - now;
  if (left <= 0) return { text: 'Finishing now', overdue: true, msLeft: 0 };
  const mins = Math.floor(left / 60000);
  const secs = Math.floor((left % 60000) / 1000);
  const text =
    mins >= 60
      ? `${Math.floor(mins / 60)}h ${mins % 60}m left`
      : mins > 0
        ? `${mins}m ${secs}s left`
        : `${secs}s left`;
  return { text, overdue: false, msLeft: left };
}

// 51958 — Mobile chat: normalize a chat message for the hunting agent.
export function normalizeChatMessage(text) {
  const raw = String(text || '');
  const trimmed = raw.trim().slice(0, 500);
  return {
    text: trimmed,
    empty: trimmed.length === 0,
    isCommand: trimmed.startsWith('/'),
    command: trimmed.startsWith('/') ? trimmed.slice(1).split(/\s+/)[0] : null,
  };
}

// 51959 — Mobile voice control: map a mobile voice transcript to a hunt action.
const MOBILE_VOICE_ACTIONS = {
  pause: 'pause-hunt',
  resume: 'resume-hunt',
  status: 'read-status',
  snapshot: 'take-snapshot',
  stop: 'stop-hunt',
  findings: 'read-findings',
};
export function mapMobileVoiceCommand(transcript) {
  const text = String(transcript || '').toLowerCase();
  const key = Object.keys(MOBILE_VOICE_ACTIONS).find(k => text.includes(k));
  return key
    ? { recognized: true, action: MOBILE_VOICE_ACTIONS[key], transcript: String(transcript || '') }
    : { recognized: false, action: null, transcript: String(transcript || '') };
}

// 51960 — Mobile log viewer: condensed logs readable on small screens.
export function condenseLogs(logs, maxLines = 20) {
  const list = Array.isArray(logs) ? logs : [];
  const condensed = list.slice(-maxLines).map(e => {
    const msg = String(e && e.message ? e.message : e);
    return msg.length > 80 ? msg.slice(0, 77) + '...' : msg;
  });
  return {
    lines: condensed,
    shown: condensed.length,
    total: list.length,
    truncated: list.length > maxLines,
  };
}
