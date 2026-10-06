/**
 * imapCapabilityFingerprint.js — IMAP server fingerprinting by capability list (idea 00513).
 *
 * Fingerprints IMAP servers from their CAPABILITY responses. Capability
 * tokens and greeting banners correlate strongly with server software and
 * sometimes version families (Dovecot, Cyrus, Gmail, Exchange, Courier,
 * Zimbra, …). Pure analyzer over observed data; defensive, authorized use.
 */

const SERVER_SIGNATURES = [
  { name: 'Dovecot', caps: [/^SASL-IR$/i, /^LITERAL\+$/i], greeting: /dovecot|imap4rev2.*ready/i },
  { name: 'Cyrus IMAP', caps: [/^ANNOTATE-EXPERIMENT-1$/i], greeting: /cyrus/i },
  { name: 'Gmail IMAP', caps: [/^X-GM-EXT-1$/i], greeting: /gimap/i },
  { name: 'Microsoft Exchange', caps: [/^X-EXCHANGE-ANTI-SPAM/i], greeting: /microsoft exchange|exchange server/i },
  { name: 'Courier IMAP', caps: [/^CHILDREN$/i], greeting: /courier/i },
  { name: 'Zimbra', caps: [/^XLIST$/i], greeting: /zimbra/i },
  { name: 'dbmail', caps: [], greeting: /dbmail/i },
  { name: 'Uw-IMAP', caps: [], greeting: /uw-imap/i },
];

const RISK_FLAGS = [
  { token: /^AUTH=PLAIN$/i, note: 'Plaintext auth mechanism available' },
  { token: /^LOGINDISABLED$/i, note: 'LOGIN disabled until TLS (good)' },
  { token: /^STARTTLS$/i, note: 'STARTTLS available' },
  { token: /^IDLE$/i, note: 'IDLE push notifications supported' },
  { token: /^NAMESPACE$/i, note: 'NAMESPACE exposed' },
  { token: /^QUOTA$/i, note: 'QUOTA information exposed' },
];

/**
 * Parse a raw CAPABILITY response line into tokens.
 * @param {string} line e.g. "* CAPABILITY IMAP4rev1 STARTTLS AUTH=GSSAPI"
 * @returns {string[]} capability tokens
 */
export function parseCapabilities(line = '') {
  const m = String(line).match(/CAPABILITY\s+(.*)/i);
  if (!m) return [];
  return m[1].trim().split(/\s+/).filter(Boolean);
}

/**
 * Fingerprint server software from greeting + capabilities.
 * @param {{greeting?: string, capabilities: string[]}} data
 * @returns {{matches: Array<{name: string, confidence: number, via: string}>, best: string|null}}
 */
export function fingerprintImapServer(data = {}) {
  const caps = (data.capabilities || []).map((c) => String(c));
  const greeting = String(data.greeting || '');
  const matches = [];

  for (const sig of SERVER_SIGNATURES) {
    const capHits = sig.caps.filter((re) => caps.some((c) => re.test(c))).length;
    const greetHit = sig.greeting && sig.greeting.test(greeting);
    if (capHits === 0 && !greetHit) continue;
    const confidence = greetHit && capHits > 0 ? 0.95 : greetHit ? 0.8 : 0.7;
    matches.push({
      name: sig.name,
      confidence,
      via: [greetHit ? 'greeting' : null, capHits > 0 ? `capabilities(${capHits})` : null].filter(Boolean).join(' + '),
    });
  }

  matches.sort((a, b) => b.confidence - a.confidence);
  return { matches, best: matches.length > 0 ? matches[0].name : null };
}

/**
 * Flag capability-based risk indicators.
 * @param {string[]} capabilities
 * @returns {{flags: Array<{token: string, note: string}>, secure: boolean}}
 */
export function flagImapCapabilityRisks(capabilities = []) {
  const flags = [];
  for (const f of RISK_FLAGS) {
    const hit = capabilities.find((c) => f.token.test(c));
    if (hit) flags.push({ token: hit, note: f.note });
  }
  const secure = !capabilities.some((c) => /^AUTH=PLAIN$/i.test(c)) &&
    (capabilities.some((c) => /^STARTTLS$/i.test(c)) || capabilities.some((c) => /^LOGINDISABLED$/i.test(c)));
  return { flags, secure };
}

export const IMAP_CAPABILITY_FINGERPRINT = {
  parseCapabilities,
  fingerprintImapServer,
  flagImapCapabilityRisks,
};

export default IMAP_CAPABILITY_FINGERPRINT;
