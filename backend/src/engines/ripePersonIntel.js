/**
 * ripePersonIntel.js — RIPE database person/role object pivoting.
 *
 * Implements Dark-Matter idea-bank item 00138 as a real, working defensive
 * asset-discovery capability for authorized targets:
 *
 *  00138 RIPE database person-object pivoting — pivot on RIPE
 *      person/role objects to find other resources maintained by the
 *      same admins.
 *
 * The caller supplies parsed RIPE database objects (person, role,
 * inetnum, aut-num, organisation). This engine extracts every contact
 * linkage (admin-c, tech-c, zone-c, mnt-by, org) on the target's
 * resources, then pivots: every OTHER inetnum/aut-num that references
 * the same person/role nic-handle or maintainer is a resource the same
 * admin team controls — sibling infrastructure for the hunt to scope.
 *
 * All functions are pure and side-effect free: they analyze supplied
 * objects. No network I/O happens in this module.
 */

/**
 * @typedef {object} RipeObject
 * @property {string} type   person | role | inetnum | aut-num | organisation | inet6num | route
 * @property {Record<string, string|string[]>} attrs  attribute → value(s)
 */

/**
 * Get all values of an attribute as an array (single values become
 * one-element arrays).
 * @param {RipeObject} obj
 * @param {string} attr
 * @returns {string[]}
 */
export function attrValues(obj, attr) {
  const v = obj?.attrs?.[attr];
  if (v == null) return [];
  return (Array.isArray(v) ? v : [v]).map((x) => String(x).trim()).filter(Boolean);
}

/**
 * Extract every person/role nic-handle and maintainer referenced by a
 * resource object (admin-c, tech-c, zone-c, mnt-by, org).
 * @param {RipeObject} obj
 * @returns {{contacts: string[], maintainers: string[], orgs: string[]}}
 */
export function resourceLinkages(obj) {
  const contacts = new Set();
  for (const attr of ['admin-c', 'tech-c', 'zone-c']) {
    for (const v of attrValues(obj, attr)) contacts.add(v.toUpperCase());
  }
  const maintainers = new Set(attrValues(obj, 'mnt-by').map((v) => v.toUpperCase()));
  const orgs = new Set(attrValues(obj, 'org').map((v) => v.toUpperCase()));
  return {
    contacts: [...contacts].sort(),
    maintainers: [...maintainers].sort(),
    orgs: [...orgs].sort(),
  };
}

/**
 * Identify a resource object (inetnum/inet6num/aut-num/route/organisation).
 * @param {RipeObject} obj
 * @returns {string|null}
 */
export function resourceId(obj) {
  if (!obj) return null;
  const primary = attrValues(obj, obj.type === 'aut-num' ? 'aut-num'
    : obj.type === 'organisation' ? 'organisation'
    : obj.type === 'route' ? 'route' : 'inetnum');
  if (primary.length > 0) return primary[0];
  const fallback = attrValues(obj, 'inet6num');
  return fallback.length > 0 ? fallback[0] : null;
}

/**
 * Pivot: for every contact/maintainer handle linked to the target's
 * resources, find ALL other resources in the supplied dataset that
 * reference the same handle. Those are resources the same admin team
 * maintains — sibling infrastructure candidates.
 * @param {RipeObject[]} objects full RIPE object dataset
 * @param {string[]} targetResourceIds resource IDs already attributed to the target
 * @returns {Array<{handle: string, kind: 'contact'|'maintainer', viaResources: string[], otherResources: Array<{id: string, type: string}>}>}
 */
export function pivotOnAdminHandles(objects, targetResourceIds) {
  const targets = new Set((targetResourceIds || []).map((id) => String(id).trim().toUpperCase()));
  const resources = (objects || []).filter((o) =>
    ['inetnum', 'inet6num', 'aut-num', 'route', 'organisation'].includes(o.type));
  const idOf = new Map();
  for (const r of resources) {
    const id = resourceId(r);
    if (id) idOf.set(r, id.toUpperCase());
  }
  // handles referenced by target resources
  const targetHandles = new Map(); // handle -> {kind, via:Set(resourceId)}
  for (const r of resources) {
    const id = idOf.get(r);
    if (!id || !targets.has(id)) continue;
    const { contacts, maintainers } = resourceLinkages(r);
    for (const h of contacts) {
      if (!targetHandles.has(h)) targetHandles.set(h, { kind: 'contact', via: new Set() });
      targetHandles.get(h).via.add(id);
    }
    for (const h of maintainers) {
      if (!targetHandles.has(h)) targetHandles.set(h, { kind: 'maintainer', via: new Set() });
      targetHandles.get(h).via.add(id);
    }
  }
  // every resource referencing those handles
  const out = [];
  for (const [handle, info] of targetHandles) {
    const otherResources = [];
    for (const r of resources) {
      const id = idOf.get(r);
      if (!id || targets.has(id)) continue;
      const { contacts, maintainers } = resourceLinkages(r);
      const refs = info.kind === 'contact' ? contacts : maintainers;
      if (refs.includes(handle)) otherResources.push({ id, type: r.type });
    }
    if (otherResources.length > 0) {
      out.push({
        handle,
        kind: info.kind,
        viaResources: [...info.via].sort(),
        otherResources: otherResources.sort((a, b) => a.id.localeCompare(b.id)),
      });
    }
  }
  return out.sort((a, b) => b.otherResources.length - a.otherResources.length);
}

/**
 * Summarise person/role objects found in the dataset: name, contact
 * handles, and how many resources each touches (admin reach).
 * @param {RipeObject[]} objects
 * @returns {Array<{handle: string, kind: 'person'|'role', name: string|null, resourceCount: number}>}
 */
export function adminReachSummary(objects) {
  const people = new Map();
  for (const o of objects || []) {
    if (o.type !== 'person' && o.type !== 'role') continue;
    const handle = (attrValues(o, 'nic-hdl')[0] || '').toUpperCase();
    if (!handle) continue;
    people.set(handle, { handle, kind: o.type, name: attrValues(o, o.type)[0] || null });
  }
  const reach = new Map();
  for (const o of objects || []) {
    if (!['inetnum', 'inet6num', 'aut-num', 'route'].includes(o.type)) continue;
    const id = resourceId(o);
    if (!id) continue;
    const { contacts, maintainers } = resourceLinkages(o);
    for (const h of [...contacts, ...maintainers]) {
      if (people.has(h)) reach.set(h, (reach.get(h) || 0) + 1);
    }
  }
  return [...people.values()]
    .map((p) => ({ ...p, resourceCount: reach.get(p.handle) || 0 }))
    .sort((a, b) => b.resourceCount - a.resourceCount);
}

export const RIPE_PERSON_INTEL = {
  attrValues,
  resourceLinkages,
  resourceId,
  pivotOnAdminHandles,
  adminReachSummary,
};
export default RIPE_PERSON_INTEL;
