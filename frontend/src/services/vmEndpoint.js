/**
 * vmEndpoint.js — Infinity AI VM endpoint configuration.
 *
 * Where the Control UI talks to the VM Runner (the user's local service that
 * owns the Kali sandbox VM). The runner binds 127.0.0.1 only; browsers and
 * the cloud backend NEVER route computer-control commands.
 *
 * Shape: { mode: 'local' | 'cloud', baseUrl, wsUrl }
 *   local — the runner on this machine
 *           (baseUrl http://127.0.0.1:4100, wsUrl ws://127.0.0.1:4100).
 *   cloud — placeholder for the future cloud-hosted VM. Visible but
 *           disabled ("Coming soon"); never used for connections.
 *
 * Persisted to localStorage 'dm.vmEndpoint' (mode + custom URL only —
 * NEVER tokens; session tokens live in module memory, see vmRunnerApi.js).
 */

import { LOCAL_RUNNER_BASE_URL, LOCAL_RUNNER_WS_URL } from '../lib/apiBase.js';

const STORAGE_KEY = 'dm.vmEndpoint';

const LOCAL_DEFAULTS = {
  baseUrl: LOCAL_RUNNER_BASE_URL,
  wsUrl: LOCAL_RUNNER_WS_URL
};

function readStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(partial) {
  try {
    const prev = readStored() || {};
    const next = { ...prev, ...partial };
    // Persist only mode + custom URL — never tokens, never secrets.
    const safe = {
      mode: next.mode === 'cloud' ? 'cloud' : 'local',
      customUrl: typeof next.customUrl === 'string' ? next.customUrl.trim() : ''
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safe));
    return safe;
  } catch {
    return null;
  }
}

/** Normalize a user-supplied runner URL: http(s)://host:port, no trailing slash. */
function normalizeUrl(url) {
  if (!url || typeof url !== 'string') return null;
  let u = url.trim().replace(/\/+$/, '');
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = `http://${u}`;
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

function deriveWsUrl(httpUrl) {
  return httpUrl.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');
}

/**
 * Current endpoint config.
 * @returns {{ mode: 'local'|'cloud', baseUrl: string, wsUrl: string,
 *             cloudComingSoon: boolean, customUrl: string }}
 */
export function getVmEndpoint() {
  const stored = readStored() || {};
  const mode = stored.mode === 'cloud' ? 'cloud' : 'local';
  const custom = normalizeUrl(stored.customUrl) || '';
  const baseUrl = custom || LOCAL_DEFAULTS.baseUrl;
  return {
    mode,
    baseUrl,
    wsUrl: deriveWsUrl(baseUrl),
    cloudComingSoon: mode === 'cloud',
    customUrl: custom
  };
}

/**
 * Update the endpoint config. Only `mode` ('local'|'cloud') and
 * `customUrl` (optional local runner override) are stored.
 * Returns the new endpoint config.
 */
export function setVmEndpoint(patch) {
  const safe = {};
  if (patch && typeof patch.mode === 'string') {
    safe.mode = patch.mode === 'cloud' ? 'cloud' : 'local';
  }
  if (patch && patch.customUrl !== undefined) {
    const norm = normalizeUrl(patch.customUrl);
    safe.customUrl = norm || '';
  }
  writeStored(safe);
  return getVmEndpoint();
}

/** True when a connection attempt should actually be made (cloud is not live). */
export function isVmConnectable() {
  return getVmEndpoint().mode === 'local';
}

export { STORAGE_KEY };
