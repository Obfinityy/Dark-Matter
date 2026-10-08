/**
 * winsDbIntel.js — WINS server record extraction (idea 00128).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent. WINS
 * (Windows Internet Name Service) databases map legacy NetBIOS hostnames to
 * IP addresses for a whole site — including decommissioned machines whose
 * records linger as tombstones, multihomed hosts, and static entries an
 * administrator pinned by hand. Where the agent can legitimately read a
 * WINS export or database dump, parsing it yields a hostname↔IP map of the
 * legacy Windows estate.
 *
 * All functions are pure: they parse WINS export/dump text supplied by the
 * caller and never query WINS servers themselves.
 */

const IPV4_RE = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d{1,2})\.){3}(?:25[0-5]|2[0-4]\d|1?\d{1,2})\b/;

/**
 * Normalize one candidate record line into { name, ip, nameType, state }.
 * Handles several common export shapes:
 *   "WS042<00>  192.168.10.42  ACTIVE"
 *   "WS042,00,192.168.10.42,active"
 *   "name=WS042 type=00 ip=192.168.10.42 state=active"
 *   "WS042  192.168.10.42"
 *
 * @param {string} line
 * @returns {{ name: string, ip: string, nameType: string | null, state: string | null } | null}
 */
export function parseWinsLine(line) {
  const l = String(line || '').trim();
  if (!l || /^[#;]/.test(l)) return null;
  const ipM = l.match(IPV4_RE);
  if (!ipM) return null;
  const ip = ipM[0];

  let name = null;
  let nameType = null;
  let state = null;

  let m = l.match(/([A-Za-z0-9][\w.$-]{0,30})<([0-9A-Fa-f]{2})>/);
  if (m) {
    name = m[1];
    nameType = m[2].toUpperCase();
  }
  if (!name && (m = l.match(/name\s*=\s*([A-Za-z0-9][\w.$-]{0,30})/i))) name = m[1];
  if (!name && (m = l.match(/^"?([A-Za-z0-9][\w.$-]{1,30})"?\s*[,;]\s*/))) name = m[1];
  if (!name) {
    const before = l
      .slice(0, ipM.index)
      .trim()
      .replace(/[,;:"'=<>]+$/g, '')
      .trim();
    const tok = before
      .split(/[\s,;]+/)
      .filter(Boolean)
      .pop();
    if (tok && /^[A-Za-z0-9][\w.$-]{0,30}$/.test(tok) && !/^\d+$/.test(tok)) name = tok;
  }
  if (!name) return null;

  if (!nameType && (m = l.match(/(?:type\s*=\s*|[,;]\s*)([0-9A-Fa-f]{2})(?:[,;\s]|$)/)))
    nameType = m[1].toUpperCase();
  if ((m = l.match(/\b(active|released|tombstone|tombstoned|expired|static|dynamic)\b/i))) {
    state = m[1].toLowerCase() === 'tombstoned' ? 'tombstone' : m[1].toLowerCase();
  }

  return { name: name.replace(/\.$/, ''), ip, nameType, state };
}

/**
 * Idea 00128 — WINS server record extraction.
 *
 * Parses WINS database exports/dumps into hostname↔IP mappings, indexes
 * them both ways, and flags tombstoned (decommissioned) and multihomed
 * records.
 *
 * @param {string} text Raw WINS export/dump text.
 * @returns {{
 *   entries: Array<{ name: string, ip: string, nameType: string | null, state: string | null }>,
 *   byName: Record<string, Array<{ ip: string, nameType: string | null, state: string | null }>>,
 *   byIp: Record<string, string[]>,
 *   tombstones: Array<{ name: string, ip: string }>,
 *   multihomed: Array<{ name: string, ips: string[] }>,
 *   summary: { total: number, uniqueNames: number, uniqueIps: number, tombstoned: number },
 *   findings: string[]
 * }}
 */
export function extractWinsRecords(text) {
  const entries = [];
  const seen = new Set();
  for (const line of String(text || '').split('\n')) {
    const r = parseWinsLine(line);
    if (!r) continue;
    const key = `${r.name.toLowerCase()}|${r.ip}|${r.nameType || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push(r);
  }

  const byName = {};
  const byIp = {};
  for (const e of entries) {
    const nk = e.name.toLowerCase();
    (byName[nk] = byName[nk] || []).push({ ip: e.ip, nameType: e.nameType, state: e.state });
    (byIp[e.ip] = byIp[e.ip] || []).push(e.name);
  }

  const tombstones = entries
    .filter(e => e.state === 'tombstone' || e.state === 'released' || e.state === 'expired')
    .map(e => ({ name: e.name, ip: e.ip }));

  const multihomed = Object.entries(byName)
    .filter(([, v]) => new Set(v.map(x => x.ip)).size > 1)
    .map(([name, v]) => ({ name, ips: [...new Set(v.map(x => x.ip))] }));

  const summary = {
    total: entries.length,
    uniqueNames: Object.keys(byName).length,
    uniqueIps: Object.keys(byIp).length,
    tombstoned: tombstones.length,
  };

  const findings = [];
  if (entries.length) {
    findings.push(
      `${summary.uniqueNames} hostname(s) ↔ ${summary.uniqueIps} IP(s) mapped from WINS records — ` +
        'a legacy Windows estate inventory; cross-reference with DNS for stale entries.'
    );
  }
  if (tombstones.length) {
    findings.push(
      `${tombstones.length} tombstoned/released record(s): ` +
        `${tombstones
          .slice(0, 8)
          .map(t => `${t.name} (${t.ip})`)
          .join(', ')}${tombstones.length > 8 ? '…' : ''} — ` +
        'decommissioned hosts whose names/IPs may be reclaimable or still referenced.'
    );
  }
  if (multihomed.length) {
    findings.push(
      `${multihomed.length} multihomed name(s): ` +
        `${multihomed
          .slice(0, 6)
          .map(x => `${x.name} → ${x.ips.join(', ')}`)
          .join('; ')}${multihomed.length > 6 ? '…' : ''} — ` +
        'multi-interface hosts, often servers or cluster nodes.'
    );
  }
  const statics = entries.filter(e => e.state === 'static');
  if (statics.length) {
    findings.push(
      `${statics.length} static WINS record(s) — hand-pinned entries usually mark ` +
        'infrastructure the admins consider permanent (DCs, file servers).'
    );
  }
  if (!entries.length) {
    findings.push(
      'No WINS records parsed — confirm the input is a WINS export/dump with hostname and IP per line.'
    );
  }

  return { entries, byName, byIp, tombstones, multihomed, summary, findings };
}
