// Dark Matter hunt-intel — anomaly detector.
// Solves problem #5: "blind to weird signals."
//
// Elite hunters pursue responses that DON'T fit any checklist — the gut
// feeling that something is off. This scorer quantifies "weirdness" so the
// agent can do the same: every tool response gets a weirdness score, and
// high-scoring responses trigger deep investigation even when no known
// vulnerability signature fired.

/**
 * Score how "weird" an HTTP response is vs baseline.
 * @param {{status, bodyLength, timeMs, headers}} resp
 * @param {{status, bodyLength, timeMs}} baseline — normal response for comparison
 * @returns {{score: number (0-100), signals: string[]}}
 */
export function scoreWeirdness(resp, baseline = {}) {
  let score = 0;
  const signals = [];

  // Status code anomaly
  if (baseline.status && resp.status !== baseline.status) {
    score += 25;
    signals.push(`status ${baseline.status}->${resp.status}`);
  }
  // 500s are always interesting
  if (resp.status >= 500) {
    score += 20;
    signals.push(`server error ${resp.status}`);
  }

  // Response size delta (>3x or <1/3 of baseline)
  if (baseline.bodyLength && resp.bodyLength) {
    const ratio = resp.bodyLength / baseline.bodyLength;
    if (ratio > 3 || ratio < 0.33) {
      score += 20;
      signals.push(`size ${(ratio).toFixed(1)}x baseline`);
    }
  }

  // Timing anomaly (>5x baseline = possible blind injection / DoS)
  if (baseline.timeMs && resp.timeMs) {
    const ratio = resp.timeMs / baseline.timeMs;
    if (ratio > 5) {
      score += 25;
      signals.push(`timing ${ratio.toFixed(1)}x slower (possible blind vuln)`);
    }
  }

  // Interesting keywords in body
  const body = String(resp.body || '').toLowerCase();
  const keywords = [
    [/sql.*error|mysql|postgres|ora-/i, 'SQL error leaked', 15],
    [/stack trace|traceback/i, 'stack trace leaked', 15],
    [/debug.*true|debug mode/i, 'debug mode', 10],
    [/admin|root|internal/i, 'privileged keyword', 8],
    [/\.git|\.env|config\.php/i, 'sensitive path', 12],
  ];
  for (const [re, label, pts] of keywords) {
    if (re.test(body)) {
      score += pts;
      signals.push(label);
    }
  }

  return { score: Math.min(100, score), signals };
}

/** Should this response trigger deep investigation? */
export function isWorthInvestigating(resp, baseline) {
  const { score } = scoreWeirdness(resp, baseline);
  return score >= 40;
}
