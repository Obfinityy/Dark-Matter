/**
 * cloudExposureProbe.js — Cloud metadata-service and instance-identity exposure analysis.
 *
 * Implements ideas 585–586:
 *
 *   585 — Cloud metadata-service detection: detect cloud metadata endpoints
 *           reachable from SSRF-adjacent contexts (DETECTION ONLY).
 *   586 — Instance-identity document analysis: analyze exposed
 *           instance-identity documents for account/region data useful to the
 *           asset inventory.
 *
 * Defensive framing: these are read-only response classifiers for data already
 * observed during an authorized hunt (e.g. a proxy-log or SSRF canary that
 * returned metadata-shaped content). This module NEVER extracts, stores, or
 * logs credentials, tokens, or secrets — it flags their presence and redacts
 * them. It never performs live SSRF requests itself.
 */

const METADATA_SIGNATURES = [
  {
    provider: 'AWS',
    name: 'ec2-metadata',
    description: 'AWS EC2 instance metadata service response shape.',
    match: (body, url = '') =>
      /\bami-id\b/i.test(body) ||
      /\bsecurity-credentials\b/i.test(body) ||
      /169\.254\.169\.254\/latest\/meta-data/.test(url),
    identityFields: ['accountId', 'region', 'instanceId', 'architecture'],
  },
  {
    provider: 'GCP',
    name: 'gce-metadata',
    description: 'GCE metadata service response shape.',
    match: (body, url = '') =>
      /\bproject\/project-id\b/i.test(body) ||
      /\bMetadata-Flavor:\s*Google/i.test(body) ||
      /metadata\.google\.internal/.test(url),
    identityFields: ['projectId', 'zone', 'instanceId'],
  },
  {
    provider: 'Azure',
    name: 'azure-imds',
    description: 'Azure Instance Metadata Service response shape.',
    match: (body, url = '') =>
      /"azEnvironment"/i.test(body) ||
      /"compute":\s*{[^}]*"vmId"/i.test(body) ||
      /169\.254\.169\.254\/metadata\/instance/.test(url),
    identityFields: ['subscriptionId', 'resourceGroupName', 'location', 'vmId'],
  },
  {
    provider: 'DigitalOcean',
    name: 'do-metadata',
    description: 'DigitalOcean droplet metadata response shape.',
    match: (body, url = '') =>
      /\bdroplet_id\b/i.test(body) || /169\.254\.169\.254\/metadata\/v1/.test(url),
    identityFields: ['dropletId', 'region', 'hostname'],
  },
];

const CREDENTIAL_LIKE_KEYS = [
  'secretaccesskey',
  'accesskeyid',
  'sessiontoken',
  'token',
  'secret',
  'password',
  'privatekey',
  'authorization',
  'x-auth-token',
  'iam',
];

const SENSITIVE_KEY_PATTERN = /(secret|token|key|password|credential|private)/i;

/**
 * Detect a cloud metadata-service response from observed content (idea 585).
 * Detection only — no credential extraction.
 * @param {{ url?: string, statusCode?: number, body?: string, headers?: Record<string,string> }} input
 * @returns {{ detected: boolean, provider: string|null, matches: string[], credentialPresent: boolean }}
 */
export function detectCloudMetadata({ url = '', statusCode = 0, body = '', headers = {} } = {}) {
  const text = String(body);
  const headerDump = Object.entries(headers || {})
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
  const haystack = `${url}\n${headerDump}`;
  const matches = [];
  for (const sig of METADATA_SIGNATURES) {
    if (sig.match(text, haystack)) matches.push(sig);
  }
  const credentialPresent = CREDENTIAL_LIKE_KEYS.some(k => {
    const re = new RegExp(`"${k}"\\s*:\\s*"[^"]{4,}"`, 'i');
    return re.test(text);
  });
  return {
    detected: matches.length > 0,
    provider: matches.length > 0 ? matches[0].provider : null,
    matches: matches.map(m => ({ provider: m.provider, name: m.name, description: m.description })),
    credentialPresent,
    classification: matches.length > 0 ? 'cloud-metadata-exposure' : 'no-metadata-signature',
    statusCode,
    note: credentialPresent
      ? 'Credential-shaped content is present in the observed response. It is NOT extracted or logged; flag for remediation immediately.'
      : undefined,
  };
}

/**
 * Parse an exposed instance-identity document for inventory data (idea 586).
 * Supports AWS EC2 (dynamic/instance-identity/document JSON) and Azure IMDS
 * instance payloads. Sensitive values are never returned — only redacted flags.
 * @param {{ provider?: string, body?: string }} input
 * @returns {{ parsed: boolean, provider: string|null, inventory: Record<string,string>, redacted: string[] }}
 */
export function analyzeInstanceIdentity({ provider = '', body = '' } = {}) {
  let doc;
  try {
    doc = JSON.parse(String(body));
  } catch {
    return {
      parsed: false,
      provider: null,
      inventory: {},
      redacted: [],
      reason: 'Not valid JSON.',
    };
  }
  if (doc && typeof doc !== 'object') {
    return {
      parsed: false,
      provider: null,
      inventory: {},
      redacted: [],
      reason: 'Not an object document.',
    };
  }

  const inventory = {};
  const redacted = [];
  let detectedProvider = String(provider || '').toLowerCase() || null;

  const pick = (source, key, label) => {
    const val = source?.[key];
    if (val === undefined || val === null || val === '') return;
    if (typeof val === 'object') return;
    if (SENSITIVE_KEY_PATTERN.test(label) || SENSITIVE_KEY_PATTERN.test(key)) {
      redacted.push(label);
      inventory[label] = '[REDACTED]';
    } else {
      inventory[label] = String(val).slice(0, 200);
    }
  };

  const seen = new Set();
  const pickAll = source => {
    if (!source || typeof source !== 'object') return;
    for (const k of Object.keys(source)) {
      if (seen.has(k)) continue;
      seen.add(k);
      pick(source, k, k);
    }
  };

  if (doc.accountId || doc.region || doc.instanceId) {
    detectedProvider = detectedProvider || 'aws';
    pickAll(doc);
  } else if (doc.compute || (doc.azEnvironment && doc.location)) {
    detectedProvider = detectedProvider || 'azure';
    pickAll(doc.compute || {});
    pickAll(doc);
  } else if (doc.projectId || doc.zone) {
    detectedProvider = detectedProvider || 'gcp';
    pickAll(doc);
  }

  return {
    parsed: Object.keys(inventory).length > 0,
    provider: detectedProvider,
    inventory,
    redacted,
    reason:
      Object.keys(inventory).length > 0
        ? undefined
        : 'No recognizable instance-identity fields found.',
  };
}

export const CLOUD_EXPOSURE_PROBE = {
  METADATA_SIGNATURES,
  detectCloudMetadata,
  analyzeInstanceIdentity,
};

export default CLOUD_EXPOSURE_PROBE;
