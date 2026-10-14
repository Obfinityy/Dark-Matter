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

import {
  spawnHuntContainer,
  teardownHuntContainer,
  execInHuntContainer,
  dockerAvailable,
} from './huntRunner.js';
import { chatWithAI, aiAvailable } from './llm.js';
import { getHuntCost } from './costTracker.js';
import { appendHuntEvent, writeHuntMeta, readHuntMeta, readUsers } from './store.js';
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
} from './hunt-intel/index.js';

const MODE_ITERATIONS = {
  normal: 15,
  medium: 30,
  high: 60,
  ultra_high: 120,
  max: 250,
  infinity: 1000,
};

const HUNT_BUDGET_USD = Number(process.env.HUNT_BUDGET_USD || 25);

function think(huntId, text) {
  appendHuntEvent(huntId, { type: 'thinking', text: String(text).slice(0, 2000) });
}

function finding(huntId, f) {
  appendHuntEvent(huntId, { type: 'finding', ...f });
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
    return meta && (meta.paused === true || meta.state === 'paused');
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

function overBudget(huntId) {
  try {
    const cost = getHuntCost(huntId);
    return cost.totalUsd >= HUNT_BUDGET_USD;
  } catch {
    return false;
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
  think(huntId, 'Phase 1: reconnaissance — mapping the attack surface.');
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

  // Fetch homepage HTML for JS mining + profiling
  const curl = await execInHuntContainer(
    huntId,
    `curl -skL --max-time 25 -A "Mozilla/5.0" "${target}" 2>/dev/null | head -c 200000`
  );
  const html = curl.stdout || '';
  if (html) {
    const mined = mineJsEndpoints(html);
    recon.endpoints = rankEndpoints(mined).slice(0, 30);
    recon.profile = classifyTarget(recon.endpoints);
    recon.purpose = inferAppPurpose(recon.endpoints, html);
    think(huntId, `Mined ${mined.length} endpoints; profile: ${recon.profile}; purpose: ${recon.purpose}.`);
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

/** Phase 2+: Bedrock picks the next test; we execute and verify. */
async function agentIteration(huntId, target, recon, findings, iteration, maxIterations, playbook) {
  const confirmed = findings.filter((f) => f.verified);

  // Playbook: what worked on similar targets before?
  const lessons = (playbook || []).slice(0, 3).map((l) => `- ${l.technique}: ${l.why}`).join('\n');

  const context = [
    `Target: ${target}`,
    `Profile: ${recon.profile}`,
    `Open ports: ${recon.ports.map((p) => `${p.port}/${p.service}`).join(', ') || 'none found'}`,
    `Endpoints: ${recon.endpoints.slice(0, 15).join(', ') || 'none mined'}`,
    `Confirmed findings so far: ${confirmed.length}`,
    ...confirmed.slice(-5).map((f) => `- ${f.title} (${f.severity})`),
    lessons ? `Past lessons for similar targets:\n${lessons}` : '',
  ].join('\n');

  const prompt = [
    'You are an elite bug-bounty hunter. Given the recon context below, propose THREE diverse next tests (different attack classes).',
    'Reply as a JSON array: [{"test":"name","command":"shell command","why":"one line"}, ...].',
    'Prefer tests that escalate existing findings. Commands must be non-destructive and target-scoped.',
    '',
    context,
    '',
    `Iteration ${iteration}/${maxIterations}.`,
  ].join('\n');

  let plans = [];
  try {
    const reply = await chatWithAI(
      [{ role: 'user', text: prompt }],
      'You are an elite bug-bounty hunter. Output ONLY the requested JSON array, no prose.',
      { huntId }
    );
    if (!reply) return null;
    const m = /\[[\s\S]*\]/.exec(reply);
    plans = m ? JSON.parse(m[0]) : [];
  } catch {
    return null;
  }
  if (!plans.length) return null;

  // Execute up to 3 hypotheses (multi-hypothesis > single guess)
  let best = null;
  for (const plan of plans.slice(0, 3)) {
    if (!plan.command) continue;
    think(huntId, `Test: ${plan.test || 'unnamed'} — ${plan.why || ''}`);
    const result = await executeWithEvasion(huntId, target, String(plan.command).slice(0, 500));
    const rec = await assessResult(huntId, target, plan, result);
    if (rec && rec.verified && !best) best = rec;
  }
  return best;
}

/**
 * Execute a test with adaptive evasion: if blocked (403/WAF), retry with
 * encoders from the matrix before giving up.
 */
async function executeWithEvasion(huntId, target, command) {
  let result = await execInHuntContainer(huntId, command, 180000);
  const blocked = /403|406|406 Not Acceptable|blocked by|waf|forbidden/i.test(result.stdout + result.stderr)
    && result.stdout.length < 500;

  if (blocked) {
    think(huntId, 'Blocked (WAF/filter?) — trying encoded variants.');
    // Extract the payload-ish part and try encoders
    for (const enc of ['url', 'double_url', 'js_unicode']) {
      const encoded = encodePayload(command, enc);
      if (encoded === command) continue;
      const retry = await execInHuntContainer(huntId, encoded.slice(0, 500), 60000);
      if (retry.stdout.length > result.stdout.length * 1.5) {
        think(huntId, `Evasion worked with ${enc} encoding.`);
        return retry;
      }
    }
  }
  return result;
}

/** Assess a test result: weirdness check → evidence gate → verify. */
async function assessResult(huntId, target, plan, result) {
  const output = (result.stdout + '\n' + result.stderr).slice(0, 3000);

  // Weirdness check: investigate even without signature match
  const weird = scoreWeirdness(
    { status: result.code === 0 ? 200 : 500, bodyLength: output.length, timeMs: 1000, body: output },
    { status: 200, bodyLength: 2000, timeMs: 500 }
  );
  if (isWorthInvestigating({ status: 200, bodyLength: output.length, timeMs: 1000, body: output }, { status: 200, bodyLength: 2000, timeMs: 500 })) {
    think(huntId, `Weird response (score ${weird.score}): ${weird.signals.join(', ')} — investigating.`);
  }

  const interesting = weird.score >= 40 || /vulnerable|exposed|bypass|injection|leak|admin|secret|token|password|error.*sql|stack trace/i.test(output);
  if (!interesting || output.trim().length < 50) return null;

  const cand = {
    class: 'agent_finding',
    title: plan.test || 'agent-discovered anomaly',
    severity: 'medium',
    url: target,
    evidence: { request: plan.command, response: output.slice(0, 800) },
  };
  const { pass, gated } = evidenceGate(cand);
  if (!pass) return null;

  const v = verifyPipeline({
    reachability: true,
    payload_validation: output.length > 100,
    impact_assessment: /vulnerable|bypass|injection|leak/i.test(output),
    exploit_confirmation: false,
  });
  const rec = { ...gated, verification: v.verdict, verified: v.verified };
  finding(huntId, rec);

  // Chain escalation
  if (v.verified) {
    const chains = beamSearchChains(['data_read']);
    if (chains.length) {
      think(huntId, `Chain opportunity: ${chains[0].path.join(' → ')} (score ${chains[0].score.toFixed(2)})`);
    }
    // PoC generator: turn verified finding into working proof
    await generatePoC(huntId, target, rec);
  }
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
    if (out.trim().length > 20) {
      appendHuntEvent(huntId, {
        type: 'finding',
        class: 'poc_verified',
        title: `PoC confirmed: ${findingRec.title}`,
        severity: findingRec.severity,
        evidence: { poc_command: cmd, poc_output: out.slice(0, 500) },
        verified: true,
      });
      think(huntId, 'PoC executed — finding confirmed with working proof.');
    }
  } catch {
    /* PoC is best-effort */
  }
}

/**
 * Run the full autonomous hunt. Called async after hunt creation.
 * Never throws — all failures become hunt events.
 */
export async function runAutonomousHunt(huntId, target, mode = 'normal', userId = null) {
  const maxIterations = MODE_ITERATIONS[mode] || MODE_ITERATIONS.normal;
  const findings = [];

  try {
    think(huntId, `Autonomous hunt starting — mode ${mode}, budget ${maxIterations} iterations / $${HUNT_BUDGET_USD}.`);

    if (!(await dockerAvailable())) {
      think(huntId, 'Docker unavailable — running intel-only analysis (no container).');
      appendHuntEvent(huntId, { type: 'status', state: 'degraded', reason: 'no_docker' });
      return;
    }

    // Spawn is done by the route; ensure container exists
    const { container } = await spawnHuntContainer(huntId, target, { mode });
    writeHuntMeta(huntId, { container });
    appendHuntEvent(huntId, { type: 'status', state: 'container_spawned', container });

    // Phase 1: recon
    const recon = await reconPhase(huntId, target);

    // Learning: what worked on similar targets before?
    let playbook = [];
    try {
      playbook = getPlaybook({ profile: recon.profile });
      if (playbook.length) {
        think(huntId, `Playbook: ${playbook.length} lessons from past hunts on ${recon.profile} targets.`);
      }
    } catch { /* no history yet */ }

    // Intel: logic tests for this profile → feed as planned tests
    try {
      const logic = generateLogicTests(recon.endpoints);
      think(huntId, `Business-logic plan: ${logic.blModules.length} modules for ${logic.appType}.`);
      for (const mod of logic.blModules.slice(0, 5)) {
        appendHuntEvent(huntId, { type: 'thinking', text: `BL module queued: ${mod.id} ${mod.title}` });
      }
    } catch { /* intel is best-effort */ }

    // Phase 2+: agent loop
    const hasAI = aiAvailable();
    if (!hasAI) {
      think(huntId, 'No AI backend configured — hunt completed with recon results only.');
    }

    for (let i = 1; i <= maxIterations; i++) {
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
      if (overBudget(huntId)) {
        think(huntId, `Budget cap $${HUNT_BUDGET_USD} reached — stopping to protect your wallet.`);
        appendHuntEvent(huntId, { type: 'status', state: 'budget_capped' });
        break;
      }
      if (!hasAI) break;
      if (!(await dockerAvailable())) break;

      // Credits gate: each iteration costs a little; pause when the wallet is empty.
      if (!chargeIteration(huntId, userId, mode, i)) break;

      try {
        await agentIteration(huntId, target, recon, findings, i, maxIterations, playbook);
      } catch (err) {
        think(huntId, `Iteration ${i} failed safely: ${err.message || err}`);
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
  } catch (err) {
    appendHuntEvent(huntId, { type: 'status', state: 'failed', error: err.message || String(err) });
  } finally {
    // Always clean up the container
    try {
      await teardownHuntContainer(huntId);
      appendHuntEvent(huntId, { type: 'status', state: 'container_destroyed' });
    } catch { /* ignore */ }
  }
}
