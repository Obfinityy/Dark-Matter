/**
 * sshVersionCataloger.js — SSH identification-string cataloger.
 *
 * Parses a captured SSH identification string (RFC 4253, section 4.2):
 *   SSH-<protoversion>-<softwareversion>[ SP <comments> CR LF ]
 * and maps the software token to a vendor / implementation family.
 *
 * Pure analysis of captured data only — no connections are made here.
 */

/**
 * Known SSH software tokens.
 *
 * Each entry: { token } matched as a case-insensitive prefix of the software
 * field; vendor/family are the human-readable catalog values.
 *
 * Signature table:
 * | token prefix          | vendor                      | family              |
 * |-----------------------|-----------------------------|---------------------|
 * | OpenSSH               | OpenBSD Project             | OpenSSH             |
 * | HPN                   | PSC / OpenSSH patch         | OpenSSH (HPN-SSH)   |
 * | Dropbear              | Matt Johnston               | Dropbear            |
 * | libssh                | libssh project              | libssh              |
 * | paramiko              | Paramiko project            | paramiko            |
 * | PuTTY                 | Simon Tatham                | PuTTY               |
 * | WinSCP                | Martin Prikryl              | WinSCP              |
 * | MobaSSH               | Mobatek                     | MobaXterm/MobaSSH   |
 * | Tectia / SSH Tectia   | SSH Communications Security | Tectia              |
 * | Vandyke VShell        | VanDyke Software            | VShell              |
 * | Bitvise / WinSSHD     | Bitvise Limited             | Bitvise             |
 * | FlowSsh               | Bitvise Limited             | FlowSsh (library)   |
 * | WeOnlyDo              | WeOnlyDo Software           | WeOnlyDo (freeSSHd) |
 * | Cisco-                | Cisco Systems               | Cisco IOS/ASA       |
 * | ROSSSH                | MikroTik                    | RouterOS            |
 * | Huawei                | Huawei                      | VRP                 |
 * | H3C                   | H3C / HP                    | Comware             |
 * | Fortinet / FortiOS    | Fortinet                    | FortiOS             |
 * | AsyncOS               | Cisco Systems               | AsyncOS (ESA/WSA)   |
 * | NETSCREEN             | Juniper Networks            | ScreenOS            |
 * | RomSShell             | Allegro Software            | RomSShell (embedded)|
 * | GlobalScape / sshlib  | GlobalScape (HelpSystems)   | CuteFTP/EFT         |
 * | Serv-U                | SolarWinds                  | Serv-U              |
 * | Titan                 | South River Technologies    | Titan FTP           |
 * | CerberusFTP           | Cerberus LLC                | Cerberus FTP        |
 * | CrushFTP              | CrushFTP                    | CrushFTP            |
 * | JSCAPE                | Redwood Software            | JSCAPE MFT          |
 * | Sysax                 | Codeorigin                  | Sysax Multi Server  |
 * | Xlight                | Xlight Network              | Xlight FTP          |
 * | CoreFTP               | CoreFTP                     | Core FTP Server     |
 * | IP*Works / IpSsh      | /n software                 | IP*Works! SSH       |
 * | cryptlib              | Peter Gutmann               | cryptlib            |
 * | PGP                   | Symantec / PGP Corp         | PGP                 |
 * | wolfSSH               | wolfSSL                     | wolfSSH             |
 * | JSch                  | JCraft                      | JSch (library)      |
 * | libssh2               | libssh2 project             | libssh2             |
 * | Sun_SSH / SunSSH      | Oracle                      | SunSSH (Solaris)    |
 * | cowrie / Kippo        | Honeypot (deception)        | Honeypot            |
 */
const SOFTWARE_CATALOG = [
  { token: 'OpenSSH', vendor: 'OpenBSD Project', family: 'OpenSSH', confidence: 'high' },
  {
    token: 'HPN',
    vendor: 'Pittsburgh Supercomputing Center (OpenSSH patch)',
    family: 'OpenSSH (HPN-SSH)',
    confidence: 'medium',
  },
  { token: 'Dropbear', vendor: 'Matt Johnston', family: 'Dropbear', confidence: 'high' },
  { token: 'libssh', vendor: 'libssh project', family: 'libssh', confidence: 'high' },
  { token: 'paramiko', vendor: 'Paramiko project', family: 'paramiko', confidence: 'high' },
  { token: 'PuTTY', vendor: 'Simon Tatham', family: 'PuTTY', confidence: 'high' },
  { token: 'WinSCP', vendor: 'Martin Prikryl', family: 'WinSCP', confidence: 'high' },
  { token: 'MobaSSH', vendor: 'Mobatek', family: 'MobaXterm/MobaSSH', confidence: 'high' },
  {
    token: 'Tectia',
    vendor: 'SSH Communications Security',
    family: 'Tectia Server',
    confidence: 'high',
  },
  {
    token: 'SSH Secure Shell',
    vendor: 'SSH Communications Security',
    family: 'Tectia Server',
    confidence: 'medium',
  },
  { token: 'VShell', vendor: 'VanDyke Software', family: 'VShell', confidence: 'high' },
  { token: 'Bitvise', vendor: 'Bitvise Limited', family: 'Bitvise SSH Server', confidence: 'high' },
  { token: 'WinSSHD', vendor: 'Bitvise Limited', family: 'Bitvise SSH Server', confidence: 'high' },
  { token: 'FlowSsh', vendor: 'Bitvise Limited', family: 'FlowSsh (library)', confidence: 'high' },
  {
    token: 'WeOnlyDo',
    vendor: 'WeOnlyDo Software',
    family: 'WeOnlyDo (freeSSHd)',
    confidence: 'high',
  },
  { token: 'Cisco-', vendor: 'Cisco Systems', family: 'Cisco IOS / ASA', confidence: 'high' },
  { token: 'ROSSSH', vendor: 'MikroTik', family: 'RouterOS', confidence: 'high' },
  { token: 'Huawei', vendor: 'Huawei', family: 'VRP', confidence: 'high' },
  { token: 'H3C', vendor: 'H3C / HP', family: 'Comware', confidence: 'high' },
  { token: 'FortiOS', vendor: 'Fortinet', family: 'FortiOS', confidence: 'high' },
  { token: 'Fortinet', vendor: 'Fortinet', family: 'FortiOS', confidence: 'medium' },
  { token: 'AsyncOS', vendor: 'Cisco Systems', family: 'AsyncOS (ESA/WSA)', confidence: 'high' },
  { token: 'NETSCREEN', vendor: 'Juniper Networks', family: 'ScreenOS', confidence: 'high' },
  {
    token: 'RomSShell',
    vendor: 'Allegro Software (OEM)',
    family: 'RomSShell (embedded)',
    confidence: 'medium',
  },
  {
    token: 'GlobalScape',
    vendor: 'GlobalScape (HelpSystems)',
    family: 'CuteFTP / EFT',
    confidence: 'high',
  },
  {
    token: 'sshlib',
    vendor: 'GlobalScape (HelpSystems)',
    family: 'CuteFTP / EFT (sshlib)',
    confidence: 'medium',
  },
  { token: 'Serv-U', vendor: 'SolarWinds', family: 'Serv-U', confidence: 'high' },
  { token: 'Titan', vendor: 'South River Technologies', family: 'Titan FTP', confidence: 'high' },
  { token: 'CerberusFTP', vendor: 'Cerberus LLC', family: 'Cerberus FTP', confidence: 'high' },
  { token: 'CrushFTP', vendor: 'CrushFTP', family: 'CrushFTP', confidence: 'high' },
  { token: 'JSCAPE', vendor: 'Redwood Software', family: 'JSCAPE MFT', confidence: 'high' },
  { token: 'Sysax', vendor: 'Codeorigin', family: 'Sysax Multi Server', confidence: 'high' },
  { token: 'Xlight', vendor: 'Xlight Network', family: 'Xlight FTP', confidence: 'high' },
  { token: 'CoreFTP', vendor: 'CoreFTP', family: 'Core FTP Server', confidence: 'high' },
  { token: 'IP*Works', vendor: '/n software', family: 'IP*Works! SSH', confidence: 'high' },
  { token: 'IpSsh', vendor: '/n software', family: 'IP*Works! SSH', confidence: 'medium' },
  { token: 'cryptlib', vendor: 'Peter Gutmann', family: 'cryptlib', confidence: 'high' },
  { token: 'PGP', vendor: 'Symantec / PGP Corporation', family: 'PGP', confidence: 'medium' },
  { token: 'wolfSSH', vendor: 'wolfSSL', family: 'wolfSSH', confidence: 'high' },
  { token: 'JSch', vendor: 'JCraft', family: 'JSch (library)', confidence: 'high' },
  { token: 'Sun_SSH', vendor: 'Oracle', family: 'SunSSH (Solaris)', confidence: 'high' },
  { token: 'SunSSH', vendor: 'Oracle', family: 'SunSSH (Solaris)', confidence: 'high' },
  {
    token: 'cowrie',
    vendor: 'Honeypot (deception)',
    family: 'Cowrie honeypot',
    confidence: 'high',
  },
  { token: 'Kippo', vendor: 'Honeypot (deception)', family: 'Kippo honeypot', confidence: 'high' },
  {
    token: 'HonSSH',
    vendor: 'Honeypot (deception)',
    family: 'HonSSH honeypot',
    confidence: 'medium',
  },
];

const HONEYPOT_TOKENS = ['cowrie', 'kippo', 'honssh', 'honeypot', 'deception'];

/**
 * Parse an SSH identification string per RFC 4253 section 4.2.
 *
 * Grammar: SSH-<protoversion>-<softwareversion>[ SP <comments> ]
 *
 * @param {string} str — raw identification string (CR/LF trimmed internally).
 * @returns {{ raw: string, proto: string|null, software: string|null, version: string|null, comment: string|null, valid: boolean }}
 */
export function parseVersionString(str = '') {
  const raw = String(str || '').replace(/[\r\n]+$/, '');
  const match = /^SSH-([^-]+)-([^\s]*)(?:\s+(.*))?$/.exec(raw);
  if (!match) {
    return { raw, proto: null, software: null, version: null, comment: null, valid: false };
  }
  const [, proto, softwareToken, comment] = match;
  // Split software token into name + version at the first digit boundary,
  // e.g. "OpenSSH_9.6p1" -> name "OpenSSH", version "9.6p1". A token that
  // starts with digits (e.g. "1.36_sshlib") keeps the whole token as the
  // software name so the vendor can still be matched via the comment field.
  let software = softwareToken;
  let version = null;
  const digitIdx = softwareToken.search(/\d/);
  if (digitIdx > 0) {
    software = softwareToken
      .slice(0, digitIdx)
      .replace(/[_-]+$/, '')
      .replace(/[_-]?release$/i, '');
    version = softwareToken.slice(digitIdx);
    if (!software) software = softwareToken;
  }
  return {
    raw,
    proto,
    software: software || null,
    version,
    comment: comment ? comment.trim() : null,
    valid: true,
  };
}

/**
 * Catalog a parsed identification string against the software signature table.
 *
 * @param {{ proto: string, software: string, version: string|null, comment: string|null, valid: boolean }} parsed
 * @returns {{ software: string|null, version: string|null, vendor: string, family: string, confidence: 'high'|'medium'|'low', evidence: string }}
 */
export function catalogImplementation(parsed = {}) {
  if (!parsed || !parsed.valid) {
    return {
      software: parsed?.software ?? null,
      version: parsed?.version ?? null,
      vendor: 'Unknown',
      family: 'Unknown',
      confidence: 'low',
      evidence: 'Identification string did not parse — no catalog entry could be matched.',
    };
  }
  const haystack = `${parsed.software || ''} ${parsed.comment || ''}`;
  for (const entry of SOFTWARE_CATALOG) {
    if (haystack.toLowerCase().includes(entry.token.toLowerCase())) {
      return {
        software: parsed.software,
        version: parsed.version,
        vendor: entry.vendor,
        family: entry.family,
        confidence: entry.confidence,
        evidence: `Software token "${parsed.software}"${parsed.version ? ` version "${parsed.version}"` : ''} matched catalog entry "${entry.token}" (${entry.family}).`,
      };
    }
  }
  return {
    software: parsed.software,
    version: parsed.version,
    vendor: 'Unknown',
    family: 'Unknown',
    confidence: 'low',
    evidence: `Software token "${parsed.software}" matched no catalog entry — uncommon or custom build.`,
  };
}

/**
 * Flag anomalies in an SSH identification string.
 *
 * Detects: malformed strings, legacy protocol markers (SSH-1.99 / SSH-1.5),
 * honeypot-like tokens, missing software version, overlong strings
 * (RFC 4253 caps the line at 255 bytes), and non-printable characters.
 *
 * @param {string} str
 * @returns {string[]} anomaly notes; empty when nothing looks off.
 */
export function flagAnomalies(str = '') {
  const notes = [];
  const raw = String(str || '');
  if (!raw.trim()) {
    notes.push('Empty identification string — server sent nothing on connect.');
    return notes;
  }
  const parsed = parseVersionString(raw);
  if (!parsed.valid) {
    notes.push(
      `Malformed identification string: "${raw.slice(0, 80)}" does not match SSH-<proto>-<software> grammar.`
    );
    return notes;
  }
  if (parsed.proto === '1.99') {
    notes.push(
      'Protocol "1.99" advertised — server claims both SSH-1 and SSH-2 compatibility; SSH-1 support is a legacy weakness.'
    );
  } else if (/^1\./.test(parsed.proto)) {
    notes.push(`Protocol "${parsed.proto}" advertised — SSH-1-only server; critically outdated.`);
  } else if (parsed.proto !== '2.0') {
    notes.push(
      `Unexpected protocol version "${parsed.proto}" — expected "2.0" (or "1.99" for dual-stack).`
    );
  }
  const lowered = raw.toLowerCase();
  for (const token of HONEYPOT_TOKENS) {
    if (lowered.includes(token)) {
      notes.push(
        `Honeypot-like token "${token}" present in identification string — treat as deception infrastructure, not a real target.`
      );
      break;
    }
  }
  if (!parsed.software) {
    notes.push('Software token is empty — non-standard server that hides its implementation.');
  } else if (!parsed.version) {
    notes.push(
      `Software "${parsed.software}" advertises no version — version-stripped banner (hardened or evasive).`
    );
  }
  if (raw.length > 255) {
    notes.push(
      `Identification string is ${raw.length} bytes — exceeds the RFC 4253 255-byte limit.`
    );
  }
  if (/[^\x20-\x7e\r\n]/.test(raw)) {
    notes.push(
      'Identification string contains non-printable characters — possible banner-spoofing or encoding anomaly.'
    );
  }
  return notes;
}

export const SSH_VERSION_CATALOGER = { parseVersionString, catalogImplementation, flagAnomalies };
export default SSH_VERSION_CATALOGER;
