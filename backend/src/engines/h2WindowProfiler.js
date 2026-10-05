/**
 * h2WindowProfiler.js — HTTP/2 WINDOW_UPDATE behavior profiling.
 *
 * HTTP/2 flow control (RFC 7540 §6.9) is implemented differently across
 * stacks: CDNs and edge caches typically advertise huge connection windows
 * and auto-tune aggressively, while origin servers keep small, static
 * windows. This module profiles observed flow-control behavior — supplied
 * by the caller as decoded WINDOW_UPDATE events and initial settings —
 * and classifies the endpoint as edge-like or origin-like.
 *
 * Pure analysis of observed protocol metadata; no network activity.
 *
 * Defensive use: authorized infrastructure mapping during bug-bounty recon
 * (telling a CDN edge apart from the true origin).
 */

/**
 * Summarize WINDOW_UPDATE events into behavioral features.
 *
 * @param {{ events: { streamId: number, increment: number, atMs?: number }[], initialConnectionWindow?: number, initialStreamWindow?: number }} input
 * @returns {{ eventCount: number, totalIncrement: number, avgIncrement: number, connectionLevelEvents: number, streamLevelEvents: number, autoTuneRatio: number|null, features: string[] }}
 */
export function summarizeWindowBehavior({ events = [], initialConnectionWindow = 65535, initialStreamWindow = 65535 } = {}) {
  const evs = events || [];
  const totalIncrement = evs.reduce((s, e) => s + (Number(e.increment) || 0), 0);
  const connectionLevelEvents = evs.filter((e) => Number(e.streamId) === 0).length;
  const streamLevelEvents = evs.length - connectionLevelEvents;
  // Auto-tune hint: connection-level WINDOW_UPDATEs that arrive without
  // corresponding stream-level pressure suggest proactive window growth.
  const autoTuneRatio = streamLevelEvents > 0 ? connectionLevelEvents / streamLevelEvents : connectionLevelEvents > 0 ? 1 : 0;

  const features = [];
  if (initialConnectionWindow >= 16777216) features.push('huge-connection-window');
  if (initialStreamWindow >= 1048576) features.push('huge-stream-window');
  if (autoTuneRatio > 1.5) features.push('proactive-connection-window-growth');
  if (evs.some((e) => Number(e.increment) >= 16777216)) features.push('jumbo-window-update');
  if (evs.length === 0) features.push('no-window-updates-observed');

  return {
    eventCount: evs.length,
    totalIncrement,
    avgIncrement: evs.length ? totalIncrement / evs.length : 0,
    connectionLevelEvents,
    streamLevelEvents,
    autoTuneRatio,
    features,
  };
}

/**
 * Classify the endpoint from its flow-control profile.
 *
 * @param {ReturnType<typeof summarizeWindowBehavior>} summary
 * @returns {{ class: 'edge-like'|'origin-like'|'indeterminate', score: number, reasons: string[] }}
 */
export function classifyEndpoint(summary) {
  const reasons = [];
  let edgeScore = 0;
  let originScore = 0;

  if (summary.features.includes('huge-connection-window')) {
    edgeScore += 2;
    reasons.push('Connection window >= 16 MiB is typical of CDN/edge stacks.');
  }
  if (summary.features.includes('huge-stream-window')) {
    edgeScore += 2;
    reasons.push('Stream window >= 1 MiB is typical of CDN/edge stacks.');
  }
  if (summary.features.includes('proactive-connection-window-growth')) {
    edgeScore += 1;
    reasons.push('Proactive connection-level WINDOW_UPDATEs suggest edge auto-tuning.');
  }
  if (summary.features.includes('jumbo-window-update')) {
    edgeScore += 1;
    reasons.push('Jumbo WINDOW_UPDATE increments (>= 16 MiB) are edge-like.');
  }
  if (summary.features.includes('no-window-updates-observed')) {
    originScore += 1;
    reasons.push('No WINDOW_UPDATE activity observed — static windows, origin-like.');
  }
  if (summary.eventCount > 0 && summary.avgIncrement < 65535) {
    originScore += 1;
    reasons.push('Small, incremental window updates suggest a conservative origin stack.');
  }

  const total = edgeScore + originScore;
  if (total === 0) return { class: 'indeterminate', score: 0, reasons: ['Insufficient flow-control signal.'] };
  const edgeRatio = edgeScore / total;
  if (edgeRatio >= 0.66) return { class: 'edge-like', score: edgeRatio, reasons };
  if (edgeRatio <= 0.33) return { class: 'origin-like', score: 1 - edgeRatio, reasons };
  return { class: 'indeterminate', score: 0.5, reasons };
}

/**
 * Full WINDOW_UPDATE behavior profile.
 *
 * @param {{ events?: object[], initialConnectionWindow?: number, initialStreamWindow?: number, viaHeader?: string }} input
 * @returns {{ type: string, summary: object, classification: object, confidence: string, evidence: string }}
 */
export function profileWindowBehavior({
  events = [],
  initialConnectionWindow = 65535,
  initialStreamWindow = 65535,
  viaHeader = '',
} = {}) {
  const summary = summarizeWindowBehavior({ events, initialConnectionWindow, initialStreamWindow });
  const classification = classifyEndpoint(summary);
  const confidence =
    classification.class === 'indeterminate' ? 'low' : classification.score >= 0.85 ? 'high' : 'medium';

  return {
    type: 'HTTP/2 WINDOW_UPDATE Behavior Profiling',
    summary,
    classification,
    confidence,
    evidence: `Observed ${summary.eventCount} WINDOW_UPDATE event(s) (conn-level: ${summary.connectionLevelEvents}, stream-level: ${summary.streamLevelEvents}); initial windows conn=${initialConnectionWindow} stream=${initialStreamWindow}${
      viaHeader ? ` (Via: ${viaHeader})` : ''
    } — classified '${classification.class}' with score ${classification.score.toFixed(2)}.`,
  };
}

export const H2_WINDOW_PROFILER = { summarizeWindowBehavior, classifyEndpoint, profileWindowBehavior };
export default H2_WINDOW_PROFILER;
