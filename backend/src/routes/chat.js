// Mid-hunt chat — with REAL AI thinking (not hardcoded).
//
//   POST /api/v1/chat {message, huntId?} -> {reply}
//
// Steering (pause/resume/stop) stays DETERMINISTIC — rule-based, never
// depends on an LLM's mood. Everything else goes to the real AI
// (AWS Bedrock via Plugins) with rich hunt context: live status, findings,
// exploit chains, and recent thinking. If no AI is configured, the endpoint
// answers honestly instead of hallucinating.

import { Router } from 'express';
import {
  EngineUnreachableError,
  EngineError,
  getEngineHunt,
  getEngineEvents,
  pauseEngineHunt,
  resumeEngineHunt,
  stopEngineHunt,
} from '../engine.js';
import { readHuntEvents, readHuntMeta, writeHuntMeta, appendHuntEvent } from '../store.js';
import { recordEngineEvent } from './hunts.js';
import { requireAuth } from './auth.js';
import { getBalanceCents } from '../billing/credits.js';
import { hasActiveAccessById } from '../access.js';
import { runAutonomousHunt, iterationPriceCents } from '../huntAgent.js';
import { isInferenceActive } from '../llm.js';
import { callChatMeta, metaAvailable } from '../brainProvider.js';
// P0 (31 Oct 2026): probe/test names are never confirmed findings.
import { isProbeNameTitle } from '../claimTitleGuard.js';
import { analyzeFindings } from '../hunt-intel/index.js';
import { loadHuntMemory, normTitle, findingCounts, isErrorPageFinding } from '../huntMemory.js';
import { pageUrlFromObservation } from '../humanLoop.js';
import {
  queueChatQuestion,
  pendingChatQuestions,
  busyAck,
  queueFullLine,
} from '../chatQueue.js';

/**
 * The confirmed findings of a hunt, as UNIQUE titles. Findings must
 * come from huntMemory.loadHuntMemory — the single read path, which
 * removes stamps a later retraction event withdrew. Counting raw
 * finding events here (the pre-Lane-P code) told the owner "2
 * confirmed" for the Ezviz FTP stamps that had been RETRACTED as
 * false positives, while the hunt panel showed 0 confirmed — a
 * 100%-truth-rule violation found by the owner's live browser QA
 * (23 Oct 2026). Duplicate stamps of one title are one vulnerability.
 */
export function confirmedTitles(findings) {
  const seen = new Map();
  for (const f of findings || []) {
    if (!f || !f.verified) continue;
    // P0 (31 Oct 2026): probe/test names are never confirmed findings,
    // even if stamped verified:true.
    try {
      if (isProbeNameTitle(f.title)) continue;
    } catch { /* probe check is best-effort */ }
    // LIVE REPORT (27 Oct 2026, feat/live-report-fix): a stamp
    // whose evidence is an HTTP error page is demoted read-time
    // everywhere else (panelFindings, the brain's VERIFIED list) —
    // but this count read f.verified raw, so the deterministic
    // summary path still told the owner "5 confirmed
    // vulnerabilities" for the 404-stamped DVWA findings. Same
    // demotion here: an error-page stamp is never confirmed.
    if (isErrorPageFinding(f)) continue;
    const raw = f.title || f.type || 'finding';
    const key = normTitle(raw);
    if (!seen.has(key)) seen.set(key, raw);
  }
  return [...seen.values()];
}

/**
 * Clip text at a CLEAN boundary (Lane S, 23 Oct 2026). The old raw
 * slice(0, 200) cut the "Currently:" thinking quote mid-word in a
 * live reply ("...sensitive in the FTP direct" — defect found by the
 * owner's frontend test battery). When the text fits, it is returned
 * unchanged (whitespace-normalised); when it must be cut, prefer the
 * last sentence end inside the budget, else the last word boundary,
 * and mark the cut with an ellipsis so it never looks like the
 * hunter simply stopped mid-thought.
 */
export function clipClean(text, max = 200) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const floor = Math.floor(max * 0.4);
  const sent = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  if (sent >= floor) return cut.slice(0, sent + 1) + ' …';
  const word = cut.lastIndexOf(' ');
  if (word >= floor) return cut.slice(0, word) + '…';
  return cut + '…';
}

// ---------------------------------------------------------------------------
// Off-topic guard for hunt-scoped chat (Lane S, 23 Oct 2026).
//
// Owner requirement: a hunt's chat answers ONLY hunt-related things.
// Before this lane, anything that was not steering/summary fell to
// the shared-model LLM path — an off-topic question ("quicksort ka
// code likh ke do aur ek joke suna do") sat ~8.5 minutes in
// "Stop generating" behind the hunt's own generations and would
// eventually have been answered. The guard is DETERMINISTIC and runs
// BEFORE any LLM call, so the decline is instant and never hostage
// to the brain queue.
//
// Conservative by design: a message is off-topic only when it matches
// a clear non-hunt request pattern AND carries no hunt anchor. When
// uncertain, it falls through to the existing paths untouched — a
// false decline of a real hunt question is worse than a missed
// off-topic, because the LLM path is hunt-scoped by its system
// prompt anyway.
// ---------------------------------------------------------------------------

const HUNT_ANCHOR_PATTERNS = [
  /\bhunt(ing|er)?\b/, /\bscan(ning)?\b/, /\btarget\b/, /finding/,
  /vulnerab/, /progress/, /\bstatus\b/, /\breport\b/, /attack/,
  /exploit/, /payload/, /inject/, /\bxss\b/, /\bsql\b/, /\bftp\b/,
  /\blogin\b/, /\badmin\b/, /password/, /\bbug\b/, /bounty/, /securit/,
  /\bprobe/, /\bupdate\b/, /\bthis (site|app|hunt|target)\b/,
  /\bthe (site|target|app)\b/, /try kiy/, /kya mila/, /kuch mila/,
  /koi (news|khabar|update)/, /(kar|chal|ho) rah(a|i|e)\b/,
];

const OFF_TOPIC_PATTERNS = [
  /\bjoke(s)?\b/, /\bpoem\b/, /\bpoetry\b/, /\bshayari\b/, /\bsong\b/,
  /\bgaana\b/, /\bstory\b/, /\bkahani\b/,
  /\bweather\b/, /\bmausam\b/, /\bnews\b/, /\bsamachar\b/,
  /\brecipe\b/, /khana (bana|pakana)/,
  /\btranslate\b/, /\btranslation\b/, /\banuvaad\b/,
  /\bcapital of\b/, /who (is|was) the (president|prime minister|king|queen)/,
  /\b(president|prime minister) of\b/,
  /\bquadratic equation\b/, /\bfibonacci\b/, /\bquicksort\b/, /\bmergesort\b/,
  /(write|generate|create|give|show|likh|bana|solve|explain)\b[^.?!]{0,60}\b(code|program|function|script|algorithm)\b/,
  /\bcode\b[^.?!]{0,30}\b(likh|write|generate|bana|do|de)\b/,
];

export function isOffTopicHuntChat(message, { host = '' } = {}) {
  const raw = String(message || '');
  if (!raw.trim()) return false;
  // Steering and status questions are hunt business by definition.
  if (detectSteering(raw)) return false;
  const m = ` ${raw.toLowerCase().replace(/\s+/g, ' ')} `;
  if (host && m.includes(String(host).toLowerCase())) return false;
  if (HUNT_ANCHOR_PATTERNS.some((re) => re.test(m))) return false;
  return OFF_TOPIC_PATTERNS.some((re) => re.test(m));
}

const HINGLISH_MARKERS = [
  'mujhe', 'kya', 'hai', 'hain', 'batao', 'sunao', 'suna', 'karo',
  'likh', 'aur', 'yeh', 'woh', 'matlab', 'abhi', 'kuch', 'koi',
  'kab', 'kyun', 'kyu', 'raha', 'rahi', 'rahe', 'nahi', 'mausam',
  'kaisa', 'kaisi', 'mera', 'meri', 'tumne', 'kiya',
  // CHAT-ANSWERS (26 Oct 2026): the owner's status-question vocabulary
  // was missing, so short Roman-Hindi questions ("kitni mili ab tak?",
  // "bata fir jau sone?") detected as English and got English
  // summaries. These are unambiguous Hindi words — they never appear
  // in an English sentence.
  'kitni', 'kitne', 'mili', 'mile', 'mila', 'tak', 'bata', 'batao',
  'pahunche', 'kahan', 'fir', 'jau', 'jaun', 'sone', 'chal', 'ho',
  'kar', 'chahiye', 'bhai',
];

export function looksHinglish(message) {
  const raw = String(message || '');
  if (/[\u0900-\u097F]/.test(raw)) return true;
  const words = new Set(raw.toLowerCase().match(/[a-z]+/g) || []);
  let hits = 0;
  for (const marker of HINGLISH_MARKERS) if (words.has(marker)) hits++;
  return hits >= 2;
}

// CHAT-ANSWERS (26 Oct 2026): the language + script of a message, so
// replies come back the way the user asked — Hindi in Devanagari gets
// Devanagari, Roman Hindi gets Roman Hindi, English gets English.
// Devanagari detection is a script test (no case to fold); Hinglish is
// the existing marker test above. Anything else is English.
export function detectChatLanguage(message) {
  const raw = String(message || '');
  if (/[\u0900-\u097F]/.test(raw)) return 'devanagari';
  if (looksHinglish(raw)) return 'hinglish';
  return 'english';
}

// CHAT-ANSWERS (26 Oct 2026): a bare "tell me" — the message IS
// essentially just that word (optionally a filler particle and trailing
// punctuation), in either script. A longer message that merely CONTAINS
// bata ("bata fir jau sone?" — "tell me, should I go to sleep?") is a
// real question and must NOT be misrouted to the status summary the way
// the old unanchored `bata|batao` pattern did (live evidence 25 Oct
// 2026: the owner asked whether the agent had a question for him and
// got a status summary instead).
export function isBareTell(message) {
  const m = String(message || '')
    .trim()
    .toLowerCase()
    .replace(/[?.!…\s]+$/g, '')
    .trim();
  return /^(bata|batao|बता|बताओ)(\s+(na|to|zara|please))?$/.test(m);
}

// CHAT-ANSWERS (26 Oct 2026): sanitise conversation history the
// frontend sends with a chat request — role + text only, last 6,
// each text capped. Anything malformed is dropped, never trusted.
export function sanitizeHistory(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  for (const item of input.slice(-6)) {
    if (!item || typeof item.text !== 'string') continue;
    const role = item.role === 'assistant' ? 'assistant' : 'user';
    const text = item.text.slice(0, 1000);
    if (text.trim()) out.push({ role, text });
  }
  return out;
}

// CHAT-ANSWERS (26 Oct 2026): the honest one-liners that prefix a
// deterministic summary when the detailed LLM answer cannot be
// produced — the brain is mid-turn (busy) or unreachable (fallback).
// The summary that follows is labelled as the live state, never
// presented as the LLM's answer.
const BUSY_LINE = {
  english: 'The brain is mid-turn right now, so a detailed answer has to wait — here is the live state instead: ',
  hinglish: 'Brain abhi ek turn ke beech mein hai, isliye detailed jawab thoda rukega — live state ye hai: ',
  devanagari: 'Brain अभी एक turn के बीच में है, इसलिए detailed जवाब थोड़ा रुकेगा — live state ये है: ',
};
const FALLBACK_LINE = {
  english: "I couldn't reach the brain for a detailed answer — here is the live state from the record: ",
  hinglish: 'Brain se detailed jawab nahi mil paya — record se live state ye hai: ',
  devanagari: 'Brain से detailed जवाब नहीं मिल पाया — record से live state ये है: ',
};

export function busyLine(lang) {
  return BUSY_LINE[lang] || BUSY_LINE.english;
}

export function fallbackLine(lang) {
  return FALLBACK_LINE[lang] || FALLBACK_LINE.english;
}

// REAL-HUMAN (26 Oct 2026): the honest acknowledgement for a
// queued thinking question, built from the last reasoning row —
// what the brain actually did last, where, and how long ago.
// Pure (testable without the route): the route supplies the
// hunt's reasoning rows and the user's language, and gets back
// the 1–2 sentence ack — never the summary shape.
export function ackTextForHunt({ reasoningRows = [], lang = 'english', pendingCount = 1 } = {}) {
  const rows = reasoningRows || [];
  const lastRow = rows.length ? rows[rows.length - 1] : null;
  let doing = '';
  let page = '';
  let age = '';
  if (lastRow) {
    const actionText = clipClean(String(lastRow.action || 'turn'), 90);
    const resultText = clipClean(String(lastRow.result || '').split(/\r?\n/)[0], 140) || '—';
    doing = `${actionText} — ${resultText}`;
    page = pageUrlFromObservation(lastRow.result || '') || '';
    age = relativeAge(lastRow.at, lang);
  }
  return busyAck({ lang, doing, page, age, pendingCount });
}

export function offTopicDecline(message) {
  if (looksHinglish(message)) {
    return (
      'Is chat mein main sirf is hunt ki baat kar sakta hoon — ye kaam main yahan nahi kar sakta. ' +
      'Progress, findings, ya abhi main kya try kar raha hoon — ye poochho, turant jawab dunga; ' +
      'hunt rokna ya chalana ho to "pause the hunt" ya "resume the hunt" keh do.'
    );
  }
  return (
    "This chat is only for this hunt, so I can't help with that here. " +
    "Ask me about progress, findings, or what I'm trying right now and I'll answer right away — " +
    "or say 'pause the hunt' / 'resume the hunt' to steer it."
  );
}

// ---------------------------------------------------------------------------
// Recent-attempts narration (Lane S, 23 Oct 2026). The deterministic
// summary answered counts and titles but never WHAT THE HUNTER TRIED —
// asked "Abhi tak tumne kya kya try kiya hai aur FTP par kya mila?" it
// had nothing to say about the ftp/curl/browser attempts sitting in
// its own record. The narration is built from the hunt's real record:
// the last tool_call events, each paired with the one-line outcome
// from the matching reasoning row (reasoning rows record
// "tool: detail" as their action and the observation as their
// result). No matching row -> the attempt is stated without an
// outcome; nothing is invented.
// ---------------------------------------------------------------------------

function commonPrefixLen(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i;
}

function eventTs(e) {
  return (e && (e.cachedAt || e.at || e.timestamp)) || '';
}

/**
 * The outcome of one tool_call, from its reasoning row. A row is a
 * candidate when its action names the same tool and its detail
 * shares a real prefix with the call's detail (the two records slice
 * details at different caps, so exact equality is too strict; an
 * empty detail on either side also matches — e.g. browser_type
 * records none). Candidates are disambiguated by TIME: turns are
 * strictly sequential, so a call's row is written after the call was
 * dispatched and before the next call — when timestamps exist on
 * both records, only rows inside that window count. Without stamps,
 * the last candidate wins (best effort on legacy records).
 */
function outcomeForCall(call, nextCall, rows) {
  const tool = String(call.tool || '').toLowerCase();
  const det = String(call.detail || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const from = eventTs(call);
  const to = nextCall ? eventTs(nextCall) : '';
  let bestAny = null;
  let bestWindow = null;
  for (const r of rows || []) {
    if (!r || !r.action) continue;
    const action = String(r.action);
    const sep = action.indexOf(':');
    const rTool = (sep > 0 ? action.slice(0, sep) : action).trim().toLowerCase();
    if (rTool !== tool) continue;
    const rDet = (sep > 0 ? action.slice(sep + 1) : '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (!(!det || !rDet || det === rDet || commonPrefixLen(det, rDet) >= 16)) continue;
    bestAny = r;
    const rt = r.at || '';
    if (from && rt && rt >= from && (!to || rt < to)) bestWindow = r;
  }
  const best = bestWindow || bestAny;
  if (!best || !best.result) return '';
  return clipClean(String(best.result).split(/\r?\n/)[0], 110);
}

export function recentAttempts({ events = [], reasoningRows = [], limit = 5, label = 'Recent attempts' } = {}) {
  const calls = (events || []).filter((e) => e && e.type === 'tool_call' && e.tool);
  if (!calls.length) return '';
  const narrated = calls.map((c, i) => ({
    label: clipClean(`${c.tool} ${c.detail || ''}`, 90),
    outcome: outcomeForCall(c, calls[i + 1] || null, reasoningRows),
  }));
  const parts = [];
  for (const item of narrated.slice(-limit)) {
    // Consecutive identical repeats (same page re-opened) collapse
    // into one entry carrying the latest outcome — the narration
    // stays a readable trail, not a stutter.
    const prev = parts[parts.length - 1];
    if (prev && prev.label === item.label) parts[parts.length - 1] = item;
    else parts.push(item);
  }
  return (
    `${label}: ` +
    parts.map((p) => (p.outcome ? `${p.label} — ${p.outcome}` : p.label)).join('; ') +
    '.'
  );
}

const router = Router();

/**
 * Host-side pause/resume/stop — mirrors the fallback in routes/hunts.js.
 * The PentAGI engine (port 8080) was never set up on this box; hunts run
 * host-side, so steering must drive the same meta flags the agent loop
 * honors. Without this, chat steering returned 502 engine_unreachable.
 */
async function pauseHuntResilient(huntId) {
  try {
    await pauseEngineHunt(huntId);
  } catch (err) {
    if (!(err instanceof EngineUnreachableError)) throw err;
    const m0 = readHuntMeta(huntId) || {};
    writeHuntMeta(huntId, { ...m0, huntId, paused: true, state: 'paused' });
    appendHuntEvent(huntId, { type: 'status', state: 'paused', at: new Date().toISOString() });
  }
}

async function resumeHuntResilient(huntId, user) {
  try {
    await resumeEngineHunt(huntId);
    return;
  } catch (err) {
    // No engine on this box: EngineUnreachableError (fetch failed) OR
    // EngineError 409 ("no checkpoint") — resumeEngineHunt swallows the
    // unreachable error via .catch(() => null) and then throws 409 because
    // the engine never tracked this host-side hunt. Both mean: drive the
    // host-side meta flags instead.
    const noEngine =
      err instanceof EngineUnreachableError || err instanceof EngineError;
    if (!noEngine) throw err;
  }
  const m0 = readHuntMeta(huntId) || {};
  if (['stopped', 'finished', 'failed'].includes(m0.state)) {
    throw new Error(`Hunt is ${m0.state}; cannot resume.`);
  }
  // Wallet resume: a hunt paused for out_of_credits restarts its agent loop
  // (same as POST /api/v1/hunts/:id/resume in routes/hunts.js).
  if (m0.state === 'out_of_credits') {
    const priceCents = iterationPriceCents(m0.mode || 'normal');
    const canPay = (user && user.role === 'admin') || hasActiveAccessById(user.id) || getBalanceCents(user.id) >= priceCents;
    if (!canPay) throw new Error('Top up your balance to resume this hunt.');
    writeHuntMeta(huntId, { ...m0, huntId, state: 'running', paused: false, stopped: false });
    appendHuntEvent(huntId, { type: 'status', state: 'resumed', reason: 'topped_up', at: new Date().toISOString() });
    runAutonomousHunt(huntId, m0.target, m0.mode || 'normal', user.id).catch((e) => {
      appendHuntEvent(huntId, { type: 'status', state: 'failed', error: e.message || String(e) });
    });
    return;
  }
  writeHuntMeta(huntId, { ...m0, huntId, paused: false, stopped: false, state: 'running' });
  appendHuntEvent(huntId, { type: 'status', state: 'resumed', at: new Date().toISOString() });
}

async function stopHuntResilient(huntId) {
  try {
    await stopEngineHunt(huntId);
  } catch (err) {
    if (!(err instanceof EngineUnreachableError)) throw err;
    const m0 = readHuntMeta(huntId) || {};
    writeHuntMeta(huntId, { ...m0, huntId, stopped: true, paused: false, state: 'stopped' });
    appendHuntEvent(huntId, { type: 'status', state: 'stopped', at: new Date().toISOString() });
    const { teardownHuntContainer } = await import('../huntRunner.js');
    teardownHuntContainer(huntId).catch(() => {});
  }
}

export function detectSteering(message) {
  const m = String(message || '').toLowerCase();
  if (/\b(pause|hold|freeze)\b/.test(m) && /\b(hunt|it|scan)\b|\bpause\b/.test(m)) return 'pause';
  if (/\b(resume|continue|carry on)\b/.test(m)) return 'resume';
  if (/\b(stop|abort|cancel|kill)\b/.test(m) && /\b(hunt|scan|it)\b/.test(m)) return 'stop';
  // STATUS ONLY (REAL-HUMAN, 26 Oct 2026): the summary is the right
  // answer for a genuine status/count question — "what did you
  // find", "how many so far", "how far along". Thinking/doing
  // questions ("what are you thinking", "what are you doing now",
  // "aage ka kya kaam h") are NOT status: they used to match here
  // and got the canned summary shape instead of the brain's own
  // thinking — the owner's verified complaint. They now fall
  // through to the open-question path, where a running hunt queues
  // them for the brain's next turn instead of answering from a
  // template.
  if (/\b(what did you find|findings?|what('s| is) the status|status|progress|summary)\b/.test(m))
    return 'summary';
  // Hinglish status questions (Lane S follow-up, 24 Oct 2026): the
  // owner's mid-hunt question is "kitni mili ab tak?" — "how many
  // found so far?" — and the English-only patterns above missed it,
  // so it fell to the LLM path, which shares the one 8B model with
  // the running hunt and queued behind its turns: no reply in 147s
  // in the live browser check, and the earlier 9:26 PM question died
  // after ~5 min with the backend-unreachable error (nginx 300s).
  // A status question must never queue behind the brain; these
  // patterns route it to the instant deterministic summary instead.
  // Kept tight to status/count phrasings so open questions still
  // reach the brain (a false summary of a real question is worse
  // than a slow answer). REAL-HUMAN (26 Oct 2026): "kya kar raha",
  // "kya chal raha", "kya ho raha", "kya kiya", "kya try kiya" are
  // doing/thinking questions, not status — they used to route here
  // and got the canned shape; they now fall through to the queue.
  if (/\b(kitni mili|kitne mile|kitne mili|kya mila|kuch mila|ab tak kya|kahan tak)\b/.test(m))
    return 'summary';
  // Owner's own phrasings (24 Oct 2026, live evidence): "so what is
  // now doing by you and what you thinking now?" and "bata" both went
  // to the LLM path and died after ~5 min with the backend-unreachable
  // error (nginx 300s) — the first because "what is now doing by you"
  // matches neither "what are you doing" nor the Hinglish list, the
  // second because a bare "bata" ("tell me") matched nothing at all.
  // In a hunt chat both mean "tell me the status". The nginx timeout
  // is raised alongside (300s -> 1800s) so a genuinely open question
  // still gets its answer instead of the false backend error — but a
  // status question must never wait for the brain at all.
  //
  // REAL-HUMAN (26 Oct 2026): "what is now doing by you" / "what
  // are you thinking" / "what's going on" are THINKING questions,
  // not status — the old pattern routed them to the summary, which
  // is exactly the canned-shape complaint. They now fall through
  // to the open-question path, where a running hunt queues them for
  // the brain. A bare "bata" ("tell me") still means status (below).
  // CHAT-ANSWERS (26 Oct 2026): bare "bata"/"batao" ("tell me") means
  // "tell me the status" — but ONLY when the message is essentially
  // just that word (isBareTell). The old unanchored pattern routed
  // "bata fir jau sone?" (a real question) to the summary.
  if (isBareTell(m)) return 'summary';
  // CHAT-ANSWERS (26 Oct 2026): Devanagari status questions. The
  // instant-answer system was Latin-script-only, so every Devanagari
  // message (the owner's speech-to-text default) fell to the LLM path
  // and queued behind hunt turns. These mirror the Roman Hinglish
  // list above — deliberately multi-word status phrasings, never a
  // bare बता/बताओ (that goes through isBareTell, same as Roman).
  // REAL-HUMAN (26 Oct 2026): क्या कर रहा / क्या कर रहे / क्या किया /
  // क्या चल रहा / क्या हो रहा are doing/thinking questions — they
  // fall through to the queue like their Roman forms. A bare "अभी
  // क्या" is NOT kept as a status pattern either: the unanchored
  // match would swallow "अभी क्या कर रहे हो" ("what are you doing
  // right now") into the summary — a bare "what now?" is an open
  // question the brain answers better from its own context.
  if (/कितनी मिली|कितने मिले|क्या मिला|कुछ मिला|अब तक क्या|कहाँ तक/.test(m))
    return 'summary';
  return null;
}

router.post(
  '/',
  // Hunt-scoped chat is owner-only (same rule as the hunt routes): the
  // caller must be logged in, and steering a hunt requires owning it
  // (admins may steer any hunt). Public chat (no huntId) stays open.
  (req, res, next) => {
    if (req.body && req.body.huntId) return requireAuth(req, res, next);
    next();
  },
  async (req, res) => {
  const { message, huntId } = req.body || {};
  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ ok: false, error: 'missing_message' });
  }

  // CHAT-ANSWERS observability (26 Oct 2026): one log line per
  // request — route, language/script, latency ms, hunt, HTTP status.
  // Until now there was no server-side record of which messages went
  // unanswered or how long answers took; the owner's "no reply"
  // complaint could only be investigated from the browser. The
  // finish listener covers every return path, including errors.
  const startedAt = Date.now();
  const lang = detectChatLanguage(message);
  let chatRoute = 'unknown';
  res.on('finish', () => {
    console.log(`[chat] route=${chatRoute} lang=${lang} ms=${Date.now() - startedAt} hunt=${huntId || '-'} status=${res.statusCode}`);
  });

  // Ownership check for hunt-scoped chat: your hunts are yours alone.
  if (huntId && req.user) {
    const meta0 = readHuntMeta(huntId);
    if (meta0 && meta0.userId && meta0.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ ok: false, error: 'forbidden' });
    }
  }

  const action = detectSteering(message);

  // CHAT-ANSWERS: conversation history the frontend sends (last ~6
  // thread messages). The LLM path previously got ONE message and no
  // context, so follow-ups ("aur batao", "uske baad kya?") were
  // answered cold. Sanitised hard: role + text only, capped.
  const history = sanitizeHistory(req.body && req.body.history);

  // No hunt context: answer steering only generically.
  if (!huntId) {
    if (action === 'pause' || action === 'resume' || action === 'stop') {
      chatRoute = 'no-hunt-steering';
      return res.json({
        ok: true,
        reply:
          `I don't have a hunt attached to this chat. Open a hunt and chat from its view ` +
          `to ${action} it mid-hunt.`,
      });
    }
    if (action === 'summary') {
      chatRoute = 'no-hunt-summary';
      return res.json({
        ok: true,
        reply: 'There is no hunt in context for this chat. Start a hunt first, then ask me about it.',
      });
    }
    // No hunt context: try the real AI; fall back to honest guidance.
    // MODEL-SWITCHER (26 Oct 2026): chat replies are permanently on
    // the Meta model — never on the hunt brain's 8B slot (which is
    // busy hunting for 10–25 min a turn). When Meta is unavailable
    // (no key, card not verified, API down) the deterministic
    // fallback below answers instead; chat never waits on the 8B.
    if (metaAvailable()) {
      chatRoute = 'no-hunt-llm';
      const aiReply = await callChatMeta(
        [...history, { role: 'user', text: message }],
        'You are Dark Matter, an elite autonomous bug-bounty hunter by Obfinity. ' +
        'No hunt is attached to this chat yet. Answer helpfully and concisely.',
        { huntId: null }
      );
      if (aiReply) return res.json({ ok: true, reply: aiReply, ai: true });
    }
    chatRoute = 'no-hunt-fallback';
    return res.json({
      ok: true,
      reply:
        'Noted. Start or open a hunt and I can answer mid-hunt — ask "what did you find", ' +
        'or tell me to "pause the hunt" / "stop the hunt" while one is running. ' +
        '(Connect AWS Bedrock in Plugins for full AI chat.)',
    });
  }

  // Hunt context: hunts run host-side (no separate engine), so read the
  // live state directly from the hunt meta + event log. No engine calls.
  const meta = readHuntMeta(huntId) || {};
  const cached = readHuntEvents(huntId) || [];
  // SINGLE READ PATH (Lane P): findings come from loadHuntMemory,
  // which reconciles retraction events — a retracted stamp is not a
  // finding and must never be counted or listed as confirmed here.
  // Lane S keeps the whole snapshot: the summary's attempts narration
  // reads its reasoning rows.
  const memory = loadHuntMemory(huntId, { meta });
  const findings = memory.findings;
  // Build a live-like snapshot from host-side data so downstream code
  // (ctx, summaryReply, system prompt) works unchanged.
  const live = {
    target: meta.target,
    state: meta.state || 'unknown',
    phase: meta.phase,
    stepCount: meta.iteration ?? meta.stepCount,
  };
  const liveError = null;

  const ctx = huntContextLine({ huntId, meta, live, liveError, cached, findings });

  // Off-topic guard (Lane S): hunt-scoped chat answers hunt questions
  // only. Checked deterministically BEFORE the LLM path so the
  // decline is instant — an off-topic message must never queue
  // behind the hunt's own generations on the shared model (live
  // evidence 23 Oct 2026: ~8.5 min of "Stop generating", no reply).
  // Steering/summary actions are hunt business and never reach here.
  if (!action) {
    let host = '';
    try { host = new URL(meta.target || '').hostname; } catch { /* target may be a bare host */ }
    if (!host && meta.target) host = String(meta.target).split('/')[0];
    if (isOffTopicHuntChat(message, { host })) {
      chatRoute = 'off-topic';
      return res.json({ ok: true, scoped: true, reply: offTopicDecline(message) });
    }
  }

  try {
    if (action === 'pause') {
      chatRoute = 'pause';
      await pauseHuntResilient(huntId);
      return res.json({ ok: true, action: 'pause', reply: `Hunt paused. ${ctx}` });
    }
    if (action === 'resume') {
      chatRoute = 'resume';
      await resumeHuntResilient(huntId, req.user);
      return res.json({ ok: true, action: 'resume', reply: `Hunt resumed. ${ctx}` });
    }
    if (action === 'stop') {
      chatRoute = 'stop';
      await stopHuntResilient(huntId);
      return res.json({ ok: true, action: 'stop', reply: `Hunt stopped. ${ctx}` });
    }
    if (action === 'summary') {
      // Status / progress / findings questions are answered DETERMINISTICALLY
      // from live hunt state — instantly. The old code asked the AI first and
      // only fell back when it returned null, but the chat shares one model
      // with the hunt itself: a "what is the progress?" message queued behind
      // the hunt's own generations and could wait many minutes with no reply
      // at all (found live 23 Oct 2026 — the UI sat on "Stop generating" for
      // ~9 minutes). A status answer must never be held hostage by the
      // brain's queue; summaryReply reads the same live state (meta + event
      // log + latest thinking) the AI would have been given.
      chatRoute = 'summary';
      return res.json({ ok: true, reply: summaryReply({ ctx, live, liveError, cached, findings, reasoningRows: memory.reasoningRows, message, meta, huntId }) });
    }
    // Open questions: REAL AI with full hunt context (no hardcoded answers).
    //
    // REAL-HUMAN (26 Oct 2026): while the hunt is RUNNING, a thinking
    // question goes to the BRAIN's next turn through the chat queue —
    // it is NOT answered by a chatWithAI call here. The old code did
    // exactly that when the brain looked free, and answered from the
    // deterministic summary when it looked busy: the first queued
    // 10–25 min behind the hunt on the same shared model and died at
    // the deadline, the second gave the canned summary shape and a
    // "detailed answer will wait" promise that was never kept (the
    // owner's verified complaint — 03:25Z "detailed jawab thoda
    // rukega", no follow-up ever arrived). The queue keeps the
    // promise in code: the question stays pending until the loop
    // delivers the brain's answer, and the instant reply is an
    // honest acknowledgement grounded in the live record — never
    // the summary shape. When the hunt is NOT running the brain is
    // free, so the direct LLM path below still applies.
    if (meta.state === 'running' || isInferenceActive()) {
      const chatId = String((req.body && req.body.chatId) || '').slice(0, 64);
      const userId = req.user ? String(req.user.id || '') : '';
      const { question, queued, reason } = queueChatQuestion(huntId, {
        chatId, userId, text: message, lang,
      });
      if (!queued) {
        chatRoute = 'queue-full';
        return res.json({ ok: true, queued: false, reason, reply: queueFullLine(lang) });
      }
      // The ack's facts come from the last reasoning row — what the
      // brain actually did last, where, and how long ago — the same
      // record the summary's RIGHT NOW line reads, rendered here as
      // one or two honest sentences instead of the summary shape.
      chatRoute = 'queued-ack';
      return res.json({
        ok: true,
        queued: true,
        questionId: question.id,
        reply: ackTextForHunt({ reasoningRows: memory.reasoningRows, lang, pendingCount: pendingChatQuestions(huntId).length }),
      });
    }
    // MODEL-SWITCHER (26 Oct 2026): the direct LLM path is Meta,
    // permanently — the hunt brain's 8B never answers chat here.
    // (A thinking question while the hunt is RUNNING never reaches
    // this branch: it queues to the brain's next turn instead, and
    // the brain answers it there through callBrain.)
    if (metaAvailable()) {
      chatRoute = 'llm';
      const system = buildHuntSystemPrompt({ huntId, meta, live, liveError, cached, findings, memory, userMessage: message });
      const aiReply = await callChatMeta([...history, { role: 'user', text: message }], system, { huntId });
      if (aiReply) return res.json({ ok: true, reply: aiReply, ai: true });
    }
    // AI unreachable: answer from real hunt data, not a generic fallback.
    chatRoute = 'fallback-summary';
    return res.json({
      ok: true,
      reply: fallbackLine(lang) + summaryReply({ ctx, live, liveError, cached, findings, reasoningRows: memory.reasoningRows, message, meta, huntId }),
    });
  } catch (err) {
    if (err instanceof EngineUnreachableError) {
      return res.status(502).json({
        ok: false,
        error: 'engine_unreachable',
        message: `Could not ${action} the hunt: ${err.message}`,
      });
    }
    return res.status(500).json({ ok: false, error: 'internal_error', message: String(err.message || err) });
  }
});

/** Rich system prompt: the AI thinks with full hunt context, not canned lines. */
export function buildHuntSystemPrompt({ huntId, meta, live, liveError, cached, findings, memory = {}, userMessage = '' }) {
  const target = (live && live.target) || (meta && meta.target) || 'unknown target';
  const state = (live && (live.state || live.status)) || 'unknown';
  const phase = (live && live.phase) || 'unknown';
  const thinking = cached.filter((e) => e.type === 'thinking').slice(-3);
  let analysis = '';
  try {
    const a = analyzeFindings(findings);
    analysis =
      `\nInfinity analysis: ${a.summary.unique} unique findings, ` +
      `${a.summary.confirmed} confirmed, ${a.summary.chains} exploit chains ` +
      `(${a.summary.criticalChains} critical).` +
      (a.chains.length
        ? `\nTop chains: ${a.chains.slice(0, 3).map((c) => `[${c.impact}] ${c.title}`).join('; ')}.`
        : '');
  } catch { /* intel best-effort */ }
  // CHAT-ANSWERS (26 Oct 2026): the memory the route already loads
  // was thrown away here — leftOff, ruledOut and the dossier briefing
  // never reached the prompt, so the LLM answered from counts alone.
  // These are clipped hard: the prompt must stay small on the 8B.
  let memoryBlock = '';
  const lo = memory.leftOff;
  if (lo && (lo.lastThinking || lo.lastNote)) {
    memoryBlock += `\nWhere I left off: ${clipClean(lo.lastThinking || lo.lastNote, 220)}`;
  }
  if (lo && Array.isArray(lo.lastActions) && lo.lastActions.length) {
    const acts = lo.lastActions.slice(-3).map((a) => clipClean(`${a.action || ''} — ${String(a.result || '').split(/\r?\n/)[0]}`, 130)).join(' | ');
    if (acts) memoryBlock += `\nLast actions: ${acts}`;
  }
  if (Array.isArray(memory.ruledOut) && memory.ruledOut.length) {
    memoryBlock += `\nRuled out (do not re-try without new evidence): ${memory.ruledOut.slice(0, 5).map((r) => clipClean(String(r), 90)).join(' | ')}`;
  }
  if (memory.dossierBriefing) {
    memoryBlock += `\nDossier: ${clipClean(memory.dossierBriefing, 600)}`;
  }
  // CHAT-ANSWERS: what I am doing RIGHT NOW, from the last reasoning
  // row — same derivation as the deterministic summary, so the LLM
  // and the summary never disagree about the live state.
  let rightNow = '';
  const rows = memory.reasoningRows || [];
  if (rows.length) {
    const lastRow = rows[rows.length - 1];
    const page = pageUrlFromObservation(lastRow.result || '');
    rightNow =
      `\nRight now: ${clipClean(String(lastRow.action || 'turn'), 90)} — ` +
      `${clipClean(String(lastRow.result || '').split(/\r?\n/)[0], 140)}` +
      (page ? ` (page: ${page})` : ' (page unknown from the record)') +
      (lastRow.at ? `, ${relativeAge(lastRow.at, 'english')}` : '');
  }
  return (
    `You are Dark Matter, an elite autonomous bug-bounty hunter by Obfinity. ` +
    `You are mid-hunt and the user is chatting with you live. Think like a senior ` +
    `security researcher: be specific, technical, and honest about uncertainty. ` +
    `Never invent findings. If asked to pause/resume/stop, tell the user to use ` +
    `those exact words (the controls handle it deterministically).\n\n` +
    // CHAT-ANSWERS (26 Oct 2026): answer in the user's own language
    // and script — Hindi in Devanagari gets Devanagari, Roman Hindi
    // gets Roman Hindi, English gets English. The old prompt had no
    // language instruction at all, so Devanagari questions got English
    // answers (when they got any answer).
    `Reply in the language and script of the user's latest message: ` +
    `Hindi in Devanagari script → Devanagari; Roman Hindi/Hinglish → Roman Hindi; ` +
    `English → English. Match the user's register; be specific about what ` +
    `you are doing right now, not generic.\n\n` +
    `Hunt ${huntId} on ${target}: state=${state}, phase=${phase}, ` +
    `${findings.length} finding(s), ${cached.length} event(s).` +
    (liveError ? ` Live engine unreachable — cached data only.` : '') +
    analysis +
    (findings.length
      ? `\nFindings: ${findings.slice(0, 8).map((f) => `[${f.severity || f.level || 'info'}] ${f.title || f.name || f.type}`).join('; ')}.`
      : `\nNo findings recorded yet.`) +
    (thinking.length
      ? `\nRecent thinking: ${thinking.map((t) => clipClean(t.text || t.summary || '', 200)).join(' | ')}`
      : '') +
    memoryBlock +
    rightNow
  );
}

export function huntContextLine({ huntId, meta, live, liveError, cached, findings, lang = 'english' }) {
  const target = (live && live.target) || (meta && meta.target) || 'your target';
  const state = (live && (live.state || live.status)) || (meta && meta.state) || 'unknown';
  const step = (live && (live.stepCount ?? live.step_count)) ?? (meta && (meta.iteration ?? meta.stepCount));
  const phase = (live && live.phase) || (meta && meta.phase);
  const verified = confirmedTitles(findings).length;
  // Leads in the PANEL's unit — unique unconfirmed titles via
  // huntMemory.findingCounts, never findings.length: the raw stamp
  // count made chat say "284 lead(s)" where the panel said 76
  // leads over the same record (Lane Y, 24 Oct 2026).
  const leads = findingCounts(findings).leads;
  // CHAT-ANSWERS (26 Oct 2026): the status line renders in the user's
  // language/script — the English template was the "generic answer"
  // the owner complained about (he writes in Devanagari now).
  const stateWord = {
    english: { running: 'actively hunting', paused: 'paused', stopped: 'stopped', starting: 'starting up' }[state] || state,
    hinglish: { running: 'actively hunting', paused: 'ruki hui hai', stopped: 'band hai', starting: 'shuru ho rahi hai' }[state] || state,
    devanagari: { running: 'actively hunting', paused: 'रुकी हुई है', stopped: 'बंद है', starting: 'शुरू हो रही है' }[state] || state,
  }[lang] || state;
  if (lang === 'hinglish') {
    let line = `Hunt ${target} par chal rahi hai — ${stateWord}`;
    if (phase) line += ` (${phase} phase)`;
    if (step !== undefined && step !== null) line += `, round ${step}`;
    line += `. ${leads} lead(s), ${verified} confirmed ab tak`;
    return line + '.';
  }
  if (lang === 'devanagari') {
    let line = `हंट ${target} पर चल रही है — ${stateWord}`;
    if (phase) line += ` (${phase} phase)`;
    if (step !== undefined && step !== null) line += `, राउंड ${step}`;
    line += `। ${leads} lead(s), ${verified} confirmed अब तक`;
    return line + '।';
  }
  let line = `Hunting ${target} — ${stateWord}`;
  if (phase) line += ` (${phase} phase)`;
  if (step !== undefined && step !== null) line += `, round ${step}`;
  line += `. ${leads} lead(s), ${verified} confirmed so far`;
  return line + '.';
}

// CHAT-ANSWERS (26 Oct 2026): how long ago a turn ran, timezone-proof
// (the server clock is UTC; the owner reads IST — a relative age can
// never be misread the way an absolute clock time can).
function relativeAge(at, lang = 'english') {
  const t = Date.parse(String(at || ''));
  if (!t) return '';
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  const justNow = { english: 'just now', hinglish: 'abhi abhi', devanagari: 'अभी-अभी' }[lang] || 'just now';
  if (mins < 1) return justNow;
  if (mins < 60) {
    return { english: `${mins} min ago`, hinglish: `${mins} min pehle`, devanagari: `${mins} मिनट पहले` }[lang];
  }
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return {
    english: `${h} h ${m} min ago`,
    hinglish: `${h} ghante ${m} min pehle`,
    devanagari: `${h} घंटे ${m} मिनट पहले`,
  }[lang];
}

// Bilingual summary templates (CHAT-ANSWERS, 26 Oct 2026). The old
// summary was an English template in every language — the "generic
// answer" the owner complained about. The record content (tool names,
// titles, thinking quotes) stays as recorded; only the narration
// around it is rendered in the user's language/script.
const SUMMARY_TEXT = {
  english: {
    found: (n, titles) => ` Found ${n} confirmed ${n > 1 ? 'vulnerabilities' : 'vulnerability'}: ${titles.join(', ')}.`,
    leadsOnly: (leads) => ` ${leads} lead(s) under investigation — nothing confirmed yet.`,
    early: ' Still in early recon — no vulnerabilities found yet, but the hunt is methodically mapping your site.',
    attemptsLabel: 'Recent attempts',
    thinking: ' Currently: ',
    rightNow: (step, action, result, page, age) =>
      ` Right now${step != null ? ` (round ${step})` : ''}: ${action} — ${result}. Page: ${page}${age ? `. Last turn: ${age}` : ''}.`,
    rightNowNone: ' No turn has run yet on this hunt.',
    pageUnknown: 'page unknown from the record',
  },
  hinglish: {
    found: (n, titles) => ` ${n} confirmed ${n > 1 ? 'vulnerabilities mile hain' : 'vulnerability mili hai'}: ${titles.join(', ')}.`,
    leadsOnly: (leads) => ` ${leads} lead(s) investigation mein hain — abhi tak kuch confirm nahi hua.`,
    early: ' Abhi early recon mein hai — abhi tak koi vulnerability confirm nahi hui, par hunt site ko methodically map kar raha hai.',
    attemptsLabel: 'Abhi tak kya try kiya',
    thinking: ' Aakhri soch: ',
    rightNow: (step, action, result, page, age) =>
      ` Right now${step != null ? ` (round ${step})` : ''}: ${action} — ${result}. Page: ${page}${age ? `. Aakhri turn: ${age}` : ''}.`,
    rightNowNone: ' Is hunt par abhi tak ek bhi turn nahi chala.',
    pageUnknown: 'page record se pata nahi chal raha',
  },
  devanagari: {
    found: (n, titles) => ` ${n} confirmed ${n > 1 ? 'vulnerabilities मिली हैं' : 'vulnerability मिली है'}: ${titles.join(', ')}.`,
    leadsOnly: (leads) => ` ${leads} lead(s) investigation में हैं — अभी तक कुछ confirm नहीं हुआ।`,
    early: ' अभी early recon में है — अभी तक कोई vulnerability confirm नहीं हुई, पर hunt site को methodically map कर रहा है।',
    attemptsLabel: 'अभी तक क्या try किया',
    thinking: ' आख़िरी सोच: ',
    rightNow: (step, action, result, page, age) =>
      ` अभी${step != null ? ` (राउंड ${step})` : ''}: ${action} — ${result}। Page: ${page}${age ? `। आख़िरी turn: ${age}` : ''}।`,
    rightNowNone: ' इस hunt पर अभी तक एक भी turn नहीं चला।',
    pageUnknown: 'page record से पता नहीं चल रहा',
  },
};

export function summaryReply({ ctx, live, liveError, cached, findings, reasoningRows = [], message = '', meta = {}, huntId = '' }) {
  const lang = detectChatLanguage(message);
  const T = SUMMARY_TEXT[lang] || SUMMARY_TEXT.english;
  const step = (live && (live.stepCount ?? live.step_count)) ?? (meta && (meta.iteration ?? meta.stepCount));
  // The status line itself renders in the user's language; the passed
  // ctx stays English for the steering replies that share it.
  let reply = lang === 'english' ? ctx : huntContextLine({ huntId, meta, live, liveError, cached, findings, lang });
  if (findings.length) {
    // Count CONFIRMED as unique titles, not raw stamps: a long hunt
    // stamps the same vulnerability many times, and "Found 5 confirmed"
    // for one vulnerability repeated five times is a false count —
    // the number and the list must agree.
    const titles = confirmedTitles(findings);
    if (titles.length) {
      reply += T.found(titles.length, titles.slice(0, 5));
    } else {
      reply += T.leadsOnly(findingCounts(findings).leads);
    }
  } else {
    reply += T.early;
  }
  // What the hunter actually TRIED, from its own record — the counts
  // above never answered "kya kya try kiya?" (Lane S).
  const attempts = recentAttempts({ events: cached, reasoningRows, label: T.attemptsLabel });
  if (attempts) reply += ` ${attempts}`;
  const thinking = cached.filter((e) => e.type === 'thinking');
  const lastThink = thinking.length ? thinking[thinking.length - 1] : null;
  if (lastThink && (lastThink.text || lastThink.summary)) {
    // Clip at a clean boundary: the raw slice cut a live reply
    // mid-word ("...sensitive in the FTP direct") (Lane S).
    const t = clipClean(lastThink.text || lastThink.summary, 200);
    if (t && !/unreachable|no reply/i.test(t)) reply += `${T.thinking}${t}`;
  }
  // RIGHT NOW (CHAT-ANSWERS, 26 Oct 2026): the specific line the old
  // summary never had — the last reasoning row's action + outcome,
  // the page it ran on (derived from the row's own text; the live
  // page URL is session-local only, so when the record carries no
  // URL the answer says so instead of inventing one), the iteration,
  // and how long ago that turn ran.
  const rows = reasoningRows || [];
  const lastRow = rows.length ? rows[rows.length - 1] : null;
  if (lastRow) {
    const action = clipClean(String(lastRow.action || 'turn'), 90);
    const result = clipClean(String(lastRow.result || '').split(/\r?\n/)[0], 140) || '—';
    const page = pageUrlFromObservation(lastRow.result || '') || T.pageUnknown;
    reply += T.rightNow(step != null ? step : null, action, result, page, relativeAge(lastRow.at, lang));
  } else {
    reply += T.rightNowNone;
  }
  return reply;
}

export default router;
