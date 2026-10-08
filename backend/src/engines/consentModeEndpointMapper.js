/**
 * consentModeEndpointMapper.js — Consent-mode endpoint mapping.
 *
 * Idea 00904: map consent-management endpoints from consent-management
 * platform (CMP) code on an authorized target.
 *
 * No network calls: the module scans page JavaScript/HTML for consent APIs
 * (TCF __tcfapi, USP __uspapi, GPP __gpp, Google consent mode gtag calls,
 * CMP script URLs) and maps each to the endpoints it communicates with,
 * exposing the target's consent plumbing for authorized recon.
 * Defensive surface-mapping only.
 */

const CONSENT_APIS = [
  { api: '__tcfapi', kind: 'tcf', pattern: /__tcfapi\s*\(/g },
  { api: '__uspapi', kind: 'usp', pattern: /__uspapi\s*\(/g },
  { api: '__gpp', kind: 'gpp', pattern: /__gpp\s*\(/g },
  {
    api: "gtag('consent')",
    kind: 'google-consent-mode',
    pattern: /gtag\s*\(\s*['"]consent['"]/g,
  },
  {
    api: 'dataLayer consent event',
    kind: 'google-consent-mode',
    pattern: /dataLayer\.push\(\s*\{\s*['"]?event['"]?\s*:\s*['"](?:consent|cookie_consent)[^'"]*['"]/g,
  },
  { api: 'TCF locator', kind: 'tcf', pattern: /__tcfapiLocator|__uspapiLocator/g },
];

/**
 * @typedef {Object} ConsentEndpoint
 * @property {string} api - Consent API surface detected.
 * @property {string} kind - tcf | usp | gpp | google-consent-mode.
 * @property {string[]} endpoints - URLs the consent code references.
 * @property {string[]} scriptUrls - CMP script/loader URLs (assets, kept separate).
 * @property {string[]} configHosts - Hosts that look like CMP config endpoints.
 * @property {string} evidence - Source excerpt.
 */

/**
 * Map consent-management endpoints from CMP code.
 * @param {string} codeText - JavaScript source and/or page HTML.
 * @param {{maxFindings?: number}} [options]
 * @returns {{apis: ConsentEndpoint[], endpoints: string[], configHosts: string[], stats: object}}
 */
export function mapConsentEndpoints(codeText = '', options = {}) {
  const { maxFindings = 40 } = options;
  const text = String(codeText);
  const apis = [];

  const hostOf = url => {
    try {
      const u = new URL(url.startsWith('//') ? `https:${url}` : url);
      return u.hostname;
    } catch {
      return null;
    }
  };

  for (const { api, kind, pattern } of CONSENT_APIS) {
    let m;
    pattern.lastIndex = 0;
    while ((m = pattern.exec(text)) !== null && apis.length < maxFindings) {
      // Nearby context window: 400 chars around the hit.
      const start = Math.max(0, m.index - 200);
      const end = Math.min(text.length, m.index + m[0].length + 200);
      const ctx = text.slice(start, end);

      const endpoints = [];
      const scriptUrls = [];
      const urlRe = /https?:\/\/[a-z0-9_.\-:]{3,120}(?:\/[a-z0-9_.\-\/?#=&%:;+]{0,120})?/gi;
      let um;
      while ((um = urlRe.exec(ctx)) !== null) {
        if (/\.(js|css|png|jpe?g|svg|woff2?)$/i.test(um[0])) {
          scriptUrls.push(um[0]);
          continue;
        }
        endpoints.push(um[0]);
      }

      const configHosts = [...new Set(endpoints.map(hostOf).filter(Boolean))].filter(h =>
        /consent|cmp|privacy|cookie|gdpr|ccpa|cookielaw|onetrust|cookiebot|trustarc|osano|didomi|quantcast|sourcepoint|usercentrics|cookieyes|termly/i.test(h),
      );

      apis.push({
        api,
        kind,
        endpoints: [...new Set(endpoints)].slice(0, 10),
        scriptUrls: [...new Set(scriptUrls)].slice(0, 10),
        configHosts,
        evidence: text.slice(m.index, m.index + 160).replace(/\s+/g, ' '),
      });
    }
  }

  // Dedupe by (api, endpoints).
  const seen = new Set();
  const unique = apis.filter(a => {
    const key = `${a.api}|${a.endpoints.join(',')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const endpoints = [...new Set(unique.flatMap(a => a.endpoints))];
  const scriptUrls = [...new Set(unique.flatMap(a => a.scriptUrls || []))];
  const configHosts = [...new Set(unique.flatMap(a => a.configHosts))];
  const kinds = [...new Set(unique.map(a => a.kind))];

  return {
    apis: unique,
    endpoints,
    scriptUrls,
    configHosts,
    kinds,
    stats: {
      apis: unique.length,
      endpoints: endpoints.length,
      scriptUrls: scriptUrls.length,
      configHosts: configHosts.length,
      kinds: kinds.length,
      hasTcf: kinds.includes('tcf'),
      hasGoogleConsentMode: kinds.includes('google-consent-mode'),
    },
  };
}

/**
 * Build a report finding from the mapping result.
 * @param {ReturnType<typeof mapConsentEndpoints>} result
 */
export function consentModeFinding(result) {
  return {
    title: `Consent-mode endpoint mapping — ${result.stats.apis} consent surface(s), ${result.stats.configHosts} config host(s)`,
    severity: 'Info',
    confidence: result.stats.apis > 0 ? 'high' : 'low',
    kinds: result.kinds,
    configHosts: result.configHosts.slice(0, 20),
    evidence:
      `${result.stats.apis} consent API usage(s) mapped to ` +
      `${result.stats.endpoints} endpoint(s); ` +
      `standards: ${result.kinds.join(', ') || 'none'}.`,
  };
}

export const CONSENT_MODE_ENDPOINT_MAPPER = {
  mapConsentEndpoints,
  consentModeFinding,
  CONSENT_APIS,
};
export default CONSENT_MODE_ENDPOINT_MAPPER;
