/**
 * signalrNegotiateProber.js — SignalR negotiation endpoint probing engine.
 *
 * Idea 00621 — SignalR negotiation probing.
 *
 * For targets the user is authorized to test, probes known and user-supplied
 * SignalR negotiate endpoints and analyzes the negotiate response to reveal
 * protocol version and transport capabilities. Exposed negotiate metadata is
 * reported as a hardening finding (information disclosure), never abused.
 *
 * All network access goes through an injectable fetch so the engine is
 * unit-testable and never touches the network unless the caller asks.
 */

const COMMON_HUB_PATHS = [
  '/chathub',
  '/hub',
  '/hubs/chat',
  '/signalr',
  '/signalr/hubs',
  '/notificationHub',
  '/notifications',
  '/live',
  '/realtime',
  '/updates',
  '/messageHub',
  '/events',
  '/stream',
  '/ws',
  '/socket',
];

const KNOWN_TRANSPORTS = ['WebSockets', 'ServerSentEvents', 'LongPolling'];

/**
 * Build candidate negotiate endpoint URLs for a base URL.
 * @param {string} baseUrl base URL such as https://target.example
 * @param {string[]} [hubPaths] extra hub paths to include
 * @returns {string[]} negotiate endpoint URLs
 */
export function negotiateCandidates(baseUrl, hubPaths = []) {
  if (!baseUrl || typeof baseUrl !== 'string') return [];
  const base = baseUrl.replace(/\/+$/, '');
  const paths = [...new Set([...COMMON_HUB_PATHS, ...hubPaths])];
  return paths.map(p => `${base}${p.startsWith('/') ? p : `/${p}`}/negotiate?negotiateVersion=1`);
}

/**
 * Analyze a SignalR negotiate response body for version and transport info.
 * @param {unknown} body parsed JSON (or string) negotiate response
 * @param {object} [headers] response headers (for server fingerprinting)
 * @returns {object} { detected, connectionId, negotiateVersion, transports, serverHint }
 */
export function analyzeNegotiateResponse(body, headers = {}) {
  const result = {
    detected: false,
    connectionId: null,
    negotiateVersion: null,
    transports: [],
    serverHint: null,
  };
  let data = body;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return result;
    }
  }
  if (!data || typeof data !== 'object') return result;
  if (!data.connectionToken && !data.connectionId && !data.availableTransports) return result;
  result.detected = true;
  result.connectionId = data.connectionId || null;
  result.negotiateVersion = data.negotiateVersion ?? null;
  result.transports = Array.isArray(data.availableTransports)
    ? data.availableTransports
        .map(t => (typeof t === 'string' ? t : t.transport))
        .filter(t => KNOWN_TRANSPORTS.includes(t))
    : [];
  const server = String(headers.server || headers.Server || '').toLowerCase();
  if (server.includes('asp.net')) result.serverHint = 'ASP.NET SignalR / ASP.NET Core SignalR';
  if (data.negotiateVersion === 0 || data.connectionToken?.startsWith?.('SignalR:'))
    result.serverHint = 'Legacy ASP.NET SignalR (non-Core)';
  return result;
}

/**
 * Probe a single negotiate endpoint and return the fingerprint result.
 * @param {string} url negotiate endpoint URL
 * @param {Function} [fetchImpl] injectable fetch implementation
 * @returns {Promise<object>} fingerprint result including the endpoint URL
 */
export async function probeNegotiateEndpoint(url, fetchImpl = globalThis.fetch) {
  const outcome = { url, detected: false, transports: [], error: null };
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ protocol: 'json', version: 1 }),
    });
    const headers = {};
    res.headers?.forEach?.((v, k) => {
      headers[k.toLowerCase()] = v;
    });
    const text = await res.text();
    const analysis = analyzeNegotiateResponse(text, headers);
    Object.assign(outcome, analysis, { status: res.status });
  } catch (err) {
    outcome.error = err?.message || String(err);
  }
  return outcome;
}

/**
 * Summarize probing findings as a hardening note for the report.
 * @param {object[]} probes results from probeNegotiateEndpoint
 * @returns {string|null} human-readable finding, or null when nothing exposed
 */
export function summarizeFindings(probes = []) {
  const exposed = probes.filter(p => p.detected);
  if (exposed.length === 0) return null;
  const lines = exposed.map(p => {
    const transports = p.transports.length ? p.transports.join(', ') : 'unknown';
    return `- ${p.url}: SignalR negotiate exposed (transports: ${transports}${p.negotiateVersion != null ? `, negotiateVersion ${p.negotiateVersion}` : ''}${p.serverHint ? `, ${p.serverHint}` : ''})`;
  });
  return `Exposed SignalR negotiate endpoint(s) disclose protocol version and transport capabilities:\n${lines.join('\n')}\nRecommendation: restrict negotiate endpoints to authorized clients and avoid verbose metadata.`;
}
