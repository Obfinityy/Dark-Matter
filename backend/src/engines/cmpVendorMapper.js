/**
 * cmpVendorMapper.js — Cookie-banner vendor mapping.
 *
 * Idea 00905: identify consent-management platform (CMP) vendors and their
 * config hosts from page code on an authorized target.
 *
 * No network calls: the module scans page JavaScript/HTML for the
 * well-known signatures of major CMP vendors and extracts the script URLs
 * and config hosts each vendor uses, mapping the target's consent stack
 * for authorized recon. Defensive surface-mapping only.
 */

const CMP_VENDORS = [
  {
    vendor: 'OneTrust',
    markers: [/onetrust/i, /optanon/i],
    scriptHosts: [/cdn\.cookielaw\.org/i, /onetrust\.com/i],
  },
  {
    vendor: 'Cookiebot (Usercentrics)',
    markers: [/cookiebot/i, /uc\.js|consent\.cookiebot\.com/i],
    scriptHosts: [/consent\.cookiebot\.com/i, /cookiebot\.com/i],
  },
  {
    vendor: 'TrustArc',
    markers: [/trustarc/i, /truste\.com/i],
    scriptHosts: [/consent\.trustarc\.com/i, /truste\.com/i],
  },
  {
    vendor: 'Osano',
    markers: [/osano/i],
    scriptHosts: [/cmp\.osano\.com/i, /osano\.com/i],
  },
  {
    vendor: 'Quantcast Choice',
    markers: [/quantcast/i, /quantserve\.com/i],
    scriptHosts: [/quantcast\.com/i, /quantserve\.com/i],
  },
  {
    vendor: 'Didomi',
    markers: [/didomi/i],
    scriptHosts: [/sdk\.privacy-center\.org|didomi\.io/i],
  },
  {
    vendor: 'Sourcepoint',
    markers: [/sourcepoint|_sp_/i],
    scriptHosts: [/sourcepoint\.com/i],
  },
  {
    vendor: 'CookieYes',
    markers: [/cookieyes/i],
    scriptHosts: [/cdn-cookieyes\.com/i, /cookieyes\.com/i],
  },
  {
    vendor: 'Termly',
    markers: [/termly/i],
    scriptHosts: [/app\.termly\.io/i, /termly\.io/i],
  },
  {
    vendor: 'Usercentrics',
    markers: [/usercentrics/i],
    scriptHosts: [/app\.usercentrics\.eu/i, /usercentrics\.eu/i],
  },
  {
    vendor: 'Cookie Information',
    markers: [/cookieinformation/i],
    scriptHosts: [/cookieinformation\.com/i],
  },
  {
    vendor: 'Secure Privacy',
    markers: [/secureprivacy/i],
    scriptHosts: [/secureprivacy\.ai/i],
  },
  {
    vendor: 'Ketch',
    markers: [/\bketch\b/i],
    scriptHosts: [/global\.ketchcdn\.com/i, /ketchcdn\.com/i],
  },
  {
    vendor: 'Transcend',
    markers: [/transcend/i, /cdn\.transcend\.io/i],
    scriptHosts: [/cdn\.transcend\.io/i],
  },
  {
    vendor: 'Clym',
    markers: [/\bclym\b/i],
    scriptHosts: [/widget\.clym\.io/i],
  },
];

/**
 * @typedef {Object} CmpVendorMapping
 * @property {string} vendor - CMP vendor name.
 * @property {string[]} markers - Signature fragments that matched.
 * @property {string[]} scriptUrls - Full script URLs pointing at vendor hosts.
 * @property {string[]} configHosts - Hosts serving CMP config/data (IAB lists, portals).
 * @property {number} confidence - 0..1 vendor-identification confidence.
 */

/**
 * Identify CMP vendors and their config hosts from page code.
 * @param {string} codeText - JavaScript source and/or page HTML.
 * @param {{maxVendors?: number}} [options]
 * @returns {{vendors: CmpVendorMapping[], scriptUrls: string[], configHosts: string[], stats: object}}
 */
export function mapCmpVendors(codeText = '', options = {}) {
  const { maxVendors = 20 } = options;
  const text = String(codeText);
  const vendors = [];

  const scriptUrls = [];
  const scriptRe =
    /<script[^>]+src=["']([^"']+)["']/gi;
  let sm;
  while ((sm = scriptRe.exec(text)) !== null) scriptUrls.push(sm[1]);
  const urlRe = /https?:\/\/[a-z0-9_.\-:]{3,120}(?:\/[a-z0-9_.\-\/?#=&%:;+]{0,160})?/gi;
  let um;
  while ((um = urlRe.exec(text)) !== null) scriptUrls.push(um[0]);
  const uniqueScripts = [...new Set(scriptUrls)];

  const hostOf = url => {
    try {
      return new URL(url.startsWith('//') ? `https:${url}` : url).hostname;
    } catch {
      return null;
    }
  };

  for (const sig of CMP_VENDORS) {
    if (vendors.length >= maxVendors) break;
    const markers = sig.markers.map(re => re.source).filter(src =>
      sig.markers.some(re => re.test(text) && re.source === src),
    );
    if (!markers.length) continue;

    const vendorScripts = uniqueScripts.filter(u =>
      sig.scriptHosts.some(re => re.test(u)),
    );
    const vendorHosts = [...new Set(uniqueScripts.map(hostOf).filter(Boolean))]
      .filter(h => sig.scriptHosts.some(re => re.test(h)));
    const markerHits = sig.markers.filter(re => re.test(text)).length;

    vendors.push({
      vendor: sig.vendor,
      markers,
      scriptUrls: vendorScripts.slice(0, 10),
      configHosts: vendorHosts,
      confidence: Math.min(1, 0.4 + markerHits * 0.2 + (vendorScripts.length ? 0.3 : 0)),
    });
  }

  vendors.sort((a, b) => b.confidence - a.confidence);
  const configHosts = [...new Set(vendors.flatMap(v => v.configHosts))];

  return {
    vendors,
    scriptUrls: [...new Set(vendors.flatMap(v => v.scriptUrls))],
    configHosts,
    stats: {
      vendors: vendors.length,
      scriptUrls: new Set(vendors.flatMap(v => v.scriptUrls)).size,
      configHosts: configHosts.length,
      primary: vendors[0]?.vendor ?? null,
    },
  };
}

/**
 * Build a report finding from the mapping result.
 * @param {ReturnType<typeof mapCmpVendors>} result
 */
export function cmpVendorFinding(result) {
  return {
    title: `Cookie-banner vendor mapping — ${result.stats.vendors} CMP vendor(s) detected`,
    severity: 'Info',
    confidence: result.stats.vendors > 0 ? 'high' : 'low',
    vendors: result.vendors.map(v => ({
      vendor: v.vendor,
      confidence: v.confidence,
      configHosts: v.configHosts,
    })),
    configHosts: result.configHosts.slice(0, 20),
    evidence:
      `Primary vendor: ${result.stats.primary ?? 'none'}; ` +
      `${result.stats.configHosts} CMP config host(s) mapped.`,
  };
}

export const CMP_VENDOR_MAPPER = {
  mapCmpVendors,
  cmpVendorFinding,
  CMP_VENDORS,
};
export default CMP_VENDOR_MAPPER;
