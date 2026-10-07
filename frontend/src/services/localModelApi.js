/**
 * localModelApi.js — model operations go to the CONFIGURED backend.
 *
 * Same rule as everything else: VITE_BACKEND_URL from the environment,
 * otherwise http://localhost:4000. Model downloads and runs happen on
 * whichever backend is configured; each model runs on its own random
 * localhost port managed by that backend's model runner.
 */
import { getApiBase } from './backendMode.js';

/**
 * Local machine backend URL — models ALWAYS run on the user's own computer,
 * regardless of which frontend (local/Vercel/live) is used.
 * VITE_LOCAL_BACKEND_URL can override; defaults to http://localhost:4000.
 */
function localMachineBase() {
  try {
    const url = import.meta.env?.VITE_LOCAL_BACKEND_URL;
    if (url && url.trim()) return url.trim().replace(/\/$/, '');
  } catch { /* ignore */ }
  return 'http://localhost:4000';
}

/** API base of the configured backend (for non-model operations). */
function apiBase() {
  return getApiBase();
}

/** Fetch from the USER'S LOCAL MACHINE (where models run). */
async function localMachineFetch(path, options = {}) {
  const url = `${localMachineBase()}/api/v1${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { ...getAuthHeaders(), ...(options.headers || {}) },
    credentials: 'include'
  });
  if (!res.ok) {
    const err = new Error(`Local machine error: HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
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
 * Start downloading the llama-server engine binary on the LOCAL backend
 * (one-time setup — the engine runs models on the user's machine).
 */
export async function downloadEngineLocal() {
  return localFetch('/model-runner/engine', { method: 'POST' });
}

/**
 * Subscribe to engine download progress via SSE from the local backend.
 */
export function subscribeToLocalEngineStream(callbacks = {}) {
  const { onEvent, onError } = callbacks;
  const jwt = (() => {
    try { return localStorage.getItem('dm_jwt'); } catch { return null; }
  })();
  const url = `${apiBase()}/model-runner/engine/stream${jwt ? `?token=${encodeURIComponent(jwt)}` : ''}`;
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
 * Pause a model download on the local backend (keeps partial file for resume).
 */
export async function pauseDownloadLocal() {
  return localFetch('/model-runner/download/pause', { method: 'POST' });
}

/**
 * Resume a paused model download on the local backend.
 * The backend resumes from the partial file via HTTP Range.
 */
export async function resumeDownloadLocal(modelId, opts = {}) {
  return localFetch(`/model-runner/models/${modelId}/download`, {
    method: 'POST',
    body: JSON.stringify({ ...opts, resume: true })
  });
}

/**
 * Get local runner status (engine, disk, etc.)
 */
export async function getLocalRunnerStatus() {
  return localFetch('/model-runner/status');
}

/**
 * Chat with a local brain (dynamic — the brain generates fresh replies).
 * Goes to the USER'S LOCAL MACHINE — that's where the brains run.
 * @param {string} chatId - unique conversation ID (per-chat memory)
 * @param {string} brain - 'hacker' | 'vision' | 'grounding'
 * @param {string} message - user message
 * @param {object} context - hunt context { target, findingsCount, currentStep }
 */
export async function chatWithBrain(chatId, brain, message, context = {}) {
  return localMachineFetch('/brain-chat', {
    method: 'POST',
    body: JSON.stringify({ chatId, brain, message, context })
  });
}

/**
 * Check which brains are currently running on the user's local machine.
 * @returns {Promise<{ hacker: boolean, vision: boolean, grounding: boolean }>}
 */
export async function getRunningBrains() {
  try {
    const res = await localMachineFetch('/brain-chat/brains');
    return res.brains || { hacker: false, vision: false, grounding: false };
  } catch {
    return { hacker: false, vision: false, grounding: false };
  }
}

/**
 * Load a chat's memory from the user's local machine.
 */
export async function getChatMemory(chatId) {
  return localMachineFetch(`/brain-chat/${encodeURIComponent(chatId)}/memory`);
}
