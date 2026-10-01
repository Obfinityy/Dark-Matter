/**
 * Login — username/ID or email + password.
 *
 * One field accepts either the username or the email address; the backend's
 * login endpoint resolves both. A register toggle collects the optional
 * username (3–30 chars, a-z 0-9 _ -).
 */
import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { Shield, User, Mail, Lock, AtSign, AlertTriangle, Loader2 } from 'lucide-react';

export function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [loginId, setLoginId] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'login') {
        await login({ login: loginId, password });
      } else {
        await register({
          email: email.trim(),
          username: username.trim() || undefined,
          name: name.trim(),
          password
        });
      }
      navigate(location.state?.from || '/agent', { replace: true });
    } catch (err) {
      setError(err.message || 'Sign-in failed. Check your credentials and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dm-auth-page">
      <div className="dm-auth-card">
        <div className="dm-auth-brand">
          <Shield size={28} className="dm-auth-shield" />
          <h1>DARKMATTER</h1>
          <p>Autonomous bug bounty agent</p>
        </div>

        <div className="dm-auth-tabs">
          <button
            type="button"
            className={mode === 'login' ? 'active' : ''}
            onClick={() => { setMode('login'); setError(''); }}
          >
            Sign in
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'active' : ''}
            onClick={() => { setMode('register'); setError(''); }}
          >
            Create account
          </button>
        </div>

        <form onSubmit={submit} className="dm-auth-form">
          {mode === 'login' ? (
            <label className="dm-field">
              <span><User size={14} /> Username or email</span>
              <input
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="nightowl  or  you@example.com"
                autoComplete="username"
                required
              />
            </label>
          ) : (
            <>
              <label className="dm-field">
                <span><Mail size={14} /> Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </label>
              <label className="dm-field">
                <span><AtSign size={14} /> Username <em>(optional)</em></span>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                  placeholder="nightowl"
                  autoComplete="username"
                  minLength={3}
                  maxLength={30}
                />
              </label>
              <label className="dm-field">
                <span><User size={14} /> Display name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Night Owl"
                  autoComplete="name"
                  required
                />
              </label>
            </>
          )}

          <label className="dm-field">
            <span><Lock size={14} /> Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={8}
            />
          </label>

          {error && (
            <div className="dm-auth-error" role="alert">
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          <button type="submit" className="dm-btn-primary" disabled={busy}>
            {busy ? <Loader2 size={16} className="dm-spin" /> : null}
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="dm-auth-note">
          {mode === 'login' ? (
            <>New here? <button type="button" className="dm-link" onClick={() => setMode('register')}>Create an account</button></>
          ) : (
            <>Already have an account? <button type="button" className="dm-link" onClick={() => setMode('login')}>Sign in</button></>
          )}
        </p>
      </div>
    </div>
  );
}
