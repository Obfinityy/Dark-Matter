/**
 * ModelLibrary — "Run Locally": the no-Ollama local model runner UI.
 *
 * The flow is deliberately dead simple:
 *   1. Your device is detected IN THE BROWSER (CPU cores, RAM, GPU string) —
 *      the server never sees it. Models are ranked for YOUR machine.
 *   2. Compatible models sit ON TOP; too-heavy ones sit BELOW — every model
 *      stays downloadable and runnable, you may run anything.
 *   3. Press Download — the real .gguf streams from Hugging Face with live
 *      0% → 100% byte progress. At 100% the row flips to Run.
 *   4. Press Run — the model starts on localhost and becomes the ACTIVE
 *      brain for Hunt and Infinity AI.
 *   5. Press Stop — the model unloads and RAM/VRAM is freed.
 *
 * Every model in the catalog is UNCENSORED (abliterated / Dolphin).
 * Users can also register any public Hugging Face GGUF of their own, and can
 * still use the Remote GPU (Kaggle/Colab) card or API-key providers instead.
 */
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  Cpu, Download, X, Loader2, Plus, Trash2, Zap, AlertTriangle,
  Server, Play, Square, CheckCircle2, MonitorCog, MemoryStick,
  Cloud, Link2, Unplug, Wifi, CircuitBoard, Gauge, ShieldCheck,
  Network
} from 'lucide-react';
import {
  getRunnerStatus, getRunnerLibrary,
  downloadRunnerEngine, subscribeToEngineStream,
  cancelRunnerDownload,
  removeRunnerModel, addRunnerCustomModel,
  stopRunnerModel,
  downloadModelFile, runModelFile, subscribeToModelProgress,
  getBrainChain, getBrainSlots, getSlotAssignments, assignBrainSlot,
  getSlotSources, connectSlotKaggle, disconnectSlotKaggle,
  testRemoteModel, getSlotServers, runSlotServer, stopSlotServer
} from '../../services/api';
import {
  detectBrowserDevice, browserBudget, sortModelsByBrowserCompat, formatBrowserRam
} from '../../services/deviceDetect';
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
  blocked: { label: "Won't fit", cls: 'verdict-blocked', icon: X }
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

function ctxLabel(tokens) {
  const n = Number(tokens) || 0;
  if (n >= 1000) return `${Math.round(n / 1000)}k ctx`;
  return `${n} ctx`;
}

const CTX_CHOICES = [4096, 8192, 16384, 32768, 65536, 131072];

function ModelCard({ model, download, busyModel, engineReady, onDownload, onRun, onStop, onRemove, onCancelDownload }) {
  const isDownloading = download && download.modelId === model.id && !['done', 'idle'].includes(download.status);
  const dlFailed = download && download.modelId === model.id && (download.status === 'error' || download.status === 'cancelled');
  const compat = model.browserCompat || {};
  const req = model.requirements || {};
  const pct = download && download.modelId === model.id ? (download.percent || 0) : 0;

  // ── Quantization choice (Q4/Q5/Q8) ──
  const quantOptions = model.quants ? Object.keys(model.quants) : ['Q4_K_M'];
  const [quant, setQuant] = useState(quantOptions[0]);
  const downloadedQuants = model.downloadedQuants || (model.downloaded ? [quantOptions[0]] : []);
  const anyDownloaded = downloadedQuants.length > 0;
  const quantSizeGB = (q) => model.quants?.[q]?.sizeGB ?? model.sizeGB;
  // Which quant Run will use: the selected one if on disk, else any downloaded.
  const runQuant = downloadedQuants.includes(quant) ? quant : downloadedQuants[0];

  // ── Context window: shown on the card, selectable at Run time ──
  const ctxMax = Number(model.contextWindow) || 8192;
  const ctxChoices = CTX_CHOICES.filter((c) => c <= ctxMax);
  const [ctxSize, setCtxSize] = useState(ctxChoices.includes(8192) ? 8192 : ctxChoices[0]);

  // ── VRAM-fit estimate from the backend ranker (knows real VRAM) ──
  const vramFit = model.compatibility?.vramFit || null;
  return (
    <div className={`sg-card sg-card-pad sg-model-card ${model.running ? 'active' : ''}`}>
      <div className="sg-model-top">
        <h3>{model.name}</h3>
        <VerdictBadge compatibility={compat} />
      </div>
      <div className="sg-model-badges">
        {model.uncensored && (
          <span className="sg-pill sg-pill-uncensored" title="Refusals removed from the weights — it answers security questions directly.">
            <ShieldCheck size={12} /> Uncensored
          </span>
        )}
        {model.running && (
          <span className="sg-pill sg-pill-go"><span className="sg-pulse-dot" /> Running</span>
        )}
        {model.tierLabel && <span className="sg-pill">{model.tierLabel}</span>}
      </div>
      <p className="sg-small">{model.description}</p>
      <div className="sg-model-meta">
        <span>{model.params}</span>
        <span>{model.sizeGB ? `~${model.sizeGB} GB download` : 'Custom'}</span>
        {req.ramGB ? <span>Needs {req.ramGB} GB RAM</span> : null}
        <span>{req.gpuRequired ? 'GPU required' : (req.vramGB ? 'GPU optional' : 'CPU OK')}</span>
        {model.contextWindow ? (
          <span title="Maximum context window — how much text the model can consider at once. Selectable when you press Run.">
            {ctxLabel(model.contextWindow)} context
          </span>
        ) : null}
        {vramFit && vramFit.mode === 'partial' ? (
          <span title={`Full GPU offload wants ${vramFit.fullNeedGB} GB VRAM — about ${vramFit.offloadPct}% of layers will stay on your GPU.`}>
            ≈{vramFit.offloadPct}% GPU offload
          </span>
        ) : null}
        {vramFit && vramFit.mode === 'full' ? <span title="The whole model fits in your GPU's VRAM — maximum speed.">Full GPU offload</span> : null}
      </div>
      {(compat.reasons || []).length > 0 && (
        <ul className="sg-verdict-reasons">
          {compat.reasons.map((r, i) => <li key={i}>{r}</li>)}
        </ul>
      )}
      <div className="sg-row sg-model-actions">
        {isDownloading ? (
          <div className="sg-pull-progress" style={{ width: '100%' }}>
            <ProgressBar value={pct / 100} />
            <span>
              {dlFailed
                ? `${download.status === 'cancelled' ? 'Cancelled' : `Failed: ${download.error || 'unknown error'}`}`
                : `Downloading ${download.quant || ''}… ${Math.round(pct)}%`}
            </span>
            {!dlFailed && (
              <button
                className="sg-btn sg-btn-ghost sg-btn-sm"
                onClick={onCancelDownload}
              >
                <X size={13} /> Cancel
              </button>
            )}
          </div>
        ) : anyDownloaded ? (
          <>
            {model.running ? (
              <button className="sg-btn sg-btn-ghost" onClick={onStop} disabled={busyModel === '__stop'}>
                {busyModel === '__stop' ? <Loader2 size={15} className="sg-spin" /> : <Square size={15} />}
                Stop
              </button>
            ) : (
              <>
                <button
                  className="sg-btn sg-btn-primary"
                  onClick={() => onRun(model.id, { quant: runQuant, contextSize: ctxSize })}
                  disabled={busyModel === model.id || !engineReady}
                  title={!engineReady ? 'Download the engine first' : `Run ${runQuant} with ${ctxLabel(ctxSize)} — it becomes the brain for Hunt and Infinity AI`}
                >
                  {busyModel === model.id ? <Loader2 size={15} className="sg-spin" /> : <Play size={15} />}
                  Run{runQuant && runQuant !== 'Q4_K_M' ? ` ${runQuant}` : ''}
                </button>
                <label className="sg-tiny sg-ctx-pick" title={`Context window for this run (max ${ctxLabel(ctxMax)}). Bigger = more memory, longer reasoning.`}>
                  ctx{' '}
                  <select value={ctxSize} onChange={(e) => setCtxSize(Number(e.target.value))} disabled={busyModel === model.id}>
                    {ctxChoices.map((c) => (
                      <option key={c} value={c}>{ctxLabel(c)}</option>
                    ))}
                  </select>
                </label>
              </>
            )}
            <button className="sg-btn sg-btn-ghost" onClick={() => onRemove(model.id)} title="Delete all downloaded files for this model">
              <Trash2 size={15} />
            </button>
            {downloadedQuants.length > 1 && (
              <span className="sg-tiny" title="Quantizations on disk — Run uses your pick when available.">
                on disk: {downloadedQuants.join(', ')}
              </span>
            )}
          </>
        ) : (
          <>
            {quantOptions.length > 1 && (
              <label className="sg-tiny sg-quant-pick" title="Quantization: Q4 is smallest/fastest, Q8 is smartest but much bigger.">
                <select value={quant} onChange={(e) => setQuant(e.target.value)}>
                  {quantOptions.map((q) => (
                    <option key={q} value={q}>
                      {q} · ~{quantSizeGB(q)} GB
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button className="sg-btn sg-btn-primary" onClick={() => onDownload(model.id, quant)}>
              <Download size={15} /> Download{quantOptions.length > 1 ? ` ${quant}` : ''}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * BrainSlotCard — one brain slot (vision / grounding / hacker).
 *
 * Each slot shows ALL its models as clickable cards with Download →
 * live progress (0% → 100% border) → Select. Plus a Kaggle link option
 * so the slot can run on a remote GPU instead of a local model.
 *
 * - Vision: Hunt + Infinity Chat + Control
 * - Grounding: Hunt + Control
 * - Hacker: Hunt only
 */
function BrainSlotCard({
  slotId, slot, assignments, sources, slotServers,
  download, busyModel, engineReady, slotBusy, kaggleBusy, kaggleMsg,
  onAssign, onDownload, onCancelDownload, onRunSlot, onStopSlot,
  onKaggleConnect, onKaggleDisconnect, onKaggleTest,
  kaggleUrl, setKaggleUrl, kaggleName, setKaggleName
}) {
  const source = sources[slotId]?.source || 'local';
  const kaggle = sources[slotId]?.source === 'kaggle' ? sources[slotId] : null;
  const assignedModelId = assignments[slotId];
  const server = slotServers?.[slotId] || null; // running server for this slot
  const [tab, setTab] = useState(source); // 'local' | 'kaggle'

  // Keep tab in sync when source changes from elsewhere
  useEffect(() => { setTab(source); }, [source]);

  const slotModels = slot.models || [];
  const isBusy = slotBusy === slotId;

  return (
    <div className="sg-card sg-brain-slot" style={{ padding: 16 }}>
      {/* Slot header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <span style={{ fontSize: 28 }}>{slot.icon}</span>
        <div style={{ flex: 1 }}>
          <strong style={{ fontSize: 16 }}>{slot.label}</strong>
          <div className="sg-small" style={{ opacity: 0.7 }}>{slot.description}</div>
          <div className="sg-small" style={{ opacity: 0.5, marginTop: 2 }}>
            Used by: {(slot.usedBy || []).join(', ')}
          </div>
        </div>
        {/* Active status */}
        {kaggle ? (
          <span className="sg-pill sg-pill-go" title={kaggle.kaggleUrl}>
            <span className="sg-pulse-dot" /> Kaggle: {kaggle.kaggleName || 'GPU'}
          </span>
        ) : assignedModelId ? (
          <span className="sg-pill sg-pill-go">
            <CheckCircle2 size={12} /> {slotModels.find(m => m.id === assignedModelId)?.name || 'Local'}
          </span>
        ) : (
          <span className="sg-pill" style={{ opacity: 0.6 }}>Not set</span>
        )}
      </div>

      {/* Source tabs: Local Model | Kaggle Link */}
      <div className="sg-row" style={{ marginBottom: 12, gap: 8 }}>
        <button
          className={`sg-btn ${tab === 'local' ? 'sg-btn-primary' : 'sg-btn-ghost'}`}
          onClick={() => setTab('local')}
        >
          <Cpu size={15} /> Local Model
        </button>
        <button
          className={`sg-btn ${tab === 'kaggle' ? 'sg-btn-primary' : 'sg-btn-ghost'}`}
          onClick={() => setTab('kaggle')}
        >
          <Cloud size={15} /> Kaggle Link
        </button>
      </div>

      {/* ── LOCAL: all models for this slot ── */}
      {tab === 'local' && (
        <div style={{ display: 'grid', gap: 10 }}>
          {slotModels.map((m) => {
            const isActive = assignedModelId === m.id && source === 'local';
            const dl = download && download.modelId === m.id;
            const pct = dl ? (download.percent || 0) : 0;
            const isDl = dl && !['done', 'idle'].includes(download.status);
            const dlFailed = dl && (download.status === 'error' || download.status === 'cancelled');
            const isDownloaded = m.downloaded || (m.downloadedQuants || []).length > 0;
            return (
              <div
                key={m.id}
                className="sg-card"
                style={{
                  padding: 12,
                  background: isActive ? 'rgba(0,255,150,0.06)' : 'rgba(255,255,255,0.02)',
                  border: isActive ? '1px solid var(--sg-accent)' : '1px solid rgba(255,255,255,0.08)',
                  // Download progress as a growing border glow
                  boxShadow: isDl ? `inset ${Math.round(pct * 3)}px 0 0 -2px var(--sg-accent)` : undefined,
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* Progress bar along the top edge */}
                {isDl && (
                  <div style={{
                    position: 'absolute', top: 0, left: 0, height: 3,
                    width: `${Math.round(pct)}%`,
                    background: 'var(--sg-accent)',
                    transition: 'width 0.3s'
                  }} />
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <strong>{m.name}</strong>
                    <div className="sg-small" style={{ opacity: 0.6 }}>
                      {m.params} · ~{m.sizeGB} GB · {m.description?.slice(0, 80)}
                    </div>
                  </div>
                  {isDl ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="sg-small" style={{ color: 'var(--sg-accent)', fontWeight: 600 }}>
                        {dlFailed ? `Failed: ${download.error || ''}` : `${Math.round(pct)}%`}
                      </span>
                      {!dlFailed && (
                        <button className="sg-btn sg-btn-ghost sg-btn-sm" onClick={onCancelDownload}>
                          <X size={13} /> Cancel
                        </button>
                      )}
                      {dlFailed && (
                        <button
                          className="sg-btn sg-btn-ghost sg-btn-sm"
                          onClick={() => onDownload(m.id, 'Q4_K_M')}
                          title="Retry download"
                        >
                          Retry
                        </button>
                      )}
                    </div>
                  ) : server && server.modelId === m.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="sg-pill sg-pill-go" title={server.baseUrl}>
                        <span className="sg-pulse-dot" /> Running :{server.port}
                      </span>
                      <button
                        className="sg-btn sg-btn-ghost sg-btn-sm"
                        onClick={() => onStopSlot(slotId)}
                        disabled={slotBusy === `${slotId}-stop`}
                      >
                        {slotBusy === `${slotId}-stop` ? <Loader2 size={14} className="sg-spin" /> : <Square size={14} />}
                        Stop
                      </button>
                    </div>
                  ) : isActive ? (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className="sg-pill"><CheckCircle2 size={13} /> Selected</span>
                      {isDownloaded && (
                        <button
                          className="sg-btn sg-btn-primary sg-btn-sm"
                          onClick={() => onRunSlot(slotId, m.id)}
                          disabled={slotBusy === `${slotId}-run` || !engineReady}
                          title={`Run ${m.name} on localhost for ${slot.label} (own port)`}
                        >
                          {slotBusy === `${slotId}-run` ? <Loader2 size={14} className="sg-spin" /> : <Play size={14} />}
                          Run
                        </button>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                      {!isDownloaded && (
                        <button
                          className="sg-btn sg-btn-ghost sg-btn-sm"
                          onClick={() => onDownload(m.id, 'Q4_K_M')}
                          disabled={!engineReady}
                          title={!engineReady ? 'Download the engine first' : `Download ${m.name}`}
                        >
                          <Download size={14} /> Download
                        </button>
                      )}
                      {isDownloaded ? (
                        <button
                          className="sg-btn sg-btn-primary sg-btn-sm"
                          onClick={() => onRunSlot(slotId, m.id)}
                          disabled={slotBusy === `${slotId}-run` || !engineReady}
                          title={`Run ${m.name} on localhost for ${slot.label} (own port)`}
                        >
                          {slotBusy === `${slotId}-run` ? <Loader2 size={14} className="sg-spin" /> : <Play size={14} />}
                          Run
                        </button>
                      ) : (
                        <button
                          className="sg-btn sg-btn-ghost sg-btn-sm"
                          onClick={() => onAssign(slotId, m.id)}
                          disabled={isBusy}
                          title={`Select ${m.name} for ${slot.label} (downloads first)`}
                        >
                          Select
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {slotModels.length === 0 && (
            <p className="sg-small" style={{ opacity: 0.6 }}>No local models for this slot yet.</p>
          )}
        </div>
      )}

      {/* ── KAGGLE: link input per slot ── */}
      {tab === 'kaggle' && (
        <div style={{ display: 'grid', gap: 10 }}>
          {kaggle ? (
            <div className="sg-card" style={{ padding: 12, background: 'rgba(0,255,150,0.05)', border: '1px solid var(--sg-accent)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Wifi size={16} />
                <div style={{ flex: 1 }}>
                  <strong>{kaggle.kaggleName || 'Kaggle GPU'}</strong>
                  <div className="sg-small" style={{ opacity: 0.6, wordBreak: 'break-all' }}>{kaggle.kaggleUrl}</div>
                </div>
                <button
                  className="sg-btn sg-btn-ghost sg-btn-sm"
                  onClick={() => onKaggleDisconnect(slotId)}
                  disabled={kaggleBusy === slotId}
                >
                  {kaggleBusy === slotId ? <Loader2 size={14} className="sg-spin" /> : <Unplug size={14} />}
                  Disconnect
                </button>
              </div>
              <p className="sg-tiny" style={{ marginTop: 8, opacity: 0.7 }}>
                This slot now thinks on your Kaggle GPU. Disconnect to fall back to the local model.
              </p>
            </div>
          ) : (
            <>
              <div className="sg-form-row">
                <input
                  className="sg-input"
                  placeholder="Paste Gradio share link — https://xxxx.gradio.live"
                  value={kaggleUrl}
                  onChange={(e) => setKaggleUrl(e.target.value)}
                  disabled={kaggleBusy === slotId}
                />
              </div>
              <div className="sg-form-row">
                <input
                  className="sg-input"
                  placeholder="Name it (optional) — e.g. Kaggle Qwen2.5-VL"
                  value={kaggleName}
                  onChange={(e) => setKaggleName(e.target.value)}
                  disabled={kaggleBusy === slotId}
                />
              </div>
              <div className="sg-row" style={{ gap: 8 }}>
                <button
                  className="sg-btn sg-btn-ghost sg-btn-sm"
                  onClick={() => onKaggleTest(slotId)}
                  disabled={!kaggleUrl.trim() || kaggleBusy === slotId}
                >
                  {kaggleBusy === `${slotId}-test` ? <Loader2 size={14} className="sg-spin" /> : <Link2 size={14} />}
                  Test link
                </button>
                <button
                  className="sg-btn sg-btn-primary sg-btn-sm"
                  onClick={() => onKaggleConnect(slotId)}
                  disabled={!kaggleUrl.trim() || kaggleBusy === slotId}
                >
                  {kaggleBusy === slotId ? <Loader2 size={14} className="sg-spin" /> : <Zap size={14} />}
                  Connect to this slot
                </button>
              </div>
              {kaggleMsg?.[slotId] && (
                <div className={`sg-alert ${kaggleMsg[slotId].ok ? 'sg-alert-success' : 'sg-auth-error'}`}>
                  {kaggleMsg[slotId].text}
                </div>
              )}
              <p className="sg-tiny" style={{ opacity: 0.6 }}>
                Run a Gradio ChatInterface with <b>share=True</b> on Kaggle/Colab, paste the <b>.gradio.live</b> URL.
                Only this slot uses it — other slots keep their own brains.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function ModelLibrary() {
  const [library, setLibrary] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [download, setDownload] = useState(null); // { modelId, percent, status, receivedBytes, totalBytes, error }
  const [engineDl, setEngineDl] = useState(null); // { progress, status }
  const [busyModel, setBusyModel] = useState(null);
  const [busyEngine, setBusyEngine] = useState(false);
  const [customForm, setCustomForm] = useState({ name: '', repo: '', file: '', ramGB: '' });
  const [customBusy, setCustomBusy] = useState(false);
  const [brainChain, setBrainChain] = useState(null); // { provider, modelId, remoteGpu, chain[] }
  const [brainSlots, setBrainSlots] = useState(null); // { vision: {...}, grounding: {...}, hacker: {...} }
  const [slotAssignments, setSlotAssignments] = useState({}); // { vision: modelId, grounding: modelId, hacker: modelId }
  const [slotSources, setSlotSources] = useState({}); // { vision: { source: 'local'|'kaggle', ... }, ... }
  const [slotServers, setSlotServers] = useState({}); // { vision: {port, baseUrl, ...}|null, ... }
  const [slotBusy, setSlotBusy] = useState(null);
  // Per-slot Kaggle link inputs
  const [kaggleUrls, setKaggleUrls] = useState({}); // { vision: 'https://...', ... }
  const [kaggleNames, setKaggleNames] = useState({}); // { vision: 'My Kaggle', ... }
  const [kaggleBusy, setKaggleBusy] = useState(null); // slotId | `${slotId}-test`
  const [kaggleMsg, setKaggleMsg] = useState({}); // { slotId: { ok, text } }
  const progressUnsub = useRef(null);

  // ── Device: detected in the BROWSER ONLY ────────────────────────────
  const browserDevice = useMemo(() => detectBrowserDevice(), []);
  const budget = useMemo(() => browserBudget(browserDevice), [browserDevice]);
  const sortedModels = useMemo(
    () => sortModelsByBrowserCompat(library, browserDevice),
    [library, browserDevice]
  );
  const compatibleModels = sortedModels.filter((m) => m.browserCompatible);
  const heavyModels = sortedModels.filter((m) => !m.browserCompatible);

  // ── Per-slot Kaggle: each brain slot can run on its own Kaggle link ──
  // (The old global "Remote GPU" card was removed — Kaggle now lives inside each slot.)

  const refresh = useCallback(async () => {
    try {
      const [lib, st, chain, slots, assignments, sources, servers] = await Promise.all([
        getRunnerLibrary().catch(() => null),
        getRunnerStatus().catch(() => null),
        getBrainChain().catch(() => null),
        getBrainSlots().catch(() => null),
        getSlotAssignments().catch(() => null),
        getSlotSources().catch(() => null),
        getSlotServers().catch(() => null)
      ]);
      if (lib?.models) setLibrary(lib.models);
      else if (Array.isArray(lib)) setLibrary(lib);
      if (chain?.chain) setBrainChain(chain);
      if (slots?.slots) setBrainSlots(slots.slots);
      if (assignments?.assignments) setSlotAssignments(assignments.assignments);
      if (sources?.slotSources) setSlotSources(sources.slotSources);
      if (servers?.slotServers) setSlotServers(servers.slotServers);
      if (st) {
        setStatus(st);
        const dl = st.download;
        if (dl && dl.status === 'downloading' && dl.modelId) {
          const total = dl.totalBytes || null;
          setDownload({
            modelId: dl.modelId,
            status: 'downloading',
            receivedBytes: dl.receivedBytes || 0,
            totalBytes: total,
            percent: total > 0 ? Math.min(100, Math.round(((dl.receivedBytes || 0) / total) * 100)) : 0
          });
        }
        const edl = st.engineDownload;
        if (edl && edl.status !== 'idle') setEngineDl(edl);
      }
    } catch (err) {
      setError(err.message || 'Could not load the model runner.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Assign a model to a brain slot (vision | grounding | hacker)
  const assignToSlot = async (slot, modelId) => {
    setSlotBusy(slot);
    try {
      const data = await assignBrainSlot(slot, modelId);
      if (data?.assignments) setSlotAssignments(data.assignments);
      if (data?.slotSources) setSlotSources(data.slotSources);
    } catch (err) {
      setError(err.message);
    } finally {
      setSlotBusy(null);
    }
  };

  // Per-slot Kaggle: test / connect / disconnect a Gradio link for one slot
  const testSlotKaggle = async (slot) => {
    const url = (kaggleUrls[slot] || '').trim();
    if (!url) return;
    setKaggleBusy(`${slot}-test`);
    setKaggleMsg((m) => ({ ...m, [slot]: null }));
    try {
      const res = await testRemoteModel(url);
      setKaggleMsg((m) => ({ ...m, [slot]: { ok: true, text: `Link OK — replied "${res.probe || 'ok'}" in the live test.` } }));
    } catch (err) {
      setKaggleMsg((m) => ({ ...m, [slot]: { ok: false, text: err.message || 'Could not reach that link.' } }));
    } finally {
      setKaggleBusy(null);
    }
  };

  const connectSlotKaggleHandler = async (slot) => {
    const url = (kaggleUrls[slot] || '').trim();
    if (!url) return;
    setKaggleBusy(slot);
    setKaggleMsg((m) => ({ ...m, [slot]: null }));
    try {
      const data = await connectSlotKaggle(slot, url, (kaggleNames[slot] || '').trim() || undefined);
      if (data?.slotSources) setSlotSources(data.slotSources);
      setKaggleMsg((m) => ({ ...m, [slot]: { ok: true, text: 'Connected — this slot now thinks on your Kaggle GPU.' } }));
    } catch (err) {
      setKaggleMsg((m) => ({ ...m, [slot]: { ok: false, text: err.message || 'Could not connect.' } }));
    } finally {
      setKaggleBusy(null);
    }
  };

  const disconnectSlotKaggleHandler = async (slot) => {
    setKaggleBusy(slot);
    try {
      const data = await disconnectSlotKaggle(slot);
      if (data?.slotSources) setSlotSources(data.slotSources);
    } catch (err) {
      setError(err.message);
    } finally {
      setKaggleBusy(null);
    }
  };

  // Run a slot's model on its own localhost port
  const runSlotHandler = async (slot, modelId) => {
    setSlotBusy(`${slot}-run`);
    setError('');
    try {
      const data = await runSlotServer(slot, modelId);
      // Refresh servers + assignments
      const servers = await getSlotServers().catch(() => null);
      if (servers?.slotServers) setSlotServers(servers.slotServers);
      if (data?.slot) {
        setSlotAssignments((a) => ({ ...a, [slot]: modelId }));
      }
      refresh();
    } catch (err) {
      setError(err.message || `Could not run model for ${slot} slot.`);
    } finally {
      setSlotBusy(null);
    }
  };

  // Stop a slot's server
  const stopSlotHandler = async (slot) => {
    setSlotBusy(`${slot}-stop`);
    try {
      await stopSlotServer(slot);
      const servers = await getSlotServers().catch(() => null);
      if (servers?.slotServers) setSlotServers(servers.slotServers);
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSlotBusy(null);
    }
  };

  useEffect(() => { refresh(); }, [refresh]);

  // Close any dangling progress stream on unmount.
  useEffect(() => () => { progressUnsub.current?.(); progressUnsub.current = null; }, []);

  const stopProgressStream = () => {
    progressUnsub.current?.();
    progressUnsub.current = null;
  };

  // Live engine download progress.
  useEffect(() => {
    const unsubscribe = subscribeToEngineStream({
      onEvent: (event) => {
        const type = event.__sseType;
        const data = event.data ?? event;
        // The backend sends one `progress` event; the true state lives in
        // data.status ('downloading' | 'done' | 'error'). The old code forced
        // status to 'downloading', so a failed or finished download looked
        // stuck at 0% forever with no error shown.
        const st = type === 'engine.done' ? 'done'
          : type === 'engine.error' ? 'error'
          : (data?.status || 'downloading');
        if (st === 'done') { setEngineDl(null); setBusyEngine(false); refresh(); }
        else if (st === 'error') {
          setEngineDl((prev) => ({ ...(prev || {}), ...data, status: 'error' }));
          setBusyEngine(false);
        } else {
          setEngineDl((prev) => ({ ...(prev || {}), ...data, status: st }));
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

  /** Start a REAL streaming download; progress arrives over the per-model SSE stream. */
  const startDownload = async (modelId, quant) => {
    setError('');
    stopProgressStream();
    try {
      await downloadModelFile(modelId, { quant });
      setDownload({ modelId, quant, percent: 0, status: 'starting', receivedBytes: 0, totalBytes: null });
      progressUnsub.current = subscribeToModelProgress(modelId, {
        onEvent: (event) => {
          const data = event.data ?? event;
          const terminal = ['done', 'error', 'cancelled'].includes(data.status);
          setDownload((prev) => ({ ...(prev || { modelId }), ...data }));
          if (terminal) {
            stopProgressStream();
            if (data.status === 'done') {
              // At 100% the row flips to "Run".
              setDownload(null);
              refresh();
            }
          }
        },
        onError: () => { /* the stream dropping is non-fatal; refresh shows truth */ }
      });
    } catch (err) {
      setError(err.message || 'Could not start the download.');
      setDownload(null);
    }
  };

  const cancelDownload = async () => {
    try { await cancelRunnerDownload(); } catch { /* ignore */ }
    stopProgressStream();
    setDownload(null);
    refresh();
  };

  const run = async (modelId, opts) => {
    setError('');
    setBusyModel(modelId);
    try {
      // Runs the model AND sets it as the ACTIVE localhost brain.
      await runModelFile(modelId, opts || {});
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
    if (!window.confirm('Delete ALL downloaded quantizations of this model to free disk?')) return;
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

  const running = status?.running;
  const engineReady = !!status?.engineReady;

  const cardProps = {
    download, busyModel, engineReady,
    onDownload: startDownload, onRun: run, onStop: stop, onRemove: remove,
    onCancelDownload: cancelDownload
  };

  return (
    <div className="sg-models-page">
      <div className="sg-page-head">
        <div>
          <h2><Zap size={20} /> Models — the brain library</h2>
          <p className="sg-body">
            Every model here is <b>uncensored</b>. Pick one, press <b>Download</b>, then <b>Run</b> —
            it starts on localhost and becomes the active brain for Hunt and Infinity AI.
          </p>
        </div>
      </div>

      {error && <div className="sg-alert sg-auth-error">{error}</div>}

      {/* ── Brain Slots: three independent brains ──────────────────── */}
      <div style={{ marginBottom: 18 }}>
        <div className="sg-remote-head" style={{ marginBottom: 12 }}>
          <Zap size={18} />
          <div>
            <strong>Brain Slots — three brains, each with local + Kaggle options</strong>
            <p>
              <b>Hunt</b> uses all three brains. <b>Infinity Chat</b> uses only Vision.
              <b> Control</b> uses Vision + Grounding. Each slot runs on a local model
              <b> or</b> its own Kaggle link — your choice per slot.
            </p>
          </div>
        </div>
        {brainSlots ? (
          <div style={{ display: 'grid', gap: 14 }}>
            {Object.entries(brainSlots).map(([slotId, slot]) => (
              <BrainSlotCard
                key={slotId}
                slotId={slotId}
                slot={slot}
                assignments={slotAssignments}
                sources={slotSources}
                slotServers={slotServers}
                download={download}
                busyModel={busyModel}
                engineReady={engineReady}
                slotBusy={slotBusy}
                kaggleBusy={kaggleBusy}
                kaggleMsg={kaggleMsg}
                onAssign={assignToSlot}
                onDownload={startDownload}
                onCancelDownload={cancelDownload}
                onRunSlot={runSlotHandler}
                onStopSlot={stopSlotHandler}
                onKaggleConnect={connectSlotKaggleHandler}
                onKaggleDisconnect={disconnectSlotKaggleHandler}
                onKaggleTest={testSlotKaggle}
                kaggleUrl={kaggleUrls[slotId] || ''}
                setKaggleUrl={(v) => setKaggleUrls((m) => ({ ...m, [slotId]: v }))}
                kaggleName={kaggleNames[slotId] || ''}
                setKaggleName={(v) => setKaggleNames((m) => ({ ...m, [slotId]: v }))}
              />
            ))}
          </div>
        ) : (
          <div className="sg-small" style={{ opacity: 0.6 }}>Loading brain slots…</div>
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

      {/* ── Brain fallback chain ─────────────────────────────────── */}
      {brainChain?.chain?.length > 1 && (
        <div
          className="sg-card sg-card-pad sg-chain-strip"
          title="If your active brain fails mid-hunt (local model crashes, remote tab closes, API key dies), the agent automatically fails over to the next brain in this chain instead of dying. Your last connected Kaggle/Colab link is remembered even after you switch brains."
        >
          <Network size={15} />
          <span className="sg-small"><b>Brain fallback:</b></span>
          <span className="sg-chain-links">
            {brainChain.chain.map((link, i) => (
              <span key={link} className="sg-chain-link">
                {i > 0 && <span className="sg-chain-arrow">→</span>}
                <code className={i === 0 ? 'sg-chain-active' : ''}>{link}</code>
              </span>
            ))}
          </span>
        </div>
      )}

      {/* ── Device: detected in the BROWSER ONLY ─────────────────── */}
      <div className="sg-card sg-card-pad">
        <div className="sg-device-head">
          <MonitorCog size={17} />
          <strong>Your device</strong>
          <span className="sg-device-os">detected in your browser — the server never sees this</span>
        </div>
        <div className="sg-device-specs">
          <div className="sg-device-spec">
            <Cpu size={15} />
            <span>{browserDevice.cores ? `${browserDevice.cores} CPU cores` : 'CPU: unknown'}</span>
          </div>
          <div className="sg-device-spec">
            <MemoryStick size={15} />
            <span>{browserDevice.ramGB ? `${formatBrowserRam(browserDevice)} RAM` : 'RAM: unknown'}</span>
          </div>
          <div className="sg-device-spec">
            <CircuitBoard size={15} />
            <span>{browserDevice.gpu ? browserDevice.gpu.slice(0, 64) : 'No GPU detected'}</span>
          </div>
          <div className="sg-device-spec">
            <Gauge size={15} />
            <span>
              {budget.maxModelGB != null
                ? `Fits models up to ~${budget.maxModelGB} GB`
                : 'Model budget unknown'}
            </span>
          </div>
        </div>
        <p className="sg-device-verdict">{budget.verdict}</p>
        <p className="sg-tiny">
          Models are ranked for <b>this</b> device: compatible ones on top, heavier ones below.
          Everything stays downloadable and runnable — you may run anything.
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

      {/* Model catalog: compatible ON TOP, incompatible BELOW */}
      <div className="sg-h2">Runs on your device ({compatibleModels.length})</div>
      {loading ? (
        <div className="sg-loading-box"><Loader2 className="sg-spin" size={22} /> Loading models…</div>
      ) : (
        <>
          <div className="sg-model-grid">
            {compatibleModels.map((model) => (
              <ModelCard key={model.id} model={model} {...cardProps} />
            ))}
          </div>
          {compatibleModels.length === 0 && !loading && (
            <p className="sg-small">Nothing fits comfortably — the heavier models below still download and run.</p>
          )}

          {heavyModels.length > 0 && (
            <>
              <div className="sg-h2" style={{ marginTop: 8 }}>
                Too heavy for this device ({heavyModels.length})
              </div>
              <p className="sg-small">
                These need more RAM than your browser reports. They still download and run —
                just expect swapping, or run them on a bigger machine.
              </p>
              <div className="sg-model-grid sg-model-grid-heavy">
                {heavyModels.map((model) => (
                  <ModelCard key={model.id} model={model} {...cardProps} />
                ))}
              </div>
            </>
          )}
        </>
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
