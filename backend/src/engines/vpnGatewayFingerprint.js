/**
 * vpnGatewayFingerprint.js — VPN concentrator fingerprinting.
 *
 * Passive/defensive recon helpers for an authorized bug-bounty agent: classify
 * VPN gateways from observed handshake-response characteristics (IKE, OpenVPN,
 * WireGuard, SSL-VPN), parse IKE_SA_INIT version and vendor-ID payloads into
 * gateway-vendor hints, classify OpenVPN tls-auth behavior, classify
 * WireGuard handshake-initiation responses, and detect IPsec NAT-T support
 * from NAT-D payloads / UDP-4500 indicators.
 *
 * All functions are pure classifiers over data the operator has already
 * observed (port state, banner/handshake characteristics); nothing here
 * crafts attack packets or sends handshakes.
 */

const VPN_HANDSHAKE_TABLE = [
  {
    type: 'IKE/IPsec',
    signals: ['udp-500', 'ike-sa-init-response', 'vendor-id-payload'],
    description: 'UDP/500 answered with IKE_SA_INIT — IPsec gateway.',
  },
  {
    type: 'OpenVPN',
    signals: ['udp-1194', 'openvpn-hard-reset', 'openvpn-soft-reset'],
    description: 'OpenVPN reset/port behavior observed — OpenVPN instance.',
  },
  {
    type: 'WireGuard',
    signals: ['udp-51820', 'wireguard-handshake-response', 'wireguard-cookie-reply'],
    description: 'WireGuard handshake response — WireGuard endpoint.',
  },
  {
    type: 'SSL-VPN',
    signals: ['tcp-443', 'ssl-vpn-portal', 'prelogin-endpoint'],
    description: 'TLS portal with VPN prelogin markers — SSL-VPN concentrator.',
  },
];

const IKE_VENDOR_TABLE = [
  { vendor: 'Cisco ASA', pattern: /cisco|asa/i },
  { vendor: 'Palo Alto Networks', pattern: /palo.?alto|pan/i },
  { vendor: 'Fortinet', pattern: /forti|fortigate/i },
  { vendor: 'Juniper', pattern: /juniper|netscreen/i },
  { vendor: 'Check Point', pattern: /check.?point|checkpoint/i },
  { vendor: 'SonicWall', pattern: /sonicwall/i },
  { vendor: 'pfSense / strongSwan', pattern: /strongswan|pfsense/i },
  { vendor: 'Libreswan / Openswan', pattern: /libreswan|openswan/i },
  { vendor: 'Microsoft RRAS', pattern: /microsoft|rras/i },
  { vendor: 'Zyxel / USG', pattern: /zyxel/i },
];

const IKE_VERSION_TABLE = {
  0x20: { version: 'IKEv1', note: 'major version 1 — IKEv1 gateway' },
  0x21: { version: 'IKEv2', note: 'major version 2 — IKEv2 gateway' },
};

const OPENVPN_HMAC_TABLE = [
  {
    behavior: 'tls-auth-protected',
    signals: ['silent-drop', 'no-response'],
    description: 'Probe is silently dropped — consistent with tls-auth/tls-crypt HMAC gate.',
  },
  {
    behavior: 'unauthenticated-reset',
    signals: ['soft-reset-response', 'control-channel-reset'],
    description: 'Soft reset response without HMAC — instance not HMAC-gated.',
  },
  {
    behavior: 'tcp-openvpn',
    signals: ['tcp-1194-open', 'openvpn-banner'],
    description: 'TCP/1194 open with OpenVPN protocol markers.',
  },
];

const WIREGUARD_MESSAGE_TYPES = {
  0x01: 'handshake-initiation',
  0x02: 'handshake-response',
  0x03: 'cookie-reply',
  0x04: 'transport-data',
};

const WIREGUARD_RESPONSE_TABLE = [
  {
    classification: 'wireguard-endpoint',
    description: 'Handshake response (type 0x02) — live WireGuard endpoint.',
    test: b => b.length >= 1 && b[0] === 0x02,
  },
  {
    classification: 'wireguard-cookie-reply',
    description: 'Cookie reply (type 0x03) — WireGuard endpoint under load / MAC2 required.',
    test: b => b.length >= 1 && b[0] === 0x03,
  },
  {
    classification: 'not-wireguard',
    description: 'Unrecognized first byte — not a WireGuard handshake response.',
    test: () => true,
  },
];

/**
 * Fingerprint a VPN concentrator from observed handshake-response
 * characteristics (open ports, handshake behavior, portal markers).
 * Idea 566.
 *
 * @param {{signals:string[]}} input Observed signal tokens, e.g. ['udp-500','ike-sa-init-response'].
 * @returns {{type:string|null, confidence:'high'|'medium'|'low', matchedSignals:string[], description:string|null, evidence:string}}
 */
export function fingerprintVpnGateway({ signals = [] } = {}) {
  const observed = new Set(signals.map(s => String(s).toLowerCase()));
  let best = null;
  let bestScore = 0;

  for (const entry of VPN_HANDSHAKE_TABLE) {
    const matched = entry.signals.filter(s => observed.has(s));
    if (matched.length > bestScore) {
      bestScore = matched.length;
      best = { ...entry, matched };
    }
  }

  if (!best) {
    return {
      type: null,
      confidence: 'low',
      matchedSignals: [],
      description: null,
      evidence: 'No VPN handshake signals observed.',
    };
  }

  const confidence = bestScore >= 2 ? 'high' : 'medium';
  return {
    type: best.type,
    confidence,
    matchedSignals: best.matched,
    description: best.description,
    evidence: `Matched ${best.matched.length} signal(s) [${best.matched.join(', ')}] → ${best.type}.`,
  };
}

/**
 * Analyze an observed IKE_SA_INIT response: version byte plus vendor-ID
 * payload strings → gateway vendor hints.
 * Idea 567.
 *
 * @param {{versionByte?:number, vendorIds?:string[], exchangeType?:string}} response
 * @returns {{ikeVersion:string|null, vendors:string[], evidence:string[]}}
 */
export function analyzeIkeNegotiation(response = {}) {
  const { versionByte = null, vendorIds = [], exchangeType = '' } = response;
  const evidence = [];

  let ikeVersion = null;
  if (versionByte !== null && IKE_VERSION_TABLE[versionByte]) {
    ikeVersion = IKE_VERSION_TABLE[versionByte].version;
    evidence.push(
      `${IKE_VERSION_TABLE[versionByte].note} (version byte 0x${versionByte.toString(16)}).`
    );
  } else if (versionByte !== null) {
    evidence.push(`Unknown IKE version byte 0x${versionByte.toString(16)}.`);
  }
  if (/ike_sa_init/i.test(exchangeType)) evidence.push('IKE_SA_INIT exchange observed.');

  const vendors = [];
  for (const vid of vendorIds.filter(Boolean)) {
    const hit = IKE_VENDOR_TABLE.find(v => v.pattern.test(vid));
    if (hit && !vendors.includes(hit.vendor)) {
      vendors.push(hit.vendor);
      evidence.push(`Vendor-ID payload suggests ${hit.vendor}.`);
    }
  }
  if (vendorIds.length && !vendors.length) {
    evidence.push(
      `${vendorIds.length} vendor-ID payload(s) observed but none match known signatures.`
    );
  }

  return { ikeVersion, vendors, evidence };
}

/**
 * Classify OpenVPN tls-auth behavior from observed probe outcomes
 * (silent drop vs soft-reset response vs TCP service markers).
 * Idea 568.
 *
 * @param {{signals:string[]}} input Observed outcome tokens, e.g. ['silent-drop'].
 * @returns {{behavior:string|null, description:string|null, evidence:string}}
 */
export function probeOpenVpnHmac({ signals = [] } = {}) {
  const observed = new Set(signals.map(s => String(s).toLowerCase()));
  let best = null;
  let bestScore = 0;

  for (const entry of OPENVPN_HMAC_TABLE) {
    const matched = entry.signals.filter(s => observed.has(s));
    if (matched.length > bestScore) {
      bestScore = matched.length;
      best = { ...entry, matched };
    }
  }

  if (!best) {
    return {
      behavior: null,
      description: null,
      evidence: 'No OpenVPN HMAC behavior signals observed.',
    };
  }

  return {
    behavior: best.behavior,
    description: best.description,
    evidence: `Signal(s) [${best.matched.join(', ')}] → ${best.description}`,
  };
}

/**
 * Classify a response to an observed WireGuard handshake-initiation by its
 * message-type byte (defensive fingerprinting, no packet crafting here).
 * Idea 569.
 *
 * @param {number[]|Uint8Array|Buffer} responseBytes Raw bytes of the observed response.
 * @returns {{classification:string, messageType:string|null, evidence:string}}
 */
export function probeWireGuardHandshake(responseBytes) {
  const b = Array.isArray(responseBytes) ? responseBytes : Array.from(responseBytes || []);

  if (b.length === 0) {
    return {
      classification: 'silent',
      messageType: null,
      evidence: 'No response observed — endpoint filtered or not WireGuard.',
    };
  }

  const firstByte = b[0];
  const messageType = WIREGUARD_MESSAGE_TYPES[firstByte] ?? null;
  for (const entry of WIREGUARD_RESPONSE_TABLE) {
    if (entry.test(b)) {
      return {
        classification: entry.classification,
        messageType,
        evidence: `First byte 0x${firstByte.toString(16).padStart(2, '0')}${messageType ? ` (${messageType})` : ''} → ${entry.description}`,
      };
    }
  }
  return { classification: 'unknown', messageType, evidence: 'No classification matched.' };
}

/**
 * Detect IPsec NAT-T support from observed NAT-D payloads and UDP-4500
 * indicators. Idea 570.
 *
 * @param {{udp4500Open?:boolean, natDPayloads?:number, natDOE?:boolean, ikeVersion?:string}} input
 * @returns {{natTSupported:boolean, confidence:'high'|'medium'|'low', evidence:string[]}}
 */
export function detectIpsecNatT(input = {}) {
  const { udp4500Open = false, natDPayloads = 0, natDOE = false, ikeVersion = '' } = input;
  const evidence = [];
  let score = 0;

  if (udp4500Open) {
    score += 2;
    evidence.push('UDP/4500 open — NAT-T encapsulation port listening.');
  }
  if (natDPayloads > 0) {
    score += 2;
    evidence.push(
      `${natDPayloads} NAT-D payload(s) observed in IKE exchange — NAT detection in use.`
    );
  }
  if (natDOE) {
    score += 1;
    evidence.push('NAT-D payloads indicate a NAT device on the path (NAT-D mismatch).');
  }
  if (/ikev2/i.test(ikeVersion)) {
    score += 1;
    evidence.push('IKEv2 negotiates NAT-T natively via UDP-4500.');
  }

  const natTSupported = score >= 2;
  const confidence = score >= 4 ? 'high' : score >= 2 ? 'medium' : 'low';
  return { natTSupported, confidence, evidence };
}

export const VPN_GATEWAY_FINGERPRINT = {
  fingerprintVpnGateway,
  analyzeIkeNegotiation,
  probeOpenVpnHmac,
  probeWireGuardHandshake,
  detectIpsecNatT,
  VPN_HANDSHAKE_TABLE,
  IKE_VENDOR_TABLE,
  WIREGUARD_MESSAGE_TYPES,
};
export default VPN_GATEWAY_FINGERPRINT;
