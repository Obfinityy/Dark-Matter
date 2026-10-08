/**
 * udpServiceIdentifier.js — UDP service discovery via payload library.
 *
 * Matches captured UDP probe responses against a built-in protocol payload
 * library (DNS, NTP, SNMP, SSDP, mDNS, NetBIOS-NS, DHCP, STUN, memcached,
 * CoAP) to identify the service behind a UDP port without TCP. The module
 * consumes already-captured response payloads — it never sends probes.
 */

function hexToBytes(hex = '') {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '');
  const bytes = [];
  for (let i = 0; i + 1 < clean.length; i += 2) bytes.push(parseInt(clean.slice(i, i + 2), 16));
  return bytes;
}

/** Each matcher returns a confidence hint (0..1) or 0 for no match. */
const SIGNATURES = [
  {
    service: 'DNS',
    match(bytes) {
      if (bytes.length < 12) return 0;
      const flags = (bytes[2] << 8) | bytes[3];
      const qr = (flags & 0x8000) !== 0;
      const opcode = (flags >> 11) & 0xf;
      const qdcount = (bytes[4] << 8) | bytes[5];
      if (!qr || opcode > 2 || qdcount > 10) return 0;
      return qdcount > 0 ? 0.95 : 0.7;
    },
  },
  {
    service: 'NTP',
    match(bytes) {
      if (bytes.length < 48) return 0;
      const li = (bytes[0] >> 6) & 0x3;
      const mode = bytes[0] & 0x7;
      const stratum = bytes[1];
      if (mode !== 4 || li > 3 || stratum > 15) return 0;
      return 0.95;
    },
  },
  {
    service: 'SNMP',
    match(bytes) {
      if (bytes.length < 20 || bytes[0] !== 0x30) return 0;
      const len = bytes[1];
      if (len !== 0x81 && len !== 0x82 && Math.abs(bytes.length - 2 - len) > 4) return 0;
      const version = bytes[2] === 0x02 && bytes[3] === 0x01 ? bytes[4] : -1;
      if (version < 0 || version > 3) return 0;
      return 0.9;
    },
  },
  {
    service: 'SSDP',
    matchText: /^(HTTP\/1\.1 200 OK|NOTIFY \* HTTP\/1\.1)/i,
    match(bytes, text) {
      if (!this.matchText.test(text)) return 0;
      return /ST:|LOCATION:|USN:/i.test(text) ? 0.95 : 0.75;
    },
  },
  {
    service: 'mDNS',
    match(bytes) {
      if (bytes.length < 12) return 0;
      const flags = (bytes[2] << 8) | bytes[3];
      const qr = (flags & 0x8000) !== 0;
      if (!qr) return 0;
      return /\.local/i.test(String.fromCharCode(...bytes.slice(12, Math.min(bytes.length, 80))))
        ? 0.9
        : 0.55;
    },
  },
  {
    service: 'NetBIOS-NS',
    match(bytes) {
      if (bytes.length < 12) return 0;
      if (bytes[2] !== 0x84 || bytes[3] !== 0x00) return 0;
      return bytes[4] === 0x00 && bytes[5] === 0x01 ? 0.9 : 0.6;
    },
  },
  {
    service: 'DHCP',
    match(bytes) {
      if (bytes.length < 240) return 0;
      const op = bytes[0];
      if (op !== 1 && op !== 2) return 0;
      const magic = (bytes[236] << 24) | (bytes[237] << 16) | (bytes[238] << 8) | bytes[239];
      return magic === 0x63825363 ? 0.95 : 0.4;
    },
  },
  {
    service: 'CoAP',
    match(bytes) {
      if (bytes.length < 4) return 0;
      const ver = (bytes[0] >> 6) & 0x3;
      const type = (bytes[0] >> 4) & 0x3;
      const code = bytes[1];
      if (ver !== 1 || type > 3) return 0;
      if (code !== 0 && code < 0x40) return 0;
      return 0.85;
    },
  },
  {
    service: 'STUN',
    match(bytes) {
      if (bytes.length < 20) return 0;
      const type = (bytes[0] << 8) | bytes[1];
      const cookie = (bytes[4] << 24) | (bytes[5] << 16) | (bytes[6] << 8) | bytes[7];
      const validTypes = [0x0001, 0x0101, 0x0111, 0x0112];
      if (!validTypes.includes(type)) return 0;
      return cookie === 0x2112a442 ? 0.95 : 0.5;
    },
  },
  {
    service: 'memcached (UDP)',
    match(bytes, text) {
      if (!text.startsWith('VALUE ') && !text.startsWith('END')) return 0;
      return 0.9;
    },
  },
];

/**
 * Identify UDP services from captured probe responses.
 *
 * @param {{ responses: Array<{ port: number, payloadHex?: string, payloadText?: string }> }} input
 */
export function identifyUdpServices({ responses = [] } = {}) {
  const identified = [];

  for (const resp of responses) {
    const bytes = hexToBytes(resp.payloadHex || '');
    const text =
      resp.payloadText ||
      (bytes.length > 0 && bytes.length < 4096 ? Buffer.from(bytes).toString('latin1') : '');

    let best = { service: 'Unknown', confidence: 0 };
    for (const sig of SIGNATURES) {
      const score = sig.match(bytes, text);
      if (score > best.confidence) best = { service: sig.service, confidence: score };
    }

    identified.push({
      port: resp.port,
      service: best.service,
      confidence: best.confidence >= 0.85 ? 'high' : best.confidence >= 0.5 ? 'medium' : 'low',
      score: Math.round(best.confidence * 100) / 100,
      payloadBytes: bytes.length,
    });
  }

  const findings = [];
  const known = identified.filter(i => i.service !== 'Unknown');
  if (known.length > 0) {
    findings.push({
      type: 'UDP services identified',
      severity: 'Info',
      confidence: 'high',
      evidence: known
        .map(i => `${i.service} on UDP/${i.port} (${i.confidence} confidence)`)
        .join('; '),
      recommendation:
        'Inventory the exposed UDP services and confirm each is intentionally reachable.',
    });
  }
  const memcached = identified.find(i => i.service.startsWith('memcached'));
  if (memcached) {
    findings.push({
      type: 'Memcached exposed over UDP',
      severity: 'High',
      confidence: 'high',
      cwe: 'CWE-200',
      evidence: `memcached answered on UDP/${memcached.port}.`,
      recommendation:
        'Disable the UDP listener or firewall it; memcached over UDP is a classic amplification vector.',
    });
  }

  return { identified, knownCount: known.length, findings };
}

export const UDP_SERVICE_IDENTIFIER = { identifyUdpServices };
export default UDP_SERVICE_IDENTIFIER;
