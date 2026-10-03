/**
 * fofaBannerIntel.js — Fofa banner-fingerprint expansion for autonomous bug bounty.
 *
 * Implements idea-bank item 00156: expand from a known banner to all
 * matching hosts in Fofa within the target's ASNs.
 *
 * When the hunt confirms a distinctive service banner on a target host
 * (e.g. a custom "220 mailrelay-corp01" SMTP greeting), other hosts in the
 * target's ASNs presenting the same banner are very likely the same
 * organization's assets. This module fingerprints banners into stable
 * signatures, matches supplied Fofa records against a seed signature, and
 * constrains results to the target's ASN set.
 *
 * All functions are pure and side-effect free: they operate on Fofa API
 * result objects the caller obtained through a legitimate Fofa account
 * during an authorized engagement. No scanning is performed here.
 */

/**
 * Reduce a banner to a stable fingerprint: lowercase, strip timestamps,
 * session IDs, dates and version-build suffixes that change per connection.
 * @param {string} banner
 * @returns {string|null}
 */
export function bannerFingerprint(banner) {
  if (!banner || typeof banner !== 'string') return null;
  let fp = banner.split(/\r?\n/)[0] || '';
  fp = fp
    .toLowerCase()
    .replace(/\b\d{4}-\d{2}-\d{2}[t ]\d{2}:\d{2}:\d{2}[^\s]*/g, '') // timestamps
    .replace(/\b\d{10,}\b/g, '')                                    // epoch/unix ids
    .replace(/\b[a-f0-9]{8,}-[a-f0-9-]{8,}\b/g, '')                // uuids
    .replace(/session[=:\s]+[a-z0-9-]+/g, 'session')
    .replace(/\s+/g, ' ')
    .trim();
  return fp || null;
}

/**
 * Compare two banner fingerprints with a token-set similarity in [0,1].
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function bannerSimilarity(a, b) {
  if (!a || !b) return 0;
  const ta = new Set(a.split(' '));
  const tb = new Set(b.split(' '));
  const inter = [...ta].filter((t) => tb.has(t)).length;
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * Extract (banner, ip, asn, port, protocol) rows from Fofa records.
 * Accepts banners under `banner`, `header`, `data` or `raw`.
 * @param {Array<object>} records Fofa result objects: { ip, asn, port, protocol, banner?... }.
 * @returns {Array<{banner:string, fingerprint:string, ip:string, asn:string|null, port:number, protocol:string}>}
 */
export function extractFofaBanners(records) {
  const out = [];
  for (const record of Array.isArray(records) ? records : []) {
    const raw = record.banner ?? record.header ?? record.data ?? record.raw;
    if (typeof raw !== 'string' || !raw.trim()) continue;
    const fp = bannerFingerprint(raw);
    if (!fp) continue;
    out.push({
      banner: raw.split(/\r?\n/)[0],
      fingerprint: fp,
      ip: record.ip || record.host || 'unknown',
      asn: record.asn != null ? String(record.asn) : (record.asnumber ? String(record.asnumber) : null),
      port: record.port || null,
      protocol: record.protocol || 'unknown',
    });
  }
  return out;
}

/**
 * Expand from a seed banner to all matching hosts in the target's ASNs.
 * @param {Array<object>} records Fofa result objects (same shape as extractFofaBanners input).
 * @param {string} seedBanner The confirmed banner from the target host.
 * @param {object} opts { targetAsns?: string[], threshold?: number }.
 *   Only hosts whose ASN is in targetAsns (when provided) are returned;
 *   matches need similarity >= threshold (default 0.8).
 * @returns {{seedFingerprint:string, matches:Array<{ip:string, asn:string|null, port:number, protocol:string, similarity:number, banner:string}>}}
 */
export function expandByBanner(records, seedBanner, opts = {}) {
  const seedFp = bannerFingerprint(seedBanner);
  const threshold = opts.threshold != null ? opts.threshold : 0.8;
  const targetAsns = new Set((opts.targetAsns || []).map(String));
  const matches = [];
  if (!seedFp) return { seedFingerprint: null, matches };
  for (const row of extractFofaBanners(records)) {
    if (targetAsns.size > 0 && (!row.asn || !targetAsns.has(row.asn))) continue;
    const sim = bannerSimilarity(seedFp, row.fingerprint);
    if (sim >= threshold) {
      matches.push({ ip: row.ip, asn: row.asn, port: row.port, protocol: row.protocol, similarity: Math.round(sim * 100) / 100, banner: row.banner });
    }
  }
  matches.sort((a, b) => b.similarity - a.similarity || a.ip.localeCompare(b.ip));
  return { seedFingerprint: seedFp, matches };
}
