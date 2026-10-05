/**
 * rtspTransportAnalyzer.js — RTSP SETUP Transport-header analyzer.
 *
 * Parses the Transport headers from a captured RTSP SETUP request/response
 * pair to infer NAT presence, proxy middleboxes, and transport negotiation
 * behavior. Pure parsing — no RTSP traffic is generated here.
 */

/**
 * Parse an RTSP Transport header value into structured fields.
 * @param {string} value e.g. 'RTP/AVP;unicast;client_port=8000-8001;server_port=9000-9001;source=203.0.113.5'
 */
export function parseTransport(value = '') {
  const parts = value.split(';').map((s) => s.trim()).filter(Boolean);
  const out = {
    raw: value,
    protocol: parts[0] || '',
    unicast: false,
    multicast: false,
    interleaved: null,
    clientPort: null,
    serverPort: null,
    source: null,
    destination: null,
    ssrc: null,
    mode: null,
  };
  for (const part of parts.slice(1)) {
    const lower = part.toLowerCase();
    if (lower === 'unicast') out.unicast = true;
    else if (lower === 'multicast') out.multicast = true;
    else if (/^interleaved=/.test(lower)) out.interleaved = part.slice('interleaved='.length);
    else if (/^client_port=/.test(lower)) out.clientPort = part.slice('client_port='.length);
    else if (/^server_port=/.test(lower)) out.serverPort = part.slice('server_port='.length);
    else if (/^source=/.test(lower)) out.source = part.slice('source='.length);
    else if (/^destination=/.test(lower)) out.destination = part.slice('destination='.length);
    else if (/^ssrc=/.test(lower)) out.ssrc = part.slice('ssrc='.length);
    else if (/^mode=/.test(lower)) out.mode = part.slice('mode='.length);
  }
  return out;
}

/**
 * Analyze a captured SETUP request/response Transport pair.
 *
 * @param {{
 *   requestTransport: string,   // Transport header the client sent
 *   responseTransport: string,  // Transport header the server returned
 *   serverAddress?: string,     // IP the RTSP control connection reached
 *   clientPublicIp?: string     // the hunt client's public IP (optional)
 * }} input
 */
export function analyzeTransport({ requestTransport = '', responseTransport = '', serverAddress = '', clientPublicIp = '' } = {}) {
  const req = parseTransport(requestTransport);
  const res = parseTransport(responseTransport);
  const findings = [];

  if (!responseTransport) {
    return {
      request: req, response: res, findings: [{
        type: 'No Transport header in SETUP response',
        severity: 'Low', confidence: 'high',
        evidence: 'Server did not return a Transport header.',
        recommendation: 'Treat as a failed or non-standard negotiation; inspect the RTSP status code.',
      }],
    };
  }

  if (res.multicast) {
    findings.push({
      type: 'Server selected multicast transport',
      severity: 'Low',
      confidence: 'high',
      evidence: `Response Transport: ${responseTransport}.`,
      recommendation: 'Multicast RTP from a public camera is unusual; verify it is intentional and not a reflector risk.',
    });
  }

  if (req.clientPort && res.clientPort && req.clientPort !== res.clientPort) {
    findings.push({
      type: 'Client port rewritten in response',
      severity: 'Info',
      confidence: 'high',
      evidence: `Requested client_port=${req.clientPort}, server echoed client_port=${res.clientPort}.`,
      recommendation: 'Port rewriting suggests an ALG or proxy in the media path.',
    });
  }

  if (res.source && serverAddress && res.source !== serverAddress) {
    findings.push({
      type: 'Media source differs from control server (NAT/proxy)',
      severity: 'Info',
      confidence: 'high',
      cwe: 'CWE-200',
      evidence: `source=${res.source} but the RTSP session is with ${serverAddress}.`,
      recommendation: 'Media is relayed from a different host — map the relay and test its access controls too.',
    });
  }

  if (req.interleaved === null && res.interleaved !== null) {
    findings.push({
      type: 'Server forced TCP interleaved transport',
      severity: 'Info',
      confidence: 'high',
      evidence: `Server returned interleaved=${res.interleaved} although UDP was requested.`,
      recommendation: 'Interleaved media traverses proxies/NAT cleanly; it also concentrates traffic on the control port.',
    });
  }

  if (req.protocol && res.protocol && req.protocol.toLowerCase() !== res.protocol.toLowerCase()) {
    findings.push({
      type: 'Transport protocol downgraded/upgraded by server',
      severity: 'Low',
      confidence: 'medium',
      evidence: `Requested ${req.protocol}, server answered ${res.protocol}.`,
      recommendation: 'Confirm the final transport matches the threat model (e.g. encrypted SRTP if required).',
    });
  }

  if (clientPublicIp && res.destination && res.destination !== clientPublicIp) {
    findings.push({
      type: 'Media destination is not the client (possible reflection)',
      severity: 'Medium',
      confidence: 'medium',
      cwe: 'CWE-200',
      evidence: `destination=${res.destination} while the client public IP is ${clientPublicIp}.`,
      recommendation: 'Verify this is the client\'s requested address and not an attacker-controlled reflector target.',
    });
  }

  if (findings.length === 0) {
    findings.push({
      type: 'Transport negotiation is consistent',
      severity: 'Info',
      confidence: 'high',
      evidence: `Request and response transports agree (${res.protocol}${res.unicast ? ';unicast' : ''}).`,
      recommendation: 'No topology anomalies detected in this SETUP exchange.',
    });
  }

  return { request: req, response: res, findings };
}

export const RTSP_TRANSPORT_ANALYZER = { analyzeTransport, parseTransport };
export default RTSP_TRANSPORT_ANALYZER;
