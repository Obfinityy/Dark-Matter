/**
 * websocketProtocolRecon.js — WebSocket protocol-surface recon probe builder
 * and response analyzer.
 *
 * Idea 01051: STOMP-over-WebSocket topic sweep — build SUBSCRIBE frame
 * templates for wildcard and guessed destinations so the operator can test
 * whether the broker lets a client subscribe to other users' queues; parse
 * returned frames for MESSAGE arrivals on those destinations.
 *
 * Idea 01052: MQTT-over-WebSocket topic brute force — build a candidate
 * topic list (guessed names plus # and + wildcards) for SUBSCRIBE packets;
 * analyze subscription results for broad ACL grants.
 *
 * Idea 01053: SockJS info endpoint probe — canonical /info path candidates
 * per SockJS prefix; analyze the JSON info response for websocket support,
 * origins, entropy and cookie settings disclosures.
 *
 * Idea 01054: WebSocket message-schema inference — record request/response
 * frame pairs as shape descriptors, cluster them into message-type
 * hypotheses, and expose undocumented message types the operator observed.
 *
 * Idea 01055: WebSocket binary-frame handling test — build frame mutation
 * specs that send binary and text frames interchangeably (opcode flips,
 * same payload in both opcodes) so the operator can spot deserialization
 * gaps in mixed-frame parsers; analyze close/error frames as evidence.
 *
 * Idea 01056: WebSocket compression abuse check — build
 * permessage-deflate negotiation descriptors and compressible-payload
 * specs; analyze operator-observed per-connection memory growth as a
 * compression-amplification signal.
 *
 * Idea 01057: WebSocket max-frame-size probe — build a geometric series of
 * frame-size probe specs; analyze the operator's truncation/close/error
 * observations to locate parser limits and truncation points.
 *
 * Idea 01058: WebSocket ping/pong behavior map — build keepalive probe
 * descriptors and analyze operator-supplied ping/pong event logs to map
 * idle timeouts, pong requirements and disconnect policies.
 *
 * Idea 01059: WebSocket reconnection-token analysis — capture resume tokens
 * across reconnects and score predictability with real math: character-set
 * size, Shannon entropy per token, entropy across the token set, and
 * sequential-pattern detection (numeric/hex/alphanumeric counters). A low
 * entropy or sequential token stream lets an attacker predict resume
 * tokens and take over sessions.
 *
 * Idea 01060: WebSocket message-ordering assumption test — build
 * out-of-order dependent-message sequence specs and analyze the
 * operator-supplied application-state outcomes to detect servers that
 * assume in-order delivery.
 *
 * No network calls: every function operates on operator-supplied strings,
 * frame logs, bodies and token lists. The agent's network layer performs
 * the actual transport; this module constructs probe descriptors for the
 * operator to send and analyzes the returned data for protocol-surface
 * leaks. Defensive surface mapping of the engagement's own authorized
 * target only.
 */

/**
 * Shared confidence tiers.
 */
const CONFIDENCE = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
};

/**
 * Escape a STOMP header value per the STOMP 1.2 escaping rules
 * (backslash, carriage return, newline, colon).
 * @param {string} value
 * @returns {string}
 */
export function escapeStompHeader(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/:/g, '\\c');
}

/**
 * Idea 01051 — build STOMP SUBSCRIBE frame templates for wildcard and
 * guessed destinations. The returned frames are ready for the operator's
 * transport layer to send over an established STOMP WebSocket session.
 * @param {string[]} guessedDestinations - Operator-guessed destinations (e.g. "/topic/news", "/queue/user-123").
 * @param {{ackMode?: string, idPrefix?: string, includeWildcards?: boolean}} [options]
 * @returns {{label: string, destination: string, frame: string, wildcard: boolean}[]}
 */
export function stompSubscribeProbes(guessedDestinations = [], options = {}) {
  const { ackMode = 'auto', idPrefix = 'wsrecon', includeWildcards = true } = options;
  const wildcards = includeWildcards
    ? ['/topic/#', '/topic/*', '/queue/#', '/queue/*', '/exchange/*', '/amq/queue/*', '/*', '/#']
    : [];
  const seen = new Set();
  const destinations = [];
  for (const d of [...wildcards, ...(guessedDestinations || [])]) {
    const dest = String(d || '').trim();
    if (!dest || seen.has(dest)) continue;
    seen.add(dest);
    destinations.push({ destination: dest, wildcard: wildcards.includes(dest) });
  }
  return destinations.map(({ destination, wildcard }, i) => ({
    label: `stomp-subscribe:${destination}`,
    destination,
    wildcard,
    frame:
      `SUBSCRIBE\n` +
      `id:${escapeStompHeader(`${idPrefix}-${i}`)}\n` +
      `destination:${escapeStompHeader(destination)}\n` +
      `ack:${ackMode}\n` +
      `\n` +
      `\x00`,
  }));
}

/**
 * Idea 01051 — analyze operator-supplied STOMP frames received after the
 * wildcard/guess subscriptions. MESSAGE frames arriving on destinations
 * the client did not originate indicate cross-user visibility.
 * @param {{sent: {label: string, destination: string}[], received: string[]} | {received: string[]}} log
 * @returns {{type: string, confidence: string, evidence: string}[]}
 */
export function analyzeStompSubscribeResponses(log = {}) {
  const findings = [];
  const sent = Array.isArray(log.sent) ? log.sent : [];
  const received = Array.isArray(log.received) ? log.received : [];
  const subscribed = new Set(sent.map(s => s.destination));
  let messageCount = 0;
  let errorCount = 0;
  const foreignDestinations = new Set();

  for (const raw of received) {
    const frame = String(raw || '');
    const command = frame.split('\n', 1)[0].trim().toUpperCase();
    if (command === 'MESSAGE') {
      messageCount += 1;
      const destMatch = frame.match(/^destination:(.+)$/m);
      if (destMatch) {
        const dest = destMatch[1].trim();
        if (!subscribed.has(dest)) foreignDestinations.add(dest);
      }
    } else if (command === 'ERROR') {
      errorCount += 1;
    } else if (command === 'RECEIPT') {
      // Subscription acknowledged without error — keep as neutral signal.
    }
  }

  if (messageCount > 0 && sent.length > 0) {
    findings.push({
      type: 'stomp-subscribe-accepted',
      confidence: CONFIDENCE.MEDIUM,
      evidence: `Broker accepted wildcard/guess subscriptions and delivered ${messageCount} MESSAGE frame(s) for ${sent.length} probe destination(s).`,
    });
  }
  if (foreignDestinations.size > 0) {
    findings.push({
      type: 'stomp-cross-destination-messages',
      confidence: CONFIDENCE.HIGH,
      evidence: `Received MESSAGE frames for destination(s) never subscribed to in this session: ${[...foreignDestinations].join(', ')}. Possible broker-side routing leak.`,
    });
  }
  if (errorCount > 0 && messageCount === 0) {
    findings.push({
      type: 'stomp-subscribe-rejected',
      confidence: CONFIDENCE.LOW,
      evidence: `${errorCount} ERROR frame(s) received and no MESSAGE frames — broker appears to reject the probe subscriptions.`,
    });
  }
  return findings;
}

/**
 * Idea 01052 — build an MQTT topic candidate list for SUBSCRIBE packets:
 * operator seed topics plus multi-level (#) and single-level (+)
 * wildcard expansions at each topic level.
 * @param {string[]} seedTopics - Operator-guessed topics (e.g. "devices/123/status").
 * @param {{maxWildcards?: number}} [options]
 * @returns {{label: string, topic: string, wildcard: boolean, wildcardType: 'multi'|'single'|null}[]}
 */
export function mqttTopicCandidates(seedTopics = [], options = {}) {
  const { maxWildcards = 50 } = options;
  const candidates = [];
  const seen = new Set();
  const add = (topic, wildcardType) => {
    const t = String(topic);
    if (!t || seen.has(t)) return;
    seen.add(t);
    candidates.push({
      label: `mqtt-topic:${t}`,
      topic: t,
      wildcard: wildcardType !== null,
      wildcardType,
    });
  };

  add('#', 'multi');
  add('+', 'single');

  for (const seed of seedTopics || []) {
    const s = String(seed || '').trim().replace(/^\/+|\/+$/g, '');
    if (!s) continue;
    add(s, null);
    const levels = s.split('/');
    // Multi-level wildcard at each level.
    for (let i = 0; i < levels.length && candidates.length < maxWildcards; i += 1) {
      add(`${levels.slice(0, i).join('/')}${i > 0 ? '/' : ''}#`, 'multi');
    }
    // Single-level wildcard substitutions (one level at a time).
    for (let i = 0; i < levels.length && candidates.length < maxWildcards; i += 1) {
      const copy = [...levels];
      copy[i] = '+';
      add(copy.join('/'), 'single');
    }
    // Catch-all below the seed.
    if (candidates.length < maxWildcards) add(`${s}/#`, 'multi');
  }
  return candidates;
}

/**
 * Idea 01052 — analyze operator-supplied SUBSCRIBE results. Subacks that
 * grant broad wildcards indicate misconfigured MQTT ACLs.
 * @param {{topic: string, granted: boolean, grantedQos?: number|null, wildcardType: 'multi'|'single'|null}[]} results
 * @returns {{type: string, confidence: string, evidence: string}[]}
 */
export function analyzeMqttSubscribeResults(results = []) {
  const findings = [];
  const granted = (results || []).filter(r => r && r.granted === true);
  const grantedWild = granted.filter(r => r.wildcardType);
  const grantedMulti = grantedWild.filter(r => r.wildcardType === 'multi');
  const grantedSingle = grantedWild.filter(r => r.wildcardType === 'single');

  if (grantedMulti.length > 0) {
    findings.push({
      type: 'mqtt-broad-multilevel-subscribe',
      confidence: CONFIDENCE.HIGH,
      evidence: `Broker granted multi-level (#) subscriptions for: ${grantedMulti.map(r => r.topic).join(', ')} — ACLs likely allow full topic-tree visibility.`,
    });
  }
  if (grantedSingle.length > 0 && grantedMulti.length === 0) {
    findings.push({
      type: 'mqtt-single-level-subscribe',
      confidence: CONFIDENCE.MEDIUM,
      evidence: `Broker granted single-level (+) subscriptions for: ${grantedSingle.map(r => r.topic).join(', ')} — per-level enumeration may be possible.`,
    });
  }
  if (granted.length === 0 && (results || []).length > 0) {
    findings.push({
      type: 'mqtt-subscribe-denied',
      confidence: CONFIDENCE.LOW,
      evidence: `All ${results.length} probe subscriptions were denied (no granted QoS) — ACLs appear restrictive.`,
    });
  }
  return findings;
}

/**
 * Idea 01053 — canonical SockJS /info path candidates per prefix.
 * @param {string[]} prefixes - SockJS mount prefixes (e.g. "/sockjs", "/ws").
 * @returns {string[]}
 */
export function sockjsInfoPathCandidates(prefixes = ['/sockjs', '/ws', '/stomp', '/socket']) {
  const paths = [];
  for (const prefix of prefixes || []) {
    const p = String(prefix || '').trim().replace(/\/+$/, '');
    if (!p) continue;
    paths.push(`${p}/info`);
  }
  return paths;
}

/**
 * Idea 01053 — analyze a SockJS /info JSON body for disclosures.
 * @param {string} infoBody - Raw response body of the /info request.
 * @returns {{type: string, confidence: string, evidence: string}[]}
 */
export function analyzeSockjsInfo(infoBody = '') {
  const findings = [];
  let parsed = null;
  try {
    parsed = JSON.parse(String(infoBody || ''));
  } catch {
    return findings; // Not a SockJS info endpoint — no finding.
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return findings;

  if (parsed.websocket === true) {
    findings.push({
      type: 'sockjs-websocket-enabled',
      confidence: CONFIDENCE.MEDIUM,
      evidence: 'SockJS info response reports websocket:true — raw WebSocket transport is available alongside fallbacks.',
    });
  } else if (parsed.websocket === false) {
    findings.push({
      type: 'sockjs-websocket-disabled',
      confidence: CONFIDENCE.LOW,
      evidence: 'SockJS info response reports websocket:false — only fallback transports are offered.',
    });
  }
  if (Array.isArray(parsed.origins) && parsed.origins.length > 0) {
    const permissive = parsed.origins.includes('*:*') || parsed.origins.includes('*');
    findings.push({
      type: permissive ? 'sockjs-permissive-origins' : 'sockjs-origins-disclosed',
      confidence: permissive ? CONFIDENCE.HIGH : CONFIDENCE.MEDIUM,
      evidence: `SockJS info discloses allowed origins: ${parsed.origins.join(', ')}.`,
    });
  }
  if (typeof parsed.entropy === 'number') {
    findings.push({
      type: 'sockjs-entropy-disclosed',
      confidence: parsed.entropy < 24 ? CONFIDENCE.MEDIUM : CONFIDENCE.LOW,
      evidence: `SockJS info discloses entropy=${parsed.entropy} bits — session/token identifier strength is visible to attackers.`,
    });
  }
  if (parsed.cookie_needed === true) {
    findings.push({
      type: 'sockjs-cookie-required',
      confidence: CONFIDENCE.LOW,
      evidence: 'SockJS info reports cookie_needed:true — sticky-session behavior is advertised.',
    });
  }
  return findings;
}

/**
 * Reduce a single frame payload to a structural shape descriptor.
 * Objects collapse to sorted key lists; arrays collapse to element shapes
 * (capped); scalars collapse to type names. JSON parse failures keep the
 * raw string signature (length bucket + prefix).
 * @param {string} payload
 * @returns {object}
 */
function payloadShape(payload) {
  const text = String(payload || '');
  try {
    const value = JSON.parse(text);
    const shapeOf = (v, depth) => {
      if (v === null) return 'null';
      if (Array.isArray(v)) {
        if (depth > 2 || v.length === 0) return 'array';
        return `array<${[...new Set(v.slice(0, 4).map(e => shapeOf(e, depth + 1)))].join('|')}>`;
      }
      if (typeof v === 'object') {
        return `object{${Object.keys(v).sort().join(',')}}`;
      }
      return typeof v;
    };
    return { kind: 'json', shape: shapeOf(value, 0) };
  } catch {
    const bucket = text.length === 0 ? 0 : Math.ceil(text.length / 64);
    return { kind: 'text', shape: `text[len~${bucket * 64}]:${text.slice(0, 24)}` };
  }
}

/**
 * Idea 01054 — cluster observed request/response frame pairs into
 * message-type hypotheses by structural shape.
 * @param {{request: string, response: string}[]} framePairs - Operator-recorded frame pairs.
 * @returns {{clusters: {shape: string, requestShape: string, responseShape: string, count: number, samples: string[]}[], totalPairs: number, undocumentedTypes: number}}
 */
export function clusterFrameShapes(framePairs = []) {
  const clusters = new Map();
  for (const pair of framePairs || []) {
    if (!pair || typeof pair !== 'object') continue;
    const reqShape = payloadShape(pair.request);
    const resShape = payloadShape(pair.response);
    const key = `req:${reqShape.kind}:${reqShape.shape} <=> res:${resShape.kind}:${resShape.shape}`;
    if (!clusters.has(key)) {
      clusters.set(key, {
        shape: key,
        requestShape: reqShape.shape,
        responseShape: resShape.shape,
        count: 0,
        samples: [],
      });
    }
    const cluster = clusters.get(key);
    cluster.count += 1;
    if (cluster.samples.length < 3) cluster.samples.push(String(pair.request).slice(0, 120));
  }
  const list = [...clusters.values()].sort((a, b) => b.count - a.count);
  // The dominant (most frequent) cluster is the baseline message type;
  // rarer clusters are candidates for undocumented message types worth
  // operator review.
  let undocumented = 0;
  for (const [index, c] of list.entries()) {
    c.likelyUndocumented = index > 0 && list.length > 1;
    if (c.likelyUndocumented) undocumented += 1;
  }
  return {
    clusters: list,
    totalPairs: (framePairs || []).length,
    undocumentedTypes: undocumented,
  };
}

/**
 * Idea 01055 — build frame mutation specs that send the same payload as
 * text and binary frames (opcode flips) plus malformed binary prefixes.
 * @param {string[]} payloads - Operator-supplied benign payload strings.
 * @param {{includeEmptyBinary?: boolean}} [options]
 * @returns {{label: string, opcode: 1|2, payload: string, description: string}[]}
 */
export function binaryFrameMutationSpecs(payloads = [], options = {}) {
  const { includeEmptyBinary = true } = options;
  const specs = [];
  for (const payload of payloads || []) {
    const text = String(payload ?? '');
    specs.push({
      label: 'frame-mutation:text',
      opcode: 1,
      payload: text,
      description: 'Send payload as a text frame (opcode 0x1) — baseline.',
    });
    specs.push({
      label: 'frame-mutation:binary-same-bytes',
      opcode: 2,
      payload: text,
      description: 'Send the identical UTF-8 bytes as a binary frame (opcode 0x2) — parser must not treat it as text.',
    });
  }
  if (includeEmptyBinary) {
    specs.push({
      label: 'frame-mutation:empty-binary',
      opcode: 2,
      payload: '',
      description: 'Send an empty binary frame — parsers must handle zero-length binary payloads.',
    });
  }
  return specs;
}

/**
 * Idea 01055 — analyze operator-supplied outcomes of the binary/text
 * mutation probes for deserialization gaps.
 * @param {{label: string, outcome: 'echoed'|'error'|'close'|'timeout'|'unexpected', detail?: string}[]} results
 * @returns {{type: string, confidence: string, evidence: string}[]}
 */
export function analyzeBinaryFrameResponses(results = []) {
  const findings = [];
  const byLabel = new Map();
  for (const r of results || []) {
    if (r && r.label) byLabel.set(r.label, r);
  }
  const binarySame = byLabel.get('frame-mutation:binary-same-bytes');
  const textBase = byLabel.get('frame-mutation:text');

  if (binarySame && textBase && binarySame.outcome === 'echoed' && textBase.outcome === 'echoed') {
    findings.push({
      type: 'binary-frame-parsed-as-text',
      confidence: CONFIDENCE.MEDIUM,
      evidence: 'Identical bytes echoed for both text and binary opcodes — the server may decode binary frames as UTF-8 text, a mixed-frame deserialization gap.',
    });
  }
  if (binarySame && binarySame.outcome === 'close') {
    findings.push({
      type: 'binary-frame-connection-close',
      confidence: CONFIDENCE.MEDIUM,
      evidence: `Server closed the connection on a binary frame (${binarySame.detail || 'no detail'}) — abrupt close on unexpected opcodes can desync proxies.`,
    });
  }
  if (binarySame && binarySame.outcome === 'unexpected') {
    findings.push({
      type: 'binary-frame-unexpected-response',
      confidence: CONFIDENCE.MEDIUM,
      evidence: `Server returned an unexpected response to a binary frame (${binarySame.detail || 'no detail'}) — review mixed-frame handling.`,
    });
  }
  const emptyBinary = byLabel.get('frame-mutation:empty-binary');
  if (emptyBinary && emptyBinary.outcome === 'close') {
    findings.push({
      type: 'empty-binary-frame-close',
      confidence: CONFIDENCE.LOW,
      evidence: 'Server closed the connection on an empty binary frame — zero-length frame handling differs from text.',
    });
  }
  if (findings.length === 0 && results.length > 0) {
    findings.push({
      type: 'binary-frame-consistent',
      confidence: CONFIDENCE.LOW,
      evidence: 'Text and binary mutations produced consistent, non-anomalous outcomes — no deserialization gap observed.',
    });
  }
  return findings;
}

/**
 * Idea 01056 — build permessage-deflate negotiation descriptors plus
 * highly compressible payload specs (repeated patterns) for the operator
 * to send and measure per-connection memory against.
 * @param {{repeatUnits?: number, patterns?: string[]}} [options]
 * @returns {{negotiation: {extension: string, params: object}, payloads: {label: string, payload: string, approxBytes: number}[]}}
 */
export function permessageDeflateDescriptors(options = {}) {
  const { repeatUnits = 2000, patterns = ['A', 'AB', '0123456789'] } = options;
  const units = Math.max(100, Math.min(100000, Math.floor(Number(repeatUnits) || 2000)));
  const payloads = (patterns || ['A']).map((pattern, i) => {
    const p = String(pattern || 'A');
    const payload = p.repeat(Math.max(1, Math.floor(units / p.length)));
    return {
      label: `compressible-payload:${p.slice(0, 16)}`,
      payload,
      approxBytes: Buffer.byteLength(payload, 'utf8'),
    };
  });
  return {
    negotiation: {
      extension: 'permessage-deflate',
      params: {
        client_max_window_bits: 15,
        server_max_window_bits: 15,
        client_no_context_takeover: false,
        server_no_context_takeover: false,
      },
      note: 'Offer permessage-deflate; the operator records the server response header and per-connection memory before/after sending compressible payloads.',
    },
    payloads,
  };
}

/**
 * Idea 01056 — analyze operator-observed compression behavior for
 * amplification signals.
 * @param {{deflateAccepted: boolean, memoryBeforeBytes: number, memoryAfterBytes: number, payloadBytes: number, connectionCount: number}} observation
 * @returns {{type: string, confidence: string, evidence: string}[]}
 */
export function analyzeCompressionBehavior(observation = {}) {
  const findings = [];
  const {
    deflateAccepted = false,
    memoryBeforeBytes = 0,
    memoryAfterBytes = 0,
    payloadBytes = 0,
    connectionCount = 0,
  } = observation;

  if (!deflateAccepted) {
    findings.push({
      type: 'permessage-deflate-rejected',
      confidence: CONFIDENCE.LOW,
      evidence: 'Server did not accept permessage-deflate — no compression amplification surface via this extension.',
    });
    return findings;
  }
  findings.push({
    type: 'permessage-deflate-accepted',
    confidence: CONFIDENCE.MEDIUM,
    evidence: 'Server accepted permessage-deflate — compression is active on the connection; proceed to memory-growth measurement.',
  });

  const delta = memoryAfterBytes - memoryBeforeBytes;
  const conns = Math.max(1, connectionCount);
  const bytesPerConn = delta / conns;
  if (payloadBytes > 0 && bytesPerConn > payloadBytes * 2) {
    findings.push({
      type: 'compression-memory-amplification',
      confidence: CONFIDENCE.HIGH,
      evidence: `Per-connection memory grew by ~${Math.round(bytesPerConn)} bytes for a ${payloadBytes}-byte compressible payload (amplification factor ${(bytesPerConn / payloadBytes).toFixed(1)}x) — compression may amplify per-connection memory usage.`,
    });
  } else if (delta > 0) {
    findings.push({
      type: 'compression-memory-growth',
      confidence: CONFIDENCE.LOW,
      evidence: `Per-connection memory grew by ~${Math.round(bytesPerConn)} bytes — within the payload size; no amplification observed.`,
    });
  }
  return findings;
}

/**
 * Idea 01057 — build a geometric series of max-frame-size probe specs.
 * @param {{startBytes?: number, factor?: number, steps?: number, capBytes?: number}} [options]
 * @returns {{label: string, frameBytes: number, payload: string}[]}
 */
export function maxFrameSizeProbeSpecs(options = {}) {
  const {
    startBytes = 1024,
    factor = 2,
    steps = 10,
    capBytes = 16 * 1024 * 1024,
  } = options;
  const specs = [];
  let size = Math.max(1, Math.floor(Number(startBytes) || 1024));
  const f = Math.max(1.1, Number(factor) || 2);
  const n = Math.max(1, Math.min(20, Math.floor(Number(steps) || 10)));
  const cap = Math.max(size, Math.floor(Number(capBytes) || 16 * 1024 * 1024));
  for (let i = 0; i < n && size <= cap; i += 1) {
    specs.push({
      label: `frame-size:${size}`,
      frameBytes: size,
      payload: 'F'.repeat(size),
    });
    size = Math.floor(size * f);
  }
  return specs;
}

/**
 * Idea 01057 — analyze operator-supplied outcomes of the growing-frame
 * probes to locate truncation points and parser limits.
 * @param {{frameBytes: number, outcome: 'ok'|'truncated'|'error'|'close', receivedBytes?: number}[]} results
 * @returns {{type: string, confidence: string, evidence: string}[]}
 */
export function analyzeFrameSizeResponses(results = []) {
  const findings = [];
  const rows = (results || [])
    .filter(r => r && Number.isFinite(r.frameBytes))
    .sort((a, b) => a.frameBytes - b.frameBytes);
  if (rows.length === 0) return findings;

  const firstBad = rows.find(r => r.outcome !== 'ok');
  const lastOk = [...rows].reverse().find(r => r.outcome === 'ok');

  if (firstBad && firstBad.outcome === 'truncated') {
    findings.push({
      type: 'frame-truncation-point',
      confidence: CONFIDENCE.HIGH,
      evidence: `Frames truncate at ${firstBad.frameBytes} bytes (last clean frame: ${lastOk ? `${lastOk.frameBytes} bytes` : 'none observed'}; received ${firstBad.receivedBytes ?? 'unknown'} bytes) — oversized-frame handling reveals a parser limit.`,
    });
  } else if (firstBad && (firstBad.outcome === 'error' || firstBad.outcome === 'close')) {
    findings.push({
      type: 'frame-size-limit-enforced',
      confidence: CONFIDENCE.MEDIUM,
      evidence: `Server ${firstBad.outcome === 'close' ? 'closed the connection' : 'returned an error'} at ${firstBad.frameBytes} bytes (largest accepted: ${lastOk ? `${lastOk.frameBytes} bytes` : 'none observed'}).`,
    });
  } else if (!firstBad) {
    findings.push({
      type: 'frame-size-no-limit-observed',
      confidence: CONFIDENCE.LOW,
      evidence: `All probed sizes up to ${rows[rows.length - 1].frameBytes} bytes were accepted — no truncation point found in this range.`,
    });
  }
  return findings;
}

/**
 * Idea 01058 — build ping/pong keepalive probe descriptors: unanswered
 * pings at growing idle intervals to map timeouts, plus unsolicited pongs.
 * @param {{intervalsSec?: number[], payloadSize?: number}} [options]
 * @returns {{label: string, action: string, intervalSec: number|null, payload: string}[]}
 */
export function pingPongProbeSpecs(options = {}) {
  const { intervalsSec = [5, 15, 30, 60, 120, 300], payloadSize = 8 } = options;
  const size = Math.max(0, Math.min(125, Math.floor(Number(payloadSize) || 8)));
  const probes = (intervalsSec || []).map(sec => ({
    label: `keepalive-ping:${sec}s`,
    action: 'ping-then-idle',
    intervalSec: sec,
    payload: 'P'.repeat(size),
  }));
  probes.push({
    label: 'unsolicited-pong',
    action: 'pong-without-ping',
    intervalSec: null,
    payload: 'P'.repeat(size),
  });
  return probes;
}

/**
 * Idea 01058 — analyze an operator-supplied ping/pong event log to map
 * keepalive timeouts and pong requirements.
 * @param {{at: number, event: 'ping-sent'|'pong-received'|'ping-received'|'pong-sent'|'closed', note?: string}[]} events
 * @returns {{type: string, confidence: string, evidence: string}[]}
 */
export function analyzePingPongLog(events = []) {
  const findings = [];
  const rows = (events || []).filter(e => e && Number.isFinite(e.at)).sort((a, b) => a.at - b.at);
  if (rows.length === 0) return findings;

  const closures = rows.filter(e => e.event === 'closed');
  const pingsSent = rows.filter(e => e.event === 'ping-sent');
  const pongsReceived = rows.filter(e => e.event === 'pong-received');

  // Idle timeout estimate: largest gap before a close with no traffic.
  let maxIdleGap = 0;
  let timeoutEstimate = null;
  for (const close of closures) {
    const before = rows.filter(e => e.at < close.at && e.event !== 'closed');
    if (before.length > 0) {
      const gap = close.at - before[before.length - 1].at;
      if (gap > maxIdleGap) {
        maxIdleGap = gap;
        timeoutEstimate = gap;
      }
    }
  }
  if (timeoutEstimate !== null) {
    findings.push({
      type: 'idle-timeout-mapped',
      confidence: CONFIDENCE.MEDIUM,
      evidence: `Server closed an idle connection after ~${timeoutEstimate}s of inactivity — this bounds the window an unattended connection stays usable.`,
    });
  }

  const pongRatio = pingsSent.length > 0 ? pongsReceived.length / pingsSent.length : null;
  if (pongRatio !== null) {
    if (pongRatio >= 0.9) {
      findings.push({
        type: 'pong-reliable',
        confidence: CONFIDENCE.LOW,
        evidence: `Server answered ${pongsReceived.length}/${pingsSent.length} pings — keepalive is reliable; session survives long idle periods.`,
      });
    } else if (pongRatio < 0.5) {
      findings.push({
        type: 'pong-unreliable',
        confidence: CONFIDENCE.MEDIUM,
        evidence: `Server answered only ${pongsReceived.length}/${pingsSent.length} pings — keepalive is unreliable; connections may die silently.`,
      });
    }
  }

  const serverPings = rows.filter(e => e.event === 'ping-received');
  if (serverPings.length > 0 && rows.filter(e => e.event === 'pong-sent').length === 0 && closures.length > 0) {
    findings.push({
      type: 'pong-required-for-survival',
      confidence: CONFIDENCE.MEDIUM,
      evidence: `Server sent ${serverPings.length} ping(s) and closed the connection when no pong was returned — pong responses are required to keep the session alive.`,
    });
  }
  return findings;
}

/**
 * Shannon entropy of a string in bits per character.
 * @param {string} token
 * @returns {number}
 */
function shannonEntropyPerChar(token) {
  const text = String(token || '');
  if (text.length === 0) return 0;
  const freq = new Map();
  for (const ch of text) freq.set(ch, (freq.get(ch) || 0) + 1);
  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / text.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/**
 * Detect sequential patterns across a token list: decode each token in
 * base 10/16/36 and check whether successive values form an arithmetic
 * progression (counter), which makes tokens trivially predictable.
 * @param {string[]} tokens
 * @returns {{sequential: boolean, base: number|null, step: number|null, decoded: (number|null)[]}}
 */
function detectSequentialPattern(tokens) {
  const list = (tokens || []).map(t => String(t || '').trim()).filter(Boolean);
  if (list.length < 3) return { sequential: false, base: null, step: null, decoded: [] };
  for (const base of [10, 16, 36]) {
    const decoded = list.map(t => {
      try {
        const v = Number.parseInt(t, base);
        return Number.isSafeInteger(v) && v.toString(base).toLowerCase() === t.toLowerCase() ? v : null;
      } catch {
        return null;
      }
    });
    if (decoded.some(v => v === null)) continue;
    const steps = [];
    for (let i = 1; i < decoded.length; i += 1) steps.push(decoded[i] - decoded[i - 1]);
    const allEqual = steps.every(s => s === steps[0]);
    if (allEqual) {
      return { sequential: true, base, step: steps[0], decoded };
    }
  }
  return { sequential: false, base: null, step: null, decoded: [] };
}

/**
 * Idea 01059 — score reconnection/resume token predictability with real
 * math: per-token Shannon entropy, character-set size, cross-token
 * entropy, and sequential-counter detection.
 * @param {string[]} tokens - Resume tokens captured across reconnects, in capture order.
 * @returns {{tokenCount: number, charsetSize: number, avgEntropyBitsPerChar: number, totalEntropyBits: number, crossTokenEntropyBits: number, sequential: boolean, sequentialBase: number|null, sequentialStep: number|null, verdict: string, findings: {type: string, confidence: string, evidence: string}[]}}
 */
export function analyzeResumeTokens(tokens = []) {
  const list = (tokens || []).map(t => String(t ?? '')).filter(t => t.length > 0);
  const findings = [];
  if (list.length === 0) {
    return {
      tokenCount: 0,
      charsetSize: 0,
      avgEntropyBitsPerChar: 0,
      totalEntropyBits: 0,
      crossTokenEntropyBits: 0,
      sequential: false,
      sequentialBase: null,
      sequentialStep: null,
      verdict: 'no-tokens',
      findings: [],
    };
  }

  const charset = new Set(list.join(''));
  const charsetSize = charset.size;
  const perToken = list.map(shannonEntropyPerChar);
  const avgEntropyBitsPerChar = perToken.reduce((a, b) => a + b, 0) / perToken.length;
  const avgLen = list.reduce((a, t) => a + t.length, 0) / list.length;
  const totalEntropyBits = avgEntropyBitsPerChar * avgLen;
  // Cross-token entropy: treat concatenated tokens as one stream to catch
  // shared prefixes/salts that per-token entropy misses.
  const crossTokenEntropyBits = shannonEntropyPerChar(list.join('')) * avgLen;

  const seq = detectSequentialPattern(list);

  let verdict = 'strong';
  if (seq.sequential) {
    verdict = 'predictable-sequential';
    findings.push({
      type: 'resume-token-sequential',
      confidence: CONFIDENCE.HIGH,
      evidence: `Resume tokens form an arithmetic sequence in base ${seq.sequentialBase} with step ${seq.sequentialStep} — an attacker can predict the next resume token and take over reconnecting sessions.`,
    });
  } else if (charsetSize <= 16 && avgLen < 16) {
    verdict = 'weak-small-charset';
    findings.push({
      type: 'resume-token-low-entropy',
      confidence: CONFIDENCE.HIGH,
      evidence: `Tokens use a ${charsetSize}-character alphabet at ~${avgLen.toFixed(1)} chars (${totalEntropyBits.toFixed(1)} bits) — brute-forceable resume tokens.`,
    });
  } else if (totalEntropyBits < 64) {
    verdict = 'weak-low-entropy';
    findings.push({
      type: 'resume-token-low-entropy',
      confidence: CONFIDENCE.MEDIUM,
      evidence: `Tokens carry only ~${totalEntropyBits.toFixed(1)} bits of Shannon entropy — below the 64-bit bar for unguessable session tokens.`,
    });
  } else {
    findings.push({
      type: 'resume-token-strong',
      confidence: CONFIDENCE.LOW,
      evidence: `Tokens carry ~${totalEntropyBits.toFixed(1)} bits of Shannon entropy across a ${charsetSize}-character alphabet — no predictability signal.`,
    });
  }

  // Constant-token check: identical tokens across reconnects.
  if (new Set(list).size === 1 && list.length > 1) {
    verdict = 'predictable-constant';
    findings.push({
      type: 'resume-token-constant',
      confidence: CONFIDENCE.HIGH,
      evidence: 'The same resume token was issued on every reconnect — a static token is trivially replayable.',
    });
  }

  return {
    tokenCount: list.length,
    charsetSize,
    avgEntropyBitsPerChar,
    totalEntropyBits,
    crossTokenEntropyBits,
    sequential: seq.sequential,
    sequentialBase: seq.base,
    sequentialStep: seq.step,
    verdict,
    findings,
  };
}

/**
 * Idea 01060 — build out-of-order dependent-message sequence specs.
 * Each spec is a pair of messages (A then B) that the operator sends in
 * both orders; the analyzer compares the resulting application state.
 * @param {{label: string, first: string, second: string, dependsOn?: string}[]} messagePairs - Dependent message pairs, in their logical order.
 * @returns {{label: string, sendOrder: 'in-order'|'reversed', frames: string[], description: string}[]}
 */
export function outOfOrderSequenceSpecs(messagePairs = []) {
  const specs = [];
  for (const pair of messagePairs || []) {
    if (!pair || typeof pair.first !== 'string' || typeof pair.second !== 'string') continue;
    specs.push({
      label: `ordering:in-order:${pair.label}`,
      sendOrder: 'in-order',
      frames: [pair.first, pair.second],
      description: `Baseline: send "${pair.label}" messages in logical order (first, then second${pair.dependsOn ? `; second depends on ${pair.dependsOn}` : ''}).`,
    });
    specs.push({
      label: `ordering:reversed:${pair.label}`,
      sendOrder: 'reversed',
      frames: [pair.second, pair.first],
      description: `Probe: send "${pair.label}" messages reversed (second before first) — a server assuming order may apply the second operation to wrong state.`,
    });
  }
  return specs;
}

/**
 * Idea 01060 — compare operator-supplied application-state outcomes of
 * in-order vs reversed sends to detect order-assumption bugs.
 * @param {{label: string, sendOrder: 'in-order'|'reversed', finalState: string, error?: string|null}[]} outcomes
 * @returns {{type: string, confidence: string, evidence: string}[]}
 */
export function analyzeOrderingResponses(outcomes = []) {
  const findings = [];
  const groups = new Map();
  for (const o of outcomes || []) {
    if (!o || typeof o.label !== 'string') continue;
    const base = o.label.replace(/^ordering:(in-order|reversed):/, '');
    if (!groups.has(base)) groups.set(base, {});
    groups.get(base)[o.sendOrder] = o;
  }
  for (const [base, g] of groups) {
    if (!g['in-order'] || !g.reversed) continue;
    const inOrder = g['in-order'];
    const reversed = g.reversed;
    if (inOrder.finalState !== reversed.finalState) {
      findings.push({
        type: 'order-dependent-state-divergence',
        confidence: CONFIDENCE.HIGH,
        evidence: `Pair "${base}": reversed send produced a different final state than in-order send ("${String(inOrder.finalState).slice(0, 80)}" vs "${String(reversed.finalState).slice(0, 80)}") — the server applies operations without order independence.`,
      });
    }
    if (!inOrder.error && reversed.error) {
      findings.push({
        type: 'reversed-order-error',
        confidence: CONFIDENCE.MEDIUM,
        evidence: `Pair "${base}": reversed send errored ("${String(reversed.error).slice(0, 120)}") while in-order succeeded — the server assumes ordered delivery.`,
      });
    }
  }
  if (findings.length === 0 && outcomes.length > 0) {
    findings.push({
      type: 'ordering-independent',
      confidence: CONFIDENCE.LOW,
      evidence: 'In-order and reversed sends converged to the same final state — no order-assumption bug observed.',
    });
  }
  return findings;
}

/**
 * Build a uniform report finding from a WebSocket recon result.
 * @param {{title?: string, kind?: string, evidence?: string, targets?: string[], confidence?: string}} result
 * @returns {{title: string, severity: string, confidence: string, kind: string, evidence: string, targets: string[], recommendation: string}}
 */
export function websocketReconFinding(result = {}) {
  const { title = 'WebSocket recon finding', kind = 'recon', evidence = '', targets = [], confidence = 'medium' } = result;
  return {
    title: `WebSocket recon — ${title}`,
    severity: 'Info',
    confidence,
    kind,
    evidence,
    targets: Array.isArray(targets) ? targets : [],
    recommendation:
      'Review the flagged WebSocket surface on the authorized target: restrict STOMP/MQTT subscription ACLs, ' +
      'disable verbose protocol info endpoints, enforce per-connection memory and frame-size limits, require ' +
      'pong responses, issue high-entropy non-sequential resume tokens, and make message handlers order-independent.',
  };
}

/**
 * Named-const registry for deterministic access, mirroring house style.
 */
export const WEBSOCKET_PROTOCOL_RECON = {
  escapeStompHeader,
  stompSubscribeProbes,
  analyzeStompSubscribeResponses,
  mqttTopicCandidates,
  analyzeMqttSubscribeResults,
  sockjsInfoPathCandidates,
  analyzeSockjsInfo,
  clusterFrameShapes,
  binaryFrameMutationSpecs,
  analyzeBinaryFrameResponses,
  permessageDeflateDescriptors,
  analyzeCompressionBehavior,
  maxFrameSizeProbeSpecs,
  analyzeFrameSizeResponses,
  pingPongProbeSpecs,
  analyzePingPongLog,
  analyzeResumeTokens,
  outOfOrderSequenceSpecs,
  analyzeOrderingResponses,
  websocketReconFinding,
};

export default WEBSOCKET_PROTOCOL_RECON;
