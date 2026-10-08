/**
 * recoveryAdvisor — failure-recovery strategies for the autonomous
 * computer-control loop (issue #1, "Recoverable failures").
 *
 * When a computer action fails, the brain needs more than "it failed" — it
 * needs concrete, situation-specific recovery options. This module maps the
 * real failure (action type + error kind + observation) to an ordered list
 * of strategies the brain can choose from, mirroring the issue's examples:
 *
 *   • button not visible → scroll down, take a fresh observation, retry
 *   • action does not work → observe the current screen, replan
 *   • wrong page → navigate back and verify
 *   • controller disconnected → persist state, reconnect, keep the job waiting
 *
 * Every strategy is a *suggestion* — the worker records them and the brain
 * (or the human, via the activity feed) decides. Nothing here executes.
 */

/**
 * @param {object} args
 * @param {object|null} args.action       the validated action that failed
 * @param {{message:string,kind:string}|null} args.error
 * @param {object|null} args.observation  last real observation, if any
 * @returns {Array<{strategy:string, detail:string, suggestedAction?:object}>}
 */
export function suggestRecovery({ action = null, error = null, observation = null } = {}) {
  const kind = error?.kind || 'error';
  const type = action?.type || null;
  const strategies = [];

  // Transport-level failures: the runtime is gone, not the plan.
  if (kind === 'unavailable' || kind === 'timeout') {
    strategies.push({
      strategy: 'reconnect_and_wait',
      detail:
        'The computer runtime is unreachable. Persist the current job state, keep the job in a waiting state, and retry the connection before replanning — do not invent a new plan from a stale screen.',
    });
    strategies.push({
      strategy: 'fall_back_to_tools',
      detail:
        'While the desktop is unreachable, continue the assessment with the API/network tool layer; resume computer actions once the runtime reconnects.',
    });
    return strategies;
  }

  // Policy rejections: the plan itself must change.
  if (kind === 'rejected') {
    strategies.push({
      strategy: 'choose_different_action',
      detail: `The action was rejected by policy/validation (${error?.message || 'no detail'}). Choose a different, whitelisted action — never retry the exact rejected attempt.`,
    });
    return strategies;
  }

  if (kind === 'awaiting_approval' || kind === 'permission_required') {
    strategies.push({
      strategy: 'request_permission',
      detail:
        'The action needs explicit user approval. Pause the computer loop, surface the pending action in the activity feed, and continue with non-interactive work meanwhile.',
    });
    return strategies;
  }

  // Action-specific recovery.
  if (type === 'click' || type === 'double_click') {
    strategies.push({
      strategy: 'scroll_and_observe',
      detail:
        'The click target may be off-screen or obscured. Scroll the window, take a fresh observation, then retry the click at updated coordinates.',
    });
    strategies.push({
      strategy: 'retry_adjusted_coordinates',
      detail:
        'Nudge the click coordinates toward the visible element and retry once. If it fails again, observe and replan instead of clicking blindly.',
    });
  } else if (type === 'navigate') {
    strategies.push({
      strategy: 'verify_url_and_retry',
      detail:
        'Re-check the target URL (typos, missing scheme), then navigate again and confirm the page title in the follow-up observation.',
    });
    strategies.push({
      strategy: 'navigate_back',
      detail:
        'If the browser landed on the wrong page, navigate back to the last known-good URL before trying a different route.',
    });
  } else if (type === 'open_application') {
    strategies.push({
      strategy: 'try_application_alias',
      detail:
        'Try a known alias for the application (e.g. "notepad" → "Notepad", "chrome" → "Google Chrome") or open it via the system launcher.',
    });
    strategies.push({
      strategy: 'verify_application_present',
      detail:
        'Take a fresh observation first — the application may already be open, in which case switch to it instead of launching again.',
    });
  } else if (type === 'type') {
    strategies.push({
      strategy: 'click_target_first',
      detail:
        'The keystrokes may have gone nowhere. Click the target input field to focus it, observe, then type again.',
    });
  } else if (
    type === 'screenshot' ||
    type === 'get_active_window' ||
    type === 'get_browser_state'
  ) {
    strategies.push({
      strategy: 'retry_observation',
      detail:
        'The observation itself failed. Wait briefly and retry the observation once before replanning — the screen state is unknown right now.',
    });
  }

  // Universal fallback: never replan blind.
  strategies.push({
    strategy: 'observe_and_replan',
    detail: `Take a fresh observation of the current screen state${observation?.summary ? ` (last known: "${observation.summary.slice(0, 120)}")` : ''} and replan from reality, not from the failed attempt.`,
  });

  return strategies;
}

/**
 * Short human-readable rendering of the strategies for the activity feed.
 */
export function formatRecoveryAdvice(strategies) {
  return strategies
    .map((entry, index) => `${index + 1}. ${entry.strategy}: ${entry.detail}`)
    .join('\n');
}
