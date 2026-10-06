/**
 * nntpCapabilityProbe.js — NNTP server capability analyzer (idea 00515).
 *
 * Analyzes NNTP LIST EXTENSIONS / CAPABILITIES responses to fingerprint
 * news server software (INN, Diablo, hamster, …) and flag risky exposed
 * features (posting enabled on anonymous servers, NEWNEWS with date ranges,
 * MODE-READER behaviors). Pure analyzer over observed data; defensive,
 * authorized bug-bounty framing.
 */

const SERVER_SIGNATURES = [
  { name: 'INN', re: /\binn\b|internews|nntp server ready.*posting/i, ext: /OVER.*HDR/i, confidence: 0.85 },
  { name: 'Diablo', re: /diablo/i, confidence: 0.95 },
  { name: 'Hamster', re: /hamster/i, confidence: 0.95 },
  { name: 'NNTPCache', re: /nntpcache/i, confidence: 0.9 },
  { name: 'Leafnode', re: /leafnode/i, confidence: 0.9 },
  { name: 'Gnus nnrpd', re: /nnrpd/i, confidence: 0.8 },
  { name: 'dnews', re: /dnews/i, confidence: 0.9 },
];

const RISKY_FEATURES = [
  { token: 'POST', note: 'Posting permitted — check whether anonymous posting is allowed' },
  { token: 'IHAVE', note: 'IHAVE enabled — server accepts article injection offers' },
  { token: 'NEWNEWS', note: 'NEWNEWS enabled — article metadata harvesting surface' },
  { token: 'MODE-READER', note: 'Mode-reader switching supported' },
  { token: 'AUTHINFO', note: 'Auth info advertised; verify credential transport is TLS' },
];

/**
 * Parse a LIST EXTENSIONS / CAPABILITIES block into feature tokens.
 * @param {string} block raw server block (terminated by ".")
 * @returns {Array<{token: string, args: string}>}
 */
export function parseNntpExtensions(block = '') {
  return String(block)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^\d{3}\b/.test(l) && l !== '.')
    .map((l) => {
      const [token, ...rest] = l.split(/\s+/);
      return { token: token.toUpperCase(), args: rest.join(' ') };
    });
}

/**
 * Fingerprint NNTP server software from greeting and extensions.
 * @param {{greeting?: string, extensions: Array<{token: string}>}} data
 * @returns {{best: string|null, confidence: number, candidates: string[]}}
 */
export function fingerprintNntpServer(data = {}) {
  const greeting = String(data.greeting || '');
  const extTokens = (data.extensions || []).map((e) => e.token).join(' ');
  const candidates = [];

  for (const sig of SERVER_SIGNATURES) {
    const greetHit = sig.re.test(greeting);
    const extHit = sig.ext ? sig.ext.test(extTokens) : false;
    if (greetHit || extHit) {
      candidates.push({ name: sig.name, confidence: greetHit ? sig.confidence : sig.confidence * 0.7 });
    }
  }

  candidates.sort((a, b) => b.confidence - a.confidence);
  return {
    best: candidates.length > 0 ? candidates[0].name : null,
    confidence: candidates.length > 0 ? candidates[0].confidence : 0,
    candidates: candidates.map((c) => c.name),
  };
}

/**
 * Flag exposed NNTP features that warrant manual review.
 * @param {Array<{token: string}>} extensions
 * @returns {Array<{token: string, note: string}>}
 */
export function flagNntpExposure(extensions = []) {
  const present = new Set(extensions.map((e) => e.token.toUpperCase()));
  return RISKY_FEATURES.filter((f) => present.has(f.token));
}

export const NNTP_CAPABILITY_PROBE = {
  parseNntpExtensions,
  fingerprintNntpServer,
  flagNntpExposure,
};

export default NNTP_CAPABILITY_PROBE;
