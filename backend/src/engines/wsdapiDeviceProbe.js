/**
 * wsdapiDeviceProbe.js — WS-Discovery / WSDAPI device-metadata analyzer.
 *
 * Analyses WS-Discovery ProbeMatch (or Hello) SOAP envelopes observed on the
 * network and extracts WSDAPI device metadata: manufacturer, model, friendly
 * name, device types and scopes. Wide metadata exposure from unmanaged
 * devices (printers, cameras, IoT gateways) is an information-disclosure
 * surface worth flagging in a bug-bounty context.
 *
 * This module only analyses observed envelopes — it performs no probing.
 */

/** Known device-type keywords mapped to a device class. */
const DEVICE_TYPE_CLASSES = [
  { pattern: /networkprinter|printdevice/i, deviceClass: 'Printer' },
  { pattern: /networkvideotransmitter|videoencoder/i, deviceClass: 'Camera' },
  { pattern: /media renderer|mediaserver/i, deviceClass: 'Media device' },
  { pattern: /scanner/i, deviceClass: 'Scanner' },
  { pattern: /accesspoint|wireless/i, deviceClass: 'Access point' },
  { pattern: /gateway|router/i, deviceClass: 'Gateway' },
];

/**
 * Extract text content of the first occurrence of a namespaced tag.
 * @param {string} xml
 * @param {string} tag e.g. 'd:Manufacturer'
 */
function tagText(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i'));
  return m ? m[1].trim() : '';
}

/**
 * Analyse a WS-Discovery ProbeMatch/Hello SOAP envelope.
 *
 * @param {{ envelope: string, sourceIp?: string, metadataVersion?: number }} input
 * @returns {{ deviceFound: boolean, type, confidence, evidence, metadata?, deviceClass? }}
 */
export function analyzeWsdProbeMatch({
  envelope = '',
  sourceIp = 'unknown',
  metadataVersion = null,
}) {
  if (!envelope || typeof envelope !== 'string') {
    return {
      deviceFound: false,
      type: 'No WSDAPI Data',
      confidence: 'none',
      evidence: 'No envelope supplied.',
    };
  }

  const metadata = {
    manufacturer: tagText(envelope, 'd:Manufacturer'),
    manufacturerUrl: tagText(envelope, 'd:ManufacturerUrl'),
    modelName: tagText(envelope, 'd:ModelName'),
    modelNumber: tagText(envelope, 'd:ModelNumber'),
    modelUrl: tagText(envelope, 'd:ModelUrl'),
    friendlyName: tagText(envelope, 'd:FriendlyName'),
    firmwareVersion: tagText(envelope, 'd:FirmwareVersion'),
    serialNumber: tagText(envelope, 'd:SerialNumber'),
    presentationUrl: tagText(envelope, 'd:PresentationUrl'),
  };

  const typesMatch = envelope.match(/<d:Types[^>]*>([^<]*)<\/d:Types>/i);
  const deviceTypes = typesMatch ? typesMatch[1].trim().split(/\s+/).filter(Boolean) : [];
  const scopesMatch = envelope.match(/<d:Scopes[^>]*>([^<]*)<\/d:Scopes>/i);
  const scopes = scopesMatch ? scopesMatch[1].trim().split(/\s+/).filter(Boolean) : [];
  const xAddrsMatch = envelope.match(/<d:XAddrs[^>]*>([^<]*)<\/d:XAddrs>/i);
  const xAddrs = xAddrsMatch ? xAddrsMatch[1].trim().split(/\s+/).filter(Boolean) : [];

  const deviceFound = Boolean(
    metadata.manufacturer || metadata.modelName || metadata.friendlyName || deviceTypes.length
  );

  if (!deviceFound) {
    return {
      deviceFound: false,
      type: 'No WSDAPI Data',
      confidence: 'none',
      evidence: 'Envelope contained no device metadata.',
    };
  }

  const joinedTypes = deviceTypes.join(' ');
  const classHit = DEVICE_TYPE_CLASSES.find(({ pattern }) => pattern.test(joinedTypes));
  const deviceClass = classHit ? classHit.deviceClass : 'Unknown device';

  const disclosed = Object.entries(metadata)
    .filter(([, v]) => v)
    .map(([k]) => k);
  const sensitive = disclosed.filter(k =>
    ['serialNumber', 'firmwareVersion', 'presentationUrl'].includes(k)
  );

  return {
    deviceFound: true,
    type: 'WSDAPI Device Metadata Exposed',
    confidence: sensitive.length ? 'high' : 'medium',
    severity: sensitive.length ? 'Low' : 'Info',
    cwe: 'CWE-200',
    evidence: `WS-Discovery device at ${sourceIp}: ${metadata.manufacturer || '?'} ${metadata.modelName || ''} (${deviceClass}) exposes ${disclosed.length} metadata fields: ${disclosed.join(', ')}.`,
    deviceClass,
    metadata: { ...metadata, deviceTypes, scopes, xAddrs, metadataVersion },
    sourceIp,
    sensitiveFields: sensitive,
  };
}

export const WSDAPI_DEVICE_PROBE = { analyzeWsdProbeMatch, DEVICE_TYPE_CLASSES };
export default WSDAPI_DEVICE_PROBE;
