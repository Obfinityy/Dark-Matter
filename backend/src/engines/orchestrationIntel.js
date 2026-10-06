/**
 * orchestrationIntel.js — Kubernetes and container-registry exposure intelligence.
 *
 * Implements ideas 587–590:
 *
 *   587 — Kubernetes kubelet probing: classify kubelet read-only port
 *           responses for pod listings.
 *   588 — Kubernetes API version disclosure: parse /version responses for
 *           version/vendor fingerprinting.
 *   589 — Docker Registry v2 catalog: parse registry catalog responses for
 *           image listings.
 *   590 — Container image-layer analysis: analyze image configs for embedded
 *           hostnames and secret references (redacted logging — never the
 *           values themselves).
 *
 * Defensive framing: pure classifiers over data already observed during an
 * authorized hunt (HTTP responses, registry JSON, OCI image configs). No live
 * cluster actions are performed here; anything sensitive is flagged, never
 * extracted or logged.
 */

const KUBELET_PORTS = {
  10255: { role: 'read-only', secure: false },
  10250: { role: 'api', secure: true },
  10248: { role: 'healthz', secure: false },
};

const K8S_RESPONSE_CLASSES = [
  {
    name: 'kubelet-pod-list',
    description: 'Kubelet read-only port returned a pod listing (PodList shape).',
    match: (json) => json && json.kind === 'PodList' && Array.isArray(json.items),
    severity: 'High',
  },
  {
    name: 'kubelet-pods-endpoint',
    description: 'Kubelet /pods returned per-pod status entries.',
    match: (json, port) => Number(port) === 10255 && json && json.kind === 'PodList',
    severity: 'High',
  },
  {
    name: 'kubelet-metrics',
    description: 'Kubelet /metrics exposed Prometheus metrics.',
    match: (text) => typeof text === 'string' && /^kubelet_running_containers/m.test(text),
    severity: 'Medium',
  },
  {
    name: 'kubelet-forbidden',
    description: 'Kubelet refused the read-only request (expected on secured clusters).',
    match: (text, port, status) => status === 401 || status === 403 || status === 404,
    severity: 'None',
  },
];

const K8S_VENDOR_HINTS = [
  { vendor: 'EKS', pattern: /eks/i },
  { vendor: 'GKE', pattern: /gke/i },
  { vendor: 'AKS', pattern: /aks/i },
  { vendor: 'K3s', pattern: /k3s/i },
  { vendor: 'RKE/RKE2', pattern: /rke/i },
  { vendor: 'OpenShift', pattern: /openshift/i },
  { vendor: 'MicroK8s', pattern: /microk8s/i },
];

const REGISTRY_ERROR_CODES = ['UNAUTHORIZED', 'DENIED', 'NAME_UNKNOWN'];

const HOSTNAME_PATTERN = /\b(?:[a-zA-Z0-9-]{1,63}\.)+(?:[a-zA-Z]{2,}|internal|local|lan|corp)\b/g;

const SECRET_REF_PATTERNS = [
  { name: 'api-key-ref', pattern: /(api[_-]?key|apikey)\s*[:=]\s*\S+/i },
  { name: 'token-ref', pattern: /\b(token|bearer)\s*[:=]\s*\S+/i },
  { name: 'password-ref', pattern: /\b(password|passwd|pwd)\s*[:=]\s*\S+/i },
  { name: 'private-key-ref', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'secret-env-ref', pattern: /\b(secret|credential)s?\s*[:=]\s*\S+/i },
];

const SECRET_NAME_PATTERN = /(api[_-]?key|token|password|passwd|pwd|secret|credential|private[_-]?key|auth)/i;

/**
 * Classify a kubelet probe response (idea 587).
 * @param {{ port?: number, statusCode?: number, body?: string }} input
 * @returns {{ exposed: boolean, classification: string, severity: string, detail }}
 */
export function probeKubelet({ port = 0, statusCode = 0, body = '' } = {}) {
  const portInfo = KUBELET_PORTS[Number(port)] || { role: 'unknown', secure: false };
  let json = null;
  try {
    json = JSON.parse(String(body));
  } catch {
    json = null;
  }
  for (const cls of K8S_RESPONSE_CLASSES) {
    if (cls.match(json, Number(port), Number(statusCode))) {
      return {
        exposed: cls.severity !== 'None',
        classification: cls.name,
        severity: cls.severity,
        detail: cls.description,
        port,
        portRole: portInfo.role,
      };
    }
    if (json === null && cls.match(String(body), Number(port), Number(statusCode))) {
      return {
        exposed: cls.severity !== 'None',
        classification: cls.name,
        severity: cls.severity,
        detail: cls.description,
        port,
        portRole: portInfo.role,
      };
    }
  }
  return {
    exposed: false,
    classification: 'no-kubelet-signature',
    severity: 'None',
    detail: 'Response did not match any kubelet exposure signature.',
    port,
    portRole: portInfo.role,
  };
}

/**
 * Fingerprint a Kubernetes API server from its /version response (idea 588).
 * @param {{ statusCode?: number, body?: string }} input
 * @returns {{ detected: boolean, version?: string, major?: string, minor?: string, vendor?: string, platform?: string }}
 */
export function fingerprintK8sApi({ statusCode = 0, body = '' } = {}) {
  let json = null;
  try {
    json = JSON.parse(String(body));
  } catch {
    return { detected: false, reason: 'Not valid JSON.' };
  }
  const gitVersion = json?.gitVersion;
  if (typeof gitVersion !== 'string' || !gitVersion) {
    return { detected: false, reason: 'No gitVersion field — not a K8s /version response.' };
  }
  const versionMatch = gitVersion.match(/v(\d+)\.(\d+)/);
  let vendor = null;
  for (const hint of K8S_VENDOR_HINTS) {
    if (hint.pattern.test(gitVersion) || hint.pattern.test(String(json?.platform || ''))) {
      vendor = hint.vendor;
      break;
    }
  }
  return {
    detected: true,
    version: gitVersion,
    major: versionMatch ? versionMatch[1] : undefined,
    minor: versionMatch ? versionMatch[2] : undefined,
    platform: json?.platform || undefined,
    vendor,
    statusCode,
  };
}

/**
 * Parse a Docker Registry v2 catalog response (idea 589).
 * @param {{ statusCode?: number, body?: string }} input
 * @returns {{ accessible: boolean, repositories: string[], total: number, classification }}
 */
export function queryRegistryCatalog({ statusCode = 0, body = '' } = {}) {
  let json = null;
  try {
    json = JSON.parse(String(body));
  } catch {
    return {
      accessible: false,
      repositories: [],
      total: 0,
      classification: 'not-json',
      reason: 'Catalog response was not valid JSON.',
    };
  }
  if (Array.isArray(json?.repositories)) {
    const repos = json.repositories.map(String).slice(0, 5000);
    return {
      accessible: true,
      repositories: repos,
      total: repos.length,
      classification: 'catalog-public',
    };
  }
  const errors = Array.isArray(json?.errors) ? json.errors : [];
  const code = String(errors[0]?.code || '').toUpperCase();
  if (REGISTRY_ERROR_CODES.includes(code)) {
    return {
      accessible: false,
      repositories: [],
      total: 0,
      classification: code === 'UNAUTHORIZED' ? 'auth-required' : 'catalog-denied',
      reason: `Registry refused the catalog request (${code}).`,
    };
  }
  return {
    accessible: false,
    repositories: [],
    total: 0,
    classification: 'unexpected-shape',
    reason: 'Response did not look like a Docker Registry v2 catalog.',
  };
}

/**
 * Analyze a container image config for embedded hostnames and secret
 * references (idea 590). Values are redacted — only flags are returned.
 * @param {{ configJson?: string|object }} input
 * @returns {{ hostnames: string[], secretRefs: string[], baseImage?: string, labels: Record<string,string> }}
 */
export function analyzeImageLayers({ configJson = '{}' } = {}) {
  let config = configJson;
  if (typeof config === 'string') {
    try {
      config = JSON.parse(config);
    } catch {
      return { hostnames: [], secretRefs: [], labels: {}, reason: 'Not valid JSON.' };
    }
  }
  if (!config || typeof config !== 'object') {
    return { hostnames: [], secretRefs: [], labels: {}, reason: 'Not an object config.' };
  }

  const serialized = JSON.stringify(config);
  const hostnames = new Set();
  const secretRefs = new Set();

  for (const match of serialized.matchAll(HOSTNAME_PATTERN)) {
    const host = match[0].toLowerCase();
    if (/(internal|local|lan|corp|svc|cluster\.local)$/.test(host) || host.includes('internal')) {
      hostnames.add(host);
    } else if (host.split('.').length >= 2) {
      hostnames.add(host);
    }
  }

  for (const sig of SECRET_REF_PATTERNS) {
    sig.pattern.lastIndex = 0;
    if (sig.pattern.test(serialized)) secretRefs.add(sig.name);
  }

  const env = config?.config?.Env;
  if (Array.isArray(env)) {
    for (const entry of env) {
      const eq = String(entry).indexOf('=');
      const key = eq > 0 ? String(entry).slice(0, eq) : String(entry);
      if (SECRET_NAME_PATTERN.test(key)) {
        secretRefs.add('env-secret-name');
        break;
      }
    }
  }

  const labels = {};
  if (config?.config?.Labels && typeof config.config.Labels === 'object') {
    for (const [k, v] of Object.entries(config.config.Labels)) {
      labels[String(k)] = SECRET_NAME_PATTERN.test(String(k))
        ? '[REDACTED]'
        : String(v).slice(0, 200);
    }
  }

  const history = config?.history;
  const baseImage =
    Array.isArray(history) && history.length > 0
      ? extractBaseImageFromHistory(history)
      : undefined;

  return {
    hostnames: [...hostnames].slice(0, 200),
    secretRefs: [...secretRefs],
    baseImage,
    labels,
    note: secretRefs.length > 0
      ? 'Secret references detected. Values are NEVER included in output — flag for remediation.'
      : undefined,
  };
}

/**
 * Heuristic: earliest non-empty history entry's created_by hints at the base image.
 * @param {Array} history
 * @returns {string|undefined}
 */
function extractBaseImageFromHistory(history = []) {
  for (const entry of history) {
    const createdBy = String(entry?.created_by || '');
    const m = createdBy.match(/FROM\s+([^\s|&;]+)/i);
    if (m) return m[1];
  }
  return undefined;
}

export const ORCHESTRATION_INTEL = {
  KUBELET_PORTS,
  probeKubelet,
  fingerprintK8sApi,
  queryRegistryCatalog,
  analyzeImageLayers,
};

export default ORCHESTRATION_INTEL;
