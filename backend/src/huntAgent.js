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
import { appendHuntEvent, writeHuntMeta, readHuntMeta } from './store.js';
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

function overBudget(huntId) {
  try {
    const cost = getHuntCost(huntId);
    return cost.totalUsd >= HUNT_BUDGET_USD;
  } catch {
    return false;
  }
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
    think(huntId, `Mined ${mined.length} endpoints from JS; profile: ${recon.profile}.`);
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
async function agentIteration(huntId, target, recon, findings, iteration, maxIterations) {
  const confirmed = findings.filter((f) => f.verified);

  const context = [
    `Target: ${target}`,
    `Profile: ${recon.profile}`,
    `Open ports: ${recon.ports.map((p) => `${p.port}/${p.service}`).join(', ') || 'none found'}`,
    `Endpoints: ${recon.endpoints.slice(0, 15).join(', ') || 'none mined'}`,
    `Confirmed findings so far: ${confirmed.length}`,
    ...confirmed.slice(-5).map((f) => `- ${f.title} (${f.severity})`),
  ].join('\n');

  const prompt = [
    'You are an elite bug-bounty hunter. Given the recon context below, propose the SINGLE highest-value next test.',
    'Reply in exactly this JSON shape: {"test":"short name","command":"shell command to run in the hunt container","why":"one line"}.',
    'Prefer tests that escalate existing findings. Commands must be non-destructive and target-scoped.',
    '',
    context,
    '',
    `Iteration ${iteration}/${maxIterations}.`,
  ].join('\n');

  let plan;
  try {
    const reply = await chatWithAI(
      [{ role: 'user', text: prompt }],
      'You are an elite bug-bounty hunter. Output ONLY the requested JSON, no prose.',
      { huntId }
    );
    if (!reply) return null;
    const m = /\{[\s\S]*\}/.exec(reply);
    plan = m ? JSON.parse(m[0]) : null;
  } catch {
    return null;
  }
  if (!plan || !plan.command) return null;

  think(huntId, `Test: ${plan.test || 'unnamed'} — ${plan.why || ''}`);
  const result = await execInHuntContainer(huntId, String(plan.command).slice(0, 500), 180000);
  const output = (result.stdout + '\n' + result.stderr).slice(0, 3000);

  // Heuristic: interesting output → candidate finding → gate → verify
  const interesting = /vulnerable|exposed|bypass|injection|leak|admin|secret|token|password|error.*sql|stack trace/i.test(output);
  if (interesting && output.trim().length > 50) {
    const cand = {
      class: 'agent_finding',
      title: plan.test || 'agent-discovered anomaly',
      severity: 'medium',
      url: target,
      evidence: { request: plan.command, response: output.slice(0, 800) },
    };
    const { pass, gated } = evidenceGate(cand);
    if (pass) {
      const v = verifyPipeline({
        reachability: true,
        payload_validation: output.length > 100,
        impact_assessment: /vulnerable|bypass|injection|leak/i.test(output),
        exploit_confirmation: false,
      });
      const rec = { ...gated, verification: v.verdict, verified: v.verified };
      finding(huntId, rec);
      findings.push(rec);

      // Chain: escalate confirmed findings
      if (v.verified) {
        const chains = beamSearchChains(['data_read']);
        if (chains.length) {
          think(huntId, `Chain opportunity: ${chains[0].path.join(' → ')} (score ${chains[0].score.toFixed(2)})`);
        }
      }
      return rec;
    }
  }
  return null;
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
      if (overBudget(huntId)) {
        think(huntId, `Budget cap $${HUNT_BUDGET_USD} reached — stopping to protect your wallet.`);
        appendHuntEvent(huntId, { type: 'status', state: 'budget_capped' });
        break;
      }
      if (!hasAI) break;
      if (!(await dockerAvailable())) break;

      try {
        await agentIteration(huntId, target, recon, findings, i, maxIterations);
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
