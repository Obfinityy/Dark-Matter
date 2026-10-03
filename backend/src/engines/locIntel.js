/**
 * locIntel.js — LOC record facility inference (idea 00087).
 *
 * Defensive facility geolocation for an authorized bug-bounty agent.
 * DNS LOC records (RFC 1876) publish a host's latitude, longitude,
 * altitude and precision. Reading them geolocates the target's
 * facilities, which can then be correlated with known office and
 * datacenter assets to distinguish on-prem infrastructure from cloud
 * or CDN endpoints during an authorized assessment.
 *
 * Passive DNS lookups only. Use against operator-authorized targets only.
 */

import dns from 'node:dns';

const resolver = new dns.promises.Resolver();

/**
 * Parse a DNS LOC rdata string in textual form (RFC 1876 §4, as printed by
 * dig): "52 22 23.000 N 4 32 12.000 E 2.00m 10.00m 100.00m 10.00m"
 * (lat deg min sec N/S, lon deg min sec E/W, alt, size, horiz-prec, vert-prec).
 *
 * @param {string} rdata
 * @returns {{latitude:number, longitude:number, altitudeM:number, sizeM:number, horizontalPrecisionM:number, verticalPrecisionM:number, raw:string}|null}
 */
export function parseLocRecord(rdata) {
  const m = String(rdata || '').trim().match(
    /^(\d+)\s+(\d+)\s+([\d.]+)\s+([NSns])\s+(\d+)\s+(\d+)\s+([\d.]+)\s+([EWew])\s+(-?[\d.]+)m?\s+([\d.]+)m?\s+([\d.]+)m?\s+([\d.]+)m?\s*$/
  );
  if (!m) return null;
  const latDeg = Number(m[1]); const latMin = Number(m[2]); const latSec = Number(m[3]);
  const lonDeg = Number(m[5]); const lonMin = Number(m[6]); const lonSec = Number(m[7]);
  if (latDeg > 90 || lonDeg > 180 || latMin >= 60 || lonMin >= 60 || latSec >= 60 || lonSec >= 60) return null;
  let latitude = latDeg + latMin / 60 + latSec / 3600;
  if (m[4].toUpperCase() === 'S') latitude = -latitude;
  let longitude = lonDeg + lonMin / 60 + lonSec / 3600;
  if (m[8].toUpperCase() === 'W') longitude = -longitude;
  return {
    latitude: Number(latitude.toFixed(6)),
    longitude: Number(longitude.toFixed(6)),
    altitudeM: Number(m[9]),
    sizeM: Number(m[10]),
    horizontalPrecisionM: Number(m[11]),
    verticalPrecisionM: Number(m[12]),
    raw: String(rdata).trim(),
  };
}

/**
 * Rough regional label for a coordinate, for asset-correlation triage.
 *
 * @param {number} latitude
 * @param {number} longitude
 * @returns {string}
 */
export function regionLabel(latitude, longitude) {
  const lat = Number(latitude); const lon = Number(longitude);
  const hemiNS = lat >= 0 ? 'Northern' : 'Southern';
  let region = 'other';
  if (lat >= 24 && lat <= 72 && lon >= -170 && lon <= -50) region = 'North America';
  else if (lat >= -60 && lat <= 15 && lon >= -85 && lon <= -30) region = 'South America';
  else if (lat >= 35 && lat <= 72 && lon >= -12 && lon <= 45) region = 'Europe';
  else if (lat >= -35 && lat <= 37 && lon >= -20 && lon <= 55) region = 'Africa/Middle East';
  else if (lat >= 5 && lat <= 85 && lon >= 45 && lon <= 180) region = 'Asia';
  else if (lat <= -10 && lon >= 110 && lon <= 180) region = 'Oceania';
  return `${hemiNS} hemisphere — ${region}`;
}

/**
 * Analyze a host's LOC records and return defensive findings.
 *
 * @param {string} hostname
 * @param {string[]} records raw LOC rdata strings
 * @returns {{hostname:string, present:boolean, locations:Array, findings:Array<{severity:string,type:string,detail:string}>}}
 */
export function analyzeLocRecords(hostname, records) {
  const host = String(hostname || '').toLowerCase().replace(/\.$/, '');
  const findings = [];
  const locations = (records || []).map(parseLocRecord).filter(Boolean)
    .map(loc => ({ ...loc, region: regionLabel(loc.latitude, loc.longitude) }));
  if (locations.length === 0) return { hostname: host, present: false, locations, findings };
  findings.push({
    severity: 'info',
    type: 'loc-facility-geolocated',
    detail: `${host} publishes ${locations.length} LOC record(s): ${locations.map(l => `${l.latitude},${l.longitude} (${l.region}, ±${l.horizontalPrecisionM}m)`).join('; ')} — correlate with the target's known offices/datacenters to confirm on-prem vs cloud hosting.`,
  });
  const imprecise = locations.filter(l => l.horizontalPrecisionM >= 10000 || l.sizeM >= 10000);
  if (imprecise.length > 0) {
    findings.push({
      severity: 'low',
      type: 'loc-imprecise-record',
      detail: `${imprecise.length} LOC record(s) on ${host} carry very coarse precision (≥10 km) — useful for region confirmation but not facility identification.`,
    });
  }
  return { hostname: host, present: true, locations, findings };
}

/**
 * Idea 00087 — read DNS LOC records for candidate hostnames and geolocate
 * the target's facilities.
 *
 * @param {string} domain
 * @param {string[]} [hostnames] hostnames to probe
 * @returns {Promise<{domain:string, located:Array, summary:string[]}>}
 */
export async function geolocateFacilities(domain, hostnames = ['www', 'mail', 'vpn', 'dc', 'hq', 'office', 'colo', 'datacenter']) {
  const d = String(domain || '').trim().toLowerCase().replace(/\.$/, '');
  const targets = [...new Set([...hostnames.map(h => `${h}.${d}`), d])];
  const located = [];
  const summary = [];
  await Promise.all(targets.map(async (hostname) => {
    try {
      const raw = await resolver.resolve(hostname, 'LOC');
      const analysis = analyzeLocRecords(hostname, raw.map(r => String(r).trim()));
      if (analysis.present) located.push(analysis);
    } catch { /* no LOC — not a finding */ }
  }));
  located.sort((a, b) => a.hostname.localeCompare(b.hostname));
  if (located.length === 0) {
    summary.push('No LOC records found on probed hostnames — facility geolocation via DNS is unavailable (expected; LOC is rarely published).');
  } else {
    summary.push(`${located.length} host(s) geolocated via LOC: ${located.map(l => `${l.hostname} → ${l.locations.map(x => `${x.latitude},${x.longitude}`).join('/')}`).join(', ')}.`);
  }
  return { domain: d, located, summary };
}
