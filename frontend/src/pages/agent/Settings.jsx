/**
 * Settings — dead simple.
 *
 *   Backend:  read-only — from VITE_BACKEND_URL (.env), else localhost:4000.
 *   Models:   pick your brain (local / Kaggle / Colab)
 *
 * That's it. No clutter.
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Server, Check, Loader2, Cpu, ShieldCheck, X } from 'lucide-react';
import {
  getBackendUrl, getBackendUrlSource, isLocalBackend, testBackendConnection
} from '../../services/backendMode';
import {
  getPermissionMode, setPermissionMode,
  syncPermissionModeToServer, loadPermissionModeFromServer,
  PERMISSION_MODES, PERMISSION_LABELS, PERMISSION_DESCRIPTIONS,
} from '../../services/permissions';
import { getProviders } from '../../services/api';

export function Settings() {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [providers, setProviders] = useState(null);
  const [permissionMode, setPermissionModeState] = useState(getPermissionMode());
  const [syncingPerms, setSyncingPerms] = useState(false);

  const backendUrl = getBackendUrl();
  const backendSource = getBackendUrlSource(); // 'env' | 'default'

  const refreshProviders = () => {
    getProviders().then(setProviders).catch(() => {});
  };

  useEffect(() => {
    refreshProviders();
    // Pull the server-side mode (if any) into localStorage on load.
    loadPermissionModeFromServer().then((mode) => setPermissionModeState(mode)).catch(() => {});
  }, []);

  const choosePermissionMode = async (newMode) => {
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
    <div className="dm-container">
      <header className="dm-page-head">
        <h1 className="dm-page-title">Settings</h1>
        <p className="dm-page-sub">One backend, one brain, and how much freedom your agent gets.</p>
      </header>

      {/* ── Backend ── */}
      <section className="dm-card" aria-labelledby="dm-set-backend">
        <h2 className="dm-card-title" id="dm-set-backend">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Server size={18} aria-hidden="true" /> Backend
          </span>
        </h2>
        <p className="dm-card-sub">
          The app talks to one backend — decided by <code>VITE_BACKEND_URL</code> in the{' '}
          <code>.env</code> file. Not set? Then it uses your local backend on port 4000.
        </p>
        <div className="dm-notice" role="status" aria-label="Active backend">
          <Server size={16} className="dm-notice-icon" aria-hidden="true" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <code className="settings-backend-url">{backendUrl}</code>
            <div className="dm-muted settings-backend-src">
              {backendSource === 'env'
                ? 'from VITE_BACKEND_URL in .env'
                : 'default — set VITE_BACKEND_URL in .env to point elsewhere'}
              {' '}· {isLocalBackend() ? 'your machine' : 'remote backend'}
            </div>
          </div>
          <Check size={16} style={{ color: 'var(--dm-green)', flexShrink: 0 }} aria-hidden="true" />
        </div>
        {!isLocalBackend() && (
          <p className="dm-hint">
            💻 Local backend chahiye? <code>.env</code> me se <code>VITE_BACKEND_URL</code> hatao
            aur <code>backend/</code> folder me <code>npm start</code> chalao.
          </p>
        )}
        <div className="dm-mt-4">
          <button className="dm-btn dm-btn-secondary" onClick={testNow} disabled={testing}>
            {/* The spinner is the product's one allowed animation — it must spin while testing. */}
            {testing ? <Loader2 size={15} aria-hidden="true" className="sg-spin" /> : null}
            Test connection
          </button>
        </div>
        <div aria-live="polite">
          {testResult && (
            <p
              className="dm-mt-4 settings-test-result"
              style={{ color: testResult.ok ? 'var(--dm-green)' : 'var(--dm-red)' }}
            >
              {/* No emoji inside the live region — screen readers get plain words. */}
              {testResult.ok
                ? (<><Check size={15} aria-hidden="true" /> Connection OK — </>)
                : (<><X size={15} aria-hidden="true" /> Connection failed — </>)}
              {testResult.message}
            </p>
          )}
        </div>
      </section>

      {/* ── Brain / Models ── */}
      <section className="dm-card" aria-labelledby="dm-set-brain">
        <h2 className="dm-card-title" id="dm-set-brain">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Cpu size={18} aria-hidden="true" /> Brain
          </span>
        </h2>
        <p className="dm-card-sub">
          The same brain powers both Hunt AI and Infinity AI.
        </p>
        {providers ? (
          <div>
            <p style={{ margin: '0 0 4px', fontSize: '0.95rem' }}>
              Active provider: <strong>{providers.active || 'default'}</strong>
            </p>
            <p className="dm-hint">
              Connect a Kaggle/Colab GPU or run a local model from the Models page.
            </p>
          </div>
        ) : (
          <p className="dm-muted">Loading…</p>
        )}
        <div className="dm-mt-4">
          <Link to="/agent/models" className="dm-btn dm-btn-secondary">Open Models →</Link>
        </div>
      </section>

      {/* ── Agent permissions ── */}
      <section className="dm-card" aria-labelledby="dm-set-perms">
        <h2 className="dm-card-title" id="dm-set-perms">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={18} aria-hidden="true" /> Agent permissions
          </span>
        </h2>
        <p className="dm-card-sub">
          How much freedom does the agent get? This is honored by every worker —
          hunt engine, computer control, and tool runners.
        </p>
        <div className="dm-grid-2" role="group" aria-label="Agent permission mode">
          {[PERMISSION_MODES.ASK, PERMISSION_MODES.FULL].map((m) => {
            const active = permissionMode === m;
            return (
              <button
                type="button"
                key={m}
                aria-pressed={active}
                onClick={() => choosePermissionMode(m)}
                disabled={syncingPerms}
                className="dm-btn"
                style={{
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: 20,
                  whiteSpace: 'normal',
                  textAlign: 'left',
                  background: active ? 'var(--dm-gold-glow)' : 'var(--dm-surface-2)',
                  borderColor: active ? 'var(--dm-gold-border)' : 'var(--dm-border)',
                  color: 'var(--dm-text)',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                  <ShieldCheck size={20} aria-hidden="true" /> {PERMISSION_LABELS[m]}
                  {active && <Check size={16} style={{ color: 'var(--dm-gold-soft)' }} aria-hidden="true" />}
                </span>
                <span className="dm-muted" style={{ fontSize: '0.8rem', fontWeight: 400, lineHeight: 1.5 }}>
                  {PERMISSION_DESCRIPTIONS[m]}
                </span>
              </button>
            );
          })}
        </div>
        {syncingPerms && (
          <p className="dm-hint">🔄 Syncing with backend…</p>
        )}
      </section>
    </div>
  );
}
