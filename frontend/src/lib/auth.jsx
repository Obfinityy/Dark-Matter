// ============================================================================
// Dark Matter frontend — auth context.
// Token lives in localStorage (`dm_token`); on boot we validate it with
// GET /api/v1/auth/me. Hunting requires a logged-in user; browsing and
// chatting stay open to everyone.
// ============================================================================
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  login as apiLogin,
  me as apiMe,
  setAuthToken,
  clearAuthToken,
  getAuthToken,
} from './api';

const AuthContext = createContext(null);

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
        else clearAuthToken();
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
