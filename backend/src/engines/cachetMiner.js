/**
 * cachetMiner.js — Cachet status instance host extraction.
 *
 * Covers idea-bank item 00250:
 *  - 00250 Cachet instance discovery: find the org's Cachet status
 *    instances and read their component lists.
 *
 * Pure functions only: callers discover Cachet instances and fetch their
 * component lists themselves (respecting rate limits) and pass the raw API
 * payloads in. No live HTTP here. Functions parse the Cachet API component
 * payloads (names, descriptions, links) for hostnames tied to the target
 * organization, and classify components by their operational role.
 */

import { normalizeHostname, hostFromUrl } from './gitIntel.js';

const HOSTNAME_RE = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}\b/gi;

/**
 * Classify a Cachet component by name/description context.
 *
 * @param {string} name component name
 * @param {string} [description] component description
 * @returns {'api'|'web'|'database'|'mail'|'dns'|'infrastructure'|'other'}
 */
export function classifyCachetComponent(name = '', description = '') {
  const ctx = `${name} ${description}`.toLowerCase();
  if (/\bapi\b|graphql|rest|endpoint/.test(ctx)) return 'api';
  if (/mail|smtp|imap|newsletter/.test(ctx)) return 'mail';
  if (/\bdns\b|nameserver/.test(ctx)) return 'dns';
  if (/db\b|database|postgres|mysql|redis|queue/.test(ctx)) return 'database';
  if (/website|web|portal|dashboard|frontend/.test(ctx)) return 'web';
  if (/server|infra|network|cdn|host|cluster/.test(ctx)) return 'infrastructure';
  return 'other';
}

/**
 * Parse a Cachet API components payload into target-related hosts.
 *
 * @param {{data?: {id?: number, name?: string, description?: string, link?: string, status?: number, group_id?: number}[]}} payload Cachet /api/v1/components payload
 * @param {string} rootDomain
 * @returns {{component: string, host: string, linkHost: string, kind: string, status: number, evidence: string}[]}
 */
export function parseCachetComponents(payload = {}, rootDomain) {
  const root = normalizeHostname(rootDomain);
  if (!root) return [];
  const results = [];

  for (const comp of payload?.data || []) {
    const name = String(comp?.name || '');
    const description = String(comp?.description || '');
    const kind = classifyCachetComponent(name, description);
    const linkHost = normalizeHostname(hostFromUrl(String(comp?.link || '')));

    const seen = new Set();
    for (const m of `${name} ${description}`.matchAll(HOSTNAME_RE)) {
      const h = normalizeHostname(m[0]);
      if (!h || seen.has(h)) continue;
      seen.add(h);
      if (!(h === root || h.endsWith(`.${root}`) || h.includes(root))) continue;
      results.push({
        component: name,
        host: h,
        linkHost,
        kind,
        status: Number(comp?.status ?? 0),
        evidence: m[0],
      });
    }
    // The component's link field itself can name an infrastructure host.
    if (
      linkHost &&
      (linkHost === root || linkHost.endsWith(`.${root}`) || linkHost.includes(root))
    ) {
      results.push({
        component: name,
        host: linkHost,
        linkHost,
        kind,
        status: Number(comp?.status ?? 0),
        evidence: String(comp?.link || ''),
      });
    }
  }

  return results.sort(
    (a, b) => a.host.localeCompare(b.host) || a.component.localeCompare(b.component)
  );
}

/**
 * Parse Cachet incident payloads for hostnames named in incident messages.
 *
 * @param {{data?: {name?: string, message?: string, status?: string}[]}} payload Cachet /api/v1/incidents payload
 * @param {string} rootDomain
 * @returns {{host: string, incident: string, evidence: string}[]}
 */
export function parseCachetIncidents(payload = {}, rootDomain) {
  const root = normalizeHostname(rootDomain);
  if (!root) return [];
  const results = [];
  for (const inc of payload?.data || []) {
    const name = String(inc?.name || '');
    const message = String(inc?.message || '');
    const seen = new Set();
    for (const m of `${name} ${message}`.matchAll(HOSTNAME_RE)) {
      const h = normalizeHostname(m[0]);
      if (!h || seen.has(h)) continue;
      seen.add(h);
      if (h === root || h.endsWith(`.${root}`) || h.includes(root)) {
        results.push({ host: h, incident: name, evidence: m[0] });
      }
    }
  }
  return results.sort(
    (a, b) => a.host.localeCompare(b.host) || a.incident.localeCompare(b.incident)
  );
}

/**
 * Combine Cachet components and incidents mining for one instance.
 *
 * @param {{components?: object, incidents?: object}} payloads
 * @param {string} rootDomain
 * @returns {{components: object[], incidents: object[]}}
 */
export function mineCachetInstance(payloads = {}, rootDomain) {
  return {
    components: parseCachetComponents(payloads?.components || {}, rootDomain),
    incidents: parseCachetIncidents(payloads?.incidents || {}, rootDomain),
  };
}
