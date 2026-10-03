/**
 * zoomeyeAppIntel.js — ZoomEye app/component fingerprint mapping for autonomous bug bounty.
 *
 * Implements idea-bank item 00157: use ZoomEye app/component fingerprints to
 * find all deployments of the target's stack in their netblocks.
 *
 * ZoomEye records tag each host with `app` (application name + version) and
 * component fingerprints. When the hunt fingerprints the target's stack
 * (e.g. "nginx 1.24 + php 8.2 + wordpress 6.5"), hosts in the target's
 * netblocks carrying the same combination are likely sibling deployments —
 * including staging and forgotten instances. This module maps records to
 * app/component inventories and scores stack matches.
 *
 * All functions are pure and side-effect free: they operate on ZoomEye API
 * result objects the caller obtained through a legitimate ZoomEye account
 * during an authorized engagement. No scanning is performed here.
 */

/**
 * Normalize an app/component label ("nginx 1.24.0" → { name:"nginx", version:"1.24" }).
 * @param {*} label
 * @returns {{name:string, version:string}|null}
 */
export function normalizeAppLabel(label) {
  if (!label || typeof label !== 'string') return null;
  const clean = label.trim().toLowerCase();
  if (!clean) return null;
  const m = clean.match(/^([a-z0-9][a-z0-9+._-]*?)\s+([\d][\w.+-]*)\s*$/);
  if (m) return { name: m[1], version: m[2] };
  if (/^[a-z0-9][a-z0-9+._-]*$/.test(clean)) return { name: clean, version: '' };
  return null;
}

/**
 * Extract the app/component inventory of one ZoomEye host record.
 * Accepts apps under record.app (string or array) and record.component(s).
 * @param {object} record ZoomEye match: { ip, port, app?, component? }.
 * @returns {{ip:string, port:number|null, apps:Array<{name:string, version:string}>}}
 */
export function extractRecordApps(record) {
  const apps = [];
  const seen = new Set();
  const add = (label) => {
    const a = normalizeAppLabel(label);
    if (!a) return;
    const key = `${a.name}@${a.version}`;
    if (seen.has(key)) return;
    seen.add(key);
    apps.push(a);
  };
  if (!record) return { ip: 'unknown', port: null, apps };
  for (const field of [record.app, record.apps, record.component, record.components, record.device]) {
    if (!field) continue;
    if (Array.isArray(field)) field.forEach(add);
    else add(field);
  }
  return { ip: record.ip || record.host || 'unknown', port: record.port || null, apps };
}

/**
 * Build an app → hosts index over ZoomEye records, optionally restricted to
 * the target's netblocks (the caller filters; ASN/IP info is preserved).
 * @param {Array<object>} records ZoomEye match objects.
 * @returns {{inventory: Array<{name:string, version:string, hosts:Array<{ip:string, port:number}>, hostCount:number}>, totalRecords:number}}
 */
export function mapAppDeployments(records) {
  const map = new Map();
  const list = Array.isArray(records) ? records : [];
  for (const record of list) {
    const { ip, port, apps } = extractRecordApps(record);
    for (const a of apps) {
      const key = `${a.name}@${a.version}`;
      if (!map.has(key)) map.set(key, { name: a.name, version: a.version, hosts: [], seen: new Set() });
      const e = map.get(key);
      const hostKey = `${ip}|${port}`;
      if (!e.seen.has(hostKey)) {
        e.seen.add(hostKey);
        e.hosts.push({ ip, port });
      }
    }
  }
  return {
    inventory: [...map.values()]
      .map((e) => ({ name: e.name, version: e.version, hosts: e.hosts, hostCount: e.seen.size }))
      .sort((a, b) => b.hostCount - a.hostCount || a.name.localeCompare(b.name)),
    totalRecords: list.length,
  };
}

/**
 * Score hosts against the target's known stack: a host earns points for each
 * app name that matches, more when the version also matches, and full credit
 * for rare component combinations.
 * @param {{inventory:Array}} mapped Output of mapAppDeployments — used for frequency weighting.
 * @param {Array<object>} records The same ZoomEye records to score.
 * @param {Array<string>} targetStack App labels of the confirmed target stack, e.g. ["nginx 1.24", "wordpress 6.5"].
 * @returns {Array<{ip:string, port:number, score:number, matchedApps:string[], apps:string[]}>} sorted by score.
 */
export function scoreStackMatches(mapped, records, targetStack) {
  const stack = (targetStack || []).map(normalizeAppLabel).filter(Boolean);
  if (stack.length === 0) return [];
  const freq = new Map();
  for (const inv of mapped.inventory || []) freq.set(inv.name, inv.hostCount);
  const rows = [];
  for (const record of Array.isArray(records) ? records : []) {
    const { ip, port, apps } = extractRecordApps(record);
    let score = 0;
    const matched = [];
    for (const s of stack) {
      const hit = apps.find((a) => a.name === s.name);
      if (!hit) continue;
      const rarity = 1 / (1 + Math.log1p(freq.get(s.name) || 1)); // rare apps weigh more
      if (s.version && hit.version === s.version) {
        score += Math.round(40 * (0.5 + rarity));
        matched.push(`${hit.name}@${hit.version} (version match)`);
      } else {
        score += Math.round(20 * (0.5 + rarity));
        matched.push(`${hit.name} (name match)`);
      }
    }
    if (matched.length > 0) {
      rows.push({ ip, port, score, matchedApps: matched, apps: apps.map((a) => (a.version ? `${a.name} ${a.version}` : a.name)) });
    }
  }
  return rows.sort((a, b) => b.score - a.score || a.ip.localeCompare(b.ip));
}
