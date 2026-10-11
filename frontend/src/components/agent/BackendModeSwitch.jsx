/**
 * BackendModeSwitch — Cloud vs "My Device" backend selector.
 *
 * The app can run against the hosted cloud backend (default) or the backend
 * on the user's own machine. Switching is instant: the API base, auth token
 * scope, and connection indicators all follow the active mode.
 *
 * Part of: Dark Matter frontend (Hunt AI).
 */
import { useState, useEffect, useCallback } from 'react';
import {
  getBackendMode,
  setBackendMode,
  getLocalBackendUrl,
  setLocalBackendUrl,
  testBackendConnection,
  BACKEND_MODE_CHANGED_EVENT,
  CLOUD_BACKEND_URL,
} from '../../services/backendMode.js';

export default function BackendModeSwitch({ compact = false, showUrlEditor = false }) {
  const [mode, setMode] = useState(() => getBackendMode());
  const [localUrl, setLocalUrl] = useState(() => getLocalBackendUrl());
  const [status, setStatus] = useState(null); // { ok, message }
  const [checking, setChecking] = useState(false);
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');

  const refreshStatus = useCallback(async () => {
    setChecking(true);
    setStatus(null);
    const result = await testBackendConnection(8000);
    setStatus(result);
    setChecking(false);
  }, []);

  useEffect(() => {
    refreshStatus();
    const onChange = e => {
      setMode(e?.detail?.mode || getBackendMode());
      refreshStatus();
    };
    window.addEventListener(BACKEND_MODE_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(BACKEND_MODE_CHANGED_EVENT, onChange);
  }, [refreshStatus]);

  const switchMode = next => {
    setBackendMode(next);
    setMode(next);
  };

  const saveUrl = () => {
    const clean = urlDraft.trim().replace(/\/+$/, '');
    if (!clean) return;
    setLocalBackendUrl(clean);
    setLocalUrl(getLocalBackendUrl());
    setEditingUrl(false);
  };

  const switchStyle = {
    display: 'inline-flex',
    background: 'var(--dm-surface-2)',
    border: '1px solid var(--dm-border)',
    borderRadius: '10px',
    padding: '3px',
    gap: '2px',
  };
  const btnStyle = active => ({
    border: 'none',
    borderRadius: '7px',
    padding: compact ? '5px 10px' : '7px 14px',
    fontSize: 'var(--dm-text-sm)',
    fontWeight: 600,
    cursor: 'pointer',
    background: active ? 'var(--dm-gold)' : 'transparent',
    color: active ? '#0a0a0a' : 'var(--dm-text-2)',
    whiteSpace: 'nowrap',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 'var(--dm-text-sm)', color: 'var(--dm-text-2)', whiteSpace: 'nowrap' }}>
          Backend:
        </span>
        <div style={switchStyle} role="tablist" aria-label="Backend mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'cloud'}
            style={btnStyle(mode === 'cloud')}
            onClick={() => switchMode('cloud')}
            title={`Hosted backend (${CLOUD_BACKEND_URL}) — runs 24/7`}
          >
            ☁️ Cloud
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'local'}
            style={btnStyle(mode === 'local')}
            onClick={() => switchMode('local')}
            title={`Your own machine (${localUrl}) — backend + Kali VM run locally`}
          >
            💻 My Device
          </button>
        </div>
        <button
          type="button"
          onClick={refreshStatus}
          disabled={checking}
          style={{
            background: 'transparent',
            border: '1px solid var(--dm-border)',
            borderRadius: '8px',
            padding: compact ? '4px 8px' : '6px 10px',
            fontSize: 'var(--dm-text-sm)',
            color: 'var(--dm-text-2)',
            cursor: checking ? 'wait' : 'pointer',
          }}
          title="Test the backend connection"
        >
          {checking ? '…' : '↻ Test'}
        </button>
      </div>

      {status && (
        <div
          role="status"
          style={{
            fontSize: 'var(--dm-text-sm)',
            color: status.ok ? 'var(--dm-green, #4ade80)' : 'var(--dm-red, #f87171)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span>{status.ok ? '●' : '○'}</span>
          <span>{status.message}</span>
        </div>
      )}

      {mode === 'local' && !status?.ok && !checking && (
        <div style={{ fontSize: 'var(--dm-text-sm)', color: 'var(--dm-text-2)' }}>
          Start the Dark Matter backend on your own machine first (or paste its
          tunnel link above), then press Test.
        </div>
      )}

      {showUrlEditor && mode === 'local' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {editingUrl ? (
            <>
              <input
                value={urlDraft}
                onChange={e => setUrlDraft(e.target.value)}
                placeholder="http://localhost:4000"
                style={{
                  background: 'var(--dm-surface-2)',
                  color: 'var(--dm-text-1)',
                  border: '1px solid var(--dm-border)',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  fontSize: 'var(--dm-text-sm)',
                  minWidth: '220px',
                }}
                aria-label="Local backend URL"
              />
              <button
                type="button"
                onClick={saveUrl}
                style={{
                  background: 'var(--dm-gold)',
                  color: '#0a0a0a',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: 'var(--dm-text-sm)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditingUrl(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--dm-border)',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: 'var(--dm-text-sm)',
                  color: 'var(--dm-text-2)',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setUrlDraft(localUrl);
                setEditingUrl(true);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--dm-text-2)',
                fontSize: 'var(--dm-text-sm)',
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: 0,
              }}
              title="Change the local backend URL"
            >
              {localUrl} — change
            </button>
          )}
        </div>
      )}
    </div>
  );
}
