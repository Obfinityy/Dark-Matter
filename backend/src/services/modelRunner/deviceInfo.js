/**
 * deviceInfo.js — hardware detection + per-model compatibility ranking.
 *
 * The Models UI shows, for every model, whether THIS device can run it:
 *   ready   — fits comfortably (green)
 *   tight   — fits but close to the limit (amber)
 *   risky   — likely to thrash / OOM on this device (red)
 *   blocked — will not run: GPU required but none, or RAM far too low (grey)
 *
 * Detection sources (best-effort, never throws):
 *   RAM : node:os totalmem()
 *   GPU : nvidia-smi (Windows/Linux NVIDIA), system_profiler (macOS),
 *         /sys for some Linux iGPUs. Apple Silicon reports unified memory.
 */

import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const GB = 1024 ** 3;

function toGB(bytes) {
  return Math.round((bytes / GB) * 10) / 10;
}

/** Run a command with a short timeout; return stdout or null on any failure. */
async function tryRun(cmd, args, timeoutMs = 6000) {
  try {
    const { stdout } = await execFileAsync(cmd, args, { timeout: timeoutMs, maxBuffer: 1024 * 1024 });
    return String(stdout || '');
  } catch {
    return null;
  }
}

/**
 * Detect GPUs. Returns an array of { vendor, name, vramGB } — vramGB may be
 * null when the OS does not report it (e.g. Apple Silicon unified memory,
 * reported separately as unifiedGB).
 */
export async function detectGpus() {
  const gpus = [];
  const platform = os.platform();

  // NVIDIA (Windows + Linux): the reliable source.
  const smi = await tryRun('nvidia-smi', ['--query-gpu=name,memory.total', '--format=csv,noheader,nounits']);
  if (smi) {
    for (const line of smi.split('\n')) {
      const [name, memMb] = line.split(',').map((s) => s.trim());
      if (!name) continue;
      const vramGB = Number(memMb) > 0 ? Math.round((Number(memMb) / 1024) * 10) / 10 : null;
      gpus.push({ vendor: 'nvidia', name, vramGB });
    }
    if (gpus.length > 0) return gpus;
  }

  // macOS: system_profiler for discrete GPUs; Apple Silicon uses unified memory.
  if (platform === 'darwin') {
    const sp = await tryRun('system_profiler', ['SPDisplaysDataType', '-json']);
    if (sp) {
      try {
        const cards = JSON.parse(sp)?.SPDisplaysDataType || [];
        for (const card of cards) {
          const name = card.sppci_model || card._name || 'Apple GPU';
          const vramStr = card.spdisplays_vram || '';
          const vramMatch = String(vramStr).match(/([\d.]+)\s*GB/i);
          gpus.push({
            vendor: /apple/i.test(name) ? 'apple' : 'other',
            name,
            vramGB: vramMatch ? Number(vramMatch[1]) : null
          });
        }
      } catch { /* fall through */ }
    }
    // Apple Silicon fallback: unified memory chip, Metal always available.
    if (gpus.length === 0 && os.arch() === 'arm64') {
      gpus.push({ vendor: 'apple', name: 'Apple Silicon (unified memory)', vramGB: null, unified: true });
    }
    return gpus;
  }

  // Linux: try lspci for a hint when nvidia-smi is absent (AMD/Intel).
  if (platform === 'linux') {
    const lspci = await tryRun('lspci', []);
    if (lspci) {
      const match = lspci.match(/(VGA|3D|Display)[^\n]*(NVIDIA|AMD|Intel)[^\n]*/i);
      if (match) {
        const vendor = /nvidia/i.test(match[0]) ? 'nvidia' : /amd/i.test(match[0]) ? 'amd' : 'intel';
        gpus.push({ vendor, name: match[0].trim().slice(0, 120), vramGB: null });
      }
    }
  }

  return gpus;
}

/** Full device snapshot for the Models UI + ranking. */
export async function detectDevice() {
  const totalRamGB = toGB(os.totalmem());
  const freeRamGB = toGB(os.freemem());
  const gpus = await detectGpus();
  const primaryGpu = gpus[0] || null;
  return {
    os: os.platform(), // win32 | darwin | linux
    arch: os.arch(), // x64 | arm64
    cpuCount: os.cpus()?.length || 0,
    totalRamGB,
    freeRamGB,
    gpus,
    primaryGpu,
    hasNvidia: gpus.some((g) => g.vendor === 'nvidia'),
    // Effective memory llama.cpp can use: VRAM if a discrete NVIDIA GPU with
    // known VRAM exists, else system RAM (CPU offload / unified memory).
    label: `${os.platform()}-${os.arch()} · ${totalRamGB}GB RAM${primaryGpu ? ` · ${primaryGpu.name}` : ''}`
  };
}

/**
 * Estimate how much of the model can live on the GPU (partial offload).
 * llama.cpp offloads layer-by-layer, so a VRAM shortfall is gradual, not
 * binary: X% of layers on GPU + the rest on CPU.
 *
 * @param {object} model — catalog entry (requirements.vramGB = full offload)
 * @param {number|null} gpuVramGB — detected VRAM (null/0 = CPU only)
 * @returns { mode: 'full'|'partial'|'cpu', offloadPct, estVramGB, fullNeedGB }
 */
export function estimateVramFit(model, gpuVramGB) {
  const req = model.requirements || {};
  const fullNeedGB = Number(req.vramGB) || 0;
  if (fullNeedGB <= 0 || !gpuVramGB || gpuVramGB <= 0) {
    return { mode: 'cpu', offloadPct: 0, estVramGB: 0, fullNeedGB };
  }
  if (gpuVramGB >= fullNeedGB) {
    return { mode: 'full', offloadPct: 100, estVramGB: fullNeedGB, fullNeedGB };
  }
  // Partial offload: keep ~0.5GB headroom on the GPU for KV cache / context,
  // then fit as many layers as possible. Never report below 5% — even a
  // small GPU takes the embedding + output layers.
  const usable = Math.max(gpuVramGB - 0.5, 0);
  const offloadPct = Math.max(5, Math.floor((usable / fullNeedGB) * 100));
  return {
    mode: 'partial',
    offloadPct,
    estVramGB: Math.round(usable * 10) / 10,
    fullNeedGB
  };
}

/**
 * Rank ONE model against the device.
 * Returns { verdict, reasons[] } where verdict ∈ ready|tight|risky|blocked.
 *
 * Rules (conservative — a stuck OOM is worse than a warning):
 *   blocked: gpuRequired && no usable GPU
 *   blocked: model weights (+35% runtime overhead) cannot fit in total RAM
 *   risky:   model.ramGB exceeds total RAM (may OOM under load)
 *   tight:   model.ramGB > 60% of total RAM
 *   ready:   otherwise
 */
export function rankModelForDevice(model, device) {
  const req = model.requirements || {};
  const reasons = [];
  const ramGB = Number(req.ramGB) || 8;
  const vramGB = Number(req.vramGB) || 0;

  const usableGpu = (device.gpus || []).find(
    (g) => g.vendor === 'nvidia' || g.vendor === 'apple' || (g.vendor === 'amd' && g.vramGB)
  );

  if (req.gpuRequired && !usableGpu) {
    reasons.push('This model requires a GPU, but no usable GPU was detected on this device.');
    return { verdict: 'blocked', reasons };
  }

  // Hard block: the weights themselves (+runtime overhead) cannot fit in RAM.
  if (model.sizeGB && model.sizeGB * 1.35 > device.totalRamGB) {
    reasons.push(
      `The model file is ~${model.sizeGB}GB — it cannot even be loaded into this device's ${device.totalRamGB}GB of RAM.`
    );
    return { verdict: 'blocked', reasons };
  }

  const ramRatio = ramGB / Math.max(device.totalRamGB, 1);
  if (ramRatio > 1) {
    reasons.push(
      `This model needs ~${ramGB}GB RAM to run comfortably, but this device has ${device.totalRamGB}GB — it might start but could run out of memory under load. Risky for this device.`
    );
    return { verdict: 'risky', reasons };
  }

  // VRAM check when the model wants GPU offload and we know the VRAM size.
  // A shortfall is a SPEED problem (CPU fallback), not a crash risk —
  // verdict 'tight', never 'risky'. The estimator says HOW partial the
  // offload will be instead of a binary fits/doesn't-fit. Matches the
  // browser ranker.
  const gpuVram = usableGpu?.vramGB || null;
  const vramFit = estimateVramFit(model, gpuVram);
  if (vramGB > 0 && gpuVram && vramGB > gpuVram) {
    reasons.push(
      `Full GPU offload wants ${vramGB}GB VRAM, but the GPU has ${gpuVram}GB — ` +
      `about ${vramFit.offloadPct}% of layers will stay on the GPU and the rest ` +
      `run on CPU (slower, and needs more system RAM).`
    );
    return { verdict: 'tight', reasons, vramFit };
  }

  if (ramRatio > 0.6) {
    reasons.push(
      `The model will use ~${ramGB}GB of ${device.totalRamGB}GB RAM — it will run, but avoid heavy apps at the same time.`
    );
    return { verdict: 'tight', reasons };
  }

  if (vramGB > 0 && usableGpu && !gpuVram) {
    reasons.push('A GPU was detected (VRAM size unconfirmed) — the model should run fine.');
  } else if (vramGB === 0) {
    reasons.push('Runs comfortably on CPU — no GPU required.');
  } else if (vramFit.mode === 'full') {
    reasons.push(`Fits fully in the GPU's ${gpuVram}GB VRAM — maximum speed.`);
  }
  return { verdict: 'ready', reasons, vramFit };
}

/** Rank every library model for the device (for the library endpoint). */
export function rankLibraryForDevice(library, device) {
  return library.map((model) => ({ modelId: model.id, ...rankModelForDevice(model, device) }));
}
