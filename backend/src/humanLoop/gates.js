// Split out of humanLoop.js by the P3 professionalization lane (split-only, no behaviour change).
// Moved verbatim; humanLoop.js re-exports the public names so callers are unchanged.

import { normalisedActionDetail, actionSignature, contentHash } from '../actionIdentity.js';
import { saveCredential, getCredential, generatePassword, generatePersonaUsername, scrubSecrets, touchCredential, markVerified, listCredentials, hostOf } from '../credentials.js';
import {
  startInterceptProxy,
  listIntercept,
  readInterceptEntry,
  buildReplayRequest,
  buildReplayCurl,
  replaySignature,
} from '../proxyIntercept.js';
import { COMMAND_CAP, OBS_BUDGET, clipResult, commandScopeViolation, heavyScanViolation, isReturnToTarget, lastActionResultOfLeftOff, pageUrlFromObservation, parseHumanAction, scopeViolation, targetHostOf, targetHostsFor } from './scope.js';
import { PROBE_TOPICS } from './research.js';

/**
 * Exact-repeat counts from the hunt's own tool_call record (Lane D,
 * 21 Oct 2026 — Ezviz audit). In the audited 24h, 59% of the hunter's
 * actions were exact repeats of an earlier action (browser_open of
 * the same login page ×27, the identical search ×17), because nothing
 * on the screen ever showed the hunter its own repetition — each new
 * session re-derived the same first moves from the same briefing.
 * This renders the counts as FACTS from the record. It forbids
 * nothing; the hunter stays the sole decision-maker.
 */
export function repetitionLines(events) {
  const counts = new Map();
  for (const e of events || []) {
    if (!e || e.type !== 'tool_call') continue;
    const detail = String(e.detail || '').trim();
    if (!detail) continue; // detail-less calls (snapshots) are not meaningful repeats
    const key = `${e.tool}|${detail}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const rows = [...counts.entries()]
    .map(([key, n]) => {
      const cut = key.indexOf('|');
      return { tool: key.slice(0, cut), detail: key.slice(cut + 1), n };
    })
    .filter((r) => (r.tool === 'search' ? r.n >= 3 : r.n >= 5))
    .sort((a, b) => b.n - a.n)
    .slice(0, 5);
  if (!rows.length) return [];
  return [
    'Exact repeats from your own record (same action, same input):',
    ...rows.map((r) => `- ${r.tool} ${r.detail} — ×${r.n}`),
    'An identical repeat returns the identical result; it only teaches something when something has changed.',
  ];
}

// ALREADY-DONE GATE (Lane F, 21 Oct 2026)
//
// The Repetition Check above only SHOWS the hunter its repeats, and
// the live Ezviz audit (21 Oct, ~22:05 IST) proved the 8B brain
// ignores what it is merely shown: 536 tool_call events, only 214
// unique — browser_open of the target root ×94, the identical search
// ×18, a marketing-button click ×6 in the last 60 actions. Memory
// that is only displayed is not memory that constrains. This gate
// enforces the record in deterministic code: an action whose
// signature already appears >= 2 times in the hunt's history is NOT
// executed; the brain gets an observation saying so (with the last
// result, when known) and must choose a different action.
//
// The gate covers exactly the action kinds whose recorded detail
// fully identifies the action: shell, search, browser_open,
// browser_click, browser_type. Deliberately NOT covered:
//   write_file — re-writing the same filename with new content is
//     how a human iterates on a script; the recorded detail (the
//     name) does not capture content, so a signature would
//     false-positive on legitimate work;
//   claim_finding — a claim is the verifier's call (assessResult),
//     never this gate's;
//   note / browser_snapshot / screenshot — no repeatable identity
//     (detail-less) or pure observation; repeating them harms nothing.
// First- and second-time actions pass untouched, and every existing
// gate (scope, heavy-scan, pacing, verifier) is exactly as it was —
// this only ever stops an action, never allows one.
//
// Lane U (23 Oct 2026): intercept_replay joins the gated set — it
// SENDS traffic to the target, and its recorded identity (capture
// index + final URL + header mods + body, via replaySignature) fully
// identifies the send, so an identical replay is the same mindless
// repeat the gate exists for. The other intercept actions stay OUT:
// proxy_start is an idempotent machine control (re-running it just
// reports state, like recall) and intercept_list / intercept_read
// only read the hunter's own capture file — reading the same page
// of your notebook twice harms nothing, exactly like
// browser_snapshot.

export const GATED_TOOLS = new Set(['shell', 'search', 'browser_open', 'browser_click', 'browser_type', 'intercept_replay', 'desktop_click', 'desktop_key', 'desktop_click_control', 'desktop_click_at', 'launch_tool', 'download_tool']);

const DEDUP_THRESHOLD = 2; // an action already run this many times is not run again

// Lane AF (24 Oct 2026): DEGRADED executions — a browser action
// whose observation was guiTools' headless look-only fallback (the
// desktop was down; the hunter never saw the real interactive
// page) — are not the work the gate exists to stop repeating: the
// DVWA hunt's only two opens were both fallbacks, the gate counted
// them as full runs, and then blocked the very open whose guiTools
// probe would have retried the desktop start (Lane Z/AB recovery
// only fires when a browser action EXECUTES). History therefore
// tracks, per signature, fullCount (real executions) separately
// from degradedStreak (fallback executions since the last full
// one): the gate blocks at DEDUP_THRESHOLD full executions — Lane
// F semantics, unchanged — or at DEGRADED_THRESHOLD degraded ones,
// so a desktop that never recovers still cannot loop forever. A
// full execution resets the streak. The degradation signal is
// guiTools' own `degraded` result flag, threaded through the
// loop's post-execution bookkeeping and persisted as a paired
// tool_degraded event, so a history rebuilt from the record
// (buildActionHistory) replays the identical accounting — one
// consistent record for the gate and Lane AD's settled lines.
const DEGRADED_THRESHOLD = 4; // fallback executions of one signature (since the last full one) before the gate blocks

/**
 * The hunt's executed-action history, built from its recorded
 * tool_call events: signature -> { tool, detail, count, fullCount,
 * degradedStreak, lastResult }. Detail-less calls and non-gated
 * tools carry no repeatable identity and are skipped. lastResult
 * is filled in live by the running session (events do not store
 * results); across sessions it stays empty and the gate's
 * observation simply omits it.
 *
 * Lane AF: `count` stays the total number of executions (what the
 * explored digest and Lane AD's settled lines have always read).
 * `fullCount` counts only executions that really ran (a browser
 * action on the live desktop, or any non-browser action);
 * `degradedStreak` counts consecutive look-only-fallback
 * executions since the last full one. A tool_call is replayed as
 * a full execution UNLESS its paired tool_degraded event follows
 * — the loop records that amendment in the same turn, right after
 * the execution it reclassifies — in which case the streak that
 * stood before it is restored and incremented instead. Records
 * written before this lane have no tool_degraded events, so every
 * execution in them replays as full, exactly as the gate judged
 * them at the time.
 */
export function buildActionHistory(events) {
  const history = new Map();
  const unamended = new Map(); // sig -> degradedStreak before the latest execution not yet amended
  for (const e of events || []) {
    if (!e) continue;
    if (e.type === 'tool_degraded') {
      const tool = String(e.tool || '').toLowerCase();
      if (!GATED_TOOLS.has(tool)) continue;
      if (!String(e.detail || '').trim()) continue;
      const sig = actionSignature(tool, e.detail);
      const cur = history.get(sig);
      if (cur && unamended.has(sig)) {
        cur.fullCount = Math.max(0, cur.fullCount - 1);
        cur.degradedStreak = unamended.get(sig) + 1;
        unamended.delete(sig);
      }
      continue;
    }
    if (e.type !== 'tool_call') continue;
    const tool = String(e.tool || '').toLowerCase();
    if (!GATED_TOOLS.has(tool)) continue;
    if (!String(e.detail || '').trim()) continue;
    const sig = actionSignature(tool, e.detail);
    let cur = history.get(sig);
    if (!cur) {
      cur = { tool, detail: normalisedActionDetail(tool, e.detail), count: 0, fullCount: 0, degradedStreak: 0, lastResult: '' };
      history.set(sig, cur);
    }
    cur.count++;
    cur.fullCount++;
    unamended.set(sig, cur.degradedStreak);
    cur.degradedStreak = 0;
  }
  return history;
}

/**
 * The "Already explored — do not repeat" digest for the screen:
 * deduped actions already run 3+ times (i.e. already past the gate),
 * grouped by kind, most-repeated first, capped at ~`limit` item
 * lines. Built from the same live history the gate enforces, so what
 * the hunter reads and what the code enforces can never disagree.
 */
export function exploredDigestLines(history, limit = 30) {
  const sections = [
    ['browser_open', 'Visited pages:'],
    ['search', 'Searches already run:'],
    ['shell', 'Shell commands already run:'],
    ['browser_click', 'Clicks already done:'],
    ['browser_type', 'Text already typed:'],
    ['intercept_replay', 'Replays already sent:'],
  ];
  const groups = [];
  for (const [tool, label] of sections) {
    const rows = [...(history || new Map()).values()]
      .filter((e) => e.tool === tool && e.count >= DEDUP_THRESHOLD + 1)
      .sort((a, b) => b.count - a.count);
    if (rows.length) groups.push({ label, rows });
  }
  if (!groups.length) return [];
  const lines = [
    '=== ALREADY EXPLORED — DO NOT REPEAT ===',
    'From your own record in THIS hunt: every action below has already been run 3 or more times. An identical repeat is stopped before it runs and wastes your turn — vary the page, the query or the approach, or act on what you already learned.',
  ];
  let used = 0;
  for (const { label, rows } of groups) {
    if (used >= limit) break;
    lines.push(label);
    for (const r of rows) {
      if (used >= limit) break;
      lines.push(`- ${r.detail} — ×${r.count}`);
      used++;
    }
  }
  return lines;
}

/**
 * The candidate action's identity in the same (tool, detail) form the
 * loop records via toolCall, or null when the gate does not cover the
 * action kind. The detail slicings mirror the ACT dispatch exactly,
 * so the gate compares like with like.
 */
function gatedCandidate(kind, action) {
  switch (kind) {
    case 'shell': return { tool: 'shell', detail: String(action.command || '').slice(0, COMMAND_CAP) };
    case 'search': return { tool: 'search', detail: String(action.query || '').slice(0, 200) };
    case 'browser_open': return { tool: 'browser_open', detail: String(action.url || '') };
    case 'browser_click': return { tool: 'browser_click', detail: String(action.text || '') };
    case 'browser_type': {
      const tgt = String(action.target || action.selector || '').trim();
      const txt = String(action.text || '').slice(0, 80);
      return { tool: 'browser_type', detail: tgt ? `${tgt} ← ${txt}`.slice(0, 80) : txt };
    }
    case 'desktop_click': return { tool: 'desktop_click', detail: String(action.window || '') };
    case 'desktop_key': return { tool: 'desktop_key', detail: String(action.keys || action.text || '').slice(0, 80) };
    case 'desktop_click_control': return { tool: 'desktop_click_control', detail: String(action.control || '').slice(0, 120) };
    case 'desktop_click_at': return { tool: 'desktop_click_at', detail: `${String(action.x ?? '')},${String(action.y ?? '')}` };
    // TOOLS/OS AUTONOMY (27 Oct 2026): launching / installing the
    // same tool twice is the same repeat the gate exists for (a
    // second Burp launch is a no-op that reports "already running",
    // and a second install re-runs apt for nothing). list_controls
    // stays OUT: it only reads the accessibility tree — reading the
    // same control list twice harms nothing, exactly like
    // browser_snapshot.
    case 'launch_tool': return { tool: 'launch_tool', detail: String(action.tool || '').slice(0, 80) };
    case 'download_tool': return { tool: 'download_tool', detail: String(action.tool || '').slice(0, 80) };
    // HUMAN-BRAIN: a visible terminal run IS a shell run for
    // dedupe — same command, same candidate, whichever channel ran
    // it first. (The gate compares like with like: the shell
    // branch's candidate is {tool:'shell', detail:command}.)
    case 'desktop_terminal': return { tool: 'shell', detail: String(action.command || '').slice(0, COMMAND_CAP) };
    case 'intercept_replay': return { tool: 'intercept_replay', detail: replaySignature(action) };
    default: return null;
  }
}

/**
 * Gate verdict for one parsed action against the hunt's history:
 * { tool, detail, count, fullCount, degradedStreak, lastResult }
 * when the identical action has already been executed >=
 * DEDUP_THRESHOLD times for real, or >= DEGRADED_THRESHOLD times
 * as look-only fallbacks since its last real execution (Lane AF),
 * else null. `count` in the verdict stays the TOTAL run count —
 * the figure the block observation, the dedup_block event and
 * Lane AD's settled lines have always carried.
 */
// SELF-AUTH CHAIN (27 Oct 2026, owner order) — the actions that make an
// account YOURSELF: vault a credential, fill a form from the vault, poll
// your temp-mail inbox for the verification code.
const SELF_AUTH_TOOLS = new Set(['save_credential', 'use_saved_credential', 'fetch_verification_code']);

/**
 * Has this hunt already tried to make the account itself for `site`?
 * True when any tool_call in the hunt's events is a self-auth action whose
 * recorded detail (the credential handle, cred:<host>:<hex>) names the
 * site's host. Pure — the request_details guard and the tests share it.
 */
export function hasSelfAuthAttempt(events, site) {
  const host = hostOf(String(site || ''));
  if (!host) return false;
  for (const e of Array.isArray(events) ? events : []) {
    if (e && e.type === 'tool_call' && SELF_AUTH_TOOLS.has(e.tool) && String(e.detail || '').includes(host)) return true;
  }
  return false;
}

// Take Control of This Machine — the action kinds that DRIVE the
// desktop (CDP browser actions + the vault fill that clicks/types).
// While the owner holds the control lock these are skipped, never
// executed, so the agent's clicks can never fight the owner's input.
// Everything else (shell, search, recall, planning, coverage) keeps
// running — the hunt itself is never paused by a takeover.
export const GUI_CONTROL_KINDS = new Set([
  'browser_open',
  'browser_snapshot',
  'browser_click',
  'browser_type',
  'screenshot',
  'use_saved_credential',
  // WHOLE-OS CONTROL (26 Oct 2026): the desktop actions drive the
  // same X server the owner drives while holding Take Control, so
  // they pause under the lock exactly like the browser actions.
  'desktop_snapshot',
  'desktop_click',
  'desktop_key',
  'desktop_screenshot',
  // REAL-HUMAN (26 Oct 2026): clicking a named control inside a
  // GUI app drives the same X server — it pauses under Take
  // Control exactly like the other desktop actions.
  'desktop_click_control',
  // SCREEN-SEEING (27 Oct 2026): reading the screen (scrot) and
  // clicking at map coordinates drive the same X server — they
  // pause under Take Control exactly like the other desktop actions.
  'see_screen',
  'desktop_click_at',
  // TOOLS/OS AUTONOMY (27 Oct 2026): launching a GUI tool opens a
  // window on the same X server, and listing its controls reads the
  // same session bus — both pause under Take Control. Installing a
  // tool is a headless container exec (like shell) and stays out.
  'launch_tool',
  'list_controls',
  // HUMAN-BRAIN (26 Oct 2026): the visible terminal types into the
  // same X server — it pauses under Take Control like the other
  // desktop actions.
  'desktop_terminal',
]);

// The screen reads that prove the brain looked at the page again
// (the same read set the auth gate's FRESH_ATTEMPT_TOOLS carries).
// DEDUP FRESH-ATTEMPT EXEMPTION (dedup-submit lane, 28 Oct 2026)
//
// Live failure (DVWA hunt h_830317bdc184, 28 Oct 2026): the exact-repeat
// dedupe gate (Lane F, threshold 2) blocked the brain's browser_click
// Submit 9 times (03:36, 03:40, 04:03, 05:55, 07:01, 08:20 IST and
// more) and blocked re-typing the same UNION payload. The Submit
// click is IDENTICAL every time whatever was typed into the form, so
// each retry looked like a blind repeat — even when the brain had
// looked at the page again, typed a NEW proof marker into the form,
// or reloaded the page (which empties the form) since the last
// Submit. The visible-browser submit path stayed closed, so the
// brain's evidence came from shell probes instead of the visible
// browser — the proof gate (PROOF_THRESHOLD=3) could nudge it to
// file, but could never reopen the submit itself.
//
// The fix extends the fresh-attempt logic (184ec79's
// freshAttemptSinceType, auth-loop limb) to the dedupe gate: a
// repeat of an identical action is a loop ONLY when nothing fresh
// happened since the last identical execution. A repeat is ALLOWED
// when the ordered record shows, after that execution:
//   - a fresh screen read (browser_snapshot / see_screen /
//     desktop_snapshot) — the brain looked at the page again;
//   - a click / type / key DIFFERENT from the repeated action —
//     the brain moved the form forward (a new proof marker typed
//     into it, another field clicked);
//   - a page reload / navigate (browser_open) — the page state
//     refreshed (a reload empties the form, so a re-type + re-submit
//     acts on a fresh form).
// Shell / search / recall since then do NOT count: they change
// nothing about the page the action acts on (the auth gate reads
// them the same way). A blocked action never counts either — only
// executed tool_call events are read, so a dedup_block cannot
// launder its own repeat.
//
// Scope: the exemption applies only to the GUI action kinds — the
// actions that act on GUI state (browser_click, browser_type,
// browser_open, desktop_click, desktop_click_at,
// desktop_click_control, desktop_key). Shell, search,
// launch_tool, download_tool and intercept_replay stay under the
// old rule: a screen read changes nothing about what a curl returns
// or a search finds, and their re-asks are already answered from
// the record (output ledger / near-duplicate gate). A new proof
// marker needs no exemption for shell — the marker is IN the
// command, so a fresh marker is already a different signature.
//
// Loop protection (unchanged in strength): the exemption is
// PER-REPEAT — freshAttemptSinceAction only looks AFTER the last
// identical execution. Once the exempted execution runs, it
// becomes the new anchor, and the earlier fresh event (now BEFORE
// the anchor) no longer counts. Each repeat past the threshold
// needs NEW fresh work after the previous execution, so the worst
// case is one extra execution per fresh event, never an unbounded
// loop from a single snapshot. The backstops stand: the
// exhausted-surface gate is judged BEFORE dedupe (a closed surface
// still blocks whatever the freshness), the auth gate fires first
// on the sign-in page (a reload-only re-type there is still an
// auth_loop per AJ-11 — browser_open does not exempt the auth
// gate), and the proof gate is judged when dedupe stands aside,
// so a claim proven PROOF_THRESHOLD times is still nudged to file
// instead of re-proved. Without an events record (ctx absent) the
// old behaviour holds unchanged.

// The screen reads that prove the brain looked at the page again
// (the same read set the auth gate's FRESH_ATTEMPT_TOOLS carries).

const FRESH_READ_TOOLS = new Set(['browser_snapshot', 'see_screen', 'desktop_snapshot']);

// GUI action kinds whose repeat the fresh-attempt exemption can lift.
export const FRESH_DEDUP_KINDS = new Set([
  'browser_click',
  'browser_type',
  'browser_open',
  'desktop_click',
  'desktop_click_at',
  'desktop_click_control',
  'desktop_key',
]);

// GUI actions that move the form forward when DIFFERENT from the
// repeated action: a click into another field, a different text
// typed (a new proof marker), a different key pressed. An
// identical one is the anchor itself and never counts.
const FRESH_FORWARD_TOOLS = new Set([
  'browser_click',
  'browser_type',
  'desktop_click',
  'desktop_click_at',
  'desktop_click_control',
  'desktop_key',
]);

/**
 * True when the hunt's ordered record shows fresh GUI work after
 * the last identical execution of (tool, detail): the brain looked
 * at the screen again, clicked / typed / pressed something
 * DIFFERENT, or reloaded / navigated the page. A repeat after such
 * work is a fresh attempt at the action — e.g. the form was
 * reloaded and emptied, or a new proof marker was typed into it
 * since the last Submit — not a blind repeat. False when the last
 * identical execution is still the latest GUI work (a genuine
 * loop), when the record holds no such execution (conservative:
 * the caller falls back to the history count alone), or when the
 * only work since was shell / search / recall. Pure.
 */
export function freshAttemptSinceAction(events, tool, detail) {
  const list = Array.isArray(events) ? events : [];
  const sig = actionSignature(String(tool || ''), String(detail || ''));
  let lastIdx = -1;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (!e || e.type !== 'tool_call') continue;
    if (actionSignature(String(e.tool || ''), String(e.detail || '')) === sig) lastIdx = i;
  }
  if (lastIdx < 0) return false;
  for (let i = lastIdx + 1; i < list.length; i++) {
    const e = list[i];
    if (!e || e.type !== 'tool_call') continue;
    const t = String(e.tool || '').toLowerCase();
    if (FRESH_READ_TOOLS.has(t)) return true;
    if (t === 'browser_open') return true; // reload / navigate — the page state refreshed
    if (FRESH_FORWARD_TOOLS.has(t) && actionSignature(t, String(e.detail || '')) !== sig) return true;
  }
  return false;
}

export function dedupeGateHit(kind, action, history, ctx) {
  const cand = gatedCandidate(String(kind || '').toLowerCase(), action || {});
  if (!cand || !cand.detail.trim()) return null;
  const entry = (history || new Map()).get(actionSignature(cand.tool, cand.detail));
  if (!entry) return null;
  const fullCount = entry.fullCount != null ? entry.fullCount : entry.count;
  const degradedStreak = entry.degradedStreak || 0;
  if (fullCount < DEDUP_THRESHOLD && degradedStreak < DEGRADED_THRESHOLD) return null;
  // FRESH ATTEMPT (see header above): a repeat is a loop only when
  // the last identical execution is still the latest GUI work.
  // When the record shows the brain looked again, moved the form
  // forward, or reloaded the page since then, the retry is a fresh
  // attempt and the gate stands aside. Without an events record
  // (ctx absent) the old behaviour holds: any repeat past the
  // threshold is a loop.
  if (FRESH_DEDUP_KINDS.has(cand.tool) && freshAttemptSinceAction(ctx && ctx.events, cand.tool, cand.detail)) return null;
  return { tool: cand.tool, detail: entry.detail, count: entry.count, fullCount, degradedStreak, lastResult: entry.lastResult || '' };
}

// NEAR-DUPLICATE SEARCH GATE (REAL-HUMAN, 26 Oct 2026 — owner
// clarification 14:18 IST: the repeated-search loop is the same
// disease as the repeated skill-load loop).
//
// The exact-repeat dedupe gate (Lane F) stops a search only when
// the query string is identical. The 8B brain re-asks the same
// question in slightly different words — "sql injection login
// bypass" then "SQL injection login bypass techniques" — and each
// rewording sails past the exact gate, burns a turn, and returns
// the same results it already has. This gate compares TOKEN SETS:
// a search whose words are (nearly) all words of an already-run
// search is the same question, whatever the word order or the
// filler words. The block is the same dedup_block shape (countable
// event + BLOCKED observation naming the earlier search and its
// outcome), so monitors read it exactly like an exact repeat.
//
// Thresholds, chosen to never block a genuinely new question:
// Jaccard >= 0.75, or the smaller token set fully inside the
// larger one (a subset — "xss payload" after "xss payload list").
// Both need >= 2 tokens on the smaller side, so a one-word query
// can never be "similar" to everything. Stopwords and case /
// punctuation / word order carry no meaning here. And the block
// fires only when the question's FAMILY has already run
// DEDUP_THRESHOLD times in any wording — a question asked once
// may be re-asked once, exactly like Lane F's exact-repeat
// tolerance; the third asking is blocked. (A single-run family
// must never block: the coverage-ledger and working-memory suites
// legitimately re-run a search once across sessions.)

const SEARCH_STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'on', 'in', 'to', 'for', 'how',
  'what', 'is', 'are', 'was', 'were', 'with', 'by', 'from', 'at', 'vs',
  'about', 'into', 'using', 'use', 'used', 'via', 'per', 'please',
  'me', 'my', 'this', 'that', 'these', 'those', 'it', 'its', 'be',
]);

/** The meaning-bearing tokens of a search query. Pure. */
export function searchQueryTokens(query) {
  const tokens = String(query || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !SEARCH_STOPWORDS.has(t));
  return new Set(tokens);
}

/** Jaccard similarity of two token sets (0 when either is empty). Pure. */
export function searchTokenSimilarity(a, b) {
  const setA = a instanceof Set ? a : new Set(a || []);
  const setB = b instanceof Set ? b : new Set(b || []);
  if (!setA.size || !setB.size) return 0;
  let inter = 0;
  for (const t of setA) if (setB.has(t)) inter++;
  return inter / (setA.size + setB.size - inter);
}

export const SEARCH_REPEAT_JACCARD = 0.75;

/**
 * The near-duplicate verdict for one search against the hunt's
 * action history: { tool: 'search', detail, earlier, similarity,
 * lastResult, familyCount } when the same question has already
 * been asked DEDUP_THRESHOLD times (in any wording), else null.
 *
 * The count is a FAMILY count: every earlier search whose words
 * cover the new query adds its fullCount. A question asked once
 * may be re-asked once (the same tolerance Lane F gives an exact
 * repeat); the third asking — exact or reworded — is blocked.
 * Only EXECUTED searches count — a search that was itself blocked
 * never "answered" the question. The most similar earlier search
 * wins as the named `earlier`. Pure.
 */
export function searchRepeatHit(query, history) {
  const tokens = searchQueryTokens(query);
  if (tokens.size < 2) return null;
  let best = null;
  let familyCount = 0;
  for (const entry of (history || new Map()).values()) {
    if (!entry || String(entry.tool || '').toLowerCase() !== 'search') continue;
    const fullCount = entry.fullCount != null ? entry.fullCount : entry.count;
    if (!fullCount || fullCount < 1) continue;
    const earlierTokens = searchQueryTokens(entry.detail || '');
    if (earlierTokens.size < 2) continue;
    const sim = searchTokenSimilarity(tokens, earlierTokens);
    const smaller = Math.min(tokens.size, earlierTokens.size);
    let inter = 0;
    for (const t of tokens) if (earlierTokens.has(t)) inter++;
    const subset = inter >= smaller;
    if (sim >= SEARCH_REPEAT_JACCARD || subset) {
      familyCount += fullCount;
      if (!best || sim > best.similarity) {
        best = {
          tool: 'search',
          detail: String(query || '').slice(0, 200),
          earlier: String(entry.detail || '').slice(0, 200),
          similarity: sim,
          lastResult: entry.lastResult || '',
        };
      }
    }
  }
  if (!best || familyCount < DEDUP_THRESHOLD) return null;
  return { ...best, familyCount };
}

// AUTH-LOOP GATE (Lane AJ, 24 Oct 2026)
//
// Observed failure (Infomaniak hunt, live): the hunter saved a vault
// credential, then typed the username into a page whose snapshot it
// had itself described as EMPTY ("I have just taken a snapshot of
// an empty page"), then claimed "I've just logged in" — while its
// own next observation showed the dashboard redirecting back to the
// sign-in page. It then re-typed the same username, which the
// already-done gate blocked only on the 2nd repeat. Two
// deterministic gaps, both closed here, in the same shape as Lane F
// (block + event + note + an observation that redirects, never a
// prompt hint):
//
//  1. EMPTY SNAPSHOT: browser_type / browser_click may not run when
//     the last observation is an empty page snapshot (or there is no
//     observation yet — the page has never been seen). A human cannot
//     type into a page they cannot see; the action is blocked with
//     "take browser_snapshot first".
//  2. AUTH LOOP: browser_type with text already typed once, while
//     the current page is still a sign-in / authorize page (the last
//     observation names a login URL or a sign-in form), is blocked
//     from the FIRST repeat — typing the same username again changes
//     nothing, because the page itself proves the login did not
//     happen. The redirect names the moves that would: finish the
//     signup (the "Create an account" link), fetch the verification
//     code from temp mail, or snapshot the form and read its exact
//     fields. Typing a DIFFERENT text (e.g. the password after the
//     username) is a different action and is never blocked by this
//     gate; non-login pages are never gated by it either.
//
//  3. FRESH ATTEMPT (visible-desktop lane, 27 Oct 2026 — live
//     DVWA hunt h_830317bdc184, 23:44-23:48 IST): the brain typed
//     'admin' (22:50 IST), typed 'password' (23:06 IST), snapshotted
//     the form ("username field looking doubled up"), reloaded it
//     (browser_open login.php), worked shell login scripts for ~20
//     min, then came back to the GUI and typed 'admin' again —
//     into a form the reload had emptied. The gate blocked it 3x
//     as auth_loop, because limb 2 counts ANY prior identical type
//     in the hunt's whole record, however old, and knows nothing
//     about what happened since: no fresh look, no sequence
//     advance, no reload. The brain fell back to shell curls and
//     the visible login never happened. So a re-type is a loop
//     ONLY when nothing fresh happened since the last identical
//     type: a fresh screen read (browser_snapshot / see_screen /
//     desktop_snapshot), a click into the form, or typing a
//     DIFFERENT text since then makes it a fresh attempt, not a
//     loop — the brain looked again / moved the login forward.
//     browser_open deliberately does NOT exempt: the open that
//     first puts the brain on the login page is not a reset
//     (AJ-11), and shell/search/recall change nothing about the
//     form. The dedupe gate (Lane F, threshold 2) stays the
//     backstop: even a fresh attempt is never executed a third
//     time, so the worst case is one extra type, never a loop.

export const LOGIN_PAGE_RE = /\/login|\/authorize|login\.|sign[\s-]?in/i;

// Tools whose recorded execution after the last identical type
// proves the brain looked at the form again or moved the login
// forward — a fresh screen read, or a click into the form.
// (A different browser_type is handled separately below: it is
// the login sequence advancing past this text.)
const FRESH_ATTEMPT_TOOLS = new Set([
  'browser_snapshot',
  'see_screen',
  'desktop_snapshot',
  'browser_click',
  'desktop_click',
  'desktop_click_at',
  'desktop_click_control',
]);

/**
 * True when the hunt's ordered record shows fresh GUI work after
 * the last identical browser_type (signature `sig`): the brain
 * looked at the screen again, clicked in the form, or typed a
 * DIFFERENT text. A re-type after such work is a fresh attempt at
 * the login — e.g. the form was reloaded and emptied since the
 * last type — not a blind repeat. False when the last identical
 * type is the latest GUI work (a genuine loop), or when the record
 * does not contain that type at all (conservative: the caller
 * falls back to the history count alone).
 */
export function freshAttemptSinceType(events, sig) {
  const list = Array.isArray(events) ? events : [];
  let lastTypeIdx = -1;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (!e || e.type !== 'tool_call') continue;
    if (String(e.tool || '').toLowerCase() !== 'browser_type') continue;
    if (actionSignature('browser_type', String(e.detail || '')) === sig) lastTypeIdx = i;
  }
  if (lastTypeIdx < 0) return false;
  for (let i = lastTypeIdx + 1; i < list.length; i++) {
    const e = list[i];
    if (!e || e.type !== 'tool_call') continue;
    const t = String(e.tool || '').toLowerCase();
    if (FRESH_ATTEMPT_TOOLS.has(t)) return true;
    if (t === 'browser_type' && actionSignature('browser_type', String(e.detail || '')) !== sig) return true;
  }
  return false;
}

export function authGateHit(kind, action, history, lastObservation, ctx) {
  const k = String(kind || '').toLowerCase();
  if (k !== 'browser_type' && k !== 'browser_click') return null;
  const obs = String(lastObservation || '');
  // WRONG-PAGE GUARD: the driver's own refusal is authoritative —
  // it already names the page and the way back. Do NOT let the auth
  // gate misfire on it (a foreign URL can contain "/login" and the
  // empty-snapshot check would otherwise swallow the refusal and
  // send the agent snapshotting a page that is not the target).
  if (obs.startsWith('WRONG PAGE —')) return null;
  // 1. Never type/click blind: the last snapshot was empty (or the
  // page has never been observed at all this session).
  if (obs.includes('(empty page snapshot)') || obs.trim() === '') {
    return {
      reason: 'empty_snapshot',
      tool: k,
      detail: String((action && action.text) || '').slice(0, 80),
      redirect:
        'The last page snapshot was empty — the page had not loaded, or you have not looked at it yet. Take browser_snapshot first, read the form fields it lists, and only then type or click.',
    };
  }
  // 2. Still on the sign-in page + same credential text as before.
  if (k === 'browser_type' && LOGIN_PAGE_RE.test(obs)) {
    const text = String((action && action.text) || '').trim();
    if (!text) return null;
    const sig = actionSignature('browser_type', text.slice(0, 80));
    const entry = (history || new Map()).get(sig);
    const typedBefore = entry ? (entry.fullCount != null ? entry.fullCount : entry.count) : 0;
    // FRESH ATTEMPT (see header note 3): a re-type is a loop only
    // when the last identical type is still the latest GUI work.
    // When the record shows the brain looked at the form again,
    // clicked into it, or typed a different text since then, the
    // retry is a fresh attempt — the form may have been reloaded
    // and emptied in between — and the gate stands aside. Without
    // an events record (ctx absent) the old behaviour holds: any
    // prior identical type on the sign-in page is a loop.
    if (typedBefore >= 1 && !freshAttemptSinceType(ctx && ctx.events, sig)) {
      return {
        reason: 'auth_loop',
        tool: 'browser_type',
        detail: text.slice(0, 80),
        redirect:
          'You are still on the sign-in page — the dashboard sent you back here, so you are NOT logged in, and typing the same username again changes nothing. Do one of these instead: (1) finish the signup first — open the "Create an account" link, complete the form, then fetch_verification_code from your temp mail; (2) snapshot the sign-in form and read its exact fields before typing anything; (3) if the account exists, type the PASSWORD (a different text) — never the username again.',
      };
    }
  }
  return null;
}

/** True when a tool_call detail carries a probe payload for ANY class (the researchedTopicStats definition of "probed"). */
export function isProbeDetail(detail) {
  const d = String(detail || '');
  if (!d) return false;
  for (const topic of PROBE_TOPICS) {
    if (topic.re.test(d)) return true;
    if ((topic.probes || []).some((re) => re.test(d))) return true;
  }
  return false;
}
