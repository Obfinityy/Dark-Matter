/**
 * rtspDescribeFingerprinter.js — RTSP DESCRIBE response fingerprinter.
 *
 * Parses a captured RTSP DESCRIBE response (status line, headers, SDP body)
 * to fingerprint camera / media-server vendors. Works on data collected
 * during an authorized hunt — it never issues RTSP requests itself.
 */

const VENDOR_SIGNATURES = [
  { vendor: 'Axis Communications', re: /axis/i, confidence: 'high' },
  { vendor: 'Hikvision', re: /hikvision/i, confidence: 'high' },
  { vendor: 'Dahua', re: /dahua/i, confidence: 'high' },
  { vendor: 'Wowza Streaming Engine', re: /wowza/i, confidence: 'high' },
  { vendor: 'Live555 / live555', re: /live555/i, confidence: 'high' },
  { vendor: 'GStreamer RTSP server', re: /gstreamer/i, confidence: 'high' },
  { vendor: 'FFmpeg rtsp server', re: /ffmpeg/i, confidence: 'medium' },
  { vendor: 'Bosch', re: /bosch/i, confidence: 'high' },
  { vendor: 'Hanwha / Samsung Techwin', re: /hanwha|samsung/i, confidence: 'medium' },
  { vendor: 'Uniview', re: /uniview/i, confidence: 'high' },
  { vendor: 'Vivotek', re: /vivotek/i, confidence: 'high' },
];

/**
 * Parse raw RTSP response text into { statusCode, headers, body }.
 * @param {string} raw
 */
export function parseRtspResponse(raw = '') {
  const normalized = raw.replace(/\r\n/g, '\n');
  const sep = normalized.indexOf('\n\n');
  const head = sep === -1 ? normalized : normalized.slice(0, sep);
  const body = sep === -1 ? '' : normalized.slice(sep + 2);
  const lines = head.split('\n');
  const statusMatch = /^RTSP\/1\.0\s+(\d{3})/i.exec(lines[0] || '');
  const headers = {};
  for (const line of lines.slice(1)) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    headers[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
  }
  return { statusCode: statusMatch ? Number(statusMatch[1]) : 0, headers, body };
}

/**
 * Extract stream metadata from an SDP body.
 * @param {string} sdp
 */
export function parseSdp(sdp = '') {
  const lines = sdp.replace(/\r\n/g, '\n').split('\n');
  const media = [];
  const info = {};
  for (const line of lines) {
    const [key, ...rest] = line.split('=');
    const value = rest.join('=');
    if (key === 'm') media.push(value.split(' ')[0]);
    else if (key === 's' && !info.sessionName) info.sessionName = value;
    else if (key === 'o') info.origin = value;
    else if (key === 'i' && !info.description) info.description = value;
  }
  return { media, ...info };
}

/**
 * Fingerprint an RTSP server from a captured DESCRIBE response.
 *
 * @param {{ response: string }} input — raw RTSP response text.
 */
export function fingerprintRtspDescribe({ response = '' } = {}) {
  const { statusCode, headers, body } = parseRtspResponse(response);
  const server = headers.server || '';
  const sdp = parseSdp(body);

  const haystack = `${server} ${sdp.sessionName || ''} ${sdp.description || ''}`;
  let vendor = 'Unknown';
  let confidence = 'low';
  for (const sig of VENDOR_SIGNATURES) {
    if (sig.re.test(haystack)) {
      vendor = sig.vendor;
      confidence = sig.confidence;
      break;
    }
  }

  const publicMethods = (headers.public || '')
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);
  const contentBase = headers['content-base'] || '';

  const findings = [
    {
      type: 'RTSP server fingerprinted',
      severity: 'Info',
      confidence,
      evidence: `Server: "${server || '(none)'}"; SDP session: "${sdp.sessionName || '(none)'}"; media: ${sdp.media.join(', ') || 'none'}; Public: ${publicMethods.join(', ') || 'absent'}.`,
      recommendation:
        'Version banners help targeted testing; remove or genericize Server headers on exposed cameras.',
    },
  ];

  if (statusCode === 200 && sdp.media.length > 0 && contentBase) {
    findings.push({
      type: 'Stream URLs disclosed in DESCRIBE',
      severity: 'Info',
      confidence: 'high',
      cwe: 'CWE-200',
      evidence: `Content-Base: ${contentBase}; ${sdp.media.length} media section(s) described.`,
      recommendation:
        'Confirm DESCRIBE requires authentication; unauthenticated stream enumeration leaks camera topology.',
    });
  }

  if (statusCode === 401) {
    const auth = headers['www-authenticate'] || '';
    findings.push({
      type: 'DESCRIBE requires authentication',
      severity: 'Info',
      confidence: 'high',
      evidence: `401 with ${auth ? `"${auth.slice(0, 60)}…"` : 'no challenge details'}.`,
      recommendation:
        'Good — verify the challenge uses digest auth and that default camera credentials are changed.',
    });
  }

  if (!publicMethods.includes('DESCRIBE')) {
    findings.push({
      type: 'DESCRIBE missing from Public header',
      severity: 'Low',
      confidence: 'medium',
      evidence: `Public: "${headers.public || '(absent)'}".`,
      recommendation:
        'Confirm the method inventory matches the documented API; hidden methods may still be accepted.',
    });
  }

  return {
    statusCode,
    vendor,
    vendorConfidence: confidence,
    serverBanner: server,
    publicMethods,
    contentBase,
    sdp,
    findings,
  };
}

export const RTSP_DESCRIBE_FINGERPRINTER = { fingerprintRtspDescribe, parseRtspResponse, parseSdp };
export default RTSP_DESCRIBE_FINGERPRINTER;
