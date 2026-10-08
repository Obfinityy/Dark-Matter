/**
 * Autonomous Decision Schema — the strict contract for the local brain.
 *
 * The autonomous agent NEVER acts on free-form text. The phone-hosted Gemma
 * must return JSON matching this schema, and the decision then passes:
 *
 *     scopeEngine → policyValidator → tool registry   (tools)
 *     action schema → scope engine                    (computer actions)
 *
 * before anything executes (requirement #31, #37).
 */

import { ACTION_TYPES } from '../computer/actionSchema.js';

export const AUTONOMOUS_ACTION_TYPES = Object.freeze([
  'tool', // run a registry tool
  'parallel_tools', // run multiple INDEPENDENT tools at once (parallel recon)
  'computer_action', // drive the computer layer
  'observation', // record information into memory without acting
  'hypothesis', // raise a testable hypothesis
  'validate', // attempt to validate an existing hypothesis
  'finding', // promote a validated hypothesis to a finding
  'plan_update', // change the durable task plan
  'wait', // nothing to do right now (e.g. runtime unavailable)
  'complete', // assessment objectives satisfied
]);

export const CONFIDENCE_MIN = 0;
export const CONFIDENCE_MAX = 1;

/**
 * Validate a parsed brain decision.
 * @returns {{valid:boolean, errors:string[], decision:object|null}}
 */
export function validateAutonomousDecision(decision, options = {}) {
  const errors = [];
  // When the computer layer is disabled by configuration, computer_action
  // decisions are rejected at validation time so the brain's retry loop is
  // forced to choose a registry tool instead of looping on a dead layer.
  const computerActionAllowed = options.computerActionAllowed !== false;

  if (!decision || typeof decision !== 'object' || Array.isArray(decision)) {
    return { valid: false, errors: ['Decision must be a JSON object'], decision: null };
  }

  if (typeof decision.objective !== 'string' || !decision.objective.trim()) {
    errors.push('Missing objective (non-empty string)');
  }
  if (typeof decision.reason !== 'string' || !decision.reason.trim()) {
    errors.push('Missing reason (non-empty string)');
  }

  const action = decision.nextAction;
  if (!action || typeof action !== 'object') {
    errors.push('Missing nextAction object');
  } else if (action.type === 'computer_action' && !computerActionAllowed) {
    errors.push(
      'computer_action is not available in this environment (computer control is disabled) — choose a registry "tool" action instead'
    );
  } else if (!AUTONOMOUS_ACTION_TYPES.includes(action.type)) {
    errors.push(
      `Invalid nextAction.type "${action.type}". Allowed: ${AUTONOMOUS_ACTION_TYPES.join(', ')}`
    );
  } else {
    switch (action.type) {
      case 'tool':
        if (typeof action.name !== 'string' || !action.name.trim())
          errors.push('tool action requires "name"');
        if (typeof action.target !== 'string' || !action.target.trim())
          errors.push('tool action requires "target"');
        if (
          action.arguments !== undefined &&
          (action.arguments === null || typeof action.arguments !== 'object')
        ) {
          errors.push('tool action "arguments" must be an object');
        }
        break;
      case 'computer_action': {
        if (!action.action || typeof action.action !== 'object') {
          errors.push('computer_action requires an "action" object');
        } else if (!ACTION_TYPES.includes(action.action.type)) {
          errors.push(`computer action "${action.action.type}" is not whitelisted`);
        }
        break;
      }
      case 'hypothesis':
        if (typeof action.hypothesis !== 'string' || !action.hypothesis.trim()) {
          errors.push('hypothesis action requires a "hypothesis" string');
        }
        break;
      case 'parallel_tools': {
        // Multiple independent tools in one step. Each entry: {name, target, arguments}.
        const tools = action.tools || action.parallelTools;
        if (!Array.isArray(tools) || !tools.length) {
          errors.push('parallel_tools action requires a "tools" array');
        } else if (tools.length > 6) {
          errors.push('parallel_tools supports at most 6 tools per step');
        } else {
          for (const t of tools) {
            if (!t || typeof t.name !== 'string' || !t.name.trim()) {
              errors.push('each parallel_tools entry requires a "name"');
              break;
            }
          }
        }
        break;
      }
      case 'validate':
      case 'finding':
        if (typeof action.hypothesisId !== 'string' && typeof action.hypothesis !== 'string') {
          errors.push(`${action.type} action requires "hypothesisId" or "hypothesis"`);
        }
        break;
      case 'observation':
        if (typeof action.observation !== 'string' || !action.observation.trim()) {
          errors.push('observation action requires an "observation" string');
        }
        break;
      case 'plan_update':
        if (!action.plan || typeof action.plan !== 'object') {
          errors.push('plan_update requires a "plan" object');
        }
        break;
      default:
        break;
    }
  }

  if (decision.confidence !== undefined) {
    const confidence = Number(decision.confidence);
    if (
      !Number.isFinite(confidence) ||
      confidence < CONFIDENCE_MIN ||
      confidence > CONFIDENCE_MAX
    ) {
      errors.push('confidence must be a number between 0 and 1');
    }
  }

  if (errors.length) return { valid: false, errors, decision: null };

  return {
    valid: true,
    errors: [],
    decision: {
      objective: decision.objective.trim(),
      observation: typeof decision.observation === 'string' ? decision.observation.trim() : null,
      nextAction: action,
      reason: decision.reason.trim(),
      expectedOutcome:
        typeof decision.expectedOutcome === 'string' ? decision.expectedOutcome.trim() : null,
      confidence: decision.confidence === undefined ? null : Number(decision.confidence),
      phase:
        typeof decision.phase === 'string' && decision.phase.trim() ? decision.phase.trim() : null,
      memoryNotes: Array.isArray(decision.memoryNotes)
        ? decision.memoryNotes.filter(n => typeof n === 'string').slice(0, 20)
        : [],
    },
  };
}

/** The JSON contract, sent verbatim to the local model. */
export const AUTONOMOUS_DECISION_SCHEMA_PROMPT = `You MUST reply with ONE valid JSON object and nothing else. Schema:

{
  "objective": "what you are trying to achieve right now",
  "observation": "what the latest observation actually tells you",
  "nextAction": {
    "type": "tool" | "computer_action" | "observation" | "hypothesis" | "validate" | "finding" | "plan_update" | "wait" | "complete",
    "name": "tool name from the registry (tool actions)",
    "target": "in-scope hostname or URL (tool actions)",
    "arguments": { "args": ["extra", "cli", "args"] },
    "action": { "type": "<computer action>", "params": { } },
    "hypothesis": "the hypothesis text",
    "observation": "the recorded observation",
    "plan": { "phases": [ { "name": "phase", "steps": [ { "step": "…", "status": "pending|done" } ] } ] }
  },
  "reason": "why this action beats the alternatives",
  "expectedOutcome": "what the next observation should show",
  "confidence": 0.0,
  "phase": "current assessment phase",
  "memoryNotes": ["durable facts worth remembering"]
}

HARD RULES:
- Reply with JSON only. No prose, no markdown fences.
- Never invent tool output. Only cite observations you were actually given.
- If the memory block does not contain a fact, that fact is UNKNOWN — say so, never guess.
- Never repeat a tool execution with identical target and arguments.
- Never propose an action outside the authorized scope.
- You have no shell. Terminal work is done exclusively through registry tools.
- Use "complete" only when the objectives are genuinely satisfied or nothing safe remains.`;

export { ACTION_TYPES };
