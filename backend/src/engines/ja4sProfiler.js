/**
 * ja4sProfiler.js — JA4S TLS server-hello fingerprinting.
 *
 * JA4S fingerprints the TLS server: the negotiated version, cipher suite and
 * the server's extension list in wire order. This module computes a JA4S-style
 * fingerprint from captured ServerHello data and matches it against a known
 * server-fingerprint database (CDN edges, reverse proxies, origin stacks).
 * Pure analysis: takes already-captured handshake data as input, no network I/O.
 */

/**
 * Canonical TLS version label from the legacy_version / supported_versions value.
 * @param {number|string} version - e.g. 0x0304 or 'TLS1.3'
 */
export function tlsVersionLabel(version) {
  const v = typeof version === 'number' ? version : parseInt(String(version), 10);
  const map = { 0x0304: 't13', 0x0303: 't12', 0x0302: 't11', 0x0301: 't10', 0x0300: 's3' };
  if (map[v] !== undefined) return map[v];
  if (typeof version === 'string') {
    const m = version.match(/1\.(\d)/);
    if (m) return `t1${m[1]}`;
    if (/1\.3/i.test(version)) return 't13';
    if (/1\.2/i.test(version)) return 't12';
  }
  return 'u0';
}

/** Hash the extension list to a 12-char hex digest (FNV-1a 64-bit fold). */
export function hashExtensions(extensions) {
  const str = (extensions || []).map((e) => {
    if (typeof e === 'number') return e.toString(16).padStart(4, '0');
    return String(e).toLowerCase();
  }).join(',');
  let h1 = 0x811c9dc5, h2 = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h1 = Math.imul(h1 ^ str.charCodeAt(i), 0x01000193);
    h2 = Math.imul(h2 ^ str.charCodeAt(str.length - 1 - i), 0x01000193);
  }
  return ((h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0')).slice(0, 12);
}

/**
 * Compute a JA4S-style fingerprint from a captured ServerHello.
 *
 * JA4S format: <version>_<cipher>_<extensions-hash>
 *   a: negotiated TLS version label (t13/t12/...)
 *   b: negotiated cipher suite (hex, 4 chars)
 *   c: 12-char hash of the extension list in wire order
 *
 * @param {Object} hello
 * @param {number|string} hello.version - negotiated TLS version
 * @param {number|string} hello.cipher - negotiated cipher suite id
 * @param {Array<number|string>} [hello.extensions] - extension ids in wire order
 * @param {string} [hello.alpn] - negotiated ALPN protocol
 * @param {number} [hello.certCount] - number of certificates in the chain
 * @returns {{fingerprint: string, parts: Object}}
 */
export function computeJA4S({ version, cipher, extensions = [], alpn = null, certCount = null } = {}) {
  const a = tlsVersionLabel(version);
  let b = '0000';
  if (typeof cipher === 'number') b = cipher.toString(16).padStart(4, '0');
  else if (typeof cipher === 'string') b = cipher.replace(/^0x/i, '').padStart(4, '0').slice(-4);
  const c = hashExtensions(extensions);
  const fingerprint = `ja4s_${a}${b}_${c}`;
  return {
    fingerprint,
    parts: {
      version: a,
      cipher: b,
      extensionHash: c,
      extensionCount: extensions.length,
      alpn: alpn || null,
      certCount: certCount ?? null,
    },
  };
}

/** Small curated database of well-known JA4S-style server fingerprints → server stack. */
export const KNOWN_JA4S = [
  { match: /^ja4s_t1313/, label: 'TLS 1.3 terminator, AES-GCM preferred', confidence: 'medium' },
];

/**
 * Fingerprint a TLS server from its ServerHello and compare against known stacks.
 *
 * @param {Object} hello - same shape as computeJA4S input, plus optional:
 * @param {string} [hello.serverHint] - banner hint (e.g. Server header) for correlation
 * @returns {{fingerprint: string, parts: Object, knownMatches: Array, assessment: Object}}
 */
export function fingerprintServer(hello = {}) {
  const { fingerprint, parts } = computeJA4S(hello);
  const knownMatches = KNOWN_JA4S
    .filter((k) => k.match.test(fingerprint))
    .map((k) => ({ label: k.label, confidence: k.confidence }));

  const assessment = {
    modernStack: parts.version === 't13' || parts.version === 't12',
    extensionCount: parts.extensionCount,
    // TLS 1.3 with very few extensions often indicates a CDN edge or hardened proxy.
    likelyEdge: parts.version === 't13' && parts.extensionCount <= 4,
    // TLS 1.2 with many extensions often indicates an origin application server.
    likelyOrigin: parts.version === 't12' && parts.extensionCount >= 8,
  };

  return { fingerprint, parts, knownMatches, assessment, serverHint: hello.serverHint || null };
}

/**
 * Compare two ServerHello fingerprints for similarity (0..1).
 * Useful to detect when an IP routes to different server stacks per SNI.
 */
export function compareServerHellos(helloA, helloB) {
  const a = computeJA4S(helloA);
  const b = computeJA4S(helloB);
  if (a.fingerprint === b.fingerprint) return { similarity: 1, fingerprintA: a.fingerprint, fingerprintB: b.fingerprint, sameStack: true };
  let score = 0;
  if (a.parts.version === b.parts.version) score += 0.4;
  if (a.parts.cipher === b.parts.cipher) score += 0.3;
  if (a.parts.extensionHash === b.parts.extensionHash) score += 0.3;
  return { similarity: score, fingerprintA: a.fingerprint, fingerprintB: b.fingerprint, sameStack: score >= 0.7 };
}

export const JA4S_PROFILER = { computeJA4S, fingerprintServer, compareServerHellos, tlsVersionLabel, KNOWN_JA4S };
export default JA4S_PROFILER;
