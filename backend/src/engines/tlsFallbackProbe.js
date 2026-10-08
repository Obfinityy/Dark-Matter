/**
 * tlsFallbackProbe.js — TLS fallback-version and weak-cipher probing analysis.
 *
 * Takes already-collected per-version/per-cipher handshake probe results and
 * determines whether the endpoint still negotiates deprecated TLS versions
 * or weak cipher suites — fingerprinting legacy terminators (old load
 * balancers, legacy reverse proxies) and flagging downgrade risk.
 * Pure analysis: takes collected probe data as input, no network I/O.
 */

/** Cipher suites considered weak or broken, with reasons. */
export const WEAK_CIPHERS = [
  { match: /^TLS_RSA_WITH_(RC4|DES|3DES)/i, reason: 'RC4/DES/3DES — broken stream/block ciphers' },
  { match: /^TLS_RSA_WITH_NULL/i, reason: 'NULL cipher — no encryption' },
  { match: /_WITH_RC4_/i, reason: 'RC4 — broken stream cipher (RFC 7465)' },
  { match: /_WITH_DES40_/i, reason: '40-bit export DES — trivially breakable' },
  { match: /_WITH_DES_CBC_SHA$/i, reason: 'single DES — 56-bit, brute-forceable' },
  { match: /_WITH_3DES_EDE_CBC_SHA$/i, reason: '3DES — Sweet32 birthday attacks (64-bit block)' },
  { match: /_WITH_NULL_/i, reason: 'NULL cipher — no encryption' },
  { match: /_EXPORT_/i, reason: 'export-grade cipher — deliberately weakened' },
  { match: /anon_/i, reason: 'anonymous DH/ECDH — no authentication (MITM)' },
  { match: /^0x000[0-9A-F]/i, reason: 'legacy SSLv2/SSLv3-era cipher id' },
];

/** Deprecated protocol versions with severity. */
const DEPRECATED_VERSIONS = {
  SSLv2: { severity: 'Critical', note: 'SSLv2 — catastrophically broken (DROWN)' },
  SSLv3: { severity: 'Critical', note: 'SSLv3 — POODLE, must be disabled' },
  'TLS1.0': { severity: 'High', note: 'TLS 1.0 — BEAST, deprecated by RFC 8996' },
  'TLS1.1': { severity: 'High', note: 'TLS 1.1 — deprecated by RFC 8996' },
};

/**
 * Normalize Version.
 * @param {*} v
 * @returns {*} Result.
 */
export function normalizeVersion(v) {
  const s = String(v || '')
    .replace(/[^0-9a-zA-Z.]/g, '')
    .toLowerCase();
  if (/^sslv?2/.test(s) || s === 'ssl2') return 'SSLv2';
  if (/^sslv?3/.test(s) || s === 'ssl3') return 'SSLv3';
  if (/^tlsv?1\.?0?$/.test(s) || s === 'tls10') return 'TLS1.0';
  if (/^tlsv?1\.?1$/.test(s) || s === 'tls11') return 'TLS1.1';
  if (/^tlsv?1\.?2$/.test(s) || s === 'tls12') return 'TLS1.2';
  if (/^tlsv?1\.?3$/.test(s) || s === 'tls13') return 'TLS1.3';
  return String(v);
}

/**
 * Analyze one accepted cipher suite for weakness.
 * @returns {{cipher: string, weak: boolean, reason: string|null}}
 */
export function analyzeCipher(cipher) {
  const c = String(cipher || '');
  for (const w of WEAK_CIPHERS) {
    if (w.match.test(c)) return { cipher: c, weak: true, reason: w.reason };
  }
  return { cipher: c, weak: false, reason: null };
}

/**
 * Analyze fallback-version and cipher probe results for one endpoint.
 *
 * @param {Object} args
 * @param {Array<Object>} args.probes - One entry per probed version:
 *   { version, handshakeOk, acceptedCiphers: [names], selectedCipher }
 * @returns {{findings: Array, legacyScore: number, terminatorProfile: Object, summary: Object}}
 */
export function probeFallback({ probes = [] } = {}) {
  const findings = [];
  const acceptedVersions = [];
  const weakCiphers = [];

  for (const p of probes) {
    const version = normalizeVersion(p.version);
    if (!p.handshakeOk) continue;
    acceptedVersions.push(version);

    const dep = DEPRECATED_VERSIONS[version];
    if (dep) {
      findings.push({
        type: 'deprecated-version',
        severity: dep.severity,
        confidence: 'high',
        evidence: `${version} handshake accepted — ${dep.note}.`,
      });
    }

    for (const cipher of p.acceptedCiphers || []) {
      const a = analyzeCipher(cipher);
      if (a.weak && !weakCiphers.some(w => w.cipher === a.cipher)) {
        weakCiphers.push({ ...a, acceptedOn: version });
        findings.push({
          type: 'weak-cipher',
          severity: /NULL|anon_|RC4/i.test(a.cipher) ? 'Critical' : 'High',
          confidence: 'high',
          evidence: `${a.cipher} accepted on ${version} — ${a.reason}.`,
        });
      }
    }
  }

  // Legacy score: 0 (modern only) → 100 (SSLv2 + NULL ciphers).
  let legacyScore = 0;
  if (acceptedVersions.includes('SSLv2')) legacyScore += 40;
  if (acceptedVersions.includes('SSLv3')) legacyScore += 30;
  if (acceptedVersions.includes('TLS1.0')) legacyScore += 15;
  if (acceptedVersions.includes('TLS1.1')) legacyScore += 10;
  legacyScore += Math.min(weakCiphers.length * 5, 30);
  legacyScore = Math.min(legacyScore, 100);

  // Terminator fingerprint from the accepted-profile shape.
  const order = ['SSLv2', 'SSLv3', 'TLS1.0', 'TLS1.1', 'TLS1.2', 'TLS1.3'];
  const sorted = acceptedVersions
    .filter(v => order.includes(v))
    .sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const terminatorProfile = {
    acceptedVersions: sorted,
    minVersion: sorted[0] || null,
    maxVersion: sorted[sorted.length - 1] || null,
    weakCipherCount: weakCiphers.length,
    archetype:
      legacyScore >= 40
        ? 'legacy-terminator'
        : legacyScore >= 15
          ? 'partially-hardened'
          : acceptedVersions.length > 0
            ? 'modern'
            : 'unknown',
  };

  const severityRank = { Critical: 3, High: 2, Medium: 1, Low: 0 };
  findings.sort((a, b) => severityRank[b.severity] - severityRank[a.severity]);

  return {
    findings,
    legacyScore,
    terminatorProfile,
    summary: {
      versionsAccepted: acceptedVersions.length,
      deprecatedAccepted: findings.filter(f => f.type === 'deprecated-version').length,
      weakCiphersAccepted: weakCiphers.length,
      legacyScore,
      hardened: legacyScore === 0 && acceptedVersions.length > 0,
    },
  };
}

export const TLS_FALLBACK_PROBE = { probeFallback, analyzeCipher, normalizeVersion, WEAK_CIPHERS };
export default TLS_FALLBACK_PROBE;
