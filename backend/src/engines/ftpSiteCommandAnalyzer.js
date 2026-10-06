/**
 * ftpSiteCommandAnalyzer.js — FTP SITE-command support analyzer.
 *
 * Analyzes captured SITE HELP output and captured SITE command responses to
 * infer the FTP server implementation. SITE sub-commands are strongly
 * vendor-specific:
 *   SITE CHMOD / CHOWN / UMASK / IDLE → Unix FTP daemons (vsftpd, ProFTPD,
 *     Pure-FTPd family) — Unix permission semantics over FTP
 *   SITE PSWD → Serv-U (password change via SITE)
 *   SITE ZONE → Microsoft IIS FTP (time-zone setting)
 *   SITE EXEC → wu-ftpd legacy remote execution (dangerous, removed in modern servers)
 *   SITE WHO / STAT → ProFTPD / glFTPd session introspection
 *   SITE DIRSTYLE / MINFO → Microsoft IIS FTP listing styles
 *   SITE CPFR / CPTO / CPSZ → ProFTPD copy extensions
 *   SITE UTIME → ProFTPD / NetKit file timestamp setting
 *   SITE NEWER / MKD helper variants → legacy daemons
 *
 * Pure parsing — no FTP traffic is generated here; input is captured text.
 */

/**
 * SITE sub-command → likely server implementation(s), with confidence weight.
 */
const SITE_COMMAND_MAP = [
  { cmd: 'CHMOD', servers: ['vsftpd', 'ProFTPD', 'Pure-FTPd'], note: 'Unix permission semantics; hallmark of Unix FTP daemons.' },
  { cmd: 'CHOWN', servers: ['ProFTPD', 'Pure-FTPd'], note: 'Ownership change via SITE; Unix daemons (often root-capable builds).' },
  { cmd: 'UMASK', servers: ['ProFTPD', 'vsftpd', 'Pure-FTPd'], note: 'Umask control; Unix FTP daemons.' },
  { cmd: 'IDLE', servers: ['vsftpd', 'ProFTPD', 'Pure-FTPd'], note: 'Idle-timeout control; common Unix daemon extension.' },
  { cmd: 'UTIME', servers: ['ProFTPD', 'NetKit FTP'], note: 'File timestamp setting.' },
  { cmd: 'PSWD', servers: ['Serv-U'], note: 'Serv-U password-change extension; strongly identifies Serv-U.' },
  { cmd: 'ZONE', servers: ['Microsoft IIS FTP'], note: 'IIS time-zone extension; strongly identifies Microsoft FTP.' },
  { cmd: 'EXEC', servers: ['wu-ftpd'], note: 'Legacy remote-execution extension; wu-ftpd only, long removed upstream.' },
  { cmd: 'WHO', servers: ['ProFTPD', 'glFTPd'], note: 'Session listing; ProFTPD/glFTPd introspection.' },
  { cmd: 'STAT', servers: ['ProFTPD', 'glFTPd'], note: 'Server status via SITE; ProFTPD/glFTPd.' },
  { cmd: 'DIRSTYLE', servers: ['Microsoft IIS FTP'], note: 'IIS directory listing style switch.' },
  { cmd: 'MINFO', servers: ['Microsoft IIS FTP'], note: 'IIS machine info extension.' },
  { cmd: 'CPFR', servers: ['ProFTPD'], note: 'ProFTPD copy-from extension.' },
  { cmd: 'CPTO', servers: ['ProFTPD'], note: 'ProFTPD copy-to extension.' },
  { cmd: 'CPSZ', servers: ['ProFTPD'], note: 'ProFTPD copy-size extension.' },
  { cmd: 'CHGRP', servers: ['ProFTPD', 'Pure-FTPd'], note: 'Group change; Unix daemon extension.' },
  { cmd: 'HELP', servers: [], note: 'Generic SITE HELP echo; not identifying by itself.' },
  { cmd: 'VERSION', servers: ['ProFTPD'], note: 'ProFTPD build-version disclosure via SITE.' },
  { cmd: 'RATIO', servers: ['glFTPd'], note: 'glFTPd ratio management; strongly identifies glFTPd.' },
  { cmd: 'NUKE', servers: ['glFTPd'], note: 'glFTPd nuke extension.' },
  { cmd: 'MSG', servers: ['glFTPd'], note: 'glFTPd message extension.' },
  { cmd: 'NEWDIR', servers: ['Serv-U'], note: 'Serv-U directory helper.' },
  { cmd: 'SETSTAT', servers: ['Serv-U'], note: 'Serv-U status extension.' },
];

/**
 * Parse captured SITE HELP output; map sub-commands to server implementations.
 *
 * @param {string} siteHelpText raw captured SITE HELP response text
 * @returns {{ server: string, confidence: 'high'|'medium'|'low',
 *   matchedCommands: string[], evidence: string }}
 */
export function analyzeSiteHelp(siteHelpText = '') {
  const text = String(siteHelpText || '');
  // Collect candidate uppercase tokens as sub-command names.
  const tokens = new Set();
  for (const m of text.matchAll(/\b([A-Z][A-Z0-9]{1,15})\b/g)) {
    tokens.add(m[1]);
  }

  const matched = [];
  const serverVotes = {};
  for (const entry of SITE_COMMAND_MAP) {
    if (!tokens.has(entry.cmd)) continue;
    matched.push(entry.cmd);
    for (const server of entry.servers) {
      serverVotes[server] = (serverVotes[server] || 0) + 1;
    }
  }

  const ranked = Object.entries(serverVotes).sort((a, b) => b[1] - a[1]);

  if (ranked.length === 0) {
    return {
      server: 'Unknown',
      confidence: 'low',
      matchedCommands: matched,
      evidence: matched.length === 0
        ? 'No known SITE sub-commands found in captured SITE HELP text.'
        : `Recognized commands (${matched.join(', ')}) are too generic to identify a server.`,
    };
  }

  const [topServer, topVotes] = ranked[0];
  // High confidence only when a single server owns a distinctive marker
  // (e.g. PSWD→Serv-U, ZONE→IIS) or dominates the vote count.
  const distinctive = SITE_COMMAND_MAP.filter(
    (e) => e.servers.length === 1 && tokens.has(e.cmd) && e.servers[0] === topServer,
  );
  const confidence = distinctive.length > 0 || topVotes >= 3 || (ranked.length > 1 && topVotes > ranked[1][1] + 1)
    ? 'high'
    : topVotes >= 2 ? 'medium' : 'low';

  const evidenceBits = matched.map((cmd) => {
    const e = SITE_COMMAND_MAP.find((x) => x.cmd === cmd);
    return `${cmd} (${e.servers.join('/') || 'generic'}): ${e.note}`;
  });
  return {
    server: topServer,
    confidence,
    matchedCommands: matched.sort(),
    evidence: `SITE HELP matched ${matched.length} known sub-command(s): ${evidenceBits.join(' | ')}`,
  };
}

/**
 * Interpret a captured SITE command response code.
 *
 * @param {string} command the SITE sub-command that was issued (e.g. "SITE CHMOD")
 * @param {number} code numeric FTP reply code (200/500/502/...)
 * @param {string} message reply text
 * @returns {{ supported: boolean, interpretation: string, serverHint: string }}
 */
export function analyzeSiteResponse(command = '', code = 0, message = '') {
  const cmd = String(command || '').trim().toUpperCase().replace(/^SITE\s+/i, '');
  const msg = String(message || '').trim();
  const codeNum = Number(code) || 0;

  if (codeNum >= 200 && codeNum < 300) {
    return {
      supported: true,
      interpretation: `${cmd} is supported: the server accepted and acted on it (code ${codeNum}). Presence of ${cmd} narrows the implementation — compare against the SITE command map.`,
      serverHint: 'Extension present; combine with banner analysis for identification.',
    };
  }
  if (codeNum === 500) {
    const hint = /unknown|unrecognized|not understood/i.test(msg)
      ? 'The command syntax itself is rejected.'
      : 'The command is rejected (syntax or context).';
    return {
      supported: false,
      interpretation: `500 on ${cmd}: ${hint} Either the sub-command is unsupported or it was issued out of sequence. Message: "${msg}".`,
      serverHint: 'Unsupported SITE sub-command; the absence also fingerprints (e.g. no SITE ZONE rules out IIS-style behavior).',
    };
  }
  if (codeNum === 502) {
    return {
      supported: false,
      interpretation: `502 on ${cmd}: command recognized but not implemented. The server knows ${cmd} exists yet refuses it — characteristic of servers advertising SITE HELP entries they gate behind privileges. Message: "${msg}".`,
      serverHint: 'Recognized-but-unimplemented SITE sub-command narrows the family.',
    };
  }
  if (codeNum >= 400 && codeNum < 600) {
    return {
      supported: false,
      interpretation: `${codeNum} on ${cmd}: negative reply — command not usable in this context. Message: "${msg}".`,
      serverHint: 'Negative SITE reply; treat as unsupported for this session.',
    };
  }
  return {
    supported: false,
    interpretation: `Code ${codeNum} on ${cmd} is inconclusive; not a standard SITE outcome. Message: "${msg}".`,
    serverHint: 'Unusual reply code; capture full transcript for manual review.',
  };
}

export const FTP_SITE_COMMAND_ANALYZER = {
  analyzeSiteHelp,
  analyzeSiteResponse,
  SITE_COMMAND_MAP,
};

export default FTP_SITE_COMMAND_ANALYZER;
