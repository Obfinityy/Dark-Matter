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
    <div className="dm-settings">
      <h2>Settings</h2>

      {/* ── Backend ── */}
      <section className="dm-settings-card">
        <h3>Backend</h3>
        <p className="dm-settings-desc">
          Where should the app talk to? Cloud is always on. Localhost gives you
          the full power — hunts, computer control, local models.
        </p>
        <div className="dm-backend-switch">
          <button
            className={`dm-backend-opt${mode === BACKEND_MODES.VERCEL ? ' active' : ''}`}
            onClick={() => switchMode(BACKEND_MODES.VERCEL)}
          >
            <Cloud size={22} />
            <span>Cloud</span>
            <small>Always on, anywhere</small>
            {mode === BACKEND_MODES.VERCEL && <Check size={16} className="dm-check" />}
          </button>
          <button
            className={`dm-backend-opt${mode === BACKEND_MODES.LOCALHOST ? ' active' : ''}`}
            onClick={() => switchMode(BACKEND_MODES.LOCALHOST)}
          >
            <Monitor size={22} />
            <span>Localhost</span>
            <small>Full power, your machine</small>
            {mode === BACKEND_MODES.LOCALHOST && <Check size={16} className="dm-check" />}
          </button>
        </div>

        {mode === BACKEND_MODES.VERCEL && (
          <div className="dm-vercel-url">
            <label>Cloud backend URL</label>
            <div className="dm-vercel-row">
              <input
                value={vercelUrl}
                onChange={(e) => setVercelUrl(e.target.value)}
                placeholder="https://your-backend.vercel.app"
              />
              <button onClick={saveVercelUrl}>Save</button>
            </div>
          </div>
        )}

        {mode === BACKEND_MODES.LOCALHOST && (
          <p className="dm-settings-hint">
            💻 Run <code>npm start</code> in the <code>backend/</code> folder, then you're good.
          </p>
        )}

        <button className="dm-test-btn" onClick={testNow} disabled={testing}>
          {testing ? <Loader2 size={15} className="dm-spin" /> : null}
          Test connection
        </button>
        {testResult && (
          <p className={`dm-test-result ${testResult.ok ? 'ok' : 'fail'}`}>
            {testResult.ok ? '✅' : '❌'} {testResult.message}
          </p>
        )}
      </section>

      {/* ── Brain / Models ── */}
      <section className="dm-settings-card">
        <h3><Cpu size={16} /> Brain</h3>
        <p className="dm-settings-desc">
          The same brain powers both Hunt and Infinity AI.
        </p>
        {providers ? (
          <div className="dm-brain-info">
            <p>Active provider: <strong>{providers.active || 'default'}</strong></p>
            <p className="dm-settings-hint">
              Connect a Kaggle/Colab GPU or run a local model from the Models page.
            </p>
          </div>
        ) : (
          <p className="dm-settings-hint">Loading brain info…</p>
        )}
        <a href="/agent/models" className="dm-link-btn">Open Models →</a>
      </section>
    </div>
  );
}
