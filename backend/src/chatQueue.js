// Mid-hunt chat queue — REAL-HUMAN lane (26 Oct 2026).
//
// The complaint (owner, verified live on the hunt chat file):
// every mid-hunt question got the same canned summary shape
// ("Hunt X — actively hunting, round N. 0 lead(s), 0 confirmed.
// Still in early recon…", answered in ~242ms), and the
// "detailed answer will wait" promise was never kept — no
// follow-up LLM reply ever arrived. The deterministic summary
// path is the right answer for STATUS questions (counts from the
// record), but a THINKING question ("what are you thinking",
// "aage ka kya kaam h") must be answered by the BRAIN, with its
// memory and live state — and the brain is mid-turn for 10–25
// minutes, so the answer cannot come back in the same HTTP
// request.
//
// The queue is the bridge. A thinking question asked while the
// hunt runs is stored here (one JSON file per hunt, beside the
// hunt's own record — never in meta.json, so a checkpoint write
// can never wipe it), the user gets an HONEST acknowledgement
// immediately (built from the live record, never the summary
// shape — see busyAck), and the brain answers the question in
// its NEXT turn: the screen carries the pending questions, the
// brain's reply may carry "chat_answers" in its action JSON, and
// the loop delivers each answer as a chat_answer event + an
// appended chat message. A question is NEVER silently dropped:
// it stays pending until answered, and the screen keeps showing
// it (oldest first) until it is.
//
// Design note (research 20 Oct 2026, Generative Agents / Letta):
// the write path is deterministic code, not the model — the
// harness decides what is saved and when it is delivered. The
// model's only job is answering, in its own words, from memory.

import fs from 'node:fs';
import path from 'node:path';

import { huntDir, ensureHuntDir } from './store.js';

/** Max questions waiting at once — the screen shows the oldest 3. */
export const MAX_QUEUED_CHAT_QUESTIONS = 5;
export const CHAT_QUESTIONS_ON_SCREEN = 3;
/** A chat answer is prose, not a payload — cap it hard. */
export const CHAT_ANSWER_MAX_CHARS = 2000;

export function chatQueuePath(huntId) {
  return path.join(huntDir(String(huntId)), 'chat-queue.json');
}

function readQueueFile(huntId) {
  try {
    const raw = JSON.parse(fs.readFileSync(chatQueuePath(huntId), 'utf8'));
    if (raw && Array.isArray(raw.questions)) return raw;
  } catch { /* missing or corrupt starts empty */ }
  return { questions: [] };
}

function writeQueueFile(huntId, queue) {
  ensureHuntDir(huntId);
  const file = chatQueuePath(huntId);
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(queue, null, 2));
  fs.renameSync(tmp, file);
}

/**
 * Queue one thinking question for the brain's next turn.
 * @returns {{ question, queued: boolean, reason?: string }}
 * A question past the cap is NOT queued — the caller tells the
 * user honestly that the queue is full instead of dropping it
 * silently.
 */
export function queueChatQuestion(huntId, { chatId, userId, text, lang = 'english' } = {}) {
  const clean = String(text || '').trim().slice(0, 2000);
  if (!clean) return { question: null, queued: false, reason: 'empty' };
  const queue = readQueueFile(huntId);
  const pending = queue.questions.filter((q) => q && q.status === 'pending');
  if (pending.length >= MAX_QUEUED_CHAT_QUESTIONS) {
    return { question: null, queued: false, reason: 'full' };
  }
  const question = {
    id: `q_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    chatId: String(chatId || '').slice(0, 64),
    userId: String(userId || '').slice(0, 64),
    text: clean,
    lang: ['english', 'hinglish', 'devanagari'].includes(lang) ? lang : 'english',
    askedAt: new Date().toISOString(),
    status: 'pending',
  };
  queue.questions.push(question);
  writeQueueFile(huntId, queue);
  return { question, queued: true };
}

/** Pending questions, oldest first. Pure read. */
export function pendingChatQuestions(huntId) {
  const queue = readQueueFile(huntId);
  return queue.questions.filter((q) => q && q.status === 'pending');
}

/** Mark one question answered (the delivery already happened). */
export function markChatAnswered(huntId, id, { answer = '' } = {}) {
  const queue = readQueueFile(huntId);
  const q = queue.questions.find((x) => x && x.id === id);
  if (!q) return false;
  q.status = 'answered';
  q.answeredAt = new Date().toISOString();
  q.answer = String(answer || '').slice(0, CHAT_ANSWER_MAX_CHARS);
  writeQueueFile(huntId, queue);
  return true;
}

/** How long ago a question was asked, timezone-proof (relative age). */
export function chatQuestionAge(askedAt, nowMs = Date.now()) {
  const t = Date.parse(String(askedAt || ''));
  if (!t) return '';
  const mins = Math.max(0, Math.round((nowMs - t) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  return `${h} h ${mins % 60} min ago`;
}

/**
 * The screen block for the brain — the pending questions, oldest
 * first, with the exact mechanism for answering them. Rides the
 * never-trimmed continuity region (beside PENDING PLANS), so a
 * question can never be crowded out of the screen by the briefing
 * cap. Empty when nothing is pending — no placeholder text, ever.
 */
export function chatQuestionScreenLines(pending, { nowMs = Date.now() } = {}) {
  const list = (pending || []).filter(Boolean).slice(0, CHAT_QUESTIONS_ON_SCREEN);
  if (!list.length) return [];
  const lines = ['=== YOUR OWNER\'S QUESTIONS — ANSWER THEM THIS TURN ==='];
  for (const q of list) {
    const langNote = q.lang && q.lang !== 'english' ? ` (${q.lang === 'devanagari' ? 'Devanagari' : 'Roman Hindi'})` : '';
    lines.push(`- [${q.id}]${langNote} (asked ${chatQuestionAge(q.askedAt, nowMs)}): "${String(q.text || '').slice(0, 300)}"`);
  }
  lines.push('Answer each in your reply: add "chat_answers":[{"q":"<id>","answer":"..."}] to your action JSON, in the user\'s language, from what you actually did and think — never a canned summary, never counts you did not earn. A question you leave out stays queued for your next turn.');
  return lines;
}

/**
 * Extract the brain's chat answers from its parsed action JSON.
 * Only answers to questions that are actually pending count — a
 * fabricated id is ignored, never delivered. Pure.
 * @returns {Array<{ q: string, answer: string, question: object }>}
 */
export function extractChatAnswers(action, pending) {
  const list = action && Array.isArray(action.chat_answers) ? action.chat_answers : [];
  if (!list.length) return [];
  const byId = new Map((pending || []).filter(Boolean).map((q) => [q.id, q]));
  const out = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const q = byId.get(String(item.q || ''));
    if (!q) continue;
    const answer = String(item.answer || '').trim().slice(0, CHAT_ANSWER_MAX_CHARS);
    if (!answer) continue;
    out.push({ q: q.id, answer, question: q });
  }
  return out;
}

/**
 * Parse the normal-mode brain's chat answers from its raw reply text
 * (27 Oct 2026, chat-gate fix). The normal-mode pipeline speaks a
 * JSON array of plans, not an action JSON, so its answers ride after
 * the array as one line per question:
 *   CHAT_ANSWER <question-id>: <answer in the user's language>
 * Only lines in that exact shape parse; everything else in the reply
 * is untouched. Pure — feed the result to extractChatAnswers with
 * the pending list to validate ids, exactly like the human loop.
 * @returns {Array<{ q: string, answer: string }>}
 */
export function parseChatAnswerLines(replyText) {
  const out = [];
  for (const line of String(replyText || '').split('\n')) {
    const m = /^\s*CHAT_ANSWER\s+(\S+)\s*:\s*(.+?)\s*$/.exec(line);
    if (!m) continue;
    const answer = String(m[2] || '').trim().slice(0, CHAT_ANSWER_MAX_CHARS);
    if (!answer) continue;
    out.push({ q: m[1], answer });
  }
  return out;
}

// The honest acknowledgement — REAL-HUMAN lane.
//
// While the brain is mid-turn, the instant reply must be HONEST
// and SPECIFIC about what the brain is doing RIGHT NOW (one or
// two sentences, grounded in the last reasoning row) — and it
// must NEVER be the canned summary shape. The shape is enforced
// structurally: no status line, no counts, no "early recon", no
// attempts list, no thinking quote. What it carries instead:
// (1) the brain's actual last action + its outcome + the page it
// ran on, from the record; (2) the promise that the question is
// queued for the next turn — a promise the queue keeps, because
// the question stays pending until the loop delivers an answer.
// The caller supplies the record facts; this function only
// renders them in the user's language. Pure.

const BUSY_ACK = {
  english: ({ doing, page, age, pendingCount }) =>
    `Right now I'm ${doing}${page ? ` on ${page}` : ''}${age ? ` (${age})` : ''} — that's what the record shows me doing. I've noted your question for my next turn${pendingCount > 1 ? ` (you have ${pendingCount} waiting)` : ''} and will answer it there, in my own words.`,
  hinglish: ({ doing, page, age, pendingCount }) =>
    `Abhi main ${doing}${page ? ` — ${page} par` : ''}${age ? ` (${age})` : ''} — record yehi dikha raha hai. Tumhara sawaal maine agle turn ke liye note kar liya hai${pendingCount > 1 ? ` (tumhare ${pendingCount} sawaal wait kar rahe hain)` : ''}, wahi jawab dunga, apne shabdon mein.`,
  devanagari: ({ doing, page, age, pendingCount }) =>
    `अभी मैं ${doing}${page ? ` — ${page} पर` : ''}${age ? ` (${age})` : ''} — record यही दिखा रहा है। तुम्हारा सवाल मैंने अगले turn के लिए note कर लिया है${pendingCount > 1 ? ` (तुम्हारे ${pendingCount} सवाल wait कर रहे हैं)` : ''}, वहीं जवाब दूँगा, अपने शब्दों में।`,
};

/**
 * @param {{ lang, doing, page, age, pendingCount }} facts — doing is
 *   the last action + outcome in one short clause (e.g.
 *   "trying the login page again — the form rejected the probe");
 *   page is the URL the action ran on ('' when unknown — the ack
 *   then says nothing about the page instead of inventing one).
 */
export function busyAck({ lang = 'english', doing = '', page = '', age = '', pendingCount = 1 } = {}) {
  const render = BUSY_ACK[lang] || BUSY_ACK.english;
  const d = String(doing || '').trim() || 'in the middle of a turn';
  return render({ doing: d, page: String(page || '').trim(), age: String(age || '').trim(), pendingCount: Math.max(1, pendingCount || 1) });
}

/** The queue-full line — the question was NOT queued, said plainly. */
export function queueFullLine(lang = 'english') {
  return {
    english: `I already have ${MAX_QUEUED_CHAT_QUESTIONS} of your questions waiting for my next turns — ask this one again after I answer those, so nothing gets lost.`,
    hinglish: `Mere paas tumhare ${MAX_QUEUED_CHAT_QUESTIONS} sawaal pehle se wait kar rahe hain agle turns ke liye — ye wala unke jawab ke baad phir se poochhna, taaki kuch khoye nahi.`,
    devanagari: `मेरे पास तुम्हारे ${MAX_QUEUED_CHAT_QUESTIONS} सवाल पहले से अगले turns के लिए wait कर रहे हैं — ये वाला उनके जवाब के बाद फिर से पूछना, ताकि कुछ खोए नहीं।`,
  }[lang] || `I already have ${MAX_QUEUED_CHAT_QUESTIONS} of your questions waiting for my next turns — ask this one again after I answer those, so nothing gets lost.`;
}
