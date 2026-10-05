/**
 * amqpMgmtProber.js — AMQP management-plugin HTTP API analyzer.
 *
 * Analyzes responses from the RabbitMQ management HTTP API
 * (GET /api/overview, /api/vhosts, /api/whoami) to identify broker version,
 * exposed vhosts and authentication posture on in-scope targets. Also covers
 * the 404/401/403 handling patterns that distinguish the management plugin
 * from generic HTTP services.
 *
 * Offline analyzer: callers supply HTTP status + parsed JSON body.
 */

/** Management endpoints worth checking, with their intelligence value. */
export const MGMT_ENDPOINTS = [
  { path: '/api/overview', value: 'Broker version, product name, node stats' },
  { path: '/api/vhosts', value: 'List of configured virtual hosts' },
  { path: '/api/whoami', value: 'Authenticated identity and tags' },
  { path: '/api/nodes', value: 'Node names, OS, Erlang version' },
  { path: '/api/definitions', value: 'Full broker configuration export (sensitive)' },
];

/**
 * Analyze a management API response.
 *
 * @param {Object} resp - { endpoint, status, body (object|string), headers? }
 * @returns {Object} analysis.
 */
export function analyzeMgmtResponse(resp = {}) {
  const status = Number(resp.status || 0);
  const endpoint = String(resp.endpoint || '');
  const body = resp.body && typeof resp.body === 'object' ? resp.body : null;

  if (status === 404) {
    return {
      endpoint, status,
      pluginDetected: false,
      note: 'Management API not found at this path.',
      type: 'AMQP Management Probe',
      confidence: 'medium',
    };
  }
  if (status === 401) {
    return {
      endpoint, status,
      pluginDetected: true,
      authenticated: false,
      note: 'Management plugin detected; requires authentication (realm challenge expected).',
      tryDefaultCreds: false,
      type: 'AMQP Management Probe',
      confidence: 'high',
    };
  }
  if (status === 403) {
    return {
      endpoint, status,
      pluginDetected: true,
      authenticated: true,
      note: 'Management plugin detected; credentials valid but lack administrator tag.',
      type: 'AMQP Management Probe',
      confidence: 'high',
    };
  }

  const findings = { endpoint, status, pluginDetected: false, authenticated: false };
  if (status === 200 && body) {
    if (body.rabbitmq_version || body.product_info || body.node) {
      findings.pluginDetected = true;
      findings.authenticated = true;
      findings.product = body.product_info?.product || body.product || 'RabbitMQ';
      findings.version = body.rabbitmq_version || body.product_info?.version || null;
      findings.node = body.node || null;
      findings.erlangVersion = body.erlang_version || null;
      findings.managementVersion = body.management_version || null;
      findings.messageStats = body.message_stats || null;
    }
  }
  if (endpoint === '/api/vhosts' && Array.isArray(body)) {
    findings.pluginDetected = true;
    findings.authenticated = true;
    findings.vhosts = body.map(v => (typeof v === 'string' ? v : v.name)).filter(Boolean);
  }
  if (endpoint === '/api/whoami' && body) {
    findings.pluginDetected = true;
    findings.authenticated = true;
    findings.identity = body.name || body.username || null;
    findings.tags = body.tags || body.authorities || null;
  }

  findings.summary = findings.pluginDetected
    ? `Management plugin detected${findings.version ? `, broker version ${findings.version}` : ''}${findings.vhosts ? `, vhosts: ${findings.vhosts.join(', ')}` : ''}.`
    : `Endpoint ${endpoint} did not look like the management API (status ${status}).`;
  findings.type = 'AMQP Management Probe';
  findings.confidence = findings.pluginDetected ? 'high' : 'low';
  return findings;
}

/**
 * Aggregate a multi-endpoint management scan into one posture report.
 *
 * @param {Array<Object>} responses - Response objects as above.
 * @returns {Object} aggregate report.
 */
export function summarizeMgmtScan(responses = []) {
  const analyzed = responses.map(analyzeMgmtResponse);
  const detected = analyzed.filter(a => a.pluginDetected);
  const versions = [...new Set(detected.map(d => d.version).filter(Boolean))];
  const vhosts = [...new Set(detected.flatMap(d => d.vhosts || []))];
  const identities = [...new Set(detected.map(d => d.identity).filter(Boolean))];
  const unauthenticated = analyzed.some(a => a.status === 401);
  const reachable = detected.some(a => a.authenticated);

  return {
    endpointsChecked: analyzed.length,
    pluginDetected: detected.length > 0,
    versions,
    vhosts,
    identities,
    requiresAuth: unauthenticated,
    anyAuthenticated: reachable,
    perEndpoint: analyzed.map(a => ({ endpoint: a.endpoint, status: a.status, pluginDetected: a.pluginDetected })),
    summary: detected.length
      ? `RabbitMQ management plugin detected (versions: ${versions.join(', ') || 'unknown'}; vhosts: ${vhosts.join(', ') || 'unknown'}).`
      : 'No management plugin detected on checked endpoints.',
    type: 'AMQP Management Scan Summary',
    confidence: detected.length ? 'high' : 'medium',
  };
}

export const AMQP_MGMT_PROBER = {
  MGMT_ENDPOINTS,
  analyzeMgmtResponse,
  summarizeMgmtScan,
};
export default AMQP_MGMT_PROBER;
