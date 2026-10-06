/**
 * prometheusRecon.js — Prometheus metrics-endpoint reconnaissance.
 *
 * Implements idea 00444 (Prometheus metrics-endpoint discovery) and
 * idea 00445 (Prometheus label harvesting):
 * detects exposed Prometheus text-format metrics endpoints and parses the
 * exposition format to harvest labels (hostname, instance, version) plus
 * build-info series that fingerprint the service and its runtime.
 *
 * Read-only response parsing — never fetches or attacks anything itself.
 */

/** Candidate Prometheus metrics paths beyond the conventional /metrics. */
export const METRICS_PATHS = [
  '/metrics',
  '/actuator/prometheus',
  '/api/metrics',
  '/api/v1/metrics',
  '/_metrics',
  '/var/metrics',
  '/prometheus',
  '/debug/metrics',
  '/stats',
  '/monitoring/metrics',
  '/metrics.json',
  '/q/metrics',
  '/management/prometheus',
];

/** Label keys worth harvesting, mapped to what they reveal. */
const INTERESTING_LABELS = {
  instance: 'network identity (host:port)',
  hostname: 'node hostname',
  nodename: 'Kubernetes node name',
  pod: 'Kubernetes pod name',
  namespace: 'Kubernetes namespace',
  container: 'container name',
  service: 'service name',
  app: 'application name',
  version: 'application version',
  release: 'release tag',
  job: 'scrape job name',
  cluster: 'cluster name',
  zone: 'zone / region',
  datacenter: 'datacenter',
  env: 'environment',
  team: 'owning team',
};

/** Well-known build-info metric names that fingerprint runtime + version. */
const BUILD_INFO_METRICS = [
  'go_info',
  'jvm_info',
  'nodejs_version_info',
  'process_runtime_dotnet_info',
  'python_info',
  'rust_info',
  'target_info',
  'prometheus_build_info',
  'kubelet_running_pods',
];

/** Validate that a body looks like Prometheus text exposition format. */
const HELP_RE = /^# HELP (\S+)/m;
const TYPE_RE = /^# TYPE (\S+)/m;
const SAMPLE_RE = /^([a-zA-Z_:][a-zA-Z0-9_:]*)\{([^}]*)\}\s+(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/m;

/**
 * Detect an exposed Prometheus /metrics endpoint from a response.
 * @param {{url, status, headers, body}} input
 */
export function detectPrometheusEndpoint({ url, status = 0, headers = {}, body = '' } = {}) {
  const text = String(body || '');
  const headerMap = {};
  for (const k of Object.keys(headers || {})) headerMap[k.toLowerCase()] = headers[k];
  const contentType = String(headerMap['content-type'] || '');

  const hasHelp = HELP_RE.test(text);
  const hasType = TYPE_RE.test(text);
  const hasSample = SAMPLE_RE.test(text);
  const score = [hasHelp, hasType, hasSample].filter(Boolean).length;
  const contentTypeHint = /text\/plain|openmetrics|prometheus/i.test(contentType);
  const detected = status >= 200 && status < 400 && (score >= 2 || (score >= 1 && contentTypeHint));

  return {
    detected,
    idea: '00444',
    url,
    status,
    expositionScore: score,
    contentTypeHint,
    confidence: score >= 3 ? 'high' : score === 2 ? 'medium' : 'low',
    severity: detected ? 'Low' : 'Info',
    cwe: 'CWE-200',
    evidence: detected
      ? `Exposed Prometheus exposition format at ${url} (# HELP / # TYPE / labelled samples present).`
      : `Not a Prometheus metrics endpoint (exposition score ${score}/3, HTTP ${status}).`,
  };
}

/**
 * Parse one Prometheus exposition body and harvest labels + build info.
 * @param {{url, body}} input
 */
export function harvestPrometheusLabels({ url, body = '' } = {}) {
  const text = String(body || '');
  const labelFindings = [];
  const seenLabels = new Set();
  const buildInfo = [];

  const lineRe = /^([a-zA-Z_:][a-zA-Z0-9_:]*)\{([^}]*)\}/gm;
  let match;
  let sampleCount = 0;
  while ((match = lineRe.exec(text)) !== null && sampleCount < 5000) {
    sampleCount += 1;
    const metric = match[1];
    const labelStr = match[2];

    if (BUILD_INFO_METRICS.some((b) => metric === b || metric.endsWith(`_${b}`) || b.endsWith(metric))) {
      buildInfo.push({ metric, labels: parseLabelBlock(labelStr) });
    }

    for (const pair of splitLabels(labelStr)) {
      const [key, value] = pair;
      if (Object.prototype.hasOwnProperty.call(INTERESTING_LABELS, key) && value) {
        const seenKey = `${key}=${value}`;
        if (!seenLabels.has(seenKey)) {
          seenLabels.add(seenKey);
          labelFindings.push({
            metric,
            label: key,
            value: redactSensitiveValue(key, value),
            reveals: INTERESTING_LABELS[key],
          });
        }
      }
    }
  }

  return {
    detected: labelFindings.length > 0 || buildInfo.length > 0,
    idea: '00445',
    url,
    samplesParsed: sampleCount,
    labels: labelFindings.slice(0, 100),
    buildInfo: buildInfo.slice(0, 25),
    confidence: labelFindings.length > 0 ? 'high' : 'low',
    severity: labelFindings.length > 0 ? 'Low' : 'Info',
    cwe: 'CWE-200',
    evidence:
      labelFindings.length > 0
        ? `Harvested ${labelFindings.length} interesting label value(s) from ${sampleCount} metric samples.`
        : `No interesting labels found in ${sampleCount} metric samples.`,
  };
}

/** Parse a label block like `a="1",b="x"` into an object (handles escaped quotes). */
function parseLabelBlock(block) {
  const out = {};
  for (const [k, v] of splitLabels(block)) out[k] = v;
  return out;
}

/** Split a label block on commas that are not inside quotes. */
function splitLabels(block) {
  const pairs = [];
  let current = '';
  let inQuotes = false;
  let escaped = false;
  for (const ch of block) {
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      current += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      pairs.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) pairs.push(current.trim());
  return pairs
    .map((p) => {
      const eq = p.indexOf('=');
      if (eq === -1) return null;
      const key = p.slice(0, eq).trim();
      let value = p.slice(eq + 1).trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
      }
      return [key, value];
    })
    .filter(Boolean);
}

/**
 * Redact values that might be sensitive while preserving the metadata signal.
 * Label values here are infrastructure metadata, but masking keeps the
 * defensive framing strict: findings describe WHAT is exposed, not secrets.
 */
function redactSensitiveValue(key, value) {
  if (/token|secret|password|key|credential|auth/i.test(key)) return '[redacted]';
  return value;
}

export const PROMETHEUS_RECON = {
  detectPrometheusEndpoint,
  harvestPrometheusLabels,
  METRICS_PATHS,
};
export default PROMETHEUS_RECON;
