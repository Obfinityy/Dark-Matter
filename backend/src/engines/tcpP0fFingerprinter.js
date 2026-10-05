/**
 * tcpP0fFingerprinter.js — TCP/IP stack p0f-style OS fingerprinting.
 *
 * Matches captured TCP SYN/ACK characteristics (TTL, window size, MSS,
 * TCP option order, DF flag) against a signature database in the style of
 * p0f, to identify the remote operating system without sending anything
 * beyond the normal connection handshake data already captured.
 *
 * This module is a pure offline analyzer: it consumes captured packet
 * fields and returns a structured verdict. It performs no network I/O.
 */

const P0F_SIGNATURES = [
  {
    os: 'Linux 5.x',
    ttl: 64, window: 64240, mss: 1460,
    options: ['mss', 'sackOK', 'ts', 'nop', 'wscale'],
    df: true,
  },
  {
    os: 'Linux 4.x',
    ttl: 64, window: 29200, mss: 1460,
    options: ['mss', 'sackOK', 'ts', 'nop', 'wscale'],
    df: true,
  },
  {
    os: 'Linux 2.6',
    ttl: 64, window: 5840, mss: 1460,
    options: ['mss', 'sackOK', 'ts', 'nop', 'wscale'],
    df: true,
  },
  {
    os: 'Windows 10/11',
    ttl: 128, window: 65535, mss: 1460,
    options: ['mss', 'nop', 'wscale', 'nop', 'nop', 'sackOK'],
    df: true,
  },
  {
    os: 'Windows 7/8/Server',
    ttl: 128, window: 8192, mss: 1460,
    options: ['mss', 'nop', 'nop', 'sackOK'],
    df: true,
  },
  {
    os: 'FreeBSD',
    ttl: 64, window: 65535, mss: 1460,
    options: ['mss', 'nop', 'wscale', 'sackOK', 'ts'],
    df: true,
  },
  {
    os: 'OpenBSD',
    ttl: 64, window: 16384, mss: 1460,
    options: ['mss', 'nop', 'wscale', 'sackOK', 'ts'],
    df: true,
  },
  {
    os: 'macOS / iOS',
    ttl: 64, window: 65535, mss: 1460,
    options: ['mss', 'nop', 'wscale', 'nop', 'nop', 'ts', 'sackOK'],
    df: true,
  },
  {
    os: 'Cisco IOS',
    ttl: 255, window: 4128, mss: 536,
    options: ['mss'],
    df: false,
  },
];

/**
 * Normalize a TCP options list to canonical tokens.
 * Accepts arrays like ['MSS','NOP','WScale'] or comma strings.
 */
function normalizeOptions(options) {
  if (!options) return [];
  const list = Array.isArray(options) ? options : String(options).split(/[,\s]+/);
  return list
    .map((o) => String(o).trim().toLowerCase())
    .map((o) => o.replace(/^wscale.*$/, 'wscale').replace(/^timestamp.*$/, 'ts').replace(/^sack-ok$/, 'sackOK'))
    .filter(Boolean);
}

/**
 * Score one signature against observed fields. Higher is better (max 10).
 */
function scoreSignature(sig, obs) {
  let score = 0; const matched = [];
  if (obs.ttl === sig.ttl) { score += 2; matched.push('ttl'); }
  else if (Math.abs(obs.ttl - sig.ttl) <= 2) { score += 1; matched.push('ttl~'); }
  if (obs.windowSize === sig.window) { score += 2; matched.push('window'); }
  if (obs.mss && obs.mss === sig.mss) { score += 1; matched.push('mss'); }
  if (obs.optionsOrder.length && JSON.stringify(obs.optionsOrder) === JSON.stringify(sig.options)) {
    score += 3; matched.push('options-order');
  } else if (obs.optionsOrder.length) {
    const setA = new Set(obs.optionsOrder); const setB = new Set(sig.options);
    const overlap = [...setA].filter((x) => setB.has(x)).length;
    if (overlap >= 3) { score += 1; matched.push('options-partial'); }
  }
  if (typeof obs.df === 'boolean' && obs.df === sig.df) { score += 1; matched.push('df'); }
  return { score, matched };
}

/**
 * Fingerprint the OS from captured SYN/ACK fields, p0f-style.
 * @param {{host?: string, ttl: number, windowSize: number, mss?: number, optionsOrder?: string[]|string, df?: boolean, quirks?: string[]}} input
 */
export function fingerprintTcpStack({ host = null, ttl, windowSize, mss = null, optionsOrder = [], df = null, quirks = [] } = {}) {
  if (!Number.isFinite(ttl) || !Number.isFinite(windowSize)) {
    return { host, os: 'unknown', confidence: 'none', error: 'TTL and window size are required.' };
  }
  const obs = { ttl, windowSize, mss, optionsOrder: normalizeOptions(optionsOrder), df };

  const scored = P0F_SIGNATURES.map((sig) => ({ os: sig.os, ...scoreSignature(sig, obs) }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  const runnerUp = scored[1];

  const confidence = best.score >= 8 ? 'high' : best.score >= 5 ? 'medium' : best.score >= 3 ? 'low' : 'none';
  const ambiguous = runnerUp && runnerUp.score === best.score && runnerUp.os !== best.os;

  return {
    host,
    os: confidence === 'none' ? 'unknown' : best.os,
    confidence: ambiguous ? 'low' : confidence,
    score: best.score,
    maxScore: 10,
    matchedFields: best.matched,
    runnerUp: runnerUp ? { os: runnerUp.os, score: runnerUp.score } : null,
    caveats: [
      'Observed TTL is decremented by each router hop — values a few below the signature TTL are normal.',
      'Middleboxes, load balancers and TCP-normalizing firewalls can rewrite window size and options.',
    ],
    observed: { ttl, windowSize, mss, optionsOrder: obs.optionsOrder, df, quirks },
    evidence: confidence === 'none'
      ? `No signature matched (best: ${best.os} at ${best.score}/10).`
      : `SYN/ACK (ttl=${ttl}, win=${windowSize}${mss ? `, mss=${mss}` : ''}) matches ${best.os} at ${best.score}/10${ambiguous ? ' — tied with ' + runnerUp.os : ''}.`,
  };
}

export const TCP_P0F_FINGERPRINTER = { fingerprintTcpStack, P0F_SIGNATURES };
export default TCP_P0F_FINGERPRINTER;
