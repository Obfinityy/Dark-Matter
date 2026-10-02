/**
 * memoryController.js — Local memory export/import API.
 *
 *  GET  /api/v1/memory/stats    → { dir, hunts, fileCount, totalMB }
 *  GET  /api/v1/memory/export   → downloads darkmatter-memory-<date>.zip
 *  POST /api/v1/memory/import   → upload ZIP, restores memory
 */

import fs from 'node:fs';
import { memoryStats } from '../engines/localMemory.js';
import { exportMemoryZip, importMemoryZip } from '../engines/memoryTransfer.js';

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
      try { fs.unlinkSync(zipPath); } catch { /* temp cleanup */ }
    });
  } catch (err) {
    res.status(500).json({ error: { code: 'MEMORY_EXPORT_FAILED', message: err.message } });
  }
}

export async function importZip(req, res) {
  try {
    // Expect multipart upload; fall back to raw body.
    // For now: client uploads via FormData 'file'.
    // This is a stub — full multipart parsing needs multer/busboy.
    // TODO: add multer and wire req.file.path here.
    res.status(501).json({
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Import endpoint scaffolded. Upload handling (multer) to be wired.',
      },
    });
  } catch (err) {
    res.status(500).json({ error: { code: 'MEMORY_IMPORT_FAILED', message: err.message } });
  }
}

export const memoryController = { stats, exportZip, importZip };
export default memoryController;
