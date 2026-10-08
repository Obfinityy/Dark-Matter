/**
 * netIntelCorrelator.js — Network-intelligence correlation for service discovery.
 *
 * Correlates locally observed network telemetry (eBPF socket/binding
 * observations from a deployed agent, NetFlow records, darknet-telescope
 * backscatter, sinkhole query logs) into service maps and incident context.
 * All functions operate on telemetry the agent has already collected during
 * an authorized assessment — they perform passive analysis only.
 */

/**
 * Well-known ports used as heuristics when mapping local bindings and
 * NetFlow records to candidate services. The agent never trusts the port
 * alone; it is reported alongside a confidence level.
 */
export const PORT_SERVICE_HINTS = {
  21: 'FTP',
  22: 'SSH',
  23: 'Telnet',
  25: 'SMTP',
  53: 'DNS',
  67: 'DHCP',
  80: 'HTTP',
  110: 'POP3',
  143: 'IMAP',
  389: 'LDAP',
  443: 'HTTPS',
  445: 'SMB',
  465: 'SMTPS',
  587: 'SMTP submission',
  636: 'LDAPS',
  1433: 'MSSQL',
  1521: 'Oracle DB',
  2049: 'NFS',
  2181: 'ZooKeeper',
  2375: 'Docker API',
  2376: 'Docker TLS API',
  3306: 'MySQL',
  3389: 'RDP',
  5432: 'PostgreSQL',
  5601: 'Kibana',
  5672: 'AMQP',
  5900: 'VNC',
  5985: 'WinRM HTTP',
  5986: 'WinRM HTTPS',
  6379: 'Redis',
  6443: 'Kubernetes API',
  8000: 'HTTP alt',
  8080: 'HTTP alt/proxy',
  8443: 'HTTPS alt',
  8500: 'Consul HTTP',
  9000: 'PHP-FPM/MinIO',
  9090: 'Prometheus/metrics',
  9200: 'Elasticsearch',
  9300: 'Elasticsearch transport',
  11211: 'Memcached',
  27017: 'MongoDB',
};

/** Volume heuristics (bytes per packet) for traffic-class inference. */
const TRAFFIC_CLASS = {
  INTERACTIVE: {
    label: 'interactive',
    bpp: [0, 200],
    note: 'Small packets: shells, chat, control traffic.',
  },
  REQUEST_RESPONSE: {
    label: 'request-response',
    bpp: [200, 1500],
    note: 'Web/API-shaped traffic.',
  },
  BULK_TRANSFER: {
    label: 'bulk-transfer',
    bpp: [1500, Infinity],
    note: 'Large packets: file transfer, exfil-shaped or backup traffic.',
  },
};

/** ICMP backscatter classification table for darknet-telescope analysis. */
const BACKSCATTER_CLASSES = {
  3: {
    name: 'destination-unreachable',
    context: 'Typical reply to scans/DDoS probes using spoofed source addresses.',
  },
  11: {
    name: 'time-exceeded',
    context: 'TTL expiry — common when spoofed traffic traverses routed paths.',
  },
  5: {
    name: 'redirect',
    context: 'ICMP redirect backscatter; spoofed traffic triggering path changes.',
  },
};

/**
 * Normalize eBPF-derived socket/binding observations from a deployed agent
 * into a local service map (idea 597). The agent supplies the observations
 * (collected with its own eBPF tooling); this module structures them into
 * a service inventory. No kernel interaction happens here.
 *
 * @param {Array<object>} observations - eBPF socket events: { pid, process, localAddr, localPort, remoteAddr, remotePort, proto, state, uid? }
 * @returns {{ services: Array, listeners: Array, count }}
 */
export function mapServicesEbpf(observations = []) {
  const listeners = new Map();
  const services = [];

  for (const obs of observations) {
    if (!obs || typeof obs !== 'object') continue;
    const port = Number(obs.localPort);
    const proto = String(obs.proto || 'tcp').toLowerCase();
    const state = String(obs.state || 'unknown').toLowerCase();
    const key = `${proto}/${port}`;

    if (!listeners.has(key)) {
      const hint = PORT_SERVICE_HINTS[port] || null;
      listeners.set(key, {
        port,
        proto,
        state,
        processes: new Map(),
        serviceHint: hint,
        confidence: hint ? 'medium' : 'low',
        peers: new Set(),
      });
    }
    const entry = listeners.get(key);
    const proc = String(obs.process || 'unknown');
    entry.processes.set(proc, (entry.processes.get(proc) || 0) + 1);
    if (obs.remoteAddr && String(obs.remoteAddr).length > 0) {
      entry.peers.add(String(obs.remoteAddr));
    }
  }

  for (const entry of listeners.values()) {
    services.push({
      port: entry.port,
      proto: entry.proto,
      state: entry.state,
      processes: [...entry.processes.entries()].map(([name, events]) => ({ name, events })),
      serviceHint: entry.serviceHint,
      confidence: entry.confidence,
      peerCount: entry.peers.size,
      exposed: entry.state === 'listening' || entry.state === 'listen',
    });
  }

  services.sort((a, b) => a.port - b.port);
  return {
    services,
    listeners: services.filter(s => s.exposed),
    count: services.length,
  };
}

/**
 * Infer services from NetFlow/IPFIX-style records using port, volume and
 * peer heuristics (idea 598). Passive analysis of already-exported flows.
 *
 * @param {Array<object>} flows - Flow records: { srcIp, dstIp, srcPort, dstPort, proto, bytes, packets, startMs, endMs }
 * @param {object} [options]
 * @param {string[]} [options.localNets] - Prefixes considered internal (for direction labeling).
 * @returns {{ inferredServices: Array, flowStats }}
 */
export function inferServicesNetflow(flows = [], options = {}) {
  const { localNets = [] } = options;
  const perPort = new Map();
  let totalBytes = 0;
  let totalFlows = 0;

  const isLocal = ip => localNets.some(n => String(ip).startsWith(n));

  for (const f of flows) {
    if (!f || typeof f !== 'object') continue;
    const dstPort = Number(f.dstPort);
    const bytes = Number(f.bytes) || 0;
    const packets = Number(f.packets) || 0;
    totalBytes += bytes;
    totalFlows += 1;

    const key = `${String(f.proto || 'tcp').toLowerCase()}/${dstPort}`;
    if (!perPort.has(key)) {
      perPort.set(key, {
        bytes: 0,
        packets: 0,
        flows: 0,
        peers: new Set(),
        destinations: new Set(),
      });
    }
    const agg = perPort.get(key);
    agg.bytes += bytes;
    agg.packets += packets;
    agg.flows += 1;
    if (f.srcIp) agg.peers.add(String(f.srcIp));
    if (f.dstIp) agg.destinations.add(String(f.dstIp));
  }

  const inferredServices = [];
  for (const [key, agg] of perPort) {
    const [, portStr] = key.split('/');
    const port = Number(portStr);
    const hint = PORT_SERVICE_HINTS[port] || null;
    const bpp = agg.packets > 0 ? agg.bytes / agg.packets : 0;
    const trafficClass = Object.values(TRAFFIC_CLASS).find(t => bpp >= t.bpp[0] && bpp < t.bpp[1]);
    const durationHint =
      agg.flows > 0 && agg.bytes / agg.flows > 1_000_000 ? 'long-lived-bulk' : 'short-lived';

    const score =
      (hint ? 2 : 0) +
      (agg.peers.size >= 3 ? 1 : 0) +
      (agg.flows >= 5 ? 1 : 0) +
      (bpp > 1500 ? 1 : 0);

    inferredServices.push({
      port,
      proto: key.split('/')[0],
      serviceHint: hint,
      confidence: score >= 4 ? 'high' : score >= 2 ? 'medium' : 'low',
      flows: agg.flows,
      bytes: agg.bytes,
      bytesPerPacket: Math.round(bpp),
      trafficClass: trafficClass ? trafficClass.label : 'unknown',
      trafficNote: trafficClass ? trafficClass.note : '',
      durationHint,
      peerCount: agg.peers.size,
      destinationCount: agg.destinations.size,
      samplePeers: [...agg.peers].slice(0, 5),
    });
  }

  inferredServices.sort((a, b) => b.bytes - a.bytes);
  return {
    inferredServices,
    flowStats: { totalFlows, totalBytes, distinctPorts: perPort.size },
  };
}

/**
 * Analyze darknet-telescope backscatter packets directed at the target's
 * IPs to derive spoofed-attack context (idea 599). Input is packets the
 * telescope operator shared for the authorized assessment — unsolicited
 * replies whose presence indicates someone is spoofing the target's
 * addresses elsewhere on the Internet.
 *
 * @param {Array<object>} packets - Backscatter: { protocol, icmpType?, tcpFlags?, srcIp, dstIp, dstPort?, tsMs }
 * @param {string[]} targetIps - The assessed target's address space.
 * @returns {{ attackContext: Array, summary }}
 */
export function analyzeBackscatter(packets = [], targetIps = []) {
  const targetSet = new Set(targetIps.map(String));
  const windows = new Map(); // per-target-ip aggregation

  for (const p of packets) {
    if (!p || typeof p !== 'object') continue;
    const dstIp = String(p.dstIp || '');
    if (!targetSet.has(dstIp)) continue;

    if (!windows.has(dstIp)) {
      windows.set(dstIp, {
        packets: 0,
        icmp: {},
        tcpFlags: {},
        firstSeen: Infinity,
        lastSeen: 0,
        sources: new Set(),
      });
    }
    const agg = windows.get(dstIp);
    agg.packets += 1;
    agg.firstSeen = Math.min(agg.firstSeen, Number(p.tsMs) || 0);
    agg.lastSeen = Math.max(agg.lastSeen, Number(p.tsMs) || 0);
    if (p.srcIp) agg.sources.add(String(p.srcIp));

    const proto = String(p.protocol || 'icmp').toLowerCase();
    if (proto === 'icmp' && p.icmpType !== undefined) {
      const t = Number(p.icmpType);
      agg.icmp[t] = (agg.icmp[t] || 0) + 1;
    } else if (proto === 'tcp' && p.tcpFlags) {
      const flags = String(p.tcpFlags);
      agg.tcpFlags[flags] = (agg.tcpFlags[flags] || 0) + 1;
    }
  }

  const attackContext = [];
  for (const [ip, agg] of windows) {
    const classifications = Object.entries(agg.icmp).map(([type, count]) => ({
      kind: `icmp-${type}`,
      name: BACKSCATTER_CLASSES[type] ? BACKSCATTER_CLASSES[type].name : 'other-icmp',
      count,
      context: BACKSCATTER_CLASSES[type]
        ? BACKSCATTER_CLASSES[type].context
        : 'Unclassified ICMP backscatter.',
    }));

    if (agg.tcpFlags['RST'] || agg.tcpFlags['SA']) {
      classifications.push({
        kind: 'tcp-response',
        name: 'tcp-rst/syn-ack',
        count: (agg.tcpFlags['RST'] || 0) + (agg.tcpFlags['SA'] || 0),
        context:
          'TCP RST/SYN-ACK backscatter — the target IP is being used as a spoofed source in SYN floods or reflected scans.',
      });
    }

    const windowMs = agg.lastSeen > agg.firstSeen ? agg.lastSeen - agg.firstSeen : 0;
    const rate = windowMs > 0 ? (agg.packets / windowMs) * 1000 : agg.packets;
    const intensity = rate > 100 ? 'high' : rate > 10 ? 'medium' : 'low';

    attackContext.push({
      targetIp: ip,
      backscatterPackets: agg.packets,
      distinctSources: agg.sources.size,
      windowMs,
      ratePerSecond: Math.round(rate * 100) / 100,
      intensity,
      classifications,
      interpretation:
        intensity === 'high'
          ? 'High-rate backscatter indicates the target IP is actively being spoofed in a large attack — coordinate with the abuse/incident team.'
          : 'Backscatter present at background rates — the target address is being spoofed in routine scanning activity.',
    });
  }

  attackContext.sort((a, b) => b.ratePerSecond - a.ratePerSecond);
  return {
    attackContext,
    summary: {
      targetsHit: attackContext.length,
      totalPackets: [...windows.values()].reduce((s, a) => s + a.packets, 0),
      peakIntensity: attackContext.length > 0 ? attackContext[0].intensity : 'none',
    },
  };
}

/**
 * Correlate resolver queries against sinkholed target domains to find
 * infected clients (idea 600). A sinkholed domain is one the assessment
 * team took over at the DNS level; resolvers asking for it reveal hosts
 * that are still trying to reach the now-defunct malicious infrastructure.
 *
 * @param {Array<object>} queries - DNS queries: { resolverIp, domain, qtype, tsMs }
 * @param {string[]} sinkholedDomains - Sinkholed domains for this assessment.
 * @param {object} [options]
 * @param {number} [options.minQueries] - Minimum queries to flag a resolver (default 3).
 * @returns {{ indicators: Array, summary }}
 */
export function analyzeSinkholeQueries(queries = [], sinkholedDomains = [], options = {}) {
  const { minQueries = 3 } = options;
  const sinkholed = new Set(sinkholedDomains.map(d => String(d).toLowerCase().replace(/\.$/, '')));
  const byResolver = new Map();

  for (const q of queries) {
    if (!q || typeof q !== 'object') continue;
    const domain = String(q.domain || '')
      .toLowerCase()
      .replace(/\.$/, '');
    const matched =
      sinkholed.has(domain) || [...sinkholed].some(s => domain === s || domain.endsWith(`.${s}`));
    if (!matched) continue;

    const resolver = String(q.resolverIp || 'unknown');
    if (!byResolver.has(resolver)) {
      byResolver.set(resolver, {
        queries: 0,
        domains: new Set(),
        firstSeen: Infinity,
        lastSeen: 0,
      });
    }
    const agg = byResolver.get(resolver);
    agg.queries += 1;
    agg.domains.add(domain);
    agg.firstSeen = Math.min(agg.firstSeen, Number(q.tsMs) || 0);
    agg.lastSeen = Math.max(agg.lastSeen, Number(q.tsMs) || 0);
  }

  const indicators = [];
  for (const [resolverIp, agg] of byResolver) {
    const flagged = agg.queries >= minQueries;
    indicators.push({
      resolverIp,
      sinkholeQueries: agg.queries,
      domainsQueried: [...agg.domains],
      domainCount: agg.domains.size,
      firstSeen: agg.firstSeen === Infinity ? null : agg.firstSeen,
      lastSeen: agg.lastSeen === 0 ? null : agg.lastSeen,
      flagged,
      confidence: agg.queries >= minQueries * 3 ? 'high' : flagged ? 'medium' : 'low',
      note: flagged
        ? 'Repeated queries for sinkholed domains indicate infected clients behind this resolver.'
        : 'Occasional sinkhole queries — below the flagging threshold; likely background noise.',
    });
  }

  indicators.sort((a, b) => b.sinkholeQueries - a.sinkholeQueries);
  return {
    indicators,
    summary: {
      resolversSeen: indicators.length,
      resolversFlagged: indicators.filter(i => i.flagged).length,
      distinctSinkholedDomains: new Set(indicators.flatMap(i => i.domainsQueried)).size,
    },
  };
}
