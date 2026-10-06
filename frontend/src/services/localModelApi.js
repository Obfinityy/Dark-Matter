/**
 * localModelApi.js — Model operations ALWAYS go to the user's LOCAL machine.
 *
 * The user runs the backend on their own computer (http://localhost:4000).
 * Model downloads and runs happen THERE, not on the cloud backend.
 * Each model runs on its own random localhost port.
 *
 * This is separate from the cloud API (auth, hunts, billing) which uses
 * the backend mode (localhost/vercel/cloud).
 */

const LOCAL_BASE = 'http://localhost:4000/api/v1';

function getAuthHeaders() {
  const jwt = (() => {
    try { return localStorage.getItem('dm_jwt'); } catch { return null; }
  })();
  const headers = { 'Content-Type': 'application/json' };
  if (jwt) headers['Authorization'] = `Bearer ${jwt}`;
  return headers;
}

async function localFetch(path, options = {}) {
  const url = `${LOCAL_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...getAuthHeaders(), ...(options.headers || {}) },
    credentials: 'include'
  });
  if (!res.ok) {
    const err = new Error(`Local backend error: HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/**
 * Check if the local backend is running.
 * @returns {Promise<boolean>}
 */
export async function isLocalBackendUp() {
  try {
    const res = await fetch(`${LOCAL_BASE}/health`, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Get the model library from the local backend.
 * (Falls back to frontend catalog if local backend is down.)
 */
export async function getLocalLibrary() {
  return localFetch('/model-runner/library');
}

/**
 * Start downloading a model on the local backend.
 * The backend downloads from Hugging Face and saves to its model directory.
 */
export async function downloadModelLocal(modelId, opts = {}) {
  return localFetch(`/model-runner/models/${modelId}/download`, {
    method: 'POST',
    body: JSON.stringify(opts)
  });
}

/**
 * Subscribe to download progress via SSE from the local backend.
 */
export function subscribeToLocalDownloadProgress(modelId, callbacks = {}) {
  const { onEvent, onError } = callbacks;
  const jwt = (() => {
    try { return localStorage.getItem('dm_jwt'); } catch { return null; }
  })();
  const url = `${LOCAL_BASE}/model-runner/models/${modelId}/download/progress${jwt ? `?token=${encodeURIComponent(jwt)}` : ''}`;
  const es = new EventSource(url);
  es.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (onEvent) onEvent(data);
    } catch (e) {
      if (onError) onError(e);
    }
  };
  es.onerror = (err) => {
    if (onError) onError(err);
  };
  return () => es.close();
}

/**
 * Cancel a download on the local backend.
 */
export async function cancelLocalDownload() {
  return localFetch('/model-runner/download/cancel', { method: 'POST' });
}

/**
 * Run a model for a specific brain slot on the local backend.
 * Each slot gets its own random localhost port.
 *
 * @param {string} slot - 'vision' | 'grounding' | 'hacker'
 * @param {string} modelId
 * @param {object} opts - { quant }
 * @returns {Promise<{port, baseUrl, modelId, slot}>}
 */
export async function runModelOnLocal(slot, modelId, opts = {}) {
  return localFetch(`/model-runner/slots/${slot}/run`, {
    method: 'POST',
    body: JSON.stringify({ modelId, ...opts })
  });
}

/**
 * Stop a model running on a slot.
 */
export async function stopSlotOnLocal(slot) {
  return localFetch(`/model-runner/slots/${slot}/stop`, { method: 'POST' });
}

/**
 * Get all running slot servers from the local backend.
 * @returns {Promise<{vision, grounding, hacker}>} each with {modelId, port, baseUrl} or null
 */
export async function getLocalSlotServers() {
  return localFetch('/model-runner/slots/servers');
}

/**
 * Get local runner status (engine, disk, etc.)
 */
export async function getLocalRunnerStatus() {
  return localFetch('/model-runner/status');
}
