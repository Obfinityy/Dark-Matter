/**
 * onvifDeviceDiscovery.js — ONVIF camera discovery-result analyzer.
 *
 * Analyses ONVIF ProbeMatch responses observed via WS-Discovery and extracts
 * camera metadata: device service addresses (XAddrs), ONVIF types
 * (e.g. dn:NetworkVideoTransmitter), scopes (name/location/profile hints) and
 * the MetadataVersion. Flags anonymous camera discovery and default-service
 * exposure patterns relevant to an authorized assessment.
 *
 * This module only analyses observed probe results — it performs no scanning.
 */

/** Parse "onvif://www.onvif.org/..." scope URIs into a friendlier map. */
export function parseOnvifScopes(scopes) {
  const result = { name: '', location: '', profiles: [], hardware: '', raw: scopes };
  for (const scope of scopes || []) {
    const s = String(scope);
    let m = s.match(/onvif:\/\/www\.onvif\.org\/name\/([^/]+)$/i);
    if (m) result.name = decodeURIComponent(m[1].replace(/_/g, ' '));
    m = s.match(/onvif:\/\/www\.onvif\.org\/location\/([^/]+)$/i);
    if (m) result.location = decodeURIComponent(m[1].replace(/_/g, ' '));
    m = s.match(/onvif:\/\/www\.onvif\.org\/profile\/([^/]+)$/i);
    if (m) result.profiles.push(m[1]);
    m = s.match(/onvif:\/\/www\.onvif\.org\/hardware\/([^/]+)$/i);
    if (m) result.hardware = m[1];
  }
  return result;
}

/**
 * Analyse an ONVIF ProbeMatch result.
 *
 * @param {{ envelope: string, sourceIp?: string }} input — the raw ProbeMatch SOAP envelope.
 * @returns {{ cameraFound: boolean, type, confidence, evidence, camera? }}
 */
export function analyzeOnvifProbeMatch({ envelope = '', sourceIp = 'unknown' }) {
  if (!envelope || typeof envelope !== 'string') {
    return { cameraFound: false, type: 'No ONVIF Data', confidence: 'none', evidence: 'No envelope supplied.' };
  }

  const xAddrsMatch = envelope.match(/<d:XAddrs[^>]*>([^<]*)<\/d:XAddrs>/i);
  const xAddrs = xAddrsMatch ? xAddrsMatch[1].trim().split(/\s+/).filter(Boolean) : [];
  const typesMatch = envelope.match(/<d:Types[^>]*>([^<]*)<\/d:Types>/i);
  const deviceTypes = typesMatch ? typesMatch[1].trim().split(/\s+/).filter(Boolean) : [];
  const scopesMatch = envelope.match(/<d:Scopes[^>]*>([^<]*)<\/d:Scopes>/i);
  const scopes = scopesMatch ? scopesMatch[1].trim().split(/\s+/).filter(Boolean) : [];
  const mvMatch = envelope.match(/<d:MetadataVersion[^>]*>([^<]*)<\/d:MetadataVersion>/i);
  const metadataVersion = mvMatch ? mvMatch[1].trim() : null;
  const endpointMatch = envelope.match(/<wsa:EndpointReference>[\s\S]*?<wsa:Address[^>]*>([^<]*)<\/wsa:Address>/i);
  const endpointAddress = endpointMatch ? endpointMatch[1].trim() : '';

  const isOnvif = /onvif/i.test(deviceTypes.join(' ')) || /onvif/i.test(scopes.join(' '));
  if (!isOnvif) {
    return { cameraFound: false, type: 'Not an ONVIF Device', confidence: 'high', evidence: 'ProbeMatch contains no ONVIF types or scopes.' };
  }

  const scopeInfo = parseOnvifScopes(scopes);
  const isVideoDevice = /NetworkVideoTransmitter|VideoEncoder|NetworkCamera/i.test(deviceTypes.join(' '));
  const onvifPort = xAddrs.find((a) => /onvif/i.test(a)) || xAddrs[0] || '';

  return {
    cameraFound: true,
    type: 'ONVIF Camera Discovered',
    confidence: 'high',
    severity: 'Info',
    cwe: 'CWE-200',
    evidence: `ONVIF device at ${sourceIp}${scopeInfo.name ? ` named "${scopeInfo.name}"` : ''}${scopeInfo.location ? ` in "${scopeInfo.location}"` : ''} exposes device service at ${onvifPort || 'unknown address'}${scopeInfo.profiles.length ? `; profiles: ${scopeInfo.profiles.join(', ')}` : ''}.`,
    camera: {
      sourceIp,
      xAddrs,
      deviceTypes,
      endpointAddress,
      metadataVersion,
      isVideoDevice,
      ...scopeInfo,
    },
  };
}

export const ONVIF_DEVICE_DISCOVERY = { analyzeOnvifProbeMatch, parseOnvifScopes };
export default ONVIF_DEVICE_DISCOVERY;
