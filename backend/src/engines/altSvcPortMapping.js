/**
 * altSvcPortMapping.js — Alt-Svc alternate-port mapping for autonomous bug bounty.
 *
 * Implements idea-bank item 00430: enumerate the alternate service ports
 * advertised per host from observed Alt-Svc headers, building a host ->
 * protocol -> port map and flagging anomalies.
 *
 * While HTTP/3 discovery (idea 00429) answers "is QUIC available", port
 * mapping answers "where": which hosts advertise which alternate ports for
 * which protocols. Non-standard ports (anything but 443/80), multiple
 * ports for one protocol on a single host, and port variance across a
 * fleet are inventory signals — load-balancer quirks, canary deploys, or
 * legacy QUIC listeners — worth mapping during an authorized engagement.
 *
 * All functions are pure and side-effect free: they aggregate Alt-Svc
 * header strings the caller observed during an authorized engagement.
 * Parsing is delegated to http3AltSvcDiscovery.js. No probes are sent.
 */

import { parseAltSvcHeader } from './http3AltSvcDiscovery.js';

/**
 * Build a host -> protocol -> port map from Alt-Svc observations.
 * @param {Array<{host?: string, url?: string, altSvc?: string|string[]}>} observations
 *   Each observation names a host (or a URL it was observed on) plus the
 *   Alt-Svc header value(s) seen there.
 * @returns {{
 *   hosts: Record<string, Record<string, number[]>>,
 *   hostCount: number, advertisementCount: number,
 *   protocolsSeen: string[]
 * }}
 */
export function mapAltSvcPorts(observations = []) {
  const list = Array.isArray(observations) ? observations : [];
  const hosts = {};
  let advertisementCount = 0;
  const protocolsSeen = new Set();

  const hostOf = obs => {
    if (typeof obs.host === 'string' && obs.host.trim() !== '')
      return obs.host.trim().toLowerCase();
    if (typeof obs.url === 'string') {
      try {
        return new URL(obs.url).host.toLowerCase();
      } catch {
        return null;
      }
    }
    return null;
  };

  for (const obs of list) {
    const host = hostOf(obs || {});
    if (!host) continue;
    const entries = parseAltSvcHeader(obs.altSvc);
    if (entries.length === 0) continue;
    if (!hosts[host]) hosts[host] = {};
    for (const e of entries) {
      protocolsSeen.add(e.protocolId);
      advertisementCount += 1;
      if (!hosts[host][e.protocolId]) hosts[host][e.protocolId] = new Set();
      if (e.port !== null) hosts[host][e.protocolId].add(e.port);
      else hosts[host][e.protocolId].add(443); // authority without explicit port implies the default
    }
  }

  const normalized = {};
  for (const [host, protos] of Object.entries(hosts)) {
    normalized[host] = {};
    for (const [proto, ports] of Object.entries(protos)) {
      normalized[host][proto] = [...ports].sort((a, b) => a - b);
    }
  }
  return {
    hosts: normalized,
    hostCount: Object.keys(normalized).length,
    advertisementCount,
    protocolsSeen: [...protocolsSeen].sort(),
  };
}

/**
 * Flag alternate-port anomalies in a host -> protocol -> port map.
 * Anomaly kinds:
 *  - non-standard-port: alternate port other than 443 (or 80) for a protocol
 *  - multi-port-protocol: one protocol advertised on several ports for one host
 *  - fleet-variance: same protocol mapped to different ports across hosts
 * @param {{hosts: Record<string, Record<string, number[]>>}} mapping Output of mapAltSvcPorts.
 * @returns {Array<{kind: string, host?: string, protocol?: string, ports?: number[], detail: string}>}
 */
export function findAlternatePortAnomalies(mapping) {
  const anomalies = [];
  const hosts = (mapping && mapping.hosts) || {};
  const STANDARD = new Set([80, 443]);

  for (const [host, protos] of Object.entries(hosts)) {
    for (const [proto, ports] of Object.entries(protos)) {
      const nonStandard = ports.filter(p => !STANDARD.has(p));
      if (nonStandard.length > 0) {
        anomalies.push({
          kind: 'non-standard-port',
          host,
          protocol: proto,
          ports: nonStandard,
          detail: `${host} advertises ${proto} on non-standard port(s): ${nonStandard.join(', ')}`,
        });
      }
      if (ports.length > 1) {
        anomalies.push({
          kind: 'multi-port-protocol',
          host,
          protocol: proto,
          ports,
          detail: `${host} advertises ${proto} on multiple ports: ${ports.join(', ')} — possible heterogeneous listeners`,
        });
      }
    }
  }

  // Cross-host variance for the same protocol.
  const protoPorts = new Map();
  for (const [host, protos] of Object.entries(hosts)) {
    for (const [proto, ports] of Object.entries(protos)) {
      if (!protoPorts.has(proto)) protoPorts.set(proto, new Map());
      protoPorts.get(proto).set(host, ports.join(','));
    }
  }
  for (const [proto, perHost] of protoPorts.entries()) {
    const variants = new Set(perHost.values());
    if (variants.size > 1) {
      anomalies.push({
        kind: 'fleet-variance',
        protocol: proto,
        detail: `${proto} is advertised on different ports across hosts: ${[...perHost.entries()].map(([h, p]) => `${h}=[${p}]`).join('; ')}`,
      });
    }
  }
  return anomalies;
}

/**
 * One-call summary: build the port map and list anomalies with counts.
 * @param {Array} observations Same shape as mapAltSvcPorts input.
 * @returns {{mapping: object, anomalies: Array, anomalyCount: number, summary: string}}
 */
export function summarizeAltSvcPorts(observations = []) {
  const mapping = mapAltSvcPorts(observations);
  const anomalies = findAlternatePortAnomalies(mapping);
  const summary = `${mapping.hostCount} host(s) advertise ${mapping.advertisementCount} alternate-service entries across ${mapping.protocolsSeen.length} protocol(s); ${anomalies.length} anomal${anomalies.length === 1 ? 'y' : 'ies'} flagged`;
  return { mapping, anomalies, anomalyCount: anomalies.length, summary };
}
