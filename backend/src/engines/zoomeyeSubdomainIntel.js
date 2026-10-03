/**
 * zoomeyeSubdomainIntel.js — ZoomEye subdomain-field harvesting for autonomous bug bounty.
 *
 * Implements idea-bank item 00158: harvest subdomain fields from ZoomEye
 * host records tied to the target org.
 *
 * ZoomEye host records include discovered subdomains (`subdomain`,
 * `domain`, `rdomain` fields) collected during its crawling. Aggregating
 * those fields across records tied to the target's org (by ASN, IP range,
 * or domain match) surfaces subdomains that DNS enumeration alone misses.
 * This module harvests, normalizes, and attributes subdomains to the
 * records that disclosed them.
 *
 * All functions are pure and side-effect free: they operate on ZoomEye API
 * result objects the caller obtained through a legitimate ZoomEye account
 * during an authorized engagement. No scanning is performed here.
 */

/**
 * Validate and normalize a subdomain string.
 * @param {*} value
 * @returns {string|null}
 */
export function normalizeSubdomain(value) {
  if (!value || typeof value !== 'string') return null;
  const s = value.trim().toLowerCase().replace(/\.$/, '');
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(s)) return null;
  return s;
}

/**
 * Extract subdomains from one ZoomEye host record. Accepts the `subdomain`,
 * `subdomains`, `domain`, `domains`, `rdomain` fields (strings or arrays).
 * @param {object} record ZoomEye match object.
 * @returns {Array<{subdomain:string, ip:string, port:number|null, sourceField:string}>}
 */
export function extractRecordSubdomains(record) {
  const out = [];
  if (!record) return out;
  const ip = record.ip || record.host || 'unknown';
  const port = record.port || null;
  const fields = [
    ['subdomain', record.subdomain],
    ['subdomains', record.subdomains],
    ['domain', record.domain],
    ['domains', record.domains],
    ['rdomain', record.rdomain],
  ];
  const seen = new Set();
  for (const [field, value] of fields) {
    const values = Array.isArray(value) ? value : (value ? [value] : []);
    for (const raw of values) {
      // ZoomEye sometimes packs several domains in one comma/space separated string
      for (const part of String(raw).split(/[,\s;]+/)) {
        const s = normalizeSubdomain(part);
        if (!s || seen.has(s)) continue;
        seen.add(s);
        out.push({ subdomain: s, ip, port, sourceField: field });
      }
    }
  }
  return out;
}

/**
 * Harvest and aggregate subdomains across ZoomEye records tied to the target org.
 * @param {Array<object>} records ZoomEye match objects (same shape as extractRecordSubdomains input).
 * @param {object} opts { orgAsns?: string[], registrableDomain?: string }.
 *   When orgAsns is provided, only records whose ASN matches are used;
 *   registrableDomain marks in-scope names (records are never dropped for scope).
 * @returns {{subdomains: Array<{subdomain:string, inScope:boolean, ips:string[], sourceFields:string[], records:number}>, totalRecords:number, usedRecords:number}}
 */
export function harvestSubdomains(records, opts = {}) {
  const asns = new Set((opts.orgAsns || []).map(String));
  const root = (opts.registrableDomain || '').toLowerCase();
  const map = new Map();
  const list = Array.isArray(records) ? records : [];
  let used = 0;
  for (const record of list) {
    const asn = record.asn != null ? String(record.asn) : (record.asnumber != null ? String(record.asnumber) : null);
    if (asns.size > 0 && (!asn || !asns.has(asn))) continue;
    used += 1;
    for (const { subdomain, ip, sourceField } of extractRecordSubdomains(record)) {
      if (!map.has(subdomain)) {
        map.set(subdomain, { subdomain, ips: new Set(), sourceFields: new Set(), records: 0 });
      }
      const e = map.get(subdomain);
      e.ips.add(ip);
      e.sourceFields.add(sourceField);
      e.records += 1;
    }
  }
  return {
    subdomains: [...map.values()]
      .map((e) => ({
        subdomain: e.subdomain,
        inScope: root !== '' && (e.subdomain === root || e.subdomain.endsWith(`.${root}`)),
        ips: [...e.ips].sort(),
        sourceFields: [...e.sourceFields].sort(),
        records: e.records,
      }))
      .sort((a, b) => (b.inScope - a.inScope) || b.records - a.records || a.subdomain.localeCompare(b.subdomain)),
    totalRecords: list.length,
    usedRecords: used,
  };
}

/**
 * Prioritize harvested subdomains for the hunt: in-scope names first, with
 * bonus for dev/staging/admin-looking labels and for names seen on few IPs
 * (single-purpose assets).
 * @param {{subdomains:Array}} harvested Output of harvestSubdomains.
 * @returns {Array<{subdomain:string, priority:number, reasons:string[], ips:string[]}>} sorted by priority.
 */
export function prioritizeSubdomains(harvested) {
  const rows = [];
  for (const s of harvested.subdomains || []) {
    let priority = 0;
    const reasons = [];
    if (s.inScope) {
      priority += 50;
      reasons.push('in scope of target domain');
    }
    if (/\b(dev|staging|test|qa|uat|beta|demo|internal|corp|vpn|admin|portal|api|cdn|static)\b/i.test(s.subdomain)) {
      priority += 20;
      reasons.push('environment/service-indicating label');
    }
    if (s.ips.length === 1) {
      priority += 10;
      reasons.push('resolves to a single host — possible dedicated asset');
    }
    if (s.records >= 3) {
      priority += 5;
      reasons.push('corroborated by multiple records');
    }
    rows.push({ subdomain: s.subdomain, priority, reasons, ips: s.ips });
  }
  return rows.sort((a, b) => b.priority - a.priority || a.subdomain.localeCompare(b.subdomain));
}
