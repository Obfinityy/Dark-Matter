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
import { Server, Check, Loader2, Cpu, ShieldCheck } from 'lucide-react';
import {
  getBackendUrl, getBackendUrlSource, isLocalBackend, testBackendConnection
} from '../../services/backendMode';
import {
  getPermissionMode, setPermissionMode,
  syncPermissionModeToServer, loadPermissionModeFromServer,
  PERMISSION_MODES, PERMISSION_LABELS, PERMISSION_DESCRIPTIONS,
} from '../../services/permissions';
import { getProviders } from '../../services/api';
import './Settings.css';

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
    <div className="sg-settings">
      <h2 className="sg-h1 sg-settings-title">Settings</h2>

      {/* ── Backend ── */}
      <section className="sg-card sg-card-pad" aria-labelledby="sg-set-backend">
        <h3 className="sg-h2 sg-settings-sec-title" id="sg-set-backend">Backend</h3>
        <p className="sg-body">
          The app talks to one backend — decided by <code>VITE_BACKEND_URL</code> in the{' '}
          <code>.env</code> file. Not set? Then it uses your local backend on port 4000.
        </p>
        <div className="sg-backend-info" role="status" aria-label="Active backend">
          <Server size={20} aria-hidden="true" />
          <div>
            <div><code>{backendUrl}</code></div>
            <small className="sg-small">
              {backendSource === 'env'
                ? 'from VITE_BACKEND_URL in .env'
                : 'default — set VITE_BACKEND_URL in .env to point elsewhere'}
              {' '}· {isLocalBackend() ? 'your machine' : 'remote backend'}
            </small>
          </div>
          <Check size={16} className="sg-check" aria-hidden="true" />
        </div>
        {!isLocalBackend() && (
          <p className="sg-small">
            💻 Local backend chahiye? <code>.env</code> me se <code>VITE_BACKEND_URL</code> hatao
            aur <code>backend/</code> folder me <code>npm start</code> chalao.
          </p>
        )}

        <button className="sg-btn sg-btn-ghost" onClick={testNow} disabled={testing}>
          {testing ? <Loader2 size={15} className="sg-spin" /> : null}
          Test connection
        </button>
        <div aria-live="polite">
          {testResult && (
            <p className={`sg-test-result ${testResult.ok ? 'ok' : 'fail'}`}>
              {testResult.ok ? '✅' : '❌'} {testResult.message}
            </p>
          )}
        </div>
      </section>

      {/* ── Brain / Models ── */}
      <section className="sg-card sg-card-pad" aria-labelledby="sg-set-brain">
        <h3 className="sg-h2 sg-settings-sec-title" id="sg-set-brain"><Cpu size={18} aria-hidden="true" /> Brain</h3>
        <p className="sg-body">
          The same brain powers both Hunt and Infinity AI.
        </p>
        {providers ? (
          <div className="sg-brain-info">
            <p>Active provider: <strong>{providers.active || 'default'}</strong></p>
            <p className="sg-small">
              Connect a Kaggle/Colab GPU or run a local model from the Models page.
            </p>
          </div>
        ) : (
          <div className="sg-brain-skeleton" aria-hidden="true"><span /><span /></div>
        )}
        <Link to="/agent/models" className="sg-btn sg-btn-ghost">Open Models →</Link>
      </section>

      {/* ── Agent permissions ── */}
      <section className="sg-card sg-card-pad" aria-labelledby="sg-set-perms">
        <h3 className="sg-h2 sg-settings-sec-title" id="sg-set-perms">
          <ShieldCheck size={18} aria-hidden="true" /> Agent permissions
        </h3>
        <p className="sg-body">
          How much freedom does the agent get? This is honored by every worker —
          hunt engine, computer control, and tool runners.
        </p>
        <div className="sg-backend-switch" role="group" aria-label="Agent permission mode">
          {[PERMISSION_MODES.ASK, PERMISSION_MODES.FULL].map((m) => (
            <button
              type="button"
              key={m}
              className={`sg-backend-opt${permissionMode === m ? ' sg-active' : ''}`}
              aria-pressed={permissionMode === m}
              onClick={() => choosePermissionMode(m)}
              disabled={syncingPerms}
            >
              <ShieldCheck size={22} />
              <span>{PERMISSION_LABELS[m]}</span>
              <small>{PERMISSION_DESCRIPTIONS[m]}</small>
              {permissionMode === m && <Check size={16} className="sg-check" />}
            </button>
          ))}
        </div>
        {syncingPerms && (
          <p className="sg-small">🔄 Syncing with backend…</p>
        )}
      </section>
    </div>
  );
}
