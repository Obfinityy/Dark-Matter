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
import zlib from 'node:zlib';
import { memoryDir } from './localMemory.js';

const execFileAsync = promisify(execFile);

async function hasCommand(cmd) {
  try {
    await execFileAsync(cmd, ['--version'], { timeout: 5000 });
    return true;
  } catch {
    try {
      // Windows: `where` instead of `--version`
      await execFileAsync(process.platform === 'win32' ? 'where' : 'which', [cmd], {
        timeout: 5000,
      });
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
  const out =
    destPath ||
    path.join(os.tmpdir(), `darkmatter-memory-${new Date().toISOString().slice(0, 10)}.zip`);

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
 * List entries in a ZIP file by parsing the central directory (pure JS — no
 * extraction, no new dependencies). Returns [{ name, isSymlink, isDirectory }].
 *
 * The Unix file type lives in the high 16 bits of each entry's external
 * file attributes; S_IFLNK (0120000) marks a symlink.
 */
export function listZipEntries(zipPath) {
  const fd = fs.openSync(zipPath, 'r');
  try {
    const { size } = fs.fstatSync(fd);
    if (size < 22) throw new Error('File too small to be a ZIP archive.');
    // Locate the End of Central Directory record (EOCD, signature 0x06054b50)
    // by scanning backwards from the end (max 64KB comment + 22-byte EOCD).
    const tailSize = Math.min(size, 65557 + 22);
    const tail = Buffer.alloc(tailSize);
    fs.readSync(fd, tail, 0, tailSize, size - tailSize);
    let eocd = -1;
    for (let i = tail.length - 22; i >= 0; i--) {
      if (tail.readUInt32LE(i) === 0x06054b50) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) throw new Error('ZIP end-of-central-directory not found.');
    const cdCount = tail.readUInt16LE(eocd + 10);
    const cdOffset = tail.readUInt32LE(eocd + 16);
    if (cdCount === 0xffff || cdOffset === 0xffffffff) {
      throw new Error('Zip64 archives are not supported for memory import.');
    }
    const entries = [];
    const header = Buffer.alloc(46);
    let pos = cdOffset;
    for (let i = 0; i < cdCount; i++) {
      fs.readSync(fd, header, 0, 46, pos);
      if (header.readUInt32LE(0) !== 0x02014b50) {
        throw new Error('ZIP central directory is corrupt.');
      }
      const nameLen = header.readUInt16LE(28);
      const extraLen = header.readUInt16LE(30);
      const commentLen = header.readUInt16LE(32);
      const externalAttrs = header.readUInt32LE(38);
      const nameBuf = Buffer.alloc(nameLen);
      if (nameLen > 0) fs.readSync(fd, nameBuf, 0, nameLen, pos + 46);
      const name = nameBuf.toString('utf8');
      const unixMode = (externalAttrs >>> 16) & 0xffff;
      const fileType = unixMode & 0o170000;
      entries.push({
        name,
        isSymlink: fileType === 0o120000,
        isDirectory: name.endsWith('/') || fileType === 0o040000,
      });
      pos += 46 + nameLen + extraLen + commentLen;
    }
    return entries;
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * List entries in a .tar.gz file (pure JS via node:zlib — no extraction).
 * Returns [{ name, isSymlink, isDirectory }]. Handles ustar names, ustar
 * prefix, and GNU longname ('L') entries. A PAX 'path=' override, when
 * present, replaces the header name so it is validated too.
 */
export function listTarEntries(tarGzPath) {
  let tar;
  try {
    tar = zlib.gunzipSync(fs.readFileSync(tarGzPath));
  } catch {
    throw new Error('Not a valid gzip archive.');
  }
  const entries = [];
  let offset = 0;
  let longName = null;
  let paxPath = null;
  const readString = (buf, start, len) =>
    buf.subarray(start, start + len).toString('utf8').split('\0')[0];
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every(b => b === 0)) break; // end-of-archive zero blocks
    const typeflag = String.fromCharCode(header[156]);
    const size = parseInt(readString(header, 124, 12).trim() || '0', 8) || 0;
    const dataStart = offset + 512;
    if (typeflag === 'L' || typeflag === 'K') {
      // GNU long name/linkname: the data block holds the real name.
      longName = tar.subarray(dataStart, dataStart + size).toString('utf8').split('\0')[0];
    } else if (typeflag === 'x' || typeflag === 'g') {
      // PAX extended header: look for a path= override.
      const pax = tar.subarray(dataStart, dataStart + size).toString('utf8');
      for (const line of pax.split('\n')) {
        const m = line.match(/^\d+ path=(.*)$/);
        if (m) paxPath = m[1].trim();
      }
    } else {
      let name = longName || readString(header, 0, 100);
      const prefix = readString(header, 345, 155);
      if (!longName && prefix) name = `${prefix}/${name}`;
      if (paxPath) {
        name = paxPath;
        paxPath = null;
      }
      longName = null;
      entries.push({
        name,
        isSymlink: typeflag === '2',
        isDirectory: typeflag === '5',
      });
    }
    offset = dataStart + Math.ceil(size / 512) * 512;
  }
  return entries;
}

/**
 * Zip-Slip defense: every archive entry must be a relative path confined to
 * the destination directory, and symlinks are rejected outright (a symlink
 * to a directory would let later entries write outside the destination
 * during extraction).
 */
export function assertSafeArchiveEntries(entries) {
  for (const entry of entries) {
    const name = String(entry?.name || '');
    if (!name) throw new Error('Archive contains an entry with an empty name.');
    if (
      name.startsWith('/') ||
      name.startsWith('\\') ||
      /^[a-zA-Z]:[\\/]/.test(name) ||
      name.startsWith('\\\\')
    ) {
      throw new Error(`Unsafe archive entry (absolute path): ${name.slice(0, 120)}`);
    }
    const parts = name.split(/[\\/]/);
    if (parts.includes('..')) {
      throw new Error(`Unsafe archive entry (parent traversal): ${name.slice(0, 120)}`);
    }
    if (entry.isSymlink) {
      throw new Error(`Unsafe archive entry (symlink): ${name.slice(0, 120)}`);
    }
  }
}

/**
 * Defense in depth: after extraction, delete any symlink that made it through
 * (e.g. created by an extractor quirk), so a malicious link can never be
 * followed by later reads of the memory directory. Uses lstat (never follows).
 */
function removeSymlinksRecursive(dir) {
  let removed = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    let st;
    try {
      st = fs.lstatSync(p);
    } catch {
      continue;
    }
    if (st.isSymbolicLink()) {
      try {
        fs.unlinkSync(p);
        removed++;
      } catch {
        /* ignore */
      }
    } else if (st.isDirectory()) {
      removed += removeSymlinksRecursive(p);
    }
  }
  return removed;
}

/**
 * Import memory from a ZIP file. Merges (does not delete existing).
 * Returns { importedFiles, dir }.
 *
 * Security: archive entries are validated BEFORE extraction (Zip-Slip
 * defense) and any surviving symlinks are removed afterwards.
 */
export async function importMemoryZip(zipPath) {
  if (!fs.existsSync(zipPath)) throw new Error('ZIP file not found.');
  const dest = memoryDir();
  fs.mkdirSync(dest, { recursive: true });

  const isTar = zipPath.endsWith('.tar.gz') || zipPath.endsWith('.tgz');

  // Validate every entry BEFORE extraction: reject absolute paths, parent
  // traversal, and symlinks (Zip-Slip defense).
  const entries = isTar ? listTarEntries(zipPath) : listZipEntries(zipPath);
  assertSafeArchiveEntries(entries);

  if (isTar) {
    await execFileAsync('tar', ['-xzf', zipPath, '-C', dest], { timeout: 120000 });
  } else if (await hasCommand('unzip')) {
    await execFileAsync('unzip', ['-o', '-q', zipPath, '-d', dest], { timeout: 120000 });
  } else {
    throw new Error('Neither unzip nor tar is available to import memory.');
  }

  // Defense in depth: strip any symlink the extractor may have created.
  removeSymlinksRecursive(dest);

  // Count imported files.
  let count = 0;
  const walk = d => {
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
