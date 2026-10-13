// Dark Matter hunt-intel — WAF fingerprinting + adaptive evasion cache.
// Techniques: wafw00f (BSD-3, 150+ WAF DB) + Fray (MIT, adaptive cache).
// Identify the vendor FIRST, then mutate — never brute-force blind.

/** Known WAF/CDN fingerprints (subset of wafw00f's 150+ DB). */
const WAF_FINGERPRINTS = [
  { vendor: 'Cloudflare', headers: ['cf-ray', 'cf-cache-status'], body: /cloudflare/i },
  { vendor: 'AWS WAF', headers: ['x-amzn-requestid'], body: /aws waf/i },
  { vendor: 'Akamai', headers: ['akamai-origin-hop'], body: /akamai/i },
  { vendor: 'Imperva', headers: ['x-iinfo'], body: /imperva|incapsula/i },
  { vendor: 'CloudFront', headers: ['x-amz-cf-id'], body: null },
  { vendor: 'Fastly', headers: ['fastly-restarts'], body: null },
  { vendor: 'Sucuri', headers: ['x-sucuri-id'], body: /sucuri/i },
  { vendor: 'ModSecurity', headers: [], body: /mod_security|not acceptable/i },
];

/** Fingerprint WAF from response headers + body. */
export function fingerprintWaf(headers, body) {
  const headerNames = Object.keys(headers || {}).map((h) => h.toLowerCase());
  for (const fp of WAF_FINGERPRINTS) {
    if (fp.headers.some((h) => headerNames.includes(h))) return fp.vendor;
    if (fp.body && fp.body.test(String(body || ''))) return fp.vendor;
  }
  return 'unknown';
}

// ---- Adaptive evasion cache (Fray technique) --------------------------------
// Keyed by (WAF vendor, payload hash): learns what gets blocked per vendor.

const evasionCache = new Map();

function cacheKey(vendor, payload) {
  let h = 0;
  for (let i = 0; i < payload.length; i++) h = ((h << 5) - h + payload.charCodeAt(i)) | 0;
  return `${vendor}:${h}`;
}

/** Record whether a payload was blocked by a vendor's WAF. */
export function recordEvasionResult(vendor, payload, blocked) {
  evasionCache.set(cacheKey(vendor, payload), { blocked, at: Date.now() });
}

/** Check if this payload is known-blocked for this vendor. */
export function isKnownBlocked(vendor, payload) {
  const rec = evasionCache.get(cacheKey(vendor, payload));
  return rec ? rec.blocked : null; // null = unknown
}

/** Encoder matrix (GoTestWAF technique): payload × encoder × injection point. */
export const ENCODERS = ['raw', 'url', 'double_url', 'base64', 'js_unicode', 'xml_entity', 'html_entity'];

export function encodePayload(payload, encoder) {
  switch (encoder) {
    case 'url': return encodeURIComponent(payload);
    case 'double_url': return encodeURIComponent(encodeURIComponent(payload));
    case 'base64': return Buffer.from(payload).toString('base64');
    case 'js_unicode': return [...payload].map((c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')).join('');
    case 'xml_entity': return [...payload].map((c) => `&#${c.charCodeAt(0)};`).join('');
    case 'html_entity': return payload.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    default: return payload;
  }
}
