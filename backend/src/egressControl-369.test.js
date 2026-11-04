
// --- #369 regression tests (appended) ---
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEgressPlan,
  refreshHuntEgress,
  removeHuntEgress,
  resolveUpstreamDns,
  setupHuntEgress,
} from './egressControl.js';

const HUNT369 = 'h_testegress';
const SET369 = 'dm-allow-h_testegress';
const GW369 = '172.18.0.1';
const CIP369 = '172.18.0.2';
const RESOLVER369 = '8.8.8.8';
const SCOPE369 = Object.freeze({
  version: 1,
  target: 'https://example.com',
  hosts: ['example.com'],
  outHosts: ['cdn.example.com'],
  ips: ['93.184.216.34'],
  labIps: ['172.17.0.1'],
  ports: [
    { port: 443, proto: 'tcp' },
    { port: 80, proto: 'tcp' },
    { port: 8080, proto: 'tcp' },
    { port: 53, proto: 'udp' },
  ],
  labTargets: [],
  createdAt: '2026-10-31T00:00:00.000Z',
});

test('#369 gap 1: 999 octets and leading-zero forms never enter the tuple set', () => {
  const scope = { ...SCOPE369, ips: ['999.999.999.999', '010.0.0.1', '93.184.216.34'], labIps: [] };
  const p = buildEgressPlan(HUNT369, scope, {
    containerIps: [CIP369], gatewayIp: GW369, resolverIp: RESOLVER369,
    resolved: { 'example.com': [] },
  });
  const joined = p.ipset.join('\n');
  assert.ok(!joined.includes('999.999.999.999'), '999 octets rejected');
  assert.ok(!joined.includes('010.0.0.1'), 'leading-zero form rejected');
  assert.ok(joined.includes('93.184.216.34,tcp:8080'), 'valid IP still installed');
});

test('#369 gap 1 (refresh): a resolved 999 address is skipped on the tick', async () => {
  const issued = [];
  const r = await refreshHuntEgress('h_refresh1', {
    readMeta: () => ({
      egress: { setName: SET369, netName: 'dm-net-h_refresh1' },
      scopeGuard: { ...SCOPE369, hosts: ['example.com'], ips: [], labIps: [] },
    }),
    run: async (argv) => { issued.push(argv.join(' ')); return { ok: true, stdout: '' }; },
    resolveHost: async () => ['999.999.999.999'],
    getCurrentEntries: async () => [],
  });
  assert.ok(!issued.some((c) => c.includes('999.999.999.999')), 'no 999 tuple installed');
  assert.equal(r.added, 0);
});

test('#369 gap 2: removeHuntEgress reports real status, not unconditional ok', async () => {
  const failing = async () => ({ ok: false, stdout: '' });
  const r = await removeHuntEgress('h_testegress', {}, { run: failing });
  assert.equal(r.ok, false, 'one failed removal command -> ok:false');
  assert.ok(r.results.some((x) => x.ok === false));
  const passing = async () => ({ ok: true, stdout: '' });
  const r2 = await removeHuntEgress('h_testegress', {}, { run: passing });
  assert.equal(r2.ok, true, 'all commands ok -> ok:true');
});

test('#369 gap 2 (refresh): refresh ok reflects its ipset results', async () => {
  const r = await refreshHuntEgress('h_refresh1', {
    readMeta: () => ({
      egress: { setName: SET369, netName: 'dm-net-h_refresh1' },
      scopeGuard: { ...SCOPE369, hosts: [], ips: ['93.184.216.34'], labIps: [] },
    }),
    run: async () => ({ ok: false, stdout: '' }),
    resolveHost: async () => [],
    getCurrentEntries: async () => [],
  });
  assert.equal(r.ok, false, 'failed ipset add -> ok:false');
  assert.ok(r.added > 0);
});

test('#369 gap 3: refresh preserves DNAT-translated lab entries across ticks', async () => {
  const translated = { '172.17.0.1': ['192.168.99.9'] };
  const meta = () => ({
    egress: { setName: SET369, netName: 'dm-net-h_refresh1', labTranslated: translated },
    scopeGuard: { ...SCOPE369, hosts: [], ips: [], labIps: ['172.17.0.1'] },
  });
  const issued = [];
  const run = async (argv) => { issued.push(argv.join(' ')); return { ok: true, stdout: '' }; };
  const r1 = await refreshHuntEgress('h_refresh1', {
    readMeta: meta, run, resolveHost: async () => [], getCurrentEntries: async () => [],
  });
  assert.ok(issued.some((c) => c === `ipset add ${SET369} 172.17.0.1,tcp:8080 -exist`), 'lab IP added');
  assert.ok(issued.some((c) => c === `ipset add ${SET369} 192.168.99.9,tcp:8080 -exist`), 'translated IP added');
  assert.ok(issued.some((c) => c === `ipset add ${SET369} 192.168.99.9,udp:53 -exist`), 'translated IP udp tuple added');
  assert.equal(r1.ok, true);
  // Second tick with the full set live: nothing is diffed out.
  const want = ['172.17.0.1,tcp:8080', '172.17.0.1,udp:53', '192.168.99.9,tcp:8080', '192.168.99.9,udp:53'];
  const issued2 = [];
  const r2 = await refreshHuntEgress('h_refresh1', {
    readMeta: meta,
    run: async (argv) => { issued2.push(argv.join(' ')); return { ok: true, stdout: '' }; },
    resolveHost: async () => [],
    getCurrentEntries: async () => [...want],
  });
  assert.equal(r2.removed, 0, 'translated entries are NOT diffed out on the next tick');
  assert.ok(!issued2.some((c) => c.startsWith('ipset del')), 'no deletions at all');
});

test('#369 gap 4: setup refuses a localhost-only resolv.conf instead of falling back to 8.8.8.8', async () => {
  await assert.rejects(
    setupHuntEgress('h_testegress', SCOPE369, {
      docker: async () => '',
      getGatewayIp: async () => GW369,
      readResolvConf: async () => 'nameserver 127.0.0.11\n',
      resolveHost: async () => [],
    }),
    /no upstream DNS resolver/
  );
});

test('#369 gap 4: setup accepts an explicit resolverIp and a resolv.conf resolver', async () => {
  const withOptIn = await setupHuntEgress('h_testegress', SCOPE369, {
    docker: async () => '',
    getGatewayIp: async () => GW369,
    readResolvConf: async () => 'nameserver 127.0.0.11\n',
    resolveHost: async () => [],
    resolverIp: '1.1.1.1',
  });
  assert.equal(withOptIn.resolverIp, '1.1.1.1');
  const fromResolv = await setupHuntEgress('h_testegress', SCOPE369, {
    docker: async () => '',
    getGatewayIp: async () => GW369,
    readResolvConf: async () => 'nameserver 9.9.9.9\n',
    resolveHost: async () => [],
  });
  assert.equal(fromResolv.resolverIp, '9.9.9.9');
});

test('#369 gap 4: resolveUpstreamDns skips IPv6 nameservers (IPv4-only layer)', () => {
  assert.equal(resolveUpstreamDns('nameserver 2001:4860:4860::8888\nnameserver 1.1.1.1\n'), '1.1.1.1');
  assert.equal(resolveUpstreamDns('nameserver 2001:4860:4860::8888\n'), null);
});
