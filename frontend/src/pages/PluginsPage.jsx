import React, { useEffect, useState } from 'react';
import { listProviders, saveProvider, listModels, downloadModel } from '../lib/api';
import { toast } from '../lib/toast';

// Default field schemas per provider id. If the backend returns its own
// `fields` array for a provider, that takes precedence over these presets.
const FIELD_PRESETS = {
  groq: [{ key: 'apiKey', label: 'API key', type: 'password' }],
  gemini: [{ key: 'apiKey', label: 'API key', type: 'password' }],
  nvidia: [{ key: 'apiKey', label: 'API key', type: 'password' }],
  openrouter: [{ key: 'apiKey', label: 'API key', type: 'password' }],
  deepseek: [{ key: 'apiKey', label: 'API key', type: 'password' }],
  custom: [
    { key: 'baseUrl', label: 'Base URL (OpenAI-compatible)', type: 'text', placeholder: 'https://api.example.com/v1' },
    { key: 'apiKey', label: 'API key (optional)', type: 'password' },
    { key: 'model', label: 'Model name', type: 'text', placeholder: 'my-model' },
  ],
  aws: [
    { key: 'region', label: 'AWS region', type: 'text', placeholder: 'us-east-1' },
    { key: 'accessKeyId', label: 'Access key ID', type: 'password' },
    { key: 'secretAccessKey', label: 'Secret access key', type: 'password' },
  ],
  local: [
    { key: 'baseUrl', label: 'Ollama base URL', type: 'text', placeholder: 'http://localhost:11434' },
  ],
};

const PROVIDER_ORDER = ['groq', 'gemini', 'nvidia', 'openrouter', 'deepseek', 'custom', 'aws', 'local'];

const KEY_PAGE_HINTS = {
  groq: 'Create a key at console.groq.com → API Keys.',
  gemini: 'Create a key at Google AI Studio → Get API key.',
  nvidia: 'Create a key at build.nvidia.com → API keys.',
  openrouter: 'Create a key at openrouter.ai → Keys.',
  deepseek: 'Create a key at platform.deepseek.com → API keys.',
};

function statusMeta(provider) {
  const s = String(provider.status || (provider.configured ? 'connected' : 'not_configured')).toLowerCase();
  if (s === 'connected' || s === 'configured' || s === 'ok') return { cls: 'dot-green', label: 'Connected' };
  if (s === 'error' || s === 'invalid') return { cls: 'dot-red', label: 'Error' };
  return { cls: 'dot-gray', label: 'Not configured' };
}

function ProviderCard({ provider, onSaved }) {
  const fields = provider.fields && provider.fields.length > 0
    ? provider.fields
    : FIELD_PRESETS[provider.id] || [{ key: 'apiKey', label: 'API key', type: 'password' }];
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(false);
  const meta = statusMeta(provider);

  function setField(key, value) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(testing) {
    setBusy(true);
    const res = await saveProvider(provider.id, { ...values, test: testing === true });
    setBusy(false);
    if (res.ok) {
      toast(testing ? 'Connection test passed.' : 'Provider saved.', 'success');
      setValues({});
      onSaved && onSaved();
    } else {
      toast(res.error || (testing ? 'Connection test failed.' : 'Could not save the provider.'), 'error');
    }
  }

  return (
    <div className="provider-card">
      <div className="provider-head">
        <span className={`status-dot ${meta.cls}`} aria-hidden="true" />
        <div>
          <div className="provider-name">{provider.name || provider.id}</div>
          <div className="provider-status">{meta.label}</div>
        </div>
      </div>
      {KEY_PAGE_HINTS[provider.id] && (
        <div className="provider-hint">{KEY_PAGE_HINTS[provider.id]} Keys are stored on the backend and never shown again.</div>
      )}
      {fields.map((f) => (
        <label key={f.key} className="field-label">
          {f.label}
          <input
            className="text-input"
            type={f.type === 'password' ? 'password' : 'text'}
            placeholder={f.placeholder || ''}
            value={values[f.key] || ''}
            onChange={(e) => setField(f.key, e.target.value)}
            autoComplete="off"
          />
        </label>
      ))}
      <div className="provider-actions">
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => handleSave(false)}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => handleSave(true)}>
          Test
        </button>
      </div>
    </div>
  );
}

export default function PluginsPage() {
  const [providers, setProviders] = useState([]);
  const [providersError, setProvidersError] = useState('');
  const [models, setModels] = useState([]);
  const [modelsError, setModelsError] = useState('');
  const [downloading, setDownloading] = useState(null);

  const loadProviders = async () => {
    const res = await listProviders();
    if (res.ok) {
      const list = Array.isArray(res.data) ? res.data : res.data.providers || [];
      setProviders(list);
      setProvidersError('');
    } else {
      setProviders([]);
      setProvidersError(res.error || 'Could not load providers.');
    }
  };

  const loadModels = async () => {
    const res = await listModels();
    if (res.ok) {
      const list = Array.isArray(res.data) ? res.data : res.data.models || [];
      setModels(list);
      setModelsError('');
    } else {
      setModels([]);
      setModelsError(res.error || 'Could not load models.');
    }
  };

  useEffect(() => {
    loadProviders();
    loadModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ordered = [...providers].sort(
    (a, b) => PROVIDER_ORDER.indexOf(a.id) - PROVIDER_ORDER.indexOf(b.id),
  );

  async function handleDownload(modelId) {
    setDownloading(modelId);
    const res = await downloadModel(modelId);
    setDownloading(null);
    if (res.ok) {
      toast('Download started. The model will appear as ready once it finishes.', 'success');
      loadModels();
    } else {
      toast(res.error || 'Could not start the download.', 'error');
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>Plugins</h1>
        <p className="page-sub">Connect any AI provider, or download a model to run locally.</p>
      </header>

      <h2 className="section-title">AI providers</h2>
      {providersError && <div className="alert alert-error">{providersError}</div>}
      <div className="provider-grid">
        {ordered.map((p) => (
          <ProviderCard key={p.id} provider={p} onSaved={loadProviders} />
        ))}
      </div>
      {providers.length === 0 && !providersError && (
        <div className="empty-hint">Loading providers…</div>
      )}

      <h2 className="section-title">Downloadable models</h2>
      <p className="page-sub">
        Models run on your own machine. You can also connect a provider above through its
        website instead — create the key there and paste it into the matching card.
      </p>
      {modelsError && <div className="alert alert-error">{modelsError}</div>}
      <div className="model-list">
        {models.map((m) => (
          <div key={m.id || m.modelId} className="model-row">
            <div className="model-info">
              <div className="model-name">{m.name || m.id}</div>
              <div className="model-meta">
                {[m.size, m.downloaded ? 'Downloaded' : 'Not downloaded'].filter(Boolean).join(' · ')}
              </div>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              disabled={downloading === (m.id || m.modelId) || m.downloaded}
              onClick={() => handleDownload(m.id || m.modelId)}
            >
              {m.downloaded ? 'Ready' : downloading === (m.id || m.modelId) ? 'Starting…' : 'Download'}
            </button>
          </div>
        ))}
      </div>
      {models.length === 0 && !modelsError && (
        <div className="empty-hint">Loading models…</div>
      )}
    </div>
  );
}
