/**
 * davWellKnownProbe.js — CalDAV/CardDAV well-known probing (idea 00118).
 *
 * Probing /.well-known/caldav and /.well-known/carddav exposes groupware
 * hosts (calendar/contacts servers), which often run distinct, less-hardened
 * stacks. This module interprets recorded probe responses into findings.
 */

/**
 * Canonical well-known probe paths for DAV services.
 * @param {string} base — e.g. "https://example.com"
 * @returns {{ caldav: string, carddav: string }}
 */
export function davWellKnownUrls(base) {
  const u = new URL(String(base));
  return {
    caldav: `${u.origin}/.well-known/caldav`,
    carddav: `${u.origin}/.well-known/carddav`,
  };
}

/**
 * Interpret a single DAV well-known probe response.
 * @param {object} probe — { url, status, headers: {}, redirects: [{status, location}...], finalUrl }
 * @param {string} service — "caldav" | "carddav"
 * @returns {{ found: boolean, service, davHost: string|null, status, evidence: string, notes: string[] }}
 */
export function interpretDavProbe(probe = {}, service = 'caldav') {
  const notes = [];
  const redirects = Array.isArray(probe.redirects) ? probe.redirects : [];
  const status = probe.status || 0;

  if (!probe.url) {
    return { found: false, service, davHost: null, status, evidence: '', notes: ['Empty probe result'] };
  }

  const chain = [probe.url, ...redirects.map((r) => r.location), probe.finalUrl].filter(Boolean);
  let davHost = null;
  try {
    davHost = new URL(probe.finalUrl || probe.url).hostname;
  } catch {
    notes.push('Final URL unparseable');
  }

  const startHost = (() => {
    try { return new URL(probe.url).hostname; } catch { return null; }
  })();

  const evidence = `GET ${probe.url} → ${status}${redirects.length ? `, ${redirects.length} redirect(s)` : ''} → ${probe.finalUrl || probe.url}`;
  let found = false;

  if (redirects.length > 0 || probe.finalUrl) {
    found = true;
    if (davHost && startHost && davHost !== startHost) {
      notes.push(`${service} handled on separate host ${davHost} — groupware infrastructure mapped`);
    }
  } else if (status === 200 || status === 401 || status === 207 || status === 405) {
    found = true;
    notes.push(`${service} endpoint responds directly on target host (status ${status}) — DAV service likely present`);
  }

  if (status === 404) {
    notes.push(`${service} not advertised via well-known on this host`);
  }

  return { found, service, davHost, status, evidence, notes };
}

/**
 * Combine caldav + carddav probe results into one assessment.
 * @param {object} caldavResult — output of interpretDavProbe for caldav
 * @param {object} carddavResult — output of interpretDavProbe for carddav
 * @returns {{ groupwareDetected: boolean, hosts: string[], notes: string[] }}
 */
export function assessGroupware(caldavResult = {}, carddavResult = {}) {
  const notes = [];
  const hosts = new Set();
  for (const r of [caldavResult, carddavResult]) {
    if (r && r.found && r.davHost) hosts.add(r.davHost);
  }
  if (hosts.size > 0) notes.push(`Groupware host(s) identified: ${[...hosts].join(', ')}`);
  else notes.push('No groupware service detected via DAV well-known paths');
  return { groupwareDetected: hosts.size > 0, hosts: [...hosts], notes };
}

export const DAV_WELLKNOWN_PROBE = { davWellKnownUrls, interpretDavProbe, assessGroupware };
export default DAV_WELLKNOWN_PROBE;
