/**
 * Settings — dead simple.
 *
 *   Backend:  read-only — from VITE_BACKEND_URL (.env), else localhost:4000.
 *   Models:   pick your brain (local / Kaggle / Colab)
 *
 * That's it. No clutter.
 *
 * Kinetic redesign (issue #292): grouped sections, kinetic title, calm labeled
 * cards. All connection logic, permission-mode sync and handlers are untouched.
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Server, Check, Loader2, Cpu, ShieldCheck, X } from 'lucide-react';
import {
  getBackendUrl,
  getBackendUrlSource,
  isLocalBackend,
  testBackendConnection,
} from '../../services/backendMode';
import {
  getPermissionMode,
  setPermissionMode,
  syncPermissionModeToServer,
  loadPermissionModeFromServer,
  PERMISSION_MODES,
  PERMISSION_LABELS,
  PERMISSION_DESCRIPTIONS,
} from '../../services/permissions';
import { getProviders } from '../../services/api';
import '../../styles/kinetic-acct.css';

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

export function Settings() {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [providers, setProviders] = useState(null);
  const [permissionMode, setPermissionModeState] = useState(getPermissionMode());
  const [syncingPerms, setSyncingPerms] = useState(false);

  const backendUrl = getBackendUrl();
  const backendSource = getBackendUrlSource(); // 'env' | 'default'

  const refreshProviders = () => {
    getProviders()
      .then(setProviders)
      .catch(() => {});
  };

  useEffect(() => {
    refreshProviders();
    // Pull the server-side mode (if any) into localStorage on load.
    loadPermissionModeFromServer()
      .then(mode => setPermissionModeState(mode))
      .catch(() => {});
  }, []);

  const choosePermissionMode = async newMode => {
    if (newMode === permissionMode || syncingPerms) return;
    setPermissionMode(newMode); // localStorage — the UI source of truth
    setPermissionModeState(newMode);
    setSyncingPerms(true);
    try {
      await syncPermissionModeToServer(); // best-effort backend sync
    } finally {
      setSyncingPerms(false);
    }
  };

  const testNow = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      setTestResult(await testBackendConnection());
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="kac-page">
      <header className="kac-head">
        <h1 className="kac-title" aria-label="Settings">
          {kineticLetters('Settings')}
        </h1>
        <p className="kac-sub">One backend, one brain, and how much freedom your agent gets.</p>
      </header>

      {/* ── Backend ── */}
      <section className="kac-card kac-in" style={{ '--kac-i': 1 }} aria-labelledby="kac-set-backend">
        <h2 className="kac-h" id="kac-set-backend" style={{ '--kac-i': 1 }}>
          <Server size={18} aria-hidden="true" /> Backend
        </h2>
        <p className="kac-body">
          The app talks to one backend — decided by <code>VITE_BACKEND_URL</code> in the{' '}
          <code>.env</code> file. Not set? Then it uses your local backend on port 4000.
        </p>
        <div className="kac-notice" role="status" aria-label="Active backend">
          <Server size={16} className="kac-notice-icon" aria-hidden="true" />
          <div className="kac-notice-main">
            <code className="kac-code">{backendUrl}</code>
            <p className="kac-notice-sub">
              {backendSource === 'env'
                ? 'from VITE_BACKEND_URL in .env'
                : 'default — set VITE_BACKEND_URL in .env to point elsewhere'}{' '}
              · {isLocalBackend() ? 'your machine' : 'remote backend'}
            </p>
          </div>
          <Check size={16} className="kac-notice-check" aria-hidden="true" />
        </div>
        {!isLocalBackend() && (
          <p className="kac-hint">
            To use the local backend, remove <code>VITE_BACKEND_URL</code> from <code>.env</code>
            and run <code>npm start</code> inside the <code>backend/</code> directory.
          </p>
        )}
        <div className="kac-mt">
          <button className="kac-btn kac-btn-secondary" onClick={testNow} disabled={testing}>
            {/* The spinner is the product's one allowed animation — it must spin while testing. */}
            {testing ? <Loader2 size={15} aria-hidden="true" className="sg-spin" /> : null}
            Test connection
          </button>
        </div>
        <div aria-live="polite">
          {testResult && (
            <p
              className="kac-test-result"
              style={{ color: testResult.ok ? 'var(--dm-green)' : 'var(--dm-red)' }}
            >
              {/* No emoji inside the live region — screen readers get plain words. */}
              {testResult.ok ? (
                <>
                  <Check size={15} aria-hidden="true" /> Connection OK —{' '}
                </>
              ) : (
                <>
                  <X size={15} aria-hidden="true" /> Connection failed —{' '}
                </>
              )}
              {testResult.message}
            </p>
          )}
        </div>
      </section>

      {/* ── Brain / Models ── */}
      <section className="kac-card kac-in" style={{ '--kac-i': 2 }} aria-labelledby="kac-set-brain">
        <h2 className="kac-h" id="kac-set-brain" style={{ '--kac-i': 2 }}>
          <Cpu size={18} aria-hidden="true" /> Brain
        </h2>
        <p className="kac-body">The same brain powers both Hunt AI and Infinity AI.</p>
        {providers ? (
          <div>
            <p className="kac-body" style={{ marginBottom: 4 }}>
              Active provider: <strong className="kac-strong">{providers.active || 'default'}</strong>
            </p>
            <p className="kac-hint" style={{ marginTop: 0 }}>
              Connect a Kaggle/Colab GPU or run a local model from the Models page.
            </p>
          </div>
        ) : (
          <p className="kac-muted">Loading…</p>
        )}
        <div className="kac-mt">
          <Link to="/agent/models" className="kac-btn kac-btn-secondary">
            Open Models →
          </Link>
        </div>
      </section>

      {/* ── Agent permissions ── */}
      <section className="kac-card kac-in" style={{ '--kac-i': 3 }} aria-labelledby="kac-set-perms">
        <h2 className="kac-h" id="kac-set-perms" style={{ '--kac-i': 3 }}>
          <ShieldCheck size={18} aria-hidden="true" /> Agent permissions
        </h2>
        <p className="kac-body">
          How much freedom does the agent get? This is honored by every worker — hunt engine,
          computer control, and tool runners.
        </p>
        <div className="kac-perm-grid" role="group" aria-label="Agent permission mode">
          {[PERMISSION_MODES.ASK, PERMISSION_MODES.FULL].map(m => {
            const active = permissionMode === m;
            return (
              <button
                type="button"
                key={m}
                aria-pressed={active}
                onClick={() => choosePermissionMode(m)}
                disabled={syncingPerms}
                className="kac-perm"
              >
                <span className="kac-perm-title">
                  <ShieldCheck size={20} aria-hidden="true" /> {PERMISSION_LABELS[m]}
                  {active && <Check size={16} aria-hidden="true" />}
                </span>
                <span className="kac-perm-desc">{PERMISSION_DESCRIPTIONS[m]}</span>
              </button>
            );
          })}
        </div>
        {syncingPerms && <p className="kac-hint">Syncing with backend…</p>}
      </section>
    </div>
  );
}
