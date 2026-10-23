// Plugins — hacking integrations the agent uses during hunts.
//
// Connect accounts (API keys) for recon and intel services. Keys are stored
// encrypted on the backend, never shown after save.
//
// NOTE: AI models are NOT here — AWS Bedrock is connected BY DEFAULT.

import React, { useEffect, useState } from 'react';
import { listProviders, saveProvider } from '../lib/api';
import { toast } from '../lib/toast';

function statusMeta(provider) {
  if (provider.configured) return { cls: 'dot-green', label: 'Connected' };
  return { cls: 'dot-gray', label: 'Not configured' };
}

function ProviderCard({ provider, onSaved }) {
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const meta = statusMeta(provider);
  const isBuiltIn = provider.builtIn;

  async function handleSave() {
    if (!apiKey.trim()) {
      toast('Paste your API key first.', 'error');
      return;
    }
    setBusy(true);
    const res = await saveProvider(provider.id, { apiKey: apiKey.trim() });
    setBusy(false);
    if (res.ok) {
      toast(`${provider.name} connected.`, 'success');
      setApiKey('');
      setExpanded(false);
      onSaved && onSaved();
    } else {
      toast(res.error || 'Could not save.', 'error');
    }
  }

  async function handleDisconnect() {
    setBusy(true);
    const res = await saveProvider(provider.id, { apiKey: '' });
    setBusy(false);
    if (res.ok) {
      toast(`${provider.name} disconnected.`, 'info');
      onSaved && onSaved();
    } else {
      toast(res.error || 'Could not disconnect.', 'error');
    }
  }

  return (
    <div className="provider-card">
      <div className="provider-head">
        <div>
          <div className="provider-name">{provider.name}</div>
          {provider.description && <div className="provider-desc">{provider.description}</div>}
        </div>
        <span className={`status-pill ${meta.cls === 'dot-green' ? 'status-completed' : 'status-stopped'}`}>
          <span className="dot" />{meta.label}
        </span>
      </div>
      {isBuiltIn ? (
        <p className="provider-note">Always available — no setup needed.</p>
      ) : expanded ? (
        <div className="provider-form">
          <input
            className="text-input"
            type="password"
            placeholder={provider.keyHint || 'API key'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <div className="provider-actions">
            <button className="btn btn-ghost" onClick={() => setExpanded(false)} disabled={busy}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={busy || !apiKey.trim()}>
              {busy ? 'Saving…' : 'Connect'}
            </button>
          </div>
        </div>
      ) : (
        <div className="provider-actions">
          {provider.configured ? (
            <button className="btn btn-ghost" onClick={handleDisconnect} disabled={busy}>Disconnect</button>
          ) : (
            <button className="btn btn-primary" onClick={() => setExpanded(true)}>Connect</button>
          )}
        </div>
      )}
    </div>
  );
}

export default function PluginsPage() {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  async function load() {
    setLoading(true);
    const res = await listProviders();
    setLoading(false);
    // The API client wraps every payload as { ok, data } — the
    // provider list lives at res.data.providers. This page used to
    // read res.providers (always undefined), so the list silently
    // stayed empty and the page rendered its heading with zero
    // integration cards (owner's live QA, 23 Oct 2026). Read the
    // real shape, and surface failures honestly instead of
    // swallowing them into a blank page.
    const list = res.ok && res.data && Array.isArray(res.data.providers) ? res.data.providers : null;
    if (list) {
      setProviders(list);
      setLoadError('');
    } else {
      setProviders([]);
      setLoadError(res.error || 'Could not load the integrations list.');
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="page">
      <div className="page-inner">
        <header className="page-header">
          <h1>Plugins</h1>
          <p className="page-sub">
            Hacking integrations. Connect accounts the agent uses for recon and intel during hunts.
          </p>
        </header>
        {loading ? (
          <p className="page-sub">Loading…</p>
        ) : loadError ? (
          <p className="page-sub">
            {loadError}{' '}
            <button className="btn btn-ghost btn-sm" onClick={load}>Retry</button>
          </p>
        ) : providers.length === 0 ? (
          <p className="page-sub">No integrations are available on the server right now.</p>
        ) : (
          <div className="provider-list">
            {providers.map((p) => (
              <ProviderCard key={p.id} provider={p} onSaved={load} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
