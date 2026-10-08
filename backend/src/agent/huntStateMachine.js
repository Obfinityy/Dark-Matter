/**
 * huntStateMachine.js
 *
 * The agent's explicit self-awareness: at every moment the hunt is in ONE
 * well-defined state, and every reasoning cycle reads that state FIRST —
 * "nothing has started yet" → "I just did X" → "so next I should do Y".
 * This is what makes the system an AGENT instead of a script: it never
 * acts without knowing exactly where it stands.
 *
 * States:
 *   idle        — the hunt was created; nothing has happened yet.
 *   recon | enumeration | probing | exploitation | chaining | reporting
 *               — the methodology stage the hunt is actively working.
 *   verifying   — a hypothesis is being validated right now.
 *   waiting     — blocked on something outside its control (brain
 *                 unreachable, computer down); will resume by itself.
 *   paused      — the user paused; resumes from the exact persisted state.
 *   complete    — the objective is genuinely satisfied; report delivered.
 *
 * Transitions are explicit and validated. `transition()` is strict (throws
 * on an illegal move — used by tests and by developers reasoning about the
 * machine); `safeTransition()` never throws (used by the worker — a hunt
 * must never die because a state update was surprising; the anomaly is
 * logged and the state is preserved).
 *
 * The worker persists the state on the job after every step and renders it
 * as the FIRST section of the brain's prompt, so the model literally cannot
 * reason without reading its own state first.
 */

export const HUNT_STATES = Object.freeze([
  'idle',
  'recon',
  'enumeration',
  'probing',
  'exploitation',
  'chaining',
  'reporting',
  'verifying',
  'waiting',
  'paused',
  'complete',
]);

const METHODOLOGY_STATES = new Set([
  'recon',
  'enumeration',
  'probing',
  'exploitation',
  'chaining',
  'reporting',
]);

// Allowed moves. Anything not listed here is a bug in the caller.
const TRANSITIONS = {
  // idle → waiting is legal: a fresh hunt parks in "waiting" when the brain
  // is unavailable before the first reasoning cycle ever runs.
  idle: ['recon', 'waiting', 'paused', 'complete'],
  recon: ['recon', 'enumeration', 'probing', 'verifying', 'waiting', 'paused', 'complete'],
  enumeration: ['recon', 'enumeration', 'probing', 'verifying', 'waiting', 'paused', 'complete'],
  probing: ['enumeration', 'probing', 'exploitation', 'verifying', 'waiting', 'paused', 'complete'],
  exploitation: [
    'probing',
    'exploitation',
    'chaining',
    'verifying',
    'waiting',
    'paused',
    'complete',
  ],
  chaining: ['exploitation', 'chaining', 'reporting', 'verifying', 'waiting', 'paused', 'complete'],
  reporting: ['reporting', 'verifying', 'waiting', 'paused', 'complete'],
  verifying: [
    'recon',
    'enumeration',
    'probing',
    'exploitation',
    'chaining',
    'reporting',
    'waiting',
    'paused',
    'complete',
  ],
  waiting: [
    'recon',
    'enumeration',
    'probing',
    'exploitation',
    'chaining',
    'reporting',
    'verifying',
    'paused',
    'complete',
  ],
  paused: [
    'recon',
    'enumeration',
    'probing',
    'exploitation',
    'chaining',
    'reporting',
    'verifying',
    'waiting',
    'complete',
  ],
  complete: [],
};

/**
 * Initial Hunt State.
 * @returns {*} Result.
 */
export function initialHuntState() {
  return {
    status: 'idle',
    stage: 'recon',
    lastAction: null,
    lastOutcome: null,
    lastHypothesis: null,
    nextIntent: null,
    stepsTaken: 0,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Returns whether valid transition.
 * @param {*} from
 * @param {*} to
 * @returns {*} Result.
 */
export function isValidTransition(from, to) {
  if (!HUNT_STATES.includes(from) || !HUNT_STATES.includes(to)) return false;
  if (from === to) return true; // idempotent refresh, e.g. idle → idle
  return (TRANSITIONS[from] || []).includes(to);
}

/**
 * Strict transition: returns the new state, or throws on an illegal move.
 */
export function transition(state, to, patch = {}) {
  const from = state?.status || 'idle';
  if (!isValidTransition(from, to)) {
    throw new Error(`Illegal hunt-state transition: ${from} → ${to}`);
  }
  return {
    ...(state || initialHuntState()),
    ...patch,
    status: to,
    // Keep stage in sync when moving between methodology stages.
    stage: METHODOLOGY_STATES.has(to) ? to : patch.stage || state?.stage || 'recon',
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Non-throwing transition for the live loop: an illegal move is logged and
 * the state is preserved (with the attempted patch recorded for debugging).
 */
export function safeTransition(state, to, patch = {}, logger = console) {
  try {
    return transition(state, to, patch);
  } catch (error) {
    logger.warn?.(
      `[hunt-state] ${error.message} — preserving ${(state && state.status) || 'idle'}`
    );
    return {
      ...(state || initialHuntState()),
      ...patch,
      status: (state && state.status) || 'idle',
      lastTransitionError: error.message,
      updatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Render the state as the FIRST thing the brain reads each cycle:
 * "I just did X (outcome Y) → so next I should do Z."
 */
export function describeHuntStateForBrain(state, job = {}) {
  const s = state || initialHuntState();
  const lines = ['## YOUR CURRENT STATE (read this first — it is where you stand)'];
  lines.push(
    `- Status: ${s.status.toUpperCase()}${s.stage && s.status !== s.stage ? ` (methodology stage: ${s.stage})` : ''}`
  );

  if (s.status === 'idle') {
    lines.push(
      '- Nothing has started yet. This is your first reasoning cycle: orient on the target and scope, then take the first recon action.'
    );
  } else {
    if (s.lastAction) lines.push(`- You just did: ${s.lastAction}`);
    if (s.lastOutcome) lines.push(`- Outcome of that action: ${s.lastOutcome}`);
    if (s.lastHypothesis) lines.push(`- Your current hypothesis: ${s.lastHypothesis}`);
    if (s.nextIntent) lines.push(`- You previously intended next: ${s.nextIntent}`);
  }

  const steps = job.stepCount ?? s.stepsTaken ?? 0;
  const findings = job.findingsCount ?? 0;
  lines.push(`- Steps taken so far: ${steps}. Findings confirmed: ${findings}.`);
  if (s.status === 'waiting') {
    lines.push(
      '- You are WAITING (blocked). Decide whether the blocker cleared; if so, resume the hunt from the state above.'
    );
  } else if (s.status === 'paused') {
    lines.push('- You are PAUSED by the user. Do not act; acknowledge the pause.');
  } else if (s.status === 'complete') {
    lines.push('- The hunt is COMPLETE. Do not start new work.');
  } else {
    lines.push(
      '- Now choose the single next action that follows from the state above. Do not repeat what already worked or failed the same way.'
    );
  }
  return lines.join('\n');
}
