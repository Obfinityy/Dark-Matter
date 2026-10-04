/**
 * ip2locationNetblockMap.js — IP2Location-style netblock-to-org mapping (idea 00193).
 *
 * Targets grow through acquisitions that keep their original legal-entity
 * names ("WidgetCo LLC" bought by the target still registers netblocks as
 * WidgetCo). This module maps netblocks to organization names from geolocation
 * dataset rows, then cross-references them against the target's known org
 * aliases — flagging netblocks whose org differs from the brand but whose
 * metadata (shared contact emails, overlapping prefixes, parent company
 * hints) suggests a hidden acquisition worth scoping.
 * All functions are pure and synchronous — no network calls.
 */

import { normalizeOrgName, scoreOrgAgainstBrand } from './maxmindAsnOrgMatch.js';

/**
 * Idea 00193 — Map netblocks to their registered organizations.
 *
 * @param {Array<{ network, organization, country? }>} rows — dataset rows
 * @param {string} brand — target brand / legal name
 * @param {string[]} [knownAliases] — already-known legal entity names
 * @returns {{ matched: Array<{ network, organization, tier, score }>, unmatched: Array<{ network, organization }>, stats: { scanned, matched } }}
 */
export function mapNetblocksToOrgs(rows = [], brand, knownAliases = []) {
  const aliases = new Set(
    (knownAliases || []).map((a) => normalizeOrgName(a)).filter(Boolean),
  );
  const matched = [];
  const unmatched = [];
  let scanned = 0;
  for (const r of rows || []) {
    if (!r || !r.network) continue;
    scanned++;
    const res = scoreOrgAgainstBrand(r.organization, brand, knownAliases);
    const entry = {
      network: String(r.network),
      organization: r.organization,
      tier: res.tier,
      score: res.score,
    };
    if (res.score >= 40 || aliases.has(normalizeOrgName(r.organization))) {
      matched.push(entry);
    } else {
      unmatched.push({ network: String(r.network), organization: r.organization });
    }
  }
  matched.sort((a, b) => b.score - a.score);
  return { matched, unmatched, stats: { scanned, matched: matched.length } };
}

/**
 * Idea 00193 — Detect likely hidden acquisitions among unmatched orgs.
 *
 * A netblock whose org name does NOT match the brand becomes a candidate
 * when sibling signals tie it to the target: shared admin contact domains,
 * shared upstream ASN with already-matched netblocks, or keyword overlap
 * with the target's product portfolio.
 *
 * @param {Array<{ network, organization }>} unmatched — from mapNetblocksToOrgs
 * @param {{ adminDomains?: string[], knownAsns?: number[], productKeywords?: string[] }} signals
 * @param {Array<{ network, organization, adminEmail?, asn?, note? }>} [enrichedRows] — optional enriched netblock metadata
 * @returns {Array<{ network, organization, signals: string[], confidence }>} sorted by confidence
 */
export function detectHiddenAcquisitions(unmatched = [], signals = {}, enrichedRows = []) {
  const adminDomains = new Set(
    (signals.adminDomains || []).map((d) => String(d).toLowerCase()),
  );
  const knownAsns = new Set(
    (signals.knownAsns || []).map(Number).filter(Number.isFinite),
  );
  const keywords = (signals.productKeywords || [])
    .map((k) => String(k).toLowerCase())
    .filter(Boolean);

  const meta = new Map();
  for (const r of enrichedRows || []) {
    if (r && r.network) meta.set(String(r.network), r);
  }

  const out = [];
  for (const u of unmatched || []) {
    const hits = [];
    const m = meta.get(String(u.network));
    if (m) {
      const emailDomain = String(m.adminEmail || '').split('@')[1];
      if (emailDomain && adminDomains.has(emailDomain.toLowerCase())) {
        hits.push(`shared-admin-domain:${emailDomain.toLowerCase()}`);
      }
      if (Number.isFinite(Number(m.asn)) && knownAsns.has(Number(m.asn))) {
        hits.push(`shared-asn:${m.asn}`);
      }
    }
    const orgLower = String(u.organization || '').toLowerCase();
    for (const kw of keywords) {
      if (orgLower.includes(kw)) {
        hits.push(`product-keyword:${kw}`);
        break;
      }
    }
    if (hits.length) {
      out.push({
        network: String(u.network),
        organization: u.organization,
        signals: hits,
        confidence: Math.min(95, 35 + hits.length * 20),
      });
    }
  }
  return out.sort((a, b) => b.confidence - a.confidence);
}
