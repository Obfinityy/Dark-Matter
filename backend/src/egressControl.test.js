// Dark Matter — P2 egressControl unit tests (31 Oct 2026).
// Pure rule-generation tests: assert the EXACT ipset/iptables command
// strings for a sample scope, tuple correctness (protocol-qualified,
// 80/443 proxy-only exclusion), diff logic, and create/remove symmetry.
// No root, no docker, no network — runs in this sandbox.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeHuntId,
  egressNetName,
  egressSetName,
  egressChainName,
  egressLogPrefix,
  proxyPortForHunt,
  PROXY_ONLY_PORTS,
  tupleEntry,
  resolveUpstreamDns,
  buildEgressPlan,
  diffEgressEntries,
  matchesTuple,
  buildRemoveEgress,
  applyEgressPlan,
  refreshHuntEgress,
} from './egressControl.js';

const HUNT = 'h_testegress';
const SET = 'dm-allow-h_testegress';
const IPSET = 'dm-allow-ip-h_testegress';
const CHAIN = 'dm-egress-h_testegress';
const NET = 'dm-net-h_testegress';
const GW = '172.18.0.1';
const CIP = '172.18.0.2';
const RESOLVER = '8.8.8.8';
const PROXY_PORT = proxyPortForHunt(HUNT);

// Sample P1 scope (the exact immutable format P1 persists).
const SCOPE = Object.freeze({
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

const RESOLVED = { 'example.com': ['93.184.216.34'] };

function plan(extra = {}) {
  return buildEgressPlan(HUNT, SCOPE, {
    containerIps: [CIP],
    gatewayIp: GW,
    proxyPort: PROXY_PORT,
    resolverIp: RESOLVER,
    resolved: RESOLVED,
    ...extra,
  });
}

test('sanitizeHuntId strips unsafe chars and truncates', () => {
  assert.equal(sanitizeHuntId('h_abc-123.X'), 'h_abc-123X');
  assert.equal(sanitizeHuntId('h_' + 'x'.repeat(100)).length, 32);
  assert.equal(sanitizeHuntId(''), '');
  assert.equal(egressNetName(HUNT), NET);
  assert.equal(egressSetName(HUNT), SET);
  assert.equal(egressChainName(HUNT), CHAIN);
});

test('proxyPortForHunt is deterministic and in the 17881-17980 range', () => {
  const a = proxyPortForHunt(HUNT);
  assert.equal(a, proxyPortForHunt(HUNT));
  assert.ok(a >= 17881 && a <= 17980, `port ${a} out of range`);
  assert.notEqual(proxyPortForHunt('h_other'), a);
});

test('PROXY_ONLY_PORTS excludes direct 80/443 from the tuple set', () => {
  assert.ok(PROXY_ONLY_PORTS.has(80) && PROXY_ONLY_PORTS.has(443));
  assert.equal(tupleEntry('1.2.3.4', 'tcp', 443), '1.2.3.4,tcp:443');
});

test('resolveUpstreamDns picks the first usable nameserver', () => {
  assert.equal(resolveUpstreamDns('nameserver 8.8.8.8\nnameserver 1.1.1.1\n'), '8.8.8.8');
  assert.equal(resolveUpstreamDns('# only a comment\n'), null);
  assert.equal(resolveUpstreamDns('nameserver 127.0.0.53\nnameserver 9.9.9.9\n'), '9.9.9.9');
  assert.equal(resolveUpstreamDns('nameserver 127.0.0.53\n'), null);
  assert.equal(resolveUpstreamDns(''), null);
  assert.equal(resolveUpstreamDns(null), null);
});

test('buildEgressPlan: tuple entries are protocol-qualified; 80/443 excluded', () => {
  const p = plan();
  // In-scope host x authorized NON-WEB ports (dedup with the ips entry).
  assert.ok(p.entries.includes('93.184.216.34,tcp:8080'), 'in-scope IP tcp/8080');
  assert.ok(p.entries.includes('93.184.216.34,udp:53'), 'in-scope IP udp/53');
  // Lab IP x authorized non-web ports.
  assert.ok(p.entries.includes('172.17.0.1,tcp:8080'), 'lab IP tcp/8080');
  // 80/443 NEVER in the tuple set — HTTP(S) only via the filtering proxy.
  assert.ok(!p.entries.some((e) => e.endsWith(',tcp:80')), 'no tcp/80 tuple');
  assert.ok(!p.entries.some((e) => e.endsWith(',tcp:443')), 'no tcp/443 tuple');
  // No tuples for unauthorized ports or wrong protocols.
  assert.ok(!p.entries.some((e) => e.endsWith(',tcp:22')), 'no ssh tuple');
  assert.ok(!p.entries.some((e) => e.endsWith(',tcp:3306')), 'no mysql tuple');
  assert.ok(!p.entries.some((e) => e.includes(',udp:8080')), 'no udp/8080 (wrong proto)');
  // Dedup.
  assert.equal(new Set(p.entries).size, p.entries.length, 'entries deduplicated');
  // Companion hash:ip set carries the same IPs (scoped ICMP exception).
  assert.ok(p.ipEntries.includes('93.184.216.34'));
  assert.ok(p.ipEntries.includes('172.17.0.1'));
});

test('matchesTuple mirrors ipset hash:ip,port semantics', () => {
  const p = plan();
  assert.equal(matchesTuple(p.entries, '93.184.216.34', 'tcp', 8080), true);
  assert.equal(matchesTuple(p.entries, '93.184.216.34', 'tcp', 443), false);
  assert.equal(matchesTuple(p.entries, '93.184.216.34', 'udp', 8080), false);
  assert.equal(matchesTuple(p.entries, '1.1.1.1', 'tcp', 8080), false);
});

test('buildEgressPlan: exact ipset command strings', () => {
  const p = plan();
  assert.equal(p.setName, SET);
  assert.equal(p.ipSetName, IPSET);
  assert.equal(p.chain, CHAIN);
  assert.equal(p.netName, NET);
  assert.ok(p.ipset.includes(`ipset create ${SET} hash:ip,port -exist`), 'tuple set create');
  assert.ok(p.ipset.includes(`ipset create ${IPSET} hash:ip -exist`), 'icmp set create');
  assert.ok(p.ipset.includes(`ipset flush ${SET}`), 'tuple set flush');
  assert.ok(
    p.ipset.includes(`ipset add ${SET} 93.184.216.34,tcp:8080 -exist`),
    'exact add: in-scope tcp/8080'
  );
  assert.ok(
    p.ipset.includes(`ipset add ${SET} 172.17.0.1,udp:53 -exist`),
    'exact add: lab udp/53'
  );
  assert.ok(p.ipset.includes(`ipset add ${IPSET} 172.17.0.1 -exist`), 'exact add: icmp set');
  // Resolver/proxy are NOT tuple entries — they get explicit iptables rules.
  assert.ok(!p.ipset.some((c) => c.includes(RESOLVER)), 'resolver not in ipset');
  assert.ok(!p.ipset.some((c) => c.includes(`${GW},tcp`)), 'proxy gw not in ipset');
});

test('buildEgressPlan: exact iptables chain strings and order', () => {
  const p = plan();
  const body = p.iptables;
  // Chain creation is a separate idempotent check-then-add step (never
  // shell syntax — the runner has no shell; 3 Nov 2026 egress fix).
  assert.deepEqual(p.chainStep, {
    check: `iptables -n -L ${CHAIN}`,
    add: `iptables -N ${CHAIN}`,
  });
  assert.equal(body[0], `iptables -F ${CHAIN}`);
  assert.equal(body[1], `iptables -A ${CHAIN} -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT`);
  assert.equal(
    body[2],
    `iptables -A ${CHAIN} -m set --match-set ${SET} dst,dst -j ACCEPT`,
    'tuple match on DESTINATION (exact)'
  );
  assert.equal(
    body[3],
    `iptables -A ${CHAIN} -d ${GW} -p tcp --dport ${PROXY_PORT} -j ACCEPT`,
    'proxy gateway accept (exact)'
  );
  assert.equal(
    body[4],
    `iptables -A ${CHAIN} -p udp --dport 53 -d ${RESOLVER} -j ACCEPT`,
    'dns udp accept (exact)'
  );
  assert.equal(
    body[5],
    `iptables -A ${CHAIN} -p tcp --dport 53 -d ${RESOLVER} -j ACCEPT`,
    'dns tcp accept (exact)'
  );
  assert.equal(
    body[6],
    `iptables -A ${CHAIN} -p icmp --icmp-type echo-request -m set --match-set ${IPSET} dst -j ACCEPT`,
    'scoped icmp accept (exact)'
  );
  assert.equal(
    body[7],
    `iptables -A ${CHAIN} -m limit --limit 5/min -j LOG --log-prefix ${egressLogPrefix(HUNT)} --log-level 4`,
    'rate-limited LOG with exact prefix (unquoted — no shell)'
  );
  assert.equal(body[8], `iptables -A ${CHAIN} -d 169.254.169.254/32 -j DROP`, 'metadata drop');
  assert.equal(body[body.length - 1], `iptables -A ${CHAIN} -j DROP`, 'default DROP last');
});

test('buildEgressPlan: NO shell syntax in any generated command (3 Nov 2026 regression)', () => {
  // The runner executes commands with NO shell (shSplit + execFile), so
  // shell metacharacters arrive as literal arguments and iptables fails.
  // This test fails the build if anyone reintroduces them.
  const p = plan();
  const r = buildRemoveEgress(HUNT, { containerIps: [CIP], resolverIp: RESOLVER });
  const cmds = [
    ...p.ipset,
    p.chainStep.check,
    p.chainStep.add,
    ...p.iptables,
    ...p.jumps.flatMap((j) => [j.check, j.add, j.del]),
    ...p.nat.flatMap((n) => [n.check, n.add, n.del]),
    ...r.ipset,
    ...r.iptables,
    ...r.nat,
    ...r.docker,
  ];
  assert.ok(cmds.length > 20, 'enough commands to be a real check');
  for (const c of cmds) {
    assert.ok(!/[|><;&`$'"]/.test(c), `shell metacharacter in generated command: ${c}`);
    assert.ok(!/\s{2,}/.test(c), `double-space (split hazard) in: ${c}`);
  }
});

test('kernel limits: names and log-prefix stay within caps for real hunt ids', () => {
  // Real hunt ids are 14+ chars (e.g. h_6e909d3c1965); sanitizeHuntId allows 32.
  // The kernel rejects --log-prefix > 29 chars, ipset names > 31, chains > 29.
  for (const hid of ['h_6e909d3c1965', 'h_bench_d69e5746', 'a'.repeat(32)]) {
    assert.ok(egressSetName(hid).length <= 31, `tuple set name <=31 for ${hid}`);
    assert.ok(egressChainName(hid).length <= 29, `chain name <=29 for ${hid}`);
    // NOTE: docker network names have no such kernel cap (bridge ifname is hashed).
    const prefix = egressLogPrefix(hid);
    assert.ok(prefix.length <= 29, `log-prefix <=29 for ${hid} (got ${prefix.length})`);
    assert.ok(prefix.startsWith('dm-egress-drop:'), 'prefix keeps brand');
    assert.ok(!/\s/.test(prefix), 'no whitespace — the runner has no shell (3 Nov 2026)');
    const p = buildEgressPlan(hid, SCOPE, { containerIps: [CIP], gatewayIp: GW, resolverIp: RESOLVER });
    const logRule = p.iptables.find((c) => c.includes('-j LOG'));
    const m = logRule.match(/--log-prefix (\S+)/);
    assert.ok(m && m[1].length <= 29, `emitted LOG rule prefix <=29 for ${hid}`);
  }
});

test('buildEgressPlan: per-container jumps and NAT pin (exact)', () => {
  const p = plan();
  assert.deepEqual(p.jumps[0], {
    check: `iptables -C DOCKER-USER -s ${CIP} -j ${CHAIN}`,
    add: `iptables -I DOCKER-USER 1 -s ${CIP} -j ${CHAIN}`,
    del: `iptables -D DOCKER-USER -s ${CIP} -j ${CHAIN}`,
  });
  assert.deepEqual(p.jumps[1], {
    check: `iptables -C INPUT -s ${CIP} -j ${CHAIN}`,
    add: `iptables -I INPUT 1 -s ${CIP} -j ${CHAIN}`,
    del: `iptables -D INPUT -s ${CIP} -j ${CHAIN}`,
  });
  assert.deepEqual(p.nat[0], {
    check: `iptables -t nat -C PREROUTING -s ${CIP} -p udp --dport 53 -j DNAT --to-destination ${RESOLVER}:53`,
    add: `iptables -t nat -A PREROUTING -s ${CIP} -p udp --dport 53 -j DNAT --to-destination ${RESOLVER}:53`,
    del: `iptables -t nat -D PREROUTING -s ${CIP} -p udp --dport 53 -j DNAT --to-destination ${RESOLVER}:53`,
  });
  assert.ok(p.nat[1].add.includes('-p tcp --dport 53'), 'tcp NAT pin present');
});

test('buildEgressPlan: fail-closed on bad input', () => {
  assert.throws(() => buildEgressPlan(HUNT, null, {}), /invalid hunt scope/);
  assert.throws(() => buildEgressPlan(HUNT, { version: 2 }, {}), /invalid hunt scope/);
  assert.throws(() => plan({ gatewayIp: null }), /gatewayIp required/);
  assert.throws(() => plan({ containerIps: [] }), /containerIps required/);
});

test('diffEgressEntries computes added/removed correctly', () => {
  const d = diffEgressEntries(['a,tcp:1', 'b,tcp:2'], ['b,tcp:2', 'c,tcp:3']);
  assert.deepEqual(d.add, ['c,tcp:3']);
  assert.deepEqual(d.del, ['a,tcp:1']);
  const same = diffEgressEntries(['x'], ['x']);
  assert.deepEqual(same.add, []);
  assert.deepEqual(same.del, []);
});

test('buildRemoveEgress: covers every artifact the plan creates (symmetry)', () => {
  const p = plan();
  const r = buildRemoveEgress(HUNT, { containerIps: [CIP], resolverIp: RESOLVER });
  // Every jump add has a matching delete.
  for (const j of p.jumps) {
    assert.ok(r.iptables.includes(j.del), `missing del for jump: ${j.add}`);
  }
  // Every NAT add has a matching delete.
  for (const n of p.nat) {
    assert.ok(r.nat.includes(n.del), `missing del for nat: ${n.add}`);
  }
  // Chain create/flush matched by flush+delete-chain.
  assert.ok(r.iptables.includes(`iptables -F ${CHAIN}`));
  assert.ok(r.iptables.includes(`iptables -X ${CHAIN}`));
  // Both ipsets destroyed.
  assert.ok(r.ipset.includes(`ipset destroy ${SET}`));
  assert.ok(r.ipset.includes(`ipset destroy ${IPSET}`));
  // Per-hunt network removed.
  assert.ok(r.docker.includes(`docker network rm ${NET}`));
});

test('applyEgressPlan: check-then-add idempotency via injected runner', async () => {
  const issued = [];
  // Fake: checks (-C) report "already present" → adds must be skipped.
  const fakeRun = async (argv) => {
    issued.push(argv.join(' '));
    if (argv.includes('-C')) return { ok: true, stdout: '' };
    return { ok: true, stdout: '' };
  };
  const r = await applyEgressPlan(plan(), { run: fakeRun });
  assert.equal(r.ok, true);
  assert.ok(issued.includes(`iptables -n -L ${CHAIN}`), 'chain check issued');
  assert.ok(!issued.includes(`iptables -N ${CHAIN}`), 'chain add skipped when present');
  assert.ok(
    issued.some((c) => c === `ipset add ${SET} 93.184.216.34,tcp:8080 -exist`),
    'tuple add issued'
  );
  const adds = issued.filter((c) => c.includes(' -I DOCKER-USER 1 '));
  assert.equal(adds.length, 0, 'present jumps not re-added (check-then-add)');
  const skipped = r.results.filter((x) => x.skipped === 'already-present');
  assert.ok(skipped.length >= 3, 'skipped entries recorded (chain + jumps)');
});

test('applyEgressPlan: missing chain is created (check fails → add issued)', async () => {
  const issued = [];
  const fakeRun = async (argv) => {
    issued.push(argv.join(' '));
    // Chain does not exist yet; everything else succeeds.
    if (argv.join(' ').startsWith(`iptables -n -L ${CHAIN}`)) return { ok: false, error: 'no such chain' };
    return { ok: true, stdout: '' };
  };
  const r = await applyEgressPlan(plan(), { run: fakeRun });
  assert.equal(r.ok, true);
  assert.ok(issued.includes(`iptables -N ${CHAIN}`), 'chain add issued when check fails');
});

test('applyEgressPlan: reports failure without throwing', async () => {
  const fakeRun = async () => ({ ok: false, error: 'boom' });
  const r = await applyEgressPlan(plan(), { run: fakeRun });
  assert.equal(r.ok, false);
});

function metaFor(scope) {
  return {
    egress: { setName: egressSetName('h_refresh1'), netName: egressNetName('h_refresh1') },
    scopeGuard: scope,
  };
}

test('refreshHuntEgress: simulated DNS change diffed within one tick', async () => {
  const issued = [];
  const fakeRun = async (argv) => {
    issued.push(argv.join(' '));
    return { ok: true, stdout: '' };
  };
  const getCurrentEntries = async () => ['10.9.9.9,tcp:8080', '10.9.9.9,udp:53'];
  // FIX (#339): the old fake answer was 10.10.10.10 — a PRIVATE IP that
  // the refresh must never install. A DNS change to a public IP is
  // still applied; see the rebound test below for the private case.
  const resolveHost = async () => ['93.184.216.34'];
  const scope2 = { ...SCOPE, hosts: ['example.com'], ips: [], labIps: [] };
  const r = await refreshHuntEgress('h_refresh1', {
    readMeta: () => metaFor(scope2),
    run: fakeRun,
    resolveHost,
    getCurrentEntries,
  });
  assert.equal(r.ok, true);
  assert.ok(
    issued.some((c) => c === `ipset add dm-allow-h_refresh1 93.184.216.34,tcp:8080 -exist`),
    'new A record added'
  );
  assert.ok(
    issued.some((c) => c === 'ipset del dm-allow-h_refresh1 10.9.9.9,tcp:8080'),
    'stale A record removed'
  );
  assert.equal(r.added, 2, 'added count (tcp:8080 + udp:53)');
  assert.equal(r.removed, 2, 'removed count');
});

test('refreshHuntEgress: DNS rebound to a private IP installs nothing (#339)', async () => {
  const issued = [];
  const fakeRun = async (argv) => {
    issued.push(argv.join(' '));
    return { ok: true, stdout: '' };
  };
  const scope2 = { ...SCOPE, hosts: ['example.com'], ips: [], labIps: [] };
  const r = await refreshHuntEgress('h_refresh1', {
    readMeta: () => metaFor(scope2),
    run: fakeRun,
    resolveHost: async () => ['169.254.169.254', '10.0.0.5'],
    getCurrentEntries: async () => [],
  });
  assert.equal(r.ok, true);
  assert.ok(
    !issued.some((c) => c.includes('169.254.169.254') || c.includes('10.0.0.5')),
    'no rebound private IP may become an ipset rule'
  );
});

test('refreshHuntEgress: DNS failure keeps old entries (never bricks the hunt)', async () => {
  const issued = [];
  const fakeRun = async (argv) => {
    issued.push(argv.join(' '));
    return { ok: true, stdout: '' };
  };
  const r = await refreshHuntEgress('h_refresh1', {
    readMeta: () => metaFor(SCOPE),
    run: fakeRun,
    resolveHost: async () => {
      throw new Error('dns down');
    },
    getCurrentEntries: async () => ['10.9.9.9,tcp:8080'],
  });
  assert.equal(r.skipped, 'dns-failed-keep-old');
  assert.equal(issued.length, 0, 'no ipset changes on DNS failure');
});

test('refreshHuntEgress: skips hunts without egress state', async () => {
  const r = await refreshHuntEgress('h_legacy', {
    readMeta: () => ({ state: 'running' }),
    run: async () => ({ ok: true }),
  });
  assert.equal(r.skipped, 'no-egress-state');
});
