/**
 * dmarcFailureForensics.js — DMARC aggregate-report forensics engine.
 *
 * @idea 0311 — Email-authentication failure forensics: analyze DMARC
 *   aggregate reports for unauthorized senders using brand subdomains.
 *
 * Pure functions only: callers fetch and parse the DMARC aggregate report
 * (XML/JSON) themselves — respecting provider rate limits — and pass the
 * parsed per-record rows in. No live IMAP/HTTP here.
 *
 * Defensive framing: helps an authorized bug-bounty team or domain owner
 * spot unauthorized mail senders spoofing their brand domains so they can
 * enforce DMARC policy.
 */

const KNOWN_LEGIT_MAILERS = new Set([
  'google.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'amazonaws.com',
  'sendgrid.net', 'mailgun.org', 'postmarkapp.com', 'mandrillapp.com',
  'campaign-archive.com', 'constantcontact.com', 'hubspot.com', 'salesforce.com',
]);

/**
 * Normalize one DMARC aggregate-report record into a flat row.
 * Accepts the caller-parsed shape used by common DMARC XML parsers.
 * The DMARC result is derived per RFC 7489: pass when SPF or DKIM passes
 * and aligns — a disposition of "none" is an enforcement policy, not a
 * failure signal.
 * @param {object} record
 * @returns {{sourceIp: string, count: number, envelopeFrom: string, headerFrom: string, spf: string, dkim: string, dmarc: string, disposition: string, reason: string}}
 */
export function normalizeDmarcRow(record = {}) {
  const policy = record?.row?.policy_evaluated || record?.policy_evaluated || {};
  const spf = String(record?.row?.policy_evaluated?.spf || policy?.spf || record?.spf || '').toLowerCase();
  const dkim = String(record?.row?.policy_evaluated?.dkim || policy?.dkim || record?.dkim || '').toLowerCase();
  const disposition = String(
    record?.row?.policy_evaluated?.disposition || policy?.disposition || record?.disposition || 'none'
  ).toLowerCase();
  return {
    sourceIp: String(record?.row?.source_ip || record?.source_ip || '').trim(),
    count: Number(record?.row?.count || record?.count || 0) || 0,
    envelopeFrom: String(record?.identifiers?.envelope_from || record?.envelope_from || '').trim().toLowerCase(),
    headerFrom: String(record?.identifiers?.header_from || record?.header_from || '').trim().toLowerCase(),
    spf,
    dkim,
    dmarc: spf === 'pass' || dkim === 'pass' ? 'pass' : 'fail',
    disposition,
    reason: String(
      (record?.row?.policy_evaluated?.reason || policy?.reason || []).map((r) => r?.comment || r?.type || r).filter(Boolean).join('; ') || ''
    ),
  };
}

/**
 * Aggregate DMARC rows by (sourceIp, envelopeFrom, headerFrom).
 * @param {object[]} records caller-parsed DMARC aggregate records
 * @returns {{sourceIp: string, envelopeFrom: string, headerFrom: string, total: number, spfPass: number, dkimPass: number, dmarcPass: number, dispositions: Record<string, number>}[]}
 */
export function aggregateBySender(records = []) {
  const byKey = new Map();
  for (const rec of records || []) {
    const row = normalizeDmarcRow(rec);
    if (!row.sourceIp && !row.envelopeFrom) continue;
    const key = `${row.sourceIp}|${row.envelopeFrom}|${row.headerFrom}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        sourceIp: row.sourceIp,
        envelopeFrom: row.envelopeFrom,
        headerFrom: row.headerFrom,
        total: 0,
        spfPass: 0,
        dkimPass: 0,
        dmarcPass: 0,
        dispositions: {},
      });
    }
    const agg = byKey.get(key);
    agg.total += row.count;
    if (row.spf === 'pass') agg.spfPass += row.count;
    if (row.dkim === 'pass') agg.dkimPass += row.count;
    if (row.dmarc === 'pass') agg.dmarcPass += row.count;
    const d = row.disposition || 'none';
    agg.dispositions[d] = (agg.dispositions[d] || 0) + row.count;
  }
  return [...byKey.values()].sort((a, b) => b.total - a.total);
}

/**
 * Check whether a header-from domain belongs to the target brand's domain tree.
 * @param {string} headerFrom
 * @param {string[]} brandDomains owned brand domains (apex + subdomains)
 * @returns {boolean}
 */
export function isBrandDomain(headerFrom, brandDomains = []) {
  const h = String(headerFrom || '').toLowerCase().trim();
  if (!h) return false;
  return (brandDomains || []).some((b) => {
    const base = String(b || '').toLowerCase().trim().replace(/^\*\./, '');
    return h === base || h.endsWith(`.${base}`);
  });
}

/**
 * Find senders using brand (sub)domains that are NOT authenticated — the
 * classic spoofing / unauthorized-sender signal.
 * @param {object[]} records caller-parsed DMARC aggregate records
 * @param {string[]} brandDomains owned brand domains
 * @param {object} [opts]
 * @param {number} [opts.minFailShare=0.5] minimum share of unauthenticated mail to flag
 * @param {number} [opts.minVolume=5] minimum message volume to flag
 * @returns {{sourceIp: string, envelopeFrom: string, headerFrom: string, total: number, failShare: number, dispositions: Record<string, number>, likelyKnownMailer: boolean, risk: 'high'|'medium'|'low'}[]}
 */
export function findUnauthorizedSenders(records = [], brandDomains = [], opts = {}) {
  const { minFailShare = 0.5, minVolume = 5 } = opts || {};
  const aggregated = aggregateBySender(records);
  const findings = [];

  for (const agg of aggregated) {
    if (!isBrandDomain(agg.headerFrom, brandDomains)) continue;
    if (agg.total < minVolume) continue;
    const failShare = agg.total === 0 ? 0 : 1 - agg.dmarcPass / agg.total;
    if (failShare < minFailShare) continue;
    const likelyKnownMailer = [...KNOWN_LEGIT_MAILERS].some(
      (m) => agg.envelopeFrom.endsWith(m) || agg.sourceIp === '' // no ASN check without network; conservative
    );
    const risk = failShare >= 0.95 && agg.total >= 50 ? 'high' : failShare >= 0.8 ? 'medium' : 'low';
    findings.push({
      sourceIp: agg.sourceIp,
      envelopeFrom: agg.envelopeFrom,
      headerFrom: agg.headerFrom,
      total: agg.total,
      failShare: Math.round(failShare * 1000) / 1000,
      dispositions: agg.dispositions,
      likelyKnownMailer,
      risk,
    });
  }
  return findings.sort((a, b) => b.total - a.total);
}

/**
 * Score the overall DMARC posture of the brand domains from aggregate data.
 * @param {object[]} records caller-parsed DMARC aggregate records
 * @param {string[]} brandDomains owned brand domains
 * @returns {{score: number, verdict: string, brandVolume: number, unauthVolume: number, coverage: Record<string, number>}}
 */
export function scoreDmarcPosture(records = [], brandDomains = []) {
  let brandVolume = 0;
  let unauthVolume = 0;
  const coverage = {};
  for (const rec of records || []) {
    const row = normalizeDmarcRow(rec);
    if (!isBrandDomain(row.headerFrom, brandDomains)) continue;
    brandVolume += row.count;
    if (row.dmarc !== 'pass') unauthVolume += row.count;
    coverage[row.headerFrom] = (coverage[row.headerFrom] || 0) + row.count;
  }
  const unauthShare = brandVolume === 0 ? 0 : unauthVolume / brandVolume;
  const score = Math.round(Math.max(0, Math.min(100, 100 - unauthShare * 100)));
  const verdict =
    brandVolume === 0
      ? 'no DMARC aggregate data for brand domains'
      : score >= 95
        ? 'strong — nearly all brand mail authenticates'
        : score >= 70
          ? 'moderate — material unauthenticated brand-domain volume'
          : 'weak — significant unauthenticated use of brand (sub)domains';
  return { score, verdict, brandVolume, unauthVolume, coverage };
}

/**
 * Full forensic summary combining posture + unauthorized-sender findings.
 * @param {object[]} records caller-parsed DMARC aggregate records
 * @param {string[]} brandDomains owned brand domains
 * @param {object} [opts]
 * @returns {{posture: ReturnType<typeof scoreDmarcPosture>, unauthorizedSenders: ReturnType<typeof findUnauthorizedSenders>, topSender: object|null}}
 */
export function summarizeDmarcForensics(records = [], brandDomains = [], opts = {}) {
  const posture = scoreDmarcPosture(records, brandDomains);
  const unauthorizedSenders = findUnauthorizedSenders(records, brandDomains, opts);
  return {
    posture,
    unauthorizedSenders,
    topSender: unauthorizedSenders[0] || null,
  };
}
