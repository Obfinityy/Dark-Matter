/**
 * realtimeVersionRecon.js — realtime-transport and API-version surface recon
 * probe builder and response analyzer.
 *
 * Idea 01061: GraphQL subscription handshake test — build graphql-ws
 * `connection_init` payload variants (empty, bearer-token, api-key, legacy
 * protocol forms) so the operator can check whether the subscription
 * transport validates auth differently than the HTTP endpoint.
 *
 * Idea 01062: Server-Sent Events endpoint discovery — canonical SSE probe
 * path candidates plus GET request descriptors with the text/event-stream
 * accept header, and a header analyzer that detects streaming responses.
 *
 * Idea 01063: SSE event-type enumeration — parse `event:` field values from
 * an operator-supplied stream and catalog them; event names reveal internal
 * workflows (payments, moderation, notifications).
 *
 * Idea 01064: SSE Last-Event-ID replay test — build request descriptors
 * carrying historical Last-Event-ID values, and compare a replayed stream
 * against a fresh one to detect re-emitted historical or cross-user data.
 *
 * Idea 01065: Long-polling endpoint discovery — candidate hanging-GET path
 * list, request-spec builder with hang-detection criteria, and a timing /
 * header analyzer that flags long-poll behavior.
 *
 * Idea 01066: API version path enumeration — version prefix candidate lists
 * and a builder that maps a base path into versioned path variants so the
 * operator can find live old versions with weaker validation.
 *
 * Idea 01067: API version header negotiation — header-variant specs
 * (Accept-version, X-API-Version, vendor MIME types) so the operator can
 * surface header-versioned API versions.
 *
 * Idea 01068: API version query-param test — query-parameter variant specs
 * (?version=, ?apiVersion=, ...) so the operator can find param-versioned
 * routes that bypass path-based WAF rules.
 *
 * Idea 01069: API version subdomain sweep — candidate versioned-subdomain
 * host generators (v2.api., api-v2., beta-api., ...) so the operator can
 * find version subdomains that point at staging stacks.
 *
 * Idea 01070: Old-version security regression diff — compare two
 * operator-supplied version-surface descriptors and flag authorization
 * checks present in the newer version but missing from the older one.
 *
 * No network calls: every function builds benign probe descriptors or
 * analyzes operator-supplied text (SSE streams, header snapshots, response
 * bodies). The agent's network layer performs the actual transport.
 * Defensive surface mapping of the engagement's own authorized target only.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Clamp and stringify an evidence snippet.
 * @param {string} text
 * @param {number} [maxLen]
 * @returns {string}
 */
function clipEvidence(text, maxLen = 200) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

/**
 * Build one recon finding.
 * @param {{type: string, title?: string, confidence?: string, evidence?: string, detail?: string}} finding
 * @returns {{type: string, title: string, confidence: string, evidence: string, detail: string}}
 */
function makeFinding(finding) {
  const { type, title = type, confidence = 'medium', evidence = '', detail = '' } = finding;
  return {
    type: String(type),
    title: String(title),
    confidence: ['low', 'medium', 'high'].includes(confidence) ? confidence : 'medium',
    evidence: clipEvidence(evidence),
    detail: String(detail || ''),
  };
}

/**
 * Case-insensitive header lookup over a plain object.
 * @param {Object<string, string>} headers
 * @param {string} name
 * @returns {string|null}
 */
function headerValue(headers, name) {
  if (!headers || typeof headers !== 'object') return null;
  const want = String(name).toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === want) return String(headers[key]);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Idea 01061 — GraphQL subscription handshake variants
// ---------------------------------------------------------------------------

/** Auth-payload shape candidates for graphql-ws connection_init. */
const SUBSCRIPTION_AUTH_VARIANTS = [
  { name: 'empty-payload', payload: {}, note: 'no auth material; detects transports that skip auth entirely' },
  { name: 'null-payload', payload: null, note: 'null payload; detects loose null handling' },
  { name: 'bearer-payload', payload: { authorization: 'Bearer <TOKEN>' }, note: 'token carried inside the payload object' },
  { name: 'auth-token-key', payload: { authToken: '<TOKEN>' }, note: 'camelCase authToken key variant' },
  { name: 'token-key', payload: { token: '<TOKEN>' }, note: 'bare token key variant' },
  { name: 'api-key-header-style', payload: { 'x-api-key': '<TOKEN>' }, note: 'api key carried inside payload' },
  { name: 'cookie-key', payload: { cookie: 'session=<TOKEN>' }, note: 'session cookie string inside payload' },
  { name: 'basic-auth', payload: { authorization: 'Basic <BASE64>' }, note: 'basic scheme instead of bearer' },
  { name: 'empty-string-token', payload: { authorization: 'Bearer ' }, note: 'empty bearer value; detects truthy-only checks' },
  { name: 'malformed-json-shape', payload: { authorization: { scheme: 'Bearer', value: '<TOKEN>' } }, note: 'nested object instead of string; detects type coercion' },
];

/**
 * Idea 01061 — build graphql-ws / legacy subscription-transport-ws
 * connection_init probe descriptors with varied auth payloads.
 * The operator sends each probe over a WebSocket and analyzes the reply
 * with analyzeSubscriptionHandshakeResponse().
 * @param {{includeLegacy?: boolean}} [options]
 * @returns {{label: string, protocol: string, messageType: string, payload: object|null, note: string}[]}
 */
export function graphqlWsHandshakeProbes(options = {}) {
  const { includeLegacy = true } = options;
  const probes = [];
  for (const variant of SUBSCRIPTION_AUTH_VARIANTS) {
    probes.push({
      label: `graphql-ws-handshake:${variant.name}`,
      protocol: 'graphql-ws',
      messageType: 'connection_init',
      payload: variant.payload,
      note: variant.note,
    });
    if (includeLegacy) {
      probes.push({
        label: `subscriptions-transport-ws-handshake:${variant.name}`,
        protocol: 'subscriptions-transport-ws',
        messageType: 'GQL_CONNECTION_INIT',
        payload: variant.payload,
        note: `legacy protocol form — ${variant.note}`,
      });
    }
  }
  return probes;
}

/**
 * Idea 01061 — analyze the server's reply to a handshake probe for
 * auth-handling differences (ack without auth, error text leaks).
 * @param {string} responseText - Raw WebSocket frame or handshake body from the operator.
 * @param {string} [probeLabel] - Label of the probe that produced this reply.
 * @returns {{type: string, title: string, confidence: string, evidence: string, detail: string}[]}
 */
export function analyzeSubscriptionHandshakeResponse(responseText = '', probeLabel = '') {
  const text = String(responseText || '');
  const findings = [];
  if (!text.trim()) return findings;
  const probeRef = probeLabel ? ` (probe ${probeLabel})` : '';

  if (/\b(connection_ack|GQL_CONNECTION_ACK)\b/i.test(text)) {
    const weakProbe = /empty-payload|null-payload|empty-string-token/.test(probeLabel);
    findings.push(makeFinding({
      type: 'subscription-handshake-auth-difference',
      title: `subscription transport acknowledged handshake${probeRef}`,
      confidence: weakProbe ? 'high' : 'medium',
      evidence: text.slice(0, 200),
      detail: weakProbe
        ? 'The subscription transport accepted a handshake carrying no usable auth material. The WebSocket auth path appears weaker than the HTTP path on the authorized target.'
        : 'Handshake accepted; compare against the HTTP auth requirements to spot divergence on the authorized target.',
    }));
  }
  if (/\b(connection_error|GQL_CONNECTION_ERROR)\b/i.test(text)) {
    findings.push(makeFinding({
      type: 'subscription-handshake-rejected',
      title: `subscription transport rejected handshake${probeRef}`,
      confidence: 'low',
      evidence: text.slice(0, 200),
      detail: 'Rejection observed. The rejection text may leak auth-validation internals; compare wording against HTTP 401 responses.',
    }));
    // Error text may disclose stack or validation internals.
    if (/exception|stack|unauthorized|forbidden|token|jwt/i.test(text)) {
      findings.push(makeFinding({
        type: 'subscription-error-text-leak',
        title: `subscription error text may leak internals${probeRef}`,
        confidence: 'medium',
        evidence: clipEvidence(text),
        detail: 'Handshake error text mentions auth/token internals. Log the exact phrasing for the report.',
      }));
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Ideas 01062–01064 — Server-Sent Events recon
// ---------------------------------------------------------------------------

/**
 * Idea 01062 — canonical Server-Sent Events probe path candidates.
 * @returns {string[]} Relative paths to probe on the target host.
 */
export function sseEndpointProbePaths() {
  return [
    '/events',
    '/stream',
    '/sse',
    '/notifications',
    '/notifications/stream',
    '/feed',
    '/updates',
    '/live',
    '/realtime',
    '/api/events',
    '/api/stream',
    '/api/v1/events',
    '/api/v1/stream',
    '/events/stream',
    '/sse/events',
    '/__events',
    '/subscribe',
  ];
}

/**
 * Idea 01062 — build GET request descriptors for SSE probing. The agent's
 * network layer sends them; analyzeSseResponseHeaders() evaluates replies.
 * @param {string[]} [paths]
 * @param {{origin?: string}} [options]
 * @returns {{label: string, method: string, path: string, headers: Object<string,string>, detect: string}[]}
 */
export function sseProbeDescriptors(paths = sseEndpointProbePaths(), options = {}) {
  const { origin = '' } = options;
  return (paths || [])
    .filter(p => typeof p === 'string' && p.startsWith('/'))
    .map(path => ({
      label: `sse-probe:${path}`,
      method: 'GET',
      path,
      headers: {
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        ...(origin ? { Origin: origin } : {}),
      },
      detect: 'endpoint is SSE-capable when the response Content-Type contains text/event-stream and the body streams event:/data: frames',
    }));
}

/**
 * Idea 01062 — detect SSE streaming from a response header snapshot plus
 * an optional leading body chunk.
 * @param {Object<string,string>} headers - Response headers from the operator.
 * @param {string} [leadingBody] - First chunk of the response body, if any.
 * @param {string} [path] - Probed path, for labeling.
 * @returns {{type: string, title: string, confidence: string, evidence: string, detail: string}[]}
 */
export function analyzeSseResponseHeaders(headers = {}, leadingBody = '', path = '') {
  const findings = [];
  const contentType = headerValue(headers, 'content-type') || '';
  const isEventStream = /text\/event-stream/i.test(contentType);
  if (isEventStream) {
    findings.push(makeFinding({
      type: 'sse-endpoint-confirmed',
      title: `SSE endpoint confirmed at ${path || 'probed path'}`,
      confidence: 'high',
      evidence: `Content-Type: ${contentType}`,
      detail: 'Server streams text/event-stream. Follow up with event-type enumeration (01063) and Last-Event-ID replay (01064) on the authorized target.',
    }));
    const buffering = headerValue(headers, 'x-accel-buffering');
    if (buffering && /no/i.test(buffering)) {
      findings.push(makeFinding({
        type: 'sse-streaming-tuned',
        title: 'SSE response explicitly disables proxy buffering',
        confidence: 'medium',
        evidence: `X-Accel-Buffering: ${buffering}`,
        detail: 'The endpoint is tuned for realtime delivery; expect low-latency privileged updates.',
      }));
    }
    const cors = headerValue(headers, 'access-control-allow-origin');
    if (cors === '*') {
      findings.push(makeFinding({
        type: 'sse-cors-wildcard',
        title: 'SSE endpoint allows any origin',
        confidence: 'medium',
        evidence: `Access-Control-Allow-Origin: ${cors}`,
        detail: 'A wildcard CORS policy on a streaming endpoint lets any site open the stream with the victim browser credentials.',
      }));
    }
  } else if (leadingBody && /^(event|data|id|retry)\s*:/im.test(leadingBody)) {
    findings.push(makeFinding({
      type: 'sse-probable-frames',
      title: `SSE-style frames without event-stream content type at ${path || 'probed path'}`,
      confidence: 'low',
      evidence: clipEvidence(leadingBody, 160),
      detail: 'Body contains SSE frame markers but the content type is not text/event-stream; verify manually.',
    }));
  }
  return findings;
}

/**
 * Parse raw SSE text into event frames.
 * @param {string} streamText
 * @returns {{event: string|null, data: string, id: string|null, retry: string|null}[]}
 */
function parseSseFrames(streamText) {
  const frames = [];
  const text = String(streamText || '').replace(/\r\n/g, '\n');
  if (!text.trim()) return frames;
  const blocks = text.split(/\n\n+/);
  for (const block of blocks) {
    const frame = { event: null, data: '', id: null, retry: null };
    let hasContent = false;
    for (const line of block.split('\n')) {
      const m = /^([A-Za-z][A-Za-z0-9_-]*)\s*:\s?(.*)$/.exec(line.trim());
      if (!m) continue;
      hasContent = true;
      const field = m[1].toLowerCase();
      const value = m[2];
      if (field === 'event') frame.event = value;
      else if (field === 'data') frame.data += (frame.data ? '\n' : '') + value;
      else if (field === 'id') frame.id = value;
      else if (field === 'retry') frame.retry = value;
    }
    if (hasContent) frames.push(frame);
  }
  return frames;
}

/** Event-name keywords that suggest sensitive internal workflows. */
const SENSITIVE_EVENT_KEYWORDS = [
  'payment', 'payout', 'refund', 'charge', 'billing', 'invoice',
  'moderation', 'ban', 'suspend', 'flag', 'review', 'appeal',
  'admin', 'internal', 'debug', 'audit', 'security',
  'order', 'shipment', 'kyc', 'verification', 'password', 'token',
  'salary', 'payroll', 'medical', 'location', 'geofence',
];

/**
 * Idea 01063 — catalog `event:` field values from an operator-supplied SSE
 * stream and flag event types that reveal internal workflows.
 * @param {string} streamText - Raw SSE stream text from the operator.
 * @param {string} [source] - Label of the probed endpoint.
 * @returns {{eventTypes: {name: string, count: number}[], totalFrames: number, findings: Object[]}}
 */
export function enumerateSseEventTypes(streamText = '', source = '') {
  const frames = parseSseFrames(streamText);
  const counts = new Map();
  for (const frame of frames) {
    const name = frame.event || '(default)';
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  const eventTypes = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const findings = [];
  for (const { name, count } of eventTypes) {
    if (name === '(default)') continue;
    const hit = SENSITIVE_EVENT_KEYWORDS.find(k => name.toLowerCase().includes(k));
    if (hit) {
      findings.push(makeFinding({
        type: 'sse-sensitive-event-type',
        title: `SSE event type '${name}' suggests internal workflow (${source || 'stream'})`,
        confidence: 'medium',
        evidence: `event: ${name} (observed ${count}x)`,
        detail: `The event name matches a sensitive-workflow keyword ('${hit}'). Check whether the stream's auth and audience are appropriate for this data on the authorized target.`,
      }));
    }
  }
  if (eventTypes.length >= 8) {
    findings.push(makeFinding({
      type: 'sse-rich-event-surface',
      title: `SSE stream exposes ${eventTypes.length} distinct event types (${source || 'stream'})`,
      confidence: 'low',
      evidence: eventTypes.slice(0, 5).map(e => e.name).join(', '),
      detail: 'A rich event taxonomy hints at broad internal workflows reachable over the stream.',
    }));
  }
  return { eventTypes, totalFrames: frames.length, findings };
}

/**
 * Idea 01064 — build request descriptors carrying historical Last-Event-ID
 * values so the operator can test whether the server re-emits old events.
 * @param {string[]} eventIds - Historical event IDs to replay.
 * @param {string[]} [paths]
 * @returns {{label: string, method: string, path: string, headers: Object<string,string>}[]}
 */
export function lastEventIdReplayProbes(eventIds = [], paths = sseEndpointProbePaths()) {
  const ids = (eventIds || []).filter(id => typeof id === 'string' && id.trim());
  const targets = (paths || []).filter(p => typeof p === 'string' && p.startsWith('/'));
  const probes = [];
  for (const path of targets) {
    for (const id of ids) {
      probes.push({
        label: `sse-replay:${path}:${id.slice(0, 24)}`,
        method: 'GET',
        path,
        headers: {
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Last-Event-ID': id,
        },
      });
    }
  }
  return probes;
}

/**
 * Idea 01064 — compare a Last-Event-ID replayed stream against a fresh
 * (no Last-Event-ID) stream from the same endpoint. Flags re-emitted
 * historical frames and content that looks like another user's data.
 * @param {string} replayedStream - Stream returned with Last-Event-ID set.
 * @param {string} freshStream - Stream returned without Last-Event-ID.
 * @param {string} replayedId - The event ID that was replayed.
 * @returns {{type: string, title: string, confidence: string, evidence: string, detail: string}[]}
 */
export function analyzeLastEventIdReplay(replayedStream = '', freshStream = '', replayedId = '') {
  const replayed = parseSseFrames(replayedStream);
  const fresh = parseSseFrames(freshStream);
  const findings = [];
  if (!replayed.length) return findings;

  const freshData = new Set(fresh.map(f => `${f.event || ''}::${f.data}`));
  const historicalFrames = replayed.filter(f => !freshData.has(`${f.event || ''}::${f.data}`));

  if (historicalFrames.length > 0) {
    findings.push(makeFinding({
      type: 'sse-last-event-id-replay',
      title: `server re-emitted ${historicalFrames.length} historical event frame(s) for Last-Event-ID ${replayedId || '(unknown)'}`,
      confidence: 'high',
      evidence: clipEvidence(historicalFrames.slice(0, 3).map(f => `${f.event || 'event'}: ${f.data.slice(0, 60)}`).join(' | ')),
      detail: 'The server honored a stale Last-Event-ID by replaying past frames. Review each re-emitted frame for other-user data on the authorized target.',
    }));
    // Heuristic: frames containing user-scoped identifiers that never appear
    // in the fresh stream deserve explicit cross-user review.
    const scoped = historicalFrames.filter(f => /\b(user|account|customer|member)[-_]?(id|email|name)\b/i.test(f.data));
    if (scoped.length > 0) {
      findings.push(makeFinding({
        type: 'sse-possible-cross-user-replay',
        title: 'replayed SSE frames reference user-scoped identifiers absent from the fresh stream',
        confidence: 'medium',
        evidence: clipEvidence(scoped[0].data, 160),
        detail: 'Historical frames may carry other users\u2019 data. Manually verify the identifiers belong to the operator\u2019s own account on the authorized target.',
      }));
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Idea 01065 — Long-polling endpoint discovery
// ---------------------------------------------------------------------------

/**
 * Idea 01065 — candidate paths for long-polling endpoints.
 * @returns {string[]} Relative paths to probe on the target host.
 */
export function longPollEndpointCandidates() {
  return [
    '/poll',
    '/longpoll',
    '/long-poll',
    '/updates',
    '/wait',
    '/await',
    '/listen',
    '/subscribe',
    '/pull',
    '/api/poll',
    '/api/updates',
    '/api/v1/poll',
    '/api/longpoll',
    '/notifications/poll',
    '/messages/poll',
    '/events/poll',
    '/ CometD'.trim(),
  ];
}

/**
 * Idea 01065 — build a hanging-GET request spec for a long-poll candidate.
 * The operator's network layer sends it and reports timing; then call
 * analyzeLongPollResponse() with the observed values.
 * @param {string} path
 * @param {{timeoutHintMs?: number, hangThresholdMs?: number, params?: Object<string,string>}} [options]
 * @returns {{label: string, method: string, path: string, query: Object<string,string>, hangThresholdMs: number, timeoutHintMs: number, detect: string}}
 */
export function longPollRequestSpec(path, options = {}) {
  const { timeoutHintMs = 45000, hangThresholdMs = 8000, params = {} } = options;
  return {
    label: `longpoll-probe:${path}`,
    method: 'GET',
    path: String(path || '/poll'),
    query: { ...params },
    hangThresholdMs,
    timeoutHintMs,
    detect: `long-poll behavior when the response takes longer than ${hangThresholdMs}ms without closing, or the server holds the connection near ${timeoutHintMs}ms before answering`,
  };
}

/**
 * Idea 01065 — evaluate timing/headers/body of a long-poll probe response.
 * @param {{durationMs: number, headers?: Object<string,string>, body?: string, path?: string}} observation
 * @param {{hangThresholdMs?: number}} [options]
 * @returns {{type: string, title: string, confidence: string, evidence: string, detail: string}[]}
 */
export function analyzeLongPollResponse(observation = {}, options = {}) {
  const { durationMs = 0, headers = {}, body = '', path = '' } = observation;
  const { hangThresholdMs = 8000 } = options;
  const findings = [];
  const hung = Number(durationMs) >= hangThresholdMs;

  if (hung) {
    findings.push(makeFinding({
      type: 'longpoll-hanging-get',
      title: `hanging GET detected at ${path || 'probed path'} (${Math.round(durationMs)}ms)`,
      confidence: 'medium',
      evidence: `response took ${Math.round(durationMs)}ms (threshold ${hangThresholdMs}ms)`,
      detail: 'The endpoint holds connections open — classic long-poll. These endpoints often bypass standard request logging; audit server-side logging coverage on the authorized target.',
    }));
    const contentType = headerValue(headers, 'content-type') || '';
    if (/json/i.test(contentType) && body) {
      findings.push(makeFinding({
        type: 'longpoll-delivered-update',
        title: `long-poll endpoint at ${path || 'probed path'} delivered a payload after hanging`,
        confidence: 'medium',
        evidence: clipEvidence(body, 160),
        detail: 'Review the delivered payload for privileged or cross-user update content and for weak auth on the poll endpoint.',
      }));
    }
  } else if (Number(durationMs) > 0) {
    findings.push(makeFinding({
      type: 'longpoll-no-hang',
      title: `no long-poll behavior at ${path || 'probed path'} (${Math.round(durationMs)}ms)`,
      confidence: 'low',
      evidence: `responded in ${Math.round(durationMs)}ms`,
      detail: 'Fast response; not a long-poll endpoint under current conditions. Retrying with auth/session state may change this.',
    }));
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Ideas 01066–01069 — API version surface discovery
// ---------------------------------------------------------------------------

/**
 * Idea 01066 — version prefix candidates for path enumeration.
 * @returns {string[]} Path prefixes, each starting with '/'.
 */
export function versionPathCandidates() {
  return [
    '/v1', '/v2', '/v3', '/v4', '/v0',
    '/v1.0', '/v2.0', '/v1.1',
    '/beta', '/alpha', '/canary', '/stable', '/latest',
    '/internal', '/private', '/staging', '/dev', '/test',
    '/api/v1', '/api/v2', '/rest/v1',
  ];
}

/**
 * Idea 01066 — map a base path into versioned path variants.
 * @param {string} basePath - e.g. '/users' or '/api/users'.
 * @param {string[]} [prefixes]
 * @returns {{label: string, method: string, path: string, prefix: string}[]}
 */
export function versionPathProbes(basePath = '/', prefixes = versionPathCandidates()) {
  const base = String(basePath || '/');
  const normalizedBase = base.startsWith('/') ? base : `/${base}`;
  return (prefixes || [])
    .filter(p => typeof p === 'string' && p.startsWith('/'))
    .map(prefix => ({
      label: `version-path:${prefix}${normalizedBase}`,
      method: 'GET',
      path: `${prefix}${normalizedBase}`,
      prefix,
    }));
}

/**
 * Idea 01066 — analyze versioned-path probe results. Takes operator-supplied
 * status/body pairs keyed by path and flags live versioned surfaces whose
 * error/validation behavior differs from the current version baseline.
 * @param {Object<string,{status: number, body?: string}>} results - path → observed response.
 * @param {string} [baselinePath] - Current-version path for comparison.
 * @returns {{liveVersions: string[], findings: Object[]}}
 */
export function analyzeVersionPathResults(results = {}, baselinePath = '') {
  const entries = Object.entries(results || {});
  const liveVersions = [];
  const findings = [];
  const baseline = baselinePath && results[baselinePath] ? results[baselinePath] : null;

  for (const [path, res] of entries) {
    if (!res || typeof res.status !== 'number') continue;
    if (res.status >= 200 && res.status < 400) {
      liveVersions.push(path);
      findings.push(makeFinding({
        type: 'versioned-path-live',
        title: `versioned path live: ${path} (HTTP ${res.status})`,
        confidence: 'high',
        evidence: clipEvidence(res.body || `HTTP ${res.status}`),
        detail: 'A versioned path answers successfully. Old versions often ship weaker validation; run authz regression checks (01070) against it on the authorized target.',
      }));
      if (baseline && baseline.body && res.body && res.body !== baseline.body) {
        findings.push(makeFinding({
          type: 'versioned-path-behavior-diff',
          title: `versioned path ${path} behaves differently from baseline ${baselinePath}`,
          confidence: 'medium',
          evidence: `baseline HTTP ${baseline.status} vs this path HTTP ${res.status}`,
          detail: 'Behavioral difference between versions. Diff the responses field-by-field to find dropped checks.',
        }));
      }
    }
  }
  return { liveVersions: [...new Set(liveVersions)].sort(), findings };
}

/**
 * Idea 01067 — header-negotiation variant specs for version discovery.
 * @param {string|number} version - Version to negotiate, e.g. 2 or 'v2'.
 * @param {{vendor?: string}} [options] - Vendor token for vendor MIME types.
 * @returns {{label: string, headers: Object<string,string>, note: string}[]}
 */
export function versionHeaderNegotiationVariants(version, options = {}) {
  const v = String(version == null ? '' : version).trim().replace(/^v/i, '');
  if (!v) return [];
  const { vendor = 'app' } = options;
  return [
    { label: `version-header:accept-version:${v}`, headers: { 'Accept-Version': v }, note: 'semver-style Accept-Version header' },
    { label: `version-header:x-api-version:${v}`, headers: { 'X-API-Version': v }, note: 'custom X-API-Version header' },
    { label: `version-header:x-version:${v}`, headers: { 'X-Version': v }, note: 'short X-Version header' },
    { label: `version-header:api-version:${v}`, headers: { 'API-Version': v }, note: 'bare API-Version header' },
    { label: `version-header:vendor-mime:${v}`, headers: { Accept: `application/vnd.${vendor}.v${v}+json` }, note: 'vendor MIME type versioning' },
    { label: `version-header:vendor-mime-param:${v}`, headers: { Accept: `application/vnd.${vendor}+json; version=${v}` }, note: 'vendor MIME with version parameter' },
    { label: `version-header:accept-param:${v}`, headers: { Accept: `application/json; version=${v}` }, note: 'version parameter on the standard JSON accept type' },
  ];
}

/**
 * Idea 01068 — query-parameter version variant specs.
 * @param {string|number} version - Version to request, e.g. 2 or 'v2'.
 * @returns {{label: string, query: Object<string,string>, note: string}[]}
 */
export function versionQueryParamVariants(version) {
  const v = String(version == null ? '' : version).trim();
  if (!v) return [];
  const paramNames = ['version', 'apiVersion', 'api_version', 'v', 'ver', 'api-version'];
  const values = [...new Set([v, v.replace(/^v/i, ''), `v${v.replace(/^v/i, '')}`])];
  const variants = [];
  for (const name of paramNames) {
    for (const value of values) {
      if (!value) continue;
      variants.push({
        label: `version-query:${name}=${value}`,
        query: { [name]: value },
        note: `param-versioned route request (${name}=${value}); watch for responses that differ from the path-versioned baseline`,
      });
    }
  }
  return variants;
}

/**
 * Idea 01069 — generate candidate versioned-subdomain hosts for a domain.
 * @param {string} hostname - Base domain, e.g. 'example.com' or 'api.example.com'.
 * @returns {{label: string, host: string, note: string}[]}
 */
export function versionSubdomainCandidates(hostname = '') {
  const host = String(hostname || '').trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
  if (!host || !host.includes('.')) return [];
  const parts = host.split('.');
  const root = parts.length > 2 && parts[0] === 'api' ? parts.slice(1).join('.') : host;
  const candidates = new Set();
  const add = (h) => { if (h && h !== host) candidates.add(h); };
  for (const v of ['v1', 'v2', 'v3', 'beta', 'alpha', 'canary', 'staging', 'dev']) {
    add(`${v}.api.${root}`);
    add(`api-${v}.${root}`);
    add(`${v}-api.${root}`);
    add(`${v}.${root}`);
  }
  add(`beta-api.${root}`);
  add(`api-beta.${root}`);
  add(`staging-api.${root}`);
  add(`api-staging.${root}`);
  add(`internal-api.${root}`);
  add(`legacy.${root}`);
  add(`old.${root}`);
  return [...candidates].sort().map(h => ({
    label: `version-subdomain:${h}`,
    host: h,
    note: 'version subdomain candidate; version subdomains often point at staging stacks with weaker controls',
  }));
}

/**
 * Idea 01069 — analyze version-subdomain probe results (operator-supplied
 * DNS/HTTP observations) and flag resolving versioned hosts.
 * @param {Object<string,{resolves: boolean, status?: number, server?: string}>} results - host → observation.
 * @returns {{liveHosts: string[], findings: Object[]}}
 */
export function analyzeVersionSubdomainResults(results = {}) {
  const liveHosts = [];
  const findings = [];
  for (const [host, res] of Object.entries(results || {})) {
    if (!res || res.resolves !== true) continue;
    liveHosts.push(host);
    findings.push(makeFinding({
      type: 'version-subdomain-live',
      title: `versioned subdomain resolves: ${host}${res.status ? ` (HTTP ${res.status})` : ''}`,
      confidence: res.status && res.status < 400 ? 'high' : 'medium',
      evidence: `host ${host} resolves${res.server ? `; Server: ${res.server}` : ''}`,
      detail: 'A live versioned subdomain may expose a staging or legacy stack. Fingerprint it before deeper testing on the authorized target.',
    }));
  }
  return { liveHosts: liveHosts.sort(), findings };
}

// ---------------------------------------------------------------------------
// Idea 01070 — old-version security regression diff
// ---------------------------------------------------------------------------

/**
 * Idea 01070 — normalize an operator-supplied version-surface descriptor.
 * Each descriptor lists the version's reachable paths and the authorization
 * checks enforced on them (observed from responses/docs, not guessed).
 * @param {{version: string, paths?: string[], authChecks?: {path: string, checks: string[]}[]}} surface
 * @returns {{version: string, paths: string[], checksByPath: Map<string, Set<string>>}}
 */
export function describeVersionSurface(surface = {}) {
  const { version = 'unknown', paths = [], authChecks = [] } = surface;
  const checksByPath = new Map();
  for (const entry of authChecks || []) {
    if (!entry || typeof entry.path !== 'string') continue;
    checksByPath.set(entry.path, new Set((entry.checks || []).map(c => String(c).trim().toLowerCase()).filter(Boolean)));
  }
  return {
    version: String(version),
    paths: [...new Set((paths || []).map(p => String(p)))],
    checksByPath,
  };
}

/**
 * Idea 01070 — diff authorization checks between an old version surface
 * and a new one. Flags checks present in the newer version but missing in
 * the older version (regressions the old version never received).
 * @param {{version: string, paths?: string[], authChecks?: {path: string, checks: string[]}[]}} oldSurface
 * @param {{version: string, paths?: string[], authChecks?: {path: string, checks: string[]}[]}} newSurface
 * @returns {{type: string, title: string, confidence: string, evidence: string, detail: string}[]}
 */
export function diffVersionSecurityRegressions(oldSurface = {}, newSurface = {}) {
  const oldV = describeVersionSurface(oldSurface);
  const newV = describeVersionSurface(newSurface);
  const findings = [];
  const allPaths = new Set([...oldV.checksByPath.keys(), ...newV.checksByPath.keys()]);

  for (const path of allPaths) {
    const oldChecks = oldV.checksByPath.get(path) || new Set();
    const newChecks = newV.checksByPath.get(path) || new Set();
    const missingInOld = [...newChecks].filter(c => !oldChecks.has(c));
    if (missingInOld.length > 0 && oldV.checksByPath.has(path)) {
      findings.push(makeFinding({
        type: 'version-security-regression',
        title: `v${oldV.version} misses authorization checks enforced in v${newV.version} on ${path}`,
        confidence: 'high',
        evidence: `missing in v${oldV.version}: ${missingInOld.join(', ')}`,
        detail: `Deprecated version v${oldV.version} never received newer authorization fixes present in v${newV.version}. Verify on the authorized target whether v${oldV.version} is still reachable and exploitable.`,
      }));
    }
    if (!oldV.checksByPath.has(path) && newV.checksByPath.has(path)) {
      findings.push(makeFinding({
        type: 'version-surface-gap',
        title: `path ${path} has auth-check data only for v${newV.version}; v${oldV.version} coverage unknown`,
        confidence: 'low',
        evidence: `checks in v${newV.version}: ${[...newChecks].join(', ')}`,
        detail: 'No check data was recorded for the old version on this path. Map the old version surface before concluding.',
      }));
    }
  }
  return findings.sort((a, b) => a.title.localeCompare(b.title));
}

// ---------------------------------------------------------------------------
// Uniform finding wrapper
// ---------------------------------------------------------------------------

/**
 * Build a uniform report finding from a recon result.
 * @param {{title?: string, kind?: string, evidence?: string, targets?: string[], confidence?: string}} result
 * @returns {{title: string, severity: string, confidence: string, kind: string, evidence: string, targets: string[], recommendation: string}}
 */
export function realtimeVersionReconFinding(result = {}) {
  const { title = 'realtime/version recon finding', kind = 'recon', evidence = '', targets = [], confidence = 'medium' } = result;
  return {
    title: `Realtime/version recon — ${title}`,
    severity: 'Info',
    confidence,
    kind,
    evidence,
    targets: Array.isArray(targets) ? targets : [],
    recommendation:
      'Review the flagged realtime or versioned surface on the authorized target: enforce identical auth ' +
      'validation on WebSocket/SSE/long-poll transports as on HTTP, retire or harden deprecated API versions, ' +
      'lock down version-negotiation headers and parameters, and treat version subdomains as production.',
  };
}

/**
 * Named-const registry for deterministic access, mirroring house style.
 */
export const REALTIME_VERSION_RECON = {
  graphqlWsHandshakeProbes,
  analyzeSubscriptionHandshakeResponse,
  sseEndpointProbePaths,
  sseProbeDescriptors,
  analyzeSseResponseHeaders,
  enumerateSseEventTypes,
  lastEventIdReplayProbes,
  analyzeLastEventIdReplay,
  longPollEndpointCandidates,
  longPollRequestSpec,
  analyzeLongPollResponse,
  versionPathCandidates,
  versionPathProbes,
  analyzeVersionPathResults,
  versionHeaderNegotiationVariants,
  versionQueryParamVariants,
  versionSubdomainCandidates,
  analyzeVersionSubdomainResults,
  describeVersionSurface,
  diffVersionSecurityRegressions,
  realtimeVersionReconFinding,
};

export default REALTIME_VERSION_RECON;
