/**
 * websocketHandshakeAnalysis.js — WebSocket handshake analysis for autonomous bug bounty.
 *
 * Implements idea-bank item 00427: analyze WebSocket upgrade handshake
 * observations to fingerprint server software and frameworks and to
 * inventory negotiated protocols and extensions.
 *
 * The 101 Switching Protocols response names its stack: the Server header
 * (Cowboy for Elixir/Phoenix, Jetty, nginx as a proxy), Sec-WebSocket-
 * Extensions (permessage-deflate and friends), and the selected
 * Sec-WebSocket-Protocol subprotocol all fingerprint the implementation.
 * Cookies set during the upgrade and non-101 outcomes (426 Upgrade
 * Required, 400, 403) further characterize the endpoint.
 *
 * All functions are pure and side-effect free: they analyze handshake
 * observations the caller recorded during an authorized engagement. No
 * WebSocket connections are opened here.
 */

/**
 * Server-header -> implementation mappings.
 * @type {Array<{test: RegExp, implementation: string, confidence: string}>}
 */
const SERVER_SIGNATURES = [
  { test: /cowboy/i, implementation: 'Elixir/Phoenix (Cowboy)', confidence: 'high' },
  { test: /jetty/i, implementation: 'Eclipse Jetty', confidence: 'high' },
  { test: /tomcat/i, implementation: 'Apache Tomcat', confidence: 'high' },
  { test: /nginx/i, implementation: 'nginx (proxy or ws module)', confidence: 'medium' },
  { test: /apache/i, implementation: 'Apache httpd (proxy)', confidence: 'medium' },
  { test: /kestrel/i, implementation: 'ASP.NET Core (Kestrel)', confidence: 'high' },
  { test: /netty/i, implementation: 'Netty (Java)', confidence: 'medium' },
  { test: /gunicorn|uvicorn|daphne/i, implementation: 'Python ASGI server', confidence: 'medium' },
  { test: /cloudflare/i, implementation: 'Cloudflare edge', confidence: 'medium' },
];

/**
 * Normalize an observation's headers into a lowercase-keyed map.
 * @param {*} headers Object, array of [k,v] pairs, or array of "k: v" strings.
 * @returns {Record<string, string|string[]>}
 */
export function normalizeHeaders(headers) {
  const out = {};
  const set = (k, v) => {
    const key = String(k).trim().toLowerCase();
    if (out[key] === undefined) out[key] = v;
    else if (Array.isArray(out[key])) out[key].push(v);
    else out[key] = [out[key], v];
  };
  if (!headers) return out;
  if (Array.isArray(headers)) {
    for (const h of headers) {
      if (Array.isArray(h) && h.length >= 2) set(h[0], String(h[1]));
      else if (typeof h === 'string') {
        const i = h.indexOf(':');
        if (i > 0) set(h.slice(0, i), h.slice(i + 1).trim());
      }
    }
  } else if (typeof headers === 'object') {
    for (const [k, v] of Object.entries(headers)) {
      if (Array.isArray(v)) v.forEach((x) => set(k, String(x)));
      else set(k, String(v));
    }
  }
  return out;
}

/**
 * Get all values for a header as an array.
 * @param {Record<string, string|string[]>} headers Normalized headers.
 * @param {string} name Header name (case-insensitive).
 * @returns {string[]}
 */
function headerValues(headers, name) {
  const v = headers[String(name).toLowerCase()];
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

/**
 * Fingerprint the WebSocket implementation from handshake response headers.
 * @param {*} headers Raw headers object/array.
 * @returns {Array<{implementation: string, confidence: string, via: string}>}
 */
export function fingerprintWebsocketServer(headers) {
  const h = normalizeHeaders(headers);
  const hits = [];
  for (const sv of headerValues(h, 'server')) {
    for (const sig of SERVER_SIGNATURES) {
      if (sig.test.test(sv)) hits.push({ implementation: sig.implementation, confidence: sig.confidence, via: `Server: ${sv}` });
    }
  }
  for (const xv of headerValues(h, 'x-powered-by')) {
    hits.push({ implementation: `powered-by hint: ${xv}`, confidence: 'low', via: `X-Powered-By: ${xv}` });
  }
  return hits;
}

/**
 * Parse negotiated WebSocket extensions and subprotocols.
 * @param {*} headers Raw headers object/array.
 * @returns {{extensions: string[], subprotocol: string|null, acceptKeyPresent: boolean}}
 */
export function parseWsNegotiation(headers) {
  const h = normalizeHeaders(headers);
  const extensions = [];
  for (const v of headerValues(h, 'sec-websocket-extensions')) {
    for (const part of v.split(',')) {
      const name = part.split(';')[0].trim();
      if (name) extensions.push(name);
    }
  }
  const proto = headerValues(h, 'sec-websocket-protocol')[0];
  return {
    extensions: [...new Set(extensions)],
    subprotocol: proto ? proto.trim() : null,
    acceptKeyPresent: headerValues(h, 'sec-websocket-accept').length > 0,
  };
}

/**
 * Analyze a full WebSocket handshake observation.
 * @param {object} obs {
 *   status?: number, requestHeaders?: *, responseHeaders?: *,
 *   url?: string, setCookies?: string[]
 * }
 * @returns {{
 *   status: number|null, upgradeSuccessful: boolean, serverFingerprints: Array,
 *   negotiation: object, cookiesSet: number, outcome: string, observations: string[]
 * }}
 */
export function analyzeWebsocketHandshake(obs = {}) {
  const status = typeof obs.status === 'number' ? obs.status : null;
  const responseHeaders = normalizeHeaders(obs.responseHeaders);
  const negotiation = parseWsNegotiation(obs.responseHeaders);
  const serverFingerprints = fingerprintWebsocketServer(obs.responseHeaders);
  const observations = [];

  let outcome = 'unknown';
  let upgradeSuccessful = false;
  if (status === 101) {
    upgradeSuccessful = true;
    outcome = 'upgrade accepted (101 Switching Protocols)';
  } else if (status === 426) {
    outcome = 'upgrade required (426) — endpoint expects the Upgrade handshake';
  } else if (status === 400) {
    outcome = 'bad request (400) — handshake rejected (missing/invalid key or origin policy)';
  } else if (status === 403) {
    outcome = 'forbidden (403) — handshake rejected by access policy';
  } else if (status !== null) {
    outcome = `unexpected status ${status}`;
  }
  observations.push(outcome);
  if (negotiation.subprotocol) observations.push(`negotiated subprotocol: ${negotiation.subprotocol}`);
  if (negotiation.extensions.length > 0) observations.push(`negotiated extensions: ${negotiation.extensions.join(', ')}`);
  const cookies = Array.isArray(obs.setCookies) ? obs.setCookies : [];
  if (cookies.length > 0) observations.push(`${cookies.length} cookie(s) set during the upgrade handshake`);

  return {
    status,
    upgradeSuccessful,
    serverFingerprints,
    negotiation,
    cookiesSet: cookies.length,
    outcome,
    observations,
  };
}
