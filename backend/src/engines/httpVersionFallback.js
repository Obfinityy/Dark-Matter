/**
 * httpVersionFallback.js — HTTP version support mapping for autonomous bug bounty.
 *
 * Implements idea-bank item 00417: map per-host support for HTTP/1.0,
 * HTTP/1.1, HTTP/2 (h2/h2c), and HTTP/3 (h3), including downgrade and
 * fallback behavior, to profile the protocol stack.
 *
 * All functions are pure and side-effect free: they operate on version
 * negotiation observations the caller collected with safe ALPN/plaintext
 * probes during an authorized engagement. No network activity happens here.
 */

/**
 * Known version-support fingerprints.
 * @type {Array<{stack:string, versions:string[], hints:string[], confidence:number}>}
 */
export const VERSION_FINGERPRINTS = [
  { stack: 'nginx + quiche', versions: ['1.0', '1.1', '2', '3'], hints: ['h3 via Alt-Svc', 'h2 via ALPN'], confidence: 0.7 },
  { stack: 'Cloudflare edge', versions: ['1.1', '2', '3'], hints: ['h3 enabled by default', '1.0 rejected or upgraded'], confidence: 0.75 },
  { stack: 'Apache httpd', versions: ['1.0', '1.1', '2'], hints: ['h2c via upgrade', 'no native h3'], confidence: 0.7 },
  { stack: 'IIS', versions: ['1.0', '1.1', '2'], hints: ['h2 over TLS only', 'no cleartext h2c'], confidence: 0.7 },
  { stack: 'HAProxy', versions: ['1.0', '1.1', '2'], hints: ['h2 as frontend only', 'no h3'], confidence: 0.65 },
  { stack: 'legacy origin', versions: ['1.0', '1.1'], hints: ['no ALPN h2 advertisement'], confidence: 0.6 },
];

/**
 * Build a version support map from observations.
 * @param {Array<object>} observations Each: { version:'1.0'|'1.1'|'2'|'3',
 *   supported:boolean, negotiatedVia:string|null, fallbackObserved:boolean,
 *   altSvcHeader:string|null, status:number|null }
 * @returns {{supported:string[], unsupported:string[], downgradedFrom:string[], altSvcAdvertised:boolean, notes:string[]}}
 */
export function mapVersionSupport(observations) {
  const list = Array.isArray(observations) ? observations : [];
  const supported = [];
  const unsupported = [];
  const downgradedFrom = [];
  const notes = [];
  let altSvcAdvertised = false;
  for (const o of list) {
    if (o.supported) supported.push(o.version);
    else unsupported.push(o.version);
    if (o.fallbackObserved) {
      downgradedFrom.push(o.version);
      notes.push(`requested ${o.version} but server fell back to a lower version`);
    }
    if (o.altSvcHeader) {
      altSvcAdvertised = true;
      notes.push(`Alt-Svc advertises: ${o.altSvcHeader}`);
    }
    if (o.negotiatedVia) notes.push(`${o.version} negotiated via ${o.negotiatedVia}`);
  }
  return {
    supported: [...new Set(supported)].sort(),
    unsupported: [...new Set(unsupported)].sort(),
    downgradedFrom: [...new Set(downgradedFrom)],
    altSvcAdvertised,
    notes,
  };
}

/**
 * Fingerprint the serving stack from a version map.
 * @param {{supported:string[], unsupported:string[], altSvcAdvertised:boolean}} versionMap Output of mapVersionSupport.
 * @returns {Array<{stack:string, confidence:number, matchedVersions:string[], reason:string}>} sorted by confidence.
 */
export function fingerprintVersionStack(versionMap) {
  const results = [];
  for (const fp of VERSION_FINGERPRINTS) {
    const matched = fp.versions.filter((v) => versionMap.supported.includes(v));
    const extra = versionMap.supported.filter((v) => !fp.versions.includes(v));
    if (matched.length === 0) continue;
    const coverage = matched.length / fp.versions.length;
    const penalty = extra.length * 0.1;
    const confidence = Math.max(0, Math.min(0.95, fp.confidence * coverage - penalty));
    results.push({
      stack: fp.stack,
      confidence,
      matchedVersions: matched,
      reason: fp.hints.join('; '),
    });
  }
  return results.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Flag protocol-downgrade security concerns from the version map.
 * @param {{supported:string[], unsupported:string[], downgradedFrom:string[], altSvcAdvertised:boolean}} versionMap
 * @returns {{concerns:string[]}}
 */
export function flagVersionConcerns(versionMap) {
  const concerns = [];
  if (versionMap.downgradedFrom.includes('2') || versionMap.downgradedFrom.includes('3')) {
    concerns.push('server downgrades modern protocol requests — possible ALPN-stripping middlebox');
  }
  if (!versionMap.supported.includes('2') && !versionMap.supported.includes('3')) {
    concerns.push('no multiplexed protocol support — request smuggling surface limited to HTTP/1.x framing');
  }
  if (versionMap.supported.includes('1.0')) {
    concerns.push('HTTP/1.0 accepted — legacy framing path may bypass modern proxy validation');
  }
  if (versionMap.altSvcAdvertised && !versionMap.supported.includes('3')) {
    concerns.push('Alt-Svc advertises h3 but no h3 support observed — header spoofing or stale config');
  }
  return { concerns };
}
