/**
 * grpcWebDetector.js — gRPC-Web endpoint detection engine.
 *
 * Idea 00623 — gRPC-Web endpoint detection.
 *
 * Fingerprints gRPC-Web services on an authorized target by examining
 * Content-Type headers (application/grpc-web+proto, application/grpc-web-text)
 * and gRPC-Web message framing (1-byte flag + 4-byte big-endian length).
 * Probing sends only an empty/malformed envelope to elicit the server's
 * content-type behavior; nothing is executed or replayed.
 */

const GRPC_WEB_CONTENT_TYPES = [
  'application/grpc-web+proto',
  'application/grpc-web',
  'application/grpc-web-text',
];

const CANDIDATE_PATHS = ['/grpc', '/grpc-web', '/api/grpc', '/rpc', '/twirp', '/health'];

/**
 * Candidate gRPC-Web-ish paths under a base URL.
 * @param {string} baseUrl
 * @param {string[]} [extraPaths]
 * @returns {string[]}
 */
export function grpcWebCandidates(baseUrl, extraPaths = []) {
  if (!baseUrl || typeof baseUrl !== 'string') return [];
  const base = baseUrl.replace(/\/+$/, '');
  return [...new Set([...CANDIDATE_PATHS, ...extraPaths])].map(p => `${base}${p}`);
}

/**
 * Check whether a Content-Type value indicates gRPC-Web.
 * @param {string} contentType
 * @returns {{ detected: boolean, encoding: 'proto'|'text'|null }}
 */
export function analyzeContentType(contentType = '') {
  const ct = String(contentType).split(';')[0].trim().toLowerCase();
  const detected = GRPC_WEB_CONTENT_TYPES.some(g => ct === g);
  return {
    detected,
    encoding: ct.includes('text') ? 'text' : detected ? 'proto' : null,
  };
}

/**
 * Validate gRPC-Web / gRPC message framing in a byte buffer.
 * Each frame: 1 byte compressed-flag, 4 bytes big-endian length, payload.
 * @param {Uint8Array|Buffer} bytes
 * @returns {{ framed: boolean, frameCount: number, messageLengths: number[] }}
 */
export function isGrpcWebFramed(bytes) {
  const result = { framed: false, frameCount: 0, messageLengths: [] };
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes || []);
  if (buf.length < 5) return result;
  let offset = 0;
  const lengths = [];
  while (offset + 5 <= buf.length) {
    const flag = buf[offset];
    if (flag !== 0 && flag !== 1) break;
    const len = buf.readUInt32BE(offset + 1);
    if (offset + 5 + len > buf.length) break;
    lengths.push(len);
    offset += 5 + len;
  }
  result.frameCount = lengths.length;
  result.messageLengths = lengths;
  result.framed = lengths.length > 0 && offset === buf.length;
  return result;
}

/**
 * Build a minimal probe envelope (empty gRPC-Web message) for content-type elicitation.
 * @returns {Buffer}
 */
export function buildProbeEnvelope() {
  const frame = Buffer.alloc(5);
  frame[0] = 0; // uncompressed flag
  frame.writeUInt32BE(0, 1); // zero-length payload
  return frame;
}

/**
 * Probe a URL for gRPC-Web behavior.
 * @param {string} url
 * @param {Function} [fetchImpl] injectable fetch
 * @returns {Promise<object>} { url, detected, encoding, grpcStatus, error }
 */
export async function probeGrpcWeb(url, fetchImpl = globalThis.fetch) {
  const outcome = { url, detected: false, encoding: null, grpcStatus: null, error: null };
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/grpc-web+proto',
        Accept: 'application/grpc-web+proto',
        'X-Grpc-Web': '1',
      },
      body: buildProbeEnvelope(),
    });
    const headers = {};
    res.headers?.forEach?.((v, k) => {
      headers[k.toLowerCase()] = v;
    });
    const ct = analyzeContentType(headers['content-type']);
    outcome.detected = ct.detected;
    outcome.encoding = ct.encoding;
    outcome.grpcStatus =
      (headers['grpc-status'] ?? headers['grpc-message'] != null) ? headers['grpc-status'] : null;
    outcome.status = res.status;
  } catch (err) {
    outcome.error = err?.message || String(err);
  }
  return outcome;
}

/**
 * Summarize gRPC-Web detections as a hardening note.
 * @param {object[]} probes
 * @returns {string|null}
 */
export function summarizeFindings(probes = []) {
  const exposed = probes.filter(p => p.detected);
  if (exposed.length === 0) return null;
  const lines = exposed.map(
    p => `- ${p.url}: gRPC-Web detected (encoding: ${p.encoding || 'unknown'})`
  );
  return `gRPC-Web surface detected:\n${lines.join('\n')}\nRecommendation: review method-level authorization and disable server reflection on public endpoints.`;
}
