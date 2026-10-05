/**
 * h2SettingsProfiler.js — HTTP/2 SETTINGS frame fingerprinting.
 *
 * HTTP/2 servers announce their connection parameters in a SETTINGS frame
 * whose parameter IDs, values, and ORDER vary by implementation and version
 * (nghttp2, hyper-h2, nginx, h2o, Envoy, ATS, …). This module profiles an
 * observed SETTINGS frame — supplied by the caller as decoded parameters —
 * and matches it against a table of known stack signatures.
 *
 * Pure analysis of observed protocol metadata; no network activity.
 *
 * Defensive use: authorized stack fingerprinting during bug-bounty recon.
 */

// RFC 7540 SETTINGS parameter IDs.
export const SETTINGS_IDS = {
  0x1: 'HEADER_TABLE_SIZE',
  0x2: 'ENABLE_PUSH',
  0x3: 'MAX_CONCURRENT_STREAMS',
  0x4: 'INITIAL_WINDOW_SIZE',
  0x5: 'MAX_FRAME_SIZE',
  0x6: 'MAX_HEADER_LIST_SIZE',
};

// Known SETTINGS signatures: ordered [id, value] pairs observed in the wild.
const KNOWN_SIGNATURES = [
  {
    stack: 'nghttp2 (default)',
    params: [[1, 4096], [2, 0], [4, 65535], [5, 16384]],
    note: 'Canonical nghttp2 ordering; used by curl and many clients/proxies.',
  },
  {
    stack: 'nginx (ngx_http_v2)',
    params: [[3, 128], [4, 65536], [5, 16777215]],
    note: 'nginx server-side SETTINGS: max streams 128, large max frame size.',
  },
  {
    stack: 'h2o',
    params: [[1, 4096], [3, 100], [4, 65535], [5, 16384], [6, 32768]],
    note: 'h2o advertises MAX_HEADER_LIST_SIZE 32768.',
  },
  {
    stack: 'Envoy',
    params: [[1, 4096], [3, 2147483647], [4, 268435456], [5, 16384], [6, 4294967295]],
    note: 'Envoy uses very large concurrency and window values.',
  },
  {
    stack: 'hyper-h2 (Python)',
    params: [[1, 4096], [3, 100], [4, 65535], [5, 16384], [6, 65536]],
    note: 'hyper-h2 defaults with max header list 65536.',
  },
  {
    stack: 'Apache Traffic Server',
    params: [[1, 4096], [3, 2147483647], [4, 1048576], [5, 16384]],
    note: 'ATS large window, max streams unbounded.',
  },
];

/**
 * Normalize a decoded SETTINGS parameter list.
 *
 * @param {{ id: number, value: number }[]} params - In received order.
 * @returns {{ id: number, name: string, value: number }[]}
 */
export function normalizeSettings(params) {
  return (params || []).map((p) => ({
    id: Number(p.id),
    name: SETTINGS_IDS[p.id] || `UNKNOWN(0x${Number(p.id).toString(16)})`,
    value: Number(p.value),
  }));
}

/**
 * Score observed parameters against known stack signatures.
 * Order matters: exact order + values scores highest.
 *
 * @param {{ id: number, value: number }[]} params - In received order.
 * @returns {{ stack: string, score: number, note: string }[]} Best first.
 */
export function matchSettingsSignatures(params) {
  const obs = normalizeSettings(params);
  const results = KNOWN_SIGNATURES.map((sig) => {
    let orderScore = 0;
    let valueScore = 0;
    const n = Math.max(obs.length, sig.params.length);
    const len = Math.min(obs.length, sig.params.length);
    for (let i = 0; i < len; i++) {
      if (obs[i].id === sig.params[i][0]) orderScore++;
      if (obs[i].id === sig.params[i][0] && obs[i].value === sig.params[i][1]) valueScore++;
    }
    const score = n === 0 ? 0 : (orderScore * 0.5 + valueScore * 0.5) / n;
    return { stack: sig.stack, score, note: sig.note };
  });
  return results.sort((a, b) => b.score - a.score);
}

/**
 * Full profile of an observed HTTP/2 SETTINGS frame.
 *
 * @param {{ params: { id: number, value: number }[], alpn?: string, serverHeader?: string }} input
 * @returns {{ type: string, parameters: object[], orderSignature: string, candidates: object[], bestGuess: string|null, confidence: string, anomalies: string[], evidence: string }}
 */
export function profileH2Settings({ params = [], alpn = '', serverHeader = '' } = {}) {
  const parameters = normalizeSettings(params);
  const orderSignature = parameters.map((p) => `${p.id}=${p.value}`).join(',');
  const candidates = matchSettingsSignatures(params);
  const best = candidates[0];
  const bestGuess = best && best.score >= 0.6 ? best.stack : null;
  const confidence = bestGuess ? (best.score >= 0.95 ? 'high' : 'medium') : 'low';

  const anomalies = [];
  const win = parameters.find((p) => p.id === 0x4);
  if (win && win.value > 16777216) anomalies.push(`Unusually large INITIAL_WINDOW_SIZE (${win.value}) — typical of proxies/CDNs.`);
  const push = parameters.find((p) => p.id === 0x2);
  if (push && push.value === 1) anomalies.push('Server push explicitly enabled (rare; most servers disable it).');

  return {
    type: 'HTTP/2 SETTINGS Frame Fingerprinting',
    parameters,
    orderSignature,
    candidates,
    bestGuess,
    confidence,
    anomalies,
    evidence: `Observed SETTINGS [${orderSignature || 'empty'}]${
      alpn ? ` via ALPN '${alpn}'` : ''
    }${serverHeader ? ` (Server: ${serverHeader})` : ''}${
      bestGuess ? ` — best match '${bestGuess}' (score ${best.score.toFixed(2)})` : ' — no confident stack match'
    }.`,
  };
}

export const H2_SETTINGS_PROFILER = {
  SETTINGS_IDS,
  normalizeSettings,
  matchSettingsSignatures,
  profileH2Settings,
};
export default H2_SETTINGS_PROFILER;
