/**
 * serviceDeskCnameAuditor.js — Service-desk SaaS CNAME audit engine.
 *
 * @idea 00286 — Service desk SaaS CNAME audit — audit all SaaS helpdesk
 *   CNAMEs for dangling targets after contract churn.
 *
 * When a support contract ends (Zendesk, Freshdesk, Intercom, Drift,
 * Help Scout, HubSpot, Kayako, Groove…), the DNS CNAME that pointed at the
 * vendor is often left behind. If the vendor later releases the account
 * slug, an attacker can re-claim it — a classic dangling-CNAME takeover
 * risk. This engine scores CNAME targets against known service-desk vendor
 * patterns and produces a prioritized audit report from evidence the
 * caller already collected (DNS records + optional HTTP-status probes).
 *
 * Pure functions only: no live DNS/HTTP here. Callers pass in records and
 * any status observations they already made. No takeover actions, no
 * proof-of-concept payloads — audit findings only.
 */

const SERVICE_DESK_VENDOR_PATTERNS = [
  { vendor: 'Zendesk', re: /\.zendesk\.com$/i, reclaimRisk: 'high', note: 'Zendesk account slug is re-claimable after release' },
  { vendor: 'Freshdesk', re: /\.freshdesk\.com$/i, reclaimRisk: 'high', note: 'Freshdesk portal slug is re-claimable after release' },
  { vendor: 'Intercom', re: /\.intercom\.io$/i, reclaimRisk: 'medium', note: 'Intercom custom domain must be re-verified by the new owner' },
  { vendor: 'Drift', re: /\.driftt\.com$/i, reclaimRisk: 'medium', note: 'Drift custom host mapping' },
  { vendor: 'Help Scout', re: /\.helpscout\.net$/i, reclaimRisk: 'high', note: 'Help Scout Beacon/docs subdomain re-claimable' },
  { vendor: 'HubSpot', re: /\.hubspot\.com$/i, reclaimRisk: 'medium', note: 'HubSpot-hosted support domain' },
  { vendor: 'Kayako', re: /\.kayako\.com$/i, reclaimRisk: 'high', note: 'Kayako instance subdomain' },
  { vendor: 'Groove', re: /\.groovehq\.com$/i, reclaimRisk: 'high', note: 'Groove knowledge-base subdomain' },
  { vendor: 'Front', re: /\.frontapp\.com$/i, reclaimRisk: 'medium', note: 'Front-hosted domain' },
  { vendor: 'Crisp', re: /\.crisp\.chat$/i, reclaimRisk: 'medium', note: 'Crisp chat widget domain' },
  { vendor: 'Tidio', re: /\.tidio\.chat$/i, reclaimRisk: 'medium', note: 'Tidio chat domain' },
  { vendor: 'LiveChat', re: /\.livechat\.com$/i, reclaimRisk: 'medium', note: 'LiveChat-hosted domain' },
  { vendor: 'UserVoice', re: /\.uservoice\.com$/i, reclaimRisk: 'high', note: 'UserVoice forum subdomain re-claimable' },
];

/**
 * Normalize a hostname: lowercase, strip scheme, port, trailing dot.
 * @param {string} host
 * @returns {string}
 */
export function normalizeHostname(host) {
  if (!host) return '';
  return String(host)
    .trim()
    .toLowerCase()
    .replace(/^\w+:\/\//, '')
    .replace(/:\d+$/, '')
    .replace(/\.$/, '');
}

/**
 * Classify a CNAME target against known service-desk SaaS vendors.
 * @param {string} target
 * @returns {{vendor: string, reclaimRisk: string, note: string, target: string}|null}
 */
export function classifyServiceDeskTarget(target) {
  const t = normalizeHostname(target);
  for (const { vendor, re, reclaimRisk, note } of SERVICE_DESK_VENDOR_PATTERNS) {
    if (re.test(t)) return { vendor, reclaimRisk, note, target: t };
  }
  return null;
}

/**
 * Extract the vendor account/instance slug from a service-desk target
 * hostname (e.g. 'acme.zendesk.com' -> 'acme').
 * @param {string} target
 * @returns {string}
 */
export function extractVendorSlug(target) {
  const t = normalizeHostname(target);
  const m = t.match(/^([a-z0-9][a-z0-9-]*)\.[a-z0-9.-]+$/i);
  return m ? m[1] : '';
}

/**
 * Audit CNAME records for dangling service-desk SaaS targets.
 *
 * Dangling likelihood is scored from caller-supplied evidence:
 *  - httpStatus: an HTTP status observed on the source hostname (callers
 *    probe this themselves). 404 / vendor "not found" pages strongly
 *    suggest the vendor-side account is gone.
 *  - accountStatus: caller-supplied vendor account state ('active' |
 *    'cancelled' | 'unknown').
 *
 * @param {{query: string, type: string, value: string}[]} records DNS records
 *   already fetched by the caller (CNAME)
 * @param {{query: string, httpStatus?: number, vendorPageText?: string, accountStatus?: string}[]} evidence
 *   optional per-host observations; vendorPageText is scanned for
 *   "not found / unclaimed" phrasing (descriptive text only — no payloads)
 * @returns {{query: string, target: string, vendor: string, vendorSlug: string, reclaimRisk: string, danglingScore: number, verdict: string, reasons: string[]}[]}
 *   sorted by danglingScore descending
 */
export function auditServiceDeskCnames(records, evidence = []) {
  const evidenceByQuery = new Map(
    (evidence || []).map((e) => [normalizeHostname(e.query), e])
  );
  const results = [];

  for (const r of records || []) {
    if (!r || !r.value) continue;
    if (String(r.type || '').toUpperCase() !== 'CNAME') continue;
    const classified = classifyServiceDeskTarget(r.value);
    if (!classified) continue;

    const query = normalizeHostname(r.query);
    const ev = evidenceByQuery.get(query) || {};
    const reasons = [];
    let score = 0;

    const status = ev.httpStatus;
    if (typeof status === 'number') {
      if (status === 404) {
        score += 40;
        reasons.push('HTTP 404 observed on the branded hostname (vendor account likely gone)');
      } else if (status >= 500) {
        score += 10;
        reasons.push(`HTTP ${status} observed — inconclusive, monitor`);
      } else if (status >= 200 && status < 300) {
        score -= 20;
        reasons.push(`HTTP ${status} — hostname currently resolves to live vendor content`);
      }
    }

    const pageText = String(ev.vendorPageText || '');
    if (/(?:not found|no such|unclaimed|does not exist|deleted|deactivated|account (?:not|never) found)/i.test(pageText)) {
      score += 30;
      reasons.push('vendor "not found / unclaimed" phrasing in served page');
    }

    if (ev.accountStatus === 'cancelled') {
      score += 30;
      reasons.push('vendor contract/account recorded as cancelled');
    } else if (ev.accountStatus === 'active') {
      score = Math.max(0, score - 30);
      reasons.push('vendor account recorded as active');
    }

    score = Math.max(0, Math.min(100, score));
    const verdict =
      score >= 70 ? 'dangling-likely' :
      score >= 40 ? 'suspicious' :
      score >= 20 ? 'watch' : 'healthy';

    results.push({
      query,
      target: classified.target,
      vendor: classified.vendor,
      vendorSlug: extractVendorSlug(classified.target),
      reclaimRisk: classified.reclaimRisk,
      danglingScore: score,
      verdict,
      reasons: reasons.length ? reasons : ['CNAME points at service-desk SaaS; no contrary evidence'],
    });
  }

  return results.sort((a, b) => b.danglingScore - a.danglingScore);
}

/**
 * Build a short human-readable audit summary grouped by verdict.
 * @param {ReturnType<typeof auditServiceDeskCnames>} findings
 * @returns {{total: number, byVerdict: Record<string, number>, topRisks: {query: string, vendor: string, verdict: string, danglingScore: number}[]}}
 */
export function summarizeAudit(findings) {
  const byVerdict = {};
  for (const f of findings || []) {
    byVerdict[f.verdict] = (byVerdict[f.verdict] || 0) + 1;
  }
  return {
    total: (findings || []).length,
    byVerdict,
    topRisks: (findings || []).slice(0, 10).map((f) => ({
      query: f.query,
      vendor: f.vendor,
      verdict: f.verdict,
      danglingScore: f.danglingScore,
    })),
  };
}
