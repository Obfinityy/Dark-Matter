/**
 * healthProbeRecon.js — Health-check and readiness-probe reconnaissance.
 *
 * Implements idea 00442 (Health-check endpoint discovery) and
 * idea 00443 (Readiness-probe output mining):
 * identifies common liveness/readiness probe paths and fingerprints the
 * backing framework from response shape, then mines probe outputs for
 * dependency names and versions.
 *
 * Passive analysis of HTTP responses only — no payloads, no exploits.
 */

/** Candidate health / liveness / readiness paths, ordered by prevalence. */
export const HEALTH_PATHS = [
  { path: '/health', framework: 'generic' },
  { path: '/healthz', framework: 'Kubernetes-style / Go' },
  { path: '/readyz', framework: 'Kubernetes-style / Go' },
  { path: '/livez', framework: 'Kubernetes-style / Go' },
  { path: '/healthcheck', framework: 'generic' },
  { path: '/health-check', framework: 'generic' },
  { path: '/ping', framework: 'generic' },
  { path: '/status', framework: 'generic' },
  { path: '/api/health', framework: 'generic REST' },
  { path: '/actuator/health', framework: 'Spring Boot' },
  { path: '/q/health', framework: 'Quarkus' },
  { path: '/management/health', framework: 'Micronaut' },
  { path: '/.well-known/health', framework: 'IETF draft well-known' },
  { path: '/_health', framework: 'generic' },
  { path: '/healthy', framework: 'generic' },
  { path: '/alive', framework: 'generic' },
  { path: '/ready', framework: 'generic' },
  { path: '/readiness', framework: 'generic' },
  { path: '/liveness', framework: 'generic' },
  { path: '/monitoring/health', framework: 'generic' },
  { path: '/diagnostics/health', framework: '.NET' },
  { path: '/health/live', framework: 'Spring Boot 3 style' },
  { path: '/health/ready', framework: 'Spring Boot 3 style' },
];

/** Framework fingerprints observable in a health-probe response body. */
const FRAMEWORK_SIGNATURES = [
  {
    framework: 'Spring Boot',
    pattern: /"status"\s*:\s*"UP"/,
    detail: 'Spring Actuator health JSON shape',
    confidence: 'high',
  },
  {
    framework: 'Quarkus',
    pattern: /"status"\s*:\s*"UP".*"checks"\s*:\s*\[/s,
    detail: 'SmallRye Health checks array',
    confidence: 'high',
  },
  {
    framework: 'Micronaut',
    pattern: /"name"\s*:\s*"micronaut"/i,
    detail: 'Micronaut health name field',
    confidence: 'high',
  },
  {
    framework: 'Kubernetes-style Go probe',
    pattern: /^ok$/im,
    detail: 'Bare "ok" liveness body',
    confidence: 'medium',
  },
  {
    framework: 'Consul agent',
    pattern: /"Agent"\s*:\s*\{/,
    detail: 'Consul /v1/agent/health body shape',
    confidence: 'high',
  },
  {
    framework: 'Django',
    pattern: /"database"\s*:\s*"working"|django.*health/i,
    detail: 'Django health-check app shape',
    confidence: 'medium',
  },
  {
    framework: 'Node.js',
    pattern: /"uptime"\s*:\s*\d+(\.\d+)?/,
    detail: 'Process-uptime JSON field',
    confidence: 'medium',
  },
  {
    framework: 'Envoy',
    pattern: /^LIVE$/im,
    detail: 'Envoy /server_info liveness token',
    confidence: 'medium',
  },
];

/** Component names commonly surfaced by readiness probes and their category. */
const DEPENDENCY_MARKERS = [
  { name: 'database', category: 'datastore', pattern: /\b(database|db|postgres|mysql|mariadb|mongodb|sqlserver)\b/i },
  { name: 'redis', category: 'cache', pattern: /\bredis\b/i },
  { name: 'elasticsearch', category: 'search', pattern: /\belasticsearch\b/i },
  { name: 'kafka', category: 'messaging', pattern: /\bkafka\b/i },
  { name: 'rabbitmq', category: 'messaging', pattern: /\b(rabbitmq|amqp)\b/i },
  { name: 'cassandra', category: 'datastore', pattern: /\bcassandra\b/i },
  { name: 'vault', category: 'secrets', pattern: /\bvault\b/i },
  { name: 's3', category: 'storage', pattern: /\bs3\b/i },
  { name: 'memcached', category: 'cache', pattern: /\bmemcached\b/i },
  { name: 'nats', category: 'messaging', pattern: /\bnats\b/i },
  { name: 'consul', category: 'discovery', pattern: /\bconsul\b/i },
  { name: 'ldap', category: 'directory', pattern: /\bldap\b/i },
];

/** Version-shaped tokens (semver-ish) found inside probe output. */
const VERSION_PATTERN = /(?<![\w.])(v?\d+\.\d+(?:\.\d+)?(?:[-+][\w.]+)?)(?![\w.])/g;

/**
 * Score a health-probe response: liveness confirmed + framework identified.
 * @param {{url, status, headers, body}} input
 */
export function analyzeHealthProbe({ url, status = 0, headers = {}, body = '' } = {}) {
  const text = String(body || '');
  const alive = status >= 200 && status < 400;

  let fingerprint = null;
  for (const sig of FRAMEWORK_SIGNATURES) {
    if (sig.pattern.test(text)) {
      fingerprint = { framework: sig.framework, detail: sig.detail, confidence: sig.confidence };
      break;
    }
  }

  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }

  return {
    detected: alive,
    idea: '00442',
    url,
    status,
    livenessConfirmed: alive,
    framework: fingerprint ? fingerprint.framework : null,
    frameworkDetail: fingerprint ? fingerprint.detail : null,
    jsonShape: parsed !== null,
    confidence: fingerprint ? fingerprint.confidence : alive ? 'low' : 'low',
    severity: alive ? 'Info' : 'None',
    cwe: 'CWE-200',
    evidence: alive
      ? `Path responded HTTP ${status} (${text.slice(0, 60).replace(/\s+/g, ' ')}…)` +
        (fingerprint ? ` — framework identified: ${fingerprint.framework}.` : '')
      : `Path responded HTTP ${status}; not a live health endpoint.`,
  };
}

/**
 * Mine a readiness-probe output for dependency names and versions.
 * @param {{url, status, headers, body}} input
 */
export function mineReadinessProbe({ url, status = 0, headers = {}, body = '' } = {}) {
  const text = String(body || '');
  const dependencies = [];

  for (const marker of DEPENDENCY_MARKERS) {
    if (marker.pattern.test(text)) {
      dependencies.push({ name: marker.name, category: marker.category });
    }
  }

  const versions = [...new Set([...text.matchAll(VERSION_PATTERN)].map((m) => m[1]))].slice(0, 25);

  let structuredChecks = [];
  try {
    const parsed = JSON.parse(text);
    const candidates = parsed.checks || parsed.details || parsed.components || [];
    if (Array.isArray(candidates)) {
      structuredChecks = candidates
        .map((c) => (typeof c === 'object' && c !== null ? c.name || c.id || c.component : String(c)))
        .filter(Boolean)
        .slice(0, 25);
    }
  } catch {
    structuredChecks = [];
  }

  return {
    detected: dependencies.length > 0 || versions.length > 0 || structuredChecks.length > 0,
    idea: '00443',
    url,
    status,
    dependencies,
    versions,
    structuredChecks,
    confidence: dependencies.length > 0 ? 'high' : 'low',
    severity: dependencies.length > 0 || versions.length > 0 ? 'Low' : 'Info',
    cwe: 'CWE-200',
    evidence:
      dependencies.length > 0
        ? `Readiness output names dependencies: ${dependencies.map((d) => d.name).join(', ')}.`
        : 'No dependency names found in readiness output.',
  };
}

export const HEALTH_PROBE_RECON = {
  analyzeHealthProbe,
  mineReadinessProbe,
  HEALTH_PATHS,
};
export default HEALTH_PROBE_RECON;
