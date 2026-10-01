/**
 * Login — DarkMatter "Singularity" auth experience.
 *
 * Split layout: left brand panel (logo, positioning, proof points),
 * right sign-in / create-account card. One field accepts username or email.
 */
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import Logo from '../../components/brand/Logo';
import { Mail, Lock, AtSign, User, AlertTriangle, Crosshair, FileCheck2, BrainCircuit } from 'lucide-react';
import './Login.css';

const PROOFS = [
  { icon: Crosshair, title: 'Autonomous hunting', text: 'Paste a target. The agent recons, probes and reasons — on its own.' },
  { icon: BrainCircuit, title: 'Thinks out loud', text: 'Watch it reason in plain language, and ask it anything mid-hunt.' },
  { icon: FileCheck2, title: 'Proof, not noise', text: 'Every finding ships with evidence and a ready-to-send report.' },
];

export function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState('login');
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
        await register({ email: email.trim(), username: username.trim() || undefined, name: name.trim(), password });
      }
      navigate(location.state?.from || '/agent', { replace: true });
    } catch (err) {
      setError(err.message || 'Sign-in failed. Check your credentials and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sg-app sg-auth">
      {/* Brand panel */}
      <aside className="sg-auth-brand">
        <div className="sg-auth-brand-inner">
          <Logo size={44} withWordmark />
          <h1 className="sg-display sg-fade-up">
            The agent that finds what<br />others <span className="sg-gradient-text">can't see.</span>
          </h1>
          <p className="sg-body sg-fade-up sg-fade-up-1" style={{ maxWidth: 440 }}>
            DarkMatter is an autonomous security agent. Point it at a target and it
            hunts — recon, analysis, proof — while you watch it think.
          </p>
          <div className="sg-auth-proofs">
            {PROOFS.map(({ icon: Icon, title, text }, i) => (
              <div key={title} className={`sg-auth-proof sg-fade-up sg-fade-up-${i + 2}`}>
                <span className="sg-auth-proof-icon"><Icon size={18} strokeWidth={1.8} /></span>
                <div>
                  <div className="sg-h3" style={{ marginBottom: 4 }}>{title}</div>
                  <div className="sg-small">{text}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="sg-tiny sg-auth-fineprint">
            Only test systems you own or are authorized to assess.
          </p>
        </div>
        <div className="sg-auth-glow" aria-hidden />
      </aside>

      {/* Form panel */}
      <main className="sg-auth-form-wrap">
        <div className="sg-auth-card sg-card sg-fade-up">
          <div className="sg-auth-mobile-brand"><Logo size={38} withWordmark /></div>

          <div className="sg-auth-tabs" role="tablist">
            {(['login', 'register']).map((m) => (
              <button
                key={m} type="button" role="tab" aria-selected={mode === m}
                className={mode === m ? 'active' : ''}
                onClick={() => { setMode(m); setError(''); }}
              >
                {m === 'login' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="sg-stack">
            {mode === 'login' ? (
              <div>
                <label className="sg-label" htmlFor="sg-login-id">Username or email</label>
                <div className="sg-field">
                  <User size={16} className="sg-field-icon" />
                  <input id="sg-login-id" className="sg-input sg-field-input"
                    value={loginId} onChange={(e) => setLoginId(e.target.value)}
                    placeholder="nightowl  or  you@example.com"
                    autoComplete="username" required />
                </div>
              </div>
            ) : (
              <>
                <div>
                  <label className="sg-label" htmlFor="sg-reg-email">Email</label>
                  <div className="sg-field">
                    <Mail size={16} className="sg-field-icon" />
                    <input id="sg-reg-email" type="email" className="sg-input sg-field-input"
                      value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com" autoComplete="email" required />
                  </div>
                </div>
                <div className="sg-grid-2" style={{ gap: 12 }}>
                  <div>
                    <label className="sg-label" htmlFor="sg-reg-user">Username</label>
                    <div className="sg-field">
                      <AtSign size={16} className="sg-field-icon" />
                      <input id="sg-reg-user" className="sg-input sg-field-input"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                        placeholder="nightowl" autoComplete="username" minLength={3} maxLength={30} />
                    </div>
                  </div>
                  <div>
                    <label className="sg-label" htmlFor="sg-reg-name">Display name</label>
                    <div className="sg-field">
                      <User size={16} className="sg-field-icon" />
                      <input id="sg-reg-name" className="sg-input sg-field-input"
                        value={name} onChange={(e) => setName(e.target.value)}
                        placeholder="Night Owl" autoComplete="name" required />
                    </div>
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="sg-label" htmlFor="sg-pass">Password</label>
              <div className="sg-field">
                <Lock size={16} className="sg-field-icon" />
                <input id="sg-pass" type="password" className="sg-input sg-field-input"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required minLength={8} />
              </div>
            </div>

            {error && (
              <div className="sg-auth-error" role="alert">
                <AlertTriangle size={15} /> {error}
              </div>
            )}

            <button type="submit" className="sg-btn sg-btn-primary sg-btn-lg" style={{ width: '100%' }} disabled={busy}>
              {busy && <span className="sg-spin" style={{ display: 'inline-flex' }}>◌</span>}
              {mode === 'login' ? 'Sign in to DarkMatter' : 'Create my account'}
            </button>
          </form>

          <p className="sg-small sg-auth-switch">
            {mode === 'login' ? (
              <>New to DarkMatter? <button type="button" onClick={() => setMode('register')}>Create an account</button></>
            ) : (
              <>Already have an account? <button type="button" onClick={() => setMode('login')}>Sign in</button></>
            )}
          </p>
        </div>
      </main>
    </div>
  );
}
