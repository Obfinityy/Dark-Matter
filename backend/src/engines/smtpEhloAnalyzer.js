/**
 * smtpEhloAnalyzer.js — SMTP banner + EHLO capability analyzer.
 *
 * Fingerprints a mail server from its captured 220 greeting banner and the
 * 250 EHLO capability lines (banner regexes plus capability ordering
 * quirks), and assesses the exposure of advertised capabilities from a
 * defensive posture.
 *
 * Pure analysis of captured data only — no connections are made here.
 */

/**
 * Banner signature table. Each entry: regex matched against the 220 line,
 * optional version capture group, and EHLO capability quirks used as a
 * secondary signal.
 *
 * Signature table:
 * | banner pattern                    | server            |
 * |-----------------------------------|-------------------|
 * | Postfix                           | Postfix           |
 * | Exim X.Y                          | Exim              |
 * | Sendmail X.Y.Z / ESMTP Sendmail   | Sendmail          |
 * | Microsoft ESMTP MAIL Service      | Microsoft Exchange|
 * | OpenSMTPD                         | OpenSMTPD         |
 * | gsmtp                             | Gmail (Google)    |
 * | Zimbra                            | Zimbra            |
 * | hMailServer                       | hMailServer       |
 * | MDaemon                           | MDaemon           |
 * | CommuniGate Pro                   | CommuniGate Pro   |
 * | Kerio Connect                     | Kerio Connect     |
 * | Haraka                            | Haraka            |
 * | Lotus Domino / Domino             | HCL Domino        |
 */
const BANNER_SIGNATURES = [
  { re: /postfix/i, server: 'Postfix', versionRe: /postfix[\s/-]*([\d.]+)/i, confidence: 'high' },
  { re: /exim\s+([\d.]+)/i, server: 'Exim', versionRe: /exim\s+([\d.]+)/i, confidence: 'high' },
  { re: /\bsendmail\s+([\d.]+)/i, server: 'Sendmail', versionRe: /\bsendmail\s+([\d.]+)/i, confidence: 'high' },
  { re: /microsoft esmtp mail service/i, server: 'Microsoft Exchange', versionRe: /version:\s*([\d.]+)/i, confidence: 'high' },
  { re: /opensmtpd/i, server: 'OpenSMTPD', versionRe: /opensmtpd[\s/-]*([\d.]+)/i, confidence: 'high' },
  { re: /gsmtp/i, server: 'Gmail (Google)', versionRe: null, confidence: 'high' },
  { re: /zimbra/i, server: 'Zimbra', versionRe: /zimbra[\s/-]*([\d.]+)/i, confidence: 'high' },
  { re: /hmailserver/i, server: 'hMailServer', versionRe: /hmailserver[\s/-]*([\d.]+)/i, confidence: 'high' },
  { re: /mdaemon/i, server: 'MDaemon', versionRe: /mdaemon[\s/-]*([\d.]+)/i, confidence: 'high' },
  { re: /communigate pro/i, server: 'CommuniGate Pro', versionRe: /communigate pro[\s/-]*([\d.]+)/i, confidence: 'high' },
  { re: /kerio connect/i, server: 'Kerio Connect', versionRe: /kerio connect[\s/-]*([\d.]+)/i, confidence: 'high' },
  { re: /haraka/i, server: 'Haraka', versionRe: null, confidence: 'medium' },
  { re: /lotus domino|domino/i, server: 'HCL Domino', versionRe: null, confidence: 'medium' },
];

/**
 * Parse raw 250 EHLO response lines into an ordered capability list.
 *
 * Handles "250-KEYWORD args" continuation lines and the final "250 KEYWORD"
 * line; strips the numeric codes and keeps original order.
 *
 * @param {string[]} ehloLines
 * @returns {string[]} ordered capability strings, e.g. ["PIPELINING", "SIZE 35882577", "STARTTLS"].
 */
export function parseCapabilities(ehloLines = []) {
  const caps = [];
  for (const raw of Array.isArray(ehloLines) ? ehloLines : []) {
    const line = String(raw || '').trim();
    const match = /^250[ -](.+)$/i.exec(line);
    if (match) caps.push(match[1].trim());
  }
  return caps;
}

/** Capability keyword (first token, upper-cased) of a capability string. */
function capKeyword(cap) {
  return String(cap || '').split(/\s+/)[0].toUpperCase();
}

/**
 * Fingerprint a mail server from its 220 banner and 250 EHLO lines.
 *
 * Primary signal is the banner regex table; capability ordering quirks act
 * as a secondary signal (e.g. Postfix orders PIPELINING/SIZE/ETRN/STARTTLS/
 * ENHANCEDSTATUSCODES/8BITMIME/DSN; Exchange advertises X-EXPS/X-ANONYMOUSTLS).
 *
 * @param {string} bannerLine — captured 220 greeting line.
 * @param {string[]} ehloLines — captured 250 EHLO response lines.
 * @returns {{ server: string, version: string|null, confidence: 'high'|'medium'|'low', evidence: string, capabilities: string[] }}
 */
export function analyzeEhloResponse(bannerLine = '', ehloLines = []) {
  const banner = String(bannerLine || '').trim();
  const capabilities = parseCapabilities(ehloLines);
  const keywords = capabilities.map(capKeyword);

  let server = 'Unknown';
  let version = null;
  let confidence = 'low';
  let evidence = 'No banner signature matched.';

  for (const sig of BANNER_SIGNATURES) {
    if (sig.re.test(banner)) {
      server = sig.server;
      confidence = sig.confidence;
      if (sig.versionRe) {
        const vm = sig.versionRe.exec(banner);
        version = vm ? vm[1] : null;
      }
      evidence = `Banner matched ${sig.server} signature: "${banner.slice(0, 120)}"${version ? ` (version ${version})` : ''}.`;
      break;
    }
  }

  // Secondary signal: capability quirks for servers with generic banners.
  const quirks = [];
  if (server === 'Unknown' || server === 'Microsoft Exchange') {
    if (keywords.includes('X-EXPS') || keywords.includes('X-ANONYMOUSTLS')) {
      quirks.push('X-EXPS/X-ANONYMOUSTLS');
      if (server === 'Unknown') {
        server = 'Microsoft Exchange';
        confidence = 'medium';
        evidence = `Generic banner but Exchange-only capabilities present: ${capabilities.join(' | ')}.`;
      }
    }
  }
  if (server === 'Unknown') {
    const postfixOrder = ['PIPELINING', 'SIZE', 'ETRN', 'STARTTLS', 'ENHANCEDSTATUSCODES', '8BITMIME', 'DSN'];
    const idx = (k) => keywords.indexOf(k);
    const ordered = postfixOrder.every((k, i) => i === 0 || (idx(k) !== -1 && idx(postfixOrder[i - 1]) !== -1 && idx(postfixOrder[i - 1]) < idx(k)));
    if (ordered && keywords.includes('PIPELINING') && keywords.includes('ENHANCEDSTATUSCODES')) {
      quirks.push('Postfix-style PIPELINING..DSN ordering');
      server = 'Postfix (likely)';
      confidence = 'medium';
      evidence = `Capabilities follow Postfix's canonical ordering: ${capabilities.join(' | ')}.`;
    }
  }
  if (quirks.length > 0 && server !== 'Unknown') {
    evidence += ` Capability quirks: ${quirks.join(', ')}.`;
  }

  return { server, version, confidence, evidence, capabilities };
}

/**
 * Assess exposure of advertised EHLO capabilities from a defensive posture.
 *
 * Flags: VRFY/EXPN (user/list enumeration), missing STARTTLS (plaintext),
 * ETRN (queue flushing), AUTH PLAIN/LOGIN without STARTTLS, and verbose
 * HELP/8BITMIME hints are informational.
 *
 * @param {string[]} capabilities — parsed capability strings (as returned by analyzeEhloResponse).
 * @returns {object[]} findings with type, severity, confidence, evidence, recommendation.
 */
export function assessExposure(capabilities = []) {
  const caps = Array.isArray(capabilities) ? capabilities : [];
  const keywords = caps.map(capKeyword);
  const findings = [];

  if (keywords.includes('VRFY')) {
    findings.push({
      type: 'VRFY advertised — user enumeration risk',
      severity: 'Medium',
      confidence: 'high',
      evidence: 'Server advertises VRFY; attackers can validate recipient addresses.',
      recommendation: 'Disable VRFY or restrict it to authenticated/trusted sources.',
    });
  }
  if (keywords.includes('EXPN')) {
    findings.push({
      type: 'EXPN advertised — mailing-list enumeration risk',
      severity: 'Medium',
      confidence: 'high',
      evidence: 'Server advertises EXPN; mailing list membership can be enumerated.',
      recommendation: 'Disable EXPN on public-facing MTAs.',
    });
  }
  if (!keywords.includes('STARTTLS')) {
    findings.push({
      type: 'No STARTTLS advertised — plaintext mail possible',
      severity: 'Medium',
      confidence: 'high',
      evidence: 'STARTTLS absent from EHLO capabilities; mail may traverse the network unencrypted.',
      recommendation: 'Enable STARTTLS with a valid certificate; consider MTA-STS/DANE.',
    });
  }
  if (keywords.includes('ETRN')) {
    findings.push({
      type: 'ETRN advertised — mail queue manipulation surface',
      severity: 'Low',
      confidence: 'medium',
      evidence: 'ETRN allows a remote party to trigger queue runs for a domain.',
      recommendation: 'Restrict ETRN to authenticated peers or disable it.',
    });
  }
  const authLine = caps.find((c) => capKeyword(c) === 'AUTH') || '';
  if (/PLAIN|LOGIN/i.test(authLine) && !keywords.includes('STARTTLS')) {
    findings.push({
      type: 'Weak AUTH mechanisms without STARTTLS',
      severity: 'High',
      confidence: 'high',
      evidence: `AUTH advertises ${authLine} but STARTTLS is absent — credentials would cross the wire in cleartext.`,
      recommendation: 'Require STARTTLS before AUTH, or restrict AUTH PLAIN/LOGIN to encrypted sessions only.',
    });
  }
  if (keywords.includes('X-EXPS')) {
    findings.push({
      type: 'Exchange X-EXPS extended protection advertised',
      severity: 'Info',
      confidence: 'medium',
      evidence: 'X-EXPS indicates Exchange extended-protection channel binding support.',
      recommendation: 'None — informational; confirm channel binding is enforced server-side.',
    });
  }

  return findings;
}

export const SMTP_EHLO_ANALYZER = { parseCapabilities, analyzeEhloResponse, assessExposure };
export default SMTP_EHLO_ANALYZER;
