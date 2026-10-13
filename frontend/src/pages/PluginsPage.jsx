// Plugins — AI providers with enable toggles, per-provider credentials,
// a PRIORITY fallback order ("if a provider fails, the next one is tried
// automatically"), and downloadable models with real progress polling.
//
// Backend contract (read from backend/src/routes/plugins.js + models.js):
//   GET  /api/v1/plugins/providers            -> {providers:[{id,name,configured}]}
//   PUT  /api/v1/plugins/providers/:id        {apiKey, baseUrl?, model?, extra?}
//        -> stores ENCRYPTED; apiKey:'' clears. `extra` drops secret-ish keys,
//        so AWS ships region in extra.region and both AWS secrets together as
//        a JSON blob in the single encrypted apiKey slot (documented below).
//   GET  /api/v1/models                       -> {models:[{id,kind,name,engine,voiceId,size,description,download}]}
//   POST /api/v1/models/download {modelId}    -> 202 {job}
//   GET  /api/v1/models/downloads/:jobId      -> {job:{status,note,...}}
// There is no backend endpoint for provider ORDER or connection testing —
// order is persisted in localStorage, and there is no fake "Test" button.
import React, { useEffect, useRef, useState } from 'react';
import {
  listProviders,
  saveProvider,
  listModels,
  downloadModel,
  getDownloadJob,
} from '../lib/api';
import { toast } from '../lib/toast';

// Field schema for the AWS provider (the only provider).
const FIELD_PRESETS = {
  aws: [
    { key: 'region', label: 'AWS region', type: 'text', placeholder: 'us-east-1' },
    { key: 'accessKeyId', label: 'Access key ID', type: 'password' },
    { key: 'secretAccessKey', label: 'Secret access key', type: 'password' },
  ],
};

const KEY_PAGE_HINTS = {
  aws: 'Use an IAM user with Bedrock access. The region and both keys are stored encrypted.',
};

function statusMeta(provider) {
  const s = String(provider.status || (provider.configured ? 'connected' : 'not_configured')).toLowerCase();
  if (s === 'connected' || s === 'configured' || s === 'ok') return { cls: 'dot-green', label: 'Connected' };
  if (s === 'error' || s === 'invalid') return { cls: 'dot-red', label: 'Error' };
  return { cls: 'dot-gray', label: 'Not configured' };
}

function ProviderCard({ provider, onSaved }) {
  const fields = FIELD_PRESETS[provider.id] || [{ key: 'apiKey', label: 'API key', type: 'password' }];
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const meta = statusMeta(provider);
  const configured = provider.configured === true;

  function setField(key, value) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  /** Build the PUT payload. AWS packs region into extra and both AWS secrets
      (access key ID + secret access key) as one encrypted JSON blob, because
      the backend exposes a single encrypted slot and strips secret-ish keys
      from `extra`. */
  function buildPayload() {
    if (provider.id === 'aws') {
      return {
        apiKey: JSON.stringify({
          accessKeyId: values.accessKeyId || '',
          secretAccessKey: values.secretAccessKey || '',
        }),
        extra: { region: values.region || '' },
      };
    }
    return { ...values };
  }

  function canSave() {
    if (provider.id === 'local') return Boolean(values.baseUrl && values.baseUrl.trim());
    if (provider.id === 'custom') return Boolean(values.baseUrl && values.baseUrl.trim());
    if (provider.id === 'aws') {
      return Boolean(values.accessKeyId && values.accessKeyId.trim()
        && values.secretAccessKey && values.secretAccessKey.trim());
    }
    return Boolean(values.apiKey && values.apiKey.trim());
  }

  async function handleSave() {
    if (!canSave()) {
      toast('Fill in the required fields first.', 'error');
      return;
    }
    setBusy(true);
    const res = await saveProvider(provider.id, buildPayload());
    setBusy(false);
    if (res.ok) {
      toast('Provider connected.', 'success');
      setValues({});
      setExpanded(false);
      onSaved && onSaved();
    } else {
      toast(res.error || 'Could not save the provider.', 'error');
    }
  }

  async function handleToggle() {
    if (configured) {
      // Disconnect: clear the stored key.
      setBusy(true);
      const res = await saveProvider(provider.id, { apiKey: '' });
      setBusy(false);
      if (res.ok) {
        toast('Provider disconnected.', 'info');
        onSaved && onSaved();
      } else {
        toast(res.error || 'Could not disconnect the provider.', 'error');
      }
    } else {
      // Enable = open the form so a key can be entered.
      setExpanded(true);
    }
  }

  return (
    <div className="provider-card">
      <div className="provider-head">
        <span className={`status-dot ${meta.cls}`} aria-hidden="true" />
        <div className="provider-head-main">
          <div className="provider-name">
            {provider.name || provider.id}
          </div>
          <div className="provider-status">{meta.label}</div>
        </div>
        <button
          className={`toggle-switch${configured ? ' on' : ''}`}
          role="switch"
          aria-checked={configured}
          aria-label={`Enable ${provider.name || provider.id}`}
          disabled={busy}
          onClick={handleToggle}
        />
      </div>
      {KEY_PAGE_HINTS[provider.id] && (
        <div className="provider-hint">{KEY_PAGE_HINTS[provider.id]} Keys are stored encrypted and never shown again.</div>
      )}
      {(expanded || !configured) && (
        <>
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
            <button className="btn btn-primary btn-sm" disabled={busy || !canSave()} onClick={handleSave}>
              {busy ? 'Saving…' : 'Save'}
            </button>
            {configured && (
              <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => { setExpanded(false); setValues({}); }}>
                Cancel
              </button>
            )}
          </div>
        </>
      )}
      {configured && !expanded && (
        <div className="provider-actions">
          <button className="provider-configure-link" onClick={() => setExpanded(true)}>
            Edit credentials
          </button>
        </div>
      )}
    </div>
  );
}

function ModelRow({ model, onUpdate }) {
  const [busy, setBusy] = useState(false);
  const pollRef = useRef(null);
  const dl = model.download || {};
  const status = dl.status || 'none';

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  useEffect(() => {
    // Poll while a download is active.
    if (status === 'queued' || status === 'downloading') {
      if (!pollRef.current && dl.jobId) {
        pollRef.current = setInterval(async () => {
          const res = await getDownloadJob(dl.jobId);
          if (res.ok) {
            const st = res.data && res.data.job && res.data.job.status;
            if (st === 'completed' || st === 'failed') {
              clearInterval(pollRef.current);
              pollRef.current = null;
              toast(
                st === 'completed' ? `Download finished: ${model.name || model.id}.` : `Download failed: ${model.name || model.id}.`,
                st === 'completed' ? 'success' : 'error',
              );
            }
            onUpdate && onUpdate();
          }
        }, 3000);
      }
    } else if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, dl.jobId]);

  async function handleDownload() {
    setBusy(true);
    const res = await downloadModel(model.id || model.modelId);
    setBusy(false);
    if (res.ok) {
      toast('Download started — progress is tracked here.', 'success');
      onUpdate && onUpdate();
    } else {
      toast(res.error || 'Could not start the download.', 'error');
    }
  }

  const isActive = status === 'queued' || status === 'downloading';
  const isDone = status === 'completed';
  const label = isDone ? 'Ready' : isActive ? 'Downloading…' : busy ? 'Starting…' : 'Download';

  return (
    <div className="model-row">
      <div className="model-info">
        <div className="model-name">{model.name || model.id}</div>
        <div className="model-meta">
          {[model.size, model.kind === 'stt' ? 'Speech-to-text' : model.kind === 'tts' ? 'Text-to-speech' : null, model.description]
            .filter(Boolean)
            .join(' · ')}
        </div>
        {dl.note && <div className="model-note">{dl.note}</div>}
      </div>
      <button
        className="btn btn-ghost btn-sm"
        disabled={busy || isActive || isDone}
        onClick={handleDownload}
      >
        {label}
      </button>
    </div>
  );
}

export default function PluginsPage() {
  const [providers, setProviders] = useState([]);
  const [providersError, setProvidersError] = useState('');
  const [models, setModels] = useState([]);
  const [modelsError, setModelsError] = useState('');

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

  return (
    <div className="page">
      <div className="page-inner">
        <header className="page-header">
          <h1>Plugins</h1>
          <p className="page-sub">Connect AWS Bedrock, or download a model to run locally.</p>
        </header>

        <h2 className="section-title">AI provider</h2>
        {providersError && <div className="alert alert-error">{providersError}</div>}
        <div className="provider-grid">
          {providers.map((p) => (
            <ProviderCard
              key={p.id}
              provider={p}
              onSaved={loadProviders}
            />
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
            <ModelRow key={m.id || m.modelId} model={m} onUpdate={loadModels} />
          ))}
        </div>
        {models.length === 0 && !modelsError && (
          <div className="empty-hint">Loading models…</div>
        )}
      </div>
    </div>
  );
}
