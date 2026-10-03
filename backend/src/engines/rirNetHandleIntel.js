/**
 * rirNetHandleIntel.js — RIR net-handle allocation-tree traversal.
 *
 * Implements Dark-Matter idea-bank item 00137 as a real, working defensive
 * asset-discovery capability for authorized targets:
 *
 *  00137 ARIN WHOIS net-handle traversal — walk RIR net handles up and
 *      down the allocation tree to find sibling netblocks under the
 *      same org.
 *
 * The caller supplies parsed RIR WHOIS net records (ARIN-style NetHandle /
 * NetRange objects, though any RIR's shape works). This engine builds the
 * parent→child allocation tree, finds every netblock belonging to the
 * target org, walks up to the allocation parent and back down to enumerate
 * sibling netblocks under the same org handle, and flags registrations
 * whose org name differs — acquisitions or reassignments worth scoping.
 *
 * All functions are pure and side-effect free: they analyze supplied
 * records. No network I/O happens in this module.
 */

/**
 * @typedef {object} RirNetRecord
 * @property {string} netHandle
 * @property {string} netRange        e.g. "203.0.113.0 - 203.0.113.255"
 * @property {string} [orgHandle]
 * @property {string} [orgName]
 * @property {string} [parentHandle]
 * @property {string} [netType]       e.g. "Direct Allocation", "Reassigned"
 * @property {string} [regDate]
 */

/**
 * Normalise one RIR net record into a canonical node.
 * @param {RirNetRecord} rec
 * @returns {{netHandle: string, netRange: string, orgHandle: string|null, orgName: string|null, parentHandle: string|null, netType: string|null, regDate: string|null}}
 */
export function normaliseNetRecord(rec) {
  return {
    netHandle: String(rec.netHandle || '').trim(),
    netRange: String(rec.netRange || '').trim(),
    orgHandle: rec.orgHandle ? String(rec.orgHandle).trim() : null,
    orgName: rec.orgName ? String(rec.orgName).trim() : null,
    parentHandle: rec.parentHandle ? String(rec.parentHandle).trim() : null,
    netType: rec.netType ? String(rec.netType).trim() : null,
    regDate: rec.regDate ? String(rec.regDate).trim() : null,
  };
}

/**
 * Build the allocation tree: parent handle → child net handles, plus a
 * lookup of handle → record.
 * @param {RirNetRecord[]} records
 * @returns {{children: Map<string, string[]>, byHandle: Map<string, object>}}
 */
export function buildAllocationTree(records) {
  const byHandle = new Map();
  const children = new Map();
  for (const rec of records || []) {
    const n = normaliseNetRecord(rec);
    if (!n.netHandle) continue;
    byHandle.set(n.netHandle, n);
    if (n.parentHandle) {
      if (!children.has(n.parentHandle)) children.set(n.parentHandle, []);
      children.get(n.parentHandle).push(n.netHandle);
    }
  }
  return { children, byHandle };
}

/**
 * Walk the allocation tree up from a net handle to the topmost known
 * ancestor, then enumerate the whole subtree beneath that ancestor:
 * every netblock the org's registration tree covers.
 * @param {RirNetRecord[]} records
 * @param {string} startHandle
 * @returns {{ancestors: string[], rootHandle: string|null, subtreeHandles: string[], depth: number}}
 */
export function walkUpToRoot(records, startHandle) {
  const { children, byHandle } = buildAllocationTree(records);
  const ancestors = [];
  let cursor = String(startHandle).trim();
  let guard = 0;
  while (cursor && byHandle.has(cursor) && guard < 100) {
    ancestors.push(cursor);
    const parent = byHandle.get(cursor).parentHandle;
    if (!parent || parent === cursor) break;
    cursor = parent;
    guard += 1;
  }
  const rootHandle = ancestors.length > 0 ? ancestors[ancestors.length - 1] : null;
  const subtreeHandles = [];
  if (rootHandle) {
    const stack = [rootHandle];
    const seen = new Set([rootHandle]);
    while (stack.length > 0) {
      const h = stack.pop();
      subtreeHandles.push(h);
      for (const child of children.get(h) || []) {
        if (!seen.has(child)) {
          seen.add(child);
          stack.push(child);
        }
      }
    }
  }
  return { ancestors, rootHandle, subtreeHandles, depth: ancestors.length };
}

/**
 * Find sibling netblocks: other registrations under the same org handle
 * (or same org name when handles are missing) as the target's netblocks,
 * excluding the target's own handles. These are sibling netblocks the
 * org controls but the hunt may not have scoped yet.
 * @param {RirNetRecord[]} records
 * @param {string[]} targetHandles net handles already attributed to the target
 * @returns {Array<{netHandle: string, netRange: string, orgHandle: string|null, orgName: string|null, netType: string|null, match: 'org-handle'|'org-name'}>}
 */
export function findSiblingNetblocks(records, targetHandles) {
  const targets = new Set((targetHandles || []).map((h) => String(h).trim()));
  const { byHandle } = buildAllocationTree(records);
  const targetOrgs = new Set();
  const targetNames = new Set();
  for (const h of targets) {
    const rec = byHandle.get(h);
    if (!rec) continue;
    if (rec.orgHandle) targetOrgs.add(rec.orgHandle);
    if (rec.orgName) targetNames.add(rec.orgName.toLowerCase());
  }
  const siblings = [];
  for (const [handle, rec] of byHandle) {
    if (targets.has(handle)) continue;
    if (rec.orgHandle && targetOrgs.has(rec.orgHandle)) {
      siblings.push({ ...rec, match: 'org-handle' });
    } else if (rec.orgName && targetNames.has(rec.orgName.toLowerCase())) {
      siblings.push({ ...rec, match: 'org-name' });
    }
  }
  return siblings.sort((a, b) => a.netRange.localeCompare(b.netRange));
}

/**
 * Flag registrations in the tree whose org name differs from the target
 * org while sitting under the same allocation parent — possible
 * acquisitions, divestitures, or stale records.
 * @param {RirNetRecord[]} records
 * @param {string} targetOrgName
 * @returns {Array<{netHandle: string, netRange: string, orgName: string|null, parentHandle: string|null, netType: string|null}>}
 */
export function flagOrgNameDeviations(records, targetOrgName) {
  const target = String(targetOrgName || '').trim().toLowerCase();
  const { byHandle } = buildAllocationTree(records);
  const out = [];
  for (const rec of byHandle.values()) {
    const name = (rec.orgName || '').toLowerCase();
    if (name && target && name !== target) {
      out.push({
        netHandle: rec.netHandle,
        netRange: rec.netRange,
        orgName: rec.orgName,
        parentHandle: rec.parentHandle,
        netType: rec.netType,
      });
    }
  }
  return out;
}

export const RIR_NET_HANDLE_INTEL = {
  normaliseNetRecord,
  buildAllocationTree,
  walkUpToRoot,
  findSiblingNetblocks,
  flagOrgNameDeviations,
};
export default RIR_NET_HANDLE_INTEL;
