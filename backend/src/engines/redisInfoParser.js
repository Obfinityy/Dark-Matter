/**
 * redisInfoParser.js — Redis INFO output parser (idea 00363).
 *
 * Parses the text returned by the Redis INFO command (captured from an
 * in-scope instance where read-only probing is within the engagement rules)
 * into typed sections, and flags exposure-relevant configuration such as
 * disabled protected mode, all-interface binds, replication state, and
 * end-of-life server versions.
 *
 * Offline analyzer: callers supply captured INFO text. This module never
 * connects to Redis and never issues commands.
 */

/** Redis versions that are end-of-life (no security fixes) as of 2026. */
export const REDIS_EOL = [
  { regex: /^[1234]\./, label: 'Redis < 5.0', eol: true },
  { regex: /^5\./, label: 'Redis 5.x', eol: true },
];

/**
 * Convert an INFO value to a typed JS value (int/float/string).
 * @param {string} raw
 */
export function coerceInfoValue(raw) {
  const v = raw.trim();
  if (/^-?\d+$/.test(v)) return parseInt(v, 10);
  if (/^-?\d*\.\d+$/.test(v)) return parseFloat(v);
  return v;
}

/**
 * Parse raw INFO text into { section: { key: value } }.
 * @param {string} text Raw INFO command output.
 * @returns {Object<string, Object<string, string|number>>}
 */
export function parseRedisInfo(text) {
  const sections = {};
  if (typeof text !== 'string' || !text.trim()) return sections;
  let current = 'default';
  sections[current] = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('#')) {
      current = line.slice(1).trim().toLowerCase().replace(/\s+/g, '_') || 'default';
      if (!sections[current]) sections[current] = {};
      continue;
    }
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    sections[current][line.slice(0, idx)] = coerceInfoValue(line.slice(idx + 1));
  }
  if (Object.keys(sections.default).length === 0) delete sections.default;
  return sections;
}

/**
 * Extract the keyspace section into a per-database inventory.
 * @param {Object} info Parsed INFO output.
 * @returns {Array<{db: string, keys: number, expires: number, avgTtlMs: number}>}
 */
export function extractKeyspace(info) {
  const ks = info.keyspace || {};
  const dbs = [];
  for (const [db, val] of Object.entries(ks)) {
    if (!/^db\d+$/i.test(db) || typeof val !== 'string') continue;
    const parts = Object.fromEntries(val.split(',').map((p) => p.split('=')));
    dbs.push({
      db,
      keys: parseInt(parts.keys || '0', 10),
      expires: parseInt(parts.expires || '0', 10),
      avgTtlMs: parseInt(parts.avg_ttl || '0', 10),
    });
  }
  return dbs;
}

/**
 * Analyze parsed INFO output for fingerprint and exposure findings.
 * @param {Object|string} info Parsed INFO object or raw INFO text.
 * @returns {{fingerprint, configuration, keyspace, findings, confidence}}
 */
export function analyzeRedisInfo(info) {
  const parsed = typeof info === 'string' ? parseRedisInfo(info) : (info || {});
  const server = parsed.server || {};
  const findings = [];

  const version = String(server.redis_version || 'unknown');
  const mode = String(server.redis_mode || 'unknown');
  const os = String(server.os || 'unknown');
  findings.push(`Redis ${version} (${mode} mode) on ${os}.`);

  const eol = REDIS_EOL.find((e) => e.regex.test(version));
  if (eol) findings.push(`HIGH: ${eol.label} is end-of-life and receives no security fixes.`);

  const protectedMode = String(server.protected_mode ?? parsed.protection ?? '');
  const bind = String(server.bind || '');
  if (/^no$/i.test(protectedMode)) {
    findings.push('HIGH: protected_mode is "no" — the instance accepts connections without the loopback safeguard.');
  }
  if (/(^|\s)0\.0\.0\.0(\s|$)/.test(bind) || /(^|\s)::(\s|$)/.test(bind)) {
    findings.push(`MEDIUM: server binds to all interfaces (${bind || 'bind not shown'}); combined with no auth this is remotely reachable.`);
  }

  const role = String((parsed.replication || {}).role || 'unknown');
  findings.push(`Replication role: ${role}.`);
  const slaves = parseInt((parsed.replication || {}).connected_slaves || '0', 10);
  if (role === 'master' && slaves > 0) findings.push(`Instance replicates to ${slaves} slave(s).`);

  const stats = parsed.stats || {};
  const hits = parseInt(stats.keyspace_hits || '0', 10);
  const misses = parseInt(stats.keyspace_misses || '0', 10);
  const hitRatio = hits + misses > 0 ? (hits / (hits + misses)) : null;
  const keyspace = extractKeyspace(parsed);
  const totalKeys = keyspace.reduce((n, d) => n + d.keys, 0);
  findings.push(`Keyspace: ${totalKeys} key(s) across ${keyspace.length} database(s).`);

  const clients = parsed.clients || {};
  findings.push(`Uptime: ${server.uptime_in_days ?? '?'} day(s); connected clients: ${clients.connected_clients ?? '?'}.`);

  const persistence = parsed.persistence || {};
  if (String(persistence.aof_enabled) === '0' && String(persistence.rdb_changes_since_last_save) !== '') {
    findings.push('RDB snapshotting state captured; AOF disabled.');
  }

  return {
    fingerprint: { version, mode, os, eol: Boolean(eol) },
    configuration: { protectedMode, bind, role, hitRatio, connectedClients: clients.connected_clients ?? null },
    keyspace,
    totalKeys,
    findings,
    confidence: version !== 'unknown' ? 'high' : 'low',
  };
}

export const REDIS_INFO_PARSER = { parseRedisInfo, extractKeyspace, analyzeRedisInfo, coerceInfoValue, REDIS_EOL };
export default REDIS_INFO_PARSER;
