/**
 * ftpBannerAnalyzer.js — FTP server banner fingerprinting from 220 greetings.
 *
 * Analyzes a captured FTP 220 greeting banner and fingerprints the server
 * implementation from vendor-specific phrasing and banner-format quirks
 * (e.g. Pure-FTPd dash framing, vsftpd parenthesis style). Also parses
 * multiline FEAT responses into a normalized extension list.
 *
 * Pure parsing — no FTP traffic is generated here; input is captured text.
 */

/**
 * Banner signature table: pattern matched against the 220 greeting.
 * `quirk` documents the banner-format nuance used as evidence.
 */
const BANNER_SIGNATURES = [
  {
    server: 'vsftpd', re: /\(vsFTPd\s+([\d.]+[a-z0-9]*|)\)/i, version: 1,
    quirk: 'Parenthesized "(vsFTPd X.Y.Z)" token after the greeting text.',
  },
  { server: 'ProFTPD', re: /ProFTPD\s+([\d.]+[a-z0-9]*)\s+Server/i, version: 1, quirk: '"ProFTPD X.Y.Z Server" phrasing.' },
  {
    server: 'Pure-FTPd', re: /-+\s*Welcome to Pure-FTPd/i, version: 0,
    quirk: 'Dash-framed multiline greeting ("---------- Welcome to Pure-FTPd") with no version disclosed.',
  },
  { server: 'FileZilla Server', re: /FileZilla Server(?:\s+(?:version\s+)?([\d.]+))?/i, version: 1, quirk: '"FileZilla Server" banner, optional "version X.Y" token.' },
  { server: 'Microsoft IIS FTP', re: /Microsoft FTP Service/i, version: 0, quirk: '"Microsoft FTP Service" banner with no version disclosed.' },
  { server: 'Serv-U', re: /Serv-U FTP(?:-Server)?(?:\s+v?([\d.]+))?/i, version: 1, quirk: '"Serv-U FTP" banner, version given after "v".' },
  { server: 'glFTPd', re: /glFTPd\s+([\d.]+[a-z0-9]*)/i, version: 1, quirk: 'Lowercase "glFTPd" token with version in greeting.' },
  { server: 'wu-ftpd', re: /wu-?ftpd/i, version: 0, quirk: '"wu-ftpd" token; classic Unix daemon.' },
  { server: 'bftpd', re: /\bbftpd\b/i, version: 0, quirk: '"bftpd" token.' },
  { server: 'CrushFTP', re: /CrushFTP(?:\s+v?([\d.]+))?/i, version: 1, quirk: '"CrushFTP" banner token.' },
  { server: 'Titan FTP', re: /Titan FTP Server(?:\s+([\d.]+))?/i, version: 1, quirk: '"Titan FTP Server" banner token.' },
  { server: 'Xlight FTP', re: /Xlight FTP Server/i, version: 0, quirk: '"Xlight FTP Server" token.' },
  { server: 'Gene6 / G6 FTP', re: /G6 FTP Server/i, version: 0, quirk: '"G6 FTP Server" token.' },
  { server: 'NcFTPd', re: /NcFTPd Server/i, version: 0, quirk: '"NcFTPd Server" token.' },
  { server: 'PyFTPdlib', re: /pyftpdlib/i, version: 0, quirk: 'Python pyftpdlib default banner phrasing.' },
  { server: 'NetKit FTP', re: /NetKit FTP/i, version: 0, quirk: '"NetKit FTP" token.' },
];

/**
 * Fingerprint an FTP server from a captured 220 greeting banner.
 *
 * @param {string} banner raw banner text (may be multiline)
 * @returns {{ server: string, version: string, confidence: 'high'|'medium'|'low',
 *   evidence: string }}
 */
export function analyzeFtpBanner(banner = '') {
  const text = String(banner || '');
  const lines = text.split(/\r?\n/);
  const first220 = lines.find((l) => /^220[\s-]/.test(l)) || lines[0] || '';

  for (const sig of BANNER_SIGNATURES) {
    const m = sig.re.exec(text);
    if (!m) continue;
    const version = sig.version && m[1] ? m[1] : 'unknown';
    return {
      server: sig.server,
      version,
      confidence: 'high',
      evidence: `Banner matched ${sig.server} signature: ${sig.quirk} Observed: "${first220.trim()}".`,
    };
  }

  // Generic 220 banner with no vendor token: still note what we saw.
  const has220 = /^220[\s-]/m.test(text);
  return {
    server: 'Unknown',
    version: 'unknown',
    confidence: 'low',
    evidence: has220
      ? `Generic 220 greeting with no vendor signature: "${first220.trim()}".`
      : 'No 220 greeting found in captured text.',
  };
}

/**
 * Parse a multiline FEAT response into a sorted extension list.
 * Handles both "211-..."/"211 End" framing and bare listings.
 *
 * @param {string} featText captured FEAT response text
 * @returns {{ extensions: string[], rawCount: number }}
 */
export function parseFeatResponse(featText = '') {
  const lines = String(featText || '').split(/\r?\n/);
  const extensions = new Set();
  for (const line of lines) {
    const t = line.trim();
    // Strip FEAT framing prefix ("211-" or "211 ") from continuation lines.
    const stripped = t.replace(/^211(?:-\s*|\s+)/i, '').trim();
    // Skip framing lines: "211", "211-Features:", "211 Extensions:", "211 End".
    if (/^211$/i.test(t)) continue;
    if (/^(features|extensions)\b/i.test(stripped) || /^end\b/i.test(stripped)) continue;
    if (!stripped) continue;
    const token = stripped.split(/\s+/)[0];
    if (/^220|^530|^500/i.test(token)) continue;
    extensions.add(token.toUpperCase());
  }
  const sorted = [...extensions].sort();
  return { extensions: sorted, rawCount: lines.length };
}

export const FTP_BANNER_ANALYZER = {
  analyzeFtpBanner,
  parseFeatResponse,
  BANNER_SIGNATURES,
};

export default FTP_BANNER_ANALYZER;
