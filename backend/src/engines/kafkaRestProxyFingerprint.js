/**
 * kafkaRestProxyFingerprint.js — Kafka REST Proxy / Schema Registry detection (idea 00493).
 *
 * Detects Confluent-style Kafka REST proxies and Schema Registry instances
 * from their JSON topic-listing and metadata APIs:
 *  - `GET /topics` → `["topic-a", "topic-b"]`
 *  - `GET /brokers` → `{ "brokers": [1, 2, 3] }`
 *  - `GET /` metadata → version hints
 *  - Schema Registry `:8081 /subjects` listing
 *
 * Offline analyzer: callers supply captured HTTP responses. No network code.
 * Defensive use only — findings feed exposure reports for authorized targets.
 */

const KAFKA_REST_HEADERS = ['x-request-id'];

/**
 * Analyze an HTTP response for Kafka REST Proxy evidence.
 *
 * @param {{headers?: object, body?: string, status?: number, path?: string}} response
 * @returns {object} detection verdict
 */
export function analyzeKafkaRestProxy(response = {}) {
  const headers = {};
  for (const [k, v] of Object.entries(response.headers || {})) {
    headers[k.toLowerCase()] = String(v);
  }
  const body = String(response.body || '').trim();
  const signals = [];
  const path = String(response.path || '');

  const versionMatch = body.match(/"version"\s*:\s*"([\d.]+)"/) || body.match(/confluent/i);
  let topics = null;
  try {
    const parsed = JSON.parse(body);
    if (Array.isArray(parsed) && parsed.every((t) => typeof t === 'string')
        && (path === '/topics' || path.endsWith('/topics'))) {
      topics = parsed;
      signals.push({ signal: 'topic_listing', detail: `${parsed.length} topics listed` });
    }
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.brokers)) {
      signals.push({ signal: 'broker_listing', detail: `brokers: ${parsed.brokers.join(', ')}` });
    }
  } catch { /* not JSON — not a REST proxy response */ }

  const contentType = headers['content-type'] || '';
  if (/application\/vnd\.kafka(\.v\d+)?\+json/i.test(contentType)) {
    signals.push({ signal: 'kafka_media_type', detail: contentType.slice(0, 80) });
  }
  if (/kafka-rest/i.test(headers.server || '')) {
    signals.push({ signal: 'server_header', detail: headers.server.slice(0, 80) });
  }

  const detected = signals.length > 0;
  return {
    detected,
    confidence: signals.some((s) => s.signal === 'topic_listing' || s.signal === 'kafka_media_type') ? 'high' : detected ? 'medium' : 'none',
    service: 'kafka-rest-proxy',
    version: versionMatch ? versionMatch[1] : null,
    topics,
    signals,
    recommendations: detected
      ? [
          'Verify the REST proxy is intended to be reachable; topic listings expose data-plane topology.',
          'Require authentication on the proxy and restrict :8082 to producers/consumers.',
          'Confirm Schema Registry :8081 is not exposing subjects to unauthenticated callers.',
        ]
      : [],
  };
}

/**
 * Analyze a response for Confluent Schema Registry evidence (`:8081 /subjects`).
 *
 * @param {{body?: string, status?: number, path?: string}} response
 * @returns {object} detection verdict
 */
export function analyzeSchemaRegistry(response = {}) {
  const body = String(response.body || '').trim();
  let subjects = null;
  try {
    const parsed = JSON.parse(body);
    if (Array.isArray(parsed) && parsed.every((s) => typeof s === 'string')
        && (String(response.path || '').endsWith('/subjects'))) {
      subjects = parsed;
    }
  } catch { /* not JSON */ }
  const detected = subjects !== null;
  return {
    detected,
    confidence: detected ? 'high' : 'none',
    service: 'schema-registry',
    subjects,
    recommendations: detected
      ? ['Restrict Schema Registry access; subject names can reveal business data models.']
      : [],
  };
}

export const KAFKA_REST_PROXY = {
  idea: '00493',
  defaultPorts: { restProxy: 8082, schemaRegistry: 8081 },
  analyzeRestProxy: analyzeKafkaRestProxy,
  analyzeSchemaRegistry,
};

export default KAFKA_REST_PROXY;
