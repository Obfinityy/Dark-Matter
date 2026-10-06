/**
 * serverStatusRecon.js — Web server status-page detectors.
 *
 * Detects publicly exposed server diagnostic endpoints:
 *   - Apache mod_status (server-status)
 *   - nginx ngx_http_stub_status_module (stub_status)
 *
 * These endpoints leak worker slot states, active request lines and
 * uptime statistics. Detection is passive: the module fingerprints a
 * response by its characteristic body markers and headers.
 */

export const APACHE_STATUS_PATHS = [
  '/server-status',
  '/server-status?auto',
  '/status',
];

export const APACHE_STATUS_SIGNATURES = [
  /Apache Status/i,
  /Apache Server Status/i,
  /requests currently being processed/i,
  /idle workers/i,
  /Scoreboard Key/i,
  /Parent Server Generation/i,
  /Total accesses/i,
  /CPU Usage/i,
];

export const NGINX_STATUS_PATHS = [
  '/nginx_status',
  '/nginx-status',
  '/status',
  '/basic_status',
];

export const NGINX_STATUS_SIGNATURES = [
  /Active connections:/i,
  /server accepts handled requests/i,
  /Reading:\s*\d+\s*Writing:\s*\d+\s*Waiting:\s*\d+/i,
];

export const NGINX_STATUS_METRIC_PATTERN = /Active connections:\s*(\d+)\s*\nserver accepts handled requests\s*\n\s*(\d+)\s+(\d+)\s+(\d+)\s*\nReading:\s*(\d+)\s*Writing:\s*(\d+)\s*Waiting:\s*(\d+)/i;

/**
 * Analyse a response for an exposed Apache server-status page.
 * @param {{url, status, headers, body}} input
 * @returns {{detected, service, version, confidence, severity, evidence, cwe, endpoints}}
 */
export function detectApacheServerStatus({ url = '', status = 0, headers = {}, body = '' }) {
  const text = String(body || '');
  const matched = APACHE_STATUS_SIGNATURES.filter((re) => re.test(text));
  const serverHeader = String(headers['server'] || headers['Server'] || '');
  const apacheHeader = /apache/i.test(serverHeader);
  const autoFormat = /Total accesses:\s*\d+/i.test(text) && /BusyWorkers:\s*\d+/i.test(text);
  const detected = status === 200 && (matched.length >= 2 || (autoFormat && apacheHeader));
  if (!detected) {
    return { detected: false, service: 'Apache mod_status', reason: 'No server-status signature in response' };
  }
  const serverVersion = /<address>Apache\/([\d.]+)/i.exec(text);
  return {
    detected: true,
    service: 'Apache mod_status',
    version: serverVersion ? serverVersion[1] : null,
    confidence: matched.length >= 3 ? 'high' : 'medium',
    severity: 'Medium',
    cwe: 'CWE-200',
    evidence: `Exposed Apache server-status page at ${url}. Worker and request data visible.`,
    format: autoFormat ? 'auto' : 'html',
    endpoints: APACHE_STATUS_PATHS,
  };
}

/**
 * Analyse a response for an exposed nginx stub_status endpoint.
 * @param {{url, status, headers, body}} input
 * @returns {{detected, service, version, confidence, severity, evidence, cwe, metrics}}
 */
export function detectNginxStubStatus({ url = '', status = 0, headers = {}, body = '' }) {
  const text = String(body || '');
  const m = NGINX_STATUS_METRIC_PATTERN.exec(text);
  if (!(status === 200 && m)) {
    return { detected: false, service: 'nginx stub_status', reason: 'No stub_status signature in response' };
  }
  const serverHeader = String(headers['server'] || headers['Server'] || '');
  const version = /nginx\/([\d.]+)/i.exec(serverHeader);
  return {
    detected: true,
    service: 'nginx stub_status',
    version: version ? version[1] : null,
    confidence: 'high',
    severity: 'Low',
    cwe: 'CWE-200',
    evidence: `Exposed nginx stub_status endpoint at ${url}. Connection counters are readable.`,
    metrics: {
      activeConnections: Number(m[1]),
      accepts: Number(m[2]),
      handled: Number(m[3]),
      requests: Number(m[4]),
      reading: Number(m[5]),
      writing: Number(m[6]),
      waiting: Number(m[7]),
    },
    endpoints: NGINX_STATUS_PATHS,
  };
}

/**
 * Run all server status-page detectors against a response.
 * @param {{url, status, headers, body}} input
 * @returns {Array} findings from each detector
 */
export function detectServerStatusExposure(input) {
  const findings = [];
  for (const fn of [detectApacheServerStatus, detectNginxStubStatus]) {
    const r = fn(input);
    if (r.detected) findings.push(r);
  }
  return findings;
}

export const SERVER_STATUS_RECON = {
  detectApacheServerStatus,
  detectNginxStubStatus,
  detectServerStatusExposure,
  APACHE_STATUS_PATHS,
  APACHE_STATUS_SIGNATURES,
  NGINX_STATUS_PATHS,
  NGINX_STATUS_SIGNATURES,
};
export default SERVER_STATUS_RECON;
