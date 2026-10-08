/**
 * adSrvSiteMapper.js — AD site/DC mapping from DNS SRV records.
 *
 * Active Directory publishes _ldap._tcp.<domain>, _ldap._tcp.<site>._sites.<domain>,
 * _kerberos._tcp.<domain>, and _gc._tcp.<domain> SRV records. An authorized
 * agent analyzes observed SRV answers to enumerate domain controllers,
 * their sites, priorities/weights, and KDC/GC services.
 *
 * Defensive framing: analysis of publicly queryable DNS data. Read-only.
 */

/** AD-relevant SRV record names. */
const AD_SRV_RECORDS = [
  '_ldap._tcp',
  '_kerberos._tcp',
  '_gc._tcp',
  '_kpasswd._tcp',
  '_ldap._tcp.dc._msdcs',
  '_kerberos._tcp.dc._msdcs',
  '_gc._tcp.dc._msdcs',
];

/**
 * Parse observed SRV records into an AD topology map.
 *
 * @param {Object} input
 * @param {string} [input.domain] - AD domain observed (e.g. corp.example.com).
 * @param {Array<{name:string,priority:number,weight:number,port:number,target:string}>} [input.records] - Observed SRV answers.
 * @returns {Object} Site/DC mapping finding.
 */
export function mapAdSites({ domain = '', records = [] } = {}) {
  const sites = {};
  const services = {};
  const controllers = {};

  for (const r of records) {
    const name = String(r.name || '').toLowerCase();
    const target = String(r.target || '').replace(/\.$/, '');
    if (!target) continue;

    // Extract site from _sites.<site>._msdcs-style or _ldap._tcp.<site>._sites.<domain> names.
    const siteMatch =
      name.match(/_sites\.([a-z0-9-]+)/i) || name.match(/\._tcp\.([a-z0-9-]+)\._sites\./i);
    const site = siteMatch ? siteMatch[1] : 'Default-First-Site-Name';

    if (!sites[site]) sites[site] = [];
    sites[site].push({
      target,
      priority: r.priority ?? 0,
      weight: r.weight ?? 0,
      port: r.port ?? 0,
      record: r.name,
    });

    const serviceKey = name.startsWith('_ldap')
      ? 'ldap'
      : name.startsWith('_kerberos')
        ? 'kerberos'
        : name.startsWith('_gc')
          ? 'global-catalog'
          : name.startsWith('_kpasswd')
            ? 'kpasswd'
            : 'other';
    if (!services[serviceKey]) services[serviceKey] = [];
    services[serviceKey].push(target);

    if (!controllers[target]) controllers[target] = { site, services: [] };
    if (!controllers[target].services.includes(serviceKey))
      controllers[target].services.push(serviceKey);
  }

  const dcList = Object.keys(controllers);
  const siteNames = Object.keys(sites);

  return {
    type: 'DNS SRV-Based AD Mapping',
    mapped: dcList.length > 0,
    confidence: dcList.length ? 'high' : 'low',
    evidence: dcList.length
      ? `AD topology for ${domain || 'unknown domain'}: ${dcList.length} controller(s) across ${siteNames.length} site(s) from SRV records.`
      : `No AD SRV records observed for ${domain || 'unknown domain'} — no topology extractable.`,
    domain: domain || undefined,
    sites,
    services,
    domainControllers: controllers,
    exposureNote: dcList.length
      ? 'Enumerated DC hostnames are now in scope for authorized follow-up checks (signing, pre-auth, GC).'
      : undefined,
  };
}

/**
 * Rank controllers by SRV priority/weight (lowest priority first, as clients do).
 * @param {Object} sitesMap - The `sites` object returned by mapAdSites.
 * @returns {Object} Per-site ordered controller preference lists.
 */
export function rankControllersByPreference(sitesMap = {}) {
  const ranked = {};
  for (const [site, entries] of Object.entries(sitesMap)) {
    ranked[site] = [...entries].sort((a, b) => a.priority - b.priority || b.weight - a.weight);
  }
  return ranked;
}

export const AD_SRV_SITE_MAPPER = {
  mapAdSites,
  rankControllersByPreference,
  AD_SRV_RECORDS,
};
export default AD_SRV_SITE_MAPPER;
