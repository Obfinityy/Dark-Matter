// Auth modal — ChatGPT logged-out idiom: white rounded card, X top-right,
// email + password pills, black submit pill, mode toggle, OR divider,
// Terms/Privacy footer. No OAuth buttons.
import React, { useState } from 'react';
import { useAuth } from '../lib/auth';

function friendlyError(res) {
  const code = res && res.data && res.data.error;
  if (code === 'email_taken') return 'An account with this email already exists.';
  if (code === 'invalid_email') return 'Enter a valid email address.';
  if (code === 'weak_password') return 'Password must be at least 8 characters.';
  if (code === 'bad_credentials') return 'Incorrect email or password.';
  return (res && res.error) || 'Something went wrong. Try again.';
}

export function AuthCard({ initialMode = 'login', onDone }) {
  const { signup, login } = useAuth();
  const [mode, setMode] = useState(initialMode === 'signup' ? 'signup' : 'login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const isSignup = mode === 'signup';

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const res = isSignup
      ? await signup(name.trim(), email.trim(), password)
      : await login(email.trim(), password);
    setBusy(false);
    if (res.ok) {
      onDone && onDone();
    } else {
      setError(friendlyError(res));
    }
  }

  function switchMode() {
    setMode(isSignup ? 'login' : 'signup');
    setError('');
  }

  return (
    <div className="auth-card" role="dialog" aria-modal="true" aria-label={isSignup ? 'Create your account' : 'Welcome back'}>
      <h2>{isSignup ? 'Create your account' : 'Welcome back'}</h2>
      <form onSubmit={submit}>
        {isSignup && (
          <div className="auth-field">
            <input
              className="auth-input"
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              aria-label="Name"
            />
          </div>
        )}
        <div className="auth-field">
          <input
            className="auth-input"
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            aria-label="Email address"
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
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            aria-label="Password"
            required
          />
        </div>
        <button className="auth-submit" type="submit" disabled={busy}>
          {busy ? 'Please wait…' : isSignup ? 'Sign up' : 'Log in'}
        </button>
        {error && <div className="auth-error" role="alert">{error}</div>}
      </form>
      <div className="auth-toggle">
        {isSignup ? (
          <>Already have an account? <button type="button" onClick={switchMode}>Log in</button></>
        ) : (
          <>Don&apos;t have an account? <button type="button" onClick={switchMode}>Sign up</button></>
        )}
      </div>
      <div className="auth-divider">OR</div>
      <div className="auth-legal">
        <a href="#terms" onClick={(e) => e.preventDefault()}>Terms of Use</a>
        {' | '}
        <a href="#privacy" onClick={(e) => e.preventDefault()}>Privacy Policy</a>
      </div>
    </div>
  );
}

export default function AuthModal({ mode = 'login', onClose, onDone }) {
  return (
    <div className="auth-scrim" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', width: '100%', maxWidth: 400 }}>
        <AuthCard
          initialMode={mode}
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
