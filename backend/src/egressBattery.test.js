// Dark Matter — P2 egress battery T1–T18 (31 Oct 2026).
// The acceptance battery from implementation-plan-2026-10-31.md §11a.
//
// WHAT RUNS WHERE
// - Tests WITHOUT a skip run locally in this sandbox (plan-level proofs +
//   proxy-level proofs). They must pass.
// - Tests marked `needs-ec2-firewall-stage` are IMPLEMENTED but skipped
//   locally: they need real iptables/ipset/docker on the EC2 box.
//
// EC2-STAGE RUNNER (acceptance phase, separately approved — never run these
// against a live hunt):
//   1. ssh to the EC2 box (backend host).
//   2. cd /opt/Dark-Matter/backend   (repo checkout with this branch)
//   3. Ensure NO hunt is running (the battery creates its own synthetic
//      hunt ids h_egressbat / h_egressbat2 and its own containers).
//   4. sudo -E env EGRESS_EC2_STAGE=1 EGRESS_USE_SUDO=1 \
//        node --test src/egressBattery.test.js
//      (root for iptables/ipset; EGRESS_USE_SUDO=1 makes the appliers use
//      `sudo -n` when not root; the battery's docker calls need the docker
//      socket.)
//   5. Prerequisites on the box: docker, iptables, ipset, and the
//      darkmatter/hunt:latest image (for probe/web containers).
// With EGRESS_EC2_STAGE=1 every test below executes for real, including the
// live-fire ones. Locally (unset) the live-fire tests report as skipped.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
import {
  buildEgressPlan,
  diffEgressEntries,
  matchesTuple,
  buildRemoveEgress,
  refreshHuntEgress,
  proxyPortForHunt,
  egressNetName,
  egressSetName,
  egressChainName,
  sanitizeHuntId,
} from './egressControl.js';
import { startEgressProxy, proxyAllows } from './egressProxy.js';
import { validateDestinations } from './scopeGuard.js';
import { buildHuntContainerRunArgs } from './huntRunner.js';

const EC2_STAGE = process.env.EGRESS_EC2_STAGE === '1';
// Skip convention (required): every skip reason starts with this marker.
const ec2Only = (what) => (EC2_STAGE ? false : `needs-ec2-firewall-stage: ${what}`);

// ---------------------------------------------------------------------------
// LOCAL SECTION — plan-level + proxy-level proofs (run in the sandbox)
// ---------------------------------------------------------------------------

const HUNT = 'h_battery';
const SET = egressSetName(HUNT);
const CHAIN = egressChainName(HUNT);
const GW = '172.18.0.1';
const CIP = '172.18.0.2';
const RESOLVER = '8.8.8.8';
const PROXY_PORT = proxyPortForHunt(HUNT);

// P1 scope shape shared with the app-layer guard (scopeGuard.buildScope).
const SCOPE = Object.freeze({
  version: 1,
  target: 'https://example.com',
  hosts: ['example.com'],
  outHosts: [],
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

function localPlan() {
  return buildEgressPlan(HUNT, SCOPE, {
    containerIps: [CIP],
    gatewayIp: GW,
    proxyPort: PROXY_PORT,
    resolverIp: RESOLVER,
    resolved: RESOLVED,
  });
}

// Shared local proxy for the T5/T16/T17/T18 proofs.
let backend;
let BACKEND_PORT;
let proxy;
let PROXY_PORT_LOCAL;

before(async () => {
  backend = http.createServer((req, res) => {
    const h = String(req.headers.host || '').split(':')[0].toLowerCase();
    if (req.url === '/redir') {
      res.writeHead(302, { Location: `http://evil.test:${BACKEND_PORT}/` });
      res.end();
      return;
    }
    if (h === 'allowed.test') {
      res.writeHead(200);
      res.end('ALLOWED-VHOST');
    } else {
      res.writeHead(404);
      res.end('unknown vhost');
    }
  });
  await new Promise((r) => backend.listen(0, '127.0.0.1', r));
  BACKEND_PORT = backend.address().port;
  const scope = {
    version: 1,
    target: 'http://allowed.test/',
    hosts: ['allowed.test'],
    outHosts: [],
    ips: [],
    labIps: [],
    ports: [{ port: BACKEND_PORT, proto: 'tcp' }],
    labTargets: [],
    createdAt: new Date().toISOString(),
  };
  proxy = await startEgressProxy({
    huntId: 'h_batteryproxy',
    scope,
    port: 0,
    dial: () => net.connect(BACKEND_PORT, '127.0.0.1'),
  });
  PROXY_PORT_LOCAL = proxy.port;
});

after(async () => {
  if (proxy) await proxy.stop().catch(() => {});
  if (backend) await new Promise((r) => backend.close(r));
});

function bproxyGet(absoluteUrl, hostHeader) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: PROXY_PORT_LOCAL,
        method: 'GET',
        path: absoluteUrl,
        headers: { Host: hostHeader },
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
      }
    );
    req.on('error', reject);
    req.setTimeout(5000, () => req.destroy(new Error('timeout')));
    req.end();
  });
}

function bproxyConnect(authority) {
  return new Promise((resolve, reject) => {
    const s = net.connect(PROXY_PORT_LOCAL, '127.0.0.1', () => {
      s.write(`CONNECT ${authority} HTTP/1.1\r\nHost: ${authority}\r\n\r\n`);
    });
    let data = '';
    const timer = setTimeout(() => {
      s.destroy();
      reject(new Error('timeout'));
    }, 5000);
    s.on('data', (c) => {
      data += c.toString();
      if (data.includes('\r\n\r\n')) {
        clearTimeout(timer);
        resolve({ head: data, socket: s });
      }
    });
    s.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
  });
}

test('T2 (local): out-of-scope hostname has no network path + app-layer denies', () => {
  const p = localPlan();
  assert.ok(!p.entries.some((e) => e.startsWith('203.0.113.9,')), 'no tuple for out-of-scope IP');
  const v = proxyAllows(SCOPE, { host: 'evil.example', port: 8080 });
  assert.equal(v.ok, false);
  // …and the plan ends in rate-limited LOG + DROP for anything unmatched.
  assert.ok(p.iptables.some((c) => c.includes('-j LOG') && c.includes('5/min')), 'LOG rule present');
  assert.equal(p.iptables[p.iptables.length - 1], `iptables -A ${CHAIN} -j DROP`, 'DROP last');
});

test('T4 (local): DNS pinned — NAT redirect for both protos, resolver-only DNS rules', () => {
  const p = localPlan();
  const natAdds = p.nat.map((n) => n.add);
  assert.ok(
    natAdds.includes(
      `iptables -t nat -A PREROUTING -s ${CIP} -p udp --dport 53 -j DNAT --to-destination ${RESOLVER}:53`
    ),
    'udp pin'
  );
  assert.ok(
    natAdds.includes(
      `iptables -t nat -A PREROUTING -s ${CIP} -p tcp --dport 53 -j DNAT --to-destination ${RESOLVER}:53`
    ),
    'tcp pin'
  );
  // The ONLY port-53 ACCEPTs in the chain target the pinned resolver.
  const dnsRules = p.iptables.filter((c) => c.includes('--dport 53') && c.includes('-j ACCEPT'));
  assert.equal(dnsRules.length, 2);
  assert.ok(dnsRules.every((c) => c.includes(`-d ${RESOLVER}`)), 'no other DNS destination');
});

test('T5 (local): proxy never follows redirects; each hop re-validated', async () => {
  const r = await bproxyGet(`http://allowed.test:${BACKEND_PORT}/redir`, `allowed.test:${BACKEND_PORT}`);
  assert.equal(r.status, 302, 'redirect returned untouched, not followed');
  assert.match(r.headers.location, /^http:\/\/evil\.test/);
  const hop2 = await bproxyGet(r.headers.location, `evil.test:${BACKEND_PORT}`);
  assert.equal(hop2.status, 403, 'out-of-scope redirect hop blocked');
});

test('T6 (local): metadata endpoint explicitly dropped + app-layer denies', () => {
  const p = localPlan();
  assert.ok(
    p.iptables.includes(`iptables -A ${CHAIN} -d 169.254.169.254/32 -j DROP`),
    'explicit metadata DROP'
  );
  const v = proxyAllows(SCOPE, { host: '169.254.169.254', port: 80 });
  assert.equal(v.ok, false);
  assert.match(v.reason, /metadata/);
});

test('T7 (local): hunt containers disable IPv6 via --sysctl', () => {
  const withEgress = buildHuntContainerRunArgs('h_x', 't', {
    network: 'dm-net-h_x',
    egressProxy: { gatewayIp: GW, proxyPort: 17881 },
    dnsIp: RESOLVER,
  });
  const i = withEgress.indexOf('--sysctl');
  assert.ok(i !== -1 && withEgress[i + 1] === 'net.ipv6.conf.all.disable_ipv6=1', '--sysctl present');
  const di = withEgress.indexOf('--dns');
  assert.ok(di !== -1 && withEgress[di + 1] === RESOLVER, '--dns pins the resolver');
  const legacy = buildHuntContainerRunArgs('h_x', 't', {});
  assert.ok(!legacy.includes('--sysctl'), 'legacy hunts unchanged');
  assert.ok(!legacy.includes('--dns'), 'legacy hunts keep embedded DNS');
});

test('T8 (local): alternate IPs — DNS change diffed within one reconciler tick', async () => {
  const issued = [];
  const r = await refreshHuntEgress('h_bat8', {
    readMeta: () => ({
      egress: { setName: egressSetName('h_bat8') },
      scopeGuard: { ...SCOPE, hosts: ['example.com'], ips: [], labIps: [] },
    }),
    run: async (argv) => {
      issued.push(argv.join(' '));
      return { ok: true };
    },
    resolveHost: async () => ['93.184.216.35'], // simulated DNS change (public IP; #339 drops private rebounds)
    getCurrentEntries: async () => ['10.9.9.9,tcp:8080'],
  });
  assert.equal(r.ok, true);
  assert.ok(issued.some((c) => c.includes('93.184.216.35,tcp:8080 -exist')), 'new A record added');
  assert.ok(issued.some((c) => c === `ipset del ${egressSetName('h_bat8')} 10.9.9.9,tcp:8080`), 'stale removed');
});

test('T9 (local): per-hunt isolation by construction — no shared names', () => {
  const a = 'h_huntA';
  const b = 'h_huntB';
  assert.notEqual(egressNetName(a), egressNetName(b), 'distinct networks');
  assert.notEqual(egressSetName(a), egressSetName(b), 'distinct ipsets');
  assert.notEqual(egressChainName(a), egressChainName(b), 'distinct chains');
  assert.notEqual(proxyPortForHunt(a), proxyPortForHunt(b), 'distinct proxy ports');
  // Single-homed: new hunts attach ONLY to their own network.
  const args = buildHuntContainerRunArgs(a, 't', {
    network: egressNetName(a),
    egressProxy: { gatewayIp: GW, proxyPort: proxyPortForHunt(a) },
  });
  assert.equal(args[args.indexOf('--network') + 1], egressNetName(a));
  assert.equal(sanitizeHuntId(a), a);
});

test('T10 (local): teardown symmetry — every artifact has a removal', () => {
  const p = localPlan();
  const r = buildRemoveEgress(HUNT, { containerIps: [CIP], resolverIp: RESOLVER });
  for (const j of p.jumps) assert.ok(r.iptables.includes(j.del));
  for (const n of p.nat) assert.ok(r.nat.includes(n.del));
  assert.ok(r.iptables.includes(`iptables -F ${CHAIN}`));
  assert.ok(r.iptables.includes(`iptables -X ${CHAIN}`));
  assert.ok(r.ipset.some((c) => c === `ipset destroy ${SET}`));
  assert.ok(r.ipset.some((c) => c === `ipset destroy dm-allow-ip-${HUNT}`));
  assert.ok(r.docker.some((c) => c === `docker network rm ${egressNetName(HUNT)}`));
});

test('T11 (local): authorized IP + authorized port (443) allowed at app layer; proxy-only at net layer', () => {
  const v = proxyAllows(SCOPE, { host: '93.184.216.34', port: 443 });
  assert.equal(v.ok, true, 'app layer allows authorized IP:443');
  const p = localPlan();
  assert.ok(!p.entries.some((e) => e.endsWith(',tcp:443')), 'no DIRECT 443 tuple (proxy-only)');
  assert.ok(
    p.iptables.includes(`iptables -A ${CHAIN} -d ${GW} -p tcp --dport ${PROXY_PORT} -j ACCEPT`),
    'proxy path explicitly allowed'
  );
});

test('T12 (local): authorized IP + port 22 → no tuple, denied', () => {
  const p = localPlan();
  assert.ok(!p.entries.some((e) => e.endsWith(',tcp:22')), 'no ssh tuple');
  assert.equal(matchesTuple(p.entries, '93.184.216.34', 'tcp', 22), false);
  const v = validateDestinations([{ host: '93.184.216.34', port: 22, protocol: 'tcp' }], SCOPE);
  assert.equal(v.ok, false);
  assert.match(v.reason, /not authorized/);
});

test('T13 (local): authorized IP + port 3306 → no tuple, denied', () => {
  const p = localPlan();
  assert.ok(!p.entries.some((e) => e.endsWith(',tcp:3306')), 'no mysql tuple');
  const v = validateDestinations([{ host: '93.184.216.34', port: 3306, protocol: 'tcp' }], SCOPE);
  assert.equal(v.ok, false);
});

test('T14 (local): authorized IP + wrong protocol (UDP/8080, only TCP authorized) → denied', () => {
  const p = localPlan();
  assert.ok(!p.entries.some((e) => e.includes(',udp:8080')), 'no udp tuple for tcp-only port');
  const v = validateDestinations([{ host: '93.184.216.34', port: 8080, protocol: 'udp' }], SCOPE);
  assert.equal(v.ok, false);
  assert.match(v.reason, /not authorized/);
});

test('T15 (local): sweep over the plan — only authorized tuples; single rate-limited LOG', () => {
  const p = localPlan();
  const authorizedPorts = new Set(
    SCOPE.ports.filter((x) => x.port !== 80 && x.port !== 443).map((x) => `${x.proto}:${x.port}`)
  );
  for (const e of p.entries) {
    const [, , proto, port] = e.match(/^([\d.]+),(\w+):(\d+)$/) || [];
    assert.ok(authorizedPorts.has(`${proto}:${port}`), `unexpected tuple in plan: ${e}`);
  }
  const logs = p.iptables.filter((c) => c.includes('-j LOG'));
  assert.equal(logs.length, 1, 'exactly one LOG rule (no log flood)');
  assert.ok(logs[0].includes('-m limit --limit 5/min'), 'rate-limited');
});

test('T16 (local): shared-IP — in-scope 200, out-of-scope on the same IP blocked', async () => {
  const ok = await bproxyGet(`http://allowed.test:${BACKEND_PORT}/`, `allowed.test:${BACKEND_PORT}`);
  assert.equal(ok.status, 200);
  assert.equal(ok.body, 'ALLOWED-VHOST');
  const bad = await bproxyGet(`http://other.test:${BACKEND_PORT}/`, `other.test:${BACKEND_PORT}`);
  assert.equal(bad.status, 403, 'hostname decides, not the shared IP');
});

test('T17 (local): direct-IP with forged Host → blocked', async () => {
  const r = await bproxyGet(`http://127.0.0.1:${BACKEND_PORT}/`, 'allowed.test');
  assert.equal(r.status, 403);
});

test('T18 (local): CONNECT out-of-scope:443 denied (SNI-equivalent)', async () => {
  const { head, socket } = await bproxyConnect('evil.test:443');
  assert.match(head, /^HTTP\/1\.1 502/);
  socket.destroy();
  const ok = await bproxyConnect(`allowed.test:${BACKEND_PORT}`);
  assert.match(ok.head, /^HTTP\/1\.1 200/);
  ok.socket.destroy();
});

test('T3 (local): out-of-scope IP literal has no tuple and is denied', () => {
  const p = localPlan();
  assert.ok(!p.entries.some((e) => e.startsWith('203.0.113.7,')), 'no tuple for foreign IP');
  const v = validateDestinations([{ host: '203.0.113.7', port: 8080, protocol: 'tcp' }], SCOPE);
  assert.equal(v.ok, false);
  assert.match(v.reason, /not in the hunt scope/);
});

// ---------------------------------------------------------------------------
// EC2-STAGE SECTION — live-fire tests (skipped locally via ec2Only()).
// Run on the EC2 backend host with:
//   sudo -E env EGRESS_EC2_STAGE=1 EGRESS_USE_SUDO=1 \
//     node --test src/egressBattery.test.js
// Prerequisites: docker, iptables, ipset, darkmatter/hunt:latest image,
// no live hunts (synthetic ids h_egressbat / h_egressbat2 are used).
// ---------------------------------------------------------------------------

const HUNT_IMAGE = process.env.HUNT_IMAGE || 'darkmatter/hunt:latest';
const BAT = 'h_egressbat';
const BAT2 = 'h_egressbat2';
let bat = null; // { webIp, webPort, probeIp, setup, scope, tornDown }

async function shDocker(args, opts = {}) {
  const r = await execFileAsync('docker', args, { timeout: opts.timeout || 60000 });
  return String(r.stdout || '').trim();
}

async function shSudo(args, opts = {}) {
  const r = await execFileAsync('sudo', ['-n', ...args], { timeout: opts.timeout || 30000 });
  return String(r.stdout || '').trim();
}

// Minimal DNS client: proves a query sent to an UNROUTABLE resolver
// (192.0.2.53, TEST-NET-1) still gets an answer — only possible if the
// PREROUTING DNAT pin rewrote it to the pinned resolver.
const DNS_PIN_PY = `
import socket, struct, sys, random
srv, name = sys.argv[1], sys.argv[2]
qid = random.randint(1, 65534)
qname = b''.join([bytes([len(p)]) + p.encode() for p in name.split('.')]) + b'\\x00'
pkt = struct.pack('!HHHHHH', qid, 0x0100, 1, 0, 0, 0) + qname + struct.pack('!HH', 1, 1)
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); s.settimeout(4)
s.sendto(pkt, (srv, 53))
data, _ = s.recvfrom(512)
rqid, flags, qdcount, ancount = struct.unpack('!HHHH', data[:8])
if rqid != qid or ancount == 0: sys.exit('no usable answer')
print('pinned-ok')
`.trim();

// Raw CONNECT through the per-hunt proxy; prints the response status line.
const CONNECT_PY = `
import socket, sys
gw, port, host, dport = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4]
s = socket.create_connection((gw, port), timeout=8)
s.sendall(('CONNECT %s:%s HTTP/1.1\\r\\nHost: %s:%s\\r\\n\\r\\n' % (host, dport, host, dport)).encode())
data = b''
while b'\\r\\n\\r\\n' not in data:
    chunk = s.recv(4096)
    if not chunk: break
    data += chunk
print(data.decode(errors='replace').split('\\r\\n')[0])
`.trim();

before(async () => {
  if (!EC2_STAGE) return;
  const { setupHuntEgress, finalizeHuntEgress } = await import('./egressControl.js');
  // Lab "target": plain HTTP server on the default bridge network.
  await shDocker(['rm', '-f', 'egressbat-web']).catch(() => {});
  await shDocker([
    'run', '-d', '--name', 'egressbat-web', '--network', 'bridge',
    HUNT_IMAGE, 'python3', '-m', 'http.server', '18080',
  ]);
  const webIp = await shDocker([
    'inspect', '-f', '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}', 'egressbat-web',
  ]);
  assert.match(webIp, /^\d+\.\d+\.\d+\.\d+$/, 'web container got a bridge IP');
  const scope = {
    version: 1,
    target: `http://${webIp}:18080/`,
    hosts: [],
    outHosts: [],
    ips: [],
    labIps: [webIp],
    ports: [
      { port: 18080, proto: 'tcp' },
      { port: 80, proto: 'tcp' },
      { port: 443, proto: 'tcp' },
    ],
    labTargets: [webIp],
    createdAt: new Date().toISOString(),
  };
  const setup = await setupHuntEgress(BAT, scope, { startProxy: true });
  // Probe container mirrors production run args (--sysctl, --dns).
  await shDocker(['rm', '-f', 'egressbat-probe']).catch(() => {});
  await shDocker([
    'run', '-d', '--name', 'egressbat-probe', '--network', setup.netName,
    '--sysctl', 'net.ipv6.conf.all.disable_ipv6=1',
    '--dns', setup.resolverIp,
    HUNT_IMAGE, 'sleep', '600',
  ]);
  await finalizeHuntEgress(BAT, 'egressbat-probe', setup, {
    docker: (args) => shDocker(args),
    writeMeta: () => {},
  });
  const probeIp = await shDocker([
    'inspect', '-f', '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}', 'egressbat-probe',
  ]);
  bat = { webIp, webPort: 18080, probeIp, setup, scope, tornDown: false };
});

after(async () => {
  if (!EC2_STAGE) return;
  const { removeHuntEgress, stopProxyForHunt } = await import('./egressControl.js');
  for (const id of [BAT, BAT2]) {
    await stopProxyForHunt(id).catch(() => {});
    await removeHuntEgress(id, {}).catch(() => {});
  }
  for (const c of ['egressbat-probe', 'egressbat-probe2', 'egressbat-web']) {
    await shDocker(['rm', '-f', c]).catch(() => {});
  }
});

test('T1 (live): in-scope lab target reachable on authorized port (200)', { skip: ec2Only('live EC2 + docker + iptables') }, async () => {
  const code = await shDocker([
    'exec', 'egressbat-probe', 'curl', '-s', '-o', '/dev/null', '-w', '%{http_code}',
    '--max-time', '10', `http://${bat.webIp}:${bat.webPort}/`,
  ]);
  assert.equal(code, '200', 'in-scope lab target answers 200 through the tuple path');
});

test('T2 (live): out-of-scope hostname — TCP blocked + LOG counter moves', { skip: ec2Only('live iptables LOG/DROP verification') }, async () => {
  const chain = egressChainName(BAT);
  const logCount = async () => {
    const out = await shSudo(['iptables', '-L', chain, '-v', '-n', '-x']);
    const line = out.split('\n').find((l) => l.includes('dm-egress-drop'));
    const m = line && line.trim().match(/^(\d+)\s/);
    return m ? Number(m[1]) : -1;
  };
  const beforeN = await logCount();
  assert.ok(beforeN >= 0, 'LOG rule found with packet counter');
  // 192.0.2.44 = TEST-NET-1 (unroutable): DROP => curl times out.
  const r = await shDocker(['exec', 'egressbat-probe', 'curl', '-s', '--max-time', '5', 'http://192.0.2.44/']).then(
    () => 'unexpected-success',
    () => 'blocked'
  );
  assert.equal(r, 'blocked', 'out-of-scope TCP blocked');
  const afterN = await logCount();
  assert.ok(afterN > beforeN, `violation logged (LOG packets ${beforeN} -> ${afterN})`);
});

test('T3 (live): out-of-scope IP literal blocked', { skip: ec2Only('live iptables DROP verification') }, async () => {
  const r = await shDocker([
    'exec', 'egressbat-probe', 'curl', '-s', '--max-time', '5', 'http://192.0.2.45:8080/',
  ]).then(() => 'unexpected-success', () => 'blocked');
  assert.equal(r, 'blocked', 'out-of-scope IP literal dropped');
});

test('T4 (live): DNS via the pinned resolver; hardcoded resolver is NAT-pinned', { skip: ec2Only('live container DNS path') }, async () => {
  const resolv = await shDocker(['exec', 'egressbat-probe', 'cat', '/etc/resolv.conf']);
  assert.ok(resolv.includes(bat.setup.resolverIp), 'container resolver pinned via --dns');
  const ip = await shDocker(['exec', 'egressbat-probe', 'getent', 'hosts', 'example.com'], { timeout: 15000 });
  assert.match(ip, /^\d+\.\d+\.\d+\.\d+/, 'DNS resolves through the pinned path');
  // Query sent to an UNROUTABLE address: an answer proves the PREROUTING
  // DNAT pin rewrote it to the pinned resolver (direct would time out).
  const pin = await shDocker(
    ['exec', 'egressbat-probe', 'python3', '-c', DNS_PIN_PY, '192.0.2.53', 'example.com'],
    { timeout: 15000 }
  );
  assert.equal(pin.trim(), 'pinned-ok', 'hardcoded-resolver query answered via the NAT pin');
});

test('T5 (live): backstop — app layer bypassed, network layer still drops', { skip: ec2Only('live iptables DROP verification') }, async () => {
  // --noproxy '*' bypasses the filtering proxy entirely (app layer out of
  // the picture): direct :80 to an out-of-scope IP must still drop.
  const r = await shDocker([
    'exec', 'egressbat-probe', 'curl', '-s', '--noproxy', '*', '--max-time', '5', 'http://192.0.2.44:80/',
  ]).then(() => 'unexpected-success', () => 'blocked');
  assert.equal(r, 'blocked', 'direct :80 bypass dropped at the network layer');
});

test('T6 (live): cloud metadata endpoint blocked', { skip: ec2Only('live iptables DROP verification') }, async () => {
  const r = await shDocker([
    'exec', 'egressbat-probe', 'curl', '-s', '--max-time', '5', 'http://169.254.169.254/latest/meta-data/',
  ]).then(() => 'unexpected-success', () => 'blocked');
  assert.equal(r, 'blocked', '169.254.169.254 dropped by the explicit rule');
});

test('T7 (live): IPv6 disabled in-container; v6 attempts fail closed', { skip: ec2Only('live container sysctl') }, async () => {
  const v = await shDocker(['exec', 'egressbat-probe', 'cat', '/proc/sys/net/ipv6/conf/all/disable_ipv6']);
  assert.equal(v.trim(), '1', 'IPv6 disabled via --sysctl');
  const r = await shDocker(['exec', 'egressbat-probe', 'ping', '-6', '-c1', '-W2', '2001:db8::1']).then(
    () => 'unexpected-success',
    () => 'blocked'
  );
  assert.equal(r, 'blocked', 'IPv6 attempt fails closed');
});

test('T9 (live): cross-hunt — container A cannot reach container B', { skip: ec2Only('live docker networks') }, async () => {
  const { setupHuntEgress, finalizeHuntEgress, removeHuntEgress, stopProxyForHunt } = await import('./egressControl.js');
  const scope2 = {
    version: 1,
    target: 'http://example.com/',
    hosts: ['example.com'],
    outHosts: [],
    ips: [],
    labIps: [],
    ports: [{ port: 443, proto: 'tcp' }],
    labTargets: [],
    createdAt: new Date().toISOString(),
  };
  const setup2 = await setupHuntEgress(BAT2, scope2, { startProxy: false });
  try {
    await shDocker(['rm', '-f', 'egressbat-probe2']).catch(() => {});
    await shDocker(['run', '-d', '--name', 'egressbat-probe2', '--network', setup2.netName, HUNT_IMAGE, 'sleep', '600']);
    await finalizeHuntEgress(BAT2, 'egressbat-probe2', setup2, {
      docker: (args) => shDocker(args),
      writeMeta: () => {},
    });
    const icmp = await shDocker(['exec', 'egressbat-probe2', 'ping', '-c1', '-W2', bat.probeIp]).then(
      () => 'reachable',
      () => 'blocked'
    );
    assert.equal(icmp, 'blocked', 'cross-hunt ICMP blocked');
    const tcp = await shDocker([
      'exec', 'egressbat-probe2', 'curl', '-s', '--max-time', '4', `http://${bat.probeIp}:${bat.webPort}/`,
    ]).then(() => 'reachable', () => 'blocked');
    assert.equal(tcp, 'blocked', 'cross-hunt TCP blocked');
  } finally {
    await stopProxyForHunt(BAT2).catch(() => {});
    await removeHuntEgress(BAT2, {}).catch(() => {});
    await shDocker(['rm', '-f', 'egressbat-probe2']).catch(() => {});
  }
});

test('T11 (live): authorized IP + authorized port allowed via proxy CONNECT', { skip: ec2Only('live proxy CONNECT path') }, async () => {
  const gw = bat.setup.gatewayIp;
  const pp = String(bat.setup.proxyPort);
  // Authorized IP + authorized port (18080/tcp in scope): CONNECT → 200.
  const ok = await shDocker(['exec', 'egressbat-probe', 'python3', '-c', CONNECT_PY, gw, pp, bat.webIp, '18080'], { timeout: 15000 });
  assert.match(ok.trim(), /^HTTP\/1\.1 200/, 'proxy CONNECT to authorized IP:port → 200');
  // Out-of-scope IP: proxy denies with "Forbidden by hunt scope" (it never dials).
  const denied = await shDocker(['exec', 'egressbat-probe', 'python3', '-c', CONNECT_PY, gw, pp, '192.0.2.44', '443'], { timeout: 15000 });
  assert.match(denied.trim(), /502 Forbidden by hunt scope/, 'proxy CONNECT to out-of-scope IP denied');
});

test('T15 (live): port sweep — only the authorized tuple responds', { skip: ec2Only('live sweep, ~20s') }, async () => {
  // Port 53 excluded: TCP/53 to the target is DNAT-pinned to the resolver
  // by design (answers), which is the T4 property, not a leak.
  const ports = [21, 22, 23, 25, 79, 80, 110, 143, 443, 445, 3306, 8080, 8081, 18080, 18081];
  const open = [];
  for (const pt of ports) {
    const ok = await shDocker(
      ['exec', 'egressbat-probe', 'timeout', '1', 'bash', '-c', `echo > /dev/tcp/${bat.webIp}/${pt}`],
      { timeout: 15000 }
    ).then(() => true, () => false);
    if (ok) open.push(pt);
  }
  assert.deepEqual(open, [18080], `only the authorized tuple responds, got: ${JSON.stringify(open)}`);
});

test('T10 (live): teardown leaves zero ipset/iptables/network residue', { skip: ec2Only('live teardown verification') }, async () => {
  const { removeHuntEgress, stopProxyForHunt } = await import('./egressControl.js');
  await stopProxyForHunt(BAT).catch(() => {});
  await removeHuntEgress(BAT, { containerIps: [bat.probeIp], resolverIp: bat.setup.resolverIp });
  const sets = await shSudo(['ipset', 'list', '-n']).catch(() => '');
  assert.ok(
    !sets.split('\n').some((l) => l.includes('dm-allow-h_egressbat')),
    'no ipset residue'
  );
  const rules = await shSudo(['iptables', '-S']);
  assert.ok(!rules.includes('dm-egress-h_egressbat'), 'no iptables residue');
  const nat = await shSudo(['iptables', '-t', 'nat', '-S']);
  assert.ok(!nat.includes('h_egressbat'), 'no NAT residue');
  const nets = await shDocker(['network', 'ls', '--format', '{{.Name}}']);
  assert.ok(!nets.split('\n').includes(egressNetName(BAT)), 'no network residue');
  bat.tornDown = true;
});
