// Auth modal — invite-only. Username + password, no signup.
// Accounts are created by the admin via the Admin Portal.
import React, { useState } from 'react';
import { useAuth } from '../lib/auth';

function IconEye() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEyeOff() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" strokeLinecap="round" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" strokeLinecap="round" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" strokeLinecap="round" />
      <path d="m1 1 22 22" strokeLinecap="round" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
    </svg>
  );
}

function friendlyError(res) {
  const code = res && res.error;
  if (code === 'invalid_login') return 'Incorrect username or password.';
  if (code === 'auth_required') return 'Please log in first.';
  if (code === 'pending_approval') return 'Your account is waiting for admin approval. Please check back later.';
  if (code === 'account_blocked') return res.message || 'Your account is blocked.';
  if (code === 'username_taken') return 'This username is already taken.';
  if (code === 'weak_password') return 'Password must be at least 8 characters.';
  if (code === 'invalid_username') return res.message || 'Invalid username.';
  return res.message || code || 'Something went wrong. Try again.';
}

export function AuthCard({ onDone, onNavigate }) {
  const { login } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'pending'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({ username: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [pendingUser, setPendingUser] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  function validate() {
    const next = { username: '', password: '' };
    if (!username.trim()) next.username = 'Enter your username.';
    if (!password) next.password = 'Enter your password.';
    else if (mode === 'signup' && password.length < 8) next.password = 'Password must be at least 8 characters.';
    setFieldErrors(next);
    return !next.username && !next.password;
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!validate()) return;
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

  // Waiting-for-approval screen — two paths: wait for free admin
  // verification, or go Premium (Rs 10,000 via UPI) to activate for 1 day.
  if (mode === 'pending') {
    return (
      <div className="auth-card" role="dialog" aria-modal="true" aria-label="Waiting for approval">
        <img src="/dark-matter-symbol.png" alt="Dark Matter" className="auth-symbol" />
        <h2><span className="spinner" aria-hidden="true" /> Waiting for approval</h2>
        <p className="auth-sub">
          Thanks <strong>{pendingUser}</strong>! Your account has been created.
        </p>
        <p className="auth-sub">
          An admin needs to approve your account before you can use Dark Matter.
          Please check back later.
        </p>
        <div className="auth-pending-divider">
          <p className="auth-sub">
            Or go Premium — activate with UPI for 1 day of access.
          </p>
          <button
            className="auth-submit"
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('dm:go-pay'))}
          >
            Go Premium
          </button>
        </div>
        <button className="auth-submit" onClick={() => { setMode('login'); setUsername(''); setPassword(''); setError(''); setFieldErrors({ username: '', password: '' }); }}>
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
      <form onSubmit={submit} noValidate>
        <div className="auth-field">
          <input
            className={`auth-input${fieldErrors.username ? ' input-error' : ''}`}
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => { setUsername(e.target.value); if (fieldErrors.username) setFieldErrors((f) => ({ ...f, username: '' })); }}
            autoComplete="username"
            aria-label="Username"
            aria-invalid={!!fieldErrors.username}
            aria-describedby={fieldErrors.username ? 'auth-username-error' : undefined}
          />
          {fieldErrors.username && <p className="field-error" id="auth-username-error" role="alert">{fieldErrors.username}</p>}
        </div>
        <div className="auth-field auth-password-wrap">
          <input
            className={`auth-input${fieldErrors.password ? ' input-error' : ''}`}
            type={showPassword ? 'text' : 'password'}
            placeholder="Password (min 8 characters)"
            value={password}
            onChange={(e) => { setPassword(e.target.value); if (fieldErrors.password) setFieldErrors((f) => ({ ...f, password: '' })); }}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            aria-label="Password"
            aria-invalid={!!fieldErrors.password}
            aria-describedby={fieldErrors.password ? 'auth-password-error' : undefined}
          />
          <button
            type="button"
            className="auth-pw-toggle"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            title={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <IconEyeOff /> : <IconEye />}
          </button>
          {fieldErrors.password && <p className="field-error" id="auth-password-error" role="alert">{fieldErrors.password}</p>}
        </div>
        <button className="auth-submit" type="submit" disabled={busy}>
          {busy ? (<><span className="spinner" aria-hidden="true" /> Please wait…</>) : mode === 'signup' ? 'Sign up' : 'Log in'}
        </button>
        {error && <div className="auth-error" role="alert">{error}</div>}
      </form>
      <div className="auth-toggle">
        {mode === 'login' ? (
          <span>Don&apos;t have an account? <button type="button" className="link-btn" onClick={() => { setMode('signup'); setError(''); setFieldErrors({ username: '', password: '' }); }}>Sign up</button></span>
        ) : (
          <span>Already have an account? <button type="button" className="link-btn" onClick={() => { setMode('login'); setError(''); setFieldErrors({ username: '', password: '' }); }}>Log in</button></span>
        )}
      </div>
      <div className="auth-legal">
        <a href="/terms" onClick={(e) => { if (onNavigate) { e.preventDefault(); onNavigate('terms'); } }}>Terms of Service</a>
        {' | '}
        <a href="/privacy" onClick={(e) => { if (onNavigate) { e.preventDefault(); onNavigate('privacy'); } }}>Privacy Policy</a>
      </div>
    </div>
  );
}

export default function AuthModal({ onClose, onDone, onNavigate }) {
  return (
    <div className="auth-scrim" onClick={onClose}>
      <div className="auth-modal-wrap" onClick={(e) => e.stopPropagation()}>
        <AuthCard
          onNavigate={(page) => {
            onClose && onClose();
            onNavigate && onNavigate(page);
          }}
          onDone={() => {
            onDone && onDone();
            onClose && onClose();
          }}
        />
        <button className="auth-close" onClick={onClose} aria-label="Close">
          <IconClose />
        </button>
      </div>
    </div>
  );
}
