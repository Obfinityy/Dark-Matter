/**
 * managedBinaries.js — download-on-demand integration of mature open-source
 * security tools from their official GitHub releases.
 *
 * Why: the hunt tool registry references best-in-class tools (nuclei,
 * subfinder, katana) but they only worked when pre-installed on a Kali box.
 * This manager fetches the official single-binary release for the user's OS
 * on first use — the same pattern as the Infinity AI Runner — so hunts get
 * real vulnerability verification ("the hands") without any manual setup.
 *
 * Product UI never shows upstream project names (rebranded as Infinity
 * capabilities); attribution + licenses live in THIRD_PARTY_NOTICES.md.
 *
 * Layout: ~/.darkmatter/tools/<name>/<binary>
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { downloadFile } from '../services/modelRunner/downloadUtil.js';

const execFileAsync = promisify(execFile);

/**
 * Managed tool catalog. `version` is pinned for reproducibility; `asset`
 * builds the exact release-asset filename for a platform.
 * `binary` is the executable name inside the downloaded archive.
 */
export const MANAGED_TOOLS = {
  nuclei: {
    repo: 'projectdiscovery/nuclei',
    version: 'v3.11.1',
    // asset filenames strip the leading "v": nuclei_3.11.1_linux_amd64.zip
    asset: (p) => `nuclei_${p.versionNoV}_${p.os}_${p.arch}.zip`,
    binary: (p) => (p.os === 'windows' ? 'nuclei.exe' : 'nuclei'),
    displayName: 'Infinity Scanner',
    description: 'Template-based vulnerability scanner (10k+ checks)',
  },
  subfinder: {
    repo: 'projectdiscovery/subfinder',
    version: 'v2.17.0',
    asset: (p) => `subfinder_${p.versionNoV}_${p.os}_${p.arch}.zip`,
    binary: (p) => (p.os === 'windows' ? 'subfinder.exe' : 'subfinder'),
    displayName: 'Infinity Recon',
    description: 'Passive subdomain enumeration from 30+ sources',
  },
  katana: {
    repo: 'projectdiscovery/katana',
    version: 'v1.8.0',
    asset: (p) => `katana_${p.versionNoV}_${p.os}_${p.arch}.zip`,
    binary: (p) => (p.os === 'windows' ? 'katana.exe' : 'katana'),
    displayName: 'Infinity Crawler',
    description: 'JS-aware web crawler for endpoint discovery',
  },
};

/** Map Node's platform/arch to ProjectDiscovery release naming. */
export function releasePlatform(platform = process.platform, arch = process.arch) {
  const os = platform === 'win32' ? 'windows'
    : platform === 'darwin' ? 'macOS'
    : platform === 'linux' ? 'linux' : null;
  const a = arch === 'x64' ? 'amd64'
    : arch === 'arm64' ? 'arm64' : null;
  if (!os || !a) {
    throw new Error(`Unsupported platform for managed tools: ${platform}/${arch}`);
  }
  return { os, arch: a };
}

export function toolsDir() {
  return path.join(os.homedir(), '.darkmatter', 'tools');
}

export function toolDir(name) {
  return path.join(toolsDir(), name);
}

/** Full HTTPS URL of the release asset for a tool + platform. */
export function assetUrl(name, platform = process.platform, arch = process.arch) {
  const spec = MANAGED_TOOLS[name];
  if (!spec) throw new Error(`Unknown managed tool: ${name}`);
  const p = { ...releasePlatform(platform, arch), versionNoV: spec.version.replace(/^v/, '') };
  return `https://github.com/${spec.repo}/releases/download/${spec.version}/${spec.asset(p)}`;
}

/** Expected on-disk path of the extracted binary. */
export function binaryPath(name, platform = process.platform, arch = process.arch) {
  const spec = MANAGED_TOOLS[name];
  if (!spec) throw new Error(`Unknown managed tool: ${name}`);
  const p = releasePlatform(platform, arch);
  return path.join(toolDir(name), spec.binary(p));
}

export function isInstalled(name) {
  try {
    const p = binaryPath(name);
    fs.accessSync(p, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function extractZip(zipPath, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  if (process.platform === 'win32') {
    // PowerShell is always present on modern Windows.
    await execFileAsync('powershell', [
      '-NoProfile', '-NonInteractive', '-Command',
      `Expand-Archive -Force -Path '${zipPath}' -DestinationPath '${destDir}'`,
    ], { timeout: 120000 });
  } else {
    await execFileAsync('unzip', ['-o', '-q', zipPath, '-d', destDir], { timeout: 120000 });
  }
}

// Dedupe concurrent downloads of the same tool.
const inFlight = new Map();

/**
 * Ensure a managed tool's binary exists locally, downloading the official
 * release on first use. Resolves to the executable path.
 */
export async function ensureBinary(name, onProgress = null) {
  if (!MANAGED_TOOLS[name]) throw new Error(`Unknown managed tool: ${name}`);
  const existing = binaryPath(name);
  if (isInstalled(name)) return existing;
  if (inFlight.has(name)) return inFlight.get(name);

  const task = (async () => {
    const dir = toolDir(name);
    fs.mkdirSync(dir, { recursive: true });
    const url = assetUrl(name);
    const zipPath = path.join(dir, `${name}.zip`);
    const report = onProgress || (() => {});
    report({ tool: name, status: 'downloading', progress: 0 });
    await downloadFile(url, zipPath, {
      onProgress: (received, total) =>
        report({ tool: name, status: 'downloading', progress: total ? received / total : 0 }),
    });
    report({ tool: name, status: 'extracting', progress: 1 });
    await extractZip(zipPath, dir);
    try { fs.unlinkSync(zipPath); } catch { /* keep going */ }
    const bin = binaryPath(name);
    if (process.platform !== 'win32') {
      try { fs.chmodSync(bin, 0o755); } catch { /* ignore */ }
    }
    if (!fs.existsSync(bin)) {
      throw new Error(`Archive did not contain the expected binary for ${name}`);
    }
    report({ tool: name, status: 'ready', progress: 1, path: bin });
    return bin;
  })();

  inFlight.set(name, task);
  try {
    return await task;
  } finally {
    inFlight.delete(name);
  }
}

/** Remove a managed tool's local copy (re-download on next use). */
export function uninstall(name) {
  const dir = toolDir(name);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  return { uninstalled: name };
}

/** Status summary for UI / diagnostics. Never auto-downloads. */
export function describeTools() {
  return Object.entries(MANAGED_TOOLS).map(([name, spec]) => ({
    name,
    displayName: spec.displayName,
    description: spec.description,
    version: spec.version,
    installed: isInstalled(name),
    path: isInstalled(name) ? binaryPath(name) : null,
  }));
}
