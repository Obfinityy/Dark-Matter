/**
 * connectProtocolDetector.js — Buf Connect protocol endpoint detector.
 *
 * Idea 00624 — Connect-protocol endpoint detection.
 *
 * Detects endpoints speaking the Connect RPC protocol (Buf) on authorized
 * targets by analyzing Content-Type patterns
 * (application/proto, application/json) together with the
 * Connect-Protocol-Version header, and by recognizing the canonical
 * /package.Service/Method URL shape. Only protocol metadata is inspected.
 */

const CONNECT_VERSION_HEADER = 'connect-protocol-version';
const CONNECT_CONTENT_TYPES = ['application/proto', 'application/json'];

/**
 * Check whether headers indicate the Connect protocol.
 * @param {object} headers response headers (any casing)
 * @returns {{ detected: boolean, version: string|null, connectProtocol: string|null }}
 */
export function analyzeConnectHeaders(headers = {}) {
  const lowered = {};
  for (const [k, v] of Object.entries(headers)) lowered[k.toLowerCase()] = String(v);
  const version = lowered[CONNECT_VERSION_HEADER] || null;
  const ct = (lowered['content-type'] || '').split(';')[0].trim().toLowerCase();
  const ctMatch = CONNECT_CONTENT_TYPES.includes(ct);
  const connectProtocol = lowered['connect-protocol'] || null;
  return {
    detected: version != null || (ctMatch && connectProtocol != null),
    version,
    connectProtocol,
  };
}

/**
 * Check whether a URL matches the Connect RPC path shape /package.Service/Method.
 * @param {string} url
 * @returns {{ matches: boolean, package: string|null, service: string|null, method: string|null }}
 */
export function matchConnectPath(url) {
  const result = { matches: false, package: null, service: null, method: null };
  try {
    const { pathname } = new URL(url);
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length < 2) return result;
    const last = segments[segments.length - 1];
    const serviceSegment = segments[segments.length - 2];
    if (!last || !serviceSegment) return result;
    if (last.includes('.') || !/^[A-Za-z][\w]*$/.test(last)) return result;
    const parts = serviceSegment.split('.');
    if (parts.length < 2) return result;
    result.matches = true;
    result.service = parts[parts.length - 1];
    result.package = parts.slice(0, -1).join('.');
    result.method = last;
    return result;
  } catch {
    return result;
  }
}

/**
 * Build a Connect protocol probe request (unary) for header elicitation.
 * The body is an intentionally empty payload to learn server behavior only.
 * @param {string} url procedure URL
 * @returns {{ url: string, options: object }}
 */
export function buildProbeRequest(url) {
  return {
    url,
    options: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/proto',
        'Connect-Protocol-Version': '1',
      },
      body: Buffer.alloc(0),
    },
  };
}

/**
 * Probe a URL for Connect protocol behavior.
 * @param {string} url
 * @param {Function} [fetchImpl] injectable fetch
 * @returns {Promise<object>} { url, detected, version, pathShape, error }
 */
export async function probeConnectEndpoint(url, fetchImpl = globalThis.fetch) {
  const outcome = { url, detected: false, version: null, pathShape: matchConnectPath(url), error: null };
  const { options } = buildProbeRequest(url);
  try {
    const res = await fetchImpl(url, options);
    const headers = {};
    res.headers?.forEach?.((v, k) => { headers[k.toLowerCase()] = v; });
    const analysis = analyzeConnectHeaders(headers);
    outcome.detected = analysis.detected;
    outcome.version = analysis.version;
    outcome.status = res.status;
  } catch (err) {
    outcome.error = err?.message || String(err);
  }
  return outcome;
}

/**
 * Summarize Connect detections as a hardening note.
 * @param {object[]} probes
 * @returns {string|null}
 */
export function summarizeFindings(probes = []) {
  const exposed = probes.filter((p) => p.detected || p.pathShape.matches);
  if (exposed.length === 0) return null;
  const lines = exposed.map((p) => {
    const shape = p.pathShape.matches ? `${p.pathShape.package}.${p.pathShape.service}/${p.pathShape.method}` : 'no procedure shape';
    return `- ${p.url}: Connect-style endpoint (shape: ${shape}${p.version ? `, protocol v${p.version}` : ''})`;
  });
  return `Connect-protocol RPC surface detected:\n${lines.join('\n')}\nRecommendation: enforce per-procedure authorization and avoid exposing internal package/service naming.`;
}
