/**
 * meshConfigMiner.js — service-mesh sidecar config leak miner.
 *
 * Analyzes HTTP responses from exposed Envoy / Istio admin and config-dump
 * endpoints (e.g. /server_info, /stats, /clusters, /listeners, /config_dump)
 * and extracts:
 *  - which mesh/proxy software is exposed and its version
 *  - every upstream host / cluster address listed in config dumps
 *  - listener addresses that reveal the internal topology
 *
 * Pure analysis: the caller supplies fetched response metadata and bodies.
 * Never fetches anything itself.
 *
 * Defensive use: authorized exposure review — an Envoy admin interface
 * reachable from the internet leaks the full upstream topology, which a
 * security review must know about.
 */

const KNOWN_ADMIN_PATHS = [
  '/server_info',
  '/config_dump',
  '/stats',
  '/clusters',
  '/listeners',
  '/routes',
  '/certs',
  '/ready',
];

/**
 * Identify mesh/proxy software from response headers and body markers.
 *
 * @param {{ headers?: object, body?: string }} input
 * @returns {{ software: string, version: string|null, confidence: string, indicators: string[] }}
 */
export function identifyMesh({ headers = {}, body = '' } = {}) {
  const h = {};
  for (const [k, v] of Object.entries(headers || {})) h[k.toLowerCase()] = String(v);
  const text = String(body || '');
  const indicators = [];
  let software = 'unknown';
  let version = null;
  let confidence = 'low';

  const serverHdr = h['server'] || '';
  if (/envoy/i.test(serverHdr)) {
    software = 'envoy';
    indicators.push(`Server header: ${serverHdr}`);
    confidence = 'high';
  }
  if (
    /istio/i.test(h['x-envoy-upstream-service-time'] ?? '') ||
    /istio/i.test(text.slice(0, 2000))
  ) {
    indicators.push('Istio markers present');
  }
  const versionMatch =
    text.match(/"version"\s*:\s*"([^"]+)"/) || serverHdr.match(/envoy\/([\d.]+)/i);
  if (versionMatch) {
    version = versionMatch[1];
    indicators.push(`version: ${version}`);
  }
  if (/"node"\s*:\s*\{[^}]*"id"\s*:\s*"([^"]+)"/.test(text)) {
    software = 'envoy';
    indicators.push('Envoy config_dump node block present');
    confidence = 'high';
  }
  if (/^envoy/i.test(text.trim()) || /ENVOY/i.test(h['x-envoy-upstream-service-time'] ?? '')) {
    indicators.push('Envoy operational headers');
  }

  return { software, version, confidence, indicators };
}

/**
 * Extract upstream host addresses from an Envoy config_dump JSON body.
 *
 * @param {string} body - Raw config_dump response text.
 * @returns {{ cluster: string, address: string, port: number|null }[]}
 */
export function extractUpstreamHosts(body) {
  const out = [];
  const seen = new Set();
  const text = String(body || '');
  // Match static cluster endpoints: "address": "10.0.0.5", "port_value": 8080
  const endpointRe = /"address"\s*:\s*"([^"]+)"\s*,\s*"port_value"\s*:\s*(\d+)/g;
  let m;
  endpointRe.lastIndex = 0;
  while ((m = endpointRe.exec(text)) !== null) {
    const key = `${m[1]}:${m[2]}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ cluster: '(static endpoint)', address: m[1], port: Number(m[2]) });
    }
  }
  // Match named clusters with hosts: "name": "outbound|8080||svc.cluster.local"
  const clusterRe = /"name"\s*:\s*"((?:outbound|inbound)[^"]*)"/g;
  clusterRe.lastIndex = 0;
  while ((m = clusterRe.exec(text)) !== null) {
    const key = `cluster:${m[1]}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ cluster: m[1], address: '', port: null });
    }
  }
  return out;
}

/**
 * Extract listener addresses from a config_dump or /listeners body.
 *
 * @param {string} body - Raw response text.
 * @returns {{ name: string, address: string, port: number|null }[]}
 */
export function extractListenerAddresses(body) {
  const out = [];
  const seen = new Set();
  const text = String(body || '');
  const re =
    /"name"\s*:\s*"([^"]+)"[\s\S]{0,400}?"address"\s*:\s*"([^"]+)"\s*,\s*"port_value"\s*:\s*(\d+)/g;
  let m;
  re.lastIndex = 0;
  while ((m = re.exec(text)) !== null) {
    const key = `${m[2]}:${m[3]}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ name: m[1], address: m[2], port: Number(m[3]) });
    }
  }
  return out;
}

/**
 * Decide whether an admin endpoint response indicates exposure worth flagging.
 *
 * @param {{ path: string, status: number, body?: string, headers?: object }} probe
 * @returns {{ exposed: boolean, severity: string, reason: string }}
 */
export function assessExposure({ path, status, body = '', headers = {} } = {}) {
  const text = String(body || '');
  if (status === 200 && text.length > 50) {
    const critical = ['/config_dump', '/certs', '/clusters'].some(p => path.includes(p));
    return {
      exposed: true,
      severity: critical ? 'High' : 'Medium',
      reason: `Admin path ${path} returned HTTP 200 with ${text.length} bytes — ${
        critical ? 'configuration/topology data is exposed' : 'operational data is exposed'
      }.`,
    };
  }
  if (status === 403 || status === 401) {
    return {
      exposed: false,
      severity: 'None',
      reason: `Admin path ${path} is access-controlled (HTTP ${status}).`,
    };
  }
  return {
    exposed: false,
    severity: 'None',
    reason: `Admin path ${path} not reachable (HTTP ${status}).`,
  };
}

/**
 * Full analysis of one or more fetched mesh admin responses.
 *
 * @param {{ probes: { path: string, status: number, body?: string, headers?: object }[] }} input
 * @returns {{ type: string, software: string, version: string|null, exposed: object[], upstreamHosts: object[], listenerAddresses: object[], confidence: string, evidence: string }}
 */
export function analyzeMeshResponses({ probes = [] } = {}) {
  const first = probes.find(p => p.status === 200 && p.body) || probes[0] || {};
  const identity = identifyMesh({ headers: first.headers, body: first.body });
  const exposed = probes.map(p => ({ path: p.path, ...assessExposure(p) }));
  const bodies = probes.map(p => String(p.body || '')).join('\n');
  const upstreamHosts = extractUpstreamHosts(bodies);
  const listenerAddresses = extractListenerAddresses(bodies);
  const exposedCount = exposed.filter(e => e.exposed).length;

  return {
    type: 'Service-Mesh Sidecar Config Leak Mining',
    software: identity.software,
    version: identity.version,
    exposed,
    upstreamHosts,
    listenerAddresses,
    confidence: exposedCount > 0 ? 'high' : identity.confidence,
    evidence:
      exposedCount > 0
        ? `${exposedCount} mesh admin endpoint(s) exposed (${exposed
            .filter(e => e.exposed)
            .map(e => e.path)
            .join(
              ', '
            )}): ${upstreamHosts.length} upstream host(s) and ${listenerAddresses.length} listener(s) recovered from config data.`
        : 'No mesh admin endpoints appear exposed in the supplied responses.',
  };
}

export const MESH_CONFIG_MINER = {
  KNOWN_ADMIN_PATHS,
  identifyMesh,
  extractUpstreamHosts,
  extractListenerAddresses,
  assessExposure,
  analyzeMeshResponses,
};
export default MESH_CONFIG_MINER;
