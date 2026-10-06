/**
 * modelDownload.js — frontend-only model downloads (no backend needed).
 *
 * Downloads GGUF files DIRECTLY from Hugging Face with progress reporting
 * (0%, 1%, 2%...) and cancel support. Files are saved via the browser's
 * download mechanism.
 */

const activeDownloads = new Map(); // modelId -> { controller, cancelled }

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
 * @param {object} model - Model from MODEL_CATALOG (needs hfRepo, hfFile, id)
 * @param {object} callbacks - { onProgress(percent, receivedBytes, totalBytes), onDone(), onError(err), onCancel() }
 * @returns {function} cancel function
 */
export async function downloadModelDirect(model, callbacks = {}) {
  const { onProgress, onDone, onError, onCancel } = callbacks;
  const url = getHuggingFaceUrl(model);
  const controller = new AbortController();

  const downloadState = { controller, cancelled: false };
  activeDownloads.set(model.id, downloadState);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Download failed: HTTP ${response.status}`);
    }

    const totalBytes = parseInt(response.headers.get('content-length') || '0', 10);
    const reader = response.body.getReader();
    const chunks = [];
    let receivedBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      receivedBytes += value.length;
      if (onProgress && totalBytes > 0) {
        const percent = Math.min(100, Math.round((receivedBytes / totalBytes) * 100));
        onProgress(percent, receivedBytes, totalBytes);
      } else if (onProgress) {
        onProgress(0, receivedBytes, totalBytes);
      }
    }

    // Assemble and trigger browser download
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
    if (onDone) onDone();
  } catch (err) {
    activeDownloads.delete(model.id);
    if (err.name === 'AbortError' || downloadState.cancelled) {
      if (onCancel) onCancel();
    } else if (onError) {
      onError(err);
    }
  }
}

/**
 * Cancel an in-progress download.
 */
export function cancelDownload(modelId) {
  const dl = activeDownloads.get(modelId);
  if (dl) {
    dl.cancelled = true;
    try { dl.controller.abort(); } catch { /* ignore */ }
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
