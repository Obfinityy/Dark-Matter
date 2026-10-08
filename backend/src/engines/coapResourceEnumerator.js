/**
 * coapResourceEnumerator.js — CoAP resource-discovery enumerator.
 *
 * Parses a captured CoAP /.well-known/core response (RFC 6690 link-format)
 * and enumerates the resources the endpoint advertises. Input is the raw
 * link-format payload collected during an authorized hunt — no CoAP traffic
 * is generated here.
 */

const SENSITIVE_IF = {
  actuator: 'Actuator interface — remotely changes physical state',
  'core.c': 'Control interface (RFC 7641 observe control)',
  'core.ll': 'Link-list (full resource tree exposure)',
  'core.b': 'Batch / group operations',
};

const SENSITIVE_PATH_HINTS = [
  { re: /firmware|ota|update/i, note: 'Firmware/OTA update endpoint' },
  { re: /config|settings/i, note: 'Configuration endpoint' },
  { re: /actuat|relay|switch|gpio|lock|valve/i, note: 'Physical actuator' },
  { re: /admin|debug|diag/i, note: 'Administrative/debug endpoint' },
  { re: /key|secret|cred|token|pass/i, note: 'Credential-like path name' },
];

/**
 * Parse one RFC 6690 link entry, e.g. </sensors/temp>;rt="temperature-c";if="sensor";obs.
 * @param {string} entry
 */
function parseLink(entry) {
  const trimmed = entry.trim();
  const uriMatch = /^<([^>]*)>/.exec(trimmed);
  if (!uriMatch) return null;
  const params = {};
  const rest = trimmed.slice(uriMatch[0].length);
  const tokenRe = /;([^;=]+)(?:=(?:"([^"]*)"|([^;]*)))?/g;
  let m;
  while ((m = tokenRe.exec(rest)) !== null) {
    const key = m[1].trim().toLowerCase();
    params[key] = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : true;
  }
  return { uri: uriMatch[1], params };
}

/**
 * Split a link-format payload into entries, respecting quoted strings.
 * @param {string} payload
 */
function splitLinks(payload) {
  const entries = [];
  let current = '';
  let inQuotes = false;
  for (const ch of payload) {
    if (ch === '"') inQuotes = !inQuotes;
    if (ch === ',' && !inQuotes) {
      entries.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) entries.push(current);
  return entries;
}

/**
 * Enumerate CoAP resources from a captured /.well-known/core payload.
 *
 * @param {{ payload: string, endpoint?: string }} input
 */
export function enumerateCoapResources({ payload = '', endpoint = '' } = {}) {
  const resources = [];
  for (const entry of splitLinks(payload)) {
    const parsed = parseLink(entry);
    if (parsed) resources.push(parsed);
  }

  const findings = [];
  const interfaces = new Set();
  for (const r of resources) {
    if (typeof r.params.if === 'string') interfaces.add(r.params.if);
  }

  const sensitive = resources
    .map(r => {
      const hits = SENSITIVE_PATH_HINTS.filter(h => h.re.test(r.uri));
      const ifNote =
        typeof r.params.if === 'string' && SENSITIVE_IF[r.params.if]
          ? SENSITIVE_IF[r.params.if]
          : null;
      if (hits.length === 0 && !ifNote) return null;
      return {
        uri: r.uri,
        reasons: [...hits.map(h => h.note), ...(ifNote ? [ifNote] : [])],
      };
    })
    .filter(Boolean);

  if (sensitive.length > 0) {
    findings.push({
      type: 'Sensitive CoAP resources advertised',
      severity: 'Medium',
      confidence: 'medium',
      cwe: 'CWE-200',
      evidence: sensitive.map(s => `${s.uri} (${s.reasons.join('; ')})`).join(' | '),
      recommendation:
        'Verify these resources require authentication and rate limiting before the device ships.',
    });
  }

  const observable = resources.filter(r => r.params.obs !== undefined);
  if (observable.length > 0) {
    findings.push({
      type: 'Observable resources (RFC 7641)',
      severity: 'Info',
      confidence: 'high',
      evidence: `${observable.length} resource(s) support observation: ${observable.map(r => r.uri).join(', ')}.`,
      recommendation:
        'Observation subscriptions can leak telemetry streams; confirm they are access-controlled.',
    });
  }

  if (resources.length > 50) {
    findings.push({
      type: 'Large CoAP resource surface',
      severity: 'Info',
      confidence: 'high',
      evidence: `${resources.length} resources advertised on /.well-known/core.`,
      recommendation:
        'A large surface invites enumeration; consider trimming discovery output to what clients need.',
    });
  }

  return {
    endpoint,
    resourceCount: resources.length,
    resources,
    interfaces: [...interfaces],
    observableCount: observable.length,
    sensitive,
    findings,
  };
}

export const COAP_RESOURCE_ENUMERATOR = { enumerateCoapResources, parseLink };
export default COAP_RESOURCE_ENUMERATOR;
