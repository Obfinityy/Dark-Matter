/**
 * tcpTimingOsInferencer.js — TCP connect-timing OS inference for autonomous bug bounty.
 *
 * Implements idea-bank item 00410: infer the operating system from TCP
 * handshake timing characteristics combined with the IP TTL observed on
 * SYN-ACK packets.
 *
 * During an authorized engagement the caller performs ordinary TCP connects
 * to the target's own services (or services it is permitted to test) and
 * records per-attempt handshake timings plus the TTL of each SYN-ACK. This
 * module is pure analysis of those recorded samples: it profiles handshake
 * latency and jitter, folds in the TTL-based OS hint, and returns a ranked
 * OS hypothesis with explicit confidence. Timing alone is a weak signal,
 * so the module says so and weights TTL accordingly. No packets are sent
 * by this module.
 */

/**
 * Map an observed TTL to the most likely originating OS family. Common
 * initial TTLs: 64 (Linux/Unix), 128 (Windows), 255 (Cisco/network gear).
 * @param {number|null} ttl Observed TTL on the SYN-ACK.
 * @returns {{family:string, confidence:number}|null}
 */
export function ttlOsHint(ttl) {
  if (typeof ttl !== 'number' || ttl <= 0 || ttl > 255) return null;
  // Allow for a few hops of decrement from the canonical initial TTL.
  if (ttl > 120) return { family: 'Windows', confidence: 0.7 };
  if (ttl > 60) return { family: 'Linux/Unix', confidence: 0.6 };
  if (ttl > 40) return { family: 'Linux/Unix (distant)', confidence: 0.4 };
  return { family: 'Network appliance', confidence: 0.4 };
}

/**
 * Profile handshake timing: central tendency and jitter.
 * @param {Array<{synAckMs?:number, rttMs?:number, ttl?:number}>} samples Recorded connect samples.
 * @returns {{count:number, meanSynAckMs:number, jitterMs:number, meanTtl:number|null, profile:string}|null}
 */
export function handshakeTimingProfile(samples) {
  const list = (Array.isArray(samples) ? samples : []).filter((s) => s && typeof s.synAckMs === 'number' && s.synAckMs >= 0);
  if (list.length === 0) return null;
  const times = list.map((s) => s.synAckMs);
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const variance = times.reduce((s, v) => s + (v - mean) * (v - mean), 0) / times.length;
  const jitter = Math.sqrt(variance);
  const ttls = list.map((s) => s.ttl).filter((t) => typeof t === 'number');
  const meanTtl = ttls.length > 0 ? ttls.reduce((a, b) => a + b, 0) / ttls.length : null;
  // Timing texture: fast+steady stacks differ from slow+jittery ones.
  let profile = 'typical';
  if (mean < 15 && jitter < 5) profile = 'fast-low-jitter';
  else if (mean >= 15 && jitter < mean * 0.3) profile = 'steady';
  else if (jitter >= mean * 0.6) profile = 'high-jitter';
  const round = (v) => Math.round(v * 100) / 100;
  return {
    count: list.length,
    meanSynAckMs: round(mean),
    jitterMs: round(jitter),
    meanTtl: meanTtl == null ? null : round(meanTtl),
    profile,
  };
}

/**
 * Infer the OS from handshake timing samples and SYN-ACK TTLs.
 * @param {Array<{synAckMs?:number, rttMs?:number, ttl?:number}>} samples Recorded connect samples.
 * @returns {{os:string, confidence:number, evidence:string[], caveat:string}}
 */
export function inferOs(samples) {
  const profile = handshakeTimingProfile(samples);
  if (!profile) {
    return { os: 'unknown', confidence: 0, evidence: [], caveat: 'no usable handshake samples were provided' };
  }
  const evidence = [];
  evidence.push(`${profile.count} handshake samples: mean SYN-ACK ${profile.meanSynAckMs}ms, jitter ${profile.jitterMs}ms (${profile.profile})`);

  const hint = profile.meanTtl != null ? ttlOsHint(Math.round(profile.meanTtl)) : null;
  let os = 'unknown';
  let confidence = 0.25;
  if (hint) {
    os = hint.family;
    confidence = hint.confidence;
    evidence.push(`mean SYN-ACK TTL ${profile.meanTtl} suggests ${hint.family}`);
  } else {
    evidence.push('no TTL observations — timing-only inference is unreliable');
  }

  // Timing texture adjusts confidence: high jitter weakens any hypothesis.
  if (profile.profile === 'high-jitter') {
    confidence = Math.max(0.1, confidence - 0.2);
    evidence.push('high handshake jitter weakens the timing signal');
  } else if (profile.profile === 'fast-low-jitter' && hint && hint.family === 'Linux/Unix') {
    confidence = Math.min(0.85, confidence + 0.1);
    evidence.push('fast, low-jitter handshakes are consistent with a nearby Linux/Unix stack');
  }

  return {
    os,
    confidence: Math.round(confidence * 100) / 100,
    evidence,
    caveat: 'TCP timing alone cannot fingerprint an OS reliably; treat this as a hypothesis to corroborate with banner and behavior evidence.',
  };
}

/**
 * Compare OS hypotheses across several hosts/ports to spot mixed infrastructure.
 * @param {Array<{host:string, samples:Array}>} hosts Hosts with their recorded samples.
 * @returns {Array<{host:string, os:string, confidence:number}>}
 */
export function inferOsAcrossHosts(hosts) {
  const list = Array.isArray(hosts) ? hosts : [];
  return list.map((h) => {
    const rec = h && typeof h === 'object' ? h : {};
    const result = inferOs(rec.samples);
    return {
      host: typeof rec.host === 'string' ? rec.host : 'unknown',
      os: result.os,
      confidence: result.confidence,
    };
  });
}
