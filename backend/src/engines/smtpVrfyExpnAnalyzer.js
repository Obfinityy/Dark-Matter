/**
 * smtpVrfyExpnAnalyzer.js — SMTP VRFY/EXPN behavior classifier (idea 00511).
 *
 * Analyzes responses from SMTP VRFY (verify user) and EXPN (expand list)
 * commands to classify a mail server's user-enumeration posture. Pure
 * analyzer: it consumes observed SMTP reply data and returns a structured
 * posture classification. Defensive framing for authorized bug-bounty work:
 * enumeration of valid addresses is a standard pre-assessment posture check.
 */

/**
 * SMTP reply-code severity for enumeration posture.
 */
const POSTURE_BY_CODE = {
  250: 'enumerable', // positive completion — address confirmed
  251: 'enumerable', // user not local; will forward — address confirmed
  252: 'ambiguous', // cannot VRFY user, but may deliver — no oracle
  550: 'resistant', // user not found — could still be an oracle
  551: 'ambiguous', // user not local — partial disclosure
  552: 'ambiguous',
  553: 'resistant',
  500: 'disabled', // command not recognized — VRFY/EXPN off
  501: 'disabled', // syntax error — probe rejected
  502: 'disabled', // command not implemented
  503: 'disabled', // bad command sequence — probe rejected
  504: 'disabled',
};

const ADDRESS_PATTERNS = [
  { name: 'postmaster', re: /^postmaster@/i, note: 'RFC 5321 mandatory address' },
  { name: 'mailer-daemon', re: /^mailer-daemon@/i, note: 'mandatory delivery address' },
  { name: 'abuse', re: /^abuse@/i, note: 'RFC 2142 abuse address' },
  { name: 'admin', re: /^admin@/i, note: 'common administrative address' },
  { name: 'test', re: /^test@/i, note: 'common test address' },
];

/**
 * Classify a single VRFY/EXPN reply.
 * @param {{command: 'VRFY'|'EXPN', target: string, code: number, text: string}} reply
 * @returns {{command: string, target: string, code: number, posture: string, disclosesExistence: boolean}}
 */
export function classifyVrfyReply(reply = {}) {
  const code = Number(reply.code) || 0;
  const posture =
    POSTURE_BY_CODE[code] ||
    (code >= 200 && code < 300 ? 'enumerable' : code >= 500 ? 'disabled' : 'ambiguous');
  return {
    command: reply.command || 'VRFY',
    target: String(reply.target || ''),
    code,
    posture,
    disclosesExistence: posture === 'enumerable',
  };
}

/**
 * Differentiate an oracle (valid vs invalid get different answers) from a
 * uniform rejector. Compares replies to a known-valid address and a
 * guaranteed-nonexistent address.
 * @param {{code: number, text: string}} validReply reply for known-good address
 * @param {{code: number, text: string}} invalidReply reply for random address
 * @returns {{isOracle: boolean, posture: string, confidence: number}}
 */
export function detectEnumerationOracle(validReply = {}, invalidReply = {}) {
  const v = classifyVrfyReply({ command: 'VRFY', target: 'known', code: validReply.code });
  const i = classifyVrfyReply({ command: 'VRFY', target: 'nonexistent', code: invalidReply.code });
  const isOracle = v.posture === 'enumerable' && i.posture !== 'enumerable';
  const bothReject = v.posture === 'resistant' && i.posture === 'resistant';
  return {
    isOracle,
    posture: isOracle ? 'enumerable' : bothReject ? 'resistant-uniform' : 'ambiguous',
    confidence: isOracle ? 0.95 : bothReject ? 0.9 : 0.5,
  };
}

/**
 * Aggregate a full VRFY/EXPN probing session into a posture report.
 * @param {Array<{command: string, target: string, code: number, text: string}>} session
 * @returns {{posture: string, commandsEnabled: {vrfy: boolean, expn: boolean}, addressesConfirmed: string[], addressPatterns: Array, summary: string}}
 */
export function summarizeEnumerationSession(session = []) {
  const classified = session.map(classifyVrfyReply);
  const vrfy = classified.filter(c => c.command === 'VRFY');
  const expn = classified.filter(c => c.command === 'EXPN');
  const confirmed = vrfy.filter(c => c.disclosesExistence).map(c => c.target);
  const disabledCount = classified.filter(c => c.posture === 'disabled').length;
  const posture =
    confirmed.length > 0
      ? 'enumerable'
      : disabledCount === classified.length && classified.length > 0
        ? 'disabled'
        : 'ambiguous';

  const addressPatterns = ADDRESS_PATTERNS.map(p => ({
    name: p.name,
    note: p.note,
    confirmed: classified.some(c => p.re.test(c.target) && c.disclosesExistence),
  }));

  return {
    posture,
    commandsEnabled: {
      vrfy: vrfy.some(c => c.posture !== 'disabled'),
      expn: expn.some(c => c.posture !== 'disabled'),
    },
    addressesConfirmed: [...new Set(confirmed)],
    addressPatterns,
    summary:
      posture === 'enumerable'
        ? `Server confirms recipient addresses via VRFY/EXPN (${confirmed.length} confirmed). User enumeration is possible.`
        : posture === 'disabled'
          ? 'VRFY/EXPN are disabled or rejected; no user enumeration oracle observed.'
          : 'VRFY/EXPN behavior is ambiguous; further controlled checks needed before concluding.',
  };
}

export const SMTP_VRFY_EXPN_ANALYZER = {
  classifyVrfyReply,
  detectEnumerationOracle,
  summarizeEnumerationSession,
};

export default SMTP_VRFY_EXPN_ANALYZER;
