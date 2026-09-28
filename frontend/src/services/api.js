const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, status = 0, code = 'REQUEST_FAILED') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request(path, options = {}) {
  const headers = {
    Accept: 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {})
  };

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: 'include' });
  } catch {
    throw new ApiError('DarkMatter backend is unavailable. Start the backend on port 4000 and try again.', 0, 'BACKEND_UNAVAILABLE');
  }

  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!response.ok) {
    throw new ApiError(
      body?.error?.message || `Backend request failed with status ${response.status}.`,
      response.status,
      body?.error?.code || 'REQUEST_FAILED'
    );
  }

  return body;
}

function cleanTargetCandidate(value) {
  return String(value || '')
    .trim()
    .replace(/^[([{<]+|[\])}>.,;!?]+$/g, '');
}

export function normalizeTargetUrl(value) {
  const candidate = cleanTargetCandidate(value);
  if (!candidate) return '';
  if (/^https?:\/\//i.test(candidate)) return candidate;
  if (/^\/\//.test(candidate)) return `https:${candidate}`;
  return `https://${candidate}`;
}

export function extractTargetUrl(value) {
  const candidate = String(value || '').match(/(?:https?:\/\/|www\.)[^\s<>()]+|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:\/[^\s<>()]*)?/i)?.[0];
  return normalizeTargetUrl(candidate);
}

export function getCurrentUser() {
  return request('/auth/me');
}

export function registerAccount(payload) {
  return request('/auth/register', { method: 'POST', body: JSON.stringify(payload) });
}

export function loginAccount(payload) {
  return request('/auth/login', { method: 'POST', body: JSON.stringify(payload) });
}

export function logoutAccount() {
  return request('/auth/logout', { method: 'POST' });
}

export function updateProfile(payload) {
  return request('/auth/me', { method: 'PUT', body: JSON.stringify(payload) });
}

export function getProviders() {
  return request('/settings/providers');
}

export function updateProviders(providers) {
  return request('/settings/providers', {
    method: 'PUT',
    body: JSON.stringify({ providers })
  });
}

export function sendAgentMessage(payload) {
  return request('/agent/messages', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function getScans() {
  return request('/scans');
}

export function getTools() {
  return request('/tools');
}

export function getScan(scanId) {
  return request(`/scans/${encodeURIComponent(scanId)}`);
}

export function subscribeToScanEvents(scanId, { onOpen, onEvent, onError } = {}) {
  const source = new EventSource(`${API_BASE}/scans/${encodeURIComponent(scanId)}/events`, { withCredentials: true });
  const eventTypes = [
    'scan.created',
    'scan.phase',
    'agent.plan',
    'tool.requested',
    'tool.started',
    'tool.completed',
    'tool.failed',
    'scan.failed',
    'scan.cancelled'
  ];

  const handleEvent = (event) => {
    try {
      onEvent?.(JSON.parse(event.data));
    } catch {
      onError?.(new ApiError('Received an invalid event from the backend.', 0, 'INVALID_EVENT'));
    }
  };

  eventTypes.forEach((eventType) => source.addEventListener(eventType, handleEvent));
  source.onmessage = handleEvent;
  source.onopen = () => onOpen?.();
  source.onerror = () => onError?.(new ApiError('Live terminal connection was interrupted.', 0, 'EVENT_STREAM_UNAVAILABLE'));

  return () => {
    eventTypes.forEach((eventType) => source.removeEventListener(eventType, handleEvent));
    source.close();
  };
}

export const apiClient = {
  getCurrentUser,
  registerAccount,
  loginAccount,
  logoutAccount,
  updateProfile,
  getProviders,
  updateProviders,
  sendAgentMessage,
  getScans,
  getTools,
  getScan,
  normalizeTargetUrl,
  subscribeToScanEvents
};
