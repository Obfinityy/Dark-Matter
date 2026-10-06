/**
 * observabilityRecon.js — Observability / monitoring stack fingerprinting engines.
 *
 * Implements idea-bank ideas 00477-00480: passive detection and version
 * fingerprinting of exposed observability UIs (Kibana + Elasticsearch,
 * Grafana, Prometheus, Zabbix) from plain HTTP responses. Every detector is a
 * pure function over already-fetched response data — no probing, no payloads,
 * detection only.
 *
 * Input shape:  { url, status, headers, body }
 * Output shape: { detected, service, version, confidence, severity, evidence, cwe }
 */

const STR = (v) => (typeof v === 'string' ? v : '');

function getHeader(headers = {}, name) {
  const entries = Object.entries(headers);
  for (const [k, v] of entries) {
    if (k.toLowerCase() === name.toLowerCase()) return Array.isArray(v) ? v.join('; ') : String(v);
  }
  return '';
}

/** Safe JSON parse: returns null instead of throwing on malformed bodies. */
function tryParseJson(text) {
  try {
    return JSON.parse(STR(text));
  } catch {
    return null;
  }
}

/**
 * Well-known paths worth fetching (defensively, GET only) when fingerprinting
 * observability stacks. Listed for the caller's crawler — this module never
 * performs network requests itself.
 */
export const OBSERVABILITY_PROBE_PATHS = {
  kibana: ['/api/status', '/app/home', '/login'],
  elasticsearch: ['/', '/_cluster/health'],
  grafana: ['/login', '/api/health', '/api/frontend/settings'],
  prometheus: ['/api/v1/status/buildinfo', '/-/healthy', '/api/v1/query'],
  zabbix: ['/index.php', '/zabbix/index.php'],
};

/**
 * Signature table for idea 00477 — Kibana detection and its Elasticsearch
 * correlation. Kibana exposes /api/status (JSON with versions); Elasticsearch
 * exposes / (JSON with version + cluster name).
 */
const KIBANA_SIGNATURES = [
  { type: 'api', pattern: /"name"\s*:\s*"Kibana"/i, weight: 3 },
  { type: 'api', pattern: /"kbnName"|"kbnVersion"/i, weight: 3 },
  { type: 'text', pattern: /<title>[^<]*Elastic/i, weight: 2 },
  { type: 'text', pattern: /kibana/i, weight: 1 },
  { type: 'header', pattern: /kbn-(?:name|version|license-sig)/i, weight: 2 },
];

/**
 * Detect Kibana and correlate it with its backing Elasticsearch cluster (idea 00477).
 * Pass the Kibana /api/status response as input; optionally pass an
 * Elasticsearch root response as `esResponse` for cross-correlation.
 * @param {{url, status, headers, body, esResponse?}} input
 */
export function fingerprintKibana({ url = '', status = 0, headers = {}, body = '', esResponse = null }) {
  const text = STR(body);
  let score = 0;
  const hits = [];
  for (const sig of KIBANA_SIGNATURES) {
    const haystack = sig.type === 'header' ? getHeader(headers, 'kbn-name') + ' ' + getHeader(headers, 'kbn-version') : text;
    if (sig.pattern.test(haystack)) {
      score += sig.weight;
      hits.push(sig.type);
    }
  }
  if (score < 2) {
    return { detected: false, service: 'Kibana', version: null, confidence: 'none', severity: 'None', evidence: 'No Kibana signatures matched.', cwe: null };
  }
  const data = tryParseJson(text);
  const kibanaVersion = data?.version?.number || data?.metrics?.status?.version || (text.match(/"version"\s*:\s*\{\s*"number"\s*:\s*"([\d.]+)"/i) || [])[1] || null;
  const jsonVersion = !!(data && data.version && data.version.number);
  // Cross-correlate with the backing Elasticsearch cluster (idea 00477).
  let esInfo = null;
  if (esResponse) {
    const esData = tryParseJson(esResponse.body);
    if (esData && esData.version && esData.version.number) {
      esInfo = {
        url: esResponse.url || '',
        version: String(esData.version.number),
        clusterName: esData.cluster_name || null,
        tagline: esData.tagline || null,
      };
    }
  }
  const matchNote = kibanaVersion && esInfo && kibanaVersion !== esInfo.version
    ? ` Version mismatch: Kibana ${kibanaVersion} vs Elasticsearch ${esInfo.version} — may indicate mixed-version exposure.`
    : '';
  return {
    detected: true,
    service: 'Kibana',
    version: kibanaVersion,
    confidence: jsonVersion || score >= 5 ? 'high' : 'medium',
    severity: 'Medium',
    severityReason: 'Exposed Kibana often leads to the underlying Elasticsearch cluster and its indexed data.',
    evidence: `Kibana signatures matched (${hits.join(', ')}) on ${url} [HTTP ${status}]${kibanaVersion ? `; Kibana version ${kibanaVersion}` : ''}${esInfo ? `; correlated Elasticsearch ${esInfo.version} (cluster "${esInfo.clusterName}") at ${esInfo.url}` : ''}.${matchNote}`,
    cwe: 'CWE-200',
    correlated: esInfo,
  };
}

/**
 * Detect an Elasticsearch node root response (companion for idea 00477).
 * @param {{url, status, headers, body}} input
 */
export function fingerprintElasticsearch({ url = '', status = 0, headers = {}, body = '' }) {
  const text = STR(body);
  const data = tryParseJson(text);
  const isEs = data && typeof data === 'object' && data.version && typeof data.version.number === 'string' && /You Know, for Search/.test(STR(data.tagline));
  if (!isEs) {
    return { detected: false, service: 'Elasticsearch', version: null, confidence: 'none', severity: 'None', evidence: 'Response is not an Elasticsearch node root document.', cwe: null };
  }
  const hasProductHeader = /Elasticsearch/i.test(getHeader(headers, 'x-elastic-product'));
  return {
    detected: true,
    service: 'Elasticsearch',
    version: String(data.version.number),
    confidence: hasProductHeader ? 'high' : 'medium',
    severity: 'Medium',
    severityReason: 'Exposed Elasticsearch node root leaks version and cluster name; unauthenticated clusters may allow full data access.',
    evidence: `Elasticsearch node root matched on ${url} [HTTP ${status}]: version ${data.version.number}, cluster "${data.cluster_name || 'unknown'}".`,
    cwe: 'CWE-200',
  };
}

/**
 * Signature table for idea 00478 — Grafana version fingerprinting via
 * frontend asset hashes and the /api/health API.
 */
const GRAFANA_SIGNATURES = [
  { type: 'asset', pattern: /public\/build\/[\w.-]+\.[a-f0-9]{8,}\.js/i, weight: 3 },
  { type: 'api', pattern: /"database"\s*:\s*"(?:ok|sqlite|postgres|mysql)"/i, weight: 3 },
  { type: 'text', pattern: /grafanaBootData/i, weight: 3 },
  { type: 'title', pattern: /<title>\s*Grafana\s*<\/title>/i, weight: 2 },
  { type: 'text', pattern: /grafana/i, weight: 1 },
];

/**
 * Fingerprint Grafana by frontend asset hashes and its health API (idea 00478).
 * Feed the /api/health JSON as body for exact version, or the /login HTML for
 * asset-hash based identification.
 * @param {{url, status, headers, body}} input
 */
export function fingerprintGrafana({ url = '', status = 0, headers = {}, body = '' }) {
  const text = STR(body);
  let score = 0;
  const hits = [];
  for (const sig of GRAFANA_SIGNATURES) {
    if (sig.pattern.test(text)) {
      score += sig.weight;
      hits.push(sig.type);
    }
  }
  if (score < 2) {
    return { detected: false, service: 'Grafana', version: null, confidence: 'none', severity: 'None', evidence: 'No Grafana signatures matched.', cwe: null };
  }
  // Prefer the /api/health JSON version; fall back to boot-data JSON embedded in /login.
  const data = tryParseJson(text);
  let version = data && typeof data.version === 'string' ? data.version : null;
  if (!version) {
    const m = text.match(/"version"\s*:\s*"([\d.]+)"/i);
    if (m) version = m[1];
  }
  const assetHashes = [...text.matchAll(/public\/build\/[\w.-]+\.([a-f0-9]{8,})\.js/gi)].map((m) => m[1]).slice(0, 5);
  // An exact version parsed from JSON is stronger than any heuristic count.
  const confidence = version && data ? 'high' : score >= 6 ? 'high' : 'medium';
  return {
    detected: true,
    service: 'Grafana',
    version,
    confidence,
    severity: 'Medium',
    severityReason: 'Exposed Grafana may allow anonymous dashboards, data-source probing, and version-specific exploits.',
    evidence: `Grafana signatures matched (${hits.join(', ')}) on ${url} [HTTP ${status}]${version ? `; version ${version}` : ''}${assetHashes.length ? `; frontend asset hashes [${assetHashes.join(', ')}]` : ''}.`,
    cwe: 'CWE-200',
  };
}

/**
 * Signature table for idea 00479 — Prometheus UI detection via its query API shape.
 */
const PROMETHEUS_SIGNATURES = [
  { type: 'api', pattern: /"resultType"\s*:\s*"(?:matrix|vector|scalar|string)"/i, weight: 3 },
  { type: 'api', pattern: /"status"\s*:\s*"(?:success|error)"\s*,\s*"data"/i, weight: 3 },
  { type: 'title', pattern: /Prometheus Time Series Collection/i, weight: 3 },
  { type: 'api', pattern: /"version"\s*:\s*"\d+\.\d+\.\d+"/i, weight: 1 },
  { type: 'text', pattern: /prometheus/i, weight: 1 },
];

/**
 * Detect Prometheus UIs by their query API response shape (idea 00479).
 * Feed /api/v1/query, /api/v1/status/buildinfo, or the / UI HTML as body.
 * @param {{url, status, headers, body}} input
 */
export function detectPrometheus({ url = '', status = 0, headers = {}, body = '' }) {
  const text = STR(body);
  let score = 0;
  const hits = [];
  for (const sig of PROMETHEUS_SIGNATURES) {
    if (sig.pattern.test(text)) {
      score += sig.weight;
      hits.push(sig.type);
    }
  }
  if (score < 2) {
    return { detected: false, service: 'Prometheus', version: null, confidence: 'none', severity: 'None', evidence: 'No Prometheus signatures matched.', cwe: null };
  }
  // /api/v1/status/buildinfo carries the exact version.
  const data = tryParseJson(text);
  let version = data?.data?.version || null;
  if (!version) {
    const m = text.match(/"version"\s*:\s*"(\d+\.\d+\.\d+)"/i);
    if (m) version = m[1];
  }
  return {
    detected: true,
    service: 'Prometheus',
    version,
    confidence: score >= 6 ? 'high' : 'medium',
    severity: 'Medium',
    severityReason: 'Exposed Prometheus query API leaks infrastructure metrics and may allow arbitrary PromQL execution.',
    evidence: `Prometheus query-API shape matched (${hits.join(', ')}) on ${url} [HTTP ${status}]${version ? `; version ${version}` : ''}.`,
    cwe: 'CWE-200',
  };
}

/**
 * Signature table for idea 00480 — Zabbix frontend detection by login page signatures.
 */
const ZABBIX_SIGNATURES = [
  { type: 'form', pattern: /name="name"[^>]*placeholder="(?:Username|User name)/i, weight: 2 },
  { type: 'form', pattern: /name="autologin"/i, weight: 3 },
  { type: 'text', pattern: /<title>[^<]*Zabbix[^<]*<\/title>/i, weight: 3 },
  { type: 'text', pattern: /Zabbix SIA|zabbix\.com/i, weight: 2 },
  { type: 'cookie', pattern: /zbx_session/i, weight: 3 },
];

/**
 * Detect Zabbix frontends by login page signatures (idea 00480).
 * @param {{url, status, headers, body}} input
 */
export function detectZabbix({ url = '', status = 0, headers = {}, body = '' }) {
  const text = STR(body);
  const cookie = getHeader(headers, 'set-cookie');
  let score = 0;
  const hits = [];
  for (const sig of ZABBIX_SIGNATURES) {
    const haystack = sig.type === 'cookie' ? cookie : text;
    if (sig.pattern.test(haystack)) {
      score += sig.weight;
      hits.push(sig.type);
    }
  }
  if (score < 2) {
    return { detected: false, service: 'Zabbix', version: null, confidence: 'none', severity: 'None', evidence: 'No Zabbix signatures matched.', cwe: null };
  }
  const version = (text.match(/Zabbix\s+([\d.]+)/i) || [])[1] || null;
  return {
    detected: true,
    service: 'Zabbix',
    version,
    confidence: score >= 6 ? 'high' : 'medium',
    severity: 'Medium',
    severityReason: 'Exposed Zabbix frontend grants monitoring-system access; Zabbix frontends have a history of critical auth bypass flaws.',
    evidence: `Zabbix login signatures matched (${hits.join(', ')}) on ${url} [HTTP ${status}]${version ? `; version ${version} extracted` : ''}.`,
    cwe: 'CWE-200',
  };
}

/** All observability detectors in evaluation order. */
export const OBSERVABILITY_DETECTORS = [
  fingerprintKibana,
  fingerprintElasticsearch,
  fingerprintGrafana,
  detectPrometheus,
  detectZabbix,
];

/**
 * Run every observability detector over a list of fetched responses and
 * return all positive findings.
 * @param {Array<{url, status, headers, body}>} responses
 */
export function scanObservabilityUIs(responses = []) {
  const findings = [];
  for (const response of responses || []) {
    for (const detector of OBSERVABILITY_DETECTORS) {
      const result = detector(response || {});
      if (result.detected) findings.push(result);
    }
  }
  return findings;
}

export const OBSERVABILITY_RECON = {
  OBSERVABILITY_PROBE_PATHS,
  fingerprintKibana,
  fingerprintElasticsearch,
  fingerprintGrafana,
  detectPrometheus,
  detectZabbix,
  scanObservabilityUIs,
  OBSERVABILITY_DETECTORS,
};
export default OBSERVABILITY_RECON;
