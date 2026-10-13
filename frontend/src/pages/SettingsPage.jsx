import React, { useState } from 'react';
import {
  CLOUD_BACKEND_URL,
  DEFAULT_LOCAL_URL,
  getBackendMode,
  setBackendMode,
  getMyDeviceUrl,
  setMyDeviceUrl,
  resolveApiBase,
} from '../config';
import { health } from '../lib/api';
import { toast } from '../lib/toast';

const VOICES = [
  { id: 'aria', label: 'Aria — balanced' },
  { id: 'aria-soft', label: 'Aria Soft — calm' },
  { id: 'kai', label: 'Kai — deep' },
  { id: 'kai-deep', label: 'Kai Deep — deeper' },
];

function getVoice() {
  try {
    return localStorage.getItem('dm.voice') || 'aria';
  } catch {
    return 'aria';
  }
}

export default function SettingsPage() {
  const [mode, setMode] = useState(getBackendMode());
  const [localUrl, setLocalUrl] = useState(getMyDeviceUrl());
  const [voice, setVoice] = useState(getVoice());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // { ok, message }

  function saveBackend(nextMode, nextUrl) {
    setBackendMode(nextMode);
    if (nextUrl !== undefined) setMyDeviceUrl(nextUrl);
    setTestResult(null);
    toast('Backend setting saved. It applies immediately.', 'success');
  }

  function chooseMode(next) {
    setMode(next);
    saveBackend(next, next === 'mydevice' ? localUrl : undefined);
  }

  function saveLocalUrl() {
    const url = localUrl.trim() || DEFAULT_LOCAL_URL;
    setLocalUrl(url);
    saveBackend('mydevice', url);
  }

  function chooseVoice(id) {
    setVoice(id);
    try {
      localStorage.setItem('dm.voice', id);
    } catch { /* ignore */ }
    toast('Voice preference saved.', 'success');
  }

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    const base = resolveApiBase();
    const res = await health();
    setTesting(false);
    if (res.ok) {
      setTestResult({ ok: true, message: `Connected — the backend at ${base} is healthy.` });
    } else {
      setTestResult({
        ok: false,
        message:
          `Could not reach the backend at ${base}. ` +
          (getBackendMode() === 'mydevice'
            ? 'Make sure your local backend is running (npm start in backend/) and the URL above is correct.'
            : 'The hosted backend may be starting up or down — try again in a minute, or switch to My Device.'),
      });
    }
  }

  return (
    <div className="page">
      <div className="page-inner">
      <header className="page-header">
        <h1>Settings</h1>
        <p className="page-sub">Where the app connects, and how it talks back.</p>
      </header>

      <h2 className="section-title">Backend</h2>
      <div className="backend-cards">
        <button
          className={`backend-card${mode === 'cloud' ? ' selected' : ''}`}
          onClick={() => chooseMode('cloud')}
        >
          <div className="backend-card-title">
            Cloud
            <span className="default-badge">Default</span>
          </div>
          <div className="backend-card-desc">
            The hosted backend — available 24/7, no setup needed.
          </div>
          <div className="backend-card-url">{CLOUD_BACKEND_URL}</div>
        </button>

        <div className={`backend-card${mode === 'mydevice' ? ' selected' : ''}`}>
          <button className="backend-card-select" onClick={() => chooseMode('mydevice')}>
            <div className="backend-card-title">
              My Device
            </div>
            <div className="backend-card-desc">
              Run the backend on your own machine. Each backend keeps its own data.
            </div>
          </button>
          <label className="field-label">
            Local backend URL
            <div className="inline-row">
              <input
                className="text-input"
                value={localUrl}
                placeholder={DEFAULT_LOCAL_URL}
                onChange={(e) => setLocalUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveLocalUrl();
                }}
              />
              <button className="btn btn-ghost btn-sm" onClick={saveLocalUrl}>
                Save
              </button>
            </div>
          </label>
        </div>
      </div>

      <button className="btn btn-primary btn-sm" onClick={testConnection} disabled={testing}>
        {testing ? 'Testing…' : 'Test connection'}
      </button>
      {testResult && (
        <div className={`alert ${testResult.ok ? 'alert-success' : 'alert-error'}`}>
          {testResult.message}
        </div>
      )}

      <h2 className="section-title">Voice</h2>
      <label className="field-label" style={{ maxWidth: 360 }}>
        Spoken-reply voice
        <select className="text-input" value={voice} onChange={(e) => chooseVoice(e.target.value)}>
          {VOICES.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </label>
      <p className="page-sub">
        Toggle the speaker button in the chat input to hear replies read aloud in this voice.
      </p>
      </div>
    </div>
  );
}
