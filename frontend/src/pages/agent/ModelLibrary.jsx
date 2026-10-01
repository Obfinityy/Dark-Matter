/**
 * ModelLibrary — "Run Locally": the no-Ollama local model runner UI.
 *
 * The flow is deliberately dead simple:
 *   1. Pick a model (each card shows RAM / GPU needs and whether YOUR
 *      device can handle it — ranked automatically for this machine).
 *   2. Press Download — the .gguf file lands in the app-data folder with
 *      live progress. Nothing downloads by itself.
 *   3. Press Run — a bundled llama-server starts on localhost and the
 *      model becomes the shared brain for Hunt and Infinity AI.
 *   4. Press Stop — the model unloads and RAM/VRAM is freed.
 *
 * Users can also register any public Hugging Face GGUF of their own.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  Cpu, Download, X, Loader2, Plus, Trash2, Zap, AlertTriangle,
  Server, Play, Square, CheckCircle2, MonitorCog, HardDrive, MemoryStick,
  Cloud, Link2, Unplug, Wifi
} from 'lucide-react';
import {
  getRunnerStatus, getRunnerLibrary,
  downloadRunnerEngine, subscribeToEngineStream,
  downloadRunnerModel, cancelRunnerDownload, subscribeToDownloadStream,
  removeRunnerModel, addRunnerCustomModel,
  runRunnerModel, stopRunnerModel,
  getRemoteModelStatus, testRemoteModel, connectRemoteModel, disconnectRemoteModel
} from '../../services/api';
import './ModelLibrary.css';

function ProgressBar({ value }) {
  return (
    <div className="sg-progress">
      <div className="sg-progress-fill" style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  );
}

const VERDICT_META = {
  ready: { label: 'Ready', cls: 'verdict-ready', icon: CheckCircle2 },
  tight: { label: 'Tight fit', cls: 'verdict-tight', icon: AlertTriangle },
  risky: { label: 'Risky', cls: 'verdict-risky', icon: AlertTriangle },
  blocked: { label: "Won't run", cls: 'verdict-blocked', icon: X }
};

function VerdictBadge({ compatibility }) {
  if (!compatibility) return null;
  const meta = VERDICT_META[compatibility.verdict] || VERDICT_META.blocked;
  const Icon = meta.icon;
  return (
    <span className={`sg-verdict ${meta.cls}`} title={(compatibility.reasons || []).join(' ')}>
      <Icon size={12} /> {meta.label}
    </span>
  );
}

function formatGB(gb) {
  return `${Math.round(gb * 10) / 10} GB`;
}

export function ModelLibrary() {
  const [library, setLibrary] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [download, setDownload] = useState(null); // { modelId, progress, status }
  const [engineDl, setEngineDl] = useState(null); // { progress, status }
  const [busyModel, setBusyModel] = useState(null);
  const [busyEngine, setBusyEngine] = useState(false);
  const [customForm, setCustomForm] = useState({ name: '', repo: '', file: '', ramGB: '' });
  const [customBusy, setCustomBusy] = useState(false);

  // ── Remote GPU (Kaggle/Colab Gradio share link) ──────────────────
  const [remote, setRemote] = useState(null); // { connected, gradioUrl, name, health }
  const [remoteUrl, setRemoteUrl] = useState('');
  const [remoteName, setRemoteName] = useState('');
  const [remoteBusy, setRemoteBusy] = useState(null); // 'test' | 'connect' | 'disconnect' | null
  const [remoteMsg, setRemoteMsg] = useState(null); // { ok, text }

  const refreshRemote = useCallback(async () => {
    try {
      const st = await getRemoteModelStatus();
      setRemote(st);
      if (st?.connected && st?.gradioUrl) setRemoteUrl(st.gradioUrl);
    } catch {
      /* remote brain unavailable — non-fatal */
    }
  }, []);

  useEffect(() => { refreshRemote(); }, [refreshRemote]);

  const doRemoteTest = async () => {
    if (!remoteUrl.trim()) return;
    setRemoteBusy('test');
    setRemoteMsg(null);
    try {
      const res = await testRemoteModel(remoteUrl.trim());
      setRemoteMsg({ ok: true, text: `Link OK — model replied "${res.probe || 'ok'}" in the live test.` });
    } catch (err) {
      setRemoteMsg({ ok: false, text: err.message || 'Could not reach that link.' });
    } finally {
      setRemoteBusy(null);
    }
  };

  const doRemoteConnect = async () => {
    if (!remoteUrl.trim()) return;
    setRemoteBusy('connect');
    setRemoteMsg(null);
    try {
      await connectRemoteModel(remoteUrl.trim(), remoteName.trim() || undefined);
      setRemoteMsg({ ok: true, text: 'Connected — Hunt and Infinity AI now think on your remote GPU.' });
      await refreshRemote();
      refresh();
    } catch (err) {
      setRemoteMsg({ ok: false, text: err.message || 'Could not connect.' });
    } finally {
      setRemoteBusy(null);
    }
  };

  const doRemoteDisconnect = async () => {
    setRemoteBusy('disconnect');
    setRemoteMsg(null);
    try {
      await disconnectRemoteModel();
      setRemoteMsg({ ok: true, text: 'Disconnected — brain is back to the default.' });
      await refreshRemote();
      refresh();
    } catch (err) {
      setRemoteMsg({ ok: false, text: err.message || 'Could not disconnect.' });
    } finally {
      setRemoteBusy(null);
    }
  };

  const refresh = useCallback(async () => {
    try {
      const [lib, st] = await Promise.all([
        getRunnerLibrary().catch(() => null),
        getRunnerStatus().catch(() => null)
      ]);
      if (lib?.models) setLibrary(lib.models);
      else if (Array.isArray(lib)) setLibrary(lib);
      if (st) {
        setStatus(st);
        const dl = st.download;
        if (dl && dl.status !== 'idle') setDownload(dl);
        const edl = st.engineDownload;
        if (edl && edl.status !== 'idle') setEngineDl(edl);
      }
    } catch (err) {
      setError(err.message || 'Could not load the model runner.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Live model download progress.
  useEffect(() => {
    const unsubscribe = subscribeToDownloadStream({
      onEvent: (event) => {
        const type = event.__sseType;
        const data = event.data ?? event;
        if (type === 'download.progress' || type === 'progress') {
          setDownload((prev) => ({ ...(prev || {}), ...data, status: 'downloading' }));
        }
        if (type === 'download.done') { setDownload(null); refresh(); }
        if (type === 'download.error') {
          setDownload((prev) => ({ ...(prev || {}), status: 'error', error: data?.error }));
        }
      },
      onError: () => {}
    });
    return () => unsubscribe?.();
  }, [refresh]);

  // Live engine download progress.
  useEffect(() => {
    const unsubscribe = subscribeToEngineStream({
      onEvent: (event) => {
        const type = event.__sseType;
        const data = event.data ?? event;
        if (type === 'engine.progress' || type === 'progress') {
          setEngineDl((prev) => ({ ...(prev || {}), ...data, status: 'downloading' }));
        }
        if (type === 'engine.done') { setEngineDl(null); setBusyEngine(false); refresh(); }
        if (type === 'engine.error') {
          setEngineDl((prev) => ({ ...(prev || {}), status: 'error', error: data?.error }));
          setBusyEngine(false);
        }
      },
      onError: () => {}
    });
    return () => unsubscribe?.();
  }, [refresh]);

  const startEngineDownload = async () => {
    setError('');
    setBusyEngine(true);
    try {
      await downloadRunnerEngine();
      setEngineDl({ progress: 0, status: 'starting' });
    } catch (err) {
      setError(err.message || 'Could not start the engine download.');
      setBusyEngine(false);
    }
  };

  const startDownload = async (modelId) => {
    setError('');
    try {
      await downloadRunnerModel(modelId);
      setDownload({ modelId, progress: 0, status: 'starting' });
    } catch (err) {
      setError(err.message || 'Could not start the download.');
    }
  };

  const run = async (modelId) => {
    setError('');
    setBusyModel(modelId);
    try {
      await runRunnerModel(modelId);
      refresh();
    } catch (err) {
      setError(err.message || 'Could not start the model. Is the engine downloaded?');
    } finally {
      setBusyModel(null);
    }
  };

  const stop = async () => {
    setError('');
    setBusyModel('__stop');
    try {
      await stopRunnerModel();
      refresh();
    } catch (err) {
      setError(err.message || 'Could not stop the model.');
    } finally {
      setBusyModel(null);
    }
  };

  const remove = async (modelId) => {
    if (!window.confirm('Delete this downloaded model file?')) return;
    setError('');
    try {
      await removeRunnerModel(modelId);
      refresh();
    } catch (err) {
      setError(err.message || 'Could not delete the model.');
    }
  };

  const addCustom = async (e) => {
    e.preventDefault();
    if (!customForm.name.trim() || !customForm.repo.trim() || !customForm.file.trim()) return;
    setCustomBusy(true);
    setError('');
    try {
      await addRunnerCustomModel({
        name: customForm.name.trim(),
        repo: customForm.repo.trim(),
        file: customForm.file.trim(),
        ramGB: customForm.ramGB ? Number(customForm.ramGB) : undefined
      });
      setCustomForm({ name: '', repo: '', file: '', ramGB: '' });
      refresh();
    } catch (err) {
      setError(err.message || 'Could not add the custom model.');
    } finally {
      setCustomBusy(false);
    }
  };

  const device = status?.device;
  const running = status?.running;
  const engineReady = !!status?.engineReady;
  const gpuLabel = device?.gpus?.length
    ? device.gpus.map((g) => g.name || g.vendor).join(', ')
    : 'No GPU detected';

  return (
    <div className="sg-models-page">
      <div className="sg-page-head">
        <div>
          <h2><Zap size={20} /> Run Locally</h2>
          <p className="sg-body">
            No Ollama, no setup. Pick a model, press <b>Download</b>, then <b>Run</b> —
            it starts on localhost and becomes the brain for Hunt and Infinity AI.
          </p>
        </div>
      </div>

      {error && <div className="sg-alert sg-auth-error">{error}</div>}

      {/* ── Remote GPU: Kaggle / Colab ─────────────────────────── */}
      <div className="sg-card sg-card-pad">
        <div className="sg-remote-head">
          <Cloud size={18} />
          <div>
            <strong>Remote GPU — Kaggle / Colab</strong>
            <p>
              Run the model on a free cloud GPU, paste the public Gradio link here,
              press <b>Connect</b> — it becomes the brain for Hunt and Infinity AI.
              No download, no local RAM needed.
            </p>
          </div>
          {remote?.connected && (
            <span className="sg-pill sg-pill-go"><span className="sg-pulse-dot" /> Connected</span>
          )}
        </div>

        {remote?.connected ? (
          <div className="sg-remote-connected">
            <div className="sg-small">
              <Wifi size={15} />
              <div>
                <strong>{remote.name || 'Remote GPU'}</strong>
                <span className="sg-small">{remote.gradioUrl}</span>
                {remote.health?.latencyMs != null && (
                  <span className="sg-small">Link latency {remote.health.latencyMs} ms</span>
                )}
              </div>
            </div>
            <button className="sg-btn sg-btn-ghost" onClick={doRemoteDisconnect} disabled={remoteBusy === 'disconnect'}>
              {remoteBusy === 'disconnect' ? <Loader2 size={15} className="sg-spin" /> : <Unplug size={15} />}
              Disconnect
            </button>
          </div>
        ) : (
          <div className="sg-remote-form">
            <div className="sg-form-row">
              <input
                className="sg-input"
                placeholder="Paste the Gradio share link — https://xxxx.gradio.live"
                value={remoteUrl}
                onChange={(e) => setRemoteUrl(e.target.value)}
                disabled={!!remoteBusy}
              />
            </div>
            <div className="sg-form-row">
              <input
                className="sg-input"
                placeholder="Name it (optional) — e.g. Kaggle Qwen3-8B"
                value={remoteName}
                onChange={(e) => setRemoteName(e.target.value)}
                disabled={!!remoteBusy}
              />
            </div>
            <div className="sg-row">
              <button className="sg-btn sg-btn-ghost" onClick={doRemoteTest} disabled={!remoteUrl.trim() || !!remoteBusy}>
                {remoteBusy === 'test' ? <Loader2 size={15} className="sg-spin" /> : <Link2 size={15} />}
                Test link
              </button>
              <button className="sg-btn sg-btn-primary" onClick={doRemoteConnect} disabled={!remoteUrl.trim() || !!remoteBusy}>
                {remoteBusy === 'connect' ? <Loader2 size={15} className="sg-spin" /> : <Zap size={15} />}
                Connect
              </button>
            </div>
            {remoteMsg && (
              <div className={`sg-alert ${remoteMsg.ok ? 'sg-alert-success' : 'sg-auth-error'}`}>
                {remoteMsg.text}
              </div>
            )}
            <p className="sg-tiny">
              How to get a link: on Kaggle/Colab run a Gradio ChatInterface with your model
              and <b>share=True</b> — copy the public <b>.gradio.live</b> URL it prints.
            </p>
          </div>
        )}
      </div>

      {/* Currently running model */}
      {running && (
        <div className="sg-card sg-card-pad sg-running-banner">
          <div className="sg-running-info">
            <span className="sg-pulse-dot" />
            <div>
              <strong>{running.name || running.modelId}</strong>
              <span className="sg-small">
                Running on localhost{running.port ? ` :${running.port}` : ''} — thinking for Hunt and Infinity AI
              </span>
            </div>
          </div>
          <button className="sg-btn sg-btn-ghost" onClick={stop} disabled={busyModel === '__stop'}>
            {busyModel === '__stop' ? <Loader2 size={15} className="sg-spin" /> : <Square size={15} />}
            Stop
          </button>
        </div>
      )}

      {/* Device summary */}
      <div className="sg-card sg-card-pad">
        <div className="sg-device-head">
          <MonitorCog size={17} />
          <strong>Your device</strong>
          {device && <span className="sg-device-os">{device.os} · {device.arch}</span>}
        </div>
        <div className="sg-device-specs">
          <div className="sg-device-spec">
            <MemoryStick size={15} />
            <span>{device ? formatGB(device.totalRamGB) + ' RAM' : '—'}</span>
          </div>
          <div className="sg-device-spec">
            <Cpu size={15} />
            <span>{device ? `${device.cpuCount || '?'} CPU cores` : '—'}</span>
          </div>
          <div className="sg-device-spec">
            <HardDrive size={15} />
            <span>{gpuLabel}</span>
          </div>
        </div>
        <p className="sg-small">
          Models below are ranked for <b>this</b> device. Green means ready, amber means it fits
          but will feel heavy, red means it may crash this machine.
        </p>
      </div>

      {/* Engine one-time setup */}
      {!engineReady && (
        <div className="sg-card sg-card-pad">
          <div className="sg-small">
            <Server size={17} />
            <div>
              <strong>Step 0 — one-time engine download</strong>
              <p>
                Dark-Matter ships its own tiny inference engine (llama-server). It downloads
                once for your OS — after that, models run directly, no Ollama needed.
              </p>
            </div>
          </div>
          {engineDl && engineDl.status !== 'idle' ? (
            <div className="sg-pull-progress">
              <ProgressBar value={engineDl.progress || 0} />
              <span>
                {engineDl.status === 'error'
                  ? `Failed: ${engineDl.error || 'unknown error'}`
                  : `Downloading engine… ${Math.round((engineDl.progress || 0) * 100)}%`}
              </span>
            </div>
          ) : (
            <button className="sg-btn sg-btn-primary" onClick={startEngineDownload} disabled={busyEngine}>
              {busyEngine ? <Loader2 size={15} className="sg-spin" /> : <Download size={15} />}
              Download engine
            </button>
          )}
        </div>
      )}

      {/* Model cards */}
      <div className="sg-h2">Models</div>
      {loading ? (
        <div className="sg-loading-box"><Loader2 className="sg-spin" size={22} /> Loading models…</div>
      ) : (
        <div className="sg-model-grid">
          {library.map((model) => {
            const isDownloading = download && download.modelId === model.id && download.status !== 'idle';
            const dlFailed = download && download.modelId === model.id && download.status === 'error';
            const compat = model.compatibility || {};
            const req = model.requirements || {};
            return (
              <div key={model.id} className={`sg-card sg-card-pad sg-model-card ${model.running ? 'active' : ''}`}>
                <div className="sg-model-top">
                  <h3>{model.name}</h3>
                  <VerdictBadge compatibility={compat} />
                  {model.running && (
                    <span className="sg-pill sg-pill-go"><span className="sg-pulse-dot" /> Running</span>
                  )}
                </div>
                <p className="sg-small">{model.description}</p>
                <div className="sg-model-meta">
                  <span>{model.sizeGB ? `~${model.sizeGB} GB download` : 'Custom'}</span>
                  {req.ramGB ? <span>Needs {req.ramGB} GB RAM</span> : null}
                  <span>{req.gpuRequired ? 'GPU required' : (req.vramGB ? 'GPU optional' : 'CPU OK')}</span>
                  {model.quant ? <span>{model.quant}</span> : null}
                </div>
                {(compat.reasons || []).length > 0 && (
                  <ul className="sg-verdict-reasons">
                    {compat.reasons.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                )}
                <div className="sg-row">
                  {isDownloading ? (
                    <div className="sg-pull-progress" style={{ width: '100%' }}>
                      <ProgressBar value={download.progress || 0} />
                      <span>
                        {dlFailed
                          ? `Failed: ${download.error || 'unknown error'}`
                          : `Downloading… ${Math.round((download.progress || 0) * 100)}%`}
                      </span>
                      {!dlFailed && (
                        <button
                          className="sg-btn sg-btn-ghost sg-btn-sm"
                          onClick={() => cancelRunnerDownload().then(refresh).catch(() => {})}
                        >
                          <X size={13} /> Cancel
                        </button>
                      )}
                    </div>
                  ) : model.downloaded ? (
                    <>
                      {model.running ? (
                        <button className="sg-btn sg-btn-ghost" onClick={stop} disabled={busyModel === '__stop'}>
                          {busyModel === '__stop' ? <Loader2 size={15} className="sg-spin" /> : <Square size={15} />}
                          Stop
                        </button>
                      ) : (
                        <button
                          className="sg-btn sg-btn-primary"
                          onClick={() => run(model.id)}
                          disabled={busyModel === model.id || !engineReady || compat.verdict === 'blocked'}
                          title={!engineReady ? 'Download the engine first' : undefined}
                        >
                          {busyModel === model.id ? <Loader2 size={15} className="sg-spin" /> : <Play size={15} />}
                          Run
                        </button>
                      )}
                      <button className="sg-btn sg-btn-ghost" onClick={() => remove(model.id)} title="Delete the downloaded file">
                        <Trash2 size={15} />
                      </button>
                    </>
                  ) : (
                    <button className="sg-btn sg-btn-primary" onClick={() => startDownload(model.id)}>
                      <Download size={15} /> Download
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Custom model */}
      <div className="sg-h2" style={{ marginTop: 26 }}>Your own model</div>
      <form className="sg-custom-form" onSubmit={addCustom}>
        <h4><Plus size={15} /> Add any public Hugging Face GGUF</h4>
        <div className="sg-form-row">
          <input
            className="sg-input"
            placeholder="Name (e.g. My 14B coder)"
            value={customForm.name}
            onChange={(e) => setCustomForm({ ...customForm, name: e.target.value })}
          />
          <input
            className="sg-input"
            placeholder="RAM needed (GB, optional)"
            type="number"
            min="1"
            value={customForm.ramGB}
            onChange={(e) => setCustomForm({ ...customForm, ramGB: e.target.value })}
          />
        </div>
        <div className="sg-form-row">
          <input
            className="sg-input"
            placeholder="Hugging Face repo (e.g. bartowski/Qwen3-8B-GGUF)"
            value={customForm.repo}
            onChange={(e) => setCustomForm({ ...customForm, repo: e.target.value })}
          />
        </div>
        <div className="sg-form-row">
          <input
            className="sg-input"
            placeholder="GGUF file name (e.g. Qwen3-8B-Q4_K_M.gguf)"
            value={customForm.file}
            onChange={(e) => setCustomForm({ ...customForm, file: e.target.value })}
          />
        </div>
        <button className="sg-btn sg-btn-ghost" type="submit" disabled={customBusy}>
          {customBusy ? <Loader2 size={15} className="sg-spin" /> : <Plus size={15} />} Add model
        </button>
      </form>
    </div>
  );
}
