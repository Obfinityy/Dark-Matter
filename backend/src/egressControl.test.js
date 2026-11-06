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
  removeHuntEgress,
  refreshHuntEgress,
  finalizeHuntEgress,
  listLiveEgressNames,
  isTransientEgressError,
  FINALIZE_APPLY_MAX_ATTEMPTS,
  FINALIZE_RETRY_DELAYS_MS,
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

test('removeHuntEgress: chain is deleted BEFORE the ipsets it references (6 Nov ordering wart)', async () => {
  // Kernel-faithful stub: an ipset destroy fails while the chain that
  // references it still exists ("in use by a kernel component"). The
  // old order (ipsets first) therefore left both sets behind until a
  // later reconciler tick — h_fc3861b36b82 on the teardown deploy.
  const issued = [];
  let chainExists = true;
  const run = async (argv) => {
    const cmd = argv.join(' ');
    issued.push(cmd);
    if (cmd.startsWith('ipset destroy ')) {
      if (chainExists) {
        return { ok: false, error: 'ipset v7.6: Set cannot be destroyed: it is in use by a kernel component' };
      }
      return { ok: true, stdout: '' };
    }
    if (cmd === `iptables -X ${CHAIN}`) chainExists = false;
    return { ok: true, stdout: '' };
  };
  const { results } = await removeHuntEgress(
    HUNT,
    { containerIps: [CIP], resolverIp: RESOLVER },
    { run }
  );
  // Single pass removes everything — no second reconciler tick needed.
  assert.ok(results.every((r) => r.ok), 'every teardown command succeeds in one pass');
  const xIdx = issued.indexOf(`iptables -X ${CHAIN}`);
  const setIdx = issued.indexOf(`ipset destroy ${SET}`);
  const ipIdx = issued.indexOf(`ipset destroy ${IPSET}`);
  const netIdx = issued.indexOf(`docker network rm ${NET}`);
  assert.ok(xIdx !== -1 && setIdx !== -1 && ipIdx !== -1 && netIdx !== -1, 'all artifacts issued');
  assert.ok(xIdx < setIdx && xIdx < ipIdx, 'chain deleted before both ipset destroys');
  assert.ok(setIdx < netIdx && ipIdx < netIdx, 'network removed last');
  // Jump deletes precede the ipset destroys too (they reference the chain).
  assert.ok(issued.indexOf(`iptables -D DOCKER-USER -s ${CIP} -j ${CHAIN}`) < setIdx);
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

// ---------------------------------------------------------------------------
// 6 Nov 2026 — finalize resume failures (1 Nov cluster + 3 Nov h_63678b397e72).
// The old code threw a generic "iptables/ipset apply failed" with the
// failing command and its stderr discarded; the 6 live failures were
// diagnosable only from sudo's journal lines. The apply now records
// error text, finalize names the failing command, transient failures
// are retried (bounded), and a failed apply leaves no half-built state.
// ---------------------------------------------------------------------------

test('applyEgressPlan: failed commands carry the runner error text', async () => {
  const fakeRun = async (argv) => {
    if (argv.includes('-m') && argv.includes('set')) {
      return { ok: false, error: 'iptables: No chain/target/match by that name.' };
    }
    return { ok: true, stdout: '' };
  };
  const r = await applyEgressPlan(plan(), { run: fakeRun });
  assert.equal(r.ok, false);
  const failed = r.results.filter((x) => !x.ok);
  assert.equal(failed.length, 2, 'both -m set rules fail (filter + icmp)');
  for (const f of failed) {
    assert.ok(f.error.includes('No chain/target/match'), `stderr recorded: ${f.cmd}`);
  }
  assert.ok(r.results.every((x) => x.ok || x.error), 'every failure carries error text');
});

test('applyEgressPlan: chain-add race is tolerated (re-check wins)', async () => {
  const calls = {};
  const fakeRun = async (argv) => {
    const cmd = argv.join(' ');
    calls[cmd] = (calls[cmd] || 0) + 1;
    // Chain missing at first check; a concurrent finalize creates it,
    // so our -N loses with "already exists" and the re-check passes.
    if (cmd === `iptables -n -L ${CHAIN}`) {
      return calls[cmd] === 1 ? { ok: false, error: 'no such chain' } : { ok: true, stdout: '' };
    }
    if (cmd === `iptables -N ${CHAIN}`) {
      return { ok: false, error: 'iptables: Chain already exists.' };
    }
    return { ok: true, stdout: '' };
  };
  const r = await applyEgressPlan(plan(), { run: fakeRun });
  assert.equal(r.ok, true, 'concurrent chain creation is not a failure');
  assert.equal(calls[`iptables -N ${CHAIN}`], 1);
  assert.ok(
    r.results.some((x) => x.cmd === `iptables -N ${CHAIN}` && x.skipped === 'created-concurrently'),
    'race recorded as created-concurrently, not as failure'
  );
});

test('applyEgressPlan: jump-add race is tolerated (re-check wins)', async () => {
  const calls = {};
  const jumpCheck = `iptables -C DOCKER-USER -s ${CIP} -j ${CHAIN}`;
  const jumpAdd = `iptables -I DOCKER-USER 1 -s ${CIP} -j ${CHAIN}`;
  const fakeRun = async (argv) => {
    const cmd = argv.join(' ');
    calls[cmd] = (calls[cmd] || 0) + 1;
    if (cmd === jumpCheck) {
      return calls[cmd] === 1 ? { ok: false, error: 'no such rule' } : { ok: true, stdout: '' };
    }
    if (cmd === jumpAdd) return { ok: false, error: 'iptables: Rule already exists.' };
    return { ok: true, stdout: '' };
  };
  const r = await applyEgressPlan(plan(), { run: fakeRun });
  assert.equal(r.ok, true, 'concurrent jump creation is not a failure');
  assert.ok(
    r.results.some((x) => x.cmd === jumpAdd && x.skipped === 'created-concurrently'),
    'race recorded as created-concurrently, not as failure'
  );
});

test('isTransientEgressError: only the lock/busy/timeout class is transient', () => {
  assert.equal(isTransientEgressError('Another app is currently holding the xtables lock'), true);
  assert.equal(isTransientEgressError('Resource temporarily unavailable'), true);
  assert.equal(isTransientEgressError('ipset: Timeout'), true);
  assert.equal(isTransientEgressError('timed out after 30000ms'), true);
  assert.equal(isTransientEgressError('Bad argument `foo`'), false);
  assert.equal(isTransientEgressError('sudo: a password is required'), false);
  assert.equal(isTransientEgressError('iptables: Chain already exists.'), false);
  assert.equal(isTransientEgressError(''), false);
  assert.equal(isTransientEgressError(null), false);
});

// --- finalizeHuntEgress helpers (injected deps; no root/docker) ---

const EGRESS = {
  scope: SCOPE,
  gatewayIp: GW,
  proxyPort: PROXY_PORT,
  resolverIp: RESOLVER,
};

function finalizeDeps({ run, sleeps = [] } = {}) {
  const metas = [];
  return {
    deps: {
      docker: async () => `${CIP} `,
      resolveHost: async () => ['93.184.216.34'],
      run,
      writeMeta: (id, patch) => {
        metas.push({ id, patch });
      },
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    },
    metas,
    sleeps,
  };
}

test('finalizeHuntEgress: happy path applies the plan and persists meta.egress', async () => {
  const issued = [];
  const { deps, metas } = finalizeDeps({
    run: async (argv) => {
      issued.push(argv.join(' '));
      return { ok: true, stdout: '' };
    },
  });
  const { plan: p, applied } = await finalizeHuntEgress(HUNT, 'dm-hunt-h_testegress', EGRESS, deps);
  assert.equal(applied.ok, true);
  assert.equal(p.setName, SET);
  assert.equal(metas.length, 1);
  assert.equal(metas[0].patch.egress.setName, SET);
  assert.equal(metas[0].patch.egress.chain, CHAIN);
  assert.deepEqual(metas[0].patch.egress.containerIps, [CIP]);
});

test('finalizeHuntEgress: thrown error names the failing command and its stderr', async () => {
  const issued = [];
  const { deps } = finalizeDeps({
    run: async (argv) => {
      issued.push(argv.join(' '));
      if (argv.includes('-m') && argv.includes('set')) {
        return { ok: false, error: 'Could not fetch rule set generation id: Invalid argument' };
      }
      return { ok: true, stdout: '' };
    },
  });
  await assert.rejects(
    () => finalizeHuntEgress(HUNT, 'dm-hunt-h_testegress', EGRESS, deps),
    (err) => {
      assert.ok(err.message.includes('iptables/ipset apply failed'), err.message);
      assert.ok(err.message.includes(`-m set --match-set ${SET} dst,dst -j ACCEPT`), err.message);
      assert.ok(err.message.includes('Could not fetch rule set generation id'), err.message);
      assert.ok(err.message.includes('after 1 attempt(s)'), err.message);
      return true;
    }
  );
  // Deterministic failure fails fast: the ipset create ran exactly once.
  assert.equal(issued.filter((c) => c === `ipset create ${SET} hash:ip,port -exist`).length, 1);
});

test('finalizeHuntEgress: failed apply leaves no half-built state (cleanup issued)', async () => {
  const issued = [];
  const { deps } = finalizeDeps({
    run: async (argv) => {
      issued.push(argv.join(' '));
      if (argv.includes('-m') && argv.includes('set')) {
        return { ok: false, error: 'Could not fetch rule set generation id' };
      }
      return { ok: true, stdout: '' };
    },
  });
  await assert.rejects(() => finalizeHuntEgress(HUNT, 'dm-hunt-h_testegress', EGRESS, deps));
  assert.ok(issued.includes(`ipset destroy ${SET}`), 'tuple set destroyed on failure');
  assert.ok(issued.includes(`ipset destroy ${IPSET}`), 'ip set destroyed on failure');
  assert.ok(issued.includes(`iptables -X ${CHAIN}`), 'chain removed on failure');
});

test('finalizeHuntEgress: transient lock failure is retried and succeeds', async () => {
  let creates = 0;
  const { deps, sleeps } = finalizeDeps({
    run: async (argv) => {
      const cmd = argv.join(' ');
      if (cmd.startsWith(`ipset create ${SET} `)) creates++;
      if (creates < 2) {
        return { ok: false, error: 'Another app is currently holding the xtables lock' };
      }
      return { ok: true, stdout: '' };
    },
  });
  const { applied } = await finalizeHuntEgress(HUNT, 'dm-hunt-h_testegress', EGRESS, deps);
  assert.equal(applied.ok, true, 'second attempt succeeds');
  assert.equal(creates, 2, 'apply ran twice (one retry)');
  assert.deepEqual(sleeps, [FINALIZE_RETRY_DELAYS_MS[0]], 'one backoff sleep before the retry');
});

test('finalizeHuntEgress: transient failure exhausts retries, then throws with detail', async () => {
  let creates = 0;
  const { deps, sleeps } = finalizeDeps({
    run: async (argv) => {
      const cmd = argv.join(' ');
      if (cmd.startsWith(`ipset create ${SET} `)) creates++;
      return { ok: false, error: 'Another app is currently holding the xtables lock' };
    },
  });
  await assert.rejects(
    () => finalizeHuntEgress(HUNT, 'dm-hunt-h_testegress', EGRESS, deps),
    (err) => {
      assert.ok(err.message.includes(`after ${FINALIZE_APPLY_MAX_ATTEMPTS} attempt(s)`), err.message);
      assert.ok(err.message.includes('xtables lock'), err.message);
      return true;
    }
  );
  assert.equal(creates, FINALIZE_APPLY_MAX_ATTEMPTS, 'bounded retries, no more');
  assert.deepEqual(sleeps, FINALIZE_RETRY_DELAYS_MS, 'backoff delays in order');
});

// EGRESS-TEARDOWN LEAK (6 Nov 2026, h_fc3861b36b82): the stale-state
// reconciler needs a read-only ground truth for what is actually live
// in the kernel. listLiveEgressNames parses `iptables -S` (chain lines
// only — -A rules are not chains), `ipset list -n` and
// `docker network ls` through an injected runner: no sudo, no docker.
test('listLiveEgressNames: parses chains, sets and networks from probe output', async () => {
  const run = async (argv) => {
    if (argv[0] === 'iptables') {
      return {
        ok: true,
        stdout:
          '-P INPUT ACCEPT\n' +
          '-N dm-egress-h_fc3861b36b82\n' +
          '-A INPUT -s 172.24.0.2/32 -j dm-egress-h_fc3861b36b82\n' +
          '-N DOCKER-USER\n',
      };
    }
    if (argv[0] === 'ipset') {
      return { ok: true, stdout: 'dm-allow-h_fc3861b36b82\ndm-allow-ip-h_fc3861b36b82\n' };
    }
    if (argv[0] === 'docker') {
      return { ok: true, stdout: 'bridge\ndm-net-h_fc3861b36b82\n' };
    }
    return { ok: false, error: 'unexpected command' };
  };
  const { chains, sets, nets } = await listLiveEgressNames({ run });
  assert.deepEqual([...chains].sort(), ['DOCKER-USER', 'dm-egress-h_fc3861b36b82']);
  assert.deepEqual([...sets].sort(), ['dm-allow-h_fc3861b36b82', 'dm-allow-ip-h_fc3861b36b82']);
  assert.deepEqual([...nets].sort(), ['bridge', 'dm-net-h_fc3861b36b82']);
});

test('listLiveEgressNames: a failed probe reads as nothing live', async () => {
  const run = async () => ({ ok: false, error: 'iptables: command not found' });
  const { chains, sets, nets } = await listLiveEgressNames({ run });
  assert.equal(chains.size, 0);
  assert.equal(sets.size, 0);
  assert.equal(nets.size, 0);
});

test('listLiveEgressNames: a throwing runner reads as nothing live', async () => {
  const run = async () => {
    throw new Error('spawn ENOENT');
  };
  const { chains, sets, nets } = await listLiveEgressNames({ run });
  assert.equal(chains.size, 0);
  assert.equal(sets.size, 0);
  assert.equal(nets.size, 0);
});
