/**
 * ripestatPrefixMiner.js — RIPEstat data-API prefix mining (idea 00195).
 *
 * RIPEstat exposes announced prefixes, routing history, and DNS data per
 * ASN or prefix. This module processes those API response payloads off-line:
 * it extracts the target's announced prefix set, summarizes routing history
 * into churn signals, and chains DNS observations to prefixes — the raw
 * material for scope confirmation before active probing.
 * All functions are pure and synchronous — no network calls.
 */

/**
 * Idea 00195 — Extract announced prefixes from a RIPEstat
 * `announced-prefixes` API response.
 *
 * @param {object} apiResponse — parsed RIPEstat JSON (data.prefixes[])
 * @returns {{ prefixes: Array<{ prefix, timelines: Array<{starttime, endtime}> }>, stats: { count, v4, v6 } }}
 */
export function mineAnnouncedPrefixes(apiResponse = {}) {
  const rows = (apiResponse && apiResponse.data && apiResponse.data.prefixes) || [];
  const prefixes = [];
  let v4 = 0;
  let v6 = 0;
  for (const p of rows) {
    if (!p || !p.prefix) continue;
    const prefix = String(p.prefix);
    if (prefix.includes(':')) v6++;
    else v4++;
    prefixes.push({
      prefix,
      timelines: (p.timelines || []).map((t) => ({
        starttime: t.starttime || null,
        endtime: t.endtime || null,
      })),
    });
  }
  prefixes.sort((a, b) => a.prefix.localeCompare(b.prefix, undefined, { numeric: true }));
  return { prefixes, stats: { count: prefixes.length, v4, v6 } };
}

/**
 * Idea 00195 — Summarize RIPEstat `routing-history` into churn signals.
 *
 * A prefix with many short-lived announcements (frequent flaps, origin
 * changes) is flagged as churny — often a cloud/auto-scaling block where
 * ephemeral infrastructure lives, or a sign of instability worth noting.
 *
 * @param {object} apiResponse — parsed RIPEstat routing-history JSON (data.by_origin[])
 * @returns {Array<{ prefix, originAses: number[], announcementCount, firstSeen, lastSeen, churnScore, churny: boolean }>}
 */
export function summarizeRoutingHistory(apiResponse = {}) {
  const byOrigin = (apiResponse && apiResponse.data && apiResponse.data.by_origin) || [];
  const out = [];
  for (const o of byOrigin) {
    if (!o || !o.prefix) continue;
    const origins = o.origins || [];
    const originAses = origins.map((x) => Number(x.asn)).filter(Number.isFinite);
    const announcementCount = origins.length;
    const times = origins.flatMap((x) => [x.starttime, x.endtime]).filter(Boolean).sort();
    // Churn score: announcements + origin diversity, normalized 0-100.
    const churnScore = Math.min(
      100,
      Math.round(announcementCount * 4 + originAses.length * 12),
    );
    out.push({
      prefix: String(o.prefix),
      originAses,
      announcementCount,
      firstSeen: times[0] || null,
      lastSeen: times[times.length - 1] || null,
      churnScore,
      churny: churnScore >= 50,
    });
  }
  return out.sort((a, b) => b.churnScore - a.churnScore);
}

/**
 * Idea 00195 — Chain DNS observations to prefixes from RIPEstat
 * `reverse-dns` / `dns-chain` style payloads.
 *
 * Builds name → PTR → prefix links so a reverse-DNS walk (see
 * ripestatReverseDnsWalk.js) can start from concrete data.
 *
 * @param {Array<{ ip, ptr?, prefix? }>} observations
 * @returns {Array<{ ip, ptr: string|null, prefix: string|null }>}
 */
export function chainDnsToPrefixes(observations = []) {
  const out = [];
  const seen = new Set();
  for (const o of observations || []) {
    if (!o || !o.ip || seen.has(o.ip)) continue;
    seen.add(o.ip);
    out.push({
      ip: String(o.ip),
      ptr: o.ptr ? String(o.ptr) : null,
      prefix: o.prefix ? String(o.prefix) : null,
    });
  }
  return out;
}
