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
import { getBalanceUsd } from '../billing/credits.js';
import { runAutonomousHunt, iterationPriceCents } from '../huntAgent.js';
import { chatWithAI, aiAvailable } from '../llm.js';
import { analyzeFindings } from '../hunt-intel/index.js';
import { loadHuntMemory, normTitle } from '../huntMemory.js';

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
];

export function looksHinglish(message) {
  const raw = String(message || '');
  if (/[\u0900-\u097F]/.test(raw)) return true;
  const words = new Set(raw.toLowerCase().match(/[a-z]+/g) || []);
  let hits = 0;
  for (const marker of HINGLISH_MARKERS) if (words.has(marker)) hits++;
  return hits >= 2;
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

export function recentAttempts({ events = [], reasoningRows = [], limit = 5 } = {}) {
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
    'Recent attempts: ' +
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
    const canPay = (user && user.role === 'admin') || getBalanceUsd(user.id) * 100 >= priceCents;
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

function detectSteering(message) {
  const m = String(message || '').toLowerCase();
  if (/\b(pause|hold|freeze)\b/.test(m) && /\b(hunt|it|scan)\b|\bpause\b/.test(m)) return 'pause';
  if (/\b(resume|continue|carry on)\b/.test(m)) return 'resume';
  if (/\b(stop|abort|cancel|kill)\b/.test(m) && /\b(hunt|scan|it)\b/.test(m)) return 'stop';
  if (/\b(what did you find|findings?|what('s| is) the status|status|progress|what are you (doing|up to)|summary)\b/.test(m))
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

  // Ownership check for hunt-scoped chat: your hunts are yours alone.
  if (huntId && req.user) {
    const meta0 = readHuntMeta(huntId);
    if (meta0 && meta0.userId && meta0.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ ok: false, error: 'forbidden' });
    }
  }

  const action = detectSteering(message);

  // No hunt context: answer steering only generically.
  if (!huntId) {
    if (action === 'pause' || action === 'resume' || action === 'stop') {
      return res.json({
        ok: true,
        reply:
          `I don't have a hunt attached to this chat. Open a hunt and chat from its view ` +
          `to ${action} it mid-hunt.`,
      });
    }
    if (action === 'summary') {
      return res.json({
        ok: true,
        reply: 'There is no hunt in context for this chat. Start a hunt first, then ask me about it.',
      });
    }
    // No hunt context: try the real AI; fall back to honest guidance.
    if (aiAvailable()) {
      const aiReply = await chatWithAI(
        [{ role: 'user', text: message }],
        'You are Dark Matter, an elite autonomous bug-bounty hunter by Obfinity. ' +
        'No hunt is attached to this chat yet. Answer helpfully and concisely.',
        { huntId: null }
      );
      if (aiReply) return res.json({ ok: true, reply: aiReply, ai: true });
    }
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
      return res.json({ ok: true, scoped: true, reply: offTopicDecline(message) });
    }
  }

  try {
    if (action === 'pause') {
      await pauseHuntResilient(huntId);
      return res.json({ ok: true, action: 'pause', reply: `Hunt paused. ${ctx}` });
    }
    if (action === 'resume') {
      await resumeHuntResilient(huntId, req.user);
      return res.json({ ok: true, action: 'resume', reply: `Hunt resumed. ${ctx}` });
    }
    if (action === 'stop') {
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
      return res.json({ ok: true, reply: summaryReply({ ctx, live, liveError, cached, findings, reasoningRows: memory.reasoningRows }) });
    }
    // Open questions: REAL AI with full hunt context (no hardcoded answers).
    if (aiAvailable()) {
      const system = buildHuntSystemPrompt({ huntId, meta, live, liveError, cached, findings });
      const aiReply = await chatWithAI([{ role: 'user', text: message }], system, { huntId });
      if (aiReply) return res.json({ ok: true, reply: aiReply, ai: true });
    }
    // AI unreachable: answer from real hunt data, not a generic fallback.
    return res.json({
      ok: true,
      reply: summaryReply({ ctx, live, liveError, cached, findings, reasoningRows: memory.reasoningRows }),
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
function buildHuntSystemPrompt({ huntId, meta, live, liveError, cached, findings }) {
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
  return (
    `You are Dark Matter, an elite autonomous bug-bounty hunter by Obfinity. ` +
    `You are mid-hunt and the user is chatting with you live. Think like a senior ` +
    `security researcher: be specific, technical, and honest about uncertainty. ` +
    `Never invent findings. If asked to pause/resume/stop, tell the user to use ` +
    `those exact words (the controls handle it deterministically).\n\n` +
    `Hunt ${huntId} on ${target}: state=${state}, phase=${phase}, ` +
    `${findings.length} finding(s), ${cached.length} event(s).` +
    (liveError ? ` Live engine unreachable — cached data only.` : '') +
    analysis +
    (findings.length
      ? `\nFindings: ${findings.slice(0, 8).map((f) => `[${f.severity || f.level || 'info'}] ${f.title || f.name || f.type}`).join('; ')}.`
      : `\nNo findings recorded yet.`) +
    (thinking.length
      ? `\nRecent thinking: ${thinking.map((t) => clipClean(t.text || t.summary || '', 200)).join(' | ')}`
      : '')
  );
}

function huntContextLine({ huntId, meta, live, liveError, cached, findings }) {
  const target = (live && live.target) || (meta && meta.target) || 'your target';
  const state = (live && (live.state || live.status)) || (meta && meta.state) || 'unknown';
  const step = (live && (live.stepCount ?? live.step_count)) ?? (meta && (meta.iteration ?? meta.stepCount));
  const phase = (live && live.phase) || (meta && meta.phase);
  const verified = confirmedTitles(findings).length;
  const stateWord = { running: 'actively hunting', paused: 'paused', stopped: 'stopped', starting: 'starting up' }[state] || state;
  let line = `Hunting ${target} — ${stateWord}`;
  if (phase) line += ` (${phase} phase)`;
  if (step !== undefined && step !== null) line += `, round ${step}`;
  line += `. ${findings.length} lead(s), ${verified} confirmed so far`;
  return line + '.';
}

function summaryReply({ ctx, live, liveError, cached, findings, reasoningRows = [] }) {
  const thinking = cached.filter((e) => e.type === 'thinking');
  const lastThink = thinking.length ? thinking[thinking.length - 1] : null;
  let reply = ctx;
  if (findings.length) {
    // Count CONFIRMED as unique titles, not raw stamps: a long hunt
    // stamps the same vulnerability many times, and "Found 5 confirmed"
    // for one vulnerability repeated five times is a false count —
    // the number and the list must agree.
    const titles = confirmedTitles(findings);
    if (titles.length) {
      reply +=
        ` Found ${titles.length} confirmed ${titles.length > 1 ? 'vulnerabilities' : 'vulnerability'}: ` +
        titles.slice(0, 5).join(', ') + '.';
    } else {
      reply += ` ${findings.length} lead(s) under investigation — nothing confirmed yet.`;
    }
  } else {
    reply += ' Still in early recon — no vulnerabilities found yet, but the hunt is methodically mapping your site.';
  }
  // What the hunter actually TRIED, from its own record — the counts
  // above never answered "kya kya try kiya?" (Lane S).
  const attempts = recentAttempts({ events: cached, reasoningRows });
  if (attempts) reply += ` ${attempts}`;
  if (lastThink && (lastThink.text || lastThink.summary)) {
    // Clip at a clean boundary: the raw slice cut a live reply
    // mid-word ("...sensitive in the FTP direct") (Lane S).
    const t = clipClean(lastThink.text || lastThink.summary, 200);
    if (t && !/unreachable|no reply/i.test(t)) reply += ` Currently: ${t}`;
  }
  return reply;
}

export default router;
