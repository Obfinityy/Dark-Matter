/**
 * idea641-650.test.js — Tests for the wave-641 mesh + switch-topology recon engines.
 *
 *  meshNetworkRecon.js   — ideas 641–645 (Nebula certs, WireGuard leaks,
 *                          Headscale/Netmaker detection, innernet CIDR mapping)
 *  switchTopologyRecon.js — ideas 646–650 (VLAN surface, STP inference,
 *                          CDP/LLDP adjacency, ARP harvesting, DHCP pools)
 *
 * Run: node --test tests/idea641-650.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseNebulaCert,
  mineNebulaCerts,
  detectWireGuardPeerLeaks,
  detectHeadscaleServer,
  detectNetmakerServer,
  mapInnernetCidr,
} from '../src/engines/meshNetworkRecon.js';

import {
  mapVlanSurface,
  inferStpTopology,
  captureCdpLldpFrames,
  harvestArpTable,
  inferDhcpLeasePool,
} from '../src/engines/switchTopologyRecon.js';

const toHex = (s) => Buffer.from(String(s), 'utf8').toString('hex');

/* ------------------------------------------------------------------ */
/* 641 — Nebula certificate host mining                                */
/* ------------------------------------------------------------------ */
describe('641 parseNebulaCert / mineNebulaCerts', () => {
  const certA = {
    details: {
      name: 'web-01',
      ips: ['10.42.0.11/24'],
      groups: ['web', 'prod'],
      subnets: [],
      not_before: '2024-01-01T00:00:00Z',
      not_after: '2025-01-01T00:00:00Z',
    },
    issuer: { fingerprint: 'sha256:aaa111' },
  };
  const certB = {
    details: {
      name: 'web-02',
      ips: ['10.42.0.12/24'],
      groups: ['web', 'prod'],
      subnets: [],
      not_before: '2024-01-01T00:00:00Z',
      not_after: '2025-01-01T00:00:00Z',
    },
    issuer: { fingerprint: 'sha256:aaa111' },
  };
  const certC = {
    details: {
      name: 'db-01',
      ips: ['10.42.0.11/24'], // duplicate IP — misconfiguration
      groups: ['db', 'prod'],
      subnets: ['10.99.0.0/16'],
      not_before: '2024-01-01T00:00:00Z',
      not_after: '2025-01-01T00:00:00Z',
    },
    issuer: { fingerprint: 'sha256:bbb222' },
  };

  it('parses a Nebula cert into node inventory fields', () => {
    const n = parseNebulaCert(JSON.stringify(certA));
    assert.equal(n.parsed, true);
    assert.equal(n.name, 'web-01');
    assert.deepEqual(n.ips, ['10.42.0.11/24']);
    assert.deepEqual(n.groups, ['web', 'prod']);
    assert.equal(n.issuer, 'sha256:aaa111');
    assert.equal(n.durationDays, 366); // 2024 is a leap year
  });

  it('rejects non-cert input', () => {
    assert.equal(parseNebulaCert('not json').parsed, false);
    assert.equal(parseNebulaCert({}).parsed, false);
    assert.equal(parseNebulaCert(null).parsed, false);
  });

  it('mines a batch: group index, duplicate IPs, mesh summary', () => {
    const m = mineNebulaCerts([certA, certB, certC]);
    assert.equal(m.nodes.length, 3);
    assert.equal(m.meshSummary.nodeCount, 3);
    assert.equal(m.meshSummary.groupCount, 3); // web, prod, db
    assert.equal(m.meshSummary.issuerCount, 2);
    assert.deepEqual(m.groupIndex.prod.sort(), ['db-01', 'web-01', 'web-02']);
    assert.equal(m.duplicateIps.length, 1);
    assert.equal(m.duplicateIps[0].ip, '10.42.0.11/24');
    assert.deepEqual(m.duplicateIps[0].owners.sort(), ['db-01', 'web-01']);
  });
});

/* ------------------------------------------------------------------ */
/* 642 — WireGuard peer-config leak detection                          */
/* ------------------------------------------------------------------ */
describe('642 detectWireGuardPeerLeaks', () => {
  // Deterministic 44-char base64 peer keys (real WireGuard keys are 44 chars).
  const key1 = Buffer.from('wireguard-test-peer-key-00000001').toString('base64');
  const key2 = Buffer.from('wireguard-test-peer-key-00000002').toString('base64');
  const leakedConfig = `
[Interface]
PrivateKey = REDACTED-BY-TEST
Address = 10.6.0.2/24
DNS = 10.6.0.1

[Peer]
PublicKey = ${key1}
Endpoint = vpn.example.com:51820
AllowedIPs = 0.0.0.0/0

[Peer]
PublicKey = ${key2}
Endpoint = 203.0.113.7:51820
AllowedIPs = 10.6.0.0/24
`;

  it('detects a full peer-config disclosure as critical', () => {
    const r = detectWireGuardPeerLeaks(leakedConfig, 'https://example.com/backup/wg.conf');
    assert.equal(r.found, true);
    assert.equal(r.grade, 'critical');
    assert.equal(r.peers.length, 2);
    assert.deepEqual(r.peers[0].endpoint, ['vpn.example.com:51820']);
    assert.deepEqual(r.peers[0].allowedIps, ['0.0.0.0/0']);
    assert.equal(r.peers[0].hasPublicKey, true);
    assert.equal(r.peers[1].hasPublicKey, true);
    assert.equal(r.endpointCount, 2);
    assert.equal(r.publicKeyCount, 2);
    assert.match(r.evidence, /wg\.conf/);
  });

  it('grades key-only fragments lower', () => {
    const fragment = `[Interface]\nAddress = 10.6.0.2/24\n\n[Peer]\nPublicKey = ${key1}\n`;
    const r = detectWireGuardPeerLeaks(fragment);
    assert.equal(r.found, true);
    assert.equal(r.grade, 'medium');
  });

  it('returns not-found for unrelated text', () => {
    const r = detectWireGuardPeerLeaks('<html><body>hello</body></html>');
    assert.equal(r.found, false);
    assert.equal(r.grade, 'none');
    assert.deepEqual(r.peers, []);
  });
});

/* ------------------------------------------------------------------ */
/* 643 — Headscale detection                                           */
/* ------------------------------------------------------------------ */
describe('643 detectHeadscaleServer', () => {
  it('detects Headscale by header + API shape', () => {
    const r = detectHeadscaleServer({
      headers: { Server: 'Headscale v0.23.0', 'Content-Type': 'text/html' },
      body: '<html><title>Headscale Admin</title></html>',
      observedPaths: ['/api/v1/node', '/api/v1/policy', '/health'],
    });
    assert.equal(r.detected, true);
    assert.equal(r.confidence, 'high');
    assert.deepEqual(r.apiPaths, ['/api/v1/node', '/api/v1/policy']);
    assert.ok(r.indicators.length >= 3);
  });

  it('detects weakly on a single hint', () => {
    const r = detectHeadscaleServer({ headers: {}, body: 'powered by headscale', observedPaths: [] });
    assert.equal(r.detected, true);
    assert.equal(r.confidence, 'low');
  });

  it('does not false-positive on generic pages', () => {
    const r = detectHeadscaleServer({
      headers: { Server: 'nginx/1.25' },
      body: '<html>welcome</html>',
      observedPaths: ['/api/v1/users'],
    });
    assert.equal(r.detected, false);
    assert.equal(r.confidence, 'none');
  });
});

/* ------------------------------------------------------------------ */
/* 644 — Netmaker detection                                            */
/* ------------------------------------------------------------------ */
describe('644 detectNetmakerServer', () => {
  it('detects Netmaker by UI branding + API paths', () => {
    const r = detectNetmakerServer({
      headers: { Server: 'Netmaker', 'Content-Type': 'text/html' },
      body: '<div id="root">netmaker dashboard</div>',
      observedPaths: ['/api/networks', '/api/nodes', '/login'],
    });
    assert.equal(r.detected, true);
    assert.equal(r.confidence, 'high');
    assert.deepEqual(r.apiPaths, ['/api/networks', '/api/nodes']);
  });

  it('does not false-positive on lookalike API paths', () => {
    const r = detectNetmakerServer({
      headers: {},
      body: '{"status":"ok"}',
      observedPaths: ['/api/networking', '/api/nodejs'],
    });
    assert.equal(r.detected, false);
    assert.equal(r.confidence, 'none');
  });

  it('returns none for empty evidence', () => {
    const r = detectNetmakerServer({});
    assert.equal(r.detected, false);
    assert.equal(r.confidence, 'none');
  });
});

/* ------------------------------------------------------------------ */
/* 645 — Innernet CIDR mapping                                         */
/* ------------------------------------------------------------------ */
describe('645 mapInnernetCidr', () => {
  const configJson = JSON.stringify({
    networks: {
      office: { cidr: '10.0.0.0/24', peers: ['laptop-1', 'laptop-2'] },
      lab: { cidr: '10.0.0.128/25', peers: ['lab-pc'] }, // overlaps office
      dmz: { cidr: '172.16.0.0/24', peers: ['edge-1'] },
    },
  });

  it('maps CIDRs, sizes address space and flags overlaps', () => {
    const m = mapInnernetCidr(configJson);
    assert.equal(m.mapped, true);
    assert.equal(m.networks.length, 3);
    assert.equal(m.totalAddresses, 256 + 128 + 256);
    assert.equal(m.overlaps.length, 1);
    assert.equal(m.overlaps[0].networkA, 'office');
    assert.equal(m.overlaps[0].cidrA, '10.0.0.0/24');
    assert.equal(m.overlaps[0].networkB, 'lab');
  });

  it('parses TOML-style coordinator configs', () => {
    const toml = `
[networks.hq]
cidr = "192.168.10.0/24"
peers = ["gw-1", "ws-7"]

[networks.branch]
cidr = "192.168.20.0/24"
`;
    const m = mapInnernetCidr(toml);
    assert.equal(m.mapped, true);
    assert.equal(m.networks.length, 2);
    assert.equal(m.overlaps.length, 0);
    assert.equal(m.peerCount, 2);
  });

  it('rejects configs without networks', () => {
    assert.equal(mapInnernetCidr('{"foo":"bar"}').mapped, false);
    assert.equal(mapInnernetCidr('garbage ((( ').mapped, false);
  });
});

/* ------------------------------------------------------------------ */
/* 646 — VLAN hopping-surface mapping                                  */
/* ------------------------------------------------------------------ */
describe('646 mapVlanSurface', () => {
  const disclosure = `
interface GigabitEthernet0/1
 switchport mode trunk
 switchport trunk encapsulation dot1q
 switchport trunk native vlan 99
 switchport trunk allowed vlan 1-4094
!
interface GigabitEthernet0/2
 switchport mode trunk
 switchport trunk native vlan 1
 switchport trunk allowed vlan 10,20
!
interface FastEthernet0/1
 switchport mode access
 switchport access vlan 10
`;

  it('parses trunk/access ports and flags promiscuous trunks', () => {
    const m = mapVlanSurface(disclosure);
    assert.equal(m.parsed, true);
    assert.equal(m.ports.length, 3);
    const t1 = m.ports.find((p) => p.port === 'GigabitEthernet0/1');
    assert.equal(t1.mode, 'trunk');
    assert.equal(t1.nativeVlan, 99);
    assert.equal(t1.allowedVlans.length, 4094);
    const types = m.findings.map((f) => f.type);
    assert.ok(types.includes('Promiscuous trunk'), 'flags all-VLAN trunk');
    assert.ok(types.includes('Native-VLAN mismatch'), 'flags native VLAN inconsistency');
    assert.ok(types.includes('Non-default native VLAN'), 'notes native VLAN 99');
    assert.deepEqual(m.trunkEncapsulations, ['dot1q']);
  });

  it('handles tabular trunk output', () => {
    const tabular = 'Gi0/3 trunk 1 10,20,30\nGi0/4 access 40';
    const m = mapVlanSurface(tabular);
    assert.equal(m.parsed, true);
    assert.equal(m.ports.length, 2);
    assert.equal(m.findings.filter((f) => f.type === 'Promiscuous trunk').length, 0);
  });

  it('reports unparsed input cleanly', () => {
    const m = mapVlanSurface('nothing relevant here');
    assert.equal(m.parsed, false);
    assert.deepEqual(m.ports, []);
    assert.deepEqual(m.findings, []);
  });
});

/* ------------------------------------------------------------------ */
/* 647 — STP topology inference                                       */
/* ------------------------------------------------------------------ */
describe('647 inferStpTopology', () => {
  const root = '80:00:00:1b:2a:aa:bb:01';
  const samples = [
    { bridgeId: root, rootBridgeId: root, vendor: 'Cisco', bridgePriority: 4096, portId: 0x8001, rootPathCost: 0 },
    { bridgeId: '80:00:00:1b:2a:aa:bb:02', rootBridgeId: root, vendor: 'Cisco', bridgePriority: 32768, portId: 0x8002, rootPathCost: 4 },
    { bridgeId: '80:00:00:1b:2a:aa:bb:03', rootBridgeId: root, vendor: 'Cisco', bridgePriority: 32768, portId: 0x8003, rootPathCost: 8 },
  ];

  it('infers consensus root and root-path edges', () => {
    const t = inferStpTopology(samples);
    assert.equal(t.inferred, true);
    assert.equal(t.rootBridge, root);
    assert.equal(t.bridges.length, 3);
    assert.equal(t.edges.length, 2);
    assert.ok(t.edges.every((e) => e.to === root && e.kind === 'stp-path-to-root'));
    assert.equal(t.anomalies.length, 0);
    assert.match(t.summary, /3 bridge/);
  });

  it('accepts analyzeBpdu-style {switch} wrappers', () => {
    const wrapped = samples.map((s) => ({ switch: s }));
    const t = inferStpTopology(wrapped);
    assert.equal(t.rootBridge, root);
  });

  it('flags a non-engineered root priority as an anomaly', () => {
    const opportunistic = samples.map((s) =>
      s.bridgeId === root ? { ...s, bridgePriority: 32768 } : s
    );
    const t = inferStpTopology(opportunistic);
    assert.equal(t.rootBridge, root);
    assert.ok(t.anomalies.some((a) => a.includes('opportunistic')));
  });

  it('flags a rogue device claiming a different root', () => {
    const rogue = { bridgeId: '80:00:00:de:ad:be:ef:01', rootBridgeId: '80:00:00:de:ad:be:ef:01', vendor: 'unknown', bridgePriority: 61440, portId: 0x8001, rootPathCost: 0 };
    const t = inferStpTopology([...samples, rogue]);
    assert.equal(t.rootBridge, root); // consensus still holds 3:1
    assert.ok(t.anomalies.some((a) => a.includes('claims root') && a.includes(rogue.bridgeId)));
  });

  it('handles empty input', () => {
    const t = inferStpTopology([]);
    assert.equal(t.inferred, false);
    assert.equal(t.rootBridge, null);
  });
});

/* ------------------------------------------------------------------ */
/* 648 — CDP/LLDP frame capture → adjacency map                        */
/* ------------------------------------------------------------------ */
describe('648 captureCdpLldpFrames', () => {
  const frames = [
    {
      protocol: 'cdp',
      observedOn: 'eth0',
      tlvs: [
        { type: 0x0001, valueHex: toHex('dist-sw-01') },
        { type: 0x0003, valueHex: toHex('GigabitEthernet1/0/1') },
        { type: 0x0006, valueHex: toHex('cisco WS-C3850-48P') },
        { type: 0x0005, valueHex: toHex('Cisco IOS Software, IOS-XE Software, Version 16.12.04') },
        { type: 0x000a, valueHex: '0001' },
      ],
    },
    {
      protocol: 'lldp',
      observedOn: 'eth1',
      tlvs: [
        { type: 1, valueHex: `07${toHex('00:1b:2a:cc:dd:02')}` },
        { type: 2, valueHex: toHex('Ethernet1/2') },
        { type: 5, valueHex: toHex('access-sw-02') },
        { type: 6, valueHex: toHex('HPE 2530-48G Switch') },
      ],
    },
    // duplicate of the first frame — should be deduped in links
    {
      protocol: 'cdp',
      observedOn: 'eth0',
      tlvs: [
        { type: 0x0001, valueHex: toHex('dist-sw-01') },
        { type: 0x0003, valueHex: toHex('GigabitEthernet1/0/1') },
      ],
    },
  ];

  it('builds nodes and links from captured frames', () => {
    const c = captureCdpLldpFrames(frames);
    assert.equal(c.captured, 3);
    assert.equal(c.nodes.length, 2);
    const cdpNode = c.nodes.find((n) => n.protocol === 'cdp');
    assert.equal(cdpNode.hostname, 'dist-sw-01');
    assert.equal(cdpNode.family, 'Cisco Catalyst switch'); // WS-C3850 → Catalyst family
    const lldpNode = c.nodes.find((n) => n.protocol === 'lldp');
    assert.equal(lldpNode.hostname, 'access-sw-02');
    assert.equal(c.links.length, 2); // duplicate CDP frame deduped
    const cdpLink = c.links.find((l) => l.protocol === 'cdp');
    assert.equal(cdpLink.remotePort, 'GigabitEthernet1/0/1');
    assert.equal(cdpLink.nativeVlan, 1);
    assert.equal(cdpLink.from, 'eth0');
    assert.match(c.summary, /2 neighbor device/);
  });

  it('ignores frames without device identity', () => {
    const c = captureCdpLldpFrames([{ protocol: 'cdp', observedOn: 'eth9', tlvs: [] }]);
    assert.equal(c.nodes.length, 0);
    assert.equal(c.links.length, 0);
  });

  it('handles empty input', () => {
    const c = captureCdpLldpFrames([]);
    assert.equal(c.captured, 0);
    assert.deepEqual(c.nodes, []);
  });
});

/* ------------------------------------------------------------------ */
/* 649 — ARP-table host harvesting                                     */
/* ------------------------------------------------------------------ */
describe('649 harvestArpTable', () => {
  const dump = `
Protocol  Address          Age (min)  Hardware Addr   Type   Interface
Internet  192.168.1.1            12   001b.2aaa.bb01  ARPA   Vlan1
Internet  192.168.1.10            4   001b.2aaa.bb02  ARPA   Vlan1
Internet  192.168.1.11            7   001b.2aaa.bb02  ARPA   Vlan1
Internet  192.168.1.20            2   52:54:00:12:34:56 ARPA  Vlan1
`;

  it('harvests hosts and flags a MAC on multiple IPs', () => {
    const h = harvestArpTable(dump);
    assert.equal(h.parsed, true);
    assert.equal(h.hostCount, 4);
    assert.deepEqual(h.subnets, ['192.168.1.0/24']);
    const gw = h.hosts.find((x) => x.ip === '192.168.1.1');
    assert.equal(gw.isGatewaySuspect, true);
    assert.equal(gw.mac, '00:1b:2a:aa:bb:01');
    assert.equal(typeof gw.vendor, 'string');
    assert.ok(h.anomalies.some((a) => a.type === 'MAC on multiple IPs' && a.evidence.includes('00:1b:2a:aa:bb:02')));
  });

  it('flags the same IP on multiple MACs', () => {
    const conflict = '10.0.0.5 00:11:22:33:44:55 dynamic\n10.0.0.5 aa:bb:cc:dd:ee:ff dynamic\n';
    const h = harvestArpTable(conflict);
    assert.ok(h.anomalies.some((a) => a.type === 'IP on multiple MACs'));
  });

  it('handles Linux ip-neigh style lines', () => {
    const h = harvestArpTable('192.168.7.3 dev eth0 lladdr de:ad:be:ef:00:01 REACHABLE\n');
    assert.equal(h.hostCount, 1);
    assert.equal(h.hosts[0].mac, 'de:ad:be:ef:00:01');
  });

  it('reports empty dumps cleanly', () => {
    const h = harvestArpTable('');
    assert.equal(h.parsed, false);
    assert.deepEqual(h.hosts, []);
  });
});

/* ------------------------------------------------------------------ */
/* 650 — DHCP lease-pool inference                                     */
/* ------------------------------------------------------------------ */
describe('650 inferDhcpLeasePool', () => {
  const disclosure = `
ip dhcp excluded-address 192.168.1.1 192.168.1.10
ip dhcp pool LAN
 network 192.168.1.0 255.255.255.0
 default-router 192.168.1.1
 dns-server 8.8.8.8 8.8.4.4
 lease 0 8 0
!
show ip dhcp binding
IP address      Client-ID/         Lease expiration        Type
                Hardware address
192.168.1.50    0100.1b2a.aabb.01  Jan 02 2026 08:00 AM    Automatic
192.168.1.51    0100.1b2a.aabb.02  Jan 02 2026 08:05 AM    Automatic
192.168.1.52    0100.1b2a.aabb.03  Jan 02 2026 08:10 AM    Automatic
`;

  it('infers pool size, bindings, utilization and exclusions', () => {
    const d = inferDhcpLeasePool(disclosure);
    assert.equal(d.inferred, true);
    assert.equal(d.pools.length, 1);
    const pool = d.pools[0];
    assert.equal(pool.name, 'LAN');
    assert.equal(pool.usableSize, 254);
    assert.equal(pool.defaultRouter, '192.168.1.1');
    assert.deepEqual(pool.dnsServers, ['8.8.8.8 8.8.4.4']);
    assert.equal(pool.activeBindings, 3);
    assert.equal(pool.utilizationPct, Math.round((3 / 254) * 1000) / 10);
    assert.equal(pool.excludedRanges.length, 1);
    assert.equal(d.bindingCount, 3);
    assert.match(d.summary, /1 pool/);
  });

  it('flags pool exhaustion risk at high utilization', () => {
    // /25 → 126 usable addresses; fill nearly all of them with valid IPs.
    let bindings = '';
    for (let i = 2; i < 124; i++) {
      bindings += `192.168.1.${i}    0100.1b2a.aabb.${String(i % 100).padStart(2, '0')}  Jan 02 2026 08:00 AM    Automatic\n`;
    }
    const d = inferDhcpLeasePool(`ip dhcp pool SMALL\n network 192.168.1.0 255.255.255.128\n default-router 192.168.1.1\n lease 1 0 0\n${bindings}`);
    const pool = d.pools[0];
    assert.equal(pool.usableSize, 126);
    assert.ok(pool.utilizationPct >= 90, `utilization ${pool.utilizationPct}%`);
    assert.ok(d.findings.some((f) => f.type === 'DHCP pool exhaustion risk'));
  });

  it('notes pools without a default router', () => {
    const d = inferDhcpLeasePool('ip dhcp pool ISOLATED\n network 10.9.0.0 255.255.255.0\n');
    assert.ok(d.findings.some((f) => f.type === 'Pool without default router'));
  });

  it('handles input with no pools', () => {
    const d = inferDhcpLeasePool('no dhcp here');
    assert.equal(d.inferred, false);
    assert.deepEqual(d.pools, []);
  });
});
