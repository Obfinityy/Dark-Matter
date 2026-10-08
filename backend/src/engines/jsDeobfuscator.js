/**
 * jsDeobfuscator.js — Minified-JS endpoint recovery heuristics.
 *
 * Passive text analysis over bundled/minified JavaScript (or HTML containing
 * script) to recover hidden endpoint lists. Techniques:
 *  - idea 703: string-array detection — locate large obfuscator-style string
 *    tables (`var _0xabc=["a","b",...]`) and resolve `_0xabc[12]` index
 *    references back to their literal values
 *  - idea 704: string-concatenation resolver — fold `"a"+"b"` and adjacent
 *    template-literal fragments into single literals, including common
 *    obfuscator patterns like `("htt"+"p://"+"h"+"ost"+"/api")`
 *  - idea 705: base64-blob decoding — find long base64 tokens (including
 *    `atob("...")` call arguments), decode them, and keep any decoded text
 *    containing URLs or paths
 *  - idea 706: dynamic `import()` harvesting — collect static specifiers plus
 *    template-literal/concatenated variants after concatenation resolution
 *  - idea 707: import-map resolution — parse `<script type="importmap">`
 *    blocks (or standalone JSON) and resolve bare specifiers/prefixes to
 *    concrete CDN/internal URLs
 *
 * The final `recoverEndpoints()` pipeline combines all of the above to
 * produce a de-duplicated endpoint list.
 *
 * Defensive use: authorized asset discovery — recovering the endpoints a
 * target's own front-end already talks to so their exposure can be reviewed.
 */

const URL_LIKE_RE =
  /(https?:\/\/[^\s"'`<>]{4,}|wss?:\/\/[^\s"'`<>]{4,}|\/[A-Za-z0-9][A-Za-z0-9\-_./?=&%#]{3,})/g;

const PATH_END_RE = /\.(?:js|json|css|wasm|png|svg|ico|map|woff2?|html|txt|xml|mjs)(?:[?#]|$)/i;

/**
 * Strip JS comments so heuristics do not match inside them.
 *
 * @param {string} js
 * @returns {string}
 */
export function stripComments(js) {
  let out = '';
  let i = 0;
  const src = String(js || '');
  let quote = null;
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (quote) {
      out += c;
      if (c === '\\') {
        out += next || '';
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      quote = c;
      out += c;
      i++;
      continue;
    }
    if (c === '/' && next === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && next === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/**
 * Extract quoted string literals (single, double, template without ${}).
 * Returns literal values in source order.
 *
 * @param {string} js
 * @returns {string[]}
 */
export function extractStringLiterals(js) {
  const src = stripComments(js);
  const out = [];
  const re = /(["'`])((?:\\.|(?!\1)[^\\])*)\1/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    if (m[1] === '`' && m[2].includes('${')) continue; // keep simple templates only
    out.push(unescapeJs(m[2]));
  }
  return out;
}

/**
 * Unescape a JS string literal body (no surrounding quotes).
 *
 * @param {string} s
 * @returns {string}
 */
export function unescapeJs(s) {
  try {
    // eslint-disable-next-line no-new-func
    return new Function(`return ${JSON.stringify(s)};`)();
  } catch {
    return s;
  }
}

/**
 * Find obfuscator-style string-array declarations:
 * `var _0x1a2b=["...","...",...];` Returns variable name -> string list.
 *
 * Idea 703 — string-array detection.
 *
 * @param {string} js
 * @returns {Map<string,string[]>}
 */
export function findStringArrays(js) {
  const src = stripComments(js);
  const tables = new Map();
  const re =
    /(?:var|let|const)\s+([A-Za-z_$][\w$]{0,12})\s*=\s*\[((?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\s|,){20,})\]/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const items = [];
    const litRe = /(["'`])((?:\\.|(?!\1)[^\\])*)\1/g;
    let lm;
    while ((lm = litRe.exec(m[2])) !== null) items.push(unescapeJs(lm[2]));
    if (items.length >= 5) tables.set(m[1], items);
  }
  return tables;
}

/**
 * Resolve `arrayName[index]` references to their string-array values.
 * Handles decimal and hex indices, plus a trailing function-call wrapper
 * `arrayName(index)` used by some obfuscators when the decoder is an alias.
 *
 * @param {string} js
 * @param {Map<string,string[]>} tables - from findStringArrays()
 * @returns {string}
 */
export function resolveStringArrayRefs(js, tables) {
  let src = String(js || '');
  for (const [name, items] of tables) {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const refRe = new RegExp(`${esc}\\s*\\[\\s*(0x[0-9a-fA-F]+|\\d+)\\s*\\]`, 'g');
    src = src.replace(refRe, (full, idx) => {
      const i = parseInt(idx, idx.startsWith('0x') ? 16 : 10);
      if (Number.isNaN(i) || i < 0 || i >= items.length) return full;
      return JSON.stringify(items[i]);
    });
  }
  return src;
}

/**
 * Fold concatenated string literals into single literals:
 * `"a" + 'b'` -> `"ab"`, and handles template literals without
 * placeholders plus `+` chains spanning multiple operands.
 *
 * Idea 704 — string-concatenation resolver.
 *
 * @param {string} js
 * @returns {string} rewritten source with folded concatenations
 */
export function foldStringConcatenations(js) {
  let src = String(js || '');
  // Regex literal: backticks need no escaping here (only `/` would).
  const operand = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\$\\])*`)/.source;
  const chain = new RegExp(`(${operand}(?:\\s*\\+\\s*${operand}){1,})`, 'g');
  let prev;
  do {
    prev = src;
    src = src.replace(chain, full => {
      const parts = [];
      const litRe = new RegExp(operand, 'g');
      let m;
      while ((m = litRe.exec(full)) !== null) {
        const q = m[0][0];
        if (q === '`' && m[0].includes('${')) return full;
        parts.push(unescapeJs(m[0].slice(1, -1)));
      }
      return JSON.stringify(parts.join(''));
    });
  } while (src !== prev);
  return src;
}

/**
 * Find base64 tokens (standalone long tokens and atob()/Buffer arguments),
 * decode them, and keep decoded strings that look like URLs, paths or JSON
 * with endpoints.
 *
 * Idea 705 — base64-blob URL decoding.
 *
 * @param {string} js
 * @returns {Array<{encoded:string,decoded:string,urls:string[]}>}
 */
export function decodeBase64Blobs(js) {
  const src = stripComments(js);
  const candidates = new Set();
  // atob("...") / atob('...') / Buffer.from("...", "base64") arguments
  for (const m of src.matchAll(/(?:atob|globalThis\.atob)\s*\(\s*(["'])([A-Za-z0-9+/=]{24,})\1/g))
    candidates.add(m[2]);
  for (const m of src.matchAll(
    /Buffer\s*\.\s*from\s*\(\s*(["'])([A-Za-z0-9+/=]{24,})\1\s*,\s*["']base64["']/g
  ))
    candidates.add(m[2]);
  // standalone long base64-looking literals
  for (const lit of extractStringLiterals(src)) {
    if (/^[A-Za-z0-9+/]{32,}={0,2}$/.test(lit)) candidates.add(lit);
  }
  const out = [];
  for (const enc of candidates) {
    let decoded;
    try {
      decoded = Buffer.from(enc, 'base64').toString('utf8');
    } catch {
      continue;
    }
    if (!/^[\x20-\x7e\t\r\n]{8,}$/.test(decoded)) continue;
    const urls = [...new Set(decoded.match(URL_LIKE_RE) || [])];
    if (urls.length > 0 || looksLikeEndpointConfig(decoded))
      out.push({ encoded: enc.slice(0, 60), decoded, urls });
  }
  return out;
}

/** Heuristic: decoded blob carries config-ish endpoint material. */
function looksLikeEndpointConfig(text) {
  return /"(?:url|endpoint|api|baseUrl|host|graphql)"\s*:/i.test(text);
}

/**
 * Harvest dynamic `import()` targets: static string specifiers as well as
 * template literals with ${} placeholders (reported with the placeholder
 * preserved) and concatenated expressions after folding.
 *
 * Idea 706 — dynamic import() target harvesting.
 *
 * @param {string} js
 * @returns {Array<{specifier:string,dynamic:boolean}>}
 */
export function harvestDynamicImports(js) {
  const folded = foldStringConcatenations(js);
  const src = stripComments(folded);
  const out = [];
  const seen = new Set();
  const push = (specifier, dynamic) => {
    if (!specifier || seen.has(specifier)) return;
    seen.add(specifier);
    out.push({ specifier, dynamic });
  };
  for (const m of src.matchAll(/import\s*\(\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1\s*\)/g)) {
    const q = m[1];
    const body = unescapeJs(m[2]);
    push(body, q === '`' && m[2].includes('${'));
  }
  // import(/* webpackChunkName: "x" */ "./chunk.js") comment hints stay matched above;
  // also catch require.ensure()-style chunk names commonly adjacent to imports
  for (const m of src.matchAll(/webpackChunkName\s*:\s*["']([^"']+)["']/g)) {
    push(`[chunk:${m[1]}]`, true);
  }
  return out;
}

/**
 * Extract `<script type="importmap">` blocks from HTML (or accept a raw
 * JSON import-map document) and build the bare-specifier -> URL mapping.
 *
 * Idea 707 — import-map URL resolution.
 *
 * @param {string} htmlOrJson - full HTML page or the import-map JSON itself
 * @param {string} [baseUrl] - page URL used to resolve relative targets
 * @returns {{ok:boolean,error?:string,imports:Object,prefixes:Object,resolve:(spec:string)=>string|null}}
 */
export function resolveImportMap(htmlOrJson, baseUrl = '') {
  const text = String(htmlOrJson || '');
  let jsonText = text.trim();
  const blocks = [
    ...text.matchAll(/<script[^>]*type\s*=\s*["']importmap["'][^>]*>([\s\S]*?)<\/script>/gi),
  ];
  if (blocks.length > 0) jsonText = blocks[0][1];
  let map;
  try {
    map = JSON.parse(jsonText);
  } catch (e) {
    return {
      ok: false,
      error: `import-map JSON parse failed: ${e.message}`,
      imports: {},
      prefixes: {},
    };
  }
  const raw = map.imports || {};
  const imports = {};
  const prefixes = {};
  const toAbs = target => {
    if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return target;
    if (!baseUrl) return target;
    try {
      return new URL(target, baseUrl).href;
    } catch {
      return target;
    }
  };
  for (const [spec, target] of Object.entries(raw)) {
    if (typeof target !== 'string') continue;
    const abs = toAbs(target);
    if (spec.endsWith('/')) prefixes[spec] = abs;
    else imports[spec] = abs;
  }
  // Longest-prefix match first for deterministic resolution.
  const sortedPrefixes = Object.keys(prefixes).sort((a, b) => b.length - a.length);
  return {
    ok: true,
    imports,
    prefixes,
    resolve(spec) {
      if (Object.hasOwn(imports, spec)) return imports[spec];
      for (const p of sortedPrefixes) {
        if (spec.startsWith(p)) return prefixes[p] + spec.slice(p.length);
      }
      return null;
    },
  };
}

/**
 * Full pipeline: deobfuscate, then collect every URL-like endpoint.
 *
 * @param {string} js - raw JS (or HTML with embedded scripts)
 * @returns {{endpoints:string[],stringArrays:number,dynamicImports:Array,base64Findings:Array,importMaps:Array}}
 */
export function recoverEndpoints(js) {
  const src = String(js || '');
  const tables = findStringArrays(src);
  let working = resolveStringArrayRefs(src, tables);
  working = foldStringConcatenations(working);
  const base64Findings = decodeBase64Blobs(working);
  const dynamicImports = harvestDynamicImports(working);
  const literals = extractStringLiterals(working);
  const decodedExtras = base64Findings.flatMap(f => f.decoded.split(/\s+/));
  const candidates = [...literals, ...decodedExtras, ...dynamicImports.map(d => d.specifier)];
  const endpoints = new Set();
  for (const c of candidates) {
    for (const m of String(c).matchAll(URL_LIKE_RE)) {
      const u = m[0].replace(/[),;]+$/, '');
      if (u.length >= 4) endpoints.add(u);
    }
  }
  // Keep chunk-ish relative paths too (lazy-route chunks).
  for (const lit of literals) {
    if (PATH_END_RE.test(lit) && lit.length < 120 && !endpoints.has(lit)) endpoints.add(lit);
  }
  const importMaps = [];
  for (const blk of src.matchAll(
    /<script[^>]*type\s*=\s*["']importmap["'][^>]*>([\s\S]*?)<\/script>/gi
  )) {
    const resolved = resolveImportMap(blk[1]);
    if (resolved.ok) importMaps.push({ imports: resolved.imports, prefixes: resolved.prefixes });
  }
  return {
    endpoints: [...endpoints].sort(),
    stringArrays: tables.size,
    dynamicImports,
    base64Findings,
    importMaps,
  };
}
