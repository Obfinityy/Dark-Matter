/**
 * memcachedStatsAnalyzer.js — Memcached stats/slabs analyzer (idea 00365).
 *
 * Parses the text returned by the Memcached `stats` (and optionally
 * `stats slabs`) commands — captured from an in-scope instance — to
 * fingerprint the server version, quantify usage patterns (hit ratio,
 * evictions, memory pressure, connection churn), and flag outdated builds.
 *
 * Offline analyzer: callers supply captured stats text. The Memcached text
 * protocol has no authentication, so a reachable instance is inherently
 * readable — this module only interprets already-captured output.
 */

/** Memcached releases considered outdated (no security backports) as of 2026. */
export const MEMCACHED_EOL_REGEX = /^(1\.[0-5]\.|1\.4\.)/;

/**
 * Parse `stats` output ("STAT name value" lines) into a typed object.
 * @param {string} text Raw stats output.
 * @returns {Object<string, string|number>}
 */
export function parseMemcachedStats(text) {
  const stats = {};
  if (typeof text !== 'string') return stats;
  for (const rawLine of text.split(/\r?\n/)) {
    const m = /^STAT\s+(\S+)\s+(.+?)\s*$/.exec(rawLine);
    if (!m) continue;
    const v = m[2].trim();
    stats[m[1]] = /^-?\d+$/.test(v) ? parseInt(v, 10) : (/^-?\d*\.\d+$/.test(v) ? parseFloat(v) : v);
  }
  return stats;
}

/**
 * Parse `stats slabs` output into per-slabclass chunk/item summaries.
 * @param {string} text Raw "stats slabs" output.
 * @returns {Array<{slabClass: number, chunkSize: number, chunksPerPage: number, totalPages: number, totalChunks: number, usedChunks: number}>}
 */
export function parseMemcachedSlabs(text) {
  const slabs = new Map();
  if (typeof text !== 'string') return [];
  for (const rawLine of text.split(/\r?\n/)) {
    const m = /^STAT\s+(\d+):(\w+)\s+(\d+)\s*$/.exec(rawLine);
    if (!m) continue;
    const id = parseInt(m[1], 10);
    if (!slabs.has(id)) slabs.set(id, { slabClass: id });
    slabs.get(id)[m[2]] = parseInt(m[3], 10);
  }
  return [...slabs.values()].map((s) => ({
    slabClass: s.slabClass,
    chunkSize: s.chunk_size || 0,
    chunksPerPage: s.chunks_per_page || 0,
    totalPages: s.total_pages || 0,
    totalChunks: s.total_chunks || 0,
    usedChunks: s.used_chunks || 0,
  }));
}

/**
 * Analyze parsed stats (+ optional slabs) for fingerprint and usage findings.
 * @param {{statsText?: string, slabsText?: string}} input
 * @returns {{fingerprint, usage, slabs, findings, confidence}}
 */
export function analyzeMemcachedStats({ statsText = '', slabsText = '' } = {}) {
  const s = parseMemcachedStats(statsText);
  const slabs = slabsText ? parseMemcachedSlabs(slabsText) : [];
  const findings = [];

  const version = String(s.version || 'unknown');
  findings.push(`Memcached ${version}.`);
  if (MEMCACHED_EOL_REGEX.test(version)) {
    findings.push(`HIGH: Memcached ${version} is outdated and misses security fixes — upgrade to a supported 1.6.x release.`);
  }

  const uptime = Number(s.uptime || 0);
  findings.push(`Uptime: ${(uptime / 86400).toFixed(1)} day(s); PID ${s.pid ?? '?'} on ${s.pointer_size ? `${s.pointer_size}-bit` : 'unknown'} build.`);

  const hits = Number(s.get_hits || 0);
  const misses = Number(s.get_misses || 0);
  const hitRatio = hits + misses > 0 ? hits / (hits + misses) : null;
  if (hitRatio !== null) findings.push(`Cache hit ratio: ${(hitRatio * 100).toFixed(1)}% (${hits} hits / ${misses} misses).`);

  const bytes = Number(s.bytes || 0);
  const limit = Number(s.limit_maxbytes || 0);
  const memoryPressure = limit > 0 ? bytes / limit : null;
  if (memoryPressure !== null) findings.push(`Memory pressure: ${(memoryPressure * 100).toFixed(1)}% of ${limit} bytes used.`);

  const evictions = Number(s.evictions || 0);
  if (evictions > 0) findings.push(`${evictions} eviction(s) recorded — working set exceeds available memory at times.`);
  const reclaimed = Number(s.reclaimed || 0);
  if (reclaimed > 0) findings.push(`${reclaimed} expired item(s) reclaimed for new writes.`);

  const currItems = Number(s.curr_items || 0);
  const totalItems = Number(s.total_items || 0);
  findings.push(`Items: ${currItems} current / ${totalItems} stored since restart; connections: ${s.curr_connections ?? '?'} current, ${s.total_connections ?? '?'} total.`);

  const usage = { hitRatio, memoryPressure, evictions, currItems, totalItems, uptimeSec: uptime };
  let profile = 'unknown';
  if (currItems > 10000 && hitRatio !== null && hitRatio > 0.8) profile = 'hot cache (high hit ratio, large working set)';
  else if (currItems > 1000 && evictions === 0) profile = 'stable object store (no evictions)';
  else if (totalItems > 0 && currItems < totalItems * 0.1) profile = 'high-churn / session-like workload (most items expired or evicted)';
  else if (currItems === 0) profile = 'idle or freshly restarted';
  findings.push(`Usage profile: ${profile}.`);

  const slabWaste = slabs.reduce((n, sl) => n + Math.max(0, sl.totalChunks - sl.usedChunks) * sl.chunkSize, 0);
  if (slabs.length > 0) findings.push(`${slabs.length} slab classe(s); ~${slabWaste} bytes allocated but unused across slabs.`);

  findings.push('NOTE: the Memcached text protocol has no authentication — any host that can reach the port can read and write cached data.');

  return {
    fingerprint: { version, outdated: MEMCACHED_EOL_REGEX.test(version), pid: s.pid ?? null },
    usage: { ...usage, profile },
    slabs,
    findings,
    confidence: version !== 'unknown' ? 'high' : 'low',
  };
}

export const MEMCACHED_STATS_ANALYZER = { parseMemcachedStats, parseMemcachedSlabs, analyzeMemcachedStats };
export default MEMCACHED_STATS_ANALYZER;
