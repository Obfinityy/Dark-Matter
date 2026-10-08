/**
 * certChainAnalyzer.js — certificate-chain depth and issuing-pipeline analysis.
 *
 * Takes an already-collected certificate chain (leaf → root) and analyzes
 * chain length, intermediate selection, cross-signing, signature algorithms
 * and validity overlaps to fingerprint the issuing pipeline (e.g. ACME CA
 * hierarchies vs enterprise/private PKI) and flag anomalies such as
 * unusually deep chains or expiring intermediates.
 * Pure analysis: takes collected chain data as input, no network I/O.
 */

const DAY_MS = 86400000;

/**
 * Known issuing-pipeline fingerprints keyed on issuer/subject patterns.
 * Patterns are matched case-insensitively against issuer common names.
 */
export const PIPELINE_PATTERNS = [
  {
    match: /let'?s encrypt/i,
    intermediates: [/R10|R11|E5|E6/i],
    pipeline: "Let's Encrypt ACME",
    automation: 'automated',
  },
  { match: /zerossl/i, pipeline: 'ZeroSSL ACME', automation: 'automated' },
  { match: /buypass/i, pipeline: 'Buypass ACME', automation: 'automated' },
  {
    match: /google trust services/i,
    pipeline: 'Google Trust Services (GTS)',
    automation: 'automated',
  },
  { match: /amazon/i, pipeline: 'Amazon (ACM/Private CA)', automation: 'automated' },
  { match: /digicert/i, pipeline: 'DigiCert', automation: 'managed' },
  { match: /sectigo|comodo/i, pipeline: 'Sectigo (Comodo)', automation: 'managed' },
  { match: /globalsign/i, pipeline: 'GlobalSign', automation: 'managed' },
  { match: /entrust/i, pipeline: 'Entrust', automation: 'managed' },
  { match: /cloudflare/i, pipeline: 'Cloudflare (managed edge)', automation: 'automated' },
];

/** Analyze a single chain certificate. */
function analyzeCert(cert, depth, now) {
  const nb = new Date(cert.notBefore).getTime();
  const na = new Date(cert.notAfter).getTime();
  const daysLeft = Number.isFinite(na) ? Math.floor((na - now) / DAY_MS) : null;
  const sigAlg = String(cert.signatureAlgorithm || '');
  const weakSig = /md5|sha1/i.test(sigAlg) && !/sha256|sha384|sha512/i.test(sigAlg);
  return {
    depth,
    subject: cert.subject || '',
    issuer: cert.issuer || '',
    commonName: cert.commonName || '',
    signatureAlgorithm: sigAlg,
    weakSignature: weakSig,
    keyBits: cert.keyBits ?? null,
    daysUntilExpiry: daysLeft,
    expired: daysLeft !== null && daysLeft < 0,
    expiringSoon: daysLeft !== null && daysLeft >= 0 && daysLeft < 30,
  };
}

/**
 * Analyze a certificate chain.
 *
 * @param {Object} args
 * @param {Array<Object>} args.chain - Certificates from leaf (index 0) to root.
 *   Each: { subject, issuer, commonName, signatureAlgorithm, keyBits, notBefore, notAfter, serialNumber }
 * @returns {{certs: Array, depth: Object, pipeline: Object, anomalies: Array, summary: Object}}
 */
export function analyzeChain({ chain = [] } = {}) {
  const now = Date.now();
  const certs = chain.map((c, i) => analyzeCert(c, i, now));
  const depth = certs.length;

  // Issuer continuity: each cert's issuer should match the next cert's subject.
  const breaks = [];
  for (let i = 0; i < certs.length - 1; i++) {
    const issuer = String(chain[i].issuer || '').toLowerCase();
    const nextSubject = String(chain[i + 1].subject || '').toLowerCase();
    if (
      issuer &&
      nextSubject &&
      !issuer.includes(nextSubject.split(',')[0].split('=')[1] || '∅') &&
      issuer !== nextSubject
    ) {
      // Only flag when clearly mismatched (avoid false positives on DN formatting).
      if (
        !nextSubject.includes(issuer.slice(0, 12)) &&
        !issuer.includes(nextSubject.slice(0, 12))
      ) {
        breaks.push({ atDepth: i, issuer: chain[i].issuer, nextSubject: chain[i + 1].subject });
      }
    }
  }

  // Pipeline fingerprinting from the leaf issuer and intermediate CNs.
  const leafIssuer = String(chain[0]?.issuer || '');
  const intermediateCNs = chain.slice(1, -1).map(c => String(c.commonName || c.subject || ''));
  let pipeline = { pipeline: 'unknown', automation: 'unknown', confidence: 'low', evidence: [] };
  for (const p of PIPELINE_PATTERNS) {
    if (p.match.test(leafIssuer) || intermediateCNs.some(cn => p.match.test(cn))) {
      const interOk =
        !p.intermediates || intermediateCNs.some(cn => p.intermediates.some(re => re.test(cn)));
      pipeline = {
        pipeline: p.pipeline,
        automation: p.automation,
        confidence: interOk ? 'high' : 'medium',
        evidence: [
          `issuer "${leafIssuer}"`,
          ...(intermediateCNs.length ? [`intermediates: ${intermediateCNs.join(', ')}`] : []),
        ],
      };
      break;
    }
  }

  // Cross-sign detection: same subject appearing at multiple depths with different issuers.
  const seen = new Map();
  const crossSigned = [];
  for (const c of certs) {
    const key = String(c.subject).toLowerCase();
    if (seen.has(key) && seen.get(key) !== String(c.issuer).toLowerCase()) crossSigned.push(c);
    else seen.set(key, String(c.issuer).toLowerCase());
  }

  const anomalies = [];
  if (depth > 5) {
    anomalies.push({
      type: 'deep-chain',
      confidence: 'medium',
      evidence: `Chain depth ${depth} — unusually long; may indicate legacy cross-signs or misconfigured intermediates.`,
    });
  }
  if (depth <= 1) {
    anomalies.push({
      type: 'no-chain',
      confidence: 'high',
      evidence:
        'Only the leaf certificate was served — clients must fetch intermediates themselves; some stacks will fail validation.',
    });
  }
  for (const c of certs) {
    if (c.weakSignature)
      anomalies.push({
        type: 'weak-signature',
        confidence: 'high',
        evidence: `Depth ${c.depth} (${c.commonName || c.subject}): ${c.signatureAlgorithm} — deprecated signature algorithm.`,
      });
    if (c.expired)
      anomalies.push({
        type: 'expired-cert',
        confidence: 'high',
        evidence: `Depth ${c.depth} (${c.commonName || c.subject}) is EXPIRED — chain will not validate.`,
      });
    else if (c.expiringSoon)
      anomalies.push({
        type: 'expiring-soon',
        confidence: 'medium',
        evidence: `Depth ${c.depth} (${c.commonName || c.subject}) expires in ${c.daysUntilExpiry} days.`,
      });
  }
  if (crossSigned.length) {
    anomalies.push({
      type: 'cross-signed',
      confidence: 'medium',
      evidence: `${crossSigned.length} certificate(s) appear cross-signed — typical of CA hierarchy transitions.`,
    });
  }
  for (const b of breaks) {
    anomalies.push({
      type: 'issuer-break',
      confidence: 'low',
      evidence: `Issuer/subject continuity break at depth ${b.atDepth} — verify chain ordering.`,
    });
  }

  const selfSignedRoot =
    certs.length > 0 &&
    String(certs[certs.length - 1].subject).toLowerCase() ===
      String(certs[certs.length - 1].issuer).toLowerCase();

  return {
    certs,
    depth: {
      total: depth,
      intermediates: Math.max(depth - 2, 0),
      includesRoot: selfSignedRoot,
    },
    pipeline,
    crossSigned: crossSigned.map(c => ({ depth: c.depth, subject: c.subject, issuer: c.issuer })),
    anomalies: anomalies.sort((a, b) => (b.confidence === 'high') - (a.confidence === 'high')),
    summary: {
      chainLength: depth,
      pipeline: pipeline.pipeline,
      automation: pipeline.automation,
      anomalyCount: anomalies.length,
      healthy: anomalies.filter(a => a.confidence === 'high').length === 0,
    },
  };
}

export const CERT_CHAIN_ANALYZER = { analyzeChain, PIPELINE_PATTERNS };
export default CERT_CHAIN_ANALYZER;
