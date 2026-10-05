/**
 * tarpitDetector.js — Honeypot tarpitting behavior detector.
 *
 * Identifies tarpit-style defenses (LaBrea-style connection holding,
 * Endlessh-style character-at-a-time SSH banners, artificial per-response
 * delays) from captured timing and banner data, and labels the service so
 * the hunt planner stops wasting scan budget on decoys.
 *
 * This module is a pure offline analyzer: it consumes captured timing
 * measurements and banners and returns a structured verdict. It performs
 * no network I/O and initiates no connections.
 */

const BANNER_TARPIT_MS = 15000; // banner slower than this ≈ deliberate stalling
const RESPONSE_TARPIT_MS = 5000; // per-response delay slower than this ≈ artificial
const ENDLESSH_CHARS_PER_SEC = 5; // Endlessh sends banner ~1 char per few seconds

/**
 * Detect tarpit behavior from captured service timing data.
 * @param {{host: string, port: number, service?: string, bannerDelayMs?: number, bannerCharsPerSec?: number, banner?: string, responseDelaysMs?: number[], notes?: string}} input
 */
export function detectTarpit({
  host,
  port,
  service = 'unknown',
  bannerDelayMs = 0,
  bannerCharsPerSec = null,
  banner = '',
  responseDelaysMs = [],
  notes = '',
} = {}) {
  const indicators = [];
  let score = 0;

  if (bannerDelayMs >= BANNER_TARPIT_MS) {
    score += 3;
    indicators.push({
      type: 'banner-tarpit',
      severity: 'high',
      detail: `Banner took ${(bannerDelayMs / 1000).toFixed(1)}s to arrive (threshold ${BANNER_TARPIT_MS / 1000}s) — deliberate stalling, not a slow network.`,
    });
  } else if (bannerDelayMs >= 5000) {
    score += 1;
    indicators.push({
      type: 'slow-banner',
      severity: 'medium',
      detail: `Banner delayed ${(bannerDelayMs / 1000).toFixed(1)}s — suspicious; could be load or early tarpit behavior.`,
    });
  }

  if (bannerCharsPerSec !== null && bannerCharsPerSec <= ENDLESSH_CHARS_PER_SEC && banner.length > 0) {
    score += 3;
    indicators.push({
      type: 'endlessh-style-drip',
      severity: 'high',
      detail: `Banner delivered at ~${bannerCharsPerSec} chars/sec — matches Endlessh-style SSH tarpits that drip one line at a time.`,
    });
  }

  if (responseDelaysMs.length >= 3) {
    const avg = responseDelaysMs.reduce((a, b) => a + b, 0) / responseDelaysMs.length;
    const maxDev = Math.max(...responseDelaysMs.map((d) => Math.abs(d - avg)));
    const uniform = avg >= RESPONSE_TARPIT_MS && maxDev < avg * 0.25;
    if (uniform) {
      score += 2;
      indicators.push({
        type: 'uniform-response-delay',
        severity: 'medium',
        detail: `${responseDelaysMs.length} responses each delayed ~${(avg / 1000).toFixed(1)}s with ${(maxDev).toFixed(0)}ms deviation — artificial, uniform throttling, not congestion.`,
      });
    } else if (avg >= RESPONSE_TARPIT_MS) {
      score += 1;
      indicators.push({
        type: 'slow-responses',
        severity: 'low',
        detail: `Average response delay ${(avg / 1000).toFixed(1)}s — slow; inconclusive without uniformity.`,
      });
    }
  }

  const isTarpit = score >= 3;
  const confidence = score >= 5 ? 'high' : score >= 3 ? 'medium' : score >= 1 ? 'low' : 'none';

  return {
    host,
    port,
    service,
    isTarpit,
    confidence,
    tarpitScore: score,
    indicators,
    bannerPreview: banner ? String(banner).slice(0, 120) : null,
    notes,
    recommendation: isTarpit
      ? 'Tarpit confirmed — label as decoy: exclude from further active scanning, apply strict rate limits, do not retry aggressively.'
      : score > 0
        ? 'Weak tarpit signals — probe once more with backoff; escalate to decoy status only if delays repeat uniformly.'
        : 'No tarpit behavior observed — normal scan pacing applies.',
  };
}

export const TARPIT_DETECTOR = { detectTarpit, BANNER_TARPIT_MS, RESPONSE_TARPIT_MS };
export default TARPIT_DETECTOR;
