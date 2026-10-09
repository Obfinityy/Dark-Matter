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
  Cpu,
  Download,
  X,
  Loader2,
  Plus,
  Trash2,
  Zap,
  AlertTriangle,
  Server,
  Play,
  Pause,
  Square,
  CheckCircle2,
  MonitorCog,
  MemoryStick,
  Cloud,
  Link2,
  Unplug,
  Wifi,
  CircuitBoard,
  Gauge,
  ShieldCheck,
  Network,
  CircleHelp,
  Copy,
  Check,
} from 'lucide-react';
import { getKaggleCell } from '../../data/kaggleCells';
import {
  getRunnerStatus,
  cancelRunnerDownload,
  removeRunnerModel,
  addRunnerCustomModel,
  stopRunnerModel,
  runModelFile,
  subscribeToModelProgress,
  getBrainChain,
  getBrainSlots,
  getSlotSources,
  getSlotServers,
  runSlotServer,
  stopSlotServer,
  tryApi,
  getAccountBrainLinks,
  saveAccountBrainLinks,
  deleteAccountBrainLink,
} from '../../services/api';
import {
  getAllKaggleSlots,
  connectKaggleSlot,
  disconnectKaggleSlot,
  testGradioLink,
} from '../../services/gradioDirect';
import { MODEL_CATALOG } from '../../data/modelCatalog';
import {
  isLocalBackendUp,
  downloadModelLocal,
  subscribeToLocalDownloadProgress,
  cancelLocalDownload,
  runModelOnLocal,
  stopSlotOnLocal,
  getLocalSlotServers,
  downloadAndRunSlotLocal,
  getSlotSetupStatusLocal,
  getLocalRunnerStatus,
  removeModelLocal,
  downloadEngineLocal,
  subscribeToLocalEngineStream,
  pauseDownloadLocal,
  resumeDownloadLocal,
  downloadEngineLauncher,
  detectUserOS,
  userOSLabel,
} from '../../services/localModelApi';
import {
  detectBrowserDevice,
  browserBudget,
  sortModelsByBrowserCompat,
  formatBrowserRam,
} from '../../services/deviceDetect';
import { getApiBase, getBackendUrl } from '../../services/backendMode';
import { localServiceUrl } from '../../lib/apiBase';
import { SpotlightCard } from '../../components/fx/SpotlightCard';
import { ElectricBorder } from '../../components/fx/ElectricBorder';
import { RunnerStatusCard } from '../../components/agent/RunnerStatusCard';
import './ModelLibrary.css';
import './ModelLibraryNew.css';
import './ModelLibrary.elegant.css';

function ProgressBar({ value, label }) {
  const pct = Math.round(value * 100);
  return (
    <div
      className="sg-progress"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label || 'Download progress'}
    >
      <div className="sg-progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

const VERDICT_META = {
  ready: { label: 'Ready', cls: 'verdict-ready', icon: CheckCircle2 },
  tight: { label: 'Tight fit', cls: 'verdict-tight', icon: AlertTriangle },
  risky: { label: 'Risky', cls: 'verdict-risky', icon: AlertTriangle },
  blocked: { label: "Won't fit", cls: 'verdict-blocked', icon: X },
};

function VerdictBadge({ compatibility }) {
  if (!compatibility) return null;
  const meta = VERDICT_META[compatibility.verdict] || VERDICT_META.blocked;
  const Icon = meta.icon;
  // Verdict reasons were mouse-only (title tooltip) — expose them to screen
  // readers too via an explicit label. Visual output is unchanged.
  const reasons = (compatibility.reasons || []).join(' ');
  return (
    <span
      className={`sg-verdict ${meta.cls}`}
      title={reasons}
      role="img"
      aria-label={reasons ? `${meta.label}. ${reasons}` : meta.label}
    >
      <Icon size={12} aria-hidden="true" /> {meta.label}
    </span>
  );
}

function ctxLabel(tokens) {
  const n = Number(tokens) || 0;
  if (n >= 1000) return `${Math.round(n / 1000)}k ctx`;
  return `${n} ctx`;
}

const CTX_CHOICES = [4096, 8192, 16384, 32768, 65536, 131072];

/**
 * CATEGORY_TABS — filter tabs for the model catalog. Each tab shows its brain
 * role in plain words so the user knows which models belong where.
 */
const CATEGORY_TABS = [
  { id: 'all', icon: '✨', label: 'All models', role: 'Everything in the library' },
  {
    id: 'vision',
    icon: '👁️',
    label: 'Vision',
    role: 'Sees the screen, decides where to click and what to do',
  },
  {
    id: 'hacking',
    icon: '🧠',
    label: 'Hacker Brain',
    role: 'The thinking/strategy brain — chains vulnerabilities like a human',
  },
  {
    id: 'grounding',
    icon: '🎯',
    label: 'Grounding',
    role: 'Turns decisions into exact click coordinates',
    optional: true,
  },
];

function ModelCard({
  model,
  download,
  busyModel,
  engineReady,
  onDownload,
  onRun,
  onStop,
  onRemove,
  onCancelDownload,
  onPauseDownload,
  onResumeDownload,
}) {
  const isDownloading =
    download && download.modelId === model.id && !['done', 'idle'].includes(download.status);
  const isPaused = download && download.modelId === model.id && download.status === 'paused';
  const dlFailed =
    download &&
    download.modelId === model.id &&
    (download.status === 'error' || download.status === 'cancelled');
  const compat = model.browserCompat || {};
  const req = model.requirements || {};
  const pct = download && download.modelId === model.id ? download.percent || 0 : 0;

  // ── Quantization choice (Q4/Q5/Q8) ──
  const quantOptions = model.quants ? Object.keys(model.quants) : ['Q4_K_M'];
  const [quant, setQuant] = useState(quantOptions[0]);
  const downloadedQuants = model.downloadedQuants || (model.downloaded ? [quantOptions[0]] : []);
  const anyDownloaded = downloadedQuants.length > 0;
  const quantSizeGB = q => model.quants?.[q]?.sizeGB ?? model.sizeGB;
  // Which quant Run will use: the selected one if on disk, else any downloaded.
  const runQuant = downloadedQuants.includes(quant) ? quant : downloadedQuants[0];

  // ── Context window: shown on the card, selectable at Run time ──
  const ctxMax = Number(model.contextWindow) || 8192;
  const ctxChoices = CTX_CHOICES.filter(c => c <= ctxMax);
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
          <span
            className="sg-pill sg-pill-uncensored"
            title="Refusals removed from the weights — it answers security questions directly."
          >
            <ShieldCheck size={12} /> Uncensored
          </span>
        )}
        {model.running && (
          <span className="sg-pill sg-pill-go">
            <span className="sg-pulse-dot" /> Running
          </span>
        )}
        {model.tierLabel && <span className="sg-pill">{model.tierLabel}</span>}
        {model.categoryLabel && (
          <span className="sg-pill sg-pill-cat" title="Which brain role this model is built for.">
            {model.categoryLabel}
          </span>
        )}
      </div>
      <p className="sg-small">{model.description}</p>
      <div className="sg-model-meta">
        <span>{model.params}</span>
        <span>{model.sizeGB ? `~${model.sizeGB} GB download` : 'Custom'}</span>
        {req.ramGB ? <span>Needs {req.ramGB} GB RAM</span> : null}
        <span>{req.gpuRequired ? 'GPU required' : req.vramGB ? 'GPU optional' : 'CPU OK'}</span>
        {model.contextWindow ? (
          <span title="Maximum context window — how much text the model can consider at once. Selectable when you press Run.">
            {ctxLabel(model.contextWindow)} context
          </span>
        ) : null}
        {vramFit && vramFit.mode === 'partial' ? (
          <span
            title={`Full GPU offload wants ${vramFit.fullNeedGB} GB VRAM — about ${vramFit.offloadPct}% of layers will stay on your GPU.`}
          >
            ≈{vramFit.offloadPct}% GPU offload
          </span>
        ) : null}
        {vramFit && vramFit.mode === 'full' ? (
          <span title="The whole model fits in your GPU's VRAM — maximum speed.">
            Full GPU offload
          </span>
        ) : null}
      </div>
      {(compat.reasons || []).length > 0 && (
        <ul className="sg-verdict-reasons">
          {compat.reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}
      <div className="sg-row sg-model-actions">
        {isDownloading ? (
          <div className="sg-pull-progress sg-pull-progress-full">
            <ProgressBar value={pct / 100} />
            <span>
              {dlFailed
                ? `${download.status === 'cancelled' ? 'Cancelled' : `Failed: ${download.error || 'unknown error'}`}`
                : isPaused
                  ? `Paused at ${Math.round(pct)}% — resume anytime`
                  : `Downloading ${download.quant || ''}… ${Math.round(pct)}%`}
            </span>
            {!dlFailed && !isPaused && (
              <>
                <button
                  className="sg-btn sg-btn-ghost sg-btn-sm"
                  onClick={onPauseDownload}
                  title="Pause — keeps downloaded data, resume later"
                >
                  <Pause size={13} /> Pause
                </button>
                <button className="sg-btn sg-btn-ghost sg-btn-sm" onClick={onCancelDownload}>
                  <X size={13} /> Cancel
                </button>
              </>
            )}
            {isPaused && (
              <button
                className="sg-btn sg-btn-primary sg-btn-sm"
                onClick={() => onResumeDownload(model.id, quant)}
                title="Resume download from where it paused"
              >
                <Play size={13} /> Resume
              </button>
            )}
          </div>
        ) : anyDownloaded ? (
          <>
            {model.running ? (
              <button
                className="sg-btn sg-btn-ghost"
                onClick={onStop}
                disabled={busyModel === '__stop'}
              >
                {busyModel === '__stop' ? (
                  <Loader2 size={15} className="sg-spin" />
                ) : (
                  <Square size={15} />
                )}
                Stop
              </button>
            ) : (
              <>
                <button
                  className="sg-btn sg-btn-primary"
                  onClick={() => onRun(model.id, { quant: runQuant, contextSize: ctxSize })}
                  disabled={busyModel === model.id || !engineReady}
                  title={
                    !engineReady
                      ? 'Download the engine first'
                      : `Run ${runQuant} with ${ctxLabel(ctxSize)} — it becomes the brain for Hunt AI and Infinity AI`
                  }
                >
                  {busyModel === model.id ? (
                    <Loader2 size={15} className="sg-spin" />
                  ) : (
                    <Play size={15} />
                  )}
                  Run{runQuant && runQuant !== 'Q4_K_M' ? ` ${runQuant}` : ''}
                </button>
                <label
                  className="sg-tiny sg-ctx-pick"
                  title={`Context window for this run (max ${ctxLabel(ctxMax)}). Bigger = more memory, longer reasoning.`}
                >
                  ctx{' '}
                  <select
                    value={ctxSize}
                    onChange={e => setCtxSize(Number(e.target.value))}
                    disabled={busyModel === model.id}
                  >
                    {ctxChoices.map(c => (
                      <option key={c} value={c}>
                        {ctxLabel(c)}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            <button
              className="sg-btn sg-btn-ghost"
              onClick={() => onRemove(model.id)}
              title="Delete all downloaded files for this model"
              aria-label="Delete all downloaded files for this model"
            >
              <Trash2 size={15} aria-hidden="true" />
            </button>
            {downloadedQuants.length > 1 && (
              <span
                className="sg-tiny"
                title="Quantizations on disk — Run uses your pick when available."
              >
                on disk: {downloadedQuants.join(', ')}
              </span>
            )}
          </>
        ) : (
          <>
            {quantOptions.length > 1 && (
              <label
                className="sg-tiny sg-quant-pick"
                title="Quantization: Q4 is smallest/fastest, Q8 is smartest but much bigger."
              >
                <select value={quant} onChange={e => setQuant(e.target.value)}>
                  {quantOptions.map(q => (
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
  slotId,
  slot,
  sources,
  slotServers,
  slotSetup,
  download,
  downloadedIds,
  engineReady,
  slotBusy,
  kaggleBusy,
  kaggleMsg,
  onDownload,
  onCancelDownload,
  onPauseDownload,
  onResumeDownload,
  onRemove,
  onRunSlot,
  onStopSlot,
  onDownloadAndRun,
  onKaggleConnect,
  onKaggleDisconnect,
  onKaggleTest,
  onKaggleSaveToAccount,
  accountLinks,
  kaggleUrl,
  setKaggleUrl,
  kaggleName,
  setKaggleName,
  groundingEnabled,
  onToggleGrounding,
}) {
  const source = sources[slotId]?.source || 'local';
  const kaggle = sources[slotId]?.source === 'kaggle' ? sources[slotId] : null;
  const server = slotServers?.[slotId] || null; // running server for this slot
  const [tab, setTab] = useState(source); // 'local' | 'kaggle'
  const [cellOpen, setCellOpen] = useState(false); // Kaggle one-cell "?" modal
  const [cellCopied, setCellCopied] = useState(false);

  // Escape closes the Kaggle cell modal — common sense, always available.
  useEffect(() => {
    if (!cellOpen) return;
    const onKey = e => {
      if (e.key === 'Escape') setCellOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cellOpen]);

  // Keep tab in sync when source changes from elsewhere
  useEffect(() => {
    setTab(source);
  }, [source]);

  const slotModels = slot.models || [];
  const isBusy = slotBusy === slotId;

  return (
    <SpotlightCard className="ml-slot" glowColor={server ? '34, 211, 238' : '139, 92, 246'}>
      {/* Slot header */}
      <div className="ml-slot-head">
        <span className="ml-slot-icon" aria-hidden="true">
          {slot.icon}
        </span>
        <div className="ml-slot-head-text">
          <strong className="ml-slot-title">
            {slot.label}
            {slotId === 'grounding' && (
              <button
                onClick={onToggleGrounding}
                className="sg-pill"
                style={{
                  marginLeft: '8px', fontSize: '11px', cursor: 'pointer', border: '1px solid var(--dm-border)',
                  background: groundingEnabled ? 'var(--dm-surface-3)' : 'transparent',
                  color: groundingEnabled ? 'var(--dm-text-1)' : 'var(--dm-text-2)',
                  opacity: groundingEnabled ? 1 : 0.6,
                }}
                title={groundingEnabled
                  ? 'Grounding is ON — click to disable (Vision will handle coordinates)'
                  : 'Grounding is OFF — click to enable'}
              >
                {groundingEnabled ? '● Enabled' : '○ Disabled'}
              </button>
            )}
          </strong>
          <div className="sg-small ml-slot-desc">{slot.description}</div>
          <div className="sg-small ml-slot-usedby">Used by: {(slot.usedBy || []).join(', ')}</div>
        </div>
        {/* Active status: what is actually running on this slot right now.
            The old "Select/assign" concept is gone — Download → Run is the
            flow, so the header reflects the live server, not a saved pick. */}
        {kaggle ? (
          <span className="sg-pill sg-pill-go" title={kaggle.kaggleUrl}>
            <span className="sg-pulse-dot" /> Kaggle: {kaggle.kaggleName || 'GPU'}
          </span>
        ) : server ? (
          <span className="sg-pill sg-pill-go" title={server.baseUrl || 'Running on localhost'}>
            <span className="sg-pulse-dot" /> Running{server.port ? ` :${server.port}` : ''}
          </span>
        ) : slotSetup?.[slotId] === 'setting-up' ? (
          <span
            className="sg-pill"
            title="Downloading the brain model and starting it — watch progress below"
          >
            <Loader2 size={13} className="sg-spin" /> Setting up…
          </span>
        ) : slotSetup?.[slotId] === 'error' ? (
          <span
            className="sg-pill sg-pill-bad"
            title="Setup failed — press Download & Run to retry"
          >
            Setup failed
          </span>
        ) : source === 'local' ? (
          <button
            className="sg-btn sg-btn-primary sg-btn-sm"
            onClick={() => onDownloadAndRun(slotId)}
            title={`One click: download the ${slot.label} brain model and run it on your machine`}
          >
            <Download size={14} /> Download & Run
          </button>
        ) : (
          <span className="sg-pill ml-slot-unset">Not set</span>
        )}
      </div>

      {/* Source tabs: Local Model | Kaggle Link */}
      <div className="sg-row ml-slot-tabs" aria-label={`${slot.label} source`}>
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
        <button
          className="sg-btn sg-btn-ghost sg-btn-sm ml-kaggle-help"
          onClick={() => { setCellCopied(false); setCellOpen(true); }}
          title="Show the one-cell Kaggle notebook setup for this brain"
          aria-label={`Show Kaggle setup cell for ${slot.label}`}
        >
          <CircleHelp size={15} />
        </button>
      </div>

      {/* ── KAGGLE one-cell setup modal ("?") ── */}
      {cellOpen && (() => {
        const spec = getKaggleCell(slotId);
        if (!spec) return null;
        const copyCell = async () => {
          try {
            await navigator.clipboard.writeText(spec.cell);
            setCellCopied(true);
            setTimeout(() => setCellCopied(false), 2000);
          } catch {
            /* clipboard unavailable — user can select manually */
          }
        };
        return (
          <div className="modal-overlay" onClick={() => setCellOpen(false)}>
            <div
              className="modal-content ml-cell-modal"
              role="dialog"
              aria-modal="true"
              aria-label={`${spec.title} Kaggle setup`}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <div>
                  <h3 className="modal-title">{spec.title} — one-cell Kaggle setup</h3>
                  <p className="modal-subtitle sg-small">
                    Model: <code>{spec.modelId}</code> · Input: {spec.kind}
                  </p>
                </div>
                <button
                  className="sg-btn sg-btn-ghost sg-btn-sm ml-cell-close"
                  onClick={() => setCellOpen(false)}
                  aria-label="Close"
                >
                  <X size={16} />
                  <span>Close</span>
                </button>
              </div>
              <div className="modal-body">
                <ol className="sg-small ml-cell-steps">
                  {spec.steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
                <div className="ml-cell-head">
                  <strong className="sg-small">The cell — copy everything:</strong>
                  <button className="sg-btn sg-btn-primary sg-btn-sm" onClick={copyCell}>
                    {cellCopied ? <Check size={14} /> : <Copy size={14} />}
                    {cellCopied ? 'Copied!' : 'Copy cell'}
                  </button>
                </div>
                <pre className="ml-cell-code"><code>{spec.cell}</code></pre>
                <p className="sg-tiny ml-kaggle-hint">
                  The link stays live while the Kaggle notebook keeps running. If it
                  stops responding, re-run the cell and paste the fresh link here.
                </p>
              </div>
              <div className="modal-footer">
                <button
                  className="sg-btn sg-btn-primary"
                  onClick={() => setCellOpen(false)}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── LOCAL: all models for this slot ── */}
      {tab === 'local' && (
        <div className="ml-slot-models">
          {slotModels.map(m => {
            // Highlight the model actually RUNNING on this slot (not the old
            // saved assignment — the Select/assign concept is removed).
            const isActive = server?.modelId === m.id && source === 'local';
            const dl = download && download.modelId === m.id;
            const pct = dl ? download.percent || 0 : 0;
            const isDl = dl && !['done', 'idle'].includes(download.status);
            const dlFailed = dl && (download.status === 'error' || download.status === 'cancelled');
            // Frontend-only: downloaded state tracked locally (no backend).
            const isDownloaded =
              downloadedIds.has(m.id) || m.downloaded || (m.downloadedQuants || []).length > 0;
            return (
              <div key={m.id} className={`sg-card ml-slot-model${isActive ? ' active' : ''}`}>
                {/* Progress bar along the top edge */}
                {isDl && (
                  <div
                    className="ml-model-edge"
                    style={{ width: `${Math.round(pct)}%` }}
                    aria-hidden="true"
                  />
                )}
                <div className="ml-slot-model-row">
                  <div className="ml-slot-model-info">
                    <strong>{m.name}</strong>
                    <div className="sg-small ml-slot-model-sub">
                      {m.params} · ~{m.sizeGB} GB · {m.description?.slice(0, 80)}
                    </div>
                  </div>
                  {isDl ? (
                    <div className="ml-slot-model-actions">
                      <span className="sg-small ml-dl-pct">
                        {dlFailed
                          ? `Failed: ${download.error || ''}`
                          : download.status === 'paused'
                            ? `Paused at ${Math.round(pct)}%`
                            : `${Math.round(pct)}%`}
                      </span>
                      {!dlFailed && download.status !== 'paused' && (
                        <>
                          <button
                            className="sg-btn sg-btn-ghost sg-btn-sm"
                            onClick={onPauseDownload}
                            title="Pause — keeps downloaded data"
                          >
                            <Pause size={13} /> Pause
                          </button>
                          <button
                            className="sg-btn sg-btn-ghost sg-btn-sm"
                            onClick={onCancelDownload}
                          >
                            <X size={13} /> Cancel
                          </button>
                        </>
                      )}
                      {download.status === 'paused' && (
                        <button
                          className="sg-btn sg-btn-primary sg-btn-sm"
                          onClick={() => onResumeDownload(m.id, 'Q4_K_M')}
                          title="Resume from where it paused"
                        >
                          <Play size={13} /> Resume
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
                    <div className="ml-slot-model-actions">
                      <span className="sg-pill sg-pill-go" title={server.baseUrl}>
                        <span className="sg-pulse-dot" /> Running :{server.port}
                      </span>
                      <button
                        className="sg-btn sg-btn-ghost sg-btn-sm"
                        onClick={() => onStopSlot(slotId)}
                        disabled={slotBusy === `${slotId}-stop`}
                      >
                        {slotBusy === `${slotId}-stop` ? (
                          <Loader2 size={14} className="sg-spin" />
                        ) : (
                          <Square size={14} />
                        )}
                        Stop
                      </button>
                    </div>
                  ) : isActive ? (
                    <div className="ml-slot-model-actions">
                      <span className="sg-pill">
                        <CheckCircle2 size={13} /> Selected
                      </span>
                      {isDownloaded && (
                        <button
                          className="sg-btn sg-btn-primary sg-btn-sm"
                          onClick={() => onRunSlot(slotId, m.id)}
                          disabled={slotBusy === `${slotId}-run` || !engineReady}
                          title={`Run ${m.name} on localhost for ${slot.label} (own port)`}
                        >
                          {slotBusy === `${slotId}-run` ? (
                            <Loader2 size={14} className="sg-spin" />
                          ) : (
                            <Play size={14} />
                          )}
                          Run
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="ml-slot-model-actions">
                      {!isDownloaded ? (
                        <button
                          className="sg-btn sg-btn-ghost sg-btn-sm"
                          onClick={() => onDownload(m.id, 'Q4_K_M')}
                          disabled={!engineReady}
                          title={!engineReady ? 'Download the engine first' : `Download ${m.name}`}
                        >
                          <Download size={14} /> Download
                        </button>
                      ) : (
                        <>
                          <button
                            className="sg-btn sg-btn-primary sg-btn-sm"
                            onClick={() => onRunSlot(slotId, m.id)}
                            disabled={slotBusy === `${slotId}-run` || !engineReady}
                            title={`Run ${m.name} on localhost for ${slot.label} (own port) — it becomes the brain for Hunt AI and Infinity AI`}
                          >
                            {slotBusy === `${slotId}-run` ? (
                              <Loader2 size={14} className="sg-spin" />
                            ) : (
                              <Play size={14} />
                            )}
                            Run
                          </button>
                          <button
                            className="sg-btn sg-btn-ghost sg-btn-sm"
                            onClick={() => onRemove(m.id)}
                            title={`Delete ${m.name} from your computer to free up disk space`}
                          >
                            <Trash2 size={14} /> Remove
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {slotModels.length === 0 && (
            <p className="sg-small ml-empty-note">No local models for this slot yet.</p>
          )}
        </div>
      )}

      {/* ── KAGGLE: link input per slot ── */}
      {tab === 'kaggle' && (
        <div className="ml-slot-models">
          {kaggle ? (
            <div className="sg-card ml-kaggle-connected">
              <div className="ml-slot-model-row">
                <Wifi size={16} />
                <div className="ml-slot-model-info">
                  <strong>{kaggle.kaggleName || 'Kaggle GPU'}</strong>
                  <div className="sg-small ml-kaggle-url">{kaggle.kaggleUrl}</div>
                </div>
                <button
                  className="sg-btn sg-btn-ghost sg-btn-sm"
                  onClick={() => onKaggleDisconnect(slotId)}
                  disabled={kaggleBusy === slotId}
                >
                  {kaggleBusy === slotId ? (
                    <Loader2 size={14} className="sg-spin" />
                  ) : (
                    <Unplug size={14} />
                  )}
                  Disconnect
                </button>
              </div>
              <p className="sg-tiny ml-kaggle-hint">
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
                  onChange={e => setKaggleUrl(e.target.value)}
                  disabled={kaggleBusy === slotId}
                />
              </div>
              <div className="sg-form-row">
                <input
                  className="sg-input"
                  placeholder="Name it (optional) — e.g. Kaggle Qwen2.5-VL"
                  value={kaggleName}
                  onChange={e => setKaggleName(e.target.value)}
                  disabled={kaggleBusy === slotId}
                />
              </div>
              <div className="ml-kaggle-actions">
                <button
                  className="sg-btn sg-btn-ghost sg-btn-sm"
                  onClick={() => onKaggleTest(slotId)}
                  disabled={!kaggleUrl.trim() || kaggleBusy === slotId}
                >
                  {kaggleBusy === `${slotId}-test` ? (
                    <Loader2 size={14} className="sg-spin" />
                  ) : (
                    <Link2 size={14} />
                  )}
                  Test link
                </button>
                <button
                  className="sg-btn sg-btn-primary sg-btn-sm"
                  onClick={() => onKaggleConnect(slotId)}
                  disabled={!kaggleUrl.trim() || kaggleBusy === slotId}
                >
                  {kaggleBusy === slotId ? (
                    <Loader2 size={14} className="sg-spin" />
                  ) : (
                    <Zap size={14} />
                  )}
                  Connect to this slot
                </button>
                <button
                  className="sg-btn sg-btn-sm"
                  onClick={() => onKaggleSaveToAccount(slotId)}
                  disabled={kaggleBusy === `${slotId}-save`}
                  title="Save this link to your account (encrypted) so your agent machine can use it 24/7"
                >
                  {kaggleBusy === `${slotId}-save` ? (
                    <Loader2 size={14} className="sg-spin" />
                  ) : (
                    <Cloud size={14} />
                  )}
                  Save to my account
                </button>
                {accountLinks?.[slotId]?.url && (
                  <span
                    className="sg-tiny"
                    style={{ color: 'var(--dm-success, #34d399)', whiteSpace: 'nowrap' }}
                    title={`Saved to your account${accountLinks[slotId].updatedAt ? ` on ${new Date(accountLinks[slotId].updatedAt).toLocaleString()}` : ''}`}
                  >
                    ✓ Saved to account
                  </span>
                )}
              </div>
              {kaggleMsg?.[slotId] && (
                <div
                  className={`sg-alert ${kaggleMsg[slotId].ok ? 'sg-alert-success' : 'sg-auth-error'}`}
                >
                  {kaggleMsg[slotId].text}
                </div>
              )}
              <p className="sg-tiny ml-kaggle-hint">
                Run a Gradio ChatInterface with <b>share=True</b> on Kaggle/Colab, paste the{' '}
                <b>.gradio.live</b> URL. Only this slot uses it — other slots keep their own brains.
              </p>
            </>
          )}
        </div>
      )}
    </SpotlightCard>
  );
}

/**
 * BrainAssignmentsPanel — the FIXED wiring: which brain slots each product
 * uses, with live status read from the running slot servers.
 *
 * - HUNT: Hacker (strategy brain) + Vision (sees the screen, decides where
 *   to click and what to do) + Grounding (turns decisions into click coordinates)
 * - INFINITY CHAT: Vision only
 * - CONTROL: Vision (thinking model) + Agent S (does the computer work) —
 *   the hacker brain is NOT needed for Control.
 *
 * A warning hint appears under any product whose required brain slot is
 * currently not running.
 */
function BrainAssignmentsPanel({ slotServers, slotSources }) {
  const slotStatus = slotId => {
    const server =
      slotServers?.[slotId] || slotServers?.[slotId === 'hacker' ? 'hacking' : slotId] || null;
    if (server) {
      return {
        running: true,
        text: server.port ? `Running :${server.port}` : 'Running',
        title: server.baseUrl || 'Running on localhost',
      };
    }
    const src = slotSources?.[slotId];
    if (src?.source === 'kaggle') {
      return {
        running: true,
        text: `Kaggle: ${src.kaggleName || 'GPU'}`,
        title: src.kaggleUrl || 'Connected Kaggle link',
      };
    }
    return {
      running: false,
      text: 'Not running',
      title: 'Press Run on this slot (or connect its Kaggle link) to start it.',
    };
  };

  const SLOT_LABEL = { vision: 'Vision', grounding: 'Grounding', hacker: 'Hacker Brain' };

  const PRODUCTS = [
    {
      name: 'Hunt AI',
      icon: '🎯',
      desc: 'Autonomous bug-bounty hunter — three brains observe, think, and act together.',
      needs: ['hacker', 'vision', 'grounding'],
      notes:
        'Hacker strategizes and chains vulnerabilities · Vision sees the screen and decides where to click and what to do · Grounding turns decisions into exact click coordinates.',
    },
    {
      name: 'Infinity Chat',
      icon: '💬',
      desc: 'The Infinity AI assistant (Chat / Plan / Build).',
      needs: ['vision'],
      notes: 'Vision only — it is the thinking model. The hacker brain is not used here.',
    },
    {
      name: 'Control',
      icon: '🖥️',
      desc: 'Computer control — Agent S does the actual computer work.',
      needs: ['vision'],
      notes:
        'Vision (thinking model) + Agent S (does the computer work). Hacker brain: not needed for Control.',
    },
  ];

  return (
    <div className="ml-assignments">
      <div className="sg-remote-head ml-brain-head">
        <Network size={18} />
        <div>
          <strong>Brain assignments — fixed wiring, live status</strong>
          <p>
            Each product always uses the same brains. Green means that brain is live on your machine
            right now; start missing brains above.
          </p>
        </div>
      </div>
      {PRODUCTS.map(p => {
        const missing = p.needs.filter(s => !slotStatus(s).running);
        return (
          <SpotlightCard key={p.name} className="ml-assign-row" glowColor="139, 92, 246">
            <div className="ml-assign-head">
              <span aria-hidden="true" className="ml-assign-icon">
                {p.icon}
              </span>
              <div>
                <strong>{p.name}</strong>
                <div className="sg-small ml-assign-desc">{p.desc}</div>
              </div>
            </div>
            <div className="ml-assign-slots">
              {p.needs.map(s => {
                const st = slotStatus(s);
                return (
                  <span
                    key={s}
                    className={`sg-pill ${st.running ? 'sg-pill-go' : ''}`}
                    title={st.title}
                  >
                    {st.running && <span className="sg-pulse-dot" />}
                    {SLOT_LABEL[s] || s}: {st.text}
                  </span>
                );
              })}
            </div>
            <div className="sg-small ml-assign-notes">{p.notes}</div>
            {missing.length > 0 && (
              <div className="sg-alert sg-auth-error ml-alert-mt" role="alert">
                <AlertTriangle size={15} />
                <span className="sg-small">
                  <b>{p.name}</b> will be degraded:{' '}
                  {missing.map(s => SLOT_LABEL[s] || s).join(', ')} is not running. Scroll to the
                  Brain Slots above and press Run on a{' '}
                  {missing.map(s => SLOT_LABEL[s] || s).join('/')} model.
                </span>
              </div>
            )}
          </SpotlightCard>
        );
      })}
    </div>
  );
}

export function ModelLibrary() {
  const [library, setLibrary] = useState(() => MODEL_CATALOG);
  // Frontend-only: tracks which models were downloaded this session (no backend).
  const [downloadedIds, setDownloadedIds] = useState(() => new Set());
  // Frontend-only active brain: which model is selected per slot (no backend).
  const [activeBrains, setActiveBrains] = useState(() => ({
    vision: null,
    grounding: null,
    hacking: null,
  }));

  // Load active brains from localStorage on mount.
  useEffect(() => {
    try {
      const saved = localStorage.getItem('dm_active_brains');
      if (saved) {
        const parsed = JSON.parse(saved);
        setActiveBrains(prev => ({ ...prev, ...parsed }));
      }
    } catch {
      /* ignore */
    }
  }, []);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [backendDown, setBackendDown] = useState(false); // selected backend unreachable
  const [authExpired, setAuthExpired] = useState(false); // session expired — needs re-login
  const [download, setDownload] = useState(null); // { modelId, percent, status, receivedBytes, totalBytes, error }
  const [engineDl, setEngineDl] = useState(null); // { progress, status }
  const [busyModel, setBusyModel] = useState(null);
  const [busyEngine, setBusyEngine] = useState(false);
  const [customForm, setCustomForm] = useState({ name: '', repo: '', file: '', ramGB: '' });
  const [customBusy, setCustomBusy] = useState(false);
  const [brainChain, setBrainChain] = useState(null); // { provider, modelId, remoteGpu, chain[] }
  const [brainSlots, setBrainSlots] = useState(null); // { vision: {...}, grounding: {...}, hacker: {...} }
  const [slotSources, setSlotSources] = useState({}); // { vision: { source: 'local'|'kaggle', ... }, ... }
  const [slotServers, setSlotServers] = useState({}); // { vision: {port, baseUrl, ...}|null, ... }
  const [slotBusy, setSlotBusy] = useState(null);
  // Per-slot Kaggle link inputs
  const [kaggleUrls, setKaggleUrls] = useState({}); // { vision: 'https://...', ... }
  const [kaggleNames, setKaggleNames] = useState({}); // { vision: 'My Kaggle', ... }
  const [kaggleBusy, setKaggleBusy] = useState(null); // slotId | `${slotId}-test`
  const [kaggleMsg, setKaggleMsg] = useState({}); // { slotId: { ok, text } }
  // Links saved to the user's ACCOUNT (backend, encrypted) — fetched on load
  // so the user can SEE what is saved, not just trust the success message.
  const [accountLinks, setAccountLinks] = useState(null); // { vision: {url, name, updatedAt}, ... } | null
  const [accountKeyStable, setAccountKeyStable] = useState(true);
  const progressUnsub = useRef(null);
  // Category filter for the catalog tabs (all | vision | hacking | grounding).
  const [catFilter, setCatFilter] = useState('all');

  // ── Device: detected in the BROWSER ONLY ────────────────────────────
  const browserDevice = useMemo(() => detectBrowserDevice(), []);
  const budget = useMemo(() => browserBudget(browserDevice), [browserDevice]);
  const sortedModels = useMemo(
    () => sortModelsByBrowserCompat(library, browserDevice),
    [library, browserDevice]
  );
  // ── Category filter: narrows the whole catalog without touching
  // download progress / cancel / Run behavior (cards are unchanged). ──
  const filteredModels = useMemo(
    () => (catFilter === 'all' ? sortedModels : sortedModels.filter(m => m.category === catFilter)),
    [sortedModels, catFilter]
  );
  const compatibleModels = filteredModels.filter(m => m.browserCompatible);
  const heavyModels = filteredModels.filter(m => !m.browserCompatible);

  // ── Device-aware category view: each tab shows how many of its models fit
  // THIS device (browser-detected specs). When a single category is selected,
  // the too-heavy models collapse behind an expander so the tab shows exactly
  // what fits the user's machine; the "All" tab keeps the full ranked view.
  const catFitCounts = useMemo(() => {
    const counts = {};
    for (const t of CATEGORY_TABS) {
      const list = t.id === 'all' ? sortedModels : sortedModels.filter(m => m.category === t.id);
      counts[t.id] = list.filter(m => m.browserCompatible).length;
    }
    return counts;
  }, [sortedModels]);
  const [showHeavy, setShowHeavy] = useState(false);
  useEffect(() => {
    setShowHeavy(false);
  }, [catFilter]);

  // ── Per-slot Kaggle: each brain slot can run on its own Kaggle link ──
  // (The old global "Remote GPU" card was removed — Kaggle now lives inside each slot.)

  const refresh = useCallback(async () => {
    try {
      // Model list comes from the frontend catalog (no backend needed).
      // Brain slots/status still use the backend when available.
      const [st, chain, slots, sources, servers, acct] = await Promise.all([
        tryApi(getRunnerStatus()),
        tryApi(getBrainChain()),
        tryApi(getBrainSlots()),
        tryApi(getSlotSources()),
        tryApi(getSlotServers()),
        tryApi(getAccountBrainLinks()),
      ]);
      const errors = [st, chain, slots, sources, servers].map(r => r.error).filter(Boolean);
      // Backend status: only for brain slots etc. Models always show (frontend catalog).
      const allNetworkFailed =
        errors.length === 5 &&
        errors.every(e => e.status === 0 || e.code === 'BACKEND_UNAVAILABLE');
      const anyAuthFailed = errors.some(e => e.status === 401);
      setBackendDown(allNetworkFailed);
      setAuthExpired(!allNetworkFailed && anyAuthFailed);
      if (chain.data?.chain) setBrainChain(chain.data);
      if (slots.data?.slots) setBrainSlots(slots.data.slots);
      if (sources.data?.slotSources) setSlotSources(sources.data.slotSources);
      if (servers.data?.slotServers) setSlotServers(servers.data.slotServers);
      if (acct.data?.links) {
        setAccountLinks(acct.data.links);
        if (typeof acct.data.keyStable === 'boolean') setAccountKeyStable(acct.data.keyStable);
      }
      if (st.data) {
        setStatus(st.data);
        const dl = st.data.download;
        if (dl && dl.status === 'downloading' && dl.modelId) {
          const total = dl.totalBytes || null;
          setDownload({
            modelId: dl.modelId,
            status: 'downloading',
            receivedBytes: dl.receivedBytes || 0,
            totalBytes: total,
            percent:
              total > 0 ? Math.min(100, Math.round(((dl.receivedBytes || 0) / total) * 100)) : 0,
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

  // ── Kaggle links are FRONTEND-DIRECT (owner's architecture) ──
  // The browser talks straight to Gradio — no localhost, no backend.
  // Links persist in the browser (localStorage), memory stays on device.
  const refreshKaggleSources = () => {
    const saved = getAllKaggleSlots();
    setSlotSources(prev => {
      const next = { ...(prev || {}) };
      for (const [slot, entry] of Object.entries(saved)) {
        if (entry) {
          next[slot] = { source: 'kaggle', kaggleUrl: entry.url, kaggleName: entry.name };
        } else if (next[slot]?.source === 'kaggle') {
          next[slot] = { source: 'local' };
        }
      }
      return next;
    });
  };

  // Merge browser-saved Kaggle links over whatever the backend reported.
  useEffect(() => {
    refreshKaggleSources();
  }, []);

  // Per-slot Kaggle: test / connect / disconnect a Gradio link for one slot.
  // All three run STRAIGHT from the browser — no backend involved.
  const testSlotKaggle = async slot => {
    const url = (kaggleUrls[slot] || '').trim();
    if (!url) return;
    setKaggleBusy(`${slot}-test`);
    setKaggleMsg(m => ({ ...m, [slot]: null }));
    try {
      const probe = await testGradioLink(url);
      setKaggleMsg(m => ({
        ...m,
        [slot]: { ok: true, text: `Link OK — ${probe} straight from your browser.` },
      }));
    } catch (err) {
      setKaggleMsg(m => ({
        ...m,
        [slot]: { ok: false, text: err.message || 'Could not reach that link.' },
      }));
    } finally {
      setKaggleBusy(null);
    }
  };

  const connectSlotKaggleHandler = async slot => {
    const url = (kaggleUrls[slot] || '').trim();
    if (!url) return;
    setKaggleBusy(slot);
    setKaggleMsg(m => ({ ...m, [slot]: null }));
    try {
      // Verify the link is alive from the browser BEFORE saving it.
      await testGradioLink(url);
      connectKaggleSlot(slot, url, (kaggleNames[slot] || '').trim() || undefined);
      refreshKaggleSources();
      setKaggleMsg(m => ({
        ...m,
        [slot]: {
          ok: true,
          text: 'Connected — this slot now talks straight to your Kaggle GPU from this browser.',
        },
      }));
    } catch (err) {
      setKaggleMsg(m => ({
        ...m,
        [slot]: { ok: false, text: err.message || 'Could not connect.' },
      }));
    } finally {
      setKaggleBusy(null);
    }
  };

  const disconnectSlotKaggleHandler = async slot => {
    setKaggleBusy(slot);
    try {
      disconnectKaggleSlot(slot);
      refreshKaggleSources();
      setKaggleMsg(m => ({
        ...m,
        [slot]: { ok: true, text: 'Disconnected — slot is back to local.' },
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setKaggleBusy(null);
    }
  };

  // Save this slot's Kaggle link to the user's ACCOUNT (encrypted at rest).
  // The agent machine fetches it with the account token, so hunts run 24/7
  // without the browser open. The browser-local copy stays as the default.
  const saveKaggleToAccountHandler = async slot => {
    const entry = getAllKaggleSlots()[slot];
    if (!entry?.url) {
      setKaggleMsg(m => ({
        ...m,
        [slot]: { ok: false, text: 'Connect the link in this browser first, then save it to your account.' },
      }));
      return;
    }
    setKaggleBusy(`${slot}-save`);
    try {
      const res = await saveAccountBrainLinks({ [slot]: { url: entry.url, name: entry.name || null } });
      if (res?.links) setAccountLinks(res.links);
      if (typeof res?.keyStable === 'boolean') setAccountKeyStable(res.keyStable);
      setKaggleMsg(m => ({
        ...m,
        [slot]: res?.keyStable === false
          ? {
              ok: true,
              text: 'Saved, but this server forgets account links on restart (no stable key configured) — they are safe in this browser.',
            }
          : {
              ok: true,
              text: 'Saved to your account (encrypted) — your agent machine can now use it 24/7.',
            },
      }));
    } catch (err) {
      setKaggleMsg(m => ({
        ...m,
        [slot]: { ok: false, text: err.message || 'Could not save to your account.' },
      }));
    } finally {
      setKaggleBusy(null);
    }
  };

  // Run a slot's model on its own localhost port — ALWAYS the device backend
  // (localhost), never the cloud backend. Models live on the user's machine.
  const runSlotHandler = async (slot, modelId) => {
    setSlotBusy(`${slot}-run`);
    setError('');
    try {
      const data = await runModelOnLocal(slot, modelId);
      // Refresh servers + assignments from the device backend
      const servers = await getLocalSlotServers().catch(() => null);
      if (servers) {
        setSlotServers({
          vision: servers.vision || null,
          grounding: servers.grounding || null,
          hacker: servers.hacker || servers.hacking || null,
        });
      }
      if (data?.slot) {
        setSlotAssignments(a => ({ ...a, [slot]: modelId }));
      }
      refresh();
    } catch (err) {
      setError(err.message || `Could not run model for ${slot} slot.`);
    } finally {
      setSlotBusy(null);
    }
  };

  // ── Local backend: models run on the USER'S machine (localhost:4000) ──
  // NOTE: this useState MUST stay above its first use (one-click setup + engine-stream effects below).
  const [localBackendUp, setLocalBackendUp] = useState(false);
  // Engine status on the USER'S machine (localhost) — Step 0 shows until the
  // local engine is downloaded. The remote backend's engineReady is irrelevant
  // here because models run on localhost, not on Render.
  const [localEngineReady, setLocalEngineReady] = useState(false);

  // ONE-CLICK brain setup: download the slot's default model (when missing)
  // then run it — a single button press. Progress shows via the download SSE
  // events; the slot flips to Running when the brain is up.
  const [slotSetup, setSlotSetup] = useState({ vision: 'idle', grounding: 'idle', hacker: 'idle' });

  // Grounding enable/disable toggle — persisted per device. When disabled,
  // hunts skip grounding entirely and Vision handles coordinates.
  const [groundingEnabled, setGroundingEnabled] = useState(() => {
    try {
      const v = localStorage.getItem('dm-grounding-enabled');
      return v === null ? true : v === '1';
    } catch { return true; }
  });
  const toggleGrounding = () => {
    setGroundingEnabled(prev => {
      const next = !prev;
      try { localStorage.setItem('dm-grounding-enabled', next ? '1' : '0'); } catch {}
      return next;
    });
  };

  const refreshSlotSetup = async () => {
    if (!localBackendUp) return;
    try {
      const st = await getSlotSetupStatusLocal();
      if (st?.setup) setSlotSetup(st.setup);
    } catch {
      /* ignore */
    }
  };

  // While any slot is setting up, poll setup status + servers until done.
  useEffect(() => {
    const anySettingUp = Object.values(slotSetup).includes('setting-up');
    if (!anySettingUp || !localBackendUp) return;
    const id = setInterval(async () => {
      await refreshSlotSetup();
      await refreshSlotServers();
    }, 3000);
    return () => clearInterval(id);
  }, [slotSetup, localBackendUp]);

  const downloadAndRunHandler = async slot => {
    setError('');
    if (!localBackendUp) {
      setError(
        'Your Dark Matter backend is not running on this device yet. Start it, then press Download & Run.'
      );
      return;
    }
    try {
      const res = await downloadAndRunSlotLocal(slot);
      if (res?.alreadyRunning) return;
      setSlotSetup(s => ({ ...s, [slot]: 'setting-up' }));
      refreshSlotSetup();
    } catch (err) {
      setError(err.message || `Could not set up the ${slot} brain.`);
    }
  };

  // Stop a slot's server
  const stopSlotHandler = async slot => {
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

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Close any dangling progress stream on unmount.
  useEffect(
    () => () => {
      progressUnsub.current?.();
      progressUnsub.current = null;
    },
    []
  );

  // ── Local backend state lives above (with the one-click setup section) ──

  const stopProgressStream = () => {
    progressUnsub.current?.();
    progressUnsub.current = null;
  };

  // Live engine download progress (from the LOCAL backend — the engine
  // downloads to the user's machine, not the cloud).
  useEffect(() => {
    if (!localBackendUp) return;
    const unsubscribe = subscribeToLocalEngineStream({
      onEvent: data => {
        const st = data?.status || 'downloading';
        if (st === 'done') {
          setEngineDl(null);
          setBusyEngine(false);
          setLocalEngineReady(true);
          refresh();
        } else if (st === 'error') {
          setEngineDl(prev => ({ ...(prev || {}), ...data, status: 'error' }));
          setBusyEngine(false);
        } else {
          setEngineDl(prev => ({ ...(prev || {}), ...data, status: st }));
        }
      },
      onError: () => {},
    });
    return () => unsubscribe?.();
  }, [refresh, localBackendUp]);

  const startEngineDownload = async () => {
    setError('');
    // The Infinity AI Runner downloads to the USER'S LOCAL MACHINE via the
    // local backend. If the backend is not running yet, the Step 0 card offers
    // the one-click launcher instead — this guard is only a fallback.
    if (!localBackendUp) {
      setError(
        'Your local engine is not running yet. Download the one-click launcher in Step 0 above, run it, and it starts everything automatically.'
      );
      return;
    }
    setBusyEngine(true);
    try {
      await downloadEngineLocal();
      setEngineDl({ progress: 0, status: 'starting' });
    } catch (err) {
      setError(err.message || 'Could not start the engine download. Is the local backend running?');
      setBusyEngine(false);
    }
  };

  /** Start a REAL streaming download; progress arrives over the per-model SSE stream. */
  // ── Frontend-only downloads: direct from Hugging Face, no backend needed ──

  useEffect(() => {
    const checkLocal = async () => {
      const up = await isLocalBackendUp();
      setLocalBackendUp(up);
      if (up) {
        try {
          const st = await getLocalRunnerStatus();
          setLocalEngineReady(!!st?.engineReady);
        } catch {
          /* local backend has no runner yet */
        }
      } else {
        setLocalEngineReady(false);
      }
    };
    checkLocal();
    const t = setInterval(checkLocal, 10000);
    return () => clearInterval(t);
  }, []);

  const startDownload = async (modelId, quant) => {
    setError('');
    stopProgressStream();
    // Models download to the USER'S LOCAL MACHINE via the local backend.
    // If it is not running, Step 0's one-click launcher starts it automatically.
    if (!localBackendUp) {
      setError(
        'Your local engine is not running yet. Download the one-click launcher in Step 0 above, run it, and it starts everything automatically.'
      );
      return;
    }
    try {
      await downloadModelLocal(modelId, { quant });
      setDownload({
        modelId,
        quant,
        percent: 0,
        status: 'downloading',
        receivedBytes: 0,
        totalBytes: null,
      });
      progressUnsub.current = subscribeToLocalDownloadProgress(modelId, {
        onEvent: data => {
          const terminal = ['done', 'error', 'cancelled'].includes(data.status);
          setDownload(prev => ({ ...(prev || { modelId }), ...data }));
          if (terminal) {
            stopProgressStream();
            if (data.status === 'done') {
              setDownload(null);
              setDownloadedIds(prev => new Set(prev).add(modelId));
              refresh();
            }
          }
        },
        onError: () => {
          /* stream drop is non-fatal */
        },
      });
    } catch (err) {
      setError(err.message || 'Could not start the download. Is the local backend running?');
      setDownload(null);
    }
  };

  const cancelDownload = async () => {
    try {
      await cancelLocalDownload();
    } catch {
      /* ignore */
    }
    stopProgressStream();
    setDownload(null);
    refresh();
  };

  // Pause a download — backend keeps the partial file; Resume continues
  // from where it left off via HTTP Range.
  const pauseDownload = async () => {
    try {
      const res = await pauseDownloadLocal();
      if (res?.paused) {
        setDownload(prev => (prev ? { ...prev, status: 'paused' } : prev));
      } else {
        // Fallback: treat as cancel if pause not supported
        stopProgressStream();
        setDownload(null);
      }
    } catch (err) {
      setError(err.message || 'Could not pause the download.');
    }
  };

  // Resume a paused download from the partial file.
  const resumeDownload = async (modelId, quant) => {
    setError('');
    stopProgressStream();
    try {
      await resumeDownloadLocal(modelId, { quant });
      setDownload(prev => ({
        ...(prev || { modelId }),
        modelId,
        quant,
        status: 'downloading',
        percent: prev?.percent || 0,
        receivedBytes: prev?.receivedBytes || 0,
        totalBytes: prev?.totalBytes || null,
      }));
      progressUnsub.current = subscribeToLocalDownloadProgress(modelId, {
        onEvent: data => {
          const terminal = ['done', 'error', 'cancelled'].includes(data.status);
          setDownload(prev => ({ ...(prev || { modelId }), ...data }));
          if (terminal) {
            stopProgressStream();
            if (data.status === 'done') {
              setDownload(null);
              setDownloadedIds(prev => new Set(prev).add(modelId));
              refresh();
            }
          }
        },
        onError: () => {
          /* stream drop is non-fatal */
        },
      });
    } catch (err) {
      setError(err.message || 'Could not resume the download.');
      setDownload(null);
    }
  };

  // ── Refresh slot servers from the local backend. ──
  const refreshSlotServers = async () => {
    if (!localBackendUp) return;
    try {
      const servers = await getLocalSlotServers();
      setSlotServers({
        vision: servers.vision || null,
        grounding: servers.grounding || null,
        hacker: servers.hacker || servers.hacking || null,
      });
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (localBackendUp) refreshSlotServers();
  }, [localBackendUp]);

  useEffect(() => {
    if (localBackendUp) refreshSlotSetup();
  }, [localBackendUp]);

  const run = async (modelId, opts) => {
    setError('');
    setBusyModel(modelId);
    // Models run on the USER'S LOCAL MACHINE, each on its own random localhost port.
    // If the local backend is not running, Step 0's one-click launcher starts it.
    if (!localBackendUp) {
      setError(
        'Your local engine is not running yet. Download the one-click launcher in Step 0 above, run it, and it starts everything automatically.'
      );
      setBusyModel(null);
      return;
    }
    try {
      const model = MODEL_CATALOG.find(m => m.id === modelId);
      if (!model) throw new Error('Model not found.');
      // Map category to backend slot: 'hacking' -> 'hacker'
      const slot = model.category === 'hacking' ? 'hacker' : model.category;
      // Run on the local backend — it picks a random free localhost port.
      const result = await runModelOnLocal(slot, modelId, opts || {});
      // Update UI: show the running model and its port.
      setSlotServers(prev => ({
        ...prev,
        [model.category]: {
          modelId,
          port: result.port,
          baseUrl: result.baseUrl || localServiceUrl(result.port),
        },
      }));
      // Also save as active brain (frontend state).
      setActiveBrains(prev => ({ ...prev, [model.category]: modelId }));
      try {
        localStorage.setItem(
          'dm_active_brains',
          JSON.stringify({
            ...activeBrains,
            [model.category]: modelId,
          })
        );
      } catch {
        /* ignore */
      }
      refresh();
    } catch (err) {
      setError(err.message || 'Could not start the model on your machine.');
    } finally {
      setBusyModel(null);
    }
  };

  const stopSlot = async slot => {
    // Map frontend category to backend slot.
    const backendSlot = slot === 'hacking' ? 'hacker' : slot;
    try {
      await stopSlotOnLocal(backendSlot);
      setSlotServers(prev => ({ ...prev, [slot]: null }));
      refresh();
    } catch (err) {
      setError(err.message || 'Could not stop the model.');
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

  const remove = async modelId => {
    if (!window.confirm('Delete ALL downloaded quantizations of this model to free disk?')) return;
    setError('');
    try {
      await removeRunnerModel(modelId);
      refresh();
    } catch (err) {
      setError(err.message || 'Could not delete the model.');
    }
  };

  // Remove a model downloaded to the USER'S LOCAL MACHINE (frees local disk).
  // Used by the brain-slot cards: Download → Run / Remove.
  const removeLocal = async modelId => {
    if (!window.confirm('Delete this model from your computer to free up disk space?')) return;
    setError('');
    try {
      if (!localBackendUp)
        throw new Error(
          'Your local engine is not running yet. Download the one-click launcher in Step 0 above, run it, and it starts everything automatically.'
        );
      await removeModelLocal(modelId);
      setDownloadedIds(prev => {
        const next = new Set(prev);
        next.delete(modelId);
        return next;
      });
      refresh();
    } catch (err) {
      setError(err.message || 'Could not delete the model from your computer.');
    }
  };

  const addCustom = async e => {
    e.preventDefault();
    if (!customForm.name.trim() || !customForm.repo.trim() || !customForm.file.trim()) return;
    setCustomBusy(true);
    setError('');
    try {
      await addRunnerCustomModel({
        name: customForm.name.trim(),
        repo: customForm.repo.trim(),
        file: customForm.file.trim(),
        ramGB: customForm.ramGB ? Number(customForm.ramGB) : undefined,
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
  // engineReady for buttons: MUST be the LOCAL engine (localhost), not remote.
  // Models run on the user's machine. Remote Render's engine status is irrelevant.
  const engineReady = localEngineReady;

  const cardProps = {
    download,
    busyModel,
    engineReady,
    onDownload: startDownload,
    onRun: run,
    onStop: stop,
    onRemove: remove,
    onCancelDownload: cancelDownload,
    onPauseDownload: pauseDownload,
    onResumeDownload: resumeDownload,
  };

  return (
    <div className="ml-new">
      <div className="ml-head">
        <h2 className="ml-title">Model Library</h2>
        <p className="ml-sub">
          Every model here is <b>uncensored</b>. Pick one, press <b>Download</b>, then <b>Run</b> —
          it starts on localhost and becomes the active brain for Hunt AI and Infinity AI.
        </p>
      </div>

      {error && <div className="sg-alert sg-auth-error">{error}</div>}

      {authExpired && !loading && (
        <div className="sg-alert sg-auth-error ml-alert-spaced" role="alert">
          <div className="ml-alert-head">
            <ShieldCheck size={18} />
            <strong>Session expired</strong>
          </div>
          <p className="sg-small ml-alert-body">
            Your sign-in has expired. Please sign in again to load the model library.
          </p>
          <button
            className="sg-btn sg-btn-primary"
            onClick={() => {
              try {
                localStorage.removeItem('dm_jwt');
              } catch {
                /* ignore */
              }
              window.location.href = '/login';
            }}
          >
            Sign in again
          </button>
        </div>
      )}

      {backendDown && !loading && !authExpired && (
        <div className="sg-alert sg-auth-error ml-alert-spaced" role="alert">
          <div className="ml-alert-head">
            <Unplug size={18} />
            <strong>Backend unreachable</strong>
          </div>
          <p className="sg-small ml-alert-body">
            Models can't load because the backend isn't responding at <code>{getApiBase()}</code>.{' '}
            The backend is <code>{getBackendUrl()}</code> — set <code>VITE_BACKEND_URL</code> in{' '}
            <code>.env</code> to point elsewhere, or run <code>npm start</code> in{' '}
            <code>backend/</code> for localhost.
          </p>
          <button
            className="sg-btn sg-btn-primary"
            onClick={() => {
              setBackendDown(false);
              setLoading(true);
              refresh();
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Step 0 FIRST: one-time engine setup (runs on the user's machine) ── */}
      {/* NOTE: uses localEngineReady (localhost), NOT the remote backend's engineReady —
          the engine must be on the USER'S machine. Remote Render status is irrelevant.
          When the local backend is down, offer the one-click launcher download instead
          of a dead-end error — the launcher starts everything automatically. */}
      {!localEngineReady && (
        <div className="sg-card sg-card-pad ml-engine-card">
          <div className="sg-small ml-engine-head">
            <Server size={17} aria-hidden="true" />
            <div>
              <strong>Step 0 — one-time engine setup</strong>
              <p>
                Dark Matter ships its own tiny inference engine, the Infinity AI Runner. It
                downloads automatically the first time you press Run on a model — after that, models
                run directly on your computer, no Ollama needed.
              </p>
            </div>
          </div>
          {!localBackendUp ? (
            <div className="ml-launcher-block">
              <p className="sg-small">
                Download the one-click launcher for your computer and run it — it starts the Dark
                Matter backend and downloads the engine automatically. Nothing to set up by hand.
              </p>
              <button className="sg-btn sg-btn-primary" onClick={downloadEngineLauncher}>
                <Download size={15} />
                Download launcher for {userOSLabel()}
              </button>
              <p className="sg-small ml-launcher-note">
                Run the downloaded file, then come back here — this page detects it automatically.
                {detectUserOS() !== 'windows' && (
                  <>
                    {' '}
                    On macOS/Linux, run it with: <code>sh ~/Downloads/dark-matter-engine.sh</code>
                  </>
                )}
              </p>
            </div>
          ) : engineDl && engineDl.status !== 'idle' ? (
            <div className="sg-pull-progress">
              <ProgressBar value={engineDl.progress || 0} />
              <span>
                {engineDl.status === 'error'
                  ? `Failed: ${engineDl.error || 'unknown error'}`
                  : `Downloading engine… ${Math.round((engineDl.progress || 0) * 100)}%`}
              </span>
            </div>
          ) : (
            <button
              className="sg-btn sg-btn-primary"
              onClick={startEngineDownload}
              disabled={busyEngine}
            >
              {busyEngine ? <Loader2 size={15} className="sg-spin" /> : <Download size={15} />}
              Download engine
            </button>
          )}
        </div>
      )}

      {/* ── Infinity AI Runner: local PC companion ─────────────────── */}
      <RunnerStatusCard />

      {/* ── Brain Slots: three independent brains ──────────────────── */}
      <div className="ml-brain-section">
        <div className="sg-remote-head ml-brain-head">
          <Zap size={18} />
          <div>
            <strong>Brain Slots — three brains, each with local + Kaggle options</strong>
            <p>
              <b>Hunt AI</b> uses all three brains. <b>Infinity Chat</b> uses only Vision.
              <b> Control</b> uses Vision + Grounding — Grounding is optional: when its
              slot is empty, the Vision brain handles click coordinates. Each slot runs
              on a local model <b> or</b> its own Kaggle link — your choice per slot.
            </p>
          </div>
        </div>
        {brainSlots ? (
          <div className="ml-slot-list">
            {Object.entries(brainSlots).map(([slotId, slot]) => (
              <BrainSlotCard
                key={slotId}
                slotId={slotId}
                slot={slot}
                sources={slotSources}
                slotServers={slotServers}
                slotSetup={slotSetup}
                download={download}
                downloadedIds={downloadedIds}
                engineReady={engineReady}
                slotBusy={slotBusy}
                kaggleBusy={kaggleBusy}
                kaggleMsg={kaggleMsg}
                onDownload={startDownload}
                onCancelDownload={cancelDownload}
                onPauseDownload={pauseDownload}
                onResumeDownload={resumeDownload}
                onRemove={removeLocal}
                onRunSlot={runSlotHandler}
                onStopSlot={stopSlotHandler}
                onDownloadAndRun={downloadAndRunHandler}
                onKaggleConnect={connectSlotKaggleHandler}
                onKaggleDisconnect={disconnectSlotKaggleHandler}
                onKaggleTest={testSlotKaggle}
                onKaggleSaveToAccount={saveKaggleToAccountHandler}
                accountLinks={accountLinks}
                kaggleUrl={kaggleUrls[slotId] || ''}
                setKaggleUrl={v => setKaggleUrls(m => ({ ...m, [slotId]: v }))}
                kaggleName={kaggleNames[slotId] || ''}
                setKaggleName={v => setKaggleNames(m => ({ ...m, [slotId]: v }))}
                groundingEnabled={groundingEnabled}
                onToggleGrounding={toggleGrounding}
              />
            ))}
          </div>
        ) : backendDown && !loading ? (
          <div className="sg-small ml-empty-note">
            Brain slots unavailable — backend unreachable (see notice above).
          </div>
        ) : (
          <div className="sg-small ml-empty-note">Loading brain slots…</div>
        )}
      </div>

      {/* Brain assignments: which products use which brains, live status */}
      <BrainAssignmentsPanel slotServers={slotServers} slotSources={slotSources} />

      {/* Currently running model */}
      {running && (
        <div className="sg-card sg-card-pad sg-running-banner">
          <div className="sg-running-info">
            <span className="sg-pulse-dot" />
            <div>
              <strong>{running.name || running.modelId}</strong>
              <span className="sg-small">
                Running on localhost{running.port ? ` :${running.port}` : ''} — thinking for Hunt AI
                and Infinity AI
              </span>
            </div>
          </div>
          <button className="sg-btn sg-btn-ghost" onClick={stop} disabled={busyModel === '__stop'}>
            {busyModel === '__stop' ? (
              <Loader2 size={15} className="sg-spin" />
            ) : (
              <Square size={15} />
            )}
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
          <span className="sg-small">
            <b>Brain fallback:</b>
          </span>
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
          <span className="sg-device-os">
            detected in your browser — the server never sees this
          </span>
        </div>
        <div className="sg-device-specs">
          <div className="sg-device-spec">
            <Cpu size={15} />
            <span>{browserDevice.cores ? `${browserDevice.cores} CPU cores` : 'CPU: unknown'}</span>
          </div>
          <div className="sg-device-spec">
            <MemoryStick size={15} />
            <span>
              {browserDevice.ramGB ? `${formatBrowserRam(browserDevice)} RAM` : 'RAM: unknown'}
            </span>
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

      {/* ── Category filter tabs: separate models by brain role ─── */}
      <div className="ml-cat-tabs" role="tablist" aria-label="Filter models by brain role">
        {CATEGORY_TABS.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={catFilter === t.id}
            className={`sg-btn ml-cat-tab ${catFilter === t.id ? 'sg-btn-primary' : 'sg-btn-ghost'}`}
            onClick={() => setCatFilter(t.id)}
            title={t.role}
          >
            <span aria-hidden="true" className="ml-tab-icon">
              {t.icon}
            </span>
            <span className="ml-cat-tab-text">
              <strong>
                {t.label}{' '}
                <span
                  className="ml-cat-fit"
                  title="How many of these models fit this device (browser-detected specs)."
                >
                  {catFitCounts[t.id]} fit
                </span>
              </strong>
              <small>{t.role}</small>
            </span>
          </button>
        ))}
      </div>

      {/* Model catalog: compatible ON TOP, incompatible BELOW */}
      <div className="sg-h2">
        {catFilter === 'all'
          ? `Runs on your device (${compatibleModels.length})`
          : `${CATEGORY_TABS.find(t => t.id === catFilter)?.label} — fits your device (${compatibleModels.length})`}
      </div>
      {catFilter !== 'all' && (
        <p className="sg-small ml-filter-note">
          Filtered for <b>this</b> device
          {browserDevice.ramGB
            ? ` (${formatBrowserRam(browserDevice)} RAM${browserDevice.ramCapped ? ', browser-capped' : ''})`
            : ''}{' '}
          — only models your machine can comfortably run are shown; heavier ones are collapsed
          below.
        </p>
      )}
      {loading ? (
        <div className="sg-loading-box">
          <Loader2 className="sg-spin" size={22} /> Loading models…
        </div>
      ) : (
        <>
          <div className="sg-model-grid">
            {compatibleModels.map(model => (
              <ModelCard key={model.id} model={model} {...cardProps} />
            ))}
          </div>
          {compatibleModels.length === 0 && !loading && (
            <p className="sg-small">
              Nothing fits comfortably — the heavier models below still download and run.
            </p>
          )}

          {/* Device-aware heavy section: on a single category tab the too-heavy
              models collapse behind an expander so the tab shows exactly what
              fits this device; on "All" the full ranked view stays visible. */}
          {heavyModels.length > 0 && catFilter === 'all' && (
            <>
              <div className="sg-h2 ml-sec-h2">
                Too heavy for this device ({heavyModels.length})
              </div>
              <p className="sg-small">
                These need more RAM than your browser reports. They still download and run — just
                expect swapping, or run them on a bigger machine.
              </p>
              <div className="sg-model-grid sg-model-grid-heavy">
                {heavyModels.map(model => (
                  <ModelCard key={model.id} model={model} {...cardProps} />
                ))}
              </div>
            </>
          )}
          {heavyModels.length > 0 && catFilter !== 'all' && (
            <div className="ml-heavy-collapse">
              <button
                type="button"
                className="sg-btn sg-btn-ghost ml-heavy-toggle"
                onClick={() => setShowHeavy(v => !v)}
                aria-expanded={showHeavy}
              >
                {showHeavy ? 'Hide' : 'Show'} {heavyModels.length} too heavy for this device
                <span className="sg-small ml-toggle-arrow">{showHeavy ? ' ▲' : ' ▼'}</span>
              </button>
              {showHeavy && (
                <>
                  <p className="sg-small">
                    These need more RAM than your browser reports (
                    {browserDevice.ramGB
                      ? `${formatBrowserRam(browserDevice)} detected`
                      : 'RAM unknown'}
                    ). They still download and run — just expect swapping, or run them on a bigger
                    machine.
                  </p>
                  <div className="sg-model-grid sg-model-grid-heavy">
                    {heavyModels.map(model => (
                      <ModelCard key={model.id} model={model} {...cardProps} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* Custom model */}
      <div className="sg-h2 ml-sec-h2-lg">Your own model</div>
      <form className="sg-custom-form" onSubmit={addCustom}>
        <h4>
          <Plus size={15} /> Add any public Hugging Face GGUF
        </h4>
        <div className="sg-form-row">
          <input
            className="sg-input"
            placeholder="Name (e.g. My 14B coder)"
            value={customForm.name}
            onChange={e => setCustomForm({ ...customForm, name: e.target.value })}
          />
          <input
            className="sg-input"
            placeholder="RAM needed (GB, optional)"
            type="number"
            min="1"
            value={customForm.ramGB}
            onChange={e => setCustomForm({ ...customForm, ramGB: e.target.value })}
          />
        </div>
        <div className="sg-form-row">
          <input
            className="sg-input"
            placeholder="Hugging Face repo (e.g. bartowski/Qwen3-8B-GGUF)"
            value={customForm.repo}
            onChange={e => setCustomForm({ ...customForm, repo: e.target.value })}
          />
        </div>
        <div className="sg-form-row">
          <input
            className="sg-input"
            placeholder="GGUF file name (e.g. Qwen3-8B-Q4_K_M.gguf)"
            value={customForm.file}
            onChange={e => setCustomForm({ ...customForm, file: e.target.value })}
          />
        </div>
        <button className="sg-btn sg-btn-ghost" type="submit" disabled={customBusy}>
          {customBusy ? <Loader2 size={15} className="sg-spin" /> : <Plus size={15} />} Add model
        </button>
      </form>
    </div>
  );
}
