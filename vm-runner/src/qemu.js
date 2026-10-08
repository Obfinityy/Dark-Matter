/**
 * QEMU discovery, accelerator detection and command-line construction
 * for the Infinity AI VM Runner.
 *
 * Supported accelerators: WHPX on Windows, KVM on Linux. Anything else is
 * unsupported (no software emulation — it would be unusably slow).
 *
 * Windows gotchas handled here:
 *  - `-cpu host,-vmx,-svm`: plain `-cpu host` stalls the VM at the first
 *    firmware instructions under WHPX ("WHPX: Unexpected VP exit code 4").
 *  - QEMU on Windows cannot open paths that are non-ASCII or contain commas,
 *    so session directories are validated up front with a clear error.
 */
import { execFile } from 'node:child_process';
import { access, constants } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** Guest agent TCP port inside the VM (forwarded from the host). */
export const GUEST_AGENT_PORT = 1024;

export function detectPlatform() {
  return os.platform(); // 'win32' | 'linux' | 'darwin'
}

function whichCommand(binary, platform) {
  return platform === 'win32'
    ? { cmd: 'where', args: [binary] }
    : { cmd: 'sh', args: ['-c', `command -v ${binary} 2>/dev/null`] };
}

async function onPath(binary, platform) {
  try {
    const { cmd, args } = whichCommand(binary, platform);
    const { stdout } = await execFileAsync(cmd, args, { timeout: 5000 });
    const first = stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0];
    return first || null;
  } catch {
    return null;
  }
}

/**
 * Locate qemu-system-x86_64. Search order:
 *   1. INFINITY_VM_RUNNER_QEMU_DIR env override
 *   2. Official installer directory (Windows: %ProgramFiles%\qemu)
 *   3. Common Unix locations, then PATH
 * Returns the absolute path or null.
 */
export async function findQemuBinary(platform = detectPlatform()) {
  const binaries =
    platform === 'win32' ? ['qemu-system-x86_64.exe', 'qemu-system-x86_64'] : ['qemu-system-x86_64'];
  const dirs = [];
  if (process.env.INFINITY_VM_RUNNER_QEMU_DIR) dirs.push(process.env.INFINITY_VM_RUNNER_QEMU_DIR);
  if (platform === 'win32') {
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    dirs.push(path.join(programFiles, 'qemu'));
  } else {
    dirs.push('/usr/bin', '/usr/local/bin', '/opt/qemu/bin');
  }
  for (const dir of dirs) {
    for (const binary of binaries) {
      const candidate = path.join(dir, binary);
      try {
        await access(candidate, constants.X_OK);
        return candidate;
      } catch {
        // try next
      }
    }
  }
  for (const binary of binaries) {
    const found = await onPath(binary, platform);
    if (found) return found;
  }
  return null;
}

async function fileExists(p) {
  try {
    await access(p, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check whether the Windows Hypervisor Platform is enabled.
 * Returns { enabled: boolean|null, detail: string }.
 * enabled=null means "could not determine" (e.g. not on Windows).
 */
export async function detectWhpx(platform = detectPlatform()) {
  if (platform !== 'win32') {
    return { enabled: null, detail: 'not a Windows host' };
  }
  try {
    const ps =
      'powershell -NoProfile -NonInteractive -Command ' +
      '"(Get-WindowsOptionalFeature -Online -FeatureName HypervisorPlatform).State"';
    const { stdout } = await execFileAsync('cmd.exe', ['/c', ps], { timeout: 15000 });
    const state = stdout.trim().toLowerCase();
    if (state === 'enabled') return { enabled: true, detail: 'HypervisorPlatform feature is enabled' };
    return {
      enabled: false,
      detail:
        'Windows Hypervisor Platform is not enabled. Enable it in "Turn Windows features on or off" ' +
        '(may require administrator rights and a reboot), then restart the VM Runner.',
    };
  } catch (err) {
    return { enabled: null, detail: `could not query WHPX state: ${err.message}` };
  }
}

/** Check KVM availability on Linux via /dev/kvm. */
export async function detectKvm(platform = detectPlatform()) {
  if (platform !== 'linux') return { available: false, detail: 'not a Linux host' };
  const ok = await fileExists('/dev/kvm');
  return ok
    ? { available: true, detail: '/dev/kvm is present' }
    : { available: false, detail: '/dev/kvm not found — enable virtualization in BIOS/UEFI' };
}

/**
 * Pick the hardware accelerator for this host.
 * Returns 'whpx' | 'kvm' | null (null = unsupported host).
 */
export async function detectAccel(platform = detectPlatform()) {
  if (platform === 'win32') {
    const whpx = await detectWhpx(platform);
    return whpx.enabled === false ? null : 'whpx';
  }
  if (platform === 'linux') {
    const kvm = await detectKvm(platform);
    return kvm.available ? 'kvm' : null;
  }
  return null;
}

/**
 * Reject paths QEMU on Windows cannot open: non-ASCII or containing commas.
 * Throws an Error with a remediation hint.
 */
export function assertQemuSafePath(p, label = 'path') {
  if (typeof p !== 'string' || p.length === 0) throw new Error(`${label} must be a non-empty string`);
  if (/[^\x00-\x7F]/.test(p)) {
    throw new Error(
      `${label} contains non-ASCII characters: "${p}". ` +
        'QEMU on Windows cannot open such paths. Set INFINITY_VM_RUNNER_HOME to an ASCII-only directory.',
    );
  }
  if (p.includes(',')) {
    throw new Error(
      `${label} contains a comma: "${p}". ` +
        'QEMU on Windows cannot open paths with commas. Set INFINITY_VM_RUNNER_HOME to a comma-free directory.',
    );
  }
  return p;
}

/** CPU model flag per accelerator. WHPX needs the -vmx,-svm workaround. */
export function cpuFlagForAccel(accel) {
  if (accel === 'whpx') return 'host,-vmx,-svm';
  if (accel === 'kvm') return 'host';
  throw new Error(`unsupported accelerator: ${accel}`);
}

/**
 * Build the full QEMU argument vector for one VM session.
 *
 * Layout: golden Kali image (read-only base) + per-session qcow2 overlay
 * with the golden image as backing file, so a retried start never wipes
 * a disk and every session gets a throwaway sandbox disk.
 */
export function buildQemuArgs({
  accel,
  sessionId,
  sessionDir,
  goldenImagePath,
  overlayPath,
  cpus = 2,
  memoryMiB = 2048,
  guestPort,
  vncPort,
  qmpPort,
  sessionToken,
  serialLogPath,
}) {
  if (!accel) throw new Error('buildQemuArgs: accel is required (whpx|kvm)');
  if (!Number.isInteger(guestPort) || guestPort <= 0) throw new Error('buildQemuArgs: valid guestPort is required');
  if (!Number.isInteger(vncPort) || vncPort <= 0) throw new Error('buildQemuArgs: valid vncPort is required');
  assertQemuSafePath(sessionDir, 'sessionDir');
  assertQemuSafePath(goldenImagePath, 'goldenImagePath');

  const vncDisplay = vncPort - 5900;
  if (!Number.isInteger(vncDisplay) || vncDisplay < 0 || vncDisplay > 99) {
    throw new Error(`buildQemuArgs: vncPort ${vncPort} is out of the VNC range 5900-5999`);
  }

  return [
    '-name',
    `infinity-vm-${sessionId}`,
    '-machine',
    'q35',
    '-accel',
    accel,
    '-cpu',
    cpuFlagForAccel(accel),
    '-smp',
    String(cpus),
    '-m',
    String(memoryMiB),
    '-drive',
    `file=${overlayPath},if=virtio,format=qcow2`,
    '-netdev',
    `user,id=net0,hostfwd=tcp:127.0.0.1:${guestPort}-:${GUEST_AGENT_PORT}`,
    '-device',
    'virtio-net-pci,netdev=net0',
    // The per-session bearer token reaches the guest agent via fw_cfg,
    // so the guest never needs the token baked into a disk image.
    '-fw_cfg',
    `name=opt/infinity/session-token,string=${sessionToken}`,
    // VNC is bound to loopback only; the runner proxies it over an
    // authenticated WebSocket for the noVNC client.
    '-vnc',
    `127.0.0.1:${vncDisplay}`,
    '-serial',
    `file:${serialLogPath}`,
    // QMP monitor for snapshots (savevm/loadvm) and introspection.
    // TCP loopback only (unix sockets are unreliable in QEMU-on-Windows);
    // never exposed off-host. qmpPort is allocated per session.
    ...(Number.isInteger(qmpPort) && qmpPort > 0
      ? ['-qmp', `tcp:127.0.0.1:${qmpPort},server=on,wait=off`]
      : []),
  ];
}
