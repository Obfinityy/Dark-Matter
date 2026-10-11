/**
 * AuthContext — local-first pass-through (no login, no signup).
 *
 * Dark Matter is a free product now: there are no accounts. This module keeps
 * its exports intact (AuthProvider, useAuth, ProtectedRoute, PublicRoute) so
 * nothing that imports them breaks, but the provider no longer talks to the
 * network — it supplies a static local hunter identity and no-op actions.
 * Route guards render their children directly.
 */
import { createContext, useContext, useCallback } from 'react';

const AuthContext = createContext(null);

/** The single local identity — every user is "the hunter on this machine". */
const LOCAL_USER = Object.freeze({ id: 'local', username: 'hunter', name: 'Hunter' });

/**
 * AuthProvider — React context provider. Pass-through: no session resolution,
 * no backend calls. Supplies the local hunter identity plus no-op auth
 * actions so existing call sites keep working.
 */
export function AuthProvider({ children }) {
  const login = useCallback(async () => LOCAL_USER, []);
  const register = useCallback(async () => LOCAL_USER, []);
  const logout = useCallback(() => {
    /* no-op: there is no session to end */
  }, []);
  const setUser = useCallback(() => {
    /* no-op: the identity is fixed */
  }, []);

  const value = {
    user: LOCAL_USER,
    loading: false,
    authError: null,
    login,
    register,
    logout,
    setUser,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * useAuth — access the authentication context.
 * @returns {{ user, loading, login, logout }} The auth state and actions.
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Route guard: no login anymore — always renders the app. */
export function ProtectedRoute({ children }) {
  return children;
}

/** Route guard: no login anymore — always renders the page. */
export function PublicRoute({ children }) {
  return children;
}
