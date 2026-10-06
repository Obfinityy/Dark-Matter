/**
 * lwm2mBootstrapProber.js — LwM2M bootstrap probing (idea 00544).
 *
 * Analyzes OMA Lightweight M2M (LwM2M) bootstrap exchanges (CoAP-based):
 *  - Bootstrap-request responses: which bootstrap servers answer.
 *  - Bootstrap-write objects: Security (0), Server (1), Access Control (2)
 *    object listings pushed to the client — an attacker-visible bootstrap
 *    server that accepts requests from strangers can push rogue server
 *    URIs to devices.
 *  - Object/instance/resource enumeration from CoAP link-format discovery
 *    responses (`</1/0>;rt=...` style).
 *
 * Offline analyzer: callers supply parsed bootstrap/discovery summaries.
 * No network code.
 * Defensive use: LwM2M fleet inventory + exposure audit for authorized
 * targets — open bootstrap interfaces are a critical bug-bounty surface
 * (device takeover via rogue server URI injection).
 */

export const LWM2M_SECURITY_OBJECT = 0;
export const LWM2M_SERVER_OBJECT = 1;
export const LWM2M_ACCESS_CONTROL_OBJECT = 2;

/** Common LwM2M objects (OMA registry subset). */
export const LWM2M_OBJECTS = {
  0: 'Security',
  1: 'Server',
  2: 'Access Control',
  3: 'Device',
  4: 'Connectivity Monitoring',
  5: 'Firmware Update',
  6: 'Location',
  7: 'Connectivity Statistics',
  9: 'Software Component',
  10: 'Software Management',
  11: 'Portfolio',
  12: 'Event Log',
  16: 'Connectivity Management',
};

/**
 * Parse CoAP link-format object listings (RFC 6690) from an LwM2M discovery
 * response into object/instance records.
 *
 * @param {string} payload link-format payload, e.g. `</0>;rt="oma.lwm2m",</1/0>`
 * @returns {object[]} [{ objectId, instanceId|null, resourceType }]
 */
export function parseLinkFormat(payload = '') {
  const out = [];
  const regex = /<(\/)?(\d+)(?:\/(\d+))?>(?:;rt="([^"]*)")?/g;
  let m;
  while ((m = regex.exec(String(payload))) !== null) {
    out.push({
      objectId: Number(m[2]),
      instanceId: m[3] != null ? Number(m[3]) : null,
      resourceType: m[4] || null,
      objectName: LWM2M_OBJECTS[Number(m[2])] || `object_${m[2]}`,
    });
  }
  return out;
}

/**
 * Probe-result analysis: does the bootstrap server respond and what does it leak?
 *
 * @param {object} probe { responded: boolean, bootstrapServerUri?, discoveredObjects?: object[], code?: string }
 * @returns {object[]} findings
 */
export function analyzeBootstrapProbe(probe = {}) {
  const findings = [];

  if (!probe.responded) {
    findings.push({
      type: 'LwM2M Bootstrap Server Unreachable',
      confidence: 'medium',
      cwe: null,
      evidence: 'bootstrap request received no response — server down, firewalled, or not an LwM2M bootstrap endpoint',
    });
    return findings;
  }

  findings.push({
    type: 'LwM2M Bootstrap Server Responsive',
    confidence: 'high',
    cwe: 'CWE-200',
    evidence: `bootstrap server responded${probe.bootstrapServerUri ? ` at ${probe.bootstrapServerUri}` : ''}${probe.code ? ` (CoAP ${probe.code})` : ''}. Confirm it authenticates bootstrapping devices — an open bootstrap interface can hand devices a rogue server URI.`,
    extra: { bootstrapServerUri: probe.bootstrapServerUri || null },
  });

  const objects = probe.discoveredObjects || [];
  const ids = new Set(objects.map((o) => o.objectId));
  if (ids.has(LWM2M_SECURITY_OBJECT)) {
    findings.push({
      type: 'Security Object Disclosed in Bootstrap',
      confidence: 'high',
      cwe: 'CWE-200',
      evidence: 'bootstrap exchange exposed Security object (0) instances — reveals server URIs, PSK hints and bootstrap parameters; treat as sensitive inventory data',
    });
  }

  const named = objects.slice(0, 10).map((o) => `${o.objectId}${o.instanceId != null ? `/${o.instanceId}` : ''} (${o.objectName})`);
  if (named.length) {
    findings.push({
      type: 'LwM2M Object Listing',
      confidence: 'high',
      cwe: null,
      evidence: `device exposes ${objects.length} object instance(s): ${named.join(', ')}${objects.length > 10 ? ' …' : ''}`,
      extra: { objectCount: objects.length },
    });
  }

  return findings;
}

export const LWM2M_BOOTSTRAP_PROBER = {
  parseLinkFormat,
  analyzeBootstrapProbe,
  LWM2M_OBJECTS,
  LWM2M_SECURITY_OBJECT,
  LWM2M_SERVER_OBJECT,
  LWM2M_ACCESS_CONTROL_OBJECT,
};
export default LWM2M_BOOTSTRAP_PROBER;
