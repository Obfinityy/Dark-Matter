/**
 * pop3CapaAnalyzer.js — POP3 CAPA response analyzer (idea 00514).
 *
 * Analyzes POP3 CAPA (capability) responses to identify server software and
 * flag insecure configurations (missing STLS, plaintext USER/PASS accepted
 * before TLS, leaked implementation tokens). Pure analyzer over observed
 * data; defensive, authorized bug-bounty use.
 */

const SERVER_TOKENS = [
  { name: 'Dovecot POP3', re: /dovecot/i, confidence: 0.9 },
  { name: 'Cyrus POP3', re: /cyrus/i, confidence: 0.9 },
  { name: 'Gmail POP3', re: /g2pop/i, confidence: 0.85 },
  { name: 'Exchange POP3', re: /microsoft exchange/i, confidence: 0.85 },
  { name: 'Qpopper', re: /qpopper/i, confidence: 0.95 },
  { name: 'Courier POP3', re: /courier/i, confidence: 0.9 },
  { name: 'CommuniGate Pro', re: /communigate/i, confidence: 0.9 },
];

const KNOWN_CAPS = new Set([
  'TOP',
  'USER',
  'UIDL',
  'SASL',
  'RESP-CODES',
  'PIPELINING',
  'STLS',
  'IMPLEMENTATION',
  'LOGIN-DELAY',
  'EXPIRE',
  'LANG',
  'UTF8',
]);

/**
 * Parse a raw CAPA response block into capability entries.
 * @param {string} block raw server block (between "+OK" and ".")
 * @returns {Array<{name: string, args: string[], known: boolean}>}
 */
export function parsePop3Capa(block = '') {
  return String(block)
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('+OK') && !l.startsWith('-ERR') && l !== '.')
    .map(l => {
      const [name, ...args] = l.split(/\s+/);
      return { name, args, known: KNOWN_CAPS.has(name.toUpperCase()) };
    });
}

/**
 * Identify server software from banner and CAPA entries.
 * @param {{banner?: string, capa: Array<{name: string, args: string[]}>}} data
 * @returns {{best: string|null, confidence: number, implementationToken: string|null}}
 */
export function identifyPop3Server(data = {}) {
  const banner = String(data.banner || '');
  const impl = (data.capa || []).find(c => c.name.toUpperCase() === 'IMPLEMENTATION');
  const implText = impl ? impl.args.join(' ') : '';
  const haystack = `${banner} ${implText}`;

  let best = null;
  for (const sig of SERVER_TOKENS) {
    if (sig.re.test(haystack)) {
      best = { name: sig.name, confidence: sig.confidence };
      break;
    }
  }

  return {
    best: best ? best.name : null,
    confidence: best ? best.confidence : 0,
    implementationToken: implText || null,
  };
}

/**
 * Score the security posture of the POP3 service from its CAPA set.
 * @param {Array<{name: string}>} capa
 * @param {boolean} [implicitTls=false]
 * @returns {{score: number, issues: string[], stlsAvailable: boolean}}
 */
export function scorePop3Posture(capa = [], implicitTls = false) {
  const names = new Set(capa.map(c => String(c.name).toUpperCase()));
  const issues = [];
  let score = 100;

  const stls = names.has('STLS');
  if (!stls && !implicitTls) {
    issues.push('STLS not advertised; credentials may traverse in plaintext.');
    score -= 50;
  }
  if (names.has('USER') && !stls && !implicitTls) {
    issues.push('USER capability present without TLS; plaintext USER/PASS accepted.');
    score -= 30;
  }
  const unknown = capa.filter(c => !KNOWN_CAPS.has(String(c.name).toUpperCase())).map(c => c.name);
  if (unknown.length > 0) {
    issues.push(
      `Unknown capability tokens leaked: ${unknown.join(', ')} (implementation detail disclosure).`
    );
    score -= 10;
  }

  return { score: Math.max(0, score), issues, stlsAvailable: stls };
}

export const POP3_CAPA_ANALYZER = {
  parsePop3Capa,
  identifyPop3Server,
  scorePop3Posture,
};

export default POP3_CAPA_ANALYZER;
