/**
 * ModelLibrary — "Run Locally": the uncensored local model library (issue #3).
 *
 * One library, two sections:
 *   1. Curated catalog — the approved uncensored models (30B default, 8B/70B
 *      tiers), each with a one-click download showing LIVE progress.
 *   2. Custom models — the user's own Ollama tags or endpoints.
 *
 * The "Plugins" sidebar entry lands here (library home); activating a model
 * switches the agent's brain for future reasoning steps.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  Cpu, Download, Check, X, Loader2, Plus, Trash2, Zap, AlertTriangle,
  Server, BookOpen
} from 'lucide-react';
import {
  getModelLibrary, getLocalModelStatus, getModelInstallGuide,
  pullModel, cancelPull, subscribeToPullStream,
  removeLocalModel, activateModel, deactivateModel,
  addCustomModel, removeCustomModel
} from '../../services/api';

function ProgressBar({ value }) {
  return (
    <div className="dm-progress">
      <div className="dm-progress-fill" style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  );
}

export function ModelLibrary() {
  const [library, setLibrary] = useState([]);
  const [status, setStatus] = useState(null);
  const [guide, setGuide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pull, setPull] = useState(null); // { modelId, progress, status }
  const [customForm, setCustomForm] = useState({ name: '', ollamaTag: '', endpointUrl: '' });
  const [customBusy, setCustomBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [lib, st] = await Promise.all([
        getModelLibrary().catch(() => null),
        getLocalModelStatus().catch(() => null)
      ]);
      if (lib?.models) setLibrary(lib.models);
      else if (Array.isArray(lib)) setLibrary(lib);
      if (st) {
        setStatus(st);
        if (st.pull) setPull(st.pull);
      }
    } catch (err) {
      setError(err.message || 'Could not load the model library.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Live pull progress.
  useEffect(() => {
    const unsubscribe = subscribeToPullStream({
      onEvent: (event) => {
        const type = event.__sseType;
        if (type === 'pull.progress') setPull((prev) => ({ ...(prev || {}), ...event.data, status: 'pulling' }));
        if (type === 'pull.done') { setPull(null); refresh(); }
        if (type === 'pull.error') { setPull((prev) => ({ ...(prev || {}), status: 'error', error: event.data?.error })); }
      },
      onError: () => {}
    });
    return () => unsubscribe?.();
  }, [refresh]);

  const startPull = async (modelId) => {
    setError('');
    try {
      const body = await pullModel(modelId);
      setPull({ modelId, progress: 0, status: 'starting', ...(body?.pull || {}) });
    } catch (err) {
      setError(err.code === 'OLLAMA_NOT_RUNNING'
        ? 'Ollama is not running on this machine. See the setup guide below.'
        : (err.message || 'Could not start the download.'));
    }
  };

  const activate = async (payload) => {
    setError('');
    try {
      await activateModel(payload);
      refresh();
    } catch (err) {
      setError(err.message || 'Could not activate the model.');
    }
  };

  const addCustom = async (e) => {
    e.preventDefault();
    if (!customForm.name.trim()) return;
    setCustomBusy(true);
    try {
      await addCustomModel({
        name: customForm.name.trim(),
        ollamaTag: customForm.ollamaTag.trim() || undefined,
        endpointUrl: customForm.endpointUrl.trim() || undefined
      });
      setCustomForm({ name: '', ollamaTag: '', endpointUrl: '' });
      refresh();
    } catch (err) {
      setError(err.message || 'Could not add the custom model.');
    } finally {
      setCustomBusy(false);
    }
  };

  const showGuide = async () => {
    if (guide) { setGuide(null); return; }
    try {
      const body = await getModelInstallGuide();
      setGuide(body?.guide || body);
    } catch {
      setGuide({ steps: ['Install Ollama from https://ollama.com', 'Run `ollama serve`', 'Return here and download a model.'] });
    }
  };

  if (loading) return <div className="dm-page-loading"><Loader2 size={18} className="dm-spin" /> Loading model library…</div>;

  const installed = new Set(status?.installed || []);
  const active = status?.active || null;
  const isActive = (modelId) => active?.modelId === modelId;

  return (
    <div className="dm-models">
      <header className="dm-page-head">
        <div>
          <h1><Cpu size={22} /> Model Library</h1>
          <p>Run the agent's brain on <strong>your</strong> machine via Ollama — uncensored, private, no rate limits on the reasoning loop.</p>
        </div>
        <button className="dm-btn-secondary" onClick={showGuide}>
          <BookOpen size={14} /> {guide ? 'Hide setup guide' : 'Ollama setup guide'}
        </button>
      </header>

      {error && <div className="dm-form-error" role="alert"><AlertTriangle size={14} /> {error}</div>}

      {status && !status.ollamaRunning && (
        <div className="dm-warn-banner">
          <Server size={16} />
          <span>Ollama isn't reachable. Install it and run <code>ollama serve</code>, then download a model below.</span>
        </div>
      )}

      {guide && (
        <div className="dm-guide-card">
          <h3>Run Ollama locally</h3>
          <ol>{(guide.steps || []).map((step, i) => <li key={i}>{step}</li>)}</ol>
        </div>
      )}

      <h2 className="dm-section-title">Curated uncensored models</h2>
      <div className="dm-model-grid">
        {library.map((model) => {
          const id = model.id || model.modelId;
          const ready = installed.has(id) || model.installed;
          const pulling = pull && pull.modelId === id && pull.status !== 'error';
          return (
            <div key={id} className={`dm-model-card ${isActive(id) ? 'active' : ''} ${model.default ? 'default' : ''}`}>
              <div className="dm-model-top">
                <h3>{model.name || id}</h3>
                {model.default && <span className="dm-model-default">default</span>}
                {isActive(id) && <span className="dm-model-active"><Zap size={12} /> active brain</span>}
              </div>
              <p className="dm-model-desc">{model.description || model.ollamaTag || ''}</p>
              <div className="dm-model-meta">
                {model.parameters && <span>{model.parameters} params</span>}
                {model.size && <span>{model.size}</span>}
                {model.tier && <span>tier: {model.tier}</span>}
              </div>

              {pulling ? (
                <div className="dm-pull-progress">
                  <ProgressBar value={pull.progress || 0} />
                  <span>{Math.round((pull.progress || 0) * 100)}% — downloading…</span>
                  <button className="dm-btn-ghost" onClick={cancelPull}><X size={13} /> Cancel</button>
                </div>
              ) : pull?.status === 'error' && pull.modelId === id ? (
                <div className="dm-form-error"><AlertTriangle size={13} /> {pull.error || 'Download failed.'}</div>
              ) : ready ? (
                <div className="dm-model-actions">
                  {isActive(id) ? (
                    <button className="dm-btn-ghost" onClick={deactivateModel}><Check size={14} /> Active</button>
                  ) : (
                    <button className="dm-btn-primary" onClick={() => activate({ modelId: id })}>
                      <Zap size={14} /> Use as brain
                    </button>
                  )}
                  <button className="dm-btn-ghost" onClick={() => { if (window.confirm(`Remove ${id}?`)) removeLocalModel(id).then(refresh); }} title="Remove downloaded model">
                    <Trash2 size={14} />
                  </button>
                </div>
              ) : (
                <button className="dm-btn-secondary" onClick={() => startPull(id)}>
                  <Download size={14} /> Download
                </button>
              )}
            </div>
          );
        })}
      </div>

      <h2 className="dm-section-title">Custom models</h2>
      <div className="dm-custom-models">
        {(status?.customModels || []).map((custom) => (
          <div key={custom.id} className="dm-custom-row">
            <div>
              <strong>{custom.name}</strong>
              <span className="dm-custom-sub">{custom.ollamaTag || custom.endpointUrl}</span>
            </div>
            <div className="dm-model-actions">
              <button className="dm-btn-ghost" onClick={() => activate({ provider: 'custom', customId: custom.id })}>
                <Zap size={13} /> Use as brain
              </button>
              <button className="dm-btn-ghost" onClick={() => { if (window.confirm(`Remove ${custom.name}?`)) removeCustomModel(custom.id).then(refresh); }}>
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
        <form className="dm-custom-form" onSubmit={addCustom}>
          <h4><Plus size={14} /> Add a custom model</h4>
          <input
            value={customForm.name}
            onChange={(e) => setCustomForm({ ...customForm, name: e.target.value })}
            placeholder="Display name — e.g. My fine-tuned hunter"
            required
          />
          <input
            value={customForm.ollamaTag}
            onChange={(e) => setCustomForm({ ...customForm, ollamaTag: e.target.value })}
            placeholder="Ollama tag — e.g. my-hunter:latest"
            spellCheck={false}
          />
          <input
            value={customForm.endpointUrl}
            onChange={(e) => setCustomForm({ ...customForm, endpointUrl: e.target.value })}
            placeholder="…or an OpenAI-compatible endpoint URL"
            spellCheck={false}
          />
          <button type="submit" className="dm-btn-secondary" disabled={customBusy}>
            {customBusy ? <Loader2 size={14} className="dm-spin" /> : <Plus size={14} />} Add model
          </button>
        </form>
      </div>
    </div>
  );
}
