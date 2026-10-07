/**
 * localModelApi.js — model operations go to the CONFIGURED backend.
 *
 * Same rule as everything else: VITE_BACKEND_URL from the environment,
 * otherwise http://localhost:4000. Model downloads and runs happen on
 * whichever backend is configured; each model runs on its own random
 * localhost port managed by that backend's model runner.
 */
import { getApiBase } from './backendMode.js';

/** API base of the configured backend. */
function apiBase() {
  return getApiBase();
}

function getAuthHeaders() {
  const jwt = (() => {
    try { return localStorage.getItem('dm_jwt'); } catch { return null; }
  })();
  const headers = { 'Content-Type': 'application/json' };
  if (jwt) headers['Authorization'] = `Bearer ${jwt}`;
  return headers;
}

async function localFetch(path, options = {}) {
  const url = `${apiBase()}${path}`;
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
    const res = await fetch(`${apiBase()}/health`, { method: 'GET' });
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
  const url = `${apiBase()}/model-runner/models/${modelId}/download/progress${jwt ? `?token=${encodeURIComponent(jwt)}` : ''}`;
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
 * Remove a downloaded model from the local backend (frees disk space).
 */
export async function removeModelLocal(modelId) {
  return localFetch(`/local-models/${encodeURIComponent(modelId)}`, { method: 'DELETE' });
}

/**
 * Get local runner status (engine, disk, etc.)
 */
export async function getLocalRunnerStatus() {
  return localFetch('/model-runner/status');
}
