// Split out of humanLoop.js by the P3 professionalization lane (split-only, no behaviour change).
// Moved verbatim; humanLoop.js re-exports the public names so callers are unchanged.

import { normalisedActionDetail, actionSignature, contentHash } from '../actionIdentity.js';
import { PROBE_TOPICS, buildMemoryBriefing, clipLine, coverageObservation, discoveredEndpoints, findingsFromEvents, mergeLeadsWithCoverage, reconcileSessionResearch, researchedNotProbedLines, researchedTopicStats, systemPromptFor, unprobedLeadLines } from './research.js';
import { GATED_TOOLS, GUI_CONTROL_KINDS, LOGIN_PAGE_RE, authGateHit, buildActionHistory, dedupeGateHit, exploredDigestLines, hasSelfAuthAttempt, repetitionLines, searchRepeatHit } from './gates.js';

// SETTLED ACTIONS + FAILED-SKILL MEMORY (Lane AD, 24 Oct 2026)
//
// The gate above stops repeat TRAFFIC, but the live audit behind
// this lane (reasoning logs measured 24 Oct 2026) showed it does
// not stop the repeat CHOICE: on the Ezviz hunt 173 of 791 human
// turns (21.9%) were dedup_block re-choices — browser_open of
// /rest/user/register alone was chosen ×62 AFTER the gate had
// already blocked it, each one burning a full brain generation.
// Lane P's "Do NOT retry" hand-off threads and the explored digest
// state the prohibition; what they never do is correct the stale
// PREMISE the brain re-derives every turn from its summary —
// "the registration endpoint has been visited multiple times
// without being probed" — nor state that re-OPENING a page cannot
// satisfy a probing intent (a probe is a request WITH a payload:
// a different action family). Memory that merely forbids is
// overridden by a belief that still looks true.
//
// settledActionLines closes that gap deterministically from the
// hunt's own record: any gated signature the gate has blocked
// >= SETTLED_MIN_BLOCKS times is rendered in the screen's
// never-trimmed continuity region (beside the Lane T thread,
// outside every cap — Lane Q's SOM budget is untouched because
// this is the screen region, not the SOM) as a SETTLED fact:
// how many times it ran, how many times it was blocked, how many
// requests were already SENT to that path, and — for a plain
// page-open — the redirect to the action families that would
// actually test the endpoint. Bounded: top SETTLED_LIMIT entries
// by block count, each line clipped to SETTLED_LINE_CAP chars
// (SETTLED_EVIDENCE_LINE_CAP when Lane AH's evidence rides it).
//
// The sibling failure (Juice, same audit): load_skill is
// deliberately NOT dedupe-gated (re-pulling a real card after the
// context rolls is legitimate), so a name that does not exist —
// "ftp" — was asked, answered with "No skill card named" plus the
// full index, and re-asked verbatim the next turn. failedSkillAsks
// rebuilds the failed-name set from the reasoning record; the loop
// answers a verbatim repeat from that record in the dedup_block
// turn-shape (event + note + BLOCKED observation naming the real
// cards) WITHOUT re-running the lookup. Only the exact repeat of
// a name that already failed is gated — every other load_skill
// behaves exactly as Lane M built it.

const SETTLED_MIN_BLOCKS = 3; // gate blocks before an action is carried as settled

const SETTLED_LIMIT = 5; // settled entries on screen, most-blocked first

const SETTLED_LINE_CAP = 220; // chars per settled entry without request evidence

const SETTLED_EVIDENCE_LINE_CAP = 420; // chars per settled entry carrying last-request evidence (Lane AH)

const SETTLED_EVIDENCE_DETAIL_CAP = 100; // chars of the most-recent request shown (Lane AG evidence + Lane AH settled lines)

const SETTLED_EVIDENCE_OUTCOME_CAP = 60; // chars of its recorded outcome shown

/**
 * Requests already SENT to a URL's path, from the executed record:
 * shell commands and intercept replays whose recorded detail names
 * the path. This is the fact that falsifies "visited but not
 * probed" — a GET page-open is a look; these were sends. One
 * implementation serves both Lane AD's settled lines (the count)
 * and Lane AG's block evidence (the count + the most recent send).
 */
function requestsToPath(events, detail) {
  let pathname = '';
  try {
    pathname = new URL(detail).pathname || '';
  } catch {
    return [];
  }
  if (!pathname || pathname === '/') return [];
  const hits = [];
  for (const e of events || []) {
    if (!e || e.type !== 'tool_call') continue;
    if (e.tool !== 'shell' && e.tool !== 'intercept_replay') continue;
    if (String(e.detail || '').includes(pathname)) hits.push(e);
  }
  return hits;
}

function requestsSentToPath(events, detail) {
  return requestsToPath(events, detail).length;
}

/**
 * The most recent request SENT to a URL's path (same matching as
 * requestsSentToPath), with the outcome the live history recorded
 * for it when it holds one — events never store results, so across
 * sessions the outcome is simply absent, never invented.
 */
function lastRequestToPath(events, history, detail) {
  const hits = requestsToPath(events, detail);
  if (!hits.length) return null;
  const last = hits[hits.length - 1];
  const entry = (history || new Map()).get(actionSignature(last.tool, last.detail));
  return {
    tool: String(last.tool || ''),
    detail: String(last.detail || ''),
    outcome: entry ? String(entry.lastResult || '') : '',
  };
}

/**
 * The compact ", most recent: <request> → <outcome>" suffix naming
 * the last request SENT to a path — the ONE formatter both Lane
 * AG's block evidence and Lane AH's settled lines render, so the
 * within-session channel and the persistent channel can never
 * phrase the same fact differently. '' when no request to the
 * path is on record; the outcome arrow appears only when the
 * record actually holds an outcome (never invented).
 */
function lastRequestSnippet(events, history, detail) {
  const last = lastRequestToPath(events, history, detail);
  if (!last) return '';
  let snippet = `, most recent: ${clipLine(last.detail, SETTLED_EVIDENCE_DETAIL_CAP)}`;
  if (last.outcome) snippet += ` → ${clipLine(last.outcome, SETTLED_EVIDENCE_OUTCOME_CAP)}`;
  return snippet;
}

/**
 * dedup_block counts per signature — the block timeline both Lane
 * AD (settled lines) and Lane AG (settled block evidence) read.
 */
function settledBlockCounts(events) {
  const blocks = new Map();
  for (const e of events || []) {
    if (!e || e.type !== 'dedup_block') continue;
    const tool = String(e.tool || '').toLowerCase();
    if (!tool || !String(e.detail || '').trim()) continue;
    const sig = actionSignature(tool, e.detail);
    blocks.set(sig, (blocks.get(sig) || 0) + 1);
  }
  return blocks;
}

/**
 * The settled facts themselves, shared by Lane AD's screen lines
 * and Lane AG's block evidence so the two can never disagree about
 * what is settled: signatures the gate has blocked >=
 * SETTLED_MIN_BLOCKS times THAT ALSO have executed history (a
 * block stream for an action that never executed through the gate
 * — e.g. the load_skill repeats — is not a settled action),
 * most-blocked first.
 */
function settledFacts({ events = [], history = null } = {}) {
  const hist = history || buildActionHistory(events);
  const blocks = settledBlockCounts(events);
  const rows = [];
  for (const [sig, blockCount] of blocks) {
    if (blockCount < SETTLED_MIN_BLOCKS) continue;
    const entry = hist.get(sig);
    if (!entry) continue;
    rows.push({ tool: entry.tool, detail: entry.detail, count: entry.count, blockCount });
  }
  rows.sort((a, b) => b.blockCount - a.blockCount || a.detail.localeCompare(b.detail));
  return rows;
}

/**
 * The SETTLED block for the hunter's screen, or [] when nothing
 * has been blocked often enough to settle. Pure over the hunt's
 * records: dedup_block events are the block timeline (the gate
 * records one per blocked attempt), the executed-action history
 * (buildActionHistory — live in-session) supplies run counts.
 * Only signatures WITH executed history render: a block stream
 * for an action that never executed through the gate (e.g. the
 * load_skill repeats handled separately below) is not a settled
 * action and never appears here — the two mechanisms stay
 * disjoint, as Lane T and Lane P are.
 */
// SETTLED-EVIDENCE PERSISTENCE (Lane AH, 24 Oct 2026)
//
// Lane AG put the counter-evidence where the brain demonstrably
// looks — the block observation — but an observation lives for
// exactly one session: sessions roll every 6 turns and on every
// generation failure, and Ezviz's first evidence-receiving
// session died before its next choice, so the following
// re-choice was made from a fresh screen carrying only Lane AD's
// counts. AD's settled lines are the one surface that survives
// every roll, yet a bare count ("requests sent ×7") never
// falsified the premise the way the named request does. Lane AH
// therefore carries AG's specifics — the most recent request
// sent to the path and its recorded outcome, via the shared
// lastRequestSnippet — on AD's persistent lines. A line for an
// action with no request on record renders byte-for-byte as
// Lane AD left it (same text, same SETTLED_LINE_CAP clip); an
// evidence-carrying line clips at SETTLED_EVIDENCE_LINE_CAP
// instead. The gate is untouched — this lane changes only how
// long the evidence LIVES.

/**
 * The SETTLED block for the hunter's screen, or [] when nothing
 * has been blocked often enough to settle. Pure over the hunt's
 * records: dedup_block events are the block timeline (the gate
 * records one per blocked attempt), the executed-action history
 * (buildActionHistory — live in-session) supplies run counts.
 * Only signatures WITH executed history render: a block stream
 * for an action that never executed through the gate (e.g. the
 * load_skill repeats handled separately below) is not a settled
 * action and never appears here — the two mechanisms stay
 * disjoint, as Lane T and Lane P are.
 */

export function settledActionLines({ events = [], history = null } = {}) {
  const hist = history || buildActionHistory(events);
  const top = settledFacts({ events, history: hist }).slice(0, SETTLED_LIMIT);
  if (!top.length) return [];
  const lines = ['=== SETTLED — YOUR RECORD HAS ALREADY ANSWERED THESE (stop re-choosing them) ==='];
  for (const r of top) {
    let line = `- ${r.tool} ${r.detail} — run ×${r.count}, blocked ×${r.blockCount}.`;
    let cap = SETTLED_LINE_CAP;
    if (r.tool === 'browser_open') {
      const sent = requestsSentToPath(events, r.detail);
      if (sent > 0) {
        const snippet = lastRequestSnippet(events, hist, r.detail);
        line += ` requests sent ×${sent}${snippet}.`;
        if (snippet) cap = SETTLED_EVIDENCE_LINE_CAP;
      }
      line += ' Opening probes nothing (same captured page). To test it, SEND a request: curl with a payload, or type + submit.';
    } else {
      line += ' An identical repeat returns the identical result — vary the input or move on.';
    }
    lines.push(clipLine(line, cap));
  }
  return lines;
}

/**
 * The Lane AG addition to a dedupe-gate block observation, or ''
 * when the blocked action is not settled. `extraBlocks` counts a
 * block the caller has just recorded but the events snapshot
 * predates (the gate records the current block before composing
 * its observation; the ordinal the hunter reads must include it —
 * and must agree with the "blocked ×N" its next screen's settled
 * line will show, which counts the same recorded events).
 */
// SETTLED BLOCK EVIDENCE (Lane AG, 24 Oct 2026)
//
// Lane AD put the settled facts in the screen preamble — and the
// live Ezviz brain walked straight past them: both post-AD turns
// re-chose the settled register open (blocks 65 and 66), each
// opening with the identical premise "the registration endpoint
// has been visited multiple times without being probed", refuted
// on the same screen by "requests sent ×7". What the record shows
// the brain actually building its next turn from is the last
// RESULT text — every WHY echoes it. So when the gate blocks an
// action that is SETTLED (Lane AD's own definition, via the
// shared settledFacts/settledBlockCounts above — never a second
// counting implementation), the counter-evidence moves into the
// block observation itself: the block ordinal, the requests
// actually SENT to the path with the most recent one and its
// recorded outcome, and the same redirect AD states. A settled
// open whose path genuinely has no request on record says so
// truthfully instead of borrowing the falsifier. Non-settled
// blocks return '' here and keep the existing observation
// byte-for-byte. The block stays a block — this lane changes
// only what the block SAYS.

// The evidence snippet caps (SETTLED_EVIDENCE_DETAIL_CAP /
// SETTLED_EVIDENCE_OUTCOME_CAP) live with the settled constants
// above — Lane AH's settled lines share them via lastRequestSnippet.

/**
 * The Lane AG addition to a dedupe-gate block observation, or ''
 * when the blocked action is not settled. `extraBlocks` counts a
 * block the caller has just recorded but the events snapshot
 * predates (the gate records the current block before composing
 * its observation; the ordinal the hunter reads must include it —
 * and must agree with the "blocked ×N" its next screen's settled
 * line will show, which counts the same recorded events).
 */

export function settledBlockEvidence({ events = [], history = null, tool, detail, extraBlocks = 0 } = {}) {
  const t = String(tool || '').toLowerCase();
  if (!t || !String(detail || '').trim()) return '';
  const hist = history || buildActionHistory(events);
  const sig = actionSignature(t, detail);
  const entry = hist.get(sig);
  if (!entry) return '';
  const blockCount = (settledBlockCounts(events).get(sig) || 0) + (extraBlocks || 0);
  if (blockCount < SETTLED_MIN_BLOCKS) return '';
  if (entry.tool === 'browser_open') {
    const sent = requestsSentToPath(events, entry.detail);
    if (sent > 0) {
      const text = ` SETTLED: this exact action has now been chosen and blocked ${blockCount} times. The record contradicts "not probed" for this path — ${sent} ${sent === 1 ? 'request' : 'requests'} already SENT to it${lastRequestSnippet(events, hist, entry.detail)}`;
      return `${text}. Opening cannot probe it. SEND a request: curl with a payload, or type + submit.`;
    }
    return ` SETTLED: this exact action has now been chosen and blocked ${blockCount} times. No request has been sent to this path yet on your record — and opening it cannot send one. To test it, SEND a request: curl with a payload, or type + submit.`;
  }
  return ` SETTLED: this exact action has now been chosen and blocked ${blockCount} times. An identical repeat returns the identical result — vary the input or the approach, or act on what you already learned.`;
}

/**
 * The fold a hunter-supplied skill name goes through before it is
 * judged — the same fold skillCards.resolveSkillName applies
 * (lowercase, non-alphanumerics stripped), so "FTP!" and "ftp"
 * are the same ask here exactly as they are at lookup time.
 */
export function skillNameKey(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Skill names that have already FAILED in this hunt, rebuilt from
 * the reasoning record: Map<folded name, { name, asks }>. A row
 * counts when it is a load_skill whose recorded result carries
 * loadSkill's own "No skill card named" verdict, or a Lane AD
 * blocked repeat of one (`dedup_block: load_skill <name>`) — so
 * `asks` is the hunt's total asks for that name, failures and
 * blocked repeats alike. A successful pull (the card body as the
 * result) never counts: re-pulling a real card stays free.
 */
export function failedSkillAsks(reasoningRows = []) {
  const asks = new Map();
  const bump = (raw) => {
    const key = skillNameKey(raw);
    if (!key) return;
    const cur = asks.get(key);
    if (cur) cur.asks++;
    else asks.set(key, { name: String(raw || '').trim().slice(0, 60), asks: 1 });
  };
  for (const r of reasoningRows || []) {
    const action = String((r && r.action) || '').trim();
    const m = /^load_skill:\s*(.+)$/.exec(action);
    if (m) {
      if (String((r && r.result) || '').includes('No skill card named')) bump(m[1]);
      continue;
    }
    const b = /^dedup_block:\s*load_skill\s+(.+)$/.exec(action);
    if (b) bump(b[1]);
  }
  return asks;
}
