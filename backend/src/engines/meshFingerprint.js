/**
 * meshFingerprint.js — Service-mesh reconnaissance and fingerprinting.
 *
 * Passive-analysis engines for an authorized bug-bounty agent to recognize
 * service-mesh control/data-plane components during a hunt. Every function
 * works on already-observed data (TLS handshake metadata, HTTP responses,
 * configuration documents) — nothing here sends packets or performs active
 * exploitation. Defensive/product framing only.
 */

/**
 * ALPN and certificate patterns that distinguish common service meshes in
 * mutual-TLS handshakes between sidecar proxies.
 */
export const MESH_MTLS_SIGNATURES = [
  {
    mesh: 'Istio',
    alpn: [/^istio-peer-exchange$/i, /^istio$/i],
    certSubject: [/O=cluster\.local/i],
    spiffe: [/^spiffe:\/\/cluster\.local\//i],
    notes: 'Istio sidecars negotiate the istio-peer-exchange ALPN and carry SPIFFE IDs under cluster.local.',
  },
  {
    mesh: 'Linkerd',
    alpn: [/^linkerd$/i, /^l5d/i],
    certSubject: [/linkerd/i],
    spiffe: [/^spiffe:\/\/[\w.-]+\/(ns|deploymentaccount)\/[\w.-]+\/serviceaccount\//i],
    notes: 'Linkerd proxies use identity.io-issued mTLS; trust anchors reference the identity controller.',
  },
  {
    mesh: 'Consul Connect',
    alpn: [/^consul-connect$/i],
    certSubject: [/consul/i],
    spiffe: [/^spiffe:\/\/[\w.-]+\/ns\/[\w.-]+\/dc\/[\w.-]+\/svc\//i],
    notes: 'Consul Connect uses SPIFFE IDs shaped like ns/<namespace>/dc/<datacenter>/svc/<service>.',
  },
];

/**
 * Response markers that reveal an exposed Envoy admin interface.
 */
const ENVOY_ADMIN_MARKERS = [
  /<title>\s*envoy\s+admin\s*<\/title>/i,
  /"envoy_admin":|"admin":\s*{/i,
  /"dynamic_active_clusters"/,
  /"dynamic_listener_configs"/,
  /"static_clusters"/,
  /"clusters":\s*\[/i,
  /envoy\/[a-f0-9]{7}\//i, // build-release SHA in /server_info
  /"server_info":/,
];

/**
 * Response markers for Istio Pilot/istiod discovery services.
 */
const ISTIO_PILOT_MARKERS = [
  /istio\.io/i,
  /"istio-pilot"/i,
  /pilot-discovery/i,
  /istiod/i,
  /\/debug\/(endpointz|adsz|configz|pprof)/i,
  /x-envoy-upstream-service-time/i,
  /"version":\s*"1\.\d+\.\d+/,
];

/**
 * Response markers for the Linkerd identity controller / trust anchor material.
 */
const LINKERD_IDENTITY_MARKERS = [
  /linkerd-identity/i,
  /identity\.linkerd\.io/i,
  /"Linkerd"/i,
  /BEGIN TRUST ANCHOR/i,
  /linkerd-trust-anchor/i,
  /l5d/i,
];

/**
 * Consul Connect CA endpoint paths and response markers.
 */
const CONSUL_CA_PATHS = ['/v1/connect/ca/roots', '/v1/connect/ca/leaf/'];
const CONSUL_CA_MARKERS = [
  /"TrustDomain"/,
  /"RootCerts"/,
  /"ActiveRootID"/,
  /"IntermediateCerts"/,
];

/** Well-known service-mesh component ports used to contextualize findings. */
export const MESH_PORT_HINTS = {
  15000: 'Istio/Envoy admin interface',
  15010: 'Istio xDS (plaintext)',
  15012: 'Istio xDS (mTLS)',
  15021: 'Istio health check',
  8080: 'Linkerd identity controller',
  4191: 'Linkerd proxy admin',
  8500: 'Consul HTTP API',
  8600: 'Consul DNS',
};

/**
 * Fingerprint a service mesh from observed mTLS handshake metadata
 * (idea 591). Input describes a sidecar-to-sidecar handshake the agent
 * captured during authorized recon — it performs no connection itself.
 *
 * @param {object} handshake
 * @param {string[]} [handshake.alpnProtocols] - ALPN protocols offered/negotiated
 * @param {string[]} [handshake.cipherSuites] - TLS cipher suite names
 * @param {object} [handshake.serverCertificate] - { subject, issuer, sanUris }
 * @param {string} [handshake.tlsVersion]
 * @returns {{ mesh, confidence, evidence[] }}
 */
export function fingerprintMeshMtls(handshake = {}) {
  const { alpnProtocols = [], cipherSuites = [], serverCertificate = {}, tlsVersion = '' } = handshake;
  const cert = {
    subject: serverCertificate.subject || '',
    issuer: serverCertificate.issuer || '',
    sanUris: Array.isArray(serverCertificate.sanUris) ? serverCertificate.sanUris : [],
  };
  const evidence = [];

  for (const sig of MESH_MTLS_SIGNATURES) {
    const hits = [];
    if (alpnProtocols.some((p) => sig.alpn.some((re) => re.test(p)))) {
      hits.push(`ALPN matches ${sig.mesh}`);
    }
    if ([cert.subject, cert.issuer].some((s) => sig.certSubject.some((re) => re.test(s)))) {
      hits.push('certificate subject/issuer matches');
    }
    if (cert.sanUris.some((u) => sig.spiffe.some((re) => re.test(u)))) {
      hits.push('SPIFFE SAN matches mesh shape');
    }
    if (hits.length > 0) {
      evidence.push(...hits.map((h) => `${sig.mesh}: ${h}`));
    }
  }

  if (evidence.length === 0) {
    return { mesh: 'unknown', confidence: 'none', evidence: [] };
  }
  const scored = MESH_MTLS_SIGNATURES.map((sig) => ({
    mesh: sig.mesh,
    score: evidence.filter((e) => e.startsWith(sig.mesh)).length,
  })).sort((a, b) => b.score - a.score);
  const best = scored[0];
  const confidence = best.score >= 3 ? 'high' : best.score === 2 ? 'medium' : 'low';
  return {
    mesh: best.mesh,
    confidence,
    evidence: evidence.filter((e) => e.startsWith(best.mesh)),
    notes: MESH_MTLS_SIGNATURES.find((s) => s.mesh === best.mesh).notes,
    context: { tlsVersion, cipherCount: cipherSuites.length },
  };
}

/**
 * Detect an exposed Envoy admin interface from an HTTP response body
 * (idea 592). Envoy admin leaks clusters, routes and full config dumps.
 *
 * @param {{ url, status, body }} response - Observed HTTP response.
 * @returns {{ exposed, confidence, evidence[], exposure }}
 */
export function detectEnvoyAdmin(response = {}) {
  const { url = '', status = 0, body = '' } = response;
  const text = String(body);
  const markers = ENVOY_ADMIN_MARKERS.filter((re) => re.test(text));
  const exposed = status === 200 && markers.length > 0;

  const exposure = {
    clusters: /"dynamic_active_clusters"|"static_clusters"/.test(text),
    routes: /"dynamic_route_configs"|"static_route_configs"/.test(text),
    configDump: /\/config_dump/.test(url) || /"config_dump"/.test(text),
    serverInfo: /"server_info"/.test(text),
  };

  return {
    exposed,
    confidence: markers.length >= 3 ? 'high' : markers.length >= 1 ? 'medium' : 'none',
    evidence: markers.map((re) => `Envoy admin marker: ${re.source}`),
    exposure,
    severity: exposed ? 'High' : 'None',
    note: exposed
      ? 'Exposed Envoy admin interface discloses cluster topology, routes and full configuration — a valuable recon source.'
      : 'No Envoy admin markers found in the response.',
  };
}

/**
 * Probe-analyze an observed Istio Pilot/istiod discovery service response
 * for version disclosure and debug endpoints (idea 593).
 *
 * @param {{ url, status, headers, body }} response - Observed HTTP response.
 * @returns {{ detected, version, debugEndpoints[], confidence, evidence[] }}
 */
export function probeIstioPilot(response = {}) {
  const { url = '', status = 0, headers = {}, body = '' } = response;
  const text = String(body);
  const evidence = [];
  const debugEndpoints = [];

  for (const re of ISTIO_PILOT_MARKERS) {
    if (re.test(text) || re.test(url)) {
      evidence.push(`Istio Pilot marker: ${re.source}`);
    }
  }
  const headerText = JSON.stringify(headers);
  if (/istio/i.test(headerText)) {
    evidence.push('Istio marker in response headers');
  }

  const debugMatches = text.match(/\/debug\/[a-z]+/gi);
  if (debugMatches) debugEndpoints.push(...new Set(debugMatches));

  const versionMatch = text.match(/(?:istio(?:d)?[/\s:-]|"version"\s*:\s*")[vV]?(\d+\.\d+(?:\.\d+)?)/i);
  const version = versionMatch ? versionMatch[1] : null;
  if (version) evidence.push(`Istio version disclosed: ${version}`);

  const detected = status === 200 && evidence.length > 0;
  return {
    detected,
    version,
    debugEndpoints,
    confidence: evidence.length >= 3 ? 'high' : evidence.length >= 1 ? 'medium' : 'none',
    evidence,
    note: version
      ? `Istiod version disclosure enables targeted vulnerability lookup for ${version}.`
      : 'No version disclosure markers found.',
  };
}

/**
 * Probe-analyze an observed Linkerd identity controller response for
 * trust-anchor material disclosure (idea 594).
 *
 * @param {{ url, status, body }} response - Observed HTTP response.
 * @returns {{ detected, trustAnchorExposed, confidence, evidence[] }}
 */
export function probeLinkerdIdentity(response = {}) {
  const { url = '', status = 0, body = '' } = response;
  const text = String(body);
  const evidence = [];

  for (const re of LINKERD_IDENTITY_MARKERS) {
    if (re.test(text) || re.test(url)) {
      evidence.push(`Linkerd identity marker: ${re.source}`);
    }
  }

  const trustAnchorExposed =
    /BEGIN (EC )?PRIVATE KEY/i.test(text) === false && /-----BEGIN CERTIFICATE-----/.test(text) && LINKERD_IDENTITY_MARKERS.some((re) => re.test(text));
  if (trustAnchorExposed) evidence.push('Linkerd trust-anchor certificate material disclosed in response');

  const detected = status === 200 && evidence.length > 0;
  return {
    detected,
    trustAnchorExposed,
    confidence: evidence.length >= 3 ? 'high' : evidence.length >= 1 ? 'medium' : 'none',
    evidence,
    note: trustAnchorExposed
      ? 'Trust-anchor disclosure aids full mesh impersonation analysis — treat as high-severity recon.'
      : 'Linkerd identity markers present without raw key material.',
  };
}

/**
 * Parse an observed Consul Connect CA roots response into cluster
 * information (idea 595). Input is data already retrieved during an
 * authorized hunt — the function only structures it.
 *
 * @param {object|string} caResponse - Parsed JSON or raw body from /v1/connect/ca/roots.
 * @param {string} [url]
 * @returns {{ isConsulCA, trustDomain, rootCount, activeRootId, rotationInProgress, evidence[] }}
 */
export function probeConsulConnectCa(caResponse = {}, url = '') {
  let data;
  try {
    data = typeof caResponse === 'string' ? JSON.parse(caResponse) : caResponse;
  } catch {
    data = {};
  }
  const text = JSON.stringify(data);
  const evidence = [];
  const isPath = CONSUL_CA_PATHS.some((p) => String(url).includes(p));
  const markers = CONSUL_CA_MARKERS.filter((re) => re.test(text));
  if (isPath) evidence.push(`Consul Connect CA endpoint path: ${url}`);
  markers.forEach((re) => evidence.push(`Consul CA marker: ${re.source}`));

  const roots = Array.isArray(data.RootCerts) ? data.RootCerts : [];
  const activeRootId = data.ActiveRootID || null;
  const rotationInProgress = roots.length > 1;

  return {
    isConsulCA: markers.length > 0,
    trustDomain: data.TrustDomain || null,
    rootCount: roots.length,
    activeRootId,
    rotationInProgress,
    confidence: markers.length >= 3 ? 'high' : markers.length >= 1 ? 'medium' : 'none',
    evidence,
    clusterInfo: markers.length > 0
      ? { trustDomain: data.TrustDomain || null, activeRootId, rootCount: roots.length }
      : null,
  };
}

/**
 * Enumerate SPIFFE IDs from exposed documents (SVID JSON, workload API
 * responses, certificate URIs) to map service identities (idea 596).
 *
 * @param {Array<object|string>} documents - Observed documents that may contain SPIFFE IDs.
 * @returns {{ identities: Array<{spiffeId, trustDomain, path, role}>, trustDomains, count }}
 */
export function enumerateSpiffeIds(documents = []) {
  const SPIFFE_RE = /spiffe:\/\/([A-Za-z0-9._-]+)(\/[A-Za-z0-9._~%!$&'()*+,;=:@/-]*)?/g;
  const identities = [];
  const seen = new Set();

  for (const doc of documents) {
    const text = typeof doc === 'string' ? doc : JSON.stringify(doc);
    let match;
    while ((match = SPIFFE_RE.exec(text)) !== null) {
      const spiffeId = match[0];
      if (seen.has(spiffeId)) continue;
      seen.add(spiffeId);
      const trustDomain = match[1];
      const path = match[2] || '';
      const role = /(?:^|\/)(svc|service|sa|serviceaccount|ns|workload)/.test(path)
        ? path.split('/').filter(Boolean).pop() || 'unknown'
        : 'workload';
      identities.push({ spiffeId, trustDomain, path, role });
    }
  }

  const trustDomains = [...new Set(identities.map((i) => i.trustDomain))];
  return { identities, trustDomains, count: identities.length };
}
