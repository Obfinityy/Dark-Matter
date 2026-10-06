/**
 * ntpMode6Analyzer.js — NTP mode-6 control-query analyzer (idea 00518).
 *
 * Interprets NTP mode-6 (control) query responses — used only where the
 * engagement scope explicitly permits — to identify NTP daemon versions
 * (ntpd, Chrony, NTS-capable builds) and flag exposed control surfaces
 * such as readable configuration variables or monlist-style amplification
 * primitives. Pure analyzer over observed response data; no packet crafting.
 */

const DAEMON_SIGNATURES = [
  { name: 'ISC ntpd', re: /ntpd|ntpq:.*version/i, vars: ['version', 'processor', 'system'], confidence: 0.85 },
  { name: 'Chrony', re: /chrony|chronyd/i, vars: ['version', 'system'], confidence: 0.9 },
  { name: 'OpenNTPD', re: /openntpd/i, vars: ['version'], confidence: 0.9 },
  { name: 'NTPsec', re: /ntpsec/i, vars: ['version', 'processor'], confidence: 0.9 },
];

const SENSITIVE_VARS = new Set([
  'config', 'sysconfig', 'peer', 'association', 'monlist',
  'iostats', 'timerstats', 'authstats', 'ctlstats',
]);

/**
 * Parse a mode-6 control response body into variable map.
 * @param {string} body response body ("var=value" pairs, comma separated)
 * @returns {Record<string,string>}
 */
export function parseMode6Vars(body = '') {
  const vars = {};
  for (const part of String(body).split(',')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const key = part.slice(0, idx).trim().toLowerCase();
      if (key) vars[key] = part.slice(idx + 1).trim().replace(/^"|"$/g, '');
    }
  }
  return vars;
}

/**
 * Identify the NTP daemon from mode-6 variable data.
 * @param {Record<string,string>} vars
 * @returns {{daemon: string|null, version: string|null, confidence: number}}
 */
export function identifyNtpDaemon(vars = {}) {
  const haystack = Object.values(vars).join(' ');
  const version = vars.version || null;
  for (const sig of DAEMON_SIGNATURES) {
    if (sig.re.test(haystack) || sig.vars.some((v) => v in vars)) {
      return { daemon: sig.name, version, confidence: sig.confidence };
    }
  }
  return { daemon: version ? 'Unknown NTP daemon' : null, version, confidence: version ? 0.4 : 0 };
}

/**
 * Assess the exposure risk of a mode-6 response.
 * @param {Record<string,string>} vars
 * @returns {{risk: 'low'|'medium'|'high', exposed: string[], notes: string[]}}
 */
export function assessMode6Exposure(vars = {}) {
  const keys = Object.keys(vars).map((k) => k.toLowerCase());
  const exposed = keys.filter((k) => SENSITIVE_VARS.has(k));
  const notes = [];

  if (vars.monlist) notes.push('monlist data readable — historic amplification primitive; verify scope before querying further.');
  if (vars.config || vars.sysconfig) notes.push('Server configuration variables are readable by unauthenticated control queries.');
  if (vars.version) notes.push(`Version disclosed: ${vars.version}.`);

  const risk = exposed.length >= 3 ? 'high' : exposed.length > 0 ? 'medium' : 'low';
  return { risk, exposed, notes };
}

export const NTP_MODE6_ANALYZER = {
  parseMode6Vars,
  identifyNtpDaemon,
  assessMode6Exposure,
};

export default NTP_MODE6_ANALYZER;
