/**
 * archiveTodaySnapshotMiner.js — archive.today snapshot mining.
 *
 * Idea 00891: mine archive.today snapshots for historical URLs of the target.
 *
 * No network calls: the module parses operator-supplied archive.today result
 * HTML (or an already-extracted snapshot list) into structured snapshots and
 * reconstructs the target's historical URL inventory. Intended for authorized
 * recon, where knowing what a target's pages looked like over time helps the
 * operator map endpoints that no longer appear on the live site.
 */

const ARCHIVE_HOST = /(?:archive\.(?:today|ph|is|li|md|vn))\//i;
const SNAPSHOT_URL_RE =
  /https?:\/\/archive\.(?:today|ph|is|li|md|vn)\/(\d{14})\/([^\s"'<>\]\)]+)/gi;
const SNAPSHOT_PATH_RE = /^\/(\d{14})\/(\S+)/;

/**
 * Parse one archive.today snapshot URL into {archiveUrl, timestamp, originalUrl}.
 * @param {string} archiveUrl
 * @returns {{archiveUrl: string, timestamp: string, date: string, originalUrl: string}|null}
 */
export function parseSnapshotUrl(archiveUrl) {
  if (!archiveUrl || typeof archiveUrl !== 'string') return null;
  const cleaned = archiveUrl.trim().replace(/&amp;/g, '&');
  let m = cleaned.match(/archive\.(?:today|ph|is|li|md|vn)\/(\d{14})\/(\S+)/i);
  if (!m) {
    const pathMatch = cleaned.match(SNAPSHOT_PATH_RE);
    if (!pathMatch) return null;
    m = [null, pathMatch[1], pathMatch[2]];
  }
  const ts = m[1];
  const date = `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)} ` +
    `${ts.slice(8, 10)}:${ts.slice(10, 12)}:${ts.slice(12, 14)} UTC`;
  let original = m[2];
  if (!/^https?:\/\//i.test(original)) original = 'https://' + original;
  return { archiveUrl: cleaned, timestamp: ts, date, originalUrl: original };
}

/**
 * Extract every snapshot link from an archive.today results page's HTML.
 * @param {string} html - Raw HTML of an archive.today search/results page.
 * @returns {{snapshots: object[], deduped: object[]}}
 */
export function extractArchiveTodaySnapshots(html = '') {
  const snapshots = [];
  const seen = new Set();
  const text = String(html);
  for (const m of text.matchAll(SNAPSHOT_URL_RE)) {
    const parsed = parseSnapshotUrl(m[0]);
    if (!parsed) continue;
    const key = `${parsed.timestamp}|${parsed.originalUrl}`;
    if (seen.has(key)) continue;
    seen.add(key);
    snapshots.push(parsed);
  }
  snapshots.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return { snapshots, deduped: snapshots };
}

/**
 * Keep only snapshots whose original URL belongs to the target host.
 * @param {object[]} snapshots
 * @param {string} host - e.g. 'example.com' (subdomains included).
 */
export function filterSnapshotsForHost(snapshots = [], host = '') {
  const h = String(host).toLowerCase().replace(/^www\./, '');
  return snapshots.filter(s => {
    try {
      const u = new URL(s.originalUrl);
      const uh = u.hostname.toLowerCase().replace(/^www\./, '');
      return uh === h || uh.endsWith('.' + h);
    } catch {
      return false;
    }
  });
}

/**
 * Group snapshots into per-URL timelines (oldest → newest).
 * @param {object[]} snapshots
 * @returns {{url: string, first: string, last: string, count: number, snapshots: object[]}[]}
 */
export function snapshotTimeline(snapshots = []) {
  const byUrl = new Map();
  for (const s of snapshots) {
    if (!byUrl.has(s.originalUrl)) byUrl.set(s.originalUrl, []);
    byUrl.get(s.originalUrl).push(s);
  }
  const timelines = [];
  for (const [url, list] of byUrl) {
    list.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    timelines.push({
      url,
      first: list[0].date,
      last: list[list.length - 1].date,
      count: list.length,
      snapshots: list,
    });
  }
  timelines.sort((a, b) => b.count - a.count);
  return timelines;
}

/**
 * Full pass: extract, filter to host, and build timelines.
 * @param {string} html - archive.today results HTML.
 * @param {string} host - Target host to keep.
 */
export function mineArchiveSnapshots(html = '', host = '') {
  const { snapshots } = extractArchiveTodaySnapshots(html);
  const inScope = host ? filterSnapshotsForHost(snapshots, host) : snapshots;
  const timelines = snapshotTimeline(inScope);
  const hosts = new Set();
  for (const s of inScope) {
    try { hosts.add(new URL(s.originalUrl).hostname.toLowerCase()); } catch { /* skip */ }
  }
  return {
    snapshots: inScope,
    timelines,
    stats: {
      snapshotsFound: snapshots.length,
      inScope: inScope.length,
      uniqueUrls: timelines.length,
      uniqueHosts: [...hosts],
    },
  };
}

/**
 * Build a report finding from the mining result.
 * @param {ReturnType<typeof mineArchiveSnapshots>} result
 */
export function archiveTodayFinding(result) {
  return {
    title:
      `archive.today snapshot mining — ${result.stats.uniqueUrls} historical URL(s) ` +
      `across ${result.stats.inScope} snapshot(s)`,
    severity: 'Info',
    confidence: result.stats.inScope >= 5 ? 'high' : 'medium',
    stats: result.stats,
    topTimelines: result.timelines.slice(0, 15).map(t => ({
      url: t.url,
      first: t.first,
      last: t.last,
      count: t.count,
    })),
    evidence:
      `${result.stats.snapshotsFound} archive.today snapshot link(s) parsed; ` +
      `${result.stats.inScope} belong to the target host.`,
  };
}

export const ARCHIVE_TODAY_SNAPSHOT_MINER = {
  parseSnapshotUrl,
  extractArchiveTodaySnapshots,
  filterSnapshotsForHost,
  snapshotTimeline,
  mineArchiveSnapshots,
  archiveTodayFinding,
};
export default ARCHIVE_TODAY_SNAPSHOT_MINER;
