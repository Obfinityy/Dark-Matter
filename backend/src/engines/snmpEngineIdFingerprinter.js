/**
 * snmpEngineIdFingerprinter.js — SNMPv3 engine-ID fingerprinter.
 *
 * Parses an SNMPv3 snmpEngineID (hex) per RFC 3411 §5 and infers the agent
 * vendor and engine-ID construction format. Works purely on captured engine
 * IDs — no network access required.
 *
 * RFC 3411 formats: octet 1 MSB=1 → octets 1–4 hold the IANA enterprise
 * number, octet 5 is the format (1=IPv4, 2=IPv6, 3=MAC, 4=text, 5=opaque,
 * 6–127 reserved, 128–255 enterprise-specific).
 */

const FORMAT_NAMES = {
  1: 'IPv4 address',
  2: 'IPv6 address',
  3: 'MAC address',
  4: 'administratively assigned text',
  5: 'administratively assigned opaque bytes',
};

const KNOWN_VENDORS = {
  9: 'Cisco', 11: 'HP / HPE', 2636: 'Juniper Networks', 2011: 'Huawei',
  8072: 'Net-SNMP', 14988: 'MikroTik', 674: 'Dell', 45: 'Nortel',
  1916: 'Extreme Networks', 43: '3Com', 4526: 'Netgear', 171: 'D-Link',
};

/**
 * Format a hex string as colon-separated bytes for display.
 * @param {string} hex
 */
function hexToColon(hex) {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '').toLowerCase();
  const pairs = [];
  for (let i = 0; i < clean.length; i += 2) pairs.push(clean.slice(i, i + 2));
  return { pairs, clean };
}

function parseMac(bytes) {
  const oui = bytes.slice(0, 3).join(':').toUpperCase();
  const mac = bytes.join(':').toUpperCase();
  return { mac, oui };
}

/**
 * Fingerprint an SNMPv3 agent from its engine ID.
 *
 * @param {{ engineId: string, observedIp?: string }} input
 *   engineId — hex string, e.g. "80001f8880685e2c".
 */
export function fingerprintEngineId({ engineId = '', observedIp = '' } = {}) {
  const { pairs, clean } = hexToColon(engineId);
  const bytes = pairs.map((p) => parseInt(p, 16));

  if (clean.length < 10 || clean.length % 2 !== 0 || bytes.some((b) => Number.isNaN(b))) {
    return {
      valid: false,
      engineId: clean,
      reason: 'Engine ID too short or not valid hex (minimum 5 octets per RFC 3411).',
      findings: [],
    };
  }

  let enterprise = null;
  let format = null;
  let opaque = null;

  if (bytes[0] & 0x80) {
    enterprise = ((bytes[0] & 0x7f) << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
    format = bytes[4];
    opaque = pairs.slice(5).join('');
  } else {
    return {
      valid: false,
      engineId: clean,
      reason: 'First octet MSB not set — not a standards-conformant RFC 3411 engine ID.',
      findings: [{
        type: 'Non-conformant engine ID',
        severity: 'Info',
        confidence: 'high',
        evidence: `First octet 0x${pairs[0]} lacks the enterprise marker bit.`,
        recommendation: 'Treat the agent as a custom/proprietary implementation.',
      }],
    };
  }

  const vendor = enterprise !== null ? (KNOWN_VENDORS[enterprise] || `Unknown enterprise ${enterprise}`) : 'Unknown';
  const formatName = FORMAT_NAMES[format] || (format >= 128 ? 'enterprise-specific' : format >= 6 ? 'reserved' : 'unknown');
  const detail = { enterprise, format, formatName, opaque, vendor };

  if (format === 3 && opaque.length >= 12) {
    const { mac, oui } = parseMac(opaque.match(/.{2}/g).slice(0, 6));
    detail.mac = mac;
    detail.oui = oui;
  }
  if (format === 1 && opaque.length >= 8) {
    const quads = opaque.match(/.{2}/g).slice(0, 4).map((h) => parseInt(h, 16));
    detail.ipv4 = quads.join('.');
  }
  if (format === 4) {
    detail.text = Buffer.from(opaque, 'hex').toString('utf8').replace(/[^\x20-\x7e]/g, '');
  }

  const findings = [
    {
      type: 'SNMPv3 agent fingerprinted',
      severity: 'Info',
      confidence: vendor.startsWith('Unknown') ? 'medium' : 'high',
      evidence: `Engine ID format: ${formatName}; vendor: ${vendor}${detail.mac ? `; MAC ${detail.mac}` : ''}${detail.text ? `; text "${detail.text}"` : ''}.`,
      recommendation: 'Engine IDs are stable agent identifiers — use them to deduplicate assets during a hunt.',
    },
  ];

  if (format === 4 && detail.text) {
    findings.push({
      type: 'Human-readable engine ID text',
      severity: 'Info',
      confidence: 'high',
      cwe: 'CWE-200',
      evidence: `Engine ID embeds the text "${detail.text}".`,
      recommendation: 'Text engine IDs sometimes leak hostnames or asset tags; verify no sensitive naming is exposed.',
    });
  }

  if (observedIp && detail.ipv4 && observedIp !== detail.ipv4) {
    findings.push({
      type: 'Engine-ID IP differs from observed IP',
      severity: 'Info',
      confidence: 'medium',
      evidence: `Engine ID encodes ${detail.ipv4} but the agent was reached at ${observedIp}.`,
      recommendation: 'Indicates NAT, multi-homing, or a copied engine-ID configuration.',
    });
  }

  return { valid: true, engineId: clean, ...detail, findings };
}

/**
 * Flag duplicated engine IDs across a set of observed agents — duplicated
 * IDs usually mean cloned configurations and break SNMPv3 timeliness checks.
 * @param {Array<{ engineId: string, host: string }>} observations
 */
export function findDuplicateEngineIds(observations = []) {
  const byEngine = new Map();
  for (const { engineId, host } of observations) {
    const key = engineId.replace(/[^0-9a-fA-F]/g, '').toLowerCase();
    if (!byEngine.has(key)) byEngine.set(key, []);
    byEngine.get(key).push(host);
  }
  const duplicates = [...byEngine.entries()]
    .filter(([, hosts]) => hosts.length > 1)
    .map(([engineId, hosts]) => ({ engineId, hosts }));
  return {
    total: observations.length,
    unique: byEngine.size,
    duplicates,
    misconfigured: duplicates.length > 0,
  };
}

export const SNMP_ENGINE_ID_FINGERPRINTER = { fingerprintEngineId, findDuplicateEngineIds };
export default SNMP_ENGINE_ID_FINGERPRINTER;
