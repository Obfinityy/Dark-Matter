/**
 * websocketCore.js — WebSocket / realtime-protocol recon probe builder and response analyzer.
 *
 * Idea 01041: WebSocket handshake fuzzing — generate mutation specs for the
 * upgrade headers (Origin, Sec-WebSocket-Protocol, Sec-WebSocket-Extensions,
 * Host) so the operator can detect handshake validation gaps that allow
 * cross-origin socket hijacking.
 *
 * Idea 01042: WebSocket token-in-URL detection — inspect ws:// / wss:// URLs
 * for credentials carried in the query string (?token=, ?auth=, …) since URL
 * tokens leak into proxy logs, browser history and Referer headers.
 *
 * Idea 01043: WebSocket subprotocol negotiation test — enumerate the
 * subprotocols to offer (graphql-ws, subscriptions-transport-ws, mqtt,
 * …) and parse the Sec-WebSocket-Protocol response to see which, if any,
 * the server accepted — deprecated protocols may carry weaker auth.
 *
 * Idea 01044: WebSocket path fuzzing — canonical candidate endpoint paths
 * (/ws, /socket.io, /realtime, /cable, /graphql-ws, …) plus an analyzer
 * that interprets an upgrade response (101 vs 404/400/426) as
 * endpoint-present / endpoint-absent.
 *
 * Idea 01045: Socket.IO namespace enumeration — candidate namespace
 * connection descriptors (/admin, /notifications, …) plus an analyzer for
 * the Engine.IO/Socket.IO handshake reply (namespace connect success vs
 * error packet).
 *
 * Idea 01046: Socket.IO event-name brute force — candidate event names to
 * emit with benign empty arguments plus an analyzer that flags non-error
 * responses (any connected handler responding indicates a live event).
 *
 * Idea 01047: Socket.IO polling fallback abuse — build a long-polling
 * transport descriptor (polling URL, sid, ping/pong cycle) so the operator
 * can force the polling transport and compare its auth behavior against
 * the WebSocket upgrade path.
 *
 * Idea 01048: ActionCable channel enumeration — candidate Rails ActionCable
 * channel subscribe payloads plus an analyzer for confirm_subscription /
 * reject_subscription / welcome / ping frames.
 *
 * Idea 01049: SignalR hub-method enumeration — hub-negotiation templates
 * (/negotiate query params, protocol versions) and common hub method
 * invocation payloads with benign empty arguments, plus a response
 * analyzer that distinguishes "method executed" from "unknown hub/method".
 *
 * Idea 01050: SignalR negotiate analysis — parse /negotiate JSON bodies for
 * connectionToken, connectionId, availableTransports and negotiateVersion;
 * assess token format/length to reveal session binding strength.
 *
 * No network calls: every function operates on operator-supplied strings
 * (URLs, header snapshots, /negotiate JSON bodies, handshake response
 * text). The agent's network layer performs the actual transport; this
 * module constructs probe descriptors for the operator to send and
 * analyzes the returned text for realtime-protocol exposure findings.
 * Defensive surface mapping of the engagement's own authorized target only.
 */

/**
 * Normalize operator-supplied response text: unescape JSON-escaped quotes
 * and newlines so parsers work on raw and JSON-serialized bodies alike.
 * @param {string} text
 * @returns {string}
 */
function normalizeText(text) {
  return String(text || '')
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\\\/g, '\\');
}

/**
 * Try to JSON-parse raw text first, then a normalized (unescaped) copy,
 * so parsers accept both raw server frames and doubly-escaped fixtures.
 * @param {string} text
 * @returns {any}
 */
function tryParseJson(text) {
  const raw = String(text || '').trim();
  try {
    return JSON.parse(raw);
  } catch {
    try {
      return JSON.parse(normalizeText(raw));
    } catch {
      return null;
    }
  }
}

/**
 * Parse a raw HTTP header block into a lowercase-keyed map. Accepts either
 * a header string ("Name: value\r\n…") or a pre-built object.
 * @param {string|object} headers
 * @returns {Object<string,string>}
 */
function toHeaderMap(headers) {
  const map = {};
  if (!headers) return map;
  if (typeof headers === 'object' && !Array.isArray(headers)) {
    for (const [k, v] of Object.entries(headers)) map[String(k).toLowerCase()] = String(v);
    return map;
  }
  const text = String(headers);
  for (const line of text.split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      const name = line.slice(0, idx).trim().toLowerCase();
      const value = line.slice(idx + 1).trim();
      if (name && !(name in map)) map[name] = value;
    }
  }
  return map;
}

/**
 * Idea 01041 — build WebSocket handshake mutation specs. Each spec is a
 * descriptor the operator replays through their own upgrade transport;
 * values are deliberately benign (null/mismatched origins, deprecated
 * protocols, unknown extensions) to expose validation gaps, never to
 * weaponize a connection.
 * @param {{host?: string, origin?: string, protocols?: string[], extensions?: string}} [base]
 * @returns {{id: string, title: string, mutate: Object<string,string|null>, expectation: string}[]}
 */
export function handshakeFuzzVariants(base = {}) {
  const origin = base.origin || 'https://app.example.com';
  const proto = (base.protocols && base.protocols[0]) || 'graphql-ws';
  const ext = base.extensions || 'permessage-deflate';
  return [
    {
      id: 'origin-null',
      title: 'Null Origin — checks whether a null Origin passes validation',
      mutate: { origin: 'null' },
      expectation: 'strict servers reject with 403; acceptance indicates CSWSH-style validation gaps',
    },
    {
      id: 'origin-arbitrary',
      title: 'Arbitrary cross-origin — checks cross-origin acceptance',
      mutate: { origin: 'https://attacker.example' },
      expectation: 'acceptance suggests missing Origin allow-list on the upgrade',
    },
    {
      id: 'origin-subdomain',
      title: 'Subdomain-suffix Origin — checks naive suffix matching',
      mutate: { origin: `${origin.replace(/^https?:\/\//, 'https://evil-')}` },
      expectation: 'acceptance suggests a suffix/prefix Origin check instead of exact matching',
    },
    {
      id: 'protocol-deprecated',
      title: 'Deprecated subprotocol offered — checks legacy protocol acceptance',
      mutate: { 'sec-websocket-protocol': 'subscriptions-transport-ws' },
      expectation: 'acceptance of the deprecated protocol while requesting a modern one indicates negotiation gaps',
    },
    {
      id: 'protocol-unknown',
      title: 'Unknown subprotocol offered — checks negotiation strictness',
      mutate: { 'sec-websocket-protocol': 'x-nonexistent-proto-9' },
      expectation: '101 with echoed unknown protocol indicates the server accepts anything offered',
    },
    {
      id: 'protocol-absent',
      title: 'Missing Sec-WebSocket-Protocol — checks whether protocol enforcement is skipped',
      mutate: { 'sec-websocket-protocol': null },
      expectation: '101 without protocol selection where the API requires one indicates weak enforcement',
    },
    {
      id: 'extension-unknown',
      title: 'Unknown extension requested — checks extension validation',
      mutate: { 'sec-websocket-extensions': 'x-unknown-ext' },
      expectation: 'acceptance suggests extensions are not validated against supported list',
    },
    {
      id: 'extension-absent',
      title: 'Missing Sec-WebSocket-Extensions — control case',
      mutate: { 'sec-websocket-extensions': null },
      expectation: 'normal 101; deviations from the baseline reveal extension-dependent behavior',
    },
    {
      id: 'header-case-mix',
      title: 'Mixed-case header names — checks header parsing normalization',
      mutate: { 'SEC-WEBSOCKET-PROTOCOL': proto, 'sEc-WeBsOcKeT-eXtEnSiOnS': ext },
      expectation: 'rejection suggests non-standard header parsing that may be inconsistent across proxies',
    },
    {
      id: 'duplicate-origin',
      title: 'Duplicate Origin headers — checks ambiguous header handling',
      mutate: { 'origin-duplicate': origin, origin: 'https://attacker.example' },
      expectation: 'which value wins reveals first-vs-last-wins behavior across the proxy chain',
    },
  ];
}

/**
 * Idea 01041 — analyze an upgrade response against the mutation that was
 * sent. Detects accepted mutations that widen the handshake attack surface.
 * @param {string|object} responseHeaders - Raw response header block or object.
 * @param {number} statusCode - HTTP status of the upgrade response.
 * @param {{id: string}} sentVariant - The variant descriptor from handshakeFuzzVariants.
 * @returns {{statusCode: number, accepted: boolean, switchedProtocols: boolean, echoedProtocol: string|null, echoedExtension: string|null, originAccepted: boolean, findings: object[]}}
 */
export function analyzeHandshakeResponse(responseHeaders, statusCode, sentVariant = {}) {
  const map = toHeaderMap(responseHeaders);
  const code = Number(statusCode) || 0;
  const switchedProtocols = code === 101;
  const upgrade = (map['upgrade'] || '').toLowerCase();
  const accepted = switchedProtocols && /websocket/.test(upgrade);
  const echoedProtocol = map['sec-websocket-protocol'] || null;
  const echoedExtension = map['sec-websocket-extensions'] || null;
  const originAccepted = accepted && sentVariant.id && /origin-(null|arbitrary|subdomain)/.test(sentVariant.id);

  const findings = [];
  if (originAccepted) {
    findings.push(
      websocketReconFinding({
        title: `handshake accepted mutated Origin (${sentVariant.id})`,
        kind: 'weak-handshake-validation',
        evidence: `Upgrade response ${code} with mutated Origin accepted by the server`,
        confidence: 'high',
      }),
    );
  }
  if (accepted && sentVariant.id === 'protocol-unknown' && echoedProtocol) {
    findings.push(
      websocketReconFinding({
        title: 'server echoed back an unknown subprotocol',
        kind: 'weak-subprotocol-negotiation',
        evidence: `Sec-WebSocket-Protocol: ${echoedProtocol}`,
        confidence: 'high',
      }),
    );
  }
  if (accepted && sentVariant.id === 'extension-unknown' && echoedExtension) {
    findings.push(
      websocketReconFinding({
        title: 'server accepted an unknown WebSocket extension',
        kind: 'weak-extension-negotiation',
        evidence: `Sec-WebSocket-Extensions: ${echoedExtension}`,
        confidence: 'medium',
      }),
    );
  }
  return {
    statusCode: code,
    accepted,
    switchedProtocols,
    echoedProtocol,
    echoedExtension,
    originAccepted,
    findings,
  };
}

/**
 * Idea 01042 — flag credential-bearing query parameters on ws:// / wss://
 * URLs. Tokens in the URL leak into proxy logs, browser history and the
 * Referer header sent to third parties.
 * @param {string} wsUrl
 * @returns {{url: string, flaggedParams: {name: string, valuePreview: string}[], hasCredentials: boolean, findings: object[]}}
 */
export function detectTokenInUrl(wsUrl = '') {
  const url = String(wsUrl || '').trim();
  const flaggedParams = [];
  const sensitiveRe = /^(token|auth|authorization|api[_-]?key|apikey|access[_-]?token|jwt|session[_-]?id|sid|secret|password|passwd|pwd|bearer)$/i;
  let query = '';
  try {
    // ws: / wss: URLs parse fine with the WHATWG URL parser.
    const parsed = new URL(url);
    query = parsed.search ? parsed.search.slice(1) : '';
  } catch {
    const qIdx = url.indexOf('?');
    query = qIdx >= 0 ? url.slice(qIdx + 1) : '';
  }
  for (const pair of query.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const name = decodeURIComponent((eq >= 0 ? pair.slice(0, eq) : pair).replace(/\+/g, ' '));
    const rawValue = eq >= 0 ? pair.slice(eq + 1) : '';
    if (sensitiveRe.test(name)) {
      flaggedParams.push({
        name,
        valuePreview: rawValue ? `${rawValue.slice(0, 4)}…(${rawValue.length} chars)` : '(empty)',
      });
    }
  }
  const hasCredentials = flaggedParams.length > 0;
  const findings = hasCredentials
    ? [
        websocketReconFinding({
          title: 'credentials carried in WebSocket URL query string',
          kind: 'token-in-url',
          evidence: `parameters: ${flaggedParams.map(p => p.name).join(', ')} on ${url.split('?')[0]}`,
          confidence: 'high',
        }),
      ]
    : [];
  return { url, flaggedParams, hasCredentials, findings };
}

/**
 * Idea 01043 — canonical subprotocol probe list: offer each protocol
 * alternately so the operator can observe which the server accepts.
 * Deprecated-but-supported protocols may run with weaker auth.
 * @returns {{protocol: string, status: string, notes: string}[]}
 */
export function subprotocolProbeList() {
  return [
    { protocol: 'graphql-ws', status: 'current', notes: 'current graphql-ws subprotocol' },
    { protocol: 'subscriptions-transport-ws', status: 'deprecated', notes: 'deprecated legacy Apollo protocol; weaker auth possible' },
    { protocol: 'graphql-transport-ws', status: 'current', notes: 'modern graphql-ws alias' },
    { protocol: 'mqtt', status: 'current', notes: 'MQTT over WebSocket; broker ACLs may differ' },
    { protocol: 'mqttv3.1', status: 'legacy', notes: 'legacy MQTT protocol version marker' },
    { protocol: 'stomp', status: 'current', notes: 'STOMP over WebSocket; destination ACLs may differ' },
    { protocol: 'wamp', status: 'current', notes: 'WAMP subprotocol' },
    { protocol: 'soap', status: 'legacy', notes: 'legacy SOAP-over-WebSocket marker' },
    { protocol: 'xmpp', status: 'legacy', notes: 'legacy XMPP-over-WebSocket marker' },
    { protocol: 'sip', status: 'legacy', notes: 'legacy SIP-over-WebSocket marker' },
    { protocol: 'chat', status: 'custom', notes: 'common custom protocol name used by demo/chat servers' },
  ];
}

/**
 * Idea 01043 — parse a Sec-WebSocket-Protocol response against the offered
 * list to determine which protocol (if any) the server negotiated.
 * @param {string[]} offered - Protocols the operator offered, in order.
 * @param {string|object} responseHeaders - Raw upgrade response headers.
 * @returns {{offered: string[], accepted: string|null, acceptedDeprecated: boolean, findings: object[]}}
 */
export function analyzeSubprotocolResponse(offered = [], responseHeaders) {
  const map = toHeaderMap(responseHeaders);
  const accepted = (map['sec-websocket-protocol'] || '').trim() || null;
  const offeredList = (offered || []).map(p => String(p).trim()).filter(Boolean);
  const acceptedDeprecated = accepted !== null && !offeredList.includes(accepted);
  const findings = [];
  if (accepted && acceptedDeprecated) {
    findings.push(
      websocketReconFinding({
        title: 'server negotiated a subprotocol the client did not offer',
        kind: 'protocol-confusion',
        evidence: `Sec-WebSocket-Protocol: ${accepted}`,
        confidence: 'high',
      }),
    );
  }
  if (accepted && /subscriptions-transport-ws/.test(accepted)) {
    findings.push(
      websocketReconFinding({
        title: 'deprecated subscriptions-transport-ws subprotocol accepted',
        kind: 'deprecated-subprotocol',
        evidence: `Sec-WebSocket-Protocol: ${accepted}`,
        confidence: 'high',
      }),
    );
  }
  return { offered: offeredList, accepted, acceptedDeprecated, findings };
}

/**
 * Idea 01044 — canonical candidate WebSocket endpoint paths, including
 * framework defaults that rarely appear in REST documentation.
 * @returns {{path: string, framework: string, notes: string}[]}
 */
export function websocketPathCandidates() {
  return [
    { path: '/ws', framework: 'generic', notes: 'most common generic socket path' },
    { path: '/websocket', framework: 'generic', notes: 'generic long-form path' },
    { path: '/socket', framework: 'generic', notes: 'generic short path' },
    { path: '/socket.io/', framework: 'socket.io', notes: 'Socket.IO default path (trailing slash)' },
    { path: '/socket.io', framework: 'socket.io', notes: 'Socket.IO path without trailing slash' },
    { path: '/realtime', framework: 'generic', notes: 'common realtime naming' },
    { path: '/cable', framework: 'rails-actioncable', notes: 'Rails ActionCable default mount' },
    { path: '/graphql-ws', framework: 'graphql', notes: 'GraphQL subscription socket default' },
    { path: '/subscriptions', framework: 'graphql', notes: 'GraphQL subscriptions alternate path' },
    { path: '/graphql', framework: 'graphql', notes: 'GraphQL endpoint that may accept ws:// upgrades' },
    { path: '/api/ws', framework: 'generic', notes: 'API-prefixed socket path' },
    { path: '/api/v1/ws', framework: 'generic', notes: 'versioned API socket path' },
    { path: '/live', framework: 'generic', notes: 'live-feed naming' },
    { path: '/stream', framework: 'generic', notes: 'streaming naming' },
    { path: '/events', framework: 'generic', notes: 'server-events naming' },
    { path: '/notifications', framework: 'generic', notes: 'notification socket naming' },
    { path: '/chat', framework: 'generic', notes: 'chat socket naming' },
    { path: '/hub', framework: 'signalr', notes: 'SignalR hub naming' },
    { path: '/signalr', framework: 'signalr', notes: 'SignalR default naming' },
    { path: '/hubs/chat', framework: 'signalr', notes: 'SignalR chat hub example path' },
  ];
}

/**
 * Idea 01044 — interpret an upgrade response for one candidate path:
 * 101 with an Upgrade header means the socket endpoint exists; 426 means
 * upgrade-capable but refused; 404/400/403 mean absent or filtered.
 * @param {string} path - Candidate path that was probed.
 * @param {number} statusCode - HTTP status of the response.
 * @param {string|object} responseHeaders - Raw response headers.
 * @param {string} [responseBody]
 * @returns {{path: string, statusCode: number, state: 'open'|'upgrade-capable'|'absent'|'filtered'|'unknown', findings: object[]}}
 */
export function analyzePathProbe(path, statusCode, responseHeaders, responseBody = '') {
  const map = toHeaderMap(responseHeaders);
  const code = Number(statusCode) || 0;
  const upgradeHeader = (map['upgrade'] || '').toLowerCase();
  const body = normalizeText(responseBody).slice(0, 4000);
  let state = 'unknown';
  if (code === 101 && /websocket/.test(upgradeHeader)) state = 'open';
  else if (code === 426) state = 'upgrade-capable';
  else if (code === 404) state = 'absent';
  else if (code === 400 || code === 403) state = 'filtered';
  else if (code >= 200 && code < 300) state = 'absent';

  const findings = [];
  if (state === 'open') {
    findings.push(
      websocketReconFinding({
        title: `live WebSocket endpoint discovered at ${path}`,
        kind: 'socket-endpoint-found',
        evidence: `HTTP ${code} with Upgrade: ${map['upgrade'] || '(missing)'}`,
        targets: [String(path)],
        confidence: 'high',
      }),
    );
  } else if (state === 'upgrade-capable') {
    findings.push(
      websocketReconFinding({
        title: `upgrade-capable endpoint at ${path} (426)`,
        kind: 'socket-endpoint-candidate',
        evidence: `HTTP 426 response body: ${body.slice(0, 160) || '(empty)'}`,
        targets: [String(path)],
        confidence: 'medium',
      }),
    );
  }
  return { path: String(path), statusCode: code, state, findings };
}

/**
 * Idea 01045 — candidate Socket.IO namespace connection descriptors.
 * Namespaces partition privilege; /admin-style namespaces sometimes lack
 * authorization on connect.
 * @returns {{namespace: string, riskNote: string}[]}
 */
export function socketIoNamespaces() {
  return [
    { namespace: '/', riskNote: 'default namespace; baseline connect behavior' },
    { namespace: '/admin', riskNote: 'privileged administration namespace' },
    { namespace: '/notifications', riskNote: 'notification fan-out namespace' },
    { namespace: '/chat', riskNote: 'chat namespace' },
    { namespace: '/user', riskNote: 'per-user namespace pattern' },
    { namespace: '/users', riskNote: 'plural per-user namespace pattern' },
    { namespace: '/private', riskNote: 'private namespace marker' },
    { namespace: '/secure', riskNote: 'secure namespace marker' },
    { namespace: '/internal', riskNote: 'internal tooling namespace' },
    { namespace: '/debug', riskNote: 'debug namespace' },
    { namespace: '/test', riskNote: 'test namespace' },
    { namespace: '/dev', riskNote: 'development namespace' },
    { namespace: '/metrics', riskNote: 'metrics namespace' },
    { namespace: '/events', riskNote: 'event namespace' },
    { namespace: '/stream', riskNote: 'streaming namespace' },
    { namespace: '/support', riskNote: 'support namespace' },
    { namespace: '/moderator', riskNote: 'moderation namespace' },
    { namespace: '/system', riskNote: 'system namespace' },
  ];
}

/**
 * Idea 01045 — analyze a Socket.IO connect reply for one namespace.
 * Socket.IO v4+ Engine.IO frames: "0" = open, "40" = connect ok,
 * "44" = connect error. Anything accepted without auth is notable.
 * @param {string} namespace
 * @param {string} replyText - Raw packet text returned for the connect attempt.
 * @returns {{namespace: string, state: 'connected'|'error'|'rejected'|'unknown', errorMessage: string|null, findings: object[]}}
 */
export function analyzeNamespaceReply(namespace, replyText = '') {
  const text = normalizeText(replyText).trim();
  let state = 'unknown';
  let errorMessage = null;
  if (/^40(,|$)/.test(text) || /"sid"\s*:/.test(text)) {
    state = 'connected';
  } else if (/^44/.test(text)) {
    state = 'error';
    const m = text.match(/44"?\s*,\s*"?([^"]{0,300})/);
    errorMessage = m ? m[1] : 'connect error';
  } else if (/unauthorized|forbidden|not allowed|auth/i.test(text)) {
    state = 'rejected';
    errorMessage = text.slice(0, 200);
  }

  const findings = [];
  if (state === 'connected' && namespace !== '/') {
    findings.push(
      websocketReconFinding({
        title: `Socket.IO namespace ${namespace} accepted connection`,
        kind: 'namespace-accessible',
        evidence: `connect reply: ${text.slice(0, 160) || '(empty)'}`,
        targets: [String(namespace)],
        confidence: 'high',
      }),
    );
  }
  return { namespace: String(namespace), state, errorMessage, findings };
}

/**
 * Idea 01046 — common Socket.IO event names to emit with benign empty
 * arguments. Unlisted events often still trigger handlers, including
 * privileged ones.
 * @returns {{event: string, args: any[], notes: string}[]}
 */
export function socketIoEventNames() {
  const common = [
    'message', 'join', 'leave', 'subscribe', 'unsubscribe', 'ping', 'pong',
    'authenticate', 'auth', 'login', 'logout', 'register', 'update', 'delete',
    'create', 'get', 'list', 'fetch', 'query', 'search', 'notify',
    'broadcast', 'emit', 'send', 'receive', 'typing', 'read', 'seen',
    'admin', 'config', 'settings', 'status', 'health', 'debug', 'test',
    'room:join', 'room:leave', 'user:join', 'user:leave', 'channel:join',
    'data', 'payload', 'request', 'response', 'command', 'action', 'execute',
  ];
  return common.map(event => ({
    event,
    args: [],
    notes: 'benign empty-argument emit; operator watches for non-error replies',
  }));
}

/**
 * Idea 01046 — analyze a server reply to an emitted event. A non-error,
 * non-empty reply indicates a live handler; error packets ("44…") and
 * empty acks indicate no handler or a filtered event.
 * @param {string} event - Event name that was emitted.
 * @param {string} replyText - Raw reply packet text.
 * @returns {{event: string, handled: boolean|null, kind: 'response'|'error'|'ack-empty'|'none', findings: object[]}}
 */
export function analyzeEventReply(event, replyText = '') {
  const text = normalizeText(replyText).trim();
  let kind = 'none';
  let handled = null;
  if (/^44/.test(text) || /"error"|error.*not|unknown event|no handler/i.test(text)) {
    kind = 'error';
    handled = false;
  } else if (/^42/.test(text) && text.length > 3) {
    kind = 'response';
    handled = true;
  } else if (/^43/.test(text) || text === '2') {
    kind = 'ack-empty';
    handled = null;
  } else if (text.length > 0) {
    kind = 'response';
    handled = true;
  }

  const findings = [];
  if (handled === true) {
    findings.push(
      websocketReconFinding({
        title: `Socket.IO event "${event}" triggered a handler response`,
        kind: 'live-event',
        evidence: `reply packet: ${text.slice(0, 160)}`,
        confidence: 'high',
      }),
    );
  }
  return { event: String(event), handled, kind, findings };
}

/**
 * Idea 01047 — build a long-polling transport descriptor for Socket.IO so
 * the operator can force the polling path and compare its auth behavior
 * with the WebSocket upgrade path. Pure descriptor — no requests sent.
 * @param {{path?: string, host?: string, sid?: string|null, eioVersion?: number, secure?: boolean}} [options]
 * @returns {{transport: string, pollUrl: string, cycle: string[], method: string, headers: object, notes: string}}
 */
export function pollingFallbackDescriptor(options = {}) {
  const {
    path = '/socket.io/',
    host = 'target.example.com',
    sid = null,
    eioVersion = 4,
    secure = true,
  } = options;
  const scheme = secure ? 'https' : 'http';
  const base = `${scheme}://${host}${path.startsWith('/') ? path : `/${path}`}`;
  const params = [`EIO=${eioVersion}`, 'transport=polling'];
  if (sid) params.push(`sid=${encodeURIComponent(sid)}`);
  return {
    transport: 'polling',
    pollUrl: `${base}?${params.join('&')}`,
    cycle: [
      'GET pollUrl — receive Engine.IO open packet (0{...}) or message packets',
      'POST pollUrl with Engine.IO-encoded packets — send connect/event frames',
      'repeat GET — long-poll waits for the next server packets',
    ],
    method: 'GET',
    headers: { Accept: '*/*', 'Content-Type': 'text/plain;charset=UTF-8' },
    notes:
      'Force polling by using transport=polling only; compare auth enforcement on ' +
      'the polling endpoint against the WebSocket upgrade path on the same target.',
  };
}

/**
 * Idea 01047 — compare polling-endpoint auth behavior against the upgrade
 * path from operator-supplied observations.
 * @param {{pollingStatus: number, pollingBody?: string, upgradeStatus: number}} observed
 * @returns {{divergent: boolean, summary: string, findings: object[]}}
 */
export function analyzePollingAuth(observed = {}) {
  const { pollingStatus = 0, pollingBody = '', upgradeStatus = 0 } = observed;
  const p = Number(pollingStatus) || 0;
  const u = Number(upgradeStatus) || 0;
  const pollingOpen = p === 200 && /"sid"\s*:/.test(normalizeText(pollingBody));
  const divergent = pollingOpen && (u === 401 || u === 403 || u === 400);
  const findings = [];
  if (divergent) {
    findings.push(
      websocketReconFinding({
        title: 'polling transport accepted while WebSocket upgrade was rejected',
        kind: 'transport-auth-divergence',
        evidence: `polling HTTP ${p} issued a session id; upgrade returned HTTP ${u}`,
        confidence: 'high',
      }),
    );
  }
  return {
    divergent,
    summary: pollingOpen
      ? `polling endpoint issued a session (HTTP ${p}); upgrade path returned HTTP ${u}`
      : `polling endpoint did not yield a session (HTTP ${p}); upgrade path returned HTTP ${u}`,
    findings,
  };
}

/**
 * Idea 01048 — candidate Rails ActionCable channel subscribe payloads.
 * Channels frequently skip authorization at subscribe time.
 * @returns {{channel: string, payload: object, notes: string}[]}
 */
export function actionCableChannels() {
  const channels = [
    'ChatChannel', 'RoomChannel', 'NotificationsChannel', 'MessagesChannel',
    'CommentsChannel', 'PresenceChannel', 'ActivityChannel', 'FeedChannel',
    'UpdatesChannel', 'AlertsChannel', 'AdminChannel', 'SupportChannel',
    'UserChannel', 'TeamChannel', 'ProjectChannel', 'DocumentChannel',
    'GameChannel', 'LobbyChannel', 'MatchChannel', 'TournamentChannel',
    'OrdersChannel', 'PaymentsChannel', 'ShippingChannel', 'InventoryChannel',
    'ReportsChannel', 'AnalyticsChannel', 'MetricsChannel', 'LogsChannel',
  ];
  return channels.map(channel => ({
    channel,
    payload: { command: 'subscribe', identifier: JSON.stringify({ channel }) },
    notes: 'benign subscribe command; operator watches for confirm vs reject frames',
  }));
}

/**
 * Idea 01048 — analyze an ActionCable server frame after a subscribe
 * attempt. confirm_subscription means the channel accepted the subscriber;
 * reject_subscription means it refused.
 * @param {string} channel - Channel that was subscribed to.
 * @param {string} frameText - Raw JSON frame text from the server.
 * @returns {{channel: string, state: 'confirmed'|'rejected'|'welcome'|'ping'|'unknown', findings: object[]}}
 */
export function analyzeActionCableFrame(channel, frameText = '') {
  const text = normalizeText(frameText).trim();
  let state = 'unknown';
  const parsed = tryParseJson(frameText);
  if (parsed && typeof parsed === 'object') {
    if (parsed.type === 'confirm_subscription') state = 'confirmed';
    else if (parsed.type === 'reject_subscription') state = 'rejected';
    else if (parsed.type === 'welcome') state = 'welcome';
    else if (parsed.type === 'ping') state = 'ping';
  }

  const findings = [];
  if (state === 'confirmed') {
    findings.push(
      websocketReconFinding({
        title: `ActionCable channel ${channel} confirmed subscription`,
        kind: 'channel-subscribed',
        evidence: `frame: ${text.slice(0, 160)}`,
        targets: [String(channel)],
        confidence: 'high',
      }),
    );
  }
  return { channel: String(channel), state, findings };
}

/**
 * Idea 01049 — canonical SignalR negotiation descriptors plus common hub
 * method invocation payload templates with benign empty arguments.
 * @returns {{negotiatePaths: {path: string, params: object}[], hubMethods: {hub: string, method: string, args: any[], payload: object}[]}}
 */
export function signalRHubProbes() {
  const negotiatePaths = [
    { path: '/negotiate', params: { negotiateVersion: 1 } },
    { path: '/hub/negotiate', params: { negotiateVersion: 1 } },
    { path: '/signalr/negotiate', params: { negotiateVersion: 1 } },
    { path: '/chathub/negotiate', params: { negotiateVersion: 1 } },
    { path: '/api/hub/negotiate', params: { negotiateVersion: 1 } },
  ];
  const methods = [
    ['ChatHub', 'SendMessage'], ['ChatHub', 'JoinRoom'], ['ChatHub', 'LeaveRoom'],
    ['ChatHub', 'GetHistory'], ['NotificationHub', 'Subscribe'], ['NotificationHub', 'Unsubscribe'],
    ['Hub', 'Echo'], ['Hub', 'Ping'], ['Hub', 'GetStatus'], ['Hub', 'GetUsers'],
    ['Hub', 'Broadcast'], ['Hub', 'Send'], ['Hub', 'Receive'], ['Hub', 'Invoke'],
    ['DataHub', 'Query'], ['DataHub', 'Get'], ['DataHub', 'List'],
    ['AdminHub', 'GetStats'], ['AdminHub', 'GetConfig'],
  ];
  const hubMethods = methods.map(([hub, method], i) => ({
    hub,
    method,
    args: [],
    payload: {
      type: 1, // Invocation message type
      invocationId: `probe-${i}`,
      target: method,
      arguments: [],
    },
  }));
  return { negotiatePaths, hubMethods };
}

/**
 * Idea 01049 — analyze a SignalR hub invocation reply. A completion with
 * a result means the method executed; "unknown hub"/"unknown method" text
 * means it does not exist; auth errors mean it exists but is guarded.
 * @param {string} hub - Hub name invoked.
 * @param {string} method - Method name invoked.
 * @param {string} replyText - Raw SignalR JSON reply text.
 * @returns {{hub: string, method: string, state: 'executed'|'auth-guarded'|'unknown-method'|'unknown-hub'|'unknown', resultPreview: string|null, findings: object[]}}
 */
export function analyzeHubReply(hub, method, replyText = '') {
  const text = normalizeText(replyText).trim();
  let state = 'unknown';
  let resultPreview = null;
  // SignalR frames may be concatenated with the record separator.
  const parsed = tryParseJson(text.split('\x1e')[0]);
  if (parsed && typeof parsed === 'object') {
    if (parsed.type === 3) {
      // Completion message.
      if (parsed.error) {
        const err = String(parsed.error).toLowerCase();
        if (/unknown hub/.test(err)) state = 'unknown-hub';
        else if (/unknown|no method|does not contain/.test(err)) state = 'unknown-method';
        else if (/unauthor|forbidden|denied|not allowed/.test(err)) state = 'auth-guarded';
        else state = 'unknown-method';
      } else {
        state = 'executed';
        resultPreview = parsed.result !== undefined ? JSON.stringify(parsed.result).slice(0, 160) : '(no result)';
      }
    }
  } else if (/unknown hub/i.test(text)) {
    state = 'unknown-hub';
  } else if (/unauthor|forbidden/i.test(text)) {
    state = 'auth-guarded';
  }

  const findings = [];
  if (state === 'executed') {
    findings.push(
      websocketReconFinding({
        title: `SignalR hub method ${hub}.${method} executed`,
        kind: 'hub-method-callable',
        evidence: `completion frame result: ${resultPreview}`,
        targets: [`${hub}.${method}`],
        confidence: 'high',
      }),
    );
  } else if (state === 'auth-guarded') {
    findings.push(
      websocketReconFinding({
        title: `SignalR hub method ${hub}.${method} exists but is auth-guarded`,
        kind: 'hub-method-guarded',
        evidence: `completion error: ${text.slice(0, 160)}`,
        targets: [`${hub}.${method}`],
        confidence: 'medium',
      }),
    );
  }
  return { hub: String(hub), method: String(method), state, resultPreview, findings };
}

/**
 * Idea 01050 — parse a SignalR /negotiate JSON body for connectionToken,
 * connectionId, availableTransports and negotiateVersion. The token's
 * length and character set reveal session binding strength: short,
 * low-entropy tokens are easier to guess or replay.
 * @param {string} negotiateBody - Raw /negotiate response body.
 * @returns {{connectionId: string|null, connectionToken: string|null, tokenLength: number, tokenEntropyBits: number, tokenStrength: 'weak'|'medium'|'strong'|'absent', availableTransports: string[], negotiateVersion: number|null, findings: object[]}}
 */
export function analyzeNegotiateResponse(negotiateBody = '') {
  const text = normalizeText(negotiateBody).trim();
  const parsed = tryParseJson(negotiateBody);
  const data = parsed && typeof parsed === 'object' ? parsed : {};
  const connectionId = typeof data.connectionId === 'string' ? data.connectionId : null;
  const connectionToken = typeof data.connectionToken === 'string' ? data.connectionToken : null;
  const negotiateVersion = typeof data.negotiateVersion === 'number' ? data.negotiateVersion : null;
  const availableTransports = Array.isArray(data.availableTransports)
    ? data.availableTransports.map(t => (t && t.transport) || String(t)).filter(Boolean)
    : [];

  const tokenLength = connectionToken ? connectionToken.length : 0;
  // Estimate entropy: distinct charset size ^ length, expressed in bits.
  let charset = 0;
  if (connectionToken) {
    if (/[a-z]/.test(connectionToken)) charset += 26;
    if (/[A-Z]/.test(connectionToken)) charset += 26;
    if (/[0-9]/.test(connectionToken)) charset += 10;
    if (/[^a-zA-Z0-9]/.test(connectionToken)) charset += 16;
  }
  const tokenEntropyBits = connectionToken && charset > 0
    ? Math.round(tokenLength * Math.log2(charset))
    : 0;
  let tokenStrength = 'absent';
  if (connectionToken) {
    if (tokenEntropyBits < 64) tokenStrength = 'weak';
    else if (tokenEntropyBits < 128) tokenStrength = 'medium';
    else tokenStrength = 'strong';
  }

  const findings = [];
  if (tokenStrength === 'weak') {
    findings.push(
      websocketReconFinding({
        title: 'SignalR connectionToken has low entropy',
        kind: 'weak-session-token',
        evidence: `token length ${tokenLength}, estimated entropy ~${tokenEntropyBits} bits`,
        confidence: 'medium',
      }),
    );
  }
  if (parsed && !connectionToken) {
    findings.push(
      websocketReconFinding({
        title: '/negotiate response lacks a connectionToken',
        kind: 'missing-session-token',
        evidence: `parsed keys: ${Object.keys(data).join(', ') || '(none)'}`,
        confidence: 'medium',
      }),
    );
  }
  return {
    connectionId,
    connectionToken,
    tokenLength,
    tokenEntropyBits,
    tokenStrength,
    availableTransports,
    negotiateVersion,
    findings,
  };
}

/**
 * Build a uniform report finding from a WebSocket recon result.
 * @param {{title?: string, kind?: string, evidence?: string, targets?: string[], confidence?: string}} result
 * @returns {{title: string, severity: string, confidence: string, kind: string, evidence: string, targets: string[], recommendation: string}}
 */
export function websocketReconFinding(result = {}) {
  const {
    title = 'WebSocket recon finding',
    kind = 'recon',
    evidence = '',
    targets = [],
    confidence = 'medium',
  } = result;
  return {
    title: `WebSocket recon — ${title}`,
    severity: 'Info',
    confidence,
    kind,
    evidence,
    targets: Array.isArray(targets) ? targets : [],
    recommendation:
      'Review the flagged realtime surface on the authorized target: enforce an exact Origin allow-list on ' +
      'upgrades, keep credentials out of WebSocket URLs (use subprotocol headers or post-connect auth), disable ' +
      'deprecated subprotocols, authorize every namespace/channel/hub method on connect, and make sure long-polling ' +
      'fallbacks enforce the same auth as the upgrade path.',
  };
}

/**
 * Named-const registry for deterministic access, mirroring house style.
 */
export const WEBSOCKET_CORE = {
  handshakeFuzzVariants,
  analyzeHandshakeResponse,
  detectTokenInUrl,
  subprotocolProbeList,
  analyzeSubprotocolResponse,
  websocketPathCandidates,
  analyzePathProbe,
  socketIoNamespaces,
  analyzeNamespaceReply,
  socketIoEventNames,
  analyzeEventReply,
  pollingFallbackDescriptor,
  analyzePollingAuth,
  actionCableChannels,
  analyzeActionCableFrame,
  signalRHubProbes,
  analyzeHubReply,
  analyzeNegotiateResponse,
  websocketReconFinding,
};

export default WEBSOCKET_CORE;
