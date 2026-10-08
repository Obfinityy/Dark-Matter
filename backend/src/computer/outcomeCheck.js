/**
 * outcomeCheck — expected-vs-actual comparison for the autonomous
 * observe → decide → act → observe loop (issue #1).
 *
 * Every computer decision carries an `expectedOutcome` ("the login page
 * appears"). After the action runs, this module compares that expectation
 * against the real observation so the brain gets an explicit verdict —
 * MATCHED / MISMATCHED / UNKNOWN — instead of a raw observation it might
 * misread.
 *
 * This is deliberately a deterministic heuristic, not an LLM judgement:
 * the verdict must be cheap, reproducible, and never hallucinated.
 */

const STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'to',
  'of',
  'in',
  'on',
  'for',
  'with',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'it',
  'its',
  'that',
  'this',
  'should',
  'will',
  'after',
  'then',
  'when',
  'by',
  'as',
  'at',
  'from',
]);

const FAILURE_SIGNALS = [
  'failed',
  'failure',
  'error',
  'unavailable',
  'timed out',
  'timeout',
  'rejected',
  'not found',
  'could not',
  'unable to',
  'denied',
];

function significantTokens(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 2 && !STOPWORDS.has(token));
}

/**
 * Compare an expected outcome against the real observation(s).
 *
 * @param {object} args
 * @param {string|null} args.expectedOutcome  what the brain expected to happen
 * @param {object|null} args.observation      the adapter's observation of the action
 * @param {object|null} args.followUpObservation the post-settle re-observation (if any)
 * @returns {{ matched: boolean|null, reason: string }}
 *   matched=true  → the observation supports the expectation
 *   matched=false → the observation contradicts it (or the action failed)
 *   matched=null  → cannot tell from a text observation; the brain decides
 */
export function checkOutcome({
  expectedOutcome = null,
  observation = null,
  followUpObservation = null,
} = {}) {
  if (!expectedOutcome || !String(expectedOutcome).trim()) {
    return { matched: null, reason: 'no expected outcome was stated for this action' };
  }

  const expected = String(expectedOutcome).trim();
  const observedText = [observation?.summary, followUpObservation?.summary]
    .filter(Boolean)
    .join(' — ');
  const observed = observedText.toLowerCase();

  if (!observedText) {
    return { matched: null, reason: 'no observation was captured to compare against' };
  }

  // An explicit failure signal anywhere in the observation contradicts any
  // positive expectation — except when the expectation itself predicted failure.
  const expectsFailure = FAILURE_SIGNALS.some(signal => expected.toLowerCase().includes(signal));
  const observedFailure = FAILURE_SIGNALS.some(signal => observed.includes(signal));
  if (observedFailure && !expectsFailure) {
    return {
      matched: false,
      reason: `observation reports a failure ("${observedText.slice(0, 160)}") while the expected outcome was "${expected}"`,
    };
  }

  const expectedTokens = [...new Set(significantTokens(expected))];
  if (expectedTokens.length === 0) {
    return { matched: null, reason: 'expected outcome carries no comparable keywords' };
  }
  const hits = expectedTokens.filter(token => observed.includes(token));
  const ratio = hits.length / expectedTokens.length;

  if (hits.length === 0) {
    return {
      matched: false,
      reason: `none of the expected keywords (${expectedTokens.join(', ')}) appear in the observation "${observedText.slice(0, 160)}"`,
    };
  }
  if (ratio >= 0.5) {
    return {
      matched: true,
      reason: `observation supports the expectation (matched: ${hits.join(', ')})`,
    };
  }
  return {
    matched: null,
    reason: `partial match only (${hits.join(', ')}); a text observation cannot confirm "${expected}" — treat as uncertain`,
  };
}
