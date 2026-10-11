/**
 * AuthContext — username/ID + password auth with JWT.
 *
 * The backend returns BOTH a session cookie and a stateless JWT on
 * login/register. The JWT is stored in localStorage and attached as the
 * `Authorization: Bearer` header by the API client (see services/api.js);
 * the cookie keeps working as a fallback (and authenticates SSE streams).
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import {
  getCurrentUser,
  loginAccount,
  registerAccount,
  logoutAccount,
  storeJwt,
} from '../services/api';
import { BACKEND_MODE_CHANGED_EVENT } from '../services/backendMode.js';
import './AuthContext.polish.css';

const AuthContext = createContext(null);

/**
 * AuthProvider — React context provider for authentication state.
 * Supplies the current user, session, and auth actions to the tree.
 *
 * Auth is per backend mode: when the user switches between Cloud and
 * "My Device", the session is re-resolved against the newly active backend
 * (each backend has its own user database and its own scoped token).
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const resolveSession = useCallback(async () => {
    setLoading(true);
    try {
      const body = await getCurrentUser();
      setUser(body?.user || null);
    } catch (err) {
      // Only drop the JWT on explicit auth rejection (401/403).
      // Network errors (status 0: timeout, offline, backend down) must NOT
      // log the user out — the token stays so the app can retry when the
      // backend is reachable again.
      const status = err?.status;
      if (status === 401 || status === 403) {
        setUser(null);
        storeJwt(null); // stale/expired token — drop it so we don't 401 forever
      } else {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    resolveSession().finally(() => {
      if (cancelled) setLoading(false);
    });
    // Re-resolve the session whenever the backend mode changes.
    const onModeChanged = () => {
      if (!cancelled) resolveSession();
    };
    window.addEventListener(BACKEND_MODE_CHANGED_EVENT, onModeChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(BACKEND_MODE_CHANGED_EVENT, onModeChanged);
    };
  }, [resolveSession]);

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

/**
 * useAuth — access the authentication context.
 * @returns {{ user, loading, login, logout }} The auth state and actions.
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** AuthBoot — shared full-screen loading gate shown while the session is
 *  being resolved. One component so both route guards paint the same
 *  branded splash (emblem + spinner + label). */
function AuthBoot() {
  return (
    <div className="dm-boot" role="status" aria-live="polite">
      <img
        src="/dark-matter-logo.png"
        alt=""
        aria-hidden="true"
        className="dm-boot-logo"
      />
      <span className="dm-boot-label">Loading Dark Matter…</span>
    </div>
  );
}

/** Route guard: signed-in users only. */
export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <AuthBoot />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

/** Route guard: signed-out users only (login/register pages). */
export function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <AuthBoot />;
  if (user) {
    const from = location.state?.from || '/agent';
    return <Navigate to={from} replace />;
  }
  return children;
}
