/**
 * sessionCore.js — wave 27 (ideas 51041–51080): chat session persistence +
 * live hunt-status transparency suite pure logic.
 *
 * Ideas 51041–51060 (session layer): persistent chat sessions, read receipts,
 * agent memory notes, cross-hunt comparison, emergency stop phrase, pacing
 * awareness, handoff brief generator, saved question templates, reply-length
 * slider, URL unfurling, command history recall, working-notes channel, chat
 * triage commands, scheduled chat check-ins, answer escalation,
 * technical/plain toggle, evidence footnotes, sub-agent chat tabs, immutable
 * chat audit log, long-hunt personality.
 *
 * Ideas 51061–51080 (status layer): instant status command, plain-language
 * narration, phase breadcrumb trail, active-tool indicator, in-phase progress
 * bar, sub-step checklist, time-in-phase readout, last-action timestamp,
 * next-action preview, status in your language, visual status card, status
 * history timeline, scheduled status digests, ask-about-this-action,
 * self-reported blockers, waiting-on-you flag, plan-vs-reality view,
 * shareable status link, spoken status readout, dashboard status widget.
 *
 * Pure functions only — no DOM/window/timer side effects — unit-testable
 * with node:test. Deterministic (no Math.random, no Date.now inside).
 */

export const WAVE27_START = 51041;
export const WAVE27_END = 51080;

/** Registry of all 40 ideas in this wave — completeness is testable. */
export const WAVE27_IDEAS = [
  [51041, 'persistent chat sessions', 'Reopening a hunt restores the full conversation exactly where it left off'],
  [51042, 'read receipts', 'See which agent messages you have opened and which proactive alerts remain unread'],
  [51043, 'agent memory notes', 'Say "remember this for later" and the agent stores a pinned note for the rest of the hunt'],
  [51044, 'cross-hunt comparison', 'Ask how current progress compares with a previous hunt of the same target'],
  [51045, 'emergency stop phrase', 'A configurable phrase that pauses the hunt instantly when typed or spoken'],
  [51046, 'pacing awareness', 'The agent reduces proactive messages when your replies suggest you are busy'],
  [51047, 'handoff brief generator', 'Generate a chat-based handoff summary when passing the hunt to a teammate'],
  [51048, 'saved question templates', 'Reusable prompts like "any new criticals?" or "recon coverage so far?"'],
  [51049, 'reply-length slider', 'A terse/balanced/detailed control applied to all future answers'],
  [51050, 'URL unfurling', 'Pasting a link shows inline target context: resolved host and in-scope status'],
  [51051, 'command history recall', 'Up-arrow cycles through your previous chat commands and steering instructions'],
  [51052, 'working-notes channel', 'A separate read-only stream where the agent posts raw reasoning as it works'],
  [51053, 'chat triage commands', 'Reply "mark as false positive" under a finding alert to update its state instantly'],
  [51054, 'scheduled chat check-ins', 'The agent posts a status digest in chat every N minutes, configurable per hunt'],
  [51055, 'answer escalation', 'Flag an agent reply for human expert review with one click and track the outcome'],
  [51056, 'technical/plain toggle', 'Switch the whole session between technical and plain-language answers'],
  [51057, 'evidence footnotes', 'Every finding claim in chat carries its evidence link as a footnote'],
  [51058, 'sub-agent chat tabs', 'When sub-agents run, chat splits into per-agent tabs plus a coordinator thread'],
  [51059, 'immutable chat audit log', 'A tamper-evident record of all chat instructions, exportable for compliance'],
  [51060, 'long-hunt personality', 'Optional light tone in status replies to keep overnight hunts pleasant'],
  [51061, 'instant status command', 'Ask "what are you doing right now?" and get a one-line answer in under a second'],
  [51062, 'plain-language narration', 'The agent describes its current action as a sentence, not a tool name or log dump'],
  [51063, 'phase breadcrumb trail', 'A clickable path showing exactly where the current action sits in the hunt plan'],
  [51064, 'active-tool indicator', 'A live badge naming the tool or module currently executing'],
  [51065, 'in-phase progress bar', 'Percentage completion of the current phase with remaining sub-steps listed'],
  [51066, 'sub-step checklist', 'The current phase broken into checkable steps that tick off as they finish'],
  [51067, 'time-in-phase readout', 'How long the agent has spent in the current phase versus the planned budget'],
  [51068, 'last-action timestamp', 'When the most recent action completed, so silence is distinguishable from stalling'],
  [51069, 'next-action preview', 'What the agent plans to do immediately after the current step'],
  [51070, 'status in your language', 'Status answers always match the language you chatted in, switchable anytime'],
  [51071, 'visual status card', 'A glanceable card with phase, action, progress, and ETA in one place'],
  [51072, 'status history timeline', 'Scroll back through every status the agent reported during the hunt'],
  [51073, 'scheduled status digests', 'Automatic plain-language updates posted at intervals you choose'],
  [51074, 'ask-about-this-action', 'Tap any running action to ask the agent why it is doing it and what it expects'],
  [51075, 'self-reported blockers', 'The agent proactively says what it is stuck on instead of spinning silently'],
  [51076, 'waiting-on-you flag', 'A distinct state when the agent is paused awaiting your approval or input'],
  [51077, 'plan-vs-reality view', 'Current activity shown against the original plan with deviations highlighted'],
  [51078, 'shareable status link', 'A read-only link showing live hunt status to a stakeholder without chat access'],
  [51079, 'spoken status readout', 'Hear the current status read aloud through the avatar or voice mode'],
  [51080, 'dashboard status widget', 'A mini live-status card embeddable on your hunts dashboard'],
];

/* ------------------------------------------------------------------ */
/* 51041 — persistent chat sessions                                    */
/* ------------------------------------------------------------------ */

/**
 * Serialize the restorable parts of a chat session. Pure: caller supplies
 * the clock value so output is deterministic.
 */
export function serializeSession({ messages, scrollTop = 0, savedAtMs = 0, huntId = '' }) {
  return {
    version: 1,
    huntId,
    savedAtMs,
    scrollTop,
    messages: (messages || []).map((m) => ({
      id: m.id, role: m.role, text: m.text, ts: m.ts,
    })),
  };
}

/** Restore a session snapshot; returns null when the snapshot is invalid. */
export function restoreSession(snapshot) {
  if (!snapshot || snapshot.version !== 1 || !Array.isArray(snapshot.messages)) return null;
  return {
    huntId: snapshot.huntId || '',
    scrollTop: Number(snapshot.scrollTop) || 0,
    messages: snapshot.messages.filter((m) => m && typeof m.text === 'string'),
    restored: true,
  };
}

/* ------------------------------------------------------------------ */
/* 51042 — read receipts                                               */
/* ------------------------------------------------------------------ */

export function markRead(readIds, messageId) {
  const set = new Set(readIds || []);
  set.add(messageId);
  return [...set];
}

export function unreadAlerts(messages, readIds) {
  const read = new Set(readIds || []);
  return (messages || []).filter((m) => m && m.alert === true && !read.has(m.id));
}

/* ------------------------------------------------------------------ */
/* 51043 — agent memory notes                                          */
/* ------------------------------------------------------------------ */

export function pinMemoryNote(notes, text, ts = 0) {
  const clean = String(text || '').trim();
  if (!clean) return notes || [];
  return [...(notes || []), { id: `note-${(notes || []).length + 1}`, text: clean, ts, pinned: true }];
}

export function unpinMemoryNote(notes, noteId) {
  return (notes || []).filter((n) => n.id !== noteId);
}

/* ------------------------------------------------------------------ */
/* 51044 — cross-hunt comparison                                      */
/* ------------------------------------------------------------------ */

export function compareHunts(current, previous) {
  const c = current || {}; const p = previous || {};
  const pick = (h) => ({
    findings: Number(h.findings) || 0,
    criticals: Number(h.criticals) || 0,
    coverage: Number(h.coverage) || 0,
    durationMin: Number(h.durationMin) || 0,
  });
  const a = pick(c); const b = pick(p);
  return {
    findingsDelta: a.findings - b.findings,
    criticalsDelta: a.criticals - b.criticals,
    coverageDelta: a.coverage - b.coverage,
    durationDeltaMin: a.durationMin - b.durationMin,
    summary: `Current hunt: ${a.findings} findings (${a.criticals} critical), ${a.coverage}% coverage in ${a.durationMin}m — vs previous ${b.findings} findings (${b.criticals} critical), ${b.coverage}% coverage in ${b.durationMin}m.`,
  };
}

/* ------------------------------------------------------------------ */
/* 51045 — emergency stop phrase                                       */
/* ------------------------------------------------------------------ */

export const STOP_PHRASE_DEFAULT = 'stop the hunt';

export function detectStopPhrase(text, phrase = STOP_PHRASE_DEFAULT) {
  const t = String(text || '').toLowerCase();
  const p = String(phrase || '').toLowerCase().trim();
  if (!p) return false;
  return t.includes(p);
}

/* ------------------------------------------------------------------ */
/* 51046 — pacing awareness                                            */
/* ------------------------------------------------------------------ */

export const PACING_NORMAL = 'normal';
export const PACING_REDUCED = 'reduced';
export const PACING_QUIET = 'quiet';

export function pacingLevel(recentReplies) {
  const replies = recentReplies || [];
  if (replies.length === 0) return PACING_NORMAL;
  const shortCount = replies.filter((r) => String(r || '').trim().length < 12).length;
  const ratio = shortCount / replies.length;
  if (ratio >= 0.8 && replies.length >= 3) return PACING_QUIET;
  if (ratio >= 0.5) return PACING_REDUCED;
  return PACING_NORMAL;
}

export function shouldReduceProactivity(level) {
  return level === PACING_REDUCED || level === PACING_QUIET;
}

/* ------------------------------------------------------------------ */
/* 51047 — handoff brief generator                                     */
/* ------------------------------------------------------------------ */

export function handoffBrief({ huntId, phase, findings, openBlockers, memoryNotes, nextSteps }) {
  const lines = [
    `# Handoff brief — hunt ${huntId || 'unknown'}`,
    '',
    `**Phase:** ${phase || 'unknown'}`,
    `**Findings so far:** ${Number(findings) || 0}`,
    '',
    '## Open blockers',
    ...((openBlockers || []).map((b) => `- ${b}`)),
    '',
    '## Memory notes',
    ...((memoryNotes || []).map((n) => `- ${typeof n === 'string' ? n : n.text}`)),
    '',
    '## Suggested next steps',
    ...((nextSteps || []).map((s) => `- ${s}`)),
  ];
  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/* 51048 — saved question templates                                    */
/* ------------------------------------------------------------------ */

export const QUESTION_TEMPLATES = [
  { id: 'qt-criticals', label: 'Any new criticals?', prompt: 'Any new critical findings since the last check-in?' },
  { id: 'qt-coverage', label: 'Recon coverage so far?', prompt: 'What is the recon coverage so far, and what is still missing?' },
  { id: 'qt-blockers', label: 'Blocked anywhere?', prompt: 'Are you blocked anywhere? What do you need from me?' },
  { id: 'qt-eta', label: 'ETA to done?', prompt: 'What is your estimated time to finish the current phase?' },
  { id: 'qt-summary', label: 'Summarize the hunt', prompt: 'Summarize this hunt so far in plain language.' },
];

export function applyTemplate(templateId) {
  const t = QUESTION_TEMPLATES.find((x) => x.id === templateId);
  return t ? t.prompt : '';
}

/* ------------------------------------------------------------------ */
/* 51049 — reply-length slider                                         */
/* ------------------------------------------------------------------ */

export const REPLY_TERSE = 'terse';
export const REPLY_BALANCED = 'balanced';
export const REPLY_DETAILED = 'detailed';
export const REPLY_LENGTHS = [REPLY_TERSE, REPLY_BALANCED, REPLY_DETAILED];

export function applyReplyLength(text, mode = REPLY_BALANCED) {
  const sentences = String(text || '').split(/(?<=[.!?])\s+/).filter(Boolean);
  if (mode === REPLY_TERSE) return sentences.slice(0, 1).join(' ');
  if (mode === REPLY_DETAILED) return sentences.join(' ');
  return sentences.slice(0, 2).join(' ');
}

/* ------------------------------------------------------------------ */
/* 51050 — URL unfurling                                               */
/* ------------------------------------------------------------------ */

export function unfurlUrl(rawUrl, scopeHosts = []) {
  const out = { raw: rawUrl, host: '', inScope: false, valid: false };
  try {
    const u = new URL(String(rawUrl));
    out.host = u.hostname.toLowerCase();
    out.valid = true;
    out.inScope = scopeHosts.map((h) => String(h).toLowerCase())
      .some((h) => out.host === h || out.host.endsWith(`.${h}`));
  } catch { /* invalid URL stays invalid */ }
  return out;
}

/* ------------------------------------------------------------------ */
/* 51051 — command history recall                                      */
/* ------------------------------------------------------------------ */

export function pushHistory(history, command, limit = 50) {
  const clean = String(command || '').trim();
  if (!clean) return history || [];
  const next = [...(history || []), clean];
  return next.slice(-limit);
}

/** index: 0 = most recent. Returns '' when out of range. */
export function recallHistory(history, index) {
  const h = history || [];
  const i = h.length - 1 - index;
  return i >= 0 ? h[i] : '';
}

/* ------------------------------------------------------------------ */
/* 51052 — working-notes channel                                       */
/* ------------------------------------------------------------------ */

export function appendWorkingNote(notes, text, ts = 0) {
  const clean = String(text || '').trim();
  if (!clean) return notes || [];
  return [...(notes || []), { id: `wn-${(notes || []).length + 1}`, text: clean, ts }];
}

/* ------------------------------------------------------------------ */
/* 51053 — chat triage commands                                        */
/* ------------------------------------------------------------------ */

export const TRIAGE_FALSE_POSITIVE = 'false-positive';
export const TRIAGE_CONFIRMED = 'confirmed';
export const TRIAGE_WONT_FIX = 'wont-fix';

export function parseTriageCommand(text) {
  const t = String(text || '').toLowerCase().trim();
  if (/mark as false positive|mark false positive/.test(t)) return TRIAGE_FALSE_POSITIVE;
  if (/mark as confirmed|mark confirmed/.test(t)) return TRIAGE_CONFIRMED;
  if (/mark as won.?t fix|mark wont fix/.test(t)) return TRIAGE_WONT_FIX;
  return null;
}

/* ------------------------------------------------------------------ */
/* 51054 — scheduled chat check-ins                                    */
/* ------------------------------------------------------------------ */

export const CHECKIN_INTERVALS_MIN = [5, 15, 30, 60];

export function nextCheckin(lastCheckinMs, intervalMin, nowMs) {
  const next = Number(lastCheckinMs) + Number(intervalMin) * 60000;
  return { due: Number(nowMs) >= next, nextAtMs: next };
}

/* ------------------------------------------------------------------ */
/* 51055 — answer escalation                                           */
/* ------------------------------------------------------------------ */

export const ESCALATION_OPEN = 'open';
export const ESCALATION_REVIEWED = 'reviewed';
export const ESCALATION_RESOLVED = 'resolved';

export function escalateAnswer(escalations, messageId, reason = '') {
  const list = escalations || [];
  if (list.some((e) => e.messageId === messageId && e.state !== ESCALATION_RESOLVED)) return list;
  return [...list, { messageId, reason: String(reason), state: ESCALATION_OPEN }];
}

export function resolveEscalation(escalations, messageId, outcome = '') {
  return (escalations || []).map((e) => (e.messageId === messageId
    ? { ...e, state: ESCALATION_RESOLVED, outcome: String(outcome) } : e));
}

/* ------------------------------------------------------------------ */
/* 51056 — technical/plain toggle                                      */
/* ------------------------------------------------------------------ */

export const TECH_MODE = 'technical';
export const PLAIN_MODE = 'plain';

export function toggleTechMode(mode) {
  return mode === TECH_MODE ? PLAIN_MODE : TECH_MODE;
}

/* ------------------------------------------------------------------ */
/* 51057 — evidence footnotes                                          */
/* ------------------------------------------------------------------ */

export function footnoteEvidence(claims) {
  const notes = [];
  const body = (claims || []).map((c, i) => {
    const n = i + 1;
    notes.push({ n, label: c.label || `evidence ${n}`, url: c.url || '' });
    return `${c.text || ''}[${n}]`;
  });
  return { body: body.join('\n'), footnotes: notes };
}

/* ------------------------------------------------------------------ */
/* 51058 — sub-agent chat tabs                                         */
/* ------------------------------------------------------------------ */

export const COORDINATOR_TAB = 'coordinator';

export function agentTabs(agentIds) {
  return [COORDINATOR_TAB, ...((agentIds || []).filter(Boolean))];
}

export function routeToAgentTab(message) {
  if (!message || !message.agentId) return COORDINATOR_TAB;
  return message.agentId;
}

/* ------------------------------------------------------------------ */
/* 51059 — immutable chat audit log (hash-chained, tamper-evident)     */
/* ------------------------------------------------------------------ */

/** Deterministic FNV-1a hash — no crypto dependency, testable. */
export function fnv1a(str) {
  let h = 0x811c9dc5;
  const s = String(str);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function auditLogAppend(log, { actor, action, ts = 0 }) {
  const prev = (log || []).length ? log[log.length - 1].hash : '00000000';
  const hash = fnv1a(`${prev}|${actor}|${action}|${ts}`);
  return [...(log || []), { seq: (log || []).length + 1, actor, action, ts, prev, hash }];
}

export function verifyAuditLog(log) {
  const entries = log || [];
  let prev = '00000000';
  for (const e of entries) {
    if (e.prev !== prev) return { ok: false, at: e.seq };
    const recomputed = fnv1a(`${e.prev}|${e.actor}|${e.action}|${e.ts}`);
    if (recomputed !== e.hash) return { ok: false, at: e.seq };
    prev = e.hash;
  }
  return { ok: true, entries: entries.length };
}

/* ------------------------------------------------------------------ */
/* 51060 — long-hunt personality                                       */
/* ------------------------------------------------------------------ */

export const HUNT_TONE_PROFESSIONAL = 'professional';
export const HUNT_TONE_LIGHT = 'light';
export const HUNT_TONES = [HUNT_TONE_PROFESSIONAL, HUNT_TONE_LIGHT];

export function withHuntTone(text, tone = HUNT_TONE_PROFESSIONAL) {
  if (tone === HUNT_TONE_LIGHT) return `${text} — hanging in there, the night shift is almost kind to us.`;
  return text;
}

/* ------------------------------------------------------------------ */
/* 51061 — instant status command                                      */
/* ------------------------------------------------------------------ */

export function instantStatus({ phase, action, progressPct = 0 }) {
  return `${phase || 'hunt'}: ${action || 'working'} (${Math.round(Number(progressPct) || 0)}%)`;
}

/* ------------------------------------------------------------------ */
/* 51062 — plain-language narration                                    */
/* ------------------------------------------------------------------ */

const NARRATION_MAP = [
  [/subdomain/i, 'I am mapping subdomains to widen the attack surface.'],
  [/port.?scan/i, 'I am checking which ports are open on the target.'],
  [/xss/i, 'I am testing input fields for cross-site scripting.'],
  [/sqli|sql injection/i, 'I am probing for SQL injection flaws.'],
  [/ssrf/i, 'I am testing whether the server can be tricked into internal requests.'],
  [/crawl/i, 'I am crawling the site to inventory pages and endpoints.'],
  [/fuzz/i, 'I am fuzzing parameters to find unexpected behavior.'],
  [/report/i, 'I am writing up the findings into the report.'],
];

export function narrateAction(action) {
  const a = String(action || '');
  for (const [re, sentence] of NARRATION_MAP) {
    if (re.test(a)) return sentence;
  }
  return `I am working on: ${a || 'the next hunt step'}.`;
}

/* ------------------------------------------------------------------ */
/* 51063 — phase breadcrumb trail                                       */
/* ------------------------------------------------------------------ */

export function phaseBreadcrumb(plan, currentPhaseId) {
  const phases = plan || [];
  const idx = phases.findIndex((p) => p.id === currentPhaseId);
  return phases.map((p, i) => ({
    id: p.id, label: p.label || p.id,
    state: i < idx ? 'done' : i === idx ? 'current' : 'upcoming',
  }));
}

/* ------------------------------------------------------------------ */
/* 51064 — active-tool indicator                                        */
/* ------------------------------------------------------------------ */

export function activeToolBadge(toolName) {
  const t = String(toolName || '').trim();
  return t ? { label: t, live: true } : { label: 'idle', live: false };
}

/* ------------------------------------------------------------------ */
/* 51065 — in-phase progress bar                                       */
/* ------------------------------------------------------------------ */

export function phaseProgress(doneSteps, totalSteps) {
  const total = Math.max(1, Number(totalSteps) || 0);
  const done = Math.max(0, Math.min(Number(doneSteps) || 0, total));
  return { pct: Math.round((done / total) * 100), done, total, remaining: total - done };
}

/* ------------------------------------------------------------------ */
/* 51066 — sub-step checklist                                          */
/* ------------------------------------------------------------------ */

export function subStepChecklist(steps) {
  return (steps || []).map((s, i) => ({
    id: s.id || `step-${i + 1}`, label: s.label || `Step ${i + 1}`, done: !!s.done,
  }));
}

export function tickSubStep(steps, stepId) {
  return (steps || []).map((s) => (s.id === stepId ? { ...s, done: true } : s));
}

/* ------------------------------------------------------------------ */
/* 51067 — time-in-phase readout                                       */
/* ------------------------------------------------------------------ */

export function timeInPhase(phaseStartMs, budgetMin, nowMs) {
  const elapsedMin = Math.max(0, (Number(nowMs) - Number(phaseStartMs)) / 60000);
  const budget = Math.max(1, Number(budgetMin) || 1);
  return {
    elapsedMin: Math.round(elapsedMin * 10) / 10,
    budgetMin: budget,
    overBudget: elapsedMin > budget,
    pctOfBudget: Math.round((elapsedMin / budget) * 100),
  };
}

/* ------------------------------------------------------------------ */
/* 51068 — last-action timestamp                                        */
/* ------------------------------------------------------------------ */

export function lastActionStamp(lastActionMs, nowMs, stallThresholdMs = 120000) {
  const ageMs = Math.max(0, Number(nowMs) - Number(lastActionMs));
  return {
    ageMs,
    stalled: ageMs > stallThresholdMs,
    label: ageMs < 60000 ? 'just now' : `${Math.round(ageMs / 60000)}m ago`,
  };
}

/* ------------------------------------------------------------------ */
/* 51069 — next-action preview                                          */
/* ------------------------------------------------------------------ */

export function nextActionPreview(queue) {
  const q = queue || [];
  return q.length ? { action: q[0], remaining: q.length - 1 } : { action: null, remaining: 0 };
}

/* ------------------------------------------------------------------ */
/* 51070 — status in your language                                      */
/* ------------------------------------------------------------------ */

export const STATUS_LANGS = ['en', 'hi', 'hinglish'];

export function statusInLanguage(status, lang = 'en') {
  const s = String(status || '');
  if (lang === 'hi') return `स्थिति: ${s}`;
  if (lang === 'hinglish') return `Status: ${s} — sab theek chal raha hai`;
  return `Status: ${s}`;
}

/* ------------------------------------------------------------------ */
/* 51071 — visual status card                                           */
/* ------------------------------------------------------------------ */

export function statusCard({ phase, action, progressPct = 0, etaMin = null }) {
  return {
    phase: phase || 'hunt',
    action: action || 'working',
    progressPct: Math.max(0, Math.min(100, Math.round(Number(progressPct) || 0))),
    eta: etaMin == null ? 'calculating…' : `${Math.round(etaMin)}m left`,
  };
}

/* ------------------------------------------------------------------ */
/* 51072 — status history timeline                                      */
/* ------------------------------------------------------------------ */

export function appendStatus(history, { text, ts = 0 }) {
  const clean = String(text || '').trim();
  if (!clean) return history || [];
  return [...(history || []), { id: `st-${(history || []).length + 1}`, text: clean, ts }];
}

/* ------------------------------------------------------------------ */
/* 51073 — scheduled status digests                                     */
/* ------------------------------------------------------------------ */

export function digestSchedule(lastDigestMs, intervalMin, nowMs) {
  const next = Number(lastDigestMs) + Number(intervalMin) * 60000;
  return { due: Number(nowMs) >= next, nextAtMs: next };
}

/* ------------------------------------------------------------------ */
/* 51074 — ask-about-this-action                                        */
/* ------------------------------------------------------------------ */

export function explainAction(action) {
  const a = String(action || '');
  return {
    action: a,
    why: narrateAction(a),
    expects: 'A clear pass/fail signal plus any findings worth your attention.',
  };
}

/* ------------------------------------------------------------------ */
/* 51075 — self-reported blockers                                       */
/* ------------------------------------------------------------------ */

export const BLOCKER_NONE = 'none';
export const BLOCKER_WAITING = 'waiting';
export const BLOCKER_STUCK = 'stuck';

export function reportBlocker(state, detail = '') {
  return { state, detail: String(detail), selfReported: state !== BLOCKER_NONE };
}

/* ------------------------------------------------------------------ */
/* 51076 — waiting-on-you flag                                          */
/* ------------------------------------------------------------------ */

export function waitingOnYou(reason = '') {
  const r = String(reason).trim();
  return { waiting: !!r, reason: r || 'No input needed right now.' };
}

/* ------------------------------------------------------------------ */
/* 51077 — plan-vs-reality view                                         */
/* ------------------------------------------------------------------ */

export function planVsReality(plan, actual) {
  const p = plan || []; const a = actual || [];
  return p.map((step, i) => {
    const done = a[i];
    const deviation = !done ? 'not-started'
      : done.id !== step.id ? 'out-of-order'
      : 'on-track';
    return { planned: step.id, actual: done ? done.id : null, deviation };
  });
}

/* ------------------------------------------------------------------ */
/* 51078 — shareable status link                                        */
/* ------------------------------------------------------------------ */

export function shareStatusLink(huntId, token) {
  const id = String(huntId || '').trim();
  const tok = String(token || '').trim();
  if (!id || !tok) return '';
  return `https://hack.thebhavesh.online/status/${encodeURIComponent(id)}?t=${encodeURIComponent(tok)}`;
}

/* ------------------------------------------------------------------ */
/* 51079 — spoken status readout                                        */
/* ------------------------------------------------------------------ */

export function spokenStatus({ phase, action, progressPct = 0 }) {
  return `Current status: ${phase || 'hunt'}, ${action || 'working'}, ${Math.round(Number(progressPct) || 0)} percent complete.`;
}

/* ------------------------------------------------------------------ */
/* 51080 — dashboard status widget                                      */
/* ------------------------------------------------------------------ */

export function dashboardWidget({ huntId, phase, progressPct = 0, criticals = 0, waiting = false }) {
  return {
    huntId: huntId || '',
    phase: phase || 'hunt',
    progressPct: Math.max(0, Math.min(100, Math.round(Number(progressPct) || 0))),
    criticals: Math.max(0, Number(criticals) || 0),
    attention: waiting || Number(criticals) > 0,
  };
}
