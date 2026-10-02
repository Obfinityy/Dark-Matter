/**
 * dualBrainOrchestrator.js — Two-brain architecture for elite bug bounty.
 *
 * ┌─────────────────┐     "what to do"      ┌──────────────────┐
 * │  HACKING BRAIN  │ ───────────────────▶  │  CONTROL BRAIN   │
 * │  (local, uncens │   strategy, plan,     │  (Kaggle vision,  │
 * │   sored Qwen/   │   reasoning           │   Infinity Agent) │
 * │   Gemma via     │                       │                  │
 * │   llama.cpp)    │ ◀───────────────────  │  Sees screenshots,│
 * └─────────────────┘   observation data    │  clicks, types    │
 *                                           └──────────────────┘
 *
 * The hacking brain NEVER touches the desktop. It thinks in strategy:
 *   "Target is WordPress. Check /wp-admin, then test SQLi on ?id=."
 *
 * The control brain NEVER strategizes. It executes:
 *   "Open Edge → navigate → screenshot → click → type → observe"
 *
 * This separation is what makes the agent elite: deep security reasoning
 * + precise visual execution, each brain doing what it's best at.
 */

const PHASES = ['recon', 'detect', 'verify', 'exploit', 'report'];

/**
 * Ask the hacking brain for the next strategic step.
 * @param {object} hackingBrain - provider with generate()
 * @param {object} context - { target, techStack, findings[], phase, history[] }
 * @returns {Promise<{action: string, reasoning: string, controlInstruction: string}>}
 */
export async function hackingBrainDecide(hackingBrain, context = {}) {
  const {
    target = 'unknown',
    techStack = [],
    findings = [],
    phase = 'recon',
    history = [],
  } = context;

  const prompt = [
    'You are an elite bug bounty hunter AI. Think strategically.',
    '',
    `Target: ${target}`,
    `Technology: ${techStack.join(', ') || 'unknown'}`,
    `Current phase: ${phase} (phases: ${PHASES.join(' → ')})`,
    `Findings so far: ${findings.length}`,
    ...findings.slice(-5).map((f) => `  - ${f.type} @ ${f.url} (${f.confidence})`),
    `Recent actions:`,
    ...history.slice(-5).map((h) => `  - ${h}`),
    '',
    'Decide the SINGLE next strategic step. Respond with ONLY valid JSON:',
    '{"reasoning": "why this step", "controlInstruction": "exact natural-language instruction for the desktop-control brain, e.g. \'open Edge and go to http://target.com/wp-admin\'", "phase": "next phase name"}',
  ].join('\n');

  const raw = await hackingBrain.generate([{ role: 'user', content: prompt }]);
  try {
    // Extract JSON from response (may have prose around it).
    const match = String(raw).match(/\{[\s\S]*\}/);
    if (!match) throw new Error('no JSON in response');
    const parsed = JSON.parse(match[0]);
    return {
      reasoning: String(parsed.reasoning || ''),
      controlInstruction: String(parsed.controlInstruction || ''),
      phase: PHASES.includes(parsed.phase) ? parsed.phase : phase,
    };
  } catch {
    // Fallback: treat whole response as instruction.
    return {
      reasoning: 'Fallback: using raw response as instruction',
      controlInstruction: String(raw).slice(0, 500),
      phase,
    };
  }
}

/**
 * Execute one full dual-brain cycle:
 *   1. Hacking brain decides WHAT
 *   2. Control brain executes HOW (via Infinity Agent)
 *   3. Observation returns to hacking brain
 *
 * @param {object} deps - { hackingBrain, controlBrain, context }
 * @returns {Promise<{decision, observation}>}
 */
export async function dualBrainCycle({ hackingBrain, controlBrain, context }) {
  // Step 1: Strategic decision.
  const decision = await hackingBrainDecide(hackingBrain, context);

  if (!decision.controlInstruction) {
    return { decision, observation: null, skipped: true };
  }

  // Step 2: Visual execution via Infinity Agent.
  // controlBrain.execute(instruction) → runs observe→think→act loop,
  // returns { success, observations[], finalScreenshot? }
  const observation = await controlBrain.execute(decision.controlInstruction);

  return { decision, observation, skipped: false };
}

/**
 * Build context for the hacking brain from hunt state.
 */
export function buildHuntContext({ target, techStack, findings, phase, history }) {
  return { target, techStack: techStack || [], findings: findings || [], phase: phase || 'recon', history: history || [] };
}

export const DUAL_BRAIN = {
  PHASES,
  hackingBrainDecide,
  dualBrainCycle,
  buildHuntContext,
};

export default DUAL_BRAIN;
