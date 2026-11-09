// Split out of humanLoop.js by the P3 professionalization lane (split-only, no behaviour change).
// Moved verbatim; humanLoop.js re-exports the public names so callers are unchanged.

import { appendHuntEvent, readHuntMeta, writeHuntMetaCheckpoint, readHuntEvents, huntDir, ensureHuntDir } from '../store.js';
import { recallById, firstRunNumber, parseRecallId, formatFullRecord } from '../actionIndex.js';
import { recordReasoning, getAllReasoning, buildFullHistoryLedger, searchRecall } from '../reasoningMemory.js';
import { getRelevantMemories, formatGlobalMemoryForPrompt, readAllGlobalMemories } from '../globalMemory.js';
import {
  pendingChatQuestions,
  chatQuestionScreenLines,
  extractChatAnswers,
  markChatAnswered,
} from '../chatQueue.js';
import { appendChatMessage } from '../routes/chats.js';
import {
  startInterceptProxy,
  listIntercept,
  readInterceptEntry,
  buildReplayRequest,
  buildReplayCurl,
  replaySignature,
} from '../proxyIntercept.js';

/** The detail a log/journal entry carries for one parsed action. */
export function detailForAction(kind, action) {
  switch (kind) {
    case 'shell': return String(action.command || '').slice(0, 160);
    case 'search': return String(action.query || '').slice(0, 160);
    case 'write_file': return String(action.name || '').slice(0, 120);
    case 'note': return String(action.text || '').slice(0, 160);
    case 'browser_open': return String(action.url || '').slice(0, 160);
    case 'browser_click': return String(action.text || '').slice(0, 120);
    case 'browser_type': {
      // GUI-TYPE-TARGET (28 Oct 2026): the detail names the field —
      // the dedupe gate compares like with like, so typing 'admin'
      // into the username field and into a search box are different
      // actions, not the same repeat.
      const tgt = String(action.target || action.selector || '').trim();
      const txt = String(action.text || '').slice(0, 80);
      return tgt ? `${tgt} ← ${txt}`.slice(0, 80) : txt;
    }
    case 'claim_finding': return String(action.title || '').slice(0, 160);
    case 'recall': {
      const id = parseRecallId(action.id);
      return id != null ? `#${id}` : String(action.query || '').slice(0, 160);
    }
    case 'record_coverage': return `${String(action.surface || '').slice(0, 100)} ${String(action.class || '').slice(0, 40)} ${String(action.outcome || '').slice(0, 30)}`.trim().slice(0, 160);
    case 'hunt_plan': {
      if (Array.isArray(action.steps)) return `plan: ${action.steps.length} step(s)`.slice(0, 160);
      if (action.done != null) return `plan done ${String(action.done).slice(0, 60)}`;
      if (action.skip != null) return `plan skip ${String(action.skip).slice(0, 60)}`;
      return 'plan';
    }
    case 'load_skill': return String(action.skill || '').slice(0, 120);
    case 'save_credential': return String(action.site || '').slice(0, 120);
    case 'use_saved_credential': return String(action.handle || '').slice(0, 120);
    case 'request_details': return String(action.title || '').slice(0, 120);
    case 'desktop_click_control': return String(action.control || '').slice(0, 120);
    // SCREEN-SEEING (27 Oct 2026): a coordinate click keys on its point —
    // the same (x, y) clicked twice is the same action for the dedupe gate.
    case 'desktop_click_at': return `${String(action.x ?? '')},${String(action.y ?? '')}`;
    // HUMAN-BRAIN: the visible terminal run keys on its command —
    // the same identity the shell branch records, so the dedupe
    // gate and the output ledger treat a visible run and a headless
    // run of one command as one action.
    case 'desktop_terminal': return String(action.command || '').slice(0, 160);
    // TOOLS/OS AUTONOMY (27 Oct 2026): a tool launch / install keys
    // on the tool's name — launching the same tool twice is the
    // same action for the dedupe gate. A control list keys on its
    // window (read-only, like browser_snapshot — not gated).
    case 'launch_tool': return String(action.tool || '').slice(0, 80);
    case 'download_tool': return String(action.tool || '').slice(0, 80);
    case 'list_controls': return String(action.window || '').slice(0, 120);
    case 'fetch_verification_code': return String(action.handle || '').slice(0, 120);
    case 'proxy_start': return '';
    case 'intercept_list': return '';
    case 'intercept_read': return `#${String(action.index ?? '').slice(0, 12)}`;
    case 'intercept_replay': return replaySignature(action).slice(0, 160);
    default: return '';
  }
}

/**
 * Default RECALL (Lane I): the hunter deliberately remembers. Reads
 * ONLY its own memory — this hunt's events + reasoning rows and the
 * global-memory store via searchRecall, plus the episode ledger's
 * hybrid retrieval when available (dynamic import, mirroring the
 * lazy assessResult wiring; any failure falls back to searchRecall
 * alone). Bounded to ~1500 chars of observation.
 */
export async function defaultRecallMemory(huntId, query) {
  // HUMAN-BRAIN (26 Oct 2026, per-hunt isolation): the hunt's
  // target scopes both recall paths — the global-memory search and
  // the cross-hunt episode retrieval stay within this target.
  let target = '';
  try { target = String((readHuntMeta(huntId) || {}).target || ''); } catch { /* best-effort */ }
  const rec = searchRecall({
    events: readHuntEvents(huntId),
    reasoningRows: getAllReasoning(huntId),
    globalMemories: (() => { try { return readAllGlobalMemories(); } catch { return []; } })(),
    query,
    limit: 8,
    target,
  });
  let ledgerText = '';
  try {
    const es = await import('../episodeStore.js');
    if (es.episodeLedgerEnabled && es.episodeLedgerEnabled()) {
      const ret = await es.retrieveEpisodes(query, { huntId, crossHunt: true, limit: 5, target });
      if (ret && ret.results && ret.results.length) {
        ledgerText = es.formatRetrievalForPrompt(ret.results, { budgetChars: 900, query });
      }
    }
  } catch { /* ledger recall is best-effort — searchRecall stands alone */ }
  const merged = ledgerText ? `${ledgerText}\n${rec.text}` : rec.text;
  return String(merged).slice(0, 1500);
}

/**
 * Default CHAT-ANSWER delivery (REAL-HUMAN, 26 Oct 2026): the
 * three legs of the promise the queue makes when a question is
 * asked. (1) A chat_answer event in the hunt's permanent record —
 * countable, and it flows through the WS stream to the open hunt
 * view, whose live log shows the answer. (2) The answer appended
 * to the asking chat's message file, so it is in the thread the
 * owner asked in (the client's pull merges it by id; the fresh
 * updatedAt keeps a later client push from wiping it). (3) The
 * question marked answered in the queue, so it leaves the next
 * screen. Every leg is best-effort and independent — a failed
 * append never blocks the event, and the queue mark is what
 * stops the re-ask. Returns true when the event was recorded.
 */
export async function defaultDeliverChatAnswer(huntId, { q, answer, question = {} } = {}, { via = 'human-mode' } = {}) {
  let recorded = false;
  try {
    appendHuntEvent(huntId, {
      type: 'chat_answer',
      questionId: q,
      chatId: question.chatId || '',
      question: String(question.text || '').slice(0, 500),
      answer: String(answer || '').slice(0, 2000),
      via,
    });
    recorded = true;
  } catch { /* the record is best-effort */ }
  try {
    if (question.chatId && question.userId) {
      appendChatMessage(question.userId, question.chatId, {
        id: `a_${String(q || 'q').replace(/[^a-zA-Z0-9_-]/g, '')}_${Date.now().toString(36)}`,
        role: 'assistant',
        text: String(answer || ''),
        createdAt: new Date().toISOString(),
      });
    }
  } catch { /* the thread append is best-effort */ }
  try {
    markChatAnswered(huntId, q, { answer });
  } catch { /* the queue mark is best-effort */ }
  return recorded;
}
