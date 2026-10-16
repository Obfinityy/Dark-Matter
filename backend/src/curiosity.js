// Dark Matter — Curiosity Engine.
// Makes the hunt agent think like a human hacker, not a checklist runner.
//
// A human hacker doesn't just run tests in order. They:
//   1. OBSERVE something interesting (unusual response, weird parameter, error message)
//   2. WONDER "what if..." (form a hypothesis)
//   3. TEST the hypothesis with a targeted probe
//   4. LEARN from the result and follow the thread
//
// This module generates hypotheses from observations and prioritizes
// the most interesting threads to pursue.

/**
 * Analyze recent observations and generate curiosity-driven hypotheses.
 * @param {Array} observations - Recent tool outputs, responses, anomalies
 * @param {Object} targetIntel - What we know about the target
 * @returns {Array} Hypotheses sorted by interestingness: [{hypothesis, why, test, priority}]
 */
export function generateHypotheses(observations, targetIntel) {
  const hypotheses = [];

  for (const obs of observations || []) {
    const text = String(obs.output || obs.text || '').toLowerCase();

    // Unusual status codes or error messages = curiosity trigger
    if (text.includes('500') || text.includes('error') || text.includes('exception')) {
      hypotheses.push({
        hypothesis: 'Server errors may reveal injection points or logic flaws',
        why: `Observed error in: ${(obs.output || '').slice(0, 100)}`,
        test: 'Send malformed input to the erroring endpoint and analyze the response',
        priority: 8,
      });
    }

    // Parameters in URLs = potential injection points
    const params = (obs.output || '').match(/[?&](\w+)=/g);
    if (params && params.length > 0) {
      const uniqueParams = [...new Set(params.map(p => p.slice(1, -1)))];
      hypotheses.push({
        hypothesis: `Parameters ${uniqueParams.slice(0, 3).join(', ')} may be injectable`,
        why: 'URL parameters are classic injection vectors',
        test: `Test each parameter for SQLi, XSS, and SSTI with benign payloads`,
        priority: 9,
      });
    }

    // Timing differences = potential blind injection
    if (obs.duration && obs.duration > 5000) {
      hypotheses.push({
        hypothesis: 'Slow response may indicate blind SQL injection or SSRF',
        why: `Response took ${obs.duration}ms — unusually slow`,
        test: 'Send time-based payloads and measure response differences',
        priority: 7,
      });
    }

    // Technology fingerprints = known vulnerability patterns
    if (targetIntel && targetIntel.technologies) {
      for (const tech of targetIntel.technologies) {
        if (text.includes(tech.toLowerCase())) {
          hypotheses.push({
            hypothesis: `${tech} may have known CVEs or misconfigurations`,
            why: `Technology detected: ${tech}`,
            test: `Check ${tech} version and test for known vulnerabilities`,
            priority: 6,
          });
        }
      }
    }
  }

  // Sort by priority (highest first)
  return hypotheses.sort((a, b) => b.priority - a.priority);
}

/**
 * Format hypotheses for the AI planning prompt.
 */
export function formatHypothesesForPrompt(hypotheses) {
  if (!hypotheses || hypotheses.length === 0) {
    return '';
  }
  const top = hypotheses.slice(0, 5);
  return `\n--- CURIOSITY THREADS (follow the most interesting) ---\n` +
    top.map((h, i) =>
      `${i + 1}. HYPOTHESIS: ${h.hypothesis}\n   WHY: ${h.why}\n   TEST: ${h.test}`
    ).join('\n');
}

/**
 * Score how "interesting" an observation is (for prioritizing follow-up).
 */
export function scoreInterestingness(observation) {
  let score = 0;
  const text = String(observation.output || observation.text || '').toLowerCase();

  if (text.includes('password') || text.includes('secret') || text.includes('token')) score += 10;
  if (text.includes('admin') || text.includes('root')) score += 8;
  if (text.includes('sql') || text.includes('database')) score += 7;
  if (text.includes('500') || text.includes('error')) score += 6;
  if (text.includes('redirect')) score += 5;
  if (observation.duration > 3000) score += 4;

  return score;
}
