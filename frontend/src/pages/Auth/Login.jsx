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
import { Shield, User, Mail, Lock, AtSign, AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react';

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
    <div className="auth-shell">
      {/* Background aesthetics */}
      <div className="auth-grid"></div>
      <div className="auth-signal auth-signal-one"></div>
      <div className="auth-signal auth-signal-two"></div>

      {/* Left Panel - Showcase */}
      <div className="auth-showcase">
        <div className="brand-lockup">
          <div className="brand-mark"><Shield size={20} /></div>
          <span>DARK<span className="brand-accent">MATTER</span></span>
        </div>

        <div className="auth-showcase-copy">
          <div className="eyebrow"><CheckCircle2 size={14} /> SYSTEM ONLINE</div>
          <h1>Autonomous <em>bug bounty</em> agent.</h1>
          <p>DarkMatter handles the recon, exploitation, and reporting loop automatically while you sleep. Next-gen AI cyber operations.</p>

          <div className="auth-console-preview">
            <div className="preview-topline">
              <span><Loader2 size={12} className="animate-spin" /> RUNNING TARGET SCAN</span>
              <span>00:00:42</span>
            </div>
            <div className="preview-line"><span className="preview-key">TARGET:</span> <span className="preview-cyan">example.com</span></div>
            <div className="preview-line"><span className="preview-key">SCOPE:</span> <span className="preview-cyan">*.example.com</span></div>
            <div className="preview-line"><span className="preview-key">STATUS:</span> <span className="preview-faint">Discovering subdomains & running port scans...</span></div>
            <div className="preview-line"><span className="preview-key">VULN:</span> <span className="preview-purple">CVE-2024-XXXX Possible — analyzing...</span></div>
          </div>
        </div>

        <div className="auth-benefits">
          <div className="auth-benefit">
            <div className="auth-benefit-icon"><CheckCircle2 size={12} /></div>
            Real-time Recon
          </div>
          <div className="auth-benefit">
            <div className="auth-benefit-icon"><Shield size={12} /></div>
            Automated Exploitation
          </div>
          <div className="auth-benefit">
            <div className="auth-benefit-icon"><Lock size={12} /></div>
            Secure End-to-End
          </div>
        </div>
      </div>

      {/* Right Panel - Login/Register */}
      <div className="auth-panel">
        <div className="auth-panel-inner">
          <div className="auth-mobile-brand">
            <div className="brand-lockup">
              <div className="brand-mark"><Shield size={20} /></div>
              <span>DARK<span className="brand-accent">MATTER</span></span>
            </div>
          </div>

          <div className="auth-heading">
            <h2>{mode === 'login' ? 'Sign in to Console' : 'Initialize Account'}</h2>
            <p>{mode === 'login' ? 'Access your autonomous agents and reports.' : 'Deploy your first autonomous bug bounty agent.'}</p>
          </div>

          <div className="auth-switch">
            <button
              type="button"
              className={mode === 'login' ? 'active' : ''}
              onClick={() => { setMode('login'); setError(''); }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={mode === 'register' ? 'active' : ''}
              onClick={() => { setMode('register'); setError(''); }}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={submit} className="auth-form">
            {mode === 'login' ? (
              <label className="auth-field">
                Username or Email
                <div className="auth-input-wrap">
                  <User size={16} className="auth-input-prefix" />
                  <input
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    placeholder="nightowl or you@example.com"
                    autoComplete="username"
                    required
                  />
                </div>
              </label>
            ) : (
              <>
                <label className="auth-field">
                  Email
                  <div className="auth-input-wrap">
                    <Mail size={16} className="auth-input-prefix" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      required
                    />
                  </div>
                </label>
                <label className="auth-field">
                  Username <em>(optional)</em>
                  <div className="auth-input-wrap">
                    <AtSign size={16} className="auth-input-prefix" />
                    <input
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                      placeholder="nightowl"
                      autoComplete="username"
                      minLength={3}
                      maxLength={30}
                    />
                  </div>
                </label>
                <label className="auth-field">
                  Display Name
                  <div className="auth-input-wrap">
                    <User size={16} className="auth-input-prefix" />
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Night Owl"
                      autoComplete="name"
                      required
                    />
                  </div>
                </label>
              </>
            )}

            <label className="auth-field">
              Password
              <div className="auth-input-wrap">
                <Lock size={16} className="auth-input-prefix" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                  minLength={8}
                />
              </div>
            </label>

            {mode === 'login' && (
              <div className="auth-form-row">
                <label className="auth-check">
                  <input type="checkbox" />
                  <span /> Remember me
                </label>
                <button type="button" className="auth-text-button">Forgot password?</button>
              </div>
            )}

            {error && (
              <div className="auth-notice" role="alert">
                <AlertTriangle size={14} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '4px' }} />
                {error}
              </div>
            )}

            <button type="submit" className="auth-submit" disabled={busy}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : (mode === 'login' ? 'Initialize Session' : 'Deploy Account')}
            </button>

            <div className="auth-divider">SECURE CONNECTION</div>

            <div className="auth-security-note">
              <Shield size={16} />
              <div>
                Your session is encrypted end-to-end. By continuing, you agree to our <a href="#" className="auth-text-button">Terms of Service</a> and <a href="#" className="auth-text-button">Privacy Policy</a>.
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

