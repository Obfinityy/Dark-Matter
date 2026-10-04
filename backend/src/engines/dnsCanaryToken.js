/**
 * dnsCanaryToken.js — DNS canary-token deployment and monitoring (idea 00200).
 *
 * Complementary to CT honeytokens: the agent deploys canary DNS records
 * (TXT/A records under unguessable names) on the target's OWN zone during an
 * authorized hunt. Any query for those names proves third-party enumeration
 * of the zone — e.g. a competitor's scanner pulling AXFR-style dumps or a
 * subdomain brute-forcer. This module builds the records and analyzes query
 * logs for canary hits, attributing them to sources.
 * All functions are pure and synchronous — no network calls.
 */

/**
 * Idea 00200 — Build canary DNS records for deployment on the target zone.
 *
 * Returns zone-file-style record objects. The token value is a unique
 * marker (e.g. `canary=<id>`) so accidental collisions are impossible.
 *
 * @param {string} apex — zone apex (e.g. "example.com")
 * @param {number} [count] — number of canary records (default 3, max 20)
 * @param {string} [tokenId] — stable token id; generated when omitted
 * @returns {{ records: Array<{ name, type, ttl, value }>, tokenId }}
 */
export function buildCanaryRecords(apex, count = 3, tokenId = null) {
  const domain = String(apex || '').toLowerCase().replace(/\.$/, '');
  if (!domain || !domain.includes('.')) return { records: [], tokenId: null };
  const n = Math.max(1, Math.min(20, Math.floor(count) || 3));
  const id = tokenId
    || `ct-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const records = [];
  for (let i = 0; i < n; i++) {
    const name = `zz-canary-${id}-${i}.${domain}`;
    records.push(
      { name, type: 'TXT', ttl: 60, value: `canary=${id};seq=${i}` },
      { name, type: 'A', ttl: 60, value: '192.0.2.1' }, // TEST-NET-1 sinkhole
    );
  }
  return { records, tokenId: id };
}

/**
 * Idea 00200 — Analyze a DNS query log for canary hits.
 *
 * Accepts query log entries ({ qname, qtype, client, timestamp }) and
 * returns every query that touched a canary name — evidence of third-party
 * enumeration — grouped by querying client.
 *
 * @param {Array<{ qname, qtype?, client?, timestamp? }>} queryLog
 * @param {Array<{ name }|string>} canaryRecords — deployed canary records (or names)
 * @returns {{ hits: Array<{ qname, qtype, client, timestamp }>, byClient: Array<{ client, hits: number, qnames: string[], firstSeen, lastSeen }>, stats: { queries, hits } }}
 */
export function analyzeCanaryQueries(queryLog = [], canaryRecords = []) {
  const canaryNames = new Set(
    (canaryRecords || []).map((r) => String((r && r.name) || r || '').toLowerCase().replace(/\.$/, '')),
  );
  const hits = [];
  for (const q of queryLog || []) {
    if (!q || !q.qname) continue;
    const name = String(q.qname).toLowerCase().replace(/\.$/, '');
    if (!canaryNames.has(name)) continue;
    hits.push({
      qname: name,
      qtype: q.qtype || 'A',
      client: q.client || 'unknown',
      timestamp: q.timestamp || null,
    });
  }
  const byClient = new Map();
  for (const hit of hits) {
    if (!byClient.has(hit.client)) {
      byClient.set(hit.client, { client: hit.client, hits: 0, qnames: new Set(), firstSeen: null, lastSeen: null });
    }
    const g = byClient.get(hit.client);
    g.hits++;
    g.qnames.add(hit.qname);
    const times = [g.firstSeen, g.lastSeen, hit.timestamp].filter(Boolean).sort();
    g.firstSeen = times[0] || null;
    g.lastSeen = times[times.length - 1] || null;
  }
  const clients = [...byClient.values()]
    .map((g) => ({ ...g, qnames: [...g.qnames].sort() }))
    .sort((a, b) => b.hits - a.hits);
  return {
    hits,
    byClient: clients,
    stats: { queries: (queryLog || []).length, hits: hits.length },
  };
}

/**
 * Idea 00200 — Classify enumeration behavior from canary hits.
 *
 * Distinguishes brute-force-style sweeps (many distinct canaries from one
 * client) from targeted lookups (one canary, few queries) so the report can
 * describe the adversary's technique.
 *
 * @param {Array<{ client, hits, qnames: string[], firstSeen, lastSeen }>} byClient — from analyzeCanaryQueries
 * @returns {Array<{ client, pattern, hits, distinctCanaries, note }>}
 */
export function classifyEnumeration(byClient = []) {
  return (byClient || []).map((c) => {
    const distinct = new Set(c.qnames || []).size;
    let pattern = 'targeted-lookup';
    let note = 'Single canary queried — likely a targeted check or resolver retry.';
    if (distinct >= 3 && c.hits >= distinct * 2) {
      pattern = 'brute-force-sweep';
      note = 'Multiple distinct canaries queried repeatedly — brute-force enumeration of the zone.';
    } else if (distinct >= 2) {
      pattern = 'broad-enumeration';
      note = 'More than one canary queried — broader zone enumeration in progress.';
    }
    return { client: c.client, pattern, hits: c.hits, distinctCanaries: distinct, note };
  }).sort((a, b) => b.distinctCanaries - a.distinctCanaries);
}
