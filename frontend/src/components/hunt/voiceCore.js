/**
 * Infinity AI — Wave 48 (ideas 51896–51920): voice control pure logic.
 * Command parsing, spoken-answer generation, transcript logging, confirmations,
 * shortcuts, error recovery, language detection, push-to-talk config,
 * wake-word config, voice profiles. Pure functions only: no mic, no TTS side
 * effects here — outputs are text payloads the existing Infinity Voice TTS
 * layer speaks (see AGENTS.md Infinity Voice section).
 *
 * Part of: Infinity AI / Dark-Matter frontend (hunt operations).
 */
export const WAVE48_VOICE_IDEAS = [
  51896, 51897, 51898, 51899, 51900, 51901, 51902, 51903, 51904, 51905, 51906, 51907, 51908, 51909,
  51910, 51911, 51912, 51913, 51914, 51915, 51916, 51917, 51918, 51919, 51920,
];

const clampStr = v => (typeof v === 'string' ? v : '');
const clampArr = v => (Array.isArray(v) ? v : []);
const clampNum = (v, d = 0) => (Number.isFinite(v) ? v : d);

// ---- 51896: Voice pause/resume — "pause the hunt" / "resume" hands-free ----
export function parsePauseResume(transcript) {
  const t = clampStr(transcript).toLowerCase().trim();
  if (/^(pause|hold|stop)( the)? ?(hunts?|everything)?$/.test(t)) {
    return {
      action: 'pause',
      scope: t.includes('everything') || t.includes('hunts') ? 'all' : 'current',
    };
  }
  if (/^(resume|continue|unpause)( the)? ?(hunts?|everything)?$/.test(t)) {
    return {
      action: 'resume',
      scope: t.includes('everything') || t.includes('hunts') ? 'all' : 'current',
    };
  }
  return { action: 'unknown', heard: t };
}

// ---- 51897: Voice status queries — "what are you doing?" answered aloud ----
export function statusAnswer(hunt) {
  if (!hunt) return 'No hunt is currently active.';
  const name = clampStr(hunt.name) || 'the hunt';
  const status = clampStr(hunt.status) || 'running';
  const findings = clampArr(hunt.findings).length;
  return `I am ${status === 'running' ? 'scanning' : status} ${name}. ${findings} findings so far.`;
}

// ---- 51898: Voice steering — "focus on the API now" redirects the hunt ----
export function parseSteering(transcript) {
  const t = clampStr(transcript).toLowerCase().trim();
  const m = /^(focus on|switch to|prioritize|target) (.+?)( now| please)?$/.exec(t);
  if (!m) return { ok: false, heard: t };
  return { ok: true, focus: m[2].trim(), heard: t };
}

// ---- 51899: Spoken approval decisions — approve/deny with voice verification ----
export function spokenApproval(transcript, profile) {
  const t = clampStr(transcript).toLowerCase().trim();
  const decision = /^(approve|yes|allow|go ahead)/.test(t)
    ? 'approve'
    : /^(deny|no|reject|block)/.test(t)
      ? 'deny'
      : 'unknown';
  const verified = !!(
    profile &&
    profile.enrolled &&
    clampStr(profile.speakerId) === clampStr(profile.matchedSpeakerId)
  );
  return { decision, verified, authorized: decision !== 'unknown' && verified };
}

// ---- 51900: Dictated test commands — "try SQLi on the login form" ----
const TEST_CATALOG = ['sqli', 'xss', 'ssrf', 'idor', 'csrf', 'lfi', 'rce', 'open-redirect'];
export function parseTestCommand(transcript) {
  const t = clampStr(transcript).toLowerCase().trim();
  const m = /^(try|test|run|check) (.+?)( on| against| in) (.+)$/.exec(t);
  if (!m) return { ok: false, heard: t };
  const technique = m[2].trim();
  const target = m[4].trim();
  const matched = TEST_CATALOG.find(c =>
    technique.replace(/[^a-z]/g, '').includes(c.replace('-', ''))
  );
  return { ok: true, technique, techniqueId: matched || 'custom', target, heard: t };
}

// ---- 51901: Voice finding briefings — "read me the new criticals" ----
export function findingBriefing(findings, { severity = 'critical' } = {}) {
  const list = clampArr(findings).filter(
    f => clampStr(f && f.severity).toLowerCase() === severity.toLowerCase()
  );
  if (list.length === 0) return `No ${severity} findings.`;
  const top = list
    .slice(0, 3)
    .map(f => clampStr(f && f.title))
    .filter(Boolean)
    .join('; ');
  return `${list.length} ${severity} finding${list.length === 1 ? '' : 's'}. Top: ${top}.`;
}

// ---- 51902: Voice strategy changes — "switch to depth mode" ----
const STRATEGIES = ['depth', 'breadth', 'stealth', 'fast', 'thorough'];
export function parseStrategyChange(transcript) {
  const t = clampStr(transcript).toLowerCase().trim();
  const m = /^(switch to|use|enable) (.+?)( mode| strategy)?$/.exec(t);
  if (!m) return { ok: false, heard: t };
  const want = m[2].trim();
  const hit = STRATEGIES.find(s => want.includes(s));
  return hit
    ? { ok: true, strategy: hit, heard: t }
    : { ok: false, heard: t, error: `unknown strategy "${want}"` };
}

// ---- 51903: Voice ETA checks — "how much longer?" ----
export function etaAnswer(hunt, nowMs = Date.now()) {
  if (!hunt || !clampNum(hunt.etaMs, 0)) return 'No ETA estimate available.';
  const ms = clampNum(hunt.etaMs) - nowMs;
  if (ms <= 0) return 'The hunt should be finished any moment now.';
  const min = Math.round(ms / 60000);
  return min < 60
    ? `About ${min} minute${min === 1 ? '' : 's'} remaining.`
    : `About ${Math.round(min / 60)} hour${Math.round(min / 60) === 1 ? '' : 's'} remaining.`;
}

// ---- 51904: Voice language choice — Hindi / English / Hinglish ----
export function detectLanguage(transcript) {
  const t = clampStr(transcript);
  const devanagari = (t.match(/[ऀ-ॿ]/g) || []).length;
  const latin = (t.match(/[a-zA-Z]/g) || []).length;
  if (devanagari > 0 && latin > devanagari) return 'hinglish';
  if (devanagari > 0) return 'hi';
  return 'en';
}

// ---- 51905: Push-to-talk control ----
export function pushToTalkSession({ key = 'Space', mode = 'hold' } = {}) {
  return {
    active: true,
    key,
    mode: mode === 'toggle' ? 'toggle' : 'hold',
    startedAt: Date.now(),
  };
}

// ---- 51906: Always-listening mode — wake-word config ----
export function wakeWordConfig(words = ['hey infinity']) {
  const list = clampArr(words).map(clampStr).filter(Boolean);
  return { enabled: list.length > 0, wakeWords: list.length ? list : ['hey infinity'] };
}

export function isWakeWord(transcript, config) {
  const t = clampStr(transcript).toLowerCase();
  return clampArr(config && config.wakeWords).some(w => t.includes(clampStr(w).toLowerCase()));
}

// ---- 51907: Voice command history — every command logged with transcript ----
export function logVoiceCommand(history, entry) {
  const rows = clampArr(history);
  const record = {
    id: `vc-${Date.now()}-${rows.length}`,
    ts: Date.now(),
    transcript: clampStr(entry && entry.transcript),
    intent: clampStr(entry && entry.intent),
    result: clampStr(entry && entry.result),
    language: detectLanguage(entry && entry.transcript),
  };
  return [...rows, record].slice(-500);
}

export function searchCommandHistory(history, query) {
  const q = clampStr(query).toLowerCase();
  return clampArr(history).filter(e => clampStr(e.transcript).toLowerCase().includes(q));
}

// ---- 51908: Voice confirmation — repeat back risky commands ----
const RISKY = ['delete', 'merge', 'pause all', 'resume all', 'approve', 'deny', 'stop everything'];
export function confirmationPrompt(command) {
  const c = clampStr(command).toLowerCase();
  const risky = RISKY.some(r => c.includes(r));
  if (!risky) return { needsConfirmation: false, text: '' };
  return {
    needsConfirmation: true,
    text: `Just to confirm: you want me to "${clampStr(command)}". Say yes to proceed, or no to cancel.`,
  };
}

// ---- 51909: Voice shortcuts — custom phrases to command sequences ----
export function resolveVoiceShortcut(phrase, shortcuts) {
  const p = clampStr(phrase).toLowerCase().trim();
  const hit = clampArr(shortcuts).find(s => clampStr(s && s.phrase).toLowerCase() === p);
  return hit
    ? { ok: true, phrase: p, commands: clampArr(hit.commands) }
    : { ok: false, phrase: p, error: 'no shortcut registered for that phrase' };
}

export function registerVoiceShortcut(shortcuts, phrase, commands) {
  const rows = clampArr(shortcuts).filter(
    s => clampStr(s && s.phrase).toLowerCase() !== clampStr(phrase).toLowerCase()
  );
  return [...rows, { phrase: clampStr(phrase), commands: clampArr(commands) }];
}

// ---- 51910: Voice feedback tones — audio confirmation descriptors ----
export function feedbackTone(outcome) {
  const o = clampStr(outcome).toLowerCase();
  if (o === 'accepted') return { tone: 'confirm', freq: 880, ms: 120 };
  if (o === 'rejected') return { tone: 'error', freq: 220, ms: 200 };
  if (o === 'processing') return { tone: 'working', freq: 660, ms: 90 };
  return { tone: 'neutral', freq: 440, ms: 100 };
}

// ---- 51911: Voice error recovery — suggestions instead of silence ----
export function errorRecovery(transcript, candidates) {
  const t = clampStr(transcript).toLowerCase().trim();
  const list = clampArr(candidates).map(clampStr);
  const suggestions = list
    .map(c => ({ cmd: c, score: sharedPrefixLen(t, c.toLowerCase()) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(s => s.cmd);
  return {
    heard: t,
    text: t
      ? `I didn't catch that. Did you mean: ${suggestions.join(', ')}?`
      : `I didn't hear anything. Try saying: ${suggestions.join(', ')}.`,
    suggestions,
  };
}
function sharedPrefixLen(a, b) {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
}

// ---- 51912: Voice command help — "what can I say?" ----
export function voiceHelpList() {
  return [
    'pause the hunt',
    'resume the hunt',
    'what are you doing?',
    'focus on the API',
    'read me the new criticals',
    'how much longer?',
    'switch to depth mode',
    'take a report snapshot',
    'explain that finding simply',
    'switch to the client X hunt',
    'what can I say?',
  ];
}
export function voiceHelpText() {
  return `You can say: ${voiceHelpList().join('; ')}.`;
}

// ---- 51913: Voice multi-hunt switching — "switch to the client X hunt" ----
export function parseMultiHuntSwitch(transcript, hunts) {
  const t = clampStr(transcript).toLowerCase().trim();
  const m = /^switch to (the )?(.+?)( hunt)?$/.exec(t);
  if (!m) return { ok: false, heard: t };
  const want = m[2].trim().replace(/^client\s+/, '');
  const hit = clampArr(hunts).find(
    h =>
      clampStr(h && h.client)
        .toLowerCase()
        .includes(want) ||
      clampStr(h && h.name)
        .toLowerCase()
        .includes(want)
  );
  return hit
    ? { ok: true, huntId: clampStr(hit.id || hit.huntId), heard: t }
    : { ok: false, heard: t, error: `no hunt matches "${want}"` };
}

// ---- 51914: Voice snapshot requests — "take a report snapshot" ----
export function parseSnapshotRequest(transcript) {
  const t = clampStr(transcript).toLowerCase().trim();
  if (/take (a )?(report )?snapshot/.test(t)) {
    return {
      ok: true,
      snapshot: { ts: Date.now(), kind: t.includes('report') ? 'report' : 'state' },
      heard: t,
    };
  }
  return { ok: false, heard: t };
}

// ---- 51915: Voice explanation requests — "explain that finding simply" ----
export function parseExplanationRequest(transcript, findings) {
  const t = clampStr(transcript).toLowerCase().trim();
  const m = /^explain (.+?)( simply| in simple terms| like i am five)?$/.exec(t);
  if (!m) return { ok: false, heard: t };
  const want = m[1].replace(/^that |^the /, '').trim();
  const hit = clampArr(findings).find(f =>
    clampStr(f && f.title)
      .toLowerCase()
      .includes(want)
  );
  return {
    ok: !!hit,
    heard: t,
    findingId: hit ? clampStr(hit.id) : null,
    level: m[2] ? 'simple' : 'standard',
  };
}

// ---- 51916: Voice note dictation — notes attach to the hunt record ----
export function dictateNote(transcript, huntId) {
  const text = clampStr(transcript).trim();
  if (!text) return { ok: false, error: 'empty dictation' };
  return {
    ok: true,
    note: { id: `note-${Date.now()}`, ts: Date.now(), huntId: clampStr(huntId), text },
  };
}

// ---- 51917: Voice chat mode — conversational interaction ----
export function voiceChatTurn(transcript, context) {
  const t = clampStr(transcript).toLowerCase().trim();
  if (/^(hi|hello|hey)/.test(t)) return { reply: 'Hello. I am listening.', end: false };
  if (/bye|goodbye|stop listening/.test(t))
    return { reply: 'Voice chat off. Say the wake word to resume.', end: true };
  const status = statusAnswer(context && context.hunt);
  return { reply: `Heard: "${clampStr(transcript).trim()}". ${status}`, end: false };
}

// ---- 51918: Voice interruption — barge-in handling ----
export function interruptionSignal(event) {
  const e = clampStr(event && event.type);
  if (e !== 'barge-in') return { interrupted: false };
  return {
    interrupted: true,
    action: 'stop-speaking',
    resume: 'listen-immediately',
    at: Date.now(),
  };
}

// ---- 51919: Voice volume ducking — alerts lower while user speaks ----
export function duckingPolicy(speaking) {
  return {
    speaking: !!speaking,
    alertVolume: speaking ? 0.2 : 1.0,
    ttsVolume: 1.0,
    reason: speaking ? 'user is speaking' : 'idle',
  };
}

// ---- 51920: Voice profiles — authorized voices for sensitive commands ----
export function verifyVoiceProfile(sample, profiles) {
  const list = clampArr(profiles);
  const id = clampStr(sample && sample.speakerId);
  const hit = list.find(p => clampStr(p && p.speakerId) === id && p && p.enrolled);
  return {
    recognized: !!hit,
    speakerId: id || null,
    name: hit ? clampStr(hit.name) : null,
    sensitiveCommandsAllowed: !!hit && !!hit.allowSensitive,
  };
}

export function enrollVoiceProfile(profiles, { speakerId, name, allowSensitive = false }) {
  const list = clampArr(profiles).filter(p => clampStr(p && p.speakerId) !== clampStr(speakerId));
  return [
    ...list,
    {
      speakerId: clampStr(speakerId),
      name: clampStr(name),
      enrolled: true,
      allowSensitive: !!allowSensitive,
      enrolledAt: Date.now(),
    },
  ];
}
