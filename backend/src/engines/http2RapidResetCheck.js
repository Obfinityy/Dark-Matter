/**
 * http2RapidResetCheck.js — HTTP/2 rapid-reset behavior fingerprinting for autonomous bug bounty.
 *
 * Implements idea-bank item 00411: observe HTTP/2 stream lifecycle behavior
 * (stream resets, GOAWAY handling, REFUSED_STREAM rates) to fingerprint the
 * HTTP/2 server implementation.
 *
 * All functions are pure and side-effect free: they classify behavior
 * observation objects the caller collected with safe, protocol-compliant
 * probes during an authorized engagement. No network activity happens here,
 * and no rapid-reset traffic is generated or described.
 */

/**
 * Known behavioral signatures linking observed stream-lifecycle traits to
 * HTTP/2 server implementations.
 * @type {Array<{implementation:string, traits:string[], confidence:number}>}
 */
export const IMPLEMENTATION_SIGNATURES = [
  { implementation: 'nginx', traits: ['rejects_new_streams_after_max_concurrent', 'immediate_goaway_on_abuse'], confidence: 0.75 },
  { implementation: 'Apache httpd (mod_http2)', traits: ['tolerant_rst_stream', 'deferred_goaway'], confidence: 0.7 },
  { implementation: 'Envoy', traits: ['aggressive_stream_limits', 'per_connection_rate_limiting'], confidence: 0.8 },
  { implementation: 'HAProxy', traits: ['immediate_goaway_on_abuse', 'connection_close_on_excess_resets'], confidence: 0.75 },
  { implementation: 'IIS / HTTP.sys', traits: ['silent_reset_acceptance', 'no_refused_stream'], confidence: 0.7 },
  { implementation: 'Node.js http2', traits: ['tolerant_rst_stream', 'no_refused_stream'], confidence: 0.65 },
  { implementation: 'Caddy', traits: ['immediate_goaway_on_abuse', 'per_connection_rate_limiting'], confidence: 0.7 },
];

/**
 * Classify the stream-reset behavior of a single observation record.
 * @param {object} obs { streamsAttempted:number, streamsCompleted:number,
 *   resetsSent:number, resetsAccepted:number, goawayReceived:boolean,
 *   refusedStreamCount:number, avgResetLatencyMs:number|null }
 * @returns {{resetAcceptanceRate:number, goawayDiscipline:string, evidence:string[]}}
 */
export function classifyResetBehavior(obs) {
  const o = obs || {};
  const sent = Number(o.resetsSent) || 0;
  const accepted = Number(o.resetsAccepted) || 0;
  const acceptanceRate = sent > 0 ? accepted / sent : 0;
  const refused = Number(o.refusedStreamCount) || 0;
  const evidence = [];
  let discipline = 'unknown';
  if (o.goawayReceived) {
    discipline = 'immediate_goaway_on_abuse';
    evidence.push('server issued GOAWAY during the reset probe sequence');
  } else if (refused > 0) {
    discipline = 'refused_stream_backpressure';
    evidence.push(`server refused ${refused} streams via REFUSED_STREAM`);
  } else if (acceptanceRate > 0.9) {
    discipline = 'tolerant_rst_stream';
    evidence.push(`server accepted ${(acceptanceRate * 100).toFixed(1)}% of stream resets without backpressure`);
  } else if (acceptanceRate > 0) {
    discipline = 'deferred_goaway';
    evidence.push(`server partially accepted resets (${(acceptanceRate * 100).toFixed(1)}%) before signaling`);
  } else {
    discipline = 'connection_close_on_excess_resets';
    evidence.push('server closed the connection rather than acknowledging resets');
  }
  if (o.avgResetLatencyMs != null && Number(o.avgResetLatencyMs) < 5) {
    evidence.push(`fast reset acknowledgement (${o.avgResetLatencyMs}ms avg) — aggressive stream accounting`);
  }
  return { resetAcceptanceRate: acceptanceRate, goawayDiscipline: discipline, evidence };
}

/**
 * Match classified behavior against implementation signatures.
 * @param {{goawayDiscipline:string, resetAcceptanceRate:number}} classification Output of classifyResetBehavior.
 * @param {string|null} serverHeader Optional Server header for corroboration.
 * @returns {Array<{implementation:string, confidence:number, matchedTraits:string[], reasons:string[]}>} sorted by confidence.
 */
export function fingerprintImplementation(classification, serverHeader = null) {
  const traits = [classification.goawayDiscipline];
  if (classification.resetAcceptanceRate > 0.9) traits.push('silent_reset_acceptance');
  if (classification.resetAcceptanceRate < 0.2) traits.push('immediate_goaway_on_abuse');
  const results = [];
  for (const sig of IMPLEMENTATION_SIGNATURES) {
    const matched = sig.traits.filter((t) => traits.includes(t));
    if (matched.length === 0) continue;
    let confidence = sig.confidence * (matched.length / sig.traits.length);
    const reasons = matched.map((t) => `observed trait: ${t.replace(/_/g, ' ')}`);
    if (serverHeader && serverHeader.toLowerCase().includes(sig.implementation.split(' ')[0].toLowerCase())) {
      confidence = Math.min(0.95, confidence + 0.15);
      reasons.push(`corroborated by Server header: ${serverHeader}`);
    }
    results.push({ implementation: sig.implementation, confidence, matchedTraits: matched, reasons });
  }
  return results.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Assess whether observed behavior indicates susceptibility to the
 * rapid-reset (CVE-2023-44487 class) denial-of-service pattern:
 * unbounded cheap reset acceptance without backpressure is the tell.
 * @param {{goawayDiscipline:string, resetAcceptanceRate:number}} classification
 * @param {object} obs Original observation (for volume context).
 * @returns {{suspicious:boolean, severity:'none'|'low'|'medium'|'high', reasons:string[]}}
 */
export function assessRapidResetRisk(classification, obs = {}) {
  const reasons = [];
  let severity = 'none';
  const sent = Number(obs.resetsSent) || 0;
  if (classification.resetAcceptanceRate > 0.95 && sent >= 20) {
    severity = 'high';
    reasons.push(`server accepted ${(classification.resetAcceptanceRate * 100).toFixed(1)}% of ${sent} resets with no backpressure`);
  } else if (classification.resetAcceptanceRate > 0.8 && sent >= 20) {
    severity = 'medium';
    reasons.push('high reset acceptance without GOAWAY discipline');
  }
  if (classification.goawayDiscipline === 'tolerant_rst_stream') {
    reasons.push('no stream-limit signaling observed during probe window');
  }
  if (severity === 'none') reasons.push('server applied backpressure (GOAWAY, REFUSED_STREAM, or connection close)');
  return { suspicious: severity !== 'none', severity, reasons };
}
