/**
 * natsMonitorFingerprint.js — NATS monitoring endpoint detection (idea 00494).
 *
 * Detects NATS server monitoring endpoints (default :8222):
 *  - `/varz` — general server variables (server_id, version, uptime, mem)
 *  - `/connz` — connection details
 *  - `/routez` — cluster routes
 *  - `/jsz` — JetStream account info
 *
 * Offline analyzer: callers supply captured HTTP responses. No network code.
 * Defensive use only — monitoring endpoints often leak topology and should
 * be restricted on authorized targets.
 */

const NATS_MONITOR_PATHS = ['/varz', '/connz', '/routez', '/jsz', '/gatewayz', '/leafz'];

/**
 * Parse a captured NATS `/varz` JSON payload into a normalized summary.
 *
 * @param {string|object} payload raw JSON or parsed object
 * @returns {object} normalized varz or `{ valid: false, reason }`
 */
export function parseNatsVarz(payload) {
  let data = payload;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch {
      return { valid: false, reason: 'payload is not valid JSON' };
    }
  }
  if (!data || typeof data !== 'object' || !data.server_id || !data.version) {
    return { valid: false, reason: 'not a NATS /varz payload' };
  }
  return {
    valid: true,
    serverId: data.server_id,
    serverName: data.server_name || null,
    version: data.version,
    goVersion: data.go || null,
    uptimeSeconds: data.uptime ? parseUptime(data.uptime) : null,
    memBytes: data.mem || null,
    connections: data.connections ?? null,
    routes: data.routes ?? null,
    jetstream: data.jetstream ? { enabled: true, apiLevel: data.jetstream.api_level ?? null } : { enabled: false },
    clusterName: data.cluster?.name || null,
  };
}

/** Parse NATS uptime strings like "12h34m5s" into seconds. */
export function parseUptime(uptime) {
  const m = String(uptime).match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?/);
  if (!m) return null;
  return (parseInt(m[1] || '0', 10) * 3600) + (parseInt(m[2] || '0', 10) * 60) + Math.round(parseFloat(m[3] || '0'));
}

/**
 * Analyze an HTTP response for NATS monitoring evidence.
 *
 * @param {{headers?: object, body?: string, status?: number, path?: string}} response
 * @returns {object} detection verdict
 */
export function analyzeNatsMonitoring(response = {}) {
  const headers = {};
  for (const [k, v] of Object.entries(response.headers || {})) {
    headers[k.toLowerCase()] = String(v);
  }
  const body = String(response.body || '');
  const signals = [];
  const path = String(response.path || '');

  if (NATS_MONITOR_PATHS.some((p) => path === p || path.endsWith(p))) {
    signals.push({ signal: 'monitor_path', detail: path });
  }
  const varz = parseNatsVarz(body);
  if (varz.valid) {
    signals.push({ signal: 'varz_json', detail: `NATS ${varz.version} (${varz.serverName || varz.serverId.slice(0, 8)}…)` });
  }
  if (/nats-server/i.test(headers.server || '')) {
    signals.push({ signal: 'server_header', detail: headers.server.slice(0, 80) });
  }

  const detected = signals.length > 0;
  return {
    detected,
    confidence: varz.valid ? 'high' : detected ? 'medium' : 'none',
    service: 'nats-monitoring',
    varz: varz.valid ? varz : null,
    signals,
    recommendations: detected
      ? [
          'Restrict the NATS monitoring port (:8222) to the management network — /varz exposes topology and version.',
          'Disable or gate /connz; connection details can reveal client identities.',
          'Consider NATS resolver/TLS for the client port (:4222) as well.',
        ]
      : [],
  };
}

export const NATS_MONITOR = {
  idea: '00494',
  defaultPort: 8222,
  monitorPaths: NATS_MONITOR_PATHS,
  parseVarz: parseNatsVarz,
  analyze: analyzeNatsMonitoring,
};

export default NATS_MONITOR;
