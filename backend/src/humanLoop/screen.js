// Split out of humanLoop.js by the P3 professionalization lane (split-only, no behaviour change).
// Moved verbatim; humanLoop.js re-exports the public names so callers are unchanged.

import { listSkills, loadSkill } from '../skillCards.js';
import {
  loadHuntMemory,
  buildStateOfMind,
  applyRetractions,
  retractedFindingCount,
  extractDossierBriefing,
  deadEndLines,
  isErrorPageFinding,
  SOM_TOTAL_BUDGET,
} from '../huntMemory.js';
import { PROBE_TOPICS, buildMemoryBriefing, clipLine, coverageObservation, discoveredEndpoints, findingsFromEvents, mergeLeadsWithCoverage, reconcileSessionResearch, researchedNotProbedLines, researchedTopicStats, systemPromptFor, unprobedLeadLines } from './research.js';

/**
 * The session journal (Lane I): this session's own trail, one line
 * per executed action — turn, kind + short detail, and a ≤80-char
 * result summary. A human glancing at his own last hour does not
 * re-derive it from a lifetime ledger; the loop's log IS that trail
 * (entries carry detail since Lane I). Pure over the log.
 */
export function sessionJournalLines(logEntries) {
  return (logEntries || []).map((l) => {
    const detail = l.detail ? ` ${clipLine(l.detail, 70)}` : '';
    const result = clipLine(l.observation || '', 80);
    return `- Turn ${l.turn}: ${l.action}${detail}${result ? ` → ${result}` : ''}`;
  });
}

/**
 * The left-off block (Lane I): the previous session's structured
 * hand-off, rendered high on the screen so the hunter resumes its
 * own train of thought instead of starting cold. Pure over the
 * persisted meta.humanLoop.leftOff object.
 */
export function leftOffLines(leftOff) {
  if (!leftOff || typeof leftOff !== 'object') return [];
  const lines = ['=== WHERE YOU LEFT OFF (last session) ==='];
  if (leftOff.lastThinking) lines.push(`Your train of thought when you stopped: ${clipLine(leftOff.lastThinking, 240)}`);
  if (Array.isArray(leftOff.lastActions) && leftOff.lastActions.length) {
    lines.push('Your last actions:');
    for (const a of leftOff.lastActions) {
      if (!a) continue;
      const detail = a.detail ? ` ${clipLine(a.detail, 80)}` : '';
      const result = a.result ? ` → ${clipLine(a.result, 80)}` : '';
      lines.push(`- ${a.tool || a.action || ''}${detail}${result}`);
    }
  }
  if (leftOff.lastNote) lines.push(`Your last note to self: ${clipLine(leftOff.lastNote, 220)}`);
  if (Array.isArray(leftOff.openThreads) && leftOff.openThreads.length) {
    lines.push('Open threads you left:');
    for (const t of leftOff.openThreads.slice(0, 6)) {
      const s = String(t);
      lines.push(s.startsWith('-') ? s : `- ${s}`);
    }
  }
  return lines.length > 1 ? lines : [];
}

/** Tool families for the clearing rule above. */
// FAILED-ACTION FOLLOW-THROUGH (Lane T, 23 Oct 2026)
//
// Lane P stopped a session hand-off from presenting a dedup-BLOCKED
// attempt as the pending step. The sibling failure survived live on
// the lab hunt (h_bench_d69e5746): turn 8's browser_click on
// "ftp/acquisitions.md" FAILED — "Click failed: no clickable element
// matches … Take a browser_snapshot and use an exact label from
// it." — and turn 9, in the SAME session, never mentioned the click
// or its feedback; it silently re-opened the /ftp page with
// reasoning copied from an older framing. The failure WAS in the
// record (the journal lists it, the reasoning row quotes it) but
// nothing carried it forward as an obligation, so the brain walked
// past it.
//
// This block rebuilds that obligation deterministically from the
// hunt's own records, refreshed on EVERY turn (the same per-turn
// discipline as the Lane I briefing refresh and the Lane J leads —
// a session-start computation would miss failures mid-session,
// which is exactly the live case):
//
//   DETECT  the most recent EXECUTED action whose recorded result
//           is a clear failure. Only the loop's and tools' own
//           failure framings count (recordedActionFailure) — never
//           target content that merely sounds like an error. Gate
//           blocks are NOT executions and never appear here: they
//           emit no tool_call event, their reasoning rows carry the
//           "dedup_block:" label, and Lane P hands them off as
//           "Do NOT retry" threads — the two mechanisms are
//           disjoint by construction, so they can never duplicate.
//   CARRY   while unaddressed, ONE open thread in the screen's
//           never-trimmed continuity region (beside the left-off
//           block), quoting the actual action, the actual error
//           and the tool's own feedback.
//   CLEAR   a later executed action addresses the failure when it
//           is in the same tool family (a browser_snapshot after a
//           failed click; another shell command after a failed one)
//           OR its detail shares a significant stem token with the
//           failed detail (the "ftp" stem shared by the failed `ftp`
//           shell command, the `curl … /ftp` retry and the
//           browser_open of /ftp). Only the LATEST failure is ever
//           carried — a newer failure supersedes an older one.
//   EXPIRE  after 3 later executed actions that do not address it,
//           the thread drops. The record itself is permanent; only
//           the nagging stops.

/** Tool families for the clearing rule above. */

const FOLLOW_TOOL_FAMILY = {
  shell: 'shell',
  intercept_replay: 'shell',
  browser_open: 'browser',
  browser_snapshot: 'browser',
  browser_click: 'browser',
  browser_type: 'browser',
  screenshot: 'browser',
  search: 'search',
  write_file: 'write',
  proxy_start: 'intercept',
  intercept_list: 'intercept',
  intercept_read: 'intercept',
  recall: 'recall',
  record_coverage: 'coverage',
  load_skill: 'skill',
  save_credential: 'vault',
  use_saved_credential: 'vault',
  fetch_verification_code: 'vault',
};

/**
 * Tools whose executed failures are carried as a follow-through
 * thread. Deliberately narrow: these are the tools whose reasoning
 * rows record a result framing this module can judge, and whose
 * failure leaves a concrete next step behind. Search / recall /
 * coverage failures are transient or self-evident and have no
 * follow-through step; claim outcomes are the verifier's verdicts,
 * not tool errors.
 */
const FOLLOW_FAILURE_TOOLS = new Set([
  'shell',
  'intercept_replay',
  'browser_open',
  'browser_click',
  'browser_type',
  'write_file',
]);

/** Later executed actions an unaddressed failure survives. */
const FOLLOW_EXPIRE_AFTER = 3;

/**
 * Significant stem tokens of an action detail, for the clearing
 * rule: scheme + host are stripped wherever they appear (every
 * action in a hunt shares the target's host, so host tokens can
 * never distinguish one action from another), pure numbers and
 * short fragments are dropped.
 */
function followStemTokens(detail) {
  const s = String(detail || '').toLowerCase().replace(/[a-z][a-z0-9+.-]*:\/\/[^/\s]+/g, ' ');
  const stop = new Set(['http', 'https', 'www']);
  const out = new Set();
  for (const t of s.split(/[^a-z0-9]+/)) {
    if (t.length >= 3 && !/^\d+$/.test(t) && !stop.has(t)) out.add(t);
  }
  return out;
}

/**
 * The failure a recorded action result represents, or null.
 * Conservative by construction: a leading tool-error line from
 * guiTools, the exec layer's own "Command failed: docker exec …"
 * error echo, or the trailing "[exit code N]" marker the loop
 * appends when a command exits non-zero. A successful result never
 * carries these framings — a 404 inside page text, the word "error"
 * in output a command printed, or an exit code of 0 do not match.
 */
function recordedActionFailure(tool, result) {
  const res = String(result || '');
  if (!res) return null;
  // Gate blocks are not executions (Lane P hands them off as
  // do-not-retry threads); a bounced claim is a gate verdict.
  if (res.startsWith('BLOCKED') || res.startsWith('CLAIM NOT RECORDED')) return null;
  const firstLine = res.split('\n').map((s) => s.trim()).filter(Boolean)[0] || '';
  const leads = (prefixes) => prefixes.some((p) => res.startsWith(p));
  switch (tool) {
    case 'browser_click':
      return leads(['Click failed', 'browser_click failed', 'Browser control failed']) ? { error: firstLine } : null;
    case 'browser_type':
      return leads(['Type failed', 'browser_type failed', 'Browser control failed']) ? { error: firstLine } : null;
    case 'browser_open':
      return leads(['browser_open failed', 'Browser control failed']) ? { error: firstLine } : null;
    case 'write_file':
      return leads(['write_file failed']) ? { error: firstLine } : null;
    case 'shell': {
      const exit = /\[exit code ([1-9]\d*)\]\s*$/.exec(res.trimEnd());
      if (exit) return { error: firstLine, exitCode: exit[1] };
      if (res.startsWith('Command failed: docker exec')) return { error: firstLine };
      if (res.startsWith('Shell action failed to run:')) return { error: firstLine };
      return null;
    }
    case 'intercept_replay': {
      const exit = /\[curl exit code ([1-9]\d*)\]\s*$/.exec(res.trimEnd());
      if (exit) return { error: firstLine, exitCode: exit[1] };
      if (res.startsWith('Replay failed to run:')) return { error: firstLine };
      return null;
    }
    default:
      return null;
  }
}

/**
 * The failed-action follow-through thread for the hunter's screen,
 * or [] when there is nothing to carry. Pure over the hunt's
 * records: tool_call events are the executed-action timeline
 * (blocked attempts emit none), reasoning rows carry each action's
 * recorded result. See the Lane T header above for the detect /
 * carry / clear / expire rules.
 */
export function failedActionThreadLines({ events = [], reasoningRows = [] } = {}) {
  const steps = [];
  for (const e of events || []) {
    if (!e || e.type !== 'tool_call') continue;
    steps.push({ tool: String(e.tool || '').toLowerCase(), detail: String(e.detail || '') });
  }
  const byTool = new Map();
  steps.forEach((s, i) => {
    if (!byTool.has(s.tool)) byTool.set(s.tool, []);
    byTool.get(s.tool).push(i);
  });
  // Pair each reasoning row with the executed step it reports on:
  // same tool, earliest unpaired step whose detail agrees with the
  // row's (a row's detail is a sliced copy of its step's). A row for
  // an attempt that never executed (a gate block) finds no agreeing
  // step and stays unpaired — harmless, since blocks are never
  // failure candidates anyway.
  const agrees = (stepDetail, rowDetail) => {
    const a = String(stepDetail || '').trim();
    const b = String(rowDetail || '').trim();
    if (!b) return true; // detail-less rows (browser_type) pair with the next step of their tool
    if (!a) return false;
    return a.startsWith(b) || b.startsWith(a);
  };
  const used = new Set();
  let lastPosition = -1;
  let latest = null;
  for (const r of reasoningRows || []) {
    const m = /^([a-z][a-z_]*)(?::\s?(.*))?$/.exec(String((r && r.action) || '').trim());
    if (!m) continue;
    const tool = m[1];
    if (tool === 'dedup_block' || !FOLLOW_FAILURE_TOOLS.has(tool)) continue;
    const rowDetail = String(m[2] || '');
    let position = lastPosition;
    for (const idx of byTool.get(tool) || []) {
      if (used.has(idx)) continue;
      if (agrees(steps[idx].detail, rowDetail)) {
        used.add(idx);
        position = idx;
        break;
      }
    }
    if (position > lastPosition) lastPosition = position;
    const failure = recordedActionFailure(tool, r.result);
    if (!failure) continue;
    const detail = (position >= 0 && steps[position] && steps[position].detail) || rowDetail;
    if (!latest || position >= latest.position) latest = { tool, detail, position, ...failure };
  }
  if (!latest) return [];
  // Clearing + expiry over the actions executed after the failure.
  const family = FOLLOW_TOOL_FAMILY[latest.tool] || '';
  const stems = followStemTokens(latest.detail);
  let unaddressed = 0;
  for (let i = latest.position + 1; i < steps.length; i++) {
    const s = steps[i];
    if (family && FOLLOW_TOOL_FAMILY[s.tool] === family) return []; // addressed
    if (stems.size) {
      const toks = followStemTokens(s.detail);
      let hit = false;
      for (const t of stems) if (toks.has(t)) { hit = true; break; }
      if (hit) return []; // addressed
    }
    unaddressed++;
  }
  if (unaddressed >= FOLLOW_EXPIRE_AFTER) return []; // expired
  const detail = clipLine(latest.detail, 120);
  let error = clipLine(latest.error || '', 220);
  if (latest.exitCode && !error.includes('exit code')) error += ` [exit code ${latest.exitCode}]`;
  return [
    '=== OPEN THREAD — YOUR LAST ACTION FAILED (follow through or pivot) ===',
    `- FAILED: ${latest.tool}${detail ? ` "${detail}"` : ''} — ${error}`,
    'Follow through on it now — the feedback above says how — or consciously choose a different next step. Do not silently repeat the move you were already making.',
  ];
}

/**
 * PENDING PLANS (Infinity level, 26 Oct 2026) — a skill card pulled
 * but never followed by a probe. Lane T tracks failed EXECUTED
 * actions; a load_skill is a plan, not an execution, so a card
 * pulled twice (SQLi, Infomaniak, 06:05 + 06:25) with zero probes
 * sent was invisible to every thread on screen. The research-debt
 * line names the class as "researched, never probed" but never the
 * plan itself or how long it has waited. This names it: the skill,
 * the turns since it was pulled, and the two ways to close it —
 * send its first probe, or record_coverage it as not_applicable
 * with the reason. Pure. A re-pull resets the clock (the latest
 * load per topic wins); a probe AFTER the load clears the plan.
 * A probe before the load does not count — the plan postdates it.
 */
const PLAN_PROBE_TOOLS = new Set(['shell', 'browser_open', 'browser_click', 'browser_type', 'claim_finding', 'intercept_replay']);

export function topicForSkillName(name) {
  const n = String(name || '').trim().toLowerCase();
  if (!n) return null;
  for (const t of PROBE_TOPICS) {
    if (n === t.id) return t;
  }
  for (const t of PROBE_TOPICS) {
    if (n.includes(t.id)) return t;
  }
  for (const t of PROBE_TOPICS) {
    if (t.re.test(n)) return t;
  }
  return null;
}

function isProbeDetailForTopic(tool, detail, topic) {
  if (!PLAN_PROBE_TOOLS.has(String(tool || '').toLowerCase())) return false;
  const d = String(detail || '');
  if (topic.re.test(d)) return true;
  return (topic.probes || []).some((re) => re.test(d));
}

/**
 * The pending plans, structured — one entry per topic whose skill
 * card was pulled with no probe sent after it. Pure. The line
 * renderer below and the load_skill re-pull gate (REAL-HUMAN) both
 * read this: a re-pull of a skill whose plan is already pending is
 * answered from the record instead of re-running the lookup.
 */
export function pendingPlannedProbes({ events = [], reasoningRows = [] } = {}) {
  const loads = [];
  (events || []).forEach((e, i) => {
    if (!e || e.type !== 'tool_call' || String(e.tool || '').toLowerCase() !== 'load_skill') return;
    const topic = topicForSkillName(e.detail);
    if (!topic) return;
    loads.push({ topic, skill: String(e.detail || ''), index: i });
  });
  if (!loads.length) return [];
  // Latest load per topic wins.
  const latest = new Map();
  for (const l of loads) latest.set(l.topic.id, l);
  const rows = reasoningRows || [];
  const out = [];
  for (const l of [...latest.values()].sort((a, b) => a.index - b.index)) {
    // Probe after the load?
    let probed = false;
    for (let i = l.index + 1; i < (events || []).length; i++) {
      const e = events[i];
      if (!e || e.type !== 'tool_call') continue;
      if (isProbeDetailForTopic(e.tool, e.detail, l.topic)) { probed = true; break; }
    }
    if (probed) continue;
    // Turns since the pull: reasoning rows after the load_skill row.
    let rowIdx = -1;
    for (let i = rows.length - 1; i >= 0; i--) {
      if (String((rows[i] && rows[i].action) || '') === `load_skill: ${l.skill}`) { rowIdx = i; break; }
    }
    const turnsSince = rowIdx >= 0 ? Math.max(0, rows.length - 1 - rowIdx) : null;
    const when = turnsSince === null ? 'in an earlier session' : `${turnsSince} turn${turnsSince === 1 ? '' : 's'} ago`;
    out.push({ topic: l.topic, skill: l.skill, turnsSince, when });
  }
  return out;
}

export function pendingPlannedProbeLines({ events = [], reasoningRows = [] } = {}) {
  const plans = pendingPlannedProbes({ events, reasoningRows });
  if (!plans.length) return [];
  const lines = plans.map((l) => `- PENDING PLAN: ${l.topic.label} — skill "${l.skill}" pulled ${l.when}, no probe sent yet. Send its first probe now, or close it with record_coverage as not_applicable and the reason.`);
  return ['=== PENDING PLANS — SKILL CARDS PULLED, NO PROBE SENT ===', ...lines.slice(0, 3)];
}

/**
 * Factual hunt-state lines the screen previously never carried
 * (Lane D, 21 Oct 2026). Chief among them: whether the hunt holds
 * any test-account credentials. The Ezviz hunt held NONE, and the
 * hunter — never told — spent turns POSTing guessed/placeholder
 * credentials (admin / your_username / test) at the login form,
 * which is not the "own accounts only" testing the programme
 * permits. Stating the fact is perception, not direction.
 */
export function huntFactLines(meta) {
  const m = meta || {};
  const hasCreds = ['credentials', 'testAccount', 'testAccounts', 'accounts', 'loginCredentials']
    .some((k) => {
      const v = m[k];
      if (Array.isArray(v)) return v.length > 0;
      if (v && typeof v === 'object') return Object.keys(v).length > 0;
      return Boolean(v);
    });
  if (hasCreds) return [];
  return [
    'No test-account credentials were provided for this hunt. The programme permits testing only the owner\'s own accounts, so a login you cannot complete with provided credentials is a closed door — not something to guess at.',
  ];
}

/**
 * The skill-card index for the screen (Lane M): names + one-liners
 * ONLY — the cheap advertisement. A card's body is never inlined
 * here; it is pulled via the load_skill action and arrives as one
 * turn's observation, so at most one card body is ever in context.
 * Kept to a single short block alongside the other early perception
 * blocks, sized so it cannot crowd out Lane J's leads. Pure over
 * skillCards.listSkills; any failure renders nothing.
 */
export function skillCardLines() {
  try {
    const skills = listSkills();
    if (!skills.length) return [];
    return [
      '=== SKILL CARDS — PULL A PROCEDURE INSTEAD OF SEARCHING ===',
      'Pull one when you open a class: {"action":"load_skill","skill":"sqli"} — it returns as your next observation: surface, detection, numbered steps, proof bar. One card at a time.',
      ...skills.map((s) => `- ${s.name}: ${s.description}`),
    ];
  } catch {
    return [];
  }
}

export function buildScreen({ target, parsedScope, briefing, findings, machineState, lastObservation, turn, turns, scopeHosts = [], facts = [], repetition = [], explored = [], leftOff = [], journal = [], retractedCount = 0, leads = [], coverage = [], skills = [], stateOfMind = [], followThrough = [], settled = [], pageState = [], exhausted = [], desktopState = [], desktopNow = [], chatQuestions = [], huntPlan = [], detailsRequest = [] }) {
  // ERROR-PAGE DEMOTION (27 Oct 2026, 404-verified audit): a
  // "verified" stamp whose evidence is an HTTP error page is not a
  // finding — it must not appear on the screen's VERIFIED list, or
  // the brain quotes it back to the owner as real ("5 verified
  // vulnerabilities" was read straight off this list).
  const confirmed = (findings || []).filter((f) => f.verified && !isErrorPageFinding(f));
  const unconfirmed = (findings || []).filter((f) => !f.verified);
  const findLines = [
    ...confirmed.slice(-8).map((f) => `- VERIFIED: ${f.title} (${f.severity || '?'})`),
    ...unconfirmed.slice(-4).map((f) => `- unverified claim: ${f.title} — ${String(f.verification || 'pending').slice(0, 120)}`),
  ];
  if (findLines.length) {
    findLines.unshift('A finding counts as VERIFIED only if its proof response was a real page (HTTP 200-class) — an error page (404/500) is never proof. Do not quote a verified count you have not earned.');
  }
  const rpm = parsedScope && parsedScope.rules ? parsedScope.rules.maxRequestsPerMin : null;
  return [
    '=== YOUR MACHINE (Kali) ===',
    machineState || '(state unavailable)',
    '',
    '=== YOUR TARGET ===',
    String(target),
    rpm ? `Programme pace: max ${rpm} requests/min, human-paced probes only.` : '',
    ...(scopeHosts && scopeHosts.length
      ? ['', '=== IN SCOPE FOR THIS PROGRAMME ===', `You may test: ${scopeHosts.join(', ')} (a listed domain\'s subdomains are in scope too). Anything else is out of scope and will be blocked.`]
      : []),
    // Infinity level: the parsed page state sits FIRST after the
    // scope — it is the freshest truth about what the browser
    // shows, and every choice this turn is made against it. A
    // snapshot's element list lives here, in state, not in a
    // 300-char stub in the record.
    ...(pageState && pageState.length ? ['', ...pageState] : []),
    // WHOLE-OS CONTROL: the desktop state sits beside the page
    // state — the same perception region, the same per-turn
    // refresh. The windows and the focused app are what the
    // desktop actions are chosen against.
    ...(desktopState && desktopState.length ? ['', ...desktopState] : []),
    // VISIBLE-DESKTOP-FIRST: the per-turn heartbeat — a fresh
    // screen read at the top of every turn, so the brain acts
    // against what is actually on screen, not from memory. It is
    // perception, not the result of the last action (that is
    // lastObservation, rendered separately below).
    ...(desktopNow && desktopNow.length ? ['', ...desktopNow] : []),
    // Lane I: where the hunter left off last session sits beside the
    // explored digest — continuity first, before the long briefing.
    ...(leftOff && leftOff.length ? ['', ...leftOff] : []),
    // REAL-HUMAN (26 Oct 2026): the owner's queued questions sit in
    // the same never-trimmed continuity region, directly under
    // left-off — the owner's voice is not briefing content a cap
    // can eat. A question stays here until the brain answers it in
    // a chat_answers field; the loop delivers the answer and the
    // question leaves the screen.
    ...(chatQuestions && chatQuestions.length ? ['', ...chatQuestions] : []),
    // DYNAMIC DETAILS (27 Oct 2026, owner order): the owner's answers
    // to your details requests sit in the same never-trimmed continuity
    // region as the owner's questions — a filled request's values ride
    // here for exactly one turn (they are never written to the record;
    // the session secret set scrubs them from every recorded surface),
    // and a pending request's wait instruction sits here until it is
    // answered or declined, so you never re-ask or re-attempt blind.
    ...(detailsRequest && detailsRequest.length ? ['', ...detailsRequest] : []),
    // HUNTER-MIND (26 Oct 2026): the brain's OWN hunt plan sits in
    // the same never-trimmed continuity region, directly under the
    // owner's questions — the plan is the hunter's own instructions,
    // and the loop executes it step by step. A hunt with no plan
    // shows the write-your-plan instruction instead, so the brain's
    // first move is always to write its own plan, never a probe.
    ...(huntPlan && huntPlan.length ? ['', ...huntPlan] : []),
    // Lane T: the failed-action follow-through thread sits in the
    // same never-trimmed continuity region as the left-off block —
    // an unaddressed failure from the hunt's own record, carried on
    // every screen until a later action addresses it or it expires,
    // so a failed action's feedback can no longer be walked past.
    ...(followThrough && followThrough.length ? ['', ...followThrough] : []),
    // Lane AD: the settled-actions block sits in the same
    // never-trimmed continuity region — actions the gate has
    // already blocked 3+ times, rendered as settled facts that
    // correct the premise behind the re-choice (what ran, what was
    // blocked, what was already SENT to the path, and the action
    // families that would actually test it). Refreshed every turn
    // from the hunt's record, like the Lane T thread above.
    ...(settled && settled.length ? ['', ...settled] : []),
    // Infinity level: the exhausted-surfaces block sits beside
    // settled — combinations the gate has closed (page + payload
    // class), with the auth-wall routes that remain open. Same
    // never-trimmed region, same per-turn refresh discipline.
    ...(exhausted && exhausted.length ? ['', ...exhausted] : []),
    // Lane F: the already-explored digest sits EARLY — ahead of the
    // (long, capped) memory briefing — so no prompt cap downstream
    // can truncate away the record of what is already done.
    ...(explored && explored.length ? ['', ...explored] : []),
    // Lane O: the state-of-mind block — the complete memory
    // essentials (where I left off / what I have done, rolled up by
    // endpoint and class / what I know / what I have NOT done, in
    // full / paths already ruled out, in full / what earlier hunts
    // of this target established), rebuilt from the permanent
    // record every turn by huntMemory. It sits in the same
    // outside-the-cap region as the digest, so the briefing's
    // 7,500-char cap can never cut the not-done table or the
    // ruled-out list — the two things a hunter must never lose.
    ...(stateOfMind && stateOfMind.length ? ['', ...stateOfMind] : []),
    // Lane J: the unprobed leads sit with the digest, OUTSIDE the
    // briefing cap — concrete next probes (researched class ×
    // discovered endpoint × input × test value) derived from the
    // hunt's own record, so conversion material cannot be crowded
    // out by the ledger and does not have to compete with the
    // dossier's distilled next step inside the briefing.
    ...(leads && leads.length
      ? ['', '=== UNPROBED LEADS — CONCRETE NEXT PROBES (from your own record) ===', ...leads, 'A search result is not a test: only a request sent to the target tests anything.']
      : []),
    // Lane L: the coverage ledger's open accounting sits with the
    // leads, in the same outside-the-cap region — open_gap rows the
    // brain recorded (or reconciliation opened for its research
    // debt) and the cumulative researched-but-unprobed debt. A
    // class leaves this list only by being probed or by a
    // record_coverage row closing it with a named control.
    ...(coverage && coverage.length
      ? ['', '=== COVERAGE LEDGER — OPEN GAPS & RESEARCH DEBT (your own accounting) ===', ...coverage, 'Missing information is not proof of safety: an open gap is unexamined, not clean.']
      : []),
    // Lane M: the skill-card index sits with the other early blocks —
    // names + one-liners only, after the leads so it can never crowd
    // them out; bodies are pulled on demand via load_skill.
    ...(skills && skills.length ? ['', ...skills] : []),
    '',
    '=== WHAT YOU KNOW (your memory — everything you have done and learned) ===',
    briefing || '(nothing yet — this hunt is young)',
    '',
    '=== FINDINGS SO FAR ===',
    findLines.length ? findLines.join('\n') : '(none yet)',
    ...(retractedCount > 0 ? [`(${retractedCount} earlier claim(s) were retracted as false positives — see dead ends)`] : []),
    ...(facts && facts.length ? ['', '=== FACTS ABOUT THIS HUNT ===', ...facts] : []),
    ...(repetition && repetition.length ? ['', '=== REPETITION CHECK ===', ...repetition] : []),
    ...(journal && journal.length ? ['', '=== THIS SESSION SO FAR ===', ...journal] : []),
    '',
    '=== RESULT OF YOUR LAST ACTION ===',
    lastObservation || '(this is your first move — start by looking: open the target in your browser or curl it, and see what it is)',
    '',
    `=== TURN ${turn} of ${turns} in this session (the hunt continues after) ===`,
    'Think briefly like a human, then end your reply with EXACTLY ONE action JSON.',
  ].join('\n');
}
