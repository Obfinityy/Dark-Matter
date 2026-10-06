/**
 * bleGattServiceMapper.js — BLE GATT service mapping (idea 00548).
 *
 * Analyzes Bluetooth Low Energy GATT discovery results to fingerprint
 * IoT devices:
 *  - Primary services (16-bit/128-bit UUIDs): Generic Access (0x1800),
 *    Generic Attribute (0x1801), Device Information (0x180A), Battery
 *    (0x180F), Heart Rate (0x180D), and vendor-specific 128-bit UUIDs.
 *  - Characteristic properties: read/write/notify/indicate/auth flags —
 *    writable characteristics without security mode are a bug-bounty
 *    surface (unauthenticated control).
 *  - Device name from the Generic Access service (0x2A00).
 *
 * Offline analyzer: callers supply parsed GATT discovery records from
 * captures the scanner was authorized to collect. No BLE radio code.
 * Defensive use: BLE IoT asset fingerprinting + characteristic security
 * audit for authorized targets.
 */

/** Assigned 16-bit GATT service UUIDs (Bluetooth SIG). */
export const GATT_SERVICES = {
  0x1800: 'Generic Access',
  0x1801: 'Generic Attribute',
  0x180a: 'Device Information',
  0x180d: 'Heart Rate',
  0x180e: 'Phone Alert Status',
  0x180f: 'Battery',
  0x1812: 'Human Interface Device',
  0x1815: 'Automation IO',
  0x181a: 'Environmental Sensing',
  0x1826: 'Fitness Machine',
  0x183b: 'Binary Sensor',
  0x183e: 'Bond Management',
};

/** Well-known characteristic UUIDs worth flagging. */
export const GATT_CHARACTERISTICS = {
  0x2a00: 'Device Name',
  0x2a01: 'Appearance',
  0x2a23: 'System ID',
  0x2a24: 'Model Number String',
  0x2a25: 'Serial Number String',
  0x2a26: 'Firmware Revision String',
  0x2a27: 'Hardware Revision String',
  0x2a28: 'Software Revision String',
  0x2a29: 'Manufacturer Name String',
  0x2a19: 'Battery Level',
};

/**
 * Map GATT services and characteristics into a structured device profile.
 *
 * @param {object[]} services [{ uuid (string|number), characteristics?: [{ uuid, properties?: string[] }] }]
 * @returns {object} profile { services: [...], deviceName?, vendorHints }
 */
export function mapGattServices(services = []) {
  const mapped = services.map((svc) => {
    const uuid16 = typeof svc.uuid === 'number' ? svc.uuid : (typeof svc.uuid === 'string' && /^(0x)?[0-9a-f]{4}$/i.test(svc.uuid) ? parseInt(svc.uuid, 16) : null);
    const name = uuid16 != null ? (GATT_SERVICES[uuid16] || null) : null;
    const chars = (svc.characteristics || []).map((ch) => {
      const cu16 = typeof ch.uuid === 'number' ? ch.uuid : (typeof ch.uuid === 'string' && /^(0x)?[0-9a-f]{4}$/i.test(ch.uuid) ? parseInt(ch.uuid, 16) : null);
      return {
        uuid: typeof ch.uuid === 'number' ? `0x${ch.uuid.toString(16).padStart(4, '0')}` : String(ch.uuid),
        name: cu16 != null ? (GATT_CHARACTERISTICS[cu16] || null) : null,
        properties: Array.isArray(ch.properties) ? ch.properties : [],
      };
    });
    return {
      uuid: typeof svc.uuid === 'number' ? `0x${svc.uuid.toString(16).padStart(4, '0')}` : String(svc.uuid),
      name: name || (uuid16 == null ? 'vendor-specific (128-bit)' : `unknown_0x${uuid16.toString(16)}`),
      vendorSpecific: uuid16 == null,
      characteristics: chars,
    };
  });

  let deviceName = null;
  for (const svc of mapped) {
    for (const ch of svc.characteristics) {
      if (ch.name === 'Device Name' && ch.value !== undefined) deviceName = ch.value;
    }
  }

  return { services: mapped, deviceName };
}

/**
 * Fingerprint the device and flag insecure characteristics.
 *
 * @param {object[]} services parsed GATT service records
 * @returns {object[]} findings
 */
export function analyzeGatt(services = []) {
  const profile = mapGattServices(services);
  const findings = [];

  const named = profile.services.filter((s) => !s.vendorSpecific);
  const vendor = profile.services.filter((s) => s.vendorSpecific);
  const identified = named.map((s) => s.name);

  findings.push({
    type: 'BLE GATT Service Map',
    confidence: 'high',
    cwe: 'CWE-200',
    evidence: `device exposes ${profile.services.length} primary service(s): ${named.map((s) => `${s.name} (${s.uuid})`).join(', ') || 'none'}${vendor.length ? ` + ${vendor.length} vendor-specific 128-bit service(s): ${vendor.map((s) => s.uuid).join(', ')}` : ''}`,
    extra: { serviceCount: profile.services.length, vendorSpecificCount: vendor.length },
  });

  // Fingerprint hints from service bundles.
  if (identified.includes('Heart Rate')) {
    findings.push({ type: 'BLE Device Fingerprint', confidence: 'medium', cwe: null, evidence: 'Heart Rate service (0x180D) present — device is a fitness/wearable class peripheral' });
  } else if (identified.includes('Automation IO') || identified.includes('Environmental Sensing')) {
    findings.push({ type: 'BLE Device Fingerprint', confidence: 'medium', cwe: null, evidence: `${identified.filter((n) => /automation|environmental/i.test(n)).join(', ')} present — device is an IoT sensor/actuator class peripheral` });
  }
  if (vendor.length) {
    findings.push({ type: 'Vendor-Specific BLE Services', confidence: 'medium', cwe: null, evidence: `${vendor.length} vendor-specific 128-bit GATT service(s) — proprietary control surface; map characteristics for unauthenticated write/notify handles`, extra: { uuids: vendor.map((s) => s.uuid) } });
  }

  // Insecure-characteristic audit.
  for (const svc of profile.services) {
    for (const ch of svc.characteristics) {
      const props = ch.properties.map((p) => p.toLowerCase());
      const writable = props.includes('write') || props.includes('write-without-response');
      const secured = props.some((p) => /authenticated|authorized|encrypted/i.test(p));
      if (writable && !secured && !svc.vendorSpecific && svc.name !== 'Generic Access') {
        findings.push({
          type: 'Writable BLE Characteristic Without Security',
          confidence: 'medium',
          cwe: 'CWE-284',
          evidence: `characteristic ${ch.uuid}${ch.name ? ` (${ch.name})` : ''} in service ${svc.name} allows ${props.join('/')} with no authenticated/encrypted property — verify pairing/security-mode requirements`,
          extra: { service: svc.name, characteristic: ch.uuid },
        });
      }
    }
  }

  return findings;
}

export const BLE_GATT_SERVICE_MAPPER = {
  mapGattServices,
  analyzeGatt,
  GATT_SERVICES,
  GATT_CHARACTERISTICS,
};
export default BLE_GATT_SERVICE_MAPPER;
