/**
 * setup.js — first-time provisioning for the Infinity AI Runner.
 *
 * The owner requirement: the user never touches a terminal, folders, or
 * manual downloads. So the Runner itself provisions what the Kali sandbox
 * needs, driven by the vm-runner's /doctor report:
 *
 *   1. QEMU (Windows) — installed silently via winget (built into Win 10/11).
 *      If winget is unavailable/fails, we report a manual download link.
 *   2. Windows Hypervisor Platform — needs admin + reboot; we offer a
 *      one-click elevated enable (Windows shows the UAC prompt).
 *   3. Kali golden image (~3 GB) — downloaded from cdimage.kali.org with
 *      progress, SHA256-verified against the descriptor, 7z-extracted into
 *      the vm-runner's image dir. Only starts on explicit user consent
 *      (button shows the download size).
 *
 * This module is Electron-agnostic (inject spawn/fetch) and unit-tested.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const RUNNER_BASE = 'http://127.0.0.1:4100';
const QEMU_WINGET_ID = 'SoftwareFreedomConservancy.QEMU';
const QEMU_MANUAL_URL = 'https://www.qemu.org/download/#windows';

/** Load the Kali image descriptor shipped with vm-runner. */
function loadKaliDescriptor(resourcesDir) {
  const p = path.join(resourcesDir, 'vm-runner', 'images', 'kali.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

async function getDoctor(fetchImpl = fetch) {
  const res = await fetchImpl(`${RUNNER_BASE}/doctor`);
  if (!res.ok) throw new Error(`doctor failed: ${res.status}`);
  return res.json();
}

/**
 * Ensure QEMU is installed (Windows). Returns
 * { ok: true } | { ok: false, reason, manualUrl? }.
 */
async function ensureQemu({ fetchImpl = fetch, spawnImpl = null, platform = process.platform, onProgress = () => {} } = {}) {
  const doctor = await getDoctor(fetchImpl);
  if (doctor.qemuPath) return { ok: true, qemuPath: doctor.qemuPath };
  if (platform !== 'win32' || !spawnImpl) {
    return { ok: false, reason: 'QEMU is not installed.', manualUrl: QEMU_MANUAL_URL };
  }
  onProgress({ step: 'qemu', status: 'installing', detail: 'Installing QEMU (one-time)…' });
  try {
    await spawnImpl('winget', [
      'install', '-e', '--id', QEMU_WINGET_ID,
      '--silent', '--accept-package-agreements', '--accept-source-agreements',
    ]);
  } catch (err) {
    return { ok: false, reason: `Automatic QEMU install failed: ${err.message}`, manualUrl: QEMU_MANUAL_URL };
  }
  const again = await getDoctor(fetchImpl);
  if (again.qemuPath) {
    onProgress({ step: 'qemu', status: 'done', detail: 'QEMU installed.' });
    return { ok: true, qemuPath: again.qemuPath };
  }
  return { ok: false, reason: 'QEMU installed but not found — restart the Runner and try again.', manualUrl: QEMU_MANUAL_URL };
}

/** Elevated command (argv) that enables WHPX. Run with admin rights. */
function whpxEnableArgv() {
  // PowerShell relaunches DISM elevated; Windows shows the UAC prompt.
  return {
    command: 'powershell.exe',
    args: [
      '-NoProfile', '-Command',
      `Start-Process dism -ArgumentList '/online','/enable-feature','/featurename:HypervisorPlatform','/all','/norestart' -Verb RunAs -Wait`,
    ],
  };
}

/**
 * Download the Kali golden image with progress, verify SHA256, extract the
 * inner .qcow2 into <vmHome>/images/. Resolves { ok: true, bytes }.
 * onProgress receives { step: 'kali', status, percent?, detail? }.
 */
async function ensureKaliImage({
  fetchImpl = fetch,
  resourcesDir,
  sevenZipPath,
  spawnImpl = null,
  onProgress = () => {},
} = {}) {
  const doctor = await getDoctor(fetchImpl);
  if (doctor.kaliImage?.present) return { ok: true, alreadyPresent: true };

  const kali = loadKaliDescriptor(resourcesDir);
  const imagesDir = path.join(doctor.vmHome, 'images');
  fs.mkdirSync(imagesDir, { recursive: true });
  const archivePath = path.join(imagesDir, kali.fileName);
  const finalPath = path.join(imagesDir, kali.innerImage);

  // ── download ──
  onProgress({ step: 'kali', status: 'downloading', percent: 0, detail: `Downloading Kali Linux (~3 GB)…` });
  const res = await fetchImpl(kali.url);
  if (!res.ok || !res.body) throw new Error(`Kali download failed (HTTP ${res.status}).`);
  const total = Number(res.headers.get('content-length')) || 0;
  const hash = crypto.createHash('sha256');
  const out = fs.createWriteStream(archivePath);
  let received = 0;
  await new Promise((resolve, reject) => {
    res.body.on('data', (chunk) => {
      received += chunk.length;
      hash.update(chunk);
      if (total) {
        const percent = Math.min(99, Math.round((received / total) * 100));
        if (percent % 5 === 0 || percent === 99) {
          onProgress({ step: 'kali', status: 'downloading', percent, detail: `Downloading Kali Linux… ${percent}%` });
        }
      }
      if (!out.write(chunk)) res.body.pause();
    });
    out.on('drain', () => res.body.resume());
    res.body.on('end', () => out.end(resolve));
    res.body.on('error', (err) => { out.destroy(); reject(err); });
    out.on('error', reject);
  });

  // ── verify ──
  onProgress({ step: 'kali', status: 'verifying', detail: 'Verifying download…' });
  const digest = hash.digest('hex');
  if (digest !== kali.sha256.toLowerCase()) {
    fs.rmSync(archivePath, { force: true });
    throw new Error('Kali download failed verification (SHA256 mismatch). Please try again.');
  }

  // ── extract ──
  if (!sevenZipPath || !spawnImpl) {
    throw new Error('Extractor unavailable — cannot unpack the Kali image.');
  }
  if (process.platform !== 'win32') {
    try { fs.chmodSync(sevenZipPath, 0o755); } catch { /* best effort */ }
  }
  onProgress({ step: 'kali', status: 'extracting', detail: 'Extracting Kali image (one-time)…' });
  await spawnImpl(sevenZipPath, ['x', archivePath, `-o${imagesDir}`, kali.innerImage, '-y']);
  if (!fs.existsSync(finalPath)) {
    throw new Error('Extraction finished but the Kali image was not found.');
  }
  fs.rmSync(archivePath, { force: true });
  onProgress({ step: 'kali', status: 'done', percent: 100, detail: 'Kali image ready.' });
  return { ok: true, bytes: fs.statSync(finalPath).size };
}

/**
 * Full readiness snapshot for the status window:
 * [{ id: 'qemu'|'whpx'|'kali', label, status: 'ready'|'missing'|'action-needed', detail }]
 * plus flags for which actions the UI should offer.
 */
async function readiness({ fetchImpl = fetch } = {}) {
  const doctor = await getDoctor(fetchImpl);
  const problems = doctor.problems || [];
  const has = (re) => problems.some((p) => re.test(p));
  return {
    doctor,
    steps: [
      {
        id: 'qemu',
        label: 'QEMU virtualization',
        status: doctor.qemuPath ? 'ready' : 'missing',
        detail: doctor.qemuPath || 'Not installed',
      },
      {
        id: 'whpx',
        label: 'Hardware acceleration (WHPX)',
        status: doctor.accel ? 'ready' : 'action-needed',
        detail: doctor.accel ? doctor.accel : 'Needs enabling in Windows (one click, then reboot)',
      },
      {
        id: 'kali',
        label: 'Kali Linux image (~3 GB, one-time)',
        status: doctor.kaliImage?.present ? 'ready' : 'missing',
        detail: doctor.kaliImage?.present
          ? `${(doctor.kaliImage.bytes / 1e9).toFixed(1)} GB ready`
          : 'Not downloaded yet',
      },
    ],
    rawProblems: problems,
    qemuMissing: !doctor.qemuPath,
    whpxMissing: !doctor.accel,
    kaliMissing: !doctor.kaliImage?.present,
  };
}

module.exports = {
  ensureQemu,
  ensureKaliImage,
  whpxEnableArgv,
  readiness,
  getDoctor,
  loadKaliDescriptor,
  QEMU_MANUAL_URL,
};
