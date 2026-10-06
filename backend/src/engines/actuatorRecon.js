/**
 * actuatorRecon.js — Spring Boot actuator mapping and env-redaction testing.
 *
 * Implements idea 00447 (Spring Boot actuator mapping) and
 * idea 00448 (Actuator env-redaction testing):
 * maps which actuator endpoints a Java service exposes and classifies the
 * information-disclosure level, with a dedicated check for how well the
 * `/actuator/env` endpoint redacts sensitive property values.
 *
 * Analysis is defensive: it classifies exposure and reports sensitive KEY
 * names only — secret values are never echoed into findings.
 */

/** Known Spring Boot actuator endpoints and their disclosure risk tier. */
export const ACTUATOR_ENDPOINTS = [
  { path: '/actuator/health', tier: 'safe', note: 'liveness only' },
  { path: '/actuator/info', tier: 'low', note: 'build/app metadata' },
  { path: '/actuator', tier: 'low', note: 'endpoint index (confirms actuator)' },
  { path: '/actuator/metrics', tier: 'medium', note: 'metric names reveal internals' },
  { path: '/actuator/prometheus', tier: 'medium', note: 'label harvesting surface' },
  { path: '/actuator/loggers', tier: 'medium', note: 'logger config; log-level tampering' },
  { path: '/actuator/mappings', tier: 'medium', note: 'full route table disclosure' },
  { path: '/actuator/beans', tier: 'medium', note: 'bean graph reveals libraries' },
  { path: '/actuator/configprops', tier: 'high', note: 'configuration properties' },
  { path: '/actuator/env', tier: 'high', note: 'environment + property sources' },
  { path: '/actuator/threaddump', tier: 'high', note: 'thread stacks leak internals' },
  { path: '/actuator/heapdump', tier: 'critical', note: 'full memory dump download' },
  { path: '/actuator/httptrace', tier: 'high', note: 'recent request traces' },
  { path: '/actuator/auditevents', tier: 'medium', note: 'audit trail' },
  { path: '/actuator/conditions', tier: 'medium', note: 'auto-config report' },
  { path: '/actuator/scheduledtasks', tier: 'medium', note: 'scheduled task listing' },
  { path: '/actuator/caches', tier: 'low', note: 'cache manager listing' },
  { path: '/actuator/sessions', tier: 'high', note: 'session listing (Spring Session)' },
  { path: '/actuator/startup', tier: 'low', note: 'startup timeline' },
  { path: '/actuator/sbom', tier: 'low', note: 'software bill of materials' },
  { path: '/actuator/liquibase', tier: 'medium', note: 'DB migration history' },
  { path: '/actuator/flyway', tier: 'medium', note: 'DB migration history' },
  { path: '/actuator/gateway', tier: 'medium', note: 'Spring Cloud Gateway routes' },
  { path: '/actuator/integrationgraph', tier: 'medium', note: 'integration flow graph' },
  { path: '/actuator/shutdown', tier: 'critical', note: 'remote shutdown (if enabled)' },
];

/** Property-name patterns that Spring marks as sensitive and should redact. */
const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /credential/i,
  /api[_-]?key/i,
  /apikey/i,
  /access[_-]?token/i,
  /private[_-]?key/i,
  /client[_-]?secret/i,
  /db[_-]?pass/i,
  /auth[_-]?token/i,
  /bearer/i,
];

/** Value shapes Spring uses when a property is properly redacted. */
const REDACTED_VALUE_PATTERN = /^\*{2,}$/;

/**
 * Map which actuator endpoints are exposed from a set of probe results.
 * @param {{baseUrl, probes: Array<{path, status, body}>}} input
 */
export function mapActuatorExposure({ baseUrl, probes = [] } = {}) {
  const exposed = [];
  for (const probe of probes) {
    const known = ACTUATOR_ENDPOINTS.find((e) => e.path === probe.path);
    if (!known) continue;
    if (probe.status >= 200 && probe.status < 400) {
      exposed.push({ path: probe.path, status: probe.status, tier: known.tier, note: known.note });
    }
  }

  const tierRank = { safe: 0, low: 1, medium: 2, high: 3, critical: 4 };
  const maxTier = exposed.reduce((m, e) => (tierRank[e.tier] > tierRank[m] ? e.tier : m), 'safe');

  const isSpring = exposed.some((e) => e.path === '/actuator' || e.path === '/actuator/health');
  const confidence = isSpring ? 'high' : exposed.length > 0 ? 'medium' : 'low';

  const severityByTier = { safe: 'Info', low: 'Info', medium: 'Low', high: 'Medium', critical: 'High' };

  return {
    detected: exposed.length > 0,
    idea: '00447',
    baseUrl,
    springBootConfirmed: isSpring,
    exposed,
    exposureLevel: maxTier,
    confidence,
    severity: exposed.length > 0 ? severityByTier[maxTier] : 'Info',
    cwe: 'CWE-200',
    evidence: isSpring
      ? `Spring Boot actuator confirmed at ${baseUrl}; ${exposed.length} endpoint(s) exposed, highest tier "${maxTier}".`
      : `No Spring Boot actuator confirmed (${exposed.length} matching paths responded).`,
  };
}

/**
 * Test how well /actuator/env redacts sensitive property values.
 * Reports sensitive KEY names and redaction state — never secret values.
 * @param {{url, status, headers, body}} input
 */
export function testEnvRedaction({ url, status = 0, headers = {}, body = '' } = {}) {
  const text = String(body || '');
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }

  if (status < 200 || status >= 400 || !parsed || typeof parsed !== 'object') {
    return {
      detected: false,
      idea: '00448',
      url,
      status,
      confidence: 'low',
      severity: 'Info',
      cwe: 'CWE-200',
      evidence: '/actuator/env is not exposed or did not return JSON.',
    };
  }

  const sources = parsed.propertySources || [];
  const sensitive = [];
  for (const source of sources) {
    const props = (source && source.properties) || {};
    for (const key of Object.keys(props)) {
      if (!SENSITIVE_KEY_PATTERNS.some((p) => p.test(key))) continue;
      const value = props[key] && typeof props[key] === 'object' ? props[key].value : props[key];
      const redacted = REDACTED_VALUE_PATTERN.test(String(value ?? ''));
      sensitive.push({ key, source: source.name || 'unknown', redacted });
    }
  }

  const unredacted = sensitive.filter((s) => !s.redacted);
  const classification =
    sensitive.length === 0
      ? 'no-sensitive-keys'
      : unredacted.length === 0
        ? 'fully-redacted'
        : unredacted.length < sensitive.length
          ? 'partially-redacted'
          : 'unredacted';

  const severity =
    classification === 'unredacted' ? 'High' : classification === 'partially-redacted' ? 'Medium' : 'Low';

  return {
    detected: true,
    idea: '00448',
    url,
    status,
    redaction: classification,
    sensitiveKeys: sensitive.map((s) => ({ key: s.key, source: s.source, redacted: s.redacted })),
    unredactedCount: unredacted.length,
    confidence: 'high',
    severity,
    cwe: 'CWE-200',
    evidence: `Checked ${sensitive.length} sensitive-looking property key(s) across ${sources.length} property source(s): ${classification}. Values are never echoed; only key names and redaction state are reported.`,
  };
}

export const ACTUATOR_RECON = {
  mapActuatorExposure,
  testEnvRedaction,
  ACTUATOR_ENDPOINTS,
};
export default ACTUATOR_RECON;
