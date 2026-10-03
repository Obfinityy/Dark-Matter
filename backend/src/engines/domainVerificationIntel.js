/**
 * domainVerificationIntel.js — SaaS domain-verification token harvesters
 * (ideas 00097, 00098, 00099, 00100).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent. SaaS
 * vendors ask domain owners to prove control by publishing TXT records
 * (`atlassian-domain-verification=…`, `google-site-verification=…`,
 * `msvalidate.01=…`, `facebook-domain-verification=…`). Harvesting those
 * tokens maps exactly which third-party tenancies — Atlassian, Google,
 * Microsoft/Bing, Meta — are tied to each domain or subdomain, which is
 * the fastest route to the target's real SaaS attack surface.
 *
 * All functions are pure: they analyze observed DNS record data supplied by
 * the caller and never perform network lookups themselves.
 */

import { flattenTxtData } from './dnsServiceLabelIntel.js';

/**
 * Provider definitions: how each vendor's verification token appears in DNS.
 * `match` tests a record; `tokenOf` extracts the token from the raw value.
 */
const PROVIDERS = {
  atlassian: {
    display: 'Atlassian',
    match: (name, value) =>
      name.startsWith('_atlassian-domain-verification.') ||
      /^atlassian-domain-verification\s*=/i.test(value),
    tokenOf: value => (value.match(/atlassian-domain-verification\s*=\s*([A-Za-z0-9+/=_-]+)/i) || [])[1] || value,
    tenancy: name => `Confirms an Atlassian Cloud (Jira/Confluence) tenancy verified against '${name}'. ` +
      'Tenant discovery: the token is stable per site — reuse it to correlate other domains claimed by the same tenant.',
  },
  google: {
    display: 'Google',
    match: (_name, value) => /^google-site-verification\s*=/i.test(value),
    tokenOf: value => (value.match(/google-site-verification\s*=\s*([A-Za-z0-9_.-]+)/i) || [])[1] || value,
    tenancy: name => `Search Console / Google Workspace verification for '${name}'. ` +
      'Maps which properties the organization manages in Google tooling — pivot into Workspace tenant and site ownership.',
  },
  bing: {
    display: 'Microsoft Bing',
    match: (_name, value) => /^msvalidate\.01\s*=/i.test(value),
    tokenOf: value => (value.match(/msvalidate\.01\s*=\s*([A-Za-z0-9]+)/i) || [])[1] || value,
    tenancy: name => `Bing Webmaster verification for '${name}'. ` +
      'A second, independent property-mapping source that corroborates the Google/Atlassian set.',
  },
  facebook: {
    display: 'Meta (Facebook)',
    match: (_name, value) => /^facebook-domain-verification\s*=/i.test(value),
    tokenOf: value => (value.match(/facebook-domain-verification\s*=\s*([A-Za-z0-9]+)/i) || [])[1] || value,
    tenancy: name => `Facebook Business Manager domain verification for '${name}'. ` +
      'Reveals Business Manager-linked domains — pivot into ad-account and app asset mapping.',
  },
};

/**
 * Core harvester shared by all four vendor miners.
 * @param {Array<{ name: string, type?: string, data?: string }>} records
 * @param {keyof PROVIDERS} providerKey
 */
function harvestProvider(records, providerKey) {
  const provider = PROVIDERS[providerKey];
  const seen = new Set();
  const verifiedNames = [];

  for (const r of records || []) {
    if (String(r?.type || 'TXT').toUpperCase() !== 'TXT') continue;
    const name = String(r?.name || '').toLowerCase().replace(/\.$/, '');
    const value = flattenTxtData(r?.data).trim();
    if (!name || !value || !provider.match(name, value)) continue;

    const token = provider.tokenOf(value);
    const dedupe = `${name}::${token}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);

    verifiedNames.push({
      name,
      token,
      detail: `${provider.display} verification token published at '${name}'. ${provider.tenancy(name)}`,
    });
  }

  const distinctDomains = [...new Set(verifiedNames.map(v => v.name))];
  return {
    provider: provider.display,
    verifiedNames,
    distinctDomains,
    count: verifiedNames.length,
    recommendation: verifiedNames.length > 0
      ? `${verifiedNames.length} ${provider.display} verification(s) across ${distinctDomains.length} ` +
        `name(s). Treat each verified name as a confirmed SaaS-linked asset and add it to the target's ` +
        `tenancy map before testing ${provider.display}-hosted surfaces.`
      : `No ${provider.display} verification tokens observed in the supplied records.`,
  };
}

/**
 * Idea 00097 — Atlassian domain-verification TXT mining.
 * Harvests `atlassian-domain-verification=` TXT values (and the
 * `_atlassian-domain-verification` CNAME-style label) that confirm SaaS
 * tenancies tied to subdomains.
 */
export function mineAtlassianVerification(records) {
  return harvestProvider(records, 'atlassian');
}

/**
 * Idea 00098 — Google site-verification TXT enumeration.
 * Collects `google-site-verification=` tokens to map Search Console /
 * Workspace-verified properties.
 */
export function enumerateGoogleVerification(records) {
  return harvestProvider(records, 'google');
}

/**
 * Idea 00099 — Bing site-verification record scan.
 * Enumerates `msvalidate.01=` TXT records for the same property-mapping purpose.
 */
export function scanBingVerification(records) {
  return harvestProvider(records, 'bing');
}

/**
 * Idea 00100 — Facebook domain-verification TXT harvest.
 * Collects `facebook-domain-verification=` tokens that reveal
 * Business Manager-linked domains.
 */
export function harvestFacebookVerification(records) {
  return harvestProvider(records, 'facebook');
}

/**
 * Cross-vendor rollup: harvests all four providers at once and builds a
 * per-domain tenancy map showing every SaaS vendor verified against each
 * name — the consolidated SaaS attack-surface view.
 *
 * @param {Array<{ name: string, type?: string, data?: string }>} records
 * @returns {{
 *   byProvider: Record<string, ReturnType<typeof harvestProvider>>,
 *   tenancyMap: Array<{ name: string, vendors: string[], tokenCount: number }>,
 *   multiTenantNames: Array<{ name: string, vendors: string[], note: string }>
 * }}
 */
export function harvestAllVerificationTokens(records) {
  const byProvider = {
    atlassian: mineAtlassianVerification(records),
    google: enumerateGoogleVerification(records),
    bing: scanBingVerification(records),
    facebook: harvestFacebookVerification(records),
  };

  const perName = new Map();
  for (const [key, result] of Object.entries(byProvider)) {
    for (const v of result.verifiedNames) {
      if (!perName.has(v.name)) perName.set(v.name, { name: v.name, vendors: [], tokenCount: 0 });
      const entry = perName.get(v.name);
      if (!entry.vendors.includes(byProvider[key].provider)) entry.vendors.push(byProvider[key].provider);
      entry.tokenCount += 1;
    }
  }

  const tenancyMap = [...perName.values()].sort((a, b) => b.vendors.length - a.vendors.length);
  const multiTenantNames = tenancyMap
    .filter(e => e.vendors.length > 1)
    .map(e => ({
      name: e.name,
      vendors: e.vendors,
      note: `'${e.name}' is verified with ${e.vendors.length} vendors (${e.vendors.join(', ')}): ` +
        'a high-value SaaS-linked asset — prioritize it for tenant and property enumeration.',
    }));

  return { byProvider, tenancyMap, multiTenantNames };
}
