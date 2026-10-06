/**
 * tftpOptionNegotiator.js — TFTP option-negotiation testing analyzer (idea 00525).
 *
 * Defensive fingerprinting for an authorized bug-bounty agent. TFTP (RFC
 * 1350) is minimal, but the option-negotiation extension (RFC 2347–2349)
 * lets a client request `blksize`, `timeout`, and `tsize` in the RRQ/WRQ;
 * the server answers with an OACK listing the options it accepts, echoing
 * negotiated values. Which options a server honors — and how it values
 * them (clamped blksize, accepted timeout, tsize of an existing file) —
 * fingerprints the implementation: atftpd, tftpd-hpa, Cisco IOS TFTP,
 * Windows TFTP service, embedded PXE/boot firmware. Notably, an exposed
 * TFTP service that negotiates `tsize` on arbitrary reads is a data-exfil
 * path worth flagging in the authorized assessment.
 *
 * Pure analyzer: the caller supplies the parsed option exchange (from
 * tftp logs or pcap field summaries). This module never sends TFTP
 * packets itself.
 */

/** Well-known TFTP options (RFC 2347–2349). */
export const TFTP_OPTIONS = {
  blksize: { description: 'Transfer block size', securityNote: 'large negotiated blksize speeds exfiltration' },
  timeout: { description: 'Retransmission timeout (seconds)', securityNote: 'accepted values reveal stack patience' },
  tsize: { description: 'Transfer size (bytes)', securityNote: 'tsize on arbitrary file reads leaks file existence/size' },
};

/** Implementation profiles keyed by observed negotiation behavior. */
export const TFTP_SERVER_PROFILES = [
  {
    name: 'tftpd-hpa',
    behavior: 'accepts blksize up to 65464, echoes tsize=0 for writes, timeout accepted 1–255',
  },
  {
    name: 'atftpd',
    behavior: 'accepts blksize and tsize, supports multicast options (RFC 2090)',
  },
  {
    name: 'Cisco IOS TFTP server',
    behavior: 'typically rejects blksize > 8192, tsize echoed only for flash: reads',
  },
  {
    name: 'Windows TFTP service',
    behavior: 'limited option support; often answers ERROR instead of OACK for unknown options',
  },
  {
    name: 'Embedded / PXE firmware',
    behavior: 'often no OACK at all (options ignored, plain DATA reply) — blksize forced to 512',
  },
];

/**
 * Parse a TFTP OACK / ERROR exchange into a negotiation outcome.
 * @param {{requested: Record<string, string|number>, response: {type: 'OACK'|'ERROR'|'DATA', options?: Record<string, string|number>, errorCode?: number, errorMessage?: string}}} exchange
 * @returns {{acceptedOptions: string[], rejectedOptions: string[], negotiated: Record<string, string>, refused: boolean, evidence: string}}
 */
export function analyzeTftpNegotiation(exchange = {}) {
  const requested = exchange.requested || {};
  const response = exchange.response || {};
  const requestedKeys = Object.keys(requested).map((k) => k.toLowerCase());
  const acceptedOptions = [];
  const rejectedOptions = [];
  const negotiated = {};

  if (response.type === 'OACK') {
    const acked = Object.fromEntries(Object.entries(response.options || {}).map(([k, v]) => [k.toLowerCase(), String(v)]));
    for (const key of requestedKeys) {
      if (key in acked) {
        acceptedOptions.push(key);
        negotiated[key] = acked[key];
      } else {
        rejectedOptions.push(key);
      }
    }
  } else if (response.type === 'ERROR') {
    // Server refused option negotiation outright.
    rejectedOptions.push(...requestedKeys);
  }
  // DATA response type: server ignored options silently (legacy behavior).

  const refused = response.type === 'ERROR';
  const evidence = `Requested [${requestedKeys.join(', ')}]; server answered ${response.type}`
    + (response.type === 'OACK' ? `, accepted [${acceptedOptions.join(', ') || 'none'}], rejected [${rejectedOptions.join(', ') || 'none'}], values ${JSON.stringify(negotiated)}`
      : response.type === 'ERROR' ? ` — negotiation refused (code ${response.errorCode ?? '?'}: ${response.errorMessage || 'no message'})`
        : ' — options ignored, plain data transfer (legacy server)');

  return { acceptedOptions, rejectedOptions, negotiated, refused, evidence };
}

/**
 * Fingerprint the TFTP server implementation from the negotiation outcome.
 * @param {{negotiation: ReturnType<typeof analyzeTftpNegotiation>, fileExists?: boolean}} input
 * @returns {{type: string, confidence: 'high'|'medium'|'low', serverGuess: string|null, exposureNotes: string[], evidence: string}}
 */
export function fingerprintTftpServer(input = {}) {
  const negotiation = input.negotiation || { acceptedOptions: [], rejectedOptions: [], negotiated: {}, refused: false, evidence: '' };
  const exposureNotes = [];

  // Security-relevant signal: tsize negotiated on a read reveals file size/existence.
  if (negotiation.acceptedOptions.includes('tsize')) {
    exposureNotes.push('tsize accepted — server discloses transfer size; on arbitrary filenames this is an oracle for file existence/size');
  }
  if (negotiation.acceptedOptions.includes('blksize') && Number(negotiation.negotiated.blksize) > 8192) {
    exposureNotes.push(`large blksize (${negotiation.negotiated.blksize}) accepted — fast bulk exfiltration path if reads are unauthenticated`);
  }
  if (negotiation.refused) {
    exposureNotes.push('option negotiation refused via ERROR — legacy or minimal stack');
  }

  // Implementation guessing from accepted-option patterns.
  let serverGuess = null;
  let confidence = 'low';
  const accepted = negotiation.acceptedOptions;
  if (accepted.includes('blksize') && accepted.includes('tsize') && accepted.includes('timeout')) {
    serverGuess = 'tftpd-hpa / atftpd class (full RFC 2347–2349 support)';
    confidence = 'medium';
  } else if (accepted.length === 0 && !negotiation.refused) {
    serverGuess = 'Embedded / PXE firmware (options silently ignored, 512-byte blocks)';
    confidence = 'medium';
  } else if (negotiation.refused) {
    serverGuess = 'Windows TFTP service or minimal stack (negotiation refused)';
    confidence = 'low';
  }

  return {
    type: 'TFTP Option-Negotiation Fingerprint',
    confidence,
    serverGuess,
    exposureNotes,
    evidence: negotiation.evidence + (exposureNotes.length ? `. Exposure notes: ${exposureNotes.join('; ')}` : ''),
  };
}
