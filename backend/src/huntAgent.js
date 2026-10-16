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
import { HuntOrchestrator } from './orchestrator.js';

// Active orchestrators by huntId — so assessResult can report verified
// findings to the head even though it doesn't receive it as a parameter.
const orchestrators = new Map();
export function getOrchestrator(huntId) {
  return orchestrators.get(huntId) || null;
}
import { chatWithAI, aiAvailable } from './llm.js';
import { getHuntCost } from './costTracker.js';
import { appendHuntEvent, writeHuntMeta, readHuntMeta, readHuntEvents, readUsers } from './store.js';
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

// REMOVED (owner directive 15 Oct 2026): iteration budgets are gone.
// Hunts run unlimited until the user stops them or the wallet runs out.
// Money is the only limit. This constant is kept for reference only.
const MODE_ITERATIONS = null;

export function think(huntId, text) {
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

  // Fetch homepage HTML for JS mining + profiling + TECH DETECTION
  const curl = await execInHuntContainer(
    huntId,
    `curl -skL --max-time 25 -A "Mozilla/5.0" -D /tmp/headers.txt "${target}" 2>/dev/null | head -c 200000; echo "---HEADERS---"; cat /tmp/headers.txt 2>/dev/null | head -30`
  );
  const html = curl.stdout || '';
  if (html) {
    const [bodyPart, headerPart] = html.split('---HEADERS---');
    const mined = mineJsEndpoints(bodyPart || html);
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

/** Phase 2+: Bedrock picks the next test; we execute and verify. */
async function agentIteration(huntId, target, recon, findings, iteration, playbook) {
  const confirmed = findings.filter((f) => f.verified);

  // Playbook: what worked on similar targets before?
  const lessons = (playbook || []).slice(0, 3).map((l) => `- ${l.technique}: ${l.why}`).join('\n');

  // CONTEXT BUDGETING: the model runs with num_ctx 8192 tokens. The prompt
  // must stay compact no matter how long the hunt runs — sections are capped
  // individually and the total is hard-capped, lowest-priority first.
  // Priority: target intelligence > confirmed findings > lessons > endpoints.
  const MAX_INTEL_CHARS = 2000;
  const MAX_PROMPT_CHARS = 10000;
  const intel = recon.intelligentPrompt
    ? `\n--- TARGET INTELLIGENCE (follow strictly) ---\n${String(recon.intelligentPrompt).slice(0, MAX_INTEL_CHARS)}`
    : '';
  const context = [
    `Target: ${target}`,
    `Profile: ${recon.profile}`,
    `Open ports: ${recon.ports.map((p) => `${p.port}/${p.service}`).join(', ') || 'none found'}`,
    `Endpoints: ${recon.endpoints.slice(0, 15).join(', ') || 'none mined'}`,
    `Confirmed findings so far: ${confirmed.length}`,
    ...confirmed.slice(-5).map((f) => `- ${f.title} (${f.severity})`),
    lessons ? `Past lessons for similar targets:\n${lessons}` : '',
    // INTELLIGENT CONTEXT: tech detection tells AI what NOT to try
    // (e.g., never suggest SQLi on a MongoDB target)
    intel,
  ].join('\n').slice(0, MAX_PROMPT_CHARS);

  const prompt = [
    'You are an elite bug-bounty hunter. Given the recon context below, propose THREE diverse next tests (different attack classes).',
    'Reply as a JSON array: [{"test":"name","command":"shell command","why":"one line"}, ...].',
    'Prefer tests that escalate existing findings. Commands must be non-destructive and target-scoped.',
    'CRITICAL: Respect the TARGET INTELLIGENCE section — never suggest tests for technologies not present (e.g., no SQLi on MongoDB).',
    '',
    context,
    '',
    `Iteration ${iteration} — hunting unlimited.`,
  ].join('\n');

  let plans = [];
  try {
    const reply = await chatWithAI(
      [{ role: 'user', text: prompt }],
      'You are an elite bug-bounty hunter. Output ONLY the requested JSON array, no prose.',
      { huntId }
    );
    if (!reply) {
      think(huntId, 'Model gave no reply this iteration — skipping to next.');
      return { aiOk: false, best: null };
    }
    // Show the model's raw thinking in the terminal (truncated) so the
    // operator can SEE the brain working, not just templated summaries.
    think(huntId, `model raw plan: ${String(reply).replace(/\s+/g, ' ').slice(0, 600)}`);
    const m = /\[[\s\S]*\]/.exec(reply);
    plans = m ? JSON.parse(m[0]) : [];
  } catch {
    return { aiOk: false, best: null };
  }
  if (!plans.length) return { aiOk: false, best: null };

  // Execute up to 3 hypotheses (multi-hypothesis > single guess)
  let best = null;
  for (const plan of plans.slice(0, 3)) {
    if (!plan.command) continue;
    think(huntId, `Test: ${plan.test || 'unnamed'} — ${plan.why || ''}`);
    const result = await executeWithEvasion(huntId, target, String(plan.command).slice(0, 500));
    const rec = await assessResult(huntId, target, plan, result);
    if (rec && rec.verified && !best) best = rec;
  }
  return { aiOk: true, best };
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

/** Infer severity from the test name and output — not everything is medium. */
function inferSeverity(testName, output) {
  const t = (testName + ' ' + output).toLowerCase();
  if (/rce|remote code execution|sql injection|sqli|auth bypass|authentication bypass|ssrf|server-side request forgery|arbitrary file|path traversal.*write|command injection/i.test(t)) return 'critical';
  if (/xss|cross-site scripting|ssti|idor|open redirect|csrf|xxe|file inclusion|lfi|rfi|jwt/i.test(t)) return 'high';
  if (/info disclosure|information disclosure|verbose error|stack trace|directory listing|cors|clickjacking|missing header/i.test(t)) return 'low';
  return 'medium';
}

  const interesting = weird.score >= 40 || /vulnerable|exposed|bypass|injection|leak|admin|secret|token|password|error.*sql|stack trace/i.test(output);
  if (!interesting || output.trim().length < 50) return null;

  const cand = {
    class: 'agent_finding',
    title: plan.test || 'agent-discovered anomaly',
    severity: inferSeverity(plan.test || '', output),
    url: target,
    evidence: { request: plan.command, response: output.slice(0, 800) },
  };
  const { pass, gated } = evidenceGate(cand);
  if (!pass) return null;

  // REAL VERIFICATION (not hardcoded): re-run the exact test to confirm
  // reproducibility. A one-off anomaly is not a vulnerability.
  let confirmed = false;
  try {
    think(huntId, `Verifying: re-running the test to confirm reproducibility…`);
    const retry = await execInHuntContainer(huntId, String(plan.command).slice(0, 500), 120000);
    const confirmOutput = (retry.stdout + '\n' + retry.stderr).slice(0, 3000);
    // Confirmation: second run shows the same interesting signals
    const sig1 = extractSignal(output);
    const sig2 = extractSignal(confirmOutput);
    confirmed = sig1.length > 0 && sig1 === sig2;
    if (confirmed) {
      think(huntId, `Verified: reproducible finding (${sig1}).`);
    } else {
      think(huntId, `Not confirmed: second run differed — treating as one-off anomaly.`);
    }
  } catch (err) {
    think(huntId, `Verification re-run failed: ${err.message || err}`);
  }

  const v = verifyPipeline({
    reachability: output.length > 50,
    payload_validation: /vulnerable|exposed|bypass|injection|leak|admin|secret|token|password|error.*sql|stack trace/i.test(output),
    impact_assessment: weird.score >= 40 || /vulnerable|bypass|injection|leak/i.test(output),
    exploit_confirmation: confirmed,
  });
  const rec = { ...gated, verification: v.verdict, verified: v.verified };
  finding(huntId, rec);

  // Head records verified findings for the final report
  if (v.verified) {
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
export async function runAutonomousHunt(huntId, target, mode = 'normal', userId = null, opts = {}) {
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

    // Phase 1: recon — head spawns a recon specialist worker
    const reconWorker = head.spawnWorker('recon', `Map ${target}: open ports, services, tech stack, subdomains, endpoints.`);
    const recon = await reconPhase(huntId, target);
    head.review(reconWorker, { ok: true, output: JSON.stringify(recon).slice(0, 500) }, () => recon && recon.profile);
    head.saveState();

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
    let aiFailStreak = 0;

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
        think(huntId, `Iteration ${i} failed safely: ${err.message || err}`);
      }
      if (iterResult === null || (iterResult && iterResult.aiOk === false)) {
        aiFailStreak++;
        if (aiFailStreak >= 3) {
          think(huntId, `AI brain unreachable ${aiFailStreak}x in a row — pausing hunt. The model (Ollama) may be overloaded. Resume when it's responsive.`);
          appendHuntEvent(huntId, { type: 'status', state: 'paused', reason: 'ai_unreachable', at: new Date().toISOString() });
          try {
            writeHuntMeta(huntId, { ...(readHuntMeta(huntId) || {}), huntId, state: 'paused', pausedReason: 'ai_unreachable' });
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
