/**
 * Login — Infinity AI auth experience (serves /login AND /register).
 *
 * Kinetic redesign (issue #292): calm centered composition — kinetic brand
 * wordmark on top, one centered card with the mode tabs + form + ONE primary
 * action, quiet secondary links below. All handlers, auth calls, validation
 * and props are untouched; only markup placement and classes changed.
 */
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import Logo from '../../components/brand/Logo';
import {
  Mail,
  Lock,
  AtSign,
  User,
  AlertTriangle,
  Crosshair,
  FileCheck2,
  BrainCircuit,
  Loader2,
} from 'lucide-react';
import '../../styles/kinetic-acct.css';

const PROOFS = [
  {
    icon: Crosshair,
    title: 'Autonomous hunting',
    text: 'Paste a target. The agent recons, probes and reasons — on its own.',
  },
  {
    icon: BrainCircuit,
    title: 'Thinks out loud',
    text: 'Watch it reason in plain language, and ask it anything mid-hunt.',
  },
  {
    icon: FileCheck2,
    title: 'Proof, not noise',
    text: 'Every finding ships with evidence and a ready-to-send report.',
  },
];

/** Kinetic letter spans for a title string. Parent must carry aria-label. */
function kineticLetters(text) {
  let i = 0;
  return text.split(' ').map((word, wi, words) => (
    <span key={wi} className="kac-word" aria-hidden="true">
      {word.split('').map(ch => {
        const idx = i++;
        return (
          <span key={idx} className="kac-ch" style={{ '--kac-i': idx }} aria-hidden="true">
            {ch}
          </span>
        );
      })}
      {wi < words.length - 1 ? ' ' : null}
    </span>
  ));
}

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

  const submit = async e => {
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
          password,
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
    <div className="kac-auth">
      <div className="kac-auth-glow" aria-hidden="true" />

      {/* Kinetic brand wordmark */}
      <header className="kac-auth-brand kac-in" style={{ '--kac-i': 0 }}>
        <Logo size={52} />
        <p className="kac-eyebrow">Infinity AI</p>
        <h1 className="kac-title kac-auth-wordmark" aria-label="Dark Matter">
          {kineticLetters('Dark Matter')}
        </h1>
        <p className="kac-auth-tagline">
          The agent that finds what others can&rsquo;t see. Point it at a target and it hunts:
          recon, analysis, proof — while you watch it think.
        </p>
      </header>

      {/* Calm centered card: tabs, fields, ONE primary action */}
      <main className="kac-card kac-auth-card kac-in" style={{ '--kac-i': 1 }}>
        <div className="kac-tabs" role="tablist" aria-label="Sign in or create account">
          {['login', 'register'].map(m => (
            <button
              key={m}
              type="button"
              role="tab"
              id={`kac-auth-tab-${m}`}
              aria-selected={mode === m}
              aria-controls="kac-auth-panel"
              className={`kac-tab${mode === m ? ' kac-tab-on' : ''}`}
              onClick={() => {
                setMode(m);
                setError('');
              }}
            >
              {m === 'login' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        <form
          onSubmit={submit}
          className="kac-form"
          id="kac-auth-panel"
          role="tabpanel"
          aria-labelledby={`kac-auth-tab-${mode}`}
        >
          {mode === 'login' ? (
            <div>
              <label className="kac-label" htmlFor="kac-login-id">
                Username or email
              </label>
              <div className="kac-field">
                <User size={16} className="kac-field-icon" aria-hidden="true" />
                <input
                  id="kac-login-id"
                  className="kac-input"
                  value={loginId}
                  onChange={e => setLoginId(e.target.value)}
                  placeholder="nightowl  or  you@example.com"
                  autoComplete="username"
                  required
                />
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="kac-label" htmlFor="kac-reg-email">
                  Email
                </label>
                <div className="kac-field">
                  <Mail size={16} className="kac-field-icon" aria-hidden="true" />
                  <input
                    id="kac-reg-email"
                    type="email"
                    className="kac-input"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>
              <div className="kac-grid-2">
                <div>
                  <label className="kac-label" htmlFor="kac-reg-user">
                    Username
                  </label>
                  <div className="kac-field">
                    <AtSign size={16} className="kac-field-icon" aria-hidden="true" />
                    <input
                      id="kac-reg-user"
                      className="kac-input"
                      value={username}
                      onChange={e =>
                        setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))
                      }
                      placeholder="nightowl"
                      autoComplete="username"
                      minLength={3}
                      maxLength={30}
                    />
                  </div>
                </div>
                <div>
                  <label className="kac-label" htmlFor="kac-reg-name">
                    Display name
                  </label>
                  <div className="kac-field">
                    <User size={16} className="kac-field-icon" aria-hidden="true" />
                    <input
                      id="kac-reg-name"
                      className="kac-input"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Night Owl"
                      autoComplete="name"
                      required
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="kac-label" htmlFor="kac-pass">
              Password
            </label>
            <div className="kac-field">
              <Lock size={16} className="kac-field-icon" aria-hidden="true" />
              <input
                id="kac-pass"
                type="password"
                className="kac-input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                minLength={8}
              />
            </div>
          </div>

          {error && (
            <div className="kac-error" role="alert">
              <AlertTriangle size={15} aria-hidden="true" /> {error}
            </div>
          )}

          <button
            type="submit"
            className="kac-btn kac-btn-primary kac-btn-lg kac-btn-block"
            disabled={busy}
          >
            {busy && <Loader2 size={17} className="sg-spin" aria-hidden="true" />}
            {mode === 'login' ? 'Sign in to Dark Matter' : 'Create my account'}
          </button>
        </form>

        <p className="kac-auth-switch">
          {mode === 'login' ? (
            <>
              New to Dark Matter?{' '}
              <button type="button" onClick={() => setMode('register')}>
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button type="button" onClick={() => setMode('login')}>
                Sign in
              </button>
            </>
          )}
        </p>
      </main>

      {/* Proof strip (wide screens only) */}
      <section className="kac-auth-proofs kac-in" style={{ '--kac-i': 2 }} aria-label="Why Dark Matter">
        {PROOFS.map(({ icon: Icon, title, text }) => (
          <div key={title} className="kac-auth-proof">
            <span className="kac-auth-proof-icon" aria-hidden="true">
              <Icon size={18} strokeWidth={1.8} />
            </span>
            <div>
              <h2 className="kac-auth-proof-title">{title}</h2>
              <p className="kac-auth-proof-text">{text}</p>
            </div>
          </div>
        ))}
      </section>

      <footer className="kac-auth-foot kac-in" style={{ '--kac-i': 3 }}>
        <p>Only test systems you own or are authorized to assess.</p>
        <p>
          <a href="/privacy-policy">Privacy Policy</a> · <a href="/terms">Terms &amp; Conditions</a>
        </p>
      </footer>
    </div>
  );
}
