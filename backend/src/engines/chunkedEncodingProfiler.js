/**
 * chunkedEncodingProfiler.js — chunked transfer-encoding behavior profiling for autonomous bug bounty.
 *
 * Implements idea-bank item 00413: profile how a server or proxy parses
 * chunked transfer encoding (chunk extensions, trailers, size leniency)
 * to fingerprint the implementation stack.
 *
 * All functions are pure and side-effect free: they operate on parsing
 * behavior observations the caller recorded with safe probes during an
 * authorized engagement. No network activity happens here.
 */

/**
 * Fingerprint table keyed on observable chunked-parsing traits.
 * @type {Array<{implementation:string, profile:{extensions:string, trailers:string, chunkSize:string}, confidence:number}>}
 */
export const CHUNKED_PROFILES = [
  {
    implementation: 'nginx',
    profile: { extensions: 'ignored', trailers: 'stripped', chunkSize: 'strict' },
    confidence: 0.75,
  },
  {
    implementation: 'Apache httpd',
    profile: { extensions: 'accepted', trailers: 'forwarded', chunkSize: 'lenient' },
    confidence: 0.75,
  },
  {
    implementation: 'HAProxy',
    profile: { extensions: 'rejected', trailers: 'stripped', chunkSize: 'strict' },
    confidence: 0.8,
  },
  {
    implementation: 'Envoy',
    profile: { extensions: 'ignored', trailers: 'forwarded', chunkSize: 'strict' },
    confidence: 0.8,
  },
  {
    implementation: 'IIS',
    profile: { extensions: 'ignored', trailers: 'stripped', chunkSize: 'lenient' },
    confidence: 0.7,
  },
  {
    implementation: 'Node.js',
    profile: { extensions: 'accepted', trailers: 'forwarded', chunkSize: 'lenient' },
    confidence: 0.7,
  },
];

/**
 * Normalize a raw chunked-behavior observation into a comparable profile.
 * @param {object} obs { chunkExtensions:'ignored'|'accepted'|'rejected'|null,
 *   trailerHandling:'forwarded'|'stripped'|'rejected'|null,
 *   chunkSizeParsing:'strict'|'lenient'|'tolerant'|null,
 *   zeroChunkFraming:'clean'|'extra-data'|'rejected'|null,
 *   oversizedChunkStatus:number|null }
 * @returns {{extensions:string, trailers:string, chunkSize:string, notes:string[]}}
 */
export function normalizeChunkedProfile(obs) {
  const o = obs || {};
  const notes = [];
  const profile = {
    extensions: o.chunkExtensions || 'unknown',
    trailers: o.trailerHandling || 'unknown',
    chunkSize: o.chunkSizeParsing || 'unknown',
  };
  if (o.zeroChunkFraming === 'extra-data')
    notes.push('server accepted data after the zero-length chunk');
  if (o.zeroChunkFraming === 'rejected')
    notes.push('server rejected framing anomalies after zero chunk');
  if (o.oversizedChunkStatus === 413) notes.push('server enforces chunk-size limit with 413');
  if (o.oversizedChunkStatus === 400) notes.push('server rejects oversized chunks with 400');
  return { ...profile, notes };
}

/**
 * Match a normalized profile against known implementation profiles.
 * @param {{extensions:string, trailers:string, chunkSize:string}} profile Output of normalizeChunkedProfile.
 * @returns {Array<{implementation:string, confidence:number, matches:string[], mismatches:string[]}>} sorted by confidence.
 */
export function fingerprintChunkedStack(profile) {
  const results = [];
  for (const entry of CHUNKED_PROFILES) {
    const matches = [];
    const mismatches = [];
    for (const key of ['extensions', 'trailers', 'chunkSize']) {
      if (profile[key] === 'unknown') continue;
      if (profile[key] === entry.profile[key]) matches.push(key);
      else mismatches.push(key);
    }
    if (matches.length === 0) continue;
    const total = matches.length + mismatches.length;
    const confidence = entry.confidence * (matches.length / total);
    results.push({ implementation: entry.implementation, confidence, matches, mismatches });
  }
  return results.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Flag risky chunked-parsing behaviors that indicate desync-prone stacks.
 * @param {{extensions:string, trailers:string, chunkSize:string, notes:string[]}} profile
 * @returns {{risky:boolean, findings:string[]}}
 */
export function flagChunkedRisks(profile) {
  const findings = [];
  if (profile.extensions === 'ignored' && profile.chunkSize === 'lenient') {
    findings.push('lenient chunk-size parsing with ignored extensions — desync-prone combination');
  }
  if (profile.trailers === 'forwarded' && profile.chunkSize !== 'strict') {
    findings.push(
      'trailers forwarded with non-strict size parsing — inconsistent framing enforcement'
    );
  }
  if (profile.notes.some(n => n.includes('after the zero-length chunk'))) {
    findings.push('data accepted after zero chunk — post-termination parsing ambiguity');
  }
  return { risky: findings.length > 0, findings };
}
