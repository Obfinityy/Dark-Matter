/**
 * memoryTransfer.js — Export/import memory as ZIP for device switching.
 *
 * User flow:
 *  1. Settings → Memory → "Export" → downloads darkmatter-memory-<date>.zip
 *  2. On new device: Settings → Memory → "Import" → upload ZIP
 *  3. All hunts, learnings, preferences restored.
 *
 * Uses system `zip`/`unzip` (present on Windows via PowerShell, macOS, Linux).
 * Falls back to `tar` if zip is unavailable.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { memoryDir } from './localMemory.js';

const execFileAsync = promisify(execFile);

async function hasCommand(cmd) {
  try {
    await execFileAsync(cmd, ['--version'], { timeout: 5000 });
    return true;
  } catch {
    try {
      // Windows: `where` instead of `--version`
      await execFileAsync(process.platform === 'win32' ? 'where' : 'which', [cmd], { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Export memory dir to a ZIP file. Returns { path, sizeBytes }.
 */
export async function exportMemoryZip(destPath = null) {
  const src = memoryDir();
  if (!fs.existsSync(src)) {
    throw new Error('No local memory to export yet. Run a hunt first.');
  }
  const out = destPath || path.join(os.tmpdir(), `darkmatter-memory-${new Date().toISOString().slice(0, 10)}.zip`);

  if (await hasCommand('zip')) {
    // zip -r out.zip .  (run inside memory dir)
    await execFileAsync('zip', ['-r', '-q', out, '.'], { cwd: src, timeout: 120000 });
  } else {
    // Fallback: tar.gz (rename to .zip won't work — use .tar.gz extension)
    const tarOut = out.replace(/\.zip$/, '.tar.gz');
    await execFileAsync('tar', ['-czf', tarOut, '-C', src, '.'], { timeout: 120000 });
    return { path: tarOut, sizeBytes: fs.statSync(tarOut).size, format: 'tar.gz' };
  }

  return { path: out, sizeBytes: fs.statSync(out).size, format: 'zip' };
}

/**
 * Import memory from a ZIP file. Merges (does not delete existing).
 * Returns { importedFiles, dir }.
 */
export async function importMemoryZip(zipPath) {
  if (!fs.existsSync(zipPath)) throw new Error('ZIP file not found.');
  const dest = memoryDir();
  fs.mkdirSync(dest, { recursive: true });

  const isTar = zipPath.endsWith('.tar.gz') || zipPath.endsWith('.tgz');
  if (isTar) {
    await execFileAsync('tar', ['-xzf', zipPath, '-C', dest], { timeout: 120000 });
  } else if (await hasCommand('unzip')) {
    await execFileAsync('unzip', ['-o', '-q', zipPath, '-d', dest], { timeout: 120000 });
  } else {
    throw new Error('Neither unzip nor tar is available to import memory.');
  }

  // Count imported files.
  let count = 0;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else count++;
    }
  };
  walk(dest);
  return { importedFiles: count, dir: dest };
}

export const MEMORY_TRANSFER = { exportMemoryZip, importMemoryZip };
export default MEMORY_TRANSFER;
