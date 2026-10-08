/**
 * switchTopologyRecon.js — Switch/LAN topology reconnaissance for authorized
 * bug bounty assessments.
 *
 * Analyses read-only network-device disclosures observed during an authorized
 * assessment:
 *  - VLAN hopping-surface mapping (idea 646): parse `show vlan` / trunk
 *    config disclosures to find native-VLAN mismatches and promiscuous
 *    trunks (all VLANs allowed) that widen the VLAN-hopping surface.
 *  - STP topology inference (idea 647): combine multiple BPDU observations
 *    into an inferred spanning-tree topology with root bridge and edges.
 *  - CDP/LLDP frame capture (idea 648): turn captured CDP/LLDP frames into
 *    a switch↔port↔hostname adjacency map.
 *  - ARP-table host harvesting (idea 649): parse ARP table dumps to
 *    enumerate LAN hosts and flag MAC anomalies (duplicates → possible
 *    spoofing candidates).
 *  - DHCP lease-pool inference (idea 650): infer lease pools, utilization
 *    and excluded ranges from DHCP server disclosures.
 *
 * All functions are pure analysis of already-observed data (CLI output,
 * captured frames, config snippets). Nothing here sends traffic, joins
 * VLANs, or touches a switch.
 */

import { analyzeBpdu } from './stpBpduAnalyzer.js';
import { analyzeCdpFrame } from './cdpFrameAnalyzer.js';
import { mapLldpNeighbor } from './lldpNeighborMapper.js';
import { lookupOuiVendor } from './arpTableEnricher.js';

/** ------------------------------------------------------------------
 *  646 — VLAN hopping-surface mapping
 * ------------------------------------------------------------------ */

const TRUNK_ENCAP_RE = /(802\.1q|isl|dot1q)/gi;

/**
 * Parse switch CLI disclosures (`show interfaces trunk`, `show vlan`,
 * running-config interface snippets) into a VLAN surface model.
 * Flags defensive findings:
 *  - trunk ports carrying all (or most) VLANs — wide hopping surface
 *  - native VLAN not 1 yet untagged traffic expected on trunks
 *  - native-VLAN mismatch between neighboring disclosures
 *  - access ports with voice/native VLAN extras
 *
 * @param {string|string[]} disclosures CLI output text (or list of outputs)
 * @returns {object} { parsed, ports, findings, nativeVlans }
 */
export function mapVlanSurface(disclosures) {
  const texts = Array.isArray(disclosures) ? disclosures : [disclosures];
  const text = texts.map(String).join('\n');
  const ports = [];
  const findings = [];

  for (const line of text.split(/\r?\n/)) {
    const trunk = line.match(/^\s*(\S+)\s+(trunk)\s+(\S+)?\s*([\d,\-\s]*)$/i);
    if (trunk) {
      ports.push({
        port: trunk[1],
        mode: 'trunk',
        nativeVlan: trunk[3] && /^\d+$/.test(trunk[3]) ? Number(trunk[3]) : null,
        allowedVlans: expandVlanList(trunk[4] || ''),
      });
      continue;
    }
    const access = line.match(/^\s*(\S+)\s+access\s+(\d{1,4})\s*$/i);
    if (access) {
      ports.push({
        port: access[1],
        mode: 'access',
        nativeVlan: Number(access[2]),
        allowedVlans: [Number(access[2])],
      });
    }
  }

  // Config-snippet style: "interface Gi0/1 / switchport mode trunk / switchport trunk allowed vlan 1-4094"
  const cfgPorts = parseConfigStyle(text);
  for (const p of cfgPorts) {
    if (!ports.some(x => x.port === p.port)) ports.push(p);
  }

  const nativeSeen = {};
  for (const p of ports) {
    if (p.nativeVlan != null) {
      nativeSeen[p.nativeVlan] = nativeSeen[p.nativeVlan] || [];
      nativeSeen[p.nativeVlan].push(p.port);
    }
    if (p.mode === 'trunk') {
      const allowed = p.allowedVlans || [];
      if (allowed.length >= 1000 || textIncludesAllVlans(p)) {
        findings.push({
          severity: 'Medium',
          type: 'Promiscuous trunk',
          evidence: `${p.port} allows ${allowed.length >= 1000 ? 'all/near-all' : allowed.length} VLANs — widens VLAN-hopping surface; prune to required VLANs only.`,
          port: p.port,
        });
      }
      if (p.nativeVlan != null && p.nativeVlan !== 1) {
        findings.push({
          severity: 'Info',
          type: 'Non-default native VLAN',
          evidence: `${p.port} uses native VLAN ${p.nativeVlan}. Verify both ends agree; a native-VLAN mismatch can leak untagged frames across VLANs.`,
          port: p.port,
        });
      }
    }
  }
  if (Object.keys(nativeSeen).length > 1) {
    const detail = Object.entries(nativeSeen)
      .map(([vlan, ps]) => `VLAN ${vlan} on ${ps.join(', ')}`)
      .join('; ');
    findings.push({
      severity: 'Medium',
      type: 'Native-VLAN mismatch',
      evidence: `Multiple native VLANs observed: ${detail}. Inconsistent native VLANs on a trunk path are a classic VLAN-hopping precondition.`,
    });
  }
  const encap = [...new Set([...text.matchAll(TRUNK_ENCAP_RE)].map(m => m[1].toLowerCase()))];
  return {
    parsed: ports.length > 0,
    ports,
    nativeVlans: nativeSeen,
    trunkEncapsulations: encap,
    findings,
  };
}

function textIncludesAllVlans(p) {
  return (p.allowedVlans || []).includes(4094) || (p.allowedVlans || []).includes(4095);
}

/** Expand "1-3,10,20-22" (and "1-4094"/"all") into a VLAN number array. */
function expandVlanList(spec) {
  const s = String(spec).trim().toLowerCase();
  if (!s) return [];
  if (s === 'all' || s === '1-4094' || s === 'none-except') {
    return s === 'none-except' ? [] : range(1, 4094);
  }
  const out = new Set();
  for (const part of s.split(',')) {
    const p = part.trim();
    const m = p.match(/^(\d{1,4})-(\d{1,4})$/);
    if (m) {
      for (let v = Math.min(+m[1], +m[2]); v <= Math.max(+m[1], +m[2]) && v <= 4094; v++)
        out.add(v);
    } else if (/^\d{1,4}$/.test(p)) {
      out.add(Number(p));
    }
  }
  return [...out].sort((a, b) => a - b);
}

function range(a, b) {
  const out = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}

/** Parse Cisco-style config snippets for switchport trunk/access lines. */
function parseConfigStyle(text) {
  const ports = [];
  const blocks = text.split(/(?=^\s*interface\s+)/gim);
  for (const block of blocks) {
    const name = block.match(/^\s*interface\s+(\S+)/im);
    if (!name) continue;
    const mode = block.match(/switchport\s+mode\s+(trunk|access)/im)?.[1]?.toLowerCase();
    if (!mode) continue;
    const allowed = block.match(/switchport\s+trunk\s+allowed\s+vlan\s+([\d,\-\s]+|all)/im)?.[1];
    const native = block.match(/switchport\s+trunk\s+native\s+vlan\s+(\d{1,4})/im)?.[1];
    const accessVlan = block.match(/switchport\s+access\s+vlan\s+(\d{1,4})/im)?.[1];
    ports.push({
      port: name[1],
      mode,
      nativeVlan: native ? Number(native) : accessVlan ? Number(accessVlan) : null,
      allowedVlans:
        mode === 'trunk'
          ? expandVlanList(allowed || 'all')
          : accessVlan
            ? [Number(accessVlan)]
            : [],
    });
  }
  return ports;
}

/** ------------------------------------------------------------------
 *  647 — STP topology inference
 * ------------------------------------------------------------------ */

/**
 * Infer spanning-tree topology from multiple BPDU observations. Each sample
 * is what {@link analyzeBpdu} returns in its `switch` object, or raw parsed
 * BPDU fields. Correlates root bridge, per-bridge roles and port edges.
 *
 * @param {Array<object>} samples BPDU analysis results ({switch:{...}}) or raw fields
 * @returns {object} { inferred, rootBridge, bridges, edges, anomalies }
 */
export function inferStpTopology(samples = []) {
  const list = (Array.isArray(samples) ? samples : []).filter(Boolean);
  if (list.length === 0) {
    return { inferred: false, rootBridge: null, bridges: [], edges: [], anomalies: [] };
  }
  const bridges = {};
  const anomalies = [];
  for (const s of list) {
    const sw = s.switch || s;
    if (!sw || !sw.bridgeId) continue;
    const id = String(sw.bridgeId).toLowerCase();
    if (!bridges[id]) {
      bridges[id] = {
        bridgeId: id,
        vendor: sw.vendor || 'unknown',
        priority: sw.bridgePriority ?? null,
        claimedRoot: null,
        rootPathCost: null,
        ports: new Set(),
        observations: 0,
      };
    }
    const b = bridges[id];
    b.observations += 1;
    if (sw.rootBridgeId) {
      const root = String(sw.rootBridgeId).toLowerCase();
      if (b.claimedRoot && b.claimedRoot !== root) {
        anomalies.push(
          `Bridge ${id} advertises changing root (${b.claimedRoot} → ${root}) — topology flap or multiple STP domains visible.`
        );
      }
      b.claimedRoot = root;
    }
    if (typeof sw.rootPathCost === 'number' || sw.timers) {
      const cost = sw.rootPathCost ?? sw.cost ?? null;
      if (cost != null) b.rootPathCost = cost;
    }
    if (sw.portId != null) b.ports.add(sw.portId);
  }
  const ids = Object.keys(bridges);
  if (ids.length === 0) {
    return { inferred: false, rootBridge: null, bridges: [], edges: [], anomalies };
  }

  // Consensus root: the root bridge ID most bridges agree on.
  const rootVotes = {};
  for (const b of Object.values(bridges)) {
    if (b.claimedRoot) rootVotes[b.claimedRoot] = (rootVotes[b.claimedRoot] || 0) + 1;
  }
  const rootBridge = Object.entries(rootVotes).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  for (const b of Object.values(bridges)) {
    if (b.claimedRoot && rootBridge && b.claimedRoot !== rootBridge) {
      anomalies.push(
        `Bridge ${b.bridgeId} claims root ${b.claimedRoot} but consensus root is ${rootBridge} — possible rogue STP device or partitioned domain.`
      );
    }
  }
  const rootEntry = rootBridge ? bridges[rootBridge] : null;
  if (rootEntry && rootEntry.priority === 32768) {
    anomalies.push(
      `Root bridge ${rootBridge} still uses the default priority 32768 — root election looks opportunistic rather than engineered.`
    );
  }

  // Edges: every non-root bridge connects (logically) toward the root.
  const edges = [];
  for (const b of Object.values(bridges)) {
    b.ports = [...b.ports];
    if (rootBridge && b.bridgeId !== rootBridge && b.claimedRoot === rootBridge) {
      edges.push({
        from: b.bridgeId,
        to: rootBridge,
        kind: 'stp-path-to-root',
        cost: b.rootPathCost,
      });
    }
  }
  return {
    inferred: true,
    rootBridge,
    bridges: Object.values(bridges),
    edges,
    anomalies,
    summary: `${ids.length} bridge(s) observed, root ${rootBridge || 'unknown'}, ${edges.length} root-path edge(s), ${anomalies.length} anomalie(s).`,
  };
}

/** ------------------------------------------------------------------
 *  648 — CDP/LLDP frame capture → adjacency map
 * ------------------------------------------------------------------ */

/**
 * Build a switch adjacency map from captured CDP/LLDP frames. Each frame is
 * analysed with the existing CDP/LLDP analyzers and merged into a
 * node/link topology: which switch (hostname/chassis ID) was seen on which
 * local interface and which remote port.
 *
 * @param {Array<{protocol: 'cdp'|'lldp', tlvs?: Array, hex?: string, observedOn?: string}>} frames
 * @returns {object} { captured, nodes, links }
 */
export function captureCdpLldpFrames(frames = []) {
  const list = Array.isArray(frames) ? frames : [];
  const nodes = {};
  const links = [];
  for (const f of list) {
    if (!f || typeof f !== 'object') continue;
    const observedOn = f.observedOn || f.interface || 'unknown';
    if (f.protocol === 'cdp') {
      const a = analyzeCdpFrame({
        tlvs: f.tlvs || null,
        hex: f.hex || null,
        interface: observedOn,
      });
      if (!a.deviceFound) continue;
      const d = a.device;
      const key = `cdp:${d.deviceId || d.platform || 'unknown'}`;
      nodes[key] = nodes[key] || {
        id: key,
        protocol: 'cdp',
        hostname: d.deviceId,
        platform: d.platform,
        family: d.family,
        softwareVersion: d.softwareVersion,
        observedOn: new Set(),
      };
      nodes[key].observedOn.add(observedOn);
      links.push({
        from: observedOn,
        to: key,
        protocol: 'cdp',
        remotePort: d.portId,
        nativeVlan: d.nativeVlan,
        duplex: d.duplex,
        capabilities: d.capabilities,
      });
    } else if (f.protocol === 'lldp') {
      const a = mapLldpNeighbor({
        tlvs: f.tlvs || null,
        hex: f.hex || null,
        interface: observedOn,
      });
      if (!a.neighborFound) continue;
      const n = a.neighbor;
      const key = `lldp:${n.systemName || n.chassisId || 'unknown'}`;
      nodes[key] = nodes[key] || {
        id: key,
        protocol: 'lldp',
        hostname: n.systemName,
        chassisId: n.chassisId,
        description: n.systemDescription,
        capabilities: n.capabilities,
        managementAddress: n.managementAddress,
        observedOn: new Set(),
      };
      nodes[key].observedOn.add(observedOn);
      links.push({
        from: observedOn,
        to: key,
        protocol: 'lldp',
        remotePort: n.portId,
        portDescription: n.portDescription,
        ttlSeconds: n.ttlSeconds,
      });
    }
  }
  const nodeList = Object.values(nodes).map(n => ({ ...n, observedOn: [...n.observedOn] }));
  // Dedupe links on from→to→remotePort.
  const seen = new Set();
  const deduped = links.filter(l => {
    const k = `${l.from}|${l.to}|${l.remotePort}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return {
    captured: list.length,
    nodes: nodeList,
    links: deduped,
    summary: `${list.length} frame(s) captured → ${nodeList.length} neighbor device(s), ${deduped.length} link(s).`,
  };
}

/** ------------------------------------------------------------------
 *  649 — ARP-table host harvesting
 * ------------------------------------------------------------------ */

const ARP_LINE_RE =
  /^\s*(?:Internet\s+)?(\d{1,3}(?:\.\d{1,3}){3})\s+(?:\d+\s+)?(?:dev\s+\S+\s+lladdr\s+)?([0-9a-fA-F]{2}(?:[:-][0-9a-fA-F]{2}){5}|[0-9a-fA-F]{4}\.[0-9a-fA-F]{4}\.[0-9a-fA-F]{4})\s*(\S+)?/gim;
const GATEWAY_CANDIDATES = [/^(\d{1,3}(?:\.\d{1,3}){2}\.)1$/, /^(\d{1,3}(?:\.\d{1,3}){2}\.)254$/];

function normalizeMac(mac) {
  const clean = mac.replace(/[^0-9a-fA-F]/g, '').toLowerCase();
  if (clean.length !== 12) return mac.toLowerCase();
  return clean.replace(/(.{2})/g, '$1:').replace(/:$/, '');
}

/**
 * Parse ARP table dumps (Cisco `show ip arp`, Linux `ip neigh`, `arp -a`)
 * into a LAN host inventory. Flags defensive anomalies:
 *  - same MAC on multiple IPs (possible IP spoofing / HSRP anycast)
 *  - same IP on multiple MACs (ARP conflict / possible poisoning)
 *  - gateway-suspect IPs (.1 / .254) for scope review
 *
 * @param {string|string[]} dumps ARP table text (or list of dumps)
 * @returns {object} { parsed, hosts, anomalies, subnets }
 */
export function harvestArpTable(dumps) {
  const texts = Array.isArray(dumps) ? dumps : [dumps];
  const text = texts.map(String).join('\n');
  const hosts = [];
  const seen = new Set();
  for (const m of text.matchAll(ARP_LINE_RE)) {
    const ip = m[1];
    const mac = normalizeMac(m[2]);
    const key = `${ip}|${mac}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const octets = ip.split('.').map(Number);
    if (octets.some(o => o < 0 || o > 255)) continue;
    hosts.push({
      ip,
      mac,
      interface:
        m[3] && !/^(dynamic|static|complete|incomplete|stale|reachable|delay|probe)$/i.test(m[3])
          ? m[3]
          : '',
      vendor: lookupOuiVendor(mac),
      isGatewaySuspect: GATEWAY_CANDIDATES.some(re => re.test(ip)),
    });
  }
  const anomalies = [];
  const macToIps = {};
  const ipToMacs = {};
  for (const h of hosts) {
    macToIps[h.mac] = macToIps[h.mac] || new Set();
    macToIps[h.mac].add(h.ip);
    ipToMacs[h.ip] = ipToMacs[h.ip] || new Set();
    ipToMacs[h.ip].add(h.mac);
  }
  for (const [mac, ips] of Object.entries(macToIps)) {
    if (ips.size > 1) {
      anomalies.push({
        type: 'MAC on multiple IPs',
        evidence: `MAC ${mac} answers for ${[...ips].join(', ')} — check for IP spoofing, anycast, or stacked switches.`,
      });
    }
  }
  for (const [ip, macs] of Object.entries(ipToMacs)) {
    if (macs.size > 1) {
      anomalies.push({
        type: 'IP on multiple MACs',
        evidence: `IP ${ip} maps to MACs ${[...macs].join(', ')} — ARP conflict; investigate for ARP poisoning in an authorized assessment.`,
      });
    }
  }
  const subnets = [...new Set(hosts.map(h => h.ip.split('.').slice(0, 3).join('.') + '.0/24'))];
  return {
    parsed: hosts.length > 0,
    hosts,
    hostCount: hosts.length,
    anomalies,
    subnets,
    summary: `${hosts.length} host(s) harvested across ${subnets.length} /24(s), ${anomalies.length} anomalie(s).`,
  };
}

/** ------------------------------------------------------------------
 *  650 — DHCP lease-pool inference
 * ------------------------------------------------------------------ */

const POOL_BLOCK_RE = /ip\s+dhcp\s+pool\s+(\S+)([\s\S]*?)(?=\r?\n\s*ip\s+dhcp\s+pool\b|$)/gi;
const NETWORK_RE = /network\s+(\d{1,3}(?:\.\d{1,3}){3})\s+(\d{1,3}(?:\.\d{1,3}){3}|\/\d{1,2})/i;
const EXCLUDED_RE =
  /ip\s+dhcp\s+excluded-address\s+(\d{1,3}(?:\.\d{1,3}){3})(?:\s+(\d{1,3}(?:\.\d{1,3}){3}))?/gim;
const BINDING_RE =
  /^(\d{1,3}(?:\.\d{1,3}){3})\s+([0-9a-fA-F]{2}(?:[:-][0-9a-fA-F]{2}){5}|[0-9a-fA-F]{4}(?:\.[0-9a-fA-F]{4}){2}(?:\.[0-9a-fA-F]{2,4})?)\s+([^\r\n]+)/gim;

function ipToInt(ip) {
  const o = String(ip).split('.').map(Number);
  if (o.length !== 4 || o.some(x => !Number.isInteger(x) || x < 0 || x > 255)) return null;
  return (o[0] * 256 ** 3 + o[1] * 256 ** 2 + o[2] * 256 + o[3]) >>> 0;
}

function intToIp(n) {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
}

function networkRange(network, mask) {
  const ip = ipToInt(network);
  if (ip == null) return null;
  let prefix;
  if (String(mask).startsWith('/')) {
    prefix = Number(String(mask).slice(1));
  } else {
    const m = ipToInt(mask);
    if (m == null) return null;
    prefix = m.toString(2).split('1').length - 1;
  }
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return null;
  const maskInt = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const start = (ip & maskInt) >>> 0;
  const end = (start | (~maskInt >>> 0)) >>> 0;
  return { start, end, prefix, size: end - start + 1 };
}

/**
 * Infer DHCP lease pools from server disclosures (`show ip dhcp pool`,
 * `show run` dhcp sections, `show ip dhcp binding`). Computes pool size,
 * excluded ranges, active bindings, utilization and lease duration.
 *
 * @param {string|string[]} disclosures DHCP server CLI output
 * @returns {object} { inferred, pools, bindings, findings }
 */
export function inferDhcpLeasePool(disclosures) {
  const texts = Array.isArray(disclosures) ? disclosures : [disclosures];
  const text = texts.map(String).join('\n');
  const pools = [];
  const excluded = [];
  for (const m of text.matchAll(EXCLUDED_RE)) {
    excluded.push({ from: m[1], to: m[2] || m[1] });
  }
  for (const block of text.matchAll(POOL_BLOCK_RE)) {
    const name = block[1];
    const body = block[0];
    const net = body.match(NETWORK_RE);
    const range = net ? networkRange(net[1], net[2]) : null;
    const lease = body.match(/lease\s+(\d+)(?:\s+(\d+))?(?:\s+(\d+))?/i);
    const leaseHours = lease
      ? (Number(lease[1]) || 0) + (Number(lease[2]) || 0) / 60 + (Number(lease[3]) || 0) / 3600
      : null;
    const dns = [...body.matchAll(/dns-server\s+([\d.\s]+)/gi)].map(x => x[1].trim());
    const router = body.match(/default-router\s+([\d.]+)/i)?.[1] || null;
    pools.push({
      name,
      network: net ? `${net[1]} ${net[2]}` : null,
      range,
      usableSize: range ? Math.max(range.size - 2, 0) : null,
      leaseHours,
      dnsServers: dns,
      defaultRouter: router,
    });
  }
  const bindings = [];
  for (const m of text.matchAll(BINDING_RE)) {
    // Cisco prints the DHCP client-id as a type byte + MAC (e.g. 01 + 001b.2aaa.bb01).
    const raw = m[2].replace(/[^0-9a-fA-F]/g, '');
    const macHex = raw.length === 14 && raw.startsWith('01') ? raw.slice(2) : raw;
    const mac =
      macHex.length === 12
        ? macHex
            .toLowerCase()
            .replace(/(.{2})/g, '$1:')
            .replace(/:$/, '')
        : normalizeMac(m[2]);
    bindings.push({ ip: m[1], mac, expiry: m[3].trim() });
  }
  const findings = [];
  for (const pool of pools) {
    if (!pool.range) {
      findings.push({
        severity: 'Info',
        type: 'Pool without network statement',
        evidence: `Pool "${pool.name}" has no parseable network — cannot size the pool.`,
      });
      continue;
    }
    const inPool = bindings.filter(b => {
      const ip = ipToInt(b.ip);
      return ip != null && ip >= pool.range.start + 1 && ip <= pool.range.end - 1;
    });
    const excludedInPool = excluded.filter(e => {
      const a = ipToInt(e.from);
      const b = ipToInt(e.to);
      return a != null && b != null && a <= pool.range.end && b >= pool.range.start;
    });
    const utilization = pool.usableSize > 0 ? inPool.length / pool.usableSize : 0;
    pool.activeBindings = inPool.length;
    pool.utilizationPct = Math.round(utilization * 1000) / 10;
    pool.excludedRanges = excludedInPool;
    if (utilization >= 0.9) {
      findings.push({
        severity: 'Medium',
        type: 'DHCP pool exhaustion risk',
        evidence: `Pool "${pool.name}" is ${pool.utilizationPct}% utilized (${inPool.length}/${pool.usableSize}) — exhaustion would deny new clients addresses.`,
      });
    }
    if (pool.leaseHours != null && pool.leaseHours > 24 * 30) {
      findings.push({
        severity: 'Low',
        type: 'Very long lease time',
        evidence: `Pool "${pool.name}" lease is ${Math.round(pool.leaseHours)}h — long leases slow reclamation of abandoned addresses.`,
      });
    }
    if (!pool.defaultRouter) {
      findings.push({
        severity: 'Info',
        type: 'Pool without default router',
        evidence: `Pool "${pool.name}" advertises no default-router — clients may be intentionally isolated, verify scope.`,
      });
    }
  }
  return {
    inferred: pools.length > 0,
    pools,
    bindings,
    bindingCount: bindings.length,
    findings,
    summary: `${pools.length} pool(s) inferred, ${bindings.length} active binding(s), ${findings.length} finding(s).`,
  };
}

export const SWITCH_TOPOLOGY_RECON = {
  mapVlanSurface,
  inferStpTopology,
  captureCdpLldpFrames,
  harvestArpTable,
  inferDhcpLeasePool,
};

export default SWITCH_TOPOLOGY_RECON;
