/**
 * ja4Profiler.js — JA4/JA4H response fingerprinting for CDN & WAF identification.
 *
 * JA4 is a TLS-client fingerprinting method; JA4H fingerprints the HTTP
 * response (header order, cookies, language). This module computes a JA4H-style
 * fingerprint from server response data and matches it — together with
 * provider-specific header markers — against a signature database of known
 * CDN edge networks and web-application firewalls. Pure analysis: it takes
 * already-captured response data as input and performs no network I/O.
 */

/**
 * Canonicalize HTTP header names for fingerprinting.
 */
function canonHeaderName(name) {
  return String(name || '')
    .trim()
    .toLowerCase();
}

/**
 * Compute a JA4H-style fingerprint from an HTTP response.
 *
 * JA4H structure (adapted for server responses):
 *   <headers>_h<cookies>_l<lang>_a<accept>... here we use response-side data:
 *   a = response header field names (original order, then sorted)
 *   b = response header values hashed together
 *   c = sorted header names hashed
 *   d = sorted "set-cookie" names hashed
 *
 * @param {Object} response - Captured response data.
 * @param {Array<[string,string]>|Object} response.headers - Header entries (order matters).
 * @param {Array<string>} [response.cookies] - Cookie names set by the response.
 * @returns {{raw: Object, fingerprint: string, parts: Object}}
 */
export function computeJA4H({ headers = [], cookies = [] } = {}) {
  const entries = Array.isArray(headers) ? headers : Object.entries(headers || {});
  const names = entries.map(([k]) => canonHeaderName(k)).filter(Boolean);
  const orderedNames = names.join(',');
  const sortedNames = [...names].sort().join(',');
  const values = entries.map(([, v]) => String(v ?? '')).join('|');

  const cookieNames = Array.isArray(cookies)
    ? cookies.map(c => String(c).split('=')[0].trim().toLowerCase()).filter(Boolean)
    : [];
  const sortedCookies = [...cookieNames].sort().join(',');

  const h1 = simpleHash(orderedNames);
  const h2 = simpleHash(sortedNames);
  const h3 = simpleHash(values);
  const h4 = simpleHash(sortedCookies);

  return {
    raw: { headerCount: names.length, cookieCount: cookieNames.length },
    fingerprint: `ja4h_${h1}_${h2}_${h3}_${h4}`,
    parts: {
      headersOrderedHash: h1,
      headersSortedHash: h2,
      headerValuesHash: h3,
      cookiesSortedHash: h4,
    },
  };
}

/** Deterministic 32-bit hex digest (FNV-1a). */
export function simpleHash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Known CDN / WAF marker signatures: provider → header evidence patterns.
 * Each entry lists header names (lowercase) and value regexes that strongly
 * indicate the provider's edge layer.
 */
export const CDN_WAF_SIGNATURES = [
  {
    provider: 'Cloudflare',
    type: 'CDN/WAF',
    markers: [
      { header: 'cf-ray' },
      { header: 'cf-cache-status' },
      { header: 'server', value: /cloudflare/i },
      { header: '__cf_bm', cookie: true },
    ],
  },
  {
    provider: 'Akamai',
    type: 'CDN',
    markers: [
      { header: 'akamai-grn' },
      { header: 'x-akamai-request-id' },
      { header: 'x-akamai-transformed' },
      { header: 'server', value: /akamaighost|akamai/i },
    ],
  },
  {
    provider: 'Fastly',
    type: 'CDN',
    markers: [
      { header: 'x-fastly-request-id' },
      { header: 'fastly-restarts' },
      { header: 'via', value: /varnish|fastly/i },
      { header: 'server', value: /varnish/i },
    ],
  },
  {
    provider: 'AWS CloudFront',
    type: 'CDN',
    markers: [
      { header: 'x-amz-cf-id' },
      { header: 'x-amz-cf-pop' },
      { header: 'via', value: /cloudfront/i },
    ],
  },
  {
    provider: 'Imperva (Incapsula)',
    type: 'WAF',
    markers: [
      { header: 'x-cdn', value: /imperva|incapsula/i },
      { header: 'x-iinfo' },
      { cookiePrefix: 'incap_ses_' },
      { cookiePrefix: 'visid_incap_' },
    ],
  },
  {
    provider: 'F5 BIG-IP ASM',
    type: 'WAF',
    markers: [
      { cookie: 'ts01' },
      { cookie: 'f5_st' },
      { cookie: 'bigipserver' },
      { header: 'x-waf-event-id' },
    ],
  },
  {
    provider: 'AWS WAF (ALB/CloudFront)',
    type: 'WAF',
    markers: [{ cookie: 'awselb' }, { cookie: 'awselb2' }, { header: 'x-amzn-waf-action' }],
  },
  {
    provider: 'Sucuri',
    type: 'WAF',
    markers: [{ header: 'x-sucuri-cache' }, { header: 'x-sucuri-id' }],
  },
  {
    provider: 'StackPath',
    type: 'CDN',
    markers: [{ header: 'server', value: /stackpath/i }],
  },
  {
    provider: 'BunnyCDN',
    type: 'CDN',
    markers: [{ header: 'cdn-pullzone' }, { header: 'cdn-uid' }],
  },
  {
    provider: 'Edgecast / Verizon',
    type: 'CDN',
    markers: [{ header: 'x-ec-custom-error' }, { header: 'server', value: /ecds|edgecast/i }],
  },
  {
    provider: 'GCP Cloud CDN',
    type: 'CDN',
    markers: [{ header: 'via', value: /google/i }, { header: 'x-cloud-trace-context' }],
  },
];

/**
 * Identify the CDN / WAF layer from response headers and a JA4H fingerprint.
 *
 * @param {Object} args
 * @param {Array<[string,string]>|Object} args.headers - Response headers (order matters).
 * @param {Array<string>} [args.cookies] - Cookie names seen.
 * @param {Object<string,string>} [args.knownFingerprints] - Map of JA4H fingerprint → provider label.
 * @returns {{ja4h: Object, matches: Array, summary: Object}}
 */
export function identifyCdnWaf({ headers = [], cookies = [], knownFingerprints = {} } = {}) {
  const entries = Array.isArray(headers) ? headers : Object.entries(headers || {});
  const headerMap = new Map(entries.map(([k, v]) => [canonHeaderName(k), String(v ?? '')]));
  const cookieSet = new Set((cookies || []).map(c => String(c).split('=')[0].trim().toLowerCase()));

  const ja4h = computeJA4H({ headers: entries, cookies: [...cookieSet] });
  const matches = [];

  for (const sig of CDN_WAF_SIGNATURES) {
    let score = 0;
    const evidence = [];
    for (const m of sig.markers) {
      if (m.header) {
        const v = headerMap.get(m.header);
        if (v !== undefined && (!m.value || m.value.test(v))) {
          score += 2;
          evidence.push(`header ${m.header}${v ? `: ${v.slice(0, 60)}` : ''}`);
        }
      }
      if (m.cookie && cookieSet.has(String(m.cookie).toLowerCase())) {
        score += 2;
        evidence.push(`cookie ${m.cookie}`);
      }
      if (m.cookiePrefix) {
        const prefix = String(m.cookiePrefix).toLowerCase();
        const hit = [...cookieSet].find(c => c.startsWith(prefix));
        if (hit) {
          score += 2;
          evidence.push(`cookie prefix ${m.cookiePrefix}* (${hit})`);
        }
      }
    }
    if (score > 0) {
      matches.push({
        provider: sig.provider,
        type: sig.type,
        score,
        confidence: score >= 4 ? 'high' : score >= 2 ? 'medium' : 'low',
        evidence,
      });
    }
  }

  const fpMatch = knownFingerprints[ja4h.fingerprint];
  if (fpMatch) {
    matches.push({
      provider: fpMatch,
      type: 'unknown',
      score: 3,
      confidence: 'medium',
      evidence: [`JA4H fingerprint ${ja4h.fingerprint} seen in known-fingerprint database`],
    });
  }

  matches.sort((a, b) => b.score - a.score);
  const primary = matches[0] || null;

  return {
    ja4h,
    matches,
    summary: {
      detected: matches.length > 0,
      primary,
      headerCount: entries.length,
      cookieCount: cookieSet.size,
    },
  };
}

export const JA4_PROFILER = { computeJA4H, identifyCdnWaf, simpleHash, CDN_WAF_SIGNATURES };
export default JA4_PROFILER;
