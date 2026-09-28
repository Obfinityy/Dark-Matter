/**
 * Decision Schema — validates structured agent decisions before execution.
 * The agent must produce structured decisions, not free-form text.
 */

const VALID_ACTION_TYPES = ['tool_execution', 'observation', 'hypothesis', 'finding', 'phase_change', 'complete', 'pause'];

/**
 * Validate a structured agent decision.
 * @param {object} decision
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateDecision(decision) {
  const errors = [];

  if (!decision || typeof decision !== 'object') {
    return { valid: false, errors: ['Decision must be a non-null object'] };
  }

  if (!decision.objective) errors.push('Missing objective');
  if (!decision.reason) errors.push('Missing reason');

  if (!decision.selected_action) {
    errors.push('Missing selected_action');
  } else {
    const action = decision.selected_action;
    if (!VALID_ACTION_TYPES.includes(action.type)) {
      errors.push(`Invalid action type: ${action.type}. Must be one of: ${VALID_ACTION_TYPES.join(', ')}`);
    }
    if (action.type === 'tool_execution') {
      if (!action.tool) errors.push('tool_execution requires a tool name');
      if (!action.target) errors.push('tool_execution requires a target');
    }
  }

  if (typeof decision.scope_check !== 'boolean') errors.push('Missing scope_check (boolean)');
  if (typeof decision.risk_check !== 'boolean') errors.push('Missing risk_check (boolean)');

  return { valid: errors.length === 0, errors };
}

/**
 * The JSON schema description sent to the LLM to enforce structured output.
 */
export const DECISION_SCHEMA_PROMPT = `You MUST respond with a valid JSON object matching this exact schema:

{
  "objective": "string — what you are trying to achieve in this iteration",
  "current_observations": ["string — key observations from recent results"],
  "hypotheses": ["string — current security hypotheses to investigate"],
  "candidate_actions": ["string — possible next actions you considered"],
  "selected_action": {
    "type": "tool_execution | observation | hypothesis | finding | phase_change | complete",
    "tool": "string — tool name from the registry (required for tool_execution)",
    "target": "string — target hostname or URL (required for tool_execution)",
    "arguments": { "args": ["additional", "cli", "args"] },
    "description": "string — human-readable description of the action"
  },
  "reason": "string — why you chose this action over alternatives",
  "expected_information_gain": "string — what new knowledge this action should produce",
  "scope_check": true,
  "risk_check": true,
  "phase": "string — current investigation phase"
}

Rules:
- If you have completed the investigation or have no more safe actions, set selected_action.type to "complete"
- Never select a tool that has already been run with the same target and arguments
- Always verify scope_check is true before tool_execution
- risk_check must be true — if you are unsure about safety, set type to "observation" instead
- Do NOT fabricate results — only reference real tool output you have received`;
