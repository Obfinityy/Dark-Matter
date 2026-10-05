/**
 * anycastDetector.js — Anycast vs unicast deployment detection.
 *
 * Classifies a target IP/hostname as anycast-routed or unicast-routed from
 * already-measured round-trip times taken at multiple vantage points.
 * Heuristic: an anycast address answers from the *nearest* point of
 * presence, so distant vantage points all see low RTT with weak geographic
 * correlation; a unicast address shows RTT that grows with distance from
 * the single origin and high variance across continents.
 *
 * This module is a pure offline analyzer: it consumes captured latency
 * measurements and returns a structured verdict. It performs no network I/O.
 */

const MIN_VANTAGE_POINTS = 3;

/**
 * Great-circle distance in kilometres between two lat/lon points.
 */
function haversineKm(lat1, lon1, lat2, lon2) {
  const rad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Pearson correlation coefficient between two equal-length arrays.
 */
function pearson(xs, ys) {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0; let dx = 0; let dy = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); dx += (xs[i] - mx) ** 2; dy += (ys[i] - my) ** 2; }
  if (dx === 0 || dy === 0) return 0;
  return num / Math.sqrt(dx * dy);
}

/**
 * Detect anycast vs unicast routing from multi-vantage RTT measurements.
 * @param {{target: string, measurements: Array<{vantage: string, region?: string, lat: number, lon: number, rttMs: number}>, asnInfo?: {asn?: string, org?: string}}} input
 */
export function detectAnycast({ target, measurements = [], asnInfo = {} } = {}) {
  if (!Array.isArray(measurements) || measurements.length < MIN_VANTAGE_POINTS) {
    return {
      target,
      verdict: 'insufficient-data',
      confidence: 'low',
      error: `Need at least ${MIN_VANTAGE_POINTS} vantage points; got ${measurements.length}.`,
    };
  }

  const valid = measurements.filter((m) => Number.isFinite(m.rttMs) && m.rttMs > 0 && Number.isFinite(m.lat) && Number.isFinite(m.lon));
  if (valid.length < MIN_VANTAGE_POINTS) {
    return { target, verdict: 'insufficient-data', confidence: 'low', error: 'Too few usable measurements with coordinates and RTT.' };
  }

  const rtts = valid.map((m) => m.rttMs);
  const mean = rtts.reduce((a, b) => a + b, 0) / rtts.length;
  const variance = rtts.reduce((a, b) => a + (b - mean) ** 2, 0) / rtts.length;
  const std = Math.sqrt(variance);
  const cv = mean > 0 ? std / mean : 0;
  const maxRtt = Math.max(...rtts);
  const minRtt = Math.min(...rtts);
  const nearVantages = valid.filter((m) => m.rttMs < 30);

  // For unicast, RTT should correlate with distance from some single origin.
  // Approximate: correlate RTT with distance to the geographic centroid — a
  // strong positive correlation is consistent with a single origin.
  const cLat = valid.reduce((a, m) => a + m.lat, 0) / valid.length;
  const cLon = valid.reduce((a, m) => a + m.lon, 0) / valid.length;
  const distances = valid.map((m) => haversineKm(m.lat, m.lon, cLat, cLon));
  const geoCorrelation = pearson(distances, rtts);

  const distinctRegions = new Set(valid.map((m) => m.region || m.vantage)).size;
  const intercontinental = distinctRegions >= 3;

  let verdict; let score = 0; const evidence = [];
  // Anycast signals
  if (maxRtt < 100) { score += 2; evidence.push(`All vantage points see RTT under 100ms (max ${maxRtt.toFixed(1)}ms) despite geographic spread.`); }
  if (cv < 0.6) { score += 1; evidence.push(`Low RTT variance across vantages (CV ${cv.toFixed(2)}).`); }
  if (nearVantages.length >= 2 && intercontinental) { score += 2; evidence.push(`${nearVantages.length} distant vantage points each see <30ms — impossible from one origin.`); }
  if (Math.abs(geoCorrelation) < 0.3 && intercontinental) { score += 1; evidence.push(`RTT barely correlates with geography (r=${geoCorrelation.toFixed(2)}) — consistent with nearest-PoP routing.`); }
  // Unicast signals
  if (maxRtt > 200 && minRtt < 60) { score -= 2; evidence.push(`RTT spans ${minRtt.toFixed(1)}–${maxRtt.toFixed(1)}ms — far vantages pay real distance cost.`); }
  if (geoCorrelation > 0.6) { score -= 2; evidence.push(`RTT correlates with geographic distance (r=${geoCorrelation.toFixed(2)}) — single-origin behavior.`); }
  if (cv > 0.9) { score -= 1; evidence.push(`High RTT variance (CV ${cv.toFixed(2)}) across vantages.`); }

  if (score >= 3) verdict = 'anycast';
  else if (score <= -2) verdict = 'unicast';
  else verdict = 'uncertain';

  const confidence = valid.length >= 6 && Math.abs(score) >= 4 ? 'high'
    : valid.length >= 4 && Math.abs(score) >= 2 ? 'medium'
    : 'low';

  return {
    target,
    verdict,
    confidence,
    asn: asnInfo.asn || null,
    org: asnInfo.org || null,
    metrics: {
      vantagePoints: valid.length,
      distinctRegions,
      meanRttMs: Number(mean.toFixed(1)),
      maxRttMs: Number(maxRtt.toFixed(1)),
      minRttMs: Number(minRtt.toFixed(1)),
      coefficientOfVariation: Number(cv.toFixed(3)),
      geoCorrelation: Number(geoCorrelation.toFixed(3)),
      nearVantageCount: nearVantages.length,
    },
    evidence,
    recommendation: verdict === 'anycast'
      ? 'Anycast deployment: treat geolocation and single-origin assumptions as unreliable; fingerprint per-PoP, not per-IP.'
      : verdict === 'unicast'
        ? 'Unicast deployment: latency triangulation and geo-IP are usable for origin-region estimation.'
        : 'Inconclusive: add more intercontinental vantage points before drawing routing conclusions.',
  };
}

export const ANYCAST_DETECTOR = { detectAnycast, MIN_VANTAGE_POINTS };
export default ANYCAST_DETECTOR;
