/**
 * wifiBeaconIeFingerprinter.js — Wi-Fi beacon IE fingerprinting (idea 00549).
 *
 * Analyzes 802.11 beacon frames to fingerprint access points by their
 * Information Element (IE) ordering and content:
 *  - IE ID sequence (SSID=0, Supported Rates=1, DS Param=3, RSN=48,
 *    Vendor Specific=221 …) is a stable per-vendor fingerprint.
 *  - RSN IE: cipher suites (TKIP vs CCMP vs GCMP) and AKM suites
 *    (PSK, 802.1X, SAE, OWE) — legacy crypto is the finding.
 *  - Vendor OUI + type in IE 221: chipset/vendor attribution.
 *  - WPS (IE 221, OUI 00:50:F2 type 4) and WPS version flags.
 *
 * Offline analyzer: callers supply parsed beacon IE lists from captures
 * the scanner was authorized to collect. No wireless radio code.
 * Defensive use: rogue-AP / evil-twin detection and wireless security
 * audit for authorized targets.
 */

/** Common 802.11 IE IDs. */
export const IE_IDS = {
  0: 'SSID',
  1: 'Supported Rates',
  3: 'DS Parameter Set',
  5: 'TIM',
  7: 'Country',
  11: 'QBSS Load',
  32: 'Power Constraint',
  45: 'HT Capabilities',
  48: 'RSN',
  50: 'Extended Supported Rates',
  61: 'HT Operation',
  107: 'Interworking',
  191: 'VHT Capabilities',
  192: 'VHT Operation',
  221: 'Vendor Specific',
  255: 'Extension (HE)',
};

/** RSN cipher suites (OUI 00-0F-AC, suite type). */
export const RSN_CIPHERS = {
  1: 'WEP-40',
  2: 'TKIP',
  4: 'CCMP-128',
  5: 'WEP-104',
  8: 'GCMP-128',
  9: 'GCMP-256',
  10: 'CCMP-256',
};

/** RSN AKM suites (OUI 00-0F-AC, suite type). */
export const RSN_AKMS = {
  1: '802.1X',
  2: 'PSK',
  5: 'SHA256-PSK',
  6: 'SHA256-802.1X',
  8: 'SAE',
  18: 'OWE',
};

/**
 * Fingerprint an AP by the ORDER of IE IDs in its beacon.
 *
 * @param {object[]} ies parsed IEs: [{ id: number, len: number, data?: Buffer }]
 * @returns {string} fingerprint signature, e.g. '0-1-3-5-7-48-50-221'
 */
export function ieOrderSignature(ies = []) {
  return ies.map(ie => Number(ie.id)).join('-');
}

/**
 * Parse the RSN IE body into cipher/AKM suites.
 *
 * @param {Buffer|Uint8Array} body RSN IE body (after id+len)
 * @returns {object} { groupCipher, pairwiseCiphers[], akms[] } or `{ valid:false }`
 */
export function parseRsnIe(body) {
  const b = Buffer.isBuffer(body) ? body : Buffer.from(body || []);
  if (b.length < 8) return { valid: false, reason: 'RSN IE body too short' };
  const version = b.readUInt16LE(0);
  const groupCipher = RSN_CIPHERS[b[5]] || `unknown_${b[5]}`;
  const pairwiseCount = b.readUInt16LE(6);
  const pairwiseCiphers = [];
  let off = 8;
  for (let i = 0; i < pairwiseCount && off + 4 <= b.length; i++, off += 4) {
    pairwiseCiphers.push(RSN_CIPHERS[b[off + 3]] || `unknown_${b[off + 3]}`);
  }
  const akms = [];
  if (off + 2 <= b.length) {
    const akmCount = b.readUInt16LE(off);
    off += 2;
    for (let i = 0; i < akmCount && off + 4 <= b.length; i++, off += 4) {
      akms.push(RSN_AKMS[b[off + 3]] || `unknown_${b[off + 3]}`);
    }
  }
  return { valid: true, version, groupCipher, pairwiseCiphers, akms };
}

/**
 * Extract vendor OUIs from vendor-specific IEs (id 221).
 *
 * @param {object[]} ies parsed IEs
 * @returns {string[]} OUI:type strings, e.g. ['00:50:f2:4', '00:10:18:2']
 */
export function extractVendorOuis(ies = []) {
  const out = [];
  for (const ie of ies) {
    if (Number(ie.id) !== 221 || !ie.data) continue;
    const b = Buffer.isBuffer(ie.data) ? ie.data : Buffer.from(ie.data);
    if (b.length < 4) continue;
    out.push(
      `${b[0].toString(16).padStart(2, '0')}:${b[1].toString(16).padStart(2, '0')}:${b[2].toString(16).padStart(2, '0')}:${b[3]}`
    );
  }
  return out;
}

/**
 * Analyze one beacon's IEs: fingerprint + security findings.
 *
 * @param {object} beacon { bssid, ssid?, ies: [{id,len,data?}] }
 * @param {object} [known] optional map of bssid -> expected IE signature (rogue-AP detection)
 * @returns {object[]} findings
 */
export function analyzeBeacon(beacon = {}, known = {}) {
  const findings = [];
  const ies = beacon.ies || [];
  const signature = ieOrderSignature(ies);
  const ouis = extractVendorOuis(ies);

  findings.push({
    type: 'AP IE Fingerprint',
    confidence: 'high',
    cwe: 'CWE-200',
    evidence: `BSSID ${beacon.bssid || '?'} (${beacon.ssid || '<hidden>'}): IE order signature ${signature || '(no IEs)'}${ouis.length ? `; vendor OUIs ${ouis.join(', ')}` : ''}`,
    extra: { bssid: beacon.bssid, signature, vendorOuis: ouis },
  });

  // Rogue-AP check against a known-good baseline.
  if (beacon.bssid && known[beacon.bssid] && known[beacon.bssid] !== signature) {
    findings.push({
      type: 'Possible Rogue AP (IE Signature Mismatch)',
      confidence: 'medium',
      cwe: 'CWE-290',
      evidence: `BSSID ${beacon.bssid} beacon IE signature changed: expected ${known[beacon.bssid]}, observed ${signature} — AP may have been replaced or spoofed (evil-twin indicator)`,
    });
  }

  // RSN analysis.
  const rsn = ies.find(ie => Number(ie.id) === 48 && ie.data);
  if (rsn) {
    const parsed = parseRsnIe(rsn.data);
    if (parsed.valid) {
      const weakCiphers = parsed.pairwiseCiphers.filter(c => c === 'TKIP' || c.startsWith('WEP'));
      if (
        weakCiphers.length ||
        parsed.groupCipher === 'TKIP' ||
        parsed.groupCipher.startsWith('WEP')
      ) {
        findings.push({
          type: 'Weak Wi-Fi Cipher Suite',
          confidence: 'high',
          cwe: 'CWE-327',
          evidence: `BSSID ${beacon.bssid || '?'} advertises legacy ciphers (group: ${parsed.groupCipher}; pairwise: ${parsed.pairwiseCiphers.join(', ')}) — TKIP/WEP are broken; require CCMP/GCMP`,
        });
      }
      if (parsed.akms.includes('PSK') && !parsed.akms.some(a => a === 'SAE' || a === '802.1X')) {
        findings.push({
          type: 'WPA2-PSK Only (No SAE/802.1X)',
          confidence: 'medium',
          cwe: null,
          evidence: `BSSID ${beacon.bssid || '?'} offers PSK without SAE or 802.1X — susceptible to offline PSK cracking; prefer WPA3-SAE or enterprise auth`,
        });
      }
      if (parsed.akms.includes('OWE')) {
        findings.push({
          type: 'Opportunistic Wireless Encryption',
          confidence: 'medium',
          cwe: null,
          evidence: `BSSID ${beacon.bssid || '?'} offers OWE (open network with encryption)`,
        });
      }
    }
  } else {
    findings.push({
      type: 'Open Wi-Fi Network (No RSN IE)',
      confidence: 'high',
      cwe: 'CWE-319',
      evidence: `BSSID ${beacon.bssid || '?'} (${beacon.ssid || '<hidden>'}) broadcasts beacons with no RSN IE — open network, all traffic in cleartext`,
    });
  }

  // WPS flag.
  if (ouis.some(o => o.startsWith('00:50:f2:4'))) {
    findings.push({
      type: 'WPS Advertised',
      confidence: 'medium',
      cwe: 'CWE-307',
      evidence: `BSSID ${beacon.bssid || '?'} advertises WPS (Microsoft OUI 00:50:F2 type 4) — verify PIN method is disabled (WPS PIN is brute-forceable)`,
    });
  }

  return findings;
}

export const WIFI_BEACON_IE_FINGERPRINTER = {
  ieOrderSignature,
  parseRsnIe,
  extractVendorOuis,
  analyzeBeacon,
  IE_IDS,
  RSN_CIPHERS,
  RSN_AKMS,
};
export default WIFI_BEACON_IE_FINGERPRINTER;
