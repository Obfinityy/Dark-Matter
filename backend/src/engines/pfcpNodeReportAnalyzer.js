/**
 * pfcpNodeReportAnalyzer.js — PFCP node-report analysis (idea 00541).
 *
 * Analyzes PFCP (Packet Forwarding Control Protocol, 3GPP TS 29.244) node
 * reports exchanged with 5G user-plane functions (UPFs):
 *  - Heartbeat requests/responses: recovery timestamps (node restarts).
 *  - Node Report messages: user-plane resource info, clock drift, failure
 *    indication IE groups (load reduction / failure flags).
 *  - Association setup/update responses: CP/UP node IDs, PFCP features.
 *
 * Offline analyzer: callers supply parsed IE summaries or raw PFCP message
 * bytes from captures the scanner was authorized to collect. No network code.
 * Defensive use: 5G core asset inventory + stability telemetry for
 * authorized targets.
 */

/** PFCP message types we care about (3GPP TS 29.244 §7.3). */
export const PFCP_MESSAGE_TYPES = {
  1: 'heartbeat_request',
  2: 'heartbeat_response',
  3: 'pfd_management_request',
  4: 'pfd_management_response',
  5: 'association_setup_request',
  6: 'association_setup_response',
  7: 'association_update_request',
  8: 'association_update_response',
  9: 'association_release_request',
  10: 'association_release_response',
  11: 'version_not_supported_response',
  12: 'node_report_request',
  13: 'node_report_response',
  14: 'session_set_deletion_request',
  15: 'session_set_deletion_response',
};

/** Failure-indication flags that signal an unhealthy or stressed UPF. */
export const FAILURE_INDICATIONS = {
  0x01: 'load_reduction', // UPF signalling load shedding
  0x02: 'failure_report', // reporting a partial/full failure
};

/**
 * Parse a PFCP message header from raw bytes (SEID + sequence number layout).
 *
 * @param {Buffer|Uint8Array} buf raw PFCP datagram
 * @returns {object} header fields or `{ valid: false, reason }`
 */
export function parsePfcpHeader(buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf || []);
  if (b.length < 8) return { valid: false, reason: 'datagram shorter than minimum PFCP header' };
  const flags = b[0];
  const version = flags >> 5;
  if (version !== 1) return { valid: false, reason: `unexpected PFCP version ${version}` };
  const msgType = b[1];
  const length = b.readUInt16BE(2);
  const seidPresent = (flags & 0x01) !== 0;
  const seid = seidPresent ? b.readBigUInt64BE(4) : 0n;
  const seqOff = seidPresent ? 12 : 4;
  if (b.length < seqOff + 4) return { valid: false, reason: 'truncated sequence number field' };
  const seqNumber = (b[seqOff] << 16) | (b[seqOff + 1] << 8) | b[seqOff + 2];
  return {
    valid: true,
    version,
    messageType: msgType,
    messageName: PFCP_MESSAGE_TYPES[msgType] || `unknown_${msgType}`,
    length,
    seidPresent,
    seid: seid.toString(),
    sequenceNumber: seqNumber,
    headerLength: seqOff + 4,
  };
}

/**
 * Analyze a heartbeat exchange for node-restart detection.
 *
 * @param {object} opts
 * @param {string|number} [opts.recoveryTimestamp] recovery TS from heartbeat response (0 = never restarted)
 * @param {string|number} [opts.previousTimestamp] previously seen recovery TS
 * @returns {object[]} findings
 */
export function analyzeHeartbeat({ recoveryTimestamp = null, previousTimestamp = null } = {}) {
  const findings = [];
  const ts = Number(recoveryTimestamp);
  if (!Number.isFinite(ts) || ts <= 0) return findings;
  findings.push({
    type: 'PFCP Node Recovery Timestamp',
    confidence: 'high',
    cwe: null,
    evidence: `UPF reported recovery timestamp ${ts} (${new Date(ts * 1000).toISOString()})`,
    extra: { recoveryTimestamp: ts },
  });
  if (
    previousTimestamp != null &&
    Number(previousTimestamp) > 0 &&
    ts > Number(previousTimestamp)
  ) {
    findings.push({
      type: 'PFCP Node Restart Detected',
      confidence: 'high',
      cwe: null,
      evidence: `recovery timestamp advanced from ${previousTimestamp} to ${ts} — UPF restarted between observations`,
      extra: { previousTimestamp: Number(previousTimestamp), currentTimestamp: ts },
    });
  }
  return findings;
}

/**
 * Analyze a node report message (message type 12).
 *
 * @param {object} report parsed node-report summary:
 *   { nodeId?, upfModel?, userPlaneIp?, failureIndications?: number[],
 *     loadReductionInfo?: object, reportedAt?: string }
 * @returns {object[]} findings — health flags and inventory facts
 */
export function analyzeNodeReport(report = {}) {
  const findings = [];
  if (!report || typeof report !== 'object') return findings;

  if (report.nodeId) {
    findings.push({
      type: '5G UPF Identity Disclosed',
      confidence: 'high',
      cwe: 'CWE-200',
      evidence: `node report identifies UPF node-id ${report.nodeId}${report.upfModel ? ` (model: ${report.upfModel})` : ''}${report.userPlaneIp ? ` at ${report.userPlaneIp}` : ''}`,
      extra: { nodeId: report.nodeId, model: report.upfModel || null },
    });
  }

  for (const code of report.failureIndications || []) {
    const label = FAILURE_INDICATIONS[code];
    if (label) {
      findings.push({
        type: 'UPF Failure Indication',
        confidence: 'high',
        cwe: null,
        evidence: `node report carries failure-indication IE flag '${label}' (0x${code.toString(16)}) — user-plane function is stressed or partially failed`,
        extra: { flag: label, code },
      });
    }
  }

  if (report.loadReductionInfo) {
    findings.push({
      type: 'UPF Load Reduction Active',
      confidence: 'medium',
      cwe: null,
      evidence: `UPF reported load-reduction metrics: ${JSON.stringify(report.loadReductionInfo)} — indicates capacity pressure or throttling state`,
    });
  }

  return findings;
}

/**
 * Fingerprint the UPF vendor family from association-response fields.
 *
 * @param {object} assoc { nodeId?, featureFlags?: number, cpFunctionFeatures?: string[] }
 * @returns {object} { vendorHint, confidence, evidence }
 */
export function fingerprintUpf(assoc = {}) {
  const features = Array.isArray(assoc.cpFunctionFeatures) ? assoc.cpFunctionFeatures : [];
  // Heuristic: distinctive feature bundles map to known product families.
  const has = f => features.some(x => String(x).toLowerCase().includes(f));
  let vendorHint = 'unknown';
  let confidence = 'low';
  if (has('dpx') || has('qos_enforcement_bypass')) {
    vendorHint = 'vendor family A (DPX-heavy feature set)';
    confidence = 'medium';
  }
  if (has('packet_delay_detection') && has('mted')) {
    vendorHint = 'vendor family B (M-TED + delay detection bundle)';
    confidence = 'medium';
  }
  if (assoc.nodeId && /^[a-z]{2,4}-upf/i.test(String(assoc.nodeId))) {
    vendorHint = 'operator-style node naming convention';
    confidence = 'low';
  }
  return {
    vendorHint,
    confidence,
    evidence: `association response advertised ${features.length} CP-function features${assoc.nodeId ? `; node-id '${assoc.nodeId}'` : ''}`,
    features,
  };
}

export const PFCP_NODE_REPORT_ANALYZER = {
  parsePfcpHeader,
  analyzeHeartbeat,
  analyzeNodeReport,
  fingerprintUpf,
  PFCP_MESSAGE_TYPES,
  FAILURE_INDICATIONS,
};
export default PFCP_NODE_REPORT_ANALYZER;
