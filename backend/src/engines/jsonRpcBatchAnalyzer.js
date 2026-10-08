/**
 * jsonRpcBatchAnalyzer.js — JSON-RPC batch-handling analysis engine.
 *
 * Idea 00625 — JSON-RPC batch-handling analysis.
 *
 * Fingerprints JSON-RPC frameworks on authorized targets by analyzing how
 * servers handle batch requests (JSON-RPC 2.0 arrays): response ordering,
 * id echo behavior, error code shapes, and empty-batch / single-request
 * handling. Only standard-conformant introspection payloads are sent.
 */

const CANDIDATE_PATHS = ['/jsonrpc', '/rpc', '/api/rpc', '/json-rpc', '/rpc/v2', '/api/jsonrpc'];

/**
 * Candidate JSON-RPC endpoint URLs for a base URL.
 * @param {string} baseUrl
 * @param {string[]} [extraPaths]
 * @returns {string[]}
 */
export function jsonRpcCandidates(baseUrl, extraPaths = []) {
  if (!baseUrl || typeof baseUrl !== 'string') return [];
  const base = baseUrl.replace(/\/+$/, '');
  return [...new Set([...CANDIDATE_PATHS, ...extraPaths])].map(p => `${base}${p}`);
}

/**
 * Build a benign batch request for framework fingerprinting.
 * Uses only spec-level methods (rpc.discover style is avoided; unknown
 * methods are expected to return -32601, which is itself informative).
 * @param {Array<string|number>} ids request ids to include
 * @returns {object[]} batch request payload
 */
export function buildBatchRequest(ids = [1, 2]) {
  return ids.map((id, index) => ({
    jsonrpc: '2.0',
    method: `fingerprint.probe.${index}`,
    params: [],
    id,
  }));
}

/**
 * Analyze a batch response for framework fingerprint signals.
 * @param {unknown} response parsed JSON response (or raw string)
 * @param {Array<string|number>} requestIds ids that were sent
 * @returns {object} fingerprint signals
 */
export function analyzeBatchResponse(response, requestIds = []) {
  const signals = {
    isJsonRpc: false,
    preservesOrder: null,
    echoesIds: false,
    errorShape: null,
    responseCount: 0,
    frameworkHint: null,
  };
  let data = response;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return signals;
    }
  }
  if (data == null) return signals;
  const items = Array.isArray(data) ? data : [data];
  if (items.length === 0) return signals;
  signals.responseCount = items.length;
  signals.isJsonRpc = items.every(
    r =>
      r &&
      typeof r === 'object' &&
      (r.jsonrpc === '2.0' || r.id !== undefined || r.result !== undefined || r.error !== undefined)
  );
  const ids = items.map(r => r.id);
  signals.echoesIds = requestIds.length > 0 && requestIds.every(id => ids.includes(id));
  signals.preservesOrder =
    requestIds.length === items.length && requestIds.every((id, i) => ids[i] === id);
  const firstError = items.find(r => r && r.error);
  if (firstError) {
    const e = firstError.error;
    signals.errorShape = {
      code: e.code ?? null,
      hasMessage: typeof e.message === 'string',
      hasData: e.data !== undefined,
    };
    if (e.code === -32601 && /method not found/i.test(String(e.message || ''))) {
      signals.frameworkHint = 'Standard JSON-RPC 2.0 server (spec-compliant error codes)';
    }
  }
  if (!signals.preservesOrder && signals.echoesIds) {
    signals.frameworkHint =
      signals.frameworkHint || 'Batch-capable server with non-sequential response ordering';
  }
  return signals;
}

/**
 * Probe an endpoint's batch handling behavior.
 * @param {string} url
 * @param {Function} [fetchImpl] injectable fetch
 * @returns {Promise<object>} signals plus the endpoint URL
 */
export async function probeBatchHandling(url, fetchImpl = globalThis.fetch) {
  const outcome = { url, signals: null, error: null };
  const ids = [101, 102, 103];
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildBatchRequest(ids)),
    });
    const text = await res.text();
    outcome.signals = analyzeBatchResponse(text, ids);
    outcome.status = res.status;
  } catch (err) {
    outcome.error = err?.message || String(err);
  }
  return outcome;
}

/**
 * Summarize batch-handling analysis as a hardening note.
 * @param {object[]} probes
 * @returns {string|null}
 */
export function summarizeFindings(probes = []) {
  const exposed = probes.filter(p => p.signals && p.signals.isJsonRpc);
  if (exposed.length === 0) return null;
  const lines = exposed.map(p => {
    const s = p.signals;
    return `- ${p.url}: JSON-RPC 2.0 batch handling (responses: ${s.responseCount}, ids echoed: ${s.echoesIds}, order preserved: ${s.preservesOrder}${s.frameworkHint ? `, ${s.frameworkHint}` : ''})`;
  });
  return `JSON-RPC batch handling fingerprinted:\n${lines.join('\n')}\nRecommendation: validate batch size limits and ensure each batched call is authorized individually.`;
}
