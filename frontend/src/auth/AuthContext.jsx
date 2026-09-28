import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { apiClient, ApiError } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const result = await apiClient.getCurrentUser();
      setUser(result.user);
      return result.user;
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh().catch(() => {
      setUser(null);
      setLoading(false);
    });
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    async login(credentials) {
      const result = await apiClient.loginAccount(credentials);
      setUser(result.user);
      return result.user;
    },
    async register(details) {
      const result = await apiClient.registerAccount(details);
      setUser(result.user);
      return result.user;
    },
    async logout() {
      await apiClient.logoutAccount();
      setUser(null);
    },
    async updateProfile(details) {
      const result = await apiClient.updateProfile(details);
      setUser(result.user);
      return result.user;
    },
    refresh
  }), [loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="auth-loading-screen">Connecting to secure workspace...</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

export function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="auth-loading-screen">Connecting to secure workspace...</div>;
  if (user) return <Navigate to="/" replace />;
  return children;
}
