/**
 * chatCore.js — wave 26 (ideas 51001–51040): mid-hunt chat / conversational UX
 * suite pure logic (+ 4 perceived-performance tail ideas 51001–51004).
 *
 * Ideas 51001–51040: optimistic share links, debounced resize handling,
 * instant keyboard focus, latency self-test, pinned chat dock, context-aware
 * replies, dynamic question chips, reply reactions, conversation search,
 * threaded follow-ups, agent presence badge, mid-chat language switch,
 * voice-note questions, chat file attachments, transcript export, pinned
 * answers rail, proactive follow-up prompts, auto-condensing answers,
 * slash-command controls, finding ID deep links, offline message queue,
 * typing indicator, split chat panes, tone selector, @-mentions for
 * artifacts, chat-to-report notes, cited answers, chat message filters,
 * chat quiet hours, guided test-request flow, answer confidence meter,
 * timeline-synced replay, teammate chat invites, screenshot annotation,
 * clarification-first behavior, keyboard-first chat, one-tap translation,
 * approval cards in chat, natural-language scope edits, on-demand chat
 * digest.
 *
 * Pure functions only — no DOM/window/timer side effects — unit-testable
 * with node:test. Deterministic (no Math.random, no Date.now inside).
 */

export const WAVE26_START = 51001;
export const WAVE26_END = 51040;

let msgSeq = 0;
/** Deterministic message ids (no Math.random → testable). */
export function nextMessageId(prefix = 'msg') {
  msgSeq += 1;
  return `${prefix}-${msgSeq}`;
}
export function resetMessageIds() {
  msgSeq = 0;
}

/** Registry of all 40 ideas in this wave — completeness is testable. */
export const WAVE26_IDEAS = [
  [51001, 'optimistic share links', 'Share link appears instantly while permissions sync afterward'],
  [51002, 'debounced resize handling', 'Window-resize recalculations debounce to avoid layout jank'],
  [51003, 'instant keyboard focus', 'Focus moves instantly even while a card detail still loads'],
  [51004, 'latency self-test', 'Settings include an honest interaction-latency self-test with reported results'],
  [51005, 'pinned chat dock', 'Collapsible chat panel docked beside the live hunt timeline'],
  [51006, 'context-aware replies', 'Every message carries hunt phase + scope for state-aware answers'],
  [51007, 'dynamic question chips', 'Quick-ask buttons refresh automatically as the hunt phase changes'],
  [51008, 'reply reactions', 'Reactions on answers silently tune verbosity and technical depth'],
  [51009, 'conversation search', 'Full-text search across hunt chat with jump-to-context'],
  [51010, 'threaded follow-ups', 'Reply-in-thread drills deeper without derailing main conversation'],
  [51011, 'agent presence badge', 'Live thinking/acting/idle/waiting indicator synced to execution loop'],
  [51012, 'mid-chat language switch', 'Reply language changes mid-hunt without restarting'],
  [51013, 'voice-note questions', 'Spoken questions transcribe into chat as the message record'],
  [51014, 'chat file attachments', 'Dropped files are referenced in the next reasoning step'],
  [51015, 'transcript export', 'One-click markdown download of the full conversation'],
  [51016, 'pinned answers rail', 'Key agent replies pinned to a side rail for quick reference'],
  [51017, 'proactive follow-up prompts', 'Agent suggests natural next questions after each answer'],
  [51018, 'auto-condensing answers', 'High chat volume shortens replies automatically'],
  [51019, 'slash-command controls', '/status, /pause, /focus execute real hunt controls'],
  [51020, 'finding ID deep links', 'Pasted finding IDs expand to inline live-status cards'],
  [51021, 'offline message queue', 'Messages typed offline queue and deliver on reconnect'],
  [51022, 'typing indicator', 'Visible agent-is-composing state'],
  [51023, 'split chat panes', 'Two parallel threads (strategy vs findings) side by side'],
  [51024, 'tone selector', 'Concise analyst vs patient explainer without changing actions'],
  [51025, '@-mentions for artifacts', 'Mention findings, tools, phases to pull details into chat'],
  [51026, 'chat-to-report notes', 'Selected messages append as annotated report notes'],
  [51027, 'cited answers', 'Factual claims link to the supporting log line or finding'],
  [51028, 'chat message filters', 'Views for questions, steering commands, explanations only'],
  [51029, 'chat quiet hours', 'Proactive messages muted in a window; critical alerts stay on'],
  [51030, 'guided test-request flow', 'Chat wizard turns "try X on Y" into a validated queued test'],
  [51031, 'answer confidence meter', 'Subtle confidence indicator on uncertain replies'],
  [51032, 'timeline-synced replay', 'Conversation replays chronologically with the execution timeline'],
  [51033, 'teammate chat invites', 'Teammates join hunt chat with role-based permissions'],
  [51034, 'screenshot annotation', 'Sketched regions on screenshots feed agent reasoning'],
  [51035, 'clarification-first behavior', 'Ambiguous requests get one precise question, not a guess'],
  [51036, 'keyboard-first chat', 'Full keyboard nav for send, search, pin, react'],
  [51037, 'one-tap translation', 'Any agent message translates instantly to another language'],
  [51038, 'approval cards in chat', 'Approve/deny cards for sensitive actions inside conversation'],
  [51039, 'natural-language scope edits', '"also include the API subdomain" confirmed before expanding'],
  [51040, 'on-demand chat digest', '"summarize the last hour" → phases, tests, findings digest'],
];

/* ------------------------------------------------------------------ */
/* 51001 — Optimistic share links                                       */
/* ------------------------------------------------------------------ */

export const SHARE_PENDING = 'pending';
export const SHARE_ACTIVE = 'active';

/** Link appears instantly; permissions sync resolves it afterward. */
export function optimisticShareLink(huntId, nowMs) {
  if (!huntId) return null;
  return {
    id: nextMessageId('share'),
    huntId,
    url: `/hunts/${encodeURIComponent(huntId)}/shared`,
    status: SHARE_PENDING,
    permissionsSynced: false,
    createdAt: nowMs,
  };
}

/** Permissions sync finished → link becomes fully active. */
export function confirmShareLink(link, nowMs) {
  if (!link) return null;
  return { ...link, status: SHARE_ACTIVE, permissionsSynced: true, syncedAt: nowMs };
}

/* ------------------------------------------------------------------ */
/* 51002 — Debounced resize handling                                    */
/* ------------------------------------------------------------------ */

export const RESIZE_DEBOUNCE_MS = 150;

/** True when enough quiet time passed to justify an expensive recalc. */
export function shouldRecalcResize(lastRecalcMs, nowMs, waitMs = RESIZE_DEBOUNCE_MS) {
  return nowMs - lastRecalcMs >= waitMs;
}

/** Cheap classification; heavy work (timeline re-layout) only on recalc. */
export function resizePlan(width, height) {
  const w = Math.max(0, width | 0);
  return {
    width: w,
    height: Math.max(0, height | 0),
    breakpoint: w < 640 ? 'sm' : w < 1024 ? 'md' : 'lg',
    heavy: ['timeline-layout', 'finding-grid'],
  };
}

/* ------------------------------------------------------------------ */
/* 51003 — Instant keyboard focus                                       */
/* ------------------------------------------------------------------ */

/** Focus moves now; detail announces itself when it finishes loading. */
export function instantFocus(cardId, detailLoaded) {
  if (!cardId) return null;
  return {
    target: cardId,
    moved: 'immediate',
    detail: detailLoaded ? 'loaded' : 'loading',
    followUp: detailLoaded ? 'none' : 'announce-when-ready',
  };
}

/* ------------------------------------------------------------------ */
/* 51004 — Latency self-test                                            */
/* ------------------------------------------------------------------ */

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

/** Honest interaction-latency stats from measured samples (ms). */
export function latencyStats(samples) {
  const xs = (samples || []).filter((n) => Number.isFinite(n) && n >= 0).sort((a, b) => a - b);
  if (!xs.length) return { count: 0, p50: 0, p95: 0, max: 0 };
  return { count: xs.length, p50: percentile(xs, 50), p95: percentile(xs, 95), max: xs[xs.length - 1] };
}

export function latencyGrade(p95Ms) {
  if (p95Ms <= 50) return 'excellent';
  if (p95Ms <= 100) return 'good';
  if (p95Ms <= 200) return 'fair';
  return 'poor';
}

/** Full self-test report shown in settings. */
export function latencySelfTestReport(samples) {
  const stats = latencyStats(samples);
  return { ...stats, grade: latencyGrade(stats.p95), unit: 'ms', honest: true };
}

/* ------------------------------------------------------------------ */
/* 51005 — Pinned chat dock                                             */
/* ------------------------------------------------------------------ */

export const DOCK_PINNED = 'pinned';
export const DOCK_COLLAPSED = 'collapsed';

/** Dock toggles between pinned-open and collapsed rail. */
export function toggleDock(state) {
  return state === DOCK_PINNED ? DOCK_COLLAPSED : DOCK_PINNED;
}

/** Dock never covers the findings feed: it reserves its own column. */
export function dockLayout(dockState, viewportWidth) {
  const open = dockState === DOCK_PINNED;
  const dockWidth = open ? Math.min(380, Math.floor(viewportWidth * 0.32)) : 48;
  return { dockState, dockWidth, feedWidth: Math.max(0, viewportWidth - dockWidth), overlaysFeed: false };
}

/* ------------------------------------------------------------------ */
/* 51006 — Context-aware replies                                        */
/* ------------------------------------------------------------------ */

export function messageContext(phase, scope) {
  return { phase: phase || 'unknown', scope: scope || 'unknown' };
}

/** Stamp hunt phase + scope onto a message so answers stay state-aware. */
export function withMessageContext(message, phase, scope) {
  if (!message) return null;
  return { ...message, context: messageContext(phase, scope) };
}

/* ------------------------------------------------------------------ */
/* 51007 — Dynamic question chips                                       */
/* ------------------------------------------------------------------ */

export const PHASE_QUESTION_CHIPS = {
  recon: ['what changed in the last 10 minutes?', 'any new subdomains?', 'show the attack surface summary'],
  scanning: ['which tests are running now?', 'any findings so far?', 'what is the current coverage?'],
  exploitation: ['what succeeded?', 'show proof of the critical finding', 'what should I verify manually?'],
  reporting: ['draft the executive summary', 'list unresolved findings', 'what is left to test?'],
  default: ['where are we?', 'what changed recently?', 'what should I look at?'],
};

/** Chips refresh automatically as the hunt phase changes. */
export function questionChips(phase) {
  return PHASE_QUESTION_CHIPS[phase] || PHASE_QUESTION_CHIPS.default;
}

/* ------------------------------------------------------------------ */
/* 51008 — Reply reactions                                              */
/* ------------------------------------------------------------------ */

/**
 * Reactions silently tune verbosity (0=terse..2=verbose) and depth
 * (0=surface..2=deep). Thumbs-up keeps course; thumbs-down shortens.
 */
export function tuneFromReactions(reactions) {
  const rs = reactions || [];
  let verbosity = 1;
  let depth = 1;
  for (const r of rs) {
    if (r === 'thumbs-down') { verbosity = Math.max(0, verbosity - 1); depth = Math.max(0, depth - 1); }
    else if (r === 'thumbs-up') { verbosity = Math.min(2, verbosity + 0); }
    else if (r === 'mind-blown' || r === 'eyes') { depth = Math.min(2, depth + 1); }
    else if (r === 'zzz' || r === 'yawn') { verbosity = Math.max(0, verbosity - 1); }
  }
  return { verbosity, depth };
}

/* ------------------------------------------------------------------ */
/* 51009 — Conversation search                                          */
/* ------------------------------------------------------------------ */

/** Full-text search with a context snippet per match. */
export function searchConversation(messages, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  const out = [];
  (messages || []).forEach((m, index) => {
    const text = String(m.text || '');
    const at = text.toLowerCase().indexOf(q);
    if (at >= 0) {
      const start = Math.max(0, at - 24);
      const snippet = (start > 0 ? '…' : '') + text.slice(start, at + q.length + 24) + (at + q.length + 24 < text.length ? '…' : '');
      out.push({ messageId: m.id, index, snippet });
    }
  });
  return out;
}

/* ------------------------------------------------------------------ */
/* 51010 — Threaded follow-ups                                          */
/* ------------------------------------------------------------------ */

export function threadReply(parentId, text, author, nowMs) {
  if (!parentId || !text) return null;
  return { id: nextMessageId('msg'), parentId, text, author: author || 'you', at: nowMs, thread: true };
}

export function threadMessages(messages, parentId) {
  return (messages || []).filter((m) => m.parentId === parentId);
}

/* ------------------------------------------------------------------ */
/* 51011 — Agent presence badge                                         */
/* ------------------------------------------------------------------ */

export const PRESENCE_THINKING = 'thinking';
export const PRESENCE_ACTING = 'acting';
export const PRESENCE_IDLE = 'idle';
export const PRESENCE_WAITING = 'waiting';

/** Map the execution loop state to a human presence label. */
export function presenceBadge(execState) {
  switch (execState) {
    case 'reasoning': return PRESENCE_THINKING;
    case 'tool-call':
    case 'executing': return PRESENCE_ACTING;
    case 'awaiting-user': return PRESENCE_WAITING;
    default: return PRESENCE_IDLE;
  }
}

export const PRESENCE_LABELS = {
  thinking: 'Thinking…',
  acting: 'Acting…',
  idle: 'Idle',
  waiting: 'Waiting on you',
};

/* ------------------------------------------------------------------ */
/* 51012 — Mid-chat language switch                                     */
/* ------------------------------------------------------------------ */

/** Language changes; the hunt and conversation continue untouched. */
export function switchChatLanguage(session, newLang) {
  if (!session || !newLang) return session;
  return { ...session, language: newLang, restarted: false, switchedAt: 'now' };
}

/* ------------------------------------------------------------------ */
/* 51013 — Voice-note questions                                         */
/* ------------------------------------------------------------------ */

export function voiceNoteToMessage(transcript, durationMs, nowMs) {
  const text = String(transcript || '').trim();
  if (!text) return null;
  return {
    id: nextMessageId('msg'),
    author: 'you',
    kind: 'voice-note',
    text,
    durationMs: Math.max(0, durationMs | 0),
    at: nowMs,
  };
}

/* ------------------------------------------------------------------ */
/* 51014 — Chat file attachments                                        */
/* ------------------------------------------------------------------ */

export function attachFile(name, kind, sizeBytes, nowMs) {
  if (!name) return null;
  return {
    id: nextMessageId('file'),
    name,
    kind: kind || 'note',
    sizeBytes: Math.max(0, sizeBytes | 0),
    at: nowMs,
    referencedInReasoning: true,
  };
}

/* ------------------------------------------------------------------ */
/* 51015 — Transcript export                                            */
/* ------------------------------------------------------------------ */

/** One-click markdown download of the full hunt conversation. */
export function exportTranscript(messages, huntMeta) {
  const meta = huntMeta || {};
  const lines = [
    `# Hunt chat transcript — ${meta.huntId || 'unknown hunt'}`,
    '',
    `Phase: ${meta.phase || 'n/a'} · Scope: ${meta.scope || 'n/a'}`,
    '',
  ];
  (messages || []).forEach((m) => {
    const when = m.at != null ? new Date(m.at).toISOString() : 'n/a';
    const phase = m.context && m.context.phase ? ` [${m.context.phase}]` : '';
    lines.push(`**${m.author || 'unknown'}** · ${when}${phase}`);
    lines.push(String(m.text || ''));
    lines.push('');
  });
  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/* 51016 — Pinned answers rail                                          */
/* ------------------------------------------------------------------ */

export function pinAnswer(message) {
  if (!message) return null;
  return { ...message, pinned: true };
}

export function unpinAnswer(message) {
  if (!message) return null;
  const { pinned, ...rest } = message;
  return rest;
}

export function pinnedRail(messages) {
  return (messages || []).filter((m) => m.pinned);
}

/* ------------------------------------------------------------------ */
/* 51017 — Proactive follow-up prompts                                  */
/* ------------------------------------------------------------------ */

const FOLLOWUP_RULES = [
  [/subdomain/i, 'any new subdomains since then?'],
  [/finding/i, 'show the evidence for that finding'],
  [/scope/i, 'should we expand the scope?'],
  [/test/i, 'which test should run next?'],
  [/report/i, 'draft that section of the report'],
];

/** Suggest 2–3 natural next questions after an answer. */
export function suggestFollowUps(lastAnswer, max = 3) {
  const text = String((lastAnswer && lastAnswer.text) || '');
  const out = [];
  for (const [re, q] of FOLLOWUP_RULES) {
    if (re.test(text) && out.length < max) out.push(q);
  }
  while (out.length < Math.min(2, max)) out.push('what changed recently?');
  return out.slice(0, max);
}

/* ------------------------------------------------------------------ */
/* 51018 — Auto-condensing answers                                      */
/* ------------------------------------------------------------------ */

/** During high chat volume, shorten replies to stay readable. */
export function condenseAnswer(text, highVolume) {
  const t = String(text || '');
  if (!highVolume) return t;
  const sentences = t.match(/[^.!?]+[.!?]+/g) || [t];
  const short = sentences.slice(0, 2).join(' ').trim();
  return sentences.length > 2 ? `${short} …` : short;
}

/* ------------------------------------------------------------------ */
/* 51019 — Slash-command controls                                       */
/* ------------------------------------------------------------------ */

export const SLASH_COMMANDS = {
  '/status': { action: 'status', description: 'Show hunt status summary' },
  '/pause': { action: 'pause', description: 'Pause the live hunt' },
  '/resume': { action: 'resume', description: 'Resume a paused hunt' },
  '/focus': { action: 'focus', description: 'Focus a finding or phase: /focus <id>' },
  '/scope': { action: 'scope', description: 'Show current scope' },
  '/help': { action: 'help', description: 'List available commands' },
};

/** Parse "/pause", "/focus F-123" etc. into real hunt controls. */
export function parseSlashCommand(text) {
  const t = String(text || '').trim();
  if (!t.startsWith('/')) return null;
  const [cmd, ...rest] = t.split(/\s+/);
  const known = SLASH_COMMANDS[cmd.toLowerCase()];
  if (!known) return { command: cmd, action: 'unknown', arg: rest.join(' ') || null };
  return { command: cmd.toLowerCase(), action: known.action, arg: rest.join(' ') || null };
}

/* ------------------------------------------------------------------ */
/* 51020 — Finding ID deep links                                        */
/* ------------------------------------------------------------------ */

export const FINDING_ID_PATTERN = /\b(F-\d{3,}|finding-[a-z0-9-]{3,})\b/gi;

/** Detect finding IDs pasted in chat. */
export function extractFindingIds(text) {
  const t = String(text || '');
  const found = [];
  let m;
  FINDING_ID_PATTERN.lastIndex = 0;
  while ((m = FINDING_ID_PATTERN.exec(t)) !== null) {
    if (!found.includes(m[1])) found.push(m[1]);
  }
  return found;
}

/** Inline card data for a pasted finding ID (live status filled by UI). */
export function findingInlineCard(findingId, baseUrl, huntId) {
  if (!findingId) return null;
  const base = String(baseUrl || '').replace(/\/+$/, '');
  return {
    findingId,
    href: base && huntId ? `${base}/hunts/${encodeURIComponent(huntId)}?finding=${encodeURIComponent(findingId)}` : `#finding-${encodeURIComponent(findingId)}`,
    status: 'live',
  };
}

/* ------------------------------------------------------------------ */
/* 51021 — Offline message queue                                        */
/* ------------------------------------------------------------------ */

export function enqueueOfflineMessage(queue, text, nowMs) {
  const q = Array.isArray(queue) ? queue.slice() : [];
  if (!String(text || '').trim()) return q;
  q.push({ id: nextMessageId('offline'), text: String(text), queuedAt: nowMs, delivered: false });
  return q;
}

/** On reconnect: mark everything deliverable, preserving order. */
export function flushOfflineQueue(queue) {
  const q = Array.isArray(queue) ? queue : [];
  const deliverable = q.filter((m) => !m.delivered);
  const rest = q.map((m) => ({ ...m, delivered: true }));
  return { deliverable, queue: rest };
}

/* ------------------------------------------------------------------ */
/* 51022 — Typing indicator                                             */
/* ------------------------------------------------------------------ */

export function typingState(isComposing) {
  return isComposing ? 'composing' : 'idle';
}

/* ------------------------------------------------------------------ */
/* 51023 — Split chat panes                                             */
/* ------------------------------------------------------------------ */

export function splitChatPanes() {
  return [
    { id: 'strategy', title: 'Strategy', messages: [] },
    { id: 'findings', title: 'Findings', messages: [] },
  ];
}

export function routeToPane(panes, paneId, message) {
  return (panes || []).map((p) => (p.id === paneId ? { ...p, messages: [...p.messages, message] } : p));
}

/* ------------------------------------------------------------------ */
/* 51024 — Tone selector                                                */
/* ------------------------------------------------------------------ */

export const CHAT_TONES = ['concise', 'explainer'];

export function selectTone(tone) {
  return CHAT_TONES.includes(tone) ? tone : 'concise';
}

/** Tag a draft/answer with the active tone (actions unchanged). */
export function withTone(text, tone) {
  return { text: String(text || ''), tone: selectTone(tone) };
}

/* ------------------------------------------------------------------ */
/* 51025 — @-mentions for artifacts                                    */
/* ------------------------------------------------------------------ */

export const MENTION_PATTERN = /@(finding|tool|phase):([a-zA-Z0-9][a-zA-Z0-9_-]*)/g;

/** Pull @finding:X, @tool:Y, @phase:Z details into the conversation. */
export function parseMentions(text) {
  const t = String(text || '');
  const out = [];
  let m;
  MENTION_PATTERN.lastIndex = 0;
  while ((m = MENTION_PATTERN.exec(t)) !== null) {
    out.push({ kind: m[1], ref: m[2] });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 51026 — Chat-to-report notes                                         */
/* ------------------------------------------------------------------ */

/** Selected messages append as annotated notes in the draft report. */
export function chatToReportNote(selected, huntId) {
  const msgs = (selected || []).filter(Boolean);
  if (!msgs.length) return '';
  const lines = [`## Chat notes — hunt ${huntId || 'n/a'}`, ''];
  msgs.forEach((m) => {
    lines.push(`- **${m.author || 'unknown'}**: ${String(m.text || '').slice(0, 280)}`);
  });
  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/* 51027 — Cited answers                                                */
/* ------------------------------------------------------------------ */

export function citeClaim(claim, source) {
  if (!claim || !source) return null;
  return { claim: String(claim), source: String(source) };
}

/** Attach citations (log lines / finding refs) to an answer. */
export function answerWithCitations(text, citations) {
  return { text: String(text || ''), citations: (citations || []).filter(Boolean) };
}

/* ------------------------------------------------------------------ */
/* 51028 — Chat message filters                                         */
/* ------------------------------------------------------------------ */

export const MESSAGE_FILTERS = ['all', 'questions', 'commands', 'explanations'];

/**
 * Toggle views: only agent questions, only your steering commands,
 * or only explanations. `m.kind`: 'question' | 'command' | 'explanation' | other.
 */
export function filterMessages(messages, filter) {
  const f = MESSAGE_FILTERS.includes(filter) ? filter : 'all';
  if (f === 'all') return (messages || []).slice();
  const want = f === 'questions' ? 'question' : f === 'commands' ? 'command' : 'explanation';
  return (messages || []).filter((m) => m.kind === want);
}

/* ------------------------------------------------------------------ */
/* 51029 — Chat quiet hours                                             */
/* ------------------------------------------------------------------ */

/** Minutes-since-midnight window check (wraps past midnight). */
export function quietHoursActive(nowMinutes, startMinutes, endMinutes) {
  const n = ((nowMinutes % 1440) + 1440) % 1440;
  const s = ((startMinutes % 1440) + 1440) % 1440;
  const e = ((endMinutes % 1440) + 1440) % 1440;
  if (s === e) return false;
  return s < e ? n >= s && n < e : n >= s || n < e;
}

/** Critical alerts always deliver; proactive ones respect quiet hours. */
export function shouldDeliverMessage(message, quietActive) {
  if (!message) return false;
  if (message.priority === 'critical') return true;
  if (message.proactive && quietActive) return false;
  return true;
}

/* ------------------------------------------------------------------ */
/* 51030 — Guided test-request flow                                     */
/* ------------------------------------------------------------------ */

/**
 * Turn "try X on Y" into a validated, queued test.
 * Returns { action, target, valid, errors[] }.
 */
export function testRequestWizard(input) {
  const t = String(input || '').trim();
  const errors = [];
  const m = t.match(/^try\s+(.+?)\s+on\s+(.+)$/i);
  if (!m) {
    errors.push('Say it like: "try <technique> on <target>"');
    return { action: null, target: null, valid: false, errors };
  }
  const action = m[1].trim();
  const target = m[2].trim();
  if (action.length < 3) errors.push('Technique is too short to be meaningful.');
  if (!/^[a-zA-Z0-9.:/_-]+$/.test(target)) errors.push('Target contains unsupported characters.');
  return { action, target, valid: errors.length === 0, errors };
}

/* ------------------------------------------------------------------ */
/* 51031 — Answer confidence meter                                      */
/* ------------------------------------------------------------------ */

export function confidenceLevel(score) {
  const s = Number(score);
  if (!Number.isFinite(s)) return 'unknown';
  if (s >= 0.8) return 'high';
  if (s >= 0.5) return 'medium';
  return 'low';
}

/** Subtle indicator data for uncertain replies. */
export function confidenceMeter(score) {
  const level = confidenceLevel(score);
  return { level, show: level === 'low' || level === 'medium', score: Number(score) || 0 };
}

/* ------------------------------------------------------------------ */
/* 51032 — Timeline-synced replay                                       */
/* ------------------------------------------------------------------ */

/** Merge chat + execution events chronologically for replay. */
export function timelineReplay(messages, events) {
  const items = [];
  (messages || []).forEach((m) => items.push({ at: m.at || 0, kind: 'message', ref: m }));
  (events || []).forEach((e) => items.push({ at: e.at || 0, kind: 'event', ref: e }));
  items.sort((a, b) => a.at - b.at);
  return items;
}

/* ------------------------------------------------------------------ */
/* 51033 — Teammate chat invites                                        */
/* ------------------------------------------------------------------ */

export const CHAT_ROLES = ['viewer', 'commenter', 'operator'];

export function inviteTeammate(email, role) {
  const e = String(email || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return { ok: false, error: 'Invalid email address.' };
  const r = CHAT_ROLES.includes(role) ? role : 'viewer';
  return { ok: true, invite: { id: nextMessageId('invite'), email: e, role: r, status: 'sent' } };
}

/* ------------------------------------------------------------------ */
/* 51034 — Screenshot annotation                                        */
/* ------------------------------------------------------------------ */

/**
 * Normalized regions [{x,y,w,h (0..1), label}] feed the agent's reasoning
 * about the marked area.
 */
export function annotateScreenshot(regions) {
  const rs = (regions || [])
    .filter((r) => r && r.w > 0 && r.h > 0)
    .map((r) => ({
      x: Math.min(1, Math.max(0, r.x || 0)),
      y: Math.min(1, Math.max(0, r.y || 0)),
      w: Math.min(1, Math.max(0, r.w)),
      h: Math.min(1, Math.max(0, r.h)),
      label: String(r.label || 'marked region'),
    }));
  return { id: nextMessageId('shot'), regions: rs, regionCount: rs.length };
}

/* ------------------------------------------------------------------ */
/* 51035 — Clarification-first behavior                                 */
/* ------------------------------------------------------------------ */

const VAGUE_PATTERNS = [
  /\b(it|that|this)\b.*\b(do|check|test|look)\b/i,
  /\b(something|anything|stuff)\b/i,
  /^(go ahead|do it|proceed|continue)$/i,
];

/** Ambiguous requests get one precise question instead of a guess. */
export function needsClarification(request) {
  const t = String(request || '').trim();
  if (t.length < 4) return true;
  return VAGUE_PATTERNS.some((re) => re.test(t));
}

export function clarifyingQuestion(request) {
  const t = String(request || '').trim();
  if (/scope/i.test(t)) return 'Which hosts should I include in the scope?';
  if (/test/i.test(t)) return 'Which technique and target should I test?';
  return 'Could you specify exactly what you want me to do?';
}

/* ------------------------------------------------------------------ */
/* 51036 — Keyboard-first chat                                          */
/* ------------------------------------------------------------------ */

export function chatKeybindings() {
  return [
    { keys: 'Ctrl+Enter', action: 'send', label: 'Send message' },
    { keys: '/', action: 'search', label: 'Search conversation' },
    { keys: 'p', action: 'pin', label: 'Pin focused answer' },
    { keys: 'r', action: 'react', label: 'React to focused answer' },
    { keys: 't', action: 'thread', label: 'Reply in thread' },
    { keys: 'Esc', action: 'close', label: 'Close dialog / blur composer' },
  ];
}

/* ------------------------------------------------------------------ */
/* 51037 — One-tap translation                                          */
/* ------------------------------------------------------------------ */

/** Translation is a job descriptor; the UI resolves it via the i18n layer. */
export function translationJob(messageId, targetLang) {
  if (!messageId || !targetLang) return null;
  return { id: nextMessageId('tr'), messageId, targetLang, status: 'queued' };
}

/* ------------------------------------------------------------------ */
/* 51038 — Approval cards in chat                                       */
/* ------------------------------------------------------------------ */

export function approvalCard(action, detail) {
  if (!action) return null;
  return { id: nextMessageId('approval'), action: String(action), detail: String(detail || ''), status: 'pending' };
}

export function resolveApproval(card, approved, nowMs) {
  if (!card) return null;
  return { ...card, status: approved ? 'approved' : 'denied', resolvedAt: nowMs };
}

/* ------------------------------------------------------------------ */
/* 51039 — Natural-language scope edits                                 */
/* ------------------------------------------------------------------ */

/**
 * Parse "also include the API subdomain" / "drop staging.example.com".
 * Always returns a confirmation step — never applies silently.
 */
export function parseScopeEdit(text) {
  const t = String(text || '').trim();
  const add = [];
  const remove = [];
  let m = t.match(/also include (?:the )?([a-zA-Z0-9.:/_-]+)/i);
  if (m) add.push(m[1]);
  m = t.match(/\b(?:drop|remove|exclude) ([a-zA-Z0-9.:/_-]+)/i);
  if (m) remove.push(m[1]);
  if (!add.length && !remove.length) return null;
  return { add, remove, needsConfirmation: true };
}

export function scopeEditConfirmation(edit) {
  if (!edit) return '';
  const parts = [];
  if (edit.add.length) parts.push(`add ${edit.add.join(', ')}`);
  if (edit.remove.length) parts.push(`remove ${edit.remove.join(', ')}`);
  return `Confirm scope change: ${parts.join('; ')}?`;
}

/* ------------------------------------------------------------------ */
/* 51040 — On-demand chat digest                                        */
/* ------------------------------------------------------------------ */

/** "summarize the last hour" → phases, tests, findings in one digest. */
export function chatDigest(messages, windowMs, nowMs) {
  const cutoff = nowMs - windowMs;
  const recent = (messages || []).filter((m) => (m.at || 0) >= cutoff);
  const phases = [...new Set(recent.map((m) => (m.context && m.context.phase) || 'unknown'))];
  const findings = new Set();
  recent.forEach((m) => extractFindingIds(m.text).forEach((id) => findings.add(id)));
  const tests = recent.filter((m) => /test/i.test(m.text || '')).length;
  return {
    windowMs,
    messageCount: recent.length,
    phases,
    testsMentioned: tests,
    findingsMentioned: [...findings],
    summary: `${recent.length} messages across ${phases.length} phase(s); ${tests} test mention(s), ${findings.size} finding(s) referenced.`,
  };
}
