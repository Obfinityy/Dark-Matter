/**
 * clientSurfaceMiner.js — Client-side surface mining engine for autonomous bug bounty.
 *
 * Mines an authorized target's client-side artifacts (JavaScript bundles, HTML forms,
 * URL structure) to discover attack surface that server-side scanning alone misses.
 * Everything here is passive analysis or probe planning: probe-plan functions only
 * BUILD deterministic probe variants (no network I/O), and analyze functions classify
 * observed responses supplied by the caller.
 *
 * Idea-bank mapping (wave 21, ideas 811-820):
 *  - 811 dot-segment normalization mapping ......... planDotSegmentProbes / analyzeDotSegmentResponses / normalizeDotSegments
 *  - 812 unicode-normalization route testing ........ planUnicodePathProbes / analyzeUnicodePathResponses
 *  - 813 HTTP-parameter pollution mapping ........... planParameterPollutionProbes / analyzeParameterPollutionResponses
 *  - 814 array-parameter syntax detection ........... planArrayParamProbes / analyzeArrayParamResponses
 *  - 815 JSON body-parameter inference ............. inferJsonSchemaFromClientCode
 *  - 816 multipart boundary analysis ............... analyzeMultipartForms / planMultipartProbes
 *  - 817 chunked-upload endpoint discovery ......... discoverChunkedUploadEndpoints
 *  - 818 WebRTC signaling URL extraction ........... extractSignalingUrls
 *  - 819 WebRTC ICE-server harvesting .............. harvestIceServers
 *  - 820 DataChannel label cataloging .............. catalogDataChannelLabels
 *
 * All functions are pure, deterministic, and testable without network access.
 * Defensive/product framing only: analysis and detection logic, never exploit payloads.
 */

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

/**
 * Extract a balanced {...} or [...] block starting at the given index.
 * @param {string} text source text
 * @param {number} startIndex index of the opening brace/bracket
 * @returns {string|null} the balanced block including delimiters, or null
 */
export function extractBalanced(text, startIndex) {
  if (typeof text !== 'string' || typeof startIndex !== 'number') return null;
  const open = text[startIndex];
  const close = open === '{' ? '}' : open === '[' ? ']' : null;
  if (!close) return null;
  let depth = 0;
  let inStr = null;
  for (let i = startIndex; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (ch === '\\') { i++; continue; }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; continue; }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return text.slice(startIndex, i + 1);
    }
  }
  return null;
}

/**
 * Split a "label: value" probe-plan list into unique entries by URL.
 * @param {{label:string,url:string}[]} probes
 * @returns {{label:string,url:string}[]} deduplicated probes
 */
function dedupeProbes(probes) {
  const seen = new Set();
  return probes.filter((p) => {
    if (seen.has(p.url)) return false;
    seen.add(p.url);
    return true;
  });
}

/**
 * Normalize a URL path per RFC 3986 section 5.2.4 (remove_dot_segments).
 * Used to predict how a standards-compliant server should resolve dot segments,
 * so differentials between prediction and observed behavior stand out.
 * @param {string} path URL path (leading slash optional)
 * @returns {string} normalized path
 */
export function normalizeDotSegments(path) {
  if (typeof path !== 'string') return '/';
  let p = path.startsWith('/') ? path : '/' + path;
  // Decode percent-encoded dots first (servers often normalize after one decode pass)
  p = p.replace(/%2e/gi, '.');
  const input = p.split('/');
  const output = [];
  for (const seg of input) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') { output.pop(); continue; }
    output.push(seg);
  }
  return '/' + output.join('/');
}

/**
 * Pull the path portion (no query/hash) from a URL or path string.
 * @param {string} url
 * @returns {string} path with leading slash
 */
function pathOnly(url) {
  const s = String(url || '').split(/[?#]/)[0];
  return s.startsWith('/') ? s : '/' + s;
}

/* ------------------------------------------------------------------ */
/* Idea 811 — Dot-segment normalization mapping                       */
/*                                                                     */
/* Maps how a target handles dot-segments (/../, /./, encoded variants)*/
/* to find path-confusion opportunities.                               */
/* ------------------------------------------------------------------ */

/**
 * Build deterministic dot-segment probe variants for a path.
 * Each variant exercises a different normalization technique so the caller
 * can observe (via analyzeDotSegmentResponses) whether the server normalizes,
 * redirects, rejects, or treats segments literally.
 * @param {string} path e.g. "/api/users/123"
 * @returns {{label:string,url:string,technique:string,expectedNormalized:string}[]}
 */
export function planDotSegmentProbes(path) {
  if (typeof path !== 'string' || !path.trim()) return [];
  const p = pathOnly(path.trim());
  const probes = [];
  const add = (label, url, technique) =>
    probes.push({ label, url, technique, expectedNormalized: normalizeDotSegments(url) });

  add('dotdot-trailing', p + '/..', 'dot-segment');
  add('dot-trailing', p + '/.', 'dot-segment');
  add('encoded-dotdot-trailing', p + '/%2e%2e', 'percent-encoded');
  add('encoded-dot-trailing', p + '/%2e', 'percent-encoded');
  add('double-encoded-dotdot-trailing', p + '/%252e%252e', 'double-encoded');

  const segs = p.split('/').filter(Boolean);
  if (segs.length >= 2) {
    const parent = '/' + segs.slice(0, -1).join('/');
    const last = segs[segs.length - 1];
    add('dotdot-mid', `${parent}/../${last}`, 'dot-segment');
    add('encoded-dotdot-mid', `${parent}/%2e%2e/${last}`, 'percent-encoded');
    add('dot-mid', `${parent}/./${last}`, 'dot-segment');
    add('double-dotdot-mid', `${parent}/../../${segs[segs.length - 2]}/${last}`, 'dot-segment');
  }
  return dedupeProbes(probes);
}

/**
 * Classify observed probe responses against the baseline status of the
 * canonical path, surfacing normalization differentials.
 * @param {string} path canonical path that was probed
 * @param {number} baselineStatus HTTP status observed for the canonical path
 * @param {{url:string,status:number,location?:string}[]} responses observed per probe variant
 * @returns {{path:string,baselineStatus:number,variants:object[],findings:object[]}}
 */
export function analyzeDotSegmentResponses(path, baselineStatus, responses = []) {
  const variants = [];
  const findings = [];
  for (const r of responses || []) {
    const expected = normalizeDotSegments(pathOnly(r.url || ''));
    let behavior;
    if (r.status === baselineStatus) behavior = 'same-as-baseline';
    else if ([301, 302, 303, 307, 308].includes(r.status)) behavior = 'redirect';
    else if (r.status === 404) behavior = 'not-found';
    else if (r.status === 400 || r.status === 414) behavior = 'rejected';
    else behavior = 'differential-status';
    variants.push({ url: r.url, status: r.status, location: r.location || null, expectedNormalized: expected, behavior });
    if (behavior === 'differential-status' || (behavior === 'same-as-baseline' && r.status === 200 && baselineStatus !== 200)) {
      findings.push({
        type: 'path-normalization-differential',
        severity: r.status === 200 && baselineStatus !== 200 ? 'medium' : 'info',
        variant: r.url,
        baselineStatus,
        observedStatus: r.status,
        detail: `Variant ${r.url} returned ${r.status} while canonical path returned ${baselineStatus}; the server's dot-segment handling differs from the baseline.`,
      });
    }
  }
  return { path, baselineStatus, variants, findings };
}

/* ------------------------------------------------------------------ */
/* Idea 812 — Unicode-normalization route testing                      */
/*                                                                     */
/* Tests Unicode path variants (overlong UTF-8, IIS %uXXXX, fullwidth)  */
/* to find normalization differentials between proxies and backends.   */
/* ------------------------------------------------------------------ */

/**
 * Percent-encode a string as UTF-8 bytes.
 * @param {string} s
 * @returns {string} e.g. "%ef%bc%8f"
 */
function utf8PercentEncode(s) {
  return Array.from(new TextEncoder().encode(s))
    .map((b) => '%' + b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Map ASCII alphanumerics to their fullwidth Unicode forms.
 * @param {string} s
 * @returns {string}
 */
function toFullwidth(s) {
  return String(s).replace(/[!-~]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0xfee0));
}

const UNICODE_TRANSFORMS = [
  { label: 'overlong-slash', technique: 'overlong-utf8', apply: (p) => p.replace(/\//g, '%c0%af') },
  { label: 'overlong-dot', technique: 'overlong-utf8', apply: (p) => p.replace(/\./g, '%c0%ae') },
  { label: 'iis-unicode-slash', technique: 'unicode-escape', apply: (p) => p.replace(/\//g, '%u002f') },
  { label: 'iis-unicode-dot', technique: 'unicode-escape', apply: (p) => p.replace(/\./g, '%u002e') },
  { label: 'fullwidth-slash', technique: 'fullwidth', apply: (p) => p.split('/').join(utf8PercentEncode('／')) },
  {
    label: 'fullwidth-last-segment', technique: 'fullwidth',
    apply: (p) => {
      const segs = p.split('/');
      segs[segs.length - 1] = utf8PercentEncode(toFullwidth(segs[segs.length - 1] || ''));
      return segs.join('/');
    },
  },
  { label: 'mixed-encoded-slash', technique: 'mixed-encoding', apply: (p) => p.replace(/\//g, '%2f') },
];

/**
 * Build Unicode path variants for normalization-differential testing.
 * @param {string} path e.g. "/api/users"
 * @returns {{label:string,url:string,technique:string}[]}
 */
export function planUnicodePathProbes(path) {
  if (typeof path !== 'string' || !path.trim()) return [];
  const p = pathOnly(path.trim());
  const probes = UNICODE_TRANSFORMS.map((t) => ({ label: t.label, url: t.apply(p), technique: t.technique }));
  return dedupeProbes(probes);
}

/**
 * Classify observed Unicode-variant responses against the baseline.
 * A variant that reaches the application (200) while the canonical path does
 * not — or vice versa — indicates a Unicode normalization differential,
 * often a proxy/backend mismatch worth reporting.
 * @param {string} path canonical path
 * @param {number} baselineStatus HTTP status for the canonical path
 * @param {{url:string,status:number}[]} responses observed per probe variant
 * @returns {{path:string,baselineStatus:number,variants:object[],findings:object[]}}
 */
export function analyzeUnicodePathResponses(path, baselineStatus, responses = []) {
  const variants = [];
  const findings = [];
  for (const r of responses || []) {
    const differential = r.status !== baselineStatus;
    variants.push({ url: r.url, status: r.status, differential });
    if (differential) {
      findings.push({
        type: 'unicode-normalization-differential',
        severity: r.status === 200 && baselineStatus !== 200 ? 'medium' : 'info',
        variant: r.url,
        baselineStatus,
        observedStatus: r.status,
        detail: `Unicode variant ${r.url} returned ${r.status} vs baseline ${baselineStatus}; normalization differs somewhere in the request path.`,
      });
    }
  }
  return { path, baselineStatus, variants, findings };
}

/* ------------------------------------------------------------------ */
/* Idea 813 — HTTP-parameter pollution mapping                         */
/*                                                                     */
/* Maps how duplicate parameters are merged per endpoint (first-wins,  */
/* last-wins, comma-joined, array, rejected) using benign marker values */
/* so the caller can observe the server's merge strategy.              */
/* ------------------------------------------------------------------ */

export const HPP_MARK_FIRST = 'dmhppfirst';
export const HPP_MARK_SECOND = 'dmhpplast';

/**
 * Build HTTP parameter pollution probe URLs for one parameter.
 * Uses two distinct benign markers; the reversed duplicate lets the analyzer
 * distinguish first-wins from last-wins deterministically.
 * @param {string} url endpoint URL (query string is stripped)
 * @param {string} paramName parameter to pollute
 * @returns {{label:string,url:string,variant:string}[]}
 */
export function planParameterPollutionProbes(url, paramName) {
  if (typeof url !== 'string' || !url.trim() || typeof paramName !== 'string' || !paramName.trim()) return [];
  const base = String(url).split(/[?#]/)[0];
  const p = paramName.trim();
  const A = HPP_MARK_FIRST;
  const B = HPP_MARK_SECOND;
  return [
    { label: 'baseline', url: `${base}?${p}=${A}`, variant: 'baseline' },
    { label: 'duplicate', url: `${base}?${p}=${A}&${p}=${B}`, variant: 'duplicate' },
    { label: 'duplicate-reversed', url: `${base}?${p}=${B}&${p}=${A}`, variant: 'duplicate-reversed' },
    { label: 'array-bracket', url: `${base}?${p}[]=${A}&${p}[]=${B}`, variant: 'array-bracket' },
    { label: 'semicolon-separated', url: `${base}?${p}=${A};${p}=${B}`, variant: 'semicolon' },
  ];
}

/**
 * Determine a server's duplicate-parameter merge behavior from observed values.
 * The caller supplies, per probe, the parameter value the server acted on
 * (echoed in a reflection, used in a query, etc.).
 * @param {string} url endpoint URL
 * @param {string} paramName parameter that was polluted
 * @param {{label:string,variant:string,status:number,observed?:string}[]} responses
 * @returns {{url:string,param:string,mergeBehavior:string,confidence:string,perVariant:object[],note:string}}
 */
export function analyzeParameterPollutionResponses(url, paramName, responses = []) {
  const A = HPP_MARK_FIRST;
  const B = HPP_MARK_SECOND;
  const byLabel = {};
  for (const r of responses || []) byLabel[r.label] = r;

  const dup = byLabel.duplicate || {};
  const rev = byLabel['duplicate-reversed'] || {};
  let mergeBehavior = 'unknown';
  let confidence = 'low';

  const val = (r) => (typeof r.observed === 'string' ? r.observed : null);
  const isReject = (r) => [400, 422].includes(r.status);

  if (isReject(dup)) {
    mergeBehavior = 'rejects-duplicates';
    confidence = 'medium';
  } else if (val(dup) === A && val(rev) === B) {
    mergeBehavior = 'first-wins';
    confidence = 'high';
  } else if (val(dup) === B && val(rev) === A) {
    mergeBehavior = 'last-wins';
    confidence = 'high';
  } else if (val(dup) === `${A},${B}` || val(dup) === `${B},${A}`) {
    mergeBehavior = 'comma-joined';
    confidence = 'medium';
  } else if (Array.isArray(dup.observed) && dup.observed.includes(A) && dup.observed.includes(B)) {
    mergeBehavior = 'array';
    confidence = 'medium';
  }

  const perVariant = (responses || []).map((r) => ({
    label: r.label,
    variant: r.variant,
    status: r.status,
    observed: r.observed ?? null,
  }));

  const note =
    mergeBehavior === 'unknown'
      ? 'Could not determine merge behavior from the supplied observations.'
      : `Endpoint merges duplicate "${paramName}" parameters via ${mergeBehavior} (confidence: ${confidence}). ` +
        'Divergent merge behavior between layers (WAF vs app) can enable parameter-pollution issues; verify on the authorized target.';

  return { url, param: paramName, mergeBehavior, confidence, perVariant, note };
}

/* ------------------------------------------------------------------ */
/* Idea 814 — Array-parameter syntax detection                         */
/*                                                                     */
/* Detects which array syntaxes ([] brackets, indexed [0], named) an   */
/* endpoint honors, fingerprinting the backend framework family.        */
/* ------------------------------------------------------------------ */

const ARRAY_SYNTAX_FINGERPRINTS = [
  { name: 'PHP', syntaxes: ['bracket', 'named-index', 'duplicate-comma'], evidence: 'Honors param[] and param[name] syntaxes.' },
  { name: 'Ruby on Rails', syntaxes: ['bracket', 'indexed', 'named-index'], evidence: 'Honors param[], param[0], and param[name] syntaxes.' },
  { name: 'Node.js (qs)', syntaxes: ['bracket', 'indexed', 'named-index'], evidence: 'Honors qs-style bracket/indexed syntaxes.' },
  { name: 'ASP.NET', syntaxes: ['indexed', 'duplicate'], evidence: 'Honors param[0] indexed syntax.' },
  { name: 'Java (Spring)', syntaxes: ['duplicate'], evidence: 'Treats repeated params as multi-value without bracket syntax.' },
];

/**
 * Build array-syntax probe URLs for one parameter.
 * @param {string} url endpoint URL (query string is stripped)
 * @param {string} paramName parameter to test
 * @returns {{label:string,url:string,syntax:string}[]}
 */
export function planArrayParamProbes(url, paramName) {
  if (typeof url !== 'string' || !url.trim() || typeof paramName !== 'string' || !paramName.trim()) return [];
  const base = String(url).split(/[?#]/)[0];
  const p = paramName.trim();
  return [
    { label: 'bracket', url: `${base}?${p}[]=dmx1&${p}[]=dmx2`, syntax: 'bracket' },
    { label: 'indexed', url: `${base}?${p}[0]=dmx1&${p}[1]=dmx2`, syntax: 'indexed' },
    { label: 'named-index', url: `${base}?${p}[name]=dmx1`, syntax: 'named-index' },
    { label: 'duplicate', url: `${base}?${p}=dmx1&${p}=dmx2`, syntax: 'duplicate' },
  ];
}

/**
 * Fingerprint the backend framework family from observed array-syntax support.
 * The caller reports, per probe, how the server parsed the parameter:
 * 'array' (both values kept as a list), 'scalar' (one value kept),
 * 'comma' (joined with a comma), 'error', or 'ignored'.
 * @param {string} url endpoint URL
 * @param {string} paramName parameter that was tested
 * @param {{label:string,syntax:string,status:number,parsedAs?:string}[]} responses
 * @returns {{url:string,param:string,supportedSyntaxes:string[],likelyBackends:object[]}}
 */
export function analyzeArrayParamResponses(url, paramName, responses = []) {
  const supported = [];
  for (const r of responses || []) {
    if (r.parsedAs === 'array' || (r.syntax === 'duplicate' && (r.parsedAs === 'comma' || r.parsedAs === 'array'))) {
      supported.push(r.syntax === 'duplicate' ? 'duplicate-comma' : r.syntax);
    } else if (r.syntax === 'duplicate' && r.parsedAs === 'scalar') {
      supported.push('duplicate');
    }
  }
  const supportedSyntaxes = [...new Set(supported)];
  const likelyBackends = ARRAY_SYNTAX_FINGERPRINTS
    .map((fp) => {
      const hits = fp.syntaxes.filter((s) => supportedSyntaxes.includes(s));
      if (hits.length === 0) return null;
      return {
        name: fp.name,
        confidence: hits.length >= fp.syntaxes.length ? 'high' : hits.length >= 2 ? 'medium' : 'low',
        evidence: `${fp.evidence} Matched: ${hits.join(', ')}.`,
      };
    })
    .filter(Boolean)
    .sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.confidence] - { high: 0, medium: 1, low: 2 }[b.confidence]));
  return { url, param: paramName, supportedSyntaxes, likelyBackends };
}

/* ------------------------------------------------------------------ */
/* Idea 815 — JSON body-parameter inference                            */
/*                                                                     */
/* Infers JSON body schemas from client-side code: fetch/axios bodies, */
/* zod/yup/joi validation schemas, and manual presence checks.         */
/* ------------------------------------------------------------------ */

/**
 * Infer a field type from a JS object-literal value token.
 * @param {string} token raw value text
 * @returns {string} inferred type name
 */
function inferLiteralType(token) {
  const t = String(token || '').trim();
  if (/^['"`]/.test(t)) return 'string';
  if (/^-?\d+(\.\d+)?(?![\w.])/.test(t)) return 'number';
  if (/^(true|false)(?![\w])/.test(t)) return 'boolean';
  if (t.startsWith('[')) return 'array';
  if (t.startsWith('{')) return 'object';
  if (/^null(?![\w])/.test(t)) return 'null';
  if (/^undefined(?![\w])/.test(t)) return 'undefined';
  return 'unknown';
}

/**
 * Parse top-level keys of a JS object literal into field descriptors.
 * @param {string} objLiteral balanced "{...}" text
 * @returns {{name:string,type:string,required:boolean,constraints:string[]}[]}
 */
function fieldsFromObjectLiteral(objLiteral) {
  const fields = [];
  const inner = objLiteral.slice(1, -1);
  const keyRe = /['"`]?([A-Za-z_$][\w$]*)['"`]?\s*:/g;
  let m;
  while ((m = keyRe.exec(inner)) !== null) {
    const name = m[1];
    if (fields.some((f) => f.name === name)) continue;
    // Grab a short value token after the colon for type inference.
    const rest = inner.slice(m.index + m[0].length, m.index + m[0].length + 40);
    fields.push({ name, type: inferLiteralType(rest), required: true, constraints: [] });
  }
  return fields;
}

const SCHEMA_LIB_PATTERNS = [
  {
    lib: 'zod', callRe: /z\.object\s*\(/g,
    parseField: (decl) => {
      const typeMatch = decl.match(/z\.(\w+)\s*\(/);
      const type = typeMatch ? typeMatch[1] : 'unknown';
      const required = !/\.optional\s*\(/.test(decl);
      const constraints = [];
      const min = decl.match(/\.min\s*\(\s*(\d+)/); if (min) constraints.push(`min:${min[1]}`);
      const max = decl.match(/\.max\s*\(\s*(\d+)/); if (max) constraints.push(`max:${max[1]}`);
      if (/\.email\s*\(/.test(decl)) constraints.push('email');
      if (/\.url\s*\(/.test(decl)) constraints.push('url');
      if (/\.uuid\s*\(/.test(decl)) constraints.push('uuid');
      if (/\.int\s*\(/.test(decl)) constraints.push('int');
      return { type, required, constraints };
    },
  },
  {
    lib: 'yup', callRe: /yup\.object\s*\(/g,
    parseField: (decl) => {
      const typeMatch = decl.match(/yup\.(\w+)\s*\(/);
      const type = typeMatch ? typeMatch[1] : 'unknown';
      const required = /\.required\s*\(/.test(decl);
      const constraints = [];
      const min = decl.match(/\.min\s*\(\s*(\d+)/); if (min) constraints.push(`min:${min[1]}`);
      const max = decl.match(/\.max\s*\(\s*(\d+)/); if (max) constraints.push(`max:${max[1]}`);
      if (/\.email\s*\(/.test(decl)) constraints.push('email');
      return { type, required, constraints };
    },
  },
  {
    lib: 'joi', callRe: /Joi\.object\s*\(/g,
    parseField: (decl) => {
      const typeMatch = decl.match(/Joi\.(\w+)\s*\(/);
      const type = typeMatch ? typeMatch[1] : 'unknown';
      const required = /\.required\s*\(/.test(decl);
      const constraints = [];
      const min = decl.match(/\.min\s*\(\s*(\d+)/); if (min) constraints.push(`min:${min[1]}`);
      const max = decl.match(/\.max\s*\(\s*(\d+)/); if (max) constraints.push(`max:${max[1]}`);
      if (/\.email\s*\(/.test(decl)) constraints.push('email');
      return { type, required, constraints };
    },
  },
];

/**
 * Take a single field declaration from a schema object literal, stopping at
 * the first top-level comma so chained validators never bleed into the next
 * field (which would corrupt required/optional detection).
 * @param {string} inner object literal contents (without outer braces)
 * @param {number} from start index of the declaration
 * @returns {string} the declaration text
 */
function takeFieldDecl(inner, from) {
  let depth = 0;
  let inStr = null;
  for (let i = from; i < inner.length; i++) {
    const ch = inner[i];
    if (inStr) {
      if (ch === '\\') { i++; continue; }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = ch; continue; }
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth--;
    else if (ch === ',' && depth === 0) return inner.slice(from, i);
  }
  return inner.slice(from);
}

/**
 * Parse a validation-schema object literal (zod/yup/joi) into fields.
 * @param {string} objLiteral balanced "{...}" text
 * @param {(decl:string)=>{type:string,required:boolean,constraints:string[]}} parseField
 */
function fieldsFromSchemaLiteral(objLiteral, parseField) {
  const fields = [];
  const inner = objLiteral.slice(1, -1);
  const keyRe = /['"`]?([A-Za-z_$][\w$]*)['"`]?\s*:\s*/g;
  let m;
  while ((m = keyRe.exec(inner)) !== null) {
    const name = m[1];
    if (fields.some((f) => f.name === name)) continue;
    const decl = takeFieldDecl(inner, m.index + m[0].length);
    const parsed = parseField(decl);
    fields.push({ name, ...parsed });
  }
  return fields;
}

/**
 * Infer JSON body schemas from client-side JavaScript source.
 * Scans fetch/axios calls with JSON bodies, zod/yup/joi schemas, and
 * manual presence checks (e.g. `if (!body.email)`).
 * @param {string} jsSource client-side JavaScript source text
 * @returns {{method:string,url:string|null,fields:object[],source:string}[]}
 */
export function inferJsonSchemaFromClientCode(jsSource) {
  if (typeof jsSource !== 'string' || !jsSource.trim()) return [];
  const src = jsSource;
  const schemas = [];
  const seen = new Set();
  const push = (entry) => {
    const key = `${entry.method}|${entry.url}|${entry.source}`;
    if (seen.has(key)) return;
    seen.add(key);
    schemas.push(entry);
  };

  // fetch(url, { method, body: JSON.stringify({...}) })
  const fetchRe = /fetch\s*\(\s*(['"`])([^'"`]+)\1\s*,/g;
  let m;
  while ((m = fetchRe.exec(src)) !== null) {
    const url = m[2];
    const after = src.slice(m.index + m[0].length);
    const braceIdx = after.search(/\{/);
    if (braceIdx === -1) continue;
    const optionsText = extractBalanced(after, braceIdx);
    if (!optionsText) continue;
    const methodMatch = optionsText.match(/method\s*:\s*['"`](\w+)['"`]/i);
    const method = (methodMatch ? methodMatch[1] : 'POST').toUpperCase();
    const bodyIdx = optionsText.search(/body\s*:\s*JSON\.stringify\s*\(/);
    if (bodyIdx !== -1) {
      const parenIdx = optionsText.indexOf('(', bodyIdx) + 1;
      const afterParen = optionsText.slice(parenIdx);
      const objIdx = afterParen.search(/\{/);
      if (objIdx !== -1) {
        const literal = extractBalanced(afterParen, objIdx);
        if (literal) push({ method, url, fields: fieldsFromObjectLiteral(literal), source: 'fetch-body' });
      }
    }
  }

  // axios.post/put/patch(url, {...})
  const axiosRe = /axios\.(post|put|patch)\s*\(\s*(['"`])([^'"`]+)\2\s*,/gi;
  while ((m = axiosRe.exec(src)) !== null) {
    const method = m[1].toUpperCase();
    const url = m[3];
    const after = src.slice(m.index + m[0].length);
    const braceIdx = after.search(/\{/);
    if (braceIdx === -1) continue;
    const literal = extractBalanced(after, braceIdx);
    if (literal) push({ method, url, fields: fieldsFromObjectLiteral(literal), source: 'axios-body' });
  }

  // zod / yup / joi schema objects
  for (const lib of SCHEMA_LIB_PATTERNS) {
    const re = new RegExp(lib.callRe.source, 'g');
    while ((m = re.exec(src)) !== null) {
      const openIdx = src.indexOf('{', m.index);
      if (openIdx === -1) continue;
      const literal = extractBalanced(src, openIdx);
      if (!literal) continue;
      push({ method: 'UNKNOWN', url: null, fields: fieldsFromSchemaLiteral(literal, lib.parseField), source: `${lib.lib}-schema` });
    }
  }

  // Manual presence checks: if (!body.email) / body.email === undefined
  const manualFields = new Map();
  const manualRe = /(?:if\s*\(\s*!?\s*(?:body|data|payload)\.([A-Za-z_$][\w$]*)|(?:body|data|payload)\.([A-Za-z_$][\w$]*)\s*(?:===?|!==?)\s*undefined)/g;
  while ((m = manualRe.exec(src)) !== null) {
    const name = m[1] || m[2];
    if (name && !manualFields.has(name)) {
      manualFields.set(name, { name, type: 'unknown', required: true, constraints: ['presence-checked'] });
    }
  }
  if (manualFields.size > 0) {
    push({ method: 'UNKNOWN', url: null, fields: [...manualFields.values()], source: 'manual-checks' });
  }

  return schemas;
}

/* ------------------------------------------------------------------ */
/* Idea 816 — Multipart boundary analysis                              */
/*                                                                     */
/* Analyzes multipart/form-data upload forms found in HTML and plans    */
/* format-variant probes (boundary quoting, line endings, RFC 5987     */
/* filenames) to map how strictly the server parses multipart bodies.  */
/* ------------------------------------------------------------------ */

/**
 * Extract the value of an HTML attribute from a tag string.
 * @param {string} tag
 * @param {string} name
 * @returns {string|null}
 */
function htmlAttr(tag, name) {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? (m[1] ?? m[2] ?? m[3] ?? null) : null;
}

/**
 * Analyze multipart upload forms found in HTML source.
 * @param {string} htmlSource HTML source text
 * @returns {{action:string|null,method:string,fields:object[],fileInputCount:number}[]}
 */
export function analyzeMultipartForms(htmlSource) {
  if (typeof htmlSource !== 'string' || !htmlSource.trim()) return [];
  const forms = [];
  const formRe = /<form\b([^>]*)>([\s\S]*?)<\/form\s*>/gi;
  let fm;
  while ((fm = formRe.exec(htmlSource)) !== null) {
    const openTag = fm[1];
    const enctype = htmlAttr('<x ' + openTag + '>', 'enctype');
    if (!enctype || !/multipart\/form-data/i.test(enctype)) continue;
    const fields = [];
    const inputRe = /<input\b([^>]*)\/?>/gi;
    let im;
    while ((im = inputRe.exec(fm[2])) !== null) {
      const tag = '<x ' + im[1] + '>';
      fields.push({
        name: htmlAttr(tag, 'name'),
        type: (htmlAttr(tag, 'type') || 'text').toLowerCase(),
        accept: htmlAttr(tag, 'accept'),
        multiple: /\bmultiple\b/i.test(im[1]),
      });
    }
    const taRe = /<textarea\b([^>]*)>/gi;
    let tm;
    while ((tm = taRe.exec(fm[2])) !== null) {
      fields.push({ name: htmlAttr('<x ' + tm[1] + '>', 'name'), type: 'textarea', accept: null, multiple: false });
    }
    forms.push({
      action: htmlAttr('<x ' + openTag + '>', 'action'),
      method: (htmlAttr('<x ' + openTag + '>', 'method') || 'POST').toUpperCase(),
      fields,
      fileInputCount: fields.filter((f) => f.type === 'file').length,
    });
  }
  return forms;
}

/**
 * Plan multipart format-variant probes for an upload form.
 * These exercise parser strictness (boundary quoting, CRLF vs LF, RFC 5987
 * encoded filenames, duplicate boundary parameters) using benign field names —
 * the caller observes which variants the server accepts.
 * @param {{action:string|null,method:string,fields:object[]}} formSpec one entry from analyzeMultipartForms
 * @returns {{label:string,technique:string,contentTypeHeader:string,bodySketch:string,expectation:string}[]}
 */
export function planMultipartProbes(formSpec) {
  if (!formSpec || typeof formSpec !== 'object') return [];
  const boundary = '----dmprobeBoundary';
  const fileField = (formSpec.fields || []).find((f) => f.type === 'file');
  const fieldName = (fileField && fileField.name) || 'file';
  const part =
    `------dmprobeBoundary\r\nContent-Disposition: form-data; name="${fieldName}"; filename="probe.txt"\r\n` +
    'Content-Type: text/plain\r\n\r\nprobe-body\r\n------dmprobeBoundary--\r\n';
  return [
    {
      label: 'quoted-boundary',
      technique: 'boundary-quoting',
      contentTypeHeader: `multipart/form-data; boundary="${boundary}"`,
      bodySketch: part,
      expectation: 'Strict parsers accept quoted boundaries; rejection indicates a naive split-based parser.',
    },
    {
      label: 'lf-line-endings',
      technique: 'line-ending',
      contentTypeHeader: `multipart/form-data; boundary=${boundary}`,
      bodySketch: part.replace(/\r\n/g, '\n'),
      expectation: 'RFC 7578 requires CRLF; acceptance of bare LF reveals a lenient parser.',
    },
    {
      label: 'rfc5987-filename',
      technique: 'encoded-filename',
      contentTypeHeader: `multipart/form-data; boundary=${boundary}`,
      bodySketch: part.replace('filename="probe.txt"', `filename*=utf-8''probe%20upload.txt`),
      expectation: 'Acceptance shows the server decodes RFC 5987 filename* parameters.',
    },
    {
      label: 'duplicate-boundary-param',
      technique: 'duplicate-parameter',
      contentTypeHeader: `multipart/form-data; boundary=${boundary}; boundary=ignored`,
      bodySketch: part,
      expectation: 'Which boundary value wins (first vs last) maps the header-parsing strategy.',
    },
    {
      label: 'missing-final-boundary',
      technique: 'truncation',
      contentTypeHeader: `multipart/form-data; boundary=${boundary}`,
      bodySketch: part.replace(/------dmprobeBoundary--\r\n$/, ''),
      expectation: 'Acceptance of a truncated body indicates the parser does not validate termination.',
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Idea 817 — Chunked-upload endpoint discovery                        */
/* ------------------------------------------------------------------ */

const CHUNKED_PROTOCOL_HINTS = [
  // `generic: true` marks broad words (chunk, chunkSize, slice) that are shared
  // across upload libraries; they get a distance penalty so protocol-specific
  // markers (tus.Upload, Upload-Offset, resumable.js, Content-Range) win ties.
  { protocol: 'tus', generic: false, patterns: [/\btus\b/i, /upload-offset/i, /upload-length/i, /tus-resumable/i] },
  { protocol: 'content-range', generic: false, patterns: [/content-range/i, /x-upload-content-length/i] },
  { protocol: 'resumablejs', generic: false, patterns: [/resumable\.js/i, /resumablejs/i] },
  { protocol: 'custom-chunked', generic: true, patterns: [/\bchunk\b/i, /chunkSize/i, /chunk-size/i, /\.slice\s*\(/, /blob\.slice/i, /upload-chunk/i, /appendChunk/i] },
];

const URL_LITERAL_RE = /['"`](\/[A-Za-z0-9_\-./?=&%{}]+|https?:\/\/[^\s'"`]+)['"`]/g;

/**
 * Discover resumable/chunked upload endpoints referenced in client JS.
 * @param {string} jsSource client-side JavaScript source text
 * @returns {{url:string,protocol:string,evidence:string}[]}
 */
export function discoverChunkedUploadEndpoints(jsSource) {
  if (typeof jsSource !== 'string' || !jsSource.trim()) return [];
  const found = [];
  const seen = new Set();
  let m;
  while ((m = URL_LITERAL_RE.exec(jsSource)) !== null) {
    const url = m[1];
    const start = Math.max(0, m.index - 400);
    const end = Math.min(jsSource.length, m.index + m[0].length + 400);
    const ctx = jsSource.slice(start, end);
    const urlPos = m.index - start; // URL position inside the context window
    // Pick the hint whose nearest occurrence is closest to the URL literal,
    // so a distant unrelated mention cannot override a nearby indicator.
    let best = null;
    let bestDist = Infinity;
    for (const hint of CHUNKED_PROTOCOL_HINTS) {
      for (const pattern of hint.patterns) {
        const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
        let pm;
        while ((pm = re.exec(ctx)) !== null) {
          const dist = Math.abs(pm.index - urlPos) * (hint.generic ? 3 : 1);
          if (dist < bestDist) {
            bestDist = dist;
            best = { protocol: hint.protocol, pattern: pattern.source };
          }
          if (pm[0].length === 0) re.lastIndex++;
        }
      }
    }
    if (best && !seen.has(url)) {
      seen.add(url);
      found.push({ url, protocol: best.protocol, evidence: `URL appears within 400 chars of chunked-upload indicator /${best.pattern}/.` });
    }
  }
  return found;
}

/* ------------------------------------------------------------------ */
/* Idea 818 — WebRTC signaling URL extraction                         */
/* ------------------------------------------------------------------ */

const SIGNALING_KEYWORDS = [
  'signal', 'signaling', 'socket.io', 'peerjs', 'peer', 'webrtc', 'rtc',
  'RTCPeerConnection', 'datachannel', 'offer', 'answer', 'icecandidate',
];

const WS_URL_RE = /['"`](wss?:\/\/[^\s'"`]+|https?:\/\/[^\s'"`]+\/(?:socket\.io|signal|signaling|peer)[^\s'"`]*|https?:\/\/[^\s'"`]+)['"`]/gi;

/**
 * Extract WebRTC signaling server URLs from client JS.
 * Only URLs appearing near signaling-related keywords are reported, which
 * keeps generic API URLs out of the results.
 * @param {string} jsSource client-side JavaScript source text
 * @returns {{url:string,kind:string,keywords:string[],context:string}[]}
 */
export function extractSignalingUrls(jsSource) {
  if (typeof jsSource !== 'string' || !jsSource.trim()) return [];
  const found = [];
  const seen = new Set();
  let m;
  while ((m = WS_URL_RE.exec(jsSource)) !== null) {
    const url = m[1];
    if (seen.has(url)) continue;
    const start = Math.max(0, m.index - 300);
    const end = Math.min(jsSource.length, m.index + m[0].length + 300);
    const ctx = jsSource.slice(start, end);
    const lower = ctx.toLowerCase();
    const keywords = SIGNALING_KEYWORDS.filter((k) => lower.includes(k.toLowerCase()));
    if (keywords.length === 0) continue;
    seen.add(url);
    const kind = /^wss?:/i.test(url) ? 'websocket' : /socket\.io/i.test(url + ctx) ? 'socket.io' : 'http';
    found.push({ url, kind, keywords: [...new Set(keywords)], context: ctx.slice(0, 160).replace(/\s+/g, ' ') });
  }
  return found;
}

/* ------------------------------------------------------------------ */
/* Idea 819 — WebRTC ICE-server harvesting                             */
/* ------------------------------------------------------------------ */

/**
 * Harvest STUN/TURN server lists from RTCPeerConnection configurations.
 * Flags TURN credentials exposed in client code — a real-time-infrastructure
 * finding worth reporting on authorized assessments.
 * @param {string} jsSource client-side JavaScript source text
 * @returns {{urls:string[],stunUrls:string[],turnUrls:string[],exposesCredentials:boolean,evidence:string}[]}
 */
export function harvestIceServers(jsSource) {
  if (typeof jsSource !== 'string' || !jsSource.trim()) return [];
  const configs = [];
  const blockRe = /iceServers\s*:\s*\[/g;
  let m;
  while ((m = blockRe.exec(jsSource)) !== null) {
    const openIdx = jsSource.indexOf('[', m.index);
    const block = extractBalanced(jsSource, openIdx);
    if (!block) continue;
    const urls = [];
    const urlRe = /urls?\s*:\s*(\[[^\]]*\]|['"`][^'"`]*['"`])/g;
    let um;
    while ((um = urlRe.exec(block)) !== null) {
      const litRe = /['"`]([^'"`]+)['"`]/g;
      let lm;
      while ((lm = litRe.exec(um[1])) !== null) {
        if (/^(stun|turn|turns):/i.test(lm[1])) urls.push(lm[1]);
      }
    }
    if (urls.length === 0) continue;
    const stunUrls = urls.filter((u) => /^stun:/i.test(u));
    const turnUrls = urls.filter((u) => /^turns?:/i.test(u));
    const exposesCredentials = /credential\s*:/i.test(block) || /username\s*:/i.test(block);
    configs.push({
      urls: [...new Set(urls)],
      stunUrls: [...new Set(stunUrls)],
      turnUrls: [...new Set(turnUrls)],
      exposesCredentials,
      evidence: exposesCredentials
        ? 'ICE config ships TURN username/credential in client code; relay access may be abusable.'
        : 'ICE server list harvested from client RTCPeerConnection configuration.',
    });
  }
  return configs;
}

/* ------------------------------------------------------------------ */
/* Idea 820 — DataChannel label cataloging                            */
/* ------------------------------------------------------------------ */

const DATACHANNEL_FEATURE_HINTS = ['chat', 'message', 'file', 'transfer', 'control', 'screen', 'video', 'audio', 'game', 'sync', 'notify'];

/**
 * Catalog RTCDataChannel labels created in client JS to map P2P features.
 * @param {string} jsSource client-side JavaScript source text
 * @returns {{label:string,options:object,likelyFeature:string|null,contextSnippet:string}[]}
 */
export function catalogDataChannelLabels(jsSource) {
  if (typeof jsSource !== 'string' || !jsSource.trim()) return [];
  const labels = [];
  const seen = new Set();
  const re = /createDataChannel\s*\(\s*['"`]([^'"`]+)['"`]\s*(,\s*\{)?/g;
  let m;
  while ((m = re.exec(jsSource)) !== null) {
    const label = m[1];
    if (seen.has(label)) continue;
    seen.add(label);
    let options = {};
    if (m[2]) {
      const openIdx = jsSource.indexOf('{', m.index + m[0].length - 1);
      const block = extractBalanced(jsSource, openIdx);
      if (block) {
        const ordered = block.match(/ordered\s*:\s*(true|false)/);
        const retrans = block.match(/maxRetransmits\s*:\s*(\d+)/);
        options = {
          ordered: ordered ? ordered[1] === 'true' : undefined,
          maxRetransmits: retrans ? Number(retrans[1]) : undefined,
          raw: block.slice(0, 120),
        };
      }
    }
    const ctx = jsSource.slice(Math.max(0, m.index - 200), Math.min(jsSource.length, m.index + 200)).toLowerCase();
    const lowerLabel = label.toLowerCase();
    // Prefer a hint found in the label itself; fall back to surrounding context.
    const likelyFeature = DATACHANNEL_FEATURE_HINTS.find((h) => lowerLabel.includes(h))
      || DATACHANNEL_FEATURE_HINTS.find((h) => ctx.includes(h))
      || null;
    labels.push({
      label,
      options,
      likelyFeature,
      contextSnippet: jsSource.slice(Math.max(0, m.index - 80), m.index + 80).replace(/\s+/g, ' '),
    });
  }
  return labels;
}

/* ------------------------------------------------------------------ */
/* Aggregator — mine a whole client surface in one call                */
/* ------------------------------------------------------------------ */

/**
 * Run every client-surface miner over the given sources.
 * @param {{jsSources?:string[],htmlSources?:string[]}} sources
 * @returns {{jsonSchemas:object[],chunkedUploads:object[],signalingUrls:object[],iceServers:object[],dataChannels:object[],multipartForms:object[]}}
 */
export function mineClientSurface({ jsSources = [], htmlSources = [] } = {}) {
  const js = Array.isArray(jsSources) ? jsSources : [];
  const html = Array.isArray(htmlSources) ? htmlSources : [];
  return {
    jsonSchemas: js.flatMap(inferJsonSchemaFromClientCode),
    chunkedUploads: js.flatMap(discoverChunkedUploadEndpoints),
    signalingUrls: js.flatMap(extractSignalingUrls),
    iceServers: js.flatMap(harvestIceServers),
    dataChannels: js.flatMap(catalogDataChannelLabels),
    multipartForms: html.flatMap(analyzeMultipartForms),
  };
}

export const CLIENT_SURFACE_MINER = {
  planDotSegmentProbes,
  analyzeDotSegmentResponses,
  normalizeDotSegments,
  planUnicodePathProbes,
  analyzeUnicodePathResponses,
  planParameterPollutionProbes,
  analyzeParameterPollutionResponses,
  planArrayParamProbes,
  analyzeArrayParamResponses,
  inferJsonSchemaFromClientCode,
  analyzeMultipartForms,
  planMultipartProbes,
  discoverChunkedUploadEndpoints,
  extractSignalingUrls,
  harvestIceServers,
  catalogDataChannelLabels,
  mineClientSurface,
  extractBalanced,
};

export default CLIENT_SURFACE_MINER;
