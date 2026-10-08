/**
 * deviceDetect.js — device specs detected from the BROWSER ONLY.
 *
 * Standing product rule: the Models page must never ask the backend what the
 * user's machine looks like. Three browser signals are used:
 *   - navigator.hardwareConcurrency → CPU cores
 *   - navigator.deviceMemory        → RAM in GB (Chrome caps this at 8 —
 *                                     handled honestly below)
 *   - WebGL WEBGL_debug_renderer_info → GPU renderer string
 *
 * Everything exported here is pure and DOM-free at import time, so the same
 * ranking logic is unit-tested in node with stubbed navigator values
 * (see backend/test/browserDeviceDetect.test.js).
 */

export const COMPAT_ORDER = { ready: 0, tight: 1, risky: 2, blocked: 3 };

/**
 * Detect the device from browser APIs. Accepts injected navigator + a
 * WebGL-renderer getter so tests can stub any fake device.
 *
 * @param {object} nav — navigator-like { hardwareConcurrency, deviceMemory }
 * @param {() => string|null} getGpuString — returns the UNMASKED_RENDERER_WEBGL string
 */
export function detectBrowserDevice(
  nav = typeof navigator !== 'undefined' ? navigator : {},
  getGpuString = defaultGetGpuString
) {
  const cores = Number(nav?.hardwareConcurrency);
  const ramRaw = Number(nav?.deviceMemory);
  // Chrome quantizes deviceMemory and reports exactly 8 for anything >= 8GB
  // (fingerprinting resistance). A bare "8" is therefore ambiguous — the real
  // machine may have much more. Values above 8 (Firefox) are trustworthy.
  const ramCapped = Number.isFinite(ramRaw) && ramRaw === 8;
  const ramGB = Number.isFinite(ramRaw) && ramRaw > 0 ? ramRaw : null;
  const gpu = getGpuString ? getGpuString() : null;
  return {
    source: 'browser',
    cores: Number.isFinite(cores) && cores > 0 ? Math.round(cores) : null,
    ramGB,
    ramCapped,
    gpu: gpu || null,
    hasGpu: Boolean(gpu && !/swiftshader|llvmpipe|software|basic render/i.test(gpu)),
  };
}

/** Default WebGL renderer probe. Never throws; returns null when unavailable. */
export function defaultGetGpuString() {
  try {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return null;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (!ext) return null;
    return gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || null;
  } catch {
    return null;
  }
}

/**
 * Compute how big a model this device can hold, and a one-line verdict.
 * Rule: keep ~20% of RAM for the OS + ~1.5GB for KV-cache/context overhead.
 */
export function browserBudget(device) {
  const ramGB = device?.ramGB;
  if (!ramGB) {
    return {
      maxModelGB: null,
      verdict:
        'Could not read this device\u2019s RAM from the browser — models are listed smallest-first; start with an 8B.',
    };
  }
  const maxModelGB = Math.max(0, Math.floor(ramGB * 0.8 - 1.5));
  let verdict;
  if (device.ramCapped) {
    verdict =
      `Your browser reports 8 GB RAM (browsers cap this number for privacy — you may have more). ` +
      `Ranked conservatively: 8B models will fly${device.hasGpu ? ', bigger ones likely fit too' : ''}.`;
  } else if (ramGB >= 64) {
    verdict = 'Workstation-class memory — every model in the library fits, including 70B.';
  } else if (ramGB >= 32) {
    verdict = `Comfortably runs models up to ~${maxModelGB} GB — the 32B class and below. 70B will not fit.`;
  } else if (ramGB >= 16) {
    verdict = `Best with 8B–14B models (~${maxModelGB} GB max). 24B+ will feel heavy — close other apps first.`;
  } else if (ramGB >= 8) {
    verdict = `Stick to 8B models (~${maxModelGB} GB max). Anything bigger risks running out of memory.`;
  } else {
    verdict = `Very limited RAM (~${maxModelGB} GB usable for a model). Only small 8B models, and close everything else.`;
  }
  return { maxModelGB, verdict };
}

/**
 * Estimate GPU offload for a model given a KNOWN VRAM size.
 * Same math as the backend (deviceInfo.js). The browser itself cannot see
 * VRAM, so the Models page feeds this with the backend-detected VRAM when
 * available; otherwise the boolean hasGpu rule in rankModelForBrowser stands.
 * @returns { mode: 'full'|'partial'|'cpu', offloadPct, estVramGB, fullNeedGB }
 */
export function estimateVramFit(model, gpuVramGB) {
  const fullNeedGB = Number(model?.requirements?.vramGB) || 0;
  if (fullNeedGB <= 0 || !gpuVramGB || gpuVramGB <= 0) {
    return { mode: 'cpu', offloadPct: 0, estVramGB: 0, fullNeedGB };
  }
  if (gpuVramGB >= fullNeedGB) {
    return { mode: 'full', offloadPct: 100, estVramGB: fullNeedGB, fullNeedGB };
  }
  const usable = Math.max(gpuVramGB - 0.5, 0);
  const offloadPct = Math.max(5, Math.floor((usable / fullNeedGB) * 100));
  return { mode: 'partial', offloadPct, estVramGB: Math.round(usable * 10) / 10, fullNeedGB };
}

/**
 * Rank ONE model against the browser-detected device.
 * Same conservative rules as the backend (deviceInfo.js) so both agree:
 *   blocked — weights (+35% runtime overhead) cannot fit in RAM, or a
 *             GPU is required but none was detected
 *   risky   — needs more RAM than the device has (may start, may OOM)
 *   tight   — needs > 60% of RAM (runs, but heavy)
 *   ready   — fits comfortably
 */
export function rankModelForBrowser(model, device) {
  const req = model.requirements || {};
  const reasons = [];
  const ramGB = Number(req.ramGB) || 8;
  const vramGB = Number(req.vramGB) || 0;
  const deviceRam = Number(device?.ramGB) || 0;

  // Unknown RAM: rank purely by model size, smallest first — never block.
  if (!deviceRam) {
    return {
      verdict: (model.sizeGB || 0) <= 5 ? 'ready' : 'tight',
      reasons: ['Browser did not expose RAM — ranked by model size only.'],
    };
  }

  if (req.gpuRequired && !device.hasGpu) {
    reasons.push('This model requires a GPU, but none was detected in your browser.');
    return { verdict: 'blocked', reasons };
  }

  if (model.sizeGB && model.sizeGB * 1.35 > deviceRam) {
    reasons.push(
      `The model file is ~${model.sizeGB} GB — it cannot be loaded into this device\u2019s ${deviceRam} GB of RAM.`
    );
    return { verdict: 'blocked', reasons };
  }

  const ramRatio = ramGB / deviceRam;
  if (ramRatio > 1) {
    reasons.push(
      `Needs ~${ramGB} GB RAM but this device has ${deviceRam} GB — it might start, but could run out of memory under load.`
    );
    return { verdict: 'risky', reasons };
  }

  if (vramGB > 0 && !device.hasGpu) {
    // No GPU: the model still runs (llama.cpp CPU fallback), just slower.
    // That is a performance warning (tight), not a crash risk.
    reasons.push(
      `Built for GPU offload (${vramGB} GB VRAM ideal) but no GPU was detected — it will run on CPU instead (slower).`
    );
    return { verdict: 'tight', reasons };
  }

  if (ramRatio > 0.6) {
    reasons.push(
      `Will use ~${ramGB} GB of ${deviceRam} GB RAM — runs, but avoid heavy apps alongside it.`
    );
    return { verdict: 'tight', reasons };
  }

  reasons.push(
    vramGB === 0
      ? 'Runs comfortably on CPU — no GPU required.'
      : 'Fits comfortably in this device\u2019s memory.'
  );
  return { verdict: 'ready', reasons };
}

const isCompatibleVerdict = verdict => verdict === 'ready' || verdict === 'tight';

/**
 * Sort models for the catalog: compatible (ready → tight) ON TOP, then
 * incompatible (risky → blocked) BELOW. Within a verdict, bigger models
 * first — the user wants the most capable model that fits.
 * Every model stays downloadable and runnable regardless of verdict.
 */
export function sortModelsByBrowserCompat(models, device) {
  return [...models]
    .map(model => {
      const compat = rankModelForBrowser(model, device);
      return {
        ...model,
        browserCompat: compat,
        browserCompatible: isCompatibleVerdict(compat.verdict),
      };
    })
    .sort((a, b) => {
      const order = COMPAT_ORDER[a.browserCompat.verdict] - COMPAT_ORDER[b.browserCompat.verdict];
      if (order !== 0) return order;
      return (b.sizeGB || 0) - (a.sizeGB || 0);
    });
}

/** Human-friendly RAM label, honest about the browser cap. */
export function formatBrowserRam(device) {
  if (!device?.ramGB) return 'Unknown';
  return device.ramCapped ? `${device.ramGB} GB+` : `${device.ramGB} GB`;
}
