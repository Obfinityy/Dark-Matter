// Split out of huntAgent.js by the P3 professionalization lane (split-only, no behaviour change).
// Moved verbatim; huntAgent.js re-exports the public names so callers are unchanged.

import {
  spawnHuntContainer,
  teardownHuntContainer,
  execInHuntContainer,
  execInHuntContainerWithRespawn,
  dockerAvailable,
} from '../huntRunner.js';
import { guardClaimTitle, isProbeNameTitle } from '../claimTitleGuard.js';
import { callBrain } from '../brainProvider.js';
import { recordGlobalLearning, getRelevantMemories, formatGlobalMemoryForPrompt, inferTechnique, readAllGlobalMemories } from '../globalMemory.js';
import { appendHuntEvent, writeHuntMeta, writeHuntMetaCheckpoint, readHuntMeta, readHuntEvents, readUsers, readTargetIntel, writeTargetIntel, huntDir, ensureHuntDir } from '../store.js';
import { episodeLedgerEnabled, retrieveEpisodes, formatRetrievalForPrompt, recordRuledOut, getRuledOutCounts, formatLessonsForPrompt, RETRY_BUDGET, recordFact } from '../episodeStore.js';
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
import { DRIVER_LOCK_BEAT_MS, activeLoops, getOrchestrator, isDriverActive, orchestrators, releaseDriverLock, touchDriverLock, tryAcquireDriverLock } from './driver.js';
import { executeWithEvasion } from './exec.js';
import { getTargetBaselines, reconPhase } from './recon.js';

/** Assess a test result: weirdness check → evidence gate → verify. */
/**
 * VALIDATOR AS A STEP (Job 6 stage 7, XBOW pattern): every assessResult
 * verdict — including the silent discards (execution failure, not
 * interesting, evidence-gate rejection) that used to leave no trace —
 * becomes a first-class 'validation' episode in the hunt stream, so the
 * ledger can answer "how often did the validator speak, and what did it
 * say?" for any hunt.
 */
function recordValidation(huntId, plan, verdict, detail = '') {
  try {
    appendHuntEvent(huntId, {
      type: 'validation',
      verdict,
      plan: (plan && plan.test) || '',
      detail: String(detail || '').slice(0, 300),
      text: `validation: ${(plan && plan.test) || 'unnamed'} — ${verdict}`,
    });
  } catch { /* audit is best-effort */ }
}

// RETIRED DETECTORS (Lane A, 21 Oct 2026): deterministic-probe premise
// versions whose stamps were audited FALSE and formally retracted. The
// premise-version rule already gives a corrected probe a new detId, so
// these ids never appear in detFront again — but a retired premise must
// not be able to stamp verified:true through ANY replay path (cached
// plans, restored checkpoints, hand-issued commands carrying the old
// detId). assessResult refuses them before any other work. Tightening
// only: no live detector is in this set.
//   ftp-kdbx-exposure / -v2 — status+size-only EXPOSED premise; on the
//   open.ys7.com catch-all (HTTP 200 + identical 43-byte login JSON for
//   every /ftp/* path) it manufactured the false verified stamp of
//   2026-10-20T12:57:24.801Z (episode #15923, retracted 21 Oct 2026).
//   Superseded by canary-controlled 'ftp-kdbx-exposure-v3' (58a6140).
const RETIRED_DET_IDS = new Set(['ftp-kdbx-exposure', 'ftp-kdbx-exposure-v2']);

// W6 FIX (28 Oct 2026, gate-interesting-xss lane): the 'interesting'
// pre-filter decides whether a claim's evidence is worth sending to the
// verification pipeline. It used to be a hardcoded keyword regex only —
// a clean reflected-XSS proof (marker + script tag reflected raw)
// contains none of those words, so it was discarded as
// 'not-interesting' before the verifier ever ran (live: DVWA XSS claim
// filed by the parent-as-brain, 28 Oct; validation verdict
// 'not-interesting', detail 'no signal in output'). The signal-based
// path recognises evidence via evidenceSignalIds — the same signal
// source the rest of the pipeline trusts (non-negated, non-framing
// lines) — so a reflected script tag is a signal and a probe echoing
// its own banner is not. The keyword regex stays as a fallback and the
// weird-score path stays for curiosity. Pure.
export function isInterestingEvidence(output, command, weirdScore) {
  const out = String(output || '');
  if (out.trim().length < 50) return false;
  return weirdScore >= 40
    || /vulnerable|exposed|bypass|injection|leak|admin|secret|token|password|error.*sql|stack trace/i.test(out)
    || evidenceSignalIds(out, command).length > 0;
}

export async function assessResult(huntId, target, plan, result) {
  // FIX (19 Oct 2026, solver #6): Strip terminal artifacts (Kali MOTD, shell
  // prompts, ANSI codes) from tool output BEFORE using it as evidence.
  // Contaminated output caused payload_validation to fail on genuine findings.
  const output = stripTerminalArtifacts(sanitizeForAI(result.stdout + '\n' + result.stderr)).slice(0, 3000);

  // RETIRED-DETECTOR GATE (Lane A, 21 Oct 2026): see RETIRED_DET_IDS.
  if (plan && plan.detId && RETIRED_DET_IDS.has(plan.detId)) {
    recordValidation(huntId, plan, 'rejected', `superseded detector ${plan.detId} — premise retired after a retracted false stamp; it can never verify`);
    return null;
  }

  // Weirdness check: investigate even without signature match
  const weird = scoreWeirdness(
    { status: result.code === 0 ? 200 : 500, bodyLength: output.length, timeMs: 1000, body: output },
    { status: 200, bodyLength: 2000, timeMs: 500 }
  );
  if (isWorthInvestigating({ status: 200, bodyLength: output.length, timeMs: 1000, body: output }, { status: 200, bodyLength: 2000, timeMs: 500 })) {
    think(huntId, `Weird response (score ${weird.score}): ${weird.signals.join(', ')} — investigating.`);
    // CURIOSITY: a human hunter does not dismiss anomalies — they investigate further.
    // Ask the brain for one targeted follow-up probe into this weirdness.
    try {
      const followUp = await callBrain(
        [{ role: 'user', text: `Something odd happened during a security test. Follow your curiosity — propose ONE follow-up probe to dig into this anomaly.\n\nOriginal test: ${plan.test}\nCommand: ${String(plan.command).slice(0, 300)}\nOdd signals: ${weird.signals.join(', ')}\nResponse excerpt: ${output.slice(0, 1200)}\n\nReply as JSON: {"test":"name","command":"shell command","why":"one line"}. Non-destructive, target-scoped.` }],
        'You are a curious elite bug-bounty hunter. Output ONLY the requested JSON, no prose.',
        { huntId },
        // RULE #50 (30 Oct 2026): curiosity is advisory — a dead Ollama
        // must fail this fast, never stall the verifier behind it.
        { huntId, advisory: true }
      );
      const fm = /\{[\s\S]*\}/.exec(followUp || '');
      const fp = fm ? JSON.parse(fm[0]) : null;
      if (fp && fp.command) {
        think(huntId, `Curiosity follow-up: ${fp.test || 'probing deeper'} — ${fp.why || ''}`);
        const fres = await executeWithEvasion(huntId, target, String(fp.command).slice(0, 4000));
        // FIX (19 Oct 2026, solver #6): Strip terminal artifacts so evidence is clean.
        const frecout = stripTerminalArtifacts(fres.stdout + '\n' + fres.stderr).slice(0, 3000);
        // If the follow-up confirms something interesting, treat it as a candidate
        if (/vulnerable|exposed|bypass|injection|leak|admin|secret|token|password|error.*sql|stack trace/i.test(frecout) && frecout.trim().length > 50) {
          // FIX (19 Oct 2026): include impact_demo — evidenceGate requires it
          // for critical findings and nothing ever set it (see above).
          const fsigs = extractSignal(frecout);
          const fcand = { class: 'agent_finding', title: `Curiosity find: ${fp.test}`, severity: inferSeverity(fp.test || '', frecout), url: target, evidence: { request: fp.command, response: frecout.slice(0, 800), impact_demo: `Impact signals [${fsigs || 'none'}]: ${frecout.slice(0, 400)}` } };
          const { pass } = evidenceGate(fcand);
          if (pass) {
            appendHuntEvent(huntId, { type: 'finding', ...fcand, verified: false, via: 'curiosity' });
            think(huntId, `Curiosity paid off — queued for verification: ${fp.test}`);
          }
        }
      }
    } catch { /* curiosity must never break the hunt */ }
  }

/** Infer severity from the test name and output — not everything is medium. */
function inferSeverity(testName, output) {
  const t = (testName + ' ' + output).toLowerCase();
  if (/rce|remote code execution|sql injection|sqli|auth bypass|authentication bypass|ssrf|server-side request forgery|arbitrary file|path traversal.*write|command injection/i.test(t)) return 'critical';
  if (/xss|cross-site scripting|ssti|idor|open redirect|csrf|xxe|file inclusion|lfi|rfi|jwt/i.test(t)) return 'high';
  if (/info disclosure|information disclosure|verbose error|stack trace|directory listing|cors|clickjacking|missing header/i.test(t)) return 'low';
  return 'medium';
}

  // FIX (20 Oct 2026, solver #442): EXECUTION-FAILURE GATE — the root cause
  // of the verifier false-accept family (45 settled cases). When the probe
  // command failed in the container, `output` here is the exec layer's error
  // echo ("Command failed: docker exec … sh -c <cmd>"), which CONTAINS the
  // probe URL — so the 'admin'/'secret' interesting-test and extractSignal
  // matched the failure echo itself, and the verification re-run reproduced
  // the same deterministic failure and called it confirmation. A failed
  // execution is not evidence: discard before any finding is built.
  if (executionFailed(result, output)) {
    think(huntId, `Execution failed (exit ${result && result.code}) — error output is not evidence; discarding this result.`);
    // DEAD-END REGISTRY (Job 6 stage 4): repeated execution failures of
    // the same probe are a deterministic signal too — after the retry
    // budget the plan filter rules the probe out instead of letting the
    // model burn iterations re-issuing a broken command form.
    try {
      recordRuledOut({
        huntId,
        title: plan.test || 'unnamed probe',
        family: 'execution-failed',
        detail: `exit ${result && result.code}`,
        linkEpisode: false,
      });
    } catch { /* registry is best-effort */ }
    recordValidation(huntId, plan, 'execution-failed', `exit ${result && result.code}`);
    return null;
  }

  const interesting = isInterestingEvidence(output, plan.command, weird.score);
  if (!interesting) {
    recordValidation(huntId, plan, 'not-interesting', output.trim() ? 'no signal in output' : 'empty output');
    return null;
  }

  // FIX (19 Oct 2026): evidenceGate requires impact_demo for critical-severity
  // findings, but nothing ever set it — so EVERY critical finding (including a
  // working SQLi auth bypass, classified critical by inferSeverity) was silently
  // discarded at the gate and could never verify. The signal-bearing response
  // excerpt IS the impact demonstration.
  // LABEL-TRUST FIX (Lane A, 21 Oct 2026): the verify path no longer
  // derives its signals from raw output text. extractSignal() is
  // negation-blind and provenance-blind: it matched 'directory listing'
  // in the /ftp probe's own UNCONDITIONAL echo banner and 'exposed'
  // inside the probe's negated "not exposed:" verdict lines — so the
  // canary-controlled v3 probe, whose every verdict on open.ys7.com was
  // negative, still "verified" (stamp 2026-10-20T13:23:12.720Z, episode
  // #16010, retracted). Signals for verification now come from
  // evidenceSignalIds: lines that are neither negated nor the probe's
  // own framing (verbatim in the executed command). A deterministic
  // probe can no longer confirm itself by re-printing its banner.
  const sigs = evidenceSignalIds(output, plan.command).join(',');
  // P0 (31 Oct 2026): probe/test names must never become verified
  // findings. If the plan's test name looks like a probe name, bounce
  // it here — BEFORE the verifier runs — and record it as an unverified
  // probe note, not a finding. The brain must re-title with the
  // VULNERABILITY name.
  try {
    const titleGuard = guardClaimTitle(plan.test || '', readHuntEvents(huntId));
    if (!titleGuard.ok) {
      think(huntId, `Claim guard bounced "${plan.test}": ${titleGuard.error} — recording as unverified probe note.`);
      appendHuntEvent(huntId, {
        type: 'finding',
        class: 'agent_finding',
        title: plan.test || 'agent-discovered anomaly',
        severity: 'medium',
        url: target,
        evidence: { request: plan.command, response: output.slice(0, 800) },
        verified: false,
        verification: `bounced by claim guard (${titleGuard.error}): ${titleGuard.message}`,
        via: 'assessResult',
      });
      recordValidation(huntId, plan, 'rejected', `claim guard: ${titleGuard.error}`);
      return null;
    }
  } catch { /* guard is best-effort; verification proceeds on guard failure */ }
  const cand = {
    class: 'agent_finding',
    title: plan.test || 'agent-discovered anomaly',
    severity: inferSeverity(plan.test || '', output),
    url: target,
    evidence: {
      request: plan.command,
      response: output.slice(0, 800),
      impact_demo: `Impact signals [${sigs || 'none'}]: ${output.slice(0, 400)}`,
    },
  };
  const { pass, gated } = evidenceGate(cand);
  if (!pass) {
    recordValidation(huntId, plan, 'gate-rejected', 'evidence gate rejected the candidate');
    return null;
  }

  // REAL VERIFICATION (not hardcoded): re-run the exact test to confirm
  // reproducibility. A one-off anomaly is not a vulnerability.
  let confirmed = false;
  try {
    think(huntId, `Verifying: re-running the test to confirm reproducibility…`);
    // FIX (20 Oct 2026, parent audit): this re-run sliced the command to
    // 500 chars while the execution path allows 4,000 (solver #459) — a
    // truncated re-run is NOT "the exact test": it can syntax-error
    // (false non-confirmation) or, worse, run a different shorter
    // command than the one that produced the evidence. Use the same cap
    // as execution so the re-run is byte-identical to the original.
    const retry = await execInHuntContainer(huntId, String(plan.command).slice(0, 4000), 120000, { bypassTmux: true });
    const confirmOutput = (retry.stdout + '\n' + retry.stderr).slice(0, 3000);
    // Confirmation: the re-run reproduces the CLAIMED EVIDENCE.
    // FIX (solver #442): the re-run must also have EXECUTED — a reproduced
    // failure yields the same echo-derived signal and is not confirmation.
    // LABEL-TRUST FIX (Lane A, 21 Oct 2026): the signal sets below are
    // evidence signals (evidenceSignalIds) — non-negated, non-framing.
    // GATE-REPLAY FIX (28 Oct 2026): the old rule required the two runs'
    // signal sets to be IDENTICAL (sig1 === sig2). For a data claim
    // (UNION dump) the brain's evidence is a hand-pasted excerpt and
    // the re-run is full raw output — different signal words on either
    // side, so a real reproducible dump was rejected as "the second
    // run differed" (live: DVWA SQLi claim 05:17 + 06:31 IST 28 Oct).
    // The confirmation is now evidence reproduction
    // (differential.evidenceReproduced): the re-run must return the
    // claimed data itself (a hash / canary token, or a signal line
    // from the evidence verbatim). An error-page re-run is never a
    // confirmation. The signal sets still gate the shape: the claim
    // must be signal-bearing and the re-run must produce a signal.
    const sig1 = evidenceSignalIds(output, plan.command).join(',');
    const sig2 = evidenceSignalIds(confirmOutput, plan.command).join(',');
    const reproduced = evidenceReproduced(output, confirmOutput, plan.command);
    confirmed = !executionFailed(retry, confirmOutput) && sig1.length > 0 && sig2.length > 0 && reproduced;
    if (confirmed) {
      think(huntId, `Verified: re-run reproduced the claimed evidence (${sig1}).`);
    } else {
      const why = executionFailed(retry, confirmOutput)
        ? 're-run failed to execute'
        : sig2.length === 0
          ? 're-run produced no signal'
          : 're-run did not reproduce the claimed evidence';
      think(huntId, `Not confirmed: ${why} — treating as one-off anomaly.`);
    }
  } catch (err) {
    think(huntId, `Verification re-run failed: ${err.message || err}`);
  }

  // FIX (19 Oct 2026, solver #3): impact_assessment rejected GENUINE findings.
  // Proven by simulation with the real pipeline code: a working SQLi auth
  // bypass (admin JWT in a clean 200 JSON) scores weird=8 and contains none
  // of the literal words vulnerable/bypass/injection/leak — so a real
  // vulnerability was verdict as "false_positive (impact_assessment)".
  // extractSignal's impact signals (admin-exposure, auth-bypass, sql-error…)
  // ARE the impact demonstration — honour them here.
  const v = verifyPipeline({
    reachability: output.length > 50,
    // LABEL-TRUST FIX (Lane A, 21 Oct 2026): payload validation must be
    // carried by an evidence line (non-negated, non-framing) or a claim
    // word in the output — previously the bare regex matched 'exposed'
    // inside the probe's own "not exposed:" verdict lines, validating a
    // payload the evidence itself said never landed.
    payload_validation: supportingSignalLines(output, { excludeText: plan.command }).length > 0 || /vulnerable|bypass|injection|leak/i.test(output),
    impact_assessment: weird.score >= 40 || sigs.length > 0 || /vulnerable|bypass|injection|leak/i.test(output),
    exploit_confirmation: confirmed,
  });
  // CONTENT-RELEVANCE JUDGEMENT (20 Oct 2026, solver #454 — the residual
  // left by the #442 execution gate): a SUCCESSFUL command can still
  // return irrelevant-but-signal-bearing content — the target's own SPA
  // fallback (signal words are ambient site content), a different host's
  // response, or output that negates the claim ("not exposed: …/.env").
  // A would-be verified finding must also be BOUND to its claim:
  // on-target host, a non-negated supporting signal, and signal text
  // novel against the target's baseline bodies. Tightening only — this
  // can reject, never promote; on rejection the finding is recorded
  // unverified with the relevance verdict, so the dead-end registry
  // learns the family like any other validator rejection.
  let rec = { ...gated, verification: v.verdict, verified: v.verified };
  // ERROR-PAGE AUDIT (27 Oct 2026, 404-verified audit): record the
  // proof response's HTTP status on the finding, so every later reader
  // can see whether the proof was a real page or an error page. The
  // rejection itself rides the content-relevance limb
  // (differential.js) — a 404 there rewrites the record as a false
  // positive in the block below.
  const errorStatus = httpErrorStatus(output);
  if (errorStatus) {
    rec = { ...rec, evidence: { ...(rec.evidence || {}), http_status: errorStatus } };
  }
  if (v.verified) {
    const baselines = await getTargetBaselines(huntId, target);
    const rel = assessContentRelevance({ command: plan.command, target, output, baselines: baselines || [] });
    if (!baselines) {
      think(huntId, 'Content-relevance: no target baseline obtainable — novelty limb abstained (host + negation limbs still applied).');
    }
    if (!rel.relevant) {
      think(huntId, `Content-relevance FAILED (${rel.reason}) — reproducible but not evidence of this claim; recording as false positive.`);
      rec = { ...gated, verification: `false_positive (content_relevance: ${rel.reason} — FAILED)`, verified: false };
    }
  }
  finding(huntId, rec);
  recordValidation(huntId, plan, rec.verified ? 'verified' : 'rejected', rec.verification);

  // Head records verified findings for the final report
  if (rec.verified) {
    // VARIANT SWEEP (19 Oct 2026): a newly verified class gets its sibling
    // sweep queued — the sweep block in the planning loop picks it up.
    try {
      const vcls = classifyFinding(rec.title);
      if (vcls) {
        const m = readHuntMeta(huntId) || {};
        const vsw = m.variantSweep || { backfilled: false, classes: [] };
        if (!vsw.classes.includes(vcls)) {
          writeHuntMetaCheckpoint(huntId, { variantSweep: { ...vsw, classes: [...vsw.classes, vcls] } });
          think(huntId, `New verified class "${vcls}" — variant sweep queued for its sibling vectors.`);
        }
      }
    } catch { /* sweep queue is best-effort */ }
    const head = getOrchestrator(huntId);
    if (head) {
      const verifier = head.spawnWorker('verifier', `Independently confirm: ${rec.title}`);
      head.findings.push(rec);
      head.review(verifier, { ok: true, output: 'reproduced' }, () => true);
      head.saveState();
      think(huntId, `Head: confirmed vulnerability #${head.findings.length} — ${rec.title} (${rec.severity})`);
    }
  }

  // Chain escalation
  if (rec.verified) {
    const chains = beamSearchChains(['data_read']);
    if (chains.length) {
      think(huntId, `Chain opportunity: ${chains[0].path.join(' → ')} (score ${chains[0].score.toFixed(2)})`);
    }
    // CHAIN PURSUIT (19 Oct 2026, solver #105): XBOW's key differentiator is
    // chaining vulnerabilities into working attacks. We detect the chain but
    // must ACT on it, not just think about it. Extract usable artifacts
    // (JWTs, tokens) from the verified finding and store them as chain
    // context so the next planning phase can pursue the chain.
    try {
      const respText = String(rec.evidence?.response || '') + ' ' + String(rec.evidence?.request || '');
      const jwtMatch = respText.match(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
      // FIX (19 Oct 2026, solver #109): decouple JWT storage from
      // beamSearchChains output (root-caused by solver #108). The chain
      // engine returned [] for the verified SQLi, so chains.length was 0
      // and the JWT was never stored — chain pursuit never fired. The
      // pursuit tests only need artifacts.jwt + chainPath.length > 1, so
      // store the JWT with a default chain path when the engine is silent.
      if (jwtMatch) {
        const chainPath = chains.length ? chains[0].path : ['data_read', 'auth_bypass', 'priv_esc'];
        const chainScore = chains.length ? chains[0].score : 0.5;
        const chainCtx = {
          artifacts: { jwt: jwtMatch[0] },
          chainPath,
          chainScore,
          fromFinding: rec.title,
          createdAt: new Date().toISOString(),
        };
        writeHuntMetaCheckpoint(huntId, { chainContext: chainCtx });
        // FACTS (stage 8): auth state changed — record PRESENCE only.
        // The token value itself is never written to the facts table.
        try { recordFact({ huntId, subject: 'auth', predicate: 'jwt', object: 'present (captured from verified finding)' }); } catch { /* best-effort */ }
        think(huntId, `Chain context stored: have JWT from "${rec.title}", pursuing ${chainPath.join(' → ')}`);
        // GLOBAL MEMORY (19 Oct 2026): chain patterns compound across hunts.
        // A verified finding that yields a usable artifact is a proven link.
        try {
          const gm1 = readHuntMeta(huntId) || {};
          const fp1 = gm1.appFingerprint || { appType: 'unknown', techStack: [] };
          recordGlobalLearning({
            type: 'chain',
            technique: 'chain',
            target: String(target).slice(0, 120),
            appType: fp1.appType || 'unknown',
            techStack: fp1.techStack || [],
            success: true,
            payload: '',
            context: `${rec.title} → artifact extraction → ${chainPath.join(' → ')}`,
            note: 'Chain pattern: a verified finding yielded a usable artifact and pursuit tests were armed with it.',
          });
        } catch { /* global memory is best-effort */ }
      }
    } catch { /* chain context is best-effort */ }
    // PoC generator: turn verified finding into working proof
    await generatePoC(huntId, target, rec);
  }
  // Share verified learnings into the target's long-term memory
  try {
    if (rec && rec.verified) {
      const { writeTargetIntel: _wti } = await import('../store.js');
      _wti(target, { findings: [{ title: rec.title, severity: rec.severity, at: new Date().toISOString() }] });
    }
  } catch { /* memory write must never break the hunt */ }
  // GLOBAL MEMORY (19 Oct 2026): every verified finding teaches ALL future
  // hunts — no model training needed, the intelligence compounds here.
  // Validators are untouched: only genuine verified findings reach this path.
  try {
    if (rec && rec.verified) {
      const gm2 = readHuntMeta(huntId) || {};
      const fp2 = gm2.appFingerprint || { appType: 'unknown', techStack: [] };
      recordGlobalLearning({
        type: 'technique',
        technique: inferTechnique(`${rec.title || ''} ${rec.class || ''} ${plan.test || ''}`),
        target: String(target).slice(0, 120),
        appType: fp2.appType || 'unknown',
        techStack: fp2.techStack || [],
        success: true,
        payload: String(plan.command || (rec.evidence && rec.evidence.request) || '').slice(0, 300),
        context: `${rec.title} (${rec.severity})`,
        note: `Verified ${rec.severity}: ${rec.title}`,
      });
    }
  } catch { /* global memory is best-effort, never break the hunt */ }
  return rec;
}

/**
 * PoC generator (problem #7): ask Bedrock to write a working proof-of-concept
 * for a verified finding, execute it in the container, verify the output.
 */
async function generatePoC(huntId, target, findingRec) {
  try {
    think(huntId, `Generating PoC for: ${findingRec.title}`);
    const reply = await callBrain(
      [{
        role: 'user',
        text: `Write a minimal, non-destructive proof-of-concept shell command (curl-based) that demonstrates this vulnerability:\n\nFinding: ${findingRec.title}\nEvidence: ${JSON.stringify(findingRec.evidence).slice(0, 1000)}\n\nTarget: ${target}\n\nReply with ONLY the shell command, no explanation.`,
      }],
      'You are a security researcher writing PoC commands. Output ONLY the command.',
      { huntId },
      // RULE #50 (30 Oct 2026): PoC drafting is advisory — the finding is
      // already recorded; a dead Ollama must skip it fast, not hang it.
      { huntId, advisory: true }
    );
    if (!reply) return;
    const cmd = reply.trim().split('\n')[0].replace(/^[$>]\s*/, '').slice(0, 500);
    if (!cmd || cmd.length < 10) return;
    think(huntId, 'Executing PoC...');
    const result = await execInHuntContainer(huntId, cmd, 60000);
    const out = (result.stdout || '').slice(0, 1000);
    // FIX (20 Oct 2026, solver #442): this stamped verified:true for ANY PoC
    // output longer than 20 chars — homepage CSS, curl timing printouts and
    // SPA fallback headers all became "PoC confirmed" findings. Require the
    // PoC command to have SUCCEEDED and its output to carry a real impact
    // signal (same vocabulary the finding pipeline uses).
    // LABEL-TRUST FIX (Lane A, 21 Oct 2026): the PoC stamp is a
    // verified:true write, so its signal must be an EVIDENCE signal
    // (non-negated, not the PoC command's own echoed text) — a PoC
    // command that echoes signal words, or output whose only signal
    // lines are negated, cannot confirm anything.
    if (!executionFailed(result, out) && out.trim().length > 20 && evidenceSignalIds(out, cmd).length > 0) {
      // CONTENT-RELEVANCE (solver #454): the PoC stamp is a verified:true
      // write, so the same binding applies — the PoC must have run against
      // the hunt target, its output's signal must be novel (not the
      // target's ambient page content: the #233/#256/#257 homepage-CSS
      // stamps), non-negated, AND share a signal family with the parent
      // finding it claims to prove (a stack-trace page does not prove a
      // login bypass). Tightening only.
      const baselines = await getTargetBaselines(huntId, target);
      const rel = assessContentRelevance({ command: cmd, target, output: out, baselines: baselines || [] });
      // LABEL-TRUST FIX (Lane A, 21 Oct 2026): family comparison over
      // evidence signals on BOTH sides. The parent's stored impact_demo
      // embeds its raw output excerpt — including any probe banner the
      // parent command printed verbatim — so raw extractSignal let a
      // retracted banner-labelled parent match an equally hollow PoC.
      const parentSigs = evidenceSignalIds(`${String(findingRec.evidence?.response || '')} ${String(findingRec.evidence?.impact_demo || '')}`, String(findingRec.evidence?.request || ''));
      const pocSigs = evidenceSignalIds(out, cmd);
      const sameFamily = pocSigs.some((s) => parentSigs.includes(s));
      if (rel.relevant && sameFamily) {
        // POC CONFIRMATION IS NOT A SECOND FINDING (27 Oct 2026,
        // 404-verified audit): the old code appended a second
        // type:'finding' event titled "PoC confirmed: X", and every
        // counter counted it — 5 unique findings showed as 10
        // verified on the live DVWA hunt. A confirmation is now a
        // non-countable event carrying the parent title + PoC
        // evidence for the audit trail; panel/chat/DOSSIER counts
        // come from the parent record only. The error-page limb in
        // assessContentRelevance already refused to stamp a 404 PoC.
        appendHuntEvent(huntId, {
          type: 'poc_confirmation',
          findingTitle: findingRec.title,
          class: 'poc_verified',
          title: `PoC confirmed: ${findingRec.title}`,
          severity: findingRec.severity,
          evidence: { poc_command: cmd, poc_output: out.slice(0, 500) },
          verified: true,
        });
        think(huntId, 'PoC executed — finding confirmed with working proof.');
      } else {
        think(huntId, `PoC output failed content-relevance (${rel.relevant ? `signal family ${pocSigs.join(',') || 'none'} does not match parent finding ${parentSigs.join(',') || 'none'}` : rel.reason}) — not stamping PoC confirmation.`);
      }
    }
  } catch {
    /* PoC is best-effort */
  }
}
