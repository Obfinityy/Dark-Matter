/**
 * bgpAsnIntel.js — BGP / ASN intelligence (ideas 00025–00029).
 *
 * Defensive asset-discovery parsers for an authorized bug-bounty agent:
 * ASN prefix enumeration from BGP data, MOAS anomaly detection, IRR object
 * mining, RPKI ROA discovery, and BGP community-string decoding.
 * All functions are pure and synchronous — no network calls.
 */

/**
 * Idea 00025 — ASN enumeration via BGP origin.
 *
 * From a list of BGP route table entries, enumerate every prefix originated
 * by the target's ASNs. Accepts collector-style records
 * { prefix, asPath, collector? } and derives the origin ASN from the
 * right-most AS_PATH element.
 *
 * @param {Array<{prefix, asPath, collector?}>} routes
 * @param {Array<number|string>} targetAsns
 * @returns {{ prefixes: Array<{prefix, originAs, seenBy}>, asns: number[] }}
 */
export function enumerateOrgPrefixes(routes, targetAsns) {
  const targets = new Set((targetAsns || []).map(a => Number(a)).filter(Number.isFinite));

  const byPrefix = new Map();
  for (const r of routes || []) {
    if (!r || !r.prefix) continue;
    const path = String(r.asPath || '').trim().split(/\s+/).map(Number).filter(Number.isFinite);
    const originAs = path.length ? path[path.length - 1] : null;
    if (originAs === null || !targets.has(originAs)) continue;
    let entry = byPrefix.get(r.prefix);
    if (!entry) {
      entry = { prefix: r.prefix, originAs, seenBy: new Set() };
      byPrefix.set(r.prefix, entry);
    }
    if (r.collector) entry.seenBy.add(String(r.collector));
  }

  const prefixes = [...byPrefix.values()]
    .map(e => ({ prefix: e.prefix, originAs: e.originAs, seenBy: [...e.seenBy] }))
    .sort((a, b) => a.prefix.localeCompare(b.prefix, undefined, { numeric: true }));

  return { prefixes, asns: [...targets].sort((a, b) => a - b) };
}

/**
 * Idea 00026 — BGP MOAS anomaly detection.
 *
 * Detects Multiple Origin AS announcements: the same prefix announced with
 * different origin ASes. MOAS often indicates cloud migrations (benign) or
 * prefix hijack attempts (worth investigating).
 *
 * @param {Array<{prefix, asPath, collector?}>} routes
 * @returns {Array<{prefix, originAses, origins, suspicion, reason}>}
 *   Sorted by suspicion descending.
 */
export function detectMoas(routes) {
  const byPrefix = new Map();
  for (const r of routes || []) {
    if (!r || !r.prefix) continue;
    const path = String(r.asPath || '').trim().split(/\s+/).map(Number).filter(Number.isFinite);
    if (!path.length) continue;
    const originAs = path[path.length - 1];
    let entry = byPrefix.get(r.prefix);
    if (!entry) { entry = { prefix: r.prefix, originAses: new Set(), origins: [] }; byPrefix.set(r.prefix, entry); }
    if (!entry.originAses.has(originAs)) {
      entry.originAses.add(originAs);
      entry.origins.push({ originAs, asPath: r.asPath, collector: r.collector ?? null });
    }
  }

  const anomalies = [];
  for (const e of byPrefix.values()) {
    if (e.originAses.size < 2) continue;
    const ases = [...e.originAses].sort((a, b) => a - b);
    // RPKI-uncovered AS pairs and very asymmetric origin sets score higher.
    const suspicion = ases.length >= 3 ? 3 : 2;
    anomalies.push({
      prefix: e.prefix,
      originAses: ases,
      origins: e.origins,
      suspicion,
      reason: `Prefix announced from ${ases.length} origin ASes (${ases.join(', ')}) — possible cloud migration or hijack attempt`,
    });
  }
  return anomalies.sort((a, b) => b.suspicion - a.suspicion || a.prefix.localeCompare(b.prefix, undefined, { numeric: true }));
}

/**
 * Parse RIPE-style WHOIS/IRR flat output into objects:
 * [{ type: 'route', attrs: { 'route': [...], 'descr': [...], ... } }, ...].
 * @param {string} text
 */
function parseIrrObjects(text) {
  const objects = [];
  let current = null;
  for (const rawLine of String(text || '').split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    if (line.trim() === '') {
      if (current) { objects.push(current); current = null; }
      continue;
    }
    const m = line.match(/^\s*([\w-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const [, key, value] = m;
    if (!current) current = { type: key.toLowerCase(), attrs: {} };
    const k = key.toLowerCase();
    if (!current.attrs[k]) current.attrs[k] = [];
    current.attrs[k].push(value.trim());
  }
  if (current) objects.push(current);
  return objects;
}

/**
 * Idea 00027 — IRR object mining.
 *
 * Parses Internet Routing Registry response objects for the target's ASNs and
 * extracts referenced hostnames, contacts, and peer networks (from route,
 * route6, aut-num, and as-set objects: descr, admin-c/tech-c/notify/mnt-by,
 * import/export/peer statements, members).
 *
 * @param {string} irrText - raw IRR/RADB whois response text.
 * @param {Array<number|string>} targetAsns
 * @returns {{ hostnames: string[], contacts: string[], peerAsns: number[],
 *             routes: string[], objectsParsed: number }}
 */
export function mineIrrObjects(irrText, targetAsns) {
  const targets = new Set((targetAsns || []).map(a => String(a).toUpperCase()));
  const hostnames = new Set();
  const contacts = new Set();
  const peerAsns = new Set();
  const routes = new Set();
  const hostnameRx = /\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/gi;

  let parsed = 0;
  for (const obj of parseIrrObjects(irrText)) {
    parsed++;
    const a = obj.attrs;
    // Only keep objects actually tied to a target ASN (via origin or aut-num).
    const originAsns = (a['origin'] || []).map(v => String(v).toUpperCase().replace(/^AS/, ''));
    const autNumAsns = (a['aut-num'] || []).map(v => String(v).toUpperCase().replace(/^AS/, ''));
    const belongs = originAsns.some(v => targets.has(v)) || autNumAsns.some(v => targets.has(v));
    if (!belongs) continue;

    for (const v of [...(a['route'] || []), ...(a['route6'] || [])]) routes.add(v);

    for (const field of ['descr', 'remarks']) {
      for (const v of a[field] || []) {
        for (const m of v.match(hostnameRx) || []) hostnames.add(m.toLowerCase());
      }
    }
    for (const field of ['admin-c', 'tech-c', 'notify', 'mnt-by', 'e-mail', 'email', 'abuse-mailbox']) {
      for (const v of a[field] || []) contacts.add(v);
    }
    const peeringText = [
      ...(a['import'] || []), ...(a['export'] || []), ...(a['peer'] || []),
      ...(a['members'] || []), ...(a['mp-import'] || []), ...(a['mp-export'] || []),
    ].join(' ');
    for (const m of peeringText.match(/\bAS(\d{1,10})\b/gi) || []) {
      const asn = Number(m.replace(/^AS/i, ''));
      if (Number.isFinite(asn) && !targets.has(String(asn))) peerAsns.add(asn);
    }
  }

  return {
    hostnames: [...hostnames].sort(),
    contacts: [...contacts].sort(),
    peerAsns: [...peerAsns].sort((x, y) => x - y),
    routes: [...routes].sort(),
    objectsParsed: parsed,
  };
}

/**
 * Idea 00028 — RPKI ROA prefix discovery.
 *
 * Reads RPKI route-origin authorizations (ROAs) for the target ASN and lists
 * every prefix the org claims — including ones not yet advertised in BGP.
 * Cross-referencing against the advertised set reveals dormant/parked space.
 *
 * @param {Array<{prefix, asn, maxLength?}>} roas - ROA records.
 * @param {number|string} targetAsn
 * @param {Array<string>} [advertisedPrefixes] - prefixes seen in BGP (optional).
 * @returns {{ claimed: Array<{prefix, maxLength, advertised}>,
 *            dormant: string[], total: number }}
 */
export function listRoaPrefixes(roas, targetAsn, advertisedPrefixes = []) {
  const asn = Number(targetAsn);
  const advertised = new Set((advertisedPrefixes || []).map(p => String(p)));
  const claimed = (roas || [])
    .filter(r => r && Number(r.asn) === asn && r.prefix)
    .map(r => ({
      prefix: String(r.prefix),
      maxLength: r.maxLength ?? null,
      advertised: advertised.has(String(r.prefix)),
    }))
    .sort((a, b) => a.prefix.localeCompare(b.prefix, undefined, { numeric: true }));

  const dormant = claimed.filter(c => !c.advertised).map(c => c.prefix);
  return { claimed, dormant, total: claimed.length };
}

/** Well-known BGP communities (RFC 1997 / RFC 7999 / operator practice). */
const WELL_KNOWN_COMMUNITIES = new Map([
  ['0:0', 'NO_EXPORT_SUBCONFED / (vendor-specific)'],
  ['65535:65281', 'NO_EXPORT — do not advertise outside confederation'],
  ['65535:65282', 'NO_ADVERTISE — do not advertise to any peer'],
  ['65535:65283', 'NO_EXPORT_SUBCONFED'],
  ['65535:65284', 'NOPEER'],
  ['65535:666', 'BLACKHOLE — RTBH / blackhole this prefix'],
  ['65535:0', 'NO_EXPORT (legacy)'],
  ['0:65535', 'Internet community'],
]);

/**
 * Idea 00029 — BGP community-string decoding.
 *
 * Decodes BGP community strings on target prefixes to infer PoP locations and
 * traffic-engineering setups that reveal edge infrastructure. Handles both
 * standard 2-octet communities ("asn:value") and large communities
 * ("asn:value1:value2").
 *
 * Heuristics:
 *  - Well-known communities (NO_EXPORT, BLACKHOLE, …) are named directly.
 *  - asn:value communities where value < 1000 are treated as operator tags
 *    (often region/PoP codes); the origin ASN's own communities are flagged
 *    as "self-tags" worth reverse-looking-up in PeeringDB-style sources.
 *  - Large-community value1 often encodes PoP/region identifiers.
 *
 * @param {Array<{prefix, communities: string[]}>} routes
 * @returns {Array<{prefix, decoded: Array<{community, kind, meaning}>, edgeHints: string[]}>}
 */
export function decodeBgpCommunities(routes) {
  const results = [];
  for (const r of routes || []) {
    if (!r || !r.prefix) continue;
    const decoded = [];
    const edgeHints = new Set();

    for (const raw of r.communities || []) {
      const community = String(raw).trim();
      const entry = { community, kind: 'unknown', meaning: null };

      if (WELL_KNOWN_COMMUNITIES.has(community)) {
        entry.kind = 'well-known';
        entry.meaning = WELL_KNOWN_COMMUNITIES.get(community);
        if (community === '65535:666') edgeHints.add('prefix marked BLACKHOLE — edge scrubbing/mitigation path');
      } else {
        const parts = community.split(':').map(Number);
        const allNumeric = parts.every(Number.isFinite);
        if (allNumeric && parts.length === 2) {
          const [asn, value] = parts;
          if (asn === 65535 && value > 65280) {
            entry.kind = 'reserved';
          } else if (value < 1000) {
            entry.kind = 'operator-tag';
            entry.meaning = `operator-defined tag ${value} from AS${asn} — commonly a PoP/region code`;
            edgeHints.add(`AS${asn} tags prefix with regional PoP-style code ${value}`);
          } else {
            entry.kind = 'traffic-engineering';
            entry.meaning = `operator-defined TE action ${value} from AS${asn} (localpref/med/announce-control)`;
            edgeHints.add(`traffic-engineering tag ${value} on ${r.prefix} — edge policy visible`);
          }
        } else if (allNumeric && parts.length === 3) {
          const [asn, v1, v2] = parts;
          entry.kind = 'large-community';
          entry.meaning = `RFC 8092 large community AS${asn}:${v1}:${v2} — value1 often encodes PoP/region`;
          edgeHints.add(`large community PoP-style identifier ${v1} from AS${asn}`);
        }
      }
      decoded.push(entry);
    }

    results.push({ prefix: r.prefix, decoded, edgeHints: [...edgeHints] });
  }
  return results;
}
