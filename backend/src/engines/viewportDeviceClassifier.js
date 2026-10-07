/**
 * viewportDeviceClassifier.js — Viewport/DPR device classification engine.
 *
 * Classifies device classes from viewport dimensions and device-pixel-ratio
 * signals collected in an authorized client-side telemetry context (e.g. the
 * platform's own instrumented page during an engagement). This reveals which
 * device classes a target's infrastructure is tuned for — responsive
 * breakpoints, adaptive-serving branches, and mobile-vs-desktop targeting.
 *
 * Pure classification of collected signals; it collects nothing itself.
 */

/**
 * Reference viewport buckets (CSS pixels) per device class.
 */
const DEVICE_BUCKETS = [
  { deviceClass: 'phone', minWidth: 0, maxWidth: 480, typicalDpr: [1, 1.5, 2, 2.5, 3], note: 'Handset portrait viewports.' },
  { deviceClass: 'phablet', minWidth: 481, maxWidth: 768, typicalDpr: [1, 2, 3], note: 'Large phones / small tablets.' },
  { deviceClass: 'tablet', minWidth: 769, maxWidth: 1200, typicalDpr: [1, 1.5, 2], note: 'Tablet portrait and landscape.' },
  { deviceClass: 'laptop', minWidth: 1201, maxWidth: 1600, typicalDpr: [1, 1.25, 1.5, 2], note: 'Laptop and small desktop.' },
  { deviceClass: 'desktop', minWidth: 1601, maxWidth: 2560, typicalDpr: [1, 1.25, 1.5, 2], note: 'Desktop monitors.' },
  { deviceClass: 'ultrawide', minWidth: 2561, maxWidth: 7680, typicalDpr: [1, 1.5, 2], note: 'Ultrawide / multi-monitor.' },
];

/**
 * Classify a single viewport + DPR observation.
 * @param {{width: number, height: number, dpr?: number}} sample CSS-pixel viewport + device pixel ratio
 * @returns {{deviceClass: string, orientation: string, dpr: number, dprAnomaly: boolean, confidence: number}}
 */
export function classifyDevice(sample = {}) {
  const width = Number(sample.width);
  const height = Number(sample.height);
  const dpr = Number.isFinite(sample.dpr) && sample.dpr > 0 ? sample.dpr : 1;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { deviceClass: 'unknown', orientation: 'unknown', dpr, dprAnomaly: false, confidence: 0 };
  }
  const orientation = width >= height ? 'landscape' : 'portrait';
  // Foldables / split-screen: very narrow but tall, or very short but wide.
  const aspect = Math.max(width, height) / Math.min(width, height);
  let deviceClass = 'unknown';
  let confidence = 60;
  if (aspect >= 2.6 && Math.min(width, height) <= 480) {
    deviceClass = 'foldable';
    confidence = 70;
  } else {
    const bucket = DEVICE_BUCKETS.find((b) => width >= b.minWidth && width <= b.maxWidth);
    if (bucket) {
      deviceClass = bucket.deviceClass;
      const dprMatch = bucket.typicalDpr.some((t) => Math.abs(t - dpr) < 0.01);
      confidence = dprMatch ? 85 : 65;
    }
  }
  const bucket = DEVICE_BUCKETS.find((b) => b.deviceClass === deviceClass);
  const dprAnomaly = bucket ? !bucket.typicalDpr.some((t) => Math.abs(t - dpr) < 0.01) && deviceClass !== 'foldable' : false;
  return { deviceClass, orientation, dpr, dprAnomaly, confidence };
}

/**
 * Summarize orientation distribution across samples.
 * @param {{width: number, height: number, dpr?: number}[]} samples
 * @returns {{portrait: number, landscape: number, portraitPct: number, dominant: string}}
 */
export function orientationSplit(samples = []) {
  const list = Array.isArray(samples) ? samples : [];
  let portrait = 0;
  let landscape = 0;
  for (const s of list) {
    const c = classifyDevice(s);
    if (c.orientation === 'portrait') portrait++;
    else if (c.orientation === 'landscape') landscape++;
  }
  const total = portrait + landscape;
  return {
    portrait,
    landscape,
    portraitPct: total === 0 ? 0 : Math.round((portrait / total) * 10000) / 100,
    dominant: total === 0 ? 'none' : portrait >= landscape ? 'portrait' : 'landscape',
  };
}

/**
 * Infer adaptive-serving infrastructure: if the target serves different
 * markup/asset variants per device class, the observed content hashes will
 * cluster by device class.
 * @param {{deviceClass: string, contentHash: string}[]} observations
 * @returns {{adaptiveServing: boolean, variants: {deviceClass: string, hashes: string[]}[], note: string}}
 */
export function inferAdaptiveServing(observations = []) {
  const byClass = new Map();
  for (const o of Array.isArray(observations) ? observations : []) {
    if (!o || !o.deviceClass || !o.contentHash) continue;
    if (!byClass.has(o.deviceClass)) byClass.set(o.deviceClass, new Set());
    byClass.get(o.deviceClass).add(o.contentHash);
  }
  const variants = [...byClass.entries()].map(([deviceClass, hashes]) => ({ deviceClass, hashes: [...hashes] }));
  const distinctVariants = new Set(variants.flatMap((v) => v.hashes)).size;
  const adaptiveServing = variants.length >= 2 && distinctVariants >= 2;
  return {
    adaptiveServing,
    variants,
    note: adaptiveServing
      ? 'Target varies served content by device class — test each variant independently; mobile-only code paths are a common blind spot.'
      : 'No device-class content variation detected in the observed samples.',
  };
}

/**
 * Flag viewport samples that are statistical outliers versus a population.
 * @param {{width: number, height: number, dpr?: number}} sample
 * @param {{width: number, height: number, dpr?: number}[]} population
 * @returns {{outlier: boolean, zWidth: number, zHeight: number, note: string}}
 */
export function scoreViewportOutlier(sample = {}, population = []) {
  const pop = (Array.isArray(population) ? population : [])
    .filter((s) => Number.isFinite(s.width) && Number.isFinite(s.height));
  if (pop.length < 5) return { outlier: false, zWidth: 0, zHeight: 0, note: 'population too small' };
  const stats = (key) => {
    const vals = pop.map((s) => s[key]);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const std = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length) || 1;
    return { mean, std };
  };
  const sw = stats('width');
  const sh = stats('height');
  const zWidth = Math.abs((sample.width - sw.mean) / sw.std);
  const zHeight = Math.abs((sample.height - sh.mean) / sh.std);
  const outlier = zWidth >= 3 || zHeight >= 3;
  return {
    outlier,
    zWidth: Math.round(zWidth * 100) / 100,
    zHeight: Math.round(zHeight * 100) / 100,
    note: outlier ? 'Viewport is far outside the observed population — possible emulator, headless client, or unusual device.' : 'Viewport within normal population range.',
  };
}

export const VIEWPORT_CLASSIFIER = {
  classifyDevice,
  orientationSplit,
  inferAdaptiveServing,
  scoreViewportOutlier,
  DEVICE_BUCKETS,
};
