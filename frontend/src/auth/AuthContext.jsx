/**
 * AuthContext — username/ID + password auth with JWT.
 *
 * The backend returns BOTH a session cookie and a stateless JWT on
 * login/register. The JWT is stored in localStorage and attached as the
 * `Authorization: Bearer` header by the API client (see services/api.js);
 * the cookie keeps working as a fallback (and authenticates SSE streams).
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import {
  getCurrentUser,
  loginAccount,
  registerAccount,
  logoutAccount,
  storeJwt
} from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then((body) => {
        if (!cancelled) setUser(body?.user || null);
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
          storeJwt(null); // stale token — drop it so we don't 401 forever
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async ({ login, password }) => {
    setAuthError(null);
    try {
      const body = await loginAccount({ login: login.trim(), password });
      setUser(body.user);
      return body.user;
    } catch (err) {
      setAuthError(err);
      throw err;
    }
  }, []);

  const register = useCallback(async ({ email, username, name, password }) => {
    setAuthError(null);
    try {
      const body = await registerAccount({ email, username, name, password });
      setUser(body.user);
      return body.user;
    } catch (err) {
      setAuthError(err);
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutAccount();
    } finally {
      setUser(null);
    }
  }, []);

  const value = { user, loading, authError, login, register, logout, setUser };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Route guard: signed-in users only. */
export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="dm-boot">Loading DarkMatter…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

/** Route guard: signed-out users only (login/register pages). */
export function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="dm-boot">Loading DarkMatter…</div>;
  if (user) {
    const from = location.state?.from || '/agent';
    return <Navigate to={from} replace />;
  }
  return children;
}
