/**
 * onypheGeoIntel.js — Onyphe geolocation/ASN expansion for autonomous bug bounty.
 *
 * Implements idea-bank item 00160: expand from known IPs via Onyphe's ASN
 * and geolocation correlations.
 *
 * Onyphe enriches every asset with ASN, geolocation (city/country), and
 * organization data. Infrastructure operated by one organization tends to
 * cluster in the same ASN and geographic region. This module takes
 * Onyphe-style asset records, builds the ASN × geo × org signature of the
 * confirmed target assets, and finds sibling assets in supplied candidate
 * records that share that signature — expanding the asset list for scoping.
 *
 * All functions are pure and side-effect free: they operate on Onyphe API
 * result objects the caller obtained through a legitimate Onyphe account
 * during an authorized engagement. No scanning is performed here.
 */

/**
 * Normalize an Onyphe asset record to a flat shape.
 * @param {object} r Raw record: { ip, asn?, organization?, city?, country?, ... }.
 * @returns {{ip:string, asn:string|null, org:string|null, city:string|null, country:string|null, ports:number[]}|null}
 */
export function normalizeOnypheAsset(r) {
  if (!r || typeof r !== 'object') return null;
  const ip = r.ip || r.address;
  if (typeof ip !== 'string') return null;
  const ports = new Set();
  for (const p of r.ports || []) {
    const n = Number(p);
    if (Number.isInteger(n) && n > 0 && n < 65536) ports.add(n);
  }
  return {
    ip,
    asn: r.asn != null ? String(r.asn).replace(/^AS/i, '') : (r.asnumber != null ? String(r.asnumber) : null),
    org: typeof r.organization === 'string' ? r.organization.trim().toLowerCase() : (typeof r.org === 'string' ? r.org.trim().toLowerCase() : null),
    city: typeof r.city === 'string' ? r.city.trim().toLowerCase() : null,
    country: typeof r.country === 'string' ? r.country.trim().toUpperCase() : (typeof r.country_code === 'string' ? r.country_code.trim().toUpperCase() : null),
    ports: [...ports].sort((a, b) => a - b),
  };
}

/**
 * Derive the ASN / geo / org signature of the confirmed target assets.
 * @param {Array<object>} confirmedAssets Onyphe records of confirmed target assets.
 * @returns {{asns:Set<string>, orgs:Set<string>, cities:Set<string>, countries:Set<string>}}
 */
export function targetSignature(confirmedAssets) {
  const sig = { asns: new Set(), orgs: new Set(), cities: new Set(), countries: new Set() };
  for (const r of Array.isArray(confirmedAssets) ? confirmedAssets : []) {
    const n = normalizeOnypheAsset(r);
    if (!n) continue;
    if (n.asn) sig.asns.add(n.asn);
    if (n.org) sig.orgs.add(n.org);
    if (n.city) sig.cities.add(n.city);
    if (n.country) sig.countries.add(n.country);
  }
  return sig;
}

/**
 * Score candidate assets against the target signature and keep the matches.
 * Scoring: same org = 40, same ASN = 25, same city = 15, same country = 5.
 * @param {{asns:Set, orgs:Set, cities:Set, countries:Set}} signature Output of targetSignature.
 * @param {Array<object>} candidates Onyphe records to evaluate.
 * @returns {Array<{ip:string, score:number, matchedOn:string[], asn:string|null, org:string|null, city:string|null, country:string|null}>} sorted by score.
 */
export function expandByGeoAsn(signature, candidates) {
  const rows = [];
  for (const r of Array.isArray(candidates) ? candidates : []) {
    const n = normalizeOnypheAsset(r);
    if (!n) continue;
    let score = 0;
    const matchedOn = [];
    if (n.org && signature.orgs.has(n.org)) { score += 40; matchedOn.push(`org:${n.org}`); }
    if (n.asn && signature.asns.has(n.asn)) { score += 25; matchedOn.push(`asn:${n.asn}`); }
    if (n.city && signature.cities.has(n.city)) { score += 15; matchedOn.push(`city:${n.city}`); }
    if (n.country && signature.countries.has(n.country)) { score += 5; matchedOn.push(`country:${n.country}`); }
    if (score > 0) {
      rows.push({ ip: n.ip, score, matchedOn, asn: n.asn, org: n.org, city: n.city, country: n.country });
    }
  }
  return rows.sort((a, b) => b.score - a.score || a.ip.localeCompare(b.ip));
}

/**
 * Summarize a candidate set into ASN × country buckets for scoping reports:
 * shows where the expanded assets concentrate.
 * @param {Array<object>} expanded Output of expandByGeoAsn.
 * @returns {Array<{asn:string, country:string, count:number, ips:string[]}>} sorted by count.
 */
export function summarizeGeoDistribution(expanded) {
  const map = new Map();
  for (const e of Array.isArray(expanded) ? expanded : []) {
    const key = `${e.asn || 'unknown'}|${e.country || 'unknown'}`;
    if (!map.has(key)) map.set(key, { asn: e.asn || 'unknown', country: e.country || 'unknown', count: 0, ips: [] });
    const b = map.get(key);
    b.count += 1;
    b.ips.push(e.ip);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}
