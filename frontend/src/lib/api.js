// ============================================================================
// Dark Matter frontend — API client for the v1 backend contract.
// Auth: Bearer token from localStorage (`dm_token`) is attached to every
// request when present. Every call degrades gracefully when the backend
// is unreachable; callers receive { ok:false, error } and show honest toasts.
// ============================================================================
import { resolveApiBase } from '../config';

const TOKEN_KEY = 'dm_token';

export function getAuthToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setAuthToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* storage unavailable */ }
}

export function clearAuthToken() {
  setAuthToken('');
}

function apiUrl(path) {
  return `${resolveApiBase()}${path}`;
}

async function parseJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function request(method, path, body) {
  try {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const token = getAuthToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(apiUrl(path), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await parseJsonSafe(res);
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        // Prefer the human-readable message (e.g. the real Razorpay error)
        // over the machine code so users see WHY something failed.
        error: (data && (data.message || data.error)) || `Request failed (${res.status})`,
      };
    }
    return { ok: true, status: res.status, data };
  } catch (err) {
    return { ok: false, error: 'Backend unreachable. Check Settings → backend connection.' };
  }
}

const get = (path) => request('GET', path);
const post = (path, body) => request('POST', path, body);
const put = (path, body) => request('PUT', path, body);
const del = (path) => request('DELETE', path);

// --- Auth (invite-only, username based) --------------------------------------
export async function login(username, password) {
  return post('/api/v1/auth/login', { username, password });
}

export async function signup(username, password) {
  return post('/api/v1/auth/signup', { username, password });
}

export async function me() {
  return get('/api/v1/auth/me');
}

// --- Health ----------------------------------------------------------------
export async function health() {
  return get('/api/v1/health');
}

// --- Chat ------------------------------------------------------------------
export async function sendChat(message, huntId) {
  const res = await post('/api/v1/chat', { message, ...(huntId ? { huntId } : {}) });
  if (!res.ok) return res;
  const reply = (res.data && (res.data.reply || res.data.message)) || '';
  return { ok: true, data: { reply } };
}

// --- Chat title sync (renames follow the account across devices) -----------
export async function getChatTitles() {
  return get('/api/v1/chats');
}

export async function getChatTombstones() {
  return get('/api/v1/chats/tombstones');
}

export async function syncChatTitles(chats, deleted) {
  return post('/api/v1/chats/sync', { chats, deleted });
}

// --- Chat message sync (full history follows the account across devices) ---
export async function getChatMessages(chatId) {
  return get(`/api/v1/chats/${encodeURIComponent(chatId)}/messages`);
}

export async function saveChatMessages(chatId, messages) {
  return post(`/api/v1/chats/${encodeURIComponent(chatId)}/messages`, {
    messages,
    updatedAt: new Date().toISOString(),
  });
}

// --- Billing / top-up ---------------------------------------------------------
export async function billingStatus() {
  return get('/api/v1/billing/status');
}

export async function createTopupOrder(amountUsd) {
  return post('/api/v1/billing/order', { amountUsd });
}

export async function verifyTopup(orderId, paymentId, signature) {
  return post('/api/v1/billing/verify', { orderId, paymentId, signature });
}

// --- Hunts -----------------------------------------------------------------
/** The user's hunts from the backend (survives browser close — re-attach). */
export async function listHunts() {
  return get('/api/v1/hunts');
}

/** Cached agent activity (thinking, tool calls, findings) for a hunt. */
export async function getHuntEvents(huntId, limit = 200) {
  return get(`/api/v1/hunts/${encodeURIComponent(huntId)}/events?limit=${limit}`);
}

export async function getHuntCost(huntId) {
  return get(`/api/v1/hunts/${encodeURIComponent(huntId)}/cost`);
}

export async function getTotalCosts() {
  return get('/api/v1/hunts/costs');
}

export async function startHunt(target, scope, mode, confirmedAuthorized) {
  const res = await post('/api/v1/hunts', { target, scope, mode, confirmedAuthorized: !!confirmedAuthorized });
  if (!res.ok) return res;
  return { ok: true, data: { huntId: res.data && (res.data.huntId || res.data.id) } };
}

export async function pauseHunt(id) {
  return post(`/api/v1/hunts/${encodeURIComponent(id)}/pause`);
}

export async function resumeHunt(id) {
  return post(`/api/v1/hunts/${encodeURIComponent(id)}/resume`);
}

export async function stopHunt(id) {
  return post(`/api/v1/hunts/${encodeURIComponent(id)}/stop`);
}

export function reportPdfUrl(id) {
  return apiUrl(`/api/v1/hunts/${encodeURIComponent(id)}/report?format=pdf`);
}

export async function fetchReportMarkdown(id) {
  const res = await get(`/api/v1/hunts/${encodeURIComponent(id)}/report?format=md`);
  if (!res.ok) return res;
  const md =
    typeof res.data === 'string'
      ? res.data
      : (res.data && (res.data.markdown || res.data.report || res.data.md)) || '';
  return { ok: true, data: { markdown: md } };
}

// --- Plugins / providers -----------------------------------------------------
export async function listProviders() {
  return get('/api/v1/plugins/providers');
}

export async function saveProvider(id, payload) {
  return put(`/api/v1/plugins/providers/${encodeURIComponent(id)}`, payload);
}

// --- Admin portal ------------------------------------------------------------
export async function listAdminUsers() {
  return get('/api/v1/admin/users');
}

export async function approveAdminUser(userId) {
  return post(`/api/v1/admin/users/${userId}/approve`, {});
}

export async function rejectAdminUser(userId) {
  return post(`/api/v1/admin/users/${userId}/reject`, {});
}

export async function listAdminHunts() {
  return get('/api/v1/admin/hunts');
}

export async function createAdminUser({ username, password, control }) {
  return post('/api/v1/admin/users', { username, password, control });
}

export async function updateAdminUser(id, { control }) {
  return put(`/api/v1/admin/users/${encodeURIComponent(id)}`, { control });
}

export async function deleteAdminUser(id) {
  return del(`/api/v1/admin/users/${encodeURIComponent(id)}`);
}

export async function blockAdminUser(id, { durationHours, permanent }) {
  return post(`/api/v1/admin/users/${encodeURIComponent(id)}/block`, { durationHours, permanent });
}

export async function unblockAdminUser(id) {
  return post(`/api/v1/admin/users/${encodeURIComponent(id)}/unblock`, {});
}

export async function changeUserPassword(id, password) {
  return post(`/api/v1/admin/users/${encodeURIComponent(id)}/password`, { password });
}

// --- Downloadable models -----------------------------------------------------
export async function listModels() {
  return get('/api/v1/models');
}

export async function downloadModel(modelId) {
  return post('/api/v1/models/download', { modelId });
}

export async function getDownloadJob(jobId) {
  return get(`/api/v1/models/downloads/${encodeURIComponent(jobId)}`);
}

// --- Voice -------------------------------------------------------------------
export async function stt(audioBlob) {
  try {
    const form = new FormData();
    form.append('audio', audioBlob, 'recording.webm');
    const res = await fetch(apiUrl('/api/v1/voice/stt'), { method: 'POST', body: form });
    const data = await parseJsonSafe(res);
    if (!res.ok) {
      return { ok: false, error: (data && (data.error || data.message)) || `Voice service failed (${res.status})` };
    }
    return { ok: true, data: { text: (data && (data.text || data.transcript)) || '' } };
  } catch {
    return { ok: false, error: 'Voice service unreachable. Check Settings → backend connection.' };
  }
}

export async function tts(text, voice) {
  try {
    const res = await fetch(apiUrl('/api/v1/voice/tts'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice }),
    });
    if (!res.ok) {
      const data = await parseJsonSafe(res);
      return { ok: false, error: (data && (data.error || data.message)) || `Voice service failed (${res.status})` };
    }
    const blob = await res.blob();
    return { ok: true, data: { blob, url: URL.createObjectURL(blob) } };
  } catch {
    return { ok: false, error: 'Voice service unreachable. Check Settings → backend connection.' };
  }
}

// --- Hunt live stream ----------------------------------------------------------
// Real WS endpoint: WS /api/v1/hunts/:id/stream
// Events: { type: 'thinking'|'tool_call'|'finding'|'status'|'done', ...payload }
// Client usage lives in lib/huntStream.js (HuntStreamClient).
export function huntStreamWsUrl(huntId) {
  return `${resolveApiBase().replace(/^http/, 'ws')}/api/v1/hunts/${encodeURIComponent(huntId)}/stream`;
}
