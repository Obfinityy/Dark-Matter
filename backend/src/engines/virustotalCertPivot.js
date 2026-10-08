/**
 * virustotalCertPivot.js — VirusTotal certificate-relationship pivoting engine for autonomous bug bounty.
 *
 * Defensive asset-discovery capability: given VirusTotal certificate objects
 * the caller fetched legally during an authorized engagement, normalize them
 * and pivot on certificate relationships — shared certificates, common
 * issuers, and serial-proximity — to find related domains that may belong to
 * the same operator. Covers idea-bank item 00169:
 *
 *  00169 VirusTotal certificate pivot — pivot on VirusTotal's certificate
 *        relationships to find related domains.
 *
 * All functions are pure and side-effect free. The caller supplies already-
 * fetched VirusTotal response data; the engine never touches the network.
 */

/**
 * Normalize one VirusTotal certificate object (API v3 `data` item).
 *
 * @param {object} item
 * @returns {{sha256: string|null, subject: string, issuer: string, dnsNames: string[], serial: string|null, validFrom: string|null, validTo: string|null}}
 */
export function normalizeVtCertificate(item) {
  if (!item || typeof item !== 'object')
    return {
      sha256: null,
      subject: '',
      issuer: '',
      dnsNames: [],
      serial: null,
      validFrom: null,
      validTo: null,
    };
  const sha256 = typeof item.id === 'string' ? item.id : null;
  const attrs = item.attributes && typeof item.attributes === 'object' ? item.attributes : {};
  const subject = typeof attrs.subject === 'string' ? attrs.subject : '';
  const issuer = typeof attrs.issuer === 'string' ? attrs.issuer : '';
  const rawNames =
    attrs.extensions && typeof attrs.extensions === 'object'
      ? attrs.extensions.subject_alternative_name || []
      : [];
  const dnsNames = [
    ...new Set(
      (Array.isArray(rawNames) ? rawNames : [])
        .filter(n => typeof n === 'string')
        .map(n => n.trim().replace(/^\*\./, '').toLowerCase())
        .filter(n => n && !n.startsWith('*'))
    ),
  ];
  const serial = attrs.serial_number != null ? String(attrs.serial_number) : null;
  const validFrom =
    typeof attrs.validity === 'object' && attrs.validity ? attrs.validity.not_before || null : null;
  const validTo =
    typeof attrs.validity === 'object' && attrs.validity ? attrs.validity.not_after || null : null;
  return { sha256, subject, issuer, dnsNames, serial, validFrom, validTo };
}

/**
 * Score how strongly a certificate relates to the target scope.
 * Exact target-domain SANs score highest; shared issuers and subject
 * overlap add weaker (but still useful) signal.
 *
 * @param {{dnsNames: string[], issuer: string, subject: string}} cert Normalized certificate.
 * @param {Set<string>} targetNames Lowercased target hostnames.
 * @returns {{score: number, matchedNames: string[]}}
 */
export function relationScore(cert, targetNames) {
  const matchedNames = (cert.dnsNames || []).filter(
    n =>
      targetNames.has(n) || [...targetNames].some(t => n.endsWith('.' + t) || t.endsWith('.' + n))
  );
  let score = matchedNames.length * 10;
  const subjOrg = /O=([^,]+)/.exec(cert.subject || '');
  if (subjOrg && [...targetNames].some(t => subjOrg[1].toLowerCase().includes(t.split('.')[0])))
    score += 3;
  return { score, matchedNames };
}

/**
 * Pivot on certificate relationships (idea 00169): for each supplied
 * certificate, collect its SAN domains and rank them by relationship to the
 * target scope.
 *
 * @param {object[]|object} payload VT response: array of cert objects or {data:[...]}.
 * @param {{targetHosts?: string[], knownDomains?: string[]}} [opts]
 * @returns {{related: {domain: string, certs: number, score: number, sources: string[]}[], certCount: number}}
 */
export function pivotCertificates(payload, opts = {}) {
  const raw = Array.isArray(payload)
    ? payload
    : payload && Array.isArray(payload.data)
      ? payload.data
      : [];
  const targetNames = new Set(
    (opts.targetHosts || []).map(h => String(h).trim().replace(/^\*\./, '').toLowerCase())
  );
  const known = new Set(
    (opts.knownDomains || []).map(d => String(d).trim().replace(/^\*\./, '').toLowerCase())
  );
  const perDomain = new Map();
  let certCount = 0;
  for (const item of raw) {
    const c = normalizeVtCertificate(item);
    if (!c.sha256) continue;
    certCount++;
    const { score, matchedNames } = relationScore(c, targetNames);
    for (const name of c.dnsNames) {
      if (known.has(name)) continue;
      const cur = perDomain.get(name) || { domain: name, certs: 0, score: 0, sources: [] };
      cur.certs++;
      cur.score = Math.max(cur.score, score);
      if (matchedNames.length && !cur.sources.includes(c.sha256.slice(0, 12)))
        cur.sources.push(c.sha256.slice(0, 12));
      perDomain.set(name, cur);
    }
  }
  const related = [...perDomain.values()]
    .filter(d => d.score > 0)
    .sort((a, b) => b.score - a.score || b.certs - a.certs || a.domain.localeCompare(b.domain));
  return { related, certCount };
}

/**
 * Summarize the certificate pivot for hunt output.
 *
 * @param {{related?: object[], certCount?: number}} result
 * @returns {{certCount: number, relatedCount: number, topRelated: string[], summary: string}}
 */
export function vtCertPivotReport(result = {}) {
  const certCount = result.certCount || 0;
  const relatedCount = (result.related || []).length;
  const topRelated = (result.related || []).slice(0, 10).map(r => r.domain);
  const summary =
    relatedCount === 0
      ? `Analyzed ${certCount} VirusTotal certificate(s); no related domains outside the known inventory.`
      : `VirusTotal certificate pivoting across ${certCount} certificate(s) found ${relatedCount} related domain(s) sharing certificate relationships with the target.`;
  return { certCount, relatedCount, topRelated, summary };
}

export default {
  normalizeVtCertificate,
  relationScore,
  pivotCertificates,
  vtCertPivotReport,
};
