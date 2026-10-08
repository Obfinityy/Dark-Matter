/**
 * webCodecsProber.js — WebCodecs capability analysis engine.
 *
 * Analyzes WebCodecs support descriptors collected from a client-side
 * telemetry context (e.g. the platform's own instrumented test page running
 * on an authorized engagement device) as a browser-stack fingerprint: the
 * set of supported video/audio codecs plus hardware-acceleration flags is
 * highly characteristic of browser family and version.
 *
 * Pure analysis of collected capability reports; it collects nothing itself.
 */

/**
 * Reference codec-support fingerprints per browser family.
 * Each entry lists codecs typically reported as supported by
 * VideoDecoder.isConfigSupported / AudioDecoder.isConfigSupported.
 */
const BROWSER_CODEC_PROFILES = [
  {
    family: 'chromium',
    video: [
      'avc1.42E01E',
      'avc1.640028',
      'hev1.1.6.L93.B0',
      'vp8',
      'vp09.00.10.08',
      'av01.0.05M.08',
    ],
    audio: ['mp4a.40.2', 'mp4a.40.5', 'opus', 'flac'],
    note: 'Chromium ships broad codec support incl. AV1 and HEVC (platform-dependent).',
  },
  {
    family: 'firefox',
    video: ['avc1.42E01E', 'vp8', 'vp09.00.10.08', 'av01.0.05M.08'],
    audio: ['mp4a.40.2', 'opus', 'flac'],
    note: 'Firefox lacks HEVC in WebCodecs; AV1 software decode common.',
  },
  {
    family: 'safari',
    video: ['avc1.42E01E', 'hev1.1.6.L93.B0', 'vp09.00.10.08'],
    audio: ['mp4a.40.2', 'mp4a.40.5', 'opus'],
    note: 'Safari favors H.264/HEVC/AAC; VP9/AV1 support arrived later and varies.',
  },
  {
    family: 'edge-chromium',
    video: [
      'avc1.42E01E',
      'avc1.640028',
      'hev1.1.6.L93.B0',
      'vp8',
      'vp09.00.10.08',
      'av01.0.05M.08',
    ],
    audio: ['mp4a.40.2', 'mp4a.40.5', 'opus', 'flac', 'ec-3'],
    note: 'Edge (Chromium) adds Dolby codecs (EC-3/AC-4) on Windows.',
  },
];

/**
 * Normalize a collected WebCodecs capability report.
 * @param {{video?: {codec: string, hardwareAccelerated?: boolean}[], audio?: {codec: string}[]}} report
 * @returns {{video: string[], audio: string[], hwAccelerated: string[], swOnly: string[]}}
 */
export function normalizeSupportMatrix(report = {}) {
  const video = [];
  const audio = [];
  const hwAccelerated = [];
  const swOnly = [];
  for (const v of Array.isArray(report.video) ? report.video : []) {
    if (!v || typeof v.codec !== 'string') continue;
    const codec = v.codec.trim();
    video.push(codec);
    if (v.hardwareAccelerated === true) hwAccelerated.push(codec);
    else if (v.hardwareAccelerated === false) swOnly.push(codec);
  }
  for (const a of Array.isArray(report.audio) ? report.audio : []) {
    if (!a || typeof a.codec !== 'string') continue;
    audio.push(a.codec.trim());
  }
  return {
    video: [...new Set(video)],
    audio: [...new Set(audio)],
    hwAccelerated: [...new Set(hwAccelerated)],
    swOnly: [...new Set(swOnly)],
  };
}

/**
 * Fingerprint the browser family from a normalized codec support matrix.
 * @param {{video: string[], audio: string[]}} matrix output of normalizeSupportMatrix
 * @returns {{family: string, confidence: number, note: string}[]}
 */
export function fingerprintBrowserStack(matrix = {}) {
  const video = new Set(
    (Array.isArray(matrix.video) ? matrix.video : []).map(c => c.toLowerCase())
  );
  const audio = new Set(
    (Array.isArray(matrix.audio) ? matrix.audio : []).map(c => c.toLowerCase())
  );
  const scored = [];
  for (const p of BROWSER_CODEC_PROFILES) {
    const pv = p.video.map(c => c.toLowerCase());
    const pa = p.audio.map(c => c.toLowerCase());
    const vHits = pv.filter(c => video.has(c)).length;
    const aHits = pa.filter(c => audio.has(c)).length;
    const vRecall = pv.length ? vHits / pv.length : 0;
    const aRecall = pa.length ? aHits / pa.length : 0;
    const confidence = Math.round((vRecall * 0.7 + aRecall * 0.3) * 100);
    if (confidence > 0)
      scored.push({ family: p.family, confidence: Math.min(95, confidence), note: p.note });
  }
  return scored.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Classify hardware-acceleration posture from the matrix.
 * @param {{video: string[], hwAccelerated: string[], swOnly: string[]}} matrix
 * @returns {{hwCount: number, swCount: number, unknownCount: number, posture: string}}
 */
export function classifyHardwareAcceleration(matrix = {}) {
  const video = Array.isArray(matrix.video) ? matrix.video : [];
  const hw = new Set(Array.isArray(matrix.hwAccelerated) ? matrix.hwAccelerated : []);
  const sw = new Set(Array.isArray(matrix.swOnly) ? matrix.swOnly : []);
  const hwCount = video.filter(c => hw.has(c)).length;
  const swCount = video.filter(c => sw.has(c)).length;
  const unknownCount = video.length - hwCount - swCount;
  const posture =
    hwCount >= Math.ceil(video.length / 2) && video.length > 0
      ? 'hardware-accelerated'
      : swCount > hwCount
        ? 'software-decode-heavy'
        : 'mixed-or-unknown';
  return { hwCount, swCount, unknownCount, posture };
}

/**
 * Estimate the fingerprint entropy (bits) of a codec support matrix against
 * the reference profiles — how identifying the combination is.
 * @param {{video: string[], audio: string[]}} matrix
 * @returns {{bits: number, uniqueness: 'low'|'medium'|'high', note: string}}
 */
export function scoreFingerprintUniqueness(matrix = {}) {
  const video = Array.isArray(matrix.video) ? matrix.video : [];
  const audio = Array.isArray(matrix.audio) ? matrix.audio : [];
  const total = video.length + audio.length;
  // Rare codecs (HEVC variants, EC-3, AV1 profiles) add more bits than baseline H.264/AAC.
  const rare = [...video, ...audio].filter(c => /hev1|hvc1|ec-3|ac-4|av01|vp09/i.test(c)).length;
  const baseline = total - rare;
  const bits = Math.round((baseline * 0.5 + rare * 2.2) * 10) / 10;
  const uniqueness = bits >= 12 ? 'high' : bits >= 6 ? 'medium' : 'low';
  return {
    bits,
    uniqueness,
    note:
      uniqueness === 'high'
        ? 'Codec combination is distinctive — strong browser-stack signal.'
        : uniqueness === 'medium'
          ? 'Codec combination is moderately identifying.'
          : 'Codec combination is common — weak signal on its own.',
  };
}

export const WEBCODECS_PROBE = {
  normalizeSupportMatrix,
  fingerprintBrowserStack,
  classifyHardwareAcceleration,
  scoreFingerprintUniqueness,
  BROWSER_CODEC_PROFILES,
};
