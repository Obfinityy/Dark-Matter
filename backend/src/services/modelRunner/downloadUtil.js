/**
 * downloadUtil.js — resumable HTTPS file download with progress callbacks.
 *
 * Used for both the llama-server engine archive and GGUF model files.
 * Supports resume via the Range header when a partial file already exists.
 */

import fs from 'node:fs';

/**
 * Download url → destPath.
 * @param {object} options
 * @param {Record<string,string>} options.headers
 * @param {(receivedBytes:number, totalBytes:number|null)=>void} options.onProgress
 * @param {AbortSignal} [options.signal]
 * @param {boolean} [options.resume=true]
 * @param {number} [options.stallTimeoutMs=120000] — abort if no bytes arrive for this long
 * @returns {Promise<{ bytes:number, totalBytes:number|null, resumed:boolean }>}
 */
export async function downloadFile(url, destPath, options = {}) {
  const { headers = {}, onProgress = null, signal = null, resume = true, stallTimeoutMs = 120000 } = options;

  let startByte = 0;
  let resumed = false;
  try {
    const stat = fs.statSync(destPath);
    if (resume && stat.size > 0) {
      startByte = stat.size;
      resumed = true;
    }
  } catch { /* no partial file */ }

  const requestHeaders = { ...headers };
  if (startByte > 0) requestHeaders.Range = `bytes=${startByte}-`;

  const response = await fetch(url, { headers: requestHeaders, signal: signal || undefined });
  if (startByte > 0 && response.status === 416) {
    // Already complete.
    const stat = fs.statSync(destPath);
    onProgress?.(stat.size, stat.size);
    return { bytes: stat.size, totalBytes: stat.size, resumed: true };
  }
  if (!response.ok || !response.body) {
    throw new Error(`Download failed: HTTP ${response.status} for ${url}`);
  }

  const isPartial = response.status === 206;
  if (!isPartial && startByte > 0) {
    // Server ignored Range — restart from scratch.
    startByte = 0;
    resumed = false;
  }

  const contentLength = Number(response.headers.get('content-length'));
  const totalBytes = Number.isFinite(contentLength) && contentLength > 0
    ? contentLength + startByte
    : null;

  const fileStream = fs.createWriteStream(destPath, { flags: isPartial ? 'a' : 'w' });
  let receivedBytes = startByte;
  onProgress?.(receivedBytes, totalBytes);

  // Stall watchdog: node's fetch has no default timeout, so a throttled or
  // dead connection would hang forever at 0 bytes. Reset on every chunk.
  let stallTimer = null;
  const resetStallTimer = () => {
    if (stallTimer) clearTimeout(stallTimer);
    stallTimer = setTimeout(() => {
      readerRef.cancel('Download stalled: no data received for ' + Math.round(stallTimeoutMs / 1000) + 's').catch(() => {});
    }, stallTimeoutMs);
    stallTimer.unref?.();
  };
  const readerRef = { cancel: async () => {} };

  try {
    const reader = response.body.getReader();
    readerRef.cancel = (reason) => reader.cancel(reason);
    resetStallTimer();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (signal?.aborted) throw new Error('Download cancelled');
      receivedBytes += value.byteLength;
      resetStallTimer();
      const ok = fileStream.write(value);
      if (!ok) await new Promise((resolve) => fileStream.once('drain', resolve));
      onProgress?.(receivedBytes, totalBytes);
    }
  } finally {
    if (stallTimer) clearTimeout(stallTimer);
    await new Promise((resolve, reject) => {
      fileStream.end((error) => (error ? reject(error) : resolve()));
    });
  }

  return { bytes: receivedBytes, totalBytes, resumed };
}
