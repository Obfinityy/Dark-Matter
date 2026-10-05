/**
 * sipOptionsFingerprinter.js — SIP OPTIONS response fingerprinter.
 *
 * Parses a captured SIP OPTIONS response (status line + headers) and
 * fingerprints the PBX/registrar vendor from Server/User-Agent strings,
 * Allow headers, and Supported option tags. Pure parsing — no SIP traffic
 * is generated here.
 */

const VENDOR_SIGNATURES = [
  { vendor: 'Asterisk', re: /asterisk/i, confidence: 'high' },
  { vendor: 'FreeSWITCH', re: /freeswitch/i, confidence: 'high' },
  { vendor: 'Kamailio / OpenSIPS', re: /kamailio|opensips/i, confidence: 'high' },
  { vendor: 'Cisco', re: /cisco/i, confidence: 'high' },
  { vendor: 'Avaya', re: /avaya/i, confidence: 'high' },
  { vendor: 'Grandstream', re: /grandstream/i, confidence: 'high' },
  { vendor: 'Yealink', re: /yealink/i, confidence: 'high' },
  { vendor: '3CX', re: /3cx/i, confidence: 'high' },
  { vendor: 'FreePBX', re: /freepbx/i, confidence: 'medium' },
  { vendor: 'Snom', re: /snom/i, confidence: 'high' },
  { vendor: 'Polycom / Poly', re: /polycom|\bpoly\b/i, confidence: 'medium' },
  { vendor: 'Genesys', re: /genesys/i, confidence: 'medium' },
];

const ALLOW_METHODS = ['INVITE', 'ACK', 'CANCEL', 'BYE', 'OPTIONS', 'REGISTER', 'INFO', 'PRACK', 'UPDATE', 'SUBSCRIBE', 'NOTIFY', 'PUBLISH', 'REFER', 'MESSAGE'];

/**
 * Parse raw SIP response text into { statusCode, headers }.
 * @param {string} raw
 */
export function parseSipResponse(raw = '') {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const statusMatch = /^SIP\/2\.0\s+(\d{3})/i.exec(lines[0] || '');
  const headers = {};
  let current = null;
  for (const line of lines.slice(1)) {
    if (/^\s*$/.test(line)) break;
    if (/^[ \t]/.test(line) && current) {
      headers[current] += ' ' + line.trim();
      continue;
    }
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    current = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    headers[current] = headers[current] ? `${headers[current]}, ${value}` : value;
  }
  return { statusCode: statusMatch ? Number(statusMatch[1]) : 0, headers };
}

/**
 * Fingerprint a SIP server from a captured OPTIONS response.
 *
 * @param {{ response: string, headers?: Record<string,string>, statusCode?: number }} input
 *   response — raw SIP response text; headers/statusCode may be supplied instead.
 */
export function fingerprintSipOptions({ response = '', headers = null, statusCode = null } = {}) {
  const parsed = headers
    ? { headers: Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])), statusCode: statusCode || 0 }
    : parseSipResponse(response);

  const h = parsed.headers;
  const server = h.server || h['user-agent'] || '';
  const allow = (h.allow || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  const supported = (h.supported || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

  let vendor = 'Unknown';
  let confidence = 'low';
  let evidence = 'No vendor signature matched';
  for (const sig of VENDOR_SIGNATURES) {
    if (sig.re.test(server)) {
      vendor = sig.vendor;
      confidence = sig.confidence;
      evidence = `Server/User-Agent banner: "${server}"`;
      break;
    }
  }

  const knownMethods = allow.filter((m) => ALLOW_METHODS.includes(m));
  const unknownMethods = allow.filter((m) => !ALLOW_METHODS.includes(m));

  const findings = [
    {
      type: 'SIP server fingerprinted',
      severity: 'Info',
      confidence,
      evidence: `${evidence} | status ${parsed.statusCode}; Allow: ${allow.join(', ') || 'absent'}; Supported: ${supported.join(', ') || 'absent'}.`,
      recommendation: 'Version banners aid targeted testing; strip or genericize Server headers on public interfaces.',
    },
  ];

  if (!allow.includes('INVITE') || !allow.includes('BYE')) {
    findings.push({
      type: 'Unusual Allow header',
      severity: 'Low',
      confidence: 'medium',
      evidence: `Allow header is "${h.allow || '(missing)'}" — expected INVITE/BYE on a SIP endpoint.`,
      recommendation: 'Confirm the device class; missing methods may indicate a stripped-down or non-standard stack.',
    });
  }

  if (unknownMethods.length > 0) {
    findings.push({
      type: 'Non-standard SIP methods advertised',
      severity: 'Info',
      confidence: 'medium',
      evidence: `Advertised unknown methods: ${unknownMethods.join(', ')}.`,
      recommendation: 'Custom methods can hide proprietary attack surface; review vendor documentation.',
    });
  }

  return {
    statusCode: parsed.statusCode,
    vendor,
    vendorConfidence: confidence,
    serverBanner: server,
    allowMethods: allow,
    supportedOptions: supported,
    findings,
  };
}

export const SIP_OPTIONS_FINGERPRINTER = { fingerprintSipOptions, parseSipResponse };
export default SIP_OPTIONS_FINGERPRINTER;
