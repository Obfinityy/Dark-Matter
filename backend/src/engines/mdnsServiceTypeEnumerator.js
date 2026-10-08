/**
 * mdnsServiceTypeEnumerator.js — mDNS service-type enumeration (idea 00523).
 *
 * Defensive asset-discovery for an authorized bug-bounty agent. Multicast
 * DNS service discovery (DNS-SD over mDNS, RFC 6763) lets any observer on
 * the segment enumerate every advertised service type
 * (`_http._tcp.local`, `_printer._tcp.local`, `_ssh._tcp.local`, …) via the
 * service-type enumeration meta-query, then browse each type for instances.
 * Aggregating observed service-type PTR records maps the local service
 * landscape: which hosts offer web, print, file-sharing, remote access,
 * IoT, and management services.
 *
 * Pure analyzer: the caller supplies parsed mDNS observations (PTR record
 * lists, service-instance advertisements, or dns-sd/avahi-browse output).
 * This module never sends multicast queries itself.
 *
 * Complements mdnsLocalIntel.js (which harvests .local hostnames); this
 * module focuses on the service-TYPE taxonomy and per-type instance maps.
 */

/** Well-known DNS-SD service types and their security relevance. */
export const MDNS_SERVICE_TYPES = {
  '_http._tcp': { description: 'HTTP web server', risk: 'may expose management UI' },
  '_https._tcp': { description: 'HTTPS web server', risk: 'may expose management UI over TLS' },
  '_printer._tcp': {
    description: 'Printer (LPR/LPD or IPP)',
    risk: 'printer admin panels often unauthenticated',
  },
  '_ipp._tcp': { description: 'IPP printing', risk: 'IPP attributes can leak device info' },
  '_ssh._tcp': { description: 'SSH', risk: 'remote shell exposure on LAN' },
  '_sftp-ssh._tcp': { description: 'SFTP over SSH', risk: 'file-transfer exposure' },
  '_smb._tcp': { description: 'SMB file sharing', risk: 'share enumeration target' },
  '_afpovertcp._tcp': { description: 'AFP file sharing', risk: 'legacy file protocol exposure' },
  '_nfs._tcp': { description: 'NFS', risk: 'export-list probing target' },
  '_ftp._tcp': { description: 'FTP', risk: 'often anonymous/weak credentials' },
  '_telnet._tcp': { description: 'Telnet', risk: 'cleartext remote access — flag immediately' },
  '_vnc._tcp': { description: 'VNC remote desktop', risk: 'screen-sharing exposure' },
  '_rdp._tcp': { description: 'RDP', risk: 'remote desktop exposure' },
  '_airplay._tcp': { description: 'AirPlay receiver', risk: 'media receiver, usually benign' },
  '_raop._tcp': { description: 'AirPlay audio', risk: 'usually benign' },
  '_hap._tcp': { description: 'HomeKit accessory', risk: 'IoT device' },
  '_homekit._tcp': { description: 'HomeKit', risk: 'IoT device' },
  '_mqtt._tcp': { description: 'MQTT broker', risk: 'IoT messaging — check auth' },
  '_coap._udp': { description: 'CoAP', risk: 'IoT protocol exposure' },
  '_workstation._tcp': { description: 'Workstation', risk: 'generic host advertisement' },
  '_device-info._tcp': { description: 'Device info', risk: 'TXT records may leak model/firmware' },
  '_sleep-proxy._udp': { description: 'Sleep proxy', risk: 'usually benign' },
  '_spotify-connect._tcp': { description: 'Spotify Connect', risk: 'usually benign' },
  '_googlecast._tcp': { description: 'Chromecast', risk: 'usually benign' },
};

/**
 * Normalize a service-type string to canonical `_svc._proto` form.
 * @param {string} raw
 * @returns {string}
 */
export function normalizeServiceType(raw = '') {
  return String(raw)
    .trim()
    .toLowerCase()
    .replace(/\.local\.?$/, '');
}

/**
 * Parse DNS-SD enumeration output: service-type PTR records plus instances.
 * Accepts rows shaped {type: '_http._tcp.local', instances: ['host1._http._tcp.local', ...]}
 * or flat lists of advertised service strings.
 * @param {{types?: Array<{type: string, instances?: string[]}>, advertisements?: string[]}} input
 * @returns {{type: string, confidence: 'high'|'medium'|'low', serviceTypes: Array<{serviceType: string, description: string, risk: string, instanceCount: number, instances: string[]}>, interestingServices: string[], evidence: string}}
 */
export function enumerateMdnsServiceTypes(input = {}) {
  const byType = new Map();

  const addType = (type, instance) => {
    const key = normalizeServiceType(type);
    if (!key.startsWith('_')) return;
    if (!byType.has(key)) byType.set(key, new Set());
    if (instance) byType.get(key).add(String(instance).trim());
  };

  for (const row of input.types || []) {
    addType(row.type, null);
    for (const inst of row.instances || []) addType(row.type, inst);
  }
  for (const adv of input.advertisements || []) {
    // Instance-style: "Office Printer._ipp._tcp.local." → derive type from tail.
    const m = String(adv).match(/(_[a-z0-9-]+\._(?:tcp|udp))(?:\.local)?\.?$/i);
    if (m) addType(m[1], adv);
  }

  const serviceTypes = [...byType.entries()]
    .map(([serviceType, instances]) => {
      const known = MDNS_SERVICE_TYPES[serviceType] || {
        description: 'Unrecognized service type',
        risk: 'unknown — investigate',
      };
      return {
        serviceType,
        description: known.description,
        risk: known.risk,
        instanceCount: instances.size,
        instances: [...instances],
      };
    })
    .sort((a, b) => b.instanceCount - a.instanceCount);

  // Flag services that are security-relevant for the authorized assessment.
  const interestingServices = serviceTypes
    .filter(s =>
      /_telnet\._tcp|_ftp\._tcp|_vnc\._tcp|_smb\._tcp|_afpovertcp\._tcp|_nfs\._tcp|_rdp\._tcp/.test(
        s.serviceType
      )
    )
    .map(s => s.serviceType);

  return {
    type: 'mDNS Service-Type Enumeration',
    confidence: serviceTypes.length > 0 ? 'high' : 'low',
    serviceTypes,
    interestingServices,
    evidence:
      serviceTypes.length === 0
        ? 'No mDNS service types observed.'
        : `${serviceTypes.length} service type(s) observed: ` +
          serviceTypes
            .map(
              s =>
                `${s.serviceType} (${s.instanceCount} instance${s.instanceCount === 1 ? '' : 's'})`
            )
            .join(', ') +
          (interestingServices.length
            ? `. Security-relevant: ${interestingServices.join(', ')}.`
            : '. No high-risk service types seen.'),
  };
}

/**
 * Build a per-host service-landscape map from instance advertisements.
 * @param {{instances: Array<{instance: string, serviceType: string, host?: string, address?: string}>}} input
 * @returns {{type: string, hosts: Array<{host: string, address: string|null, services: string[]}>, evidence: string}}
 */
export function mapServiceLandscape(input = {}) {
  const hosts = new Map();
  for (const row of input.instances || []) {
    const host = String(row.host || row.instance || 'unknown').trim();
    if (!hosts.has(host))
      hosts.set(host, { host, address: row.address || null, services: new Set() });
    hosts.get(host).services.add(normalizeServiceType(row.serviceType));
    if (row.address && !hosts.get(host).address) hosts.get(host).address = row.address;
  }
  const hostList = [...hosts.values()].map(h => ({ ...h, services: [...h.services].sort() }));
  return {
    type: 'mDNS Service Landscape',
    hosts: hostList,
    evidence:
      hostList.length === 0
        ? 'No mDNS instances observed.'
        : `${hostList.length} host(s) advertising mDNS services: ` +
          hostList
            .map(h => `${h.host}${h.address ? ` (${h.address})` : ''} → ${h.services.join(', ')}`)
            .join('; '),
  };
}
