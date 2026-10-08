/**
 * netbiosDatagramAnalyzer.js — NetBIOS datagram service analysis (idea 00530).
 *
 * Defensive fingerprinting for an authorized bug-bounty agent. The NetBIOS
 * datagram service (UDP 138) carries browser announcements, domain
 * announcements, and datagram-service error responses. Unlike the name
 * service (UDP 137, covered by netbiosNameIntel.js), datagram traffic
 * exposes OS hints: the browser election criteria and OS/major-minor
 * version fields in host announcements, the presence and cadence of
 * master-browser announcements, and — critically — which hosts answer a
 * datagram-service query with an error vs. silence. A datagram ERROR
 * response to a malformed destination name, or the announcement payload
 * of a host, leaks its Windows generation.
 *
 * Pure analyzer: the caller supplies parsed datagram-service observations
 * (decoded announcement fields, error-response records, or nbtstat-style
 * summaries). This module never sends NetBIOS packets itself.
 */

/** Browser election OS/major-minor version → Windows generation. */
export const NETBIOS_OS_HINTS = [
  { os: 0x10, major: 0x04, minor: 0x00, guess: 'Windows NT 4.0' },
  { os: 0x10, major: 0x05, minor: 0x00, guess: 'Windows 2000' },
  { os: 0x10, major: 0x05, minor: 0x01, guess: 'Windows XP / Server 2003' },
  { os: 0x10, major: 0x06, minor: 0x00, guess: 'Windows Vista / Server 2008' },
  { os: 0x10, major: 0x06, minor: 0x01, guess: 'Windows 7 / Server 2008 R2' },
  { os: 0x10, major: 0x06, minor: 0x02, guess: 'Windows 8 / Server 2012' },
  { os: 0x10, major: 0x06, minor: 0x03, guess: 'Windows 8.1 / Server 2012 R2' },
  { os: 0x10, major: 0x0a, minor: 0x00, guess: 'Windows 10 / Server 2016+' },
  { os: 0x20, major: null, minor: null, guess: 'Samba (OS field 0x20 = non-Windows)' },
];

/** Datagram service message types of interest. */
export const DATAGRAM_MESSAGE_TYPES = {
  0x10: 'DIRECT_UNIQUE datagram',
  0x11: 'DIRECT_GROUP datagram',
  0x12: 'BROADCAST datagram',
  0x13: 'DATAGRAM ERROR',
  0x14: 'DATAGRAM QUERY REQUEST',
  0x15: 'DATAGRAM POSITIVE QUERY RESPONSE',
  0x16: 'DATAGRAM NEGATIVE QUERY RESPONSE',
};

/**
 * Analyze one host announcement payload for OS hints.
 * @param {{host?: string, osVersion?: number, majorVersion?: number, minorVersion?: number, electionCriteria?: number, serverType?: number}} announcement
 * @returns {{osGuess: string|null, confidence: 'high'|'medium'|'low', evidence: string}}
 */
export function analyzeHostAnnouncement(announcement = {}) {
  const { osVersion, majorVersion, minorVersion } = announcement;
  const match = NETBIOS_OS_HINTS.find(
    h =>
      h.os === osVersion &&
      (h.major === null || h.major === majorVersion) &&
      (h.minor === null || h.minor === minorVersion)
  );
  const host = announcement.host ? `host "${announcement.host}"` : 'unnamed host';
  const fields = `OS=0x${(osVersion ?? 0).toString(16)}, major=${majorVersion ?? '?'}, minor=${minorVersion ?? '?'}`;
  return {
    osGuess: match ? match.guess : null,
    confidence: match ? 'medium' : 'low',
    evidence: match
      ? `${host} announcement (${fields}) suggests ${match.guess}`
      : `${host} announcement (${fields}) matches no known OS profile`,
  };
}

/**
 * Analyze a set of datagram-service observations for a host or segment.
 * @param {{announcements?: Array, errorResponses?: Array<{type: number, destinationName?: string}>, queryResponses?: Array<{type: number, name?: string}>}} input
 * @returns {{type: string, confidence: 'high'|'medium'|'low', osGuesses: string[], masterBrowserHints: string[], behaviorNotes: string[], evidence: string}}
 */
export function analyzeNetbiosDatagrams(input = {}) {
  const announcements = Array.isArray(input.announcements) ? input.announcements : [];
  const errorResponses = Array.isArray(input.errorResponses) ? input.errorResponses : [];
  const queryResponses = Array.isArray(input.queryResponses) ? input.queryResponses : [];

  const analyzed = announcements.map(analyzeHostAnnouncement);
  const osGuesses = [...new Set(analyzed.map(a => a.osGuess).filter(Boolean))];

  const masterBrowserHints = announcements
    .filter(a => (a.serverType & 0x00000004) !== 0 || /<1b>|<1d>/i.test(String(a.host || '')))
    .map(a => `${a.host || 'unknown'} announces as master/domain browser`);

  const behaviorNotes = [];
  const errors = errorResponses.filter(e => e.type === 0x13);
  if (errors.length) {
    behaviorNotes.push(
      `${errors.length} DATAGRAM ERROR response(s) — host processes datagram-service queries (destinations: ${[...new Set(errors.map(e => e.destinationName || '?'))].join(', ')})`
    );
  }
  const negatives = queryResponses.filter(q => q.type === 0x16);
  if (negatives.length) {
    behaviorNotes.push(
      `${negatives.length} negative query response(s) — datagram service is live and answering`
    );
  }
  if (!announcements.length && !errorResponses.length && !queryResponses.length) {
    behaviorNotes.push(
      'No datagram-service traffic observed — service may be firewalled or NetBIOS disabled'
    );
  }

  const confidence = osGuesses.length ? 'medium' : announcements.length ? 'low' : 'low';

  return {
    type: 'NetBIOS Datagram Service Analysis',
    confidence,
    osGuesses,
    masterBrowserHints,
    behaviorNotes,
    evidence: [
      analyzed.length ? analyzed.map(a => a.evidence).join('; ') : 'no host announcements parsed',
      ...behaviorNotes,
    ].join('. '),
  };
}
