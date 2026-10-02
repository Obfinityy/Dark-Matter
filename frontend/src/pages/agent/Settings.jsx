/**
 * Settings — dead simple.
 *
 *   Backend:  [ Cloud ☁️ ] [ Localhost 💻 ]  — one click to switch
 *   Models:   pick your brain (local / Kaggle / Colab)
 *
 * That's it. No clutter.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cloud, Monitor, Check, Loader2, Cpu, ShieldCheck } from 'lucide-react';
import {
  getBackendMode, setBackendMode, getVercelBackendUrl, setVercelBackendUrl,
  testBackendConnection, testBackendConnectionFor, BACKEND_MODES
} from '../../services/backendMode';
import {
  getPermissionMode, setPermissionMode,
  syncPermissionModeToServer, loadPermissionModeFromServer,
  PERMISSION_MODES, PERMISSION_LABELS, PERMISSION_DESCRIPTIONS,
} from '../../services/permissions';
import { getProviders, getCurrentUser } from '../../services/api';
import { useAuth } from '../../auth/AuthContext';
import './Settings.css';

export function Settings() {
  const [mode, setMode] = useState(getBackendMode());
  const [vercelUrl, setVercelUrl] = useState(getVercelBackendUrl() || '');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [checkingLocal, setCheckingLocal] = useState(false);
  const [providers, setProviders] = useState(null);
  const [permissionMode, setPermissionModeState] = useState(getPermissionMode());
  const [syncingPerms, setSyncingPerms] = useState(false);
  const { logout } = useAuth();
  const navigate = useNavigate();

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

  const switchMode = async (newMode) => {
    if (newMode === mode || testing) return;
    setTestResult(null);

    // ── Localhost: probe port 4000 FIRST, switch only if it's alive.
    // The app must never get stuck pointing at a backend that isn't running.
    if (newMode === BACKEND_MODES.LOCALHOST) {
      setTesting(true);
      setCheckingLocal(true);
      try {
        const probe = await testBackendConnectionFor(BACKEND_MODES.LOCALHOST, 4000);
        if (!probe.ok) {
          setTestResult({
            ok: false,
            message: 'Localhost backend nahi mil raha — port 4000 par kuch nahi chal raha. Pehle terminal me backend/ folder me `npm start` chalao, phir dobara try karo.'
          });
          return;
        }
        setBackendMode(BACKEND_MODES.LOCALHOST);
        setMode(BACKEND_MODES.LOCALHOST);
        refreshProviders();
        // The cloud JWT is only valid on localhost if both backends share
        // the same JWT_SECRET — verify the session actually works there.
        try {
          await getCurrentUser();
          setTestResult({ ok: true, message: 'Localhost backend connected — sab ready hai.' });
        } catch {
          setTestResult({
            ok: false,
            sessionMismatch: true,
            message: 'Backend mil gaya, par tumhara login is backend par valid nahi hai (JWT secret alag hai).'
          });
        }
      } finally {
        setTesting(false);
        setCheckingLocal(false);
      }
      return;
    }

    // ── Cloud is always on — switch, then confirm.
    setBackendMode(newMode);
    setMode(newMode);
    setTesting(true);
    try {
      const r = await testBackendConnection();
      setTestResult(r);
    } finally {
      setTesting(false);
    }
  };

  const handleRelogin = async () => {
    await logout();
    navigate('/login');
  };

  const saveVercelUrl = () => {
    setVercelBackendUrl(vercelUrl.trim());
    setTestResult(null);
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
      <h2 className="sg-h1" style={{ margin: "0 0 24px" }}>Settings</h2>

      {/* ── Backend ── */}
      <section className="sg-card sg-card-pad">
        <h3 className="sg-h2" style={{ margin: "0 0 10px" }}>Backend</h3>
        <p className="sg-body">
          Where should the app talk to? Cloud is always on. Localhost gives you
          the full power — hunts, computer control, local models.
        </p>
        <div className="sg-backend-switch">
          <button
            className={`sg-backend-opt${mode === BACKEND_MODES.VERCEL ? ' sg-active' : ''}`}
            onClick={() => switchMode(BACKEND_MODES.VERCEL)}
          >
            <Cloud size={22} />
            <span>Cloud</span>
            <small>Always on, anywhere</small>
            {mode === BACKEND_MODES.VERCEL && <Check size={16} className="sg-check" />}
          </button>
          <button
            className={`sg-backend-opt${mode === BACKEND_MODES.LOCALHOST ? ' sg-active' : ''}`}
            onClick={() => switchMode(BACKEND_MODES.LOCALHOST)}
            disabled={testing}
          >
            <Monitor size={22} />
            <span>Localhost</span>
            <small>Full power, your machine</small>
            {checkingLocal
              ? <Loader2 size={16} className="sg-spin sg-check" />
              : mode === BACKEND_MODES.LOCALHOST && <Check size={16} className="sg-check" />}
          </button>
        </div>
        {checkingLocal && (
          <p className="sg-small">🔍 Localhost backend check ho raha hai (port 4000)…</p>
        )}

        {mode === BACKEND_MODES.VERCEL && (
          <div className="sg-vercel-url">
            <label>Cloud backend URL</label>
            <div className="sg-vercel-row">
              <input className="sg-input"
                value={vercelUrl}
                onChange={(e) => setVercelUrl(e.target.value)}
                placeholder="https://your-backend.vercel.app"
              />
              <button className="sg-btn sg-btn-primary" onClick={saveVercelUrl}>Save</button>
            </div>
          </div>
        )}

        {mode === BACKEND_MODES.LOCALHOST && (
          <p className="sg-small">
            💻 Run <code>npm start</code> in the <code>backend/</code> folder, then you're good.
          </p>
        )}

        <button className="sg-btn sg-btn-ghost" onClick={testNow} disabled={testing}>
          {testing ? <Loader2 size={15} className="sg-spin" /> : null}
          Test connection
        </button>
        {testResult && !testResult.sessionMismatch && (
          <p className={`sg-test-result ${testResult.ok ? 'ok' : 'fail'}`}>
            {testResult.ok ? '✅' : '❌'} {testResult.message}
          </p>
        )}
        {testResult?.sessionMismatch && (
          <div className="sg-test-result fail">
            <p>⚠️ {testResult.message}</p>
            <p className="sg-small" style={{ marginTop: 8 }}>
              Seamless switch ke liye: Vercel dashboard → backend project →
              Environment Variables me se <code>JWT_SECRET</code> copy karke apne{' '}
              <code>backend/.env</code> me daalo aur backend restart karo.
              Ya phir neeche se dobara login karo:
            </p>
            <button className="sg-btn sg-btn-primary" onClick={handleRelogin} style={{ marginTop: 8 }}>
              Logout karke dobara login karo
            </button>
          </div>
        )}
      </section>

      {/* ── Brain / Models ── */}
      <section className="sg-card sg-card-pad">
        <h3 className="sg-h2" style={{ margin: "0 0 10px", display: "flex", alignItems: "center", gap: 10 }}><Cpu size={18} /> Brain</h3>
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
          <p className="sg-small">Loading brain info…</p>
        )}
        <a href="/agent/models" className="sg-btn sg-btn-ghost">Open Models →</a>
      </section>

      {/* ── Agent permissions ── */}
      <section className="sg-card sg-card-pad">
        <h3 className="sg-h2" style={{ margin: "0 0 10px", display: "flex", alignItems: "center", gap: 10 }}>
          <ShieldCheck size={18} /> Agent permissions
        </h3>
        <p className="sg-body">
          How much freedom does the agent get? This is honored by every worker —
          hunt engine, computer control, and tool runners.
        </p>
        <div className="sg-backend-switch">
          {[PERMISSION_MODES.ASK, PERMISSION_MODES.FULL].map((m) => (
            <button
              key={m}
              className={`sg-backend-opt${permissionMode === m ? ' sg-active' : ''}`}
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
