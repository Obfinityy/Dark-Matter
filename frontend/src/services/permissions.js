/**
 * permissions — agent permission-mode contract (night-rebuild gap I44).
 *
 * Two modes:
 *   'ask'  — "Har action par puchho": the agent asks before each tool/system action.
 *   'full' — "Full control": no prompts, the agent acts autonomously.
 *
 * localStorage is the UI source of truth (works offline / against any
 * backend). The mode is ALSO synced to the backend user prefs when a
 * session exists, so other workers and future clients can honor it.
 *
 * Backend contract (implemented in backend/src/services/permissionService.js):
 *   GET /api/v1/users/me/permissions  → { permissionMode: 'ask' | 'full' }
 *   PUT /api/v1/users/me/permissions  → { permissionMode } → 200 { permissionMode }
 *
 * Other workers honor it through `requiresPrompt(userId)` on the backend:
 *   - 'ask'  → prompt before every tool / system / computer action.
 *   - 'full' → act without prompting.
 */
import { getPermissionModePrefs, setPermissionModePrefs } from './api';

export const PERMISSION_MODES = {
  ASK: 'ask',
  FULL: 'full',
};

/** Human-readable labels for permission modes. */
export const PERMISSION_LABELS = {
  [PERMISSION_MODES.ASK]: 'Har action par puchho',
  [PERMISSION_MODES.FULL]: 'Full control — no prompts',
};

/** Descriptions explaining each permission mode. */
export const PERMISSION_DESCRIPTIONS = {
  [PERMISSION_MODES.ASK]:
    'Agent har tool / system action se pehle tumse permission maangega. Safe, thoda slow.',
  [PERMISSION_MODES.FULL]:
    'Agent bina puche kaam karega — full autonomous. Sirf tab chuno jab tumhe poora bharosa ho.',
};

const STORAGE_KEY = 'dm.permissionMode';

/** Return true if the value is a known permission mode. */
export function isValidPermissionMode(mode) {
  return mode === PERMISSION_MODES.ASK || mode === PERMISSION_MODES.FULL;
}

/** UI source of truth. Defaults to 'ask' (safe) when unset or invalid. */
export function getPermissionMode() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isValidPermissionMode(stored)) return stored;
  } catch {
    /* storage unavailable */
  }
  return PERMISSION_MODES.ASK;
}

/** Persist the selected permission mode. */
export function setPermissionMode(mode) {
  if (!isValidPermissionMode(mode)) {
    throw new Error(`Invalid permission mode: ${mode}`);
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* storage unavailable */
  }
  return mode;
}

/** Best-effort sync of the local mode to the backend (fails silently offline). */
export async function syncPermissionModeToServer() {
  try {
    await setPermissionModePrefs(getPermissionMode());
    return true;
  } catch {
    return false;
  }
}

/** Best-effort pull of the server mode into localStorage (fails silently offline). */
export async function loadPermissionModeFromServer() {
  try {
    const res = await getPermissionModePrefs();
    if (res && isValidPermissionMode(res.permissionMode)) {
      setPermissionMode(res.permissionMode);
      return res.permissionMode;
    }
  } catch {
    /* offline or unsupported backend */
  }
  return getPermissionMode();
}
