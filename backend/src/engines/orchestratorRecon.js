/**
 * orchestratorRecon.js — Orchestrator and service-discovery exposure detectors.
 *
 * Detects anonymously reachable control-plane surfaces:
 *   - Kubernetes API server (unauthenticated version / health endpoints)
 *   - etcd (unauthenticated version endpoint and key-space listing)
 *   - Consul agent HTTP API (datacenter, node and service catalog)
 *
 * Detection is strictly passive: the module parses well-known
 * unauthenticated read endpoints and reports what is reachable. It never
 * writes data, registers services or issues destructive calls.
 */

export const K8S_PATHS = [
  '/version',
  '/healthz',
  '/livez',
  '/readyz',
  '/api',
  '/api/v1',
  '/apis',
  '/openapi/v2',
];

export const K8S_VERSION_PATTERN = /"gitVersion":\s*"v([\d.]+)"/i;
export const K8S_API_SIGNATURES = [
  /"kind":\s*"APIVersions"/i,
  /"kind":\s*"APIResourceList"/i,
  /"major":\s*"1".*"minor":\s*"\d+"/i,
];

export const ETCD_PATHS = ['/version', '/v2/keys', '/v3beta/kv/range'];

export const ETCD_VERSION_PATTERN = /"etcdserver":\s*"([\d.]+)".*"etcdcluster":\s*"([\d.]+)"/i;
export const ETCD_KEYSPACE_PATTERN = /"key":\s*"([A-Za-z0-9+/=]+)"/g;

export const CONSUL_PATHS = [
  '/v1/agent/self',
  '/v1/catalog/datacenters',
  '/v1/catalog/nodes',
  '/v1/catalog/services',
  '/v1/status/leader',
];

export const CONSUL_AGENT_PATTERN = /"Config":\s*{\s*"Datacenter":\s*"([^"]+)"/i;
export const CONSUL_DATACENTER_PATTERN = /\["([a-zA-Z0-9-]+)"(,|\])/;

/**
 * Check whether a Kubernetes API server answers anonymously.
 * @param {{url, status, headers, body, path}} input Response of a K8s API candidate path
 * @returns {{detected, service, version, confidence, severity, evidence, cwe, endpoints}}
 */
export function checkKubernetesApiAnonymous({
  url = '',
  path = '',
  status = 0,
  headers = {},
  body = '',
}) {
  const text = String(body || '');
  if (status === 401 || status === 403) {
    return { detected: false, service: 'Kubernetes API', reason: 'API requires authentication' };
  }
  const version = K8S_VERSION_PATTERN.exec(text);
  const apiHit = K8S_API_SIGNATURES.some(re => re.test(text));
  const detected = status === 200 && (version || apiHit);
  if (!detected) {
    return {
      detected: false,
      service: 'Kubernetes API',
      reason: 'No anonymous Kubernetes API signature in response',
    };
  }
  const paths = path ? [path] : K8S_PATHS;
  return {
    detected: true,
    service: 'Kubernetes API',
    version: version ? version[1] : null,
    confidence: version ? 'high' : 'medium',
    severity: 'Critical',
    cwe: 'CWE-306',
    evidence: `Kubernetes API anonymously reachable at ${url}${version ? ` (v${version[1]})` : ''}. Cluster introspection may be exposed.`,
    endpoints: K8S_PATHS,
  };
}

/**
 * Probe an etcd response for unauthenticated version and key access.
 * @param {{url, status, headers, body}} input Response of an etcd candidate endpoint
 * @returns {{detected, service, version, confidence, severity, evidence, cwe, endpoints}}
 */
export function probeEtcdUnauthenticated({ url = '', status = 0, headers = {}, body = '' }) {
  const text = String(body || '');
  if (status !== 200) {
    return {
      detected: false,
      service: 'etcd',
      reason: `HTTP ${status} — not anonymously readable`,
    };
  }
  const version = ETCD_VERSION_PATTERN.exec(text);
  const keys = [];
  let m;
  ETCD_KEYSPACE_PATTERN.lastIndex = 0;
  while ((m = ETCD_KEYSPACE_PATTERN.exec(text)) && keys.length < 25) {
    try {
      keys.push(Buffer.from(m[1], 'base64').toString('utf8'));
    } catch {
      /* ignore malformed key */
    }
  }
  if (!version && keys.length === 0) {
    return {
      detected: false,
      service: 'etcd',
      reason: 'No etcd version or key-space signature in response',
    };
  }
  return {
    detected: true,
    service: 'etcd',
    version: version ? version[1] : null,
    confidence: keys.length > 0 ? 'high' : 'medium',
    severity: keys.length > 0 ? 'Critical' : 'High',
    cwe: 'CWE-306',
    evidence: `etcd reachable without authentication at ${url}${keys.length ? ` (${keys.length} key(s) listed)` : ''}.`,
    keySample: keys.slice(0, 10),
    endpoints: ETCD_PATHS,
  };
}

/**
 * Parse a Consul agent HTTP API response for datacenter and node data.
 * @param {{url, status, headers, body}} input Response of a Consul API candidate path
 * @returns {{detected, service, version, confidence, severity, evidence, cwe, endpoints}}
 */
export function probeConsulAgent({ url = '', status = 0, headers = {}, body = '' }) {
  const text = String(body || '');
  if (status !== 200) {
    return {
      detected: false,
      service: 'Consul Agent',
      reason: `HTTP ${status} — not anonymously readable`,
    };
  }
  const agent = CONSUL_AGENT_PATTERN.exec(text);
  const datacenters = CONSUL_DATACENTER_PATTERN.exec(text);
  const nodeHint = /"Node":\s*"([^"]+)"|"ID":\s*"([a-f0-9-]{36})"/i.exec(text);
  if (!agent && !datacenters && !nodeHint) {
    return {
      detected: false,
      service: 'Consul Agent',
      reason: 'No Consul agent signature in response',
    };
  }
  return {
    detected: true,
    service: 'Consul Agent',
    version: null,
    confidence: agent ? 'high' : 'medium',
    severity: 'High',
    cwe: 'CWE-200',
    evidence: `Consul agent HTTP API anonymously reachable at ${url}. Datacenter and node data may be readable.`,
    datacenter: agent ? agent[1] : datacenters ? datacenters[1] : null,
    node: nodeHint ? nodeHint[1] || nodeHint[2] : null,
    endpoints: CONSUL_PATHS,
  };
}

/**
 * Run all orchestrator exposure detectors against a response.
 * @param {{url, path, status, headers, body}} input
 * @returns {Array} findings from each detector
 */
export function detectOrchestratorExposure(input) {
  const findings = [];
  for (const fn of [checkKubernetesApiAnonymous, probeEtcdUnauthenticated, probeConsulAgent]) {
    const r = fn(input);
    if (r.detected) findings.push(r);
  }
  return findings;
}

export const ORCHESTRATOR_RECON = {
  checkKubernetesApiAnonymous,
  probeEtcdUnauthenticated,
  probeConsulAgent,
  detectOrchestratorExposure,
  K8S_PATHS,
  ETCD_PATHS,
  CONSUL_PATHS,
};
export default ORCHESTRATOR_RECON;
