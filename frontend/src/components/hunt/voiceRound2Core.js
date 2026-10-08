/**
 * voiceRound2Core.js — Infinity AI · Dark-Matter · Wave 49
 * Pure logic (no React, no DOM, no network) backing the Voice Round 2 suite:
 * idea-bank ideas 51921–51950. Every exported function is pure and deterministic.
 */

export const WAVE49_VOICE2_IDEAS = [
  { id: 51921, title: 'Voice command permissions' },
  { id: 51922, title: 'Voice audit trail' },
  { id: 51923, title: 'Voice in noisy environments' },
  { id: 51924, title: 'Voice offline mode' },
  { id: 51925, title: 'Voice command chaining' },
  { id: 51926, title: 'Voice timers' },
  { id: 51927, title: 'Voice during screen share' },
  { id: 51928, title: 'Voice accessibility mode' },
  { id: 51929, title: 'Voice command discovery' },
  { id: 51930, title: 'Voice feedback collection' },
  { id: 51931, title: 'Voice emergency stop' },
  { id: 51932, title: 'Voice whisper mode' },
  { id: 51933, title: 'Voice over phone call' },
  { id: 51934, title: 'Voice smart-speaker integration' },
  { id: 51935, title: 'Voice car mode' },
  { id: 51936, title: 'Voice meeting mode' },
  { id: 51937, title: 'Voice command analytics' },
  { id: 51938, title: 'Voice latency display' },
  { id: 51939, title: 'Voice fallback to text' },
  { id: 51940, title: 'Voice bilingual commands' },
  { id: 51941, title: 'Voice finding triage' },
  { id: 51942, title: 'Voice approval delegation' },
  { id: 51943, title: 'Voice hunt creation' },
  { id: 51944, title: 'Voice report narration' },
  { id: 51945, title: 'Voice Q&A on logs' },
  { id: 51946, title: 'Voice confidence checks' },
  { id: 51947, title: 'Voice resource queries' },
  { id: 51948, title: 'Voice team coordination' },
  { id: 51949, title: 'Voice command sandbox' },
  { id: 51950, title: 'Voice privacy mode' },
];

// 51921 — Voice command permissions: destructive commands need an enrolled voice.
const DESTRUCTIVE_COMMANDS = ['stop hunt', 'delete hunt', 'delete findings', 'purge data', 'terminate agent'];
export function checkVoicePermission(command, speaker) {
  const normalized = String(command || '').trim().toLowerCase();
  const isDestructive = DESTRUCTIVE_COMMANDS.some((d) => normalized.includes(d));
  if (!isDestructive) return { allowed: true, reason: 'non-destructive command' };
  const enrolled = Boolean(speaker && speaker.enrolled);
  return enrolled
    ? { allowed: true, reason: 'enrolled voice verified', requiresConfirm: true }
    : { allowed: false, reason: 'destructive command requires an enrolled voice', requiresConfirm: false };
}

// 51922 — Voice audit trail: every voice command appended to an immutable-style hunt log.
export function appendVoiceAuditEntry(log, command, speaker, result) {
  const entry = {
    ts: new Date().toISOString(),
    type: 'voice-command',
    command: String(command || ''),
    speaker: speaker && speaker.name ? speaker.name : 'unknown',
    verified: Boolean(speaker && speaker.enrolled),
    result: String(result || ''),
  };
  return { entry, log: [...(Array.isArray(log) ? log : []), entry] };
}

// 51923 — Noisy-environment recognition tuning: pick a profile from ambient dB.
export function selectNoiseProfile(ambientDb) {
  const db = Number(ambientDb);
  if (!Number.isFinite(db)) return { profile: 'auto', gainDb: 0, note: 'unknown environment' };
  if (db < 45) return { profile: 'quiet-room', gainDb: 0, note: 'low noise, full vocabulary' };
  if (db < 65) return { profile: 'office', gainDb: 6, note: 'noise suppression on, office vocabulary' };
  if (db < 80) return { profile: 'commute', gainDb: 12, note: 'aggressive suppression, short commands only' };
  return { profile: 'construction', gainDb: 18, note: 'max suppression, confirm every command' };
}

// 51924 — Offline mode: on-device recognition for core commands only.
const OFFLINE_CORE_COMMANDS = ['pause hunt', 'resume hunt', 'hunt status', 'stop hunt', 'take snapshot', 'pause for ten minutes'];
export function offlineRecognize(transcript) {
  const normalized = String(transcript || '').trim().toLowerCase();
  const match = OFFLINE_CORE_COMMANDS.find((c) => normalized.includes(c));
  return match
    ? { recognized: true, command: match, mode: 'on-device', needsNetwork: false }
    : { recognized: false, command: null, mode: 'on-device', needsNetwork: true };
}

// 51925 — Command chaining: split "pause the hunt and take a snapshot" into steps.
export function parseChainedCommand(transcript) {
  const parts = String(transcript || '')
    .toLowerCase()
    .split(/\s+(?:and then|then|and)\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.map((step, i) => ({ order: i + 1, step }));
}

// 51926 — Voice timers: "pause for ten minutes, then resume" → structured timer.
const WORD_NUMBERS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60 };
export function parseVoiceTimer(transcript) {
  const text = String(transcript || '').toLowerCase();
  const wordMatch = text.match(new RegExp(`\\b(${Object.keys(WORD_NUMBERS).join('|')})\\b`));
  const digitMatch = text.match(/(\d+)\s*(minute|minutes|hour|hours|second|seconds)/);
  let minutes = 10;
  if (digitMatch) {
    const n = parseInt(digitMatch[1], 10);
    minutes = /hour/.test(digitMatch[2]) ? n * 60 : /second/.test(digitMatch[2]) ? n / 60 : n;
  } else if (wordMatch) {
    minutes = WORD_NUMBERS[wordMatch[1]];
  }
  const action = /resume/.test(text) ? 'pause-then-resume' : 'remind';
  return { minutes, seconds: Math.round(minutes * 60), action, valid: minutes > 0 };
}

// 51927 — Voice during screen share: short spoken control tokens for presenting.
export function buildScreenShareTokens(huntName) {
  const h = String(huntName || 'the hunt');
  return [
    { phrase: 'next finding', effect: `advances to the next finding in ${h}` },
    { phrase: 'show details', effect: 'expands the current finding card' },
    { phrase: 'pause the hunt', effect: `pauses ${h} without leaving the presentation` },
    { phrase: 'back one', effect: 'returns to the previous finding' },
  ];
}

// 51928 — Voice accessibility mode: every operable action gets a spoken synonym map.
export function buildAccessibilityCommandMap() {
  return [
    { action: 'navigate-next', phrases: ['next', 'next item', 'move on'] },
    { action: 'navigate-prev', phrases: ['previous', 'go back', 'last one'] },
    { action: 'activate', phrases: ['open', 'select', 'do it', 'yes'] },
    { action: 'cancel', phrases: ['cancel', 'stop', 'no'] },
    { action: 'read-screen', phrases: ['read this', 'read the screen', 'describe'] },
  ];
}

// 51929 — Command discovery: suggest commands from usage habits.
export function suggestCommands(usageHistory, limit = 3) {
  const counts = {};
  (Array.isArray(usageHistory) ? usageHistory : []).forEach((c) => {
    counts[c] = (counts[c] || 0) + 1;
  });
  const related = { 'pause hunt': ['resume hunt', 'hunt status'], 'take snapshot': ['export findings', 'hunt status'],
    'hunt status': ['pause hunt', 'take snapshot'], 'resume hunt': ['pause hunt', 'hunt status'] };
  const scored = {};
  Object.keys(counts).forEach((cmd) => {
    (related[cmd] || []).forEach((s) => { scored[s] = (scored[s] || 0) + counts[cmd]; });
  });
  return Object.entries(scored)
    .filter(([s]) => !counts[s])
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([s]) => s);
}

// 51930 — Feedback collection: "was that command right?" tallies yes/no corrections.
export function recordVoiceFeedback(feedbackLog, command, wasRight) {
  const entry = { ts: new Date().toISOString(), command: String(command || ''), wasRight: Boolean(wasRight) };
  const log = [...(Array.isArray(feedbackLog) ? feedbackLog : []), entry];
  const relevant = log.filter((f) => f.command === entry.command);
  const accuracy = relevant.length ? relevant.filter((f) => f.wasRight).length / relevant.length : 1;
  return { log, accuracy: Math.round(accuracy * 100) / 100 };
}

// 51931 — Emergency stop phrase: exact kill phrase halts everything.
const KILL_PHRASES = ['stop everything now', 'kill the hunt', 'emergency stop'];
export function matchEmergencyStop(transcript) {
  const normalized = String(transcript || '').trim().toLowerCase();
  const hit = KILL_PHRASES.find((k) => normalized.includes(k));
  return hit ? { triggered: true, phrase: hit, halt: ['recognition', 'hunt', 'timers'] } : { triggered: false };
}

// 51932 — Whisper mode: low-energy speech boosts gain and shrinks vocabulary.
export function applyWhisperMode(energyLevel) {
  const whisper = Number(energyLevel) < 0.25;
  return whisper
    ? { whisper: true, gainDb: 15, vocabulary: 'short commands only', confirmEach: true }
    : { whisper: false, gainDb: 0, vocabulary: 'full', confirmEach: false };
}

// 51933 — Phone-call control interface: DTMF/spoken menu for call-based control.
export function buildPhoneCallMenu() {
  return [
    { key: '1', spoken: 'status', action: 'read hunt status aloud' },
    { key: '2', spoken: 'pause', action: 'pause the hunt' },
    { key: '3', spoken: 'resume', action: 'resume the hunt' },
    { key: '4', spoken: 'findings', action: 'read the latest findings aloud' },
  ];
}

// 51934 — Smart-speaker integration: intent strings for home speakers.
export function buildSmartSpeakerIntents() {
  return [
    { intent: 'ask Dark-Matter for hunt status', slots: [], response: 'status-summary' },
    { intent: 'ask Dark-Matter for new findings', slots: [], response: 'latest-findings' },
    { intent: 'ask Dark-Matter to pause the hunt', slots: [], response: 'pause-ack' },
  ];
}

// 51935 — Car mode: driver-safe minimal interface.
export function buildCarModeCommands() {
  return ['hunt status', 'pause the hunt', 'resume the hunt', 'read new findings', 'stop everything now'];
}

// 51936 — Meeting mode: discreet status updates (vibration-length coded, text only).
export function buildMeetingModeUpdate(hunt) {
  const h = hunt || {};
  const line = `${h.name || 'Hunt'}: ${h.status || 'running'}, ${h.findingsCount || 0} findings, ETA ${h.eta || '—'}.`;
  return { discreetText: line, readAloud: false, vibration: h.status === 'paused' ? 'long' : 'short' };
}

// 51937 — Command analytics: usage ranking from a command log.
export function rankVoiceCommands(commandLog) {
  const counts = {};
  (Array.isArray(commandLog) ? commandLog : []).forEach((c) => { counts[c] = (counts[c] || 0) + 1; });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([command, count]) => ({ command, count }));
}

// 51938 — Latency display: recognition + execution delay breakdown.
export function computeVoiceLatency(recognizedAt, startedAt, executedAt) {
  const r = Number(recognizedAt); const s = Number(startedAt); const e = Number(executedAt);
  const recognitionMs = Number.isFinite(r) && Number.isFinite(s) ? Math.max(0, s - r) : 0;
  const executionMs = Number.isFinite(s) && Number.isFinite(e) ? Math.max(0, e - s) : 0;
  return { recognitionMs, executionMs, totalMs: recognitionMs + executionMs };
}

// 51939 — Text fallback: every voice command ships a typed equivalent.
export function voiceToTextFallback(transcript) {
  const text = String(transcript || '').trim();
  return { typed: text, usable: text.length > 0, hint: text.length ? 'press Enter to run' : 'type a command first' };
}

// 51940 — Bilingual commands: normalize Hindi/English mixed input.
const HINDI_COMMAND_WORDS = { roko: 'pause', ruk: 'pause', shuru: 'start', chalu: 'resume', bund: 'stop',
  sthiti: 'status', khoj: 'findings', raporṭ: 'report', report: 'report', tasveer: 'snapshot' };
export function normalizeBilingualCommand(transcript) {
  const normalized = String(transcript || '').toLowerCase().split(/\s+/).map((w) => HINDI_COMMAND_WORDS[w] || w).join(' ');
  const detected = /[\u0900-\u097F]/.test(transcript) || Object.keys(HINDI_COMMAND_WORDS).some((w) => String(transcript || '').toLowerCase().includes(w));
  return { normalized: normalized.trim(), language: detected ? 'hindi-english-mix' : 'english' };
}

// 51941 — Voice finding triage: "mark that as false positive" builds the triage action.
export function buildTriageAction(transcript, findingId) {
  const text = String(transcript || '').toLowerCase();
  const verdict = /false positive/.test(text) ? 'false-positive' : /true positive/.test(text) ? 'true-positive' : /duplicate/.test(text) ? 'duplicate' : 'needs-review';
  return { findingId: findingId || null, verdict, source: 'voice' };
}

// 51942 — Approval delegation by voice: "let Priya approve the next request".
export function parseDelegationCommand(transcript) {
  const text = String(transcript || '');
  const nameMatch = text.match(/let\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+approve/i);
  const scopeMatch = text.match(/approve the (next \w+|\w+) request/i);
  return {
    delegate: nameMatch ? nameMatch[1] : null,
    scope: scopeMatch ? scopeMatch[1].toLowerCase() : 'next request',
    valid: Boolean(nameMatch),
  };
}

// 51943 — Hunt creation by voice: "start a hunt on example.com".
export function parseHuntCreationCommand(transcript) {
  const text = String(transcript || '');
  const targetMatch = text.match(/(?:on|against|for)\s+([a-z0-9.-]+\.[a-z]{2,})/i);
  const target = targetMatch ? targetMatch[1].toLowerCase() : null;
  return { target, valid: Boolean(target), intent: 'create-hunt', confirmBeforeStart: true };
}

// 51944 — Report narration: read the draft report section by section.
export function buildNarrationScript(reportSections) {
  const sections = Array.isArray(reportSections) ? reportSections : [];
  return sections.map((s, i) => ({
    section: i + 1,
    heading: s && s.heading ? String(s.heading) : `Section ${i + 1}`,
    spoken: `${s && s.heading ? s.heading : `Section ${i + 1}`}. ${s && s.summary ? s.summary : ''}`.trim(),
  }));
}

// 51945 — Voice Q&A on logs: "why did that test fail?" answered from a log array.
export function answerLogQuestion(logs, question) {
  const q = String(question || '').toLowerCase();
  const entries = Array.isArray(logs) ? logs : [];
  const errors = entries.filter((e) => /error|fail|exception/i.test(String(e.message || e)));
  if (/why.*fail|what went wrong|error/.test(q) && errors.length) {
    const last = errors[errors.length - 1];
    return { answer: `The most recent failure: ${last.message || last}.`, sources: errors.length };
  }
  if (/how many/.test(q)) return { answer: `There are ${entries.length} log entries.`, sources: entries.length };
  return { answer: 'I could not find an answer in the logs.', sources: 0 };
}

// 51946 — Confidence checks answered aloud: "how sure are you about that finding?"
export function answerConfidenceQuestion(finding) {
  const f = finding || {};
  const c = Number(f.confidence);
  const pct = Number.isFinite(c) ? Math.round(c * 100) : null;
  const spoken = pct === null
    ? 'No confidence score is recorded for that finding.'
    : `Confidence is ${pct} percent${f.basis ? `, based on ${f.basis}` : ''}.`;
  return { spoken, confidence: pct };
}

// 51947 — Resource queries answered by voice: "how much have we spent?"
export function answerResourceQuery(usage, question) {
  const u = usage || {};
  const q = String(question || '').toLowerCase();
  if (/spend|cost|budget/.test(q)) return { spoken: `Spend so far: $${Number(u.spend || 0).toFixed(2)} of a $${Number(u.budget || 0).toFixed(2)} budget.` };
  if (/time|how long/.test(q)) return { spoken: `Elapsed run time: ${u.elapsedMinutes || 0} minutes.` };
  if (/request|api/.test(q)) return { spoken: `${u.apiCalls || 0} API calls made.` };
  return { spoken: 'Resource summary is not available for that question.' };
}

// 51948 — Team coordination: voice messages attached to hunt events.
export function attachVoiceMessage(events, eventId, message) {
  const list = Array.isArray(events) ? events : [];
  const attached = list.map((e) => (e && e.id === eventId
    ? { ...e, voiceMessages: [...(e.voiceMessages || []), { ts: new Date().toISOString(), message: String(message || '') }] }
    : e));
  return { events: attached, attachedTo: eventId };
}

// 51949 — Command sandbox: practice on a simulated practice hunt, never the real one.
export function sandboxCommand(command) {
  return {
    command: String(command || ''),
    executedOn: 'practice-hunt-sandbox',
    realHuntTouched: false,
    result: 'practice-mode — no real hunt state changed',
  };
}

// 51950 — Privacy mode: sensitive readouts rerouted to text.
const SENSITIVE_HINTS = ['token', 'secret', 'password', 'api key', 'credential'];
export function routePrivacyOutput(text) {
  const t = String(text || '');
  const sensitive = SENSITIVE_HINTS.some((h) => t.toLowerCase().includes(h));
  return { channel: sensitive ? 'text' : 'speaker', text: t, reason: sensitive ? 'sensitive content detected' : 'safe to read aloud' };
}
