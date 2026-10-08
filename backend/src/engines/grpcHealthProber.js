/**
 * grpcHealthProber.js — gRPC health-check probing analyzer.
 *
 * Analyzes responses from the standard gRPC health service
 * (grpc.health.v1.Health/Check and /Watch): SERVING / NOT_SERVING /
 * UNKNOWN / SERVICE_UNKNOWN statuses confirm liveness of individual
 * services and reveal deployment patterns (rolling updates, canaries,
 * per-service health granularity) on in-scope targets.
 *
 * Offline analyzer: callers supply decoded health-check responses.
 */

export const HEALTH_STATUSES = {
  UNKNOWN: 0,
  SERVING: 1,
  NOT_SERVING: 2,
  SERVICE_UNKNOWN: 3,
};

export const HEALTH_STATUS_NAMES = ['UNKNOWN', 'SERVING', 'NOT_SERVING', 'SERVICE_UNKNOWN'];

/**
 * Normalize a health status code/name into a canonical name.
 * @param {number|string} status
 */
export function normalizeHealthStatus(status) {
  if (typeof status === 'number') return HEALTH_STATUS_NAMES[status] || `UNKNOWN_CODE_${status}`;
  const s = String(status).toUpperCase();
  return HEALTH_STATUS_NAMES.includes(s) ? s : s;
}

/**
 * Analyze a batch of health-check responses.
 *
 * @param {Array<Object>} checks - Each { service, status (code|name),
 *   latencyMs?, detail? }.
 * @returns {Object} analysis.
 */
export function analyzeHealthChecks(checks = []) {
  if (!Array.isArray(checks)) checks = [];
  const rows = checks
    .filter(c => c && typeof c.service === 'string')
    .map(c => ({
      service: c.service,
      status: normalizeHealthStatus(c.status),
      latencyMs: typeof c.latencyMs === 'number' ? c.latencyMs : null,
      detail: c.detail ? String(c.detail).slice(0, 200) : null,
    }));

  const byStatus = {};
  for (const r of rows) byStatus[r.status] = (byStatus[r.status] || 0) + 1;

  const serving = rows.filter(r => r.status === 'SERVING');
  const notServing = rows.filter(r => r.status === 'NOT_SERVING');
  const unknownService = rows.filter(r => r.status === 'SERVICE_UNKNOWN');

  const latencies = rows.map(r => r.latencyMs).filter(v => v !== null);
  const latencyStats = latencies.length
    ? {
        min: Math.min(...latencies),
        max: Math.max(...latencies),
        avg: Math.round((latencies.reduce((a, b) => a + b, 0) / latencies.length) * 100) / 100,
        samples: latencies.length,
      }
    : null;

  // Deployment pattern inference.
  const patterns = [];
  if (notServing.length > 0 && serving.length > 0) {
    patterns.push(
      'Mixed SERVING/NOT_SERVING — possible rolling update, canary, or partially degraded deployment.'
    );
  }
  if (unknownService.length > 0) {
    patterns.push(
      `${unknownService.length} service name(s) returned SERVICE_UNKNOWN — server validates service names; enumerate from reflection or docs.`
    );
  }
  if (rows.length === 1 && serving.length === 1) {
    patterns.push(
      'Single global health check — server may implement only the empty-service (overall) check.'
    );
  }
  if (rows.length > 3 && serving.length === rows.length) {
    patterns.push('All services SERVING — healthy deployment; per-service granularity available.');
  }

  return {
    servicesChecked: rows.length,
    serving: serving.length,
    notServing: notServing.map(r => r.service),
    serviceUnknown: unknownService.map(r => r.service),
    byStatus,
    latencyStats,
    deploymentPatterns: patterns,
    liveness: serving.length > 0,
    rows,
    summary: rows.length
      ? `${serving.length}/${rows.length} services SERVING${notServing.length ? `, ${notServing.length} NOT_SERVING` : ''}.`
      : 'No health-check responses to analyze.',
    type: 'gRPC Health Analysis',
    confidence: rows.length ? 'high' : 'low',
  };
}

/** Quick predicate: is the overall (empty-service) health SERVING? */
export function isOverallHealthy(checks = []) {
  const overall = (Array.isArray(checks) ? checks : []).find(c => c && c.service === '');
  return !!overall && normalizeHealthStatus(overall.status) === 'SERVING';
}

export const GRPC_HEALTH_PROBER = {
  HEALTH_STATUSES,
  HEALTH_STATUS_NAMES,
  normalizeHealthStatus,
  analyzeHealthChecks,
  isOverallHealthy,
};
export default GRPC_HEALTH_PROBER;
