/**
 * memoryController.js — Local memory export/import API.
 *
 *  GET  /api/v1/memory/stats              → { dir, hunts, fileCount, totalMB }
 *  GET  /api/v1/memory/export             → downloads darkmatter-memory-<date>.zip
 *  GET  /api/v1/memory/jobs/:jobId/export → downloads one hunt's memory ZIP
 *  POST /api/v1/memory/import             → upload ZIP, restores memory
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { memoryStats } from '../engines/localMemory.js';
import { exportMemoryZip, importMemoryZip } from '../engines/memoryTransfer.js';
import { FileMemory } from '../agent/memory/fileMemory.js';

export async function stats(req, res) {
  try {
    res.json({ ok: true, memory: memoryStats() });
  } catch (err) {
    res.status(500).json({ error: { code: 'MEMORY_STATS_FAILED', message: err.message } });
  }
}

export async function exportZip(req, res) {
  try {
    const { path: zipPath, format } = await exportMemoryZip();
    const filename = `darkmatter-memory-${new Date().toISOString().slice(0, 10)}.${format === 'tar.gz' ? 'tar.gz' : 'zip'}`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', format === 'tar.gz' ? 'application/gzip' : 'application/zip');
    const stream = fs.createReadStream(zipPath);
    stream.pipe(res);
    stream.on('close', () => {
      try {
        fs.unlinkSync(zipPath);
      } catch {
        /* temp cleanup */
      }
    });
  } catch (err) {
    res.status(500).json({ error: { code: 'MEMORY_EXPORT_FAILED', message: err.message } });
  }
}

export async function importZip(req, res) {
  try {
    // Accept a raw ZIP body (Content-Type: application/zip) — no multer needed.
    // The frontend sends the file bytes directly.
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buf = Buffer.concat(chunks);
    if (!buf.length) {
      return res.status(400).json({
        error: { code: 'EMPTY_UPLOAD', message: 'Upload a memory ZIP file.' },
      });
    }
    // Basic ZIP magic check.
    if (buf[0] !== 0x50 || buf[1] !== 0x4b) {
      return res.status(400).json({
        error: { code: 'NOT_A_ZIP', message: 'That file is not a ZIP archive.' },
      });
    }
    const tmp = path.join(os.tmpdir(), `dm-memory-import-${Date.now()}.zip`);
    fs.writeFileSync(tmp, buf);
    try {
      const result = await importMemoryZip(tmp);
      res.json({ ok: true, ...result });
    } finally {
      try {
        fs.unlinkSync(tmp);
      } catch {
        /* ignore */
      }
    }
  } catch (err) {
    res.status(500).json({ error: { code: 'MEMORY_IMPORT_FAILED', message: err.message } });
  }
}

/** GET /api/v1/memory/jobs/:jobId/export — one hunt's isolated memory as ZIP. */
export async function exportHuntZip(req, res) {
  try {
    const userId = req.user?.id || 'anonymous';
    const jobId = req.params.jobId;
    const mem = new FileMemory();
    const dir = mem.memoryDirFor(userId, jobId);
    if (!fs.existsSync(dir)) {
      return res.status(404).json({
        error: { code: 'NO_MEMORY', message: 'This hunt has no saved memory yet.' },
      });
    }
    const out = path.join(
      os.tmpdir(),
      `darkmatter-hunt-${String(jobId).replace(/[^a-zA-Z0-9_-]/g, '_')}.zip`
    );
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execFileAsync = promisify(execFile);
    await execFileAsync('zip', ['-r', '-q', out, '.'], { cwd: dir, timeout: 60000 });
    res.setHeader('Content-Disposition', `attachment; filename="hunt-memory-${jobId}.zip"`);
    res.setHeader('Content-Type', 'application/zip');
    const stream = fs.createReadStream(out);
    stream.pipe(res);
    stream.on('close', () => {
      try {
        fs.unlinkSync(out);
      } catch {
        /* ignore */
      }
    });
  } catch (err) {
    res.status(500).json({ error: { code: 'HUNT_EXPORT_FAILED', message: err.message } });
  }
}

export const memoryController = { stats, exportZip, importZip, exportHuntZip };
export default memoryController;
