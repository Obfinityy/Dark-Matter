/**
 * udpAmplificationSafetyChecker.js — UDP amplification-safety checker.
 *
 * Computes response amplification ratios from captured UDP probe/response
 * measurements and flags services that could be abused as reflectors. It
 * works on measurement data recorded during an authorized hunt (request and
 * response byte counts) — it never performs amplification itself.
 *
 * Severity bands (response:request ratio, averaged over the sample):
 *   < 2x    → Info     (normal protocol overhead)
 *   2x–10x  → Low      (worth noting)
 *   10x–50x → Medium   (documented reflector risk)
 *   > 50x   → High     (severe abuse potential)
 */

const BANDS = [
  { min: 50, severity: 'High', label: 'Severe reflector risk' },
  { min: 10, severity: 'Medium', label: 'Documented reflector risk' },
  { min: 2, severity: 'Low', label: 'Elevated amplification' },
  { min: 0, severity: 'Info', label: 'Normal protocol overhead' },
];

function bandFor(ratio) {
  return BANDS.find(b => ratio >= b.min) || BANDS[BANDS.length - 1];
}

/**
 * Check a single service's amplification profile.
 *
 * @param {{ service?: string, port?: number, requestBytes: number, responseBytes: number, samples?: number }} input
 */
export function checkAmplification({
  service = 'unknown',
  port = 0,
  requestBytes = 0,
  responseBytes = 0,
  samples = 1,
} = {}) {
  const safeRequest = Math.max(requestBytes, 1);
  const ratio = responseBytes / safeRequest;
  const band = bandFor(ratio);

  const result = {
    service,
    port,
    requestBytes,
    responseBytes,
    samples,
    amplificationRatio: Math.round(ratio * 100) / 100,
    severity: band.severity,
    label: band.label,
    reflectorRisk: ratio >= 10,
    findings: [],
  };

  if (ratio >= 10) {
    result.findings.push({
      type: `Potential UDP reflector: ${service}`,
      severity: band.severity,
      confidence: samples >= 5 ? 'high' : 'medium',
      cwe: 'CWE-400',
      evidence: `${responseBytes} response bytes from a ${requestBytes}-byte request on UDP/${port} → ${result.amplificationRatio}x amplification (${samples} sample${samples === 1 ? '' : 's'}).`,
      recommendation:
        'Rate-limit or disable this UDP service on public interfaces; verify BCP38/source-validation at the network edge.',
    });
  } else {
    result.findings.push({
      type: `No reflector risk: ${service}`,
      severity: 'Info',
      confidence: samples >= 5 ? 'high' : 'medium',
      evidence: `${result.amplificationRatio}x amplification on UDP/${port} is within normal protocol overhead.`,
      recommendation: 'No action required.',
    });
  }

  return result;
}

/**
 * Aggregate a hunt's UDP measurements into a safety summary.
 *
 * @param {{ measurements: Array<{ service?: string, port?: number, requestBytes: number, responseBytes: number, samples?: number }> }} input
 */
export function summarizeAmplificationSafety({ measurements = [] } = {}) {
  const checks = measurements.map(checkAmplification);
  const risky = checks.filter(c => c.reflectorRisk);
  const worst = checks.reduce(
    (a, b) => (b.amplificationRatio > (a?.amplificationRatio || 0) ? b : a),
    null
  );

  return {
    servicesChecked: checks.length,
    riskyCount: risky.length,
    worstAmplification: worst
      ? { service: worst.service, port: worst.port, ratio: worst.amplificationRatio }
      : null,
    checks,
    summary:
      risky.length === 0
        ? 'No UDP reflector risk detected in the captured measurements.'
        : `${risky.length} service(s) show reflector-grade amplification: ${risky.map(r => `${r.service} (UDP/${r.port}, ${r.amplificationRatio}x)`).join('; ')}.`,
    findings: risky.flatMap(r => r.findings),
  };
}

export const UDP_AMPLIFICATION_SAFETY_CHECKER = {
  checkAmplification,
  summarizeAmplificationSafety,
};
export default UDP_AMPLIFICATION_SAFETY_CHECKER;
