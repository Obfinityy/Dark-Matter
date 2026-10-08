/**
 * icmpTimestampAnalyzer.js — ICMP timestamp-reply analyzer.
 *
 * Analyses observed ICMP Timestamp replies (type 14): compares the target's
 * transmit timestamp against the observation time to derive clock skew
 * (a host-fingerprinting signal) and a rough UTC-offset hint (timezone
 * inference). Also notes OS behaviour quirks — which timestamp fields are
 * echoed or zeroed — since stacks differ (e.g. Windows vs Linux responses).
 *
 * This module only analyses observed replies — it never sends ICMP packets.
 */

/** 24h in milliseconds. */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Normalize an ICMP timestamp (ms since UTC midnight) into a Date on the
 * observation day.
 * @param {number} tsMs timestamp value from the reply
 * @param {number} observedAtMs epoch ms when the reply was observed
 */
function timestampToDate(tsMs, observedAtMs) {
  const dayStart = observedAtMs - (observedAtMs % DAY_MS);
  return new Date(dayStart + (tsMs % DAY_MS));
}

/**
 * Analyse an ICMP Timestamp reply.
 *
 * @param {{
 *   originateTimestamp: number,  // echoed by target
 *   receiveTimestamp: number,    // set by target
 *   transmitTimestamp: number,   // set by target
 *   observedAt?: number,         // epoch ms when we saw the reply
 *   sourceIp?: string,
 *   osHint?: string
 * }} reply
 * @returns {{ analyzed: boolean, type, confidence, evidence, analysis? }}
 */
export function analyzeTimestampReply({
  originateTimestamp = 0,
  receiveTimestamp = 0,
  transmitTimestamp = 0,
  observedAt = Date.now(),
  sourceIp = 'unknown',
  osHint = '',
} = {}) {
  if (transmitTimestamp === 0 && receiveTimestamp === 0) {
    return {
      analyzed: true,
      type: 'ICMP Timestamp Silent',
      confidence: 'medium',
      severity: 'Info',
      evidence: `Host ${sourceIp} answered the timestamp request but zeroed receive/transmit fields — hardened or non-standard ICMP stack.`,
      analysis: {
        sourceIp,
        responsive: true,
        fieldsZeroed: true,
        clockSkewMs: null,
        utcOffsetHint: null,
      },
    };
  }

  const transmitDate = timestampToDate(transmitTimestamp, observedAt);
  const skewMs = transmitDate.getTime() - observedAt;
  const normalizedSkew =
    skewMs > DAY_MS / 2 ? skewMs - DAY_MS : skewMs < -DAY_MS / 2 ? skewMs + DAY_MS : skewMs;

  // Rough UTC-offset hint: assume the host's clock is roughly right and the
  // timestamp reflects its local midnight.
  const localMidnightOffsetMin = Math.round(
    ((observedAt % DAY_MS) - (transmitTimestamp % DAY_MS)) / 60000
  );
  const utcOffsetHint =
    localMidnightOffsetMin !== 0
      ? `~${(localMidnightOffsetMin / 60).toFixed(1)}h offset from observer clock`
      : 'aligned with observer clock';

  const osNotes = [];
  if (receiveTimestamp === transmitTimestamp && receiveTimestamp !== 0) {
    osNotes.push('receive == transmit timestamp — typical of Linux/Unix stacks.');
  }
  if (originateTimestamp === 0 && osHint) {
    osNotes.push(`originate zeroed (${osHint}).`);
  }
  if (Math.abs(normalizedSkew) > 60000) {
    osNotes.push(
      `Significant clock skew (${Math.round(normalizedSkew / 1000)}s) — useful host fingerprint; NTP likely absent or misconfigured.`
    );
  }

  return {
    analyzed: true,
    type: 'ICMP Timestamp Reply Analyzed',
    confidence: 'high',
    severity: Math.abs(normalizedSkew) > 60000 ? 'Low' : 'Info',
    cwe: 'CWE-200',
    evidence: `Host ${sourceIp} returned transmit timestamp ${transmitDate.toISOString().slice(11, 19)} UTC; clock skew vs observer: ${Math.round(normalizedSkew / 1000)}s; timezone hint: ${utcOffsetHint}.${osNotes.length ? ` ${osNotes.join(' ')}` : ''}`,
    analysis: {
      sourceIp,
      responsive: true,
      fieldsZeroed: false,
      transmitTimestampUtc: transmitDate.toISOString(),
      clockSkewMs: normalizedSkew,
      utcOffsetHint,
      osNotes,
    },
  };
}

export const ICMP_TIMESTAMP_ANALYZER = { analyzeTimestampReply };
export default ICMP_TIMESTAMP_ANALYZER;
