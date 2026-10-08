/**
 * ircVersionDetector.js — IRC server version detector (idea 00516).
 *
 * Identifies IRC server software and version families from numeric 004
 * (RPL_MYINFO), 005 (RPL_ISUPPORT), VERSION replies and raw numeric
 * banners. Pure analyzer over observed data; defensive, authorized
 * bug-bounty use — version identification only, no exploitation.
 */

const DAEMON_SIGNATURES = [
  {
    name: 'UnrealIRCd',
    re: /unrealircd|unreal/i,
    versionRe: /Unreal(\d+|IRCd)/i,
    confidence: 0.95,
  },
  { name: 'InspIRCd', re: /inspircd/i, confidence: 0.95 },
  { name: 'ircd-hybrid', re: /ircd-hybrid|hybrid/i, confidence: 0.9 },
  { name: 'ircd-seven (Libera)', re: /ircd-seven/i, confidence: 0.9 },
  { name: 'Solanum', re: /solanum/i, confidence: 0.9 },
  { name: 'Charybdis', re: /charybdis/i, confidence: 0.9 },
  { name: 'Bahamut (DALnet)', re: /bahamut/i, confidence: 0.9 },
  { name: 'ngircd', re: /ngircd/i, confidence: 0.9 },
  { name: 'Ergo', re: /ergo/i, confidence: 0.85 },
  { name: 'ircd-ratbox', re: /ratbox/i, confidence: 0.85 },
];

const EOL_VERSION_HINTS = [
  { re: /unreal3\.2/i, note: 'UnrealIRCd 3.2 line is long end-of-life' },
  { re: /inspircd 1\./i, note: 'InspIRCd 1.x line is end-of-life' },
  { re: /ircd-hybrid 7/i, note: 'ircd-hybrid 7.x is an older branch' },
];

/**
 * Parse IRC numeric 004/005/351 lines into structured fields.
 * @param {string[]} lines raw IRC protocol lines
 * @returns {{myinfo: object|null, isupport: Record<string,string>, version351: object|null}}
 */
export function parseIrcNumerics(lines = []) {
  let myinfo = null;
  const isupport = {};
  let version351 = null;

  for (const raw of lines) {
    const line = String(raw).trim();
    let m = line.match(/:\S+\s+004\s+\S+\s+(\S+)\s+(\S+)\s+(\S+)\s+(.*)/);
    if (m) {
      myinfo = { server: m[1], version: m[2], userModes: m[3], chanModes: m[4] };
      continue;
    }
    m = line.match(/:\S+\s+005\s+\S+\s+(.*?)\s+:are supported by this server/i);
    if (m) {
      for (const tok of m[1].split(/\s+/)) {
        const [k, v] = tok.split('=');
        if (k) isupport[k.toUpperCase()] = v === undefined ? true : v;
      }
      continue;
    }
    m = line.match(/:\S+\s+351\s+\S+\s+(\S+)\s+(\S+)\s+(\S+)\s+:(.*)/);
    if (m) {
      version351 = { version: m[1], server: m[2], flags: m[3], comments: m[4] };
    }
  }

  return { myinfo, isupport, version351 };
}

/**
 * Detect IRC daemon and version family from numerics and raw banner.
 * @param {{myinfo: object|null, isupport: Record<string,string>, version351: object|null}} numerics
 * @param {string} [raw='']
 * @returns {{daemon: string|null, version: string|null, confidence: number, eolFlags: string[], isupportCount: number}}
 */
export function detectIrcDaemon(numerics = {}, raw = '') {
  const text = [
    numerics.myinfo ? `${numerics.myinfo.server} ${numerics.myinfo.version}` : '',
    numerics.version351 ? `${numerics.version351.version} ${numerics.version351.comments}` : '',
    String(raw),
  ].join(' ');

  let daemon = null;
  let confidence = 0;
  for (const sig of DAEMON_SIGNATURES) {
    if (sig.re.test(text)) {
      daemon = sig.name;
      confidence = sig.confidence;
      break;
    }
  }

  const version = numerics.version351
    ? numerics.version351.version
    : numerics.myinfo
      ? numerics.myinfo.version
      : null;

  const eolFlags = EOL_VERSION_HINTS.filter(h => h.re.test(text)).map(h => h.note);

  return {
    daemon,
    version,
    confidence,
    eolFlags,
    isupportCount: Object.keys(numerics.isupport || {}).length,
  };
}

export const IRC_VERSION_DETECTOR = {
  parseIrcNumerics,
  detectIrcDaemon,
};

export default IRC_VERSION_DETECTOR;
