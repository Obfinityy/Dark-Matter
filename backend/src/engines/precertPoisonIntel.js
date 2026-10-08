/**
 * precertPoisonIntel.js — CT precertificate poison-extension analysis (idea 00145).
 *
 * Certificate Transparency logs carry precertificates that contain the
 * critical poison extension (OID 1.3.6.1.4.1.11129.2.4.3). A precert and its
 * final certificate share the same TBSCertificate except for that poison
 * extension, so they can be linked — and the SCT timestamps on each reveal
 * issuance timing. This module detects poisoned precerts and links them to
 * final certificates from supplied certificate metadata.
 */

const POISON_OID = '1.3.6.1.4.1.11129.2.4.3';

/**
 * Check whether a certificate carries the CT poison extension.
 * @param {{ extensions?: { oid, critical, value? }[] }} cert — parsed cert metadata
 * @returns {boolean}
 */
export function isPoisonedPrecert(cert = {}) {
  const exts = cert.extensions || [];
  return exts.some(e => e.oid === POISON_OID);
}

/**
 * Link precertificates to their final certificates: a precert and its final
 * cert share issuer, subject, SANs and public key, differing only by the
 * poison extension.
 * @param {Array} certs — parsed certificate metadata objects
 * @returns {{ precert, finalCert, timingGapMs }[]}
 */
export function linkPrecertsToFinal(certs = []) {
  const fingerprint = c => {
    const sans = [...(c.san || [])].sort().join(',');
    return [c.issuer, c.subject, sans, c.publicKeySha256].join('|');
  };
  const precerts = certs.filter(isPoisonedPrecert);
  const finals = certs.filter(c => !isPoisonedPrecert(c));
  const byFp = new Map();
  for (const f of finals) {
    const fp = fingerprint(f);
    if (!byFp.has(fp)) byFp.set(fp, []);
    byFp.get(fp).push(f);
  }
  const links = [];
  for (const p of precerts) {
    const candidates = byFp.get(fingerprint(p)) || [];
    for (const f of candidates) {
      const pTime = p.notBefore ? new Date(p.notBefore).getTime() : NaN;
      const fTime = f.notBefore ? new Date(f.notBefore).getTime() : NaN;
      links.push({
        precert: p.serial || null,
        finalCert: f.serial || null,
        timingGapMs: Number.isFinite(pTime) && Number.isFinite(fTime) ? fTime - pTime : null,
      });
    }
  }
  return links;
}

/**
 * Extract issuance timing from SCT data embedded in certs.
 * @param {{ serial, scts?: { logId, timestamp }[] }[]} certs
 * @returns {{ serial, earliestSct, sctCount, logs: string[] }[]}
 */
export function issuanceTiming(certs = []) {
  return certs.map(c => {
    const scts = c.scts || [];
    const times = scts
      .map(s => new Date(s.timestamp).getTime())
      .filter(Number.isFinite)
      .sort((a, b) => a - b);
    return {
      serial: c.serial || null,
      earliestSct: times.length ? new Date(times[0]).toISOString() : null,
      sctCount: scts.length,
      logs: [...new Set(scts.map(s => s.logId))],
    };
  });
}
