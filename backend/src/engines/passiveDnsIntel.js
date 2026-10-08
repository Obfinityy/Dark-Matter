/**
 * passiveDnsIntel.js — Passive-DNS asset intelligence (ideas 00022–00024).
 *
 * Defensive asset-discovery analyzers for an authorized bug-bounty agent.
 * Consumes aggregated passive-DNS observation records (from feeds such as
 * VirusTotal, SecurityTrails, RiskIQ, DNSDB, CIRCL) and turns them into
 * actionable reconnaissance findings. All functions are pure and synchronous.
 *
 * Observation record shape:
 *   { name, ip, firstSeen, lastSeen, ttl, type, source }
 * where firstSeen/lastSeen are ISO-8601 date strings (or epoch ms).
 */

/**
 * Normalize an observation timestamp to epoch ms.
 * @param {string|number} ts
 */
function toMs(ts) {
  if (typeof ts === 'number') return ts;
  const ms = Date.parse(ts);
  return Number.isNaN(ms) ? 0 : ms;
}

const STAGING_HINTS = [
  /staging/i,
  /stage/i,
  /dev/i,
  /test/i,
  /qa/i,
  /uat/i,
  /sandbox/i,
  /demo/i,
  /beta/i,
  /preview/i,
  /internal/i,
  /temp/i,
  /tmp/i,
  /poc/i,
  /canary/i,
  /edge/i,
  /new-/i,
  /-new/i,
  /v2/i,
  /blue/i,
  /green/i,
];

/**
 * Compute a "freshness" score (0-1) for a first-seen date: closer to the
 * reference time means fresher (more likely a recently spun-up host).
 * @param {number} firstSeenMs
 * @param {number} nowMs
 */
function freshness(firstSeenMs, nowMs) {
  const age = Math.max(0, nowMs - firstSeenMs);
  const halfLife = 180 * 24 * 3600 * 1000; // 6 months
  return Math.exp(-age / halfLife);
}

/**
 * Idea 00022 — Passive-DNS first-seen correlation.
 *
 * Cross-correlates first-seen timestamps across feeds to (a) order asset
 * creation, (b) flag recently spun-up hosts, and (c) surface hosts whose
 * name suggests staging/dev (higher chance of weak hardening).
 *
 * @param {Array<Object>} records - passive-DNS observations (may include
 *   duplicate sightings of the same name from several feeds).
 * @param {{nowMs?: number, stagingBonus?: boolean}} [opts]
 * @returns {{ timeline: Array<{name, firstSeen, lastSeen, ips, sources, stagingSuspect}>,
 *            freshHosts: Array<{name, firstSeen, ageDays, stagingSuspect}> }}
 */
export function correlateFirstSeen(records, opts = {}) {
  const nowMs = opts.nowMs ?? Date.now();
  const byName = new Map();

  for (const r of records || []) {
    if (!r || !r.name) continue;
    const first = toMs(r.firstSeen);
    const last = toMs(r.lastSeen ?? r.firstSeen);
    let entry = byName.get(r.name);
    if (!entry) {
      entry = {
        name: r.name,
        firstSeen: first,
        lastSeen: last,
        ips: new Set(),
        sources: new Set(),
      };
      byName.set(r.name, entry);
    }
    // Earliest sighting wins across feeds — this is the correlation point.
    if (first && (!entry.firstSeen || first < entry.firstSeen)) entry.firstSeen = first;
    if (last > entry.lastSeen) entry.lastSeen = last;
    if (r.ip) entry.ips.add(String(r.ip));
    if (r.source) entry.sources.add(String(r.source));
  }

  const timeline = [...byName.values()]
    .map(e => ({
      name: e.name,
      firstSeen: new Date(e.firstSeen).toISOString(),
      lastSeen: new Date(e.lastSeen).toISOString(),
      ips: [...e.ips],
      sources: [...e.sources],
      stagingSuspect: STAGING_HINTS.some(rx => rx.test(e.name)),
    }))
    .sort((a, b) => Date.parse(a.firstSeen) - Date.parse(b.firstSeen));

  const freshHosts = timeline
    .map(t => {
      const firstMs = Date.parse(t.firstSeen);
      const score = freshness(firstMs, nowMs) * (t.stagingSuspect ? 1.25 : 1.0);
      return {
        name: t.name,
        firstSeen: t.firstSeen,
        ageDays: Math.round((nowMs - firstMs) / 86400000),
        freshnessScore: Math.round(Math.min(1, score) * 100) / 100,
        stagingSuspect: t.stagingSuspect,
      };
    })
    .filter(h => h.freshnessScore >= 0.5)
    .sort((a, b) => b.freshnessScore - a.freshnessScore);

  return { timeline, freshHosts };
}

/**
 * Idea 00023 — Passive-DNS co-occurrence pivoting.
 *
 * Finds IPs that historically resolved to many of the target's known
 * subdomains, then pulls every *other* name ever seen on those IPs from
 * passive DNS to expand the asset list.
 *
 * @param {Array<Object>} records - passive-DNS observations across a broad
 *   corpus (not limited to the target).
 * @param {Array<string>} targetNames - known target subdomains.
 * @param {{minOverlap?: number, maxNamesPerIp?: number}} [opts]
 * @returns {{ pivotIps: Array<{ip, overlap, overlapNames, expandedNames}>,
 *            expandedNames: Array<string> }}
 */
export function pivotCoOccurrence(records, targetNames, opts = {}) {
  const minOverlap = opts.minOverlap ?? 2;
  const maxNamesPerIp = opts.maxNamesPerIp ?? 200;
  const targetSet = new Set((targetNames || []).map(n => n.toLowerCase()));

  const ipNames = new Map(); // ip -> Set<name>
  for (const r of records || []) {
    if (!r || !r.ip || !r.name) continue;
    const name = r.name.toLowerCase();
    let set = ipNames.get(String(r.ip));
    if (!set) {
      set = new Set();
      ipNames.set(String(r.ip), set);
    }
    set.add(name);
  }

  const pivotIps = [];
  for (const [ip, names] of ipNames) {
    const overlapNames = [...names].filter(n => targetSet.has(n));
    if (overlapNames.length >= minOverlap) {
      const expanded = [...names]
        .filter(n => !targetSet.has(n))
        .slice(0, maxNamesPerIp)
        .sort();
      pivotIps.push({
        ip,
        overlap: overlapNames.length,
        overlapNames: overlapNames.sort(),
        expandedNames: expanded,
      });
    }
  }
  pivotIps.sort((a, b) => b.overlap - a.overlap || a.ip.localeCompare(b.ip));

  const expandedNames = [...new Set(pivotIps.flatMap(p => p.expandedNames))].sort();
  return { pivotIps, expandedNames };
}

/**
 * Idea 00024 — Passive-DNS TTL-change tracking.
 *
 * Monitors TTL value changes over time for target names. A TTL drop from a
 * long-lived value to a short one often precedes a migration (fast DNS
 * cutover), and a TTL change paired with an IP change indicates infra moved
 * to a new, possibly less-hardened endpoint.
 *
 * @param {Array<Object>} observations - chronological-ish TTL observations:
 *   { name, ttl, ip?, seenAt }.
 * @param {{nowMs?: number}} [opts]
 * @returns {Array<{name, changes: Array<{from, to, at, ipChanged}>, suspicion, reason}>}
 *   Sorted by suspicion descending.
 */
export function trackTtlChanges(observations, opts = {}) {
  const byName = new Map();
  for (const o of observations || []) {
    if (!o || !o.name) continue;
    let arr = byName.get(o.name);
    if (!arr) {
      arr = [];
      byName.set(o.name, arr);
    }
    arr.push({ ttl: Number(o.ttl), ip: o.ip ? String(o.ip) : null, at: toMs(o.seenAt) });
  }

  const results = [];
  for (const [name, arr] of byName) {
    arr.sort((a, b) => a.at - b.at);
    const changes = [];
    for (let i = 1; i < arr.length; i++) {
      if (arr[i].ttl !== arr[i - 1].ttl) {
        changes.push({
          from: arr[i - 1].ttl,
          to: arr[i].ttl,
          at: new Date(arr[i].at).toISOString(),
          ipChanged: arr[i].ip !== null && arr[i - 1].ip !== null && arr[i].ip !== arr[i - 1].ip,
        });
      }
    }
    if (changes.length === 0) continue;

    // Suspicion: TTL cut before migration is the classic signal.
    let suspicion = 0;
    const reasons = [];
    for (const c of changes) {
      if (c.to < c.from / 2 && c.from >= 3600) {
        suspicion += 2;
        reasons.push(`TTL dropped ${c.from}s → ${c.to}s (classic pre-migration cutover)`);
      } else if (c.ipChanged) {
        suspicion += 2;
        reasons.push(
          `TTL changed ${c.from}s → ${c.to}s alongside IP change (infrastructure moved)`
        );
      } else if (c.to !== c.from) {
        suspicion += 1;
        reasons.push(`TTL changed ${c.from}s → ${c.to}s`);
      }
    }

    results.push({
      name,
      changes,
      suspicion,
      reason: [...new Set(reasons)].join('; '),
      migrationLikely: suspicion >= 3,
    });
  }

  return results.sort((a, b) => b.suspicion - a.suspicion || a.name.localeCompare(b.name));
}
