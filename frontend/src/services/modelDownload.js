/**
 * modelDownload.js — frontend-only model downloads (no backend needed).
 *
 * Downloads GGUF files DIRECTLY from Hugging Face with progress reporting
 * (0%, 1%, 2%...) and cancel support. Large files stream straight to disk
 * via the File System Access API (no in-memory buffering, no OOM). Smaller
 * files fall back to the classic blob-download path.
 */

const activeDownloads = new Map(); // modelId -> { controller, cancelled }

/** Warn when a model exceeds this size — the user should confirm. */
export const LARGE_MODEL_WARN_BYTES = 4 * 1024 * 1024 * 1024; // 4 GiB

/**
 * Build the direct Hugging Face download URL for a model.
 */
export function getHuggingFaceUrl(model) {
  const repo = model.hfRepo;
  const file = model.hfFile;
  return `https://huggingface.co/${repo}/resolve/main/${file}`;
}

/**
 * Download a model directly from Hugging Face.
 *
 * @param {object} model - Model from MODEL_CATALOG (needs hfRepo, hfFile, id, sizeBytes?)
 * @param {object} callbacks - { onProgress(percent, receivedBytes, totalBytes), onDone(path?), onError(err), onCancel(), onSizeWarning(bytes, proceed) }
 * @returns {function} cancel function
 *
 * Large downloads stream to disk via showSaveFilePicker when available so a
 * multi-GB model never sits fully in RAM. The caller gets onSizeWarning for
 * models over LARGE_MODEL_WARN_BYTES and must call proceed() to continue.
 */
export async function downloadModelDirect(model, callbacks = {}) {
  const { onProgress, onDone, onError, onCancel, onSizeWarning } = callbacks;
  const url = getHuggingFaceUrl(model);
  const controller = new AbortController();

  const downloadState = { controller, cancelled: false };
  activeDownloads.set(model.id, downloadState);

  const fail = err => {
    activeDownloads.delete(model.id);
    if (err?.name === 'AbortError' || downloadState.cancelled) {
      if (onCancel) onCancel();
    } else if (onError) {
      onError(err);
    }
  };

  try {
    // Ask where to save BEFORE downloading when the File System Access API
    // is available — the stream then goes straight to disk.
    let fileHandle = null;
    let writable = null;
    const canStreamToDisk =
      typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function';
    if (canStreamToDisk) {
      try {
        fileHandle = await window.showSaveFilePicker({
          suggestedName: model.hfFile,
          types: [
            {
              description: 'Model file (GGUF)',
              accept: { 'application/octet-stream': ['.gguf'] },
            },
          ],
        });
        writable = await fileHandle.createWritable();
      } catch (err) {
        // User cancelled the save dialog — treat as a cancelled download.
        if (err?.name === 'AbortError') {
          activeDownloads.delete(model.id);
          if (onCancel) onCancel();
          return () => {};
        }
        // Fall through to in-memory download below.
        writable = null;
      }
    }

    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      if (writable) await writable.abort().catch(() => {});
      throw new Error(`Download failed: HTTP ${response.status}`);
    }

    const totalBytes = parseInt(response.headers.get('content-length') || '0', 10);
    // Surface a size warning for very large models before streaming bytes.
    if (totalBytes >= LARGE_MODEL_WARN_BYTES && onSizeWarning) {
      const proceed = await onSizeWarning(totalBytes);
      if (!proceed) {
        if (writable) await writable.abort().catch(() => {});
        activeDownloads.delete(model.id);
        if (onCancel) onCancel();
        return () => {};
      }
    }

    const reader = response.body.getReader();
    // In-memory fallback only when streaming to disk is unavailable.
    // Cap the buffered fallback to avoid OOM on huge files.
    const chunks = [];
    let bufferedBytes = 0;
    const MAX_BUFFER_BYTES = 512 * 1024 * 1024; // 512 MiB
    let receivedBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedBytes += value.length;
      if (writable) {
        await writable.write(value);
      } else {
        if (bufferedBytes + value.length > MAX_BUFFER_BYTES) {
          throw new Error(
            'Model is too large to download in-memory in this browser. Use a Chromium-based browser with File System Access support.'
          );
        }
        chunks.push(value);
        bufferedBytes += value.length;
      }
      if (onProgress) {
        if (totalBytes > 0) {
          onProgress(Math.min(100, Math.round((receivedBytes / totalBytes) * 100)), receivedBytes, totalBytes);
        } else {
          onProgress(0, receivedBytes, totalBytes);
        }
      }
    }

    if (writable) {
      await writable.close();
      activeDownloads.delete(model.id);
      if (onDone) onDone(fileHandle?.name || model.hfFile);
    } else {
      // Assemble and trigger browser download (small files only).
      const blob = new Blob(chunks, { type: 'application/octet-stream' });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = model.hfFile;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Keep blob URL briefly for the download to start
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
      activeDownloads.delete(model.id);
      if (onDone) onDone(model.hfFile);
    }
  } catch (err) {
    fail(err);
  }

  return () => cancelDownload(model.id);
}

/**
 * Cancel an in-progress download.
 */
export function cancelDownload(modelId) {
  const dl = activeDownloads.get(modelId);
  if (dl) {
    dl.cancelled = true;
    try {
      dl.controller.abort();
    } catch {
      /* ignore */
    }
    activeDownloads.delete(modelId);
    return true;
  }
  return false;
}

/**
 * Check if a model is currently downloading.
 */
export function isDownloading(modelId) {
  return activeDownloads.has(modelId);
}
