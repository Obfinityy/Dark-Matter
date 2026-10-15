// Auth modal — invite-only. Username + password, no signup.
// Accounts are created by the admin via the Admin Portal.
import React, { useState } from 'react';
import { useAuth } from '../lib/auth';

function friendlyError(res) {
  const code = res && res.error;
  if (code === 'invalid_login') return 'Incorrect username or password.';
  if (code === 'auth_required') return 'Please log in first.';
  if (code === 'pending_approval') return '⏳ Your account is waiting for admin approval. Please check back later.';
  if (code === 'account_blocked') return res.message || 'Your account is blocked.';
  if (code === 'username_taken') return 'This username is already taken.';
  if (code === 'weak_password') return 'Password must be at least 8 characters.';
  if (code === 'invalid_username') return res.message || 'Invalid username.';
  return res.message || code || 'Something went wrong. Try again.';
}

export function AuthCard({ onDone }) {
  const { login } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'pending'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pendingUser, setPendingUser] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    if (mode === 'signup') {
      const { signup } = await import('../lib/api');
      const res = await signup(username.trim(), password);
      setBusy(false);
      if (res.ok) {
        setPendingUser(username.trim());
        setMode('pending');
      } else {
        setError(res.error || res.message || 'Signup failed.');
      }
      return;
    }
    const res = await login(username.trim(), password);
    setBusy(false);
    if (res.ok) {
      onDone && onDone();
    } else {
      setError(friendlyError(res));
    }
  }

  // Waiting-for-approval screen
  if (mode === 'pending') {
    return (
      <div className="auth-card" role="dialog" aria-modal="true" aria-label="Waiting for approval">
        <img src="/dark-matter-symbol.png" alt="Dark Matter" className="auth-symbol" />
        <h2>⏳ Waiting for approval</h2>
        <p className="auth-sub">
          Thanks <strong>{pendingUser}</strong>! Your account has been created.
        </p>
        <p className="auth-sub">
          An admin needs to approve your account before you can use Dark Matter.
          Please check back later.
        </p>
        <button className="auth-submit" onClick={() => { setMode('login'); setUsername(''); setPassword(''); setError(''); }}>
          Back to login
        </button>
      </div>
    );
  }

  return (
    <div className="auth-card" role="dialog" aria-modal="true" aria-label={mode === 'signup' ? 'Sign up' : 'Log in'}>
      <img src="/dark-matter-symbol.png" alt="Dark Matter" className="auth-symbol" />
      <h2>{mode === 'signup' ? 'Create account' : 'Welcome back'}</h2>
      <p className="auth-sub">
        {mode === 'signup'
          ? 'Sign up for Dark Matter. An admin will approve your account.'
          : 'Log in to Dark Matter.'}
      </p>
      <form onSubmit={submit}>
        <div className="auth-field">
          <input
            className="auth-input"
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            aria-label="Username"
            required
          />
        </div>
        <div className="auth-field">
          <input
            className="auth-input"
            type="password"
            placeholder="Password (min 8 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            aria-label="Password"
            required
          />
        </div>
        <button className="auth-submit" type="submit" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'signup' ? 'Sign up' : 'Log in'}
        </button>
        {error && <div className="auth-error" role="alert">{error}</div>}
      </form>
      <div className="auth-toggle">
        {mode === 'login' ? (
          <span>Don't have an account? <button type="button" className="link-btn" onClick={() => { setMode('signup'); setError(''); }}>Sign up</button></span>
        ) : (
          <span>Already have an account? <button type="button" className="link-btn" onClick={() => { setMode('login'); setError(''); }}>Log in</button></span>
        )}
      </div>
      <style>{`
        .auth-toggle { text-align: center; margin: 12px 0; font-size: 14px; color: #666; }
        .link-btn { background: none; border: none; color: #0066cc; cursor: pointer; font-size: 14px; text-decoration: underline; padding: 0; }
        .link-btn:hover { color: #004499; }
      `}</style>
      <div className="auth-legal">
        <a href="#terms" onClick={(e) => e.preventDefault()}>Terms of Use</a>
        {' | '}
        <a href="#privacy" onClick={(e) => e.preventDefault()}>Privacy Policy</a>
      </div>
    </div>
  );
}

export default function AuthModal({ onClose, onDone }) {
  return (
    <div className="auth-scrim" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', width: '100%', maxWidth: 400 }}>
        <AuthCard
          onDone={() => {
            onDone && onDone();
            onClose && onClose();
          }}
        />
        <button className="auth-close" onClick={onClose} aria-label="Close" style={{ position: 'absolute', top: 14, right: 14 }}>
          ✕
        </button>
      </div>
    </div>
  );
}
