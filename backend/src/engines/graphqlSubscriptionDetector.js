/**
 * graphqlSubscriptionDetector.js — GraphQL subscription / real-time API detector.
 *
 * Idea 00622 — GraphQL subscription detection.
 *
 * Maps real-time GraphQL capabilities of an authorized target by:
 *  - probing HTTP endpoints for the subscription subprotocols they accept
 *    (graphql-ws legacy, graphql-transport-ws current spec)
 *  - analyzing an introspected __schema for a subscription root type
 *
 * This is passive fingerprinting: it only inspects protocol advertisement
 * metadata. No queries beyond standard introspection are issued.
 */

const GRAPHQL_PATHS = ['/graphql', '/v1/graphql', '/api/graphql', '/query', '/gql'];

const SUBSCRIPTION_PROTOCOLS = [
  { protocol: 'graphql-transport-ws', label: 'graphql-transport-ws (current spec)' },
  { protocol: 'graphql-ws', label: 'graphql-ws (legacy Apollo)' },
];

/**
 * Candidate GraphQL endpoint URLs for a base URL.
 * @param {string} baseUrl e.g. https://target.example
 * @param {string[]} [extraPaths] additional endpoint paths
 * @returns {string[]}
 */
export function graphqlCandidates(baseUrl, extraPaths = []) {
  if (!baseUrl || typeof baseUrl !== 'string') return [];
  const base = baseUrl.replace(/\/+$/, '');
  return [...new Set([...GRAPHQL_PATHS, ...extraPaths])].map((p) => `${base}${p}`);
}

/**
 * Build the connection_init handshake payload for a subprotocol.
 * @param {string} protocol one of 'graphql-transport-ws' | 'graphql-ws'
 * @returns {{ type: string, payload: object }} handshake message
 */
export function subscriptionHandshake(protocol) {
  return {
    type: protocol === 'graphql-ws' ? 'connection_init' : 'connection_init',
    payload: {},
  };
}

/**
 * Analyze a WebSocket handshake response for accepted subscription protocols.
 * @param {string|string[]} secWebSocketProtocol the Sec-WebSocket-Protocol response header value(s)
 * @returns {string[]} accepted subscription subprotocols
 */
export function acceptedSubscriptionProtocols(secWebSocketProtocol) {
  const values = Array.isArray(secWebSocketProtocol)
    ? secWebSocketProtocol.flatMap((v) => String(v).split(','))
    : String(secWebSocketProtocol || '').split(',');
  const accepted = values.map((v) => v.trim()).filter(Boolean);
  return SUBSCRIPTION_PROTOCOLS.map((s) => s.protocol).filter((p) => accepted.includes(p));
}

/**
 * Analyze an introspection schema JSON for a subscription root type.
 * @param {object} schema parsed __schema JSON (query result of { __schema { ... } })
 * @returns {object} { detected, subscriptionType, fieldCount, fields }
 */
export function analyzeSchemaForSubscriptions(schema) {
  const result = { detected: false, subscriptionType: null, fieldCount: 0, fields: [] };
  const s = schema?.data?.__schema || schema?.__schema;
  if (!s) return result;
  const sub = s.subscriptionType;
  if (!sub) return result;
  result.detected = true;
  result.subscriptionType = sub.name || null;
  const typeDef = (s.types || []).find((t) => t.name === sub.name);
  const fields = typeDef?.fields || [];
  result.fieldCount = fields.length;
  result.fields = fields.map((f) => f.name).filter(Boolean);
  return result;
}

/**
 * Detect subscription support on an endpoint via subprotocol probing.
 * @param {string} url GraphQL endpoint URL
 * @param {Function} [fetchImpl] injectable fetch (must support WS upgrade mock)
 * @returns {Promise<object>} { url, protocols, websocketUpgrade, error }
 */
export async function detectSubscriptionSupport(url, fetchImpl = globalThis.fetch) {
  const outcome = { url, protocols: [], websocketUpgrade: false, error: null };
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Upgrade: 'websocket',
        Connection: 'Upgrade',
        'Sec-WebSocket-Protocol': 'graphql-transport-ws, graphql-ws',
        'Sec-WebSocket-Version': '13',
      },
      body: JSON.stringify({ query: '{ __typename }' }),
    });
    if (res.status === 101 || res.status === 426) outcome.websocketUpgrade = true;
    const protoHeader = res.headers?.get?.('sec-websocket-protocol')
      ?? res.headers?.get?.('Sec-WebSocket-Protocol');
    outcome.protocols = acceptedSubscriptionProtocols(protoHeader);
    const allow = res.headers?.get?.('upgrade');
    if (allow && /websocket/i.test(allow)) outcome.websocketUpgrade = true;
  } catch (err) {
    outcome.error = err?.message || String(err);
  }
  return outcome;
}

/**
 * Summarize subscription detection as a hardening note.
 * @param {object[]} detections detection results
 * @returns {string|null}
 */
export function summarizeFindings(detections = []) {
  const exposed = detections.filter((d) => d.protocols.length > 0 || d.websocketUpgrade);
  if (exposed.length === 0) return null;
  const lines = exposed.map((d) => {
    const proto = d.protocols.length ? d.protocols.join(', ') : 'none advertised';
    return `- ${d.url}: websocket upgrade ${d.websocketUpgrade ? 'accepted' : 'not observed'}; subprotocols: ${proto}`;
  });
  return `Real-time GraphQL surface detected:\n${lines.join('\n')}\nRecommendation: ensure subscription operations carry the same authorization checks as queries and mutations.`;
}
