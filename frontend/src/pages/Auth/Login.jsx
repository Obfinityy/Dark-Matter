import React, { useState } from 'react';
import { ArrowRight, Check, Eye, EyeOff, Fingerprint, LockKeyhole, Radar, ShieldCheck } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';

const benefits = [
  'Live terminal output for every run',
  'Encrypted provider settings',
  'Scope-first reconnaissance workflow'
];

export const Login = ({ initialMode = 'signin' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isSignup = mode === 'signup';

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setNotice('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setNotice('');
    try {
      if (isSignup) await register({ name: form.name, email: form.email, password: form.password });
      else await login({ email: form.email, password: form.password });
      navigate(location.state?.from || '/', { replace: true });
    } catch (error) {
      setNotice(error.message || 'Unable to connect to the account service.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-shell">
      <div className="auth-grid" aria-hidden="true" />
      <div className="auth-signal auth-signal-one" aria-hidden="true" />
      <div className="auth-signal auth-signal-two" aria-hidden="true" />

      <section className="auth-showcase">
        <div className="brand-lockup">
          <span className="brand-mark"><Radar size={21} /></span>
          <span>DARK<span className="brand-accent">MATTER</span></span>
        </div>

        <div className="auth-showcase-copy">
          <span className="eyebrow"><span className="eyebrow-dot" /> Autonomous security workspace</span>
          <h1>Turn a target into a <em>clear signal.</em></h1>
          <p>Run focused reconnaissance with a live operator console built for authorized security research.</p>
        </div>

        <div className="auth-benefits">
          {benefits.map((benefit) => (
            <div className="auth-benefit" key={benefit}>
              <span className="auth-benefit-icon"><Check size={14} /></span>
              <span>{benefit}</span>
            </div>
          ))}
        </div>

        <div className="auth-console-preview" aria-hidden="true">
          <div className="preview-topline"><span><span className="preview-dot" /> console ready</span><span>01 / 01</span></div>
          <div className="preview-line"><span className="preview-key">SYSTEM</span><span>Authorization gate active</span></div>
          <div className="preview-line"><span className="preview-key preview-cyan">SCOPE</span><span>Waiting for an authorized target</span></div>
          <div className="preview-line preview-faint"><span className="preview-key preview-purple">MODE</span><span>Normal / terminal stream</span></div>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-panel-inner">
          <div className="auth-mobile-brand brand-lockup">
            <span className="brand-mark"><Radar size={19} /></span>
            <span>DARK<span className="brand-accent">MATTER</span></span>
          </div>

          <div className="auth-heading">
            <span className="auth-kicker">Secure access</span>
            <h2>{isSignup ? 'Create your workspace' : 'Welcome back'}</h2>
            <p>{isSignup ? 'Set up your operator profile to begin.' : 'Sign in to continue to your operator console.'}</p>
          </div>

          <div className="auth-switch" role="tablist" aria-label="Authentication mode">
            <button type="button" role="tab" aria-selected={!isSignup} className={!isSignup ? 'active' : ''} onClick={() => setMode('signin')}>Sign in</button>
            <button type="button" role="tab" aria-selected={isSignup} className={isSignup ? 'active' : ''} onClick={() => setMode('signup')}>Create account</button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {isSignup && (
              <label className="auth-field">
                <span>Display name</span>
                <div className="auth-input-wrap"><Fingerprint size={17} /><input value={form.name} onChange={(event) => updateField('name', event.target.value)} placeholder="Your name" autoComplete="name" required /></div>
              </label>
            )}
            <label className="auth-field">
              <span>Email address</span>
              <div className="auth-input-wrap"><span className="auth-input-prefix">@</span><input type="email" value={form.email} onChange={(event) => updateField('email', event.target.value)} placeholder="you@company.com" autoComplete="email" required /></div>
            </label>
            <label className="auth-field">
              <span>Password</span>
              <div className="auth-input-wrap"><LockKeyhole size={17} /><input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(event) => updateField('password', event.target.value)} placeholder="Enter your password" autoComplete={isSignup ? 'new-password' : 'current-password'} minLength={8} required /><button type="button" className="auth-visibility" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>
            </label>

            {!isSignup && <div className="auth-form-row"><label className="auth-check"><input type="checkbox" /><span />Keep me signed in</label><button type="button" className="auth-text-button" onClick={() => setNotice('Password recovery will be available when the account service is connected.')}>Forgot password?</button></div>}
            {notice && <div className="auth-notice auth-notice-error" role="alert">{notice}</div>}
            <button type="submit" className="auth-submit" disabled={submitting}>{submitting ? 'Connecting...' : isSignup ? 'Create workspace' : 'Enter workspace'} {!submitting && <ArrowRight size={17} />}</button>
          </form>

          <div className="auth-divider"><span>protected workspace</span></div>
          <div className="auth-security-note"><ShieldCheck size={16} /><span>Scope confirmation is required before every reconnaissance run.</span></div>
          <p className="auth-legal">By continuing, you agree to use DarkMatter only on systems you are explicitly authorized to test.</p>
        </div>
      </section>
    </main>
  );
};
