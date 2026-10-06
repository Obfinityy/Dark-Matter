/**
 * dhcpOptionFingerprinter.js — DHCP fingerprinting via option ordering (idea 00524).
 *
 * Defensive fingerprinting for an authorized bug-bounty agent. DHCP clients
 * announce a Parameter Request List (option 55) — an ordered list of the
 * option codes they want — plus vendor class (option 60), hostname (option
 * 12), and client identifier (option 61). The exact option ordering, vendor
 * string, and requested set form a fingerprint that identifies the DHCP
 * client OS/stack (Windows, macOS, Linux dhclient, Android, iOS, embedded
 * devices). Likewise, DHCP servers have recognizable option sets, lease
 * times, and option order in OFFER/ACK messages (ISC dhcpd, dnsmasq,
 * Windows Server DHCP, router firmware).
 *
 * Pure analyzer: the caller supplies parsed DHCP message metadata (from
 * tcpdump/dhcpdump logs, Kea/ISC lease logs, or pcap field summaries).
 * This module never sends DHCP packets itself.
 */

/** Known client fingerprints: option-55 order + vendor-class fragments. */
export const DHCP_CLIENT_FINGERPRINTS = [
  {
    name: 'Windows 10/11',
    vendorRe: /MSFT 5\.0/i,
    paramRequestList: [1, 15, 3, 6, 44, 46, 47, 31, 33, 121, 249, 43],
    match: 'exact-order',
  },
  {
    name: 'Windows 7/8',
    vendorRe: /MSFT 5\.0/i,
    paramRequestList: [1, 15, 3, 6, 44, 46, 47, 31, 33, 121, 249, 43],
    match: 'exact-order',
  },
  {
    name: 'macOS / iOS',
    vendorRe: null,
    paramRequestList: [1, 3, 6, 15, 119, 252, 95, 44, 46],
    match: 'subset',
  },
  {
    name: 'ISC dhclient (Linux)',
    vendorRe: null,
    paramRequestList: [1, 28, 2, 3, 15, 6, 119, 12, 44, 47, 26, 121, 42],
    match: 'subset',
  },
  {
    name: 'Android',
    vendorRe: /android/i,
    paramRequestList: [1, 3, 6, 15, 26, 28, 51, 58, 59],
    match: 'subset',
  },
  {
    name: 'systemd-networkd',
    vendorRe: null,
    paramRequestList: [1, 3, 6, 15, 51, 54, 58, 59, 119],
    match: 'subset',
  },
];

/** Known server fingerprints from OFFER/ACK option sets. */
export const DHCP_SERVER_FINGERPRINTS = [
  { name: 'ISC dhcpd', markers: ['option 51 (lease time) present', 'server-id option 54'], vendorRe: null },
  { name: 'dnsmasq', markers: ['compact option set', 'option 51 + 58 + 59 typical'], vendorRe: null },
  { name: 'Windows Server DHCP', markers: ['MSFT vendor options', 'option 43 vendor-encapsulated'], vendorRe: /MSFT/i },
  { name: 'Kea DHCP', markers: ['option 51', 'option 54'], vendorRe: null },
  { name: 'Cisco IOS DHCP', markers: ['option 51', 'option 1', 'option 3', 'option 6'], vendorRe: /cisco/i },
];

/**
 * Compare two option sequences as an ordered-subsequence match.
 * @param {number[]} observed
 * @param {number[]} pattern
 * @returns {number} fraction of pattern present in observed in order (0–1)
 */
export function optionOrderScore(observed = [], pattern = []) {
  if (!pattern.length) return 0;
  let pi = 0;
  for (const code of observed) {
    if (pi < pattern.length && code === pattern[pi]) pi++;
  }
  return pi / pattern.length;
}

/**
 * Fingerprint a DHCP client from a DISCOVER/REQUEST message.
 * @param {{paramRequestList?: number[], vendorClass?: string, hostname?: string, clientId?: string, messageType?: string}} message
 * @returns {{type: string, confidence: 'high'|'medium'|'low', clientGuess: string|null, score: number, evidence: string, paramRequestList: number[]}}
 */
export function fingerprintDhcpClient(message = {}) {
  const prl = Array.isArray(message.paramRequestList) ? message.paramRequestList : [];
  const vendor = String(message.vendorClass || '');
  let best = null;
  let bestScore = 0;

  for (const fp of DHCP_CLIENT_FINGERPRINTS) {
    let score = optionOrderScore(prl, fp.paramRequestList);
    if (fp.vendorRe && fp.vendorRe.test(vendor)) score = Math.min(1, score + 0.25);
    if (fp.match === 'exact-order' && score === 1 && JSON.stringify(prl) !== JSON.stringify(fp.paramRequestList)) score = 0.9;
    if (score > bestScore) { bestScore = score; best = fp; }
  }

  const confidence = bestScore >= 0.95 ? 'high' : bestScore >= 0.6 ? 'medium' : 'low';
  const evidence = [
    `Parameter Request List (opt 55): [${prl.join(', ')}]`,
    vendor ? `Vendor class (opt 60): "${vendor}"` : 'no vendor class (opt 60)',
    message.hostname ? `Hostname (opt 12): "${message.hostname}"` : 'no hostname (opt 12)',
    best ? `best match: ${best.name} (order score ${bestScore.toFixed(2)})` : 'no known client fingerprint matched',
  ].join('; ');

  return {
    type: 'DHCP Client Fingerprinting',
    confidence: best ? confidence : 'low',
    clientGuess: best && bestScore >= 0.6 ? best.name : null,
    score: Number(bestScore.toFixed(2)),
    evidence,
    paramRequestList: prl,
  };
}

/**
 * Fingerprint a DHCP server from an OFFER/ACK message.
 * @param {{options?: number[], vendorClass?: string, serverId?: string, leaseTime?: number, messageType?: string}} message
 * @returns {{type: string, confidence: 'high'|'medium'|'low', serverGuess: string|null, evidence: string, markers: string[]}}
 */
export function fingerprintDhcpServer(message = {}) {
  const options = Array.isArray(message.options) ? message.options : [];
  const vendor = String(message.vendorClass || '');
  const markers = [];
  if (options.includes(51)) markers.push('option 51 (lease time)');
  if (options.includes(54)) markers.push('option 54 (server identifier)');
  if (options.includes(58)) markers.push('option 58 (renewal time)');
  if (options.includes(59)) markers.push('option 59 (rebinding time)');
  if (options.includes(43)) markers.push('option 43 (vendor-encapsulated)');
  if (vendor) markers.push(`vendor class: "${vendor}"`);

  let serverGuess = null;
  if (/MSFT/i.test(vendor) || options.includes(43)) serverGuess = 'Windows Server DHCP';
  else if (/cisco/i.test(vendor)) serverGuess = 'Cisco IOS DHCP';
  else if (options.includes(51) && options.includes(54) && options.length <= 6) serverGuess = 'dnsmasq';
  else if (options.includes(51) && options.includes(54)) serverGuess = 'ISC dhcpd / Kea DHCP';

  return {
    type: 'DHCP Server Fingerprinting',
    confidence: serverGuess ? 'medium' : 'low',
    serverGuess,
    evidence: markers.length
      ? `OFFER/ACK carried options [${options.join(', ')}]; ${markers.join('; ')}${message.serverId ? `; server-id ${message.serverId}` : ''}${message.leaseTime ? `; lease ${message.leaseTime}s` : ''}`
      : 'No options observed in server message.',
    markers,
  };
}
