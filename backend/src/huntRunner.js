// Dark Matter — per-hunt isolated container orchestrator.
//
// When the user pastes a link and hits enter, the backend automatically
// spawns a FRESH, ISOLATED Docker container for that hunt — the hunt's own
// "virtual machine". The container runs the recon pipeline + Bedrock-powered
// agent loop against the target, streams findings back as hunt events, and
// is destroyed when the hunt completes, fails, or times out.
//
// Why containers, not EC2-per-hunt: 5-second spin-up (vs 3 min), true
// filesystem/network isolation per hunt, zero extra AWS cost (runs on the
// existing box), automatic teardown. One hunt can never see another's data.
//
// Resource budget per hunt container (t3.large has 8GB / 2 vCPU):
//   --memory=4g --cpus=1.5  →  backend keeps 4GB + 0.5 CPU headroom.
//   Max 2 concurrent hunt containers on t3.large.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const execFileAsync = promisify(execFile);

const HUNT_IMAGE = process.env.HUNT_IMAGE || 'darkmatter/hunt:latest';
const HUNT_MEMORY = process.env.HUNT_MEMORY || '4g';
const HUNT_CPUS = process.env.HUNT_CPUS || '1.5';
const HUNT_TIMEOUT_MS = Number(process.env.HUNT_TIMEOUT_MS || 6 * 3600 * 1000); // 6h default
const DOCKER_TIMEOUT_MS = 30000;

function containerName(huntId) {
  return `dm-hunt-${String(huntId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32)}`;
}

async function docker(args) {
  try {
    const { stdout } = await execFileAsync('docker', args, { timeout: DOCKER_TIMEOUT_MS });
    return stdout.trim();
  } catch (err) {
    if (err.code === 'ENOENT') throw new Error('docker_not_available');
    throw err;
  }
}

/** Check Docker is available on this box. */
export async function dockerAvailable() {
  try {
    await docker(['info']);
    return true;
  } catch {
    return false;
  }
}

/**
 * Spawn an isolated hunt container.
 * @param {string} huntId
 * @param {string} target — authorized target URL
 * @param {{mode?: string, bedrockEnv?: object}} opts
 * @returns {{container: string}} — throws if Docker unavailable
 */
/**
 * The ttyd port a hunt's container publishes on host loopback.
 * SINGLE SOURCE OF TRUTH for the DEFAULT port: spawnHuntContainer
 * publishes a port from this range, and the terminal WS proxy dials it.
 * The Live Terminal went blank for every hunt when the proxy dialed a
 * fixed default port (17681) while containers actually listened on
 * per-hunt hash ports (e.g. 17733 / 17745 / 17685). Range 17681-17780
 * (100 ports).
 *
 * Rule #78 (30 Oct 2026): this is the PRIMARY port, not always the
 * ACTUAL one. The 100-port range is hash-derived, so it CAN collide
 * with a live hunt's container (seen live: 17745 = Juice Shop
 * container). spawnHuntContainer now retries on port-allocation
 * failure with the next candidate port and PERSISTS the resolved port
 * in the hunt meta (ttydPort). Consumers that dial the port must use
 * resolveTtydPort(huntId, meta), never this function directly.
 */
export function ttydPortForHunt(huntId) {
  if (process.env.HUNT_TTYD_PORT) return process.env.HUNT_TTYD_PORT;
  let hash = 0;
  for (let i = 0; i < huntId.length; i++) hash = (hash * 31 + huntId.charCodeAt(i)) >>> 0;
  return String(17681 + (hash % 100));
}

export const TTYD_PORT_MIN = 17681;
export const TTYD_PORT_RANGE = 100; // 17681-17780
// Bounded collision walk: at most this many candidate ports per spawn.
// 8 covers a hash collision plus a few stale mappings; beyond that the
// box has a bigger problem and the spawn must fail loudly.
export const MAX_PORT_COLLISION_RETRIES = 8;

/** True when the value is a valid hunt ttyd port (integer in range). */
export function isHuntTtydPort(port) {
  const n = Number(port);
  return Number.isInteger(n) && n >= TTYD_PORT_MIN && n < TTYD_PORT_MIN + TTYD_PORT_RANGE;
}

/**
 * Ordered candidate ports for a spawn: the persisted port first (a
 * respawn keeps the terminal proxy's port stable), then the primary,
 * then primary+1, +2, ... wrapping inside the range. Pure — exported
 * for tests. Always exactly MAX_PORT_COLLISION_RETRIES entries.
 */
export function ttydPortCandidates(huntId, storedPort) {
  const rawPrimary = Number(ttydPortForHunt(huntId));
  // A garbage HUNT_TTYD_PORT override must not poison the walk —
  // fall back to the range start instead of propagating a bad port.
  const primary = isHuntTtydPort(rawPrimary) ? rawPrimary : TTYD_PORT_MIN;
  const cands = [];
  for (let i = 0; i < MAX_PORT_COLLISION_RETRIES; i++) {
    cands.push(TTYD_PORT_MIN + ((primary - TTYD_PORT_MIN + i) % TTYD_PORT_RANGE));
  }
  const stored = Number(storedPort);
  if (isHuntTtydPort(stored) && stored !== cands[0]) {
    cands.unshift(stored);
    cands.pop();
  }
  return cands;
}

/** Docker's host-port allocation failure text (driver failed
 * programming external connectivity / port is already allocated). */
export function isPortAllocatedError(msg) {
  return /port is already allocated|Bind for .* failed/i.test(String(msg || ''));
}

/**
 * The port the terminal WS proxy must dial for a hunt: the
 * collision-resolved port spawnHuntContainer persisted in the hunt
 * meta when valid, else the primary hash port (pre-#78 hunts have no
 * persisted port). Pure — exported for tests and the server.
 */
export function resolveTtydPort(huntId, meta) {
  const stored = meta && meta.ttydPort;
  if (isHuntTtydPort(stored)) return String(Number(stored));
  return ttydPortForHunt(huntId);
}

// HUNTER-MIND timing fix (26 Oct 2026): the container's clocks are
// NOT skewed — host, container and sandbox all read the same UTC —
// the bug is DISPLAY: the container runs UTC with no TZ set, so the
// XFCE desktop clock (and `date` in its terminal) shows UTC, 5:30
// behind the owner's IST wall clock. Set TZ=Asia/Kolkata in the
// container env and mount the host zoneinfo read-only so glibc can
// resolve the zone (the image also gains tzdata + ENV TZ in
// docker/Dockerfile.hunt for the next rebuild — this runtime path is
// what fixes the CURRENT container without a rebuild).
export const HUNT_TZ = 'Asia/Kolkata';
export const HUNT_ZONEINFO_PATH = '/usr/share/zoneinfo';

/**
 * Pure builder for the `docker run` args of a hunt container —
 * exported so the TZ fix is unit-testable without Docker.
 * @param {string} huntId
 * @param {string} target
 * @param {{mode?: string, zoneinfoPath?: string|null, network?: string, egressProxy?: {gatewayIp: string, proxyPort: number}|null}} opts — pass
 *   zoneinfoPath: null to skip the zoneinfo mount (the caller guards
 *   with fs.existsSync: a mount of a nonexistent host path would
 *   create an empty dir on the host).
 *   network: docker network (default 'bridge' — legacy hunts unchanged).
 *   egressProxy: when set (P2 hunts), HTTP(S) is forced through the
 *   per-hunt filtering proxy and IPv6 is disabled in-container.
 *   dnsIp: when set (P2 hunts), the container's resolver is pinned via
 *   --dns (bypasses Docker's embedded DNS so all queries hit the pinned
 *   resolver; the NAT PREROUTING rule stays as backstop for hardcoded
 *   `dig @other` queries).
 */
export function buildHuntContainerRunArgs(huntId, target, opts = {}) {
  const name = containerName(huntId);
  // Rule #78: the port-collision retry passes an explicit candidate
  // port. An explicitly-passed but out-of-range port is a bug — fail
  // closed instead of silently publishing the hash guess.
  let TTYD_PORT;
  if (opts.ttydPort !== undefined && opts.ttydPort !== null) {
    if (!isHuntTtydPort(opts.ttydPort)) throw new Error(`invalid_ttyd_port: ${opts.ttydPort}`);
    TTYD_PORT = String(Number(opts.ttydPort));
  } else {
    TTYD_PORT = ttydPortForHunt(huntId);
  }
  const zoneinfo = opts.zoneinfoPath === undefined ? HUNT_ZONEINFO_PATH : opts.zoneinfoPath;
  const network = opts.network || 'bridge';
  const env = [
    '-e', `DM_HUNT_ID=${huntId}`,
    '-e', `DM_TARGET=${target}`,
    '-e', `DM_MODE=${opts.mode || 'normal'}`,
    '-e', `DM_TTYD_PORT=${TTYD_PORT}`,
    '-e', `TZ=${HUNT_TZ}`,
    // NOTE: no cloud credentials are passed into hunt containers. The host
    // backend is the sole brain (LLM lives on the host); the container is
    // only hands (tools). This keeps AWS keys out of the sandbox.
  ];
  // P2: force HTTP(S) through the per-hunt filtering proxy. Tools that
  // honor proxy env vars (curl, wget, python, git) are validated by
  // hostname at the proxy; direct 80/443 is dropped by iptables anyway.
  if (opts.egressProxy && opts.egressProxy.gatewayIp && opts.egressProxy.proxyPort) {
    const purl = `http://${opts.egressProxy.gatewayIp}:${opts.egressProxy.proxyPort}`;
    env.push('-e', `http_proxy=${purl}`, '-e', `https_proxy=${purl}`, '-e', `HTTP_PROXY=${purl}`, '-e', `HTTPS_PROXY=${purl}`);
  }
  return [
    'run', '-d',
    '--name', name,
    // ZOMBIE FIX (1 Nov 2026): use --init to run tini as PID 1.
    // Without an init, the container's PID 1 is 'sleep infinity' which
    // never calls wait(), so exited children (XFCE desktop processes,
    // chromium, etc.) accumulate as zombies. tini reaps them.
    // Evidence: 514 zombies on EC2 (31 Oct), parents were sleep infinity.
    '--init',
    '--memory', HUNT_MEMORY,
    '--cpus', HUNT_CPUS,
    '--network', network,
    '--restart', 'no',
    // P2: IPv6 disabled inside egress-controlled hunt containers (the
    // iptables design is IPv4; v6 would be an unenforced side channel).
    ...(opts.egressProxy ? ['--sysctl', 'net.ipv6.conf.all.disable_ipv6=1'] : []),
    // P2: pin the container resolver (see dnsIp doc above).
    ...(opts.dnsIp ? ['--dns', opts.dnsIp] : []),
    '-p', `127.0.0.1:${TTYD_PORT}:${TTYD_PORT}`,
    ...(zoneinfo ? ['-v', `${zoneinfo}:/usr/share/zoneinfo:ro`] : []),
    ...env,
    HUNT_IMAGE,
  ];
}

/**
 * Read the P1 immutable scope for a hunt (if any). Hunts created before P1
 * carry no scopeGuard — they keep the legacy path and are never touched
 * by P2 egress.
 */
async function readEgressScope(huntId, impl) {
  try {
    const readMeta = impl.readMeta || ((await import('./store.js')).readHuntMeta);
    const meta = readMeta(huntId) || {};
    const s = meta.scopeGuard;
    if (s && s.version === 1) return { scope: s, meta };
  } catch { /* a failed read proves nothing — legacy path */ }
  return { scope: null, meta: {} };
}

/** Exact-host check for the explicitly configured lab egress bypass. */
export function isLabLoopbackTarget(target) {
  try {
    const raw = String(target || '').trim();
    if (!raw) return false;
    const url = new URL(raw.includes('://') ? raw : `https://${raw}`);
    const host = url.hostname.toLowerCase().replace(/^\\[|\\]$/g, '').replace(/\\.$/, '');
    return host === 'localhost' || host === '127.0.0.1' || host === '172.17.0.1';
  } catch {
    return false;
  }
}

export async function spawnHuntContainer(huntId, target, opts = {}) {
  // _impl seam (tests only): { docker, readMeta, writeMeta } — same
  // pattern as ensureHuntContainer/execInHuntContainerWithRespawn.
  const impl = opts._impl || {};
  const run = impl.docker || docker;
  const name = containerName(huntId);
  // Clean up any stale container with the same name first — and WAIT
  // until the name is actually free. A bare `rm -f` is not enough:
  // when the previous backend's shutdown rm raced the boot respawn,
  // the container sat in "removal in progress" — rm -f then errors
  // (swallowed here) and the following `docker run` fails with
  // "Conflict: name already in use" or "marked for removal and cannot
  // be started". That failed the running Infomaniak hunt on 2 of 3
  // backend restarts on 24 Oct. Bounded wait (5 x 2s) + a run retry
  // on those two errors; anything else surfaces immediately.
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function freeName() {
    for (let attempt = 0; attempt < 5; attempt++) {
      try { await run(['rm', '-f', name]); } catch { /* didn't exist, or removal already in progress */ }
      try { await run(['inspect', name]); } catch { return; /* name free */ }
      await sleep(2000);
    }
  }
  await freeName();

  // P2 — network isolation + egress control. Gated on the P1 immutable
  // scope: hunts created before P1 carry no scopeGuard and keep the
  // legacy bridge path untouched. Fail-closed: if egress setup fails,
  // the hunt does NOT start unisolated (opts.noEgress escapes for tests).
  let egress = null;
  // LAB BYPASS 1 Nov 2026: skip network-layer egress for lab targets when
  // EGRESS_SKIP_LAB=1. The application-layer scopeGuard still enforces scope.
  // Network egress is broken on this host (nftables backend lacks xt_set).
  // NEVER use for external targets.
  const isLabTarget = isLabLoopbackTarget(target);
  const skipLabEgress = process.env.EGRESS_SKIP_LAB === '1' && isLabTarget;
  if (skipLabEgress) {
    console.log(`[huntRunner] EGRESS_SKIP_LAB: skipping network egress for lab target ${target} (scopeGuard still active)`);
  }
  if (!opts.noEgress && !skipLabEgress) {
    const { scope } = await readEgressScope(huntId, impl);
    if (scope) {
      const { setupHuntEgress } = await import('./egressControl.js');
      egress = await setupHuntEgress(huntId, scope, {
        docker: run,
        startProxy: true,
      });
      egress.scope = scope;
    }
  }

  // Rule #78 — port-collision retry. The per-hunt ttyd port is
  // hash-derived over a 100-port range, so it CAN collide with a live
  // hunt's container port (seen live 30 Oct: 17745 = Juice Shop
  // container). Walk the candidates: the persisted port first (a
  // respawn keeps the terminal proxy's port stable), then the primary,
  // then primary+1/+2... bounded. Each failed port advances to the
  // next; the name-conflict retry keeps its old behaviour per port.
  let storedPort = null;
  try {
    const readMeta = impl.readMeta || ((await import('./store.js')).readHuntMeta);
    storedPort = (readMeta(huntId) || {}).ttydPort;
  } catch { /* a failed read proves nothing — candidates still apply */ }

  // HUNTER-MIND timing fix: the zoneinfo mount is guarded — a mount
  // of a nonexistent host path would create an empty dir on the host.
  const zoneinfoPath = existsSync(HUNT_ZONEINFO_PATH) ? HUNT_ZONEINFO_PATH : null;
  const candidates = ttydPortCandidates(huntId, storedPort);
  let lastError = null;
  for (const port of candidates) {
    const runArgs = buildHuntContainerRunArgs(huntId, target, {
      ...opts,
      zoneinfoPath,
      ttydPort: port,
      network: egress ? egress.netName : undefined,
      egressProxy: egress ? { gatewayIp: egress.gatewayIp, proxyPort: egress.proxyPort } : null,
      dnsIp: egress ? egress.resolverIp : undefined,
    });
    let retriedName = false;
    for (;;) {
      try {
        await run(runArgs);
        // P2: with the container up, inspect its IP and apply the
        // iptables/ipset egress plan. Fail-closed: a failure here
        // destroys the just-started container rather than leaving it
        // unisolated.
        if (egress) {
          try {
            const { finalizeHuntEgress } = await import('./egressControl.js');
            await finalizeHuntEgress(huntId, name, egress, { docker: run });
          } catch (egressErr) {
            try { await run(['rm', '-f', name]); } catch { /* ignore */ }
            try {
              const { stopProxyForHunt } = await import('./egressControl.js');
              await stopProxyForHunt(huntId);
            } catch { /* ignore */ }
            throw new Error(`egress setup failed (fail-closed): ${egressErr.message || egressErr}`);
          }
        }
        // Persist the RESOLVED port in the hunt meta (merge, never
        // wholesale — the 21 Oct pause checkpoint-race rule): the
        // terminal WS proxy dials it via resolveTtydPort. A persist
        // failure is logged loudly but never fails the spawn — the
        // container is real and running; the terminal proxy falls back
        // to the primary hash port for this hunt.
        try {
          const writeMeta = impl.writeMeta || ((await import('./store.js')).writeHuntMetaCheckpoint);
          writeMeta(huntId, { ttydPort: port });
        } catch (persistErr) {
          console.error(`[spawn] hunt ${huntId}: container up on ttyd port ${port} but meta persist failed:`, persistErr.message || persistErr);
        }
        return { container: name, spawnedAt: new Date().toISOString(), ttydPort: String(port) };
      } catch (err) {
        const msg = String((err && err.message) || err);
        // Last-resort retry: if the name was STILL reserved at run time
        // (removal completed between freeName's last check and the run),
        // free it once more and run again on the SAME port. A second
        // name failure propagates, exactly like the old code.
        if (/already in use|marked for removal/i.test(msg) && !retriedName) {
          retriedName = true;
          await freeName();
          continue;
        }
        // Port taken by another container: next candidate port.
        if (isPortAllocatedError(msg)) {
          lastError = err;
          break;
        }
        throw err; // fail-closed: unknown errors surface immediately
      }
    }
  }
  // Every candidate collided: the box has a bigger problem (100-port
  // range exhausted) — fail loudly with the last docker error.
  throw lastError || new Error('no free ttyd port in range');
}

/**
 * Get new log lines from a hunt container since last check.
 * The container emits JSON lines: {type, ...event}
 */
export async function huntContainerLogs(huntId, since = '') {
  const name = containerName(huntId);
  const args = ['logs', '--tail', '200'];
  if (since) args.push('--since', since);
  args.push(name);
  try {
    const { stdout } = await execFileAsync('docker', args, { timeout: DOCKER_TIMEOUT_MS });
    return String(stdout || '').split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

/** Is the hunt container still running? */
export async function huntContainerRunning(huntId) {
  const name = containerName(huntId);
  try {
    const out = await docker(['inspect', '-f', '{{.State.Running}}', name]);
    return out.trim() === 'true';
  } catch {
    return false;
  }
}

/**
 * Destroy a hunt container (idempotent). Also removes P2 egress state
 * (iptables/ipset/proxy/network) — best-effort, never breaks the teardown
 * itself. Returns true when `docker rm -f` removed the container.
 *
 * EGRESS-TEARDOWN LEAK (6 Nov 2026, h_fc3861b36b82): the old code did
 * `docker rm -f` and returned false on ANY failure — BEFORE the egress
 * block. `rm -f` exits non-zero when the container is already gone,
 * so a hunt whose container vanished by any other path (manual removal,
 * docker prune, a second teardown racing the first) leaked its chain +
 * ipsets + network forever; and scanner hunts that finished BEFORE the
 * 6 Nov container-cleanup lane (e52c98c2) never called teardown at all.
 * The container and the kernel state are INDEPENDENT cleanups: a failed
 * rm must never gate the egress removal.
 *
 * Safety on the ambiguous rm failure: if `rm -f` fails for a reason
 * OTHER than "no such container", the container may still be alive —
 * removing its egress filter while it runs would leave a live container
 * unfiltered. So an ambiguous failure asks `docker inspect`: the
 * container exists → skip the egress removal (a later teardown /
 * reconciler tick retries once it is really gone); inspect says "no
 * such container" → the container is gone, remove the egress state;
 * inspect itself fails ambiguously (daemon down) → skip (fail-closed).
 * Only the proven-gone case proceeds. `deps` is a test seam only
 * (production callers pass nothing): deps.docker replaces the docker
 * runner, deps.readMeta / deps.stopProxy / deps.removeEgress replace the
 * dynamic imports, so tests never run live docker/iptables.
 */
export async function teardownHuntContainer(huntId, deps = {}) {
  const name = containerName(huntId);
  const runDocker = deps.docker || docker;
  let removed = false;
  let containerGone = false;
  try {
    await runDocker(['rm', '-f', name]);
    removed = true;
    containerGone = true;
  } catch (err) {
    if (/no such container/i.test(String((err && err.message) || err))) {
      containerGone = true;
    } else {
      // Ambiguous rm failure — is the container still there?
      try {
        await runDocker(['inspect', name]);
        containerGone = false; // exists: keep its egress filter
      } catch (inspectErr) {
        containerGone = /no such container/i.test(String((inspectErr && inspectErr.message) || inspectErr));
      }
    }
  }
  // P2 egress cleanup — runs whenever the container is proven gone,
  // whether or not `rm -f` did the removal. meta.egress is deliberately
  // NOT a gate here: it is a record, not ground truth — hunts whose
  // meta lost the egress block (or never had one, e.g. the 1 Nov
  // finalize failures) still leak a docker network, and the removal
  // plan derives every name from the huntId alone, so it can only ever
  // touch THIS hunt's state. removeHuntEgress is best-effort and
  // idempotent: for a hunt that never had kernel state every command
  // simply fails silently.
  if (containerGone) {
    try {
      const readMeta =
        deps.readMeta || (await import('./store.js')).readHuntMeta;
      const meta = readMeta(huntId) || {};
      const stopProxy =
        deps.stopProxy || (await import('./egressControl.js')).stopProxyForHunt;
      const removeEgress =
        deps.removeEgress || (await import('./egressControl.js')).removeHuntEgress;
      await stopProxy(huntId).catch(() => {});
      await removeEgress(huntId, {
        containerIps: meta.egress ? meta.egress.containerIps : undefined,
        resolverIp: meta.egress ? meta.egress.resolverIp : undefined,
      }).catch(() => {});
    } catch { /* best-effort only */ }
  }
  return removed;
}

/**
 * Is a hunt's driver live in this process (or another process holding a
 * fresh driver.lock)? Fail-closed: any doubt reads as live, so the
 * reconciler below skips the hunt instead of risking a live hunt's
 * egress state. Dynamic imports keep huntRunner free of a top-level
 * cycle (huntAgent.js and scannerHunt.js both import this module).
 */
async function isHuntLive(huntId) {
  try {
    const { isScannerRunActive } = await import('./scannerHunt.js');
    if (isScannerRunActive(huntId)) return true;
  } catch {
    return true;
  }
  try {
    const { isDriverActive } = await import('./huntAgent.js');
    if (isDriverActive(huntId)) return true;
  } catch {
    return true;
  }
  return false;
}

/** Terminal hunt states: a hunt here never runs again (resume 409s). */
export const TERMINAL_HUNT_STATES = new Set(['finished', 'stopped', 'failed']);

/**
 * Reconcile stale egress kernel state (boot + periodic, server.js).
 *
 * EGRESS-TEARDOWN LEAK (6 Nov 2026): h_fc3861b36b82 finished 4 Nov but
 * its chain + both ipsets + network were still live on EC2 days later —
 * the finish path of its day never called teardown at all, and no
 * later pass ever revisited it. This reconciler is that later pass.
 *
 * Safety proof — it CANNOT remove a live hunt's state:
 *  (1) terminal-state gate: only hunts in finished/stopped/failed are
 *      considered. A hunt there never runs again: the resume routes
 *      409 terminal hunts, resumeInterruptedHunt requires a
 *      running/paused hunt, and resumeInterruptedScannerHunt requires
 *      state 'running'. Running and paused hunts are never touched —
 *      a paused hunt's network (e.g. h_7d49c6ef7447) is left alone.
 *  (2) kernel-presence gate: the hunt is torn down ONLY when one of
 *      ITS names (chain / tuple set / ip set / network, derived from
 *      its huntId by the same egress*Name functions the plan builder
 *      uses) actually appears in the live kernel probe. No artifact →
 *      no action, so hunts whose state is already gone cost nothing
 *      and can never be disturbed. Names embed the huntId, so one
 *      hunt's teardown can never match another hunt's state.
 *  (3) live-driver guard: a hunt with a live scanner run or AI driver
 *      in this process (or a fresh driver.lock in another) is skipped,
 *      and any failure to determine liveness reads as live
 *      (isHuntLive fails closed). This covers the mid-transition
 *      window where a finish path has written terminal meta but its
 *      own teardown has not run yet — the finish path's teardown owns
 *      the removal; the reconciler stays out of its way.
 *  (4) the removal itself is teardownHuntContainer — the same
 *      idempotent path the finish/stop routes already call, now fixed
 *      so a missing container cannot gate the egress removal.
 * A hunt with live kernel state but NO meta (deleted data dir) is out
 * of scope: meta is the source of truth for hunt identity, and
 * removing kernel state for an id with no hunt record would be
 * guessing. Such a case needs a one-time manual removal (see the lane
 * report's commands), not an automated sweep.
 *
 * Returns {checked, reconciled:[huntId], skipped:[{huntId, reason}]}.
 * `opts` carries test seams only (listMetas, listLiveNames, teardown,
 * isLive, recordEvent); production callers pass none.
 */
export async function reconcileStaleEgressState(opts = {}) {
  const listMetas = opts.listMetas || (await import('./store.js')).listHuntMetas;
  const listLiveNames =
    opts.listLiveNames || (await import('./egressControl.js')).listLiveEgressNames;
  const teardown = opts.teardown || teardownHuntContainer;
  const isLive = opts.isLive || isHuntLive;
  const metas = listMetas() || [];
  const live = await listLiveNames().catch(() => ({ chains: new Set(), sets: new Set(), nets: new Set() }));
  const liveChains = live.chains || new Set();
  const liveSets = live.sets || new Set();
  const liveNets = live.nets || new Set();
  const { egressChainName, egressSetName, egressIpSetName, egressNetName } =
    await import('./egressControl.js');
  const reconciled = [];
  const skipped = [];
  for (const meta of metas) {
    if (!meta || !meta.huntId || !TERMINAL_HUNT_STATES.has(meta.state)) continue;
    const hasLiveState =
      liveChains.has(egressChainName(meta.huntId)) ||
      liveSets.has(egressSetName(meta.huntId)) ||
      liveSets.has(egressIpSetName(meta.huntId)) ||
      liveNets.has(egressNetName(meta.huntId));
    if (!hasLiveState) continue;
    let liveDriver = true;
    try {
      liveDriver = await isLive(meta.huntId);
    } catch {
      liveDriver = true;
    }
    if (liveDriver) {
      skipped.push({ huntId: meta.huntId, reason: 'live-driver' });
      continue;
    }
    try {
      await teardown(meta.huntId);
      reconciled.push(meta.huntId);
      try {
        const recordEvent =
          opts.recordEvent ||
          (async (huntId, event) => {
            const { appendHuntEvent } = await import('./store.js');
            appendHuntEvent(huntId, event);
          });
        await recordEvent(meta.huntId, {
          type: 'status',
          state: 'egress_teardown_reconciled',
          message: 'Stale egress kernel state (chain/ipsets/network) removed by the periodic reconciler.',
          at: new Date().toISOString(),
        });
      } catch { /* audit event is best-effort */ }
    } catch (err) {
      skipped.push({ huntId: meta.huntId, reason: `teardown-failed:${err && err.message ? err.message : String(err)}` });
    }
  }
  return { checked: metas.length, reconciled, skipped };
}

/**
 * Copy a host file into the hunt container (solver #459, artifact runs).
 * Creates the destination directory first. Returns { ok } or
 * { ok:false, error } — never throws.
 */
export async function copyFileToHuntContainer(huntId, hostPath, destPath) {
  const name = containerName(huntId);
  const running = await huntContainerRunning(huntId);
  if (!running) return { ok: false, error: 'DM_CONTAINER_MISSING: hunt container not running' };
  try {
    const destDir = destPath.includes('/') ? destPath.slice(0, destPath.lastIndexOf('/')) : '.';
    await execFileAsync('docker', ['exec', name, 'mkdir', '-p', destDir], { timeout: 15000 });
    await docker(['cp', hostPath, `${name}:${destPath}`]);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
}

/**
 * Copy a file OUT of the hunt container to a host path (inverse of
 * copyFileToHuntContainer — e.g. desktop screenshots). Returns { ok } or
 * { ok:false, error } — never throws.
 */
export async function copyFileFromHuntContainer(huntId, containerPath, hostPath) {
  const name = containerName(huntId);
  const running = await huntContainerRunning(huntId);
  if (!running) return { ok: false, error: 'DM_CONTAINER_MISSING: hunt container not running' };
  try {
    await docker(['cp', `${name}:${containerPath}`, hostPath]);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
}

// Live Machine desktop (GUI the agent drives; the owner watches).
//
// The desktop stack (Xvfb + XFCE + Chromium + view-only x11vnc +
// websockify/noVNC) lives in the hunt image and is started ON DEMAND via
// docker/hunt-desktop.sh — never at container boot. v1 transport to the
// frontend is screenshot polling (the owner's original LiveScreenViewer
// design: a fresh frame every ~3s, read-only). The noVNC/websockify
// plumbing inside the container is the documented v2 upgrade path to
// true streaming; its ports are container-loopback only and are NOT
// published by spawnHuntContainer.

const DESKTOP_READY_FILE = '/tmp/dm-desktop.ready';
const DESKTOP_SHOT_PATH = '/tmp/dm-desktop.jpg';
// Negative cache: if the desktop stack is absent (pre-desktop hunt image)
// or the container is gone, don't re-attempt a start on every 3s poll.
const desktopStartFailures = new Map(); // huntId -> timestamp ms
const DESKTOP_RETRY_MS = 30000;

/**
 * Lane Z: shared access to the desktop-start failure cache. guiTools
 * consults the SAME cache before spending a browser action on a
 * restart attempt, so a start that just failed — for the screenshot
 * poller OR for an action — throttles both consumers: one cache, one
 * 30s window, never two starters racing.
 */
export function desktopStartRecentlyFailed(huntId) {
  const last = desktopStartFailures.get(huntId) || 0;
  return last > 0 && Date.now() - last < DESKTOP_RETRY_MS;
}

/** Record a failed desktop start in the shared negative cache. */
export function noteDesktopStartFailure(huntId) {
  desktopStartFailures.set(huntId, Date.now());
}

/** Test hook: forget recorded desktop-start failures. */
export function resetDesktopStartFailures() {
  desktopStartFailures.clear();
}

// One exec answers both questions the starter needs: is the ready
// file there, and is Chromium's CDP endpoint answering? The marker is
// a distinct word (the CDP version JSON never contains "ready").
const DESKTOP_PROBE_CMD = `test -f ${DESKTOP_READY_FILE} && echo DESKTOP_READY; curl -s --max-time 2 http://127.0.0.1:9222/json/version 2>/dev/null | head -c 300`;

/**
 * Parse one combined desktop probe (ready file + CDP) — the pure
 * decision core of the Chromium supervisor, exported for tests.
 * Same CDP marker as guiTools' probeGui (webSocketDebuggerUrl or the
 * "Browser" field of the /json/version document).
 */
export function parseDesktopProbe(stdout) {
  const out = String(stdout || '');
  return {
    ready: out.includes('DESKTOP_READY'),
    cdp: /webSocketDebuggerUrl|"Browser"\s*:/.test(out),
  };
}

// Cold-start wait: a cold Chromium on this loaded box needs seconds
// before CDP answers (Lane AB's ~25s recovery window for the same
// reason). Attempts/interval are injectable through the deps seam so
// tests run instantly.
const START_WAIT_ATTEMPTS = 32;
const START_WAIT_INTERVAL_MS = 750;

function startWaitConfig(deps) {
  const attempts =
    deps && Number.isInteger(deps.startWaitAttempts) && deps.startWaitAttempts > 0
      ? deps.startWaitAttempts
      : START_WAIT_ATTEMPTS;
  const intervalMs =
    deps && Number.isFinite(deps.startWaitIntervalMs) && deps.startWaitIntervalMs >= 0
      ? deps.startWaitIntervalMs
      : START_WAIT_INTERVAL_MS;
  return { attempts, intervalMs };
}

/**
 * Start the hunt machine's GUI desktop inside its container (idempotent).
 *
 * Chromium supervisor (25 Oct 2026): the starter is also the liveness
 * check — it probes the ready file AND Chromium's CDP endpoint, and a
 * desktop whose Chromium died is revived here instead of being trusted
 * on the ready file alone (Chromium died 11:35:11Z while Xvfb and the
 * ready file lived on; the Live Machine showed a black desktop for
 * ~35 min because every consumer trusted the ready file, and Lane Z/AB
 * recovery only fires on browser actions, which were dedup-blocked at
 * the time). The screenshot poller calls this starter every ~3s while
 * the owner watches (GET /:id/desktop.jpg), so a dead Chromium is
 * revived within one poll cycle — no browser action, no new timer, no
 * background loop. The script itself guards against duplicate
 * Chromiums (pgrep check, bracket trick), and a failed revive is
 * throttled by the shared 30s failure cache.
 * @returns {{ok: true, alreadyRunning?: boolean} | {ok: false, error: string}}
 */
export async function startHuntDesktop(huntId, deps = {}) {
  if (desktopStartRecentlyFailed(huntId)) {
    return { ok: false, error: 'desktop_unavailable' };
  }
  const fail = (error) => {
    noteDesktopStartFailure(huntId);
    return { ok: false, error };
  };
  const exec = (deps && deps.exec) || execInHuntContainer;

  let probe = await exec(huntId, DESKTOP_PROBE_CMD, 10000, { bypassTmux: true });
  if (probe.containerMissing) {
    // Lane E self-heal: a RUNNING hunt whose container died (image swap,
    // crash) respawns here too — the owner's live view is a first-class
    // consumer, not a passive victim of the missing container. Hunts in
    // any other state keep the honest container_not_running: the desktop
    // of a paused/stopped hunt is never silently resurrected.
    const meta = await readMetaTargetMode(huntId);
    const healed = meta.state === 'running'
      ? await ensureHuntContainer(huntId, { target: meta.target, mode: meta.mode })
      : { ok: false };
    if (!healed.ok) return fail('container_not_running');
    probe = await exec(huntId, DESKTOP_PROBE_CMD, 10000, { bypassTmux: true });
    if (probe.containerMissing) return fail('container_not_running');
  }
  const state = parseDesktopProbe(probe.stdout);
  if (state.ready && state.cdp) return { ok: true, alreadyRunning: true };
  if (state.ready && !state.cdp) {
    // Chromium died while the desktop is up — log the signature the
    // 11:35Z death never left, then fall through to the script, which
    // relaunches it.
    console.warn(`[desktop] hunt ${huntId}: chromium down (ready file present, CDP 9222 silent) — reviving via hunt-desktop.sh`);
  }

  const started = await exec(
    huntId,
    'nohup /usr/local/bin/hunt-desktop.sh >/tmp/dm-desktop-start.log 2>&1 & echo launched',
    15000,
    { bypassTmux: true },
  );
  if (started.containerMissing) return fail('container_not_running');
  if (started.code === 127 || /no such file/i.test(String(started.stderr || ''))) {
    return fail('desktop_not_installed');
  }

  // Wait for Chromium's CDP endpoint, not just the ready file: the
  // script touches the ready file after launching, but a cold Chromium
  // on this loaded box needs seconds before CDP answers (Lane AB's
  // ~25s recovery window for the same reason). A desktop whose
  // Chromium never answers is reported as a failed start (honest
  // black-screen avoidance) and throttled by the shared cache.
  const { attempts, intervalMs } = startWaitConfig(deps);
  for (let i = 0; i < attempts; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const p = await exec(huntId, DESKTOP_PROBE_CMD, 10000, { bypassTmux: true });
    if (p.containerMissing) return fail('container_not_running');
    if (parseDesktopProbe(p.stdout).cdp) {
      desktopStartFailures.delete(huntId);
      return { ok: true };
    }
  }
  return fail('desktop_start_timeout');
}

// Chromium watchdog interval: 3 minutes. A dead Chromium is rare
// (one silent death sat ~35 min before anyone noticed, 11:35Z), so
// probing every few minutes bounds the unwatched black-screen window
// to ~3 min at the cost of one tiny `docker exec` probe per running
// hunt (the one-hunt order means usually exactly one). Shorter than a
// human turn (10–25 min), so a death is caught well before the
// agent's next browser action would need the browser.
export const CHROMIUM_WATCHDOG_MS = 3 * 60 * 1000;

/** Default hunt list for the watchdog: lazy import on purpose — this
 * module has only node-builtin imports (same reason as
 * readMetaTargetMode). `deps.listMetas` overrides it in tests. */
async function defaultListHuntMetas() {
  const { listHuntMetas } = await import('./store.js');
  return listHuntMetas();
}

/**
 * Chromium watchdog — periodic liveness check for RUNNING hunts.
 *
 * Follow-up to the supervisor (25 Oct 2026): startHuntDesktop revives
 * a dead Chromium, but it only runs when something calls it — the
 * screenshot poller (only while the owner watches the Live Machine)
 * or the agent's browser actions. Since the Live Machine now defaults
 * to collapsed, the poller usually does NOT run, so a dead Chromium
 * could sit dead in the unwatched gap. This check closes that gap: it
 * probes CDP for each running hunt and revives a dead Chromium via
 * the existing starter — it never starts a desktop, never respawns a
 * container, never touches a hunt. Healthy checks stay silent (no log
 * spam every interval); a revival is logged once by the starter
 * itself ("[desktop] hunt <id>: chromium down ... reviving via
 * hunt-desktop.sh"). A failed revive is throttled by the starter's
 * shared 30s cache, so a permanently-dead desktop cannot spin.
 * @returns {{checked: number, healthy: number, revived: number, failed: number, skipped: number}}
 */
export async function checkChromiumWatchdog(deps = {}) {
  const summary = { checked: 0, healthy: 0, revived: 0, failed: 0, skipped: 0 };
  const listMetas = (deps && deps.listMetas) || defaultListHuntMetas;
  const exec = (deps && deps.exec) || execInHuntContainer;
  const startDesktop =
    (deps && deps.startDesktop) || ((huntId) => startHuntDesktop(huntId, deps));

  let metas;
  try {
    metas = await listMetas();
  } catch (err) {
    console.error(`[desktop:watchdog] list failed:`, err.message || err);
    return summary;
  }
  for (const meta of metas || []) {
    if (!meta || meta.state !== 'running' || !meta.huntId) {
      summary.skipped += 1;
      continue;
    }
    const huntId = meta.huntId;
    try {
      if (desktopStartRecentlyFailed(huntId)) {
        summary.skipped += 1;
        continue;
      }
      const probe = await exec(huntId, DESKTOP_PROBE_CMD, 10000, { bypassTmux: true });
      if (probe.containerMissing) {
        // Container gone: Lane E / the hunt loop owns respawn, not the
        // watchdog — it only revives Chromium inside an existing one.
        summary.skipped += 1;
        continue;
      }
      const state = parseDesktopProbe(probe.stdout);
      if (!state.ready) {
        // Desktop never started for this hunt: never create one here.
        summary.skipped += 1;
        continue;
      }
      summary.checked += 1;
      if (state.cdp) {
        summary.healthy += 1;
        continue;
      }
      const res = await startDesktop(huntId);
      if (res.ok) summary.revived += 1;
      else summary.failed += 1;
    } catch (err) {
      console.error(`[desktop:watchdog] ${huntId} check failed:`, err.message || err);
      summary.skipped += 1;
    }
  }
  return summary;
}

/**
 * Capture the hunt desktop's current frame.
 * @returns {{ok: true, buffer: Buffer, contentType: string} | {ok: false, error: string}}
 */
export async function huntDesktopScreenshot(huntId) {
  const start = await startHuntDesktop(huntId);
  if (!start.ok) return { ok: false, error: start.error };

  const shot = await execInHuntContainer(
    huntId,
    `DISPLAY=:99 scrot -o ${DESKTOP_SHOT_PATH} 2>/dev/null && echo captured`,
    15000,
    { bypassTmux: true },
  );
  if (shot.containerMissing) return { ok: false, error: 'container_not_running' };
  if (!String(shot.stdout || '').includes('captured')) {
    return { ok: false, error: 'screenshot_failed' };
  }

  let dir = null;
  try {
    dir = await mkdtemp(join(tmpdir(), 'dm-desktop-'));
    const hostPath = join(dir, 'desktop.jpg');
    const copied = await copyFileFromHuntContainer(huntId, DESKTOP_SHOT_PATH, hostPath);
    if (!copied.ok) return { ok: false, error: copied.error };
    const buffer = await readFile(hostPath);
    if (!buffer.length) return { ok: false, error: 'screenshot_empty' };
    // scrot writes JPEG for a .jpg target on Kali's imlib2 build; if a
    // build ever emits PNG instead, honour the real bytes — browsers key
    // off Content-Type, not the route name.
    const contentType = buffer[0] === 0x89 && buffer[1] === 0x50 ? 'image/png' : 'image/jpeg';
    return { ok: true, buffer, contentType };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Execute a command inside the hunt container.
 * @returns {{stdout: string, stderr: string, code: number}}
 */
export async function execInHuntContainer(huntId, cmd, timeoutMs = 120000, opts = {}) {
  const name = containerName(huntId);

  // FIX #21: Verify container exists before executing.
  // If container is missing (destroyed on pause, crashed, etc.),
  // return a specific error so the caller can respawn it.
  const running = await huntContainerRunning(huntId);
  if (!running) {
    return {
      stdout: '',
      stderr: 'DM_CONTAINER_MISSING: hunt container not running',
      code: 127,
      containerMissing: true,
    };
  }

  // Bulk data fetches (HTML, bundles) can bypass tmux — it truncates to 50 lines.
  // Pass { bypassTmux: true } for commands needing full output.
  if (!opts.bypassTmux) {
    // Try tmux-routed execution first (makes terminal PiP truthful).
    // Falls back to direct exec if tmux isn't available (old image).
    const tmuxResult = await execViaTmux(name, cmd, timeoutMs);
    if (tmuxResult !== null) return tmuxResult;
  }
  
  // Fallback: direct one-shot exec (original behavior)
  try {
    const { stdout, stderr } = await execFileAsync('docker', ['exec', name, 'sh', '-c', cmd], {
      timeout: timeoutMs,
      maxBuffer: 4 * 1024 * 1024,
    });
    return { stdout: String(stdout || ''), stderr: String(stderr || ''), code: 0 };
  } catch (err) {
    return {
      stdout: String(err.stdout || ''),
      stderr: String(err.stderr || err.message),
      code: typeof err.code === 'number' ? err.code : 1,
    };
  }
}

// Container self-heal (Lane E, 21 Oct 2026).
//
// Pipeline mode has always respawned a missing hunt container before
// retrying (huntAgent's execWithRespawn), but every human-mode path —
// the shell executor, humanLoop's raw exec, the GUI tools, and the
// desktop starter — called execInHuntContainer directly, so a container
// removed for an image swap or lost to a crash NEVER came back: the
// loop kept "running" while every action degraded to
// DM_CONTAINER_MISSING. The helpers below are the shared fix: ensure the
// container exists (spawn at most once per outage, even under concurrent
// callers), then retry the exec exactly once. They NEVER throw — a
// failed spawn returns the original container-missing result with the
// spawn error attached, so the brain sees one clear observation.

const containerSpawnsInFlight = new Map(); // huntId -> Promise<ensure result>

/**
 * Read the hunt's target/mode/state from its meta. Lazy import on
 * purpose: this module has only node-builtin imports, and the meta is
 * only needed on the rare respawn path. `impl.readMeta` overrides it in
 * tests. Returns empty strings when the meta cannot be read.
 */
async function readMetaTargetMode(huntId, impl) {
  try {
    if (impl && impl.readMeta) {
      const m = await impl.readMeta(huntId);
      return { target: (m && m.target) || '', mode: (m && m.mode) || '', state: (m && m.state) || '' };
    }
    const { readHuntMeta } = await import('./store.js');
    const meta = readHuntMeta(huntId) || {};
    return { target: meta.target || '', mode: meta.mode || '', state: meta.state || '' };
  } catch {
    return { target: '', mode: '', state: '' };
  }
}

/**
 * Ensure the hunt container exists: spawn it (at most once per outage)
 * when it is missing. NEVER throws.
 * @returns {{ok: true, spawned: boolean, container?: string} |
 *           {ok: false, spawned: false, error: string}}
 *
 * opts: { target, mode } — spawn parameters; when target is absent it
 * is resolved from the hunt meta. opts._impl injects { running, spawn,
 * readMeta } fakes for tests.
 */
export async function ensureHuntContainer(huntId, opts = {}) {
  const impl = opts._impl || {};
  const runningImpl = impl.running || huntContainerRunning;
  const spawnImpl = impl.spawn || spawnHuntContainer;
  try {
    if (await runningImpl(huntId)) return { ok: true, spawned: false };
  } catch { /* a failed probe proves nothing — fall through to spawn */ }

  let flight = containerSpawnsInFlight.get(huntId);
  if (!flight) {
    flight = (async () => {
      try {
        let target = opts.target || '';
        let mode = opts.mode || '';
        if (!target) {
          const meta = await readMetaTargetMode(huntId, impl);
          target = meta.target;
          mode = mode || meta.mode;
        }
        if (!target) return { ok: false, spawned: false, error: 'no_target_for_respawn' };
        const { container } = await spawnImpl(huntId, target, { mode: mode || 'normal' });
        return { ok: true, spawned: true, container };
      } catch (err) {
        return { ok: false, spawned: false, error: String((err && err.message) || err) };
      }
    })();
    containerSpawnsInFlight.set(huntId, flight);
    flight.then(() => {
      if (containerSpawnsInFlight.get(huntId) === flight) containerSpawnsInFlight.delete(huntId);
    }, () => {});
  }
  return flight;
}

/**
 * execInHuntContainer + self-heal: when the exec reports the container
 * missing, ensure it (spawn once) and retry the command exactly once.
 * The retried result carries `respawned: true` when a spawn happened.
 * When the spawn fails, the ORIGINAL container-missing result is
 * returned with `respawnFailed: true` and the spawn error appended to
 * stderr — one clear observation for the brain, never a throw.
 * opts: everything execInHuntContainer takes, plus { target, mode,
 * _impl } for the respawn.
 */
export async function execInHuntContainerWithRespawn(huntId, cmd, timeoutMs = 120000, opts = {}) {
  const impl = opts._impl || {};
  const execImpl = impl.exec || execInHuntContainer;
  const first = await execImpl(huntId, cmd, timeoutMs, opts);
  if (!first || !first.containerMissing) return first;
  const ensured = await ensureHuntContainer(huntId, { target: opts.target, mode: opts.mode, _impl: impl });
  if (!ensured.ok) {
    return {
      ...first,
      respawnFailed: true,
      stderr: `${first.stderr || 'DM_CONTAINER_MISSING: hunt container not running'} (automatic respawn failed: ${ensured.error || 'unknown error'})`,
    };
  }
  const retry = await execImpl(huntId, cmd, timeoutMs, opts);
  return ensured.spawned ? { ...retry, respawned: true } : retry;
}

/**
 * Execute via tmux session (for live terminal streaming).
 * Returns null if tmux is not available (caller falls back to direct exec).
 */
async function execViaTmux(containerName, cmd, timeoutMs) {
  try {
    // Check if tmux session exists
    await execFileAsync('docker', ['exec', containerName, 'tmux', 'has-session', '-t', 'huntshell'], { timeout: 5000 });
  } catch {
    return null; // No tmux — fall back to direct exec
  }
  
  try {
    // Sanitize: limit command length, escape for send-keys -l (literal mode)
    const safeCmd = String(cmd).slice(0, 2000);
    // Wrap with exit code sentinel
    const wrapped = `{ ${safeCmd}; echo "DM_EXIT:$?"; }`;
    
    // Send command to tmux session (literal mode = no shell interpretation of keys)
    await execFileAsync('docker', ['exec', containerName, 'tmux', 'send-keys', '-t', 'huntshell', '-l', wrapped], { timeout: 10000 });
    await execFileAsync('docker', ['exec', containerName, 'tmux', 'send-keys', '-t', 'huntshell', 'Enter'], { timeout: 10000 });
    
    // Poll for completion sentinel
    const startTime = Date.now();
    const pollInterval = 500;
    while (Date.now() - startTime < timeoutMs) {
      await new Promise((r) => setTimeout(r, pollInterval));
      try {
        const { stdout } = await execFileAsync('docker', ['exec', containerName, 'tmux', 'capture-pane', '-p', '-t', 'huntshell'], { timeout: 10000 });
        const pane = String(stdout || '');
        const match = /DM_EXIT:(\d+)/.exec(pane);
        if (match) {
          const code = parseInt(match[1], 10);
          // Extract output between command and sentinel (best-effort)
          // For now, return the pane tail as stdout
          const lines = pane.split('\n');
          const sentinelIdx = lines.findIndex((l) => l.includes('DM_EXIT:'));
          const output = lines.slice(Math.max(0, sentinelIdx - 50), sentinelIdx).join('\n');
          // Clear the sentinel so next command doesn't match stale output
          await execFileAsync('docker', ['exec', containerName, 'tmux', 'send-keys', '-t', 'huntshell', '-l', 'clear; '], { timeout: 5000 }).catch(() => {});
          return { stdout: output, stderr: '', code };
        }
      } catch { /* poll again */ }
    }
    
    // Timeout: interrupt and return partial
    try {
      await execFileAsync('docker', ['exec', containerName, 'tmux', 'send-keys', '-t', 'huntshell', 'C-c'], { timeout: 5000 });
    } catch { /* ignore */ }
    return { stdout: '', stderr: 'Command timed out in tmux session', code: 124 };
  } catch (err) {
    return null; // tmux failed — fall back to direct exec
  }
}

/** Sweep: destroy containers older than the hunt timeout. */
export async function sweepStaleHuntContainers() {
  try {
    const out = await docker(['ps', '-a', '--filter', 'name=dm-hunt-', '--format', '{{.Names}}\t{{.CreatedAt}}']);
    const now = Date.now();
    let swept = 0;
    for (const line of out.split('\n').filter(Boolean)) {
      const [name, ...rest] = line.split('\t');
      const created = new Date(rest.join(' ').split(' ').slice(0, 5).join(' ')).getTime();
      if (now - created > HUNT_TIMEOUT_MS) {
        try { await docker(['rm', '-f', name]); swept++; } catch { /* ignore */ }
      }
    }
    return swept;
  } catch {
    return 0;
  }
}
