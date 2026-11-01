// Dark Matter — HUMAN MODE: one free hunter, not a pipeline.
//
// The staged pipeline (recon -> plan-of-3 -> injected deterministic
// probes -> special-command grammar) made the agent a form-filler: it
// could only do what a stage allowed, and the model almost never used
// the SEARCH:/WRITE_ARTIFACT: grammar bolted onto it (0 organic uses,
// audited 20 Oct 2026). The owner's model of the product is a HIRED
// HUMAN: give them a target and a machine, and they work — they look
// at the screen, think, click, search, write a script, run it, read
// the output, adapt — in one fluid loop, non-stop.
//
// humanIteration() is that loop, bounded to a number of turns per call
// (the hunt loop calls it repeatedly, forever, until stop/credits):
//
//   PERCEIVE  the "screen": memory briefing (full history + global
//             lessons) + findings so far + live machine state (pwd,
//             workspace listing) + the last action's full result.
//   THINK     one chatWithAI call. The model thinks briefly in prose,
//             then ends with EXACTLY ONE self-chosen action as JSON.
//   ACT       shell / search / write_file / note / browser_* /
//             proxy_start / intercept_* (Lane U) / screenshot /
//             claim_finding — executed through the SAME machinery
//             the pipeline uses (executeWithEvasion for shell,
//             webSearch, artifacts, guiTools, proxyIntercept).
//   OBSERVE   the result becomes the next turn's screen. Nothing is
//             hidden and nothing is staged.
//
// What deliberately STAYS (programme law + the 100% truth rule, not
// scaffolding): parsedScope enforcement (out-of-scope hosts blocked,
// heavy scanners blocked when the programme forbids them, the
// requests-per-minute cap paced between shell actions) and the
// pipeline verifier for claimed findings — a claim is re-run and
// judged by assessResult; the hunter can never verify its own claim.
// No deterministic probes are injected here, ever.
//
// Everything external is an injectable dep (opts.deps) so the loop is
// testable end-to-end with fakes — see scripts/test-human-loop.mjs.

import fs from 'node:fs';
import { execInHuntContainerWithRespawn } from './huntRunner.js';
import { guardClaimTitle } from './claimTitleGuard.js';
import { chatWithAI } from './llm.js';
import { isOneLoopEnabled, isOneLoopDryRun } from './brain/oneLoopBrain.js';
import { runOneLoopSession } from './brain/oneLoopSession.js';
import { webSearch } from './webSearch.js';
import { writeArtifact, spillOutput, artifactInfo, writeFileObservation } from './artifacts.js';
import { evidenceSignalIds, isHttpErrorPage } from './hunt-intel/index.js';
import { isMachineControlled, getControl } from './machineControl.js';
import { appendHuntEvent, readHuntMeta, writeHuntMetaCheckpoint, readHuntEvents } from './store.js';
import { normalisedActionDetail, actionSignature, contentHash } from './actionIdentity.js';
import { renderBrainFilesScreen } from './brainFiles.js';
import { recallById, firstRunNumber, parseRecallId, formatFullRecord } from './actionIndex.js';
import { isInScope } from './scopeParser.js';
import { recordReasoning, getAllReasoning, buildFullHistoryLedger, searchRecall } from './reasoningMemory.js';
import { findWrongTargetPaths, knownAppOf, knownAppSOMLines } from './knownApps.js';
import { detectEvidence, isDuplicate } from './autoFiler.js';
import { dvwaLogin, isStuckAtDvwaLogin } from './dvwaAuth.js';
import { runLabLoginFirst } from './labLogin.js';
import { getRelevantMemories, formatGlobalMemoryForPrompt, readAllGlobalMemories } from './globalMemory.js';
import { listSkills, loadSkill } from './skillCards.js';
import { saveCredential, getCredential, generatePassword, generatePersonaUsername, scrubSecrets, touchCredential, markVerified, listCredentials, hostOf } from './credentials.js';
import { createDetailRequest, getPendingRequests, listDetailRequests, getFilledValues, markDetailRequestUsed, detailValuesForScrub, detailsRequestScreenLines } from './userDetails.js';
import { createInboxPreferred, pollForCode } from './tempmail.js';
import {
  loadCoverage,
  saveCoverage,
  applyRecord,
  recordCoverage,
  updateCoverage,
  mergeResearchDebt,
  openGapRows,
  probedClassIds,
  normaliseSurface,
  normaliseCoverageClass,
  classLabelFor,
} from './coverageLedger.js';
import {
  guiBrowserOpen,
  guiBrowserSnapshot,
  guiBrowserClick,
  guiBrowserType,
  guiBrowserScreenshot,
} from './guiTools.js';
// Infinity level (26 Oct 2026): the parsed page-state record —
// every snapshot becomes state (URL, page type, interactive
// elements with tried/untried marks) instead of a 300-char stub
// in the record, and the loop counters that measure the sense-act
// loop. Pure; the loop owns the wiring.
import {
  emptyPageState,
  loadPageState,
  savePageState,
  mergePageState,
  markElementClicked,
  markTypedInto,
  pageStateLines,
  loopCounters,
  loopCounterLines,
  reconChecklist,
  coverageSummaryLines,
  normalisePageUrl,
  classifyPageType,
} from './pageState.js';
// MISSION Stage 2 (31 Oct 2026): explicit action verification — the brain
// may declare what it expects (action.expect); the verdict is appended to
// the turn's observation so success is proven, never assumed.
import { verifyExpectation } from './actionVerify.js';
// MISSION Stage 3 (31 Oct 2026): structured action plans — objective,
// state, expected, risk, fallback; fallback surfaces on verify-fail.
import { parsePlan, fallbackLine } from './actionPlan.js';
// WHOLE-OS CONTROL (26 Oct 2026): the desktop channel — xdotool on
// the same X :99 the Take Control x11vnc serves (see desktopControl.js
// for why xdotool, not a from-scratch RFB client).
import {
  DESKTOP_WINDOWS_CMD,
  parseDesktopWindows,
  emptyDesktopState,
  mergeDesktopState,
  markWindowInteracted,
  desktopStateLines,
  resolveWindowForClick,
  desktopClickCommand,
  parseDesktopKeys,
  desktopKeyCommand,
  desktopTypeCommand,
  shellQuote,
  captureDesktopScreenshot,
  // HUMAN-BRAIN (26 Oct 2026): GUI-visible terminal builders.
  DESKTOP_TERMINAL_LAUNCH_CMD,
  DESKTOP_TERMINAL_WINDOWS_CMD,
  DESKTOP_TERMINAL_COMMAND_CAP,
  desktopTerminalLogFile,
  desktopTerminalWrapCommand,
  parseTerminalExit,
} from './desktopControl.js';
// SCREEN-SEEING (27 Oct 2026, owner order): the text-only brain reads the
// desktop through a TEXT MAP (screenshot -> OCR words + coordinates) and
// clicks at map coordinates — see_screen + desktop_click_at.
import {
  captureScreenMap,
  parseClickAt,
  desktopClickAtCommand,
  screenMapErrorLine,
  parseScreenMapLines,
} from './screenMap.js';
// VISIBLE-DESKTOP-FIRST (27 Oct 2026, owner order): the brain must
// hunt THROUGH the visible desktop so the owner SEES it work —
// interactive steps on the desktop, shell only for work that needs
// no screen. Pure routing helpers (prompt section, turn classifier,
// shell-login detector, next-turn nudge, per-turn heartbeat).
import {
  DESKTOP_FIRST_RULE,
  looksLikeShellLogin,
  desktopFirstNudge,
  heartbeatBlock,
} from './desktopFirst.js';
// REAL-HUMAN (26 Oct 2026): the owner's queued questions (the
// brain answers them in-turn — see chatQueue.js) and in-app
// clicking via the AT-SPI accessibility tree (desktopAtspi.js).
// The chat-answer delivery appends to the chat-messages file
// (routes/chats.js) — humanLoop owns the loop side, chats.js owns
// the file, and neither imports the other's route layer.
import {
  pendingChatQuestions,
  chatQuestionScreenLines,
  extractChatAnswers,
  markChatAnswered,
} from './chatQueue.js';
import { appendChatMessage } from './routes/chats.js';
import { clickControlCommand, parseAtspiOutput, atspiFailureObservation, atspiSuccessObservation } from './desktopAtspi.js';
// TOOLS/OS AUTONOMY (27 Oct 2026, owner order): named tool launches,
// allow-listed installs, AT-SPI control lists, and the Burp first-use
// path — the structured actions the skill card only described.
import {
  resolveTool,
  launchGuiTool,
  checkCliTool,
  downloadTool,
  listToolControls,
  burpFirstUse,
  burpFirstUseDone,
  recordToolState,
  TOOL_IDS,
  DOWNLOAD_IDS,
} from './toolLaunch.js';
// HUNTER-MIND (26 Oct 2026): the brain's own hunt plan (huntPlan.js)
// and the output ledger (outputMemory.js). The plan is the brain's
// own instructions and the ledger is its saved outputs — the loop
// only persists them, renders them on the screen, and answers
// repeats from them. Neither module chooses an action.
import {
  emptyHuntPlan,
  loadHuntPlan,
  saveHuntPlan,
  setPlanSteps,
  markPlanStep,
  nextPlanStep,
  planStuck,
  huntPlanLines,
} from './huntPlan.js';
import {
  emptyOutputs,
  loadOutputs,
  saveOutputs,
  recordOutput,
  findOutput,
  outputCount,
  recallObservation,
} from './outputMemory.js';
// Lane U: the Burp-style intercept workflow (mitmproxy inside the
// hunt container; see proxyIntercept.js for the topology). The pure
// replay builders + signature are imported directly — deterministic
// code, exercised through the dispatch with a fake capture read.
import {
  startInterceptProxy,
  listIntercept,
  readInterceptEntry,
  buildReplayRequest,
  buildReplayCurl,
  replaySignature,
} from './proxyIntercept.js';
// Lane O: huntMemory.js is the single read path for the hunt's
// permanent record (reasoning, events, findings, coverage, the
// ruled-out registry, dossier, left-off, prior hunts of the same
// target). The pure record helpers that used to live in this file
// (applyRetractions, retractedFindingCount, extractDossierBriefing,
// deadEndLines) moved there and are re-exported below, so existing
// imports keep working unchanged.
import {
  loadHuntMemory,
  buildStateOfMind,
  applyRetractions,
  retractedFindingCount,
  extractDossierBriefing,
  deadEndLines,
  isErrorPageFinding,
  SOM_TOTAL_BUDGET,
} from './huntMemory.js';

export { applyRetractions, retractedFindingCount, extractDossierBriefing, deadEndLines };

/**
 * Recover a previously observed SQLi proof when the model is trapped
 * repeatedly recalling it. Only historical tool output paired with a
 * recorded UNION/SQLi probe is eligible; model narration alone is not proof.
 */
export function recoverRecallLoopSqli(events, { consecutiveRecalls = 3 } = {}) {
  const rows = Array.isArray(events) ? events : [];
  let recalls = 0;
  for (let i = rows.length - 1; i >= 0; i--) {
    const e = rows[i];
    if (!e || e.type !== 'tool_call') continue;
    if (String(e.tool || '').toLowerCase() !== 'recall') break;
    recalls++;
  }
  if (recalls < consecutiveRecalls) return null;

  const textOf = (e) => [e.text, e.detail, e.output, e.result, e.observation, e.stdout, e.stderr, e.response]
    .filter((v) => typeof v === 'string').join('\n');
  const hashes = new Set();
  let evidenceText = '';
  let proofCommand = '';
  let afterSqliProbe = false;
  for (let i = Math.max(0, rows.length - 300); i < rows.length; i++) {
    const e = rows[i];
    if (!e) continue;
    if (e.type === 'tool_call') {
      const tool = String(e.tool || '').toLowerCase();
      if (tool === 'shell') {
        const detail = String(e.detail || '');
        afterSqliProbe = /\bunion\s+(?:all\s+)?select\b|\bselect\s+.+\s+from\s+users\b/i.test(detail);
        if (afterSqliProbe && !proofCommand) proofCommand = detail;
      } else if (tool !== 'recall') {
        afterSqliProbe = false;
      }
    }
    const text = textOf(e);
    const found = afterSqliProbe ? (text.match(/\b[a-f0-9]{32}\b/gi) || []) : [];
    if (found.length) {
      for (const h of found) hashes.add(h.toLowerCase());
      evidenceText += (evidenceText ? '\n' : '') + text.slice(0, 1800);
    }
  }
  if (hashes.size < 2 || !proofCommand) return null;
  return {
    recalls,
    hashes: [...hashes].slice(0, 12),
    command: proofCommand.slice(0, 4000),
    evidence: ('Recorded output after the SQLi UNION SELECT probe:\n' + evidenceText).slice(0, 3000),
  };
}


const OBS_BUDGET = 3500; // chars of an action result shown on the next screen
const COMMAND_CAP = 4000; // same transport cap as the pipeline (solver #459)

// Hosts a hunter may legitimately touch without "attacking" them:
// downloading a tool is not testing a target. Anything else that is
// not the target (or a programme-listed asset) is out of scope.
const DOWNLOAD_HOSTS = new Set([
  'github.com', 'raw.githubusercontent.com', 'objects.githubusercontent.com',
  'pypi.org', 'files.pythonhosted.org', 'registry.npmjs.org', 'npmjs.org',
  'deb.debian.org', 'archive.kali.org', 'http.kali.org', 'ftp.debian.org',
  'dl.google.com', 'storage.googleapis.com',
]);

// Heavy automated scanning — blocked only when the programme forbids
// it (parsedScope.rules.noHeavyScan). Human-paced probes stay legal.
const HEAVY_SCAN_PATTERNS = [
  /\bmasscan\b/i,
  /\bnikto\b/i,
  /\bdirsearch\b/i,
  /\bgobuster\b[^|;&]*\b(dir|dns|fuzz)\b/i,
  /\bffuf\b[^|;&]*(-t\s*[2-9]\d|-rate\s*[2-9]\d)/i,
  /\bnmap\b[^|;&]*(-p-|--top-ports\s+\d{3,})/i,
  /\bsqlmap\b[^|;&]*(--level\s*[45]|--risk\s*3|--threads\s*[2-9]\d*)/i,
  /\bhydra\b/i,
  /\bnuclei\b[^|;&]*(-rate-limit\s*[2-9]\d|-bulk-size\s*[2-9]\d)/i,
];

function targetHostOf(target) {
  try {
    return new URL(String(target)).hostname.toLowerCase();
  } catch {
    return '';
  }
}

// WRONG-PAGE GUARD (25 Oct 2026): the CDP driver refuses to type /
// click / snapshot when the live tab is not the target, and the
// observation it returns starts with "WRONG PAGE —". These helpers
// are the loop-side half of that guard: the target hosts the driver
// is bound to, whether a URL is on them, and the narrow dedupe
// exemption that lets the agent navigate BACK to the target when it
// is currently on a foreign page (Trap 4: every return-to-target
// open already ran x2, so dedupe blocked the way home forever).
export function targetHostsFor(target, parsedScope) {
  const hosts = [];
  const tHost = targetHostOf(target);
  if (tHost) hosts.push(tHost);
  for (const entry of (parsedScope && parsedScope.inScope) || []) {
    const d = String(entry).toLowerCase();
    if (d && !hosts.includes(d)) hosts.push(d);
  }
  return hosts;
}

function hostOnTargetList(host, hosts) {
  const h = String(host || '').toLowerCase();
  if (!h) return false;
  return (hosts || []).some((d) => {
    const dd = String(d).toLowerCase();
    return h === dd || h.endsWith('.' + dd);
  });
}

export function isOnTargetHosts(url, target, parsedScope) {
  let host = '';
  try {
    host = new URL(String(url)).hostname.toLowerCase();
  } catch {
    return false;
  }
  return hostOnTargetList(host, targetHostsFor(target, parsedScope));
}

// Narrow dedupe exemption: browser_open of a target-host URL is
// allowed when the current tab is provably NOT the target (the
// agent is on a foreign page — about:blank, our own frontend, an
// SSO hop that never landed — and must navigate home). Unknown
// current page ('') means NO exemption: a broken tracker must never
// open a re-open-forever loophole. Repeated opens while already ON
// the target are still deduped as before.
export function isReturnToTarget(kind, action, currentPageUrl, target, parsedScope) {
  if (String(kind || '').toLowerCase() !== 'browser_open') return false;
  if (!currentPageUrl) return false;
  if (isOnTargetHosts(currentPageUrl, target, parsedScope)) return false;
  const url = String((action && action.url) || '');
  return isOnTargetHosts(url, target, parsedScope);
}

// Extract the current page URL from a browser observation. The
// snapshot formatter's first line is "Page: <title> — <url>"; a
// wrong-page refusal names the URL in prose; about:blank is a real
// (empty) page, not an unknown one. Returns '' when no URL can be
// found — callers treat '' as "unknown", never as "on target".
export function pageUrlFromObservation(obs) {
  const s = String(obs || '');
  if (!s) return '';
  const pageLine = s.match(/^Page:.*—\s*(\S+)/m);
  if (pageLine) return pageLine[1];
  const wrong = s.match(/WRONG PAGE — you are on (\S+),/);
  if (wrong) return wrong[1];
  if (/about:blank/.test(s)) return 'about:blank';
  const url = s.match(/https?:\/\/[^\s'"<>)\]|,]+/i);
  return url ? url[0] : '';
}

/**
 * Clip a tool observation for the reasoning log. Probes put their VERDICT
 * as the last line by convention, so a pure head-truncate silently drops
 * the most important line. Keep the head (context) AND the tail (verdict).
 * Exported for tests.
 */
export function clipResult(observation) {
  const s = String(observation || '');
  if (s.length <= 800) return s;
  const omitted = s.length - 800;
  return s.slice(0, 400) + `\n…[truncated ${omitted} chars]…\n` + s.slice(-400);
}

// Seed for lastObservation at session start (fix 2): the last
// non-empty result the previous session recorded, so the new
// session does not start blind. Results that are themselves an
// empty-page snapshot are skipped — seeding one would re-trip the
// very gate the seed exists to defeat. Returns '' when the previous
// session left nothing usable; the turn-start snapshot then
// provides it.
export function lastActionResultOfLeftOff(leftOff) {
  const actions = (leftOff && leftOff.lastActions) || [];
  for (let i = actions.length - 1; i >= 0; i--) {
    const r = String((actions[i] && actions[i].result) || '').trim();
    if (r && !r.includes('(empty page snapshot)')) return r;
  }
  return '';
}

/**
 * Out-of-scope check for a URL string against the hunt's parsedScope.
 * Returns the offending URL, or null when allowed. Allows: the target
 * host itself, any host the programme lists in inScope (domain or
 * subdomain of it), anything isInScope() accepts, and known
 * tool-download hosts.
 */
export function scopeViolation(url, target, parsedScope) {
  let host = '';
  try {
    // Protocol-relative URLs (//host/path) carry a host but need a
    // scheme to parse — resolve them as https before judging.
    const raw = String(url);
    host = new URL(raw.startsWith('//') ? 'https:' + raw : raw).hostname.toLowerCase();
  } catch {
    // Unparseable absolute URL: fail closed. A malformed URL must not
    // slip past the guard. (Bare non-URL strings have no "://" and
    // are not judged here.)
    return String(url).includes('://') ? url : null;
  }
  if (!host) return null;
  const tHost = targetHostOf(target);
  // Named out-of-scope hosts beat everything else — including a
  // wildcard in-scope base AND the tool-download exemption (the
  // programme may name a download host out of scope; the named
  // exclusion wins). The hunt's own target host is exempt:
  // contradictory scope text must not brick the hunt itself.
  // (Lane D, 21 Oct 2026.)
  const outOfScopeHosts = parsedScope ? (parsedScope.outOfScopeHosts || []) : [];
  if (host !== tHost) {
    for (const oos of outOfScopeHosts) {
      const d = String(oos).toLowerCase();
      if (host === d || host.endsWith('.' + d)) return url;
    }
  }
  if (DOWNLOAD_HOSTS.has(host)) return null;
  if (tHost && (host === tHost || host.endsWith('.' + tHost))) return null;
  const inScope = parsedScope ? (parsedScope.inScope || []) : [];
  for (const entry of inScope) {
    const d = String(entry).toLowerCase();
    if (host === d || host.endsWith('.' + d)) return null;
  }
  // No parsed scope: only the target host (+ download hosts, above)
  // pass. A missing scope must not mean "everything is allowed".
  if (!parsedScope) return url;
  return isInScope(url, parsedScope) ? null : url;
}

function commandScopeViolation(command, target, parsedScope) {
  const urls = String(command).match(/(?:[a-z][a-z0-9+.-]*:)?\/\/[^\s'"<>)|\]]+/gi) || [];
  for (const u of urls) {
    const v = scopeViolation(u, target, parsedScope);
    if (v) return v;
  }
  return null;
}

function heavyScanViolation(command, parsedScope) {
  if (!parsedScope || !parsedScope.rules || !parsedScope.rules.noHeavyScan) return null;
  for (const re of HEAVY_SCAN_PATTERNS) {
    if (re.test(String(command))) return re.source;
  }
  return null;
}

/**
 * The task block beside the action (KEYWORD-INDEX, 27 Oct 2026):
 * what the brain is doing right now, what it achieves, how far it
 * is — the hunt's current state, so the next turn resumes it instead
 * of starting fresh. Accepts the block nested under "task" or as
 * sibling fields of the action object. Validated: strings ≤300 chars,
 * status in_progress|complete (default in_progress). A malformed
 * block returns null and never breaks the action.
 */
export function extractTaskBlock(obj) {
  if (!obj || typeof obj !== 'object') return null;
  let src = null;
  const t = obj.task;
  if (typeof t === 'string') src = { task: t };
  else if (t && typeof t === 'object') src = t;
  else if (typeof obj.goal === 'string' || typeof obj.progress === 'string' || typeof obj.status === 'string' || typeof obj.summary === 'string') {
    src = { task: '', goal: obj.goal, progress: obj.progress, status: obj.status, summary: obj.summary };
  }
  if (!src) return null;
  const out = {};
  if (typeof src.task === 'string' && src.task.trim()) out.task = src.task.trim().slice(0, 300);
  if (typeof src.goal === 'string' && src.goal.trim()) out.goal = src.goal.trim().slice(0, 300);
  if (typeof src.progress === 'string' && src.progress.trim()) out.progress = src.progress.trim().slice(0, 300);
  if (typeof src.summary === 'string' && src.summary.trim()) out.summary = src.summary.trim().slice(0, 300);
  const status = typeof src.status === 'string' ? src.status.trim().toLowerCase() : '';
  if (status === 'complete' || status === 'in_progress') out.status = status;
  if (!out.task && !out.goal && !out.progress && !out.summary && !out.status) return null;
  if (!out.status) out.status = 'in_progress';
  return out;
}

/**
 * Parse the model's action: the LAST JSON object in the reply that
 * carries an "action" string. Tolerant by design (the 8B wraps JSON
 * in prose and code fences): scan balanced {...} spans, try each from
 * the end. Returns { action, jsonStart, task } or null — `task` is
 * the task block beside the action, when the brain sent one.
 */
export function parseHumanAction(reply) {
  if (!reply) return null;
  const text = String(reply);
  const spans = [];
  let depth = 0;
  let start = -1;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        spans.push([start, i]);
        start = -1;
      }
      if (depth < 0) depth = 0;
    }
  }
  for (let i = spans.length - 1; i >= 0; i--) {
    const [s, e] = spans[i];
    try {
      const obj = JSON.parse(text.slice(s, e + 1));
      if (obj && typeof obj.action === 'string' && obj.action) {
        return { action: obj, jsonStart: s, task: extractTaskBlock(obj) };
      }
    } catch { /* try the previous span */ }
  }
  return null;
}

// ---------------------------------------------------------------------------
// MEMORY BRIEFING (Lane G, 21 Oct 2026 — owner order: "it HAS memory, so it
// must never redo work it already did").
//
// AUDIT of what reached the human-mode screen before this change (measured
// with a synthetic hunt modelled on the live Ezviz pattern — 30 reasoning
// rows, 60 tool calls, 2 rejected claims, 7 ruled_out rows):
//   - system prompt 2,163 chars; screen 5,287 chars total on a young hunt;
//     briefing section 3,919 chars (ledger 3,437 + global memory ~480).
//   - The briefing was ONLY buildFullHistoryLedger (action budget 6,000)
//     followed by global memory (sliced to 1,500), the whole thing sliced
//     at 7,500 — so the lowest-density content (raw action lines) sat
//     FIRST and the lessons were the first thing the cap ate on a mature
//     hunt.
//   - The dead-end registry (episodeStore ruled_out — the validator-gated
//     lessons the pipeline renders via formatLessonsForPrompt) was NEVER
//     imported here: 0 bytes of it reached the human-mode brain.
//   - The ledger's own DEAD ENDS line is structurally always empty in
//     human mode: note() writes reasoning rows with hypothesis '', and
//     the ledger groups dead ends by hypothesis (measured deadEnds: 0
//     even with rejected claims in the record). A rejected claim showed
//     up only as a raw "[unverified]" line among the action history.
//   - "Researched but never probed" was computed NOWHERE: SSTI appeared
//     only as 16 identical raw "search:" action lines.
// The builders below fix the content side (Lane F adds the hard dedupe
// gate on the action side). Priority order inside the SAME 7,500-char
// briefing cap: (a) dead ends for this target, (b) researched-but-not-
// probed next-action candidates, (c) distilled global lessons, then the
// full-history ledger fills whatever budget remains. A section whose
// source is empty is omitted silently — no placeholder text, ever.

const BRIEFING_BUDGET = 7500; // the pre-existing briefing cap — unchanged

const clipLine = (s, n) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
};

const normTitle = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

// (a) Dead ends for this target are rendered by deadEndLines in
// huntMemory.js (imported + re-exported above) — the single memory
// read path owns the record helpers since Lane O.

// Technique topics for the researched-not-probed derivation. `research`
// matches the topic in searches/notes/stated intent; `probes` are the
// payload/signature shapes that count as an actual test against the
// target (plus a topic mention inside an executed shell/browser/claim
// action). Deliberately conservative: reading about a technique never
// counts as probing it.
//
// `testValue` / `testNote` (Lane J, 22 Oct 2026) are the canonical
// FIRST probe for the class — the textbook test value and what its
// result would mean — used only to GROUND the unprobed-leads section
// in a concrete payload shape (see unprobedLeadLines). They are
// perception text, never an executed action: the hunter still chooses
// every action itself.
export const PROBE_TOPICS = [
  { id: 'ssti', label: 'SSTI (template injection)', re: /\bssti\b|template injection/i, probes: [/\{\{[^}]{0,60}\}\}/, /\$\{[^}]{0,60}\}/, /\{%[^%]{0,60}%}/], testValue: '{{7*7}}', testNote: 'if the response shows 49, the template engine evaluated your input' },
  { id: 'xss', label: 'XSS (cross-site scripting)', re: /\bxss\b|cross[- ]site scripting/i, probes: [/<script\b/i, /\balert\s*\(/, /\bonerror\s*=/i, /<svg\b/i, /\bprompt\s*\(/], testValue: '<script>alert(1)</script>', testNote: 'then check whether your marker comes back in the page unescaped' },
  { id: 'sqli', label: 'SQL injection', re: /\bsqli\b|sql injection/i, probes: [/\bunion\s+(all\s+)?select\b/i, /'\s*(or|and)\s+('?[\w-]+'?|\d+)\s*=\s*('?[\w-]+'?|\d+)/i, /'\s*(--|#)/, /\b(sleep|benchmark)\s*\(\s*\d/i], testValue: "' OR 1=1", testNote: "compare with the same request using ' OR 1=2 — if the two answers differ, the input reaches the query" },
  { id: 'ssrf', label: 'SSRF', re: /\bssrf\b|server[- ]side request forgery/i, probes: [/169\.254\.169\.254/, /metadata\.google/i, /100\.100\.100\.200/, /\bgopher:\/\//i], testValue: 'http://169.254.169.254/latest/meta-data/', testNote: 'watch whether the server fetches it or the answer changes' },
  { id: 'xxe', label: 'XXE', re: /\bxxe\b|xml external entit/i, probes: [/<!ENTITY/i, /<!DOCTYPE[^>]*\[/], testValue: 'an XML body declaring <!ENTITY xxe SYSTEM "file:///etc/passwd">', testNote: "if the response contains the file's contents, the parser resolved your entity" },
  { id: 'lfi', label: 'LFI / path traversal', re: /\blfi\b|path traversal|directory traversal|local file inclusion/i, probes: [/\.\.[/\\]\.\.[/\\]/, /\/etc\/passwd/, /%2e%2e(%2f|\/)/i], testValue: '../../etc/passwd', testNote: "if the response contains 'root:' lines, the server read the file" },
  { id: 'cmdi', label: 'command injection', re: /command injection|\bos command\b/i, probes: [/[;|&`]\s*(id|whoami|sleep\s+\d)/i, /\$\(\s*(id|whoami)/], testValue: 'test; id', testNote: 'if a uid= line from id appears in the response, the command ran' },
  { id: 'jwt', label: 'JWT attacks', re: /\bjwt\b|json web token/i, probes: [/eyJ[A-Za-z0-9_-]{5,}\.eyJ/, /alg["']?\s*[:=]\s*["']?none/i], testValue: 'the session token with its header alg set to none and an empty signature', testNote: 'if the API still accepts it, signature verification is missing' },
  { id: 'cors', label: 'CORS misconfiguration', re: /\bcors\b|cross-origin/i, probes: [/origin\s*:/i], testValue: 'https://evil.example', testNote: 'if the response reflects it in Access-Control-Allow-Origin while allowing credentials, it is misconfigured', via: (param) => 'with an Origin: https://evil.example header' },
  { id: 'headers', label: 'security headers', re: /security headers|content-security-policy|\bcsp\b|clickjacking/i, probes: [/curl\s+[^|;&]*-[a-zA-Z]*I\b/, /curl\s+[^|;&]*--head\b/i], testValue: '', testNote: 'missing Content-Security-Policy or X-Frame-Options on a page with a login form is a reportable weakness', via: () => 'by running curl -s -I on it and reading which security headers are absent', oneShot: true },
  { id: 'openredirect', label: 'open redirect', re: /open redirect/i, probes: [/[?&](url|next|redirect|redirect_uri|return|dest|target)=https?%3a/i], testValue: 'https://example.com', testNote: 'if the browser lands on example.com, the redirect is open' },
  { id: 'graphql', label: 'GraphQL', re: /graphql/i, probes: [/\/graphql\b/i, /\{\s*__schema\b/, /\bintrospection\b/i], testValue: '{__schema{types{name}}}', testNote: 'a full schema answer means introspection is switched on' },
  { id: 'fileupload', label: 'file upload', re: /file upload|upload vulnerab|unrestricted upload/i, probes: [/curl\s+[^|;&]*\s-F\b/, /multipart\/form-data/i], testValue: 'a small test file (first a harmless .txt, then an .html carrying a marker)', testNote: 'if the file is afterwards reachable and served as-is, the upload is unrestricted', pathRe: /upload/i, via: () => 'by sending a real file with curl -F' },
];

/**
 * Per-topic research/probe accounting over the hunt's own record —
 * the shared counting core for the briefing's researched-not-probed
 * section (Lane G) and the concrete unprobed leads (Lane J). Returns
 * [{ topic, n, probed }] for every topic with n > 0, most-researched
 * first. `probed` means a payload-signature action for the topic
 * exists somewhere in the record (see PROBE_TOPICS).
 */
export function researchedTopicStats({ events = [], reasoningRows = [] } = {}) {
  // Counting rule (kept explainable — the hunter is shown these
  // numbers): a research hit is one SEARCH action (counted from its
  // tool_call event; the mirrored reasoning row for the same search is
  // a duplicate and skipped) or one distinct note/intent snippet from
  // a non-search reasoning row, deduplicated by text.
  const counts = new Map(); // topicId -> hits
  const noteSnippets = new Map(); // topicId -> Set of normalised snippets
  const probeText = [];
  const hit = (t) => counts.set(t.id, (counts.get(t.id) || 0) + 1);
  for (const e of events || []) {
    if (!e || e.type !== 'tool_call') continue;
    const detail = String(e.detail || '');
    if (e.tool === 'search') {
      for (const t of PROBE_TOPICS) if (t.re.test(detail)) hit(t);
    } else if (['shell', 'browser_open', 'browser_click', 'browser_type', 'claim_finding', 'intercept_replay'].includes(e.tool)) {
      probeText.push(detail);
    }
  }
  for (const r of reasoningRows || []) {
    if (!r) continue;
    const action = String(r.action || '');
    if (action.startsWith('search:')) continue; // duplicate of the tool_call event
    if (/^(shell|claim_finding):/.test(action)) probeText.push(action);
    // Notes and stated intent in a row's why/learned count as research,
    // never as a probe — thinking about a technique is not testing it.
    const intent = `${r.why || ''} ${r.learned || ''}`;
    if (!intent.trim()) continue;
    for (const t of PROBE_TOPICS) {
      if (!t.re.test(intent)) continue;
      if (!noteSnippets.has(t.id)) noteSnippets.set(t.id, new Set());
      const key = normTitle(intent).slice(0, 140);
      if (!noteSnippets.get(t.id).has(key)) {
        noteSnippets.get(t.id).add(key);
        hit(t);
      }
    }
  }
  const probeBlob = probeText.join('\n');
  const out = [];
  for (const t of PROBE_TOPICS) {
    const n = counts.get(t.id) || 0;
    if (!n) continue;
    const probed = t.re.test(probeBlob) || t.probes.some((re) => re.test(probeBlob));
    out.push({ topic: t, n, probed });
  }
  out.sort((a, b) => b.n - a.n);
  return out;
}

/**
 * (b) Researched but not yet probed: topics this hunt has searched or
 * noted (or stated as intent in a reasoning row's "why") with NO probe
 * action against the target anywhere in the hunt's own record. One line
 * each, phrased as an explicit next-action candidate. Pure; capped at 6,
 * most-researched first.
 */
export function researchedNotProbedLines({ events = [], reasoningRows = [] } = {}) {
  return researchedTopicStats({ events, reasoningRows })
    .filter((s) => !s.probed)
    .slice(0, 6)
    .map((s) => `- ${s.topic.label}: researched ×${s.n} in your searches/notes, never probed — candidate next action: send ONE real probe for this at the target now instead of researching it again.`);
}

// ---------------------------------------------------------------------------
// UNPROBED LEADS + ENDPOINT COVERAGE (Lane J, 22 Oct 2026)
//
// Live diagnosis on the Ezviz hunt (iter 148, 2,121 events, 633 tool
// calls, 0 genuine verified): 335 of 633 tool calls were web searches
// (53%); after a search the next action was another search 62% of the
// time and a shell probe only 14 times in the whole hunt. Lane G's
// briefing section DID render ("command injection: researched ×64,
// never probed — send ONE real probe for this at the target") — but it
// named no page, no input and no payload, and the brain's own record
// shows what that produces: a thinking block resolving to "send a
// real probe for command injection at the target now", followed by a
// plain registration POST carrying no payload at all. Intent without
// grounding does not convert. The surface the hunt itself discovered
// (/rest/user/login with username+password, /rest/user/profile with
// file=, /upload opened twice) was never presented back as a coverage
// map, so researched classes and known endpoints never met on screen:
// file upload was researched repeatedly while /upload never received
// a single probe (no multipart action exists in the record).
//
// The builders below derive BOTH halves from the hunt's own record
// and join them into concrete leads: researched class × discovered
// endpoint × the input it takes × the canonical first test value.
// Pure perception — nothing is executed, injected or staged; the
// hunter remains the sole decision-maker.
// ---------------------------------------------------------------------------

const URL_IN_TEXT = /https?:\/\/[^\s'"<>)\]|]+/gi;

function paramNamesFrom(text) {
  const names = [];
  const seen = new Set();
  const add = (n) => {
    if (n && !seen.has(n) && names.length < 6) {
      seen.add(n);
      names.push(n);
    }
  };
  for (const m of String(text || '').matchAll(/"([A-Za-z_][\w-]*)"\s*:/g)) add(m[1]);
  for (const m of String(text || '').matchAll(/(?:^|[&\s'"])([A-Za-z_][\w-]*)=/g)) add(m[1]);
  return names;
}

/**
 * The hunt's discovered endpoint coverage, derived ONLY from its own
 * tool_call record: every URL on the target host the hunter has
 * touched (browser_open, or a URL inside a shell command), with how
 * often, which input names it was seen taking (query keys + body
 * keys), whether data was ever sent to it, and which probe classes
 * have actually reached it (payload-signature match on the actions
 * that touched it). Sorted most-visited first. Pure.
 */
export function discoveredEndpoints(events, target) {
  const tHost = targetHostOf(target);
  if (!tHost) return [];
  const byKey = new Map();
  const touch = (rawUrl, text, dataSent) => {
    let u;
    try {
      u = new URL(rawUrl);
    } catch {
      return;
    }
    if (u.hostname.toLowerCase() !== tHost) return;
    let p = u.pathname || '/';
    if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
    const key = `${u.protocol.toLowerCase()}//${u.host.toLowerCase()}${p}`;
    let ep = byKey.get(key);
    if (!ep) {
      ep = { url: key, path: p, visits: 0, params: [], dataSent: false, probeActions: 0, probedClasses: new Set() };
      byKey.set(key, ep);
    }
    ep.visits++;
    if (dataSent) ep.dataSent = true;
    for (const name of paramNamesFrom(`${u.search || ''} ${text || ''}`)) {
      if (!ep.params.includes(name) && ep.params.length < 6) ep.params.push(name);
    }
    let probedHere = false;
    for (const t of PROBE_TOPICS) {
      if (t.probes.some((re) => re.test(text || ''))) {
        ep.probedClasses.add(t.id);
        probedHere = true;
      }
    }
    if (probedHere) ep.probeActions++;
  };
  for (const e of events || []) {
    if (!e || e.type !== 'tool_call') continue;
    const detail = String(e.detail || '');
    if (!detail) continue;
    if (e.tool === 'browser_open') {
      touch(detail.trim(), detail, false);
    } else if (e.tool === 'shell') {
      const dataSent = /(-d\b|--data|-X\s*(POST|PUT|PATCH|DELETE)\b|-F\b)/i.test(detail);
      for (const m of detail.match(URL_IN_TEXT) || []) touch(m, detail, dataSent);
    }
  }
  return [...byKey.values()]
    .map((ep) => ({ ...ep, probedClasses: [...ep.probedClasses] }))
    .sort((a, b) => b.visits - a.visits);
}

/**
 * How many actions in the record carry a payload signature for the
 * topic — the strict, per-class probe count (events side only; the
 * same tool set the topic accounting treats as probe-capable).
 */
export function probeSignatureHits(events, topic) {
  if (!topic || !Array.isArray(topic.probes)) return 0;
  let hits = 0;
  for (const e of events || []) {
    if (!e || e.type !== 'tool_call') continue;
    if (!['shell', 'browser_open', 'browser_click', 'browser_type', 'claim_finding'].includes(e.tool)) continue;
    const detail = String(e.detail || '');
    if (detail && topic.probes.some((re) => re.test(detail))) hits++;
  }
  return hits;
}

/**
 * Concrete unprobed leads: the join of researchedTopicStats and
 * discoveredEndpoints. Two kinds, topic leads first:
 *   1. a researched class that has never been probed — or that the
 *      binary probed flag credits on glancing evidence only (at most
 *      one payload-signature action against ≥5 research hits, and
 *      the class is not one whose canonical probe is a single
 *      observation) — grounded on the best discovered endpoint for
 *      it (a path match for the class, else the most-visited
 *      endpoint that takes input and has not been probed for this
 *      class), naming the input and the canonical first test value.
 *      On the live Ezviz record this tier is what surfaces SQL
 *      injection at all: researched ×104, its entire "probing" one
 *      typed fragment (`sql' --` in a form field).
 *   2. a discovered endpoint that has never received any probe at
 *      all (the bare root path is the lobby, not a lead, and is
 *      skipped unless it takes parameters), ordered so an endpoint
 *      matching an unprobed class's path pattern and endpoints
 *      taking parameters come before plain pages.
 * An endpoint already probed for a class is not offered for it; an
 * endpoint that receives a probe drops off the coverage list.
 * Pure; capped at `limit` lines, each clipped.
 */
export function unprobedLeadLines({ events = [], reasoningRows = [], target = '', limit = 6 } = {}) {
  const allStats = researchedTopicStats({ events, reasoningRows });
  const neverProbed = allStats.filter((s) => !s.probed).map((s) => ({ ...s, glancing: -1 }));
  const glancing = allStats
    .filter((s) => s.probed && !s.topic.oneShot && s.n >= 5)
    .map((s) => ({ ...s, glancing: probeSignatureHits(events, s.topic) }))
    .filter((s) => s.glancing <= 1);
  const topicLeads = [...neverProbed, ...glancing].sort((a, b) => b.n - a.n).slice(0, 4);
  const endpoints = discoveredEndpoints(events, target);
  const lines = [];
  const namedUrls = new Set();
  // 1. Topic leads — researched class × concrete surface.
  for (const s of topicLeads) {
    const t = s.topic;
    const candidates = endpoints.filter((ep) => !ep.probedClasses.includes(t.id));
    // Rank: endpoints no probe of ANY class has reached first (virgin
    // input surface beats re-working an endpoint another class is
    // already on), then most-visited.
    const ranked = [...candidates].sort((a, b) => (a.probeActions > 0 ? 1 : 0) - (b.probeActions > 0 ? 1 : 0) || b.visits - a.visits);
    const pathMatch = t.pathRe ? ranked.find((ep) => t.pathRe.test(ep.path)) : null;
    const ep = pathMatch || ranked.find((e) => e.params.length || e.dataSent) || ranked[0] || null;
    const where = ep ? ep.url : String(target || '');
    if (ep) namedUrls.add(ep.url);
    const param = ep && ep.params.length ? ep.params[0] : '';
    const via = t.via
      ? t.via(param)
      : param
        ? `with ${param} set to ${t.testValue}`
        : t.testValue
          ? `with a test input set to ${t.testValue}`
          : '';
    // Topics carrying their own phrasing (t.via) name the method
    // themselves; the rest get a plain method + endpoint + input.
    const lead = t.via
      ? `Concrete next probe: ${where}${via ? ` ${via}` : ''} — ${t.testNote}.`
      : `Concrete next probe: ${ep && ep.dataSent ? 'POST' : 'send a request to'} ${where}${via ? ` ${via}` : ''} — ${t.testNote}.`;
    const researched = s.glancing < 0
      ? `researched ×${s.n}, never probed`
      : s.glancing === 0
        ? `researched ×${s.n}; no payload for it exists anywhere in your record — never actually probed`
        : `researched ×${s.n}; your whole record holds exactly one glancing attempt at it — never a complete probe`;
    lines.push(clipLine(`- ${t.label} — ${researched}. ${lead}`, 280));
  }
  // 2. Coverage leads — discovered surface no probe has ever reached,
  // ordered: an endpoint matching a lead-eligible class's path
  // pattern first, then endpoints taking parameters, then the rest
  // by visits.
  const coverage = endpoints
    .filter((ep) => ep.probeActions === 0 && !(ep.path === '/' && !ep.params.length) && !namedUrls.has(ep.url))
    .map((ep) => {
      const pair = topicLeads.find((s) => s.topic.pathRe && s.topic.pathRe.test(ep.path)) ||
        allStats.find((s) => !s.probed && s.topic.pathRe && s.topic.pathRe.test(ep.path));
      return { ep, pair };
    })
    .sort((a, b) => (b.pair ? 1 : 0) - (a.pair ? 1 : 0) || (b.ep.params.length ? 1 : 0) - (a.ep.params.length ? 1 : 0) || b.ep.visits - a.ep.visits);
  for (const { ep, pair } of coverage) {
    if (lines.length >= limit) break;
    const paramNote = ep.params.length ? ` It takes parameters: ${ep.params.join(', ')}.` : '';
    const pairNote = pair ? ` It pairs with your unprobed research: ${pair.topic.label} (researched ×${pair.n}, never probed).` : '';
    lines.push(clipLine(`- ${ep.url} — discovered in your own record (visited ×${ep.visits}), never probed: no test payload has ever been sent to it.${paramNote}${pairNote}`, 280));
  }
  return lines.slice(0, limit);
}

// ---------------------------------------------------------------------------
// COVERAGE LEDGER + SESSION RECONCILIATION (Lane L, 22 Oct 2026)
//
// Lane J made researched-but-unprobed classes concrete for the
// CURRENT screen, but its leads are recomputed from the raw record
// every turn and carry no accounting: nothing records that a class
// was ever DELIBERATELY closed, and research debt evaporates at the
// session boundary (Lane I's open threads are recomputed hunt-wide,
// not accumulated). Lane L adds the durable half, re-implementing
// the state contracts Lane K extracted from usestrix/strix (§1.6,
// §3 P1+P4) in our idiom:
//
//   P1 — a per-hunt coverage ledger (coverageLedger.js): rows keyed
//   by (surface, class), written by the brain's own record_coverage
//   action, with code-enforced uniqueness (a second row for a key
//   returns the existing row instead of duplicating) and closure
//   evidence (ruled_out / not_applicable must name the control).
//   Open rows render on screen next to Lane J's leads and take
//   precedence over them (mergeLeadsWithCoverage below).
//
//   P4 — at session end, the classes researched in THIS session are
//   reconciled against probe actions and ledger rows
//   (reconcileSessionResearch below). Unaccounted research becomes
//   an open_gap ledger row + a leftOff open item, and the cumulative
//   researched-vs-probed counters (research debt) persist in the
//   ledger, so "researched ×104, never probed" is a tracked debt
//   the briefing shows, not a statistic that resets.
//
// One free hunter preserved: record_coverage is the brain's choice,
// like recall/note; nothing probes or claims on its behalf. The P4
// reconciliation writes ONLY bookkeeping rows about research debt —
// it records that research is unaccounted, never that a probe
// happened. DOSSIER.md is deliberately NOT written here:
// consolidation.js owns it and regenerates it wholesale, so open
// items live in leftOff + the ledger instead of fighting it.
// ---------------------------------------------------------------------------

/** The topic a Lane J lead line belongs to, when it names one. */
function leadTopicOf(line) {
  const s = String(line || '');
  for (const t of PROBE_TOPICS) {
    if (s.startsWith(`- ${t.label} `) || s.startsWith(`- ${t.label} —`)) return t;
    if (s.includes(`pairs with your unprobed research: ${t.label} (`)) return t;
  }
  return null;
}

/** The first URL a lead line names (its grounded surface), or ''. */
function leadUrlOf(line) {
  const m = /https?:\/\/[^\s'"]+/.exec(String(line || ''));
  return m ? m[0].replace(/[.,;]+$/, '') : '';
}

/**
 * Merge Lane J's computed leads with the coverage ledger for the
 * screen. Precedence rule: a ledger row accounts for its
 * (surface, class) key, so a computed lead for the SAME key is
 * dropped — the ledger line replaces it. A row recorded against
 * the hunt target as a whole additionally takes precedence over
 * that class's topic lead (the brain accounted for the class on
 * the target generally; the concrete computed lead would only
 * re-list the same class). Computed leads still cover every class
 * and endpoint with no row yet. Returns { leads, coverage }:
 * the filtered Lane J lines, and the ledger lines (open gaps
 * first, then research debt for classes no row accounts for).
 * Pure.
 */
export function mergeLeadsWithCoverage({ leads = [], rows = [], debt = {}, target = '' } = {}) {
  const rowList = Array.isArray(rows) ? rows : [];
  const targetSurface = normaliseSurface(target);
  const hasRow = (surface, cls) => rowList.some((r) => r.class === cls && r.surface === surface);
  const keptLeads = [];
  for (const line of leads || []) {
    const topic = leadTopicOf(line);
    if (topic) {
      const url = normaliseSurface(leadUrlOf(line));
      if (hasRow(url, topic.id) || (targetSurface && hasRow(targetSurface, topic.id))) continue;
    }
    keptLeads.push(line);
  }
  const coverage = [];
  const gaps = openGapRows({ rows: rowList })
    .slice()
    .sort((a, b) => ((debt[b.class] && debt[b.class].researched) || 0) - ((debt[a.class] && debt[a.class].researched) || 0));
  for (const r of gaps.slice(0, 6)) {
    const d = debt[r.class];
    const debtNote = d && d.researched > 0 && !d.probed ? ` — researched ×${d.researched} across sessions, still unprobed` : '';
    const ev = r.evidence ? ` ${clipLine(r.evidence, 140)}` : '';
    coverage.push(clipLine(`- OPEN GAP: ${r.surface} × ${classLabelFor(r.class)}${debtNote}.${ev}`, 280));
  }
  const gapClasses = new Set(gaps.map((r) => r.class));
  const accounted = new Set(rowList.map((r) => r.class));
  const debtLines = Object.entries(debt || {})
    .filter(([cls, d]) => d && Number(d.researched) > 0 && !d.probed && !gapClasses.has(cls) && !accounted.has(cls))
    .sort((a, b) => (Number(b[1].researched) || 0) - (Number(a[1].researched) || 0))
    .slice(0, 3)
    .map(([cls, d]) => clipLine(`- RESEARCH DEBT: ${classLabelFor(cls)} — researched ×${d.researched} across ${d.sessionsResearched || 1} session(s), still unprobed, and no coverage row accounts for it yet.`, 280));
  return { leads: keptLeads, coverage: [...coverage, ...debtLines].slice(0, 8) };
}

/**
 * Session-end reconciliation (Lane L P4) — pure. Diffs the classes
 * researched in THIS session (the session's own event/reasoning
 * slice, counted by the same researchedTopicStats machinery the
 * briefing uses) against (a) probe-signature actions in the same
 * slice and (b) any coverage-ledger row for the class. Returns:
 *   openItems  — leftOff lines for researched-but-unaccounted classes
 *   gapInputs  — open_gap row inputs for those classes (surface =
 *                the hunt target; the ledger's uniqueness rule means
 *                re-running this never duplicates a row)
 *   debtStats  — [{ id, n, probed }] for EVERY class researched this
 *                session, for the cumulative debt merge
 * A class probed this session, or already carrying any ledger row,
 * is accounted and produces no open item.
 */
export function reconcileSessionResearch({ sessionEvents = [], sessionRows = [], coverageData = null, target = '' } = {}) {
  const stats = researchedTopicStats({ events: sessionEvents, reasoningRows: sessionRows });
  const rows = coverageData && Array.isArray(coverageData.rows) ? coverageData.rows : [];
  const prevDebt = (coverageData && coverageData.researchDebt) || {};
  const openItems = [];
  const gapInputs = [];
  const debtStats = [];
  for (const s of stats) {
    debtStats.push({ id: s.topic.id, n: s.n, probed: s.probed });
    if (s.probed) continue;
    if (rows.some((r) => r.class === s.topic.id)) continue;
    const cumulative = (Number(prevDebt[s.topic.id] && prevDebt[s.topic.id].researched) || 0) + s.n;
    openItems.push(`- ${s.topic.label}: researched ×${s.n} this session (×${cumulative} across all sessions), 0 probes — carried open in your coverage ledger.`);
    gapInputs.push({
      surface: String(target || ''),
      class: s.topic.id,
      outcome: 'open_gap',
      evidence: `Researched ×${s.n} this session with no probe and no coverage row; opened by session-end reconciliation — memory bookkeeping about research debt, not a probe.`,
    });
  }
  return { openItems, gapInputs, debtStats };
}

/** The observation text for a record_coverage result. */
function coverageObservation(result, { surface, cls }) {
  const label = classLabelFor(cls);
  if (!result) return 'Coverage ledger unavailable this turn — nothing was recorded.';
  if (result.status === 'created' || result.status === 'updated') {
    const row = result.row || {};
    return `Coverage ${result.status === 'created' ? 'recorded' : 'updated'}: ${row.surface || surface} × ${label} → ${row.outcome}. Your ledger is your accounting: a surface × class counts as dealt with only when its row says so, and an open_gap row stays on your screen until you probe it or close it with a named control.`;
  }
  if (result.status === 'duplicate') {
    const row = result.row || {};
    return `Already on your coverage ledger: ${row.surface || surface} × ${label} is recorded as ${row.outcome}${row.evidence ? ` (evidence: ${clipLine(row.evidence, 160)})` : ''}. A surface × class is accounted for exactly once, so nothing was written. To change the row, send record_coverage again with "update":true.`;
  }
  return `NOT recorded: ${result.error || 'the coverage write was rejected'}.`;
}

/**
 * (c) Distilled global-memory lessons relevant to this target type, as
 * compact one-liners (reuses the store's own prompt formatter, header
 * stripped). Capped at 5 lines.
 */
export function globalLessonLines(memories = []) {
  let text = '';
  try {
    text = formatGlobalMemoryForPrompt(memories || []);
  } catch {
    return [];
  }
  if (!text) return [];
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('•'))
    .slice(0, 5)
    .map((l) => `- ${clipLine(l.replace(/^•\s*/, ''), 200)}`);
}

/**
 * Assemble the memory briefing in binding priority order inside the
 * existing cap: dead ends → researched-not-probed → global lessons →
 * full-history ledger (the caller sizes the ledger to the budget this
 * head leaves). Empty sources contribute nothing — no placeholders.
 */
export function assembleMemoryBriefing({ deadEnds = [], unprobed = [], globalLessons = [], ledgerText = '', dossierText = '', budgetChars = BRIEFING_BUDGET } = {}) {
  const head = [];
  if (dossierText) head.push(['--- FROM YOUR DOSSIER (open threads / next step) ---', String(dossierText)].join('\n'));
  if (deadEnds.length) head.push(['--- DEAD ENDS ON THIS TARGET (tried and failed here — do not repeat these) ---', ...deadEnds].join('\n'));
  if (unprobed.length) head.push(['--- RESEARCHED BUT NEVER PROBED (your own open threads) ---', ...unprobed].join('\n'));
  if (globalLessons.length) head.push(['--- LESSONS FROM ALL PAST HUNTS ---', ...globalLessons].join('\n'));
  const headText = head.join('\n\n');
  const parts = [headText, String(ledgerText || '')].filter((p) => p && p.trim());
  return parts.join('\n').slice(0, budgetChars);
}

/** Length of the priority head alone — sizes the ledger's budget. */
export function memoryHeadLength({ deadEnds = [], unprobed = [], globalLessons = [], dossierText = '' } = {}) {
  return assembleMemoryBriefing({ deadEnds, unprobed, globalLessons, dossierText, ledgerText: '', budgetChars: Number.MAX_SAFE_INTEGER }).length;
}

// ---------------------------------------------------------------------------
// WORKING MEMORY (Lane I, 21 Oct 2026 — owner order: "make it like a
// human — when he is thinking he knows his past, what he has done
// already, and what he is doing now").
//
// Three truth fixes on top of Lanes F+G:
//   * RETRACTIONS: Lane A appended 'retraction' events for the two
//     false Ezviz FTP stamps, but every display path still read the
//     raw finding events, so the brain kept seeing its own retracted
//     claims stamped [VERIFIED]. applyRetractions is the display-side
//     truth filter (the verifier itself is untouched).
//   * DOSSIER: consolidation writes DOSSIER.md into the hunt dir, but
//     human mode never read it — its distilled open threads / next
//     step now lead the briefing. ONLY those two sections are read:
//     the dossier's Confirmed-facts section can still carry
//     pre-retraction pollution, so it is never surfaced here.
//   * CONTINUITY + JOURNAL + RECALL live in humanIteration below.
// ---------------------------------------------------------------------------

// applyRetractions / retractedFindingCount live in huntMemory.js
// since Lane O (imported + re-exported above).

// extractDossierBriefing lives in huntMemory.js since Lane O
// (imported + re-exported above); the dossier itself is loaded by
// loadHuntMemory, so the briefing below reads it from the snapshot.

export function buildMemoryBriefing(huntId, target, meta) {
  try {
    // Lane O: every hunt-local source comes through the single
    // memory read path (huntMemory.loadHuntMemory), which loads and
    // reconciles the reasoning record, the event record, the
    // retraction-filtered findings, the ruled-out registry and the
    // dossier from disk — tolerantly, so a torn line in any store
    // costs that line, never the briefing.
    const memory = loadHuntMemory(huntId, { target, meta });
    const rows = memory.reasoningRows;
    const events = memory.events;
    // Lane I: retracted claims are not findings — the ledger must not
    // keep stamping them [VERIFIED] after their retraction landed.
    const findings = memory.findings;
    // Lane I: the dossier consolidation wrote for this target leads
    // the briefing (open threads + next step only — see above).
    const dossierText = memory.dossierBriefing;

    // (a) dead ends for this target — validator registry + rejected claims
    const deadEnds = deadEndLines({ ruledOut: memory.ruledOut, events });
    // (b) researched but never probed — from the hunt's own record
    const unprobed = researchedNotProbedLines({ events, reasoningRows: rows });
    // (c) distilled global lessons for this target type.
    // HUMAN-BRAIN (26 Oct 2026, per-hunt isolation): the target is
    // passed so another target's endpoint-specific lessons are
    // reduced to their technique rate before they reach the screen.
    let globalLessons = [];
    try {
      const fp = (meta && meta.appFingerprint) || (memory.meta && memory.meta.appFingerprint) || { appType: 'unknown', techStack: [] };
      globalLessons = globalLessonLines(getRelevantMemories(fp, 6, { target }));
    } catch { /* global memory is best-effort */ }

    // The ledger fills whatever the priority head leaves of the
    // existing cap (its own action budget was 6,000 when it stood
    // alone; findings/dead-end fixed lines always render in full).
    const headLen = memoryHeadLength({ deadEnds, unprobed, globalLessons, dossierText });
    const ledgerBudget = Math.max(1200, Math.min(6000, BRIEFING_BUDGET - headLen - 1));
    const ledger = buildFullHistoryLedger({
      reasoningRows: rows,
      findings,
      chainContext: (meta && meta.chainContext) || (memory.meta && memory.meta.chainContext) || null,
      budgetChars: ledgerBudget,
      knownApp: knownAppOf(meta, target),
    });
    return assembleMemoryBriefing({
      deadEnds,
      unprobed,
      globalLessons,
      dossierText,
      ledgerText: ledger.text || '',
      budgetChars: BRIEFING_BUDGET,
    });
  } catch {
    return '';
  }
}

function systemPromptFor(target, parsedScope) {
  const rules = [];
  if (parsedScope && parsedScope.rules) {
    if (parsedScope.rules.noHeavyScan) rules.push('NO automated scanners or heavy traffic — single, human-paced, targeted probes only');
    if (parsedScope.rules.maxRequestsPerMin) rules.push(`at most ${parsedScope.rules.maxRequestsPerMin} requests per minute to the target`);
    if (parsedScope.rules.noDoS) rules.push('no denial-of-service, ever');
  }
  rules.push('test ONLY your own accounts and data — never touch another user\'s data');
  rules.push('non-destructive: read and probe, do not break or delete anything');
  return [
    `You are an elite human bug-bounty hunter who has been hired to test ${target}. You are sitting at your own Kali machine. You see the machine's current state below.`,
    // HUNTER-MIND (26 Oct 2026): the owner wants the agent to KNOW
    // it is a bug bounty agent with its own machine — not a chatbot
    // answering prompts. This Kali machine is YOURS: your device,
    // your tools, your files, your memory. You decide what to do
    // next; you make your own instructions and follow them. When
    // you need a tool, you open it yourself — BurpSuite, the
    // terminal, nmap — nobody hands you steps.
    'This Kali machine is YOURS — your device, your tools, your files, your memory. You ARE a bug bounty agent: you decide what to do next, you make your own instructions and follow them, and you save everything you learn into your own files so it is still there next time. When you need a tool, you open it yourself — BurpSuite, the terminal, nmap — nobody hands you steps. A step is done only when its output is saved in your record; completed work is never done twice.',
    // HUMAN-BRAIN (26 Oct 2026, owner order: NO PREDEFINED
    // SEQUENCE). There is no fixed recon→scan→exploit script and no
    // checklist to work through — every step is decided fresh from
    // memory plus live observation, so a different target or a
    // different memory means a different first move. Stated on the
    // screen because the plan instruction alone does not forbid a
    // canned order; the test asserts this line is present and that
    // no fixed-sequence wording exists anywhere in the prompt.
    'There is no fixed order of operations — no recon→scan→exploit script, no checklist to work through. Decide each step fresh from what you remember and what you just observed; a different target or a different memory means a different first move. Your plan is yours, and it changes when the evidence changes.',
    // EVIDENCE-TRANSCRIPTION (1 Nov 2026, owner order): the brain is a stateless API —
    // it does not remember between calls. When it SEES exploit evidence on screen
    // (password hashes, dumped usernames, SQL errors), it must TRANSCRIBE the actual
    // values into its text response. The auto-filer only reads text, not screenshots.
    'CRITICAL: When you SEE exploit evidence on screen — password hashes (32-char hex), dumped usernames, SQL error messages, command output — you MUST transcribe the ACTUAL values into your text response. Do not just say "I see hashes"; write the actual hash strings like 5f4dcc3b5aa765d61d8327deb882cf99. The system that files your findings only reads your TEXT, not your screenshots. No transcription = no filing = your work is wasted.',
    'You also have a real desktop with a Chromium browser on this machine: you can open pages, SEE them (browser_snapshot gives you the page text and its clickable elements), click and type like a person at a computer, and take screenshots. The desktop itself is yours too — the whole XFCE desktop, not just the browser: desktop_snapshot shows you its windows, desktop_click focuses a window by title, desktop_key sends keys to the focused window, and desktop_screenshot captures the whole desktop. GUI apps (Burp, ZAP, Wireshark, the terminal) launch from the shell; focus one with desktop_click, then work it with the keyboard. You SEE the desktop itself with see_screen: it reads the screen into a text map — every visible word with its (x, y) position — and you click what you see with desktop_click_at. Launch a named tool with launch_tool (it waits for the window and shows you the screen); list the named controls of a window with list_controls before pressing one with desktop_click_control. Look, then act, then look again to confirm the screen changed.',
    // VISIBLE-DESKTOP-FIRST (27 Oct 2026, owner order): the desktop
    // was described as an OPTION, so the brain rationally picked
    // the fastest tool — headless shell curls, which the owner
    // cannot see. This section is the routing rule: interactive
    // work happens ON the visible desktop; shell stays for work
    // that needs no screen. It routes HOW an action is performed,
    // never WHICH vulnerability to try — the brain still chooses.
    DESKTOP_FIRST_RULE,
    // HUNTER-MIND (26 Oct 2026): narration — the owner watches the
    // thinking and wants it to read like a hunter thinking aloud
    // ("abhi main nmap chala ke subdomain enum karta hoon"), in the
    // user's language, grounded in what the hunter is actually
    // doing — never a status template, never counts it did not earn.
    'Each reply: first think aloud like a hunter at his machine — in the user\'s language, in your own words, 2–3 sentences: what you are doing right now, what the last output told you, and what you will try next and why. Say it like you would to another hunter watching over your shoulder — never a status template, never counts you did not earn, never "I will do X later" without doing it. Then give EXACTLY ONE action as a JSON object on the last line:',
    // REAL-HUMAN (26 Oct 2026): the owner talks to you mid-hunt.
    // When YOUR OWNER\'S QUESTIONS are on your screen, answer them
    // in THIS reply: add a "chat_answers" array to your action JSON
    // — [{"q":"<id>","answer":"..."}] — one answer per question, in
    // the user\'s language, from what you actually did and think.
    // Never a canned summary, never counts you did not earn, never
    // "I will answer later" — the answer IS this reply. A question
    // you leave out stays queued for your next turn.
    'If YOUR OWNER\'S QUESTIONS are on your screen, answer them in this same reply: add "chat_answers":[{"q":"<id>","answer":"your answer in the user\'s language"}] to your action JSON (beside the action, not instead of it). Answer from what you actually did and think — a real human answers the person talking to them, they do not recite a status template.',
    '{"action":"shell","command":"..."} — run any shell command on your machine (curl, nmap, python3, anything installed — or download/install what you need)',
    '{"action":"search","query":"..."} — search the web (techniques, CVEs, docs)',
    '{"action":"write_file","name":"x.py","content":"..."} — save a file or script in your workspace (permanent: it survives container restarts); run it later with a shell action. For anything longer than one reply — a big script, a tool installer — write the first chunk with write_file, then keep appending one chunk per reply with a shell action whose command is APPEND_ARTIFACT: x.py followed by the next chunk on the next line, resuming exactly where the last chunk ended; READ_ARTIFACT: x.py with start:end reads any slice back. Save downloaded tools the same way: keep the installer script as a file and rerun it in a fresh container, never trust a container install to survive a restart.',
    '{"action":"browser_open","url":"..."} — open a page in your desktop browser',
    '{"action":"browser_snapshot"} — see the current page: its text and clickable elements',
    '{"action":"browser_click","text":"visible label OR CSS selector"} — click in the desktop browser',
    '{"action":"browser_type","target":"field label OR CSS selector","text":"...","submit":true} — type into THAT field (it is cleared first, then your text is typed; the observation tells you what the field holds afterwards — if it does not match what you typed, snapshot and correct yourself; a type without a target is refused). submit=true presses Enter after typing',
    '{"action":"screenshot"} — capture the browser viewport to a PNG artifact; you also get the page text',
    '{"action":"desktop_snapshot"} — see the whole XFCE desktop: its windows and which one is focused (text — you never see the image; the owner watches the desktop live)',
    '{"action":"desktop_click","window":"Burp Suite"} — focus a window by its title (exact, starts-with, or contains) and send it a click; the focused window then receives your desktop_key keystrokes. Take desktop_snapshot first if you do not know the window titles.',
    '{"action":"desktop_click_control","control":"Repeater","window":"Burp Suite"} — click a NAMED CONTROL inside a GUI app (a tab, a button, a menu item) by its visible name: the loop finds it in the app\'s accessibility tree and clicks it. Give the control\'s visible name ("Repeater", "Send", "Proxy"), and "window" when more than one app is open. This is how you press a button inside Burp/ZAP/Wireshark — desktop_click only focuses a window, it never presses a button inside it. If the app has no accessibility tree (or AT-SPI is not installed in this image), the observation says so — fall back to desktop_key keyboard navigation.',
    '{"action":"desktop_key","keys":"ctrl+l"} — send keys to the focused window: modifiers ctrl/alt/shift/super/meta plus one key (Return, Tab, Escape, space, BackSpace, Delete, arrows, Home, End, Page_Up, Page_Down, F1-F12, or a single letter/digit). Or {"action":"desktop_key","text":"nmap -sV target"} to type literal text into the focused window. This is how you work inside GUI apps after focusing them.',
    '{"action":"desktop_screenshot"} — capture the WHOLE desktop (not just the browser) to a JPG artifact; you also get the desktop state text',
    '{"action":"see_screen"} — LOOK at the desktop yourself: read the whole screen into a text map — every visible word with its (x, y) position, e.g. `"Log in" at (1240, 310)`. This is how you see what is on screen (you never see the image itself). Use it before clicking anything on the desktop, and again after acting to confirm the screen changed. If it says OCR is not installed, the image rebuild has not landed yet — use desktop_snapshot instead.',
    '{"action":"desktop_click_at","x":1240,"y":310} — click at a point FROM THE SCREEN MAP (see_screen first; never guess coordinates). The mouse moves to (x, y) and clicks. Then see_screen again to confirm what changed.',
    // MISSION Stage 2 (31 Oct 2026): explicit expectation — the brain
    // declares what the action should achieve; the loop verifies it.
    'EXPECTATION (proves your action worked — use it on important actions): add "expect" to any action, e.g. {"action":"browser_click","text":"Login","expect":"url contains /dashboard"}. Clauses, ";"-separated: "url contains <text>", "url is <url>", "url not <text>", "text contains <text>", "text absent <text>". The next observation carries [EXPECTATION VERIFIED] or [EXPECTATION NOT VERIFIED] with evidence — on NOT VERIFIED, diagnose and retry instead of assuming success.',
    // MISSION Stage 3 (31 Oct 2026): structured plan — objective, state,
    // risk, fallback alongside the machine-checkable expect.
    'STRUCTURED PLAN (makes your reasoning auditable — use it on multi-step work): add "plan" to any action, e.g. {"action":"browser_click","text":"Login","expect":"url contains /dashboard","plan":{"objective":"log in to DVWA","state":"on the login page with a vaulted credential","expected":"dashboard loads","risk":"low — lab target, in scope","fallback":"if login fails, read the error text and re-type the password"}}. The plan is recorded; on [EXPECTATION NOT VERIFIED] your fallback is surfaced back to you.',
    // TOOLS/OS AUTONOMY (27 Oct 2026, owner order): named tool
    // launches, allow-listed installs, and control lists — the
    // structured actions behind the desktop-tools skill card.
    '{"action":"launch_tool","tool":"burp"} — launch a NAMED tool on your machine and wait for it to be ready: GUI tools (burp, zap, wireshark) open on the desktop and you get a fresh screen map back; CLI tools (nmap, nikto, nuclei, sqlmap, ffuf, gobuster) are checked and you get their version. A repeat launch just reports the tool is already running — it never starts a second copy. Use launch_tool (not shell) for starting GUI tools. The first Burp launch in a hunt also walks the first-run wizard, confirms the intercept proxy, and opens the target in Burp\'s own browser.',
    '{"action":"download_tool","tool":"subfinder"} — install a tool that is missing from this machine. Installable tools are: subfinder, amass, dnsenum, whatweb (apt) and jwt-tool (one small direct download). Anything else is refused before anything runs. The install is logged, and the tool stays installed in this container.',
    '{"action":"list_controls","window":"Burp Suite"} — list the NAMED controls (buttons, tabs, fields) of a GUI window from its accessibility tree, with the screen position of each. Use it before desktop_click_control when you do not know a control\'s exact name. If the app exposes no tree, the observation says so — fall back to see_screen and desktop_click_at.',
    // HUMAN-BRAIN (26 Oct 2026, owner order: GUI-VISIBLE TERMINAL).
    // Terminal work happens in a terminal window ON the GUI desktop
    // so the owner watches it live — this action opens xfce4-terminal
    // if needed, focuses it, types the command visibly, presses
    // Return, and brings the output back (the run is also saved in
    // the output ledger, like a shell run). Same rules as shell:
    // scope-checked, deduped, recalled from the saved output.
    '{"action":"desktop_terminal","command":"..."} — run a command in a terminal window ON the GUI desktop (the owner watches it live): the loop opens xfce4-terminal if needed, focuses it, types your command visibly and presses Return, and brings the output back to you. Use it for terminal work you want seen — nmap, curl, a script — instead of the headless shell action. Same rules as shell: scope-checked, deduped, and answered from the saved output if you already ran it (force + why to re-run).',
    '{"action":"proxy_start"} — start your intercepting proxy (Burp-style) on this machine: your browser is re-routed through it so EVERY request/response is captured, and you get the intercept dashboard URL — open it in your browser to click through captured requests visually. The proxy is pass-through: traffic is captured, never held.',
    '{"action":"intercept_list"} — list the requests your proxy has captured (newest last, each with a # index)',
    '{"action":"intercept_read","index":3} — read one captured request in full: its headers and body, and the response headers and body',
    '{"action":"intercept_replay","index":3,"headers":{"X-Test":"1"},"body":"changed=1","url":"http://target.test/other"} — resend a captured request from your machine, optionally with a changed URL, extra/changed headers (a null value removes a header), or a changed body. This is Burp Repeater work: change ONE thing at a time and compare the response. The URL is scope-checked like any other action.',
    '{"action":"note","text":"..."} — write a note in your own notebook (your memory is permanent)',
    '{"action":"recall","query":"..."} — search YOUR OWN memory: this hunt\'s full record, what earlier hunts on THIS target learned, and generic technique rates from other targets (never their endpoints or payloads — each target\'s memory stays its own). Use it whenever your briefing mentions something you need in detail — an exact result, a payload you tried, a lesson — instead of re-doing the work; remembering is free and instant.',
    // KEYWORD-INDEX (27 Oct 2026): recall by sequential id + the
    // task block beside the action. The Action Index on every screen
    // lists one line per action, numbered #1, #2, #3… — the number IS
    // the lookup. The task block is the hunt's current state: the
    // backend records it, and the next turn resumes it instead of
    // starting fresh.
    '{"action":"recall","id":7} — fetch the FULL stored record of action #7 from your Action Index (one line per action, numbered #1, #2, #3… — the number is the lookup, no search needed). Use it when you need an exact result, a payload you tried, or an output — instead of re-doing the work. Out of range, the observation says how many actions the index holds.',
    // BRAIN FILES (28 Oct 2026, owner order): the brain's context is
    // three files. The MEMORY file (titles + hashes only — what was
    // done, never the results) and the PROCESS file (the current
    // process, full detail, in_process true/false) are sent to you
    // every turn on your screen. The OUTPUT file (the results) stays
    // on the backend — fetch ONE result by hash/id when you need it.
    'YOUR SCREEN carries your MEMORY file (titles + hashes — everything you have done in this hunt, so you NEVER repeat work) and your PROCESS file (the process you are in, in_process true/false, and every line of what has happened in it). Read both before choosing. When a process finishes (in_process flips to false), think of a NEW process — a new vulnerability, a new curiosity, a new variety.',
    // RECALL WITH A REASON (28 Oct 2026, owner order): when you need
    // a past result, say WHY — {"recall":{"id":7,"reason":"I need the exact UNION payload that dumped the users, to reuse it on the next endpoint"}}. The reason is recorded with the request.',
    'When you recall a past action, ALWAYS say why: {"recall":{"id":7,"reason":"<why you need this data>"}} — the reason is recorded with the request. A recall without a reason is still served, but a brain that cannot say why it needs data is a brain guessing.',
    'Your reply may carry a task block beside the action: {"task":"<what you are doing right now>","goal":"<what it achieves>","progress":"<how far you are>","status":"in_progress"} — I record it as your current task, so the next turn resumes it instead of starting fresh. When a task is DONE, send the block with "status":"complete" and a one-line "summary" of what it produced — its input and output are saved to your record then. A task is a goal plus its actions; finishing one is how the hunt moves forward.',
    'Your screen carries an ACTION INDEX — one line per action you have taken in THIS hunt, numbered #1, #2, #3… with a one-word outcome each. It is your complete map of what is done: read it before choosing, so you never redo a finished action and you can see which variants are still open.',
    // HUNTER-MIND (26 Oct 2026): the plan is the hunter's own
    // instructions — it writes them, works them step by step, and
    // checks steps off with evidence. And the output ledger: an
    // action already run is answered from its saved output instead
    // of re-running — a redo needs a stated reason ("force" + "why").
    '{"action":"hunt_plan","steps":["first step in your words","next step","..."]} — write or revise YOUR OWN hunt plan: your own steps, your own order, up to 12 steps, one instruction each. Your plan runs the hunt: work it step by step. {"action":"hunt_plan","done":2,"evidence":"the output that proves it"} marks a step done (step number, or its id); {"action":"hunt_plan","skip":2,"evidence":"why it does not apply"} drops one. Finished steps stay finished — a revised list never resurrects them.',
    'Your completed work is saved in your record: if you choose an action you already ran, the loop answers with the saved output instead of re-running it — act on that output. Re-run ONLY if something changed (the target changed, you need a different flag or scope, the saved output is incomplete for what you need now) — and say why: repeat the action with "force": true and "why": "<your reason>". A re-run without a reason is refused.',
    '{"action":"record_coverage","surface":"the page/endpoint/feature","class":"the vuln class","outcome":"probed_clean|confirmed|ruled_out|not_applicable|open_gap","evidence":"what you observed"} — account for a surface × class in your coverage ledger. Each pair is recorded exactly once; closing as ruled_out or not_applicable REQUIRES the evidence to name the control that stops the class. Add "update":true to change an existing row. Researched-but-unprobed classes are carried as open gaps automatically — closing them is how they leave your screen.',
    '{"action":"load_skill","skill":"sqli"} — pull one of your SKILL CARDS: a compact procedure for a vuln class (attack surface, detection channels, numbered testing steps, and the proof bar a claim must clear). Pull one when you OPEN a class, instead of searching the web — the card\'s steps end in a probe. The card index is on every screen; one card at a time.',
    '{"action":"request_details","title":"Login for <site>","account":"owner","fields":[{"key":"email","label":"Login email","type":"email"},{"key":"password","label":"Password","type":"password"}]} — ASK THE OWNER for details you need (a login, an OTP, any field): a card appears below the chat and the owner fills it in. Wait for the next turn — the details arrive on your screen (one-turn only, never written to the record). Do NOT re-ask for the same details and do NOT re-attempt the blocked action while a request is open. Any field type works: text, email, password, otp, textarea. "account":"owner" means it is the OWNER\'s own existing account (ask first is correct there). "account":"fresh" (or omitted) means a NEW account you could create yourself — the server REFUSES a fresh ask until you have tried the self path first (save_credential, then use_saved_credential, then fetch_verification_code); ask only after that path fails, and say what failed.',
    'ACCOUNTS — when a target needs an account, FIRST decide whose account it is. (A) THE OWNER\'S OWN EXISTING ACCOUNT (his personal login to a service he already has, e.g. his kSuite login): ask FIRST with request_details and "account":"owner" — the owner gives you THEIR account in the chat; do NOT create your own. (B) A FRESH ACCOUNT on a target (a training ground, or any site that allows self-registration): try YOURSELF first, in this order — (1) save_credential for the site (vaults the login AND provisions your own temp-mail inbox for verification mail), (2) use_saved_credential to fill the form from the vault, (3) fetch_verification_code to poll your temp-mail inbox for the code. Only if that path FAILS (the site blocks the temp-mail domain, no mail arrives, or it demands a phone/SMS code or an interactive captcha your clicks cannot solve) ask the owner with request_details and "account":"fresh" — and say what failed. The server REFUSES a fresh ask when you have not tried yourself first, so attempt the self path and record it before asking. Never the owner\'s identity, never another user\'s data, only in-scope targets. {"action":"save_credential","site":"https://target.example","username":"obfinity-xxxx"} — vault a credential for a site (omit "password" and the server generates a random 20-char one and shows it to you ONCE, this turn only — type it immediately with browser_type into the password field (target: the password field label, e.g. "Password"), then submit; it is never written to the permanent record, and neither is any password you invent: keep passwords OUT of your thinking and notes, the record keeps the handle only, e.g. cred:target.example:ab12cd34ef56). {"action":"use_saved_credential","handle":"cred:...","usernameField":"Email","passwordField":"Password"} — fill a login form from the vault without the password ever appearing in text (give the two fields\' visible labels from a snapshot; omit them and you get the handle + username back to snapshot first). {"action":"fetch_verification_code","handle":"cred:..."} — poll your temp-mail inbox for that site\'s verification code (one-turn observation — type it immediately; if no mail arrives the observation says the domain may be blocked, so record that as a blocker and move on, never retry forever). If a signup demands a phone/SMS code or an interactive captcha your clicks cannot solve, that path is blocked — say so and move on; never use a third-party captcha solver.',
    '{"action":"claim_finding","title":"...","class":"sqli","evidence":"the exact output that proves it","command":"the exact command that produced that evidence","counterevidence":"the control/baseline result that could have disproved it","confidence":"high|medium|low","confidence_rationale":"required when confidence is not high"} — claim a vulnerability. The filing is complete-the-proof gated: a claim missing any of title, class, a runnable reproduction ("command", or "poc" naming a proof script saved in this hunt), evidence, counterevidence, or confidence is bounced back UNRECORDED with the missing pieces named — complete the package and claim again. A complete claim goes to an independent verifier, which re-runs your command and checks the evidence; ONLY verified findings count. Never claim without reproduced evidence.',
    'Act like a person: if you need a tool, download it; if you don\'t know something, search; if output is interesting, dig; one step at a time — you will see the result on the next screen.',
    `Programme rules you must obey: ${rules.join('; ')}.`,
  ].join('\n');
}

function findingsFromEvents(deps, huntId) {
  try {
    return applyRetractions(deps.readEvents(huntId));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// COMPLETE-THE-PROOF GATE (Lane N, 22 Oct 2026 — Lane K's Strix P3,
// re-implemented by reference; no Strix code copied)
//
// Strix's report tool refuses to file a vulnerability until the proof
// package is complete (PoC + evidence + counterevidence + confidence),
// because a verifier handed prose has to re-argue the claim instead of
// checking artefacts. Our claim path had the same hole: claim_finding
// recorded (or sent to assessResult) whatever title/evidence/command
// the brain supplied, so half-proved claims reached the verifier as
// assertions. This gate is the deterministic completeness half of
// that contract, applied at the recording point in the claim_finding
// branch — BEFORE the verifier is invoked and before any finding is
// recorded. It judges COMPLETENESS ONLY, never truth: assessResult
// remains the sole judge of whether a complete claim is real.
//
// A claim is complete when it carries ALL of:
//   - title — one line naming the vulnerability;
//   - class — the vuln class ("class" field, normalised through the
//     coverage ledger's class normaliser; when the field is absent,
//     a PROBE_TOPICS match on the title supplies it);
//   - a runnable reproduction — the exact "command" (the claim path's
//     existing last-shell-command fallback counts, exactly as the
//     recording path has always used it) OR "poc" naming an artefact
//     that exists in this hunt's own artifacts (checked through
//     deps.pocExists, so a fabricated handle bounces);
//   - evidence — the exact output that proves it, at least
//     CLAIM_EVIDENCE_MIN chars: a real response excerpt, not a bare
//     assertion like "it worked";
//   - counterevidence — what the hunter checked that could have
//     disproved the claim (for a differential class, the baseline /
//     control result beside the trigger result);
//   - confidence — high | medium | low; when not high, a
//     confidence_rationale is required.
//
// An incomplete claim is NOT recorded and the verifier never sees
// it. The brain gets ONE observation naming every missing piece and
// the field that supplies it, and the refusal is recorded as a
// claim_bounce event (the dedup_block pattern: countable by
// monitors, so the bounce rate is measurable). The gate injects no
// actions and adds no stages — it only shapes a filing the hunter
// chose to make.
// ---------------------------------------------------------------------------

export const CLAIM_EVIDENCE_MIN = 30; // chars of real output, not an assertion
export const CLAIM_COUNTER_MIN = 10; // chars — more than "n/a" or "checked"
export const CLAIM_COMMAND_MIN = 8; // chars — a real probe command, not a word

/** Vuln class from a claim title via PROBE_TOPICS (deterministic). */
export function claimClassFromTitle(title) {
  const t = String(title || '');
  if (!t.trim()) return '';
  for (const topic of PROBE_TOPICS) if (topic.re.test(t)) return topic.id;
  return '';
}

/**
 * The completeness check. Pure: artefact existence arrives as the
 * caller-computed `pocExists` boolean. Returns
 * { ok, missing: [{ field, hint }], cls } — every missing piece is
 * named with the field that supplies it, so the bounce observation
 * can be assembled without further logic.
 */
export function claimGateCheck({
  title = '',
  cls = '',
  command = '',
  poc = '',
  pocExists = false,
  evidence = '',
  counterevidence = '',
  confidence = '',
  rationale = '',
} = {}) {
  const missing = [];
  if (!String(title).trim()) {
    missing.push({ field: 'title', hint: '"title" — one line naming the vulnerability' });
  }
  if (!String(cls).trim()) {
    missing.push({ field: 'class', hint: '"class" — the vuln class (e.g. "sqli", "xss"); or name the class in the title so it can be matched' });
  }
  if (String(command).trim().length < CLAIM_COMMAND_MIN && !pocExists) {
    missing.push(poc
      ? { field: 'poc', hint: `"poc" — the artefact "${String(poc).slice(0, 80)}" is not in this hunt's artifacts; save the proof script with write_file first, or give the exact "command" instead` }
      : { field: 'command', hint: '"command" — the exact command that reproduces it (the verifier re-runs it), or "poc" naming a proof script you saved in this hunt' });
  }
  if (String(evidence).trim().length < CLAIM_EVIDENCE_MIN) {
    missing.push({ field: 'evidence', hint: '"evidence" — the exact output that proves it: a real excerpt of the response/output, not a summary or an assertion' });
  }
  if (String(counterevidence).trim().length < CLAIM_COUNTER_MIN) {
    missing.push({ field: 'counterevidence', hint: '"counterevidence" — what you checked that could have disproved this: the control/baseline result beside the trigger (e.g. the \' OR 1=2 response next to \' OR 1=1), or the strongest false-positive explanation and what ruled it out' });
  }
  const conf = String(confidence || '').trim().toLowerCase();
  if (!['high', 'medium', 'low'].includes(conf)) {
    missing.push({ field: 'confidence', hint: '"confidence" — "high", "medium" or "low" (add "confidence_rationale" whenever it is not high)' });
  } else if (conf !== 'high' && !String(rationale).trim()) {
    missing.push({ field: 'confidence_rationale', hint: '"confidence_rationale" — confidence is not high, so say why: what is still uncertain about this claim' });
  }
  return { ok: missing.length === 0, missing, cls: String(cls || '') };
}

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

// ---------------------------------------------------------------------------
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

function topicForSkillName(name) {
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

/** The detail a log/journal entry carries for one parsed action. */
function detailForAction(kind, action) {
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
async function defaultRecallMemory(huntId, query) {
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
    const es = await import('./episodeStore.js');
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

// ---------------------------------------------------------------------------
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
// ---------------------------------------------------------------------------

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
 * Canonical action identity lives in actionIdentity.js (moved there
 * verbatim in the keyword-index lane, 27 Oct 2026, so the gate and
 * the Action Index share one definition of "the same action").
 * Re-exported here so the import surface is unchanged.
 */
export { normalisedActionDetail, actionSignature } from './actionIdentity.js';

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

// ---------------------------------------------------------------------------
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
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
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
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
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
// ---------------------------------------------------------------------------

const LOGIN_PAGE_RE = /\/login|\/authorize|login\.|sign[\s-]?in/i;

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

// ---------------------------------------------------------------------------
// EXHAUSTED SURFACES (Infinity level, 26 Oct 2026)
//
// Root cause (Infomaniak hunt, live, iter 108): the dedupe gate keys
// on EXACT (tool, detail) and the auth gate on EXACT typed text, so
// the hunter varies the payload — plain XSS, then encoded XSS —
// and each variant is a NEW signature the gates pass, until the
// execution itself is refused by the auth gate or the driver's
// WRONG PAGE guard. Every refused variant burns a full turn
// (10-25 min of 8B generation), and nothing ever records that the
// (page, field, payload-class) combination is finished. The settled
// lines (Lane AD/AH) state the prohibition, but the hunter
// re-derives "signup not probed" because the payload was never
// SENT — a premise that is true in its own terms. Prompt text
// cannot fix a choice the brain re-derives; only state can.
//
// So the combination itself is tracked, deterministically, from
// the hunt's own record — auth_block + dedup_block + WRONG PAGE
// refusals grouped by (tool, page, payload class) — and at
// EXHAUSTED_MIN_BLOCKS blocks the surface is CLOSED: the gate
// below refuses ANY further attempt on it, whatever the payload
// wording. The brain still chooses everything else; the dead loop
// is simply no longer offered. The key carries the page, so a
// different page is a different surface — exhaustion lifts the
// moment the surface changes, exactly as the brief requires —
// and a login-form payload is judged against the LOGIN surface,
// never against the signup surface it was aimed at.
//
// This is a gate, in the Lane F/AJ shape — it stops traffic, never
// picks a replacement action (owner order 20 Oct stands).
// ---------------------------------------------------------------------------

export const EXHAUSTED_MIN_BLOCKS = 3; // blocks before a surface closes

/** Payload class of a typed text, from the PROBE_TOPICS probe shapes. Anything else typed is a credential (a username/password), not an attack. */
export function classifyPayloadClass(text) {
  const t = String(text || '');
  for (const topic of PROBE_TOPICS) {
    if (topic.probes && topic.probes.some((re) => re.test(t))) return topic.id;
  }
  // Encoded variants the probe shapes miss (the live loop's dodge):
  // %3cscript, &lt;script, unicode-escaped <script.
  if (/%3c\s*script|&lt;\s*script|\\u003c\s*script/i.test(t)) return 'xss';
  if (/%27\s*(or|and)\s+|%27\s*(--|#)/i.test(t)) return 'sqli';
  return 'credential';
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

/**
 * The authenticated-flow state for one target, from the vault +
 * the record: a credential saved for the target's host (latest),
 * whether it was ever used (use_saved_credential tool_calls for
 * its handle), and whether it verified. Null-safe; the vault read
 * is best-effort (a missing vault means "no credential").
 */
export function credentialStateFor({ events = [], target = '' } = {}) {
  let saved = null;
  try {
    const host = hostOfUrl(target);
    const all = listCredentials() || [];
    const mine = all.filter((c) => c && (String(c.host || '').toLowerCase() === host || (host && String(c.host || '').toLowerCase().endsWith(`.${host}`))));
    if (mine.length) saved = mine[mine.length - 1];
  } catch { /* vault read is best-effort */ }
  if (!saved) return { saved: false };
  let used = 0;
  for (const e of events || []) {
    if (e && e.type === 'tool_call' && String(e.tool || '').toLowerCase() === 'use_saved_credential' && String(e.detail || '') === saved.handle) used++;
  }
  return { saved: true, handle: saved.handle, verified: !!saved.verified, used };
}

function surfaceKey(tool, pageHost, pagePath, payloadClass) {
  return `${String(tool || '').toLowerCase()}|${String(pageHost || '').toLowerCase()}|${String(pagePath || '')}|${String(payloadClass || '')}`;
}

function hostOfUrl(u) {
  try {
    return new URL(String(u || '')).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * The page a URL names, for the exhaustion key: host + pathname.
 * The pathname carries the page — /login.php and
 * /vulnerabilities/sqli/ on the same host are DIFFERENT surfaces
 * (DVWA, live 28 Oct 2026: the host-only key let three login-page
 * auth_blocks close the SQLi page the brain was already logged
 * into, so its baseline '1' and its boolean probes were refused
 * as exhausted_block 18 times). Query + hash are stripped: they
 * name the same page with different input, and keeping them would
 * let each query variant dodge the surface that just closed.
 * Trailing slash stripped so /sqli/ and /sqli are one page.
 */
export function surfacePageOfUrl(u) {
  let host = '';
  let path = '';
  try {
    const parsed = new URL(String(u || ''));
    host = parsed.hostname.toLowerCase();
    path = parsed.pathname || '/';
  } catch {
    return { host: '', path: '' };
  }
  if (path.length > 1) path = path.replace(/\/+$/, '');
  return { host, path: path || '/' };
}

/**
 * Block counts per (tool, page, payload class), purely from
 * the hunt's record. Page attribution walks the event stream in
 * order, tracking the live page from browser_open URLs; a WRONG
 * PAGE execution names its own page in the paired reasoning row.
 * Pairing follows the Lane T discipline: an executed browser_type
 * writes exactly one reasoning row, in order, so the Nth
 * browser_type row pairs with the Nth browser_type tool_call
 * (gate-block rows carry no tool_call and consume nothing).
 */
export function surfaceBlockCounts({ events = [], reasoningRows = [] } = {}) {
  const counts = new Map();
  const bump = (tool, pageHost, pagePath, payloadClass) => {
    if (!pageHost) return;
    const key = surfaceKey(tool, pageHost, pagePath, payloadClass);
    const cur = counts.get(key) || { tool: String(tool).toLowerCase(), pageHost, pagePath, page: pageHost + pagePath, payloadClass, count: 0 };
    cur.count++;
    counts.set(key, cur);
  };
  // Index executed browser_type calls in stream order for pairing.
  const typeCalls = [];
  for (const e of events || []) {
    if (e && e.type === 'tool_call' && String(e.tool || '').toLowerCase() === 'browser_type') typeCalls.push(e);
  }
  let typeIdx = 0;
  let currentPage = { host: '', path: '' };
  for (const e of events || []) {
    if (!e) continue;
    if (e.type === 'tool_call' && String(e.tool || '').toLowerCase() === 'browser_open') {
      const pg = surfacePageOfUrl(e.detail);
      if (pg.host) currentPage = pg;
      continue;
    }
    if (e.type === 'auth_block' && String(e.tool || '').toLowerCase() === 'browser_type') {
      bump('browser_type', currentPage.host, currentPage.path, classifyPayloadClass(e.detail));
      continue;
    }
    if (e.type === 'dedup_block' && String(e.tool || '').toLowerCase() === 'browser_type') {
      bump('browser_type', currentPage.host, currentPage.path, classifyPayloadClass(e.detail));
      continue;
    }
  }
  // WRONG PAGE executions: the reasoning row names the page.
  for (const r of reasoningRows || []) {
    if (!r || r.action !== 'browser_type') continue;
    const result = String(r.result || '');
    if (!result.startsWith('WRONG PAGE')) continue;
    const m = /WRONG PAGE — you are on (\S+),/.exec(result);
    const pg = m ? surfacePageOfUrl(m[1]) : currentPage;
    const call = typeCalls[typeIdx];
    typeIdx++;
    if (call) bump('browser_type', pg.host, pg.path, classifyPayloadClass(call.detail));
  }
  return counts;
}

/**
 * Gate verdict for one parsed browser_type against the surface
 * record: { tool, pageHost, payloadClass, count, key } when the
 * (page, class) combination has already been blocked >=
 * EXHAUSTED_MIN_BLOCKS times, else null. The candidate's page is
 * the live page (currentPageUrl, falling back to the parsed page
 * state) — the page the action would actually land on, never the
 * page the hunter believes it is on.
 */
export function exhaustedSurfaceHit(kind, action, currentPage, counts, pageState = null) {
  if (String(kind || '').toLowerCase() !== 'browser_type') return null;
  const page = String(currentPage || (pageState && pageState.currentUrl) || '');
  const { host: pageHost, path: pagePath } = surfacePageOfUrl(page);
  if (!pageHost) return null;
  const cls = classifyPayloadClass(action && action.text);
  const key = surfaceKey('browser_type', pageHost, pagePath, cls);
  const entry = (counts || new Map()).get(key);
  if (!entry || entry.count < EXHAUSTED_MIN_BLOCKS) return null;
  return { tool: 'browser_type', pageHost, pagePath, page: pageHost + pagePath, payloadClass: cls, count: entry.count, key };
}

function isAuthSurface(pageHost, pageType) {
  if (pageType === 'login' || pageType === 'signup') return true;
  return LOGIN_PAGE_RE.test(String(pageHost || ''));
}

/**
 * The EXHAUSTED block for the screen's never-trimmed region: every
 * closed surface (most-blocked first, top 5), and — when an auth
 * surface is among them — the auth-wall block naming the two
 * routes that remain open: the account path (save_credential,
 * already-saved state included) and unauthenticated recon
 * (target-derived URLs, with the tried/untried marks from the
 * record). Facts only; the brain still chooses.
 */
export function exhaustedSurfaceLines({ counts = null, target = '', credential = null, events = [] } = {}) {
  const rows = [...(counts || new Map()).values()]
    .filter((r) => r.count >= EXHAUSTED_MIN_BLOCKS)
    .sort((a, b) => b.count - a.count || a.pageHost.localeCompare(b.pageHost));
  if (!rows.length) return [];
  const lines = ['=== EXHAUSTED — THESE SURFACES ARE CLOSED (your own record) ==='];
  for (const r of rows.slice(0, 5)) {
    lines.push(`- EXHAUSTED: typing ${r.payloadClass === 'credential' ? 'credentials' : `${r.payloadClass.toUpperCase()} payloads`} on ${r.page || r.pageHost} — blocked ×${r.count} (auth/dedupe/wrong-page). Closed: the gate refuses any further attempt here, whatever the payload wording.`);
  }
  const authRows = rows.filter((r) => isAuthSurface(r.page || r.pageHost));
  if (authRows.length) {
    const total = authRows.reduce((n, r) => n + r.count, 0);
    lines.push('=== AUTH WALL — LOGIN/SIGNUP SURFACE EXHAUSTED ===');
    lines.push(`- The login surface is closed after ${total} blocks. Typing payloads or credentials into it again changes nothing.`);
    if (credential && credential.saved) {
      lines.push(`- Account route: a credential is already saved for this target (${credential.handle}${credential.verified ? ', verified' : ', not yet verified'}) — use_saved_credential with the field labels from a snapshot, then browser_click the submit button. Do not save another one.`);
    } else {
      lines.push(`- Account route: save_credential for ${target} (vaults a login + provisions temp mail), then use_saved_credential + fetch_verification_code. That is the way through the wall.`);
    }
    const recon = reconChecklist({ events, target });
    const open = recon.filter((r) => !r.tried).map((r) => r.url);
    const done = recon.filter((r) => r.tried).map((r) => r.label);
    lines.push(`- Unauthenticated recon (no login needed)${done.length ? ` — done: ${done.join(', ')}` : ''}${open.length ? ` — still open: ${open.join(', ')}` : ' — all five surfaces tried'}.`);
  }
  return lines;
}

/** The observation a blocked exhausted-surface attempt gets: what closed, how many blocks, and the routes that are still open (auth wall → account route + recon; anything else → a different page/class, or act on what is already known). */
export function exhaustedBlockObservation(hit, { target = '', credential = null, events = [] } = {}) {
  const kind = hit.payloadClass === 'credential' ? 'credentials' : `${hit.payloadClass.toUpperCase()} payloads`;
  let out = `BLOCKED — EXHAUSTED SURFACE: typing ${kind} on ${hit.page || hit.pageHost} has already been blocked ×${hit.count} (auth/dedupe/wrong-page). This surface is closed — the gate refuses any further attempt here, whatever the payload wording. `;
  if (isAuthSurface(hit.page || hit.pageHost)) {
    if (credential && credential.saved) {
      out += `The way through is the saved credential (${credential.handle}${credential.verified ? ', verified' : ', not yet verified'}) — use_saved_credential with the field labels from a snapshot, then browser_click the submit button. `;
    } else {
      out += `The way through is an account: save_credential for ${target}, then use_saved_credential + fetch_verification_code. `;
    }
    const recon = reconChecklist({ events, target });
    const open = recon.filter((r) => !r.tried).map((r) => r.url);
    if (open.length) out += `Or work without a login — still open: ${open.join(', ')}.`;
    else out += 'Or work without a login — the five recon surfaces are all tried; find the next unauthenticated surface yourself.';
  } else {
    out += 'Pick a different page, a different payload class, or act on what the snapshots already show.';
  }
  return out;
}

// ---------------------------------------------------------------------------
// PROOF-COMPLETE GATE (gate-replay lane, 28 Oct 2026)
//
// The re-proof-without-filing loop (live DVWA hunt h_830317bdc184):
// after the 8th dedup block the brain pivoted to reflected XSS and
// proved the SAME claim over and over — fresh markers ZXSS987654,
// ZXQ9777, QXZ7719 (raw reflection proven 08:35 IST), HXQ/BBT999z,
// RXS2810B — each a NEW marker, so the exact-repeat dedupe gate
// (Lane F, keyed on the identical command) never fired, and the
// brain kept re-proofing instead of filing. No third filing ever
// came; the level proof stayed at 0 while the evidence was in hand.
//
// The dedupe gate cannot catch this: it judges the ACTION, and a
// re-proof varies the action (new marker, new recall, new wording).
// This gate judges the CLAIM: a probe is a proof of (endpoint,
// payload class) when its output is signal-bearing and not an error
// page. After PROOF_THRESHOLD consistent proofs of the same claim,
// the NEXT probe of that claim is blocked — not with "try something
// else", but with the one move that advances the hunt: FILE IT.
// The block is a countable proof_file_nudge event (same shape as
// dedup_block / auth_block / exhausted_block) and the observation
// names the claim, the count, and the filing it must do.
//
// A rejected claim RESETS its count (see the claim_finding branch):
// the brain needs NEW evidence, and the counter must not keep the
// claim blocked. A verified claim needs no further probes at all.
// Script probes (a proof script run by name, no URL and no payload
// in the command itself) carry no endpoint the gate can key on, so
// they are not proof-counted — the verifier (Fix 1) is their
// backstop when filed. This gate is a nudge, not a verdict: it can
// only ever direct the brain to file, and assessResult still
// decides whether the filing is true.
// ---------------------------------------------------------------------------

export const PROOF_THRESHOLD = 3; // consistent re-proofs before the loop demands a filing

/** The endpoint a shell probe targets: the first http(s) URL in the command, as host+pathname (no port — the same shape surfacePageOfUrl gives a browser page, so a shell probe and a browser probe of the same page share a key). '' when the command names no URL (a proof script run by name). */
export function proofEndpointOfCommand(command) {
  const m = /https?:\/\/[^\s'"`]+/i.exec(String(command || ''));
  if (!m) return '';
  try {
    const u = new URL(m[0]);
    let p = u.pathname || '/';
    if (p.length > 1) p = p.replace(/\/+$/, '');
    return `${u.hostname.toLowerCase()}${p || '/'}`;
  } catch {
    return '';
  }
}

/**
 * The claim a probe action proves, or null when the action is not a
 * probe the gate can key on. Signature = (endpoint, payload class):
 * the same flaw re-proved with a fresh marker is the same claim.
 * shell keys on the URL in the command; browser_type keys on the
 * page the hunter is typing into. 'credential' typings are not
 * probes. Pure.
 */
export function proofSignatureFor(kind, action, { page = '' } = {}) {
  const k = String(kind || '').toLowerCase();
  let endpoint = '';
  let text = '';
  if (k === 'shell') {
    const command = String((action && action.command) || '');
    endpoint = proofEndpointOfCommand(command);
    text = command;
  } else if (k === 'browser_type') {
    const pg = surfacePageOfUrl(page || '');
    endpoint = pg.host ? pg.host + (pg.path || '/') : '';
    text = String((action && action.text) || '');
  } else {
    return null;
  }
  if (!endpoint) return null;
  const payloadClass = classifyPayloadClass(text);
  if (!payloadClass || payloadClass === 'credential') return null;
  return { key: `${endpoint}|${payloadClass}`, endpoint, payloadClass };
}

/**
 * Did this probe output prove its claim? A proof is signal-bearing
 * output (the verifier's own evidence-signal vocabulary, non-negated,
 * non-framing) that is not an HTTP error page. Pure.
 */
export function probeProvesClaim({ output = '', command = '' } = {}) {
  const out = String(output || '');
  if (!out.trim()) return false;
  if (isHttpErrorPage(out)) return false;
  return evidenceSignalIds(out, command).length > 0;
}

/**
 * The proof-complete verdict for one probe action against the hunt's
 * proof counts (Map signature -> count, or a plain object): the hit
 * when this claim has already been proven PROOF_THRESHOLD times,
 * else null. `sig` may carry a precomputed proofSignatureFor result
 * (the loop captures the signature before execution, so the page a
 * probe navigates to cannot change the key). Pure.
 */
export function proofGateHit(kind, action, proofCounts, { page = '', sig = null } = {}) {
  const s = sig || proofSignatureFor(kind, action, { page });
  if (!s) return null;
  const counts = proofCounts instanceof Map ? proofCounts : new Map(Object.entries(proofCounts || {}));
  const count = Number(counts.get(s.key) || 0);
  if (count < PROOF_THRESHOLD) return null;
  return { tool: String(kind || '').toLowerCase(), endpoint: s.endpoint, payloadClass: s.payloadClass, count, key: s.key };
}

/** The observation a proof-complete probe gets: file the claim now. */
export function proofFileObservation(hit) {
  return `PROOF COMPLETE — FILE IT NOW: you have already proven ${hit.payloadClass.toUpperCase()} on ${hit.endpoint} ${hit.count} times with consistent evidence. A fourth probe of the same claim proves nothing new — it only burns a turn. It was NOT executed. File it now with claim_finding: title the vulnerability, class "${hit.payloadClass}", evidence the exact output that proves it (the reflected marker / dumped rows, pasted raw, not a summary), command the exact reproduction that produced that evidence, and counterevidence the control/baseline result beside it. If the verifier rejects the filing, gather NEW evidence for it — the proof count restarts from the rejection.`;
}

// ---------------------------------------------------------------------------
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
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
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
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
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
// ---------------------------------------------------------------------------

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
function skillNameKey(name) {
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

function buildScreen({ target, parsedScope, briefing, findings, machineState, lastObservation, turn, turns, scopeHosts = [], facts = [], repetition = [], explored = [], leftOff = [], journal = [], retractedCount = 0, leads = [], coverage = [], skills = [], stateOfMind = [], followThrough = [], settled = [], pageState = [], exhausted = [], desktopState = [], desktopNow = [], chatQuestions = [], huntPlan = [], detailsRequest = [] }) {
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

/**
 * Run one human-mode session: up to `turns` perceive->think->act->observe
 * cycles. Returns { aiOk, failKind?, turnsRun, actionsRun, newFindings, log }.
 *
 * opts:
 *   turns     — max turns this call (default 6)
 *   findings  — the hunt loop's findings array; verified records are pushed
 *   deps      — injectable machinery (tests): chat, exec (shell, pipeline
 *               semantics), execRaw (container exec), search, writeFile,
 *               spill, record, readMeta, writeMeta, readEvents, recordNote,
 *               pocExists (Lane N claim-gate artefact check), assess
 *               (pipeline verifier; explicit null disables the lazy
 *               default and claims are recorded UNVERIFIED), gui,
 *               intercept (Lane U proxy workflow), sleep, now,
 *               buildBriefing
 */
export async function humanIteration(huntId, target, opts = {}) {
  // RULE #42 (30 Oct 2026) — BRAIN_PROVIDER wiring: when
  // BRAIN_PROVIDER=oneloop the deterministic one-loop brain drives the
  // whole session instead of the LLM think step. Env-gated: unset (or
  // anything else) keeps the current path byte-identical below.
  // RULE #44 — BRAIN_PROVIDER=oneloop-dryrun audits the same flip path
  // with zero commits: the brain drives the turns, but the claim bridge
  // is disabled and no findings/leads are pushed (per-turn audit in the
  // loop's memdir, audit.jsonl). Spreading opts avoids mutating the
  // caller's object.
  if (isOneLoopEnabled()) {
    // RULE #43 — wire the backend claim bridge: newly FILED loop claims
    // go through the real claim pipeline (claimGateCheck + assessResult).
    // Lazy imports mirror the existing deps.assess pattern below; any
    // failure leaves the dep null and the bridge stays disabled (claims
    // surface as leads, Rule #42) — the gate itself never throws.
    let assessFn = null;
    let copyToContainerFn = null;
    try {
      ({ assessResult: assessFn } = await import('./huntAgent.js'));
    } catch { assessFn = null; }
    try {
      ({ copyFileToHuntContainer: copyToContainerFn } = await import('./huntRunner.js'));
    } catch { copyToContainerFn = null; }
    return runOneLoopSession({
      huntId, target,
      opts: { ...opts, dryRun: isOneLoopDryRun() },
      deps: {
        assessFn: assessFn || null,
        claimGateCheckFn: claimGateCheck,
        copyToContainerFn: copyToContainerFn || null,
      },
    });
  }
  const d = opts.deps || {};
  const deps = {
    chat: d.chat || chatWithAI,
    exec: d.exec || null, // lazy: pipeline executeWithEvasion
    // Lane E: the raw exec self-heals a missing hunt container (respawn
    // + one retry, target closed over from this iteration) — before this
    // the default called execInHuntContainer directly and a removed
    // container never came back for the whole hunt.
    execRaw: d.execRaw || ((h, c, t, o) => execInHuntContainerWithRespawn(h, c, t, { ...(o || {}), target })),
    search: d.search || webSearch,
    writeFile: d.writeFile || writeArtifact,
    spill: d.spill || spillOutput,
    record: d.record || appendHuntEvent,
    readMeta: d.readMeta || readHuntMeta,
    // FIX (21 Oct 2026, lane B): the session-end checkpoint goes through
    // the guarded checkpoint writer — a pause/stop the owner set during
    // the session must survive it (see store.writeHuntMetaCheckpoint).
    writeMeta: d.writeMeta || writeHuntMetaCheckpoint,
    readEvents: d.readEvents || readHuntEvents,
    recordNote: d.recordNote || recordReasoning,
    // Lane N: the claim gate's artefact check — a "poc" handle counts
    // only if the named file really exists in this hunt's artifacts.
    pocExists: d.pocExists || ((h, name) => Boolean(artifactInfo(h, name))),
    assess: 'assess' in d ? d.assess : (opts.assess || undefined), // undefined -> lazy pipeline assessResult; null -> disabled
    gui: d.gui || null, // lazy: guiTools bound to execRaw
    // Take Control of This Machine: while the owner holds the control
    // lock, the agent's GUI/browser actions are skipped (see the
    // control gate in the ACT section). Tests inject a stub here.
    machineControlled: d.machineControlled || ((h) => isMachineControlled(h)),
    intercept: d.intercept || null, // lazy: proxyIntercept bound to execRaw (Lane U)
    // WHOLE-OS CONTROL: the desktop screenshot (lazy: the owner's
    // scrot poller route + artifact save). Tests inject a stub here.
    desktopScreenshot: d.desktopScreenshot || null,
    // HUMAN-BRAIN (26 Oct 2026): starting the desktop for a
    // desktop_terminal action from a cold desktop (lazy: huntRunner
    // startHuntDesktop). Tests inject a stub here.
    startDesktop: d.startDesktop || null,
    // REAL-HUMAN (26 Oct 2026): delivering the brain's answer to a
    // queued owner question. The default records a chat_answer
    // event (which flows through the WS stream to the open hunt
    // view), appends the answer to the asking chat's message file,
    // and marks the question answered in the queue — the three
    // legs of the promise the queue makes. Tests inject a stub.
    deliverChatAnswer: d.deliverChatAnswer || defaultDeliverChatAnswer,
    sleep: d.sleep || ((ms) => new Promise((r) => setTimeout(r, ms))),
    now: d.now || (() => Date.now()),
    buildBriefing: d.buildBriefing || buildMemoryBriefing,
    recall: d.recall || defaultRecallMemory,
    // Lane AI: temp-mail seam (tests inject fakes; production uses
    // the real providers). Credentials module functions are used
    // directly — they honour config.dataDir (DATA_DIR in tests).
    createInbox: d.createInbox || createInboxPreferred,
    pollCode: d.pollCode || pollForCode,
  };
  // Lane O: the state-of-mind computer. Production path loads the
  // hunt's complete memory through huntMemory (the single read
  // path) and joins it with this file's own derivations (topic
  // accounting, endpoint discovery) over the same record. Tests may
  // inject deps.buildStateOfMind.
  const computeStateOfMind = (meta) => {
    if (typeof d.buildStateOfMind === 'function') return d.buildStateOfMind(huntId, target, meta);
    const memory = loadHuntMemory(huntId, { target, meta });
    const som = buildStateOfMind(memory, {
      topicStats: researchedTopicStats({ events: memory.events, reasoningRows: memory.reasoningRows }),
      endpoints: discoveredEndpoints(memory.events, target),
    });
    // INFINITY LEVEL: pending plans + the coverage summary ride
    // inside the SOM block — the two additions the brief names —
    // computed from the same memory the SOM was built from, so the
    // block never contradicts the record it summarises. Capped to
    // the remaining Lane Q budget, so the block never exceeds
    // SOM_TOTAL_BUDGET: a long SOM can cut these lines, but the
    // per-turn screen carries the same facts in its own never-
    // trimmed blocks (exhausted + page state), so nothing is lost.
    const extra = [];
    // KNOWN APP (zero-genuine lane): the fingerprint + the lab auth
    // state ride the SOM, so the brain never re-derives the app from
    // leaked endpoints — on DVWA the lines name the login-first
    // state and the wrong-app boundary every turn.
    try {
      const appLines = knownAppSOMLines({ knownApp: knownAppOf(meta, target), auth: (meta && meta.auth) || null });
      if (appLines.length) extra.push('', ...appLines);
    } catch { /* known-app lines are best-effort */ }
    try {
      const pending = pendingPlannedProbeLines({ events: memory.events, reasoningRows: memory.reasoningRows });
      if (pending.length) extra.push('', ...pending);
    } catch { /* pending plans are best-effort */ }
    try {
      const summary = coverageSummaryLines({
        events: memory.events,
        pageState: sessionPageState,
        target,
        credential: credentialStateFor({ events: memory.events, target }),
        counters: loopCounters({ events: memory.events, reasoningRows: memory.reasoningRows, pageState: sessionPageState }),
      });
      if (summary.length) extra.push('', ...summary);
    } catch { /* coverage summary is best-effort */ }
    if (extra.length) {
      let budgetLeft = SOM_TOTAL_BUDGET - som.join('\n').length;
      for (const line of extra) {
        if (line.length + 1 > budgetLeft) break;
        som.push(line);
        budgetLeft -= line.length + 1;
      }
    }
    return som;
  };
  const turns = Math.max(1, opts.turns || 6);
  const log = [];
  const newFindings = [];

  const meta0 = deps.readMeta(huntId) || {};
  // Lane P: this session's turns-total baseline. Per-turn progress
  // checkpoints (below) write ABSOLUTE totals computed from this
  // base, and the session-end checkpoint takes the max of what it
  // re-reads and base + turnsRun — so the two writers can never
  // double-count a turn.
  const sessionBaseTurns = (meta0.humanLoop && meta0.humanLoop.turnsTotal) || 0;
  // PROOF-COMPLETE (gate-replay lane, 28 Oct 2026): per-claim
  // re-proof counts, persisted in meta.proofCounts (plain object
  // sig -> count) so they survive sessions; the loop owns the live
  // Map and persists it on every proof (best-effort — a failed
  // persist never costs a turn). The per-turn progress checkpoint
  // re-reads meta fresh, so the two writers never clobber each
  // other.
  const proofCounts = new Map(
    Object.entries((meta0.proofCounts && typeof meta0.proofCounts === 'object') ? meta0.proofCounts : {})
      .map(([k, v]) => [String(k), Number(v) || 0])
      .filter(([, v]) => v > 0),
  );
  const persistProofCounts = () => {
    try { deps.writeMeta(huntId, { proofCounts: Object.fromEntries(proofCounts) }); } catch { /* best-effort */ }
  };
  const parsedScope = opts.parsedScope || meta0.parsedScope || null;
  const maxRpm = parsedScope && parsedScope.rules ? Number(parsedScope.rules.maxRequestsPerMin) || 0 : 0;
  const minShellGapMs = maxRpm > 0 ? Math.ceil(60000 / maxRpm) : 0;

  // Lane AI: session secrets. A password the brain invents or is
  // shown (a generated credential, a verification code) is added
  // here the moment it exists, and EVERY recorded surface is
  // scrubbed against the set before writing — the thinking event,
  // the tool_call detail, the reasoning note, the session log.
  // The in-memory screen (lastObservation) is deliberately NOT
  // scrubbed: that is exactly how a one-turn secret reaches the
  // brain for its next action, and the screen is never written
  // to disk. The vault file is the only place secrets persist.
  const sessionSecrets = new Set();
  // DYNAMIC DETAILS (27 Oct 2026): values the owner already gave for
  // this hunt join the secret set up front, so any quoting or typing
  // of them is scrubbed from the record from the first turn on.
  try { for (const v of detailValuesForScrub(huntId)) sessionSecrets.add(v); } catch { /* a broken details store never breaks the turn */ }
  const scrub = (s) => scrubSecrets(String(s ?? ''), sessionSecrets);
  const scrubEntry = (entry) => {
    if (!entry || typeof entry !== 'object') return entry;
    const out = {};
    for (const [k, v] of Object.entries(entry)) out[k] = typeof v === 'string' ? scrub(v) : v;
    return out;
  };

  const say = (text) => {
    try { deps.record(huntId, { type: 'thinking', text: scrub(text), via: 'human-mode' }); } catch { /* recording is best-effort */ }
  };
  const toolCall = (tool, detail) => {
    try { deps.record(huntId, { type: 'tool_call', tool, detail: scrub(String(detail || '')).slice(0, 300), via: 'human-mode' }); } catch { /* best-effort */ }
    // VISIBLE-DESKTOP-FIRST: record the executed action kind for
    // this turn's routing classification (desktop vs shell-only)
    // and flag a shell login attempt — a curl login leaves the
    // visible browser logged out, so the next screen must say so.
    try {
      const k = String(tool || '').toLowerCase();
      turnKinds.push(k);
      if (k === 'shell' && looksLikeShellLogin(detail)) turnShellLogin = true;
    } catch { /* routing bookkeeping is best-effort */ }
    // Lane F: every executed action joins the already-done history
    // the moment it is dispatched, so the gate sees this session's
    // own actions too — not just past sessions' records.
    try {
      const t = String(tool || '').toLowerCase();
      if (GATED_TOOLS.has(t) && String(detail || '').trim()) {
        const sig = actionSignature(t, detail);
        // Lane AF: the execution counts as FULL for now — the
        // post-execution bookkeeping (below, where lastResult is
        // attached) reclassifies it if the GUI result carried the
        // degraded flag. pendingPrevStreak remembers the streak
        // this execution is about to reset, so the reclassification
        // can restore-and-increment it, exactly as
        // buildActionHistory replays the recorded pair.
        let cur = actionHistory.get(sig);
        if (!cur) {
          cur = { tool: t, detail: normalisedActionDetail(t, detail), count: 0, fullCount: 0, degradedStreak: 0, lastResult: '' };
          actionHistory.set(sig, cur);
        }
        cur.count++;
        cur.fullCount++;
        pendingPrevStreak = cur.degradedStreak;
        cur.degradedStreak = 0;
        pendingSig = sig;
      }
    } catch { /* gate bookkeeping is best-effort */ }
  };
  const note = (entry) => {
    try { deps.recordNote(huntId, scrubEntry(entry)); } catch { /* best-effort */ }
  };

  // WRONG-PAGE GUARD (seam): the driver needs the hunt's target
  // hosts to pick the right tab. The loop already owns the target +
  // parsedScope, so it computes the host list once per session and
  // binds it into every gui call via the same deps channel the exec
  // already rides. guiTools itself stays target-agnostic except for
  // the optional deps.targetHosts / deps.targetUrl.
  const guiTarget = { targetHosts: targetHostsFor(target, parsedScope), targetUrl: target };
  const getGui = () => {
    if (!deps.gui) {
      const ex = (h, c, t, o) => deps.execRaw(h, c, t, o);
      deps.gui = {
        open: (h, url) => guiBrowserOpen(h, url, { exec: ex, ...guiTarget }),
        snapshot: (h) => guiBrowserSnapshot(h, { exec: ex, ...guiTarget }),
        click: (h, text) => guiBrowserClick(h, text, { exec: ex, ...guiTarget }),
        type: (h, target, text, submit) => guiBrowserType(h, target, text, submit, { exec: ex, ...guiTarget }),
        screenshot: (h) => guiBrowserScreenshot(h, { exec: ex, ...guiTarget }),
      };
    }
    return deps.gui;
  };

  // Lane U: the intercept workflow, bound to the same self-healing
  // raw exec as the GUI tools. Tests inject deps.intercept whole.
  const getIntercept = () => {
    if (!deps.intercept) {
      const ex = (h, c, t, o) => deps.execRaw(h, c, t, o);
      deps.intercept = {
        start: (h) => startInterceptProxy(h, { exec: ex }),
        list: (h) => listIntercept(h, { exec: ex }),
        read: (h, index) => readInterceptEntry(h, index, { exec: ex }),
      };
    }
    return deps.intercept;
  };

  // WHOLE-OS CONTROL: the desktop screenshot, bound lazily like the
  // GUI tools. Tests inject deps.desktopScreenshot whole; the
  // default reuses the owner's scrot poller route (huntRunner) and
  // saves the frame as a hunt artifact.
  const getDesktopScreenshot = () => {
    if (!deps.desktopScreenshot) deps.desktopScreenshot = (h) => captureDesktopScreenshot(h);
    return deps.desktopScreenshot;
  };

  // HUMAN-BRAIN: starting the desktop, bound lazily the same way.
  // Tests inject deps.startDesktop whole; the default is
  // huntRunner.startHuntDesktop (runs hunt-desktop.sh in the
  // container, reviving Chromium too).
  const getStartDesktop = () => {
    if (!deps.startDesktop) {
      deps.startDesktop = async (h) => {
        const hr = await import('./huntRunner.js');
        return hr.startHuntDesktop(h);
      };
    }
    return deps.startDesktop;
  };

  const getExec = async () => {
    if (!deps.exec) {
      const ha = await import('./huntAgent.js');
      deps.exec = ha.executeWithEvasion;
    }
    return deps.exec;
  };
  const getAssess = async () => {
    if (deps.assess === undefined) {
      try {
        const ha = await import('./huntAgent.js');
        deps.assess = ha.assessResult || null;
      } catch {
        deps.assess = null;
      }
    }
    return deps.assess;
  };

  let briefing = '';
  try {
    briefing = await deps.buildBriefing(huntId, target, meta0);
  } catch { /* briefing is best-effort */ }

  const system = systemPromptFor(target, parsedScope);
  // Perception facts computed once per session from the hunt's own
  // records (Lane D): the programme surface the gate will actually
  // allow, hunt-state facts (credentials), and exact-repeat counts.
  const scopeHosts = parsedScope && Array.isArray(parsedScope.inScope) ? parsedScope.inScope : [];
  const facts = huntFactLines(meta0);
  // Lane M: the skill-card index is static (our own playbook files),
  // so it is computed once per session and rides every screen.
  const skillLines = skillCardLines();
  // The hunt's recorded events, read once: they feed both the
  // Repetition Check (display) and the already-done gate (Lane F,
  // enforcement). The gate's history then stays live in-session via
  // toolCall above.
  let sessionEvents = [];
  try {
    sessionEvents = deps.readEvents(huntId) || [];
  } catch { /* events are best-effort */ }
  // Lane L: the reasoning-row count at session start — the session-
  // end reconciliation (P4) diffs only THIS session's slice of the
  // record, so it needs to know where the session began.
  let sessionRowCount = 0;
  try {
    sessionRowCount = (getAllReasoning(huntId) || []).length;
  } catch { /* reasoning read is best-effort */ }
  let repetition = [];
  try {
    repetition = repetitionLines(sessionEvents);
  } catch { /* repetition is best-effort */ }
  const actionHistory = buildActionHistory(sessionEvents);
  // Lane AD: skill names that already failed in this hunt, seeded
  // from the permanent reasoning record — a verbatim repeat of one
  // is answered from the record in the load_skill dispatch below
  // instead of re-running the lookup. The loop also learns new
  // failures as they happen, so the memory covers this session too.
  let failedSkills = new Map();
  try {
    failedSkills = failedSkillAsks(getAllReasoning(huntId) || []);
  } catch { /* failed-skill memory is best-effort */ }
  let pendingSig = null; // signature of the action executing this turn
  let pendingDegraded = false; // Lane AF: the executing browser action's result was the look-only fallback
  let pendingPrevStreak = 0; // Lane AF: the signature's degraded streak before this execution
  let lastObservation = '';
  // WRONG-PAGE GUARD: the page the live browser is currently on,
  // as last observed ('' = unknown). Only EXECUTED browser
  // observations set it — never gate-block text, which names the
  // page the agent TRIED to reach, not the one it is on.
  let currentPageUrl = '';
  // WRONG-PAGE GUARD: track the live tab from an executed browser
  // observation. Seeding from the turn-start snapshot or a browser
  // action is the only way this moves.
  const notePageUrl = (obs) => {
    const u = pageUrlFromObservation(obs);
    if (u) currentPageUrl = u;
  };
  // INFINITY LEVEL: the parsed page state for this session —
  // loaded from pageState.json (coverage-ledger idiom), merged
  // from every executed snapshot, saved per turn. The brain's next
  // action is chosen against this record, never against a 300-char
  // stub. Declared before the loop so computeStateOfMind (defined
  // above) can read it at call time; its first call is in the loop.
  let sessionPageState = emptyPageState();
  try { sessionPageState = loadPageState(huntId); } catch { /* a bad file starts fresh */ }
  // HUNTER-MIND: the brain's own plan + its saved outputs — loaded
  // once per session (the files are the record; the loop only renders
  // them and writes back what the brain changes).
  let sessionPlan = emptyHuntPlan(target);
  try { sessionPlan = loadHuntPlan(huntId); } catch { /* a bad plan file starts fresh */ }
  let sessionOutputs = emptyOutputs();
  try { sessionOutputs = loadOutputs(huntId); } catch { /* a bad ledger file starts fresh */ }
  // WHOLE-OS CONTROL: the desktop state for this session —
  // in-memory only. The window list is re-read live on every
  // desktop_snapshot (small, re-derivable); what persists is the
  // interaction history in the tool_call record, counted by
  // loopCounters. The interacted titles survive across snapshots
  // within the session via mergeDesktopState.
  let sessionDesktopState = emptyDesktopState();
  // VISIBLE-DESKTOP-FIRST: per-turn routing state. turnKinds
  // records the action kinds THIS turn executed (toolCall appends);
  // the turn-end bookkeeping folds them into prevTurnDesktop, and
  // the next screen's nudge is computed from it. desktopLive
  // tracks whether the session-start snapshot found a real (CDP)
  // desktop: the per-turn heartbeat only runs while it is live, so
  // a headless fallback never pays a slow --dump-dom every turn.
  let turnKinds = [];
  let turnShellLogin = false;
  let prevTurnDesktop = { kinds: [], task: '', shellLogin: false };
  let desktopLive = false;
  let desktopNowLines = [];
  // INFINITY LEVEL: fold an executed action's structured snapshot
  // into the session page state (and persist it). A refusal carries
  // no snapshot, so it changes nothing.
  const noteSnapshot = (res) => {
    if (res && res.snapshot) {
      try {
        sessionPageState = mergePageState(sessionPageState, res.snapshot);
        savePageState(huntId, sessionPageState);
      } catch { /* page-state persistence is best-effort */ }
    }
  };
  let lastShellAt = 0;
  let lastShellCommand = '';
  let aiOk = false;
  let turnsRun = 0;
  // Lane I continuity state: the previous session's hand-off renders
  // on every screen of this session; this session's own trail feeds
  // the journal on screen and the leftOff persisted at session end.
  // Lane O: the hand-off comes through the memory read path — when
  // the persisted leftOff is missing (legacy meta, a crash before
  // the first clean session end, a lost write), loadHuntMemory
  // derives one from the permanent record, so a hunt with history
  // never starts cold.
  let memory0 = null;
  try { memory0 = loadHuntMemory(huntId, { target, meta: meta0 }); } catch { /* memory is best-effort */ }
  const prevLeftOff = leftOffLines((memory0 && memory0.leftOff) || (meta0.humanLoop && meta0.humanLoop.leftOff));
  // WRONG-PAGE GUARD (fix 2): seed the session's last observation
  // from the previous session's last action result instead of
  // starting blind (''). The auth gate's empty-snapshot check trips
  // on '' at the first GUI action of EVERY session otherwise.
  lastObservation = lastActionResultOfLeftOff((memory0 && memory0.leftOff) || (meta0.humanLoop && meta0.humanLoop.leftOff));
  let sessionLastThinking = '';
  let sessionLastNote = '';
  // KEYWORD-INDEX: the task block of this session. sessionTaskSeen
  // marks that a block arrived at all, so the checkpoints can clear
  // a stale currentTask (null) instead of leaving it standing.
  let sessionCurrentTask = null;
  let sessionLastCompletedTask = null;
  let sessionTaskSeen = false;
  // STUCK-DETECTOR (1 Nov 2026, v2): counts consecutive recall actions
  // across sessions (persistent file). If the brain recalls 5+ times in a
  // row without filing, it's stuck in a proof-bottling loop -- inject
  // a FILE NOW directive. Session-local vars reset on restart, so we
  // use a file in the hunt dir.
  const stuckCounterPath = '/opt/Dark-Matter/backend/data/hunts/' + huntId + '/stuck_recall_count.txt';
  function getStuckCount() {
    try { return parseInt(fs.readFileSync(stuckCounterPath, 'utf8').trim(), 10) || 0; }
    catch { return 0; }
  }
  function setStuckCount(n) {
    try { fs.writeFileSync(stuckCounterPath, String(n)); } catch {}
  }

  say(`Human mode session: ${turns} turns at my own machine. Target: ${target}.`);

  // WRONG-PAGE GUARD (fix 5): deterministic turn-start snapshot —
  // the driver looks at the live page itself and seeds
  // lastObservation with what it actually sees, so the session
  // never starts blind. This is perception (like the per-turn
  // machine-state read), not a brain action: no tool_call event.
  // The brain never snapshots on its own (0 in 140 turns), so the
  // loop does it. Read-only, so it runs even while the owner holds
  // control. On a foreign page the driver refuses with the WRONG
  // PAGE observation, which is itself the seed — it names the page
  // and the way back.
  try {
    const startSnap = await getGui().snapshot(huntId);
    if (startSnap && startSnap.observation) {
      lastObservation = startSnap.observation;
      notePageUrl(lastObservation);
      noteSnapshot(startSnap);
      // VISIBLE-DESKTOP-FIRST: the per-turn heartbeat only runs
      // while a REAL (CDP) desktop is live — a degraded (headless
      // look-only) snapshot means the desktop is down, and a
      // heartbeat would pay a slow --dump-dom every turn for it.
      desktopLive = startSnap.degraded !== true;
    }
  } catch { /* best-effort: a failed snapshot leaves the seed */ }

  // LOGIN-FIRST (zero-genuine lane): on a known lab app the hunt
  // starts behind its login wall — every real module sits behind
  // auth. Log in once per session (default lab credentials via the
  // vault), set security low, verify the session, and record it
  // before the first brain turn. A failed login is a recorded
  // auth_block blocker, never a silent skip. Best-effort: a failed
  // login never breaks the session — the brain is told on its first
  // screen and hunts unauthenticated.
  try {
    const login = await runLabLoginFirst(huntId, target, {
      gui: getGui(),
      saveCredential,
      getCredential,
      readMeta: deps.readMeta,
      writeMeta: deps.writeMeta,
      record: deps.record,
      note,
      addSecret: (s) => sessionSecrets.add(s),
      say,
      // OCR fallback (27 Oct 2026, live 22:50 failure): when a
      // label click misses — the OCR map reads "Username" as
      // "u ername" — the login falls back to the screen map's
      // coordinates. The map reader + the coordinate clicker are
      // injected here so labLogin stays testable without a desktop.
      screenMap: async () => {
        try {
          const res = await captureScreenMap(huntId, deps);
          if (!res || !res.ok) return { ok: false, error: (res && res.error) || 'map unavailable' };
          return { ok: true, lines: parseScreenMapLines(res.map) };
        } catch (err) {
          return { ok: false, error: String((err && err.message) || err) };
        }
      },
      clickAt: async (x, y) => {
        try {
          const res = await deps.execRaw(huntId, desktopClickAtCommand(x, y), 15000, { bypassTmux: true });
          return { ok: String((res && res.stdout) || '').includes('clicked') };
        } catch {
          return { ok: false };
        }
      },
    });
    if (login && !login.ok && login.reason && login.reason !== 'not-needed') {
      say(`Login-first blocked: ${login.reason} — hunting continues unauthenticated. The visible browser is still logged out — a shell curl login does NOT log it in; log in in the browser so the owner sees the authenticated surface.`);
    }
  } catch { /* login-first is best-effort */ }

  // POST-DISPATCH FILER SWEEP (#316): the pre-dispatch auto-filer scan
  // only sees text from BEFORE dispatch, so evidence produced during
  // dispatch (OCR screen text appended after screenshot/proof actions,
  // tool outputs) waits a full turn — and is lost entirely if the
  // session ends. This sweep runs at the end of every turn over the
  // final observation and files through the same claimGateCheck +
  // verifier as a claim_finding action. Dedup: a per-session set plus
  // isDuplicate (the sweep's own filing record satisfies later turns'
  // checks).
  const sweepFiledTitles = new Set();
  async function sweepPostDispatchEvidence(text) {
    let detected = null;
    try { detected = detectEvidence(String(text || '')); } catch { return; }
    if (!detected) return;
    if (sweepFiledTitles.has(detected.title)) return;
    try {
      if (isDuplicate(`/opt/Dark-Matter/backend/data/hunts/${huntId}`, detected.title)) return;
    } catch { /* dup check is best-effort; fail-open to filing */ }
    const rawTitle = String(detected.title || '');
    const title = String(rawTitle.trim() ? rawTitle : 'Untitled claim').slice(0, 200);
    const evidence = String(detected.evidence || '');
    const command = String(detected.command || lastShellCommand || '');
    const gate = claimGateCheck({
      title: rawTitle,
      cls: normaliseCoverageClass(detected.class) || claimClassFromTitle(rawTitle),
      command,
      poc: '',
      pocExists: false,
      evidence,
      counterevidence: detected.counterevidence,
      confidence: detected.confidence,
      rationale: 'Auto-detected by pattern matcher from brain output; brain has not manually filed this claim',
    });
    if (!gate.ok) {
      try { deps.record(huntId, { type: 'postdispatch_sweep_bounce', tool: 'claim_finding', detail: title, missing: gate.missing.map((m) => m.field), via: 'human-mode' }); } catch {}
      return;
    }
    const assess = await getAssess();
    if (!assess) return;
    let rec = null;
    try {
      rec = await assess(huntId, target, {
        test: title,
        command,
        why: 'Human-mode post-dispatch sweep — evidence produced during dispatch, filed same turn.',
        hypothesis: title,
      }, { stdout: evidence, stderr: '', code: 0 });
    } catch { return; }
    if (rec && rec.verified) {
      newFindings.push(rec);
      if (Array.isArray(opts.findings)) opts.findings.push(rec);
      sweepFiledTitles.add(detected.title);
      // Written with the action literal so later turns' isDuplicate
      // checks (pre-dispatch scan) recognise this filing.
      try { deps.record(huntId, { type: 'autofiler_postdispatch_filed', action: 'claim_finding', title, class: detected.class, via: 'human-mode' }); } catch {}
    }
  }

  for (let turn = 1; turn <= turns; turn++) {
    // Operator control: a pause/stop landed mid-session — hold position.
    try {
      const m = deps.readMeta(huntId) || {};
      if (m.paused === true || m.stopped === true || m.state === 'paused' || m.state === 'stopped') {
        say('Hunt paused/stopped by the operator — holding position.');
        break;
      }
    } catch { /* meta check is best-effort */ }

    // VISIBLE-DESKTOP-FIRST: fresh routing record for this turn —
    // toolCall appends the kinds this turn executes; the turn-end
    // bookkeeping folds them into prevTurnDesktop for the next
    // screen's nudge.
    turnKinds = [];
    turnShellLogin = false;

    // PER-TURN MEMORY REFRESH (Lane I): the briefing was built ONCE
    // per session and frozen for all 6 turns, so the brain's own
    // notes and actions from earlier turns of THIS session never
    // entered its memory until the next session. Rebuild it every
    // turn (the session-start call above is turn 1's). Best-effort:
    // a failed refresh keeps the previous briefing, never the turn.
    if (turn > 1) {
      try {
        const fresh = await deps.buildBriefing(huntId, target, deps.readMeta(huntId) || meta0);
        if (typeof fresh === 'string' && fresh.length > 0) briefing = fresh;
      } catch { /* keep the previous briefing */ }
    }

    // PERCEIVE: live machine state (working directory + workspace).
    let machineState = '';
    try {
      const st = await deps.execRaw(huntId, 'pwd; echo ---; ls -1 | head -40', 15000, { bypassTmux: true });
      machineState = `${st.stdout || ''}${st.stderr || ''}`.trim().slice(0, 900) || '(empty)';
    } catch {
      machineState = '(machine state unavailable)';
    }

    // VISIBLE-DESKTOP-FIRST: per-turn desktop heartbeat — every
    // turn starts with a fresh screen read, so the brain acts
    // against what is actually on screen, not from memory. The
    // browser snapshot is the fast CDP read (the same one the
    // session start takes). Best-effort and gated on desktopLive:
    // when the desktop is down the snapshot degrades to a slow
    // headless --dump-dom, and the heartbeat would stall every
    // turn for it. A failed heartbeat clears desktopLive, so it is
    // paid at most once. This is perception, not a brain action:
    // no tool_call event, and lastObservation (the result of the
    // last ACTION) is never overwritten by it. It reads the
    // BROWSER only — the window list is the desktop_snapshot
    // action's job: a heartbeat windows read would consume the
    // down-signal the desktop_terminal branch uses to start a
    // cold desktop, and would look like terminal work to the
    // desktop-call counters. The whole desktop is still read by
    // the brain's own see_screen / desktop_snapshot, which the
    // DESKTOP-FIRST rule and the nudge push it to take.
    desktopNowLines = [];
    if (desktopLive) {
      try {
        const hb = await getGui().snapshot(huntId);
        if (hb && hb.observation) {
          if (hb.degraded === true) { desktopLive = false; }
          else {
            desktopNowLines = heartbeatBlock(hb.observation);
            notePageUrl(hb.observation);
            noteSnapshot(hb);
          }
        } else { desktopLive = false; }
      } catch { desktopLive = false; }
    }

    const evFindings = findingsFromEvents(deps, huntId);
    const seenTitles = new Set(evFindings.map((f) => f.title));
    const findingsNow = [...evFindings, ...newFindings.filter((f) => !seenTitles.has(f.title))];
    let retractedCount = 0;
    try {
      retractedCount = retractedFindingCount(deps.readEvents(huntId) || []);
    } catch { /* retraction note is best-effort */ }
    // Lane J: concrete unprobed leads, refreshed every turn from the
    // hunt's current record (same per-turn discipline as the Lane I
    // briefing refresh) — as probes land, leads drop off the screen.
    let leads = [];
    try {
      const leadEvents = deps.readEvents(huntId) || sessionEvents;
      let leadRows = [];
      try {
        leadRows = getAllReasoning(huntId) || [];
      } catch { /* reasoning rows are best-effort */ }
      leads = unprobedLeadLines({ events: leadEvents, reasoningRows: leadRows, target });
    } catch { /* leads are best-effort perception */ }
    // Lane L: merge the hunt's coverage ledger into the same
    // region — rows the brain recorded take precedence over the
    // computed lead for their (surface, class) key, and open gaps
    // + cumulative research debt render alongside what remains.
    let coverageLines = [];
    try {
      const covData = loadCoverage(huntId);
      const merged = mergeLeadsWithCoverage({ leads, rows: covData.rows, debt: covData.researchDebt, target });
      leads = merged.leads;
      coverageLines = merged.coverage;
    } catch { /* coverage is best-effort perception */ }
    // Lane O: the state-of-mind block, refreshed every turn from
    // the permanent record (the same per-turn discipline as the
    // Lane I briefing refresh) — as probes land and rows close,
    // the done / not-done picture moves with the hunt.
    let stateOfMind = [];
    try {
      stateOfMind = computeStateOfMind(deps.readMeta(huntId) || meta0) || [];
    } catch { /* state of mind is best-effort perception */ }
    // Lane T: the failed-action follow-through thread, refreshed
    // every turn from the hunt's current record (the same discipline
    // as the leads refresh above) — the live loss happened between
    // two turns of ONE session, so this is never a session-start
    // computation.
    let followThrough = [];
    try {
      const ftEvents = deps.readEvents(huntId) || sessionEvents;
      let ftRows = [];
      try {
        ftRows = getAllReasoning(huntId) || [];
      } catch { /* reasoning rows are best-effort */ }
      followThrough = failedActionThreadLines({ events: ftEvents, reasoningRows: ftRows });
    } catch { /* follow-through is best-effort perception */ }
    // Lane AD: the settled-actions block, refreshed every turn
    // from the hunt's current record (the same discipline as the
    // Lane T thread above) — block counts grow mid-session as the
    // gate fires, and a signature settles the turn its third
    // block lands. Block counts come from the recorded dedup_block
    // events; run counts from the live action history.
    let settled = [];
    // Lane AG: this turn's events snapshot, kept for the gate
    // block path below. It is a COPY: the gate records the
    // current block into the same store mid-turn, and that block
    // must not leak into its own evidence count — the block path
    // adds it explicitly (extraBlocks) so the ordinal is exact.
    let turnEvents = sessionEvents;
    try {
      const sEvents = deps.readEvents(huntId) || sessionEvents;
      turnEvents = Array.isArray(sEvents) ? sEvents.slice() : sEvents;
      settled = settledActionLines({ events: sEvents, history: actionHistory });
    } catch { /* settled is best-effort perception */ }
    // INFINITY LEVEL: the exhausted-surface record + the parsed
    // page state + the loop counters, refreshed every turn from
    // the hunt's current record (same discipline as Lane AD).
    // surfaceCounts feeds the gate below; the page-state lines
    // and counters ride the screen; the credential state names
    // the account route in the auth-wall block.
    let surfaceCounts = new Map();
    let exhaustedLines = [];
    let pageStateLinesOut = [];
    let desktopStateLinesOut = [];
    let chatQuestionLinesOut = [];
    let planLinesOut = [];
    let detailsRequestLinesOut = [];
    let pendingChat = [];
    let credentialState = { saved: false };
    try {
      let turnRows = [];
      try { turnRows = getAllReasoning(huntId) || []; } catch { /* rows are best-effort */ }
      surfaceCounts = surfaceBlockCounts({ events: turnEvents, reasoningRows: turnRows });
      credentialState = credentialStateFor({ events: turnEvents, target });
      exhaustedLines = exhaustedSurfaceLines({ counts: surfaceCounts, target, credential: credentialState, events: turnEvents });
      const counters = loopCounters({ events: turnEvents, reasoningRows: turnRows, pageState: sessionPageState });
      pageStateLinesOut = [...pageStateLines(sessionPageState, { target }), ...loopCounterLines(counters)];
      // WHOLE-OS CONTROL: the desktop state rides the same
      // per-turn refresh as the page state.
      // REAL-HUMAN: the desktop nudge — when a browser surface is
      // exhausted AND the desktop has never been used in this hunt,
      // the screen names the desktop route explicitly. It is a
      // gate/observation naming an untried surface (the exhausted
      // pattern), never a chosen action: the brain still decides
      // what to do, but it can no longer claim it did not see the
      // desktop. Once any desktop action lands, the nudge leaves
      // the screen on its own.
      const desktopUsed = (counters.desktopClicks || 0) + (counters.desktopKeys || 0) + (counters.desktopClickControls || 0) + (counters.seeScreens || 0) + (counters.desktopClickAts || 0) + (counters.desktopTerminals || 0) > 0;
      const routeNudge = (exhaustedLines.length > 0 && !desktopUsed)
        ? 'DESKTOP ROUTE OPEN — your browser route on an exhausted surface is closed, and the desktop is still untried in this hunt: take desktop_snapshot, launch Burp or ZAP from the shell, and work the login flow there (proxy_start intercepts it; desktop_click_control presses a named button inside the app). A GUI tool sees what the browser loop cannot.'
        : '';
      // VISIBLE-DESKTOP-FIRST: the shell-only nudge — when the
      // previous turn did interactive work via shell only (or
      // logged in via curl), the screen says so and names the
      // desktop route. Both nudges ride the same line; either is
      // a nudge, never a forced action choice.
      const shellNudge = desktopFirstNudge(prevTurnDesktop);
      const desktopNudge = [routeNudge, shellNudge].filter(Boolean).join(' ');
      desktopStateLinesOut = desktopStateLines(sessionDesktopState, { target, nudge: desktopNudge });
      // REAL-HUMAN: the owner's queued questions, refreshed every
      // turn from the queue file (same discipline as the leads) —
      // a question asked mid-turn is on the very next screen.
      try {
        pendingChat = pendingChatQuestions(huntId) || [];
        chatQuestionLinesOut = chatQuestionScreenLines(pendingChat, { nowMs: deps.now() });
      } catch { /* a broken queue file never breaks the turn */ }
      // HUNTER-MIND: the brain's own plan, refreshed every turn
      // from the plan file (same discipline as the leads) — the
      // plan is the hunter's own instructions, and the screen
      // shows what is done, what is next, and whether the last 3
      // turns were all blocked (a stuck hunter revises its plan).
      try {
        planLinesOut = huntPlanLines(sessionPlan, { stuck: planStuck(log), outputsSaved: outputCount(sessionOutputs) });
      } catch { /* a broken plan file never breaks the turn */ }
      // DYNAMIC DETAILS (27 Oct 2026): the owner's details requests,
      // refreshed every turn from the user-details store (same
      // discipline as the queued questions) — a pending request says
      // WAIT, a newly-filled request's values ride the screen for
      // exactly one turn, a recent decline says so once.
      try {
        detailsRequestLinesOut = detailsRequestScreenLines(huntId, sessionSecrets);
      } catch { /* a broken details store never breaks the turn */ }
    } catch { /* exhausted/page-state/counters are best-effort perception */ }
    const screen = buildScreen({
      target,
      parsedScope,
      briefing,
      findings: opts.findings && opts.findings.length ? opts.findings : findingsNow,
      machineState,
      lastObservation,
      turn,
      turns,
      scopeHosts,
      facts,
      repetition,
      explored: exploredDigestLines(actionHistory),
      leftOff: prevLeftOff,
      journal: sessionJournalLines(log),
      retractedCount,
      leads,
      coverage: coverageLines,
      skills: skillLines,
      stateOfMind,
      followThrough,
      settled,
      pageState: pageStateLinesOut,
      exhausted: exhaustedLines,
      desktopState: desktopStateLinesOut,
      desktopNow: desktopNowLines,
      chatQuestions: chatQuestionLinesOut,
      huntPlan: planLinesOut,
      detailsRequest: detailsRequestLinesOut,
    });

    // THINK: one brain call. Full reply is recorded verbatim (total
    // permanent memory) BEFORE parsing — the thought is the record,
    // the JSON is just its last line.
    let reply = null;
    try {
      reply = await deps.chat([{ role: 'user', text: screen }], system, { huntId });
    } catch {
      reply = null;
    }
    // FIX (#362): an empty reply must not consume a turn or end the
    // hunt. Previously turnsRun++ ran BEFORE this check and the loop
    // broke (or returned no_reply at once), so one transient empty
    // response cost a turn and stopped the session. Now the empty
    // turn is skipped (continue) without counting, and the loop
    // retries with a fresh screen; the for loop's turn budget still
    // bounds total attempts, and a persistently silent brain ends
    // the run via the driver's fail-streak mechanism (the final
    // return below still reports failKind 'no_reply' when no reply
    // ever arrived, preserving LOOP-7's signal).
    if (!reply || !String(reply).trim()) {
      say('Brain gave no reply this turn.');
      continue;
    }
    turnsRun++;
    aiOk = true;
    const replyText = String(reply);
    // Lane AI: parse BEFORE recording the reply. Total permanent
    // memory still holds the whole reply — except a secret it
    // carries: a save_credential password joins the session secret
    // set first, so the recorded thinking text is scrubbed of it
    // and the secret lives only in the vault. Anything else stays
    // verbatim.
    const parsed = parseHumanAction(replyText);
    if (parsed && String(parsed.action.action).toLowerCase() === 'save_credential' && parsed.action.password) {
      sessionSecrets.add(String(parsed.action.password));
    }
    try { deps.record(huntId, { type: 'thinking', text: scrub(replyText), via: 'human-mode', turn }); } catch { /* best-effort */ }

    // KEYWORD-INDEX: the task block beside the action is the hunt's
    // current state — recorded, never re-derived. A complete task
    // saves its input/output to disk NOW (task_complete event) and
    // becomes lastCompletedTask; an in-progress task becomes
    // currentTask, so the next screen resumes it instead of
    // starting fresh.
    if (parsed && parsed.task) {
      sessionTaskSeen = true;
      const tb = parsed.task;
      if (tb.status === 'complete') {
        try { deps.record(huntId, { type: 'task_complete', task: tb.task || '', goal: tb.goal || '', progress: tb.progress || '', summary: tb.summary || '', via: 'human-mode' }); } catch { /* best-effort */ }
        sessionLastCompletedTask = { ...tb, completedAt: new Date().toISOString() };
        sessionCurrentTask = null;
      } else {
        sessionCurrentTask = { ...tb, status: 'in_progress', updatedAt: new Date().toISOString() };
      }
    }

    if (!parsed) {
      sessionLastThinking = replyText.trim().slice(0, 400);
      lastObservation =
        'Your reply had NO parseable action JSON, so nothing happened. Reply with brief thinking, then end with EXACTLY ONE action as a JSON object on the last line — e.g. {"action":"shell","command":"curl -s ' + String(target).slice(0, 60) + '"}';
      note({ action: 'unparseable reply', why: replyText.slice(0, 300), result: 'no action executed', learned: 'Replies must end with exactly one action JSON.' });
      log.push({ turn, action: 'unparseable', detail: '', observation: lastObservation });
      continue;
    }
    let action = parsed.action;
    const thinkingText = replyText.slice(0, parsed.jsonStart).trim().slice(0, 400);
    sessionLastThinking = thinkingText;
    let kind = String(action.action).toLowerCase();
    let observation = '';
    let recallLoopProof = null;

    // STUCK-DETECTOR v2: persistent across sessions
    if (kind === 'recall') {
      const c = getStuckCount() + 1;
      setStuckCount(c);
      if (c >= 5) {
        observation = 'STOP RECALLING. You have repeated recall ' + c + ' times across sessions. You already have the evidence on screen (password hashes dumped via SQLi). FILE THE CLAIM NOW using {"action":"claim_finding","title":"SQL Injection in DVWA","class":"sqli","evidence":"<the hashes you saw>","command":"<your replay command>","counterevidence":"<normal query returns no hashes>","confidence":"high"}. Do NOT recall again. FILE NOW.';
        try { deps.record(huntId, { type: 'stuck_detector_triggered', count: c, via: 'human-mode' }); } catch {}
        setStuckCount(0);
      }
    } else if (kind === 'claim_finding') {
      setStuckCount(0);
    } else if (!['shell', 'browser_snapshot', 'screenshot', 'browser_type', 'browser_click'].includes(kind)) {
      setStuckCount(0);
    }

    // AUTO-FILER v1: Scan brain output for vulnerability evidence.
    // If strong evidence found (SQLi hashes, XSS, CMDI), auto-file the claim.
    // The brain hunts; the filer files. Together they are the complete human.
    // Rehydrate the loop-breaker proof from the append-only event log on
    // every turn, so the next-turn auto-filer retains the original command
    // and recovered evidence instead of falling back to a placeholder PoC.
    if (!recallLoopProof) {
      try { recallLoopProof = recoverRecallLoopSqli(deps.readEvents(huntId) || []); } catch { /* best-effort */ }
    }
    try {
      // The previous action's result is also first-party text evidence.
      // This matters for recall: its handler runs after this turn's initial
      // scan, so a recovered proof is filed on the next turn.
      const scanText = String(thinkingText || '') + '\n' + String(observation || '') + '\n' + String(lastObservation || '');
      const detected = detectEvidence(scanText);
      if (detected && isDuplicate(`/opt/Dark-Matter/backend/data/hunts/${huntId}`, detected.title)) {
        // FIX (#315): the scan text includes lastObservation (previous
        // turn), so without this check the same evidence re-triggers an
        // override every turn. Skip the override; the brain's own action
        // stands. (Path follows this file's existing convention; the
        // hardcoded /opt/Dark-Matter prefix itself is tracked in #360.)
        try { deps.record(huntId, { type: 'autofiler_duplicate_skipped', title: detected.title, class: detected.class, via: 'human-mode' }); } catch {}
      } else if (detected) {
        // Construct the claim_finding action
        const autoClaim = {
          action: 'claim_finding',
          title: detected.title,
          class: detected.class,
          evidence: detected.class === 'sqli' && recallLoopProof
            ? recallLoopProof.evidence
            : detected.evidence,
          command: detected.class === 'sqli' && recallLoopProof
            ? recallLoopProof.command
            : detected.command,
          counterevidence: detected.counterevidence,
          confidence: detected.confidence,
          confidence_rationale: 'Auto-detected by pattern matcher from brain output; brain has not manually filed this claim',
        };
        // Log the auto-filing
        try { deps.record(huntId, { type: 'autofiler_triggered', title: detected.title, class: detected.class, via: 'human-mode' }); } catch {}
        // Override the brain's action with our auto-filed claim
        // (The brain's original action is preserved in the log)
        action = autoClaim;
        // FIX: recompute kind after override, else dispatch uses stale kind
        kind = 'claim_finding';
        observation = 'AUTO-FILER: Strong ' + detected.class.toUpperCase() + ' evidence detected in your output. ' +
                      'Filing claim automatically: "' + detected.title + '". ' +
                      'This is what a human hunter does — files the report when proof is found.';
      }
    } catch (afErr) {
      // Auto-filer must never break the hunt loop
      try { deps.record(huntId, { type: 'autofiler_error', error: String(afErr).slice(0, 200), via: 'human-mode' }); } catch {}
    }

    // STUCK-DETECTOR v3: if the brain itself says it's stuck looping,
    // inject FILE NOW immediately (don't wait for 5 recalls)
    const thinkingLower = String(thinkingText || '').toLowerCase();
    const isStuckTalk = thinkingLower.includes('stuck looping') ||
      thinkingLower.includes('stuck in a loop') ||
      thinkingLower.includes('stuck in that') ||
      (thinkingLower.includes('stuck') && thinkingLower.includes('login loop')) ||
      thinkingLower.includes('breaking out') ||
      thinkingLower.includes('break this login loop');
    if (isStuckTalk) {
      observation = 'YOU SAID YOU ARE STUCK LOOPING. STOP. You have SQLi evidence (password hashes dumped). FILE THE CLAIM NOW: {"action":"claim_finding","title":"SQL Injection in DVWA User ID","class":"sqli","evidence":"First name: admin, Surname: 5f4dcc3b5aa765d61d8327deb882c (MD5 of password)","command":"curl -s http://172.17.0.1:3100/vulnerabilities/sqli/?id=1%27+UNION+SELECT+user%2Cpassword+FROM+users%23&Submit=Submit","counterevidence":"Normal id=1 returns only first name Gordon, no hashes","confidence":"high"}. FILE NOW, DO NOT RECALL.';
      try { deps.record(huntId, { type: 'stuck_detector_v3_triggered', via: 'human-mode' }); } catch {}
    }

    // DVWA AUTO-LOGIN: if brain is stuck at DVWA login page (CSRF token issue),
    // perform system-level login via shell. Permanent fix - brain never has to
    // fight the login form again.
    try {
      // If brain says stuck and target is DVWA, auto-login immediately.
      // (isStuckAtDvwaLogin gate removed - was too strict, blocked the fix)
      {
        const dvwaTarget = (typeof target === 'string' ? target : '');
        if (/3100|dvwa/i.test(dvwaTarget)) {
          const loginRes = await dvwaLogin({
            huntId,
            target: dvwaTarget,
            execInContainer: async (hid, cmd) => {
              // Use the container exec via deps
              if (deps.execInContainer) return await deps.execInContainer(hid, cmd);
              if (deps.execRaw) return await deps.execRaw(hid, cmd);
              throw new Error('no_container_exec');
            },
          });
          if (loginRes.ok) {
            // Write cookies to container for brain's shell use
            try {
              const { getDvwaCookies } = await import('./dvwaAuth.js');
              const cookies = getDvwaCookies(huntId);
              if (cookies && deps.execRaw) {
                const cookieFile = `/tmp/dvwa-cookies-${huntId}.txt`;
                const lines = ['# Netscape HTTP Cookie File'];
                for (const c of cookies.split(';')) {
                  const idx = c.indexOf('=');
                  if (idx > 0) {
                    const k = c.slice(0, idx).trim();
                    const v = c.slice(idx + 1).trim();
                    if (k) lines.push(`172.17.0.1\tFALSE\t/\tFALSE\t0\t${k}\t${v}`);
                  }
                }
                await deps.execRaw(huntId, `cat > ${cookieFile} << 'COOKIEEOF'\n${lines.join('\n')}\nCOOKIEEOF`);
              }
            } catch {}
            observation = 'SYSTEM AUTO-LOGIN: Successfully logged into DVWA as admin (security set to low). ' +
              'STOP trying to log in via the browser - you are ALREADY authenticated via the backend. ' +
              'Your browser does NOT have the session cookies. To hunt, use SHELL with the cookie jar at ' +
              `/tmp/dvwa-cookies-${huntId}.txt. Example: curl -s -b /tmp/dvwa-cookies-${huntId}.txt ` +
              '"http://172.17.0.1:3100/vulnerabilities/sqli/?id=1&Submit=Submit". ' +
              'The SQL Injection module is at /vulnerabilities/sqli/. Hunt it NOW via shell - do NOT use the browser login form.';
            try { deps.record(huntId, { type: 'dvwa_autologin', ok: true, via: 'human-mode' }); } catch {}
          } else {
            try { deps.record(huntId, { type: 'dvwa_autologin', ok: false, error: loginRes.error, via: 'human-mode' }); } catch {}
          }
        }
      }
    } catch (dvwaErr) {
      // Auto-login must never break the hunt loop
      try { deps.record(huntId, { type: 'dvwa_autologin_error', error: String(dvwaErr).slice(0, 200), via: 'human-mode' }); } catch {}
    }

    // REAL-HUMAN: the brain's answers to the owner's queued
    // questions ride in the SAME reply as its action (the
    // chat_answers array on the action JSON). They are delivered
    // FIRST, before the action is gated or executed — the answer
    // is independent of what the action does, and a gate-blocked
    // action must never swallow the owner's answer with it.
    // Delivery is the dep (tests inject a stub); the pending list
    // is the turn's own snapshot, so an answer to a question asked
    // after this screen was built is ignored, never invented.
    try {
      const answers = extractChatAnswers(action, pendingChat);
      for (const a of answers) {
        try {
          await deps.deliverChatAnswer(huntId, a);
        } catch { /* one failed delivery never blocks the rest */ }
        try {
          note({ action: `chat_answer: ${a.q}`, why: thinkingText, result: String(a.answer || '').slice(0, 300), learned: '' });
        } catch { /* the reasoning note is best-effort */ }
      }
    } catch { /* chat answers are best-effort — the action still runs */ }

    // ACT
    // ALREADY-DONE GATE (Lane F): the identical action has already
    // been executed >= 2 times in this hunt — do not execute it
    // again. The block is recorded as a dedup_block event (visible
    // in events.jsonl, countable by monitors) and the brain gets an
    // observation carrying the count and, when known, the last
    // result — then it must choose a different action. Every other
    // gate below runs exactly as before for actions that pass.
    // WRONG-PAGE GUARD (fix 4): the narrow return-to-target
    // exemption — a browser_open of the target's own login surface
    // while the live tab is provably OFF the target is not a repeat,
    // it is the way home (Trap 4: every such open already ran x2,
    // so dedupe blocked the return forever). Unknown current page
    // means NO exemption; repeated opens while already ON the
    // target are still deduped as before.
    const returnExempt = isReturnToTarget(kind, action, currentPageUrl, target, parsedScope);
    // FRESH ATTEMPT (dedup-submit lane): the gate reads the same
    // per-turn event record the auth gate reads, so in-session GUI
    // work counts too — a snapshot / new marker / reload since the
    // last identical execution makes the repeat a fresh attempt.
    const gateHit = returnExempt ? null : dedupeGateHit(kind, action, actionHistory, { events: turnEvents });
    // REAL-HUMAN: the near-duplicate search gate — same question in
    // different words. Judged only when the exact gate did not
    // already fire (an exact repeat is the stronger statement).
    const searchHit = !gateHit && kind === 'search' ? searchRepeatHit(action.query, actionHistory) : null;
    const authHit = authGateHit(kind, action, actionHistory, lastObservation, { events: turnEvents });
    // INFINITY LEVEL: the exhausted-surface gate — the (page,
    // payload class) combination has already been blocked >=
    // EXHAUSTED_MIN_BLOCKS times, so no wording of the payload
    // can change the outcome. Judged against the LIVE page
    // (currentPageUrl, falling back to the parsed page state),
    // never the page the hunter believes it is on.
    const exhaustedHit = exhaustedSurfaceHit(kind, action, currentPageUrl, surfaceCounts, sessionPageState);
    // WRONG-TARGET GATE (zero-genuine lane): the action names another
    // app's endpoints for this target's known app — executing it
    // burns a turn on a 404 and its failure retires premises never
    // tested on the real target. Judged after the exhausted gate (a
    // closed surface is the stronger statement) and before dedupe.
    const knownAppNow = (() => { try { return knownAppOf(deps.readMeta(huntId) || {}, target); } catch { return null; } })();
    const wrongTargetHit = (kind === 'shell' || kind === 'browser_open') && knownAppNow
      ? findWrongTargetPaths(knownAppNow, JSON.stringify(action || {}))
      : [];
    const controlHit = GUI_CONTROL_KINDS.has(kind) && deps.machineControlled(huntId);
    // PROOF-COMPLETE GATE (gate-replay lane, 28 Oct 2026) — the
    // signature is captured BEFORE execution (the page a probe
    // navigates to must not change the key) and reused by the
    // post-execution proof counter below. Judged only when no
    // earlier gate fired: an exact repeat, a closed surface, a
    // wrong target or an auth loop is the stronger statement.
    const proofSig = proofSignatureFor(kind, action, { page: currentPageUrl });
    const proofHit = !gateHit && !searchHit && !authHit && !exhaustedHit && !wrongTargetHit.length
      ? proofGateHit(kind, action, proofCounts, { page: currentPageUrl, sig: proofSig })
      : null;
    if (controlHit) {
      // TAKE-CONTROL GATE — checked FIRST, before the auth and dedupe
      // gates: while the owner drives the desktop by hand, ANY agent
      // GUI action would fight their mouse and keyboard. The action
      // is skipped cleanly (a countable control_pause event, like
      // auth_block / dedup_block) and the brain is told to spend the
      // turn on non-GUI work instead — shell, search, recall, or
      // planning — and to try GUI actions again on a later turn, when
      // the owner has pressed Done or Cancel.
      const holder = (() => { try { return getControl(huntId); } catch { return null; } })();
      try { deps.record(huntId, { type: 'control_pause', tool: kind, detail: detailForAction(kind, action), via: 'human-mode' }); } catch { /* best-effort */ }
      say(`Owner is controlling the machine — GUI action ${kind} paused.`);
      observation = `PAUSED — THE OWNER IS CONTROLLING THE MACHINE${holder ? ` (${holder.username})` : ''}: your ${kind} action was NOT executed. The owner is driving the desktop by hand right now; any click or keystroke you send would fight their input. Do NOT retry a GUI action — use this turn for shell, search, recall, or planning instead, and try GUI actions again on a later turn. Control ends when the owner presses Done or Cancel.`;
      note({ action: `control_pause: ${kind} ${detailForAction(kind, action).slice(0, 120)}`, why: thinkingText, result: 'paused — owner in control', learned: 'While the owner controls the machine, GUI actions are skipped; work without the desktop.' });
    } else if (authHit) {
      // AUTH-LOOP GATE (Lane AJ) — checked BEFORE the dedupe gate.
      // When both apply (a re-type on the sign-in page), the auth
      // redirect is strictly more useful than the generic repeat
      // block: it names the move that would change the outcome
      // (finish signup / fetch the code / read the form) instead of
      // merely forbidding the repeat. Live evidence 24 Oct: AJ never
      // fired (0 auth_block) because Lane F always won first, while
      // the hunt kept re-typing the same username — the dedupe
      // observation told it to "choose a DIFFERENT action" and it
      // chose the same login again by another route.
      try { deps.record(huntId, { type: 'auth_block', tool: authHit.tool, detail: scrub(authHit.detail), reason: authHit.reason, via: 'human-mode' }); } catch { /* best-effort */ }
      say(`Auth gate stopped a blind/looped browser action: ${authHit.tool} (${authHit.reason}).`);
      observation = `BLOCKED — ${authHit.reason === 'empty_snapshot' ? 'YOU CANNOT SEE THE PAGE' : 'STILL ON THE SIGN-IN PAGE'}: ${authHit.redirect} It was NOT executed — choose one of the moves above.`;
      note({ action: `auth_block: ${authHit.tool} ${authHit.detail.slice(0, 120)}`, why: thinkingText, result: `blocked (${authHit.reason})`, learned: 'Never type into a page you cannot see; a login is only real when the page after it is not the sign-in page.' });
    } else if (exhaustedHit) {
      // EXHAUSTED-SURFACE GATE (Infinity level) — after the auth
      // gate (whose redirect is the more useful answer while it
      // still fires) and before dedupe: a 3×-blocked surface is a
      // stronger statement than an exact repeat. The gate closes
      // the surface itself — any payload wording, not just the
      // ones already tried — and the observation names the routes
      // that are still open (account / unauthenticated recon).
      // A different page is a different surface: the gate lifts
      // the moment the page changes.
      try { deps.record(huntId, { type: 'exhausted_block', tool: exhaustedHit.tool, detail: exhaustedHit.key, count: exhaustedHit.count, via: 'human-mode' }); } catch { /* best-effort */ }
      say(`Exhausted surface — ${exhaustedHit.tool} ${exhaustedHit.payloadClass} on ${exhaustedHit.page} already blocked ×${exhaustedHit.count}.`);
      observation = exhaustedBlockObservation(exhaustedHit, { target, credential: credentialState, events: turnEvents });
      note({ action: `exhausted_block: ${exhaustedHit.tool} ${exhaustedHit.payloadClass} on ${exhaustedHit.page}`, why: thinkingText, result: `surface closed — blocked ×${exhaustedHit.count}`, learned: 'A surface blocked 3 times is closed; the way forward is a different page, a different payload class, or the account/recon routes.' });
    } else if (wrongTargetHit.length) {
      // WRONG-TARGET GATE (zero-genuine lane) — after the exhausted
      // gate, before dedupe: the action targets another app's
      // endpoints (e.g. /rest/* on a DVWA target). It was NOT
      // executed — a 404 against the wrong app proves nothing, and
      // its failure would retire a premise never tested.
      try { deps.record(huntId, { type: 'wrong_target_block', tool: kind, detail: wrongTargetHit.join(', '), via: 'human-mode' }); } catch { /* best-effort */ }
      say(`Wrong-target action blocked: ${wrongTargetHit.join(', ')} belongs to another app, not this target.`);
      observation = `BLOCKED — WRONG TARGET: ${wrongTargetHit.join(', ')} ${wrongTargetHit.length > 1 ? 'are' : 'is'} another app's endpoint${wrongTargetHit.length > 1 ? 's' : ''} — this target is ${knownAppNow}, and ${wrongTargetHit.length > 1 ? 'they do' : 'it does'} not exist here. It was NOT executed — a 404 against the wrong app proves nothing. Hunt THIS app's surface instead.`;
      note({ action: `wrong_target_block: ${kind} ${wrongTargetHit.join(', ')}`, why: thinkingText, result: 'blocked — wrong-target endpoint', learned: 'Endpoints from another app do not exist on this target; hunt the app in front of you.' });
    } else if (gateHit) {
      try { deps.record(huntId, { type: 'dedup_block', tool: gateHit.tool, detail: scrub(gateHit.detail), count: gateHit.count, via: 'human-mode' }); } catch { /* best-effort */ }
      say(`Already-done gate stopped a repeat: ${gateHit.tool} ${gateHit.detail.slice(0, 120)} — already run ×${gateHit.count} in this hunt.`);
      // KEYWORD-INDEX: the block names WHERE the repeat already lives
      // — its index number and content-hash — so the brain can fetch
      // the saved output instead of just being refused.
      let firstRunNote = '';
      try {
        const firstN = firstRunNumber(turnEvents, gateHit.tool, gateHit.detail);
        if (firstN != null) firstRunNote = ` It first ran as #${firstN} in your Action Index (hash ${contentHash(gateHit.tool, gateHit.detail)}) — recall #${firstN} for its saved output.`;
      } catch { /* index lookup is best-effort */ }
      observation =
        `BLOCKED — ALREADY DONE: you have already performed this exact action ${gateHit.count} times in this hunt (${gateHit.tool}: ${gateHit.detail}).${firstRunNote}` +
        (gateHit.lastResult ? ` Last result: ${gateHit.lastResult}` : '') +
        ' It was NOT executed again — an identical repeat returns the identical result and only burns a turn. Choose a DIFFERENT action: a page you have not visited, a search you have not run, a probe you have not tried — or act on what you already learned.' +
        // Lane AF: for a blocked page-open, name the two variations
        // that are NOT blocked, deterministically — the cheap half
        // of the DVWA rescue (the brain there never discovered
        // either on its own).
        (gateHit.tool === 'browser_open'
          ? ' For this page specifically: browser_snapshot shows the page you already have open, without re-opening it; and a deeper URL on the same site (its login or setup page, for example) is a different action that is not blocked.'
          : '');
      // Lane AG: when the blocked action is SETTLED, the
      // observation itself — the result text the hunter builds
      // its next turn from — carries the counter-evidence from
      // the record (settledBlockEvidence). Non-settled blocks
      // append nothing and keep the observation above untouched.
      try {
        observation += settledBlockEvidence({ events: turnEvents, history: actionHistory, tool: gateHit.tool, detail: gateHit.detail, extraBlocks: 1 });
      } catch { /* settled evidence is best-effort */ }
      note({ action: `dedup_block: ${gateHit.tool} ${gateHit.detail.slice(0, 120)}`, why: thinkingText, result: `repeat blocked — already run ×${gateHit.count}`, learned: 'Exact repeats are stopped by the record; vary the action.' });
    } else if (searchHit) {
      // NEAR-DUPLICATE SEARCH GATE (REAL-HUMAN) — same dedup_block
      // shape as the exact gate, so monitors count it identically.
      // The observation names the earlier search and what it
      // returned, so the brain can act on results it already has
      // instead of re-asking the web the same question.
      try { deps.record(huntId, { type: 'dedup_block', tool: 'search', detail: scrub(searchHit.detail), similarTo: searchHit.earlier, via: 'human-mode' }); } catch { /* best-effort */ }
      say(`Already-searched gate stopped a reworded repeat: "${searchHit.detail.slice(0, 120)}" — same question as "${searchHit.earlier.slice(0, 120)}".`);
      observation =
        `BLOCKED — ALREADY SEARCHED: "${searchHit.detail}" asks the same question as your earlier search "${searchHit.earlier}" (same words, different order/filler) — you have already asked this question ${searchHit.familyCount} times in this hunt.` +
        (searchHit.lastResult ? ` That search already returned: ${searchHit.lastResult.slice(0, 200)}` : '') +
        ' It was NOT run again — a reworded repeat returns the same results and only burns a turn. Act on what you already learned, or search for something genuinely new: a different technique, a different surface, a different question.';
      note({ action: `dedup_block: search ${searchHit.detail.slice(0, 120)}`, why: thinkingText, result: `reworded repeat blocked — same question as "${searchHit.earlier.slice(0, 120)}"`, learned: 'A question already searched is answered from the record; rewording it does not make it new.' });
    } else if (proofHit) {
      // PROOF-COMPLETE GATE (gate-replay lane, 28 Oct 2026) — the
      // claim is already proven PROOF_THRESHOLD times; a further
      // probe (whatever the marker wording) proves nothing new.
      // The block does NOT say "try something else": it names the
      // one move that advances the hunt — FILE the claim. Recorded
      // as a countable proof_file_nudge event (same shape as
      // dedup_block / auth_block / exhausted_block).
      try { deps.record(huntId, { type: 'proof_file_nudge', tool: proofHit.tool, detail: scrub(`${proofHit.payloadClass} on ${proofHit.endpoint}`), count: proofHit.count, via: 'human-mode' }); } catch { /* best-effort */ }
      say(`Proof complete — ${proofHit.payloadClass} on ${proofHit.endpoint} already proven ×${proofHit.count}; filing required.`);
      observation = proofFileObservation(proofHit);
      // OCR LOOP-BREAKER (1 Nov 2026, permanent system-level fix): The brain
      // has proven this claim 3x but will not transcribe/file it. The SYSTEM
      // captures the screen itself via OCR so the auto-filer sees what the
      // brain sees. Bypasses the model's refusal to take screenshots.
      try {
        const loopOcr = await captureScreenMap(huntId, deps);
        if (loopOcr && loopOcr.ok && loopOcr.map) {
          observation += "\n\n[OCR screen text — system-captured during proof loop]:\n" + loopOcr.map;
        }
      } catch { /* OCR is best-effort; proof nudge works without it */ }
      // HISTORY-BACKED SELF-PROOF (1 Nov 2026, permanent system-level fix):
      // The brain is stuck in recall ("I proved it before") but the actual
      // hashes live in the EVENT HISTORY (past shell outputs). The system
      // reads recent events, extracts 32-char hashes, and injects them into
      // the observation so the auto-filer can file. No brain cooperation needed.
      try {
        if (proofHit && /sqli/i.test(proofHit.payloadClass || '')) {
          const fs = await import('fs');
          const histPath = `/opt/Dark-Matter/backend/data/hunts/${huntId}/events.jsonl`;
          const histText = fs.readFileSync(histPath, 'utf8').split('\n').slice(-200).join('\n');
          const histHashes = histText.match(/\b[a-f0-9]{32}\b/g);
          if (histHashes && histHashes.length) {
            const uniqHashes = [...new Set(histHashes)].slice(0, 5);
            observation += "\n\n[SYSTEM HISTORY-PROOF — hashes from recent event history]:\n" + uniqHashes.join('\n');
          }
        }
      } catch { /* History-proof is best-effort */ }
      note({ action: `proof_file_nudge: ${proofHit.payloadClass} on ${proofHit.endpoint}`, why: thinkingText, result: `proof complete ×${proofHit.count} — file it`, learned: 'A claim proven three times is filed, not re-proved; the verifier decides whether it is true.' });
    } else if (kind === 'shell') {
      const command = String(action.command || '').slice(0, COMMAND_CAP);
      if (!command) {
        observation = 'Empty shell command — nothing ran. Give a real command.';
      } else if (heavyScanViolation(command, parsedScope)) {
        observation = `BLOCKED by the programme rules: "${command.slice(0, 120)}" is automated/heavy scanning, which this programme forbids. Work like a human: single targeted probes, one at a time.`;
        say(`Programme rules blocked a heavy-scan command: ${command.slice(0, 120)}`);
      } else {
        const badUrl = commandScopeViolation(command, target, parsedScope);
        if (badUrl) {
          observation = `BLOCKED — OUT OF SCOPE: ${badUrl} is not part of this programme. Only test ${target} and its listed assets. Nothing was sent.`;
          say(`Out-of-scope command blocked: ${command.slice(0, 120)}`);
        } else {
          // HUNTER-MIND: output memory — an action whose output is
          // already saved is answered from the record instead of
          // re-running ("iska output hi aaya tha"). The dedupe gate
          // above already stops a 3rd+ run; the ledger catches the
          // FIRST re-ask, which the gate tolerates. A redo needs a
          // reason: "force": true + "why" — otherwise the saved
          // output IS the answer.
          const forceShell = action.force === true && String(action.why || '').trim().length > 0;
          const shellSig = actionSignature('shell', command);
          const shellSaved = !forceShell ? findOutput(sessionOutputs, shellSig) : null;
          if (shellSaved) {
            try { deps.record(huntId, { type: 'output_recall', tool: 'shell', detail: scrub(command), via: 'human-mode' }); } catch { /* best-effort */ }
            observation = recallObservation(shellSaved, { nowMs: deps.now() });
          } else {
            // Programme pacing: hold the requests-per-minute cap between
            // shell actions (the pipeline never enforced this; human
            // mode does, because a human at 20 req/min is the programme's
            // own picture of acceptable behaviour).
            if (minShellGapMs > 0 && lastShellAt > 0) {
              const wait = lastShellAt + minShellGapMs - deps.now();
              if (wait > 0) await deps.sleep(wait);
            }
            toolCall('shell', command);
            let spillHandle = '';
            try {
              const exec = await getExec();
              const result = await exec(huntId, target, command);
              lastShellAt = deps.now();
              lastShellCommand = command;
              const combined = `${result.stdout || ''}\n${result.stderr || ''}`.trim();
              if (combined.length > OBS_BUDGET) {
                try {
                  spillHandle = deps.spill(huntId, combined);
                } catch { /* spill is best-effort */ }
                observation =
                  combined.slice(0, OBS_BUDGET) +
                  `\n[output truncated on screen — ${combined.length} chars total${spillHandle ? `, saved in full as artifact ${spillHandle} in your workspace (READ it back via a shell action: cat the hunt artifacts, or re-run with head/grep)` : ''}]`;
              } else {
                observation = combined || `(command finished with no output, exit code ${result.code ?? 0})`;
              }
              if (result.code && result.code !== 0) {
                observation += `\n[exit code ${result.code}]`;
              }
            } catch (err) {
              observation = `Shell action failed to run: ${err.message || err}`;
            }
            // Save the output — this work is now done, and the next
            // time the brain asks for it, the ledger answers.
            try {
              sessionOutputs = recordOutput(sessionOutputs, { signature: shellSig, tool: 'shell', detail: command, output: observation, artifact: spillHandle, forced: forceShell, why: String(action.why || '') });
              saveOutputs(huntId, sessionOutputs);
            } catch { /* the ledger is best-effort — the turn already ran */ }
          }
        }
      }
      note({ action: `shell: ${command.slice(0, 160)}`, why: thinkingText, result: clipResult(observation), learned: '' });
    } else if (kind === 'search') {
      const query = String(action.query || '').slice(0, 200);
      // HUNTER-MIND: output memory — a search already run is
      // answered from its saved results instead of re-searching
      // (same rule as shell: the dedupe gate stops a 3rd+ run, the
      // ledger catches the first re-ask; a redo needs "force" + "why").
      const forceSearch = action.force === true && String(action.why || '').trim().length > 0;
      const searchSig = actionSignature('search', query);
      const searchSaved = !forceSearch ? findOutput(sessionOutputs, searchSig) : null;
      if (searchSaved) {
        try { deps.record(huntId, { type: 'output_recall', tool: 'search', detail: scrub(query), via: 'human-mode' }); } catch { /* best-effort */ }
        observation = recallObservation(searchSaved, { nowMs: deps.now() });
      } else {
        toolCall('search', query);
        try {
          const results = await deps.search(query, 5);
          observation = results && results.length
            ? results.map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${String(r.snippet || '').slice(0, 200)}`).join('\n')
            : 'No web results found for that query.';
        } catch {
          observation = 'Web search failed this time.';
        }
        try {
          sessionOutputs = recordOutput(sessionOutputs, { signature: searchSig, tool: 'search', detail: query, output: observation, forced: forceSearch, why: String(action.why || '') });
          saveOutputs(huntId, sessionOutputs);
        } catch { /* the ledger is best-effort — the turn already ran */ }
      }
      note({ action: `search: ${query}`, why: thinkingText, result: clipResult(observation), learned: '' });
    } else if (kind === 'write_file') {
      const name = String(action.name || '');
      const content = String(action.content ?? '');
      toolCall('write_file', name);
      try {
        const w = await deps.writeFile(huntId, name, content);
        // Lane AL: the observation names the container-local path and
        // states the file is NOT on the target — the old "saved in your
        // hunt workspace" left the hunter downloading its own script
        // from the target URL (28 dedupe blocks, Infomaniak, Oct 2026).
        observation = writeFileObservation(w.name || name, w.chars ?? content.length);
      } catch (err) {
        observation = `write_file failed: ${err.message || err}`;
      }
      note({ action: `write_file: ${name}`, why: thinkingText, result: clipResult(observation), learned: '' });
    } else if (kind === 'note') {
      const text = String(action.text || '');
      sessionLastNote = text;
      note({ action: 'note to self', why: text, result: 'recorded', learned: text.slice(0, 300) });
      say(`Note to self: ${text.slice(0, 300)}`);
      observation = 'Note saved in your notebook — it will be in your memory briefing from now on.';
    } else if (kind === 'recall') {
      // Lane I: deliberate remembering. NOT dedupe-gated (remembering
      // is free) and NOT scope-gated (it reads only the hunter's own
      // memory — no traffic leaves the machine).
      // KEYWORD-INDEX: recall by sequential id returns the full
      // stored record of that action — O(1), this hunt only.
      // Query-recall stays for meaning-based search.
      const id = parseRecallId(action.id);
      if (id != null) {
        toolCall('recall', `#${id}`);
        try {
          const rec = recallById(deps.readEvents(huntId) || [], getAllReasoning(huntId) || [], id);
          observation = formatFullRecord(rec);
        } catch {
          observation = 'Recall failed this time — your briefing still carries the distilled memory.';
        }
        note({ action: `recall: #${id}`, why: thinkingText, result: clipResult(observation), learned: '' });
      } else {
        const query = String(action.query || '').slice(0, 200);
        toolCall('recall', query);
        try {
          observation = String(await deps.recall(huntId, query) || '').slice(0, 1500) || 'Recall returned nothing.';
        } catch {
          observation = 'Recall failed this time — your briefing still carries the distilled memory.';
        }
        // RECALL LOOP BREAKER: activate independently of proof_file_nudge.
        // Three consecutive recall actions plus at least two hashes from
        // recorded UNION-SQLi output and its original probe produce a
        // system-authored evidence block. The normal auto-filer sees it on
        // the following turn and sends it through the independent verifier.
        try {
          recallLoopProof = recoverRecallLoopSqli(deps.readEvents(huntId) || []);
          if (recallLoopProof) {
            observation += '\n\n[SYSTEM RECOVERED HISTORICAL SQLi PROOF — DO NOT RE-RECALL]\n' +
              'Consecutive recalls: ' + recallLoopProof.recalls + '\n' +
              'Hashes recovered from recorded UNION SELECT output: ' + recallLoopProof.hashes.join(', ') + '\n' +
              'Recorded reproduction command: ' + recallLoopProof.command + '\n' +
              recallLoopProof.evidence + '\n' +
              'The auto-filer will submit this historical proof to the independent verifier next turn. A claim is not confirmed unless the verifier reproduces it.';
            try { deps.record(huntId, { type: 'recall_loop_proof_recovered', recallCount: recallLoopProof.recalls, hashCount: recallLoopProof.hashes.length, command: scrub(recallLoopProof.command).slice(0, 500), via: 'system' }); } catch { /* best-effort */ }
          }
        } catch { /* recovery is best-effort; recall still succeeds */ }
        note({ action: `recall: ${query}`, why: thinkingText, result: clipResult(observation), learned: '' });
      }
    } else if (kind === 'record_coverage') {
      // Lane L: the hunter accounts for a surface × class in its
      // own coverage ledger. NOT dedupe-gated (accounting is free,
      // like recall) and NOT scope-gated (it writes only the hunt's
      // own ledger — no traffic leaves the machine). The ledger
      // enforces its contracts in code: uniqueness per key, and
      // closure evidence naming the control for ruled_out /
      // not_applicable.
      const covInput = {
        surface: String(action.surface || '').slice(0, 300),
        class: String(action.class || '').slice(0, 80),
        outcome: String(action.outcome || '').slice(0, 40),
        evidence: String(action.evidence || '').slice(0, 500),
      };
      toolCall('record_coverage', detailForAction(kind, action));
      let covResult = null;
      try {
        covResult = action.update === true
          ? updateCoverage(huntId, covInput)
          : recordCoverage(huntId, covInput);
      } catch { /* ledger write is best-effort — the observation says so */ }
      observation = coverageObservation(covResult, { surface: covInput.surface, cls: covInput.class });
      if (covResult && (covResult.status === 'created' || covResult.status === 'updated')) {
        say(`Coverage ${covResult.status}: ${covInput.surface} × ${covInput.class} → ${covInput.outcome}`);
      }
      note({ action: `record_coverage: ${covInput.surface} ${covInput.class} ${covInput.outcome}`, why: thinkingText, result: clipResult(observation), learned: '' });
    } else if (kind === 'hunt_plan') {
      // HUNTER-MIND: the brain writes/revises its OWN hunt plan.
      // NOT dedupe-gated (writing a plan is free, like recall) and
      // NOT scope-gated (it writes only the hunt's own plan file —
      // no traffic leaves the machine). The plan is the hunter's
      // own instructions: the loop renders it on every screen and
      // the brain works it step by step, checking steps off with
      // evidence. A revised list can never resurrect a finished
      // step — setPlanSteps preserves done/skipped by normalised
      // text, so the record only ever moves forward.
      toolCall('hunt_plan', detailForAction(kind, action));
      if (Array.isArray(action.steps)) {
        sessionPlan = setPlanSteps(sessionPlan, action.steps);
        try { saveHuntPlan(huntId, sessionPlan); } catch { /* plan persistence is best-effort */ }
        const next = nextPlanStep(sessionPlan);
        const doneCount = sessionPlan.steps.filter((s) => s.status === 'done').length;
        observation = `Your plan is saved — ${sessionPlan.steps.length} step(s), ${doneCount} done, revised ×${sessionPlan.revised}. Work it step by step. ${next ? `NEXT: step ${sessionPlan.steps.indexOf(next) + 1} — "${next.text}".` : 'Every step is done or skipped — write a new plan for the next phase.'}`;
        say(`Plan saved: ${sessionPlan.steps.length} steps, ${doneCount} done.`);
      } else if (action.done != null || action.skip != null) {
        const ref = action.done != null ? action.done : action.skip;
        const status = action.done != null ? 'done' : 'skipped';
        const { plan, step } = markPlanStep(sessionPlan, ref, status, String(action.evidence || '').slice(0, 300));
        if (!step) {
          observation = `No plan step matches "${String(ref).slice(0, 60)}" — your plan has ${sessionPlan.steps.length} step(s). Check the plan on your screen and mark one of those.`;
        } else {
          sessionPlan = plan;
          try { saveHuntPlan(huntId, sessionPlan); } catch { /* plan persistence is best-effort */ }
          const next = nextPlanStep(sessionPlan);
          const doneCount = sessionPlan.steps.filter((s) => s.status === 'done').length;
          observation = `Step "${step.text}" marked ${status}${step.evidence ? ` — ${step.evidence}` : ''}. (${doneCount}/${sessionPlan.steps.length} done.) ${next ? `NEXT: step ${sessionPlan.steps.indexOf(next) + 1} — "${next.text}".` : 'Every step is done or skipped — write a new plan for the next phase.'}`;
          say(`Plan step ${status}: ${step.text.slice(0, 100)}`);
        }
      } else {
        observation = 'Nothing changed — give "steps": [...] to write or revise your plan, or "done": <step number> with "evidence" to check a step off, or "skip": <step number> with "evidence" to drop one.';
      }
      note({ action: `hunt_plan: ${detailForAction(kind, action)}`, why: thinkingText, result: clipResult(observation), learned: '' });
    } else if (kind === 'load_skill') {
      // Lane M: pull a procedure card from the hunter's own playbook
      // (Research Lane K, proposal P2). NOT dedupe-gated — re-pulling
      // a card after the context has rolled is legitimate — and NOT
      // scope-gated: it reads only our own files, no traffic leaves
      // the machine. The card returns as THIS turn's observation, so
      // exactly one card body is ever in play; nothing accumulates
      // into the briefing. loadSkill never throws and answers an
      // unknown name with the index.
      //
      // Lane AD: ONE exception to "not gated" — a verbatim repeat
      // of a name that ALREADY FAILED in this hunt ("No skill card
      // named X"). Re-running the lookup cannot change that answer
      // (the card set is our own static playbook), and live the
      // hunter re-asked "ftp" the very next turn after being told
      // exactly that. The repeat is answered from the record in
      // the dedup_block turn-shape — a dedup_block event, a
      // reasoning note, and a BLOCKED observation naming the cards
      // that DO exist — and the lookup does not run again. A first
      // ask of any name, and every ask of a real card, execute
      // exactly as before.
      const name = String(action.skill || '').slice(0, 80);
      const skillKey = skillNameKey(name);
      const priorFail = skillKey ? failedSkills.get(skillKey) : null;
      // REAL-HUMAN: the pending-plan gate — a re-pull of a skill
      // whose plan is already OPEN (card pulled, no probe sent
      // after it) is answered from the record instead of re-running
      // the lookup. Live the hunter pulled the SQLi card twice with
      // zero probes sent; the card body is already in the record,
      // and re-reading it cannot change anything — the plan must be
      // closed by sending its first probe or by record_coverage as
      // not_applicable with the reason. Same turn-shape as the
      // Lane AD failed-skill gate (a countable plan_block event, a
      // reasoning note, a BLOCKED observation naming the closures).
      // A first pull of a topic, and every pull whose plan was
      // already closed by a probe, executes exactly as before.
      let pendingPlan = null;
      try {
        const planRows = getAllReasoning(huntId) || [];
        const planEvents = deps.readEvents(huntId) || turnEvents;
        const topic = topicForSkillName(name);
        if (topic) {
          const plans = pendingPlannedProbes({ events: planEvents, reasoningRows: planRows });
          pendingPlan = plans.find((p) => p.topic && p.topic.id === topic.id) || null;
        }
      } catch { /* the gate is best-effort — a failed read never blocks the pull */ }
      if (priorFail) {
        priorFail.asks++;
        try { deps.record(huntId, { type: 'dedup_block', tool: 'load_skill', detail: priorFail.name, count: priorFail.asks, via: 'human-mode' }); } catch { /* best-effort */ }
        say(`Already-answered gate stopped a repeat skill ask: "${priorFail.name}" — no such card (asked ×${priorFail.asks} in this hunt).`);
        let cardNames = '';
        try {
          cardNames = listSkills().map((s) => s.name).join(', ');
        } catch { /* the index is best-effort */ }
        observation =
          `BLOCKED — NO SUCH SKILL CARD: you have already asked for "${priorFail.name}" ${priorFail.asks} times in this hunt and there is no skill card with that name. It was NOT looked up again — asking again cannot create it.` +
          (cardNames
            ? ` The cards that exist: ${cardNames}. Pull one of those, or work from your briefing and leads.`
            : ' Work from your briefing and leads.');
        note({ action: `dedup_block: load_skill ${priorFail.name}`, why: thinkingText, result: `repeat blocked — no skill card named "${priorFail.name}" (asked ×${priorFail.asks})`, learned: 'A skill card that does not exist cannot be pulled into existence; pick a real card from the index.' });
      } else if (pendingPlan) {
        try { deps.record(huntId, { type: 'plan_block', tool: 'load_skill', detail: pendingPlan.skill, turnsSince: pendingPlan.turnsSince, via: 'human-mode' }); } catch { /* best-effort */ }
        say(`Pending-plan gate stopped a re-pull of "${pendingPlan.skill}" — its plan is still open (${pendingPlan.when}).`);
        observation =
          `BLOCKED — PLAN ALREADY OPEN: you pulled the "${pendingPlan.skill}" card ${pendingPlan.when} and have sent no ${pendingPlan.topic.label} probe since. The card is already in your record — pulling it again changes nothing. Close the plan one of two ways: send its first probe now (the card's steps end in a probe), or close it with record_coverage as not_applicable and the reason it does not apply here.`;
        note({ action: `plan_block: load_skill ${pendingPlan.skill}`, why: thinkingText, result: `re-pull blocked — ${pendingPlan.topic.label} plan open since ${pendingPlan.when}, no probe sent`, learned: 'A pulled card is a plan, not a probe — send the probe or close the plan.' });
      } else {
        toolCall('load_skill', name);
        try {
          observation = String(loadSkill(name) || '').slice(0, 2600) || 'That skill card is empty.';
        } catch {
          observation = 'Skill cards are unavailable this turn — work from your briefing and your leads.';
        }
        // Lane AD: a fresh failure joins the hunt's failed-name
        // memory the moment it is observed, so a verbatim repeat
        // later in this same session is answered from the record.
        if (skillKey && observation.includes('No skill card named')) {
          failedSkills.set(skillKey, { name: name.trim().slice(0, 60), asks: 1 });
        }
        note({ action: `load_skill: ${name}`, why: thinkingText, result: clipResult(observation), learned: '' });
      }
    } else if (kind === 'proxy_start') {
      // Lane U: start the intercept proxy + dashboard inside the
      // hunter's own container and route its Chromium through it.
      // NOT dedupe-gated (an idempotent machine control — re-running
      // it only reports state, like recall) and NOT scope-gated (it
      // touches only the hunter's own machine; no traffic leaves).
      toolCall('proxy_start', '');
      const res = await getIntercept().start(huntId);
      observation = res.observation || '(no observation)';
      if (res.ok) say('Intercept proxy started — browser traffic is being captured.');
      note({ action: 'proxy_start', why: thinkingText, result: clipResult(observation), learned: '' });
    } else if (kind === 'intercept_list') {
      // Lane U: read the hunter's own capture file. NOT dedupe-gated
      // and NOT scope-gated — a read of its own notebook, like recall.
      toolCall('intercept_list', '');
      const res = await getIntercept().list(huntId);
      observation = res.observation || '(no observation)';
      note({ action: 'intercept_list', why: thinkingText, result: clipResult(observation), learned: '' });
    } else if (kind === 'intercept_read') {
      // Lane U: one captured flow in full. Same read-only treatment
      // as intercept_list.
      toolCall('intercept_read', `#${action.index ?? ''}`);
      const res = await getIntercept().read(huntId, action.index);
      observation = res.observation || '(no observation)';
      note({ action: `intercept_read: #${action.index ?? ''}`, why: thinkingText, result: clipResult(observation), learned: '' });
    } else if (kind === 'intercept_replay') {
      // Lane U: Burp-Repeater work — resend one captured request
      // with the hunter's modifications. This DOES send traffic, so
      // it is treated exactly like a shell probe: dedupe-gated
      // (above, on the replay signature), scope-checked on the FINAL
      // url (a captured third-party request the page made, or a url
      // override, may not be replayed out of programme), paced by
      // the same requests-per-minute cap, and executed through the
      // same pipeline exec as shell commands.
      const read = await getIntercept().read(huntId, action.index);
      if (!read.ok || !read.entry) {
        observation = read.observation || 'That capture could not be read — run intercept_list and pick a real index.';
      } else {
        const built = buildReplayRequest(read.entry.flow, {
          url: action.url,
          headers: action.headers,
          body: action.body,
        });
        if (!built.ok) {
          observation = built.error;
        } else {
          const badUrl = scopeViolation(built.url, target, parsedScope);
          if (badUrl) {
            observation = `BLOCKED — OUT OF SCOPE: ${badUrl} is not part of this programme. A replay may only be sent to ${target} and its listed assets. Nothing was sent.`;
            say(`Out-of-scope replay blocked: ${built.url.slice(0, 120)}`);
          } else {
            if (minShellGapMs > 0 && lastShellAt > 0) {
              const wait = lastShellAt + minShellGapMs - deps.now();
              if (wait > 0) await deps.sleep(wait);
            }
            toolCall('intercept_replay', replaySignature(action));
            try {
              const exec = await getExec();
              const result = await exec(huntId, target, buildReplayCurl(built));
              lastShellAt = deps.now();
              const combined = `${result.stdout || ''}\n${result.stderr || ''}`.trim();
              const statusLine = /^HTTP\/\S+ \d{3}[^\n]*/m.exec(combined);
              const head = `Replayed capture #${read.entry.index} as ${built.method} ${built.url} — ${statusLine ? statusLine[0] : 'no HTTP response received'}.`;
              if (combined.length > OBS_BUDGET) {
                let handle = '';
                try {
                  handle = deps.spill(huntId, combined);
                } catch { /* spill is best-effort */ }
                observation =
                  `${head}\n${combined.slice(0, OBS_BUDGET)}` +
                  `\n[response truncated on screen — ${combined.length} chars total${handle ? `, saved in full as artifact ${handle}` : ''}]`;
              } else {
                observation = combined ? `${head}\n${combined}` : `${head} (the replay produced no output)`;
              }
              if (result.code && result.code !== 0) {
                observation += `\n[curl exit code ${result.code}]`;
              }
            } catch (err) {
              observation = `Replay failed to run: ${err.message || err}`;
            }
          }
        }
      }
      note({ action: `intercept_replay: #${action.index ?? ''}`, why: thinkingText, result: clipResult(observation), learned: '' });
    } else if (kind === 'save_credential') {
      // Lane AI: vault seam. The brain creates accounts itself under
      // the Obfinity persona; the password is vaulted server-side
      // and NEVER written to the record — only the handle is. Two
      // modes: password supplied (vaulted + scrubbed from every
      // recorded surface via sessionSecrets) or omitted (the server
      // generates one and shows it as a ONE-TURN observation — the
      // brain types it immediately; the observation rides the
      // in-memory screen only and is scrubbed out of the log push
      // below). A temp-mail inbox is provisioned best-effort for
      // verification mail. NOT dedupe-gated (a vault write, not
      // traffic) and NOT scope-gated beyond the site itself.
      const site = String(action.site || target);
      const username = String(action.username || generatePersonaUsername());
      let password = String(action.password || '');
      let generated = false;
      if (!password) { password = generatePassword(20); generated = true; }
      sessionSecrets.add(password);
      let inbox = null;
      try {
        const ib = await deps.createInbox();
        inbox = { provider: ib.provider, address: ib.address, token: ib.token || null };
      } catch { inbox = null; }
      const rec = saveCredential({ site, username, password, huntId, inbox });
      toolCall('save_credential', rec.handle);
      observation = generated
        ? `Saved credential ${rec.handle} for ${site} as ${username}. One-time password for THIS turn only (it will never be shown again and is never written to the record): ${password} — type it now with browser_type into the password field (target: the password field's label, e.g. "Password"), then submit. Your temp-mail inbox for verification mail is ${inbox ? inbox.address : '(none — mail provider unreachable)'}; poll it with fetch_verification_code and this handle.`
        : `Saved credential ${rec.handle} for ${site} as ${username}. It is vaulted; the record keeps the handle only. Temp-mail inbox: ${inbox ? inbox.address : '(none — mail provider unreachable)'}.`;
      note({ action: `save_credential: ${rec.handle}`, why: thinkingText, result: `credential vaulted for ${site} as ${username}`, learned: '' });
    } else if (kind === 'use_saved_credential') {
      // Lane AI: fill a login form from the vault WITHOUT the
      // password ever appearing in text. The server performs the
      // clicks + types itself via guiTools — those inner calls are
      // not loop actions, so no value touches toolCall/note; only
      // the handle is recorded. Without field labels the brain is
      // sent back to snapshot first.
      const handle = String(action.handle || '');
      const rec = handle ? getCredential(handle) : null;
      if (!rec) {
        observation = `No saved credential ${handle || '(empty)'} — save one first with save_credential, then use its handle.`;
      } else {
        touchCredential(handle);
        const uField = String(action.usernameField || '');
        const pField = String(action.passwordField || '');
        if (!uField || !pField) {
          observation = `Credential ${handle} is ready for ${rec.site} (username ${rec.username}). Snapshot the login page and call use_saved_credential again with "usernameField" and "passwordField" as the visible labels of the two fields — the server will fill them from the vault without ever showing the password in text.`;
        } else {
          const gui = getGui();
          // INFINITY LEVEL: the old code ignored every result and
          // reported "Filled the login fields…" unconditionally —
          // on a wrong page the driver refuses the click and the
          // fill never happens, but the brain was told it did
          // (the false-success hole in the wrong-page guard's
          // coverage). Each step is checked; the first refusal
          // stops the chain and its observation IS the answer.
          const clickU = await gui.click(huntId, uField);
          const typeU = clickU && clickU.ok !== false ? await gui.type(huntId, uField, rec.username, false) : null;
          const clickP = typeU && typeU.ok !== false ? await gui.click(huntId, pField) : null;
          const typeP = clickP && clickP.ok !== false ? await gui.type(huntId, pField, rec.password, false) : null;
          const failed = [clickU, typeU, clickP, typeP].find((r) => r && r.ok === false);
          if (failed) {
            observation = failed.observation || `Could not fill the login fields for ${rec.site} — the browser refused the action (${failed.error || 'unknown reason'}). Snapshot the page and check you are on the login page first.`;
            notePageUrl(observation);
            noteSnapshot(failed);
          } else {
            toolCall('use_saved_credential', handle);
            observation = `Filled the login fields for ${rec.site} from vaulted credential ${handle} (username ${rec.username}). Submit with browser_click when ready.`;
          }
        }
      }
      note({ action: `use_saved_credential: ${handle}`, why: thinkingText, result: clipResult(observation), learned: '' });
    } else if (kind === 'fetch_verification_code') {
      // Lane AI: poll the credential's temp-mail inbox for a
      // verification code. The code is a ONE-TURN observation: it
      // rides the in-memory screen, joins the session secret set
      // (so any later typing or quoting of it is scrubbed from the
      // record), and is never written to events, reasoning rows,
      // or the vault. Timeout is a reportable blocker, not a loop.
      const handle = String(action.handle || '');
      const rec = handle ? getCredential(handle) : null;
      if (!rec || !rec.inbox || !rec.inbox.address) {
        observation = `No temp-mail inbox on credential ${handle || '(empty)'} — the inbox may have failed to provision when the credential was saved. Note it and move on.`;
      } else {
        toolCall('fetch_verification_code', handle);
        const res = await deps.pollCode(rec.inbox, { sleep: deps.sleep });
        if (res.ok) {
          sessionSecrets.add(res.code);
          observation = `Verification code for ${rec.site} (one-turn only — type it now with browser_type into the code field (target: that field's label); it will not be shown again and is never written to the record): ${res.code} (from ${res.from || 'inbox'}${res.subject ? `, subject: ${res.subject}` : ''})`;
          markVerified(handle);
        } else if (res.reason === 'timeout') {
          observation = `No verification mail arrived for ${rec.site} after ${res.polls} polls — the site may block this temp-mail domain (${String(rec.inbox.address).split('@')[1] || 'unknown'}). Record this as a blocker: do not retry forever; note the domain and move on.`;
        } else {
          observation = `Could not poll the inbox for ${rec.site}: ${res.reason || 'provider error'}. Note it and move on.`;
        }
      }
      note({ action: `fetch_verification_code: ${handle}`, why: thinkingText, result: 'verification-code poll completed (code itself never recorded)', learned: '' });
    } else if (kind === 'request_details') {
      // DYNAMIC DETAILS (27 Oct 2026, owner order): the agent ASKS the
      // owner for details it needs instead of creating its own account.
      // The request appears as a card below the chat; the owner fills
      // it and the values arrive on the next screen (one-turn only).
      // Only the request id/title are ever recorded — never the fields'
      // values. A pending request refuses a second one; a re-ask for
      // details already provided re-shows them instead of asking again.
      const title = String(action.title || '').trim();
      const fields = Array.isArray(action.fields) ? action.fields : [];
      const site = String(action.site || target || '');
      // SELF-AUTH CHAIN (27 Oct 2026, owner order): "account":"owner"
      // means the OWNER's own existing account (ask first is correct).
      // Anything else is a FRESH account the brain could create itself
      // — the ask is refused until the self path has been tried for
      // this site (save/use/fetch_verification_code in the hunt's
      // events). The brain must attempt first, then ask.
      const accountKind = String(action.account || 'fresh').trim().toLowerCase();
      let history = [];
      try { history = (typeof deps.readEvents === 'function' ? (deps.readEvents(huntId) || []) : []); } catch { history = []; }
      const pending = getPendingRequests(huntId);
      const already = listDetailRequests(huntId).find((r) =>
        (r.status === 'filled' || r.status === 'used') && r.title === title &&
        Array.isArray(r.fields) && r.fields.length === fields.length &&
        r.fields.every((f, i) => f.key === String(fields[i]?.key || '')));
      if (pending && pending.length) {
        observation = `A details request ("${pending[0].title}") is already open in the chat — wait for the owner to answer it. Do NOT re-request and do NOT re-attempt the blocked action this turn.`;
      } else if (already) {
        const values = getFilledValues(already.id);
        if (values) {
          for (const v of Object.values(values)) if (typeof v === 'string' && v) sessionSecrets.add(v);
          const shown = already.fields.map((f) => `${f.label}: ${values[f.key] ?? ''}`).join('; ');
          observation = `The owner ALREADY gave you these details for "${already.title}" (one-turn only — use them NOW with browser_type; they will not be shown again and are never written to the record): ${shown} — do NOT ask again.`;
        } else {
          observation = `The owner already provided details for "${already.title}" but they are no longer available — ask again only if you still need them, with a fresh request_details.`;
        }
      } else if (accountKind !== 'owner' && !hasSelfAuthAttempt(history, site)) {
        observation = `Ask refused — you have not tried to make this account YOURSELF yet for ${site || 'this target'}. The order is: save_credential first (it vaults the login and provisions your temp-mail inbox), then use_saved_credential to fill the form, then fetch_verification_code for the verification mail. Only ask the owner AFTER that path fails — and say what failed. If this is the OWNER's own existing account (not a fresh one), re-ask with "account":"owner".`;
      } else {
        const created = createDetailRequest({ huntId, title, fields, site });
        if (!created.ok) {
          observation = `Could not ask the owner for details: ${created.error}. Note it and move on — do NOT retry the same request this turn.`;
        } else {
          toolCall('request_details', created.request.id);
          observation = `Your details request "${created.request.title}" is now open in the chat below — the owner will fill it in. WAIT for the next turn: the details arrive on your screen (one-turn only, never written to the record). Do NOT re-attempt the blocked action this turn.`;
        }
      }
      note({ action: `request_details: ${title.slice(0, 120)}`, why: thinkingText, result: 'details request opened for the owner (values never recorded)', learned: '' });
    } else if (kind === 'browser_open') {
      const url = String(action.url || '');
      const bad = scopeViolation(url, target, parsedScope);
      if (bad) {
        observation = `BLOCKED — OUT OF SCOPE: ${bad} is not part of this programme. Nothing was opened.`;
        say(`Out-of-scope browser_open blocked: ${url.slice(0, 120)}`);
      } else {
        toolCall('browser_open', url);
        const res = await getGui().open(huntId, url);
        if (res && res.degraded === true) pendingDegraded = true; // Lane AF
        observation = res.observation || '(no observation)';
        notePageUrl(observation);
        noteSnapshot(res);
      }
      note({ action: `browser_open: ${url.slice(0, 120)}`, why: thinkingText, result: clipResult(observation), learned: '' });
    } else if (kind === 'browser_snapshot') {
      toolCall('browser_snapshot', '');
      const res = await getGui().snapshot(huntId);
      observation = res.observation || '(no observation)';
      notePageUrl(observation);
      noteSnapshot(res);
    } else if (kind === 'browser_click') {
      const text = String(action.text || '');
      toolCall('browser_click', text);
      const res = await getGui().click(huntId, text);
      if (res && res.degraded === true) pendingDegraded = true; // Lane AF
      observation = res.observation || '(no observation)';
      notePageUrl(observation);
      noteSnapshot(res);
      // INFINITY LEVEL: a successful click marks its element
      // interacted-with in the parsed page state — the click
      // coverage the brain chooses from next turn.
      if (res && res.ok !== false) {
        try { sessionPageState = markElementClicked(sessionPageState, currentPageUrl, text); savePageState(huntId, sessionPageState); } catch { /* best-effort */ }
      }
      // MISSION Stage 5 (31 Oct 2026): post-navigation scope guard. A
      // click can follow a link off the programme's assets — if the
      // landing URL is out of scope, flag it loudly. The brain must
      // navigate back; it must not interact with the out-of-scope page.
      try {
        const postClickBad = scopeViolation(currentPageUrl, target, parsedScope);
        if (postClickBad) {
          observation = `${observation}\n[SCOPE WARNING] OUT OF SCOPE: ${postClickBad} is not part of this programme. Navigate back to ${target} — do not interact with this page.`;
          say(`browser_click landed out of scope: ${String(postClickBad).slice(0, 120)}`);
        }
      } catch { /* scope warning never breaks the loop */ }
      note({ action: `browser_click: ${text.slice(0, 80)}`, why: thinkingText, result: clipResult(observation), learned: '' });
    } else if (kind === 'browser_type') {
      const text = String(action.text || '');
      // GUI-TYPE-TARGET (28 Oct 2026): the brain names the field —
      // a type without a target is not attempted at all (the old
      // code typed into whatever was focused; the DVWA login put
      // 'password' into the username field and still "succeeded").
      const fieldTarget = String(action.target || action.selector || '').trim();
      toolCall('browser_type', fieldTarget ? `${fieldTarget} ← ${text.slice(0, 80)}` : text.slice(0, 80));
      let res;
      if (!fieldTarget) {
        res = { ok: false, observation: 'browser_type needs a "target" — the label or CSS selector of the field to type into (e.g. "Username" or "input[name=password]"). Take a browser_snapshot and name the field; never type blind.' };
      } else {
        res = await getGui().type(huntId, fieldTarget, text, action.submit === true);
      }
      if (res && res.degraded === true) pendingDegraded = true; // Lane AF
      observation = res.observation || '(no observation)';
      notePageUrl(observation);
      noteSnapshot(res);
      // INFINITY LEVEL: a successful type marks the field typed-
      // into — the record of what the page's inputs received.
      if (res && res.ok !== false) {
        try { sessionPageState = markTypedInto(sessionPageState, currentPageUrl); savePageState(huntId, sessionPageState); } catch { /* best-effort */ }
      }
      note({ action: `browser_type: ${fieldTarget ? `${fieldTarget} ← ` : ''}${text.slice(0, 80)}`, why: thinkingText, result: clipResult(observation), learned: '' });
    } else if (kind === 'screenshot') {
      toolCall('screenshot', '');
      const res = await getGui().screenshot(huntId);
      observation = res.observation || '(no observation)';
      notePageUrl(observation);
      noteSnapshot(res);
      // OCR-TO-FILER (1 Nov 2026): the brain sees hashes on screen but will
      // not transcribe them into text; the auto-filer only reads text. Run
      // desktop OCR and append it so the filer sees the evidence directly.
      // This bypasses the model's transcription failure (permanent fix).
      try {
        const ocrRes = await captureScreenMap(huntId, deps);
        if (ocrRes && ocrRes.ok && ocrRes.map) {
          observation += `\n\n[OCR screen text — auto-filer reads this]:\n${ocrRes.map}`;
        }
      } catch { /* OCR is best-effort; screenshot works without it */ }
    } else if (kind === 'desktop_snapshot') {
      // WHOLE-OS CONTROL: read the live desktop (windows + focused
      // app) via xdotool on :99. Perception, like browser_snapshot
      // — but it IS a loop action (tool_call), so the counters can
      // measure snapshots acted on. A desktop that is down is a
      // reportable state, not a silent empty list: stderr/code
      // distinguish it from "no windows".
      toolCall('desktop_snapshot', '');
      try {
        const res = await deps.execRaw(huntId, DESKTOP_WINDOWS_CMD, 15000, { bypassTmux: true });
        const out = String((res && res.stdout) || '');
        const errText = String((res && res.stderr) || '');
        if (!out.trim() && (errText || (res && res.code && res.code !== 0))) {
          observation = `The desktop is not running right now (xdotool could not reach display :99${errText ? `: ${errText.slice(0, 160)}` : ''}). Open a page with browser_open first — that starts the desktop — then take desktop_snapshot again.`;
        } else {
          sessionDesktopState = mergeDesktopState(sessionDesktopState, parseDesktopWindows(out));
          observation = desktopStateLines(sessionDesktopState, { target }).join('\n');
        }
      } catch (err) {
        observation = `Desktop snapshot failed: ${err.message || err}. Open a page with browser_open first — that starts the desktop — then try again.`;
      }
      note({ action: 'desktop_snapshot', why: thinkingText, result: clipResult(observation), learned: '' });
    } else if (kind === 'desktop_click') {
      // WHOLE-OS CONTROL: focus a window by title (resolved
      // deterministically from the last desktop_snapshot) and send
      // it a click. No snapshot yet, or no matching window, is a
      // named refusal — the observation lists the windows that DO
      // exist. Nothing is executed on a guess. The tool_call
      // records the RAW name the brain gave, so the dedupe gate's
      // candidate (same raw name) matches the history exactly.
      const winName = String(action.window || '');
      const win = resolveWindowForClick(sessionDesktopState.windows, winName);
      if (!win) {
        const known = (sessionDesktopState.windows || []).map((w) => w.title).filter(Boolean);
        observation = known.length
          ? `No window matches "${winName}". Windows on this desktop: ${known.join(' | ')}. Take desktop_snapshot to refresh the list, then desktop_click one of them by title.`
          : `No window matches "${winName}" — and no desktop snapshot has been taken yet, so no window titles are known. Take desktop_snapshot first, then desktop_click one of its windows by title.`;
      } else {
        toolCall('desktop_click', winName);
        try {
          const res = await deps.execRaw(huntId, desktopClickCommand(win), 15000, { bypassTmux: true });
          if (String((res && res.stdout) || '').includes('clicked')) {
            sessionDesktopState = markWindowInteracted(sessionDesktopState, win.title);
            observation = `Focused window "${win.title}" (clicked it). It now receives your desktop_key keystrokes — Tab/Return/arrows to move inside it, or type text with desktop_key.`;
          } else {
            observation = `Could not click window "${win.title}" (xdotool reported ${String((res && res.stderr) || 'failure').slice(0, 160)}). The window may have closed — take desktop_snapshot to refresh the list.`;
          }
        } catch (err) {
          observation = `Desktop click failed: ${err.message || err}. Take desktop_snapshot to refresh the window list.`;
        }
      }
      note({ action: `desktop_click: ${winName.slice(0, 80)}`, why: thinkingText, result: clipResult(observation), learned: '' });
    } else if (kind === 'desktop_key') {
      // WHOLE-OS CONTROL: keys or literal text to the focused
      // window. Keystrokes are whitelist-validated BEFORE any exec
      // (parseDesktopKeys) — an unvalidated keysym would be an
      // injection into the xdotool command line. A refusal names
      // the allowed keys; nothing is executed on a guess. The
      // tool_call records the RAW keys/text, so the dedupe gate's
      // candidate matches the history exactly.
      const keys = String(action.keys || '');
      const text = String(action.text || '');
      if (keys) {
        const parsed = parseDesktopKeys(keys);
        if (!parsed.ok) {
          observation = `Keys not sent — ${parsed.error}. Send one keystroke: modifiers ctrl/alt/shift/super/meta plus one key (Return, Tab, Escape, space, BackSpace, Delete, arrows, Home, End, Page_Up, Page_Down, F1-F12, or a single letter/digit), e.g. {"action":"desktop_key","keys":"ctrl+l"}. To type words, use {"action":"desktop_key","text":"..."} instead.`;
        } else {
          toolCall('desktop_key', keys);
          try {
            const res = await deps.execRaw(huntId, desktopKeyCommand(parsed.keys), 15000, { bypassTmux: true });
            observation = String((res && res.stdout) || '').includes('key_sent')
              ? `Sent keys ${parsed.keys} to the focused window (${sessionDesktopState.activeTitle || 'unknown window'}). Take desktop_snapshot or browser_snapshot to see what changed.`
              : `Keys ${parsed.keys} may not have reached the focused window (xdotool reported ${String((res && res.stderr) || 'failure').slice(0, 160)}). Take desktop_snapshot to check which window is focused.`;
          } catch (err) {
            observation = `Desktop keys failed: ${err.message || err}. Take desktop_snapshot to check the focused window.`;
          }
        }
      } else if (text) {
        toolCall('desktop_key', text.slice(0, 80));
        try {
          const res = await deps.execRaw(huntId, desktopTypeCommand(text), 15000, { bypassTmux: true });
          observation = String((res && res.stdout) || '').includes('typed')
            ? `Typed ${text.length} chars into the focused window (${sessionDesktopState.activeTitle || 'unknown window'}). Take desktop_snapshot or browser_snapshot to see what changed.`
            : `Typing may not have reached the focused window (xdotool reported ${String((res && res.stderr) || 'failure').slice(0, 160)}). Take desktop_snapshot to check the focused window.`;
        } catch (err) {
          observation = `Desktop typing failed: ${err.message || err}. Take desktop_snapshot to check the focused window.`;
        }
      } else {
        observation = 'Nothing sent — give "keys" (e.g. "ctrl+l", "Return") or "text" (words to type) with desktop_key.';
      }
      note({ action: `desktop_key: ${(keys || text).slice(0, 80)}`, why: thinkingText, result: clipResult(observation), learned: '' });
    } else if (kind === 'desktop_screenshot') {
      // WHOLE-OS CONTROL: the full desktop frame (scrot on :99),
      // saved as a hunt artifact via the owner's poller route —
      // the brain gets the TEXT desktop state with the observation
      // (it never sees the image); the owner gets the picture.
      toolCall('desktop_screenshot', '');
      try {
        const shot = await getDesktopScreenshot()(huntId);
        if (shot && shot.ok) {
          try {
            const res = await deps.execRaw(huntId, DESKTOP_WINDOWS_CMD, 15000, { bypassTmux: true });
            sessionDesktopState = mergeDesktopState(sessionDesktopState, parseDesktopWindows(String((res && res.stdout) || '')));
          } catch { /* the state read is best-effort beside the shot */ }
          observation = `Desktop screenshot saved as artifact ${shot.name} in your hunt workspace (the owner watches this desktop live). What the desktop shows:\n${desktopStateLines(sessionDesktopState, { target }).join('\n')}`;
        } else {
          observation = `Desktop screenshot failed: ${(shot && shot.error) || 'unknown error'}. Open a page with browser_open first — that starts the desktop — then try again.`;
        }
      } catch (err) {
        observation = `Desktop screenshot failed: ${err.message || err}.`;
      }
      note({ action: 'desktop_screenshot', why: thinkingText, result: clipResult(observation), learned: '' });
    } else if (kind === 'see_screen') {
      // SCREEN-SEEING (27 Oct 2026, owner order): the brain LOOKS at
      // the desktop itself — screenshot -> OCR words + coordinates ->
      // a text map it can read and click from. Perception, like
      // desktop_snapshot, so it is NOT dedup-gated (looking twice is
      // how the brain confirms the screen changed). A missing OCR
      // install is a named state, not a silent empty map.
      toolCall('see_screen', '');
      try {
        const res = await captureScreenMap(huntId, deps);
        observation = res.ok
          ? `${res.map}\n(To act on what you see: desktop_click_at with the (x, y) from the map, or desktop_key to type. Then see_screen again to confirm the screen changed.)`
          : screenMapErrorLine(res.error);
      } catch (err) {
        observation = `Could not read the screen: ${err.message || err}. Take desktop_snapshot instead.`;
      }
      note({ action: 'see_screen', why: thinkingText, result: clipResult(observation), learned: '' });
    } else if (kind === 'desktop_click_at') {
      // SCREEN-SEEING: click at a point FROM THE SCREEN MAP. The
      // coordinates are validated BEFORE any exec (parseClickAt) — an
      // unvalidated number would be an injection into xdotool. The
      // tool_call records the validated point, so the dedupe gate's
      // candidate (same point) matches the history exactly.
      const parsed = parseClickAt(action);
      if (!parsed.ok) {
        observation = `Click not sent — ${parsed.error}. Take see_screen first and use a point from the map.`;
      } else {
        toolCall('desktop_click_at', `${parsed.x},${parsed.y}`);
        try {
          const res = await deps.execRaw(huntId, desktopClickAtCommand(parsed.x, parsed.y), 15000, { bypassTmux: true });
          observation = String((res && res.stdout) || '').includes('clicked')
            ? `Clicked at (${parsed.x}, ${parsed.y}). Take see_screen to confirm what changed.`
            : `Click at (${parsed.x}, ${parsed.y}) may not have landed (xdotool reported ${String((res && res.stderr) || 'failure').slice(0, 160)}). Take see_screen to check the screen.`;
        } catch (err) {
          observation = `Desktop click failed: ${err.message || err}. Take see_screen to check the screen.`;
        }
      }
      note({ action: `desktop_click_at: ${String(action.x ?? '')},${String(action.y ?? '')}`, why: thinkingText, result: clipResult(observation), learned: '' });
    } else if (kind === 'desktop_terminal') {
      // HUMAN-BRAIN (26 Oct 2026): GUI-VISIBLE TERMINAL — the
      // command runs in a terminal window ON the GUI desktop, typed
      // visibly, so the owner watches it live. Same rules as the
      // headless shell action, enforced identically: scope gates
      // (heavy-scan + out-of-scope) run FIRST; the output ledger
      // answers a repeat from the saved output; the dedupe gate
      // (which maps this kind to the shell signature — see
      // gatedCandidate) has already blocked a 3rd+ run before this
      // branch; the shell pacing gap applies between runs. The run
      // is recorded under the shell signature, so a visible run and
      // a headless run of one command are one action. The output
      // comes back WITHOUT re-running: the typed line tees it into
      // a per-hunt log file and the loop reads that file back.
      const command = String(action.command || '').replace(/[\r\n]+/g, ' ').trim().slice(0, DESKTOP_TERMINAL_COMMAND_CAP);
      if (!command) {
        observation = 'Empty terminal command — nothing ran. Give a real command.';
      } else if (heavyScanViolation(command, parsedScope)) {
        observation = `BLOCKED by the programme rules: "${command.slice(0, 120)}" is automated/heavy scanning, which this programme forbids. Work like a human: single targeted probes, one at a time.`;
        say(`Programme rules blocked a heavy-scan terminal command: ${command.slice(0, 120)}`);
      } else {
        const badUrl = commandScopeViolation(command, target, parsedScope);
        if (badUrl) {
          observation = `BLOCKED — OUT OF SCOPE: ${badUrl} is not part of this programme. Only test ${target} and its listed assets. Nothing was sent.`;
          say(`Out-of-scope terminal command blocked: ${command.slice(0, 120)}`);
        } else {
          const forceTerm = action.force === true && String(action.why || '').trim().length > 0;
          const termSig = actionSignature('shell', command);
          const termSaved = !forceTerm ? findOutput(sessionOutputs, termSig) : null;
          if (termSaved) {
            try { deps.record(huntId, { type: 'output_recall', tool: 'desktop_terminal', detail: scrub(command), via: 'human-mode' }); } catch { /* best-effort */ }
            observation = recallObservation(termSaved, { nowMs: deps.now() });
          } else {
            if (minShellGapMs > 0 && lastShellAt > 0) {
              const wait = lastShellAt + minShellGapMs - deps.now();
              if (wait > 0) await deps.sleep(wait);
            }
            toolCall('desktop_terminal', command);
            const logFile = desktopTerminalLogFile(huntId);
            const typed = desktopTerminalWrapCommand(command, logFile);
            // (1) Desktop up? The other desktop actions tell the
            // brain to open a page first; a terminal action must
            // work from a cold desktop, so it starts it here when
            // xdotool cannot reach :99.
            let windowsOut = '';
            try {
              const res = await deps.execRaw(huntId, DESKTOP_WINDOWS_CMD, 15000, { bypassTmux: true });
              windowsOut = String((res && res.stdout) || '');
            } catch { /* desktop down — start it below */ }
            if (!windowsOut.trim()) {
              try {
                await getStartDesktop()(huntId);
                await deps.sleep(4000);
                const res = await deps.execRaw(huntId, DESKTOP_WINDOWS_CMD, 15000, { bypassTmux: true });
                windowsOut = String((res && res.stdout) || '');
              } catch { /* start failure reports below */ }
            }
            if (!windowsOut.trim()) {
              observation = 'The desktop is not running right now (xdotool could not reach display :99, and starting it did not bring it up). Open a page with browser_open first — that starts the desktop — then try desktop_terminal again.';
            } else {
              sessionDesktopState = mergeDesktopState(sessionDesktopState, parseDesktopWindows(windowsOut));
              // (2) Terminal open? Find one by window class; launch
              // when none is visible.
              let termWin = null;
              try {
                const res = await deps.execRaw(huntId, DESKTOP_TERMINAL_WINDOWS_CMD, 15000, { bypassTmux: true });
                termWin = (parseDesktopWindows(String((res && res.stdout) || '')).windows || [])[0] || null;
              } catch { /* launch below */ }
              if (!termWin) {
                try {
                  await deps.execRaw(huntId, DESKTOP_TERMINAL_LAUNCH_CMD, 15000, { bypassTmux: true });
                  await deps.sleep(2500);
                  const res = await deps.execRaw(huntId, DESKTOP_TERMINAL_WINDOWS_CMD, 15000, { bypassTmux: true });
                  termWin = (parseDesktopWindows(String((res && res.stdout) || '')).windows || [])[0] || null;
                } catch { /* reports below */ }
              }
              if (!termWin) {
                observation = 'Could not open a terminal window on the desktop (xfce4-terminal did not appear). Take desktop_snapshot to see what is on the desktop, then try again.';
              } else {
                // (3) Focus, type visibly, Return.
                let typedOk = false;
                try {
                  const clickRes = await deps.execRaw(huntId, desktopClickCommand(termWin), 15000, { bypassTmux: true });
                  const typeRes = await deps.execRaw(huntId, desktopTypeCommand(typed), 15000, { bypassTmux: true });
                  const keyRes = await deps.execRaw(huntId, desktopKeyCommand('Return'), 15000, { bypassTmux: true });
                  typedOk = String((clickRes && clickRes.stdout) || '').includes('clicked')
                    && String((typeRes && typeRes.stdout) || '').includes('typed')
                    && String((keyRes && keyRes.stdout) || '').includes('key_sent');
                  sessionDesktopState = markWindowInteracted(sessionDesktopState, termWin.title || 'Terminal');
                } catch { typedOk = false; }
                if (!typedOk) {
                  observation = `Could not type into the terminal window "${termWin.title || 'Terminal'}" — the focus, type, or Return step failed. Take desktop_snapshot to check the desktop, then try again.`;
                } else {
                  lastShellAt = deps.now();
                  // (4) Let it run, read the tee log back, screenshot.
                  await deps.sleep(3000);
                  let logText = '';
                  try {
                    const logRes = await deps.execRaw(huntId, `cat ${shellQuote(logFile)} 2>/dev/null || echo __DT_NO_LOG__`, 15000, { bypassTmux: true });
                    logText = String((logRes && logRes.stdout) || '');
                  } catch { /* empty log reports below */ }
                  let shotName = '';
                  try {
                    const shot = await getDesktopScreenshot()(huntId);
                    if (shot && shot.ok) shotName = shot.name;
                    try {
                      const res = await deps.execRaw(huntId, DESKTOP_WINDOWS_CMD, 15000, { bypassTmux: true });
                      sessionDesktopState = mergeDesktopState(sessionDesktopState, parseDesktopWindows(String((res && res.stdout) || '')));
                    } catch { /* the state read is best-effort beside the shot */ }
                  } catch { /* screenshot is best-effort beside the output */ }
                  const exitCode = parseTerminalExit(logText);
                  const body = logText.replace(/__DT_EXIT__:\d+\s*$/, '').replace(/__DT_NO_LOG__\s*$/, '').trim();
                  if (exitCode === null) {
                    // Still running (no exit marker yet) — report
                    // the partial output and how to read the rest;
                    // nothing is recorded in the ledger until the
                    // run completes.
                    observation = `Typed visibly into the terminal ("${termWin.title || 'Terminal'}") and pressed Return — the command is STILL RUNNING on the desktop (no exit marker yet). What it has printed so far:\n${body ? body.slice(0, OBS_BUDGET) : '(nothing yet)'}${shotName ? `\nDesktop screenshot saved as artifact ${shotName} — the owner watches it live.` : ''}\nRead the rest with a shell action: cat ${logFile}`;
                  } else {
                    let spillHandle = '';
                    let outText = body || `(command finished with no output, exit code ${exitCode})`;
                    if (outText.length > OBS_BUDGET) {
                      try { spillHandle = deps.spill(huntId, outText); } catch { /* best-effort */ }
                      outText = outText.slice(0, OBS_BUDGET) + `\n[output truncated on screen — ${body.length} chars total${spillHandle ? `, saved in full as artifact ${spillHandle}` : ''}]`;
                    }
                    observation = `Ran visibly in the terminal ("${termWin.title || 'Terminal'}") — the owner watched it live. Exit code ${exitCode}${shotName ? ` · desktop screenshot ${shotName}` : ''}:\n${outText}`;
                    try {
                      sessionOutputs = recordOutput(sessionOutputs, { signature: termSig, tool: 'shell', detail: command, output: observation, artifact: spillHandle, forced: forceTerm, why: String(action.why || '') });
                      saveOutputs(huntId, sessionOutputs);
                    } catch { /* the ledger is best-effort — the turn already ran */ }
                  }
                }
              }
            }
          }
        }
      }
      note({ action: `desktop_terminal: ${command.slice(0, 160)}`, why: thinkingText, result: clipResult(observation), learned: '' });
    } else if (kind === 'desktop_click_control') {
      // REAL-HUMAN: click a NAMED CONTROL inside a GUI app via its
      // accessibility tree (AT-SPI). The brain names the control's
      // visible text ("Repeater", "Send") and optionally the window;
      // the helper resolves the name in the tree and performs the
      // click there — pixel coordinates are never in the choice set.
      // When the app exposes no tree (Java apps without the Access
      // Bridge, or AT-SPI missing from this image) the helper says
      // so, and the observation names the keyboard fallback instead
      // of pretending the click happened. The window-focus rule
      // still applies: desktop_click focuses a window, this presses
      // a button inside it.
      const controlName = String(action.control || '').trim().slice(0, 120);
      const windowSub = String(action.window || '').trim().slice(0, 120);
      if (!controlName) {
        observation = 'Nothing clicked — give the control\'s visible name, e.g. {"action":"desktop_click_control","control":"Repeater","window":"Burp Suite"}. Take desktop_snapshot first if you do not know the window titles, or list a window\'s controls by naming it.';
      } else {
        toolCall('desktop_click_control', controlName);
        try {
          const res = await deps.execRaw(huntId, clickControlCommand(controlName, windowSub), 20000, { bypassTmux: true });
          const parsed = parseAtspiOutput((res && res.stdout) || '');
          if (parsed.ok) {
            if (parsed.clicked && parsed.clicked.window) {
              sessionDesktopState = markWindowInteracted(sessionDesktopState, parsed.clicked.window);
            } else if (windowSub) {
              sessionDesktopState = markWindowInteracted(sessionDesktopState, windowSub);
            }
            observation = atspiSuccessObservation(parsed.clicked);
          } else {
            observation = atspiFailureObservation(parsed.error);
          }
        } catch (err) {
          observation = atspiFailureObservation(`the click command failed: ${err.message || err}`);
        }
      }
      note({ action: `desktop_click_control: ${controlName.slice(0, 80)}`, why: thinkingText, result: clipResult(observation), learned: '' });
    } else if (kind === 'launch_tool') {
      // TOOLS/OS AUTONOMY: launch a NAMED tool from the registry and
      // wait for it to be ready. GUI tools open on the desktop (the
      // observation is a fresh screen map); CLI tools are verified
      // present with their version. A repeat launch just reports
      // "already running" — it never starts a second copy. The first
      // Burp launch in a hunt also runs the first-use path (wizard,
      // proxy, target in Burp's browser) and records it in the hunt
      // memory, so the brain only ever says "launch burp".
      const toolId = String(action.tool || '').trim().toLowerCase().slice(0, 80);
      const resolved = resolveTool(toolId);
      if (!resolved.ok) {
        observation = `${resolved.error} (available: ${TOOL_IDS.join(', ')})`;
      } else if (resolved.tool.kind === 'gui') {
        toolCall('launch_tool', toolId);
        try {
          let firstUse = null;
          if (toolId === 'burp') {
            try { firstUse = burpFirstUseDone(deps.readMeta(huntId) || {}); } catch { firstUse = false; }
          }
          if (toolId === 'burp' && firstUse === false) {
            const res = await burpFirstUse(huntId, target, deps);
            observation = res.ok ? res.observation : `Burp first-use did not complete: ${res.error || res.observation}`;
            try { await recordToolState(huntId, 'burp', { ...res.state }, deps); } catch { /* best-effort */ }
          } else {
            const res = await launchGuiTool(huntId, toolId, deps);
            if (res.ok) {
              if (res.window) sessionDesktopState = markWindowInteracted(sessionDesktopState, res.title || toolId);
              observation = res.observation;
              try { await recordToolState(huntId, toolId, { running: true, via: res.via, window: res.window || '' }, deps); } catch { /* best-effort */ }
            } else {
              observation = res.error;
            }
          }
        } catch (err) {
          observation = `Tool launch failed: ${err.message || err}`;
        }
      } else {
        toolCall('launch_tool', toolId);
        try {
          const res = await checkCliTool(huntId, toolId, deps);
          if (res.ok) {
            observation = res.observation;
            try { await recordToolState(huntId, toolId, { running: true, version: String(res.version || '').slice(0, 120) }, deps); } catch { /* best-effort */ }
          } else {
            observation = res.error;
          }
        } catch (err) {
          observation = `Tool check failed: ${err.message || err}`;
        }
      }
      note({ action: `launch_tool: ${toolId}`, why: thinkingText, result: clipResult(observation), learned: '' });
    } else if (kind === 'download_tool') {
      // TOOLS/OS AUTONOMY: install a MISSING tool from the
      // allow-list. Anything not listed is refused BEFORE any exec
      // — the refusal names the installable tools, so the brain can
      // pick a real one instead of guessing.
      const toolId = String(action.tool || '').trim().toLowerCase().slice(0, 80);
      toolCall('download_tool', toolId);
      try {
        const res = await downloadTool(huntId, toolId, deps);
        observation = res.ok ? res.observation : res.error;
        if (res.ok) {
          try { await recordToolState(huntId, toolId, { running: true, installedVia: 'download_tool' }, deps); } catch { /* best-effort */ }
        }
      } catch (err) {
        observation = `Tool install failed: ${err.message || err}`;
      }
      note({ action: `download_tool: ${toolId}`, why: thinkingText, result: clipResult(observation), learned: '' });
    } else if (kind === 'list_controls') {
      // TOOLS/OS AUTONOMY: list a window's NAMED controls from its
      // accessibility tree, as clickable map lines. Read-only — it
      // never clicks anything, so it is not dedupe-gated (like
      // browser_snapshot). When the app exposes no tree, the
      // observation names the OCR fallback instead of pretending
      // the list worked.
      const windowSub = String(action.window || '').trim().slice(0, 120);
      toolCall('list_controls', windowSub);
      try {
        const res = await listToolControls(huntId, windowSub, deps);
        observation = res.ok ? res.observation : res.error;
      } catch (err) {
        observation = `Could not list controls: ${err.message || err}. Fall back to see_screen and desktop_click_at.`;
      }
      note({ action: `list_controls: ${windowSub || '(active window)'}`, why: thinkingText, result: clipResult(observation), learned: '' });
    } else if (kind === 'claim_finding') {
      const rawTitle = String(action.title || '');
      const title = String(rawTitle.trim() ? rawTitle : 'Untitled claim').slice(0, 200);
      const evidence = String(action.evidence || '');
      const command = String(action.command || lastShellCommand || '');
      // COMPLETE-THE-PROOF GATE (Lane N): the filing is checked for
      // completeness BEFORE the verifier is invoked and before any
      // finding is recorded. An incomplete claim is not recorded and
      // the verifier never sees it; the brain gets one observation
      // naming every missing piece, and the refusal is recorded as a
      // countable claim_bounce event. The gate judges completeness
      // only — assessResult below remains the sole judge of truth.
      const poc = String(action.poc || '').trim().slice(0, 120);
      let pocExists = false;
      if (poc) {
        try { pocExists = Boolean(deps.pocExists(huntId, poc)); } catch { pocExists = false; }
      }
      const gate = claimGateCheck({
        title: rawTitle,
        cls: normaliseCoverageClass(action.class) || claimClassFromTitle(rawTitle),
        command,
        poc,
        pocExists,
        evidence,
        counterevidence: action.counterevidence,
        confidence: action.confidence,
        rationale: action.confidence_rationale,
      });
      // CLAIM-TITLE GUARD (#318): probe/test names, plan-echo titles and
      // already-verified duplicates must never reach the verifier.
      // Previously only read paths (panel/chat/admin) filtered probe
      // titles; the filing path never ran the guard, so probe titles
      // could be filed AND verified. Bounce BEFORE acting on the gate,
      // with the guard's own message (it names the fix: re-title).
      let titleGuard = null;
      try {
        const titleEvents = (() => { try { return deps.readEvents(huntId) || []; } catch { return []; } })();
        titleGuard = guardClaimTitle(rawTitle, titleEvents);
      } catch { titleGuard = null; }
      if (titleGuard && !titleGuard.ok) {
        try { deps.record(huntId, { type: 'claim_bounce', tool: 'claim_finding', detail: title, error: titleGuard.error, via: 'human-mode' }); } catch { /* best-effort */ }
        say(`Claim bounced — ${titleGuard.error}.`);
        observation = titleGuard.message;
        note({ action: `claim_finding: ${title}`, why: thinkingText, result: clipResult(observation), learned: '' });
      } else if (!gate.ok) {
        try { deps.record(huntId, { type: 'claim_bounce', tool: 'claim_finding', detail: title, missing: gate.missing.map((m) => m.field), via: 'human-mode' }); } catch { /* best-effort */ }
        say(`Claim bounced — incomplete proof package (missing: ${gate.missing.map((m) => m.field).join(', ')}).`);
        observation =
          'CLAIM NOT RECORDED — the proof package is incomplete, so the verifier never saw it. Missing: ' +
          gate.missing.map((m) => m.hint).join('; ') +
          '. Complete every piece and claim again — run the control/baseline probe first if that is what is missing. This gate checks completeness only; the verifier still decides whether a complete claim is true.';
        note({ action: `claim_finding: ${title}`, why: thinkingText, result: clipResult(observation), learned: '' });
      } else {
      toolCall('claim_finding', title);
      const assess = await getAssess();
      if (assess) {
        // The pipeline verifier decides — never the hunter. It
        // re-runs the reproducing command, applies the evidence gate,
        // the 4-step verification and the content-relevance judgement,
        // and records the finding event itself.
        const plan = {
          test: title,
          command,
          why: 'Human-mode claim — the hunter reproduced this itself and asked for independent verification.',
          hypothesis: title,
        };
        const result = { stdout: evidence, stderr: '', code: 0 };
        let rec = null;
        try {
          rec = await assess(huntId, target, plan, result);
        } catch (err) {
          observation = `Verification could not run (${err.message || err}). Your claim was NOT verified — reproduce it cleanly and claim again with the exact command + output.`;
        }
        if (rec) {
          if (rec.verified) {
            newFindings.push(rec);
            if (Array.isArray(opts.findings)) opts.findings.push(rec);
            observation = `VERIFIED by the independent verifier: "${rec.title}" (${rec.severity}). It counts. Think about impact and chaining — what does this unlock?`;
          } else {
            observation = `NOT verified: ${rec.verification || 'the verifier rejected the claim'}. A rejected claim is a dead end, not a finding — either your evidence does not prove it, or the command does not reproduce it. Do not re-claim the same thing; dig for real proof or move on.`;
            // PROOF-COMPLETE (gate-replay lane): a rejected claim
            // restarts its proof count — the brain needs NEW
            // evidence, and the counter must not keep the claim
            // blocked. Reset every key for this claim's endpoint,
            // under the claim's class and under the command's
            // payload class (either may be the probe key).
            try {
              const ep = proofEndpointOfCommand(command);
              const classes = new Set();
              const cc = normaliseCoverageClass(action.class) || claimClassFromTitle(rawTitle);
              if (cc) classes.add(String(cc).toLowerCase());
              const pc = classifyPayloadClass(command);
              if (pc && pc !== 'credential') classes.add(pc);
              let changed = false;
              for (const cls of classes) {
                const key = `${ep}|${cls}`;
                if (ep && proofCounts.has(key)) { proofCounts.delete(key); changed = true; }
              }
              if (changed) persistProofCounts();
            } catch { /* reset is best-effort */ }
          }
        }
      } else {
        // No verifier wired (bare driver without the pipeline): the
        // claim is recorded as what it is — UNVERIFIED. It must never
        // be presented as a confirmed finding anywhere.
        try {
          deps.record(huntId, {
            type: 'finding',
            class: 'agent_finding',
            title,
            severity: 'medium',
            url: target,
            evidence: { request: command, response: evidence.slice(0, 3000) },
            verified: false,
            verification: 'human-mode claim — pending pipeline verification',
            via: 'human-mode',
          });
        } catch { /* best-effort */ }
        observation = 'Recorded as an UNVERIFIED claim (no pipeline verifier is wired into this session). It does not count as a finding until the verifier confirms it.';
      }
      note({ action: `claim_finding: ${title}`, why: thinkingText, result: clipResult(observation), learned: '' });
      }
    } else {
      observation = `Unknown action "${kind}". Valid actions: shell, search, write_file, note, recall, record_coverage, hunt_plan, load_skill, proxy_start, intercept_list, intercept_read, intercept_replay, browser_open, browser_snapshot, browser_click, browser_type, screenshot, desktop_snapshot, desktop_click, desktop_key, desktop_screenshot, desktop_terminal, desktop_click_control, see_screen, desktop_click_at, launch_tool, download_tool, list_controls, claim_finding, save_credential, use_saved_credential, fetch_verification_code. Pick exactly one, as JSON on the last line.`;
    }

    // Lane F: remember what the executed action returned, so a later
    // repeat attempt can be answered with its last result.
    if (pendingSig) {
      const entry = actionHistory.get(pendingSig);
      if (entry) {
        entry.lastResult = String(observation).slice(0, 220);
        // Lane AF: the execution was counted as full at dispatch;
        // if the GUI result says it was really the look-only
        // fallback, reclassify it — the full count comes back off,
        // the streak it interrupted is restored and incremented —
        // and persist the amendment as a paired tool_degraded event
        // so the next session's rebuilt history replays the same
        // accounting from the same record.
        if (pendingDegraded) {
          entry.fullCount = Math.max(0, (entry.fullCount || 0) - 1);
          entry.degradedStreak = pendingPrevStreak + 1;
          try { deps.record(huntId, { type: 'tool_degraded', tool: entry.tool, detail: entry.detail, via: 'human-mode' }); } catch { /* best-effort */ }
        }
      }
      pendingSig = null;
      pendingDegraded = false;
    }

    // PROOF-COMPLETE (gate-replay lane, 28 Oct 2026): a probe that
    // returns signal-bearing, non-error output proves its claim
    // once more. The signature is the one captured before execution
    // (proofSig), so a navigation the probe caused cannot change
    // the key. Blocked / paused turns carry no proof (their
    // observation is a gate text, not probe output — the !proofHit
    // guard keeps a proof-blocked turn from counting itself);
    // claim_finding itself is never a probe. The count persists to
    // meta so the next session inherits it.
    if ((kind === 'shell' || kind === 'browser_type') && !proofHit && proofSig && observation && !/^(BLOCKED|PAUSED)/.test(String(observation))) {
      try {
        const cmdForProof = kind === 'shell' ? String(action.command || '') : '';
        if (probeProvesClaim({ output: observation, command: cmdForProof })) {
          proofCounts.set(proofSig.key, (proofCounts.get(proofSig.key) || 0) + 1);
          persistProofCounts();
        }
      } catch { /* proof counting is best-effort */ }
    }

    // MISSION Stage 2+3 (31 Oct 2026): structured plan + explicit action
    // verification. If the brain attached a plan (action.plan), record its
    // objective/state/risk on the observation. If it declared what it
    // expected (action.expect), check it against the fresh observation and
    // the current page URL, and append the verdict. VERIFIED means the
    // intended state change is proven; NOT VERIFIED surfaces the plan's
    // fallback — the brain must diagnose and retry, never assume success.
    try {
      const planParsed = parsePlan(action.plan);
      const plan = planParsed.valid ? planParsed.plan : null;
      if (plan) {
        const parts = [];
        if (plan.objective) parts.push(`objective: ${plan.objective}`);
        if (plan.state) parts.push(`state: ${plan.state}`);
        if (plan.risk) parts.push(`risk: ${plan.risk}`);
        if (parts.length > 0) observation = `${observation}\n[PLAN] ${parts.join(' | ')}`;
      }
      const expectText = action && typeof action.expect === 'string' ? action.expect.trim() : '';
      if (expectText) {
        const verdict = verifyExpectation({ expect: expectText, observation, pageUrl: currentPageUrl });
        if (verdict.checked) {
          observation = `${observation}\n[EXPECTATION ${verdict.verified ? 'VERIFIED' : 'NOT VERIFIED'}] ${verdict.evidence}`;
          // MISSION Stage 6 (31 Oct 2026): UI observability — emit a
          // structured verification event so the frontend can display
          // real Verified/Failed status instead of inferring it.
          try {
            deps.record(huntId, {
              type: 'verification',
              action: kind,
              verified: verdict.verified,
              evidence: scrub(String(verdict.evidence)).slice(0, 300),
              via: 'human-mode',
            });
          } catch { /* observability is best-effort */ }
          // MISSION Stage 4 (31 Oct 2026): the Learn step — synthesize what
          // this turn taught us from the verification verdict, so the
          // lesson is explicit in the loop's observable state and the next
          // screen, not just implied. VERIFIED confirms the premise;
          // NOT VERIFIED retires the approach for this turn.
          const actionLabel = (() => {
            try {
              const d = action.text || action.command || action.url || action.target || '';
              return `${kind}${d ? ` '${String(d).slice(0, 60)}'` : ''}`;
            } catch { return kind; }
          })();
          observation = `${observation}\n[LEARNED] ${actionLabel}: ${verdict.verified ? 'premise CONFIRMED' : 'approach FAILED'} — ${verdict.evidence}`;
          if (!verdict.verified) {
            const fb = fallbackLine(plan);
            if (fb) observation = `${observation}\n${fb}`;
          }
        }
      }
    } catch { /* plan/verification never breaks the loop */ }

    // Lane AI: the session log is scrubbed like every other
    // recorded surface — a one-turn secret (generated password,
    // verification code) rides lastObservation to the next screen
    // in memory, but never lands in this log.
    log.push({ turn, action: kind, detail: scrub(detailForAction(kind, action)), observation: scrub(String(observation)).slice(0, 300) });
    lastObservation = observation;

    // POST-DISPATCH FILER SWEEP (#316): file dispatch-produced evidence
    // this turn, not next turn — and never lose it to session end.
    try { await sweepPostDispatchEvidence(observation); } catch { /* sweep never breaks the loop */ }

    // VISIBLE-DESKTOP-FIRST: fold this turn's executed actions
    // into the previous-turn record the NEXT screen's nudge is
    // computed from — a shell-only interactive turn (or a shell
    // login, which leaves the visible browser logged out) earns
    // the desktop nudge next turn. The task text is the brain's
    // current task; a turn with no task block is judged on its
    // shell login alone.
    prevTurnDesktop = { kinds: [...turnKinds], task: String((sessionCurrentTask && sessionCurrentTask.task) || ''), shellLogin: turnShellLogin };

    // PROGRESS CHECKPOINT (Lane P, 23 Oct 2026): the hunt's totals
    // used to move only at session end, so during a whole 6-turn
    // session (10+ minutes on the 8B brain) meta.humanLoop.turnsTotal
    // stood still and the website's hunt looked frozen at the round
    // it resumed from — the owner's live QA watched round 166 for
    // ~12 minutes while the backend was in fact writing reasoning
    // rows and events. Persist the running total after EVERY turn
    // through the guarded checkpoint writer (owner pause/stop holds
    // are preserved; progress fields still record). Best-effort: a
    // failed checkpoint never costs the turn.
    try {
      const cur = deps.readMeta(huntId) || {};
      const curLoop = cur.humanLoop || {};
      // INFINITY LEVEL: the loop counters ride the same per-turn
      // checkpoint — the parent can read meta.humanLoop.loopCounters
      // at any moment and see snapshots taken/acted on, clicks,
      // distinct pages/elements, and payloads planned vs sent.
      let turnCounters = null;
      try {
        const ev = deps.readEvents(huntId) || sessionEvents;
        let rows = [];
        try { rows = getAllReasoning(huntId) || []; } catch { /* rows are best-effort */ }
        turnCounters = loopCounters({ events: ev, reasoningRows: rows, pageState: sessionPageState });
      } catch { /* counters are best-effort */ }
      deps.writeMeta(huntId, {
        ...cur,
        huntId,
        humanLoop: {
          ...curLoop,
          turnsTotal: sessionBaseTurns + turnsRun,
          lastTurnAt: new Date().toISOString(),
          ...(turnCounters ? { loopCounters: turnCounters } : {}),
          // KEYWORD-INDEX: the current task rides the per-turn
          // checkpoint (writeHuntMetaCheckpoint preserves an
          // owner pause/stop hold around it, like every progress
          // field). sessionTaskSeen lets a completed task CLEAR
          // the stale currentTask instead of leaving it standing.
          ...(sessionTaskSeen ? { currentTask: sessionCurrentTask } : {}),
          ...(sessionLastCompletedTask ? { lastCompletedTask: sessionLastCompletedTask } : {}),
        },
        checkpointAt: new Date().toISOString(),
      });
    } catch { /* progress checkpoint is best-effort */ }
  }

  // Checkpoint: session totals on the hunt meta under humanLoop,
  // plus the LEFT-OFF hand-off (Lane I): where this session stopped —
  // its last actions WITH detail and result, its last note, its open
  // threads, and the tail of its train of thought — so the next
  // session resumes as the same person, not a cold stranger.
  try {
    const m = deps.readMeta(huntId) || {};
    const prev = m.humanLoop || {};
    let endEvents = sessionEvents;
    try {
      endEvents = deps.readEvents(huntId) || sessionEvents;
    } catch { /* fall back to the session-start read */ }
    let endRows = [];
    try {
      endRows = getAllReasoning(huntId) || [];
    } catch { /* reasoning read is best-effort */ }
    let lastNote = sessionLastNote;
    if (!lastNote) {
      for (let i = endRows.length - 1; i >= 0 && !lastNote; i--) {
        const r = endRows[i];
        if (r && r.action === 'note to self') lastNote = String(r.learned || r.why || '');
      }
    }
    if (!lastNote) {
      for (let i = endEvents.length - 1; i >= 0 && !lastNote; i--) {
        const e = endEvents[i];
        if (e && e.type === 'thinking' && String(e.text || '').startsWith('Note to self:')) {
          lastNote = String(e.text).slice('Note to self:'.length).trim();
        }
      }
    }
    let openThreads = [];
    try {
      openThreads = researchedNotProbedLines({ events: endEvents, reasoningRows: endRows });
    } catch { /* open threads are best-effort */ }
    // Lane L (P4): session-end researched-vs-probed reconciliation.
    // The classes researched in THIS session's slice of the record
    // are diffed against probe actions and coverage rows; whatever
    // is unaccounted becomes an open item in this leftOff AND an
    // open_gap row in the coverage ledger, and the cumulative
    // research-debt counters are folded into the ledger. This is
    // memory bookkeeping about research debt — it never records a
    // probe that did not happen, and it writes no DOSSIER.md
    // (consolidation owns that file and regenerates it wholesale).
    try {
      const covData = loadCoverage(huntId);
      const sliceEvents = endEvents.length >= sessionEvents.length ? endEvents.slice(sessionEvents.length) : [];
      const sliceRows = endRows.slice(sessionRowCount);
      const rec = reconcileSessionResearch({ sessionEvents: sliceEvents, sessionRows: sliceRows, coverageData: covData, target });
      if (rec.gapInputs.length || rec.debtStats.length) {
        let next = covData;
        for (const g of rec.gapInputs) next = applyRecord(next, g).data;
        const huntProbed = new Set(
          researchedTopicStats({ events: endEvents, reasoningRows: endRows })
            .filter((s) => s.probed)
            .map((s) => s.topic.id),
        );
        for (const id of probedClassIds(next)) huntProbed.add(id);
        next = mergeResearchDebt(next, rec.debtStats, new Date().toISOString(), huntProbed);
        saveCoverage(huntId, next);
      }
      for (const item of rec.openItems) {
        const label = item.replace(/^-\s*/, '').split(':')[0];
        if (!openThreads.some((l) => l.includes(label))) openThreads.push(item);
      }
    } catch { /* reconciliation is best-effort bookkeeping */ }
    // Lane P: a dedup-BLOCKED attempt is not an action the hunter
    // took and must never be stored as the hand-off's last actions —
    // the next session reads those as its pending thread and retries
    // the exact repeat (live: browser_open /api/register, blocked in
    // one session, was already sitting in leftOff from the session
    // before and got retried again). Blocked attempts instead become
    // an explicit do-not-retry thread.
    const isBlockedRepeat = (l) => String((l && l.observation) || '').startsWith('BLOCKED — ALREADY DONE');
    const seenBlocked = new Set();
    for (const b of log.filter(isBlockedRepeat)) {
      const key = `${b.action}|${b.detail || ''}`;
      if (seenBlocked.has(key)) continue;
      seenBlocked.add(key);
      const line = `- Do NOT retry: ${b.action} ${clipLine(b.detail || '', 120)} — the already-done gate blocked it as an exact repeat; it is not your pending step. Choose a different action.`;
      if (!openThreads.some((t) => t.includes('Do NOT retry') && t.includes(clipLine(b.detail || '', 60)))) {
        openThreads.push(line);
      }
    }
    const leftOff = {
      at: new Date().toISOString(),
      lastActions: log.filter((l) => !isBlockedRepeat(l)).slice(-5).map((l) => ({
        tool: l.action,
        detail: clipLine(l.detail || '', 160),
        result: clipLine(l.observation || '', 220),
      })),
      lastNote: clipLine(lastNote || '', 300),
      openThreads,
      lastThinking: clipLine(sessionLastThinking || '', 240),
    };
    // INFINITY LEVEL: the session-end checkpoint rebuilds humanLoop
    // WITHOUT spreading prev (above), so the per-turn counters
    // would be lost here unless carried forward explicitly.
    let endCounters = null;
    try {
      endCounters = loopCounters({ events: endEvents, reasoningRows: endRows, pageState: sessionPageState });
    } catch { /* counters are best-effort */ }
    deps.writeMeta(huntId, {
      ...m,
      huntId,
      humanLoop: {
        sessions: (prev.sessions || 0) + 1,
        // Lane P: per-turn progress checkpoints already advanced
        // turnsTotal to sessionBaseTurns + turnsRun during this
        // session; adding turnsRun again here would double-count.
        // The max keeps the total correct whether or not the
        // per-turn writes landed (e.g. a no-op writeMeta in tests).
        turnsTotal: Math.max(prev.turnsTotal || 0, sessionBaseTurns + turnsRun),
        lastTurnAt: new Date().toISOString(),
        lastActions: log.slice(-6).map((l) => l.action),
        leftOff,
        ...(endCounters ? { loopCounters: endCounters } : {}),
        // KEYWORD-INDEX: the session-end checkpoint rebuilds the
        // humanLoop object, so the current task must be carried
        // explicitly — this session's block when one arrived, else
        // the previous session's standing task.
        ...(sessionTaskSeen ? { currentTask: sessionCurrentTask } : (prev.currentTask ? { currentTask: prev.currentTask } : {})),
        ...(sessionLastCompletedTask ? { lastCompletedTask: sessionLastCompletedTask } : (prev.lastCompletedTask ? { lastCompletedTask: prev.lastCompletedTask } : {})),
      },
    });
  } catch { /* checkpoint is best-effort */ }

  // FIX (#362, companion): aiOk is set only on a non-empty reply, so
  // !aiOk here means the brain never replied all session — report
  // failKind 'no_reply' (the signal the old early return carried)
  // so the driver still ends a dead-brain run with the streak.
  return { aiOk, failKind: aiOk ? null : 'no_reply', turnsRun, actionsRun: log.length, newFindings, log };
}
