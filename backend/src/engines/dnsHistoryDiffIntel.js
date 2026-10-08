/**
 * dnsHistoryDiffIntel.js — DNS history change tracking engine.
 *
 * Implements idea-bank item 00182 (DNSHistory.org change tracking): compare
 * successive DNS snapshots of a target to surface newly added or removed
 * subdomains. New hosts often belong to freshly deployed (and unhardened)
 * infrastructure, while removed hosts may have dangling DNS records left
 * behind.
 *
 * All functions are pure: they operate on plain snapshot arrays the caller
 * has already collected. No network access, no side effects.
 */

/**
 * A snapshot of DNS answers captured at one point in time.
 * @typedef {object} DnsSnapshot
 * @property {number} at            epoch ms when the snapshot was taken
 * @property {Array<{hostname: string, type?: string, value?: string}>} records
 */

/**
 * Normalize one snapshot into hostname → record-value sets.
 * @param {DnsSnapshot} snapshot
 * @returns {Map<string, {types: Set<string>, values: Set<string>}>}
 */
export function snapshotIndex(snapshot) {
  const idx = new Map();
  for (const rec of snapshot.records ?? []) {
    if (!rec || typeof rec.hostname !== 'string') continue;
    const host = rec.hostname.trim().toLowerCase();
    let entry = idx.get(host);
    if (!entry) {
      entry = { types: new Set(), values: new Set() };
      idx.set(host, entry);
    }
    if (rec.type) entry.types.add(String(rec.type).toUpperCase());
    if (rec.value) entry.values.add(String(rec.value));
  }
  return idx;
}

/**
 * Diff two snapshots (before → after).
 * @param {DnsSnapshot} before
 * @param {DnsSnapshot} after
 * @returns {{added: string[], removed: string[], changed: Array<{hostname, addedValues: string[], removedValues: string[]}>, at: number}}
 */
export function diffSnapshots(before, after) {
  const bIdx = snapshotIndex(before);
  const aIdx = snapshotIndex(after);
  const added = [];
  const removed = [];
  const changed = [];

  for (const [host, aEntry] of aIdx) {
    const bEntry = bIdx.get(host);
    if (!bEntry) {
      added.push(host);
      continue;
    }
    const addedValues = [...aEntry.values].filter(v => !bEntry.values.has(v));
    const removedValues = [...bEntry.values].filter(v => !aEntry.values.has(v));
    if (addedValues.length || removedValues.length) {
      changed.push({ hostname: host, addedValues, removedValues });
    }
  }
  for (const host of bIdx.keys()) {
    if (!aIdx.has(host)) removed.push(host);
  }
  return { added: added.sort(), removed: removed.sort(), changed, at: after.at ?? Date.now() };
}

/**
 * Reduce a full snapshot series into a chronological change timeline.
 * @param {DnsSnapshot[]} snapshots  ordered oldest → newest
 * @returns {Array<{at: number, added: string[], removed: string[], changedCount: number}>}
 */
export function trackChanges(snapshots) {
  const timeline = [];
  for (let i = 1; i < snapshots.length; i += 1) {
    const d = diffSnapshots(snapshots[i - 1], snapshots[i]);
    timeline.push({ at: d.at, added: d.added, removed: d.removed, changedCount: d.changed.length });
  }
  return timeline;
}

/**
 * Identify "hot" hosts: subdomains that appeared within the recent window —
 * fresh infrastructure that deserves priority recon.
 * @param {DnsSnapshot[]} snapshots
 * @param {object} [opts]
 * @param {number} [opts.recentHours=72]
 * @param {number} [opts.now=Date.now()]
 * @returns {string[]} hostnames sorted by first appearance (newest first)
 */
export function findRecentHosts(snapshots, opts = {}) {
  const now = opts.now ?? Date.now();
  const windowMs = (opts.recentHours ?? 72) * 3600000;
  const firstSeen = new Map();
  for (const snap of snapshots) {
    for (const rec of snap.records ?? []) {
      if (!rec || typeof rec.hostname !== 'string') continue;
      const host = rec.hostname.trim().toLowerCase();
      if (!firstSeen.has(host)) firstSeen.set(host, snap.at ?? now);
    }
  }
  return [...firstSeen.entries()]
    .filter(([, at]) => now - at <= windowMs)
    .sort((a, b) => b[1] - a[1])
    .map(([host]) => host);
}
