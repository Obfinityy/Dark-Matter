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
export async function spawnHuntContainer(huntId, target, opts = {}) {
  const name = containerName(huntId);
  // Clean up any stale container with the same name first
  try { await docker(['rm', '-f', name]); } catch { /* didn't exist */ }

  // Live terminal streaming (PiP): ttyd port on loopback only.
  // FIX: derive a per-hunt port from the hunt ID hash — a fixed port causes
  // "already allocated" failures when multiple hunts (or stale containers)
  // exist. Range 17681-17780 (100 ports).
  let TTYD_PORT = process.env.HUNT_TTYD_PORT;
  if (!TTYD_PORT) {
    let hash = 0;
    for (let i = 0; i < huntId.length; i++) hash = (hash * 31 + huntId.charCodeAt(i)) >>> 0;
    TTYD_PORT = String(17681 + (hash % 100));
  }

  const env = [
    '-e', `DM_HUNT_ID=${huntId}`,
    '-e', `DM_TARGET=${target}`,
    '-e', `DM_MODE=${opts.mode || 'normal'}`,
    '-e', `DM_TTYD_PORT=${TTYD_PORT}`,
    // NOTE: no cloud credentials are passed into hunt containers. The host
    // backend is the sole brain (LLM lives on the host); the container is
    // only hands (tools). This keeps AWS keys out of the sandbox.
  ];

  await docker([
    'run', '-d',
    '--name', name,
    '--memory', HUNT_MEMORY,
    '--cpus', HUNT_CPUS,
    '--network', 'bridge',
    '--restart', 'no',
    '-p', `127.0.0.1:${TTYD_PORT}:${TTYD_PORT}`,
    ...env,
    HUNT_IMAGE,
  ]);

  return { container: name, spawnedAt: new Date().toISOString(), ttydPort: TTYD_PORT };
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

/** Destroy a hunt container (idempotent). */
export async function teardownHuntContainer(huntId) {
  const name = containerName(huntId);
  try {
    await docker(['rm', '-f', name]);
    return true;
  } catch {
    return false;
  }
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

// ---------------------------------------------------------------------------
// Live Machine desktop (GUI the agent drives; the owner watches).
//
// The desktop stack (Xvfb + fluxbox + Chromium + view-only x11vnc +
// websockify/noVNC) lives in the hunt image and is started ON DEMAND via
// docker/hunt-desktop.sh — never at container boot. v1 transport to the
// frontend is screenshot polling (the owner's original LiveScreenViewer
// design: a fresh frame every ~3s, read-only). The noVNC/websockify
// plumbing inside the container is the documented v2 upgrade path to
// true streaming; its ports are container-loopback only and are NOT
// published by spawnHuntContainer.
// ---------------------------------------------------------------------------

const DESKTOP_READY_FILE = '/tmp/dm-desktop.ready';
const DESKTOP_SHOT_PATH = '/tmp/dm-desktop.jpg';
// Negative cache: if the desktop stack is absent (pre-desktop hunt image)
// or the container is gone, don't re-attempt a start on every 3s poll.
const desktopStartFailures = new Map(); // huntId -> timestamp ms
const DESKTOP_RETRY_MS = 30000;

/**
 * Start the hunt machine's GUI desktop inside its container (idempotent).
 * @returns {{ok: true, alreadyRunning?: boolean} | {ok: false, error: string}}
 */
export async function startHuntDesktop(huntId) {
  const lastFail = desktopStartFailures.get(huntId) || 0;
  if (Date.now() - lastFail < DESKTOP_RETRY_MS) {
    return { ok: false, error: 'desktop_unavailable' };
  }
  const fail = (error) => {
    desktopStartFailures.set(huntId, Date.now());
    return { ok: false, error };
  };

  const ready = await execInHuntContainer(
    huntId, `test -f ${DESKTOP_READY_FILE} && echo ready`, 10000, { bypassTmux: true },
  );
  if (ready.containerMissing) return fail('container_not_running');
  if (String(ready.stdout || '').includes('ready')) return { ok: true, alreadyRunning: true };

  const started = await execInHuntContainer(
    huntId,
    'nohup /usr/local/bin/hunt-desktop.sh >/tmp/dm-desktop-start.log 2>&1 & echo launched',
    15000,
    { bypassTmux: true },
  );
  if (started.containerMissing) return fail('container_not_running');
  if (started.code === 127 || /no such file/i.test(String(started.stderr || ''))) {
    return fail('desktop_not_installed');
  }

  // Wait for the start script to signal readiness (it brings up Xvfb,
  // fluxbox, Chromium, x11vnc, websockify — a few seconds on first run).
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 750));
    const probe = await execInHuntContainer(
      huntId, `test -f ${DESKTOP_READY_FILE} && echo ready`, 10000, { bypassTmux: true },
    );
    if (String(probe.stdout || '').includes('ready')) {
      desktopStartFailures.delete(huntId);
      return { ok: true };
    }
  }
  return fail('desktop_start_timeout');
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
