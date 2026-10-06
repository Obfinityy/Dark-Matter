/**
 * radiusStatusServerProbe.js — RADIUS status-server response analyzer.
 *
 * An authorized agent can send RADIUS Status-Server (code 12) requests to
 * discover a server's presence and version. This module analyzes the
 * observed response packet (code, identifier, attribute list) and reports
 * version disclosures — stale RADIUS versions (FreeRADIUS < 3.2.x,
 * Radiator, Cisco ACS) are bug-bounty-relevant findings.
 *
 * Defensive framing: passive analysis of banner/attribute data observed
 * during an authorized assessment. No payloads are generated here.
 */

/** Known RADIUS server fingerprints keyed by disclosed version strings. */
const RADIUS_VERSION_FINGERPRINTS = [
  { pattern: /freeradius/i, vendor: 'FreeRADIUS', severity: 'Low', note: 'FreeRADIUS discloses version in Reply-Message or via Status-Server vendor attributes.' },
  { pattern: /radiator/i, vendor: 'Radiator RADIUS', severity: 'Low', note: 'Radiator RADIUS discloses version strings in responses.' },
  { pattern: /steel-?belted/i, vendor: 'Steel-Belted RADIUS', severity: 'Low', note: 'Steel-Belted RADIUS (Juniper) discloses product identity.' },
  { pattern: /microsoft|nps|ias/i, vendor: 'Microsoft NPS/IAS', severity: 'Low', note: 'Microsoft Network Policy Server / IAS fingerprint via attributes.' },
  { pattern: /cisco/i, vendor: 'Cisco ISE/ACS', severity: 'Low', note: 'Cisco RADIUS server identity disclosed in response attributes.' },
  { pattern: /navisradius|interlink/i, vendor: 'NavisRADIUS', severity: 'Low', note: 'NavisRADIUS (Interlink) discloses version.' },
];

/**
 * Attribute type numbers commonly carrying textual disclosure data.
 * (Reply-Message=18, Error-Cause=101, vendor-specific strings.)
 */
const TEXT_ATTRIBUTE_TYPES = new Set([18, 101, 26]);

/**
 * Analyze an observed RADIUS response to a Status-Server probe.
 *
 * @param {Object} input
 * @param {number} input.code - RADIUS response code (2=Access-Accept, 3=Access-Reject, 11=Access-Challenge).
 * @param {string} [input.server] - Host observed responding.
 * @param {Array<{type:number|string,name?:string,value:string}>} [input.attributes] - Decoded response attributes.
 * @param {boolean} [input.statusServerSupported] - True if server answered Status-Server (code 12) at all.
 * @returns {Object} Finding describing server presence and version disclosure.
 */
export function analyzeStatusServerResponse({
  code = 0,
  server = '',
  attributes = [],
  statusServerSupported = false,
} = {}) {
  if (!statusServerSupported) {
    return {
      type: 'RADIUS Status-Server Probe',
      exposed: false,
      confidence: 'medium',
      evidence: `${server || 'target'} did not answer RADIUS Status-Server (code 12) — no version data obtainable.`,
    };
  }

  const codeMeaning = { 2: 'Access-Accept', 3: 'Access-Reject', 11: 'Access-Challenge' }[code] || `code ${code}`;
  const textAttributes = attributes.filter((a) =>
    TEXT_ATTRIBUTE_TYPES.has(typeof a.type === 'number' ? a.type : -1) || typeof a.value === 'string',
  );

  const disclosedVersions = [];
  for (const attr of textAttributes) {
    const value = String(attr.value || '');
    for (const fp of RADIUS_VERSION_FINGERPRINTS) {
      if (fp.pattern.test(value) && !disclosedVersions.some((d) => d.vendor === fp.vendor)) {
        disclosedVersions.push({
          vendor: fp.vendor,
          severity: fp.severity,
          attribute: attr.name || `attr-${attr.type}`,
          disclosure: value.slice(0, 120),
          note: fp.note,
        });
      }
    }
  }

  return {
    type: 'RADIUS Status-Server Probe',
    exposed: true,
    confidence: disclosedVersions.length ? 'high' : 'medium',
    evidence: `RADIUS server at ${server || 'target'} answered Status-Server with ${codeMeaning}; ${disclosedVersions.length} version disclosure(s) found in ${textAttributes.length} textual attribute(s).`,
    responseCode: code,
    codeMeaning,
    disclosedVersions,
    cwe: disclosedVersions.length ? 'CWE-200' : undefined,
  };
}

/**
 * Assess whether a disclosed RADIUS version is known-stale.
 * @param {string} disclosure - Version string disclosed by the server.
 * @returns {Object} Staleness assessment.
 */
export function assessVersionStaleness(disclosure = '') {
  const match = disclosure.match(/freeradius[\s-]*(\d+)\.(\d+)\.(\d+)/i);
  if (match) {
    const [, major, minor, patch] = match.map(Number);
    const stale = major < 3 || (major === 3 && minor < 2) || (major === 3 && minor === 2 && patch < 6);
    return {
      assessed: true,
      stale,
      confidence: 'medium',
      evidence: stale
        ? `Disclosed FreeRADIUS ${match[0].split(/[\s-]/).pop()} predates current stable — candidate for known CVEs.`
        : `Disclosed FreeRADIUS ${match[0].split(/[\s-]/).pop()} appears recent.`,
    };
  }
  return { assessed: false, reason: 'No parseable version number in disclosure.', confidence: 'low' };
}

export const RADIUS_STATUS_SERVER_PROBE = {
  analyzeStatusServerResponse,
  assessVersionStaleness,
  RADIUS_VERSION_FINGERPRINTS,
};
export default RADIUS_STATUS_SERVER_PROBE;
