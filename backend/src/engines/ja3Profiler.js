/**
 * ja3Profiler.js — JA3 TLS client-hello cataloging.
 *
 * Different TLS client stacks (browsers, curl, Go, Python, scanners)
 * produce different JA3 fingerprints. A server/TLS terminator reveals its
 * identity in *which cipher suite it selects* for each JA3 variant: Go's
 * crypto/tls, BoringSSL, OpenSSL, and NSS all order their cipher
 * preferences differently. This module catalogs, per JA3 variant, the
 * server-selected cipher suite and TLS version, then derives a terminator
 * fingerprint from the preference pattern.
 *
 * Pure analysis: the caller supplies observed handshake records
 * (client JA3 + server-selected parameters). No network activity.
 *
 * Defensive use: authorized TLS-terminator fingerprinting during
 * bug-bounty recon (telling apart edge TLS stacks behind one hostname).
 */

// Cipher-suite preference order markers per TLS library family.
const CIPHER_FAMILIES = {
  TLS_AES_128_GCM_SHA256: 'tls13',
  TLS_AES_256_GCM_SHA384: 'tls13',
  TLS_CHACHA20_POLY1305_SHA256: 'tls13',
  TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256: 'openssl-like',
  TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384: 'openssl-like',
  TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256: 'openssl-like',
  TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256: 'boringssl-like',
  TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256: 'boringssl-like',
};

const KNOWN_TERMINATORS = [
  {
    terminator: 'Go crypto/tls (Caddy/Traefik)',
    markers: ['prefers ChaCha20 over AES-GCM when client offers both', 'strict TLS 1.2+ only'],
  },
  {
    terminator: 'BoringSSL (Envoy)',
    markers: ['AES-GCM preferred for AES hardware clients', 'ChaCha20 preferred otherwise'],
  },
  {
    terminator: 'OpenSSL (nginx/HAProxy)',
    markers: ['follows server cipher order strictly', 'ECDHE-RSA AES-GCM first by default'],
  },
  {
    terminator: 'NSS (Apache mod_ssl)',
    markers: ['client cipher order often honored', 'TLS 1.3 middlebox mode artifacts'],
  },
];

/**
 * Record one observed handshake: client JA3 variant + server choice.
 *
 * @param {{ ja3?: string, ja3Hash?: string, clientLabel?: string, negotiatedCipher?: string, tlsVersion?: string }} rec
 * @returns {{ ja3Hash: string, clientLabel: string, negotiatedCipher: string, tlsVersion: string, cipherFamily: string }}
 */
export function catalogHandshake({
  ja3 = '',
  ja3Hash = '',
  clientLabel = '',
  negotiatedCipher = '',
  tlsVersion = '',
} = {}) {
  const cipher = String(negotiatedCipher || '');
  return {
    ja3Hash: String(ja3Hash || ja3 || ''),
    clientLabel: String(clientLabel || 'unknown-client'),
    negotiatedCipher: cipher,
    tlsVersion: String(tlsVersion || ''),
    cipherFamily: CIPHER_FAMILIES[cipher] || 'unclassified',
  };
}

/**
 * Analyze cipher-preference consistency across JA3 variants.
 *
 * A terminator with a fixed internal preference picks the same cipher
 * family regardless of client order (server-preference); one honoring
 * client order varies with the JA3 variant (client-preference).
 *
 * @param {ReturnType<typeof catalogHandshake>[]} catalog
 * @returns {{ mode: 'server-preference'|'client-preference'|'mixed'|'insufficient', cipherDiversity: number, detail: string }}
 */
export function analyzeCipherPreference(catalog) {
  const rows = (catalog || []).filter(r => r.negotiatedCipher);
  if (rows.length < 2) {
    return {
      mode: 'insufficient',
      cipherDiversity: rows.length,
      detail: 'Need at least 2 JA3 variants to judge preference mode.',
    };
  }
  const families = new Set(rows.map(r => r.cipherFamily));
  const ciphers = new Set(rows.map(r => r.negotiatedCipher));
  // Heuristic: if the terminator always picks the same cipher despite
  // different client orders, it enforces server preference.
  if (ciphers.size === 1) {
    return {
      mode: 'server-preference',
      cipherDiversity: 1,
      detail: `Same cipher (${rows[0].negotiatedCipher}) selected for all ${rows.length} JA3 variants — strict server cipher preference.`,
    };
  }
  if (families.size > 1) {
    return {
      mode: 'client-preference',
      cipherDiversity: ciphers.size,
      detail: `Selected cipher family varies with JA3 variant (${[...families].join(', ')}) — client cipher order honored.`,
    };
  }
  return {
    mode: 'mixed',
    cipherDiversity: ciphers.size,
    detail: `${ciphers.size} distinct ciphers within one family — partial server preference.`,
  };
}

/**
 * Score the catalog against known terminator behaviors.
 *
 * @param {{ mode: string }} preference
 * @param {ReturnType<typeof catalogHandshake>[]} catalog
 * @returns {{ terminator: string, score: number, markers: string[] }[]} Best first.
 */
export function matchTerminators(preference, catalog) {
  const rows = catalog || [];
  const chachaPicked = rows.some(r => /CHACHA20/i.test(r.negotiatedCipher));
  const tls13Only = rows.length > 0 && rows.every(r => /1\.3/.test(r.tlsVersion));

  const scored = KNOWN_TERMINATORS.map(t => {
    let score = 0;
    if (t.terminator.startsWith('Go') && preference.mode === 'server-preference' && chachaPicked)
      score += 0.7;
    if (t.terminator.startsWith('BoringSSL') && preference.mode === 'server-preference')
      score += 0.5;
    if (
      t.terminator.startsWith('OpenSSL') &&
      preference.mode === 'server-preference' &&
      !chachaPicked
    )
      score += 0.6;
    if (t.terminator.startsWith('NSS') && preference.mode === 'client-preference') score += 0.6;
    if (tls13Only && /Go|BoringSSL/.test(t.terminator)) score += 0.1;
    return { terminator: t.terminator, score: Math.min(1, score), markers: t.markers };
  });
  return scored.sort((a, b) => b.score - a.score);
}

/**
 * Full JA3-variant catalog analysis for one endpoint.
 *
 * @param {{ host?: string, records: { ja3?: string, ja3Hash?: string, clientLabel?: string, negotiatedCipher?: string, tlsVersion?: string }[] }} input
 * @returns {{ type: string, host: string, catalog: object[], preference: object, candidates: object[], bestGuess: string|null, confidence: string, evidence: string }}
 */
export function analyzeJa3Catalog({ host = '', records = [] } = {}) {
  const catalog = (records || []).map(catalogHandshake);
  const preference = analyzeCipherPreference(catalog);
  const candidates = matchTerminators(preference, catalog);
  const best = candidates[0];
  const bestGuess = best && best.score >= 0.55 ? best.terminator : null;
  const confidence = bestGuess ? (best.score >= 0.85 ? 'high' : 'medium') : 'low';

  return {
    type: 'JA3 TLS Client-Hello Cataloging',
    host: String(host || ''),
    catalog,
    preference,
    candidates,
    bestGuess,
    confidence,
    evidence: `Cataloged ${catalog.length} JA3 variant(s)${host ? ` against ${host}` : ''}: cipher-preference mode '${preference.mode}' (${preference.detail})${
      bestGuess
        ? ` — best terminator match '${bestGuess}' (score ${best.score.toFixed(2)})`
        : ' — no confident terminator match'
    }.`,
  };
}

export const JA3_PROFILER = {
  catalogHandshake,
  analyzeCipherPreference,
  matchTerminators,
  analyzeJa3Catalog,
};
export default JA3_PROFILER;
