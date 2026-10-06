/**
 * opcuaDiscoveryAnalyzer.js — OPC-UA endpoint discovery analysis (idea 00496).
 *
 * Analyzes OPC-UA discovery service data (default :4840):
 *  - `FindServers` responses: server descriptions, URIs, product names.
 *  - `GetEndpoints` summaries: endpoint URLs, security policies, modes.
 *  - Server discovery announcements on the network (decoded records).
 *
 * Offline analyzer: callers supply decoded discovery records or raw
 * UA-Binary buffers captured from discovery exchanges. No network code;
 * no subscription or write operations — discovery analysis only.
 */

/** OPC-UA security policy URIs of interest. */
export const OPCUA_SECURITY_POLICIES = {
  'http://opcfoundation.org/UA/SecurityPolicy#None': { encryption: 'none', signing: 'none' },
  'http://opcfoundation.org/UA/SecurityPolicy#Basic256Sha256': { encryption: 'aes256', signing: 'hmac-sha256' },
  'http://opcfoundation.org/UA/SecurityPolicy#Aes256_Sha256_RsaPss': { encryption: 'aes256', signing: 'rsa-pss' },
  'http://opcfoundation.org/UA/SecurityPolicy#Aes128_Sha256_RsaOaep': { encryption: 'aes128', signing: 'rsa-oaep' },
};

/**
 * Normalize a decoded `FindServers` response record list.
 *
 * @param {Array<object>} servers decoded ApplicationDescription records:
 *   `{ applicationName, applicationUri, productUri, discoveryUrls, serverType }`
 * @returns {object} normalized discovery summary
 */
export function summarizeFindServers(servers = []) {
  const list = (Array.isArray(servers) ? servers : []).map((s) => ({
    name: s.applicationName || s.applicationUri || 'unknown',
    applicationUri: s.applicationUri || null,
    productUri: s.productUri || null,
    discoveryUrls: Array.isArray(s.discoveryUrls) ? s.discoveryUrls : [],
    serverType: s.serverType ?? null,
  }));
  const anonymous = list.filter((s) => s.discoveryUrls.some((u) => /^opc\.tcp:\/\//i.test(u)));
  return {
    valid: list.length > 0,
    serverCount: list.length,
    servers: list,
    exposedOpcTcp: anonymous.length > 0,
  };
}

/**
 * Analyze a decoded `GetEndpoints` endpoint description list.
 *
 * @param {Array<object>} endpoints decoded EndpointDescription records:
 *   `{ endpointUrl, securityPolicyUri, securityMode, transportProfileUri }`
 * @returns {object} endpoint security assessment
 */
export function assessOpcuaEndpoints(endpoints = []) {
  const list = (Array.isArray(endpoints) ? endpoints : []).map((e) => {
    const policy = OPCUA_SECURITY_POLICIES[e.securityPolicyUri] || { encryption: 'unknown', signing: 'unknown' };
    return {
      endpointUrl: e.endpointUrl || null,
      securityPolicyUri: e.securityPolicyUri || null,
      securityMode: e.securityMode || 'Unknown',
      transportProfileUri: e.transportProfileUri || null,
      ...policy,
    };
  });
  const nonePolicy = list.filter((e) => /SecurityPolicy#None/.test(e.securityPolicyUri || ''));
  const findings = [];
  if (nonePolicy.length > 0) {
    findings.push({
      level: 'high',
      text: `${nonePolicy.length} endpoint(s) advertise SecurityPolicy#None — no message security.`,
      endpoints: nonePolicy.map((e) => e.endpointUrl),
    });
  } else if (list.length > 0) {
    findings.push({ level: 'low', text: `${list.length} endpoint(s) analyzed; none use SecurityPolicy#None.` });
  }
  return {
    valid: list.length > 0,
    endpointCount: list.length,
    endpoints: list,
    findings,
    insecureEndpointCount: nonePolicy.length,
  };
}

/**
 * Parse a minimal UA-Binary length-prefixed UTF-8 string at an offset.
 * Helper for callers decoding raw discovery buffers.
 *
 * @param {Buffer|Uint8Array} buf raw bytes
 * @param {number} offset byte offset
 * @returns {{value: string|null, next: number}} parsed string and next offset
 */
export function readUaString(buf, offset = 0) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf || []);
  if (offset + 4 > b.length) return { value: null, next: offset };
  const len = b.readInt32LE(offset);
  if (len === -1) return { value: null, next: offset + 4 };
  if (len < 0 || offset + 4 + len > b.length) return { value: null, next: offset };
  return { value: b.toString('utf8', offset + 4, offset + 4 + len), next: offset + 4 + len };
}

export const OPCUA_DISCOVERY = {
  idea: '00496',
  defaultPort: 4840,
  securityPolicies: OPCUA_SECURITY_POLICIES,
  summarizeFindServers,
  assessEndpoints: assessOpcuaEndpoints,
  readUaString,
};

export default OPCUA_DISCOVERY;
