/**
 * tcpClockSkewAnalyzer.js — TCP timestamp clock-skew analysis.
 *
 * Fits a line through captured TCP timestamp (TSval) samples versus wall
 * clock to measure the remote host's clock skew in parts-per-million,
 * estimate uptime from the timestamp counter, and flag quantized/emulated
 * clocks that suggest a virtualized host.
 *
 * This module is a pure offline analyzer: it consumes captured
 * {tsval, observedAtMs} samples and returns a structured verdict.
 * It performs no network I/O.
 */

const MIN_SAMPLES = 5;

/**
 * Least-squares fit of y = a + b*x. Returns {slope, intercept, r2}.
 */
function linearFit(xs, ys) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let sst = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    sst += (ys[i] - my) ** 2;
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = my - slope * mx;
  let sse = 0;
  for (let i = 0; i < n; i++) sse += (ys[i] - (intercept + slope * xs[i])) ** 2;
  const r2 = sst === 0 ? 0 : 1 - sse / sst;
  return { slope, intercept, r2 };
}

/**
 * Analyze TCP timestamp clock skew from captured samples.
 * @param {{host?: string, samples: Array<{tsval: number, observedAtMs: number}>, hz?: number}} input
 *   hz = timestamp ticks per second (usually 1000 on Linux, 100 on some BSDs).
 */
export function analyzeClockSkew({ host = null, samples = [], hz = 1000 } = {}) {
  if (!Array.isArray(samples) || samples.length < MIN_SAMPLES) {
    return {
      host,
      error: `Need at least ${MIN_SAMPLES} samples; got ${samples.length}.`,
      confidence: 'none',
    };
  }
  const sorted = [...samples]
    .filter(s => Number.isFinite(s.tsval) && Number.isFinite(s.observedAtMs))
    .sort((a, b) => a.observedAtMs - b.observedAtMs);
  if (sorted.length < MIN_SAMPLES) {
    return { host, error: 'Too few valid samples after filtering.', confidence: 'none' };
  }

  // Unwrap 32-bit TSval rollover.
  const ts = [sorted[0].tsval];
  for (let i = 1; i < sorted.length; i++) {
    let v = sorted[i].tsval;
    while (v < ts[i - 1] - 2 ** 31) v += 2 ** 32;
    ts.push(v);
  }
  const wall = sorted.map(s => s.observedAtMs);

  const { slope, r2 } = linearFit(wall, ts);
  const expectedSlope = hz / 1000; // tsval ticks per wall millisecond
  const skewPpm = expectedSlope === 0 ? 0 : (slope / expectedSlope - 1) * 1e6;

  const spanHours = (wall[wall.length - 1] - wall[0]) / 3600000;
  const uptimeHours = ts[ts.length - 1] / hz / 3600;

  // Virtualization tells: emulated clocks quantize TSval updates.
  const deltas = [];
  for (let i = 1; i < ts.length; i++) deltas.push(ts[i] - ts[i - 1]);
  const stuck = deltas.filter(d => d === 0).length;
  const quantized = deltas.filter(d => d > 0 && d % 10 === 0).length;
  const quantRatio = deltas.length ? quantized / deltas.length : 0;
  const stuckRatio = deltas.length ? stuck / deltas.length : 0;

  const virtualSignals = [];
  if (quantRatio > 0.7)
    virtualSignals.push(
      `TSval advances in 10ms-quantized steps ${(quantRatio * 100).toFixed(0)}% of the time — emulated clock.`
    );
  if (stuckRatio > 0.5)
    virtualSignals.push(
      `TSval frozen for ${(stuckRatio * 100).toFixed(0)}% of intervals — coarse virtual timer.`
    );
  const likelyVirtualized = virtualSignals.length > 0;

  const confidence = r2 > 0.999 && spanHours > 0.05 ? 'high' : r2 > 0.99 ? 'medium' : 'low';

  return {
    host,
    confidence,
    skewPpm: Number(skewPpm.toFixed(1)),
    skewDirection: skewPpm > 1 ? 'fast' : skewPpm < -1 ? 'slow' : 'nominal',
    fitQualityR2: Number(r2.toFixed(5)),
    sampleCount: sorted.length,
    captureSpanHours: Number(spanHours.toFixed(3)),
    estimatedUptimeHours: Number(uptimeHours.toFixed(1)),
    estimatedUptimeDays: Number((uptimeHours / 24).toFixed(1)),
    likelyVirtualized,
    virtualSignals,
    evidence: `TSval advances at ${slope.toFixed(4)} ticks/ms vs expected ${expectedSlope} (${skewPpm >= 0 ? '+' : ''}${skewPpm.toFixed(1)} ppm); counter implies ~${uptimeHours < 24 ? `${uptimeHours.toFixed(1)}h` : `${(uptimeHours / 24).toFixed(1)}d`} uptime.`,
    caveats: [
      'NTP corrections and frequency scaling shift apparent skew; compare hosts measured in the same window.',
      'Uptime from TSval assumes the counter started at boot (true on Linux, not on all stacks).',
    ],
  };
}

export const TCP_CLOCK_SKEW_ANALYZER = { analyzeClockSkew, MIN_SAMPLES };
export default TCP_CLOCK_SKEW_ANALYZER;
