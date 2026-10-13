// Auth modal — invite-only. Username + password, no signup.
// Accounts are created by the admin via the Admin Portal.
import React, { useState } from 'react';
import { useAuth } from '../lib/auth';

function friendlyError(res) {
  const code = res && res.error;
  if (code === 'invalid_login') return 'Incorrect username or password.';
  if (code === 'auth_required') return 'Please log in first.';
  return code || 'Something went wrong. Try again.';
}

export function AuthCard({ onDone }) {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const res = await login(username.trim(), password);
    setBusy(false);
    if (res.ok) {
      onDone && onDone();
    } else {
      setError(friendlyError(res));
    }
  }

  return (
    <div className="auth-card" role="dialog" aria-modal="true" aria-label="Log in">
      <h2>Welcome back</h2>
      <p className="auth-sub">Invite-only. Use the credentials your admin gave you.</p>
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
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            aria-label="Password"
            required
          />
        </div>
        <button className="auth-submit" type="submit" disabled={busy}>
          {busy ? 'Please wait…' : 'Log in'}
        </button>
        {error && <div className="auth-error" role="alert">{error}</div>}
      </form>
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
