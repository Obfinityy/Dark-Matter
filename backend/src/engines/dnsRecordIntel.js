/**
 * dnsRecordIntel.js — DNS record policy analyzers (idea 00021).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent.
 * Compares CAA `issue` and `issuewild` policies to find wildcard issuance
 * gaps that hint at unmanaged wildcard infrastructure.
 */

/**
 * Parse raw CAA record strings (as returned by DNS) into structured entries.
 * Accepts "0 issue \"ca.example.net\"" style text or objects
 * { flags, tag, value }.
 * @param {Array<string|Object>} records
 */
export function parseCaaRecords(records) {
  const parsed = [];
  for (const r of records || []) {
    if (r && typeof r === 'object' && r.tag) {
      parsed.push({ flags: Number(r.flags ?? 0), tag: String(r.tag).toLowerCase(), value: String(r.value ?? '') });
      continue;
    }
    const m = String(r || '').match(/^\s*(\d+)\s+(issue|issuewild|iodef)\s+"?([^"]*)"?\s*$/i);
    if (m) parsed.push({ flags: Number(m[1]), tag: m[2].toLowerCase(), value: m[3].trim() });
  }
  return parsed;
}

/**
 * Idea 00021 — CAA issuewild gap analysis.
 *
 * Compares the CAA `issue` policy (which CAs may issue for exact names) with
 * the `issuewild` policy (which may issue wildcards) and reports gaps:
 *
 *  - `issue` set but NO `issuewild` record → wildcards are FORBIDDEN by CAA;
 *    any wildcard cert seen in the wild is then an issuance-policy anomaly.
 *  - `issuewild` present but `issue` missing → CAs may issue wildcards while
 *    exact-name issuance is unrestricted (loose policy).
 *  - `issuewild` names a CA that `issue` does NOT → that CA can mint
 *    wildcards but not regular certs: classic unmanaged-wildcard signal.
 *  - `issuewild` contains ';' (forbid) while `issue` allows issuance →
 *    intended lock-down; wildcard certs in CT logs are suspicious.
 *
 * @param {Array<string|Object>} caaRecords - CAA records for the domain.
 * @returns {{ issue: string[], issuewild: string[], gaps: Array<{type, severity, detail, recommendation}>, policyLockedDown: boolean }}
 */
export function analyzeCaaGap(caaRecords) {
  const entries = parseCaaRecords(caaRecords);
  const issue = entries.filter(e => e.tag === 'issue').map(e => e.value);
  const issuewild = entries.filter(e => e.tag === 'issuewild').map(e => e.value);
  const gaps = [];

  const caName = v => String(v).split(';')[0].trim().toLowerCase();
  const issueCAs = new Set(issue.filter(v => v !== ';').map(caName));
  const issuewildCAs = new Set(issuewild.filter(v => v !== ';').map(caName));
  const issueForbids = issue.includes(';');
  const wildForbids = issuewild.includes(';');

  if (issue.length > 0 && issuewild.length === 0) {
    gaps.push({
      type: 'wildcards-forbidden-by-cAA',
      severity: 'info',
      detail: '`issue` policy exists but no `issuewild` record — CAA forbids wildcard issuance. Any wildcard certificate for this domain in CT logs violates the stated policy.',
      recommendation: 'Monitor CT logs for wildcard certs; a hit here is a policy-violation signal worth investigating.',
    });
  }

  if (issuewild.length > 0 && issue.length === 0) {
    gaps.push({
      type: 'issue-unrestricted-wildcards-allowed',
      severity: 'medium',
      detail: '`issuewild` allows wildcard issuance while exact-name issuance is unrestricted. Policy is loose in both directions.',
      recommendation: 'Recommend tightening: add explicit `issue` allow-list and restrict `issuewild` to a single managed CA.',
    });
  }

  for (const ca of issuewildCAs) {
    if (ca && !issueCAs.has(ca) && !issueForbids) {
      gaps.push({
        type: 'wildcard-only-ca',
        severity: 'high',
        detail: `CA '${ca}' may issue WILDCARDS (issuewild) but is not allowed to issue regular certificates (issue). A wildcard-only issuance path often means unmanaged wildcard infrastructure.`,
        recommendation: `Verify whether '${ca}' wildcard certs are tracked/managed; revoke or restrict if the CA is unexpected.`,
      });
    }
  }

  if (issuewild.length > 0 && !wildForbids && (issueForbids || issue.length === 0)) {
    // e.g. issue ';' (no issuance) but issuewild allows some CA — wildcards possible while regular certs are locked.
    if (issueForbids) {
      gaps.push({
        type: 'wildcard-bypass-of-issue-lockdown',
        severity: 'high',
        detail: '`issue` forbids all issuance (;) yet `issuewild` permits wildcard issuance. This gap lets a CA mint wildcard certs under an otherwise locked-down policy.',
        recommendation: 'Add `issuewild ";"` to close the gap unless wildcards are explicitly intended.',
      });
    }
  }

  if (wildForbids && issue.length > 0 && !issueForbids) {
    gaps.push({
      type: 'wildcards-intentionally-blocked',
      severity: 'info',
      detail: '`issuewild ";"` intentionally blocks wildcard issuance while regular issuance is allowed. This is the hardened configuration.',
      recommendation: 'None — treat wildcard certs appearing in CT logs as anomalous.',
    });
  }

  return {
    issue: issueCAs.size ? [...issueCAs] : (issueForbids ? ['; (forbidden)'] : []),
    issuewild: issuewildCAs.size ? [...issuewildCAs] : (wildForbids ? ['; (forbidden)'] : []),
    gaps,
    policyLockedDown: wildForbids,
  };
}
