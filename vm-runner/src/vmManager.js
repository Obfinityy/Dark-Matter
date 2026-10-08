/**
 * VM lifecycle manager for the Infinity AI VM Runner.
 *
 * One VM's identity is a directory:
 *   <vmHome>/sessions/<sessionId>/
 *     session.json     — pid, ports, token, target, state
 *     overlay.qcow2    — per-session disk, golden Kali image as backing file
 *     serial.log       — QEMU serial output (boot diagnostics)
 *     memory/          — per-session agent memory (see memory.js)
 *
 * The QEMU process IS the VM; there is no monitor thread. The runner can
 * restart and re-attach via the pid file + the proof-of-possession handshake
 * against the guest agent. A retried start never wipes an existing disk.
 */
import { spawn, execFile } from 'node:child_process';
import { mkdir, readFile, writeFile, chmod } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { buildQemuArgs, assertQemuSafePath } from './qemu.js';
import { GuestClient } from './guestClient.js';
import { generateToken } from './token.js';

const execFileAsync = promisify(execFile);

export const SESSION_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
export const BOOT_TIMEOUT_MS = Number.parseInt(process.env.INFINITY_VM_RUNNER_BOOT_TIMEOUT_MS || '240000', 10);
const GUEST_PORT_BASE = 14100;
const VNC_PORT_BASE = 15900;

/** Default VM home: %USERPROFILE%\DarkMatter\vm on Windows. */
export function resolveVmHome() {
  if (process.env.INFINITY_VM_RUNNER_HOME) return process.env.INFINITY_VM_RUNNER_HOME;
  if (os.platform() === 'win32') {
    const profile = process.env.USERPROFILE || os.homedir();
    return path.join(profile, 'DarkMatter', 'vm');
  }
  return path.join(os.homedir(), '.local', 'share', 'infinity-vm-runner', 'vm');
}

export function validateSessionId(sessionId) {
  if (typeof sessionId !== 'string' || !SESSION_ID_RE.test(sessionId)) {
    throw new Error('sessionId must be 1-64 chars of [A-Za-z0-9_-]');
  }
  return sessionId;
}

export function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function isPortFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.listen(port, '127.0.0.1', () => srv.close(() => resolve(true)));
  });
}

async function findFreePort(base) {
  for (let p = base; p < base + 500; p += 1) {
    // eslint-disable-next-line no-await-in-loop
    if (await isPortFree(p)) return p;
  }
  throw new Error(`no free TCP port found near ${base}`);
}

async function killProcessTree(pid) {
  if (os.platform() === 'win32') {
    try {
      await execFileAsync('taskkill', ['/PID', String(pid), '/T', '/F'], { timeout: 10000 });
    } catch {
      // already gone
    }
    return;
  }
  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    // already gone
  }
}

export class VmManager {
  /**
   * @param {{ vmHome: string, qemuPath: string, accel: string,
   *           getGoldenImagePath: () => Promise<string> }} opts
   */
  constructor({ vmHome, qemuPath, accel, getGoldenImagePath }) {
    if (!vmHome) throw new Error('VmManager requires vmHome');
    this.vmHome = vmHome;
    this.qemuPath = qemuPath;
    this.accel = accel;
    this.getGoldenImagePath = getGoldenImagePath;
    /** sessionId -> ChildProcess for VMs started by this process */
    this.children = new Map();
  }

  sessionDir(sessionId) {
    return path.join(this.vmHome, 'sessions', validateSessionId(sessionId));
  }

  sessionFile(sessionId) {
    return path.join(this.sessionDir(sessionId), 'session.json');
  }

  async getSession(sessionId) {
    try {
      return JSON.parse(await readFile(this.sessionFile(sessionId), 'utf8'));
    } catch {
      return null;
    }
  }

  async writeSession(record) {
    const file = this.sessionFile(record.sessionId);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(record, null, 2), 'utf8');
    if (os.platform() !== 'win32') {
      try {
        await chmod(file, 0o600);
      } catch {
        // best effort
      }
    }
  }

  guestClientFor(record, timeoutMs) {
    return new GuestClient({
      port: record.guestPort,
      token: record.sessionToken,
      timeoutMs: timeoutMs ?? 8000,
    });
  }

  qemuImgPath() {
    if (!this.qemuPath) return null;
    const dir = path.dirname(this.qemuPath);
    const exe = os.platform() === 'win32' ? 'qemu-img.exe' : 'qemu-img';
    return path.join(dir, exe);
  }

  async allocatePorts() {
    const guestPort = await findFreePort(GUEST_PORT_BASE);
    let vncPort = await findFreePort(VNC_PORT_BASE);
    if (vncPort < 5900 || vncPort > 5999) {
      // VNC displays only span 5900-5999; scan that range explicitly.
      vncPort = null;
      for (let p = 5900; p <= 5999; p += 1) {
        // eslint-disable-next-line no-await-in-loop
        if (await isPortFree(p)) {
          vncPort = p;
          break;
        }
      }
      if (!vncPort) throw new Error('no free VNC port in range 5900-5999');
    }
    return { guestPort, vncPort };
  }

  /**
   * Start (or re-attach to) a session VM. Returns immediately with
   * state 'booting'; the guest handshake completes in the background and
   * GET /vm/status reports 'running' once the guest agent answers.
   */
  async start({ sessionId, cpus = 2, memoryMiB = 2048, diskBytes, target = null }) {
    validateSessionId(sessionId);
    if (!this.qemuPath) {
      const err = new Error('qemu_missing: QEMU is not installed — see GET /doctor');
      err.code = 'qemu_missing';
      throw err;
    }
    if (!this.accel) {
      const err = new Error('no hardware accelerator (WHPX/KVM) available — see GET /doctor');
      err.code = 'no_accel';
      throw err;
    }
    const dir = this.sessionDir(sessionId);
    assertQemuSafePath(dir, 'session directory');

    // Idempotent re-attach: a live session for this id is returned as-is.
    const existing = await this.getSession(sessionId);
    if (existing && pidAlive(existing.pid)) {
      const ok = await this.guestClientFor(existing, 3000)
        .proofHandshake()
        .catch(() => false);
      if (ok) {
        return {
          pid: existing.pid,
          guestPort: existing.guestPort,
          vncPort: existing.vncPort,
          state: existing.state === 'running' ? 'running' : 'booting',
          sessionToken: existing.sessionToken,
          reattached: true,
        };
      }
    }

    await mkdir(dir, { recursive: true });
    const goldenImagePath = await this.getGoldenImagePath();
    assertQemuSafePath(goldenImagePath, 'golden image path');
    const overlayPath = path.join(dir, 'overlay.qcow2');
    const serialLogPath = path.join(dir, 'serial.log');

    // Create the per-session overlay (golden image as backing file).
    // A retried start reuses the existing overlay — never wipes it.
    if (!(await this.fileExists(overlayPath))) {
      await this.createOverlay(goldenImagePath, overlayPath);
      if (diskBytes !== undefined && diskBytes !== null) {
        await this.resizeOverlay(overlayPath, diskBytes);
      }
    }

    const sessionToken = generateToken();
    const { guestPort, vncPort } = await this.allocatePorts();
    const args = buildQemuArgs({
      accel: this.accel,
      sessionId,
      sessionDir: dir,
      goldenImagePath,
      overlayPath,
      cpus: Math.max(1, Math.min(16, Number(cpus) || 2)),
      memoryMiB: Math.max(1024, Math.min(32768, Number(memoryMiB) || 2048)),
      guestPort,
      vncPort,
      sessionToken,
      serialLogPath,
    });

    const child = spawn(this.qemuPath, args, {
      cwd: dir,
      stdio: 'ignore',
      windowsHide: true,
    });
    this.children.set(sessionId, child);

    const record = {
      sessionId,
      pid: child.pid,
      guestPort,
      vncPort,
      sessionToken,
      target: target || null,
      cpus,
      memoryMiB,
      state: 'booting',
      createdAt: new Date().toISOString(),
      startedAt: Date.now(),
      detail: 'QEMU launched; waiting for the guest agent',
    };
    await this.writeSession(record);

    child.on('exit', async (code, signal) => {
      this.children.delete(sessionId);
      const current = await this.getSession(sessionId);
      // A stop() already marked the record; only unexpected exits flip to error.
      if (current && current.state !== 'stopped' && current.state !== 'stopping') {
        current.state = 'error';
        current.detail = `QEMU exited unexpectedly (code=${code}, signal=${signal}). See serial.log in the session dir.`;
        await this.writeSession(current);
      }
    });
    child.on('error', async (err) => {
      const current = await this.getSession(sessionId);
      if (current && current.state === 'booting') {
        current.state = 'error';
        current.detail = `failed to launch QEMU: ${err.message}`;
        await this.writeSession(current);
      }
    });

    // Background: wait for the guest agent, then mark running.
    this.waitForGuest(record).catch(() => {});
    void record;

    return { pid: child.pid, guestPort, vncPort, state: 'booting', sessionToken };
  }

  async fileExists(p) {
    try {
      await readFile(p);
      return true;
    } catch {
      return false;
    }
  }

  async createOverlay(goldenImagePath, overlayPath) {
    const qemuImg = this.qemuImgPath();
    if (!qemuImg) throw new Error('qemu-img not found next to the QEMU binary');
    try {
      await execFileAsync(
        qemuImg,
        ['create', '-f', 'qcow2', '-b', goldenImagePath, '-F', 'qcow2', overlayPath],
        { timeout: 60000 },
      );
    } catch (err) {
      throw new Error(`failed to create session overlay disk: ${err.message}`);
    }
  }

  /** Grow a fresh overlay to diskBytes (accepts qemu-img size syntax). */
  async resizeOverlay(overlayPath, diskBytes) {
    const size = String(diskBytes).trim();
    if (!/^\d+[KMGTP]?$/i.test(size)) {
      throw new Error(`diskBytes must be a positive integer size like 32212254720 or 30G, got: ${diskBytes}`);
    }
    const qemuImg = this.qemuImgPath();
    if (!qemuImg) throw new Error('qemu-img not found next to the QEMU binary');
    try {
      await execFileAsync(qemuImg, ['resize', overlayPath, size], { timeout: 120000 });
    } catch (err) {
      throw new Error(`failed to resize session overlay disk: ${err.message}`);
    }
  }
  /** Poll the guest agent until it answers (or the boot timeout elapses). */
  async waitForGuest(record) {
    const deadline = Date.now() + BOOT_TIMEOUT_MS;
    const client = this.guestClientFor(record, 5000);
    let lastError = 'guest agent did not answer in time';
    while (Date.now() < deadline) {
      if (!pidAlive(record.pid)) {
        lastError = 'QEMU exited before the guest agent came up';
        break;
      }
      try {
        const proofOk = await client.proofHandshake();
        if (proofOk) {
          const current = (await this.getSession(record.sessionId)) || record;
          if (current.state === 'booting') {
            current.state = 'running';
            current.detail = null;
            current.guestUpAt = new Date().toISOString();
            await this.writeSession(current);
          }
          return;
        }
        lastError = 'guest agent proof handshake failed';
      } catch (err) {
        lastError = err.message;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    const current = (await this.getSession(record.sessionId)) || record;
    if (current.state === 'booting') {
      current.state = 'error';
      current.detail =
        `Guest agent unreachable after ${Math.round(BOOT_TIMEOUT_MS / 1000)}s: ${lastError}. ` +
        'If this is the first boot of the golden image, run vm-runner/provision/install-guestd.sh ' +
        'inside the VM once to install the Infinity guest agent.';
      await this.writeSession(current);
    }
  }

  async status(sessionId) {
    validateSessionId(sessionId);
    const record = await this.getSession(sessionId);
    if (!record) {
      return { state: 'stopped', pid: null, uptimeS: 0, detail: 'no such session' };
    }
    const alive = pidAlive(record.pid);
    if (!alive && record.state !== 'stopped') {
      record.state = record.pid ? 'error' : 'stopped';
      record.detail = record.detail || 'QEMU process is not running';
      await this.writeSession(record);
    }
    if (record.state === 'booting') {
      // Opportunistic: the guest may have come up since the last check.
      const ok = await this.guestClientFor(record, 2500)
        .proofHandshake()
        .catch(() => false);
      if (ok) {
        record.state = 'running';
        record.detail = null;
        await this.writeSession(record);
      }
    }
    return {
      state: alive ? record.state : 'stopped',
      pid: alive ? record.pid : null,
      uptimeS: record.startedAt ? Math.max(0, Math.round((Date.now() - record.startedAt) / 1000)) : 0,
      ...(record.detail ? { detail: record.detail } : {}),
    };
  }

  /**
   * Stop a session: ask the guest to power itself off, then make sure the
   * QEMU process is gone. Idempotent.
   */
  async stop(sessionId) {
    validateSessionId(sessionId);
    const record = await this.getSession(sessionId);
    if (!record) return { ok: true };
    if (record.state === 'stopping' || record.state === 'stopped') return { ok: true };

    record.state = 'stopping';
    await this.writeSession(record);

    try {
      await this.guestClientFor(record, 5000).poweroff();
    } catch {
      // guest agent may already be down — fall through to process kill
    }
    const deadline = Date.now() + 15000;
    while (pidAlive(record.pid) && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 500));
    }
    if (pidAlive(record.pid)) {
      await killProcessTree(record.pid);
    }
    const child = this.children.get(sessionId);
    if (child) {
      child.removeAllListeners('exit');
      this.children.delete(sessionId);
    }
    record.state = 'stopped';
    record.detail = null;
    await this.writeSession(record);
    return { ok: true };
  }
}
