/**
 * geofenceRuleMapper.js — Client-side geofencing-rule mapping.
 *
 * Idea 00903: map client-side geo-fenced content rules to regional endpoints
 * on an authorized target.
 *
 * No network calls: the module scans page JavaScript/HTML for country and
 * region gating (country-code conditionals, geolocation API usage, CDN
 * country headers, regional path prefixes) and maps each gated region to
 * the endpoints it unlocks, giving the hunter the target's full
 * region-by-region surface. Defensive surface-mapping only.
 */

const COUNTRY_CODE = /^[A-Z]{2}$/;

const REGION_PATH_PREFIXES = [
  'us', 'uk', 'eu', 'ca', 'au', 'in', 'de', 'fr', 'es', 'it', 'nl', 'br',
  'mx', 'jp', 'kr', 'cn', 'sg', 'ae', 'sa', 'za', 'global', 'intl',
];

/**
 * @typedef {Object} GeofenceRule
 * @property {string} region - Region key (ISO country code or region label).
 * @property {string} kind - One of 'country-condition', 'geolocation', 'path-prefix', 'header-gate'.
 * @property {string[]} endpoints - Regional endpoints unlocked by the rule.
 * @property {string} evidence - Source excerpt.
 */

/**
 * Map geo-fenced content rules to regional endpoints.
 * @param {string} codeText - JavaScript source and/or page HTML.
 * @param {{maxRules?: number}} [options]
 * @returns {{rules: GeofenceRule[], regions: string[], endpoints: string[], stats: object}}
 */
export function mapGeofenceRules(codeText = '', options = {}) {
  const { maxRules = 50 } = options;
  const text = String(codeText);
  const lines = text.split(/\r?\n/);
  const rules = [];
  const regions = new Set();

  const addRule = (region, kind, endpoints, evidence) => {
    if (rules.length >= maxRules) return;
    regions.add(region);
    rules.push({
      region,
      kind,
      endpoints: [...new Set(endpoints)].slice(0, 15),
      evidence: evidence.slice(0, 240),
    });
  };

  const routeOf = line => {
    const out = [];
    const re = /['"](?:https?:)?\/\/[^'"]+['"]|['"]\/[a-z0-9_.\-\/]{2,140}['"]/gi;
    let m;
    while ((m = re.exec(line)) !== null) {
      const r = m[0].replace(/^['"]|['"]$/g, '');
      if (!/\.(js|css|png|jpe?g|svg|woff2?|map)$/i.test(r)) out.push(r);
    }
    return out;
  };

  // 1) Country-code conditionals: if (countryCode === 'DE') { ... }.
  const ccPattern =
    /(?:country|countryCode|geo\.country|userCountry|cf-ipcountry)\s*(?:===?|!==?|in|includes)\s*['"]?([A-Za-z]{2})['"]?/g;
  for (const raw of lines) {
    const line = raw.trim();
    let m;
    while ((m = ccPattern.exec(line)) !== null) {
      const cc = m[1].toUpperCase();
      if (!COUNTRY_CODE.test(cc)) continue;
      addRule(cc, 'country-condition', routeOf(line), line);
    }
  }

  // 2) Geolocation API usage: navigator.geolocation / IP-geolocation endpoints.
  for (const raw of lines) {
    const line = raw.trim();
    if (!/navigator\.geolocation|getCurrentPosition|watchPosition|ipapi|ip-api|geojs|ipstack|maxmind/i.test(line)) continue;
    const endpoints = routeOf(line).concat(
      [...line.matchAll(/https?:\/\/[a-z0-9_.\-]{3,80}\.[a-z]{2,}/gi)].map(x => x[0]),
    );
    addRule('geolocation-api', 'geolocation', endpoints, line);
  }

  // 3) Regional path prefixes: /us/pricing, /de/shop, /intl/...
  const prefixPattern = new RegExp(
    `['"]\\/(${REGION_PATH_PREFIXES.join('|')})(?:\\/|['"])`,
    'gi',
  );
  for (const raw of lines) {
    const line = raw.trim();
    let m;
    while ((m = prefixPattern.exec(line)) !== null) {
      addRule(m[1].toUpperCase(), 'path-prefix', routeOf(line), line);
    }
  }

  // 4) CDN country header gates: x-geo-country, cf-ipcountry, cloudfront-viewer-country.
  const headerPattern =
    /(?:x-geo-country|cf-ipcountry|cloudfront-viewer-country|true-client-ip)\s*[:=]\s*['"]?([A-Za-z]{2})['"]?/gi;
  for (const raw of lines) {
    const line = raw.trim();
    let m;
    while ((m = headerPattern.exec(line)) !== null) {
      const cc = m[1].toUpperCase();
      if (!COUNTRY_CODE.test(cc)) continue;
      addRule(cc, 'header-gate', routeOf(line), line);
    }
  }

  // Dedupe identical (region, kind, endpoints) rules.
  const seen = new Set();
  const unique = rules.filter(r => {
    const key = `${r.region}|${r.kind}|${r.endpoints.join(',')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const endpoints = [...new Set(unique.flatMap(r => r.endpoints))];
  return {
    rules: unique,
    regions: [...regions],
    endpoints,
    stats: {
      rules: unique.length,
      regions: regions.size,
      endpoints: endpoints.length,
      lines: lines.length,
    },
  };
}

/**
 * Build a report finding from the mapping result.
 * @param {ReturnType<typeof mapGeofenceRules>} result
 */
export function geofenceFinding(result) {
  return {
    title: `Geofencing-rule mapping — ${result.stats.regions} region(s), ${result.stats.endpoints} regional endpoint(s)`,
    severity: 'Info',
    confidence: result.stats.rules > 0 ? 'high' : 'low',
    regions: result.regions.slice(0, 30),
    endpoints: result.endpoints.slice(0, 30),
    evidence:
      `${result.stats.rules} geo-fenced rule(s) mapped to regional endpoints; ` +
      `regions: ${result.regions.slice(0, 12).join(', ') || 'none'}.`,
  };
}

export const GEOFENCE_RULE_MAPPER = {
  mapGeofenceRules,
  geofenceFinding,
  REGION_PATH_PREFIXES,
};
export default GEOFENCE_RULE_MAPPER;
