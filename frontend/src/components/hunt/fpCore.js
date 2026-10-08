/**
 * fpCore.js — Infinity AI · Dark-Matter · Wave 52
 * Pure logic (no React, no DOM, no network) backing false-positive management:
 * idea-bank ideas 52064–52080. Every exported function is pure and deterministic;
 * time is injected via `now` parameters (defaults to Date.now()).
 */

export const WAVE52_FP_IDEAS = [
  { id: 52064, title: 'Structured FP reason picker' },
  { id: 52065, title: 'Free-text FP justification requirement' },
  { id: 52066, title: 'Evidence-linked FP marking' },
  { id: 52067, title: 'FP confidence score' },
  { id: 52068, title: '"Marked by / when" attribution' },
  { id: 52069, title: 'FP feedback loop to learning engine' },
  { id: 52070, title: 'Auto-suggested FP reason' },
  { id: 52071, title: 'FP rate per vulnerability class' },
  { id: 52072, title: 'FP rate per target' },
  { id: 52073, title: 'FP leaderboard per detection engine' },
  { id: 52074, title: 'One-click FP unmark' },
  { id: 52075, title: 'Two-reviewer FP approval' },
  { id: 52076, title: 'Bulk FP marking with shared reason' },
  { id: 52077, title: 'FP reason templates' },
  { id: 52078, title: '"Teach the agent" button' },
  { id: 52079, title: 'FP analytics dashboard' },
  { id: 52080, title: 'FP quarantine vs delete' },
];

// 52064 — Structured FP reason picker: dismissals need a taxonomy reason.
export const FP_REASONS = [
  { id: 'not-reproducible', label: 'Not reproducible' },
  { id: 'out-of-scope', label: 'Out of scope' },
  { id: 'expected-behavior', label: 'Expected behavior' },
  { id: 'test-artifact', label: 'Test artifact' },
  { id: 'duplicate-known', label: 'Duplicate of known issue' },
];
export function pickFpReason(reasonId, notes) {
  const reason = FP_REASONS.find(r => r.id === reasonId);
  if (!reason) return { ok: false, reason: `unknown FP reason "${reasonId}"` };
  return { ok: true, reasonId: reason.id, label: reason.label, notes: String(notes || '') };
}

// 52065 — Free-text FP justification requirement for high-severity dismissals.
export function validateJustification(text, minWords = 8) {
  const words = String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const ok = words.length >= minWords;
  return {
    ok,
    words: words.length,
    required: minWords,
    reason: ok ? null : `write at least ${minWords} words of justification`,
  };
}

// 52066 — Evidence-linked FP marking: attach the proving snippet.
export function linkEvidence(fpMarking, evidenceSnippet) {
  const m = fpMarking || {};
  const s = evidenceSnippet || {};
  if (!s.content) return { ...m, ok: false, reason: 'evidence snippet has no content' };
  return {
    ...m,
    ok: true,
    evidenceLink: {
      label: String(s.label || 'FP proof'),
      content: String(s.content),
      capturedAt: s.capturedAt != null ? Number(s.capturedAt) : null,
    },
  };
}

// 52067 — FP confidence score: how likely a finding is a false positive.
export function fpConfidenceScore(finding) {
  const f = finding || {};
  const noEvidence = !(Array.isArray(f.evidence) && f.evidence.length > 0);
  const wafBlocked = /waf|blocked|forbidden|cloudflare/i.test(
    String(f.responseBody || '') + String(f.title || '')
  );
  const testArtifact = /staging|fixture|test|example/i.test(
    String(f.asset || '') + String(f.endpoint || '')
  );
  const lowSeverity = ['info', 'low'].includes(String(f.severity || '').toLowerCase());
  let score = 0.05;
  if (noEvidence) score += 0.25;
  if (wafBlocked) score += 0.35;
  if (testArtifact) score += 0.25;
  if (lowSeverity) score += 0.1;
  return Math.min(0.99, Math.round(score * 100) / 100);
}

// 52068 — "Marked by / when" attribution.
export function attributeFpMarking({ by, at } = {}) {
  if (!by) return { ok: false, reason: 'reviewer identity required' };
  const stamp = at != null ? Number(at) : Date.now();
  return { ok: true, markedBy: String(by), markedAt: stamp, contact: `reviewer:${String(by)}` };
}

// 52069 — FP feedback loop: confirmed FPs become labeled training data.
export function buildTrainingSample(fpMarking) {
  const m = fpMarking || {};
  if (!m.reasonId) return { ok: false, reason: 'confirmed FP reason required for training data' };
  return {
    ok: true,
    label: 'false-positive',
    reasonId: m.reasonId,
    findingId: m.findingId || null,
    vulnClass: m.vulnClass || 'unknown',
    engine: m.engine || 'unknown',
    evidenceDigest: String(m.evidenceSummary || ''),
    notes: String(m.notes || ''),
  };
}

// 52070 — Auto-suggested FP reason from past dismissal patterns.
export function suggestFpReason(finding, history) {
  const f = finding || {};
  const past = (Array.isArray(history) ? history : []).filter(h => h.vulnClass === f.vulnClass);
  const votes = new Map();
  for (const h of past) votes.set(h.reasonId, (votes.get(h.reasonId) || 0) + 1);
  const top = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!top) return { suggestion: null, reason: 'no past dismissals for this vuln class' };
  const reason = FP_REASONS.find(r => r.id === top[0]);
  return {
    suggestion: reason ? reason.id : null,
    label: reason ? reason.label : null,
    votes: top[1],
  };
}

// 52071 — FP rate per vulnerability class.
export function fpRateByClass(markings) {
  const stats = {};
  for (const m of Array.isArray(markings) ? markings : []) {
    const cls = m.vulnClass || 'unknown';
    if (!stats[cls]) stats[cls] = { total: 0, fps: 0 };
    stats[cls].total += 1;
    if (m.isFalsePositive) stats[cls].fps += 1;
  }
  return Object.entries(stats)
    .map(([vulnClass, s]) => ({
      vulnClass,
      total: s.total,
      fps: s.fps,
      rate: s.total ? Math.round((s.fps / s.total) * 1000) / 1000 : 0,
    }))
    .sort((a, b) => b.rate - a.rate);
}

// 52072 — FP rate per target.
export function fpRateByTarget(markings) {
  const stats = {};
  for (const m of Array.isArray(markings) ? markings : []) {
    const t = m.target || 'unknown';
    if (!stats[t]) stats[t] = { total: 0, fps: 0 };
    stats[t].total += 1;
    if (m.isFalsePositive) stats[t].fps += 1;
  }
  return Object.entries(stats)
    .map(([target, s]) => ({
      target,
      total: s.total,
      fps: s.fps,
      rate: s.total ? Math.round((s.fps / s.total) * 1000) / 1000 : 0,
    }))
    .sort((a, b) => b.rate - a.rate);
}

// 52073 — FP leaderboard per detection engine.
export function engineFpLeaderboard(markings) {
  const stats = {};
  for (const m of Array.isArray(markings) ? markings : []) {
    const e = m.engine || 'unknown';
    if (!stats[e]) stats[e] = { total: 0, fps: 0 };
    stats[e].total += 1;
    if (m.isFalsePositive) stats[e].fps += 1;
  }
  const rows = Object.entries(stats).map(([engine, s]) => ({
    engine,
    total: s.total,
    fps: s.fps,
    fpRate: s.total ? Math.round((s.fps / s.total) * 1000) / 1000 : 0,
  }));
  rows.sort((a, b) => a.fpRate - b.fpRate); // cleanest pipeline first
  return rows;
}

// 52074 — One-click FP unmark: restore prior state, log the reversal.
export function unmarkFp(finding, now = Date.now()) {
  const f = finding || {};
  if (!f.fpMarked) return { ok: false, reason: 'finding is not FP-marked' };
  const restored = {
    ...f,
    fpMarked: false,
    status: f.priorStatus || 'open',
    fpReason: null,
  };
  const log = {
    findingId: f.id,
    action: 'fp-unmark',
    by: f.fpUnmarkedBy || 'reviewer',
    at: Number(now),
    restoredStatus: restored.status,
  };
  return { ok: true, finding: restored, reversalLog: log };
}

// 52075 — Two-reviewer FP approval for Critical/High dismissals.
const HIGH_SEV = ['critical', 'high'];
export function requestFpApproval(finding, requester, now = Date.now()) {
  const f = finding || {};
  const needsSecond = HIGH_SEV.includes(String(f.severity || '').toLowerCase());
  const pending = {
    findingId: f.id,
    requester: String(requester || 'unknown'),
    requestedAt: Number(now),
    needsSecond,
    status: needsSecond ? 'awaiting-second-reviewer' : 'auto-approved',
  };
  return pending;
}
export function approveFpApproval(pending, approver, approve, now = Date.now()) {
  const p = pending || {};
  if (!p.needsSecond)
    return { ok: true, final: 'applied', approvals: p.requester ? [p.requester] : [] };
  if (approver === p.requester)
    return { ok: false, reason: 'requester cannot approve their own FP dismissal' };
  return {
    ok: approve,
    final: approve ? 'applied' : 'rejected',
    approvals: approve ? [p.requester, approver] : [p.requester],
    decidedAt: Number(now),
  };
}

// 52076 — Bulk FP marking with shared reason.
export function bulkMarkFp(findings, reasonId, by, now = Date.now()) {
  const picked = pickFpReason(reasonId);
  if (!picked.ok) return { ok: false, reason: picked.reason };
  const at = Number(now);
  const marked = (Array.isArray(findings) ? findings : []).map(f => ({
    ...f,
    fpMarked: true,
    fpReason: picked.reasonId,
    priorStatus: f.status || 'open',
    status: 'dismissed-fp',
    markedBy: String(by || 'unknown'),
    markedAt: at,
  }));
  return {
    ok: true,
    count: marked.length,
    reasonId: picked.reasonId,
    label: picked.label,
    findings: marked,
  };
}

// 52077 — FP reason templates: saved justification snippets.
export function getFpTemplate(id, templates) {
  const t = (Array.isArray(templates) ? templates : []).find(x => x.id === id);
  if (!t) return { ok: false, reason: `no FP template "${id}"` };
  return { ok: true, id: t.id, text: String(t.text || '') };
}
export function saveFpTemplate(templates, text, by) {
  const list = Array.isArray(templates) ? templates : [];
  const id = `fpt-${list.length + 1}`;
  return {
    templates: [...list, { id, text: String(text || ''), by: String(by || 'unknown') }],
    id,
  };
}
export const FP_TEMPLATE_SAMPLES = [
  { id: 'fpt-waf', text: 'WAF blocks this payload class — verified via manual replay' },
  { id: 'fpt-scope', text: 'Asset is outside the agreed hunt scope per engagement brief' },
  { id: 'fpt-test', text: 'Triggered by the staging test fixture, not production behavior' },
];

// 52078 — "Teach the agent" button: 30-second explanation recording.
export function recordTeachingNote(fpMarking, transcript, durationSeconds) {
  const m = fpMarking || {};
  const dur = Number(durationSeconds || 0);
  if (dur <= 0 || dur > 30) return { ok: false, reason: 'teaching notes are capped at 30 seconds' };
  const text = String(transcript || '').trim();
  if (!text) return { ok: false, reason: 'transcript is empty' };
  return {
    ok: true,
    teachingNote: {
      findingId: m.findingId || null,
      reasonId: m.reasonId || null,
      transcript: text,
      durationSeconds: dur,
    },
  };
}

// 52079 — FP analytics dashboard.
export function fpAnalytics(markings, now = Date.now()) {
  const list = Array.isArray(markings) ? markings : [];
  const fps = list.filter(m => m.isFalsePositive);
  const reasonCounts = {};
  const reporterCounts = {};
  let dismissMsTotal = 0;
  let dismissMsCount = 0;
  for (const m of fps) {
    reasonCounts[m.reasonId || 'unknown'] = (reasonCounts[m.reasonId || 'unknown'] || 0) + 1;
    reporterCounts[m.markedBy || 'unknown'] = (reporterCounts[m.markedBy || 'unknown'] || 0) + 1;
    if (m.markedAt != null && m.foundAt != null) {
      dismissMsTotal += Number(m.markedAt) - Number(m.foundAt);
      dismissMsCount += 1;
    }
  }
  const top = counts =>
    Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({ key, count }));
  return {
    totalMarked: fps.length,
    fpRateOverall: list.length ? Math.round((fps.length / list.length) * 1000) / 1000 : 0,
    topReasons: top(reasonCounts).slice(0, 5),
    topReporters: top(reporterCounts).slice(0, 5),
    avgTimeToDismissMs: dismissMsCount ? Math.round(dismissMsTotal / dismissMsCount) : null,
    computedAt: Number(now),
  };
}

// 52080 — FP quarantine vs delete: dismissed FPs are recoverable.
export function quarantineFp(finding, now = Date.now()) {
  const f = finding || {};
  if (!f.fpMarked) return { ok: false, reason: 'mark as FP before quarantine' };
  return {
    ok: true,
    quarantined: { ...f, quarantined: true, excludedFromReports: true, quarantinedAt: Number(now) },
  };
}
export function restoreFromQuarantine(quarantinedFinding, now = Date.now()) {
  const f = quarantinedFinding || {};
  if (!f.quarantined) return { ok: false, reason: 'finding is not in quarantine' };
  return {
    ok: true,
    finding: {
      ...f,
      quarantined: false,
      excludedFromReports: false,
      fpMarked: false,
      status: f.priorStatus || 'open',
      restoredAt: Number(now),
    },
  };
}
