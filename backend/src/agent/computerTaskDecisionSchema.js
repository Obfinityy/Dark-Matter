/**
 * Computer-Task Decision Schema — the strict contract between InfiniteChat and
 * the local brain (requirement #21).
 *
 * The loop is: decide → validate → execute → observe → decide again. The brain
 * must reply with ONE JSON object of exactly this shape; anything else is
 * rejected before it can touch the computer layer.
 */

import { ACTION_TYPES, validateComputerAction } from '../computer/actionSchema.js';

export const TASK_DECISION_TYPES = Object.freeze([
  'action',     // one validated computer action (the "hands" run it)
  'observe',    // look without acting (screenshot / active window)
  'complete',   // goal satisfied — requires explicit verification evidence
  'ask_user',   // cannot proceed without information only the human has
  'retry',      // the last action failed; try a different valid approach
  'wait'        // wait for something to finish loading (bounded)
]);

export const TASK_PHASES = Object.freeze([
  'understanding', 'planning', 'executing', 'observing', 'verifying', 'finalizing'
]);

/**
 * Validate a parsed brain decision for a computer task.
 * @returns {{valid:boolean, errors:string[], decision:object|null}}
 */
export function validateComputerTaskDecision(decision) {
  const errors = [];

  if (!decision || typeof decision !== 'object' || Array.isArray(decision)) {
    return { valid: false, errors: ['Decision must be a JSON object'], decision: null };
  }

  if (typeof decision.reason !== 'string' || !decision.reason.trim()) {
    errors.push('Missing reason (non-empty string)');
  }

  const type = decision.type;
  if (!TASK_DECISION_TYPES.includes(type)) {
    errors.push(`Invalid type "${type}". Allowed: ${TASK_DECISION_TYPES.join(', ')}`);
  } else {
    switch (type) {
      case 'action': {
        const action = decision.action;
        if (!action || typeof action !== 'object') {
          errors.push('action decision requires an "action" object');
        } else if (!ACTION_TYPES.includes(action.type)) {
          errors.push(`action "${action.type}" is not a whitelisted computer action (allowed: ${ACTION_TYPES.join(', ')})`);
        } else {
          // Deep-validate parameters now so an invalid action dies at the
          // schema layer, never at the Python bridge.
          const result = validateComputerAction({ type: action.type, params: action.params || {} });
          if (!result.valid) errors.push(...result.errors.map((e) => `action params: ${e}`));
        }
        if (typeof decision.userMessage !== 'undefined' && decision.userMessage !== null && typeof decision.userMessage !== 'string') {
          errors.push('userMessage must be a string');
        }
        break;
      }
      case 'observe': {
        const method = decision.method || 'active_window';
        if (!['active_window', 'screenshot', 'browser_state'].includes(method)) {
          errors.push('observe method must be active_window, screenshot or browser_state');
        }
        break;
      }
      case 'complete':
        if (typeof decision.verificationEvidence !== 'string' || !decision.verificationEvidence.trim()) {
          errors.push('complete requires verificationEvidence: quote the observation that proves the goal is met');
        }
        if (typeof decision.userMessage !== 'string' || !decision.userMessage.trim()) {
          errors.push('complete requires userMessage: the short human-facing completion summary');
        }
        break;
      case 'ask_user':
        if (typeof decision.question !== 'string' || !decision.question.trim()) {
          errors.push('ask_user requires a question for the human');
        }
        break;
      case 'retry':
        if (typeof decision.adjustment !== 'string' || !decision.adjustment.trim()) {
          errors.push('retry requires an adjustment: what will be done differently');
        }
        break;
      case 'wait':
        if (decision.seconds !== undefined) {
          const seconds = Number(decision.seconds);
          if (!Number.isFinite(seconds) || seconds < 1 || seconds > 15) {
            errors.push('wait.seconds must be a number between 1 and 15');
          }
        }
        break;
      default:
        break;
    }
  }

  if (decision.confidence !== undefined) {
    const confidence = Number(decision.confidence);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
      errors.push('confidence must be a number between 0 and 1');
    }
  }

  if (errors.length) return { valid: false, errors, decision: null };

  const normalized = {
    type,
    reason: decision.reason.trim(),
    phase: typeof decision.phase === 'string' && TASK_PHASES.includes(decision.phase) ? decision.phase : null,
    confidence: decision.confidence === undefined ? null : Number(decision.confidence),
    planStep: typeof decision.planStep === 'string' ? decision.planStep.trim().slice(0, 300) : null
  };

  switch (type) {
    case 'action':
      normalized.action = { type: decision.action.type, params: decision.action.params || {} };
      normalized.userMessage = typeof decision.userMessage === 'string' && decision.userMessage.trim()
        ? decision.userMessage.trim().slice(0, 300)
        : `Running ${decision.action.type}…`;
      break;
    case 'observe':
      normalized.method = decision.method || 'active_window';
      normalized.userMessage = typeof decision.userMessage === 'string' && decision.userMessage.trim()
        ? decision.userMessage.trim().slice(0, 300)
        : 'Observing the screen…';
      break;
    case 'complete':
      normalized.verificationEvidence = decision.verificationEvidence.trim().slice(0, 1000);
      normalized.userMessage = decision.userMessage.trim().slice(0, 1000);
      break;
    case 'ask_user':
      normalized.question = decision.question.trim().slice(0, 1000);
      break;
    case 'retry':
      normalized.adjustment = decision.adjustment.trim().slice(0, 500);
      break;
    case 'wait':
      normalized.seconds = Number(decision.seconds ?? 3);
      break;
    default:
      break;
  }

  return { valid: true, errors: [], decision: normalized };
}

/**
 * The JSON contract, sent verbatim to the local model as part of the system
 * prompt. Deliberately compact — the phone model has a finite window.
 */
export const COMPUTER_TASK_SCHEMA_PROMPT = `You MUST reply with ONE valid JSON object and nothing else. Schema:

{
  "type": "action" | "observe" | "complete" | "ask_user" | "retry" | "wait",
  "action": { "type": "<one whitelisted computer action>", "params": { } },
  "method": "active_window" | "screenshot" | "browser_state",
  "reason": "why this is the right next step",
  "userMessage": "short progress line for the human, e.g. 'Opening Microsoft Word…'",
  "verificationEvidence": "for complete only: quote the observation that proves the goal is met",
  "question": "for ask_user only",
  "adjustment": "for retry only: what you will do differently",
  "seconds": 3,
  "planStep": "which plan step this advances, e.g. 'Open Word'",
  "confidence": 0.9
}

DECISION RULES:
- Exactly ONE next step per reply. After "action" and "observe" the engine will run the step and show you the real observation; then decide again.
- Use "complete" ONLY when an observation you were actually given proves the goal. Never guess. Quote that observation in verificationEvidence.
- If the last action failed or the screen is not what you expected, prefer "retry" with a genuinely different approach, or "ask_user" if only the human can unblock you.
- "wait" (max 15s) is for slow application loading. Re-observe after waiting.
- Never claim success without evidence. Never invent window titles, coordinates or text.`;

/** Compact variant for small context windows. */
export const COMPUTER_TASK_SCHEMA_PROMPT_COMPACT = `Reply with ONE JSON object only:
{"type":"action|observe|complete|ask_user|retry|wait","action":{"type":"...","params":{}},"method":"active_window|screenshot|browser_state","reason":"...","userMessage":"...","verificationEvidence":"...","question":"...","adjustment":"...","seconds":3,"planStep":"...","confidence":0.9}
Rules: one step per reply; complete ONLY with quoted observation evidence; never invent screen contents.`;
