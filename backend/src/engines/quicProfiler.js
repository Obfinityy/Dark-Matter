/**
 * quicProfiler.js — HTTP/3 QUIC handshake fingerprinting.
 *
 * QUIC stacks (quiche, quinn, msquic, ngtcp2, aioquic, s2n-quic, …) differ
 * in version negotiation, transport-parameter IDs and ordering, retry-token
 * behavior, and packet coalescing. This module fingerprints an observed
 * handshake — supplied by the caller as decoded handshake metadata — and
 * matches it against known stack behaviors.
 *
 * Pure analysis of observed protocol metadata; no network activity.
 *
 * Defensive use: authorized stack fingerprinting during bug-bounty recon
 * (identifying the HTTP/3 edge software in front of a target).
 */

// Transport parameter IDs (RFC 9000 §18) used as stack markers.
export const TRANSPORT_PARAM_IDS = {
  0x00: 'original_destination_connection_id',
  0x01: 'max_idle_timeout',
  0x02: 'stateless_reset_token',
  0x03: 'max_udp_payload_size',
  0x04: 'initial_max_data',
  0x05: 'initial_max_stream_data_bidi_local',
  0x06: 'initial_max_stream_data_bidi_remote',
  0x07: 'initial_max_stream_data_uni',
  0x08: 'initial_max_streams_bidi',
  0x09: 'initial_max_streams_uni',
  0x0a: 'ack_delay_exponent',
  0x0b: 'max_ack_delay',
  0x0c: 'disable_active_migration',
  0x0d: 'preferred_address',
  0x0e: 'active_connection_id_limit',
  0x0f: 'initial_source_connection_id',
  0x10: 'retry_source_connection_id',
  0x2ab2: 'google_version_1 (quiche)',
  0x3127: 'quinn_version_info',
  0x42: 'msquic_version_1',
};

const KNOWN_STACKS = [
  {
    stack: 'quiche (Cloudflare)',
    versions: ['0x00000001', '0xff00001d'],
    paramOrder: [0x02ab2, 0x00, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0e],
    retry: true,
    note: 'Advertises grease transport parameter 0x2ab2; typically sends Retry.',
  },
  {
    stack: 'quinn (Rust)',
    versions: ['0x00000001'],
    paramOrder: [0x3127, 0x00, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09],
    retry: false,
    note: 'Advertises 0x3127 version-info parameter.',
  },
  {
    stack: 'msquic (Microsoft)',
    versions: ['0x00000001'],
    paramOrder: [0x42, 0x00, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09],
    retry: false,
    note: 'Advertises msquic grease parameter 0x42.',
  },
  {
    stack: 'ngtcp2',
    versions: ['0x00000001', '0xff00001d'],
    paramOrder: [0x00, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0e],
    retry: false,
    note: 'Clean RFC 9000 parameter ordering, no vendor grease IDs.',
  },
  {
    stack: 'aioquic (Python)',
    versions: ['0x00000001'],
    paramOrder: [0x00, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0c],
    retry: false,
    note: 'Advertises disable_active_migration (0x0c) early in the list.',
  },
];

/**
 * Normalize a transport-parameter list, preserving order.
 *
 * @param {number[]} paramIds - In received order.
 * @returns {{ id: number, name: string }[]}
 */
export function normalizeTransportParams(paramIds) {
  return (paramIds || []).map((id) => ({
    id: Number(id),
    name: TRANSPORT_PARAM_IDS[id] || `unknown(0x${Number(id).toString(16)})`,
  }));
}

/**
 * Score an observed handshake against known QUIC stacks.
 *
 * @param {{ negotiatedVersion?: string, offeredVersions?: string[], paramIds?: number[], retrySeen?: boolean, coalescedPackets?: boolean }} hs
 * @returns {{ stack: string, score: number, note: string }[]} Best first.
 */
export function matchQuicStacks({ negotiatedVersion = '', offeredVersions = [], paramIds = [], retrySeen = false } = {}) {
  const offered = new Set((offeredVersions || []).map((v) => String(v).toLowerCase()));
  const negotiated = String(negotiatedVersion || '').toLowerCase();
  const obsParams = (paramIds || []).map(Number);

  const results = KNOWN_STACKS.map((sig) => {
    let score = 0;
    let weight = 0;
    // Version signal
    weight += 1;
    if (sig.versions.some((v) => v.toLowerCase() === negotiated || offered.has(v.toLowerCase()))) score += 1;
    // Grease/marker parameter presence
    weight += 2;
    const marker = sig.paramOrder.find((id) => id >= 0x2ab2 || id === 0x3127 || id === 0x42);
    if (marker !== undefined && obsParams.includes(marker)) score += 2;
    else if (marker === undefined && !obsParams.some((id) => id >= 0x2ab2 || id === 0x3127 || id === 0x42)) score += 1;
    // Parameter order similarity (longest common prefix fraction)
    weight += 1;
    let prefix = 0;
    for (let i = 0; i < Math.min(obsParams.length, sig.paramOrder.length); i++) {
      if (obsParams[i] === sig.paramOrder[i]) prefix++;
      else break;
    }
    score += sig.paramOrder.length ? prefix / sig.paramOrder.length : 0;
    // Retry behavior
    weight += 0.5;
    if (Boolean(retrySeen) === sig.retry) score += 0.5;
    return { stack: sig.stack, score: score / weight, note: sig.note };
  });
  return results.sort((a, b) => b.score - a.score);
}

/**
 * Full fingerprint of an observed QUIC handshake.
 *
 * @param {{ negotiatedVersion?: string, offeredVersions?: string[], paramIds?: number[], retrySeen?: boolean, coalescedPackets?: boolean, altSvc?: string }} input
 * @returns {{ type: string, negotiatedVersion: string, transportParams: object[], paramOrderSignature: string, candidates: object[], bestGuess: string|null, confidence: string, evidence: string }}
 */
export function profileQuicHandshake({
  negotiatedVersion = '',
  offeredVersions = [],
  paramIds = [],
  retrySeen = false,
  coalescedPackets = false,
  altSvc = '',
} = {}) {
  const transportParams = normalizeTransportParams(paramIds);
  const paramOrderSignature = transportParams.map((p) => `0x${p.id.toString(16)}`).join(',');
  const candidates = matchQuicStacks({ negotiatedVersion, offeredVersions, paramIds, retrySeen });
  const best = candidates[0];
  const bestGuess = best && best.score >= 0.55 ? best.stack : null;
  const confidence = bestGuess ? (best.score >= 0.85 ? 'high' : 'medium') : 'low';

  return {
    type: 'HTTP/3 QUIC Handshake Fingerprinting',
    negotiatedVersion: String(negotiatedVersion || ''),
    transportParams,
    paramOrderSignature,
    candidates,
    bestGuess,
    confidence,
    evidence: `QUIC handshake negotiated ${negotiatedVersion || '(unknown)'} with ${transportParams.length} transport parameter(s) [${paramOrderSignature || 'none'}]${retrySeen ? ', Retry observed' : ''}${
      coalescedPackets ? ', coalesced packets' : ''
    }${altSvc ? ` (Alt-Svc: ${altSvc})` : ''}${
      bestGuess ? ` — best match '${bestGuess}' (score ${best.score.toFixed(2)})` : ' — no confident stack match'
    }.`,
  };
}

export const QUIC_PROFILER = {
  TRANSPORT_PARAM_IDS,
  normalizeTransportParams,
  matchQuicStacks,
  profileQuicHandshake,
};
export default QUIC_PROFILER;
