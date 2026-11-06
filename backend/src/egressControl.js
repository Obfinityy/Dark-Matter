// Dark Matter — P2 Network Isolation + Egress Control (31 Oct 2026, AUD-M1).
//
// Network-layer half of scope enforcement. P1 (scopeGuard.js) validates
// destinations at the application layer BEFORE a command runs; this module
// enforces the SAME immutable per-hunt scope at the network layer so that
// anything the app layer cannot see (unparsed shell idioms, direct sockets,
// redirect hops, TLS without a visible URL) is still contained.
//
// Design (see implementation-plan rev.2 §P2, strengthened 14:36 + 14:40 IST):
// - One scope object, two enforcement layers: this module consumes the
//   identical frozen scope P1 persists (hosts/ips/labIps/ports).
// - Per-hunt Docker network dm-net-<id> (hunt-to-hunt isolation).
// - Default-deny egress per hunt container via ipset hash:ip,port holding
//   PROTOCOL-QUALIFIED tuples (IP,tcp:443). An allowed IP on a
//   non-authorized port/protocol is still denied — IP-only allowlisting
//   cannot distinguish them.
// - Ports 80/443 are NEVER in the tuple set: HTTP(S) is allowed ONLY via
//   the per-hunt filtering proxy (egressProxy.js), which validates the
//   request hostname / CONNECT SNI. Direct 80/443 bypass attempts are
//   dropped. (Shared-IP rule at the network layer.)
// - DNS only to a pinned resolver (NAT PREROUTING catches hardcoded 8.8.8.8).
// - Chain/filter rules are generated as pure data (exact command strings)
//   so they are fully unit-testable without root, Docker, or iptables.
// - The appliers (applyEgressPlan / removeHuntEgress / refreshHuntEgress)
//   are thin and take an injected runner — the EC2 firewall stage runs
//   them with root. They are NEVER run against live hunts from unit tests.
//
// Deviation note (documented, 31 Oct): the plan sketch said one shared
// chain DM-EGRESS. This module uses PER-HUNT chains (dm-egress-<id>)
// instead: the LOG prefix carries the hunt id (forensics), and teardown
// cannot disturb other hunts' rules. Strictly stronger, same semantics.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as dns } from 'node:dns';
import { isPrivateIP } from './scopeParser.js';

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Naming (length-limited by kernel: ipset ≤31 chars, iptables chain ≤29)
// ---------------------------------------------------------------------------

export function sanitizeHuntId(huntId) {
  return String(huntId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);
}

/** Per-hunt Docker network. */
export function egressNetName(huntId) {
  return `dm-net-${sanitizeHuntId(huntId)}`;
}

/** Tuple allowlist: hash:ip,port. 9 + 22 = 31 chars max. */
export function egressSetName(huntId) {
  return `dm-allow-${sanitizeHuntId(huntId).slice(0, 22)}`;
}

/** Plain-IP set for the scoped ICMP exception. 12 + 19 = 31 chars max. */
export function egressIpSetName(huntId) {
  return `dm-allow-ip-${sanitizeHuntId(huntId).slice(0, 19)}`;
}

/** Per-hunt filter chain. 10 + 18 = 28 chars max (kernel limit 29). */
export function egressChainName(huntId) {
  return `dm-egress-${sanitizeHuntId(huntId).slice(0, 18)}`;
}

/** LOG prefix for dropped packets. Kernel caps --log-prefix at 29 chars:
 *  "dm-egress-drop:" (15) + hunt id truncated to 14 = 29 max.
 *
 *  NOTE (3 Nov 2026): the trailing space was REMOVED. The prefix is
 *  embedded in generated iptables commands WITHOUT quotes, and the
 *  runner executes those commands with NO shell (shSplit + execFile) —
 *  any whitespace would split the argument and iptables would fail.
 *  An external-target scan died at egress finalize
 *  ("iptables/ipset apply failed (fail-closed)") because of exactly
 *  this class of bug (shell syntax baked into generated commands). */
export function egressLogPrefix(huntId) {
  return `dm-egress-drop:${sanitizeHuntId(huntId).slice(0, 14)}`;
}

/** Per-hunt proxy port, hash-derived like the ttyd ports (different range). */
export const EGRESS_PROXY_PORT_MIN = 17881;
export const EGRESS_PROXY_PORT_RANGE = 100; // 17881-17980

export function proxyPortForHunt(huntId) {
  const s = sanitizeHuntId(huntId);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return EGRESS_PROXY_PORT_MIN + (h % EGRESS_PROXY_PORT_RANGE);
}

// Ports that MUST go through the filtering proxy — never in the tuple set.
export const PROXY_ONLY_PORTS = new Set([80, 443]);

const IPV4_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

function normProto(p) {
  return String(p || '').toLowerCase() === 'udp' ? 'udp' : 'tcp';
}

/** One ipset hash:ip,port entry: `IP,proto:port`. */
export function tupleEntry(ip, proto, port) {
  return `${ip},${normProto(proto)}:${Number(port)}`;
}

// ---------------------------------------------------------------------------
// DNS upstream discovery (pure over injected resolv.conf text)
// ---------------------------------------------------------------------------

/** First non-localhost nameserver from resolv.conf text; null if none. */
export function resolveUpstreamDns(resolvConfText) {
  for (const line of String(resolvConfText || '').split('\n')) {
    const m = line.trim().match(/^nameserver\s+(\S+)/i);
    if (m && !/^(127\.|::1)/.test(m[1])) return m[1];
  }
  return null;
}

// ---------------------------------------------------------------------------
// Plan builder (PURE — no side effects; returns exact command strings)
// ---------------------------------------------------------------------------

/**
 * Build the full egress plan for a hunt.
 * @param {string} huntId
 * @param {Object} scope - P1 frozen scope {version, hosts, ips, labIps, ports:[{port,proto}]}
 * @param {Object} opts
 * @param {string[]} opts.containerIps - hunt container IPs (all interfaces)
 * @param {string} opts.gatewayIp - per-hunt network gateway IP (proxy bind)
 * @param {number} opts.proxyPort
 * @param {string} opts.resolverIp - pinned DNS resolver
 * @param {Object<string,string[]>} opts.resolved - hostname -> IP[] (A/AAAA)
 * @param {Object<string,string[]>} [opts.labTranslated] - labIp -> translated IP[] (post-DNAT)
 * @returns {Object} {huntId, chain, chainStep, setName, ipSetName, netName, proxyPort, entries, ipEntries, ipset, iptables, nat}
 */
export function buildEgressPlan(huntId, scope, opts = {}) {
  if (!scope || scope.version !== 1) {
    throw new Error('buildEgressPlan: invalid hunt scope (fail-closed)');
  }
  const san = sanitizeHuntId(huntId);
  if (!san) throw new Error('buildEgressPlan: invalid huntId');
  const chain = egressChainName(huntId);
  const setName = egressSetName(huntId);
  const ipSetName = egressIpSetName(huntId);
  const netName = egressNetName(huntId);
  const proxyPort = Number(opts.proxyPort || proxyPortForHunt(huntId));
  const gatewayIp = opts.gatewayIp;
  const resolverIp = opts.resolverIp;
  if (!gatewayIp) throw new Error('buildEgressPlan: gatewayIp required');
  if (!resolverIp) throw new Error('buildEgressPlan: resolverIp required');
  const containerIps = (opts.containerIps || []).filter(Boolean);
  if (!containerIps.length) throw new Error('buildEgressPlan: containerIps required');
  const resolved = opts.resolved || {};
  const labTranslated = opts.labTranslated || {};

  // Non-web tuples only — 80/443 go through the filtering proxy exclusively.
  const tuples = (scope.ports || []).filter((p) => !PROXY_ONLY_PORTS.has(Number(p.port)));

  const entrySet = new Set();
  const ipSet = new Set();
  const addIp = (ip) => {
    if (!IPV4_RE.test(ip)) return; // v6 disabled in hunt containers; skip AAAA here
    ipSet.add(ip);
    for (const t of tuples) entrySet.add(tupleEntry(ip, t.proto, t.port));
  };
  for (const h of scope.hosts || []) {
    for (const ip of resolved[h] || []) {
      // FIX (#339): DNS re-resolution must never install a private IP
      // for an in-scope hostname — a rebound record (e.g. cloud
      // metadata 169.254.169.254) would otherwise open an SSRF window
      // at execution time. Dropped with a warning; the host simply
      // contributes no tuples until DNS returns a public address.
      // Explicit scope.ips / scope.labIps below are NOT filtered:
      // lab IPs are private by opt-in design.
      if (isPrivateIP(ip)) {
        console.warn(`[egress] dropping rebound private IP ${ip} for in-scope host ${h}`);
        continue;
      }
      addIp(ip);
    }
  }
  for (const ip of scope.ips || []) addIp(ip);
  for (const ip of scope.labIps || []) {
    addIp(ip); // literal lab IP (covers the INPUT-path / docker-proxy hairpin)
    for (const tip of labTranslated[ip] || []) addIp(tip); // post-DNAT translation
  }

  const entries = [...entrySet].sort();
  const ipEntries = [...ipSet].sort();

  // --- ipset commands ---
  const ipset = [
    `ipset create ${setName} hash:ip,port -exist`,
    `ipset create ${ipSetName} hash:ip -exist`,
    `ipset flush ${setName}`,
    `ipset flush ${ipSetName}`,
    ...entries.map((e) => `ipset add ${setName} ${e} -exist`),
    ...ipEntries.map((ip) => `ipset add ${ipSetName} ${ip} -exist`),
  ];

  // The filter chain is created idempotently via check-then-add.
  // NOTE (3 Nov 2026): NEVER embed shell syntax (`2>/dev/null`, `||`,
  // quotes, redirects) in generated commands. The runner executes them
  // with NO shell (shSplit + execFile), so shell syntax arrives as
  // literal arguments and iptables fails. An external-target scan died
  // at egress finalize ("iptables/ipset apply failed (fail-closed)")
  // because this used to be `iptables -N <chain> 2>/dev/null || true`.
  const chainStep = {
    check: `iptables -n -L ${chain}`,
    add: `iptables -N ${chain}`,
  };

  // --- iptables filter commands (chain rebuilt idempotently) ---
  const iptables = [
    `iptables -F ${chain}`,
    `iptables -A ${chain} -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT`,
    `iptables -A ${chain} -m set --match-set ${setName} dst,dst -j ACCEPT`,
    `iptables -A ${chain} -d ${gatewayIp} -p tcp --dport ${proxyPort} -j ACCEPT`,
    `iptables -A ${chain} -p udp --dport 53 -d ${resolverIp} -j ACCEPT`,
    `iptables -A ${chain} -p tcp --dport 53 -d ${resolverIp} -j ACCEPT`,
    `iptables -A ${chain} -p icmp --icmp-type echo-request -m set --match-set ${ipSetName} dst -j ACCEPT`,
    `iptables -A ${chain} -m limit --limit 5/min -j LOG --log-prefix ${egressLogPrefix(huntId)} --log-level 4`,
    `iptables -A ${chain} -d 169.254.169.254/32 -j DROP`,
    `iptables -A ${chain} -j DROP`,
  ];
  // Per-container-IP jumps (idempotent add guarded by the applier).
  const jumps = [];
  for (const cip of containerIps) {
    jumps.push({
      check: `iptables -C DOCKER-USER -s ${cip} -j ${chain}`,
      add: `iptables -I DOCKER-USER 1 -s ${cip} -j ${chain}`,
      del: `iptables -D DOCKER-USER -s ${cip} -j ${chain}`,
    });
    jumps.push({
      check: `iptables -C INPUT -s ${cip} -j ${chain}`,
      add: `iptables -I INPUT 1 -s ${cip} -j ${chain}`,
      del: `iptables -D INPUT -s ${cip} -j ${chain}`,
    });
  }

  // --- NAT: pin ALL port-53 to the resolver (catches hardcoded 8.8.8.8) ---
  const nat = [];
  for (const cip of containerIps) {
    for (const proto of ['udp', 'tcp']) {
      nat.push({
        check: `iptables -t nat -C PREROUTING -s ${cip} -p ${proto} --dport 53 -j DNAT --to-destination ${resolverIp}:53`,
        add: `iptables -t nat -A PREROUTING -s ${cip} -p ${proto} --dport 53 -j DNAT --to-destination ${resolverIp}:53`,
        del: `iptables -t nat -D PREROUTING -s ${cip} -p ${proto} --dport 53 -j DNAT --to-destination ${resolverIp}:53`,
      });
    }
  }

  return {
    huntId: san,
    chain,
    chainStep,
    setName,
    ipSetName,
    netName,
    proxyPort,
    gatewayIp,
    resolverIp,
    containerIps,
    entries,
    ipEntries,
    ipset,
    iptables,
    jumps,
    nat,
  };
}

/** Diff desired vs current set entries → {add[], del[]} (pure). */
export function diffEgressEntries(current, desired) {
  const cur = new Set(current || []);
  const want = new Set(desired || []);
  return {
    add: [...want].filter((e) => !cur.has(e)).sort(),
    del: [...cur].filter((e) => !want.has(e)).sort(),
  };
}

/** Test-mirror of ipset hash:ip,port semantics: does (ip,proto,port) match? */
export function matchesTuple(entries, ip, proto, port) {
  return (entries || []).includes(tupleEntry(ip, proto, port));
}

/**
 * Build the teardown command plan (pure).
 * @returns {Object} {ipset[], iptables[], nat[], docker[]}
 */
export function buildRemoveEgress(huntId, opts = {}) {
  const san = sanitizeHuntId(huntId);
  const chain = egressChainName(huntId);
  const setName = egressSetName(huntId);
  const ipSetName = egressIpSetName(huntId);
  const netName = egressNetName(huntId);
  const containerIps = (opts.containerIps || []).filter(Boolean);
  const resolverIp = opts.resolverIp;
  const iptables = [];
  const nat = [];
  // NOTE (3 Nov 2026): NO shell syntax (`2>/dev/null || true`) in these
  // commands — the runner has no shell, so it arrived as literal args and
  // every teardown command failed. removeHuntEgress already swallows
  // per-command errors (best-effort), which is the ignore-missing
  // behaviour the shell suffix was trying to buy. Before this fix,
  // teardown silently removed NOTHING (stale chains/sets accumulated).
  for (const cip of containerIps) {
    iptables.push(`iptables -D DOCKER-USER -s ${cip} -j ${chain}`);
    iptables.push(`iptables -D INPUT -s ${cip} -j ${chain}`);
    if (resolverIp) {
      for (const proto of ['udp', 'tcp']) {
        nat.push(
          `iptables -t nat -D PREROUTING -s ${cip} -p ${proto} --dport 53 -j DNAT --to-destination ${resolverIp}:53`
        );
      }
    }
  }
  iptables.push(`iptables -F ${chain}`);
  iptables.push(`iptables -X ${chain}`);
  return {
    ipset: [
      `ipset destroy ${setName}`,
      `ipset destroy ${ipSetName}`,
    ],
    iptables,
    nat,
    docker: [`docker network rm ${netName}`],
  };
}

// ---------------------------------------------------------------------------
// Appliers (thin; side effects only through the injected runner)
// ---------------------------------------------------------------------------

function defaultRunner(argv) {
  const useSudo = process.env.EGRESS_USE_SUDO === '1';
  const cmd = useSudo ? ['sudo', '-n', ...argv] : argv;
  return execFileAsync(cmd[0], cmd.slice(1), { timeout: 30000 }).then(
    (r) => ({ ok: true, stdout: String(r.stdout || '').trim() }),
    (err) => ({ ok: false, error: err.message || String(err) })
  );
}

function shSplit(cmd) {
  // Minimal shell-word split for our generated commands (no quotes used).
  return String(cmd).split(/\s+/).filter(Boolean);
}

/**
 * Apply a plan. Idempotent: chain rebuilt, jumps/NAT added only if absent.
 * NEVER call against a live hunt outside the EC2 firewall stage.
 *
 * Each result carries the runner's error text when a command fails
 * (6 Nov 2026): finalizeHuntEgress used to throw a generic
 * "iptables/ipset apply failed" with the failing command and its
 * stderr discarded — the 1 Nov failures were diagnosable ONLY from
 * sudo's journal lines. The hunt's status event must name the cause.
 */
export async function applyEgressPlan(plan, { run = defaultRunner } = {}) {
  const results = [];
  const exec = async (cmd) => {
    const r = await run(shSplit(cmd));
    const entry = { cmd, ok: r.ok };
    if (!r.ok && r.error) entry.error = String(r.error).slice(0, 500);
    results.push(entry);
    return r;
  };
  // Check-then-add with concurrent-creation tolerance (6 Nov 2026).
  // Two resumes of the SAME hunt can race: both see the chain/rule
  // missing, both issue the add, one loses with "already exists".
  // That is NOT a failure — re-check, and if the object exists now
  // the add is a success. Without the re-check the loser fails the
  // whole apply and the hunt dies fail-closed on a race it did not
  // cause. A re-check that still fails records the real error.
  const checkThenAdd = async (step) => {
    const chk = await run(shSplit(step.check));
    if (chk.ok) {
      results.push({ cmd: step.check, ok: true, skipped: 'already-present' });
      return true;
    }
    const r = await run(shSplit(step.add));
    if (r.ok) {
      results.push({ cmd: step.add, ok: true });
      return true;
    }
    const recheck = await run(shSplit(step.check));
    if (recheck.ok) {
      results.push({ cmd: step.add, ok: true, skipped: 'created-concurrently' });
      return true;
    }
    const entry = { cmd: step.add, ok: false };
    if (r.error) entry.error = String(r.error).slice(0, 500);
    results.push(entry);
    return false;
  };
  for (const cmd of plan.ipset) await exec(cmd);
  // Idempotent chain creation — must precede the -A rules below, which
  // reference the chain. Check-then-add (no shell syntax; see above).
  if (plan.chainStep && plan.chainStep.check && plan.chainStep.add) {
    await checkThenAdd(plan.chainStep);
  }
  for (const cmd of plan.iptables) await exec(cmd);
  for (const j of plan.jumps) await checkThenAdd(j);
  for (const n of plan.nat) await checkThenAdd(n);
  return { ok: results.every((r) => r.ok), results };
}

/** Remove all egress state for a hunt. Best-effort, never throws.
 *
 * ORDER MATTERS (6 Nov 2026 ordering wart): the chain's rules reference
 * the ipsets (`-m set --match-set`), so destroying a set while the chain
 * still exists fails with "in use by a kernel component" and the set
 * survives until a later reconciler tick — exactly what happened to
 * h_fc3861b36b82 on the teardown deploy (boot tick removed the chain,
 * the two ipsets needed the periodic tick 51s later). Remove the
 * iptables state FIRST (jump deletes, flush, chain delete), then the
 * NAT pins, THEN the ipsets, and the docker network last. */
export async function removeHuntEgress(huntId, opts = {}, { run = defaultRunner } = {}) {
  const plan = buildRemoveEgress(huntId, opts);
  const results = [];
  for (const cmd of [...plan.iptables, ...plan.nat, ...plan.ipset, ...plan.docker]) {
    try {
      const r = await run(shSplit(cmd));
      results.push({ cmd, ok: r.ok });
    } catch (err) {
      results.push({ cmd, ok: false, error: err.message || String(err) });
    }
  }
  return { ok: true, results };
}

/**
 * Read-only probe of the live kernel egress state: which per-hunt
 * iptables chains, ipsets and docker networks exist RIGHT NOW.
 *
 * EGRESS-TEARDOWN LEAK (6 Nov 2026, h_fc3861b36b82): a finished hunt's
 * chain + both ipsets + network survived for days because NOTHING ever
 * looked at the kernel — every teardown decision was driven by meta
 * alone, and the one teardown call that should have removed them never
 * ran. The stale-state reconciler (huntRunner.js) uses this probe as
 * its ground truth: a hunt is only torn down when one of ITS names
 * (derived from its huntId via egressChainName/egressSetName/
 * egressIpSetName/egressNetName — same functions the plan builder
 * uses, so truncation matches) actually appears here. No kernel
 * artifact → no action, so the probe can never disturb a hunt whose
 * state is already gone. Pure read: `iptables -S`, `ipset list -n`,
 * `docker network ls` — never a -D/-X/destroy/rm. A failed probe
 * yields empty sets (fail-closed: the reconciler then does nothing).
 */
export async function listLiveEgressNames({ run = defaultRunner } = {}) {
  const chains = new Set();
  const sets = new Set();
  const nets = new Set();
  try {
    const r = await run(['iptables', '-S']);
    if (r && r.ok && r.stdout) {
      for (const line of String(r.stdout).split('\n')) {
        const m = line.trim().match(/^-N\s+(\S+)/);
        if (m) chains.add(m[1]);
      }
    }
  } catch { /* probe failure reads as "nothing live" */ }
  try {
    const r = await run(['ipset', 'list', '-n']);
    if (r && r.ok && r.stdout) {
      for (const line of String(r.stdout).split('\n')) {
        const name = line.trim();
        if (name) sets.add(name);
      }
    }
  } catch { /* probe failure reads as "nothing live" */ }
  try {
    const r = await run(['docker', 'network', 'ls', '--format', '{{.Name}}']);
    if (r && r.ok && r.stdout) {
      for (const line of String(r.stdout).split('\n')) {
        const name = line.trim();
        if (name) nets.add(name);
      }
    }
  } catch { /* probe failure reads as "nothing live" */ }
  return { chains, sets, nets };
}

/**
 * Re-resolve scope hostnames and refresh the tuple set (reconciler tick).
 * Skips hunts without egress state. Never removes everything on DNS failure
 * (fail-closed on the allow side would brick the hunt — keep old entries).
 */
export async function refreshHuntEgress(
  huntId,
  {
    readMeta,
    resolveHost = defaultResolveHost,
    getCurrentEntries,
    run = defaultRunner,
  } = {}
) {
  const san = sanitizeHuntId(huntId);
  const read = readMeta || ((await import('./store.js')).readHuntMeta);
  const meta = read(san) || {};
  const egress = meta.egress;
  if (!egress || !egress.setName) return { skipped: 'no-egress-state' };
  const scope = meta.scopeGuard;
  if (!scope || scope.version !== 1) return { skipped: 'no-scope' };

  const resolved = {};
  let anyResolved = false;
  for (const h of scope.hosts || []) {
    try {
      const ips = await resolveHost(h);
      if (ips && ips.length) {
        resolved[h] = ips;
        anyResolved = true;
      }
    } catch {
      /* keep old entries for this host */
    }
  }
  if (!anyResolved && (scope.hosts || []).length) {
    return { skipped: 'dns-failed-keep-old' };
  }
  const tuples = (scope.ports || []).filter((p) => !PROXY_ONLY_PORTS.has(Number(p.port)));
  const want = new Set();
  for (const h of scope.hosts || []) {
    for (const ip of resolved[h] || []) {
      if (!IPV4_RE.test(ip)) continue;
      // FIX (#339): same rebinding guard as buildEgressPlan — a
      // freshly resolved private IP for an in-scope hostname must
      // never become an ipset rule. Explicit scope.ips / labIps below
      // are untouched (lab IPs are private by opt-in design).
      if (isPrivateIP(ip)) {
        console.warn(`[egress] dropping rebound private IP ${ip} for in-scope host ${h}`);
        continue;
      }
      for (const t of tuples) want.add(tupleEntry(ip, t.proto, t.port));
    }
  }
  for (const ip of [...(scope.ips || []), ...(scope.labIps || [])]) {
    if (!IPV4_RE.test(ip)) continue;
    for (const t of tuples) want.add(tupleEntry(ip, t.proto, t.port));
  }
  const current = getCurrentEntries
    ? await getCurrentEntries(egress.setName)
    : [];
  const { add, del } = diffEgressEntries(current, [...want].sort());
  const results = [];
  for (const e of add) {
    const r = await run(['ipset', 'add', egress.setName, e, '-exist']);
    const entry = { cmd: `ipset add ${egress.setName} ${e}`, ok: r.ok };
    if (!r.ok && r.error) entry.error = String(r.error).slice(0, 500);
    results.push(entry);
  }
  for (const e of del) {
    const r = await run(['ipset', 'del', egress.setName, e]);
    const entry = { cmd: `ipset del ${egress.setName} ${e}`, ok: r.ok };
    if (!r.ok && r.error) entry.error = String(r.error).slice(0, 500);
    results.push(entry);
  }
  return { ok: true, added: add.length, removed: del.length, results };
}

async function defaultResolveHost(host) {
  const out = [];
  // If host is already an IPv4 address, use it directly (no DNS needed)
  // Fix 1 Nov 2026: IP literals like 172.17.0.1 failed dns.resolve4,
  // leaving the egress allowlist empty and failing closed.
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) {
    out.push(host);
    return out;
  }
  try {
    out.push(...(await dns.resolve4(host)));
  } catch { /* ignore */ }
  return [...new Set(out)];
}

/**
 * Full setup used by huntRunner for NEW hunts carrying the P1 scope.
 * Creates the network, starts the filtering proxy, resolves, builds and
 * applies the plan. Returns egress state for meta persistence.
 * Injected deps keep it unit-testable; NEVER run against a live hunt here.
 */
export async function setupHuntEgress(
  huntId,
  scope,
  {
    docker,
    resolveHost = defaultResolveHost,
    startProxy,
    readResolvConf,
    getGatewayIp,
  } = {}
) {
  const san = sanitizeHuntId(huntId);
  const netName = egressNetName(huntId);
  const proxyPort = proxyPortForHunt(huntId);
  const runDocker = docker || ((args) => execFileAsync('docker', args, { timeout: 30000 }).then((r) => String(r.stdout || '').trim()));

  await runDocker(['network', 'create', netName]).catch(() => {});
  const gatewayIp = getGatewayIp
    ? await getGatewayIp(netName)
    : await runDocker(['network', 'inspect', '-f', '{{(index .IPAM.Config 0).Gateway}}', netName]).catch(() => null);
  if (!gatewayIp) throw new Error('setupHuntEgress: could not determine network gateway');

  const resolvText = readResolvConf
    ? await readResolvConf()
    : await import('node:fs/promises').then((fs) => fs.readFile('/etc/resolv.conf', 'utf8').catch(() => ''));
  const resolverIp = resolveUpstreamDns(resolvText) || '8.8.8.8';

  let proxyHandle = null;
  if (startProxy) {
    const { startEgressProxy } = await import('./egressProxy.js');
    const starter = typeof startProxy === 'function' ? startProxy : startEgressProxy;
    proxyHandle = await starter({ huntId: san, scope, port: proxyPort, bindIp: gatewayIp });
    proxyRegistry.set(san, proxyHandle);
  }

  const resolved = {};
  for (const h of scope.hosts || []) {
    try {
      const ips = await resolveHost(h);
      if (ips && ips.length) resolved[h] = ips;
    } catch { /* unresolved hosts simply contribute no tuples */ }
  }

  return { netName, gatewayIp, proxyPort, resolverIp, proxyHandle, resolved, scope };
}

// ---------------------------------------------------------------------------
// Proxy registry (host-local; the proxy dies with the backend process, so
// the reconciler re-creates it — see ensureHuntEgressAlive)
// ---------------------------------------------------------------------------

const proxyRegistry = new Map();

/** Test seam: clear the registry. */
export function _resetProxyRegistry() {
  proxyRegistry.clear();
}

function proxyAlive(handle) {
  try {
    return !!(handle && handle.server && handle.server.listening);
  } catch {
    return false;
  }
}

/** Ensure the per-hunt filtering proxy is running; restart if dead. */
export async function ensureProxyAlive(huntId, scope, { gatewayIp, proxyPort, startProxy } = {}) {
  const san = sanitizeHuntId(huntId);
  const cur = proxyRegistry.get(san);
  if (proxyAlive(cur)) return { handle: cur, restarted: false };
  if (cur) {
    try {
      await cur.stop();
    } catch { /* ignore */ }
    proxyRegistry.delete(san);
  }
  const { startEgressProxy } = await import('./egressProxy.js');
  const starter = typeof startProxy === 'function' ? startProxy : startEgressProxy;
  const handle = await starter({ huntId: san, scope, port: proxyPort, bindIp: gatewayIp });
  proxyRegistry.set(san, handle);
  return { handle, restarted: true };
}

/** Stop and forget the per-hunt proxy. Best-effort, never throws. */
export async function stopProxyForHunt(huntId) {
  const san = sanitizeHuntId(huntId);
  const cur = proxyRegistry.get(san);
  proxyRegistry.delete(san);
  if (cur) {
    try {
      await cur.stop();
    } catch { /* ignore */ }
  }
  return true;
}

/** Attempts for the egress-plan apply inside finalizeHuntEgress. */
export const FINALIZE_APPLY_MAX_ATTEMPTS = 3;
/** Backoff between apply attempts in ms: attempt 1→2, then 2→3. */
export const FINALIZE_RETRY_DELAYS_MS = [250, 500];

/**
 * Transient apply failures are worth one more attempt; deterministic
 * ones (bad command, missing binary, sudo denied, bad argument) are
 * not — retrying them only burns the resume window. The xtables lock
 * is the classic transient: dockerd's own iptables programming and a
 * concurrent finalize both take it, and iptables-nft fails fast
 * ("Another app is currently holding the xtables lock") instead of
 * waiting. Zero lock errors have been observed in the journal so far
 * (6 Nov 2026) — this covers the class, it does not claim a sighting.
 * The evidenced intermittent pattern is the 1 Nov crash-loop resume:
 * finalize ran once, failed once, and the hunt died on that single
 * attempt with no second chance.
 */
export function isTransientEgressError(text) {
  return /xtables lock|resource temporarily unavailable|temporarily unavailable|timed? ?out|try again/i.test(
    String(text || '')
  );
}

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** First failing apply result, for the error message. */
function firstFailedResult(results) {
  return (results || []).find((r) => !r.ok) || null;
}

/**
 * Post-container-start: inspect container IPs, resolve, build + apply plan,
 * persist meta.egress. Fail-closed: throws on failure (the hunt must not
 * run unisolated).
 *
 * Failure handling (6 Nov 2026 — the 1 Nov / 3 Nov finalize failures):
 * - The apply is retried a bounded number of times, but ONLY for
 *   transient failures (xtables lock / resource-busy / timeout). The
 *   plan is idempotent by construction (create -exist, flush,
 *   check-then-add), so a full re-apply is safe.
 * - The thrown error names the first failing command and its stderr
 *   (truncated): the old generic "iptables/ipset apply failed" was
 *   diagnosable only from sudo's journal lines.
 * - A failed apply leaves no half-built state behind: best-effort
 *   removeHuntEgress with the plan's own data runs before throwing,
 *   so a later resume re-applies from a clean slate.
 */
export async function finalizeHuntEgress(
  huntId,
  containerName,
  egress,
  { docker, resolveHost = defaultResolveHost, run = defaultRunner, writeMeta, sleep = defaultSleep } = {}
) {
  const san = sanitizeHuntId(huntId);
  const runDocker =
    docker ||
    ((args) => execFileAsync('docker', args, { timeout: 30000 }).then((r) => String(r.stdout || '').trim()));
  const out = await runDocker([
    'inspect',
    '-f',
    '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}',
    containerName,
  ]);
  const containerIps = String(out || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!containerIps.length) throw new Error('finalizeHuntEgress: no container IP (fail-closed)');
  const resolved = {};
  for (const h of (egress.scope && egress.scope.hosts) || []) {
    try {
      const ips = await resolveHost(h);
      if (ips && ips.length) resolved[h] = ips;
    } catch { /* unresolved hosts contribute no tuples */ }
  }
  const plan = buildEgressPlan(san, egress.scope, {
    containerIps,
    gatewayIp: egress.gatewayIp,
    proxyPort: egress.proxyPort,
    resolverIp: egress.resolverIp,
    resolved,
  });
  let applied = null;
  let attemptsMade = 0;
  let lastErrorText = 'unknown apply failure';
  for (let attempt = 1; attempt <= FINALIZE_APPLY_MAX_ATTEMPTS; attempt++) {
    attemptsMade = attempt;
    applied = await applyEgressPlan(plan, { run });
    if (applied.ok) break;
    const failed = firstFailedResult(applied.results);
    lastErrorText = failed
      ? `${failed.cmd}${failed.error ? ` :: ${failed.error}` : ''}`
      : 'unknown apply failure';
    if (!isTransientEgressError(lastErrorText) || attempt === FINALIZE_APPLY_MAX_ATTEMPTS) break;
    await sleep(FINALIZE_RETRY_DELAYS_MS[attempt - 1] ?? 500);
  }
  if (!applied.ok) {
    try {
      await removeHuntEgress(san, { containerIps, resolverIp: egress.resolverIp }, { run });
    } catch { /* cleanup is best-effort; never masks the apply error */ }
    throw new Error(
      `finalizeHuntEgress: iptables/ipset apply failed (fail-closed) after ${attemptsMade} attempt(s): ${lastErrorText.slice(0, 300)}`
    );
  }
  try {
    const write = writeMeta || ((await import('./store.js')).writeHuntMetaCheckpoint);
    write(san, {
      egress: {
        netName: plan.netName,
        setName: plan.setName,
        chain: plan.chain,
        proxyPort: plan.proxyPort,
        gatewayIp: plan.gatewayIp,
        resolverIp: plan.resolverIp,
        containerIps,
        appliedAt: new Date().toISOString(),
      },
    });
  } catch { /* meta persist is best-effort; the rules are already live */ }
  return { plan, applied };
}

/**
 * Reconciler entry: for a running hunt WITH egress state, ensure the proxy
 * is alive (backend restarts kill it) and refresh the tuple set
 * (re-resolution). Skips hunts without egress state — existing hunts are
 * never touched.
 */
export async function ensureHuntEgressAlive(huntId, deps = {}) {
  const san = sanitizeHuntId(huntId);
  const read = deps.readMeta || ((await import('./store.js')).readHuntMeta);
  const meta = (read(san) || {});
  const egress = meta.egress;
  if (!egress || !egress.setName) return { skipped: 'no-egress-state' };
  const scope = meta.scopeGuard;
  if (!scope || scope.version !== 1) return { skipped: 'no-scope' };
  await ensureProxyAlive(san, scope, {
    gatewayIp: egress.gatewayIp,
    proxyPort: egress.proxyPort,
    startProxy: deps.startProxy,
  });
  return refreshHuntEgress(san, deps);
}
