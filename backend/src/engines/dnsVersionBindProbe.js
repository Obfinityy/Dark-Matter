/**
 * dnsVersionBindProbe.js — DNS version.bind chaos-record prober (idea 00519).
 *
 * Analyzes responses to `version.bind` TXT queries in the CH (chaos) class
 * to fingerprint DNS server software (BIND, NSD, Knot, PowerDNS, Unbound,
 * Microsoft DNS, …). Pure analyzer over observed response text; defensive,
 * authorized bug-bounty use — version identification only.
 */

const SERVER_SIGNATURES = [
  { name: 'ISC BIND', re: /^(9\.\d+)/i, confidence: 0.9 },
  { name: 'NSD', re: /^nsd\s/i, confidence: 0.9 },
  { name: 'Knot DNS', re: /^knot/i, confidence: 0.95 },
  { name: 'PowerDNS', re: /^pdns|powerdns/i, confidence: 0.95 },
  { name: 'Unbound', re: /^unbound/i, confidence: 0.95 },
  { name: 'dnsmasq', re: /^dnsmasq/i, confidence: 0.9 },
  { name: 'Microsoft DNS', re: /^microsoft dns/i, confidence: 0.9 },
  { name: 'CoreDNS', re: /^coredns/i, confidence: 0.9 },
  { name: 'Google Public DNS', re: /^google/i, confidence: 0.7 },
];

const HOSTNAME_BINS = [
  { name: 'hostname.bind', cls: 'CH', type: 'TXT' },
  { name: 'id.server', cls: 'CH', type: 'TXT' },
  { name: 'version.server', cls: 'CH', type: 'TXT' },
];

/**
 * Fingerprint DNS software from a version.bind TXT answer.
 * @param {string} txt raw TXT answer (without quotes)
 * @returns {{software: string|null, version: string|null, confidence: number, eolSuspect: boolean}}
 */
export function fingerprintDnsSoftware(txt = '') {
  const answer = String(txt).replace(/^"|"$/g, '').trim();
  if (!answer || /^(unknown|none|n\/a|\(none\))$/i.test(answer)) {
    return { software: null, version: null, confidence: 0, eolSuspect: false };
  }

  for (const sig of SERVER_SIGNATURES) {
    if (sig.re.test(answer)) {
      const version = (answer.match(/(\d+\.\d+(?:\.\d+)?(?:-S\d+)?)/) || [])[1] || null;
      return {
        software: sig.name,
        version,
        confidence: sig.confidence,
        eolSuspect: isEolSuspect(sig.name, version),
      };
    }
  }

  return { software: 'Unknown (custom string)', version: answer, confidence: 0.3, eolSuspect: false };
}

/**
 * Heuristic check for versions that look long out of date.
 * @param {string|null} software
 * @param {string|null} version
 * @returns {boolean}
 */
export function isEolSuspect(software, version) {
  if (!software || !version) return false;
  const major = Number(String(version).split('.')[0]);
  if (software === 'ISC BIND') return major <= 8;
  if (software === 'dnsmasq') return major <= 2;
  return false;
}

/**
 * Score how much the version disclosure matters for the assessment.
 * @param {{software: string|null, confidence: number}} fp
 * @param {boolean} [recursionOffered=false]
 * @returns {{disclosure: 'none'|'partial'|'full', score: number, note: string}}
 */
export function scoreVersionDisclosure(fp = {}, recursionOffered = false) {
  if (!fp.software) {
    return { disclosure: 'none', score: 90, note: 'version.bind refused or masked; good hygiene.' };
  }
  let score = 40;
  let note = `DNS software disclosed via version.bind: ${fp.software}.`;
  if (recursionOffered) {
    score -= 20;
    note += ' Server also offers recursion — confirm it is not an open resolver.';
  }
  return {
    disclosure: fp.confidence >= 0.7 ? 'full' : 'partial',
    score: Math.max(0, score),
    note,
  };
}

export { HOSTNAME_BINS };

export const DNS_VERSION_BIND_PROBE = {
  fingerprintDnsSoftware,
  isEolSuspect,
  scoreVersionDisclosure,
  HOSTNAME_BINS,
};

export default DNS_VERSION_BIND_PROBE;
