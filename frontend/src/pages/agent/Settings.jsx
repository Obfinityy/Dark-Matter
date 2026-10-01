/**
 * Settings — dead simple.
 *
 *   Backend:  [ Cloud ☁️ ] [ Localhost 💻 ]  — one click to switch
 *   Models:   pick your brain (local / Kaggle / Colab)
 *
 * That's it. No clutter.
 */
import React, { useState, useEffect } from 'react';
import { Cloud, Monitor, Check, Loader2, Cpu } from 'lucide-react';
import {
  getBackendMode, setBackendMode, getVercelBackendUrl, setVercelBackendUrl,
  testBackendConnection, BACKEND_MODES
} from '../../services/backendMode';
import { getProviders } from '../../services/api';
import './Settings.css';

export function Settings() {
  const [mode, setMode] = useState(getBackendMode());
  const [vercelUrl, setVercelUrl] = useState(getVercelBackendUrl() || '');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [providers, setProviders] = useState(null);

  useEffect(() => {
    getProviders().then(setProviders).catch(() => {});
  }, []);

  const switchMode = async (newMode) => {
    setBackendMode(newMode);
    setMode(newMode);
    setTestResult(null);
    // Auto-test the new backend
    setTesting(true);
    try {
      const r = await testBackendConnection();
      setTestResult(r);
    } finally {
      setTesting(false);
    }
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
          >
            <Monitor size={22} />
            <span>Localhost</span>
            <small>Full power, your machine</small>
            {mode === BACKEND_MODES.LOCALHOST && <Check size={16} className="sg-check" />}
          </button>
        </div>

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
        {testResult && (
          <p className={`sg-test-result ${testResult.ok ? 'ok' : 'fail'}`}>
            {testResult.ok ? '✅' : '❌'} {testResult.message}
          </p>
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
    </div>
  );
}
