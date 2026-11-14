// Dark Matter frontend — auth context.
// Token lives in localStorage (`dm_token`); on boot we validate it with
// GET /api/v1/auth/me. Hunting requires a logged-in user; browsing and
// chatting stay open to everyone.
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  login as apiLogin,
  me as apiMe,
  setAuthToken,
  clearAuthToken,
  getAuthToken,
} from './api';

const AuthContext = createContext(null);

// FIX (#445): pending-hunt intent. When a logged-out user tries to
// open the hunt setup, the auth modal used to swallow that intent:
// after login, App's onDone only went back to the chat page and the
// user had to start over. The intent is now stashed in sessionStorage
// (tab-scoped: it dies with the tab) and resumed after login —
// ChatPage opens the hunt setup when it sees the flag, and the flag
// is cleared if the auth modal is dismissed without logging in.
const PENDING_HUNT_KEY = 'dm.pendingHuntSetup';
export function recordPendingHuntSetup() {
  try { sessionStorage.setItem(PENDING_HUNT_KEY, '1'); } catch { /* ignore */ }
}
export function hasPendingHuntSetup() {
  try { return sessionStorage.getItem(PENDING_HUNT_KEY) === '1'; } catch { return false; }
}
export function consumePendingHuntSetup() {
  const had = hasPendingHuntSetup();
  try { sessionStorage.removeItem(PENDING_HUNT_KEY); } catch { /* ignore */ }
  return had;
}
export function clearPendingHuntSetup() {
  try { sessionStorage.removeItem(PENDING_HUNT_KEY); } catch { /* ignore */ }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getAuthToken()) {
        setReady(true);
        return;
      }
      const res = await apiMe();
      if (!cancelled) {
        if (res.ok) setUser(res.data.user);
        // FIX (#446): only a 401/403 proves the token is dead. The
        // old code wiped the token on ANY non-ok result, so a
        // transient backend failure (500, backend down, network
        // error — which carries no status at all) logged the user
        // out and destroyed a still-valid token, forcing a
        // re-login for a blip. Other failures leave the token
        // alone: the session reads logged-out, but a refresh
        // retries /me with the token intact.
        else if (res.status === 401 || res.status === 403) clearAuthToken();
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username, password) => {
    const res = await apiLogin(username, password);
    if (res.ok) {
      setAuthToken(res.data.token);
      setUser(res.data.user);
    }
    return res;
  }, []);

  const logout = useCallback(() => {
    clearAuthToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, ready, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

/** Ask the app shell to open the auth modal (used deep in the tree). */
export function openAuthModal(mode = 'login') {
  try {
    window.dispatchEvent(new CustomEvent('dm:open-auth', { detail: { mode } }));
  } catch { /* ignore */ }
}
