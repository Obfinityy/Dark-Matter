/**
 * ripeAtlasMeasurement.js — RIPE Atlas measurement targeting analysis (idea 00197).
 *
 * RIPE Atlas probes resolve target hostnames from thousands of vantage
 * points worldwide. When different regions resolve the same name to different
 * IPs, the target runs geo-split DNS — each edge may expose a different
 * attack surface. This module analyzes Atlas measurement results off-line
 * and flags geo-split behavior, probe disagreement, and regional outliers.
 * All functions are pure and synchronous — no network calls.
 */

/**
 * Idea 00197 — Extract probe → resolution pairs from Atlas DNS results.
 *
 * Accepts measurement result entries shaped like Atlas `result` objects:
 * { prb_id, result: { abuf?, answers? }, timestamp? }. Answers are parsed
 * from the raw DNS answer section (abuf) or a pre-parsed answers array.
 *
 * @param {Array<{ prb_id, result? }>} results
 * @returns {Array<{ probeId, answers: string[], timestamp: string|null }>}
 */
export function extractProbeResolutions(results = []) {
  const out = [];
  for (const r of results || []) {
    if (!r) continue;
    const answers = new Set();
    const res = r.result || {};
    for (const a of res.answers || []) {
      const ip = typeof a === 'string' ? a : a.address || a.data;
      if (ip && /^[\d.:a-fA-F]+$/.test(String(ip))) answers.add(String(ip));
    }
    // abuf (hex DNS message) fallback: pull A/AAAA rdata via simple parse.
    if (!answers.size && typeof res.abuf === 'string') {
      for (const ip of parseAbufIps(res.abuf)) answers.add(ip);
    }
    out.push({
      probeId: r.prb_id,
      answers: [...answers],
      timestamp: r.timestamp || null,
    });
  }
  return out;
}

/**
 * Best-effort extraction of IPv4 addresses from a hex-encoded DNS message.
 * Scans the payload for valid 4-byte sequences that parse as plausible IPv4.
 *
 * @param {string} abuf — hex string of the DNS wire message
 * @returns {string[]}
 */
export function parseAbufIps(abuf = '') {
  const found = new Set();
  const bytes = String(abuf || '').replace(/\s+/g, '');
  if (!/^[0-9a-fA-F]+$/.test(bytes) || bytes.length < 24) return [];
  for (let i = 24; i + 8 <= bytes.length; i += 2) {
    const chunk = bytes.slice(i, i + 8);
    const octets = [0, 2, 4, 6].map(o => parseInt(chunk.slice(o, o + 2), 16));
    if (octets.some(o => Number.isNaN(o))) continue;
    // Skip multicast/reserved/0/255-heavy noise.
    if (octets[0] === 0 || octets[0] >= 224 || octets.every(o => o === 255)) continue;
    found.add(octets.join('.'));
  }
  return [...found];
}

/**
 * Idea 00197 — Detect geo-split DNS from probe resolutions.
 *
 * Groups probes by their Atlas tags/region metadata, then compares answer
 * sets across regions. A hostname whose regions resolve to disjoint IP sets
 * is flagged geo-split; probes disagreeing with their own region's majority
 * are flagged as outliers.
 *
 * @param {Array<{ probeId, answers: string[] }>} resolutions — from extractProbeResolutions
 * @param {Map|object} probeMeta — probeId → { region?, country?, tags?: string[] }
 * @returns {{ geoSplit: boolean, regions: Array<{ region, ips: string[], probeCount }>, outliers: Array<{ probeId, region, answers }>, agreement: number }}
 */
export function detectGeoSplitDns(resolutions = [], probeMeta = {}) {
  const meta =
    probeMeta instanceof Map
      ? probeMeta
      : new Map(Object.entries(probeMeta || {}).map(([k, v]) => [Number(k), v]));
  const byRegion = new Map();
  const ipSets = [];
  for (const r of resolutions || []) {
    if (!r || !r.answers || !r.answers.length) continue;
    const m = meta.get(Number(r.probeId)) || {};
    const region = String(m.region || m.country || 'unknown');
    if (!byRegion.has(region)) byRegion.set(region, { ips: new Set(), probes: [] });
    const g = byRegion.get(region);
    for (const ip of r.answers) g.ips.add(ip);
    g.probes.push({ probeId: r.probeId, answers: r.answers });
    ipSets.push(new Set(r.answers));
  }

  const regions = [...byRegion.entries()].map(([region, g]) => ({
    region,
    ips: [...g.ips].sort(),
    probeCount: g.probes.length,
  }));

  // Geo-split: at least two regions whose IP sets are fully disjoint.
  let geoSplit = false;
  for (let i = 0; i < regions.length && !geoSplit; i++) {
    for (let j = i + 1; j < regions.length; j++) {
      const a = new Set(regions[i].ips);
      const overlap = regions[j].ips.some(ip => a.has(ip));
      if (!overlap && regions[i].ips.length && regions[j].ips.length) {
        geoSplit = true;
        break;
      }
    }
  }

  // Outliers: probe answers not shared by any other probe in its region.
  const outliers = [];
  for (const [, g] of byRegion) {
    if (g.probes.length < 2) continue;
    const counts = new Map();
    for (const p of g.probes) {
      for (const ip of p.answers) counts.set(ip, (counts.get(ip) || 0) + 1);
    }
    for (const p of g.probes) {
      const shared = p.answers.some(ip => (counts.get(ip) || 0) > 1);
      if (!shared) outliers.push({ probeId: p.probeId, region: null, answers: p.answers });
    }
  }
  // Attach region names to outliers.
  for (const o of outliers) {
    const m = meta.get(Number(o.probeId)) || {};
    o.region = String(m.region || m.country || 'unknown');
  }

  // Agreement: fraction of probes whose answers match the global mode set.
  const allIps = new Map();
  for (const s of ipSets) for (const ip of s) allIps.set(ip, (allIps.get(ip) || 0) + 1);
  const total = ipSets.length;
  const agreement = total
    ? Math.round(
        (ipSets.filter(s => {
          const top = [...allIps.entries()].sort((a, b) => b[1] - a[1])[0];
          return top && s.has(top[0]);
        }).length /
          total) *
          100
      )
    : 100;

  regions.sort((a, b) => b.probeCount - a.probeCount);
  return { geoSplit, regions, outliers, agreement };
}
