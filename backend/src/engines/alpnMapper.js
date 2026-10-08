/**
 * alpnMapper.js — ALPN negotiation mapping for service discovery.
 *
 * TLS Application-Layer Protocol Negotiation (ALPN) reveals which application
 * protocols each endpoint offers (h2, http/1.1, h3, mqtt, xmpp-client, ...).
 * This module takes already-collected per-port ALPN probe results and builds
 * a service map: which services each port offers, anomalies (e.g. h2 on
 * port 80, unexpected IoT protocols), and a per-host protocol matrix.
 * Pure analysis: takes collected probe data as input, no network I/O.
 */

/** Well-known ALPN protocol identifiers → service description. */
export const ALPN_REGISTRY = {
  h2: 'HTTP/2',
  h3: 'HTTP/3 (QUIC)',
  'http/1.1': 'HTTP/1.1',
  'http/1.0': 'HTTP/1.0',
  'spdy/3.1': 'SPDY (legacy)',
  mqtt: 'MQTT (IoT messaging)',
  'xmpp-client': 'XMPP client',
  'xmpp-server': 'XMPP server',
  webrtc: 'WebRTC',
  'c-webrtc': 'WebRTC (control)',
  'stun.turn': 'STUN/TURN',
  'stun.nat-discovery': 'STUN NAT discovery',
  ftp: 'FTP over TLS',
  imap: 'IMAP',
  pop3: 'POP3',
  smtp: 'SMTP',
  nntp: 'NNTP',
  'acme-tls/1': 'ACME TLS-ALPN challenge',
  dot: 'DNS-over-TLS',
  smb2: 'SMB2',
  irc: 'IRC',
  telnets: 'Telnet over TLS',
  coap: 'CoAP',
  quic: 'QUIC (generic)',
};

/** Ports where a protocol is conventionally expected. */
const EXPECTED_PORTS = {
  h2: [443, 8443, 9443],
  h3: [443, 8443],
  'http/1.1': [80, 443, 8080, 8000, 8443, 3000, 5000, 8888],
  mqtt: [8883, 1883],
  'xmpp-client': [5222],
  'xmpp-server': [5269],
  dot: [853],
  imap: [993],
  pop3: [995],
  smtp: [465, 587],
};

/**
 * Describe one ALPN identifier.
 * @returns {{protocol: string, service: string, known: boolean}}
 */
export function describeAlpn(protocol) {
  const p = String(protocol || '');
  const service = ALPN_REGISTRY[p];
  return { protocol: p, service: service || 'custom/unknown protocol', known: !!service };
}

/**
 * Map ALPN offerings across ports into a service matrix.
 *
 * @param {Object} args
 * @param {Array<Object>} args.probes - One entry per probed port:
 *   { port, offered: [protocolIds...], selected, tlsOk, note }
 * @returns {{services: Array, matrix: Array, anomalies: Array, summary: Object}}
 */
export function mapAlpn({ probes = [] } = {}) {
  const services = [];
  const matrix = [];
  const anomalies = [];
  const protocolPorts = new Map();

  for (const probe of probes) {
    const port = probe.port;
    const offered = Array.isArray(probe.offered) ? probe.offered : [];
    const selected = probe.selected || null;
    const row = { port, tlsOk: !!probe.tlsOk, selected, protocols: [] };

    for (const proto of offered) {
      const info = describeAlpn(proto);
      row.protocols.push(info);
      if (!protocolPorts.has(proto)) protocolPorts.set(proto, []);
      protocolPorts.get(proto).push(port);

      // Anomaly: protocol offered on a port where it is unexpected.
      const expected = EXPECTED_PORTS[proto];
      if (expected && !expected.includes(Number(port))) {
        anomalies.push({
          type: 'unexpected-port',
          protocol: proto,
          port,
          confidence: 'medium',
          evidence: `${info.service} offered on port ${port}; conventionally seen on ${expected.join(', ')}.`,
        });
      }
      // Anomaly: no ALPN at all on a modern TLS port.
      // Anomaly: unknown/custom protocol — may indicate proprietary service.
      if (!info.known) {
        anomalies.push({
          type: 'unknown-protocol',
          protocol: proto,
          port,
          confidence: 'low',
          evidence: `Unregistered ALPN identifier "${proto}" on port ${port} — possibly a proprietary service.`,
        });
      }
    }

    // h2 offered but no http/1.1 fallback can indicate a hardened API edge.
    const ids = new Set(offered);
    if (ids.has('h2') && !ids.has('http/1.1')) {
      anomalies.push({
        type: 'no-http11-fallback',
        port,
        confidence: 'low',
        evidence: `Port ${port} offers h2 but no http/1.1 fallback — likely a dedicated API edge.`,
      });
    }
    // Selected protocol not in offered list: inconsistent server behavior.
    if (selected && !ids.has(selected)) {
      anomalies.push({
        type: 'inconsistent-selection',
        port,
        confidence: 'high',
        evidence: `Server selected "${selected}" but it was not in the offered list — anomalous ALPN behavior.`,
      });
    }

    matrix.push(row);
  }

  for (const [proto, ports] of protocolPorts) {
    const info = describeAlpn(proto);
    services.push({
      protocol: proto,
      service: info.service,
      known: info.known,
      ports: [...new Set(ports)].sort((a, b) => a - b),
      multiHomed: ports.length > 1,
    });
  }
  services.sort((a, b) => a.ports[0] - b.ports[0]);

  return {
    services,
    matrix,
    anomalies: anomalies.sort((a, b) => (b.confidence === 'high') - (a.confidence === 'high')),
    summary: {
      portsProbed: probes.length,
      tlsPorts: probes.filter(p => p.tlsOk).length,
      distinctProtocols: protocolPorts.size,
      knownServices: services.filter(s => s.known).length,
      unknownProtocols: services.filter(s => !s.known).length,
      anomalyCount: anomalies.length,
    },
  };
}

export const ALPN_MAPPER = { mapAlpn, describeAlpn, ALPN_REGISTRY };
export default ALPN_MAPPER;
