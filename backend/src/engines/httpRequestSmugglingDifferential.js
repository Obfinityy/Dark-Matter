/**
 * httpRequestSmugglingDifferential.js — request-smuggling differential detection for autonomous bug bounty.
 *
 * Implements idea-bank item 00412: detect HTTP request-smuggling conditions
 * by differential analysis of ambiguous Content-Length / Transfer-Encoding
 * response observations collected during an authorized engagement.
 *
 * DETECTION ONLY. These functions analyze supplied observation objects
 * (response status codes, timing, content-length deltas) and never
 * generate, describe, or emit desync payload bytes. The probes that
 * produced the observations must use safe, non-weaponized techniques.
 */

/**
 * Ambiguity classes for the observations supplied to the analyzer.
 * @type {string[]}
 */
export const AMBIGUITY_CLASSES = ['cl-te', 'te-cl', 'te-te', 'cl-cl', 'cl-zero'];

/**
 * Score a single ambiguous-response observation for desync indicators.
 * @param {object} obs { ambiguityClass:string, baselineStatus:number,
 *   observedStatus:number, baselineLength:number|null, observedLength:number|null,
 *   baselineLatencyMs:number, observedLatencyMs:number,
 *   connectionClosedUnexpectedly:boolean, secondResponseObserved:boolean }
 * @returns {{indicators:string[], score:number}}
 */
export function scoreObservation(obs) {
  const o = obs || {};
  const indicators = [];
  let score = 0;
  if (o.secondResponseObserved) {
    indicators.push('unsolicited second response received — front/back boundary disagreement');
    score += 40;
  }
  if (o.connectionClosedUnexpectedly) {
    indicators.push('connection closed before full response — length framing mismatch');
    score += 20;
  }
  if (o.observedStatus !== o.baselineStatus && o.baselineStatus != null) {
    indicators.push(
      `status differential: baseline ${o.baselineStatus} vs observed ${o.observedStatus}`
    );
    score += 15;
  }
  if (
    o.baselineLength != null &&
    o.observedLength != null &&
    o.observedLength !== o.baselineLength
  ) {
    indicators.push(
      `response length differential: ${o.baselineLength} vs ${o.observedLength} bytes`
    );
    score += 15;
  }
  const base = Number(o.baselineLatencyMs) || 0;
  const cur = Number(o.observedLatencyMs) || 0;
  if (base > 0 && cur > base * 3 && cur - base > 2000) {
    indicators.push(
      `latency spike (${base}ms -> ${cur}ms) consistent with request queuing on the backend`
    );
    score += 10;
  }
  if (!AMBIGUITY_CLASSES.includes(o.ambiguityClass)) {
    indicators.push(`unknown ambiguity class: ${String(o.ambiguityClass)}`);
  }
  return { indicators, score: Math.min(100, score) };
}

/**
 * Run differential analysis across a set of observations for one target.
 * @param {Array<object>} observations Observation objects as in scoreObservation.
 * @param {object} opts { threshold?: number } default 40.
 * @returns {{findings:Array<{ambiguityClass:string, score:number, indicators:string[], severity:string}>, summary:{tested:number, flagged:number, maxScore:number}}}
 */
export function detectDesync(observations, opts = {}) {
  const threshold = opts.threshold != null ? opts.threshold : 40;
  const list = Array.isArray(observations) ? observations : [];
  const findings = [];
  let maxScore = 0;
  for (const obs of list) {
    const { indicators, score } = scoreObservation(obs);
    if (score > maxScore) maxScore = score;
    if (score >= threshold) {
      findings.push({
        ambiguityClass: obs.ambiguityClass,
        score,
        indicators,
        severity: score >= 70 ? 'high' : score >= 55 ? 'medium' : 'low',
      });
    }
  }
  return {
    findings: findings.sort((a, b) => b.score - a.score),
    summary: { tested: list.length, flagged: findings.length, maxScore },
  };
}

/**
 * Produce a safe, report-ready assessment from differential results.
 * Contains no payload data — only classifications and recommendations.
 * @param {ReturnType<typeof detectDesync>} result Output of detectDesync.
 * @param {string} targetHost Hostname the observations came from.
 * @returns {{host:string, verdict:string, severity:string, recommendations:string[]}}
 */
export function summarizeAssessment(result, targetHost) {
  const r = result || { findings: [], summary: { flagged: 0, maxScore: 0 } };
  const top = r.findings[0];
  const verdict = top
    ? `Desync indicators observed (${r.summary.flagged} of ${r.summary.tested} ambiguity classes flagged)`
    : 'No desync indicators observed in differential analysis';
  const severity = !top ? 'none' : top.severity;
  const recommendations = [];
  if (top) {
    recommendations.push('Confirm with a manual timing-based differential test before reporting');
    recommendations.push(
      'Recommend normalizing Content-Length/Transfer-Encoding handling at the frontend proxy'
    );
    recommendations.push(`Highest-signal ambiguity class: ${top.ambiguityClass}`);
  } else {
    recommendations.push('Ambiguity classes tested clean; re-test after any proxy/server change');
  }
  return { host: targetHost, verdict, severity, recommendations };
}
