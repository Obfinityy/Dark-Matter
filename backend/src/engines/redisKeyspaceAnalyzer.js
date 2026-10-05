/**
 * redisKeyspaceAnalyzer.js — Redis keyspace sample analyzer (idea 00364).
 *
 * Infers the application purpose of a Redis instance from keyspace metadata
 * (the INFO keyspace section) plus a sample of key NAMES — never key values.
 * Prefix patterns in key names (e.g. "sess:", "cart:", "celery:") reveal
 * whether the instance backs sessions, queues, caches, rate limiters, etc.
 *
 * Offline analyzer: callers supply the INFO keyspace section text and an
 * optional array of sampled key names. This module never reads key values
 * and never connects to Redis.
 */

/** Key-name prefix buckets mapped to application purposes. */
export const KEY_PREFIX_BUCKETS = [
  { bucket: 'sessions', purpose: 'session store', prefixes: [/^sess/i, /^session/i, /\bsid\b/i] },
  { bucket: 'user_records', purpose: 'user/account data cache', prefixes: [/^users?[:_]/i, /^account/i, /^profile/i] },
  { bucket: 'auth_tokens', purpose: 'authentication token store', prefixes: [/^token/i, /^jwt/i, /^oauth/i, /^refresh/i, /apikey/i] },
  { bucket: 'verification_codes', purpose: 'OTP/verification code store', prefixes: [/^otp/i, /^verif/i, /^code[:_]/i] },
  { bucket: 'ecommerce', purpose: 'shopping cart / order state', prefixes: [/^cart/i, /^basket/i, /^order/i, /^checkout/i] },
  { bucket: 'job_queues', purpose: 'background job queue', prefixes: [/^queue/i, /^job/i, /^task/i, /^celery/i, /^bull/i, /^sidekiq/i, /^resque/i, /^rq:/i] },
  { bucket: 'rate_limiting', purpose: 'rate limiter', prefixes: [/^ratelimit/i, /^rl:/i, /^throttle/i] },
  { bucket: 'locks', purpose: 'distributed locks / leader election', prefixes: [/^lock/i, /^mutex/i, /^leader/i] },
  { bucket: 'configuration', purpose: 'configuration / feature flags', prefixes: [/^config/i, /^setting/i, /^feature/i, /^flag/i] },
  { bucket: 'notifications', purpose: 'notification outbox', prefixes: [/^notif/i, /^email/i, /^sms/i, /^push/i] },
  { bucket: 'messaging', purpose: 'chat/messaging state', prefixes: [/^message/i, /^chat/i, /^room/i, /^presence/i] },
  { bucket: 'social', purpose: 'social feed state', prefixes: [/^feed/i, /^timeline/i, /^post/i, /^like/i, /^follow/i] },
  { bucket: 'leaderboards', purpose: 'leaderboards / scoring', prefixes: [/^leaderboard/i, /^ranking/i, /^score/i] },
  { bucket: 'geospatial', purpose: 'geospatial index', prefixes: [/^geo/i, /^location/i] },
  { bucket: 'generic_cache', purpose: 'generic cache', prefixes: [/^cache/i, /^cached/i] },
];

/**
 * Parse an INFO keyspace section ("db0:keys=...,expires=...,avg_ttl=...").
 * @param {string} text Raw keyspace section text.
 * @returns {Array<{db: string, keys: number, expires: number, avgTtlMs: number}>}
 */
export function parseKeyspaceSection(text) {
  const dbs = [];
  if (typeof text !== 'string') return dbs;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    const m = /^(db\d+):(.+)$/i.exec(line);
    if (!m) continue;
    const parts = Object.fromEntries(m[2].split(',').map((p) => p.split('=')));
    dbs.push({
      db: m[1].toLowerCase(),
      keys: parseInt(parts.keys || '0', 10),
      expires: parseInt(parts.expires || '0', 10),
      avgTtlMs: parseInt(parts.avg_ttl || '0', 10),
    });
  }
  return dbs;
}

/**
 * Bucket sampled key names by prefix pattern (names only — values untouched).
 * @param {string[]} keyNames Sampled key names.
 * @returns {Array<{bucket: string, purpose: string, count: number, share: number}>}
 */
export function profileKeyPrefixes(keyNames) {
  const names = (keyNames || []).filter((k) => typeof k === 'string' && k.length > 0);
  const counts = new Map();
  let unmatched = 0;
  for (const name of names) {
    const hit = KEY_PREFIX_BUCKETS.find((b) => b.prefixes.some((re) => re.test(name)));
    if (hit) counts.set(hit.bucket, (counts.get(hit.bucket) || 0) + 1);
    else unmatched += 1;
  }
  const profile = [...counts.entries()].map(([bucket, count]) => {
    const def = KEY_PREFIX_BUCKETS.find((b) => b.bucket === bucket);
    return { bucket, purpose: def.purpose, count, share: names.length ? count / names.length : 0 };
  }).sort((a, b) => b.count - a.count);
  if (unmatched > 0) profile.push({ bucket: 'unclassified', purpose: 'unclassified key names', count: unmatched, share: names.length ? unmatched / names.length : 0 });
  return profile;
}

/**
 * Analyze keyspace metadata + key-name sample to infer application purpose.
 * @param {{keyspaceText?: string, keySample?: string[]}} input
 * @returns {{databases, totalKeys, expiringShare, prefixProfile, inferredPurpose, findings, confidence}}
 */
export function analyzeRedisKeyspace({ keyspaceText = '', keySample = [] } = {}) {
  const databases = parseKeyspaceSection(keyspaceText);
  const totalKeys = databases.reduce((n, d) => n + d.keys, 0);
  const totalExpires = databases.reduce((n, d) => n + d.expires, 0);
  const expiringShare = totalKeys > 0 ? totalExpires / totalKeys : 0;
  const prefixProfile = profileKeyPrefixes(keySample);
  const findings = [];

  findings.push(`${totalKeys} key(s) across ${databases.length} database(s); ${(expiringShare * 100).toFixed(1)}% carry a TTL.`);
  if (expiringShare > 0.7) findings.push('Most keys expire — typical of sessions, tokens, OTPs, or caches rather than durable storage.');
  else if (expiringShare < 0.1 && totalKeys > 0) findings.push('Few keys expire — data is treated as durable; loss would be more impactful.');

  let inferredPurpose = 'unknown';
  let confidence = 'low';
  const top = prefixProfile.find((p) => p.bucket !== 'unclassified');
  if (top && keySample.length >= 10) {
    inferredPurpose = top.purpose;
    confidence = top.share >= 0.4 ? 'high' : 'medium';
    findings.push(`Dominant key pattern "${top.bucket}" (${(top.share * 100).toFixed(0)}% of sample) suggests: ${top.purpose}.`);
    if (prefixProfile.length > 2) {
      findings.push(`Mixed workload — also: ${prefixProfile.slice(1, 4).map((p) => p.purpose).join(', ')}.`);
    }
  } else if (keySample.length > 0 && keySample.length < 10) {
    findings.push('Sample too small (<10 names) for a reliable purpose inference — collect a larger SCAN sample of names only.');
  } else if (databases.length > 0) {
    findings.push('No key-name sample supplied; purpose inference limited to TTL/expiry shape. Names-only sampling recommended.');
  } else {
    findings.push('Empty keyspace section — nothing to analyze.');
  }

  return { databases, totalKeys, expiringShare, prefixProfile, inferredPurpose, findings, confidence };
}

export const REDIS_KEYSPACE_ANALYZER = { parseKeyspaceSection, profileKeyPrefixes, analyzeRedisKeyspace, KEY_PREFIX_BUCKETS };
export default REDIS_KEYSPACE_ANALYZER;
