/**
 * bluetoothSdpEnumerator.js — Bluetooth SDP enumeration (idea 00547).
 *
 * Analyzes Bluetooth Service Discovery Protocol (SDP) records collected
 * from a device:
 *  - Service class IDs (16-bit UUIDs): 0x1101 Serial Port, 0x1105 OBEX
 *    Object Push, 0x1106 File Transfer, 0x111E HFP, 0x112D DUN …
 *  - Protocol descriptor lists: RFCOMM channel numbers (open serial ports).
 *  - Bluetooth profile/version fields for stack fingerprinting.
 *
 * Offline analyzer: callers supply parsed SDP records (from captures the
 * scanner was authorized to collect). No Bluetooth radio code.
 * Defensive use: Bluetooth device service inventory for authorized targets —
 * legacy/unprotected services (OBEX push, unauthenticated Serial Port) are
 * the bug-bounty surface.
 */

/** Common 16-bit Bluetooth service class UUIDs (SIG assigned numbers). */
export const BT_SERVICE_CLASSES = {
  0x1101: 'Serial Port (SPP)',
  0x1102: 'LAN Access Using PPP',
  0x1103: 'Dial-up Networking (DUN)',
  0x1104: 'IrMC Sync',
  0x1105: 'OBEX Object Push (OPP)',
  0x1106: 'OBEX File Transfer (FTP)',
  0x1107: 'IrMC Sync Command',
  0x1108: 'Headset (HSP)',
  0x110b: 'Audio Gateway',
  0x110c: 'Advanced Audio Distribution (A2DP)',
  0x110d: 'A/V Remote Control Target',
  0x110e: 'A/V Remote Control (AVRCP)',
  0x110f: 'A/V Remote Control Controller',
  0x1110: 'Intercom',
  0x1111: 'Fax',
  0x1112: 'Headset Audio Gateway',
  0x1115: 'PANU (PAN)',
  0x1116: 'NAP (PAN)',
  0x1117: 'GN (PAN)',
  0x111e: 'Hands-Free (HFP)',
  0x111f: 'Hands-Free Audio Gateway',
  0x1121: 'SIM Access (SAP)',
  0x1122: 'PBAP PSE',
  0x1123: 'PBAP PCE',
  0x1124: 'HID',
  0x112d: 'Dial-up Networking',
  0x112e: 'Device Identification (DI)',
  0x1131: 'HCRP Print',
  0x1200: 'PnP Information',
  0x1400: 'Health Device Profile',
  0x1401: 'Health Device Source',
  0x1402: 'Health Device Sink',
};

/** Services historically associated with weak auth / legacy stacks. */
export const RISKY_SERVICES = new Set([0x1105, 0x1106, 0x1101, 0x1103, 0x112d]);

/**
 * Enumerate and classify SDP service records.
 *
 * @param {object[]} records [{ serviceClassId (number), serviceName?, rfcommChannel?, protocols?: string[], profileDescriptor?: string }]
 * @returns {object[]} findings
 */
export function enumerateSdpRecords(records = []) {
  const findings = [];
  const seen = new Set();

  for (const rec of records) {
    const cls = Number(rec.serviceClassId);
    if (!Number.isFinite(cls)) continue;
    const name = BT_SERVICE_CLASSES[cls] || rec.serviceName || `unknown_0x${cls.toString(16)}`;
    const key = `${cls}`;
    if (seen.has(key)) continue;
    seen.add(key);

    findings.push({
      type: 'Bluetooth Service Discovered',
      confidence: 'high',
      cwe: 'CWE-200',
      evidence: `device exposes Bluetooth service '${name}' (class 0x${cls.toString(16).padStart(4, '0')})${rec.rfcommChannel != null ? ` on RFCOMM channel ${rec.rfcommChannel}` : ''}${rec.protocols ? ` via ${rec.protocols.join('/')}` : ''}`,
      extra: { serviceClassId: cls, serviceName: name, rfcommChannel: rec.rfcommChannel ?? null },
    });

    if (RISKY_SERVICES.has(cls)) {
      findings.push({
        type: 'Legacy Bluetooth Service Exposed',
        confidence: 'medium',
        cwe: 'CWE-284',
        evidence: `service '${name}' historically ships with weak or no authentication (legacy profile). Verify pairing/authentication requirements before marking benign.`,
        extra: { serviceClassId: cls },
      });
    }
  }

  if (!findings.length) {
    findings.push({
      type: 'No SDP Records Parsed',
      confidence: 'low',
      cwe: null,
      evidence: 'no valid SDP service records in the provided set — device refused enumeration or records were not captured',
    });
  }
  return findings;
}

/**
 * Fingerprint the Bluetooth stack from service-record metadata.
 *
 * @param {object[]} records parsed SDP records
 * @returns {object} { stackHint, confidence, evidence }
 */
export function fingerprintBtStack(records = []) {
  const classes = records.map((r) => Number(r.serviceClassId));
  const names = records.map((r) => BT_SERVICE_CLASSES[Number(r.serviceClassId)]).filter(Boolean);
  let stackHint = 'unknown';
  let confidence = 'low';
  // Heuristic service bundles seen on common stacks.
  if (classes.includes(0x112e)) { stackHint = 'stack advertises Device Identification profile (modern smartphone/OS stack)'; confidence = 'medium'; }
  else if (names.length && names.every((n) => /obex|serial|dial-up/i.test(n))) { stackHint = 'legacy embedded/IoT stack (OBEX + serial-era profiles only)'; confidence = 'medium'; }
  return {
    stackHint,
    confidence,
    evidence: `enumerated ${classes.length} service class(es): ${names.slice(0, 6).join(', ') || 'none recognized'}${classes.length > 6 ? ' …' : ''}`,
  };
}

export const BLUETOOTH_SDP_ENUMERATOR = {
  enumerateSdpRecords,
  fingerprintBtStack,
  BT_SERVICE_CLASSES,
};
export default BLUETOOTH_SDP_ENUMERATOR;
