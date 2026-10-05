/**
 * conditionalRequestEtag.js — conditional-request ETag analysis for autonomous bug bounty.
 *
 * Implements idea-bank item 00420: analyze ETag formats to fingerprint
 * frameworks and detect inode-leak style information disclosure in
 * server-generated validators.
 *
 * All functions are pure and side-effect free: they parse ETag header
 * values the caller captured during an authorized engagement.
 * No network activity happens here.
 */

/**
 * Known ETag format signatures.
 * @type {Array<{framework:string, pattern:RegExp, weak:boolean, description:string}>}
 */
export const ETAG_SIGNATURES = [
  { framework: 'Apache httpd', pattern: /^[0-9a-f]+-[0-9a-f]+-[0-9a-f]+$/i, weak: false, description: 'inode-size-mtime hex triple' },
  { framework: 'IIS', pattern: /^[0-9a-f]+:[0-9a-f]+$/i, weak: false, description: 'filetimestamp:changenumber hex pair' },
  { framework: 'Express.js', pattern: /^[0-9a-f]{27}$/i, weak: true, description: 'content-length + hash, 27 hex chars' },
  { framework: 'nginx', pattern: /^[0-9a-f]+-[0-9a-f]+$/i, weak: true, description: 'mtime-size hex pair' },
  { framework: 'ASP.NET', pattern: /^[0-9a-f]{8}:[0-9a-f]+$/i, weak: false, description: 'change-number style pair' },
  { framework: 'Rack/Rails', pattern: /^[0-9a-f]{32,64}$/i, weak: true, description: 'content digest hash' },
];

/**
 * Parse a raw ETag header value into components.
 * @param {string} raw Raw ETag header value (may include W/ prefix and quotes).
 * @returns {{weak:boolean, opaque:string, components:string[], valid:boolean}}
 */
export function parseEtag(raw) {
  const out = { weak: false, opaque: '', components: [], valid: false };
  if (typeof raw !== 'string') return out;
  let v = raw.trim();
  if (/^W\//i.test(v)) {
    out.weak = true;
    v = v.slice(2).trim();
  }
  if (v.startsWith('"') && v.endsWith('"') && v.length >= 2) {
    v = v.slice(1, -1);
  } else {
    return out;
  }
  out.opaque = v;
  out.valid = v.length > 0;
  out.components = v.split(/[-:]/).filter(Boolean);
  return out;
}

/**
 * Fingerprint the generating framework from a parsed ETag.
 * @param {{weak:boolean, opaque:string, components:string[]}} parsed Output of parseEtag.
 * @returns {Array<{framework:string, confidence:number, description:string}>} sorted by confidence.
 */
export function fingerprintEtagSource(parsed) {
  const results = [];
  if (!parsed.valid) return results;
  for (const sig of ETAG_SIGNATURES) {
    if (!sig.pattern.test(parsed.opaque)) continue;
    let confidence = 0.75;
    if (sig.weak === parsed.weak) confidence += 0.1;
    results.push({ framework: sig.framework, confidence: Math.min(0.95, confidence), description: sig.description });
  }
  return results.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Detect inode-leak style disclosure: server-generated ETags whose first
 * component looks like a sequential filesystem inode across resources.
 * @param {Array<{path:string, etag:string}>} samples ETag samples from different paths on the same host.
 * @returns {{leak:boolean, evidence:string[], severity:string}}
 */
export function detectInodeLeak(samples) {
  const list = Array.isArray(samples) ? samples : [];
  const evidence = [];
  const inodes = [];
  for (const s of list) {
    const p = parseEtag(s.etag);
    if (!p.valid || p.components.length < 2) continue;
    const first = p.components[0];
    if (/^[0-9a-f]+$/i.test(first)) {
      inodes.push({ path: s.path, inode: parseInt(first, 16) });
    }
  }
  let leak = false;
  let severity = 'none';
  if (inodes.length >= 2) {
    const sorted = [...inodes].sort((a, b) => a.inode - b.inode);
    const spread = sorted[sorted.length - 1].inode - sorted[0].inode;
    if (spread > 0 && spread < 100000) {
      leak = true;
      severity = 'low';
      evidence.push(`ETag first components cluster in a narrow inode range (spread ${spread}) across ${inodes.length} resources`);
      evidence.push('pattern consistent with Apache-style inode-size-mtime ETags exposing filesystem inode numbers');
    }
  }
  if (!leak) evidence.push('no inode-clustering pattern detected across sampled ETags');
  return { leak, evidence, severity };
}

/**
 * Full ETag analysis for one host: fingerprint plus leak detection.
 * @param {Array<{path:string, etag:string}>} samples
 * @returns {{sources:Array<{framework:string, confidence:number}>, leak:{leak:boolean, severity:string}, consistent:boolean}}
 */
export function analyzeHostEtags(samples) {
  const list = Array.isArray(samples) ? samples : [];
  const fps = list.map((s) => fingerprintEtagSource(parseEtag(s.etag))[0]).filter(Boolean);
  const frameworks = [...new Set(fps.map((f) => f.framework))];
  const leak = detectInodeLeak(list);
  return {
    sources: fps.slice(0, 3).map((f) => ({ framework: f.framework, confidence: f.confidence })),
    leak: { leak: leak.leak, severity: leak.severity },
    consistent: frameworks.length <= 1,
  };
}
