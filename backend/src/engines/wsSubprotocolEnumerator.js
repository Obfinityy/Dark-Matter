/**
 * wsSubprotocolEnumerator.js — WebSocket subprotocol enumeration engine.
 *
 * Analyzes observed WebSocket handshake data (client offers from page
 * scripts and server Sec-WebSocket-Protocol selections) to fingerprint the
 * real-time framework in use. Enumeration works from artifacts the agent
 * already observed — script source and recorded handshake headers — and
 * performs no new connections.
 */

const SUBPROTOCOL_FRAMEWORK_MAP = [
  { pattern: /^graphql-ws$/i, framework: 'graphql-ws (legacy GraphQL subscriptions)' },
  { pattern: /^graphql-transport-ws$/i, framework: 'graphql-ws (graphql-transport-ws)' },
  { pattern: /^mqtt$/i, framework: 'MQTT over WebSocket' },
  { pattern: /^mqttv3\.1$/i, framework: 'MQTT v3.1 over WebSocket' },
  { pattern: /^stomp$/i, framework: 'STOMP over WebSocket' },
  { pattern: /^wamp$/i, framework: 'WAMP' },
  { pattern: /^soap$/i, framework: 'SOAP over WebSocket' },
  { pattern: /^json$/i, framework: 'JSON subprotocol (custom real-time API)' },
  { pattern: /^binary$/i, framework: 'binary subprotocol (custom real-time API)' },
];

/**
 * Extract subprotocol offers from WebSocket constructor calls in page scripts.
 * @param {string} scriptSource JavaScript source observed on the page
 * @returns {string[]} offered subprotocol names
 */
export function extractOfferedSubprotocols(scriptSource = '') {
  const offers = new Set();
  const re = /new\s+WebSocket\s*\([^,]+,\s*([^)]+)\)/gi;
  let m;
  while ((m = re.exec(String(scriptSource))) !== null) {
    const arg = m[1].trim();
    // String literal offer: new WebSocket(url, 'proto')
    const single = /^['"]([^'"]+)['"]$/.exec(arg);
    if (single) {
      offers.add(single[1]);
      continue;
    }
    // Array offer: new WebSocket(url, ['a', 'b'])
    const arr = /^\[([^\]]*)\]$/.exec(arg);
    if (arr) {
      for (const lit of arr[1].matchAll(/['"]([^'"]+)['"]/g)) offers.add(lit[1]);
    }
  }
  return [...offers];
}

/**
 * Map a subprotocol name to a likely framework.
 * @param {string} subprotocol
 * @returns {string} framework description or 'unknown-custom'
 */
export function fingerprintSubprotocol(subprotocol = '') {
  const s = String(subprotocol).trim();
  for (const entry of SUBPROTOCOL_FRAMEWORK_MAP) {
    if (entry.pattern.test(s)) return entry.framework;
  }
  return 'unknown-custom';
}

/**
 * Analyze a full observed handshake: offers plus the server selection.
 * @param {{offers?: string[], serverSelected?: string|null}} handshake
 * @returns {{offers: Array<{name: string, framework: string}>, serverSelected: string|null, framework: string}}
 */
export function analyzeHandshake({ offers = [], serverSelected = null } = {}) {
  const mapped = offers.map(name => ({ name, framework: fingerprintSubprotocol(name) }));
  const framework = serverSelected
    ? fingerprintSubprotocol(serverSelected)
    : mapped.find(o => o.framework !== 'unknown-custom')?.framework || 'unknown-custom';
  return { offers: mapped, serverSelected, framework };
}

export const WS_SUBPROTOCOL_ENUMERATOR = {
  extractOfferedSubprotocols,
  fingerprintSubprotocol,
  analyzeHandshake,
};

export default WS_SUBPROTOCOL_ENUMERATOR;
