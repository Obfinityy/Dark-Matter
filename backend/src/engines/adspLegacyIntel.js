/**
 * adspLegacyIntel.js — ADSP legacy record check (idea 00083).
 *
 * Defensive legacy mail-policy discovery for an authorized bug-bounty
 * agent. ADSP (Author Domain Signing Practices, RFC 5617) was the
 * predecessor of DMARC: a TXT record at `_adsp._domainkey.<domain>` with
 * `dkim=unknown|all|discardable`. It is obsolete, but lingering ADSP
 * records reference old mail infrastructure and, when present, can
 * confuse legacy validators. Finding them maps forgotten mail policy and
 * the systems that once enforced it.
 *
 * Passive TXT lookups only. Use against operator-authorized targets only.
 */

import dns from 'node:dns';

const resolver = new dns.promises.Resolver();

/**
 * Parse an ADSP TXT record into its policy tag/value pairs (RFC 5617 §4.2).
 *
 * @param {string} txt e.g. "dkim=discardable"
 * @returns {{tags:Record<string,string>, policy:string|null, valid:boolean}}
 */
export function parseAdspRecord(txt) {
  const tags = {};
  const cleaned = String(txt || '').replace(/\s+/g, '');
  for (const part of cleaned.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) tags[part.slice(0, idx).toLowerCase()] = part.slice(idx + 1);
  }
  const policy = tags.dkim ? tags.dkim.toLowerCase() : null;
  const valid = policy === 'unknown' || policy === 'all' || policy === 'discardable';
  return { tags, policy, valid };
}

/**
 * Analyze a domain's ADSP record set and return defensive findings.
 *
 * @param {string} domain
 * @param {string[]} txtRecords TXT record strings at _adsp._domainkey.domain
 * @returns {{domain:string, present:boolean, policy:string|null, findings:Array<{severity:string,type:string,detail:string,recommendation:string}>}}
 */
export function analyzeAdspRecords(domain, txtRecords) {
  const d = String(domain || '')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '');
  const findings = [];
  const records = (txtRecords || []).map(parseAdspRecord);
  if (records.length === 0 || !records.some(r => r.policy)) {
    return { domain: d, present: false, policy: null, findings };
  }
  const policy = records.find(r => r.policy).policy;
  findings.push({
    severity: 'info',
    type: 'adsp-legacy-record-present',
    detail: `Obsolete ADSP record still published for ${d} (dkim=${policy}). ADSP was superseded by DMARC (RFC 7489); the record is legacy baggage.`,
    recommendation:
      'Check the domain has a real DMARC record and remove the ADSP TXT once DMARC (p=reject, aligned) is confirmed — stale policy records confuse validators.',
  });
  if (policy === 'unknown') {
    findings.push({
      severity: 'low',
      type: 'adsp-policy-unknown',
      detail:
        'ADSP policy is "unknown" — the author domain claims no signing practice. Any DKIM-signed mail seen from this domain is then suspicious.',
      recommendation:
        'Pivot: DKIM-signed mail from an "unknown" domain is a spoofing/backscatter hunting signal.',
    });
  }
  if (records.some(r => !r.valid && Object.keys(r.tags).length > 0)) {
    findings.push({
      severity: 'low',
      type: 'adsp-malformed-record',
      detail:
        'An ADSP-shaped record exists but carries an unrecognized policy value — legacy validators may treat it inconsistently.',
      recommendation: 'Normalize or remove the malformed record during the ADSP cleanup.',
    });
  }
  return { domain: d, present: true, policy, findings };
}

/**
 * Idea 00083 — query the legacy ADSP record for a domain.
 *
 * @param {string} domain e.g. "example.com"
 * @returns {Promise<{domain:string, present:boolean, policy:string|null, findings:Array}>}
 */
export async function checkAdspLegacy(domain) {
  const d = String(domain || '')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '');
  let txt = [];
  try {
    const raw = await resolver.resolveTxt(`_adsp._domainkey.${d}`);
    txt = raw.map(chunks => chunks.join(''));
  } catch (err) {
    if (err && err.code !== 'ENODATA' && err.code !== 'ENOTFOUND' && err.code !== 'SERVFAIL')
      throw err;
  }
  return analyzeAdspRecords(d, txt);
}
