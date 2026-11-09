// Split out of huntAgent.js by the P3 professionalization lane (split-only, no behaviour change).
// Moved verbatim; huntAgent.js re-exports the public names so callers are unchanged.

import {
  spawnHuntContainer,
  teardownHuntContainer,
  execInHuntContainer,
  execInHuntContainerWithRespawn,
  dockerAvailable,
} from '../huntRunner.js';
import { guardCommand, scopeFromMeta } from '../scopeGuard.js';
import { recordReasoning, formatReasoningForPrompt, formatLedgerForPrompt, getHypothesisLedger, getPremiseLedger, getVerifiedPairs, normalizeHypothesis, getAllReasoning, buildFullHistoryLedger, searchRecall } from '../reasoningMemory.js';
import { recordGlobalLearning, getRelevantMemories, formatGlobalMemoryForPrompt, inferTechnique, readAllGlobalMemories } from '../globalMemory.js';
import { webSearch, searchCVE } from '../webSearch.js';
import { appendHuntEvent, writeHuntMeta, writeHuntMetaCheckpoint, readHuntMeta, readHuntEvents, readUsers, readTargetIntel, writeTargetIntel, huntDir, ensureHuntDir } from '../store.js';
import { episodeLedgerEnabled, retrieveEpisodes, formatRetrievalForPrompt, recordRuledOut, getRuledOutCounts, formatLessonsForPrompt, RETRY_BUDGET, recordFact } from '../episodeStore.js';
import { proposePlaybook, formatPlaybookForPrompt } from '../playbook.js';
import { summarizeToolOutput } from '../toolOutput.js';
import { handleArtifactCommand, spillOutput } from '../artifacts.js';
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

/**
 * FIX #21: Execute in container with auto-respawn.
 * If the container is missing (destroyed on pause, crashed, etc.),
 * respawn it automatically and retry the command once.
 */
async function execWithRespawn(huntId, target, mode, cmd, timeoutMs = 120000) {
  let result = await execInHuntContainer(huntId, cmd, timeoutMs);
  if (result.containerMissing) {
    think(huntId, 'Hunt container missing — respawning automatically.');
    try {
      const { container } = await spawnHuntContainer(huntId, target, { mode });
      appendHuntEvent(huntId, { type: 'status', state: 'container_respawned', container });
      // Retry the command once after respawn
      result = await execInHuntContainer(huntId, cmd, timeoutMs);
    } catch (err) {
      think(huntId, `Container respawn failed: ${err.message}`);
    }
  }
  return result;
}

/**
 * Execute a test with adaptive evasion: if blocked (403/WAF), retry with
 * encoders from the matrix before giving up.
 */
export async function executeWithEvasion(huntId, target, command) {
  // PLACEHOLDER SUBSTITUTION (19 Oct 2026, elite-gap; extended same-cycle):
  // The 8B model sometimes echoes literal placeholders into commands instead
  // of the concrete target URL. First observed: "nmap -sV [target] | grep -q
  // 'price manipulation'" → "Error resolving [target]: Name or service not
  // known" (fixed 2d95530 for [target]/<target>/{target}). Then observed live:
  // "curl -s 'http://target/basket' | grep -E 'price:...'" → bare word
  // "target" used as a URL hostname, which the bracket-only fix did not catch
  // (probe failed on DNS). Later the model used NEW placeholder words for the
  // same purpose: bare "app" as hostname ("curl -X POST 'http://app/endpoint'")
  // and hallucinated fake domains ("https://app.com/product/low-priced",
  // "https://target-url.com/api/v1/products") — all DNS failures, all meant
  // the hunt target (solver #115, 19 Oct 2026). Deterministically resolve ALL
  // known placeholder spellings against the authorised hunt target BEFORE
  // execution. Scheme-aware hostname substitution runs FIRST so
  // "http://[target]/x" becomes "http://<real-host>/x" (not "http://http://...").
  // A model-supplied port is kept and applied to the bare hostname (avoids
  // doubling the port). The hostname pattern only matches the placeholder as
  // the FULL URL hostname (never inside paths or longer words like
  // "myapp.local"), and fake-domain replacement covers only the two domains
  // the model has actually hallucinated — real external domains are untouched.
  // This changes nothing about validation — output still goes through
  // evidenceGate and the 4-step verification — it only ensures the command
  // addresses the real target instead of a non-existent literal string.
  {
    let targetHost = String(target), targetHostname = String(target);
    try {
      const u = new URL(String(target));
      targetHost = u.host;         // e.g. 172.17.0.1:3000 (hostname + port)
      targetHostname = u.hostname;  // e.g. 172.17.0.1 (no port)
    } catch { /* target isn't a parseable URL — fall back to the raw string */ }
    const before = String(command);
    command = before
      // 19 Oct 2026 (solver #165): capture + conditionally re-emit the bracket
      // groups. The old callback dropped a consumed closing quote, so a
      // well-grounded quoted probe like url = 'http://TARGET' became
      // url = 'http://172.17.0.1:3000 (unterminated → SyntaxError, quarantined
      // as a false positive — finding #116). Now: a trailing quote is kept
      // only when the placeholder had NO opening bracket of its own (the
      // model's own shell quoting). Symmetric placeholder brackets
      // (http://[target]/x, 'http://<target>/y') are still dropped, keeping
      // the documented http://[target]/x → http://<real-host>/x behaviour.
      .replace(/(https?:\/\/)([[<{"'$]?)(?:target|app)([\]>\"'}]?)((?::\d+)?)(?=[/?#:;\s]|$)/gi,
        (m, scheme, open, close, port) => scheme + (port ? targetHostname : targetHost) + port + (open ? '' : close))
      .replace(/(https?:\/\/)app\.com((?::\d+)?)(?=[/?#:;\s]|$)/gi,
        (m, scheme, port) => scheme + (port ? targetHostname : targetHost) + port)
      .replace(/(https?:\/\/)target-url\.com((?::\d+)?)(?=[/?#:;\s]|$)/gi,
        (m, scheme, port) => scheme + (port ? targetHostname : targetHost) + port)
      .replace(/\[target\]/gi, target)
      .replace(/<target>/gi, target)
      .replace(/\$\{target\}/gi, target)
      .replace(/\{target\}/gi, target)
      .replace(/\$target\b/gi, target);
    if (command !== before) {
      think(huntId, 'Replaced a literal target placeholder with the real target before executing (model wrote a placeholder).');
    }
  }
  // QUOTING-ROBUSTNESS (31 Oct 2026): the 8B brain emits probe commands
  // with unbalanced payload quotes (seen live: SQLi probe died exit 2 on
  // sh -c). repairShellQuoting only rewrites already-unparseable commands
  // — balanced commands pass through byte-identical.
  {
    const repaired = repairShellQuoting(command);
    if (repaired !== command) {
      think(huntId, 'Fixed unbalanced shell quoting in the probe command before executing (unquoted payload URL wrapped / dangling quote closed).');
      command = repaired;
    }
  }
  // Person capability: web search mid-hunt. If the model doesn't know
  // something, it can ask via "SEARCH: <query>" instead of guessing.
  const searchMatch = /^\s*SEARCH:\s*(.+)/i.exec(command);
  if (searchMatch) {
    const query = searchMatch[1].slice(0, 200);
    think(huntId, `Searching the web: ${query}`);
    try {
      const results = await webSearch(query, 5);
      const text = results.length === 0
        ? 'No web results found.'
        : results.map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}`).join('\n');
      // ACI (stage 7): bounded envelope + explicit empty marker.
      return { stdout: summarizeToolOutput(text).text, stderr: '', exitCode: 0 };
    } catch {
      return { stdout: 'Web search failed.', stderr: '', exitCode: 1 };
    }
  }
  // Person capability (20 Oct 2026, solver #443): RECALL — on-demand
  // retrieval from his own notebook. SEARCH asks the web; RECALL asks his
  // past: this hunt's events + reasoning and the global-memory store.
  // Matches return as the command result AND are stashed on the hunt meta
  // so the next planning prompt carries them in a RECALLED MEMORY section.
  const recallMatch = /^\s*RECALL:\s*(.+)/i.exec(command);
  if (recallMatch) {
    const query = recallMatch[1].slice(0, 200);
    think(huntId, `Recalling: ${query}`);
    try {
      const rec = searchRecall({
        events: readHuntEvents(huntId),
        reasoningRows: getAllReasoning(huntId),
        globalMemories: readAllGlobalMemories(),
        query,
        limit: 8,
      });
      // Job 6 stage 2: RECALL routes through the SAME hybrid retrieval as
      // the automatic prompt slice (episode ledger, code-scored). Its hits
      // lead the reply; the reasoning/global-memory matches follow. If the
      // ledger is unavailable the original recall text stands alone.
      let ledgerText = '';
      let ledgerHits = 0;
      try {
        if (episodeLedgerEnabled()) {
          const ret = await retrieveEpisodes(query, { huntId, crossHunt: true, limit: 6 });
          ledgerHits = ret.results.length;
          if (ledgerHits) {
            ledgerText = formatRetrievalForPrompt(ret.results, { budgetChars: 2500, query });
          }
        }
      } catch { /* ledger recall is best-effort */ }
      const merged = ledgerText ? `${ledgerText}\n\n${rec.text}` : rec.text;
      // ACI (stage 7): the model reads back a bounded envelope, never a raw dump.
      const text = summarizeToolOutput(merged, { maxChars: 4000 }).text;
      appendHuntEvent(huntId, { type: 'recall', query, hits: rec.hits, ledgerHits });
      try {
        writeHuntMetaCheckpoint(huntId, { recallSection: { query, text: text.slice(0, 3000), at: new Date().toISOString() } });
      } catch { /* stash is best-effort */ }
      return { stdout: text, stderr: '', exitCode: 0 };
    } catch {
      return { stdout: 'Recall failed.', stderr: '', exitCode: 1 };
    }
  }
  // Person capability (Job 6 stage 5): PROPOSE_PLAYBOOK — the agent
  // proposes a playbook rule. Proposals are inert data; the promotion
  // gate in playbook.js makes a rule live ONLY after a validator-
  // confirmed success matches it. No success, no promotion — ever.
  const proposeMatch = /^\s*PROPOSE_PLAYBOOK:\s*(.+)/i.exec(command);
  if (proposeMatch) {
    const rule = proposeMatch[1].slice(0, 240);
    try {
      const id = proposePlaybook({ huntId, rule });
      appendHuntEvent(huntId, { type: 'playbook_proposal', proposalId: id, rule });
      think(huntId, `Playbook proposal recorded (${id || 'rejected'}): ${rule.slice(0, 100)}`);
      return {
        stdout: id
          ? 'Proposal recorded. It becomes a permanent playbook rule only after a validator-confirmed success matches it.'
          : 'Proposal rejected (empty rule).',
        stderr: '',
        exitCode: 0,
      };
    } catch {
      return { stdout: 'Proposal failed to record.', stderr: '', exitCode: 1 };
    }
  }
  // Person capability (solver #459): FILE ARTIFACTS — WRITE_ARTIFACT /
  // APPEND_ARTIFACT / READ_ARTIFACT / RUN_ARTIFACT. Long scripts and notes
  // live as files in the hunt workspace (unbounded, permanent); the prompt
  // only ever carries the handle. See artifacts.js for the grammar.
  try {
    const artifactResult = await handleArtifactCommand(huntId, command);
    if (artifactResult) return artifactResult;
  } catch { /* artifact layer must never break normal execution */ }

  // OUTPUT SPILL (solver #459): a large tool output is preserved IN FULL
  // as an artifact and the handle is noted in the hunt stream, so the
  // agent can READ_ARTIFACT any slice later. The result object itself is
  // returned untouched — the verifier keeps consuming the raw output
  // exactly as before.
  const maybeSpill = (r) => {
    try {
      const combined = `${r.stdout || ''}\n${r.stderr || ''}`;
      if (combined.length > 4000) {
        const name = spillOutput(huntId, combined);
        think(huntId, `Large tool output (${combined.length} chars) saved in full as artifact ${name} — READ_ARTIFACT: ${name} <start>:<end> reads any slice of it.`);
      }
    } catch { /* spill is best-effort */ }
    return r;
  };

  // P1 SCOPE ENFORCEMENT (31 Oct 2026, AUD-H1): deterministic destination
  // validation BEFORE any Docker execution — the last gate before the
  // command reaches the container. Placement is deliberate: AFTER the
  // placeholder substitution + quoting repair (so we validate the real
  // command) and AFTER the pseudo-command early-returns (SEARCH:/RECALL:/
  // artifacts are internal, not network traffic). Fail-closed: a blocked
  // command is NOT executed; the block is logged as an audit event so it
  // is visible on the frontend stream. guardCommand() also accepts
  // structured `destinations` for callers that provide them (preferred —
  // robust); here we validate the command text.
  {
    let gscope = null;
    try {
      gscope = scopeFromMeta(readHuntMeta(huntId) || {}, target, process.env.LAB_TARGETS || '');
    } catch { /* fall through to fail-closed below */ }
    const gate = guardCommand({ command, scope: gscope });
    if (!gate.allowed) {
      const reason = gate.reason || 'scope validation failed';
      try {
        appendHuntEvent(huntId, {
          type: 'scope_block',
          reason,
          blocked: gate.blocked || null,
          command: String(command).slice(0, 500),
        });
      } catch { /* the audit event must never break the hunt */ }
      think(huntId, `Scope guard blocked this command before execution: ${reason}. Staying inside the authorized hunt scope.`);
      return { stdout: '', stderr: `[scope-guard] blocked: ${reason}`, exitCode: 99, scopeBlocked: true };
    }
  }
  // Lane E: the human-mode shell path self-heals a missing container
  // (respawn + one retry) instead of handing the brain a dead machine —
  // pipeline mode had this via execWithRespawn, human mode did not.
  let result = await execInHuntContainerWithRespawn(huntId, command, 180000, {
    bypassTmux: true,
    target,
    mode: (readHuntMeta(huntId) || {}).mode,
  });
  if (result.respawned) think(huntId, 'Hunt container was missing — respawned automatically and retried the command.');
  else if (result.respawnFailed) think(huntId, 'Hunt container is missing and the automatic respawn failed — shell actions cannot run until it is back.');
  const blocked = /403|406|406 Not Acceptable|blocked by|waf|forbidden/i.test(result.stdout + result.stderr)
    && result.stdout.length < 500;

  if (blocked) {
    think(huntId, 'Blocked (WAF/filter?) — trying encoded variants.');
    // Extract the payload-ish part and try encoders
    for (const enc of ['url', 'double_url', 'js_unicode']) {
      const encoded = encodePayload(command, enc);
      if (encoded === command) continue;
      const retry = await execInHuntContainer(huntId, encoded.slice(0, 500), 60000, { bypassTmux: true });
      if (retry.stdout.length > result.stdout.length * 1.5) {
        think(huntId, `Evasion worked with ${enc} encoding.`);
        return maybeSpill(retry);
      }
    }
  }
  return maybeSpill(result);
}
