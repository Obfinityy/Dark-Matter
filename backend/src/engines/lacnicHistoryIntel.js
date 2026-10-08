/**
 * lacnicHistoryIntel.js — LACNIC resource history mining.
 *
 * Implements Dark-Matter idea-bank item 00140 as a real, working defensive
 * asset-discovery capability for authorized targets:
 *
 *  00140 LACNIC resource history mining — check LACNIC transfer logs for
 *      netblocks the org acquired or sold.
 *
 * The caller supplies parsed LACNIC resource-history entries (assignment
 * and transfer log rows: prefix, event type, date, source and destination
 * orgs). This engine reconstructs each netblock's ownership timeline,
 * lists netblocks the target org acquired or relinquished, flags recent
 * transfers that may not have propagated to the rest of the intel stack,
 * and detects prefixes that moved between orgs more than once (churn).
 *
 * All functions are pure and side-effect free: they analyze supplied
 * entries. No network I/O happens in this module.
 */

/**
 * @typedef {object} LacnicHistoryEntry
 * @property {string} prefix
 * @property {'assigned'|'transferred'|'returned'|'updated'} event
 * @property {string} [date]       ISO date string
 * @property {string} [fromOrg]
 * @property {string} [toOrg]
 * @property {string} [source]     log source, e.g. "transfer-log"
 */

/** Coerce an ISO-ish date to epoch ms; null when unparsable. */
function toEpoch(v) {
  const t = Date.parse(String(v || ''));
  return Number.isFinite(t) ? t : null;
}

/** Normalise an org name for comparison. */
function normaliseOrg(o) {
  return String(o || '')
    .trim()
    .toLowerCase();
}

/**
 * Reconstruct the ownership timeline of every prefix in the history log:
 * chronological events, first/last seen, current inferred holder, and
 * how many times it changed hands.
 * @param {LacnicHistoryEntry[]} entries
 * @returns {Array<{prefix: string, events: Array<{event: string, date: string|null, epoch: number|null, fromOrg: string|null, toOrg: string|null}>, eventCount: number, firstSeen: string|null, lastSeen: string|null, currentHolder: string|null, transferCount: number}>}
 */
export function buildOwnershipTimelines(entries) {
  const byPrefix = new Map();
  for (const e of entries || []) {
    const prefix = String(e.prefix || '').trim();
    if (!prefix) continue;
    if (!byPrefix.has(prefix)) byPrefix.set(prefix, []);
    byPrefix.get(prefix).push({
      event: String(e.event || 'updated'),
      date: e.date || null,
      epoch: toEpoch(e.date),
      fromOrg: e.fromOrg ? String(e.fromOrg).trim() : null,
      toOrg: e.toOrg ? String(e.toOrg).trim() : null,
      source: e.source || null,
    });
  }
  const out = [];
  for (const [prefix, events] of byPrefix) {
    events.sort((a, b) => (a.epoch ?? 0) - (b.epoch ?? 0));
    const transferCount = events.filter(e => e.event === 'transferred').length;
    const last = events[events.length - 1];
    const currentHolder = last.event === 'returned' ? null : last.toOrg || last.fromOrg || null;
    const dated = events.filter(e => e.epoch != null);
    out.push({
      prefix,
      events: events.map(({ source, ...rest }) => rest),
      eventCount: events.length,
      firstSeen: dated.length > 0 ? dated[0].date : null,
      lastSeen: dated.length > 0 ? dated[dated.length - 1].date : null,
      currentHolder,
      transferCount,
    });
  }
  return out.sort((a, b) => a.prefix.localeCompare(b.prefix));
}

/**
 * List netblocks the target org acquired (appears as toOrg in transfers
 * or assignments) or relinquished (appears as fromOrg / returned) in the
 * log window — the acquisition/divestiture picture for scoping.
 * @param {LacnicHistoryEntry[]} entries
 * @param {string} targetOrg
 * @returns {{acquired: Array<{prefix: string, date: string|null, fromOrg: string|null}>, relinquished: Array<{prefix: string, date: string|null, toOrg: string|null}>}}
 */
export function orgAcquisitionHistory(entries, targetOrg) {
  const target = normaliseOrg(targetOrg);
  const acquired = [];
  const relinquished = [];
  for (const e of entries || []) {
    const prefix = String(e.prefix || '').trim();
    if (!prefix) continue;
    if (e.toOrg && normaliseOrg(e.toOrg) === target && e.event !== 'returned') {
      acquired.push({
        prefix,
        date: e.date || null,
        fromOrg: e.fromOrg ? String(e.fromOrg).trim() : null,
      });
    }
    if (
      (e.fromOrg && normaliseOrg(e.fromOrg) === target && e.event === 'transferred') ||
      (e.toOrg && normaliseOrg(e.toOrg) === target && e.event === 'returned')
    ) {
      relinquished.push({
        prefix,
        date: e.date || null,
        toOrg: e.toOrg && e.event === 'transferred' ? String(e.toOrg).trim() : null,
      });
    }
  }
  const byDate = (a, b) => (b.date || '').localeCompare(a.date || '');
  return { acquired: acquired.sort(byDate), relinquished: relinquished.sort(byDate) };
}

/**
 * Flag transfers that happened within `recentDays` of "now" — recent
 * ownership changes whose operational fallout (new routes, new DNS) may
 * not yet be reflected in the rest of the intel stack.
 * @param {LacnicHistoryEntry[]} entries
 * @param {{recentDays?: number}} [opts]
 * @returns {Array<{prefix: string, event: string, date: string|null, fromOrg: string|null, toOrg: string|null, daysAgo: number|null}>}
 */
export function flagRecentTransfers(entries, opts = {}) {
  const { recentDays = 90 } = opts;
  const now = Date.now();
  const out = [];
  for (const e of entries || []) {
    if (e.event !== 'transferred' && e.event !== 'assigned') continue;
    const epoch = toEpoch(e.date);
    if (epoch == null) continue;
    const daysAgo = (now - epoch) / 86400000;
    if (daysAgo >= 0 && daysAgo <= recentDays) {
      out.push({
        prefix: String(e.prefix || '').trim(),
        event: e.event,
        date: e.date,
        fromOrg: e.fromOrg ? String(e.fromOrg).trim() : null,
        toOrg: e.toOrg ? String(e.toOrg).trim() : null,
        daysAgo: Math.round(daysAgo * 10) / 10,
      });
    }
  }
  return out.sort((a, b) => (a.daysAgo ?? 0) - (b.daysAgo ?? 0));
}

/**
 * Detect prefixes that changed hands more than once — churned netblocks
 * whose true operator is ambiguous and worth confirming before scoping.
 * @param {LacnicHistoryEntry[]} entries
 * @returns {Array<{prefix: string, transferCount: number, holders: string[], lastSeen: string|null}>}
 */
export function detectChurnedPrefixes(entries) {
  const out = [];
  for (const t of buildOwnershipTimelines(entries)) {
    if (t.transferCount > 1) {
      const holders = [...new Set(t.events.flatMap(e => [e.fromOrg, e.toOrg]).filter(Boolean))];
      out.push({
        prefix: t.prefix,
        transferCount: t.transferCount,
        holders,
        lastSeen: t.lastSeen,
      });
    }
  }
  return out.sort((a, b) => b.transferCount - a.transferCount);
}

export const LACNIC_HISTORY_INTEL = {
  buildOwnershipTimelines,
  orgAcquisitionHistory,
  flagRecentTransfers,
  detectChurnedPrefixes,
};
export default LACNIC_HISTORY_INTEL;
