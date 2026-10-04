/**
 * statuspageApiMiner.js — Statuspage.io component API mining.
 *
 * Covers idea-bank item 00248:
 *  - 00248 Statuspage.io component API mining: query the public Statuspage
 *    API for components that name internal services and hosts.
 *
 * Pure functions only: callers query the public Statuspage API themselves
 * (respecting Atlassian rate limits) and pass the raw response objects in.
 * No live HTTP here. Functions parse components, groups, scheduled
 * maintenances, and incidents for hostnames that name internal services,
 * endpoints, and regions related to the target organization.
 */

import { normalizeHostname } from './gitIntel.js';

const HOSTNAME_RE = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}\b/gi;

/**
 * Scan an arbitrary text field for target-related hostnames.
 *
 * @param {string} text
 * @param {string} root
 * @returns {string[]}
 */
function targetHostsInText(text, root) {
  const found = new Set();
  for (const m of String(text || '').matchAll(HOSTNAME_RE)) {
    const h = normalizeHostname(m[0]);
    if (!h) continue;
    if (h === root || h.endsWith(`.${root}`) || h.includes(root)) found.add(h);
  }
  return [...found];
}

/**
 * Mine the components endpoint payload (/api/v2/components.json).
 *
 * @param {{components?: {name?: string, group_id?: string, status?: string, only_show_if_degraded?: boolean}[], components_group?: {id?: string, name?: string}[]}} payload
 * @param {string} rootDomain
 * @returns {{host: string, component: string, group: string, status: string, kind: 'component'|'group'}[]}
 */
export function mineStatuspageComponents(payload = {}, rootDomain) {
  const root = normalizeHostname(rootDomain);
  if (!root) return [];
  const groups = new Map();
  for (const g of payload?.components_group || []) {
    groups.set(String(g?.id || ''), String(g?.name || ''));
  }
  const results = [];
  for (const [gid, gname] of groups) {
    for (const h of targetHostsInText(gname, root)) {
      results.push({ host: h, component: '', group: gname, status: '', kind: 'group' });
    }
  }
  for (const comp of payload?.components || []) {
    const name = String(comp?.name || '');
    const group = groups.get(String(comp?.group_id || '')) || '';
    for (const h of targetHostsInText(`${name} ${group}`, root)) {
      results.push({
        host: h, component: name, group,
        status: String(comp?.status || ''), kind: 'component',
      });
    }
  }
  return results.sort((a, b) => a.host.localeCompare(b.host) || a.component.localeCompare(b.component));
}

/**
 * Mine scheduled-maintenance payloads (/api/v2/scheduled-maintenances.json)
 * for hostnames named in maintenance descriptions.
 *
 * @param {{scheduled_maintenances?: {name?: string, status?: string, incident_updates?: {body?: string}[]}[]}} payload
 * @param {string} rootDomain
 * @returns {{host: string, maintenance: string, status: string, evidence: string}[]}
 */
export function mineStatuspageMaintenances(payload = {}, rootDomain) {
  const root = normalizeHostname(rootDomain);
  if (!root) return [];
  const results = [];
  for (const mt of payload?.scheduled_maintenances || []) {
    const name = String(mt?.name || '');
    const bodies = [name];
    for (const upd of mt?.incident_updates || []) {
      bodies.push(String(upd?.body || ''));
    }
    for (const body of bodies) {
      for (const h of targetHostsInText(body, root)) {
        results.push({
          host: h, maintenance: name,
          status: String(mt?.status || ''), evidence: body.slice(0, 160),
        });
      }
    }
  }
  return results.sort((a, b) => a.host.localeCompare(b.host) || a.maintenance.localeCompare(b.maintenance));
}

/**
 * Mine incident payloads (/api/v2/incidents.json) for hostnames named in
 * incident names and updates.
 *
 * @param {{incidents?: {name?: string, status?: string, incident_updates?: {body?: string}[]}[]}} payload
 * @param {string} rootDomain
 * @returns {{host: string, incident: string, status: string, evidence: string}[]}
 */
export function mineStatuspageIncidents(payload = {}, rootDomain) {
  const root = normalizeHostname(rootDomain);
  if (!root) return [];
  const results = [];
  for (const inc of payload?.incidents || []) {
    const name = String(inc?.name || '');
    const bodies = [name];
    for (const upd of inc?.incident_updates || []) {
      bodies.push(String(upd?.body || ''));
    }
    for (const body of bodies) {
      for (const h of targetHostsInText(body, root)) {
        results.push({
          host: h, incident: name,
          status: String(inc?.status || ''), evidence: body.slice(0, 160),
        });
      }
    }
  }
  return results.sort((a, b) => a.host.localeCompare(b.host) || a.incident.localeCompare(b.incident));
}
