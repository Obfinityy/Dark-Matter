/**
 * mrtArchiveIntel.js — Route-Views MRT archive mining for historical prefixes.
 *
 * Implements Dark-Matter idea-bank item 00134 as a real, working defensive
 * asset-discovery capability for authorized targets:
 *
 *  00134 Route-views MRT archive mining — mine historical MRT dumps for
 *      prefixes the target announced in the past to find
 *      decommissioned-but-live netblocks.
 *
 * The caller converts MRT/RIB dumps (bgpdump, mrtparse output, or any
 * tabular export) into records of {prefix, asPath, seenAt, collector}.
 * This engine builds first/last-seen timelines per prefix, diffs a
 * historical window against current announcements, and flags prefixes that
 * were announced in the past but are missing now — candidates for
 * decommissioned-but-still-live netblocks — as well as origin-AS churn
 * that signals migrations or hijack-style changes.
 *
 * All functions are pure and side-effect free: they analyze supplied
 * records. No network I/O happens in this module.
 */

/**
 * @typedef {object} MrtRecord
 * @property {string} prefix  e.g. "203.0.113.0/24"
 * @property {number[]} [asPath]
 * @property {string|number|Date} [seenAt]  ISO string, epoch ms, or Date
 * @property {string} [collector]
 */

/** Coerce a seenAt value to epoch milliseconds. */
function toEpoch(v) {
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const t = Date.parse(String(v || ''));
  return Number.isFinite(t) ? t : null;
}

/**
 * Build a per-prefix announcement timeline: first seen, last seen, number
 * of observations, origin-AS history, and collectors that carried it.
 * @param {MrtRecord[]} records
 * @returns {Array<{prefix: string, firstSeen: number|null, lastSeen: number|null, observations: number, originAsns: number[], collectors: string[]}>}
 */
export function buildPrefixTimeline(records) {
  const byPrefix = new Map();
  for (const r of records || []) {
    const prefix = String(r.prefix || '')
      .trim()
      .toLowerCase();
    if (!prefix) continue;
    if (!byPrefix.has(prefix)) {
      byPrefix.set(prefix, {
        prefix,
        firstSeen: null,
        lastSeen: null,
        observations: 0,
        originAsns: new Set(),
        collectors: new Set(),
      });
    }
    const entry = byPrefix.get(prefix);
    entry.observations += 1;
    const ts = toEpoch(r.seenAt);
    if (ts != null) {
      if (entry.firstSeen == null || ts < entry.firstSeen) entry.firstSeen = ts;
      if (entry.lastSeen == null || ts > entry.lastSeen) entry.lastSeen = ts;
    }
    const path = Array.isArray(r.asPath) ? r.asPath : [];
    if (path.length > 0) entry.originAsns.add(path[path.length - 1]);
    if (r.collector) entry.collectors.add(String(r.collector));
  }
  return [...byPrefix.values()]
    .map(e => ({
      ...e,
      originAsns: [...e.originAsns].sort((a, b) => a - b),
      collectors: [...e.collectors].sort(),
    }))
    .sort((a, b) => (a.firstSeen ?? 0) - (b.firstSeen ?? 0));
}

/**
 * Find historically announced prefixes that are absent from the current
 * announcement set — the "decommissioned-but-maybe-live" candidates.
 * Only prefixes whose last observation is older than `staleAfterMs` are
 * reported, so flapping announcements do not create noise.
 * @param {MrtRecord[]} records
 * @param {string[]} currentPrefixes prefixes announced right now
 * @param {{staleAfterMs?: number}} [opts]
 * @returns {Array<{prefix: string, lastSeen: number|null, lastSeenIso: string|null, originAsns: number[], observations: number, daysMissing: number|null}>}
 */
export function findWithdrawnPrefixes(records, currentPrefixes, opts = {}) {
  const { staleAfterMs = 30 * 24 * 3600 * 1000 } = opts;
  const current = new Set((currentPrefixes || []).map(p => String(p).trim().toLowerCase()));
  const now = Date.now();
  const out = [];
  for (const t of buildPrefixTimeline(records)) {
    if (current.has(t.prefix)) continue;
    if (t.lastSeen != null && now - t.lastSeen < staleAfterMs) continue;
    out.push({
      prefix: t.prefix,
      lastSeen: t.lastSeen,
      lastSeenIso: t.lastSeen != null ? new Date(t.lastSeen).toISOString() : null,
      originAsns: t.originAsns,
      observations: t.observations,
      daysMissing: t.lastSeen != null ? Math.round((now - t.lastSeen) / 86400000) : null,
    });
  }
  return out.sort((a, b) => (b.daysMissing ?? 0) - (a.daysMissing ?? 0));
}

/**
 * Detect origin-AS churn: prefixes announced by more than one origin AS
 * over the observation window (migrations, anycast changes, or possible
 * hijacks worth a closer look).
 * @param {MrtRecord[]} records
 * @returns {Array<{prefix: string, originAsns: number[], observations: number, firstSeen: number|null, lastSeen: number|null}>}
 */
export function detectOriginAsChurn(records) {
  return buildPrefixTimeline(records)
    .filter(t => t.originAsns.length > 1)
    .map(({ prefix, originAsns, observations, firstSeen, lastSeen }) => ({
      prefix,
      originAsns,
      observations,
      firstSeen,
      lastSeen,
    }));
}

/**
 * Summarise one target ASN's historical footprint: every prefix it ever
 * originated, when each was first/last seen, and which are gone now.
 * @param {MrtRecord[]} records
 * @param {number} asn
 * @param {string[]} currentPrefixes
 * @returns {{asn: number, everAnnounced: number, currentlyAnnounced: number, withdrawn: number, prefixes: Array<{prefix: string, lastSeenIso: string|null, stillAnnounced: boolean}>}}
 */
export function asnHistoricalFootprint(records, asn, currentPrefixes = []) {
  const current = new Set(currentPrefixes.map(p => String(p).trim().toLowerCase()));
  const relevant = (records || []).filter(r => {
    const path = Array.isArray(r.asPath) ? r.asPath : [];
    return path.length > 0 && path[path.length - 1] === asn;
  });
  const timeline = buildPrefixTimeline(relevant);
  const prefixes = timeline.map(t => ({
    prefix: t.prefix,
    lastSeenIso: t.lastSeen != null ? new Date(t.lastSeen).toISOString() : null,
    stillAnnounced: current.has(t.prefix),
  }));
  return {
    asn,
    everAnnounced: timeline.length,
    currentlyAnnounced: prefixes.filter(p => p.stillAnnounced).length,
    withdrawn: prefixes.filter(p => !p.stillAnnounced).length,
    prefixes,
  };
}

export const MRT_ARCHIVE_INTEL = {
  buildPrefixTimeline,
  findWithdrawnPrefixes,
  detectOriginAsChurn,
  asnHistoricalFootprint,
};
export default MRT_ARCHIVE_INTEL;
