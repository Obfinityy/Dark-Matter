/**
 * zigbeeCoordinatorDetector.js — Zigbee coordinator detection (idea 00545).
 *
 * Analyzes IEEE 802.15.4 beacon frames and Zigbee responses:
 *  - Beacon requests trigger beacon frames from coordinators/routers.
 *  - Beacon payload: PAN ID, coordinator short address, beacon order,
 *    superframe order, capability information (coordinator bit,
 *    permit-association bit).
 *  - Active permit-joining (association permitted) is the bug-bounty
 *    surface: strangers can join the network.
 *
 * Offline analyzer: callers supply parsed beacon frames from captures the
 * scanner was authorized to collect. No radio code.
 * Defensive use: Zigbee network inventory + open-joining audit for
 * authorized targets.
 */

/** Zigbee/802.15.4 capability-information bits. */
export const CAPABILITY_BITS = {
  0x01: 'alternate_pan_coordinator',
  0x02: 'device_type_ffd',
  0x04: 'mains_powered',
  0x08: 'receiver_on_when_idle',
  0x40: 'security_capability',
  0x80: 'allocate_address',
};

/**
 * Parse an 802.15.4 beacon frame payload (after the MAC header).
 *
 * @param {Buffer|Uint8Array} payload beacon payload bytes:
 *   [superframeSpec(2)][gtsSpec(1)][pendingAddrSpec(1)][beaconPayload...]
 *   Zigbee beacon payload: [protocolId][stackProfile|protocolVersion]
 *   [protocolVersion2][stackProfile2|routerCap?][...]
 * @returns {object} parsed fields or `{ valid: false, reason }`
 */
export function parseBeaconPayload(payload) {
  const b = Buffer.isBuffer(payload) ? payload : Buffer.from(payload || []);
  if (b.length < 5) return { valid: false, reason: 'beacon payload shorter than 5 bytes' };
  const superframeSpec = b.readUInt16LE(0);
  const gtsSpec = b[2];
  const pendingAddrSpec = b[3];
  const zb = b.slice(4);
  return {
    valid: true,
    beaconOrder: superframeSpec & 0x0f,
    superframeOrder: (superframeSpec >> 4) & 0x0f,
    finalCapSlot: (superframeSpec >> 8) & 0x0f,
    batteryLifeExtension: ((superframeSpec >> 12) & 0x01) === 1,
    panCoordinator: ((superframeSpec >> 14) & 0x01) === 1,
    associationPermit: ((superframeSpec >> 15) & 0x01) === 1,
    gtsPermit: (gtsSpec & 0x80) !== 0,
    pendingShortAddrCount: pendingAddrSpec & 0x07,
    pendingExtAddrCount: (pendingAddrSpec >> 4) & 0x07,
    zigbeeProtocolId: zb.length ? zb[0] : null,
  };
}

/**
 * Detect coordinators and open joining from parsed beacon frames.
 *
 * @param {object[]} beacons [{ panId, shortAddress?, extendedAddress?, payload (Buffer|Uint8Array), rssi? }]
 * @returns {object[]} findings
 */
export function detectCoordinators(beacons = []) {
  const findings = [];
  const coordinators = [];

  for (const bc of beacons) {
    const parsed = parseBeaconPayload(bc.payload);
    if (!parsed.valid) continue;
    const pan =
      typeof bc.panId === 'number'
        ? `0x${bc.panId.toString(16).padStart(4, '0')}`
        : String(bc.panId ?? '?');
    const label =
      bc.shortAddress === 0x0000 || parsed.panCoordinator
        ? 'coordinator'
        : 'router/end-device (beaconing)';

    if (bc.shortAddress === 0x0000 || parsed.panCoordinator) {
      coordinators.push({ panId: pan, shortAddress: bc.shortAddress, ext: bc.extendedAddress });
      findings.push({
        type: 'Zigbee Coordinator Detected',
        confidence: 'high',
        cwe: 'CWE-200',
        evidence: `coordinator beacon on PAN ${pan} (short addr 0x${(bc.shortAddress ?? 0).toString(16).padStart(4, '0')})${bc.extendedAddress ? `, extended ${bc.extendedAddress}` : ''}; beacon order ${parsed.beaconOrder}, superframe order ${parsed.superframeOrder}`,
        extra: { panId: pan, shortAddress: bc.shortAddress },
      });
      if (parsed.associationPermit) {
        findings.push({
          type: 'Zigbee Permit-Joining Enabled',
          confidence: 'high',
          cwe: 'CWE-284',
          evidence: `coordinator on PAN ${pan} has the association-permit bit set — new devices may join the network. Verify joining is limited (install codes / trust-center rejoin) rather than open.`,
          extra: { panId: pan },
        });
      }
    }
    void label;
  }

  if (!findings.length) {
    findings.push({
      type: 'No Zigbee Coordinators Seen',
      confidence: 'medium',
      cwe: null,
      evidence:
        'beacon scan observed no coordinator beacons — no Zigbee network in range or beacons are disabled',
    });
  }

  return findings;
}

export const ZIGBEE_COORDINATOR_DETECTOR = {
  parseBeaconPayload,
  detectCoordinators,
  CAPABILITY_BITS,
};
export default ZIGBEE_COORDINATOR_DETECTOR;
