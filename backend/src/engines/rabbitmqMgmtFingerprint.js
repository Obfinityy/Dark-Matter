/**
 * rabbitmqMgmtFingerprint.js — RabbitMQ management UI/API detection (idea 00492).
 *
 * Detects RabbitMQ management interfaces from passive evidence:
 *  - Management UI HTTP (default :15672): title, static asset paths.
 *  - Management HTTP API `/api/overview`: cluster/product/version details.
 *
 * Offline analyzer: callers supply captured HTTP responses. No network code;
 * no credential attempts. Defensive use only — findings feed exposure
 * reports for authorized targets.
 */

const MGMT_UI_TITLE = /<title>\s*rabbitmq\s+management\s*<\/title>/i;
const MGMT_BODY_MARKERS = [
  /rabbitmq-management/i,
  /\/js\/dispatcher\.js/i,
  /"rabbitmq"/i,
];

/**
 * Analyze an HTTP response for the RabbitMQ management UI.
 *
 * @param {{headers?: object, body?: string, status?: number}} response
 * @returns {object} detection verdict
 */
export function analyzeRabbitMqMgmtUi(response = {}) {
  const body = String(response.body || '');
  const signals = [];
  if (MGMT_UI_TITLE.test(body)) signals.push({ signal: 'ui_title', detail: '<title>RabbitMQ Management</title>' });
  for (const re of MGMT_BODY_MARKERS) {
    if (re.test(body)) signals.push({ signal: 'body_marker', detail: String(re) });
  }
  const detected = signals.length > 0;
  return {
    detected,
    confidence: MGMT_UI_TITLE.test(body) ? 'high' : detected ? 'medium' : 'none',
    service: 'rabbitmq-management-ui',
    signals,
    recommendations: detected
      ? [
          'Verify the management UI is intended to be reachable; restrict :15672 to the management network.',
          'Confirm the default guest/guest account is disabled or its password rotated.',
          'Enforce TLS for the management UI and API.',
        ]
      : [],
  };
}

/**
 * Parse a captured `/api/overview` JSON payload into a structured summary.
 *
 * @param {string|object} payload raw JSON string or parsed object
 * @returns {object} normalized overview or `{ valid: false, reason }`
 */
export function parseManagementOverview(payload) {
  let data = payload;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch {
      return { valid: false, reason: 'payload is not valid JSON' };
    }
  }
  if (!data || typeof data !== 'object' || !data.rabbitmq_version) {
    return { valid: false, reason: 'not a RabbitMQ /api/overview payload' };
  }
  const listeners = Array.isArray(data.listeners) ? data.listeners.map((l) => ({
    protocol: l.protocol, ip: l.ip_address, port: l.port,
  })) : [];
  return {
    valid: true,
    product: data.product || 'RabbitMQ',
    rabbitmqVersion: data.rabbitmq_version,
    erlangVersion: data.erlang_version || null,
    clusterName: data.cluster_name || null,
    nodeName: data.node || null,
    listeners,
    messageStats: data.message_stats || {},
    exposedListeners: listeners.filter((l) => l.ip === '0.0.0.0' || l.ip === '::'),
  };
}

/**
 * Assess exposure risk of a detected RabbitMQ management endpoint.
 *
 * @param {{ui?: object, overview?: object}} evidence
 * @returns {object} risk assessment
 */
export function assessRabbitMqExposure(evidence = {}) {
  const findings = [];
  if (evidence.ui?.detected) findings.push({ level: 'medium', text: 'RabbitMQ management UI reachable over HTTP.' });
  if (evidence.overview?.valid) {
    if (evidence.overview.exposedListeners?.length) {
      findings.push({ level: 'high', text: `RabbitMQ listens on all interfaces: ${evidence.overview.exposedListeners.map((l) => `${l.protocol}:${l.port}`).join(', ')}.` });
    } else {
      findings.push({ level: 'low', text: `RabbitMQ ${evidence.overview.rabbitmqVersion} identified via management API.` });
    }
  }
  const score = findings.some((f) => f.level === 'high') ? 7
    : findings.some((f) => f.level === 'medium') ? 4
    : findings.length ? 1 : 0;
  return { findings, score, detected: findings.length > 0 };
}

export const RABBITMQ_MGMT = {
  idea: '00492',
  defaultPort: 15672,
  analyzeUi: analyzeRabbitMqMgmtUi,
  parseOverview: parseManagementOverview,
  assessExposure: assessRabbitMqExposure,
};

export default RABBITMQ_MGMT;
