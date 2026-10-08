/**
 * mobileconfigMiner.js — Apple mobileconfig profile host mining (idea 00120).
 *
 * Apple .mobileconfig profiles (configuration profiles / enrollment docs)
 * embed VPN, mail, CalDAV, Wi-Fi and MDM server hostnames. Organizations
 * sometimes publish them on web portals; parsing them maps that infra.
 *
 * mobileconfig files are signed/CMS-wrapped plists. This module parses the
 * underlying XML plist directly (unsigned or pre-decoded payload).
 */

const STRING_RE = /<string>([^<]*)<\/string>/gi;

function hostOf(value) {
  try {
    const u = new URL(String(value));
    if (u.protocol === 'https:' || u.protocol === 'http:') return u.hostname;
    return null;
  } catch {
    return null;
  }
}

// Hostname patterns that indicate a server hostname rather than prose.
const SERVER_KEY_HINTS = [
  'hostname',
  'servername',
  'serveraddress',
  'serverurl',
  'mdmserver',
  'vpnserver',
  'remoteaddress',
  'mailserver',
  'incomingmailserver',
  'outgoingmailserver',
  'caldavhostname',
  'carddavhostname',
  'principalurl',
  'serverhost',
  'exchangehostname',
  'ewsurl',
];

/**
 * Mine server hostnames from a mobileconfig plist body.
 * @param {string} plist — raw (unsigned/decoded) mobileconfig XML plist
 * @returns {{ valid: boolean, hosts: { kind, value, host }[], uniqueHosts: string[], notes: string[] }}
 */
export function parseMobileconfig(plist = '') {
  const notes = [];
  if (typeof plist !== 'string' || !/<plist\b/i.test(plist)) {
    return {
      valid: false,
      hosts: [],
      uniqueHosts: [],
      notes: ['Not an XML plist — signed/CMS-wrapped profiles must be decoded first'],
    };
  }

  const hosts = [];
  const unique = new Set();
  let m;
  while ((m = STRING_RE.exec(plist)) !== null) {
    const value = m[1].trim();
    if (!value) continue;
    const host = hostOf(value);
    if (!host) continue;

    // Find the nearest preceding <key> to classify the kind.
    const before = plist.slice(Math.max(0, m.index - 220), m.index);
    const keyMatch = /<key>([^<]+)<\/key>\s*$/.exec(before);
    const key = keyMatch ? keyMatch[1] : '';

    let kind = 'url';
    const lk = key.toLowerCase();
    if (lk.includes('mdm') || lk.includes('enroll')) kind = 'mdm';
    else if (lk.includes('vpn') || lk.includes('remoteaddress')) kind = 'vpn';
    else if (
      lk.includes('mail') ||
      lk.includes('imap') ||
      lk.includes('smtp') ||
      lk.includes('exchange') ||
      lk.includes('ews')
    )
      kind = 'mail';
    else if (lk.includes('caldav') || lk.includes('carddav')) kind = 'groupware';
    else if (SERVER_KEY_HINTS.some(h => lk.includes(h))) kind = 'server';
    else continue; // URL but not a server hostname — skip to avoid noise

    hosts.push({ kind, value, host });
    unique.add(host);
  }

  if (hosts.length === 0)
    notes.push(
      'Plist parsed but no server hostnames identified — profile may contain no server payloads'
    );
  if (unique.size > 0) {
    const kinds = [...new Set(hosts.map(h => h.kind))];
    notes.push(`Server host(s) by kind (${kinds.join(', ')}): ${[...unique].join(', ')}`);
  }

  return { valid: true, hosts, uniqueHosts: [...unique], notes };
}

export const MOBILECONFIG_MINER = { parseMobileconfig };
export default MOBILECONFIG_MINER;
