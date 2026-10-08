/**
 * Infinity AI VM Runner — local service entry point.
 *
 * A standalone Node.js service that runs on the USER's own machine (their
 * Windows box). It is NOT part of the cloud backend: it manages a
 * hardware-accelerated QEMU/Kali sandbox VM per session and exposes the
 * VM control API on 127.0.0.1:4100 only.
 *
 * Security posture:
 *  - Binds 127.0.0.1 exclusively. No host shared folders; the VM uses NAT
 *    networking only, so it can never touch the user's real desktop.
 *  - Every /vm/* endpoint (except POST /vm/start, which issues the token)
 *    requires `Authorization: Bearer <sessionToken>`.
 *  - Shell commands are gated against the session's declared target scope.
 *  - No API keys anywhere.
 */
import express from 'express';
import { statfsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { findQemuBinary, detectAccel, detectWhpx } from './qemu.js';
import { resolveVmHome } from './vmManager.js';

const PKG = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

export const VERSION = PKG.version;
export const PORT = Number.parseInt(process.env.INFINITY_VM_RUNNER_PORT || '4100', 10);
export const BIND_HOST = '127.0.0.1';

export { resolveVmHome };

export async function loadKaliDescriptor() {
  try {
    const raw = await readFile(new URL('../images/kali.json', import.meta.url), 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function goldenImagePath(vmHome, kali) {
  return path.join(vmHome, 'images', kali?.innerImage || 'kali.qcow2');
}

/** { present, bytes, path } for the extracted golden image. */
export async function getKaliImageInfo(vmHome = resolveVmHome()) {
  const kali = await loadKaliDescriptor();
  const imagePath = goldenImagePath(vmHome, kali);
  try {
    const st = await stat(imagePath);
    return { present: true, bytes: st.size, path: imagePath, version: kali?.version || null };
  } catch {
    return { present: false, bytes: 0, path: imagePath, version: kali?.version || null };
  }
}

export function diskFreeBytes(dir) {
  try {
    const s = statfsSync(dir);
    return Number(s.bavail) * Number(s.bsize);
  } catch {
    return null;
  }
}

/**
 * Environment diagnostics: QEMU presence, accelerator, WHPX state, golden
 * image, free disk. `problems` is a list of human-readable blockers.
 */
export async function buildDoctorReport() {
  const vmHome = resolveVmHome();
  const problems = [];
  const platform = os.platform();

  const [qemuPath, accel, whpx, kaliImage] = await Promise.all([
    findQemuBinary(platform),
    detectAccel(platform),
    detectWhpx(platform),
    getKaliImageInfo(vmHome),
  ]);

  if (!qemuPath) {
    problems.push(
      'QEMU not found. Install QEMU (Windows: the official installer from qemu.org; ' +
        'Linux: your distro qemu-system-x86 package) and restart the runner.',
    );
  }
  if (!accel) {
    problems.push(
      platform === 'win32'
        ? 'No hardware accelerator available. Enable "Windows Hypervisor Platform" in Windows Features ' +
          '(requires administrator rights and a reboot), then restart the runner.'
        : 'No hardware accelerator available. On Linux this means /dev/kvm is missing — ' +
          'enable virtualization (VT-x/AMD-V) in BIOS/UEFI.',
    );
  }
  if (!kaliImage.present) {
    problems.push(
      `Kali golden image missing at ${kaliImage.path}. Download it from the official Kali site, ` +
        'verify the SHA256 (see vm-runner/images/kali.json), extract the .qcow2 there, then retry.',
    );
  }
  try {
    assertVmHomeWritable(vmHome);
  } catch (err) {
    problems.push(err.message);
  }

  return {
    platform,
    vmHome,
    qemuPath: qemuPath || null,
    accel: accel || null,
    whpxEnabled: whpx.enabled,
    whpxDetail: whpx.detail,
    kaliImage: { present: kaliImage.present, bytes: kaliImage.bytes, version: kaliImage.version },
    diskFreeBytes: diskFreeBytes(vmHome),
    problems,
  };
}

function assertVmHomeWritable(vmHome) {
  // QEMU on Windows cannot open non-ASCII or comma-containing paths.
  if (/[^\x00-\x7F]/.test(vmHome)) {
    throw new Error(
      `VM home "${vmHome}" contains non-ASCII characters, which QEMU on Windows cannot open. ` +
        'Set INFINITY_VM_RUNNER_HOME to an ASCII-only directory.',
    );
  }
  if (vmHome.includes(',')) {
    throw new Error(
      `VM home "${vmHome}" contains a comma, which QEMU on Windows cannot open. ` +
        'Set INFINITY_VM_RUNNER_HOME to a comma-free directory.',
    );
  }
}

/** CORS locked to local frontend origins (dev server / packaged app). */
function isAllowedOrigin(origin) {
  if (!origin) return true; // same-origin / non-browser clients
  return (
    /^http:\/\/localhost(:\d+)?$/.test(origin) ||
    /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin) ||
    /\.vercel\.app$/.test(new URL(origin).hostname || '')
  );
}

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && !isAllowedOrigin(origin)) {
      return res.status(403).json({ ok: false, code: 'forbidden_origin', message: 'Origin not allowed' });
    }
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      return res.sendStatus(204);
    }
    next();
  });

  app.get('/health', async (req, res) => {
    const [qemuPath, accel] = await Promise.all([findQemuBinary(), detectAccel()]);
    res.json({ ok: true, version: VERSION, qemu: { found: Boolean(qemuPath), accel: accel || null } });
  });

  app.get('/doctor', async (req, res) => {
    res.json(await buildDoctorReport());
  });

  // VM routes are attached by attachVmRoutes() once the manager exists.
  return app;
}

export function startServer(port = PORT, host = BIND_HOST) {
  const app = createApp();
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => resolve(server));
    server.on('error', reject);
  });
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname;
if (invokedDirectly) {
  const server = await startServer();
  console.log(`Infinity AI VM Runner v${VERSION} listening on ${BIND_HOST}:${PORT}`);
  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
